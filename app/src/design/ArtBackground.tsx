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
import { useReducedMotion } from "./useReducedMotion";

type Intensity = "calm" | "busy" | "chaotic";

export interface ArtBackgroundProps {
  intensity?: Intensity;
  scan?: boolean;
}

export function ArtBackground({ intensity = "busy", scan = false }: ArtBackgroundProps) {
  return (
    <>
      <div className="art-grid" />
      <ParticleField
        density={intensity === "calm" ? 0.45 : intensity === "chaotic" ? 1.6 : 1.0}
        speed={intensity === "chaotic" ? 1.6 : 1.0}
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
  color?: string;
  className?: string;
}

export function ParticleField({
  density = 1.0,
  speed = 1.0,
  color = "rgba(255,122,26,0.5)",
  className,
}: ParticleFieldProps) {
  const ref = React.useRef<HTMLCanvasElement | null>(null);
  const reduceMotion = useReducedMotion();

  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0, w = 0, h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let disposed = false;
    let seeded = false;

    const resize = () => {
      if (disposed) return;
      const r = canvas.getBoundingClientRect();
      const pw = w, ph = h;
      w = r.width; h = r.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!seeded) return; // first call runs before the particles exist

      // The effect can run before layout settles, in which case every particle
      // was seeded against a degenerate box and they all sit in one corner.
      // When a real box finally arrives, re-scatter instead of leaving the
      // clump; on an ordinary resize, map the existing composition onto the
      // new box so the field doesn't visibly reshuffle.
      if ((pw < 100 || ph < 100) && w >= 100 && h >= 100) {
        for (const s of stars) { s.x = Math.random() * w; s.y = Math.random() * h; }
        for (const s of streams) { s.x = Math.random() * w; s.y = h + Math.random() * h; }
      } else if (pw > 0 && ph > 0) {
        for (const s of stars) { s.x = (s.x / pw) * w; s.y = (s.y / ph) * h; }
        for (const s of streams) { s.x = (s.x / pw) * w; }
      }
    };
    resize();
    // rAF-deferred: calling resize() synchronously from the observer can
    // re-trigger it in the same frame and surface "ResizeObserver loop
    // completed with undelivered notifications". useFitToView.ts defers for
    // the same reason.
    const ro = new ResizeObserver(() => requestAnimationFrame(resize));
    ro.observe(canvas);

    const N = Math.floor(120 * density);
    const stars = Array.from({ length: N }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.15 * speed,
      vy: (Math.random() - 0.5) * 0.15 * speed,
      r: Math.random() * 1.3 + 0.2,
      a: Math.random() * 0.7 + 0.1,
      ph: Math.random() * Math.PI * 2,
    }));
    const streams = Array.from({ length: Math.floor(8 * density) }, () => ({
      x: Math.random() * w, y: h + Math.random() * h,
      vy: -(Math.random() * 1.6 + 0.6) * speed,
      life: Math.random() * 200 + 200,
      age: 0,
      hue: Math.random() < 0.85 ? 28 : 280,
    }));
    seeded = true;

    // `k` is elapsed time normalised to 60fps-equivalent steps (k=1 means
    // "one 1/60s tick just happened"). Every per-frame increment below is
    // scaled by it so a 120Hz/144Hz display doesn't drift stars twice as
    // fast in wall-clock time as a 60Hz one — at 60Hz, k≈1 every frame and
    // the motion is pixel-identical to before this change.
    const draw = (k: number) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = color;
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

    // Reduced motion: paint one calm frame and never schedule the loop. This
    // is decoration behind real content (not the content itself), so it
    // should stay visible — just still, not blank.
    if (reduceMotion) {
      draw(0);
      return () => { disposed = true; ro.disconnect(); };
    }

    let lastTs: number | null = null;
    draw(0); // instant first paint, matching the old synchronous tick() call

    const tick = (now: number) => {
      // Clamp so a background tab returning after minutes away doesn't
      // teleport every particle across the canvas in one jump.
      const dt = lastTs === null ? 0 : Math.min((now - lastTs) / 1000, 0.05);
      lastTs = now;
      draw(dt / (1 / 60));
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (raf) return;
      lastTs = null; // avoid a huge dt spike on resume
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const onVisibility = () => {
      if (document.hidden) stop(); else start();
    };
    document.addEventListener("visibilitychange", onVisibility);
    if (!document.hidden) start();

    return () => {
      disposed = true; // a queued rAF from the observer may still fire
      stop();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [density, speed, color, reduceMotion]);

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
