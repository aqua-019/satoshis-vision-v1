// verify-vitals.mjs — LCP, main-thread blocking, and interaction latency. v6.1.5.
//
// Run: npm run build && (node scripts/serve-dist.mjs &) && npm run wait-preview
//      && node verify-vitals.mjs [--measure]
//      PERF_ASSERT=0 node verify-vitals.mjs      # report only, never fail
//
// ── WHY THIS IS NEW CODE AND NOT A RE-RUN ─────────────────────────────────
// PERF-BASELINE.md:17 describes a PerformanceObserver harness over `longtask`,
// `layout-shift` and `largest-contentful-paint`, and tabulates LCP for three
// routes. THAT HARNESS WAS NEVER COMMITTED. Before this file, tree-wide hits
// for `largest-contentful-paint`, `longtask` and `interactionId` were zero —
// the only PerformanceObserver in the repo was verify-cls.mjs's layout-shift.
// So those numbers cannot be reproduced, and worse, they cannot be CONTINUED:
// v6.0.9 added prerendering, so they were measured against an empty SPA shell
// where LCP required JS to arrive first. Different critical path entirely.
// This file starts a new series and says so.
//
// ── WHY THE ENGINE IS PINNED ──────────────────────────────────────────────
// `largest-contentful-paint`, `longtask` and `event`+`interactionId` are all
// Chromium-only. verify-lib's launch() prefers WebKit, where every observer
// here would simply never fire and the gate would report a confident green
// having measured nothing. launchChromium(), and still feature-detect.
//
// ── WHAT THE NUMBERS ARE NOT ──────────────────────────────────────────────
// Not a Lighthouse run. Not field INP. Not production timings. The profile is
// "Slow-4G · UNCOMPRESSED assets · feed at a fixed latency" — see verify-lib's
// SLOW_4G block for both asymmetries. An LCP improvement measured here will
// OVERSTATE the real-user improvement, because serve-dist ships the stylesheet
// at 73,031 B where Vercel ships 14,863 B gzipped. Read deltas, not absolutes,
// and read them knowing the multiplier.
//
// ── THE EXIT POLICY, STATED ───────────────────────────────────────────────
// A run that cannot measure honestly reports R.skip() and exits 0. That is
// defensible ONLY because skip is its own counter and shows up in the tally a
// human reads: "N passed · N fixtured · N skipped · N failed". It is NOT the
// verify-perf-classic.mjs:163-171 pattern, which prints a warning and calls
// process.exit(0) with no counter at all — that gate has survived doing so
// only because CI never runs it, so its exit code was never load-bearing.
// Copying it into a CI-enforcing gate would be verify-v510 with the polarity
// flipped: instead of teaching people to ignore red, teaching them to ignore
// yellow.
// THRESHOLD: if this gate reports INCONCLUSIVE on 3 consecutive CI runs, it is
// not a gate any more, it is a comment. Fix the runner or delete the budget.
import { makeReporter, launchChromium, BASE, SLOW_4G, CPU_THROTTLE, PHONE, MOCK_LATENCY_MS, throttle, mockStatus,
         coldBootOffBrowser, assertColdBootBypassed } from './verify-lib.mjs';
/* `RT` because `R` in this file is the reporter. Same alias verify-cls.mjs
 * uses, and for the same reason: keys that are string literals drift away
 * from the route table silently — see the note above ROUTES below. */
import { R as RT } from './scripts/routes.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = dirname(fileURLToPath(import.meta.url));
const base = process.env.VERIFY_BASE || BASE;
const MEASURE_ONLY = process.argv.includes('--measure');
const ASSERT = process.env.PERF_ASSERT !== '0';
const RUNS = Number(process.env.VITALS_RUNS || (MEASURE_ONLY ? 8 : 3));

const HARNESS = `serve-dist(uncompressed, 501 /api) · mocked feed @${MOCK_LATENCY_MS}ms · ${PHONE.width}x${PHONE.height} dpr${PHONE.deviceScaleFactor} · ${CPU_THROTTLE}x CPU · Slow-4G · load+3000ms`;

/**
 * Budgets, measured on this tree under HARNESS above.
 *
 * These are NOT the Web Vitals "good" bounds (LCP 2.5s). Those are field
 * thresholds for real users on real networks; this harness is deliberately
 * pessimistic (6x CPU, Slow-4G, uncompressed assets) and its numbers are not
 * comparable to them in either direction. Ceilings are set from measurement of
 * this tree with headroom for a contended shared runner — which, unlike
 * verify-bundle's byte budgets, is real here: these are wall-clock timings.
 *
 * CALIBRATION STATUS: these began sandbox-measured (median of 8 runs/route,
 * Node 22.22.2, headless Chromium 1194, no GPU). Unlike verify-bundle's byte
 * budgets — which are deterministic and hold on any machine — these are
 * wall-clock and the enforcing environment is a shared GitHub runner. They are
 * re-set from the runner's OWN numbers once CI has printed them; every gate
 * here prints its measurement on every run precisely so that is possible
 * without guessing. A ceiling calibrated on the wrong machine is either
 * flaky-red or uselessly loose, and you cannot tell which from the outside.
 *
 * p3·12d PERFORMED THAT RE-SET, FOR ONE ROW ONLY. /live/mempool is calibrated
 * to CI; the other three are still sandbox figures and are deliberately left
 * alone, because CI has now shown all three of them comfortably satisfiable on
 * the judging runner (run #161, the first with a healthy CPU probe: `/` 1928
 * against 2500, /live/markets 2052 against 2600, /learn/sim 2316 against 6000)
 * — those three ceilings sit 30%, 27% and 159% ABOVE their own CI-measured
 * median. A ceiling with that much room does not need moving. The one that did
 * is the one whose measured value sat above IT.
 *
 * Headroom is quoted the same way everywhere in this file: as a percentage OF
 * THE MEASURED VALUE, never of the ceiling. The two conventions differ by
 * enough to matter (4000 over 3010 is +33% of the measurement and +25% of the
 * ceiling) and mixing them silently is how a budget note stops reconciling.
 */
