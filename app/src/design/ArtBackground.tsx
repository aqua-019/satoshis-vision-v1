/**
 * design/ArtBackground.tsx — the layered terminal-CRT backdrop.
 *
 * Composed of:
 *   - art-grid (CSS grid of orange hairlines)
 *   - ParticleField (Canvas — drifting stars + propulsion streams)
 *   - art-noise (SVG turbulence filter)
 *   - art-vignette (radial darken)
 *   - art-scan (optional CRT scanlines, controlled by `scan`)
 */

import * as React from "react";
import { useVisual } from "./VisualContext";
import { useReducedMotion } from "./useReducedMotion";

type Intensity = "calm" | "busy" | "chaotic";

export interface ArtBackgroundProps {
  intensity?: Intensity;
  scan?: boolean;
}

export function ArtBackground({ intensity = "busy", scan = false }: ArtBackgroundProps) {
  // The user's ⌘ DESIGN → Ambient choice, when set, overrides every page's
  // own `intensity` prop (see design/VisualContext.tsx); `ambient === null`
  // means no override, so this page's own prop wins as before.
  const { ambient } = useVisual();
  const effectiveIntensity = ambient ?? intensity;
  return (
    <>
      <div className="art-grid" />
      <ParticleField
        density={effectiveIntensity === "calm" ? 0.45 : effectiveIntensity === "chaotic" ? 1.6 : 1.0}
        speed={effectiveIntensity === "chaotic" ? 1.6 : 1.0}
      />
      <div className="art-noise" />
      <div className="art-vignette" />
      {scan ? <div className="art-scan" /> : null}
    </>
  );
}

interface ParticleFieldProps {
  density?: number;
  speed?: number;
  /** Explicit override. Omitted (the normal case), the theme-aware
   *  `--ui-accent-dim` token is read from computed style instead — see
   *  below. */
  color?: string;
  className?: string;
}

interface Star { x: number; y: number; vx: number; vy: number; r: number; a: number; ph: number }
interface Stream { x: number; y: number; vy: number; life: number; age: number; hue: number }

