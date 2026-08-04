/**
 * data/useNodePopulation.ts — client store for `/api/nodes` (api/nodes.js),
 * the monero.fail node-census aggregator. Reports how many public Monero
 * nodes are reachable, their transport split (clear/Tor/I2P), an
 * availability-ratio histogram, and height-cluster/lag detection.
 *
 * DISTINCT from useApiStatus.ts's `/api/status` (cascade CONFIGURATION) and
 * from the xmrirish-feed tiers (THIS repo's own RPC health via api/_nodes.js).
 * This hook reads a third-party census of OTHER operators' nodes and shares
 * no code with either.
 *
 * ── WHY THIS IS AN EXTERNAL STORE (`useSyncExternalStore`), NOT A `useEffect`
 * fetch-in-a-hook ─────────────────────────────────────────────────────────
 * Same reasoning as useApiStatus.ts: this is ONE global piece of data,
 * identical for every consumer, not per-poll state scoped to a component
 * instance. A module-level store + `useSyncExternalStore` is the house
 * pattern for that class of problem (see feed-activity.ts's own header for
 * the original precedent). No `useEffect` appears in this file's source —
 * verify-effects.mjs's un-ledgered-effect sweep is the proof, and needs no
 * new ledger row because the count stays zero.
 *
 * ── THE DIFFERENCE FROM useApiStatus: THIS ONE REFRESHES ──────────────────
 * `/api/status` is fetched once for the page's lifetime. `/api/nodes` caches
 * at the edge with `s-maxage=300` (api/nodes.js) — a ~5-minute-horizon read,
 * not a one-shot — so this store additionally runs a module-level refresh
 * timer: started when the first subscriber arrives, cleared the moment the
 * last one leaves (nothing left to refresh for), and skipped on a hidden tab
 * via `document.visibilityState` so an unwatched tab does not keep polling a
 * third party. The timer itself is plain `setInterval`/`clearInterval` state
 * living beside `subscribe` in the module store — still not a `useEffect`.
 */

import * as React from "react";
import { getJSON } from "./http";
import type { SeriesStatus } from "./useMarketHistory";

/** One bar of the availability-ratio histogram: nodes whose passed/total
 *  check ratio falls in `[from, to)` (the last bucket is closed on both
 *  ends — ratio === 1.0 lands there). */
export interface Bucket {
  from: number;
  to: number;
  count: number;
}

/** One distinct reported chain height and how many available nodes report
 *  it. `lag` is `mode - height` (0 for the mode cluster itself). */
export interface Cluster {
  height: number;
  count: number;
  lag: number;
}

export interface NodeCounts {
  seen: number;
  reachable: number;
  excluded: number;
  unknownHeight: number;
}

export interface NodeSplit {
  clear: number;
  tor: number;
  i2p: number;
  total: number;
}

export interface NodeHeight {
  mode: number | null;
  clusters: Cluster[];
  lagging: { count: number; clusters: Cluster[] };
}

/** The four reasons api/nodes.js's own upstream fetch can fail — all four
 *  are independently producible (see that file's catch block comment). */
export type NodeReason =
  | "upstream-status"
  | "upstream-timeout"
  | "upstream-unreachable"
  | "upstream-malformed";

/** The success shape — numeric fields are always present, `status` says
 *  whether they are fresh (`live`) or served from the 30-minute grace
 *  window past the cache horizon (`stale`; `quality` is then always
 *  `"degraded"`). `reason` is explicit `null` here, never absent. */
export interface NodePopulationOk {
  v: number;
  at: string;
  source: string;
  sampledAt: string | null;
  status: "live" | "stale";
  quality: "full" | "degraded";
  reason: null;
  counts: NodeCounts;
  split: NodeSplit;
  availability: Bucket[];
  height: NodeHeight;
  partial: boolean;
}

/** The failure shape — NO numeric fields at all. `counts` / `split` /
 *  `availability` / `height` are absent from the wire body, not zeroed;
 *  modelling them as absent (rather than optional siblings of the success
 *  fields) is what makes reading `.counts.reachable` without narrowing on
 *  `status` a compile error instead of a silent `0`. */
export interface NodePopulationUnavailable {
  v: number;
  at: string;
  source: string;
  status: "unavailable";
  reason: NodeReason;
  upstreamStatus: number | null;
}

/** Discriminated on `status` — narrow before reading anything numeric. */
export type NodePopulation = NodePopulationOk | NodePopulationUnavailable;

