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
