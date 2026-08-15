/**
 * design/timeCursor.ts — the shared time cursor (D0834), as TIMESTAMPS.
 *
 * A LEAF WITH A BUNDLING JOB — `design/canvasColor.ts`'s rule, applied a second
 * time and for the same measured reason. The obvious home for this was
 * `design/chart-kit.tsx`: it already owns every cursor primitive on the site.
 * It is also EAGER — `design/primitives.tsx:19` imports chart-kit and the entry
 * chunk imports primitives, which is not an inference here but a measurement:
 * chart-kit's `data-charttip` and its `rgba(8,7,5,0.94)` tooltip fill are both
 * present in `dist/assets/index-*.js`, the file `dist/index.html` names in its
 * own `<script src>`. Anything added there is first-paint bytes on `/`,
 * `/monero`, `/operate/node` — every route, including the twelve that have no
 * chart at all. So this lives in its own module whose importers are ALL lazy.
 * Import it from an eagerly-reachable module and the whole thing moves to first
 * paint. The rule is written here, in canvasColor's header, and in
 * verify-bundle's — and verify-bundle's copy carries a MEASUREMENT of what does
 * and does not catch a violation, because the first draft of this very
 * paragraph guessed ("eagerJsRaw would swallow it, there is no gate") and the
 * guess was half wrong in both directions.
 *
 * ── WHY TIMESTAMPS, NOT PIXELS ────────────────────────────────────────
 *
 * The four time-axis charts on /live/markets do not share a geometry and do not
 * share a DOMAIN. The hero can be brush-zoomed to two days while the two group
 * charts still show thirty; the ratio chart tracks the hero's window; each has
 * its own padL, its own innerW, its own viewBox. A pixel is meaningless across
 * that boundary and a fraction is worse — it looks portable and silently means
 * a different moment in every chart.
 *
 * So the shared value is a moment in time, and each chart projects it through
 * its OWN geometry with its OWN existing mapping. Two consequences worth
 * stating, because both are load-bearing:
 *
 *  1. This module contains NO pixel arithmetic — no `clientX`, no rect, no
 *     viewBox conversion. `verify-chartkit` asserts that `clientX - rect.left`
 *     appears in exactly one file in the tree (chart-kit), and that assertion
 *     stays satisfied BY CONSTRUCTION rather than by an exemption: the write
 *     side still goes through chart-kit's `useSvgCursor` / `canvasCursor`, and
 *     what reaches this store is already a timestamp.
 *
 *  2. A chart whose domain does not contain the cursor draws NOTHING. It must
 *     never clamp to its own edge — a clamped crosshair asserts that the reader
 *     is pointing at a moment the chart does not cover, which is the same class
 *     of lie as a synthesised price. `containsT()` is the shared predicate and
 *     every consumer goes through it.
 *
 * ── WHY IT IS NOT REACT STATE ─────────────────────────────────────────
 *
 * This is the highest-frequency input surface on the site: a pointermove over
 * the hero fires at the pointer's sample rate, and the naive design re-renders
 * four charts per event — one of which rebuilds several hundred SVG nodes.
 * Subscribers are called from ONE rAF, so N writes in a frame produce exactly
 * one notification, and consumers mutate their own canvas or their own DOM
 * nodes through refs rather than re-rendering. `verify-vitals` measures the
 * scripted-interaction budget this is protecting.
 *
 * The WRITE side is deliberately left alone: the chart under the pointer still
 * re-renders exactly as it did before this module existed (chart-kit's
 * `useSvgCursor` holds `vx` in React state, and the hero held its own
 * `cursorT`). The sync therefore adds ZERO renders relative to the base
 * commit — three charts that would have re-rendered do not, and the fourth
 * behaves as it always did.
 */

import * as React from "react";

export interface TimeCursorState {
  /** ms since epoch, or null when nothing is hovered or pinned. */
  t: number | null;
  /** A pinned cursor survives pointerleave — the touch and keyboard path. */
  pinned: boolean;
}

const state: TimeCursorState = { t: null, pinned: false };
const listeners = new Set<(s: TimeCursorState) => void>();

/* ONE frame, one notification. `frame` is a plain flag rather than a handle
   because nothing here ever needs to cancel: the flush reads `state` at flush
   time, so a write that lands after the frame is scheduled is included in it
   and a write that lands after the flush schedules the next one. Coalescing can
   therefore never drop the LAST value, which is the only one that matters. */
