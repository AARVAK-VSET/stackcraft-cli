import path from "path";
import fs from "fs-extra";
import chalk from "chalk";
import boxen from "boxen";
import { logger } from "./logger.js";
import { copyTemplates } from "./templateManager.js";
import { validateConfig } from "./validator.js";
import {
  HonoReactSetup,
  mernTailwindSetup,
  installDependencies,
  mernSetup,
  serverAuthSetup,
  serverSetup,
  mevnSetup,
  angularSetup,
  angularTailwindSetup,
} from "./installer.js";
import { buildRunScriptCommand } from "./packageManager.js";

/**
 * Asserts that the target project destination directory is available.
 * Keeps filesystem state validation separate from configuration validation.
 *
 * @param {string} projectPath
 * @param {string} projectName
 */
export function assertDestinationAvailable(projectPath, projectName) {
  if (fs.existsSync(projectPath)) {
    const err = new Error(`Directory "${projectName}" already exists`);
    err.code = "EEXIST";
    throw err;
  }
}

/**
 * Sets up a new project given project name and configuration options.
 *
 * @param {string} projectName
 * @param {{ stack: string, language: string }} config
 * @param {{ skipInstall?: boolean, targetDir?: string, silent?: boolean, throwOnError?: boolean }} [options={}]
 */
