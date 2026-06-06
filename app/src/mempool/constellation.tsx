// AUTO-PORTED from constellation.jsx
// Run `npm run port` to refresh. Manual fixups land in MIGRATION.md.
import * as React from "react";
import { useTick } from "@/design/ArtBackground";
import { Stat } from "@/design/primitives";
import { MempoolSearchBar, useMempoolTracking, MempoolTrackingDetail } from "@/mempool/mempool-shared";
import type { MoneroLive, Block, Peer } from "@/data/types";

interface ViewProps {
  data: MoneroLive;
  bg?: { intensity?: "calm" | "busy" | "chaotic"; scan?: boolean };
}

// constellation.jsx — CONSTELLATION · hi-fi global propagation
//
// The P2P network as a luminous rotating sphere: peers as points, propagation
// as great-circle arcs, the active Dandelion++ stem as a glowing path. Around
// it: a live hop tracker, a peer-latency polar radar, an auto-tailing
// propagation log, and animated geo / client-version instruments.
//
// All helpers prefixed `Con` to avoid shared-scope collisions.

export function ConCard({ title, right, children, pad = "14px 16px", style }: any) {
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

/* ── rotating propagation sphere ────────────────────────────── */
export function ConSphere({ size = 460 }: any) {
  const tick = useTick(50);
  const cx = size / 2, cy = size / 2, r = size / 2 - 26;

  const peers = React.useMemo(() => {
    const arr = [];
    for (let i = 0; i < 110; i++) {
      arr.push({ lat: (Math.random() - 0.5) * Math.PI, lon: Math.random() * Math.PI * 2, old: Math.random() < 0.16 });
    }
    return arr;
  }, []);
  const stem = React.useMemo(() => Array.from({ length: 10 }, () => ({ lat: (Math.random() - 0.5) * Math.PI, lon: Math.random() * Math.PI * 2 })), []);
  const arcs = React.useMemo(() => Array.from({ length: 18 }, (_, i) => ({
    a: { lat: (Math.random() - 0.5) * Math.PI, lon: Math.random() * Math.PI * 2 },
    b: { lat: (Math.random() - 0.5) * Math.PI, lon: Math.random() * Math.PI * 2 },
    progress: Math.random(), speed: 0.005 + Math.random() * 0.012, kind: i % 3 === 0 ? "stem" : "fluff",
  })), []);
  arcs.forEach((a) => { a.progress = (a.progress + a.speed) % 1; });

  const rot = (tick * 0.008) % (Math.PI * 2);
  const project = (lat: number, lon: number) => {
    const lonR = lon + rot;
    return { x: cx + Math.cos(lat) * Math.sin(lonR) * r, y: cy - Math.sin(lat) * r, z: Math.cos(lat) * Math.cos(lonR) };
  };

  return (
    <svg width="100%" viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
      <defs>
        <radialGradient id="con-sph" cx="40%" cy="35%"><stop offset="0%" stopColor="rgba(255,180,80,0.18)" /><stop offset="55%" stopColor="rgba(255,122,26,0.06)" /><stop offset="100%" stopColor="rgba(0,0,0,0.7)" /></radialGradient>
        <radialGradient id="con-atmo"><stop offset="60%" stopColor="rgba(255,122,26,0)" /><stop offset="100%" stopColor="rgba(255,122,26,0.32)" /></radialGradient>
        <linearGradient id="con-arc" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="rgba(255,200,120,0)" /><stop offset="50%" stopColor="rgba(255,200,120,1)" /><stop offset="100%" stopColor="rgba(255,122,26,0)" /></linearGradient>
        <linearGradient id="con-arcp" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="rgba(184,122,255,0)" /><stop offset="50%" stopColor="rgba(184,122,255,1)" /><stop offset="100%" stopColor="rgba(184,122,255,0)" /></linearGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r + 14} fill="url(#con-atmo)" opacity="0.7" />
      <circle cx={cx} cy={cy} r={r} fill="url(#con-sph)" stroke="rgba(255,122,26,0.25)" strokeWidth="0.5" />
      {/* parallels */}
      {[-Math.PI / 3, -Math.PI / 6, 0, Math.PI / 6, Math.PI / 3].map((lat, i) => (
        <ellipse key={i} cx={cx} cy={cy - Math.sin(lat) * r} rx={r * Math.cos(lat)} ry={Math.max(2, r * Math.cos(lat) * 0.06)} fill="none" stroke="rgba(255,122,26,0.12)" strokeWidth="0.5" strokeDasharray="2 4" />
      ))}
      {/* meridians */}
      {[0, 30, 60, 90, 120, 150].map((deg, i) => (
        <ellipse key={i} cx={cx} cy={cy} rx={Math.max(1, Math.abs(Math.sin((deg + rot * 180 / Math.PI) * Math.PI / 180)) * r)} ry={r} fill="none" stroke="rgba(255,122,26,0.09)" strokeWidth="0.5" />
      ))}
      {/* peers */}
      {peers.map((p, i) => {
        const pr = project(p.lat, p.lon);
        if (pr.z < -0.1) return null;
        const opacity = Math.max(0.15, (pr.z + 1) / 2);
        const color = p.old ? "var(--y-50)" : "var(--tk-accent)";
        return <circle key={i} cx={pr.x} cy={pr.y} r={Math.max(0.8, 1 + pr.z * 1.6)} fill={color} opacity={opacity} style={pr.z > 0.5 ? { filter: `drop-shadow(0 0 4px ${color})` } : undefined} />;
      })}
      {/* stem path */}
      {stem.map((s, i) => {
        if (i === stem.length - 1) return null;
        const a = project(s.lat, s.lon), b = project(stem[i + 1].lat, stem[i + 1].lon);
        const active = i === (Math.floor(tick / 18) % 9);
        return <path key={i} d={`M ${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${(a.y + b.y) / 2 - 28} ${b.x} ${b.y}`} fill="none" stroke={active ? "url(#con-arcp)" : "rgba(184,122,255,0.25)"} strokeWidth={active ? 2 : 0.8} style={active ? { filter: "drop-shadow(0 0 6px #b87aff)" } : undefined} />;
      })}
      {/* propagation arcs */}
      {arcs.map((arc, i) => {
        const a = project(arc.a.lat, arc.a.lon), b = project(arc.b.lat, arc.b.lon);
        return <path key={i} d={`M ${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${(a.y + b.y) / 2 - 56} ${b.x} ${b.y}`} fill="none" stroke={arc.kind === "stem" ? "url(#con-arcp)" : "url(#con-arc)"} strokeWidth="1" opacity="0.55" strokeDasharray="56 230" strokeDashoffset={-arc.progress * 286} />;
      })}
      {/* originator pulse */}
      {(() => { const o = project(stem[0].lat, stem[0].lon); return (
        <g><circle cx={o.x} cy={o.y} r="10" fill="none" stroke="#b87aff" strokeWidth="1"><animate attributeName="r" values="6;22;6" dur="2.6s" repeatCount="indefinite" /><animate attributeName="opacity" values="1;0;1" dur="2.6s" repeatCount="indefinite" /></circle><circle cx={o.x} cy={o.y} r="3" fill="#b87aff" style={{ filter: "drop-shadow(0 0 8px #b87aff)" }} /></g>
      ); })()}
      {/* reticle */}
      <g stroke="var(--tk-accent)" fill="none" strokeWidth="0.5" opacity="0.5">
        <line x1={cx - r - 20} y1={cy} x2={cx - r - 5} y2={cy} /><line x1={cx + r + 5} y1={cy} x2={cx + r + 20} y2={cy} />
        <line x1={cx} y1={cy - r - 20} x2={cx} y2={cy - r - 5} /><line x1={cx} y1={cy + r + 5} x2={cx} y2={cy + r + 20} />
        <circle cx={cx} cy={cy} r={r + 7} strokeDasharray="2 8" />
      </g>
      <text x={cx} y="22" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="10" fill="var(--tk-accent)" letterSpacing="0.18em" style={{ filter: "drop-shadow(0 0 4px var(--tk-accent))" }}>MONERO P2P · 4,217 NODES</text>
      <text x={cx} y={size - 8} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="8.5" fill="var(--ink-40)" letterSpacing="0.14em">◀ DANDELION++ STEM · FLUFF p=0.10 ▶</text>
    </svg>
  );
}

