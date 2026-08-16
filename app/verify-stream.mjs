/**
 * verify-stream.mjs — the D0828 streaming panel's RENDER ECONOMICS, and the
 * D0837 small-multiples SHARED GRAMMAR.
 *
 * Run: npm run build && (node scripts/serve-dist.mjs &) && npm run wait-preview
 *      && node verify-stream.mjs
 *
 * ── WHY THE CRITERION IS NOT "APPENDS WITHOUT A RE-RENDER" ────────────────
 *
 * That was the original wording and it is FALSE BY DESIGN: a block arriving is
 * new information and the panel must show it. Measured against the pre-fix
 * build it read 33 → 219 renders over 26 s (~2 per fast tick), which is a real
 * defect, but "zero renders" would have been a defect too — a panel that never
 * re-renders never shows a new block.
 *
 * The claim that is both true and worth gating is about WHICH commits it is
 * sensitive to:
 *
 *   the render count tracks the chain tier's own FULL PULLS one-to-one, and
 *   is insensitive to the 3 s fast tier and the 60 s market tier, which this
 *   panel does not read.
 *
 * ── WHY EACH HALF NEEDS THE OTHER ────────────────────────────────────────
 *
 * "0 renders on fast ticks" passes trivially in two ways that have nothing to
 * do with memoisation: if the panel never rendered at all, and if the fast
 * tier never ticked during the measured window. A render counter reading 0
 * because nothing happened is the same green as one reading 0 because the
 * memo works, and only the second is the claim. So every insensitivity
 * assertion here is PAIRED with a positive control that the thing it is
 * insensitive to actually happened n times, and with a control that the panel
 * does render when it should. §1's controls are §1's whole credibility.
 *
 * The same trap one level down: the fast tier is only observable if something
 * is COUNTING it, so the mock counts requests per endpoint rather than
 * trusting the tier constants. A tier that silently stopped firing would
 * otherwise make this gate green.
 *
 * ── THE TIP IS DRIVEN, NOT WATCHED ───────────────────────────────────────
 *
 * The chain tier is a tip watch: it fetches /api/xmr/tip every tick and pulls
 * /network + /blocks ONLY when the height moved (xmrirish-feed.ts). So a full
 * pull is not a function of elapsed time and cannot be waited out — it is
 * caused. `pendingAdvances` lets a phase request exactly K of them, which is
 * what makes "one render per full pull" a countable claim rather than an
 * approximate one. Phase A holds the tip STILL, which is the only way to get
 * a window with fast ticks and provably zero full pulls.
 */
import { makeReporter, launchChromium, BASE } from './verify-lib.mjs';

const base = process.env.VERIFY_BASE || BASE;
const R = makeReporter('verify-stream');

/* Compressed tiers, the documented override. Market is compressed hard so it
   ticks inside a measurable window at all — at its real 60 s it never would,
   and "insensitive to the market tier" would be unfalsifiable here. */
const TEST_TIERS = { fast: 300, chain: 400, market: 800 };

const H = 3_500_000;
const NOW = Math.floor(Date.now() / 1000);

const FIXTURES = {
  network: {
    height: H, difficulty: 400e9, hashrate_ghs: 3.3, target_seconds: 120,
    top_block_hash: 'a'.repeat(64), major_version: 16, version: '0.18.3.4',
    fee_tiers: [20000, 80000, 320000, 4000000], tx_count_total: 41_000_000,
    alt_blocks_count: 2, randomx_seed_hash: 'b'.repeat(64),
    block_weight_limit: 600000, block_weight_median: 300000,
    database_size: 200e9, synchronized: true, nettype: 'mainnet', adjusted_time: NOW,
  },
  blocks: Array.from({ length: 40 }, (_, i) => ({
    height: H - i, hash: (i % 10).toString().repeat(64).slice(0, 64),
    timestamp: NOW - i * 120, reward: 6e11, difficulty: 400e9,
    block_weight: 300000 + i * 100, tx_count: 20 + i, pool_name: 'Unknown',
  })),
  mempool: {
    recent_txs: Array.from({ length: 30 }, (_, i) => ({
      txid: (i % 10).toString().repeat(64).slice(0, 64), blob_size: 1500 + i * 10,
      fee: 3e7 + i, fee_rate: 20000 + i * 100, receive_time: NOW - i * 5,
      ring_size: 16, input_count: 2, output_count: 2,
    })),
    fee_histogram: Array.from({ length: 8 }, (_, i) => ({ tx_count: 4 + i, bytes: 6000 })),
  },
  fees: { tiers: [20000, 80000, 320000, 4000000] },
  'network/difficulty': {
    ok: true, requested: '1d', range: '1d', blocks: 720, returned: 200,
    step: 1, tip: H, target_seconds: 120, window_seconds: 720 * 120,
    points: Array.from({ length: 200 }, (_, i) => ({
      height: H - 199 + i, timestamp: NOW - (199 - i) * 120,
      difficulty: 400e9 + (i % 17) * 1e9,
    })),
  },
};

