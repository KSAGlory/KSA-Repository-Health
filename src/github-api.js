const API_ORIGIN = "https://api.github.com";
const API_VERSION = "2026-03-10";
const DEFAULT_TIMEOUT_MS = 10000;

function parseInteger(value) {
  if (value === null || value === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseResetTime(value) {
  const seconds = parseInteger(value);
  return seconds === null ? null : new Date(seconds * 1000);
}

export function readRateLimit(headers) {
  return Object.freeze({
    limit: parseInteger(headers.get("x-ratelimit-limit")),
    remaining: parseInteger(headers.get("x-ratelimit-remaining")),
    used: parseInteger(headers.get("x-ratelimit-used")),
    resetAt: parseResetTime(headers.get("x-ratelimit-reset")),
    resource: headers.get("x-ratelimit-resource") || null,
    retryAfterSeconds: parseInteger(headers.get("retry-after"))
  });
}

export class GitHubApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "GitHubApiError";
    this.code = options.code || "github_api_error";
    this.status = options.status || null;
    this.rateLimit = options.rateLimit || null;
    this.cause = options.cause;
  }
}

function publicErrorFor(response, rateLimit) {
  if (response.status === 404) {
    return new GitHubApiError(
      "This public repository could not be found. Check the owner and repository name.",
      { code: "repository_not_found", status: 404, rateLimit }
    );
  }

  if (
    response.status === 429 ||
    (response.status === 403 && rateLimit.remaining === 0)
  ) {
    return new GitHubApiError(
      "GitHub's public API limit has been reached for this network. Try again after the reset time.",
      { code: "rate_limited", status: response.status, rateLimit }
    );
  }

  if (response.status === 403) {
    return new GitHubApiError(
      "GitHub could not provide this public repository information.",
      { code: "forbidden", status: 403, rateLimit }
    );
  }

  return new GitHubApiError(
    "GitHub could not complete the request. Please try again later.",
    { code: "request_failed", status: response.status, rateLimit }
  );
}

function normalizeRepositoryPayload(data) {
  if (!data || typeof data !== "object" || typeof data.full_name !== "string") {
    throw new GitHubApiError(
      "GitHub returned an unexpected response. Please try again later.",
      { code: "invalid_response" }
    );
  }

  return Object.freeze({
    id: data.id,
    fullName: data.full_name,
    owner: data.owner?.login || "",
    name: data.name || "",
    description: typeof data.description === "string" ? data.description : "",
    defaultBranch: typeof data.default_branch === "string" ? data.default_branch : "",
    visibility: typeof data.visibility === "string" ? data.visibility : "public",
    isPrivate: data.private === true,
    isArchived: data.archived === true,
    isDisabled: data.disabled === true,
    pushedAt: typeof data.pushed_at === "string" ? data.pushed_at : null,
    updatedAt: typeof data.updated_at === "string" ? data.updated_at : null,
    topics: Array.isArray(data.topics) ? data.topics.filter((topic) => typeof topic === "string") : [],
    hasIssues: data.has_issues === true,
    hasDiscussions: data.has_discussions === true,
    openIssuesAndPullRequests: Number.isFinite(data.open_issues_count)
      ? data.open_issues_count
      : null
  });
}

export class GitHubApiClient {
  constructor(options = {}) {
    this.fetch = options.fetchImpl || globalThis.fetch?.bind(globalThis);
    this.timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;

    if (typeof this.fetch !== "function") {
      throw new TypeError("A fetch implementation is required.");
    }
  }

  async getRepository(reference, options = {}) {
    const owner = encodeURIComponent(reference.owner);
    const repository = encodeURIComponent(reference.repository);
    const url = new URL(`/repos/${owner}/${repository}`, API_ORIGIN);
    const controller = new AbortController();
    let timedOut = false;
    let removeExternalAbort = () => {};

    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);

    if (options.signal) {
      const abortFromExternalSignal = () => controller.abort();
      if (options.signal.aborted) {
        abortFromExternalSignal();
      } else {
        options.signal.addEventListener("abort", abortFromExternalSignal, { once: true });
        removeExternalAbort = () => options.signal.removeEventListener("abort", abortFromExternalSignal);
      }
    }

    try {
      const response = await this.fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": API_VERSION
        },
        signal: controller.signal,
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        referrerPolicy: "no-referrer"
      });

      const rateLimit = readRateLimit(response.headers);
      if (!response.ok) {
        throw publicErrorFor(response, rateLimit);
      }

      const repositoryData = normalizeRepositoryPayload(await response.json());
      if (repositoryData.isPrivate) {
        throw new GitHubApiError(
          "Private repositories are not supported.",
          { code: "private_repository", status: response.status, rateLimit }
        );
      }

      return Object.freeze({ repository: repositoryData, rateLimit });
    } catch (error) {
      if (error instanceof GitHubApiError) throw error;

      if (controller.signal.aborted) {
        throw new GitHubApiError(
          timedOut
            ? "GitHub took too long to respond. Please try again."
            : "The repository check was cancelled.",
          { code: timedOut ? "timeout" : "cancelled", cause: error }
        );
      }

      throw new GitHubApiError(
        "GitHub could not be reached. Check your connection and try again.",
        { code: "network_error", cause: error }
      );
    } finally {
      clearTimeout(timeout);
      removeExternalAbort();
    }
  }
}

export const githubApiConfiguration = Object.freeze({
  origin: API_ORIGIN,
  version: API_VERSION,
  defaultTimeoutMs: DEFAULT_TIMEOUT_MS
});
