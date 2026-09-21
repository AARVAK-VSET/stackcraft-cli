import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { setupProject } from "../utils/project.js";
import { STACK_CONTRACTS, validateScaffold } from "./helpers/contracts.js";

describe("Public Scaffolding Workflow Suite (setupProject)", () => {
  let tempBaseDir;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), "sc-workflow-"));
  });

  afterEach(() => {
    if (tempBaseDir && fs.existsSync(tempBaseDir)) {
      fs.removeSync(tempBaseDir);
    }
  });

  const WORKFLOW_STACKS = [
    { projectName: "test-mern-app", config: { stack: "mern", language: "typescript" } },
    { projectName: "test-hono-app", config: { stack: "hono", language: "javascript" } },
    { projectName: "test-t3-app", config: { stack: "t3-stack", language: "typescript" } },
    { projectName: "test-mean-app", config: { stack: "mean", language: "javascript" } },
  ];

  for (const { projectName, config } of WORKFLOW_STACKS) {
    it(`should run complete setup workflow for ${config.stack} [${config.language}]`, async () => {
      const result = await setupProject(projectName, config, {
        targetDir: tempBaseDir,
        skipInstall: true,
        silent: true,
      });

      assert.equal(result.success, true);
      const expectedPath = path.join(tempBaseDir, projectName);
      assert.equal(result.projectPath, expectedPath);
      assert.equal(fs.existsSync(expectedPath), true);

      // Validate against the stack contract
      const contract = STACK_CONTRACTS[config.stack];
      const evaluation = validateScaffold(expectedPath, contract);
      assert.equal(
        evaluation.pass,
        true,
        `Workflow output failed contract: ${evaluation.diagnostics.join(", ")}`
      );
    });
  }
});
