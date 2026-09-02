// constellation.tsx — CONSTELLATION v2 · hi-fi live mempool sphere
//
// The mempool as a filled, rotating sphere: every point is a REAL
// unconfirmed tx from the node. Colour is fee TIER (contract §4's mapping,
// verbatim — see CON_TIER_TOKENS below). Radius is real WEIGHT (tx.size).
// Angular position (lat/lon) is hash-derived from the txid — stable and
// honest decoration, not a data claim. Radial depth is REAL AGE: a fresh
// tx sits near the surface, a mature one migrates toward the core as it
// nears confirmation — a disclosed maturity metaphor, never a claim of
// observing Dandelion++'s actual stem/fluff relay path (a node cannot
// observe another transaction's stem; contract §6).
//
// v2 rebuild (claude/V2-VIEW-CONFORMANCE.md Rev 3):
//   • ConCard is gone. Every panel is PanelFrame, with real
//     dataKey/updatedAt via oldestFreshAt() so freshness is provenanced
//     per panel, not merely per feed. Never `lastUpdate` (the feed
//     heartbeat) and never a hardcoded "live".
//   • The sphere is a FILLED BALL, not a shell. A shell's areal density
//     projects as 1/cosθ, which DIVERGES at the rim — a shell reads as a
//     flat disc with a bright ring, the opposite of "volume". A ball's
//     density is the chord length through it, 2√(R²−ρ²): maximal at
//     centre, zero at the rim. Limb darkening falls out of the geometry
//     BY CONSTRUCTION once nodes are spread across radii (conBuildNodes'
//     rFrac, driven by real age) instead of pinned to the surface.
//     conLimbAlpha/conLimbKeep both derive from ONE exported constant,
//     LIMB_K, so a break test that flattens the curve has exactly one
//     number to mutate and both channels (dim vs. absent) move together.
//     data-con-rnorm/data-con-alpha on every node make the falloff
//     machine-checkable without restating the formula in a gate.
//   • Every node opens the shared tx inspector; every block glyph opens
//     the shared block inspector — NEW in this rebuild; nothing in the
//     prior version had a click handler anywhere outside the search bar.
//     Radar dots also open the inspector (each is one real tx); the fee-
//     tier bars and the bytes donut stay non-interactive — an aggregate
//     bar spanning many txs has no single txid it could honestly resolve
//     a click to.
//   • Fee-first truncation above MAX_SPHERE_NODES is DISCLOSED in the
//     header text (count shown / total, "ranked by fee/B"), never a
//     silent sample presented as the whole pool.
//   • Reduced motion freezes rotation — useAnimationSeconds already
//     returns exactly 0 when disabled, a legitimate still frame for a
//     rotating sphere (no "before" state to land on wrong, unlike a
//     tick-driven simulator; CLAUDE.md's v6.1.3 trap #2 does not apply
//     here) — and drops every SMIL <animate> from the tree rather than
//     merely pausing it. Critically, it ALSO drops backface culling and
//     density thinning: both are MOTION effects (a culled node rotates
//     into view later; a thinned node's neighbour didn't survive this
//     frame but might the next), and a frozen frame that kept either
//     would permanently lose both data and click targets for roughly half
//     the field. The corrected contract §6 requires the static
//     equivalent to carry the same data AND the same click targets —
//     this is the mechanism that makes that true here.
//   • Low pool (<8 tx, matching sediment's threshold): a different
//     composition, not the same field thinned down. Every real tx becomes
//     an individually labelled, always-visible, keyboard-focusable star,
//     connected to every other one — the literal "connect the dots"
//     reading the view's name promises, and the 3-tx case specifically is
//     designed to look intentional, not empty.
//
// SPACING: every value this rebuild INTRODUCED comes from --sp-1..--sp-7.
// Five off-ramp literals survive from the pre-v2 file, unchanged and in the
// same count as origin/main — two `padding: "2px 0"` log rows, one
// `padding: "3px 0"` legend row, one `marginTop: 2`, and the overview's
// `padding: "var(--sp-4) 20px 40px"`. These are inside the 108 sites v2·0
// deliberately left literal by policy (contract §5), and §5's "needs a stated
// reason" attaches to a NEW value off the ramp. They are recorded here rather
// than migrated because renumbering untouched page chrome inside a view
// rebuild is churn that no gate would catch if it were wrong.
//
// KNOWN, DOCUMENTED INCONSISTENCY: sediment.tsx (:58-64) asserts this file
// should keep a different, "urgency"-keyed ramp (c-50/g-50/y-50/r-50)
// shared with bridge/terminal/reactor. That comment predates this
// rebuild's brief, which named contract §4 explicitly, and §4's own table
// is titled "Mockup → token mapping" with the four tokens this file now
// ships. Bridge/terminal/reactor still carry the urgency ramp, so the v2
// hero views now knowingly disagree on this axis until the remaining
// rebuilds resolve it.
//
// All helpers prefixed `Con` to avoid shared-scope collisions.

import * as React from "react";
import { useAnimationSeconds } from "@/design/useAnimationClock";
import { useReducedMotion } from "@/design/useReducedMotion";
import { NodeProvenance, PanelFrame } from "@/design/primitives";
import { MemViewShell, TrackChip, useMempoolTracking, type Tracking, MemTxTable } from "@/mempool/mempool-shared";
import { useMemStats } from "@/mempool/mem-stats";
import { CONF_UNLOCK, confOf, RIBBON_BLOCKS } from "@/mempool/conf";
import type { AgedTx, MoneroLive, Tx } from "@/data/types";
import { fmtAgeS, fmtBytes, isAged, shortHash } from "@/data/types";
import { hashToUnit, FEE_TIER_LABELS, feeTierIndex } from "@/data/map";
import { useFeedEvents, type FeedEvent } from "@/data/useFeedEvents";
import { hasData, oldestFreshAt } from "@/data/feed-status";

interface ViewProps {
  data: MoneroLive;
  bg?: { intensity?: "calm" | "busy" | "chaotic"; scan?: boolean };
}

/* ── fee-tier ramp — contract §4, VERBATIM (its own table is titled
   "Mockup → token mapping"). See the file-header note above for the
   documented conflict with sediment.tsx's inline comment. */
