import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SUPPORTED_STACKS,
  STACK_LANGUAGES,
  getSupportedLanguages,
  stackSupportsMultipleLanguages,
} from "../utils/validator.js";

describe("Stack Language Capability (Issue #17)", () => {
  it("has a STACK_LANGUAGES entry for every officially supported stack", () => {
    for (const stack of SUPPORTED_STACKS) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(STACK_LANGUAGES, stack),
        `Expected STACK_LANGUAGES to define supported languages for "${stack}"`
      );
    }
  });

  describe("Single-language stacks", () => {
    const singleLanguageStacks = {
      "mern": "typescript",
      "mern+tailwind+auth": "javascript",
      "mean": "javascript",
      "mean+tailwind+auth": "javascript",
      "mevn": "javascript",
      "t3-stack": "typescript",
    };

    for (const [stack, expectedLanguage] of Object.entries(singleLanguageStacks)) {
      it(`"${stack}" only supports ${expectedLanguage} and should skip the prompt`, () => {
        assert.deepEqual(getSupportedLanguages(stack), [expectedLanguage]);
        assert.equal(stackSupportsMultipleLanguages(stack), false);
      });
    }
  });

  describe("Multi-language stacks", () => {
    const multiLanguageStacks = ["hono", "mevn+tailwind+auth"];

    for (const stack of multiLanguageStacks) {
      it(`"${stack}" supports both javascript and typescript and should keep the prompt`, () => {
        const languages = getSupportedLanguages(stack);
        assert.equal(languages.length, 2);
        assert.ok(languages.includes("javascript"));
        assert.ok(languages.includes("typescript"));
        assert.equal(stackSupportsMultipleLanguages(stack), true);
      });
    }
  });

  it("falls back to both languages for an unrecognized stack", () => {
    assert.deepEqual(getSupportedLanguages("not-a-real-stack"), ["javascript", "typescript"]);
    assert.equal(stackSupportsMultipleLanguages("not-a-real-stack"), true);
  });
});
