// verify-memperf.mjs — §5 item 8: ≥30fps on every mempool view, mid-range
// Android, 6× CPU throttle, 200+ mempool txs. Prints the table.
//
// How the frame rate is read: useMemCanvas publishes a rolling fps to the
// canvas's `data-mem-fps` attribute, but only when `window.__MEM_FPS__ === true`
// — set here via addInitScript BEFORE navigation. Instrumentation is off in
// production so the measurement is never itself the cost.
//
// Two deliberate choices:
//
//   • The 5th percentile, not the mean. A 30fps mean with 12fps troughs is not
//     ≥30fps — it is a view that stutters every time a block lands. The p5 is
//     what a user actually feels.
//   • 6× CPU throttle at 393×851 / DPR 2.75 approximates a mid-range Android.
//     It is an approximation, and it is the honest limit of what CI can measure;
//     real-device numbers stay a manual step. CDP throttling is Chromium-only,
//     so under the WebKit fallback this gate warns and skips rather than
//     reporting numbers it did not actually constrain.
//
// DOM/SVG views have no canvas and no rAF loop to sample — they report
// "n/a — DOM/SVG" rather than a fabricated number.
//
// Run: npm run build && (npm run preview &) && sleep 2 && node verify-memperf.mjs

import { chromium, webkit } from 'playwright';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const base = 'http://localhost:4173';
const THROTTLE = 6;
const MIN_FPS = 30;
const MEMPOOL_N = 240;          // §5 item 8 says "200+"
const WARMUP_MS = 1000;
const SAMPLE_MS = 4000;
const SAMPLE_EVERY = 250;

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
if (engine !== 'chromium') {
  console.log('⚠️  CDP CPU throttling is Chromium-only. Skipping rather than reporting');
  console.log('   frame rates that were never actually constrained.');
  await b.close();
  process.exit(0);
}

let fail = false;
const ok = (cond, msg) => { console.log((cond ? '✅ ' : '❌ ') + msg); if (!cond) fail = true; };

const REG = readFileSync(new URL('./src/views/index.tsx', import.meta.url), 'utf8');
const VIEWS = [...REG.matchAll(/\{\s*id:\s*"([a-z]+)"/g)].map((m) => m[1]);

/* ── fixture: 240 deterministic mempool txs, counter-derived ─────────── */
const H = 3_700_123;
const hex = (c) => c.repeat(64);
const now = () => Math.floor(Date.now() / 1000);

const mkMempool = () => ({
  recent_txs: Array.from({ length: MEMPOOL_N }, (_, i) => ({
    txid: (i.toString(16).padStart(4, '0') + 'c3f9a1e7b5d2').repeat(6).slice(0, 64),
    blob_size: 1200 + (i * 37) % 2400,
    fee: 30_720_000 + i * 1000,
    fee_rate: 15_000 + (i * 8117) % 900_000,
    receive_time: now() - (5 + (i * 13) % 1750),
    ring_size: 16, input_count: 1 + (i % 3), output_count: 2,
  })),
  fee_histogram: [{ tx_count: MEMPOOL_N, bytes: 400000 }],
});

function fulfil(route) {
  const url = route.request().url();
  const json = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  if (url.includes('/api/monero')) return json({ result: { height: H + 1, difficulty: 7.7e11, target: 120, major_version: 16, top_block_hash: hex('b') } });
  if (url.includes('/api/xmr/network')) return json({
    height: H + 1, difficulty: 7.7e11, hashrate_ghs: 6.42, tx_pool_size: MEMPOOL_N,
    tx_count_total: 61_236_904, block_weight_limit: 600000, block_weight_median: 300000,
    target_seconds: 120, top_block_hash: hex('b'), alt_blocks_count: 1,
    version: '0.18.3.4', major_version: 16, fee_tiers: [20000, 80000, 320000, 4000000],
    randomx_seed_hash: hex('c'), database_size: 284_500_000_000, synchronized: true,
    nettype: 'mainnet', adjusted_time: now(),
  });
  if (url.includes('/api/xmr/mempool')) return json(mkMempool());
  if (url.includes('/api/xmr/blocks')) return json(Array.from({ length: 14 }, (_, i) => ({
    height: H - i, hash: hex('e'), tx_count: 3 + i, block_weight: 9000 + i * 800,
    reward: 0.6e12, difficulty: 7.7e11, timestamp: now() - 41 - i * 120, pool_name: 'P2Pool',
  })));
  if (url.includes('/api/coingecko')) {
    if (url.includes('simple%2Fprice') || url.includes('simple/price')) {
      return json({ monero: { usd: 321.45, usd_24h_change: 1.23 }, bitcoin: { usd: 97_000, usd_24h_change: -0.4 } });
    }
    return route.abort();
  }
  return route.abort();
}

const pct = (arr, p) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, x) => a - x);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))];
};

