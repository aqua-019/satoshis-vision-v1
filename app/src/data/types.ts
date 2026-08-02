/**
 * data/types.ts — the wire shape for everything xmr.irish renders.
 *
 * Keep this STABLE. Every visual surface reads from `MoneroLive`. To plug a
 * live data source (Monero RPC, websocket, your worker, claude.ai's stack),
 * implement a provider that yields this shape and pass it via DataContext.
 *
 * BREAKING, v6.1.4: the four status booleans (`live` / `ready` / `marketReady` /
 * `stale`) were removed in favour of one per-endpoint discriminated union,
 * `status` (see feed-status.ts). A host runtime implementing `useFeed` gets a
 * COMPILE error rather than a silent behaviour change — see the migration table
 * on the field itself, and app/PORTING.md.
 *
 * Numeric fields use:
 *  - bytes   in B (not KB)
 *  - fees    in XMR  (e.g. 0.0000125)
 *  - sizes   in KB for displayed Block.sizeKB (keep the original encoding)
 *  - prices  in USD for `price` / `btc`
 *  - ages    in SECONDS since arrival
 *  - heights as block numbers (integer)
 *  - hashrate / difficulty in H/s and raw integer respectively
 */

export interface Tx {
  /** 64-char hex */
  id: string;
  /** transaction size in bytes */
  size: number;
  /** fee in XMR */
  fee: number;
  /** ring size — 16 since CLSAG */
  ringSize: number;
  /** fee per byte (piconero / B), derived */
  perB: number;
  /** age in seconds since arrival in mempool */
  age: number;
  inputs: number;
  outputs: number;
  /** opaque seed for stable styling across re-renders */
  seed?: number;
}

export interface Block {
  height: number;
  /** 64-char hex */
  hash: string;
  txs: number;
  /** size in KB (kept for legacy renderers; convert to B if you prefer) */
  sizeKB: number;
  /** coinbase reward in XMR */
  reward: number;
  difficulty: number;
  /** pool name as reported by the backend; "Unknown" when unattributable */
  pool: string;
  /** age in seconds */
  age: number;
  /** confirmations since this block */
  conf: number;
}

/** A single connected peer — populated ONLY when the operator's PRIMARY node
 *  (unrestricted RPC) is configured. The public reference pool reports no peer
 *  detail, so this is empty in 5.0.x and the Network peer panel stays paused. */
export interface Peer {
  /** host:port / ip as reported by the operator's own node */
  address: string;
  /** peer's reported chain height, when known */
  height?: number;
  /** connection direction */
  incoming?: boolean;
  /** connection state, e.g. "normal" | "synchronizing" */
  state?: string;
  /** round-trip latency in ms, when measured */
  latencyMs?: number;
  /** seconds the connection has been live */
  liveTimeSec?: number;
}

export type DataSource = "coingecko" | "rpc" | "ws" | "host";

/* Status vocabulary lives in feed-status.ts and is re-exported here so the 13
   consumer files keep one import path. Type-only, so this file stays loadable
   in bare Node (Node's type stripping erases `export type … from`). */
export type {
  FeedKey,
  FeedPhase,
  FeedStatus,
  FeedStatusMap,
  FailReason,
} from "./feed-status";
import type { FeedStatusMap } from "./feed-status";

export interface MoneroLive {
  // ── network ──
  height: number;
  /** H/s */
  hashrate: number;
  difficulty: number;
  hardfork: string;
  protocol: string;
  /** target seconds between blocks */
  blockTarget: number;

  // ── node / chain meta (from /api/xmr/network) ──
  /** daemon version string, e.g. "0.18.3.4" ("" until known) */
  version: string;
  /** current hard-fork major version (0 until known) */
  majorVersion: number;
  /** fee estimate tiers [slow, normal, fast, fastest] in piconero/B ([] until known) */
  feeTiers: number[];
  /** total transactions on chain, all-time */
  txCountTotal: number;
  topBlockHash: string;
  altBlocksCount: number;
  randomxSeedHash: string;
  /** dynamic block weight limit in bytes */
  blockWeightLimit: number;
  /** median block weight in bytes */
  blockWeightMedian: number;
  /** node database size in bytes */
  databaseSize: number;
  synchronized: boolean;
  /** "mainnet" | "testnet" | "stagenet" ("" until known) */
  nettype: string;
  /** network-adjusted unix time in seconds */
  adjustedTime: number;

  // ── peers (operator PRIMARY node only; public reference pool reports 0/empty) ──
  /** incoming + outgoing connection count (0 on the restricted public pool) */
  peerCount: number;
  incomingPeers: number;
  outgoingPeers: number;
  /** per-peer detail — present only when the operator's primary node is wired (V6) */
  peers?: Peer[];

  // ── mempool / chain ──
  mempool: Tx[];
  blocks: Block[];

  // ── market ──
  /** XMR/USD */
  price: number;
  /** 24h % change for XMR */
  change24h: number;
  /** XMR / BTC ratio */
  btcRatio: number;
  /** BTC/USD */
  btc: number;
  /** 24h % change for BTC */
  btcChg: number;

  // ── series (for sparklines) ──
  hashSeries: number[];
  priceSeries: number[];
  feeHist: number[];

  // ── meta ──
  source: DataSource;
  /** time of the last SUCCESSFUL snapshot fold (0 until the first one lands),
   *  stamped by map.ts. For a per-ENDPOINT freshness time, read
   *  `status[key].at` — that is the one a panel should show. */
  lastUpdate: number;
  /**
   * D1622 — per-endpoint status. Replaces the four booleans `live` / `ready` /
   * `marketReady` / `stale`, which between them described sixteen states, most
   * of them nonsense, while failing to express the two that mattered:
   * "never succeeded and now failing", and "the market specifically is down".
   *
   * Migration, for anyone reading an older call site:
   *   `.ready`       →  hasData(data.status.network)
   *   `.marketReady` →  hasData(data.status.market)
   *   `.stale`       →  feedDegraded(data.status)
   *   `.live`        →  !feedDegraded(data.status)
   */
  status: FeedStatusMap;
}

// ── helpers ──────────────────────────────────────────────────────

export const fmtN = (n: number | null | undefined, d = 0): string => {
  if (n == null || Number.isNaN(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (a >= 1e3) return (n / 1e3).toFixed(2) + "K";
  return Number(n).toFixed(d);
};

export const fmtFee = (n: number | null | undefined): string =>
  n == null ? "—" : n.toFixed(7) + " XMR";

export const fmtBytes = (b: number | null | undefined): string =>
  b == null ? "—" : b < 1024 ? `${b} B` : `${(b / 1024).toFixed(1)} KB`;

export const shortHash = (h: string | null | undefined): string =>
  h ? `${h.slice(0, 8)}…${h.slice(-6)}` : "—";
