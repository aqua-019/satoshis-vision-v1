/**
 * data/useCachedFeed.ts — 24h localStorage-backed feed cache for the /future page.
 *
 * The /future page pulls a handful of public project-metadata feeds (GitHub
 * repo pulse, monero-project/meta "MRL" issue tracker, getmonero.org blog).
 * All of them go through the same-origin `/api/feeds` proxy — the site's CSP
 * is `connect-src 'self'`, so the browser must never fetch a third-party
 * origin directly (same rule `useMarketHistory`/`useTickers` follow for
 * CoinGecko via `/api/coingecko`).
 *
 * Each source is fetched at most once per FEED_TTL (24h) per visitor, and the
 * result is shared across every card on the page that asks for the same
 * source — see the module-level `inFlight` map below. This mirrors this
 * repo's "last-good, never synthesis" invariant (see README.md): a failed
 * fetch never clobbers a good cached value, and nothing here is ever
 * fabricated — a source with no cache and a failed fetch reports `data: null`,
 * not a placeholder.
 *
 * Privacy note: what's cached here is public project metadata only — repo
 * star counts, issue titles, blog post titles/dates. No txids, no addresses,
 * no wallet state. Keep it that way if this cache is ever extended.
 *
 * The reusable primitives (`readCache`/`writeCache`/`safeStore`) live in
 * `useMarketHistory.ts` and are shared here at a different TTL rather than
 * forked — see that file's `readCache(store, key, now, maxAge)` signature.
 */

import * as React from "react";
import { getJSON } from "./http";
import { readCache, writeCache, safeStore, type CachedSeries } from "./useMarketHistory";

export const FEED_TTL = 864e5; // 24 hours
export const FEED_PREFIX = "xmri.feed.";
export const FEED_PROXY = "/api/feeds";

export type FeedState = "load" | "cached" | "live" | "fail";
export interface FeedResult<T> { data: T | null; at: number | null; state: FeedState }

/** Namespaced localStorage key for a feed id. */
export function feedCacheKey(id: string): string {
  return `${FEED_PREFIX}${id}`;
}

/* ── pure cache read/write, exported so verify-feedcache.mjs can exercise
   them directly without rendering anything (no React/DOM required). Thin
   wrappers over useMarketHistory's readCache/writeCache at FEED_TTL. ──── */

/** Read a feed's cached entry; null if absent, corrupt, or older than FEED_TTL. */
export function readFeedCache<T>(id: string, now = Date.now()): CachedSeries<T> | null {
  return readCache<T>(safeStore(), feedCacheKey(id), now, FEED_TTL);
}

/** Write a feed's cached entry; swallows quota/private-mode errors. */
export function writeFeedCache<T>(id: string, data: T, now = Date.now()): void {
  writeCache(safeStore(), feedCacheKey(id), data, now);
}

/* ── in-flight request de-dup (module scope; survives StrictMode's
   double-invoked effects and lets two cards asking for the same id share
   one network request instead of firing two). Keyed by cache id, not by
   fetcher identity — callers for the same id are expected to fetch the
   same thing.
   This is LOAD-BEARING: everything that changes the payload must be baked
   into `id` (see useRepoPulse/useMrlIssues/useMoneroBlog below, where a
   varying `repo`/`n` is folded into the cache id itself). A caller that
   varies its `fetcher` without varying its `id` would silently receive
   another caller's in-flight (or cached) data. ─────────────────────── */

const inFlight = new Map<string, Promise<unknown>>();

function fetchOnce<T>(id: string, fetcher: () => Promise<T | null>): Promise<T | null> {
  const existing = inFlight.get(id);
  if (existing) return existing as Promise<T | null>;
  const p = fetcher().finally(() => {
    inFlight.delete(id);
  });
  inFlight.set(id, p);
  return p;
}

/**
 * One fetch per source per 24h, shared by every card that asks for it.
 *
 * - `id === null` means "don't fetch" — returns the empty/loading shape and
 *   runs no network effect.
 * - The initial cache read happens once in a lazy `useState` initialiser (no
 *   stale-closure seed), and is re-read whenever `id` changes.
 * - A fresh cache hit (age < FEED_TTL) never triggers a fetch.
 * - A fetch failure never clobbers good cached data: `state` becomes "fail"
 *   but `data` stays whatever was last cached (only `null` when there is
 *   genuinely nothing cached).
 */
