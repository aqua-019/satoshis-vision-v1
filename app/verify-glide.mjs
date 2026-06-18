// verify-glide.mjs — smooth block-glide gate for v5.0.16.
//
// Drives the BUILT app (vite preview @ :4173) with the network mocked at the page
// level, proving the FLIP ribbon glide is keyed to the BLOCK LIST (chainTip =
// data.blocks[0].height) and not to get_info (data.height). The glide must fire
// exactly once per real block — existing tiles slide (FLIP) and the new head runs
// the `glide-enter-kf` keyframe — never popping in, never gliding on a no-op tick.
//
// Detection is EVENT-based (never frame-sampled getComputedStyle): we count
//   • transitionrun/transitionstart for `transform` on [data-glide-key] → FLIP play
//   • animationstart for `glide-enter-kf`                               → head enter
// captured on document, so the assertions don't depend on catching a single frame.
//
// Scenarios (classic + reactor):
//   1. blocks-only advance  — head H→H+1 with get_info height UNCHANGED. The glide
//      MUST fire. This is the load-bearing discriminator: pre-fix the dep was
//      data.height (unchanged here) so the effect never ran and the block popped
//      (FAILS pre-fix); post-fix the dep is chainTip=blocks[0].height (changed) so
//      the glide fires (PASSES). Reproduces the documented bug's second half.
//   2. get_info-only bump   — data.height++ with blocks UNCHANGED → NO glide (a
//      height tick alone must never animate the unchanged ribbon).
//   3. combined advance     — head + get_info both advance (realistic) → glide fires.
//   4. reduced motion       — blocks advance under prefers-reduced-motion → NO glide
//      (snap), but the new head still renders.
//   5. tracked ▲ rides along — type a confirmed txid, the ▲ lands on its block tile;
//      after an advance it is STILL a child of that same tile (no detach, no hop)
//      and its conf badge counts up from chainTip (4/10 → 5/10).
//
// Run: npm run build && (npm run preview &) && sleep 2 && node verify-glide.mjs
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
if (engine !== 'chromium') {
  // transitionrun/animationstart semantics are most reliable on chromium; webkit
  // is only a launch fallback. Warn so a webkit run isn't read as authoritative.
  console.log('⚠️  running on webkit fallback — transition-event timing may differ');
}

let fail = false;
const ok = (cond, msg) => { console.log((cond ? '✅ ' : '❌ ') + msg); if (!cond) fail = true; };

/* ── fixtures (shapes mirror real /api responses; see data/map.ts, detail-map.ts) ── */
const H0 = 3_700_123;            // baseline head block AND get_info height
const TRACK_H = H0 - 3;          // the tracked tx's (fixed) confirmed block — 4th tile
const nowSec = Math.floor(Date.now() / 1000);
const hex = (c) => c.repeat(64);
const TXID = hex('f');

let curHead = H0;                // moves with block advances
let curInfoH = H0;               // moves with get_info bumps (independently)

function mkBlocks(headHeight) {
  return Array.from({ length: 12 }, (_, i) => ({
    height: headHeight - i, hash: hex('e'), tx_count: 3 + i, block_weight: 9000 + i * 800,
    reward: 0.6e12, difficulty: 7.7e11, timestamp: nowSec - 60 - i * 120, pool_name: 'Unknown',
  }));
}

const baseNetwork = {
  difficulty: 7.7e11, hashrate_ghs: 6.42, tx_pool_size: 2, tx_count_total: 61_236_904,
  block_weight_limit: 600000, block_weight_median: 300000, target_seconds: 120,
  top_block_hash: hex('b'), alt_blocks_count: 1, version: '0.18.3.4', major_version: 16,
  fee_tiers: [20000, 80000, 320000, 4000000], randomx_seed_hash: hex('c'),
  database_size: 284_500_000_000, synchronized: true, nettype: 'mainnet', adjusted_time: nowSec,
};

