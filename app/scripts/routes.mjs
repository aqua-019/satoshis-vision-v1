// routes.mjs — v6.1.0. The one place the site's static route list is written down.
//
// Why this file exists: this list used to live inline in prerender.mjs, and three
// more hand-maintained copies of it exist elsewhere (src/layout/NavTop.tsx NAV,
// src/design/RootBoundary.tsx ROUTES, verify-lib.mjs ROUTES). Every copy is a
// chance for the set to drift. Build-time consumers — the prerenderer and the
// sitemap generator — now share this one, so adding or removing a route is a
// single edit rather than a search-and-hope.
//
// It stays a .mjs data module rather than importing from App.tsx because App.tsx
// declares its routes as JSX <Route> elements, which is not something a Node
// build script can read without parsing TSX.

/**
 * Every route App.tsx serves that has a fixed path.
 *
 * v6.1.6 — 11 → 13 (the nav restructure): the old flat top-level paths
 * (/mempool, /markets, /network, /education, /simulate, /node, /peers,
 * /sources) move under six sections — Live / Monero / Learn / Future /
 * Operate / About — and gain two new real pages that used to be Monero tabs
 * (/live/markets/thesis, /future/outlook). Every old path still resolves: it
 * 301s server-side (vercel.json `redirects`) and is mirrored 1:1 by a
 * client-side <RedirectTo> in App.tsx, so it is never listed here — a
 * redirect source has no content of its own to prerender, and listing one in
 * the sitemap would advertise a URL that immediately jumps away from itself.
 * See vercel.json and App.tsx for the 12 old→new pairs.
 *
 * /live/mempool/tx/:txid is deliberately absent — it takes a txid parameter,
 * so there is no finite set of pages to emit. It keeps falling through to the
 * SPA shell, which is correct: a transaction lookup genuinely needs JS.
 *
 * /monero/future is also absent: it is a <RedirectTo> to /future (unchanged
 * in kind since v6.0.1, now travelling with the other 11 redirect sources
 * instead of standing alone) — prerendering it would emit a page whose only
 * content is a client-side jump, and listing it in the sitemap would
 * advertise a URL that never serves its own content.
 *
 * /learn/:tab and /monero/:tab are also absent, for the same reason
 * /education/:tab and /monero/:tab always were: each :tab is prerendered
 * individually by prerender.mjs walking the tab id lists in
 * pages/_education/tabs.ts and pages/monero/tabs.ts, not by this file — a
 * :param path has no single fixed URL to put in ROUTES. Likewise
 * /learn/sim?p=<id> (21 simulators) and /live/mempool?v=<view> (6 views) are
 * query-string variants of routes already listed here (/learn/sim,
 * /live/mempool), not additional entries.
 */
export const ROUTES = [
  "/",
  "/live/mempool",
  "/live/markets",
  "/live/markets/thesis",
  "/live/network",
  "/learn",
  "/learn/sim",
  "/monero",
  "/future",
  "/future/outlook",
  "/operate/node",
  "/about/peers",
  "/about/sources",
];

/**
 * Canonical production origin, no trailing slash.
 *
 * vercel.json sets `"trailingSlash": false`, so every URL except the root is
 * written without one — emitting `/markets/` would advertise a URL that 301s.
 */
export const SITE_ORIGIN = "https://xmr.irish";

/** Absolute URL for a route, honouring the trailingSlash:false rule. */
export function absoluteUrl(route) {
  return route === "/" ? SITE_ORIGIN + "/" : SITE_ORIGIN + route;
}
