# 🔄 StackCraft Workflows

Welcome to the StackCraft CLI workflow guide. This document outlines how to use the CLI for your applications, how to contribute to the tool itself, and (for maintainers) how to manage our internal infrastructure.

## 🚀 End-User Scaffolding Workflow

Getting started with StackCraft CLI is designed to be frictionless. Follow these steps to scaffold a new application:

1. **Run the CLI**: You can use `npx` to run StackCraft without global installation:
   ```bash
   npx stackcraft my-awesome-app
   ```
2. **Select your Stack**: Follow the interactive prompts to choose your preferred architecture (MERN, MEAN, MEVN, T3, Hono).
3. **Start Developing**: Navigate into your new project, install dependencies, and start the development server.

## 💻 Developer Contribution Workflow

Want to add a new feature or fix a bug in StackCraft CLI? Here is the standard contribution workflow:

1. **Setup**: Fork and clone the repository, then install dependencies:
   ```bash
   git clone https://github.com/AARVAK-VSET/stackcraft-cli.git
   cd stackcraft-cli
   npm install
   ```
2. **Test Locally**: Use `npm link` to test the CLI commands globally on your local machine:
   ```bash
   npm link
   stackcraft test-app
   ```
3. **Submit Changes**: Commit your changes and open a Pull Request. Be sure to reference the relevant issue number in the description (e.g., `Fixes #7`).

---

## 🤖 Internal Bot Maintenance (Maintainers Only)

*Note: The following infrastructure details are irrelevant to CLI consumers.*

This repository includes several GitHub Actions workflows for managing your Pinecone vector database and duplicate detection system.

### 1. ️ Database Operations (Manual)
**File:** `.github/workflows/database-operations.yml`

Pure database management operations - no validation mixed in.

**Operations Available:**
- **Populate Issues** - Add existing GitHub issues to Pinecone database (skips duplicates)
- **Cleanup Duplicates** - Remove duplicate vectors (requires force flag)
- **Debug Database** - View database contents and statistics
- **Clear All Vectors** - ⚠️ **DANGER:** Delete all vectors (requires force flag)

**How to use:**
1. Go to **Actions** tab in your repository
2. Select **"Database Operations"**
3. Click **"Run workflow"**
4. Choose your operation and enable force flag if needed
5. Click **"Run workflow"**

### 2. 🔍 API Validation (Manual)
**File:** `.github/workflows/api-validation.yml`

Pure API connection testing - run before database operations.

**Validation Scopes:**
- **All APIs** - Test all connections (Pinecone, GitHub, Gemini)
- **Pinecone Only** - Test only Pinecone database connection
- **GitHub Only** - Test only GitHub API connection  
- **Gemini Only** - Test only Gemini AI API connection

**How to use:**
1. Go to **Actions** tab in your repository
2. Select **"API Validation"**
3. Click **"Run workflow"**
4. Choose validation scope
5. Click **"Run workflow"**

### 3. 🔍 Duplicate Issue Management (Automatic + Manual)
**File:** `.github/workflows/duplicate-issue.yml`

Handles duplicate detection automatically and allows manual checks.

**Automatic triggers:**
- When issues are opened, edited, or reopened
- Automatically cleans up when issues are closed

**Manual triggers:**
- Check any specific issue number for duplicates

### Usage Examples

**Recommended Workflow:**
1. **Validate APIs First:** Actions → API Validation → Choose "all-apis" → Run
2. **Then Perform Operations:** Actions → Database Operations → Choose your operation

### Local Scripts (npm commands)

You can also run these operations locally:

```bash
# API Validation
npm run validate              # Test all API connections
npm run validate:pinecone     # Test only Pinecone connection  
npm run validate:github       # Test only GitHub connection
npm run validate:gemini       # Test only Gemini API connection

# Safe operations
npm run populate-issues       # Add existing issues to database
npm run debug-db             # Check database status
npm run check-duplicates     # Check for duplicates

# Cleanup operations (preview first with --dry-run)
node scripts/cleanup-duplicates.js --dry-run       # Preview duplicate vectors
node scripts/cleanup-duplicates.js                 # Remove duplicates (asks for confirmation)
node scripts/cleanup-specific-issue.js 6 --dry-run # Preview vectors for issue #6

# Dangerous operations (use with caution!)
node scripts/clear-all-vectors.js --dry-run        # Show how many vectors would be deleted
node scripts/clear-all-vectors.js                  # ⚠️ Delete ALL vectors (type index name to confirm)
```

### Maintenance Script Safety Flags

All destructive vector scripts (`clear-all-vectors.js`, `cleanup-duplicates.js`,
`cleanup-specific-issue.js`, `cleanup-closed-issue.js`) share the same options:

| Flag | Description |
|------|-------------|
| `-n`, `--dry-run` | Show the affected vector counts/IDs without deleting anything (or posting comments) |
| `-y`, `--yes` | Skip the interactive confirmation prompt |
| `--force` | Deprecated alias for `--yes` |
| `-h`, `--help` | Show usage |

Without `--yes`, each script asks for confirmation before deleting (`clear-all-vectors.js`
requires typing the index name). In non-interactive environments such as GitHub Actions
there is no terminal to confirm in, so the scripts refuse to delete and exit with code 1
unless `--yes` is passed. Workflows that call these scripts must pass `--yes` explicitly.

### Required Secrets

Make sure these secrets are configured in your repository:

- `GITHUB_TOKEN` - Automatically provided by GitHub
- `GEMINI_API_KEY` - Your Google Gemini API key
- `PINECONE_API_KEY` - Your Pinecone API key
- `PINECONE_INDEX` - Your Pinecone index name