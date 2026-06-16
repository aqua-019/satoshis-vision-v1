/**
 * data/map.ts — pure translators from v4's backend JSON → the MoneroLive shape.
 *
 * These functions are side-effect-free. They take the raw JSON returned by
 * v4's existing proxies (`/api/monero` get_info, `/api/xmr/*`, `/api/coingecko`)
 * or the relay WebSocket payloads, and fold them onto a previous MoneroLive
 * snapshot — a field a given response doesn't include is *carried* from the
 * prior state, never left NaN/undefined. Surfaces gate number rendering on
 * `data.ready` / `data.marketReady`, so carried boot zeros are never shown.
 *
 * Units honoured exactly (see types.ts):
 *  - mempool/block sizes that v4 gives in BYTES stay bytes; Block.sizeKB is KB
 *  - fees from monerod are in piconero → divided by PICO to XMR
 *  - Tx.perB is piconero/B (== monerod fee_rate), left as-is
 *  - prices USD, ages SECONDS, hashrate H/s, difficulty raw int
 */

import type { Block, DataSource, MoneroLive, Tx } from "./types";

/** 1 XMR = 1e12 piconero. */
const PICO = 1e12;
/** sparkline series length. */
const SERIES_CAP = 168;
/** how many recent blocks the renderers expect (Sediment renders up to this many strata). */
export const BLOCKS_CAP = 100;

const nowSec = () => Math.floor(Date.now() / 1000);
const num = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

/** Deterministic [0,1) drawn from a txid so per-tx styling/positions are stable.
 *  Exported: visual surfaces use it to derive stable coordinates from real ids. */
export function hashToUnit(id: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h >>> 8) / (1 << 24);
}

/** Labels for get_fee_estimate's 4 tiers, slow → fastest. */
export const FEE_TIER_LABELS = ["slow", "normal", "fast", "fastest"] as const;

/** Classify a real fee rate (piconero/B) against the node's 4 fee tiers.
 *  Returns 0..3 (slow..fastest), or -1 when tiers are unknown/malformed —
 *  callers render "—" in that case. */
export function feeTierIndex(perB: number, tiers: number[]): number {
  if (!Array.isArray(tiers) || tiers.length !== 4 || !Number.isFinite(perB)) return -1;
  if (perB < tiers[1]) return 0;
  if (perB < tiers[2]) return 1;
  if (perB < tiers[3]) return 2;
  return 3;
}

/** Human protocol/hardfork labels keyed off monerod's major_version. */
function hardforkLabel(major: number | undefined): string | null {
  switch (major) {
    case 16:
      return "v16 (CLSAG + Bulletproofs+)";
    case 15:
      return "v15 (view tags)";
    case 14:
      return "v14 (CLSAG)";
    default:
      return major ? `v${major}` : null;
  }
}

/** Append a fresh sample to a rolling sparkline series, capped at SERIES_CAP. */
function pushSeries(prev: number[], sample: number): number[] {
  if (!Number.isFinite(sample)) return prev;
  const next = prev.length >= SERIES_CAP ? prev.slice(prev.length - SERIES_CAP + 1) : prev.slice();
  next.push(sample);
  return next;
}

// ── input shapes (loosely typed: v4 JSON is external) ───────────────

interface RpcInfo {
  result?: RpcInfo;
  height?: number;
  difficulty?: number;
  target?: number;
  top_block_hash?: string;
  major_version?: number;
}

interface XmrNetwork {
  height?: number;
  difficulty?: number;
  hashrate_ghs?: number;
  target_seconds?: number;
  top_block_hash?: string;
  major_version?: number;
  version?: string;
  fee_tiers?: number[];
  tx_count_total?: number;
  alt_blocks_count?: number;
  randomx_seed_hash?: string;
  block_weight_limit?: number;
  block_weight_median?: number;
  database_size?: number;
  synchronized?: boolean;
  nettype?: string;
  adjusted_time?: number;
}

interface XmrRecentTx {
  txid: string;
  blob_size?: number;
  fee?: number; // piconero
  fee_rate?: number; // piconero/B
  receive_time?: number; // unix seconds
  ring_size?: number;
  input_count?: number;
  output_count?: number;
}

interface XmrMempool {
  recent_txs?: XmrRecentTx[];
  fee_histogram?: { tx_count?: number; bytes?: number }[];
}

interface XmrBlock {
  height: number;
  hash: string;
  timestamp?: number;
  reward?: number; // piconero
  difficulty?: number;
  block_weight?: number; // bytes
  tx_count?: number;
  pool_name?: string;
}

interface CgPrice {
  monero?: { usd?: number; usd_24h_change?: number };
  bitcoin?: { usd?: number; usd_24h_change?: number };
}

