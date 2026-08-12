// mempool/orbital-instruments.tsx — Orbital's geometry and its two stages.
//
// SPLIT OUT OF orbital.tsx, at the seam bridge used in #173 (instruments vs
// panels), because `verify-memshell`'s §5 item 3 line band is 200–1084 and the
// single file reached 1126.
//
// The band's own failure text names the remedy — "over the ceiling — split it" —
// and the split was taken even though the check does NOT fail for a new view:
// `verify-memshell:179` passes `{ owned: NEW.includes(id) ? false : true }`, so
// for a not-yet-shipped id it reports as a warning and the gate still exits 0.
// Shipping over a documented ceiling *because the check happens not to be owned
// yet* is a green earned outside the claim, which is the one thing this suite
// exists to prevent. Sizes after the split are recorded in the PR body.
//
// What lives here: the pure geometry (fee -> radius, age -> bearing), the
// derivation of the field and the inferred next-block cut, and the two mutually
// exclusive stages — the animated `<canvas>` and the static SVG twin rendered
// under `prefers-reduced-motion`. What stays in orbital.tsx: the panels, the
// composition and the view itself.
//
// Read orbital.tsx's header first — the identity, the wall-clock decision and
// the fluid-width argument are all recorded there and are not repeated.
import * as React from "react";
import { NodeProvenance, PanelFrame } from "@/design/primitives";
import { canvasCursor } from "@/design/chart-kit";
import { spreadLabels, useChartMetrics } from "@/design/useChartMetrics";
import { shortHash as ShortHash } from "@/data/types";
import { FEE_TIER_LABELS, feeTierIndex } from "@/data/map";
import type { Tracking } from "@/mempool/mempool-shared";
import { useMemCanvas, glowSprite, blitGlow, cssColor } from "@/mempool/useMemCanvas";
import type { MoneroLive } from "@/data/types";
import { freshAt } from "@/data/feed-status";

/** Piconero/byte, rounded and grouped. Shared by the stage's ring labels and by
 *  orbital.tsx's panels, so it lives with the geometry rather than beside the
 *  panels — the labels are the reason the format exists. */
export const fmtPcn = (v: number): string => Math.round(v).toLocaleString();

/* ──────────────────────────────────────────────────────────────
   GEOMETRY — pure, exported, and the gates read these rather than
   restating them
   ────────────────────────────────────────────────────────────── */

/** Tier → token, slow → fastest. Contract §4's mockup mapping, verbatim:
 *  slow `--c-50`, normal `--o-60`, fast `--o-80`, fastest `--y-50`. */
export const ORB_TIER_COLORS = ["var(--c-50)", "var(--o-60)", "var(--o-80)", "var(--y-50)"] as const;

/** The hub: the innermost fraction of the radius, left clear for the block
 *  that is forming. Nothing orbits inside it. */
export const ORB_HUB_FRAC = 0.17;
/** Ring-label gutter, in CSS px, reserved outside the outermost orbit. */
export const ORB_MARGIN = 26;
/** Stage height is DERIVED from the measured width so naturalH is a pure
 *  function of canvasW rather than a literal that drifts from the composition. */
export const ORB_ASPECT = 0.62;
export const ORB_H_MIN = 300;
export const ORB_H_MAX = 560;

/** Dot radius range in CSS px, mapped from tx size by area (√). */
const DOT_R_MIN = 1.3;
const DOT_R_MAX = 3.6;

/** Stage height for a measured stage width. */
export function orbStageH(w: number): number {
  return Math.round(Math.max(ORB_H_MIN, Math.min(ORB_H_MAX, w * ORB_ASPECT)));
}

/**
 * Fee → unit interval, log-scaled. 0 at the pool's cheapest, 1 at its dearest.
 *
 * LOG, because a real pool spans two orders of magnitude (the gate fixture runs
 * 15,000 → 914,999 pcn/B) and a linear radius would stack 95% of the pool into
 * the outer few pixels — the exact defect #173 removed from the oscilloscope's
 * y axis. Returns 0 for a degenerate span rather than NaN.
 */
