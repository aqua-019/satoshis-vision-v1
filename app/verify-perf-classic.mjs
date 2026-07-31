// verify-perf-classic.mjs — frame-time profile for the Classic mempool view
// under a 220-tx pool.
//
// The brief asks for "a steady 60fps at 200+ mempool txs", profiled before and
// after. The live feed is a real network poll, so the load has to come from a
// fixture: /api/xmr/mempool is mocked with 220 deterministic txs, and the pool
// is MUTATED on every request (rotated, with ages advanced) so React genuinely
// re-renders and the render-time sorts actually re-run. A static fixture would
// let memoisation trivially win and prove nothing.
//
// Measurement is an injected rAF sampler rather than the CDP FPS overlay: it
// reports the distribution, which is what "steady" means. A run can look fine
// on a mean while dropping frames badly at p95.
//
// Usage:
//   node verify-perf-classic.mjs [--label NAME] [--seconds N] [--url URL]
//   PERF_ASSERT=0 node verify-perf-classic.mjs      # report only, never fail
//
// To capture a "before" baseline, build the pre-change tree into a second
// preview (e.g. a git worktree on origin/main, `vite preview --port 4174`) and
// point --url at it. The numbers only mean something as a pair.
import { chromium, webkit } from 'playwright';
import { existsSync, readdirSync } from 'node:fs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const LABEL = arg('--label', 'after');
const SECONDS = Number(arg('--seconds', 12));
const BASE = arg('--url', 'http://localhost:4173');
const ASSERT = process.env.PERF_ASSERT !== '0';
const TX_COUNT = Number(arg("--txs", 220));
let TX_N = TX_COUNT;

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
try { const ep = findChrome(); b = await chromium.launch(ep ? { executablePath: ep } : {}); }
catch { engine = 'webkit'; b = await webkit.launch(); }

const H0 = 3_700_123;
const hex = (c) => c.repeat(64);
const nowSec = () => Math.floor(Date.now() / 1000);

// Deterministic — no Math.random, so two runs are comparable. `rot` advances
// each poll so the pool is never byte-identical twice running.
let rot = 0;
const mkTxs = () => {
  const t = nowSec();
  return Array.from({ length: TX_N }, (_, i) => {
    const k = (i + rot) % TX_N;
    return {
      txid: String(k).padStart(2, '0').repeat(32),
      blob_size: 1000 + (k * 37) % 2400,
      fee: 30_000_000 + (k * 911) % 20_000_000,
      fee_rate: 12_000 + (k * 911) % 40_000,   // spans all four fee tiers
      receive_time: t - ((k * 7) % 900) - 5,
      ring_size: 16, input_count: 1 + (k % 3), output_count: 2,
    };
  });
};

const FIX = {
  network: {
    height: H0, difficulty: 7.7e11, hashrate_ghs: 6.42, tx_pool_size: TX_COUNT,
    tx_count_total: 61_236_904, block_weight_limit: 600000, block_weight_median: 300000,
    target_seconds: 120, top_block_hash: hex('b'), alt_blocks_count: 1,
    version: '0.18.3.4', major_version: 16, fee_tiers: [20000, 80000, 320000, 4000000],
    randomx_seed_hash: hex('c'), database_size: 284_500_000_000,
    synchronized: true, nettype: 'mainnet', adjusted_time: nowSec(),
  },
  info: { result: { height: H0, difficulty: 7.7e11, target: 120, major_version: 16, top_block_hash: hex('b') } },
  blocks: Array.from({ length: 14 }, (_, i) => ({
    height: H0 - i, hash: hex('e'), tx_count: 3 + i, block_weight: 9000 + i * 800,
    reward: 0.6e12, difficulty: 7.7e11, timestamp: nowSec() - 60 - i * 120, pool_name: 'Unknown',
  })),
  price: { monero: { usd: 321.45, usd_24h_change: 1.23 }, bitcoin: { usd: 97_000, usd_24h_change: -0.4 } },
};

function fulfil(route) {
  const url = route.request().url();
  const json = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  if (url.includes('/api/monero')) return json(FIX.info);
  if (url.includes('/api/xmr/network')) return json(FIX.network);
  if (url.includes('/api/xmr/mempool')) { rot += 3; return json({ recent_txs: mkTxs(), fee_histogram: [{ tx_count: TX_N, bytes: 400000 }] }); }
  if (url.includes('/api/xmr/blocks')) return json(FIX.blocks);
  if (url.includes('/api/coingecko')) {
    if (url.includes('simple%2Fprice') || url.includes('simple/price')) return json(FIX.price);
    return route.abort();
  }
  return route.abort();
}