const BUDGETS = {
  //            budget      measured
  [RT.HOME]:         { lcpMs: 2500, blockingMs: 400 }, // sandbox: LCP 1824 (1788-1852) · block 166.5 · CI #161: 1928 / 166
  [RT.LIVE_MEMPOOL]: { lcpMs: 4350, blockingMs: 300 }, // CI-CALIBRATED — see THE MEMPOOL CEILING below. sandbox: LCP 3010 · block 54.5
  [RT.LIVE_MARKETS]: { lcpMs: 2600, blockingMs: 400 }, // sandbox: LCP 1896 (1868-1924) · block 170.0 · CI #161: 2052 / 141
  [RT.LEARN_SIM]:    { lcpMs: 6000, blockingMs: 500 }, // sandbox: LCP 2292 median · block 253.5 — but see BIMODAL below
};

/* ── THE MEMPOOL CEILING: 4000 → 4350, AND WHY IT IS A CALIBRATION ─────────
 *
 * The old 4000 was a sandbox number — 33% above that sandbox's own measured
 * 3010 — and it has never been satisfiable on CI's runner class, which is a
 * different claim and needs different evidence. Nine LCP samples, three runs, three
 * different runners, TWO DIFFERENT TREES:
 *
 *   run  head       runs (ms)             median   cpu probe      outcome
 *   #159 f0fc8179   4092, 4080, 4076      4080     512 (1.97x)    declined (CPU probe)
 *   #160 d3aa03ee   4132, 4108, 4108      4108     503 (1.94x)    declined (CPU probe)
 *   #161 690ead63   4104, 4084, 4108      4104     270 (1.04x)    ❌ 4104 > 4000
 *
 * Read the two trees: f0fc8179 is the circuit branch, d3aa03e/690ead6 the
 * markets branch. Read the two runner states: two contended, one healthy. The
 * nine samples span 4076-4132 — a spread of 1.4% — so this plateau is a
 * property of the RUNNER CLASS and of neither the tree nor the contention. It
 * is not a regression: local paired measurement at p3·12b read main 3,732 and
 * branch 3,720 on the same machine minutes apart, and the verifier's runs read
 * 3,600-3,652. Same tree, different machine, 400ms apart.
 *
 * THE DERIVATION, shown rather than asserted:
 *
 *   high-water single sample observed on CI ............ 4,132 ms  (#160 run 1)
 *   headroom: half of LCP_SPREAD_UNSTABLE's 10% band .... x 1.05
 *   derived ............................................ 4,338.6 ms
 *   rounded up to the next 50 for a legible literal ..... 4,350 ms  (+11.4, +0.3%)
 *
 * The headroom is taken from this gate's OWN constant, not from taste. The
 * spread guard declares that above a 10% disagreement it no longer believes its
 * own wall-clock numbers. Half that band is the statement: a reading up to 5%
 * above the worst plateau sample is still plausibly this machine class and
 * passes; a reading more than halfway to the point where the gate would stop
 * believing itself is called a regression. The full 10% (4,545) was the other
 * candidate and is rejected as too loose — the plateau's own width is 1.4%, so
 * a 10% ceiling would need a 7x-the-noise regression before it spoke.
 *
 * Resulting margins: 242 ms (5.9%) over the highest observed median, 246 ms
 * (6.0%) over the one median a healthy runner actually judged.
 *
 * THIS IS A CALIBRATION TO THE JUDGING RUNNER, NOT A PERFORMANCE CONCESSION.
 * Nothing about the tree got slower and nothing here says a 4,350 ms LCP is
 * acceptable. Local runners still measure 3.6-3.7s on this route, and every run
 * of this gate PRINTS all three samples plus the median — so a future local
 * regression past the old 4,000 figure is visible in the printed numbers on the
 * run that causes it, whether or not it trips a ceiling calibrated for a
 * slower machine. The ceiling answers "is CI allowed to fail this"; the printed
 * series answers "did this tree get slower", and they are different questions
 * measured on different hardware. */

/* /simulate is NEW in v6.1.5 PR B, and its budget is deliberately loose in a
 * file that argues against loose budgets. The reason is measured, not assumed.
 *
 * Its LCP is BIMODAL: 8 runs came back 2248, 2268, 2268, 2276, 2308, 2312 and
 * then 5504, 5520. Six runs in a 64ms band and two at 2.4x that — not spread,
 * two modes. /simulate is the largest chunk in the tree (SimulatePage 180,572 B
 * raw), so a chunk-arrival race under Slow-4G is the obvious suspect, and item
 * 6 of this PR changes exactly that.
 *
 * A budget near the 2292 median would flake: assert mode runs 3, and with a
 * ~25% slow mode the median of 3 lands slow ~15% of the time. That is the
 * verify-v510 failure — a gate red often enough to be ignored. 6000 clears the
 * slow mode and still catches a real regression, which is the honest trade
 * until the bimodality is understood.
 *
 * NOT the same claim as the other three rows. Those are "measured, with runner
 * headroom". This one is "measured, with a known unexplained second mode".
 * Re-tighten it after item 6 lands and the cause is either fixed or named. */

/** Worst single scripted interaction, all routes. One ceiling: this measures
 *  the app's event-handling floor, not anything route-specific.
 *  Measured worst across routes: 176 ms (/markets range button). */
const INTERACTION_BUDGET_MS = 400;

/** The CPU reference. A busy-loop of fixed work under the same throttle; if
 *  this box takes much longer than the reference, the runner is contended and
 *  an LCP measured on it says nothing about the tree. A load-vs-control ratio
 *  cannot detect that — both halves inflate together.
 *  Measured 241-262 ms across 24 sandbox runs. */
const CPU_REF_MS = 260;
const CPU_INCONCLUSIVE_RATIO = 1.6;