export function orbFeeUnit(perB: number, lo: number, hi: number): number {
  if (!(perB > 0) || !(lo > 0) || !(hi > lo)) return 0;
  const u = (Math.log(perB) - Math.log(lo)) / (Math.log(hi) - Math.log(lo));
  return u < 0 ? 0 : u > 1 ? 1 : u;
}

/**
 * Unit fee → orbit radius, in CSS px. MONOTONE DECREASING: the dearest
 * transaction sits at the hub, the cheapest at the rim.
 *
 * That direction is what makes the spec's sentence literally true — "the next
 * block is everything inside this radius" — because a single radius threshold
 * then partitions the pool by fee exactly as the cut does.
 */
export function orbRadius(u: number, R: number, hub: number): number {
  return R - u * (R - hub);
}

/** Bearing in radians, clockwise from 12 o'clock. One lap per block target. */
export function orbBearing(effAgeSec: number, periodSec: number): number {
  const p = periodSec > 0 ? periodSec : 120;
  const phase = ((effAgeSec % p) + p) % p;
  return -Math.PI / 2 + (phase / p) * Math.PI * 2;
}

/** Whole laps completed — how many block intervals this tx has waited out. */
export function orbLaps(effAgeSec: number, periodSec: number): number {
  const p = periodSec > 0 ? periodSec : 120;
  return Math.max(0, Math.floor(effAgeSec / p));
}

/** Lap count → alpha. Resolves the modular ambiguity in bearing: two txs a
 *  block apart share a spoke, and the older one is dimmer. */
export function orbLapAlpha(laps: number): number {
  return Math.max(0.26, 1 - laps * 0.15);
}

/* ──────────────────────────────────────────────────────────────
   DERIVATION — the field, and the next-block cut, computed ONCE
   ────────────────────────────────────────────────────────────── */

export interface OrbPoint {
  id: string;
  perB: number;
  size: number;
  /** age as the node reported it, at the snapshot instant */
  age: number;
  tier: number;
  /** 0..1 log position in the pool's fee span */
  u: number;
  /** dot radius in CSS px, from tx size */
  dot: number;
  /** rank in the fee-sorted order — shared with the cut, so "rank 12" means
   *  the same thing in the console and on the stage */
  rank: number;
  /** does this tx fit under the node's own weight ceiling, fee-sorted */
  fits: boolean | null;
}

export interface OrbField {
  /** fee-sorted, dearest first — the same array the cut walks */
  pts: OrbPoint[];
  lo: number;
  hi: number;
  /** the node's real fee tiers, as unit positions on the same axis */
  tierUnits: { tier: number; perB: number; u: number }[];
  cutIndex: number | null;
  cutPerB: number | null;
  cutU: number | null;
  cumAtCut: number;
  limit: number;
  /** ms epoch of the mempool snapshot these ages were measured at */
  snapAt: number;
  periodSec: number;
}

/**
 * The whole derivation, memoised on the fields it reads.
 *
 * The cut is the SAME cumulative-weight walk bridge and reactor make, derived
 * here rather than imported: each view owns its composition, and #173's own
 * header records the reason (three surfaces in ONE view must agree; two views
 * need not share an implementation). It is SESSION-computed and labelled
 * inferred — a miner's real template is unobservable from a public node.
 */
