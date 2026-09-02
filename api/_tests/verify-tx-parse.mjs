/* verify-tx-parse.mjs — offline unit test for api/xmr.js tx parsing.
   Run: node api/_tests/verify-tx-parse.mjs
   The sandbox has no network egress to Monero nodes, so we verify the pure
   parseTransaction / txSizeFromEntry helpers against committed fixtures that
   mirror a monerod get_transactions(decode_as_json:true) tx entry. */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { parseTransaction, txSizeFromEntry, poolTxRow, feeTierIndex, FEE_TIER_LABELS, noteFirstSightings, newFirstSeenState } = require('../xmr.js');

let failed = 0;
function check(label, cond) {
  if (cond) {
    console.log(`✅ ${label}`);
  } else {
    console.log(`❌ ${label}`);
    failed++;
  }
}

const TXID = 'a'.repeat(64);

/* Build a 16-member ring key_offsets array (relative offsets). */
const ringOffsets = Array.from({ length: 16 }, (_, i) => i === 0 ? 1234567 : 42 + i);

/* as_json string mirroring what monerod returns. parseTransaction reads:
   version, unlock_time, vin[].key.{k_image,key_offsets}, vout[].target.tagged_key.{key,view_tag},
   rct_signatures.{type,txnFee}, extra. */
const asJson = JSON.stringify({
  version: 2,
  unlock_time: 0,
  vin: [
    { key: { k_image: 'aa'.repeat(32), key_offsets: ringOffsets } },
    { key: { k_image: 'bb'.repeat(32), key_offsets: ringOffsets } },
  ],
  vout: [
    { target: { tagged_key: { key: 'cc'.repeat(32), view_tag: 'aa' } } },
    { target: { tagged_key: { key: 'dd'.repeat(32), view_tag: 'bb' } } },
  ],
  rct_signatures: { type: 6, txnFee: 34160000 },
  extra: [1, 2, 3, 4, 5],
});

/* DELIBERATELY length 5000 (not 3694) so size 2500 proves it's COMPUTED from
   as_hex, not the old 1847 constant. */
const AS_HEX = '0'.repeat(5000);

const confirmedFixture = {
  as_hex: AS_HEX,
  as_json: asJson,
  block_height: 3242000,
  block_hash: 'f'.repeat(64),
  block_timestamp: 1718000000,
  in_pool: false,
  confirmations: 5,
  received_timestamp: 1717999000,
};

const out = parseTransaction(confirmedFixture, TXID);

check('blob_size === 2500 (as_hex.length/2, NOT 1847)', out.blob_size === 2500);
check('blob_size is not the 1847 fallback', out.blob_size !== 1847);
check('fee === 34160000', out.fee === 34160000);
check('fee_rate === 34160000/2500 (real, finite)',
  out.fee_rate === 34160000 / 2500 && Number.isFinite(out.fee_rate));
check('ring_size === 16 (vin[0].key.key_offsets.length)', out.ring_size === 16);
check('input_count === vin.length (2)', out.input_count === 2);
check('output_count === vout.length (2)', out.output_count === 2);
check('block_height === 3242000', out.block_height === 3242000);
check("status === 'confirmed'", out.status === 'confirmed');
check('confirmed === true', out.confirmed === true);
check('txid passed through', out.txid === TXID);
check('confirmations === 5', out.confirmations === 5);
check('rct_type === 6', out.rct_type === 6);
check('has_view_tags === true', out.has_view_tags === true);
check('version === 2', out.version === 2);

/* RingCT — amounts are hidden. No amount/amount_commitment key anywhere. */
const serialized = JSON.stringify(out);
check('no "amount" key in output', !/"amount"/.test(serialized));
check('no "amount_commitment" key in output', !/"amount_commitment"/.test(serialized));

/* Mempool fixture: in_pool true, no block_height. */
const mempoolFixture = {
  as_hex: '0'.repeat(4000),
  as_json: asJson,
  block_height: null,
  block_hash: null,
  in_pool: true,
  confirmations: 0,
  received_timestamp: 1718000123,
};
const memOut = parseTransaction(mempoolFixture, TXID);
check("mempool status === 'mempool'", memOut.status === 'mempool');
check('mempool block_height === null', memOut.block_height === null);
check('mempool confirmed === false', memOut.confirmed === false);
check('mempool in_pool === true', memOut.in_pool === true);
check('mempool blob_size === 2000 (computed)', memOut.blob_size === 2000);

/* txSizeFromEntry edge cases. */
check('txSizeFromEntry({}) === null (NOT 1847)', txSizeFromEntry({}) === null);
check('txSizeFromEntry(null) === null', txSizeFromEntry(null) === null);
check('txSizeFromEntry({as_hex:"abcd"}) === 2', txSizeFromEntry({ as_hex: 'abcd' }) === 2);
check('txSizeFromEntry falls back to pruned/prunable hex',
  txSizeFromEntry({ pruned_as_hex: '00'.repeat(10), prunable_as_hex: '00'.repeat(5) }) === 15);

