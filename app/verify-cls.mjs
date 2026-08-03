/**
 * verify-cls.mjs — cumulative layout shift, measured rather than assumed.
 *
 * Run: npm run build && (node scripts/serve-dist.mjs &) && npm run wait-preview
 *      && node verify-cls.mjs [--measure]
 *      CLS_RUNS=8 node verify-cls.mjs --measure     # re-baseline
 *
 * The brief's wording is "zero layout shift on load — CLS measured, near zero".
 * Two things follow from that, and both are easy to get wrong:
 *
 *   · "measured" means the number is printed EVERY run, not just compared.
 *     A gate that prints only pass/fail hides drift until the day it fails,
 *     and by then nobody knows which change moved it.
 *   · "near zero" is not the Web Vitals "good" bound of 0.1. A skeleton that
 *     shifts half a panel scores well under 0.1 and would sail through. The
 *     threshold here comes from measuring THIS tree and adding headroom — see
 *     MEASURED below. This is not theoretical: the unreserved-fallback
 *     experiment measured ~0.085, which is BELOW 0.1. A 0.1 ceiling would have
 *     waved through a real, documented regression.
 *
 * ── WHY THIS FILE PINS CHROMIUM ────────────────────────────────────────────
 * `layout-shift` is a Chromium-only PerformanceObserver entry type. WebKit
 * does not implement it: an observer registered there never fires, CLS reads
 * 0.0, and the gate reports a confident green having measured nothing.
 * verify-lib's `launch()` prefers WebKit, so this file uses `launchChromium()`
 * instead — and still feature-detects, reporting SKIPPED (its own counter,
 * never folded into the pass count) if the entry type is absent. A gate that
 * cannot measure must say so; that is what R.skip exists for.
 *
 * ── TWO PASSES, AND WHY THEY ARE NEVER COMPARED ────────────────────────────
 * Until v6.1.5 this file called ctx.route() ZERO times. serve-dist answers
 * /api/* with 501, so all four routes were measured against a totally degraded
 * feed — and nothing in the file said so. That is the finding, not a footnote:
 * every CLS number this repo has ever recorded describes a page where data
 * NEVER ARRIVES.
 *
 * That matters because v6.1.4 shipped structure-aware skeletons whose entire
 * purpose is preventing shift WHEN DATA ARRIVES — <Swap> mounts content at
 * opacity:0 beneath the skeleton so nothing remounts. The whole class of shift
 * that work exists to prevent was unmeasured.
 *
 * So there are now two passes, with two threshold tables:
 *   · degraded (unmocked, 501 feed) — the existing series, unchanged, so every
 *     previously recorded number stays comparable.
 *   · healthy (mocked)              — a new series that actually sees data land.
 * They measure DIFFERENT PHENOMENA. Do not average them, do not derive one's
 * ceiling from the other's numbers, and do not quote one without its label.
 * Deriving a ceiling for one experiment from measurements of another is
 * precisely what the vintage table below exists to stop happening again.
 *
 * ── PROVENANCE: EVERY CLS NUMBER IN THIS TREE, AND ITS HARNESS ─────────────
 * Four vintages existed with nothing saying which harness produced which.
 * Recorded once, here:
 *
 *   1. PERF-BASELINE.md:87        / 0.0008→0.0009      v6.0.8, pre-prerender,
 *                                                      pre-#152      SUPERSEDED
 *   2. this file's former :49-55  8 runs, / 0.0008-9   SPA-shell harness:
 *                                                      /api/* answered 200
 *                                                      text/html     SUPERSEDED
 *   3. #153 handoff               0.0009/0/0.0001/0.0001   as vintage 2
 *                                                                    SUPERSEDED
 *   4. #155 PR body               0.0002/0/0/0, 3 runs  first 501 harness
 *                                                                    SUPERSEDED
 *   5. HARNESS_DEGRADED below     see MEASURED           v6.1.5          LIVE
 *   6. HARNESS_HEALTHY below      see MEASURED_MOCKED    v6.1.5, new     LIVE
 *
 * From here on a number without a harness stamp is not a number. Both live
 * passes stamp themselves into .perf/cls.json on --measure.
 *
 * ── CONDITIONS ─────────────────────────────────────────────────────────────
 * Imported from verify-lib.mjs rather than re-declared, so this gate and
 * verify-vitals.mjs cannot drift apart. Read that block: serve-dist serves
 * assets UNCOMPRESSED, and route.fulfill bypasses the emulated network.
 */