export function useOrbitalField(data: MoneroLive): OrbField {
  return React.useMemo<OrbField>(() => {
    const pts: OrbPoint[] = [];
    const sorted = [...data.mempool].sort((a, b) => b.perB - a.perB);
    const n = sorted.length;
    const lo = n ? sorted[n - 1].perB : 0;
    const hi = n ? sorted[0].perB : 0;

    const limit = data.blockWeightMedian || data.blockWeightLimit || 0;
    let cutIndex: number | null = null;
    let cumAtCut = 0;
    if (limit > 0 && n > 0) {
      let cum = 0;
      cutIndex = n;                       // the whole pool fits under the ceiling
      for (let i = 0; i < n; i++) {
        if (cum + sorted[i].size > limit) { cutIndex = i; break; }
        cum += sorted[i].size;
      }
      cumAtCut = cum;
    }

    const sizeLo = n ? Math.min(...sorted.map((t) => t.size)) : 0;
    const sizeHi = n ? Math.max(...sorted.map((t) => t.size)) : 0;
    for (let i = 0; i < n; i++) {
      const t = sorted[i];
      const sizeU = sizeHi > sizeLo ? (t.size - sizeLo) / (sizeHi - sizeLo) : 0;
      pts.push({
        id: t.id,
        perB: t.perB,
        size: t.size,
        age: t.age,
        tier: feeTierIndex(t.perB, data.feeTiers),
        u: orbFeeUnit(t.perB, lo, hi),
        dot: DOT_R_MIN + Math.sqrt(sizeU) * (DOT_R_MAX - DOT_R_MIN),
        rank: i,
        fits: cutIndex == null ? null : i < cutIndex,
      });
    }

    // The node's own tier boundaries, placed on the same log axis. Only the
    // three interior boundaries are node values; the rim and hub are the
    // observed span, which is why they are not listed as tiers.
    const tierUnits = data.feeTiers.length === 4
      ? [1, 2, 3].map((k) => ({ tier: k, perB: data.feeTiers[k], u: orbFeeUnit(data.feeTiers[k], lo, hi) }))
      : [];

    const cutPerB = cutIndex != null && cutIndex > 0 && cutIndex < n ? sorted[cutIndex].perB : null;

    return {
      pts, lo, hi, tierUnits, cutIndex, cutPerB,
      cutU: cutPerB == null ? null : orbFeeUnit(cutPerB, lo, hi),
      cumAtCut, limit,
      snapAt: freshAt(data.status.mempool),
      periodSec: data.blockTarget || 120,
    };
  }, [data.mempool, data.feeTiers, data.blockWeightMedian, data.blockWeightLimit, data.blockTarget, data.status.mempool]);
}

/* ──────────────────────────────────────────────────────────────
   THE STAGE — canvas geometry + DOM labels
   ────────────────────────────────────────────────────────────── */

interface StageGeom { w: number; h: number; cx: number; cy: number; R: number; hub: number }

function orbGeom(w: number, h: number): StageGeom {
  const R = Math.max(10, Math.min(w, h) / 2 - ORB_MARGIN);
  return { w, h, cx: w / 2, cy: h / 2, R, hub: R * ORB_HUB_FRAC };
}

/**
 * The STATIC half of the stage — bands, rings, spokes — cached to an offscreen
 * canvas and blitted.
 *
 * Everything here is a pure function of (box, tier boundaries), so it is
 * identical on every frame between feed updates, while being the most expensive
 * thing drawn: four annulus fills each covering most of the disc, plus 17
 * strokes, at up to 2.75x DPR. Measured under verify-memperf's 6x CPU throttle
 * at 240 txs, redrawing it per frame held p5 at 15fps.
 *
 * Same memoisation idea as `glowSprite`, and the same cache-key discipline: the
 * key includes the RESOLVED colours, not the token names, so a theme flip is a
 * miss rather than a stale blit — a token string never changes when the theme
 * does, only what it resolves to.
 */
const ORB_BG = new Map<string, HTMLCanvasElement>();

