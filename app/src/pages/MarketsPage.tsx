/**
 * pages/MarketsPage.tsx — the Markets surface.
 *
 * XMR/USD candles, XMR/BTC ratio, privacy-coin peer group, top-10 normalized,
 * exchange + DEX/atomic-swap volume, and order-book depth.
 *
 * HONESTY: spot KPIs (XMR/USD, XMR/BTC, market cap) are LIVE — they read from
 * `useMoneroLive()`. Everything with shape/history (candles, normalized peer +
 * top-10 lines, exchange/DEX volume rows, order-book depth) is SYNTHETIC: the
 * CoinGecko proxy returns spot + 24h change, not OHLC history, so candle/line
 * series are illustrative shape anchored to the live price. Panels carry "sim"
 * / "mock" labels — do not read them as real OHLC. Charts are hand-rolled SVG;
 * no third-party / CDN chart libraries (privacy invariant).
 */

import * as React from "react";
import { AppShell, PageHeader } from "@/layout/AppShell";
import { useMoneroLive } from "@/data/DataContext";
import { Stat, PanelFrame, Crumbs, Sparkline } from "@/design/primitives";

interface Candle {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

function genCandles(days: number, start: number, vol: number): Candle[] {
  const out: Candle[] = [];
  let p = start;
  for (let i = 0; i < days; i++) {
    const drift = (Math.random() - 0.48) * vol;
    const o = p;
    const c = Math.max(0.0001, p + drift);
    const range = Math.abs(drift) + vol * 0.5;
    const h = Math.max(o, c) + Math.random() * range;
    const l = Math.min(o, c) - Math.random() * range;
    out.push({ o, h, l, c, v: 1e6 * (0.5 + Math.random() * 1.4) });
    p = c;
  }
  return out;
}

const RANGE_DAYS = { "7D": 7, "30D": 30, "90D": 90, "1Y": 365 } as const;
type RangeKey = keyof typeof RANGE_DAYS;

interface CandleChartProps {
  candles: Candle[];
  width?: number;
  height?: number;
  color?: string;
}

function CandleChart({ candles, width = 760, height = 240, color = "var(--tk-accent)" }: CandleChartProps) {
  if (!candles?.length) return null;
  const padL = 40, padR = 10, padT = 8, padB = 20;
  const innerW = width - padL - padR, innerH = height - padT - padB;
  const min = Math.min(...candles.map((c) => c.l));
  const max = Math.max(...candles.map((c) => c.h));
  const rng = max - min || 1;
  const cw = Math.max(2, innerW / candles.length - 1);
  const y = (v: number) => padT + innerH - ((v - min) / rng) * innerH;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ display: "block", maxWidth: width }}>
      {/* gridlines */}
      {[0.25, 0.5, 0.75].map((t) => (
        <line key={t} x1={padL} y1={padT + innerH * t} x2={padL + innerW} y2={padT + innerH * t}
          stroke="rgba(255,255,255,0.03)" strokeDasharray="2 4" />
      ))}
      {/* y-axis labels */}
      {[0, 0.5, 1].map((t) => (
        <text key={t} x={padL - 6} y={padT + innerH * t + 4} textAnchor="end"
          fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-40)">
          ${(max - rng * t).toFixed(0)}
        </text>
      ))}
      {candles.map((c, i) => {
        const x = padL + i * (innerW / candles.length) + 1;
        const up = c.c >= c.o;
        const fill = up ? "rgba(74,222,128,0.7)" : "rgba(255,77,109,0.7)";
        const stroke = up ? "rgba(74,222,128,1)" : "rgba(255,77,109,1)";
        return (
          <g key={i}>
            <line x1={x + cw / 2} y1={y(c.h)} x2={x + cw / 2} y2={y(c.l)} stroke={stroke} strokeWidth="0.7" />
            <rect x={x} y={y(Math.max(c.o, c.c))} width={cw} height={Math.max(1, Math.abs(y(c.o) - y(c.c)))}
              fill={fill} stroke={stroke} strokeWidth="0.6" />
          </g>
        );
      })}
    </svg>
  );
}

interface Series {
  label: string;
  color: string;
  data: number[];
}

interface MultiLineProps {
  series: Series[];
  width?: number;
  height?: number;
  labels?: boolean;
}

