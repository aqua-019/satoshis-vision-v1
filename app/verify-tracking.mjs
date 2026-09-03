// verify-tracking.mjs — the tracked transaction, on EVERY registered view.
//
// Required by docs/v6-mempool-views-spec.md:148-149:
//   "search a txid, assert the view highlights it, the chip persists across the
//    mempool → block transition, and depth counts 0→10."
//
// It did not exist. This is that gate, and it is VIEW-GENERIC by construction:
// the view list is read out of `src/views/mempool-meta.ts`, so every future
// view is swept the day it registers rather than the day someone remembers to
// add it. (p2·7b moved that list out of `src/views/index.tsx`, which cannot be
// read by `nav/ia.ts` under bare Node — see mempool-meta.ts's header.)
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
//
// ── p4·M10 · THE TRACKED TRANSACTION HAS AN ADDRESS ─────────────────────────
//
// `/live/mempool?v=<view>&tx=<64-hex>` — read and written inside
// useMempoolTracking (mempool-shared.tsx), which every view calls, so the
// address is view-generic by the same construction as everything above and is
// swept per view here: §2b asserts the typed search WRITES `tx=` with `v=`
// intact (the OBJECT form of setParams would drop `v=`, which is the bug
// routes/useUrlState.ts exists to prevent — break test M1 reds this line on
// every view), and §7 asserts a COLD navigation to the address opens the chip
// on the SAME transaction with nothing typed, that the view marks it in its
// own idiom from the URL alone, and that Clear tracked removes `tx=`, keeps
// `v=`, and REPLACES rather than pushes.
//
// §8, once, on classic, holds the semantics that do not vary by view: a
// malformed value is ABSENT (no chip, no panel, no error, nothing thrown, and
// the URL is left exactly as it was — a read never writes); a well-formed but
// unknown value reaches LiveTxDetail's own not-found panel, "Not returned by
// the node", which is what the fixture's 404 produces exactly as api/xmr.js:902
// does; a URL carrying BOTH `block=` and `tx=` opens the TRANSACTION in either
// order (precedence is one expression in MempoolPage.tsx, not an effect race)
// and a clear then drops BOTH keys; a typed track PUSHES exactly one history
// entry; Back/Forward walk the tracked transactions in order and re-target the
// chip each step; a view switch keeps `tx=` and the arriving view opens the
// chip; and a block search while a transaction is tracked drops the tx claim
// by a PUSH, so Back returns to the transaction.
//
// The `tx=` value the gate reads back is compared as a STRING against the txid
// it typed; the chip is compared on its first eight characters, which is
// `shortHash`'s prefix (data/types.ts:246).
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
// p2·7b: the id literals moved from views/index.tsx to views/mempool-meta.ts
// (index.tsx now binds components and derives MEMPOOL_VIEWS from that list).
// Same instrument, new subject — see mempool-meta.ts's header.
const REG = readFileSync(new URL('./src/views/mempool-meta.ts', import.meta.url), 'utf8');
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
/** A SECOND transaction the fixture answers (always pending), so §8 can walk a
 *  history of two tracked transactions. Never in the pool list — the chip and
 *  the URL are what §8 reads, not a per-view idiom. */
const TX2 = hex('7');
/** Well-formed and answered 404, so it reaches the not-found panel. */
const UNKNOWN_TX = hex('d');
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

const mkPendingTx = (txid) => ({
  txid, block_height: null, confirmed: false, status: 'pending',
  in_pool: true, fee: 30_720_000, blob_size: 1538, ring_size: 16, unlock_time: 0,
  rct_type: 6,
  inputs: [{ key_offsets: [1, 2, 3], key_image: hex('f') }],
  outputs: [{ stealth_address: hex('9'), view_tag: 'ab' }],
});
const mkTx = () => (txConfirmed
  ? {
    txid: TRACKED_TX, block_height: trackHeight, confirmed: true, status: 'confirmed',
    in_pool: false, block_timestamp: now() - 41, fee: 30_720_000, blob_size: 1538,
    ring_size: 16, unlock_time: 0, rct_type: 6,
    inputs: [{ key_offsets: [1, 2, 3], key_image: hex('f') }],
    outputs: [{ stealth_address: hex('9'), view_tag: 'ab' }],
  }
  : mkPendingTx(TRACKED_TX));

