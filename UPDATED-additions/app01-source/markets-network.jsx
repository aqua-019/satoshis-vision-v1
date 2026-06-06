// markets-network.jsx — Markets and Network pages.
// Both replace what used to be a single Dashboard. Each is its own
// top-level route. Markets focuses on XMR economics + comparisons;
// Network focuses on chain telemetry.

/* ─── shared helpers ─────────────────────────────────────────── */

function _seedRng(seed) { let s = seed || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff; }; }

// candle synth — 90-day OHLC starting from price → walks back. Used by
// the candle chart on Markets. Realistic-ish: keeps within ±3% per day.
function genCandles(closePrice, n, seed) {
  const rng = _seedRng(seed);
  const out = [];
  let c = closePrice;
  for (let i = 0; i < n; i++) {
    const r = (rng() - 0.5) * 0.06; // ±3% intraday range
    const o = c * (1 + (rng() - 0.5) * 0.02);
    const close = c;
    const hi = Math.max(o, close) * (1 + Math.abs(r) / 2);
    const lo = Math.min(o, close) * (1 - Math.abs(r) / 2);
    const vol = 800_000 + rng() * 4_200_000;
    out.unshift({ o, h: hi, l: lo, c: close, v: vol });
    // walk back: previous close is current open
    c = o;
  }
  return out;
}

/* ─── Candle chart ──────────────────────────────────────────── */

function CandleChart({ candles, width = 760, height = 240, accent = "var(--tk-accent)" }) {
  if (!candles.length) return null;
  const padL = 56, padR = 12, padT = 12, padB = 28;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const max = Math.max(...candles.map(c => c.h));
  const min = Math.min(...candles.map(c => c.l));
  const rng = max - min || 1;
  const w = innerW / candles.length;
  const y = (v) => padT + innerH - ((v - min) / rng) * innerH;
  // 4 horizontal grid lines
  const gridTicks = 4;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ display: "block" }}>
      {/* grid */}
      {Array.from({ length: gridTicks + 1 }).map((_, i) => {
        const yy = padT + (innerH / gridTicks) * i;
        const v = max - (rng / gridTicks) * i;
        return (
          <g key={i}>
            <line x1={padL} y1={yy} x2={width - padR} y2={yy} stroke="var(--ink-10)" strokeDasharray="2 4" />
            <text x={padL - 6} y={yy + 4} fontFamily="var(--f-mono)" fontSize="10" fill="var(--ink-40)" textAnchor="end">${v.toFixed(0)}</text>
          </g>
        );
      })}
      {/* candles */}
      {candles.map((c, i) => {
        const x = padL + i * w + w * 0.5;
        const up = c.c >= c.o;
        const color = up ? "var(--g-50)" : "var(--r-50)";
        return (
          <g key={i}>
            <line x1={x} y1={y(c.h)} x2={x} y2={y(c.l)} stroke={color} strokeWidth="1" opacity="0.85" />
            <rect x={padL + i * w + 1.5} y={y(Math.max(c.o, c.c))}
              width={Math.max(1, w - 3)} height={Math.max(1, Math.abs(y(c.o) - y(c.c)))}
              fill={color} opacity={up ? 0.85 : 0.7} />
          </g>
        );
      })}
      {/* time axis */}
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
        const x = padL + innerW * t;
        const daysAgo = Math.round(candles.length * (1 - t));
        return (
          <text key={i} x={x} y={height - 8} fontFamily="var(--f-mono)" fontSize="10" fill="var(--ink-40)" textAnchor="middle">
            {daysAgo === 0 ? "today" : daysAgo + "d ago"}
          </text>
        );
      })}
    </svg>
  );
}

/* ─── Normalised-gain comparison chart ──────────────────────── */

