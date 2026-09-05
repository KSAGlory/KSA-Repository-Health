const DAY_MS = 24 * 60 * 60 * 1000;

const GUIDANCE = Object.freeze({
  readme: "https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes",
  license: "https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/adding-a-license-to-a-repository",
  contributing: "https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/setting-guidelines-for-repository-contributors",
  codeOfConduct: "https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/adding-a-code-of-conduct-to-your-project",
  issueTemplate: "https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/configuring-issue-templates-for-your-repository",
  pullRequestTemplate: "https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/creating-a-pull-request-template-for-your-repository",
  security: "https://docs.github.com/en/code-security/getting-started/adding-a-security-policy-to-your-repository",
  release: "https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository",
  repositorySettings: "https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/managing-repository-settings"
});

const CATEGORY_DEFINITIONS = Object.freeze([
  ["documentation", "Project documentation", 30],
  ["contribution", "Contribution readiness", 20],
  ["security", "Security and licensing", 20],
  ["maintenance", "Maintenance", 15],
  ["release", "Release readiness", 15]
]);

function normalizedNames(entries) {
  return new Set((entries || []).map((entry) => entry.name.toUpperCase()));
}

function hasName(names, patterns) {
  return [...names].some((name) => patterns.some((pattern) => pattern.test(name)));
}

function isResolved(source) {
  return source === "available" || source === "missing" || source === "unsupported";
}

function makeCheck({ id, category, label, points, maxPoints, state, recommendation, impact, guidance }) {
  return Object.freeze({
    id,
    category,
    label,
    points,
    maxPoints,
    state,
    recommendation,
    impact,
    guidance
  });
}

function evidenceState(detected, available) {
  if (detected) return "pass";
  return available ? "missing" : "unavailable";
}

function scoreLabel(score) {
  if (score >= 90) return "Excellent foundation";
  if (score >= 75) return "Strong foundation";
  if (score >= 55) return "Developing foundation";
  return "Important essentials missing";
}

function summarize(score, missingCount) {
  if (score >= 90) return "The repository presents a complete, professional foundation for users and contributors.";
  if (score >= 75) return `The repository has a strong public foundation with ${missingCount} practical improvement${missingCount === 1 ? "" : "s"} remaining.`;
  if (score >= 55) return `The repository covers several essentials, but ${missingCount} improvements would make it easier to trust and contribute to.`;
  return `Several public-facing essentials need attention before this repository is ready to present broadly.`;
}

