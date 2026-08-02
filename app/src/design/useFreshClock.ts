/**
 * design/useFreshClock.ts — D0859. ONE wall clock, for "how old is this number".
 *
 * Per-panel timestamps need a value that changes once a second so a rendered age
 * keeps counting up. Three existing mechanisms were considered and each is wrong
 * for this specific job:
 *
 *   · `useTick` (ArtBackground.tsx) has exactly the right semantics — it pauses
 *     while hidden and can opt out of the reduced-motion freeze — but it arms one
 *     `setInterval` PER CALL SITE. v6.0.8 measured 21 of those as "the app's timer
 *     storm" and spent a release killing it. 32 panels would rebuild it.
 *   · `useAnimationSeconds` (useAnimationClock.ts) EXCLUDES time spent with the
 *     tab hidden, by design and by its own docblock. Age is wall time: a tab
 *     backgrounded for five minutes would come back under-reporting by five
 *     minutes. A clock that lies is worse than no clock.
 *   · `agoStr` (useCachedFeed.ts) floors at whole minutes, so everything under a
 *     minute old reads "0m ago".
 *
 * So: one module-scope interval for the whole document, fanned out to subscribers.
 * Cost is O(1) timers regardless of how many panels are mounted.
 *
 * ── WHY THIS IGNORES prefers-reduced-motion ───────────────────────────────
 * Deliberately, and it is the one place in this repo where that is correct. An
 * elapsed age is INFORMATION, not decoration — the number a reader needs during
 * an outage is precisely how long it has been. v6.1.3 recorded the inverse trap
 * (`useTick` freezes to a literal 0 under reduce, so three simulators froze on
 * their "before" frame and the still frame became a false content claim). Same
 * lesson, opposite direction: freezing an age at "0s" while the endpoint has
 * been dead for an hour is a fabricated reading, and this site does not
 * fabricate. Stopping the *blink* on the stale suffix is the reduced-motion
 * obligation; stopping the *counter* would lose information.
 *
 * This module therefore names neither `prefers-reduced-motion` nor
 * `getDeviceTier`, and verify-provenance.mjs asserts that it never learns to.
 *
 * ── SSR ───────────────────────────────────────────────────────────────────
 * `renderToString` runs all 11 routes in bare Node with no window and no
 * effects. Nothing here touches a timer at module-evaluation time, and the hook
 * early-returns without subscribing when `window` is absent — so the prerendered
 * HTML carries the "never answered" rendering and hydration takes it from there.
 */

import * as React from "react";
import { isPageActive, onPageActiveChange } from "./usePageActive";

type Sub = () => void;

const subs = new Set<Sub>();
let timer: ReturnType<typeof setInterval> | null = null;
let unbind: (() => void) | null = null;

/** One second. Finer would re-render 32 panels for no legible gain; coarser
 *  makes the first few seconds after a refresh visibly wrong. */
const TICK_MS = 1000;

function fire() {
  for (const fn of subs) fn();
}

function start() {
  if (timer !== null) return;
  timer = setInterval(fire, TICK_MS);
}

function stop() {
  if (timer === null) return;
  clearInterval(timer);
  timer = null;
}

/** Visibility is handled once, here, rather than in each subscriber. On return
 *  from a hidden tab the ages are stale by however long the tab was away, so
 *  fire immediately BEFORE restarting the interval — otherwise the first
 *  painted frame shows the pre-hide age for up to a second. */
function bind() {
  if (unbind) return;
  unbind = onPageActiveChange((active) => {
    if (!active) { stop(); return; }
    fire();
    start();
  });
}

/**
 * Subscribe to the shared clock. Returns a counter that increments once a
 * second; callers ignore the value and simply re-read `Date.now()`.
 */
export function useFreshSecond(): number {
  const [n, setN] = React.useState(0);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const bump = () => setN((x) => x + 1);
    subs.add(bump);
    bind();
    if (isPageActive()) start();
    return () => {
      subs.delete(bump);
      if (subs.size === 0) {
        stop();
        unbind?.();
        unbind = null;
      }
    };
  }, []);

  return n;
}

/**
 * Compact age. Bounded to 3 characters plus a unit so `.panel-updated`'s
 * reserved width cannot be overrun: "9s", "59s", "12m", "3h", "27h".
 *
 * Caps at hours on purpose. A panel whose endpoint last answered days ago is
 * not usefully distinguished from one that answered many hours ago, and the
 * exact instant is in the `title` for anyone who needs it.
 */
export function fmtAge(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 90) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}