/**
 * Share of the sampled population within 2 blocks of the modal height, as a
 * percentage — or `null` when the sample is empty (never 0, which would read
 * as "nobody agrees" rather than "we asked nobody").
 *
 * ── WHY THIS LIVES HERE AND NOT AT ITS CALL SITES ─────────────────────────
 *
 * It shipped TWICE, character-identical, in `NodePopulationPanel.tsx` and
 * `ColdBootConsole.tsx` — the second carrying a comment that named the hazard
 * ("two surfaces computing height agreement two different ways is a defect
 * waiting for a user to find it") two lines above reproducing it. Both render
 * the same statistic under the same label on the same site. They agreed on the
 * day they were written and nothing made them agree the day after.
 *
 * A gate asserting the two implementations match would work and is the wrong
 * tool: it adds an assertion to maintain in order to protect a duplication
 * that did not need to exist. One exported pure function over the type this
 * module already owns makes the drift impossible instead of detectable —
 * the same preference for "true by construction" over "true and checked" that
 * keeps hostnames off the wire by giving `Node` no host field at all.
 *
 * ── THE THRESHOLD ─────────────────────────────────────────────────────────
 *
 * `<= 2` is deliberately the exact complement of `api/nodes.js`'s `lag > 2`
 * lagging test, so agreement and lagging PARTITION the sample — no node is
 * both, none is neither. Change one and you must change the other, or the two
 * figures on `/live/network` will quietly stop summing.
 */
export function heightAgreementPct(height: NodeHeight): number | null {
  const sample = height.clusters.reduce((a, c) => a + c.count, 0);
  if (sample <= 0) return null;
  const withinTwo = height.clusters
    .filter((c) => Math.abs(c.lag) <= 2)
    .reduce((a, c) => a + c.count, 0);
  return (withinTwo / sample) * 100;
}

export interface UseNodePopulationResult {
  data: NodePopulation | null;
  status: SeriesStatus;
  /** ms epoch this store's OWN fetch last settled successfully; 0 = never.
   *  Render `data.at` (the server's instant) or `data.sampledAt` on screen —
   *  this is bookkeeping, not copy. */
  at: number;
  /** A fetch is on the wire now (the initial load, a scheduled refresh, or a
   *  manual retry). */
  refreshing: boolean;
  /** Fetch again, right now. A no-op while a fetch is already in flight. */
  retry: () => void;
}

const NODE_REASONS: ReadonlySet<string> = new Set([
  "upstream-status",
  "upstream-timeout",
  "upstream-unreachable",
  "upstream-malformed",
]);

function isCluster(x: unknown): x is Cluster {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return typeof o.height === "number" && typeof o.count === "number" && typeof o.lag === "number";
}

function isBucket(x: unknown): x is Bucket {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return typeof o.from === "number" && typeof o.to === "number" && typeof o.count === "number";
}

function isNodeCounts(x: unknown): x is NodeCounts {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.seen === "number" &&
    typeof o.reachable === "number" &&
    typeof o.excluded === "number" &&
    typeof o.unknownHeight === "number"
  );
}

function isNodeSplit(x: unknown): x is NodeSplit {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.clear === "number" &&
    typeof o.tor === "number" &&
    typeof o.i2p === "number" &&
    typeof o.total === "number"
  );
}

function isNodeHeight(x: unknown): x is NodeHeight {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (o.mode !== null && typeof o.mode !== "number") return false;
  if (!Array.isArray(o.clusters) || !o.clusters.every(isCluster)) return false;
  if (!o.lagging || typeof o.lagging !== "object") return false;
  const l = o.lagging as Record<string, unknown>;
  if (typeof l.count !== "number") return false;
  return Array.isArray(l.clusters) && l.clusters.every(isCluster);
}

/** Runtime shape guard — the same role isApiStatus plays in useApiStatus.ts.
 *  A body that parses as JSON but isn't shaped like NodePopulation (a proxy
 *  error envelope, `{}`, a 501 gate stub) must not be treated as a success.
 *  Exercised for real by verify-origins.mjs phase 2, which fulfils
 *  `**\/api/**` with `{}` in a live browser: this guard is what turns that
 *  `{}` into an honest error state instead of a crash reading `.counts`. */
