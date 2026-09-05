import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeRepositoryReference,
  RepositoryReferenceError
} from "../src/repository-reference.js";

test("normalizes owner and repository shorthand", () => {
  assert.deepEqual(normalizeRepositoryReference("  KSAGlory/KSA-Repository-Health  "), {
    owner: "KSAGlory",
    repository: "KSA-Repository-Health",
    fullName: "KSAGlory/KSA-Repository-Health",
    githubUrl: "https://github.com/KSAGlory/KSA-Repository-Health"
  });
});

test("normalizes a standard HTTPS GitHub URL", () => {
  const reference = normalizeRepositoryReference(
    "https://github.com/KSAGlory/KSA-Repository-Health/"
  );

  assert.equal(reference.fullName, "KSAGlory/KSA-Repository-Health");
});

test("accepts a clone suffix and removes it", () => {
  const reference = normalizeRepositoryReference("KSAGlory/KSA-Repository-Health.git");
  assert.equal(reference.repository, "KSA-Repository-Health");
});

const invalidReferences = [
  "",
  "KSAGlory",
  "KSAGlory/repository/issues",
  "https://example.com/KSAGlory/repository",
  "http://github.com/KSAGlory/repository",
  "https://github.com/KSAGlory/repository/issues",
  "https://github.com/KSAGlory/repository?tab=readme",
  "https://github.com//KSAGlory/repository",
  "https://github.com/KSAGlory%2Frepository",
  "-invalid/repository",
  "owner-/repository",
  "owner/repository name"
];

for (const value of invalidReferences) {
  test(`rejects unsupported repository reference: ${value || "empty value"}`, () => {
    assert.throws(
      () => normalizeRepositoryReference(value),
      RepositoryReferenceError
    );
  });
}
