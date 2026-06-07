/**
 * data/useMarketHistory.ts — REAL market history for the Markets surface.
 *
 * Independent of the global DataProvider/useMoneroLive() (which stays the source
 * of live spot KPIs). This hook owns all OHLC / line / volume history, fetched
 * through the same-origin /api/coingecko proxy (privacy invariant: the browser
 * never touches the CoinGecko API host directly, no third-party chart libs).
 *
 * Real series are labelled "live"; any series whose fetch fails falls back to a
 * synthetic random-walk for THAT series only, labelled "sim". Never blank — the
 * initial state is a non-empty loading skeleton.
 */

import * as React from "react";

export interface Candle {
  /** bucket start, ms epoch */
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  /** volume in quote currency, aligned from market_chart total_volumes */
  v: number;
}

export type SeriesStatus = "live" | "sim" | "loading";

export interface SeriesResult<T> {
  data: T;
  status: SeriesStatus;
  /** human granularity, e.g. "4h" / "4d" */
  granularityLabel: string;
}

export interface LineSeries {
  label: string;
  color: string;
  data: number[];
  status: SeriesStatus;
  /** optional per-point timestamps (ms) for real X-axis dates */
  t?: number[];
}

export interface MarketHistory {
  loading: boolean;
  days: number;
  /** XMR/USD real OHLC + volume aligned from market_chart(usd) */
  xmrCandles: SeriesResult<Candle[]>;
  /** XMR/BTC ratio history (market_chart vs btc) */
  xmrBtc: SeriesResult<number[]>;
  /** BTC/USD line (market_chart vs usd) */
  btcLine: SeriesResult<number[]>;
  /** XMR + privacy peers, normalised inputs */
  peers: SeriesResult<LineSeries[]>;
  /** XMR + top-coins, normalised inputs */
  top: SeriesResult<LineSeries[]>;
}

export const RANGE_DAYS = { "7D": 7, "30D": 30, "90D": 90, "1Y": 365 } as const;
export type RangeKey = keyof typeof RANGE_DAYS;

/* ── granularity helpers (mirror CoinGecko's ohlc buckets) ─────────── */

/** Label for the candle granularity CoinGecko returns at a given range. */
function granLabel(days: number): string {
  if (days <= 1) return "30m";
  if (days <= 30) return "4h";
  return "4d";
}

/** Approximate candle count for a range — used to size synthetic fallbacks. */
function synthCount(days: number): number {
  if (days <= 1) return 48;        // 30m
  if (days <= 30) return days * 6; // 4h  → 7d≈42, 30d≈180
  return Math.ceil(days / 4);      // 4d  → 90d≈23, 365d≈92
}

/* ── synthetic fallback (per-series, only on failure) ──────────────── */

const SYNTH_ANCHOR: Record<string, [start: number, vol: number]> = {
  monero: [160, 4],
  bitcoin: [60000, 1500],
  zcash: [30, 0.9],
  dash: [25, 0.9],
  "pirate-chain": [0.18, 0.008],
  ethereum: [2800, 75],
  solana: [145, 6],
  binancecoin: [580, 18],
  ripple: [2.4, 0.15],
  cardano: [0.62, 0.04],
};

/** Synthetic OHLC random-walk, timestamps spread across `days`. */
export function genCandles(n: number, start: number, vol: number, days: number): Candle[] {
  const out: Candle[] = [];
  let p = start;
  const now = Date.now();
  const stepMs = (days * 86_400_000) / Math.max(1, n);
  for (let i = 0; i < n; i++) {
    const drift = (Math.random() - 0.48) * vol;
    const o = p;
    const c = Math.max(0.0001, p + drift);
    const range = Math.abs(drift) + vol * 0.5;
    const h = Math.max(o, c) + Math.random() * range;
    const l = Math.min(o, c) - Math.random() * range;
    out.push({ t: now - (n - i) * stepMs, o, h, l, c, v: 1e6 * (0.5 + Math.random() * 1.4) });
    p = c;
  }
  return out;
}

function simCandles(days: number): Candle[] {
  const [s, v] = SYNTH_ANCHOR.monero;
  return genCandles(synthCount(days), s, v, days);
}