const PRICE = { monero: { usd: 168.4, usd_24h_change: 1.2, btc: 0.0026 }, bitcoin: { usd: 64800, usd_24h_change: 0.4 } };

function fulfil(route) {
  const url = route.request().url();
  const json = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  if (url.includes('/api/xmr/network')) return json(mkNetwork());
  if (url.includes('/api/xmr/mempool')) return json(mkMempool());
  if (url.includes('/api/xmr/tx/')) {
    // Per-txid, the way the real endpoint is: the tracked tx follows the state
    // machine, TX2 is always pending, and anything else is a 404 with an error
    // body — api/xmr.js:902's exact shape, which getJSON (http.ts:14) turns
    // into null and LiveTxDetail (tx-detail.tsx:129) into "Not returned by the
    // node". Before p4·M10 this line answered the tracked tx's detail for ANY
    // requested id, which no view exercised and §8b now does.
    const id = url.split('/api/xmr/tx/')[1].split(/[?#/]/)[0].toLowerCase();
    if (id === TRACKED_TX) return json(mkTx());
    if (id === TX2) return json(mkPendingTx(TX2));
    return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Transaction not found' }) });
  }
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

/* NON-VACUITY FLOOR. Every assertion in this gate lives inside `for (const id
   of VIEWS)`. An empty parse therefore does not turn this gate RED — it turns
   it GREEN with zero coverage, which reads in CI exactly like a clean sweep.
   The registry is a file this gate does not own and cannot stop from moving,
   so assert the subject exists before sweeping it. */
R.group('0 · the registry parse is non-vacuous');
R.ok(VIEWS.length > 0, `${VIEWS.length} views parsed from src/views/mempool-meta.ts`);

const chipPhase = (p) => p.$eval('[data-mem-track-phase]', (e) => e.getAttribute('data-mem-track-phase'));
const chipConf = (p) => p.$eval('[data-mem-track-phase]', (e) => +e.getAttribute('data-mem-track-conf'));
const chipText = (p) => p.$eval('[data-mem-track-phase]', (e) => (e.textContent || '').replace(/\s+/g, ' ').trim());
const chipCount = (p) => p.evaluate(() => document.querySelectorAll('[data-mem-track-phase]').length);
/** The rendered chip opens with shortHash(id), i.e. the txid's first eight. */
const SHORT = (id) => id.slice(0, 8);
const readQ = async (p) => new URLSearchParams(await p.evaluate(() => location.search));
/** Wait for `key` to read `val` in the URL, or to be ABSENT when `val` is null. */
const urlHas = (p, key, val) => p.waitForFunction(
  ([k, v]) => { const q = new URLSearchParams(location.search); return v == null ? !q.has(k) : q.get(k) === v; },
  [key, val], { timeout: 10000 },
).catch(() => {});
/** Wait for the chip to name `id` (first eight), so a re-target is observed, not assumed. */
const chipFor = (p, id) => p.waitForFunction(
  (pre) => (document.querySelector('[data-mem-track-phase]')?.textContent || '').trim().startsWith(pre),
  SHORT(id), { timeout: 10000 },
).catch(() => {});
const search = async (p, text) => {
  await p.fill('.mem-view input[type="text"]', text);
  await p.press('.mem-view input[type="text"]', 'Enter');
};
const CLEAR_BTN = '[data-mem-track-phase] button[aria-label="Clear tracked"]';

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

    /* §2b · p4·M10 — THE SEARCH WRITES THE ADDRESS. `tx=` names the typed
       txid and `v=` survives the write. The OBJECT form of setParams would
       drop `v=` — the exact bug routes/useUrlState.ts exists to prevent — and
       this is the assertion that reds under it (break test M1), on every view. */
    await urlHas(p, 'tx', TRACKED_TX);
    const q2 = await readQ(p);
    R.ok(q2.get('tx') === TRACKED_TX && q2.get('v') === id,
      `[${id}] §2b the search writes ?tx= and keeps ?v= (?${q2})`);

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

    /* §7 · p4·M10 — THE ADDRESS ROUND-TRIPS. The fixture is put back to the
       pending state and the SAME page navigates cold to ?v=<id>&tx=<tracked>:
       the chip must open on the SAME transaction with nothing typed, in the
       mempool phase at depth 0 — §2's reading, reached from the URL alone —
       and the view must mark it in its own idiom (the tx is back in the pool,
       so the per-view highlight has a subject). Clear tracked then removes
       `tx=`, keeps `v=`, and REPLACES: the history length must not move. */
    head = H;
    txConfirmed = false;
    trackHeight = null;
    await p.goto(`${base}/live/mempool?v=${id}&tx=${TRACKED_TX}`, { waitUntil: 'load' });
    await p.waitForSelector(`.mem-view[data-mem-view="${id}"]`, { timeout: 15000 });
    await p.waitForSelector('[data-mem-track-phase]', { timeout: 15000 });
    const coldId = (await chipText(p)).slice(0, 12);
    const coldPhase = await chipPhase(p);
    const coldConf = await chipConf(p);
    R.ok(coldId === idBefore,
      `[${id}] §7 a cold ?tx= opens the SAME transaction with nothing typed ("${coldId}" vs "${idBefore}")`);
    R.ok(coldPhase === 'mempool' && coldConf === 0,
      `[${id}] §7 and reads IN MEMPOOL at depth 0, as the typed search did (phase "${coldPhase}", conf ${coldConf})`);
    await p.waitForFunction(
      (v) => document.querySelectorAll(`[data-track-idiom="${v}"]`).length > 0
        || document.querySelectorAll('[data-tracked-tx]').length > 0,
      id, { timeout: 15000 },
    ).catch(() => {});
    const coldMarked = await p.evaluate((v) => ({
      idiom: document.querySelectorAll(`[data-track-idiom="${v}"]`).length,
      tracked: document.querySelectorAll('[data-tracked-tx]').length,
    }), id);
    R.ok(coldMarked.idiom > 0 || coldMarked.tracked > 0,
      `[${id}] §7 the view marks it in its own idiom from the URL alone (idiom ${coldMarked.idiom}, tracked ${coldMarked.tracked})`);
    const lenBefore = await p.evaluate(() => history.length);
    await p.click(CLEAR_BTN);
    await urlHas(p, 'tx', null);
    const cleared = await p.evaluate(() => ({ search: location.search, len: history.length }));
    const q7 = new URLSearchParams(cleared.search);
    R.ok(!q7.has('tx') && q7.get('v') === id,
      `[${id}] §7 Clear tracked removes tx= and keeps v= (?${q7})`);
    R.ok(cleared.len === lenBefore,
      `[${id}] §7 clearing REPLACES — history length ${lenBefore} → ${cleared.len}`);
    const chipsLeft = await chipCount(p);
    R.ok(chipsLeft === 0, `[${id}] §7 the chip is gone (${chipsLeft} left)`);
  } catch (e) {
    R.ok(false, `[${id}] tracking flow threw`, String(e).split('\n')[0]);
  }
  await p.close();
}

/* ── §8 · p4·M10 — the address's semantics, once, on classic ──────────────
   Each scenario gets a FRESH page so `history.length` and the URL start from
   a known state, and every page records `pageerror` so "degrades" can be told
   apart from "threw and happened to render". */
R.group('— §8 · the address: malformed, unknown, precedence, history, view switch, block —');
head = H;
txConfirmed = false;
trackHeight = null;

async function fresh(url) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e).split('\n')[0]));
  await p.route('**/api/**', fulfil);
  await p.goto(url, { waitUntil: 'load' });
  await p.waitForSelector('.mem-view[data-mem-view="classic"]', { timeout: 15000 });
  await p.waitForFunction(
    () => {
      const v = document.querySelector('[data-memstat][data-memstat-value]');
      return v && Number(v.getAttribute('data-memstat-value')) > 0;
    },
    null, { timeout: 15000 },
  ).catch(() => {});
  return { p, errors };
}