function ComparisonChart({ series, labels, colors, width = 760, height = 200 }) {
  // each series is an array of % gains (0-indexed at 100%)
  const padL = 48, padR = 70, padT = 12, padB = 24;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const all = series.flat();
  const max = Math.max(...all);
  const min = Math.min(...all);
  const rng = max - min || 1;
  const y = (v) => padT + innerH - ((v - min) / rng) * innerH;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ display: "block" }}>
      {/* zero line */}
      <line x1={padL} y1={y(100)} x2={width - padR} y2={y(100)} stroke="var(--ink-20)" strokeDasharray="2 4" />
      <text x={padL - 6} y={y(100) + 4} fontFamily="var(--f-mono)" fontSize="10" fill="var(--ink-40)" textAnchor="end">100%</text>
      {series.map((s, idx) => {
        const step = innerW / (s.length - 1);
        const d = "M" + s.map((v, i) => `${padL + i * step},${y(v)}`).join(" L ");
        const color = colors[idx];
        const lastV = s[s.length - 1];
        return (
          <g key={idx}>
            <path d={d} fill="none" stroke={color} strokeWidth="1.5" style={{ filter: `drop-shadow(0 0 3px ${color})`}} />
            <text x={width - padR + 6} y={y(lastV) + 4}
              fontFamily="var(--f-mono)" fontSize="10.5" fill={color}>
              {labels[idx]} {lastV >= 100 ? "+" : ""}{(lastV - 100).toFixed(0)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ─── Order book depth ──────────────────────────────────────── */

function DepthChart({ price, width = 480, height = 180 }) {
  const rng = _seedRng(420);
  const levels = 24;
  const bids = []; const asks = [];
  let cumBid = 0, cumAsk = 0;
  for (let i = 0; i < levels; i++) {
    cumBid += rng() * 300 + 100;
    cumAsk += rng() * 320 + 100;
    bids.push({ p: price * (1 - (i + 1) * 0.0025), v: cumBid });
    asks.push({ p: price * (1 + (i + 1) * 0.0025), v: cumAsk });
  }
  const max = Math.max(cumBid, cumAsk);
  const minP = bids[bids.length - 1].p, maxP = asks[asks.length - 1].p;
  const x = (p) => ((p - minP) / (maxP - minP)) * (width - 10) + 5;
  const y = (v) => height - 10 - (v / max) * (height - 20);

  const bidPath = "M" + x(minP) + "," + (height - 10) + " " +
    bids.slice().reverse().map(b => `L${x(b.p)},${y(b.v)}`).join(" ") +
    ` L${x(bids[0].p)},${height - 10} Z`;
  const askPath = "M" + x(asks[0].p) + "," + (height - 10) + " " +
    asks.map(a => `L${x(a.p)},${y(a.v)}`).join(" ") +
    ` L${x(maxP)},${height - 10} Z`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ display: "block" }}>
      <path d={bidPath} fill="var(--g-50)" opacity="0.32" stroke="var(--g-50)" strokeWidth="1" />
      <path d={askPath} fill="var(--r-50)" opacity="0.32" stroke="var(--r-50)" strokeWidth="1" />
      <line x1={x(price)} y1={6} x2={x(price)} y2={height - 6} stroke="var(--tk-accent)" strokeDasharray="2 3" />
      <text x={x(price)} y={14} fontFamily="var(--f-mono)" fontSize="10" fill="var(--tk-accent)" textAnchor="middle">${price.toFixed(0)}</text>
      <text x={6}        y={height - 4} fontFamily="var(--f-mono)" fontSize="9" fill="var(--g-50)">bids</text>
      <text x={width - 30} y={height - 4} fontFamily="var(--f-mono)" fontSize="9" fill="var(--r-50)">asks</text>
    </svg>
  );
}

/* ─── MARKETS PAGE ──────────────────────────────────────────── */

function MarketsPage({ data, navigate, params }) {
  const range = params.r || "30d";
  const ranges = { "7d": 7, "30d": 30, "90d": 90, "1y": 365 };
  const n = ranges[range] || 30;
  const candles = React.useMemo(() => genCandles(data.price, n, 17), [data.price, n]);

  // Normalised peer-group series (start = 100). Privacy coins + top10
  const peers = React.useMemo(() => {
    const rng = _seedRng(11);
    const make = (drift, vol, steps) => {
      const out = [100];
      for (let i = 1; i < steps; i++) {
        out.push(Math.max(20, out[i - 1] + drift + (rng() - 0.5) * vol));
      }
      return out;
    };
    return {
      xmr:  make(0.45, 4.0, n),
      zec:  make(0.15, 5.5, n),
      dash: make(-0.10, 3.5, n),
      iron: make(0.05, 6.0, n),
    };
  }, [n]);

  const topten = React.useMemo(() => {
    const rng = _seedRng(31);
    const make = (drift, vol, steps) => { const o = [100]; for (let i = 1; i < steps; i++) o.push(Math.max(40, o[i-1] + drift + (rng()-0.5)*vol)); return o; };
    return {
      xmr:  make(0.45, 4.0, n),
      btc:  make(0.25, 3.0, n),
      eth:  make(0.30, 4.5, n),
      sol:  make(0.50, 6.5, n),
      bnb:  make(0.10, 2.0, n),
    };
  }, [n]);

  const exchanges = [
    { name: "Kraken",     vol: 4_820_000, pct: 28.4, type: "centralized" },
    { name: "KuCoin",     vol: 3_140_000, pct: 18.5, type: "centralized" },
    { name: "TradeOgre",  vol: 2_360_000, pct: 13.9, type: "centralized" },
    { name: "Bitfinex",   vol: 1_820_000, pct: 10.7, type: "centralized" },
    { name: "Gate.io",    vol: 1_220_000, pct:  7.2, type: "centralized" },
    { name: "Bisq (P2P)", vol:   840_000, pct:  5.0, type: "decentralized" },
    { name: "Haveno DEX", vol:   620_000, pct:  3.7, type: "decentralized" },
    { name: "Atomic swaps (XMR↔BTC)", vol: 410_000, pct: 2.4, type: "decentralized" },
    { name: "Other / aggregated", vol: 1_730_000, pct: 10.2, type: "other" },
  ];
  const swapVolume = {
    btc_swap: 410_000,
    ltc_swap: 92_000,
    btc_swap_7d: 2_980_000,
    ltc_swap_7d: 614_000,
  };

  return (
    <AppShell active="markets" data={data} bg={{ intensity: "calm" }}>
      <Crumbs items={["xmr.irish", "v5.0", "markets"]} status={"Polling 60s · " + data.source} />
      <PageHeader
        kicker="MARKETS · LIVE · XMR"
        title='Price, ratios, volumes, depth.'
        sub="Live XMR/USD with peer-group and top-10 comparisons. Volume across centralized + decentralized rails."
        right={<><Pill tone="live" dot>LIVE</Pill><Pill>{new Date(data.lastUpdate).toISOString().slice(11,19)}</Pill></>}
      />

      {/* KPI row */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginTop: 14 }}>
        <Stat k="XMR / USD" v={"$" + data.price.toFixed(2)} sub={"24h " + (data.change24h >= 0 ? "+" : "") + data.change24h.toFixed(2) + "%"} tone="acc" />
        <Stat k="BTC / USD" v={"$" + Math.round(data.btc).toLocaleString()} sub={(data.btcChg >= 0 ? "+" : "") + data.btcChg.toFixed(2) + "%"} />
        <Stat k="XMR / BTC" v={"₿" + data.btcRatio.toFixed(6)} sub={(data.btcRatio * 1e6).toFixed(0) + " sats"} />
        <Stat k="24h Volume" v="$17.0M" sub="all venues" />
        <Stat k="Market cap" v={"$" + (data.price * 18.4e6 / 1e9).toFixed(2) + "B"} sub="~18.4M supply" />
        <Stat k="Tail emission" v="0.6 XMR" sub="forever · block" tone="p" />
      </section>

      {/* Candle chart with range switcher */}
      <PanelFrame title="XMR / USD · OHLC"
        right={<div style={{ display: "flex", gap: 6 }}>
          {Object.keys(ranges).map((r) => (
            <button key={r} type="button" onClick={() => navigate("/markets?r=" + r)}
              style={{
                appearance: "none", cursor: "pointer", padding: "4px 10px",
                background: r === range ? "rgba(255,122,26,0.1)" : "transparent",
                border: "1px solid " + (r === range ? "var(--tk-accent)" : "var(--ink-20)"),
                color: r === range ? "var(--tk-accent)" : "var(--ink-60)",
                borderRadius: 3, fontFamily: "var(--f-mono)", fontSize: 10,
                letterSpacing: "0.08em", textTransform: "uppercase",
              }}>{r}</button>
          ))}
        </div>}
      >
        <CandleChart candles={candles} width={920} height={260} />
      </PanelFrame>

      {/* Two-column: BTC ratio + Peer group */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <PanelFrame title="XMR / BTC ratio · 30d" right={<span>{"₿" + data.btcRatio.toFixed(6)} · {(data.btcRatio * 1e6).toFixed(0)} sats</span>}>
          <Sparkline data={data.priceSeries.slice(-90).map((p, i) => p / (data.btc * (0.95 + Math.sin(i / 12) * 0.05)))}
            width={460} height={160} color="var(--tk-accent)" />
        </PanelFrame>
        <PanelFrame title="Privacy-coin peer group · normalised"
          right={<span>XMR vs ZEC · DASH · Iron Fish</span>}>
          <ComparisonChart
            series={[peers.xmr, peers.zec, peers.dash, peers.iron]}
            labels={["XMR", "ZEC", "DASH", "IRON"]}
            colors={["var(--tk-accent)", "var(--c-50)", "var(--p-50)", "var(--g-50)"]}
            width={460} height={200}
          />
        </PanelFrame>
      </section>

      {/* Top-10 comparison */}
      <PanelFrame title="XMR vs top-10 cryptos · normalised"
        right={<span>start = 100% · {range} window</span>}>
        <ComparisonChart
          series={[topten.xmr, topten.btc, topten.eth, topten.sol, topten.bnb]}
          labels={["XMR", "BTC", "ETH", "SOL", "BNB"]}
          colors={["var(--tk-accent)", "#f7931a", "#5ed3f4", "#b87aff", "#ffd400"]}
          width={920} height={220}
        />
      </PanelFrame>

      {/* Exchange volumes + atomic swap + depth */}
      <section style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 12 }}>
        <PanelFrame title="Exchange volumes · 24h" right={<span>$17.0M total</span>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "4px 0" }}>
            {exchanges.map((e) => (
              <div key={e.name} style={{ display: "grid", gridTemplateColumns: "180px 1fr 80px 90px", gap: 10, alignItems: "center", fontFamily: "var(--f-mono)", fontSize: 11 }}>
                <span style={{ color: "var(--ink-80)" }}>{e.name}</span>
                <div style={{ height: 8, background: "var(--ink-10)", position: "relative", borderRadius: 1 }}>
                  <div style={{ position: "absolute", inset: "0 auto 0 0", width: e.pct + "%",
                    background: e.type === "decentralized" ? "var(--g-50)" : e.type === "other" ? "var(--ink-40)" : "var(--tk-accent)",
                    boxShadow: e.type === "decentralized" ? "0 0 6px var(--g-50)" : "0 0 6px var(--tk-accent)" }} />
                </div>
                <span className="dim" style={{ textAlign: "right" }}>${(e.vol / 1e6).toFixed(2)}M</span>
                <span style={{
                  color: e.type === "decentralized" ? "var(--g-50)" : e.type === "other" ? "var(--ink-40)" : "var(--tk-accent)",
                  textAlign: "right", fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase",
                }}>{e.type === "decentralized" ? "P2P" : e.type === "other" ? "OTHER" : "CEX"}</span>
              </div>
            ))}
          </div>
        </PanelFrame>

        <PanelFrame title="Atomic swap volume · 24h" right={<span>trustless · cross-chain</span>}>
          <div style={{ display: "grid", gap: 14, padding: "8px 0" }}>
            <div>
              <div className="kicker">XMR ↔ BTC</div>
              <div className="mono acc" style={{ fontSize: 26, marginTop: 4, lineHeight: 1, color: "var(--tk-accent)" }}>${(swapVolume.btc_swap / 1000).toFixed(0)}K</div>
              <div className="mono dim" style={{ fontSize: 10.5, marginTop: 2 }}>7d: ${(swapVolume.btc_swap_7d / 1e6).toFixed(2)}M · 412 swaps</div>
            </div>
            <div>
              <div className="kicker">XMR ↔ LTC</div>
              <div className="mono" style={{ fontSize: 22, marginTop: 4, lineHeight: 1, color: "var(--c-50)" }}>${(swapVolume.ltc_swap / 1000).toFixed(0)}K</div>
              <div className="mono dim" style={{ fontSize: 10.5, marginTop: 2 }}>7d: ${(swapVolume.ltc_swap_7d / 1e6).toFixed(2)}M · 88 swaps</div>
            </div>
            <div className="mono dim" style={{ fontSize: 10.5, marginTop: 4, lineHeight: 1.5 }}>
              No KYC. No custody. Built on hash time-locked contracts (HTLC).
            </div>
          </div>
        </PanelFrame>

        <PanelFrame title="Order book depth · Kraken" right={<span>aggregated · live</span>}>
          <DepthChart price={data.price} width={460} height={200} />
          <div className="mono dim" style={{ fontSize: 10.5, marginTop: 6, lineHeight: 1.5 }}>
            ~$2.4M bid wall at $387 · ~$1.8M ask wall at $402
          </div>
        </PanelFrame>
      </section>
    </AppShell>
  );
}

