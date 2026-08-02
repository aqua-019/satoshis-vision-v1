// verify-bundle.mjs — byte budgets for the shipped bundle. v6.1.5.
//
// Run: npm run build && node verify-bundle.mjs [--measure]
//      BUNDLE_INFLATE_KB=50 node verify-bundle.mjs      # prove it can go red
//
// WHY THIS EXISTS
// 59 gates guarded this repo before v6.1.5 and every one of them checked
// CORRECTNESS. Nothing checked COST. There was no zlib, no statSync().size and
// no byte accounting anywhere in the tree, so the bundle could double between
// releases and every gate would still be green. This is the ruler.
//
// ── WHY THE NUMBERS BELOW NEED NO CI CALIBRATION ──────────────────────────
// Unlike verify-cls.mjs and verify-vitals.mjs, this gate measures nothing
// wall-clock. `vite build` is deterministic for assets: two builds of one tree
// produce byte-identical dist/assets/ (measured — 71 of 71 files, and that is
// also the check that proves vite.config.ts's bundleGraph plugin is
// output-neutral). gzip is pinned to level 9 below for the same reason: Node's
// default is 6, and an unpinned level would make every number here
// irreproducible across Node versions — exactly the disease this file exists
// to cure. So these ceilings are set from a local measurement and hold on any
// machine. A CI runner cannot disagree with them.
//
// ── WHAT IS DELIBERATELY *NOT* BUDGETED ───────────────────────────────────
// Per-chunk ceilings, except the Vite-warning backstop. A per-chunk ceiling
// punishes correct code-splitting, which is precisely what the next release
// does more of. And a single grand total is rejected too: it would hide a 40 kB
// entry regression behind a 40 kB lazy-chunk win. The five classes below each
// answer a different question.
//
// ── UNITS ─────────────────────────────────────────────────────────────────
// Budgets are gzip, except totalJsRaw/maxChunkRaw. Brotli is printed as INFO
// and gated on nothing: Vercel serves brotli, so brotli is the honest wire
// number — but PERF-BASELINE.md records gzip, and silently switching units
// would break the only historical series this repo has.
//
// dist/assets/*.map is excluded everywhere. vite.config.ts sets
// `sourcemap: true` and the maps are larger than the code they describe;
// a naive dist/assets/* glob would measure them and mean nothing.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { gzipSync, brotliCompressSync, constants as ZC } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeReporter } from './verify-reporter.mjs';
import { ROUTES } from './scripts/routes.mjs';

const APP = dirname(fileURLToPath(import.meta.url));
const DIST = join(APP, 'dist');
const ASSETS = join(DIST, 'assets');
const GRAPH = join(APP, '.perf', 'bundle-graph.json');

const MEASURE_ONLY = process.argv.includes('--measure');

/* ── The break-test hook, and its three guards ────────────────────────────
 * BUNDLE_INFLATE_KB adds synthetic bytes so the red path is reproducible on
 * demand without editing a single source file — the __XMR_TIER_MS__ /
 * __XMR_PANEL_THROW__ idiom, and the reason is v6.1.3, which shipped a session
 * where a break-test mutation was left in the working tree and every "green"
 * run after it measured a tree that no longer existed.
 *
 * But an inflater is also a masker, so:
 *   1. ADDITIVE ONLY. A negative or zero value is rejected outright, not
 *      quietly accepted.
 *   2. A run with it set is NON-AUTHORITATIVE and refuses to emit a baseline.
 *   3. The finish sequence asserts it is unset. That sequence's grep reads
 *      FILES and is structurally blind to an environment variable, as is
 *      `git status` — so a hook left set in a shell is the uncommitted-edit
 *      failure relocated to the one place neither check can see, which is why
 *      the handoff asserts it explicitly instead.
 *      (This comment deliberately avoids spelling the banned break-test token
 *      that grep looks for: a header that names it makes the grep match on
 *      prose forever and quietly stops being a check. v6.1.4 lost three
 *      assertions to exactly that.) */
