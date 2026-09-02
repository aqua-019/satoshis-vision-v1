// mempool/circuit-instruments.tsx — Circuit's geometry and its two stages.
//
// SPLIT OUT OF circuit.tsx at the seam #173 established and p2·7/p2·8/p2·9
// reused (instruments vs panels). Read circuit.tsx's header first: the identity,
// the discrete-lane separation from sediment and orbital, the along-trace
// quantity and the spec-given tracked idiom are recorded there and are not
// repeated here.
//
// What lives here: the pure geometry (queue depth → x, fee tier → lane, weight
// → extent), the depth ladder, the fill walk, the derivation of the field and
// the inferred cut, and the two mutually exclusive stages — the animated
// `<canvas>` and the static SVG twin rendered under `prefers-reduced-motion`.
// What stays in circuit.tsx: the panels, the composition and the view itself.
import * as React from "react";
import { canvasCursor } from "@/design/chart-kit";
import { useChartMetrics } from "@/design/useChartMetrics";
import { fmtBytes, shortHash as ShortHash } from "@/data/types";
import { FEE_TIER_LABELS, feeTierIndex } from "@/data/map";
import type { Tracking } from "@/mempool/mempool-shared";
import { useMemCanvas, glowSprite, blitGlow, cssColor } from "@/mempool/useMemCanvas";
import type { MoneroLive } from "@/data/types";

/** Piconero/byte, rounded and grouped. Declared beside the geometry that reads
 *  it, the way abyss and pulse each declare their own. */
export const fmtPcn = (v: number): string => Math.round(v).toLocaleString();

/* ──────────────────────────────────────────────────────────────
   GEOMETRY — pure, exported, and the gates read these rather than
   restating them
   ────────────────────────────────────────────────────────────── */

/** Tier → token, slow → fastest. Contract §4's mapping table, verbatim, and
 *  DECLARED HERE rather than imported from pulse-instruments or
 *  abyss-instruments: a value import across two lazy view chunks makes Vite
 *  hoist a shared chunk for four strings, which is a bundle change to save a
 *  duplication the contract already fixes by naming the table. Both p2·8 and
 *  p2·9 record the same reasoning.
 *
 *  Here the table is doing more work than in any other view: the tier is not a
 *  decoration on a fee axis, it IS the lane — see the note on CIR_LANES. */
export const CIR_TIER_COLORS = ["var(--c-50)", "var(--o-60)", "var(--o-80)", "var(--y-50)"] as const;

/**
 * FOUR LANES, AND THE FOUR IS THE NODE'S, NOT A COMPOSITION CHOICE.
 *
 * `get_fee_estimate` publishes exactly four tiers and `feeTierIndex`
 * (data/map.ts:49) maps a rate onto them. The lane count is therefore
 * `FEE_TIER_LABELS.length`, derived, and a chain that published a different
 * number would move this without an edit here — which is why nothing below
 * writes a literal 4.
 */
export const CIR_LANES = FEE_TIER_LABELS.length;

/**
 * THE DEPTH LADDER — the along-trace axis's domain, in BYTES.
 *
 * The axis is queue depth: how much higher-fee weight is ahead of a
 * transaction in the fee-sorted fill. Its domain is the smallest rung of this
 * ladder that holds the whole pool, for the reason pulse's window ladder
 * records: a continuously-fitted axis re-scales on every sample, so nothing on
 * it can be compared to the poll before it. A rung is stable for many polls,
 * so "the cut moved left" is a reading rather than an artefact of re-fitting.
 *
 * THE RATIO IS ~1.5, NOT 2, AND THAT IS THE LEGIBILITY DECISION. A doubling
 * ladder wastes up to half the board when the pool sits just above a rung; at
 * 1.5 the worst case is 67% of the board occupied and the typical case is
 * ~80%. The empty stretch to the left is not a defect — it is honest ("no
 * transaction is that far back in the queue") — but a board that is half bare
 * copper reads as broken rather than as quiet.
 *
 * THE BOTTOM RUNG IS 8 KB AND IT IS THE QUIET-STATE FIX. Monero transactions
 * are ~1.2–3.6 KB, so 8 KB is two to six of them: at three pending
 * transactions the pool fills most of the board and each packet is a chunky
 * block rather than a hairline. A rung floored at the block ceiling instead —
 * the obvious alternative, since the die is one ceiling wide — would have put
 * a 5 KB pool inside a 300 KB domain and crushed all three packets into the
 * rightmost 2% of the axis. The die is allowed to overflow the board instead
 * (see `dieFull`), which is the honest picture of "everything pending fits".
 *
 * THE TOP RUNG IS A CLAMP. A pool past 16 MB is 50+ blocks deep, and every
 * rung above this one draws the same picture: a full board with the die a
 * sliver at the right. `offBoard` counts what the clamp excludes.
 */
const KB = 1024;
export const CIR_DEPTH_LADDER = [
  8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512, 768,
  1024, 1536, 2048, 3072, 4096, 6144, 8192, 12288, 16384,
].map((k) => k * KB);

/**
 * The domain of the depth axis, in bytes: the smallest ladder rung that holds
 * the pool.
 *
 * `poolBytes` IS the shared strip's WEIGHT figure, passed in — see
 * `useCircuitField`'s signature and contract §3.
 */
export function cirDepthDomain(poolBytes: number): number {
  const want = poolBytes > 0 ? poolBytes : 0;
  for (const rung of CIR_DEPTH_LADDER) if (rung >= want) return rung;
  return CIR_DEPTH_LADDER[CIR_DEPTH_LADDER.length - 1];
}

/* ──────────────────────────────────────────────────────────────
   THE BOX
   ────────────────────────────────────────────────────────────── */

/** CSS px reserved for the left gutter (the lane labels), the right inset, the
 *  die's caption row above the lanes, and the depth labels below them. */
export const CIR_GUTTER = 66;
export const CIR_EDGE = 14;
/**
 * TWO LABEL ROWS ABOVE THE LANE STACK, and the second one was bought with 18 px
 * of lane height after looking at the 390 render.
 *
 * The tracked marker started 15 px above its own lane's band. At 1440 that is
 * clear space; at 390 the band is 43 px and the marker's opaque background
 * covered the lane ABOVE's bottom rail, 6.5 px into a band carrying packets.
 * Every alternative inside the stack fails the same way — a 14 px label does
 * not fit in a 9 px inset, and moving it beside the packet occludes its own
 * lane's traffic, which is the defect p2·9 fixed rather than the one to copy.
 *
 * So the region above the lanes is TWO rows and nothing is ever drawn in
 * either: the die's caption on the upper line, the tracked marker on the lower
 * one. They cannot collide with each other (different rows) and cannot occlude
 * a packet (above the stack). Pulse's future band, which is the same argument —
 * put a floating label where the composition guarantees emptiness — applied to
 * a reserved row instead of a data-free segment of the axis.
 */
export const CIR_TOP = 42;
export const CIR_LABEL_ROW = 21;
export const CIR_AXIS_H = 20;
/** Vertical space between two lanes' bands, in CSS px. */
export const CIR_LANE_GAP = 8;
/** A packet's height as a fraction of its lane's band. The remainder is the
 *  bare copper the packet rides on, which is what makes an occupied stretch of
 *  lane distinguishable from an empty one at a glance. */