export function useCachedFeed<T>(
  id: string | null,
  fetcher: () => Promise<T | null>,
  deps: React.DependencyList = [],
): FeedResult<T> {
  const [result, setResult] = React.useState<FeedResult<T>>(() => {
    if (id === null) return { data: null, at: null, state: "load" };
    const hit = readFeedCache<T>(id);
    return hit ? { data: hit.data, at: hit.at, state: "cached" } : { data: null, at: null, state: "load" };
  });

  React.useEffect(() => {
    if (id === null) {
      setResult((prev) => (prev.data === null && prev.at === null && prev.state === "load" ? prev : { data: null, at: null, state: "load" }));
      return;
    }

    let alive = true;

    // Re-read (id may have just changed) — a fresh hit needs no fetch at all.
    const hit = readFeedCache<T>(id);
    if (hit) {
      setResult({ data: hit.data, at: hit.at, state: "cached" });
      return;
    }

    setResult((prev) => (prev.state === "load" ? prev : { data: null, at: null, state: "load" }));

    // "fail" fallback: keep whatever is genuinely cached, else null. Bound to
    // the `then`'s *onRejected* argument (below) rather than a chained
    // `.catch()`, so it only ever reacts to fetchOnce/fetcher failing (or a
    // legitimately-empty upstream result) — never to a bug thrown by
    // writeFeedCache/setResult on the success path, which would otherwise be
    // swallowed and mislabeled as a feed failure by a trailing `.catch()`.
    const fail = () => {
      if (!alive) return;
      const fallback = readFeedCache<T>(id);
      setResult(fallback ? { data: fallback.data, at: fallback.at, state: "fail" } : { data: null, at: null, state: "fail" });
    };

    fetchOnce(id, fetcher).then((data) => {
      if (!alive) return;
      if (data == null) {
        // getJSON never throws — an upstream miss/parse-empty resolves with
        // null. Per the "no synthesis" rule that's a failure, not a fact.
        fail();
        return;
      }
      const now = Date.now();
      writeFeedCache(id, data, now);
      setResult({ data, at: now, state: "live" });
    }, fail);

    return () => { alive = false; };
    // `id` drives the cache read + fetch; caller-supplied `deps` (e.g. a
    // page-size `n`) are folded in so their changes re-trigger the effect too.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ...deps]);

  return result;
}

/* ── /api/feeds consumers ───────────────────────────────────────────── */

interface GhRepoResponse { stars?: number; pushed?: string; issues?: number }
interface FeedItemsResponse<I> { items?: I[] }

export interface RepoPulse { stars: number; pushed: string; issues: number }

export function useRepoPulse(repo: string): RepoPulse | null {
  // `repo` fully determines the payload, so it's folded into the id itself
  // — the effect's `deps` array would be redundant (see fetchOnce above).
  const id = repo ? `gh.${repo}` : null;
  const { data } = useCachedFeed<RepoPulse>(id, () =>
    getJSON<GhRepoResponse>(`${FEED_PROXY}?src=ghrepo&repo=${encodeURIComponent(repo)}`).then((r) =>
      r && typeof r.stars === "number" && typeof r.pushed === "string" && typeof r.issues === "number"
        ? { stars: r.stars, pushed: r.pushed, issues: r.issues }
        : null,
    ),
  );
  return data;
}

export interface MrlIssue { n: number; t: string; u: string; url: string; c: number }

export function useMrlIssues(n = 6): { issues: MrlIssue[] | null; at: number | null; state: FeedState } {
  // `n` changes the payload's length, so — same rule as useRepoPulse — it's
  // folded into the id. A fixed "mrl.issues" id would let a caller that
  // switches `n` hit a cache entry sized for a different `n` and silently
  // render the wrong item count for up to 24h.
  const { data, at, state } = useCachedFeed<MrlIssue[]>(`mrl.issues.${n}`, () =>
    getJSON<FeedItemsResponse<MrlIssue>>(`${FEED_PROXY}?src=mrl&n=${n}`).then((r) =>
      Array.isArray(r?.items) ? r.items : null,
    ),
  );
  return { issues: data, at, state };
}

export interface BlogPost { title: string; url: string; date: string }

export function useMoneroBlog(n = 5): { posts: BlogPost[] | null; at: number | null; state: FeedState } {
  // Same reasoning as useMrlIssues: `n` is folded into the id.
  const { data, at, state } = useCachedFeed<BlogPost[]>(`getmonero.blog.${n}`, () =>
    getJSON<FeedItemsResponse<BlogPost>>(`${FEED_PROXY}?src=getmonero&n=${n}`).then((r) =>
      Array.isArray(r?.items) ? r.items : null,
    ),
  );
  return { posts: data, at, state };
}

/* ── display helpers ────────────────────────────────────────────────── */

/**
 * "12m ago" / "5h ago" / "9d ago"; "—" for null/invalid.
 * `now` is an internal testability hook (defaults to the real clock) — the
 * public 1-arg contract is unaffected.
 */
export function agoStr(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const diffMs = Math.max(0, now - t);
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(diffMs / 86_400_000);
  return `${days}d ago`;
}

/**
 * True when `iso` is older than `days` (default 90). Null/invalid → false.
 * `now` is an internal testability hook (defaults to the real clock) — the
 * public 1/2-arg contract is unaffected.
 */
export function isStale(iso: string | null | undefined, days = 90, now = Date.now()): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  return now - t > days * 86_400_000;
}