const CON_TIER_TOKENS = ["var(--c-50)", "var(--accent-data)", "var(--o-80)", "var(--y-50)"] as const;
const CON_TIER_FALLBACK = "var(--tk-accent)";
function conTierToken(perB: number, tiers: number[]): string {
  const i = feeTierIndex(perB, tiers);
  return i >= 0 ? CON_TIER_TOKENS[i] : CON_TIER_FALLBACK;
}

/** Newest = smallest age (seconds since arrival). A tx with no reported
 *  arrival sorts last — it is not "newest", it is unknown (p4·M9a). */
const newestFirst = (txs: Tx[]): Tx[] => [...txs].sort((a, b) => (a.age ?? Infinity) - (b.age ?? Infinity));

function onEnterKey(fn: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); }
  };
}

/* ── the rim falloff — ONE function, ONE owner ────────────────────────────
   LIMB_K is exported so a gate can PARSE the real exponent out of source
   (the verify-orb "predicts rather than remembers" idiom) rather than
   restating a number here that could silently drift from what actually
   ships. `rnorm` is projected screen distance from the sphere's centre,
   normalised 0 (centre) .. 1 (rim). Both alpha (conLimbAlpha) and density
   thinning (conLimbKeep) derive from conLimbFactor, so a mutation that
   flattens this one curve moves both channels at once — a break test that
   flattens the rim has exactly one place to look, and the effect shows up
   in the data-con-rnorm/data-con-alpha attributes on every rendered node. */
export const LIMB_K = 1.8;
const LIMB_MIN_ALPHA = 0.08;
function conLimbFactor(rnorm: number): number {
  return Math.pow(Math.max(0, Math.min(1, 1 - rnorm)), LIMB_K);
}
function conLimbAlpha(rnorm: number): number {
  return LIMB_MIN_ALPHA + (1 - LIMB_MIN_ALPHA) * conLimbFactor(rnorm);
}
/** Floor on the thinning survival rate at the rim.
 *
 *  WITHOUT IT THE HERO DECIMATES ITSELF. Bare `conLimbFactor` as the keep
 *  probability drops to 0.055 at rnorm 0.8 and 0.016 at 0.9, so the outer
 *  ring rendered EMPTY: measured 35/8/0 nodes across the core/mid/rim bins,
 *  with only 43 of 190 drawn transactions visible at all. That is not limb
 *  darkening, it is amputation — and a rim with no nodes cannot express a
 *  falling density, it just stops.
 *
 *  Density still falls toward the rim, for a reason independent of this
 *  floor: the field is a filled BALL, and a ball's ORTHOGRAPHIC projection
 *  has areal density proportional to chord length, 2·sqrt(1 - rnorm²) —
 *  maximal at the centre, zero at the rim. (A spherical SHELL does the
 *  opposite: its projected density goes as 1/cos(theta) and DIVERGES at the
 *  limb, which is exactly why a shell reads as a flat disc with a bright
 *  edge.) So the geometry supplies the falloff and the thinning only needs
 *  to deepen it, not create it. */
const LIMB_KEEP_FLOOR = 0.35;

/** Deterministic, hash-derived — never Math.random(). A node's thinning
 *  "roll" is keyed on its own txid, so it is stable frame to frame instead
 *  of flickering as rnorm drifts with rotation; only whether that roll
 *  currently clears the (rnorm-dependent) bar changes. */
function conLimbKeep(id: string, rnorm: number): boolean {
  const bar = LIMB_KEEP_FLOOR + (1 - LIMB_KEEP_FLOOR) * conLimbFactor(rnorm);
  return hashToUnit(id + "‡thin") < bar;
}

/* ── field population: a ceiling, never a floor ──────────────────────────
   Fee-first truncation mirrors sediment's sedSelectField reasoning: the N
   a viewer would see "at the top" if the whole pool rendered, never a
   silent index-order slice. Truncation is DISCLOSED in the header text
   (drawn/total, "ranked by fee/B"), never presented as the whole pool. */
const MAX_SPHERE_NODES = 190;
function conSelectField(mempool: Tx[]): { drawn: AgedTx[]; truncated: boolean; total: number; unaged: number } {
  const total = mempool.length;
  // rFrac IS age (see ConNode), so a tx whose arrival no clock reported has no
  // radius to be drawn at. It is counted — the caption says how many — never
  // placed at a made-up depth (p4·M9a).
  const aged = mempool.filter(isAged);
  const unaged = total - aged.length;
  if (aged.length <= MAX_SPHERE_NODES) return { drawn: aged, truncated: false, total, unaged };
  const sorted = [...aged].sort((a, b) => b.perB - a.perB);
  return { drawn: sorted.slice(0, MAX_SPHERE_NODES), truncated: true, total, unaged };
}

/** Below this a diffuse field reads as empty space, not a population.
 *  Matches sediment's own low-pool threshold so the two hero views agree
 *  on what "low pool" means. */
const LOW_POOL_THRESHOLD = 8;

interface ConNode {
  tx: Tx;
  lat: number;
  lon: number;
  /** 0 (core, near confirmation) .. 1 (surface, just arrived) — REAL age,
   *  normalised against the drawn set's own oldest tx. This is the channel
   *  that makes "position IS propagation state" true rather than merely
   *  decorative: unlike lat/lon (stable, hash-derived, honest but not a
   *  data claim), rFrac is bound to a real per-tx quantity. */
  rFrac: number;
  /** Visual dot radius — real WEIGHT (tx.size), never fee rate. */
  radius: number;
  color: string;
}

const CON_R_MIN = 1.0;
const CON_R_MAX = 3.6;

function conBuildNodes(drawn: AgedTx[], maxAge: number, maxSize: number, tiers: number[]): ConNode[] {
  return drawn.map((tx) => {
    const lat = (hashToUnit(tx.id) - 0.5) * 160 * (Math.PI / 180);
    const lon = (hashToUnit(tx.id + "·") * 360 - 180) * (Math.PI / 180);
    const ageT = maxAge > 0 ? Math.min(1, tx.age / maxAge) : 0;
    const wf = maxSize > 0 ? tx.size / maxSize : 0;
    return {
      tx,
      lat, lon,
      rFrac: 1 - ageT,
      radius: CON_R_MIN + Math.max(0, Math.min(1, wf)) * (CON_R_MAX - CON_R_MIN),
      color: conTierToken(tx.perB, tiers),
    };
  });
}

