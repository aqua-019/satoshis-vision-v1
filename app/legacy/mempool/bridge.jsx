// v2-bridge.jsx — OPERATIONS BRIDGE
// Bloomberg-meets-NASA. 12+ panes. Hyper-dense, gauges everywhere.

function Gauge({ value, max = 1, label, color = "var(--tk-accent)", size = 100 }) {
  const r = size / 2 - 6;
  const c = size / 2;
  const circ = Math.PI * r * 1.4;     // 70% arc
  const frac = Math.min(1, value / max);
  return (
    <svg width={size} height={size * 0.72} viewBox={`0 0 ${size} ${size * 0.72}`}>
      <defs>
        <filter id={`gaugeglow${size}${label}`}>
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>
      <path d={`M ${c - r * 0.95} ${c * 0.85} A ${r} ${r} 0 1 1 ${c + r * 0.95} ${c * 0.85}`}
        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" strokeLinecap="round" />
      <path d={`M ${c - r * 0.95} ${c * 0.85} A ${r} ${r} 0 1 1 ${c + r * 0.95} ${c * 0.85}`}
        fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - frac * 0.75)}
        style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
      <text x={c} y={c * 0.7} textAnchor="middle" fontFamily="var(--f-mono)" fontSize={size * 0.21}
        fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }}>
        {(frac * 100).toFixed(0)}
      </text>
      <text x={c} y={c * 0.7 + size * 0.16} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-40)" letterSpacing="0.14em">
        {label}
      </text>
    </svg>
  );
}

function HeatStrip({ data, w = 280, h = 38 }) {
  const cells = data.slice(-48);
  const max = Math.max(...cells, 1);
  const cw = w / cells.length;
  return (
    <svg width={w} height={h}>
      {cells.map((v, i) => {
        const t = v / max;
        const col = `hsl(${24 + (1 - t) * 0}, 100%, ${30 + t * 40}%)`;
        return <rect key={i} x={i * cw} y={0} width={cw - 0.5} height={h} fill={col} opacity={0.4 + t * 0.6} />;
      })}
    </svg>
  );
}

function MempoolSediment({ mempool, w = 220, h = 280 }) {
  // tank-style view — txs settle by fee/B; higher fee = floats higher
  const txs = mempool.slice(0, 60).sort((a, b) => b.perB - a.perB);
  const max = Math.max(...txs.map((t) => t.perB), 1);
  return (
    <div style={{ position: "relative", width: w, height: h, border: "1px solid var(--rule)", background: "linear-gradient(to bottom, rgba(255,122,26,0.02), rgba(255,122,26,0.08))" }}>
      {/* fee gradient ruler */}
      <div style={{ position: "absolute", left: -22, top: 0, bottom: 0, width: 20, display: "flex", flexDirection: "column", justifyContent: "space-between", fontFamily: "var(--f-mono)", fontSize: 8, color: "var(--ink-40)", padding: "4px 0", textAlign: "right" }}>
        <span>HIGH</span><span>MED</span><span>LOW</span>
      </div>
      {txs.map((tx, i) => {
        const y = (1 - tx.perB / max) * (h - 12);
        const sz = Math.min(20, 4 + tx.size / 250);
        const x = 8 + (i * 13) % (w - 28);
        return (
          <div key={tx.id} style={{
            position: "absolute", left: x, top: y, width: sz, height: sz,
            background: `radial-gradient(circle, rgba(255,180,80,${0.6 + (tx.perB / max) * 0.4}), rgba(255,122,26,0.2))`,
            borderRadius: 2,
            boxShadow: `0 0 ${4 + (tx.perB / max) * 10}px rgba(255,122,26,${0.5 + (tx.perB / max) * 0.5})`,
          }} title={ShortHash(tx.id)} />
        );
      })}
      {/* sediment floor (confirmed in last block) */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 6, background: "linear-gradient(to top, var(--tk-accent), transparent)", boxShadow: "0 0 12px var(--tk-accent)" }} />
      <div style={{ position: "absolute", left: 4, bottom: 8, fontFamily: "var(--f-mono)", fontSize: 9, color: "var(--ink-40)" }}>SEDIMENT · 4 tx · next block</div>
      <div style={{ position: "absolute", left: 4, top: 4, fontFamily: "var(--f-mono)", fontSize: 9, color: "var(--ink-40)", letterSpacing: "0.14em" }}>MEMPOOL · {mempool.length} TX</div>
    </div>
  );
}