const hits = { fast: 0, tip: 0, fullPull: 0, market: 0, seed: 0 };
const resetHits = () => { for (const k of Object.keys(hits)) hits[k] = 0; };

let tipHeight = H - 1;
let pendingAdvances = 0;

async function mock(ctx) {
  await ctx.route('**/api/xmr/**', (route) => {
    const u = new URL(route.request().url());
    const sub = (u.searchParams.get('_p') || u.pathname.replace(/^\/api\/xmr\/?/, '')).split('?')[0];
    const key = sub.startsWith('blocks') ? 'blocks'
      : sub.startsWith('mempool') ? 'mempool'
      : sub.startsWith('fees') ? 'fees'
      : sub.startsWith('tip') ? 'tip'
      : sub.startsWith('network/difficulty') ? 'network/difficulty'
      : sub.startsWith('network') ? 'network' : null;
    if (!key) return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });

    if (key === 'tip') {
      hits.tip++;
      if (pendingAdvances > 0) { tipHeight++; pendingAdvances--; }
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ height: tipHeight }) });
    }
    /* `blocks` is pulled ONLY on a tip move, so it is the observable event
       that IS a chain full pull. Counting the chain TICK instead would count
       tip polls, which the panel is also supposed to be insensitive to. */
    if (key === 'blocks') hits.fullPull++;
    if (key === 'mempool' || key === 'fees') hits.fast++;
    if (key === 'network/difficulty') hits.seed++;
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(FIXTURES[key]) });
  });
  /* The MARKET tier calls /api/coingecko, NOT /api/markets — measured, after
     an earlier draft of this gate routed /api/markets, counted 0 ticks and
     reported the tier as dead. `/api/markets` is the aggregator the markets
     PAGE uses; xmrirish-feed.ts:297 is the one the tier drives. Fulfilled
     rather than aborted, because an aborted tick still ticks but leaves the
     feed in an error state that changes what the page renders. */
  /* A REGEXP, not a glob. The tier's URL is
     `/api/coingecko?path=simple/price&ids=…` and Playwright's `*` does not
     cross a `/` — the `simple/price` inside the QUERY defeats
     a double-star glob ending `/api/coingecko` plus a star, which matched
     nothing and reported the tier as dead. (Written out in words on purpose:
     that glob contains the two characters that CLOSE a block comment, and
     pasting it here literally is what broke this file's syntax once already.)
     An unmatched route is an unobserved one, and the control that depends on
     it then reds for a reason unrelated to its claim. */
  await ctx.route(/\/api\/coingecko/, (route) => {
    hits.market++;
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ monero: { usd: 150, usd_market_cap: 2.7e9, usd_24h_vol: 8e7, usd_24h_change: 1.2 } }) });
  });
  await ctx.route('**/api/feeds*', (r) => r.abort());
}

const renders = (page) => page.evaluate(() => {
  const h = document.querySelector('[data-stream-renders]');
  return h ? Number(h.getAttribute('data-stream-renders')) : null;
});

const { browser } = await launchChromium();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
await ctx.addInitScript((t) => { window.__XMR_TIER_MS__ = t; }, TEST_TIERS);
await mock(ctx);
const page = await ctx.newPage();
await page.goto(base + '/live/network', { waitUntil: 'load' });
await page.waitForFunction((h) => document.body.innerText.includes(h),
  H.toLocaleString('en-US'), { timeout: 15000 }).catch(() => {});

/* Let the seed land before measuring, and prove it did rather than assume —
   an unseeded panel has a different render profile and would make every
   number below describe the wrong component. */
const seeded = await page.waitForFunction(
  () => {
    const h = document.querySelector('[data-stream-renders]');
    return h ? Number(h.getAttribute('data-stream-points')) > 40 : false;
  }, null, { timeout: 30000 },
).then(() => true).catch(() => false);

/* ── 1 · render economics ─────────────────────────────────────────────── */
R.group('1 · the render count follows chain full pulls, and nothing else');

R.ok(seeded, 'the seed merged before measuring — an unseeded panel is a different component and every count below would describe it instead');

const r0 = await renders(page);
R.ok(typeof r0 === 'number' && r0 > 0,
  `the panel has rendered at all before the measurement window (${r0}) — a counter stuck at 0 would satisfy every insensitivity claim below for the wrong reason`);

/* -- PHASE A: tip HELD STILL. Fast and market tick; no full pull happens. -- */
resetHits();
pendingAdvances = 0;
const aStart = await renders(page);
await page.waitForTimeout(8000);
const aEnd = await renders(page);
const aDelta = aEnd - aStart;

R.ok(hits.fast >= 10,
  `A: the fast tier really did tick during the window (${hits.fast} requests) — this is the control that stops "0 renders" passing because nothing happened`);
