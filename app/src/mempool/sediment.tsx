// AUTO-PORTED from sediment.jsx
// Run `npm run port` to refresh. Manual fixups land in MIGRATION.md.
import * as React from "react";
import { useTick } from "@/design/ArtBackground";
import { Stat, Sparkline } from "@/design/primitives";
import { fmtBytes, shortHash as ShortHash } from "@/data/types";
import { MempoolSearchBar, useMempoolTracking, MempoolTrackingDetail } from "@/mempool/mempool-shared";
import type { MoneroLive } from "@/data/types";

interface ViewProps {
  data: MoneroLive;
  bg?: { intensity?: "calm" | "busy" | "chaotic"; scan?: boolean };
}

// sediment.jsx — SEDIMENT · hi-fi core sample
//
// The mempool drawn as a chemistry core: pending txs suspended by fee-per-byte
// (high floats, low sinks), crossing a bright confirmation meniscus into
// stratigraphic bands of confirmed blocks below. Around the core sit a grain-
// size scatter, a ring-16 fan, a stratigraphy log, a fee depth-profile and a
// live clearance trace.
//
// All helpers prefixed `Sed` to avoid the shared-scope collisions.

export function SedCard({ title, right, children, pad = "14px 16px", style }: any) {
  return (
    <div style={{ background: "rgba(0,0,0,0.45)", border: "1px solid var(--rule)", borderRadius: 8, padding: pad, position: "relative", ...style }}>
      {(title || right) ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 12 }}>
          <span className="mono" style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-40)" }}>{title}</span>
          <span className="mono" style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-40)", display: "flex", alignItems: "center", gap: 6 }}>{right}</span>
        </div>
      ) : null}
      {children}
    </div>
  );
}

