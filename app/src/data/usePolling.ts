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
 *   • A per-tick abort budget (v6.0.7) — `fetch` has no default timeout, and
 *     the re-entrancy guard means a request that never settles would hold
 *     `running` true forever and silently kill its tier for the rest of the
 *     session. Each tick gets an AbortSignal, aborted on timeout and on
 *     unmount. This matters most over Tor, where circuits do occasionally
 *     just stop answering.
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

/**
 * How long one tick may take before it is abandoned (v6.0.7).
 *
 * The re-entrancy guard below means a tick already in flight owns the next
 * schedule — which is what stops requests stacking, but also means a request
 * that NEVER settles wedges its tier permanently: `running` stays true, no
 * timer is ever re-armed, and the tier goes silent for the rest of the session
 * with nothing in the console. `fetch` has no default timeout, so on Tor
 * (2-10s RTT, circuits that occasionally just die) that is a live risk rather
 * than a theoretical one.
 *
 * 20s is deliberately well above a slow-but-working Tor round trip: this is a
 * backstop against a hung socket, not a latency policy. The cadence and
 * backoff above are what actually pace the tiers.
 */
export const TICK_TIMEOUT_MS = 20_000;

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
  task: (signal: AbortSignal) => Promise<boolean>,
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
    /** The controller for the tick currently on the wire, so teardown can cancel it. */
    let inFlight: AbortController | null = null;

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
      // Race the task against TICK_TIMEOUT_MS so a socket that never settles
      // can't hold `running` true forever and silently kill this tier, AND
      // abort the request itself so we don't leak an open circuit per timeout.
      // The timeout resolves false, which counts as a failure and so feeds
      // backoff — a wedged upstream gets probed slowly, not abandoned.
      const ctrl = new AbortController();
      inFlight = ctrl;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      try {
        succeeded = await Promise.race([
          taskRef.current(ctrl.signal),
          new Promise<boolean>((resolve) => {
            timeoutId = setTimeout(() => {
              ctrl.abort();
              resolve(false);
            }, TICK_TIMEOUT_MS);
          }),
        ]);
      } catch {
        succeeded = false;
      } finally {
        if (timeoutId !== null) clearTimeout(timeoutId);
        if (inFlight === ctrl) inFlight = null;
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
      // Cancel a round still on the wire. Without this an unmount left the
      // request running to completion — on Tor, another 10s of pointless
      // circuit traffic per navigation.
      inFlight?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [tier, enabled]);
}
