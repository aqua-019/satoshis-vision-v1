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
import { Stat, PanelFrame, Crumbs, Provenance, DataLegend } from "@/design/primitives";
import { ProvNote } from "@/design/provenance";
import {
  useMarketHistory,
  RANGE_DAYS,
  type RangeKey,
  type SeriesStatus,
  type LineSeries,
  type GroupResult,
} from "@/data/useMarketHistory";
import { useTickers } from "@/data/useTickers";
import { CandleChart, MultiLine, AreaSeries } from "./markets/charts";
import { SITE_VERSION } from "@/data/releases";

/* Chart formatters are hoisted to module scope so their identity is stable
   across renders. `AreaSeries`/`BarSeries` are React.memo'd (see
   pages/markets/charts.tsx) and an inline `format={(v) => …}` arrow allocates
   a fresh function every render, which defeats the boundary entirely. None of
   these close over anything, so module scope is where they belonged anyway. */
const fmtSat = (v: number): string => (v * 1e5).toFixed(0) + " sat";


/** Source label for a single series — COINGECKO with a freshness suffix.
 *  Stale renders the canonical "COINGECKO · stale" (freshness, orthogonal to source). */
function SourceBadge({ status, prefix }: { status: SeriesStatus; prefix?: string }) {
  return <Provenance source="coingecko" fresh={status} detail={prefix} />;
}

/** Source label for a group of series (counts stale fallbacks). Covers the
 *  "attempted, still nothing" case honestly instead of showing a bare
 *  "loading" forever. */
function GroupBadge({ result }: { result: GroupResult }) {
  if (result.status === "loading" && result.attempted && result.data.length === 0)
    return <Provenance source="coingecko" fresh="none" detail="unavailable" />;
  if (result.status === "loading") return <Provenance source="coingecko" fresh="loading" />;
  const total = result.data.length;
  const stales = result.data.filter((s) => s.status !== "live").length;
  if (stales === 0) return <Provenance source="coingecko" fresh="live" detail={`${total} live`} />;
  return <Provenance source="coingecko" fresh="stale" detail={`${total - stales}/${total} live · ${stales} stale`} />;
}

/** Compact color-swatch legend for a `labels={false}` MultiLine — one line
 *  per series with its live last-value % and a stale suffix when relevant.
 *  Originally built for the peer chart; now used by whichever MultiLine is
 *  in the half-width slot (currently majors). */
function SeriesSwatchLegend({ series }: { series: LineSeries[] }) {
  return (
    <div className="mono" style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 8, fontSize: "var(--fs-label)" }}>
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

