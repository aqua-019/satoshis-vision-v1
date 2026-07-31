// harden-legacy-head.mjs — v6.0.7. One-pass head transform for the legacy
// static pages (the netlify.toml deploy, which publishes the repo root).
//
// Why a codemod rather than 20 hand edits: this pass touches each <head>
// three separate ways, and hand-editing 20 files guarantees drift. The output
// is committed; this is not a build step. The CI-facing artifact is
// app/verify-degraded.mjs, which asserts the END STATE — that is what catches
// a 21st page being added later without a floor.
//
// Transforms, all idempotent:
//   1. Insert an inline critical paint floor before the css/d10.css link.
//      css/d10.css paints `body` only (--surface-0 #0A0A0C at :29) — it sets
//      no html background and no color-scheme, so a blocked or slow d10.css
//      left the page white, the same defect as the React app's.
//   2. Delete both fonts.bunny.net lines. The preconnect goes too: on its own
//      it is still a third-party DNS lookup and TLS handshake, i.e. a beacon.
//      Safe to drop the faces — every font-family declaration naming a bunny
//      family already carries a generic fallback (verified, 0 exceptions);
//      css/d10.css's five --font-* tokens become system stacks separately.
//   3. Normalise theme-color to the floor colour so the browser chrome and
//      the page agree (it was #0a0a0a against a #0A0A0C page).
//
// The css/d10.css link is the anchor, which auto-selects exactly the 20
// content pages and skips dashboard.html and mempool.html — both are
// <meta http-equiv="refresh"> stubs with no CSS at all. No hard-coded file
// list to rot.
//
// Run from the repo root:  node scripts/harden-legacy-head.mjs [--dry-run]

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dryRun = process.argv.includes("--dry-run");

/** css/d10.css:29 --surface-0, reached via --bg at :62 and body{} at :154. */
const FLOOR = "#0A0A0C";
const MARKER = 'id="critical-floor"';
const FLOOR_STYLE =
  `<style ${MARKER}>:root{color-scheme:dark}html{background-color:${FLOOR}}` +
  `body{margin:0;background-color:${FLOOR};color:#E8E8EC}</style>`;

/** Matches both href="css/d10.css" (16 pages) and href="/css/d10.css" (4). */
const D10 = /([ \t]*)<link\s+rel="stylesheet"\s+href="\/?css\/d10\.css">/;
const BUNNY_PRECONNECT = /[ \t]*<link\s+rel="preconnect"\s+href="https:\/\/fonts\.bunny\.net">\r?\n/g;
const BUNNY_SHEET = /[ \t]*<link\s+href="https:\/\/fonts\.bunny\.net\/[^"]*"\s+rel="stylesheet">\r?\n/g;
const THEME_COLOR = /<meta\s+name="theme-color"\s+content="#[0-9a-fA-F]{3,8}">/;

let touched = 0;
let skipped = 0;
const problems = [];

for (const name of readdirSync(repoRoot).filter((f) => f.endsWith(".html")).sort()) {
  const path = join(repoRoot, name);
  const before = readFileSync(path, "utf8");

  if (!D10.test(before)) {
    skipped++;
    continue; // redirect stub — nothing to paint
  }
  if (before.includes(MARKER)) {
    console.log(`  ${name}: already hardened, skipping`);
    skipped++;
    continue;
  }

  let src = before;
  const did = [];

  // 1 · floor, immediately before d10.css so the page's own sheet still wins
  //     once it lands (same reasoning as the app: this is a floor, not a theme)
  src = src.replace(D10, (m, indent) => `${indent}${FLOOR_STYLE}\n${m}`);
  did.push("+floor");

  // 2 · bunny
  const bunnyBefore = (src.match(/fonts\.bunny\.net/g) || []).length;
  src = src.replace(BUNNY_PRECONNECT, "").replace(BUNNY_SHEET, "");
  const bunnyAfter = (src.match(/fonts\.bunny\.net/g) || []).length;
  if (bunnyAfter > 0) problems.push(`${name}: ${bunnyAfter} fonts.bunny.net reference(s) survived`);
  if (bunnyBefore) did.push(`-bunny(${bunnyBefore - bunnyAfter})`);

  // 3 · theme-color
  if (THEME_COLOR.test(src)) {
    src = src.replace(THEME_COLOR, `<meta name="theme-color" content="${FLOOR}">`);
    did.push("~theme-color");
  } else {
    problems.push(`${name}: no theme-color meta found`);
  }

  if (src === before) {
    skipped++;
    continue;
  }

  console.log(`  ${name}: ${did.join(" ")}`);
  if (!dryRun) writeFileSync(path, src, "utf8");
  touched++;
}

console.log("");
console.log(`${dryRun ? "[dry-run] would touch" : "touched"} ${touched} file(s), skipped ${skipped}`);

for (const p of problems) console.log(`⚠️  ${p}`);

// The count is a guard, not decoration: if a page stops matching the d10
// anchor we want to hear about it here rather than discover a white page in
// the field. 20 content pages + 2 refresh stubs = 22 root .html files.
if (touched !== 20 && touched !== 0) {
  console.log(`\n❌ expected to touch 20 content pages, touched ${touched}`);
  process.exit(1);
}
if (problems.length) {
  console.log("\n❌ finished with warnings");
  process.exit(1);
}
console.log("✅ done");
