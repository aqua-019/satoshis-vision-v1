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
 *
 * Nav restructure (13-route IA): 8 old top-level routes renamed in place to
 * their new paths, plus two new entries — `/live/markets/thesis` and
 * `/future/outlook` — for the two pages split out of the old `/monero/:tab`
 * set. `/monero` and `/future` are otherwise unmoved.
 *
 * p3·16 adds `/operate/superstress`, the 14th route and the first minted since
 * that restructure. Both directions of the mapping assertion below already
 * covered it before it existed: a route in ROUTES with no key here reds §5,
 * and a key here naming a route ROUTES has dropped reds the line after. The
 * entry was added because the gate demanded it, not because a checklist
 * remembered it — which is the anti-drift property this docblock claims,
 * exercised rather than asserted.
 */
const PAGE_MODULE = {
  '/': null,
  '/live/mempool': 'src/pages/MempoolPage.tsx',
  '/live/markets': 'src/pages/MarketsPage.tsx',
  '/live/markets/thesis': 'src/pages/markets/MarketsThesisPage.tsx',
  '/live/network': 'src/pages/NetworkPage.tsx',
  '/learn': 'src/pages/EducationPage.tsx',
  '/learn/sim': 'src/pages/SimulatePage.tsx',
  '/monero': 'src/pages/MoneroPage.tsx',
  '/future': 'src/pages/FuturePage.tsx',
  '/future/outlook': 'src/pages/future/OutlookPage.tsx',
  '/operate/node': 'src/pages/NodePage.tsx',
  '/operate/mine': 'src/pages/MinePage.tsx',
  '/operate/superstress': 'src/pages/SuperstressPage.tsx',
  '/operate/superstress/explorer': 'src/pages/operate/StressnetExplorerPage.tsx',
  '/future/protocol': 'src/pages/future/ProtocolPage.tsx',
  '/operate/peers': 'src/pages/TrustedPeersPage.tsx',
  '/about/sources': 'src/pages/SourcesPage.tsx',
  '/about/site': 'src/pages/SitePage.tsx',
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
  // (v6.0.8); measured 79,919 at 5fca6ba, 80,731 after the 13-route nav
  // restructure (R/REDIRECTS/RedirectTo added to the eager closure) — kept
  // at 88,000 rather than re-tightened since the new measurement still
  // clears it with ~8% headroom.
  // v6.1.8 RAISED 88,000 -> 96,000, deliberately, per this block's own rule.
  // Main Home was rewritten from a static hero into a seven-passage rotating
  // hero + live strip + six IA-derived section cards + thesis + theme toggle.
  // Measured 85,056 -> 87,128 (+2,072 B gzip), leaving 1.0% headroom against
  // 88,000 — and this block defines headroom as "slack for ordinary feature
  // work", which 1% is not. A rewritten LCP route IS ordinary feature work;
  // it is exactly what the slack was for, and it consumed it.
  //
  // 96,000 restores the stated ~10% (87,128 * 1.10 = 95,841, rounded up).
  // NOT chosen to fit: chosen by re-applying the calibration rule already
  // written above. The alternative was lazy-loading passages 2-7 and the
  // below-fold cards to reclaim <1 KB, which buys complexity and two chunks
  // on the most latency-critical route in the app for a rounding error.
  //
  // Raised NOW, at 99%, rather than after the cold-boot mount pushes it past
  // 100%: at that point the number would be chosen by the constraint rather
  // than by measurement, and "we had to" is not a calibration argument.
  //
  // WHAT THIS COST, stated because a bigger number with no trade beside it is
  // a decision a future reader cannot weigh:
  //
  //   smallest eager regression this table still catches
  //     before   873 B
  //     after  8,873 B      — 10.2x looser
  //
  // For scale: the entire Main Home rewrite cost 2,072 B. This ceiling would
  // now absorb four more of them silently. It still catches a careless
  // heavyweight import; it no longer catches a rewrite. That is what ~10%
  // headroom BUYS and what it COSTS, and both halves belong here.
  //
  // Do NOT cite §7's self-test as evidence this number is well-calibrated.
  // §7 fails only once the budget reaches 87,128 + 51,200 = 138,328, so it
  // passes at ANY ceiling up to 138,327 — it would have been just as green at
  // 120,000. It is a catastrophe backstop, not a calibration check, and
  // leaning on it makes a sound argument look like a weak one to anyone who
  // checks its slack. The evidence for 96,000 is the ~10% rule applied to a
  // measurement, plus the irreducibility check above. That is all it needs.
  eagerJsGz: 96_000,
  // One render-blocking stylesheet. All five sheets are imported from
  // main.tsx:26-30 (254,399 bytes of SOURCE) and Vite minifies them to one
  // file: measured 85,218 raw / 17,168 gzip. Budgeted because it blocks the
  // first paint and nothing has ever measured it.
  //
  // PRE-EXISTING STALENESS, corrected in p3·12b rather than only noticed: this
  // read "203,896 bytes of SOURCE … 73,031 raw / 14,863 gzip", none of which
  // any tree has matched for several releases. Re-measured: `wc -c` over the
  // five sheets = 254,399, and dist CSS = 85,218 / 17,168 (node:zlib level 9,
  // the compressor this gate judges with).
  //
  // p3·12: 17,000 -> 17,600. Built 17,168, margin 432. The whole delta is one
  // new block — the markets hero's `.cc-*` rules (canvas stage, DOM label
  // layer, brush strip, accessible table): 82,333 -> 85,218 raw, 16,571 ->
  // 17,168 gzip, +2,885 raw / +597 gzip. Nothing else in the five sheets moved.
  //
  // THE GZIP PAIR WAS MEASURED WITH THE WRONG COMPRESSOR the first time, and
  // the correction is worth the four lines because it is not obvious that there
  // IS more than one. "gzip -9" names three different implementations here, and
  // on the entry chunk they disagree: node:zlib gzipSync({level:9}) 35,016 ·
  // the gzip(1) CLI 34,969 · python3 gzip.compress(…, 9) 34,924. This gate uses
  // node:zlib, so a figure taken from the CLI is a true measurement of a
  // quantity the gate never computes — it read "16,468 -> 17,056, +588" and put
  // a 100 B error into a 432 B margin. Measure gzip with the thing that will
  // judge it.
  //
  // The margin is deliberately TIGHT rather than the ~10% this file uses for
  // the JS ceilings, and the reason is that the two quantities behave
  // differently: JS arrives in chunks and one careless import moves it by
  // kilobytes, while CSS here is one hand-written file that grows by the block.
  // A 10% headroom would be 1,700 B — roughly three more components' worth of
  // rules absorbed silently, on the ONE stylesheet that blocks first paint.
  // RAISED 17,600 -> 18,200 in p3·13. Built 17,753, margin 447 — the same
  // ~2.5% this budget has always carried, not the ~10% the JS ceilings use,
  // for the reason stated directly above. The +585 B is one block: the synced
  // cursor's readout (`.mk-tip*`), the annotation flags, their tooltip and the
  // four layer toggles, plus the `.tl-node` deep-link target on
  // /learn/timeline. Measured with node:zlib at level 9, which is the
  // compressor THIS FILE judges with — the gzip(1) CLI and python3's gzip
  // disagree with it by ~100 B on a chunk this size, and p3·12 put a phantom
  // 50 B of "unattributed" bytes in its own report by measuring with one and
  // being judged by another.
  // RAISED 18,200 -> 18,600 in p4·02, AND IT DID NOT CROSS — which is why the
  // number is 18,600 and not the "built + 4,000" the brief proposed.
  // Measured with node:zlib level 9 (the compressor THIS FILE judges with)
  // against a build of the base commit `5cf71f0` in an ISOLATED worktree with
  // its own dist: 17,900 -> 18,143, delta +243 B gzip / +853 B raw, ONE css
  // asset on both sides. Against the old 18,200 that is a PASS with 57 B to
  // spare — 0.3%.
  //
  // 0.3% is the problem, not the 243. The comment below is explicit that this
  // budget deliberately runs ~2.5% where the JS ceilings run ~10%, because a
  // 10% headroom here "would be 1,700 B — roughly three more components' worth
  // of rules absorbed silently, on the ONE stylesheet that blocks first paint".
  // A 57 B margin is not that budget being strict, it is that budget having
  // stopped working: the next one-line CSS change reds it on arrival regardless
  // of merit, and a ceiling that reds for everything teaches people to raise
  // ceilings reflexively — which is the failure this file exists to prevent.
  // So this raise RESTORES the designed headroom rather than absorbing an
  // overage: 18,143 × 1.025 = 18,597 -> 18,600, margin 457, which is the same
  // ~2.5% p3·13 recorded at 447. Taking the brief's +4,000 would have made it
  // 22% and silently repealed the paragraph below.
  //
  // THE +243 IS ONE BLOCK AND ITS SHAPE IS WORTH KNOWING. p4·02's ≤720px type
  // floor is ~60 selectors plus one custom-property redefinition — and the
  // property is doing most of the work: 318 of the 344 inline sub-12px sites
  // in the app specify `var(--fs-label)` rather than a literal, so
  // `:root { --fs-label: 12px }` inside the media query reaches all of them for
  // the cost of one declaration. Comments are free here (Vite minifies the
  // production sheet), so the long argument in styles-legibility.css costs 0 B.
  /* p4·M8 RAISE, 18,600 -> 19,000, AND IT IS AN UNCROSSED ONE — said out loud,
     on p4·02's own recorded precedent for this exact budget. Built 18,557, so
     the margin was 43 B, or 0.23%. p4·02 raised this ceiling from 18,200 while
     GREEN at 18,143 (margin 57 B, 0.3%) with the argument that "0.3% is not
     strictness, it is a budget that has stopped working", against a budget
     whose own comment two lines up says it deliberately runs ~2.5% where the
     JS ceilings run ~10%. 0.23% is tighter than the case that argument was
     written for. 18,557 × 1.025 = 19,021 -> 19,000, margin 443 — the same
     method and almost exactly the ~447 p3·13 recorded.
     THE +373 IS ONE BLOCK PLUS ONE LINE. p4·M8's phone composition is ~30
     selectors in styles.css and 11 in styles-legibility.css; the single
     `.mem-tbl__r { display: contents }` that fixes the transposed table on all
     ten views, in both states it renders in, costs a handful of bytes. Comments
     are free (Vite minifies the production sheet), so the long arguments in
     both sheets cost 0 B. */
  cssGz: 19_500,        // p4·M9b: built 19,011 on the FINAL tree, margin 489 (2.5%).
  //   RED-THEN-GREEN: 19,011 against the old 19,000 — over by ELEVEN BYTES.
  //   Raised to built + ~2.5%, which is the proportion this budget's own note
  //   below says it is deliberately run at (the JS ceilings run ~10%), and the
  //   same shape p4·M8 used raising it from 18,200 while green.
  //   THE ARITHMETIC WAS DONE BEFORE THE FIRST RULE, not after the red. A
  //   candidate block — the sheet plus a phone layout for four components,
  //   1,447 raw bytes written the way the build emits — appended to the built
  //   sheet and re-gzipped with gzipSync(level:9) measured +344 B against a
  //   401 B margin: it would have fitted by 57 B, which is a coin flip. The
  //   shipped block is larger and the ceiling was planned for it.
  // Every JS chunk, counted once. The drift detector for "we shipped 200 kB of
  // lazy code nobody has opened yet". Successor to PERF-BASELINE.md:75's
  // 673.8 kB.
  //
  // RAISED 940,000 -> 1,000,000 in v2.1, and the `measured 849,267` that stood
  // beside it was stale by 88,769 B — the same failure this table already
  // records for /live/network at :270-280, on the line above it. Measured by
  // building three commits in an isolated worktree, same machine, same
  // node_modules, dist/ wiped between each:
  //
  //     6039d64  (origin/main, this ceiling green)  938,036
  //     9180206  (+ the charts marker nudge)        938,435   +399
  //     a67867e  (+ the sediment canvas rebuild)    944,271   +5,836
  //
  // So main was already at 938,036 against 940,000 — 1,964 B of headroom,
  // 0.21%, not the ~90 kB the stale comment implied. This gate was going to
  // red on the next change of ANY size; sediment crossed it, but +2 kB of
  // anything would have. Recording that explicitly because "the budget went
  // red" and "the budget was already spent" are different findings and only
  // the second one is true here.
  //
  // LEVEL: 960,000, chosen against the PLANNED WORK rather than against one
  // 200 kB lump. Sediment cost +5,836 B; the roadmap still holds four v2
  // rebuilds (constellation, terminal, reactor, ops bridge) and five new views
  // (orbital, abyss, pulse, circuit, relay):
  //
  //     9 x 5,836                        = +52,524
  //     944,271 + 52,524                 =  996,795
  //
  // So a 1,000,000 ceiling — the obvious round number, and this line's first
  // draft — would clear the ENTIRE remaining roadmap by 3,205 B and never fire
  // once. Worse, 5,836 is a floor for the five NEW views, not an average:
  // sediment was a rewrite that replaced code, those are net additions. The
  // realistic outcome is a crossing on the eighth or ninth view, which then
  // gets blamed for eight views' growth — the worst possible moment for this
  // gate to speak.
  //
  // 960,000 leaves 15,729 B, roughly 2.7 views, so it speaks about a third of
  // the way through the roadmap while the answer is still "which view" rather
  // than "all of them". Same standard #167 set one line below, where
  // /live/network was raised 106,000 -> 108,000 (+1,965, a minimum) explicitly
  // because a larger raise would "re-hide the growth". A +60,000 raise here
  // would have been the move that PR declined.
  //
  // If you are raising this again: argue with the arithmetic above, not with
  // the round number.
  //
  // ── CROSSED AND UNRESOLVED as of v2·3 (#170). NOT RAISED. ─────────────
  //
  //     measured on #170's head:  964,046  vs  960,000     over by 4,046 B
  //
  // This gate is RED on that PR ON PURPOSE. Twice now the answer to a crossing
  // has been a bigger number, and both times the number came from too small a
  // sample. A third raise on a three-point sample would repeat the mistake at
  // larger scale, so the crossing is being recorded rather than absorbed.
  //
  // THE PER-VIEW ARITHMETIC ABOVE USED A SAMPLE OF ONE. `9 x 5,836` multiplied
  // sediment's delta by nine and called it the roadmap. Three v2 rebuilds are
  // now measured, and the endpoints below are BUILT, not cited — an earlier
  // draft of this note derived constellation as +4,164 by subtracting the
  // `a67867e` figure from the comment above, which is a BRANCH commit of the
  // sediment PR rather than the merged base. The merged base is `fdf4ecc`:
  //
  //     6039d64   938,036     (fdf4ecc's first parent)
  //     fdf4ecc   945,306     sediment        + 7,270   BUILT
  //     260c99f   948,435     constellation   + 3,129   BUILT
  //     #170 head 964,046     terminal        +15,611   BUILT
  //
  // ALL THREE ARE NOW BUILT-TO-BUILT, and all three were wrong when cited:
  // 1,434 (sediment) · 1,113 (constellation, as two compounding errors) · and
  // terminal's, which was only right because it was the one nobody had quoted
  // from a report yet. No cited delta in this series has survived rebuilding.
  //
  // The last of those was found by a reviewer, and where it was found is the
  // point: an earlier revision of THIS paragraph ended "quote both endpoints or
  // quote neither" while its own headline mean rested on sediment's +5,836,
  // sitting four lines under a marker this file had already written reading
  // `<- still CITED above, not re-measured here`. The rule found one more
  // instance of itself inside the paragraph written to state it, and the file
  // had labelled the instance before anyone measured it.
  //
  // #169'S PUBLISHED DELTA IS WRONG THE SAME WAY, and an independent reviewer
  // caught it by measuring 948,435 at 91c1653 (whose tree is identical to
  // 260c99f's) against the report's `944,271 + 3,051 = 947,322` — 1,113 B
  // apart. It decomposes into BOTH available causes, not one:
  //
  //     baseline cited (944,271, a67867e) vs built (fdf4ecc 945,306)   1,035
  //     delta reported (3,051) vs built-to-built (3,129)                  78
  //     ------------------------------------------------------------------
  //                                                                    1,113
  //
  // Two reports and this comment all took 944,271 from the same place, which
  // is why the error propagated silently across three PRs: a figure quoted
  // from a previous report is not a measurement, and nothing in a build log
  // says which one you are holding. **Quote both endpoints or quote neither.**
  //
  //     mean 8,670 · spread 3,129 -> 15,611, a 5x range
  //
  // Six views remain. At the measured mean that is ~1,016,066 on the old
  // aggregate — so 960,000 was too low AND the 1,000,000 this comment argued
  // down from would also have been crossed. The level was never the problem;
  // the sample was.
  //
  // AND THE ARGUMENT BELOW ALREADY HAPPENED ONCE, which converts it from
  // reasoning into a measurement: 6039d64 built 938,036 against the then-
  // ceiling of 940,000 — 1,964 B of headroom — and the very next merge
  // (sediment, +7,270) crossed it. So "a minimum raise leaves ~1,950 B and
  // reds on the next change of any size" is not a prediction about what might
  // happen; it is a description of what did, one ceiling ago.
  //
  // AND THE DETECTOR'S SUBJECT DOES NOT MATCH THIS GROWTH. Line :247 states
  // what totalJsRaw is for: "the drift detector for 'we shipped 200 kB of lazy
  // code nobody has opened yet'". Terminal's chunk IS opened — by anyone who
  // visits Terminal, deliberately, to see the information they came for.
  // Measured on the same build, the thing this detector actually protects did
  // not move:
  //
  //     eager closure               0 B   (byte-identical; see the split below)
  //     /live/mempool first load   104,183 gz <= 107,000   PASSES at 97%
  //
  // So `totalJsRaw` cannot distinguish "we shipped weight nobody opens" from
  // "a view someone opens got denser". It counts both and its docstring claims
  // only the first. **That is the subject-narrower-than-its-claim shape living
  // in a budget's own comment** — the same defect family the conformance doc
  // catalogues for assertions, one level up.
  //
  // WHERE THE 15,611 WENT, measured by rebuilding with each group's render
  // sites removed so the components tree-shake (isolated worktree, own dist):
  //
  //     terminal chunk  20,361 -> 35,969                        +15,608
  //       minus the 3 chart-kit charts        25,939   charts   10,030  (64%)
  //       minus the 4 new readout panels      31,724   readouts  4,245  (27%)
  //       residual (enriched status/env, imports)                1,333   (9%)
  //
  // So a trim exists and it is the charts — removing them alone lands
  // totalJsRaw at 954,013, under this ceiling. It is not taken: "higher
  // fidelity charts" is the brief, and trimming a LAZY chunk to satisfy a
  // detector aimed at UNOPENED code costs the user information to satisfy a
  // metric that was not measuring them.
  //
  // THE RESOLUTION IS A SPLIT, IN ITS OWN PR WITH ITS OWN BASELINES: an
  // `eagerJsRaw` ceiling over first-paint weight (what every visitor pays
  // unconditionally) and a per-chunk `lazyJsRaw` drift check. The two
  // populations moved 0 B and +15,611 B in the same commit; one ceiling over
  // both is why this crossing is ambiguous to argue about.
  //
  // RESOLVED IN THIS PR by splitting the populations above rather than by moving
  // this number a third time. What remains here is a CATASTROPHE BACKSTOP, not a
  // calibration check — the same status maxChunkRaw has — set to the sum of the
  // two real budgets so it can only fire when something has gone wrong that
  // neither of them already named. Do not tune it; argue with eagerJsRaw and
  // lazyJsRaw, which are sized from measurement.
  //
  // ── RAISED 1,000,000 -> 1,021,000 in p2·8 (Abyss), and it FIRED EXACTLY AS
  //    THE lazyJsRaw NOTE BELOW PREDICTED IT WOULD ──
  //
  // That note ends: "`totalJsRaw` is 995,164 against 1,000,000 on this build —
  // 4,836 B of headroom, less than a fifth of one view. The next view crosses
  // it." Abyss is the next view and it crossed it. Measured, both endpoints
  // BUILT from the same tree (b8b6be6 -> this one):
  //
  //     totalJsRaw   995,015  ->  1,018,671    +23,656
  //
  // Every byte attributed, by diffing dist/assets/*.js file-by-file at both
  // endpoints — and PAIRED BY MULTIPLICITY, not grouped by hash-stripped
  // basename, because there are TWO `index-*.js` chunks and a map keyed on the
  // stripped name silently keeps one of them. That is the exact aggregation-key
  // collision this file already records at :420-425, and the first cut of this
  // measurement walked into it again: it reported +23,195 and lost the +133
  // row. The numbers below reconcile to the gate's own totals exactly.
  //
  //     abyss          (new view chunk)      +23,443   lazy
  //     index/mapDeps  (one more lazy entry)    +133   lazy
  //     index          (the eager entry)         +80   eager
  //     ---------------------------------------------
  //                                          +23,656
  //
  // Budget 1,021,000, so the margin is 2,329 B.
  //
  // THESE NUMBERS ARE THE SHIPPED BUILD'S, RE-MEASURED, and the first set was
  // not. The delta was measured once, the two ceilings were written from it,
  // and then three more rounds of render-driven fixes landed in the view
  // (a legibility floor on the dot radius, four extra rungs on the age ladder,
  // a per-frame marker write). Those moved the abyss chunk 23,115 -> 23,443 and
  // the comment would have shipped describing a tree that no longer existed —
  // a true measurement of the wrong subject, which is the failure family this
  // repo keeps catching. Re-measure after the LAST src edit, not after the
  // first.
  //
  // AND THE RAISE BREAKS THIS BUDGET'S OWN STATED CONSTRUCTION, which is worth
  // reading before treating the number as settled. The paragraph above says
  // this ceiling is "set to the sum of the two real budgets so it can only fire
  // when something has gone wrong that neither of them already named". That was
  // literally true when written — eagerJsRaw 280,000 + lazyJsRaw 720,000 =
  // 1,000,000 exactly. p2·7 raised lazyJsRaw to 736,000 and left this line at
  // 1,000,000, so the identity lapsed there, one release before it cost
  // anything; the sum has been 1,016,000 since #174 while this line said
  // 1,000,000.
  //
  // 1,021,000 does not restore it either: eagerJsRaw 280,000 + lazyJsRaw
  // 759,000 = 1,039,000. So a build can now sit inside BOTH real budgets and
  // still red here — eager 279,000 + lazy 758,000 = 1,037,000 is legal by every
  // budget that is "sized from measurement" and illegal by this one. A backstop
  // below the sum of the things it backs stops being a backstop and becomes the
  // binding constraint, which is the grand-total failure line :26 rejects.
  //
  // RAISED TO built + margin ANYWAY, deliberately, because that is the
  // operator's standing policy for this PR (decided for lazy at #174, extended
  // to total on 2026-08-13) and a margin of 20,657 B would buy silence for
  // most of the remaining roadmap. Reconciling the two — either restoring
  // `totalJsRaw = eagerJsRaw + lazyJsRaw` as a DERIVED value that cannot lapse
  // again, or retiring this line in favour of the two budgets that replaced its
  // job — is a decision about what the backstop is for, and belongs in its own
  // change. Recorded here so the next raise is not made without seeing it.
  //
  // ── RAISED 1,021,000 -> 1,052,000 in p2·9 (Pulse). Third consecutive raise,
  //    and the reconciliation above is STILL OPEN — see the end of this note ──
  //
  // Measured, both endpoints BUILT from the same tree (fe4b999 -> this one,
  // `git stash -u` between the two builds), and re-measured after the LAST src
  // edit per the rule the paragraph above sets:
  //
  //     totalJsRaw   1,018,671  ->  1,049,839    +31,168
  //
  // Every byte attributed by diffing dist/assets/*.js file-by-file at both
  // endpoints, PAIRED BY MULTIPLICITY. The collision this file records at :420
  // is live in this delta rather than hypothetical: the stem `index` really
  // does hold two chunks here, they moved by DIFFERENT amounts, and one is
  // eager while the other is lazy — so a basename-keyed diff does not merely
  // lose a row, it attributes a lazy delta to the eager budget or vice versa.
  //
  //     pulse          (new view chunk)      +30,952   lazy
  //     index/mapDeps  (one more lazy entry)    +133   lazy
  //     index          (the eager entry)         +83   eager
  //     ---------------------------------------------
  //                                          +31,168
  //
  // Budget 1,052,000, so the margin is 2,161 B.
  //
  // THE EAGER TERM IS STRUCTURAL, NOT DRIFT, and it is the same +80-ish p2·8
  // recorded: p2·7b deliberately moved the view metadata into an eagerly-bundled
  // module so `nav/ia.ts` could read it under bare Node, so every future view
  // costs the eager bundle one row. 83 B rather than 80 because this view's
  // `label`/`sub` strings are a few characters longer. `eagerJsRaw`'s own
  // ceiling is UNTOUCHED at 280,000 (built 261,945, margin 18,055).
  //
  // THE RECONCILIATION IS STILL NOT DONE, AND THE GAP WIDENED. eagerJsRaw
  // 280,000 + lazyJsRaw 790,000 = 1,070,000 against this line's 1,052,000, so
  // the window in which a build is legal by both real budgets and illegal by
  // this backstop has grown from 18,000 B to 18,000 B — unchanged in size, but
  // now sitting 31,000 B further up the scale. Raised to built + margin anyway,
  // per the same standing operator policy, and the decision recorded above
  // remains exactly as open as it was. It is not this PR's to make: this PR
  // adds a view, and re-founding a budget's identity while shipping a feature
  // is how a backstop gets quietly redefined by whoever happened to cross it.
  //
  // ── RAISED 1,052,000 -> 1,082,000 in p2·10 (Circuit). Fourth consecutive
  //    raise, and the reconciliation above is STILL OPEN, unchanged ──
  //
  // Measured, both endpoints BUILT from the same tree — d388754 in an ISOLATED
  // `git worktree` with its own dist/ and its own node_modules, rather than by
  // stashing in place, so neither build could read the other's artifacts (the
  // shared-dist race this repo records). Re-measured after the LAST src edit
  // per the rule the paragraph above sets, and the rule earned its keep again:
  // the first reading of this delta was +29,460 and the final tree reads
  // +29,468, an 8 B drift from three later source edits that would have sat
  // inside the margin unseen.
  //
  //     totalJsRaw   1,049,839  ->  1,079,307    +29,468
  //
  // Every byte attributed by diffing dist/assets/*.js file-by-file at both
  // endpoints, PAIRED BY MULTIPLICITY. The collision this file records at :420
  // is live in this delta for the SECOND consecutive release: the stem `index`
  // holds two chunks, they moved by DIFFERENT amounts, and one is eager while
  // the other is lazy — so a basename-keyed diff does not merely lose a row, it
  // attributes a lazy delta to the eager budget.
  //
  //     circuit        (new view chunk)      +29,241   lazy
  //     index/mapDeps  (one more lazy entry)    +146   lazy
  //     index          (the eager entry)         +81   eager
  //     ---------------------------------------------
  //                                          +29,468
  //
  // 3 chunks moved of 65; the other 62 — including all nine pre-existing view
  // chunks — are byte-identical across the two builds. Each budget reconciles
  // exactly: 787,894 + 29,241 + 146 = 817,281 lazy, 261,945 + 81 = 262,026
  // eager, 1,049,839 + 29,468 = 1,079,307 total.
  //
  // Budget 1,082,000, so the margin is 2,693 B.
  //
  // THE EAGER TERM IS STRUCTURAL, NOT DRIFT — the same one p2·8 and p2·9 each
  // recorded, for the third time: p2·7b deliberately moved the view metadata
  // into an eagerly-bundled module so `nav/ia.ts` could read it under bare
  // Node, so every view costs the eager bundle one row. 81 B this time.
  // `eagerJsRaw`'s own ceiling is UNTOUCHED at 280,000 (built 262,026, margin
  // 17,974).
  //
  // THE RECONCILIATION IS STILL NOT DONE. eagerJsRaw 280,000 + lazyJsRaw
  // 820,000 = 1,100,000 against this line's 1,082,000, so the window in which a
  // build is legal by both real budgets and illegal by this backstop is 18,000
  // B — the same width for the third consecutive raise, and now sitting 82,000
  // B above where it was when the identity held. That the width is INVARIANT
  // across three raises is itself the argument that this is a mechanical
  // consequence rather than an accumulating error: both literals are being set
  // from measurement with similar margins, so the gap tracks the fixed
  // eagerJsRaw headroom and nothing else. Still not this PR's decision to make.
  // p3·18 RAISE, 1,150,000 -> 1,155,000. Built 1,151,568, margin 3,432. It moves
  // WITH lazyJsRaw, as the backstop it is, and the arithmetic is trivial this time
  // because ONE chunk moved: 1,147,466 + 4,102 = 1,151,568, to the byte.
  // The stated construction ("the sum of the two real budgets") remains broken —
  // 280,000 + 893,000 = 1,173,000 against this line's 1,155,000 — so a build can
  // still sit inside both real budgets and red on this one. Recorded again rather
  // than quietly repaired, for the reason the note below already gives: repairing
  // it means deciding what the backstop is FOR, and that is its own change.
  // p3·19 RAISE, 1,155,000 -> 1,162,000. Built 1,158,463, margin 3,537. It moves
  // WITH lazyJsRaw, as the backstop it is, and the arithmetic is exact because
  // eager did not move at all: 1,151,568 + 6,895 = 1,158,463, to the byte. The
  // same +6,895 is lazyJsRaw's whole delta, which is what "eager delta 0" means
  // when you can check it rather than assert it.
  // The stated construction ("the sum of the two real budgets") remains broken —
  // 280,000 + 900,000 = 1,180,000 against this line's 1,162,000, an 18,000 B
  // window, THE SAME WIDTH FOR THE FOURTH CONSECUTIVE RAISE. That invariance is
  // still the argument that it is a mechanical consequence of setting both
  // literals from measurement with similar margins, and not an accumulating
  // error. Recorded again rather than quietly repaired: repairing it means
  // deciding what the backstop is FOR, which is its own change.
  // p4·04 RAISE, 1,167,000 -> 1,195,000. Moves WITH lazyJsRaw as always, and
  // the arithmetic closes exactly: lazy +28,945 plus eager +499 = +29,444,
  // which IS this budget's whole delta (1,163,009 -> 1,192,453). Residual
  // ZERO on both halves.
  // The stated construction ("the sum of the two real budgets") remains
  // broken — 280,000 + 933,000 = 1,213,000 against this line's 1,196,000, a
  // 17,000 B window against p4·03's 18,000. Still recorded rather than
  // quietly repaired: repairing it means deciding what the backstop is FOR.
  /* p4·07 RAISE, 1,220,000 -> 1,238,000. Moves WITH lazyJsRaw as always. Built
     1,234,050 on the FINAL tree, margin 3,950. The stated construction ("the
     sum of the two real budgets") remains broken — 280,000 + 973,000 =
     1,253,000 against this line's 1,238,000, a 15,000 B window, narrowing again
     from p4·06's 17,000. Still recorded rather than quietly repaired, for the
     reason the note above gives: repairing it means deciding what the backstop
     is FOR, which is its own change. */
  /* p4·M3 RAISE, 1,238,000 -> 1,243,000. Moves WITH lazyJsRaw as the backstop
     it is, and the arithmetic is exact this time: this PR's whole delta is
     +5,286, it is entirely lazy, so both ceilings move by the same 5,000 and
     the gap between them is unchanged. Built 1,239,538, margin 3,462, against
     a post-merge base of 1,234,252 — the same +5,286, twice over.
     THE RECONCILIATION IS STILL NOT DONE and still is not this PR's to make:
     eagerJsRaw 280,000 + lazyJsRaw 978,000 = 1,258,000 against this line's
     1,243,000, so the "sum of the two real budgets" construction this comment
     block records has now been lapsed for eleven releases. */
  /* p4·M7 RAISE, 1,243,000 -> 1,247,000. Moves WITH `lazyJsRaw` by the same
     4,000 so the gap between them is UNCHANGED at 265,000, which is what the
     backstop is for. This PR's whole delta is +2,386 and it is entirely lazy.
     Built 1,244,003, margin 2,997, against a base of 1,241,617 — the same
     +2,386, twice over.
     THE RECONCILIATION IS STILL NOT DONE and still is not this PR's to make:
     eagerJsRaw 280,000 + lazyJsRaw 982,000 = 1,262,000 against this line's
     1,247,000, so the "sum of the two real budgets" construction this comment
     block records has now been lapsed for twelve releases. */
  /* p4·M8 RAISE, 1,247,000 -> 1,251,000. Moves WITH `lazyJsRaw` by the same
     4,000, so the gap between them is UNCHANGED at 265,000 — which is the
     construction the paragraph above describes and the reason this backstop
     exists. Built 1,246,370, margin 4,630, against a base of 1,244,003: the
     same +2,367 the per-stem pairing attributes, twice over.
     THE RECONCILIATION IS STILL NOT DONE and still is not this PR's to make:
     eagerJsRaw 280,000 + lazyJsRaw 986,000 = 1,266,000 against this line's
     1,251,000, so the "sum of the two real budgets" construction has now been
     lapsed for thirteen releases. */
  totalJsRaw: 1_266_000,  // p4·M9b: built 1,263,109 on the FINAL tree, margin 2,891 (0.23%).
  //   MOVED WITH lazyJsRaw BY THE SAME 4,000, so the documented gap between the
  //   two holds at 265,000 — this row's own construction, kept rather than
  //   quietly broken. eager +736 (the entry alone; its lazy sibling in the
  //   `index` stem is BYTE-IDENTICAL at 2,253) plus lazy +1,440 = +2,176, which
  //   IS this figure's whole delta. The two `index` chunks are split by reading
  //   dist/index.html's own <script src> rather than by basename — p2·9's trap,
  //   where they moved in opposite directions and one was lazy while the other
  //   was eager.
  // p4·M6c: built 1,258,300, margin 3,700 (0.29%).
  //   MOVED WITH lazyJsRaw BY THE SAME 4,000 so the documented gap between the
  //   two holds at 265,000 — this row's own construction, kept rather than
  //   drifted. (That construction's ORIGINAL sense, "the sum of the two real
  //   budgets", has been lapsed since #174 and is still not this PR's to
  //   restore; the gap is what is preserved here.)
  //   Moved WITH lazyJsRaw and by the same 7,000, so the gap between the two
  //   holds at 265,000 — the construction p4·M8 recorded. eagerJsRaw is
  //   untouched at 280,000 and did not need to move: this release adds SIX
  //   BYTES to the eager entry (101,533 -> 101,539), which is the footer's
  //   corrected fork date and nothing else.
  //   Attribution, paired per stem against an isolated 74bc561 worktree: 67 of
  //   74 stems SIZE-IDENTICAL; ProtocolDetail 0 -> 7,851 (a minted chunk) and
  //   FuturePage -7,463 — the extraction proving itself a MOVE and not a copy;
  //   ProtocolPage 0 -> 4,354; repoPulse +786 (data.ts gained the audit rows
  //   and the xmr.club rewrite); the EAGER entry +365, identified by reading
  //   dist/index.html's own <script src> rather than by basename, since the
  //   `index` stem holds two chunks; TrustedPeersPage -57 (gridTemplateColumns
  //   left the inline style for the sheet); SuperstressPage +2 (a route
  //   constant two characters longer). eager +365 + lazy +5,408 = +5,773 =
  //   the measured total delta. RESIDUAL ZERO on both halves.
                          // p4·03: built 1,163,009 on the FINAL tree, margin 3,991.
                          // p3·19: built 1,158,463 on the FINAL tree, margin 3,537.
                          // p3·16: built 1,146,258 on the FINAL tree, margin 3,742.
                          // p3·15: built 1,130,194, margin 3,806.
  // p3·16 RAISE, 1,134,000 -> 1,150,000. It moves WITH lazyJsRaw, as the
  // backstop it is: 1,130,218 + 16,040 = 1,146,258, to the byte. This budget's
  // stated construction ("the sum of the two real budgets") has been broken
  // since #174 and is not restored here either — 280,000 + 886,000 = 1,166,000
  // — so a build can sit inside both real budgets and still red on this one.
  // Recorded again rather than quietly repaired, because repairing it means
  // deciding what the backstop is FOR, and that is its own change.
                          // +3,563 = lazy +3,516 plus eager +47, residual ZERO —
                          // see the reconciliation beside lazyJsRaw. Raised WITH
                          // lazyJsRaw for the reason the note below already gives:
                          // this backstop stopped equalling eagerJsRaw + lazyJsRaw
                          // at p2·7 and has been set from measurement ever since.
                          // p3·14b: built 1,126,631 on the FINAL tree, margin 3,369.
                          // Re-measured with lazyJsRaw for the same reason; the
                          // mid-flight figure was 1,125,363. Crosses with
                          // lazyJsRaw as always. The +13,180 splits +13,121 lazy
                          // and +59 EAGER, and the eager 59 B is the whole of a
                          // decision taken deliberately: map.ts computed a
                          // block's `age` from a timestamp and then discarded
                          // it, so a streaming series appending from
                          // data.blocks would have rebuilt time as
                          // Date.now() − age·1000 and drifted against the
                          // seed's real block-header timestamps. Keeping the
                          // timestamp the server already sends costs 59 B in an
                          // eager chunk and removes a second time base from one
                          // axis. eagerJsRaw 262,934 ≤ 280,000, untouched.
                          // p3·14: built 1,111,757, margin 3,243. Crosses with
                          // lazyJsRaw, as it has every release since #174; the
                          // +6,872 reconciles to the byte against lazyJsRaw's
                          // per-chunk table above.
                          // p3·13: built 1,104,862, margin 3,138. Delta +13,585 =
                          // lazy +13,549 + eager +36, which reconciles to the byte
                          // against the per-chunk table in lazyJsRaw's note below.
                          // p3·12b: built 1,091,277, margin 2,723. Crosses with
                          // lazyJsRaw, as it has every release since #174. The
                          // stated construction ("the sum of the two real
                          // budgets") has been lapsed since then and is not
                          // restored here either: 280,000 + 831,000 = 1,111,000
                          // against this line's 1,094,000, so a build can still
                          // sit inside both real budgets and red on the
                          // backstop. Raised to built+margin per the standing
                          // policy; reconciling the three is still its own
                          // decision and still nobody has taken it.
  // ── THE SPLIT (v2·3), and it applies THIS FILE'S OWN STATED PRINCIPLE ──
  //
  // Line :26 already rejects the shape `totalJsRaw` has: "a single grand total
  // is rejected too: it would hide a 40 kB entry regression behind a 40 kB
  // lazy-chunk win. The five classes below each answer a different question."
  // `totalJsRaw` is exactly that grand total. The file stated the rule and then
  // carried one instance of what it forbids, and #170 is where that cost
  // something: a lazy view chunk growing on purpose was indistinguishable from
  // drift, and the red skipped 62 gate invocations to say so.
  //
  // The two populations are disjoint, sum to totalJsRaw, and behave nothing
  // alike. Measured across #170's 3.6x information rebuild of one view — both
  // endpoints BUILT, in an isolated worktree with its own dist/:
  //
  //                     260c99f      #170 head       delta
  //     eagerJsRaw      261,392        261,392           0   byte-identical
  //     lazyJsRaw       687,043        702,654     +15,611
  //     totalJsRaw      948,435        964,046     +15,611
  //
  // EAGER MOVED BY EXACTLY ZERO — index 98,477 and vendor 162,915, unchanged.
  // (An earlier note in this PR said "+3 B eager". That was wrong and the error
  // is instructive: the measuring script grouped chunks by basename with the
  // hash stripped, and there are TWO `index-*.js` chunks — the 98,477 entry and
  // a 2,064 lazy one. It summed them, so a +3 B change in the LAZY chunk was
  // reported against the EAGER population. A true number about the wrong
  // subject, from an aggregation key that collided.)
  //
  // eagerJsRaw — what every visitor pays before anything renders. 261,392
  // measured, budget 280,000 (93%). Deliberately tight: this population did not
  // move at all across a rebuild that tripled one view's information, so it has
  // no reason to drift, and eagerJsGz already guards the same set in gzip.
  // p3·12: CEILING UNTOUCHED at 280,000 (built 262,852, margin 17,148) — but
  // the entry chunk MOVED, +826 B, and this is a non-view PR where the brief's
  // own rule says any move is a finding owed an attribution. It is:
  //
  //   NOT new eager code. A string-level diff of the two entry chunks finds
  //   exactly ONE addition that is not minifier churn — `assets/canvasColor-
  //   *.js` joining the module-preload map, ~33 B. The rest is identifier
  //   renaming: adding a module to the graph shifts the mangler's name
  //   assignment, so short names get pushed to longer ones across the file.
  //
  //   The FIRST attempt did add eager code, and measuring it is why the shape
  //   changed. `cssColor` was homed in design/chart-kit.tsx — the obvious place,
  //   next to `canvasCursor` — and chart-kit is reachable from the entry through
  //   design/primitives.tsx, so the entry grew 757 B and carried the `var(…)`
  //   regex and the `#ffffff` fallback verbatim. Moving it to design/
  //   canvasColor.ts, which only lazy modules import, took that back.
  //
  //   THE INVARIANT NOW HAS NO GATE, and the margin is what makes that matter:
  //   17,148 B of headroom will absorb a future `import { cssColor }` from any
  //   eager module without a murmur. Named here and in the leaf's own header;
  //   an assertion that the leaf's bytes land in no eager chunk is the strong
  //   form and is not built.
  // p3·16: 263,385 built, ceiling UNCHANGED at 280,000 (94%). The 14th route
  // moved this by +404 B and every one was chased, because a new route's eager
  // cost is small, real, and the one place a "lazy" page can leak into first
  // paint. Measured against a build of e5eae16, entry chunk only:
  //
  //   mapDeps table          +68   38 -> 40 rows, the two new chunks. Vite's
  //                                hashes are fixed-length, so the ~30 OTHER
  //                                specifiers that changed are ROTATIONS and
  //                                contribute zero net bytes (p3·13 measured
  //                                the same thing and it holds here).
  //   ",OPERATE_SUPERSTRESS:" +23   the R key
  //   "Umbrel community app store" +28  the ia.ts leaf's `note`
  //   "Superstress hub"      +17   the ia.ts leaf's label
  //   "superstress"          +13   App.tsx's markChunkResolved key
  //   "./SuperstressPage-….js" +31 the new dynamic-import specifier
  //                        ─────
  //                         +180 named; the remaining ~224 is the minified
  //                              React.lazy declaration, the <Route> element
  //                              and the ia item object. NOT claimed as
  //                              residual-zero — it is attributed to a shape,
  //                              not to a byte count, and saying so is the
  //                              difference between a measurement and a story.
  //
  // THE NEGATIVE CONTROL IS THE HALF THAT MATTERS, and it is clean: `P2Pool`,
  // `disc-panel` and `SUPERBRAIN` — strings only the hub and its primitive
  // declare — grep to ZERO in the eager entry. The page's 14 KB of prose is
  // provably not in first paint.
  eagerJsRaw: 280_000,
  // lazyJsRaw — the population totalJsRaw's docstring was really describing:
  // "we shipped 200 kB of lazy code nobody has opened yet".
  //
  // RAISED 720,000 -> 736,000 in p2·7, and the raise is LOUD BY DESIGN: this
  // ceiling is meant to fire once per new view and be re-set deliberately, not
  // sized once to cover a roadmap nobody has built yet.
  //
  // MEASURED, both endpoints, built-to-built (1887edc -> this tree):
  //
  //     lazyJsRaw   711,561  ->  733,772    +22,211
  //
  // and every byte of that delta is attributed, because one of the four terms
  // is a chunk NOBODY WROTE:
  //
  //     orbital        (new view chunk)     +21,729
  //     useMemCanvas   (new SHARED chunk)    +2,763
  //     sediment                             -2,546
  //     index/mapDeps  (one more lazy entry)   +265
  //     -------------------------------------------
  //                                         +22,211
  //
  // THE SHARED-CHUNK SPLIT IS THE PART WORTH READING. `useMemCanvas.ts` had
  // exactly ONE consumer (sediment) and therefore rode inside sediment's chunk.
  // Orbital is the second consumer, so Rollup hoisted it out into a chunk of
  // its own: sediment got 2,546 B lighter and 2,763 B appeared somewhere new.
  // Net cost of the hoist is +217 B, but a reader diffing per-chunk sizes sees
  // a view they did not touch move by 2.5 kB — which is exactly the shape that
  // gets misread as "the build is non-deterministic" or, worse, as a stale
  // dist/. It is neither, and it was confirmed by rebuilding 1887edc's own tree
  // in place (60 chunks, 711,561) rather than by quoting a previous report. The
  // FIRST view to share a module with an existing view will always look like
  // this; the next three will not, because the hoist has already happened.
  //
  // Budget 736,000, so the margin is 2,228 B — deliberately under one view and
  // over one shared-chunk re-split, which is the only churn that has ever moved
  // this number without a view being added.
  //
  // IT WILL FIRE AGAIN, FOUR MORE TIMES, AND IT SHOULD. Mean view chunk across
  // the seven now shipped is 24,343 (classic 19,163 · reactor 19,204 ·
  // constellation 21,187 · orbital 21,729 · sediment 24,831 · bridge 28,318 ·
  // terminal 35,969). Relay, Abyss, Circuit and Pulse remain: 4 x 24,343
  // projects to ~831,144, which is 95,144 B over this ceiling. Raising it to
  // cover them now would buy silence for the whole roadmap and cost the one
  // signal this line exists to give.
  //
  // NAMED, NOT FIXED, AND OUT OF THIS PR'S SCOPE: `totalJsRaw` is 995,164
  // against 1,000,000 on this build — 4,836 B of headroom, less than a fifth of
  // one view. The next view crosses it. That is a separate budget with a
  // separate subject (see its own note above, including why its docstring
  // already overstates what it detects), and it is recorded here so its firing
  // is expected rather than surprising.
  //
  // ── RAISED 736,000 -> 759,000 in p2·8 (Abyss). SECOND of the four firings
  //    the paragraph above said were coming, and the prediction one paragraph
  //    further down came true in the same build: `totalJsRaw` crossed too ──
  //
  // MEASURED, both endpoints, built-to-built (b8b6be6 -> this tree, same
  // checkout, `git stash` between the two builds so nothing else could differ):
  //
  //     lazyJsRaw   733,233  ->  756,809    +23,576
  //
  // and every byte of that delta is attributed:
  //
  //     abyss          (new view chunk)      +23,443
  //     index/mapDeps  (one more lazy entry)    +133
  //     -------------------------------------------
  //                                          +23,576
  //
  // A CLEAN TWO-TERM DELTA, and the absence of a third term is the interesting
  // part. p2·7's raise had FOUR terms because `useMemCanvas.ts` gained its
  // second consumer and Rollup hoisted it into a shared chunk, moving sediment
  // by −2,546 B in a PR that never touched sediment. That hoist has already
  // happened, so Abyss — a third consumer of an ALREADY-SHARED module — costs
  // nothing beyond its own chunk. Confirmed rather than assumed: all seven
  // pre-existing view chunks are BYTE-IDENTICAL across the two builds
  // (reactor 19,204 · classic 19,163 · constellation 21,187 · orbital 21,729 ·
  // sediment 24,831 · bridge 28,318 · terminal 35,969), as are mem-stats,
  // mempool-shared and useMemCanvas. The note above predicted exactly this
  // ("the next three will not"), and this is the first of the three.
  //
  // Budget 759,000, so the margin is 2,191 B — same sizing rule as last time,
  // deliberately under one view and over one shared-chunk re-split.
  //
  // IT WILL FIRE AGAIN, THREE MORE TIMES, AND IT SHOULD. Mean view chunk across
  // the EIGHT now shipped is 24,230 (classic 19,163 · reactor 19,204 ·
  // constellation 21,187 · orbital 21,729 · abyss 23,443 · sediment 24,831 ·
  // bridge 28,318 · terminal 35,969 — recounted, not carried forward from the
  // seven-view figure of 24,343). Relay, Circuit and Pulse remain: 3 x 24,230
  // projects to ~829,499, which is 70,499 B over this ceiling.
  //
  // ── RAISED 759,000 -> 790,000 in p2·9 (Pulse). THIRD of the four firings the
  //    p2·7 note predicted, and the second consecutive clean two-term delta ──
  //
  // MEASURED, both endpoints, built-to-built (fe4b999 -> this tree, same
  // checkout, `git stash -u` between the two builds so nothing else could
  // differ), and RE-MEASURED after the last src edit rather than carried from
  // the first build — see the near-miss note at the end of this block:
  //
  //     lazyJsRaw   756,809  ->  787,894    +31,085
  //
  // and every byte of that delta is attributed, PAIRED BY MULTIPLICITY rather
  // than by stripped basename, because TWO chunks reduce to the stem `index`
  // (see the note at :420) and a basename-keyed diff silently pairs the wrong
  // two:
  //
  //     pulse          (new view chunk)      +30,952
  //     index/mapDeps  (one more lazy entry)    +133
  //     -------------------------------------------
  //                                          +31,085
  //
  // The `index` stem's two chunks pair 1,926 -> 2,059 (+133, LAZY, the mapDeps
  // table) and 98,947 -> 99,030 (+83, EAGER, the mempool-meta row). The eager
  // term is the +83 that shows up in `eagerJsRaw` below and is NOT part of this
  // delta; splitting them is exactly what the multiplicity pairing buys.
  //
  // Confirmed rather than assumed: all EIGHT pre-existing view chunks are
  // BYTE-IDENTICAL across the two builds (classic 19,163 · reactor 19,204 ·
  // constellation 21,187 · orbital 21,729 · abyss 23,443 · sediment 24,831 ·
  // bridge 28,318 · terminal 35,969), as are mem-stats, mempool-shared and
  // useMemCanvas. Pulse is a FOURTH consumer of the already-hoisted
  // useMemCanvas chunk, so it costs nothing beyond its own — the p2·7 note
  // predicted "the next three will not" and this is the second of the three.
  //
  // Budget 790,000, so the margin is 2,106 B — same sizing rule as the last
  // two, deliberately under one view and over one shared-chunk re-split.
  //
  // IT WILL FIRE AGAIN, TWICE MORE, AND IT SHOULD. Mean view chunk across the
  // NINE now shipped is 24,977 (classic 19,163 · reactor 19,204 ·
  // constellation 21,187 · orbital 21,729 · abyss 23,443 · sediment 24,831 ·
  // bridge 28,318 · pulse 30,952 · terminal 35,969 — RECOUNTED, not carried
  // forward from the eight-view figure of 24,230; the mean rose because Pulse
  // is the second-largest chunk in the set). Relay and Circuit remain: 2 x
  // 24,977 projects to ~837,848, which is 47,848 B over this ceiling.
  //
  // WHAT REMAINS HONESTLY UNCERTAIN: Circuit is specified (spec:142-143) and
  // will land. Relay is PARKED — its own brief records that the public
  // restricted-RPC cascade exposes no peer topology, so it either ships as
  // protocol illustration or stays behind a "Soon" treatment, and neither
  // shape's chunk size is predictable from this mean. The projection above is
  // therefore a floor for Circuit and a guess for Relay.
  //
  // THE NEAR-MISS THIS RAISE INHERITED, recorded because it is now a rule: p2·8
  // measured its delta, wrote its ceilings from it, and then landed three more
  // rounds of render-driven fixes — so both comments would have shipped
  // describing a tree that no longer existed. This raise was re-measured after
  // the LAST src edit (the roll-out guards in pulse-instruments.tsx), and the
  // reds below were re-demonstrated on that same final tree rather than quoted
  // from the first build. The first build here read 787,256; the final one
  // reads 787,894, a 638 B drift that would have sat inside the margin and
  // never shown itself.
  // ── RAISED 790,000 -> 820,000 in p2·10 (Circuit). FOURTH of the four firings
  //    the p2·7 note predicted, and the third consecutive clean two-term delta.
  //    The prediction is now SPENT: this is the last one it named ──
  //
  // MEASURED, both endpoints, built-to-built — and by a DIFFERENT method from
  // the last three, deliberately. The baseline (d388754) was built in an
  // ISOLATED `git worktree` with its own dist/ and its own node_modules rather
  // than by stashing in place, so the two builds could not read each other's
  // artifacts. `git stash -u` is correct and was used three times; it is also
  // one command away from the shared-dist race this file's siblings record,
  // because a clean `git status` is not a clean SUBJECT while dist/ still holds
  // the other tree's output. A worktree makes that class impossible instead of
  // avoided.
  //
  //     lazyJsRaw   787,894  ->  817,281    +29,387
  //
  // and every byte of that delta is attributed, PAIRED BY MULTIPLICITY rather
  // than by stripped basename, because TWO chunks reduce to the stem `index`
  // (see the note at :420) and a basename-keyed diff silently pairs the wrong
  // two:
  //
  //     circuit        (new view chunk)      +29,241
  //     index/mapDeps  (one more lazy entry)    +146
  //     -------------------------------------------
  //                                          +29,387
  //
  // The `index` stem's two chunks pair 2,059 -> 2,205 (+146, LAZY, the mapDeps
  // table) and 99,030 -> 99,111 (+81, EAGER, the mempool-meta row). The eager
  // term is NOT part of this delta; splitting them is exactly what the
  // multiplicity pairing buys, and this is the SECOND consecutive release in
  // which the two chunks moved by different amounts — it has stopped being a
  // hypothetical hazard and become the ordinary case.
  //
  // Confirmed rather than assumed: all NINE pre-existing view chunks are
  // BYTE-IDENTICAL across the two builds (classic 19,163 · reactor 19,204 ·
  // constellation 21,187 · orbital 21,729 · abyss 23,443 · sediment 24,831 ·
  // bridge 28,318 · pulse 30,952 · terminal 35,969), as are mem-stats,
  // mempool-shared and useMemCanvas — 3 chunks moved of 65. Circuit is a FIFTH
  // consumer of the already-hoisted useMemCanvas chunk, so it costs nothing
  // beyond its own.
  //
  // Budget 820,000, so the margin is 2,719 B — same sizing rule as the last
  // three, deliberately under one view and over one shared-chunk re-split.
  //
  // AND THE PROJECTION COLLAPSES HERE, WHICH IS WORTH MORE THAN THE NUMBER.
  // Mean view chunk across the TEN now shipped is 25,404 (classic 19,163 ·
  // reactor 19,204 · constellation 21,187 · orbital 21,729 · abyss 23,443 ·
  // sediment 24,831 · bridge 28,318 · circuit 29,241 · pulse 30,952 · terminal
  // 35,969 — RECOUNTED, not carried forward from the nine-view figure of
  // 24,977; span 19,163–35,969). Every previous note here projected "N views
  // remain × the mean". ONLY RELAY REMAINS, AND NO MEAN PROJECTS IT: its own
  // brief records that the public restricted-RPC cascade exposes no peer
  // topology, so it either ships as protocol illustration or stays behind the
  // "Soon" treatment NetworkPage's peer panel uses, and those two shapes differ
  // by more than the span of this whole set. It is also PARKED, so there is no
  // date to project to. The honest successor to the projection line is one
  // sentence: this ceiling will fire once more if Relay ever ships, by an
  // amount nobody can estimate today, and until then it should not move.
  //
  // p3·12: 820,000 -> 831,000. Built 828,425, margin 2,575.
  //
  // p3·12b re-measured every figure in this block on the FINAL tree and all of
  // them moved. The previous text said "built 828,312, margin 1,688" — a stale
  // measurement AND, independently, bad arithmetic, since 831,000 - 828,312 is
  // 2,688 and not 1,688. Two ways of being wrong in one line is the argument
  // for deriving a margin rather than typing it.
  //
  // Attributed by a file-by-file dist diff PAIRED BY MULTIPLICITY (the `index`
  // stem holds two chunks and they moved by different amounts again — fourth
  // consecutive release):
  //
  //     MarketsPage   +15,926   the canvas hero, brush, table, granularity ladder
  //     charts         -5,136   CandleChart deleted; nothing rendered it after this
  //     canvasColor      +343   NEW chunk — cssColor, split out of useMemCanvas
  //     useMemCanvas     -239   the same function leaving
  //     index[1]         +826   EAGER; see the note on eagerJsRaw
  //     index[0]          +48   the preload map gains one entry
  //     abyss            +38  ┐
  //     circuit          +38  │ the FIVE cssColor importers, module-graph
  //     orbital          +38  ├ re-resolution — source untouched
  //     pulse            +38  │
  //     sediment         +38  ┘
  //     reactor          +10  ┐
  //     mem-stats         +5  │ four more movers with no source change
  //     MoneroPage        +2  │
  //     mempool-shared    -5  ┘
  //                  ────────
  //     TOTAL        +11,970   == 1,091,277 - 1,079,307, exactly
  //
  // The tail of that table is worth reading twice, because the last three raises
  // could all say "every view chunk byte-identical" and this one cannot. Those
  // chunks' SOURCE is untouched; they moved because the shared module graph they
  // resolve through gained a member, which shifts minified identifiers. A delta
  // with no source behind it is still a delta and is listed rather than rounded
  // away — p3·12 wrote "six view chunks ±38 ea", which was wrong twice over:
  // FIVE moved by 38 (they are exactly the five cssColor importers, which is why
  // the number is 38 and not noise), and four others moved by amounts the row
  // did not mention at all. A summary that rounds four rows into "±38 ea" stops
  // being an attribution and becomes an impression.
  //
  // ── p3·13 · 831,000 -> 845,000. Built 841,974, margin 3,026. ──────────────
  // FIVE chunks moved of 67; the other 62 are byte-identical, which is what
  // makes this an attribution rather than a story. Paired by MULTIPLICITY, not
  // basename — the `index` stem holds two chunks and the pairing asks
  // dist/index.html which one is the entry, because a basename-keyed diff does
  // not merely lose a row here, it files a LAZY delta under the EAGER budget:
  //
  //     timeline          0  ->  12,973   +12,973   lazy   (new shared leaf)
  //     EducationPage  45,721 ->  36,503    -9,218   lazy   (the data left it)
  //     MarketsPage    31,906 ->  37,805    +5,899   lazy
  //     charts         15,231 ->  19,162    +3,931   lazy   (timeCursor inlined here)
  //     index[ENTRY]   99,937 ->  99,960       +23   EAGER
  //                                        ────────
  //                                 lazy   +13,585
  //
  // lazy +13,585 and total +13,608 reconcile to the byte against this table.
  // (An earlier draft of this block read +36/+5,925/+3,869 — true of a tree
  // three commits old. Only the FINAL tree's figures may ship, which is the
  // whole content of the re-measure rule and the third time this session it
  // caught something.)
  //
  // THE +23 EAGER BYTES ARE STRUCTURAL AND THEY ARE NOT A LEAK — this was a
  // non-view PR under an explicit "eager must not move" instruction, so they
  // were chased to the byte. +30 of them are ONE new string in Vite's
  // `__vite__mapDeps` preload table ("assets/timeline-CWoXTI3v.js"), which
  // grows by a row whenever a lazy chunk is minted; the remaining -7 is the
  // rest of the entry getting marginally shorter as the indices into that
  // table shift. Measured, not inferred: the mapDeps array went 37 -> 38
  // entries with exactly that one addition and no removals, its block grew
  // exactly 30 B, and the entry grew 23. The
  // NEGATIVE CONTROL is the half that matters — `grep 'Bitcoin Whitepaper
  // Published'` and `grep 'CryptoNote v1'` both return 0 in index[ENTRY] AND in
  // vendor, so 13 KB of timeline prose is provably NOT in first paint. That is
  // the canvasColor rule holding: a shared leaf is free only if every importer
  // is lazy, and both of this PR's importers (EducationPage, MarketsPage) are.
  //
  // ── AND HERE IS WHAT CATCHES A VIOLATION. IT IS NOT THE EAGER BUDGET. ─────
  // p3·13's own comments first said "there is no gate on that; eagerJsRaw's
  // headroom would swallow it" — asserted from a plausible mechanism, which is
  // the failure family this repo has paid for more than any other. Measured
  // instead, by importing `@/data/timeline` from the eager App.tsx with an
  // unshakeable reference and rebuilding:
  //
  //     entry chunk    99,973 -> 112,914 B raw   +12,941
  //     eagerJsRaw    262,888 -> 275,829   <= 280,000    PASSES
  //     eagerJsGz      88,196 ->  93,663   <=  96,000    PASSES
  //     lazyJsRaw     841,974 -> 828,932   <= 845,000    PASSES (went DOWN)
  //     totalJsRaw  1,104,862 -> 1,104,761 <= 1,108,000  PASSES
  //     chunk count        67 -> 66        within 64±4   PASSES (the leaf's
  //                                                      own chunk was ABSORBED)
  //     per-route first load                             10 of 13 RED
  //
  // Every budget named for eager weight passes, and the two detectors most
  // likely to notice both moved the REASSURING way. What reds is the per-route
  // table, as a side effect — eleven routes that never show a timeline paying
  // for one. The three that stay green are the hole worth knowing: `/`,
  // `/live/markets` and `/learn`. `/` is the LCP route this rule exists to
  // protect, and it does not notice.
  //
  // It is also a SIZE threshold rather than a rule. The tightest per-route
  // margin on the clean tree is /about/sources at 642 B gzip, so an eager leak
  // under ~650 B gzip (~2 KB raw) clears every ceiling in this file. 13 KB was
  // loud; a helper function would be silent. Writing the real assertion — "no
  // eager chunk contains a string only this leaf declares" — is a small,
  // separate change and is deliberately NOT taken here.
  // ── p3·18 RAISE, 886,000 -> 893,000. Built 889,208 on the FINAL tree, margin 3,792.
  //
  // THE CLEANEST ATTRIBUTION IN THE SERIES: exactly ONE chunk changed size.
  // `MoneroPage` 66,829 -> 70,931, **+4,102**, and that single number IS both
  // deltas — lazyJsRaw 885,106 -> 889,208 and totalJsRaw 1,147,466 -> 1,151,568
  // are the same +4,102. Eager delta **0**, residual **ZERO**. Measured against a
  // 1d64871 build in an ISOLATED git worktree with its own dist/, not by stashing
  // in place (p2·10's rule: a clean `git status` is not a clean SUBJECT while
  // dist/ still holds the other tree's output).
  //
  // ── "BYTE-IDENTICAL" HAS BEEN THE WRONG WORD IN THIS FILE'S NOTES, and p3·18
  //    measured it. ────────────────────────────────────────────────────────────
  // Previous raises here say things like "62 of 67 byte-identical". Keyed on
  // sha256 rather than on size, the truth at this raise is:
  //     size-identical                              68
  //       of which TRULY byte-identical              8
  //       same size, content ROTATED (hash cascade) 60
  //     size-CHANGED                                 1   (MoneroPage)
  // A chunk's emitted text embeds the HASHES of the chunks it imports, and Vite's
  // hashes are fixed-length — so one module's content change rotates its hash,
  // which rewrites every importer's text at IDENTICAL length, which rotates their
  // hashes in turn. One edit rotated 60 of 68 chunks. The `index` entry is the
  // sharp case: 99,445 B on BOTH sides with **55 differing runs**, all
  // fixed-length hash rotations inside `__vite__mapDeps`.
  //
  // Consequence worth holding, because it is the only thing this changes: the
  // budget attribution is UNAFFECTED (budgets count bytes per file, and sizes are
  // exact), but `eagerJsRaw` can be byte-count-identical while `eagerJsGz` moves —
  // here 262,360 B raw on both sides against 87,904 -> 87,914 gzip, **+10 B from
  // compressibility alone**. That +10 is not a regression and nothing was added to
  // the eager graph; the negative control is clean and was run rather than
  // reasoned about: `BitLicense`, `FinCEN` and `Bappebti` each grep to **0** in the
  // served entry chunk, so no legality prose reached first paint.
  // p3·19 RAISE, 893,000 -> 900,000. Built 896,103 on the FINAL tree, margin 3,897.
  // THE CLEANEST ATTRIBUTION SINCE p3·18, and it reconciles to the byte. Four
  // chunk slots moved of 69; the other 65 are size-identical:
  //     SuperstressPage  14,529 -> 21,188   +6,659   (the guide itself)
  //     repoPulse        17,300 -> 17,465     +165   (see below — NOT the pulse)
  //     stressnet         9,243 ->  9,283      +40   (the simulator's corrected copy)
  //     FuturePage       19,656 -> 19,687      +31   (the band's corrected copy)
  //                                          ------
  //                                          +6,895  = the WHOLE lazy delta, residual ZERO
  // 889,208 + 6,895 = 896,103, and 1,151,568 + 6,895 = 1,158,463. Both to the byte.
  //
  // `repoPulse` IS A LABEL, NOT A CONTENTS LIST — p3·16 recorded this and it is
  // worth re-reading here, because the obvious story is wrong twice over. That
  // chunk is where `pages/future/data.ts` lands, and data.ts is what this PR
  // edited; `repoPulse.tsx` itself is untouched. Vite names a chunk after ONE of
  // its member modules, so a delta filed under "repoPulse" says nothing about the
  // repo pulse.
  //
  // THE +42 THAT ALMOST SHIPPED WRONG, AND IT ALMOST SHIPPED TWICE. A mid-flight
  // measurement read 896,061 and this comment was drafted from it, with the table
  // above reading `SuperstressPage +6,617` and a total of `+6,853`. One later src
  // commit — wrapping the maintainer quote in a `<p>` so it inherits the site's
  // own 74ch reading measure — moved it to 896,103. The ceiling was inside its
  // margin either way, which is exactly what makes this the dangerous shape: the
  // GATE would have stayed green while every attributed figure in this comment
  // described a tree that no longer existed. Caught only by re-running the
  // attribution script against the FINAL dist rather than reusing the table
  // already written down; the whole 42 B lands in SuperstressPage. That is the
  // re-measure family, and this is the fourth consecutive release it has caught.
  //
  // `eagerJsRaw` DID NOT MOVE AT ALL — 262,360 on both sides, delta exactly 0,
  // which is what makes the single figure +6,895 serve as BOTH this budget's
  // delta and totalJsRaw's. `SITE_PR` 187 -> 188 is length-preserving, so even
  // the eager entry's one edited literal costs nothing. `cssGz` is BYTE-IDENTICAL
  // at 17,900 against a 300 B margin: the guide adds ZERO stylesheet rules and
  // reuses .kicker/.mono/.dim/Card/Pill plus inline styles, and the one place it
  // wanted a rule (the quote's measure) was solved by inheriting an existing
  // selector instead of writing a new one. `CHUNK_COUNT` holds at 69 — nothing
  // minted. Both route ceilings HELD and were NOT raised: /operate/superstress
  // 103,506 of 105,000 (margin 1,494) and /future 104,836 of 107,000 (2,164).
  // Baseline built in an ISOLATED `c6b518e` worktree; attribution keyed on chunk
  // STEM and paired by MULTIPLICITY, because this build stamps content and a
  // filename-keyed diff reports 69 additions and 69 deletions rather than a delta.
  // p4·04 RAISE, 904,000 -> 932,000, and it is the SIMPLEST attribution this
  // budget has ever recorded: ONE term. `/operate/mine` is a new lazy route,
  // so Rollup mints `MinePage-*.js` and nothing else moves —
  //
  //     MinePage   (new route chunk)   +28,945
  //     ---------------------------------------
  //                                    +28,945
  //
  // and `ls -la dist/assets/MinePage-*.js` reads 28,945 B, which is the WHOLE
  // lazy delta to the byte (900,457 -> 929,402). Aggregate equality alone
  // could still hide two offsetting moves, so it was PAIRED per stem against
  // an ISOLATED `git worktree` build of fdb105e with its own dist/ and its own
  // node_modules — see the release note for the per-stem table.
  //
  // The page imports NO new shared module. That is a decision, not luck: the
  // obvious way to write it was to derive the Superbrain miner line from
  // `pages/future/data.ts`, which would have given that module a FOURTH
  // importer group and split it into a chunk of its own — a second mint on
  // top of this route's, against a CHUNK_COUNT already on its band ceiling.
  // MinePage.tsx's header records why linking beat deriving.
  /* p4·07 RAISE, 956,000 -> 973,000. Built 969,578 on the FINAL tree, margin
     3,422; red first at `❌ lazy JS 969578 B raw ≤ 956000`.

     ATTRIBUTION, paired per stem against the 0f00d26 baseline build, RESIDUAL
     ZERO on both halves — 68 of 73 shared stems SIZE-IDENTICAL:
         StressnetExplorerPage   0 -> 16,564   a MINTED chunk, the new lazy route
         index (both members)         +651     ALL of it eager — see below
         SuperstressPage              +212     the explorer crosslink
         stressnet + stressnet-model  +211     the extraction's boundary cost
         repoPulse                     +55     data.ts's link row closing
         SimulatePage                  +40     the model's import path moving
         -----------------------------------------------------------------
         sum                       +17,733
         measured lazy  952,496 -> 969,578  = +17,082
         measured eager 263,821 -> 264,472  =    +651
         17,082 + 651 = 17,733                RESIDUAL 0 ✓

     THE EAGER +651 IS ENTIRELY THE ENTRY CHUNK, and that was read out of
     dist/index.html's own <script src> rather than taken by basename: the
     `index` stem holds THREE files (the CSS, the 101,557 B entry, a 2,253 B
     lazy chunk), and p2·9 recorded that its members can move in opposite
     directions and land in different budgets. The lazy member is
     BYTE-IDENTICAL at 2,253.

     Of that +651, ~86 B is the preload table gaining two strings
     (`assets/StressnetExplorerPage-*.js` and `assets/stressnet-model-*.js`);
     the rest is the registration SHAPE across five eager modules plus ia.ts's
     new leaf note, and is NOT claimed as residual-zero.

     NEGATIVE CONTROL, run rather than reasoned: every string only the explorer
     declares — `BETANET`, `TEST FUNDS ONLY`, `sim:`, `STORM CAMPAIGN`,
     `ff5cf0`, `SIMULATED POOL` — greps to ZERO in the eager entry and >0 in
     the explorer's own chunk. The single expected exception is `wind tunnel`
     at 1, which is ia.ts's nav-leaf note; ia.ts is eager via NavTop, so that
     is a correctly-attributed eager cost rather than a leak. */
  /* p4·M3 RAISE, 973,000 -> 978,000. Built 974,855 on the FINAL tree, margin
     3,145; red first at `❌ lazy JS 974855 B raw ≤ 973000`.

     THE ATTRIBUTION IS THREE TERMS AND THE RESIDUAL IS ZERO. Paired per chunk
     STEM against an ISOLATED `git worktree` build of 5c66929 (main AFTER p4·M2
     merged mid-flight), 74 of 77 slots SIZE-IDENTICAL:
         repoPulse           18,306 -> 22,895   +4,589
         EcoPopup             4,163 ->  4,683     +520
         TrustedPeersPage     3,506 ->  3,683     +177
                                              = +5,286
     and +5,286 is this budget's whole delta AND `totalJsRaw`'s whole delta,
     which is what "eager moved by zero" means arithmetically rather than
     hopefully. `eagerJsRaw` AND `eagerJsGz` are both byte-identical across the
     pair (264,448 and 88,505), so the eager delta is EXACTLY ZERO on both
     measures rather than zero-plus-compressibility.

     RE-DERIVED THREE TIMES, AND EVERY FIGURE IN THIS BLOCK MOVED EACH TIME
     WHILE EVERY CEILING STAYED GREEN — which is the whole reason the rule is
     RE-DERIVE rather than "check the gate is green". A budget comment is not
     gated by the budget it annotates. (1) The first measurement read 974,855;
     the SITE_PR bump and the footer-row repair landed after it, +56. (2) Then
     p4·M2 MERGED INTO main MID-FLIGHT, moving HomePage, SitePage and
     ThemeToggle — so every route's first load moved with them and none of
     this PR's numbers could be carried forward. Re-paired against the new
     base: the attribution came back IDENTICAL, same three stems and the same
     +5,286, which is the useful result — this PR's delta is orthogonal to
     p4·M2's, and the eager figures that differ are entirely theirs.

     `repoPulse` IS WHERE data.ts LANDS, and that is not a surprise to be
     re-derived next release — p3·19 recorded it: a chunk name is a label Vite
     takes from one member module, not a contents list. The 4,589 is two new
     PARTNER entries plus the shot fields and the in-file reasoning.

     THE 190 KB OF SCREENSHOTS ARE NOT IN THIS NUMBER AND SHOULD NOT BE.
     `public/peers/*.webp` are static assets served from `dist/peers/`; they
     are not JS, they are not in any chunk closure, and they are requested only
     when a reader opens a brief. What they DO cost is page weight on that
     interaction, and no budget in this file measures it — stated here so the
     absence is deliberate rather than assumed. Largest single shot: 53,936 B. */
  /* p4·M7 RAISE, 978,000 -> 982,000. Built 979,555 on the FINAL tree, margin
     2,445. Red first at `❌ lazy JS 979150 B raw ≤ 978000` before the raise —
     that 979,150 is a DATED quote of the first reading, not the final figure,
     and this line used to pair it with a margin computed from a later one
     (982,000 - 979,150 is 2,850, not the 2,711 it claimed). A pre-merge audit
     caught the disagreement. Keep the two apart: the built figure and its
     margin must come from the SAME measurement, and a historical red is a
     quote.

     THE ATTRIBUTION IS ONE TERM AND THE RESIDUAL IS ZERO — the simplest this
     table has recorded. Paired per chunk STEM against an ISOLATED `git
     worktree` build of 5854cbd with its own dist/ and node_modules, served on
     its own port with the holder confirmed by `lsof` + /proc/<pid>/cwd. 75 of
     76 files SIZE-IDENTICAL:

         ColdBoot        33,632 -> 36,018     +2,386
                                            = +2,386

     and +2,386 IS `totalJsRaw`'s whole delta as well, which is what proves the
     eager half did not move.

     RE-DERIVED AFTER THE LAST SRC COMMIT, AND IT HAD MOVED. The first
     measurement read 979,150 / +1,981; the ordering assertion's plumbing
     (`markLockFrom`, `markFontSettledAtT`) landed afterwards and took it to
     979,289 / +2,120. THEN IT MOVED A THIRD TIME: a pre-merge audit of this
     PR's own diff found the wrapped closing line resolving out of reading
     order, and that fix plus its published `closingRowLocks` took it to
     979,555 / +2,386. EVERY CEILING WAS GREEN THROUGH ALL THREE — the margin
     absorbed every one — which is exactly why the rule is re-derive rather
     than "check the gate is green". A budget comment is not gated by the
     budget it annotates, and three re-derivations inside one release is the
     strongest evidence this file carries for that. `eagerJsRaw` is BYTE-IDENTICAL at 264,448 and
     `cssGz` BYTE-IDENTICAL at 18,184 — the release adds no stylesheet rule at
     all. `eagerJsGz` moves by −1 B, from compressibility alone.

     `SITE_PR` 199 -> 200 contributed EXACTLY 0 to the eager figure, three
     digits changing value at identical length — p4·01 measured that directly
     and this reproduces it.

     NO ROUTE ROW MOVES, and the reason is structural rather than lucky:
     `ColdBoot` is `React.lazy` in App.tsx, so it is a DYNAMIC import, and
     `staticClosure` reads `.imports` and never `.dynamicImports`. The splash is
     a second round-trip that no route's first load pays for. */
  /* p4·M8 RAISE, 982,000 -> 986,000, ALSO UNCROSSED and for the same stated
     reason: built 981,923 leaves 77 B, which is 0.008% — an identifier rename
     would red it. The delta is +2,367 and it is ENTIRELY LAZY, paired per stem
     against an ISOLATED `git worktree` build of 1ba3923 with its own dist/ and
     node_modules: `classic` 19,163 -> 20,852 (+1,689) · `mempool` 7,054 ->
     7,629 (+575) · `tx` 30,344 -> 30,447 (+103) = +2,367, which IS
     `totalJsRaw`'s whole delta too. RESIDUAL ZERO on both halves.
     72 of 75 stems SIZE-IDENTICAL. The EAGER entry is BYTE-IDENTICAL at 101,533
     — this release adds no eager byte at all, which is what a change confined
     to one lazy view and one lazy shared component should read as. Chunk count
     76 = 76, nothing minted: `useLadderAnchor.ts` is a new module but every one
     of its importers is already inside classic's chunk group. */
  lazyJsRaw: 1_001_000, // p4·M9b: built 997,403 on the FINAL tree, margin 3,597 (0.36%).
  //   RED-THEN-GREEN at 997,403 against 997,000. Attribution is RESIDUAL ZERO
  //   over three terms, paired per chunk STEM by MULTISET against a snapshot of
  //   the untouched 8dc7a56 build: SectionSheet 0 -> 1,147 (minted) + classic
  //   +228 (the tier footer's spans) + V6Modal +65 (the optional variant prop)
  //   = +1,440, which IS this budget's whole delta. 72 of 76 slots are
  //   size-identical. The stem is taken with the LAST -<8 chars>.js stripped:
  //   a Vite hash draws from [A-Za-z0-9_-], so the dash is IN the alphabet and
  //   rsplit('-',1) mis-pairs — p4·M6c recorded exactly that, reporting 37
  //   stems moved where 2 had.
  // p4·M6c: built 993,843, margin 3,157 (0.32%).
  //   Two peer entries of prose in pages/future/data.ts. The delta is +3,256
  //   against a MEASURED base of 990,587 at 9f9e176 — which is also exactly
  //   the figure #204's report implies, so the derivation and the build agree.
  //   +3,256 is ALSO totalJsRaw's whole delta, which is what proves the eager
  //   half did not move: eagerJsRaw is BYTE-IDENTICAL at 264,457 across the
  //   pair, and cssGz BYTE-IDENTICAL at 18,586 (this release adds no
  //   stylesheet rule at all — §4's repair is a comment). CHUNK_COUNT 76 = 76,
  //   nothing minted. eagerJsGz moves +8 with raw unmoved: compressibility
  //   alone from the hash cascade, p4·01's recorded phenomenon, and SITE_PR
  //   204 -> 205 contributes exactly 0 raw bytes — three digits at identical
  //   length, reproducing p4·01/p4·M6/p4·M7's own measurement.
  //   The whole +6,789 is attributed and reconciles to the byte against an
  //   ISOLATED worktree build of 9fcc24a: repoPulse +2,923 (the chunk data.ts
  //   lands in — the audit finding, Carrot's re-derivation and Cuprate's
  //   release are all prose in that one module), FuturePage +1,804 (three
  //   bands where there was one grid), ProtocolDetail +1,332 (the review
  //   block and the runnable-today line), EcoPopup +504 (the second CTA), and
  //   six copy-edit deltas of 86/69/38/26/6/1 across the surfaces carrying the
  //   corrected fork date. 65 of 74 stems are SIZE-IDENTICAL and the residual
  //   is ZERO. Nothing was minted: 76 chunks both sides.
  //   RE-DERIVED after the LAST src commit, not after the last green run: the
  //   first measurement read 952,561 and three later commits (SITE_PR, a
  //   stylesheet comment repair, two copy fixes) moved it by 65 B. Nothing
  //   failed while the comment was wrong — the ceiling had margin — which is
  //   exactly why the rule is re-derive rather than "check the gate is green".
                        //   RE-DERIVED TWICE, and both times it had moved: the
                        //   first measurement read 928,203, later copy edits took
                        //   it to 929,518, and two render fixes landed it at
                        //   929,402 — every ceiling GREEN throughout, so nothing
                        //   would have reported the prose going stale. A budget
                        //   comment is not gated by the budget it annotates;
                        //   that is p3·19's recorded near-miss, twice in one PR.
                        // p4·03: built 900,457 on the FINAL tree, margin 3,543.
                        // p3·19: built 896,103 on the FINAL tree, margin 3,897.
                        // p3·16: built 882,873 on the FINAL tree, margin 3,127.
                        // p3·15: built 867,213, margin 3,787.
  //
  // p4·03 RAISE, 900,000 -> 904,000. The release ledger: PR bodies rendered
  // behind a disclosure, plus the commit work log. Attribution is keyed on
  // chunk STEM and paired by MULTIPLICITY against a 543a8d8 build, and it
  // RECONCILES TO THE BYTE with residual ZERO:
  //     SourcesPage      14,330 ->  17,928   +3,598   (the ledger UI)
  //     Disclosure            0 ->     791     +791   (a MINTED chunk — see below)
  //     useCachedFeed     2,508 ->   3,049     +541   (useReleaseLedger)
  //     index[1] (EAGER) 99,599 ->  99,637      +38
  //     SuperstressPage  21,188 ->  20,577     -611   (Disclosure left it)
  //     ─────────────────────────────────────────────
  //     total                              +4,357 = lazy +4,319 and eager +38
  // 65 of 70 chunk slots are size-identical.
  //
  // THE 70th CHUNK IS THE LEAF LESSON'S FIFTH APPLICATION, and it is the whole
  // reason SuperstressPage got SMALLER. `design/Disclosure.tsx` had exactly two
  // importers, both in one chunk group, so Rollup INLINED it there. SourcesPage
  // is a third importer in a different group, so the leaf was hoisted into a
  // chunk of its own and subtracted from the page that used to carry it. The
  // standing rule is not "a shared leaf costs a chunk" but "a leaf shared
  // ACROSS GROUPS costs a chunk" — canvasColor.ts, repoPulse.tsx,
  // pages/future/data.ts, timeCursor.ts, and now this. Only a build tells you
  // which you wrote.
  //
  // THE EAGER +38 IS THE mapDeps TABLE, MEASURED NOT ASSUMED. `Disclosure` is
  // lazy and stays lazy; what reached the entry chunk is the preload STRING
  // `assets/Disclosure-CHf4dfpL.js` that Vite's `__vite__mapDeps` gained for the
  // newly-minted chunk — grepped and found in the entry, p3·13's mechanism
  // reproduced. The negative control is the half that matters and it is clean:
  // `data-release-scroll`, `bodyTruncated`, `cross-served`, `api/releases`,
  // `work log` and `holds no ledger` ALL grep to ZERO in the eager entry, and
  // the first two grep to 1 in the lazy SourcesPage chunk.
  //
  // NOT RAISED, said out loud: `/about/sources` HELD at 96,471 of 98,000
  // (margin 1,529) — the ledger UI is small and PR BODIES ARE FETCHED, NOT
  // BUNDLED, which is the design property that keeps a page carrying the whole
  // project history off the first-load budget. `cssGz` is BYTE-IDENTICAL at
  // 18,150: the scroll region's four declarations are inline, because they are
  // used exactly once and this budget has ~450 B of margin.
  //
  // p3·16 RAISE, 871,000 -> 886,000. A whole new ROUTE, which is the case this
  // budget's own docstring describes: "code behind a dynamic import; growth
  // here is paid only by visitors who open the route that owns it, so ask
  // WHICH chunk before asking whether to raise this." Asked, and answered by
  // a file-by-file diff of dist/assets against a build of e5eae16, paired by
  // stem MULTIPLICITY (the `index` stem holds two chunks and they move by
  // different amounts, one lazy and one eager — a basename-keyed diff files
  // the lazy delta under the eager budget):
  //
  //   repoPulse         +17,300   MINTED. And the NAME IS MISLEADING, which is
  //                               worth a sentence: this chunk is mostly
  //                               pages/future/data.ts, not the 110-line
  //                               repoPulse leaf. Vite names a chunk after one
  //                               of its modules; the name is a label, not a
  //                               contents list. data.ts reached a THIRD
  //                               importer group when the hub imported it, and
  //                               a leaf shared ACROSS GROUPS is what Rollup
  //                               mints (p3·13's timeline-vs-timeCursor rule,
  //                               confirmed a fourth time).
  //   EcoPopup          -16,529   The other side of the same move: that data
  //                               used to be inlined here. Net for the pair is
  //                               +771, which is the spine's own growth plus
  //                               chunk overhead — NOT 17,300 of new code.
  //   SuperstressPage   +14,553   The page itself.
  //   index[1]             +404   the EAGER entry — see eagerJsRaw.
  //   FuturePage           +275   ProtoPopup's leading-"/" Link branch.
  //   TrustedPeersPage      +37   the EcoPopup import-graph shift.
  //                   ─────────
  //                      +16,040 raw across 6 chunk slots; the other 63 slots
  //                              of 68 stems are BYTE-IDENTICAL.
  //
  // RECONCILES EXACTLY: 16,040 total − 404 eager = 15,636 lazy, and
  // 867,237 + 15,636 = 882,873, which is the built figure above. Residual ZERO.
                        // +3,516 raw over p3·14b's 863,697. THE WHOLE RAW DELTA
                        // RECONCILES TO THE BYTE and is worth stating that way,
                        // because this release's two raw budgets and its one route
                        // budget move for THREE different reasons:
                        //   lazy  +3,516  (the Superbrain entry's data + copy, the
                        //                  blocks renderer in EcoPopup, and
                        //                  repoPulse.tsx — all lazy)
                        //   eager    +47  (nav/ia.ts's ECOSYSTEM_META row; see below)
                        //   -----------
                        //   total +3,563  == the measured totalJsRaw delta exactly,
                        //                    residual ZERO.
                        // The +47 EAGER byte is the one worth naming, because a
                        // leaf reaching the eager entry is the failure mode the
                        // canvasColor rule exists to prevent, and this is NOT that.
                        // Measured, not assumed: the string "Monero Superbrain"
                        // appears exactly once in the entry chunk, from ia.ts's
                        // ECOSYSTEM_META (ia.ts is eager — NavTop imports it), and
                        // that row minifies to 44 B + 1 separator. Every string only
                        // repoPulse.tsx declares ("last issue activity", "returned no
                        // data") greps to ZERO in the entry chunk. A first hypothesis
                        // that the delta was Vite's __vite__mapDeps table gaining a
                        // preload string was DISPROVED rather than assumed: Vite's
                        // hashes are fixed-length, so rotation contributes no net
                        // bytes. p3·13 measured a real mapDeps move (+30/−7) because
                        // that release minted a chunk; this one mints none.
                        // p3·14b: built 863,697 on the FINAL tree, margin 3,303.
                        // RE-MEASURED, and the re-measure earned its keep for the
                        // fifth time in this file's history: the first raise here read
                        // 865,000 against a built 862,429 (margin 2,571), taken
                        // mid-flight. Three later commits — the render memo, its
                        // React.memo comparator and the caption duration — added 1,268 B
                        // and cut that margin to 1,303 without crossing, i.e. silently.
                        // Only figures from the tree that ships may stand in this file.
                        // Delta from the clean tree is +14,389, and
                        // ALL of it is ONE chunk: NetworkPage +13,135 (the
                        // streaming line, the small-multiples grid, the sync
                        // shell and the difficulty buffer), less 14 B of
                        // mapDeps index drift spread over six untouched chunks
                        // (FuturePage/bridge/constellation/terminal −5 each,
                        // mempool +5, MoneroPage +1). 59 of 67 chunks are
                        // BYTE-IDENTICAL and NO NEW CHUNK WAS MINTED — the new
                        // modules resolve into NetworkPage's existing chunk
                        // group, so CHUNK_COUNT stays 67 and its ±4 band is
                        // untouched. Attribution is keyed on the chunk STEM,
                        // not the filename: this build stamps content, so
                        // nearly every hash changes between two commits and a
                        // filename-keyed diff reports 67 additions and 67
                        // deletions. The `index` stem still holds two chunks
                        // and is split by asking dist/index.html which one it
                        // names, or the eager +59 would land in this budget.
                        // p3·14: built 848,882, margin 3,118. Delta +6,872, and the
                        // whole of it is two lazy chunks — NetworkPage +6,120
                        // (the band module, the strip, and the page's own
                        // wiring) and charts +752 (AreaSeries' opt-in `band`
                        // prop). 64 of 67 stems byte-identical, 67 chunks both
                        // sides so nothing was minted, and the EAGER entry is
                        // byte-identical: this PR does not move eagerJsRaw at
                        // all. Paired by multiplicity within each stem, so the
                        // two chunks sharing the `index` stem cannot file a
                        // lazy delta under the eager budget.
  // NOT calibrated — this is Vite's own chunkSizeWarningLimit default, which
  // PERF-BASELINE.md:76 tracks as "silent". vite.config.ts deliberately leaves
  // that option unset so the warning and this assertion agree. Largest chunk
  // today is the VENDOR chunk at 162,915 — re-measured in p3·12b, where this
  // line still said "SimulatePage at 180,572". SimulatePage is 6,513 now; the
  // v6.1.5 split into per-module protocol chunks took it apart and the comment
  // was never re-run. Sorting dist/assets/*.js by size takes one command.
  maxChunkRaw: 500_000,
};