function MultiLine({ series, width = 760, height = 240, labels = true }: MultiLineProps) {
  if (!series?.length) return null;
  const padL = 40, padR = 80, padT = 14, padB = 20;
  const innerW = width - padL - padR, innerH = height - padT - padB;
  // Normalize each series to its start (% gain)
  const norm = series.map((s) => {
    const first = s.data[0] || 1;
    return { ...s, n: s.data.map((v) => (v / first - 1) * 100) };
  });
  const all = norm.flatMap((s) => s.n);
  const min = Math.min(...all), max = Math.max(...all);
  const rng = max - min || 1;
  const len = series[0].data.length;
  const step = innerW / (len - 1);
  const y = (v: number) => padT + innerH - ((v - min) / rng) * innerH;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ display: "block", maxWidth: width }}>
      {/* zero line */}
      <line x1={padL} y1={y(0)} x2={padL + innerW} y2={y(0)} stroke="rgba(255,255,255,0.08)" strokeDasharray="2 4" />
      <text x={padL - 6} y={y(0) + 3} textAnchor="end" fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-40)">0%</text>
      <text x={padL - 6} y={padT + 8} textAnchor="end" fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-40)">+{max.toFixed(0)}%</text>
      <text x={padL - 6} y={padT + innerH - 2} textAnchor="end" fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-40)">{min.toFixed(0)}%</text>
      {norm.map((s, si) => {
        const d = "M" + s.n.map((v, i) => `${padL + i * step},${y(v)}`).join(" L ");
        return (
          <g key={si}>
            <path d={d} fill="none" stroke={s.color} strokeWidth="1.4" style={{ filter: `drop-shadow(0 0 3px ${s.color})` }} />
            {labels ? (
              <text x={padL + innerW + 4} y={y(s.n[s.n.length - 1])} fontFamily="var(--f-mono)" fontSize="10" fill={s.color}>
                {s.label} {s.n[s.n.length - 1].toFixed(1)}%
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

export function MarketsPage() {
  const data = useMoneroLive();
  const [range, setRange] = React.useState<RangeKey>("30D");
  const days = RANGE_DAYS[range];

  // Simulated candles for XMR (tied to live spot when available)
  const xmrCandles = React.useMemo(() => genCandles(days, data.price * 0.78, data.price * 0.018), [days, data.price]);
  const btcCandles = React.useMemo(() => genCandles(days, data.btc * 0.82, data.btc * 0.025), [days, data.btc]);

  // XMR/BTC ratio over time
  const xmrBtcSeries = React.useMemo(() => {
    return xmrCandles.map((c, i) => c.c / btcCandles[i].c);
  }, [xmrCandles, btcCandles]);

  // Privacy-coin peer group (normalized)
  const peerSeries = React.useMemo<Series[]>(() => [
    { label: "XMR",  color: "var(--tk-accent)", data: xmrCandles.map((c) => c.c) },
    { label: "ZEC",  color: "#ffd400",          data: genCandles(days, 18, 0.65).map((c) => c.c) },
    { label: "DASH", color: "#5ed3f4",          data: genCandles(days, 25, 0.9).map((c) => c.c) },
    { label: "ARRR", color: "#b87aff",          data: genCandles(days, 0.18, 0.008).map((c) => c.c) },
  ], [days, xmrCandles]);

  // Top-10 crypto comparison (normalized)
  const topSeries = React.useMemo<Series[]>(() => [
    { label: "XMR",  color: "var(--tk-accent)", data: xmrCandles.map((c) => c.c) },
    { label: "BTC",  color: "var(--ink-100)",   data: btcCandles.map((c) => c.c) },
    { label: "ETH",  color: "#b87aff",          data: genCandles(days, 2800, 75).map((c) => c.c) },
    { label: "SOL",  color: "#4ade80",          data: genCandles(days, 145, 6).map((c) => c.c) },
    { label: "BNB",  color: "#ffd400",          data: genCandles(days, 580, 18).map((c) => c.c) },
    { label: "XRP",  color: "#5ed3f4",          data: genCandles(days, 2.4, 0.15).map((c) => c.c) },
    { label: "ADA",  color: "#ff4d6d",          data: genCandles(days, 0.62, 0.04).map((c) => c.c) },
  ], [days, xmrCandles, btcCandles]);

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
    for (let i = 0; i < 20; i++) {
      const dp = (i + 1) * 0.0008 * p;
      const bidPx = p - dp;
      const askPx = p + dp;
      const bidQty = 50 + Math.random() * 280;
      const askQty = 50 + Math.random() * 280;
      bidSum += bidQty; askSum += askQty;
      bids.push({ px: bidPx, qty: bidQty, sum: bidSum });
      asks.push({ px: askPx, qty: askQty, sum: askSum });
    }
    return { bids, asks, maxSum: Math.max(bidSum, askSum) };
  }, [data.price]);

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
      <section style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
        <Stat k="XMR / USD" v={`$${data.price.toFixed(2)}`} sub={`${data.change24h >= 0 ? "+" : ""}${data.change24h.toFixed(2)}% · 24h`} tone="acc" />
        <Stat k="XMR / BTC" v={data.btcRatio.toFixed(6)} sub={`Range ${Math.min(...xmrBtcSeries).toFixed(5)}–${Math.max(...xmrBtcSeries).toFixed(5)}`} />
        <Stat k="Market cap" v={`$${((data.price * 18_500_000) / 1e9).toFixed(2)}B`} sub="18.5M circ" />
        <Stat k="24h volume" v={`$${(exchangeVol.reduce((a, e) => a + e.vol, 0) / 1e6).toFixed(1)}M`} sub={`${exchangeVol.filter((e) => e.status === "active").length} active CEX`} />
        <Stat k="ATH" v="$542.33" sub="Jan 2018" />
        <Stat k="ATL" v="$0.21" sub="Jan 2015" />
      </section>

      {/* Candle chart */}
      <PanelFrame title={`XMR / USD · ${range} candles`} right={<span>{xmrCandles.length} bars · sim</span>}>
        <CandleChart candles={xmrCandles} />
      </PanelFrame>

      {/* XMR/BTC ratio + Privacy peer group */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <PanelFrame title={`XMR / BTC · ratio · ${range}`} right={<span>{(xmrBtcSeries.at(-1)! * 1e5).toFixed(2)} sat</span>}>
          <Sparkline data={xmrBtcSeries} width={460} height={220} color="var(--tk-accent)" area={0.18} dots />
          <p className="mono dim" style={{ marginTop: 8, fontSize: 11 }}>
            Floor: <b className="acc">{(Math.min(...xmrBtcSeries) * 1e5).toFixed(2)} sat</b> · Peak: <b className="acc">{(Math.max(...xmrBtcSeries) * 1e5).toFixed(2)} sat</b>
          </p>
        </PanelFrame>
        <PanelFrame title={`Privacy peer group · normalized · ${range}`} right={<span>4 assets</span>}>
          <MultiLine series={peerSeries} width={460} height={220} />
        </PanelFrame>
      </section>

      {/* Top crypto comparison */}
      <PanelFrame title={`XMR vs Top 10 · normalized % · ${range}`} right={<span>{topSeries.length} series</span>}>
        <MultiLine series={topSeries} width={1180} height={260} />
      </PanelFrame>

      {/* Exchange + DEX volume */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <PanelFrame title="Exchange volume · 24h" right={<span>top 10 CEX</span>}>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 70px 80px", gap: 8, fontSize: 11 }} className="mono">
            {["Venue", "Pairs", "24h $", "Δ"].map((h) => (
              <div key={h} className="kicker" style={{ borderBottom: "1px solid var(--rule)", paddingBottom: 6 }}>{h}</div>
            ))}
            {exchangeVol.map((e) => (
              <React.Fragment key={e.name}>
                <span style={{ color: e.status === "delisted" ? "var(--r-50)" : "var(--ink-100)" }}>{e.name}{e.status === "delisted" ? <span className="dim" style={{ fontSize: 9, marginLeft: 4 }}>·DELISTED</span> : ""}</span>
                <span className="dim" style={{ fontSize: 10.5 }}>{e.pair}</span>
                <span style={{ textAlign: "right", color: e.vol === 0 ? "var(--ink-20)" : "var(--ink-80)" }}>{e.vol === 0 ? "—" : "$" + (e.vol / 1e6).toFixed(2) + "M"}</span>
                <span style={{ textAlign: "right", color: e.trend > 0 ? "var(--g-50)" : e.trend < 0 ? "var(--r-50)" : "var(--ink-20)" }}>
                  {e.trend === 0 ? "—" : (e.trend > 0 ? "+" : "") + (e.trend * 100).toFixed(0) + "%"}
                </span>
              </React.Fragment>
            ))}
          </div>
        </PanelFrame>

        <PanelFrame title="DEX + atomic-swap volume · 24h" right={<span>8 venues</span>}>
          <div style={{ display: "grid", gridTemplateColumns: "140px 1fr 80px 90px", gap: 8, fontSize: 11 }} className="mono">
            {["Venue", "Pairs", "24h $", "Type"].map((h) => (
              <div key={h} className="kicker" style={{ borderBottom: "1px solid var(--rule)", paddingBottom: 6 }}>{h}</div>
            ))}
            {dexVol.map((e) => (
              <React.Fragment key={e.name}>
                <span style={{ color: e.vol === 0 ? "var(--r-50)" : "var(--ink-100)" }}>{e.name}</span>
                <span className="dim" style={{ fontSize: 10.5 }}>{e.pair}</span>
                <span style={{ textAlign: "right", color: e.vol === 0 ? "var(--ink-20)" : "var(--p-50)" }}>{e.vol === 0 ? "—" : "$" + (e.vol / 1e6).toFixed(2) + "M"}</span>
                <span style={{ textAlign: "right", fontSize: 9.5, color: "var(--ink-60)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{e.type}</span>
              </React.Fragment>
            ))}
          </div>
        </PanelFrame>
      </section>

      {/* Order book depth */}
      <PanelFrame title={`Order book depth · ${data.price.toFixed(2)} XMR/USD`} right={<span>mid: ${data.price.toFixed(2)} · ±1.6%</span>}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
          {/* Bids (left) */}
          <div style={{ borderRight: "1px solid var(--ink-10)", paddingRight: 12 }}>
            <div className="kicker" style={{ marginBottom: 6, color: "var(--g-50)" }}>BIDS · CUMULATIVE</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 90px 80px", gap: 6, fontSize: 10.5 }} className="mono">
              {orderBook.bids.map((b, i) => (
                <React.Fragment key={i}>
                  <span style={{
                    position: "relative", color: "var(--g-50)",
                    background: `linear-gradient(to left, rgba(74,222,128,${0.05 + (b.sum / orderBook.maxSum) * 0.18}), transparent)`,
                    padding: "2px 6px",
                  }}>
                    ${b.px.toFixed(2)}
                  </span>
                  <span className="dim" style={{ textAlign: "right" }}>{b.qty.toFixed(1)}</span>
                  <span className="dim2" style={{ textAlign: "right", fontSize: 9.5 }}>{b.sum.toFixed(0)} XMR</span>
                  <span className="dim2" style={{ textAlign: "right", fontSize: 9.5 }}>${(b.sum * b.px / 1e3).toFixed(1)}K</span>
                </React.Fragment>
              ))}
            </div>
          </div>
          {/* Asks (right) */}
          <div style={{ paddingLeft: 12 }}>
            <div className="kicker" style={{ marginBottom: 6, color: "var(--r-50)" }}>ASKS · CUMULATIVE</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 90px 80px", gap: 6, fontSize: 10.5 }} className="mono">
              {orderBook.asks.map((a, i) => (
                <React.Fragment key={i}>
                  <span style={{
                    color: "var(--r-50)",
                    background: `linear-gradient(to right, rgba(255,77,109,${0.05 + (a.sum / orderBook.maxSum) * 0.18}), transparent)`,
                    padding: "2px 6px",
                  }}>
                    ${a.px.toFixed(2)}
                  </span>
                  <span className="dim" style={{ textAlign: "right" }}>{a.qty.toFixed(1)}</span>
                  <span className="dim2" style={{ textAlign: "right", fontSize: 9.5 }}>{a.sum.toFixed(0)} XMR</span>
                  <span className="dim2" style={{ textAlign: "right", fontSize: 9.5 }}>${(a.sum * a.px / 1e3).toFixed(1)}K</span>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
        <p className="mono dim" style={{ marginTop: 12, fontSize: 10.5, color: "var(--ink-40)" }}>
          ⓘ Aggregated mock depth · plug a real exchange websocket via the data layer · useMoneroLive() to live this.
        </p>
      </PanelFrame>
    </AppShell>
  );
}
