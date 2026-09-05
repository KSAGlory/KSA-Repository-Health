import test from "node:test";
import assert from "node:assert/strict";

import { analyzeRepositoryHealth } from "../src/health-analysis.js";

const now = new Date("2026-09-05T12:00:00Z");

function healthData(overrides = {}) {
  return {
    repository: {
      fullName: "KSAGlory/KSA-Repository-Health",
      description: "Professional repository review",
      homepage: "https://example.com",
      topics: ["github", "repository", "health"],
      license: "MIT",
      isArchived: false,
      isDisabled: false,
      pushedAt: "2026-09-01T12:00:00Z"
    },
    communityProfile: {
      files: {
        readme: true,
        license: true,
        contributing: true,
        codeOfConduct: true,
        issueTemplate: true,
        pullRequestTemplate: true,
        security: true
      }
    },
    releases: [{
      tagName: "v1.0.0",
      name: "First release",
      body: "Release notes",
      isDraft: false,
      publishedAt: "2026-09-01T12:00:00Z"
    }],
    directories: { root: [], github: [], docs: [] },
    sources: {
      repository: "available",
      community: "available",
      releases: "available",
      root: "available",
      github: "available",
      docs: "available"
    },
    ...overrides
  };
}

test("awards 100 points when every readiness check passes", () => {
  const analysis = analyzeRepositoryHealth(healthData(), { now });
  assert.equal(analysis.isComplete, true);
  assert.equal(analysis.score, 100);
  assert.equal(analysis.rating, "Excellent foundation");
  assert.equal(analysis.recommendations.length, 0);
  assert.equal(analysis.categories.reduce((sum, category) => sum + category.points, 0), 100);
});

test("scores partial topics and older activity without overstating them", () => {
  const data = healthData();
  data.repository = {
    ...data.repository,
    topics: ["github"],
    pushedAt: "2025-01-01T12:00:00Z"
  };
  data.releases = [{
    tagName: "v1.0.0",
    name: "",
    body: "",
    isDraft: false,
    publishedAt: "2026-09-01T12:00:00Z"
  }];

  const analysis = analyzeRepositoryHealth(data, { now });
  assert.equal(analysis.score, 90);
  assert.equal(analysis.checks.find((check) => check.id === "topics").state, "partial");
  assert.equal(analysis.checks.find((check) => check.id === "recent-activity").points, 3);
  assert.equal(analysis.checks.find((check) => check.id === "release-metadata").state, "missing");
});

test("prioritizes missing security, README, and license guidance", () => {
  const data = healthData({
    communityProfile: null,
    directories: { root: [], github: [], docs: [] },
    releases: []
  });
  data.repository = {
    ...data.repository,
    description: "",
    homepage: "",
    topics: [],
    license: null
  };

  const analysis = analyzeRepositoryHealth(data, { now });
  assert.equal(analysis.isComplete, true);
  assert.equal(analysis.recommendations[0].impact, "High priority");
  assert.ok(analysis.recommendations.some((item) => item.id === "security-policy"));
  assert.ok(analysis.recommendations.some((item) => item.id === "readme"));
  assert.ok(analysis.recommendations.some((item) => item.id === "license"));
});

test("returns an incomplete report when required evidence is unavailable", () => {
  const data = healthData({
    communityProfile: null,
    directories: { root: [], github: [], docs: [] },
    sources: {
      repository: "available",
      community: "error",
      releases: "skipped",
      root: "skipped",
      github: "skipped",
      docs: "skipped"
    },
    releases: []
  });
  data.repository = { ...data.repository, license: null };

  const analysis = analyzeRepositoryHealth(data, { now });
  assert.equal(analysis.isComplete, false);
  assert.equal(analysis.score, null);
  assert.equal(analysis.rating, "Incomplete report");
  assert.ok(analysis.unavailableChecks.includes("README"));
  assert.ok(analysis.unavailableChecks.includes("Published release"));
});

test("uses directory evidence when the community profile is unavailable for a fork", () => {
  const data = healthData({
    communityProfile: null,
    directories: {
      root: [{ name: "README.md" }, { name: "LICENSE" }],
      github: [
        { name: "CONTRIBUTING.md" },
        { name: "CODE_OF_CONDUCT.md" },
        { name: "ISSUE_TEMPLATE", type: "dir" },
        { name: "PULL_REQUEST_TEMPLATE.md" },
        { name: "SECURITY.md" }
      ],
      docs: []
    }
  });
  data.sources = { ...data.sources, community: "unsupported" };

  const analysis = analyzeRepositoryHealth(data, { now });
  assert.equal(analysis.isComplete, true);
  assert.equal(analysis.score, 100);
});
