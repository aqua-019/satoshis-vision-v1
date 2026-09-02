// mempool/abyss-instruments.tsx — Abyss's geometry and its two stages.
//
// SPLIT OUT OF abyss.tsx at the seam #173 established and p2·7 reused
// (instruments vs panels), because `verify-memshell`'s §5 item 3 line band is
// 200–1084 and the single file would have reached ~1180.
//
// The split is taken even though the band check does NOT fail for a new view:
// `verify-memshell:179` passes `{ owned: NEW.includes(id) ? false : true }`, so
// for a not-yet-shipped id it reports as a warning and the gate still exits 0.
// Shipping over a documented ceiling *because the check happens not to be owned
// yet* is a green earned outside the claim.
//
// What lives here: the pure geometry (fee → luminosity, age → depth, txid →
// lane), the derivation of the field and the inferred next-block cut, the
// depth-tick ladder shared by three consumers, and the two mutually exclusive
// stages — the animated `<canvas>` and the static SVG twin rendered under
// `prefers-reduced-motion`. What stays in abyss.tsx: the panels, the
// composition and the view itself.
//
// Read abyss.tsx's header first — the identity, the two adjacencies, the
// subtractive tracked idiom and the fluid-width argument are recorded there and
// are not repeated.
import * as React from "react";
import { canvasCursor } from "@/design/chart-kit";
import { spreadLabels, useChartMetrics } from "@/design/useChartMetrics";
import { shortHash as ShortHash } from "@/data/types";
import { hashToUnit, FEE_TIER_LABELS, feeTierIndex } from "@/data/map";
import type { Tracking } from "@/mempool/mempool-shared";
import { useMemCanvas, glowSprite, blitGlow, cssColor } from "@/mempool/useMemCanvas";
import type { MoneroLive } from "@/data/types";
import { freshAt } from "@/data/feed-status";

/** Piconero/byte, rounded and grouped. Same format the console and the census
 *  print, declared once beside the geometry that produces the axis. */
export const fmtPcn = (v: number): string => Math.round(v).toLocaleString();

/* ──────────────────────────────────────────────────────────────
   GEOMETRY — pure, exported, and the gates read these rather than
   restating them
   ────────────────────────────────────────────────────────────── */

/**
 * THE LUMINOSITY RAMP — eight buckets, cold+faint at the cheap end, warm+bright
 * at the dear end.
 *
 * This is Abyss's fee axis, and it is the whole identity: sediment encodes fee
 * as a vertical STRATUM and orbital as a RADIUS, so a third positional encoding
 * would make this view one of those two rotated. Here fee is a BRIGHTNESS
 * CHANNEL and nothing about a particle's position carries it.
 *
 * Tokens only — `cssColor` resolves them once per frame, never per particle.
 * The cold half is `--ink-40` → `--b-50` → `--c-50` (contract §4's cold ramp,
 * which is what "deep water" is made of); the warmth is carried entirely by the
 * fee, which is the sentence the spec asks this view to make true.
 */
export const ABY_LUM_TOKENS = [
  "var(--ink-40)", "var(--b-50)", "var(--b-50)", "var(--c-50)",
  "var(--c-50)", "var(--o-60)", "var(--o-80)", "var(--y-50)",
] as const;
export const ABY_LUM_BUCKETS = ABY_LUM_TOKENS.length;

/** Alpha at the faintest and brightest bucket. The floor is well clear of zero:
 *  a cheap transaction is FAINT, never absent — the pool is a census and a
 *  particle that cannot be seen is a transaction that has been dropped from it. */
export const ABY_ALPHA_MIN = 0.34;
export const ABY_ALPHA_MAX = 1;

/**
 * THE SUBTRACTIVE IDIOM'S TWO CONSTANTS, and they are the reason this view
 * needs a screenshot rather than only a gate.
 *
 * Every other view LIGHTS the tracked transaction. Abyss keeps it lit and DIMS
 * the rest, which has a failure mode no assertion in this repo can see: dimmed
 * to invisible. `data-tracked-tx` is present either way, the canvas paints
 * either way, and the density count is unchanged either way.
 *
 * So the dim is a MAPPING, not a multiplier: the un-tracked population is
 * compressed into [ABY_DIM_FLOOR, ABY_ALPHA_MIN × ABY_DIM_FACTOR], which sits
 * strictly below the undimmed range and strictly above nothing. The faintest
 * particle in the dimmed state is 0.12 on `--ink-40`, which is still a visible
 * mark on `--bg-0` (#050505) — verified by looking at the render at 1440 and
 * 390, which is the only instrument that can check it.
 */
export const ABY_DIM_FACTOR = 0.3;
export const ABY_DIM_FLOOR = 0.12;

/** Tier → token, slow → fastest. Contract §4's mapping table, verbatim, and
 *  DECLARED HERE rather than imported from orbital-instruments: a value import
 *  across two lazy view chunks makes Vite hoist a shared chunk for four
 *  strings, which is a bundle change to save a duplication the contract already
 *  fixes by naming the table. Used only where fee TIERS appear (the census and
 *  the console's tier column) — the stage itself has no tier colours, because
 *  the stage's fee axis is the luminosity ramp above. */
