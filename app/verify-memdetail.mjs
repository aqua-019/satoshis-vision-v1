// verify-memdetail.mjs — DOM gate for the v6.0.3 mempool-detail work.
//
// Two claims, checked against all six views with one identical mocked feed:
//
//   (d) TRACKING. Searching a txid highlights it inside the view itself, and
//       the view's own body stays mounted while it does. Before this change
//       four of the six replaced their entire body with the detail panel the
//       moment you searched — so any in-view highlight was unreachable. The
//       "body still present" assertion is the one that fails on the old build.
//       Confirmation depth then counts up as the mocked tip advances.
//
//   (e) STAT PARITY. Every view reports the same numbers for the same feed.
//       Compared via data-memstat-value (the RAW number), not rendered text,
//       because the views format in their own idiom on purpose — Terminal
//       zero-pads its tx count to "038" where the strip renders "38", and
//       those are the same reading.
//
// Run: npm run build && (npm run preview &) && sleep 2 && node verify-memdetail.mjs
import { chromium, webkit } from 'playwright';
import { existsSync, readdirSync } from 'node:fs';

const base = 'http://localhost:4173';
const VIEWS = ['classic', 'reactor', 'bridge', 'sediment', 'constellation', 'terminal'];

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
console.log('engine:', engine);

let fail = false;
const ok = (cond, msg) => { console.log((cond ? '✅ ' : '❌ ') + msg); if (!cond) fail = true; };

/* ── fixture ───────────────────────────────────────────────────────── */
const H0 = 3_700_123;
const TRACK_H = H0 - 3;              // tracked tx sits 4 blocks deep => 4/10
const nowSec = Math.floor(Date.now() / 1000);
const hex = (c) => c.repeat(64);
const TXID = 'ab'.repeat(32);

let curHead = H0;
const mkBlocks = (head) => Array.from({ length: 14 }, (_, i) => ({
  height: head - i, hash: hex('e'), tx_count: 3 + i, block_weight: 9000 + i * 800,
  reward: 0.6e12, difficulty: 7.7e11, timestamp: nowSec - 60 - i * 120, pool_name: 'Unknown',
}));

// Deterministic pool — no Math.random, so every view sees identical input.
//
// receive_time is recomputed PER REQUEST from the current clock, not frozen at
// module load. map.ts derives a tx's age as `now - receive_time`, so a fixed
// timestamp would make "oldest tx age" grow by however many seconds apart the
// six page loads happen to be — and the parity check would then be measuring
// the test's own wall-clock drift instead of the product.
const TX_AGES = Array.from({ length: 18 }, (_, i) => (i + 1) * 45);
const mkTxs = () => {
  const t = Math.floor(Date.now() / 1000);
  return TX_AGES.map((age, i) => ({
    txid: String(i).padStart(2, '0').repeat(32),
    blob_size: 1000 + i * 137,
    fee: 30_000_000 + i * 1_000_000,
    fee_rate: 12_000 + i * 4_000,
    receive_time: t - age,
    ring_size: 16, input_count: 1, output_count: 2,
  }));
};
const TXS = mkTxs();

const FIX = {
  network: {
    height: H0, difficulty: 7.7e11, hashrate_ghs: 6.42, tx_pool_size: TXS.length,
    tx_count_total: 61_236_904, block_weight_limit: 600000, block_weight_median: 300000,
    target_seconds: 120, top_block_hash: hex('b'), alt_blocks_count: 1,
    version: '0.18.3.4', major_version: 16, fee_tiers: [20000, 80000, 320000, 4000000],
    randomx_seed_hash: hex('c'), database_size: 284_500_000_000,
    synchronized: true, nettype: 'mainnet', adjusted_time: nowSec,
  },
  info: { result: { height: H0, difficulty: 7.7e11, target: 120, major_version: 16, top_block_hash: hex('b') } },
  mempool: { recent_txs: TXS, fee_histogram: [{ tx_count: 6, bytes: 7000 }, { tx_count: 12, bytes: 14000 }] },
  blocks: mkBlocks(H0),
  price: { monero: { usd: 321.45, usd_24h_change: 1.23 }, bitcoin: { usd: 97_000, usd_24h_change: -0.4 } },
  tx: {
    txid: TXID, status: 'confirmed', confirmed: true, in_pool: false,
    block_height: TRACK_H, block_hash: hex('e'), block_timestamp: nowSec - 420,
    confirmations: 4, receive_time: null, blob_size: 1538, fee: 30_720_000, fee_rate: 19_974,
    ring_size: 16, rct_type: 6, has_view_tags: true, unlock_time: 0,
    output_count: 2, input_count: 1, version: 2,
    inputs: [{ key_image: hex('1'), ring_member_count: 16, key_offsets: [1, 2, 3] }],
    outputs: [{ stealth_key: hex('2'), view_tag: 'ab' }, { stealth_key: hex('3'), view_tag: 'cd' }],
    extra_hex: '01' + hex('4'),
  },
};
const reset = () => { curHead = H0; FIX.blocks = mkBlocks(H0); FIX.network = { ...FIX.network, height: H0 };
  FIX.info = { result: { ...FIX.info.result, height: H0 } }; };
const advance = () => { curHead += 1; FIX.blocks = mkBlocks(curHead);
  FIX.network = { ...FIX.network, height: curHead }; FIX.info = { result: { ...FIX.info.result, height: curHead } }; };

