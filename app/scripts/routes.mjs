// routes.mjs — v6.1.6. The single authority for the site's route AND
// redirect maps.
//
// Why this file exists: a route list used to live inline in prerender.mjs,
// and hand-maintained copies of it exist elsewhere (src/layout/NavTop.tsx
// NAV, src/design/RootBoundary.tsx ROUTES, verify-lib.mjs ROUTES). Every copy
// is a chance for the set to drift. Build-time consumers — the prerenderer
// and the sitemap generator — share ROUTES; src/App.tsx, src/nav/ia.ts and
// src/pages/MoneroPage.tsx share R/REDIRECTS/HASH_REDIRECTS, so a route or a
// redirect pair is written down exactly once and everything else imports it.
// vercel.json is the one necessary exception — Vercel's config format cannot
// import a JS module — and verify-ia.mjs proves it agrees with REDIRECTS in
// both directions instead of trusting a human to keep the two in sync.
//
// It stays a .mjs data module rather than importing from App.tsx because
// App.tsx declares its routes as JSX <Route> elements, which is not something
// a Node build script can read without parsing TSX. A companion
// routes.d.mts gives TypeScript consumers under src/ real types for this
// file without turning on `allowJs` project-wide (tsconfig.json is out of
// scope for this change) — Node itself needs no such thing: routes.mjs is
// plain JS and every consumer here (prerender.mjs, gen-sitemap.mjs, and
// verify-ia.mjs importing src/nav/ia.ts, which in turn imports this file)
// runs it directly.

/**
 * Every static route, named. THE place a route path is written down — the
 * derived ROUTES array below, App.tsx's real <Route path> props, and
 * src/nav/ia.ts's leaves all read through this object rather than retyping
 * a path as a string literal.
 */
export const R = {
  HOME: "/",
  LIVE_MEMPOOL: "/live/mempool",
  LIVE_MARKETS: "/live/markets",
  MARKETS_THESIS: "/live/markets/thesis",
  LIVE_NETWORK: "/live/network",
  LEARN: "/learn",
  LEARN_SIM: "/learn/sim",
  MONERO: "/monero",
  FUTURE: "/future",
  FUTURE_OUTLOOK: "/future/outlook",
  OPERATE_NODE: "/operate/node",
  ABOUT_PEERS: "/about/peers",
  ABOUT_SOURCES: "/about/sources",
};

/**
 * The 13 routes App.tsx serves that have a fixed path, in R's declared
 * order. Consumed by prerender.mjs (emits dist/<route>/index.html, so the
 * site works with JS off) and gen-sitemap.mjs (emits sitemap.xml).
 *
 * ABSENT BY DESIGN — none of these has a single fixed URL to put here:
 *   - /live/mempool/tx/:txid, /learn/:tab, /monero/:tab — :param paths.
 *     prerender.mjs walks the tab id lists in pages/_education/tabs.ts and
 *     pages/monero/tabs.ts directly for the two :tab sets; a txid has no
 *     finite set to emit at all, so that path keeps falling through to the
 *     SPA shell — a transaction lookup genuinely needs JS.
 *   - /live/mempool?v=<view> (6 views), /learn/sim?p=<id> (21 simulators),
 *     /live/markets?range=<key> (4 ranges) — query-string variants of a
 *     route already listed here, not additional entries.
 *   - Every `from` in REDIRECTS below. A redirect source has no content of
 *     its own to prerender, and listing one in the sitemap would advertise
 *     a URL that immediately jumps away from itself.
 */
export const ROUTES = Object.values(R);

/**
 * Old URL → new home. THE place a redirect pair is written down.
 * vercel.json restates these 13 as static JSON, because Vercel's config
 * format cannot import a module — verify-ia.mjs is what proves the two
 * agree, in both directions, rather than a human eyeballing thirteen rows
 * against thirteen rows.
 *
 * A `to` carrying a `:name` segment means the matching `from` captured that
 * name as a route param — substitution happens in src/routes/RedirectTo.tsx
 * (via `useParams()`), not here: this table is plain data with no
 * react-router awareness, so it can be read by vercel.json's author (a
 * human) and by verify-ia.mjs (bare Node) with no framework in the loop.
 *
 * `/pro` is deliberately ABSENT. It never existed as a live route on this
 * site — it is mockup fiction, alongside the equally-fictional
 * `/operate/pro` — and Requirement 1 protects EXISTING URLs, not a map's
 * aspirational ones. verify-ia.mjs fails the build if either `/pro` or
 * `/operate/pro` reappears here.
 *
 * 9 of these 12 fall directly out of the old→new path map; 3 more
 * (`/education/:tab`, `/mempool/tx/:txid`, `/monero/future`) are added for
 * completeness — Requirement 1 ("never break a shared link") already
 * requires them, so they are reported as real rows, never folded into "the
 * map's 9" or "12 of 9".
 */
export const REDIRECTS = [
  { from: "/mempool", to: R.LIVE_MEMPOOL },
  { from: "/network", to: R.LIVE_NETWORK },
  { from: "/markets", to: R.LIVE_MARKETS },
  { from: "/education", to: R.LEARN },
  { from: "/education/:tab", to: "/learn/:tab" },
  { from: "/simulate", to: R.LEARN_SIM },
  { from: "/simulate/:id", to: `${R.LEARN_SIM}?p=:id` },
  { from: "/node", to: R.OPERATE_NODE },
  { from: "/peers", to: R.ABOUT_PEERS },
  { from: "/sources", to: R.ABOUT_SOURCES },
  { from: "/mempool/tx/:txid", to: `${R.LIVE_MEMPOOL}/tx/:txid` },
  { from: "/monero/future", to: R.FUTURE },
];

/**
 * Fragment redirects. A URL fragment is NEVER transmitted to a server, so
 * these cannot exist in vercel.json — they are client-only by construction.
 * pages/MoneroPage.tsx reads `location.hash` against this table and
 * navigates; see that file's header for why useRouteChrome doesn't fight it.
 */
export const HASH_REDIRECTS = [
  { hash: "markets-thesis", to: R.MARKETS_THESIS },
  { hash: "outlook", to: R.FUTURE_OUTLOOK },
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