function orbBackground(g: StageGeom, tiers: { tier: number; u: number }[], dpr: number): HTMLCanvasElement | null {
  const fills = ORB_TIER_COLORS.map((c) => cssColor(c));
  const ink20 = cssColor("var(--ink-20)");
  const lineD = cssColor("var(--line-d)");
  const key = [
    Math.round(g.w), Math.round(g.h), dpr.toFixed(2),
    tiers.map((t) => t.u.toFixed(4)).join(","), fills.join(","), ink20, lineD,
  ].join("|");
  const hit = ORB_BG.get(key);
  if (hit) return hit;

  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(g.w * dpr));
  c.height = Math.max(1, Math.round(g.h * dpr));
  const x = c.getContext("2d");
  if (!x) return null;
  x.setTransform(dpr, 0, 0, dpr, 0, 0);

  const bounds = [0, ...tiers.map((t) => t.u), 1];
  if (tiers.length === 3) {
    for (let k = 0; k < 4; k++) {
      const rOut = orbRadius(bounds[k], g.R, g.hub);
      const rIn = orbRadius(bounds[k + 1], g.R, g.hub);
      if (!(rOut > rIn)) continue;
      x.beginPath();
      x.arc(g.cx, g.cy, rOut, 0, Math.PI * 2);
      x.arc(g.cx, g.cy, rIn, 0, Math.PI * 2, true);
      x.fillStyle = fills[k];
      x.globalAlpha = 0.045;
      x.fill();
      x.globalAlpha = 1;
    }
  }
  x.lineWidth = 1;
  for (const r of [g.R, g.hub]) {
    x.beginPath();
    x.arc(g.cx, g.cy, r, 0, Math.PI * 2);
    x.strokeStyle = ink20;
    x.stroke();
  }
  for (const t of tiers) {
    x.beginPath();
    x.arc(g.cx, g.cy, orbRadius(t.u, g.R, g.hub), 0, Math.PI * 2);
    x.strokeStyle = fills[t.tier];
    x.globalAlpha = 0.5;
    x.stroke();
    x.globalAlpha = 1;
  }
  x.strokeStyle = lineD;
  x.beginPath();
  for (let k = 0; k < 12; k++) {
    const a = -Math.PI / 2 + (k / 12) * Math.PI * 2;
    x.moveTo(g.cx + Math.cos(a) * g.hub, g.cy + Math.sin(a) * g.hub);
    x.lineTo(g.cx + Math.cos(a) * g.R, g.cy + Math.sin(a) * g.R);
  }
  x.stroke();

  // Bounded: one entry per (box, tiers, theme). A resize sweep can add a few;
  // clear the oldest rather than grow without limit.
  if (ORB_BG.size > 12) ORB_BG.clear();
  ORB_BG.set(key, c);
  return c;
}

/**
 * The orbit stage.
 *
 * Draw cost per frame is bounded by construction: one arc per ring (3 tier
 * rings + hub + rim + at most one cut ring + at most one tracked ring), then
 * ONE fill per transaction. Glow is a memoised sprite blitted for the tracked
 * transaction only — `ctx.shadowBlur` is banned in src/mempool and gated
 * (verify-memshell §4d), being a full blur per draw call.
 */
