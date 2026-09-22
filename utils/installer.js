import { spawn } from "child_process";
import ora from "ora";
import path from "path";
import fs from "fs";
import { logger } from "./logger.js";

// Active child process tracker for SIGINT / SIGTERM signal handling
export const activeProcesses = new Set();
let signalHandlersRegistered = false;

export function registerSignalHandlers() {
  if (signalHandlersRegistered) return;
  signalHandlersRegistered = true;

  const handleSignal = (signal) => {
    logger.error(`\nReceived ${signal}. Gracefully cleaning up active worker processes...`);
    cleanupActiveProcesses();
    process.exit(130);
  };

  process.on("SIGINT", () => handleSignal("SIGINT"));
  process.on("SIGTERM", () => handleSignal("SIGTERM"));
}

export function cleanupActiveProcesses() {
  for (const child of activeProcesses) {
    try {
      if (!child.killed) {
        child.kill("SIGTERM");
        child.kill("SIGKILL");
      }
    } catch {
      // ignore cleanup errors on dead processes
    }
  }
  activeProcesses.clear();
}

/**
 * Asynchronously spawns a command with interactive progress feedback (ora spinner)
 * and graceful process cancellation tracking.
 */
export function spawnAsync(command, args = [], options = {}) {
  registerSignalHandlers();
  const { spinnerText, cwd, env, shell = false } = options;

  let spinner = null;
  const isTest = process.env.NODE_ENV === "test";

  if (spinnerText && !isTest) {
    spinner = ora(spinnerText).start();
  }

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      shell,
      stdio: isTest ? "pipe" : ["ignore", "pipe", "pipe"],
    });

    activeProcesses.add(child);

    let stderrData = "";
    if (child.stderr) {
      child.stderr.on("data", (chunk) => {
        stderrData += chunk.toString();
      });
    }

    child.on("error", (err) => {
      activeProcesses.delete(child);
      if (spinner) spinner.fail(`Failed: ${spinnerText || command}`);
      reject(err);
    });

    child.on("close", (code) => {
      activeProcesses.delete(child);
      if (code === 0) {
        if (spinner) spinner.succeed();
        resolve({ code, stdout: "", stderr: stderrData });
      } else {
        if (spinner) spinner.fail(`Failed with exit code ${code}: ${spinnerText || command}`);
        const err = new Error(`Command failed with exit code ${code}: ${command} ${args.join(" ")}\n${stderrData}`);
        err.code = code;
        reject(err);
      }
    });
  });
}

export async function installDependencies(projectPath, config = {}, projectName = "", server = true, dependencies = []) {
  logger.info("📦 Installing dependencies...");

  try {
    // Validate package names against shell metacharacters
    const isValidPackage = (pkg) => /^[a-zA-Z0-9\-_\.@^~:]+$/.test(pkg);
    for (const dep of dependencies) {
      if (!isValidPackage(dep)) {
        throw new Error(`Invalid package name rejected: ${dep}`);
      }
    }

    const clientDir = path.join(projectPath, "client");
    const serverDir = path.join(projectPath, "server");
    const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

    if (fs.existsSync(clientDir)) {
      await spawnAsync(npmCmd, ["install"], {
        cwd: clientDir,
        spinnerText: `Installing client dependencies for ${projectName || "project"}...`,
      });
    }
    if (server && fs.existsSync(serverDir)) {
      await spawnAsync(npmCmd, ["install", ...dependencies], {
        cwd: serverDir,
        spinnerText: `Installing server dependencies for ${projectName || "project"}...`,
      });
    }

    logger.info("✅ Dependencies installed successfully");
  } catch (err) {
    logger.error("❌ Failed to install dependencies");
    throw err;
  }
}

