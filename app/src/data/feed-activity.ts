/**
 * feed-activity.ts — is a refresh in flight, and when is the next one?
 *
 * ── WHY THIS IS NOT A FIFTH `FeedPhase` ────────────────────────────────────
 *
 * The obvious move is to add "refreshing" to `FeedPhase`. It is wrong, for
 * reasons worth writing down because the next person will reach for it too:
 *
 *  1. `useMarketHistory.ts`'s `groupStatus` is an if-chain ending
 *     `return "loading"`. A fifth member falls into that catch-all and produces
 *     ZERO compiler output — the repo's one known-unguarded phase site, and it
 *     sits on Markets, which is exactly the surface this feature serves.
 *  2. `deriveStatus` is a pure function of `FeedObs = {okAt, fails, reason}`.
 *     In-flight is not derivable from those — it is not a fact about a
 *     *response*. Expressing it as a phase would mean STORING it, which
 *     reintroduces the stored-derived-state defect D1624 removed.
 *  3. `feed-status.ts`'s header claims "phase is a pure function of the 2 x 2
 *     ... There is no fifth state to forget." A fifth member makes that false.
 *  4. The axes genuinely cross. live+refreshing, live+waiting, stale+refreshing
 *     and stale+waiting are all real states. A flat enum needs eight members to
 *     say what four phases and one boolean say.
 *  5. `ChromeState = "offline" | FeedPhase` would widen too, forcing a
 *     `CHROME_LABEL` entry and a `chromeDetail` arm for something that is not a
 *     chrome state at all — offline outranks it, stale outranks it.
 *
 * So: an ORTHOGONAL axis, in its own module, and `feed-status.ts` is not
 * touched by a single byte. `verify-feedstatus.mjs`, `verify-tiers.mjs` and
 * `verify-stale.mjs` all keep passing unmodified.
 *
 * ── WHY AN EXTERNAL STORE RATHER THAN CONTEXT ──────────────────────────────
 *
 * `MoneroLive` is read by a dozen Context consumers and prop-drilled to ~29
 * more. Putting a boolean that flips twice per 3s tier onto it would re-render
 * that whole tree ~40 times a minute, on /mempool, which is the route whose
 * framerate is measured. `useSyncExternalStore` means only the components that
 * ASK to know are re-rendered — the same argument `design/useOnline.ts` makes.
 *
 * NOTHING may mirror this onto `MoneroLive`. verify-resilience.mjs asserts that.
 *
 * ── THE THREE STATES, AND WHY THE THIRD IS THE POINT ───────────────────────
 *
 *   busy                     -> a request is on the wire now
 *   !busy && nextAt > 0      -> nothing in flight, next attempt at nextAt
 *   !busy && nextAt === 0    -> nothing in flight and nothing scheduled
 *
 * The third state was previously unrepresentable, and it is the honest one for
 * a hidden tab or a torn-down tier. Before this, such a panel showed
 * "STALE · reconnecting" while nothing whatsoever was reconnecting. A feed that
 * never writes here reports {busy:false, nextAt:0} and renders exactly today's
 * UI, so this is additive for any host that ignores it.
 */

import * as React from "react";
import type { FeedKey } from "./feed-status";

export interface FeedActivity {
  /** A request for this endpoint is on the wire right now. */
  readonly busy: boolean;
  /** ms epoch of the next scheduled attempt; 0 = nothing scheduled or unknown. */
  readonly nextAt: number;
}

const IDLE: FeedActivity = Object.freeze({ busy: false, nextAt: 0 });

/** Per-key state. Absent key = IDLE, so a feed that never writes costs nothing. */
const state = new Map<FeedKey, FeedActivity>();
const listeners = new Set<() => void>();

const emit = (): void => {
  for (const l of listeners) l();
};

/**
 * Record activity for a set of endpoints. Called by the feed's polling tiers,
 * which are the only things that know which keys a tier owns.
 *
 * A tier reports for the keys it OWNS, which is not the same as the keys
 * currently on the wire — the chain tier only pulls /network and /blocks when
 * the tip moved. So the honest copy for a busy chain tier is "checking", never
 * a specific URL.
 */
export function setFeedActivity(keys: readonly FeedKey[], a: FeedActivity): void {
  let changed = false;
  for (const k of keys) {
    const prev = state.get(k) ?? IDLE;
    if (prev.busy !== a.busy || prev.nextAt !== a.nextAt) {
      state.set(k, { busy: a.busy, nextAt: a.nextAt });
      changed = true;
    }
  }
  // Only wake subscribers on a real transition. getSnapshot below must be
  // referentially stable between notifications or React loops forever.
  if (changed) emit();
}

/** TEST/RESET — drop all recorded activity. Not used by the app. */
export function _resetFeedActivity(): void {
  state.clear();
  emit();
}

const subscribe = (cb: () => void): (() => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

/**
 * Worst-of across `keys`: busy if ANY is busy, and the SOONEST non-zero
 * nextAt — matching how a multi-key panel already resolves freshness
 * (`oldestFreshAt` / `NodeProvenance`'s worst-of).
 *
 * The returned object is cached against the values it was built from, because
 * `useSyncExternalStore` compares snapshots by identity and a fresh object per
 * call is an infinite render loop.
 */
let cacheKey = "";
let cacheVal: FeedActivity = IDLE;

function snapshotFor(keys: readonly FeedKey[]): FeedActivity {
  let busy = false;
  let nextAt = 0;
  for (const k of keys) {
    const a = state.get(k);
    if (!a) continue;
    if (a.busy) busy = true;
    if (a.nextAt > 0 && (nextAt === 0 || a.nextAt < nextAt)) nextAt = a.nextAt;
  }
  const key = `${keys.join(",")}|${busy ? 1 : 0}|${nextAt}`;
  if (key !== cacheKey) {
    cacheKey = key;
    cacheVal = { busy, nextAt };
  }
  return cacheVal;
}

/**
 * Subscribe to activity across `keys`.
 *
 * `keys` must be referentially stable across renders (a module-level constant
 * or a useMemo), for the same reason any dependency array must be.
 */
export function useFeedActivity(keys: readonly FeedKey[]): FeedActivity {
  const get = React.useCallback(() => snapshotFor(keys), [keys]);
  // Prerender runs renderToString, where nothing is ever in flight. Omitting
  // the server snapshot throws there; returning IDLE renders today's markup.
  return React.useSyncExternalStore(subscribe, get, () => IDLE);
}