/** Per-route cold-landing cost, gzip. Measured; ~10% headroom, rounded.
 *  `/learn/sim` gets its own (large) line rather than sharing a ceiling:
 *  views/protocols.tsx statically imports all 16 src/protocols/*.tsx modules
 *  (5,320 lines), so one shared ceiling would either flake there or be
 *  useless everywhere else.
 *
 * Nav restructure — every number below is a FRESH measurement taken after
 * the 13-route IA landed (`npm run build && node verify-bundle.mjs
 * --measure`), not the old table copied across renamed routes: chunking
 * shifted for several of them. `/live/markets/thesis` and `/future/outlook`
 * are new lines (split out of the old `/monero/:tab` set, which is why
 * `/monero` itself measures smaller than before — 2 fewer tab modules). */
const ROUTE_BUDGET_GZ = {
  //  route                   budget   measured post-restructure (gzip -9)
  '/':                       97_000, //  87,128 — the entry closure itself; HomePage is eager.
                                     //  v6.1.8: 89,000 -> 97,000 alongside eagerJsGz, same
                                     //  reasoning and same ~10% rule. This row IS the eager
                                     //  closure (2 chunks: entry + vendor), so it tracks that
                                     //  ceiling +1,000 rather than moving independently.
  '/live/mempool':          107_000, //  96,835
  '/live/markets':          121_000, // 117,803 — p3·13: 112,000 -> 121,000 (margin 3,197).
                                     // The route gained a chunk: `timeline` (12,973 B raw), the
                                     // annotation data, now shared with /learn rather than living
                                     // inside EducationPage. /learn paid 9,218 B back for it.
                                     // p3·12: 105,000 -> 112,000, and the
                                     //  `95,817` that stood here was stale by 7,879 B
                                     //  before this PR touched anything (main measured
                                     //  103,696, i.e. 98.8% of its own ceiling with
                                     //  1,304 B of slack — one more component either way
                                     //  and it fires on somebody who did not cause it).
                                     //  Delta attributed gzip, chunk by chunk, over the
                                     //  route's ACTUAL closure (EAGER ∪ the MarketsPage
                                     //  chunk's static closure, read out of
                                     //  .perf/bundle-graph.json — 10 chunks here, 9 on the
                                     //  baseline; JS only, so the CSS move is NOT in this
                                     //  number):
                                     //    MarketsPage  +5,880   canvas hero + brush + table
                                     //    charts       -1,312   CandleChart deleted
                                     //    canvasColor    +278   new shared leaf
                                     //    index (entry)  +376   see eagerJsRaw
                                     //    PanelBoundary    +1
                                     //    Skeleton         -1
                                     //  Those last two are RAW-IDENTICAL and gzip by one byte
                                     //  differently, which is why a raw-delta table can never
                                     //  fully attribute a gzip route number: both chunks embed
                                     //  the eager entry's 8-char content hash as an import
                                     //  specifier, that hash changed, and the substitution is
                                     //  length-preserving — so raw moves 0 and only the
                                     //  compressor notices. They are invisible by construction
                                     //  in any raw-based attribution, and they are exactly the
                                     //  2 B an earlier approximate pass left over.
                                     //    vendor, useChartMetrics, usePendingDelay,
                                     //    useUrlState       0    byte-identical
                                     //                ────────
                                     //    = +5,222 against a measured 103,696 -> 108,918.
                                     //  RESIDUAL ZERO.
                                     //  p3·12 quoted "+5,128 of +5,178, ≤50 B unattributed,
                                     //  which is vendor/index[0] rounding". Both halves were
                                     //  wrong: the figures came from the gzip(1) CLI rather
                                     //  than node:zlib (see cssGz), and the residual was the
                                     //  instrument, not rounding — with the right compressor
                                     //  over the right file set it attributes to the byte.
                                     //  The first attempt at THIS table then mis-added it to
                                     //  +5,220 against "103,698", and signed PanelBoundary
                                     //  wrong. Three digits in the comment correcting the
                                     //  digits, which is the argument for pasting a measured
                                     //  table rather than retyping one.
  '/live/markets/thesis':    96_000, //  87,434 — new: split out of the old /monero/markets tab
  '/live/network':          117_000, // p3·14b: built 114,402 on the FINAL tree, margin 2,598.
                                     //  (The mid-flight reading was 113,880; ceiling unchanged,
                                     //  the margin absorbed it — recorded so the next PR sizes
                                     //  against the real number.) +4,533 gzip, the
                                     //  streaming line + small multiples + sync shell. This is
                                     //  the ONLY route row that moved: the other twelve are
                                     //  within 20 B of the clean tree, which is what a delta
                                     //  confined to one lazy chunk should look like and is the
                                     //  check that it really was confined.
                                     // p3·14: built 109,732, margin 3,268. The D0832 bands,
                                     //  the cadence strip and their source notes land here.
                                     //  NOTE the previous comment on this row was STALE by
                                     //  1,344 B: it read 106,035 while the clean tree measured
                                     //  107,379 against a 108,000 ceiling — 621 B of slack, not
                                     //  the ~2,000 the row implied. Re-measured, not carried.
                                     // 106,035 — RAISED from 106,000, and the old `96,436`
                                     //  comment beside it was stale by 9,169 B. Measured on
                                     //  292227a BEFORE this change: 105,605, i.e. main was
                                     //  already at 99.6% of its own ceiling with 395 B of slack.
                                     //  The v2.0 axis-collision fix adds ~430 B gzip to the two
                                     //  routes that render markets/charts.tsx (this one and
                                     //  /live/markets, which absorbs +433 inside its larger
                                     //  margin), so this line crossed by 35 B.
                                     //  DELIBERATELY NOT the ~10% rule the rest of this table
                                     //  uses: 10% of the new measurement would be ~117,000, which
                                     //  would re-hide the 9 KB this route has silently grown.
                                     //  1,965 B (~1.9%) restores a real signal instead — the next
                                     //  growth on this route reddens early rather than after
                                     //  another 11 KB.
                                     //  THE WIDER CONDITION, recorded because this line is only
                                     //  the first to cross: every `measured` figure in this table
                                     //  is stale, and this paragraph's own citations went stale
                                     //  after it too. p3·12b re-measured them: /live/mempool reads
                                     //  96,835 and measures 104,793 (this said 103,977);
                                     //  /live/markets no longer "reads 95,817" at all — p3·12
                                     //  rewrote that row to 108,918 against a 112,000 ceiling, so
                                     //  the one route this note cited as evidence is now the one
                                     //  route that has been re-baselined. The other eleven have
                                     //  not, and several still sit at 96-99% of ceilings written
                                     //  to hold ~10%: /about/sources 94,358 of 95,000 (99.3%),
                                     //  /future/outlook 91,081 of 92,000 (99.0%), /operate/node
                                     //  90,738 of 92,000 (98.6%). Re-measuring the whole table is
                                     //  still its own change; doing it here would bury a budget
                                     //  re-baseline inside a defect fix. But a comment that
                                     //  reports staleness has to not BE stale, which is why the
                                     //  numbers above were re-run rather than left standing.
  '/learn':                 108_000, //  97,870
  '/learn/sim':              94_000, //  85,723 — v6.1.5 PR B: was 133,676/148,000 when this
                                     //           carried all 16 protocol modules eagerly. The 21
                                     //           simulators are lazy now, so this is the shell plus
                                     //           only the default sim's chunk.
  '/monero':                115_000, // 104,154 — 7 tab modules now (was 9: markets and outlook
                                     //           moved out to their own top-level routes above)
  /* p4·M3 RAISE, 107,000 -> 112,000. Built 108,502 gzip post-merge
     (margin 3,498), red at `❌ /future first load 108512 B gzip ≤ 107000`.

     THIS ROUTE RENDERS NONE OF WHAT MADE IT BIGGER, AND THAT IS THE FINDING.
     p4·M3 adds two PARTNER entries and six screenshot records to
     `pages/future/data.ts`. Every one of them renders on `/operate/peers` and
     nowhere else — this page draws the stressnet band and the protocol cards — yet `data.ts`
     lands in the `repoPulse` chunk, which THIS route also downloads, so it
     paid **+1,812 B gzip for prose it never draws**.

     THE LEAF LESSON, NINTH SIGHTING, AND NOT FIXED HERE — see the ledger.
     The structural answer is the one this repo has taken eight times already
     (canvasColor · timeCursor · timeline · repoPulse · the Superbrain essays ·
     ProtocolDetail · stressnet-model): move the PARTNER array into its own
     module with one importer, and both this route and its sibling get CHEAPER
     instead of dearer. It is deliberately NOT taken in this PR, on an
     operational ground rather than a technical one: a second PR is editing
     `data.ts` concurrently (see the parallel-work protocol in this release's
     handoff), and splitting a file mid-flight under another author is how a
     clean merge becomes a bad one. Raised, measured, and ledgered so the split
     can be taken deliberately in a change that owns the file. */
  '/future':                115_000, // p4·M6c: built 112,326, margin 2,674.
  //   THE BRIEF FOR THIS RELEASE NAMED TWO ROWS TO RAISE. A MEASUREMENT FINDS
  //   THREE, and this is the third — an enumeration is a hypothesis and a
  //   build is the measurement, which is this repo's own standing rule
  //   arriving in a budget table. /future was at 111,152 of 112,000 on the
  //   untouched base (margin 848) and went RED at 112,326 on the first build
  //   of this branch.
  //   IT RENDERS NEITHER NEW PEER. FuturePage does `ECOSYSTEM.find(e => e.id
  //   === eco)` — a lookup driven by the URL parameter — plus the stressnet
  //   band and the protocol cards; no peer grid, no cakewallet, no mac. So it
  //   paid the SAME +1,174 B gzip as /operate/peers, which draws both, for
  //   prose it never puts on screen. Two of the three routes charged by this
  //   release render none of what they are charged for, which is the split
  //   argument stated in bytes rather than in principle — see /operate/peers
  //   below. p4·06 predicted this row would be "where the next touch to
  //   /future reds"; it was.
  //   p4·06 · NOT RAISED, because not crossed — but said out loud: this row's
  //   margin is now 484 B (built 106,516). /future did not shrink when
  //   FuturePage's chunk lost 7,463 B to the extraction; it grew by 1,172,
  //   because ProtoPopup still imports the extracted body, so the route now
  //   pays for FuturePage + ProtocolDetail as two chunks instead of one
  //   larger. 484 B is where the next touch to this route reds.
  '/future/outlook':         92_000, //  83,652 — new: split out of the old /monero/outlook tab
  //   p4·06 · NEW ROW. A four-chunk closure: entry + vendor + ProtocolPage +
  //   ProtocolDetail. It is the cheapest new route in the Phase 4 series
  //   because it mints almost no markup of its own — the body is a component
  //   that already existed and the data is FUTURE_PROTOCOLS unchanged.
  '/future/protocol':       109_000, // p4·M5: built 105,718, margin 3,282 (3.01%).
  //   RAISED WHILE GREEN, and the reason is the same one p4·02 gave for cssGz.
  //   The audit finding and Carrot's re-derivation land in ProtocolDetail and
  //   in data.ts's chunk, both of which this route carries, and they took the
  //   margin from 1,587 B to 287 B — 0.27%, the tightest row in the table.
  //   A ceiling a single word of copy can cross is not strictness, it is a
  //   detector that has stopped detecting: the next author gets a red that
  //   says nothing about whether anything regressed. 3% restores it to the
  //   band every other row on this page sits in.
  //
  //   NOT RAISED, and said out loud: `/future` holds at 112,000 with 1,597 B
  //   and `/operate/peers` at 106,000 with 1,587 B. Both are tight and neither
  //   was crossed — p4·06 left `/future` at 497 B on exactly this reasoning
  //   and named it instead. That is where the next touch to either reds.
  '/operate/node':           92_000, //  83,305
  // p4·04: NEW ROW — the 15th route. Built 97,918 on the FINAL tree, margin
  //  3,082. Set from measurement, never by eye, for the reason the row below
  //  states: a first budget chosen by eye is a ceiling nobody can later argue
  //  with, because there is no recorded number underneath it.
  //  Its closure is FOUR chunks — entry + vendor + MinePage + Disclosure —
  //  and that count is the interesting half. Disclosure is a pre-existing
  //  shared chunk (minted in p4·03 when SourcesPage became its third
  //  importer), so the accordion this page is built on costs it a chunk it
  //  does not mint. There is NO future-data chunk in this closure, which is
  //  the difference between this row and /operate/superstress's five.
  '/operate/mine':          101_000,
  // p3·16: NEW ROW — the 14th route. Built 101,893 on the FINAL tree, margin
  //  3,107. Set from measurement, never guessed: a first budget chosen by eye
  //  is a ceiling nobody can later argue with, because there is no recorded
  //  number underneath it.
  //  Its closure is 5 chunks — entry + vendor + the SuperstressPage chunk +
  //  the shared future-data chunk + Skeleton. It is NOT the cheapest route in
  //  the table and it is not meant to be: the hub is prose, and prose is the
  //  one thing on this site that compresses well and renders instantly.
  //  WHAT THIS ROW BOUGHT ELSEWHERE, recorded because it is the interesting
  //  half: the hub's per-app essay was FIRST written into pages/future/data.ts
  //  beside the five apps' shared one-liners. That module is imported by
  //  FuturePage, TrustedPeersPage and the hub — three chunk groups — so Rollup
  //  mints it a chunk and all three routes download every byte of it. Measured
  //  in that shape, /future read 106,401 against its 107,000 ceiling: 599 B of
  //  margin, on a route this PR barely touches, for prose it never renders.
  //  Moving the essay into SuperstressPage.tsx (an exhaustive
  //  Record<SuperbrainAppId, …>, so a sixth app is a compile error rather than
  //  a missing row) bought back 1,167 B gzip on /future AND 1,167 B on
  //  /about/peers for +79 B of total JS. Rollup chunks per MODULE, not per
  //  export — canvasColor.ts and repoPulse.tsx already record this, and it is
  //  now the third release in which the fix was to move a file, not a ceiling.
  /* p4·M3 RAISE, 105,000 -> 110,000. Built 106,539 gzip post-merge
     (margin 3,461), red at `❌ /operate/superstress first load 106547 B gzip ≤ 105000`.

     THIS ROUTE RENDERS NONE OF WHAT MADE IT BIGGER, AND THAT IS THE FINDING.
     p4·M3 adds two PARTNER entries and six screenshot records to
     `pages/future/data.ts`. Every one of them renders on `/operate/peers` and
     nowhere else — this page reads exactly two ECOSYSTEM entries by id, `superbrain` and `stressnet`, and neither is new — yet `data.ts`
     lands in the `repoPulse` chunk, which THIS route also downloads, so it
     paid **+1,669 B gzip for prose it never draws**.

     THE LEAF LESSON, NINTH SIGHTING, AND NOT FIXED HERE — see the ledger.
     The structural answer is the one this repo has taken eight times already
     (canvasColor · timeCursor · timeline · repoPulse · the Superbrain essays ·
     ProtocolDetail · stressnet-model): move the PARTNER array into its own
     module with one importer, and both this route and its sibling get CHEAPER
     instead of dearer. It is deliberately NOT taken in this PR, on an
     operational ground rather than a technical one: a second PR is editing
     `data.ts` concurrently (see the parallel-work protocol in this release's
     handoff), and splitting a file mid-flight under another author is how a
     clean merge becomes a bad one. Raised, measured, and ledgered so the split
     can be taken deliberately in a change that owns the file. */
  '/operate/superstress':   112_000, // p4·M6c: built 109,404, margin 2,596.
  //   THE COMMENT HERE READ "106,539 post-merge" AND WAS STALE BY TWO
  //   RELEASES — measured 108,244 on the untouched base 9f9e176, so the slack
  //   this row advertised was 3,461 where it was really 1,756. Re-baselined.
  //   RAISED WHILE GREEN, and the reason is the ledgered one: this route
  //   renders NEITHER new peer (SuperstressPage reads exactly two ECOSYSTEM
  //   entries by id, `superbrain` and `stressnet`) and still paid +1,160 B
  //   gzip for their prose, because data.ts is one module and lands in a chunk
  //   this route downloads. It cleared its ceiling by 596 B — less than one
  //   peer entry — so the next peer would red a route that draws none of it,
  //   which is a failure that teaches nothing about the change that caused it.
  //   p4·M5 raised /future/protocol on the same ground at 0.26%.
  /* p4·07 · the 18th route. Built 94,719 gzip on the FINAL tree (margin 3,281),
     a FOUR-chunk closure: entry + vendor + StressnetExplorerPage + the 634 B
     stressnet-model leaf. It is the LIGHTEST of the three Operate leaves
     despite rendering a whole simulated blockchain — /operate/superstress is
     104,635 and /operate/mine 98,149 — because the chain is arithmetic rather
     than content: 12 blocks and 33 pool rows are GENERATED from a seeded hash
     at render time, where the hub and the mining page ship their prose. */
  '/operate/superstress/explorer': 98_000, //  94,719
  // p3·15: 100,100 measured, margin 2,900. The comment previously read 91,082
  // and was stale by 6,437 — the table-wide staleness the /live/mempool note
  // above already records; only this row is re-baselined here, because
  // re-measuring the whole table is still its own change.
  //
  // +2,581 gzip over p3·14b's 97,519, and the interesting part is what it is
  // NOT. The naive landing put this route at 101,152: importing
  // RepoPulseReadout from cards.tsx made Rollup — which chunks per MODULE, not
  // per export — drag ProtocolCard, MoneroNewsCard and their own deps into the
  // peers closure, so the route paid for two components it never renders.
  // Re-homing the readout into pages/future/repoPulse.tsx bought back 1,052 B.
  // What remains is the feature's own weight: the entry's prose, the blocks
  // renderer, and useCachedFeed's chunk (2,512 B raw / 1,023 B gzip) entering
  // this route's closure for the first time.
  //
  // MEASURED, and NOT what the split's name suggests: the leaf did not get its
  // own chunk. Chunk count held at 67. repoPulse.tsx was inlined into the
  // pre-existing EcoPopup chunk, whose importers were already exactly
  // FuturePage and TrustedPeersPage — so the saving came ENTIRELY from
  // ProtocolCard/MoneroNewsCard leaving, not from the readout moving somewhere
  // new. "It did not mint a chunk" and "it landed where I expected" are
  // different facts; this is the first.
  /* p4·M3 RAISE, 103,000 -> 106,000. Built 103,330 gzip post-merge
     (margin 2,670; +1,885 over the 101,445 base), red first at `❌ /operate/peers first load 103305 B gzip
     ≤ 103000` against a margin that was only 1,527 before this PR began.

     THE CLOSURE DID NOT CHANGE SHAPE — chunk count is 76 on both sides, no
     module was minted or absorbed, and the three chunks that grew are the
     three this page already downloaded. What grew is CONTENT: two more
     partners in data.ts, six shot records, and the reasoning beside them.
     A directory page getting bigger when the directory gets bigger is the
     budget working, not drifting.

     NOT RAISED, and said out loud because it is the tightest thing in this
     file after the raise: `cssGz` is BYTE-IDENTICAL at 18,184 of 18,600
     (margin 416). This PR adds no stylesheet rule at all — the 44px tap
     target and the screenshot figure are both inline styles on pages whose
     idiom is inline styles, which was the constraint rather than the
     outcome. */
  '/operate/peers':         109_000, // p4·M6c: built 106,687, margin 2,313.
  //   THE COMMENT HERE READ "103,330 post-merge" AND WAS STALE BY TWO
  //   RELEASES TOO — measured 105,513 on the untouched base, i.e. a real
  //   margin of 487 where 657 was last recorded and 2,670 was implied here.
  //   This is the route that actually renders the two new briefs: +1,174 B.
  //   THE STRUCTURAL FIX IS STILL OWED AND IS NOW THREE RELEASES OVERDUE.
  //   Splitting the PARTNER array out of pages/future/data.ts would make BOTH
  //   this row and /operate/superstress CHEAPER instead of dearer — the leaf
  //   lesson this repo has applied nine times. It is not taken here for the
  //   same operational reason p4·M3 gave: a file-shape change riding along
  //   with content is how a clean merge becomes a bad one. Recorded as rent
  //   paid, not as a renewal.
  // p3·17 RAISE, 95,000 -> 98,000. Built 95,027 on the FINAL tree (margin
  // 2,973), red first at `❌ /about/sources first load 95027 B gzip ≤ 95000`.
  //
  // THIS ROW'S OWN COMMENT WAS STALE BY 7,990 B BEFORE THIS PR TOUCHED
  // ANYTHING. It read `86,581` against a measured 94,571 at bda0491 — a margin
  // of 429, the TIGHTEST row in this table, while the comment implied 8,419.
  // Same defect p3·14 recorded against /live/network, in a different row: the
  // ceiling is checked every build and the figure beside it is checked by
  // nobody. Re-baselined here.
  //
  // WHY IT GREW WHEN THE POINT OF THE PR WAS TO SHRINK THINGS. The five curated
  // release notes used to ship in the EAGER entry, because NavTop imported
  // SITE_VERSION from the module that holds them — so all fourteen routes paid
  // for prose only this one renders. p3·17 split the version identity into
  // data/siteVersion.ts, and the prose moved out of the entry and into
  // SourcesPage's own chunk. So this route's number went UP precisely because
  // the cost moved to the route that actually renders it; the other thirteen
  // each got ~470 B gzip cheaper, and `/` — the LCP route — with them.
  //
  // Attribution, paired by stem MULTIPLICITY against a bda0491 build in an
  // isolated worktree (its own dist/, its own port), RESIDUAL ZERO both halves:
  //     SourcesPage    +2,281 raw  (+929 gzip)   prose in, plus the seam,
  //                                              the empty-state and eraSeamIndex
  //     index[1]       -1,025 raw  (-462 gzip)   the entry: prose OUT
  //     useCachedFeed      -4 raw                src=commits -> src=pulls
  //     ------------------------------------------------------------------
  //     lazy   882,849 -> 885,106  = +2,277 = SourcesPage + useCachedFeed ✓
  //     eager  263,385 -> 262,360  = -1,025 = index[1]                    ✓
  //     total                        +1,252
  // 22 chunk slots byte-identical; the remaining ±1..5 gzip wobbles are 8-char
  // content-hash substitutions, which are length-preserving in RAW and still
  // move a byte or two under gzip.
  //
  // NOT RAISED, because not crossed — and said out loud rather than left to be
  // rediscovered, which is this file's own convention: `lazyJsRaw` is at
  // 885,106 of 886,000, a margin of **894 B**. That is where the next lazy
  // addition of any size reds. `cssGz` is byte-identical at 17,900 of 18,200
  // (margin 300) because this PR added no stylesheet rule at all — the seam and
  // the empty-state notice reuse existing classes and inline styles for exactly
  // that reason. `CHUNK_COUNT` is unchanged at 69: the new leaf minted NO
  // chunk, it inlined into the entry group, because NavTop is eager and a
  // module the entry imports lands in the entry.
  '/about/sources':          98_000, //  95,027
  /* p4·05: NEW ROW — the 16th route. Built 96,154 gzip on the FINAL tree,
     margin 2,846. Set from measurement, never by eye.
     A FOUR-chunk closure — entry + vendor + SitePage + canvasColor — which is
     the floor for a lazy route here, and it took a fix to reach: the overlay
     first read `COLDBOOT_Z` from coldboot/ColdBoot.tsx, and that ONE constant
     pulled the splash (31,577) plus mem-stats, useNodePopulation, Skeleton and
     useFeedEvents — 9 chunks, 108.51 KB gzip — onto a route that renders no
     splash. Rollup chunks per MODULE, not per export. Dropping the import for a
     local literal took it to 4 chunks / 93.61 KB; see CloverOverlay.tsx's
     z-index note for why there is no shared authority to lose. */
  /* p4·M2: RE-DERIVED, not raised. The trailing figure read 96,252 and was
     ALREADY STALE AT THE BASE COMMIT — `e0c87ad` measures 96,448, so the
     comment had drifted 196 B behind the tree before this release touched
     anything, the standing defect this repo records against itself: a budget
     comment is not gated by the budget it annotates, so nothing goes red
     while the prose rots. Measured on the FINAL tree: 96,514, margin 2,486.
     RE-MEASURED after the LAST src commit and it MOVED: the figure read 96,519
     before `SITE_PR` 196 -> 197 landed. Every RAW budget is byte-identical
     across that commit (264,448 / 969,804 / 1,234,252) — only the gzip figures
     move, by 5-6 B, which is the hash-cascade compressibility effect p3·18 and
     p4·01 both recorded. Nothing went red, which is exactly why the rule is
     re-derive after the last src commit rather than "check the gate is green".
     The +66 B against base is the section reorder's `data-site-section`
     markers plus the support CTA, NET of an eager saving that reaches every
     route (see the eagerJsRaw note — p4·M2 also removed Main Home's
     ThemeToggle mount). The ceiling is UNCHANGED at 99,000 and was not
     approached.

     p4·M6b — "a 13 B eager saving" STOOD HERE AND WAS A FIGURE NOTHING
     MEASURED. What p4·M2 actually recorded is the entry chunk moving
     101,566 -> 101,533 = -33 B RAW, and per-route first-load deltas of -8 to
     -23 B GZIP. 13 is neither: it is not the raw number, it is not any route's
     gzip number, and it sits inside a range this same comment quotes as
     "~13-23 B" two sentences later — so the paragraph disagreed with itself
     about its own saving. NO SINGLE FIGURE DESCRIBES IT, which is the point:
     raw and gzip are different quantities and the per-route effect is a range,
     not a constant. Both are now stated as what they are. (The gzip half of
     the eager delta is deliberately NOT quoted as one number here — it was
     never measured on its own, and deriving it from a whole-bundle ratio would
     be an inference wearing a measurement's clothes.)

     Every OTHER route row's trailing figure is likewise ~8-23 B stale for the
     same eager saving; they are deliberately left, because a concurrent PR
     owns some of those rows and touching them is a guaranteed conflict for no
     gate benefit. */
  '/about/site':             99_000, //  96,514
};

