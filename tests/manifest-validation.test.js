import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { copyTemplates } from "../utils/templateManager.js";

describe("Package Manifest Deep Validation Suite", () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sc-manifest-"));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.removeSync(tempDir);
    }
  });

  const MANIFEST_TARGETS = [
    {
      stack: "mern",
      language: "typescript",
      manifestRelPath: "server/package.json",
      expectedName: "backend",
      expectedDeps: ["express", "mongoose", "cors", "dotenv", "zod"],
      expectedDevDeps: ["typescript"],
      expectedScripts: ["test", "build", "dev"],
    },
    {
      stack: "mean",
      language: "javascript",
      manifestRelPath: "server/package.json",
      expectedName: "server",
      expectedDeps: ["express", "mongoose", "cors", "dotenv", "helmet", "morgan"],
      expectedScripts: ["test"],
    },
    {
      stack: "mean+tailwind+auth",
      language: "javascript",
      manifestRelPath: "server/package.json",
      expectedName: "server",
      expectedDeps: ["express", "mongoose", "jsonwebtoken", "bcrypt", "cors", "dotenv"],
      expectedScripts: ["test"],
    },
    {
      stack: "mevn+tailwind+auth",
      language: "javascript",
      manifestRelPath: "client/package.json",
      expectedName: "client",
      expectedDeps: ["vue", "tailwindcss", "@tailwindcss/vite"],
      expectedScripts: ["dev", "build"],
    },
    {
      stack: "mevn+tailwind+auth",
      language: "typescript",
      manifestRelPath: "server/package.json",
      expectedName: "server",
      expectedDeps: ["express", "mongoose", "jsonwebtoken", "bcrypt"],
      expectedScripts: ["test"],
    },
    {
      stack: "t3-stack",
      language: "typescript",
      manifestRelPath: "t3-app/package.json",
      expectedName: "t3-app",
      expectedDeps: [
        "next",
        "@prisma/client",
        "@trpc/server",
        "@trpc/client",
        "@tanstack/react-query",
        "react",
        "react-dom",
        "zod",
      ],
      expectedScripts: ["dev", "build", "start"],
    },
    {
      stack: "hono",
      language: "typescript",
      manifestRelPath: "server/package.json",
      expectedName: "honotst",
      expectedDeps: ["hono"],
      expectedDevDeps: ["wrangler"],
      expectedScripts: ["dev"],
    },
    {
      stack: "hono",
      language: "typescript",
      manifestRelPath: "client/package.json",
      expectedName: "client",
      expectedDeps: ["react", "react-dom"],
      expectedScripts: ["dev", "build"],
    },
  ];

  for (const item of MANIFEST_TARGETS) {
    it(`should validate package manifest integrity for ${item.stack} (${item.manifestRelPath})`, () => {
      copyTemplates(tempDir, { stack: item.stack, language: item.language });

      const manifestPath = path.join(tempDir, item.manifestRelPath);
      assert.equal(fs.existsSync(manifestPath), true, `Manifest must exist at ${item.manifestRelPath}`);

      // 1. Valid JSON
      let manifest;
      assert.doesNotThrow(() => {
        manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      }, `Manifest ${item.manifestRelPath} must be valid JSON`);

      // 2. Name
      assert.equal(typeof manifest.name, "string");
      assert.ok(manifest.name.length > 0);
      if (item.expectedName) {
        assert.equal(manifest.name, item.expectedName);
      }

      // 3. Dependencies
      const declaredDeps = Object.keys(manifest.dependencies || {});
      for (const dep of item.expectedDeps) {
        assert.ok(
          declaredDeps.includes(dep),
          `Manifest ${item.manifestRelPath} missing required dependency: "${dep}"`
        );
      }

      // 4. DevDependencies (if specified)
      if (item.expectedDevDeps) {
        const declaredDev = Object.keys(manifest.devDependencies || {});
        for (const devDep of item.expectedDevDeps) {
          assert.ok(
            declaredDev.includes(devDep),
            `Manifest ${item.manifestRelPath} missing required devDependency: "${devDep}"`
          );
        }
      }

      // 5. Scripts (if specified)
      if (item.expectedScripts) {
        assert.equal(typeof manifest.scripts, "object");
        for (const s of item.expectedScripts) {
          assert.ok(
            s in manifest.scripts,
            `Manifest ${item.manifestRelPath} missing required script "${s}"`
          );
        }
      }
    });
  }
});
