/**
 * data/map.ts — pure translators from v4's backend JSON → the MoneroLive shape.
 *
 * These functions are side-effect-free. They take the raw JSON returned by
 * v4's existing proxies (`/api/xmr/*`, `/api/nodes`, `/api/coingecko`)
 * or the relay WebSocket payloads, and fold them onto a previous MoneroLive
 * snapshot — a field a given response doesn't include is *carried* from the
 * prior state, never left NaN/undefined. Surfaces gate number rendering on
 * `hasData(status.network)` / `hasData(status.market)`, so carried boot zeros
 * are never shown.
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
  /* No peer fields. Restricted public RPC reports every peer counter as 0, and
     /api/xmr/network no longer publishes them (v6.0.6) — mapping a 0 into
     MoneroLive would make "0 peers" available to render as if it were live data. */
}

/** /api/xmr/fees — the fast tier's fee estimate. `tiers` is null when no node
 *  answered; the proxy no longer substitutes a plausible default. */
interface XmrFees {
  tiers?: number[] | null;
}

interface XmrRecentTx {
  txid: string;
  blob_size?: number;
  fee?: number; // piconero
  fee_rate?: number; // piconero/B
  /** unix seconds, as the node reported it. 0 (or absent) means the node did
   *  NOT report one — see toTx(); it is never an epoch. */
  receive_time?: number | null;
  /** unix seconds of the first /api/xmr/mempool poll that listed this txid,
   *  from the function's warm memory (api/xmr.js, p4·M9a). null for a txid that
   *  was already in the pool when the function cold-started — it never watched
   *  that one arrive, so it has nothing honest to say about when it did. */
  first_seen_here?: number | null;
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
    /* Peer counts are deliberately NOT mapped — see XmrNetwork above. */
  };
}

/** /api/xmr/fees → feeTiers. Polled on the fast tier so the fee histogram's tier
 *  labels track the node's current estimate; carries last-good when unanswered. */
export function mapFees(f: XmrFees, prev: MoneroLive): Partial<MoneroLive> {
  return {
    feeTiers: Array.isArray(f.tiers) && f.tiers.length ? f.tiers : prev.feeTiers,
  };
}

/** Block 0's timestamp — 2014-04-18T10:49:53Z. No transaction was received
 *  before the chain existed, so a "sighting" earlier than this is not a sighting.
 *  This is what makes `receive_time: 0` an ABSENCE rather than an epoch (and
 *  catches 1, 1000, or any other placeholder an upstream might write). */
export const MONERO_GENESIS_S = 1_397_818_193;

/** A reported sighting, or null when the field is absent, non-numeric, zero, or
 *  predates the chain. */
const seenAt = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= MONERO_GENESIS_S ? v : null;

/** A single relay/REST mempool tx → MoneroLive Tx.
 *
 *  `age` is `now - firstSeenAt`, and `firstSeenAt` is the EARLIEST sighting any
 *  clock reported: the node's own `receive_time` when it gave one (source
 *  "node"), else the site's `first_seen_here` or the sighting carried from the
 *  previous snapshot (source "site"), else null — never `now`, which the
 *  pre-p4·M9a line fell back to and which rendered the Unix epoch as an age
 *  the moment the node started answering 0. */
