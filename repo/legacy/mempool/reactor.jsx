// v1-reactor.jsx — REACTOR
// 3D iso block stack + hex-grid mempool + particle propulsion + ring-sig fan.
// Pushes orange phosphor to maximum. The "what if Monero had a fusion reactor".

function MempoolHexGrid({ mempool, cols = 26, rows = 14 }) {
  // Each cell = one mempool tx. Color/glow intensity tied to fee/byte.
  const cells = [];
  const txs = mempool.slice(0, cols * rows);
  const maxPerB = Math.max(...txs.map((t) => t.perB), 1);
  for (let i = 0; i < cols * rows; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const tx = txs[i];
    const intensity = tx ? Math.min(1, (tx.perB / maxPerB) * 0.9 + 0.1) : 0;
    const x = c * 24 + (r % 2 ? 12 : 0);
    const y = r * 21;
    cells.push({ x, y, intensity, tx, i });
  }
  return (
    <div style={{ position: "relative", width: cols * 24 + 12, height: rows * 21 + 12 }}>
      {cells.map(({ x, y, intensity, tx, i }) =>
        tx ? (
          <div
            key={i}
            className="hex"
            style={{
              left: x, top: y,
              width: 22, height: 26,
              background:
                intensity > 0.85
                  ? "rgba(255,180,80,0.95)"
                  : intensity > 0.6
                    ? "rgba(255,122,26," + (0.35 + intensity * 0.55) + ")"
                    : "rgba(255,122,26," + (0.08 + intensity * 0.4) + ")",
              boxShadow:
                intensity > 0.6
                  ? "0 0 " + (4 + intensity * 14) + "px rgba(255,122,26," + intensity + ")"
                  : "none",
              animation: intensity > 0.75
                ? `hexpulse ${(1.6 + Math.random() * 1.2).toFixed(2)}s ease-in-out ${(-(i * 0.02)).toFixed(2)}s infinite`
                : undefined,
            }}
            title={`${ShortHash(tx.id)} · ${fmtFee(tx.fee)}`}
          />
        ) : (
          <div
            key={i}
            className="hex"
            style={{
              left: x, top: y, width: 22, height: 26,
              background: "transparent",
              border: "0.5px solid rgba(255,122,26,0.06)",
            }}
          />
        )
      )}
    </div>
  );
}

function IsoBlockStack({ blocks, w = 360, h = 380 }) {
  // 3D isometric stack — newest at front, oldest receding into depth.
  const showing = blocks.slice(0, 10);
  return (
    <div style={{ position: "relative", width: w, height: h, perspective: "1200px", perspectiveOrigin: "30% 30%" }}>
      <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", transform: "rotateX(54deg) rotateZ(-38deg) translateZ(-80px)" }}>
        {showing.map((b, i) => {
          const z = i * -28;
          const size = 100;
          const heightOfBlock = Math.min(120, 26 + (b.txs / 140) * 100);
          const opacity = 1 - i * 0.07;
          return (
            <div
              key={b.height}
              style={{
                position: "absolute",
                left: 80 + i * 6,
                top: 80 + i * 6,
                width: size,
                height: size,
                transform: `translateZ(${z}px)`,
                transformStyle: "preserve-3d",
                opacity,
              }}
            >
              {/* top face */}
              <div
                style={{
                  position: "absolute", inset: 0,
                  background: `linear-gradient(135deg, rgba(255,180,80,${0.85 - i * 0.05}) 0%, rgba(255,122,26,${0.7 - i * 0.05}) 100%)`,
                  border: "1px solid rgba(255,200,120,0.9)",
                  boxShadow: i === 0 ? "0 0 40px rgba(255,122,26,0.8), inset 0 0 20px rgba(255,255,200,0.4)" : "0 0 16px rgba(255,122,26,0.3)",
                }}
              >
                <div style={{
                  position: "absolute", left: 6, top: 4,
                  fontFamily: "var(--f-mono)", fontSize: 11,
                  color: i === 0 ? "#1a0a02" : "rgba(20,8,2,0.7)",
                  fontWeight: 600, transform: "rotate(0deg)",
                }}>#{b.height.toString().slice(-4)}</div>
                <div style={{
                  position: "absolute", left: 6, bottom: 6, right: 6,
                  fontFamily: "var(--f-mono)", fontSize: 9.5,
                  color: "rgba(20,8,2,0.65)",
                }}>{b.txs} TX · {b.sizeKB.toFixed(0)}KB</div>
              </div>
              {/* right side (extruded) — fake with absolute */}
              <div
                style={{
                  position: "absolute",
                  width: heightOfBlock, height: size,
                  background: `linear-gradient(180deg, rgba(255,122,26,${0.55 - i * 0.04}), rgba(180,75,10,${0.85 - i * 0.04}))`,
                  border: "1px solid rgba(255,180,80,0.5)",
                  right: -heightOfBlock,
                  top: 0,
                  transform: "rotateY(90deg)",
                  transformOrigin: "left center",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  width: size, height: heightOfBlock,
                  background: `linear-gradient(90deg, rgba(140,55,8,${0.85 - i * 0.04}), rgba(80,32,4,${0.95 - i * 0.04}))`,
                  border: "1px solid rgba(255,180,80,0.35)",
                  left: 0,
                  bottom: -heightOfBlock,
                  transform: "rotateX(-90deg)",
                  transformOrigin: "center top",
                }}
              />
            </div>
          );
        })}
      </div>
      {/* annotations layer (un-rotated) */}
      <div style={{ position: "absolute", left: 12, top: 8, fontFamily: "var(--f-mono)", fontSize: 9, letterSpacing: "0.18em", color: "var(--ink-40)" }}>
        ISOMETRIC · LAST 10 · LIVE
      </div>
      <div style={{ position: "absolute", right: 12, bottom: 8, fontFamily: "var(--f-mono)", fontSize: 10, color: "var(--tk-accent)", textShadow: "var(--glow-1)" }}>
        ◢ #{blocks[0]?.height}
      </div>
    </div>
  );
}

