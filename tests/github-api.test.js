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
    homepage: "https://example.com",
    fork: false,
    license: { spdx_id: "MIT" },
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

test("reads Retry-After for a temporary rate limit", async () => {
  const client = new GitHubApiClient({
    fetchImpl: async () => new Response("{}", {
      status: 429,
      headers: {
        "x-ratelimit-limit": "60",
        "x-ratelimit-remaining": "12",
        "retry-after": "120"
      }
    })
  });

  await assert.rejects(
    () => client.getRepository(reference),
    (error) => (
      error instanceof GitHubApiError &&
      error.code === "rate_limited" &&
      error.rateLimit.retryAfterSeconds === 120
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

test("reports malformed JSON as an invalid GitHub response", async () => {
  const client = new GitHubApiClient({
    fetchImpl: async () => new Response("not-json", {
      status: 200,
      headers: { "content-type": "application/json" }
    })
  });

  await assert.rejects(
    () => client.getRepository(reference),
    (error) => error instanceof GitHubApiError && error.code === "invalid_response"
  );
});

test("reports a request timeout without exposing the transport error", async () => {
  const client = new GitHubApiClient({
    timeoutMs: 5,
    fetchImpl: async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new Error("raw timeout")), { once: true });
    })
  });

  await assert.rejects(
    () => client.getRepository(reference),
    (error) => (
      error instanceof GitHubApiError &&
      error.code === "timeout" &&
      !error.message.includes("raw timeout")
    )
  );
});

test("cancels a request when the caller aborts it", async () => {
  const controller = new AbortController();
  const client = new GitHubApiClient({
    fetchImpl: async (_url, options) => new Promise((_resolve, reject) => {
      const rejectCancellation = () => reject(new Error("cancelled transport"));
      if (options.signal.aborted) rejectCancellation();
      else options.signal.addEventListener("abort", rejectCancellation, { once: true });
    })
  });

  const request = client.getRepository(reference, { signal: controller.signal });
  controller.abort();
  await assert.rejects(
    () => request,
    (error) => error instanceof GitHubApiError && error.code === "cancelled"
  );
});

test("collects repository health evidence in no more than six requests", async () => {
  const requestedPaths = [];
  const fetchImpl = async (url) => {
    requestedPaths.push(`${url.pathname}${url.search}`);
    let data;

    if (url.pathname.endsWith("/community/profile")) {
      data = {
        health_percentage: 100,
        files: {
          readme: { url: "https://example.com/readme" },
          license: { url: "https://example.com/license" },
          contributing: { url: "https://example.com/contributing" },
          code_of_conduct: { url: "https://example.com/conduct" },
          issue_template: { url: "https://example.com/issues" },
          pull_request_template: { url: "https://example.com/pulls" },
          security: { url: "https://example.com/security" }
        }
      };
    } else if (url.pathname.endsWith("/releases")) {
      data = [{
        id: 10,
        tag_name: "v1.0.0",
        name: "First release",
        body: "Release notes",
        draft: false,
        prerelease: false,
        published_at: "2026-09-05T08:00:00Z"
      }];
    } else if (url.pathname.includes("/contents")) {
      data = [{ name: "README.md", path: "README.md", type: "file" }];
    } else {
      data = repositoryPayload();
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "x-ratelimit-limit": "60",
        "x-ratelimit-remaining": String(60 - requestedPaths.length)
      }
    });
  };

  const client = new GitHubApiClient({ fetchImpl });
  const result = await client.getRepositoryHealthData(reference);

  assert.equal(result.requestCount, 6);
  assert.equal(requestedPaths.length, 6);
  assert.deepEqual(result.sources, {
    repository: "available",
    community: "available",
    releases: "available",
    root: "available",
    github: "available",
    docs: "available"
  });
  assert.equal(result.communityProfile.files.security, true);
  assert.equal(result.releases[0].tagName, "v1.0.0");
  assert.equal(result.rateLimit.remaining, 54);
});

test("treats missing optional directories as resolved evidence", async () => {
  const fetchImpl = async (url) => {
    if (url.pathname.endsWith("/community/profile")) {
      return new Response("{}", { status: 404 });
    }
    if (url.pathname.endsWith("/releases")) {
      return new Response("[]", { status: 200 });
    }
    if (url.pathname.includes("/contents")) {
      return new Response("{}", { status: 404 });
    }
    return new Response(JSON.stringify(repositoryPayload()), { status: 200 });
  };

  const result = await new GitHubApiClient({ fetchImpl }).getRepositoryHealthData(reference);
  assert.equal(result.sources.community, "missing");
  assert.equal(result.sources.root, "missing");
  assert.equal(result.sources.github, "missing");
  assert.equal(result.sources.docs, "missing");
  assert.equal(result.failures.length, 0);
});

test("marks later evidence sources as skipped after an auxiliary failure", async () => {
  let requestNumber = 0;
  const fetchImpl = async () => {
    requestNumber += 1;
    if (requestNumber === 1) {
      return new Response(JSON.stringify(repositoryPayload()), { status: 200 });
    }
    return new Response("{}", { status: 500 });
  };

  const result = await new GitHubApiClient({ fetchImpl }).getRepositoryHealthData(reference);
  assert.equal(result.requestCount, 2);
  assert.equal(result.sources.community, "error");
  assert.equal(result.sources.releases, "skipped");
  assert.equal(result.sources.docs, "skipped");
  assert.equal(result.failures.length, 1);
});