export const ABY_TIER_COLORS = ["var(--c-50)", "var(--o-60)", "var(--o-80)", "var(--y-50)"] as const;

/** CSS px reserved above the shallowest particle (the surface) and below the
 *  deepest (the floor), so neither is clipped by the canvas edge. */
export const ABY_SURFACE = 20;
export const ABY_FLOOR_PAD = 20;
/** Left gutter reserved for the DOM depth-axis labels, and right edge inset. */
export const ABY_GUTTER = 66;
export const ABY_EDGE = 14;

/** Stage height is DERIVED from the measured width so naturalH is a pure
 *  function of canvasW rather than a literal that drifts from the composition.
 *  Taller than orbital's 0.62 because the metaphor is a water COLUMN — but
 *  capped, so the desktop composition stays inside the 702px canvas budget the
 *  1440×900 reference gives (`verify-fit`'s `canvasH 702`). */
export const ABY_ASPECT = 0.78;
export const ABY_H_MIN = 320;
export const ABY_H_MAX = 620;

/**
 * Dot radius range in CSS px, mapped from tx size by area (√).
 *
 * `DOT_R_MIN` IS A LEGIBILITY FLOOR, NOT A TASTE SETTING, and it was raised
 * from 1.4 after looking at the LOW-POOL render. At 240 transactions the
 * picture is carried by density and a 1.4px dot is fine; at 3 it is a speck in
 * a 735x574 box, and the low-pool state then reads as an EMPTY PLOT rather than
 * the sparse deep field it actually is. Raising the floor is uniform across the
 * whole population, so it preserves every size ORDERING and every ratio the
 * √-area map encodes — it changes what the smallest mark is, not what any mark
 * means. Same class of rule as the type floor: below some size a mark stops
 * being readable regardless of what it is faithfully reporting.
 */
const DOT_R_MIN = 2;
const DOT_R_MAX = 4.4;

/** Horizontal sway amplitude (px) and period (s). Motion is honest or absent
 *  (contract §5): the sway is a pure function of (txid, effective age), so a
 *  tab hidden for ten minutes resumes at the phase the water would actually be
 *  at, and the reduced-motion twin freezes it at the snapshot rather than at
 *  frame zero. No `Math.random()` anywhere — the phase is `hashToUnit`. */
export const ABY_SWAY_PX = 6;
export const ABY_SWAY_PERIOD = 11;

/** Stage height for a measured stage width. */
export function abyStageH(w: number): number {
  return Math.round(Math.max(ABY_H_MIN, Math.min(ABY_H_MAX, w * ABY_ASPECT)));
}

/**
 * Fee → unit interval, log-scaled. 0 at the pool's cheapest, 1 at its dearest.
 *
 * LOG, and DERIVED here rather than inherited: a real pool spans two orders of
 * magnitude, and on a LINEAR map 95% of the pool lands in the bottom two of
 * eight luminosity buckets — the field would read as uniformly dim with a
 * handful of bright outliers, which is a picture of the scale, not of the pool.
 * The same argument orbital makes for radius; the quantity it governs here is
 * brightness, so the failure it prevents is different (crushed contrast rather
 * than crushed geometry) even though the maths is the same.
 *
 * Returns 0 for a degenerate span rather than NaN.
 */
export function abyFeeUnit(perB: number, lo: number, hi: number): number {
  if (!(perB > 0) || !(lo > 0) || !(hi > lo)) return 0;
  const u = (Math.log(perB) - Math.log(lo)) / (Math.log(hi) - Math.log(lo));
  return u < 0 ? 0 : u > 1 ? 1 : u;
}

/**
 * Unit fee → luminosity bucket.
 *
 * BUCKETED, and the count is the per-frame draw budget: alpha and fill colour
 * are the only two things that vary per particle, both are functions of this
 * bucket alone, so the whole pool has at most ABY_LUM_BUCKETS distinct
 * (fillStyle, globalAlpha) states no matter how deep it gets and every particle
 * in one state shares a single path. Eight fills per frame, not N. See
 * `AbyStage`'s draw loop.
 */
export function abyLumBucket(u: number): number {
  const b = Math.floor(u * ABY_LUM_BUCKETS);
  return b < 0 ? 0 : b > ABY_LUM_BUCKETS - 1 ? ABY_LUM_BUCKETS - 1 : b;
}

/** Bucket → alpha, linear across the ramp. */
export function abyAlpha(bucket: number): number {
  const t = ABY_LUM_BUCKETS > 1 ? bucket / (ABY_LUM_BUCKETS - 1) : 1;
  return ABY_ALPHA_MIN + t * (ABY_ALPHA_MAX - ABY_ALPHA_MIN);
}

/** Undimmed alpha → dimmed alpha. See ABY_DIM_FACTOR's note. */
export function abyDimAlpha(a: number): number {
  return Math.max(ABY_DIM_FLOOR, a * ABY_DIM_FACTOR);
}

