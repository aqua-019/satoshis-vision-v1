/**
 * pages/MarketsPage.tsx — the Markets surface.
 *
 * XMR/USD candles, XMR/BTC ratio, a live-ranked "vs Top N majors" comparison,
 * and a full-width privacy peer-group chart — both group memberships come
 * from the /api/markets aggregator, not a hardcoded coin list (see
 * useMarketHistory.ts). Real per-exchange volume/spread and a liquidity-by-
 * venue breakdown round out the page.
 *
 * HONESTY: spot KPIs (XMR/USD, XMR/BTC, market cap) are LIVE via useMoneroLive()
 * and render "—" until the first CoinGecko response lands. Candle + line history
 * is REAL — useMarketHistory() pulls CoinGecko OHLC + market_chart through the
 * same-origin /api/coingecko proxy, and group membership + ATH/ATL through the
 * same-origin /api/markets aggregator; a series whose fetch fails shows its
 * last-good cached data labelled "COINGECKO · stale" (never a fabricated
 * fallback), and a group with zero live *and* zero cached members renders an
 * honest "unavailable" badge instead of an empty chart pretending to be live.
 * Exchange volume/spread rows come from CoinGecko's tickers endpoint (real,
 * per-venue). Atomic-swap/P2P venues don't publish volume — they are listed as
 * a directory without numbers, badged with ProvNote since curated editorial
 * content has no upstream source to attribute. Charts are hand-rolled SVG; no
 * third-party / CDN chart libraries (privacy invariant).
 */

import * as React from "react";
import { PageShell } from "@/layout/PageShell";
import { PageHeader } from "@/layout/AppShell";
import { useMoneroLive } from "@/data/DataContext";
import { Stat, PanelFrame, Crumbs, Provenance, NodeProvenance, DataLegend } from "@/design/primitives";
import { ProvNote, type ProvFreshness } from "@/design/provenance";
import {
  useMarketHistory,
  RANGE_DAYS,
  type RangeKey,
  type SeriesStatus,
  type LineSeries,
  type GroupResult,
  type PairBases,
  type PriceSamples,
} from "@/data/useMarketHistory";
import { useTickers } from "@/data/useTickers";
import { MultiLine, AreaSeries } from "./markets/charts";
import { CandleCanvas, type TimeWindow } from "./markets/CandleCanvas";
import { ALL_LAYERS, AnnotationLayers, type LayerState } from "./markets/annotations";
import { DAY_MS, baseSpanMs, type DrawnSeries } from "./markets/candle-data";
import { assertNever, hasData } from "@/data/feed-status";
import { useUrlState } from "@/routes/useUrlState";
import { Swap, SkeletonBox, SkeletonRows } from "@/design/Skeleton";
import { PanelBoundary } from "@/design/PanelBoundary";
import { usePendingDelay } from "@/design/usePendingDelay";
import { R } from "../../scripts/routes.mjs";

/** Hoisted so useUrlState's setter identity is stable across renders. The
 *  order here is RANGE_DAYS' own key order, which is also the button order. */
const RANGE_KEYS = Object.keys(RANGE_DAYS) as RangeKey[];
const DEFAULT_RANGE: RangeKey = "30D";

/* Chart formatters are hoisted to module scope so their identity is stable
   across renders. `AreaSeries`/`BarSeries` are React.memo'd (see
   pages/markets/charts.tsx) and an inline `format={(v) => …}` arrow allocates
   a fresh function every render, which defeats the boundary entirely. None of
   these close over anything, so module scope is where they belonged anyway. */
const fmtSat = (v: number): string => (v * 1e5).toFixed(0) + " sat";


/**
 * SeriesStatus → <Provenance> props.
 *
 * `SeriesStatus` gained an "error" member in v6.1.4 (it is `FeedPhase` now), and
 * `ProvFreshness` has no matching member yet — extending the badge's own
 * vocabulary belongs with the freshness work, not with the type unification. So
 * "error" reuses the phrase this page ALREADY uses for "we asked and there is
 * nothing", rather than inventing a second spelling of it.
 */
function freshProps(status: SeriesStatus): { fresh: ProvFreshness; detail?: string } {
  switch (status) {
    case "error": return { fresh: "error" };
    case "loading": return { fresh: "loading" };
    case "live": return { fresh: "live" };
    case "stale": return { fresh: "stale" };
    default: return assertNever(status, "MarketsPage freshProps", { fresh: "none" as ProvFreshness });
  }
}

/** Source label for a single series — COINGECKO with a freshness suffix.
 *  Stale renders the canonical "COINGECKO · stale" (freshness, orthogonal to source). */
function SourceBadge({ status, prefix }: { status: SeriesStatus; prefix?: string }) {
  const f = freshProps(status);
  return <Provenance source="coingecko" fresh={f.fresh} detail={prefix ?? f.detail} />;
}

/** Source label for a group of series (counts stale fallbacks). Covers the
 *  "attempted, still nothing" case honestly instead of showing a bare
 *  "loading" forever. */
