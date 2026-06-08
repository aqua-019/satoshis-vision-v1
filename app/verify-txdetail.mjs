// verify-txdetail.mjs — proves the tx/block detail mappers produce REAL fields
// from a sample monerod-shaped response, that confirmations come from the ONE
// confOf accessor (fed the real node height → matches a public explorer), and
// that amounts are NEVER materialised (RingCT hidden).
//
// Exercises the REAL mapper code:
//   • detail-map.ts — mapTxDetail / mapBlockDetail / mapDecoys (pure, React-free)
//   • conf.ts       — confOf / chainTip (the single confirmation truth)
//
// Run: node verify-txdetail.mjs   (Node ≥22.18 strips the type-only imports)

import { mapTxDetail, mapBlockDetail, mapDecoys, txBlockHeight } from "./src/mempool/detail-map.ts";
import { confOf, chainTip } from "./src/mempool/conf.ts";

// mapTxDetail/mapBlockDetail take a confirmations value the CALLER computes via
// confOf — so confOf stays the single confirmation formula. These helpers mirror
// exactly what the live hooks do.
const txConf = (api) => confOf(txBlockHeight(api), data);

let fail = false;
const ok = (cond, msg) => { console.log((cond ? "✅ PASS" : "❌ FAIL") + " — " + msg); if (!cond) fail = true; };

// A live snapshot: tip is the newest CONFIRMED block (blocks[0].height); get_info
// height = newest + 1 (modelled so confOf must count from the newest block).
const TIP = 3_242_010;
const data = {
  height: TIP + 1,
  blocks: Array.from({ length: 14 }, (_, i) => ({
    height: TIP - i, hash: "h" + (TIP - i), txs: 10, sizeKB: 12, reward: 0.6,
    difficulty: 3e11, pool: "Unknown", age: i * 120, conf: i + 1,
  })),
};

console.log("\n— tx mapper (confirmed) —\n");

// A confirmed tx the node returned (size REAL from as_hex via the backend; here
// the backend already computed blob_size = 1853, NOT the old 1847 constant).
const CONF_H = TIP - 3; // 3 blocks deep
const apiTx = {
  txid: "a".repeat(64),
  status: "confirmed", confirmed: true, in_pool: false,
  block_height: CONF_H, block_hash: "b".repeat(64), block_timestamp: Math.floor(Date.now() / 1000) - 600,
  confirmations: 999, // node's own count — we IGNORE it and use confOf instead
  receive_time: null,
  blob_size: 1853, fee: 30580000, fee_rate: 16.5,
  ring_size: 16, rct_type: 6, has_view_tags: true, unlock_time: 0,
  output_count: 2, input_count: 2, version: 2,
  inputs: [
    { key_image: "c".repeat(64), ring_member_count: 16, key_offsets: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] },
    { key_image: "d".repeat(64), ring_member_count: 16, key_offsets: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2] },
  ],
  outputs: [
    { stealth_key: "e".repeat(64), view_tag: "aa" },
    { stealth_key: "f".repeat(64), view_tag: "bb" },
  ],
  extra_hex: "01" + "00".repeat(32),
};

const tx = mapTxDetail(apiTx, txConf(apiTx));
ok(tx.sizeBytes === 1853, `size is REAL passthrough (1853, not the 1847 fallback) — got ${tx.sizeBytes}`);
ok(tx.fee === 30580000 / 1e12, `fee converted piconero→XMR — got ${tx.fee}`);
ok(tx.feePerB === 16.5, `fee/B real passthrough — got ${tx.feePerB}`);
ok(tx.ringSize === 16, `ring size real — got ${tx.ringSize}`);
ok(tx.inputs.length === 2 && tx.outputs.length === 2, `input/output counts real (${tx.inputs.length}/${tx.outputs.length})`);
ok(tx.blockHeight === CONF_H, `block height is the REAL node height (${tx.blockHeight})`);
ok(tx.confirmations === confOf(CONF_H, data), `confirmations come from confOf — got ${tx.confirmations}`);
ok(tx.confirmations === TIP - CONF_H + 1, `confirmations == tip - height + 1 = ${TIP - CONF_H + 1} (matches a public explorer)`);
ok(tx.confirmations !== apiTx.confirmations, `the node's own confirmations field is NOT used (no second derivation)`);
ok(tx.inputs[0].keyImage === "c".repeat(64) && tx.inputs[0].keyOffsets.length === 16, `key_image + key_offsets real`);
ok(tx.outputs[0].stealthKey === "e".repeat(64) && tx.outputs[0].viewTag === "aa", `stealth key + view tag real`);
ok(!("weight" in tx), `no fabricated weight field (node returns none)`);