import {
  makeReporter, launchChromium, BASE,
  CPU_THROTTLE, PHONE, MOCK_LATENCY_MS, throttle, mockStatus,
  coldBootOffBrowser, assertColdBootBypassed,
} from './verify-lib.mjs';
// Aliased: `R` is already the reporter in this file. Keys below are derived
// from the canonical route constants rather than retyped, because five of them
// silently went stale in the nav restructure and the gate could not notice —
// ROUTES is Object.keys(MEASURED), so a key can never miss its own lookup.
import { R as RT } from './scripts/routes.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
// api/nodes.js is CommonJS; createRequire is the bridge an .mjs gate uses for
// it — same idiom as api/verify-status.mjs:25-26.
import { createRequire } from 'node:module';

const APP = dirname(fileURLToPath(import.meta.url));
const base = process.env.VERIFY_BASE || BASE;
const MEASURE_ONLY = process.argv.includes('--measure');
const RUNS = Number(process.env.CLS_RUNS || (MEASURE_ONLY ? 3 : 1));

/* ── The break-test hook, and its three guards ────────────────────────────
 * CLS_INFLATE makes the red path reproducible without editing source — the
 * __XMR_TIER_MS__ idiom, and the reason is v6.1.3, which shipped a session
 * where a break-test mutation stayed in the working tree and every "green" run
 * after it measured a tree that no longer existed.
 *   1. ADDITIVE ONLY — a negative or zero value could only ever mask a
 *      regression, so it is refused rather than honoured.
 *   2. NON-AUTHORITATIVE — a run with it set refuses to write a baseline.
 *   3. ASSERTED UNSET in the finish sequence. That grep reads FILES and cannot
 *      see an environment variable, and neither can `git status`. (It does not
 *      spell the banned break-test token on purpose — a header that names it
 *      makes the grep match on prose forever and stop being a check.) */
const INFLATE_RAW = process.env.CLS_INFLATE;
let INFLATE = 0;
if (INFLATE_RAW !== undefined && INFLATE_RAW !== '') {
  const n = Number(INFLATE_RAW);
  if (!Number.isFinite(n) || n <= 0) {
    console.error(`verify-cls: CLS_INFLATE must be a positive number (got ${JSON.stringify(INFLATE_RAW)}).`);
    console.error('It exists to ADD synthetic shift and prove this gate goes red. A negative or');
    console.error('zero value could only ever mask a regression, so it is refused.');
    process.exit(2);
  }
  INFLATE = n;
}

const HARNESS_DEGRADED = `serve-dist(501 /api, uncompressed) · ${PHONE.width}x${PHONE.height} dpr${PHONE.deviceScaleFactor} · ${CPU_THROTTLE}x CPU · Slow-4G · load+3000ms`;
const HARNESS_HEALTHY = `serve-dist(uncompressed) · mocked feed @${MOCK_LATENCY_MS}ms · ${PHONE.width}x${PHONE.height} dpr${PHONE.deviceScaleFactor} · ${CPU_THROTTLE}x CPU · Slow-4G · load+3000ms`;

/**
 * Pass 1 — DEGRADED (unmocked, /api/* → 501). The continuing series.
 *
 * Re-measured on 5fca6ba + v6.1.5 instrumentation, 8 runs per route, under
 * HARNESS_DEGRADED. Every reading was 0.0000 except `/` (see below), so these
 * ceilings are headroom for a shared CI runner, not for observed variance —
 * there is essentially none.
 *
 * /markets keeps the loosest ceiling of the original four: PERF-BASELINE.md
 * recorded 0.0078 there post-v6.0.8, and that route's charts can shift when
 * history lands in a different order. A ceiling that flakes teaches people to
 * ignore red, which is how verify-v510 died.
 *
 * /sources is NEW in v6.1.5 — prompt 05 named it planned-but-not-done rather
 * than letting it read as complete. Under this pass /api/status 501s, so what
 * is measured is SourcesPage's endpoint-down state: a real, stable layout.
 */