export const CIR_PKT_FRAC = 0.58;
/**
 * Minimum drawn width of a packet, in CSS px — A LEGIBILITY FLOOR, the same
 * class of rule as Abyss's `DOT_R_MIN` and Pulse's `FEE_DOT_R`.
 *
 * AND IT IS THE ONE PLACE THE EXACT TILING CAN BREAK, so §9's rule applies:
 * name the error class the floor cannot see. A packet's extent on the axis IS
 * its weight, so packets are disjoint by construction and cannot occlude one
 * another — except where this floor widens one past its true extent, which
 * overlaps its neighbour by up to `CIR_PKT_MIN_W − trueWidth`.
 *
 * HOW OFTEN IT BINDS — MEASURED IN THE BROWSER, AND THE FIRST VERSION OF THIS
 * PARAGRAPH WAS WRONG. It said the floor "does not bind at all", derived from
 * a board width of ~1,010 px. That number was the c8 CELL's width, not the
 * board's: the stage measures 735.3 px at 1440 and the board inside it is
 * `right - left` = 655.3 px, so the scale is 8.333e-4 px/B, not the 1.29e-3
 * that claim assumed. A plausible computation standing in for a measurement,
 * in the docblock of the one constant whose whole job is to bound an error —
 * caught by reading the shipped geometry off the reduced-motion twin's DOM,
 * which renders one <rect> per packet through the SAME `cirPacketRect`.
 *
 * Measured at 1440 on the gate fixture (240 txs, sizes 1,228.8–3,584 B):
 *
 *     drawn widths   1.500 – 2.232 px, mean 1.613
 *     at the floor   164 of 240
 *     of those, drawn WIDER than their true extent:  60
 *     worst overlap  1.500 − 1.024 = 0.476 px
 *
 * The two halves of that are different things and only one is an error. A
 * packet whose true extent exceeds 1.5 px but whose extent-minus-gap does not
 * is drawn at 1.5 and is still a SUBSET of its own stretch — the gap is
 * absorbed, nothing overlaps. Only a packet whose TRUE extent is under 1.5 px
 * (here: under 1,800 B, which is 25% of this fixture by construction) is drawn
 * wider than it is, and it overlaps its neighbour by at most 0.476 px — under
 * half a pixel, on a 1× runner rounding to 0 or 1.
 *
 * NAMED PER §9 RATHER THAN LEFT TO BE DISCOVERED: that 0.476 px is the exact
 * size of the defect class this floor cannot see. An error in the tiling
 * smaller than it is indistinguishable from the floor's own effect. The tiling
 * is verified BY CONSTRUCTION instead — `ahead` is a running sum of `size` over
 * the fee-sorted order, so the intervals are disjoint before any pixel is
 * computed — which is the remedy §9 prescribes: trace the units, do not trust
 * the assertion.
 */
export const CIR_PKT_MIN_W = 1.5;

/**
 * Hairline between adjacent packets, in CSS px — ADDED AFTER THE FIRST RENDER
 * WAS LOOKED AT, and it is the difference between this view's claim being true
 * and being merely arithmetically true.
 *
 * The tiling is exact, so adjacent packets share an edge, so 146 transactions
 * tiling ~490 px rendered as ONE SOLID BAR. Every number under it was right;
 * the picture said "the fast tier occupies this stretch" where the composition
 * exists to say "these are 146 transactions and here is each one". No
 * assertion in this repo can see the difference — the packets were drawn, at
 * the right places, in the right colours, and scenario 9's density count reads
 * DOM text.
 *
 * Pulse's `SEG_GAP` is the precedent and the same trade: a drawn packet is its
 * true extent minus this, so the ink under-states each transaction by up to
 * 0.75 px rather than over-stating it, which is the right direction for a
 * quantity that tiles.
 *
 * THE GAP IS VISUAL, NEVER POSITIONAL, and that distinction is the whole reason
 * the census still sums to the axis. `cirPacketRect` subtracts it from the
 * drawn WIDTH and anchors the rect's RIGHT edge at `cirX(ahead)` — the
 * transaction's true leading edge. Nothing is displaced: `ahead` is a running
 * sum of `size` over the fee-sorted order, computed once in the field and never
 * touched by any drawing code, so the tiling is exact in DATA space whatever
 * the ink does. A positional gap — nudging each packet along by 0.75 px —
 * would accumulate over 240 transactions into 180 px of lie and the axis would
 * stop meaning bytes.
 *
 * MEASURED, not argued, at 1440 on the gate fixture (strip `bytes` = 557,160,
 * domain 786,432, board 655.328 px):
 *
 *     drawn rightmost edge   721.328125   ==  g.right, EXACTLY the pin row
 *     drawn leftmost edge    256.551      vs  cirX(poolBytes) = 257.0
 *
 * The right edge is exact to the pixel. The left is 0.45 px outside, which is
 * the floor's own documented bound (0.476 px, see CIR_PKT_MIN_W) and nothing
 * else — so the traffic spans precisely the stretch of axis the pool occupies.
 */
export const CIR_PKT_GAP = 0.75;

/**
 * Fill alpha for a packet INSIDE the die and OUTSIDE it.
 *
 * THE CUT HAS TO BE LEGIBLE IN THE PACKETS, not only as a line, and the first
 * render is why this exists: the fast lane's run continued straight across the
 * die's edge with no change, so "everything past this line is in the next
 * block" was a dashed rule a reader had to take on trust rather than something
 * the traffic itself showed.
 *
 * This is NOT abyss's subtractive idiom borrowed. That one dims the pool to
 * isolate a TRACKED transaction; this is a two-valued encoding of `fits`, the
 * view's own inferred cut, and it applies whether or not anything is tracked.
 * It costs one thing worth naming: the per-frame fill bound doubles from
 * CIR_LANES to 2 × CIR_LANES, because colour is now a function of (lane, side
 * of the cut) rather than of lane alone. Still a constant, still independent
 * of pool depth.
 */
export const CIR_ALPHA_ON = 0.95;
export const CIR_ALPHA_OFF = 0.42;

/**
 * Stage height is DERIVED from the measured width, the shape orbital's
 * `orbStageH`, abyss's `abyStageH` and pulse's `plsStageH` established, so
 * naturalH is a pure function of canvasW rather than a literal that drifts
 * from the composition.
 *
 * Shorter than Pulse's 0.52 because a board is WIDER than it is tall by
 * nature — the axis is the long dimension and the four lanes need only enough
 * height to be four — and capped at 430 so the desktop composition stays
 * inside the 702 px canvas budget the 1440×900 reference gives
 * (`verify-fit`'s `canvasH 702`) with the key and the caption under it.
 *
 * The floor exists because the lane COUNT is fixed at four: below it a band is
 * under 50 px and a packet at `CIR_PKT_FRAC` of that stops being a thumb
 * target. It binds at 390 and nowhere else.
 *
 * ALL THREE CONSTANTS ARE LIVE, WHICH THE FIRST SET WERE NOT. At 0.40/300/430
 * the measured desktop stage (735 px wide at 1440, 629 at 1280) produced
 * 294 and 252 — both under the floor — so the height was 300 at every width
 * the site is used at, the aspect governed nothing and the ceiling was
 * unreachable. That is `useChartMetrics`'s inert `k` in miniature: a
 * derivation that reads like a rule and is a constant. Measured and re-set:
 * 1440 → 353, 1280 → 302, 390 → 250 (floor), ceiling reached at a 875 px
 * stage, i.e. a ~1700 px viewport.
 */
export const CIR_ASPECT = 0.48;
export const CIR_H_MIN = 250;
export const CIR_H_MAX = 420;

export function cirStageH(w: number): number {
  return Math.round(Math.max(CIR_H_MIN, Math.min(CIR_H_MAX, w * CIR_ASPECT)));
}

export interface CirGeom {
  w: number; h: number;
  /** x bounds of the board: `right` is the chip's pin row, `left` the arrival pads */
  left: number; right: number;
  /** y bounds of the lane stack */
  top: number; bottom: number;
  /** the pitch of one lane band, gap included */
  laneH: number;
  /** bytes of queue depth at the LEFT edge */
  domain: number;
}

export function cirGeom(w: number, h: number, domain: number): CirGeom {
  const left = Math.min(CIR_GUTTER, Math.max(16, w * 0.2));
  const right = Math.max(left + 24, w - CIR_EDGE);
  const top = CIR_TOP;
  const bottom = Math.max(top + 80, h - CIR_AXIS_H);
  return { w, h, left, right, top, bottom, laneH: (bottom - top) / CIR_LANES, domain: domain > 0 ? domain : 1 };
}