/**
 * Age → depth, log-scaled, 0 at the surface and 1 at the floor.
 *
 * LOG for the same reason the fee axis is: a pool holds a burst of
 * seconds-old arrivals and a long tail of stragglers, and on a linear depth the
 * entire burst — most of the transactions — collapses onto the surface line.
 * Log gives the recent minutes the room they earn and still shows the tail.
 *
 * `maxAgeSec` IS the shared strip's `oldest` (see `useAbyssField`'s signature):
 * the deepest particle sits on the floor because it is the pool's real oldest
 * transaction, not because a scale was chosen to put it there.
 */
export function abyDepthUnit(effAgeSec: number, maxAgeSec: number): number {
  if (!(effAgeSec > 0)) return 0;
  const m = maxAgeSec > 0 ? maxAgeSec : 1;
  const u = Math.log1p(effAgeSec) / Math.log1p(m);
  return u < 0 ? 0 : u > 1 ? 1 : u;
}

/** Horizontal lane, 0..1, from the txid hash. CARRIES NOTHING, deliberately,
 *  and saying so is the point: bridge's blip angle is `hashToUnit(txid)` for
 *  exactly this reason, and orbital's header records that as the axis it does
 *  NOT reuse. Here the horizontal axis is the WIDTH OF THE WATER — a water
 *  column has no second variable — so a uniform deterministic scatter is the
 *  honest filler, and it is stated rather than left to look meaningful. */
export function abyLane(id: string): number {
  return hashToUnit(id);
}

/** Sway offset in CSS px for a tx at a given effective age. Deterministic per
 *  txid; wall-clock through `effAgeSec`, so a resume is correct rather than
 *  frozen. */
export function abySway(id: string, effAgeSec: number): number {
  const phase = hashToUnit(id + "~aby") * Math.PI * 2;
  return Math.sin((effAgeSec / ABY_SWAY_PERIOD) * Math.PI * 2 + phase) * ABY_SWAY_PX;
}

