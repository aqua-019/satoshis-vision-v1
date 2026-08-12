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
  '/about/peers': 'src/pages/TrustedPeersPage.tsx',
  '/about/sources': 'src/pages/SourcesPage.tsx',
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
  // main.tsx:26-30 (203,896 bytes of SOURCE) and Vite minifies them to one
  // file: measured 73,031 raw / 14,863 gzip. Budgeted because it blocks the
  // first paint and nothing has ever measured it.
  cssGz: 17_000,
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
  totalJsRaw: 1_000_000,
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
  lazyJsRaw: 736_000,
  // NOT calibrated — this is Vite's own chunkSizeWarningLimit default, which
  // PERF-BASELINE.md:76 tracks as "silent". vite.config.ts deliberately leaves
  // that option unset so the warning and this assertion agree. Largest chunk
  // today is SimulatePage at 180,572.
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
  '/live/markets':          105_000, //  95,817
  '/live/markets/thesis':    96_000, //  87,434 — new: split out of the old /monero/markets tab
  '/live/network':          108_000, // 106,035 — RAISED from 106,000, and the old `96,436`
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
                                     //  is stale. /live/mempool reads 96,835 and measures 103,977;
                                     //  /live/markets reads 95,817 and measures 102,484. Both sit
                                     //  at 96-99% of ceilings written to hold ~10%. Re-measuring
                                     //  the whole table is its own change; doing it here would
                                     //  bury a budget re-baseline inside a layout PR.
  '/learn':                 108_000, //  97,870
  '/learn/sim':              94_000, //  85,723 — v6.1.5 PR B: was 133,676/148,000 when this
                                     //           carried all 16 protocol modules eagerly. The 21
                                     //           simulators are lazy now, so this is the shell plus
                                     //           only the default sim's chunk.
  '/monero':                115_000, // 104,154 — 7 tab modules now (was 9: markets and outlook
                                     //           moved out to their own top-level routes above)
  '/future':                107_000, //  96,895
  '/future/outlook':         92_000, //  83,652 — new: split out of the old /monero/outlook tab
  '/operate/node':           92_000, //  83,305
  '/about/peers':           100_000, //  91,082
  '/about/sources':          95_000, //  86,581
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
const CHUNK_COUNT = 60;
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