/* D1910 · max/min across a route's LCP runs, above which the ENVIRONMENT is
 * unstable and the numbers describe it rather than the tree. Calibrated on
 * measured pairs at one SHA: 3.6% spread idle, 13.4% with one competing
 * CPU-bound process. 1.10 sits between them with room on both sides — tight
 * enough to catch the contention that inflates blocking up to 71%, loose
 * enough not to fire on an idle box's ordinary jitter. LCP is the stability
 * proxy rather than blocking itself because blocking can approach zero, where
 * a ratio explodes on a difference of a few milliseconds. */
const LCP_SPREAD_UNSTABLE = 1.10;

const ROUTES = Object.keys(BUDGETS);


/** Interactions per route. Must NOT navigate — a navigation resets every
 *  observer. A missing selector is R.skip with the selector named, never a
 *  silently recorded zero. */
const INTERACTIONS = {
  /* SELF-PAIRING IS NOT THE RULE — "stays clickable while active" is.
   *
   * The line below self-pairs `.mp-switcher__trigger` and works, because that
   * trigger is a TOGGLE that remains clickable when open: click 1 opens, click
   * 2 closes, both hit the same live element. `/` used to self-pair the same
   * way with the drawer's Open/Close buttons — two DIFFERENT elements.
   *
   * v6.1.6 deleted that drawer, so `button[aria-label="Open menu"]` matched
   * nothing and this probe SKIPPED. Repointing it at the ⌘K trigger while
   * KEEPING the pair shape then failed differently: V6Modal mounts
   * `.v6-modal-veil` across the viewport, so the second click on `.nav-kbd`
   * lost its actionability check and skipped again.
   *
   * So: a self-paired selector is valid only for a toggle that stays clickable
   * while active, and breaks for anything that mounts an overlay. The map
   * cannot express that distinction, which is why it is written here.
   *
   * `.v6-modal-veil` is NOT the fix for the second slot either. Its handler is
   * `if (open && e.target === e.currentTarget) onClose()` — backdrop-close
   * fires only on a click landing directly on the veil, and Playwright clicks
   * an element's CENTRE, where `.v6-modal` sits. The click would pass
   * actionability and simply not close anything: a SILENT failure leaving the
   * palette open for whatever ran next, which is worse than the loud skip.
   * There is no close button; the footer says "Esc", and Escape reaches
   * V6Modal's own document listener by design.
   *
   * ONE selector, therefore — the runner iterates whatever length it is given
   * and '/live/markets' is already a one-element list. The open is also the
   * interaction worth measuring: the first ⌘K triggers the lazy chunk fetch
   * plus first render, comfortably the heaviest interaction on this route,
   * while closing a modal is cheap and measuring it adds nothing.
   *
   * MEANING CHANGE, stated rather than slipped in: `/`'s interaction number is
   * now ONE interaction, not two. It is not comparable to a pre-v6.1.6 figure. */
  [RT.HOME]: ['.nav-kbd'],
  [RT.LIVE_MEMPOOL]: ['.mp-switcher__trigger', '.mp-switcher__trigger'],
  [RT.LIVE_MARKETS]: ['button.proto-btn[aria-pressed]'],
};

const R = makeReporter('verify-vitals');

/* ── KEY-LEVEL GUARDS, because `ROUTES = Object.keys(BUDGETS)` cannot fail ──
 * This gate already defends the SELECTOR level — "a missing selector is
 * R.skip with the selector named, never a silently recorded zero" — and left
 * the KEY level undefended. Two ways that bit:
 *
 *  1. `} else if (INTERACTIONS[route])` further down has no trailing else.
 *     An INTERACTIONS key that stops matching a BUDGETS key means that
 *     interaction is never exercised: no ok, no skip, no line in the tally.
 *     Silent zero coverage — the exact shape verify-cls.mjs was fixed for in
 *     this same PR, one file away, while this one was repointed with string
 *     literals and left alone.
 *  2. The keys are now computed from RT, so a renamed constant propagates.
 *     A DELETED one does not: `[RT.GONE]` evaluates to the literal key
 *     "undefined", which would be fetched as a URL, 404, and score well.
 *
 * Neither guard needs a browser, so they run before anything is launched. */
{
  const bad = ROUTES.filter((r) => !r || r === 'undefined' || !r.startsWith('/'));
  R.ok(bad.length === 0,
    `all ${ROUTES.length} budget keys resolve to a real path`,
    bad.length ? `unresolved: ${JSON.stringify(bad)} — a deleted R.* constant keys the table "undefined"` : '');

  const orphans = Object.keys(INTERACTIONS).filter((r) => !ROUTES.includes(r));
  R.ok(orphans.length === 0,
    `every INTERACTIONS key names a measured route (${Object.keys(INTERACTIONS).length} of ${ROUTES.length} routes script an interaction)`,
    orphans.length ? `orphaned, so never exercised and never reported: ${orphans.join(', ')}` : '');
  R.info(`routes with no scripted interaction (by design): ${ROUTES.filter((r) => !INTERACTIONS[r]).join(', ') || 'none'}`);
}

