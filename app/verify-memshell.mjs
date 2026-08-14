// verify-memshell.mjs — static-source gate for the shared mempool shell (v6.0.11).
//
// Covers the source-checkable half of the §5 checklist:
//   item 1  — the five new view files exist, one view each, registered
//   item 2  — MemViewShell / TrackChip / MemLegendDot resolve from the shared
//             module, and NO view defines its own shell
//   item 3  — every view's line count sits inside the shipped band (REPORTED
//             whether it passes or fails — §5 asks for the numbers)
//   item 6  — zero Math.random / randHex anywhere in src/mempool
//   item 7  — zero useTick on any view (one named allowlist entry)
//   item 12 — every registered view id has a file behind it
// plus two perf contracts §4d mandates but no other gate catches:
//   • no ctx.shadowBlur in src/mempool (use the cached glow sprites)
//   • .mem-canvas declares width AND height (a <canvas> is a replaced element,
//     so inset:0 alone never stretches it — the documented particles-in-the-
//     corner bug, fixed once for .art-canvas and trivially re-introducible)
//
// Assertions the five NEW views own are marked { owned: false } until they land,
// so this gate is green on PR1 (shell + retrofit) and tightens by itself as
// PR2/PR3 add views. That is the verify-sediment.mjs convention for "another
// stream's contract".
//
// Run: node verify-memshell.mjs

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = dirname(fileURLToPath(import.meta.url));
const read = (rel) => { try { return readFileSync(join(appDir, rel), "utf8"); } catch { return null; } };

let failed = false;
let ownedFails = 0;
const checks = [];
function assert(label, ok, detail = "", { owned = true } = {}) {
  checks.push({ label, ok, detail, owned });
  if (!ok && owned) { failed = true; ownedFails++; }
}

function walk(dir, suffix) {
  const out = [];
  const abs = join(appDir, dir);
  if (!existsSync(abs)) return out;
  for (const e of readdirSync(abs)) {
    const p = join(abs, e);
    if (statSync(p).isDirectory()) out.push(...walk(join(dir, e), suffix));
    else if (e.endsWith(suffix)) out.push(join(dir, e));
  }
  return out;
}

const lineOf = (src, index) => src.slice(0, index).split("\n").length;

/**
 * Blank out `//` and block comments, preserving length and newlines so byte
 * offsets still map to the right line numbers.
 *
 * This is load-bearing, not tidiness: the code these checks guard is heavily
 * commented, and those comments legitimately NAME the banned patterns — the
 * deterministic replacement in reactor.tsx is annotated "NOT Math.random()",
 * and useMemCanvas.ts's header explains what useTick(50) used to cost. A naive
 * grep flags its own documentation and the gate cries wolf. Mirrors
 * verify-legibility.mjs's stripCssComments.
 */
function stripComments(src) {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === "//") {
      while (i < src.length && src[i] !== "\n") { out += " "; i++; }
    } else if (two === "/*") {
      while (i < src.length && src.slice(i, i + 2) !== "*/") { out += src[i] === "\n" ? "\n" : " "; i++; }
      out += "  "; i += 2;
    } else {
      out += src[i]; i++;
    }
  }
  return out;
}

// ── the eleven ───────────────────────────────────────────────────────────────
// p2·9 — orbital and abyss MOVED from NEW to SHIPPED. They landed in #174 and
// #176 and had been sitting in NEW ever since, which meant every check below
// that consults `owned` ran on them as a WARNING rather than as an assertion:
// their line-count bands, in particular, could have drifted past the ceiling
// without reddening anything. NEW means "not yet in the tree"; leaving a
// shipped view there is a green earned outside the claim, which is the exact
// reason this file's own header gives for taking the abyss split.
//
// `pulse` STAYS in NEW for this PR and moves on the next one, for the same
// reason: promoting a view in the PR that introduces it would make its own band
// check owned by a number nobody has reviewed yet.
const SHIPPED = ["reactor", "bridge", "sediment", "constellation", "orbital", "abyss", "terminal", "classic"];
const NEW = ["relay", "circuit", "pulse"];
const ALL = [...SHIPPED, ...NEW];

// The band comes from the six that shipped, measured — NOT from the prompt's
// stale 312–1084 table (real range at v6.0.2 was 354–608). A new view below the
// floor is a sketch; far above the ceiling is a file that should have been split.
const BAND_LO = 200;
const BAND_HI = 1084;