let frame = false;
const raf: (cb: () => void) => void =
  typeof requestAnimationFrame === "function"
    ? (cb) => { requestAnimationFrame(cb); }
    // Prerender (`scripts/prerender.mjs` runs this app under Node) and any
    // environment without rAF. Never left as a bare call: a module-scope
    // reference to requestAnimationFrame would throw at import time in SSR.
    : (cb) => { setTimeout(cb, 16); };

function notify(): void {
  if (frame) return;
  frame = true;
  raf(() => { frame = false; for (const l of listeners) l(state); });
}

/** Current value. Read it in an effect; do not derive render output from it. */
export function getTimeCursor(): TimeCursorState {
  return state;
}

export function subscribeTimeCursor(fn: (s: TimeCursorState) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Hover write. A pinned cursor ignores hover — that is what pinning means. */
export function setTimeCursor(t: number | null): void {
  if (state.pinned) return;
  if (state.t === t) return;
  state.t = t;
  notify();
}

/** Pointer left a chart. Clears the hover cursor; a pin survives. */
export function clearTimeCursor(): void {
  setTimeCursor(null);
}

/**
 * Tap-to-pin / tap-again-to-release, and the keyboard's only verb.
 * Re-pinning at a DIFFERENT moment moves the pin rather than releasing it —
 * releasing on every tap would make a second tap elsewhere feel like a dropped
 * input. `tol` is the "same moment" window; callers pass their own bucket
 * width, because "the same moment" is a different number on a 4h candle and on
 * a daily sample.
 */
export function toggleTimeCursorPin(t: number, tol = 0): void {
  if (state.pinned && state.t != null && Math.abs(state.t - t) <= tol) {
    state.pinned = false;
    state.t = null;
  } else {
    state.pinned = true;
    state.t = t;
  }
  notify();
}

export function releaseTimeCursorPin(): void {
  if (!state.pinned) return;
  state.pinned = false;
  state.t = null;
  notify();
}

/**
 * THE DOMAIN-MISMATCH PREDICATE. `null` in, `false` out — so the caller's guard
 * is one expression and the "nothing hovered" and "outside my window" cases
 * cannot accidentally diverge. NEVER paired with a clamp at a call site; if you
 * find yourself wanting `Math.min(hi, Math.max(lo, t))` next to this, the chart
 * is about to claim a reading it does not have.
 */
export function containsT(t: number | null, from: number, to: number): t is number {
  return t != null && t >= from && t <= to;
}

/**
 * Subscribe, and apply the current cursor imperatively.
 *
 * DELIBERATELY NO DEPENDENCY ARRAY. `apply` runs after every render of the
 * consuming component as well as on every store change, and that second half is
 * not incidental: the chart under the pointer DOES re-render (its own
 * `useSvgCursor` state), and a re-render rebuilds the very SVG nodes the
 * previous apply mutated. Without the post-render re-apply, the hovered chart
 * would drop its own crosshair on alternate frames — visible, intermittent, and
 * exactly the kind of defect that reproduces only under a real pointer.
 *
 * Re-subscribing each render costs one Set delete plus one Set add.
 */
export function useTimeCursorSync(apply: (s: TimeCursorState) => void): void {
  const ref = React.useRef(apply);
  ref.current = apply;
  React.useEffect(() => {
    const fn = (s: TimeCursorState) => ref.current(s);
    fn(state);
    return subscribeTimeCursor(fn);
  });
}

/**
 * The whole receiving contract in one call: guard on THIS chart's domain, then
 * project through THIS chart's mapping, and hand the consumer both the pixel
 * and the moment. `apply(null, null)` means "draw nothing" and is delivered for
 * both reasons — no cursor at all, and a cursor this chart does not cover —
 * because a consumer must treat them identically. Any caller that wanted to
 * tell them apart would be about to draw something at an edge.
 *
 * `xOf` is the chart's OWN projection, passed in rather than derived, because
 * the four charts have four of them: the hero's has a left gutter, the brush
 * strip's is full-bleed, `MultiLine`'s runs over its common time domain and
 * `AreaSeries`' interpolates between index-spaced samples.
 */
export function useProjectedCursor(
  from: number,
  to: number,
  xOf: (t: number) => number,
  apply: (x: number | null, t: number | null) => void,
): void {
  const ref = React.useRef({ from, to, xOf, apply });
  ref.current = { from, to, xOf, apply };
  useTimeCursorSync((s) => {
    const c = ref.current;
    if (!containsT(s.t, c.from, c.to)) { c.apply(null, null); return; }
    c.apply(c.xOf(s.t), s.t);
  });
}