export function OrbStage({ field, tracking, onPickTx }: {
  field: OrbField; tracking: Tracking; onPickTx: (id: string) => void;
}) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  // FLUID mode (no vbWidth) so k === 1 — contract §2. The host renders
  // unconditionally, never `null`, which is the v6.0.12 rule that keeps the
  // ref attached from the first render.
  const m = useChartMetrics(wrapRef);
  const w = m.w || 0;
  const h = orbStageH(w || ORB_H_MIN / ORB_ASPECT);

  const trackedId = tracking?.kind === "tx" ? tracking.id : null;

  // Read by the draw loop through refs so a 3s feed tick never tears down the
  // canvas, its observers, or the elapsed clock (#173's radar records the same
  // property being lost to an effect dep, and it is earned here too).
  const fieldRef = React.useRef(field);
  fieldRef.current = field;
  const trackedRef = React.useRef<string | null>(trackedId);
  trackedRef.current = trackedId;

  const draw = React.useCallback((ctx: CanvasRenderingContext2D, cw: number, ch: number) => {
    const f = fieldRef.current;
    const g = orbGeom(cw, ch);
    ctx.clearRect(0, 0, cw, ch);

    const ink40 = cssColor("var(--ink-40)");

    // ── the static half: rim, hub, four tier bands, twelve bearing spokes ──
    // One blit. See `orbBackground` for why this is not drawn per frame.
    const bg = orbBackground(g, f.tierUnits, Math.min(window.devicePixelRatio || 1, 2));
    if (bg) ctx.drawImage(bg, 0, 0, cw, ch);

    // ── the inferred cut ring ──
    if (f.cutU != null) {
      const rc = orbRadius(f.cutU, g.R, g.hub);
      ctx.beginPath();
      ctx.arc(g.cx, g.cy, rc, 0, Math.PI * 2);
      ctx.strokeStyle = cssColor("var(--g-50)");
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 1;
    }

    // ── the pool ──
    // Wall clock, deliberately — see the file header. `elapsed` is how far the
    // real world has moved since the snapshot these ages were measured at.
    const elapsed = f.snapAt > 0 ? (Date.now() - f.snapAt) / 1000 : 0;
    const tracked = trackedRef.current;
    let trackedAt: { x: number; y: number; r: number; laps: number } | null = null;

    // BATCHED BY (tier, lap), and the batching is EXACT rather than an
    // approximation — which is why it costs no fidelity.
    //
    // The naive loop is `beginPath + arc + fill` per transaction: 240 path
    // rasterisations a frame, measured at p5 13fps under verify-memperf's 6x
    // CPU throttle. But the two things that vary per particle are its COLOUR
    // (one of five: four tiers plus unknown) and its ALPHA — and alpha is
    // `orbLapAlpha(laps)`, a step function of an INTEGER, which saturates at
    // its 0.26 floor from laps >= 5. So the whole pool has at most 5 x 6 = 30
    // distinct (fillStyle, globalAlpha) states no matter how deep it gets, and
    // every particle in one state can share a single path.
    //
    // One `beginPath` + N `arc`s + one `fill` per occupied state therefore
    // draws the identical pixels with <= 30 fills instead of 240. Colours are
    // resolved ONCE per frame here rather than per particle, for the same
    // reason: `cssColor` reads getComputedStyle, which is not a per-particle
    // cost worth paying.
    const LAP_BUCKETS = 6;                       // 0,1,2,3,4,>=5 — alpha saturates
    const tierFill = ORB_TIER_COLORS.map((c) => cssColor(c));
    const batches = new Map<number, OrbPoint[]>();
    for (const p of f.pts) {
      const laps = Math.min(LAP_BUCKETS - 1, orbLaps(p.age + elapsed, f.periodSec));
      const key = (p.tier >= 0 ? p.tier : 4) * LAP_BUCKETS + laps;
      const bucket = batches.get(key);
      if (bucket) bucket.push(p); else batches.set(key, [p]);
    }
    for (const [key, pts] of batches) {
      const tier = Math.floor(key / LAP_BUCKETS);
      ctx.fillStyle = tier < 4 ? tierFill[tier] : ink40;
      ctx.globalAlpha = orbLapAlpha(key % LAP_BUCKETS);
      ctx.beginPath();
      for (const p of pts) {
        const a = orbBearing(p.age + elapsed, f.periodSec);
        const r = orbRadius(p.u, g.R, g.hub);
        const x = g.cx + Math.cos(a) * r;
        const y = g.cy + Math.sin(a) * r;
        if (tracked != null && p.id === tracked) {
          trackedAt = { x, y, r, laps: orbLaps(p.age + elapsed, f.periodSec) };
        }
        ctx.moveTo(x + p.dot, y);            // moveTo, or arc() joins to the previous circle
        ctx.arc(x, y, p.dot, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ── THE TRACKED TX LIGHTS ITS ORBIT RING (the spec's own idiom) ──
    if (trackedAt) {
      ctx.beginPath();
      ctx.arc(g.cx, g.cy, trackedAt.r, 0, Math.PI * 2);
      ctx.strokeStyle = cssColor("var(--y-50)");
      ctx.lineWidth = 1.6;
      ctx.globalAlpha = 0.9;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1;
      blitGlow(ctx, glowSprite("var(--y-50)", 14), trackedAt.x, trackedAt.y, 0.75);
      ctx.beginPath();
      ctx.arc(trackedAt.x, trackedAt.y, 5.5, 0, Math.PI * 2);
      ctx.strokeStyle = cssColor("var(--y-50)");
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.lineWidth = 1;
    }
  }, []);

  const { ref } = useMemCanvas(draw);

  // Hit test in the canvas's own CSS-px space. `canvasCursor` is the ONE
  // conversion allowed anywhere in the tree (chart-kit.tsx:111) and
  // verify-chartkit greps the whole repo for a re-derivation.
  const onClick = React.useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = canvasCursor(e);
    if (!c) return;
    const el = e.currentTarget;
    const g = orbGeom(el.clientWidth, el.clientHeight);
    const f = fieldRef.current;
    const elapsed = f.snapAt > 0 ? (Date.now() - f.snapAt) / 1000 : 0;
    let best: { id: string; d2: number } | null = null;
    for (const p of f.pts) {
      const a = orbBearing(p.age + elapsed, f.periodSec);
      const r = orbRadius(p.u, g.R, g.hub);
      const dx = g.cx + Math.cos(a) * r - c.x;
      const dy = g.cy + Math.sin(a) * r - c.y;
      const d2 = dx * dx + dy * dy;
      // TOLERANCE, AND THE CLASS IT CANNOT SEE (§9). `hit` is generous for
      // thumbs, so it is also the largest coordinate-space error this test can
      // absorb silently. The units are traced by construction instead: the
      // draw loop and this test both consume `el.clientWidth/clientHeight` and
      // both call the same orbGeom/orbBearing/orbRadius, so there is no second
      // derivation to disagree — and `useMemCanvas` folds DPR into the context
      // transform, never into the coordinates either path sees.
      const hit = Math.max(p.dot + 4, 9);
      if (d2 <= hit * hit && (!best || d2 < best.d2)) best = { id: p.id, d2 };
    }
    if (best) onPickTx(best.id);
  }, [onPickTx]);

  const g = orbGeom(w || 1, h);
  /* RING LABELS ARE SEPARATED, AND THE 390 RENDER IS WHY.
   *
   * The labels sit on the vertical axis at their own ring's radius, which is
   * fine at 1440 where R is 202 and the three tiers land ~40px apart. At 390 R
   * is 114, the same three land within ~30px of each other AND of the hub
   * caption, and they overlap into an unreadable stack. Found by looking at a
   * screenshot: no gate sees canvas geometry, and these labels are DOM nodes
   * inside a canvas host, so `verify-memviews` scenario 6's SVG collision sweep
   * does not reach them either.
   *
   * `spreadLabels` is the repo's existing 1-D separator (used by the bridge
   * radar for exactly this), so the fix is the sanctioned instrument rather
   * than a bespoke nudge. The label MOVES but its ring does not, so the reading
   * stays true — each label keeps its own colour, which is what ties it back to
   * its ring.
   *
   * The hub caption is dropped when the hub is too small to hold two lines of
   * `--fs-label`: at 390 the hub radius is 19px and a two-line caption is ~28px
   * tall, so it was drawn straight through the innermost ring label. */
  const LABEL_GAP = 15;
  const HUB_CAPTION_MIN_R = 30;
  const rawYs = field.tierUnits.map((t) => g.cy - orbRadius(t.u, g.R, g.hub));
  const laidYs = spreadLabels(rawYs, LABEL_GAP, LABEL_GAP, g.cy - LABEL_GAP);
  const labels = field.tierUnits.map((t, i) => ({
    key: `tier-${t.tier}`,
    y: laidYs[i],
    text: `${fmtPcn(t.perB)}`,
    sub: FEE_TIER_LABELS[t.tier],
    color: ORB_TIER_COLORS[t.tier],
  }));

  return (
    <div
      ref={wrapRef}
      className="orb-stage"
      style={{ position: "relative", width: "100%", height: h, minWidth: 0 }}
    >
      <canvas
        ref={ref}
        className="mem-canvas"
        role="img"
        aria-label="Pending transactions orbiting by fee rate and age"
        onClick={onClick}
        style={{ cursor: "pointer" }}
      />
      {/* Ring labels as DOM — see the file header. Absolutely positioned, so
          they contribute nothing to `.mp-view`'s max-content. */}
      {m.ready ? labels.map((l) => (
        <span
          key={l.key}
          className="mono"
          style={{
            position: "absolute", left: "50%", top: l.y,
            transform: "translate(-50%, -50%)", pointerEvents: "none",
            fontSize: "var(--fs-label)", color: l.color, whiteSpace: "nowrap",
            background: "var(--bg-0)", padding: "0 var(--sp-1)", letterSpacing: "0.06em",
          }}
        >
          {l.text} <span style={{ color: "var(--ink-40)" }}>{l.sub}</span>
        </span>
      )) : null}
      {m.ready && field.pts.length && g.hub >= HUB_CAPTION_MIN_R ? (
        <span
          className="mono"
          style={{
            position: "absolute", left: "50%", top: g.cy, transform: "translate(-50%, -50%)",
            pointerEvents: "none", textAlign: "center", fontSize: "var(--fs-label)",
            color: "var(--ink-40)", letterSpacing: "0.08em", lineHeight: 1.35,
          }}
        >
          NEXT<br />BLOCK
        </span>
      ) : null}
    </div>
  );
}

/**
 * The reduced-motion twin: the same geometry, frozen at the ages the feed last
 * reported, as SVG.
 *
 * NOT a paused canvas. `verify-memviews` scenario 3 asserts ZERO
 * `canvas.mem-canvas` under `prefers-reduced-motion`, and contract §6 requires
 * that the static equivalent carries the same DATA and the same CLICK TARGETS —
 * so every transaction is a real `<circle>` with its own handler, not a
 * decorative still. Sediment's `mode: "static"` is the precedent.
 *
 * (The gate's own comment says the shell "never calls children() under reduced
 * motion". That is FALSE — `mempool-shared.tsx:390`'s `showBody` consults
 * `tracking` and nothing else — so the assertion passes because each view
 * suppresses its OWN canvas, which is what this branch is doing.)
 */
export function OrbStatic({ field, tracking, onPickTx }: {
  field: OrbField; tracking: Tracking; onPickTx: (id: string) => void;
}) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const m = useChartMetrics(wrapRef);
  const w = m.w || 0;
  const h = orbStageH(w || ORB_H_MIN / ORB_ASPECT);
  const g = orbGeom(w || 1, h);
  const trackedId = tracking?.kind === "tx" ? tracking.id : null;
  const bounds = [0, ...field.tierUnits.map((t) => t.u), 1];
  let trackedR: number | null = null;

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", height: h, minWidth: 0 }}>
      {m.ready ? (
        <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }} role="img"
          aria-label="Pending transactions by fee rate and age — static">
          {field.tierUnits.length === 3 ? [0, 1, 2, 3].map((k) => {
            const rOut = orbRadius(bounds[k], g.R, g.hub);
            const rIn = orbRadius(bounds[k + 1], g.R, g.hub);
            return rOut > rIn ? (
              <circle key={`band${k}`} cx={g.cx} cy={g.cy} r={(rOut + rIn) / 2} fill="none"
                stroke={ORB_TIER_COLORS[k]} strokeOpacity={0.07} strokeWidth={rOut - rIn} />
            ) : null;
          }) : null}
          <circle cx={g.cx} cy={g.cy} r={g.R} fill="none" stroke="var(--ink-20)" />
          <circle cx={g.cx} cy={g.cy} r={g.hub} fill="none" stroke="var(--ink-20)" />
          {field.tierUnits.map((t) => (
            <circle key={`ring${t.tier}`} cx={g.cx} cy={g.cy} r={orbRadius(t.u, g.R, g.hub)} fill="none"
              stroke={ORB_TIER_COLORS[t.tier]} strokeOpacity={0.5} />
          ))}
          {field.cutU != null ? (
            <circle cx={g.cx} cy={g.cy} r={orbRadius(field.cutU, g.R, g.hub)} fill="none"
              stroke="var(--g-50)" strokeDasharray="4 4" strokeWidth={1.4} />
          ) : null}
          {field.pts.map((p) => {
            const a = orbBearing(p.age, field.periodSec);
            const r = orbRadius(p.u, g.R, g.hub);
            const isTracked = trackedId != null && p.id === trackedId;
            if (isTracked) trackedR = r;
            return (
              <circle
                key={p.id}
                cx={g.cx + Math.cos(a) * r}
                cy={g.cy + Math.sin(a) * r}
                r={p.dot}
                fill={p.tier >= 0 ? ORB_TIER_COLORS[p.tier] : "var(--ink-40)"}
                fillOpacity={orbLapAlpha(orbLaps(p.age, field.periodSec))}
                style={{ cursor: "pointer" }}
                onClick={() => onPickTx(p.id)}
              >
                <title>{`${ShortHash(p.id)} · ${fmtPcn(p.perB)} pcn/B · ${p.age}s`}</title>
              </circle>
            );
          })}
          {trackedR != null ? (
            <circle cx={g.cx} cy={g.cy} r={trackedR} fill="none" stroke="var(--y-50)" strokeWidth={1.6}
              strokeOpacity={0.9} />
          ) : null}
        </svg>
      ) : null}
    </div>
  );
}
