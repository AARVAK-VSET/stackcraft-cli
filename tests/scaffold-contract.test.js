import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { copyTemplates } from "../utils/templateManager.js";
import { STACK_CONTRACTS, validateScaffold } from "./helpers/contracts.js";

describe("Contract-Driven Scaffold Validation Suite", () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sc-contract-"));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.removeSync(tempDir);
    }
  });

  const CONTRACT_TESTS = [
    { stack: "mern", language: "typescript" },
    { stack: "mern+tailwind+auth", language: "javascript" },
    { stack: "mean", language: "javascript" },
    { stack: "mean+tailwind+auth", language: "javascript" },
    { stack: "mevn", language: "javascript" },
    { stack: "mevn+tailwind+auth", language: "javascript" },
    { stack: "mevn+tailwind+auth", language: "typescript" },
    { stack: "t3-stack", language: "typescript" },
    { stack: "hono", language: "javascript" },
    { stack: "hono", language: "typescript" },
  ];

  for (const { stack, language } of CONTRACT_TESTS) {
    it(`should strictly satisfy scaffolding contract for ${stack} (${language})`, () => {
      const contract = STACK_CONTRACTS[stack];
      assert.ok(contract, `Contract definition must exist for stack "${stack}"`);

      copyTemplates(tempDir, { stack, language });

      const evaluation = validateScaffold(tempDir, contract);
      if (!evaluation.pass) {
        const message = [
          `❌ Scaffold contract violation for "${stack} (${language})":`,
          ...evaluation.diagnostics.map((d) => `  - ${d}`),
          `Generated directory: ${tempDir}`,
        ].join("\n");
        assert.fail(message);
      }

      assert.equal(evaluation.pass, true);
      assert.equal(evaluation.diagnostics.length, 0);
    });
  }
});
