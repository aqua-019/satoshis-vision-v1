/* verify-resilience-dom.mjs — the resilience UI, in a real browser.
   Run: node scripts/serve-dist.mjs & npm run wait-preview && node verify-resilience-dom.mjs

   Static twin: verify-resilience.mjs. Source-level invariants live there so
   verify:static can run without a server; anything needing layout lives here.

   ── THIS GATE MOCKS DELIBERATELY, AND THAT IS THE POINT ───────────────────
   Ten of the twenty-two gates in verify:e2e call ctx.route() ZERO times:
   nojs, contrast, roles, ground, motion, nav, discrete, govern, reduce, cls.
   Because scripts/serve-dist.mjs answers /api/xmr/* with HTTP 200 text/html
   (its SPA fallback, not a 404), res.json() throws, failures accumulate, and
   every one of those ten is measuring a TOTALLY DEGRADED FEED without saying
   so. Their assertions are still valid — they are about layout, colour and
   motion, which do not depend on data — but a "skeleton -> content" assertion
   written that way would be asserting something the harness cannot produce:
   content never arrives, so the skeleton never resolves.

   So this gate serves real payloads on purpose. If you add an assertion here,
   check whether it needs `mockLive` (content arrives) or `mock({dead:[…]})`
   (a named endpoint fails). Do not inherit the accident.

   ── WHAT IT CANNOT PROVE, STATED RATHER THAN SKIPPED ───────────────────────
   Nothing here contacts a real Monero node or CoinGecko; the sandbox has no
   egress. Everything below is a claim about the UI's response to a payload, not
   about the upstream. Node reachability is api/verify-status.mjs's business and
   it counts those as fixtured, never as passes. */

import { launchChromium, BASE, mockStatus } from './verify-lib.mjs';
import { makeReporter } from './verify-reporter.mjs';
import { readFileSync } from 'node:fs';

const R = makeReporter('verify-resilience-dom');

/* SUSPENDED_RE lifted from source with a self-check that THROWS — a botched
   extraction would make §G pass vacuously. Idiom copied from verify-motion. */
const SUSPENDED_RE = (() => {
  const src = readFileSync(new URL('./src/entry-ssr.tsx', import.meta.url), 'utf8');
  const m = src.match(/export const SUSPENDED_RE\s*=\s*\/(.+)\/([a-z]*);/);
  if (!m) throw new Error('verify-resilience-dom: could not extract SUSPENDED_RE');
  const re = new RegExp(m[1], m[2]);
  if (!re.test('loading simulators…') || re.test('COINGECKO · loading')) {
    throw new Error('verify-resilience-dom: extracted SUSPENDED_RE misbehaves');
  }
  return re;
})();

/* Compressed tiers so a chain-tier assertion does not wait a real 15s. */
const TEST_TIERS = { fast: 300, chain: 400, market: 2000 };

let TIP = 3_400_000;
const blocks = () =>
  Array.from({ length: 12 }, (_, i) => ({
    height: TIP - i, timestamp: Math.floor(Date.now() / 1000) - i * 120,
    size: 1200 + i * 7, num_txes: 2 + (i % 4), reward: 600000000000,
    hash: 'a'.repeat(64), miner_tx_hash: 'b'.repeat(64),
  }));
const FIX = {
  tip: () => ({ height: TIP }),
  network: () => ({
    height: TIP + 1, difficulty: 380000000000, hashrate: 3166666666,
    target: 120, tx_count: 24000000, alt_blocks_count: 0, nettype: 'mainnet',
    version: '0.18.3.4', block_weight_limit: 600000, block_weight_median: 300000,
    database_size: 210000000000, synchronized: true, top_block_hash: 'c'.repeat(64),
    adjusted_time: Math.floor(Date.now() / 1000),
  }),
  blocks: () => ({ blocks: blocks() }),
  mempool: () => ({ txs: Array.from({ length: 9 }, (_, i) => ({
    id_hash: String(i).repeat(64).slice(0, 64), blob_size: 1500 + i * 30,
    weight: 1500 + i * 30, fee: 30000000 + i * 1000, receive_time: Math.floor(Date.now() / 1000) - i * 8,
  })) }),
  fees: () => ({ fee: 20000, fees: [20000, 80000, 320000, 4000000], quantization_mask: 10000 }),
  /* The §1 history envelope. Shape taken from api/xmr.js's buildHistoryEnvelope,
     not invented — window_seconds === blocks × target_seconds is the server's
     own identity (720 × 120 = 86,400), so a fixture that drifts from the
     handler fails api/verify-history.mjs's D4 rather than passing quietly. */
  'network/difficulty': () => ({
    ok: true, requested: '1d', range: '1d', blocks: 720, returned: 30, step: 24,
    tip: TIP, target_seconds: 120, window_seconds: 720 * 120,
    points: Array.from({ length: 30 }, (_, i) => ({
      height: TIP - 29 + i,
      timestamp: Math.floor(Date.now() / 1000) - (29 - i) * 2880,
      difficulty: 400e9 + (i % 7) * 1e9,
    })),
  }),
};