interface ConProjected { x: number; y: number; z: number; rnorm: number }

/** Filled-ball projection: a node's OWN rFrac bounds how close to the rim
 *  it can ever land — interior (mature) nodes cannot reach ρ≈R no matter
 *  their lat/lon. That is the geometric source of limb darkening, before
 *  conLimbAlpha/conLimbKeep add anything on top of it. */
function conProject(n: ConNode, rot: number, cx: number, cy: number, R: number): ConProjected {
  const lonR = n.lon + rot;
  const x3 = n.rFrac * Math.cos(n.lat) * Math.sin(lonR);
  const y3 = -n.rFrac * Math.sin(n.lat);
  const z3 = n.rFrac * Math.cos(n.lat) * Math.cos(lonR);
  return { x: cx + x3 * R, y: cy + y3 * R, z: z3, rnorm: Math.min(1, Math.hypot(x3, y3)) };
}

/* ── decorative arcs between real nodes ──────────────────────────────── */
function ConArcs({ arcs, rot, cx, cy, R, t }: {
  arcs: { a: ConNode; b: ConNode; u: number }[]; rot: number; cx: number; cy: number; R: number; t: number;
}) {
  return (
    <>
      {arcs.map((arc, i) => {
        const a = conProject(arc.a, rot, cx, cy, R);
        const b = conProject(arc.b, rot, cx, cy, R);
        // per-frame (0.006 + u*0.01) at 20fps == per-second (0.12 + u*0.2).
        const progress = (t * (0.12 + arc.u * 0.2) + arc.u) % 1;
        return (
          <path key={i} d={`M ${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${(a.y + b.y) / 2 - 56} ${b.x} ${b.y}`}
            fill="none" stroke="url(#con-arc)" strokeWidth="1" opacity="0.55"
            strokeDasharray="56 230" strokeDashoffset={-progress * 286} />
        );
      })}
    </>
  );
}

/* ── dense field (≥8 tx): culled + thinned while animating, NEITHER under
   reduced motion — see the file header for why both are motion effects. */
function ConDenseField({ nodes, rot, cx, cy, R, reduced, trackedTxId, onPickTx }: {
  nodes: ConNode[]; rot: number; cx: number; cy: number; R: number;
  reduced: boolean; trackedTxId: string | null; onPickTx: (id: string) => void;
}) {
  return (
    <>
      {nodes.map((n) => {
        if (trackedTxId != null && n.tx.id === trackedTxId) return null; // drawn separately, always on top
        const p = conProject(n, rot, cx, cy, R);
        // Backface culling is a MOTION effect — a node hidden now rotates
        // into view later. Under reduced motion the frame never advances,
        // so culling here would PERMANENTLY drop both this node's data and
        // its click target for roughly half the field. Contract §6
        // (corrected): the static equivalent must carry the same data AND
        // the same click targets.
        if (!reduced && p.z < -0.1) return null;
        // Density thinning is the same category of effect — suppressed for
        // the same reason under reduced motion.
        if (!reduced && !conLimbKeep(n.tx.id, p.rnorm)) return null;
        const alpha = conLimbAlpha(p.rnorm) * (reduced && p.z < 0 ? 0.55 : 1);
        const hitR = Math.max(n.radius + 3, 5);
        return (
          <g
            key={n.tx.id}
            data-con-node={n.tx.id}
            data-con-rnorm={p.rnorm.toFixed(3)}
            data-con-alpha={alpha.toFixed(3)}
            onClick={() => onPickTx(n.tx.id)}
            style={{ cursor: "pointer" }}
          >
            {/* Generous invisible tap target, wider than the visible dot.
                Blind spot (contract §9): at high density two real nodes'
                invisible hit circles can overlap, silently routing a click
                meant for one onto its neighbour — indistinguishable from a
                correctly routed click, since both open a real tx and read
                as success. Kept modest (+3px, floor 5px) specifically to
                bound how often two nodes sit close enough for this to
                matter, not to eliminate it. */}
            <circle cx={p.x} cy={p.y} r={hitR} fill="transparent" />
            <circle
              cx={p.x} cy={p.y} r={n.radius} fill={n.color} opacity={alpha}
              style={alpha > 0.5 ? { filter: `drop-shadow(0 0 ${(2 + alpha * 4).toFixed(1)}px ${n.color})` } : undefined}
            />
          </g>
        );
      })}
    </>
  );
}

/* ── low-pool field (<8 tx): every real tx is a named, always-visible,
   keyboard-reachable star — no culling, no thinning, in either motion
   state. Too few points for a density gradient to read as anything but
   "broken"; legibility beats limb-darkening realism here. */
function ConLowPoolField({ nodes, rot, cx, cy, R, trackedTxId, onPickTx }: {
  nodes: ConNode[]; rot: number; cx: number; cy: number; R: number;
  trackedTxId: string | null; onPickTx: (id: string) => void;
}) {
  return (
    <>
      {nodes.map((n) => {
        if (trackedTxId != null && n.tx.id === trackedTxId) return null; // drawn separately, always on top
        const p = conProject(n, rot, cx, cy, R);
        const dotR = n.radius * 1.9;
        const rightSide = p.x <= cx;
        const lx = rightSide ? p.x + dotR + 5 : p.x - dotR - 5;
        return (
          <g
            key={n.tx.id}
            data-con-node={n.tx.id}
            data-con-rnorm={p.rnorm.toFixed(3)}
            data-con-alpha="1.000"
            role="button"
            tabIndex={0}
            onClick={() => onPickTx(n.tx.id)}
            onKeyDown={onEnterKey(() => onPickTx(n.tx.id))}
            style={{ cursor: "pointer" }}
          >
            <circle cx={p.x} cy={p.y} r={Math.max(dotR + 7, 13)} fill="transparent" />
            <circle cx={p.x} cy={p.y} r={dotR} fill={n.color}
              style={{ filter: `drop-shadow(0 0 ${(4 + dotR).toFixed(1)}px ${n.color})` }} />
            <text x={lx} y={p.y + 3} textAnchor={rightSide ? "start" : "end"}
              fontFamily="var(--f-mono)" fontSize="var(--fs-label)" fill={n.color}>
              {shortHash(n.tx.id)}
            </text>
          </g>
        );
      })}
    </>
  );
}