/* ── animated active-stem hop tracker ───────────────────────── */
function ConStemTracker() {
  const tick = useTick(1500);
  const cur = tick % 10;
  const hops = ["94.130.157.81", "5.9.84.122", "138.201.131.49", "108.61.176.10", "176.9.34.221", "37.187.74.171", "212.83.175.67", "159.203.62.18", "65.21.187.214", "node.rino.io"];
  return (
    <ConCard title="Active stem · live" right={<span className="acc" style={{ color: "var(--p-50)" }}>HOP {cur + 1}/10</span>}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 4, marginBottom: 12 }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} style={{ height: 30, display: "grid", placeItems: "center", fontFamily: "var(--f-mono)", fontSize: 9,
            background: i < cur ? "linear-gradient(180deg, rgba(184,122,255,0.45), rgba(184,122,255,0.18))" : i === cur ? "rgba(184,122,255,0.25)" : "rgba(255,255,255,0.04)",
            border: i === cur ? "1px solid #b87aff" : "1px solid var(--ink-10)",
            boxShadow: i === cur ? "0 0 12px #b87aff" : "none",
            color: i <= cur ? "#fff" : "var(--ink-40)", transition: "all 0.4s ease" }}>{i + 1}</div>
        ))}
      </div>
      <div className="kv"><span className="k">Originator</span><span className="v" style={{ color: "var(--p-50)" }}>{hops[0]}</span></div>
      <div className="kv"><span className="k">Current hop</span><span className="v acc">{hops[cur]}</span></div>
      <div className="kv"><span className="k">Fluff p</span><span className="v">0.10 · stays stem</span></div>
      <div className="kv"><span className="k">Embargo</span><span className="v">{39 - cur * 3}s</span></div>
      <div className="kv"><span className="k">Anon set</span><span className="v" style={{ color: "var(--p-50)" }}>152.8 M</span></div>
    </ConCard>
  );
}

