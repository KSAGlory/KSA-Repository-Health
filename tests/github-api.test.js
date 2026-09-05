import test from "node:test";
import assert from "node:assert/strict";

import {
  GitHubApiClient,
  GitHubApiError,
  githubApiConfiguration,
  readRateLimit
} from "../src/github-api.js";

const reference = {
  owner: "KSAGlory",
  repository: "KSA-Repository-Health"
};

function repositoryPayload(overrides = {}) {
  return {
    id: 123,
    full_name: "KSAGlory/KSA-Repository-Health",
    name: "KSA-Repository-Health",
    owner: { login: "KSAGlory" },
    description: "Repository readiness tool",
    default_branch: "main",
    visibility: "public",
    private: false,
    archived: false,
    disabled: false,
    pushed_at: "2026-09-05T08:00:00Z",
    updated_at: "2026-09-05T08:00:00Z",
    topics: ["github-api"],
    has_issues: true,
    has_discussions: false,
    open_issues_count: 0,
    ...overrides
  };
}

test("reads GitHub rate-limit headers", () => {
  const headers = new Headers({
    "x-ratelimit-limit": "60",
    "x-ratelimit-remaining": "52",
    "x-ratelimit-used": "8",
    "x-ratelimit-reset": "1788591600",
    "x-ratelimit-resource": "core"
  });

  const rateLimit = readRateLimit(headers);
  assert.equal(rateLimit.limit, 60);
  assert.equal(rateLimit.remaining, 52);
  assert.equal(rateLimit.used, 8);
  assert.equal(rateLimit.resource, "core");
  assert.ok(rateLimit.resetAt instanceof Date);
});

test("requests only the fixed GitHub API repository endpoint", async () => {
  let capturedUrl;
  let capturedOptions;
  const fetchImpl = async (url, options) => {
    capturedUrl = url;
    capturedOptions = options;
    return new Response(JSON.stringify(repositoryPayload()), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "x-ratelimit-limit": "60",
        "x-ratelimit-remaining": "59"
      }
    });
  };

  const client = new GitHubApiClient({ fetchImpl });
  const result = await client.getRepository(reference);

  assert.equal(capturedUrl.origin, githubApiConfiguration.origin);
  assert.equal(capturedUrl.pathname, "/repos/KSAGlory/KSA-Repository-Health");
  assert.equal(capturedOptions.method, "GET");
  assert.equal(capturedOptions.credentials, "omit");
  assert.equal(
    capturedOptions.headers["X-GitHub-Api-Version"],
    githubApiConfiguration.version
  );
  assert.equal(result.repository.fullName, "KSAGlory/KSA-Repository-Health");
  assert.equal(result.rateLimit.remaining, 59);
});

test("returns a specific error for a missing public repository", async () => {
  const client = new GitHubApiClient({
    fetchImpl: async () => new Response("{}", { status: 404 })
  });

  await assert.rejects(
    () => client.getRepository(reference),
    (error) => error instanceof GitHubApiError && error.code === "repository_not_found"
  );
});

test("returns rate-limit details for an exhausted request", async () => {
  const client = new GitHubApiClient({
    fetchImpl: async () => new Response("{}", {
      status: 403,
      headers: {
        "x-ratelimit-limit": "60",
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": "1788591600"
      }
    })
  });

  await assert.rejects(
    () => client.getRepository(reference),
    (error) => (
      error instanceof GitHubApiError &&
      error.code === "rate_limited" &&
      error.rateLimit.remaining === 0
    )
  );
});

test("rejects a response that claims the repository is private", async () => {
  const client = new GitHubApiClient({
    fetchImpl: async () => new Response(
      JSON.stringify(repositoryPayload({ private: true, visibility: "private" })),
      { status: 200, headers: { "content-type": "application/json" } }
    )
  });

  await assert.rejects(
    () => client.getRepository(reference),
    (error) => error instanceof GitHubApiError && error.code === "private_repository"
  );
});

test("does not expose a raw network failure", async () => {
  const client = new GitHubApiClient({
    fetchImpl: async () => {
      throw new Error("sensitive transport detail");
    }
  });

  await assert.rejects(
    () => client.getRepository(reference),
    (error) => (
      error instanceof GitHubApiError &&
      error.code === "network_error" &&
      !error.message.includes("sensitive transport detail")
    )
  );
});
