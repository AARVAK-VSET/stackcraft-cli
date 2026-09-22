import test from "node:test";
import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { PassThrough } from "node:stream";
import path from "path";

import {
  parseMaintenanceArgs,
  confirmAction,
  formatDryRunReport,
} from "../scripts/lib/maintenance-cli.js";
import { clearAllVectors } from "../scripts/clear-all-vectors.js";
import { cleanupDuplicates, findDuplicateVectors } from "../scripts/cleanup-duplicates.js";
import { deleteIssueVectors } from "../scripts/cleanup-specific-issue.js";
import { cleanupClosedIssue } from "../scripts/cleanup-closed-issue.js";

const scriptsDir = path.join(process.cwd(), "scripts");
const destructiveScripts = [
  "clear-all-vectors.js",
  "cleanup-duplicates.js",
  "cleanup-specific-issue.js",
  "cleanup-closed-issue.js",
];

// In-memory stand-in for a Pinecone index that records every mutating call.
function fakeIndex({ total = 0, matches = [] } = {}) {
  const calls = { deleteAll: 0, deleteMany: [] };
  return {
    calls,
    async describeIndexStats() {
      return { totalRecordCount: calls.deleteAll ? 0 : total, dimension: 1024, indexFullness: 0 };
    },
    async query() {
      return { matches };
    },
    async listPaginated() {
      return { vectors: [] };
    },
    async deleteAll() {
      calls.deleteAll++;
    },
    async deleteMany(ids) {
      calls.deleteMany.push(ids);
    },
  };
}

function fakeOctokit(issue = { title: "Old bug", state: "closed", closed_at: "2026-01-01" }) {
  const comments = [];
  return {
    comments,
    issues: {
      async get() {
        return { data: issue };
      },
      async createComment(args) {
        comments.push(args);
      },
    },
  };
}

function captureLog() {
  const lines = [];
  const log = (...args) => lines.push(args.join(" "));
  log.text = () => lines.join("\n");
  return log;
}

const noWait = async () => {};
const neverAsk = async () => {
  throw new Error("confirm() must not be called");
};

const duplicateMatches = [
  { id: "issue-5", metadata: { issue_number: 5 } },
  { id: "issue-5-1700000000000", metadata: { issue_number: 5 } },
  { id: "issue-6", metadata: { issue_number: 6 } },
];

// --- Argument parsing -------------------------------------------------------

test("parseMaintenanceArgs recognises standard long and short flags", () => {
  assert.deepStrictEqual(parseMaintenanceArgs(["--dry-run", "--yes"]), {
    dryRun: true, yes: true, help: false, positionals: [], unknown: [],
  });
  const short = parseMaintenanceArgs(["-n", "-y", "-h"]);
  assert.strictEqual(short.dryRun, true);
  assert.strictEqual(short.yes, true);
  assert.strictEqual(short.help, true);
});

test("parseMaintenanceArgs supports combined short flags, --force alias and positionals", () => {
  const combined = parseMaintenanceArgs(["-ny", "42"]);
  assert.strictEqual(combined.dryRun, true);
  assert.strictEqual(combined.yes, true);
  assert.deepStrictEqual(combined.positionals, ["42"]);

  assert.strictEqual(parseMaintenanceArgs(["--force"]).yes, true);
  assert.deepStrictEqual(parseMaintenanceArgs(["--", "--yes"]).positionals, ["--yes"]);
});

test("parseMaintenanceArgs defaults to no confirmation bypass and reports unknown flags", () => {
  const empty = parseMaintenanceArgs([]);
  assert.strictEqual(empty.yes, false);
  assert.strictEqual(empty.dryRun, false);
  assert.deepStrictEqual(parseMaintenanceArgs(["--yess", "-q"]).unknown, ["--yess", "-q"]);
});

// --- Confirmation prompt ----------------------------------------------------

async function ask(answer, extra = {}) {
  const input = new PassThrough();
  const output = new PassThrough();
  let written = "";
  output.on("data", chunk => { written += chunk; });
  const pending = confirmAction({ question: "Delete?", input, output, interactive: true, ...extra });
  if (answer === null) input.end();
  else input.write(`${answer}\n`);
  const result = await pending;
  return { result, written };
}

test("confirmAction accepts y/yes (any case) and prints a [y/N] prompt", async () => {
  for (const answer of ["y", "Y", "yes", "YES", "  yes  "]) {
    const { result, written } = await ask(answer);
    assert.strictEqual(result, true, `expected "${answer}" to confirm`);
    assert.match(written, /Delete\? \[y\/N\]/);
  }
});

test("confirmAction defaults to No for empty, negative or unrelated answers", async () => {
  for (const answer of ["", "n", "no", "maybe", "yep"]) {
    const { result } = await ask(answer);
    assert.strictEqual(result, false, `expected "${answer}" to decline`);
  }
});

test("confirmAction treats closed input (Ctrl+D) as No", async () => {
  const { result } = await ask(null);
  assert.strictEqual(result, false);
});

