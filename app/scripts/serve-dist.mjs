// serve-dist.mjs — serve dist/ the way Vercel does, for the gates.
//
// `vite preview` is an SPA server: it falls back to dist/index.html for any
// path without a file extension, which means it serves the "/" prerender for
// every route and makes the per-route files invisible. Vercel does the
// opposite — its filesystem lookup runs BEFORE rewrites, so dist/education/
// index.html wins at /education and the SPA catch-all only handles what has no
// file. Testing against `vite preview` would therefore prove nothing about
// prerendering, and would keep passing if prerendering broke entirely.
//
// This mirrors Vercel's order: exact file → directory index → SPA fallback.
// Dependency-free, same reasoning as scripts/wait-preview.mjs.
//
// Run from app/: `node scripts/serve-dist.mjs [port]`

import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, extname, normalize } from "node:path";

const appDir = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(appDir, "dist");
const port = Number(process.argv[2] ?? 4173);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".woff2": "font/woff2",
  // v6.1.0: sitemap.xml + robots.txt are generated into dist/ by
  // scripts/gen-sitemap.mjs. Without these the mirror served them as
  // application/octet-stream, which is not what Vercel does.
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const send = (res, status, body, type) => {
  res.writeHead(status, { "content-type": type, "content-length": Buffer.byteLength(body) });
  res.end(body);
};

createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  // normalize + the dist prefix check together block ../ traversal.
  const pathname = normalize(decodeURIComponent(url.pathname));
  const target = join(dist, pathname);
  if (!target.startsWith(dist)) return send(res, 403, "forbidden", "text/plain");

  // 1 · an exact file
  if (existsSync(target) && statSync(target).isFile()) {
    return send(res, 200, readFileSync(target), MIME[extname(target)] ?? "application/octet-stream");
  }
  // 2 · a directory index — this is what makes prerendered routes resolve
  const asIndex = join(target, "index.html");
  if (existsSync(asIndex)) {
    return send(res, 200, readFileSync(asIndex), MIME[".html"]);
  }
  // 3 · SPA fallback, exactly as vercel.json's catch-all rewrite does
  return send(res, 200, readFileSync(join(dist, "index.html")), MIME[".html"]);
}).listen(port, () => console.log(`serve-dist on http://localhost:${port}`));
