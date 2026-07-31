/**
 * pages/future/FutureMini.tsx — compact animated viz used inside the FUTURE
 * tab's protocol pop-ups (six draw modes, one per incoming protocol).
 *
 * `useMiniCanvas` below is a local re-implementation of the prototype's
 * `useMemCanvas` hook, which does not exist in this repo. Modeled on the
 * ParticleField effect in design/ArtBackground.tsx: DPR clamped (tier-aware,
 * see below — ParticleField's flat 2 became a per-tier ceiling in v6.0.8),
 * ResizeObserver-driven sizing, `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`,
 * cancelAnimationFrame on cleanup. Kept module-private — do not export it,
 * move it to @/design/, or import useFrame from @/protocols/sim-fx (that
 * hook lives in the lazy /simulate chunk). Importing `byTier`/`Tier` from
 * design/deviceTier.ts and `useVisual` from design/VisualContext.tsx is not
 * that — those are read-only utility imports, not a relocation of the hook
 * itself, and that boundary stays exactly where it was.
 *
 * Two additions ParticleField doesn't need: honours prefers-reduced-motion
 * (a single static frame at t=0, no rAF loop — a murmuration inside a modal
 * is a bigger vestibular hit than background stars) via the shared reactive
 * design/useReducedMotion hook (so toggling the OS setting mid-session tears
 * the canvas down and rebuilds it in the right mode), and pauses the loop
 * while the tab is hidden (document.visibilityState === "hidden").
 */

import * as React from "react";
import { useReducedMotion } from "@/design/useReducedMotion";
import type { MiniMode } from "./data";
import { byTier, type Tier } from "@/design/deviceTier";
import { useVisual } from "@/design/VisualContext";

type DrawFn = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, dt: number) => void;

function useMiniCanvas(draw: DrawFn, tier: Tier): React.RefObject<HTMLCanvasElement> {
  const ref = React.useRef<HTMLCanvasElement | null>(null);
  // Latest draw callback, read from inside the rAF loop without re-running
  // the setup effect on every render (mode/height changes don't tear down
  // the canvas + observer).
  const drawRef = React.useRef<DrawFn>(draw);
  drawRef.current = draw;
  const reduceMotion = useReducedMotion();

  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    // `mid` still gets the full 2x — this is a 240px-tall canvas inside a
    // modal, not the fullscreen aurora, so halving it doesn't buy much. `low`
    // is where the ceiling actually drops the backing-store pixel count.
    const dpr = Math.min(window.devicePixelRatio || 1, byTier(tier, { high: 2, mid: 2, low: 1.5 }));

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      // v6.0.7: ResizeObserver fires with an identical box more often than you
      // would expect — and under Tor Browser's letterboxing (the viewport snaps
      // to 200x100 multiples) a single window drag produces a burst of them.
      // The writes below are a full backing-store realloc plus a wipe plus a
      // redraw, so bailing on a no-op change is free performance.
      if (r.width === w && r.height === h) return;
      w = r.width;
      h = r.height;
      // Assigning width/height resets the backing store AND wipes the canvas.
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Under reduced motion there is no rAF loop to repaint what that wipe
      // just erased, so the static frame has to be redrawn here or the viz
      // goes permanently blank on the first resize.
      if (reduceMotion) drawRef.current(ctx, w, h, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    if (reduceMotion) return () => ro.disconnect();

    let raf = 0;
    let elapsed = 0; // animation seconds, frozen while the tab is hidden
    let lastTs: number | null = null;

    const frame = (now: number) => {
      if (lastTs !== null) {
        // Clamp at 50ms: an unclamped dt after a long main-thread stall (tab
        // switch mid-frame, a GC pause, devtools open) would otherwise jump
        // every t-dependent draw call forward by however long the stall was
        // — e.g. the fcmp murmuration's per-particle angle uses `t` directly,
        // so an unclamped multi-second dt reads as the particles teleporting
        // instead of animating. `elapsed` accumulates the CLAMPED value, not
        // the raw one, so animation time and wall time stay consistent with
        // each other post-clamp instead of `elapsed` silently falling behind
        // real time after every stall.
        const dt = Math.min((now - lastTs) / 1000, 0.05);
        elapsed += dt;
        drawRef.current(ctx, w, h, elapsed, dt);
      } else {
        drawRef.current(ctx, w, h, elapsed, 0);
      }
      lastTs = now;
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (raf) return;
      lastTs = null; // avoid a huge dt jump on resume
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      lastTs = null;
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") stop();
      else start();
    };
    document.addEventListener("visibilitychange", onVisibility);
    if (document.visibilityState !== "hidden") start();

    return () => {
      stop();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // reduceMotion is the reactive dependency — mode/height changes flow
    // through drawRef above and don't need a teardown/rebuild. `tier` is
    // listed for lint honesty (the effect reads it via `dpr`) but can't
    // actually re-fire: getDeviceTier() is memoized for the page's lifetime.
  }, [reduceMotion, tier]);

  return ref;
}

