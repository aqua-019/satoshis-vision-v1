/**
 * pages/markets/geometry.ts — pure geometry/math for MultiLine (charts.tsx).
 *
 * Zero runtime dependency on anything else in the app (`import type` only,
 * from useMarketHistory) so it can be imported directly by Node's built-in
 * TS type-stripping in verify-multiline.mjs — the same trick verify-stale.mjs
 * uses for useMarketHistory.ts. No JSX here, ever.
 *
 * Series arriving at MultiLine have DIFFERENT point counts and time spans (a
 * small-cap coin may have 17 daily points where BTC has 720 hourly ones), so
 * every series is placed on a shared TIME domain rather than stretched
 * edge-to-edge by index — a series covering only the tail of the window
 * occupies only that tail on the axis. No padding, no interpolation, no
 * synthesised points: honesty about coverage is the whole point.
 */

import type { LineSeries, SeriesStatus } from "@/data/useMarketHistory";

export interface NormPoint {
  t: number;
  v: number;
}

export interface NormSeries {
  label: string;
  color: string;
  status: SeriesStatus;
  /** Value runs, broken wherever a source point was invalid (dropped) or the
   *  time gap to the next valid point was too large to draw a straight line
   *  across (see splitSegments). Never contains a non-finite `v`. */
  segments: NormPoint[][];
  /** Total valid (rendered) points across all segments. */
  count: number;
  /** Last valid normalized value, or null when the series has none at all. */
  last: number | null;
}

const DEFAULT_GAP_FACTOR = 3;

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Median Δt between consecutive points. 0 when fewer than 2 points (not
 *  enough data to establish a cadence). */
export function medianStep(pts: NormPoint[]): number {
  if (pts.length < 2) return 0;
  const steps: number[] = [];
  for (let i = 1; i < pts.length; i++) steps.push(pts[i].t - pts[i - 1].t);
  return median(steps);
}

/**
 * Break `pts` into runs. A run breaks wherever:
 *   - a point is non-finite (`v` NaN/Infinity — a dropped source value): the
 *     invalid point itself is discarded, but its position forces a break on
 *     either side of it, or
 *   - the time gap between two consecutive VALID points exceeds `gapFactor` ×
 *     the median step of the valid points.
 * Segments of length 0 never appear in the output. Points are otherwise kept
 * in input order.
 */
export function splitSegments(pts: NormPoint[], gapFactor = DEFAULT_GAP_FACTOR): NormPoint[][] {
  const valid = pts.filter((p) => Number.isFinite(p.v));
  const step = medianStep(valid);

  const out: NormPoint[][] = [];
  let cur: NormPoint[] = [];
  let prevT: number | null = null;

  for (const p of pts) {
    if (!Number.isFinite(p.v)) {
      if (cur.length) out.push(cur);
      cur = [];
      prevT = null;
      continue;
    }
    if (prevT != null && step > 0 && p.t - prevT > gapFactor * step) {
      if (cur.length) out.push(cur);
      cur = [];
    }
    cur.push(p);
    prevT = p.t;
  }
  if (cur.length) out.push(cur);
  return out;
}

/**
 * Normalize one raw series into %-gain-from-first-positive-value points,
 * broken into honest segments.
 *
 * Base stays the first surviving positive value (`data.find(v => v > 0)`,
 * unchanged from the pre-fix semantics). Null/NaN/0/negative input values
 * never survive normalization (no more `-100` fabricated from a `null`); when
 * NO positive base exists at all the series has nothing to normalize against,
 * so it comes back with empty segments and `last: null` rather than dividing
 * by garbage.
 *
 * Points with no real timestamp (`s.t` absent or short) get evenly-spaced
 * fallback timestamps across `[now - days*86400000, now]` — the same
 * fallback AreaSeries already uses at charts.tsx.
 */
export function normalizeSeries(s: LineSeries, days: number, now: number = Date.now()): NormSeries {
  const data = s.data ?? [];
  const n = data.length;
  const hasT = Array.isArray(s.t) && s.t.length === n && n > 0;
  const stepMs = n > 1 ? (days * 86_400_000) / (n - 1) : 0;
  const tAt = (i: number): number => (hasT ? (s.t as number[])[i] : now - (n - 1 - i) * stepMs);

  const base = data.find((v) => Number.isFinite(v) && v > 0);

  const raw: NormPoint[] = data.map((v, i) => {
    const t = tAt(i);
    if (base == null || !Number.isFinite(v) || v <= 0) return { t, v: NaN };
    return { t, v: (v / base - 1) * 100 };
  });

  const segments = base == null ? [] : splitSegments(raw);
  let count = 0;
  let last: number | null = null;
  for (const seg of segments) {
    count += seg.length;
    if (seg.length) last = seg[seg.length - 1].v;
  }

  return { label: s.label, color: s.color, status: s.status, segments, count, last };
}

/** Min/max timestamp across every point of every series, or null when
 *  nothing usable exists anywhere (all series empty). */
export function timeDomain(list: NormSeries[]): { t0: number; t1: number } | null {
  let t0 = Infinity;
  let t1 = -Infinity;
  for (const s of list) {
    for (const seg of s.segments) {
      for (const p of seg) {
        if (p.t < t0) t0 = p.t;
        if (p.t > t1) t1 = p.t;
      }
    }
  }
  return isFinite(t0) && isFinite(t1) ? { t0, t1 } : null;
}

/** Map a real timestamp to an x coordinate over the common time domain,
 *  clamped to the plot's inner width — a series covering only the tail of
 *  the window stops at that tail instead of stretching to fill the axis. */
export function xOf(t: number, domain: { t0: number; t1: number }, padL: number, innerW: number): number {
  const span = domain.t1 - domain.t0 || 1;
  const frac = Math.min(1, Math.max(0, (t - domain.t0) / span));
  return padL + frac * innerW;
}

/** y-domain of normalized %-gain values, always including 0 (unchanged from
 *  the pre-fix `Math.min(0, ...)` / `Math.max(0, ...)` semantics). */
export function yDomain(list: NormSeries[]): { min: number; max: number } {
  let min = 0;
  let max = 0;
  for (const s of list) {
    for (const seg of s.segments) {
      for (const p of seg) {
        if (p.v < min) min = p.v;
        if (p.v > max) max = p.v;
      }
    }
  }
  return { min, max };
}

/**
 * Greedy label de-collision: sort by y, then nudge each label down just
 * enough to keep `minGap` from the previous (already-nudged) label. Returns
 * an array the same length/order as the input — only the values move, so a
 * caller can zip it back against its original series list by index.
 */
export function dedupeLabelYs(ys: number[], minGap = 11): number[] {
  const order = ys.map((_, i) => i).sort((a, b) => ys[a] - ys[b]);
  const out = ys.slice();
  for (let k = 1; k < order.length; k++) {
    const prev = order[k - 1];
    const cur = order[k];
    if (out[cur] - out[prev] < minGap) out[cur] = out[prev] + minGap;
  }
  return out;
}
