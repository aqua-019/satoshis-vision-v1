// mempool/useMemCanvas.ts — the animation driver for canvas-backed mempool views.
//
// The six original views animate by re-rendering React: useTick(n) is a bare
// setInterval that bumps a counter, so constellation.tsx's useTick(50) forces
// twenty full reconciliations per second of a 460px SVG with ~60 circles and 18
// animated paths — in a background tab, on a phone, forever. That is the pattern
// this hook exists to replace: the draw loop touches pixels, never the React
// tree, and it stops when nobody is looking.
//
// Modeled on pages/future/FutureMini.tsx's useMiniCanvas (itself modeled on
// design/ArtBackground.tsx's ParticleField). That hook is documented as
// module-private — "do not export it, move it to @/design/" — so this is a
// sibling implementation for the mempool layer rather than a promotion of it.
//
// What it adds over useMiniCanvas:
//   • IntersectionObserver — a canvas scrolled out of .mp-canvas-scroll stops.
//     Note visibility and intersection collapse into ONE predicate: the naive
//     two-listener version resumes on visibilitychange while the canvas is
//     still scrolled off screen.
//   • an fps sampler published to `data-mem-fps`, which is how verify-memperf.mjs
//     reads the frame rate under CPU throttling without instrumenting each view.
//     Off unless window.__MEM_FPS__ is set (the gate sets it via addInitScript
//     before navigation), and throttled to 2 Hz so the measurement is not itself
//     the cost.
//   • glowSprite / blitGlow — the prototype draw code leans on ctx.shadowBlur,
//     which costs a full blur per draw call: at 200 txs × 60fps that is 12k
//     blurs a second. shadowBlur is BANNED in src/mempool/ and gated on.
//
// Reduced motion: MemViewShell swaps in the view's table BEFORE the canvas
// mounts, so under prefers-reduced-motion there is no canvas and no loop at all
// — which is also what keeps "only one canvas mounted at a time" true. The
// `reduceMotion` flag returned here is belt-and-braces for any canvas mounted
// outside a shell.

import * as React from "react";
import { useReducedMotion } from "@/design/useReducedMotion";
import { cssColor } from "@/design/canvasColor";

export type MemDrawFn = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  /** elapsed animation seconds; frozen while hidden, off-screen or paused */
  t: number,
  /** seconds since the previous frame; 0 on the first frame after a resume */
  dt: number,
) => void;

export interface MemCanvasOptions {
  /** IntersectionObserver gating. Default true. */
  observe?: boolean;
  /** device-pixel-ratio ceiling. Default 2 — past that the backing store costs
   *  more than it shows. */
  maxDpr?: number;
  /** caller-driven pause (e.g. a view's own play control) */
  paused?: boolean;
}

export interface MemCanvasHandle {
  ref: React.RefObject<HTMLCanvasElement>;
  reduceMotion: boolean;
}

/** Below this visible fraction the loop stops. */
const VISIBLE_THRESHOLD = 0.1;
/** Hard ceiling on either canvas dimension — see the runaway guard in resize(). */
const MAX_DIM = 4096;
/** fps attribute writes, at most this often. */
const FPS_PUBLISH_MS = 500;