function toTx(t: XmrRecentTx, now: number, carried: Tx | undefined): Tx {
  const fee = num(t.fee, 0) / PICO;
  const nodeSeen = seenAt(t.receive_time);
  const siteSeen = seenAt(t.first_seen_here);
  const prevSeen = carried?.firstSeenAt ?? null;
  let firstSeenAt: number | null = null;
  let ageSource: Tx["ageSource"] = null;
  if (nodeSeen != null) {
    firstSeenAt = nodeSeen;
    ageSource = "node";
  } else {
    const known = [siteSeen, prevSeen].filter((v): v is number => v != null);
    if (known.length) {
      firstSeenAt = Math.min(...known);
      // A node-reported sighting carried from an earlier poll keeps its label:
      // the cascade may have moved to a node that reports nothing, but the
      // earlier node's clock is still the earlier node's clock.
      ageSource = carried?.ageSource === "node" && firstSeenAt === prevSeen ? "node" : "site";
    }
  }
  return {
    id: t.txid,
    size: num(t.blob_size, 0),
    fee,
    ringSize: num(t.ring_size, 16),
    perB: num(t.fee_rate, 0),
    age: firstSeenAt == null ? null : Math.max(0, now - firstSeenAt),
    ageSource,
    firstSeenAt,
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
  const now = nowSec();
  // Sightings survive across polls (see toTx). Keyed once per snapshot, not
  // per tx — a 240-tx pool against a 240-tx previous snapshot is 480 lookups,
  // not 57,600 scans.
  const prevById = new Map<string, Tx>();
  for (const t of prev.mempool) prevById.set(t.id, t);
  const txs = Array.isArray(mp.recent_txs)
    ? mp.recent_txs.filter((t) => t && t.txid).map((t) => toTx(t, now, prevById.get(t.txid)))
    : null;
  const feeHist = Array.isArray(mp.fee_histogram) ? feeHistFromBuckets(mp.fee_histogram) : null;
  return {
    mempool: txs && txs.length ? txs : prev.mempool,
    feeHist: feeHist ?? prev.feeHist,
  };
}

/** A single relay/REST block → MoneroLive Block. */
function toBlock(b: XmrBlock, tipHeight: number): Block {
  /* `tsReal` is the header's own time or nothing; `ts` keeps the pre-existing
     wall-clock fallback that `age` has always used. Two names because they are
     two different claims: `age` may degrade to "assume it just arrived", a
     chart coordinate may not. See Block.timestamp in types.ts. */
  const raw = Number(b.timestamp);
  const tsReal = Number.isFinite(raw) && raw > 0 ? raw : null;
  const ts = tsReal ?? nowSec();
  return {
    height: b.height,
    hash: b.hash,
    txs: num(b.tx_count, 0),
    sizeKB: num(b.block_weight, 0) / 1000,
    reward: num(b.reward, 0) / PICO,
    difficulty: num(b.difficulty, 0),
    pool: b.pool_name || "Unknown",
    age: Math.max(0, nowSec() - ts),
    timestamp: tsReal,
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
  fees?: XmrFees | null;
}

export interface FoldOptions {
  /**
   * Append the current hashrate to `hashSeries`.
   *
   * MUST be set only by the CHAIN tier. Hashrate is derived from difficulty,
   * which only moves when a block lands (~120s); if the 3s fast tier also pushed,
   * the "Hashrate · session · N samples" chart on /network would fill with ~20
   * duplicate samples a minute and read as a flat line of fake resolution.
   */
  pushHash?: boolean;
}

/**
 * Fold a polled snapshot onto the previous MoneroLive state.
 *
 * Only the sources that actually returned are applied; everything else is
 * carried from `prev`. This sets `source`/`lastUpdate`; the feed hook derives
 * `status` from its own per-endpoint observations AFTER this result, so the
 * union stays truthful at every degrade step (v6.1.4 — this used to spread
 * `ready`/`marketReady`/`stale` here instead).
 *
 * Called once per tier tick with only that tier's sources (v6.0.6).
 * `priceSeries` needs no equivalent flag: `mapMarket` is the only thing that
 * pushes it and only the market tier ever supplies `src.market`.
 */
export function mapToMoneroLive(
  prev: MoneroLive,
  src: SnapshotSources,
  source: DataSource,
  opts: FoldOptions = {},
): MoneroLive {
  let next: MoneroLive = { ...prev };

  if (src.network) next = { ...next, ...mapNetwork(src.network, next) };
  if (src.info) next = { ...next, ...mapInfo(src.info, next) }; // get_info refines height/difficulty/target
  if (src.mempool) next = { ...next, ...mapMempool(src.mempool, next) };
  if (src.fees) next = { ...next, ...mapFees(src.fees, next) };
  if (src.blocks) next = { ...next, ...mapBlocks(src.blocks, next) };
  if (src.market) next = { ...next, ...mapMarket(src.market, next) };

  // roll the hashrate sparkline forward — chain tier only, see FoldOptions
  if (opts.pushHash) next.hashSeries = pushSeries(prev.hashSeries, next.hashrate);
  next.source = source;
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
    lastUpdate: Date.now(),
  };
}

/** WS `network-update` payload → refresh network fields. */
export function applyWsNetwork(prev: MoneroLive, data: XmrNetwork): MoneroLive {
  const merged = mapNetwork(data, prev);
  const next = { ...prev, ...merged };
  next.hashSeries = pushSeries(prev.hashSeries, next.hashrate);
  next.source = "ws";
  next.lastUpdate = Date.now();
  return next;
}
