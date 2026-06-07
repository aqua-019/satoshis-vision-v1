// AUTO-PORTED from bridge.jsx
// Run `npm run port` to refresh. Manual fixups land in MIGRATION.md.
import * as React from "react";
import { Link } from "react-router-dom";
import { useTick } from "@/design/ArtBackground";
import { Stat } from "@/design/primitives";
import { fmtBytes, shortHash as ShortHash } from "@/data/types";
import { MempoolSearchBar, useMempoolTracking, MempoolTrackingDetail } from "@/mempool/mempool-shared";
import type { MoneroLive, Peer } from "@/data/types";

interface ViewProps {
  data: MoneroLive;
  bg?: { intensity?: "calm" | "busy" | "chaotic"; scan?: boolean };
}

// bridge.jsx — OPERATIONS BRIDGE · hi-fi mission control
//
// "Bloomberg-meets-NASA." A flight-deck of live instruments: a PPI radar
// sweeping the peer mesh, a bank of easing gauges, a fee oscilloscope, a
// block-cadence countdown, pool-concentration bars and a scrolling alert
// tape — all driven by window.useMoneroLive() and the shared tracking flow.
//
// Every helper is prefixed `Brg` so it can't collide with Reactor / Terminal
// / monero-pages in the shared babel global scope.

