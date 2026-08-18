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
  // p4·06 — the SEVENTEENTH route, and the first route on this site whose
  // CONTENT is selected by a query parameter rather than by its path. One
  // route, five destinations (`?p=fcmp|seraphis|jamtis|carrot|cuprate`),
  // exactly the shape `/learn/sim?p=` already ships.
  //
  // WHY ONE ROUTE AND NOT FIVE. Five paths would be five ROUTES entries, five
  // prerendered files, five sitemap rows and five budget rows for five
  // renderings of one component over one array. The `?p=` surface is
  // deliberately NOT in ROUTES beyond this bare path — the same decision
  // `/learn/sim` records — so the bare path prerenders and the query is a
  // client concern. A reader arriving with no `?p=` gets the index of five.
  //
  // NO REDIRECT SOURCE: this URL has never existed. The ten `/future#<id>`
  // fragments it replaces were never server-visible (a fragment is not
  // transmitted), so there is nothing for a 301 to catch — see HASH_REDIRECTS.
  FUTURE_PROTOCOL: "/future/protocol",
  OPERATE_NODE: "/operate/node",
  // p3·16 — the FIRST route minted since the v6.1.6 restructure, and the
  // Operate section's second item. `/operate` itself is a section GROUPING
  // and has never been a route (see nav/ia.ts's header), so this is a new
  // leaf under an existing grouping rather than a new section.
  //
  // NO REDIRECT SOURCE, deliberately: REDIRECTS below protects URLs that
  // once served content and moved. This URL has never existed, so there is
  // no shared link to keep working and nothing to 301 from — inventing one
  // would advertise a path that never had a page.
  // p4·04 — the FIFTEENTH route, and the Operate section's third leaf. It is
  // declared BETWEEN the node page and the hub deliberately: running a node is
  // this page's stated prerequisite, and the hub is the packaged version of
  // what this page teaches by hand. R's declared order is therefore the
  // dependency order, and ROUTES — plus every list derived from it — inherits
  // it for free.
  //
  // NO REDIRECT SOURCE, for the reason OPERATE_SUPERSTRESS records below:
  // REDIRECTS protects URLs that once served content and moved, and this one
  // has never existed.
  OPERATE_MINE: "/operate/mine",
  OPERATE_SUPERSTRESS: "/operate/superstress",
  // p4·06 — MOVED from ABOUT_PEERS (`/about/peers`). The collaborator
  // directory is a list of things you RUN or USE, not a statement about this
  // site, so it belongs beside the node/mine/superstress leaves rather than
  // beside `/about/sources` and `/about/site`.
  //
  // Declared LAST in the Operate group, deliberately: `nav/ia.ts`'s section
  // header navigates to `cols[0].items[0].p`, so anything placed ahead of
  // `OPERATE_NODE` would silently move where clicking "Operate" goes. It is
  // also the one Operate leaf that is not a how-to, which is the reading
  // order the section already implies.
  //
  // THIS ONE DOES CARRY A REDIRECT SOURCE, unlike every other route added
  // since the restructure: `/about/peers` SERVED CONTENT and moved, which is
  // exactly the condition REDIRECTS exists for.
  OPERATE_PEERS: "/operate/peers",
  ABOUT_SOURCES: "/about/sources",
  // p4·05 — the SIXTEENTH route, and the About section's third leaf. It is
  // declared LAST in the About group deliberately: `ROUTES = Object.values(R)`
  // below inherits this order, `nav/ia.ts`'s About column navigates to
  // `cols[0].items[0].p`, and a new leaf placed first would silently move
  // where clicking "About" in the nav goes.
  //
  // NO REDIRECT SOURCE, for the reason OPERATE_SUPERSTRESS records above:
  // REDIRECTS protects URLs that once served content and moved, and this one
  // has never existed.
  ABOUT_SITE: "/about/site",
};

/**
 * The 17 routes App.tsx serves that have a fixed path, in R's declared
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
 * vercel.json restates these 12 as static JSON, because Vercel's config
 * format cannot import a module — verify-redirects.mjs is what proves the
 * two agree, in both directions, rather than a human eyeballing twelve rows
 * against twelve rows. (Both numbers read 13 until v6.1.6's review: 13 is
 * the ROUTES count directly above, and it got copied onto the redirect map,
 * which has never had 13 rows.)
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
 * 9 of these 13 fall directly out of the old→new path map; 3 more
 * (`/education/:tab`, `/mempool/tx/:txid`, `/monero/future`) are added for
 * completeness — Requirement 1 ("never break a shared link") already
 * requires them, so they are reported as real rows, never folded into "the
 * map's 9" or "13 of 9". The 13th (`/about/peers`) is p4·06's own move,
 * and is neither: it protects a URL this repo minted and then relocated.
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
  // p4·06 — REPOINTED, not left alone, and a gate is why. `/about/peers`
  // stopped being a route in this release, so leaving this row pointing at it
  // would make `/peers` the first hop of a TWO-HOP CHAIN — and verify-ia §6
  // ("every redirect destination resolves") reds on exactly that, because the
  // destination is no longer in ROUTES and sits under no route. One hop, one
  // 301, measured rather than tidied.
  { from: "/peers", to: R.OPERATE_PEERS },
  { from: "/sources", to: R.ABOUT_SOURCES },
  { from: "/mempool/tx/:txid", to: `${R.LIVE_MEMPOOL}/tx/:txid` },
  { from: "/monero/future", to: R.FUTURE },
  // p4·06 — the THIRTEENTH, and the first added since the restructure. Every
  // other row here protects a pre-v6.1.6 URL; this one protects a URL v6.1.6
  // itself minted and p4·06 moved. The rule is the same either way: a path
  // that once served content never 404s.
  { from: "/about/peers", to: R.OPERATE_PEERS },
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
