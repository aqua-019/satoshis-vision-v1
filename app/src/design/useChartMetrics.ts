/**
 * design/useChartMetrics.ts — the one place a chart learns how big it really is.
 *
 * WHY THIS EXISTS
 * ───────────────
 * Every chart and diagram in this app renders into a viewBox and lets CSS scale
 * it (`<svg viewBox="0 0 1000 320" width="100%">`). In SVG, `font-size` sets the
 * em box in USER UNITS — a CSS `px` length is converted at 1px = 1 user unit and
 * then scaled by the viewBox transform along with everything else. So on a 390px
 * phone, where that svg renders ~358 CSS px wide, `fontSize="9"` paints at
 *
 *     9 × 358 / 1000 ≈ 3.2 CSS px
 *
 * That — not the nominal 9 — is why chart labels were unreadable on a device.
 * Raising the attribute to 11 would have painted 3.9px and changed nothing.
 * Nor is there a CSS escape: `em`/`rem`/`vw` all resolve to a length and then
 * become user units, and SVG 2's `vector-effect: non-scaling-size` is not
 * implemented by any shipping engine (only `non-scaling-stroke` is real, and it
 * immunises stroke WIDTH, not glyph size).
 *
 * The fix is to make the scale known, in one of two modes:
 *
 *   FLUID (`vbWidth` omitted) — the viewBox width tracks the measured CSS width,
 *     so one user unit IS one CSS px and `k === 1`. Charts whose geometry is
 *     already derived from `W` use this: nothing needs a multiplier, and the
 *     number in the `fontSize` attribute is literally the rendered pixel size.
 *     This is the honest mode; prefer it.
 *
 *   FIXED (`vbWidth` given) — hand-placed diagrams with a designed aspect ratio
 *     keep their coordinate system, and `u(px)` converts a CSS-pixel intent into
 *     the user units that render at that size. `k` is capped by `maxK` so labels
 *     grow on a narrow screen without swallowing the artwork.
 *
 * Both modes give call sites the same shape — `fontSize={u(fs.tick)}` reads as
 * "I want this to be `fs.tick` CSS px on screen" — which is what makes the
 * ~129-site migration mechanical instead of a judgement call at every `<text>`.
 *
 * The measurement loop (rAF-deferred ResizeObserver + epsilon-guarded setState)
 * is the pattern already established by mempool/useFitToView.ts; it is copied
 * deliberately so both files fail the same way if it ever turns out to be wrong.
 */

import * as React from "react";

export interface ChartFontScale {
  /** axis ticks, in-chart annotations. --fs-chart-tick. */
  tick: number;
  /** series labels, value pills, tooltips. --fs-chart-label. */
  label: number;
}

export interface ChartMetrics {
  /** container width in CSS px. 0 until the first measure. */
  w: number;
  /** true once w > 0 — gate the <svg> on this so nothing paints at zero width. */
  ready: boolean;
  /** user units per CSS px. Exactly 1 in fluid mode. */
  k: number;
  /** CSS px → user units. Identity in fluid mode. THE migration call shape. */
  u: (px: number) => number;
  /** the resolved --fs-chart-* tokens, in CSS px. */
  fs: ChartFontScale;
  /**
   * FIXED mode: the narrowest the container may be before `k` would exceed
   * `maxK` — i.e. before labels would have to grow so much they overrun the
   * artwork. Apply it to the measuring wrapper; the artboard then PANS inside
   * `.proto-stage` (which scrolls on mobile) at a size where its labels are
   * both legible and non-overlapping, instead of being squeezed until they
   * collide. 0 in fluid mode, where there is nothing to pan.
   */
  minWidth: number;
}

export interface ChartMetricsOptions {
  /** Omit for FLUID mode. Provide the designed viewBox width for FIXED mode. */
  vbWidth?: number;
  /** FIXED mode only — cap on k, so text grows but never dominates. */
  maxK?: number;
}

/**
 * Mirrors the :root declarations in styles-legibility.css. Used before the first
 * measure and in any environment where the tokens don't resolve. Keep in sync —
 * verify-legibility.mjs asserts the CSS side, and this is the fallback for it.
 */
export const FS_FALLBACK: ChartFontScale = { tick: 11, label: 12 };

/**
 * Default cap for FIXED mode, and it is a legibility/geometry trade, not a
 * round number. `k` is how much a hand-placed artboard's type is inflated to
 * survive being scaled down. Past roughly 1.7 the labels stop fitting the
 * geometry they annotate: measured on /simulate?p=decoy at 390px with k≈3, the
 * axis caption "AGE OF OUTPUT ⟶ (days)" grew past the plot edge and every day
 * tick collided with it — legible text that no longer says anything.
 *
 * So the cap holds, and `minWidth` below lets the artboard pan instead. Panning
 * a readable diagram beats reading a whole unreadable one.
 */
const DEFAULT_MAX_K = 1.7;

/**
 * Read --fs-chart-tick / --fs-chart-label off a mounted element.
 *
 * These tokens are declared as PLAIN px, never clamp(): an unregistered custom
 * property computes to its token stream, so getComputedStyle would hand back the
 * literal string "clamp(11px, …)" and parseFloat would return 11 by accident
 * rather than by design. Plain px + a media-query override keeps CSS the single
 * source of truth for a number JS also needs, with no @property registration.
 */
