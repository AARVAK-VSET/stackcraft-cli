import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs-extra";
import path from "path";
import { resolveTemplatePath } from "../utils/templateManager.js";

describe("Template Resolution & Integrity Suite", () => {
  describe("MERN Regression Resolution", () => {
    it("should resolve mern backend to templates/mern/Ts-Backend without ENOENT", () => {
      const resolved = resolveTemplatePath({ stack: "mern", component: "server", language: "typescript" });
      assert.ok(resolved.endsWith(path.join("templates", "mern", "Ts-Backend")));
      assert.equal(fs.existsSync(resolved), true, `Resolved path must exist: ${resolved}`);
      assert.equal(fs.existsSync(path.join(resolved, "server.ts")), true);
      assert.equal(fs.existsSync(path.join(resolved, "package.json")), true);
    });
  });

  describe("Single-Component Stacks Resolution", () => {
    it("should resolve mern+tailwind+auth server template", () => {
      const resolved = resolveTemplatePath({ stack: "mern+tailwind+auth", component: "server" });
      assert.ok(resolved.endsWith(path.join("templates", "mern+tailwind+auth", "server")));
      assert.equal(fs.existsSync(resolved), true);
    });

    it("should resolve mean server template", () => {
      const resolved = resolveTemplatePath({ stack: "mean", component: "server" });
      assert.ok(resolved.endsWith(path.join("templates", "mean", "server")));
      assert.equal(fs.existsSync(resolved), true);
    });

    it("should resolve mean+tailwind+auth server template", () => {
      const resolved = resolveTemplatePath({ stack: "mean+tailwind+auth", component: "server" });
      assert.ok(resolved.endsWith(path.join("templates", "mean+tailwind+auth", "server")));
      assert.equal(fs.existsSync(resolved), true);
    });

    it("should resolve mevn server template", () => {
      const resolved = resolveTemplatePath({ stack: "mevn", component: "server" });
      assert.ok(resolved.endsWith(path.join("templates", "mevn", "server")));
      assert.equal(fs.existsSync(resolved), true);
    });

    it("should resolve t3-stack t3-app template", () => {
      const resolved = resolveTemplatePath({ stack: "t3-stack", component: "t3-app" });
      assert.ok(resolved.endsWith(path.join("templates", "t3-stack", "t3-app")));
      assert.equal(fs.existsSync(resolved), true);
    });
  });

  describe("Multi-Component Stacks (Language Variants)", () => {
    const multiStacks = [
      { stack: "hono", language: "javascript" },
      { stack: "hono", language: "typescript" },
      { stack: "mevn+tailwind+auth", language: "javascript" },
      { stack: "mevn+tailwind+auth", language: "typescript" },
    ];

    for (const { stack, language } of multiStacks) {
      it(`should resolve both client and server for ${stack} (${language})`, () => {
        const clientPath = resolveTemplatePath({ stack, component: "client", language });
        const serverPath = resolveTemplatePath({ stack, component: "server", language });

        assert.ok(clientPath.endsWith(path.join(stack, language, "client")));
        assert.ok(serverPath.endsWith(path.join(stack, language, "server")));

        assert.equal(fs.existsSync(clientPath), true, `Client path must exist: ${clientPath}`);
        assert.equal(fs.existsSync(serverPath), true, `Server path must exist: ${serverPath}`);

        // Check non-empty directory
        assert.ok(fs.readdirSync(clientPath).length > 0);
        assert.ok(fs.readdirSync(serverPath).length > 0);
      });
    }
  });

  describe("Template Integrity Checks", () => {
    it("all 8 supported stacks have non-empty template directories", () => {
      const stacks = [
        "mern",
        "mern+tailwind+auth",
        "mean",
        "mean+tailwind+auth",
        "mevn",
        "mevn+tailwind+auth",
        "t3-stack",
        "hono",
      ];
      for (const stack of stacks) {
        const templateDir = path.join(process.cwd(), "templates", stack);
        assert.equal(fs.existsSync(templateDir), true, `Templates directory for ${stack} must exist`);
        const files = fs.readdirSync(templateDir);
        assert.ok(files.length > 0, `Templates directory for ${stack} must not be empty`);
      }
    });
  });
});
