// mempool/useRibbonGlide.ts — FLIP glide for a row of keyed block tiles.
//
// When the chain advances, the Classic / Reactor block ribbons re-render with
// blocks shifted one slot. Without help the DOM jumps. This hook applies the
// FLIP technique (First / Last / Invert / Play): it remembers each keyed
// child's screen position from the previous commit (FIRST), reads the new
// position after layout (LAST), instantly offsets each child back to where it
// was (INVERT, transition:none), then on the next frame releases it (PLAY) so
// the element's CSS `transition: transform` (the `.glide-block` class) carries
// it smoothly to its new resting spot.
//
// Usage: attach the returned ref to the flex-row container, give each animated
// child a `data-glide-key={height}` attribute AND a stable React `key={height}`
// (so React reuses the DOM node across ticks — a FLIP prerequisite). Children
// without `data-glide-key` (e.g. queued placeholders whose heights shift every
// tick) are ignored. Pass `chainTip(data)` (the newest confirmed block height,
// data.blocks[0].height — the exact value the ribbon renders from) as the dep so
// a glide is scheduled precisely when the rendered block list shifts, NOT on
// every get_info `data.height` tick (which polls separately and would fire the
// glide against an unchanged DOM, or miss a real block entirely).
//
// Honors prefers-reduced-motion (instant snap, no animation).

import * as React from "react";

function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = React.useState(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduce(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduce;
}

export function useRibbonGlide(depKey: unknown) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const prev = React.useRef<Map<string, DOMRect>>(new Map());
  const raf = React.useRef<number | null>(null);
  const reduce = usePrefersReducedMotion();

  React.useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;

    const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-glide-key]"));
    const last = new Map<string, DOMRect>();
    for (const el of nodes) {
      const k = el.dataset.glideKey;
      if (k != null) last.set(k, el.getBoundingClientRect());
    }

    // Reduced motion, or the very first commit (no prior frame to compare):
    // record positions and snap — no glide.
    if (reduce || prev.current.size === 0) {
      prev.current = last;
      return;
    }

    let animatedAny = false;
    const entering: HTMLElement[] = [];
    for (const el of nodes) {
      const k = el.dataset.glideKey;
      if (k == null) continue;
      const first = prev.current.get(k);
      const now = last.get(k);
      if (!now) continue;
      if (!first) { entering.push(el); continue; } // newly added → slide/fade in from the head
      const dx = first.left - now.left;
      if (dx === 0) continue;
      // INVERT — kill the transition and offset back to the old position.
      el.style.transition = "none";
      el.style.transform = `translateX(${dx}px)`;
      animatedAny = true;
    }

    prev.current = last;

    // Incoming head block(s): glide/fade in from the head rather than popping.
    // useLayoutEffect runs before paint, so the keyframe starts from its `from`
    // state on the first frame. The class is removed on animationend so the next
    // tip can re-trigger it. (Skipped under reduced motion via the early return.)
    for (const el of entering) {
      el.classList.add("glide-enter");
      const clear = () => { el.classList.remove("glide-enter"); el.removeEventListener("animationend", clear); };
      el.addEventListener("animationend", clear);
    }

    if (!animatedAny) return;

    // PLAY — double rAF guarantees the browser paints the inverted positions
    // before we clear them, so the transition actually runs (a single rAF can
    // be coalesced with the synchronous invert into one paint and skip it).
    if (raf.current != null) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      raf.current = requestAnimationFrame(() => {
        for (const el of nodes) {
          if (el.style.transform === "") continue;
          el.style.transition = ""; // hand control to the .glide-block CSS transition
          el.style.transform = ""; // animate to rest
        }
        raf.current = null;
      });
    });
  }, [depKey, reduce]);

  React.useEffect(
    () => () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    },
    [],
  );

  return ref;
}