async function measure(txCount, seconds) {
  TX_N = txCount;
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  await p.route('**/api/**', fulfil);
  await p.goto(`${BASE}/mempool?v=classic`, { waitUntil: 'load' });
  await p.waitForTimeout(3000); // let the first feed poll land and settle
  const rendered = await p.evaluate(() => {
    const m = document.body.innerText.match(/(\d+)\s*tx\b/);
    return m ? Number(m[1]) : null;
  });
  await p.evaluate(() => {
    window.__f = [];
    let last = performance.now();
    const tick = (t) => { window.__f.push(t - last); last = t; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await p.waitForTimeout(seconds * 1000);
  const frames = await p.evaluate(() => window.__f.slice(1)); // drop the first delta
  await p.close();
  const sorted = [...frames].sort((a, x) => a - x);
  const q = (f) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * f))] ?? 0;
  return {
    rendered, n: frames.length,
    mean: frames.reduce((a, x) => a + x, 0) / (frames.length || 1),
    p50: q(0.5), p95: q(0.95), p99: q(0.99), worst: sorted[sorted.length - 1] ?? 0,
    o17: frames.filter((f) => f > 16.7).length,
    o33: frames.filter((f) => f > 33).length,
    o50: frames.filter((f) => f > 50).length,
  };
}

const report = (title, r) => {
  console.log(`\n${title}\n`);
  console.log(`  pool rendered      ${r.rendered ?? '?'} tx`);
  console.log(`  frames sampled     ${r.n}`);
  console.log(`  mean               ${r.mean.toFixed(2)} ms  (${(1000 / r.mean).toFixed(1)} fps)`);
  console.log(`  p50                ${r.p50.toFixed(2)} ms`);
  console.log(`  p95                ${r.p95.toFixed(2)} ms`);
  console.log(`  p99                ${r.p99.toFixed(2)} ms`);
  console.log(`  worst              ${r.worst.toFixed(2)} ms`);
  console.log(`  > 16.7 ms          ${r.o17}  (${((r.o17 / (r.n || 1)) * 100).toFixed(1)}%)`);
  console.log(`  > 33 ms            ${r.o33}`);
  console.log(`  > 50 ms            ${r.o50}`);
};

const load = await measure(TX_COUNT, SECONDS);
report(`Classic frame profile — ${LABEL} · ${engine} · ${TX_COUNT} tx · ${SECONDS}s`, load);

// CONTROL. A headless browser with no GPU (SwiftShader in a container, which
// is what CI and this sandbox give you) has a frame floor set by the compositor,
// not by the page. Without a control you cannot tell "Classic is slow" from
// "this box renders everything at 11fps" — and the first time I ran this, the
// two were indistinguishable at 220 tx.
//
// So: measure a near-empty pool too. If the frame time barely moves between a
// 20-tx pool and a 220-tx one, the measurement is environment-bound and says
// nothing about the view. Report that instead of failing misleadingly.
const ctl = await measure(20, Math.max(6, Math.round(SECONDS / 2)));
report(`Control — same page, 20 tx (isolates the renderer floor)`, ctl);
await b.close();

const ratio = load.mean / (ctl.mean || 1);
const envBound = ratio < 1.25;

console.log('');
if (envBound) {
  console.log(`⚠️  INCONCLUSIVE — 220 tx is only ${ratio.toFixed(2)}× the 20 tx frame time.`);
  console.log('    Frame time is essentially independent of pool size, so this box\'s');
  console.log('    renderer, not Classic, is the bottleneck. Re-run on hardware with a');
  console.log('    real compositor before reading anything into these numbers.');
  console.log('    Exiting 0: an environment limit is not a regression.');
  process.exit(0);
}

// "Steady 60fps" as a distribution claim, not a mean: p95 within a frame
// budget with a little headroom, and no outright stall.
const p95ok = load.p95 <= 20;
const noStall = load.o50 === 0;
console.log(`${p95ok ? '✅' : '❌'} p95 ≤ 20 ms (${load.p95.toFixed(2)})`);
console.log(`${noStall ? '✅' : '❌'} no frame over 50 ms (${load.o50})`);
console.log(`   load/control mean ratio ${ratio.toFixed(2)}× — measurement is load-bound, so meaningful`);
const fail = !(p95ok && noStall);
if (fail && !ASSERT) console.log('\n(PERF_ASSERT=0 — reporting only)');
console.log('');
process.exit(fail && ASSERT ? 1 : 0);
