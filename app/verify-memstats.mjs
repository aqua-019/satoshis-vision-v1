// verify-memstats.mjs — the same feed yields the same numbers on every view.
//
// Required by docs/v6-mempool-views-spec.md:150:
//   "assert its MemStatStrip numbers match every other view for the same feed."
//
// And `mem-stats.tsx:184-186` has cited this file BY NAME since v6.0.3 —
//   "data-memstat names the figure; data-memstat-value carries the RAW number.
//    verify-memstats.mjs compares the raw values, not the rendered text,
//    because each view is free to format in its own idiom"
// — while the file did not exist. verify-memviews' own comment records the same
// thing ("that file does not exist in this repo"). This makes the citation true.
//
// RAW values, never rendered text, exactly as that comment says: Terminal
// zero-pads its count to "038" where the strip renders "38", and those are the
// same reading. `data-memstat-value` is the number; the glyphs are the idiom.
//
// ── WHAT MAKES THIS MORE THAN A TAUTOLOGY ─────────────────────────────────
//
// "Every view agrees" is trivially satisfiable in two ways that are not the
// property anyone wants, and each has its own guard here:
//
//   1. EVERY VIEW RENDERS NOTHING. `"" === ""` is agreement. §3 requires the
//      shared values to be real and positive before parity is credited, so an
//      un-hydrated sweep reds instead of passing.
//   2. EVERY VIEW IS IDENTICALLY WRONG. Seven consumers of one buggy
//      `useMemStats` agree perfectly. §4 therefore RECOMPUTES the expected
//      values from the fixture INDEPENDENTLY — the gate does its own median and
//      its own byte sum — so the assertion is anchored to arithmetic rather
//      than to consensus.
//
// And §5 changes the feed and re-reads: the numbers must MOVE and still agree.
// A parity check on one static render cannot distinguish "these views share a
// derivation" from "these views share a constant".
//
// ── THE KEY UNIVERSE IS PARSED, NOT RESTATED ──────────────────────────────
//
// `verify-memviews` already owns EXPECT_MEMSTAT — which view claims which keys.
// Copying that map here would give it two homes and one of them would go stale,
// which is the drift this suite keeps cataloguing. So this gate derives the key
// UNIVERSE from the emitters in `src/` instead, and asserts both directions
// against what actually renders: no view may emit a key that exists nowhere in
// source, and no key in source may be emitted by no view at all.
import { chromium, webkit } from 'playwright';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { makeReporter } from './verify-reporter.mjs';

const R = makeReporter('verify-memstats');
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

const src = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