const MEASURED = {
  //  route        ceiling   worst of 8 runs on 5fca6ba
  [RT.HOME]:            0.005,  // 0.0009  (v6.1.5 PR B, e618c14; was 0.0006 on 5fca6ba)
  [RT.LIVE_MEMPOOL]:     0.005,  // 0.0000  (8 of 8)
  [RT.LIVE_MARKETS]:     0.005,  // 0.0000  (8 of 8)  — was 0.02; see the caveat below
  [RT.LIVE_NETWORK]:     0.005,  // 0.0000  (8 of 8)
  [RT.ABOUT_SOURCES]:     0.005,  // 0.0000  (8 of 8)  — NEW in v6.1.5
  [RT.LEARN_SIM]:    0.005,  // NEW in v6.1.5 PR B — see the note below
};

/* /simulate is NEW in PR B, and it is here for one reason: PR B makes the 21
 * protocol simulators lazy, which puts a Suspense boundary on the stage. An
 * unreserved lazy swap is exactly the arrival-shift class this gate's mocked
 * pass was built to catch, and /simulate is the largest chunk in the tree.
 *
 * Provenance, stated rather than implied: this row is baselined at e618c14 —
 * that is, AFTER the ticker fix and BEFORE the splitting. The splitting is the
 * change this row exists to guard, so that is the honest "before" for it. It
 * was not measured on 4be3003; the ticker fix is a topbar change measured on
 * the five routes above, and the sim stage is not downstream of it. */

/* CAVEAT on /markets, stated rather than left implicit. Its old 0.02 ceiling
 * existed because PERF-BASELINE.md recorded 0.0078 there post-v6.0.8: those
 * charts can shift when history lands in a different order. Neither pass
 * currently exercises that. The degraded pass 501s /api/markets, and the
 * healthy pass fulfils it with `{groups:{}}` (the payload inherited from
 * verify-resilience-dom.mjs), so the Markets charts render EMPTY in both and
 * their shift behaviour is unmeasured. The tightened ceiling is honest about
 * what IS measured; it is not evidence about charts. Populating that fixture
 * is worth doing and is not this PR's scope. */

/**
 * Pass 2 — HEALTHY (mocked feed). A NEW series, baselined independently.
 *
 * Its ceilings are NOT derived from the degraded numbers above. This pass sees
 * skeletons resolve into content, which is a different phenomenon and can
 * legitimately read higher.
 */
const MEASURED_MOCKED = {
  //  route        ceiling   worst of 8 runs
  [RT.HOME]:            0.005,  // 0.0012  (v6.1.5 PR B, e618c14; was 0.3483 — see below)
  [RT.LIVE_MEMPOOL]:     0.005,  // 0.0000  (8 of 8)
  [RT.LIVE_MARKETS]:     0.005,  // 0.0000  (8 of 8)  — same empty-chart caveat as above
  [RT.LIVE_NETWORK]:     0.005,  // 0.0000  (8 of 8)
  [RT.ABOUT_SOURCES]:     0.005,  // 0.0000  (8 of 8)
  [RT.LEARN_SIM]:    0.005,  // NEW in v6.1.5 PR B — see the note above
};

