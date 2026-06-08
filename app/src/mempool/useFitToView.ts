// mempool/useFitToView.ts — scale a mempool view to fit the canvas width (P1).
//
// The wide canvas views (reactor/bridge/sediment/constellation) render at their
// natural size, so on load you only see the top-left slice of a much bigger canvas
// — which reads as a rendering error. This hook measures the view's NATURAL size
// and the canvas width, and returns a scale that shrinks the view to fit the width:
//
//   .mp-view--fit  ← width/height = the SCALED, clipped box (so .mp-canvas-scroll
//                    tracks the scaled bounds — no phantom horizontal scrollbar)
//   .mp-fit        ← transform: scale(scale)  (transform-origin: top left in CSS)
//
// Why `transform` (not `zoom`): a CSS transform leaves `offsetWidth` /
// `ResizeObserver` measurements UNPERTURBED, so the natural size is always readable
// and the fit math is deterministic — yet transforms ARE counted in the ancestor's
// scrollable overflow, so the scrollbars track the scaled size. `scale` is capped
// at 1 (never upscale). `mode: "100"` forces scale 1 (true size; the canvas pans).
//
// No feedback loop: writing .mp-view--fit width/height changes neither
// .mp-fit.offsetWidth (width:max-content, content-sized) nor
// .mp-canvas-scroll.clientWidth (set by page layout) — the three measured inputs are
// invariant under the outputs. RO work is deferred to rAF and state is updated only
// on a real change (epsilon), which also silences the benign RO-loop warning.

import * as React from "react";

export type FitMode = "fit" | "100";
export interface FitState {
  scale: number;
  /** scaled width to apply to .mp-view--fit (0 until first measure). */
  width: number;
  /** scaled height to apply to .mp-view--fit (0 until first measure). */
  height: number;
}

// A view that almost fits both axes at width-scale (only Reactor, by a couple of
// percent) should fit entirely rather than show a sliver of vertical scroll. If
// fitting the height costs no more than this fraction of the width-scale, we adopt
// the height-scale; genuinely tall views (bridge/sediment/constellation) fall far
// outside it and keep width-fit + vertical scroll.
const HEIGHT_FIT_TOLERANCE = 0.92;

function compute(
  scroll: HTMLElement,
  fit: HTMLElement,
  mode: FitMode,
): FitState | null {
  const naturalW = fit.offsetWidth;
  const naturalH = fit.offsetHeight;
  const canvasW = scroll.clientWidth;
  if (!naturalW || !naturalH || !canvasW) return null;

  let scale = mode === "100" ? 1 : Math.min(1, canvasW / naturalW);

  if (mode !== "100") {
    // Only consider the height on a bounded vertical viewport (desktop canvas,
    // overflow-y:auto). The mobile canvas is overflow-y:hidden / height:auto (the
    // PAGE scrolls), so its clientHeight tracks content and must not drive the fit.
    const boundedV = scroll.clientHeight > 0 &&
      getComputedStyle(scroll).overflowY !== "hidden";
    if (boundedV) {
      const heightScale = scroll.clientHeight / naturalH;
      if (heightScale < scale && heightScale >= scale * HEIGHT_FIT_TOLERANCE) {
        scale = heightScale;
      }
    }
  }

  // floor width → never overflow the canvas horizontally; ceil height → never clip
  // the last row.
  return { scale, width: Math.floor(naturalW * scale), height: Math.ceil(naturalH * scale) };
}

export function useFitToView(
  scrollRef: React.RefObject<HTMLElement>,
  fitRef: React.RefObject<HTMLElement>,
  mode: FitMode,
): FitState {
  const [st, setSt] = React.useState<FitState>({ scale: 1, width: 0, height: 0 });
  const modeRef = React.useRef(mode);
  modeRef.current = mode;

  React.useEffect(() => {
    const scroll = scrollRef.current;
    const fit = fitRef.current;
    if (!scroll || !fit) return;

    let raf = 0;
    const measure = () => {
      raf = 0;
      const next = compute(scroll, fit, modeRef.current);
      if (!next) return;
      setSt((prev) =>
        Math.abs(prev.scale - next.scale) < 0.0005 &&
        Math.abs(prev.width - next.width) < 0.5 &&
        Math.abs(prev.height - next.height) < 0.5
          ? prev
          : next,
      );
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(measure); };

    schedule(); // first paint
    const ro = new ResizeObserver(schedule);
    ro.observe(scroll); // canvas resize
    ro.observe(fit);    // content natural-size changes (live data streaming in)
    window.addEventListener("resize", schedule);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [scrollRef, fitRef]);

  // Re-measure synchronously when the zoom mode flips (fit ⇄ 100), so the toggle is
  // instant rather than waiting for the next rAF.
  React.useEffect(() => {
    const scroll = scrollRef.current;
    const fit = fitRef.current;
    if (!scroll || !fit) return;
    const next = compute(scroll, fit, mode);
    if (next) setSt(next);
  }, [mode, scrollRef, fitRef]);

  return st;
}
