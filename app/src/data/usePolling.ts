/**
 * data/usePolling.ts — the single polling primitive the live feed's tiers share.
 *
 * Before v6.0.6 the feed ran ONE `setInterval` at 2.5s firing a `Promise.all`
 * over five endpoints. That polled the 120s-block-target chain data ~48× per
 * block and made every visitor a multiplier on upstream node load. The feed now
 * runs three independent tiers (see `xmrirish-feed.ts`); this is the loop each
 * of them uses.
 *
 * What it adds over a bare `setInterval`:
 *
 *   • `setTimeout` rescheduling, not `setInterval` — a slow response delays the
 *     next tick instead of stacking overlapping requests on a struggling node.
 *   • Visibility pausing — a hidden tab does no network work at all, and
 *     un-hiding fires an immediate catch-up tick rather than waiting out the
 *     remainder of the interval.
 *   • Failure backoff — consecutive failures double the delay up to a cap, so a
 *     dead upstream is probed occasionally instead of hammered. Backoff never
 *     shortens a tier below its own cadence.
 *
 * The three hand-rolled poll loops that predate this (`useMarketHistory`,
 * `useTickers`, `mempool/live-detail`) are deliberately left alone — they have
 * their own retry semantics and are not on the chain-data path.
 */

import * as React from "react";

export type TierName = "fast" | "chain" | "market";

/**
 * Default cadence per tier, in ms.
 *
 *  • fast   — mempool + fee estimate. Measurably changes at this rate.
 *  • chain  — tip watch. The block target is 120s, so 15s catches a new block
 *             within ~12% of a block while costing 4 calls/min, not 24.
 *  • market — CoinGecko. Rate-limited upstream; unchanged from prior behaviour.
 */
export const TIER_MS: Record<TierName, number> = {
  fast: 3_000,
  chain: 15_000,
  market: 60_000,
};

/** Ceiling for failure backoff. A struggling node is retried at most this slowly. */
export const BACKOFF_CAP_MS = 10_000;

declare global {
  interface Window {
    /** TEST-ONLY cadence override, read once per scheduled tick. Playwright gates
     *  set this via `addInitScript` before app boot so a chain-tier assertion
     *  doesn't have to wait a real 15s. Never set in production code. */
    __XMR_TIER_MS__?: Partial<Record<TierName, number>>;
  }
}

/** A tier's effective interval, honouring the test-only override. */
export function tierMs(tier: TierName): number {
  const override = typeof window !== "undefined" ? window.__XMR_TIER_MS__ : undefined;
  const v = override?.[tier];
  return typeof v === "number" && v > 0 ? v : TIER_MS[tier];
}

/**
 * Delay before the next tick after `failures` consecutive failures.
 *
 * Doubles per failure up to BACKOFF_CAP_MS, but never returns less than the
 * tier's own interval — otherwise the 60s market tier would "back off" to 10s
 * and poll a rate-limited upstream *faster* while it was failing.
 *
 * Exported for the offline gate (`verify-tiers.mjs`) — pure, no React.
 */
export function backoffMs(base: number, failures: number): number {
  if (failures <= 0) return base;
  return Math.max(base, Math.min(BACKOFF_CAP_MS, base * 2 ** failures));
}

const isHidden = (): boolean =>
  typeof document !== "undefined" && document.visibilityState === "hidden";

/**
 * Run `task` on `tier`'s cadence for the lifetime of the component.
 *
 * `task` resolves `true` on success and `false` on failure; the boolean drives
 * backoff only — reporting the failure to the UI is the caller's job (the feed
 * keeps last-good values and raises `stale`). A thrown error counts as failure.
 *
 * `task` is read through a ref, so callers may pass a fresh closure each render
 * without restarting the loop.
 */
export function usePolling(
  tier: TierName,
  task: () => Promise<boolean>,
  enabled = true,
): void {
  const taskRef = React.useRef(task);
  taskRef.current = task;

  React.useEffect(() => {
    if (!enabled) return;

    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let running = false;
    let failures = 0;

    const clear = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const run = async (): Promise<void> => {
      // Re-entrancy guard: a tick already in flight owns the next schedule.
      if (!alive || running) return;
      // A hidden tab does nothing; `onVisibility` fires the catch-up tick.
      if (isHidden()) {
        clear();
        return;
      }
      running = true;
      let succeeded = false;
      try {
        succeeded = await taskRef.current();
      } catch {
        succeeded = false;
      }
      running = false;
      if (!alive) return;
      failures = succeeded ? 0 : failures + 1;
      // Don't re-arm if the tab went hidden while the request was in flight.
      if (!isHidden()) {
        clear();
        timer = setTimeout(() => void run(), backoffMs(tierMs(tier), failures));
      }
    };

    const onVisibility = () => {
      if (!alive) return;
      if (isHidden()) clear();
      else void run(); // resume: immediate catch-up, then re-arm
    };

    document.addEventListener("visibilitychange", onVisibility);
    void run();

    return () => {
      alive = false;
      clear();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [tier, enabled]);
}