/* ── rotating mempool sphere — the HERO ─────────────────────────────────
   Points = up to MAX_SPHERE_NODES real mempool txs, fee-ranked when
   truncated (disclosed). lat/lon are hash-derived from each txid (two
   independent stable units); rFrac is real age. Radius is real weight.
   Color is real fee tier. */
export function ConSphere({ txs, tiers, ready, trackedTxId, onPickTx, size = 460 }: {
  txs: Tx[]; tiers: number[]; ready: boolean; trackedTxId?: string | null;
  onPickTx: (id: string) => void; size?: number;
}) {
  const reduced = useReducedMotion();
  // v6.0.8: was `useTick(50)` — its own setInterval, reconciling up to 60
  // <circle>s plus arc paths through React 20×/second, forever, including
  // in a hidden tab. Now ONE shared rAF (design/useAnimationClock.ts),
  // throttled to 20fps on `high` / 12 on `mid` / 6 on `low`, and paused
  // when hidden. v2 rebuild: the field can now hold up to MAX_SPHERE_NODES
  // (190) real txs; the driver is unchanged, only the population it
  // reconciles grew.
  //
  // Seconds, not the frame counter: the old `tick * 0.008` meant "0.008 rad
  // per FRAME", which silently becomes a 3× slower sphere at 6fps. The
  // rate below is per SECOND, so the sphere turns at the same speed
  // everywhere and only its smoothness varies. `useAnimationSeconds`
  // already returns exactly 0 when `enabled` is false — the frozen frame
  // reduced motion gets — which is a legitimate still frame for a rotating
  // sphere: unlike a tick-driven simulator (CLAUDE.md's v6.1.3 trap #2)
  // there is no "before" state for it to freeze on wrong.
  const t = useAnimationSeconds({ fps: 20, enabled: !reduced });
  const cx = size / 2, cy = size / 2, R = size / 2 - 26;

  const { drawn, truncated, total, unaged } = React.useMemo(() => conSelectField(txs), [txs]);
  const maxAge = Math.max(1, ...drawn.map((tx) => tx.age));
  const maxSize = Math.max(1, ...drawn.map((tx) => tx.size));
  const nodes = React.useMemo(() => conBuildNodes(drawn, maxAge, maxSize, tiers), [drawn, maxAge, maxSize, tiers]);
  const lowPool = total < LOW_POOL_THRESHOLD;

  // The tracked tx, positioned the same age+hash-derived way as every
  // other node — so it sits where it "really" would even when it falls
  // outside the fee-ranked drawn set above. One named star among
  // anonymous ones, and — unlike every other node — NEVER culled or
  // thinned in any mode: a tracked tx must stay findable.
  const trackedNode = React.useMemo(() => {
    if (!trackedTxId) return null;
    const tx = txs.find((x) => x.id === trackedTxId);
    // A tracked tx with no reported arrival has no radius to sit at; it stays
    // findable in the list below (data-tracked-tx), just not placed on the
    // sphere at a depth nobody measured (p4·M9a).
    return tx && isAged(tx) ? conBuildNodes([tx], maxAge, maxSize, tiers)[0] : null;
  }, [txs, trackedTxId, maxAge, maxSize, tiers]);

  // Decorative arcs between real nodes. High count: hash-picked partner,
  // cap 18 (unchanged behaviour). Low count: EVERY pair — at most 7 nodes
  // is at most 21 lines, and "connect every star" is the literal
  // constellation reading the low-pool state exists to deliver.
  const arcs = React.useMemo(() => {
    if (nodes.length < 2) return [];
    if (lowPool) {
      const out: { a: ConNode; b: ConNode; u: number }[] = [];
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          out.push({ a: nodes[i], b: nodes[j], u: hashToUnit(nodes[i].tx.id + nodes[j].tx.id) });
        }
      }
      return out;
    }
    return nodes.slice(0, Math.min(18, Math.floor(nodes.length / 2))).map((n, i) => {
      let j = (i + 1 + Math.floor(hashToUnit(n.tx.id + "→") * (nodes.length - 1))) % nodes.length;
      if (j === i) j = (i + 1) % nodes.length;
      return { a: n, b: nodes[j], u: hashToUnit(n.tx.id + "⇄") };
    });
  }, [nodes, lowPool]);

  const rot = (t * 0.16) % (Math.PI * 2); // 0.008 rad/frame at the old 20fps == 0.16 rad/s.
  const trackedProj = trackedNode ? conProject(trackedNode, rot, cx, cy, R) : null;

  return (
    <svg width="100%" viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
      <defs>
        <radialGradient id="con-sph" cx="40%" cy="35%"><stop offset="0%" stopColor="var(--accent-structural)" stopOpacity="0.18" /><stop offset="55%" stopColor="var(--accent-structural)" stopOpacity="0.06" /><stop offset="100%" stopColor="var(--bg-0)" stopOpacity="0.7" /></radialGradient>
        <radialGradient id="con-atmo"><stop offset="60%" stopColor="var(--accent-structural)" stopOpacity="0" /><stop offset="100%" stopColor="var(--accent-structural)" stopOpacity="0.32" /></radialGradient>
        <linearGradient id="con-arc" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="var(--accent-structural)" stopOpacity="0" /><stop offset="50%" stopColor="var(--accent-structural)" stopOpacity="1" /><stop offset="100%" stopColor="var(--accent-structural)" stopOpacity="0" /></linearGradient>
      </defs>
      <circle cx={cx} cy={cy} r={R + 14} fill="url(#con-atmo)" opacity="0.7" />
      <circle cx={cx} cy={cy} r={R} fill="url(#con-sph)" stroke="var(--accent-structural)" strokeOpacity={0.25} strokeWidth="0.5" />
      {/* parallels */}
      {[-Math.PI / 3, -Math.PI / 6, 0, Math.PI / 6, Math.PI / 3].map((lat, i) => (
        <ellipse key={i} cx={cx} cy={cy - Math.sin(lat) * R} rx={R * Math.cos(lat)} ry={Math.max(2, R * Math.cos(lat) * 0.06)} fill="none" stroke="var(--accent-structural)" strokeOpacity={0.12} strokeWidth="0.5" strokeDasharray="2 4" />
      ))}
      {/* meridians */}
      {[0, 30, 60, 90, 120, 150].map((deg, i) => (
        <ellipse key={i} cx={cx} cy={cy} rx={Math.max(1, Math.abs(Math.sin((deg + rot * 180 / Math.PI) * Math.PI / 180)) * R)} ry={R} fill="none" stroke="var(--accent-structural)" strokeOpacity={0.09} strokeWidth="0.5" />
      ))}

      {lowPool ? (
        <ConLowPoolField nodes={nodes} rot={rot} cx={cx} cy={cy} R={R} trackedTxId={trackedTxId ?? null} onPickTx={onPickTx} />
      ) : (
        <ConDenseField nodes={nodes} rot={rot} cx={cx} cy={cy} R={R} reduced={reduced} trackedTxId={trackedTxId ?? null} onPickTx={onPickTx} />
      )}
      <ConArcs arcs={arcs} rot={rot} cx={cx} cy={cy} R={R} t={t} />

      {/* tracked star — bigger, a pulsing ring (motion only), a leader line
          to its short-hash label at the sphere edge. One named star among
          anonymous ones; data-track-idiom is this view's OWN visual
          highlight (verify-memviews scenario 2 item 4 — MemTxTable already
          stamps data-track-idiom from the shell, which makes that
          assertion vacuous with respect to the sphere; this is the sphere's
          own copy). */}
      {trackedNode && trackedProj ? (() => {
        const front = trackedProj.z >= -0.1;
        const ang = Math.atan2(trackedProj.y - cy, trackedProj.x - cx);
        const ex = cx + Math.cos(ang) * (R + 10), ey = cy + Math.sin(ang) * (R + 10);
        const lx = cx + Math.cos(ang) * (R + 24), ly = cy + Math.sin(ang) * (R + 24);
        const rad = Math.max(2.4, trackedNode.radius * 2.3);
        return (
          <g data-tracked-tx={trackedNode.tx.id} data-track-idiom="constellation" opacity={front ? 1 : 0.3}>
            <line x1={trackedProj.x} y1={trackedProj.y} x2={ex} y2={ey} stroke="var(--y-50)" strokeWidth="0.75" strokeDasharray="2 3" opacity="0.8" />
            <circle cx={trackedProj.x} cy={trackedProj.y} r={rad + 5} fill="none" stroke="var(--y-50)" strokeWidth="1.4">
              {!reduced ? <animate attributeName="r" values={`${rad + 3};${rad + 11};${rad + 3}`} dur="1.8s" repeatCount="indefinite" /> : null}
              {!reduced ? <animate attributeName="opacity" values="0.85;0.3;0.85" dur="1.8s" repeatCount="indefinite" /> : null}
            </circle>
            <circle cx={trackedProj.x} cy={trackedProj.y} r={rad} fill={trackedNode.color} style={{ filter: "drop-shadow(0 0 8px var(--y-50))" }} />
            <text x={lx} y={ly} textAnchor={Math.cos(ang) >= 0 ? "start" : "end"} dominantBaseline="middle"
              fontFamily="var(--f-mono)" fontSize="var(--fs-label)" fill="var(--y-50)" style={{ filter: "drop-shadow(0 0 3px var(--y-50))" }}>
              {shortHash(trackedNode.tx.id)}
            </text>
          </g>
        );
      })() : null}

      {/* reticle */}
      <g stroke="var(--tk-accent)" fill="none" strokeWidth="0.5" opacity="0.5">
        <line x1={cx - R - 20} y1={cy} x2={cx - R - 5} y2={cy} /><line x1={cx + R + 5} y1={cy} x2={cx + R + 20} y2={cy} />
        <line x1={cx} y1={cy - R - 20} x2={cx} y2={cy - R - 5} /><line x1={cx} y1={cy + R + 5} x2={cx} y2={cy + R + 20} />
        <circle cx={cx} cy={cy} r={R + 7} strokeDasharray="2 8" />
      </g>
      <text x={cx} y="22" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="var(--fs-label)" fill="var(--tk-accent)" letterSpacing="0.18em" style={{ filter: "drop-shadow(0 0 4px var(--tk-accent))" }}>
        {!ready ? "MEMPOOL · AWAITING FEED"
          : total === 0 ? "MEMPOOL · EMPTY"
          : (truncated ? `MEMPOOL · ${drawn.length} OF ${total} · LIVE` : `MEMPOOL · ${total} TX · LIVE`)
            + (unaged > 0 ? ` · ${unaged} NO ARRIVAL TIME` : "")}
      </text>
      {truncated ? (
        // y=40, not 35: at --fs-label the rendered line box is ~1.27em, so a
        // 13-unit baseline gap leaves the two boxes overlapping by ~1 unit and
        // verify-memviews scenario 6 reds at all four widths. Measured, not
        // eyeballed — the glyphs look separated; the boxes are not.
        <text x={cx} y="40" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="var(--fs-label)" fill="var(--ink-40)" letterSpacing="0.08em">
          ranked by fee/B · {total - drawn.length} not shown
        </text>
      ) : null}
    </svg>
  );
}