/* ── peer-latency polar radar ───────────────────────────────── */
export function ConLatencyRadar({ data }: { data: MoneroLive }) {
  const W = 220, c = W / 2, R = c - 14;
  const peers: Peer[] = data.peers;
  const maxLat = 160;
  return (
    <ConCard title="Peer latency · polar" right={<span className="dim">ms by bearing</span>}>
      <svg viewBox={`0 0 ${W} ${W}`} width="100%" style={{ display: "block", maxWidth: 220, margin: "0 auto" }}>
        {[0.33, 0.66, 1].map((f, i) => <circle key={i} cx={c} cy={c} r={R * f} fill="none" stroke="rgba(255,122,26,0.14)" strokeWidth="1" strokeDasharray={i === 2 ? "none" : "2 5"} />)}
        {[40, 80, 120].map((v, i) => <text key={i} x={c + 3} y={c - R * ((i + 1) / 3) + 9} fontFamily="var(--f-mono)" fontSize="7" fill="var(--ink-40)">{v}ms</text>)}
        {peers.map((p, i) => {
          const ang = (i / peers.length) * Math.PI * 2 - Math.PI / 2;
          const rad = Math.min(R, (p.lat / maxLat) * R);
          const x = c + Math.cos(ang) * rad, y = c + Math.sin(ang) * rad;
          const color = p.lat < 60 ? "var(--g-50)" : p.lat < 100 ? "var(--y-50)" : "var(--r-50)";
          return (
            <g key={i}>
              <line x1={c} y1={c} x2={c + Math.cos(ang) * R} y2={c + Math.sin(ang) * R} stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
              <circle cx={x} cy={y} r="3" fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
            </g>
          );
        })}
        <circle cx={c} cy={c} r="3" fill="var(--tk-accent)" style={{ filter: "drop-shadow(0 0 4px var(--tk-accent))" }} />
      </svg>
    </ConCard>
  );
}

