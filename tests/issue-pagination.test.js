import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fetchAllOpenIssues } from "../scripts/lib/fetch-repo-issues.js";

function makeIssue(number, { isPr = false } = {}) {
  const issue = { number, title: `Issue ${number}`, body: `Body ${number}` };
  if (isPr) {
    issue.pull_request = { url: "https://api.github.com/repos/o/r/pulls/1" };
  }
  return issue;
}

/**
 * Fake Octokit that serves fixed pages keyed by page number.
 * Records every listForRepo call for pagination assertions.
 */
function fakePaginatedOctokit(pages) {
  const calls = [];
  return {
    calls,
    issues: {
      async listForRepo({ page, per_page, owner, repo, state }) {
        calls.push({ page, per_page, owner, repo, state });
        const data = pages[page] ?? [];
        return { data };
      },
    },
  };
}

describe("fetchAllOpenIssues pagination (Issue #16)", () => {
  it("iterates every page until a short final page and indexes >100 issues", async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => makeIssue(i + 1));
    const page2 = Array.from({ length: 100 }, (_, i) => makeIssue(i + 101));
    const page3 = Array.from({ length: 37 }, (_, i) => makeIssue(i + 201));

    const octokit = fakePaginatedOctokit({ 1: page1, 2: page2, 3: page3 });
    const issues = await fetchAllOpenIssues(octokit, {
      owner: "org",
      repo: "repo",
      perPage: 100,
      delayMs: 0,
    });

    assert.equal(issues.length, 237, "must index all issues across pages, not stop at 100");
    assert.equal(octokit.calls.length, 3, "must request exactly three pages");
    assert.deepEqual(
      octokit.calls.map((c) => c.page),
      [1, 2, 3]
    );
    assert.ok(octokit.calls.every((c) => c.per_page === 100));
    assert.ok(octokit.calls.every((c) => c.state === "open"));
    assert.equal(issues[0].number, 1);
    assert.equal(issues[236].number, 237);
  });

  it("terminates cleanly on the final page without an extra empty request", async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => makeIssue(i + 1));
    const page2 = Array.from({ length: 5 }, (_, i) => makeIssue(i + 101));

    const octokit = fakePaginatedOctokit({ 1: page1, 2: page2, 3: [] });
    const issues = await fetchAllOpenIssues(octokit, {
      owner: "org",
      repo: "repo",
      perPage: 100,
      delayMs: 0,
    });

    assert.equal(issues.length, 105);
    assert.equal(octokit.calls.length, 2, "must stop after short final page (no empty page fetch)");
  });

  it("stops after an empty first page", async () => {
    const octokit = fakePaginatedOctokit({ 1: [] });
    const issues = await fetchAllOpenIssues(octokit, {
      owner: "org",
      repo: "repo",
      perPage: 100,
      delayMs: 0,
    });

    assert.equal(issues.length, 0);
    assert.equal(octokit.calls.length, 1);
  });

  it("continues pagination when a full page is exactly perPage items", async () => {
    // Exactly 200 issues → page 1 and 2 full, then empty page 3 required to confirm end
    const page1 = Array.from({ length: 100 }, (_, i) => makeIssue(i + 1));
    const page2 = Array.from({ length: 100 }, (_, i) => makeIssue(i + 101));

    const octokit = fakePaginatedOctokit({ 1: page1, 2: page2, 3: [] });
    const issues = await fetchAllOpenIssues(octokit, {
      owner: "org",
      repo: "repo",
      perPage: 100,
      delayMs: 0,
    });

    assert.equal(issues.length, 200);
    assert.equal(octokit.calls.length, 3);
    assert.equal(octokit.calls[2].page, 3);
  });

  it("filters pull requests but still advances through full pages", async () => {
    const page1 = [
      ...Array.from({ length: 90 }, (_, i) => makeIssue(i + 1)),
      ...Array.from({ length: 10 }, (_, i) => makeIssue(900 + i, { isPr: true })),
    ];
    const page2 = Array.from({ length: 12 }, (_, i) => makeIssue(i + 100));

    const octokit = fakePaginatedOctokit({ 1: page1, 2: page2 });
    const issues = await fetchAllOpenIssues(octokit, {
      owner: "org",
      repo: "repo",
      perPage: 100,
      delayMs: 0,
    });

    assert.equal(issues.length, 102);
    assert.ok(issues.every((issue) => !issue.pull_request));
    assert.equal(octokit.calls.length, 2);
  });

  it("rejects missing owner/repo", async () => {
    const octokit = fakePaginatedOctokit({});
    await assert.rejects(
      () => fetchAllOpenIssues(octokit, { owner: "", repo: "r" }),
      /owner and repo/
    );
  });
});
