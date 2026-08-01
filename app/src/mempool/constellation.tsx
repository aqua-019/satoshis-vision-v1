// AUTO-PORTED from constellation.jsx
// Run `npm run port` to refresh. Manual fixups land in MIGRATION.md.
import * as React from "react";
import { useAnimationSeconds } from "@/design/useAnimationClock";
import { useReducedMotion } from "@/design/useReducedMotion";
import { Provenance } from "@/design/primitives";
import { MemViewShell, TrackChip, useMempoolTracking, type Tracking, MemTxTable} from "@/mempool/mempool-shared";
import { useMemStats } from "@/mempool/mem-stats";
import { CONF_UNLOCK, confOf, RIBBON_BLOCKS } from "@/mempool/conf";
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

/** Newest = smallest age (seconds since arrival). */
const newestFirst = (txs: Tx[]): Tx[] => [...txs].sort((a, b) => a.age - b.age);

export function ConCard({ title, right, children, pad = "14px 16px", style }: any) {
  return (
    <div style={{ background: "var(--surface-raised)", border: "1px solid var(--rule)", borderRadius: 8, padding: pad, position: "relative", ...style }}>
      {(title || right) ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 12 }}>
          <span className="mono" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-40)" }}>{title}</span>
          <span className="mono" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-40)", display: "flex", alignItems: "center", gap: 6 }}>{right}</span>
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
export function ConSphere({ txs, tiers, ready, trackedTxId, size = 460 }: { txs: Tx[]; tiers: number[]; ready: boolean; trackedTxId?: string | null; size?: number }) {
  const reduced = useReducedMotion();
  // v6.0.8: was `useTick(50)` — its own setInterval, reconciling up to 60
  // <circle>s plus arc paths through React 20×/second, forever, including in
  // a hidden tab. Now ONE shared rAF (design/useAnimationClock.ts), throttled
  // to 20fps on `high` / 12 on `mid` / 6 on `low`, and paused when hidden.
  //
  // Seconds, not the frame counter: the old `tick * 0.008` meant "0.008 rad
  // per FRAME", which silently becomes a 3× slower sphere at 6fps. The rates
  // below are per second, so the sphere turns at the same speed everywhere
  // and only its smoothness varies. Frozen under reduced motion, matching the
  // <animate> elements further down that are already gated on `reduced`.
  const t = useAnimationSeconds({ fps: 20, enabled: !reduced });
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

  // The tracked tx, positioned the same hash-derived way as every other
  // point — so it sits where it "really" would even when it falls outside
  // the newest-60 sample above. One named star among anonymous ones.
  const trackedPoint = React.useMemo(() => {
    if (!trackedTxId) return null;
    const t = txs.find((x) => x.id === trackedTxId);
    if (!t) return null;
    return {
      id: t.id,
      lat: (hashToUnit(t.id) - 0.5) * 160 * (Math.PI / 180),
      lon: (hashToUnit(t.id + "·") * 360 - 180) * (Math.PI / 180),
      perB: t.perB,
    };
  }, [txs, trackedTxId]);

  // Decorative arcs between pairs of REAL tx points; partners picked by txid hash.
  const arcs = React.useMemo(() => {
    if (pts.length < 2) return [];
    return pts.slice(0, Math.min(18, Math.floor(pts.length / 2))).map((p, i) => {
      let j = (i + 1 + Math.floor(hashToUnit(p.id + "→") * (pts.length - 1))) % pts.length;
      if (j === i) j = (i + 1) % pts.length;
      return { a: p, b: pts[j], u: hashToUnit(p.id + "⇄") };
    });
  }, [pts]);

  // 0.008 rad/frame at the old 20fps == 0.16 rad/s.
  const rot = (t * 0.16) % (Math.PI * 2);
  const project = (lat: number, lon: number) => {
    const lonR = lon + rot;
    return { x: cx + Math.cos(lat) * Math.sin(lonR) * r, y: cy - Math.sin(lat) * r, z: Math.cos(lat) * Math.cos(lonR) };
  };
  const trackedProj = trackedPoint ? project(trackedPoint.lat, trackedPoint.lon) : null;

  return (
    <svg width="100%" viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
      <defs>
        <radialGradient id="con-sph" cx="40%" cy="35%"><stop offset="0%" stopColor="var(--accent-structural)" stopOpacity="0.18" /><stop offset="55%" stopColor="var(--accent-structural)" stopOpacity="0.06" /><stop offset="100%" stopColor="var(--bg-0)" stopOpacity="0.7" /></radialGradient>
        <radialGradient id="con-atmo"><stop offset="60%" stopColor="var(--accent-structural)" stopOpacity="0" /><stop offset="100%" stopColor="var(--accent-structural)" stopOpacity="0.32" /></radialGradient>
        <linearGradient id="con-arc" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="var(--accent-structural)" stopOpacity="0" /><stop offset="50%" stopColor="var(--accent-structural)" stopOpacity="1" /><stop offset="100%" stopColor="var(--accent-structural)" stopOpacity="0" /></linearGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r + 14} fill="url(#con-atmo)" opacity="0.7" />
      <circle cx={cx} cy={cy} r={r} fill="url(#con-sph)" stroke="var(--accent-structural)" strokeOpacity={0.25} strokeWidth="0.5" />
      {/* parallels */}
      {[-Math.PI / 3, -Math.PI / 6, 0, Math.PI / 6, Math.PI / 3].map((lat, i) => (
        <ellipse key={i} cx={cx} cy={cy - Math.sin(lat) * r} rx={r * Math.cos(lat)} ry={Math.max(2, r * Math.cos(lat) * 0.06)} fill="none" stroke="var(--accent-structural)" strokeOpacity={0.12} strokeWidth="0.5" strokeDasharray="2 4" />
      ))}
      {/* meridians */}
      {[0, 30, 60, 90, 120, 150].map((deg, i) => (
        <ellipse key={i} cx={cx} cy={cy} rx={Math.max(1, Math.abs(Math.sin((deg + rot * 180 / Math.PI) * Math.PI / 180)) * r)} ry={r} fill="none" stroke="var(--accent-structural)" strokeOpacity={0.09} strokeWidth="0.5" />
      ))}
      {/* real mempool txs — dimmed slightly while a star is tracked, so it reads */}
      {pts.map((p) => {
        const pr = project(p.lat, p.lon);
        if (pr.z < -0.1) return null;
        const rel = p.perB / maxPerB;
        const color = tierColor(feeTierIndex(p.perB, tiers));
        const rad = Math.max(0.9, (1 + rel * 2.4) * (0.7 + 0.3 * ((pr.z + 1) / 2)));
        const opacity = Math.max(0.15, (pr.z + 1) / 2) * (trackedPoint && p.id !== trackedPoint.id ? 0.5 : 1);
        return (
          <circle key={p.id} cx={pr.x} cy={pr.y} r={rad} fill={color} opacity={opacity}
            style={rel > 0.6 || pr.z > 0.5 ? { filter: `drop-shadow(0 0 ${(3 + rel * 4).toFixed(1)}px ${color})` } : undefined} />
        );
      })}
      {/* decorative arcs between real tx points */}
      {arcs.map((arc, i) => {
        const a = project(arc.a.lat, arc.a.lon), b = project(arc.b.lat, arc.b.lon);
        // per-frame (0.006 + u*0.01) at 20fps == per-second (0.12 + u*0.2).
        const progress = (t * (0.12 + arc.u * 0.2) + arc.u) % 1;
        return <path key={i} d={`M ${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${(a.y + b.y) / 2 - 56} ${b.x} ${b.y}`} fill="none" stroke="url(#con-arc)" strokeWidth="1" opacity="0.55" strokeDasharray="56 230" strokeDashoffset={-progress * 286} />;
      })}
      {/* tracked star — ~2.5× radius, a pulsing ring, a leader line to its
          short-hash label at the sphere edge. One named star among
          anonymous ones. */}
      {trackedPoint && trackedProj ? (() => {
        const rel = trackedPoint.perB / maxPerB;
        const color = tierColor(feeTierIndex(trackedPoint.perB, tiers));
        const rad = Math.max(2.2, (1 + rel * 2.4) * (0.7 + 0.3 * ((trackedProj.z + 1) / 2)) * 2.5);
        const front = trackedProj.z >= -0.1;
        const ang = Math.atan2(trackedProj.y - cy, trackedProj.x - cx);
        const ex = cx + Math.cos(ang) * (r + 10), ey = cy + Math.sin(ang) * (r + 10);
        const lx = cx + Math.cos(ang) * (r + 24), ly = cy + Math.sin(ang) * (r + 24);
        return (
          <g data-tracked-tx={trackedPoint.id} opacity={front ? 1 : 0.3}>
            <line x1={trackedProj.x} y1={trackedProj.y} x2={ex} y2={ey} stroke="var(--y-50)" strokeWidth="0.75" strokeDasharray="2 3" opacity="0.8" />
            <circle cx={trackedProj.x} cy={trackedProj.y} r={rad + 5} fill="none" stroke="var(--y-50)" strokeWidth="1.4">
              {!reduced ? <animate attributeName="r" values={`${rad + 3};${rad + 11};${rad + 3}`} dur="1.8s" repeatCount="indefinite" /> : null}
              {!reduced ? <animate attributeName="opacity" values="0.85;0.3;0.85" dur="1.8s" repeatCount="indefinite" /> : null}
            </circle>
            <circle cx={trackedProj.x} cy={trackedProj.y} r={rad} fill={color} style={{ filter: `drop-shadow(0 0 ${6 + rel * 6}px var(--y-50))` }} />
            <text x={lx} y={ly} textAnchor={Math.cos(ang) >= 0 ? "start" : "end"} dominantBaseline="middle"
              fontFamily="var(--f-mono)" fontSize="9" fill="var(--y-50)" style={{ filter: "drop-shadow(0 0 3px var(--y-50))" }}>
              {shortHash(trackedPoint.id)}
            </text>
          </g>
        );
      })() : null}
      {/* reticle */}
      <g stroke="var(--tk-accent)" fill="none" strokeWidth="0.5" opacity="0.5">
        <line x1={cx - r - 20} y1={cy} x2={cx - r - 5} y2={cy} /><line x1={cx + r + 5} y1={cy} x2={cx + r + 20} y2={cy} />
        <line x1={cx} y1={cy - r - 20} x2={cx} y2={cy - r - 5} /><line x1={cx} y1={cy + r + 5} x2={cx} y2={cy + r + 20} />
        <circle cx={cx} cy={cy} r={r + 7} strokeDasharray="2 8" />
      </g>
      <text x={cx} y="22" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="10" fill="var(--tk-accent)" letterSpacing="0.18em" style={{ filter: "drop-shadow(0 0 4px var(--tk-accent))" }}>
        {ready ? `MEMPOOL · ${txs.length} TX · LIVE` : "MEMPOOL · AWAITING FEED"}
      </text>
    </svg>
  );
}