function Topology({ peers, w = 280, h = 220 }) {
  // simple force-look layout
  const cx = w / 2, cy = h / 2;
  return (
    <svg width={w} height={h}>
      <defs>
        <radialGradient id="centerNode">
          <stop offset="0%" stopColor="#fff1e0" />
          <stop offset="100%" stopColor="#ff7a1a" />
        </radialGradient>
      </defs>
      {peers.map((p, i) => {
        const ang = (i / peers.length) * Math.PI * 2;
        const dist = 60 + ((i * 17) % 30);
        const x = cx + Math.cos(ang) * dist;
        const y = cy + Math.sin(ang) * dist;
        return (
          <g key={i}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,122,26,0.18)" strokeWidth="0.5" strokeDasharray="2 3" />
            <circle cx={x} cy={y} r="2.5" fill={p.lat < 60 ? "#4ade80" : p.lat < 100 ? "#ffd400" : "#ff4d6d"}
              style={{ filter: `drop-shadow(0 0 4px ${p.lat < 60 ? "#4ade80" : p.lat < 100 ? "#ffd400" : "#ff4d6d"})` }} />
            <text x={x + 5} y={y + 3} fontFamily="var(--f-mono)" fontSize="7" fill="var(--ink-40)">{p.cnt}</text>
          </g>
        );
      })}
      {/* center */}
      <circle cx={cx} cy={cy} r="10" fill="url(#centerNode)" style={{ filter: "drop-shadow(0 0 12px #ff7a1a)" }}>
        <animate attributeName="r" values="8;12;8" dur="2s" repeatCount="indefinite" />
      </circle>
      <text x={cx} y={cy + 26} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="9" fill="var(--tk-accent)" letterSpacing="0.16em">YOU</text>
    </svg>
  );
}

function FeeHistDense({ data, w = 280, h = 110 }) {
  const max = Math.max(...data, 1);
  const cw = w / data.length;
  return (
    <svg width={w} height={h}>
      <line x1="0" y1={h - 14} x2={w} y2={h - 14} stroke="var(--rule)" />
      {data.map((v, i) => {
        const bh = (v / max) * (h - 22);
        const t = v / max;
        return (
          <rect key={i} x={i * cw + 0.5} y={h - 14 - bh} width={Math.max(1, cw - 1.5)} height={bh}
            fill={`hsl(${24 - t * 6}, 100%, ${30 + t * 35}%)`}
            opacity={0.5 + t * 0.5}
            style={t > 0.7 ? { filter: "drop-shadow(0 0 4px var(--tk-accent))" } : undefined} />
        );
      })}
      {/* axis */}
      {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
        <text key={i} x={p * w} y={h - 2} fontFamily="var(--f-mono)" fontSize="7" fill="var(--ink-40)"
          textAnchor={i === 0 ? "start" : i === 4 ? "end" : "middle"}>
          {(p * 320).toFixed(0)} p/B
        </text>
      ))}
    </svg>
  );
}

function EmissionCurve({ w = 280, h = 100 }) {
  // tail emission asymptote
  const pts = [];
  for (let i = 0; i <= 60; i++) {
    const x = (i / 60) * w;
    const y = h - 8 - (h - 16) * (1 / (1 + Math.exp(-(i - 14) / 4)));
    pts.push([x, y]);
  }
  return (
    <svg width={w} height={h}>
      <path d={"M " + pts.map((p) => p.join(",")).join(" L ")}
        fill="none" stroke="var(--tk-accent)" strokeWidth="1.5"
        style={{ filter: "drop-shadow(0 0 4px var(--tk-accent))" }} />
      <line x1="0" y1={h - 16} x2={w} y2={h - 16} stroke="rgba(74,222,128,0.6)" strokeDasharray="2 3" />
      <text x={4} y={h - 20} fontFamily="var(--f-mono)" fontSize="8" fill="#4ade80">TAIL · 0.6 XMR · ∞</text>
      <text x={4} y={12} fontFamily="var(--f-mono)" fontSize="8" fill="var(--ink-40)">EMISSION · BLOCK 1 → ∞</text>
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3" fill="var(--tk-accent)" style={{ filter: "drop-shadow(0 0 6px var(--tk-accent))" }} />
    </svg>
  );
}

