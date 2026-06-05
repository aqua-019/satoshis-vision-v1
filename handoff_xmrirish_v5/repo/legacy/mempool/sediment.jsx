// v3-sediment.jsx — SEDIMENT
// Vertical core-sample. Mempool as a chemistry tube, confirmed blocks
// settle as sediment strata at the bottom. Time flows top→down.

function SedimentColumn({ data, w = 460, h = 880 }) {
  const txs = data.mempool.slice(0, 80);
  const max = Math.max(...txs.map((t) => t.perB), 1);
  const memHeight = h * 0.55;
  const blocks = data.blocks.slice(0, 10);

  return (
    <div style={{ position: "relative", width: w, height: h, marginLeft: 100 }}>
      {/* tube outline */}
      <div style={{
        position: "absolute", inset: "0 60px 0 0",
        border: "1px solid rgba(255,122,26,0.32)",
        borderRadius: "4px 4px 0 0",
        background: "linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(255,122,26,0.04) 50%, rgba(255,122,26,0.06) 100%)",
        boxShadow: "inset 0 0 60px rgba(255,122,26,0.08), 0 0 80px rgba(255,122,26,0.12)",
      }} />

      {/* mouth label */}
      <div style={{
        position: "absolute", top: -28, left: 0, right: 60,
        textAlign: "center", fontFamily: "var(--f-mono)", fontSize: 10, letterSpacing: "0.2em", color: "var(--ink-40)",
      }}>
        ▼ INCOMING TX · STEM ⟶ FLUFF
      </div>

      {/* incoming particles streaming down */}
      <div style={{ position: "absolute", left: 0, top: 0, right: 60, height: 80, overflow: "hidden", pointerEvents: "none" }}>
        {Array.from({ length: 14 }).map((_, i) => (
          <div key={i} style={{
            position: "absolute",
            left: (i * 28 + (i * 7) % 60) + "px",
            top: -10,
            width: 3, height: 14,
            background: "linear-gradient(to bottom, transparent, var(--tk-accent))",
            boxShadow: "0 0 6px var(--tk-accent)",
            animation: `streamY ${(2 + Math.random() * 1.8).toFixed(2)}s linear ${(i * -0.25).toFixed(2)}s infinite`,
          }} />
        ))}
      </div>

      {/* mempool zone */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 60,
        height: memHeight,
        padding: 10,
      }}>
        {txs.map((tx, i) => {
          const y = (1 - tx.perB / max) * (memHeight - 24);
          const x = 10 + ((i * 53) % (w - 100));
          const sz = Math.max(4, Math.min(18, 3 + tx.size / 250));
          const t = tx.perB / max;
          return (
            <div key={tx.id} style={{
              position: "absolute", left: x, top: y,
              width: sz, height: sz, borderRadius: "50%",
              background: `radial-gradient(circle at 30% 30%, rgba(255,220,160,${0.5 + t * 0.5}), rgba(255,122,26,${0.2 + t * 0.5}) 60%, transparent 80%)`,
              boxShadow: `0 0 ${6 + t * 14}px rgba(255,122,26,${0.4 + t * 0.6})`,
              animation: `drift ${(3 + Math.random() * 3).toFixed(2)}s ease-in-out ${(i * 0.08).toFixed(2)}s infinite`,
            }} title={ShortHash(tx.id)} />
          );
        })}
        {/* fee gradient ruler on right */}
        <div style={{
          position: "absolute", right: -56, top: 0, bottom: 0, width: 50,
          display: "flex", flexDirection: "column", justifyContent: "space-between",
          fontFamily: "var(--f-mono)", fontSize: 9, color: "var(--ink-40)",
        }}>
          <div><div className="acc">320 p/B</div><div className="dim2" style={{ fontSize: 8 }}>HIGH FEE</div></div>
          <div>240</div>
          <div>160</div>
          <div>80</div>
          <div><div>0 p/B</div><div className="dim2" style={{ fontSize: 8 }}>LOW</div></div>
        </div>
      </div>

      {/* meniscus */}
      <div style={{
        position: "absolute", left: 6, right: 66, top: memHeight - 2, height: 4,
        background: "linear-gradient(to right, transparent, rgba(255,200,120,0.8), transparent)",
        boxShadow: "0 0 14px var(--tk-accent)",
        animation: "drift 8s ease-in-out infinite",
      }} />
      <div style={{
        position: "absolute", right: -60, top: memHeight - 14,
        fontFamily: "var(--f-mono)", fontSize: 8.5, color: "var(--tk-accent)", letterSpacing: "0.14em",
      }}>
        ⟵ CONFIRMATION INTERFACE
      </div>

      {/* sediment strata = confirmed blocks */}
      {blocks.map((b, i) => {
        const stratH = 14 + Math.min(38, b.txs * 0.6);
        const top = memHeight + 10 + blocks.slice(0, i).reduce((a, bb) => a + 14 + Math.min(38, bb.txs * 0.6) + 2, 0);
        const opacity = 1 - i * 0.07;
        return (
          <div key={b.height} style={{
            position: "absolute", left: 6, right: 66, top, height: stratH,
            background: `linear-gradient(180deg, rgba(255,180,80,${0.55 - i * 0.04}) 0%, rgba(214,98,15,${0.85 - i * 0.05}) 100%)`,
            borderTop: i === 0 ? "1px solid rgba(255,220,160,0.8)" : "1px solid rgba(255,140,40,0.4)",
            borderBottom: "1px solid rgba(100,40,4,0.6)",
            boxShadow: i === 0 ? "0 0 22px rgba(255,122,26,0.5), inset 0 1px 0 rgba(255,255,200,0.5)" : "inset 0 0 8px rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0 10px", fontFamily: "var(--f-mono)", fontSize: 10,
            color: i < 3 ? "#1a0a02" : "rgba(20,8,2,0.8)", fontWeight: 600,
            opacity,
          }}>
            <span>#{b.height.toLocaleString()}</span>
            <span style={{ fontSize: 9, opacity: 0.7 }}>{b.txs} tx · {b.sizeKB.toFixed(1)} KB · {b.conf}c</span>
            <span style={{ fontSize: 9, opacity: 0.7 }}>{b.age < 60 ? b.age + "s" : Math.floor(b.age / 60) + "m"}</span>
          </div>
        );
      })}

      {/* depth annotations on left */}
      <div style={{ position: "absolute", left: -90, top: 0, bottom: 0, width: 86, fontFamily: "var(--f-mono)", fontSize: 9, color: "var(--ink-40)" }}>
        <div style={{ position: "absolute", top: 0, right: 0, textAlign: "right" }}>
          <div className="acc">T = 0</div>
          <div className="dim2" style={{ fontSize: 8 }}>NOW</div>
        </div>
        <div style={{ position: "absolute", top: memHeight * 0.5 - 8, right: 0, textAlign: "right" }}>
          <div>~120 s</div>
          <div className="dim2" style={{ fontSize: 8 }}>STEM</div>
        </div>
        <div style={{ position: "absolute", top: memHeight - 16, right: 0, textAlign: "right" }}>
          <div className="acc">CONF</div>
          <div className="dim2" style={{ fontSize: 8 }}>+1 block</div>
        </div>
        <div style={{ position: "absolute", top: memHeight + 100, right: 0, textAlign: "right" }}>
          <div>+10 conf</div>
          <div className="dim2" style={{ fontSize: 8 }}>UNLOCK</div>
        </div>
      </div>

      {/* stopper at bottom */}
      <div style={{
        position: "absolute", left: -6, right: 54, bottom: -10, height: 12,
        background: "linear-gradient(to bottom, rgba(255,122,26,0.5), rgba(40,16,2,0.95))",
        borderBottom: "1px solid var(--tk-accent)",
        boxShadow: "0 6px 24px rgba(255,122,26,0.4)",
      }} />
    </div>
  );
}