/* ── WHERE THE ⚠️ LIVES IN THE FOUR COUNTERS, AND ITS FALSIFIABILITY PAIR ──
 *
 * Stated because it is the one thing about the warning with blast radius. The
 * four-counter contract — passed · fixtured · skipped · failed — belongs to
 * verify-reporter.mjs and is shared by 8 gates; growing a fifth counter for one
 * gate would rewrite every other gate's summary line, so it is not on the table.
 *
 * So the decline stays a SKIP in the counters (two of them, one per unmade
 * assertion) and the ⚠️ is a PRINT. That leaves the warning countable by
 * nothing on the summary line, which is the same invisibility this whole PR is
 * about, one level up. Two things close it:
 *
 *   1. The banner is re-printed AFTER R.finish()'s tally, so it is the LAST
 *      thing on screen rather than something scrolled past above it.
 *   2. The two assertions below, which put the warning PREDICATE into the
 *      passed counter even on a run where no route declines.
 *
 * They are a falsifiability PAIR over one real measurement — CI run #161's
 * /live/mempool, the run that went red — and they are not a tautology: the
 * second reads the SHIPPED ceiling, so lowering it back under 4104 turns this
 * red without a browser, and raising it to hide a regression has to get past a
 * named historical number. The first is pinned to the retired 4000 and shows
 * the predicate can fire at all. Same shape verify-markets-dom uses for the one
 * predicate in that gate with no natural red. */
{
  const CI161_LCP = 4104;      // measured: runs 4104, 4084, 4108 — median 4104
  const CI161_BLOCK = 66;      // measured: runs 71, 65, 66 — median 66
  const RETIRED = { lcpMs: 4000, blockingMs: 300 };
  const shipped = BUDGETS[RT.LIVE_MEMPOOL];

  const fires = overCeiling(CI161_LCP, CI161_BLOCK, RETIRED);
  R.ok(fires.length === 1 && fires[0][0] === 'LCP',
    `warning predicate FIRES: CI #161's measured /live/mempool LCP ${CI161_LCP}ms is over the retired ${RETIRED.lcpMs}ms ceiling`,
    `expected exactly [LCP], got ${JSON.stringify(fires)} — the ⚠️ path is unreachable, so a declined-but-failing reading would print nothing`);

  const silent = overCeiling(CI161_LCP, CI161_BLOCK, shipped);
  R.ok(silent.length === 0,
    `warning predicate STAYS SILENT: the same measurement is inside the calibrated ${shipped.lcpMs}ms / ${shipped.blockingMs}ms ceilings`,
    `got ${JSON.stringify(silent)} — the shipped ceiling does not clear the very measurement it was derived from, so it is miscalibrated`);
}

/* ── the mocked feed ──────────────────────────────────────────────────────
 * Unmocked, serve-dist answers /api/* with 501 and every route renders its
 * degraded state — which changes what the LCP ELEMENT is, per route, for
 * reasons that have nothing to do with performance. Shape copied from
 * verify-resilience-dom.mjs:76-104, the most complete mock in the repo.
 * TIP advances per fetch: verify-failure.mjs's lesson is that a constant tip
 * freezes the new-block render path, so the page under measurement is one that
 * never updates. */
let TIP = 3_700_123;
const HEX = (c) => c.repeat(64);
const FIX = {
  tip: () => ({ height: TIP }),
  network: () => ({ height: TIP + 1, difficulty: 412_000_000_000, hashrate: 3_433_333_333, nettype: 'mainnet', version: '0.18.4.1' }),
  blocks: () => ({ blocks: Array.from({ length: 10 }, (_, i) => ({ height: TIP - i, timestamp: 1_770_000_000 - i * 120, size: 22_000, txs: 12 })) }),
  mempool: () => ({ txs: Array.from({ length: 24 }, (_, i) => ({ id: HEX((i % 10).toString()), fee: 3_400 + i, size: 1_500 + i, receive_time: 1_770_000_000 - i })), count: 24, bytes: 41_000 }),
  fees: () => ({ fees: [20_000, 80_000, 320_000, 4_000_000] }),
};

async function mock(ctx) {
  await ctx.route('**/api/xmr/**', async (route) => {
    // A stated latency, not an instant one — see verify-lib's asymmetry 2.
    await new Promise((r) => setTimeout(r, MOCK_LATENCY_MS));
    const u = new URL(route.request().url());
    const p = u.searchParams.get('_p') || u.pathname.replace(/^.*\/api\/xmr\/?/, '');
    const key = ['blocks', 'mempool', 'fees', 'tip', 'network'].find((k) => p.includes(k));
    if (!key) return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    if (key === 'tip') TIP += 1;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FIX[key]()) });
  });
  await ctx.route('**/api/coingecko*', async (route) => {
    await new Promise((r) => setTimeout(r, MOCK_LATENCY_MS));
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ monero: { usd: 164.2, usd_24h_change: 1.4 }, bitcoin: { usd: 61000, usd_24h_change: -0.3 } }) });
  });
  await ctx.route('**/api/markets*', async (route) => {
    await new Promise((r) => setTimeout(r, MOCK_LATENCY_MS));
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ groups: {}, excluded: [], meta: null }) });
  });
  await ctx.route('**/api/feeds*', (route) => route.abort());
  await mockStatus(ctx);
}

/* ── in-page instrumentation, installed before app code ──────────────────── */
const PROBE = () => {
  const S = (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes) || [];
  const V = {
    lcp: 0, lcpEl: '', fcp: 0, lt: [], ev: {},
    supp: {
      lcp: S.includes('largest-contentful-paint'),
      lt: S.includes('longtask'),
      paint: S.includes('paint'),
      // interactionId is what groups raw events into user interactions. Without
      // it, `event` entries cannot be attributed and the number is meaningless.
      ev: S.includes('event') && typeof PerformanceEventTiming !== 'undefined'
        && 'interactionId' in PerformanceEventTiming.prototype,
    },
  };
  window.__V__ = V;
  const obs = (type, cb, extra) => {
    try { new PerformanceObserver(cb).observe({ type, buffered: true, ...extra }); } catch { /* detected above */ }
  };
  if (V.supp.lcp) obs('largest-contentful-paint', (l) => {
    for (const e of l.getEntries()) {
      V.lcp = e.startTime;
      const el = e.element;
      V.lcpEl = el ? `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]}` : '?';
    }
  });
  if (V.supp.lt) obs('longtask', (l) => { for (const e of l.getEntries()) V.lt.push([e.startTime, e.duration]); });
  if (V.supp.paint) obs('paint', (l) => {
    for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') V.fcp = e.startTime;
  });
  // durationThreshold MUST be set: it defaults to 104ms, so an unset observer
  // sees only pathological interactions and confidently reports none the rest
  // of the time. 16 is the floor; lower values are clamped.
  if (V.supp.ev) obs('event', (l) => {
    for (const e of l.getEntries()) {
      // interactionId 0 means "not part of a user interaction" — counting those
      // inflates the group count with unrelated events.
      if (!e.interactionId) continue;
      const cur = V.ev[e.interactionId] || 0;
      if (e.duration > cur) V.ev[e.interactionId] = e.duration;
    }
  }, { durationThreshold: 16 });
};