const INFLATE_RAW = process.env.BUNDLE_INFLATE_KB;
let INFLATE = 0;
if (INFLATE_RAW !== undefined && INFLATE_RAW !== '') {
  const n = Number(INFLATE_RAW);
  if (!Number.isFinite(n) || n <= 0) {
    console.error(`verify-bundle: BUNDLE_INFLATE_KB must be a positive number (got ${JSON.stringify(INFLATE_RAW)}).`);
    console.error('It exists to ADD synthetic bytes and prove this gate goes red. A negative or');
    console.error('zero value could only ever mask a regression, so it is refused rather than honoured.');
    process.exit(2);
  }
  INFLATE = n * 1024;
}

const R = makeReporter('verify-bundle');

/* ── Prerequisite: a built tree. FAILURE, never a skip. ───────────────────
 * verify-govern.mjs:330 sets the rule — "Deliberately a FAILURE, not a skip"
 * — because a gate that skips when its input is missing reports green on a
 * tree it never looked at. This file is a dist reader end to end, so unlike
 * verify-govern it does not even get a --static opt-out. */
if (!existsSync(ASSETS) || !existsSync(GRAPH)) {
  R.ok(false, 'dist/ is built and .perf/bundle-graph.json exists',
    `missing ${!existsSync(ASSETS) ? 'dist/assets' : '.perf/bundle-graph.json'} — build it: npm run build`);
  process.exit(R.finish());
}

const graph = JSON.parse(readFileSync(GRAPH, 'utf8'));
const byFile = new Map(graph.chunks.map((c) => [c.fileName, c]));

/* Keyed by the DIST-RELATIVE path ("assets/index-abc.js"), which is exactly
 * the form Rollup uses for chunk.fileName / chunk.imports. Keying by bare
 * basename instead is not a hypothetical: the first draft of this file did it,
 * every closure lookup silently missed, and eagerJsGz reported 0 B while four
 * green ticks sat under it. §7's self-test is what caught it — which is the
 * whole argument for shipping that self-test. */
const sizeOf = (rel) => {
  const buf = readFileSync(join(DIST, rel));
  return {
    raw: buf.length,
    gz: gzipSync(buf, { level: 9 }).length,
    br: brotliCompressSync(buf, { params: { [ZC.BROTLI_PARAM_QUALITY]: 11 } }).length,
  };
};

const assetRel = readdirSync(ASSETS).map((f) => `assets/${f}`);
const jsFiles = assetRel.filter((f) => f.endsWith('.js'));
const cssFiles = assetRel.filter((f) => f.endsWith('.css'));
const size = new Map([...jsFiles, ...cssFiles].map((f) => [f, sizeOf(f)]));

const sum = (files, unit) => files.reduce((n, f) => n + (size.get(f)?.[unit] ?? 0), 0);

/** Transitive STATIC imports. Dynamic imports are deliberately excluded — see
 *  PAGE_MODULE below. */
function staticClosure(fileName) {
  const seen = new Set();
  const stack = [fileName];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || seen.has(cur)) continue;
    seen.add(cur);
    for (const i of byFile.get(cur)?.imports ?? []) stack.push(i);
  }
  return seen;
}

/**
 * Route → the page module whose chunk that route pulls on a cold landing.
 *
 * `/` is null ON PURPOSE: App.tsx:19 keeps HomePage EAGER because it is the
 * LCP route, so `/`'s first load IS the entry closure and there is no separate
 * chunk to find. If a future change makes HomePage lazy, the mapping assertion
 * below fails and forces that change to be argued out loud — which is correct,
 * because it would be a real LCP regression.
 *
 * Keys come from scripts/routes.mjs's ROUTES, never a hand-typed list: that is
 * the repo's designated anti-drift source (prerender.mjs and gen-sitemap.mjs
 * already consume it), so a new route inherits a budget instead of escaping
 * one.
 */
const PAGE_MODULE = {
  '/': null,
  '/mempool': 'src/pages/MempoolPage.tsx',
  '/markets': 'src/pages/MarketsPage.tsx',
  '/network': 'src/pages/NetworkPage.tsx',
  '/education': 'src/pages/EducationPage.tsx',
  '/monero': 'src/pages/MoneroPage.tsx',
  '/future': 'src/pages/FuturePage.tsx',
  '/peers': 'src/pages/TrustedPeersPage.tsx',
  '/simulate': 'src/pages/SimulatePage.tsx',
  '/node': 'src/pages/NodePage.tsx',
  '/sources': 'src/pages/SourcesPage.tsx',
};