// ── field mappers ───────────────────────────────────────────────────

/** monerod get_info (JSON-RPC `result`) → network/meta fields.
 *  Peer counts are never mapped — the public-node cascade runs restricted RPC
 *  (all peer counts read 0, per-peer lists are admin-only), so no peer surface
 *  exists anywhere in the app. */
export function mapInfo(raw: RpcInfo, prev: MoneroLive): Partial<MoneroLive> {
  const r = raw.result ?? raw;
  const target = num(r.target, prev.blockTarget);
  const difficulty = num(r.difficulty, prev.difficulty);
  const major = r.major_version;
  return {
    height: num(r.height, prev.height),
    difficulty,
    blockTarget: target,
    hashrate: target > 0 ? difficulty / target : prev.hashrate,
    hardfork: hardforkLabel(major) ?? prev.hardfork,
    protocol: major ? `v${major}` : prev.protocol,
  };
}

/** /api/xmr/network → network + node/chain meta fields (complements get_info).
 *  hashrate is H/s = hashrate_ghs * 1e9. */
export function mapNetwork(net: XmrNetwork, prev: MoneroLive): Partial<MoneroLive> {
  const target = num(net.target_seconds, prev.blockTarget);
  const difficulty = num(net.difficulty, prev.difficulty);
  const hashrate = net.hashrate_ghs != null ? net.hashrate_ghs * 1e9 : prev.hashrate;
  const major = net.major_version;
  return {
    height: num(net.height, prev.height),
    difficulty,
    blockTarget: target,
    hashrate: Number.isFinite(hashrate) ? hashrate : prev.hashrate,
    hardfork: hardforkLabel(major) ?? prev.hardfork,
    protocol: major ? `v${major}` : prev.protocol,
    version: net.version || prev.version,
    majorVersion: num(major, prev.majorVersion),
    feeTiers: Array.isArray(net.fee_tiers) && net.fee_tiers.length ? net.fee_tiers : prev.feeTiers,
    txCountTotal: num(net.tx_count_total, prev.txCountTotal),
    topBlockHash: net.top_block_hash || prev.topBlockHash,
    altBlocksCount: num(net.alt_blocks_count, prev.altBlocksCount),
    randomxSeedHash: net.randomx_seed_hash || prev.randomxSeedHash,
    blockWeightLimit: num(net.block_weight_limit, prev.blockWeightLimit),
    blockWeightMedian: num(net.block_weight_median, prev.blockWeightMedian),
    databaseSize: num(net.database_size, prev.databaseSize),
    synchronized: net.synchronized ?? prev.synchronized,
    nettype: net.nettype || prev.nettype,
    adjustedTime: num(net.adjusted_time, prev.adjustedTime),
  };
}

/** A single relay/REST mempool tx → MoneroLive Tx. */
function toTx(t: XmrRecentTx): Tx {
  const fee = num(t.fee, 0) / PICO;
  return {
    id: t.txid,
    size: num(t.blob_size, 0),
    fee,
    ringSize: num(t.ring_size, 16),
    perB: num(t.fee_rate, 0),
    age: Math.max(0, nowSec() - num(t.receive_time, nowSec())),
    inputs: num(t.input_count, 1),
    outputs: num(t.output_count, 2),
    seed: hashToUnit(t.txid),
  };
}

/** 5 coarse fee buckets → a 32-point staircase for the feeHist sparkline. */
function feeHistFromBuckets(buckets: { tx_count?: number }[]): number[] | null {
  if (!buckets.length) return null;
  const out: number[] = [];
  for (let i = 0; i < 32; i++) {
    const b = buckets[Math.min(buckets.length - 1, Math.floor((i / 32) * buckets.length))];
    out.push(num(b?.tx_count, 0));
  }
  return out;
}

/** /api/xmr/mempool → mempool[] + derived feeHist. */
export function mapMempool(mp: XmrMempool, prev: MoneroLive): Partial<MoneroLive> {
  const txs = Array.isArray(mp.recent_txs) ? mp.recent_txs.filter((t) => t && t.txid).map(toTx) : null;
  const feeHist = Array.isArray(mp.fee_histogram) ? feeHistFromBuckets(mp.fee_histogram) : null;
  return {
    mempool: txs && txs.length ? txs : prev.mempool,
    feeHist: feeHist ?? prev.feeHist,
  };
}

