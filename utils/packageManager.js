/**
 * Package manager abstraction for StackCraft CLI.
 *
 * Provides a unified interface over npm, pnpm, yarn, and bun so that all
 * installation and scaffolding routines can delegate to the correct CLI
 * without hardcoding a specific package manager.
 */

import { spawnSync } from "child_process";

// --- Constants ----------------------------------------------------------------

/** Every package manager StackCraft officially supports. */
export const SUPPORTED_PACKAGE_MANAGERS = ["npm", "pnpm", "yarn", "bun"];

// --- Executable resolution ----------------------------------------------------

/**
 * Returns the platform-aware executable name for a package manager.
 * On Windows, npm/pnpm/yarn ship as `.cmd` wrappers; bun is a native binary.
 *
 * @param {"npm"|"pnpm"|"yarn"|"bun"} pm
 * @returns {string}
 */
export function getExecutable(pm) {
  if (!SUPPORTED_PACKAGE_MANAGERS.includes(pm)) {
    throw new Error(
      `Unsupported package manager: "${pm}". Supported: ${SUPPORTED_PACKAGE_MANAGERS.join(", ")}`
    );
  }
  const isWin = process.platform === "win32";
  if (pm === "bun") return "bun";
  return isWin ? `${pm}.cmd` : pm;
}

/**
 * Returns the runner command for executing packages (npx equivalent).
 *
 * @param {"npm"|"pnpm"|"yarn"|"bun"} pm
 * @returns {{ cmd: string, leadingArgs: string[] }}
 */
export function getRunnerCommand(pm) {
  const isWin = process.platform === "win32";
  switch (pm) {
    case "npm":
      return { cmd: isWin ? "npx.cmd" : "npx", leadingArgs: ["-y"] };
    case "pnpm":
      return { cmd: getExecutable("pnpm"), leadingArgs: ["dlx"] };
    case "yarn":
      return { cmd: getExecutable("yarn"), leadingArgs: ["dlx"] };
    case "bun":
      return { cmd: "bun", leadingArgs: ["x"] };
    default:
      throw new Error(`Unsupported package manager: "${pm}"`);
  }
}

// --- Command builders ---------------------------------------------------------

/**
 * Builds the install command for installing dependencies.
 *
 * @param {"npm"|"pnpm"|"yarn"|"bun"} pm
 * @param {string[]} [extra=[]]
 * @returns {{ cmd: string, args: string[] }}
 */
export function buildInstallCommand(pm, extra = []) {
  const cmd = getExecutable(pm);
  switch (pm) {
    case "npm":
      return { cmd, args: extra.length ? ["install", ...extra] : ["install"] };
    case "pnpm":
      return { cmd, args: extra.length ? ["add", ...extra] : ["install"] };
    case "yarn":
      return { cmd, args: extra.length ? ["add", ...extra] : ["install"] };
    case "bun":
      return { cmd, args: extra.length ? ["add", ...extra] : ["install"] };
    default:
      throw new Error(`Unsupported package manager: "${pm}"`);
  }
}

/**
 * Builds the init command for creating a new package.json.
 *
 * @param {"npm"|"pnpm"|"yarn"|"bun"} pm
 * @returns {{ cmd: string, args: string[] }}
 */
export function buildInitCommand(pm) {
  const cmd = getExecutable(pm);
  switch (pm) {
    case "npm":
      return { cmd, args: ["init", "-y"] };
    case "pnpm":
      return { cmd, args: ["init"] };
    case "yarn":
      return { cmd, args: ["init", "-y"] };
    case "bun":
      return { cmd, args: ["init", "-y"] };
    default:
      throw new Error(`Unsupported package manager: "${pm}"`);
  }
}

/**
 * Builds the command for scaffolding a Vite project.
 *
 * @param {"npm"|"pnpm"|"yarn"|"bun"} pm
 * @param {string} projectDir
 * @param {string} template
 * @returns {{ cmd: string, args: string[] }}
 */
export function buildViteCreateCommand(pm, projectDir, template) {
  const { cmd, leadingArgs } = getRunnerCommand(pm);
  return {
    cmd,
    args: [
      ...leadingArgs,
      "create-vite@latest",
      projectDir,
      "--",
      "--template",
      template,
      "--no-interactive",
    ],
  };
}

/**
 * Builds the command for scaffolding a Hono server.
 *
 * @param {"npm"|"pnpm"|"yarn"|"bun"} pm
 * @param {string} projectDir
 * @returns {{ cmd: string, args: string[] }}
 */
export function buildHonoCreateCommand(pm, projectDir) {
  const { cmd, leadingArgs } = getRunnerCommand(pm);
  return {
    cmd,
    args: [
      ...leadingArgs,
      "create-hono@latest",
      projectDir,
      "--",
      "--template",
      "cloudflare-workers",
      "--pm",
      pm,
    ],
  };
}

/**
 * Builds the Angular CLI scaffolding command.
 *
 * @param {"npm"|"pnpm"|"yarn"|"bun"} pm
 * @param {string} projectDir
 * @param {string[]} [extraFlags=[]]
 * @returns {{ cmd: string, args: string[] }}
 */
export function buildAngularCreateCommand(pm, projectDir, extraFlags = []) {
  const { cmd, leadingArgs } = getRunnerCommand(pm);
  return {
    cmd,
    args: [
      ...leadingArgs,
      "@angular/cli",
      "new",
      projectDir,
      "--style=css",
      "--routing=false",
      "--ssr=false",
      "--skip-git",
      "--skip-install",
      "--interactive=false",
      ...extraFlags,
    ],
  };
}

/**
 * Builds the run-script command (npm run <script> equivalent).
 *
 * @param {"npm"|"pnpm"|"yarn"|"bun"} pm
 * @param {string} script
 * @returns {{ cmd: string, args: string[] }}
 */
export function buildRunScriptCommand(pm, script) {
  const cmd = getExecutable(pm);
  switch (pm) {
    case "npm":
      return { cmd, args: ["run", script] };
    case "pnpm":
      return { cmd, args: ["run", script] };
    case "yarn":
      return { cmd, args: [script] };
    case "bun":
      return { cmd, args: ["run", script] };
    default:
      throw new Error(`Unsupported package manager: "${pm}"`);
  }
}

// --- Auto-detection -----------------------------------------------------------

/**
 * Checks whether a given package manager binary is available on PATH.
 *
 * @param {"npm"|"pnpm"|"yarn"|"bun"} pm
 * @returns {boolean}
 */
export function isPackageManagerAvailable(pm) {
  const exe = getExecutable(pm);
  const result = spawnSync(exe, ["--version"], {
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  return result.status === 0 && !result.error;
}

/**
 * Returns the first available package manager from the preferred list.
 * Falls back to "npm" if none found.
 *
 * @param {string[]} [preferred=SUPPORTED_PACKAGE_MANAGERS]
 * @returns {"npm"|"pnpm"|"yarn"|"bun"}
 */
export function detectPackageManager(preferred = SUPPORTED_PACKAGE_MANAGERS) {
  for (const pm of preferred) {
    if (isPackageManagerAvailable(pm)) {
      return pm;
    }
  }
  return "npm";
}