/** Rollup leaves facadeModuleId null when a chunk is not a pure facade —
 *  MempoolPage is one such today. Fall back to the chunk NAME, which Vite
 *  derives from the module basename, and let the caller assert exactly one
 *  match either way. */
function chunksFor(moduleId) {
  const byFacade = graph.chunks.filter((c) => c.facadeModuleId === moduleId);
  if (byFacade.length) return byFacade;
  const base = moduleId.split('/').pop().replace(/\.tsx?$/, '');
  return graph.chunks.filter((c) => c.isDynamicEntry && c.name === base);
}

const entry = graph.chunks.find((c) => c.isEntry);
const EAGER = entry ? staticClosure(entry.fileName) : new Set();
const eagerJs = [...EAGER];

/* ── BUDGETS ──────────────────────────────────────────────────────────────
 * Measured on 5fca6ba + this PR's instrumentation, Node 22.22.2, gzip -9,
 * `npm run build` at app/. Headroom is ~10% throughout: the build is
 * deterministic, so headroom is slack for ordinary feature work, NOT for
 * measurement noise. There is none.
 *
 * Raise a ceiling only deliberately, in a commit that says why. The self-test
 * at the end of this file exists to make a ceiling that has drifted past
 * usefulness fail loudly rather than rot quietly. */
const BUDGETS = {
  // Entry + vendor + every shared static chunk: what a cold visitor downloads
  // before ANY route renders. Successor to PERF-BASELINE.md:73's 69.70 kB
  // (v6.0.8); measured 79,919 here, ~15% growth over 15 commits of features.
  eagerJsGz: 88_000,
  // One render-blocking stylesheet. All five sheets are imported from
  // main.tsx:26-30 (203,896 bytes of SOURCE) and Vite minifies them to one
  // file: measured 73,031 raw / 14,863 gzip. Budgeted because it blocks the
  // first paint and nothing has ever measured it.
  cssGz: 17_000,
  // Every JS chunk, counted once. The drift detector for "we shipped 200 kB of
  // lazy code nobody has opened yet". Successor to PERF-BASELINE.md:75's
  // 673.8 kB; measured 849,267.
  totalJsRaw: 940_000,
  // NOT calibrated — this is Vite's own chunkSizeWarningLimit default, which
  // PERF-BASELINE.md:76 tracks as "silent". vite.config.ts deliberately leaves
  // that option unset so the warning and this assertion agree. Largest chunk
  // today is SimulatePage at 180,572.
  maxChunkRaw: 500_000,
};

/** Per-route cold-landing cost, gzip. Measured; ~10% headroom, rounded.
 *  /simulate gets its own (large) line rather than sharing a ceiling:
 *  views/protocols.tsx statically imports all 16 src/protocols/*.tsx modules
 *  (5,320 lines), so one shared ceiling would either flake there or be
 *  useless everywhere else. */
const ROUTE_BUDGET_GZ = {
  //  route        budget   measured on 5fca6ba (gzip -9)
  '/':            88_000, //  79,919 — the entry closure itself; HomePage is eager
  '/mempool':    105_000, //  95,236
  '/markets':    105_000, //  95,007
  '/network':    106_000, //  95,610
  '/education':  107_000, //  97,034
  '/monero':     121_000, // 109,514 — 10 tab modules
  '/future':     106_000, //  96,034
  '/peers':      100_000, //  90,243
  '/simulate':   148_000, // 133,676 — carries all 16 protocol modules
  '/node':        91_000, //  82,493
  '/sources':     95_000, //  85,770
};

const CHUNK_COUNT = 35;
const CHUNK_BAND = 4;

const kb = (n) => (n / 1024).toFixed(2).padStart(8);
const pct = (m, b) => `${((m / b) * 100).toFixed(0)}%`.padStart(5);