/* ── `/`'s 0.35 DEFECT: RESOLVED in v6.1.5 PR B (e618c14) ─────────────────
 * Kept as a record rather than deleted, because the SUPERSEDED DIAGNOSIS is
 * the more useful half of this note.
 *
 *   measured 0.3483 (PR A recorded 0.3482)  ->  0.0012, worst of 8
 *
 * PR A recorded the cause as: `DIV.ticker-strip` grows from h25 to h38 when the
 * first market tick lands and displaces `.shell` — 746px on an 844px viewport —
 * by 3px, and "a near-full-viewport element moving at all produces a large
 * impact x distance product, which is how 3px becomes 0.35."
 *
 * THAT LAST STEP IS NOT HOW THE METRIC WORKS, and the number disproves it three
 * ways. (a) Arithmetic: score is impact fraction x distance fraction, where the
 * distance fraction is the greatest movement over the viewport's LARGEST
 * dimension. 3/844 = 0.00355, so one such entry caps at 0.0036 even at impact
 * 1.0 — two orders short. 0.3482 requires ~294px of movement. (b) Polarity: the
 * degraded pass renders NO NODE RESPONSE, the LONGEST of the five labels, and
 * reads 0.0006; the healthy pass lands on LIVE, the SHORTEST, and read 0.3483.
 * If label-driven ticker geometry were the cause, degraded would be the worse
 * pass — it was better by 580x. (c) Layout: at 390px `styles.css:2347` hides
 * every `.ticker-strip > .tk`, so no price element remains for a tick to grow.
 *
 * The observations were right; the attribution was wrong. `sources` capture (now
 * committed, above) shows the dominant entry carries FOUR nodes: `.ticker-strip`
 * really does go 202x25 -> 159x38, and `.shell` really is displaced 3px — but
 * `BUTTON.navtop-toggle` moves **314px horizontally** when `.topbar`'s
 * `flex-wrap` re-solves, and 314/844 = 0.372 is the entire score. See the fix
 * and its measured alternatives at `styles.css`'s `.ticker-strip > .pill`
 * rule.
 *
 * HOW THE WRONG STORY GOT IN, which is the part worth carrying forward: until
 * PR B this observer read `entry.value` and never `entry.sources`, so that
 * diagnosis came from ad-hoc instrumentation that was never committed and could
 * not be re-run. It is the same defect PR A itself found at PERF-BASELINE.md:17
 * — a documented measurement whose harness does not exist — committed by the PR
 * that flagged it. The capture above exists so this cannot recur silently. */

const ROUTES = Object.keys(MEASURED);

const R = makeReporter('verify-cls');

const { browser } = await launchChromium();
// v6.1.8: `/` is one of the MEASURED routes and now boots behind a splash.
// Without this every `/` number below would describe the splash. See
// verify-lib.mjs's COLD BOOT block for why the wrapper, not per-site edits.
await coldBootOffBrowser(browser);

/* Feature-detect once, on a throwaway page, before claiming anything. */
const probe = await browser.newPage();
const supported = await probe.evaluate(
  () => typeof PerformanceObserver !== 'undefined' &&
        Array.isArray(PerformanceObserver.supportedEntryTypes) &&
        PerformanceObserver.supportedEntryTypes.includes('layout-shift'),
);
await probe.close();

if (!supported) {
  // Not a pass and not a failure — an honest "this engine cannot answer".
  for (const route of ROUTES) {
    R.skip(`${route} · CLS`, 'this engine has no layout-shift entry type (Chromium-only)');
  }
  await browser.close();
  process.exit(R.finish());
}

/* The mocked feed for pass 2. Shape from verify-resilience-dom.mjs:76-104.
 * TIP advances per fetch — verify-failure.mjs's lesson is that a constant tip
 * freezes the new-block render path, so the page never updates and an outage
 * (or an arrival) becomes invisible. */
let TIP = 3_700_123;
const HEX = (c) => c.repeat(64);
const FIX = {
  tip: () => ({ height: TIP }),
  network: () => ({ height: TIP + 1, difficulty: 412_000_000_000, hashrate: 3_433_333_333, nettype: 'mainnet', version: '0.18.4.1' }),
  blocks: () => ({ blocks: Array.from({ length: 10 }, (_, i) => ({ height: TIP - i, timestamp: 1_770_000_000 - i * 120, size: 22_000, txs: 12 })) }),
  mempool: () => ({ txs: Array.from({ length: 24 }, (_, i) => ({ id: HEX((i % 10).toString()), fee: 3_400 + i, size: 1_500 + i, receive_time: 1_770_000_000 - i })), count: 24, bytes: 41_000 }),
  fees: () => ({ fees: [20_000, 80_000, 320_000, 4_000_000] }),
};

/* The live /api/nodes envelope — produced by RUNNING THE REAL HANDLER against
 * the committed fixture, not rebuilt from its helpers and not transcribed.
 *
 * The first version of this block did rebuild it, and was wrong within one
 * commit: it derived `counts.seen` as `nodes.length + excluded` (25) where the
 * handler produces 24. A mock that reassembles an envelope is a second
 * implementation of the envelope, and a second implementation drifts — which
 * would quietly restore the very gap this mock was added to close, while
 * looking like it had closed it. Invoking the handler makes drift structurally
 * impossible: there is only one implementation and this is it.
 *
 * Offline by construction — `globalThis.fetch` is stubbed with the fixture for
 * the duration of the call and restored in `finally`, so nothing leaves. */
