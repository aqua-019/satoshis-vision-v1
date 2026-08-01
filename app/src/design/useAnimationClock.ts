/**
 * design/useAnimationClock.ts — one rAF loop for every React-rendered
 * animation, instead of N setIntervals.
 *
 * `useTick` (design/ArtBackground.tsx) is fine for a 1Hz clock label but it
 * is the wrong driver for motion: each call site owns its own `setInterval`,
 * none of them align to a frame, and the two worst offenders
 * (mempool/constellation.tsx and protocols/view-tags.tsx, both at 50ms) push
 * ~60 SVG nodes through React reconciliation 20 times a second. Twenty-one
 * independent timers is also twenty-one independent wakeups on a phone,
 * which is what actually costs battery.
 *
 * This module runs a single rAF and fans it out to subscribers, each at its
 * own requested framerate. One wakeup, throttled per consumer, aligned to the
 * compositor. The loop does not run at all while the tab is hidden and stops
 * entirely when the last subscriber leaves.
 *
 * The frame counter is a monotonically increasing integer, deliberately the
 * same shape `useTick` returns, so migrating a call site is a one-line change
 * and the `Math.floor(tick / 25) % 9`-style expressions downstream keep
 * working. Callers that want wall-clock semantics should read `dt` instead of
 * counting frames.
 */

import * as React from "react";
import { getDeviceTier, type Tier } from "./deviceTier";
import { isPageActive, onPageActiveChange } from "./usePageActive";
import { governorStep } from "./governor";

interface Subscriber {
  fps: number;
  /** Timestamp of the last delivered frame, in rAF-clock ms. */
  last: number;
  cb: (frame: number, seconds: number) => void;
  frame: number;
  /** Accumulated *animation* seconds — excludes time spent hidden, so a
   *  resumed animation continues rather than jumping. */
  seconds: number;
}

const subscribers = new Set<Subscriber>();
let raf = 0;
let unbindVisibility: (() => void) | null = null;

/** Longest gap we credit to animation time. Mirrors the canvas drivers' clamp:
 *  a stall must not teleport an animation forward. */
const MAX_STEP_MS = 50;

/* ── D0692 · frame-budget governor ──────────────────────────────────────────
 * Rides the loop that already exists rather than adding a second one: this rAF
 * is the only per-frame heartbeat in the app, so it is the only place that can
 * measure the real frame budget without paying for the measurement.
 *
 * `scale` is a 0.5–1 quality dial consumers multiply their particle or plate
 * count by. The asymmetry is the whole design — it sheds at .012/frame and
 * recovers at .004/frame, i.e. roughly 3× slower to give quality back than to
 * take it away. Symmetric rates produce visible pumping: the moment shedding
 * relieves the load, the fps recovers, quality returns, and the load comes
 * straight back. Slow recovery makes that oscillation converge instead.
 *
 * SURFACED, NOT SILENT. A governor that quietly degrades output is the same
 * failure as a gate that passes what it did not check — you cannot tell a
 * deliberate low-quality render from a broken one. Whenever the dial is off
 * full, `data-gov` lands on <html> carrying the current percentage, so a human
 * reading DevTools and verify-govern.mjs read the same number from the same
 * place. It is removed (not set to "100") at full quality, so its mere presence
 * means "something is being held back right now".
 */
const GOV = { scale: 1, ema: 60 };

/** Frame gap above which we assume a RESUME, not a stall, and skip the sample.
 *  Deliberately well above MAX_STEP_MS: a 50ms frame IS the 20fps stall this
 *  governor exists to catch, so clamping the sample at MAX_STEP_MS would blind
 *  it to exactly the condition it is measuring. A quarter-second gap is not a
 *  slow frame — it is a backgrounded tab, a GC pause, or the first frame after
 *  start(), none of which say anything about sustainable framerate. */
const RESUME_GAP_MS = 250;

let lastFrameTs = 0;

/** Current quality dial, 0.5–1. Read per frame; never cached across frames. */
export function governorScale(): number {
  return GOV.scale;
}

/** Smoothed framerate the dial is reacting to. Exposed for gates and diagnostics. */
export function governorFps(): number {
  return GOV.ema;
}

function publishGovernor(): void {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  if (GOV.scale < 0.99) el.setAttribute("data-gov", String(Math.round(GOV.scale * 100)));
  else el.removeAttribute("data-gov");
}

function sampleFrame(now: number): void {
  // First frame after a start(), or a resume: establish a baseline and take no
  // reading. `lastFrameTs` is reset to 0 by start(), which is what makes a tab
  // that was hidden for a minute not read as one catastrophic frame.
  if (lastFrameTs === 0 || now - lastFrameTs > RESUME_GAP_MS) {
    lastFrameTs = now;
    return;
  }
  const dt = now - lastFrameTs;
  lastFrameTs = now;
  const before = GOV.scale;
  governorStep(GOV, 1000 / Math.max(1, dt));
  if (GOV.scale !== before) publishGovernor();
}

