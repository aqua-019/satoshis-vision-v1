/**
 * data/feed-status.ts — D1622. The ONE status vocabulary for the live feed.
 *
 * It replaces four scattered booleans on MoneroLive (`live` / `ready` /
 * `marketReady` / `stale`, formerly types.ts:143-150). Four booleans describe
 * SIXTEEN states, and most of them are nonsense — `ready && !live && stale &&
 * marketReady` was representable and meaningless. Worse, two states the feed
 * genuinely reaches could NOT be expressed at all:
 *
 *   · "never succeeded AND now failing" — `stale` was gated on `s.ready`
 *     (xmrirish-feed.ts, old :176), so a feed that never came up could only ever
 *     say CONNECTING, forever. A cold load while every node is down showed a
 *     spinner that would never resolve.
 *   · "the market is down" — marketTick returned false with NO state write at
 *     all (old :270), so a total CoinGecko outage and a cold boot rendered
 *     identically.
 *
 * The union below is TOTAL BY CONSTRUCTION: phase is a pure function of the
 * 2 × 2 of (has it ever succeeded?) × (is it failing now?). There is no fifth
 * state to forget and no combination that maps to no phase.
 *
 * ── WHY `at` IS TYPED PER-VARIANT ─────────────────────────────────────────
 * `at` is `null` on loading/error and `number` on live/stale. That is what makes
 * `hasData()` a TYPE GUARD rather than a convention: a component that has
 * checked it cannot then read a timestamp that isn't there. Eliminating the
 * unrepresentable state is the payoff — the phase string is just the label.
 *
 * ── VOCABULARY NOTE ───────────────────────────────────────────────────────
 * The v6.1.4 brief spells the healthy phase "success". This file says "live",
 * deliberately: "live" is already the repo's word in ProvFreshness
 * (design/provenance.tsx), SeriesStatus (useMarketHistory.ts) and FeedState
 * (useCachedFeed.ts). Adding "success" would create a FOURTH vocabulary inside
 * the one change whose entire purpose is to leave exactly one.
 *
 * ── IMPORT DISCIPLINE ─────────────────────────────────────────────────────
 * This module imports NOTHING. `usePolling.ts` and `useMarketHistory.ts` are
 * loaded in bare Node by verify-tiers.mjs / verify-stale.mjs with no alias
 * resolution, so they may only reach this file with `import type` (which Node's
 * type stripping erases). A value import from either of those two would fail
 * with ERR_MODULE_NOT_FOUND — verified on Node 22.22.2, not assumed.
 */

/** One key per distinct request the app makes. Per-ENDPOINT, not per-tier:
 *  "killing one node degrades exactly one panel" is only expressible at this
 *  granularity, and the tiers bundle endpoints that fail independently. */
export type FeedKey = "mempool" | "fees" | "tip" | "network" | "blocks" | "market";

export const FEED_KEYS = ["mempool", "fees", "tip", "network", "blocks", "market"] as const;

/** Named in every failure message. verify-future.mjs already asserts this rule
 *  for the announcements column: explain, name the endpoint, never blank. */
export const FEED_ENDPOINT: Record<FeedKey, string> = {
  mempool: "/api/xmr/mempool",
  fees: "/api/xmr/fees",
  tip: "/api/xmr/tip",
  network: "/api/xmr/network",
  blocks: "/api/xmr/blocks",
  market: "/api/coingecko",
};

/**
 * Consecutive failures before a key is called degraded. Preserves v6.0.6's
 * thresholds exactly (the old STALE_AFTER_FAST / STALE_AFTER_CHAIN, both 2), so
 * this change moves WHERE the decision is made, not WHEN it fires.
 *
 * `market` gets a threshold for the first time. At the 60s market cadence that
 * is ~2 minutes before CoinGecko is called down, which is the right order of
 * magnitude for a rate-limited upstream that legitimately 429s in bursts.
 */
export const STALE_AFTER: Record<FeedKey, number> = {
  mempool: 2,
  fees: 2,
  tip: 2,
  network: 2,
  blocks: 2,
  market: 2,
};

/**
 * Why a poll failed. `getJSON` (http.ts) collapses every failure to null, so the
 * feed classifies only from what it can actually observe: an aborted signal is a
 * timeout, `navigator.onLine === false` is offline, everything else is http.
 * Never guessed beyond that — inventing a status code would be synthesis, and
 * this site does not synthesise.
 */
export type FailReason = "http" | "timeout" | "offline";

export type FeedPhase = "loading" | "live" | "stale" | "error";

interface FeedBase {
  /** Same-origin path this status describes; failure copy names it. */
  readonly endpoint: string;
  /** Consecutive failures since the last success. May be > 0 while still
   *  "live" or "loading": one miss is a wobble, not yet a degradation. */
  readonly fails: number;
}