export async function angularSetup(projectPath, config, projectName) {
  logger.info("⚡ Setting up Angular...");

  try {
    const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
    await spawnAsync(
      npxCmd,
      [
        "-y",
        "@angular/cli",
        "new",
        "client",
        "--style=css",
        "--routing=false",
        "--ssr=false",
        "--skip-git",
        "--skip-install",
        "--interactive=false",
      ],
      {
        cwd: projectPath,
        spinnerText: "Setting up Angular client...",
        env: { NG_CLI_ANALYTICS: "false" },
      }
    );

    logger.info("✅ Angular project created successfully!");
  } catch (error) {
    logger.error("❌ Failed to set up Angular");
    throw error;
  }
}

export async function angularTailwindSetup(projectPath, config, projectName) {
  logger.info("⚡ Setting up Angular + Tailwind...");

  try {
    const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
    const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

    await spawnAsync(
      npxCmd,
      ["-y", "@angular/cli", "new", "client", "--style=css", "--routing=false", "--ssr=false", "--interactive=false"],
      {
        cwd: projectPath,
        spinnerText: "Scaffolding Angular application...",
        env: { NG_CLI_ANALYTICS: "false" },
      }
    );

    const clientPath = path.join(projectPath, "client");

    await spawnAsync(npmCmd, ["install", "tailwindcss", "@tailwindcss/postcss", "postcss", "--force"], {
      cwd: clientPath,
      spinnerText: "Installing Tailwind CSS and PostCSS...",
    });

    const tailwindConfigPath = path.join(clientPath, ".postcssrc.json");
    fs.writeFileSync(
      tailwindConfigPath,
      `{\n  "plugins": {\n    "@tailwindcss/postcss": {}\n  }\n}`
    );

    const stylesPath = path.join(clientPath, "src/styles.css");
    fs.writeFileSync(stylesPath, `@import "tailwindcss";\n`);

    logger.info("✅ Angular + Tailwind setup completed!");
  } catch (error) {
    logger.error("❌ Failed to set up Angular Tailwind");
    throw error;
  }
}

export async function HonoReactSetup(projectPath, config, projectName) {
  logger.info("⚡ Setting up Hono + React...");

  try {
    const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

    const clientTemplate = config?.language === "typescript" ? "react-ts" : "react";
    await spawnAsync(
      npmCmd,
      ["create", "vite@latest", "client", "--", "--template", clientTemplate, "--no-interactive"],
      {
        cwd: projectPath,
        spinnerText: `Creating React client (${clientTemplate})...`,
      }
    );

    await spawnAsync(
      npmCmd,
      ["create", "hono@latest", "server", "--", "--template", "cloudflare-workers", "--pm", "npm"],
      {
        cwd: projectPath,
        spinnerText: "Creating Hono server...",
      }
    );

    logger.info("Created Hono + React Project !");
  } catch (error) {
    logger.error("❌ Failed to set up Hono + React project using CLI");
    throw error;
  }
}