/* 35 -> 53 in v6.1.5 PR B: splitting the 21 simulators into per-module chunks
 * adds 18. 53 -> 55 in the nav restructure: two new lazy pages,
 * MarketsThesisPage and OutlookPage, each get their own chunk (App.tsx's
 * React.lazy list). The BAND stays 4 rather than widening with the count —
 * the band exists to catch a chunking-strategy change, and that signal does
 * not get weaker just because there are more chunks. A count budget is not a
 * size budget: more chunks is not worse on its own — what it costs is
 * request count, which is why the per-route "first load ∪ static closure"
 * row above is the number that actually governs. */
// v6.1.8 RE-CENTRED 55 -> 60. This is NOT the same kind of move as the
// eagerJsGz raise above, and conflating them would be wrong.
//
// This is a CENTRED DRIFT DETECTOR — `Math.abs(n - CHUNK_COUNT) <= CHUNK_BAND`
// — not a ceiling. The BAND is its detection power; the CENTRE is only where
// it stands. So:
//
//   widening ±4 -> ±8   would LOSE sensitivity. Not done.
//   moving 55 -> 60     keeps ±4 exactly. Sensitivity is IDENTICAL.
//
// Derivation: 56 at f1dc296, +4 from this PR's lazy split — ColdBoot, Orb,
// the decoy/console chunk and the shared splash code. Those are the strategy
// that kept eagerJsGz at 91% while adding a full-screen decrypt, a HUD console
// and a live-wired orb; they are precisely the "feature, not a manualChunks
// accident" case this check's own comment distinguishes. The detector fired
// correctly at 60 and the answer is to re-centre it, not to widen it.
//
// Left at 55 with reality at 60, it had already spent its entire band on a
// known deliberate delta and had nothing left for the accident it exists to
// catch. New range [56, 64], same ±4 of headroom in both directions.
//
// ── p2·10 RE-CENTRED 60 -> 61, and this is the THIRD verify-bundle assertion
//    a net-new view crosses. The two budgets are the ones every view PR since
//    #174 has expected; this one is not, and it went unmentioned in four
//    consecutive briefs because it only fires at the top of the band ──
//
// Measured: 64 at d388754, 65 on this tree. Every net-new view adds EXACTLY
// one chunk — `views/index.tsx` binds each engine through its own
// `React.lazy(() => import("@/mempool/<id>"))`, and that file's own docblock
// records why the map is written out rather than derived (a template literal
// would collapse the engines into one glob chunk and undo v6.0.8's
// splitting). So a per-view chunk is the strategy working, which is precisely
// the "feature, not a manualChunks accident" case this check's comment
// distinguishes — and it is the same call the v6.1.8 note above made.
//
//   widening ±4 -> ±5   would LOSE sensitivity. Not done, for the reason the
//                       paragraph above already gives.
//   moving 60 -> 61     keeps ±4 exactly. Sensitivity is IDENTICAL.
//
// New range [57, 65]. The upward half is spent again at 65, which is worth
// saying plainly rather than leaving to be rediscovered: Relay, if it ever
// ships, takes this to 66 and reds this check on its first build. That is the
// detector doing its job — it should be re-centred to 62 in that PR, not
// widened — and it is now the second consecutive release in which the ceiling
// this check hands the next view PR is exactly one build away.
// p3·12: 61 -> 62, RE-CENTRED not widened, exactly as the paragraph above
// instructed the next PR to do. The 66th chunk is `canvasColor` — `cssColor`
// split out of `useMemCanvas` so the markets hero could use it without
// importing a mempool rAF hook, and imported by SEVEN lazy chunks — the five
// mempool view chunks that call cssColor directly (abyss, circuit, orbital,
// pulse, sediment), MarketsPage, and useMemCanvas itself, which re-exports it
// so those views keep their old import path. Sharing across chunk groups is
// what makes Rollup mint it rather than inline it. New range [58, 66]; sensitivity is IDENTICAL at ±4.
//
// The note above predicted this would be Relay's to spend. It was not — a
// shared LEAF costs a chunk just as a lazy VIEW does, and nothing in this
// detector distinguishes them. Relay, if it ships, now reds at 67.
//
// ── p3·13 · 62 -> 64. IT REDDED AT 67, AND THE LINE ABOVE CALLED IT. ───────
// Not Relay again: `data/timeline.ts`, the 49-event timeline extracted out of
// EducationPage so /live/markets' annotation layer and /learn/timeline read one
// source. Two lazy importers in two chunk groups, so Rollup mints it — the
// third consecutive release where the sixty-seventh chunk was a SHARED LEAF and
// not a view, which is now the pattern rather than the exception.
//
// Its sibling did NOT mint one, and the asymmetry is worth recording because
// nothing about the source predicts it: `design/timeCursor.ts` is also a new
// leaf, also imported by the hero and by charts.tsx, and Rollup INLINED it into
// `charts-*.js` because both importers resolve inside one chunk group. So "a
// shared leaf costs a chunk" is really "a leaf shared ACROSS GROUPS costs a
// chunk", and only a build can tell you which you wrote.
//
// 64, not 63: ±4 is unchanged (widening loses the detection power; only the
// centre moves), and 63 would put the new range at [59, 67] with reality
// sitting exactly on the ceiling — the state p2·10 recorded as "the upward half
// is spent again". [60, 68] leaves ONE rung, which is stated here rather than
// left to be rediscovered: the next shared leaf reds this line.
// ── p3·16 · 64 -> 66. IT REDDED AT 69, AND TWO CHUNKS ARRIVED, NOT ONE. ───
// The first is `SuperstressPage`, and a net-new lazy ROUTE minting a chunk is
// this splitting strategy working exactly as designed — the same call the
// four notes above make for a net-new VIEW.
//
// The second was PREDICTED and the prediction named the wrong module. The brief
// expected `repoPulse.tsx`/`useCachedFeed.ts` to split, on the grounds that the
// hub would become a third importer group for them. Measured: `useCachedFeed`
// already HAD its own chunk at e5eae16 (nothing can mint what exists), and the
// module that actually crossed is `pages/future/data.ts` — which the hub imports
// for the install steps, the store's own prose and the FCMP++ fork version, all
// of which #184's single-source rule says it must not retype. The chunk it lands
// in is NAMED `repoPulse`; that is a label Vite takes from one member module,
// not a contents list, and EcoPopup shrinking by 16,529 in the same build is
// where the bytes actually came from.
//
// A CONTROL was run rather than assumed, because "the hub's RepoPulseReadout
// import costs a chunk" was the obvious story and it is FALSE: a build with that
// one import removed still measures 69. The pulse costs 266 B raw and no chunk
// at all. It stays — it is the page's only live element, on a site whose rule is
// that a number is real or it is an em-dash.
//
//   widening ±4 -> ±5   would LOSE sensitivity. Not done, for the reason the
//                       paragraphs above already give, four releases running.
//   moving 64 -> 66     keeps ±4 exactly. Sensitivity is IDENTICAL.
//
// 66, not 65: [61, 69] would put reality exactly on the ceiling — the state
// p2·10 named "the upward half is spent again" and p3·13 deliberately declined.
// [62, 70] leaves ONE rung, stated here rather than left to be rediscovered:
// the next shared leaf, or the next route, reds this line.
/* p4·03: RE-CENTRED 66 -> 67, not widened. The build measures 70, and the old
   band [62, 70] put reality exactly ON the ceiling — the state p2·10 named "the
   upward half is spent again" and p3·13 deliberately declined, re-centring for
   the same reason. Widening the ±4 would lose sensitivity in both directions;
   moving the centre keeps it and buys one rung, so the next minted chunk reds
   this and gets read rather than absorbed. The 70th is `Disclosure`, hoisted out
   of SuperstressPage's group when SourcesPage became its third importer — see
   the attribution table beside lazyJsRaw. */
