/**
 * pages/home/useHeroRotation.ts — the rotating-hero state machine.
 *
 * Three non-negotiables (v6.1.8 brief):
 *   - pauses on hover AND focus (pointerenter/focusin → paused; leave/blur → resume)
 *   - no auto-advance under prefers-reduced-motion, and the caller must SAY so
 *   - zero layout shift — this hook owns no layout; the caller reserves it
 *
 * Driven by useAnimationSeconds (design/useAnimationClock.ts), not setInterval,
 * per the brief: a frame/second counter changes meaning per device tier, and
 * the shared rAF loop is already the app's one per-frame heartbeat.
 *
 * ── WHY `baseline` HAS TWO DIFFERENT RESET RULES ───────────────────────────
 * `useAnimationSeconds` hands back CUMULATIVE elapsed seconds since its
 * subscription began, and — because it re-subscribes whenever `enabled` flips
 * — a pause/resume cycle makes that counter start over from ~0 on its own.
 * A same-window advance (the dwell timer firing, or a dot click) does NOT
 * touch `enabled`, so the counter keeps climbing right through it.
 *
 * That means the two reset call sites below are not interchangeable:
 *   - after an ADVANCE (goTo), the new dwell window starts NOW, so baseline
 *     becomes the CURRENT seconds value — resetting it to 0 here would make
 *     `seconds - baseline` immediately clear the dwell threshold again on the
 *     very next tick (a fast rotation bug this file does not ship).
 *   - after a RESUME (paused → false), the hook's own counter is ABOUT to
 *     restart at 0 on its next tick, so baseline anticipates that and resets
 *     to 0 too, rather than to the stale pre-pause value.
 */

import * as React from "react";
import { useAnimationSeconds } from "@/design/useAnimationClock";
import { useReducedMotion } from "@/design/useReducedMotion";
import { HERO_DWELL_MS } from "./passages";

const FADE_MS = 300; // mirrors --d-3

export interface HeroRotationHandlers {
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onFocus: () => void;
  onBlur: (e: React.FocusEvent) => void;
}

export interface HeroRotation {
  index: number;
  /** True for FADE_MS while the headline/lede are mid-crossfade. */
  fading: boolean;
  paused: boolean;
  reduced: boolean;
  /** 0..1 progress toward the next auto-advance. Always 0 under reduced motion. */
  dwellFrac: number;
  goTo: (i: number) => void;
  handlers: HeroRotationHandlers;
}

export function useHeroRotation(count: number): HeroRotation {
  const reduced = useReducedMotion();
  const [index, setIndexState] = React.useState(0);
  const [fading, setFading] = React.useState(false);
  const [hovering, setHovering] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const paused = hovering || focused;

  const indexRef = React.useRef(0);
  React.useEffect(() => {
    indexRef.current = index;
  }, [index]);

  const baseline = React.useRef(0);
  const fadeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const seconds = useAnimationSeconds({ fps: 2, enabled: !reduced && !paused });
  const secondsRef = React.useRef(0);
  React.useEffect(() => {
    secondsRef.current = seconds;
  }, [seconds]);

  const goTo = React.useCallback(
    (next: number) => {
      const n = ((next % count) + count) % count;
      if (n === indexRef.current) return;
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
      const commit = () => {
        setIndexState(n);
        setFading(false);
        baseline.current = secondsRef.current;
      };
      if (reduced) {
        commit();
        return;
      }
      setFading(true);
      fadeTimer.current = setTimeout(commit, FADE_MS);
    },
    [count, reduced],
  );

  React.useEffect(
    () => () => {
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    },
    [],
  );

  // Auto-advance. Guarded on both reduced motion and pause — the brief's
  // "no auto-advance under reduced motion" is enforced HERE, unconditionally,
  // not by zeroing a duration.
  React.useEffect(() => {
    if (reduced || paused) return;
    if (seconds - baseline.current >= HERO_DWELL_MS / 1000) {
      goTo(indexRef.current + 1);
    }
  }, [seconds, reduced, paused, goTo]);

  // Resume: anticipate the hook's own counter restart (see file header).
  React.useEffect(() => {
    if (!paused) baseline.current = 0;
  }, [paused]);

  const dwellFrac = reduced
    ? 0
    : Math.min(1, Math.max(0, (seconds - baseline.current) / (HERO_DWELL_MS / 1000)));

  return {
    index,
    fading,
    paused,
    reduced,
    dwellFrac,
    goTo,
    handlers: {
      onPointerEnter: () => setHovering(true),
      onPointerLeave: () => setHovering(false),
      onFocus: () => setFocused(true),
      onBlur: (e: React.FocusEvent) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false);
      },
    },
  };
}