export async function mernSetup(projectPath, config, projectName) {
  logger.info("⚡ Setting up MERN...");

  try {
    const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

    const clientTemplate = config?.language === "typescript" ? "react-ts" : "react";
    await spawnAsync(
      npmCmd,
      ["create", "vite@latest", "client", "--", "--template", clientTemplate, "--no-interactive"],
      {
        cwd: projectPath,
        spinnerText: `Creating React client with Vite (${clientTemplate})...`,
      }
    );

    if (config?.language === "javascript") {
      const appJsxPath = path.join(projectPath, "client", "src", "App.jsx");
      const appCssPath = path.join(projectPath, "client", "src", "index.css");

      if (fs.existsSync(appJsxPath)) {
        let appJsx = fs.readFileSync(appJsxPath, "utf-8");
        const lines = appJsx.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes("</>")) {
            lines.splice(i, 0, `  <div className="powered-badge">Powered by <span className="stackcraft">StackCraft</span></div>`);
            break;
          }
        }
        fs.writeFileSync(appJsxPath, lines.join("\n"), "utf-8");
      }

      const badgeCSS = `\n.powered-badge {\n  position: fixed;\n  bottom: 1.5rem;\n  left: 1.5rem;\n  font-size: 0.875rem;\n  background-color: black;\n  color: white;\n  padding: 0.5rem 1rem;\n  border-radius: 0.75rem;\n  box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1),\n  0 4px 6px -2px rgba(0,0,0,0.05);\n  opacity: 0.8;\n  transition: opacity 0.2s ease-in-out;\n}\n.powered-badge:hover {\n  opacity: 1;\n}\n.powered-badge .stackcraft {\n  font-weight: 600;\n  color: #4ade80;\n}\n`;
      if (fs.existsSync(appCssPath)) {
        fs.appendFileSync(appCssPath, badgeCSS, "utf-8");
      }
    }

    if (config?.language === "typescript") {
      const appTsxPath = path.join(projectPath, "client", "src", "App.tsx");
      const appCssPath = path.join(projectPath, "client", "src", "index.css");

      if (fs.existsSync(appTsxPath)) {
        let appTsx = fs.readFileSync(appTsxPath, "utf-8");
        const lines = appTsx.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes("</>")) {
            lines.splice(i, 0, `  <div className="powered-badge">Powered by <span className="stackcraft">StackCraft</span></div>`);
            break;
          }
        }
        fs.writeFileSync(appTsxPath, lines.join("\n"), "utf-8");
      }

      const badgeCSS = `\n.powered-badge {\n  position: fixed;\n  bottom: 1.5rem;\n  left: 1.5rem;\n  font-size: 0.875rem;\n  background-color: black;\n  color: white;\n  padding: 0.5rem 1rem;\n  border-radius: 0.75rem;\n  box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1),\n  0 4px 6px -2px rgba(0,0,0,0.05);\n  opacity: 0.8;\n  transition: opacity 0.2s ease-in-out;\n}\n.powered-badge:hover {\n  opacity: 1;\n}\n.powered-badge .stackcraft {\n  font-weight: 600;\n  color: #4ade80;\n}\n`;
      if (fs.existsSync(appCssPath)) {
        fs.appendFileSync(appCssPath, badgeCSS, "utf-8");
      }
    }

    await serverSetup(projectPath, config, projectName);
    logger.info("✅ MERN project created successfully!");
  } catch (error) {
    logger.error("❌ Failed to set up MERN");
    throw error;
  }
}

export async function serverSetup(projectPath, config, projectName) {
  try {
    const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
    const serverDir = path.join(projectPath, "server");

    if (!fs.existsSync(serverDir)) {
      fs.mkdirSync(serverDir, { recursive: true });
    }

    await spawnAsync(npmCmd, ["init", "-y"], {
      cwd: serverDir,
      spinnerText: "Initializing Express server...",
    });

    await installDependencies(projectPath, config, projectName, true, [
      "dotenv",
      "express",
      "helmet",
      "mongoose",
      "cors",
      "nodemon",
      "morgan",
    ]);
    logger.info("✅ Server project created successfully!");
  } catch (error) {
    logger.error("❌ Failed to set up server");
    throw error;
  }
}

export async function serverAuthSetup(projectPath, config, projectName) {
  try {
    const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
    const serverDir = path.join(projectPath, "server");

    if (!fs.existsSync(serverDir)) {
      fs.mkdirSync(serverDir, { recursive: true });
    }

    await spawnAsync(npmCmd, ["init", "-y"], {
      cwd: serverDir,
      spinnerText: "Initializing Express auth server...",
    });

    await installDependencies(projectPath, config, projectName, true, [
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
    ]);
    logger.info("✅ Server Auth project created successfully!");
  } catch (error) {
    logger.error("❌ Failed to set up server auth");
    throw error;
  }
}