/* p4·04: RE-CENTRED 67 -> 68, not widened — and note that this line was GREEN
   when it moved. The build measures 71 against the old band [63, 71], i.e.
   INSIDE it and exactly ON the ceiling, which is the same state p4·03 found at
   70/[62, 70] and re-centred out of. Re-centring while green is the point: the
   band is a drift DETECTOR, and a detector sitting on its own limit reports the
   next mint as a failure of the budget rather than as news about the build.
   [64, 72] restores the one rung of upward headroom, keeps the ±4 sensitivity
   in both directions, and costs nothing.
   The 71st chunk is `MinePage`, minted by /operate/mine — a plain new lazy
   route, not a shared leaf. This PR deliberately mints ONE and not two: see
   lazyJsRaw's note on why the Superbrain miner line is linked rather than
   derived from pages/future/data.ts. */
/* p4·05: RE-CENTRED 68 -> 69, and again while GREEN. The build measures 72
   against the old band [64, 72] — inside it and exactly ON the ceiling, the
   third release running to arrive in that state (p4·03 at 70/[62,70], p4·04 at
   71/[63,71]). [65, 73] restores the one rung and keeps the ±4 sensitivity.
   The 72nd chunk is `SitePage`, minted by /about/site: a plain new lazy route,
   not a shared leaf. ONE chunk and not two, deliberately — the clover field and
   the overlay host live in the page's own group rather than importing
   coldboot/field.ts, which is lazy and in a DIFFERENT group and would therefore
   have been hoisted into a chunk of its own. See cloverField.ts's header. */
