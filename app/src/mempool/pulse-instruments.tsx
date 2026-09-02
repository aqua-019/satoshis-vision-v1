// mempool/pulse-instruments.tsx — Pulse's geometry and its two stages.
//
// SPLIT OUT OF pulse.tsx at the seam #173 established and p2·7/p2·8 reused
// (instruments vs panels). Read pulse.tsx's header first: the identity, the
// axis inversion against the other eight, the history-source decision and the
// fluid-width argument are recorded there and are not repeated here.
//
// What lives here: the pure geometry (time → x, count → rate height, fee →
// amplitude depth), the window ladder, the binning, the derivation of the field
// and the inferred next-block cut, and the two mutually exclusive stages — the
// animated `<canvas>` and the static SVG twin rendered under
// `prefers-reduced-motion`. What stays in pulse.tsx: the panels, the
// composition and the view itself.
import * as React from "react";
import { canvasCursor } from "@/design/chart-kit";
import { spreadLabels, useChartMetrics } from "@/design/useChartMetrics";
import { shortHash as ShortHash } from "@/data/types";
import { FEE_TIER_LABELS, feeTierIndex } from "@/data/map";
import type { Tracking } from "@/mempool/mempool-shared";
import { useMemCanvas, glowSprite, blitGlow, cssColor } from "@/mempool/useMemCanvas";
import type { MoneroLive } from "@/data/types";
import { freshAt } from "@/data/feed-status";

/** Piconero/byte, rounded and grouped. Declared beside the geometry that
 *  produces the fee axis, the way abyss declares its own. */
export const fmtPcn = (v: number): string => Math.round(v).toLocaleString();

/* ──────────────────────────────────────────────────────────────
   GEOMETRY — pure, exported, and the gates read these rather than
   restating them
   ────────────────────────────────────────────────────────────── */

/** Tier → token, slow → fastest. Contract §4's mapping table, verbatim, and
 *  DECLARED HERE rather than imported from abyss-instruments: a value import
 *  across two lazy view chunks makes Vite hoist a shared chunk for four
 *  strings, which is a bundle change to save a duplication the contract already
 *  fixes by naming the table. Both halves of this stage are tier-coloured, so
 *  unlike Abyss — whose stage has no tier colours at all, its fee axis being a
 *  luminosity ramp — this table IS the stage's fee legend. */
export const PLS_TIER_COLORS = ["var(--c-50)", "var(--o-60)", "var(--o-80)", "var(--y-50)"] as const;

/**
 * THE WINDOW LADDER, in multiples of the node's own block target.
 *
 * The time base of an instrument is a LADDER, not a continuous function of the
 * data — every oscilloscope ever built snaps to 1/2/5 steps, and for the same
 * reason: a continuously-fitted axis re-scales on every sample, so nothing on
 * it can be compared to the frame before it.
 *
 * THE RUNGS ARE BLOCK TARGETS, NOT SECONDS, and that is the whole argument for
 * them being here rather than being a literal. `data.blockTarget` is the node's
 * own `target_seconds`; a rung of 5 means "five blocks' worth of time", which
 * is a real horizon on this chain and stays one on a chain with a different
 * target. A literal 600 would be the mainnet answer hardcoded.
 *
 * THE TOP RUNG IS A CLAMP, AND IT IS THE OUTLIER FIX. `oldest` is a MAX over
 * the pool, so one stuck low-fee transaction from twelve hours ago would
 * otherwise set the domain and crush the recent minutes — the entire readable
 * signal — into 1% of the width. Clamped, that transaction is simply off the
 * left of the window and COUNTED there (see `offWindow`), which is both the
 * honest treatment and the one that keeps the picture readable.
 *
 * THE BOTTOM RUNG IS ONE FULL BLOCK TARGET, AND IT WAS 0.25 UNTIL THE 3-TX
 * RENDER WAS LOOKED AT. With a quarter-target floor, a pool whose oldest
 * transaction is 30 seconds old got a 30-second window — against a future
 * segment one block target wide, which is FOUR TIMES that. The instrument was
 * 80% empty future with two marks crushed into the left fifth, and the time
 * ladder printed "+2m" three times running. No assertion in this repo sees any
 * of that: the view rendered, the numbers were right, nothing overflowed.
 *
 * A window shorter than one block target is also meaningless on its own terms.
 * The quantity this view plots is arrivals against the block cadence, so the
 * shortest honest time base is one full inter-block interval — and at the
 * bottom rung the instrument now reads as exactly that: one block of arrivals
 * behind, one block of waiting ahead.
 */
export const PLS_WINDOW_STEPS = [1, 2, 5, 10, 20, 40] as const;

/** Fallback block target if the node has not answered yet. Same 120 the shared
 *  strip falls back to (mem-stats.tsx's `nextBlockEtaSec`), so the two cannot
 *  disagree about the chain's cadence. */
export const PLS_TARGET_FALLBACK = 120;

/**
 * The visible span of PAST, in seconds: the smallest rung that holds the pool's
 * oldest pending transaction, clamped to the top rung.
 *
 * `oldestAgeSec` IS the shared strip's `oldest`, passed in — see
 * `usePulseField`'s signature and contract §3.
 */
export function plsWindowSec(oldestAgeSec: number | null, blockTargetSec: number): number {
  const T = blockTargetSec > 0 ? blockTargetSec : PLS_TARGET_FALLBACK;
  const want = oldestAgeSec != null && oldestAgeSec > 0 ? oldestAgeSec : 0;
  for (const step of PLS_WINDOW_STEPS) {
    if (T * step >= want) return Math.round(T * step);
  }
  return Math.round(T * PLS_WINDOW_STEPS[PLS_WINDOW_STEPS.length - 1]);
}

/**
 * Bin duration, in seconds.
 *
 * A BIN IS A REAL INTERVAL AND AN EMPTY BIN IS ZERO. Nothing is interpolated,
 * smoothed or carried forward: a second in which no transaction arrived is a
 * column of height 0, drawn as height 0. That is the whole difference between a
 * measurement and a plot of a measurement.
 *
 * The duration is snapped to a ladder of round intervals rather than being
 * `windowSec / columnCount`, so a bin is a number a reader can hold ("bins of
 * 15 s") instead of "bins of 7.31 s". The ladder is chosen to land the column
 * width near PLS_BIN_PX; a narrower stage takes a coarser bin rather than
 * sub-pixel columns.
 */
const BIN_LADDER = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900];
/** Target column pitch in CSS px. Below ~4px a column stops being a column. */
export const PLS_BIN_PX = 7;

export function plsBinSec(windowSec: number, innerW: number): number {
  if (!(windowSec > 0) || !(innerW > 0)) return BIN_LADDER[0];
  const want = windowSec / Math.max(1, innerW / PLS_BIN_PX);
  for (const b of BIN_LADDER) if (b >= want) return b;
  return BIN_LADDER[BIN_LADDER.length - 1];
}

/**
 * Fee → unit interval, log-scaled. 0 at the pool's cheapest, 1 at its dearest.
 *
 * LOG, and derived here rather than inherited: a real pool spans two orders of
 * magnitude (the gate fixture spans 61×, from 15,000 to ~915,000 pcn/B), and on
 * a LINEAR map the whole body of the pool collapses onto the axis with a few
 * outliers hanging off it — a picture of the scale, not of the pool. Orbital
 * makes the argument for a radius and Abyss for a brightness; the quantity here
 * is a vertical amplitude, so the failure it prevents is a flat lower trace.
 *
 * Returns 0 for a degenerate span rather than NaN.
 */
export function plsFeeUnit(perB: number, lo: number, hi: number): number {
  if (!(perB > 0) || !(lo > 0) || !(hi > lo)) return 0;
  const u = (Math.log(perB) - Math.log(lo)) / (Math.log(hi) - Math.log(lo));
  return u < 0 ? 0 : u > 1 ? 1 : u;
}

