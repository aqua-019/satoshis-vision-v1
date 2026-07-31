// verify-chartkit.mjs — static assertions for the v6.0.3 chart-fidelity +
// mempool-detail work. Run from app/: `node verify-chartkit.mjs`
//
// No browser needed. Reads source with fs.readFileSync and asserts the
// STRUCTURAL contracts — the ones a DOM test can't see, or can only see by
// accident:
//
//   - the cursor math and tooltip chrome exist in exactly ONE place, so a
//     seventh chart can't quietly grow a private copy;
//   - no gradient id is hardcoded (the collision bug that made every
//     sparkline after the first render flat);
//   - the ribbon's tile count is not coupled to the consensus unlock depth;
//   - no rAF loop schedules its next frame from inside a setState updater —
//     this one ONLY manifests under StrictMode in dev, so a test against
//     `vite preview` can never catch it;
//   - Sediment's fabricated telemetry stays deleted.
//
// Style follows verify-sediment.mjs: ✅/❌ per check, exit 1 on any failure.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (rel) => {
  try { return readFileSync(join(__dirname, rel), "utf8"); } catch { return null; }
};

let failed = false;
const rows = [];
function assert(label, ok, detail = "") {
  rows.push({ label, ok, detail });
  if (!ok) failed = true;
}

/** Strip comments. Every check here asks "does the CODE do X" — matching a
 *  comment that merely names X is how a gate cries wolf, and a gate nobody
 *  trusts gets ignored right when it's telling the truth. */
function strip(s) {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, "")   // block + JSDoc
    .replace(/(^|[^:])\/\/.*$/gm, "$1"); // line, sparing the "://" in URLs
}

/** Every .tsx/.ts under src/, as [relPath, codeWithoutComments]. */
function walk(rel, out = []) {
  const abs = join(__dirname, rel);
  if (!existsSync(abs)) return out;
  for (const e of readdirSync(abs, { withFileTypes: true })) {
    const r = rel + "/" + e.name;
    if (e.isDirectory()) walk(r, out);
    else if (/\.tsx?$/.test(e.name)) out.push([r, strip(readFileSync(join(__dirname, r), "utf8"))]);
  }
  return out;
}
const ALL = walk("src");
const src = (rel) => (ALL.find(([r]) => r === rel) || [])[1] ?? null;

/* ── 1 · single implementation of the shared kit ─────────────────── */

const kit = src("src/design/chart-kit.tsx");
assert("chart-kit exists", !!kit);
for (const sym of ["useSvgCursor", "ChartTip", "ChartCrosshair", "useGradientId", "nearestIndex", "slotIndex"]) {
  assert(`chart-kit exports ${sym}`, !!kit && kit.includes(`export function ${sym}`) || !!kit && kit.includes(`export const ${sym}`));
}

// The triplicated pointer→viewBox conversion must be gone from charts.tsx.
const charts = src("src/pages/markets/charts.tsx");
const cursorMath = /clientX\s*-\s*rect\.left/g;
const chartsCursorCopies = (charts?.match(cursorMath) || []).length;
assert(
  "charts.tsx re-derives no cursor math (was 3 copies)",
  chartsCursorCopies === 0,
  `found ${chartsCursorCopies}`,
);

// Repo-wide: only chart-kit may convert client px to viewBox units.
const cursorOffenders = ALL
  .filter(([r, s]) => r !== "src/design/chart-kit.tsx" && cursorMath.test(s))
  .map(([r]) => r);
assert(
  "cursor math lives only in chart-kit",
  cursorOffenders.length === 0,
  cursorOffenders.join(", "),
);

// Tooltip chrome: the box fill is the fingerprint of an inlined tooltip.
const tipFill = ALL.filter(([, s]) => s.includes("rgba(8,7,5,0.94)")).map(([r]) => r);
assert(
  "tooltip chrome declared once (in chart-kit)",
  tipFill.length === 1 && tipFill[0] === "src/design/chart-kit.tsx",
  tipFill.join(", ") || "not found",
);

/* ── 2 · reduced motion consolidated ─────────────────────────────── */