export type FeedStatus =
  /** No response yet, and nothing has gone wrong yet. Nothing to render. */
  | (FeedBase & { readonly phase: "loading"; readonly at: null; readonly reason: null })
  /** Last poll succeeded, at `at`. */
  | (FeedBase & { readonly phase: "live"; readonly at: number; readonly reason: null })
  /** Was healthy, now failing. `at` is LAST-GOOD, so data is still renderable. */
  | (FeedBase & { readonly phase: "stale"; readonly at: number; readonly reason: FailReason })
  /** Never succeeded and now failing. Nothing to show, and it IS broken —
   *  the state the old `ready: false` could not distinguish from "connecting". */
  | (FeedBase & { readonly phase: "error"; readonly at: null; readonly reason: FailReason });

export type FeedStatusMap = Readonly<Record<FeedKey, FeedStatus>>;

/* ── the raw facts the feed STORES. Phase is never one of them (D1624). ───── */

export interface FeedObs {
  /** ms epoch of the last SUCCESSFUL response; 0 = never. */
  readonly okAt: number;
  readonly fails: number;
  readonly reason: FailReason | null;
}

export type ObsMap = Readonly<Record<FeedKey, FeedObs>>;

const BOOT_OBS_ENTRY: FeedObs = { okAt: 0, fails: 0, reason: null };

export const BOOT_OBS: ObsMap = Object.freeze({
  mempool: BOOT_OBS_ENTRY,
  fees: BOOT_OBS_ENTRY,
  tip: BOOT_OBS_ENTRY,
  network: BOOT_OBS_ENTRY,
  blocks: BOOT_OBS_ENTRY,
  market: BOOT_OBS_ENTRY,
});

/**
 * D1624 — stored facts → rendered phase. PURE, called during render.
 *
 * The old code computed `stale` inside `commit()` and stored it, reading failure
 * counters out of refs that had already moved on. Deriving here means the phase
 * on screen can never be a snapshot of a fact that has since changed.
 */
export function deriveStatus(o: FeedObs, key: FeedKey): FeedStatus {
  const endpoint = FEED_ENDPOINT[key];
  const degraded = o.fails >= STALE_AFTER[key];
  if (o.okAt > 0) {
    return degraded
      ? { phase: "stale", endpoint, fails: o.fails, at: o.okAt, reason: o.reason ?? "http" }
      : { phase: "live", endpoint, fails: o.fails, at: o.okAt, reason: null };
  }
  return degraded
    ? { phase: "error", endpoint, fails: o.fails, at: null, reason: o.reason ?? "http" }
    : { phase: "loading", endpoint, fails: o.fails, at: null, reason: null };
}

export function deriveAll(obs: ObsMap): FeedStatusMap {
  return {
    mempool: deriveStatus(obs.mempool, "mempool"),
    fees: deriveStatus(obs.fees, "fees"),
    tip: deriveStatus(obs.tip, "tip"),
    network: deriveStatus(obs.network, "network"),
    blocks: deriveStatus(obs.blocks, "blocks"),
    market: deriveStatus(obs.market, "market"),
  };
}

/* ── predicates: derived functions over the union, never stored booleans ──── */

/** There is a real reading to render. Narrows `at` to `number`. */
export const hasData = (s: FeedStatus): s is Extract<FeedStatus, { at: number }> => s.at !== null;
/** What is on screen is last-good, not current. */
export const isStale = (s: FeedStatus): boolean => s.phase === "stale";
/** Nothing to show, and it is broken — not merely early. */
export const isDown = (s: FeedStatus): boolean => s.phase === "error";
/** Not healthy, either way. */
export const isDegraded = (s: FeedStatus): boolean => s.phase === "stale" || s.phase === "error";

/**
 * The ONE definition of "the chain feed is not healthy", so ~15 call sites
 * cannot each invent their own rule.
 *
 * It preserves today's semantics EXACTLY, including its pair-AND shape, which is
 * not obvious from any call site:
 *
 *   · the FAST tier incremented its failure streak only when BOTH
 *     /api/xmr/mempool AND /api/xmr/fees failed — either one succeeding reset it.
 *   · the CHAIN tier likewise only when BOTH /api/xmr/network AND
 *     /api/xmr/blocks failed.
 *
 * So a SINGLE endpoint failing has never raised STALE, and it must not start
 * doing so inside a mechanical 92-site migration: verify-allreal-dom.mjs asserts
 * the LIVE→STALE transition and is wanted here as a regression check, not a
 * moving target. Surfacing single-endpoint failure is the NEXT change's job,
 * per panel, where the specific key is in scope.
 *
 * `market` is excluded, and always has been — a market outage never marked the
 * chain feed stale. CoinGecko failing says nothing about node health; different
 * upstream, different provenance. `tip` is excluded because a failed tip watch
 * falls through to the full pull rather than counting as a chain failure.
 */
export function feedDegraded(m: FeedStatusMap): boolean {
  return (
    (isDegraded(m.mempool) && isDegraded(m.fees)) ||
    (isDegraded(m.network) && isDegraded(m.blocks))
  );
}