/**
 * Queue depth → x. DIRECTED RIGHT-TO-LEFT: 0 bytes ahead is the chip's pin
 * row at `right`, and the domain's far end is the arrival pads at `left`.
 *
 * The direction is the whole reading. A transaction moves RIGHTWARD as the
 * weight ahead of it drains away, so "approaching the chip" is literally
 * approaching inclusion — which is the sentence the spec writes for this view
 * ("traces carry txs from arrival to block inclusion") turned into a
 * coordinate.
 *
 * LINEAR, not log, and deliberately so. The quantity is additive: two
 * transactions' extents sum to their combined weight, and the axis is a
 * TILING (see `cirPacketRect`). A log axis would break that — a packet's
 * drawn extent would no longer be its weight, and the exact statement "the
 * pool fills the axis, edge to edge" would become an approximation.
 */
export function cirX(bytesAhead: number, g: CirGeom): number {
  const u = bytesAhead / g.domain;
  const x = g.right - (u < 0 ? 0 : u > 1 ? 1 : u) * (g.right - g.left);
  return x < g.left ? g.left : x > g.right ? g.right : x;
}

/**
 * Lane band for a tier. FASTEST AT THE TOP, slow at the bottom.
 *
 * The order is not arbitrary and it is not decorative: the fill visits the
 * dearest tier first, so the route enters at the bottom-left (the cheapest
 * traffic, farthest from inclusion) and climbs lane by lane to the top-right
 * pin. Reversing it would make the route descend toward the chip, which reads
 * as falling out of the block rather than into it.
 *
 * A tier of -1 (the node has not published its tiers yet) is drawn on lane 0
 * rather than dropped — the transaction is real and pending, and the panel
 * reports the tier as an em-dash. Losing a packet because a fee estimate has
 * not landed would be a fabrication by omission.
 */
export function cirLaneY(tier: number, g: CirGeom): { y0: number; y1: number; mid: number } {
  const t = tier >= 0 ? Math.min(CIR_LANES - 1, tier) : 0;
  const row = CIR_LANES - 1 - t;
  const y0 = g.top + row * g.laneH + CIR_LANE_GAP / 2;
  const y1 = g.top + (row + 1) * g.laneH - CIR_LANE_GAP / 2;
  return { y0, y1, mid: (y0 + y1) / 2 };
}

/**
 * A packet's rectangle: its extent along the axis IS its weight.
 *
 * THIS IS THE COMPOSITION'S LOAD-BEARING PROPERTY. A transaction occupies the
 * interval `[ahead, ahead + size]` of the depth axis, and those intervals are
 * disjoint and contiguous by construction — the fill walk assigns each
 * transaction the stretch of queue it actually accounts for. So:
 *
 *   • the pool TILES the axis exactly, with no gaps and no overlaps;
 *   • occlusion between packets is STRUCTURALLY IMPOSSIBLE rather than
 *     managed, which is the answer this view gives to the density problem
 *     every other canvas view solves with bucketing;
 *   • a packet's WIDTH is a reading — a fat packet is a heavy transaction —
 *     and it is the same reading as the axis under it, in the same units.
 *
 * The one exception is `CIR_PKT_MIN_W`; see its docblock for the error class
 * it introduces and why it does not bind at any shipped domain.
 */
export function cirPacketRect(p: CirPacket, g: CirGeom): { x: number; y: number; w: number; h: number } {
  const xr = cirX(p.ahead, g);
  const xl = cirX(p.ahead + p.size, g);
  const w = Math.max(CIR_PKT_MIN_W, xr - xl - CIR_PKT_GAP);
  const band = cirLaneY(p.tier, g);
  const hh = Math.max(3, (band.y1 - band.y0) * CIR_PKT_FRAC);
  return { x: xr - w, y: band.mid - hh / 2, w, h: hh };
}

/**
 * The depth ladder's LABELS — round byte values on a 1/2/5-per-decade step,
 * walked from the pins outward.
 *
 * Walking outward from 0 rather than inward from the left edge keeps the pin
 * row on a gridline at every domain, the same argument `plsTimeTicks` makes
 * for keeping `now` on one: 0 bytes ahead is the instant this view is about.
 */
/**
 * COMPACT BYTE FORMAT FOR THE DEPTH TICKS ONLY — the panels keep `fmtBytes`.
 *
 * Two formats in one view needs a reason, and this is it, measured at 390:
 * `fmtBytes` renders "500.0 KB", eight characters, ~53 px at the 11 px mono
 * floor. A 210 px board can hold three of those, so the tick step had to be
 * 500 KB and THE ENTIRE AXIS WAS TWO LABELS — "500.0 KB" and "chip". An axis
 * with two labels cannot be interpolated against, which is the only thing an
 * axis is for. "500K" is four characters and ~26 px, so the same board now
 * carries four rungs at a 54 px pitch.
 *
 * `fmtBytes` also stops at KB, so it would print a 16 MB top rung as
 * "16384.0 KB" — true, and not a number anyone reads off an axis. This
 * carries to MB.
 */
