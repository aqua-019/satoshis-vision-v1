/**
 * data/useMarketHistory.ts — REAL market history for the Markets surface.
 *
 * Independent of the global DataProvider/useMoneroLive() (which stays the source
 * of live spot KPIs). This hook owns all OHLC / line / volume history, fetched
 * through the same-origin /api/coingecko proxy (privacy invariant: the browser
 * never touches the CoinGecko API host directly, no third-party chart libs).
 *
 * No synthesis, ever. Each series is:
 *   "live"    — the fetch succeeded this session;
 *   "stale"   — the fetch failed, showing the last-good response from the
 *               localStorage cache (≤7 days old) with a STALE badge;
 *   "loading" — no data yet (first visit + fetch failing); charts render their
 *               empty state and the hook keeps retrying every 45 s.
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

export type SeriesStatus = "live" | "stale" | "loading";

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

/* ── last-good cache (localStorage; survives reloads/outages) ──────── */

export const LS_PREFIX = "mh:v1:";
/** Entries older than this are treated as absent — a week-old chart is no
 *  longer a useful stand-in. */
export const LS_MAX_AGE_MS = 7 * 86_400_000;

export interface CachedSeries<T> {
  at: number;
  data: T;
}

export const cacheKey = (kind: string, coin: string, vs: string, days: number): string =>
  `${LS_PREFIX}${kind}|${coin}|${vs}|${days}`;

type ReadableStore = Pick<Storage, "getItem">;
type WritableStore = Pick<Storage, "setItem">;