function SedimentView({ data, bg }) {
  return (
    <div className="art" data-screen-label="03 Mempool · SEDIMENT">
      <ArtBackground intensity={bg?.intensity || "busy"} scan={bg?.scan} />
      <div className="art-stage">
        <NavTop active="mempool" data={data} />
        <div className="shell" style={{ gridTemplateColumns: "260px 1fr 320px" }}>
          <NetRail data={data} />
          <div className="main" style={{ overflow: "auto" }}>
            <Crumbs items={["XMR.IRISH", "MEMPOOL", "CORE SAMPLE", "SEDIMENT"]} status="GRAVITY-SORTED" />

            <div style={{ display: "flex", gap: 24 }}>
              {/* the big column */}
              <div style={{ position: "relative" }}>
                <SedimentColumn data={data} />
              </div>
              {/* legend / readouts */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, marginLeft: 80 }}>
                <PanelFrame title="◇ How to read this">
                  <div style={{ fontFamily: "var(--f-serif)", fontSize: 18, lineHeight: 1.32, color: "var(--ink-100)", marginBottom: 10 }}>
                    A cross-section of the mempool, drawn as a sample column.
                  </div>
                  <div style={{ fontFamily: "var(--f-mono)", fontSize: 11, color: "var(--ink-60)", lineHeight: 1.55 }}>
                    Each <span className="acc">orange particle</span> is one pending transaction. Its <em>vertical position</em> tracks fee-per-byte (high fees float, low fees sink). Its <em>size</em> tracks weight. The bright band is the <span className="acc">confirmation interface</span> — txs cross into the next block here.
                    Strata below are confirmed blocks, brightest at the surface, fading into <span className="dim">10-deep unlock</span>.
                  </div>
                </PanelFrame>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Stat k="MEMPOOL" v={data.mempool.length} sub={fmtBytes(data.mempool.reduce((a, t) => a + t.size, 0))} tone="acc" />
                  <Stat k="NEXT BLOCK" v="≈ 1:54" sub="target 2:00" />
                  <Stat k="MEDIAN FEE" v="84 p/B" sub="standard" />
                  <Stat k="P90 FEE" v="246 p/B" sub="priority" tone="acc" />
                </div>

                <PanelFrame title="◇ Fee strata · last hr">
                  <FeeHistDense data={data.feeHist} w={300} h={110} />
                </PanelFrame>

                <PanelFrame title="◇ Ring · 16 anonymity">
                  <RingSigFan />
                </PanelFrame>
              </div>
            </div>
          </div>
          {/* right rail — block detail */}
          <aside className="rail" style={{ borderLeft: "1px solid var(--rule)", borderRight: "none" }}>
            <div className="rail-block">
              <h6>Tip · #{data.height.toLocaleString()}</h6>
              <div className="kv"><span className="k">Hash</span><span className="v hash">{data.blocks[0]?.hash.slice(0, 10)}…</span></div>
              <div className="kv"><span className="k">Timestamp</span><span className="v">26-05-17 12:49:15Z</span></div>
              <div className="kv"><span className="k">Reward</span><span className="v acc">{data.blocks[0]?.reward.toFixed(3)} XMR</span></div>
              <div className="kv"><span className="k">Pool</span><span className="v">{data.blocks[0]?.pool}</span></div>
              <div className="kv"><span className="k">Weight</span><span className="v">6,960 / 600K</span></div>
              <div className="kv"><span className="k">Fill</span><span className="v">1.2%</span></div>
              <div style={{ marginTop: 8, fontFamily: "var(--f-mono)", fontSize: 10 }}>
                <div className="kicker" style={{ marginBottom: 4 }}>BLOCK FILL</div>
                <div style={{ height: 10, border: "1px solid var(--ink-10)", background: "rgba(0,0,0,0.4)", position: "relative" }}>
                  <div style={{ width: "1.2%", height: "100%", background: "var(--tk-accent)", boxShadow: "0 0 8px var(--tk-accent)" }} />
                </div>
              </div>
            </div>

            <div className="rail-block">
              <h6>Tx · sample</h6>
              {data.mempool.slice(0, 6).map((tx) => (
                <div key={tx.id} style={{ padding: "5px 0", borderBottom: "1px dashed var(--ink-10)" }}>
                  <div className="hash" style={{ fontSize: 10.5 }}>{tx.id.slice(0, 10)}…{tx.id.slice(-6)}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--f-mono)", fontSize: 9.5, color: "var(--ink-60)", marginTop: 2 }}>
                    <span>{fmtBytes(tx.size)}</span>
                    <span className="acc">{tx.perB.toFixed(1)} p/B</span>
                    <span className="dim">ring:16</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="rail-block">
              <h6>Dandelion++</h6>
              <div className="kv"><span className="k">Stem hops</span><span className="v acc">10</span></div>
              <div className="kv"><span className="k">Fluff p</span><span className="v">0.10</span></div>
              <div className="kv"><span className="k">Embargo</span><span className="v">39 s</span></div>
              <div style={{ fontFamily: "var(--f-mono)", fontSize: 10, color: "var(--ink-60)", marginTop: 6, lineHeight: 1.5 }}>
                Every tx originates on a single stem path. Each hop, p=0.10 it converts to fluff (gossip). This is why incoming txs appear top-of-column with low predictability.
              </div>
            </div>
          </aside>
        </div>
        <Footer data={data} />
      </div>
    </div>
  );
}

window.SedimentView = SedimentView;