test("confirmAction with `expected` requires the exact phrase to be typed", async () => {
  const ok = await ask("my-index", { expected: "my-index" });
  assert.strictEqual(ok.result, true);
  assert.match(ok.written, /Type "my-index" to confirm/);

  assert.strictEqual((await ask("y", { expected: "my-index" })).result, false);
  assert.strictEqual((await ask("MY-INDEX", { expected: "my-index" })).result, false);
});

test("confirmAction skips the prompt when --yes is given", async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  let written = "";
  output.on("data", chunk => { written += chunk; });
  const result = await confirmAction({ question: "Delete?", yes: true, input, output, interactive: false });
  assert.strictEqual(result, true);
  assert.strictEqual(written, "");
});

test("confirmAction refuses in non-interactive sessions without --yes", async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  let written = "";
  output.on("data", chunk => { written += chunk; });
  input.write("y\n"); // piped input must not be able to confirm
  const result = await confirmAction({ question: "Delete?", input, output, interactive: false });
  assert.strictEqual(result, false);
  assert.match(written, /--yes/);
  assert.match(written, /--dry-run/);
});

// --- Dry-run report formatting ------------------------------------------------

test("formatDryRunReport shows the operation, index, count and a no-changes notice", () => {
  const report = formatDryRunReport({
    operation: "Clear all vectors",
    indexName: "issues",
    affectedCount: 1234,
    details: ["Method: deleteAll()"],
  });
  assert.match(report, /\[DRY RUN\] Clear all vectors/);
  assert.match(report, /Index: issues/);
  assert.match(report, /Vectors that would be deleted: 1234/);
  assert.match(report, /Method: deleteAll\(\)/);
  assert.match(report, /No changes were made/);
  assert.doesNotMatch(report, /Affected vector IDs/);
});

test("formatDryRunReport truncates long ID lists", () => {
  const ids = Array.from({ length: 25 }, (_, i) => `vec-${i}`);
  const report = formatDryRunReport({ operation: "x", indexName: "i", affectedCount: 25, ids, maxIds: 3 });
  assert.match(report, /- vec-0\n/);
  assert.match(report, /- vec-2\n/);
  assert.doesNotMatch(report, /- vec-3\n/);
  assert.match(report, /\.\.\. and 22 more/);
});

// --- clear-all-vectors ----------------------------------------------------------

test("clearAllVectors --dry-run reports the vector count and never deletes or prompts", async () => {
  const index = fakeIndex({ total: 42 });
  const log = captureLog();
  const result = await clearAllVectors({
    index, indexName: "issues", options: { dryRun: true }, confirm: neverAsk, log, wait: noWait,
  });
  assert.strictEqual(result.status, "dry-run");
  assert.strictEqual(index.calls.deleteAll, 0);
  assert.deepStrictEqual(index.calls.deleteMany, []);
  assert.match(log.text(), /\[DRY RUN\] Clear all vectors/);
  assert.match(log.text(), /Vectors that would be deleted: 42/);
});

test("clearAllVectors aborts without deleting when confirmation is declined", async () => {
  const index = fakeIndex({ total: 42 });
  const log = captureLog();
  let prompt;
  const result = await clearAllVectors({
    index, indexName: "issues", options: {}, log, wait: noWait,
    confirm: async (args) => { prompt = args; return false; },
  });
  assert.strictEqual(result.status, "aborted");
  assert.strictEqual(index.calls.deleteAll, 0);
  assert.strictEqual(prompt.expected, "issues", "must require typing the index name");
  assert.match(log.text(), /Aborted/);
});

test("clearAllVectors deletes after confirmation and forwards --yes to the prompt", async () => {
  const index = fakeIndex({ total: 42 });
  let prompt;
  const result = await clearAllVectors({
    index, indexName: "issues", options: { yes: true }, log: captureLog(), wait: noWait,
    confirm: async (args) => { prompt = args; return true; },
  });
  assert.strictEqual(prompt.yes, true);
  assert.strictEqual(result.status, "cleared");
  assert.strictEqual(index.calls.deleteAll, 1);
});

test("clearAllVectors does not prompt when the index is already empty", async () => {
  const index = fakeIndex({ total: 0 });
  const result = await clearAllVectors({
    index, indexName: "issues", options: {}, confirm: neverAsk, log: captureLog(), wait: noWait,
  });
  assert.strictEqual(result.status, "empty");
});

// --- cleanup-duplicates ---------------------------------------------------------

test("findDuplicateVectors keeps the clean ID and marks timestamped copies for deletion", () => {
  const { vectorsToKeep, vectorsToDelete } = findDuplicateVectors(duplicateMatches);
  assert.deepStrictEqual(vectorsToKeep.map(v => v.id).sort(), ["issue-5", "issue-6"]);
  assert.deepStrictEqual(vectorsToDelete, ["issue-5-1700000000000"]);
});

test("cleanupDuplicates --dry-run lists affected IDs without deleting", async () => {
  const index = fakeIndex({ matches: duplicateMatches });
  const log = captureLog();
  const result = await cleanupDuplicates({
    index, indexName: "issues", options: { dryRun: true }, confirm: neverAsk, log, wait: noWait,
  });
  assert.strictEqual(result.status, "dry-run");
  assert.deepStrictEqual(index.calls.deleteMany, []);
  assert.match(log.text(), /Vectors that would be deleted: 1/);
  assert.match(log.text(), /Vectors that would be kept: 2/);
  assert.match(log.text(), /- issue-5-1700000000000/);
});

