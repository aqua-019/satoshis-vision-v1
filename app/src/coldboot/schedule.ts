/**
 * coldboot/schedule.ts — the time→progress math the cold-boot decrypt runs
 * on. Ported from docs/v6-mockups/coldboot-splash.html:656-678 (easings,
 * beats) and :1516 (the `S.T` accumulator inside `frame()`).
 *
 * ── PURITY IS THE WHOLE POINT ───────────────────────────────────────────
 * `T(elapsedMs)` is a pure function of its one argument: no module state, no
 * `Date.now()`, no frame counter. `T(2500)` returns the identical float on
 * the first call of a session and the millionth. That is what lets
 * `field.ts#drawField` be pure in T in turn (same T twice ⇒ byte-identical
 * pixels — the property a screenshot-diff gate checks), and it is why this
 * file, unlike the mockup, has no `requestAnimationFrame` anywhere in it: the
 * HOST owns the clock (elapsed ms since mount, frozen while hidden/offscreen,
 * same discipline as `mempool/useMemCanvas.ts`) and only ever hands this
 * module a number.
 *
 * ── WHAT DIDN'T COME ALONG ───────────────────────────────────────────────
 * The mockup's `S` object bundles this schedule with a pile of interactive,
 * stateful, non-deterministic knobs (play/pause, the dev speed/duration
 * buttons, `S.reduced`, `S.gov`, the `X`/handoff clock). None of that belongs
 * in a pure module: reduced motion is a HOST decision now (mount straight to
 * the console at T=1, per the coordinator's ruling — this file was never
 * asked to encode a "settled but not T=1" freeze point, and doesn't), the
 * frame-budget governor is a runtime dt-sampling feedback loop that would
 * make output depend on real-time history rather than on T alone (kept out
 * of this module entirely; `field.ts#drawField` takes a caller-supplied
 * `density` number instead — see its header), and the `X` handoff clock and
 * its own beat table (`HB`) belong to whichever file owns the Enter handoff,
 * not to the decrypt's own schedule.
 */

/** Clamp to [0, 1]. Mirrors coldboot-splash.html:656. */
export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Re-map `t` onto the [a, b] sub-range as a clamped [0, 1] fraction.
 *  Mirrors coldboot-splash.html:657 — this is how a beat window like
 *  `B.decay` turns into a per-effect 0→1 ramp. */
export function seg(t: number, a: number, b: number): number {
  return clamp01((t - a) / (b - a));
}

/** Linear interpolation. Mirrors coldboot-splash.html:658. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * The four named easings the decrypt's math is built from. Verbatim from
 * coldboot-splash.html:659-661 — polynomial approximations chosen for canvas
 * math, NOT a JS port of the five `--e-*` CSS `cubic-bezier()` tokens
 * declared in styles.css (those govern DOM transitions and have no `--e-
 * spring` counterpart here; the mockup's own easing set has four members,
 * not five, and this is a deliberate port of THAT set, referenced by name in
 * the brief).
 */