const NODES_LIVE = await (async () => {
  const req = createRequire(import.meta.url);
  const handler = req('../api/nodes.js');
  const fixture = req('../api/_fixtures/monerofail-health.json');
  const captured = { body: null };
  const res = {
    setHeader() { return res; }, getHeader() { return undefined; },
    status() { return res; }, json(b) { captured.body = b; return res; }, end() { return res; },
  };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => fixture });
  try {
    handler._resetCache();
    await handler({ method: 'GET', query: {}, url: '/api/nodes' }, res);
  } finally {
    globalThis.fetch = realFetch;
  }
  if (!captured.body || captured.body.status !== 'live') {
    throw new Error(`verify-cls: /api/nodes mock did not produce a live envelope (got ${JSON.stringify(captured.body)?.slice(0, 120)}) — the mock would otherwise silently measure the panel's EMPTY state, which is the one state whose height cannot shift`);
  }
  return captured.body;
})();

async function mockFeed(ctx) {
  await ctx.route('**/api/xmr/**', async (route) => {
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
  /* /api/nodes — added v6.1.7, and the reason is this file's own history.
   * `:31` records that until v6.1.5 this gate called ctx.route() ZERO times,
   * so serve-dist's 501 fell through and every route was measured in a fully
   * degraded state. Four endpoints were mocked then; /api/nodes arrived after,
   * and inherited exactly the same hole — /live/network's CLS was being
   * measured with the node-population panel in its EMPTY state, which is the
   * one state whose height is a fixed reserve and therefore cannot shift.
   * The live path, where six rows of varying-width numbers land into that
   * reserve, was the thing at risk and the thing not covered.
   *
   * The body is NODES_LIVE — see its own comment above for why it is produced
   * by running the handler rather than rebuilt or transcribed. */
  await ctx.route('**/api/nodes*', async (route) => {
    await new Promise((r) => setTimeout(r, MOCK_LATENCY_MS));
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(NODES_LIVE) });
  });
  await mockStatus(ctx);
}