/** Parse a cached entry; corrupt JSON, wrong shape, or expiry all → null. */
export function readCache<T>(store: ReadableStore | null, key: string, now = Date.now()): CachedSeries<T> | null {
  if (!store) return null;
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSeries<T>;
    if (typeof parsed?.at !== "number" || parsed.data == null) return null;
    if (now - parsed.at > LS_MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Write a cached entry; quota/private-mode failures are swallowed. */
export function writeCache<T>(store: WritableStore | null, key: string, data: T, now = Date.now()): void {
  if (!store) return;
  try {
    store.setItem(key, JSON.stringify({ at: now, data }));
  } catch {
    /* quota exceeded / private mode — cache is best-effort */
  }
}

function safeStore(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** In-memory last-good values (survive within the session even if localStorage
 *  is unavailable). Keyed identically to the localStorage entries. */
const lastGood = new Map<string, unknown>();

function keep<T>(key: string, data: T): T {
  lastGood.set(key, data);
  writeCache(safeStore(), key, data);
  return data;
}

function recall<T>(key: string): T | null {
  if (lastGood.has(key)) return lastGood.get(key) as T;
  const hit = readCache<T>(safeStore(), key);
  return hit ? hit.data : null;
}

/* ── in-memory promise cache (module scope; survives strict-mode remount) ── */

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

interface CachedLine { data: number[]; t?: number[] }

/** Fetch a group's market_chart lines, staggered to respect CG free-tier; each
 *  id that fails falls back to ITS OWN last-good cache ("stale"), or an empty
 *  "loading" line when no cache exists. */
async function fetchGroup(ids: readonly CoinDef[], vs: string, days: number, startDelay = 0): Promise<LineSeries[]> {
  if (startDelay) await sleep(startDelay);
  const out: LineSeries[] = [];
  for (let i = 0; i < ids.length; i++) {
    const [label, id, color] = ids[i];
    const key = cacheKey("chart", id, vs, days);
    if (i > 0) await sleep(250);
    try {
      const { prices } = await fetchChart(id, vs, days);
      const line: CachedLine = { data: prices.map((p) => p[1]), t: prices.map((p) => p[0]) };
      keep(key, line);
      out.push({ label, color, status: "live", ...line });
    } catch {
      const hit = recall<CachedLine>(key);
      out.push(hit
        ? { label, color, status: "stale", ...hit }
        : { label, color, status: "loading", data: [] });
    }
  }
  return out;
}

/** "live" if anything is live; else "stale" if anything has last-good data;
 *  else still loading. */
export function groupStatus(g: { status: SeriesStatus }[]): SeriesStatus {
  if (g.some((s) => s.status === "live")) return "live";
  if (g.some((s) => s.status === "stale")) return "stale";
  return "loading";
}

function hydrate<T>(key: string, empty: T, gl: string): SeriesResult<T> {
  const hit = recall<T>(key);
  return hit
    ? { data: hit, status: "stale", granularityLabel: gl }
    : { data: empty, status: "loading", granularityLabel: gl };
}

function initialHistory(days: number): MarketHistory {
  const gl = granLabel(days);
  const lines = (ids: readonly CoinDef[]): SeriesResult<LineSeries[]> => {
    const data = ids.map(([label, id, color]): LineSeries => {
      const hit = recall<CachedLine>(cacheKey("chart", id, "usd", days));
      return hit
        ? { label, color, status: "stale", ...hit }
        : { label, color, status: "loading", data: [] };
    });
    return { data, status: groupStatus(data), granularityLabel: gl };
  };
  return {
    loading: true,
    days,
    xmrCandles: hydrate<Candle[]>(cacheKey("ohlc", "monero", "usd", days), [], gl),
    xmrBtc: hydrate<number[]>(cacheKey("ratio", "monero", "btc", days), [], gl),
    btcLine: hydrate<number[]>(cacheKey("line", "bitcoin", "usd", days), [], gl),
    peers: lines(PEER_GROUP),
    top: lines(TOP_GROUP),
  };
}

/* ── the hook ──────────────────────────────────────────────────────── */

/** How long after a non-fully-live settle before refetching. */
const RETRY_MS = 45_000;

export function useMarketHistory(days: number): MarketHistory {
  const [state, setState] = React.useState<MarketHistory>(() => initialHistory(days));
  const [retryNonce, setRetryNonce] = React.useState(0);
  const lastDaysRef = React.useRef(days);

  React.useEffect(() => {
    let alive = true;
    const gl = granLabel(days);
    // Reset to the (cache-hydrated) skeleton only when the RANGE changes;
    // retry runs keep whatever is on screen and upgrade series in place.
    if (lastDaysRef.current !== days) {
      lastDaysRef.current = days;
      setState(initialHistory(days));
    }
    const set = (patch: Partial<MarketHistory>) => {
      if (alive) setState((s) => ({ ...s, ...patch }));
    };

    // XMR/USD candles + aligned volume
    const kCandles = cacheKey("ohlc", "monero", "usd", days);
    const pCandles = (async () => {
      try {
        const [candles, chart] = await Promise.all([
          fetchOhlc("monero", "usd", days),
          fetchChart("monero", "usd", days).catch(
            (): ChartData => ({ prices: [], volumes: [] }),
          ),
        ]);
        set({ xmrCandles: { data: keep(kCandles, attachVolume(candles, chart.volumes)), status: "live", granularityLabel: gl } });
      } catch {
        const hit = recall<Candle[]>(kCandles);
        if (hit) set({ xmrCandles: { data: hit, status: "stale", granularityLabel: gl } });
        // no cache → leave the current (loading) entry; the retry timer re-runs us
      }
    })();

    // XMR/BTC ratio
    const kRatio = cacheKey("ratio", "monero", "btc", days);
    const pBtc = fetchChart("monero", "btc", days)
      .then((r) => set({ xmrBtc: { data: keep(kRatio, r.prices.map((p) => p[1])), status: "live", granularityLabel: gl } }))
      .catch(() => {
        const hit = recall<number[]>(kRatio);
        if (hit) set({ xmrBtc: { data: hit, status: "stale", granularityLabel: gl } });
      });

    // BTC/USD line
    const kBtcLine = cacheKey("line", "bitcoin", "usd", days);
    const pBtcLine = fetchChart("bitcoin", "usd", days)
      .then((r) => set({ btcLine: { data: keep(kBtcLine, r.prices.map((p) => p[1])), status: "live", granularityLabel: gl } }))
      .catch(() => {
        const hit = recall<number[]>(kBtcLine);
        if (hit) set({ btcLine: { data: hit, status: "stale", granularityLabel: gl } });
      });

    // peer + top groups, staggered (top delayed to ease free-tier rate caps)
    const pPeers = fetchGroup(PEER_GROUP, "usd", days, 0).then((d) =>
      set({ peers: { data: d, status: groupStatus(d), granularityLabel: gl } }));
    const pTop = fetchGroup(TOP_GROUP, "usd", days, 600).then((d) =>
      set({ top: { data: d, status: groupStatus(d), granularityLabel: gl } }));

    Promise.allSettled([pCandles, pBtc, pBtcLine, pPeers, pTop]).then(() => {
      if (alive) setState((s) => ({ ...s, loading: false }));
    });

    return () => { alive = false; };
  }, [days, retryNonce]);

  // While anything is not yet "live", schedule a quiet refetch. The timer
  // re-arms off `state` (each settle re-runs this effect) and is cleaned up on
  // unmount/range change, so StrictMode double-mount can't double-fire it.
  React.useEffect(() => {
    if (state.loading) return;
    const statuses = [state.xmrCandles.status, state.xmrBtc.status, state.btcLine.status, state.peers.status, state.top.status];
    if (statuses.every((s) => s === "live")) return;
    const id = setTimeout(() => setRetryNonce((n) => n + 1), RETRY_MS);
    return () => clearTimeout(id);
  }, [state]);

  return state;
}