/* p4·06 · RE-CENTRED 69 -> 71, not widened, and by TWO because this release
 * mints TWO chunks rather than the usual one. The build measures 74 against
 * the old band [65, 73] — over it. [67, 75] restores the one rung of upward
 * headroom p4·04 and p4·05 both re-established, and keeps the ±4 sensitivity
 * that makes this a drift DETECTOR rather than a ceiling.
 *
 * WHY TWO. A new lazy page is always one chunk. The second is `ProtocolDetail`,
 * the body shared by the /future modal and the new page: it had exactly ONE
 * importer group (FuturePage's) and now has two, so Rollup hoists it out. That
 * is the leaf lesson's SEVENTH application in this file's history — "a leaf
 * shared ACROSS GROUPS costs a chunk" — and it is visible in the paired
 * measurement rather than inferred: ProtocolDetail +7,851 while FuturePage
 * −7,463, i.e. the bytes LEFT the page they used to sit in. */
/* p4·07 · RE-CENTRED 71 -> 73, not widened, and by TWO because this release
 * mints two chunks. The build measures 76 against the old band [67, 75] — over
 * it. [69, 77] restores the one rung of upward headroom every release since
 * p4·03 has re-established, and keeps the ±4 that makes this a DETECTOR.
 *
 * ── THE FOURTH CONSECUTIVE RE-CENTRE, ARGUED RATHER THAN ASSERTED ───────
 * This line has now moved 60 -> 64 -> 66 -> 67 -> 68 -> 69 -> 71 -> 73, seven
 * times, each time by exactly the number of chunks that release minted. The
 * fair objection is that a centre which always follows the build is a lagging
 * indicator of the build rather than a bound on it. Three things answer it,
 * and the third is the one that has not been written down before.
 *
 * 1 · WHAT THE BAND IS. It is a per-release DELTA detector, not a ceiling on
 *     the count. The count legitimately grows about one per route, forever —
 *     that is what code-splitting IS — so a fixed centre would red on every
 *     new page and mean nothing. The quantity worth watching is the JUMP, and
 *     a jump is measured against a baseline. A baseline that does not track
 *     reality measures nothing at all, so re-centring is the mechanism, not a
 *     concession to it. What actually says "no" on this project is the BYTE
 *     budgets — lazyJsRaw, totalJsRaw, the per-route ceilings — and those do
 *     bind: each is raised deliberately, red-then-green, with an attribution
 *     table beside it.
 *
 * 2 · WHY THE CENTRE AND NOT THE WIDTH. ±4 is the whole sensitivity. Widening
 *     to ±5 would make the band blind to a five-chunk mint — and five is not
 *     hypothetical: p4·06 minted two from ONE extraction, and a broader
 *     import-graph refactor (a design-system leaf gaining importers in four
 *     groups) mints more than that without touching a route. Widening trades
 *     away the only failure this line exists to catch in exchange for not
 *     having to think about it next release, which is the wrong trade.
 *
 * 3 · THE TEST THAT WOULD FALSIFY IT, stated so the next release has a
 *     criterion instead of a feeling. A re-centre is HEALTHY when the release
 *     can name each new chunk and show it is either (a) a net-new lazy route
 *     or (b) a leaf that crossed a group boundary. All seven re-centres so far
 *     have done exactly that, in this file, in the release that caused them —
 *     which is the band working: it has forced an explanation seven times and
 *     got one seven times. The day a release has to re-centre and CANNOT name
 *     the chunk is the day this instrument has stopped working, and the answer
 *     then is not a wider band — it is per-stem accounting, which this file
 *     already produces beside lazyJsRaw and could assert instead.
 *
 * ── THE TWO CHUNKS, NAMED ───────────────────────────────────────────────
 * The 75th is `StressnetExplorerPage`, 16,564 B — a plain new lazy route,
 * category (a).
 *
 * The 76th is `stressnet-model`, 634 B — category (b), and it is the leaf
 * lesson's EIGHTH application in this file's history. That module had exactly
 * ONE importer group (stressnet.tsx, in SimulatePage's) and now has two, so
 * Rollup hoists it out. It is visible as a MOVE rather than inferred: the
 * `stressnet` chunk went 9,283 -> 8,860, i.e. −423, while the extracted leaf
 * is 634 — the bytes LEFT the chunk they used to sit in, and the +211
 * difference is chunk-boundary overhead. That extraction is the whole reason
 * the explorer's own closure is four chunks instead of dragging ProtoArtboard,
 * ProtoCanvas and react-router-dom in behind one pure function. */
