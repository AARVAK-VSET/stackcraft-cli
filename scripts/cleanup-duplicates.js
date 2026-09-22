import { Pinecone } from "@pinecone-database/pinecone";
import dotenv from "dotenv";
import {
  parseMaintenanceArgs,
  confirmAction,
  formatDryRunReport,
  isDirectRun,
  reportUnknownOptions,
} from "./lib/maintenance-cli.js";

// Add delay to respect API rate limits
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const HELP_TEXT = `
📖 Usage: node scripts/cleanup-duplicates.js [options]

⚙️  Options:
  -n, --dry-run   List the duplicate vectors that would be deleted, without deleting anything
  -y, --yes       Skip the confirmation prompt (required in non-interactive/CI runs)
      --force     Deprecated alias for --yes
  -h, --help      Show this help

🔧 Required Environment Variables:
  - PINECONE_API_KEY: Pinecone API key
  - PINECONE_INDEX: Pinecone index name

📝 This script will:
  1. Find all vectors in your Pinecone index
  2. Group them by issue number
  3. Identify duplicate vectors and ask for confirmation
  4. Keep only one vector per issue (preferring clean IDs)

⚠️  WARNING: This will permanently delete duplicate vectors!
`;

/**
 * Group vectors by issue number and decide which to keep.
 * Prefers non-timestamped IDs, then alphabetical order.
 */
export function findDuplicateVectors(matches, log = () => {}) {
  const vectorsByIssue = new Map();

  for (const vector of matches) {
    const issueNumber = vector.metadata?.issue_number;
    if (issueNumber) {
      if (!vectorsByIssue.has(issueNumber)) {
        vectorsByIssue.set(issueNumber, []);
      }
      vectorsByIssue.get(issueNumber).push(vector);
    }
  }

  log(`🔍 Found vectors for ${vectorsByIssue.size} different issues`);

  const vectorsToDelete = [];
  const vectorsToKeep = [];

  for (const [issueNumber, vectors] of vectorsByIssue) {
    log(`\n📋 Issue #${issueNumber}: ${vectors.length} vector(s)`);

    if (vectors.length === 1) {
      log(`  ✅ No duplicates for issue #${issueNumber}`);
      vectorsToKeep.push(vectors[0]);
    } else {
      log(`  🔍 Found ${vectors.length} vectors, selecting which to keep...`);

      // Sort vectors: prefer non-timestamped IDs (clean format)
      const sorted = [...vectors].sort((a, b) => {
        const aHasTimestamp = /-\d{13}/.test(a.id);
        const bHasTimestamp = /-\d{13}/.test(b.id);

        if (!aHasTimestamp && bHasTimestamp) return -1; // a comes first (keep a)
        if (aHasTimestamp && !bHasTimestamp) return 1;  // b comes first (keep b)
        return a.id.localeCompare(b.id); // alphabetical if both same type
      });

      const [toKeep, ...toDelete] = sorted;

      log(`    ✅ Keeping: ${toKeep.id}`);
      vectorsToKeep.push(toKeep);

      toDelete.forEach(v => {
        log(`    🗑️  Deleting: ${v.id}`);
        vectorsToDelete.push(v.id);
      });
    }
  }

  return { vectorsToKeep, vectorsToDelete, issueCount: vectorsByIssue.size };
}

/**
 * @returns {Promise<{status: "empty"|"clean"|"dry-run"|"aborted"|"cleaned", vectorsToDelete: string[], deleted?: number}>}
 */
