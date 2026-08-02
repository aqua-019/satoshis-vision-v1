/**
 * Skeleton.tsx — structure-aware placeholders, and the swap into real content.
 *
 * D0851 / D0612.
 *
 * ── ONE PRIMITIVE, NOT FOUR ────────────────────────────────────────────────
 * Four bespoke skeletons would mean four crossfades and four reduced-motion
 * paths. The reduce contract has to be one thing, so the primitive is one
 * thing, parameterised.
 *
 * ── <Swap> MOUNTS THE CONTENT IMMEDIATELY, AT opacity 0 ────────────────────
 * This is the load-bearing decision and it is NOT an optimisation.
 *
 * `useChartMetrics` measures in a layout effect keyed on the ref OBJECT, whose
 * identity never changes — so the effect fires exactly once, on first render.
 * If a skeleton REPLACED the chart, `ref.current` would be null when that
 * effect ran, no ResizeObserver would ever attach, `ready` would stay false
 * forever, and the <svg> would never render at all. Nothing recovers it: the
 * resize listener lives in the same skipped effect. That is the exact cold-boot
 * bug `charts.tsx`'s EmptyBox was written to fix, and swapping a skeleton in
 * would reintroduce it on every measured surface at once.
 *
 * So the content is always in the tree and the skeleton is overlaid ON TOP,
 * absolutely positioned. The skeleton is a SIBLING of the measured box, never a
 * substitute for it. `charts.tsx` therefore needs no change: EmptyBox keeps its
 * ref-attached div.chart-box root in both branches, untouched.
 *
 * ── THE REDUCED-MOTION CONTRACT, BOTH HALVES ───────────────────────────────
 * The two moving parts are treated differently on purpose:
 *
 *   The CROSSFADE uses var(--d-3). styles.css zeroes the whole --d-* set under
 *   `prefers-reduced-motion: reduce`, so it collapses to a hard cut with no
 *   extra CSS. A hard swap is acceptable; the skeleton and the content look
 *   different, so arrival is still visible. An INVISIBLE swap would not be.
 *
 *   The SHIMMER is a LOOP, so it must NOT use --d-*: a zeroed loop is a stopped
 *   loop, mid-sweep, which reads as a rendering bug. It uses the repo's
 *   established `calc(<literal> / var(--tk-anim, 1))` idiom and is named in the
 *   reduce kill-list, so under reduce it becomes a STATIC box. Still says
 *   "reserved, not yet arrived"; loses nothing.
 *
 * ── COPY CONSTRAINT, load-bearing ──────────────────────────────────────────
 * No string here may match `SUSPENDED_RE` in entry-ssr.tsx —
 * /loading(\s+[a-z]+)?[….]|does not support Suspense/i — which is substring-
 * tested against every prerendered document, and a match FAILS THE BUILD on all
 * 11 routes with the message "still suspended", pointing at Suspense rather
 * than at the copy. Skeletons render during prerender (data is empty there), so
 * this is not hypothetical. The word "loading" is avoided outright rather than
 * carefully punctuated. verify-resilience.mjs asserts it against the real
 * regex, extracted from source rather than re-typed.
 */

import * as React from "react";

/** What a screen reader is told while a region is still waiting. Deliberately
 *  contains no form of the word "loading" — see the copy constraint above. */
const BUSY_LABEL = "waiting for data";

export interface SkeletonBoxProps {
  /** CSS width. Accepts any unit — `%`, `ch`, `px`. */
  w?: number | string;
  /** CSS height. Numbers are px. */
  h?: number | string;
  radius?: number;
  style?: React.CSSProperties;
}

/** One shimmering rectangle. The atom everything else is built from. */
export function SkeletonBox({ w = "100%", h = "1em", radius = 2, style }: SkeletonBoxProps) {
  return (
    <span
      className="sk-box"
      aria-hidden="true"
      style={{ width: w, height: h, borderRadius: radius, ...style }}
    />
  );
}

export interface SkeletonTextProps {
  lines?: number;
  /** Width of the last line, which reads as prose rather than as a block. */
  lastWidth?: string;
  gap?: number;
}

/** Prose rows. */
export function SkeletonText({ lines = 3, lastWidth = "62%", gap = 8 }: SkeletonTextProps) {
  return (
    <span className="sk-text" aria-hidden="true" style={{ gap }}>
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonBox key={i} w={i === lines - 1 ? lastWidth : "100%"} h="0.85em" />
      ))}
    </span>
  );
}

export interface SkeletonRowsProps {
  /** How many rows the real content will render. Getting this right is what
   *  makes the reservation exact rather than approximate. */
  n: number;
  /** Passed straight through as grid-template-columns, so the placeholder
   *  columns line up with the real table's and the swap moves nothing. */
  cols: string;
  rowH?: number;
  gap?: number;
}

/** Table/grid rows that inherit the caller's column template. */
export function SkeletonRows({ n, cols, rowH = 18, gap = 8 }: SkeletonRowsProps) {
  const cells = cols.trim().split(/\s+/).length;
  return (
    <span className="sk-rows" aria-hidden="true" style={{ gap }}>
      {Array.from({ length: n }, (_, r) => (
        <span key={r} className="sk-row" style={{ gridTemplateColumns: cols, gap }}>
          {Array.from({ length: cells }, (_, c) => (
            <SkeletonBox key={c} h={rowH} />
          ))}
        </span>
      ))}
    </span>
  );
}

export interface SwapProps {
  /** True once the real content has something to show. */
  ready: boolean;
  /**
   * The height the CONTENT will occupy, as a minimum.
   *
   * Pass the SAME constant the content and any PanelBoundary fallback use. That
   * one-constant-three-consumers rule is what makes zero-CLS structural rather
   * than aspirational — a reservation derived independently drifts the moment
   * someone edits the chart height.
   */
  reserve: number | string;
  skeleton: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Overlay a skeleton on top of already-mounted content, then cross-fade.
 *
 * Owns the reservation AND the crossfade together, so a call site physically
 * cannot ship one without the other.
 */
export function Swap({ ready, reserve, skeleton, children, className }: SwapProps) {
  // Keep the veil in the tree for one transition after ready flips, then drop
  // it — a shimmer left running underneath live content is wasted compositing
  // on exactly the low-tier devices this repo tiers for.
  const [veiled, setVeiled] = React.useState(!ready);
  React.useEffect(() => {
    if (!ready) { setVeiled(true); return; }
    // 400ms > --d-3 (300ms). Under reduce --d-3 is 0ms and this is simply a
    // slightly late unmount of an already-invisible node.
    const id = setTimeout(() => setVeiled(false), 400);
    return () => clearTimeout(id);
  }, [ready]);

  return (
    <div
      className={"sk-swap" + (className ? " " + className : "")}
      data-ready={ready ? "true" : "false"}
      style={{ minHeight: reserve }}
    >
      <div className="sk-body">{children}</div>
      {veiled ? (
        <div className="sk-veil" role="status" aria-live="polite" aria-label={BUSY_LABEL}>
          {skeleton}
        </div>
      ) : null}
    </div>
  );
}