/** One load of `route`, returning its CLS. `mocked` selects the pass. */
async function measure(route, mocked) {
  const ctx = await browser.newContext({
    viewport: { width: PHONE.width, height: PHONE.height },
    deviceScaleFactor: PHONE.deviceScaleFactor,
  });
  // BEFORE app code: a shift during hydration is the shift that matters.
  await ctx.addInitScript(() => {
    window.__CLS__ = 0;
    // ATTRIBUTION, not just magnitude. Until v6.1.5 PR B this observer read
    // `value` and nothing else, so the only record of WHICH element moved was
    // prose in this file's header — written from ad-hoc instrumentation that was
    // never committed, and which PR B then disproved three ways. That is exactly
    // the defect PR A found at PERF-BASELINE.md:17 (a documented measurement
    // whose harness does not exist), committed by the PR that flagged it. The
    // fix is to make the diagnosis a gate output reproduced every run.
    window.__CLS_ENTRIES__ = [];
    const box = (r) => (r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null);
    // A selector-ish path, 4 levels deep. `source.node` is null for a node that
    // has since been removed, which is itself informative — say so rather than
    // dropping the source and under-reporting the entry.
    const ident = (n) => {
      if (!n) return '(node removed)';
      if (n.nodeType !== 1) return String(n.nodeName || 'node');
      const parts = [];
      let el = n;
      for (let d = 0; el && el.nodeType === 1 && d < 4; d++, el = el.parentElement) {
        let s = el.nodeName;
        if (el.id) s += '#' + el.id;
        else if (el.classList && el.classList.length) s += '.' + [...el.classList].slice(0, 3).join('.');
        parts.unshift(s);
      }
      return parts.join('>');
    };
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          // Shifts within 500ms of a real interaction are the user's doing.
          if (e.hadRecentInput) continue;
          window.__CLS__ += e.value;
          // PER-ENTRY, never aggregated. CLS is a SUM, so one reading of 0.35 is
          // equally consistent with a single ~294px shift and with ~98 repeats of
          // a 3px one — and those have opposite fixes. A reserve cures the first
          // and does nothing for the second, which is something relayouting over
          // and over. Only the entry list can tell them apart.
          window.__CLS_ENTRIES__.push({
            value: e.value,
            at: Math.round(e.startTime),
            sources: (e.sources || []).map((s) => ({
              node: ident(s.node),
              prev: box(s.previousRect),
              cur: box(s.currentRect),
            })),
          });
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch { /* feature-detected above; belt-and-braces */ }
  });
  if (mocked) await mockFeed(ctx);

  const page = await ctx.newPage();
  await throttle(ctx, page);

  // `load`, never networkidle — the banned idiom (verify-future.mjs:34-40).
  // The tiered feed polls forever, so networkidle would never settle anyway.
  await page.goto(base + route, { waitUntil: 'load' });
  // Let hydration and the first data tick land; shifts after this are not
  // "on load" by any reading.
  await page.waitForTimeout(3000);

  // v6.1.8 PRECONDITION. A CLS number measured through the cold-boot splash
  // describes the splash, not the route — and it would read LOW (a
  // full-bleed overlay does not shift), so it would pass while measuring
  // nothing. Only meaningful on Home; asserted only there.
  if (route === RT.HOME) await assertColdBootBypassed(page, R, `${route}${mocked ? ' healthy' : ' degraded'}`);

  const cls = await page.evaluate(() => window.__CLS__ ?? 0);
  const entries = await page.evaluate(() => window.__CLS_ENTRIES__ ?? []);
  /* Did the /api/nodes mock actually REACH the panel? Carried out of measure()
     so the pass loop can assert it. Without this the mock's reach is proven
     once, by hand, and its absence is undetectable: if the route glob ever
     stops matching — a path change, a query string, a rename — serve-dist's
     501 comes back, the panel renders its EMPTY state, and CLS reports the
     same 0.0000. Nothing in the output moves. That is not a vacuous assertion
     but an UNGUARDED PRECONDITION to a real one, and this file's own `:31`
     exists because a past version of exactly that went unnoticed. */
  const nodePanel = await page.evaluate(() => {
    const el = document.querySelector('[data-aux-key="nodes"]');
    if (!el) return null;
    const t = el.innerText || '';
    return { hasDigit: /\d/.test(t), saysDidNotAnswer: /did not answer/i.test(t) };
  });
  await ctx.close();
  return { cls: cls + INFLATE, entries, nodePanel };
}

const movedPx = (s) => (s.prev && s.cur
  ? Math.max(Math.abs(s.cur.y - s.prev.y), Math.abs(s.cur.x - s.prev.x))
  : 0);

/** One source as a line. BOTH axes are printed: the shift that motivated this
 *  instrumentation moves 314px horizontally and 3px vertically, and a y-only
 *  rendering makes it look like a 3px shift — which is how the previous
 *  diagnosis went wrong in the first place. */
function fmtSource(s) {
  if (!s.prev || !s.cur) return `${s.node}  (no rects)`;
  const dx = s.cur.x - s.prev.x;
  const dy = s.cur.y - s.prev.y;
  const sign = (n) => (n > 0 ? `+${n}` : String(n));
  return `${s.node}  Δx${sign(dx)} Δy${sign(dy)}  `
    + `${s.prev.w}x${s.prev.h}@(${s.prev.x},${s.prev.y}) → ${s.cur.w}x${s.cur.h}@(${s.cur.x},${s.cur.y})`;
}

/** The largest-moving source of one entry, as a one-line string. */
function topSource(entry) {
  const best = [...(entry.sources || [])].sort((a, b) => movedPx(b) - movedPx(a))[0];
  return best ? fmtSource(best) : 'no sources reported';
}

const PASSES = [
  { key: 'degraded', label: 'degraded (unmocked, 501 feed)', harness: HARNESS_DEGRADED, table: MEASURED, mocked: false },
  { key: 'healthy', label: 'healthy (mocked)', harness: HARNESS_HEALTHY, table: MEASURED_MOCKED, mocked: true },
];