window.MarketsPage = MarketsPage;

/* ─── NETWORK PAGE ──────────────────────────────────────────── */

// Tiny geo-map cluster — points scattered on a world rectangle.
function PeerMap({ peers, width = 540, height = 260 }) {
  const cities = {
    DE: [8, 50], FR: [2.4, 47], NL: [5, 52], EU: [10, 50],
    US: [-100, 38], CA: [-100, 56],
    JP: [138, 36], CN: [105, 35], AU: [135, -25], BR: [-55, -10],
  };
  const proj = ([lon, lat]) => [(lon + 180) / 360 * width, (90 - lat) / 180 * height];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ display: "block", background: "rgba(0,0,0,0.3)", borderRadius: 3 }}>
      {/* lat/lon grid */}
      {Array.from({ length: 13 }).map((_, i) => (
        <line key={"v" + i} x1={width / 12 * i} y1={0} x2={width / 12 * i} y2={height} stroke="var(--ink-10)" strokeDasharray="2 3" />
      ))}
      {Array.from({ length: 7 }).map((_, i) => (
        <line key={"h" + i} x1={0} y1={height / 6 * i} x2={width} y2={height / 6 * i} stroke="var(--ink-10)" strokeDasharray="2 3" />
      ))}
      {/* dots */}
      {peers.map((p, i) => {
        const c = cities[p.cnt] || [0, 0];
        const [x, y] = proj(c);
        return (
          <g key={i}>
            <circle cx={x} cy={y} r="6" fill="var(--tk-accent)" opacity="0.18" />
            <circle cx={x} cy={y} r="2.4" fill="var(--tk-accent)"
              style={{ filter: "drop-shadow(0 0 3px var(--tk-accent))" }} />
            <text x={x + 6} y={y + 3} fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-60)">{p.cnt}</text>
          </g>
        );
      })}
      <text x={8} y={height - 8} fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-40)" letterSpacing="0.14em">
        PEER LOCATIONS · {peers.length} connected · approx
      </text>
    </svg>
  );
}