function RingSigFan() {
  // visual abstraction of ring-16: one real input fans into 16 decoys
  const N = 16;
  const cx = 100, cy = 100, r = 80;
  return (
    <svg width={210} height={210} viewBox="0 0 210 210">
      <defs>
        <radialGradient id="ringPulse">
          <stop offset="0%" stopColor="#ff7a1a" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#ff7a1a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ringLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,122,26,0.05)" />
          <stop offset="60%" stopColor="rgba(255,122,26,0.5)" />
          <stop offset="100%" stopColor="rgba(255,200,120,0.95)" />
        </linearGradient>
      </defs>
      <circle cx={cx} cy={cy} r="55" fill="url(#ringPulse)" opacity="0.5">
        <animate attributeName="r" values="50;70;50" dur="3.5s" repeatCount="indefinite" />
      </circle>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,122,26,0.18)" strokeDasharray="3 3" />
      {Array.from({ length: N }).map((_, i) => {
        const ang = (i / N) * Math.PI * 2 - Math.PI / 2;
        const x2 = cx + Math.cos(ang) * r;
        const y2 = cy + Math.sin(ang) * r;
        const isReal = i === 11;
        return (
          <g key={i}>
            <line x1={cx} y1={cy} x2={x2} y2={y2}
              stroke={isReal ? "url(#ringLine)" : "rgba(255,122,26,0.15)"}
              strokeWidth={isReal ? "1.5" : "0.5"} />
            <circle cx={x2} cy={y2} r={isReal ? 4 : 2.4}
              fill={isReal ? "#ffd9a0" : "rgba(255,122,26,0.65)"}
              style={{ filter: `drop-shadow(0 0 ${isReal ? 8 : 3}px ${isReal ? "#ffb978" : "rgba(255,122,26,0.6)"})` }}>
              {isReal ? (
                <animate attributeName="opacity" values="0.4;1;0.4" dur="1.6s" repeatCount="indefinite" />
              ) : null}
            </circle>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r="6" fill="#fff1e0" style={{ filter: "drop-shadow(0 0 10px #ff7a1a)" }} />
      <text x={cx} y={cy + 28} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-60)" letterSpacing="0.1em">
        TX · 16 RING · 1 REAL
      </text>
    </svg>
  );
}

function ReactorView({ data, bg }) {
  return (
    <div className="art" data-screen-label="01 Mempool · REACTOR">
      <ArtBackground intensity={bg?.intensity || "busy"} scan={bg?.scan} />
      <div className="art-stage">
        <NavTop active="mempool" data={data} />
        <div className="shell">
          <NetRail data={data} />
          <div className="main">

            {/* breadcrumbs */}
            <Crumbs items={["XMR.IRISH", "MEMPOOL", "EXPLORER", "REACTOR"]} status="LIVE · STREAM" />

            {/* hero block strip + iso stack */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 14, minHeight: 320 }}>
              <PanelFrame
                title={<><span>● Block stream</span><span className="dim2">queued ⟶ confirmed</span></>}
                right={<><span>FEE-SORTED</span><span className="acc">▣ AUTO-SCROLL</span></>}
              >
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 260, overflow: "hidden", position: "relative", padding: "8px 4px" }}>
                  {/* queued + next placeholders */}
                  <div className="mblock q" style={{ width: 70, minHeight: 200, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div>
                      <div className="hh">~#{(data.height + 2).toLocaleString()}</div>
                      <div className="nm" style={{ fontSize: 16 }}>QUEUED</div>
                    </div>
                    <div className="sz">{data.mempool.length} tx<br />in ~4 min</div>
                  </div>
                  <div className="mblock q" style={{ width: 84, minHeight: 220 }}>
                    <div className="hh">~#{(data.height + 1).toLocaleString()}</div>
                    <div className="nm">NEXT</div>
                    <div className="sz">{Math.min(data.mempool.length, 22)} tx<br />in ~2 min</div>
                  </div>
                  {/* confirmed blocks — heights scale to txs */}
                  {data.blocks.slice(0, 10).map((b, i) => {
                    const h = 130 + Math.min(120, (b.txs / 140) * 120);
                    return (
                      <div key={b.height} className="mblock" style={{ width: 96, minHeight: h, display: "flex", flexDirection: "column", justifyContent: "space-between", opacity: 1 - i * 0.04 }}>
                        <div>
                          <div className="hh">#{b.height.toLocaleString()}</div>
                          <div className="hh" style={{ fontSize: 9 }}>{b.conf} CONF</div>
                        </div>
                        <div>
                          <div className="nm">{b.txs}</div>
                          <div className="sz">{b.sizeKB.toFixed(1)} KB</div>
                          <div className="sz">{b.age < 60 ? b.age + "s ago" : Math.floor(b.age / 60) + "m ago"}</div>
                        </div>
                      </div>
                    );
                  })}
                  {/* glow track */}
                  <div style={{
                    position: "absolute", left: 0, right: 0, bottom: 0, height: 3,
                    background: "linear-gradient(to right, transparent, var(--tk-accent), transparent)",
                    boxShadow: "0 0 12px var(--tk-accent)",
                    animation: "flow 6s linear infinite",
                  }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 4px 0", fontFamily: "var(--f-mono)", fontSize: 10, color: "var(--ink-40)" }}>
                  <span>← scroll back · #3,676,000</span>
                  <span className="acc">10 confs · UNLOCK ▸</span>
                </div>
              </PanelFrame>
              <PanelFrame title="Iso stack · last 10" right={<>BLOCK GEOMETRY</>}>
                <IsoBlockStack blocks={data.blocks} w={356} h={310} />
              </PanelFrame>
            </div>

            {/* the hex mempool grid + ring sig + dense data */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 240px 320px", gap: 14, minHeight: 360 }}>
              <PanelFrame
                title={<><span>● Mempool · hex lattice</span><span className="dim2">cells = tx · color = fee/B</span></>}
                right={<><span>{data.mempool.length} ACTIVE</span><span className="acc">FEE ↑</span></>}
              >
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <MempoolHexGrid mempool={data.mempool} cols={22} rows={11} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, fontFamily: "var(--f-mono)", fontSize: 10 }}>
                    <div className="kicker">Lattice key</div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}><span className="hex" style={{ position: "static", width: 14, height: 16, background: "rgba(255,180,80,0.95)" }} /><span className="dim">priority</span></div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}><span className="hex" style={{ position: "static", width: 14, height: 16, background: "rgba(255,122,26,0.6)" }} /><span className="dim">standard</span></div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}><span className="hex" style={{ position: "static", width: 14, height: 16, background: "rgba(255,122,26,0.18)" }} /><span className="dim">low</span></div>
                    <div style={{ marginTop: 8 }} className="kicker">Distribution</div>
                    <MiniBar data={data.feeHist} width={170} height={48} />
                    <div className="dim" style={{ fontSize: 9 }}>fee/B histogram · 32 buckets</div>
                  </div>
                </div>
              </PanelFrame>
              <PanelFrame title="Ring · 16" right={<span className="acc">CLSAG</span>}>
                <RingSigFan />
                <div className="kv" style={{ marginTop: 8, fontSize: 10 }}><span className="k">Anonymity set</span><span className="v acc">152.8M</span></div>
                <div className="kv" style={{ fontSize: 10 }}><span className="k">Decoy strategy</span><span className="v">gamma</span></div>
                <div className="kv" style={{ fontSize: 10 }}><span className="k">FCMP++ ETA</span><span className="v p">Q3 2026</span></div>
              </PanelFrame>
              <PanelFrame title="Pool distribution · 24h" right={<span className="acc">DECENTRALIZATION ↗</span>}>
                {/* Donut */}
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <PoolDonut pools={data.poolDist} />
                  <div style={{ flex: 1, fontFamily: "var(--f-mono)", fontSize: 10 }}>
                    {data.poolDist.map((p, i) => (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "10px 1fr auto", gap: 6, padding: "2px 0", alignItems: "center" }}>
                        <span style={{ width: 8, height: 8, background: p.color, borderRadius: 2, boxShadow: `0 0 6px ${p.color}` }} />
                        <span className="dim" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                        <span className={p.rec ? "acc" : ""}>{(p.share * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </PanelFrame>
            </div>

            {/* live tx terminal */}
            <PanelFrame
              title={<><span>● Live tx feed</span><span className="dim2">stem ⟶ fluff</span></>}
              right={<><span>STREAM ACTIVE</span><span className="acc">DANDELION++</span></>}
            >
              <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 90px 110px 110px 90px 60px", gap: 12, fontFamily: "var(--f-mono)", fontSize: 11 }}>
                <div className="kicker">PHASE</div>
                <div className="kicker">TXID</div>
                <div className="kicker">SIZE</div>
                <div className="kicker">FEE</div>
                <div className="kicker">FEE/B</div>
                <div className="kicker">RING</div>
                <div className="kicker">AGE</div>
                {data.mempool.slice(0, 7).map((tx, i) => (
                  <React.Fragment key={tx.id}>
                    <div>
                      <span className={"pill " + (i % 3 === 0 ? "acc" : "")} style={{ padding: "2px 6px", fontSize: 9 }}>
                        {i % 3 === 0 ? "STEM · h4" : i % 3 === 1 ? "FLUFF · gossip" : "MEMPOOL"}
                      </span>
                    </div>
                    <div className="hash" style={{ fontSize: 10.5 }}>{tx.id.slice(0, 12)}…{tx.id.slice(-10)}</div>
                    <div className="dim">{fmtBytes(tx.size)}</div>
                    <div>{fmtFee(tx.fee)}</div>
                    <div className="acc">{tx.perB.toFixed(2)} p/B</div>
                    <div className="dim">ring:16</div>
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

function PoolDonut({ pools }) {
  const cx = 70, cy = 70, r = 56, w = 18;
  let acc = 0;
  return (
    <svg width={140} height={140} viewBox="0 0 140 140">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={w} />
      {pools.map((p, i) => {
        const a0 = acc * Math.PI * 2 - Math.PI / 2;
        acc += p.share;
        const a1 = acc * Math.PI * 2 - Math.PI / 2;
        const x0 = cx + Math.cos(a0) * r, y0 = cy + Math.sin(a0) * r;
        const x1 = cx + Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r;
        const large = p.share > 0.5 ? 1 : 0;
        return (
          <path key={i} d={`M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`}
            fill="none" stroke={p.color} strokeWidth={w}
            style={{ filter: `drop-shadow(0 0 4px ${p.color})` }} />
        );
      })}
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontFamily="var(--f-mono)" fontSize="20" fill="var(--tk-accent)" style={{ filter: "drop-shadow(0 0 8px var(--tk-accent))" }}>
        6.45
      </text>
      <text x={cx} y={cy + 16} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-60)" letterSpacing="0.15em">
        GH/s · NET
      </text>
    </svg>
  );
}

window.ReactorView = ReactorView;