/* ── newest mempool tx card ─────────────────────────────────── */
function ConNewestTx({ data, onPickTx }: { data: MoneroLive; onPickTx: (id: string) => void }) {
  const tx = hasData(data.status.network) && data.mempool.length ? newestFirst(data.mempool)[0] : null;
  const tierIdx = tx ? feeTierIndex(tx.perB, data.feeTiers) : -1;
  return (
    <PanelFrame
      title="Newest tx · mempool"
      right={<NodeProvenance source="node" keys={["mempool"]} status={data.status} />}
      dataKey="mempool"
      updatedAt={oldestFreshAt(data.status, ["mempool"])}
    >
      {tx ? (
        <div onClick={() => onPickTx(tx.id)} style={{ cursor: "pointer" }}>
          <div className="mono" style={{ fontSize: "var(--fs-mono)", color: "var(--c-50)", marginBottom: "var(--sp-2)", letterSpacing: "0.04em" }}>{shortHash(tx.id)}</div>
          <div className="kv"><span className="k">Fee</span><span className="v acc">{tx.fee.toFixed(6)} XMR</span></div>
          <div className="kv"><span className="k">Size</span><span className="v">{fmtBytes(tx.size)}</span></div>
          <div className="kv"><span className="k">Rate</span><span className="v">{Math.round(tx.perB)} pcn/B</span></div>
          <div className="kv"><span className="k">Ring</span><span className="v">{tx.ringSize}</span></div>
          <div className="kv"><span className="k">Age</span><span className="v">{fmtAgeS(tx.age)}</span></div>
          <div className="kv"><span className="k">Tier</span><span className="v" style={{ color: conTierToken(tx.perB, data.feeTiers) }}>{tierIdx >= 0 ? FEE_TIER_LABELS[tierIdx] : "—"}</span></div>
        </div>
      ) : (
        <div className="mono dim" style={{ fontSize: "var(--fs-mono)", padding: "var(--sp-4) 0", textAlign: "center" }}>awaiting mempool…</div>
      )}
    </PanelFrame>
  );
}

