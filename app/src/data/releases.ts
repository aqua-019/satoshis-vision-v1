/**
 * data/releases.ts — the release-notes list on the Sources page.
 *
 * `CURATED` + `mergeReleases`. `CURATED` is the five hand-written entries that
 * used to be a hardcoded `RELEASES` array on SourcesPage.tsx (moved here
 * verbatim, including their typographic quotes/dashes) and now serve two
 * roles: an editorial override on top of the live feed (curated prose reads
 * better than a raw upstream subject), and the offline fallback when GitHub is
 * unreachable ("last-good, never synthesis" — see README.md and
 * useCachedFeed.ts's header comment).
 *
 * ── THIS MODULE MUST STAY LAZY ──────────────────────────────────────────
 * Its only importer is `pages/SourcesPage.tsx`, which is `React.lazy`. Keep it
 * that way. `SITE_VERSION` used to live here, and because `NavTop` (eager)
 * imports it, all five curated notes shipped in the entry chunk on every
 * route — measured at `bda0491` as five prose strings each greping to exactly
 * 1 in the served `dist/assets/index-*.js`. p3·17 moved the version identity
 * to `data/siteVersion.ts`; importing this module from anything eager puts the
 * prose straight back into first paint.
 *
 * This module deliberately RE-EXPORTS NOTHING from that leaf. A re-export
 * would be free at runtime (this module is lazy, the leaf is already in the
 * entry) but it creates a real import edge, and `verify-releases.mjs` loads
 * these sources through Node's type-stripping loader, where an extensionless
 * `./siteVersion` specifier does not resolve — Vite's resolver is more
 * forgiving than Node's, so an edge that builds fine can still break the gate.
 * Nothing needed the re-export: the only two consumers of the version identity
 * are `NavTop` (the leaf) and this gate (both modules, explicitly).
 */

/** True for a PR-keyed release id (`#186`), false for a version-keyed one
 *  (`v5.0.20`).
 *
 *  Lives HERE and not in the `siteVersion.ts` leaf on purpose: that leaf is
 *  reachable from the eager entry via NavTop, so everything added to it is paid
 *  for by all fourteen routes at first paint. Only this module and its gate
 *  need the predicate, and both are lazy/offline.
 *
 *  ONE definition on the client, shared by the merge and the render's era seam,
 *  so "which era is this entry from?" cannot be answered two slightly different
 *  ways. The SERVER builds the same shape independently in `api/feeds.js`
 *  (`mapPulls`) — a separate runtime that cannot import this, so the two are
 *  held together by `verify-releases.mjs` asserting the shape rather than by a
 *  shared symbol. */
export function isPrKeyed(v: string): boolean {
  return /^#\d+$/.test(v);
}

/** The release id for a pull request number. */
export function prReleaseId(n: number): string {
  return `#${n}`;
}

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
 *
 * ── TWO ERAS, ONE LIST (p3·17) ──────────────────────────────────────────
 * `auto` is now PR-keyed (`#186`) and `CURATED` is version-keyed (`v5.0.20`).
 * All six rules above are unchanged and still hold, because none of them reads
 * the SHAPE of `v` — they only compare it. Rule 2 (curated prose overrides a
 * shared version) simply never fires across the two eras, since a `#`-id and a
 * `v`-id can never collide; the existing assertions that pin rule 2 stay green
 * by exercising it within one era.
 *
 * What the eras DO require is that the boundary be visible. `mergeReleases`
 * dedupes but does not detect gaps, and the jump from `#186` to `v5.0.20`
 * skips the unversioned #146–#185 era AND the whole v6.0.x–v6.1.9 era. See
 * `eraSeamIndex` below — the render draws a labelled discontinuity there
 * rather than letting a reader infer that `v5.0.20` shipped just before `#186`.
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

/**
 * Index of the first version-keyed entry that follows at least one PR-keyed
 * entry — i.e. where the era changes — or `-1` when the list is all one era.
 *
 * Returning `-1` for a single-era list is the whole point: with the automatic
 * feed dead the list is curated-only, and drawing a "versioned releases below"
 * divider above the FIRST row would announce a discontinuity that is not there.
 * A seam marker that renders unconditionally is decoration; this one is a
 * claim, so it may only appear when both eras are actually present.
 *
 * Scans for the transition rather than assuming the list is sorted era-first:
 * `mergeReleases` walks `auto` in server order and appends curated-only
 * entries after, so era-first is TRUE today — but it is a property of the
 * caller, not of this function, and a lookup that quietly depends on it would
 * be wrong the day a curated note lands inside the fetched window.
 */
export function eraSeamIndex(list: ReadonlyArray<{ v: string }>): number {
  let sawPr = false;
  for (let i = 0; i < list.length; i++) {
    if (isPrKeyed(list[i].v)) { sawPr = true; continue; }
    if (sawPr) return i;
  }
  return -1;
}