/* ── newest mempool tx card ─────────────────────────────────── */
function ConNewestTx({ data }: { data: MoneroLive }) {
  const tx = data.ready && data.mempool.length ? newestFirst(data.mempool)[0] : null;
  const tierIdx = tx ? feeTierIndex(tx.perB, data.feeTiers) : -1;
  return (
    <ConCard title="Newest tx · mempool" right={<Provenance source="node" fresh={tx ? "live" : "none"} />}>
      {tx ? (
        <>
          <div className="mono" style={{ fontSize: "var(--fs-mono)", color: "var(--c-50)", marginBottom: 10, letterSpacing: "0.04em" }}>{shortHash(tx.id)}</div>
          <div className="kv"><span className="k">Fee</span><span className="v acc">{tx.fee.toFixed(6)} XMR</span></div>
          <div className="kv"><span className="k">Size</span><span className="v">{fmtBytes(tx.size)}</span></div>
          <div className="kv"><span className="k">Rate</span><span className="v">{Math.round(tx.perB)} pcn/B</span></div>
          <div className="kv"><span className="k">Ring</span><span className="v">{tx.ringSize}</span></div>
          <div className="kv"><span className="k">Age</span><span className="v">{tx.age}s</span></div>
          <div className="kv"><span className="k">Tier</span><span className="v" style={{ color: tierColor(tierIdx) }}>{tierIdx >= 0 ? FEE_TIER_LABELS[tierIdx] : "—"}</span></div>
        </>
      ) : (
        <div className="mono dim" style={{ fontSize: "var(--fs-mono)", padding: "18px 0", textAlign: "center" }}>awaiting mempool…</div>
      )}
    </ConCard>
  );
}

