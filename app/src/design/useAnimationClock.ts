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
import { FLOOR, NO_BASELINE, governorReset, governorSample } from "./governor";

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
 * The RULE itself lives in design/governor.ts, dependency-free, so the gate can
 * import and replay the shipped arithmetic instead of re-implementing it. This
 * file owns the two things the rule cannot: WHO drives it, and how it is seen.
 *
 * WHO DRIVES IT. Every existing per-frame heartbeat feeds `sampleFrameBudget`;
 * none of them is a new loop. This shared rAF is one. The other is
 * ParticleField's own rAF (design/ArtBackground.tsx), which predates this loop
 * and cannot fold into it — it drives a canvas at display rate, not a React
 * subscriber at a throttled tier fps. That matters practically: the shared loop
 * only runs where `useAnimationClock` has subscribers (mempool/constellation
 * and protocols/view-tags — two routes), so a governor driven by it alone would
 * be permanently inert on `/`, the route carrying the heaviest canvas in the
 * app. `governorSample`'s non-advancing-timestamp guard is what makes two
 * feeders safe: rAF gives every callback in a frame the same timestamp, so the
 * second one to arrive is ignored rather than double-counted.
 *
 * SURFACED, NOT SILENT. A governor that quietly degrades output is the same
 * failure as a gate that passes what it did not check — you cannot tell a
 * deliberate low-quality render from a broken one. Whenever the dial is off
 * full it is readable two ways, both documented and both checked by
 * verify-govern.mjs:
 *
 *   document.documentElement.dataset.gov   → "95" … "50", absent at full
 *   window.__XMR_GOV__                     → { scale, fps, sample() } exact
 *
 * `data-gov` is REMOVED rather than set to "100" at full quality, so its mere
 * presence means "something is being held back right now" — for a human that is
 * one glance at <html> in DevTools. It is quantised to 5% steps (floored, so a
 * shedding dial can never round back up to a reassuring "100") because the
 * attribute lands on the ROOT element: an unquantised write would restyle the
 * whole document on ~42 consecutive frames during a shed, which is precisely
 * the kind of cost this governor exists to remove. `window.__XMR_GOV__` carries
 * the unrounded numbers for anyone who needs them.
 */
const GOV = { scale: 1, ema: 60, lastTs: NO_BASELINE };

/** Published `data-gov` step, in percent. See the header for why it is coarse. */
const PUBLISH_STEP = 5;
/** Quantum for React consumers, so a shed re-renders a list ~5 times, not ~42. */
const SCALE_QUANTUM = 0.1;

/** Current quality dial, 0.5–1. Read per frame; never cached across frames. */
export function governorScale(): number {
  return GOV.scale;
}

/** Smoothed framerate the dial is reacting to. Exposed for gates and diagnostics. */
export function governorFps(): number {
  return GOV.ema;
}

/** The dial rounded to `SCALE_QUANTUM`, for consumers that re-render on change. */
export function governorScaleQuantised(): number {
  return Math.min(1, Math.max(FLOOR, Math.round(GOV.scale / SCALE_QUANTUM) * SCALE_QUANTUM));
}

type ScaleListener = (scale: number) => void;
const scaleListeners = new Set<ScaleListener>();

/**
 * Subscribe to QUANTISED dial changes. Fires only when the rounded value moves,
 * never on subscribe — read `governorScaleQuantised()` for the current value.
 *
 * Canvas consumers should NOT use this: they redraw every frame anyway and
 * should read `governorScale()` inline, unrounded. This exists for DOM
 * consumers (AmbientField's orb list), where acting on the raw dial would mean
 * a React re-render on every one of the ~42 frames a shed takes.
 */
export function onGovernorScaleChange(fn: ScaleListener): () => void {
  scaleListeners.add(fn);
  return () => {
    scaleListeners.delete(fn);
  };
}

let publishedGov = -1;

function publishGovernor(): void {
  const q = governorScaleQuantised();
  for (const fn of [...scaleListeners]) fn(q);

  if (typeof document === "undefined") return;
  // floor, not round: at scale .98 a rounded percentage reads "100", which is
  // the one value that must mean "nothing is being held back".
  const pct = GOV.scale < 0.99 ? Math.floor((GOV.scale * 100) / PUBLISH_STEP) * PUBLISH_STEP : 100;
  if (pct === publishedGov) return; // no DOM write when nothing visible changed
  publishedGov = pct;
  const el = document.documentElement;
  if (pct < 100) el.setAttribute("data-gov", String(pct));
  else el.removeAttribute("data-gov");
}

