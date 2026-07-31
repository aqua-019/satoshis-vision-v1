/**
 * data/useMarketHistory.ts — REAL market history for the Markets surface.
 *
 * Independent of the global DataProvider/useMoneroLive() (which stays the source
 * of live spot KPIs). This hook owns all OHLC / line / volume history, fetched
 * through the same-origin /api/coingecko proxy (privacy invariant: the browser
 * never touches the CoinGecko API host directly, no third-party chart libs).
 *
 * Group membership (privacy peers, top majors) is NOT hardcoded — it comes from
 * the server-side aggregator at /api/markets, which ranks coins live (market-cap
 * order for majors, a privacy-coins category for peers) and reports its own
 * per-group and per-series status. The client never invents a ranking; on outage
 * it falls back to the last manifest + per-coin caches it persisted itself.
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

/** One ranked coin, charted or not — the full membership manifest for a group. */
export interface GroupMember {
  id: string;
  symbol: string;
  name: string;
  rank: number | null;
  price: number | null;
  marketCap: number | null;
  change24h: number | null;
  charted: boolean;
  pinned?: boolean;
}

export interface GroupResult extends SeriesResult<LineSeries[]> {
  /** full ranking incl. non-charted remainder */
  members: GroupMember[];
  rankStatus: SeriesStatus;
  /** true once an aggregator attempt has settled for this range */
  attempted: boolean;
}

