import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptsDirectory, "..");
const outputDirectory = resolve(projectRoot, "dist");

const filesToPublish = [
  "index.html",
  "assets",
  "src",
  "LICENSE",
  "PRIVACY.md",
  "SECURITY.md",
  "SUPPORT.md"
];

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

for (const item of filesToPublish) {
  await cp(resolve(projectRoot, item), resolve(outputDirectory, item), {
    recursive: true
  });
}

process.stdout.write(`Production files prepared in ${outputDirectory}\n`);