function GroupBadge({ result }: { result: GroupResult }) {
  // `error` IS "attempted, still nothing" — assembleGroup promotes it now, so
  // this no longer reconstructs the condition from a boolean beside the union.
  const total = result.data.length;
  const stales = result.data.filter((s) => s.status !== "live").length;
  switch (result.status) {
    case "error":
      return <Provenance source="coingecko" fresh="error" />;
    case "loading":
      return <Provenance source="coingecko" fresh="loading" />;
    case "live":
    case "stale":
      return stales === 0
        ? <Provenance source="coingecko" fresh="live" detail={`${total} live`} />
        : <Provenance source="coingecko" fresh="stale" detail={`${total - stales}/${total} live · ${stales} stale`} />;
    default:
      return assertNever(result.status, "MarketsPage GroupBadge");
  }
}

/** Compact color-swatch legend for a `labels={false}` MultiLine — one line
 *  per series with its live last-value % and a stale suffix when relevant.
 *  Originally built for the peer chart; now used by whichever MultiLine is
 *  in the half-width slot (currently majors). */
function SeriesSwatchLegend({ series }: { series: LineSeries[] }) {
  return (
    <div className="mono" style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 8, fontSize: "var(--fs-label)", minHeight: "1.6em" }}>
      {series.map((s) => {
        const base = s.data.find((v) => v > 0) ?? s.data[0] ?? 1;
        const lastPct = s.data.length ? (s.data[s.data.length - 1] / base - 1) * 100 : null;
        return (
          <span key={s.label} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, boxShadow: `0 0 4px ${s.color}` }} />
            <span className="dim">{s.label}</span>
            <b style={{ color: s.color }}>{lastPct == null ? "—" : (lastPct >= 0 ? "+" : "") + lastPct.toFixed(1) + "%"}{s.status === "stale" ? " ·stale" : ""}</b>
          </span>
        );
      })}
    </div>
  );
}