/** Serve the chain endpoints. Keys in `dead` return 500 while siblings answer —
 *  a 500 rather than an abort, so the client sees a REPLY it must reject. */
async function mock(ctx, { dead = [], slowMs = 0 } = {}) {
  await ctx.route('**/api/xmr/**', async (route) => {
    /* `slowMs` matters more than it looks. usePendingDelay suppresses the
       refreshing chip until a request has been in flight for 100ms — that is
       the whole point of the hook, and with instant fixtures `busy` lasts about
       a millisecond, so the chip correctly never appears and an assertion
       looking for it would be asserting against the flicker guard rather than
       against the feature. Section F therefore serves a genuinely slow
       response. Getting this wrong is how a gate ends up "fixing" real code. */
    if (slowMs) await new Promise((r) => setTimeout(r, slowMs));
    const u = new URL(route.request().url());
    const p = u.searchParams.get('_p') || u.pathname.replace(/^.*\/api\/xmr\/?/, '');
    /* `network/difficulty` BEFORE the bare `network`, and the order is the
       whole point: `p.includes('network')` matches the history sub-path too,
       so the D0828 seed was answered with the get_info-shaped `network`
       fixture, never received points, and correctly rendered its
       "has not returned history" copy — in the HEALTHY render as well as the
       failed one. §G then read that as failure copy leaking into the healthy
       state. The panel was right; the mock was serving the wrong body.
       This is the same substring shape as `verify-failure`'s router and
       `verify-tiers-dom`'s classifier, both fixed earlier in this PR. */
    const key = ['blocks', 'mempool', 'fees', 'tip', 'network/difficulty', 'network']
      .find((k) => p.includes(k));
    if (!key) return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    if (dead.includes(key)) {
      return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"upstream"}' });
    }
    if (key === 'tip') TIP += 1;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FIX[key]()) });
  });
  await ctx.route('**/api/coingecko*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ monero: { usd: 164.2, usd_24h_change: 1.4 }, bitcoin: { usd: 61000, usd_24h_change: -0.3 } }) }));
  await ctx.route('**/api/markets*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ groups: {}, excluded: [], meta: null }) }));
  await ctx.route('**/api/feeds*', (route) => route.abort());
  await mockStatus(ctx);
}

async function newCtx(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  await ctx.addInitScript((t) => { window.__XMR_TIER_MS__ = t; }, TEST_TIERS);
  return ctx;
}

const { browser } = await launchChromium();

/* ── A · skeletons reserve their box, and the CONTENT IS ALREADY MOUNTED ──── */
R.group('A · structure-aware skeletons');
{
  const ctx = await newCtx(browser);
  await mock(ctx);
  const page = await ctx.newPage();

  // Read at t=0, before data lands, on every surface that carries a Swap.
  await page.goto(BASE + '/live/network', { waitUntil: 'commit' });
  const early = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('.sk-swap')) {
      out.push({
        ready: el.getAttribute('data-ready'),
        h: Math.round(el.getBoundingClientRect().height),
        // THE STRUCTURAL CLAIM, per the operator's condition: a measured delta
        // of <=2px can pass because nothing ever arrived. This cannot.
        bodyPresent: !!el.querySelector('.sk-body'),
        veilPresent: !!el.querySelector('.sk-veil'),
      });
    }
    return out;
  }).catch(() => []);

  if (early.length === 0) {
    R.skip('A: /network mounts .sk-swap wrappers', 'no .sk-swap found at commit — surface may not have adopted Swap');
  } else {
    R.ok(early.every((e) => e.bodyPresent),
      `A: every skeleton mounts its CONTENT at t=0, not just a placeholder (${early.length} wrappers)`,
      'a Swap that replaced children would strand useChartMetrics with a null ref forever');
    R.ok(early.every((e) => e.h > 0),
      'A: every skeleton reserves a non-zero box before data arrives');
  }

  await page.waitForTimeout(2500);
  const late = await page.evaluate(() => [...document.querySelectorAll('.sk-swap')].map((el) => ({
    ready: el.getAttribute('data-ready'),
    h: Math.round(el.getBoundingClientRect().height),
  })));
  if (early.length && early.length === late.length) {
    const deltas = early.map((e, i) => Math.abs(e.h - late[i].h));
    const worst = Math.max(...deltas);
    R.info(`A: worst reserved-box delta across the swap = ${worst}px`);
    R.ok(worst <= 2, `A: the swap moves nothing (worst delta ${worst}px <= 2px)`);
    R.ok(late.some((l) => l.ready === 'true'),
      'A: content actually ARRIVED under the mock — otherwise the delta above proves nothing');
  }
  await ctx.close();
}