// AMOUNTS HIDDEN — the single most important honesty invariant.
const txJson = JSON.stringify(tx);
ok(!/"amount"/.test(txJson) && !/amount_commitment/.test(txJson) && !/privacy_score/.test(txJson),
  `no amount / amount_commitment / privacy_score key anywhere in the tx view`);
ok(tx.outputs.every((o) => !("amount" in o)), `no output carries a numeric amount`);

console.log("\n— tx mapper (mempool) —\n");

const apiMem = { ...apiTx, status: "mempool", confirmed: false, in_pool: true, block_height: null, block_hash: null, receive_time: Math.floor(Date.now() / 1000) - 30 };
const memTx = mapTxDetail(apiMem, txConf(apiMem));
ok(memTx.inMempool === true, `in_pool → inMempool true`);
ok(memTx.blockHeight === null, `mempool tx has null block height`);
ok(memTx.confirmations === 0, `mempool tx → 0 confirmations (confOf null)`);
ok(memTx.firstSeen != null, `mempool first-seen from real receive_time`);

console.log("\n— tx mapper (missing size → honest null, never 1847) —\n");

const apiNoSize = { ...apiTx, blob_size: null, fee_rate: null };
const noSizeTx = mapTxDetail(apiNoSize, txConf(apiNoSize));
ok(noSizeTx.sizeBytes === null, `null blob_size maps to null (UI shows "—"), never an invented value`);
ok(noSizeTx.feePerB === null, `null fee_rate maps to null`);

console.log("\n— block mapper —\n");

const apiBlock = {
  height: CONF_H, hash: "b".repeat(64), prev_hash: "9".repeat(64),
  timestamp: Math.floor(Date.now() / 1000) - 600, difficulty: 3.21e11,
  block_weight: 120000, block_weight_limit: 600000, long_term_weight: 130000,
  tx_count: 12, nonce: 123456, major_version: 16, minor_version: 16,
  miner_tx_hash: "0".repeat(64), pool_name: "Unknown", pool_type: "solo", orphan: false,
  tx_hashes: ["1".repeat(64), "2".repeat(64), "3".repeat(64)],
};
const blk = mapBlockDetail(apiBlock, confOf(apiBlock.height, data), 0.6);
ok(blk.confirmations === confOf(CONF_H, data), `block confirmations from confOf — got ${blk.confirmations}`);
ok(blk.coinbaseTxHash === "0".repeat(64), `coinbase = real miner_tx_hash`);
ok(blk.txHashes.length === 3, `real tx_hashes passed through (${blk.txHashes.length})`);
ok(blk.fullnessPct === +((120000 / 600000) * 100).toFixed(1), `fullness = real block_weight / limit (${blk.fullnessPct}%)`);
ok(blk.reward === 0.6, `reward sourced from the recent-blocks window (${blk.reward})`);
ok(blk.hardforkLabel.startsWith("v16"), `hardfork label derived from real major_version`);
ok(!/"amount"/.test(JSON.stringify(blk)), `no amount key in block view`);

console.log("\n— decoys mapper —\n");

const apiDecoys = {
  txid: "a".repeat(64), tip_height: TIP,
  inputs: [{ inputIdx: 0, ring: [
    { ringIdx: 0, block_height: TIP - 720, age_blocks: 720, unlocked: true },
    { ringIdx: 1, block_height: TIP - 1, age_blocks: 1, unlocked: false },
  ] }],
};
const dec = mapDecoys(apiDecoys);
ok(dec.length === 1 && dec[0].ring.length === 2, `decoy rings mapped`);
ok(dec[0].ring[0].blockHeight === TIP - 720 && dec[0].ring[0].ageBlocks === 720, `real decoy block height + age passthrough`);
ok(dec[0].ring[0].ageDays === +((720 * 120) / 86400).toFixed(1), `age in days derived from real age_blocks (${dec[0].ring[0].ageDays}d)`);

console.log("\nchainTip(data) = #" + chainTip(data) + " (newest confirmed block)\n");
console.log(fail ? "❌ TX-DETAIL MAPPER CHECKS FAILED" : "✅ ALL TX-DETAIL MAPPER ASSERTIONS PASSED");
process.exit(fail ? 1 : 0);