function simLineData(coin: string, days: number): number[] {
  const [s, v] = SYNTH_ANCHOR[coin] ?? [100, 3];
  return genCandles(synthCount(days), s, v, days).map((c) => c.c);
}

/* ── in-memory cache (module scope; survives strict-mode remount) ───── */

interface CacheEntry { promise: Promise<unknown>; at: number }
const CACHE = new Map<string, CacheEntry>();
const TTL_MS = 5 * 60_000; // mirror proxy s-maxage=300

function cached<T>(key: string, run: () => Promise<T>): Promise<T> {
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise as Promise<T>;
  // Don't cache failures — let the next caller retry.
  const promise = run().catch((e) => { CACHE.delete(key); throw e; });
  CACHE.set(key, { promise, at: Date.now() });
  return promise;
}

/* ── fetch helpers (no AbortSignal: the promise is shared via CACHE, so
   we guard React state with an `alive` flag instead of aborting it) ─── */

async function getJson(qs: string): Promise<unknown> {
  const r = await fetch(`/api/coingecko?${qs}`);
  if (!r.ok) throw new Error(`CG ${r.status}`);
  return r.json();
}

async function fetchOhlc(coin: string, vs: string, days: number): Promise<Candle[]> {
  const raw = (await cached(`ohlc|${coin}|${vs}|${days}`, () =>
    getJson(`path=coins/${coin}/ohlc&vs_currency=${vs}&days=${days}`))) as number[][];
  if (!Array.isArray(raw) || raw.length === 0) throw new Error("empty ohlc");
  return raw.map((row) => ({ t: row[0], o: row[1], h: row[2], l: row[3], c: row[4], v: 0 }));
}

interface ChartData { prices: [number, number][]; volumes: [number, number][] }

async function fetchChart(coin: string, vs: string, days: number): Promise<ChartData> {
  const d = (await cached(`chart|${coin}|${vs}|${days}`, () =>
    getJson(`path=coins/${coin}/market_chart&vs_currency=${vs}&days=${days}`))) as {
    prices?: [number, number][];
    total_volumes?: [number, number][];
  };
  const prices = Array.isArray(d?.prices) ? d.prices : [];
  const volumes = Array.isArray(d?.total_volumes) ? d.total_volumes : [];
  if (prices.length === 0) throw new Error("empty chart");
  return { prices, volumes };
}

/** Sum market_chart volumes into each candle's [t, nextT) bucket so volume bar
 *  i aligns exactly under candle i (no separate volume time axis needed). */
function attachVolume(candles: Candle[], volumes: [number, number][]): Candle[] {
  if (!volumes.length || !candles.length) return candles;
  return candles.map((c, i) => {
    const lo = c.t;
    const hi = i + 1 < candles.length ? candles[i + 1].t : Infinity;
    let v = 0;
    for (const [t, val] of volumes) if (t >= lo && t < hi) v += val;
    return { ...c, v };
  });
}

function lineOf(label: string, color: string, prices: [number, number][], status: SeriesStatus): LineSeries {
  return { label, color, status, data: prices.map((p) => p[1]), t: prices.map((p) => p[0]) };
}

/* ── coin groups (label, CoinGecko id, color) ──────────────────────── */

type CoinDef = readonly [label: string, id: string, color: string];

const PEER_GROUP: readonly CoinDef[] = [
  ["XMR", "monero", "var(--tk-accent)"],
  ["ZEC", "zcash", "#ffd400"],
  ["DASH", "dash", "#5ed3f4"],
  ["ARRR", "pirate-chain", "#b87aff"],
];

const TOP_GROUP: readonly CoinDef[] = [
  ["XMR", "monero", "var(--tk-accent)"],
  ["BTC", "bitcoin", "var(--ink-100)"],
  ["ETH", "ethereum", "#b87aff"],
  ["SOL", "solana", "#4ade80"],
  ["BNB", "binancecoin", "#ffd400"],
  ["XRP", "ripple", "#5ed3f4"],
  ["ADA", "cardano", "#ff4d6d"],
];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Fetch a group's market_chart lines, staggered to respect CG free-tier; each
 *  id that fails becomes its own "sim" line. */