/* ── live propagation log ───────────────────────────────────── */
function ConPropLog() {
  const tmpl = [
    ["STEM-FORWARD", "p", "h={h} → 5.9.84.122:18080", "lat {l}ms"],
    ["TX-RECV", "g", "65.21.187.214 ⟶ stem h0", "ring 16"],
    ["FLUFF-GOSSIP", "acc", "94.130.157.81 → {n} peers", "embargo {e}s"],
    ["BLOCK-SOLVE", "acc", "#3,676,0{b} · P2Pool", "0.601 XMR"],
    ["PEER-OUT", "dim", "212.83.175.67 conn", "v0.18.4.0"],
    ["TX-CONFIRM", "g", "block incl. {n} tx", "1 conf"],
    ["STEM-FORWARD", "p", "h={h} → 159.203.62.18", "lat {l}ms"],
  ];
  const ts = () => new Date().toISOString().slice(11, 23);
  const fill = (s: string) => s.replace("{h}", String(1 + (Math.random() * 9 | 0))).replace("{l}", String(38 + (Math.random() * 90 | 0))).replace("{n}", String(6 + (Math.random() * 8 | 0))).replace("{e}", String(30 + (Math.random() * 12 | 0))).replace("{b}", String(60 + (Math.random() * 9 | 0)));
  const mk = () => { const t = tmpl[Math.floor(Math.random() * tmpl.length)]; return { ts: ts(), ev: t[0], tone: t[1], msg: fill(t[2]), meta: fill(t[3]), id: Math.random() }; };
  const [rows, setRows] = React.useState(() => Array.from({ length: 11 }, mk));
  React.useEffect(() => { const id = setInterval(() => setRows((r) => [mk(), ...r].slice(0, 11)), 1600); return () => clearInterval(id); }, []);
  const col: Record<string, string> = { p: "var(--p-50)", acc: "var(--tk-accent)", g: "var(--g-50)", dim: "var(--ink-60)" };
  return (
    <ConCard title="Propagation log · tail" right={<><span className="led pulse" style={{ background: "var(--g-50)", boxShadow: "0 0 4px var(--g-50)" }} /> −f</>}>
      <div style={{ fontFamily: "var(--f-mono)", fontSize: 10.5, lineHeight: 1.55 }}>
        {rows.map((l) => (
          <div key={l.id} style={{ display: "grid", gridTemplateColumns: "104px 120px 1fr 96px", gap: 8, padding: "2px 0", borderBottom: "1px dashed rgba(255,255,255,0.04)", animation: "con-slidein 0.4s ease" }}>
            <span className="dim2">{l.ts}</span>
            <span style={{ color: col[l.tone] }}>{l.ev}</span>
            <span className="dim" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.msg}</span>
            <span className="dim2" style={{ textAlign: "right" }}>{l.meta}</span>
          </div>
        ))}
      </div>
      <style>{`@keyframes con-slidein { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: none; } }`}</style>
    </ConCard>
  );
}

/* ── animated geographic distribution ───────────────────────── */
function ConGeoBars() {
  const geo = [
    ["DE", "Germany", 24.3, "var(--tk-accent)"], ["US", "United States", 19.8, "var(--c-50)"],
    ["FR", "France", 11.2, "var(--g-50)"], ["NL", "Netherlands", 7.4, "var(--p-50)"],
    ["FI", "Finland", 5.6, "var(--y-50)"], ["JP", "Japan", 4.1, "var(--r-50)"],
    ["??", "Tor / I2P (hidden)", 21.2, "rgba(168,160,148,0.5)"],
  ];
  return (
    <ConCard title="Geographic distribution" right={<span className="acc">4,217 visible</span>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {geo.map(([c, n, p, color], i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "22px 1fr 90px 38px", gap: 8, alignItems: "center", fontFamily: "var(--f-mono)", fontSize: 10 }}>
            <span className="dim2">{c}</span>
            <span className="dim" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n}</span>
            <div style={{ height: 7, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: p + "%", background: color, boxShadow: `0 0 6px ${color}`, borderRadius: 3, transition: "width 0.8s ease" }} />
            </div>
            <span style={{ textAlign: "right", color: "var(--ink-100)" }}>{p}%</span>
          </div>
        ))}
      </div>
    </ConCard>
  );
}