function loop(now: number): void {
  raf = requestAnimationFrame(loop);
  sampleFrame(now);
  for (const s of subscribers) {
    const interval = 1000 / s.fps;
    const gap = now - s.last;
    if (gap < interval) continue;
    // Snap to the grid rather than accumulating drift, but never let a long
    // stall (a backgrounded tab that resumed, a GC pause) queue a burst of
    // catch-up frames — this is a render driver, not a physics integrator.
    s.last = now - Math.min(gap - interval, interval);
    s.frame += 1;
    s.seconds += Math.min(gap, MAX_STEP_MS) / 1000;
    s.cb(s.frame, s.seconds);
  }
}

function start(): void {
  if (raf || subscribers.size === 0 || !isPageActive()) return;
  // Reset every subscriber's clock so resuming from a hidden tab delivers one
  // frame promptly instead of one frame per elapsed interval.
  for (const s of subscribers) s.last = 0;
  // Same reasoning for the governor's own clock: the gap across a stop/start
  // is wall-time the page spent hidden or unsubscribed, not a slow frame. The
  // accumulated `scale` deliberately SURVIVES — a device that could not hold
  // 60fps a moment ago is the same device now, and re-probing from 1 on every
  // subscriber churn would make the dial oscillate with mount/unmount traffic
  // rather than with actual load.
  lastFrameTs = 0;
  raf = requestAnimationFrame(loop);
}

function stop(): void {
  if (!raf) return;
  cancelAnimationFrame(raf);
  raf = 0;
}

function ensureBound(): void {
  if (unbindVisibility) return;
  unbindVisibility = onPageActiveChange((active) => {
    if (active) start();
    else stop();
  });
}

function subscribe(fps: number, cb: (frame: number, seconds: number) => void): () => void {
  const s: Subscriber = { fps, last: 0, cb, frame: 0, seconds: 0 };
  subscribers.add(s);
  ensureBound();
  start();
  return () => {
    subscribers.delete(s);
    if (subscribers.size === 0) {
      stop();
      unbindVisibility?.();
      unbindVisibility = null;
    }
  };
}

/** Per-tier framerate for React-rendered motion. */
export function motionFps(tier: Tier, high: number): number {
  if (tier === "high") return high;
  if (tier === "mid") return Math.max(8, Math.round(high * 0.6));
  return Math.max(4, Math.round(high * 0.3));
}

export interface AnimationClockOptions {
  /** Framerate on the `high` tier; mid/low are scaled down from it. */
  fps?: number;
  /** Set false to freeze (returns 0 and never subscribes). */
  enabled?: boolean;
}

/**
 * A frame counter driven by the shared rAF loop, throttled to `fps` (scaled
 * per device tier) and paused whenever the tab is hidden.
 *
 * Drop-in for `useTick(ms)` on motion surfaces:
 *
 *   const tick = useTick(50);                 // 21 timers, runs while hidden
 *   const tick = useAnimationClock({ fps: 20 });  // shared loop, pauses
 */
export function useAnimationClock({ fps = 20, enabled = true }: AnimationClockOptions = {}): number {
  const tier = getDeviceTier();
  const effectiveFps = motionFps(tier, fps);
  const [frame, setFrame] = React.useState(0);

  React.useEffect(() => {
    if (!enabled) return;
    return subscribe(effectiveFps, (f) => setFrame(f));
  }, [effectiveFps, enabled]);

  return enabled ? frame : 0;
}

/**
 * Elapsed **animation seconds** from the same shared loop.
 *
 * Prefer this over the frame counter whenever the value feeds a *duration* —
 * a rotation rate, a cycle period, a sweep position. A frame counter changes
 * meaning per tier (20fps on high, 6fps on low), so `tick * 0.008` silently
 * becomes a 3× slower rotation on a phone. Seconds do not: the animation runs
 * at the same *speed* everywhere and only its smoothness varies, which is the
 * trade this whole pass is trying to make.
 *
 * Time spent with the tab hidden is excluded, so returning to a tab resumes
 * the animation where it was rather than jumping forward by the absence.
 */
export function useAnimationSeconds({ fps = 20, enabled = true }: AnimationClockOptions = {}): number {
  const tier = getDeviceTier();
  const effectiveFps = motionFps(tier, fps);
  const [seconds, setSeconds] = React.useState(0);

  React.useEffect(() => {
    if (!enabled) return;
    return subscribe(effectiveFps, (_f, t) => setSeconds(t));
  }, [effectiveFps, enabled]);

  return enabled ? seconds : 0;
}
