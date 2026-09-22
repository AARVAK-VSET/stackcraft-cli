import chalk from "chalk";
let currentMode = "normal";

export const logger = {
  setLevel: (level) => {
    currentMode = level;
  },

  info: (msg) => {
    if (currentMode !== "silent") {
      console.log(chalk.blue(msg));
    }
  },

  success: (msg) => {
    if (currentMode !== "silent") {
      console.log(chalk.green(msg));
    }
  },

  warn: (msg) => {
    if (currentMode !== "silent") {
      console.log(chalk.yellow(msg));
    }
  },

  error: (msg) => {
    if (currentMode !== "silent") {
      console.log(chalk.red(msg));
    }
  },

  debug: (msg) => {
    if (currentMode === "verbose") {
      console.log(chalk.gray(msg));
    }
  }
};