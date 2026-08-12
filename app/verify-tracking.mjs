// verify-tracking.mjs — the tracked transaction, on EVERY registered view.
//
// Required by docs/v6-mempool-views-spec.md:148-149:
//   "search a txid, assert the view highlights it, the chip persists across the
//    mempool → block transition, and depth counts 0→10."
//
// It did not exist. This is that gate, and it is VIEW-GENERIC by construction:
// the view list is read out of `src/views/index.tsx`, so every future view is
// swept the day it registers rather than the day someone remembers to add it.
//
// ── WHY THIS IS NOT A COPY OF verify-memviews SCENARIO 2 ───────────────────
//
// Scenario 2 asserts the idiom and that depth ADVANCES (4 → 6). It cannot
// assert the sentence the spec actually writes down, because its fixture serves
// the tracked tx as `confirmed: true` from the very first request — so the chip
// is born confirmed and **the mempool → block transition never happens in it**.
// "Persists across the transition" is checked there by a test that never sees
// the transition. That is the subject-narrower-than-the-claim family this repo
// catalogues, and it is why this gate drives the fixture through BOTH states:
//
//     phase "mempool"  conf 0   ->   phase "confirmed"  conf 1
//                               ->   phase "unlocked"   conf >= CONF_UNLOCK
//
// and asserts the chip is the SAME transaction throughout (the shortened txid
// is re-read at every step, so a chip that silently re-targeted would red).
//
// It also carries a POSITIVE CONTROL that scenario 2 has no room for: the
// per-view highlight must be ABSENT before the search. Eleven assertions in
// this suite install a condition and then assert an absence, which passes
// whether the condition worked, the selector died, or the element never
// existed; an idiom check with no before-reading is the same shape. Here the
// before-count is measured and required to be 0, so the after-count is a
// CHANGE rather than a state.
//
// ── THE CONFIRMATION-WAIT BOUND IS DERIVED, NOT COPIED ─────────────────────
//
// `usePolling.ts:45-47` — TIER_MS = { fast: 3_000, chain: 15_000, market: 60_000 }.
// A confirmation count is a CHAIN-tier reading: the tip watch runs every 15s and
// only pulls blocks in full when the tip has actually moved, and
// `live-detail.ts:110-120` re-fetches the tracked tx when the tip ADVANCES. So
// one confirmation step can cost one chain poll, and a step that needs the tip
// to move *and then* the tx to re-resolve can cost two:
//
//     2 x chain 15,000            = 30,000   the dependency
//     + 1 x fast 3,000            =  3,000   the render/commit settle after it
//     + 12,000 margin             = 45,000   <- CONF_WAIT_MS
//
// verify-memviews item 4 uses 25,000, which is BELOW its own 30,000 dependency;
// that is a known-too-small bound and is left as found here rather than changed
// from inside a different gate. This one exceeds its dependency with margin and
// says so, which is the whole point of writing the arithmetic down.
//
// Every wait in this file is a `waitForFunction`, so the bound is an upper limit
// on patience, never a sleep — a fast run does not pay it.
import { chromium, webkit } from 'playwright';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { makeReporter } from './verify-reporter.mjs';

const R = makeReporter('verify-tracking');
const base = 'http://localhost:4173';

/** Derived above from usePolling.ts's TIER_MS. Do not lower without redoing it. */
const CONF_WAIT_MS = 45_000;
/** Monero's unlock depth, mirrored from src/mempool/conf.ts's CONF_UNLOCK. */
const CONF_UNLOCK = 10;

function findChrome() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!existsSync(root)) return undefined;
  for (const d of readdirSync(root).filter((n) => n.startsWith('chromium-')).sort().reverse()) {
    const p = root + '/' + d + '/chrome-linux/chrome';
    if (existsSync(p)) return p;
  }
  return undefined;
}