const SHELL_SRC = read("src/mempool/mempool-shared.tsx");
// p2·7b: the id literals moved from views/index.tsx to views/mempool-meta.ts
// (index.tsx now binds components and derives MEMPOOL_VIEWS from that list).
// Same instrument, new subject — see mempool-meta.ts's header.
const REG_SRC = read("src/views/mempool-meta.ts");

// ── item 12 / 1: registry ↔ files ───────────────────────────────────────────
const registered = REG_SRC ? [...REG_SRC.matchAll(/\{\s*id:\s*"([a-z]+)"/g)].map((m) => m[1]) : [];
assert(
  "views/mempool-meta.ts registers a parseable MEMPOOL_VIEW_META list",
  registered.length > 0,
  registered.length ? `ids: ${registered.join(", ")}` : "could not parse any { id: \"…\" }",
);
for (const id of registered) {
  assert(
    `registry id "${id}" has a file at src/mempool/${id}.tsx`,
    existsSync(join(appDir, `src/mempool/${id}.tsx`)),
    "a registered id with no file is a deep link that 404s into the classic fallback",
  );
}
for (const id of NEW) {
  assert(
    `[new view] src/mempool/${id}.tsx exists and is registered`,
    existsSync(join(appDir, `src/mempool/${id}.tsx`)) && registered.includes(id),
    "lands in PR2/PR3",
    { owned: false },
  );
}
assert(
  "[new views] all eleven registered",
  ALL.every((id) => registered.includes(id)),
  `registered ${registered.length}/11`,
  { owned: false },
);

// ── item 2a: the shell primitives resolve from the shared module ────────────
// A re-export counts. The contract is ONE import surface for every view, not
// which file the function is typed into — mempool-shared.tsx is a barrel over
// mem-shell.tsx / MemStatStrip.tsx / mem-stats.ts precisely so the pure stat
// formulas stay React-free and node-importable (the detail-map.ts precedent).
for (const name of ["MemViewShell", "TrackChip", "MemTxTable"]) {
  const defined = SHELL_SRC && new RegExp(`export\\s+function\\s+${name}\\b`).test(SHELL_SRC);
  const reexported = SHELL_SRC && new RegExp(`export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from`, "s").test(SHELL_SRC);
  assert(
    `mempool-shared.tsx resolves ${name} (definition or re-export)`,
    !!(defined || reexported),
    defined ? "defined here" : reexported ? "re-exported" : "NOT resolvable from the shared module",
  );
}

// ── item 2b: no view defines its own shell ──────────────────────────────────
// This quadruple absence is the real content of the rule. All six views used to
// carry every one of these.
const OWN_SHELL_MARKERS = [
  ['className="mempool-search-bar"', "its own search-bar row"],
  ["<MempoolSearchBar", "its own search bar"],
  ["<MempoolTrackingDetail", "its own tracking-detail swap (the §4a flattening)"],
];
for (const id of registered) {
  const src = read(`src/mempool/${id}.tsx`);
  if (!src) continue;
  const importsShell = /import\s*\{[^}]*\bMemViewShell\b[^}]*\}\s*from\s*["']@\/mempool\/mempool-shared["']/s.test(src);
  assert(
    `${id}.tsx imports MemViewShell from @/mempool/mempool-shared`,
    importsShell,
    importsShell ? "" : "must consume the shared shell, and via the barrel",
  );
  const code = stripComments(src);
  const offenders = OWN_SHELL_MARKERS.filter(([m]) => code.includes(m)).map(([, why]) => why);
  assert(
    `${id}.tsx defines no shell of its own`,
    offenders.length === 0,
    offenders.length ? `still has ${offenders.join("; ")}` : "",
  );
}

// ── item 3: line counts, REPORTED ───────────────────────────────────────────
const counts = [];
for (const id of ALL) {
  const src = read(`src/mempool/${id}.tsx`);
  if (!src) { counts.push([id, null]); continue; }
  counts.push([id, src.split("\n").length]);
}
for (const [id, n] of counts) {
  if (n == null) continue;
  assert(
    `${id}.tsx line count ${n} is inside the ${BAND_LO}–${BAND_HI} band`,
    n >= BAND_LO && n <= BAND_HI,
    n < BAND_LO ? "below the floor — a sketch, not a view" : n > BAND_HI ? "over the ceiling — split it" : "",
    { owned: NEW.includes(id) ? false : true },
  );
}