/* ── the core column — suspended txs → meniscus → strata ────── */
export function SedColumn({ data, w = 360, h = 624 }: { data: MoneroLive; w?: number; h?: number }) {
  const txs = data.mempool.slice(0, 70);
  const max = Math.max(...txs.map((t) => t.perB), 1);
  const memH = h * 0.56;
  const blocks = data.blocks.slice(0, 10);

  return (
    <div style={{ position: "relative", width: w, height: h, marginLeft: 78, flex: "none" }}>
      {/* mouth label */}
      <div style={{ position: "absolute", top: -26, left: 0, right: 0, textAlign: "center", fontFamily: "var(--f-mono)", fontSize: 9.5, letterSpacing: "0.2em", color: "var(--ink-40)" }}>
        ▼ INCOMING · STEM ⟶ FLUFF
      </div>

      {/* tube */}
      <div style={{ position: "absolute", inset: 0, border: "1px solid rgba(255,122,26,0.32)", borderRadius: "4px 4px 0 0",
        background: "linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(255,122,26,0.04) 52%, rgba(255,122,26,0.07) 100%)",
        boxShadow: "inset 0 0 60px rgba(255,122,26,0.08), 0 0 70px rgba(255,122,26,0.10)" }} />

      {/* incoming streamers */}
      <div style={{ position: "absolute", left: 0, top: 0, right: 0, height: 70, overflow: "hidden", pointerEvents: "none" }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} style={{ position: "absolute", left: (10 + (i * 31) % (w - 24)) + "px", top: -12, width: 2.5, height: 13,
            background: "linear-gradient(to bottom, transparent, var(--tk-accent))", boxShadow: "0 0 6px var(--tk-accent)",
            animation: `sed-stream ${(1.9 + (i % 5) * 0.4).toFixed(2)}s linear ${(i * -0.22).toFixed(2)}s infinite` }} />
        ))}
      </div>

      {/* suspended txs */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: memH, padding: 10 }}>
        {txs.map((tx, i) => {
          const y = (1 - tx.perB / max) * (memH - 26);
          const x = 10 + ((i * 47) % (w - 40));
          const sz = Math.max(4, Math.min(17, 3 + tx.size / 260));
          const t = tx.perB / max;
          return (
            <div key={tx.id} title={ShortHash(tx.id)} style={{ position: "absolute", left: x, top: y, width: sz, height: sz, borderRadius: "50%",
              background: `radial-gradient(circle at 32% 30%, rgba(255,222,164,${0.5 + t * 0.5}), rgba(255,122,26,${0.2 + t * 0.5}) 60%, transparent 80%)`,
              boxShadow: `0 0 ${6 + t * 13}px rgba(255,122,26,${0.4 + t * 0.6})`,
              animation: `sed-bob ${(3 + (i % 7) * 0.5).toFixed(2)}s ease-in-out ${(i * 0.09).toFixed(2)}s infinite` }} />
          );
        })}
        {/* fee ruler */}
        <div style={{ position: "absolute", right: -62, top: 0, bottom: 0, width: 56, display: "flex", flexDirection: "column", justifyContent: "space-between", fontFamily: "var(--f-mono)", fontSize: 9, color: "var(--ink-40)" }}>
          <div><div className="acc">320 p/B</div><div className="dim2" style={{ fontSize: 8 }}>HIGH</div></div>
          <div>240</div><div>160</div><div>80</div>
          <div><div>0 p/B</div><div className="dim2" style={{ fontSize: 8 }}>LOW</div></div>
        </div>
      </div>

      {/* meniscus */}
      <div style={{ position: "absolute", left: 5, right: 5, top: memH - 2, height: 4, background: "linear-gradient(to right, transparent, rgba(255,206,138,0.85), transparent)", boxShadow: "0 0 14px var(--tk-accent)", animation: "sed-bob 7s ease-in-out infinite" }} />
      <div style={{ position: "absolute", right: -78, top: memH - 12, fontFamily: "var(--f-mono)", fontSize: 8.5, color: "var(--tk-accent)", letterSpacing: "0.12em" }}>⟵ CONFIRMATION</div>

      {/* strata = confirmed blocks */}
      {blocks.map((b, i) => {
        const stratH = 13 + Math.min(34, b.txs * 0.55);
        const top = memH + 8 + blocks.slice(0, i).reduce((a, bb) => a + 13 + Math.min(34, bb.txs * 0.55) + 2, 0);
        return (
          <div key={b.height} style={{ position: "absolute", left: 5, right: 5, top, height: stratH,
            background: `linear-gradient(180deg, rgba(255,180,80,${0.55 - i * 0.04}) 0%, rgba(214,98,15,${0.85 - i * 0.05}) 100%)`,
            borderTop: i === 0 ? "1px solid rgba(255,220,160,0.85)" : "1px solid rgba(255,140,40,0.4)", borderBottom: "1px solid rgba(100,40,4,0.6)",
            boxShadow: i === 0 ? "0 0 22px rgba(255,122,26,0.5), inset 0 1px 0 rgba(255,255,200,0.5)" : "inset 0 0 8px rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px", fontFamily: "var(--f-mono)", fontSize: 9.5,
            color: i < 3 ? "#1a0a02" : "rgba(20,8,2,0.8)", fontWeight: 600, opacity: 1 - i * 0.06 }}>
            <span>#{b.height.toLocaleString()}</span>
            <span style={{ fontSize: 9, opacity: 0.72 }}>{b.txs}tx · {b.conf}c</span>
            <span style={{ fontSize: 9, opacity: 0.72 }}>{b.age < 60 ? b.age + "s" : Math.floor(b.age / 60) + "m"}</span>
          </div>
        );
      })}

      {/* depth annotations */}
      <div style={{ position: "absolute", left: -76, top: 0, bottom: 0, width: 70, fontFamily: "var(--f-mono)", fontSize: 9, color: "var(--ink-40)" }}>
        <div style={{ position: "absolute", top: 0, right: 0, textAlign: "right" }}><div className="acc">T=0</div><div className="dim2" style={{ fontSize: 8 }}>NOW</div></div>
        <div style={{ position: "absolute", top: memH * 0.5 - 8, right: 0, textAlign: "right" }}><div>~120s</div><div className="dim2" style={{ fontSize: 8 }}>STEM</div></div>
        <div style={{ position: "absolute", top: memH - 14, right: 0, textAlign: "right" }}><div className="acc">CONF</div><div className="dim2" style={{ fontSize: 8 }}>+1 blk</div></div>
        <div style={{ position: "absolute", top: memH + 96, right: 0, textAlign: "right" }}><div>+10c</div><div className="dim2" style={{ fontSize: 8 }}>UNLOCK</div></div>
      </div>

      {/* stopper */}
      <div style={{ position: "absolute", left: -4, right: -4, bottom: -10, height: 12, background: "linear-gradient(to bottom, rgba(255,122,26,0.5), rgba(40,16,2,0.95))", borderBottom: "1px solid var(--tk-accent)", boxShadow: "0 6px 24px rgba(255,122,26,0.4)" }} />

      <style>{`
        @keyframes sed-stream { from { transform: translateY(-12px); opacity: 0; } 12% { opacity: 1; } to { transform: translateY(64px); opacity: 0; } }
        @keyframes sed-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(4px); } }
      `}</style>
    </div>
  );
}

