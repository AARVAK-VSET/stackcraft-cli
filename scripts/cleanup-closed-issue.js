import { Octokit } from "@octokit/rest";
import { Pinecone } from "@pinecone-database/pinecone";
import {
  parseMaintenanceArgs,
  confirmAction,
  formatDryRunReport,
  isDirectRun,
  reportUnknownOptions,
} from "./lib/maintenance-cli.js";

// Retry logic for API calls
async function retryApiCall(apiCall, maxRetries = 3, delay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      if (error.status === 429 || error.status >= 500) {
        console.log(
          `API call failed (attempt ${i + 1}), retrying in ${delay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      } else {
        throw error; // Don't retry for other errors
      }
    }
  }
}

/**
 * @returns {Promise<{status: "skipped"|"empty"|"dry-run"|"aborted"|"deleted", vectorsToDelete?: string[]}>}
 */
export async function cleanupClosedIssue({
  octokit,
  index,
  indexName,
  owner: OWNER,
  repo: REPO,
  issueNumber: ISSUE_NUMBER,
  options = {},
  confirm = confirmAction,
  log = console.log,
}) {
  log(
    `\n=== Cleaning up closed issue #${ISSUE_NUMBER} from vector database ===`
  );
  log(`Repository: ${OWNER}/${REPO}`);
  log(`Pinecone Index: ${indexName}`);
  if (options.dryRun) log("🧪 Dry-run mode: no vectors will be deleted and no comments posted.");

  if (!OWNER || !REPO) {
    throw new Error(
      "Repository owner and name must be specified via GITHUB_REPOSITORY or GITHUB_OWNER/GITHUB_REPO environment variables"
    );
  }

  if (!ISSUE_NUMBER) {
    throw new Error(
      "Issue number must be specified via ISSUE_NUMBER environment variable"
    );
  }

  try {
    // Fetch the closed issue details for logging with retry logic
    const { data: closedIssue } = await retryApiCall(async () => {
      return await octokit.issues.get({
        owner: OWNER,
        repo: REPO,
        issue_number: ISSUE_NUMBER,
      });
    });

    // Skip if it's actually a pull request
    if (closedIssue.pull_request) {
      log("⏭️ Skipping pull request cleanup - not an issue");
      return { status: "skipped" };
    }

    log(`📄 Issue details:`);
    log(`   Title: "${closedIssue.title}"`);
    log(`   State: ${closedIssue.state}`);
    log(`   Closed at: ${closedIssue.closed_at}`);

    // Query Pinecone to find vectors for this issue with retry logic
    log(
      `🔍 Searching for vectors related to issue #${ISSUE_NUMBER}...`
    );

    const vectorsToDelete = [];

    try {
      await retryApiCall(async () => {
        // First, try using metadata filter (same as check-duplicates.js)
        const queryResponse = await index.query({
          vector: Array(1024).fill(0.1), // dummy vector for metadata filtering
          topK: 100,
          includeValues: false,
          includeMetadata: true,
          filter: {
            issue_number: ISSUE_NUMBER,
          },
        });

        // If filter query works, use those results
        if (queryResponse.matches && queryResponse.matches.length > 0) {
          for (const match of queryResponse.matches) {
            vectorsToDelete.push(match.id);
            log(`   📌 Found vector via filter: ${match.id}`);
          }
        } else {
          // Fallback to listing all vectors (paginated approach)
          log(
            "   🔄 Filter query returned no results, trying list approach..."
          );
          let paginationToken = null;

          do {
            const listOptions = { limit: 100 };
            if (paginationToken) {
              listOptions.paginationToken = paginationToken;
            }

            const listResponse = await index.listPaginated(listOptions);

            if (listResponse.vectors) {
              for (const vector of listResponse.vectors) {
                if (vector.metadata?.issue_number === ISSUE_NUMBER) {
                  vectorsToDelete.push(vector.id);
                  log(`   📌 Found vector via list: ${vector.id}`);
                }
              }
            }

            paginationToken = listResponse.pagination?.next;
          } while (paginationToken);
        }
      });
    } catch (error) {
      console.error(
        "❌ Failed to search vectors from Pinecone:",
        error.message
      );
      throw error;
    }

    log(`Found ${vectorsToDelete.length} vector(s) to delete`);

    if (vectorsToDelete.length === 0 && options.dryRun) {
      log(
        formatDryRunReport({
          operation: `Clean up closed issue #${ISSUE_NUMBER}`,
          indexName,
          affectedCount: 0,
          details: ["Would post a \"no vectors found\" comment on the issue"],
        })
      );
      return { status: "dry-run", vectorsToDelete };
    }

    if (vectorsToDelete.length === 0) {
      log(
        `ℹ️  No vectors found for issue #${ISSUE_NUMBER}. It may have been a duplicate issue that was never added to the vector database.`
      );

      // Still post a cleanup confirmation comment with retry logic
      await retryApiCall(async () => {
        return await octokit.issues.createComment({
          owner: OWNER,
          repo: REPO,
          issue_number: ISSUE_NUMBER,
          body:
            `🧹 **Issue Cleanup Completed** 🧹\n\n` +
            `This issue has been closed and checked for cleanup. No vectors were found in the database ` +
            `(likely because it was detected as a duplicate and never stored).\n\n` +
            `*This comment was generated automatically by Seroski-DupBot 🤖*` +
            `\n\nCheck out the developer: [Portfolio](https://portfolio.rosk.dev)`,
        });
      });

      log("✅ Cleanup confirmation comment posted");
      return { status: "empty", vectorsToDelete };
    }

    if (options.dryRun) {
      log(
        formatDryRunReport({
          operation: `Clean up closed issue #${ISSUE_NUMBER}`,
          indexName,
          affectedCount: vectorsToDelete.length,
          ids: vectorsToDelete,
          details: ["Would post a cleanup confirmation comment on the issue"],
        })
      );
      return { status: "dry-run", vectorsToDelete };
    }

    const confirmed = await confirm({
      question: `Delete ${vectorsToDelete.length} vector(s) for closed issue #${ISSUE_NUMBER} from "${indexName}"?`,
      yes: options.yes,
    });
    if (!confirmed) {
      log("🛑 Aborted. No vectors were deleted and no comment was posted.");
      return { status: "aborted", vectorsToDelete };
    }

    // Delete the vectors from Pinecone with retry logic
    log(
      `🗑️  Deleting ${vectorsToDelete.length} vector(s) from Pinecone...`
    );

    try {
      await retryApiCall(async () => {
        return await index.deleteMany(vectorsToDelete);
      });
      log(
        `✅ Successfully deleted ${vectorsToDelete.length} vector(s) from Pinecone`
      );
    } catch (deleteError) {
      console.error(`❌ Error deleting vectors:`, deleteError.message);
      throw deleteError;
    }

    // Post a comment on the closed issue confirming cleanup with retry logic
    const commentBody =
      `🧹 **Issue Cleanup Completed** 🧹\n\n` +
      `This closed issue has been automatically removed from our duplicate detection database.\n\n` +
      `**Cleanup Details:**\n` +
      `- Vectors removed: ${vectorsToDelete.length}\n` +
      `- Cleaned at: ${new Date().toISOString()}\n\n` +
      `This helps keep our duplicate detection system accurate and prevents closed issues ` +
      `from being referenced in future duplicate checks.\n\n` +
      `*This comment was generated automatically by Seroski-DupBot 🤖*` +
      `\n\nCheck out the developer: [Portfolio](https://portfolio.rosk.dev)`;

    await retryApiCall(async () => {
      return await octokit.issues.createComment({
        owner: OWNER,
        repo: REPO,
        issue_number: ISSUE_NUMBER,
        body: commentBody,
      });
    });

    log("✅ Cleanup confirmation comment posted on the issue");

    log(`\n=== Cleanup Summary ===`);
    log(`📊 Issue #${ISSUE_NUMBER}: "${closedIssue.title}"`);
    log(`🗑️  Vectors deleted: ${vectorsToDelete.length}`);
    log(`✅ Database cleanup completed successfully`);
    log(`💬 Confirmation comment posted`);
    return { status: "deleted", vectorsToDelete };
  } catch (error) {
    console.error("❌ Error during cleanup:", error);

    // Try to post an error comment if possible with retry logic
    // (never in dry-run mode, which must not touch the issue)
    if (!options.dryRun) try {
      await retryApiCall(async () => {
        return await octokit.issues.createComment({
          owner: OWNER,
          repo: REPO,
          issue_number: ISSUE_NUMBER,
          body:
            `⚠️ **Issue Cleanup Failed** ⚠️\n\n` +
            `There was an error while trying to clean up this closed issue from our duplicate detection database.\n\n` +
            `**Error:** ${error.message}\n\n` +
            `A maintainer may need to manually review the vector database cleanup.\n\n` +
            `*This comment was generated automatically by Seroski-DupBot 🤖*` +
            `\n\nCheck out the developer: [Portfolio](https://portfolio.rosk.dev)`,
        });
      });
    } catch (commentError) {
      console.error("❌ Failed to post error comment:", commentError.message);
    }

    throw error;
  }
}

export const HELP_TEXT = `
📖 Usage: node scripts/cleanup-closed-issue.js [options]

⚙️  Options:
  -n, --dry-run   List the vectors that would be deleted, without deleting anything or posting comments
  -y, --yes       Skip the confirmation prompt (required in non-interactive/CI runs)
      --force     Deprecated alias for --yes
  -h, --help      Show this help

🔧 Required Environment Variables:
  - GITHUB_TOKEN: GitHub personal access token
  - GITHUB_REPOSITORY: Repository in format "owner/repo" (or use GITHUB_OWNER + GITHUB_REPO)
  - ISSUE_NUMBER: Issue number to clean up
  - PINECONE_API_KEY: Pinecone API key
  - PINECONE_INDEX: Pinecone index name

📝 This script will:
  1. Find all vectors in Pinecone related to the specified issue number
  2. Ask for confirmation
  3. Delete those vectors from the Pinecone index
  4. Post a confirmation comment on the closed issue

⚠️  Note: This script is typically called automatically by GitHub Actions when issues
   are closed. Automated runs must pass --yes, since there is no terminal to confirm in.
`;

async function main(argv) {
  const options = parseMaintenanceArgs(argv);

  if (options.help) {
    console.log(HELP_TEXT);
    return 0;
  }
  if (reportUnknownOptions(options.unknown, "cleanup-closed-issue.js")) return 1;

  const indexName = process.env.PINECONE_INDEX;
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });
  const index = pinecone.Index(indexName);
  console.log("✅ Connected to Pinecone index");

  const result = await cleanupClosedIssue({
    octokit: new Octokit({ auth: process.env.GITHUB_TOKEN }),
    index,
    indexName,
    owner: process.env.GITHUB_REPOSITORY?.split("/")[0] || process.env.GITHUB_OWNER,
    repo: process.env.GITHUB_REPOSITORY?.split("/")[1] || process.env.GITHUB_REPO,
    issueNumber: Number(process.env.ISSUE_NUMBER?.trim().replace(/^#/, "")),
    options,
  });
  return result.status === "aborted" ? 1 : 0;
}

if (isDirectRun(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => { process.exitCode = code; },
    (error) => {
      console.error("💥 Cleanup script failed:", error);
      process.exitCode = 1;
    }
  );
}