/* p4·M9b — RE-CENTRED 73 -> 74, and the band's WIDTH is untouched at ±4.
   The build measures 77, which is INSIDE [69, 77] and exactly ON its ceiling —
   the state this file's own history says to re-centre out of rather than pass
   through, because a per-release DRIFT DETECTOR sitting on its own limit
   reports the next mint as a budget failure instead of as news about the build.
   [70, 78] restores one rung of upward headroom and keeps the ±4 sensitivity
   that a wider band would spend.
   The falsifying test this file demands of a re-centre is met: the release can
   NAME the new chunk. It is `SectionSheet`, 1,147 B, and it is a net-new lazy
   component reached only from a tab tap — deliberately lazy, because
   BottomTabBar is a static import of the eager NavTop and a static import of
   the sheet would pull V6Modal's chunk into the entry (measured: 0 occurrences
   of `v6-modal-veil` in the eager entry after the change). */
const CHUNK_COUNT = 74;
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
/* THE SPLIT (v2·3). totalJsRaw counts one population and its docstring
 * describes another. These two are disjoint and sum to it, so each can be
 * budgeted against what it actually costs a reader. */
const eagerRaw = sum(eagerJs, 'raw') + INFLATE;
const lazyRaw = sum(jsFiles.filter((f) => !EAGER.has(f)), 'raw') + INFLATE;
/* `+ INFLATE` on all three readings, deliberately. Each is an independent
 * measurement, so the hook must be able to redden each one on its own — a new
 * budget the break-test hook cannot reach is a budget nobody can prove goes
 * red, which is the vacuity this file's §7 self-test exists to prevent. */