export function fmtDepth(bytes: number): string {
  const b = Math.round(bytes);
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)}K`;
  const m = b / (1024 * 1024);
  return `${m < 10 ? m.toFixed(1) : Math.round(m)}M`;
}

/** Minimum pitch between adjacent depth gridlines, in CSS px. Sized for
 *  `fmtDepth`'s four characters plus separation, not for `fmtBytes`'s eight. */
const TICK_MIN_PX = 44;
/**
 * Step ladder for the depth labels, in KIBIBYTES.
 *
 * KiB and not a decimal decade, because `fmtBytes` (data/types.ts:192) divides
 * by 1024 — a step of 100,000 B would print "97.7 KB · 195.3 KB · 293.0 KB",
 * three true readings and not one of them a number anybody reads off an axis.
 * Pulse's `plsRateTicks` records the same lesson about quartering a round
 * ceiling; this is that lesson applied to a unit mismatch instead of an
 * arithmetic one.
 */
const TICK_STEPS_KB = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];

export function cirDepthTicks(g: CirGeom): number[] {
  const px = g.right - g.left;
  if (!(px > 0) || !(g.domain > 0)) return [0];
  const wantKB = (g.domain / px) * TICK_MIN_PX / KB;
  let step = TICK_STEPS_KB[TICK_STEPS_KB.length - 1] * KB;
  for (const s of TICK_STEPS_KB) if (s >= wantKB) { step = s * KB; break; }
  const out: number[] = [];
  for (let v = 0; v <= g.domain + 0.5; v += step) out.push(Math.round(v));
  return out;
}

/* ──────────────────────────────────────────────────────────────
   DERIVATION — the fill walk, the lanes, and the inferred cut
   ────────────────────────────────────────────────────────────── */

export interface CirPacket {
  id: string;
  perB: number;
  size: number;
  /** age as the node reported it, at the snapshot instant — null when no
   *  clock reported one. Never positional here (the axis is queue depth), so
   *  an unaged packet is drawn like any other and its age cell reads "—". */
  age: number | null;
  /** the LANE — a node fee tier, or -1 when tiers are unknown */
  tier: number;
  /** rank in the fee-sorted order, dearest first */
  rank: number;
  /** BYTES OF HIGHER-FEE WEIGHT AHEAD OF IT — the along-trace coordinate */
  ahead: number;
  /** does it fit under the node's own weight ceiling, fee-sorted */
  fits: boolean | null;
}

export interface CirLane {
  tier: number;
  n: number;
  bytes: number;
  /** the stretch of queue this lane occupies, in bytes ahead: `from` is the
   *  end nearest the chip. Both are 0 for an empty lane. */
  from: number; to: number;
  /** how many of this lane's packets sit inside the die */
  lit: number;
  /** the node's own floor for this tier, pcn/B */
  floor: number | null;
}

export interface CirField {
  /** every pending transaction, fee-sorted dearest first */
  txs: CirPacket[];
  /** always CIR_LANES entries, in tier order — an empty lane is PRESENT */
  lanes: CirLane[];
  /** bytes of queue depth at the board's left edge */
  domain: number;
  /** the strip's WEIGHT figure, passed in, never re-derived */
  poolBytes: number;
  /** pending weight past the ladder's top rung — never dropped silently */
  offBoard: number;
  /** the node's own block weight ceiling */
  limit: number;
  cutIndex: number | null;
  cutPerB: number | null;
  cumAtCut: number;
  /** the die spans the whole board: the entire pool fits under the ceiling */
  dieFull: boolean;
  /** pool weight as a multiple of the ceiling — "blocks of demand" */
  blocksDeep: number;
}

/**
 * The whole derivation, memoised on the fields it reads.
 *
 * `poolBytes` IS A PARAMETER, and that is the point. Contract §3 says a view
 * must not compute its own version of a figure the strip publishes, and this
 * view's ONE axis is anchored on exactly one of them: the depth domain is the
 * ladder rung that holds the strip's WEIGHT. Taking it as an argument makes
 * "the board holds the pool" true BY CONSTRUCTION rather than by two
 * implementations agreeing.
 *
 * It is the first of the ten to anchor on `bytes` — Orbital anchors on none,
 * Abyss on `oldest`, Pulse on `oldest` and `eta` — which is the same
 * discipline reaching a third strip figure rather than a new one.
 *
 * NOTE WHAT THE PARAMETER DOES AND DOES NOT DO. It sets the AXIS. The fill
 * walk below still sums sizes itself, because it needs the RUNNING total per
 * transaction and the strip publishes only the grand total; the two agree by
 * arithmetic, and `offBoard` is where any disagreement would surface as a
 * visible number rather than as a silently clipped board.
 *
 * The cut is the SAME cumulative-weight walk bridge, reactor, orbital, abyss
 * and pulse make, derived here rather than imported: each view owns its
 * composition. It is SESSION-computed and labelled inferred — a miner's real
 * template is unobservable from a public node.
 */
export function useCircuitField(data: MoneroLive, poolBytes: number): CirField {
  return React.useMemo<CirField>(() => {
    const sorted = [...data.mempool].sort((a, b) => b.perB - a.perB);
    const n = sorted.length;
    const domain = cirDepthDomain(poolBytes);
    const limit = data.blockWeightMedian || data.blockWeightLimit || 0;

    // THE FILL WALK. One pass: it assigns every transaction its stretch of the
    // queue AND finds where the cumulative weight crosses the node's ceiling.
    // The cut is not a second walk over the same order — a second walk is how
    // "the console says rank 41 is in and the stage draws it out" happens.
    const txs: CirPacket[] = [];
    let cum = 0;
    let cutIndex: number | null = limit > 0 && n > 0 ? n : null;
    let cumAtCut = 0;
    let offBoard = 0;
    for (let i = 0; i < n; i++) {
      const t = sorted[i];
      if (cutIndex === n && limit > 0 && cum + t.size > limit) {
        cutIndex = i;
        cumAtCut = cum;
      }
      txs.push({
        id: t.id,
        perB: t.perB,
        size: t.size,
        age: t.age,
        tier: feeTierIndex(t.perB, data.feeTiers),
        rank: i,
        ahead: cum,
        fits: null,                      // filled below, once cutIndex is final
      });
      // Counted, never dropped. A transaction whose stretch of queue starts
      // past the ladder's top rung is off the board; one that STRADDLES the
      // rung is on it, with its extent clamped by `cirX`. The panel reports
      // the byte total either way, which is the only place the clamp is
      // visible at all.
      if (cum >= domain) offBoard += t.size;
      cum += t.size;
    }
    if (cutIndex === n) cumAtCut = Math.min(cum, limit);
    for (const p of txs) p.fits = cutIndex == null ? null : p.rank < cutIndex;

    // Lanes are ALWAYS four, in tier order, present whether or not they carry
    // traffic — the board's copper is drawn either way, and a census row that
    // disappears when a tier empties is a census that cannot report an empty
    // tier. `from`/`to` are the lane's own stretch of the axis.
    const lanes: CirLane[] = Array.from({ length: CIR_LANES }, (_, tier) => ({
      tier, n: 0, bytes: 0, from: 0, to: 0, lit: 0,
      floor: data.feeTiers.length === CIR_LANES ? data.feeTiers[tier] : null,
    }));
    for (const p of txs) {
      const lane = lanes[p.tier >= 0 ? Math.min(CIR_LANES - 1, p.tier) : 0];
      if (lane.n === 0) lane.from = p.ahead;
      lane.n++;
      lane.bytes += p.size;
      lane.to = p.ahead + p.size;
      if (p.fits === true) lane.lit++;
    }

    const cutPerB = cutIndex != null && cutIndex > 0 && cutIndex < n ? sorted[cutIndex].perB : null;

    return {
      txs, lanes, domain, poolBytes, offBoard, limit,
      cutIndex, cutPerB, cumAtCut,
      dieFull: limit > 0 && limit >= domain,
      blocksDeep: limit > 0 ? poolBytes / limit : 0,
    };
  }, [
    data.mempool, data.feeTiers, data.blockWeightMedian, data.blockWeightLimit,
    data.status.mempool, poolBytes,
  ]);
}

/**
 * The lane-to-lane transitions, in bytes ahead — where the fee-sorted fill
 * leaves one tier and enters the next.
 *
 * These are the VIAS. They are not decoration: because `feeTierIndex` is
 * monotone in `perB` (data/map.ts:51-54) and the fill is fee-sorted, a lane's
 * traffic occupies exactly ONE contiguous stretch of the axis, and the
 * boundaries between those stretches are the node's own published tier floors
 * expressed as a queue depth. "The fastest tier ends 40 KB into the queue" is
 * a reading no other view in the suite offers, and it is what the jogs draw.
 *
 * Only returned where BOTH adjacent lanes carry traffic — a via to nowhere is
 * a routing claim about an empty tier.
 */
export function cirVias(field: CirField): { at: number; from: number; to: number }[] {
  // BETWEEN CONSECUTIVE POPULATED LANES, not between adjacent tiers, and the
  // difference is a real case rather than a defensive one. An ADJACENT-tier
  // walk emits nothing across an empty lane, so a pool holding `fastest` and
  // `normal` traffic but no `fast` — legal, since the tiers are node-published
  // bands and nothing requires all four to be occupied — would draw a route
  // that jumps two lanes with no connector, i.e. a broken board. Found by
  // reasoning rather than by looking: the gate fixture's empty lane is
  // `fastest`, at the END of the order, where an adjacent walk gets the right
  // answer for the wrong reason.
  const live = [];
  for (let t = CIR_LANES - 1; t >= 0; t--) if (field.lanes[t].n > 0) live.push(t);
  const out: { at: number; from: number; to: number }[] = [];
  for (let i = 1; i < live.length; i++) {
    out.push({ at: field.lanes[live[i]].from, from: live[i - 1], to: live[i] });
  }
  return out;
}

/* ──────────────────────────────────────────────────────────────
   THE STAGE — canvas geometry + DOM labels
   ────────────────────────────────────────────────────────────── */

/** Dash pitch of the direction current, in CSS px, and its speed in px/s. */
const CURRENT_DASH: [number, number] = [3, 9];
const CURRENT_PX_S = 26;
/** Half-width allowance for the floating tracked label, in CSS px. Not
 *  measured — a bound: it is a short mono string, and the flip only has to be
 *  right about WHICH SIDE has room. Pulse's `plsLabelShift`, same reasoning. */
const LABEL_HALF = 74;

export function cirLabelShift(x: number, g: CirGeom): string {
  if (x > g.right - LABEL_HALF) return "translateX(-100%)";
  if (x < g.left + LABEL_HALF) return "translateX(0)";
  return "translateX(-50%)";
}

/**
 * The same flip for the DEPTH ladder's own labels, at a tighter half-width.
 *
 * The ladder walks outward from 0, so its first tick is ALWAYS at the exact
 * right edge and its last is at or near the left one — the two positions a
 * centred label always overflows. Seen at 1440 on the first render: "chip"
 * sat half outside the panel. Both ends are structural rather than
 * occasional, which is why this is a function and not a special case for the
 * one tick somebody noticed.
 */
const AXIS_HALF = 30;

export function cirAxisShift(x: number, g: CirGeom): string {
  if (x > g.right - AXIS_HALF) return "translateX(-100%)";
  if (x < g.left + AXIS_HALF) return "translateX(0)";
  return "translateX(-50%)";
}

/**
 * The STATIC half of the board — the substrate wash, the four lanes' copper
 * rails, the arrival pads and the pin stubs — cached to an offscreen canvas
 * and blitted.
 *
 * Same cache-key discipline as `glowSprite`, `abyBackground` and
 * `plsBackground`: the key holds the RESOLVED colours, never the token names,
 * because a token string does not change when the theme does — only what it
 * resolves to. Keying on the name would serve the first theme's pixels for
 * ever.
 *
 * The die is deliberately NOT in here. Its left edge is the cut, which moves
 * with every poll, so caching it would either thrash the cache or blit a
 * stale block boundary — which is the one line on this stage a reader is most
 * likely to take at face value.
 */
const CIR_BG = new Map<string, HTMLCanvasElement>();

function cirBackground(g: CirGeom, dpr: number): HTMLCanvasElement | null {
  const copper = cssColor("var(--ink-20)");
  const rail = cssColor("var(--line-d)");
  const key = [Math.round(g.w), Math.round(g.h), Math.round(g.left), Math.round(g.bottom), dpr.toFixed(2), copper, rail].join("|");
  const hit = CIR_BG.get(key);
  if (hit) return hit;

  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(g.w * dpr));
  c.height = Math.max(1, Math.round(g.h * dpr));
  const x = c.getContext("2d");
  if (!x) return null;
  x.setTransform(dpr, 0, 0, dpr, 0, 0);

  for (let tier = 0; tier < CIR_LANES; tier++) {
    const band = cirLaneY(tier, g);
    // The lane's solder-mask channel — a faint fill so an EMPTY lane is still
    // visibly a lane. The empty-feed state is an intact board, not a blank one.
    x.globalAlpha = 0.5;
    x.fillStyle = rail;
    x.fillRect(g.left, band.y0, Math.max(0, g.right - g.left), Math.max(0, band.y1 - band.y0));
    x.globalAlpha = 1;
    // The two copper rails.
    x.strokeStyle = copper;
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(g.left, Math.round(band.y0) + 0.5);
    x.lineTo(g.right, Math.round(band.y0) + 0.5);
    x.moveTo(g.left, Math.round(band.y1) + 0.5);
    x.lineTo(g.right, Math.round(band.y1) + 0.5);
    x.stroke();
    // The arrival pad — where a transaction enters the board.
    x.fillStyle = copper;
    x.fillRect(g.left - 5, band.mid - 3, 5, 6);
  }

  if (CIR_BG.size > 12) CIR_BG.clear();
  CIR_BG.set(key, c);
  return c;
}

/**
 * The circuit stage.
 *
 * PER-FRAME COST IS BOUNDED BY CONSTRUCTION, and the bound is a CONSTANT
 * rather than a function of pool depth — Abyss's standard, met here by the
 * tier batching Pulse also uses:
 *
 *   1 blit (the cached board)
 *   + 1 die fill + ~10 die fills/strokes (outline, notch, 2 × CIR_LANES pins)
 *   + D strokes for the depth ladder, D ≤ 16
 *   + CIR_LANES dashed strokes for the direction current
 *   + at most 2 × CIR_LANES `fill()` calls for the WHOLE packet population
 *   + at most CIR_LANES − 1 via strokes
 *   + 2 strokes for the cut
 *   + at most 1 glow blit + 4 strokes for the tracked transaction.
 *
 * The eight is the LANE and the CUT doing the work Abyss's luminosity bucket
 * does: a packet's appearance is a pure function of (tier, which side of the
 * cut it falls), so every packet sharing those two shares one path. 240
 * transactions is eight fills; 2,400 would also be eight.
 *
 * Colours are resolved ONCE per frame, not per packet — `cssColor` reads
 * getComputedStyle. `ctx.shadowBlur` is banned in src/mempool and gated
 * (verify-memshell §4d); the tracked glow is a memoised sprite.
 */
export function CirStage({ field, tracking, onPickTx }: {
  field: CirField; tracking: Tracking; onPickTx: (id: string) => void;
}) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  // FLUID mode (no vbWidth) so k === 1 — contract §2. The host renders
  // unconditionally, never `null`, which is the v6.0.12 rule that keeps the
  // ref attached from the first render.
  const m = useChartMetrics(wrapRef);
  const w = m.w || 0;
  const h = cirStageH(w || CIR_H_MIN / CIR_ASPECT);

  const trackedId = tracking?.kind === "tx" ? tracking.id : null;

  const fieldRef = React.useRef(field);
  fieldRef.current = field;
  const trackedRef = React.useRef<string | null>(trackedId);
  trackedRef.current = trackedId;

  const draw = React.useCallback((ctx: CanvasRenderingContext2D, cw: number, ch: number, t: number) => {
    const f = fieldRef.current;
    ctx.clearRect(0, 0, cw, ch);
    const g = cirGeom(cw, ch, f.domain);

    const bg = cirBackground(g, Math.min(window.devicePixelRatio || 1, 2));
    if (bg) ctx.drawImage(bg, 0, 0, cw, ch);

    /* ── THE DIE ──
       The next block, drawn as an IC package whose LEFT EDGE IS THE CUT.
       Everything inside its footprint is in the next block; that is the whole
       reading, and it is why the die is drawn UNDER the packets rather than
       over them. When the ceiling exceeds the board's domain the die spans the
       whole board (`dieFull`) — the honest picture of "the entire pending pool
       fits", rather than a package clipped at an edge it never reaches. */
    const dieX = f.limit > 0 ? cirX(Math.min(f.limit, f.domain), g) : null;
    /* THE PACKAGE HUGS THE LANE STACK EXACTLY, and the first version did not —
       it over-hung by 8 px at each end. Harmless at the top; at the bottom it
       put the package's warm substrate UNDER the depth labels, which are
       `--ink-40` for consistency with every other view's axis, and in the
       `dieFull` state (the whole pool fits, so the package spans the whole
       board) that is EVERY label on the axis. Seen on the 3-tx render: eight
       true, correctly-placed, barely-readable labels. Nothing asserts on the
       contrast of a DOM label over a canvas wash — verify-contrast reads
       computed CSS colours and the wash is pixels. */
    const dieTop = g.top;
    const dieBot = g.bottom;
    if (dieX != null) {
      // The package substrate. A FLAT `--bg-2` at 0.85 was the first version
      // and it was invisible against the board — the die, which is the whole
      // point of the picture, read as one dashed line. It is a lit slab now:
      // a wash that brightens toward the pins, which is also the direction of
      // travel.
      const sub = ctx.createLinearGradient(dieX, 0, g.right, 0);
      sub.addColorStop(0, cssColor("var(--bg-2)"));
      sub.addColorStop(1, cssColor("var(--o-20)"));
      ctx.fillStyle = sub;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(dieX, dieTop, Math.max(0, g.right - dieX), dieBot - dieTop);
      ctx.globalAlpha = 1;
    }

    // ── the depth ladder ──
    ctx.strokeStyle = cssColor("var(--line-d)");
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const b of cirDepthTicks(g)) {
      const x = Math.round(cirX(b, g)) + 0.5;
      ctx.moveTo(x, g.top);
      ctx.lineTo(x, g.bottom);
    }
    ctx.stroke();

    /* ── THE DIRECTION CURRENT ──
       DECORATION, AND IT CARRIES NO READING — stated here, in the view's
       header, and on the face of the stage itself.
       A PCB invites the dishonest kind of motion: a packet gliding smoothly
       down its lane between polls would be ASSERTING positions the feed never
       reported, which is interpolation, which is fabrication. Every packet on
       this stage is therefore STILL between polls — its x is a pure function
       of the snapshot — and the only thing that moves is this dash offset,
       which is not a transaction and does not claim to be one.
       IT USES `useMemCanvas`'s ELAPSED `t`, NOT `Date.now()`, and this is the
       one place Circuit deliberately inverts orbital's, abyss's and pulse's
       choice. Those three derive a COORDINATE from wall-clock — a bearing, a
       depth, a position on a time axis — so a frozen animation clock would
       resume drawing a stale reading as a live one. Nothing here is derived
       from time at all: the axis is weight. So the elapsed clock is exactly
       right, and a tab hidden for ten minutes resumes with the current where
       it left off, which is the correct behaviour for a thing that means
       nothing. */
    const period = CURRENT_DASH[0] + CURRENT_DASH[1];
    ctx.save();
    ctx.strokeStyle = cssColor("var(--ink-20)");
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.55;
    ctx.setLineDash(CURRENT_DASH);
    ctx.lineDashOffset = -((t * CURRENT_PX_S) % period);
    ctx.beginPath();
    for (let tier = 0; tier < CIR_LANES; tier++) {
      const y = Math.round(cirLaneY(tier, g).mid) + 0.5;
      ctx.moveTo(g.left, y);
      ctx.lineTo(g.right, y);
    }
    ctx.stroke();
    ctx.restore();

    // ── THE PACKETS ──
    //
    // One rect per transaction, extent = weight, batched by lane. Disjoint by
    // construction, so nothing here has to resolve an overlap.
    const tracked = trackedRef.current;
    let trackedAt: { r: { x: number; y: number; w: number; h: number }; tier: number; p: CirPacket } | null = null;
    const fills = CIR_TIER_COLORS.map((c) => cssColor(c));
    // Two buckets per lane — on the die and off it. `fits` is the ONLY thing
    // that varies a packet's appearance beyond its lane, which is what keeps
    // the fill count a constant.
    const byLane: number[][] = Array.from({ length: CIR_LANES * 2 }, () => []);
    for (const p of f.txs) {
      const r = cirPacketRect(p, g);
      const lane = p.tier >= 0 ? Math.min(CIR_LANES - 1, p.tier) : 0;
      byLane[lane * 2 + (p.fits === false ? 1 : 0)].push(r.x, r.y, r.w, r.h);
      if (tracked != null && p.id === tracked) trackedAt = { r, tier: lane, p };
    }
    for (let bucket = 0; bucket < byLane.length; bucket++) {
      const rects = byLane[bucket];
      if (!rects.length) continue;
      ctx.fillStyle = fills[bucket >> 1];
      ctx.globalAlpha = bucket & 1 ? CIR_ALPHA_OFF : CIR_ALPHA_ON;
      ctx.beginPath();
      for (let i = 0; i < rects.length; i += 4) ctx.rect(rects[i], rects[i + 1], rects[i + 2], rects[i + 3]);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ── THE VIAS ──
    // Where the fill leaves one tier for the next. Drawn as a jog: a short
    // vertical run between the two lane centres with a plated hole at each end.
    ctx.strokeStyle = cssColor("var(--ink-40)");
    ctx.lineWidth = 1;
    for (const v of cirVias(f)) {
      const x = Math.round(cirX(v.at, g)) + 0.5;
      const a = cirLaneY(v.from, g).mid;
      const b = cirLaneY(v.to, g).mid;
      ctx.beginPath();
      ctx.moveTo(x, a);
      ctx.lineTo(x, b);
      ctx.stroke();
      for (const y of [a, b]) {
        ctx.beginPath();
        ctx.arc(x, y, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = cssColor("var(--bg-0)");
        ctx.fill();
        ctx.stroke();
      }
    }

    // ── THE INFERRED CUT, and the die's edge and pins ──
    if (dieX != null) {
      ctx.strokeStyle = cssColor("var(--g-50)");
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(Math.round(dieX) + 0.5, dieTop);
      ctx.lineTo(Math.round(dieX) + 0.5, dieBot);
      ctx.stroke();
      ctx.setLineDash([]);

      /* The package outline and one pin stub per lane. The pin row is the
         right edge of the board: 0 bytes ahead, next to be included.

         WHAT THE ILLUMINATION DOES AT CONFIRMATION — the design decision the
         spec leaves open, taken here. When the tracked transaction is mined it
         leaves the pool, so it has no lane and no stretch of queue: there is no
         trace left to light, and lighting one would be drawing a position the
         node no longer reports. The illumination MOVES TO THE DIE instead —
         the package outline goes gold and the label sits over it reading "on
         the die". The trace went dark because the journey ended, which is the
         same sentence the view has been drawing all along. */
      const landed = tracked != null && trackedAt == null;
      ctx.strokeStyle = cssColor(landed ? "var(--y-50)" : "var(--o-60)");
      ctx.lineWidth = landed ? 1.5 : 1;
      ctx.beginPath();
      ctx.rect(Math.round(dieX) + 0.5, Math.round(dieTop) + 0.5, Math.max(0, g.right - dieX) - 1, dieBot - dieTop - 1);
      ctx.stroke();
      ctx.lineWidth = 1;
      // The pin-1 notch, at the package's top-left corner — the one piece of
      // pure iconography on this stage, and it earns its place by making the
      // slab read as a PACKAGE at a glance rather than as a highlighted
      // region. It carries no data and is drawn only when the package is wide
      // enough to hold it.
      if (g.right - dieX > 40) {
        ctx.beginPath();
        ctx.arc(dieX + 11, dieTop + 11, 4.5, 0, Math.PI * 2);
        ctx.stroke();
      }
      // One pin per lane, on both edges of the package: the left edge is where
      // a transaction enters it (the cut) and the right is the pin row.
      ctx.fillStyle = cssColor("var(--o-60)");
      for (let tier = 0; tier < CIR_LANES; tier++) {
        const y = cirLaneY(tier, g).mid;
        ctx.fillRect(g.right - 5, y - 4, 5, 8);
        ctx.fillRect(dieX, y - 4, 4, 8);
      }
    }

    /* ── THE TRACKED TRANSACTION — the spec's own idiom, and the only one of
       the ten this spec hands over rather than leaving to the view:
       "Tracked tx = its trace illuminates end to end."
       So: the LANE it rides is lit from the arrival pad to the chip pin, at
       full width, and the packet itself is filled bright and ringed. The
       illumination is the whole trace, not the packet's own stretch of it,
       because the sentence is about the trace.
       IT DOES NOT DIM THE REST. Abyss owns the subtractive idiom and this
       would be a second copy of it; here the lit trace already separates
       cleanly, because three of the four lanes are unlit by construction. */
    if (trackedAt) {
      const band = cirLaneY(trackedAt.tier, g);
      ctx.save();
      ctx.strokeStyle = cssColor("var(--y-50)");
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(g.left, Math.round(band.y0) + 0.5);
      ctx.lineTo(g.right, Math.round(band.y0) + 0.5);
      ctx.moveTo(g.left, Math.round(band.y1) + 0.5);
      ctx.lineTo(g.right, Math.round(band.y1) + 0.5);
      ctx.stroke();
      // The stretch the transaction still has to travel — pin-ward of the
      // packet — carries the brighter run. That is the reading the spec's
      // "end to end" leaves room for and it costs one more stroke.
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(trackedAt.r.x + trackedAt.r.w, Math.round(band.mid) + 0.5);
      ctx.lineTo(g.right, Math.round(band.mid) + 0.5);
      ctx.stroke();
      ctx.restore();

      const r = trackedAt.r;
      blitGlow(ctx, glowSprite("var(--y-50)", 16), r.x + r.w / 2, band.mid, 0.6);
      ctx.fillStyle = fills[trackedAt.tier];
      ctx.fillRect(r.x, band.y0 + 2, Math.max(2, r.w), Math.max(2, band.y1 - band.y0 - 4));
      ctx.strokeStyle = cssColor("var(--y-50)");
      ctx.lineWidth = 1.5;
      ctx.strokeRect(Math.round(r.x) - 1.5, Math.round(band.y0) + 0.5, Math.max(3, r.w) + 3, Math.max(3, band.y1 - band.y0) - 1);
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
    const g = cirGeom(el.clientWidth, el.clientHeight, f.domain);
    let best: { id: string; d2: number } | null = null;
    for (const p of f.txs) {
      const r = cirPacketRect(p, g);
      // Distance to the RECTANGLE, not to its centre. A packet's width is a
      // reading, so a fat one is a fat target and a thin one is a thin one —
      // centre-distance would make a 3 px packet and a 60 px packet equally
      // easy to miss.
      const dx = c.x < r.x ? r.x - c.x : c.x > r.x + r.w ? c.x - (r.x + r.w) : 0;
      const dy = c.y < r.y ? r.y - c.y : c.y > r.y + r.h ? c.y - (r.y + r.h) : 0;
      const d2 = dx * dx + dy * dy;
      // TOLERANCE, AND THE CLASS IT CANNOT SEE (§9). `hit` is generous for
      // thumbs, so it is also the largest coordinate-space error this test can
      // absorb silently — and at 240 packets it is wider than a packet, so
      // neighbours overlap in hit-space and the NEAREST wins. That is a
      // resolution rule, not an accuracy claim.
      // The units are traced by construction instead: the draw loop and this
      // test both consume `el.clientWidth/clientHeight`, both call the same
      // `cirGeom`/`cirPacketRect`, and neither derives a second geometry.
      // `useMemCanvas` folds DPR into the context transform, never into the
      // coordinates either path sees.
      const hit = 9;
      if (d2 <= hit * hit && (!best || d2 < best.d2)) best = { id: p.id, d2 };
    }
    if (best) onPickTx(best.id);
  }, [onPickTx]);

  const g = cirGeom(w || 1, h, field.domain);
  const trackedP = trackedId ? field.txs.find((p) => p.id === trackedId) : undefined;
  const trackedRect = trackedP ? cirPacketRect(trackedP, g) : null;
  const depthTicks = cirDepthTicks(g);
  const dieX = field.limit > 0 ? cirX(Math.min(field.limit, field.domain), g) : null;

  /* AXIS LABELS ARE DOM, NOT CANVAS TEXT — orbital's reasoning, applied to a
   * fourth stage. Canvas glyphs are invisible to verify-legibility, to
   * verify-memviews scenario 6's collision sweep and to its sub-12px SVG
   * check, three gates whose nominal subject includes this view; authoring
   * text into that blind spot buys a prettier stage at the cost of every gate
   * that reads text. The canvas draws geometry only.
   *
   * `spreadLabels` is NOT used on the depth ladder and does not need to be:
   * `cirDepthTicks` walks a uniform step chosen to clear TICK_MIN_PX, so the
   * labels cannot collide by construction — the same argument pulse records
   * for its time labels. The LANE labels are on a fixed four-row pitch and
   * cannot collide either. */
  return (
    <div
      ref={wrapRef}
      className="cir-stage"
      style={{ position: "relative", width: "100%", height: h, minWidth: 0 }}
    >
      <canvas
        ref={ref}
        className="mem-canvas"
        role="img"
        aria-label="Pending transactions routed as a printed circuit board — four fee-tier bus lanes carrying the fee-sorted fill toward the next block"
        onClick={onClick}
        style={{ cursor: "pointer" }}
      />
      {/* Lane labels, in the left gutter. Absolutely positioned, so they
          contribute nothing to `.mp-view`'s max-content. */}
      {m.ready ? FEE_TIER_LABELS.map((label, tier) => (
        <span key={label} className="mono cir-lane" style={{ position: "absolute", left: 0, top: cirLaneY(tier, g).mid }}>
          {label}
        </span>
      )) : null}
      {m.ready ? depthTicks.map((b) => (
        <span key={`d${b}`} className="mono cir-axis" style={{ position: "absolute", left: cirX(b, g), top: g.bottom + 4, transform: cirAxisShift(cirX(b, g), g) }}>
          {b === 0 ? "chip" : fmtDepth(b)}
        </span>
      )) : null}
      {/* The die's caption, pinned to its own left edge — the cut. It sits in
          the row ABOVE the lanes, which is the one horizontal band on this
          stage where no packet is ever drawn, so it can occlude no data at any
          pool size. Pulse's future band, the same argument on a different
          axis. */}
      {m.ready && dieX != null ? (
        <span className="mono cir-die" style={{ position: "absolute", left: dieX, top: 2, transform: cirLabelShift(dieX, g) }}>
          {field.dieFull ? "next block · whole pool fits" : "next block"}
        </span>
      ) : null}
      {/* THE TRACKED IDIOM'S DOM ANCHOR.
          `data-track-idiom` here as well as on MemTxTable's row, because the
          highlight this view makes is a canvas one and verify-tracking §1's
          positive control requires the count to be 0 BEFORE a search — which
          it is, since this whole node is mounted only while a tx is tracked. */}
      {m.ready && trackedP && trackedRect ? (
        <span
          className="mono cir-track"
          data-track-idiom="circuit"
          data-tracked-tx={trackedP.id}
          style={{
            position: "absolute",
            top: CIR_LABEL_ROW,
            left: trackedRect.x + trackedRect.w,
            transform: cirLabelShift(trackedRect.x + trackedRect.w, g),
          }}
        >
          {trackedP.fits && field.limit > 0 ? "on the die" : `${fmtDepth(trackedP.ahead)} ahead`}
        </span>
      ) : null}
      {/* THE LANDED STATE. The tracked transaction has left the pool, so it has
          no lane and no queue depth — see the die's docblock in the draw loop.
          The anchor moves onto the package rather than disappearing, which is
          also what keeps `data-track-idiom` mounted across the mempool → block
          transition rather than only during the mempool half of it. */}
      {m.ready && trackedId && !trackedP && dieX != null ? (
        <span className="mono cir-track" data-track-idiom="circuit" data-tracked-tx={trackedId}
          style={{ position: "absolute", top: CIR_LABEL_ROW, left: (dieX + g.right) / 2, transform: "translateX(-50%)" }}>
          on the die
        </span>
      ) : null}
    </div>
  );
}

/**
 * The reduced-motion twin: the same board, frozen, as SVG.
 *
 * NOT a paused canvas. `verify-memviews` scenario 3 asserts ZERO
 * `canvas.mem-canvas` under `prefers-reduced-motion`, and contract §6 requires
 * the static equivalent to carry the same DATA and the same CLICK TARGETS —
 * so every transaction is a real `<rect>` with its own handler, not a
 * decorative still.
 *
 * FROZEN AT THE SNAPSHOT, and here that is the ENTIRE picture rather than most
 * of it. v6.1.3's `useTick` lesson was that a frozen frame is a content claim,
 * and its three casualties all froze on the "before" state their simulator
 * existed to move past. Circuit has no such state: every coordinate on the
 * animated stage is a pure function of the snapshot too, and the only thing
 * the canvas adds is the direction current, which carries no reading by
 * construction. A reduced-motion reader of this view loses NOTHING — not a
 * number, not a position, not a click target. It is the only one of the four
 * canvas views for which that is true.
 */
export function CirStatic({ field, tracking, onPickTx }: {
  field: CirField; tracking: Tracking; onPickTx: (id: string) => void;
}) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const m = useChartMetrics(wrapRef);
  const w = m.w || 0;
  const h = cirStageH(w || CIR_H_MIN / CIR_ASPECT);
  const g = cirGeom(w || 1, h, field.domain);
  const trackedId = tracking?.kind === "tx" ? tracking.id : null;
  const trackedP = trackedId ? field.txs.find((p) => p.id === trackedId) : undefined;
  const trackedRect = trackedP ? cirPacketRect(trackedP, g) : null;
  const depthTicks = cirDepthTicks(g);
  const dieX = field.limit > 0 ? cirX(Math.min(field.limit, field.domain), g) : null;
  const dieTop = g.top;
  const dieBot = g.bottom;
  const vias = cirVias(field);

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", height: h, minWidth: 0 }}>
      {m.ready ? (
        <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }} role="img"
          aria-label="Pending transactions routed as a printed circuit board — four fee-tier bus lanes carrying the fee-sorted fill toward the next block, static">
          <defs>
            <linearGradient id="cir-die-sub" x1={dieX ?? 0} y1="0" x2={g.right} y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="var(--bg-2)" />
              <stop offset="1" stopColor="var(--o-20)" />
            </linearGradient>
          </defs>
          {dieX != null ? (
            <rect x={dieX} y={dieTop} width={Math.max(0, g.right - dieX)} height={dieBot - dieTop}
              fill="url(#cir-die-sub)" fillOpacity={0.9} />
          ) : null}
          {FEE_TIER_LABELS.map((label, tier) => {
            const band = cirLaneY(tier, g);
            return (
              <g key={label}>
                <rect x={g.left} y={band.y0} width={Math.max(0, g.right - g.left)} height={Math.max(0, band.y1 - band.y0)}
                  fill="var(--line-d)" fillOpacity={0.5} />
                <line x1={g.left} y1={band.y0} x2={g.right} y2={band.y0} stroke="var(--ink-20)" />
                <line x1={g.left} y1={band.y1} x2={g.right} y2={band.y1} stroke="var(--ink-20)" />
                <rect x={g.left - 5} y={band.mid - 3} width={5} height={6} fill="var(--ink-20)" />
                {dieX != null ? <rect x={dieX} y={band.mid - 4} width={4} height={8} fill="var(--o-60)" /> : null}
                <rect x={g.right - 5} y={band.mid - 4} width={5} height={8} fill="var(--o-60)" />
              </g>
            );
          })}
          {depthTicks.map((b) => (
            <line key={`gd${b}`} x1={cirX(b, g)} y1={g.top} x2={cirX(b, g)} y2={g.bottom} stroke="var(--line-d)" />
          ))}
          {/* The direction current, at offset 0. It is decoration in the
              animated stage and it stays decoration here — drawn rather than
              dropped so the two stages are the same picture. */}
          {FEE_TIER_LABELS.map((label, tier) => (
            <line key={`c${label}`} x1={g.left} y1={cirLaneY(tier, g).mid} x2={g.right} y2={cirLaneY(tier, g).mid}
              stroke="var(--ink-20)" strokeOpacity={0.55} strokeDasharray={CURRENT_DASH.join(" ")} />
          ))}
          {field.txs.map((p) => {
            const r = cirPacketRect(p, g);
            const isTracked = trackedId != null && p.id === trackedId;
            const band = cirLaneY(p.tier, g);
            return (
              <rect key={p.id}
                x={r.x} y={isTracked ? band.y0 + 2 : r.y}
                width={Math.max(CIR_PKT_MIN_W, r.w)} height={isTracked ? Math.max(2, band.y1 - band.y0 - 4) : r.h}
                fill={CIR_TIER_COLORS[p.tier >= 0 ? Math.min(CIR_LANES - 1, p.tier) : 0]}
                fillOpacity={isTracked ? 1 : p.fits === false ? CIR_ALPHA_OFF : CIR_ALPHA_ON}
                stroke={isTracked ? "var(--y-50)" : undefined}
                strokeWidth={isTracked ? 1.5 : undefined}
                style={{ cursor: "pointer" }}
                onClick={() => onPickTx(p.id)}>
                <title>{`${ShortHash(p.id)} · ${fmtPcn(p.perB)} pcn/B · ${fmtBytes(p.size)} · ${fmtBytes(p.ahead)} of weight ahead · ${p.tier >= 0 ? FEE_TIER_LABELS[p.tier] : "—"}`}</title>
              </rect>
            );
          })}
          {vias.map((v) => {
            const x = cirX(v.at, g);
            const a = cirLaneY(v.from, g).mid;
            const b = cirLaneY(v.to, g).mid;
            return (
              <g key={`v${v.from}`}>
                <line x1={x} y1={a} x2={x} y2={b} stroke="var(--ink-40)" />
                <circle cx={x} cy={a} r={2.6} fill="var(--bg-0)" stroke="var(--ink-40)" />
                <circle cx={x} cy={b} r={2.6} fill="var(--bg-0)" stroke="var(--ink-40)" />
              </g>
            );
          })}
          {dieX != null ? (
            <>
              <line x1={dieX} y1={dieTop} x2={dieX} y2={dieBot} stroke="var(--g-50)" strokeDasharray="4 3" />
              <rect x={dieX} y={dieTop} width={Math.max(0, g.right - dieX)} height={dieBot - dieTop}
                fill="none" stroke={trackedId && !trackedP ? "var(--y-50)" : "var(--o-60)"}
                strokeWidth={trackedId && !trackedP ? 1.5 : 1} />
              {g.right - dieX > 40 ? (
                <circle cx={dieX + 11} cy={dieTop + 11} r={4.5} fill="none" stroke="var(--o-60)" />
              ) : null}
            </>
          ) : null}
          {trackedP && trackedRect ? (
            <>
              <line x1={g.left} y1={cirLaneY(trackedP.tier, g).y0} x2={g.right} y2={cirLaneY(trackedP.tier, g).y0}
                stroke="var(--y-50)" strokeOpacity={0.5} />
              <line x1={g.left} y1={cirLaneY(trackedP.tier, g).y1} x2={g.right} y2={cirLaneY(trackedP.tier, g).y1}
                stroke="var(--y-50)" strokeOpacity={0.5} />
              <line x1={trackedRect.x + trackedRect.w} y1={cirLaneY(trackedP.tier, g).mid} x2={g.right} y2={cirLaneY(trackedP.tier, g).mid}
                stroke="var(--y-50)" strokeWidth={1.5} strokeOpacity={0.9} />
            </>
          ) : null}
        </svg>
      ) : null}
      {/* The labels are DOM here too, so the two stages read identically and
          scenario 6's collision sweep sees the same nodes in both states. */}
      {m.ready ? FEE_TIER_LABELS.map((label, tier) => (
        <span key={`sl${label}`} className="mono cir-lane" style={{ position: "absolute", left: 0, top: cirLaneY(tier, g).mid }}>{label}</span>
      )) : null}
      {m.ready ? depthTicks.map((b) => (
        <span key={`sd${b}`} className="mono cir-axis" style={{ position: "absolute", left: cirX(b, g), top: g.bottom + 4, transform: cirAxisShift(cirX(b, g), g) }}>
          {b === 0 ? "chip" : fmtDepth(b)}
        </span>
      )) : null}
      {m.ready && dieX != null ? (
        <span className="mono cir-die" style={{ position: "absolute", left: dieX, top: 2, transform: cirLabelShift(dieX, g) }}>
          {field.dieFull ? "next block · whole pool fits" : "next block"}
        </span>
      ) : null}
      {m.ready && trackedP && trackedRect ? (
        <span className="mono cir-track" data-track-idiom="circuit" data-tracked-tx={trackedP.id}
          style={{
            position: "absolute", top: CIR_LABEL_ROW,
            left: trackedRect.x + trackedRect.w,
            transform: cirLabelShift(trackedRect.x + trackedRect.w, g),
          }}>
          {trackedP.fits && field.limit > 0 ? "on the die" : `${fmtDepth(trackedP.ahead)} ahead`}
        </span>
      ) : null}
      {m.ready && trackedId && !trackedP && dieX != null ? (
        <span className="mono cir-track" data-track-idiom="circuit" data-tracked-tx={trackedId}
          style={{ position: "absolute", top: CIR_LABEL_ROW, left: (dieX + g.right) / 2, transform: "translateX(-50%)" }}>
          on the die
        </span>
      ) : null}
    </div>
  );
}
