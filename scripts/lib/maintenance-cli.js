import readline from "node:readline/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Shared CLI helpers for the destructive vector maintenance scripts
 * (clear-all-vectors, cleanup-duplicates, cleanup-specific-issue,
 * cleanup-closed-issue).
 *
 * Conventions:
 *   --dry-run, -n   Show what would be deleted without mutating the index
 *   --yes, -y       Skip the interactive confirmation prompt
 *   --force         Deprecated alias for --yes (kept for existing automation)
 *   --help, -h      Show usage
 */

const FLAG_ALIASES = {
  "--dry-run": "dryRun",
  "-n": "dryRun",
  "--yes": "yes",
  "-y": "yes",
  "--force": "yes",
  "--help": "help",
  "-h": "help",
};

const SHORT_FLAGS = { n: "dryRun", y: "yes", h: "help" };

export function parseMaintenanceArgs(argv = []) {
  const options = {
    dryRun: false,
    yes: false,
    help: false,
    positionals: [],
    unknown: [],
  };

  let onlyPositionals = false;
  for (const arg of argv) {
    if (onlyPositionals) {
      options.positionals.push(arg);
    } else if (arg === "--") {
      onlyPositionals = true;
    } else if (FLAG_ALIASES[arg]) {
      options[FLAG_ALIASES[arg]] = true;
    } else if (/^-[a-z]{2,}$/i.test(arg)) {
      // Combined short flags, e.g. -ny
      for (const ch of arg.slice(1)) {
        if (SHORT_FLAGS[ch]) options[SHORT_FLAGS[ch]] = true;
        else options.unknown.push(`-${ch}`);
      }
    } else if (arg.startsWith("-") && !/^-\d/.test(arg)) {
      options.unknown.push(arg);
    } else {
      options.positionals.push(arg);
    }
  }

  return options;
}

/**
 * Ask the user to confirm a destructive action.
 *
 * Resolves to true only when the action should proceed:
 *   - `yes` is set (--yes / -y / --force), or
 *   - the session is interactive and the user answers "y"/"yes"
 *     (or types `expected` exactly, when provided).
 *
 * Non-interactive sessions without --yes are always refused so that
 * CI jobs and piped invocations can never delete data by accident.
 */
export async function confirmAction({
  question,
  yes = false,
  expected,
  input = process.stdin,
  output = process.stdout,
  interactive = Boolean(input.isTTY),
}) {
  if (yes) return true;

  if (!interactive) {
    output.write(
      "❌ Refusing to continue: confirmation is required but no interactive terminal is available.\n" +
        "   Re-run with --yes (-y) to confirm, or --dry-run to preview.\n"
    );
    return false;
  }

  const prompt = expected
    ? `${question}\nType "${expected}" to confirm: `
    : `${question} [y/N] `;

  const rl = readline.createInterface({ input, output, terminal: false });
  // Input closed before an answer (e.g. Ctrl+D) counts as "no"
  const closed = new Promise(resolve => rl.once("close", () => resolve(null)));
  try {
    const answer = await Promise.race([rl.question(prompt), closed]);
    if (answer === null) return false;
    const trimmed = answer.trim();
    return expected ? trimmed === expected : /^(y|yes)$/i.test(trimmed);
  } catch {
    return false;
  } finally {
    rl.close();
  }
}

/**
 * Build the report printed in --dry-run mode.
 */
export function formatDryRunReport({
  operation,
  indexName,
  affectedCount,
  ids = [],
  maxIds = 20,
  details = [],
}) {
  const lines = [
    "",
    `🧪 [DRY RUN] ${operation}`,
    `  Index: ${indexName ?? "(unset)"}`,
    `  Vectors that would be deleted: ${affectedCount}`,
  ];

  for (const detail of details) lines.push(`  ${detail}`);

  if (ids.length > 0) {
    lines.push("  Affected vector IDs:");
    for (const id of ids.slice(0, maxIds)) lines.push(`    - ${id}`);
    if (ids.length > maxIds) lines.push(`    ... and ${ids.length - maxIds} more`);
  }

  lines.push("✅ No changes were made. Re-run without --dry-run to apply.");
  return lines.join("\n");
}

/**
 * True when the module at `moduleUrl` is the script node was invoked with,
 * so scripts can be imported by tests without executing.
 */
export function isDirectRun(moduleUrl, argv1 = process.argv[1]) {
  if (!argv1) return false;
  const normalize = (p) => {
    const resolved = path.resolve(p);
    return process.platform === "win32" ? resolved.toLowerCase() : resolved;
  };
  return normalize(fileURLToPath(moduleUrl)) === normalize(argv1);
}

export function reportUnknownOptions(unknown, scriptName) {
  if (unknown.length === 0) return false;
  console.error(`Unknown option: ${unknown.join(", ")}`);
  console.error(`Run: node scripts/${scriptName} --help`);
  return true;
}
