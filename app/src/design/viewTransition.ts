/**
 * design/viewTransition.ts — the ONLY module in this app that branches on
 * View Transition API support. Every consumer — useViewTransitionNavigate,
 * VisualContext's setTheme, FuturePage's card→modal morph — calls `startVt()`
 * and nothing else; no other file ever touches `document.startViewTransition`
 * or reads/writes the `data-vt`/`data-vt-dir` attributes directly.
 *
 * Why this matters here specifically: Tor Browser is Firefox ESR, and
 * Firefox shipped view transitions in 144. This site's primary audience will
 * NOT take the "supported" path — the feature-detected fallback below is the
 * MAIN path this app runs, not an edge case, which is why it lives in one
 * function or state check rather than sprinkled through every caller.
 *
 * Corrected premise, verified against this repo's actual pinned toolchain —
 * report back if this drifts: the handoff brief that produced this file
 * claimed "TS 5.5's lib.dom has no ViewTransition types — a global
 * augmentation is required." `app/package.json` pins `typescript: ^5.5.3`,
 * but `package-lock.json` resolves and installs `5.9.3` (confirmed via
 * `node_modules/typescript/lib/lib.dom.d.ts`), which already ships full
 * `ViewTransition` / `Document.startViewTransition` / `StartViewTransitionOptions`
 * ambient types — so lib.dom is not the problem. A DIFFERENT, real conflict
 * is: `react-router-dom` (already imported throughout this app) ships its
 * OWN `declare global { interface Document { startViewTransition(cb: () =>
 * Promise<void> | void): ViewTransition } }` in `dist/index.d.ts` (its
 * `unstable_useViewTransitionState`/`<Link unstable_viewTransition>` support
 * predates the browser API landing in lib.dom), with a same-named but
 * narrower LOCAL `ViewTransition` — missing `types` — that its own
 * `declare global` block resolves against instead of lib.dom's. Once any
 * file imports react-router-dom (every route does), TypeScript merges that
 * overload onto the global `Document`, and `document.startViewTransition()`
 * calls resolve to react-router-dom's narrower return shape here, not
 * lib.dom's. Rather than fight TS's overload-resolution order with a cast
 * that would silently break if a future version changes which one wins,
 * `VtHandle` below is a narrow LOCAL structural type — same idea as
 * `design/deviceTier.ts`'s `PerfNavigator` — covering only the two members
 * this module actually uses. Either library's real return value satisfies
 * it by duck typing, so which one TS's overload resolution happens to pick
 * stops mattering. The runtime feature check below (`typeof
 * document.startViewTransition === "function"`) is still required
 * regardless of any of this — Firefox < 144 and every other unsupporting
 * engine genuinely lack the method at runtime.
 */

import { getDeviceTier } from "./deviceTier";
import { isPageActive } from "./usePageActive";

/** The subset of a real ViewTransition this module uses. See the header for
 *  why this is a local shape rather than the ambient `ViewTransition`. */
interface VtHandle {
  readonly finished: Promise<void>;
  skipTransition(): void;
}

let current: VtHandle | null = null;

/**
 * Is this page, right now, a place a view transition is worth running?
 * Deliberately does NOT consult `prefers-reduced-motion` — reduced motion
 * changes the ANIMATION a transition plays, not whether one runs at all.
 * That distinction lives entirely in styles-motion.css (see its header):
 * a transition still fires under reduce, it just loses its spatial movement
 * and settles for the platform's default crossfade at a shorter duration.
 */
export function vtSupported(): boolean {
  return (
    typeof document !== "undefined" &&
    typeof document.startViewTransition === "function" &&
    getDeviceTier() !== "low" &&
    isPageActive()
  );
}

function clearFlags(html: HTMLElement): void {
  html.removeAttribute("data-vt");
  html.removeAttribute("data-vt-dir");
}

/**
 * Run `update` — a synchronous DOM mutation; callers wrap their own state
 * commit in `flushSync` so the "new" snapshot the browser captures is the
 * real post-update page, never a mid-render frame — inside a view transition
 * when the platform and this device can afford one, or plainly otherwise.
 * This `if` is the entire degradation story for the whole app.
 *
 * `kind` and `dir` are stamped onto `<html>` as `data-vt`/`data-vt-dir`
 * BEFORE the transition starts, not inside the callback: the browser's "old"
 * snapshot pseudo-elements are constructed synchronously at the moment
 * `document.startViewTransition()` is called, and the attributes stay live
 * on `<html>` (a real DOM node, unaffected by what the callback does) for
 * the "new" snapshot too — that persistence is what lets
 * `html[data-vt="route"][data-vt-dir="fwd"]::view-transition-old(root)` in
 * styles-motion.css select correctly for both halves of one transition.
 *
 * Returns a promise that settles once the transition (real or skipped) is
 * done — NOT `Promise<void>` that can reject; the internal `.catch()` below
 * absorbs a thrown/skipped transition so every caller gets one uniform
 * "it's over" signal. The fallback path (no transition ran at all) resolves
 * immediately, so a caller needing post-transition cleanup — FuturePage's
 * shared-element morph clears its `view-transition-name` this way — never
 * needs a second branch for "there was no transition to wait on".
 */
export function startVt(kind: string, dir: string | undefined, update: () => void): Promise<void> {
  if (!vtSupported()) {
    update();
    return Promise.resolve();
  }

  // A transition already in flight loses: skip its animation (its callback
  // already ran and committed, so the DOM it produced stands as-is) and let
  // this newer call own the flags from here.
  current?.skipTransition();

  const html = document.documentElement;
  html.setAttribute("data-vt", kind);
  if (dir) html.setAttribute("data-vt-dir", dir);
  else html.removeAttribute("data-vt-dir");

  const transition = document.startViewTransition(update);
  current = transition;

  return transition.finished
    .catch(() => {
      /* A transition can be skipped or interrupted (skipTransition() above,
         or the platform aborting it); `update()` already ran regardless, so
         there is nothing to recover — just let settlement continue. */
    })
    .finally(() => {
      // A newer transition may have started — and already cleared/re-set the
      // flags itself — while this one was still settling. Only clear if this
      // transition still owns them.
      if (current === transition) {
        clearFlags(html);
        current = null;
      }
    });
}
