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
    homepage: typeof data.homepage === "string" ? data.homepage : "",
    defaultBranch: typeof data.default_branch === "string" ? data.default_branch : "",
    visibility: typeof data.visibility === "string" ? data.visibility : "public",
    isPrivate: data.private === true,
    isArchived: data.archived === true,
    isDisabled: data.disabled === true,
    isFork: data.fork === true,
    pushedAt: typeof data.pushed_at === "string" ? data.pushed_at : null,
    updatedAt: typeof data.updated_at === "string" ? data.updated_at : null,
    topics: Array.isArray(data.topics) ? data.topics.filter((topic) => typeof topic === "string") : [],
    hasIssues: data.has_issues === true,
    hasDiscussions: data.has_discussions === true,
    license: typeof data.license?.spdx_id === "string" ? data.license.spdx_id : null,
    openIssuesAndPullRequests: Number.isFinite(data.open_issues_count)
      ? data.open_issues_count
      : null
  });
}

function normalizeCommunityProfile(data) {
  if (!data || typeof data !== "object" || typeof data.files !== "object") {
    throw new GitHubApiError(
      "GitHub returned unexpected community-profile data.",
      { code: "invalid_response" }
    );
  }

  return Object.freeze({
    healthPercentage: Number.isFinite(data.health_percentage)
      ? data.health_percentage
      : null,
    files: Object.freeze({
      readme: Boolean(data.files.readme),
      license: Boolean(data.files.license),
      contributing: Boolean(data.files.contributing),
      codeOfConduct: Boolean(data.files.code_of_conduct || data.files.code_of_conduct_file),
      issueTemplate: Boolean(data.files.issue_template),
      pullRequestTemplate: Boolean(data.files.pull_request_template),
      security: Boolean(data.files.security)
    })
  });
}

function normalizeDirectory(data) {
  if (!Array.isArray(data)) {
    throw new GitHubApiError(
      "GitHub returned unexpected repository-content data.",
      { code: "invalid_response" }
    );
  }

  return Object.freeze(data
    .filter((entry) => entry && typeof entry.name === "string")
    .map((entry) => Object.freeze({
      name: entry.name,
      path: typeof entry.path === "string" ? entry.path : entry.name,
      type: typeof entry.type === "string" ? entry.type : "file"
    })));
}

function normalizeReleases(data) {
  if (!Array.isArray(data)) {
    throw new GitHubApiError(
      "GitHub returned unexpected release data.",
      { code: "invalid_response" }
    );
  }

  return Object.freeze(data.map((release) => Object.freeze({
    id: release.id,
    tagName: typeof release.tag_name === "string" ? release.tag_name : "",
    name: typeof release.name === "string" ? release.name : "",
    body: typeof release.body === "string" ? release.body : "",
    isDraft: release.draft === true,
    isPrerelease: release.prerelease === true,
    publishedAt: typeof release.published_at === "string" ? release.published_at : null
  })));
}

function repositoryPath(reference, suffix = "") {
  const owner = encodeURIComponent(reference.owner);
  const repository = encodeURIComponent(reference.repository);
  return `/repos/${owner}/${repository}${suffix}`;
}

export class GitHubApiClient {
  constructor(options = {}) {
    this.fetch = options.fetchImpl || globalThis.fetch?.bind(globalThis);
    this.timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;

    if (typeof this.fetch !== "function") {
      throw new TypeError("A fetch implementation is required.");
    }
  }