export function isNodePopulation(x: unknown): x is NodePopulation {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (typeof o.v !== "number" || typeof o.at !== "string" || typeof o.source !== "string") return false;

  if (o.status === "unavailable") {
    if (typeof o.reason !== "string" || !NODE_REASONS.has(o.reason)) return false;
    return o.upstreamStatus === null || typeof o.upstreamStatus === "number";
  }

  if (o.status === "live" || o.status === "stale") {
    if (o.reason !== null) return false;
    if (o.quality !== "full" && o.quality !== "degraded") return false;
    if (typeof o.sampledAt !== "string" && o.sampledAt !== null) return false;
    if (typeof o.partial !== "boolean") return false;
    if (!isNodeCounts(o.counts)) return false;
    if (!isNodeSplit(o.split)) return false;
    if (!Array.isArray(o.availability) || !o.availability.every(isBucket)) return false;
    return isNodeHeight(o.height);
  }

  return false;
}

/* ── module-level store — one fetch (and one refresh timer), shared by
   every consumer ──────────────────────────────────────────────────────── */

interface StoreState {
  data: NodePopulation | null;
  status: SeriesStatus;
  at: number;
  refreshing: boolean;
}

let store: StoreState = { data: null, status: "loading", at: 0, refreshing: false };
const listeners = new Set<() => void>();
/** Guards the FIRST fetch only — flips true the instant it is kicked off. */
let started = false;
/** Guards against an overlapping fetch; `runFetch` itself resets it. */
let inFlight = false;
/** Non-null exactly while at least one subscriber is mounted. */
let refreshTimer: ReturnType<typeof setInterval> | null = null;

/** Matches the endpoint's `s-maxage=300` cache horizon (api/nodes.js) — a
 *  faster interval would just re-request the same edge-cached body. */
const REFRESH_MS = 5 * 60 * 1000;

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
     parse as JSON to `null` — it never throws. scripts/serve-dist.mjs
     answers any unmatched /api/* path (an unmocked /api/nodes included)
     with HTTP 501 + a JSON error envelope (serve-dist.mjs:78-84, since
     v6.1.4) — a non-2xx status, so getJSON collapses it to `null` here
     rather than a fabricated success. A gate exercising this route without
     mocking it therefore lands in the same "nothing real to show" branch as
     a genuine network failure, not a crash and not a false positive. */
  const body = await getJSON<unknown>("/api/nodes");

  if (isNodePopulation(body)) {
    // `status` on the wire is 'live' | 'stale' | 'unavailable'; the first two
    // map directly onto SeriesStatus, and 'unavailable' — no numeric fields
    // at all — is this hook's 'error': there is nothing real to render.
    const status: SeriesStatus = body.status === "unavailable" ? "error" : body.status;
    setStore({ data: body, status, at: Date.now(), refreshing: false });
  } else {
    // Never invent a fallback payload: nothing parsed, or it parsed into
    // something not shaped like NodePopulation. Either way there is nothing
    // real to show.
    setStore({ data: null, status: "error", at: 0, refreshing: false });
  }
  inFlight = false;
}

function startRefreshTimer(): void {
  if (refreshTimer !== null) return;
  refreshTimer = setInterval(() => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    void runFetch();
  }, REFRESH_MS);
}

function stopRefreshTimer(): void {
  if (refreshTimer === null) return;
  clearInterval(refreshTimer);
  refreshTimer = null;
}

/**
 * Called by React only on the client, after commit — never during
 * `renderToString` (scripts/entry-ssr.tsx, via scripts/prerender.mjs). The
 * first subscriber is therefore the correct, SSR-safe trigger for the
 * first fetch AND for starting the refresh timer; the timer is torn down
 * the moment the last subscriber unmounts, so a page nobody is viewing
 * stops polling a third party.
 */
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!started) {
    started = true;
    void runFetch();
  }
  startRefreshTimer();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stopRefreshTimer();
  };
}

function getSnapshot(): StoreState {
  return store;
}

/** Prerender runs renderToString, where nothing has ever been fetched and no
 *  timer has ever started. A frozen constant, never the mutable `store` —
 *  SSR must not observe (or cause) a state change. */
const SERVER_SNAPSHOT: StoreState = Object.freeze({ data: null, status: "loading", at: 0, refreshing: false });
function getServerSnapshot(): StoreState {
  return SERVER_SNAPSHOT;
}

export function useNodePopulation(): UseNodePopulationResult {
  const snap = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const retry = React.useCallback(() => {
    void runFetch();
  }, []);
  return { data: snap.data, status: snap.status, at: snap.at, refreshing: snap.refreshing, retry };
}