/** Fixed integer work, consumed so it cannot be optimised away. */
const CPU_PROBE = () => {
  const t0 = performance.now();
  let x = 0;
  for (let i = 0; i < 3_000_000; i++) x = (x + i * 2166136261) % 4294967296;
  window.__CPU_SINK__ = x;
  return performance.now() - t0;
};

const { browser } = await launchChromium();
// v6.1.8: `/` is a budgeted route. An LCP measured against the splash is a
// number about the wrong page. See verify-lib.mjs's COLD BOOT block.
await coldBootOffBrowser(browser);

/* Feature-detect once, before claiming anything. */
const probePage = await browser.newPage();
const supp = await probePage.evaluate(() => {
  const S = (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes) || [];
  return {
    lcp: S.includes('largest-contentful-paint'),
    lt: S.includes('longtask'),
    ev: S.includes('event') && typeof PerformanceEventTiming !== 'undefined'
      && 'interactionId' in PerformanceEventTiming.prototype,
  };
});
await probePage.close();

if (!supp.lcp || !supp.lt || !supp.ev) {
  for (const route of ROUTES) {
    if (!supp.lcp) R.skip(`${route} · LCP`, 'no largest-contentful-paint entry type (Chromium-only)');
    if (!supp.lt) R.skip(`${route} · blockingMs`, 'no longtask entry type (Chromium-only)');
    if (!supp.ev) R.skip(`${route} · interaction`, 'no event-timing interactionId (Chromium-only)');
  }
  await browser.close();
  process.exit(R.finish());
}

/** One load of `route`. Returns LCP/blocking measured BEFORE any interaction,
 *  then the interaction numbers. */
