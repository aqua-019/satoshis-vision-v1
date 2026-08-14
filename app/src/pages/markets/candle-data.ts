/**
 * pages/markets/candle-data.ts — the granularity ladder for the Markets hero.
 *
 * THE DISEASE, MEASURED RATHER THAN ASSUMED. Before this module, /live/markets
 * drew whatever CoinGecko's `/coins/{id}/ohlc` returned for the selected range,
 * one bucket per bar. Counted on a build of 84e2b77 with the upstream mocked at
 * its OWN documented granularity: 7D 42 · 30D 180 · 90D **22** · 1Y 91. So the
 * sparseness is NOT at 30D (which is already 180 four-hour bars) — it is at
 * 90D, where CoinGecko switches to FOUR-DAY buckets and 22 bars have to carry a
 * quarter of a year.
 *
 * WHAT THE UPSTREAM WILL ACTUALLY GIVE. Two endpoints, two granularity tables,
 * neither negotiable on the free/demo tier (the `interval=` override is
 * enterprise-only):
 *
 *   /coins/{id}/ohlc          1-2d -> 30m · 3-30d -> 4h  · 31d+ -> 4d
 *   /coins/{id}/market_chart  <=1d -> 5m  · 2-90d -> 1h  · >90d -> 1d
 *
 * There is no request that returns four-hour candles for a year. That is the
 * hard constraint the mockup's synthetic base (13,200 four-hour candles across
 * 2,200 days) does not model, and it is why this file has THREE bases rather
 * than the mockup's one:
 *
 *   FINE  ohlc?days=30         4h TRUE OHLC, 180 bars, 30-day span
 *   MID   market_chart?days=90 hourly samples, 2,160 pts, 90-day span
 *   DEEP  market_chart?days=365 daily samples, 365 pts, 365-day span
 *
 * TRUE vs DERIVED, and why the distinction is on the face of the chart. A FINE
 * bar is CoinGecko's own OHLC over full tick data, and aggregating k of them is
 * EXACT (max of highs, min of lows, first open, last close). A MID or DEEP bar
 * is built here from a price series, so its high and low are the extremes of
 * the SAMPLES, not of the market — a real derivation from real data, never a
 * synthesis, but it understates wicks and the label says which one you are
 * looking at ("4h · CG OHLC" vs "6h · hourly samples").
 *
 * MIN_SAMPLES IS WHY A DERIVED LADDER DOES NOT START AT ITS OWN SAMPLE
 * INTERVAL. One sample in a bucket gives o = h = l = c: a doji, at every bar,
 * forever. Two gives a body and no wicks. So a derived bucket must hold at
 * least THREE samples before it is allowed to call itself a candle, which is
 * what makes the hourly ladder start at 3h and the daily ladder at 3d. Drawing
 * 365 daily dojis at 1Y would have been denser than the 91 bars it replaced and
 * strictly less informative.
 *
 * NEVER INTERPOLATE. Buckets are keyed on TIME, not on source index, so a gap
 * in the upstream produces a bucket with nothing in it and that bucket is
 * omitted — the slot stays blank and the gap is drawn as a gap. Indexing would
 * have closed the hole by silently shifting every later bar.
 */

import type { Candle, PriceSamples } from "@/data/useMarketHistory";
import { estTextW } from "@/design/useChartMetrics";

export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

/** The most candles worth drawing. Above this, bars stop being resolvable and
 *  the ladder steps to the next coarser bucket. */
export const MAX_DRAWN = 420;

/** A derived bucket needs this many samples before it has an honest wick. */
export const MIN_SAMPLES = 3;

/** Candle body width as a fraction of its slot. A RATIO, never a pixel cap —
 *  a fixed ceiling is what made 30D read as sparse (a 9px body centred in a
 *  41px slot is a chart of gaps), and it makes the same window read differently
 *  at two viewport widths for no reason the data supports. */
export const BODY_FILL = 0.86;

/* ── the three bases ─────────────────────────────────────────────────── */

export type BaseKey = "fine" | "mid" | "deep";

export interface BaseSpec {
  /** the `days` value this base is fetched at */
  days: number;
  /** source interval in ms */
  unitMs: number;
  /** true OHLC from the upstream, or derived here from a price series */
  derived: boolean;
  /** allowed bucket sizes, as multiples of unitMs, coarsest last */
  ladder: readonly number[];
  /** what to call the source in a granularity label */
  sourceLabel: string;
}