function fulfil(route) {
  const url = route.request().url();
  const json = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  if (url.includes('/api/monero')) return json(FIX.info);
  if (url.includes('/api/xmr/network')) return json(FIX.network);
  if (url.includes('/api/xmr/mempool')) return json({ ...FIX.mempool, recent_txs: mkTxs() });
  if (url.includes('/api/xmr/tx/')) return json(FIX.tx);
  if (url.includes('/api/xmr/blocks')) return json(FIX.blocks);
  if (url.includes('/api/xmr/block/')) return route.abort();
  if (url.includes('/api/xmr/decoys/')) return route.abort();
  if (url.includes('/api/coingecko')) {
    if (url.includes('simple%2Fprice') || url.includes('simple/price')) return json(FIX.price);
    return route.abort();
  }
  return route.abort();
}
const POLL = 3200; // > the feed's POLL_MS (2500), so a mutation is always picked up

const open = async (view) => {
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  await p.route('**/api/**', fulfil);
  await p.goto(`${base}/mempool?v=${view}`, { waitUntil: 'load' });
  await p.waitForTimeout(2600);
  return p;
};

/* ── (e) stat parity across all six views ──────────────────────────── */
reset();
const readings = {};
for (const v of VIEWS) {
  const p = await open(v);
  readings[v] = await p.evaluate(() =>
    Object.fromEntries([...document.querySelectorAll('[data-memstat]')]
      .map((n) => [n.getAttribute('data-memstat'), n.getAttribute('data-memstat-value')])
      .filter(([, val]) => val !== null && val !== '')));
  await p.close();
}
console.log('\n— shared stat readings —');
for (const v of VIEWS) console.log(`  ${v.padEnd(14)} ${JSON.stringify(readings[v])}`);

// Every key any view exposes must agree everywhere it appears.
//
// `mempool`, `bytes` and `median` are pure functions of the feed payload, so
// they must match exactly. `oldest` is a live age (`now - receive_time`) at
// one-second granularity, so two page loads a fraction of a second apart can
// legitimately straddle a tick and differ by 1 — asserting bitwise equality
// there measures the clock, not the code. `eta` is a running countdown and is
// excluded outright for the same reason, only more so.
const EXACT = ['mempool', 'bytes', 'median'];
const WITHIN_1S = ['oldest'];
for (const key of [...EXACT, ...WITHIN_1S]) {
  const seen = VIEWS.filter((v) => readings[v][key] !== undefined).map((v) => [v, readings[v][key]]);
  const nums = seen.map(([, val]) => Number(val));
  const spread = nums.length ? Math.max(...nums) - Math.min(...nums) : 0;
  const tol = EXACT.includes(key) ? 0 : 2;
  ok(seen.length > 0, `stat "${key}" is exposed by at least one view (${seen.length}/6)`);
  ok(spread <= tol,
    `stat "${key}" agrees across the ${seen.length} views exposing it` +
    (spread <= tol
      ? tol ? ` (spread ${spread}s ≤ ${tol}s)` : ` (= ${seen[0]?.[1]})`
      : ` → ${JSON.stringify(seen)}`));
}
ok(VIEWS.every((v) => readings[v].mempool !== undefined),
  `every view exposes the mempool count${VIEWS.filter((v) => readings[v].mempool === undefined).length ? ' → missing: ' + VIEWS.filter((v) => readings[v].mempool === undefined).join(', ') : ''}`);

/* ── (d) tracking, per view ────────────────────────────────────────── */
console.log('');
for (const v of VIEWS) {
  reset();
  const p = await open(v);

  // Size of the view's own subtree. Counting a fixed set of classes doesn't
  // work here — the six views share almost no markup vocabulary, and
  // `.panel, .mblock, pre` reads 0 on Classic, Bridge and Sediment before any
  // search happens. Element count under the view container is the one measure
  // that means the same thing in all six: if the detail panel had replaced the
  // body, it would collapse.
  const bodyCount = () => p.evaluate(() => {
    const root = document.querySelector('.mp-canvas-scroll') || document.querySelector('main') || document.body;
    return root.querySelectorAll('*').length;
  });
  const beforeBody = await bodyCount();

  const input = await p.$('input[type="text"], input:not([type])');
  if (!input) { ok(false, `${v}: has a search input`); await p.close(); continue; }
  await input.fill(TXID);
  await input.press('Enter');
  await p.waitForTimeout(2200);

  const marked = await p.evaluate((id) => document.querySelectorAll(`[data-tracked-tx="${id}"]`).length, TXID);
  ok(marked > 0, `${v}: highlights the tracked tx in-view (${marked} marked element${marked === 1 ? '' : 's'})`);

  const afterBody = await bodyCount();
  ok(afterBody > 0 && afterBody >= Math.floor(beforeBody * 0.5),
    `${v}: keeps its own body mounted while tracking (${beforeBody} → ${afterBody} panels)`);

  const detail = await p.evaluate(() => /TRACK|CONF|MEMPOOL/i.test(document.body.innerText));
  ok(detail, `${v}: surfaces tracking state`);

  // Depth counts up as the tip advances: 4/10 → 5/10 → 6/10.
  const depth = () => p.evaluate(() => {
    const m = document.body.innerText.match(/(\d+)\s*\/\s*10/);
    return m ? Number(m[1]) : null;
  });
  const d0 = await depth();
  ok(d0 === 4, `${v}: reads 4/10 at four blocks deep${d0 === 4 ? '' : ` → got ${d0}`}`);
  advance(); await p.waitForTimeout(POLL);
  advance(); await p.waitForTimeout(POLL);
  const d2 = await depth();
  ok(d2 === 6, `${v}: counts up to 6/10 after two block advances${d2 === 6 ? '' : ` → got ${d2}`}`);

  await p.close();
}

await b.close();
console.log(fail ? '\nFAILED\n' : '\nAll mempool detail checks passed\n');
process.exit(fail ? 1 : 0);
