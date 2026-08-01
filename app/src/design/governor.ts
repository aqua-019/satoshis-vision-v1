/**
 * design/governor.ts — D0692. The frame-budget rule, and nothing else.
 *
 * Deliberately DEPENDENCY-FREE. It lives apart from useAnimationClock.ts (which
 * drives it) for one reason: verify-govern.mjs imports this module directly and
 * replays the real rule against synthetic frame series. Node 22's type stripping
 * cannot resolve the extensionless transitive imports useAnimationClock carries
 * (`./deviceTier`, `./usePageActive`), so a gate that reached for the rule
 * through that file could not load it at all — and the alternative, a gate that
 * re-implements the arithmetic, passes whenever its copy and the source agree.
 * Including when both are wrong, and including when the loop quietly stops
 * calling the rule. One implementation, driven by the test.
 *
 * WHY A GOVERNOR AT ALL: device tiering (design/deviceTier.ts) is decided once
 * per load from static signals — cores, memory, viewport. It cannot know that
 * this particular page, with this much mempool traffic, on a machine that is
 * also playing video, is missing frame budget right now. The tier sets the
 * starting budget; this adjusts it against what actually happened.
 */

export interface GovernorState {
  /** Quality dial, FLOOR..1. Consumers multiply particle/plate counts by it. */
  scale: number;
  /** Smoothed observed framerate. */
  ema: number;
  /** rAF timestamp of the last accepted sample. NO_BASELINE until one lands.
   *  Deliberately not `0`: rAF timestamps are measured from the navigation
   *  start, so the first frames of a page load are single-digit milliseconds
   *  and a `0` sentinel makes an early real timestamp indistinguishable from
   *  "never sampled". */
  lastTs: number;
}

/** Smoothing on the observed framerate. ~12-frame effective window. */
export const EMA_ALPHA = 0.08;
/** Below this smoothed fps, shed quality. */
export const SHED_BELOW = 42;
/** Above this, give it back. The gap between the two is deliberate hysteresis:
 *  a single threshold would oscillate every frame it sat on the boundary. */
export const RECOVER_ABOVE = 56;
/** Per-frame shed step. */
export const SHED_RATE = 0.012;
/** Per-frame recover step — 3× slower than shedding, see below. */
export const RECOVER_RATE = 0.004;
/** Never shed past this: below half quality the effect stops reading as the
 *  same design and starts reading as broken. */
export const FLOOR = 0.5;

/**
 * One governor step, as a pure function of (state, observed fps). Mutates and
 * returns `state` so the hot path allocates nothing.
 *
 * The asymmetry is the entire design. Shedding is fast (.012/frame, ~0.7s from
 * full to floor at 60fps) because the user is dropping frames NOW. Recovery is
 * 3× slower (.004/frame) because the load that caused the drop usually has not
 * gone away — it was relieved BY the shedding. Symmetric rates produce visible
 * pumping: quality returns, load returns with it, quality drops again, forever.
 * Slow recovery makes that loop converge instead of oscillate.
 */
export function governorStep(state: GovernorState, fps: number): GovernorState {
  state.ema = state.ema * (1 - EMA_ALPHA) + fps * EMA_ALPHA;
  if (state.ema < SHED_BELOW && state.scale > FLOOR) {
    state.scale = Math.max(FLOOR, state.scale - SHED_RATE);
  } else if (state.ema > RECOVER_ABOVE && state.scale < 1) {
    state.scale = Math.min(1, state.scale + RECOVER_RATE);
  }
  return state;
}

/** Frame gap above which we assume a RESUME, not a stall, and take no reading.
 *
 *  Deliberately far above useAnimationClock's MAX_STEP_MS (50ms). That clamp
 *  bounds how much *animation time* a slow frame may advance; reusing it here
 *  would clamp the MEASUREMENT too, and a 50ms frame IS the 20fps stall this
 *  governor exists to catch — the governor would be blind to exactly the
 *  condition it measures. A quarter-second gap is not a slow frame: it is a
 *  backgrounded tab, a GC pause, or the first frame after a (re)start, none of
 *  which say anything about sustainable framerate. */
export const RESUME_GAP_MS = 250;

/** `lastTs` sentinel for "no baseline yet". Negative so it can never collide
 *  with a real rAF timestamp, which starts at ~0 on a fresh navigation. */
export const NO_BASELINE = -1;

/**
 * Feed one rAF timestamp to the governor. Returns `true` only when the dial
 * actually moved, so the caller can publish (§ useAnimationClock) instead of
 * writing to the DOM every frame.
 *
 * Two guards, both load-bearing, and both testable from Node because they live
 * here rather than inside the loop:
 *
 *  1. RESUME / COLD START — `lastTs === 0` or a gap over RESUME_GAP_MS
 *     re-establishes the baseline and takes NO reading. Without it, a tab that
 *     spent a minute hidden returns as one 60,000ms "frame" (0.016fps) and
 *     sheds to the floor for a stall that never happened.
 *
 *  2. NON-ADVANCING TIMESTAMP — two callers feed this (the shared clock loop
 *     and ParticleField's own pre-existing rAF), and rAF hands EVERY callback
 *     scheduled for a frame the SAME timestamp. Without the `now <= last`
 *     guard, the second caller each frame would measure a 0ms gap, read it as
 *     1000fps, and drag the EMA up to a framerate no device is achieving. This
 *     is what lets the rule be driven from more than one existing heartbeat
 *     without ever becoming a second loop or a second dial.
 */
export function governorSample(state: GovernorState, now: number): boolean {
  const last = state.lastTs;
  if (last === NO_BASELINE || now - last > RESUME_GAP_MS) { // cold start or resume
    state.lastTs = now;
    return false;
  }
  if (now <= last) return false;                            // same frame, already sampled
  const before = state.scale;
  const dt = now - last;
  state.lastTs = now;
  governorStep(state, 1000 / Math.max(1, dt));
  return state.scale !== before;
}

/**
 * Drop the timing baseline — call on every (re)start of a driving loop.
 *
 * `scale` and `ema` deliberately SURVIVE. A device that could not hold 60fps a
 * moment ago is the same device now, and the shared loop stops and starts on
 * ordinary subscriber churn (a component unmounting is not new evidence about
 * the frame budget). Re-probing from 1 on every start would make the dial track
 * mount traffic instead of load, which is the pumping this design exists to
 * avoid — just on a different axis.
 */
export function governorReset(state: GovernorState): void {
  state.lastTs = NO_BASELINE;
}
