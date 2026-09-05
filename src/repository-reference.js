const MAX_INPUT_LENGTH = 300;
const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const REPOSITORY_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

export class RepositoryReferenceError extends Error {
  constructor(message, code = "invalid_repository") {
    super(message);
    this.name = "RepositoryReferenceError";
    this.code = code;
  }
}

function fail(message) {
  throw new RepositoryReferenceError(message);
}

function validateSegments(owner, repository) {
  if (!OWNER_PATTERN.test(owner) || owner.includes("--")) {
    fail("Enter a valid GitHub owner and repository.");
  }

  const normalizedRepository = repository.toLowerCase().endsWith(".git")
    ? repository.slice(0, -4)
    : repository;

  if (
    !REPOSITORY_PATTERN.test(normalizedRepository) ||
    normalizedRepository === "." ||
    normalizedRepository === ".."
  ) {
    fail("Enter a valid GitHub owner and repository.");
  }

  return Object.freeze({
    owner,
    repository: normalizedRepository,
    fullName: `${owner}/${normalizedRepository}`,
    githubUrl: `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(normalizedRepository)}`
  });
}

function parseGitHubUrl(value) {
  let url;

  try {
    url = new URL(value);
  } catch {
    fail("Enter a valid GitHub repository URL.");
  }

  const hostname = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    !["github.com", "www.github.com"].includes(hostname) ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash ||
    url.pathname.includes("//") ||
    /%2f|%5c/i.test(url.pathname)
  ) {
    fail("Use a standard HTTPS GitHub repository URL without extra parameters.");
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length !== 2) {
    fail("Enter the repository page rather than a file, issue, or subpage.");
  }

  return validateSegments(segments[0], segments[1]);
}

export function normalizeRepositoryReference(input) {
  if (typeof input !== "string") {
    fail("Enter a GitHub repository URL or owner/repository.");
  }

  const value = input.trim();
  if (!value || value.length > MAX_INPUT_LENGTH) {
    fail("Enter a GitHub repository URL or owner/repository.");
  }

  if (/^https?:\/\//i.test(value)) {
    return parseGitHubUrl(value);
  }

  if (value.includes("?") || value.includes("#") || /%2f|%5c/i.test(value)) {
    fail("Enter a valid owner/repository value without extra parameters.");
  }

  const segments = value.split("/");
  if (segments.length !== 2) {
    fail("Use the owner/repository format.");
  }

  return validateSegments(segments[0], segments[1]);
}