export const BASES: Record<BaseKey, BaseSpec> = {
  // 4h · 12h · 1d · 3d · 1w · 3w — the mockup's own ladder, whose unit happens
  // to be exactly what CoinGecko serves at days=30.
  fine: { days: 30, unitMs: 4 * HOUR_MS, derived: false, ladder: [1, 3, 6, 18, 42, 126], sourceLabel: "CG OHLC" },
  // 3h · 6h · 12h · 1d · 3d · 1w · 30d
  mid: { days: 90, unitMs: HOUR_MS, derived: true, ladder: [3, 6, 12, 24, 72, 168, 720], sourceLabel: "hourly samples" },
  // 3d · 6d · 12d · 30d · 90d
  deep: { days: 365, unitMs: DAY_MS, derived: true, ladder: [3, 6, 12, 30, 90], sourceLabel: "daily samples" },
};

/** Span each base covers, in ms. */
export const baseSpanMs = (k: BaseKey): number => BASES[k].days * DAY_MS;

/**
 * The finest base that COVERS a window of `spanMs`.
 *
 * Coverage, not preference: `fine` carries genuine four-hour OHLC but only 30
 * days of it, so a 45-day window has to step to `mid` even though `mid` is the
 * lower-fidelity source. Falls through to `deep`, which covers everything the
 * site fetches.
 */
export function pickBase(spanMs: number): BaseKey {
  if (spanMs <= baseSpanMs("fine")) return "fine";
  if (spanMs <= baseSpanMs("mid")) return "mid";
  return "deep";
}

/** Bucket size in ms for a window on a base: the finest rung of that base's
 *  ladder whose bar count fits MAX_DRAWN, else the coarsest rung there is. */
export function pickBucketMs(base: BaseKey, spanMs: number): number {
  const { unitMs, ladder } = BASES[base];
  for (const k of ladder) if (Math.ceil(spanMs / (unitMs * k)) <= MAX_DRAWN) return unitMs * k;
  return unitMs * ladder[ladder.length - 1];
}

/** "4h" / "12h" / "3d" / "2w" — a duration, not a date. */
export function bucketLabel(ms: number): string {
  if (ms % (7 * DAY_MS) === 0 && ms >= 7 * DAY_MS) return `${ms / (7 * DAY_MS)}w`;
  if (ms % DAY_MS === 0) return `${ms / DAY_MS}d`;
  if (ms % HOUR_MS === 0) return `${ms / HOUR_MS}h`;
  return `${Math.round(ms / 60_000)}m`;
}

/**
 * The line under the panel title, and the ONE place the chart says how it was
 * built: bucket size plus the source that bucket came from. Aggregating true
 * OHLC keeps saying "CG OHLC" because it stays exact; a derived bar says
 * "hourly samples" / "daily samples" because its wicks are sampled, and a
 * reader is entitled to know that before reading a wick.
 */
export function candleGranularityLabel(base: BaseKey, bucketMs: number): string {
  return `${bucketLabel(bucketMs)} · ${BASES[base].sourceLabel}`;
}

/**
 * The COMPACT form, for the panel badge. Same two facts — bucket size and
 * whether the wicks are the market's or a sample's — in about half the glyphs.
 *
 * It exists because the full label wrapped `PanelFrame`'s header to three lines
 * at 390px beside the provenance chip. That wrap is pre-existing shared
 * behaviour (three previous view PRs recorded it); the only part of it that was
 * mine was the string length, so the string is what gives way. The FULL label
 * stays on `data-candle-gran` and in the table caption, where there is room for
 * it and where a gate reads it.
 */
export function candleGranularityShort(base: BaseKey, bucketMs: number): string {
  return `${bucketLabel(bucketMs)} ${BASES[base].derived ? "sampled" : "OHLC"}`;
}

/* ── bucketing ───────────────────────────────────────────────────────── */

/* `PriceSamples` is declared ONCE, in the data layer that produces it
   (data/useMarketHistory.ts), and imported here as a type. A second structurally
   identical declaration would type-check forever — TypeScript is structural —
   and drift silently the day one of them gains a field. */

