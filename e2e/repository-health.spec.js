import { expect, test } from "@playwright/test";

const repository = {
  id: 100,
  full_name: "example/repository-health",
  name: "repository-health",
  owner: { login: "example" },
  description: "<img src=x onerror=window.__unsafe=true> Public repository review",
  homepage: "https://example.com",
  default_branch: "main",
  visibility: "public",
  private: false,
  archived: false,
  disabled: false,
  fork: false,
  pushed_at: "2026-09-05T10:00:00Z",
  updated_at: "2026-09-05T10:00:00Z",
  topics: ["github", "repository", "quality"],
  has_issues: true,
  has_discussions: false,
  license: { spdx_id: "MIT" },
  open_issues_count: 1
};

const community = {
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

function headers(remaining) {
  return {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-expose-headers": "X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After",
    "x-ratelimit-limit": "60",
    "x-ratelimit-remaining": String(remaining)
  };
}

async function mockCompleteRepository(page) {
  let requestCount = 0;
  await page.route("https://api.github.com/**", async (route) => {
    requestCount += 1;
    const url = new URL(route.request().url());
    const responseHeaders = headers(60 - requestCount);

    if (url.pathname.endsWith("/community/profile")) {
      return route.fulfill({ status: 200, headers: responseHeaders, body: JSON.stringify(community) });
    }
    if (url.pathname.endsWith("/releases")) {
      return route.fulfill({
        status: 200,
        headers: responseHeaders,
        body: JSON.stringify([{
          id: 1,
          tag_name: "v1.0.0",
          name: "Version 1.0.0",
          body: "Initial release",
          draft: false,
          prerelease: false,
          published_at: "2026-09-05T10:00:00Z"
        }])
      });
    }
    if (url.pathname.includes("/contents")) {
      return route.fulfill({ status: 200, headers: responseHeaders, body: "[]" });
    }
    return route.fulfill({ status: 200, headers: responseHeaders, body: JSON.stringify(repository) });
  });
  return () => requestCount;
}

test("completes a safe, keyboard-accessible repository review", async ({ page }) => {
  const requestCount = await mockCompleteRepository(page);
  await page.goto("/");

  const input = page.locator("#repository-input");
  await input.fill("example/repository-health");
  await input.press("Tab");
  await expect(page.locator("button[type='submit']")).toBeFocused();
  await page.locator("button[type='submit']").press("Enter");

  const report = page.locator("#connection-result");
  await expect(report).toBeVisible();
  await expect(report).toBeFocused();
  await expect(page.locator("#score-value")).toHaveText("100");
  await expect(page.locator(".category-check-list li")).toHaveCount(15);
  expect(requestCount()).toBe(6);

  await expect(page.locator("#connection-description")).toHaveText(repository.description);
  await expect(page.locator("#connection-description img")).toHaveCount(0);
  expect(await page.evaluate(() => window.__unsafe === true)).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);

  await page.locator("#theme-button").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("#theme-button")).toHaveAttribute("aria-label", "Use light appearance");
});

test("explains GitHub's temporary rate limit", async ({ page }) => {
  await page.route("https://api.github.com/**", (route) => route.fulfill({
    status: 429,
    headers: { ...headers(12), "retry-after": "120" },
    body: "{}"
  }));
  await page.goto("/");
  await page.locator("#repository-input").fill("example/repository-health");
  await page.locator("button[type='submit']").click();

  await expect(page.locator("#error-panel")).toBeVisible();
  await expect(page.locator("#request-error")).toContainText("public API limit");
  await expect(page.locator("#rate-limit-reset")).toContainText("about 2 minutes");
});

test("provides a specific offline recovery message", async ({ context, page }) => {
  await page.goto("/");
  await context.setOffline(true);
  await page.locator("#repository-input").fill("example/repository-health");
  await page.locator("button[type='submit']").click();

  await expect(page.locator("#error-panel")).toBeVisible();
  await expect(page.locator("#request-error")).toHaveText(
    "You appear to be offline. Reconnect to the internet and try again."
  );
});
