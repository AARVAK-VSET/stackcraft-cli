import { Pinecone } from "@pinecone-database/pinecone";
import dotenv from "dotenv";
import {
  parseMaintenanceArgs,
  confirmAction,
  formatDryRunReport,
  isDirectRun,
  reportUnknownOptions,
} from "./lib/maintenance-cli.js";

export const HELP_TEXT = `
📖 Usage:
  node scripts/cleanup-specific-issue.js <issue-number> [options]
  ISSUE_NUMBER=6 node scripts/cleanup-specific-issue.js [options]

⚙️  Options:
  -n, --dry-run   List the vectors that would be deleted, without deleting anything
  -y, --yes       Skip the confirmation prompt (required in non-interactive/CI runs)
      --force     Deprecated alias for --yes
  -h, --help      Show this help

🔧 Required Environment Variables:
  - PINECONE_API_KEY: Pinecone API key
  - PINECONE_INDEX: Pinecone index name

📝 This script will:
  1. Find all vectors in Pinecone related to the specified issue number
  2. Ask for confirmation
  3. Delete those vectors from the Pinecone index
  4. Show a summary of what was deleted

⚠️  Note: This action cannot be undone! Use carefully.
`;

async function findIssueVectors(index, issueNumber, log) {
  const vectorsToDelete = [];

  // First, try using metadata filter
  const queryResponse = await index.query({
    vector: Array(1024).fill(0.1), // dummy vector for metadata filtering
    topK: 100,
    includeValues: false,
    includeMetadata: true,
    filter: {
      issue_number: issueNumber
    }
  });

  if (queryResponse.matches && queryResponse.matches.length > 0) {
    for (const match of queryResponse.matches) {
      vectorsToDelete.push(match.id);
      log(`   📌 Found vector via filter: ${match.id}`);
      log(`      Metadata: ${JSON.stringify(match.metadata, null, 2)}`);
    }
  } else {
    log("   🔄 Filter query returned no results, trying list approach...");

    // Fallback: List all vectors and filter
    let paginationToken = null;

    do {
      const listOptions = { limit: 100 };
      if (paginationToken) {
        listOptions.paginationToken = paginationToken;
      }

      const listResponse = await index.listPaginated(listOptions);

      if (listResponse.vectors) {
        for (const vector of listResponse.vectors) {
          if (vector.metadata?.issue_number === issueNumber) {
            vectorsToDelete.push(vector.id);
            log(`   📌 Found vector via list: ${vector.id}`);
            log(`      Metadata: ${JSON.stringify(vector.metadata, null, 2)}`);
          }
        }
      }

      paginationToken = listResponse.pagination?.next;
    } while (paginationToken);
  }

  return vectorsToDelete;
}

/**
 * @returns {Promise<{status: "empty"|"dry-run"|"aborted"|"deleted", vectorsToDelete: string[]}>}
 */
export async function deleteIssueVectors({
  index,
  indexName,
  issueNumber,
  options = {},
  confirm = confirmAction,
  log = console.log,
}) {
  log(`\n=== Deleting vectors for Issue #${issueNumber} ===`);
  log(`Pinecone Index: ${indexName}`);
  if (options.dryRun) log("🧪 Dry-run mode: no vectors will be deleted.");

  // Find all vectors for this issue
  log(`🔍 Searching for vectors related to issue #${issueNumber}...`);

  let vectorsToDelete;
  try {
    vectorsToDelete = await findIssueVectors(index, issueNumber, log);
  } catch (searchError) {
    console.error("❌ Error searching for vectors:", searchError.message);
    throw searchError;
  }

  log(`\nFound ${vectorsToDelete.length} vector(s) to delete for Issue #${issueNumber}`);

  if (vectorsToDelete.length === 0) {
    log(`ℹ️  No vectors found for Issue #${issueNumber}. Nothing to delete.`);
    return { status: "empty", vectorsToDelete };
  }

  if (options.dryRun) {
    log(
      formatDryRunReport({
        operation: `Delete vectors for Issue #${issueNumber}`,
        indexName,
        affectedCount: vectorsToDelete.length,
        ids: vectorsToDelete,
      })
    );
    return { status: "dry-run", vectorsToDelete };
  }

  // Show what we're about to delete
  log(`\n🗑️  About to delete the following vectors:`);
  vectorsToDelete.forEach((id, i) => {
    log(`   ${i + 1}. ${id}`);
  });

  const confirmed = await confirm({
    question: `Delete ${vectorsToDelete.length} vector(s) for Issue #${issueNumber}? This cannot be undone.`,
    yes: options.yes,
  });
  if (!confirmed) {
    log("🛑 Aborted. No vectors were deleted.");
    return { status: "aborted", vectorsToDelete };
  }

  // Delete the vectors
  log(`\n🗑️  Deleting ${vectorsToDelete.length} vector(s)...`);

  try {
    await index.deleteMany(vectorsToDelete);
    log(`✅ Successfully deleted ${vectorsToDelete.length} vector(s) for Issue #${issueNumber}`);
  } catch (deleteError) {
    console.error(`❌ Error deleting vectors:`, deleteError.message);
    throw deleteError;
  }

  log(`\n=== Cleanup Summary ===`);
  log(`📊 Issue #${issueNumber} vectors deleted: ${vectorsToDelete.length}`);
  log(`✅ Database cleanup completed successfully`);
  log(`\n🎯 You can now edit Issue #${issueNumber} to test the update functionality!`);

  return { status: "deleted", vectorsToDelete };
}

async function main(argv) {
  const options = parseMaintenanceArgs(argv);

  if (options.help) {
    console.log(HELP_TEXT);
    return 0;
  }
  if (reportUnknownOptions(options.unknown, "cleanup-specific-issue.js")) return 1;

  // Load environment variables
  dotenv.config();

  const rawIssue = process.env.ISSUE_NUMBER || options.positionals[0];
  const issueNumber = parseInt(rawIssue?.trim().replace(/^#/, ""), 10);
  if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
    console.error("❌ Please provide an issue number:");
    console.error("   Usage: ISSUE_NUMBER=6 node scripts/cleanup-specific-issue.js");
    console.error("   Or:    node scripts/cleanup-specific-issue.js 6");
    return 1;
  }

  const indexName = process.env.PINECONE_INDEX;
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });
  const index = pinecone.Index(indexName);
  console.log("✅ Connected to Pinecone index");

  const result = await deleteIssueVectors({ index, indexName, issueNumber, options });
  return result.status === "aborted" ? 1 : 0;
}

if (isDirectRun(import.meta.url)) {
  main(process.argv.slice(2)).then(
    code => { process.exitCode = code; },
    error => {
      console.error("❌ Error during cleanup:", error);
      process.exitCode = 1;
    }
  );
}