/* ── client-version donut ───────────────────────────────────── */
function ConVersionDonut() {
  const segs: [string, number, string][] = [["0.18.4.0", 83.2, "var(--tk-accent)"], ["0.18.3.4", 14.1, "var(--y-50)"], ["older", 2.7, "var(--r-50)"]];
  const cx = 70, cy = 70, r = 52, sw = 16, circ = 2 * Math.PI * r;
  let acc = 0;
  return (
    <ConCard title="Client versions" right={<span className="acc">majority synced</span>}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <svg viewBox="0 0 140 140" width="124" height="124">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={sw} />
          {segs.map(([l, p, color], i) => {
            const len = (p / 100) * circ;
            const el = <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={sw} strokeDasharray={len + " " + (circ - len)} strokeDashoffset={-acc} transform={`rotate(-90 ${cx} ${cy})`} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />;
            acc += len; return el;
          })}
          <text x={cx} y={cy - 2} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="16" fontWeight="500" fill="var(--tk-accent)">83%</text>
          <text x={cx} y={cy + 12} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="7.5" fill="var(--ink-40)" letterSpacing="0.12em">FLUORINE</text>
        </svg>
        <div style={{ flex: 1 }}>
          {segs.map(([l, p, color], i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--f-mono)", fontSize: 10.5, padding: "3px 0" }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: color, boxShadow: `0 0 4px ${color}` }} />
              <span className="dim" style={{ flex: 1 }}>{l}</span>
              <span className="acc">{p}%</span>
            </div>
          ))}
          <div className="kv" style={{ marginTop: 6 }}><span className="k">Tor exit</span><span className="v" style={{ color: "var(--p-50)" }}>14.8%</span></div>
          <div className="kv"><span className="k">I2P</span><span className="v" style={{ color: "var(--p-50)" }}>6.4%</span></div>
        </div>
      </div>
    </ConCard>
  );
}

/* ── block stream strip ─────────────────────────────────────── */
export function ConBlockStream({ data }: { data: MoneroLive }) {
  return (
    <ConCard title="Block stream" right={<span className="acc">+2 queued</span>}>
      <div style={{ display: "flex", gap: 4, height: 96, alignItems: "flex-end" }}>
        <div className="mblock q" style={{ width: 42, height: 72 }}><div className="hh">~+2</div><div className="nm" style={{ fontSize: 12 }}>Q</div></div>
        <div className="mblock q" style={{ width: 42, height: 78 }}><div className="hh">~+1</div><div className="nm" style={{ fontSize: 12 }}>NXT</div></div>
        {data.blocks.slice(0, 8).map((b) => (
          <div className="mblock" key={b.height} style={{ width: 42, height: 58 + Math.min(34, (b.txs / 140) * 34) }}>
            <div className="hh" style={{ fontSize: 8 }}>{b.conf}c</div>
            <div className="nm" style={{ fontSize: 12 }}>{b.txs}</div>
          </div>
        ))}
      </div>
    </ConCard>
  );
}

export function ConOverview({ data }: { data: MoneroLive }) {
  return (
    <div style={{ padding: "16px 20px 40px", display: "flex", flexDirection: "column", gap: 14 }}>
      <section style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 14, alignItems: "start" }}>
        <ConCard title="Global propagation · live mesh" right={<span className="acc" style={{ color: "var(--p-50)" }}>DANDELION++ ACTIVE</span>} style={{ display: "flex", flexDirection: "column" }}>
          <ConSphere size={460} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginTop: 8 }}>
            <Stat k="REACHABLE" v="4,217" sub="dec 26" />
            <Stat k="V0.18.4" v="83.2%" sub="majority" tone="acc" />
            <Stat k="V0.18.3" v="14.1%" sub="lag" />
            <Stat k="TOR" v="14.8%" sub="anon" tone="p" />
            <Stat k="I2P" v="6.4%" sub="anon" tone="p" />
            <Stat k="CLEARNET" v="78.8%" />
          </div>
        </ConCard>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <ConStemTracker />
          <ConLatencyRadar data={data} />
        </div>
      </section>

      <ConPropLog />

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        <ConGeoBars />
        <ConVersionDonut />
        <ConBlockStream data={data} />
      </section>
    </div>
  );
}

export function ConstellationView({ data }: ViewProps) {
  const { tracking, onSearch, clearTracking } = useMempoolTracking(data);
  return (
    <div className="main" style={{ overflow: "auto", padding: 0 }}>
      <div className="mempool-search-bar">
        <MempoolSearchBar onSearch={onSearch} />
        <span className="mono dim" style={{ fontSize: 10.5, marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <span className="led pulse" /> Rotating mesh · {data.peers.length} peers visible
        </span>
      </div>
      {tracking ? (
        <MempoolTrackingDetail tracking={tracking} data={data} onBack={clearTracking} onPickTx={(id) => onSearch({ kind: "tx", id })} />
      ) : (
        <ConOverview data={data} />
      )}
    </div>
  );
}