/**
 * TIME IS LINEAR, AND THIS IS THE ONE PLACE PULSE DELIBERATELY DIVERGES FROM
 * ABYSS AND ORBITAL, both of which put age on a LOG axis.
 *
 * They are right to, and this is right not to, because the two are measuring
 * different things. They plot a DISTRIBUTION — where the pool's mass sits — and
 * a log axis gives the recent minutes the room they earn. This plots a RATE,
 * and a rate is only defined on a uniform time base: "arrivals per second" is
 * meaningless if the seconds have different widths. On a log time axis the same
 * burst is narrow when it is recent and wide when it is old, which destroys the
 * one reading the spec asks this view for — "bursts read as spikes".
 *
 * `tRel` is seconds relative to now: negative in the past, 0 at the present,
 * positive in the future segment.
 */
export function plsX(tRel: number, g: PlsGeom): number {
  const span = g.tMax - g.tMin;
  if (!(span > 0)) return g.left;
  const x = g.left + ((tRel - g.tMin) / span) * (g.right - g.left);
  return x < g.left ? g.left : x > g.right ? g.right : x;
}

/** Short elapsed-time label — the time axis's own vocabulary. Mirrors Abyss's
 *  `fmtAge` so the two views name the same durations the same way. */
export function fmtSpan(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  if (s === 0) return "now";
  // 120, NOT abyss's 90. This formatter labels a TIME AXIS whose ticks are laid
  // on a uniform step, so a rounding boundary inside the step is a COLLISION
  // rather than a loss of precision: at a 30s step and a 120s future segment,
  // a 90 boundary rendered 90/105/120 as "2m", "2m" and "2m" — three ticks a
  // reader cannot tell apart, seen in the 3-tx render. Abyss's ladder is
  // logarithmic and never lands two rungs that close, so the same number is
  // right there and wrong here.
  if (s < 120) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

/** Signed label for a position on the time axis: past reads as an age, future
 *  reads as a countdown. */
export function fmtTimeTick(tRel: number): string {
  if (Math.abs(tRel) < 0.5) return "now";
  return tRel < 0 ? `−${fmtSpan(-tRel)}` : `+${fmtSpan(tRel)}`;
}

/**
 * The time ladder. ONE derivation, three consumers — the canvas gridlines, the
 * DOM labels and the cadence census — so a band in the census is exactly the
 * time between two lines on the stage.
 *
 * The rungs are round intervals of the SAME kind the window ladder is built
 * from, walked outward from `now` into the past, plus `now` itself and the
 * future edge. Stepping outward from now rather than inward from the left edge
 * is what keeps the present on a gridline at every window size — the present is
 * the one instant this view is always about.
 */
const TICK_LADDER = [5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600];
/** Minimum pitch between adjacent time gridlines, in CSS px. */
const TICK_MIN_PX = 58;

export function plsTimeTicks(g: PlsGeom): { t: number; label: string }[] {
  const span = g.tMax - g.tMin;
  const px = g.right - g.left;
  if (!(span > 0) || !(px > 0)) return [{ t: 0, label: "now" }];
  const wantSec = (span / px) * TICK_MIN_PX;
  let step = TICK_LADDER[TICK_LADDER.length - 1];
  for (const s of TICK_LADDER) if (s >= wantSec) { step = s; break; }

  const out: { t: number; label: string }[] = [{ t: 0, label: "now" }];
  for (let t = -step; t >= g.tMin; t -= step) out.unshift({ t, label: fmtTimeTick(t) });
  for (let t = step; t <= g.tMax; t += step) out.push({ t, label: fmtTimeTick(t) });
  return out;
}

/**
 * The rate axis's ceiling: the peak column, rounded UP to a round number so the
 * gridlines land on integers a reader can hold.
 *
 * FLOORED AT 1, not at 0. An empty window is a real state (a quiet minute on a
 * quiet chain) and its axis still has to exist — a ceiling of 0 makes every
 * column NaN-tall and the axis unlabelled, which reads as "broken" rather than
 * as "nothing arrived".
 */
/**
 * FLOORED AT PLS_RATE_MIN, not at 1, and the floor was added after the 3-tx
 * render. A quiet pool peaks at one arrival per bin, so a ceiling of 1 made a
 * SINGLE transaction a full-height column — the sparse state read as two
 * enormous bars rather than as the two small pulses it is, and the rate ladder
 * had exactly one rung on it. A scale is not a claim about the data: an axis
 * that runs to 4 while the peak is 1 says "one arrival, on a scale that goes to
 * four", which is the true reading and the legible one.
 */
export const PLS_RATE_MIN = 4;

export function plsRateCeiling(peak: number): number {
  const p = Math.max(PLS_RATE_MIN, Math.ceil(peak));
  if (p <= 5) return p;
  // Snap up to a 1/2/5-per-decade rung so the ladder below lands on integers a
  // reader can hold. The first version rounded quarters of the raw peak and
  // printed "13 · 25 · 38 · 50" — every one of them true, none of them a number
  // anybody reads off an axis.
  const mag = Math.pow(10, Math.floor(Math.log10(p)));
  for (const m of [1, 2, 4, 5, 10]) {
    if (mag * m >= p) return Math.round(mag * m);
  }
  return Math.round(mag * 10);
}

/**
 * Rate gridlines: integers on a round STEP, up to and including the ceiling.
 * Half a transaction never arrived, so every rung is a whole count.
 *
 * STEPPED, NOT QUARTERED, and the difference is the whole point. Quartering the
 * ceiling was the first version and it survived the ceiling being snapped to a
 * round number, because round numbers do not have round quarters: a ceiling of
 * 50 quartered to 12.5 / 25 / 37.5 / 50 and printed "13 · 25 · 38 · 50" — seen
 * on the burst render, four true readings and not one of them a number anybody
 * reads off an axis. Choosing the STEP first and walking up to the ceiling
 * gives 10 · 20 · 30 · 40 · 50 for the same axis.
 */
export function plsRateTicks(ceiling: number): number[] {
  const c = Math.max(1, Math.round(ceiling));
  if (c <= 5) return Array.from({ length: c }, (_, i) => i + 1);
  let step = 1;
  for (let e = 0; e < 8 && c / step > 5; e++) {
    const mag = Math.pow(10, e);
    for (const m of [1, 2, 5]) {
      const s = m * mag;
      if (s > step && c / s <= 5) { step = s; break; }
      if (s > step) step = s;
    }
  }
  const out: number[] = [];
  for (let v = step; v <= c; v += step) out.push(v);
  if (!out.length || out[out.length - 1] !== c) out.push(c);
  return [...new Set(out)];
}

/**
 * Fee gridlines: round 1/2/5-per-decade values that fall inside the pool's
 * observed span, placed at their TRUE log positions.
 *
 * The first version took fixed quartiles of the log span and labelled whatever
 * fee landed there — "41,838 · 116,696 · 325,492 · 907,870", four six-digit
 * numbers with no relationship to each other. Every one was a true reading of
 * its own gridline and the axis was still unreadable, because an axis is a
 * thing you interpolate against and arbitrary values give a reader nothing to
 * interpolate with. Same quantity, same positions, legible labels.
 *
 * Returns at most five, and never fewer than the two ends when the span is too
 * narrow to hold a round rung — an axis with no labels is worse than one with
 * awkward ones.
 */
export function plsFeeTicks(lo: number, hi: number): number[] {
  if (!(lo > 0) || !(hi > lo)) return [];
  const out: number[] = [];
  const startMag = Math.floor(Math.log10(lo));
  const endMag = Math.ceil(Math.log10(hi));
  for (let e = startMag; e <= endMag; e++) {
    for (const m of [1, 2, 5]) {
      const v = m * Math.pow(10, e);
      if (v >= lo && v <= hi) out.push(v);
    }
  }
  if (out.length < 2) return [lo, hi];
  if (out.length <= 5) return out;
  // Thin evenly rather than dropping the top or the bottom, so the ends survive.
  const step = Math.ceil(out.length / 5);
  const thinned = out.filter((_, i) => i % step === 0);
  if (thinned[thinned.length - 1] !== out[out.length - 1]) thinned.push(out[out.length - 1]);
  return thinned;
}

/* ──────────────────────────────────────────────────────────────
   THE BOX
   ────────────────────────────────────────────────────────────── */

/** CSS px reserved for the left gutter (both axes' DOM labels), the right
 *  inset, and the top/bottom insets of the two traces. */
export const PLS_GUTTER = 72;
export const PLS_EDGE = 16;
export const PLS_PAD_Y = 16;
/** Height reserved BELOW the box for the time-axis labels, which hang off the
 *  centre line and would otherwise be clipped by the canvas edge. */
export const PLS_TIME_LABEL_H = 20;

/**
 * Stage height is DERIVED from the measured width, the shape orbital's
 * `orbStageH` and abyss's `abyStageH` established, so naturalH is a pure
 * function of canvasW rather than a literal that drifts from the composition.
 *
 * Shorter than Abyss's 0.78 because this instrument is WIDE by nature — a time
 * base wants length, not height — and capped at 560 so the desktop composition
 * stays inside the 702px canvas budget the 1440×900 reference gives
 * (`verify-fit`'s `canvasH 702`) with the ramp and caption under it.
 */
export const PLS_ASPECT = 0.52;
export const PLS_H_MIN = 300;
export const PLS_H_MAX = 560;

export function plsStageH(w: number): number {
  return Math.round(Math.max(PLS_H_MIN, Math.min(PLS_H_MAX, w * PLS_ASPECT)));
}

/**
 * THE SPLIT — what fraction of the box sits ABOVE the time axis.
 *
 * The two halves carry different quantities (see pulse.tsx's header), so they
 * are not required to be equal, and they are not: the rate trace is a stack of
 * discrete unit segments and needs the room to keep a unit legible, while the
 * fee trace is a scatter that reads at any height. 0.52 is a near-even split
 * that gives the rate half the extra pixel.
 */
export const PLS_SPLIT = 0.52;

export interface PlsGeom {
  w: number; h: number;
  left: number; right: number;
  /** y of the time axis — the centre line both traces hang off */
  axis: number;
  /** the top of the rate trace (the ceiling) and the bottom of the fee trace */
  rateTop: number; feeBottom: number;
  /** the visible time domain, in seconds relative to now */
  tMin: number; tMax: number;
}

/**
 * THE FUTURE SEGMENT IS ONE BLOCK TARGET WIDE, ALWAYS — NOT THE CURRENT ETA.
 *
 * This is the single most important line in the file's geometry, and the first
 * version had it wrong in a way only the render showed. `tMax` was the live
 * ETA, so the due marker sat at the axis maximum BY CONSTRUCTION: it could
 * never move relative to the box, and instead the whole domain re-scaled every
 * frame as the countdown ran. The marker was pinned to the right edge, the
 * "sweep" the view was designed around did not exist, and — worse — every
 * transaction on the stage drifted continuously for a reason that had nothing
 * to do with it, because the axis under it was rescaling.
 *
 * Fixed at one block target, the domain is STABLE for a whole snapshot and the
 * marker does what it was meant to: `eta` starts near the right edge the moment
 * a block lands and sweeps left toward `now` as the next one becomes due. The
 * bound is exact rather than chosen — `nextBlockEtaSec` is `target - sinceTip`
 * with `sinceTip >= 0`, so `eta <= target` always and the marker is never off
 * the right of the axis.
 *
 * When the tip goes OVERDUE the marker is removed rather than parked on the
 * present (see the draw loop), but the segment itself stays: it is the region
 * where nothing has arrived yet, which is true whether or not a block is late.
 * Keeping it also keeps the axis from jumping the moment a block runs over.
 */
export function plsGeom(w: number, h: number, windowSec: number, blockTargetSec: number): PlsGeom {
  const usable = Math.max(80, h - PLS_TIME_LABEL_H);
  const axis = Math.round(PLS_PAD_Y + (usable - PLS_PAD_Y * 2) * PLS_SPLIT);
  return {
    w, h,
    left: Math.min(PLS_GUTTER, Math.max(16, w * 0.2)),
    right: Math.max(24, w - PLS_EDGE),
    axis,
    rateTop: PLS_PAD_Y,
    feeBottom: Math.max(axis + 20, usable - PLS_PAD_Y),
    tMin: -Math.max(1, windowSec),
    tMax: Math.max(1, blockTargetSec > 0 ? blockTargetSec : PLS_TARGET_FALLBACK),
  };
}

/** Rate count → y, linear from the axis upward. */
export function plsRateY(n: number, ceiling: number, g: PlsGeom): number {
  const c = ceiling > 0 ? ceiling : 1;
  const u = Math.min(1, Math.max(0, n / c));
  return g.axis - u * (g.axis - g.rateTop);
}

/**
 * Fee unit → y, linear from the axis downward. Dearer is DEEPER, so the
 * inferred cut reads as a floor the tips of the trace reach past.
 *
 * BOTH ENDS ARE INSET, and the inset is not decoration. `u` is 0 at the pool's
 * cheapest transaction and 1 at its dearest BY CONSTRUCTION — those are the
 * observed span's own endpoints — so without an inset the cheapest mark is
 * drawn exactly on the time axis and the dearest exactly on the floor rule,
 * where the 1px line hides it. That is not an edge case: EVERY pool has a
 * cheapest and a dearest transaction, so two marks were always invisible, and
 * in the 3-tx render it was two of the three. Found by looking; no assertion
 * here can see a mark drawn underneath a gridline.
 */
export const PLS_FEE_INSET = 7;

export function plsFeeY(u: number, g: PlsGeom): number {
  const v = u < 0 ? 0 : u > 1 ? 1 : u;
  const top = g.axis + PLS_FEE_INSET;
  const bottom = Math.max(top + 1, g.feeBottom - PLS_FEE_INSET);
  return top + v * (bottom - top);
}

/* ──────────────────────────────────────────────────────────────
   DERIVATION — the field, the bins, and the next-block cut
   ────────────────────────────────────────────────────────────── */

export interface PlsArrival {
  id: string;
  perB: number;
  size: number;
  /** age as the node reported it, at the snapshot instant */
  age: number;
  tier: number;
  /** 0..1 log position in the pool's fee span — the AMPLITUDE axis */
  u: number;
  /** rank in the fee-sorted order — shared with the cut, so "rank 12" means the
   *  same thing in the console and on the stage */
  rank: number;
  /** does this tx fit under the node's own weight ceiling, fee-sorted */
  fits: boolean | null;
  /** index into `bins`, or -1 when older than the window */
  bin: number;
}

export interface PlsBin {
  /** seconds relative to the snapshot instant — t0 is the older edge */
  t0: number; t1: number;
  n: number;
  /** arrivals in this bin, fee-sorted dearest first — the stack order */
  txs: PlsArrival[];
}

export interface PlsField {
  /** every pending transaction, fee-sorted dearest first */
  txs: PlsArrival[];
  /** the binned arrival series, oldest bin first. Empty bins are PRESENT with
   *  n === 0 — see plsBinSec's note. */
  bins: PlsBin[];
  windowSec: number;
  binSec: number;
  /** tallest bin, and the axis ceiling derived from it */
  peakN: number;
  rateCeiling: number;
  /** pending transactions older than the window — never dropped silently */
  offWindow: number;
  lo: number; hi: number;
  /** the node's real fee tiers as unit positions on the AMPLITUDE axis */
  tierUnits: { tier: number; perB: number; u: number }[];
  cutIndex: number | null;
  cutPerB: number | null;
  cutU: number | null;
  cumAtCut: number;
  limit: number;
  /** ms epoch of the mempool snapshot these ages were measured at */
  snapAt: number;
  /** the strip's `oldest`, passed in, never re-derived — null when no tx carries an age */
  oldestAgeSec: number | null;
  /** the whole pool, placed or not — `txs` holds only the placeable */
  total: number;
  /** txs whose arrival no clock reported: x IS age, so a timeline cannot
   *  place them. Counted in the cadence panel, never drawn (p4·M9a). */
  unaged: number;
  /** the strip's next-block ETA at the snapshot instant. MAY BE NEGATIVE. */
  etaSec: number;
  blockTargetSec: number;
}

/**
 * The whole derivation, memoised on the fields it reads.
 *
 * `oldestAgeSec` AND `etaSec` ARE PARAMETERS, and that is the point. Contract
 * §3 says a view must not compute its own version of a figure the strip
 * publishes, and this view's two axes are anchored on exactly those two: the
 * window ladder is chosen from `oldest`, and the future segment ends at `eta`.
 * Taking both as arguments makes "the window holds the pool" and "the marker is
 * the strip's ETA" true BY CONSTRUCTION rather than by two implementations
 * agreeing. The spec named this as the view that most needs those two numbers;
 * this signature is what that sentence cashes out as.
 *
 * The cut is the SAME cumulative-weight walk bridge, reactor, orbital and abyss
 * make, derived here rather than imported: each view owns its composition. It
 * is SESSION-computed and labelled inferred — a miner's real template is
 * unobservable from a public node.
 */
export function usePulseField(
  data: MoneroLive,
  oldestAgeSec: number | null,
  etaSec: number,
  innerW: number,
): PlsField {
  return React.useMemo<PlsField>(() => {
    const sorted = [...data.mempool].sort((a, b) => b.perB - a.perB);
    const n = sorted.length;
    const lo = n ? sorted[n - 1].perB : 0;
    const hi = n ? sorted[0].perB : 0;

    const blockTargetSec = data.blockTarget || PLS_TARGET_FALLBACK;
    const windowSec = plsWindowSec(oldestAgeSec, blockTargetSec);
    const binSec = plsBinSec(windowSec, innerW);
    const binCount = Math.max(1, Math.ceil(windowSec / binSec));

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

    // Bins are laid out from NOW backwards, so bin 0 ends exactly at the
    // present and the newest arrival is always at the right edge of the last
    // bin rather than wherever a left-anchored grid happened to land.
    const bins: PlsBin[] = [];
    for (let i = binCount - 1; i >= 0; i--) {
      bins.push({ t0: -(i + 1) * binSec, t1: -i * binSec, n: 0, txs: [] });
    }

    const txs: PlsArrival[] = [];
    let offWindow = 0;
    let unaged = 0;
    for (let i = 0; i < n; i++) {
      const t = sorted[i];
      // The cut walk above ran over the WHOLE fee-sorted pool; only the
      // placing is age-bound.
      if (t.age == null) { unaged++; continue; }
      // Bin index counted back from now: age 0 lands in the newest bin.
      const k = Math.floor(t.age / binSec);
      const idx = k >= 0 && k < binCount ? binCount - 1 - k : -1;
      const a: PlsArrival = {
        id: t.id,
        perB: t.perB,
        size: t.size,
        age: t.age,
        tier: feeTierIndex(t.perB, data.feeTiers),
        u: plsFeeUnit(t.perB, lo, hi),
        rank: i,
        fits: cutIndex == null ? null : i < cutIndex,
        bin: idx,
      };
      txs.push(a);
      if (idx < 0) offWindow++;
      else { bins[idx].txs.push(a); bins[idx].n++; }
    }

    const peakN = bins.reduce((m, b) => (b.n > m ? b.n : m), 0);

    // The node's own tier boundaries, placed on the same log amplitude axis.
    // Only the three interior boundaries are node values; the ends are the
    // observed span, which is why they are not listed as tiers.
    const tierUnits = data.feeTiers.length === 4
      ? [1, 2, 3].map((k) => ({ tier: k, perB: data.feeTiers[k], u: plsFeeUnit(data.feeTiers[k], lo, hi) }))
      : [];

    const cutPerB = cutIndex != null && cutIndex > 0 && cutIndex < n ? sorted[cutIndex].perB : null;

    return {
      txs, bins, windowSec, binSec,
      peakN, rateCeiling: plsRateCeiling(peakN),
      offWindow, lo, hi, tierUnits,
      cutIndex, cutPerB,
      cutU: cutPerB == null ? null : plsFeeUnit(cutPerB, lo, hi),
      cumAtCut, limit,
      snapAt: freshAt(data.status.mempool),
      oldestAgeSec, etaSec, blockTargetSec,
      total: n,
      unaged,
    };
  }, [
    data.mempool, data.feeTiers, data.blockWeightMedian, data.blockWeightLimit,
    data.status.mempool, data.blockTarget, oldestAgeSec, etaSec, innerW,
  ]);
}

/* ──────────────────────────────────────────────────────────────
   THE STAGE — canvas geometry + DOM labels
   ────────────────────────────────────────────────────────────── */

/** Height of one arrival's segment in the rate stack, as a fraction of the
 *  rate half-height, before the ceiling scales it. Segments are separated by a
 *  1px hairline so a column of three reads as three. */
const SEG_GAP = 1;
/** Radius of an arrival's mark in the fee trace. A LEGIBILITY FLOOR, the same
 *  class of rule as Abyss's DOT_R_MIN: below this a mark stops being a mark
 *  regardless of what it faithfully reports. */
const FEE_DOT_R = 2.1;

/**
 * The STATIC half of the stage — the two traces' backing washes and the frame —
 * cached to an offscreen canvas and blitted.
 *
 * Same cache-key discipline as `glowSprite` and `abyBackground`: the key holds
 * the RESOLVED colours, never the token names, because a token string does not
 * change when the theme does — only what it resolves to. Keying on the name
 * would serve the first theme's pixels forever.
 *
 * The gridlines are deliberately NOT in here. Both ladders move with the data
 * (the time ladder with the window rung, the rate ladder with the peak), so
 * caching them would either thrash the cache every poll or blit a stale axis.
 */
const PLS_BG = new Map<string, HTMLCanvasElement>();

function plsBackground(g: PlsGeom, dpr: number): HTMLCanvasElement | null {
  const cool = cssColor("var(--b-50)");
  const ink20 = cssColor("var(--ink-20)");
  const key = [Math.round(g.w), Math.round(g.h), Math.round(g.axis), dpr.toFixed(2), cool, ink20].join("|");
  const hit = PLS_BG.get(key);
  if (hit) return hit;

  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(g.w * dpr));
  c.height = Math.max(1, Math.round(g.h * dpr));
  const x = c.getContext("2d");
  if (!x) return null;
  x.setTransform(dpr, 0, 0, dpr, 0, 0);

  const w = Math.max(0, g.right - g.left);
  // The rate field: a cool wash fading upward from the axis.
  const up = x.createLinearGradient(0, g.axis, 0, g.rateTop);
  up.addColorStop(0, cool);
  up.addColorStop(1, "transparent");
  x.globalAlpha = 0.07;
  x.fillStyle = up;
  x.fillRect(g.left, g.rateTop, w, Math.max(0, g.axis - g.rateTop));
  // The fee field: the same wash fading downward, so the two halves read as one
  // instrument hinged on the axis rather than as two stacked charts.
  const down = x.createLinearGradient(0, g.axis, 0, g.feeBottom);
  down.addColorStop(0, cool);
  down.addColorStop(1, "transparent");
  x.fillStyle = down;
  x.fillRect(g.left, g.axis, w, Math.max(0, g.feeBottom - g.axis));
  x.globalAlpha = 1;

  // The three edges of the instrument.
  x.strokeStyle = ink20;
  x.lineWidth = 1;
  x.beginPath();
  x.moveTo(g.left, Math.round(g.rateTop) + 0.5);
  x.lineTo(g.right, Math.round(g.rateTop) + 0.5);
  x.moveTo(g.left, Math.round(g.feeBottom) + 0.5);
  x.lineTo(g.right, Math.round(g.feeBottom) + 0.5);
  x.stroke();

  if (PLS_BG.size > 12) PLS_BG.clear();
  PLS_BG.set(key, c);
  return c;
}