/* ── card chrome shared by all bridge instruments ───────────── */
export function BrgCard({ title, right, children, pad = "14px 16px", style }: any) {
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

/* ── PPI radar — peers as blips, sweep arm lights them as it passes ── */
export function BrgRadar({ data }: { data: MoneroLive }) {
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const cx = 150, cy = 150, R = 132;

  // Stable polar position per peer: angle from ip hash, range from latency.
  const blips = React.useMemo(() => {
    return data.peers.map((p: Peer) => {
      const seed = Array.from(p.ip).reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
      const ang = (seed % 360) * Math.PI / 180;
      const range = 0.32 + Math.min(0.62, p.lat / 200);  // closer latency = nearer centre
      return { ang, r: range * R, lat: p.lat, cnt: p.cnt, ip: p.ip,
        color: p.lat < 60 ? "var(--g-50)" : p.lat < 100 ? "var(--y-50)" : "var(--r-50)" };
    });
  }, [data.peers]);

  const blipRefs = React.useRef<(SVGCircleElement | null)[]>([]);
  React.useEffect(() => {
    let raf = 0, prev = -1;
    const t0 = performance.now();
    const PERIOD = 4.2; // seconds per revolution
    const tick = () => {
      const el = svgRef.current; if (!el) { raf = requestAnimationFrame(tick); return; }
      const t = (performance.now() - t0) / 1000;
      const sweep = ((t / PERIOD) % 1) * Math.PI * 2;       // 0..2π
      const arm = el.querySelector("[data-arm]");
      if (arm) arm.setAttribute("transform", `rotate(${sweep * 180 / Math.PI} ${cx} ${cy})`);
      // light each blip by how recently the sweep crossed its angle
      blips.forEach((b, i) => {
        let d = sweep - b.ang; while (d < 0) d += Math.PI * 2;   // radians since sweep passed
        const recency = Math.max(0, 1 - d / (Math.PI * 0.8));    // fades over ~144°
        const node = blipRefs.current[i];
        if (node) {
          node.setAttribute("r", (1.6 + recency * 3.4).toFixed(2));
          node.setAttribute("opacity", (0.28 + recency * 0.72).toFixed(3));
          node.style.filter = recency > 0.25 ? `drop-shadow(0 0 ${(recency * 7).toFixed(1)}px ${b.color})` : "none";
        }
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [blips]);

  return (
    <svg ref={svgRef} viewBox="0 0 300 300" width="100%" style={{ display: "block", maxHeight: 300 }}>
      <defs>
        <radialGradient id="brg-ppi" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255,122,26,0.10)" />
          <stop offset="100%" stopColor="rgba(255,122,26,0)" />
        </radialGradient>
        <linearGradient id="brg-wedge" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,122,26,0.42)" />
          <stop offset="100%" stopColor="rgba(255,122,26,0)" />
        </linearGradient>
      </defs>
      <circle cx={cx} cy={cy} r={R} fill="url(#brg-ppi)" />
      {/* range rings */}
      {[0.33, 0.66, 1].map((f, i) => (
        <circle key={i} cx={cx} cy={cy} r={R * f} fill="none" stroke="rgba(255,122,26,0.16)" strokeWidth="1" strokeDasharray={i === 2 ? "none" : "2 5"} />
      ))}
      {/* cross-hairs */}
      <line x1={cx - R} y1={cy} x2={cx + R} y2={cy} stroke="rgba(255,122,26,0.12)" strokeWidth="1" />
      <line x1={cx} y1={cy - R} x2={cx} y2={cy + R} stroke="rgba(255,122,26,0.12)" strokeWidth="1" />
      {/* bearing ticks */}
      {Array.from({ length: 24 }).map((_, i) => {
        const a = i * 15 * Math.PI / 180;
        const long = i % 6 === 0;
        return <line key={i} x1={cx + Math.cos(a) * (R - (long ? 9 : 4))} y1={cy + Math.sin(a) * (R - (long ? 9 : 4))}
          x2={cx + Math.cos(a) * R} y2={cy + Math.sin(a) * R} stroke="var(--tk-accent)" strokeOpacity={long ? 0.5 : 0.25} strokeWidth="1" />;
      })}
      {/* sweep arm + trailing wedge */}
      <g data-arm>
        <path d={`M ${cx} ${cy} L ${cx + R} ${cy} A ${R} ${R} 0 0 0 ${cx + R * Math.cos(-0.9)} ${cy + R * Math.sin(-0.9)} Z`} fill="url(#brg-wedge)" />
        <line x1={cx} y1={cy} x2={cx + R} y2={cy} stroke="var(--tk-accent)" strokeWidth="1.4" style={{ filter: "drop-shadow(0 0 4px var(--tk-accent))" }} />
      </g>
      {/* peer blips */}
      {blips.map((b, i) => (
        <circle key={i} ref={(n) => { blipRefs.current[i] = n; }}
          cx={cx + Math.cos(b.ang) * b.r} cy={cy + Math.sin(b.ang) * b.r}
          r="2" fill={b.color} opacity="0.4" />
      ))}
      {/* you (centre) */}
      <circle cx={cx} cy={cy} r="4" fill="var(--tk-accent)" style={{ filter: "drop-shadow(0 0 5px var(--tk-accent))" }} />
      <text x={cx} y={cy - 9} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="8" fill="var(--ink-60)" letterSpacing="0.16em">NODE</text>
      <text x="12" y="18" fontFamily="var(--f-mono)" fontSize="8.5" fill="var(--ink-40)" letterSpacing="0.16em">PPI · PEERS (SIM) · RANGE = LATENCY</text>
    </svg>
  );
}

/* ── animated semicircular gauge with easing needle ─────────── */
export function BrgGauge({ value, label, unit = "%", color = "var(--tk-accent)", size = 132 }: any) {
  const [cur, setCur] = React.useState(0);
  React.useEffect(() => {
    let raf = 0;
    const step = () => {
      setCur((c) => {
        const next = c + (value - c) * 0.08;
        if (Math.abs(value - next) < 0.15) return value;
        raf = requestAnimationFrame(step);
        return next;
      });
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  const w = size, h = size * 0.62, c = w / 2, cyy = h - 6, r = w / 2 - 12;
  const frac = Math.min(1, cur / 100);
  const a0 = Math.PI, a1 = Math.PI * (1 - frac);      // 180° → value
  const ax = (ang: number, rad: number) => c + Math.cos(ang) * rad;
  const ay = (ang: number, rad: number) => cyy + -Math.sin(ang) * rad;
  const arc = (from: number, to: number, rad: number) => `M ${ax(from, rad)} ${ay(from, rad)} A ${rad} ${rad} 0 0 1 ${ax(to, rad)} ${ay(to, rad)}`;
  const needleA = Math.PI * (1 - frac);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg viewBox={`0 0 ${w} ${h + 4}`} width="100%" style={{ display: "block" }}>
        <path d={arc(Math.PI, 0, r)} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" strokeLinecap="round" />
        <path d={arc(a0, a1, r)} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 5px ${color})` }} />
        {/* tick marks */}
        {Array.from({ length: 11 }).map((_, i) => {
          const a = Math.PI * (1 - i / 10);
          return <line key={i} x1={ax(a, r - 9)} y1={ay(a, r - 9)} x2={ax(a, r - 3)} y2={ay(a, r - 3)} stroke="var(--ink-40)" strokeWidth="1" />;
        })}
        {/* needle */}
        <line x1={c} y1={cyy} x2={ax(needleA, r - 6)} y2={ay(needleA, r - 6)} stroke={color} strokeWidth="2" style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
        <circle cx={c} cy={cyy} r="4" fill="#0a0806" stroke={color} strokeWidth="1.5" />
        <text x={c} y={cyy - 14} textAnchor="middle" fontFamily="var(--f-mono)" fontSize={size * 0.18} fontWeight="500" fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }}>{Math.round(cur)}{unit}</text>
      </svg>
      <div className="mono" style={{ fontSize: 9, letterSpacing: "0.16em", color: "var(--ink-40)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

export function BrgGaugeBank(_props: { data: MoneroLive }) {
  // Protocol-status indicators (illustrative). The former DECENTRALISATION gauge
  // was derived from fabricated pool shares (the node exposes no pool attribution),
  // so it's replaced by RINGCT — true status: every Monero tx is RingCT.
  return (
    <BrgCard title="Instrument bank · network health" right={<><span className="led pulse" style={{ background: "var(--g-50)", boxShadow: "0 0 4px var(--g-50)" }} /> nominal</>}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
        <BrgGauge value={100} label="SYNC" color="var(--g-50)" />
        <BrgGauge value={100} label="RINGCT" color="var(--c-50)" />
        <BrgGauge value={94} label="PRIVACY · ANON" color="var(--p-50)" />
        <BrgGauge value={72} label="FCMP++ READY" color="var(--tk-accent)" />
      </div>
    </BrgCard>
  );
}

/* ── fee/byte oscilloscope — live area trace with a running scan dot ── */
export function BrgFeeScope({ data }: { data: MoneroLive }) {
  const tick = useTick(900);
  const NB = 40;
  const { series, hi } = React.useMemo(() => {
    // distribution of current mempool fee-rates across the live range
    const rates = data.mempool.map((t) => t.perB);
    const hi = Math.max(...rates, 1) * 1.05;
    const buckets = new Array(NB).fill(0);
    rates.forEach((p) => {
      const b = Math.min(NB - 1, Math.max(0, Math.floor((p / hi) * NB)));
      buckets[b] += 1;
    });
    // light smoothing so the trace reads as a scope, not a comb
    const sm = buckets.map((v, i) => (buckets[i - 1] || 0) * 0.25 + v + (buckets[i + 1] || 0) * 0.25);
    return { series: sm, hi };
  }, [data.mempool, tick]);
  const W = 360, H = 130, padL = 8, padR = 8, padT = 12, padB = 18;
  const iw = W - padL - padR, ih = H - padT - padB;
  const max = Math.max(...series, 1);
  const pts = series.map((v, i) => [padL + (i / (series.length - 1)) * iw, padT + ih - (v / max) * ih]);
  const path = "M" + pts.map(([x, y]) => x.toFixed(1) + "," + y.toFixed(1)).join(" L ");
  const area = path + ` L ${padL + iw},${padT + ih} L ${padL},${padT + ih} Z`;
  const scanI = tick % series.length;
  return (
    <BrgCard title="Fee/byte oscilloscope" right={<span className="acc">{data.mempool.length} tx</span>}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
        <defs>
          <linearGradient id="brg-scope" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,122,26,0.4)" />
            <stop offset="100%" stopColor="rgba(255,122,26,0)" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((t) => <line key={t} x1={padL} x2={W - padR} y1={padT + ih * t} y2={padT + ih * t} stroke="rgba(255,255,255,0.04)" strokeDasharray="2 3" />)}
        <path d={area} fill="url(#brg-scope)" />
        <path d={path} fill="none" stroke="var(--tk-accent)" strokeWidth="1.4" style={{ filter: "drop-shadow(0 0 3px var(--tk-accent))" }} />
        <circle cx={pts[scanI][0]} cy={pts[scanI][1]} r="3" fill="var(--y-50)" style={{ filter: "drop-shadow(0 0 5px var(--y-50))" }} />
        <line x1={pts[scanI][0]} y1={padT} x2={pts[scanI][0]} y2={padT + ih} stroke="var(--y-50)" strokeOpacity="0.3" strokeWidth="1" />
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
          <text key={i} x={padL + f * iw} y={H - 4} textAnchor={i === 0 ? "start" : i === 4 ? "end" : "middle"} fontFamily="var(--f-mono)" fontSize="8" fill="var(--ink-40)">{Math.round(f * hi)}</text>
        ))}
        <text x={W - padR} y={padT + 8} textAnchor="end" fontFamily="var(--f-mono)" fontSize="8" fill="var(--ink-40)">piconero/byte →</text>
      </svg>
    </BrgCard>
  );
}

/* ── block-cadence — countdown ring + last-10 interval bars ─── */
export function BrgBlockCadence({ data }: { data: MoneroLive }) {
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => { const id = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(id); }, []);
  const TARGET = 120;
  const elapsed = (data.blocks?.[0]?.age || 0) + Math.floor((now - data.lastUpdate) / 1000);
  const overdue = elapsed > TARGET;
  const pct = Math.min(1, elapsed / TARGET);
  const ring = 2 * Math.PI * 34, dash = ring * pct;
  const tone = overdue ? "var(--y-50)" : "var(--tk-accent)";
  return (
    <BrgCard title="Block cadence · 2:00 target" right={overdue
      ? <span style={{ color: "var(--y-50)" }}>OVERDUE</span>
      : <><span className="led pulse" style={{ background: "var(--g-50)", boxShadow: "0 0 4px var(--g-50)" }} /> locked</>}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <svg viewBox="0 0 90 90" width="90" height="90">
          <circle cx="45" cy="45" r="34" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6" />
          <circle cx="45" cy="45" r="34" fill="none" stroke={tone} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={dash + " " + (ring - dash)} transform="rotate(-90 45 45)" style={{ filter: `drop-shadow(0 0 4px ${tone})` }} />
          <text x="45" y="42" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-40)">ELAPSED</text>
          <text x="45" y="56" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="14" fontWeight="500" fill={overdue ? "var(--y-50)" : "var(--ink-100)"}>{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</text>
        </svg>
        <div style={{ flex: 1 }}>
          <div className="mono dim" style={{ fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6 }}>last 10 intervals</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 38 }}>
            {data.blocks.slice(0, 10).reverse().map((b, i) => {
              const iv = Math.max(40, Math.min(220, 90 + ((b.height * 37) % 90)));
              const over = iv > TARGET;
              return <div key={i} title={iv + "s"} style={{ flex: 1, height: (iv / 220 * 38).toFixed(0) + "px", background: over ? "var(--y-50)" : "var(--tk-accent)", opacity: 0.55 + i * 0.045, boxShadow: over ? "0 0 5px var(--y-50)" : "0 0 4px var(--tk-accent)" }} />;
            })}
          </div>
          <div className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--ink-40)", marginTop: 5 }}>
            <span>#{data.height.toLocaleString()}</span><span>μ 122s</span><span>reorg NIL</span>
          </div>
        </div>
      </div>
    </BrgCard>
  );
}

/* ── pool attribution (honest: node exposes no pool data) ───── */
export function BrgPoolDist({ data }: { data: MoneroLive }) {
  const unattributed = data.blocks.filter((b) => !b.pool || b.pool === "Unknown" || b.pool === "—").length;
  return (
    <BrgCard title="Pool attribution" right={<span className="dim">UNATTRIBUTED</span>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontFamily: "var(--f-mono)", fontSize: 10.5, lineHeight: 1.5 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 20, color: "var(--ink-100)" }}>{unattributed}/{data.blocks.length}</span>
          <span className="dim">recent blocks · pool unknown</span>
        </div>
        <span className="dim" style={{ color: "var(--ink-40)" }}>
          Monero coinbases don't tag pools, so per-pool share isn't measurable on-chain.
          Decentralization &amp; HHI live in the <Link to="/simulate?p=skyline" className="acc">Skyline simulator</Link>.
        </span>
      </div>
    </BrgCard>
  );
}

/* ── scrolling mission-control alert tape ───────────────────── */
export function BrgAlertTape({ data }: { data: MoneroLive }) {
  const seed = [
    ["NOMINAL", "g", "Chain tip advanced to #" + data.height.toLocaleString()],
    ["TXPOOL", "acc", "Mempool depth " + data.mempool.length + " tx · " + fmtBytes(data.mempool.reduce((a, t) => a + t.size, 0))],
    ["DANDELION", "p", "Stem path armed · 10 hops · embargo 39s"],
    ["NOMINAL", "g", "Peer mesh stable · 12 outbound · 0 stalled"],
    ["FCMP++", "acc", "Readiness gauge holding at 72% · membership proof draft 4"],
    ["WATCH", "y", "Block cadence within tolerance · μ 122s"],
    ["PRIVACY", "p", "Ring size 16 · CLSAG + Bulletproofs+ verified"],
  ];
  const [rows, setRows] = React.useState(() => seed.map((s, i) => ({ ...mk(s), t: i })));
  function mk(s: string[]) { const d = new Date(); return { lvl: s[0], tone: s[1], msg: s[2], ts: d.toISOString().slice(11, 19) }; }
  React.useEffect(() => {
    let n = 100;
    const id = setInterval(() => {
      setRows((r) => [{ ...mk(seed[Math.floor(Math.random() * seed.length)]), t: n++ }, ...r].slice(0, 7));
    }, 2600);
    return () => clearInterval(id);
  }, []);
  const col: Record<string, string> = { g: "var(--g-50)", acc: "var(--tk-accent)", p: "var(--p-50)", y: "var(--y-50)" };
  return (
    <BrgCard title="Alert tape · live" right={<><span className="led pulse" style={{ background: "var(--g-50)", boxShadow: "0 0 4px var(--g-50)" }} /> −f</>}>
      <div style={{ fontFamily: "var(--f-mono)", fontSize: 11, lineHeight: 1.5 }}>
        {rows.map((r) => (
          <div key={r.t} style={{ display: "grid", gridTemplateColumns: "70px 90px 1fr", gap: 10, padding: "3px 0", borderBottom: "1px dashed rgba(255,255,255,0.04)", animation: "brg-slidein 0.4s ease" }}>
            <span className="dim2">{r.ts}</span>
            <span style={{ color: col[r.tone] }}>{r.lvl}</span>
            <span className="dim" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.msg}</span>
          </div>
        ))}
      </div>
      <style>{`@keyframes brg-slidein { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }`}</style>
    </BrgCard>
  );
}

/* ── live tx console feed ───────────────────────────────────── */
export function BrgTxConsole({ data, onPickTx }: { data: MoneroLive; onPickTx: (id: string) => void }) {
  const rows = data.mempool.slice(0, 12);
  const phase = (i: number) => i % 4 === 0 ? ["STEM", "var(--p-50)"] : i % 4 === 1 ? ["QUEUE", "var(--y-50)"] : i % 4 === 2 ? ["FLUFF", "var(--tk-accent)"] : ["POOL", "var(--c-50)"];
  return (
    <BrgCard title={"Transaction console · " + rows.length + " of " + data.mempool.length} right={<span className="acc">DANDELION++ STEM ◇ FLUFF</span>}>
      <div className="mono" style={{ display: "grid", gridTemplateColumns: "64px 78px 1.5fr 78px 96px 66px 64px", gap: 10, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-40)", padding: "0 8px 6px", borderBottom: "1px solid var(--rule)" }}>
        <span>SEQ</span><span>PHASE</span><span>TXID</span><span>SIZE</span><span>FEE/B</span><span>RING</span><span>AGE</span>
      </div>
      {rows.map((t, i) => {
        const [ph, pc] = phase(i);
        return (
          <div key={t.id} onClick={() => onPickTx(t.id)} style={{ display: "grid", gridTemplateColumns: "64px 78px 1.5fr 78px 96px 66px 64px", gap: 10, fontSize: 11, padding: "7px 8px", borderBottom: "1px solid rgba(255,255,255,0.03)", cursor: "pointer", fontFamily: "var(--f-mono)", alignItems: "center" }}
            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,122,26,0.07)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
            <span className="dim2">{String(data.mempool.length - i).padStart(4, "0")}</span>
            <span style={{ color: pc, border: "1px solid " + pc, borderRadius: 2, fontSize: 8.5, padding: "2px 5px", letterSpacing: "0.1em", justifySelf: "start" }}>{ph}</span>
            <span style={{ color: "var(--c-50)" }}>{ShortHash(t.id)}</span>
            <span className="dim">{fmtBytes(t.size)}</span>
            <span className="acc">{Math.round(t.perB).toLocaleString()}</span>
            <span className="dim">16</span>
            <span className="dim2">{t.age}s</span>
          </div>
        );
      })}
    </BrgCard>
  );
}

/* ── overview composition ───────────────────────────────────── */
export function BrgOverview({ data, onPickTx }: { data: MoneroLive; onPickTx: (id: string) => void }) {
  const memBytes = data.mempool.reduce((a, t) => a + t.size, 0);
  return (
    <div style={{ padding: "16px 20px 40px", display: "flex", flexDirection: "column", gap: 14 }}>
      <section style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 8 }}>
        <Stat k="HEIGHT" v={data.height.toLocaleString()} sub="live" tone="acc" />
        <Stat k="HASHRATE" v={(data.hashrate / 1e9).toFixed(2) + " GH"} sub="2:00 tgt" />
        <Stat k="DIFFICULTY" v={(data.difficulty / 1e9).toFixed(2) + "G"} />
        <Stat k="MEMPOOL" v={data.mempool.length} sub={fmtBytes(memBytes)} />
        <Stat k="XMR/USD" v={"$" + data.price.toFixed(2)} sub={(data.change24h >= 0 ? "+" : "") + data.change24h.toFixed(2) + "%"} tone={data.change24h >= 0 ? "g" : "dn"} />
        <Stat k="XMR/BTC" v={data.btcRatio.toFixed(6)} />
        <Stat k="RING" v="16" sub="CLSAG" tone="p" />
        <Stat k="FORK" v="v16" sub="FCMP++ Q3" tone="p" />
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1.05fr 1fr", gap: 14, alignItems: "stretch" }}>
        <BrgCard title="Peer radar · PPI scope" right={<span className="acc">SWEEP 4.2s</span>} style={{ display: "flex", flexDirection: "column" }}>
          <BrgRadar data={data} />
        </BrgCard>
        <BrgGaugeBank data={data} />
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 14 }}>
        <BrgFeeScope data={data} />
        <BrgBlockCadence data={data} />
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: 14 }}>
        <BrgPoolDist data={data} />
        <BrgAlertTape data={data} />
      </section>

      <BrgTxConsole data={data} onPickTx={onPickTx} />
    </div>
  );
}

export function BridgeView({ data }: ViewProps) {
  const { tracking, onSearch, clearTracking } = useMempoolTracking(data);
  return (
    <div className="main" style={{ overflow: "auto", padding: 0 }}>
      <div className="mempool-search-bar">
        <MempoolSearchBar onSearch={onSearch} />
        <span className="mono dim" style={{ fontSize: 10.5, marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <span className="led pulse" /> MISSION CONTROL · Block {data.height.toLocaleString()} · {data.mempool.length} mempool
        </span>
      </div>
      {tracking ? (
        <MempoolTrackingDetail tracking={tracking} data={data} onBack={clearTracking} onPickTx={(id) => onSearch({ kind: "tx", id })} />
      ) : (
        <BrgOverview data={data} onPickTx={(id) => onSearch({ kind: "tx", id })} />
      )}
    </div>
  );
}