function BridgeView({ data, bg }) {
  const totalMempoolBytes = data.mempool.reduce((a, t) => a + t.size, 0);
  return (
    <div className="art" data-screen-label="02 Mempool · OPERATIONS BRIDGE">
      <ArtBackground intensity={bg?.intensity || "calm"} scan={bg?.scan} />
      <div className="art-stage">
        <NavTop active="mempool" data={data} />
        <div className="shell">
          <NetRail data={data} />
          <div className="main" style={{ overflow: "auto" }}>
            <Crumbs items={["XMR.IRISH", "MEMPOOL", "OPERATIONS BRIDGE"]} status="MISSION CONTROL" />

            {/* top KPI strip */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 8 }}>
              <Stat k="HEIGHT" v={data.height.toLocaleString()} sub="+1 in ~32s" tone="acc" />
              <Stat k="HASHRATE" v={(data.hashrate / 1e9).toFixed(2) + " GH"} sub="ATH · sec" tone="acc" />
              <Stat k="DIFFICULTY" v={(data.difficulty / 1e9).toFixed(2) + "G"} sub="Δ +0.21%" />
              <Stat k="MEMPOOL" v={data.mempool.length} sub={fmtBytes(totalMempoolBytes)} />
              <Stat k="XMR/USD" v={"$" + data.price.toFixed(2)} sub={(data.change24h >= 0 ? "+" : "") + data.change24h.toFixed(2) + "%"} tone={data.change24h >= 0 ? "g" : "dn"} />
              <Stat k="XMR/BTC" v={data.btcRatio.toFixed(6)} sub="30d range" />
              <Stat k="RING" v="16" sub="CLSAG · MLSAG-" tone="p" />
              <Stat k="FCMP++" v="Q3 2026" sub="anon set: ∞" tone="p" />
            </div>

            {/* row 2 — 4 cols */}
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr", gap: 12 }}>
              <PanelFrame title="● Live block stream" right={<span className="acc">10 LAST</span>}>
                <div style={{ display: "flex", gap: 4, height: 150, alignItems: "flex-end", overflow: "hidden" }}>
                  <div className="mblock q" style={{ width: 50, height: 110 }}>
                    <div className="hh">~+2</div>
                    <div className="nm" style={{ fontSize: 13 }}>Q</div>
                  </div>
                  <div className="mblock q" style={{ width: 50, height: 120 }}>
                    <div className="hh">~+1</div>
                    <div className="nm" style={{ fontSize: 13 }}>NXT</div>
                  </div>
                  {data.blocks.slice(0, 7).map((b) => {
                    const h = 90 + Math.min(60, (b.txs / 140) * 60);
                    return (
                      <div className="mblock" key={b.height} style={{ width: 50, height: h }}>
                        <div className="hh" style={{ fontSize: 8 }}>{b.conf}c</div>
                        <div className="nm" style={{ fontSize: 14 }}>{b.txs}</div>
                        <div className="sz" style={{ fontSize: 8 }}>{b.sizeKB.toFixed(0)}KB</div>
                      </div>
                    );
                  })}
                </div>
              </PanelFrame>

              <PanelFrame title="○ Pool dist · 24h">
                <div style={{ fontFamily: "var(--f-mono)", fontSize: 10 }}>
                  {data.poolDist.slice(0, 7).map((p, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "8px 1fr 36px 28px", gap: 6, padding: "3px 0", alignItems: "center" }}>
                      <span style={{ width: 6, height: 6, background: p.color, borderRadius: 1, boxShadow: `0 0 4px ${p.color}` }} />
                      <span className="dim" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                      <span className="dim2" style={{ fontSize: 9, textAlign: "right" }}>{(p.fee * 100).toFixed(1)}%</span>
                      <span className={p.rec ? "acc" : ""}>{(p.share * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </PanelFrame>

              <PanelFrame title="◇ Sediment tank">
                <MempoolSediment mempool={data.mempool} w={216} h={130} />
              </PanelFrame>

              <PanelFrame title="◯ Topology · 12 peers">
                <Topology peers={data.peers} w={216} h={140} />
              </PanelFrame>
            </div>

            {/* row 3 — gauges + heatmap + curves */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12 }}>
              <PanelFrame title="◐ Sync">
                <div style={{ display: "flex", justifyContent: "center" }}><Gauge value={100} max={100} label="SYNC %" /></div>
              </PanelFrame>
              <PanelFrame title="◐ Pool decentr.">
                <div style={{ display: "flex", justifyContent: "center" }}><Gauge value={68} max={100} label="HHI" color="#5ed3f4" /></div>
              </PanelFrame>
              <PanelFrame title="◐ Privacy">
                <div style={{ display: "flex", justifyContent: "center" }}><Gauge value={94} max={100} label="ANON" color="#b87aff" /></div>
              </PanelFrame>
              <PanelFrame title="◐ FCMP++">
                <div style={{ display: "flex", justifyContent: "center" }}><Gauge value={72} max={100} label="READY" color="#4ade80" /></div>
              </PanelFrame>
              <PanelFrame title="↳ Hashrate · 7d">
                <Sparkline data={data.hashSeries.slice(-60)} width={232} height={64} color="var(--tk-accent)" />
                <div className="kv" style={{ fontSize: 10, marginTop: 4 }}>
                  <span className="k">CURRENT</span><span className="v acc">{(data.hashrate / 1e9).toFixed(2)} GH/s</span>
                </div>
              </PanelFrame>
              <PanelFrame title="↳ Price · 7d">
                <Sparkline data={data.priceSeries.slice(-60)} width={232} height={64} color="#4ade80" />
                <div className="kv" style={{ fontSize: 10, marginTop: 4 }}>
                  <span className="k">CURRENT</span><span className={"v " + (data.change24h >= 0 ? "up" : "dn")}>${data.price.toFixed(2)}</span>
                </div>
              </PanelFrame>
            </div>

            {/* row 4 — fee histogram, emission, heat */}
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 12 }}>
              <PanelFrame title="◤ Fee/B histogram · live" right={<span className="acc">32 BUCKETS</span>}>
                <FeeHistDense data={data.feeHist} w={420} h={120} />
              </PanelFrame>
              <PanelFrame title="◤ Emission curve">
                <EmissionCurve w={296} h={120} />
              </PanelFrame>
              <PanelFrame title="◤ Confirm-time heatstrip · 48 blocks">
                <HeatStrip data={data.feeHist} w={296} h={64} />
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--f-mono)", fontSize: 9, color: "var(--ink-40)", marginTop: 4 }}>
                  <span>48 BLOCKS AGO</span><span>NOW</span>
                </div>
                <div className="kv" style={{ fontSize: 10, marginTop: 6 }}>
                  <span className="k">Mean confirm</span><span className="v">122 s</span>
                </div>
                <div className="kv" style={{ fontSize: 10 }}>
                  <span className="k">Reorg risk</span><span className="v g">NIL</span>
                </div>
              </PanelFrame>
            </div>

            {/* row 5 — live tx feed table */}
            <PanelFrame
              title={<><span>● TX FEED</span><span className="dim2">incoming</span></>}
              right={<><span>{data.mempool.length} active</span><span className="acc">DANDELION++ STEM ◇ FLUFF</span></>}
            >
              <div style={{ display: "grid", gridTemplateColumns: "60px 110px 1.2fr 70px 90px 80px 70px 60px 60px", gap: 10, fontFamily: "var(--f-mono)", fontSize: 10.5 }}>
                <div className="kicker">SEQ</div>
                <div className="kicker">PHASE</div>
                <div className="kicker">TXID</div>
                <div className="kicker">SIZE</div>
                <div className="kicker">FEE</div>
                <div className="kicker">FEE/B</div>
                <div className="kicker">RING</div>
                <div className="kicker">IN/OUT</div>
                <div className="kicker">AGE</div>
                {data.mempool.slice(0, 9).map((tx, i) => (
                  <React.Fragment key={tx.id}>
                    <div className="dim2">{String(data.mempool.length - i).padStart(4, "0")}</div>
                    <div>
                      <span className={"pill " + (i % 4 === 0 ? "acc" : i % 4 === 1 ? "warn" : "")} style={{ padding: "1px 6px", fontSize: 8.5 }}>
                        {i % 4 === 0 ? "STEM" : i % 4 === 1 ? "QUEUE" : i % 4 === 2 ? "FLUFF" : "POOL"}
                      </span>
                    </div>
                    <div className="hash" style={{ fontSize: 10 }}>{tx.id.slice(0, 14)}…{tx.id.slice(-10)}</div>
                    <div className="dim">{fmtBytes(tx.size)}</div>
                    <div className="acc">{fmtFee(tx.fee)}</div>
                    <div>{tx.perB.toFixed(2)} p/B</div>
                    <div className="dim">16</div>
                    <div className="dim">{tx.inputs}/{tx.outputs}</div>
                    <div className="dim">{tx.age}s</div>
                  </React.Fragment>
                ))}
              </div>
            </PanelFrame>
          </div>
        </div>
        <Footer data={data} />
      </div>
    </div>
  );
}

window.BridgeView = BridgeView;
