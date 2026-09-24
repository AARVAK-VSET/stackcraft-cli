import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs-extra";
import os from "os";
import path from "path";
import { SUPPORTED_STACKS, STACK_LANGUAGES } from "../utils/validator.js";
import { setupProject } from "../utils/project.js";
import { copyTemplates } from "../utils/templateManager.js";

describe("Project Dispatcher Single-Pass Suite", () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sc-dispatcher-"));
  });

  afterEach(() => {
    fs.removeSync(tempDir);
  });

  const expectedInstallTargets = {
    mern: ["client", "server"],
    "mern+tailwind+auth": ["client", "server"],
    mean: ["client", "server"],
    "mean+tailwind+auth": ["client", "server"],
    mevn: ["client", "server"],
    "mevn+tailwind+auth": ["client", "server"],
    "t3-stack": [],
    hono: ["client", "server"],
  };
  const expectedCopyCalls = Object.fromEntries(
    SUPPORTED_STACKS.map((stack) => [stack, stack === "hono" ? 0 : 1])
  );

  function fakeSpawn(command, args, options = {}) {
    const target = args[args.indexOf("client")];
    if (target === "client" && args.includes("create")) {
      const clientPath = path.join(options.cwd, "client");
      fs.ensureDirSync(path.join(clientPath, "src"));
      fs.writeFileSync(path.join(clientPath, "src", "styles.css"), "");
      fs.writeFileSync(path.join(clientPath, "package.json"), "{}");
    } else if (args.includes("new") && args.includes("client")) {
      const clientPath = path.join(options.cwd, "client");
      fs.ensureDirSync(path.join(clientPath, "src"));
      fs.writeFileSync(path.join(clientPath, "src", "styles.css"), "");
      fs.writeFileSync(path.join(clientPath, "package.json"), "{}");
    } else if (args.includes("create") && args.includes("server")) {
      fs.ensureDirSync(path.join(options.cwd, "server"));
      fs.writeFileSync(path.join(options.cwd, "server", "package.json"), "{}");
    } else if (args.includes("init") && args.includes("-y")) {
      fs.ensureDirSync(options.cwd);
      fs.writeFileSync(path.join(options.cwd, "package.json"), "{}");
    }

    return Promise.resolve({ code: 0, stdout: "", stderr: "" });
  }

  for (const stack of SUPPORTED_STACKS) {
    const [language] = STACK_LANGUAGES[stack];

    it(`scaffolds ${stack} with single-pass copy and installation`, async () => {
      const projectName = `${stack.replaceAll("+", "-")}-project`;
      const copyCalls = [];
      const installTargets = [];
      const result = await setupProject(
        projectName,
        { stack, language },
        {
          targetDir: tempDir,
          silent: true,
          throwOnError: true,
          operations: {
            copyTemplates: (projectPath, config) => {
              copyCalls.push({ projectPath, config });
              copyTemplates(projectPath, config);
            },
            installDependencies: async (projectPath) => {
              for (const target of ["client", "server"]) {
                if (fs.existsSync(path.join(projectPath, target))) {
                  installTargets.push(target);
                }
              }
            },
            spawnAsync: fakeSpawn,
          },
        }
      );

      assert.equal(result.success, true);
      assert.equal(fs.existsSync(result.projectPath), true);
      assert.ok(fs.readdirSync(result.projectPath).length > 0);
      assert.equal(copyCalls.length, expectedCopyCalls[stack]);
      assert.deepEqual(installTargets, expectedInstallTargets[stack]);
    });
  }
});
