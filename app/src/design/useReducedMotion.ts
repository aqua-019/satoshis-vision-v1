/**
 * design/useReducedMotion.ts — shared prefers-reduced-motion hook.
 *
 * Every self-hosted SVG chart (markets/charts.tsx, chart-kit.tsx consumers)
 * needs to know whether to skip its mount-fade / crosshair transitions.
 * Was previously copy-pasted locally in markets/charts.tsx; lifted out here
 * so mempool + network chart surfaces can share one implementation instead
 * of drifting. Reactive to live OS-setting changes, SSR-safe.
 */

import * as React from "react";

export function useReducedMotion(): boolean {
  const [r, setR] = React.useState(() =>
    typeof matchMedia !== "undefined" ? matchMedia("(prefers-reduced-motion: reduce)").matches : false,
  );
  React.useEffect(() => {
    if (typeof matchMedia === "undefined") return;
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setR(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return r;
}