  async requestJson(path, options = {}) {
    const url = new URL(path, API_ORIGIN);
    if (url.origin !== API_ORIGIN || !url.pathname.startsWith("/repos/")) {
      throw new TypeError("Only GitHub repository API paths are supported.");
    }

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
      if (options.allowNotFound && response.status === 404) {
        return Object.freeze({ data: null, rateLimit, notFound: true });
      }

      if (!response.ok) {
        throw publicErrorFor(response, rateLimit);
      }

      const data = await response.json();
      return Object.freeze({ data, rateLimit, notFound: false });
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

  async getRepository(reference, options = {}) {
    const response = await this.requestJson(repositoryPath(reference), options);
    const repositoryData = normalizeRepositoryPayload(response.data);
    if (repositoryData.isPrivate) {
      throw new GitHubApiError(
        "Private repositories are not supported.",
        { code: "private_repository", status: 200, rateLimit: response.rateLimit }
      );
    }

    return Object.freeze({ repository: repositoryData, rateLimit: response.rateLimit });
  }

  async getCommunityProfile(reference, options = {}) {
    const response = await this.requestJson(
      repositoryPath(reference, "/community/profile"),
      { ...options, allowNotFound: true }
    );
    return Object.freeze({
      communityProfile: response.notFound ? null : normalizeCommunityProfile(response.data),
      rateLimit: response.rateLimit,
      notFound: response.notFound
    });
  }

  async listReleases(reference, options = {}) {
    const response = await this.requestJson(
      repositoryPath(reference, "/releases?per_page=1&page=1"),
      options
    );
    return Object.freeze({
      releases: normalizeReleases(response.data),
      rateLimit: response.rateLimit
    });
  }

  async listDirectory(reference, directory, options = {}) {
    const encodedDirectory = directory
      ? `/${directory.split("/").map(encodeURIComponent).join("/")}`
      : "";
    const response = await this.requestJson(
      repositoryPath(reference, `/contents${encodedDirectory}`),
      { ...options, allowNotFound: true }
    );
    return Object.freeze({
      entries: response.notFound ? [] : normalizeDirectory(response.data),
      rateLimit: response.rateLimit,
      notFound: response.notFound
    });
  }

  async getRepositoryHealthData(reference, options = {}) {
    const core = await this.getRepository(reference, options);
    const result = {
      repository: core.repository,
      communityProfile: null,
      releases: [],
      directories: { root: [], github: [], docs: [] },
      sources: {
        repository: "available",
        community: "pending",
        releases: "pending",
        root: "pending",
        github: "pending",
        docs: "pending"
      },
      failures: [],
      rateLimit: core.rateLimit,
      requestCount: 1
    };

    const steps = [
      {
        source: "community",
        run: () => this.getCommunityProfile(reference, options),
        apply: (value) => {
          result.communityProfile = value.communityProfile;
          result.sources.community = value.notFound
            ? (core.repository.isFork ? "unsupported" : "missing")
            : "available";
        }
      },
      {
        source: "releases",
        run: () => this.listReleases(reference, options),
        apply: (value) => {
          result.releases = value.releases;
          result.sources.releases = "available";
        }
      },
      {
        source: "root",
        run: () => this.listDirectory(reference, "", options),
        apply: (value) => {
          result.directories.root = value.entries;
          result.sources.root = value.notFound ? "missing" : "available";
        }
      },
      {
        source: "github",
        run: () => this.listDirectory(reference, ".github", options),
        apply: (value) => {
          result.directories.github = value.entries;
          result.sources.github = value.notFound ? "missing" : "available";
        }
      },
      {
        source: "docs",
        run: () => this.listDirectory(reference, "docs", options),
        apply: (value) => {
          result.directories.docs = value.entries;
          result.sources.docs = value.notFound ? "missing" : "available";
        }
      }
    ];

    for (let index = 0; index < steps.length; index += 1) {
      const step = steps[index];
      try {
        result.requestCount += 1;
        const value = await step.run();
        result.rateLimit = value.rateLimit;
        step.apply(value);
      } catch (error) {
        if (error instanceof GitHubApiError && error.code === "cancelled") throw error;

        result.sources[step.source] = "error";
        result.failures.push(Object.freeze({
          source: step.source,
          code: error instanceof GitHubApiError ? error.code : "unexpected_error",
          message: error instanceof Error ? error.message : "GitHub data was unavailable."
        }));
        if (error instanceof GitHubApiError && error.rateLimit) {
          result.rateLimit = error.rateLimit;
        }

        for (const remainingStep of steps.slice(index + 1)) {
          result.sources[remainingStep.source] = "skipped";
        }
        break;
      }
    }

    return Object.freeze({
      ...result,
      directories: Object.freeze(result.directories),
      sources: Object.freeze(result.sources),
      failures: Object.freeze(result.failures)
    });
  }
}

export const githubApiConfiguration = Object.freeze({
  origin: API_ORIGIN,
  version: API_VERSION,
  defaultTimeoutMs: DEFAULT_TIMEOUT_MS
});