export function MarketsPage() {
  const data = useMoneroLive();
  const [range, setRange] = React.useState<RangeKey>("30D");
  const days = RANGE_DAYS[range];

  // REAL market history (CoinGecko via /api/coingecko + /api/markets); failures
  // degrade to the last-good cache per series, labelled STALE.
  const hist = useMarketHistory(days);
  const tickers = useTickers();
  const xmrCandles = hist.xmrCandles.data;
  const xmrBtcSeries = hist.xmrBtc.data;
  const peerSeries = hist.peers.data;
  const topSeries = hist.top.data;

  const ratioFloor = xmrBtcSeries.length ? Math.min(...xmrBtcSeries) : 0;
  const ratioPeak = xmrBtcSeries.length ? Math.max(...xmrBtcSeries) : 0;
  const lastRatio = xmrBtcSeries.length ? xmrBtcSeries[xmrBtcSeries.length - 1] : 0;

  // Live-ranked group membership (from the aggregator, not hardcoded lists).
  const majorsCount = topSeries.length;
  const chartedPeerSymbols = peerSeries.map((s) => s.label).join(" · ");
  const peerRemainder = hist.peers.members.filter((m) => !m.charted).slice(0, PEER_REMAINDER_LIMIT);

  // Real circulating supply from the chain height (tail emission is linear).
  const circ = data.ready ? SUPPLY_AT_TAIL + Math.max(0, data.height - TAIL_START_HEIGHT) * TAIL_REWARD : 0;

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
      <Crumbs items={["xmr.irish", SITE_VERSION, "markets"]} status={data.marketReady ? <Provenance source="coingecko" fresh="live" /> : "Connecting…"} />
      <DataLegend sources={["coingecko"]} />
      <PageHeader
        kicker="Markets · price, volume, liquidity"
        title='Markets — <em style="color:var(--tk-accent);text-shadow:var(--glow-1);font-style:normal">where XMR trades</em>.'
        sub="Spot price, peer-group performance, real per-exchange volume and spreads. Delistings tracked separately."
        right={
          <div style={{ display: "flex", gap: 4 }}>
            {(Object.keys(RANGE_DAYS) as RangeKey[]).map((r) => (
              <button key={r} type="button" onClick={() => setRange(r)} className="proto-btn"
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
        <Stat k="XMR / USD" v={data.marketReady ? `$${data.price.toFixed(2)}` : "—"} sub={data.marketReady ? `${data.change24h >= 0 ? "+" : ""}${data.change24h.toFixed(2)}% · 24h` : "connecting"} tone="acc" />
        <Stat k="XMR / BTC" v={data.marketReady ? data.btcRatio.toFixed(6) : "—"} sub={xmrBtcSeries.length ? `Range ${ratioFloor.toFixed(5)}–${ratioPeak.toFixed(5)}` : "—"} />
        <Stat
          k="Market cap"
          v={data.marketReady && circ > 0 ? `$${((data.price * circ) / 1e9).toFixed(2)}B` : "—"}
          sub={circ > 0 ? (<>{(circ / 1e6).toFixed(2)}M circ · tail emission <Provenance source="coingecko" also="session" bare /></>) : "—"}
        />
        <Stat k="24h volume" v={tickers.status === "loading" ? "—" : fmtUsd(tickerVolume)} sub={tickers.status === "loading" ? "CG tickers" : `CG tickers · ${tickers.data.length} pairs`} />
        <Stat
          k="ATH"
          v={hist.meta.data ? `$${hist.meta.data.ath.toFixed(2)}` : "—"}
          sub={hist.meta.data ? (<>{monthYear(hist.meta.data.athDate)} <Provenance source="coingecko" fresh={hist.meta.status} bare /></>) : "—"}
        />
        <Stat
          k="ATL"
          v={hist.meta.data ? `$${hist.meta.data.atl.toFixed(2)}` : "—"}
          sub={hist.meta.data ? (<>{monthYear(hist.meta.data.atlDate)} <Provenance source="coingecko" fresh={hist.meta.status} bare /></>) : "—"}
        />
      </section>

      {/* Candle chart */}
      <PanelFrame
        title={`XMR / USD · ${range} candles`}
        right={<SourceBadge status={hist.xmrCandles.status} prefix={`${xmrCandles.length} bars · ${hist.xmrCandles.granularityLabel}`} />}
      >
        <CandleChart candles={xmrCandles} days={days} status={hist.xmrCandles.status} height={320} />
      </PanelFrame>

      {/* XMR/BTC ratio + XMR vs Top majors */}
      <section className="col-2" style={{ gap: 12 }}>
        <PanelFrame title={`XMR / BTC · ratio · ${range}`} right={<SourceBadge status={hist.xmrBtc.status} prefix={xmrBtcSeries.length ? `${(lastRatio * 1e5).toFixed(2)} sat` : undefined} />}>
          <AreaSeries data={xmrBtcSeries} days={days} height={RATIO_CHART_HEIGHT}
            color="var(--tk-accent)" baseline="auto"
            format={fmtSat}
            stale={hist.xmrBtc.status === "stale"} />
          <p className="mono dim" style={{ marginTop: 8, fontSize: "var(--fs-mono)" }}>
            {xmrBtcSeries.length ? (
              <>Floor: <b className="acc">{(ratioFloor * 1e5).toFixed(2)} sat</b> · Peak: <b className="acc">{(ratioPeak * 1e5).toFixed(2)} sat</b></>
            ) : (
              <>Awaiting CoinGecko history…</>
            )}
          </p>
        </PanelFrame>
        <PanelFrame title={`XMR vs Top ${majorsCount || "—"} · normalized % · ${range}`} right={<GroupBadge result={hist.top} />}>
          <MultiLine series={topSeries} days={days} height={MAJORS_CHART_HEIGHT} labels={false} />
          <SeriesSwatchLegend series={topSeries} />
        </PanelFrame>
      </section>

      {/* Privacy peer group — full width, live-ranked membership */}
      <PanelFrame
        title={`Privacy peer group · normalized · ${range}`}
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
        <MultiLine series={peerSeries} days={days} height={PRIVACY_CHART_HEIGHT} labels={true} />
        {peerRemainder.length > 0 ? (
          <div className="mono" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 14px", marginTop: 10, fontSize: "var(--fs-label)" }}>
            <span className="kicker">also in top {hist.peers.members.length}</span>
            {peerRemainder.map((m) => (
              <span key={m.id} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <b className="dim">{m.symbol}</b>
                <span>{fmtPeerPrice(m.price)}</span>
                <span className="dim">{m.marketCap == null ? "—" : fmtUsd(m.marketCap)}</span>
              </span>
            ))}
          </div>
        ) : null}
      </PanelFrame>

      {/* Exchange volume (real) + swap-venue directory */}
      <section className="col-2" style={{ gap: 12 }}>
        <PanelFrame title="Exchange volume · 24h · top pairs" right={<SourceBadge status={tickers.status} />}>
          <div className="table-scroll">
            <div className="keep-cols" style={{ display: "grid", gridTemplateColumns: "130px 1fr 80px 70px", gap: 8, fontSize: "var(--fs-mono)" }}>
              {["Venue", "Pair", "24h $", "Spread"].map((h) => (
                <div key={h} className="kicker" style={{ borderBottom: "1px solid var(--rule)", paddingBottom: 6 }}>{h}</div>
              ))}
              {topTickers.length === 0 ? (
                <span className="mono dim" style={{ gridColumn: "1 / -1", padding: "10px 0" }}>Awaiting CoinGecko tickers…</span>
              ) : (
                topTickers.map((t, i) => (
                  <React.Fragment key={t.venue + t.pair + i}>
                    <span className="mono" style={{ color: "var(--ink-100)" }}>{t.venue}{t.anomalous ? <span className="dim" style={{ fontSize: "var(--fs-label)", marginLeft: 4 }}>·FLAGGED</span> : ""}</span>
                    <span className="mono dim" style={{ fontSize: "var(--fs-mono)" }}>{t.pair}</span>
                    <span className="mono" style={{ textAlign: "right", color: "var(--ink-80)" }}>{fmtUsd(t.volUsd)}</span>
                    <span className="mono" style={{ textAlign: "right", color: t.spreadPct <= SPREAD_GOOD_MAX ? "var(--g-50)" : t.spreadPct <= SPREAD_OK_MAX ? "var(--y-50)" : "var(--r-50)" }}>{t.spreadPct.toFixed(2)}%</span>
                  </React.Fragment>
                ))
              )}
              {DELISTED.map((e) => (
                <React.Fragment key={e.name}>
                  <span className="mono" style={{ color: "var(--r-50)" }}>{e.name}<span className="dim" style={{ fontSize: "var(--fs-label)", marginLeft: 4 }}>·DELISTED</span></span>
                  <span className="mono dim" style={{ fontSize: "var(--fs-mono)" }}>{e.note}</span>
                  <span className="mono" style={{ textAlign: "right", color: "var(--ink-20)" }}>—</span>
                  <span className="mono" style={{ textAlign: "right", color: "var(--ink-20)" }}>—</span>
                </React.Fragment>
              ))}
            </div>
          </div>
        </PanelFrame>

        <PanelFrame title="Atomic swap + P2P venues" right={<ProvNote>directory · volume not published</ProvNote>}>
          <div className="table-scroll">
            <div className="keep-cols" style={{ display: "grid", gridTemplateColumns: "140px 1fr 110px", gap: 8, fontSize: "var(--fs-mono)" }}>
              {["Venue", "Pairs", "Type"].map((h) => (
                <div key={h} className="kicker" style={{ borderBottom: "1px solid var(--rule)", paddingBottom: 6 }}>{h}</div>
              ))}
              {SWAP_DIRECTORY.map((e) => (
                <React.Fragment key={e.name}>
                  <span className="mono" style={{ color: e.type.includes("shut down") ? "var(--r-50)" : "var(--ink-100)" }}>{e.name}</span>
                  <span className="mono dim" style={{ fontSize: "var(--fs-mono)" }}>{e.pair}</span>
                  <span className="mono" style={{ textAlign: "right", fontSize: "var(--fs-label)", color: "var(--ink-60)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{e.type}</span>
                </React.Fragment>
              ))}
            </div>
          </div>
          <p className="mono dim" style={{ marginTop: 12, fontSize: "var(--fs-body)", color: "var(--ink-40)" }}>
            ⓘ Decentralized and P2P venues don't report 24h volume to aggregators — listing them without numbers is the honest version.
          </p>
        </PanelFrame>
      </section>

      {/* Liquidity by venue (real tickers) */}
      <PanelFrame title="Liquidity by venue · 24h converted volume" right={<SourceBadge status={tickers.status} prefix={venues.length ? `${venues.length} venues` : undefined} />}>
        {venues.length === 0 ? (
          <p className="mono dim" style={{ fontSize: "var(--fs-mono)" }}>Awaiting CoinGecko tickers…</p>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {venues.map((v) => (
              <div key={v.venue} className="mono" style={{ display: "grid", gridTemplateColumns: "120px 1fr 90px 80px", gap: 10, alignItems: "center", fontSize: "var(--fs-mono)" }}>
                <span style={{ color: "var(--ink-100)" }}>{v.venue}</span>
                <span style={{ position: "relative", height: 12, background: "rgba(255,255,255,0.03)", borderRadius: 1, overflow: "hidden" }}>
                  <span style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${(v.volUsd / maxVenueVol) * 100}%`, background: "rgba(255,122,26,0.35)", boxShadow: "0 0 6px rgba(255,122,26,0.25)" }} />
                </span>
                <span className="dim" style={{ textAlign: "right" }}>{fmtUsd(v.volUsd)}</span>
                <span style={{ textAlign: "right", color: v.spreadPct <= SPREAD_GOOD_MAX ? "var(--g-50)" : v.spreadPct <= SPREAD_OK_MAX ? "var(--y-50)" : "var(--r-50)" }}>{v.spreadPct.toFixed(2)}% spr</span>
              </div>
            ))}
          </div>
        )}
      </PanelFrame>
    </PageShell>
  );
}
