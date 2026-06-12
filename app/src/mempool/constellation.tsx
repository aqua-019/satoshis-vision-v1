// AUTO-PORTED from constellation.jsx
// Run `npm run port` to refresh. Manual fixups land in MIGRATION.md.
import * as React from "react";
import { useTick } from "@/design/ArtBackground";
import { Stat } from "@/design/primitives";
import { MempoolSearchBar, useMempoolTracking, MempoolTrackingDetail } from "@/mempool/mempool-shared";
import type { MoneroLive, Tx } from "@/data/types";
import { fmtBytes, shortHash } from "@/data/types";
import { hashToUnit, FEE_TIER_LABELS, feeTierIndex } from "@/data/map";
import { useFeedEvents, type FeedEvent } from "@/data/useFeedEvents";

interface ViewProps {
  data: MoneroLive;
  bg?: { intensity?: "calm" | "busy" | "chaotic"; scan?: boolean };
}

// constellation.jsx — CONSTELLATION · hi-fi live mempool
//
// The mempool as a luminous rotating sphere: every point is a REAL unconfirmed
// tx from the node — positions are hash-derived from the txid (stable, honest
// decoration), size/glow/color come from the real fee rate. Around it: a
// newest-tx card, an age-vs-fee polar radar, a live feed-event log, and
// fee-tier distribution instruments. Subjects are live node data throughout;
// only coordinates and rotation are procedural.
//
// All helpers prefixed `Con` to avoid shared-scope collisions.

/** Fee-tier colors, slow → fastest. */
const TIER_COLORS = ["var(--c-50)", "var(--g-50)", "var(--y-50)", "var(--r-50)"];
const tierColor = (i: number): string => (i >= 0 && i < 4 ? TIER_COLORS[i] : "var(--tk-accent)");

