import test from "node:test";
import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import os from "os";
import path from "path";

const cli = path.join(process.cwd(), "bin", "stackcraft.js");
const pkg = JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8"));

function run(...args) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
    cwd: os.tmpdir(),
  });
}

test("stackcraft --version and -v should print the package version and exit 0", () => {
  for (const flag of ["--version", "-v"]) {
    const result = run(flag);
    assert.strictEqual(result.status, 0);
    assert.strictEqual(result.stdout.trim(), pkg.version);
  }
});

test("stackcraft --help and -h should print usage with available stacks and exit 0", () => {
  for (const flag of ["--help", "-h"]) {
    const result = run(flag);
    assert.strictEqual(result.status, 0);
    assert.match(result.stdout, /Usage: stackcraft/);
    assert.match(result.stdout, /mern/);
    assert.match(result.stdout, /hono/);
  }
});

test("stackcraft should reject unknown flags instead of using them as a project name", () => {
  const result = run("--bogus");
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /Unknown option: --bogus/);
});

test("stackcraft should still validate a positional project name", () => {
  const result = run("bad name");
  assert.strictEqual(result.status, 1);
});