/** Short age label — the depth axis's own vocabulary. */
export function fmtAge(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  if (s === 0) return "now";
  if (s < 90) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

/**
 * The ladder the depth axis is drawn from. ONE derivation, three consumers —
 * the canvas gridlines, the DOM labels and the depth census — so a band in the
 * census is exactly the band between two lines on the stage.
 *
 * THE FINE RUNGS (5/10/15/45) EXIST FOR THE LOW-POOL STATE, and they were added
 * after looking at it. A pool of 3 transactions can have an oldest of ~31s, and
 * a ladder starting at 30 then gave exactly `[now, 30s]` plus the floor — an
 * axis with two usable gridlines, on a view whose whole vertical dimension is
 * that axis. The rungs cost the 240-tx state four more gridlines and buy the
 * sparse state an axis that still reads.
 */
const AGE_LADDER = [0, 5, 10, 15, 30, 45, 60, 120, 300, 600, 1200, 1800, 3600, 7200, 14400, 43200, 86400];

/**
 * Below this much depth separation, the floor tick is dropped rather than laid
 * next to the rung above it. At maxAge 31 the ladder's last rung is 30 —
 * `abyDepthUnit(30, 31)` is 0.9909 — so "30s" and "31s" landed 5px apart and
 * `spreadLabels` then pushed them to 14px, producing two labels a second apart
 * at the bottom of the column.
 *
 * 0.03, AND THE FIRST VALUE WAS 0.07, WHICH WAS WRONG IN A WAY ONLY THE RENDER
 * SHOWED. At the 240-tx fixture maxAge is 1747 and the last rung is 1200:
 * `abyDepthUnit(1200, 1747)` is 0.9497, a gap of 0.0503, so a 0.07 threshold
 * dropped the floor tick there too — leaving the deepest 5% of the column
 * unlabelled and the "the floor IS the pool's oldest transaction" reading
 * absent from the axis on the main case. That is a bigger loss than the
 * redundancy it was avoiding. 0.03 keeps "29m" at 1747 and still drops "31s"
 * at 31.
 */
const FLOOR_TICK_MIN_GAP = 0.03;

export function abyDepthTicks(maxAgeSec: number): { sec: number; label: string }[] {
  const m = maxAgeSec > 0 ? maxAgeSec : 0;
  const out = AGE_LADDER.filter((s) => s < m).map((s) => ({ sec: s, label: fmtAge(s) }));
  if (!out.length) out.push({ sec: 0, label: fmtAge(0) });
  const last = out[out.length - 1];
  const floorLabel = fmtAge(m);
  // Two independent reasons to drop it, because they catch different cases:
  // the gap test catches "too close to draw", and the label test catches
  // "different second, same rendered text" — at maxAge 130 the last rung is
  // 120 and both render "2m", which the gap test alone would also catch here
  // but would not at coarser resolutions.
  if (m > 0 && abyDepthUnit(last.sec, m) <= 1 - FLOOR_TICK_MIN_GAP && floorLabel !== last.label) {
    out.push({ sec: m, label: floorLabel });
  }
  return out;
}

/* ──────────────────────────────────────────────────────────────
   DERIVATION — the field, and the next-block cut, computed ONCE
   ────────────────────────────────────────────────────────────── */

export interface AbyPoint {
  id: string;
  perB: number;
  size: number;
  /** age as the node reported it, at the snapshot instant */
  age: number;
  tier: number;
  /** 0..1 log position in the pool's fee span — the LUMINOSITY axis */
  u: number;
  /** luminosity bucket, 0..ABY_LUM_BUCKETS-1 */
  lum: number;
  /** 0..1 horizontal lane from the txid hash — carries nothing, see abyLane */
  lane: number;
  /** dot radius in CSS px, from tx size */
  dot: number;
  /** rank in the fee-sorted order — shared with the cut, so "rank 12" means the
   *  same thing in the console and on the stage */
  rank: number;
  /** does this tx fit under the node's own weight ceiling, fee-sorted */
  fits: boolean | null;
}

export interface AbyField {
  /** fee-sorted, dearest first — the same array the cut walks */
  pts: AbyPoint[];
  lo: number;
  hi: number;
  /** the node's real fee tiers, as unit positions on the LUMINOSITY axis */
  tierUnits: { tier: number; perB: number; u: number }[];
  cutIndex: number | null;
  cutPerB: number | null;
  cutU: number | null;
  cumAtCut: number;
  limit: number;
  /** ms epoch of the mempool snapshot these ages were measured at */
  snapAt: number;
  /** the depth domain — the shared strip's `oldest`, passed in, never re-derived.
   *  0 when the strip has no oldest (no tx carries an age); `pts` is empty then. */
  maxAgeSec: number;
  /** the whole pool, placed or not — `pts` holds only the placeable */
  total: number;
  /** txs whose arrival no clock reported: depth IS age, so they have no
   *  water to sink through. Counted in the manifest, never drawn (p4·M9a). */
  unaged: number;
}

/**
 * The whole derivation, memoised on the fields it reads.
 *
 * `oldestAgeSec` IS A PARAMETER, and that is the point. Contract §3 says a view
 * must not compute its own version of a figure the strip publishes, and the
 * depth axis is anchored on exactly one of them. Taking it as an argument makes
 * "the deepest particle is the strip's `oldest`" true BY CONSTRUCTION rather
 * than by two implementations agreeing — the failure mode sediment shipped
 * (a literal styled as a live reading) and the one p2·7's own gate caught
 * (two reads of a wall clock a second apart) are both structurally unavailable
 * here, because there is only one number.
 *
 * The cut is the SAME cumulative-weight walk bridge, reactor and orbital make,
 * derived here rather than imported: each view owns its composition. It is
 * SESSION-computed and labelled inferred — a miner's real template is
 * unobservable from a public node.
 */
export function useAbyssField(data: MoneroLive, oldestAgeSec: number | null): AbyField {
  return React.useMemo<AbyField>(() => {
    const pts: AbyPoint[] = [];
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
    let unaged = 0;
    for (let i = 0; i < n; i++) {
      const t = sorted[i];
      // The cut walk above ran over the WHOLE fee-sorted pool; only the
      // placing is age-bound.
      if (t.age == null) { unaged++; continue; }
      const sizeU = sizeHi > sizeLo ? (t.size - sizeLo) / (sizeHi - sizeLo) : 0;
      const u = abyFeeUnit(t.perB, lo, hi);
      pts.push({
        id: t.id,
        perB: t.perB,
        size: t.size,
        age: t.age,
        tier: feeTierIndex(t.perB, data.feeTiers),
        u,
        lum: abyLumBucket(u),
        lane: abyLane(t.id),
        dot: DOT_R_MIN + Math.sqrt(sizeU) * (DOT_R_MAX - DOT_R_MIN),
        rank: i,
        fits: cutIndex == null ? null : i < cutIndex,
      });
    }

    // The node's own tier boundaries, placed on the same log axis. Only the
    // three interior boundaries are node values; the ends are the observed
    // span, which is why they are not listed as tiers.
    const tierUnits = data.feeTiers.length === 4
      ? [1, 2, 3].map((k) => ({ tier: k, perB: data.feeTiers[k], u: abyFeeUnit(data.feeTiers[k], lo, hi) }))
      : [];

    const cutPerB = cutIndex != null && cutIndex > 0 && cutIndex < n ? sorted[cutIndex].perB : null;

    return {
      pts, lo, hi, tierUnits, cutIndex, cutPerB,
      cutU: cutPerB == null ? null : abyFeeUnit(cutPerB, lo, hi),
      cumAtCut, limit,
      snapAt: freshAt(data.status.mempool),
      maxAgeSec: oldestAgeSec ?? 0,
      total: n,
      unaged,
    };
  }, [data.mempool, data.feeTiers, data.blockWeightMedian, data.blockWeightLimit, data.status.mempool, oldestAgeSec]);
}

/* ──────────────────────────────────────────────────────────────
   THE STAGE — canvas geometry + DOM labels
   ────────────────────────────────────────────────────────────── */

export interface AbyGeom { w: number; h: number; top: number; bottom: number; left: number; right: number }

export function abyGeom(w: number, h: number): AbyGeom {
  return {
    w, h,
    top: ABY_SURFACE,
    bottom: Math.max(ABY_SURFACE + 10, h - ABY_FLOOR_PAD),
    left: Math.min(ABY_GUTTER, Math.max(16, w * 0.22)),
    right: Math.max(24, w - ABY_EDGE),
  };
}

export function abyDepthY(u: number, g: AbyGeom): number {
  return g.top + u * (g.bottom - g.top);
}

export function abyX(p: { lane: number; id: string }, g: AbyGeom, effAge: number): number {
  const span = g.right - g.left;
  const x = g.left + p.lane * span + abySway(p.id, effAge);
  return x < g.left ? g.left : x > g.right ? g.right : x;
}

/**
 * The STATIC half of the stage — the water column's vertical gradient and its
 * frame — cached to an offscreen canvas and blitted.
 *
 * It is a pure function of (box, resolved colours) and it is the single most
 * expensive draw in the view: a full-canvas gradient fill at up to 2× DPR,
 * every frame, for pixels that cannot change between theme flips.
 *
 * Same cache-key discipline as `glowSprite` and `orbBackground`: the key holds
 * the RESOLVED colours, never the token names, because a token string does not
 * change when the theme does — only what it resolves to. Keying on the name
 * would serve the first theme's pixels forever.
 *
 * The DEPTH GRIDLINES are deliberately NOT in here. They move with the tick
 * ladder, which moves with the pool's oldest transaction, so caching them would
 * either thrash the cache every poll or blit a stale axis; they are six to nine
 * 1px strokes, which is cheaper than the cache miss they would cause.
 */
const ABY_BG = new Map<string, HTMLCanvasElement>();

function abyBackground(g: AbyGeom, dpr: number): HTMLCanvasElement | null {
  const deep = cssColor("var(--b-50)");
  const ink20 = cssColor("var(--ink-20)");
  const key = [Math.round(g.w), Math.round(g.h), dpr.toFixed(2), deep, ink20].join("|");
  const hit = ABY_BG.get(key);
  if (hit) return hit;

  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(g.w * dpr));
  c.height = Math.max(1, Math.round(g.h * dpr));
  const x = c.getContext("2d");
  if (!x) return null;
  x.setTransform(dpr, 0, 0, dpr, 0, 0);

  // The water: transparent at the surface, a cold wash toward the floor.
  const grad = x.createLinearGradient(0, g.top, 0, g.bottom);
  grad.addColorStop(0, "transparent");
  grad.addColorStop(1, deep);
  x.globalAlpha = 0.085;
  x.fillStyle = grad;
  x.fillRect(g.left - 8, g.top, Math.max(0, g.right - g.left + 16), Math.max(0, g.bottom - g.top));
  x.globalAlpha = 1;

  // Surface line and floor line — the two ends of the depth axis.
  x.strokeStyle = ink20;
  x.lineWidth = 1;
  x.beginPath();
  x.moveTo(g.left - 8, g.top + 0.5);
  x.lineTo(g.right, g.top + 0.5);
  x.moveTo(g.left - 8, g.bottom + 0.5);
  x.lineTo(g.right, g.bottom + 0.5);
  x.stroke();

  // Bounded: one entry per (box, theme). A resize sweep can add a few; clear
  // the oldest rather than grow without limit.
  if (ABY_BG.size > 12) ABY_BG.clear();
  ABY_BG.set(key, c);
  return c;
}

