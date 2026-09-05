import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptsDirectory, "..");
const port = Number.parseInt(process.env.KSA_REPOSITORY_HEALTH_PORT || "4173", 10);

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"],
  [".svg", "image/svg+xml"]
]);

const securityHeaders = {
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'self'; connect-src https://api.github.com; img-src 'self' data:; style-src 'self'; script-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff"
};

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, {
    ...securityHeaders,
    "Content-Type": "text/plain; charset=utf-8"
  });
  response.end(message);
}

createServer(async (request, response) => {
  if (!request.url || !["GET", "HEAD"].includes(request.method || "")) {
    sendText(response, 405, "Method not allowed");
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  } catch {
    sendText(response, 400, "Invalid request");
    return;
  }

  const requestedPath = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = resolve(projectRoot, requestedPath);
  const relativePath = relative(projectRoot, filePath);

  if (relativePath.startsWith(`..${sep}`) || relativePath === "..") {
    sendText(response, 403, "Forbidden");
    return;
  }

  try {
    const fileInformation = await stat(filePath);
    if (!fileInformation.isFile()) {
      sendText(response, 404, "Not found");
      return;
    }

    response.writeHead(200, {
      ...securityHeaders,
      "Content-Length": fileInformation.size,
      "Content-Type": contentTypes.get(extname(filePath).toLowerCase()) || "application/octet-stream"
    });

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    createReadStream(filePath).pipe(response);
  } catch {
    sendText(response, 404, "Not found");
  }
}).listen(port, "127.0.0.1", () => {
  process.stdout.write(`KSA Repository Health is available at http://127.0.0.1:${port}\n`);
});
