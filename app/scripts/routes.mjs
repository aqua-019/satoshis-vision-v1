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
 * /mempool/tx/:txid is deliberately absent — it takes a txid parameter, so
 * there is no finite set of pages to emit. It keeps falling through to the
 * SPA shell, which is correct: a transaction lookup genuinely needs JS.
 *
 * /monero/future is also absent: it is a <Navigate> redirect to /future, so
 * prerendering it would emit a page whose only content is a client-side jump,
 * and listing it in the sitemap would advertise a URL that never serves its
 * own content.
 */
export const ROUTES = [
  "/",
  "/mempool",
  "/markets",
  "/network",
  "/education",
  "/monero",
  "/future",
  "/peers",
  "/simulate",
  "/node",
  "/sources",
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