export function useMemCanvas(draw: MemDrawFn, opts: MemCanvasOptions = {}): MemCanvasHandle {
  const ref = React.useRef<HTMLCanvasElement | null>(null);
  const reduceMotion = useReducedMotion();

  // Latest draw callback, read from inside the rAF loop without re-running the
  // setup effect on every render — so a 2.5s data tick never tears down the
  // canvas, the observers, or the elapsed clock.
  const drawRef = React.useRef<MemDrawFn>(draw);
  drawRef.current = draw;

  const pausedRef = React.useRef<boolean>(!!opts.paused);
  pausedRef.current = !!opts.paused;

  const { observe = true, maxDpr = 2, paused = false } = opts;

  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);

    let raf = 0;
    let elapsed = 0;          // animation seconds — frozen whenever the loop stops
    let lastTs: number | null = null;
    let frames = 0;
    let fpsSince = 0;
    let warned = false;
    const instrument = typeof window !== "undefined" && (window as { __MEM_FPS__?: boolean }).__MEM_FPS__ === true;

    const resize = () => {
      // LAYOUT size, not getBoundingClientRect(). A view registered `fit: true`
      // is rendered inside <FitView>, which downscales its whole subtree with a
      // CSS `transform: scale(s)` (styles.css:514). getBoundingClientRect()
      // reports the VISUAL box — layout × s — so using it would make the drawing
      // coordinate space wider than the CSS box the canvas actually occupies,
      // and everything past the right edge would be clipped. clientWidth is
      // transform-independent, so draw code always works in honest layout units.
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      if (!w || !h) return;

      // Runaway guard. If a host is laid out so the canvas's own size feeds back
      // into its ancestor's width (any `width: 100%` under a `max-content`
      // parent does exactly this), ResizeObserver and layout chase each other
      // and the element grows without bound — observed at 658,432 px before the
      // .mem-canvas rule went absolute. Every browser degrades differently and
      // none of them errors, so the symptom is "mysteriously slow" rather than
      // "broken". Clamp, complain once, and keep drawing something sane.
      if (w > MAX_DIM || h > MAX_DIM) {
        if (!warned) {
          warned = true;
          console.warn(
            `[useMemCanvas] host measured ${Math.round(w)}×${Math.round(h)}px — clamping to ${MAX_DIM}. ` +
            "The host is probably sized as a percentage inside a max-content ancestor; give it a definite size.",
          );
        }
        w = Math.min(w, MAX_DIM);
        h = Math.min(h, MAX_DIM);
      }

      // The transform still matters for RESOLUTION: at s = 0.6 the canvas is
      // painted smaller on screen, so it needs proportionally fewer backing
      // pixels. Folding s into the effective DPR keeps it crisp at any scale
      // without over-allocating.
      const rect = canvas.getBoundingClientRect();
      const scale = w > 0 && rect.width > 0 ? rect.width / w : 1;
      const eff = Math.max(0.5, Math.min(dpr * scale, dpr));

      // Assigning width/height resets the backing store AND wipes the canvas,
      // so the transform has to be re-applied every time.
      canvas.width = Math.round(w * eff);
      canvas.height = Math.round(h * eff);
      ctx.setTransform(eff, 0, 0, eff, 0, 0);
      // When the loop is stopped nothing is going to repaint what that wipe
      // just erased, so draw one frame here or the view goes permanently blank
      // on the first resize. This is the exact gotcha useMiniCanvas documents.
      if (!raf) drawRef.current(ctx, w, h, elapsed, 0);
    };

    const frame = (now: number) => {
      let dt = 0;
      if (lastTs !== null) {
        dt = (now - lastTs) / 1000;
        // A resumed tab can hand us a huge first delta; clamp so anything
        // integrating dt doesn't teleport.
        if (dt > 0.25) dt = 0.25;
        elapsed += dt;
      }
      lastTs = now;

      drawRef.current(ctx, w, h, elapsed, dt);

      if (instrument) {
        frames += 1;
        const span = now - fpsSince;
        if (span >= FPS_PUBLISH_MS) {
          canvas.dataset.memFps = String(Math.round((frames * 1000) / span));
          frames = 0;
          fpsSince = now;
        }
      }

      raf = requestAnimationFrame(frame);
    };

    // ONE predicate. Splitting these across two independent listeners is the
    // bug where a hidden→visible transition restarts a canvas that is still
    // scrolled out of view.
    let visible = document.visibilityState !== "hidden";
    let onScreen = true;
    const shouldRun = () => visible && onScreen && !pausedRef.current;

    const start = () => {
      if (raf || !shouldRun()) return;
      lastTs = null;              // no dt jump across the gap
      frames = 0;
      fpsSince = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      if (!raf) return;
      cancelAnimationFrame(raf);
      raf = 0;
      lastTs = null;
      delete canvas.dataset.memFps;
    };
    const sync = () => (shouldRun() ? start() : stop());

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let io: IntersectionObserver | null = null;
    if (observe) {
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) onScreen = e.intersectionRatio >= VISIBLE_THRESHOLD;
          sync();
        },
        { threshold: [0, VISIBLE_THRESHOLD, 1] },
      );
      io.observe(canvas);
    }

    const onVisibility = () => {
      visible = document.visibilityState !== "hidden";
      sync();
    };
    document.addEventListener("visibilitychange", onVisibility);
    sync();

    return () => {
      stop();
      ro.disconnect();
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [observe, maxDpr, paused]);

  return { ref: ref as React.RefObject<HTMLCanvasElement>, reduceMotion };
}

