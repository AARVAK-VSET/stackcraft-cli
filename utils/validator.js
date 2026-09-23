/**
 * Pure configuration validator for StackCraft CLI.
 * Validates project metadata and user choices without filesystem side effects.
 */

export const SUPPORTED_STACKS = [
  "mern",
  "mern+tailwind+auth",
  "mean",
  "mean+tailwind+auth",
  "mevn",
  "mevn+tailwind+auth",
  "t3-stack",
  "hono",
];

export const SUPPORTED_LANGUAGES = [
  "javascript",
  "typescript",
];

/**
 * Maps each supported stack to the language(s) its templates actually provide.
 * Single-entry arrays mean the stack ships one fixed-language template only;
 * two-entry arrays mean the stack has separate javascript/ and typescript/
 * template variants (see utils/templateManager.js's resolveTemplatePath).
 */
export const STACK_LANGUAGES = {
  "mern": ["typescript"],
  "mern+tailwind+auth": ["javascript"],
  "mean": ["javascript"],
  "mean+tailwind+auth": ["javascript"],
  "mevn": ["javascript"],
  "mevn+tailwind+auth": ["javascript", "typescript"],
  "t3-stack": ["typescript"],
  "hono": ["javascript", "typescript"],
};

/**
 * Returns the language(s) available for a given stack.
 * Falls back to all supported languages for an unrecognized stack, so
 * callers still get a sensible list instead of undefined behavior.
 * @param {string} stack
 * @returns {string[]}
 */
export function getSupportedLanguages(stack) {
  return STACK_LANGUAGES[stack] || SUPPORTED_LANGUAGES;
}

/**
 * Whether a stack offers more than one language variant and therefore
 * needs an interactive language prompt at all.
 * @param {string} stack
 * @returns {boolean}
 */
export function stackSupportsMultipleLanguages(stack) {
  return getSupportedLanguages(stack).length > 1;
}

/**
 * Validates a project name against naming rules and path traversal operators.
 * @param {string} name
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateProjectName(name) {
  if (!name || typeof name !== "string" || !name.trim()) {
    return { valid: false, error: "Project name is required!" };
  }

  const trimmed = name.trim();

  // Prevent path traversal sequences
  if (
    trimmed.includes("..") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("\\") ||
    trimmed.includes("/") ||
    trimmed.includes("\\")
  ) {
    return {
      valid: false,
      error: "Path traversal operators and directory separators are not allowed in project name.",
    };
  }

  // Enforce alphanumeric, hyphen, and underscore characters
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return {
      valid: false,
      error: "Only letters, numbers, hyphens, and underscores are allowed in project name.",
    };
  }

  return { valid: true };
}

/**
 * Validates that a requested stack is officially supported.
 * @param {string} stack
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateStack(stack) {
  if (!stack || typeof stack !== "string") {
    return { valid: false, error: "Stack choice is required!" };
  }

  if (!SUPPORTED_STACKS.includes(stack)) {
    return {
      valid: false,
      error: `Unsupported stack: "${stack}". Supported stacks: ${SUPPORTED_STACKS.join(", ")}`,
    };
  }

  return { valid: true };
}

/**
 * Validates that a requested language is officially supported.
 * @param {string} language
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateLanguage(language) {
  if (!language || typeof language !== "string") {
    return { valid: false, error: "Language choice is required!" };
  }

  if (!SUPPORTED_LANGUAGES.includes(language)) {
    return {
      valid: false,
      error: `Unsupported language: "${language}". Supported languages: ${SUPPORTED_LANGUAGES.join(", ")}`,
    };
  }

  return { valid: true };
}

/**
 * Validates full configuration object before scaffolding.
 * @param {{ projectName?: string, stack?: string, language?: string }} config
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateConfig(config) {
  if (!config || typeof config !== "object") {
    return { valid: false, error: "Configuration object is required!" };
  }

  const nameResult = validateProjectName(config.projectName);
  if (!nameResult.valid) return nameResult;

  const stackResult = validateStack(config.stack);
  if (!stackResult.valid) return stackResult;

  const langResult = validateLanguage(config.language);
  if (!langResult.valid) return langResult;

  return { valid: true };
}
