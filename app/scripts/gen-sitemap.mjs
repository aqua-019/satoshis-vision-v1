// gen-sitemap.mjs — v6.1.0. Emit sitemap.xml and robots.txt into dist/.
//
// Why this exists at all: the repo root used to carry a hand-written
// sitemap.xml listing 18 URLs, 17 of which were the v4 static pages. It was
// wrong twice over. The URLs named pages that no longer exist, and the file
// itself was never served — vercel.json publishes `app/dist`, and the repo root
// is not in it, so https://xmr.irish/sitemap.xml fell through the SPA catch-all
// and returned HTML with a 200. robots.txt had the same problem while pointing
// crawlers at that non-existent sitemap.
//
// Writing into dist/ (rather than public/) is deliberate: the route list is the
// source of truth, so the sitemap must be DERIVED from it at build time. A file
// committed in public/ would be another copy to keep in sync — exactly the bug
// this replaces.
//
// Both files land as real files in dist/, and Vercel's filesystem lookup runs
// BEFORE rewrites, so they win over the `/((?!api/).*)` SPA catch-all with no
// vercel.json change needed.
//
// Run from app/: `node scripts/gen-sitemap.mjs` (wired into `npm run build`,
// after vite build so dist/ exists).

import { writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ROUTES, SITE_ORIGIN, absoluteUrl } from "./routes.mjs";

const appDir = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(appDir, "dist");

if (!existsSync(dist)) {
  console.error("gen-sitemap: dist/ not found — run `vite build` first");
  process.exit(1);
}

// No <lastmod>. A build timestamp is not a content-modification date, and
// stamping every URL with "today" on every deploy is a lie that trains crawlers
// to ignore the field. No <priority>/<changefreq> either — Google has ignored
// both since 2023, and inventing numbers for them is the same failure mode.
const urls = ROUTES.map((r) => `  <url>\n    <loc>${absoluteUrl(r)}</loc>\n  </url>`).join("\n");

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

const robots = `User-agent: *
Allow: /

Sitemap: ${SITE_ORIGIN}/sitemap.xml
`;

writeFileSync(join(dist, "sitemap.xml"), sitemap, "utf8");
writeFileSync(join(dist, "robots.txt"), robots, "utf8");

console.log(`  sitemap.xml  ${ROUTES.length} urls`);
console.log(`  robots.txt   -> ${SITE_ORIGIN}/sitemap.xml`);
console.log(`\n✅ generated sitemap.xml + robots.txt for ${ROUTES.length} routes`);