/* ── mempool polar radar · age vs fee ───────────────────────────
   One dot per real tx (cap 60). Bearing is hash-derived from the txid,
   radius is real age (newest at center), color is the real fee tier. */
export function ConMempoolRadar({ data, trackedTxId }: { data: MoneroLive; trackedTxId?: string | null }) {
  const W = 220, c = W / 2, R = c - 14;
  const base = data.ready ? data.mempool.slice(0, 60) : [];
  // The tracked tx keeps its bearing/dot even if it fell outside the base-60
  // sample — same "always show what's tracked" rule as the sphere above.
  const trackedTx = trackedTxId ? data.mempool.find((t) => t.id === trackedTxId) : null;
  const txs = trackedTx && !base.some((t) => t.id === trackedTx.id) ? [...base, trackedTx] : base;
  const maxAge = Math.max(1, ...txs.map((t) => t.age));
  return (
    <ConCard title="Mempool polar · age vs fee" right={<span className="dim">{txs.length ? `${txs.length} tx` : "—"}</span>}>
      <svg viewBox={`0 0 ${W} ${W}`} width="100%" style={{ display: "block", maxWidth: 220, margin: "0 auto" }}>
        {[0.33, 0.66, 1].map((f, i) => <circle key={i} cx={c} cy={c} r={R * f} fill="none" stroke="var(--accent-structural)" strokeOpacity={0.14} strokeWidth="1" strokeDasharray={i === 2 ? "none" : "2 5"} />)}
        {txs.length ? [0.33, 0.66, 1].map((f, i) => (
          <text key={i} x={c + 3} y={c - R * f + 9} fontFamily="var(--f-mono)" fontSize="7" fill="var(--ink-40)">{Math.round(maxAge * f)}s</text>
        )) : null}
        {txs.map((t) => {
          const isTracked = trackedTxId != null && t.id === trackedTxId;
          const ang = hashToUnit(t.id) * Math.PI * 2;
          const rad = Math.min(R, (t.age / maxAge) * R);
          const x = c + Math.cos(ang) * rad, y = c + Math.sin(ang) * rad;
          const color = isTracked ? "var(--y-50)" : tierColor(feeTierIndex(t.perB, data.feeTiers));
          return (
            <g key={t.id} data-tracked-tx={isTracked ? t.id : undefined}>
              <line x1={c} y1={c} x2={c + Math.cos(ang) * R} y2={c + Math.sin(ang) * R} stroke={isTracked ? "var(--y-50)" : "var(--line-d)"} strokeWidth={isTracked ? 1.2 : 0.5} opacity={isTracked ? 0.9 : undefined} />
              <circle cx={x} cy={y} r={isTracked ? 4 : 3} fill={color} style={{ filter: `drop-shadow(0 0 ${isTracked ? 6 : 4}px ${color})` }} />
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

/** Pinned tracking summary for the log — derived from the same confOf/CONF_UNLOCK
 *  the ribbon arrow and TrackChip use, so it can never disagree with them. */
function pinnedTrackRow(tracking: Tracking, data: MoneroLive): { txid?: string; height?: number; msg: string; meta: string } | null {
  if (!tracking) return null;
  if (tracking.kind === "tx") {
    const pending = tracking.blockHeight == null;
    const conf = confOf(tracking.blockHeight, data);
    const state = pending ? "in mempool" : conf >= CONF_UNLOCK ? "confirmed · unlocked" : `${conf}/${CONF_UNLOCK} conf`;
    return {
      txid: tracking.id,
      height: tracking.blockHeight ?? undefined,
      msg: `${shortHash(tracking.id)} · ${state}`,
      meta: tracking.blockHeight != null ? `#${tracking.blockHeight}` : "",
    };
  }
  const conf = confOf(tracking.height, data);
  const state = conf >= CONF_UNLOCK ? "confirmed · unlocked" : `${conf}/${CONF_UNLOCK} conf`;
  return { height: tracking.height, msg: `block #${tracking.height.toLocaleString()} · ${state}`, meta: "" };
}

function ConPropLog({ data, tracking }: { data: MoneroLive; tracking: Tracking }) {
  const events = useFeedEvents(data, 11);
  const pinned = pinnedTrackRow(tracking, data);
  return (
    <ConCard title="Feed log · tail" right={<><span className="led pulse" style={{ background: "var(--g-50)", boxShadow: "0 0 4px var(--g-50)" }} /> −f</>}>
      <div style={{ fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)", lineHeight: 1.55 }}>
        {pinned ? (
          <div data-tracked-tx={pinned.txid} data-tracked-block={pinned.height}
            style={{ display: "grid", gridTemplateColumns: "104px 120px 1fr 96px", gap: 8, padding: "2px 0", borderBottom: "1px solid var(--y-50)" }}>
            <span className="dim2">pinned</span>
            <span style={{ color: "var(--y-50)" }}>TRACK</span>
            <span style={{ color: "var(--y-50)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pinned.msg}</span>
            <span className="dim2" style={{ textAlign: "right" }}>{pinned.meta}</span>
          </div>
        ) : null}
        {events.length ? events.map((e) => {
          const row = logRow(e);
          return (
            <div key={row.key} style={{ display: "grid", gridTemplateColumns: "104px 120px 1fr 96px", gap: 8, padding: "2px 0", borderBottom: "1px dashed var(--line-d)", animation: "con-slidein 0.4s ease" }}>
              <span className="dim2">{new Date(e.ts).toISOString().slice(11, 23)}</span>
              <span style={{ color: LOG_TONE[e.kind] }}>{row.ev}</span>
              <span className="dim" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.msg}</span>
              <span className="dim2" style={{ textAlign: "right" }}>{row.meta}</span>
            </div>
          );
        }) : (!pinned ? (
          <div className="dim2" style={{ padding: "6px 0" }}>awaiting feed events…</div>
        ) : null)}
      </div>
      <style>{`@keyframes con-slidein { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: none; } }`}</style>
    </ConCard>
  );
}

/* ── fee-tier distribution bars ─────────────────────────────────
   Counts of real mempool txs per node fee tier (slow → fastest).
   D0651: the bar's `width 0.8s ease` transition is left literal, not
   mapped to --d-4 (500ms) — at 300ms past the top of the --d-* scale
   it's a materially slower, deliberately readable "distribution
   shifted" reveal, not interaction chrome; forcing it onto --d-4 would
   be a real, noticeable speed-up disguised as a token count going down. */
function ConFeeTierBars({ data }: { data: MoneroLive }) {
  const ok = data.ready && data.feeTiers.length === 4;
  const counts = [0, 0, 0, 0];
  if (ok) for (const t of data.mempool) { const i = feeTierIndex(t.perB, data.feeTiers); if (i >= 0) counts[i]++; }
  const max = Math.max(1, ...counts);
  return (
    <ConCard title="Fee tiers · mempool distribution" right={<span className="acc">{ok ? `${data.mempool.length} tx` : "—"}</span>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {FEE_TIER_LABELS.map((label, i) => (
          <div key={label} style={{ display: "grid", gridTemplateColumns: "56px 1fr 90px 38px", gap: 8, alignItems: "center", fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)" }}>
            <span className="dim2">{label}</span>
            <span className="dim" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ok ? `${data.feeTiers[i].toLocaleString()} pcn/B` : "—"}</span>
            <div style={{ height: 7, background: "var(--line)", borderRadius: 3, overflow: "hidden" }}>
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
  // Shared median derivation (mem-stats.tsx) — was a local duplicate here.
  const stats = useMemStats(data);
  let acc = 0;
  return (
    <ConCard title="Mempool · bytes by fee tier" right={<span className="acc">{ok ? fmtBytes(totalBytes) : "—"}</span>}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <svg viewBox="0 0 140 140" width="100%" style={{ display: "block", maxWidth: 124 }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--line)" strokeWidth={sw} />
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
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)", padding: "3px 0" }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: TIER_COLORS[i], boxShadow: `0 0 4px ${TIER_COLORS[i]}` }} />
              <span className="dim" style={{ flex: 1 }}>{label}</span>
              <span className="acc">{ok && totalBytes > 0 ? `${((bytes[i] / totalBytes) * 100).toFixed(1)}%` : "—"}</span>
            </div>
          ))}
          <div className="kv" style={{ marginTop: 6 }}><span className="k">Median rate</span><span className="v">{ok ? `${Math.round(stats.medianPerB)} pcn/B` : "—"}</span></div>
          <div className="kv"><span className="k">Pool bytes</span><span className="v">{ok ? fmtBytes(totalBytes) : "—"}</span></div>
        </div>
      </div>
    </ConCard>
  );
}

/* ── block stream strip ─────────────────────────────────────── */
export function ConBlockStream({ data, tracking, trackedHeight }: { data: MoneroLive; tracking: Tracking; trackedHeight: number | null }) {
  return (
    <ConCard title="Block stream" right={<span className="acc">{data.ready ? `tip #${data.height.toLocaleString()}` : "—"}</span>}>
      <div style={{ display: "flex", gap: 4, height: 96, alignItems: "flex-end" }}>
        {data.blocks.slice(0, RIBBON_BLOCKS).map((b) => {
          const isTracked = trackedHeight != null && b.height === trackedHeight;
          return (
            <div className="mblock" key={b.height}
              data-tracked-block={isTracked ? b.height : undefined}
              data-tracked-tx={isTracked && tracking?.kind === "tx" ? tracking.id : undefined}
              style={{
                width: 42, height: 58 + Math.min(34, (b.txs / 140) * 34),
                outline: isTracked ? "2px solid var(--y-50)" : undefined,
                outlineOffset: isTracked ? 1 : undefined,
                boxShadow: isTracked ? "0 0 14px var(--y-50)" : undefined,
              }}>
              <div className="hh" style={{ fontSize: "var(--fs-label)" }}>{b.conf}c</div>
              <div className="nm" style={{ fontSize: "var(--fs-mono)" }}>{b.txs}</div>
              {isTracked ? <div className="mono" style={{ fontSize: "var(--fs-label)", color: "var(--y-50)", marginTop: 2 }}>▲ TRACK</div> : null}
            </div>
          );
        })}
      </div>
      {trackedHeight != null && tracking ? (
        <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
          <TrackChip tracking={tracking} data={data} />
        </div>
      ) : null}
    </ConCard>
  );
}

export function ConOverview({ data, tracking }: { data: MoneroLive; tracking: Tracking }) {
  const ready = data.ready;
  // tx-derived only (never a bare block search) — mirrors reactor.tsx /
  // classic.tsx's trackedHeight so the star/radar/stream/log can never
  // disagree with the ribbon arrow or TrackChip on any other view.
  const trackedTxId = tracking?.kind === "tx" ? tracking.id : null;
  const trackedHeight = tracking?.kind === "tx" ? (tracking.blockHeight ?? null) : null;
  return (
    <div style={{ padding: "16px 20px 40px", display: "flex", flexDirection: "column", gap: 14 }}>
      <section style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 14, alignItems: "start" }}>
        <ConCard title="Mempool constellation" right={<Provenance source="node" also="session" fresh="live" detail="positions hash-derived" />} style={{ display: "flex", flexDirection: "column" }}>
          <ConSphere txs={data.mempool} tiers={data.feeTiers} ready={ready} trackedTxId={trackedTxId} size={460} />
        </ConCard>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <ConNewestTx data={data} />
          <ConMempoolRadar data={data} trackedTxId={trackedTxId} />
        </div>
      </section>

      <ConPropLog data={data} tracking={tracking} />

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        <ConFeeTierBars data={data} />
        <ConFeeBytesDonut data={data} />
        <ConBlockStream data={data} tracking={tracking} trackedHeight={trackedHeight} />
      </section>
    </div>
  );
}

export function ConstellationView({ data }: ViewProps) {
  const { tracking, onSearch, clearTracking } = useMempoolTracking(data);
  // MemViewShell keeps the sphere/radar/stream mounted while a tx is tracked
  // — the tracked star, its radar dot, and the block-stream highlight above
  // stay visible alongside the shared detail panel it renders below,
  // generalising reactor.tsx / classic.tsx's own hand-rolled version of this
  // same pattern.
  return (
    <div className="main" style={{ overflow: "auto", padding: 0 }}>
      <MemViewShell id="constellation" table={<MemTxTable data={data} tracking={tracking} viewId="constellation" columns={["txid", "perB", "tier", "size", "age"]} onPickTx={(id) => onSearch({ kind: "tx", id })} />} data={data} tracking={tracking} onSearch={onSearch} onClearTracking={clearTracking}>
        <ConOverview data={data} tracking={tracking} />
      </MemViewShell>
    </div>
  );
}