// Views come from the registry, so this gate widens by itself as views land.
const REG = readFileSync(new URL('./src/views/index.tsx', import.meta.url), 'utf8');
const VIEWS = [...REG.matchAll(/\{\s*id:\s*"([a-z]+)"/g)].map((m) => m[1]);

/* ── fixture ──────────────────────────────────────────────────────────────
   Ages and timestamps are RELATIVE offsets resolved at request time, never
   absolute values baked at module load, so a view opened late in the sweep
   sees the same feed as the first one.

   `txConfirmed` is the state machine this gate exists to drive. It is read
   inside the route handler, so flipping it changes what the NEXT request
   answers — no page reload, exactly as a real mining event would behave. */
const H = 3_700_123;
const hex = (c) => c.repeat(64);
const TRACKED_TX = hex('a');
const now = () => Math.floor(Date.now() / 1000);

let head = H;                 // chain tip, advanced by the scenarios
let txConfirmed = false;      // false => the tx is still in the pool
let trackHeight = null;       // the height it lands in, set when it confirms

const POOL_N = 60;
const mkMempool = () => ({
  // The tracked tx is IN the pool only while unconfirmed — a node would not
  // report a mined transaction as pending, and a fixture that did would let a
  // view pass by reading the wrong surface.
  recent_txs: [
    ...(txConfirmed ? [] : [{
      txid: TRACKED_TX, blob_size: 1538, fee: 30_720_000, fee_rate: 480_000,
      receive_time: now() - 40, ring_size: 16, input_count: 2, output_count: 2,
    }]),
    ...Array.from({ length: POOL_N }, (_, i) => ({
      txid: (i.toString(16).padStart(4, '0') + 'c3f9a1e7b5d2').repeat(6).slice(0, 64),
      blob_size: 1200 + (i * 37) % 2400,
      fee: 30_720_000 + i * 1000,
      fee_rate: 15_000 + (i * 8117) % 900_000,
      receive_time: now() - (5 + (i * 13) % 1750),
      ring_size: 16, input_count: 1 + (i % 3), output_count: 2,
    })),
  ],
  fee_histogram: [{ tx_count: POOL_N, bytes: 400000 }],
});

const mkNetwork = () => ({
  height: head + 1, difficulty: 7.7e11, hashrate_ghs: 6.42, tx_pool_size: POOL_N,
  tx_count_total: 61_236_904, block_weight_limit: 600000, block_weight_median: 300000,
  target_seconds: 120, top_block_hash: hex('b'), alt_blocks_count: 1,
  version: '0.18.3.4', major_version: 16, fee_tiers: [20000, 80000, 320000, 4000000],
  randomx_seed_hash: hex('c'), database_size: 284_500_000_000, synchronized: true,
  nettype: 'mainnet', adjusted_time: now(),
});

const mkBlocks = () => Array.from({ length: 14 }, (_, i) => ({
  height: head - i, hash: hex('e'), tx_count: 3 + i, block_weight: 9000 + i * 800,
  reward: 0.6e12, difficulty: 7.7e11, timestamp: now() - 41 - i * 120, pool_name: 'P2Pool',
}));

const mkTx = () => (txConfirmed
  ? {
    txid: TRACKED_TX, block_height: trackHeight, confirmed: true, status: 'confirmed',
    in_pool: false, block_timestamp: now() - 41, fee: 30_720_000, blob_size: 1538,
    ring_size: 16, unlock_time: 0, rct_type: 6,
    inputs: [{ key_offsets: [1, 2, 3], key_image: hex('f') }],
    outputs: [{ stealth_address: hex('9'), view_tag: 'ab' }],
  }
  : {
    txid: TRACKED_TX, block_height: null, confirmed: false, status: 'pending',
    in_pool: true, fee: 30_720_000, blob_size: 1538, ring_size: 16, unlock_time: 0,
    rct_type: 6,
    inputs: [{ key_offsets: [1, 2, 3], key_image: hex('f') }],
    outputs: [{ stealth_address: hex('9'), view_tag: 'ab' }],
  });

const PRICE = { monero: { usd: 168.4, usd_24h_change: 1.2, btc: 0.0026 }, bitcoin: { usd: 64800, usd_24h_change: 0.4 } };

function fulfil(route) {
  const url = route.request().url();
  const json = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  if (url.includes('/api/xmr/network')) return json(mkNetwork());
  if (url.includes('/api/xmr/mempool')) return json(mkMempool());
  if (url.includes('/api/xmr/tx/')) return json(mkTx());
  if (url.includes('/api/xmr/block/')) return route.abort();
  if (url.includes('/api/xmr/decoys/')) return route.abort();
  if (url.includes('/api/xmr/blocks')) return json(mkBlocks());
  if (url.includes('/api/xmr/tip')) return json({ height: head + 1 });
  if (url.includes('/api/coingecko')) {
    if (url.includes('simple%2Fprice') || url.includes('simple/price')) return json(PRICE);
    return route.abort();
  }
  if (url.includes('/api/')) return json({});
  return route.continue();
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
console.log('verify-tracking — the tracked tx, on every registered view');
console.log(`engine: ${engine}`);
console.log(`views under test (${VIEWS.length}): ${VIEWS.join(', ')}`);
console.log(`confirmation-wait bound: ${CONF_WAIT_MS} ms (derived — see header)\n`);

const chipPhase = (p) => p.$eval('[data-mem-track-phase]', (e) => e.getAttribute('data-mem-track-phase'));
const chipConf = (p) => p.$eval('[data-mem-track-phase]', (e) => +e.getAttribute('data-mem-track-conf'));
const chipText = (p) => p.$eval('[data-mem-track-phase]', (e) => (e.textContent || '').replace(/\s+/g, ' ').trim());

for (const id of VIEWS) {
  R.group(`— ${id} —`);
  // Fresh chain and fresh tx state per view, so no view inherits another's
  // progress and each one is measured from the same starting position.
  head = H;
  txConfirmed = false;
  trackHeight = null;

  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.route('**/api/**', fulfil);
  try {
    await p.goto(`${base}/live/mempool?v=${id}`, { waitUntil: 'load' });
    await p.waitForSelector(`.mem-view[data-mem-view="${id}"]`, { timeout: 15000 });
    await p.waitForFunction(
      () => {
        const v = document.querySelector('[data-memstat][data-memstat-value]');
        return v && Number(v.getAttribute('data-memstat-value')) > 0;
      },
      { timeout: 15000 },
    ).catch(() => {});

    /* §1 · POSITIVE CONTROL — the highlight is absent before the search.
       Without this the idiom assertion below cannot tell "the view drew a
       highlight" from "this selector matches something the view always
       renders". */
    const before = await p.evaluate((v) => ({
      idiom: document.querySelectorAll(`[data-track-idiom="${v}"]`).length,
      marked: document.querySelectorAll('[data-tracked-tx]').length,
      chips: document.querySelectorAll('[data-mem-track-phase]').length,
    }), id);
    R.ok(before.idiom === 0 && before.marked === 0 && before.chips === 0,
      `[${id}] §1 nothing is marked before the search (idiom ${before.idiom}, tracked ${before.marked}, chips ${before.chips})`);

    /* §2 · SEARCH — and the chip must report the MEMPOOL phase, not a
       confirmed one. This is the state verify-memviews' fixture cannot
       produce. */
    await p.fill('.mem-view input[type="text"]', TRACKED_TX);
    await p.press('.mem-view input[type="text"]', 'Enter');
    await p.waitForSelector('[data-mem-track-phase]', { timeout: 15000 });

    const phase0 = await chipPhase(p);
    const conf0 = await chipConf(p);
    R.ok(phase0 === 'mempool' && conf0 === 0,
      `[${id}] §2 the chip opens IN MEMPOOL at depth 0 (phase "${phase0}", conf ${conf0})`);

    /* §3 · THE VIEW'S OWN IDIOM. The shell never draws a per-view highlight,
       so `data-track-idiom` can only have come from the view (MemTxTable
       stamps it for the canvas-only views, which is the documented fallback). */
    const marked = await p.evaluate((v) => ({
      idiom: document.querySelectorAll(`[data-track-idiom="${v}"]`).length,
      tracked: [...document.querySelectorAll('[data-tracked-tx]')].map((e) => e.getAttribute('data-tracked-tx')),
    }), id);
    R.ok(marked.idiom > 0 || marked.tracked.length > 0,
      `[${id}] §3 the view marks it in its own idiom (idiom ${marked.idiom}, data-tracked-tx ${marked.tracked.length}) — was 0/0 before`);
    if (marked.tracked.length) {
      R.ok(marked.tracked.every((t) => t && TRACKED_TX.startsWith(t.slice(0, 8))),
        `[${id}] §3 every data-tracked-tx names the SEARCHED txid, not just some tx`);
    }

    /* §4 · THE MEMPOOL -> BLOCK TRANSITION. Flip the fixture and move the tip;
       the tracked tx re-resolves through live-detail.ts's tip-advance effect. */
    const idBefore = (await chipText(p)).slice(0, 12);
    txConfirmed = true;
    head += 1;
    trackHeight = head;
    await p.waitForFunction(
      () => document.querySelector('[data-mem-track-phase]')?.getAttribute('data-mem-track-phase') === 'confirmed',
      { timeout: CONF_WAIT_MS },
    );
    const phase1 = await chipPhase(p);
    const conf1 = await chipConf(p);
    const idAfter = (await chipText(p)).slice(0, 12);
    R.ok(phase1 === 'confirmed' && conf1 >= 1,
      `[${id}] §4 survives mempool -> block: phase "${phase0}" -> "${phase1}", conf ${conf0} -> ${conf1}`);
    R.ok(idAfter === idBefore,
      `[${id}] §4 it is the SAME transaction across the transition ("${idBefore}" -> "${idAfter}")`);

    /* §5 · DEPTH 0 -> CONF_UNLOCK. Advancing by CONF_UNLOCK - 1 in one step
       means a single chain poll carries the count across the whole ladder,
       including the UNLOCK boundary — which a 2-block advance never reaches. */
    head += CONF_UNLOCK - 1;
    await p.waitForFunction(
      (n) => +document.querySelector('[data-mem-track-phase]')?.getAttribute('data-mem-track-conf') >= n,
      CONF_UNLOCK, { timeout: CONF_WAIT_MS },
    );
    const conf2 = await chipConf(p);
    const phase2 = await chipPhase(p);
    R.ok(conf2 >= CONF_UNLOCK,
      `[${id}] §5 depth counts 0 -> ${CONF_UNLOCK} (0 -> ${conf1} -> ${conf2})`);
    R.ok(phase2 === 'unlocked',
      `[${id}] §5 and crosses the unlock boundary (phase "${phase2}")`);

    /* §6 · The body is still mounted. Tracking DOCKS a detail panel; it must
       never replace the view — the contract's keepBodyWhileTracking rule. */
    const bodyUp = await p.$('.mem-view [data-mem-body]');
    R.ok(!!bodyUp, `[${id}] §6 the view body stays mounted while tracking (detail docks, does not replace)`);
  } catch (e) {
    R.ok(false, `[${id}] tracking flow threw`, String(e).split('\n')[0]);
  }
  await p.close();
}

await b.close();
head = H;

// COMPLETION MARKER, emitted by the thing that completed. A caller may report
// that it INVOKED this gate; only this line reports that it FINISHED. Paired
// with the exit code, per the conformance doc's rule — either alone is exactly
// what fails.
console.log('\nVERIFY_TRACKING_COMPLETE');
process.exit(R.finish());