R.info(`eagerJsGz      ${kb(eagerGz)}    ${kb(BUDGETS.eagerJsGz)}   ${pct(eagerGz, BUDGETS.eagerJsGz)}   ${kb(eagerBr)}`);
R.info(`cssGz          ${kb(cssGz)}    ${kb(BUDGETS.cssGz)}   ${pct(cssGz, BUDGETS.cssGz)}   ${kb(sum(cssFiles, 'br'))}`);
R.info(`totalJsRaw     ${kb(totalJsRaw)}    ${kb(BUDGETS.totalJsRaw)}   ${pct(totalJsRaw, BUDGETS.totalJsRaw)}`);
R.info(`eagerJsRaw     ${kb(eagerRaw)}    ${kb(BUDGETS.eagerJsRaw)}   ${pct(eagerRaw, BUDGETS.eagerJsRaw)}`);
R.info(`lazyJsRaw      ${kb(lazyRaw)}    ${kb(BUDGETS.lazyJsRaw)}   ${pct(lazyRaw, BUDGETS.lazyJsRaw)}`);
R.info(`  eager chunks: ${eagerJs.join(', ')}`);
// 254,399 = `wc -c` over the five sheets main.tsx:26-30 imports. The old
// literal here said 203,896 and was ~50 kB stale — the worst placement such a
// figure can have, since this line PRINTS two measured numbers beside one
// remembered one on every single run.
R.info(`  css raw ${cssRaw} → gzip ${cssGz} (source across 5 sheets: 254,399)`);

