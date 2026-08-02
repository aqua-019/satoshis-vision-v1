/**
 * data/useApiStatus.ts — one-shot read of `/api/status`.
 *
 * `/api/status` (api/status.js) reports node-cascade CONFIGURATION and
 * CAPABILITY only — env vars set, reference-node counts, which `/api/*`
 * routes exist. It is structurally unable to report node HEALTH (each Vercel
 * function gets its own module registry, so it can never see api/xmr.js's
 * in-memory health map — see api/status.js's header for the full reasoning).
 * `probed: false` is the wire-level flag saying so. This hook must not blur
 * that line: it reports exactly what the endpoint reports, and invents
 * nothing when the endpoint is unreachable.
 *
 * ── WHY THIS IS AN EXTERNAL STORE (`useSyncExternalStore`), NOT A `useEffect`
 * fetch-in-a-hook, which is the shape useTickers.ts / useMarketHistory.ts /
 * useCachedFeed.ts use ─────────────────────────────────────────────────────
 * Those three fetch inside a `useEffect` because each of them owns state that
 * is genuinely per-poll (a tier, a range, a TTL) and each has exactly one
 * ledger entry in verify-effects.mjs (D1625) justifying it as unavoidable
 * external sync — "no data-router, no query library in the dependency set."
 * `/api/status` has none of that shape: it is ONE global piece of static
 * configuration, identical for every consumer, fetched at most once for the
 * page's whole lifetime. `feed-activity.ts` already established the house
 * pattern for exactly this class of problem — external, cross-component state
 * that must not go through Context (see its own header) and must not fetch
 * during `renderToString` — via a module-level store + `useSyncExternalStore`.
 * This file follows that precedent: `subscribe()` is called by React only on
 * the client, after commit (never during a server render — React throws on a
 * missing `getServerSnapshot` specifically to force that to be handled, which
 * is why one is supplied below), so the first subscription is the correct,
 * SSR-safe place to kick off the one-and-only fetch. No `useEffect` appears in
 * this file's source as a result, and that is a real property, not a phrasing
 * trick: there is no per-poll state to justify one, and every consumer of this
 * hook shares one fetch rather than each mounting its own.
 */

import * as React from "react";
import { getJSON } from "./http";
import type { SeriesStatus } from "./useMarketHistory";

export interface ApiStatusEndpoint {
  path: string;
  file: string;
  kind: string;
}

export interface ApiStatusCascade {
  primaryConfigured: boolean;
  referenceCount: number;
  /** Only hosts that also appear in the public REFERENCE_MAINNET default —
   *  can be shorter than referenceCount; see api/status.js's hostsForDisplay. */
  referenceHosts: string[];
  networks: Record<string, number>;
}

export interface ApiStatus {
  v: number;
  /** The server's own ISO instant for this response. Render verbatim — never
   *  reformat into a live ticking relative age. */
  at: string;
  /** Always false, on the wire, from this endpoint. It never probes upstream
   *  node liveness — see the module docblock above. */
  probed: false;
  note: string;
  cascade: ApiStatusCascade;
  endpoints: ApiStatusEndpoint[];
}

export interface UseApiStatusResult {
  data: ApiStatus | null;
  status: SeriesStatus;
  /** ms epoch this store's OWN fetch last settled successfully; 0 = never.
   *  This is bookkeeping, not copy — render `data.at` (the server's instant)
   *  on screen instead. */
  at: number;
  /** A fetch is on the wire now (the initial load or a manual retry). */
  refreshing: boolean;
  /** Fetch again. A no-op while a fetch is already in flight. Does not clear
   *  the currently-shown data/status until the new attempt settles. */
  retry: () => void;
}

/** Runtime shape guard. A response that parses as JSON but isn't shaped like
 *  ApiStatus (a proxy error envelope, an empty object, …) must not be treated
 *  as a success — this is what keeps "never invent a fallback payload" true
 *  even when `getJSON` itself successfully parses *something*. */
function isApiStatus(x: unknown): x is ApiStatus {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (typeof o.v !== "number" || typeof o.at !== "string" || typeof o.note !== "string") return false;
  if (!o.cascade || typeof o.cascade !== "object") return false;
  const c = o.cascade as Record<string, unknown>;
  if (typeof c.primaryConfigured !== "boolean" || typeof c.referenceCount !== "number") return false;
  if (!Array.isArray(c.referenceHosts) || !c.networks || typeof c.networks !== "object") return false;
  return Array.isArray(o.endpoints);
}

/* ── module-level store — one fetch, shared by every consumer ────────────── */

interface StoreState {
  data: ApiStatus | null;
  status: SeriesStatus;
  at: number;
  refreshing: boolean;
}

let store: StoreState = { data: null, status: "loading", at: 0, refreshing: false };
const listeners = new Set<() => void>();
/** Guards the FIRST fetch only — flips true the instant it is kicked off. */
let started = false;
/** Guards against an overlapping retry; `runFetch` itself resets it. */
let inFlight = false;

const emit = (): void => {
  for (const l of listeners) l();
};

function setStore(patch: Partial<StoreState>): void {
  store = { ...store, ...patch };
  emit();
}

async function runFetch(): Promise<void> {
  if (inFlight) return;
  inFlight = true;
  setStore({ refreshing: true });

  /* `getJSON` (./http) resolves a non-2xx response OR a body that fails to
     parse as JSON to `null` — it never throws. That is exactly the guard this
     endpoint needs: scripts/serve-dist.mjs answers ANY unmatched path (an
     unmocked /api/status included) with HTTP 200 text/html, which reads as
     `res.ok === true` right up until `res.json()` tries to parse it — at
     which point getJSON's own try/catch collapses that to `null` rather than
     a fabricated "success". A non-JSON 200 therefore already lands in the
     `else` branch below, exactly like a network failure. */
  const body = await getJSON<unknown>("/api/status");

  if (isApiStatus(body)) {
    setStore({ data: body, status: "live", at: Date.now(), refreshing: false });
  } else {
    // Never invent a fallback payload: nothing parsed, or it parsed into
    // something not shaped like ApiStatus. Either way there is nothing real
    // to show.
    setStore({ data: null, status: "error", at: 0, refreshing: false });
  }
  inFlight = false;
}

/**
 * Called by React only on the client, after commit — never during
 * `renderToString` (scripts/entry-ssr.tsx, via scripts/prerender.mjs). The
 * first subscriber is therefore the correct, SSR-safe trigger for the
 * one-and-only fetch; every subsequent mount (this page revisited, or a
 * second consumer) just reads the shared store.
 */
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!started) {
    started = true;
    void runFetch();
  }
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): StoreState {
  return store;
}

/** Prerender runs renderToString, where nothing has ever been fetched.
 *  A frozen constant, never the mutable `store` — SSR must not observe (or
 *  cause) a state change. */
const SERVER_SNAPSHOT: StoreState = Object.freeze({ data: null, status: "loading", at: 0, refreshing: false });
function getServerSnapshot(): StoreState {
  return SERVER_SNAPSHOT;
}

export function useApiStatus(): UseApiStatusResult {
  const snap = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const retry = React.useCallback(() => {
    void runFetch();
  }, []);
  return { data: snap.data, status: snap.status, at: snap.at, refreshing: snap.refreshing, retry };
}