/** A single relay/REST block → MoneroLive Block. */
function toBlock(b: XmrBlock, tipHeight: number): Block {
  const ts = num(b.timestamp, nowSec());
  return {
    height: b.height,
    hash: b.hash,
    txs: num(b.tx_count, 0),
    sizeKB: num(b.block_weight, 0) / 1000,
    reward: num(b.reward, 0) / PICO,
    difficulty: num(b.difficulty, 0),
    pool: b.pool_name || "Unknown",
    age: Math.max(0, nowSec() - ts),
    conf: Math.max(1, tipHeight - b.height + 1),
  };
}

/** /api/xmr/blocks → blocks[] (newest first). */
export function mapBlocks(arr: XmrBlock[], prev: MoneroLive): Partial<MoneroLive> {
  if (!Array.isArray(arr) || !arr.length) return { blocks: prev.blocks };
  const sorted = arr.filter((b) => b && b.hash).sort((a, b) => b.height - a.height);
  const tip = sorted[0]?.height ?? prev.height;
  return { blocks: sorted.slice(0, BLOCKS_CAP).map((b) => toBlock(b, tip)) };
}

/** /api/coingecko (simple/price) → market fields + appended priceSeries. */
export function mapMarket(cg: CgPrice, prev: MoneroLive): Partial<MoneroLive> {
  const xmr = cg.monero?.usd;
  const btc = cg.bitcoin?.usd;
  const price = num(xmr, prev.price);
  const btcUsd = num(btc, prev.btc);
  return {
    price,
    change24h: num(cg.monero?.usd_24h_change, prev.change24h),
    btc: btcUsd,
    btcChg: num(cg.bitcoin?.usd_24h_change, prev.btcChg),
    btcRatio: btcUsd > 0 ? price / btcUsd : prev.btcRatio,
    priceSeries: xmr != null ? pushSeries(prev.priceSeries, price) : prev.priceSeries,
  };
}

// ── combined snapshot mapper ────────────────────────────────────────

export interface SnapshotSources {
  info?: RpcInfo | null;
  network?: XmrNetwork | null;
  mempool?: XmrMempool | null;
  blocks?: XmrBlock[] | null;
  market?: CgPrice | null;
}

/**
 * Fold a polled snapshot onto the previous MoneroLive state.
 *
 * Only the sources that actually returned are applied; everything else is
 * carried from `prev`. This sets `source`/`live`/`lastUpdate`; the feed hook
 * spreads `ready`/`marketReady`/`stale` AFTER this result so the meta flags
 * stay truthful at every degrade step.
 */
export function mapToMoneroLive(prev: MoneroLive, src: SnapshotSources, source: DataSource): MoneroLive {
  let next: MoneroLive = { ...prev };

  if (src.network) next = { ...next, ...mapNetwork(src.network, next) };
  if (src.info) next = { ...next, ...mapInfo(src.info, next) }; // get_info refines height/difficulty/target
  if (src.mempool) next = { ...next, ...mapMempool(src.mempool, next) };
  if (src.blocks) next = { ...next, ...mapBlocks(src.blocks, next) };
  if (src.market) next = { ...next, ...mapMarket(src.market, next) };

  // roll the hashrate sparkline forward with each real sample
  next.hashSeries = pushSeries(prev.hashSeries, next.hashrate);
  next.source = source;
  next.live = true;
  next.lastUpdate = Date.now();
  return next;
}

// ── relay WebSocket delta mappers ───────────────────────────────────

/** WS `block` payload (XmrBlockSummary) → prepend onto blocks[], bump height. */
export function applyWsBlock(prev: MoneroLive, data: XmrBlock): MoneroLive {
  const tip = Math.max(num(data.height, prev.height), prev.height);
  const block = toBlock(data, tip);
  const blocks = [block, ...prev.blocks.filter((b) => b.height !== block.height)].slice(0, BLOCKS_CAP);
  return {
    ...prev,
    height: tip,
    blocks,
    difficulty: num(data.difficulty, prev.difficulty),
    hashSeries: pushSeries(prev.hashSeries, prev.hashrate),
    source: "ws",
    live: true,
    lastUpdate: Date.now(),
  };
}

/** WS `mempool-update` payload → replace mempool[] + feeHist. */
export function applyWsMempool(prev: MoneroLive, data: XmrMempool): MoneroLive {
  const merged = mapMempool(data, prev);
  return {
    ...prev,
    ...merged,
    source: "ws",
    live: true,
    lastUpdate: Date.now(),
  };
}

/** WS `network-update` payload → refresh network fields. */
export function applyWsNetwork(prev: MoneroLive, data: XmrNetwork): MoneroLive {
  const merged = mapNetwork(data, prev);
  const next = { ...prev, ...merged };
  next.hashSeries = pushSeries(prev.hashSeries, next.hashrate);
  next.source = "ws";
  next.live = true;
  next.lastUpdate = Date.now();
  return next;
}