async function measure(route) {
  const ctx = await browser.newContext({
    viewport: { width: PHONE.width, height: PHONE.height },
    deviceScaleFactor: PHONE.deviceScaleFactor,
  });
  await ctx.addInitScript(PROBE);
  await mock(ctx);
  const page = await ctx.newPage();
  await throttle(ctx, page);

  // `load`, never networkidle — the banned idiom (verify-future.mjs:34-40).
  // The tiered feed polls forever so networkidle would never settle.
  await page.goto(base + route, { waitUntil: 'load' });
  await page.waitForTimeout(3000);

  // ORDER IS LOAD-BEARING. LCP keeps updating until the first user input, so
  // it must be read BEFORE any interaction. Interacting first truncates LCP
  // into a number that improves whenever the harness gets faster.
  // v6.1.8 PRECONDITION. The splash IS a large paint: an LCP measured
  // against it is an LCP for the wrong element and can pass a budget the
  // real Home would miss.
  if (route === RT.HOME) await assertColdBootBypassed(page, R, route);

  const load = await page.evaluate(() => ({
    lcp: window.__V__.lcp,
    lcpEl: window.__V__.lcpEl,
    fcp: window.__V__.fcp,
    lt: window.__V__.lt,
  }));

  const cpuMs = await page.evaluate(CPU_PROBE);

  // Now, and only now, drive interactions.
  const sels = INTERACTIONS[route] || [];
  let missing = null;
  for (const sel of sels) {
    const el = page.locator(sel).first();
    // waitFor, not count(). A bare count() asks "is it in the DOM at this
    // instant", and the instant is 250ms after the previous click — under 6x
    // CPU throttle React may not have committed the re-render that CREATES the
    // next selector. Hardening, not a bug fix: this was NOT what made `/` skip.
    // That was the click failing its actionability check, because the open nav
    // drawer covered the very button meant to close it — a product defect, now
    // fixed at styles.css's `.navtop-toggle` z-index. Recorded because the
    // wrong diagnosis was written here first and the run disproved it: a skip
    // whose cause is assumed is the same species of error as this PR's subject.
    try { await el.waitFor({ state: 'visible', timeout: 3000 }); } catch { missing = sel; break; }
    try { await el.click({ timeout: 2000 }); } catch { missing = sel; break; }
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(500);
  const ev = await page.evaluate(() => Object.values(window.__V__.ev));

  await ctx.close();

  const blockingMs = load.lt
    .filter(([start]) => start >= (load.fcp || 0))
    .reduce((n, [, dur]) => n + Math.max(0, dur - 50), 0);

  return {
    lcp: load.lcp, lcpEl: load.lcpEl, fcp: load.fcp,
    blockingMs, longTasks: load.lt.length,
    interactions: ev, worstInteraction: ev.length ? Math.max(...ev) : null,
    missing, cpuMs,
  };
}

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const f1 = (n) => (n === null || n === undefined ? '   —' : n.toFixed(1).padStart(7));

R.group(`verify-vitals — ${HARNESS} · ${RUNS} run(s)/route`);
R.info('LCP is read BEFORE any interaction (it stops updating at first input).');
R.info('"worst interaction" is a LAB number from scripted clicks — NOT field INP,');
R.info('which is a high-percentile over real user sessions and is not producible here.');
R.info('');
R.info('route        LCP(ms)  block(ms)  worstInt(ms)  longTasks  LCP element');

const results = {};
let inconclusive = 0;
/** Of the declined routes, those whose declined median was over its own
 *  ceiling. Its own counter because it is its own fact — see decline(). */
let declinedOverCeiling = 0;

/* ── p3·12d · AN ABSTENTION MUST SAY WHAT IT DECLINED TO JUDGE ────────────
 *
 * This gate has two decline paths — the spread guard and the CPU probe — and
 * until now both printed the runs and then threw the CONCLUSION away. A reader
 * saw "SKIPPED: INCONCLUSIVE" and three run figures, and had to hold the
 * ceiling in their head to know whether the gate had just declined to judge a
 * PASSING number or a FAILING one. Nobody does that, so in practice a decline
 * read as a pass. It is worse than that: the gate EXITS 0 on a run where every
 * route declined, so `✅ verify-vitals: 6 passed · 4 skipped · 0 failed` is
 * what CI shows for a run that judged nothing at all.
 *
 * MEASURED, not supposed. /live/mempool, the two CI runs immediately before
 * the one that went red:
 *
 *   #159  declined at median 4080 ms  against a 4000 ms ceiling   (green run)
 *   #160  declined at median 4108 ms  against a 4000 ms ceiling   (green run)
 *   #161  judged   at median 4104 ms  against a 4000 ms ceiling   ❌
 *
 * The information that the ceiling was unsatisfiable was IN BOTH EARLIER RUNS
 * and was not printed. Two green runs carried a failing number they declined to
 * look at. That is the defect this function exists to make impossible.
 *
 * THE DECISION, TAKEN OUT LOUD: a declined-but-exceeding reading WARNS. It does
 * NOT fail.
 *
 * Failing would be incoherent — the gate would be asserting on evidence it has
 * just declared invalid, and this file's own header says why that is fatal:
 * "Copying [a silent exit] into a CI-enforcing gate would be verify-v510 with
 * the polarity flipped: instead of teaching people to ignore red, teaching them
 * to ignore yellow." Failing on a number the gate itself calls UNVERIFIABLE
 * teaches the first lesson instead — a red that a re-run clears is a red people
 * learn to click through, and this gate's whole value is that its reds mean
 * something. The contended-runner case is real and frequent: two of the three
 * CI runs above were contended.
 *
 * What the warning buys instead is that the number STOPS BEING INVISIBLE. The
 * existing THRESHOLD rule at the top of this file — three consecutive
 * INCONCLUSIVE CI runs and the budget is measuring nothing — is the escalation
 * path, and it is a human one on purpose, because "the ceiling is wrong" and
 * "the tree regressed" are not distinguishable from inside a contended run.
 * The warning is what makes that rule actionable rather than aspirational: it
 * takes a human reading one log to see it now, instead of a human diffing three
 * logs against a constant. */
/** Which of a route's two medians are over their own ceiling. Pure, and split
 *  out of decline() ON PURPOSE: it is the predicate behind the ⚠️ banner, and a
 *  predicate that only ever runs inside a browser-driven loop cannot be shown
 *  to have two polarities. The self-check below exercises it with real numbers.
 *  A ceiling of 0 means "not set" (the TODO(calibrate) case) and is never over. */
function overCeiling(medLcp, medBlock, b) {
  const over = [];
  if (b.lcpMs > 0 && medLcp !== null && medLcp > b.lcpMs) over.push(['LCP', medLcp, b.lcpMs]);
  if (b.blockingMs > 0 && medBlock !== null && medBlock > b.blockingMs) over.push(['blocking', medBlock, b.blockingMs]);
  return over;
}

function decline(route, kind, note, m) {
  const b = BUDGETS[route];
  inconclusive++;

  const verdict = (val, ceil) => {
    if (!ceil || ceil <= 0) return `${val === null ? 'n/a' : val.toFixed(0)}ms — no ceiling set`;
    if (val === null) return `n/a (no sample) vs ceiling ${ceil}ms`;
    return `${val.toFixed(0)}ms vs ceiling ${ceil}ms — ${val <= ceil ? 'would have PASSED' : 'WOULD HAVE FAILED'}`;
  };
  const spreadTxt = m.lcps.length >= 2
    ? `${((m.spread - 1) * 100).toFixed(1)}%`
    : 'n/a (fewer than 2 LCP samples)';

  /* THE REASON IS PRINTED ONCE. The first cut of this function put the whole
   * explanation on BOTH skip lines, which made each of them ~500 characters and
   * buried the two numbers a reader is actually here for — the median and the
   * ceiling — in the middle of a paragraph they had already read. A warning
   * nobody finishes reading is the same defect as a warning nobody prints. */
  R.info('');
  R.info(`DECLINED TO JUDGE · ${route} · ${kind}`);
  R.info(`   ${note}`);
  R.info(`   LCP spread ${spreadTxt} (runs: ${m.lcps.map((n) => n.toFixed(0)).join(', ')}ms) · `
    + `blocking runs ${m.blocks.map((n) => n.toFixed(0)).join(', ')}ms · `
    + `cpu probe ${m.medCpu.toFixed(0)}ms vs ${CPU_REF_MS}ms reference (${(m.medCpu / CPU_REF_MS).toFixed(2)}x)`);

  /* ONE SKIP PER UNMADE ASSERTION, not one per route. A single skip standing in
   * for two budget assertions is the same understatement in miniature as an
   * abstention reading as a pass, and it made the tally uninterpretable: a run
   * declining all four routes reported "4 skipped" for EIGHT assertions never
   * made. MEANING CHANGE, stated rather than slipped in: this gate's skip count
   * is not comparable to a pre-p3·12d one. */
  R.skip(`${route} · median LCP ${verdict(m.medLcp, b.lcpMs)}`, `NOT JUDGED — ${kind}`);
  R.skip(`${route} · median blocking ${verdict(m.medBlock, b.blockingMs)}`, `NOT JUDGED — ${kind}`);

  const over = overCeiling(m.medLcp, m.medBlock, b);
  if (!over.length) return;

  declinedOverCeiling++;
  R.info('');
  R.info(`⚠️  ═══ VITALS_DECLINED_OVER_CEILING · ${route} ═══`);
  for (const [name, val, ceil] of over) {
    R.info(`⚠️   median ${name} ${val.toFixed(0)}ms is ${(val - ceil).toFixed(0)}ms (${(((val / ceil) - 1) * 100).toFixed(1)}%) OVER its ${ceil}ms ceiling`);
  }
  R.info('⚠️   and this run DECLINED TO JUDGE IT. That is not a pass, and it is not nothing:');
  R.info('⚠️   it is an unjudged FAILING reading. If it recurs, the ceiling is wrong or the');
  R.info('⚠️   tree regressed, and a contended runner cannot tell you which — see the');
  R.info('⚠️   THRESHOLD rule in this file\'s header. Do not clear this by re-running.');
  R.info('');
}

for (const route of ROUTES) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) runs.push(await measure(route));

  const lcps = runs.map((r) => r.lcp).filter((n) => n > 0);
  const blocks = runs.map((r) => r.blockingMs);
  const worsts = runs.map((r) => r.worstInteraction).filter((n) => n !== null);
  const cpus = runs.map((r) => r.cpuMs);
  const medLcp = lcps.length ? median(lcps) : null;
  const medBlock = median(blocks);
  const medCpu = median(cpus);
  const worstInt = worsts.length ? Math.max(...worsts) : null;

  results[route] = {
    lcpMs: medLcp, lcpAll: lcps, blockingMs: medBlock, blockingAll: blocks,
    worstInteractionMs: worstInt, interactionSamples: worsts.length,
    lcpElement: runs[0].lcpEl, cpuProbeMs: medCpu, runs: RUNS,
    /* Explicitly false rather than absent, because .perf/vitals.json is the
     * artifact CI uploads and a later reader diffing two runs must be able to
     * tell "judged and passed" from "never judged" without inferring it from a
     * missing key. That inference is exactly what nobody made for three runs. */
    declined: false,
  };

  R.info(`${route.padEnd(11)} ${f1(medLcp)}  ${f1(medBlock)}   ${f1(worstInt)}     ${String(runs[0].longTasks).padStart(5)}      ${runs[0].lcpEl}`);
  R.info(`  ${' '.repeat(9)} runs: ${lcps.map((n) => n.toFixed(0)).join(', ')} ms · cpu probe ${medCpu.toFixed(0)} ms`);
  // D1910: the blocking samples were reduced to a median and DISCARDED. Blocking
  // is the metric with the worse variance under contention, so its spread is the
  // one most worth seeing — and it was the one you could not see.
  R.info(`  ${' '.repeat(9)} blocking: ${blocks.map((n) => n.toFixed(0)).join(', ')} ms`);

  /* ORDER CHANGED IN p3·12d, and it is a fix rather than a tidy-up. This block
   * used to sit BELOW the two decline paths, so a `continue` there discarded it
   * — a declined route reported nothing at all about whether its scripted click
   * had landed. But "did the click hit a live element" is a STRUCTURAL claim,
   * not a wall-clock one, and a contended runner is perfectly capable of
   * answering it. Declining it alongside the timings threw away a judgeable
   * assertion because an unjudgeable one shared the route. Same family as the
   * abstention itself: the abstention was wider than the thing it could not
   * judge. Measured cost of the old order: in runs #159 and #160 all four
   * routes declined, so THREE interaction assertions were silently never made. */
  const missing = runs.find((r) => r.missing);
  if (missing) {
    R.skip(`${route} · interaction`, `selector not found or not clickable: ${missing.missing}`);
  } else if (INTERACTIONS[route]) {
    // A 0 ms worst-interaction derived from zero samples is exactly the vacuous
    // green makeReporter exists to prevent.
    R.ok(worsts.length > 0,
      `${route} · the scripted interaction produced at least one measurable interaction`,
      'zero event-timing groups: the click landed on nothing, so any latency number would be fabricated');
  }

  /* ── D1910 · RUN SPREAD IS THE CONTENTION SIGNAL; THE CPU PROBE IS NOT ─────
   *
   * The probe below was the gate's only validity claim, and it tests the wrong
   * quantity. Measured, one competing CPU-bound process, nothing else changed:
   *
   *   route            blocking IDLE→LOADED       cpu probe IDLE→LOADED
   *   /                    196 → 336ms  (+71%)        249 → 235 ms   DOWN
   *   /live/markets        199 → 267ms  (+34%)        254 → 252 ms   DOWN
   *   /learn/sim           108 → 162ms  (+50%)        231 → 251 ms   up
   *   /live/mempool         95 → 112ms  (+18%)        215 → 187 ms   DOWN
   *
   * Blocking rose 18-71%; the probe moved the WRONG WAY on three of four
   * routes. A ratio of 1.02 is therefore perfectly compatible with blocking at
   * 2.9x historical, because the probe is average throughput over one short
   * window while Total Blocking Time is tail latency accumulated across the
   * whole load. Preemption stretches individual tasks past the 50ms line
   * without changing a short busy loop's wall time.
   *
   * So `CPU_INCONCLUSIVE_RATIO` is not a threshold this failure mode nearly
   * reaches — it is one it does not approach. The label said the measurement
   * was valid; the predicate tested something else. Same family this suite
   * keeps finding, sitting inside the validity check itself.
   *
   * The signal was already on screen and thrown away: the per-run spread.
   *   idle    / runs 1984, 1980, 2052   spread 3.6%
   *   loaded  / runs 2296, 2040, 2024   spread 13.4%
   *
   * A contended box can currently only produce a green or a red, and a red
   * there is as wrong as a green. UNVERIFIABLE is the honest third answer and
   * this gate already has the vocabulary for it. */
  const lcpSpread = lcps.length >= 2 ? Math.max(...lcps) / Math.min(...lcps) : 1;
  const m = { medLcp, medBlock, medCpu, lcps, blocks, spread: lcpSpread };

  if (lcpSpread > LCP_SPREAD_UNSTABLE) {
    results[route].declined = true;
    decline(route,
      `UNVERIFIABLE (run spread ${((lcpSpread - 1) * 100).toFixed(1)}% exceeds ${((LCP_SPREAD_UNSTABLE - 1) * 100).toFixed(0)}%)`,
      'The machine moved between runs, so a wall-clock number from it describes the runner, not the tree. '
      + 'NOTE the cpu probe did NOT flag this — it measures average throughput, blocking measures tail '
      + 'latency, and under contention the two move independently.', m);
    continue;
  }

  // Kept, DEMOTED: still a skip when it fires, but it is no longer the only
  // validity claim and it never was evidence on its own.
  if (CPU_REF_MS && medCpu > CPU_REF_MS * CPU_INCONCLUSIVE_RATIO) {
    results[route].declined = true;
    decline(route,
      `INCONCLUSIVE (CPU probe ${medCpu.toFixed(0)}ms vs ${CPU_REF_MS}ms reference, ${(medCpu / CPU_REF_MS).toFixed(2)}x)`,
      'This runner is contended; a wall-clock number measured on it says nothing about the tree.', m);
    continue;
  }

  if (!MEASURE_ONLY && ASSERT) {
    const b = BUDGETS[route];
    if (b.lcpMs > 0) {
      R.ok(medLcp !== null && medLcp <= b.lcpMs,
        `${route} · median LCP ${medLcp === null ? 'n/a' : medLcp.toFixed(0)}ms ≤ ${b.lcpMs}ms`,
        `runs: ${lcps.map((n) => n.toFixed(0)).join(', ')}`);
      R.ok(medBlock <= b.blockingMs,
        `${route} · median blocking ${medBlock.toFixed(0)}ms ≤ ${b.blockingMs}ms`,
        `runs: ${blocks.map((n) => n.toFixed(0)).join(', ')}`);
    } else {
      R.skip(`${route} · LCP / blocking budget`, 'TODO(calibrate) — no ceiling set yet');
    }
  }
}

