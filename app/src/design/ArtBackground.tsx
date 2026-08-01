/**
 * design/ArtBackground.tsx — the layered terminal-CRT backdrop.
 *
 * Composed of:
 *   - art-grid (CSS grid of orange hairlines)
 *   - ParticleField (Canvas — drifting stars + propulsion streams)
 *   - art-noise (SVG turbulence filter)
 *   - art-vignette (radial darken)
 *   - art-scan (optional CRT scanlines, controlled by `scan`)
 *
 * v6.0.8: the canvas is device-tiered (design/deviceTier.ts). It is the app's
 * baseline power draw — AppShell mounts one on every page — so on the `low`
 * tier it is not mounted at all and the static ambient plates carry the
 * backdrop alone. `art-grid` / `art-noise` are static CSS and cost nothing
 * per frame, so they stay on every tier.
 */

import * as React from "react";
import { useVisual } from "./VisualContext";
import { useReducedMotion } from "./useReducedMotion";
import { byTier, getDeviceTier } from "./deviceTier";
import { isPageActive, observeDrawable, onPageActiveChange } from "./usePageActive";

type Intensity = "calm" | "busy" | "chaotic";

export interface ArtBackgroundProps {
  intensity?: Intensity;
  scan?: boolean;
}

export function ArtBackground({ intensity = "busy", scan = false }: ArtBackgroundProps) {
  // The user's ⌘ DESIGN → Ambient choice, when set, overrides every page's
  // own `intensity` prop (see design/VisualContext.tsx); `ambient === null`
  // means no override, so this page's own prop wins as before.
  const { ambient, tier } = useVisual();
  const effectiveIntensity = ambient ?? intensity;
  return (
    <>
      <div className="art-grid" />
      {tier === "low" ? null : (
        <ParticleField
          density={effectiveIntensity === "calm" ? 0.45 : effectiveIntensity === "chaotic" ? 1.6 : 1.0}
          speed={effectiveIntensity === "chaotic" ? 1.6 : 1.0}
        />
      )}
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

/** Longest frame we integrate. A tab that was hidden, a GC pause or a slow
 *  first paint must not teleport every particle across the field. Matches the
 *  50ms clamp the repo's other canvas driver documents. */
const MAX_FRAME_MS = 50;
/** Reference frame length. `dt / this` == 1.0 at 60fps, so the per-frame
 *  velocities below keep their original tuning while becoming framerate-
 *  independent. */
const FRAME_MS = 1000 / 60;

/** Radius of the pre-rendered stream glow, in CSS px. Covers the old 1.6px
 *  dot plus the `shadowBlur: 8` halo it used to pay for on every particle of
 *  every frame. */
const GLOW_R = 12;

/**
 * Bake a stream's glow into an offscreen canvas once.
 *
 * The old draw path set `shadowColor` + `shadowBlur = 8` per stream per
 * frame, which is a real Gaussian blur per particle — the single most
 * expensive operation in this loop. The sprite is drawn at max lightness and
 * the per-particle brightness ramp is expressed through `globalAlpha`
 * instead, which is free.
 */
function makeGlowSprite(hue: number, dpr: number): HTMLCanvasElement {
  const size = GLOW_R * 2;
  const c = document.createElement("canvas");
  c.width = Math.ceil(size * dpr);
  c.height = Math.ceil(size * dpr);
  const g = c.getContext("2d");
  if (!g) return c;
  g.scale(dpr, dpr);
  const grad = g.createRadialGradient(GLOW_R, GLOW_R, 0, GLOW_R, GLOW_R, GLOW_R);
  grad.addColorStop(0, `hsla(${hue}, 100%, 74%, 1)`);
  grad.addColorStop(0.14, `hsla(${hue}, 100%, 60%, 0.9)`);
  grad.addColorStop(0.42, `hsla(${hue}, 100%, 55%, 0.24)`);
  grad.addColorStop(1, `hsla(${hue}, 100%, 50%, 0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

export function ParticleField({
  density = 1.0,
  speed = 1.0,
  color,
  className,
}: ParticleFieldProps) {
  const ref = React.useRef<HTMLCanvasElement | null>(null);
  const reduced = useReducedMotion();
  const { theme, tier } = useVisual();

  // Theme-aware particle colour, read into a ref rather than a local const —
  // see the header comment on `themeColorRef` inside the draw effect below
  // for why this is split into its own effect. Declared FIRST so it wins the
  // race to populate the ref before the draw effect's first tick, including
  // on mount.
  //
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
  const themeColorRef = React.useRef<string>("rgba(255,122,26,0.5)");
  React.useEffect(() => {
    const rawDim = getComputedStyle(document.documentElement)
      .getPropertyValue("--ui-accent-dim")
      .trim();
    themeColorRef.current =
      color ??
      ((rawDim && typeof CSS !== "undefined" && CSS.supports?.("color", rawDim) ? rawDim : "") ||
        "rgba(255,122,26,0.5)");
  }, [color, theme]);

  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let w = 0, h = 0;
    // DPR is the single biggest lever on fill cost — it is quadratic in area.
    // An iPhone reports 3; at 390×844 the difference between 2 and 1.5 is a
    // 975×2110 backing store versus 585×1266, and at phone pitch the two are
    // not tellable apart.
    const dpr = Math.min(
      window.devicePixelRatio || 1,
      byTier(tier, { high: 2, mid: 2, low: 1.5 }),
    );

    // Particle budget. `high` keeps the original density-scaled counts;
    // `mid` is a flat, much smaller field (density no longer scales it — a
    // mid-tier device running the `chaotic` ambient preset must not be handed
    // 192 stars). `low` never mounts this component at all (see
    // ArtBackground), but the branch stays honest for direct callers.
    const budget = byTier(tier, {
      high: { stars: Math.floor(120 * density), streams: Math.floor(8 * density) },
      mid: { stars: 30, streams: 3 },
      low: { stars: 12, streams: 0 },
    });

    // Theme-aware particle colour: --ui-accent-dim already retints per
    // theme (violet under indigo, the historic orange under classic — see
    // styles-theme.css). Resolved in the sibling effect above into
    // `themeColorRef`, and read from that ref on every frame below —
    // NOT closed over here — so a theme flip recolours without re-running
    // this effect (which would tear down and reseed the whole field; see
    // that effect's header comment).

    let stars: Star[] = [];
    let streams: Stream[] = [];

    // Two hues, baked once at mount. The old loop paid a per-particle
    // shadowBlur for this; now every stream is a single drawImage.
    const glow = { 28: makeGlowSprite(28, dpr), 280: makeGlowSprite(280, dpr) } as Record<number, HTMLCanvasElement>;

    // Seeding lives inside resize() (not once at the top of the effect) so
    // a LATER resize — not just the first measurement — reseeds against the
    // current box. Before styles-legibility.css's `.art-canvas` fix this
    // never mattered (the canvas was permanently stuck at its 300×150
    // intrinsic size, see that file's "BUGFIX" comment); now that a resize
    // can genuinely change w/h, seeding once at mount left every star keyed
    // to a stale box after the next one.
    const seed = () => {
      const N = budget.stars;
      stars = Array.from({ length: N }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.15 * speed,
        vy: (Math.random() - 0.5) * 0.15 * speed,
        r: Math.random() * 1.3 + 0.2,
        a: Math.random() * 0.7 + 0.1,
        ph: Math.random() * Math.PI * 2,
      }));
      streams = Array.from({ length: budget.streams }, () => ({
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
      ctx.fillStyle = themeColorRef.current;
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
        // The old code encoded the head's brightness ramp as an hsl()
        // lightness between 60% and 20%. The sprite is baked at full
        // lightness, so the same ramp rides on alpha instead — same read,
        // no per-particle blur.
        const ramp = 1 - (Math.abs(s.age - s.life / 2) / s.life) * 1.34;
        ctx.globalAlpha = 0.85 * Math.max(0.25, ramp);
        ctx.drawImage(glow[s.hue] ?? glow[28], s.x - GLOW_R, s.y - GLOW_R, GLOW_R * 2, GLOW_R * 2);
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = `hsl(${s.hue}, 100%, 55%)`;
        ctx.fillRect(s.x, s.y, 1, 28);
        ctx.fillStyle = themeColorRef.current;
      }
      ctx.globalAlpha = 1;
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

    let disposed = false;

    const resize = () => {
      if (disposed) return; // a deferred rAF can still fire after unmount
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
      const elapsed = lastTs === null ? FRAME_MS : Math.min(now - lastTs, MAX_FRAME_MS);
      lastTs = now;
      tick(elapsed / FRAME_MS);
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (raf) return;
      lastTs = null; // avoid a dt spike on resume
      raf = requestAnimationFrame(loop);
    };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };

    // Draw only when the tab is in front AND this canvas is on screen.
    //
    // A hidden tab still runs rAF in some browsers and always burns battery in
    // the ones that throttle it; nothing here is worth drawing unseen. The
    // INTERSECTION half is not redundant with that: /simulate nests two `.art`
    // elements and styles-legibility.css:93-95 hides the inner canvas with
    // `display: none`. That hid the pixels but not the cost — the loop kept
    // running and kept drawing into a 0×0 surface. A `display:none` element
    // reports zero intersection, so it now stops.
    const undrawable = observeDrawable(canvas, (drawable) => {
      if (drawable) start();
      else stop();
    });

    return () => {
      disposed = true;
      undrawable();
      stop();
      ro.disconnect();
    };
  }, [density, speed, reduced, tier]);

  return <canvas ref={ref} className={"art-canvas " + (className || "")} />;
}

export interface UseTickOptions {
  /**
   * `true` (default) — this tick drives decoration. It may be slowed on weak
   * devices and frozen entirely under `prefers-reduced-motion`.
   *
   * `false` — this tick drives a real elapsed-time readout (mempool-shared's
   * "updated Ns ago", classic's block-ETA countdown). Its interval is never
   * stretched and it is never frozen, because a clock that lies is a bug, not
   * a saved frame. It is still paused while the tab is hidden — nobody is
   * reading it — and fires immediately on return so it is never stale on
   * screen.
   */
  motion?: boolean;
}

/**
 * Animation tick — re-renders every `intervalMs`. Used by view-engine scenes.
 *
 * v6.0.8: this hook is the app's timer storm. Twenty-one call sites, intervals
 * down to 50ms, every one of them a `setInterval` that forces a full React
 * re-render of its subtree and none of them stopping when the tab went away.
 * The gating lives here rather than at the call sites so all twenty-one are
 * fixed at once:
 *
 *   - paused while the tab is hidden, with one immediate tick on return
 *   - frozen under `prefers-reduced-motion` (motion ticks only)
 *   - floored per device tier (motion ticks only): `mid` ≥80ms, `low` ≥200ms
 *
 * For genuine motion — SVG scenes redrawing tens of nodes — prefer
 * `useAnimationClock` (design/useAnimationClock.ts), which shares one rAF
 * across all subscribers instead of arming a timer per component.
 *
 * Known limitation: the tier is resolved once per page load, so flipping the
 * OS reduced-motion setting mid-session re-freezes motion ticks (via the
 * reactive `useReducedMotion`) but does not re-tier the interval floors. A
 * reload does. That trade is deliberate — see design/deviceTier.ts.
 */
export function useTick(intervalMs = 1000, { motion = true }: UseTickOptions = {}): number {
  const reduced = useReducedMotion();
  const tier = getDeviceTier();
  const frozen = motion && reduced;
  const effectiveMs = motion
    ? Math.max(intervalMs, byTier(tier, { high: 0, mid: 80, low: 200 }))
    : intervalMs;

  const [n, setN] = React.useState(0);

  React.useEffect(() => {
    if (frozen) return;

    let id = 0;
    const start = () => {
      if (id) return;
      id = window.setInterval(() => setN((x) => x + 1), effectiveMs);
    };
    const stop = () => {
      if (!id) return;
      clearInterval(id);
      id = 0;
    };

    if (isPageActive()) start();

    const off = onPageActiveChange((active) => {
      if (!active) { stop(); return; }
      // Tick once on return so a clock that was paused for a minute is
      // correct on the first painted frame, not one interval later.
      setN((x) => x + 1);
      start();
    });

    return () => { stop(); off(); };
  }, [effectiveMs, frozen]);

  return frozen ? 0 : n;
}
