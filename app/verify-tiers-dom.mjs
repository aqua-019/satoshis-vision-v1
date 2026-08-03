// verify-tiers-dom.mjs — DOM gate for v6.0.6 "TIERED POLLING".
//
// Drives the BUILT app (vite preview @ :4173) with the network mocked at the
// page level and every /api request counted, proving the four behaviours the
// tiering exists for:
//
//   A. cadence      — the fast endpoints poll ~5× more often than the chain
//      endpoints, and NO endpoint polls faster than its own tier. Pre-v6.0.6 a
//      single 2.5s interval hit all five endpoints at the same rate.
//   B. tip watch    — while the chain tip is STILL, /api/xmr/network and
//      /api/xmr/blocks are not re-fetched on every chain tick; when the tip
//      MOVES they are re-fetched immediately.
//   C. visibility   — hiding the tab stops polling entirely; revealing it
//      resumes with an immediate catch-up tick.
//   D. degrade      — with every route dead, last-good values stay on screen
//      behind a STALE indicator (no blanking, no invented numbers).
//
// Cadence is asserted as a RATIO, not wall-clock counts, so the gate isn't
// flaky under CI load. Tiers are compressed via the documented
// window.__XMR_TIER_MS__ override so the run takes seconds, not minutes.
//
// Run: npm run build && (node scripts/serve-dist.mjs &) && npm run wait-preview \
//      && node verify-tiers-dom.mjs
//      (serve-dist, NOT `vite preview`: preview falls back to index.html for
//       every path, which would serve the "/" prerender everywhere and let a
//       broken prerender pass unnoticed. Same reason ci.yml uses it.)
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
const H = 3_700_123;
const nowSec = Math.floor(Date.now() / 1000);
const hex = (c) => c.repeat(64);

let tipHeight = H - 1;            // moved by scenario B
const FIX = {
  network: {
    height: H, difficulty: 7.7e11, hashrate_ghs: 6.42, tx_pool_size: 2,
    tx_count_total: 61_236_904, block_weight_limit: 600000, block_weight_median: 300000,
    target_seconds: 120, top_block_hash: hex('b'), alt_blocks_count: 1,
    version: '0.18.3.4', major_version: 16, fee_tiers: [20000, 80000, 320000, 4000000],
    randomx_seed_hash: hex('c'), database_size: 284_500_000_000, synchronized: true,
    nettype: 'mainnet', adjusted_time: nowSec,
  },
  mempool: {
    recent_txs: [
      { txid: hex('a'), blob_size: 1538, fee: 30_720_000, fee_rate: 19_974, receive_time: nowSec - 30, ring_size: 16, input_count: 1, output_count: 2 },
      { txid: hex('d'), blob_size: 2210, fee: 44_200_000, fee_rate: 20_000, receive_time: nowSec - 95, ring_size: 16, input_count: 2, output_count: 2 },
    ],
    fee_histogram: [{ tx_count: 2, bytes: 3748 }],
  },
  blocks: Array.from({ length: 12 }, (_, i) => ({
    height: H - i, hash: hex('e'), tx_count: 3 + i, block_weight: 9000 + i * 800,
    reward: 0.6e12, difficulty: 7.7e11, timestamp: nowSec - 60 - i * 120, pool_name: 'Unknown',
  })),
  price: { monero: { usd: 321.45, usd_24h_change: 1.23 }, bitcoin: { usd: 97_000, usd_24h_change: -0.4 } },
};

/** Classify a request URL into the tier bucket it belongs to. */
function bucket(url) {
  if (url.includes('/api/xmr/tip')) return 'tip';
  if (url.includes('/api/xmr/network')) return 'network';
  if (url.includes('/api/xmr/blocks')) return 'blocks';
  if (url.includes('/api/xmr/fees')) return 'fees';
  if (url.includes('/api/xmr/mempool')) return 'mempool';
  if (url.includes('/api/coingecko')) return 'coingecko';
  if (url.includes('/api/monero')) return 'monero';
  return 'other';
}

/* Real cadence is 3s / 15s / 60s. Compressed 10× here; the RATIOS are what the
   assertions check, so the behaviour under test is unchanged. */
const TEST_TIERS = { fast: 300, chain: 1500, market: 6000 };

async function setup({ count = true } = {}) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.addInitScript((t) => { window.__XMR_TIER_MS__ = t; }, TEST_TIERS);
  const hits = {};
  let dead = false;
  await p.route('**/api/**', (route) => {
    const url = route.request().url();
    const k = bucket(url);
    if (count) hits[k] = (hits[k] || 0) + 1;
    if (dead) return route.abort();
    const json = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (k === 'network') return json(FIX.network);
    if (k === 'tip') return json({ height: tipHeight, target: 120, difficulty: FIX.network.difficulty });
    if (k === 'fees') return json({ tiers: FIX.network.fee_tiers });
    if (k === 'mempool') return json(FIX.mempool);
    if (k === 'blocks') return json(FIX.blocks);
    if (k === 'coingecko') {
      if (url.includes('simple%2Fprice') || url.includes('simple/price')) return json(FIX.price);
      return route.abort();
    }
    return route.abort();
  });
  return { p, hits, kill: () => { dead = true; }, revive: () => { dead = false; } };
}

