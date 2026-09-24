/**
 * Paginated GitHub issue fetching for repository indexing.
 * Walks every API page until the final (short or empty) page.
 */

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches all open issues for a repository, iterating every pagination page.
 * Pull requests returned by the Issues API are excluded.
 *
 * Termination rules:
 * - Empty page → stop (no more results)
 * - Page with fewer than `perPage` items → stop (final page reached)
 * - Full page → request the next page
 *
 * @param {{ issues: { listForRepo: Function } }} octokit
 * @param {{
 *   owner: string,
 *   repo: string,
 *   perPage?: number,
 *   delayMs?: number,
 *   log?: (...args: any[]) => void,
 * }} options
 * @returns {Promise<object[]>}
 */
export async function fetchAllOpenIssues(octokit, options) {
  const {
    owner,
    repo,
    perPage = 100,
    delayMs = 0,
    log = () => {},
  } = options;

  if (!owner || !repo) {
    throw new Error("owner and repo are required to fetch issues");
  }
  if (!Number.isInteger(perPage) || perPage < 1 || perPage > 100) {
    throw new Error("perPage must be an integer between 1 and 100");
  }

  const allIssues = [];
  let page = 1;

  while (true) {
    const { data: items } = await octokit.issues.listForRepo({
      owner,
      repo,
      state: "open",
      per_page: perPage,
      page,
    });

    if (!Array.isArray(items) || items.length === 0) {
      // Empty page — pagination complete
      break;
    }

    const issuesOnly = items.filter((item) => !item.pull_request);
    allIssues.push(...issuesOnly);

    log(`  📄 Fetched page ${page} - ${issuesOnly.length} issues (${items.length} API items)`);

    // Final page reached: fewer results than the page size means no further pages
    if (items.length < perPage) {
      break;
    }

    page += 1;

    if (delayMs > 0) {
      await delay(delayMs);
    }
  }

  return allIssues;
}
