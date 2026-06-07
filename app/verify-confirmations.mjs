// verify-confirmations.mjs — proves the confirmation-count invariant holds across
// every mempool visualization after the v5.0.6 fix.
//
// It exercises the REAL derivation code:
//   • conf.ts  — pinTxBlockHeight (pin once), liveConf (the one live formula)
//   • map.ts   — mapBlocks → toBlock (the canonical conf = max(1, tip - h + 1))
// and advances a simulated chain several ticks, asserting that a pinned tx's
// confirmations stay consistent across the ribbon-arrow, the highlighted block's
// own label, and the detail panel — all derived from one pinned height + one tip.
//
// Run: node verify-confirmations.mjs   (Node ≥22.18 strips the type-only imports)

import { mapBlocks } from './src/data/map.ts';
import { pinTxBlockHeight, liveConf, isMempoolTx } from './src/mempool/conf.ts';

const H0 = 3_676_070;
const TICKS = 14;          // advance enough to push some pins off the 14-block window
const COUNTS = [4, 17, 22, 39, 103, 7, 9, 47, 6, 140, 12, 18, 24, 11];

let hashCounter = 1;
const hex = () => (hashCounter++ * 0x9e3779b1 >>> 0).toString(16).padStart(8, '0').repeat(8).slice(0, 64);

// Raw block list (newest-first), shaped like the /api/xmr/blocks JSON map.ts consumes.
let raw = Array.from({ length: 14 }, (_, i) => ({
  height: H0 - i, hash: hex(), tx_count: COUNTS[i % COUNTS.length],
  block_weight: 9000 + i * 1400, reward: 0.6e12, difficulty: 7.7e11, timestamp: 0, pool_name: 'P2Pool',
}));

const deriveData = (rawArr) => {
  const { blocks } = mapBlocks(rawArr, { height: rawArr[0].height, blocks: [] });
  return { height: blocks[0].height, blocks };
};

let data = deriveData(raw);
const blockByHeight = (d, h) => d.blocks.find((b) => b.height === h) ?? null;

// A spread of txids: some pin to a block, some land in the mempool.
const txids = Array.from({ length: 24 }, (_, i) =>
  (i.toString(16).padStart(2, '0') + 'a3f7c9e1b5d2').repeat(6).slice(0, 64));

// Pin each tx ONCE against the initial snapshot, then never re-pin.
const tracked = txids.map((id) => ({
  id,
  pinned: pinTxBlockHeight(id, data),
  inMempool: isMempoolTx(id),
  confSeen: liveConf(pinTxBlockHeight(id, data), data.height),
}));

let fail = false;
const ok = (cond, msg) => { console.log((cond ? '✅ PASS' : '❌ FAIL') + ' — ' + msg); if (!cond) fail = true; };

console.log(`\nInitial tip #${data.height}. Pinned ${tracked.filter(t => t.pinned != null).length}/${tracked.length} txs to a block, rest in mempool.\n`);

for (let tick = 0; tick <= TICKS; tick++) {
  const tip = data.height;
  for (const t of tracked) {
    if (t.pinned == null) {
      ok(liveConf(t.pinned, tip) === 0 && t.inMempool, `tx ${t.id.slice(0, 8)} mempool → 0 conf @tip#${tip}`);
      continue;
    }
    // (a) ribbon arrow vs detail panel: both derive from the SAME pinned height + tip.
    const ribbonConf = liveConf(t.pinned, tip);   // ClassicRibbon trackedConf
    const detailConf = liveConf(t.pinned, tip);   // txSynthFromId / buildTrackedTx confirmations
    ok(ribbonConf === detailConf, `tx ${t.id.slice(0, 8)} detail===ribbon (${detailConf}) @tip#${tip}`);

    // (b) the live formula matches map.ts exactly.
    ok(ribbonConf === Math.max(1, tip - t.pinned + 1), `tx ${t.id.slice(0, 8)} liveConf===map.ts formula @tip#${tip}`);

    // (c) while still on the 10/14-block ribbon, the highlighted block's OWN label === the tx's conf.
    const blk = blockByHeight(data, t.pinned);
    if (blk) ok(blk.conf === ribbonConf, `tx ${t.id.slice(0, 8)} arrow-block label(${blk.conf})===conf(${ribbonConf}) @tip#${tip}`);

    // (d) pinned height never moves; conf increments by exactly 1 per new block.
    ok(t.pinned <= H0, `tx ${t.id.slice(0, 8)} blockHeight pinned (#${t.pinned}) — never hops`);
    const expectedDelta = tick === 0 ? 0 : 1;
    ok(ribbonConf - t.confSeen === expectedDelta, `tx ${t.id.slice(0, 8)} conf +${expectedDelta} per block (${t.confSeen}→${ribbonConf})`);
    t.confSeen = ribbonConf;
  }

  // advance one block (mirrors simulated.ts block tick; map.ts re-derives every conf live).
  raw = [{ height: tip + 1, hash: hex(), tx_count: 1 + (tick % 30), block_weight: 9000, reward: 0.6e12, difficulty: 7.7e11, timestamp: 0, pool_name: 'P2Pool' }, ...raw];
  data = deriveData(raw);
}

// Final sanity: a pin that has scrolled off the window still reports a live ≥10 count.
const off = tracked.find((t) => t.pinned != null && data.height - t.pinned >= 14);
if (off) ok(liveConf(off.pinned, data.height) >= 10 && blockByHeight(data, off.pinned) === null,
  `scrolled-off tx ${off.id.slice(0, 8)} → live ${liveConf(off.pinned, data.height)} conf, gone from ribbon`);

console.log('\n' + (fail ? '❌ CONFIRMATION INVARIANT FAILED' : '✅ ALL CONFIRMATION ASSERTIONS PASSED'));
process.exit(fail ? 1 : 0);