test("cleanupDuplicates only deletes after confirmation", async () => {
  const declinedIndex = fakeIndex({ matches: duplicateMatches });
  const declined = await cleanupDuplicates({
    index: declinedIndex, indexName: "issues", log: captureLog(), wait: noWait, confirm: async () => false,
  });
  assert.strictEqual(declined.status, "aborted");
  assert.deepStrictEqual(declinedIndex.calls.deleteMany, []);

  const confirmedIndex = fakeIndex({ matches: duplicateMatches });
  const confirmed = await cleanupDuplicates({
    index: confirmedIndex, indexName: "issues", log: captureLog(), wait: noWait, confirm: async () => true,
  });
  assert.strictEqual(confirmed.status, "cleaned");
  assert.deepStrictEqual(confirmedIndex.calls.deleteMany, [["issue-5-1700000000000"]]);
});

// --- cleanup-specific-issue -------------------------------------------------------

test("deleteIssueVectors --dry-run reports matching vectors without deleting", async () => {
  const index = fakeIndex({ matches: [{ id: "issue-7", metadata: { issue_number: 7 } }] });
  const log = captureLog();
  const result = await deleteIssueVectors({
    index, indexName: "issues", issueNumber: 7, options: { dryRun: true }, confirm: neverAsk, log,
  });
  assert.strictEqual(result.status, "dry-run");
  assert.deepStrictEqual(index.calls.deleteMany, []);
  assert.match(log.text(), /\[DRY RUN\] Delete vectors for Issue #7/);
  assert.match(log.text(), /Vectors that would be deleted: 1/);
});

test("deleteIssueVectors aborts when confirmation is declined", async () => {
  const index = fakeIndex({ matches: [{ id: "issue-7", metadata: { issue_number: 7 } }] });
  const result = await deleteIssueVectors({
    index, indexName: "issues", issueNumber: 7, log: captureLog(), confirm: async () => false,
  });
  assert.strictEqual(result.status, "aborted");
  assert.deepStrictEqual(index.calls.deleteMany, []);
});

// --- cleanup-closed-issue ---------------------------------------------------------

const closedIssueArgs = { indexName: "issues", owner: "o", repo: "r", issueNumber: 9 };

test("cleanupClosedIssue --dry-run neither deletes vectors nor posts comments", async () => {
  const index = fakeIndex({ matches: [{ id: "issue-9", metadata: { issue_number: 9 } }] });
  const octokit = fakeOctokit();
  const log = captureLog();
  const result = await cleanupClosedIssue({
    ...closedIssueArgs, index, octokit, options: { dryRun: true }, confirm: neverAsk, log,
  });
  assert.strictEqual(result.status, "dry-run");
  assert.deepStrictEqual(index.calls.deleteMany, []);
  assert.deepStrictEqual(octokit.comments, []);
  assert.match(log.text(), /Vectors that would be deleted: 1/);
});

test("cleanupClosedIssue aborts without deleting or commenting when declined", async () => {
  const index = fakeIndex({ matches: [{ id: "issue-9", metadata: { issue_number: 9 } }] });
  const octokit = fakeOctokit();
  const result = await cleanupClosedIssue({
    ...closedIssueArgs, index, octokit, log: captureLog(), confirm: async () => false,
  });
  assert.strictEqual(result.status, "aborted");
  assert.deepStrictEqual(index.calls.deleteMany, []);
  assert.deepStrictEqual(octokit.comments, []);
});

test("cleanupClosedIssue deletes and comments once confirmed", async () => {
  const index = fakeIndex({ matches: [{ id: "issue-9", metadata: { issue_number: 9 } }] });
  const octokit = fakeOctokit();
  const result = await cleanupClosedIssue({
    ...closedIssueArgs, index, octokit, options: { yes: true }, log: captureLog(),
  });
  assert.strictEqual(result.status, "deleted");
  assert.deepStrictEqual(index.calls.deleteMany, [["issue-9"]]);
  assert.strictEqual(octokit.comments.length, 1);
});

// --- CLI entry points ---------------------------------------------------------------

test("maintenance scripts document --dry-run and --yes in --help and exit 0", () => {
  for (const script of destructiveScripts) {
    for (const flag of ["--help", "-h"]) {
      const result = spawnSync(process.execPath, [path.join(scriptsDir, script), flag], { encoding: "utf8" });
      assert.strictEqual(result.status, 0, `${script} ${flag}`);
      assert.match(result.stdout, /-n, --dry-run/, script);
      assert.match(result.stdout, /-y, --yes/, script);
    }
  }
});

test("maintenance scripts reject unknown options before touching Pinecone", () => {
  for (const script of destructiveScripts) {
    const result = spawnSync(process.execPath, [path.join(scriptsDir, script), "--dryrun"], { encoding: "utf8" });
    assert.strictEqual(result.status, 1, script);
    assert.match(result.stderr, /Unknown option: --dryrun/, script);
  }
});
