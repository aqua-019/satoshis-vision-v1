// design/useReducedMotion.ts — the canonical prefers-reduced-motion hook.
//
// Promoted from mempool/useRibbonGlide.ts:26-42, which is the SSR-safe
// implementation among the four near-duplicates found in this repo at
// v6.0.2 (the others: mempool/useDragPan.ts, and inline matchMedia checks
// in protocols/metaphors.tsx / protocols/lighthouse.tsx / pages/future/
// FutureMini.tsx / pages/markets/charts.tsx). Those copies are NOT rewired
// to this export yet — that consolidation is a separate pass. New code
// (this file's own siblings included) should import this one.
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