const bucketStart = (t: number, bucketMs: number): number => Math.floor(t / bucketMs) * bucketMs;

/**
 * Aggregate TRUE OHLC candles into `bucketMs` buckets. Exact: the extremes of a
 * union of intervals are the extremes of their extremes. `from`/`to` clip to
 * the drawn window before grouping so a partial edge bucket is built from the
 * candles actually inside it.
 */
export function aggregateCandles(src: Candle[], bucketMs: number, from: number, to: number): Candle[] {
  const out: Candle[] = [];
  let cur: Candle | null = null;
  let key = NaN;
  for (const c of src) {
    if (c.t < from || c.t > to) continue;
    const k = bucketStart(c.t, bucketMs);
    if (cur === null || k !== key) {
      if (cur) out.push(cur);
      key = k;
      cur = { t: k, o: c.o, h: c.h, l: c.l, c: c.c, v: c.v };
      continue;
    }
    cur.h = Math.max(cur.h, c.h);
    cur.l = Math.min(cur.l, c.l);
    cur.c = c.c;
    cur.v += c.v;
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * Build candles from a price series. o = first sample in the bucket, c = last,
 * h/l = the sampled extremes, v = the summed sample volumes.
 *
 * A bucket holding fewer than MIN_SAMPLES is still EMITTED — dropping it would
 * punch a hole in a window whose data is genuinely continuous, and the caller
 * has already chosen a bucket size that gives MIN_SAMPLES on a complete series.
 * A short bucket here means the upstream itself was short there, which is a
 * fact about the data and shows up honestly as a thin bar. A bucket holding
 * ZERO samples is never emitted at all: that is the gap.
 */
export type { PriceSamples };

export function samplesToCandles(s: PriceSamples, bucketMs: number, from: number, to: number): Candle[] {
  const out: Candle[] = [];
  let cur: Candle | null = null;
  let key = NaN;
  for (let i = 0; i < s.t.length; i++) {
    const t = s.t[i], p = s.p[i];
    if (t < from || t > to || !Number.isFinite(p)) continue;
    const vol = Number.isFinite(s.v[i]) ? s.v[i] : 0;
    const k = bucketStart(t, bucketMs);
    if (cur === null || k !== key) {
      if (cur) out.push(cur);
      key = k;
      cur = { t: k, o: p, h: p, l: p, c: p, v: vol };
      continue;
    }
    if (p > cur.h) cur.h = p;
    if (p < cur.l) cur.l = p;
    cur.c = p;
    cur.v += vol;
  }
  if (cur) out.push(cur);
  return out;
}

/** Everything the hero needs to know about what it is about to draw. */
export interface DrawnSeries {
  candles: Candle[];
  base: BaseKey;
  bucketMs: number;
  granularity: string;
  /** the same two facts in half the glyphs — for the panel badge */
  granularityShort: string;
  /** true when h/l are sampled extremes rather than the upstream's own OHLC */
  derived: boolean;
}

/**
 * Resolve a window to a drawable series. `fine` is only offered when the window
 * fits inside it AND the upstream actually answered for it — a base with no
 * data falls through rather than rendering an empty chart beside a live one.
 */
export function resolveSeries(
  from: number,
  to: number,
  sources: { fine: Candle[] | null; mid: PriceSamples | null; deep: PriceSamples | null },
): DrawnSeries | null {
  const span = Math.max(1, to - from);
  const order: BaseKey[] = [pickBase(span), "mid", "deep"];
  const seen = new Set<BaseKey>();
  for (const base of order) {
    if (seen.has(base)) continue;
    seen.add(base);
    const bucketMs = pickBucketMs(base, span);
    let candles: Candle[] = [];
    if (base === "fine" && sources.fine?.length) candles = aggregateCandles(sources.fine, bucketMs, from, to);
    else if (base === "mid" && sources.mid?.t.length) candles = samplesToCandles(sources.mid, bucketMs, from, to);
    else if (base === "deep" && sources.deep?.t.length) candles = samplesToCandles(sources.deep, bucketMs, from, to);
    if (candles.length) {
      return {
        candles, base, bucketMs,
        granularity: candleGranularityLabel(base, bucketMs),
        granularityShort: candleGranularityShort(base, bucketMs),
        derived: BASES[base].derived,
      };
    }
  }
  return null;
}

/* ── the date axis (§4) ──────────────────────────────────────────────── */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * THE FORMAT IS CHOSEN BY TICK SPACING, NOT BY TOTAL SPAN — and that is a
 * correction to the mockup, made by looking at the render.
 *
 * Keying on the span is the obvious rule and it produced this, measured at 90D
 * with nine ticks ten days apart:
 *
 *     May '26   May '26   May '26   Jun '26   Jun '26   Jun '26   Jul '26 …
 *
 * Every label true, three distinct strings across nine positions, and an axis
 * you cannot interpolate against — which is the only thing an axis is for. The
 * span said "months", the ticks were ten days apart, and only the ticks know
 * that. So the resolution question is asked of the STEP: a label must be able to
 * distinguish two ADJACENT ticks, or it is decoration.
 *
 * `stepMs` is the gap between neighbouring ticks. Under a day, tell the hour;
 * under ~25 days, name the day; under ~330, the month; beyond that, the year.
 */
export function fmtAxisDate(t: number, stepMs: number, spanMs = 0): string {
  const d = new Date(t);
  if (stepMs < DAY_MS) {
    const hh = `${String(d.getUTCHours()).padStart(2, "0")}:00`;
    /* A BARE HOUR IS ONLY UNAMBIGUOUS INSIDE ONE DAY, and the 7D preset is
       outside it: eight ticks across seven days is a step of ~21 hours, under a
       day, so the step rule alone emitted "05:00 · 02:00 · 23:00 …" — every
       label true, every one on a different date, and the sequence apparently
       running BACKWARDS because the hours wrap. Distinguishing adjacent ticks
       is necessary and not sufficient; a tick also has to be locatable. So the
       hour carries its day whenever the window spans more than one. */
    return spanMs < DAY_MS ? hh : `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${hh}`;
  }
  if (stepMs < 25 * DAY_MS) return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  if (stepMs < 330 * DAY_MS) return `${MONTHS[d.getUTCMonth()]} '${String(d.getUTCFullYear()).slice(2)}`;
  return String(d.getUTCFullYear());
}

/** Widest label a given tick spacing can produce, in characters. Drives the
 *  tick count, so the step is sized from the text rather than guessed. */
function axisLabelChars(stepMs: number, spanMs: number): number {
  if (stepMs < DAY_MS) return spanMs < DAY_MS ? 5 : 12;  // "00:00" | "12 Mar 00:00"
  if (stepMs < 25 * DAY_MS) return 6;     // "12 Mar"
  if (stepMs < 330 * DAY_MS) return 7;    // "Mar '25"
  return 4;                                // "2025"
}

/**
 * Date ticks on a UNIFORM step across the window, with the count derived from
 * how wide the widest label can be — the pulse time-ladder argument: labels
 * that cannot collide by construction beat labels de-collided afterwards.
 * One em of breathing room between neighbours, the same budget `labelStep`
 * already uses everywhere else in this app.
 */
export function axisTicks(t0: number, t1: number, innerPx: number, fontPx: number): number[] {
  const span = Math.max(1, t1 - t0);
  // Two passes, because the two quantities define each other: the label width
  // sets how many ticks fit, and the tick spacing sets which label is used.
  // Start from the span's own spacing guess, then re-solve once with the width
  // that spacing actually implies. It converges in one step for every ladder
  // rung here, and a fixed point is not needed — a slightly generous width only
  // ever costs a tick, never a collision.
  let n = 6;
  for (let pass = 0; pass < 2; pass++) {
    const need = estTextW(axisLabelChars(span / n, span), fontPx) + fontPx;
    n = Math.min(8, Math.max(2, Math.floor(innerPx / Math.max(1, need))));
  }
  return Array.from({ length: n + 1 }, (_, i) => t0 + (span * i) / n);
}

/** The gap between neighbouring ticks — what `fmtAxisDate` must be given. */
export function axisStepMs(ticks: number[]): number {
  return ticks.length > 1 ? ticks[1] - ticks[0] : DAY_MS;
}

/** Table stride: the accessible table lists every candle until that would run
 *  past `cap` rows, then every Nth — stated in the caption, never silently. */
export function tableStride(drawn: number, cap = 220): number {
  return Math.max(1, Math.ceil(drawn / cap));
}
