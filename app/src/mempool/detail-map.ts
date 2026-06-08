// mempool/detail-map.ts — PURE mappers: raw /api/xmr JSON → detail view models.
//
// Zero runtime imports (only erased type-only ones), so they are unit-testable
// under plain `node` exactly like data/map.ts. `confirmations` and `reward` are
// passed IN by the caller — confirmations always come from the single confOf
// accessor (conf.ts), so this module never re-derives the confirmation count.
//
// Honesty contract: every field is real from the node or explicitly null
// (the UI renders null as "—"/"unavailable"). Amounts are hidden by RingCT and
// are NEVER materialised as a number anywhere in these view models.

const PICO = 1e12;
const nowSec = () => Math.floor(Date.now() / 1000);

/* ── wire shapes (mirror api/xmr.js handleTx / handleBlockDetail / decoys) ── */

export interface ApiTxInput {
  key_image: string;
  ring_member_count: number;
  key_offsets: number[];
}
export interface ApiTxOutput {
  stealth_key: string;
  view_tag: string;
}
export interface ApiTxDetail {
  txid: string;
  status: "confirmed" | "mempool";
  confirmed: boolean;
  in_pool: boolean;
  block_height: number | null;
  block_hash: string | null;
  block_timestamp: number | null;
  confirmations: number;
  receive_time: number | null;
  blob_size: number | null; // bytes; null when the node response lacked the blob
  fee: number | null; // piconero
  fee_rate: number | null; // piconero / B
  ring_size: number;
  rct_type: number;
  has_view_tags: boolean;
  unlock_time: number;
  output_count: number;
  input_count: number;
  version: number;
  inputs: ApiTxInput[];
  outputs: ApiTxOutput[];
  extra_hex: string;
}

export interface ApiBlockDetail {
  height: number;
  hash: string;
  prev_hash: string;
  timestamp: number;
  difficulty: number;
  block_weight: number;
  block_weight_limit?: number;
  long_term_weight: number;
  tx_count: number;
  nonce: number;
  major_version: number;
  minor_version: number;
  miner_tx_hash: string;
  pool_name: string;
  pool_type: string;
  orphan: boolean;
  tx_hashes: string[];
}

export interface ApiDecoys {
  txid: string;
  tip_height: number | null;
  inputs: {
    inputIdx: number;
    ring: { ringIdx: number; block_height: number | null; age_blocks: number | null; unlocked: boolean }[];
  }[];
}

/* ── view models (what the panels render) ── */

export interface RealTxView {
  id: string;
  inMempool: boolean;
  blockHeight: number | null;
  blockHash: string | null;
  blockTimestamp: number | null;
  ageSeconds: number | null;
  /** the ONE confirmation truth: confOf(blockHeight, data) */
  confirmations: number;
  sizeBytes: number | null;
  fee: number | null; // XMR
  feePerB: number | null; // piconero / B
  ringSize: number;
  rctType: number;
  rctTypeLabel: string;
  version: number;
  unlockTime: number;
  hasViewTags: boolean;
  extraHex: string;
  extraSize: number; // bytes
  firstSeen: number | null; // unix s (mempool only, this node's receive_time)
  inputs: { keyImage: string; ringMembers: number; keyOffsets: number[] }[];
  outputs: { stealthKey: string; viewTag: string }[];
}

export interface RealBlockView {
  height: number;
  hash: string;
  prevHash: string;
  timestamp: number;
  timestampIso: string;
  ageSeconds: number;
  difficulty: number;
  nonce: number;
  majorVersion: number;
  minorVersion: number;
  hardforkLabel: string;
  minerTxHash: string;
  pool: string;
  txCount: number;
  weightBytes: number;
  longTermWeight: number;
  weightLimit: number;
  fullnessPct: number | null;
  reward: number | null;
  confirmations: number;
  txHashes: string[];
  coinbaseTxHash: string;
}

export interface DecoyRingMember {
  ringIdx: number;
  blockHeight: number | null;
  ageBlocks: number | null;
  ageDays: number | null;
  unlocked: boolean;
}
export interface DecoyInputView {
  inputIdx: number;
  ring: DecoyRingMember[];
}

/* ── label helpers ── */

export function rctTypeLabel(t: number): string {
  switch (t) {
    case 0: return "non-RingCT (coinbase)";
    case 1: return "RingCT (Full)";
    case 2: return "RingCT (Simple)";
    case 3: return "Bulletproof";
    case 4: return "Bulletproof2";
    case 5: return "CLSAG + Bulletproof";
    case 6: return "CLSAG + Bulletproofs+";
    default: return `rct_type ${t}`;
  }
}

export function hardforkLabel(major: number): string {
  switch (major) {
    case 16: return "v16 (CLSAG + Bulletproofs+)";
    case 15: return "v15 (view tags)";
    case 14: return "v14 (CLSAG)";
    default: return major ? `v${major}` : "—";
  }
}