/* ══ 1 · the table, printed before any assertion ═════════════════════════ */
R.group(`verify-bundle — gzip -9 · ${jsFiles.length} JS chunks · dist/assets`);
if (INFLATE) {
  R.info(`⚠️  NON-AUTHORITATIVE RUN — BUNDLE_INFLATE_KB=${INFLATE / 1024} adds ${INFLATE} synthetic bytes.`);
  R.info('    These numbers are a break test, not a measurement. No baseline is emitted.');
}
R.info('class            measured(KB)  budget(KB)   used   brotli(KB)');

const totalJsRaw = sum(jsFiles, 'raw') + INFLATE;
const eagerGz = sum(eagerJs, 'gz') + INFLATE;
const cssGz = sum(cssFiles, 'gz');
const cssRaw = sum(cssFiles, 'raw');
const eagerBr = sum(eagerJs, 'br');

R.info(`eagerJsGz      ${kb(eagerGz)}    ${kb(BUDGETS.eagerJsGz)}   ${pct(eagerGz, BUDGETS.eagerJsGz)}   ${kb(eagerBr)}`);
R.info(`cssGz          ${kb(cssGz)}    ${kb(BUDGETS.cssGz)}   ${pct(cssGz, BUDGETS.cssGz)}   ${kb(sum(cssFiles, 'br'))}`);
R.info(`totalJsRaw     ${kb(totalJsRaw)}    ${kb(BUDGETS.totalJsRaw)}   ${pct(totalJsRaw, BUDGETS.totalJsRaw)}`);
R.info(`  eager chunks: ${eagerJs.join(', ')}`);
R.info(`  css raw ${cssRaw} → gzip ${cssGz} (source across 5 sheets: 203,896)`);

/* ══ 2 · per-route first load ════════════════════════════════════════════ */
R.group('2 · per-route first load (gzip) — EAGER ∪ the route chunk\'s static closure');
R.info('A shared chunk is counted once per route and so appears in many rows.');
R.info('Do NOT sum this column — totalJsRaw above is the non-double-counted number.');
R.info('dynamicImports are EXCLUDED: /mempool\'s six view engines are a second');
R.info('round-trip, and folding them in would show a cost no visitor pays.');

const routeMeasured = {};
const routeProblems = [];
for (const route of ROUTES) {
  if (!(route in PAGE_MODULE)) {
    routeProblems.push(`${route} has no PAGE_MODULE entry`);
    continue;
  }
  const mod = PAGE_MODULE[route];
  let closure;
  if (mod === null) {
    closure = EAGER;
  } else {
    const found = chunksFor(mod);
    if (found.length !== 1) {
      routeProblems.push(`${route} → ${mod} matched ${found.length} chunks (expected exactly 1)`);
      continue;
    }
    closure = new Set([...EAGER, ...staticClosure(found[0].fileName)]);
  }
  const gz = sum([...closure], 'gz') + INFLATE;
  routeMeasured[route] = gz;
  const budget = ROUTE_BUDGET_GZ[route];
  R.info(`${route.padEnd(11)} ${kb(gz)}    ${budget ? kb(budget) : '       —'}   ${budget ? pct(gz, budget) : '    —'}   (${closure.size} chunks)`);
}

/* ══ 3 · assertions ═════════════════════════════════════════════════════ */
R.group('3 · budgets');
R.ok(eagerGz <= BUDGETS.eagerJsGz,
  `eager JS ${eagerGz} B gzip ≤ ${BUDGETS.eagerJsGz}`,
  'this is what every visitor downloads before anything renders — if the growth is intended, raise the ceiling in a commit that says why');
R.ok(cssGz <= BUDGETS.cssGz,
  `CSS ${cssGz} B gzip ≤ ${BUDGETS.cssGz}`,
  'one render-blocking stylesheet; growth here delays first paint on every route');
R.ok(totalJsRaw <= BUDGETS.totalJsRaw,
  `total JS ${totalJsRaw} B raw ≤ ${BUDGETS.totalJsRaw}`,
  'lazy code still ships; this is the drift detector for code nobody has opened yet');

const biggest = jsFiles.map((f) => [f, size.get(f).raw]).sort((a, b) => b[1] - a[1])[0];
R.ok(biggest[1] + INFLATE <= BUDGETS.maxChunkRaw,
  `largest chunk ${biggest[0]} ${biggest[1] + INFLATE} B raw ≤ ${BUDGETS.maxChunkRaw} (Vite's own warning threshold)`,
  'vite.config.ts leaves chunkSizeWarningLimit unset so this assertion and Vite\'s warning agree');