export function ParticleField({
  density = 1.0,
  speed = 1.0,
  color,
  className,
}: ParticleFieldProps) {
  const ref = React.useRef<HTMLCanvasElement | null>(null);
  const reduced = useReducedMotion();
  // Re-running the effect on a theme flip is how a live ⌘ DESIGN → Theme
  // change repaints an already-mounted canvas — otherwise the computed
  // `--ui-accent-dim` read below would only ever happen once, at mount.
  const { theme } = useVisual();

  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let w = 0, h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Theme-aware particle colour: --ui-accent-dim already retints per
    // theme (violet under indigo, the historic orange under classic — see
    // styles-theme.css). Read it from computed style rather than
    // hardcoding the orange; fall back to it only if the token resolves
    // empty (e.g. rendered outside this app's CSS cascade entirely, per
    // PORTING.md).
    const themeColor =
      color ??
      (getComputedStyle(document.documentElement).getPropertyValue("--ui-accent-dim").trim() ||
        "rgba(255,122,26,0.5)");

    let stars: Star[] = [];
    let streams: Stream[] = [];

    // Seeding lives inside resize() (not once at the top of the effect) so
    // a LATER resize — not just the first measurement — reseeds against the
    // current box. Before styles-legibility.css's `.art-canvas` fix this
    // never mattered (the canvas was permanently stuck at its 300×150
    // intrinsic size, see that file's "BUGFIX" comment); now that a resize
    // can genuinely change w/h, seeding once at mount left every star keyed
    // to a stale box after the next one.
    const seed = () => {
      const N = Math.floor(120 * density);
      stars = Array.from({ length: N }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.15 * speed,
        vy: (Math.random() - 0.5) * 0.15 * speed,
        r: Math.random() * 1.3 + 0.2,
        a: Math.random() * 0.7 + 0.1,
        ph: Math.random() * Math.PI * 2,
      }));
      streams = Array.from({ length: Math.floor(8 * density) }, () => ({
        x: Math.random() * w, y: h + Math.random() * h,
        vy: -(Math.random() * 1.6 + 0.6) * speed,
        life: Math.random() * 200 + 200,
        age: 0,
        hue: Math.random() < 0.85 ? 28 : 280,
      }));
    };

    // One frame's worth of update + draw. Split out from the rAF loop
    // (below) so reduced motion can call it exactly once per resize instead
    // of never running at all.
    //
    // `k` is elapsed time normalised to 60fps-equivalent steps: k=1 means
    // "one 1/60s tick just happened". Every per-frame increment below scales
    // by it, so a 120Hz/144Hz display no longer drifts the field twice as
    // fast in wall-clock time as a 60Hz one. At 60Hz k≈1 and the motion is
    // unchanged. k=0 draws the current state without advancing it, which is
    // what the reduced-motion static frame wants.
    const tick = (k: number) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = themeColor;
      for (const s of stars) {
        s.x += s.vx * k; s.y += s.vy * k; s.ph += 0.02 * speed * k;
        if (s.x < 0) s.x += w; if (s.x > w) s.x -= w;
        if (s.y < 0) s.y += h; if (s.y > h) s.y -= h;
        const a = s.a * (0.5 + 0.5 * Math.sin(s.ph));
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const s of streams) {
        s.y += s.vy * k; s.age += k;
        if (s.y < -20 || s.age > s.life) {
          s.x = Math.random() * w; s.y = h + 20; s.age = 0;
          s.vy = -(Math.random() * 1.6 + 0.6) * speed;
          s.hue = Math.random() < 0.85 ? 28 : 280;
        }
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = `hsl(${s.hue}, 100%, ${60 - Math.abs(s.age - s.life / 2) / s.life * 40}%)`;
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(s.x, s.y, 1.6, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0; ctx.globalAlpha = 0.18;
        ctx.fillRect(s.x, s.y, 1, 28);
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    };

    let disposed = false;

    const resize = () => {
      if (disposed) return; // a deferred rAF can still fire after unmount
      const r = canvas.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
      // Assigning canvas.width just wiped the backing store. Under reduced
      // motion there's no rAF loop to repaint what that wipe erased, so the
      // static frame has to be redrawn right here or the field goes blank
      // on the next resize (mirrors pages/future/FutureMini.tsx's
      // useMiniCanvas, which hits the exact same canvas.width= gotcha).
      if (reduced) tick(0);
    };
    resize();
    // Deferred through rAF: resizing synchronously from inside the observer
    // can re-trigger it in the same frame and surface "ResizeObserver loop
    // completed with undelivered notifications". useFitToView.ts defers for
    // exactly this reason.
    const ro = new ResizeObserver(() => requestAnimationFrame(resize));
    ro.observe(canvas);

    if (reduced) return () => { disposed = true; ro.disconnect(); };

    let raf = 0;
    let lastTs: number | null = null;
    const loop = (now: number) => {
      // Clamp so a tab returning after minutes in the background doesn't
      // teleport every particle across the canvas in a single step.
      const dt = lastTs === null ? 1 / 60 : Math.min((now - lastTs) / 1000, 0.05);
      lastTs = now;
      tick(dt / (1 / 60));
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (raf) return;
      lastTs = null; // avoid a dt spike on resume
      raf = requestAnimationFrame(loop);
    };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    // A hidden tab still runs rAF in some browsers and always burns battery
    // in the ones that throttle it; nothing here is worth drawing unseen.
    const onVisibility = () => { if (document.hidden) stop(); else start(); };
    document.addEventListener("visibilitychange", onVisibility);
    if (!document.hidden) start();

    return () => {
      disposed = true;
      stop();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [density, speed, color, reduced, theme]);

  return <canvas ref={ref} className={"art-canvas " + (className || "")} />;
}

/** Animation tick — re-renders every `intervalMs`. Used by view-engine scenes. */
export function useTick(intervalMs = 1000): number {
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setN((x) => x + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return n;
}
