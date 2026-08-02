/**
 * design/useOnline.ts — connectivity, and the one place that decides what the
 * page chrome is allowed to claim.
 *
 * ── WHY OFFLINE OUTRANKS EVERYTHING ────────────────────────────────────────
 * When `navigator.onLine` is false we never asked the node. Saying
 * "NO NODE RESPONSE" then would report the wrong fact — it blames a cascade
 * that was never contacted, which is the same error as flagging a COINGECKO
 * badge stale because the node cascade died. Different facts; the page should
 * not report the second when the first is true.
 *
 * So `useChromeState` resolves offline FIRST and the phase second. Every chrome
 * surface reads it, so the precedence is decided once rather than four times.
 *
 * ── WHY useSyncExternalStore ───────────────────────────────────────────────
 * `navigator.onLine` is an external mutable source with its own events — the
 * textbook case for this hook, and the first use of it in this repo. The
 * alternative (useState + useEffect + two listeners) tears under concurrent
 * rendering: two components could read different connectivity in the same
 * commit.
 *
 * `getServerSnapshot` returns TRUE — the prerender runs in Node where there is
 * no navigator, and a build-time document must not ship claiming the reader is
 * offline. Omitting the third argument throws under renderToString, which
 * `scripts/prerender.mjs` runs for all 11 routes.
 *
 * Before this, `navigator.onLine` was sampled in exactly one place — the feed's
 * `why()` failure classifier — and only at the moment a fetch already failed.
 * The app had no push notification of connectivity at all, which is why a Tor
 * circuit dropping looked identical to a slow node.
 */

import * as React from "react";
import { chromePhase, type FeedKey, type FeedPhase, type FeedStatusMap } from "@/data/feed-status";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/* `navigator.onLine === false` is reliable (the OS says there is no route).
   `true` only means an interface exists — a captive portal or a dead Tor
   circuit still reads true. So this is used to SUPPRESS a wrong claim, never
   to assert that anything is reachable. */
const getSnapshot = (): boolean => navigator.onLine;
const getServerSnapshot = (): boolean => true;

export function useOnline(): boolean {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * What the page chrome should say, in one vocabulary.
 *
 * `"offline"` is not a FeedPhase — the feed has no opinion when the browser
 * never dialled. Keeping it as a separate member of this union (rather than a
 * fifth FeedPhase) is deliberate: `FeedPhase` describes what an endpoint did,
 * and "we didn't ask" is not something an endpoint did.
 *
 * Widening `FeedPhase` widens this too, so every exhaustive switch over
 * `ChromeState` still fails to compile on a new phase.
 */
export type ChromeState = "offline" | FeedPhase;

export function useChromeState(status: FeedStatusMap, keys: readonly FeedKey[]): ChromeState {
  const online = useOnline();
  if (!online) return "offline";
  return chromePhase(status, keys);
}

/**
 * The shared label for every state EXCEPT `live`.
 *
 * The degraded states were four dialects of the same three facts — `CONNECTING`
 * vs `CONNECTING…`, `STALE · reconnecting` vs `STALE · RECONNECTING` vs
 * `FEED STALE` — which made them read as different events rather than one event
 * seen from four surfaces. They are one vocabulary now.
 *
 * `live` is deliberately NOT here: `LIVE`, `SYNCED` and `NETWORK NOMINAL` say
 * the same thing in each surface's own register, and a healthy reading is the
 * one case where nothing is at stake in the wording.
 *
 * `NO NODE RESPONSE` reads as "the NODE source returned nothing" because NODE
 * is already this site's provenance label for that data — not as a claim about
 * whose infrastructure is at fault, which the browser cannot know. Measured at
 * 390px before adoption: the NavTop pill goes 109px → 152px and the ticker
 * strip 202px → 245px with no reflow (height stays 25px) and no document
 * overflow.
 */
export const CHROME_LABEL: Record<Exclude<ChromeState, "live">, string> = {
  offline: "OFFLINE",
  loading: "CONNECTING",
  error: "NO NODE RESPONSE",
  stale: "STALE · reconnecting",
};

/**
 * The endpoint a failed chrome state should name, for the `title` / detail.
 *
 * Rule, from the contract verify-future.mjs already enforces for the
 * announcements column: explain, name the endpoint, never blank. The pill
 * itself stays short — the endpoint rides in the tooltip and, on the page whose
 * data it is, in a visible line.
 */
export function chromeDetail(state: ChromeState, status: FeedStatusMap, keys: readonly FeedKey[]): string | null {
  switch (state) {
    case "offline":
      return "no network connection — nothing was requested";
    case "error":
    case "stale": {
      const failing = keys.filter((k) => status[k].phase === state);
      const named = (failing.length ? failing : keys).map((k) => status[k].endpoint);
      return `${named.join(" · ")} ${state === "error" ? "returned nothing" : "is not answering"}`;
    }
    case "loading":
      return "waiting for the first response";
    case "live":
      return null;
  }
}