/* ── grain-size scatter — fee/B vs weight ───────────────────── */
export function SedGrainScatter({ data }: { data: MoneroLive }) {
  useTick(1100);
  const W = 300, H = 188, padL = 30, padR = 10, padT = 12, padB = 26;
  const iw = W - padL - padR, ih = H - padT - padB;
  const pts = data.mempool.slice(0, 60);
  const maxFee = Math.max(...pts.map((t) => t.perB), 1);
  const maxSz = Math.max(...pts.map((t) => t.size), 1);
  return (
    <SedCard title="Grain-size analysis" right={<span className="dim">fee/B × weight</span>}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => <line key={t} x1={padL} x2={W - padR} y1={padT + ih * t} y2={padT + ih * t} stroke="rgba(255,255,255,0.04)" strokeDasharray="2 3" />)}
        <line x1={padL} y1={padT} x2={padL} y2={padT + ih} stroke="var(--ink-20)" strokeWidth="1" />
        <line x1={padL} y1={padT + ih} x2={W - padR} y2={padT + ih} stroke="var(--ink-20)" strokeWidth="1" />
        {/* settling trend */}
        <line x1={padL} y1={padT + ih} x2={W - padR} y2={padT} stroke="rgba(255,122,26,0.2)" strokeDasharray="3 4" strokeWidth="1" />
        {pts.map((t, i) => {
          const x = padL + (t.size / maxSz) * iw;
          const y = padT + ih - (t.perB / maxFee) * ih;
          const f = t.perB / maxFee;
          return <circle key={t.id} cx={x} cy={y} r={2 + (t.size / maxSz) * 2.2} fill="var(--tk-accent)" opacity={0.4 + f * 0.5} style={f > 0.6 ? { filter: "drop-shadow(0 0 3px var(--tk-accent))" } : undefined} />;
        })}
        <text x={padL} y={H - 6} fontFamily="var(--f-mono)" fontSize="8" fill="var(--ink-40)">weight →</text>
        <text x={6} y={padT + 6} fontFamily="var(--f-mono)" fontSize="8" fill="var(--ink-40)" transform={`rotate(-90 8 ${padT + 6})`}>fee/B →</text>
      </svg>
    </SedCard>
  );
}