/* ── pure mappers ── */

/** The REAL block height the node reports for a tx (null for mempool). The caller
 *  feeds this to confOf — the ONE confirmation formula — and passes the result in. */
export function txBlockHeight(api: ApiTxDetail): number | null {
  return api.confirmed && api.block_height != null ? api.block_height : null;
}

/**
 * Raw /api/xmr/tx JSON → tx view model. `confirmations` is supplied by the caller
 * (always confOf(txBlockHeight(api), data)), so the count MATCHES the ribbon and a
 * public explorer and is never re-derived here. Amounts stay hidden.
 */
export function mapTxDetail(api: ApiTxDetail, confirmations: number): RealTxView {
  const inMempool = !api.confirmed || api.in_pool === true;
  const blockHeight = txBlockHeight(api);
  const fee = api.fee != null && Number.isFinite(api.fee) ? api.fee / PICO : null;
  const feePerB = api.fee_rate != null && Number.isFinite(api.fee_rate) ? api.fee_rate : null;
  const extraHex = typeof api.extra_hex === "string" ? api.extra_hex : "";

  const ageSeconds = inMempool
    ? (api.receive_time != null ? Math.max(0, nowSec() - api.receive_time) : null)
    : (api.block_timestamp != null ? Math.max(0, nowSec() - api.block_timestamp) : null);

  return {
    id: api.txid,
    inMempool,
    blockHeight,
    blockHash: api.block_hash ?? null,
    blockTimestamp: api.block_timestamp ?? null,
    ageSeconds,
    confirmations, // from the caller's confOf(blockHeight, data) — ONE formula, REAL height
    sizeBytes: api.blob_size != null && Number.isFinite(api.blob_size) ? api.blob_size : null,
    fee,
    feePerB,
    ringSize: api.ring_size || (api.inputs[0]?.ring_member_count ?? 16),
    rctType: api.rct_type,
    rctTypeLabel: rctTypeLabel(api.rct_type),
    version: api.version,
    unlockTime: api.unlock_time || 0,
    hasViewTags: !!api.has_view_tags,
    extraHex,
    extraSize: Math.floor(extraHex.length / 2),
    firstSeen: inMempool ? (api.receive_time ?? null) : null,
    inputs: (api.inputs || []).map((i) => ({
      keyImage: i.key_image,
      ringMembers: i.ring_member_count,
      keyOffsets: i.key_offsets || [],
    })),
    outputs: (api.outputs || []).map((o) => ({ stealthKey: o.stealth_key, viewTag: o.view_tag })),
  };
}

/**
 * Raw /api/xmr/block/<h> JSON → block view model. `confirmations` is supplied by
 * the caller (confOf(api.height, data)); `reward` is looked up by the caller from
 * the recent-blocks window (the block-detail RPC omits reward) and passed in.
 */
export function mapBlockDetail(api: ApiBlockDetail, confirmations: number, reward: number | null): RealBlockView {
  const weightLimit = api.block_weight_limit || 600000;
  return {
    height: api.height,
    hash: api.hash,
    prevHash: api.prev_hash,
    timestamp: api.timestamp,
    timestampIso: api.timestamp ? new Date(api.timestamp * 1000).toISOString() : "—",
    ageSeconds: api.timestamp ? Math.max(0, nowSec() - api.timestamp) : 0,
    difficulty: api.difficulty,
    nonce: api.nonce,
    majorVersion: api.major_version,
    minorVersion: api.minor_version,
    hardforkLabel: hardforkLabel(api.major_version),
    minerTxHash: api.miner_tx_hash,
    pool: api.pool_name || "Unknown",
    txCount: api.tx_count,
    weightBytes: api.block_weight,
    longTermWeight: api.long_term_weight,
    weightLimit,
    fullnessPct: api.block_weight && weightLimit ? +((api.block_weight / weightLimit) * 100).toFixed(1) : null,
    reward,
    confirmations,
    txHashes: Array.isArray(api.tx_hashes) ? api.tx_hashes : [],
    coinbaseTxHash: api.miner_tx_hash,
  };
}

/** Raw /api/xmr/decoys/<txid> JSON → per-input rings with real ages. */
export function mapDecoys(api: ApiDecoys): DecoyInputView[] {
  return (api.inputs || []).map((inp) => ({
    inputIdx: inp.inputIdx,
    ring: (inp.ring || []).map((m) => ({
      ringIdx: m.ringIdx,
      blockHeight: m.block_height,
      ageBlocks: m.age_blocks,
      ageDays: m.age_blocks != null ? +((m.age_blocks * 120) / 86400).toFixed(1) : null,
      unlocked: !!m.unlocked,
    })),
  }));
}
