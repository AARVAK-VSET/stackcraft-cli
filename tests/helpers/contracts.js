import fs from "fs-extra";
import path from "path";

/**
 * Stack contracts defining the minimum guaranteed interface
 * for scaffolded template workflows across all 8 supported stacks.
 * Grounded directly in audited repository template contents.
 */
export const STACK_CONTRACTS = {
  mern: {
    name: "MERN Stack",
    requiredDirs: ["server"],
    requiredFiles: [
      "server/package.json",
      "server/.env.example",
      "server/server.ts",
      "server/tsconfig.json",
    ],
    serverManifest: {
      name: "backend",
      dependencies: ["express", "mongoose", "cors", "dotenv", "zod"],
      devDependencies: ["typescript"],
      scripts: ["test", "build", "dev"],
    },
  },

  "mern+tailwind+auth": {
    name: "MERN + Tailwind + Auth",
    requiredDirs: ["server"],
    requiredFiles: [
      "server/server.js",
      "server/.env.example",
      "server/models",
      "server/controllers",
      "server/routes",
    ],
    serverFiles: ["server/server.js"],
  },

  mean: {
    name: "MEAN Stack",
    requiredDirs: ["server"],
    requiredFiles: [
      "server/package.json",
      "server/server.js",
      "server/.env.example",
      "server/models",
      "server/controllers",
      "server/routes",
    ],
    serverManifest: {
      name: "server",
      dependencies: ["express", "mongoose", "cors", "dotenv", "helmet", "morgan"],
      scripts: ["test"],
    },
  },

  "mean+tailwind+auth": {
    name: "MEAN + Tailwind + Auth",
    requiredDirs: ["server"],
    requiredFiles: [
      "server/package.json",
      "server/server.js",
      "server/.env.example",
      "server/models/User.js",
      "server/controllers/authController.js",
      "server/routes/authRoutes.js",
    ],
    serverManifest: {
      name: "server",
      dependencies: ["express", "mongoose", "jsonwebtoken", "bcrypt", "cors", "dotenv"],
      scripts: ["test"],
    },
  },

  mevn: {
    name: "MEVN Stack",
    requiredDirs: ["server"],
    requiredFiles: [
      "server/server.js",
      "server/.env.example",
      "server/models",
      "server/controllers",
      "server/routes",
    ],
  },

  "mevn+tailwind+auth": {
    name: "MEVN + Tailwind + Auth",
    requiredDirs: ["client", "server"],
    requiredFiles: [
      "client/package.json",
      "client/index.html",
      "client/src/App.vue",
      "server/package.json",
      "server/server.js",
      "server/.env.example",
    ],
    clientManifest: {
      name: "client",
      dependencies: ["vue", "tailwindcss", "@tailwindcss/vite"],
      scripts: ["dev", "build"],
    },
    serverManifest: {
      name: "server",
      dependencies: ["express", "mongoose", "jsonwebtoken", "bcrypt", "cors", "dotenv"],
      scripts: ["test"],
    },
  },

  "t3-stack": {
    name: "T3 Stack (Next.js + tRPC + Prisma + Tailwind + Auth)",
    requiredDirs: ["t3-app"],
    requiredFiles: [
      "t3-app/package.json",
      "t3-app/next.config.js",
      "t3-app/prisma/schema.prisma",
      "t3-app/tsconfig.json",
      "t3-app/.env.example",
    ],
    appManifest: {
      name: "t3-app",
      dependencies: [
        "next",
        "@prisma/client",
        "@trpc/server",
        "@trpc/client",
        "@tanstack/react-query",
        "react",
        "react-dom",
        "zod",
      ],
      scripts: ["dev", "build", "start"],
    },
  },

  hono: {
    name: "Hono (Hono + Prisma + React)",
    requiredDirs: ["client", "server"],
    requiredFiles: [
      "server/package.json",
      "server/wrangler.jsonc",
      "server/prisma/schema.prisma",
      "client/package.json",
      "client/index.html",
    ],
    serverManifest: {
      name: "honotst",
      dependencies: ["hono"],
      devDependencies: ["wrangler"],
      scripts: ["dev"],
    },
    clientManifest: {
      name: "client",
      dependencies: ["react", "react-dom"],
      scripts: ["dev", "build"],
    },
  },
};

/**
 * Validates a generated project against its stack contract.
 * Produces rich, actionable diagnostics upon failure.
 *
 * @param {string} projectPath
 * @param {object} contract
 * @returns {{ pass: boolean, diagnostics: string[] }}
 */
export function validateScaffold(projectPath, contract) {
  const diagnostics = [];

  if (!fs.existsSync(projectPath)) {
    diagnostics.push(`Project destination does not exist: ${projectPath}`);
    return { pass: false, diagnostics };
  }

  // 1. Validate required directories
  if (Array.isArray(contract.requiredDirs)) {
    for (const relDir of contract.requiredDirs) {
      const fullDir = path.join(projectPath, relDir);
      if (!fs.existsSync(fullDir) || !fs.statSync(fullDir).isDirectory()) {
        diagnostics.push(`Missing required directory: "${relDir}"`);
      }
    }
  }

  // 2. Validate required key files
  if (Array.isArray(contract.requiredFiles)) {
    for (const relFile of contract.requiredFiles) {
      const fullFile = path.join(projectPath, relFile);
      if (!fs.existsSync(fullFile)) {
        diagnostics.push(`Missing required file: "${relFile}"`);
      }
    }
  }

  // 3. Helper to validate a manifest section
  const checkManifest = (manifestPath, expected) => {
    if (!expected) return;
    const fullManifestPath = path.join(projectPath, manifestPath);
    if (!fs.existsSync(fullManifestPath)) {
      diagnostics.push(`Missing package manifest: "${manifestPath}"`);
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(fullManifestPath, "utf-8"));
    } catch (err) {
      diagnostics.push(`Invalid JSON in manifest "${manifestPath}": ${err.message}`);
      return;
    }

    if (expected.name && parsed.name !== expected.name) {
      diagnostics.push(
        `Manifest "${manifestPath}" name mismatch: expected "${expected.name}", got "${parsed.name}"`
      );
    }

    if (Array.isArray(expected.dependencies)) {
      const declared = Object.keys(parsed.dependencies || {});
      for (const dep of expected.dependencies) {
        if (!declared.includes(dep)) {
          diagnostics.push(`Manifest "${manifestPath}" missing required dependency: "${dep}"`);
        }
      }
    }

    if (Array.isArray(expected.devDependencies)) {
      const declaredDev = Object.keys(parsed.devDependencies || {});
      for (const devDep of expected.devDependencies) {
        if (!declaredDev.includes(devDep)) {
          diagnostics.push(`Manifest "${manifestPath}" missing required devDependency: "${devDep}"`);
        }
      }
    }

    if (Array.isArray(expected.scripts)) {
      const declaredScripts = Object.keys(parsed.scripts || {});
      for (const s of expected.scripts) {
        if (!declaredScripts.includes(s)) {
          diagnostics.push(`Manifest "${manifestPath}" missing required script: "${s}"`);
        }
      }
    }
  };

  // Check server manifest if specified
  if (contract.serverManifest) {
    checkManifest("server/package.json", contract.serverManifest);
  }

  // Check client manifest if specified
  if (contract.clientManifest) {
    checkManifest("client/package.json", contract.clientManifest);
  }

  // Check app manifest if specified (e.g. t3-app)
  if (contract.appManifest) {
    checkManifest("t3-app/package.json", contract.appManifest);
  }

  return {
    pass: diagnostics.length === 0,
    diagnostics,
  };
}