async function fetchGroup(ids: readonly CoinDef[], vs: string, days: number, startDelay = 0): Promise<LineSeries[]> {
  if (startDelay) await sleep(startDelay);
  const out: LineSeries[] = [];
  for (let i = 0; i < ids.length; i++) {
    const [label, id, color] = ids[i];
    if (i > 0) await sleep(250);
    try {
      const { prices } = await fetchChart(id, vs, days);
      out.push(lineOf(label, color, prices, "live"));
    } catch {
      out.push({ label, color, status: "sim", data: simLineData(id, days) });
    }
  }
  return out;
}

function groupStatus(g: LineSeries[]): SeriesStatus {
  return g.some((s) => s.status === "live") ? "live" : "sim";
}

function initialGroup(ids: readonly CoinDef[], days: number): LineSeries[] {
  return ids.map(([label, id, color]) => ({ label, color, status: "loading" as SeriesStatus, data: simLineData(id, days) }));
}

function initialHistory(days: number): MarketHistory {
  const gl = granLabel(days);
  return {
    loading: true,
    days,
    xmrCandles: { data: simCandles(days), status: "loading", granularityLabel: gl },
    xmrBtc: { data: genCandles(synthCount(days), 0.0035, 0.00008, days).map((c) => c.c), status: "loading", granularityLabel: gl },
    btcLine: { data: simLineData("bitcoin", days), status: "loading", granularityLabel: gl },
    peers: { data: initialGroup(PEER_GROUP, days), status: "loading", granularityLabel: gl },
    top: { data: initialGroup(TOP_GROUP, days), status: "loading", granularityLabel: gl },
  };
}

/* ── the hook ──────────────────────────────────────────────────────── */

export function useMarketHistory(days: number): MarketHistory {
  const [state, setState] = React.useState<MarketHistory>(() => initialHistory(days));

  React.useEffect(() => {
    let alive = true;
    const gl = granLabel(days);
    setState(initialHistory(days)); // reset skeleton for the new range
    const set = (patch: Partial<MarketHistory>) => {
      if (alive) setState((s) => ({ ...s, ...patch }));
    };

    // XMR/USD candles + aligned volume
    const pCandles = (async () => {
      try {
        const [candles, chart] = await Promise.all([
          fetchOhlc("monero", "usd", days),
          fetchChart("monero", "usd", days).catch(
            (): ChartData => ({ prices: [], volumes: [] }),
          ),
        ]);
        set({ xmrCandles: { data: attachVolume(candles, chart.volumes), status: "live", granularityLabel: gl } });
      } catch {
        set({ xmrCandles: { data: simCandles(days), status: "sim", granularityLabel: gl } });
      }
    })();

    // XMR/BTC ratio
    const pBtc = fetchChart("monero", "btc", days)
      .then((r) => set({ xmrBtc: { data: r.prices.map((p) => p[1]), status: "live", granularityLabel: gl } }))
      .catch(() => set({ xmrBtc: { data: genCandles(synthCount(days), 0.0035, 0.00008, days).map((c) => c.c), status: "sim", granularityLabel: gl } }));

    // BTC/USD line
    const pBtcLine = fetchChart("bitcoin", "usd", days)
      .then((r) => set({ btcLine: { data: r.prices.map((p) => p[1]), status: "live", granularityLabel: gl } }))
      .catch(() => set({ btcLine: { data: simLineData("bitcoin", days), status: "sim", granularityLabel: gl } }));

    // peer + top groups, staggered (top delayed to ease free-tier rate caps)
    const pPeers = fetchGroup(PEER_GROUP, "usd", days, 0).then((d) =>
      set({ peers: { data: d, status: groupStatus(d), granularityLabel: gl } }));
    const pTop = fetchGroup(TOP_GROUP, "usd", days, 600).then((d) =>
      set({ top: { data: d, status: groupStatus(d), granularityLabel: gl } }));

    Promise.allSettled([pCandles, pBtc, pBtcLine, pPeers, pTop]).then(() => {
      if (alive) setState((s) => ({ ...s, loading: false }));
    });

    return () => { alive = false; };
  }, [days]);

  return state;
}