export async function cleanupDuplicates({
  index,
  indexName,
  options = {},
  confirm = confirmAction,
  log = console.log,
  wait = delay,
}) {
  log(`\n=== Cleaning up duplicate vectors in Pinecone ===`);
  log(`Pinecone Index: ${indexName}`);
  if (options.dryRun) log("🧪 Dry-run mode: no vectors will be deleted.");

  // Get all vectors
  log("📥 Fetching all vectors...");
  const allVectors = await index.query({
    vector: Array(1024).fill(0.1),
    topK: 1000, // Should be enough for all vectors
    includeMetadata: true,
    includeValues: false
  });

  if (!allVectors.matches || allVectors.matches.length === 0) {
    log("ℹ️  No vectors found in the index.");
    return { status: "empty", vectorsToDelete: [] };
  }

  log(`📊 Found ${allVectors.matches.length} total vectors`);

  const { vectorsToKeep, vectorsToDelete, issueCount } = findDuplicateVectors(allVectors.matches, log);

  log(`\n📊 Summary:`);
  log(`  ✅ Vectors to keep: ${vectorsToKeep.length}`);
  log(`  🗑️  Vectors to delete: ${vectorsToDelete.length}`);

  if (vectorsToDelete.length === 0) {
    log("🎉 No cleanup needed! All vectors are unique.");
    return { status: "clean", vectorsToDelete };
  }

  if (options.dryRun) {
    log(
      formatDryRunReport({
        operation: "Clean up duplicate vectors",
        indexName,
        affectedCount: vectorsToDelete.length,
        ids: vectorsToDelete,
        details: [
          `Issues scanned: ${issueCount}`,
          `Vectors that would be kept: ${vectorsToKeep.length}`,
        ],
      })
    );
    return { status: "dry-run", vectorsToDelete };
  }

  log(`\n⚠️  About to delete ${vectorsToDelete.length} duplicate vectors.`);
  log("🔍 Vectors to delete:");
  vectorsToDelete.forEach(id => log(`  - ${id}`));

  const confirmed = await confirm({
    question: `Delete ${vectorsToDelete.length} duplicate vector(s) from "${indexName}"? This cannot be undone.`,
    yes: options.yes,
  });
  if (!confirmed) {
    log("🛑 Aborted. No vectors were deleted.");
    return { status: "aborted", vectorsToDelete };
  }

  // Delete in batches
  log("\n🧹 Starting cleanup...");
  const batchSize = 100; // Pinecone delete limit
  let deleted = 0;

  for (let i = 0; i < vectorsToDelete.length; i += batchSize) {
    const batch = vectorsToDelete.slice(i, i + batchSize);

    try {
      await index.deleteMany(batch);
      deleted += batch.length;
      log(`  🗑️  Deleted batch: ${batch.length} vectors (total: ${deleted}/${vectorsToDelete.length})`);

      // Add delay between batches
      await wait(1000);
    } catch (error) {
      console.error(`  ❌ Failed to delete batch:`, error.message);
      console.error(`     Batch IDs: ${batch.join(', ')}`);
    }
  }

  log(`\n🎉 Cleanup completed!`);
  log(`✅ Deleted: ${deleted}/${vectorsToDelete.length} duplicate vectors`);
  log(`📊 Remaining vectors: ${vectorsToKeep.length} (one per issue)`);

  // Verify cleanup
  log("\n🔍 Verifying cleanup...");
  await wait(2000); // Wait for Pinecone to sync

  const finalStats = await index.describeIndexStats();
  const finalCount = finalStats.totalRecordCount || 0;
  log(`📊 Final vector count: ${finalCount}`);

  if (finalCount === vectorsToKeep.length) {
    log("✅ Cleanup verification successful!");
  } else {
    log(`⚠️  Expected ${vectorsToKeep.length} vectors, but found ${finalCount}`);
  }

  return { status: "cleaned", vectorsToDelete, deleted };
}

async function main(argv) {
  const options = parseMaintenanceArgs(argv);

  if (options.help) {
    console.log(HELP_TEXT);
    return 0;
  }
  if (reportUnknownOptions(options.unknown, "cleanup-duplicates.js")) return 1;

  // Load environment variables
  dotenv.config();

  const indexName = process.env.PINECONE_INDEX;
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });
  const index = pinecone.Index(indexName);
  console.log("✅ Connected to Pinecone index");

  const result = await cleanupDuplicates({ index, indexName, options });
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
