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
    // v6.0.7: getComputedStyle on a CUSTOM PROPERTY hands back the raw token
    // stream, not a resolved colour — so on a pre-oklch engine this used to
    // return the literal string "oklch(...)". Canvas 2D SILENTLY IGNORES an
    // unparseable fillStyle (no throw, no warning), leaving the previous value
    // in place, so the whole field drew black-on-#121218: invisible, with
    // nothing in the console. The old `|| fallback` never caught it because it
    // only tests for an EMPTY string, and the token was non-empty and useless.
    // styles-theme.css now guards oklch behind @supports, so this is belt and
    // braces — but the validation is what makes the failure impossible rather
    // than merely unlikely.
    const rawDim = getComputedStyle(document.documentElement)
      .getPropertyValue("--ui-accent-dim")
      .trim();
    const themeColor =
      color ??
      ((rawDim && typeof CSS !== "undefined" && CSS.supports?.("color", rawDim) ? rawDim : "") ||
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
    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = themeColor;
      for (const s of stars) {
        s.x += s.vx; s.y += s.vy; s.ph += 0.02 * speed;
        if (s.x < 0) s.x += w; if (s.x > w) s.x -= w;
        if (s.y < 0) s.y += h; if (s.y > h) s.y -= h;
        const a = s.a * (0.5 + 0.5 * Math.sin(s.ph));
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const s of streams) {
        s.y += s.vy; s.age++;
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

    // v6.0.7 · Tor Browser letterboxes the viewport to 200x100 multiples, so a
    // single window drag fires ResizeObserver repeatedly with a box that jumps
    // in whole steps before settling. seed() ran on EVERY one of those,
    // re-scattering all ~120 stars each time — the field visibly "explodes" on
    // any resize, which is precisely the "doesn't function the same over Tor"
    // report. Only reseed when the box moved far enough that the old
    // distribution genuinely no longer fits; tick()'s existing wrap (see the
    // `if (s.x > w) s.x -= w` above) pulls stray stars back inside within one
    // frame on a shrink, so a sub-threshold change needs no reseed at all.
    const RESEED_PX = 100;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const nw = r.width, nh = r.height;
      const needSeed =
        stars.length === 0 || Math.abs(nw - w) >= RESEED_PX || Math.abs(nh - h) >= RESEED_PX;
      w = nw; h = nh;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (needSeed) seed();
      // Assigning canvas.width just wiped the backing store. Under reduced
      // motion there's no rAF loop to repaint what that wipe erased, so the
      // static frame has to be redrawn right here or the field goes blank
      // on the next resize (mirrors pages/future/FutureMini.tsx's
      // useMiniCanvas, which hits the exact same canvas.width= gotcha).
      if (reduced) tick();
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);

    if (reduced) return () => ro.disconnect();

    let raf = 0;
    const loop = () => { tick(); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);

    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
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