/** `?gov=off` pins the dial at 1 for this document. Read once, like `?tier=`
 *  in deviceTier.ts, and for the same two users:
 *
 *    · SCREENSHOT GATES. verify-shots.mjs compares pixels; an ambient field
 *      that thins because the CI box missed frame budget is a diff with no
 *      defect behind it, and freezeAmbient() cannot help — it stops animation,
 *      not mounting. `?gov=off` makes the field's SIZE deterministic too.
 *    · A HUMAN asking "is this the governor or a bug?", which is a question
 *      `data-gov` raises and only an off switch answers.
 *
 *  Deliberately one-directional: it can only DISABLE shedding. There is no
 *  `?gov=0.5` — a forced-low dial would be a fourth way to make the app look
 *  broken on purpose, and the two we have (`?tier=`, the Ambient knob) are
 *  enough. */
const govDisabled =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("gov") === "off";

/**
 * Feed one rAF timestamp to the frame-budget governor.
 *
 * Public because the app has more than one pre-existing per-frame heartbeat and
 * they must share ONE dial — see the header. Safe to call from any number of
 * loops in the same frame: samples that do not advance the timestamp are
 * dropped by `governorSample`.
 */
export function sampleFrameBudget(now: number): void {
  if (govDisabled) return;
  if (governorSample(GOV, now)) publishGovernor();
}

/**
 * Drop the governor's timing baseline. Every driving loop calls this when it
 * (re)starts, so the wall-clock gap it was stopped across is never read as one
 * enormous frame. `scale`/`ema` survive — see governorReset.
 *
 * RESUME_GAP_MS would catch a long pause on its own; this exists for the SHORT
 * ones it deliberately cannot, e.g. a fast scroll flipping ParticleField's
 * IntersectionObserver off and on inside 250ms, which would otherwise land as a
 * single genuine-looking 4fps sample.
 */
export function resetFrameBudgetBaseline(): void {
  governorReset(GOV);
}

/* The documented read hook, in the idiom of `__MEM_FPS__` / `__XMR_TIER_MS__` /
 * `__xmriBootTimeoutMs`. `sample()` drives the REAL rule with a synthetic
 * timestamp series, which is what lets verify-govern.mjs assert the whole
 * publish path — rule → quantiser → attribute — in a real browser without
 * waiting on a real stall, and lets a human reproduce a shed on demand:
 *
 *   let t = performance.now();
 *   for (let i = 0; i < 200; i++) __XMR_GOV__.sample(t += 33);  // 30fps
 *   document.documentElement.dataset.gov                        // "50"
 */
if (typeof window !== "undefined") {
  (window as unknown as { __XMR_GOV__: unknown }).__XMR_GOV__ = {
    get scale() {
      return GOV.scale;
    },
    get fps() {
      return GOV.ema;
    },
    sample: sampleFrameBudget,
  };
}

function loop(now: number): void {
  raf = requestAnimationFrame(loop);
  sampleFrameBudget(now);
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
  // Same reasoning for the governor's own clock: the gap across a stop/start is
  // wall-time the page spent hidden or unsubscribed, not a slow frame. Only the
  // timing baseline is dropped — `scale` and `ema` survive, see governorReset.
  governorReset(GOV);
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
/**
 * The frame-budget dial, quantised, as React state (D0692 consumer side).
 *
 * Multiply a MOUNTED-ELEMENT count by it — DOM consumers pay per element every
 * frame the compositor runs, whether or not React re-rendered, so shedding here
 * means mounting fewer nodes. Canvas consumers must NOT use this hook: they
 * already redraw every frame and should read `governorScale()` inline, where
 * the value is unrounded and costs nothing.
 *
 * Starts at 1 and adopts the live value in an effect, so the prerendered HTML
 * and the first client render always agree (scripts/prerender.mjs runs
 * renderToString, where no effect has run and the field is at full quality —
 * the honest floor for a document with no framerate to measure).
 */
export function useGovernorScale(): number {
  const [scale, setScale] = React.useState(1);
  React.useEffect(() => {
    setScale(governorScaleQuantised());
    return onGovernorScaleChange(setScale);
  }, []);
  return scale;
}

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
