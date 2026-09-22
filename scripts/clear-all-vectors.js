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
📖 Usage: node scripts/clear-all-vectors.js [options]

⚙️  Options:
  -n, --dry-run   Show how many vectors would be deleted, without deleting anything
  -y, --yes       Skip the confirmation prompt (required in non-interactive/CI runs)
      --force     Deprecated alias for --yes
  -h, --help      Show this help

🔧 Required Environment Variables:
  - PINECONE_API_KEY: Pinecone API key
  - PINECONE_INDEX: Pinecone index name

📝 This script will:
  1. Connect to your Pinecone index
  2. Show the current vector count
  3. Ask you to confirm by typing the index name
  4. Delete ALL vectors in the index
  5. Verify the clearing operation

🚨 WARNING: This will permanently delete ALL data in your Pinecone index!
⚠️  This action cannot be undone!

💡 Alternative: Use the cleanup script to remove only duplicates:
     node scripts/cleanup-duplicates.js --dry-run
`;

/**
 * @returns {Promise<{status: "empty"|"dry-run"|"aborted"|"cleared", totalVectors: number, remainingVectors?: number}>}
 */
export async function clearAllVectors({
  index,
  indexName,
  options = {},
  confirm = confirmAction,
  log = console.log,
  wait = delay,
}) {
  log(`\n🚨 === CLEARING ALL VECTORS FROM PINECONE INDEX ===`);
  log(`Pinecone Index: ${indexName}`);
  if (options.dryRun) log("🧪 Dry-run mode: no vectors will be deleted.");

  // Get current stats
  log("📊 Getting current index statistics...");
  const initialStats = await index.describeIndexStats();
  const totalVectors = initialStats.totalRecordCount || 0;

  log(`📋 Current state:`);
  log(`  - Total vectors: ${totalVectors}`);
  log(`  - Index dimension: ${initialStats.dimension}`);
  log(`  - Index fullness: ${initialStats.indexFullness}`);

  if (totalVectors === 0) {
    log("ℹ️  Index is already empty. Nothing to clear.");
    return { status: "empty", totalVectors };
  }

  if (options.dryRun) {
    log(
      formatDryRunReport({
        operation: "Clear all vectors",
        indexName,
        affectedCount: totalVectors,
        details: ["Method: deleteAll() on the default namespace"],
      })
    );
    return { status: "dry-run", totalVectors };
  }

  log(`\n⚠️  You are about to DELETE ALL ${totalVectors} VECTORS from index "${indexName}".`);
  log("   This removes all issue embeddings and similarity data and cannot be undone!");

  const confirmed = await confirm({
    question: `Delete all ${totalVectors} vectors from "${indexName}"?`,
    expected: indexName,
    yes: options.yes,
  });
  if (!confirmed) {
    log("🛑 Aborted. No vectors were deleted.");
    return { status: "aborted", totalVectors };
  }

  log(`\n🚨 PROCEEDING TO DELETE ALL ${totalVectors} VECTORS`);

  // Method 1: Try to delete all vectors by namespace (fastest)
  try {
    log("\n🧹 Attempting to clear entire namespace...");
    await index.deleteAll();
    log("✅ Successfully cleared entire namespace");

    // Wait for operation to complete
    await wait(5000);

  } catch (deleteAllError) {
    log("⚠️  deleteAll() failed, trying alternative method...");
    console.error("Error:", deleteAllError.message);

    // Method 2: Get all vectors and delete them in batches
    log("🔍 Fetching all vectors for batch deletion...");

    const allVectors = await index.query({
      vector: Array(1024).fill(0.1),
      topK: 10000, // Max limit
      includeMetadata: false,
      includeValues: false
    });

    if (allVectors.matches && allVectors.matches.length > 0) {
      log(`📋 Found ${allVectors.matches.length} vectors to delete`);

      // Delete in batches
      const batchSize = 1000;
      let deleted = 0;

      for (let i = 0; i < allVectors.matches.length; i += batchSize) {
        const batch = allVectors.matches.slice(i, i + batchSize);
        const batchIds = batch.map(v => v.id);

        try {
          await index.deleteMany(batchIds);
          deleted += batch.length;
          log(`  🗑️  Deleted batch: ${batch.length} vectors (total: ${deleted}/${allVectors.matches.length})`);

          await wait(1000);
        } catch (batchError) {
          console.error(`  ❌ Failed to delete batch:`, batchError.message);
        }
      }

      log(`✅ Batch deletion completed: ${deleted}/${allVectors.matches.length} vectors`);
    }
  }

  // Verify the clearing
  log("\n🔍 Verifying index is cleared...");
  await wait(3000); // Wait for Pinecone to sync

  const finalStats = await index.describeIndexStats();
  const remainingVectors = finalStats.totalRecordCount || 0;

  log(`\n📊 Final Results:`);
  log(`  - Initial vectors: ${totalVectors}`);
  log(`  - Remaining vectors: ${remainingVectors}`);
  log(`  - Vectors cleared: ${totalVectors - remainingVectors}`);

  if (remainingVectors === 0) {
    log("🎉 SUCCESS: All vectors have been cleared from the index!");
    log("💡 You can now repopulate with fresh data using the populate script.");
  } else {
    log(`⚠️  WARNING: ${remainingVectors} vectors still remain in the index.`);
    log("This might be due to Pinecone sync delays. Check again in a few minutes.");
  }

  return { status: "cleared", totalVectors, remainingVectors };
}

async function main(argv) {
  const options = parseMaintenanceArgs(argv);

  if (options.help) {
    console.log(HELP_TEXT);
    return 0;
  }
  if (reportUnknownOptions(options.unknown, "clear-all-vectors.js")) return 1;

  // Load environment variables
  dotenv.config();

  const indexName = process.env.PINECONE_INDEX;
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });
  const index = pinecone.Index(indexName);
  console.log("✅ Connected to Pinecone index");

  const result = await clearAllVectors({ index, indexName, options });
  return result.status === "aborted" ? 1 : 0;
}

if (isDirectRun(import.meta.url)) {
  main(process.argv.slice(2)).then(
    code => { process.exitCode = code; },
    error => {
      console.error("❌ Error during clearing:", error);
      process.exitCode = 1;
    }
  );
}