export function analyzeRepositoryHealth(data, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const { repository, communityProfile, releases, directories, sources } = data;
  const community = communityProfile?.files || {};
  const rootNames = normalizedNames(directories.root);
  const githubNames = normalizedNames(directories.github);
  const docsNames = normalizedNames(directories.docs);
  const allNames = new Set([...rootNames, ...githubNames, ...docsNames]);

  const directoryEvidenceAvailable = [sources.root, sources.github, sources.docs].every(isResolved);
  const communityEvidenceAvailable = sources.community === "available";
  const fileEvidenceAvailable = communityEvidenceAvailable || directoryEvidenceAvailable;

  const detected = {
    readme: Boolean(community.readme) || hasName(allNames, [/^README(?:\.|$)/]),
    license: Boolean(community.license) || Boolean(repository.license) || hasName(allNames, [/^LICENSE(?:\.|$)/, /^COPYING(?:\.|$)/]),
    contributing: Boolean(community.contributing) || hasName(allNames, [/^CONTRIBUTING(?:\.|$)/]),
    codeOfConduct: Boolean(community.codeOfConduct) || hasName(allNames, [/^CODE[-_ ]OF[-_ ]CONDUCT(?:\.|$)/]),
    issueTemplate: Boolean(community.issueTemplate) || hasName(githubNames, [/^ISSUE_TEMPLATE(?:\.|$)/]),
    pullRequestTemplate: Boolean(community.pullRequestTemplate) || hasName(allNames, [/^PULL_REQUEST_TEMPLATE(?:\.|$)/]),
    security: Boolean(community.security) || hasName(allNames, [/^SECURITY(?:\.|$)/])
  };

  const checks = [];
  const addFileCheck = (config, evidenceKey) => {
    const state = evidenceState(detected[evidenceKey], fileEvidenceAvailable);
    checks.push(makeCheck({
      ...config,
      points: state === "pass" ? config.maxPoints : 0,
      state
    }));
  };

  addFileCheck({
    id: "readme", category: "documentation", label: "README", maxPoints: 12,
    recommendation: "Add a README that explains the project, its purpose, setup, and basic use.",
    impact: "High priority", guidance: GUIDANCE.readme
  }, "readme");

  const hasDescription = repository.description.trim().length > 0;
  checks.push(makeCheck({
    id: "description", category: "documentation", label: "Repository description",
    points: hasDescription ? 8 : 0, maxPoints: 8, state: hasDescription ? "pass" : "missing",
    recommendation: "Add a concise repository description so visitors understand the project immediately.",
    impact: "Helpful", guidance: GUIDANCE.repositorySettings
  }));

  const hasHomepage = repository.homepage.trim().length > 0;
  checks.push(makeCheck({
    id: "homepage", category: "documentation", label: "Project website",
    points: hasHomepage ? 4 : 0, maxPoints: 4, state: hasHomepage ? "pass" : "missing",
    recommendation: "Add a project website or product page to the repository details.",
    impact: "Helpful", guidance: GUIDANCE.repositorySettings
  }));

  const topicCount = repository.topics.length;
  checks.push(makeCheck({
    id: "topics", category: "documentation", label: "Repository topics",
    points: topicCount >= 3 ? 6 : topicCount > 0 ? 3 : 0,
    maxPoints: 6,
    state: topicCount >= 3 ? "pass" : topicCount > 0 ? "partial" : "missing",
    recommendation: topicCount > 0
      ? "Add at least three focused topics to improve repository discovery."
      : "Add focused repository topics to improve discovery and provide context.",
    impact: "Helpful", guidance: GUIDANCE.repositorySettings
  }));

  addFileCheck({
    id: "contributing", category: "contribution", label: "Contributing guide", maxPoints: 5,
    recommendation: "Add contribution guidelines that explain how people can propose changes.",
    impact: "Medium priority", guidance: GUIDANCE.contributing
  }, "contributing");
  addFileCheck({
    id: "code-of-conduct", category: "contribution", label: "Code of conduct", maxPoints: 5,
    recommendation: "Add a code of conduct to set clear expectations for community participation.",
    impact: "Medium priority", guidance: GUIDANCE.codeOfConduct
  }, "codeOfConduct");
  addFileCheck({
    id: "issue-template", category: "contribution", label: "Issue template", maxPoints: 5,
    recommendation: "Add an issue template or form to collect useful reports consistently.",
    impact: "Medium priority", guidance: GUIDANCE.issueTemplate
  }, "issueTemplate");
  addFileCheck({
    id: "pull-request-template", category: "contribution", label: "Pull request template", maxPoints: 5,
    recommendation: "Add a pull request template to make proposed changes easier to review.",
    impact: "Medium priority", guidance: GUIDANCE.pullRequestTemplate
  }, "pullRequestTemplate");

  addFileCheck({
    id: "security-policy", category: "security", label: "Security policy", maxPoints: 10,
    recommendation: "Add a security policy with a private process for reporting vulnerabilities.",
    impact: "High priority", guidance: GUIDANCE.security
  }, "security");
  const licenseAvailable = Boolean(repository.license) || communityEvidenceAvailable || directoryEvidenceAvailable;
  const licenseState = evidenceState(detected.license, licenseAvailable);
  checks.push(makeCheck({
    id: "license", category: "security", label: "Detected license",
    points: licenseState === "pass" ? 10 : 0, maxPoints: 10, state: licenseState,
    recommendation: "Add a license so users understand the terms for using and contributing to the project.",
    impact: "High priority", guidance: GUIDANCE.license
  }));

  checks.push(makeCheck({
    id: "not-archived", category: "maintenance", label: "Repository is not archived",
    points: repository.isArchived ? 0 : 5, maxPoints: 5, state: repository.isArchived ? "missing" : "pass",
    recommendation: "If development continues, restore the repository from archived status or clearly direct visitors to its successor.",
    impact: "High priority", guidance: GUIDANCE.repositorySettings
  }));
  checks.push(makeCheck({
    id: "not-disabled", category: "maintenance", label: "Repository is enabled",
    points: repository.isDisabled ? 0 : 5, maxPoints: 5, state: repository.isDisabled ? "missing" : "pass",
    recommendation: "Resolve the disabled repository status before presenting the project publicly.",
    impact: "High priority", guidance: GUIDANCE.repositorySettings
  }));

  const pushedAt = repository.pushedAt ? new Date(repository.pushedAt) : null;
  const activityAge = pushedAt && !Number.isNaN(pushedAt.getTime())
    ? Math.max(0, now.getTime() - pushedAt.getTime()) / DAY_MS
    : Number.POSITIVE_INFINITY;
  const activityPoints = activityAge <= 365 ? 5 : activityAge <= 730 ? 3 : 0;
  checks.push(makeCheck({
    id: "recent-activity", category: "maintenance", label: "Recent repository activity",
    points: activityPoints, maxPoints: 5,
    state: activityPoints === 5 ? "pass" : activityPoints === 3 ? "partial" : "missing",
    recommendation: activityPoints === 3
      ? "Review the repository details and publish a maintenance update if the project remains active."
      : "Clarify whether the project is maintained and update the repository if work is continuing.",
    impact: "Medium priority", guidance: GUIDANCE.repositorySettings
  }));

  const releasesAvailable = sources.releases === "available";
  const publishedRelease = (releases || []).find((release) => !release.isDraft && Boolean(release.publishedAt));
  const releaseState = evidenceState(Boolean(publishedRelease), releasesAvailable);
  checks.push(makeCheck({
    id: "published-release", category: "release", label: "Published release",
    points: releaseState === "pass" ? 10 : 0, maxPoints: 10, state: releaseState,
    recommendation: "Publish a release so users can identify a stable, documented version.",
    impact: "Medium priority", guidance: GUIDANCE.release
  }));
  const hasReleaseMetadata = Boolean(publishedRelease && (publishedRelease.name.trim() || publishedRelease.body.trim()));
  const metadataState = publishedRelease
    ? (hasReleaseMetadata ? "pass" : "missing")
    : (releasesAvailable ? "missing" : "unavailable");
  checks.push(makeCheck({
    id: "release-metadata", category: "release", label: "Release notes or title",
    points: metadataState === "pass" ? 5 : 0, maxPoints: 5, state: metadataState,
    recommendation: "Give the published release a clear title or release notes that explain what changed.",
    impact: "Medium priority", guidance: GUIDANCE.release
  }));

  const unavailableChecks = checks.filter((check) => check.state === "unavailable");
  const isComplete = unavailableChecks.length === 0;
  const earnedPoints = checks.reduce((total, check) => total + check.points, 0);
  const score = isComplete ? earnedPoints : null;
  const missingChecks = checks.filter((check) => check.state === "missing" || check.state === "partial");
  const impactOrder = { "High priority": 0, "Medium priority": 1, Helpful: 2 };
  const recommendations = missingChecks
    .map((check) => Object.freeze({
      id: check.id,
      label: check.label,
      text: check.recommendation,
      impact: check.impact,
      guidance: check.guidance,
      availablePoints: check.maxPoints - check.points
    }))
    .sort((left, right) => (
      impactOrder[left.impact] - impactOrder[right.impact] ||
      right.availablePoints - left.availablePoints
    ));

  const strengths = checks
    .filter((check) => check.state === "pass")
    .map((check) => Object.freeze({ id: check.id, label: check.label }));

  const categories = CATEGORY_DEFINITIONS.map(([id, label, maxPoints]) => {
    const categoryChecks = checks.filter((check) => check.category === id);
    const available = categoryChecks.every((check) => check.state !== "unavailable");
    return Object.freeze({
      id,
      label,
      maxPoints,
      points: categoryChecks.reduce((total, check) => total + check.points, 0),
      available
    });
  });

  return Object.freeze({
    isComplete,
    score,
    earnedPoints,
    rating: isComplete ? scoreLabel(score) : "Incomplete report",
    summary: isComplete
      ? summarize(score, missingChecks.length)
      : "Some GitHub data could not be retrieved. Available findings are shown, but no readiness score is calculated.",
    checks: Object.freeze(checks),
    categories: Object.freeze(categories),
    recommendations: Object.freeze(recommendations),
    strengths: Object.freeze(strengths),
    unavailableChecks: Object.freeze(unavailableChecks.map((check) => check.label)),
    detectedEssentials: strengths.length
  });
}

export const healthAnalysisGuidance = GUIDANCE;
