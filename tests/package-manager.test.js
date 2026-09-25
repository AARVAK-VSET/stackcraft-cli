import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SUPPORTED_PACKAGE_MANAGERS,
  getExecutable,
  getRunnerCommand,
  buildInstallCommand,
  buildInitCommand,
  buildViteCreateCommand,
  buildHonoCreateCommand,
  buildAngularCreateCommand,
  buildRunScriptCommand,
  isPackageManagerAvailable,
  detectPackageManager,
} from "../utils/packageManager.js";

// ------------------------------------------------------------------ constants
describe("Package Manager Abstraction Suite", () => {
  describe("SUPPORTED_PACKAGE_MANAGERS constant", () => {
    it("should export exactly npm, pnpm, yarn, and bun", () => {
      assert.deepEqual(
        [...SUPPORTED_PACKAGE_MANAGERS].sort(),
        ["bun", "npm", "pnpm", "yarn"]
      );
      assert.equal(SUPPORTED_PACKAGE_MANAGERS.length, 4);
    });
  });

  // --------------------------------------------------------------- executable
  describe("getExecutable", () => {
    const isWin = process.platform === "win32";

    for (const pm of ["npm", "pnpm", "yarn"]) {
      it(`should return ${pm}.cmd on Windows and ${pm} on other platforms`, () => {
        const exe = getExecutable(pm);
        if (isWin) {
          assert.equal(exe, `${pm}.cmd`);
        } else {
          assert.equal(exe, pm);
        }
      });
    }

    it("should always return 'bun' regardless of platform", () => {
      assert.equal(getExecutable("bun"), "bun");
    });

    it("should throw for an unsupported package manager", () => {
      assert.throws(
        () => getExecutable("pip"),
        (err) => {
          assert.match(err.message, /unsupported package manager/i);
          return true;
        }
      );
    });
  });

  // --------------------------------------------------------------- runner
  describe("getRunnerCommand", () => {
    const isWin = process.platform === "win32";

    it("npm runner should use npx with -y prefix", () => {
      const { cmd, leadingArgs } = getRunnerCommand("npm");
      assert.equal(cmd, isWin ? "npx.cmd" : "npx");
      assert.deepEqual(leadingArgs, ["-y"]);
    });

    it("pnpm runner should use pnpm dlx", () => {
      const { cmd, leadingArgs } = getRunnerCommand("pnpm");
      assert.equal(cmd, getExecutable("pnpm"));
      assert.deepEqual(leadingArgs, ["dlx"]);
    });

    it("yarn runner should use yarn dlx", () => {
      const { cmd, leadingArgs } = getRunnerCommand("yarn");
      assert.equal(cmd, getExecutable("yarn"));
      assert.deepEqual(leadingArgs, ["dlx"]);
    });

    it("bun runner should use bun x", () => {
      const { cmd, leadingArgs } = getRunnerCommand("bun");
      assert.equal(cmd, "bun");
      assert.deepEqual(leadingArgs, ["x"]);
    });
  });

  // ------------------------------------------------------- buildInstallCommand
  describe("buildInstallCommand", () => {
    it("npm: no extras → ['install']", () => {
      const { cmd, args } = buildInstallCommand("npm");
      assert.equal(cmd, getExecutable("npm"));
      assert.deepEqual(args, ["install"]);
    });

    it("npm: with extras → ['install', ...pkgs]", () => {
      const { cmd, args } = buildInstallCommand("npm", ["express", "lodash"]);
      assert.equal(cmd, getExecutable("npm"));
      assert.deepEqual(args, ["install", "express", "lodash"]);
    });

    it("pnpm: no extras → ['install']", () => {
      const { args } = buildInstallCommand("pnpm");
      assert.deepEqual(args, ["install"]);
    });

    it("pnpm: with extras → ['add', ...pkgs]", () => {
      const { cmd, args } = buildInstallCommand("pnpm", ["express"]);
      assert.equal(cmd, getExecutable("pnpm"));
      assert.deepEqual(args, ["add", "express"]);
    });

    it("yarn: no extras → ['install']", () => {
      const { args } = buildInstallCommand("yarn");
      assert.deepEqual(args, ["install"]);
    });

    it("yarn: with extras → ['add', ...pkgs]", () => {
      const { args } = buildInstallCommand("yarn", ["react", "react-dom"]);
      assert.deepEqual(args, ["add", "react", "react-dom"]);
    });

    it("bun: no extras → ['install']", () => {
      const { args } = buildInstallCommand("bun");
      assert.deepEqual(args, ["install"]);
    });

    it("bun: with extras → ['add', ...pkgs]", () => {
      const { cmd, args } = buildInstallCommand("bun", ["fastify"]);
      assert.equal(cmd, "bun");
      assert.deepEqual(args, ["add", "fastify"]);
    });
  });

  // --------------------------------------------------------- buildInitCommand
  describe("buildInitCommand", () => {
    it("npm init should include -y flag", () => {
      const { cmd, args } = buildInitCommand("npm");
      assert.equal(cmd, getExecutable("npm"));
      assert.deepEqual(args, ["init", "-y"]);
    });

    it("pnpm init should not require -y flag", () => {
      const { cmd, args } = buildInitCommand("pnpm");
      assert.equal(cmd, getExecutable("pnpm"));
      assert.deepEqual(args, ["init"]);
    });

    it("yarn init should include -y flag", () => {
      const { cmd, args } = buildInitCommand("yarn");
      assert.equal(cmd, getExecutable("yarn"));
      assert.deepEqual(args, ["init", "-y"]);
    });

    it("bun init should include -y flag", () => {
      const { cmd, args } = buildInitCommand("bun");
      assert.equal(cmd, "bun");
      assert.deepEqual(args, ["init", "-y"]);
    });
  });

  // ---------------------------------------------------- buildViteCreateCommand
  describe("buildViteCreateCommand", () => {
    const template = "react-ts";
    const outDir = "client";

    for (const pm of SUPPORTED_PACKAGE_MANAGERS) {
      it(`${pm}: vite create args should include template flag`, () => {
        const { cmd, args } = buildViteCreateCommand(pm, outDir, template);
        assert.ok(typeof cmd === "string" && cmd.length > 0, "cmd must be a non-empty string");
        assert.ok(args.includes("create-vite@latest"), `${pm}: must include 'create-vite@latest'`);
        assert.ok(args.includes(outDir), `${pm}: must include output dir '${outDir}'`);
        assert.ok(args.includes("--template"), `${pm}: must include '--template'`);
        assert.ok(args.includes(template), `${pm}: must include template '${template}'`);
      });
    }

    it("npm vite create should use npx -y runner", () => {
      const { cmd, args } = buildViteCreateCommand("npm", "client", "vue");
      const { cmd: npxCmd, leadingArgs } = getRunnerCommand("npm");
      assert.equal(cmd, npxCmd);
      assert.ok(args[0] === leadingArgs[0], "first arg should be the npx leading arg");
    });

    it("pnpm vite create should use pnpm dlx runner", () => {
      const { cmd, args } = buildViteCreateCommand("pnpm", "client", "vue");
      assert.equal(cmd, getExecutable("pnpm"));
      assert.equal(args[0], "dlx");
    });

    it("yarn vite create should use yarn dlx runner", () => {
      const { cmd, args } = buildViteCreateCommand("yarn", "client", "vue");
      assert.equal(cmd, getExecutable("yarn"));
      assert.equal(args[0], "dlx");
    });

    it("bun vite create should use bun x runner", () => {
      const { cmd, args } = buildViteCreateCommand("bun", "client", "vue");
      assert.equal(cmd, "bun");
      assert.equal(args[0], "x");
    });
  });

  // ---------------------------------------------------- buildHonoCreateCommand
  describe("buildHonoCreateCommand", () => {
    for (const pm of SUPPORTED_PACKAGE_MANAGERS) {
      it(`${pm}: hono create args should pass --pm ${pm}`, () => {
        const { cmd, args } = buildHonoCreateCommand(pm, "server");
        assert.ok(args.includes("--pm"), `${pm}: must include --pm flag`);
        const pmIdx = args.indexOf("--pm");
        assert.equal(args[pmIdx + 1], pm, `${pm}: --pm value must equal the package manager`);
        assert.ok(args.includes("cloudflare-workers"), `${pm}: must include cloudflare-workers template`);
        assert.ok(args.includes("server"), `${pm}: must include output dir 'server'`);
        assert.ok(args.includes("create-hono@latest"), `${pm}: must reference create-hono@latest`);
      });
    }
  });

  // ------------------------------------------------ buildAngularCreateCommand
  describe("buildAngularCreateCommand", () => {
    for (const pm of SUPPORTED_PACKAGE_MANAGERS) {
      it(`${pm}: angular create args should include standard flags`, () => {
        const { cmd, args } = buildAngularCreateCommand(pm, "client");
        assert.ok(args.includes("@angular/cli"), `${pm}: must include @angular/cli`);
        assert.ok(args.includes("new"), `${pm}: must include 'new' subcommand`);
        assert.ok(args.includes("client"), `${pm}: must include output dir 'client'`);
        assert.ok(args.includes("--skip-install"), `${pm}: must include --skip-install`);
        assert.ok(args.includes("--interactive=false"), `${pm}: must include --interactive=false`);
      });
    }

    it("should append extra flags after standard flags", () => {
      const { args } = buildAngularCreateCommand("npm", "client", ["--strict"]);
      assert.ok(args.includes("--strict"), "Extra flags should be appended");
    });
  });

  // ------------------------------------------------- buildRunScriptCommand
  describe("buildRunScriptCommand", () => {
    it("npm: run script uses 'npm run <script>'", () => {
      const { cmd, args } = buildRunScriptCommand("npm", "dev");
      assert.equal(cmd, getExecutable("npm"));
      assert.deepEqual(args, ["run", "dev"]);
    });

    it("pnpm: run script uses 'pnpm run <script>'", () => {
      const { cmd, args } = buildRunScriptCommand("pnpm", "build");
      assert.equal(cmd, getExecutable("pnpm"));
      assert.deepEqual(args, ["run", "build"]);
    });

    it("yarn: run script uses 'yarn <script>' (no 'run' prefix)", () => {
      const { cmd, args } = buildRunScriptCommand("yarn", "start");
      assert.equal(cmd, getExecutable("yarn"));
      assert.deepEqual(args, ["start"]);
    });

    it("bun: run script uses 'bun run <script>'", () => {
      const { cmd, args } = buildRunScriptCommand("bun", "test");
      assert.equal(cmd, "bun");
      assert.deepEqual(args, ["run", "test"]);
    });
  });

  // ----------------------------------------- isPackageManagerAvailable / detect
  describe("isPackageManagerAvailable", () => {
    it("should return a boolean for every supported package manager", () => {
      for (const pm of SUPPORTED_PACKAGE_MANAGERS) {
        const result = isPackageManagerAvailable(pm);
        assert.equal(typeof result, "boolean", `isPackageManagerAvailable('${pm}') must return a boolean`);
      }
    });
  });

  describe("detectPackageManager", () => {
    it("should return one of the supported package managers", () => {
      const detected = detectPackageManager();
      assert.ok(
        SUPPORTED_PACKAGE_MANAGERS.includes(detected),
        `detectPackageManager() returned unsupported value: '${detected}'`
      );
    });

    it("should respect custom preference order", () => {
      // When only 'npm' is offered, it should return 'npm' (even if not installed,
      // the fallback is also 'npm').
      const detected = detectPackageManager(["npm"]);
      assert.equal(detected, "npm");
    });

    it("should fall back to npm when preferred list is empty", () => {
      const detected = detectPackageManager([]);
      assert.equal(detected, "npm");
    });
  });

  // ------------------------------------------------------ error propagation
  describe("Error propagation for unsupported PM", () => {
    const unsupportedFns = [
      ["buildInstallCommand", () => buildInstallCommand("poetry")],
      ["buildInitCommand", () => buildInitCommand("pip")],
      ["buildRunScriptCommand", () => buildRunScriptCommand("cargo", "build")],
    ];

    for (const [name, fn] of unsupportedFns) {
      it(`${name} should throw for unsupported package managers`, () => {
        assert.throws(fn, (err) => {
          assert.match(err.message, /unsupported package manager/i);
          return true;
        });
      });
    }
  });
});