/** $12.3M / $980K style volume/market-cap formatter. */
function fmtUsd(v: number): string {
  if (v >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
  return "$" + (v / 1e3).toFixed(0) + "K";
}

/** Price cell for the privacy-group "also in top N" remainder row:
 *  null → em dash (never 0), 2dp at ≥$1, 4dp below (small-cap coins need it). */
function fmtPeerPrice(v: number | null): string {
  if (v == null) return "—";
  return "$" + (v >= 1 ? v.toFixed(2) : v.toFixed(4));
}

/** "Jan 2018" style month+year from an ISO date string (ATH/ATL dates). */
function monthYear(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/** Monero emission: ~18.132M at the tail-emission switch (block 2,641,623),
 *  then exactly 0.6 XMR per block forever. Same constants as the backend.
 *  These three numbers are consensus parameters baked into the protocol —
 *  not stale/fetched data, so they are never cache-invalidated or badged
 *  themselves. `circ` (derived from them × the live node height) becomes
 *  genuinely two-sourced once the market-cap tile multiplies it by
 *  CoinGecko's price: SESSION (node height, computed in-browser) ×
 *  COINGECKO (live price) — hence the compound `also="session"` badge on
 *  that tile. */
const TAIL_START_HEIGHT = 2_641_623;
const SUPPLY_AT_TAIL = 18_132_000;
const TAIL_REWARD = 0.6;

/** Row caps — exchange-volume table, liquidity-by-venue panel, and the
 *  "also in top N" text row under the privacy chart. */
const TOP_TICKERS_LIMIT = 10;
const VENUES_LIMIT = 8;
const PEER_REMAINDER_LIMIT = 4;

/** Spread color thresholds (percent) — shared by the exchange-volume table
 *  and the liquidity-by-venue panel. */
const SPREAD_GOOD_MAX = 0.3;
const SPREAD_OK_MAX = 1;

/** Chart heights for the ratio + majors row: equal PANEL heights (not equal
 *  chart heights) — the ratio panel carries an extra ~22px caption below its
 *  chart, so its chart prop is shorter to keep both panel frames terminating
 *  at the same y. The privacy chart is full-width and independent of this
 *  row's alignment constraint. */
const RATIO_CHART_HEIGHT = 318;
const MAJORS_CHART_HEIGHT = 340;
const PRIVACY_CHART_HEIGHT = 300;
/** The candle panel's chart height — hoisted to a name so the CandleChart
 *  prop, its Swap `reserve` and its PanelBoundary `reserve` read the same
 *  number instead of three independently-typed 320s. */
const CANDLE_CHART_HEIGHT = 320;

/** Column templates, each declared once and consumed by BOTH the real grid
 *  (the table's `--mk-cols` / row `gridTemplateColumns`) and its SkeletonRows
 *  placeholder — so a skeleton row can never drift out of alignment with the
 *  columns it is standing in for. */
const TICKER_COLS = "130px 1fr 80px 70px";
const LIQUIDITY_COLS = "minmax(90px, 120px) 1fr minmax(70px, 90px) minmax(64px, 80px)";

/** Minimum height for an N-row skeleton reservation, matching SkeletonRows'
 *  own defaults (rowH=18, gap=8) so the placeholder and the reservation agree
 *  on what "N rows" means — one pair of numbers driving both, not two guesses
 *  that can drift apart. */
function rowsHeight(n: number, rowH = 18, gap = 8): number {
  return n * rowH + Math.max(0, n - 1) * gap;
}

/**
 * Three distinct "nothing to chart" reasons a MultiLine group panel (XMR vs
 * Top N / privacy peers) can be in, replacing an empty state that used to
 * claim COINGECKO · unavailable unconditionally regardless of whether the
 * group was still arriving or had genuinely failed. Mirrors tickerEmptyCopy's
 * split below; worded for a ranked history group so the two never share a
 * sentence. None of the three contains "loading" — see SUSPENDED_RE in
 * entry-ssr.tsx, which fails the prerendered build on that substring.
 */
function historyEmptyCopy(status: SeriesStatus): string {
  if (status === "error") return "/api/markets is not responding — group ranking unavailable.";
  if (status === "loading") return "Awaiting CoinGecko history…";
  return "No members normalized to a usable history — nothing to chart.";
}

/**
 * Same three-way split as historyEmptyCopy, worded for the tickers endpoint
 * that feeds the exchange-volume table and the liquidity-by-venue panel
 * (both read useTickers → /api/coingecko). Replaces the single "Awaiting
 * CoinGecko tickers…" string that used to stand for "still cold", "answered
 * with nothing" and "endpoint down" alike — the same conflation this file's
 * brief called out.
 */
function tickerEmptyCopy(status: SeriesStatus): string {
  if (status === "error") return "/api/coingecko is not responding — exchange data unavailable.";
  if (status === "loading") return "Awaiting CoinGecko tickers…";
  return "CoinGecko listed zero active XMR pairs — nothing to show.";
}

/** Exchanges that delisted XMR — factual events, shown without numbers. */
const DELISTED = [
  { name: "Binance", note: "delisted Feb 2024" },
  { name: "OKX (EEA)", note: "delisted 2024" },
  { name: "Kraken (UK/EEA)", note: "delisted 2024" },
];

/** Atomic-swap / P2P venues. None of these publish 24h volume figures, so this
 *  is a directory, not a leaderboard. */
const SWAP_DIRECTORY = [
  { name: "Haveno", pair: "XMR↔BTC, EUR, USD", type: "atomic · DEX" },
  { name: "BasicSwap", pair: "XMR↔BTC, LTC, BCH", type: "atomic · DEX" },
  { name: "RetoSwap", pair: "XMR↔ETH, USDC", type: "atomic · DEX" },
  { name: "FixedFloat", pair: "XMR↔20+ assets", type: "instant-swap" },
  { name: "SimpleSwap", pair: "XMR↔100+ assets", type: "instant-swap" },
  { name: "ChangeNOW", pair: "XMR↔200+ assets", type: "instant-swap" },
  { name: "Bisq", pair: "XMR↔fiat (P2P)", type: "p2p" },
  { name: "LocalMonero", pair: "—", type: "p2p · shut down 2024" },
];

/**
 * A ratio/line series windowed out of a sample base, strided to something an
 * SVG path can carry. 2,160 hourly samples is one `<path d>` of ~2,100 cubic
 * segments — a ~100 kB attribute string rebuilt on every brush move — and the
 * chart is 320 px wide at its narrowest, so nothing past a few hundred points
 * is resolvable anyway. The stride is uniform and drops points; it never
 * averages them, because an averaged point is a value the market never printed.
 */
const LINE_MAX_POINTS = 420;

function windowSamples(src: PriceSamples | null, win: TimeWindow): { data: number[]; t: number[] } {
  if (!src) return { data: [], t: [] };
  const t: number[] = [], data: number[] = [];
  for (let i = 0; i < src.t.length; i++) {
    if (src.t[i] < win.from || src.t[i] > win.to) continue;
    t.push(src.t[i]); data.push(src.p[i]);
  }
  const stride = Math.max(1, Math.ceil(data.length / LINE_MAX_POINTS));
  if (stride === 1) return { data, t };
  const dt: number[] = [], dd: number[] = [];
  for (let i = 0; i < data.length; i += stride) { dt.push(t[i]); dd.push(data[i]); }
  // Always keep the newest point: a stride that lands short of the end would
  // silently move "last price" backwards by up to `stride` samples.
  if (dt[dt.length - 1] !== t[t.length - 1] && t.length) { dt.push(t[t.length - 1]); dd.push(data[data.length - 1]); }
  return { data: dd, t: dt };
}

/** Which of a pair's two bases covers a window. Mirrors candle-data's pickBase;
 *  a LINE has no bucket ladder, so it only needs the coverage half. */
function pickPair(p: PairBases, win: TimeWindow): { samples: PriceSamples | null; status: SeriesStatus; at: number } {
  const deepNeeded = win.to - win.from > baseSpanMs("mid");
  const chosen = deepNeeded ? p.deep : p.mid;
  if (chosen.data) return { samples: chosen.data, status: chosen.status, at: chosen.at };
  const other = deepNeeded ? p.mid : p.deep;
  return { samples: other.data, status: other.data ? other.status : chosen.status, at: other.data ? other.at : chosen.at };
}

export function MarketsPage() {
  const data = useMoneroLive();
  // `?range=` is a SECONDARY, high-frequency control of the SAME content, so
  // it REPLACES rather than pushes: Back should leave /markets, not walk back
  // through four range clicks. `clearAtFallback` keeps the canonical URL
  // clean — /markets with no parameter renders 30D, so selecting 30D writes
  // no parameter at all instead of pinning the default into the URL. It was
  // `React.useState<RangeKey>("30D")` before, which meant the range you were
  // looking at could not be shared or bookmarked at all.
  const [range, setRange] = useUrlState<RangeKey>({
    key: "range",
    values: RANGE_KEYS,
    fallback: DEFAULT_RANGE,
    replace: true,
    clearAtFallback: true,
  });
  const days = RANGE_DAYS[range];

  /* THE WINDOW, and why it is state rather than a function of `range`.
     A preset now MOVES the brush: it writes a window, and the brush writes one
     back. If the window were derived from `range` the brush could not exist —
     every drag would be reverted on the next render. `range` survives as the
     preset that seeded it (and as the aggregator's `days`), so the URL, the
     panel titles and the group memberships all keep working unchanged. */
  const [win, setWin] = React.useState<TimeWindow>(() => {
    const to = Date.now();
    return { from: to - RANGE_DAYS[range] * DAY_MS, to };
  });
  /* A window deeper than the MID base is the ONLY thing that fetches the deep
     base. Held as state, never reset: once a reader has been to a year, walking
     back to 7D must not throw the year's data away and re-buy it. */
  const [wantDeep, setWantDeep] = React.useState(() => RANGE_DAYS[range] * DAY_MS > baseSpanMs("mid"));
  React.useEffect(() => {
    if (win.to - win.from > baseSpanMs("mid")) setWantDeep(true);
  }, [win.from, win.to]);

  /* THE WINDOW'S RIGHT EDGE IS THE DATA'S, NOT THE CLOCK'S.
     `Date.now()` is the obvious anchor and it is wrong: CoinGecko's history
     lags real time (its own edge cache, plus this proxy's hour), so a window
     ending at "now" reserves the right-hand slice of the plot for candles that
     do not exist yet. At 7D that slice was the WHOLE WINDOW in testing — a
     legitimately-populated chart rendering zero bars, which reads as an outage.
     So the anchor is the newest fetched sample once anything has arrived, and
     the clock only until then. */
  const spanRef = React.useRef<TimeWindow | null>(null);
  const anchorNow = React.useCallback(() => spanRef.current?.to ?? Date.now(), []);

  const setRangeAndWindow = React.useCallback((r: RangeKey) => {
    setRange(r);
    const to = anchorNow();
    setWin({ from: to - RANGE_DAYS[r] * DAY_MS, to });
  }, [setRange, anchorNow]);

  // REAL market history (CoinGecko via /api/coingecko + /api/markets); failures
  // degrade to the last-good cache per series, labelled STALE.
  const hist = useMarketHistory(days, wantDeep);
  const tickers = useTickers();
  const peerSeries = hist.peers.data;
  const topSeries = hist.top.data;

  /* What the hero reports back about the series it actually drew — the bucket
     it chose and the base it came from. The panel header states it verbatim, so
     "180 bars · 4h · CG OHLC" is the chart describing itself rather than the
     page guessing from `days`. */
  const [drawnSeries, setDrawnSeries] = React.useState<DrawnSeries | null>(null);

  /* D0833 — the annotation layer's controls.
     SESSION STATE, deliberately not `useUrlState`. `?range=` earns its place in
     the URL because it changes what the page IS; four booleans that hide dots
     do not, and putting them there would make every shared markets link carry
     four query params nobody meant to publish. */
  const [layers, setLayers] = React.useState<LayerState>(ALL_LAYERS);
  const [flags, setFlagCount] = React.useState({ inView: 0, outside: 0, unplaceable: 0 });

  /* THE HONEST NOTE, and it is doing real work rather than decorating.
     The deepest base this page fetches is DEEP_DAYS = 365 (useMarketHistory),
     and the timeline runs from 2008 — so the overwhelming majority of it is
     unreachable from any window this chart can show, and at the 30D preset the
     reachable count is routinely ZERO. An empty axis with no explanation reads
     as "there is nothing to say"; the count says "there is plenty, it is just
     not in this window", which is the true statement and the one that makes
     the brush strip's own flags worth looking for. `unplaceable` is the
     separate case: events inside the window whose date is an interval too wide
     to carry a position (a bare "2026"), reported rather than smeared across
     the plot. */
  const flagNote = React.useMemo(() => {
    const bits: string[] = [];
    if (flags.inView) bits.push(`${flags.inView} in view`);
    if (flags.unplaceable) bits.push(`${flags.unplaceable} undated at this zoom`);
    if (flags.outside) bits.push(`${flags.outside} outside this window`);
    return bits.length ? bits.join(" · ") : "no timeline events in range";
  }, [flags]);

  /* The brush shows everything FETCHED, not everything drawn. Deep when it has
     arrived, else mid, else the fine base — whichever reaches furthest back. */
  const fullSpan: TimeWindow | null = React.useMemo(() => {
    const cands = [hist.usd.deep.data, hist.usd.mid.data]
      .filter((x): x is PriceSamples => !!x && x.t.length > 1)
      .map((x) => ({ from: x.t[0], to: x.t[x.t.length - 1] }));
    if (hist.fine.data.length > 1) {
      const f = hist.fine.data;
      cands.push({ from: f[0].t, to: f[f.length - 1].t });
    }
    if (!cands.length) return null;
    return {
      from: Math.min(...cands.map((c) => c.from)),
      to: Math.max(...cands.map((c) => c.to)),
    };
  }, [hist.usd.deep.data, hist.usd.mid.data, hist.fine.data]);

  spanRef.current = fullSpan;
  /* One-way clamp on the RIGHT EDGE ONLY, and the asymmetry is the whole point.
     Pulling `to` back onto the newest fetched sample fixes the empty-chart case
     above. Pulling `from` forward would ALSO look reasonable and is a bug: the
     1Y preset writes a 365-day window while only the 90-day base has landed, so
     a both-edges clamp shortens it to 90 days — and since the clamp only ever
     shrinks, the deep base then arrives to find nothing left asking for it.
     Measured before the fix: 1Y reported "361 bars · 6h · hourly samples",
     which is a correct rendering of a window the reader did not select.
     A window reaching back past the fetched data just draws a gap on the left
     until the deeper base fills it, which is what a gap is for. */
  React.useEffect(() => {
    if (!fullSpan) return;
    setWin((w) => (w.to <= fullSpan.to ? w : { from: w.from - (w.to - fullSpan.to), to: fullSpan.to }));
  }, [fullSpan]);

  const ratioPick = pickPair(hist.btc, win);
  const ratioWin = React.useMemo(() => windowSamples(ratioPick.samples, win), [ratioPick.samples, win.from, win.to]);
  const xmrBtcSeries = ratioWin.data;
  const candleStatus: SeriesStatus = hist.fine.status === "live" || hist.usd.mid.status === "live" ? "live"
    : hist.fine.data.length || hist.usd.mid.data ? "stale" : hist.fine.status;

  /* THE TITLE MUST NAME WHAT IS DRAWN. Once a brush exists, "30D candles" is a
     claim the chart stops keeping the moment anyone drags — so the preset name
     is used only while the window still IS that preset (within a day, which is
     the granularity a reader can perceive in a title), and otherwise the title
     states the span it is actually showing. The GROUP panels below keep saying
     `range` and are right to: they are fetched at that range and the brush does
     not reach them. */
  const winDays = (win.to - win.from) / DAY_MS;
  const windowLabel = Math.abs(winDays - days) < 1
    ? range
    : winDays < 2 ? `${Math.round(winDays * 24)}h window`
    : winDays < 400 ? `${Math.round(winDays)}d window`
    : `${(winDays / 365).toFixed(1)}y window`;

  // D0858: a fetch round for useMarketHistory's endpoints is on the wire right
  // now. usePendingDelay keeps a fast (cached-TTL) round from flickering the
  // header chip; it gates the INDICATOR only — none of the data above waits
  // on it. useTickers exposes no equivalent flag, so the two ticker-fed panels
  // below pass no `refreshing` prop at all rather than a fabricated one.
  const historyPending = usePendingDelay(hist.refreshing);
  // Same "still cold" signal PanelFrame's chart panels use, expressed for the
  // two ticker-driven table panels: topTickers/venues are provably non-empty
  // whenever tickers.status is anything but "loading" (useTickers never
  // resolves to "live"/"stale" with a zero-length array — see useTickers.ts),
  // so this is the exact complement of "still waiting".
  const tickersReady = tickers.status !== "loading";

  const ratioFloor = xmrBtcSeries.length ? Math.min(...xmrBtcSeries) : 0;
  const ratioPeak = xmrBtcSeries.length ? Math.max(...xmrBtcSeries) : 0;
  const lastRatio = xmrBtcSeries.length ? xmrBtcSeries[xmrBtcSeries.length - 1] : 0;

  // Live-ranked group membership (from the aggregator, not hardcoded lists).
  const majorsCount = topSeries.length;
  const chartedPeerSymbols = peerSeries.map((s) => s.label).join(" · ");
  const peerRemainder = hist.peers.members.filter((m) => !m.charted).slice(0, PEER_REMAINDER_LIMIT);

  // Real circulating supply from the chain height (tail emission is linear).
  const circ = hasData(data.status.network) ? SUPPLY_AT_TAIL + Math.max(0, data.height - TAIL_START_HEIGHT) * TAIL_REWARD : 0;

  const tickerVolume = tickers.data.reduce((a, t) => a + t.volUsd, 0);
  const topTickers = tickers.data.slice(0, TOP_TICKERS_LIMIT);

  // Liquidity by venue: aggregate pair volumes per exchange, best spread shown.
  const venues = React.useMemo(() => {
    const m = new Map<string, { venue: string; volUsd: number; spreadPct: number }>();
    for (const t of tickers.data) {
      const cur = m.get(t.venue);
      if (cur) {
        cur.volUsd += t.volUsd;
        cur.spreadPct = Math.min(cur.spreadPct, t.spreadPct);
      } else {
        m.set(t.venue, { venue: t.venue, volUsd: t.volUsd, spreadPct: t.spreadPct });
      }
    }
    return [...m.values()].sort((a, b) => b.volUsd - a.volUsd).slice(0, VENUES_LIMIT);
  }, [tickers.data]);
  const maxVenueVol = venues.length ? venues[0].volUsd : 1;

  return (
    <PageShell width="standard" rail bg={{ intensity: "calm" }}>
      <Crumbs path={R.LIVE_MARKETS} status={<NodeProvenance source="coingecko" keys={["market"]} status={data.status} />} />
      <DataLegend sources={["coingecko"]} />
      <PageHeader
        kicker="Markets · price, volume, liquidity"
        title='Markets — <em style="color:var(--tk-accent);text-shadow:var(--glow-1);font-style:normal">where XMR trades</em>.'
        sub="Spot price, peer-group performance, real per-exchange volume and spreads. Delistings tracked separately."
        right={
          <div style={{ display: "flex", gap: 4 }}>
            {RANGE_KEYS.map((r) => (
              <button key={r} type="button" aria-pressed={range === r} onClick={() => setRangeAndWindow(r)} className="proto-btn"
                style={{
                  padding: "5px 10px", fontSize: "var(--fs-label)",
                  borderColor: range === r ? "var(--tk-accent)" : "var(--ink-20)",
                  color: range === r ? "var(--tk-accent)" : "var(--ink-60)",
                  boxShadow: range === r ? "var(--glow-1)" : "none",
                }}>{r}</button>
            ))}
          </div>
        }
      />

      {/* KPI row */}
      <section className="kpi-grid" style={{ ["--kpi-cols" as any]: 6, gap: 10 }}>
        <Stat k="XMR / USD" v={hasData(data.status.market) ? `$${data.price.toFixed(2)}` : "—"} sub={hasData(data.status.market) ? `${data.change24h >= 0 ? "+" : ""}${data.change24h.toFixed(2)}% · 24h` : "connecting"} tone="acc" />
        <Stat k="XMR / BTC" v={hasData(data.status.market) ? data.btcRatio.toFixed(6) : "—"} sub={xmrBtcSeries.length ? `Range ${ratioFloor.toFixed(5)}–${ratioPeak.toFixed(5)}` : "—"} />
        <Stat
          k="Market cap"
          v={hasData(data.status.market) && circ > 0 ? `$${((data.price * circ) / 1e9).toFixed(2)}B` : "—"}
          sub={circ > 0 ? (<>{(circ / 1e6).toFixed(2)}M circ · tail emission <Provenance source="coingecko" also="session" bare /></>) : "—"}
        />
        <Stat k="24h volume" v={tickers.status === "loading" ? "—" : fmtUsd(tickerVolume)} sub={tickers.status === "loading" ? "CG tickers" : `CG tickers · ${tickers.data.length} pairs`} />
        <Stat
          k="ATH"
          v={hist.meta.data ? `$${hist.meta.data.ath.toFixed(2)}` : "—"}
          sub={hist.meta.data ? (<>{monthYear(hist.meta.data.athDate)} <Provenance source="coingecko" {...freshProps(hist.meta.status)} bare /></>) : "—"}
        />
        <Stat
          k="ATL"
          v={hist.meta.data ? `$${hist.meta.data.atl.toFixed(2)}` : "—"}
          sub={hist.meta.data ? (<>{monthYear(hist.meta.data.atlDate)} <Provenance source="coingecko" {...freshProps(hist.meta.status)} bare /></>) : "—"}
        />
      </section>

      {/* Candle chart — canvas hero + brush + accessible table (D0843/D0835/D0847) */}
      <PanelFrame
        title={`XMR / USD · ${windowLabel} candles`}
        right={<SourceBadge status={candleStatus} prefix={`${drawnSeries?.candles.length ?? 0} bars · ${drawnSeries?.granularityShort ?? "—"}`} />}
        updatedAt={hist.fine.at || hist.usd.mid.at}
        refreshing={historyPending}
      >
        <PanelBoundary keys={["market"]} also="/api/markets" reserve={CANDLE_CHART_HEIGHT} onRetry={hist.retry} resetKeys={[hist.fine.at]}>
          <Swap ready={candleStatus !== "loading"} reserve={CANDLE_CHART_HEIGHT} skeleton={<SkeletonBox w="100%" h={CANDLE_CHART_HEIGHT} radius={3} />}>
            <CandleCanvas
              fine={hist.fine.data.length ? hist.fine.data : null}
              mid={hist.usd.mid.data}
              deep={hist.usd.deep.data}
              window={win}
              onWindow={setWin}
              fullSpan={fullSpan}
              height={CANDLE_CHART_HEIGHT}
              status={candleStatus}
              onSeries={setDrawnSeries}
              annLayers={layers}
              onFlags={setFlagCount}
              controls={<AnnotationLayers layers={layers} onChange={setLayers} note={flagNote} />}
            />
          </Swap>
        </PanelBoundary>
        <p className="mono dim cc-help" style={{ marginTop: 8, fontSize: "var(--fs-label)" }}>
          Drag the strip to pan · drag an edge to resize · double-click to reset.
          Range buttons move the window; they do not refetch.
          Hover any chart to read the same moment on all four; click to pin it.
        </p>
      </PanelFrame>

      {/* XMR/BTC ratio + XMR vs Top majors */}
      <section className="col-2" style={{ gap: 12 }}>
        <PanelFrame title={`XMR / BTC · ratio · ${windowLabel}`} right={<SourceBadge status={ratioPick.status} prefix={xmrBtcSeries.length ? `${(lastRatio * 1e5).toFixed(2)} sat` : undefined} />} updatedAt={ratioPick.at} refreshing={historyPending}>
          <PanelBoundary keys={["market"]} also="/api/markets" reserve={RATIO_CHART_HEIGHT} onRetry={hist.retry} resetKeys={[ratioPick.at]}>
            <Swap ready={ratioPick.status !== "loading"} reserve={RATIO_CHART_HEIGHT} skeleton={<SkeletonBox w="100%" h={RATIO_CHART_HEIGHT} radius={3} />}>
              <AreaSeries data={xmrBtcSeries} t={ratioWin.t} days={winDays} height={RATIO_CHART_HEIGHT}
                color="var(--tk-accent)" baseline="auto"
                format={fmtSat}
                sync syncLabel="XMR/BTC"
                stale={ratioPick.status === "stale"} />
            </Swap>
          </PanelBoundary>
          <p className="mono dim" style={{ marginTop: 8, fontSize: "var(--fs-mono)" }}>
            {xmrBtcSeries.length ? (
              <>Floor: <b className="acc">{(ratioFloor * 1e5).toFixed(2)} sat</b> · Peak: <b className="acc">{(ratioPeak * 1e5).toFixed(2)} sat</b></>
            ) : (
              <>Awaiting CoinGecko history…</>
            )}
          </p>
        </PanelFrame>
        <PanelFrame title={`XMR vs Top ${majorsCount || "—"} · normalized % · ${range}`} right={<GroupBadge result={hist.top} />} updatedAt={hist.top.at} refreshing={historyPending}>
          <PanelBoundary keys={["market"]} also="/api/markets" reserve={MAJORS_CHART_HEIGHT} onRetry={hist.retry} resetKeys={[hist.top.at]}>
            <Swap ready={hist.top.status !== "loading"} reserve={MAJORS_CHART_HEIGHT} skeleton={<SkeletonBox w="100%" h={MAJORS_CHART_HEIGHT} radius={3} />}>
              <MultiLine series={topSeries} days={days} height={MAJORS_CHART_HEIGHT} labels={false}
                emptyIsError={hist.top.status === "error"}
                emptyNote={historyEmptyCopy(hist.top.status)} />
            </Swap>
          </PanelBoundary>
          <SeriesSwatchLegend series={topSeries} />
        </PanelFrame>
      </section>

      {/* Privacy peer group — full width, live-ranked membership */}
      <PanelFrame
        title={`Privacy peer group · normalized · ${range}`}
        updatedAt={hist.peers.at}
        refreshing={historyPending}
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {chartedPeerSymbols ? (
              <span className="mono dim" style={{ fontSize: "var(--fs-label)", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={chartedPeerSymbols}>
                {chartedPeerSymbols}
              </span>
            ) : null}
            <GroupBadge result={hist.peers} />
          </div>
        }
      >
        <PanelBoundary keys={["market"]} also="/api/markets" reserve={PRIVACY_CHART_HEIGHT} onRetry={hist.retry} resetKeys={[hist.peers.at]}>
          <Swap ready={hist.peers.status !== "loading"} reserve={PRIVACY_CHART_HEIGHT} skeleton={<SkeletonBox w="100%" h={PRIVACY_CHART_HEIGHT} radius={3} />}>
            <MultiLine series={peerSeries} days={days} height={PRIVACY_CHART_HEIGHT} labels={true}
              emptyIsError={hist.peers.status === "error"}
              emptyNote={historyEmptyCopy(hist.peers.status)} />
          </Swap>
        </PanelBoundary>
        <div className="mono" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 14px", marginTop: 10, fontSize: "var(--fs-label)", minHeight: "1.6em" }}>
          {peerRemainder.length > 0 ? (
            <>
              <span className="kicker">also in top {hist.peers.members.length}</span>
              {peerRemainder.map((m) => (
                <span key={m.id} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <b className="dim">{m.symbol}</b>
                  <span>{fmtPeerPrice(m.price)}</span>
                  <span className="dim">{m.marketCap == null ? "—" : fmtUsd(m.marketCap)}</span>
                </span>
              ))}
            </>
          ) : null}
        </div>
      </PanelFrame>

      {/* Exchange volume (real) + swap-venue directory */}
      <section className="col-2" style={{ gap: 12 }}>
        <PanelFrame title="Exchange volume · 24h · top pairs" right={<SourceBadge status={tickers.status} />} updatedAt={tickers.at}>
          {/* Swap wraps the WHOLE .mk-table (header + rows + delisted), not just
              the ternary — .mk-row is `display: contents` on desktop (see
              styles.css:706-710), so its .mk-cell children only become
              .mk-table's own grid items when .mk-table is their DIRECT grid
              ancestor with nothing but display:contents between them. Nesting
              Swap's .sk-swap/.sk-body (real boxes, not display:contents) between
              .mk-table and a row would break that column alignment the moment
              real tickers land. Wrapping outside .mk-table entirely avoids the
              question — the grid is self-contained regardless of what wraps it. */}
          <Swap ready={tickersReady} reserve={rowsHeight(TOP_TICKERS_LIMIT)} skeleton={<SkeletonRows n={TOP_TICKERS_LIMIT} cols={TICKER_COLS} />}>
            {/* v6.0.10 §4 — .keep-cols forces `min-width: max-content` on mobile,
                so this was a horizontal swipe that never reached its last column.
                .mk-* stacks it to one card per row below 768px; the desktop track
                list rides --mk-cols so the inline-grid blanket rule can't see it. */}
            <div className="mk-table" style={{ ["--mk-cols" as string]: TICKER_COLS } as React.CSSProperties}>
              {["Venue", "Pair", "24h $", "Spread"].map((h) => (
                <div key={h} className="kicker mk-head">{h}</div>
              ))}
              {topTickers.length === 0 ? (
                <span className="mono dim" style={{ padding: "10px 0" }}>{tickerEmptyCopy(tickers.status)}</span>
              ) : (
                topTickers.map((t, i) => (
                  <div className="mk-row" key={t.venue + t.pair + i}>
                    <span className="mk-cell" style={{ color: "var(--ink-100)" }}>
                      <span className="mk-lbl">Venue</span>
                      <span>{t.venue}{t.anomalous ? <span className="dim" style={{ fontSize: "var(--fs-label)", marginLeft: 4 }}>·FLAGGED</span> : ""}</span>
                    </span>
                    <span className="mk-cell dim"><span className="mk-lbl">Pair</span><span>{t.pair}</span></span>
                    <span className="mk-cell" style={{ textAlign: "right", color: "var(--ink-80)" }}>
                      <span className="mk-lbl">24h $</span><span>{fmtUsd(t.volUsd)}</span>
                    </span>
                    <span className="mk-cell" style={{ textAlign: "right", color: t.spreadPct <= SPREAD_GOOD_MAX ? "var(--g-50)" : t.spreadPct <= SPREAD_OK_MAX ? "var(--y-50)" : "var(--r-50)" }}>
                      <span className="mk-lbl">Spread</span><span>{t.spreadPct.toFixed(2)}%</span>
                    </span>
                  </div>
                ))
              )}
              {DELISTED.map((e) => (
                <div className="mk-row" key={e.name}>
                  <span className="mk-cell" style={{ color: "var(--r-50)" }}>
                    <span className="mk-lbl">Venue</span>
                    <span>{e.name}<span className="dim" style={{ fontSize: "var(--fs-label)", marginLeft: 4 }}>·DELISTED</span></span>
                  </span>
                  <span className="mk-cell dim"><span className="mk-lbl">Pair</span><span>{e.note}</span></span>
                  <span className="mk-cell" style={{ textAlign: "right", color: "var(--ink-20)" }}><span className="mk-lbl">24h $</span><span>—</span></span>
                  <span className="mk-cell" style={{ textAlign: "right", color: "var(--ink-20)" }}><span className="mk-lbl">Spread</span><span>—</span></span>
                </div>
              ))}
            </div>
          </Swap>
        </PanelFrame>

        <PanelFrame title="Atomic swap + P2P venues" right={<ProvNote>directory · volume not published</ProvNote>}>
          {/* The TYPE column rendered as a single character at 390px — the
              .keep-cols swipe never reached it. As cards it simply wraps. */}
          <div className="mk-table" style={{ ["--mk-cols" as string]: "140px 1fr 110px" } as React.CSSProperties}>
            {["Venue", "Pairs", "Type"].map((h) => (
              <div key={h} className="kicker mk-head">{h}</div>
            ))}
            {SWAP_DIRECTORY.map((e) => (
              <div className="mk-row" key={e.name}>
                <span className="mk-cell" style={{ color: e.type.includes("shut down") ? "var(--r-50)" : "var(--ink-100)" }}>
                  <span className="mk-lbl">Venue</span><span>{e.name}</span>
                </span>
                <span className="mk-cell dim"><span className="mk-lbl">Pairs</span><span>{e.pair}</span></span>
                <span className="mk-cell" style={{ textAlign: "right", color: "var(--ink-60)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  <span className="mk-lbl">Type</span><span>{e.type}</span>
                </span>
              </div>
            ))}
          </div>
          <p className="mono dim" style={{ marginTop: 12, fontSize: "var(--fs-body)", color: "var(--ink-40)" }}>
            ⓘ Decentralized and P2P venues don't report 24h volume to aggregators — listing them without numbers is the honest version.
          </p>
        </PanelFrame>
      </section>

      {/* Liquidity by venue (real tickers) */}
      <PanelFrame title="Liquidity by venue · 24h converted volume" right={<SourceBadge status={tickers.status} prefix={venues.length ? `${venues.length} venues` : undefined} />} updatedAt={tickers.at}>
        <Swap ready={tickersReady} reserve={rowsHeight(VENUES_LIMIT)} skeleton={<SkeletonRows n={VENUES_LIMIT} cols={LIQUIDITY_COLS} />}>
          {venues.length === 0 ? (
            <p className="mono dim" style={{ fontSize: "var(--fs-mono)" }}>{tickerEmptyCopy(tickers.status)}</p>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {venues.map((v) => (
                <div key={v.venue} className="mono keep-cols" style={{ display: "grid", gridTemplateColumns: LIQUIDITY_COLS, gap: 10, alignItems: "center", fontSize: "var(--fs-mono)" }}>
                  <span style={{ color: "var(--ink-100)" }}>{v.venue}</span>
                  <span style={{ position: "relative", height: 12, background: "color-mix(in srgb, var(--surface-sunk) 60%, transparent)", borderRadius: 1, overflow: "hidden" }}>
                    {/* fill length encodes real venUsd volume — accent-data, not chrome */}
                    <span style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${(v.volUsd / maxVenueVol) * 100}%`, background: "color-mix(in srgb, var(--accent-data) 35%, transparent)", boxShadow: "0 0 6px color-mix(in srgb, var(--accent-data) 25%, transparent)" }} />
                  </span>
                  <span className="dim" style={{ textAlign: "right" }}>{fmtUsd(v.volUsd)}</span>
                  <span style={{ textAlign: "right", color: v.spreadPct <= SPREAD_GOOD_MAX ? "var(--g-50)" : v.spreadPct <= SPREAD_OK_MAX ? "var(--y-50)" : "var(--r-50)" }}>{v.spreadPct.toFixed(2)}% spr</span>
                </div>
              ))}
            </div>
          )}
        </Swap>
      </PanelFrame>
    </PageShell>
  );
}