/* ── B · the crossfade, and its reduced-motion path ───────────────────────── */
R.group('B · crossfade + reduce');
{
  const ctx = await newCtx(browser);
  await mock(ctx);
  const page = await ctx.newPage();
  await page.goto(BASE + '/live/network', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const motion = await page.evaluate(() => {
    const el = document.querySelector('.sk-swap > .sk-body');
    if (!el) return null;
    return getComputedStyle(el).transitionDuration;
  });
  if (motion === null) R.skip('B: crossfade duration', 'no .sk-body present');
  else R.ok(motion !== '0s', `B: with motion allowed the crossfade has a real duration (${motion})`);
  await ctx.close();

  const rctx = await newCtx(browser, { reducedMotion: 'reduce' });
  await mock(rctx);
  const rp = await rctx.newPage();
  await rp.goto(BASE + '/live/network', { waitUntil: 'load' });
  await rp.waitForTimeout(1200);
  const reduced = await rp.evaluate(() => {
    const el = document.querySelector('.sk-swap > .sk-body');
    const running = document.getAnimations()
      .filter((a) => a.playState === 'running')
      .map((a) => a.animationName || (a.effect && a.effect.getKeyframes && 'css'))
      .filter(Boolean);
    return { dur: el ? getComputedStyle(el).transitionDuration : null, shimmer: running.filter((n) => String(n).includes('sk-shimmer')).length };
  });
  if (reduced.dur === null) R.skip('B: reduced-motion crossfade', 'no .sk-body present');
  else R.ok(reduced.dur === '0s', `B: under reduce the crossfade is a HARD CUT (${reduced.dur}) — arrival still visible, nothing animates`);
  R.ok(reduced.shimmer === 0, `B: no sk-shimmer animation runs under reduce (${reduced.shimmer} running)`);
  await rctx.close();
}

/* ── C · a thrown panel does not take the route ───────────────────────────── */
R.group('C · PanelBoundary containment');
{
  const ctx = await newCtx(browser);
  await mock(ctx);
  await ctx.addInitScript(() => { window.__XMR_PANEL_THROW__ = ['blocks']; });
  const page = await ctx.newPage();
  await page.goto(BASE + '/live/network', { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  const seen = await page.evaluate(() => {
    const alerts = [...document.querySelectorAll('[role="alert"]')].map((n) => n.textContent || '');
    return {
      mainAlive: !!document.querySelector('main#main'),
      panels: document.querySelectorAll('.panel').length,
      alerts,
      retryButtons: [...document.querySelectorAll('[role="alert"] button')].map((b) => b.textContent || ''),
      bodyLen: (document.body.innerText || '').length,
    };
  });

  R.ok(seen.mainAlive, 'C: <main> survived a throw inside one panel — the route did not blank');
  R.ok(seen.panels > 3, `C: sibling panels still rendered (${seen.panels} panels present)`);
  R.ok(seen.alerts.length > 0, `C: the failing panel rendered a boundary fallback (${seen.alerts.length})`);
  R.ok(seen.alerts.some((t) => t.includes('/api/xmr/blocks')),
    'C: the fallback NAMES the endpoint it failed on, from FEED_ENDPOINT');
  R.ok(seen.retryButtons.length > 0 && seen.retryButtons.some((t) => /retry/i.test(t)),
    'C: the fallback offers an inline retry control');
  R.ok(seen.retryButtons.some((t) => t.includes('/api/xmr/blocks')),
    'C: the retry control names the endpoint it will retry');
  R.ok(seen.bodyLen > 400, 'C: the page still has substantial content, not a stub');
  await ctx.close();
}

/* ── D · offline outranks everything ──────────────────────────────────────── */
R.group('D · offline precedence');
{
  const ctx = await newCtx(browser);
  await mock(ctx, { dead: ['mempool', 'fees', 'network', 'blocks'] });
  const page = await ctx.newPage();
  await page.goto(BASE + '/live/network', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await ctx.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await page.waitForTimeout(400);

  const off = await page.evaluate(() => {
    const b = document.querySelector('.degraded-banner');
    return { present: !!b, kind: b && b.getAttribute('data-kind'), text: b ? b.textContent || '' : '' };
  });
  R.ok(off.present, 'D: a banner is shown when the browser goes offline');
  R.ok(off.kind === 'offline',
    `D: offline OUTRANKS a simultaneously-degraded feed (data-kind=${off.kind}) — blaming the node operators for a dropped wifi is a false accusation`);
  R.ok(!/DEGRADED/.test(off.text), 'D: the degraded wording is suppressed entirely while offline');

  await ctx.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForTimeout(400);
  const back = await page.evaluate(() => {
    const b = document.querySelector('.degraded-banner');
    return b ? b.getAttribute('data-kind') : null;
  });
  R.ok(back !== 'offline', `D: coming back online clears the offline banner (now ${back})`);
  await ctx.close();
}

/* ── E · the banner obeys the pair-AND, not a worst-of ────────────────────── */
R.group('E · feedDegraded is a pair-AND global');
{
  const one = await newCtx(browser);
  await mock(one, { dead: ['mempool'] });
  const p1 = await one.newPage();
  await p1.goto(BASE + '/live/network', { waitUntil: 'load' });
  await p1.waitForTimeout(2000);
  const single = await p1.evaluate(() => !!document.querySelector('.degraded-banner'));
  R.ok(!single,
    'E: ONE failing endpoint does NOT raise the global banner — that is the pair-AND, and blurring it would undo PR C');
  await one.close();

  const two = await newCtx(browser);
  await mock(two, { dead: ['mempool', 'fees'] });
  const p2 = await two.newPage();
  await p2.goto(BASE + '/live/network', { waitUntil: 'load' });
  await p2.waitForTimeout(2500);
  const pair = await p2.evaluate(() => {
    const b = document.querySelector('.degraded-banner');
    return { present: !!b, text: b ? b.textContent || '' : '' };
  });
  R.ok(pair.present, 'E: BOTH members of a pair failing DOES raise the banner');
  R.ok(/\/api\/xmr\/(mempool|fees)/.test(pair.text),
    'E: the banner names the endpoints that are actually failing, not "the feed"');
  await two.close();
}

/* ── F · last-good stays on screen, and waiting is distinguishable ────────── */
R.group('F · stale-while-revalidate has a vocabulary');
{
  const ctx = await newCtx(browser);
  await mock(ctx, { slowMs: 700 });
  const page = await ctx.newPage();
  await page.goto(BASE + '/live/network', { waitUntil: 'load' });
  await page.waitForTimeout(3000);

  const before = await page.evaluate(() => {
    const s = document.querySelector('[data-panel-key] .val, .stat .val');
    return s ? (s.textContent || '').trim() : '';
  });
  R.ok(before.length > 0 && before !== '—', `F: a real value is on screen before the refresh (${before})`);

  const sawRefreshing = await page.evaluate(async () => {
    for (let i = 0; i < 60; i++) {
      if (document.querySelector('[data-refreshing="true"]')) return true;
      await new Promise((r) => setTimeout(r, 100));
    }
    return false;
  });
  R.ok(sawRefreshing, 'F: a panel reports data-refreshing while a round is on the wire');

  const after = await page.evaluate(() => {
    const s = document.querySelector('[data-panel-key] .val, .stat .val');
    return s ? (s.textContent || '').trim() : '';
  });
  R.ok(after.length > 0 && after !== '—',
    'F: last-good stayed on screen THROUGH the refresh — it never blanked to a skeleton');

  // Hidden tab: nothing in flight AND nothing scheduled. Previously unrepresentable.
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(1200);
  const quiet = await page.evaluate(() => !document.querySelector('[data-refreshing="true"]'));
  R.ok(quiet, 'F: a hidden tab reports nothing in flight — it does not claim to be reconnecting while it is not');
  await ctx.close();
}

/* ── G · three situations, three sentences, and none trips the build ──────── */
R.group('G · empty / zero-result / failure copy is distinct');
{
  const grab = async (opts) => {
    const ctx = await newCtx(browser);
    await mock(ctx, opts);
    const page = await ctx.newPage();
    await page.goto(BASE + '/live/network', { waitUntil: 'load' });
    await page.waitForTimeout(2500);
    const txt = await page.evaluate(() => document.body.innerText || '');
    await ctx.close();
    return txt;
  };

  const healthy = await grab({});
  const failed = await grab({ dead: ['blocks', 'network', 'mempool', 'fees'] });

  R.ok(!SUSPENDED_RE.test(healthy), 'G: no rendered copy on a healthy /network matches SUSPENDED_RE');
  R.ok(!SUSPENDED_RE.test(failed), 'G: no rendered copy on a FAILED /network matches SUSPENDED_RE');

  const failureSentences = failed.split('\n').filter((l) => /\/api\/xmr\//.test(l) && l.trim().length > 12);
  R.ok(failureSentences.length > 0,
    `G: the failed state names endpoints in its copy (${failureSentences.length} line(s))`);
  R.ok(!failureSentences.some((l) => healthy.includes(l.trim())),
    'G: no failure sentence also appears in the healthy render — failure copy and empty copy are genuinely different strings');
}

await browser.close();
process.exit(R.finish());