R.ok(hits.market >= 3,
  `A: the market tier really did tick too (${hits.market} requests)`);
R.ok(hits.tip >= 5,
  `A: the chain tier polled the tip (${hits.tip}) while the height stayed put`);
R.ok(hits.fullPull === 0,
  `A: and NO full pull occurred (${hits.fullPull}) — the tip never moved, so any render in this window is one the panel should not have done`);
R.ok(aDelta === 0,
  `A: THE CLAIM — the panel re-rendered ${aDelta} time(s) across ${hits.fast} fast ticks and ${hits.market} market ticks with zero full pulls`);

/* -- PHASE B: cause exactly K full pulls. -- */
const K = 3;
resetHits();
const bStart = await renders(page);
pendingAdvances = K;
await page.waitForFunction((k) => true, K, { timeout: 100 }).catch(() => {});
await page.waitForTimeout(9000);
const bEnd = await renders(page);
const bDelta = bEnd - bStart;

R.ok(hits.fullPull === K,
  `B: exactly ${K} chain full pull(s) were caused (${hits.fullPull}) — the count the claim below is measured against`);
R.ok(hits.fast >= 10,
  `B: the fast tier kept ticking through this window too (${hits.fast})`);
R.ok(bDelta === K,
  `B: THE CLAIM — the panel re-rendered ${bDelta} time(s) for ${hits.fullPull} full pull(s): one-to-one, and the ${hits.fast} fast ticks alongside added none`);

/* ── 2 · the small multiples share a grammar, not a scale ─────────────── */
R.group('2 · tiles share height, padding and band rendering — never a scale');

const tiles = await page.evaluate(() => {
  const grid = document.querySelector('[data-small-multiples]');
  if (!grid) return null;
  return {
    declared: Number(grid.getAttribute('data-small-multiples')),
    tiles: [...grid.querySelectorAll('[data-tile]')].map((el) => {
      const svg = el.querySelector('svg');
      const box = el.querySelector('.chart-box');
      return {
        id: el.getAttribute('data-tile'),
        svgH: svg?.getAttribute('height') ?? null,
        viewBox: svg?.getAttribute('viewBox') ?? null,
        boxH: box ? Math.round(box.getBoundingClientRect().height) : null,
        /* The band is drawn as one translucent rect plus its two edge rules,
           all at fixed opacities. Counting the SHAPE rather than reading a
           colour keeps this independent of the palette. */
        bandRects: svg ? svg.querySelectorAll('rect[fill-opacity="0.07"]').length : 0,
        bandLines: svg ? svg.querySelectorAll('line[stroke-opacity="0.28"]').length : 0,
      };
    }),
  };
});

if (!tiles) {
  R.ok(false, '2: the small-multiples grid is present');
} else {
  const t = tiles.tiles;
  R.ok(t.length >= 6 && t.length === tiles.declared,
    `2: the grid renders every tile it declares (${t.length} of ${tiles.declared})`);

  const heights = [...new Set(t.map((x) => x.svgH))];
  R.ok(heights.length === 1,
    `2: every tile shares ONE svg height (${heights.join(' / ')}) — the shared half of the rule`,
    t.map((x) => `${x.id}=${x.svgH}`).join(' · '));

  const boxes = [...new Set(t.map((x) => x.boxH))];
  R.ok(boxes.length === 1,
    `2: every tile's rendered box is the same height (${boxes.join(' / ')}px) — the authored height actually survives layout`,
    t.map((x) => `${x.id}=${x.boxH}`).join(' · '));

  const vbs = [...new Set(t.map((x) => x.viewBox))];
  R.ok(vbs.length === 1,
    `2: every tile shares ONE viewBox (${vbs.join(' / ')}) — so the padding fraction resolves to the same user units in each`,
    t.map((x) => `${x.id}=${x.viewBox}`).join(' · '));

  /* Both polarities must be PRESENT in the subject, or "every banded tile
     renders the same band" is a statement about the empty set — and a page
     where nothing bands would satisfy it. */
  const banded = t.filter((x) => x.bandRects > 0);
  const bandless = t.filter((x) => x.bandRects === 0);
  R.ok(banded.length > 0 && bandless.length > 0,
    `2: the grid contains BOTH banded (${banded.length}) and band-less (${bandless.length}) tiles — otherwise the band assertion below judges an empty set`);
  R.ok(banded.every((x) => x.bandRects === 1 && x.bandLines === 2),
    `2: every banded tile draws the SAME band shape — one fill plus two edge rules (${banded.map((x) => `${x.id}:${x.bandRects}r/${x.bandLines}l`).join(' · ')})`);
  R.ok(bandless.every((x) => x.bandLines === 0),
    '2: a band-less tile draws no band edges either — no half-rendered band');
}

await browser.close();
process.exit(R.finish());
