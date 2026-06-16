// verify-allreal-dom.mjs — DOM gate for v5.0.14 "ALL-REAL DATA".
//
// Drives the BUILT app (vite preview @ :4173) with the network mocked at the
// page level, proving the three honesty states render correctly:
//
//   A. boot/outage  — every /api/* call aborted from the start: first paint
//      shows CONNECTING + "—" placeholders; NO zero-numbers ($0.00) anywhere.
//   B. live → stale — /api/* served from fixtures for ~2 poll rounds, then
//      aborted: the NavTop pill flips to "STALE · reconnecting" while the
//      last-good height stays on screen (degrade keeps data, never invents it).
//   C. markets stale-cache — localStorage pre-seeded with mh:v1:* entries and
//      /api/coingecko aborted: /markets renders the cached series with a
//      "STALE · CG" badge.
//
// Run: npm run build && (npm run preview &) && sleep 2 && node verify-allreal-dom.mjs
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
const FIX = {
  network: {
    height: H, difficulty: 7.7e11, hashrate_ghs: 6.42, tx_pool_size: 2,
    tx_count_total: 61_236_904, block_weight_limit: 600000, block_weight_median: 300000,
    target_seconds: 120, top_block_hash: hex('b'), alt_blocks_count: 1,
    version: '0.18.3.4', major_version: 16, fee_tiers: [20000, 80000, 320000, 4000000],
    randomx_seed_hash: hex('c'), database_size: 284_500_000_000, synchronized: true,
    nettype: 'mainnet', adjusted_time: nowSec,
  },
  info: { result: { height: H, difficulty: 7.7e11, target: 120, major_version: 16, top_block_hash: hex('b') } },
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

function fulfil(route) {
  const url = route.request().url();
  const json = (data) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  if (url.includes('/api/monero')) return json(FIX.info);
  if (url.includes('/api/xmr/network')) return json(FIX.network);
  if (url.includes('/api/xmr/mempool')) return json(FIX.mempool);
  if (url.includes('/api/xmr/blocks')) return json(FIX.blocks);
  if (url.includes('/api/coingecko')) {
    if (url.includes('simple%2Fprice') || url.includes('simple/price')) return json(FIX.price);
    return route.abort(); // history/tickers: not needed for these scenarios
  }
  return route.abort();
}

/* ── Scenario A: total outage from first paint ───────────────────────── */
{
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.route('**/api/**', (r) => r.abort());
  await p.goto(base + '/network', { waitUntil: 'load' });
  await p.waitForTimeout(1500);
  const body = await p.evaluate(() => document.body.innerText);
  ok(/CONNECTING/i.test(body), 'A: NavTop pill shows CONNECTING during boot/outage');
  ok(!/\$0\.00/.test(body), 'A: no $0.00 fabricated zero-price anywhere');
  ok(!body.includes('$NaN') && !body.includes('NaN'), 'A: no NaN leaked to the DOM');
  const heightKpi = await p.evaluate(() => {
    const els = [...document.querySelectorAll('*')];
    const k = els.find((e) => e.childElementCount === 0 && /^Block height$/i.test(e.textContent.trim()));
    return k ? k.parentElement.innerText : '';
  });
  ok(heightKpi.includes('—'), `A: Block-height KPI renders "—" (got: ${JSON.stringify(heightKpi.slice(0, 40))})`);
  await p.close();
}

/* ── Scenario B: live, then the feed dies → STALE with last-good data ── */
{
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  let dead = false;
  await p.route('**/api/**', (r) => (dead ? r.abort() : fulfil(r)));
  await p.goto(base + '/network', { waitUntil: 'load' });
  await p.waitForFunction((h) => document.body.innerText.includes(h), H.toLocaleString('en-US'), { timeout: 8000 })
    .catch(() => {});
  let body = await p.evaluate(() => document.body.innerText);
  ok(body.includes(H.toLocaleString('en-US')), 'B: fixture height renders while live');
  ok(/\bLIVE\b/.test(body), 'B: pill shows LIVE while the feed answers');
  dead = true; // every poll from here on fails (>= 2 consecutive → stale)
  await p.waitForFunction(() => /STALE/i.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
  body = await p.evaluate(() => document.body.innerText);
  ok(/STALE/i.test(body), 'B: pill flips to STALE · reconnecting after repeated poll failures');
  ok(body.includes(H.toLocaleString('en-US')), 'B: last-good height is RETAINED while stale (no blanking, no invention)');
  await p.close();
}

/* ── Scenario C: markets render the localStorage stale cache ─────────── */
{
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const candles = Array.from({ length: 40 }, (_, i) => ({
    t: Date.now() - (40 - i) * 4 * 3600_000, o: 320 + i, h: 324 + i, l: 318 + i, c: 322 + i, v: 1e6,
  }));
  await p.addInitScript(([key, payload]) => {
    localStorage.setItem(key, payload);
  }, ['mh:v1:ohlc|monero|usd|30', JSON.stringify({ at: Date.now() - 60_000, data: candles })]);
  await p.route('**/api/**', (r) => r.abort());
  await p.goto(base + '/markets', { waitUntil: 'load' });
  await p.waitForTimeout(1500);
  const body = await p.evaluate(() => document.body.innerText);
  ok(/STALE · CG/i.test(body), 'C: cached candle series is labelled "STALE · CG"');
  ok(/40 bars/i.test(body), 'C: the cached candles (40 bars) actually render');
  await p.close();
}

await b.close();
console.log(fail ? '\n❌ verify-allreal-dom FAILED' : '\n✅ verify-allreal-dom: all scenarios passed');
process.exit(fail ? 1 : 0);