export interface FutureMiniProps {
  mode: MiniMode;
  height?: number;
}

export function FutureMini({ mode, height = 240 }: FutureMiniProps) {
  const { tier } = useVisual();
  const ref = useMiniCanvas((ctx, w, h, t) => {
    ctx.clearRect(0, 0, w, h);
    // "lighter" (additive blend) is load-bearing here, not decorative: every
    // mode below draws overlapping translucent particles/traces meant to
    // glow brighter where they cross (the fcmp murmuration's converging
    // paths, cuprate's two race traces, jamtis's ribbon segments) — plain
    // source-over would just show the top-most draw call's alpha and the
    // "engine under load" read would be gone. It is a per-pixel
    // read-modify-write, but the canvas here is small (240px tall, capped
    // by `height`) and only paints while its modal is open and on-screen
    // (ResizeObserver + visibilitychange above), so the region it applies
    // to is already about as restricted as this component can make it
    // without giving up the additive look mode-by-mode.
    ctx.globalCompositeOperation = "lighter";

    if (mode === "fcmp") {
      // murmuration converging on one bright proof
      const cx = w / 2, cy = h / 2;
      for (let i = 0; i < 130; i++) {
        const a = i * 2.399 + t * (0.12 + (i % 7) * 0.014);
        const r = (Math.min(w, h) * 0.46) * (0.25 + ((i * 37) % 100) / 130) * (0.85 + 0.15 * Math.sin(t * 0.7 + i));
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.6;
        ctx.fillStyle = `rgba(184,122,255,${0.25 + 0.3 * Math.sin(t * 2 + i)})`;
        ctx.beginPath(); ctx.arc(x, y, 1.3, 0, Math.PI * 2); ctx.fill();
      }
      const pulse = 0.6 + 0.4 * Math.sin(t * 2.4);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60);
      g.addColorStop(0, `rgba(216,180,255,${0.8 * pulse})`); g.addColorStop(1, "rgba(184,122,255,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 60, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.shadowColor = "#b87aff"; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    } else if (mode === "seraphis") {
      // pistons: proof blocks compressing through the engine
      for (let i = 0; i < 5; i++) {
        const ph = (t * 0.5 + i * 0.2) % 1;
        const x = ph * w, y = h * (0.2 + i * 0.15);
        const sz = 16 * (1 - ph * 0.35);
        ctx.fillStyle = `rgba(184,122,255,${0.65 - ph * 0.3})`;
        ctx.shadowColor = "rgba(184,122,255,0.8)"; ctx.shadowBlur = 8;
        ctx.fillRect(x, y - sz / 4, sz, sz / 2);
        ctx.shadowBlur = 0;
      }
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.strokeRect(w * 0.55, h * 0.1, 8, h * 0.74);
    } else if (mode === "jamtis") {
      // character ribbon weaving into colored segments
      const cols = ["255,140,40", "94,211,244", "184,122,255", "74,222,128", "255,212,0", "255,77,109"];
      for (let i = 0; i < 60; i++) {
        const x = (i / 60) * w;
        const seg = cols[Math.floor(i / 10)];
        const y = h / 2 + Math.sin(i * 0.5 + t * 1.8) * h * 0.22 * Math.max(0, 1 - t * 0.18 % 1.4);
        ctx.fillStyle = `rgba(${seg},0.85)`;
        ctx.shadowColor = `rgba(${seg},0.9)`; ctx.shadowBlur = 7;
        ctx.fillRect(x, y - 5, 7, 10);
        ctx.shadowBlur = 0;
      }
    } else if (mode === "carrot") {
      // keyhole gate: left particles seen (cyan), right sealed (dark)
      const gx = w * 0.5;
      ctx.strokeStyle = "rgba(94,211,244,0.7)"; ctx.lineWidth = 2;
      ctx.shadowColor = "rgba(94,211,244,0.9)"; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(gx, h * 0.42, 16, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(gx - 7, h * 0.52); ctx.lineTo(gx + 7, h * 0.52); ctx.lineTo(gx + 4, h * 0.72); ctx.lineTo(gx - 4, h * 0.72); ctx.closePath(); ctx.stroke();
      ctx.shadowBlur = 0;
      for (let i = 0; i < 16; i++) {
        const ph = ((t * 0.3 + i * 0.13) % 1);
        const inSide = i % 2 === 0;
        const x = inSide ? ph * (gx - 30) : gx + 30 + ph * (w - gx - 30);
        const y = h * (0.25 + ((i * 53) % 50) / 100);
        ctx.fillStyle = inSide ? "rgba(94,211,244,0.8)" : "rgba(120,100,160,0.28)";
        ctx.shadowColor = inSide ? "rgba(94,211,244,0.9)" : "transparent"; ctx.shadowBlur = inSide ? 8 : 0;
        ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }
    } else if (mode === "cuprate") {
      // two racing engine traces
      const traces: ReadonlyArray<readonly [string, number, number]> = [
        ["255,140,40", 0.36, 0.7],
        ["94,211,244", 0.64, 1],
      ];
      traces.forEach(([c, fy, sp]) => {
        const px = ((t * 0.12 * sp) % 1.1) * w;
        ctx.strokeStyle = `rgba(${c},0.5)`; ctx.lineWidth = 3; ctx.lineCap = "round";
        ctx.shadowColor = `rgba(${c},0.8)`; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.moveTo(0, h * fy); ctx.lineTo(px, h * fy); ctx.stroke();
        ctx.fillStyle = `rgb(${c})`;
        ctx.beginPath(); ctx.arc(px, h * fy, 5, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      });
    } else if (mode === "stressnet") {
      for (let i = 0; i < 26; i++) {
        const ph = ((t * (0.5 + (i % 5) * 0.1) + i * 0.07) % 1);
        const x = ph * w * 0.62, y = h * (0.15 + ((i * 37) % 70) / 100);
        ctx.strokeStyle = "rgba(255,120,50,0.55)"; ctx.lineWidth = 1.4;
        ctx.shadowColor = "rgba(255,120,50,0.8)"; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.moveTo(x - 14, y); ctx.lineTo(x, y); ctx.stroke();
        ctx.shadowBlur = 0;
      }
      const bh = h * (0.3 + 0.18 * Math.sin(t * 0.8));
      ctx.strokeStyle = "rgba(74,222,128,0.8)"; ctx.fillStyle = "rgba(74,222,128,0.10)";
      ctx.shadowColor = "rgba(74,222,128,0.8)"; ctx.shadowBlur = 12;
      ctx.fillRect(w * 0.68, h / 2 - bh / 2, 44, bh);
      ctx.strokeRect(w * 0.68, h / 2 - bh / 2, 44, bh);
      ctx.shadowBlur = 0;
    }

    ctx.globalCompositeOperation = "source-over";
  }, tier);

  return (
    <canvas
      ref={ref}
      /* opaque ground: rgba(0,0,0,0.35) let the L3 aurora drift through the
         mini-sim. See --surface-ground in styles.css. */
      style={{ display: "block", width: "100%", height, background: "var(--surface-ground)", border: "1px solid var(--rule)" }}
    />
  );
}
