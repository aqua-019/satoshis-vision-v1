/**
 * nav/usePrefetch.ts — D0724 hover prefetch: warms the browser's HTTP cache
 * for a nav section's first destination the moment its dropdown ACTUALLY
 * OPENS.
 *
 * ── WHY THIS EXISTS ALONGSIDE index.html's <script type="speculationrules"> ──
 * Speculation Rules is Chromium-only. Tor Browser is Firefox ESR, and Firefox
 * has never shipped the API — so the site's primary audience gets zero
 * benefit from the inline block, the same asymmetry CLAUDE.md already records
 * for View Transitions ("the fallback is the MAIN path"). This hook is that
 * fallback: a same-origin fetch() reaches every engine, including the one
 * speculation rules cannot.
 *
 * ── WHY fetch() OVER `<link rel="prefetch">` ──────────────────────────────
 *   - WebKit/Safari has never implemented rel=prefetch, and Firefox's support
 *     is inconsistent across versions — fetch() works everywhere connect-src
 *     'self' already reaches, which is exactly the audience this hook exists
 *     to cover.
 *   - No DOM node to insert, track and clean up — nothing for
 *     verify-degraded.mjs's <head>/<body> ordering assertions to trip over,
 *     and nothing left behind if a hover cascade opens six sections in a row.
 *   - A rejected fetch (offline, a dropped Tor circuit, a node cascade
 *     hiccup) is silently swallowed; the eventual real request from an actual
 *     click just retries normally. One failure mode, not an engine-dependent
 *     one.
 *
 * ── WHAT IT FETCHES, AND WHEN ──────────────────────────────────────────────
 * `prefetchSection(key)` resolves `IA` section `key`'s `cols[0].items[0].p` —
 * the exact URL `NavTop.tsx`'s `onItemClick` already navigates to on a plain
 * section click — so hovering a section warms precisely the document its own
 * first link (or the section click itself) will need. Every one of those six
 * URLs is one of the 13 canonical routes in scripts/routes.mjs, so it is
 * always a real prerendered document, never a `?v=`/`?p=`/`?range=` variant
 * only the SPA shell can answer.
 *
 * The call site is NavTop.tsx's `openKey` transition, not a new timer: D1542
 * hover-intent already gates "is this a real hover or a fast crossing" behind
 * HOVER_OPEN_MS, and `openKey` only becomes non-null once that timer (or an
 * ArrowDown open) has actually fired. Piggy-backing on that state change is
 * what "reuse that mechanism, don't add a second timing system" means in
 * practice — this file owns no setTimeout of its own.
 *
 * ── DEDUPE ──────────────────────────────────────────────────────────────
 * A module-level Set, the same pattern
 * design/useViewTransitionNavigate.ts's `resolved` uses — one fetch per URL
 * per session, not per hover.
 *
 * ── GUARDS ──────────────────────────────────────────────────────────────
 *   - `navigator.connection?.saveData` — the visitor asked for less data; a
 *     speculative fetch is exactly the request that should not happen.
 *   - `getDeviceTier() === "low" && !prefersReducedMotion()` — NOT a bare
 *     tier check. deviceTier.ts folds `prefers-reduced-motion` into `"low"`,
 *     so a bare `tier === "low"` veto would also silently cancel prefetching
 *     for every reduced-motion visitor — the exact `vtSupported()` bug
 *     CLAUDE.md records as having shipped once already. Reduced motion is a
 *     statement about animation, not about data budget, so it must not gate
 *     a network fetch on its own.
 */

import * as React from "react";

import { getDeviceTier, prefersReducedMotion } from "@/design/deviceTier";
import { IA } from "./ia";

/** `navigator.connection` is not in lib.dom for this repo's pinned TS
 *  version (see deviceTier.ts's own PerfNavigator) — same narrow, optional
 *  shape rather than an `any` cast. */
interface PerfNavigator extends Navigator {
  connection?: { saveData?: boolean };
}

const fetched = new Set<string>();

/** Test/debug seam only — no production caller. Mirrors
 *  useViewTransitionNavigate.ts's resetResolvedChunksForTests. */
export function resetPrefetchedForTests(): void {
  fetched.clear();
}

function prefersSaveData(): boolean {
  try {
    return (navigator as PerfNavigator).connection?.saveData === true;
  } catch {
    return false;
  }
}

/** Returns a stable callback — `prefetchSection(sectionKey)` — for a caller
 *  to invoke exactly where a dropdown transitions from closed to open. */
export function usePrefetch(): (sectionKey: string) => void {
  return React.useCallback((sectionKey: string) => {
    if (prefersSaveData()) return;
    // See file header: this is deliberately NOT `getDeviceTier() === "low"`.
    if (getDeviceTier() === "low" && !prefersReducedMotion()) return;

    const section = IA.find((s) => s.key === sectionKey);
    const url = section?.cols[0]?.items[0]?.p;
    if (!url || fetched.has(url)) return;
    fetched.add(url);

    fetch(url, { mode: "same-origin", credentials: "same-origin" }).catch(() => {
      // A failed prefetch is not a failed navigation — see file header.
    });
  }, []);
}
