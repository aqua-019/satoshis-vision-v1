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
import { makeReporter, launchChromium, BASE, SLOW_4G, CPU_THROTTLE, PHONE, MOCK_LATENCY_MS, throttle, mockStatus } from './verify-lib.mjs';
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
 * CALIBRATION STATUS: these are sandbox-measured (median of 8 runs/route,
 * Node 22.22.2, headless Chromium 1194, no GPU). Unlike verify-bundle's byte
 * budgets — which are deterministic and hold on any machine — these are
 * wall-clock and the enforcing environment is a shared GitHub runner. They are
 * re-set from the runner's OWN numbers once CI has printed them; every gate
 * here prints its measurement on every run precisely so that is possible
 * without guessing. A ceiling calibrated on the wrong machine is either
 * flaky-red or uselessly loose, and you cannot tell which from the outside.
 */
const BUDGETS = {
  //            budget      measured (median of 8, sandbox)
  [RT.HOME]:         { lcpMs: 2500, blockingMs: 400 }, // LCP 1824 (1788-1852) · block 166.5
  [RT.LIVE_MEMPOOL]: { lcpMs: 4000, blockingMs: 300 }, // LCP 3010 (2976-3044) · block  54.5
  [RT.LIVE_MARKETS]: { lcpMs: 2600, blockingMs: 400 }, // LCP 1896 (1868-1924) · block 170.0
  [RT.LEARN_SIM]:    { lcpMs: 6000, blockingMs: 500 }, // LCP 2292 median · block 253.5 — but see BIMODAL below
};

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
  };

  R.info(`${route.padEnd(11)} ${f1(medLcp)}  ${f1(medBlock)}   ${f1(worstInt)}     ${String(runs[0].longTasks).padStart(5)}      ${runs[0].lcpEl}`);
  R.info(`  ${' '.repeat(9)} runs: ${lcps.map((n) => n.toFixed(0)).join(', ')} ms · cpu probe ${medCpu.toFixed(0)} ms`);

  // Contention check, per route: a skip, never a silent pass.
  if (CPU_REF_MS && medCpu > CPU_REF_MS * CPU_INCONCLUSIVE_RATIO) {
    inconclusive++;
    R.skip(`${route} · LCP / blocking`,
      `INCONCLUSIVE — CPU probe ${medCpu.toFixed(0)}ms vs ${CPU_REF_MS}ms reference (${(medCpu / CPU_REF_MS).toFixed(2)}x). This runner is contended; a wall-clock number measured on it says nothing about the tree.`);
    continue;
  }

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

if (!MEASURE_ONLY && ASSERT && INTERACTION_BUDGET_MS > 0) {
  const allWorst = Object.values(results).map((r) => r.worstInteractionMs).filter((n) => n !== null);
  if (allWorst.length) {
    const w = Math.max(...allWorst);
    R.ok(w <= INTERACTION_BUDGET_MS,
      `worst scripted interaction ${w.toFixed(0)}ms ≤ ${INTERACTION_BUDGET_MS}ms (lab, not field INP)`,
      `per route: ${Object.entries(results).map(([k, v]) => `${k} ${v.worstInteractionMs?.toFixed(0) ?? 'n/a'}`).join(' · ')}`);
  }
}

if (inconclusive) {
  R.info('');
  R.info(`${inconclusive} route(s) INCONCLUSIVE. That is a SKIP in the tally above, not a pass.`);
  R.info('If this happens on 3 consecutive CI runs the budget is measuring nothing — fix or delete it.');
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
process.exit(MEASURE_ONLY || !ASSERT ? 0 : R.finish());
