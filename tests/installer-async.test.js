import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import {
  spawnAsync,
  installDependencies,
  activeProcesses,
  cleanupActiveProcesses,
} from "../utils/installer.js";

describe("Asynchronous Installer & Cancellation Lifecycle Suite", () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sc-async-test-"));
  });

  afterEach(() => {
    cleanupActiveProcesses();
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("spawnAsync should execute command asynchronously and resolve on code 0", async () => {
    const nodeCmd = process.execPath;
    const result = await spawnAsync(nodeCmd, ["-e", "console.log('async-ok')"], {
      cwd: tempDir,
    });

    assert.equal(result.code, 0);
  });

  it("spawnAsync should reject on non-zero exit code", async () => {
    const nodeCmd = process.execPath;
    await assert.rejects(
      async () => {
        await spawnAsync(nodeCmd, ["-e", "process.exit(1)"], {
          cwd: tempDir,
        });
      },
      (err) => {
        assert.equal(err.code, 1);
        return true;
      }
    );
  });

  it("activeProcesses should track spawned worker child processes during execution", async () => {
    const nodeCmd = process.execPath;
    const initialCount = activeProcesses.size;

    const promise = spawnAsync(nodeCmd, ["-e", "setTimeout(() => {}, 200)"], {
      cwd: tempDir,
    });

    assert.equal(activeProcesses.size, initialCount + 1);

    await promise;

    assert.equal(activeProcesses.size, initialCount);
  });

  it("cleanupActiveProcesses should terminate all registered active worker processes", async () => {
    const nodeCmd = process.execPath;

    // Spawn long running background task
    const promise = spawnAsync(nodeCmd, ["-e", "setTimeout(() => {}, 10000)"], {
      cwd: tempDir,
    });

    assert.equal(activeProcesses.size >= 1, true);

    cleanupActiveProcesses();

    assert.equal(activeProcesses.size, 0);

    await assert.rejects(promise);
  });

  it("installDependencies should execute asynchronously without throwing for empty dir", async () => {
    await installDependencies(tempDir, {}, "test-project", false, []);
  });
});