const recorded = {};

if (INFLATE) {
  R.group('⚠️  NON-AUTHORITATIVE RUN');
  R.info(`CLS_INFLATE=${INFLATE} adds synthetic shift to every reading.`);
  R.info('These numbers are a break test, not a measurement. No baseline is emitted.');
}

for (const pass of PASSES) {
  R.group(`verify-cls · ${pass.label} — ${pass.harness} · ${RUNS} run(s)/route`);
  recorded[pass.key] = { harness: pass.harness, runs: RUNS, routes: {} };

  for (const route of ROUTES) {
    const results = [];
    for (let i = 0; i < RUNS; i++) results.push(await measure(route, pass.mocked));
    const values = results.map((r) => r.cls);
    const worst = Math.max(...values);
    const shown = values.map((v) => v.toFixed(4)).join(', ');
    const worstRun = results[values.indexOf(worst)];
    recorded[pass.key].routes[route] = { worst, runs: values, entries: worstRun.entries };

    // The measurement is printed EVERY run, pass or fail. This is the line that
    // makes drift visible long before it becomes a failure.
    R.info(`${route.padEnd(10)} CLS ${worst.toFixed(4)}  (runs: ${shown})  ceiling ${pass.table[route]}`);

    /* THE MOCK ACTUALLY REACHED THE PANEL — asserted, not assumed.
       Healthy pass and /live/network only: this is the one route whose CLS
       number is meaningless if /api/nodes fell through to serve-dist's 501,
       because the panel's EMPTY state has a fixed reserve and therefore cannot
       shift. Both states score 0.0000, so without this the precondition to a
       real assertion is itself unguarded and its failure is invisible. */
    if (pass.mocked && route === RT.LIVE_NETWORK) {
      const np = worstRun.nodePanel;
      R.ok(np !== null, 'healthy · /live/network · the node-population panel is present');
      R.ok(!!np && np.hasDigit && !np.saysDidNotAnswer,
        'healthy · /live/network · the /api/nodes mock REACHED the panel (live readout, not the empty state)',
        np ? `hasDigit=${np.hasDigit} saysDidNotAnswer=${np.saysDidNotAnswer} — a 501 fallthrough scores the same 0.0000, so this is what distinguishes them` : 'panel not found');
    }

    // Attribution for the worst run, per entry. Printed only when there is
    // something to explain, so a clean route stays one line. The entry COUNT is
    // load-bearing: many small entries and one large one need opposite fixes.
    const ents = worstRun.entries || [];
    if (worst > 0.005 && ents.length) {
      const top = [...ents].sort((a, b) => b.value - a.value).slice(0, 5);
      R.info(`  └─ ${ents.length} shift entr${ents.length === 1 ? 'y' : 'ies'} in the worst run; largest ${top.length}:`);
      for (const e of top) R.info(`     ${e.value.toFixed(4)} @${e.at}ms  ${topSource(e)}`);
      // Every source of the dominant entry. One entry routinely carries several
      // displaced nodes, and the largest mover is not always the one whose box
      // changed — the cause and the casualty are different elements.
      const worstEntry = top[0];
      if (worstEntry && (worstEntry.sources || []).length > 1) {
        R.info(`     all ${worstEntry.sources.length} sources of the dominant entry:`);
        for (const s of worstEntry.sources.slice(0, 6)) R.info(`       · ${fmtSource(s)}`);
      }
    }

    if (!MEASURE_ONLY) {
      R.ok(worst <= pass.table[route],
        `${pass.key} · ${route} · CLS ${worst.toFixed(4)} ≤ ${pass.table[route]}`,
        `measured ${shown} — if this is a real layout change, move the ceiling deliberately and say why`);
    }
  }
}

if (MEASURE_ONLY && !INFLATE) {
  mkdirSync(join(APP, '.perf'), { recursive: true });
  writeFileSync(join(APP, '.perf', 'cls.json'),
    JSON.stringify({ measuredAt: new Date().toISOString(), passes: recorded }, null, 2));
  R.info('');
  R.info('wrote .perf/cls.json (harness-stamped, both passes)');
}

await browser.close();
process.exit(MEASURE_ONLY ? 0 : R.finish());
