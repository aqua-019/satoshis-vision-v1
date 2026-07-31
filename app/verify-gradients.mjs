// verify-gradients.mjs — the duplicate-<defs>-id gate.
//
// SVG `id` uniqueness is a WHOLE-DOCUMENT constraint, not a per-<svg> one: a
// `url(#foo)` fill reference resolves against the first element in the
// document with that id, full stop — it does NOT prefer a same-<svg> sibling.
// So two chart instances that each independently mint "ml-grad-0" .. "ml-grad-3"
// look locally fine (each <svg>'s own <defs> has a matching node) but the
// SECOND instance's fills silently resolve to the FIRST instance's gradients.
//
// This is exactly the bug MultiLine had: a hardcoded `ml-grad-${i}` id, and
// /markets renders two MultiLine instances (the privacy-peer group + the
// top-10 group) side by side. Post-fix, MultiLine (and every other chart) mints
// its gradient id via chart-kit's `useGradientId`, which suffixes React's
// `useId()` — unique per component instance, so two instances never collide
// even when their internal per-series loop indices repeat.
//
// Two assertions per route:
//   1. Collect every <linearGradient id> in the DOM; assert no id repeats.
//      (Per-<svg> scoping would MISS this bug entirely — see header above —
//      so this check is deliberately document-wide.)
//   2. For every element whose `fill` is `url(#…)`, assert the referenced id
//      exists WITHIN THE SAME <svg> ancestor (not just somewhere in the
//      document) — guards the complementary failure mode of a fill pointing
//      at nothing local to its own chart.
//
// Pre-fix confirmation (see report): built commit daac4e8 (parent of
// 1f5a3d6 "fix MultiLine gradient collision") in an isolated git worktree,
// served it, and ran assertion (1) against its /markets — it FAILS exactly as
// predicted: ids ["ml-grad-0".."ml-grad-3"] repeat across the two MultiLine
// instances (11 total ids, 7 unique). The current tree already carries the fix
// (chart-kit's useGradientId), so this script is expected to PASS today; it
// exists to keep it that way.
//
// Run: npm run build && (npm run preview &) && sleep 2 && node verify-gradients.mjs
import { chromium, webkit } from 'playwright';
import { existsSync, readdirSync } from 'node:fs';

const base = 'http://localhost:4173';

function findChrome() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!existsSync(root)) return undefined;
  for (const d of readdirSync(root).filter((n) => n.startsWith('chromium-')).sort().reverse()) {
    const p = root + '/' + d + '/chrome-linux/chrome';
    if (existsSync(p)) return p;
  }
  return undefined;
}

let b, engine = 'chromium';
try {
  const executablePath = findChrome();
  b = await chromium.launch(executablePath ? { executablePath } : {});
} catch {
  engine = 'webkit';
  b = await webkit.launch();
}
console.log('engine:', engine);

let fail = false;
const ok = (cond, msg) => { console.log((cond ? '✅ ' : '❌ ') + msg); if (!cond) fail = true; };

/* ── fixtures (shapes mirror the real /api responses; see data/map.ts) ── */
const H0 = 3_700_500;
const nowSec = Math.floor(Date.now() / 1000);
const hex = (c) => c.repeat(64);

function mkBlocks(head) {
  // distinct difficulty/weight per block so any chart driven off `blocks`
  // (AreaSeries diffSeries, BarSeries fullness) has real variance too.
  return Array.from({ length: 14 }, (_, i) => ({
    height: head - i, hash: hex('e'), tx_count: 5 + i, block_weight: 9000 + i * 900,
    reward: 0.6e12, difficulty: 7.7e11 + i * 3e9, timestamp: nowSec - 60 - i * 130, pool_name: 'Unknown',
  }));
}

const baseNetwork = {
  difficulty: 7.7e11, hashrate_ghs: 6.42, tx_pool_size: 3, tx_count_total: 61_236_904,
  block_weight_limit: 600000, block_weight_median: 300000, target_seconds: 120,
  top_block_hash: hex('b'), alt_blocks_count: 1, version: '0.18.3.4', major_version: 16,
  fee_tiers: [20000, 80000, 320000, 4000000], randomx_seed_hash: hex('c'),
  database_size: 284_500_000_000, synchronized: true, nettype: 'mainnet', adjusted_time: nowSec,
};

const FIX = {
  network: { ...baseNetwork, height: H0 },
  info: { result: { height: H0, difficulty: 7.7e11, target: 120, major_version: 16, top_block_hash: hex('b') } },
  mempool: {
    recent_txs: Array.from({ length: 6 }, (_, i) => ({
      txid: hex(String(i)), blob_size: 1500 + i * 80, fee: 30_000_000 + i * 2_000_000,
      fee_rate: 18_000 + i * 3_000, receive_time: nowSec - 20 - i * 15, ring_size: 16,
      input_count: 1, output_count: 2,
    })),
    fee_histogram: Array.from({ length: 5 }, (_, i) => ({ tx_count: 2 + i, bytes: 3000 + i * 500 })),
  },
  blocks: mkBlocks(H0),
  price: { monero: { usd: 321.45, usd_24h_change: 1.23 }, bitcoin: { usd: 97_000, usd_24h_change: -0.4 } },
};