/** x of an arrival at a given elapsed-since-snapshot, in the geom's space. */
export function plsArrivalX(a: PlsArrival, g: PlsGeom, elapsed: number): number {
  return plsX(-(a.age + elapsed), g);
}

/** Half-width allowance for the two floating labels, in CSS px. Not measured —
 *  a bound: both are short mono strings, and the flip below only has to be
 *  right about WHICH SIDE has room. */
const LABEL_HALF = 62;

/**
 * Which way a marker's label should hang from its own line.
 *
 * BOTH FLOATING LABELS RIDE A VERTICAL RULE that can sit anywhere on the axis,
 * including hard against an edge, and a centred label then runs off the stage.
 * Found by looking at 390, where the stage is 280px wide and the block-due
 * marker sits near the right edge for most of a block interval: the label read
 * "block du", clipped by the panel. Nothing asserts on it — it is a canvas
 * overlay, its text is DOM, and neither the collision sweep nor the overflow
 * check fires on a label clipped by an ancestor's box.
 *
 * Centred in the middle, hung inward at either end. The line does not move; only
 * the label does, so the reading stays exact.
 */
export function plsLabelShift(x: number, g: PlsGeom): string {
  if (x > g.right - LABEL_HALF) return "translateX(-100%)";
  if (x < g.left + LABEL_HALF) return "translateX(0)";
  return "translateX(-50%)";
}