/* ══ 2 · per-route first load ════════════════════════════════════════════ */
R.group('2 · per-route first load (gzip) — EAGER ∪ the route chunk\'s static closure');
R.info('A shared chunk is counted once per route and so appears in many rows.');
R.info('Do NOT sum this column — totalJsRaw above is the non-double-counted number.');
// TEN, not six: `grep -c 'id: "' src/views/mempool-meta.ts`. Stale since p2·7
// added the seventh, and printed on every run.
R.info('dynamicImports are EXCLUDED: /mempool\'s ten view engines are a second');
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
R.ok(eagerRaw <= BUDGETS.eagerJsRaw,
  `eager JS ${eagerRaw} B raw ≤ ${BUDGETS.eagerJsRaw}`,
  'the first-paint population — every visitor pays this unconditionally, whether or not they open the surface that grew');
R.ok(lazyRaw <= BUDGETS.lazyJsRaw,
  `lazy JS ${lazyRaw} B raw ≤ ${BUDGETS.lazyJsRaw}`,
  'code behind a dynamic import; growth here is paid only by visitors who open the route that owns it, so ask WHICH chunk before asking whether to raise this');
R.ok(totalJsRaw <= BUDGETS.totalJsRaw,
  `total JS ${totalJsRaw} B raw ≤ ${BUDGETS.totalJsRaw} (backstop, not a calibration check)`,
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