/* ── mempool polar radar · age vs fee ───────────────────────────
   One dot per real tx (cap 60). Bearing is hash-derived from the txid,
   radius is real age (newest at center), color is the real fee tier.
   Every dot opens the shared tx inspector — each represents exactly one
   real transaction, unlike the aggregate bars/donut below. */
function ConMempoolRadar({ data, trackedTxId, onPickTx }: { data: MoneroLive; trackedTxId: string | null; onPickTx: (id: string) => void }) {
  const W = 220, c = W / 2, R = c - 14;
  const base = hasData(data.status.network) ? data.mempool.slice(0, 60) : [];
  // The tracked tx keeps its bearing/dot even if it fell outside the base-60
  // sample — same "always show what's tracked" rule as the sphere above.
  const trackedTx = trackedTxId ? data.mempool.find((t) => t.id === trackedTxId) : null;
  const all = trackedTx && !base.some((t) => t.id === trackedTx.id) ? [...base, trackedTx] : base;
  // Radius IS age here, so only txs with a reported arrival are plotted; the
  // rest are counted in the header, never drawn at a radius nobody measured.
  const txs = all.filter(isAged);
  const unaged = all.length - txs.length;
  const maxAge = Math.max(1, ...txs.map((t) => t.age));
  return (
    <PanelFrame
      title="Mempool polar · age vs fee"
      right={<span className="dim">{all.length ? `${txs.length} tx${unaged ? ` · ${unaged} no arrival time` : ""}` : "—"}</span>}
      dataKey="mempool"
      updatedAt={oldestFreshAt(data.status, ["mempool"])}
    >
      <svg viewBox={`0 0 ${W} ${W}`} width="100%" style={{ display: "block", maxWidth: 220, margin: "0 auto" }}>
        {[0.33, 0.66, 1].map((f, i) => <circle key={i} cx={c} cy={c} r={R * f} fill="none" stroke="var(--accent-structural)" strokeOpacity={0.14} strokeWidth="1" strokeDasharray={i === 2 ? "none" : "2 5"} />)}
        {txs.length ? [0.33, 0.66, 1].map((f, i) => (
          <text key={i} x={c + 3} y={c - R * f + 9} fontFamily="var(--f-mono)" fontSize="var(--fs-label)" fill="var(--ink-40)">{Math.round(maxAge * f)}s</text>
        )) : null}
        {txs.map((t) => {
          const isTracked = trackedTxId != null && t.id === trackedTxId;
          const ang = hashToUnit(t.id) * Math.PI * 2;
          const rad = Math.min(R, (t.age / maxAge) * R);
          const x = c + Math.cos(ang) * rad, y = c + Math.sin(ang) * rad;
          const color = isTracked ? "var(--y-50)" : conTierToken(t.perB, data.feeTiers);
          return (
            <g key={t.id} data-tracked-tx={isTracked ? t.id : undefined} onClick={() => onPickTx(t.id)} style={{ cursor: "pointer" }}>
              <line x1={c} y1={c} x2={c + Math.cos(ang) * R} y2={c + Math.sin(ang) * R} stroke={isTracked ? "var(--y-50)" : "var(--line-d)"} strokeWidth={isTracked ? 1.2 : 0.5} opacity={isTracked ? 0.9 : undefined} />
              <circle cx={x} cy={y} r={isTracked ? 9 : 7} fill="transparent" />
              <circle cx={x} cy={y} r={isTracked ? 4 : 3} fill={color} style={{ filter: `drop-shadow(0 0 ${isTracked ? 6 : 4}px ${color})` }} />
            </g>
          );
        })}
        <circle cx={c} cy={c} r="3" fill="var(--tk-accent)" style={{ filter: "drop-shadow(0 0 4px var(--tk-accent))" }} />
      </svg>
    </PanelFrame>
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
  const reduced = useReducedMotion();
  const events = useFeedEvents(data, 11);
  const pinned = pinnedTrackRow(tracking, data);
  return (
    <PanelFrame
      title="Feed log · tail"
      right={<><span className="led pulse" style={{ background: "var(--g-50)", boxShadow: "0 0 4px var(--g-50)" }} /> −f</>}
      dataKey="mempool network"
      updatedAt={oldestFreshAt(data.status, ["mempool", "network"])}
    >
      <div style={{ fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)", lineHeight: 1.55 }}>
        {pinned ? (
          <div data-tracked-tx={pinned.txid} data-tracked-block={pinned.height}
            style={{ display: "grid", gridTemplateColumns: "104px 120px 1fr 96px", gap: "var(--sp-2)", padding: "2px 0", borderBottom: "1px solid var(--y-50)" }}>
            <span className="dim2">pinned</span>
            <span style={{ color: "var(--y-50)" }}>TRACK</span>
            <span style={{ color: "var(--y-50)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pinned.msg}</span>
            <span className="dim2" style={{ textAlign: "right" }}>{pinned.meta}</span>
          </div>
        ) : null}
        {events.length ? events.map((e) => {
          const row = logRow(e);
          return (
            <div key={row.key} style={{
              display: "grid", gridTemplateColumns: "104px 120px 1fr 96px", gap: "var(--sp-2)", padding: "2px 0", borderBottom: "1px dashed var(--line-d)",
              // D0651: 0.4s tie → --d-4 (round-half-up). An inline `animation:`
              // never reaches a class-scoped reduce gate (v6.1.3 trap #5) — this
              // is gated explicitly on `reduced` rather than relying on one.
              animation: reduced ? "none" : "con-slidein var(--d-4) var(--e-standard)",
            }}>
              <span className="dim2">{new Date(e.ts).toISOString().slice(11, 23)}</span>
              <span style={{ color: LOG_TONE[e.kind] }}>{row.ev}</span>
              <span className="dim" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.msg}</span>
              <span className="dim2" style={{ textAlign: "right" }}>{row.meta}</span>
            </div>
          );
        }) : (!pinned ? (
          <div className="dim2" style={{ padding: "var(--sp-1) 0" }}>awaiting feed events…</div>
        ) : null)}
      </div>
      <style>{`@keyframes con-slidein { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: none; } }`}</style>
    </PanelFrame>
  );
}

/* ── fee-tier distribution bars ─────────────────────────────────
   Counts of real mempool txs per node fee tier (slow → fastest).
   Aggregate — spans many txs per bar — so, unlike the sphere and the
   radar, this stays non-interactive: no single txid a click could
   honestly resolve to. */
function ConFeeTierBars({ data }: { data: MoneroLive }) {
  const reduced = useReducedMotion();
  const ok = hasData(data.status.network) && data.feeTiers.length === 4;
  const counts = [0, 0, 0, 0];
  if (ok) for (const t of data.mempool) { const i = feeTierIndex(t.perB, data.feeTiers); if (i >= 0) counts[i]++; }
  const max = Math.max(1, ...counts);
  return (
    <PanelFrame
      title="Fee tiers · mempool distribution"
      right={<span className="acc">{ok ? `${data.mempool.length} tx` : "—"}</span>}
      dataKey="mempool fees"
      updatedAt={oldestFreshAt(data.status, ["mempool", "fees"])}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
        {FEE_TIER_LABELS.map((label, i) => (
          <div key={label} style={{ display: "grid", gridTemplateColumns: "56px 1fr 90px 38px", gap: "var(--sp-2)", alignItems: "center", fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)" }}>
            <span className="dim2">{label}</span>
            <span className="dim" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ok ? `${data.feeTiers[i].toLocaleString()} pcn/B` : "—"}</span>
            <div style={{ height: 7, background: "var(--line)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{
                height: "100%", width: "100%",
                position: "relative",
                background: CON_TIER_TOKENS[i],
                transformOrigin: "left",
                transform: `scaleX(${ok ? Math.max(0.0001, counts[i] / max) : 0})`,
                transition: reduced ? "none" : "transform var(--d-4) var(--e-standard)",
              }}>
                {ok && counts[i] > 0 ? (
                  <div style={{
                    position: "absolute", inset: 0,
                    transformOrigin: "right",
                    transform: `scaleX(${1 / Math.max(0.0001, counts[i] / max)})`,
                    boxShadow: `0 0 6px ${CON_TIER_TOKENS[i]}`,
                    pointerEvents: "none",
                  }} />
                ) : null}
              </div>
            </div>
            <span style={{ textAlign: "right", color: ok ? "var(--ink-100)" : "var(--ink-40)" }}>{ok ? counts[i] : "—"}</span>
          </div>
        ))}
      </div>
    </PanelFrame>
  );
}

/* ── mempool bytes-by-fee-tier donut ────────────────────────── */
function ConFeeBytesDonut({ data }: { data: MoneroLive }) {
  const cx = 70, cy = 70, r = 52, sw = 16, circ = 2 * Math.PI * r;
  const ok = hasData(data.status.network) && data.feeTiers.length === 4 && data.mempool.length > 0;
  const bytes = [0, 0, 0, 0];
  let totalBytes = 0;
  if (ok) for (const t of data.mempool) { const i = feeTierIndex(t.perB, data.feeTiers); if (i >= 0) { bytes[i] += t.size; totalBytes += t.size; } }
  const stats = useMemStats(data);
  let acc = 0;
  return (
    <PanelFrame
      title="Mempool · bytes by fee tier"
      right={<span className="acc">{ok ? fmtBytes(totalBytes) : "—"}</span>}
      dataKey="mempool fees"
      updatedAt={oldestFreshAt(data.status, ["mempool", "fees"])}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)" }}>
        <svg viewBox="0 0 140 140" width="100%" style={{ display: "block", maxWidth: 124 }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--line)" strokeWidth={sw} />
          {ok && totalBytes > 0 ? FEE_TIER_LABELS.map((label, i) => {
            const len = (bytes[i] / totalBytes) * circ;
            const el = <circle key={label} cx={cx} cy={cy} r={r} fill="none" stroke={CON_TIER_TOKENS[i]} strokeWidth={sw} strokeDasharray={len + " " + (circ - len)} strokeDashoffset={-acc} transform={`rotate(-90 ${cx} ${cy})`} style={{ filter: `drop-shadow(0 0 4px ${CON_TIER_TOKENS[i]})` }} />;
            acc += len; return el;
          }) : null}
          <text x={cx} y={cy - 2} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="16" fontWeight="500" fill="var(--tk-accent)">{hasData(data.status.network) ? data.mempool.length : "—"}</text>
          {/* cy+18, not cy+12. Raising this caption from the old fontSize="7.5"
              to the sanctioned --fs-label floor made it ~47% taller, and the
              16-unit number above it did not move — so the type-floor fix
              CREATED this collision. A legibility change is a layout change. */}
          <text x={cx} y={cy + 18} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="var(--fs-label)" fill="var(--ink-40)" letterSpacing="0.12em">TX IN POOL</text>
        </svg>
        <div style={{ flex: 1 }}>
          {FEE_TIER_LABELS.map((label, i) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)", padding: "3px 0" }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: CON_TIER_TOKENS[i], boxShadow: `0 0 4px ${CON_TIER_TOKENS[i]}` }} />
              <span className="dim" style={{ flex: 1 }}>{label}</span>
              <span className="acc">{ok && totalBytes > 0 ? `${((bytes[i] / totalBytes) * 100).toFixed(1)}%` : "—"}</span>
            </div>
          ))}
          <div className="kv" style={{ marginTop: "var(--sp-1)" }}><span className="k">Median rate</span><span className="v">{ok ? `${Math.round(stats.medianPerB)} pcn/B` : "—"}</span></div>
          <div className="kv"><span className="k">Pool bytes</span><span className="v">{ok ? fmtBytes(totalBytes) : "—"}</span></div>
        </div>
      </div>
    </PanelFrame>
  );
}

