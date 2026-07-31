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

interface Subscriber {
  fps: number;
  /** Timestamp of the last delivered frame, in rAF-clock ms. */
  last: number;
  cb: (frame: number) => void;
  frame: number;
}

const subscribers = new Set<Subscriber>();
let raf = 0;
let unbindVisibility: (() => void) | null = null;

function loop(now: number): void {
  raf = requestAnimationFrame(loop);
  for (const s of subscribers) {
    const interval = 1000 / s.fps;
    if (now - s.last < interval) continue;
    // Snap to the grid rather than accumulating drift, but never let a long
    // stall (a backgrounded tab that resumed, a GC pause) queue a burst of
    // catch-up frames — this is a render driver, not a physics integrator.
    s.last = now - Math.min(now - s.last - interval, interval);
    s.frame += 1;
    s.cb(s.frame);
  }
}

function start(): void {
  if (raf || subscribers.size === 0 || !isPageActive()) return;
  // Reset every subscriber's clock so resuming from a hidden tab delivers one
  // frame promptly instead of one frame per elapsed interval.
  for (const s of subscribers) s.last = 0;
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

function subscribe(fps: number, cb: (frame: number) => void): () => void {
  const s: Subscriber = { fps, last: 0, cb, frame: 0 };
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
    return subscribe(effectiveFps, setFrame);
  }, [effectiveFps, enabled]);

  return enabled ? frame : 0;
}