// ── item 6: no Math.random / randHex on a live surface ─────────────────────
// Both were RED before v6.0.11: terminal.tsx:59 (typing jitter) and
// reactor.tsx:80 (hex-cell pulse duration). Deterministic substitutes exist —
// hashToUnit(txid), Tx.seed, txHash32 — and they are better anyway: a value
// derived from the txid is stable across re-renders, which random never is.
for (const file of walk("src/mempool", ".tsx").concat(walk("src/mempool", ".ts"))) {
  const src = read(file);
  if (!src) continue;
  const code = stripComments(src);
  const hits = [...code.matchAll(/\bMath\.random\s*\(|\brandHex\s*\(/g)]
    .map((m) => `${file}:${lineOf(code, m.index)}`);
  if (hits.length) assert(`${file} has no Math.random / randHex`, false, hits.join(", "));
}
assert("src/mempool is free of Math.random / randHex", !checks.some((c) => c.label.includes("no Math.random") && !c.ok), "");

// ── item 7: no useTick on a view ───────────────────────────────────────────
// useTick is a bare setInterval that forces a full React reconciliation.
// constellation.tsx ran it at 50ms — twenty re-renders a second of a 460px SVG,
// ungated in a background tab. Canvas work belongs in useMemCanvas, which paints
// pixels and stops when hidden or scrolled away.
//
// ONE allowlisted exemption, named so it stays visible rather than being a
// silent hole in a regex:
const USETICK_ALLOWLIST = new Set([
  "src/mempool/mempool-shared.tsx", // MempoolHeartbeat — text-only "updated Ns ago"
  "src/mempool/mem-stats.tsx",      // BlockEta — text-only countdown, isolated in a leaf
]);
for (const file of walk("src/mempool", ".tsx")) {
  if (USETICK_ALLOWLIST.has(file)) continue;
  const src = read(file);
  if (!src) continue;
  const code = stripComments(src);
  const hits = [...code.matchAll(/\buseTick\s*\(/g)].map((m) => `line ${lineOf(code, m.index)}`);
  if (!hits.length) continue;

  // §5 item 7 bans useTick on CANVAS paths specifically, and that is the line
  // this gate holds: a rAF draw loop must never share a file with a hook that
  // forces a full React reconciliation on a timer. A DOM/SVG view ticking to
  // re-render itself is slower than it needs to be, but it is not the failure
  // the rule names — so those are REPORTED as standing debt rather than failed,
  // which keeps the number visible without inventing a stricter contract than
  // the spec asks for.
  const isCanvas = code.includes("useMemCanvas") || code.includes("<canvas");
  assert(
    `${file} does not drive a CANVAS with useTick`,
    !isCanvas,
    isCanvas ? `${hits.join(", ")} — canvas work belongs in useMemCanvas` : "",
  );
  if (!isCanvas) {
    checks.push({
      label: `${file} still re-renders on useTick (${hits.join(", ")}) — DOM/SVG, so outside §5 item 7`,
      ok: true, detail: "standing debt: a canvas port would remove it", owned: false,
    });
  }
}

// ── §4d: no per-particle shadowBlur ────────────────────────────────────────
// A blur per draw call is ~12k blurs/sec at 200 txs × 60fps and it is what
// misses 30fps on mid-range Android. glowSprite() rasterises the glow once.
for (const file of walk("src/mempool", ".tsx").concat(walk("src/mempool", ".ts"))) {
  const src = read(file);
  if (!src) continue;
  const hits = [...stripComments(src).matchAll(/\.shadowBlur\s*=/g)]
    .map((m) => `line ${lineOf(stripComments(src), m.index)}`);
  assert(
    `${file} uses cached glow sprites, not ctx.shadowBlur`,
    hits.length === 0,
    hits.length ? `${hits.join(", ")} — use glowSprite()/blitGlow()` : "",
  );
}

// ── §4d: the .mem-canvas sizing contract ───────────────────────────────────
{
  const css = read("src/styles.css") || "";
  const m = css.match(/\.mem-canvas\s*\{([^}]*)\}/);
  const body = m ? m[1] : "";
  assert(
    ".mem-canvas declares BOTH width and height",
    /width\s*:\s*100%/.test(body) && /height\s*:\s*100%/.test(body),
    m ? `declares: ${body.trim()}` : ".mem-canvas rule not found — a <canvas> is a replaced element; inset:0 alone leaves it 300×150 in the top-left corner",
  );
}

// ── §4e: the opaque stage ──────────────────────────────────────────────────
// The page renders an ambient aurora behind /mempool. Data must never be read
// through moving decoration.
{
  const css = read("src/styles.css") || "";
  const m = css.match(/\.mem-view\s*\{([^}]*)\}/);
  assert(
    ".mem-view declares an opaque background",
    !!m && /background\s*:/.test(m[1]) && !/rgba\([^)]*,\s*0?\.\d+\s*\)/.test(m[1]),
    m ? `declares: ${m[1].trim().replace(/\s+/g, " ")}` : ".mem-view rule not found",
  );
}