export function readChartFontScale(el: Element): ChartFontScale {
  try {
    const cs = getComputedStyle(el);
    const tick = parseFloat(cs.getPropertyValue("--fs-chart-tick"));
    const label = parseFloat(cs.getPropertyValue("--fs-chart-label"));
    return {
      tick: Number.isFinite(tick) && tick > 0 ? tick : FS_FALLBACK.tick,
      label: Number.isFinite(label) && label > 0 ? label : FS_FALLBACK.label,
    };
  } catch {
    return FS_FALLBACK;
  }
}

/**
 * Advance-width estimate for a run of `chars` in var(--f-mono) at `fontPx`.
 * JetBrains Mono is monospaced at ~0.6em; 0.62 leaves a little slack so a
 * derived gutter errs wide rather than clipping.
 */
export function estTextW(chars: number, fontPx: number): number {
  return chars * fontPx * 0.62;
}

/**
 * Index step so that `n` labels of `avgChars` fit across `innerPx` without
 * touching. Replaces the hardcoded `Math.ceil(n / 7)` — seven date ticks is
 * fine at 1440px and unreadable at 390px, and the whole point of raising the
 * floor is lost if the labels then collide.
 */
export function labelStep(n: number, innerPx: number, fontPx: number, avgChars: number): number {
  if (n <= 1 || innerPx <= 0) return 1;
  const per = estTextW(avgChars, fontPx) + fontPx; // one em of breathing room
  const fits = Math.max(1, Math.floor(innerPx / per));
  return Math.max(1, Math.ceil(n / fits));
}

/** How many y ticks fit in `innerPx` of height at `fontPx`. Clamped to 2..5. */
export function tickCount(innerPx: number, fontPx: number): number {
  if (!(innerPx > 0)) return 2;
  return Math.max(2, Math.min(5, Math.floor(innerPx / (fontPx * 2.4))));
}

/**
 * 1-D de-collision. Pushes already-sorted-by-input y positions apart to at least
 * `min` separation while keeping them inside [lo, hi]. Returns a new array in
 * the SAME order as the input (not sorted order), so callers can zip it straight
 * back onto their series.
 */
export function spreadLabels(ys: number[], min: number, lo: number, hi: number): number[] {
  const n = ys.length;
  if (n === 0) return [];
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);

  // forward pass — push down
  for (let j = 1; j < n; j++) {
    if (order[j].y - order[j - 1].y < min) order[j].y = order[j - 1].y + min;
  }
  // backward pass — pull the overflow back up under the ceiling
  if (order[n - 1].y > hi) {
    order[n - 1].y = hi;
    for (let j = n - 2; j >= 0; j--) {
      if (order[j + 1].y - order[j].y < min) order[j].y = order[j + 1].y - min;
    }
  }
  // final clamp — if everything cannot fit, distribute evenly rather than stack
  if (order[0].y < lo) {
    const span = hi - lo;
    const step = n > 1 ? Math.min(min, span / (n - 1)) : 0;
    for (let j = 0; j < n; j++) order[j].y = lo + step * j;
  }

  const out = new Array<number>(n);
  for (const o of order) out[o.i] = o.y;
  return out;
}

export function useChartMetrics(
  ref: React.RefObject<HTMLElement>,
  opts?: ChartMetricsOptions,
): ChartMetrics {
  const vbWidth = opts?.vbWidth;
  const maxK = opts?.maxK ?? DEFAULT_MAX_K;

  const [st, setSt] = React.useState<{ w: number; fs: ChartFontScale }>({ w: 0, fs: FS_FALLBACK });

  // useLayoutEffect for the FIRST measure so nothing ever paints at zero width
  // (no flash, no CLS); the ResizeObserver handles everything after that.
  // SSR-safe: this module is only reached from client-rendered pages, but guard
  // anyway so an accidental server render doesn't throw.
  const useIso = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

  useIso(() => {
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    const measure = () => {
      raf = 0;
      // fractional on purpose — rounding is a 0.3% scale error AND a source of
      // ResizeObserver churn when the layout lands on a half pixel.
      const w = el.getBoundingClientRect().width;
      if (!(w > 0)) return;
      const fs = readChartFontScale(el);
      setSt((prev) =>
        Math.abs(prev.w - w) < 0.5 && prev.fs.tick === fs.tick && prev.fs.label === fs.label
          ? prev
          : { w, fs },
      );
    };
    // D0699-EXEMPT: one deferred measurement, not a loop
    const schedule = () => { if (!raf) raf = requestAnimationFrame(measure); };

    measure(); // synchronous first read — beats the first paint
    // Only the WRAPPER is observed. The <svg> inside is width:100% and cannot
    // widen it, and we never compare height — so our own output can't feed back
    // in and start a resize loop.
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    window.addEventListener("resize", schedule);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [ref]);

  const { w, fs } = st;
  const k = React.useMemo(() => {
    if (!vbWidth || !(w > 0)) return 1;
    return Math.min(maxK, Math.max(1, vbWidth / w));
  }, [vbWidth, maxK, w]);

  const u = React.useCallback((px: number) => px * k, [k]);

  // Below this width, k would have to exceed maxK to hold the type floor — so
  // the container stops shrinking and the artboard pans instead.
  const minWidth = vbWidth ? Math.ceil(vbWidth / maxK) : 0;

  return { w, ready: w > 0, k, u, fs, minWidth };
}
