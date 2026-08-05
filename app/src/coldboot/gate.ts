/**
 * coldboot/gate.ts — the ONE definition of "does this load open on the cold
 * boot", plus the two constants the pre-paint path needs.
 *
 * ── WHY THIS FILE EXISTS ──────────────────────────────────────────────────
 * `index.html` has to answer "will the splash run?" BEFORE the bundle arrives —
 * that is the whole point of the anti-flash floor — and an inline pre-paint
 * script cannot import anything. So the predicate is necessarily encoded twice,
 * in two languages. That is the `NODE_REASONS` shape this repo has been bitten
 * by: two copies of a rule, kept in step by nothing, where the next edit to the
 * gating condition silently fixes one path and not the other.
 *
 * The resolution is not to avoid the duplication (impossible) but to make the
 * two copies PROVABLY equal: `ColdBoot.tsx#computeInitial` calls
 * `coldBootWillRender` below, `index.html` carries a marked copy of the same
 * two clauses, and `verify-cbpending.mjs` extracts that copy, evaluates BOTH
 * over a truth table of every (flag, pathname) pair it cares about, and fails
 * the build on a single disagreement. An equivalence proof, not a string match.
 *
 * ── THE CLAUSE THAT IS NOT HERE, AND WHY ─────────────────────────────────
 * There is no sessionStorage term. `xmrirish.coldboot` gates `skipDecrypt` —
 * whether a repeat visitor watches the 5.56s decrypt or lands straight on the
 * console — and NOT whether the splash renders at all. A repeat visit still
 * gets the console and still needs ENTER, which is exactly what
 * `verify-coldboot` §3 asserts in both directions. Including it here would
 * leave the prerendered Main Home flashing on every visit after the first,
 * which is the majority of visits.
 *
 * This module must stay importable by a plain `node` process running with type
 * stripping: no React, no `@/` alias, nothing beyond `scripts/routes.mjs`.
 * `verify-cbpending.mjs` imports it directly, and CI already relies on that
 * idiom for other gates.
 */

import { R } from "../../scripts/routes.mjs";

/** The window global the gates use to switch the whole feature off. */
export const COLDBOOT_FLAG = "__XMR_COLDBOOT__";

/** The value of that global which means "do not render the splash". */
export const COLDBOOT_OFF = "off";

/** Class stamped on `<html>` by the pre-paint script while the splash is
 *  pending, and removed by whichever of the three removers gets there first
 *  (ColdBoot on mount, the boot watchdog, main.tsx's boot failure path). */
export const CB_PENDING_CLASS = "cb-pending";

/**
 * Frame zero's colour. Deliberately NOT the per-theme `--amb-floor`
 * (#050505 classic / #121218 indigo / #030603 phosphor) that `index.html`'s
 * critical block paints on `<html>`.
 *
 * `ColdBoot.tsx#ROOT_STYLE` paints the splash stage at a hard, theme-
 * independent `#050505`. If the pre-paint floor used the theme colour instead,
 * an indigo or phosphor visitor would get #121218 or #030603 for frame zero and
 * #050505 for frame one — a colour step exactly where this change exists to
 * remove one. Matching the splash is the requirement; matching the theme is not.
 */
export const CB_FLOOR = "#050505";

/**
 * How long frame zero holds, in ms — a MINIMUM, never an addition.
 *
 * Without it the floor ends whenever React mounts, which on a warm cache is
 * ~212-1017ms (measured, unthrottled) and gives no deliberate black beat at
 * all. ColdBoot waits `max(0, CB_HOLD_MS - elapsed)`, so a bundle that already
 * took longer than this starts the sequence immediately and nothing is ever
 * added on top: measured under 6x CPU + Slow-4G, a cold `/` reaches LCP at
 * ~4048ms, where this contributes exactly 0.
 *
 * The cost lands only on fast loads. Re-measured on a real cold `/` with the
 * splash ON, unthrottled, three runs at the value below: LCP 932/948/956ms
 * against 164/216ms with the splash bypassed. Real, and under the 2500ms budget
 * for `/`.
 *
 * Note what those numbers are NOT: the post-hold LCP is not this constant. The
 * floor lifts at `max(hold, mount)` — measured 766/901/917ms against a declared
 * 750, so the mount is sometimes the binding term — and LCP lands a little after
 * the lift. Any gate asserting `stated LCP === CB_HOLD_MS` would be green only
 * while this sentence was false, so there is deliberately no such gate; the
 * runtime lower bound in verify-coldboot-live §1c is the assertion that matters.
 *
 * NOTHING IN THE SUITE MEASURES THE NUMBER ABOVE. verify-vitals watches `/`'s
 * LCP through `coldBootOffBrowser`, i.e. the 164-216ms column, so halving this
 * constant does not move the budget it guards by a single millisecond. That gap
 * is recorded rather than closed here.
 *
 * REDUCED MOTION STILL HOLDS. This is a static frame, not motion — nothing
 * moves, nothing animates, and a visitor who asked for less motion has not
 * asked for less deliberate pacing. The `skipDecrypt` path (revisit OR reduced
 * motion) waits the same beat and then shows the console directly.
 */
export const CB_HOLD_MS = 750;

/** Set by index.html's pre-paint script at the instant the floor goes up, so
 *  the hold is measured from FIRST PAINT rather than from React mounting. */
export const CB_T0_GLOBAL = "__xmriCbT0";

/** Test override for the hold, mirroring `__xmriBootTimeoutMs`. One token in
 *  prod; it lets a gate drive the hold to 0 instead of sleeping the full hold
 *  in every scenario that touches the splash. */
export const CB_HOLD_GLOBAL = "__xmriCbHoldMs";

/**
 * Will this load render the cold-boot splash?
 *
 * Two clauses, and both are load-bearing. `flag` is `window[COLDBOOT_FLAG]`,
 * which the verification harness sets to `"off"` via `addInitScript` — that runs
 * before any page script, so the pre-paint copy of this predicate sees it too.
 * `pathname` is `location.pathname`; the splash is a Home-only surface.
 */
export function coldBootWillRender(flag: string | undefined, pathname: string): boolean {
  if (flag === COLDBOOT_OFF) return false;
  return pathname === R.HOME;
}
