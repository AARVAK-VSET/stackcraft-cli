import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { copyTemplates } from "../utils/templateManager.js";

describe("Template Scaffolding Matrix Suite", () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sc-scaffold-"));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.removeSync(tempDir);
    }
  });

  const MATRIX = [
    { stack: "mern", language: "typescript", expectedDirs: ["server"] },
    { stack: "mern", language: "javascript", expectedDirs: ["server"] },
    { stack: "mern+tailwind+auth", language: "javascript", expectedDirs: ["server"] },
    { stack: "mean", language: "javascript", expectedDirs: ["server"] },
    { stack: "mean+tailwind+auth", language: "javascript", expectedDirs: ["server"] },
    { stack: "mevn", language: "javascript", expectedDirs: ["server"] },
    { stack: "mevn+tailwind+auth", language: "javascript", expectedDirs: ["client", "server"] },
    { stack: "mevn+tailwind+auth", language: "typescript", expectedDirs: ["client", "server"] },
    { stack: "t3-stack", language: "typescript", expectedDirs: ["t3-app"] },
    { stack: "hono", language: "javascript", expectedDirs: ["client", "server"] },
    { stack: "hono", language: "typescript", expectedDirs: ["client", "server"] },
  ];

  for (const { stack, language, expectedDirs } of MATRIX) {
    it(`should successfully scaffold ${stack} [${language}] into isolated destination`, () => {
      // 1. Copy templates
      assert.doesNotThrow(() => {
        copyTemplates(tempDir, { stack, language });
      }, `Scaffolding failed for ${stack} (${language})`);

      // 2. Verify expected root directories exist
      for (const expectedDir of expectedDirs) {
        const fullPath = path.join(tempDir, expectedDir);
        assert.equal(
          fs.existsSync(fullPath),
          true,
          `Expected directory "${expectedDir}" in scaffolded ${stack} project`
        );
        assert.equal(
          fs.statSync(fullPath).isDirectory(),
          true,
          `"${expectedDir}" must be a directory`
        );
      }

      // 3. Verify directory is non-empty
      const rootFiles = fs.readdirSync(tempDir);
      assert.ok(rootFiles.length > 0, `Scaffolded ${stack} project must contain files`);
    });
  }
});