/* p3·12d: THE ABSTENTION HAS TO ABSTAIN FROM THIS ONE TOO.
 *
 * Interaction latency is a wall-clock quantity measured on the same contended
 * box as everything else, and this assertion was reading routes the gate had
 * just declined to judge. Runs #159 and #160 declined all four routes for
 * contention and then asserted `worst scripted interaction 112ms ≤ 400ms` ✅
 * over exactly those routes' numbers — a green whose evidence the same run had
 * declared invalid two lines earlier, and the only ✅ either run produced
 * besides three cold-boot preconditions.
 *
 * Declined routes are excluded. If that leaves nothing, this is a SKIP naming
 * the routes it lost, never a silent absence — an `if (allWorst.length)` with
 * no else is the vacuous-zero-coverage shape the KEY-LEVEL GUARDS block above
 * was written for, one screen away. */
if (!MEASURE_ONLY && ASSERT && INTERACTION_BUDGET_MS > 0) {
  const judged = Object.entries(results).filter(([, v]) => !v.declined);
  const declinedNames = Object.entries(results).filter(([, v]) => v.declined).map(([k]) => k);
  const allWorst = judged.map(([, v]) => v.worstInteractionMs).filter((n) => n !== null);
  if (allWorst.length) {
    const w = Math.max(...allWorst);
    R.ok(w <= INTERACTION_BUDGET_MS,
      `worst scripted interaction ${w.toFixed(0)}ms ≤ ${INTERACTION_BUDGET_MS}ms (lab, not field INP)`
        + (declinedNames.length ? ` — over ${judged.length} judged route(s); ${declinedNames.length} declined` : ''),
      `per judged route: ${judged.map(([k, v]) => `${k} ${v.worstInteractionMs?.toFixed(0) ?? 'n/a'}`).join(' · ')}`);
  } else {
    R.skip('worst scripted interaction ≤ ' + INTERACTION_BUDGET_MS + 'ms',
      declinedNames.length
        ? `every route with an interaction was declined (${declinedNames.join(', ')}), so every latency sample was measured on a runner this gate has already called unverifiable`
        : 'no route produced a measurable interaction sample');
  }
}

