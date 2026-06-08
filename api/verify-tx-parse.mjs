/* verify-tx-parse.mjs — offline unit test for api/xmr.js tx parsing.
   Run: node api/verify-tx-parse.mjs
   The sandbox has no network egress to Monero nodes, so we verify the pure
   parseTransaction / txSizeFromEntry helpers against committed fixtures that
   mirror a monerod get_transactions(decode_as_json:true) tx entry. */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { parseTransaction, txSizeFromEntry } = require('./xmr.js');

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

if (failed > 0) {
  console.log(`\n${failed} check(s) FAILED`);
  process.exit(1);
}
console.log('\nAll checks passed ✅');