/**
 * The single phase a page-chrome badge (the CONNECTING / STALE / LIVE pills)
 * shows for a group of keys. Reproduces the pre-v6.1.4 three-way EXACTLY:
 *
 *   nothing has landed for any of `keys`  →  "loading", or "error" once one of
 *                                            them is actually failing
 *   feedDegraded (the pair-AND rule)      →  "stale"
 *   otherwise                             →  "live"
 *
 * Note it does NOT roll up "worst wins" across the group: that would report
 * stale when any single endpoint were stale, which is a different — and
 * louder — rule than the one shipping today. Changing when a pill goes yellow
 * is a product decision, not a side effect of introducing a type.
 *
 * The "error" case is what the old booleans could not say. Callers currently
 * render it with the same copy as "loading"; giving it its own words is the
 * next change's job, and it must land together with the gate that pins the
 * copy (verify-allreal-dom.mjs scenario A asserts CONNECTING on a cold total
 * outage — i.e. it asserts today's behaviour, error case included).
 */
/** Chrome that shows chain numbers only (Footer, /network, the mempool pill). */
export const CHAIN_CHROME_KEYS = ["network"] as const;
/** Chrome that shows chain AND price together (NavTop's strip, the home hero),
 *  so either one landing is enough to stop saying CONNECTING. */
export const CHAIN_MARKET_CHROME_KEYS = ["network", "market"] as const;

export function chromePhase(m: FeedStatusMap, keys: readonly FeedKey[]): FeedPhase {
  const any = keys.some((k) => hasData(m[k]));
  if (!any) return keys.some((k) => isDown(m[k])) ? "error" : "loading";
  return feedDegraded(m) ? "stale" : "live";
}

/**
 * The last-success time of one endpoint, or 0 if it has never answered.
 *
 * `at` is `null` on the loading and error variants — that is the type doing its
 * job, since there is no timestamp when nothing has ever landed. Elapsed maths
 * and remount keys want a number, and 0 is the same sentinel `lastUpdate`
 * carried before this, so every existing `> 0` guard keeps working.
 */
export const freshAt = (s: FeedStatus): number => s.at ?? 0;

/**
 * The OLDEST last-success time across the keys a panel reads — "when was this
 * panel as a whole last true".
 *
 * Oldest rather than newest, to agree with NodeProvenance's worst-of freshness:
 * a panel showing mempool and fees together is only as current as its more
 * stagnant half, and reporting the fresher one would let a dead endpoint hide
 * behind a live neighbour. `freshAt` returns 0 for "never answered", so a panel
 * with any never-answered key collapses to 0 and renders "—" rather than a time
 * that describes only part of what is on screen.
 */
export const oldestFreshAt = (m: FeedStatusMap, keys: readonly FeedKey[]): number => {
  let oldest = Infinity;
  for (const k of keys) oldest = Math.min(oldest, freshAt(m[k]));
  return Number.isFinite(oldest) ? oldest : 0;
};

/**
 * Newest successful response across every key.
 *
 * Used by the differs whose job is "something landed" rather than "this
 * endpoint landed" — a snapshot diff has to run whenever any tier commits, so
 * keying it on one endpoint would make it miss the others.
 *
 * Deliberately NOT wired to `MoneroLive.lastUpdate`.
 * `lastUpdate` is the feed's HEARTBEAT, not a freshness stamp: map.ts stamps it
 * at each commit, and consumers use it as tick identity — a React remount key at
 * mempool-shared.tsx (which replays the `mp-beat` flash once per tick) and a dep
 * array in mem-stats.tsx and bridge.tsx. Swapping it for "newest success" would
 * be identical in the common case and would diverge exactly during an outage:
 * the heartbeat LED would stop flashing, `ageSec` would count up instead of
 * resetting, and NetRail's UTC clock would freeze at last-good.
 *
 * Every one of those is MORE honest than today, and every one is the freshness
 * work's content, not the type unification's. This exists for per-panel
 * timestamps (D0859) to build on.
 */
export function lastOkAt(m: FeedStatusMap): number {
  let max = 0;
  for (const k of FEED_KEYS) {
    const at = m[k].at;
    if (at !== null && at > max) max = at;
  }
  return max;
}

/**
 * Exhaustiveness guard for `switch (status.phase)`. Widening FeedPhase without
 * updating a renderer becomes a COMPILE error rather than a silently-missing
 * branch.
 *
 * It deliberately does NOT throw, and the reason has CHANGED — read this before
 * "fixing" it. The original reason was that no panel-level error boundary
 * existed: RootBoundary was mounted only at the app root and on /simulate, so a
 * throw from any data surface unwound to main.tsx and blanked the entire site.
 *
 * v6.1.4 added `design/PanelBoundary.tsx`, so on surfaces that mount one, a
 * throw would now be contained to its own panel. That removes the original
 * objection but not the behaviour, because two weaker reasons remain: coverage
 * is per-call-site rather than global (an unwrapped surface would still take
 * the route), and a phase this code has never seen is a rendering question, not
 * a reason to destroy a panel that could otherwise show last-good data.
 * Returning a fallback degrades; throwing escalates. It stays unreachable while
 * the union is closed either way.
 */
export function assertNever<T = null>(x: never, ctx: string, fallback: T = null as T): T {
  console.error(`[xmr.irish] ${ctx}: unhandled feed phase`, x);
  return fallback;
}
