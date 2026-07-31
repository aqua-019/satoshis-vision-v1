/**
 * protocols/use-proto-canvas.ts — the canvas driver for the /simulate
 * simulators (v6.0.9).
 *
 * Why this exists rather than a shared import: pages/future/FutureMini.tsx has
 * the same loop as a module-private `useMiniCanvas`, and its header explicitly
 * forbids exporting it — that file lives in the MAIN chunk, and importing it
 * from here (or vice-versa) would drag one chunk into the other. So the loop is
 * deliberately duplicated on this side of the /simulate code-split seam, with
 * the two additions the simulators need:
 *
 *   - IntersectionObserver gating. A simulator's stage can scroll out of view
 *     inside its own page; FutureMini's never does (it lives in a modal).
 *   - Elapsed seconds are exposed to the draw fn, so a sim can be driven purely
 *     from `t` and stay deterministic under reduced motion (draw at t=0).
 *
 * NOT `useTick` (design/ArtBackground.tsx:180). That is a setInterval that
 * setStates, i.e. a full React re-render up to 25×/sec with every ProtoStep and
 * Stat in the subtree reconciled. Nothing on a canvas path may use it.
 */

import * as React from "react";

/** `t` is elapsed animation seconds (frozen while hidden/offscreen); `dt` is
 *  seconds since the previous frame, 0 on the first/static frame. */
export type ProtoDrawFn = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  dt: number,
) => void;

/**
 * Drives a <canvas> from an elapsed-time draw callback.
 *
 * Attach the returned ref to a canvas that has a CSS width AND height — a
 * <canvas> is a replaced element, so a bare `inset: 0` never stretches it (the
 * `.art-canvas` bug fixed in v6.0.2). `<ProtoCanvas>` below does this correctly.
 *
 * The callback is read through a ref, so a sim can close over changing state
 * (a slider value, a selected tier) and have the very next frame see it without
 * tearing down the canvas, the observers, or the elapsed clock.
 */
export function useProtoCanvas(draw: ProtoDrawFn): React.RefObject<HTMLCanvasElement> {
  const ref = React.useRef<HTMLCanvasElement | null>(null);
  const drawRef = React.useRef<ProtoDrawFn>(draw);
  drawRef.current = draw;

  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let elapsed = 0; // animation seconds — frozen while hidden or offscreen
    let lastTs: number | null = null;
    let raf = 0;
    let visible = document.visibilityState !== "hidden";
    let onscreen = true; // until the IntersectionObserver says otherwise

    const paint = (t: number, dt: number) => {
      if (w > 0 && h > 0) drawRef.current(ctx, w, h, t, dt);
    };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width;
      h = r.height;
      // Assigning width/height resets the backing store AND wipes the canvas.
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Under reduced motion (or while paused) there is no rAF loop to repaint
      // what that wipe just erased, so redraw the current frame here or the
      // stage goes permanently blank on the first resize.
      if (reduce || !raf) paint(elapsed, 0);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    if (reduce) {
      // One static frame at t=0. Still legible, still explains the protocol —
      // sims must not rely on motion to convey their point.
      paint(0, 0);
      return () => ro.disconnect();
    }

    const frame = (now: number) => {
      const dt = lastTs === null ? 0 : (now - lastTs) / 1000;
      elapsed += dt;
      lastTs = now;
      paint(elapsed, dt);
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (raf || !visible || !onscreen) return;
      lastTs = null; // avoid a huge dt jump on resume
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      if (!raf) return;
      cancelAnimationFrame(raf);
      raf = 0;
      lastTs = null;
    };

    const onVisibility = () => {
      visible = document.visibilityState !== "hidden";
      if (visible) start();
      else stop();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const io = new IntersectionObserver(
      (entries) => {
        onscreen = entries.some((e) => e.isIntersecting);
        if (onscreen) start();
        else stop();
      },
      { threshold: 0 },
    );
    io.observe(canvas);

    start();

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return ref as React.RefObject<HTMLCanvasElement>;
}

export interface ProtoCanvasProps {
  draw: ProtoDrawFn;
  /** CSS height. The canvas always fills its container's width. */
  height?: number | string;
  /** Text equivalent — required. A canvas is opaque to assistive tech, so every
   *  simulator stage must describe its current state in words. */
  label: string;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * The canvas element every simulator stage uses. Sets BOTH width and height
 * (see the replaced-element note above), exposes the drawing as an image with a
 * text equivalent, and lets the label update as the sim's state changes so a
 * screen-reader user tracks the same story a sighted user sees.
 */
export function ProtoCanvas({ draw, height = 320, label, style, className }: ProtoCanvasProps) {
  const ref = useProtoCanvas(draw);
  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={label}
      className={className}
      style={{ display: "block", width: "100%", height, ...style }}
    />
  );
}
