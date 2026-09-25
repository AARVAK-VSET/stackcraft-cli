import { readFileSync } from "node:fs";
import inquirer from "inquirer";
import chalk from "chalk";
import gradient from "gradient-string";
import figlet from "figlet";
import { createProject } from "./commands/scaffold.js";
import { validateProjectName, validateConfig, SUPPORTED_STACKS } from "./utils/validator.js";
import { detectPackageManager, SUPPORTED_PACKAGE_MANAGERS } from "./utils/packageManager.js";

function showBanner() {
  console.log(
    gradient.pastel(
      figlet.textSync("StackCraft", {
        font: "Big",
        horizontalLayout: "default",
        verticalLayout: "default",
      })
    )
  );
  console.log(chalk.cyan("⚡ Setup Full-Stack Web Apps in seconds, not hours ⚡"));
  console.log(chalk.gray("   Open-Source by AARVAK-VSET | Patch Wars 2026\n"));
}

function showHelp() {
  console.log(`
Usage: stackcraft [project-name] [options]

Options:
  -h, --help       Show this help message
  -v, --version    Show the current version

Available stacks:
  ${SUPPORTED_STACKS.join(", ")}

Languages:
  javascript, typescript

Examples:
  stackcraft            Start the interactive wizard
  stackcraft my-app     Use "my-app" as the project name
`);
}

function showVersion() {
  const pkg = JSON.parse(
    readFileSync(new URL("./package.json", import.meta.url), "utf8")
  );
  console.log(pkg.version);
}

function handleFlags(args) {
  if (args.includes("--help") || args.includes("-h")) {
    showHelp();
    process.exit(0);
  }
  if (args.includes("--version") || args.includes("-v")) {
    showVersion();
    process.exit(0);
  }
  const unknown = args.find((arg) => arg.startsWith("-"));
  if (unknown) {
    console.error(chalk.red("❌ Error:"), `Unknown option: ${unknown}`);
    console.error("Run stackcraft --help to see available options.");
    process.exit(1);
  }
}

async function askStackQuestions() {
  return await inquirer.prompt([
    {
      type: "list",
      name: "stack",
      message: "Choose your stack:",
      choices: [
        { name: chalk.bold.blue("MERN") + " → MongoDB + Express + React + Node.js", value: "mern" },
        { name: chalk.bold.green("MERN") + " + Tailwind + Auth", value: "mern+tailwind+auth" },
        { name: chalk.bold.red("MEAN") + " → MongoDB + Express + Angular + Node.js", value: "mean" },
        { name: chalk.bold.magenta("MEAN") + " + Tailwind + Auth", value: "mean+tailwind+auth" },
        { name: chalk.bold.cyan("MEVN") + " → MongoDB + Express + Vue.js + Node.js", value: "mevn" },
        { name: chalk.bold.yellow("MEVN") + " + Tailwind + Auth", value: "mevn+tailwind+auth" },
        { name: chalk.bold.yellow("Next.js") + " + tRPC + Prisma + Tailwind + Auth", value: "t3-stack" },
        { name: chalk.bold.red("Hono") + " → Hono + Prisma + React", value: "hono" },
      ],
      pageSize: 10,
      default: "mern",
    },
    {
      type: "list",
      name: "language",
      message: "Choose your language:",
      choices: [
        { name: chalk.bold.yellow("JavaScript"), value: "javascript" },
        { name: chalk.bold.blue("TypeScript"), value: "typescript" },
      ],
      pageSize: 10,
      default: "typescript",
    },
  ]);
}


async function askPackageManagerQuestion() {
  const detected = detectPackageManager();
  const { packageManager } = await inquirer.prompt([
    {
      type: "list",
      name: "packageManager",
      message: "Choose your package manager:",
      choices: [
        { name: chalk.bold.red("npm") + "  (Node Package Manager)", value: "npm" },
        { name: chalk.bold.yellow("pnpm") + " (Performant npm)", value: "pnpm" },
        { name: chalk.bold.blue("yarn") + " (Yarn Package Manager)", value: "yarn" },
        { name: chalk.bold.magenta("bun") + "  (Bun JavaScript Runtime)", value: "bun" },
      ],
      pageSize: 5,
      default: detected,
    },
  ]);
  return packageManager;
}
async function askProjectName() {
  const { projectName } = await inquirer.prompt([
    {
      type: "input",
      name: "projectName",
      message: chalk.cyan("📦 Enter your project name:"),
      validate: (input) => {
        const result = validateProjectName(input);
        if (!result.valid) return chalk.red(result.error);
        return true;
      },
    },
  ]);
  return projectName;
}

async function main() {
  handleFlags(process.argv.slice(2));

  console.log("\n");
  showBanner();

  let projectName = process.argv[2];
  let config;

  try {
    if (projectName) {
      const nameValidation = validateProjectName(projectName);
      if (!nameValidation.valid) {
        console.log(chalk.red("❌ Error:"), nameValidation.error);
        process.exit(1);
      }
    } else {
      projectName = await askProjectName();
    }

    const stackAnswers = await askStackQuestions();
    const packageManager = await askPackageManagerQuestion();
    config = { ...stackAnswers, projectName, packageManager };

    const configValidation = validateConfig(config);
    if (!configValidation.valid) {
      console.log(chalk.red("❌ Validation Error:"), configValidation.error);
      process.exit(1);
    }

    console.log(chalk.yellow("\n🚀 Creating your project...\n"));
    await createProject(projectName, config);
  } catch (err) {
    console.log(chalk.red("❌ Error:"), err.message);
    process.exit(1);
  }
}

main();