export async function mernTailwindSetup(projectPath, config, projectName) {
  try {
    const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
    const clientPath = path.join(projectPath, "client");

    await spawnAsync(npmCmd, ["install", "tailwindcss", "@tailwindcss/vite"], {
      cwd: clientPath,
      spinnerText: "Installing TailwindCSS for Vite...",
    });

    const isJs = config?.language === "javascript";
    const viteConfigPath = isJs
      ? path.join(clientPath, "vite.config.js")
      : path.join(clientPath, "vite.config.ts");

    if (fs.existsSync(viteConfigPath)) {
      let viteConfigContent = fs.readFileSync(viteConfigPath, "utf-8");
      viteConfigContent = viteConfigContent.replace(
        /import \{ defineConfig \} from 'vite'/,
        "import { defineConfig } from 'vite'\nimport tailwindcss from '@tailwindcss/vite'"
      );

      viteConfigContent = viteConfigContent.replace(
        /plugins:\s*\[([^\]]*)\]/,
        (match, pluginsInside) => {
          if (!pluginsInside.includes("tailwindcss()")) {
            return `plugins: [${pluginsInside.trim()} , tailwindcss()]`;
          }
          return match;
        }
      );

      fs.writeFileSync(viteConfigPath, viteConfigContent);
    }

    const indexCssPath = path.join(clientPath, "src", "index.css");
    if (fs.existsSync(indexCssPath)) {
      let indexCssPathContent = fs.readFileSync(indexCssPath, "utf-8");
      indexCssPathContent = indexCssPathContent.replace(
        /:root/g,
        "@import 'tailwindcss';\n\n:root"
      );
      fs.writeFileSync(indexCssPath, indexCssPathContent);
    }

    logger.info("✅ TailwindCSS added to Vite config");
  } catch (err) {
    logger.error(`❌ Failed to setup Tailwind: ${err.message}`);
  }
}

export async function mevnSetup(projectPath, config, projectName) {
  try {
    logger.info("⚡ Setting up MEVN...");
    const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

    const clientTemplate = config?.language === "javascript" ? "vue" : "vue-ts";
    await spawnAsync(
      npmCmd,
      ["create", "vite@latest", "client", "--", "--template", clientTemplate, "--no-interactive"],
      {
        cwd: projectPath,
        spinnerText: `Creating Vue client with Vite (${clientTemplate})...`,
      }
    );

    const vueJsPath = path.join(projectPath, "client", "src", "components", "HelloWorld.vue");
    if (fs.existsSync(vueJsPath)) {
      let vueJsPathContent = fs.readFileSync(vueJsPath, "utf-8");

      vueJsPathContent = vueJsPathContent.replace(
        /<p class="read-the-docs">Click on the Vite and Vue logos to learn more<\/p>/,
        `<p class="read-the-docs">Click on the Vite and Vue logos to learn more</p>\n    <div class="powered-box">\n      Powered by <span class="powered-highlight">StackCraft</span>\n    </div>`
      );

      const newStyles = `<style scoped>\n    .powered-box {\n      position: fixed;\n      bottom: 24px;\n      left: 24px;\n      background-color: black;\n      color: white;\n      padding: 8px 16px;\n      font-size: 0.875rem;\n      border-radius: 16px;\n      box-shadow: 0 4px 6px rgba(0,0,0,0.3);\n      opacity: 0.85;\n      transition: opacity 0.2s ease;\n      cursor: default;\n    }\n\n    .powered-box:hover {\n      opacity: 1;\n    }\n\n    .powered-highlight {\n      font-weight: 600;\n      color: #22c55e;\n    }\n\n    .read-the-docs {\n      color: #888;\n    }\n    </style>`;

      if (/<style scoped>[\s\S]*?<\/style>/.test(vueJsPathContent)) {
        vueJsPathContent = vueJsPathContent.replace(
          /<style scoped>[\s\S]*?<\/style>/,
          newStyles
        );
      } else {
        vueJsPathContent += `\n\n${newStyles}`;
      }

      fs.writeFileSync(vueJsPath, vueJsPathContent, "utf-8");
    }

    logger.info("✅ MEVN project created successfully!");
  } catch (error) {
    logger.error("❌ Failed to set up MEVN");
    throw error;
  }
}