/** Median fee rate (piconero/B) of the pool — null when empty. */
function medianPerB(txs: Tx[]): number | null {
  if (!txs.length) return null;
  const s = txs.map((t) => t.perB).sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Newest = smallest age (seconds since arrival). */
const newestFirst = (txs: Tx[]): Tx[] => [...txs].sort((a, b) => a.age - b.age);

/** Seconds → m:ss (block target display). */
const fmtTargetSec = (t: number): string =>
  t > 0 ? `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, "0")}` : "—";

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

/* ── rotating mempool sphere ────────────────────────────────────
   Points = the newest ≤60 real mempool txs. lat/lon are hash-derived
   from each txid (two independent stable units), so a tx keeps its spot
   for its whole pool lifetime. Radius/glow scale with real perB. */
export function ConSphere({ txs, tiers, ready, size = 460 }: { txs: Tx[]; tiers: number[]; ready: boolean; size?: number }) {
  const tick = useTick(50);
  const cx = size / 2, cy = size / 2, r = size / 2 - 26;

  const pts = React.useMemo(() => {
    const sample = newestFirst(txs).slice(0, Math.min(60, txs.length));
    return sample.map((t) => ({
      id: t.id,
      lat: (hashToUnit(t.id) - 0.5) * 160 * (Math.PI / 180),
      lon: (hashToUnit(t.id + "·") * 360 - 180) * (Math.PI / 180),
      perB: t.perB,
    }));
  }, [txs]);
  const maxPerB = pts.reduce((m, p) => Math.max(m, p.perB), 0) || 1;

  // Decorative arcs between pairs of REAL tx points; partners picked by txid hash.
  const arcs = React.useMemo(() => {
    if (pts.length < 2) return [];
    return pts.slice(0, Math.min(18, Math.floor(pts.length / 2))).map((p, i) => {
      let j = (i + 1 + Math.floor(hashToUnit(p.id + "→") * (pts.length - 1))) % pts.length;
      if (j === i) j = (i + 1) % pts.length;
      return { a: p, b: pts[j], u: hashToUnit(p.id + "⇄") };
    });
  }, [pts]);

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
      {/* real mempool txs */}
      {pts.map((p) => {
        const pr = project(p.lat, p.lon);
        if (pr.z < -0.1) return null;
        const opacity = Math.max(0.15, (pr.z + 1) / 2);
        const rel = p.perB / maxPerB;
        const color = tierColor(feeTierIndex(p.perB, tiers));
        const rad = Math.max(0.9, (1 + rel * 2.4) * (0.7 + 0.3 * ((pr.z + 1) / 2)));
        return (
          <circle key={p.id} cx={pr.x} cy={pr.y} r={rad} fill={color} opacity={opacity}
            style={rel > 0.6 || pr.z > 0.5 ? { filter: `drop-shadow(0 0 ${(3 + rel * 4).toFixed(1)}px ${color})` } : undefined} />
        );
      })}
      {/* decorative arcs between real tx points */}
      {arcs.map((arc, i) => {
        const a = project(arc.a.lat, arc.a.lon), b = project(arc.b.lat, arc.b.lon);
        const progress = (tick * (0.006 + arc.u * 0.01) + arc.u) % 1;
        return <path key={i} d={`M ${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${(a.y + b.y) / 2 - 56} ${b.x} ${b.y}`} fill="none" stroke="url(#con-arc)" strokeWidth="1" opacity="0.55" strokeDasharray="56 230" strokeDashoffset={-progress * 286} />;
      })}
      {/* reticle */}
      <g stroke="var(--tk-accent)" fill="none" strokeWidth="0.5" opacity="0.5">
        <line x1={cx - r - 20} y1={cy} x2={cx - r - 5} y2={cy} /><line x1={cx + r + 5} y1={cy} x2={cx + r + 20} y2={cy} />
        <line x1={cx} y1={cy - r - 20} x2={cx} y2={cy - r - 5} /><line x1={cx} y1={cy + r + 5} x2={cx} y2={cy + r + 20} />
        <circle cx={cx} cy={cy} r={r + 7} strokeDasharray="2 8" />
      </g>
      <text x={cx} y="22" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="10" fill="var(--tk-accent)" letterSpacing="0.18em" style={{ filter: "drop-shadow(0 0 4px var(--tk-accent))" }}>
        {ready ? `MEMPOOL · ${txs.length} TX · LIVE` : "MEMPOOL · AWAITING FEED"}
      </text>
      <text x={cx} y={size - 8} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="8.5" fill="var(--ink-40)" letterSpacing="0.14em">POSITIONS HASH-DERIVED · SUBJECTS LIVE FROM NODE</text>
    </svg>
  );
}

/* ── newest mempool tx card ─────────────────────────────────── */
function ConNewestTx({ data }: { data: MoneroLive }) {
  const tx = data.ready && data.mempool.length ? newestFirst(data.mempool)[0] : null;
  const tierIdx = tx ? feeTierIndex(tx.perB, data.feeTiers) : -1;
  return (
    <ConCard title="Newest tx · mempool" right={tx ? <><span className="led pulse" style={{ background: "var(--g-50)", boxShadow: "0 0 4px var(--g-50)" }} /> from node</> : <span className="dim">from node</span>}>
      {tx ? (
        <>
          <div className="mono" style={{ fontSize: 12, color: "var(--c-50)", marginBottom: 10, letterSpacing: "0.04em" }}>{shortHash(tx.id)}</div>
          <div className="kv"><span className="k">Fee</span><span className="v acc">{tx.fee.toFixed(6)} XMR</span></div>
          <div className="kv"><span className="k">Size</span><span className="v">{fmtBytes(tx.size)}</span></div>
          <div className="kv"><span className="k">Rate</span><span className="v">{Math.round(tx.perB)} pcn/B</span></div>
          <div className="kv"><span className="k">Ring</span><span className="v">{tx.ringSize}</span></div>
          <div className="kv"><span className="k">Age</span><span className="v">{tx.age}s</span></div>
          <div className="kv"><span className="k">Tier</span><span className="v" style={{ color: tierColor(tierIdx) }}>{tierIdx >= 0 ? FEE_TIER_LABELS[tierIdx] : "—"}</span></div>
        </>
      ) : (
        <div className="mono dim" style={{ fontSize: 11, padding: "18px 0", textAlign: "center" }}>awaiting mempool…</div>
      )}
    </ConCard>
  );
}