/* ── block stream strip ─────────────────────────────────────── */
function ConBlockStream({ data, tracking, trackedHeight, onPickBlock }: { data: MoneroLive; tracking: Tracking; trackedHeight: number | null; onPickBlock: (h: number) => void }) {
  return (
    <PanelFrame
      title="Block stream"
      right={<span className="acc">{hasData(data.status.network) ? `tip #${data.height.toLocaleString()}` : "—"}</span>}
      dataKey="blocks"
      updatedAt={oldestFreshAt(data.status, ["blocks"])}
    >
      <div style={{ display: "flex", gap: "var(--sp-1)", height: 96, alignItems: "flex-end" }}>
        {data.blocks.slice(0, RIBBON_BLOCKS).map((b) => {
          const isTracked = trackedHeight != null && b.height === trackedHeight;
          return (
            <div className="mblock" key={b.height}
              data-tracked-block={isTracked ? b.height : undefined}
              data-tracked-tx={isTracked && tracking?.kind === "tx" ? tracking.id : undefined}
              role="button" tabIndex={0}
              onClick={() => onPickBlock(b.height)}
              onKeyDown={onEnterKey(() => onPickBlock(b.height))}
              style={{
                width: 42, height: 58 + Math.min(34, (b.txs / 140) * 34), cursor: "pointer",
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
        <div style={{ marginTop: "var(--sp-2)", display: "flex", justifyContent: "flex-end" }}>
          <TrackChip tracking={tracking} data={data} />
        </div>
      ) : null}
    </PanelFrame>
  );
}

function ConOverview({ data, tracking, onPickTx, onPickBlock }: { data: MoneroLive; tracking: Tracking; onPickTx: (id: string) => void; onPickBlock: (h: number) => void }) {
  const ready = hasData(data.status.network);
  // tx-derived only (never a bare block search) — mirrors reactor.tsx /
  // classic.tsx's trackedHeight so the star/radar/stream/log can never
  // disagree with the ribbon arrow or TrackChip on any other view.
  const trackedTxId = tracking?.kind === "tx" ? tracking.id : null;
  const trackedHeight = tracking?.kind === "tx" ? (tracking.blockHeight ?? null) : null;
  return (
    <div style={{ padding: "var(--sp-4) 20px 40px", display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
      <section style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "var(--sp-3)", alignItems: "start" }}>
        <PanelFrame
          title="Mempool constellation"
          right={<NodeProvenance source="node" also="session" keys={["mempool", "fees", "network"]} status={data.status} detail="angle: hash · depth: real age" />}
          dataKey="mempool fees network"
          updatedAt={oldestFreshAt(data.status, ["mempool", "fees", "network"])}
          style={{ display: "flex", flexDirection: "column" }}
        >
          <ConSphere txs={data.mempool} tiers={data.feeTiers} ready={ready} trackedTxId={trackedTxId} onPickTx={onPickTx} size={460} />
          {/* Contract §6: any inferred element says so. Radial depth is
              real (age), but the STEM/FLUFF narrative is a disclosed
              maturity metaphor, never a claim of an observed relay path —
              a node cannot see another transaction's stem. */}
          {/* maxWidth is LOAD-BEARING, not cosmetic — see contract §8.
              `.mp-view` is `width: max-content` on desktop, so a text node's
              contribution to layout is its FULL UNWRAPPED line. This caption
              is ~140 chars; uncapped it demanded 981px on its own, pushing
              naturalW 1028 -> 1413, past canvasW 1180, which handed the whole
              view a 0.835 fit transform and dropped authored 11px to 9.19px
              rendered. Measured, not theorised: hiding this row alone moved
              .mp-fit by 281px. Capping it at the sphere's own width lets it
              wrap and keeps the view at identity scale, which is the one
              property that makes authored == rendered here.
              A §6 disclosure that silently violates §8 is still a defect. */}
          <div style={{ marginTop: "var(--sp-1)", marginInline: "auto", maxWidth: 460, textAlign: "center", fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)", color: "var(--ink-40)", letterSpacing: "0.02em", lineHeight: 1.45 }}>
            radial depth ≈ real age (fresh → surface, mature → core) — a maturity metaphor. Dandelion++ stem/fluff routing is illustrated, not observed.
          </div>
        </PanelFrame>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
          <ConNewestTx data={data} onPickTx={onPickTx} />
          <ConMempoolRadar data={data} trackedTxId={trackedTxId} onPickTx={onPickTx} />
        </div>
      </section>

      <ConPropLog data={data} tracking={tracking} />

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--sp-3)" }}>
        <ConFeeTierBars data={data} />
        <ConFeeBytesDonut data={data} />
        <ConBlockStream data={data} tracking={tracking} trackedHeight={trackedHeight} onPickBlock={onPickBlock} />
      </section>
    </div>
  );
}

export function ConstellationView({ data }: ViewProps) {
  const { tracking, onSearch, clearTracking } = useMempoolTracking(data);
  // MemViewShell keeps the sphere/radar/stream mounted while a tx is
  // tracked — the tracked star, its radar dot, and the block-stream
  // highlight above stay visible alongside the shared detail panel it
  // renders below, generalising reactor.tsx / classic.tsx's own hand-
  // rolled version of this same pattern.
  const onPickTx = (id: string) => onSearch({ kind: "tx", id, blockHeight: null });
  const onPickBlock = (h: number) => onSearch({ kind: "block", height: h });
  return (
    <div className="main" style={{ overflow: "auto", padding: 0 }}>
      <MemViewShell id="constellation" table={<MemTxTable data={data} tracking={tracking} viewId="constellation" columns={["txid", "perB", "tier", "size", "age"]} onPickTx={(id) => onSearch({ kind: "tx", id })} />} data={data} tracking={tracking} onSearch={onSearch} onClearTracking={clearTracking}>
        <ConOverview data={data} tracking={tracking} onPickTx={onPickTx} onPickBlock={onPickBlock} />
      </MemViewShell>
    </div>
  );
}
