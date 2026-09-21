import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templatesRoot = path.join(__dirname, "..", "templates");

/**
 * Resolves the absolute path to a template directory for a given stack and component.
 * Central source of truth for template discovery.
 *
 * @param {{ stack: string, component?: string, language?: string }} options
 * @returns {string} Absolute path to the resolved template directory
 */
export function resolveTemplatePath(options) {
  // Support both object and positional call signatures
  const stack = typeof options === "string" ? options : options?.stack;
  const component = typeof options === "string" ? arguments[1] : options?.component;
  const language = typeof options === "string" ? arguments[2] : options?.language;

  if (stack === "mern") {
    // Exact repository path for MERN backend template
    return path.join(templatesRoot, "mern", "Ts-Backend");
  }

  if (stack === "mern+tailwind+auth") {
    return path.join(templatesRoot, "mern+tailwind+auth", "server");
  }

  if (stack === "mevn") {
    return path.join(templatesRoot, "mevn", "server");
  }

  if (stack === "mean" || stack === "mean+tailwind+auth") {
    return path.join(templatesRoot, stack, "server");
  }

  if (stack === "t3-stack") {
    return path.join(templatesRoot, "t3-stack", "t3-app");
  }

  // Multi-component stacks with language variations (hono, mevn+tailwind+auth)
  const lang = language === "typescript" ? "typescript" : "javascript";
  const comp = component === "client" ? "client" : "server";
  return path.join(templatesRoot, stack, lang, comp);
}

/**
 * Copies template files for the selected stack into the destination project directory.
 * @param {string} projectPath Destination project root directory
 * @param {{ stack: string, language?: string }} config Project configuration
 */
export function copyTemplates(projectPath, config) {
  const { stack, language } = config;

  if (stack === "mern" || stack === "mern+tailwind+auth" || stack === "mevn" || stack === "mean" || stack === "mean+tailwind+auth") {
    const backendTemplate = resolveTemplatePath({ stack, component: "server", language });
    const serverPath = path.join(projectPath, "server");

    logger.info("📂 Copying backend template files...");
    fs.copySync(backendTemplate, serverPath);
  } else if (stack === "t3-stack") {
    const appTemplate = resolveTemplatePath({ stack, component: "t3-app", language });
    const appPath = path.join(projectPath, "t3-app");

    logger.info("📂 Copying template files...");
    fs.copySync(appTemplate, appPath);
  } else {
    // Stacks with both client and server components (e.g. hono, mevn+tailwind+auth)
    const frontendTemplate = resolveTemplatePath({ stack, component: "client", language });
    const backendTemplate = resolveTemplatePath({ stack, component: "server", language });

    const clientPath = path.join(projectPath, "client");
    const serverPath = path.join(projectPath, "server");

    logger.info("📂 Copying template files...");
    fs.copySync(frontendTemplate, clientPath);
    fs.copySync(backendTemplate, serverPath);
  }
}
