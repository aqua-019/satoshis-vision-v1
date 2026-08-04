// prerender.mjs — v6.0.9. Render every static route to real HTML at build time.
//
// Why this exists: vercel.json rewrites `/((?!api/).*)` to /index.html, so
// before this every URL served the same shell. With JavaScript ON that is
// invisible — the router takes over. With JavaScript OFF it means the entire
// site is one page. Tor Browser at Safest disables JS outright, so the most
// privacy-conscious segment of the audience — on a Monero site — could reach
// the splash and nothing else. The route links added in #141 navigated but
// landed on identical content, which is arguably worse than no links at all.
//
// After this, `dist/education/index.html` is a real file. Vercel's filesystem
// lookup runs BEFORE rewrites, so it wins over the SPA catch-all with no
// vercel.json change needed, and the catch-all still handles everything else
// (deep links, the dynamic /mempool/tx/:txid route, 404s).
//
// The prerendered markup goes inside #root. main.tsx still uses createRoot,
// which DISCARDS it and re-renders on boot — deliberately, not an oversight:
// hydrateRoot would reuse it but raises mismatch errors on any server/client
// divergence, and this app renders time- and feed-dependent UI. Discarding
// costs one extra render and cannot produce a mismatch bug.
//
// Live numbers render as "—" because DataProvider has no data server-side and
// the app never invents figures (the v5.0.14 all-real-data rule). That is the
// honest result: structure, labels and prose, with dashes where live data goes.
//
// Run from app/: `node scripts/prerender.mjs` (wired into `npm run build`).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
// v6.1.0: the route list moved to scripts/routes.mjs so the sitemap generator
// builds from the same source. Adding a route is one edit, not two.
import { ROUTES } from "./routes.mjs";

const appDir = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(appDir, "dist");

const shellPath = join(dist, "index.html");
if (!existsSync(shellPath)) {
  console.error("prerender: dist/index.html not found — run `vite build` first");
  process.exit(1);
}
let shell = readFileSync(shellPath, "utf8");

// The built shell carries the hashed asset links, so every prerendered page
// still boots the same bundle. Only #root's contents differ.
const ROOT_RE = /(<div id="root">)(<\/div>)/;
if (!ROOT_RE.test(shell)) {
  console.error('prerender: could not find an empty <div id="root"></div> in dist/index.html');
  process.exit(1);
}

// Stamp the default theme onto the emitted shell's <html> tag. The Vite
// shell ships `<html lang="en">` with no `data-theme`, and index.html's
// pre-paint script (the thing that normally sets it) only runs once the
// bundle executes — so a cold prerendered load painted unthemed until then,
// and with JS off it never ran at all. Classic is the site's default theme
// (see VisualContext.tsx), so that's what an un-attributed load should show.
// Defensive: if the tag shape ever changes, log and continue with the
// unstamped shell rather than emitting a broken page for every route.
const HTML_TAG_RE = /<html([^>]*)>/;
const htmlTagMatch = HTML_TAG_RE.exec(shell);
if (!htmlTagMatch) {
  console.error('prerender: could not find an <html> tag in dist/index.html — emitting without a data-theme stamp');
} else if (/\sdata-theme=/.test(htmlTagMatch[1])) {
  // Already stamped (e.g. the shell was built with one) — don't double-attribute.
} else {
  shell = shell.replace(HTML_TAG_RE, `<html$1 data-theme="classic">`);
}

// SUSPENDED_RE comes from the SSR entry rather than being re-typed here: the
// two used to be separate literals, and they drifted by exactly one space —
// which is how /simulate shipped an empty #root for an unknown number of
// builds. One pattern, one place, both consumers.
const { render, SUSPENDED_RE } = await import(join(dist + "-ssr", "entry-ssr.js"));

let failed = 0;
for (const route of ROUTES) {
  let html;
  try {
    html = await render(route);
  } catch (e) {
    console.error(`❌ ${route}: ${e.message}`);
    failed++;
    continue;
  }

  // A page that still shows the Suspense fallback means render() gave up
  // before the lazy chunk resolved. Emitting it would ship "loading…" as the
  // permanent no-JS content, which is worse than the shell — fail loudly.
  if (SUSPENDED_RE.test(html)) {
    console.error(`❌ ${route}: still suspended after render passes`);
    failed++;
    continue;
  }

  const page = shell.replace(ROOT_RE, `$1${html}$2`);
  const outDir = route === "/" ? dist : join(dist, route.slice(1));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.html"), page, "utf8");
  console.log(`  ${route.padEnd(12)} ${(html.length / 1024).toFixed(1).padStart(6)} KB`);
}

if (failed) {
  console.error(`\n❌ prerender: ${failed} route(s) failed`);
  process.exit(1);
}
console.log(`\n✅ prerendered ${ROUTES.length} routes`);

/* ── D1908 · stamp the SHA this dist was built from ───────────────────────
 *
 * Nothing in this harness tied the BYTES being measured to the COMMIT being
 * claimed. Two operators hit that inside one hour, from opposite ends: one
 * rebuilt while serve-dist was serving (the server died mid-chain and every
 * later gate reported ERR_CONNECTION_REFUSED), the other served a dist built
 * ten minutes before the checkout and got four confident RED assertions about
 * a `phase` attribute the bundle predated. Five false results, no defect in
 * any gate, and nothing anywhere noticed the mismatch.
 *
 * It is the precondition rule applied to the harness rather than to an
 * assertion: THE RUN CANNOT SEE ITS OWN SUBJECT. verify-coldboot-live §0
 * compares this against `git rev-parse HEAD` and aborts the chain on drift,
 * which is why it is written here — prerender is the last step that touches
 * dist/, so a stamp written here cannot precede the bytes it describes.
 *
 * Written to .perf/ (gitignored, already the home of bundle-graph.json) and
 * NOT into dist/, so nothing about the build ships to a visitor. On a repo
 * where the SHA is public that is not a secrecy argument — it is that a
 * privacy site should ship exactly what it means to ship and nothing else.
 *
 * A missing git binary yields "unknown" rather than a throw: the gate reports
 * that as unverifiable-and-counted, never as a pass. */
try {
  const { execFileSync } = await import("node:child_process");
  const sha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: appDir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  const perfDir = join(appDir, ".perf");
  mkdirSync(perfDir, { recursive: true });
  writeFileSync(join(perfDir, "build-sha.txt"), sha + "\n", "utf8");
  console.log(`  build stamped ${sha.slice(0, 8)} -> .perf/build-sha.txt`);
} catch {
  const perfDir = join(appDir, ".perf");
  mkdirSync(perfDir, { recursive: true });
  writeFileSync(join(perfDir, "build-sha.txt"), "unknown\n", "utf8");
  console.log("  build stamped unknown (no git) -> .perf/build-sha.txt");
}