/* ── ring-16 anonymity fan ──────────────────────────────────── */
function SedRingFan() {
  const N = 16, cx = 100, cy = 96, r = 74;
  return (
    <SedCard title="Ring · 16 anonymity" right={<span className="dim">1 real · 15 decoys</span>}>
      <svg width="100%" viewBox="0 0 200 188" style={{ display: "block" }}>
        <defs>
          <radialGradient id="sed-ringpulse"><stop offset="0%" stopColor="#ff7a1a" stopOpacity="0.55" /><stop offset="100%" stopColor="#ff7a1a" stopOpacity="0" /></radialGradient>
          <linearGradient id="sed-ringline" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="rgba(255,122,26,0.05)" /><stop offset="60%" stopColor="rgba(255,122,26,0.5)" /><stop offset="100%" stopColor="rgba(255,200,120,0.95)" /></linearGradient>
        </defs>
        <circle cx={cx} cy={cy} r="50" fill="url(#sed-ringpulse)"><animate attributeName="r" values="46;66;46" dur="3.4s" repeatCount="indefinite" /></circle>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,122,26,0.18)" strokeDasharray="3 3" />
        {Array.from({ length: N }).map((_, i) => {
          const ang = (i / N) * Math.PI * 2 - Math.PI / 2;
          const x2 = cx + Math.cos(ang) * r, y2 = cy + Math.sin(ang) * r;
          const real = i === 11;
          return (
            <g key={i}>
              <line x1={cx} y1={cy} x2={x2} y2={y2} stroke={real ? "url(#sed-ringline)" : "rgba(255,122,26,0.15)"} strokeWidth={real ? 1.6 : 0.5} />
              <circle cx={x2} cy={y2} r={real ? 4 : 2.4} fill={real ? "#ffb978" : "rgba(255,122,26,0.65)"} style={{ filter: `drop-shadow(0 0 ${real ? 4 : 2}px ${real ? "#ffb978" : "rgba(255,122,26,0.6)"})` }}>
                {real ? <animate attributeName="opacity" values="0.4;1;0.4" dur="1.6s" repeatCount="indefinite" /> : null}
              </circle>
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r="6" fill="#ffce8a" style={{ filter: "drop-shadow(0 0 5px #ff7a1a)" }} />
      </svg>
    </SedCard>
  );
}

/* ── stratigraphy log — confirmed blocks as a depth core ────── */
export function SedStrataLog({ data }: { data: MoneroLive }) {
  const blocks = data.blocks.slice(0, 10);
  const maxTx = Math.max(...blocks.map((b) => b.txs), 1);
  return (
    <SedCard title="Stratigraphy log · 10 strata" right={<span className="acc">surface → unlock</span>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {blocks.map((b, i) => (
          <div key={b.height} style={{ display: "grid", gridTemplateColumns: "30px 80px 1fr 54px", gap: 8, alignItems: "center", fontFamily: "var(--f-mono)", fontSize: 10 }}>
            <span className="dim2" style={{ fontSize: 9 }}>{i === 0 ? "TOP" : b.conf + "c"}</span>
            <span style={{ color: i === 0 ? "var(--tk-accent)" : "var(--ink-60)" }}>#{b.height.toLocaleString()}</span>
            <div style={{ height: 9, background: "rgba(255,255,255,0.04)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: (b.txs / maxTx * 100).toFixed(0) + "%", background: `linear-gradient(90deg, rgba(214,98,15,${0.9 - i * 0.05}), rgba(255,180,80,${0.85 - i * 0.05}))`, boxShadow: i === 0 ? "0 0 8px rgba(255,122,26,0.5)" : "none" }} />
            </div>
            <span className="dim" style={{ textAlign: "right" }}>{b.txs}tx</span>
          </div>
        ))}
      </div>
    </SedCard>
  );
}

/* ── fee depth-profile ──────────────────────────────────────── */
export function SedFeeProfile({ data }: { data: MoneroLive }) {
  const W = 300, H = 188, padL = 26, padR = 30, padT = 12, padB = 16;
  const iw = W - padL - padR, ih = H - padT - padB;
  // sorted fee/B from high (surface) to low (depth)
  const fees = data.mempool.map((t) => t.perB).sort((a, b) => b - a);
  const max = Math.max(...fees, 1);
  const pts = fees.length ? fees.map((v, i) => [padL + (v / max) * iw, padT + (i / (fees.length - 1)) * ih]) : [[padL, padT]];
  const path = "M" + pts.map(([x, y]) => x.toFixed(1) + "," + y.toFixed(1)).join(" L ");
  const area = path + ` L ${padL},${padT + ih} L ${padL},${padT} Z`;
  return (
    <SedCard title="Fee depth-profile" right={<span className="dim">surface = high fee</span>}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
        <defs><linearGradient id="sed-prof" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="rgba(255,122,26,0)" /><stop offset="100%" stopColor="rgba(255,122,26,0.35)" /></linearGradient></defs>
        {[0, 0.5, 1].map((t) => <line key={t} x1={padL} x2={W - padR} y1={padT + ih * t} y2={padT + ih * t} stroke="rgba(255,255,255,0.04)" strokeDasharray="2 3" />)}
        <path d={area} fill="url(#sed-prof)" />
        <path d={path} fill="none" stroke="var(--tk-accent)" strokeWidth="1.4" style={{ filter: "drop-shadow(0 0 3px var(--tk-accent))" }} />
        <text x={padL} y={H - 4} fontFamily="var(--f-mono)" fontSize="8" fill="var(--ink-40)">low</text>
        <text x={W - padR} y={H - 4} textAnchor="end" fontFamily="var(--f-mono)" fontSize="8" fill="var(--ink-40)">high p/B</text>
        <text x={W - 4} y={padT + 6} textAnchor="end" fontFamily="var(--f-mono)" fontSize="8" fill="var(--ink-40)">▲ surface</text>
        <text x={W - 4} y={padT + ih} textAnchor="end" fontFamily="var(--f-mono)" fontSize="8" fill="var(--ink-40)">▼ depth</text>
      </svg>
    </SedCard>
  );
}

/* ── live clearance trace — mempool depth over time ─────────── */
export function SedClearance({ data }: { data: MoneroLive }) {
  const [series, setSeries] = React.useState(() => Array.from({ length: 48 }, () => data.mempool.length));
  React.useEffect(() => {
    setSeries((s) => [...s.slice(1), data.mempool.length]);
  }, [data.mempool.length]);
  return (
    <SedCard title="Clearance rate" right={<><span className="led pulse" style={{ background: "var(--g-50)", boxShadow: "0 0 4px var(--g-50)" }} /> live</>}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
        <span className="mono acc glow" style={{ fontSize: 24, fontWeight: 500 }}>{data.mempool.length}</span>
        <span className="mono dim" style={{ fontSize: 10 }}>tx suspended</span>
      </div>
      <Sparkline data={series} width={268} height={56} color="var(--tk-accent)" area={0.28} />
      <div className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, color: "var(--ink-40)", marginTop: 6 }}>
        <span>median 84 p/B</span><span>P90 246 p/B</span><span>next ≈1:54</span>
      </div>
    </SedCard>
  );
}

/* ── live tx feed ───────────────────────────────────────────── */
export function SedTxFeed({ data, onPickTx }: { data: MoneroLive; onPickTx: (id: string) => void }) {
  const max = Math.max(...data.mempool.map((t) => t.perB), 1);
  const rows = data.mempool.slice(0, 12);
  return (
    <SedCard title={"Suspended transactions · " + rows.length + " of " + data.mempool.length} right={<span className="acc">sorted by depth</span>}>
      <div className="mono" style={{ display: "grid", gridTemplateColumns: "1.5fr 80px 110px 96px 1fr 60px", gap: 10, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-40)", padding: "0 8px 6px", borderBottom: "1px solid var(--rule)" }}>
        <span>TXID</span><span>Size</span><span>Fee · XMR</span><span>Fee/B</span><span>Depth</span><span>Age</span>
      </div>
      {rows.map((t) => {
        const depth = 1 - t.perB / max;
        return (
          <div key={t.id} onClick={() => onPickTx(t.id)} style={{ display: "grid", gridTemplateColumns: "1.5fr 80px 110px 96px 1fr 60px", gap: 10, fontSize: 11, padding: "7px 8px", borderBottom: "1px solid rgba(255,255,255,0.03)", cursor: "pointer", fontFamily: "var(--f-mono)", alignItems: "center" }}
            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,122,26,0.07)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
            <span style={{ color: "var(--c-50)" }}>{ShortHash(t.id)}</span>
            <span className="dim">{fmtBytes(t.size)}</span>
            <span className="acc">{t.fee.toFixed(7)}</span>
            <span className="dim">{Math.round(t.perB).toLocaleString()}</span>
            <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden", alignSelf: "center" }}>
              <div style={{ height: "100%", width: ((1 - depth) * 100).toFixed(0) + "%", background: "var(--tk-accent)", boxShadow: "0 0 4px var(--tk-accent)" }} />
            </div>
            <span className="dim2">{t.age}s</span>
          </div>
        );
      })}
    </SedCard>
  );
}

export function SedOverview({ data, onPickTx }: { data: MoneroLive; onPickTx: (id: string) => void }) {
  const memBytes = data.mempool.reduce((a, t) => a + t.size, 0);
  return (
    <div style={{ padding: "16px 20px 40px", display: "flex", flexDirection: "column", gap: 14 }}>
      <section style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
        <Stat k="MEMPOOL" v={data.mempool.length} sub={fmtBytes(memBytes)} tone="acc" />
        <Stat k="NEXT BLOCK" v="≈1:54" sub="2:00 tgt" />
        <Stat k="MEDIAN FEE" v="84 p/B" sub="standard" />
        <Stat k="P90 FEE" v="246 p/B" sub="priority" tone="acc" />
        <Stat k="RING" v="16" sub="CLSAG" tone="p" />
        <Stat k="TIP" v={"#" + (data.height % 1000)} sub={"#" + data.height.toLocaleString()} />
      </section>

      <section style={{ display: "flex", gap: 24, alignItems: "stretch" }}>
        <SedColumn data={data} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, marginLeft: 70 }}>
          <SedCard title="How to read this core" pad="14px 16px">
            <div style={{ fontFamily: "var(--f-serif)", fontSize: 17, lineHeight: 1.34, color: "var(--ink-100)", marginBottom: 8 }}>A cross-section of the mempool, drawn as a sample column.</div>
            <div style={{ fontFamily: "var(--f-mono)", fontSize: 11, color: "var(--ink-60)", lineHeight: 1.55 }}>
              Each <span className="acc">particle</span> is one pending transaction — its <em style={{ color: "var(--ink-100)", fontStyle: "normal" }}>height</em> tracks fee-per-byte and its <em style={{ color: "var(--ink-100)", fontStyle: "normal" }}>size</em> tracks weight. The bright band is the <span className="acc">confirmation interface</span>; strata below are confirmed blocks, brightest at the surface, fading toward <span className="dim">10-deep unlock</span>.
            </div>
          </SedCard>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <SedGrainScatter data={data} />
            <SedRingFan />
          </div>
          <SedClearance data={data} />
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <SedStrataLog data={data} />
        <SedFeeProfile data={data} />
      </section>

      <SedTxFeed data={data} onPickTx={onPickTx} />
    </div>
  );
}

export function SedimentView({ data }: ViewProps) {
  const { tracking, onSearch, clearTracking } = useMempoolTracking(data);
  // Chrome (NavTop / NetRail / Footer) is supplied by the PAGE (MempoolPage).
  // The view renders only content inside the single .main scroll container.
  return (
    <div className="main" style={{ overflow: "auto", padding: 0 }}>
      <div className="mempool-search-bar">
        <MempoolSearchBar onSearch={onSearch} />
        <span className="mono dim" style={{ fontSize: 10.5, marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <span className="led pulse" /> Tip {data.height.toLocaleString()} · stratum-1 forming
        </span>
      </div>
      {tracking ? (
        <MempoolTrackingDetail tracking={tracking} data={data} onBack={clearTracking} onPickTx={(id) => onSearch({ kind: "tx", id })} />
      ) : (
        <SedOverview data={data} onPickTx={(id) => onSearch({ kind: "tx", id })} />
      )}
    </div>
  );
}


