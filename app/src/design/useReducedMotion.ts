// design/useReducedMotion.ts — the canonical prefers-reduced-motion hook.
//
// Promoted from mempool/useRibbonGlide.ts:26-42, which was the SSR-safe
// implementation among the four near-duplicates this repo carried at v6.0.2
// (the others: mempool/useDragPan.ts, and inline matchMedia checks in
// protocols/metaphors.tsx / protocols/lighthouse.tsx / pages/future/
// FutureMini.tsx / pages/markets/charts.tsx).
//
// v6.1.3: that consolidation is DONE — every one of those call sites now
// reads through this hook, and verify-chartkit.mjs gates against ad-hoc
// `matchMedia("(prefers-reduced-motion: reduce)")` reads reappearing (see
// protocols/cuprate.tsx:84). The only remaining direct reads are deliberate
// and non-reactive: design/deviceTier.ts:59-65, which needs a one-shot value
// before React exists, and index.html's pre-paint tier stamp. New code should
// import this one.
//
// NOTE for motion work: this hook is the CONSUMER's responsibility. Neither
// useAnimationClock nor useAnimationSeconds checks reduced motion internally
// (unlike useTick, which freezes itself) — a call site must pass
// `enabled: !reduced`. See mempool/constellation.tsx:68 for the correct shape.
//
// SSR-safe: the lazy useState initializer guards `window`/`matchMedia`
// so evaluating this module before either exists (or in an environment
// that never defines them) doesn't throw — it just resolves to `false`
// (motion on) until the effect can confirm otherwise client-side.

import * as React from "react";

export function useReducedMotion(): boolean {
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