/**
 * The abyss stage.
 *
 * PER-FRAME COST IS BOUNDED BY CONSTRUCTION, and the bound is a constant rather
 * than a function of pool depth:
 *
 *   1 blit (the cached water)
 *   + T strokes for the depth ladder, T ≤ 14 (AGE_LADDER + the floor tick)
 *   + at most ABY_LUM_BUCKETS = 8 `fill()` calls for the WHOLE pool
 *   + at most 1 glow blit + 2 strokes for the tracked particle.
 *
 * The eight is the luminosity bucketing doing the work `orbLapAlpha`'s
 * saturation does in orbital: alpha and colour are both pure functions of the
 * bucket, so every particle in a bucket shares one path. 240 transactions is
 * eight fills; 2,400 would also be eight.
 *
 * Colours are resolved ONCE per frame, not per particle — `cssColor` reads
 * getComputedStyle. `ctx.shadowBlur` is banned in src/mempool and gated
 * (verify-memshell §4d); the tracked glow is a memoised sprite.
 */
export function AbyStage({ field, tracking, onPickTx }: {
  field: AbyField; tracking: Tracking; onPickTx: (id: string) => void;
}) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  // FLUID mode (no vbWidth) so k === 1 — contract §2. The host renders
  // unconditionally, never `null`, which is the v6.0.12 rule that keeps the ref
  // attached from the first render.
  const m = useChartMetrics(wrapRef);
  const w = m.w || 0;
  const h = abyStageH(w || ABY_H_MIN / ABY_ASPECT);

  const trackedId = tracking?.kind === "tx" ? tracking.id : null;

  // Read by the draw loop through refs so a 3s feed tick never tears down the
  // canvas, its observers, or the elapsed clock.
  const fieldRef = React.useRef(field);
  fieldRef.current = field;
  const trackedRef = React.useRef<string | null>(trackedId);
  trackedRef.current = trackedId;
  /**
   * The tracked-particle marker's DOM node, written by the DRAW LOOP.
   *
   * Not React state, and not a render-time `top`. The particle sinks
   * continuously (depth is `age + elapsed`, wall-clock) while React only
   * re-renders on a 3s feed tick, so a render-time position drifts from the dot
   * it names — measured at ~19px over one poll window for a 5s-old transaction,
   * which is enough to put the label on the wrong gridline and to leave the
   * canvas leader line pointing somewhere the label is not.
   *
   * One style write per frame for one element is the same thing `Orb.tsx` does
   * on its own tick, and it is what keeps marker, leader and dot exact. The
   * repo's rule is "never `setState` per frame; mutate refs or DOM attributes"
   * (contract §5) — this is the second half of that sentence.
   */
  const markRef = React.useRef<HTMLSpanElement>(null);

  const draw = React.useCallback((ctx: CanvasRenderingContext2D, cw: number, ch: number) => {
    const f = fieldRef.current;
    const g = abyGeom(cw, ch);
    ctx.clearRect(0, 0, cw, ch);

    const bg = abyBackground(g, Math.min(window.devicePixelRatio || 1, 2));
    if (bg) ctx.drawImage(bg, 0, 0, cw, ch);

    // ── the depth ladder ──
    const lineD = cssColor("var(--line-d)");
    ctx.strokeStyle = lineD;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const t of abyDepthTicks(f.maxAgeSec)) {
      const y = Math.round(abyDepthY(abyDepthUnit(t.sec, f.maxAgeSec), g)) + 0.5;
      ctx.moveTo(g.left - 8, y);
      ctx.lineTo(g.right, y);
    }
    ctx.stroke();

    // ── the pool ──
    //
    // WALL CLOCK, deliberately, and the same argument orbital records: the
    // hook's elapsed `t` freezes while the tab is hidden or the canvas is
    // scrolled off, which is right for decorative motion and wrong for a
    // coordinate derived from a transaction's real age. `elapsed` is how far the
    // real world has moved since the snapshot these ages were measured at, so a
    // tab hidden for ten minutes resumes ten minutes deeper rather than where it
    // was parked.
    //
    // THE DOMAIN IS THE SNAPSHOT'S, NOT THE ADVANCED ONE. Depth is
    // `abyDepthUnit(age + elapsed, maxAgeSec)` with `maxAgeSec` fixed at the
    // strip's `oldest`, so the axis labels and the gridlines cannot drift apart
    // from the particles between polls — and the oldest few clamp onto the floor
    // for at most one mempool tier (3s, xmrirish-feed.ts's FAST) before the next
    // snapshot re-anchors them. Advancing the domain too would keep the deepest
    // particle pinned but would move every label under every line.
    const elapsed = f.snapAt > 0 ? (Date.now() - f.snapAt) / 1000 : 0;
    const tracked = trackedRef.current;
    const dimming = tracked != null;
    let trackedAt: { x: number; y: number; r: number; lum: number } | null = null;

    const fills = ABY_LUM_TOKENS.map((c) => cssColor(c));
    const batches = new Map<number, AbyPoint[]>();
    for (const p of f.pts) {
      const bucket = batches.get(p.lum);
      if (bucket) bucket.push(p); else batches.set(p.lum, [p]);
    }
    for (const [lum, pts] of batches) {
      ctx.fillStyle = fills[lum] ?? fills[0];
      const base = abyAlpha(lum);
      ctx.globalAlpha = dimming ? abyDimAlpha(base) : base;
      ctx.beginPath();
      for (const p of pts) {
        const eff = p.age + elapsed;
        const x = abyX(p, g, eff);
        const y = abyDepthY(abyDepthUnit(eff, f.maxAgeSec), g);
        if (tracked != null && p.id === tracked) {
          trackedAt = { x, y, r: p.dot, lum: p.lum };
        }
        ctx.moveTo(x + p.dot, y);          // moveTo, or arc() joins to the previous circle
        ctx.arc(x, y, p.dot, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ── THE TRACKED PARTICLE STAYS LIT WHILE EVERYTHING ELSE DIMS ──
    // The subtractive idiom, and the only glow in the view.
    if (trackedAt) {
      const lit = cssColor(ABY_LUM_TOKENS[trackedAt.lum] ?? ABY_LUM_TOKENS[0]);
      blitGlow(ctx, glowSprite("var(--y-50)", 16), trackedAt.x, trackedAt.y, 0.7);
      ctx.beginPath();
      ctx.arc(trackedAt.x, trackedAt.y, Math.max(3, trackedAt.r), 0, Math.PI * 2);
      ctx.fillStyle = lit;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(trackedAt.x, trackedAt.y, Math.max(6.5, trackedAt.r + 4), 0, Math.PI * 2);
      ctx.strokeStyle = cssColor("var(--y-50)");
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // its depth, carried to the axis — the reading the DOM marker labels
      ctx.beginPath();
      ctx.setLineDash([3, 3]);
      ctx.moveTo(g.left - 8, Math.round(trackedAt.y) + 0.5);
      ctx.lineTo(trackedAt.x, Math.round(trackedAt.y) + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 1;
      // …and the DOM marker rides the same y, so the label, the leader and the
      // dot cannot disagree. See markRef.
      if (markRef.current) markRef.current.style.top = `${trackedAt.y}px`;
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
    const g = abyGeom(el.clientWidth, el.clientHeight);
    const f = fieldRef.current;
    const elapsed = f.snapAt > 0 ? (Date.now() - f.snapAt) / 1000 : 0;
    let best: { id: string; d2: number } | null = null;
    for (const p of f.pts) {
      const eff = p.age + elapsed;
      const dx = abyX(p, g, eff) - c.x;
      const dy = abyDepthY(abyDepthUnit(eff, f.maxAgeSec), g) - c.y;
      const d2 = dx * dx + dy * dy;
      // TOLERANCE, AND THE CLASS IT CANNOT SEE (§9). `hit` is generous for
      // thumbs, so it is also the largest coordinate-space error this test can
      // absorb silently. The units are traced by construction instead: the draw
      // loop and this test both consume `el.clientWidth/clientHeight` and both
      // call the same abyGeom/abyX/abyDepthY/abyDepthUnit, so there is no second
      // derivation to disagree — and `useMemCanvas` folds DPR into the context
      // transform, never into the coordinates either path sees.
      const hit = Math.max(p.dot + 4, 9);
      if (d2 <= hit * hit && (!best || d2 < best.d2)) best = { id: p.id, d2 };
    }
    if (best) onPickTx(best.id);
  }, [onPickTx]);

  const g = abyGeom(w || 1, h);
  const trackedPt = trackedId ? field.pts.find((p) => p.id === trackedId) : undefined;

  /* DEPTH LABELS ARE DOM, NOT CANVAS TEXT — orbital's reasoning, applied to the
   * other axis. Canvas glyphs are invisible to verify-legibility, to
   * verify-memviews scenario 6's collision sweep and to its sub-12px SVG check,
   * three gates whose nominal subject includes this view; authoring text into
   * that blind spot buys a prettier stage at the cost of every gate that reads
   * text. The canvas draws geometry only.
   *
   * `spreadLabels` separates them for the same reason orbital's ring labels
   * needed it: the ladder is LOG, so at 390 (stage height 320, usable 280px) the
   * shallow ticks — now/30s/60s/2m — land within a few px of each other while
   * the deep end is empty. The label MOVES, its gridline does not, so the
   * reading stays true. */
  const ticks = abyDepthTicks(field.maxAgeSec);
  const rawYs = ticks.map((t) => abyDepthY(abyDepthUnit(t.sec, field.maxAgeSec), g));
  const LABEL_GAP = 14;
  const laidYs = spreadLabels(rawYs, LABEL_GAP, g.top, Math.max(g.top + LABEL_GAP, g.bottom));

  return (
    <div
      ref={wrapRef}
      className="aby-stage"
      style={{ position: "relative", width: "100%", height: h, minWidth: 0 }}
    >
      <canvas
        ref={ref}
        className="mem-canvas"
        role="img"
        aria-label="Pending transactions as a deep-water field — brightness is fee rate, depth is age"
        onClick={onClick}
        style={{ cursor: "pointer" }}
      />
      {/* Depth-axis labels. Absolutely positioned, so they contribute nothing to
          `.mp-view`'s max-content. */}
      {m.ready ? ticks.map((t, i) => (
        <span
          key={`d${t.sec}-${i}`}
          className="mono aby-axis"
          style={{ position: "absolute", left: 0, top: laidYs[i] }}
        >
          {t.label}
        </span>
      )) : null}
      {/* THE SUBTRACTIVE IDIOM'S DOM ANCHOR.
          `data-track-idiom` here as well as on MemTxTable's row, because the
          highlight this view makes is a canvas one and verify-tracking §1's
          positive control requires the count to be 0 BEFORE a search — which it
          is, since this whole node is mounted only while a tx is tracked. The
          marker labels the lit particle's depth on the axis: the one reading the
          dimming is there to isolate. */}
      {/* The marker is opaque and DELIBERATELY SUPERSEDES any ladder label at
          the same depth — found by looking at the tracked render, where it sat
          exactly on top of "5s" because the tracked transaction was 5s old.
          Nothing is lost: its own text carries the age, so it says everything
          the rung under it said and the fee as well. `spreadLabels` cannot help
          here, because the ladder is laid out at render time and this element
          moves every frame. */}
      {m.ready && trackedPt ? (
        <span
          ref={markRef}
          className="mono aby-track"
          data-track-idiom="abyss"
          data-tracked-tx={trackedPt.id}
          style={{
            position: "absolute", left: 0,
            // Seed only — the draw loop owns this from the first frame.
            top: abyDepthY(abyDepthUnit(trackedPt.age, field.maxAgeSec), g),
          }}
        >
          {fmtAge(trackedPt.age)} · {fmtPcn(trackedPt.perB)}
        </span>
      ) : null}
    </div>
  );
}

/**
 * The reduced-motion twin: the same field, frozen at the ages the feed last
 * reported, as SVG.
 *
 * NOT a paused canvas. `verify-memviews` scenario 3 asserts ZERO
 * `canvas.mem-canvas` under `prefers-reduced-motion`, and contract §6 requires
 * the static equivalent to carry the same DATA and the same CLICK TARGETS — so
 * every transaction is a real `<circle>` with its own handler, not a decorative
 * still. The dimming is carried too: the subtractive idiom is INFORMATION, not
 * animation, so suppressing it here would lose the one thing this view says.
 *
 * Frozen at the SNAPSHOT, not at frame zero — v6.1.3's `useTick` lesson, whose
 * three casualties all froze on the "before" state their simulator existed to
 * move past. Here the snapshot IS the landed state: `elapsed` is 0, sway is at
 * the phase the txid's own age puts it at, and depth is the age the node
 * reported. Nothing is mid-transition.
 */
export function AbyStatic({ field, tracking, onPickTx }: {
  field: AbyField; tracking: Tracking; onPickTx: (id: string) => void;
}) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const m = useChartMetrics(wrapRef);
  const w = m.w || 0;
  const h = abyStageH(w || ABY_H_MIN / ABY_ASPECT);
  const g = abyGeom(w || 1, h);
  const trackedId = tracking?.kind === "tx" ? tracking.id : null;
  const dimming = trackedId != null;
  const ticks = abyDepthTicks(field.maxAgeSec);
  // Hoisted, not computed per label: `spreadLabels` is O(n log n) over the whole
  // ladder, so calling it inside the map would run it once per tick for the same
  // answer. Same gap and same bounds as AbyStage, so the two stages lay their
  // axis out identically.
  const laidYs = spreadLabels(
    ticks.map((t) => abyDepthY(abyDepthUnit(t.sec, field.maxAgeSec), g)),
    14, g.top, Math.max(g.top + 14, g.bottom),
  );

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", height: h, minWidth: 0 }}>
      {m.ready ? (
        <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }} role="img"
          aria-label="Pending transactions by fee brightness and age depth — static">
          <defs>
            <linearGradient id="aby-water" x1="0" y1={g.top} x2="0" y2={g.bottom} gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="var(--b-50)" stopOpacity={0} />
              <stop offset="1" stopColor="var(--b-50)" stopOpacity={0.085} />
            </linearGradient>
          </defs>
          <rect x={g.left - 8} y={g.top} width={Math.max(0, g.right - g.left + 16)}
            height={Math.max(0, g.bottom - g.top)} fill="url(#aby-water)" />
          {ticks.map((t, i) => {
            const y = abyDepthY(abyDepthUnit(t.sec, field.maxAgeSec), g);
            return <line key={`t${t.sec}-${i}`} x1={g.left - 8} y1={y} x2={g.right} y2={y} stroke="var(--line-d)" />;
          })}
          <line x1={g.left - 8} y1={g.top} x2={g.right} y2={g.top} stroke="var(--ink-20)" />
          <line x1={g.left - 8} y1={g.bottom} x2={g.right} y2={g.bottom} stroke="var(--ink-20)" />
          {field.pts.map((p) => {
            const isTracked = trackedId != null && p.id === trackedId;
            const base = abyAlpha(p.lum);
            return (
              <circle
                key={p.id}
                cx={abyX(p, g, p.age)}
                cy={abyDepthY(abyDepthUnit(p.age, field.maxAgeSec), g)}
                r={isTracked ? Math.max(3, p.dot) : p.dot}
                fill={ABY_LUM_TOKENS[p.lum] ?? ABY_LUM_TOKENS[0]}
                fillOpacity={isTracked ? 1 : dimming ? abyDimAlpha(base) : base}
                stroke={isTracked ? "var(--y-50)" : undefined}
                strokeWidth={isTracked ? 1.5 : undefined}
                style={{ cursor: "pointer" }}
                onClick={() => onPickTx(p.id)}
              >
                <title>{`${ShortHash(p.id)} · ${fmtPcn(p.perB)} pcn/B · ${fmtAge(p.age)} · ${p.tier >= 0 ? FEE_TIER_LABELS[p.tier] : "—"}`}</title>
              </circle>
            );
          })}
        </svg>
      ) : null}
      {/* The axis labels are DOM here too, so the two stages read identically
          and scenario 6's collision sweep sees the same nodes in both states. */}
      {m.ready ? ticks.map((t, i) => (
        <span key={`ds${t.sec}-${i}`} className="mono aby-axis"
          style={{ position: "absolute", left: 0, top: laidYs[i] }}>
          {t.label}
        </span>
      )) : null}
    </div>
  );
}
