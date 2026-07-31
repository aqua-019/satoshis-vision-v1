/**
 * data/releases.ts — single source of truth for the site's version identity
 * and its release-notes list.
 *
 * Two things live here on purpose:
 *
 *  1. `SITE_VERSION` — the build's own version label (NavTop). This is
 *     deliberately STATIC, never feed-derived: the chrome's version badge is
 *     build identity. Deriving it from a live GitHub feed would let a stale
 *     deployment advertise a version whose code isn't actually in the bundle
 *     the visitor is running.
 *
 *  2. `CURATED` + `mergeReleases` — the release-notes list on the Sources
 *     page. `CURATED` is the five hand-written entries that used to be a
 *     hardcoded `RELEASES` array on SourcesPage.tsx (moved here verbatim,
 *     including their typographic quotes/dashes) and now serve two roles:
 *     an editorial override on top of the live `commits` feed (curated prose
 *     reads better than a raw commit subject), and the offline fallback when
 *     GitHub is unreachable ("last-good, never synthesis" — see README.md
 *     and useCachedFeed.ts's header comment).
 */

export const SITE_VERSION = "v6.0.5";

export interface ReleaseNote {
  v: string;
  note: string;
  date?: string;
  sha?: string;
  url?: string;
  /** Count of additional commits folded into this version by the server-side
   *  dedup (see the `/api/feeds?src=commits` contract). Omitted or 0 when
   *  the version is unique. */
  also?: number;
  /** True when `note` came from CURATED rather than the live feed. */
  curated?: boolean;
}

/** Moved character-for-character from the old SourcesPage.tsx RELEASES
 *  array — do not "clean up" the typographic quotes/dashes below, they are
 *  intentional. Newest first. */
export const CURATED: ReadonlyArray<{ v: string; note: string }> = [
  { v: "v5.0.20", note: "Stability cue (calm versioned release label), a no-JS / hardened-browser fallback, and this Data & sources page." },
  { v: "v5.0.19", note: "Unified provenance vocabulary — one source badge (NODE / COINGECKO / SESSION / MODEL), rendered the same way on every data surface." },
  { v: "v5.0.18", note: "Moved the “not live network data” disclaimer off the simulators and onto the node / peer surface where it belongs." },
  { v: "v5.0.17", note: "Markets resilience — jittered 429 backoff-retry before falling back to last-good cache — plus the paused peer placeholder." },
  { v: "v5.0.14", note: "Real-data purge: removed every simulated / illustrative surface; the educational simulators were code-split into the lazy /simulate chunk." },
];

/**
 * Merge the live `commits` feed with the curated overrides.
 *
 *   1. `auto` owns existence, order, and date — the output walks `auto` in
 *      the order the server sent it (newest-ship-date-first, never
 *      semver-sorted: a point release can legitimately land between two
 *      higher-numbered ones).
 *   2. Where a version appears in both, curated prose overwrites `note` and
 *      the entry is flagged `curated: true` — hand-written notes read
 *      better than a raw commit subject, and the swap must not be visible
 *      as a seam.
 *   3. A curated version outside the fetched window (e.g. v5.0.14 once the
 *      window slides past it) is appended after the auto-derived list, in
 *      CURATED's own order, so no curated note is ever silently dropped.
 *   4. `auto` null/empty ⇒ CURATED verbatim — the GitHub-unreachable /
 *      first-load fallback, byte-for-byte what the page rendered before
 *      this feed existed.
 *   5. Never semver-sorted, anywhere in this function.
 *   6. Output never repeats a `v` (the render keys rows by version).
 */
export function mergeReleases(
  auto: ReleaseNote[] | null,
  curated: ReadonlyArray<{ v: string; note: string }> = CURATED,
): ReleaseNote[] {
  if (!auto || auto.length === 0) return [...curated];

  const curatedByV = new Map(curated.map((c) => [c.v, c] as const));
  const seen = new Set<string>();
  const merged: ReleaseNote[] = [];

  for (const a of auto) {
    if (seen.has(a.v)) continue; // defensive — server already dedupes
    seen.add(a.v);
    const c = curatedByV.get(a.v);
    merged.push(c ? { ...a, note: c.note, curated: true } : { ...a });
  }

  for (const c of curated) {
    if (seen.has(c.v)) continue; // already covered by `auto` above
    seen.add(c.v);
    merged.push({ ...c, curated: true });
  }

  return merged;
}