export interface XmrMeta {
  ath: number;
  athDate: string;
  atl: number;
  atlDate: string;
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
  /** XMR + live-ranked privacy peers, normalised inputs */
  peers: GroupResult;
  /** XMR + live-ranked top majors, normalised inputs */
  top: GroupResult;
  /** XMR all-time-high/low, from the aggregator envelope */
  meta: SeriesResult<XmrMeta | null>;
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
export function readCache<T>(
  store: ReadableStore | null,
  key: string,
  now = Date.now(),
  maxAge = LS_MAX_AGE_MS,
): CachedSeries<T> | null {
  if (!store) return null;
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSeries<T>;
    if (typeof parsed?.at !== "number" || parsed.data == null) return null;
    if (now - parsed.at > maxAge) return null;
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

export function safeStore(): Storage | null {
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

/* ── group palette (label/id come from the aggregator; colour is index-keyed) */

export const XMR_COLOR = "var(--tk-accent)";
export const PEER_PALETTE: readonly string[] = ["#ffd400", "#5ed3f4", "#b87aff", "#4ade80", "#ff4d6d"];
export const MAJOR_PALETTE: readonly string[] = [
  "var(--ink-100)", "#b87aff", "#4ade80", "#ffd400", "#5ed3f4", "#ff4d6d", "#f59e0b", "#22d3ee",
];

/** Pure, index-keyed colour lookup so swatch/line/label can never disagree.
 *  Index 0 (XMR, always pinned first) is always XMR_COLOR regardless of group;
 *  index ≥1 walks the group's palette, wrapping defensively. */
export function seriesColor(group: "peers" | "majors", index: number): string {
  if (index <= 0) return XMR_COLOR;
  const palette = group === "peers" ? PEER_PALETTE : MAJOR_PALETTE;
  const i = ((index - 1) % palette.length + palette.length) % palette.length;
  return palette[i];
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

/* ── /api/markets aggregator (server-ranked group membership) ──────── */

type UpstreamStatus = "live" | "stale" | "unavailable";

interface RankingGroup {
  status: UpstreamStatus;
  at: number;
  source: string;
  members: GroupMember[];
  excluded?: { id: string; reason: string }[];
}

interface SeriesMember {
  id: string;
  symbol: string;
  status: UpstreamStatus;
  at: number;
  t: (number | null)[];
  p: (number | null)[];
}

interface MarketsEnvelope {
  v: number;
  days: number;
  fetchedAt: string;
  partial: boolean;
  meta: { status: UpstreamStatus; ath: number | null; athDate: string | null; atl: number | null; atlDate: string | null };
  rankings: { peers: RankingGroup; majors: RankingGroup };
  series: { peers: SeriesMember[]; majors: SeriesMember[] };
}

interface CachedLine { data: number[]; t?: number[] }

async function getMarketsJson(days: number): Promise<MarketsEnvelope> {
  const r = await fetch(`/api/markets?days=${days}`);
  if (!r.ok) throw new Error(`markets ${r.status}`);
  const j = (await r.json()) as MarketsEnvelope | null;
  if (!j || typeof j !== "object" || !j.rankings || !j.series) throw new Error("malformed markets envelope");
  return j;
}

function fetchMarkets(days: number): Promise<MarketsEnvelope> {
  return cached(`markets|${days}`, () => getMarketsJson(days));
}

/** Build a GroupResult from a resolved membership list + optional live series
 *  lookup. Shared by the aggregator success path, its failure fallback, and
 *  boot hydration — the only difference between those three is where `members`
 *  and `seriesLookup` come from. */
function assembleGroup(
  group: "peers" | "majors",
  members: GroupMember[],
  rankStatus: SeriesStatus,
  days: number,
  gl: string,
  attempted: boolean,
  seriesLookup?: (id: string) => SeriesMember | undefined,
): GroupResult {
  const charted = members.filter((m) => m.charted);
  const data: LineSeries[] = charted.map((m, i) => {
    const key = cacheKey("chart", m.id, "usd", days);
    const color = seriesColor(group, i);
    const entry = seriesLookup?.(m.id);
    if (entry && entry.status === "live") {
      const t: number[] = [];
      const p: number[] = [];
      for (let idx = 0; idx < entry.t.length; idx++) {
        const val = entry.p[idx];
        if (val != null && entry.t[idx] != null) { t.push(entry.t[idx] as number); p.push(val); }
      }
      if (p.length > 0) {
        const line: CachedLine = { data: p, t };
        keep(key, line);
        return { label: m.symbol, color, status: "live", ...line };
      }
    }
    const hit = recall<CachedLine>(key);
    return hit
      ? { label: m.symbol, color, status: "stale", ...hit }
      : { label: m.symbol, color, status: "loading", data: [] };
  });
  return { data, status: groupStatus(data), granularityLabel: gl, members, rankStatus, attempted };
}

/** Aggregator responded (HTTP success): resolve this group's membership —
 *  prefer the response's own list, else fall back to the last manifest — and
 *  persist a fresh non-empty manifest so future boots/outages have it. */
function buildGroup(env: MarketsEnvelope, group: "peers" | "majors", days: number, gl: string): GroupResult {
  const ranking = env.rankings[group];
  const manifestKey = cacheKey("members", group, "usd", 0);
  const members = ranking.members.length > 0 ? ranking.members : recall<GroupMember[]>(manifestKey) ?? [];
  if (ranking.members.length > 0) keep(manifestKey, ranking.members);
  const rankStatus: SeriesStatus = ranking.status === "live" ? "live" : members.length > 0 ? "stale" : "loading";
  const seriesList = env.series[group];
  const lookup = (id: string) => seriesList.find((s) => s.id === id);
  return assembleGroup(group, members, rankStatus, days, gl, true, lookup);
}

/** Aggregator request failed outright (network / non-OK / malformed JSON):
 *  fall back entirely to the last persisted manifest + per-coin caches. */
function fallbackGroup(group: "peers" | "majors", days: number, gl: string): GroupResult {
  const members = recall<GroupMember[]>(cacheKey("members", group, "usd", 0)) ?? [];
  const rankStatus: SeriesStatus = members.length > 0 ? "stale" : "loading";
  return assembleGroup(group, members, rankStatus, days, gl, true);
}

/** Boot hydration: identical to fallbackGroup's cache lookup, but no aggregator
 *  attempt has happened yet this session, so `attempted` is false. */
function initGroup(group: "peers" | "majors", days: number, gl: string): GroupResult {
  const members = recall<GroupMember[]>(cacheKey("members", group, "usd", 0)) ?? [];
  const rankStatus: SeriesStatus = members.length > 0 ? "stale" : "loading";
  return assembleGroup(group, members, rankStatus, days, gl, false);
}

const metaCacheKey = () => cacheKey("meta", "monero", "usd", 0);

function metaFromCache(gl: string): SeriesResult<XmrMeta | null> {
  const hit = recall<XmrMeta>(metaCacheKey());
  return hit
    ? { data: hit, status: "stale", granularityLabel: gl }
    : { data: null, status: "loading", granularityLabel: gl };
}

function buildMeta(env: MarketsEnvelope, gl: string): SeriesResult<XmrMeta | null> {
  const m = env.meta;
  if (m && m.status === "live" && m.ath != null && m.athDate != null && m.atl != null && m.atlDate != null) {
    const data: XmrMeta = { ath: m.ath, athDate: m.athDate, atl: m.atl, atlDate: m.atlDate };
    keep(metaCacheKey(), data);
    return { data, status: "live", granularityLabel: gl };
  }
  return metaFromCache(gl);
}

function initialHistory(days: number): MarketHistory {
  const gl = granLabel(days);
  return {
    loading: true,
    days,
    xmrCandles: hydrate<Candle[]>(cacheKey("ohlc", "monero", "usd", days), [], gl),
    xmrBtc: hydrate<number[]>(cacheKey("ratio", "monero", "btc", days), [], gl),
    btcLine: hydrate<number[]>(cacheKey("line", "bitcoin", "usd", days), [], gl),
    peers: initGroup("peers", days, gl),
    top: initGroup("majors", days, gl),
    meta: metaFromCache(gl),
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

    // peers + majors ranking/series + XMR meta — one aggregator round trip,
    // shared via the module-scope `cached()` promise map so StrictMode's
    // double-mount and the two group consumers below share one request.
    const pMarkets = fetchMarkets(days)
      .then((env) => set({
        peers: buildGroup(env, "peers", days, gl),
        top: buildGroup(env, "majors", days, gl),
        meta: buildMeta(env, gl),
      }))
      .catch(() => set({
        peers: fallbackGroup("peers", days, gl),
        top: fallbackGroup("majors", days, gl),
        meta: metaFromCache(gl),
      }));

    Promise.allSettled([pCandles, pBtc, pBtcLine, pMarkets]).then(() => {
      if (alive) setState((s) => ({ ...s, loading: false }));
    });

    return () => { alive = false; };
  }, [days, retryNonce]);

  // While anything is not yet "live", schedule a quiet refetch. The timer
  // re-arms off `state` (each settle re-runs this effect) and is cleaned up on
  // unmount/range change, so StrictMode double-mount can't double-fire it.
  React.useEffect(() => {
    if (state.loading) return;
    const statuses = [
      state.xmrCandles.status, state.xmrBtc.status, state.btcLine.status,
      state.peers.status, state.top.status, state.meta.status,
    ];
    if (statuses.every((s) => s === "live")) return;
    const id = setTimeout(() => setRetryNonce((n) => n + 1), RETRY_MS);
    return () => clearTimeout(id);
  }, [state]);

  return state;
}