/** Deterministic synthetic OHLC candles, 12 bars, strictly distinct closes. */
function cgOhlc() {
  const t0 = Date.now() - 12 * 4 * 3600_000;
  return Array.from({ length: 12 }, (_, i) => {
    const o = 300 + i * 11, c = 303 + i * 11;
    return [t0 + i * 4 * 3600_000, o, o + 6, o - 5, c];
  });
}

/** Deterministic synthetic market_chart series, varied per coin id so distinct
 *  MultiLine series don't overlap and each has real amplitude to gradient-fill. */
function cgChart(id) {
  const seed = [...id].reduce((a, c) => a + c.charCodeAt(0), 0) % 11;
  const t0 = Date.now() - 12 * 4 * 3600_000;
  const prices = Array.from({ length: 12 }, (_, i) => [t0 + i * 4 * 3600_000, 40 + seed * 9 + i * 3]);
  return { prices, total_volumes: prices.map(([t]) => [t, 5000 + seed * 100]) };
}

function fulfil(route) {
  const url = route.request().url();
  const json = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  if (url.includes('/api/monero')) return json(FIX.info);
  if (url.includes('/api/xmr/network')) return json(FIX.network);
  if (url.includes('/api/xmr/mempool')) return json(FIX.mempool);
  if (url.includes('/api/xmr/blocks')) return json(FIX.blocks);
  if (url.includes('/api/xmr/tx/') || url.includes('/api/xmr/block/') || url.includes('/api/xmr/decoys/')) return route.abort();
  if (url.includes('/api/coingecko')) {
    const decoded = url.replace(/%2F/g, '/');
    if (decoded.includes('path=simple/price')) return json(FIX.price);
    if (decoded.includes('ohlc')) return json(cgOhlc());
    if (decoded.includes('market_chart')) {
      const m = /coins\/([a-z0-9-]+)\/market_chart/.exec(decoded);
      return json(cgChart(m ? m[1] : 'x'));
    }
    if (decoded.includes('tickers')) return json({ tickers: [] });
    return route.abort();
  }
  return route.abort();
}

/** In-page collector: doc-wide gradient-id dupes + per-<svg>-scoped fill-ref check. */
function collectGradientState() {
  const allIds = [...document.querySelectorAll('linearGradient[id]')].map((n) => n.id);
  const seen = new Set();
  const dupeIds = [];
  for (const id of allIds) {
    if (seen.has(id)) dupeIds.push(id);
    else seen.add(id);
  }

  const svgs = [...document.querySelectorAll('svg')];
  let fillRefsChecked = 0;
  const badFillRefs = [];
  for (const svg of svgs) {
    const fillEls = [...svg.querySelectorAll('[fill]')].filter((el) => /^url\(#/.test(el.getAttribute('fill') || ''));
    for (const el of fillEls) {
      const m = /^url\(#([^)]+)\)/.exec(el.getAttribute('fill'));
      if (!m) continue;
      fillRefsChecked++;
      const id = m[1];
      // CSS.escape isn't guaranteed on every id char set used (React useId can
      // emit ':'), so look up by attribute equality instead of #id selector.
      const found = [...svg.querySelectorAll('[id]')].some((n) => n.id === id);
      if (!found) badFillRefs.push(id);
    }
  }

  return {
    totalIds: allIds.length,
    uniqueIds: seen.size,
    dupeIds: [...new Set(dupeIds)],
    svgCount: svgs.length,
    fillRefsChecked,
    badFillRefs,
  };
}

async function run(pathname) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.route('**/api/**', fulfil);
  await p.goto(base + pathname, { waitUntil: 'load' });
  await p.waitForTimeout(2200); // let mocked fetches land and charts paint
  const r = await p.evaluate(collectGradientState);

  if (r.totalIds === 0) {
    console.log(`ℹ️  ${pathname}: no <linearGradient> elements found (${r.svgCount} <svg> on page) — nothing to gate here yet`);
  }
  ok(r.dupeIds.length === 0,
    `${pathname}: no duplicate <linearGradient id> across the document (${r.totalIds} total, ${r.uniqueIds} unique)`);
  if (r.dupeIds.length) console.log('   dupes:', r.dupeIds.join(', '));
  ok(r.badFillRefs.length === 0,
    `${pathname}: every fill="url(#…)" resolves within its own <svg> (checked ${r.fillRefsChecked} fill refs across ${r.svgCount} svgs)`);
  if (r.badFillRefs.length) console.log('   unresolved refs:', JSON.stringify(r.badFillRefs));

  await p.close();
}

for (const pathname of ['/', '/markets', '/network', '/mempool']) {
  await run(pathname);
}

await b.close();
console.log(fail ? '\n❌ verify-gradients FAILED' : '\n✅ verify-gradients: all scenarios passed');
process.exit(fail ? 1 : 0);
