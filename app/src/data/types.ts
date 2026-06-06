/**
 * data/types.ts — the wire shape for everything xmr.irish renders.
 *
 * Keep this STABLE. Every visual surface reads from `MoneroLive`. To plug a
 * live data source (Monero RPC, websocket, your worker, claude.ai's stack),
 * implement a provider that yields this shape and pass it via DataContext.
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
  /** pool name; renderers match against the `poolDist` array */
  pool: string;
  /** age in seconds */
  age: number;
  /** confirmations since this block */
  conf: number;
}

export interface Peer {
  ip: string;
  port: number;
  /** peer's reported height */
  h: number;
  /** monerod version string */
  agent: string;
  /** round-trip latency in ms */
  lat: number;
  /** 2-letter ISO country code, or "??" if unknown */
  cnt: string;
}

export interface Pool {
  name: string;
  /** fraction of last-24h shares, 0..1 */
  share: number;
  /** pool fee, 0..1 */
  fee: number;
  type: "decentralized" | "centralized" | "solo";
  /** recommended in our UI */
  rec: boolean;
  /** display hex */
  color: string;
}

export type DataSource = "simulated" | "coingecko" | "rpc" | "ws" | "host";

export interface MoneroLive {
  // ── network ──
  height: number;
  /** H/s */
  hashrate: number;
  difficulty: number;
  nonce: number;
  hardfork: string;
  protocol: string;
  /** target seconds between blocks */
  blockTarget: number;

  // ── pools / peers ──
  peers: Peer[];
  peerIn: number;
  peerOut: number;
  poolDist: Pool[];

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
  lastUpdate: number;
  /** true when at least one external data source is reaching us */
  live: boolean;
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

const HEX = "0123456789abcdef";
export const randHex = (len: number): string => {
  let s = "";
  for (let i = 0; i < len; i++) s += HEX[(Math.random() * 16) | 0];
  return s;
};
