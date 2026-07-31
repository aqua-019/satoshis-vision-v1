/**
 * data/histogram.ts — real-sample binning for fee-rate and block-interval
 * histograms.
 *
 * Lifted verbatim (binning logic unchanged) out of pages/NetworkPage.tsx so
 * mempool detail views can bin the same real per-tx fee rates and real block
 * intervals without duplicating (and risking drift from) NetworkPage's
 * honest-binning rules: log-spacing when the range spans >10x, a minimum
 * sample floor before binning at all, and empty-array returns (never zeros)
 * when the sample is too small to bin honestly.
 */

/** Median of a numeric series (ignores non-finite). */
function median(nums: number[]): number {
  const a = nums.filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return 0;
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/** Compact piconero/B axis label (e.g. 20k, 1.2M). */
function fmtPcnB(v: number): string {
  if (v >= 1e6) return (v / 1e6).toFixed(v >= 1e7 ? 0 : 1) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(v >= 1e4 ? 0 : 1) + "k";
  return String(Math.round(v));
}

/** Compact seconds label for interval bin edges (e.g. 45s, 2.5m, 12m). */
function fmtSecs(s: number): string {
  if (s >= 120) return (s / 60).toFixed(s >= 600 ? 0 : 1) + "m";
  return Math.round(s) + "s";
}

/** Bin real per-tx fee rates (Tx.perB, piconero/B) into a histogram with real
 *  bin-edge labels. Log-spaced when the range spans >10×, else linear. Returns
 *  empty arrays when the mempool sample is too small to bin honestly. */
export function feeRateHistogram(perB: number[], bins = 10): { counts: number[]; labels: string[] } {
  const vals = perB.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (vals.length < 4) return { counts: [], labels: [] };
  const min = vals[0], max = vals[vals.length - 1];
  if (max <= min) return { counts: [vals.length], labels: [fmtPcnB(min)] };
  const useLog = max / Math.max(1, min) > 10;
  const edges: number[] = [];
  for (let i = 0; i <= bins; i++) {
    const f = i / bins;
    edges.push(useLog ? min * Math.pow(max / min, f) : min + (max - min) * f);
  }
  const counts = new Array(bins).fill(0);
  for (const v of vals) {
    let b = bins - 1;
    for (let i = 0; i < bins; i++) { if (v < edges[i + 1]) { b = i; break; } }
    counts[b]++;
  }
  return { counts, labels: counts.map((_, i) => fmtPcnB(edges[i])) };
}

/** Bin real block intervals (seconds) into a linear histogram with real
 *  second-valued bin-edge labels, plus the median bin index for the on-chart
 *  marker. Returns empty arrays when the sample is too small to bin honestly. */
export function intervalHistogram(intervals: number[], bins = 12): {
  counts: number[]; labels: string[]; medBin: number; med: number; mean: number;
} {
  if (intervals.length < 4) return { counts: [], labels: [], medBin: -1, med: 0, mean: 0 };
  const sorted = [...intervals].sort((a, b) => a - b);
  const lo = sorted[0];
  const span = Math.max(1, sorted[sorted.length - 1] - lo);
  const counts = new Array(bins).fill(0);
  const binOf = (v: number) => Math.min(bins - 1, Math.max(0, Math.floor(((v - lo) / span) * bins)));
  for (const v of intervals) counts[binOf(v)]++;
  const med = median(intervals);
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  return {
    counts,
    labels: counts.map((_, i) => fmtSecs(lo + (i / bins) * span)),
    medBin: binOf(med),
    med,
    mean,
  };
}