/**
 * The pulse stage.
 *
 * PER-FRAME COST IS BOUNDED BY CONSTRUCTION, and the bound is a constant rather
 * than a function of pool depth — Abyss's standard, met by the same mechanism
 * applied to two traces instead of one:
 *
 *   1 blit (the cached washes)
 *   + T strokes for the time ladder, T ≤ 12, and R ≤ 4 for the rate ladder
 *   + at most 4 `fill()` calls for the WHOLE rate stack (one per fee tier)
 *   + at most 4 `fill()` calls for the WHOLE fee scatter (one per fee tier)
 *   + 3 strokes for the cut, the present and the due marker
 *   + at most 1 glow blit + 3 strokes for the tracked transaction.
 *
 * The four is the TIER doing the work Abyss's luminosity bucket does: fill
 * colour is a pure function of the tier alone, so every segment and every mark
 * in a tier shares one path. 240 transactions is eight fills across both
 * traces; 2,400 would also be eight.
 *
 * Colours are resolved ONCE per frame, not per mark — `cssColor` reads
 * getComputedStyle. `ctx.shadowBlur` is banned in src/mempool and gated
 * (verify-memshell §4d); the tracked glow is a memoised sprite.
 */
export function PlsStage({ field, tracking, onPickTx, onMeasure }: {
  field: PlsField; tracking: Tracking; onPickTx: (id: string) => void;
  onMeasure: (innerW: number) => void;
}) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  // FLUID mode (no vbWidth) so k === 1 — contract §2. The host renders
  // unconditionally, never `null`, which is the v6.0.12 rule that keeps the ref
  // attached from the first render.
  const m = useChartMetrics(wrapRef);
  const w = m.w || 0;
  const h = plsStageH(w || PLS_H_MIN / PLS_ASPECT);

  const trackedId = tracking?.kind === "tx" ? tracking.id : null;

  const fieldRef = React.useRef(field);
  fieldRef.current = field;
  const trackedRef = React.useRef<string | null>(trackedId);
  trackedRef.current = trackedId;

  /**
   * The tracked cursor's DOM label, written by the DRAW LOOP.
   *
   * Not React state, and not a render-time `left`. The window rolls
   * continuously (every arrival's x is a function of `age + elapsed`,
   * wall-clock) while React only re-renders on a 3s feed tick, so a render-time
   * position drifts from the mark it names — the same failure Abyss measured at
   * ~19px over one poll window, on the other axis. One style write per frame
   * for one element is what `Orb.tsx` does on its own tick; the repo's rule is
   * "never `setState` per frame; mutate refs or DOM attributes" (contract §5)
   * and this is the second half of that sentence.
   */
  const markRef = React.useRef<HTMLSpanElement>(null);
  /** The due marker's DOM label — same discipline, and it moves FASTER than
   *  anything else on the stage: the ETA counts down in real time, so this
   *  label sweeps toward the present continuously. */
  const dueRef = React.useRef<HTMLSpanElement>(null);

  // The bin width depends on the measured inner width, so the derivation needs
  // it. Reported upward rather than measured twice — the field is memoised on
  // it, so a resize re-bins and a re-render does not.
  const innerW = Math.max(1, Math.round((w || 1) - Math.min(PLS_GUTTER, Math.max(16, (w || 1) * 0.2)) - PLS_EDGE));
  React.useEffect(() => { onMeasure(innerW); }, [innerW, onMeasure]);

  const draw = React.useCallback((ctx: CanvasRenderingContext2D, cw: number, ch: number) => {
    const f = fieldRef.current;
    ctx.clearRect(0, 0, cw, ch);

    // ── WALL CLOCK ──
    //
    // Deliberately `Date.now()` and not `useMemCanvas`'s elapsed `t`, the same
    // argument orbital and abyss both record: the hook's clock freezes while
    // the tab is hidden or the canvas is scrolled off, which is right for
    // decorative motion and wrong for a coordinate derived from real time. The
    // window advances because the WORLD does, so a tab hidden for ten minutes
    // resumes with the waveform ten minutes further along rather than where it
    // was parked. A stale reading rendered as a live one is the ALL-REAL-DATA
    // invariant broken by an animation detail.
    const elapsed = f.snapAt > 0 ? (Date.now() - f.snapAt) / 1000 : 0;
    // The future segment shrinks as the block becomes due — this is the only
    // quantity on the stage that moves fast enough to watch.
    const g = plsGeom(cw, ch, f.windowSec, f.blockTargetSec);

    const bg = plsBackground(g, Math.min(window.devicePixelRatio || 1, 2));
    if (bg) ctx.drawImage(bg, 0, 0, cw, ch);

    // ── the ladders ──
    const lineD = cssColor("var(--line-d)");
    ctx.strokeStyle = lineD;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const t of plsTimeTicks(g)) {
      const x = Math.round(plsX(t.t, g)) + 0.5;
      ctx.moveTo(x, g.rateTop);
      ctx.lineTo(x, g.feeBottom);
    }
    for (const n of plsRateTicks(f.rateCeiling)) {
      const y = Math.round(plsRateY(n, f.rateCeiling, g)) + 0.5;
      ctx.moveTo(g.left, y);
      ctx.lineTo(g.right, y);
    }
    ctx.stroke();

    // The node's own fee-tier boundaries, on the amplitude axis. Real node
    // values, so they are drawn as data rather than as chrome.
    if (f.tierUnits.length) {
      ctx.strokeStyle = cssColor("var(--ink-20)");
      ctx.beginPath();
      for (const t of f.tierUnits) {
        const y = Math.round(plsFeeY(t.u, g)) + 0.5;
        ctx.moveTo(g.left, y);
        ctx.lineTo(g.right, y);
      }
      ctx.stroke();
    }

    const tracked = trackedRef.current;
    let trackedAt: { x: number; yFee: number; tier: number; a: PlsArrival } | null = null;

    const fills = PLS_TIER_COLORS.map((c) => cssColor(c));
    const colW = Math.max(
      1.5,
      ((g.right - g.left) / Math.max(1, (g.tMax - g.tMin) / f.binSec)) - SEG_GAP,
    );

    // ── THE RATE TRACE (above the axis) ──
    //
    // One segment per arrival, stacked, batched by tier: the column's HEIGHT is
    // exactly the arrival count, so the axis ticks are honest integers, and its
    // COLOUR COMPOSITION is the fee mix of that burst. A tall cyan column and a
    // tall gold one are the same number of transactions and a very different
    // event.
    const segH = (g.axis - g.rateTop) / Math.max(1, f.rateCeiling);
    const byTierRate: number[][] = [[], [], [], []];
    for (const b of f.bins) {
      if (!b.n) continue;                       // an empty bin is zero, drawn as zero
      // Bins carry a fixed offset from now at the snapshot; the whole grid
      // rolls left with `elapsed` exactly as the arrivals do, so a column and
      // the transactions inside it can never separate.
      //
      // ROLLED OUT OF THE WINDOW IS DROPPED, NOT CLAMPED. `plsX` clamps to the
      // box — a safety net for the geometry — so without this guard a column
      // that has rolled past the left edge would be PAINTED ON THE BORDER, at a
      // time it did not arrive. It is a small fabrication and a rare one (the
      // window is a rung chosen to hold the pool, so it only bites at the bottom
      // rung, where a 120s window and a 118s-old transaction leave two seconds
      // of headroom before the next poll re-anchors), and it is a fabrication
      // all the same: the honest picture is that the arrival has left the
      // window, which is what a rolling window does.
      if (b.t1 - elapsed < g.tMin) continue;
      const x = plsX(b.t1 - elapsed, g) - colW;
      // Dearest at the TOP of the stack: the tip of every column is its dearest
      // arrival, which is what makes "the next block is the tips" a reading
      // rather than a slogan.
      for (let k = 0; k < b.txs.length; k++) {
        const a = b.txs[b.txs.length - 1 - k];  // cheapest first, from the axis up
        const tier = a.tier >= 0 ? a.tier : 0;
        const y0 = g.axis - (k + 1) * segH;
        byTierRate[tier].push(x, y0 + SEG_GAP / 2, colW, Math.max(0.75, segH - SEG_GAP));
      }
    }
    for (let t = 0; t < 4; t++) {
      const rects = byTierRate[t];
      if (!rects.length) continue;
      ctx.fillStyle = fills[t];
      ctx.globalAlpha = 0.92;
      ctx.beginPath();
      for (let i = 0; i < rects.length; i += 4) {
        ctx.rect(rects[i], rects[i + 1], rects[i + 2], rects[i + 3]);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ── THE FEE TRACE (below the axis) ──
    //
    // One mark per arrival at its own log fee/byte amplitude. Per-transaction,
    // never aggregated — the upper trace is where the counting happens, so this
    // one is free to keep every transaction's exact fee.
    const byTierFee: number[][] = [[], [], [], []];
    for (const a of f.txs) {
      if (a.bin < 0) continue;                  // older than the window — counted, not drawn
      if (-(a.age + elapsed) < g.tMin) continue; // rolled out since the snapshot — see the rate trace
      const x = plsArrivalX(a, g, elapsed);
      const y = plsFeeY(a.u, g);
      const tier = a.tier >= 0 ? a.tier : 0;
      byTierFee[tier].push(x, y);
      if (tracked != null && a.id === tracked) trackedAt = { x, yFee: y, tier, a };
    }
    for (let t = 0; t < 4; t++) {
      const pts = byTierFee[t];
      if (!pts.length) continue;
      ctx.fillStyle = fills[t];
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      for (let i = 0; i < pts.length; i += 2) {
        ctx.moveTo(pts[i] + FEE_DOT_R, pts[i + 1]);   // or arc() joins to the previous circle
        ctx.arc(pts[i], pts[i + 1], FEE_DOT_R, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ── THE INFERRED CUT ──
    // A horizontal floor across the fee trace: everything reaching PAST it is
    // in the next block. Orbital's cut is a ring and Abyss's is a brightness;
    // this one is a threshold the marks visibly cross, which is the reading a
    // time-domain instrument makes available and the other two cannot.
    if (f.cutU != null) {
      const y = Math.round(plsFeeY(f.cutU, g)) + 0.5;
      ctx.strokeStyle = cssColor("var(--g-50)");
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(g.left, y);
      ctx.lineTo(g.right, y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ── THE PRESENT, and the block that is due ──
    const xNow = Math.round(plsX(0, g)) + 0.5;
    ctx.strokeStyle = cssColor("var(--ink-60)");
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xNow, g.rateTop);
    ctx.lineTo(xNow, g.feeBottom);
    ctx.stroke();

    // The future segment carries NO data and says so: nothing has arrived yet.
    // It is the only region in the mempool suite that is deliberately empty.
    const etaNow = f.etaSec - elapsed;
    if (etaNow > 0) {
      const xDue = Math.round(plsX(etaNow, g)) + 0.5;
      ctx.fillStyle = cssColor("var(--p-50)");
      ctx.globalAlpha = 0.05;
      ctx.fillRect(xNow, g.rateTop, Math.max(0, xDue - xNow), g.feeBottom - g.rateTop);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = cssColor("var(--p-50)");
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(xDue, g.rateTop);
      ctx.lineTo(xDue, g.feeBottom);
      ctx.stroke();
      ctx.setLineDash([]);
      if (dueRef.current) {
        dueRef.current.style.left = `${xDue}px`;
        dueRef.current.style.transform = plsLabelShift(xDue, g);
        dueRef.current.style.display = "";
      }
    } else if (dueRef.current) {
      // Overdue: the due instant has fallen off the right of the axis, which is
      // the honest picture — there is no future segment to mark. The panel
      // still reports "+N overdue"; parking a marker on the present would
      // assert a block is arriving now, for as long as the wait lasts.
      dueRef.current.style.display = "none";
    }

    // ── THE TRACKED ARRIVAL ──
    // A CURSOR ON THE TIMELINE: a full-height rule at the instant it arrived,
    // its fee mark lit, and a DOM label riding the same x so the label, the
    // rule and the mark cannot disagree.
    if (trackedAt) {
      const x = Math.round(trackedAt.x) + 0.5;
      ctx.strokeStyle = cssColor("var(--y-50)");
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, g.rateTop);
      ctx.lineTo(x, g.feeBottom);
      ctx.stroke();

      blitGlow(ctx, glowSprite("var(--y-50)", 14), trackedAt.x, trackedAt.yFee, 0.7);
      ctx.beginPath();
      ctx.arc(trackedAt.x, trackedAt.yFee, Math.max(3, FEE_DOT_R + 1), 0, Math.PI * 2);
      ctx.fillStyle = fills[trackedAt.tier];
      ctx.fill();
      ctx.beginPath();
      ctx.arc(trackedAt.x, trackedAt.yFee, 6.5, 0, Math.PI * 2);
      ctx.strokeStyle = cssColor("var(--y-50)");
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.lineWidth = 1;

      if (markRef.current) {
        markRef.current.style.left = `${trackedAt.x}px`;
        markRef.current.style.transform = plsLabelShift(trackedAt.x, g);
      }
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
    const f = fieldRef.current;
    const elapsed = f.snapAt > 0 ? (Date.now() - f.snapAt) / 1000 : 0;
    const g = plsGeom(el.clientWidth, el.clientHeight, f.windowSec, f.blockTargetSec);
    let best: { id: string; d2: number } | null = null;
    for (const a of f.txs) {
      if (a.bin < 0) continue;
      // Same roll-out guard as the draw loop. The two must agree, or a click
      // resolves to a transaction the stage has stopped painting.
      if (-(a.age + elapsed) < g.tMin) continue;
      const x = plsArrivalX(a, g, elapsed);
      // The fee mark is the unambiguous target: one mark per transaction, where
      // a rate segment is one of a stack whose members share an x.
      const dx = x - c.x;
      const dy = plsFeeY(a.u, g) - c.y;
      const d2 = dx * dx + dy * dy;
      // TOLERANCE, AND THE CLASS IT CANNOT SEE (§9). `hit` is generous for
      // thumbs, so it is also the largest coordinate-space error this test can
      // absorb silently. The units are traced by construction instead: the draw
      // loop and this test both consume `el.clientWidth/clientHeight`, both call
      // the same plsGeom/plsArrivalX/plsFeeY, and both derive `elapsed` the same
      // way — there is no second derivation to disagree. `useMemCanvas` folds
      // DPR into the context transform, never into the coordinates either path
      // sees.
      const hit = 10;
      if (d2 <= hit * hit && (!best || d2 < best.d2)) best = { id: a.id, d2 };
    }
    if (best) onPickTx(best.id);
  }, [onPickTx]);

  const g = plsGeom(w || 1, h, field.windowSec, field.blockTargetSec);
  const trackedA = trackedId ? field.txs.find((a) => a.id === trackedId) : undefined;

  /* AXIS LABELS ARE DOM, NOT CANVAS TEXT — orbital's reasoning, applied to a
   * third pair of axes. Canvas glyphs are invisible to verify-legibility, to
   * verify-memviews scenario 6's collision sweep and to its sub-12px SVG check,
   * three gates whose nominal subject includes this view; authoring text into
   * that blind spot buys a prettier stage at the cost of every gate that reads
   * text. The canvas draws geometry only.
   *
   * `spreadLabels` separates the two VERTICAL ladders for the reason orbital's
   * ring labels needed it — the rate ceiling can be small enough that its ticks
   * crowd — while the TIME labels are laid out on a uniform step by
   * construction (plsTimeTicks walks a fixed interval) and cannot collide, so
   * they are not spread. */
  const rateTicks = plsRateTicks(field.rateCeiling);
  const rateYs = spreadLabels(
    rateTicks.map((n) => plsRateY(n, field.rateCeiling, g)),
    13, g.rateTop, Math.max(g.rateTop + 13, g.axis - 2),
  );
  const feeTicks = plsFeeTicks(field.lo, field.hi).map((perB) => ({ perB, u: plsFeeUnit(perB, field.lo, field.hi) }));
  const feeYs = spreadLabels(
    feeTicks.map((t) => plsFeeY(t.u, g)),
    13, g.axis + 2, Math.max(g.axis + 15, g.feeBottom),
  );
  const timeTicks = plsTimeTicks(g);

  return (
    <div
      ref={wrapRef}
      className="pls-stage"
      style={{ position: "relative", width: "100%", height: h, minWidth: 0 }}
    >
      <canvas
        ref={ref}
        className="mem-canvas"
        role="img"
        aria-label="Pending transactions in the time domain — arrival rate above the axis, fee rate below it"
        onClick={onClick}
        style={{ cursor: "pointer" }}
      />
      {/* Axis labels. Absolutely positioned, so they contribute nothing to
          `.mp-view`'s max-content. */}
      {m.ready ? rateTicks.map((n, i) => (
        <span key={`r${n}`} className="mono pls-axis" style={{ position: "absolute", left: 0, top: rateYs[i] }}>
          {n.toLocaleString()}
        </span>
      )) : null}
      {m.ready ? feeTicks.map((t, i) => (
        <span key={`f${t.perB}`} className="mono pls-axis" style={{ position: "absolute", left: 0, top: feeYs[i] }}>
          {fmtPcn(t.perB)}
        </span>
      )) : null}
      {m.ready ? timeTicks.map((t) => (
        <span key={`t${t.t}`} className="mono pls-axis pls-axis--t"
          style={{ position: "absolute", left: plsX(t.t, g), top: g.feeBottom + 4 }}>
          {t.label}
        </span>
      )) : null}
      {/* The due marker's label. Rendered whenever a block is DUE later than
          now; the draw loop hides it the moment the tip goes overdue, because
          an overdue block has no instant on this axis to mark.
          IT SITS AT THE BOTTOM OF THE PLOT, INSIDE THE FUTURE BAND, and the
          band is the reason: nothing is ever drawn to the right of `now`, so a
          label there can occlude no data at any pool size — the one region of
          this stage where that is true by construction rather than by luck.
          It started on the top row beside the tracked cursor's label and the
          two collided the moment a recent transaction was tracked, which is the
          COMMON case (the newest arrival is nearest the present, and so is the
          due marker). Seen at 390 on the tracked render; both labels carry an
          opaque background, so the collision read as one string overwriting the
          other rather than as anything a gate could notice. */}
      {m.ready && field.etaSec > 0 ? (
        <span ref={dueRef} className="mono pls-due"
          style={{ position: "absolute", left: plsX(field.etaSec, g), top: g.feeBottom - 16, transform: plsLabelShift(plsX(field.etaSec, g), g) }}>
          block due
        </span>
      ) : null}
      {/* THE TRACKED IDIOM'S DOM ANCHOR.
          `data-track-idiom` here as well as on MemTxTable's row, because the
          highlight this view makes is a canvas one and verify-tracking §1's
          positive control requires the count to be 0 BEFORE a search — which it
          is, since this whole node is mounted only while a tx is tracked.
          The label names the ARRIVAL INSTANT, which is the reading the cursor
          is there to give. */}
      {m.ready && trackedA ? (
        <span
          ref={markRef}
          className="mono pls-track"
          data-track-idiom="pulse"
          data-tracked-tx={trackedA.id}
          style={{
            position: "absolute", top: g.rateTop + 2,
            // Seed only — the draw loop owns both of these from the first frame.
            left: plsX(-trackedA.age, g),
            transform: plsLabelShift(plsX(-trackedA.age, g), g),
          }}
        >
          arrived {fmtSpan(trackedA.age)} ago · {fmtPcn(trackedA.perB)}
        </span>
      ) : null}
    </div>
  );
}

/**
 * The reduced-motion twin: the same two traces, frozen at the instant the feed
 * last reported, as SVG.
 *
 * NOT a paused canvas. `verify-memviews` scenario 3 asserts ZERO
 * `canvas.mem-canvas` under `prefers-reduced-motion`, and contract §6 requires
 * the static equivalent to carry the same DATA and the same CLICK TARGETS — so
 * every transaction is a real `<circle>` with its own handler, not a decorative
 * still.
 *
 * Frozen at the SNAPSHOT, not at frame zero — v6.1.3's `useTick` lesson, whose
 * three casualties all froze on the "before" state their simulator existed to
 * move past. Here the snapshot IS the landed state: `elapsed` is 0, every
 * arrival sits at the age the node reported, and the due marker sits at the ETA
 * the strip publishes. Nothing is mid-transition, and a reader loses the roll —
 * which is motion — but not one number.
 */
export function PlsStatic({ field, tracking, onPickTx, onMeasure }: {
  field: PlsField; tracking: Tracking; onPickTx: (id: string) => void;
  onMeasure: (innerW: number) => void;
}) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const m = useChartMetrics(wrapRef);
  const w = m.w || 0;
  const h = plsStageH(w || PLS_H_MIN / PLS_ASPECT);
  const g = plsGeom(w || 1, h, field.windowSec, field.blockTargetSec);
  const trackedId = tracking?.kind === "tx" ? tracking.id : null;

  /* The static twin reports its measured box too. Without this the bin width
     would be frozen at the seed under `prefers-reduced-motion`, so the two
     stages would bin the SAME pool differently and scenario 3's reduced-motion
     pass would be measuring a composition no animated render ever produces. */
  const innerW = Math.max(1, Math.round((w || 1) - Math.min(PLS_GUTTER, Math.max(16, (w || 1) * 0.2)) - PLS_EDGE));
  React.useEffect(() => { onMeasure(innerW); }, [innerW, onMeasure]);

  const rateTicks = plsRateTicks(field.rateCeiling);
  const rateYs = spreadLabels(
    rateTicks.map((n) => plsRateY(n, field.rateCeiling, g)),
    13, g.rateTop, Math.max(g.rateTop + 13, g.axis - 2),
  );
  const feeTicks = plsFeeTicks(field.lo, field.hi).map((perB) => ({ perB, u: plsFeeUnit(perB, field.lo, field.hi) }));
  const feeYs = spreadLabels(
    feeTicks.map((t) => plsFeeY(t.u, g)),
    13, g.axis + 2, Math.max(g.axis + 15, g.feeBottom),
  );
  const timeTicks = plsTimeTicks(g);
  /* Resolved ONCE. The tracked cursor, its label and the label's edge-flip all
     need the same arrival, and looking it up per use put six linear scans over
     the whole pool into one render. */
  const trackedA = trackedId != null ? field.txs.find((a) => a.id === trackedId && a.bin >= 0) : undefined;
  const trackedX = trackedA ? plsX(-trackedA.age, g) : 0;
  const segH = (g.axis - g.rateTop) / Math.max(1, field.rateCeiling);
  const colW = Math.max(1.5, ((g.right - g.left) / Math.max(1, (g.tMax - g.tMin) / field.binSec)) - SEG_GAP);
  const etaNow = field.etaSec;

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", height: h, minWidth: 0 }}>
      {m.ready ? (
        <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }} role="img"
          aria-label="Pending transactions in the time domain — arrival rate above the axis, fee rate below it, static">
          <defs>
            <linearGradient id="pls-up" x1="0" y1={g.axis} x2="0" y2={g.rateTop} gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="var(--b-50)" stopOpacity={0.07} />
              <stop offset="1" stopColor="var(--b-50)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="pls-down" x1="0" y1={g.axis} x2="0" y2={g.feeBottom} gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="var(--b-50)" stopOpacity={0.07} />
              <stop offset="1" stopColor="var(--b-50)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <rect x={g.left} y={g.rateTop} width={Math.max(0, g.right - g.left)} height={Math.max(0, g.axis - g.rateTop)} fill="url(#pls-up)" />
          <rect x={g.left} y={g.axis} width={Math.max(0, g.right - g.left)} height={Math.max(0, g.feeBottom - g.axis)} fill="url(#pls-down)" />
          {timeTicks.map((t) => (
            <line key={`gt${t.t}`} x1={plsX(t.t, g)} y1={g.rateTop} x2={plsX(t.t, g)} y2={g.feeBottom} stroke="var(--line-d)" />
          ))}
          {rateTicks.map((n) => (
            <line key={`gr${n}`} x1={g.left} y1={plsRateY(n, field.rateCeiling, g)} x2={g.right} y2={plsRateY(n, field.rateCeiling, g)} stroke="var(--line-d)" />
          ))}
          {field.tierUnits.map((t) => (
            <line key={`gf${t.tier}`} x1={g.left} y1={plsFeeY(t.u, g)} x2={g.right} y2={plsFeeY(t.u, g)} stroke="var(--ink-20)" />
          ))}
          <line x1={g.left} y1={g.rateTop} x2={g.right} y2={g.rateTop} stroke="var(--ink-20)" />
          <line x1={g.left} y1={g.feeBottom} x2={g.right} y2={g.feeBottom} stroke="var(--ink-20)" />
          {/* the rate trace */}
          {/* flatMap, not a nested map: the outer level would otherwise be an
              array OF ARRAYS, which React treats as keyless fragments and warns
              about even though every <rect> inside carries a key. */}
          {field.bins.flatMap((b) => b.txs.map((_, k) => {
            const a = b.txs[b.txs.length - 1 - k];   // cheapest first, from the axis up
            return (
              <rect key={a.id} x={plsX(b.t1, g) - colW} y={g.axis - (k + 1) * segH + SEG_GAP / 2}
                width={colW} height={Math.max(0.75, segH - SEG_GAP)}
                fill={PLS_TIER_COLORS[a.tier >= 0 ? a.tier : 0]} fillOpacity={0.92} />
            );
          }))}
          {/* the fee trace — one clickable mark per transaction */}
          {field.txs.filter((a) => a.bin >= 0).map((a) => {
            const isTracked = trackedId != null && a.id === trackedId;
            return (
              <circle key={a.id} cx={plsX(-a.age, g)} cy={plsFeeY(a.u, g)}
                r={isTracked ? 3.4 : FEE_DOT_R}
                fill={PLS_TIER_COLORS[a.tier >= 0 ? a.tier : 0]}
                fillOpacity={isTracked ? 1 : 0.8}
                stroke={isTracked ? "var(--y-50)" : undefined}
                strokeWidth={isTracked ? 1.5 : undefined}
                style={{ cursor: "pointer" }}
                onClick={() => onPickTx(a.id)}>
                <title>{`${ShortHash(a.id)} · ${fmtPcn(a.perB)} pcn/B · arrived ${fmtSpan(a.age)} ago · ${a.tier >= 0 ? FEE_TIER_LABELS[a.tier] : "—"}`}</title>
              </circle>
            );
          })}
          {field.cutU != null ? (
            <line x1={g.left} y1={plsFeeY(field.cutU, g)} x2={g.right} y2={plsFeeY(field.cutU, g)}
              stroke="var(--g-50)" strokeDasharray="4 3" />
          ) : null}
          <line x1={plsX(0, g)} y1={g.rateTop} x2={plsX(0, g)} y2={g.feeBottom} stroke="var(--ink-60)" />
          {etaNow > 0 ? (
            <>
              <rect x={plsX(0, g)} y={g.rateTop} width={Math.max(0, plsX(etaNow, g) - plsX(0, g))}
                height={g.feeBottom - g.rateTop} fill="var(--p-50)" fillOpacity={0.05} />
              <line x1={plsX(etaNow, g)} y1={g.rateTop} x2={plsX(etaNow, g)} y2={g.feeBottom}
                stroke="var(--p-50)" strokeDasharray="2 3" />
            </>
          ) : null}
          {trackedA ? (
            <line x1={trackedX} y1={g.rateTop} x2={trackedX} y2={g.feeBottom} stroke="var(--y-50)" />
          ) : null}
        </svg>
      ) : null}
      {/* The axis labels are DOM here too, so the two stages read identically
          and scenario 6's collision sweep sees the same nodes in both states. */}
      {m.ready ? rateTicks.map((n, i) => (
        <span key={`sr${n}`} className="mono pls-axis" style={{ position: "absolute", left: 0, top: rateYs[i] }}>{n.toLocaleString()}</span>
      )) : null}
      {m.ready ? feeTicks.map((t, i) => (
        <span key={`sf${t.perB}`} className="mono pls-axis" style={{ position: "absolute", left: 0, top: feeYs[i] }}>{fmtPcn(t.perB)}</span>
      )) : null}
      {m.ready ? timeTicks.map((t) => (
        <span key={`st${t.t}`} className="mono pls-axis pls-axis--t"
          style={{ position: "absolute", left: plsX(t.t, g), top: g.feeBottom + 4 }}>{t.label}</span>
      )) : null}
      {m.ready && etaNow > 0 ? (
        <span className="mono pls-due" style={{ position: "absolute", left: plsX(etaNow, g), top: g.feeBottom - 16, transform: plsLabelShift(plsX(etaNow, g), g) }}>block due</span>
      ) : null}
      {m.ready && trackedA ? (
        <span className="mono pls-track" data-track-idiom="pulse" data-tracked-tx={trackedA.id}
          style={{ position: "absolute", top: g.rateTop + 2, left: trackedX,
            transform: plsLabelShift(trackedX, g) }}>
          arrived {fmtSpan(trackedA.age)} ago · {fmtPcn(trackedA.perB)}
        </span>
      ) : null}
    </div>
  );
}