// ── glow sprites ────────────────────────────────────────────────────────────

const SPRITES = new Map<string, HTMLCanvasElement>();

/**
 * Pre-render a soft radial glow to an offscreen canvas so draw loops can blit
 * it instead of paying ctx.shadowBlur per particle. Memoised per (resolved
 * colour, radius) — call it freely, it builds at most once per theme.
 *
 * Returns a 2r × 2r sprite whose CENTRE is the particle position; blit at
 * (x − r, y − r), which is what blitGlow does for you.
 */
export function glowSprite(color: string, radius: number): HTMLCanvasElement {
  const r = Math.max(1, Math.ceil(radius));

  // Resolve BEFORE keying the cache, not after — two reasons, not one:
  //
  //   1. addColorStop THROWS on anything it cannot parse — including a
  //      `var(--x)` that never got resolved — and an exception inside a rAF
  //      draw loop unmounts the entire view rather than degrading one
  //      particle. Resolving up front means a bad token fails here, not
  //      inside the gradient call.
  //   2. Keying on the raw TOKEN name (e.g. "var(--tk-accent)@12") would
  //      serve the first theme's baked pixels forever, because the token
  //      string itself never changes across a theme flip — only what it
  //      resolves to. Keying on the resolved colour instead makes the cache
  //      theme-safe for free: a flip yields a different resolved string,
  //      which is a cache miss and a fresh sprite; repeated calls under the
  //      same theme keep hitting the same key, so this still builds at most
  //      once per (resolved colour, radius) — same memoisation cost as
  //      before, just keyed correctly.
  const resolved = cssColor(color);
  const key = `${resolved}@${r}`;
  const hit = SPRITES.get(key);
  if (hit) return hit;

  const c = document.createElement("canvas");
  c.width = r * 2;
  c.height = r * 2;
  const g = c.getContext("2d");
  if (g) {
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, resolved);
    grad.addColorStop(0.35, resolved);
    grad.addColorStop(1, "transparent");
    g.fillStyle = grad;
    g.fillRect(0, 0, r * 2, r * 2);
  }
  SPRITES.set(key, c);
  return c;
}

/** Blit a memoised glow sprite centred on (x, y). */
export function blitGlow(
  ctx: CanvasRenderingContext2D,
  sprite: HTMLCanvasElement,
  x: number,
  y: number,
  alpha: number,
  scale = 1,
): void {
  const w = sprite.width * scale;
  const h = sprite.height * scale;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = alpha;
  ctx.drawImage(sprite, x - w / 2, y - h / 2, w, h);
  ctx.globalAlpha = prev;
}

/**
 * Resolve a CSS custom property to a concrete color.
 *
 * MOVED to @/design/canvasColor in p3·12 — the markets hero is a canvas surface
 * outside src/mempool/ and needed it, and importing this module (a rAF hook
 * with visibility/intersection wiring and a sprite cache) for one pure function
 * would have dragged all of that into the markets chunk.
 *
 * It went to design/chart-kit.tsx FIRST, which was the obvious home and cost
 * 757 EAGER bytes on every route: primitives.tsx imports chart-kit and is in
 * the entry chunk. canvasColor.ts has only lazy importers. Re-exported here so
 * the FIVE views that call it keep importing it from where they always have
 * (abyss, circuit, orbital, pulse and sediment — the other five never did).
 */
export { cssColor } from "@/design/canvasColor";
