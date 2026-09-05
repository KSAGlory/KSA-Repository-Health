import { GitHubApiClient, GitHubApiError } from "./github-api.js";
import { analyzeRepositoryHealth } from "./health-analysis.js";
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
  reportStatus: document.querySelector("#report-status"),
  reportStatusText: document.querySelector("#report-status-text"),
  scoreValue: document.querySelector("#score-value"),
  scoreTotal: document.querySelector("#score-total"),
  scoreRating: document.querySelector("#score-rating"),
  scoreSummary: document.querySelector("#score-summary"),
  scoreProgress: document.querySelector("#score-progress"),
  scoreProgressFill: document.querySelector("#score-progress-fill"),
  detectedCount: document.querySelector("#detected-count"),
  recommendationCount: document.querySelector("#recommendation-count"),
  requestCount: document.querySelector("#request-count"),
  recommendationBadge: document.querySelector("#recommendation-badge"),
  recommendationList: document.querySelector("#recommendation-list"),
  categoryList: document.querySelector("#category-list"),
  strengthList: document.querySelector("#strength-list"),
  incompleteNotice: document.querySelector("#incomplete-notice"),
  incompleteDescription: document.querySelector("#incomplete-description"),
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

function appendRecommendation(recommendation, index) {
  const item = document.createElement("article");
  item.className = "recommendation-item";

  const number = document.createElement("span");
  number.className = "recommendation-number";
  number.textContent = String(index + 1);
  number.setAttribute("aria-hidden", "true");

  const content = document.createElement("div");
  const meta = document.createElement("p");
  meta.className = "recommendation-impact";
  meta.textContent = `${recommendation.impact} · ${recommendation.availablePoints} point${recommendation.availablePoints === 1 ? "" : "s"} available`;
  const title = document.createElement("h4");
  title.textContent = recommendation.label;
  const description = document.createElement("p");
  description.textContent = recommendation.text;
  const link = document.createElement("a");
  link.href = recommendation.guidance;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "View GitHub guidance";

  content.append(meta, title, description, link);
  item.append(number, content);
  elements.recommendationList.append(item);
}

function renderRecommendations(recommendations) {
  elements.recommendationList.replaceChildren();
  elements.recommendationBadge.textContent = String(recommendations.length);

  if (recommendations.length === 0) {
    const empty = document.createElement("p");
    empty.className = "positive-empty-state";
    empty.textContent = "All scored repository-readiness checks passed.";
    elements.recommendationList.append(empty);
    return;
  }

  recommendations.forEach(appendRecommendation);
}

function renderCategories(categories) {
  elements.categoryList.replaceChildren();
  categories.forEach((category) => {
    const item = document.createElement("div");
    item.className = "category-item";
    const heading = document.createElement("div");
    const label = document.createElement("span");
    label.textContent = category.label;
    const score = document.createElement("strong");
    score.textContent = category.available
      ? `${category.points} / ${category.maxPoints}`
      : "Incomplete";
    heading.append(label, score);

    const track = document.createElement("span");
    track.className = "category-progress";
    const fill = document.createElement("span");
    fill.style.width = category.available
      ? `${Math.round((category.points / category.maxPoints) * 100)}%`
      : "0%";
    track.append(fill);
    item.append(heading, track);
    elements.categoryList.append(item);
  });
}

function renderStrengths(strengths) {
  elements.strengthList.replaceChildren();

  if (strengths.length === 0) {
    const item = document.createElement("li");
    item.className = "muted-list-item";
    item.textContent = "No completed readiness checks were detected in the available data.";
    elements.strengthList.append(item);
    return;
  }

  strengths.forEach((strength) => {
    const item = document.createElement("li");
    const mark = document.createElement("span");
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = "✓";
    const label = document.createElement("span");
    label.textContent = strength.label;
    item.append(mark, label);
    elements.strengthList.append(item);
  });
}

function displayRepository(reference, result) {
  const { repository, rateLimit, requestCount } = result;
  const analysis = analyzeRepositoryHealth(result);
  elements.connectionTitle.textContent = repository.fullName;
  elements.connectionDescription.textContent = repository.description || "No repository description is available.";
  elements.reportStatus.classList.toggle("incomplete", !analysis.isComplete);
  elements.reportStatusText.textContent = analysis.isComplete ? "Review complete" : "Review incomplete";
  elements.scoreValue.textContent = analysis.isComplete ? String(analysis.score) : "Incomplete";
  elements.scoreValue.classList.toggle("score-word", !analysis.isComplete);
  elements.scoreTotal.hidden = !analysis.isComplete;
  elements.scoreRating.textContent = analysis.rating;
  elements.scoreSummary.textContent = analysis.summary;
  elements.scoreProgress.hidden = !analysis.isComplete;
  if (analysis.isComplete) {
    elements.scoreProgress.setAttribute("aria-valuenow", String(analysis.score));
    elements.scoreProgressFill.style.width = `${analysis.score}%`;
  } else {
    elements.scoreProgress.removeAttribute("aria-valuenow");
    elements.scoreProgressFill.style.width = "0%";
  }
  elements.detectedCount.textContent = String(analysis.detectedEssentials);
  elements.recommendationCount.textContent = String(analysis.recommendations.length);
  elements.requestCount.textContent = String(requestCount);
  elements.detailVisibility.textContent = repository.visibility === "public" ? "Public" : repository.visibility;
  elements.detailBranch.textContent = repository.defaultBranch || "Not available";
  elements.detailUpdated.textContent = formatDate(repository.pushedAt || repository.updatedAt);
  elements.detailRateLimit.textContent = formatRateLimit(rateLimit);
  elements.repositoryLink.href = reference.githubUrl;
  elements.incompleteNotice.hidden = analysis.isComplete;
  elements.incompleteDescription.textContent = analysis.isComplete
    ? ""
    : `${analysis.unavailableChecks.join(", ")} could not be verified. Try again later for a complete score.`;
  renderRecommendations(analysis.recommendations);
  renderCategories(analysis.categories);
  renderStrengths(analysis.strengths);
  showOnly(elements.connectionResult);
  elements.connectionResult.focus();
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
    const result = await client.getRepositoryHealthData(reference, { signal: requestController.signal });
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
