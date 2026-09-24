import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateProjectName,
  validateStack,
  validateLanguage,
  validateStackLanguage,
  validateConfig,
  SUPPORTED_STACKS,
  SUPPORTED_LANGUAGES,
} from "../utils/validator.js";

describe("Configuration Validation Suite", () => {
  describe("Project Name Validation", () => {
    it("should accept valid alphanumeric names with hyphens and underscores", () => {
      const validNames = [
        "my-app",
        "app_1",
        "stackcraft-2026",
        "backend_service_v2",
        "mern-starter",
        "Project123",
      ];
      for (const name of validNames) {
        const result = validateProjectName(name);
        assert.equal(result.valid, true, `Expected "${name}" to be valid`);
        assert.equal(result.error, undefined);
      }
    });

    it("should reject empty, undefined, or whitespace-only names", () => {
      const emptyCases = ["", "   ", "\t\n", null, undefined];
      for (const input of emptyCases) {
        const result = validateProjectName(input);
        assert.equal(result.valid, false);
        assert.match(result.error, /required/i);
      }
    });

    it("should reject names containing spaces or special characters", () => {
      const invalidNames = [
        "my app",
        "my@project",
        "app#1",
        "test$app",
        "hello!world",
        "react&node",
      ];
      for (const name of invalidNames) {
        const result = validateProjectName(name);
        assert.equal(result.valid, false, `Expected "${name}" to be rejected`);
        assert.match(result.error, /Only letters, numbers, hyphens/i);
      }
    });

    it("should reject path traversal sequences and directory separators", () => {
      const traversalAttempts = [
        "../evil",
        "../../tmp",
        "folder/subfolder",
        "/root_app",
        "\\windows\\path",
        "..\\parent",
      ];
      for (const attempt of traversalAttempts) {
        const result = validateProjectName(attempt);
        assert.equal(result.valid, false, `Expected traversal attempt "${attempt}" to be rejected`);
        assert.ok(result.error && result.error.length > 0);
      }
    });
  });

  describe("Stack Option Validation", () => {
    it("should support exactly the 8 officially supported stacks", () => {
      const expectedStacks = [
        "mern",
        "mern+tailwind+auth",
        "mean",
        "mean+tailwind+auth",
        "mevn",
        "mevn+tailwind+auth",
        "t3-stack",
        "hono",
      ];
      assert.deepEqual(SUPPORTED_STACKS.sort(), expectedStacks.sort());
      assert.equal(SUPPORTED_STACKS.length, 8);

      for (const stack of expectedStacks) {
        const result = validateStack(stack);
        assert.equal(result.valid, true, `Expected stack "${stack}" to be valid`);
      }
    });

    it("should reject unsupported or misspelled stack identifiers", () => {
      const unsupported = ["django", "rails", "spring-boot", "nextjs", "invalid-stack", ""];
      for (const s of unsupported) {
        const result = validateStack(s);
        assert.equal(result.valid, false, `Expected stack "${s}" to be rejected`);
      }
    });
  });

  describe("Language Option Validation", () => {
    it("should support javascript and typescript", () => {
      assert.deepEqual(SUPPORTED_LANGUAGES.sort(), ["javascript", "typescript"].sort());
      assert.equal(validateLanguage("javascript").valid, true);
      assert.equal(validateLanguage("typescript").valid, true);
    });

    it("should reject unsupported languages", () => {
      const invalidLangs = ["python", "go", "rust", "csharp", "php", ""];
      for (const l of invalidLangs) {
        const result = validateLanguage(l);
        assert.equal(result.valid, false, `Expected language "${l}" to be rejected`);
      }
    });
  });

  describe("Full Configuration Validation (validateConfig)", () => {
    it("should pass when all configuration fields are valid", () => {
      const validConfig = {
        projectName: "cloud-dashboard",
        stack: "hono",
        language: "typescript",
      };
      const result = validateConfig(validConfig);
      assert.equal(result.valid, true);
      assert.equal(result.error, undefined);
    });

    it("should reject a language without a matching template variant", () => {
      const result = validateStackLanguage("mern", "javascript");
      assert.equal(result.valid, false);
      assert.match(result.error, /not supported/i);
      assert.equal(
        validateConfig({
          projectName: "typed-api",
          stack: "mern",
          language: "javascript",
        }).valid,
        false
      );
    });

    it("should fail early with clear message when any field is invalid", () => {
      const badName = validateConfig({ projectName: "bad name!", stack: "mern", language: "javascript" });
      assert.equal(badName.valid, false);

      const badStack = validateConfig({ projectName: "good-name", stack: "unsupported", language: "javascript" });
      assert.equal(badStack.valid, false);

      const badLang = validateConfig({ projectName: "good-name", stack: "mern", language: "ruby" });
      assert.equal(badLang.valid, false);

      const missingObj = validateConfig(null);
      assert.equal(missingObj.valid, false);
    });
  });
});