/* ── p4·M9a · the pool row ────────────────────────────────────────────────
   /get_transaction_pool entries carry `tx_json` (a JSON string), `id_hash`,
   `blob_size`, `fee`, `receive_time`. The pre-p4·M9a builder read ring_size as
   `vin.length` — the INPUT COUNT — and tagged every mainnet tx `priority`
   against thresholds three orders under the fee floor. Both are pinned here
   with a FALSIFIABILITY PAIR each: the assertion, and a computation of what the
   old derivation would have said on the same fixture, which must DIFFER — an
   assertion the old code also satisfies proves nothing about the fix. */
console.log('\n— pool row (p4·M9a) —');
const NODE_TIERS = [20000, 80000, 320000, 4000000];   // monerod get_fee_estimate.fees, pcn/B
const poolEntry = {
  id_hash: 'c1'.repeat(32),
  blob_size: 1532,
  fee: 30640000,                 // 30640000 / 1532 = 20000 pcn/B — the floor, the production sample's rate
  receive_time: 0,               // what production answered on 2026-09-01
  relayed: true, double_spend_seen: false, do_not_relay: false, kept_by_block: false,
  tx_json: asJson,               // two inputs, each a 16-member ring
};
const row = poolTxRow(poolEntry, NODE_TIERS, null);
check('pool ring_size === 16 (vin[0].key.key_offsets.length)', row.ring_size === 16);
check('pool input_count === 2 (vin.length)', row.input_count === 2);
check('CONTROL · the pre-fix derivation (vin.length) reads 2 here, so the assertion above discriminates',
  JSON.parse(asJson).vin.length === 2 && JSON.parse(asJson).vin.length !== row.ring_size);
check('fee_rate === 20000', row.fee_rate === 20000);
check("fee_tier === 'slow' — the node's floor tier, NOT 'priority'", row.fee_tier === 'slow');
check('CONTROL · the pre-fix thresholds (>80 ⇒ priority) would have tagged this rate priority', 20000 > 80);
check('receive_time 0 passes through as 0 (the client decides what an absence is)', row.receive_time === 0);
check('first_seen_here is null when this instance has no sighting', row.first_seen_here === null);
check('first_seen_here carries the sighting when given', poolTxRow(poolEntry, NODE_TIERS, 1718000100).first_seen_here === 1718000100);
check('malformed tx_json degrades the row, not the endpoint (ring 16 by consensus, counts 1/2)',
  (() => { const r = poolTxRow({ ...poolEntry, tx_json: '{not json' }, NODE_TIERS, null); return r.ring_size === 16 && r.input_count === 1 && r.output_count === 2; })());

/* Boundary semantics must equal the client's feeTierIndex (app/src/data/map.ts):
   strict `<` against tiers[1..3], so a rate EXACTLY at a tier floor belongs to
   that tier. */
check("feeTierIndex(19999) === 0 (slow)", feeTierIndex(19999, NODE_TIERS) === 0);
check("feeTierIndex(80000) === 1 (normal — a rate AT the floor is IN the tier)", feeTierIndex(80000, NODE_TIERS) === 1);
check("feeTierIndex(319999) === 1 (normal)", feeTierIndex(319999, NODE_TIERS) === 1);
check("feeTierIndex(4000000) === 3 (fastest)", feeTierIndex(4000000, NODE_TIERS) === 3);
check('feeTierIndex with no tiers === -1, and the row tags null — never a default',
  feeTierIndex(20000, null) === -1 && poolTxRow(poolEntry, null, null).fee_tier === null);
check("FEE_TIER_LABELS is slow·normal·fast·fastest", FEE_TIER_LABELS.join('·') === 'slow·normal·fast·fastest');

/* ── p4·M9a · the sighting memory ─────────────────────────────────────────
   Driven with its own state object over four polls. */
console.log('\n— first-sighting memory (p4·M9a) —');
const st = newFirstSeenState();
noteFirstSightings(st, ['a', 'b'], 1000);            // cold start: a, b already present
check('poll 1 · a txid present at the first poll is NOT stamped', st.seen.size === 0 && st.baseline.has('a') && st.baseline.has('b'));
check('poll 1 · first_seen_since is the first poll', st.since === 1000);
noteFirstSightings(st, ['a', 'b', 'c'], 1003);       // c arrives while watched
check('poll 2 · a txid that arrived while watched is stamped at THAT poll', st.seen.get('c') === 1003);
check('poll 2 · the baseline txids are still not stamped', !st.seen.has('a') && !st.seen.has('b'));
noteFirstSightings(st, ['a', 'c'], 1006);            // b mined
check('poll 3 · c keeps its ORIGINAL stamp on a later poll', st.seen.get('c') === 1003);
check('poll 3 · a baseline txid that left the pool is dropped from the baseline', !st.baseline.has('b') && st.baseline.has('a'));
noteFirstSightings(st, ['a'], 1009);                 // c mined
check('poll 4 · a stamped txid that left the pool is forgotten (bounded by the pool)', !st.seen.has('c') && st.seen.size === 0);
noteFirstSightings(st, ['a', 'b'], 1012);            // b's hash returns (a reorg re-adds it)
check('poll 5 · a txid that left and came back is stamped as a new arrival', st.seen.get('b') === 1012);

if (failed > 0) {
  console.log(`\n${failed} check(s) FAILED`);
  process.exit(1);
}
console.log('\nAll checks passed ✅');
