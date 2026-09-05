import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptsDirectory, "..");
const outputDirectory = resolve(projectRoot, "assets", "screenshots");
const applicationUrl = process.env.SCREENSHOT_URL
  ?? "https://ksaglory.github.io/KSA-Repository-Health/";

await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  colorScheme: "light",
  deviceScaleFactor: 1,
  reducedMotion: "reduce",
  viewport: { width: 1440, height: 1000 }
});
const page = await context.newPage();

try {
  await page.goto(applicationUrl, { waitUntil: "networkidle" });
  await page.locator(".app-shell").screenshot({
    animations: "disabled",
    path: resolve(outputDirectory, "home-light.png")
  });

  await page.locator("#repository-input").fill("KSAGlory/KSA-Repository-Health");
  await page.locator("#repository-form button[type='submit']").click();
  await page.locator("#connection-result").waitFor({ state: "visible", timeout: 30000 });

  await page.locator("#theme-button").click();
  const reportHeading = await page.locator(".result-heading").boundingBox();
  const reportOverview = await page.locator(".report-overview").boundingBox();
  if (!reportHeading || !reportOverview) {
    throw new Error("The report could not be positioned for its screenshot.");
  }

  await page.screenshot({
    animations: "disabled",
    clip: {
      x: reportHeading.x - 24,
      y: reportHeading.y - 24,
      width: reportHeading.width + 48,
      height: reportOverview.y + reportOverview.height - reportHeading.y + 24
    },
    path: resolve(outputDirectory, "report-dark.png")
  });
} finally {
  await browser.close();
}

process.stdout.write(`README screenshots saved in ${outputDirectory}\n`);