const rmDefs = ALL.filter(([, s]) =>
  /export function useReducedMotion|function usePrefersReducedMotion/.test(s),
).map(([r]) => r);
assert(
  "useReducedMotion defined exactly once",
  rmDefs.length === 1 && rmDefs[0] === "src/design/useReducedMotion.ts",
  rmDefs.join(", "),
);

// The non-reactive one-shot read is the bug this replaced: it never responds
// to the user changing the OS setting after mount.
const oneShot = ALL
  .filter(([r, s]) => r !== "src/design/useReducedMotion.ts" &&
    /matchMedia\(["'`]\(prefers-reduced-motion/.test(s))
  .map(([r]) => r);
assert("no ad-hoc matchMedia(prefers-reduced-motion) reads", oneShot.length === 0, oneShot.join(", "));

/* ── 3 · gradient ids are instance-scoped ────────────────────────── */

// A literal id on a <linearGradient> is the collision bug: SVG url(#id)
// resolves to the FIRST match in the document, so a second instance of the
// same component paints with the first one's stops. That is what made every
// sparkline after the first render flat, and what mis-coloured the second
// MultiLine on /markets.
//
// Scoped to the REUSABLE chart modules. The view and protocol files also
// hold literal gradient ids, but those are one-off decorations inside a
// component the router renders at most once per page (one mempool view is
// mounted at a time), so they cannot collide with themselves. Flagging them
// would be noise, and noise is how a gate stops being read.
const CHART_MODULES = [
  "src/design/chart-kit.tsx",
  "src/design/primitives.tsx",
  "src/pages/markets/charts.tsx",
];
const hardcodedGrad = [];
for (const [r, s] of ALL.filter(([r]) => CHART_MODULES.includes(r))) {
  const m = s.match(/<linearGradient[^>]*\bid=\{?["'`][^"'`]*["'`]/g) || [];
  for (const hit of m) if (!/uid|gid|useId|GradientId/i.test(hit)) hardcodedGrad.push(`${r}: ${hit.trim()}`);
}
assert("reusable charts scope every gradient id per instance", hardcodedGrad.length === 0, hardcodedGrad.join(" | "));

// React's useId() emits ":r0:" — a raw ":" is not valid inside url(#…).
// Only files that actually build a url(#…) reference are in scope: useId is
// also the correct way to mint an aria-labelledby target, where ":" is legal
// and stripping it would be pointless.
const rawUseId = ALL
  .filter(([, s]) => /url\(#/.test(s) && /useId\(\)/.test(s) &&
    !/useId\(\)\s*\.replace/.test(s) && !/useGradientId/.test(s))
  .map(([r]) => r);
assert("every useId() feeding url(#…) is sanitised", rawUseId.length === 0, rawUseId.join(", "));

/* ── 4 · Sparkline / MiniBar fidelity fixes ──────────────────────── */

const prims = src("src/design/primitives.tsx");
assert(
  "Sparkline drops preserveAspectRatio=\"none\" (the stretch bug)",
  !!prims && !/preserveAspectRatio=["'{]?["']?none/.test(prims),
);
assert("Sparkline gained detail/fmt props", !!prims && /detail\??:/.test(prims) && /fmt\??:/.test(prims));
assert("MiniBar gained labels/hover props", !!prims && /labels\??:/.test(prims) && /hover\??:/.test(prims));
// step = width/(len-1) divides by zero on a 1-point series.
assert(
  "primitives guard a single-point series",
  !!prims && /length\s*<=\s*1|n\s*<=\s*1|length\s*===\s*1/.test(prims),
);

/* ── 5 · mempool shared layer adopted by all six views ───────────── */

const VIEWS = ["reactor", "bridge", "sediment", "constellation", "terminal", "classic"];
for (const v of VIEWS) {
  const s = src(`src/mempool/${v}.tsx`);
  assert(`${v} uses MemViewShell`, !!s && s.includes("MemViewShell"));
  assert(`${v} marks a tracked tx (data-tracked-tx)`, !!s && s.includes("data-tracked-tx"));
}

// Every view must surface the shared stats — via the strip, or (Terminal)
// by carrying the hooks itself.
for (const v of VIEWS) {
  const s = src(`src/mempool/${v}.tsx`) || "";
  const viaStrip = s.includes("MemViewShell") && !/stats=\{false\}/.test(s);
  const viaOwn = s.includes("data-memstat");
  assert(`${v} exposes shared stats`, viaStrip || viaOwn, viaStrip ? "via strip" : viaOwn ? "own hooks" : "NEITHER");
}

/* ── 6 · the unlock depth is not the ribbon's tile count ─────────── */

const conf = src("src/mempool/conf.ts");
assert("conf.ts exports CONF_UNLOCK", !!conf && conf.includes("export const CONF_UNLOCK"));
assert("conf.ts exports RIBBON_BLOCKS", !!conf && conf.includes("export const RIBBON_BLOCKS"));

const coupled = ALL.filter(([, s]) => /slice\(\s*0\s*,\s*CONF_UNLOCK\s*\)/.test(s)).map(([r]) => r);
assert(
  "no ribbon slices on CONF_UNLOCK (use RIBBON_BLOCKS)",
  coupled.length === 0,
  coupled.join(", "),
);

// Bare literals left behind mean a view drifted off the constant.
const bareTen = ALL
  .filter(([r, s]) => r.startsWith("src/mempool/") && /blocks\.slice\(\s*0\s*,\s*10\s*\)/.test(s))
  .map(([r]) => r);
assert("no literal blocks.slice(0, 10) left", bareTen.length === 0, bareTen.join(", "));

/* ── 7 · rAF hygiene ─────────────────────────────────────────────── */

// Scheduling the next frame INSIDE a setState updater forks the loop under
// StrictMode, which double-invokes updaters. Dev-only, so unreachable from a
// preview-based DOM test — this static check is the only gate that sees it.
const rafInUpdater = [];
for (const [r, s] of ALL) {
  // setX((v) => { … requestAnimationFrame( … ) … })
  const re = /set[A-Z]\w*\(\s*\([^)]*\)\s*=>\s*\{[\s\S]{0,600}?requestAnimationFrame\(/g;
  if (re.test(s)) rafInUpdater.push(r);
}
assert(
  "no requestAnimationFrame scheduled inside a setState updater",
  rafInUpdater.length === 0,
  rafInUpdater.join(", "),
);

// Frame-count integration runs faster on high-refresh displays. Every rAF
// loop should derive a delta.
const LOOPS = ["src/design/ArtBackground.tsx", "src/protocols/sim-fx.tsx", "src/mempool/bridge.tsx"];
for (const f of LOOPS) {
  const s = src(f);
  if (!s || !s.includes("requestAnimationFrame")) continue;
  assert(
    `${f.split("/").pop()} rAF loop is delta-time driven`,
    /performance\.now\(\)|\(now\b|lastTs|dt\b/.test(s),
  );
  assert(
    `${f.split("/").pop()} pauses when the tab is hidden`,
    /visibilitychange|document\.hidden/.test(s),
  );
}

/* ── 8 · ALL-REAL-DATA: no fabricated telemetry ──────────────────── */

// These shipped as literal strings styled as live readings.
const FABRICATED = ["≈1:54", "84 p/B", "246 p/B", "ETA ~2:00"];
for (const lit of FABRICATED) {
  const hits = ALL.filter(([r, s]) => !r.startsWith("src/protocols/") && s.includes(lit)).map(([r]) => r);
  assert(`fabricated literal ${JSON.stringify(lit)} is gone`, hits.length === 0, hits.join(", "));
}

// verify-glide.mjs counts this animation by EXACT name and asserts exact
// counts; a second declaration silently breaks a currently-green gate.
const glideKf = ALL.filter(([, s]) => s.includes("glide-enter-kf")).map(([r]) => r);
assert(
  "glide-enter-kf not redeclared in src/ (would break verify-glide)",
  glideKf.length === 0,
  glideKf.join(", "),
);

/* ── report ──────────────────────────────────────────────────────── */

console.log("\nverify-chartkit — static contracts for v6.0.3\n");
for (const { label, ok, detail } of rows) {
  console.log(`${ok ? "✅" : "❌"} ${label}${detail && !ok ? `  → ${detail}` : ""}`);
}
const bad = rows.filter((r) => !r.ok).length;
console.log(`\n${rows.length - bad}/${rows.length} passed\n`);
process.exit(failed ? 1 : 0);