export const E = {
  standard: (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  decel: (t: number): number => 1 - Math.pow(1 - t, 3),
  accel: (t: number): number => t * t * t,
  expressive: (t: number): number => 1 - Math.pow(1 - t, 5),
} as const;

/**
 * The beat table. Verbatim from coldboot-splash.html:669 — four named
 * windows on the [0, 1] T axis that `field.ts#drawField` reads via `seg()`
 * to derive its ignite/decay/converge easing ramps. `settle` is carried for
 * completeness and for any console/HUD file that keys its own choreography
 * off the same table; `drawField` itself only reads `ignite`/`decay`/
 * `converge`.
 */
export const B = {
  ignite: [0, 0.1],
  decay: [0.46, 0.82],
  converge: [0.8, 0.95],
  settle: [0.86, 1],
} as const;

/** Base duration, milliseconds. coldboot-splash.html:678 (`S.dur`). */
export const DUR_MS = 5000;

/** Playback speed multiplier. coldboot-splash.html:678 (`S.spd`). Baked in
 *  as a constant rather than exposed as a tunable — the mockup's own
 *  speed/duration buttons are dev-panel tooling (`:606-617`), out of scope
 *  for the shipped experience. */
export const SPD = 0.9;

/** `DUR_MS / SPD` — 5000 / 0.9 ≈ 5555.56ms, the "5.56s effective" duration
 *  named in the brief. Exported so a caller (e.g. the console's own timing,
 *  or an aria-live announcement of when the decrypt finishes) can read the
 *  same number this module's `T()` is built from, rather than recomputing
 *  it and risking drift. */
export const EFFECTIVE_MS = DUR_MS / SPD;

/**
 * Base duration on a NARROW stage — 60% of `DUR_MS`.
 *
 * ── WHY A PHONE GETS A SHORTER SEQUENCE, WITH THE NUMBERS ────────────────
 * Measured before this constant existed: the flip from `data-coldboot=
 * "decrypt"` to `"console"` landed at 5,785ms at 390x844 and 5,745ms at
 * 1440x900 — a phone was served the whole desktop sequence, to the frame.
 * `verify-vitals` puts `/`'s own LCP ceiling at 2,500ms, so the splash held a
 * phone visitor for 2.3x the budget the same repo sets for that route's
 * content.
 *
 * 60% rather than parity-with-the-LCP-ceiling, and the reason is measurable:
 * the phone stage resolves 2,856 cells against the wide stage's 7,958 (36%),
 * so it has materially less to say — but the cipher block is the SAME seven
 * rows on both, and its closing line ("signer_index ??? — NOT ENCODED IN THE
 * PROTOCOL") is the payoff the whole sequence is built around. Its readable
 * window is roughly T ∈ [0.45, 0.80], which is 1.9s at the wide duration and
 * 1.1s at this one; cutting to the 2,500ms ceiling would take it to ~0.6s and
 * buy a sequence nobody can read the end of. So: shorter, deliberately, and
 * still over `/`'s content budget — said out loud rather than hidden.
 */
export const DUR_NARROW_MS = 3000;

/** `DUR_NARROW_MS / SPD` — 3333.33ms. Same speed multiplier as the wide
 *  stage: `SPD` is a playback rate, not a per-stage knob. */
export const EFFECTIVE_NARROW_MS = DUR_NARROW_MS / SPD;

/**
 * The sequence's wall-clock ceiling, as a multiple of whichever effective
 * duration is in play — 7,500ms wide, 4,500ms narrow.
 *
 * ── THE DEFECT THIS BOUNDS, AND WHY IT INVERTS ───────────────────────────
 * `ColdBoot.tsx`'s loop advances its progress accumulator by
 * `Math.min(64, now - last)` — a clamp that exists so a stalled frame cannot
 * jump the choreography. Its side effect is that a device which CANNOT hit
 * 15.6fps advances T more slowly than the wall clock, so the sequence gets
 * LONGER on a slower phone, which is exactly backwards. Measured at 390x844
 * under 6x CPU throttle: 9,015ms against the 5,785ms the same tree takes
 * unthrottled, and the operator reported the splash "still showing at 11s".
 *
 * The clamp is kept — it is right about the thing it was written for — and a
 * second, UNCLAMPED accumulator of active wall time bounds the whole run
 * instead. A slow device now gets a shorter sequence, not a longer one.
 *
 * 1.35 is derived, not chosen twice: the loop's own measured overhead at 1x
 * (first frame contributes dt 0, and `t >= 1` is tested at frame granularity)
 * is ~230ms on a 5,556ms run — 4% — so 35% is ~8x the ordinary slack. It
 * leaves 24% margin at 1440x900 (5,745 measured against 7,500) and 26% at
 * 390x844 (a predicted 3,563 against 4,500), and it binds at 6x, which is the
 * whole point.
 */
export const WALL_CEIL_FACTOR = 1.35;

/**
 * Progress at `elapsedMs` milliseconds since the decrypt started, clamped to
 * [0, 1]. Pure: reproduces coldboot-splash.html:1516's per-frame accumulation
 * (`S.T = clamp01(S.T + dt/(S.dur/S.spd))`) as a closed form — summing a
 * constant increment every frame for `elapsedMs` worth of frames is
 * mathematically the same clamped ramp as `elapsedMs / EFFECTIVE_MS`, without
 * the frame-by-frame state that would make it depend on call history.
 *
 * `effectiveMs` defaults to the wide stage's `EFFECTIVE_MS`, so every existing
 * call site reads exactly as it did; a narrow stage passes
 * `EFFECTIVE_NARROW_MS`. It is a PARAMETER rather than module state for the
 * same reason nothing else here is: `T(2500)` must return the same float on
 * the first call of a session and the millionth.
 */
export function T(elapsedMs: number, effectiveMs: number = EFFECTIVE_MS): number {
  return clamp01(elapsedMs / effectiveMs);
}
