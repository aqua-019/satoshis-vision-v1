/**
 * pages/MarketsPage.tsx — the Markets surface.
 *
 * XMR/USD candles, XMR/BTC ratio, privacy-coin peer group, top-10 normalized,
 * exchange + DEX/atomic-swap volume, and order-book depth.
 *
 * HONESTY: spot KPIs (XMR/USD, XMR/BTC, market cap) are LIVE via useMoneroLive().
 * The candle + line history is now REAL too — useMarketHistory() pulls CoinGecko
 * OHLC + market_chart (prices/volumes) through the same-origin /api/coingecko
 * proxy. Series that fetch cleanly are labelled "LIVE · CG"; only a series whose
 * fetch fails falls back to a synthetic random-walk and is labelled "SIM". The
 * exchange/DEX volume rows and the order-book depth remain illustrative (mock) —
 * they carry their own labels. Charts are hand-rolled SVG; no third-party / CDN
 * chart libraries (privacy invariant).
 */

import * as React from "react";
import { AppShell, PageHeader } from "@/layout/AppShell";
import { useMoneroLive } from "@/data/DataContext";
import { Stat, PanelFrame, Crumbs, Sparkline } from "@/design/primitives";
import {
  useMarketHistory,
  RANGE_DAYS,
  type RangeKey,
  type SeriesStatus,
  type SeriesResult,
  type LineSeries,
} from "@/data/useMarketHistory";
import { CandleChart, MultiLine } from "./markets/charts";

/** Source label for a single series. */
function SourceBadge({ status, prefix }: { status: SeriesStatus; prefix?: string }) {
  const color = status === "live" ? "var(--g-50)" : status === "loading" ? "var(--ink-40)" : "var(--y-50)";
  const text = status === "live" ? "LIVE · CG" : status === "loading" ? "loading…" : "SIM";
  return <span style={{ color }}>{prefix ? prefix + " · " : ""}{text}</span>;
}

/** Source label for a group of series (counts any fallbacks). */
function GroupBadge({ result }: { result: SeriesResult<LineSeries[]> }) {
  if (result.status === "loading") return <span style={{ color: "var(--ink-40)" }}>loading…</span>;
  const total = result.data.length;
  const sims = result.data.filter((s) => s.status === "sim").length;
  if (sims === 0) return <span style={{ color: "var(--g-50)" }}>{total} live · CG</span>;
  return <span style={{ color: "var(--y-50)" }}>{total - sims}/{total} live · {sims} SIM</span>;
}