if (inconclusive) {
  R.info('');
  R.info(`${inconclusive} of ${ROUTES.length} route(s) INCONCLUSIVE — ${inconclusive * 2} budget assertion(s) NOT MADE.`);
  R.info('That is a SKIP in the tally above, not a pass. This gate exits 0 on a run that');
  R.info('judged nothing, so read the skip count, never the ✅ on the summary line alone.');
  R.info('If this happens on 3 consecutive CI runs the budget is measuring nothing — fix or delete it.');
  if (declinedOverCeiling) {
    R.info('');
    R.info(`⚠️  ${declinedOverCeiling} of those ${inconclusive} declined route(s) had a median OVER its own ceiling.`);
    R.info('⚠️  Search this log for VITALS_DECLINED_OVER_CEILING. A run that declines a failing');
    R.info('⚠️  number is the state that hid an unsatisfiable /live/mempool ceiling for the two');
    R.info('⚠️  CI runs before it finally drew a healthy runner and went red (#159, #160, #161).');
  }
}

// The baseline artifact, stamped with the harness that produced it. Written on
// every run — unlike verify-bundle and verify-cls this gate has no inflater
// env hook (its red path is driven harness-side by delaying the stylesheet),
// so there is no non-authoritative run to guard against here.
mkdirSync(join(APP, '.perf'), { recursive: true });
writeFileSync(join(APP, '.perf', 'vitals.json'),
  JSON.stringify({ harness: HARNESS, runs: RUNS, measuredAt: new Date().toISOString(), results }, null, 2));

await browser.close();
if (!ASSERT) R.info('(PERF_ASSERT=0 — reporting only)');

/* The tally is printed FIRST and the warning AFTER it, deliberately. A reader
 * scanning a 3,000-line CI log stops at the summary line; anything above it
 * competes with 29 other gates' output for attention and loses. The warning is
 * in no counter (see the note beside the self-check above), so being the last
 * line on screen is the only prominence available to it. */
const code = MEASURE_ONLY || !ASSERT ? 0 : R.finish();
if (declinedOverCeiling) {
  console.log(`\n⚠️  AND: ${declinedOverCeiling} route(s) were DECLINED while over a ceiling — grep VITALS_DECLINED_OVER_CEILING.`);
  console.log('⚠️  Those are in the SKIPPED count, not the failed count. That is deliberate (a gate must not');
  console.log('⚠️  assert on evidence it has called unverifiable) and it is exactly why this line is here.');
}
process.exit(code);