function NetworkPage({ data }) {
  const memBytes = data.mempool.reduce((a, t) => a + t.size, 0);
  // Synthetic time-series for new panels
  const mempoolSize = React.useMemo(() => Array.from({ length: 48 }, (_, i) => 20 + Math.sin(i * 0.4) * 8 + Math.random() * 6), []);
  const blockFull = React.useMemo(() => Array.from({ length: 100 }, () => 0.2 + Math.random() * 0.7), []);
  const versionDist = [
    { v: "monerod 0.18.4.0", n: 1842, pct: 71 },
    { v: "monerod 0.18.3.4", n: 514,  pct: 20 },
    { v: "monerod 0.18.3.3", n: 134,  pct: 5.2 },
    { v: "monerod 0.18.3.2", n: 56,   pct: 2.2 },
    { v: "monerod 0.18.x older", n: 41, pct: 1.6 },
  ];
  const overlayShare = { tor: 14.2, i2p: 7.0, clearnet: 78.8 };

  return (
    <AppShell active="network" data={data} bg={{ intensity: "calm" }}>
      <Crumbs items={["xmr.irish", "v5.0", "network"]} status={"Block " + data.height.toLocaleString()} />
      <PageHeader
        kicker="NETWORK · LIVE"
        title='The chain, the pools, the peers, the proofs.'
        sub="Every observable signal about the live Monero P2P network — pool dominance, hashrate, peer geography, version distribution, Tor share."
        right={<><Pill tone="live" dot>LIVE</Pill><Pill>{data.peers.length} peers</Pill></>}
      />

      {/* KPI row */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginTop: 14 }}>
        <Stat k="Block height" v={data.height.toLocaleString()} sub="live" tone="acc" />
        <Stat k="Hashrate" v={(data.hashrate / 1e9).toFixed(2) + " GH/s"} sub="vs 5.8 last wk" />
        <Stat k="Difficulty" v={(data.difficulty / 1e9).toFixed(2) + "G"} sub="adj every 720" />
        <Stat k="Mempool" v={data.mempool.length + " tx"} sub={fmtBytes(memBytes)} />
        <Stat k="Peers (this node)" v={data.peers.length} sub={data.peerOut + " out · " + data.peerIn + " in"} />
        <Stat k="Fork" v="v16" sub="FCMP++ Q3" tone="p" />
      </section>

      {/* Hashrate + difficulty + fee */}
      <section style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", gap: 12 }}>
        <PanelFrame title="Hashrate · 7d" right={<span>GH/s</span>}>
          <Sparkline data={data.hashSeries} width={600} height={150} color="var(--tk-accent)" />
        </PanelFrame>
        <PanelFrame title="Difficulty curve · 30d" right={<span>G</span>}>
          <Sparkline data={data.hashSeries.map(h => h * 120 / 1e1).slice(-90)}
            width={420} height={150} color="var(--c-50)" />
        </PanelFrame>
        <PanelFrame title="Fee histogram" right={<span>piconero / B</span>}>
          <MiniBar data={data.feeHist} width={420} height={150} color="var(--p-50)" />
        </PanelFrame>
      </section>

      {/* Block fullness + mempool size */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <PanelFrame title="Block fullness · last 100" right={<span>% of median size</span>}>
          <svg viewBox="0 0 600 130" width="100%" style={{ display: "block" }}>
            {blockFull.map((p, i) => {
              const w = 600 / blockFull.length;
              const h = p * 120;
              return <rect key={i} x={i * w + 0.5} y={130 - h - 4} width={Math.max(1, w - 1)} height={h}
                fill={p > 0.85 ? "var(--y-50)" : p > 0.6 ? "var(--tk-accent)" : "var(--c-50)"}
                opacity={0.4 + p * 0.5} />;
            })}
            <line x1="0" y1="20" x2="600" y2="20" stroke="var(--y-50)" strokeDasharray="3 4" opacity="0.5" />
            <text x="6" y="16" fontFamily="var(--f-mono)" fontSize="9" fill="var(--y-50)">100% median</text>
          </svg>
        </PanelFrame>
        <PanelFrame title="Mempool size · last 24h" right={<span>tx count</span>}>
          <Sparkline data={mempoolSize} width={460} height={130} color="var(--g-50)" />
        </PanelFrame>
      </section>

      {/* Pool distribution + peer map */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <PanelFrame title="Pool distribution" right={<span>last 24h shares</span>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "4px 0" }}>
            {data.poolDist.map((p) => (
              <div key={p.name} style={{ display: "grid", gridTemplateColumns: "160px 1fr 70px 80px", gap: 10, alignItems: "center", fontSize: 11 }} className="mono">
                <span style={{ color: "var(--ink-80)" }}>
                  <span className="led" style={{ background: p.color, boxShadow: "0 0 6px " + p.color }} />
                  {p.name}
                </span>
                <span style={{ height: 8, background: "var(--ink-10)", position: "relative", borderRadius: 1 }}>
                  <span style={{ position: "absolute", inset: "0 auto 0 0", width: (p.share * 100).toFixed(1) + "%", background: p.color, boxShadow: "0 0 8px " + p.color }} />
                </span>
                <span className="dim" style={{ textAlign: "right" }}>{(p.share * 100).toFixed(1)}%</span>
                <span style={{ color: p.rec ? "var(--g-50)" : "var(--ink-40)", textTransform: "uppercase", fontSize: 9.5, letterSpacing: "0.12em" }}>{p.type}</span>
              </div>
            ))}
          </div>
          <div className="mono dim" style={{ marginTop: 12, fontSize: 10.5, lineHeight: 1.55 }}>
            HHI = <b style={{ color: "var(--y-50)" }}>2,180</b> — moderately concentrated. Goal: under 1,500.
          </div>
        </PanelFrame>
        <PanelFrame title="Peer geography" right={<span>{data.peers.length} peers · approx</span>}>
          <PeerMap peers={data.peers} width={480} height={240} />
        </PanelFrame>
      </section>

      {/* Version distribution + overlay share */}
      <section style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 12 }}>
        <PanelFrame title="Version distribution" right={<span>{versionDist.reduce((a, v) => a + v.n, 0).toLocaleString()} sampled peers</span>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {versionDist.map((v, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "200px 1fr 60px 80px", gap: 10, alignItems: "center", fontSize: 11 }} className="mono">
                <span style={{ color: "var(--ink-80)" }}>{v.v}</span>
                <span style={{ height: 8, background: "var(--ink-10)", position: "relative", borderRadius: 1 }}>
                  <span style={{ position: "absolute", inset: "0 auto 0 0", width: v.pct + "%", background: i === 0 ? "var(--g-50)" : "var(--tk-accent)", boxShadow: "0 0 6px " + (i === 0 ? "var(--g-50)" : "var(--tk-accent)") }} />
                </span>
                <span className="dim" style={{ textAlign: "right" }}>{v.pct}%</span>
                <span className={"dim " + (i === 0 ? "up" : "")} style={{ textAlign: "right", fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  {i === 0 ? "READY" : i < 2 ? "OK" : "UPGRADE"}
                </span>
              </div>
            ))}
          </div>
          <div className="mono dim" style={{ marginTop: 10, fontSize: 10.5, lineHeight: 1.55 }}>
            FCMP++ requires monerod 0.19+. Currently <b className="up">71%</b> on a fork-compatible version.
          </div>
        </PanelFrame>
        <PanelFrame title="Network overlay · Tor / I2P" right={<span>route mix</span>}>
          <div style={{ position: "relative", height: 220 }}>
            {/* simple stacked bar */}
            <svg viewBox="0 0 400 60" width="100%" style={{ display: "block", marginTop: 24 }}>
              <rect x="0"   y="20" width={400 * overlayShare.tor / 100} height="20" fill="var(--p-50)" />
              <rect x={400 * overlayShare.tor / 100} y="20" width={400 * overlayShare.i2p / 100} height="20" fill="var(--c-50)" />
              <rect x={400 * (overlayShare.tor + overlayShare.i2p) / 100} y="20" width={400 * overlayShare.clearnet / 100} height="20" fill="var(--ink-20)" />
              <text x="0"   y="14" fontFamily="var(--f-mono)" fontSize="10" fill="var(--p-50)">Tor · {overlayShare.tor}%</text>
              <text x={400 * overlayShare.tor / 100} y="14" fontFamily="var(--f-mono)" fontSize="10" fill="var(--c-50)">I2P · {overlayShare.i2p}%</text>
              <text x="400" y="14" fontFamily="var(--f-mono)" fontSize="10" fill="var(--ink-60)" textAnchor="end">Clearnet · {overlayShare.clearnet}%</text>
            </svg>
            <div className="mono dim" style={{ marginTop: 18, fontSize: 11, lineHeight: 1.6 }}>
              <b className="up">21.2%</b> of observable peers route through a hidden overlay (.onion / .i2p). The remainder run on clearnet IPs.
              <br /><br />
              This number is approximate — peers on Tor are reachable only as ephemeral hidden services and aren't enumerable the way clearnet peers are.
            </div>
          </div>
        </PanelFrame>
      </section>

      {/* Recent blocks table */}
      <PanelFrame title="Recent blocks" right={<span>height ↓ · last 10</span>}>
        <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 60px 80px 80px 110px 60px", gap: 10, fontSize: 11 }} className="mono">
          {["#", "Hash", "Txs", "Size", "Reward", "Pool", "Age"].map((h) => (
            <div key={h} className="kicker" style={{ borderBottom: "1px solid var(--rule)", paddingBottom: 6, marginBottom: 2 }}>{h}</div>
          ))}
          {data.blocks.slice(0, 10).map((b) => (
            <React.Fragment key={b.height}>
              <span className="acc">{b.height.toLocaleString()}</span>
              <span style={{ color: "var(--c-50)" }}>{ShortHash(b.hash)}</span>
              <span>{b.txs}</span>
              <span className="dim">{b.sizeKB.toFixed(1)} KB</span>
              <span className="up">{b.reward.toFixed(3)}</span>
              <span style={{ color: "var(--ink-80)" }}>{b.pool}</span>
              <span className="dim">{Math.floor(b.age / 60)}m{b.age % 60}s</span>
            </React.Fragment>
          ))}
        </div>
      </PanelFrame>
    </AppShell>
  );
}

window.NetworkPage = NetworkPage;