/* ── mempool polar radar · age vs fee ───────────────────────────
   One dot per real tx (cap 60). Bearing is hash-derived from the txid,
   radius is real age (newest at center), color is the real fee tier. */
export function ConMempoolRadar({ data }: { data: MoneroLive }) {
  const W = 220, c = W / 2, R = c - 14;
  const txs = data.ready ? data.mempool.slice(0, 60) : [];
  const maxAge = Math.max(1, ...txs.map((t) => t.age));
  return (
    <ConCard title="Mempool polar · age vs fee" right={<span className="dim">{txs.length ? `${txs.length} tx` : "—"}</span>}>
      <svg viewBox={`0 0 ${W} ${W}`} width="100%" style={{ display: "block", maxWidth: 220, margin: "0 auto" }}>
        {[0.33, 0.66, 1].map((f, i) => <circle key={i} cx={c} cy={c} r={R * f} fill="none" stroke="rgba(255,122,26,0.14)" strokeWidth="1" strokeDasharray={i === 2 ? "none" : "2 5"} />)}
        {txs.length ? [0.33, 0.66, 1].map((f, i) => (
          <text key={i} x={c + 3} y={c - R * f + 9} fontFamily="var(--f-mono)" fontSize="7" fill="var(--ink-40)">{Math.round(maxAge * f)}s</text>
        )) : null}
        {txs.map((t) => {
          const ang = hashToUnit(t.id) * Math.PI * 2;
          const rad = Math.min(R, (t.age / maxAge) * R);
          const x = c + Math.cos(ang) * rad, y = c + Math.sin(ang) * rad;
          const color = tierColor(feeTierIndex(t.perB, data.feeTiers));
          return (
            <g key={t.id}>
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

/* ── live feed-event log ────────────────────────────────────────
   Rows come straight from useFeedEvents: new blocks, newly-seen txs,
   txs leaving the pool, stale/recover edges. Nothing synthesized. */
const LOG_TONE: Record<FeedEvent["kind"], string> = {
  block: "var(--tk-accent)",
  tx: "var(--g-50)",
  txdrop: "var(--c-50)",
  stale: "var(--r-50)",
  recover: "var(--g-50)",
};

function logRow(e: FeedEvent): { key: string; ev: string; msg: string; meta: string } {
  switch (e.kind) {
    case "block": return { key: `b-${e.hash}`, ev: "BLOCK", msg: `#${e.height} · ${e.txs} tx · ${e.sizeKB.toFixed(1)} KB`, meta: `${e.reward.toFixed(3)} XMR` };
    case "tx": return { key: `t-${e.id}`, ev: "TX-RECV", msg: `${e.id.slice(0, 10)}… · ${Math.round(e.perB)} pcn/B`, meta: fmtBytes(e.size) };
    case "txdrop": return { key: `d-${e.ts}`, ev: "TX-MINED", msg: `${e.count} left pool`, meta: "" };
    case "stale": return { key: `s-${e.ts}`, ev: "STALE", msg: "feed degraded · retrying", meta: "" };
    case "recover": return { key: `r-${e.ts}`, ev: "RECOVER", msg: "feed restored", meta: "" };
  }
}

function ConPropLog({ data }: { data: MoneroLive }) {
  const events = useFeedEvents(data, 11);
  return (
    <ConCard title="Feed log · tail" right={<><span className="led pulse" style={{ background: "var(--g-50)", boxShadow: "0 0 4px var(--g-50)" }} /> −f</>}>
      <div style={{ fontFamily: "var(--f-mono)", fontSize: 10.5, lineHeight: 1.55 }}>
        {events.length ? events.map((e) => {
          const row = logRow(e);
          return (
            <div key={row.key} style={{ display: "grid", gridTemplateColumns: "104px 120px 1fr 96px", gap: 8, padding: "2px 0", borderBottom: "1px dashed rgba(255,255,255,0.04)", animation: "con-slidein 0.4s ease" }}>
              <span className="dim2">{new Date(e.ts).toISOString().slice(11, 23)}</span>
              <span style={{ color: LOG_TONE[e.kind] }}>{row.ev}</span>
              <span className="dim" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.msg}</span>
              <span className="dim2" style={{ textAlign: "right" }}>{row.meta}</span>
            </div>
          );
        }) : (
          <div className="dim2" style={{ padding: "6px 0" }}>awaiting feed events…</div>
        )}
      </div>
      <style>{`@keyframes con-slidein { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: none; } }`}</style>
    </ConCard>
  );
}

/* ── fee-tier distribution bars ─────────────────────────────────
   Counts of real mempool txs per node fee tier (slow → fastest). */
function ConFeeTierBars({ data }: { data: MoneroLive }) {
  const ok = data.ready && data.feeTiers.length === 4;
  const counts = [0, 0, 0, 0];
  if (ok) for (const t of data.mempool) { const i = feeTierIndex(t.perB, data.feeTiers); if (i >= 0) counts[i]++; }
  const max = Math.max(1, ...counts);
  return (
    <ConCard title="Fee tiers · mempool distribution" right={<span className="acc">{ok ? `${data.mempool.length} tx` : "—"}</span>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {FEE_TIER_LABELS.map((label, i) => (
          <div key={label} style={{ display: "grid", gridTemplateColumns: "56px 1fr 90px 38px", gap: 8, alignItems: "center", fontFamily: "var(--f-mono)", fontSize: 10 }}>
            <span className="dim2">{label}</span>
            <span className="dim" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ok ? `${data.feeTiers[i].toLocaleString()} pcn/B` : "—"}</span>
            <div style={{ height: 7, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: ok ? `${(counts[i] / max) * 100}%` : "0%", background: TIER_COLORS[i], boxShadow: ok ? `0 0 6px ${TIER_COLORS[i]}` : "none", borderRadius: 3, transition: "width 0.8s ease" }} />
            </div>
            <span style={{ textAlign: "right", color: ok ? "var(--ink-100)" : "var(--ink-40)" }}>{ok ? counts[i] : "—"}</span>
          </div>
        ))}
      </div>
    </ConCard>
  );
}

/* ── mempool bytes-by-fee-tier donut ────────────────────────── */
function ConFeeBytesDonut({ data }: { data: MoneroLive }) {
  const cx = 70, cy = 70, r = 52, sw = 16, circ = 2 * Math.PI * r;
  const ok = data.ready && data.feeTiers.length === 4 && data.mempool.length > 0;
  const bytes = [0, 0, 0, 0];
  let totalBytes = 0;
  if (ok) for (const t of data.mempool) { const i = feeTierIndex(t.perB, data.feeTiers); if (i >= 0) { bytes[i] += t.size; totalBytes += t.size; } }
  const med = data.ready ? medianPerB(data.mempool) : null;
  let acc = 0;
  return (
    <ConCard title="Mempool · bytes by fee tier" right={<span className="acc">{ok ? fmtBytes(totalBytes) : "—"}</span>}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <svg viewBox="0 0 140 140" width="124" height="124">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={sw} />
          {ok && totalBytes > 0 ? FEE_TIER_LABELS.map((label, i) => {
            const len = (bytes[i] / totalBytes) * circ;
            const el = <circle key={label} cx={cx} cy={cy} r={r} fill="none" stroke={TIER_COLORS[i]} strokeWidth={sw} strokeDasharray={len + " " + (circ - len)} strokeDashoffset={-acc} transform={`rotate(-90 ${cx} ${cy})`} style={{ filter: `drop-shadow(0 0 4px ${TIER_COLORS[i]})` }} />;
            acc += len; return el;
          }) : null}
          <text x={cx} y={cy - 2} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="16" fontWeight="500" fill="var(--tk-accent)">{data.ready ? data.mempool.length : "—"}</text>
          <text x={cx} y={cy + 12} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="7.5" fill="var(--ink-40)" letterSpacing="0.12em">TX IN POOL</text>
        </svg>
        <div style={{ flex: 1 }}>
          {FEE_TIER_LABELS.map((label, i) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--f-mono)", fontSize: 10.5, padding: "3px 0" }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: TIER_COLORS[i], boxShadow: `0 0 4px ${TIER_COLORS[i]}` }} />
              <span className="dim" style={{ flex: 1 }}>{label}</span>
              <span className="acc">{ok && totalBytes > 0 ? `${((bytes[i] / totalBytes) * 100).toFixed(1)}%` : "—"}</span>
            </div>
          ))}
          <div className="kv" style={{ marginTop: 6 }}><span className="k">Median rate</span><span className="v">{med != null ? `${Math.round(med)} pcn/B` : "—"}</span></div>
          <div className="kv"><span className="k">Pool bytes</span><span className="v">{ok ? fmtBytes(totalBytes) : "—"}</span></div>
        </div>
      </div>
    </ConCard>
  );
}

/* ── block stream strip ─────────────────────────────────────── */
export function ConBlockStream({ data }: { data: MoneroLive }) {
  return (
    <ConCard title="Block stream" right={<span className="acc">{data.ready ? `tip #${data.height.toLocaleString()}` : "—"}</span>}>
      <div style={{ display: "flex", gap: 4, height: 96, alignItems: "flex-end" }}>
        {data.blocks.slice(0, 10).map((b) => (
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
  const ready = data.ready;
  const poolBytes = data.mempool.reduce((s, t) => s + t.size, 0);
  const med = medianPerB(data.mempool);
  const minAge = data.mempool.length ? Math.min(...data.mempool.map((t) => t.age)) : null;
  return (
    <div style={{ padding: "16px 20px 40px", display: "flex", flexDirection: "column", gap: 14 }}>
      <section style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 14, alignItems: "start" }}>
        <ConCard title="Mempool constellation · live" right={<span className="dim">positions hash-derived</span>} style={{ display: "flex", flexDirection: "column" }}>
          <ConSphere txs={data.mempool} tiers={data.feeTiers} ready={ready} size={460} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginTop: 8 }}>
            <Stat k="MEMPOOL" v={ready ? String(data.mempool.length) : "—"} sub="txs" tone="acc" />
            <Stat k="BYTES" v={ready ? fmtBytes(poolBytes) : "—"} sub="pool" />
            <Stat k="MEDIAN" v={ready && med != null ? String(Math.round(med)) : "—"} sub="pcn/B" />
            <Stat k="NEWEST" v={ready && minAge != null ? `${minAge}s` : "—"} sub="age" />
            <Stat k="BLOCK" v={ready ? `#${data.height.toLocaleString()}` : "—"} sub="tip" />
            <Stat k="TARGET" v={ready ? fmtTargetSec(data.blockTarget) : "—"} sub="block time" />
          </div>
        </ConCard>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <ConNewestTx data={data} />
          <ConMempoolRadar data={data} />
        </div>
      </section>

      <ConPropLog data={data} />

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        <ConFeeTierBars data={data} />
        <ConFeeBytesDonut data={data} />
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
          <span className="led pulse" /> Rotating mesh · {Math.min(60, data.mempool.length)} mempool txs · live
        </span>
      </div>
      {tracking ? (
        <MempoolTrackingDetail tracking={tracking} data={data} onBack={clearTracking} onPickTx={(id, h) => onSearch({ kind: "tx", id, blockHeight: h })} />
      ) : (
        <ConOverview data={data} />
      )}
    </div>
  );
}