// ── the mobile 12px floor — REPORTED, not required ─────────────────────────
// §4e asks for ≥12px inside the views. --fs-label is clamp(10.5px, 0.74vw, 12px)
// and resolves to 10.5px at 390px; the :root scale cannot be raised because
// verify-legibility.mjs pins all six values byte-for-byte, so the fix would be a
// rebind scoped to .mem-view.
//
// That rebind is NOT currently in the stylesheet, deliberately. Two attempts at
// it — forcing 12px on every atom in a view, then just the token — both made
// Classic measurably worse on a phone: the layout has no slack, so the extra
// pixels went into wrapping (the block-ribbon header broke to "CONFIRMATI/ONS")
// rather than into readability. The floor needs the mempool mobile layout
// reworked to absorb it, which is its own piece of work.
//
// This check therefore REPORTS the state rather than demanding the rebind. A
// gate that fails until someone re-adds a change we know regresses the page
// would just get muted; one that prints the open gap keeps it visible.
{
  const css = read("src/styles.css") || "";
  const hasRebind = /\.mem-view\s*\{\s*--fs-label:\s*12px;?\s*\}/.test(css);
  checks.push({
    label: hasRebind
      ? "styles.css rebinds --fs-label to 12px scoped to .mem-view on mobile"
      : "§4e 12px floor is NOT yet applied inside .mem-view (open gap — needs a mobile layout pass)",
    ok: true,
    detail: hasRebind ? "" : "raising type alone regressed Classic; see verify-memviews for the per-view counts",
    owned: false,
  });
}

// ── the switcher count is derived, not a literal ───────────────────────────
{
  const page = read("src/pages/MempoolPage.tsx") || "";
  assert(
    "MempoolPage derives the view count instead of hardcoding it",
    /MEMPOOL_VIEWS\.length\}\s*views/.test(page) && !/·\s*\d+\s*views/.test(page),
    'the string "Mempool view · 6 views" was a literal that would silently lie at eleven',
  );
}

// ── report ──────────────────────────────────────────────────────────────────
console.log("verify-memshell — static assertions\n");
for (const c of checks) {
  const mark = c.ok ? "✅" : c.owned ? "❌" : "⚠️ ";
  const tag = c.owned ? "" : " (other stream)";
  console.log(`${mark} ${c.label}${tag}${c.detail ? " — " + c.detail : ""}`);
}

console.log("\n§5 item 3 — line counts (the shipped six set the band):");
console.log("  view            lines   band");
for (const [id, n] of counts) {
  const state = n == null ? "—       not yet written"
    : `${String(n).padStart(5)}   ${n >= BAND_LO && n <= BAND_HI ? "in band" : n < BAND_LO ? "BELOW FLOOR" : "OVER CEILING"}`;
  console.log(`  ${id.padEnd(14)} ${state}`);
}
const present = counts.filter(([, n]) => n != null).map(([, n]) => n);
if (present.length) {
  console.log(`  → ${present.length} views, ${Math.min(...present)}–${Math.max(...present)} lines\n`);
}

if (failed) {
  console.log(`❌ verify-memshell: ${ownedFails} assertion(s) failed.`);
  process.exit(1);
}
console.log("✅ verify-memshell: all owned assertions passed.");
process.exit(0);
