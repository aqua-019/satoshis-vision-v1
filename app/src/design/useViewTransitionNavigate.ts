/**
 * design/useViewTransitionNavigate.ts — a `navigate`-shaped function that
 * upgrades a route change into a view transition, but ONLY once, per route,
 * per session: the first visit to any lazy route.
 *
 * The trap this exists to dodge: 12 of App.tsx's 13 pages are `React.lazy`
 * under one shared `<Suspense>`. `React.lazy`'s payload cannot be warmed
 * from outside — its initializer sets `_status = Pending` and throws the
 * thenable on first invocation even when the module is already sitting in
 * the registry, because `.then()` resolves on a microtask, not
 * synchronously. So a naive `startViewTransition(() => navigate(to))`
 * captures the shared Suspense fallback ("loading…") as the AFTER snapshot
 * on every first navigation to a route — the view transition would morph
 * INTO a loading spinner, then the real page would pop in underneath once
 * the chunk resolves, with no further transition to smooth that second jump.
 *
 * The fix does not touch `React.lazy` (considered and rejected — see
 * App.tsx's comment: replacing it would sit under all 13 routes,
 * prerender.mjs and verify-nojs.mjs for a Chrome-only enhancement). Instead,
 * `App.tsx`'s 12 lazy imports each call `markChunkResolved(key)` from their
 * own `.then()`, recording "this chunk's real content is actually in memory
 * now" in the module-level `resolved` Set below. This hook consults that Set
 * before ever calling `startVt`:
 *
 *   - route resolved before  → `startVt('route', dir, () => flushSync(...))`
 *   - route never visited yet → plain `navigate(to)`, no transition at all
 *
 * A route's first visit never morphs; every later visit does. That is the
 * same category of degradation as "a browser without View Transition support
 * falls through to `update()` directly" in design/viewTransition.ts — this
 * hook adds a second, orthogonal reason `startVt` might not be reached, and
 * `startVt` itself stays the only place that touches the platform API.
 */

import * as React from "react";
import { flushSync } from "react-dom";
import { useLocation, useNavigate, matchRoutes, type RouteObject } from "react-router-dom";

import { startVt } from "./viewTransition";

const resolved = new Set<string>();

// HomePage is EAGER (App.tsx keeps it off React.lazy — it is the LCP route),
// so its real content is synchronously available on every render; there is
// no "fallback capture" risk to guard against for it. Seeding it here rather
// than special-casing `path === "/"` in navigate() below keeps exactly ONE
// mechanism ("is this chunk's real content in the Set") instead of two.
resolved.add("home");

/** Called once from each `React.lazy(() => import(...))`'s own `.then()` in
 *  App.tsx, at the moment that route's chunk has actually finished
 *  downloading and evaluating — not at declaration time. */
export function markChunkResolved(chunk: string): void {
  resolved.add(chunk);
}

/** Test/debug seam only — no production caller. Lets verify-motion.mjs (or a
 *  future unit test) exercise the "never visited" branch deterministically
 *  without needing a real chunk load to *not* have happened yet. */
export function resetResolvedChunksForTests(): void {
  resolved.clear();
  resolved.add("home");
}

// Mirrors App.tsx's <Routes> table. Order does not affect matching —
// `matchRoutes()` ranks by specificity itself (static segments outrank a
// `:param`), so this does not hand-roll that precedence — but keeping it in
// the same order as App.tsx makes the two easy to diff by eye.
//
// `handle` is react-router's own arbitrary-per-route-data extension point
// (the same field `useMatches()` reads); a string handle here is that
// route's key into the `resolved` Set above. `handle: null` means "this
// route has no lazy chunk of its own to gate on" — the eager Home page (see
// the seed above) and the `/monero/future` client-side `<Navigate>` redirect
// (which never renders a chunk; it immediately re-routes via its own
// internal mechanism, not through this hook).
const ROUTE_TABLE: RouteObject[] = [
  { path: "/", handle: "home" },
  { path: "/mempool", handle: "mempool" },
  { path: "/mempool/tx/:txid", handle: "mempool-tx" },
  { path: "/markets", handle: "markets" },
  { path: "/network", handle: "network" },
  { path: "/education", handle: "education" },
  { path: "/education/:tab", handle: "education" },
  { path: "/monero", handle: "monero" },
  { path: "/monero/future", handle: null },
  { path: "/monero/:tab", handle: "monero" },
  { path: "/future", handle: "future" },
  { path: "/peers", handle: "peers" },
  { path: "/simulate", handle: "simulate" },
  { path: "/node", handle: "node" },
  { path: "/sources", handle: "sources" },
  { path: "*", handle: "notfound" },
];

// Direction for the slide, in the same left-to-right order NavTop.tsx lists
// its links. Purely cosmetic: an unranked pathname (a deep link like
// `/mempool/tx/:txid`, or the `/monero/future` redirect) just always reads
// as "forward" rather than picking a direction that means nothing.
const ROUTE_ORDER = [
  "/", "/mempool", "/markets", "/network", "/monero", "/education",
  "/future", "/peers", "/simulate", "/node", "/sources",
];

function directionFor(fromPath: string, toPath: string): "fwd" | "back" {
  const fromIdx = ROUTE_ORDER.indexOf(fromPath);
  const toIdx = ROUTE_ORDER.indexOf(toPath);
  if (fromIdx === -1 || toIdx === -1) return "fwd";
  return toIdx >= fromIdx ? "fwd" : "back";
}

function chunkKeyFor(pathname: string): string | null {
  const matches = matchRoutes(ROUTE_TABLE, pathname);
  if (!matches || matches.length === 0) return null;
  const handle = matches[matches.length - 1].route.handle;
  return typeof handle === "string" ? handle : null;
}

export interface VtNavigateOptions {
  replace?: boolean;
}
export type VtNavigate = (to: string, opts?: VtNavigateOptions) => void;

/**
 * A `navigate`-shaped function: call it with a path (optionally carrying a
 * query string / hash) exactly like `useNavigate()`'s return value. Runs a
 * view transition when — and only when — the target route's lazy chunk has
 * already resolved once this session; falls back to a plain `navigate`
 * otherwise. `startVt` handles every other reason a transition might not
 * run (no platform support, low device tier, backgrounded tab) internally,
 * so nothing here needs to know about those cases.
 */
export function useViewTransitionNavigate(): VtNavigate {
  const navigate = useNavigate();
  const location = useLocation();

  return React.useCallback((to: string, opts?: VtNavigateOptions) => {
    // Strip query/hash — chunk identity and ROUTE_TABLE matching are both
    // path-only; `matchRoutes` wants a bare pathname.
    const targetPath = to.split("?")[0].split("#")[0];
    const key = chunkKeyFor(targetPath);

    if (key === null || !resolved.has(key)) {
      navigate(to, opts);
      return;
    }

    const dir = directionFor(location.pathname, targetPath);
    startVt("route", dir, () => {
      flushSync(() => navigate(to, opts));
    });
  }, [navigate, location.pathname]);
}