try {
  /* §8a · MALFORMED IS ABSENT. 63 hex characters: no chip, no detail panel,
     no error surface, nothing thrown, and the URL left exactly as it was —
     a read never writes. The 1s settle is for a late effect that might have
     opened something after first paint; it must find nothing to open. */
  {
    const bad = 'a'.repeat(63);
    const { p, errors } = await fresh(`${base}/live/mempool?v=classic&tx=${bad}`);
    await p.waitForTimeout(1000);
    const s = await p.evaluate(() => ({
      chips: document.querySelectorAll('[data-mem-track-phase]').length,
      detail: document.querySelectorAll('[data-mem-detail]').length,
      body: !!document.querySelector('[data-mem-body]'),
      notReturned: /Not returned by the node/.test(document.body.innerText),
      search: location.search,
    }));
    R.ok(s.chips === 0 && s.detail === 0,
      `§8a a 63-hex ?tx= is ABSENT — no chip, no detail panel (chips ${s.chips}, panels ${s.detail})`);
    R.ok(s.body && !s.notReturned,
      `§8a the page is the plain mempool — body mounted, no error surface`);
    R.ok(errors.length === 0,
      `§8a nothing threw (${errors.length} page error(s)${errors.length ? ': ' + errors[0] : ''})`);
    R.ok(s.search === `?v=classic&tx=${bad}`,
      `§8a a read never writes — the malformed value is left in the URL untouched (${s.search})`);
    await p.close();
  }

  /* §8b · WELL-FORMED BUT UNKNOWN reaches the not-found panel. The chip opens
     (the tracking exists; it is the NODE that has nothing), and the detail
     panel says so in LiveTxDetail's own words. */
  {
    const { p, errors } = await fresh(`${base}/live/mempool?v=classic&tx=${UNKNOWN_TX}`);
    await p.waitForSelector('[data-mem-track-phase]', { timeout: 15000 });
    await p.waitForFunction(
      () => /Not returned by the node/.test(document.querySelector('[data-mem-detail="tx"]')?.textContent || ''),
      null, { timeout: 15000 },
    ).catch(() => {});
    const s = await p.evaluate(() => ({
      chip: (document.querySelector('[data-mem-track-phase]')?.textContent || '').trim(),
      panel: document.querySelector('[data-mem-detail="tx"]')?.textContent || '',
    }));
    R.ok(s.chip.startsWith(SHORT(UNKNOWN_TX)),
      `§8b an unknown 64-hex ?tx= opens the chip on that txid ("${s.chip.slice(0, 12)}")`);
    R.ok(/Not returned by the node/.test(s.panel),
      `§8b and the detail panel is the not-found state, "Not returned by the node"`);
    R.ok(errors.length === 0, `§8b nothing threw (${errors.length} page error(s))`);
    await p.close();
  }

  /* §8c · PRECEDENCE, BOTH ORDERS. A URL carrying block= AND tx= opens the
     TRANSACTION — MempoolPage's one expression silences focusBlock — and a
     clear drops BOTH keys (the two clear writes compose on the same stale
     params and must agree). The 1.5s settle is where a late focusBlock effect
     would have flipped the slot to the block after first paint. The control
     proves the gate can still see a block deep link at all. */
  for (const [label, qs] of [
    ['block-then-tx', `block=${H}&tx=${TRACKED_TX}`],
    ['tx-then-block', `tx=${TRACKED_TX}&block=${H}`],
  ]) {
    const { p } = await fresh(`${base}/live/mempool?v=classic&${qs}`);
    await p.waitForSelector('[data-mem-track-phase]', { timeout: 15000 });
    await p.waitForTimeout(1500);
    const s = await p.evaluate(() => ({
      phase: document.querySelector('[data-mem-track-phase]')?.getAttribute('data-mem-track-phase'),
      chip: (document.querySelector('[data-mem-track-phase]')?.textContent || '').trim(),
      detail: document.querySelector('[data-mem-detail]')?.getAttribute('data-mem-detail') ?? 'none',
    }));
    R.ok(s.phase !== 'block' && s.detail === 'tx' && s.chip.startsWith(SHORT(TRACKED_TX)),
      `§8c ${label}: the TRANSACTION wins (phase "${s.phase}", panel "${s.detail}", chip "${s.chip.slice(0, 12)}")`);
    await p.click(CLEAR_BTN);
    await urlHas(p, 'tx', null);
    await p.waitForTimeout(300);
    const q = await readQ(p);
    R.ok(!q.has('tx') && !q.has('block') && q.get('v') === 'classic',
      `§8c ${label}: Clear tracked drops BOTH keys and keeps v= (?${q})`);
    await p.close();
  }
  {
    const { p } = await fresh(`${base}/live/mempool?v=classic&block=${H}`);
    await p.waitForSelector('[data-mem-track-phase]', { timeout: 15000 });
    await p.waitForTimeout(1500);
    const phase = await chipPhase(p);
    const qc = await readQ(p);
    R.ok(phase === 'block', `§8c control: ?block= alone still opens the block (phase "${phase}")`);
    /* The view's own focusBlock effect reaches onSearch({ kind: "block" }) by
       way of this deep link, so a block search that dropped `block=`
       unconditionally would make the link consume itself on arrival — the
       panel opens and the URL forgets why. This release's first cut did exactly
       that, and verify-nav §4a caught it where the phase check above could not:
       "opens" and "survives" are different claims. */
    R.ok(qc.get('block') === String(H),
      `§8c control: and the deep link SURVIVES its own arrival — block= is still in the URL (?${qc})`);
    await p.close();
  }

  /* §8d/§8e · PUSH, AND THE HISTORY WALK. Two typed tracks, two entries;
     Back re-targets the chip to the first, Back again to nothing, Forward
     twice walks back up. Each step waits for the URL AND for the chip, so a
     URL that moved without the state following it would red here. */
  {
    const { p, errors } = await fresh(`${base}/live/mempool?v=classic`);
    const len0 = await p.evaluate(() => history.length);
    await search(p, TRACKED_TX);
    await urlHas(p, 'tx', TRACKED_TX);
    await chipFor(p, TRACKED_TX);
    const len1 = await p.evaluate(() => history.length);
    R.ok(len1 === len0 + 1, `§8d a typed track PUSHES exactly one history entry (${len0} → ${len1})`);
    await search(p, TX2);
    await urlHas(p, 'tx', TX2);
    await chipFor(p, TX2);
    const len2 = await p.evaluate(() => history.length);
    const chip2 = await chipText(p);
    R.ok(len2 === len1 + 1 && chip2.startsWith(SHORT(TX2)),
      `§8d a second track pushes again and re-targets the chip (${len1} → ${len2}, "${chip2.slice(0, 12)}")`);

    await p.goBack();
    await urlHas(p, 'tx', TRACKED_TX);
    await chipFor(p, TRACKED_TX);
    const b1 = { q: await readQ(p), chip: await chipText(p) };
    R.ok(b1.q.get('tx') === TRACKED_TX && b1.chip.startsWith(SHORT(TRACKED_TX)),
      `§8e Back returns to the FIRST tracked transaction and the chip follows (?${b1.q}, "${b1.chip.slice(0, 12)}")`);

    await p.goBack();
    await urlHas(p, 'tx', null);
    await p.waitForFunction(() => document.querySelectorAll('[data-mem-track-phase]').length === 0, null, { timeout: 10000 }).catch(() => {});
    const b2 = { q: await readQ(p), chips: await chipCount(p) };
    R.ok(!b2.q.has('tx') && b2.q.get('v') === 'classic' && b2.chips === 0,
      `§8e Back again: the plain mempool, no tx= and no chip (?${b2.q}, chips ${b2.chips})`);

    await p.goForward();
    await urlHas(p, 'tx', TRACKED_TX);
    await chipFor(p, TRACKED_TX);
    const f1 = { q: await readQ(p), chip: await chipText(p) };
    R.ok(f1.q.get('tx') === TRACKED_TX && f1.chip.startsWith(SHORT(TRACKED_TX)),
      `§8e Forward re-tracks the first (?${f1.q}, "${f1.chip.slice(0, 12)}")`);

    await p.goForward();
    await urlHas(p, 'tx', TX2);
    await chipFor(p, TX2);
    const f2 = { q: await readQ(p), chip: await chipText(p) };
    R.ok(f2.q.get('tx') === TX2 && f2.chip.startsWith(SHORT(TX2)),
      `§8e Forward again re-tracks the second (?${f2.q}, "${f2.chip.slice(0, 12)}")`);
    R.ok(errors.length === 0, `§8e nothing threw across the walk (${errors.length} page error(s))`);
    await p.close();
  }

  /* §8f · A VIEW SWITCH KEEPS IT. `?v=` writes through useUrlState's functional
     form, so `tx=` survives by construction — asserted rather than assumed,
     with the arriving view's own hook opening the chip from the URL. */
  {
    const { p } = await fresh(`${base}/live/mempool?v=classic`);
    await search(p, TRACKED_TX);
    await urlHas(p, 'tx', TRACKED_TX);
    await p.click('.mp-switcher__trigger');
    await p.waitForSelector('.mp-switcher__list.is-open', { timeout: 10000 }).catch(() => {});
    await p.click('.mp-switcher__list button:has-text("Terminal")');
    await urlHas(p, 'v', 'terminal');
    await p.waitForSelector('.mem-view[data-mem-view="terminal"]', { timeout: 15000 });
    await p.waitForSelector('.mem-view[data-mem-view="terminal"] [data-mem-track-phase]', { timeout: 15000 }).catch(() => {});
    const q = await readQ(p);
    const chip = await p.evaluate(() => (document.querySelector('.mem-view[data-mem-view="terminal"] [data-mem-track-phase]')?.textContent || '').trim());
    R.ok(q.get('tx') === TRACKED_TX && q.get('v') === 'terminal',
      `§8f a view switch keeps tx= (?${q})`);
    R.ok(chip.startsWith(SHORT(TRACKED_TX)),
      `§8f and the arriving view opens the chip from the URL ("${chip.slice(0, 12)}")`);
    await p.close();
  }

  /* §8g · A BLOCK SEARCH DROPS THE TX CLAIM, BY A PUSH. The slot is a block
     now, so `tx=` must go (a URL claiming a transaction not on screen is the
     lie this feature must not tell) — and it goes as a history entry, so Back
     returns to the transaction that WAS the primary content. */
  {
    const { p } = await fresh(`${base}/live/mempool?v=classic`);
    await search(p, TRACKED_TX);
    await urlHas(p, 'tx', TRACKED_TX);
    await chipFor(p, TRACKED_TX);
    const len1 = await p.evaluate(() => history.length);
    await search(p, String(H));
    await p.waitForFunction(() => document.querySelector('[data-mem-track-phase]')?.getAttribute('data-mem-track-phase') === 'block', null, { timeout: 10000 }).catch(() => {});
    await urlHas(p, 'tx', null);
    const g = { q: await readQ(p), len: await p.evaluate(() => history.length), phase: await chipPhase(p) };
    R.ok(g.phase === 'block' && !g.q.has('tx') && g.q.get('v') === 'classic',
      `§8g a block search drops the tx claim and keeps v= (phase "${g.phase}", ?${g.q})`);
    R.ok(g.len === len1 + 1,
      `§8g and PUSHES, so the transaction stays in history (${len1} → ${g.len})`);
    await p.goBack();
    await urlHas(p, 'tx', TRACKED_TX);
    await chipFor(p, TRACKED_TX);
    const back = { q: await readQ(p), phase: await chipPhase(p), chip: await chipText(p) };
    R.ok(back.q.get('tx') === TRACKED_TX && back.phase !== 'block' && back.chip.startsWith(SHORT(TRACKED_TX)),
      `§8g Back returns to the tracked transaction (phase "${back.phase}", "${back.chip.slice(0, 12)}")`);
    await p.close();
  }
} catch (e) {
  R.ok(false, '§8 the address scenarios threw', String(e).split('\n')[0]);
}

await b.close();
head = H;

// COMPLETION MARKER, emitted by the thing that completed. A caller may report
// that it INVOKED this gate; only this line reports that it FINISHED. Paired
// with the exit code, per the conformance doc's rule — either alone is exactly
// what fails.
console.log('\nVERIFY_TRACKING_COMPLETE');
process.exit(R.finish());
