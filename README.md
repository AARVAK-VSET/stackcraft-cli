# StackCraft CLI 🛠️

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node: >=18](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)](https://nodejs.org/)
[![Organization](https://img.shields.io/badge/Organization-AARVAK--VSET-purple.svg)](https://github.com/AARVAK-VSET)
[![Event](https://img.shields.io/badge/TSJ%202026-Patch%20Wars-orange.svg)](https://github.com/AARVAK-VSET)

> **StackCraft CLI** is an interactive, lightning-fast scaffolding generator for modern full-stack web applications. Stop wasting hours configuring boilerplate, routing, auth, and styling—launch production-grade applications in seconds.

---

## ⚡ Highlights

- **Instant Stack Generation**: Generate full-stack architectures (frontend + backend) with a single command.
- **Multiple Popular Stacks**:
  - **MERN**: MongoDB + Express + React + Node.js (with optional Tailwind + Auth)
  - **MEAN**: MongoDB + Express + Angular + Node.js (with optional Tailwind + Auth)
  - **MEVN**: MongoDB + Express + Vue.js + Node.js (with optional Tailwind + Auth)
  - **T3 Stack**: Next.js + tRPC + Prisma + Tailwind CSS + NextAuth
  - **Hono Edge**: Hono + Prisma + React
- **TypeScript & JavaScript First-Class**: Seamless toggle between TypeScript and modern JavaScript.
- **Pre-configured DX**: Batteries included with linting, build scripts, client-server proxying, and environment templates.

---

## 🚀 Quick Start

Run StackCraft directly using `npx`:

```bash
# Interactive mode (prompts for name & stack)
npx stackcraft

# Or specify your project name upfront
npx stackcraft my-awesome-app
```

Or install globally:

```bash
npm install -g stackcraft-cli
stackcraft my-awesome-app
```

---

## 🎯 Supported Stacks

| Stack Key | Architecture | Features Included |
| :--- | :--- | :--- |
| `mern` | React (Vite) + Express + MongoDB | Modular API routes, Mongoose models, CORS, Axios |
| `mern+tailwind+auth` | React + Tailwind CSS + JWT Auth | Protected routes, login/register UI, token auth |
| `mean` | Angular + Express + MongoDB | Angular CLI structure, services, reactive forms |
| `mean+tailwind+auth` | Angular + Tailwind + Auth | Standalone components, Tailwind preset, auth guard |
| `mevn` | Vue 3 + Express + MongoDB | Vite Vue 3, Pinia state management, API routes |
| `mevn+tailwind+auth` | Vue 3 + Tailwind + Auth | Tailwind CSS 3, auth components, JWT middleware |
| `t3-stack` | Next.js App Router | Type-safe tRPC client/server, Prisma ORM, Tailwind |
| `hono` | Hono Backend + React Client | Ultra-fast Edge/Node HTTP server, modern React UI |

---

## 📁 Repository Structure

```
stackcraft-cli/
├── bin/
│   └── stackcraft.js      # CLI executable entrypoint
├── commands/
│   └── scaffold.js        # Command handlers
├── utils/
│   ├── installer.js       # Dependency and template wiring engine
│   ├── project.js         # Project directory and configuration lifecycle
│   └── templateManager.js # Template asset extractor
├── templates/             # Curated stack starter templates
├── index.js               # CLI interactive prompts & banner
├── package.json
└── README.md
```

---

## 🤝 Contributing to Patch Wars 2026

We welcome contributions from all **Patch Wars (TSJ 2026)** participants!

1. Fork this repository: `https://github.com/AARVAK-VSET/stackcraft-cli`
2. Claim an open issue by commenting `"Claiming this issue"` on the issue thread.
3. Create your feature branch: `git checkout -b feat/add-new-stack`
4. Test your scaffold locally: `npm link && stackcraft test-app`
5. Submit a pull request referencing your issue: `Fixes #IssueNumber`

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more details.  
Maintained by **[AARVAK-VSET](https://github.com/AARVAK-VSET)**.