R.group('4 · per-route ceilings');
for (const route of ROUTES) {
  if (!(route in routeMeasured)) continue;
  const gz = routeMeasured[route];
  const budget = ROUTE_BUDGET_GZ[route];
  if (budget === undefined) {
    R.ok(false, `${route} has a first-load budget`, 'add one to ROUTE_BUDGET_GZ — a route without a budget is a route that cannot regress visibly');
    continue;
  }
  R.ok(gz <= budget, `${route} first load ${gz} B gzip ≤ ${budget}`, `measured ${gz}`);
}

/* ══ 5 · anti-drift ══════════════════════════════════════════════════════
 * Without these the gate keeps reporting confident numbers about routes and
 * chunks that no longer correspond to each other. */
R.group('5 · the map still describes this build');
R.ok(routeProblems.length === 0,
  `every route in scripts/routes.mjs maps to exactly one chunk (${ROUTES.length} routes)`,
  routeProblems.join(' · '));

const unknown = Object.keys(PAGE_MODULE).filter((r) => !ROUTES.includes(r));
R.ok(unknown.length === 0,
  'PAGE_MODULE names no route that scripts/routes.mjs has dropped',
  `stale: ${unknown.join(', ')}`);

R.ok(Math.abs(jsFiles.length - CHUNK_COUNT) <= CHUNK_BAND,
  `chunk count ${jsFiles.length} within ${CHUNK_COUNT}±${CHUNK_BAND}`,
  'a count that moves this far is usually a manualChunks accident, not a feature');

const vendor = graph.chunks.find((c) => c.name === 'vendor');
R.ok(!!vendor, 'the vendor chunk exists', 'vite.config.ts pins react/react-dom/react-router-dom into it');
if (vendor) {
  R.ok(entry?.imports.includes(vendor.fileName),
    'the entry statically imports vendor (so it is cached separately, per vite.config.ts:26-32)',
    'that comment is load-bearing for returning Tor visitors and nothing checked it before v6.1.5');
}

const graphAge = new Date(graph.builtAt).getTime();
const htmlAge = statSync(join(DIST, 'index.html')).mtimeMs;
R.ok(graphAge >= htmlAge - 60_000,
  'bundle-graph.json is from this build, not a stale one',
  `graph ${graph.builtAt} predates dist/index.html — rebuild: npm run build`);

/* ══ 6 · nothing from .perf/ reached the deploy ══════════════════════════
 * An operator condition, and the right one: "I wrote it somewhere else" is a
 * claim, and this repo requires a gate for claims. vercel.json publishes
 * app/dist, so anything from .perf/ found under dist/ is a build-output leak. */
R.group('6 · the graph is not shipped');
const strays = [];
(function walk(dir) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) walk(p);
    else if (/bundle-graph\.json|bundle-report\.(html|json|md)/.test(name.name)) strays.push(p);
  }
})(DIST);
R.ok(strays.length === 0,
  'no .perf/ artifact appears anywhere under dist/',
  `would be deployed: ${strays.join(', ')}`);

/* ══ 7 · the gate can still go red ═══════════════════════════════════════
 * A ruler nobody can prove works is decoration, and this repo has shipped that
 * before: verify-shots counted screenshots it never compared toward a
 * "pixel-identical" claim. This asserts the comparison is LIVE — and doubles
 * as a headroom alarm, going red the day a ceiling is raised so far it can no
 * longer detect a 50 kB regression. */
R.group('7 · self-test — the comparison is live');
R.ok(!(eagerGz + 50 * 1024 <= BUDGETS.eagerJsGz),
  'a +50KB eager regression would FAIL this table',
  `eagerJsGz budget ${BUDGETS.eagerJsGz} has drifted so far above the measured ${eagerGz} that it can no longer detect a 50KB regression — tighten it`);

if (MEASURE_ONLY) {
  R.info('');
  R.info('--measure: numbers printed, nothing asserted.');
  process.exit(0);
}
process.exit(R.finish());