// p2·7b: the id literals moved from views/index.tsx to views/mempool-meta.ts
// (index.tsx now binds components and derives MEMPOOL_VIEWS from that list).
// Same instrument, new subject — see mempool-meta.ts's header.
const REG = src('./src/views/mempool-meta.ts');
const VIEWS = [...REG.matchAll(/\{\s*id:\s*"([a-z]+)"/g)].map((m) => m[1]);

/* The declared key universe, parsed out of every emitter in src/mempool/.
   `data-memstat="x"` in TSX compiles to the attribute verbatim, so the literal
   IS the contract. Parsed rather than restated — the same reason verify-orb
   parses ORB_RADIUS_FRAC instead of copying it. */
const EMITTERS = ['./src/mempool/mem-stats.tsx', './src/mempool/terminal.tsx'];
const DECLARED = new Set();
for (const f of EMITTERS) {
  for (const m of src(f).matchAll(/data-memstat=["{]?"?([a-z]+)"/g)) DECLARED.add(m[1]);
}

/* ── fixture ──────────────────────────────────────────────────────────────
   DETERMINISTIC BY CONSTRUCTION. Sizes and fee rates are pure functions of the
   index, so the gate can recompute the expected byte sum and median in §4
   without knowing anything about useMemStats' implementation.

   Timestamps are relative to the FROZEN clock below, not to request time, so
   every figure — including the two time-derived ones — is a constant of the
   fixture rather than of when the request happened. */
const H = 3_700_123;
const hex = (c) => c.repeat(64);

/* THE CLOCK IS FROZEN, AND THE FIRST DRAFT OF THIS GATE PROVED WHY.
 *
 * `oldest` is `max(nowSec() - receive_time)` (map.ts:220). With a live clock the
 * fixture stamps `receive_time` at REQUEST time while the page reads it some
 * hundreds of ms later, so a view whose load straddles a second boundary reports
 * an age one higher than its neighbours. The views are read sequentially, so
 * that is not hypothetical: a second run of this gate on an unchanged tree read
 * `orbital=1748` against `1747` everywhere else and reddened the parity line —
 * a gate going red on its author, on correct code, for a defect in the harness.
 *
 * The tempting fix is a 1-2s tolerance on the two time-derived keys. That is
 * rejected on §9's own rule: a tolerance is an upper bound on the error the test
 * can detect, so it would have bought exactly the blind spot it papered over.
 * Freezing the clock removes the wall-clock TERM instead, which makes every key
 * — including `oldest` and `eta` — exactly comparable and exactly anchorable.
 *
 * `page.clock.setFixedTime` is the repo's existing instrument for this
 * (verify-shots.mjs:279, added when a live seconds-resolution footer clock made
 * two sweeps of one tree differ by 84 pixels). It fixes `Date.now()` WITHOUT
 * faking timers, so the 3s/15s polling tiers still run normally. */
const FIXED_CLOCK = new Date('2026-08-12T12:00:00Z');
const FIXED_S = Math.floor(FIXED_CLOCK.getTime() / 1000);
const now = () => FIXED_S;

/** Flipped by §5 to prove the numbers track the feed rather than a constant. */
let POOL_N = 240;

const txSize = (i) => 1200 + (i * 37) % 2400;
const txRate = (i) => 15_000 + (i * 8117) % 900_000;
const txAge = (i) => 5 + (i * 13) % 1750;

const mkMempool = () => ({
  recent_txs: Array.from({ length: POOL_N }, (_, i) => ({
    txid: (i.toString(16).padStart(4, '0') + 'c3f9a1e7b5d2').repeat(6).slice(0, 64),
    blob_size: txSize(i), fee: 30_720_000 + i * 1000, fee_rate: txRate(i),
    receive_time: now() - txAge(i), ring_size: 16, input_count: 1 + (i % 3), output_count: 2,
  })),
  fee_histogram: [{ tx_count: POOL_N, bytes: 400000 }],
});
const mkNetwork = () => ({
  height: H, difficulty: 7.7e11, hashrate_ghs: 6.42, tx_pool_size: POOL_N,
  tx_count_total: 61_236_904, block_weight_limit: 600000, block_weight_median: 300000,
  target_seconds: 120, top_block_hash: hex('b'), alt_blocks_count: 1,
  version: '0.18.3.4', major_version: 16, fee_tiers: [20000, 80000, 320000, 4000000],
  randomx_seed_hash: hex('c'), database_size: 284_500_000_000, synchronized: true,
  nettype: 'mainnet', adjusted_time: now(),
});
const mkBlocks = () => Array.from({ length: 14 }, (_, i) => ({
  height: H - i, hash: hex('e'), tx_count: 3 + i, block_weight: 9000 + i * 800,
  reward: 0.6e12, difficulty: 7.7e11, timestamp: now() - 41 - i * 120, pool_name: 'P2Pool',
}));
const PRICE = { monero: { usd: 168.4, usd_24h_change: 1.2, btc: 0.0026 }, bitcoin: { usd: 64800, usd_24h_change: 0.4 } };

function fulfil(route) {
  const url = route.request().url();
  const json = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  if (url.includes('/api/xmr/network')) return json(mkNetwork());
  if (url.includes('/api/xmr/mempool')) return json(mkMempool());
  if (url.includes('/api/xmr/blocks')) return json(mkBlocks());
  if (url.includes('/api/xmr/tip')) return json({ height: H });
  if (url.includes('/api/xmr/tx/')) return route.abort();
  if (url.includes('/api/xmr/block/')) return route.abort();
  if (url.includes('/api/coingecko')) {
    if (url.includes('simple%2Fprice') || url.includes('simple/price')) return json(PRICE);
    return route.abort();
  }
  if (url.includes('/api/')) return json({});
  return route.continue();
}

/** The gate's OWN derivation — deliberately not importing useMemStats. */
function expected() {
  const sizes = Array.from({ length: POOL_N }, (_, i) => txSize(i));
  const rates = Array.from({ length: POOL_N }, (_, i) => txRate(i)).sort((a, b) => a - b);
  const mid = Math.floor(rates.length / 2);
  const median = rates.length % 2 ? rates[mid] : (rates[mid - 1] + rates[mid]) / 2;
  return {
    mempool: POOL_N,
    bytes: sizes.reduce((a, s) => a + s, 0),
    median: Math.round(median),
    oldestAtLeast: Math.max(...Array.from({ length: POOL_N }, (_, i) => txAge(i))),
  };
}

let engine = 'chromium';
let b;
try {
  const executablePath = findChrome();
  b = await chromium.launch(executablePath ? { executablePath } : {});
} catch {
  engine = 'webkit';
  b = await webkit.launch();
}

console.log('verify-memstats — one feed, one set of numbers, every view');
console.log(`engine: ${engine}`);
console.log(`views under test (${VIEWS.length}): ${VIEWS.join(', ')}`);
console.log(`declared data-memstat keys, parsed from ${EMITTERS.length} emitters: ${[...DECLARED].sort().join(', ')}\n`);

/* NON-VACUITY FLOOR — see verify-tracking.mjs for the full reasoning. Both of
   this gate's sections iterate VIEWS, and the cross-view parity check is worse
   than vacuous on an empty list: "identical across 0 views" is trivially TRUE.
   Assert the subject exists before comparing it to itself. */
R.group('0 · the registry parse is non-vacuous');
R.ok(VIEWS.length > 0, `${VIEWS.length} views parsed from src/views/mempool-meta.ts`);

/** Read every data-memstat key/raw-value pair a view renders. */
async function readView(p, id) {
  await p.goto(`${base}/live/mempool?v=${id}`, { waitUntil: 'load' });
  await p.waitForSelector(`.mem-view[data-mem-view="${id}"]`, { timeout: 15000 });
  await p.waitForFunction(() => {
    const v = document.querySelector('[data-memstat][data-memstat-value]');
    return v && Number(v.getAttribute('data-memstat-value')) > 0;
  }, { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(400);
  return p.evaluate(() => {
    const out = {};
    for (const el of document.querySelectorAll('[data-memstat]')) {
      out[el.getAttribute('data-memstat')] = el.getAttribute('data-memstat-value');
    }
    return out;
  });
}

const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.clock.setFixedTime(FIXED_CLOCK);
await p.route('**/api/**', fulfil);

const readings = {};
R.group('1 · every view, one feed');
for (const id of VIEWS) {
  try {
    readings[id] = await readView(p, id);
    const keys = Object.keys(readings[id]).sort();
    R.ok(keys.length > 0, `[${id}] emits data-memstat at all (${keys.join(', ') || 'NOTHING'})`);
    R.info(`${id.padEnd(14)} ${keys.map((k) => `${k}=${readings[id][k]}`).join('  ')}`);
  } catch (e) {
    readings[id] = {};
    R.ok(false, `[${id}] could not be read`, String(e).split('\n')[0]);
  }
}

R.group('2 · the key universe, both directions');
const rendered = new Set();
for (const id of VIEWS) for (const k of Object.keys(readings[id])) rendered.add(k);
for (const k of rendered) {
  R.ok(DECLARED.has(k), `rendered key "${k}" exists in source — no view invents a figure name`);
}
for (const k of DECLARED) {
  const who = VIEWS.filter((id) => k in readings[id]);
  R.ok(who.length > 0, `declared key "${k}" is rendered by at least one view (${who.join(', ') || 'NOBODY'}) — a dead key is a rename nobody noticed`);
}

R.group('3 · parity — the same key reads the same on every view that shows it');
const exp = expected();
for (const k of [...DECLARED].sort()) {
  const vals = VIEWS.filter((id) => k in readings[id]).map((id) => [id, readings[id][k]]);
  if (!vals.length) continue;
  const distinct = [...new Set(vals.map(([, v]) => v))];
  // VACUITY GUARD, and it is the load-bearing half of this section: `"" === ""`
  // is perfect agreement and means the sweep measured an un-hydrated page.
  const real = vals.every(([, v]) => v !== null && v !== '' && Number.isFinite(Number(v)));
  R.ok(real, `[${k}] every view reports a real number, not an empty attribute (${vals.map(([i, v]) => `${i}=${v === '' ? '<empty>' : v}`).join(' ')})`);
  R.ok(distinct.length === 1,
    `[${k}] identical across ${vals.length} view(s): ${distinct.length === 1 ? distinct[0] : vals.map(([i, v]) => `${i}=${v}`).join(' ≠ ')}`);
}

R.group('4 · anchored to arithmetic, not to consensus');
const anyView = VIEWS.find((id) => 'mempool' in readings[id]);
if (!anyView) {
  R.ok(false, 'no view rendered the mempool figure — nothing to anchor');
} else {
  const got = readings[anyView];
  R.ok(Number(got.mempool) === exp.mempool,
    `mempool count matches the gate's OWN count of the fixture (${got.mempool} vs ${exp.mempool})`);
  R.ok(Number(got.bytes) === exp.bytes,
    `pool bytes match the gate's OWN sum of blob_size (${got.bytes} vs ${exp.bytes})`);
  R.ok(Number(got.median) === exp.median,
    `median fee/B matches the gate's OWN median of fee_rate (${got.median} vs ${exp.median})`);
  /* NO TOLERANCE, and that is the point (§9). This line carried `<= 3` in the
     first draft, to absorb the wall-clock term in `oldest`. Freezing the clock
     removed the term, so the tolerance could be removed with it rather than
     kept as a margin — which is the difference between verifying a class by
     construction and hiding it behind a threshold. If this ever needs a
     tolerance again, the clock has come unfrozen; fix that instead. */
  const oldest = Number(got.oldest);
  R.ok(oldest === exp.oldestAtLeast,
    `oldest age is EXACTLY the max age in the fixture (${oldest} vs ${exp.oldestAtLeast}) — no tolerance, the clock is frozen`);
}

R.group('5 · the numbers track the feed, they are not constants');
const beforeChange = { ...readings[VIEWS[0]] };
POOL_N = 97;                       // a different pool: count, bytes and median all move
const exp2 = expected();
const after = {};
for (const id of VIEWS) {
  try {
    after[id] = await readView(p, id);
  } catch { after[id] = {}; }
}
R.ok(Number(after[VIEWS[0]].mempool) === exp2.mempool && exp2.mempool !== exp.mempool,
  `the count followed the feed (${beforeChange.mempool} -> ${after[VIEWS[0]].mempool}, expected ${exp2.mempool})`);
R.ok(Number(after[VIEWS[0]].bytes) === exp2.bytes,
  `the byte sum followed the feed (${beforeChange.bytes} -> ${after[VIEWS[0]].bytes}, expected ${exp2.bytes})`);
for (const k of ['mempool', 'bytes', 'median']) {
  const vals = VIEWS.filter((id) => k in after[id]).map((id) => after[id][k]);
  const distinct = [...new Set(vals)];
  R.ok(distinct.length === 1, `[${k}] still identical across ${vals.length} view(s) after the feed changed (${distinct.join(' ≠ ')})`);
}

await p.close();
await b.close();

// COMPLETION MARKER, emitted by the thing that completed — never by a caller.
console.log('\nVERIFY_MEMSTATS_COMPLETE');
process.exit(R.finish());
