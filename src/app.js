import { GitHubApiClient, GitHubApiError } from "./github-api.js";
import {
  normalizeRepositoryReference,
  RepositoryReferenceError
} from "./repository-reference.js";

const elements = {
  form: document.querySelector("#repository-form"),
  input: document.querySelector("#repository-input"),
  inputError: document.querySelector("#repository-error"),
  readyPanel: document.querySelector("#ready-panel"),
  loadingPanel: document.querySelector("#loading-panel"),
  connectionResult: document.querySelector("#connection-result"),
  errorPanel: document.querySelector("#error-panel"),
  requestError: document.querySelector("#request-error"),
  rateLimitReset: document.querySelector("#rate-limit-reset"),
  connectionTitle: document.querySelector("#connection-title"),
  connectionDescription: document.querySelector("#connection-description"),
  detailVisibility: document.querySelector("#detail-visibility"),
  detailBranch: document.querySelector("#detail-branch"),
  detailUpdated: document.querySelector("#detail-updated"),
  detailRateLimit: document.querySelector("#detail-rate-limit"),
  repositoryLink: document.querySelector("#repository-link"),
  newReviewButton: document.querySelector("#new-review-button"),
  tryAgainButton: document.querySelector("#try-again-button"),
  themeButton: document.querySelector("#theme-button")
};

const client = new GitHubApiClient();
let activeRequest = null;
let explicitTheme = null;

function showOnly(activeElement) {
  [
    elements.readyPanel,
    elements.loadingPanel,
    elements.connectionResult,
    elements.errorPanel
  ].forEach((element) => {
    element.hidden = element !== activeElement;
  });
}

function clearInputError() {
  elements.input.removeAttribute("aria-invalid");
  elements.inputError.textContent = "";
  elements.inputError.hidden = true;
}

function showInputError(message) {
  elements.input.setAttribute("aria-invalid", "true");
  elements.inputError.textContent = message;
  elements.inputError.hidden = false;
  elements.input.focus();
}

function formatDate(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function formatRateLimit(rateLimit) {
  if (rateLimit.remaining === null || rateLimit.limit === null) {
    return "Not available";
  }

  return `${rateLimit.remaining} of ${rateLimit.limit} requests remaining`;
}

function displayRepository(reference, result) {
  const { repository, rateLimit } = result;
  elements.connectionTitle.textContent = repository.fullName;
  elements.connectionDescription.textContent = repository.description || "No repository description is available.";
  elements.detailVisibility.textContent = repository.visibility === "public" ? "Public" : repository.visibility;
  elements.detailBranch.textContent = repository.defaultBranch || "Not available";
  elements.detailUpdated.textContent = formatDate(repository.pushedAt || repository.updatedAt);
  elements.detailRateLimit.textContent = formatRateLimit(rateLimit);
  elements.repositoryLink.href = reference.githubUrl;
  showOnly(elements.connectionResult);
  elements.connectionResult.focus?.();
}

function displayRequestError(error) {
  elements.requestError.textContent = error.message;
  elements.rateLimitReset.hidden = true;
  elements.rateLimitReset.textContent = "";

  if (error.code === "rate_limited" && error.rateLimit?.resetAt) {
    elements.rateLimitReset.textContent = `GitHub expects to reset the allowance at ${formatDate(error.rateLimit.resetAt)}.`;
    elements.rateLimitReset.hidden = false;
  }

  showOnly(elements.errorPanel);
}

async function checkRepository(reference) {
  activeRequest?.abort();
  const requestController = new AbortController();
  activeRequest = requestController;
  showOnly(elements.loadingPanel);

  try {
    const result = await client.getRepository(reference, { signal: requestController.signal });
    displayRepository(reference, result);
  } catch (error) {
    if (error instanceof GitHubApiError && error.code === "cancelled") return;

    displayRequestError(
      error instanceof GitHubApiError
        ? error
        : new GitHubApiError("The repository could not be checked. Please try again.")
    );
  } finally {
    if (activeRequest === requestController) activeRequest = null;
  }
}

function resetReview() {
  activeRequest?.abort();
  activeRequest = null;
  clearInputError();
  showOnly(elements.readyPanel);
  elements.input.focus();
}

function applyTheme(theme) {
  explicitTheme = theme;
  if (theme) {
    document.documentElement.dataset.theme = theme;
  } else {
    delete document.documentElement.dataset.theme;
  }

  const isDark = theme
    ? theme === "dark"
    : window.matchMedia("(prefers-color-scheme: dark)").matches;
  elements.themeButton.setAttribute("aria-pressed", String(isDark));
  elements.themeButton.setAttribute("aria-label", isDark ? "Use light appearance" : "Use dark appearance");
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  clearInputError();

  try {
    const reference = normalizeRepositoryReference(elements.input.value);
    elements.input.value = reference.fullName;
    checkRepository(reference);
  } catch (error) {
    showInputError(
      error instanceof RepositoryReferenceError
        ? error.message
        : "Enter a valid GitHub repository URL or owner/repository."
    );
  }
});

elements.input.addEventListener("input", clearInputError);
elements.newReviewButton.addEventListener("click", resetReview);
elements.tryAgainButton.addEventListener("click", () => elements.form.requestSubmit());
elements.themeButton.addEventListener("click", () => {
  const currentlyDark = explicitTheme
    ? explicitTheme === "dark"
    : window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(currentlyDark ? "light" : "dark");
});

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (!explicitTheme) applyTheme(null);
});

applyTheme(null);
showOnly(elements.readyPanel);