const FIX = {
  network: { ...baseNetwork, height: H0 },
  info: { result: { height: H0, difficulty: 7.7e11, target: 120, major_version: 16, top_block_hash: hex('b') } },
  mempool: { recent_txs: [
    { txid: hex('a'), blob_size: 1538, fee: 30_720_000, fee_rate: 19_974, receive_time: nowSec - 30, ring_size: 16, input_count: 1, output_count: 2 },
    { txid: hex('d'), blob_size: 2210, fee: 44_200_000, fee_rate: 20_000, receive_time: nowSec - 95, ring_size: 16, input_count: 2, output_count: 2 },
  ], fee_histogram: [{ tx_count: 2, bytes: 3748 }] },
  blocks: mkBlocks(H0),
  price: { monero: { usd: 321.45, usd_24h_change: 1.23 }, bitcoin: { usd: 97_000, usd_24h_change: -0.4 } },
  // Confirmed tx pinned to TRACK_H (full ApiTxDetail so LiveTxDetail reaches "ready").
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

function resetFix() {
  curHead = H0; curInfoH = H0;
  FIX.network = { ...baseNetwork, height: H0 };
  FIX.info = { result: { height: H0, difficulty: 7.7e11, target: 120, major_version: 16, top_block_hash: hex('b') } };
  FIX.blocks = mkBlocks(H0);
  FIX.tx = { ...FIX.tx, block_height: TRACK_H, confirmed: true, status: 'confirmed', in_pool: false };
}

function bumpInfoHeightOnly() {            // data.height ++, blocks UNCHANGED → chainTip steady
  curInfoH += 1;
  FIX.network = { ...FIX.network, height: curInfoH };
  FIX.info = { result: { ...FIX.info.result, height: curInfoH } };
}
function advanceBlocksOnly() {             // head ++, get_info height UNCHANGED → the discriminator
  curHead += 1;
  FIX.blocks = mkBlocks(curHead);
}
function advanceCombined() {               // both advance together (realistic poll)
  curHead += 1; curInfoH = curHead + 1;
  FIX.blocks = mkBlocks(curHead);
  FIX.network = { ...FIX.network, height: curInfoH };
  FIX.info = { result: { ...FIX.info.result, height: curInfoH } };
}

function fulfil(route) {
  const url = route.request().url();
  const json = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  if (url.includes('/api/monero')) return json(FIX.info);
  if (url.includes('/api/xmr/network')) return json(FIX.network);
  if (url.includes('/api/xmr/mempool')) return json(FIX.mempool);
  if (url.includes('/api/xmr/tx/')) return json(FIX.tx);
  if (url.includes('/api/xmr/block/')) return route.abort();   // block detail: not exercised
  if (url.includes('/api/xmr/decoys/')) return route.abort();  // lazy; never expanded here
  if (url.includes('/api/xmr/blocks')) return json(FIX.blocks);
  if (url.includes('/api/coingecko')) {
    if (url.includes('simple%2Fprice') || url.includes('simple/price')) return json(FIX.price);
    return route.abort();
  }
  return route.abort();
}

/* ── glide event spy (installed in page context before each advance) ── */
async function installGlideSpy(p) {
  await p.evaluate(() => {
    const w = window;
    w.__glide = { flip: 0, enter: 0, enterKeys: [] };
    const isTile = (t) => t instanceof Element && t.matches('[data-glide-key]');
    document.addEventListener('transitionrun', (e) => {
      if (e.propertyName === 'transform' && isTile(e.target)) w.__glide.flip++;
    }, true);
    document.addEventListener('transitionstart', (e) => {
      if (e.propertyName === 'transform' && isTile(e.target)) w.__glide.flip++;
    }, true);
    document.addEventListener('animationstart', (e) => {
      if (e.animationName === 'glide-enter-kf') {
        w.__glide.enter++;
        const t = e.target;
        w.__glide.enterKeys.push(t && t.getAttribute ? t.getAttribute('data-glide-key') : null);
      }
    }, true);
  });
}
const readGlide = (p) => p.evaluate(() => window.__glide);
const resetGlide = (p) => p.evaluate(() => { const g = window.__glide; g.flip = 0; g.enter = 0; g.enterKeys = []; });
const waitHead = (p, h) => p.waitForFunction((x) => !!document.querySelector(`[data-glide-key="${x}"]`), h, { timeout: 9000 });
const POLL = 3200; // > feed POLL_MS (2500) so a mutation is guaranteed to be picked up

/* ── Scenarios 1–3: glide trigger discrimination, per view ── */
for (const v of ['classic', 'reactor']) {
  resetFix();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.route('**/api/**', fulfil);
  await p.goto(`${base}/mempool?v=${v}`, { waitUntil: 'load' });
  await p.waitForSelector('[data-glide-key]', { timeout: 9000 });
  await waitHead(p, H0);
  await installGlideSpy(p);
  await p.waitForTimeout(POLL);   // let the hook record its first-frame positions (prev.size>0)
  await resetGlide(p);

  // (2) get_info-only bump → NO glide
  bumpInfoHeightOnly();
  await p.waitForTimeout(POLL);
  let g = await readGlide(p);
  ok(g.flip === 0 && g.enter === 0,
    `${v}: get_info height bump alone does NOT glide (flip=${g.flip}, enter=${g.enter})`);

  // (1) blocks-only advance → MUST glide (FLIP + head enter). The discriminator.
  await resetGlide(p);
  let oldHead = curHead;
  advanceBlocksOnly();            // head → oldHead+1, get_info height unchanged
  await waitHead(p, oldHead + 1);
  await p.waitForTimeout(700);
  g = await readGlide(p);
  ok(g.flip > 0, `${v}: blocks-only advance runs a transform transition on existing tiles (FLIP, flip=${g.flip})`);
  ok(g.enter > 0, `${v}: blocks-only advance plays glide-enter-kf on the new head (enter=${g.enter})`);
  ok(g.enterKeys.includes(String(oldHead + 1)),
    `${v}: the glide-enter tile is the NEW head #${oldHead + 1}`);

  // (3) combined advance → also glides (sanity for the normal poll path)
  await resetGlide(p);
  oldHead = curHead;
  advanceCombined();
  await waitHead(p, oldHead + 1);
  await p.waitForTimeout(700);
  g = await readGlide(p);
  ok(g.flip > 0 && g.enter > 0, `${v}: combined tip+block advance glides (flip=${g.flip}, enter=${g.enter})`);

  await p.close();
}

/* ── Scenario 4: reduced motion → snap (no events), new head still renders ── */
{
  resetFix();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await p.route('**/api/**', fulfil);
  await p.goto(`${base}/mempool?v=classic`, { waitUntil: 'load' });
  await p.waitForSelector('[data-glide-key]', { timeout: 9000 });
  await waitHead(p, H0);
  await installGlideSpy(p);
  await p.waitForTimeout(POLL);
  await resetGlide(p);

  const oldHead = curHead;
  advanceBlocksOnly();
  await waitHead(p, oldHead + 1);
  await p.waitForTimeout(700);
  const g = await readGlide(p);
  ok(g.flip === 0, `reduced-motion: NO transform transition (flip=${g.flip}) — snap`);
  ok(g.enter === 0, `reduced-motion: NO glide-enter animation (enter=${g.enter}) — snap`);
  ok(await p.evaluate((h) => !!document.querySelector(`[data-glide-key="${h}"]`), oldHead + 1),
    `reduced-motion: new head #${oldHead + 1} still renders (snapped into place)`);
  await p.close();
}

/* ── Scenario 5: tracked ▲ rides along (search a confirmed txid, then advance) ── */
for (const v of ['classic', 'reactor']) {
  resetFix();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.route('**/api/**', fulfil);
  await p.goto(`${base}/mempool?v=${v}`, { waitUntil: 'load' });
  await p.waitForSelector('[data-glide-key]', { timeout: 9000 });
  await waitHead(p, H0);

  const input = await p.waitForSelector('input[type="text"]', { timeout: 9000 });
  await input.fill(TXID);
  await input.press('Enter');

  // ▲ resolves (via mocked /api/xmr/tx) onto its pinned tile #TRACK_H
  await p.waitForFunction((h) => {
    const t = document.querySelector(`[data-glide-key="${h}"]`);
    return !!t && t.textContent.includes('▲');
  }, TRACK_H, { timeout: 9000 }).catch(() => {});
  let here = await p.evaluate((h) => {
    const t = document.querySelector(`[data-glide-key="${h}"]`);
    return !!t && t.textContent.includes('▲');
  }, TRACK_H);
  ok(here, `${v}: tracked ▲ renders inside its block tile #${TRACK_H}`);
  // conf badge before advance: chainTip H0 → confOf(TRACK_H) = H0-(H0-3)+1 = 4
  let badge4 = await p.evaluate((h) => {
    const t = document.querySelector(`[data-glide-key="${h}"]`);
    return t ? /\b4\s*\/\s*10\b/.test(t.textContent) : false;
  }, TRACK_H);
  ok(badge4, `${v}: tracked badge reads 4/10 before advance (counts from chainTip)`);

  // advance the chain — pinned tile shifts one slot; the ▲ (its child) must ride along
  const oldHead = curHead;
  advanceBlocksOnly();
  await waitHead(p, oldHead + 1);
  await p.waitForTimeout(900); // let the glide settle (inline transform cleared)

  here = await p.evaluate((h) => {
    const t = document.querySelector(`[data-glide-key="${h}"]`);
    return !!t && t.textContent.includes('▲');
  }, TRACK_H);
  ok(here, `${v}: after advance, tracked ▲ is STILL a child of tile #${TRACK_H} (rode along, no detach/hop)`);
  let badge5 = await p.evaluate((h) => {
    const t = document.querySelector(`[data-glide-key="${h}"]`);
    return t ? /\b5\s*\/\s*10\b/.test(t.textContent) : false;
  }, TRACK_H);
  ok(badge5, `${v}: tracked badge counts up to 5/10 after advance (live confOf off chainTip)`);

  await p.close();
}

await b.close();
console.log(fail ? '\n❌ verify-glide FAILED' : '\n✅ verify-glide: all scenarios passed');
process.exit(fail ? 1 : 0);