export async function setupProject(projectName, config, options = {}) {
  const operations = options.operations || {};
  const copy = operations.copyTemplates || copyTemplates;
  const install = operations.installDependencies || installDependencies;
  const runtime = {
    spawnAsync: operations.spawnAsync,
    installDependencies: install,
  };

  // 1. Pure configuration validation
  const validation = validateConfig({ ...config, projectName });
  if (!validation.valid) {
    logger.error(`❌ Configuration Error: ${validation.error}`);
    throw new Error(validation.error);
  }

  // 2. Target directory collision check
  const baseDir = options.targetDir || process.cwd();
  const projectPath = path.join(baseDir, projectName);

  try {
    assertDestinationAvailable(projectPath, projectName);
  } catch (err) {
    logger.error(`❌ ${err.message}`);
    if (options.throwOnError || options.silent || process.env.NODE_ENV === "test") {
      throw err;
    }
    process.exit(1);
  }

  let directoryCreated = false;
  try {
    fs.mkdirSync(projectPath);
    directoryCreated = true;

    // --- Pretty Project Config (Boxed) ---
    if (!options.silent && process.env.NODE_ENV !== "test") {
      const pm = config.packageManager || "npm";
      const configText = `
      ${chalk.bold("🌐 Stack:")}  ${chalk.green(config.stack)}
      ${chalk.bold("📦 Project Name:")}  ${chalk.blue(projectName)}
      ${chalk.bold("📖 Language:")}  ${chalk.red(config.language)}
      ${chalk.bold("📦 Package Manager:")}  ${chalk.magenta(pm)}
      `;

      console.log(
        boxen(configText, {
          padding: 1,
          margin: 1,
          borderColor: "cyan",
          borderStyle: "round",
          title: chalk.cyanBright("📋 Project Configuration"),
          titleAlignment: "center",
        })
      );
    }

    // 4. Offline / skipInstall mode (bypasses heavy external package manager calls)
    if (options.skipInstall) {
      copy(projectPath, config);
      return { projectPath, success: true };
    }

    // 5. Standard scaffolding & dependency installation
    if (config.stack === "mern+tailwind+auth") {
      await mernSetup(projectPath, config, projectName, false, runtime);
      copy(projectPath, config);
      await mernTailwindSetup(projectPath, config, projectName, runtime);
      await serverAuthSetup(projectPath, config, projectName, false, runtime);
      await install(
        projectPath,
        config,
        projectName,
        true,
        [
          "bcrypt",
          "jsonwebtoken",
          "cookie-parser",
          "dotenv",
          "express",
          "helmet",
          "mongoose",
          "cors",
          "nodemon",
          "morgan",
        ],
        ["tailwindcss", "@tailwindcss/vite"],
        runtime
      );
    } else if (config.stack === "mevn") {
      await mevnSetup(projectPath, config, projectName, runtime);
      copy(projectPath, config);
      await install(projectPath, config, projectName, true, [], [], runtime);
      await serverSetup(projectPath, config, projectName, false, runtime);
    } else if (config.stack === "mean") {
      await angularSetup(projectPath, config, projectName, runtime);
      copy(projectPath, config);
      await serverSetup(projectPath, config, projectName, false, runtime);
      await install(projectPath, config, projectName, true, [], [], runtime);
    } else if (config.stack === "mean+tailwind+auth") {
      await angularTailwindSetup(projectPath, config, projectName, runtime);
      copy(projectPath, config);
      await serverSetup(projectPath, config, projectName, false, runtime);
      await install(
        projectPath,
        config,
        projectName,
        true,
        [
          "bcrypt",
          "jsonwebtoken",
          "cookie-parser",
          "dotenv",
          "express",
          "helmet",
          "mongoose",
          "cors",
          "nodemon",
          "morgan",
        ],
        ["tailwindcss", "@tailwindcss/postcss", "postcss"],
        runtime
      );
    } else if (config.stack === "hono") {
      try {
        await HonoReactSetup(projectPath, config, projectName, runtime);
        await install(projectPath, config, projectName, true, [], [], runtime);
      } catch {
        copy(projectPath, config);
      }
    } else if (config.stack === "mern") {
      await mernSetup(projectPath, config, projectName, false, runtime);
      copy(projectPath, config);
      await install(projectPath, config, projectName, true, [], [], runtime);
    } else {
      copy(projectPath, config);
      await install(projectPath, config, projectName, true, [], [], runtime);
    }

    // --- Success + Next Steps ---
    if (!options.silent && process.env.NODE_ENV !== "test") {
      const pm = config.packageManager || "npm";
      const runDev = buildRunScriptCommand(pm, "dev").args.join(" ");
      const runStart = buildRunScriptCommand(pm, "start").args.join(" ");
      const pmExe = pm;

      console.log(chalk.gray("-------------------------------------------"));
      console.log(`${chalk.greenBright(`✅ Project ${chalk.bold.yellow(`${projectName}`)} created successfully! 🎉`)}`);
      console.log(chalk.gray("-------------------------------------------"));
      console.log(chalk.cyan("👉 Next Steps:\n"));

      if (config.stack === "mean" || config.stack === "mean+tailwind+auth") {
        console.log(`   ${chalk.yellow("cd")} ${projectName}/client && ${chalk.green(`${pmExe} ${runStart}`)}`);
        console.log(`   ${chalk.yellow("cd")} ${projectName}/server && ${chalk.green(`${pmExe} ${runStart}`)}`);
      } else if (config.stack === "t3-stack") {
        console.log(`   ${chalk.yellow("cd")} ${projectName}/t3-app && ${chalk.green(`${pmExe} ${runDev}`)}`);
      } else if (config.stack === "hono") {
        console.log(`   ${chalk.yellow("cd")} ${projectName}/client && ${chalk.green(`${pmExe} ${runDev}`)}`);
        console.log(`   ${chalk.yellow("cd")} ${projectName}/server && ${chalk.green(`${pmExe} ${runDev}`)}`);
      } else {
        console.log(`   ${chalk.yellow("cd")} ${projectName}/client && ${chalk.green(`${pmExe} ${runDev}`)}`);
        console.log(`   ${chalk.yellow("cd")} ${projectName}/server && ${chalk.green(`${pmExe} ${runStart}`)}`);
      }

      console.log(chalk.gray("-------------------------------------------"));
      console.log(chalk.cyan("\n✨ Crafted with ❤️  by StackCraft | AARVAK-VSET ✨\n"));
    }

    return { projectPath, success: true };
  } catch (error) {
    if (directoryCreated) {
      logger.error(`\n❌ Error during setup. Rolling back and removing directory ${chalk.red(projectName)}...`);
      fs.removeSync(projectPath);
    }
    throw error;
  }
}
