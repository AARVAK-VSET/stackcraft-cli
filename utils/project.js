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
 * @param {{ skipInstall?: boolean, targetDir?: string, silent?: boolean }} [options={}]
 */
export async function setupProject(projectName, config, options = {}) {
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

  fs.mkdirSync(projectPath, { recursive: true });

  // 3. Optional pretty banner (skipped in silent / non-interactive test mode)
  if (!options.silent) {
    const configText = `
    ${chalk.bold("🌐 Stack:")}  ${chalk.green(config.stack)}
    ${chalk.bold("📦 Project Name:")}  ${chalk.blue(projectName)}
    ${chalk.bold("📖 Language:")}  ${chalk.red(config.language)}
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
    copyTemplates(projectPath, config);
    return { projectPath, success: true };
  }

  // 5. Standard scaffolding & dependency installation
  if (config.stack !== "mean" && config.stack !== "mean+tailwind+auth" && config.stack !== "hono") {
    copyTemplates(projectPath, config);
    installDependencies(projectPath, config, projectName);
  }

  if (config.stack === "mern+tailwind+auth") {
    mernSetup(projectPath, config, projectName);
    copyTemplates(projectPath, config);
    mernTailwindSetup(projectPath, config, projectName);
    installDependencies(projectPath, config, projectName);
    serverAuthSetup(projectPath, config, projectName);
  }

  if (config.stack === "mevn") {
    mevnSetup(projectPath, config, projectName);
    copyTemplates(projectPath, config);
    installDependencies(projectPath, config, projectName);
    serverSetup(projectPath, config, projectName);
  }

  if (config.stack === "mean") {
    angularSetup(projectPath, config);
    installDependencies(projectPath, config, projectName);
    copyTemplates(projectPath, config);
    serverSetup(projectPath, config, projectName);
  }

  if (config.stack === "mean+tailwind+auth") {
    angularTailwindSetup(projectPath, config, projectName);
    installDependencies(projectPath, config, projectName);
    copyTemplates(projectPath, config);
  }

  if (config.stack === "hono") {
    try {
      HonoReactSetup(projectPath, config, projectName);
      installDependencies(projectPath, config, projectName, false);
    } catch {
      copyTemplates(projectPath, config);
    }
  }

  if (config.stack === "mern") {
    mernSetup(projectPath, config, projectName);
    copyTemplates(projectPath, config);
    installDependencies(projectPath, config, projectName, false, []);
  }

  // --- Success + Next Steps ---
  if (!options.silent) {
    console.log(chalk.gray("-------------------------------------------"));
    console.log(`${chalk.greenBright(`✅ Project ${chalk.bold.yellow(`${projectName}`)} created successfully! 🎉`)}`);
    console.log(chalk.gray("-------------------------------------------"));
    console.log(chalk.cyan("👉 Next Steps:\n"));

    if (config.stack === "mean" || config.stack === "mean+tailwind+auth") {
      console.log(`   ${chalk.yellow("cd")} ${projectName}/client && ${chalk.green("npm start")}`);
      console.log(`   ${chalk.yellow("cd")} ${projectName}/server && ${chalk.green("npm start")}`);
    } else if (config.stack === "t3-stack") {
      console.log(`   ${chalk.yellow("cd")} ${projectName}/t3-app && ${chalk.green("npm run dev")}`);
    } else if (config.stack === "hono") {
      console.log(`   ${chalk.yellow("cd")} ${projectName}/client && ${chalk.green("npm run dev")}`);
      console.log(`   ${chalk.yellow("cd")} ${projectName}/server && ${chalk.green("npm run dev")}`);
    } else {
      console.log(`   ${chalk.yellow("cd")} ${projectName}/client && ${chalk.green("npm run dev")}`);
      console.log(`   ${chalk.yellow("cd")} ${projectName}/server && ${chalk.green("npm start")}`);
    }

    console.log(chalk.gray("-------------------------------------------"));
    console.log(chalk.cyan("\n✨ Crafted with ❤️  by StackCraft | AARVAK-VSET ✨\n"));
  }

  return { projectPath, success: true };
}
