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
// R is scripts/routes.mjs's single authority for the 13 real route paths —
// see that file's header. ROUTE_TABLE and ROUTE_ORDER below are built from
// it rather than retyping path literals, the same discipline App.tsx and
// nav/ia.ts follow.
import { R } from "../../scripts/routes.mjs";

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
// route's key into the `resolved` Set above, and must agree with the key
// each lazy import's own `markChunkResolved(...)` call in App.tsx uses — a
// mismatch here silently disables transitions for that route (see this
// file's header). `handle: null` means "this route has no lazy chunk of its
// own to gate on" — the eager Home page (see the seed above) and the
// `/monero/future` redirect (generated from scripts/routes.mjs's REDIRECTS,
// same as the other 12 — it never renders a chunk of its own; it
// immediately re-routes via RedirectTo, not through this hook). Without this
// entry "/monero/future" would fall through to the `${R.MONERO}/:tab` match
// below and be treated as the Monero chunk, which is wrong: it is a redirect
// source, not a real MoneroPage load.
const ROUTE_TABLE: RouteObject[] = [
  { path: R.HOME, handle: "home" },
  { path: R.LIVE_MEMPOOL, handle: "mempool" },
  { path: `${R.LIVE_MEMPOOL}/tx/:txid`, handle: "mempool-tx" },
  { path: R.LIVE_MARKETS, handle: "markets" },
  { path: R.MARKETS_THESIS, handle: "markets-thesis" },
  { path: R.LIVE_NETWORK, handle: "network" },
  { path: R.LEARN, handle: "education" },
  { path: `${R.LEARN}/:tab`, handle: "education" },
  { path: R.LEARN_SIM, handle: "simulate" },
  { path: R.MONERO, handle: "monero" },
  { path: "/monero/future", handle: null },
  { path: `${R.MONERO}/:tab`, handle: "monero" },
  { path: R.FUTURE, handle: "future" },
  { path: R.FUTURE_OUTLOOK, handle: "outlook" },
  // p4·06 — the `?p=` surface needs NO row of its own: chunkKeyFor strips the
  // query before matching, so all five protocol URLs resolve through this one
  // path. The handle must equal App.tsx's markChunkResolved key, which p4·04
  // recorded the hard way when a missing row made a page's transition wait on
  // the 404 chunk.
  { path: R.FUTURE_PROTOCOL, handle: "protocol" },
  { path: R.OPERATE_NODE, handle: "node" },
  { path: R.OPERATE_MINE, handle: "mine" },
  // p4·04 — BACKFILL, not a new registration. `/operate/superstress` shipped
  // in p3·16 with no row here, so `matchRoutes` fell through to the `*` row
  // below and `chunkKeyFor("/operate/superstress")` answered "notfound" —
  // while App.tsx registers that page's chunk under the key "superstress".
  // The hub's transition was therefore gated on whether the 404 page's chunk
  // had loaded: a true answer to the wrong question, which is exactly what
  // this table's own header warns a mismatched handle does.
  { path: R.OPERATE_SUPERSTRESS, handle: "superstress" },
  { path: R.OPERATE_PEERS, handle: "peers" },
  { path: R.ABOUT_SOURCES, handle: "sources" },
  { path: R.ABOUT_SITE, handle: "site" },
  { path: "*", handle: "notfound" },
];

// Direction for the slide, in the new nav order (nav/ia.ts's IA section
// order: Live → Monero → Learn → Future → Operate → About), not R's own
// declaration order in scripts/routes.mjs — Monero sits right after the
// three Live surfaces here, ahead of Learn. Purely cosmetic: an unranked
// pathname (a deep link like a mempool txid, or the `/monero/future`
// redirect) just always reads as "forward" rather than picking a direction
// that means nothing.
const ROUTE_ORDER = [
  R.HOME,
  R.LIVE_MEMPOOL, R.LIVE_MARKETS, R.MARKETS_THESIS, R.LIVE_NETWORK,
  R.MONERO,
  R.LEARN, R.LEARN_SIM,
  R.FUTURE, R.FUTURE_OUTLOOK, R.FUTURE_PROTOCOL,
  R.OPERATE_NODE, R.OPERATE_MINE, R.OPERATE_SUPERSTRESS, R.OPERATE_PEERS,
  R.ABOUT_SOURCES, R.ABOUT_SITE,
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
