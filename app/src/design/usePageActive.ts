/**
 * design/usePageActive.ts — "is this worth drawing right now?"
 *
 * Before v6.0.8 the app had exactly one visibility check in it
 * (pages/future/FutureMini.tsx, inside a modal — the cheapest surface there
 * is). Every other loop — the always-mounted ParticleField canvas, the 21
 * useTick intervals, the bridge radar's 60fps rAF, the 2.5s chain poll — ran
 * at full rate in a backgrounded tab and on a locked phone. This module is
 * the shared answer.
 *
 * Two axes, because they answer different questions:
 *
 *   page-active     document.visibilityState — is the tab in front?
 *   element-active  IntersectionObserver — is this box on screen?
 *
 * Both matter. A phone shows one view at a time, so page-visibility catches
 * the lock-screen case and intersection catches the scrolled-past case. The
 * element axis also fixes a standing bug: /simulate nests two `.art`
 * elements and styles-legibility.css:93-95 hides the inner canvas with
 * `display: none`, but its rAF loop kept running and drawing into a 0×0
 * surface. A `display: none` element reports zero intersection, so the loop
 * now stops.
 *
 * The subscription primitive (`onPageActiveChange`) exists because the loops
 * that matter most must NOT re-render to learn the page went away — an rAF
 * driver reads it inside its own effect and never touches React state.
 */

import * as React from "react";

type Listener = (active: boolean) => void;

const listeners = new Set<Listener>();
let bound = false;

function readPageActive(): boolean {
  if (typeof document === "undefined") return true;
  return document.visibilityState !== "hidden";
}

function handleVisibility(): void {
  const active = readPageActive();
  // Copy before iterating: a listener that unsubscribes itself on the first
  // hide (the rAF drivers do exactly that) would otherwise mutate the live set.
  for (const fn of [...listeners]) fn(active);
}

function bind(): void {
  if (bound || typeof document === "undefined") return;
  document.addEventListener("visibilitychange", handleVisibility);
  bound = true;
}

/**
 * Subscribe to tab visibility without rendering. Fires only on change, never
 * on subscribe — read `isPageActive()` for the current value first. Returns
 * an unsubscribe function.
 */
export function onPageActiveChange(fn: Listener): () => void {
  bind();
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Current tab visibility. Safe before mount and in non-DOM hosts. */
export function isPageActive(): boolean {
  return readPageActive();
}

/**
 * Reactive tab visibility, for the cases that genuinely need a re-render
 * (a paused badge, a poller that lives in React state). Loops should prefer
 * `onPageActiveChange` — re-rendering to discover you should stop drawing is
 * self-defeating.
 */
export function usePageActive(): boolean {
  const [active, setActive] = React.useState(readPageActive);
  React.useEffect(() => {
    setActive(readPageActive());
    return onPageActiveChange(setActive);
  }, []);
  return active;
}

/**
 * Is the referenced element on screen? Starts `false` and flips on the
 * observer's first callback, which fires synchronously-ish after observe().
 *
 * `IntersectionObserver` is absent in no browser this app targets (Safari 12.1+,
 * Firefox 55+, Tor Browser's ESR base), but if it ever is, the fallback is
 * "always active" — degrade to today's behaviour, never to a blank canvas.
 */
export function useElementActive(
  ref: React.RefObject<Element | null>,
  rootMargin = "0px",
): boolean {
  const [active, setActive] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setActive(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) setActive(e.isIntersecting);
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin]);

  return active;
}

/**
 * The combined answer, for rAF drivers: calls `onChange` whenever
 * "tab visible AND element on screen" flips, without rendering.
 *
 * Returns a teardown. The initial state is pushed once on setup so a caller
 * can use this as its sole source of truth.
 */
export function observeDrawable(
  el: Element,
  onChange: (drawable: boolean) => void,
): () => void {
  let pageActive = readPageActive();
  let elementActive = typeof IntersectionObserver === "undefined";
  let last: boolean | null = null;

  const push = () => {
    const next = pageActive && elementActive;
    if (next === last) return;
    last = next;
    onChange(next);
  };

  const offPage = onPageActiveChange((a) => {
    pageActive = a;
    push();
  });

  let io: IntersectionObserver | null = null;
  if (typeof IntersectionObserver !== "undefined") {
    io = new IntersectionObserver((entries) => {
      for (const e of entries) elementActive = e.isIntersecting;
      push();
    });
    io.observe(el);
  }

  push();

  return () => {
    offPage();
    io?.disconnect();
  };
}