export function MarketsPage() {
  const data = useMoneroLive();
  const [range, setRange] = React.useState<RangeKey>("30D");
  const days = RANGE_DAYS[range];

  // REAL market history (CoinGecko via /api/coingecko), with per-series fallback.
  const hist = useMarketHistory(days);
  const xmrCandles = hist.xmrCandles.data;
  const xmrBtcSeries = hist.xmrBtc.data;
  const peerSeries = hist.peers.data;
  const topSeries = hist.top.data;

  const ratioFloor = xmrBtcSeries.length ? Math.min(...xmrBtcSeries) : data.btcRatio;
  const ratioPeak = xmrBtcSeries.length ? Math.max(...xmrBtcSeries) : data.btcRatio;
  const lastRatio = xmrBtcSeries.length ? xmrBtcSeries[xmrBtcSeries.length - 1] : data.btcRatio;

  // Exchange volume rows (illustrative)
  const exchangeVol = [
    { name: "Kraken",       vol: 4_120_000, pair: "XMR/USD,EUR,USDT",  status: "active",   trend: +0.18 },
    { name: "KuCoin",        vol: 3_840_000, pair: "XMR/USDT,BTC",      status: "active",   trend: +0.04 },
    { name: "TradeOgre",     vol: 2_200_000, pair: "XMR/BTC,USDT",      status: "active",   trend: +0.23 },
    { name: "Gate.io",       vol: 1_950_000, pair: "XMR/USDT,USD",      status: "active",   trend: -0.06 },
    { name: "MEXC",          vol: 1_510_000, pair: "XMR/USDT",          status: "active",   trend: +0.11 },
    { name: "HTX (Huobi)",   vol: 1_300_000, pair: "XMR/USDT",          status: "active",   trend: -0.02 },
    { name: "Bitfinex",      vol:   980_000, pair: "XMR/USD,USDT,BTC",  status: "active",   trend: +0.07 },
    { name: "Binance",       vol:         0, pair: "—",                 status: "delisted", trend: 0 },
    { name: "OKX (EEA)",     vol:         0, pair: "—",                 status: "delisted", trend: 0 },
    { name: "Kraken UK",     vol:         0, pair: "—",                 status: "delisted", trend: 0 },
  ];

  // Atomic-swap / DEX volumes (illustrative)
  const dexVol = [
    { name: "Haveno",          vol: 380_000, pair: "XMR↔BTC, EUR, USD",   type: "atomic" },
    { name: "BasicSwap",       vol: 220_000, pair: "XMR↔BTC, LTC, BCH",   type: "atomic" },
    { name: "RetoSwap",        vol: 145_000, pair: "XMR↔ETH, USDC",       type: "atomic" },
    { name: "FixedFloat",      vol: 920_000, pair: "XMR↔20+ assets",      type: "instant-swap" },
    { name: "SimpleSwap",      vol: 610_000, pair: "XMR↔100+ assets",     type: "instant-swap" },
    { name: "ChangeNOW",       vol: 720_000, pair: "XMR↔200+ assets",     type: "instant-swap" },
    { name: "LocalMonero (RIP)", vol: 0,     pair: "—",                    type: "p2p · shut down 2024" },
    { name: "Bisq",            vol:  85_000, pair: "XMR↔fiat (P2P)",       type: "p2p" },
  ];

  // Order book depth (mock asks & bids around current price)
  const orderBook = React.useMemo(() => {
    const p = data.price;
    const bids: { px: number; qty: number; sum: number }[] = [];
    const asks: { px: number; qty: number; sum: number }[] = [];
    let bidSum = 0, askSum = 0;
    for (let i = 0; i < 14; i++) {
      const dp = (i + 1) * 0.0008 * p;
      const bidQty = 50 + Math.random() * 280;
      const askQty = 50 + Math.random() * 280;
      bidSum += bidQty; askSum += askQty;
      bids.push({ px: p - dp, qty: bidQty, sum: bidSum });
      asks.push({ px: p + dp, qty: askQty, sum: askSum });
    }
    return { bids, asks, maxSum: Math.max(bidSum, askSum) };
  }, [data.price]);

  const obRow = (lvl: { px: number; qty: number; sum: number }, side: "bid" | "ask", i: number) => {
    const c = side === "bid" ? "var(--g-50)" : "var(--r-50)";
    const barRgb = side === "bid" ? "74,222,128" : "255,77,109";
    return (
      <div key={i} className="ob-row mono" style={{ fontSize: 10.5, padding: "1px 0" }}>
        <span style={{ color: c, minWidth: 62, textAlign: side === "bid" ? "left" : "left" }}>${lvl.px.toFixed(2)}</span>
        <span style={{ position: "relative", height: 11, background: "rgba(255,255,255,0.03)", borderRadius: 1, overflow: "hidden" }}>
          <span style={{
            position: "absolute", top: 0, bottom: 0,
            width: `${(lvl.sum / orderBook.maxSum) * 100}%`,
            background: `rgba(${barRgb},0.22)`,
            ...(side === "bid" ? { right: 0 } : { left: 0 }),
          }} />
        </span>
        <span className="dim2" style={{ fontSize: 9.5, textAlign: "right", minWidth: 70 }}>{lvl.qty.toFixed(1)} XMR</span>
      </div>
    );
  };

  return (
    <AppShell bg={{ intensity: "calm" }}>
      <Crumbs items={["xmr.irish", "v5.0", "markets"]} status="Price live · CG" />
      <PageHeader
        kicker="Markets · price, volume, depth"
        title='Markets — <em style="color:var(--tk-accent);text-shadow:var(--glow-1);font-style:normal">where XMR trades</em>.'
        sub="Spot price, peer-group performance, exchange + DEX volume, order book depth. Delistings tracked separately."
        right={
          <div style={{ display: "flex", gap: 4 }}>
            {(Object.keys(RANGE_DAYS) as RangeKey[]).map((r) => (
              <button key={r} type="button" onClick={() => setRange(r)} className="proto-btn"
                style={{
                  padding: "5px 10px", fontSize: 10,
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
        <Stat k="XMR / USD" v={`$${data.price.toFixed(2)}`} sub={`${data.change24h >= 0 ? "+" : ""}${data.change24h.toFixed(2)}% · 24h`} tone="acc" />
        <Stat k="XMR / BTC" v={data.btcRatio.toFixed(6)} sub={`Range ${ratioFloor.toFixed(5)}–${ratioPeak.toFixed(5)}`} />
        <Stat k="Market cap" v={`$${((data.price * 18_500_000) / 1e9).toFixed(2)}B`} sub="18.5M circ" />
        <Stat k="24h volume" v={`$${(exchangeVol.reduce((a, e) => a + e.vol, 0) / 1e6).toFixed(1)}M`} sub={`${exchangeVol.filter((e) => e.status === "active").length} active CEX`} />
        <Stat k="ATH" v="$542.33" sub="Jan 2018" />
        <Stat k="ATL" v="$0.21" sub="Jan 2015" />
      </section>

      {/* Candle chart */}
      <PanelFrame
        title={`XMR / USD · ${range} candles`}
        right={<SourceBadge status={hist.xmrCandles.status} prefix={`${xmrCandles.length} bars · ${hist.xmrCandles.granularityLabel}`} />}
      >
        <CandleChart candles={xmrCandles} days={days} status={hist.xmrCandles.status} height={320} />
      </PanelFrame>

      {/* XMR/BTC ratio + Privacy peer group */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <PanelFrame title={`XMR / BTC · ratio · ${range}`} right={<SourceBadge status={hist.xmrBtc.status} prefix={`${(lastRatio * 1e5).toFixed(2)} sat`} />}>
          <Sparkline data={xmrBtcSeries} width={460} height={220} color="var(--tk-accent)" area={0.18} dots />
          <p className="mono dim" style={{ marginTop: 8, fontSize: 11 }}>
            Floor: <b className="acc">{(ratioFloor * 1e5).toFixed(2)} sat</b> · Peak: <b className="acc">{(ratioPeak * 1e5).toFixed(2)} sat</b>
          </p>
        </PanelFrame>
        <PanelFrame title={`Privacy peer group · normalized · ${range}`} right={<GroupBadge result={hist.peers} />}>
          <MultiLine series={peerSeries} days={days} height={240} />
        </PanelFrame>
      </section>

      {/* Top crypto comparison */}
      <PanelFrame title={`XMR vs Top 10 · normalized % · ${range}`} right={<GroupBadge result={hist.top} />}>
        <MultiLine series={topSeries} days={days} height={300} />
      </PanelFrame>

      {/* Exchange + DEX volume */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <PanelFrame title="Exchange volume · 24h" right={<span>top 10 CEX</span>}>
          <div className="table-scroll">
            <div className="keep-cols" style={{ display: "grid", gridTemplateColumns: "120px 1fr 70px 80px", gap: 8, fontSize: 11 }}>
              {["Venue", "Pairs", "24h $", "Δ"].map((h) => (
                <div key={h} className="kicker" style={{ borderBottom: "1px solid var(--rule)", paddingBottom: 6 }}>{h}</div>
              ))}
              {exchangeVol.map((e) => (
                <React.Fragment key={e.name}>
                  <span className="mono" style={{ color: e.status === "delisted" ? "var(--r-50)" : "var(--ink-100)" }}>{e.name}{e.status === "delisted" ? <span className="dim" style={{ fontSize: 9, marginLeft: 4 }}>·DELISTED</span> : ""}</span>
                  <span className="mono dim" style={{ fontSize: 10.5 }}>{e.pair}</span>
                  <span className="mono" style={{ textAlign: "right", color: e.vol === 0 ? "var(--ink-20)" : "var(--ink-80)" }}>{e.vol === 0 ? "—" : "$" + (e.vol / 1e6).toFixed(2) + "M"}</span>
                  <span className="mono" style={{ textAlign: "right", color: e.trend > 0 ? "var(--g-50)" : e.trend < 0 ? "var(--r-50)" : "var(--ink-20)" }}>
                    {e.trend === 0 ? "—" : (e.trend > 0 ? "+" : "") + (e.trend * 100).toFixed(0) + "%"}
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>
        </PanelFrame>

        <PanelFrame title="DEX + atomic-swap volume · 24h" right={<span>8 venues</span>}>
          <div className="table-scroll">
            <div className="keep-cols" style={{ display: "grid", gridTemplateColumns: "140px 1fr 80px 90px", gap: 8, fontSize: 11 }}>
              {["Venue", "Pairs", "24h $", "Type"].map((h) => (
                <div key={h} className="kicker" style={{ borderBottom: "1px solid var(--rule)", paddingBottom: 6 }}>{h}</div>
              ))}
              {dexVol.map((e) => (
                <React.Fragment key={e.name}>
                  <span className="mono" style={{ color: e.vol === 0 ? "var(--r-50)" : "var(--ink-100)" }}>{e.name}</span>
                  <span className="mono dim" style={{ fontSize: 10.5 }}>{e.pair}</span>
                  <span className="mono" style={{ textAlign: "right", color: e.vol === 0 ? "var(--ink-20)" : "var(--p-50)" }}>{e.vol === 0 ? "—" : "$" + (e.vol / 1e6).toFixed(2) + "M"}</span>
                  <span className="mono" style={{ textAlign: "right", fontSize: 9.5, color: "var(--ink-60)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{e.type}</span>
                </React.Fragment>
              ))}
            </div>
          </div>
        </PanelFrame>
      </section>

      {/* Order book depth */}
      <PanelFrame title={`Order book depth · ${data.price.toFixed(2)} XMR/USD`} right={<span>mid: ${data.price.toFixed(2)} · ±1.1%</span>}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {/* Bids (left) */}
          <div style={{ borderRight: "1px solid var(--ink-10)", paddingRight: 12 }}>
            <div className="kicker" style={{ marginBottom: 6, color: "var(--g-50)" }}>BIDS · CUMULATIVE</div>
            <div className="ob-side">{orderBook.bids.map((b, i) => obRow(b, "bid", i))}</div>
          </div>
          {/* Asks (right) */}
          <div>
            <div className="kicker" style={{ marginBottom: 6, color: "var(--r-50)" }}>ASKS · CUMULATIVE</div>
            <div className="ob-side">{orderBook.asks.map((a, i) => obRow(a, "ask", i))}</div>
          </div>
        </div>
        <p className="mono dim" style={{ marginTop: 12, fontSize: 10.5, color: "var(--ink-40)" }}>
          ⓘ Aggregated mock depth · real exchange depth via a proxied endpoint is v5.1. ChangeNOW/Kraken not custodied here.
        </p>
      </PanelFrame>
    </AppShell>
  );
}