/* ── Scenario A: tier cadence ─────────────────────────────────────────── */
{
  tipHeight = H - 1;
  const { p, hits } = await setup();
  await p.goto(base + '/live/network', { waitUntil: 'load' });
  await p.waitForTimeout(3000); // ~10 fast ticks, ~2 chain ticks at compressed rates

  const fast = (hits.mempool || 0);
  const chain = (hits.tip || 0);
  console.log('  hits:', JSON.stringify(hits));

  ok(fast >= 5, `A: fast tier polled the mempool repeatedly (${fast} hits)`);
  ok(chain >= 1, `A: chain tier polled the tip watch (${chain} hits)`);
  ok(fast > chain, `A: fast tier out-polls the chain tier (${fast} > ${chain})`);
  // The whole point: mempool must NOT be pinned to the chain cadence any more.
  ok(fast >= chain * 2, `A: fast:chain ratio reflects the tier split (${fast}:${chain})`);
  // Market is the slowest tier — at 6s compressed it can only have fired once.
  ok((hits.coingecko || 0) <= 2, `A: market tier is the slowest (${hits.coingecko || 0} hits)`);
  // v6.0.6 dropped the uncacheable POST /api/monero from the client entirely.
  ok(!hits.monero, `A: the client no longer calls POST /api/monero (${hits.monero || 0} hits)`);
  await p.close();
}

/* ── Scenario B: the tip watch gates the expensive chain pull ─────────── */
{
  tipHeight = H - 1;
  const { p, hits } = await setup();
  await p.goto(base + '/live/network', { waitUntil: 'load' });
  await p.waitForTimeout(2500);

  const tipsBefore = hits.tip || 0;
  const netBefore = hits.network || 0;
  ok(tipsBefore >= 2, `B: tip was polled ${tipsBefore}× while the chain was still`);
  ok(netBefore < tipsBefore, `B: a STILL tip does not re-pull /network every chain tick (${netBefore} network vs ${tipsBefore} tip)`);

  // Move the tip → the next chain tick must pull network + blocks immediately.
  tipHeight = H;
  await p.waitForTimeout(2000);
  ok((hits.network || 0) > netBefore,
    `B: a MOVED tip triggers an immediate /network re-pull (${netBefore} → ${hits.network || 0})`);
  ok((hits.blocks || 0) > 1,
    `B: a MOVED tip triggers a /blocks re-pull (${hits.blocks || 0} total)`);
  await p.close();
}

/* ── Scenario C: hidden tab stops polling, reveal resumes ─────────────── */
{
  tipHeight = H - 1;
  const { p, hits } = await setup();
  await p.goto(base + '/live/network', { waitUntil: 'load' });
  await p.waitForTimeout(1200);
  const beforeHide = hits.mempool || 0;
  ok(beforeHide > 0, `C: polling is running while visible (${beforeHide} mempool hits)`);

  // Emulating "hidden" makes document.visibilityState === 'hidden' and fires
  // visibilitychange, which is exactly what usePolling listens for.
  await p.emulateMedia({ media: 'screen' });
  await p.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await p.waitForTimeout(1500); // would be ~5 fast ticks if polling continued
  const afterHide = hits.mempool || 0;
  const whileHidden = afterHide - beforeHide;
  ok(whileHidden <= 1, `C: hidden tab stops polling (${whileHidden} extra hits over 1.5s)`);

  await p.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await p.waitForTimeout(400);
  ok((hits.mempool || 0) > afterHide, `C: revealing the tab fires an immediate catch-up tick`);
  await p.close();
}

/* ── Scenario D: total outage keeps last-good values behind STALE ─────── */
{
  tipHeight = H - 1;
  const { p, kill } = await setup({ count: false });
  await p.goto(base + '/live/network', { waitUntil: 'load' });
  await p.waitForFunction((h) => document.body.innerText.includes(h), H.toLocaleString('en-US'), { timeout: 8000 })
    .catch(() => {});
  let body = await p.evaluate(() => document.body.innerText);
  ok(body.includes(H.toLocaleString('en-US')), 'D: fixture height renders while live');

  kill();
  await p.waitForFunction(() => /STALE/i.test(document.body.innerText), null, { timeout: 10000 }).catch(() => {});
  body = await p.evaluate(() => document.body.innerText);
  ok(/STALE/i.test(body), 'D: repeated failures raise the STALE indicator');
  ok(body.includes(H.toLocaleString('en-US')), 'D: last-good height is RETAINED (no blanking, no invention)');
  ok(!/\$0\.00/.test(body) && !body.includes('NaN'), 'D: no fabricated zeros or NaN while stale');
  await p.close();
}

await b.close();
console.log(fail ? '\n❌ verify-tiers-dom FAILED' : '\n✅ verify-tiers-dom: all assertions passed');
process.exit(fail ? 1 : 0);