const rows = [];
const ctx = await b.newContext({
  viewport: { width: 393, height: 851 },
  deviceScaleFactor: 2.75,
  isMobile: true,
  hasTouch: true,
});
await ctx.addInitScript(() => { window.__MEM_FPS__ = true; });

for (const id of VIEWS) {
  const p = await ctx.newPage();
  await p.route('**/api/**', fulfil);
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });

  let samples = [];
  let hasCanvas = false;
  try {
    await p.goto(`${base}/mempool?v=${id}`, { waitUntil: 'load' });
    await p.waitForSelector(`.mem-view[data-mem-view="${id}"]`, { timeout: 20000 });
    await p.waitForTimeout(WARMUP_MS);
    hasCanvas = (await p.evaluate(() => document.querySelectorAll('canvas.mem-canvas').length)) > 0;
    if (hasCanvas) {
      const n = Math.floor(SAMPLE_MS / SAMPLE_EVERY);
      for (let i = 0; i < n; i++) {
        await p.waitForTimeout(SAMPLE_EVERY);
        const v = await p.evaluate(() => {
          const c = document.querySelector('canvas.mem-canvas');
          const f = c && c.dataset.memFps;
          return f ? +f : null;
        });
        if (v != null) samples.push(v);
      }
    }
  } catch (e) {
    rows.push({ id, err: String(e).split('\n')[0] });
    await p.close();
    continue;
  }
  await p.close();

  rows.push({
    id, hasCanvas,
    p5: pct(samples, 0.05),
    median: pct(samples, 0.5),
    frames: samples.length,
  });
}
await ctx.close();
await b.close();

/* ── the table — printed whether it passes or fails ──────────────────── */
console.log(`\n§5 item 8 — frame rate, ${THROTTLE}× CPU throttle, 393×851 @ 2.75 DPR, ${MEMPOOL_N} mempool txs\n`);
console.log('  view            p5 fps   median   samples   verdict');
for (const r of rows) {
  if (r.err) { console.log(`  ${r.id.padEnd(14)} —        —        —         ERROR: ${r.err}`); continue; }
  if (!r.hasCanvas) { console.log(`  ${r.id.padEnd(14)} n/a — DOM/SVG (no rAF loop to sample)`); continue; }
  const verdict = r.p5 == null ? 'NO SAMPLES' : r.p5 >= MIN_FPS ? 'pass' : 'FAIL';
  console.log(`  ${r.id.padEnd(14)} ${String(r.p5 ?? '—').padStart(6)}   ${String(r.median ?? '—').padStart(6)}   ${String(r.frames).padStart(7)}   ${verdict}`);
}
console.log('');

for (const r of rows) {
  if (r.err) { ok(false, `${r.id}: ${r.err}`); continue; }
  if (!r.hasCanvas) continue;
  ok(r.p5 != null, `${r.id}: fps instrumentation reported (window.__MEM_FPS__ wired, canvas has data-mem-fps)`);
  if (r.p5 != null) ok(r.p5 >= MIN_FPS, `${r.id}: p5 ${r.p5}fps ≥ ${MIN_FPS}fps at ${THROTTLE}× throttle`);
}

console.log(fail ? '❌ verify-memperf FAILED' : '✅ verify-memperf: every canvas view holds ≥30fps at the 5th percentile');
process.exit(fail ? 1 : 0);
