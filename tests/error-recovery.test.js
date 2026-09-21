import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { setupProject, assertDestinationAvailable } from "../utils/project.js";
import { validateConfig } from "../utils/validator.js";

describe("Error Recovery, Safety & Collision Protection Suite", () => {
  let tempBaseDir;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), "sc-safety-"));
  });

  afterEach(() => {
    if (tempBaseDir && fs.existsSync(tempBaseDir)) {
      fs.removeSync(tempBaseDir);
    }
  });

  describe("Directory Collision Handling", () => {
    it("should reject scaffolding when target directory exists and preserve sentinel file", async () => {
      const projectName = "existing-app";
      const projectPath = path.join(tempBaseDir, projectName);

      // Pre-create directory with a sentinel file
      fs.mkdirSync(projectPath, { recursive: true });
      const sentinelPath = path.join(projectPath, "sentinel.txt");
      fs.writeFileSync(sentinelPath, "ORIGINAL_CRITICAL_DATA", "utf-8");

      // 1. Assert assertDestinationAvailable throws
      assert.throws(
        () => assertDestinationAvailable(projectPath, projectName),
        (err) => {
          assert.equal(err.code, "EEXIST");
          assert.match(err.message, /already exists/i);
          return true;
        }
      );

      // 2. Attempt setupProject with collision in test environment
      await assert.rejects(
        async () => {
          await setupProject(
            projectName,
            { stack: "mern", language: "typescript" },
            { targetDir: tempBaseDir, skipInstall: true, silent: true }
          );
        },
        (err) => {
          assert.match(err.message, /already exists/i);
          return true;
        }
      );

      // 3. Verify sentinel file is completely untouched
      assert.equal(fs.existsSync(sentinelPath), true);
      assert.equal(fs.readFileSync(sentinelPath, "utf-8"), "ORIGINAL_CRITICAL_DATA");
    });
  });

  describe("Pre-Filesystem Validation Guard", () => {
    it("should prevent directory creation when project name contains path traversal", async () => {
      const traversalName = "../malicious_dir";
      const targetPath = path.join(tempBaseDir, traversalName);

      const validation = validateConfig({
        projectName: traversalName,
        stack: "mern",
        language: "typescript",
      });
      assert.equal(validation.valid, false);
      assert.match(validation.error, /traversal/i);

      // Attempting setupProject must reject before filesystem changes
      await assert.rejects(
        async () => {
          await setupProject(
            traversalName,
            { stack: "mern", language: "typescript" },
            { targetDir: tempBaseDir, skipInstall: true, silent: true }
          );
        },
        (err) => {
          assert.match(err.message, /traversal/i);
          return true;
        }
      );

      // Ensure no directory was created
      assert.equal(fs.existsSync(targetPath), false);
    });

    it("should prevent directory creation when stack name is unsupported", async () => {
      const projectName = "unsupported-test";
      const targetPath = path.join(tempBaseDir, projectName);

      await assert.rejects(
        async () => {
          await setupProject(
            projectName,
            { stack: "cobol-stack", language: "typescript" },
            { targetDir: tempBaseDir, skipInstall: true, silent: true }
          );
        },
        (err) => {
          assert.match(err.message, /unsupported stack/i);
          return true;
        }
      );

      assert.equal(fs.existsSync(targetPath), false);
    });
  });

  describe("Filesystem Cleanup Isolation", () => {
    it("should allow safe cleanup of generated scaffolding directories", () => {
      const sandbox = path.join(tempBaseDir, "sandbox-test");
      fs.mkdirSync(sandbox, { recursive: true });
      fs.writeFileSync(path.join(sandbox, "test.json"), JSON.stringify({ ok: true }));

      assert.equal(fs.existsSync(sandbox), true);
      fs.removeSync(sandbox);
      assert.equal(fs.existsSync(sandbox), false);
    });
  });
});
