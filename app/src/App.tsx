/**
 * App.tsx — react-router routes + DataProvider wrap.
 *
 * Want to plug your own live data? Pass `useFeed` to <DataProvider>.
 * See PORTING.md.
 */

import * as React from "react";
import { Routes, Route, useLocation } from "react-router-dom";

import { DataProvider } from "@/data/DataContext";
import { VisualProvider } from "@/design/VisualContext";
import { AmbientField } from "@/design/AmbientField";
import { RootBoundary } from "@/design/RootBoundary";
import { markChunkResolved } from "@/design/useViewTransitionNavigate";
import { NavTransitions } from "@/routes/NavTransitions";
import { RouteAnnouncer } from "@/routes/RouteAnnouncer";
import { RedirectTo } from "@/routes/RedirectTo";
// R (named route constants) + REDIRECTS (the 12 old->new pairs) are the
// single authority scripts/routes.mjs declares — see that file's header.
// Every <Route path> below reads through R rather than restating a path
// literal, and the 12 <RedirectTo> routes are GENERATED from REDIRECTS
// (below the real route table) rather than hand-typed one at a time.
import { R, REDIRECTS } from "../scripts/routes.mjs";
// HomePage stays EAGER. It is the LCP route — lazy-loading it would add a
// round trip to the exact metric this pass exists to improve.
import { HomePage } from "@/pages/HomePage";

// Everything else is route-split (v6.0.8). Before this, every visitor
// downloaded every page: the ten Monero tab modules, the whole /future card
// deck, the education chapters, the markets chart primitives — regardless of
// where they landed. `/simulate` had been the lone exception since v5.0.14;
// this extends that pattern to the rest of the router.
//
// Named exports need the `.then` unwrap; SimulatePage is a default export.
// Each `.then()` also calls `markChunkResolved(key)` — a side effect, not
// part of the unwrap — recording in useViewTransitionNavigate.ts's
// module-level Set that this chunk's real content has actually finished
// downloading and evaluating. That Set is what lets a route navigation know
// whether it is safe to view-transition into (chunk already resolved) or
// must fall back to a plain navigate (first visit — see that hook's header
// for why a naive transition here would morph into the Suspense fallback).
const MempoolPage        = React.lazy(() => import("@/pages/MempoolPage").then((m) => { markChunkResolved("mempool"); return { default: m.MempoolPage }; }));
const MempoolTxPage      = React.lazy(() => import("@/pages/MempoolTxPage").then((m) => { markChunkResolved("mempool-tx"); return { default: m.MempoolTxPage }; }));
const MarketsPage        = React.lazy(() => import("@/pages/MarketsPage").then((m) => { markChunkResolved("markets"); return { default: m.MarketsPage }; }));
const MarketsThesisPage  = React.lazy(() => import("@/pages/markets/MarketsThesisPage").then((m) => { markChunkResolved("markets-thesis"); return { default: m.MarketsThesisPage }; }));
const NetworkPage        = React.lazy(() => import("@/pages/NetworkPage").then((m) => { markChunkResolved("network"); return { default: m.NetworkPage }; }));
const EducationPage      = React.lazy(() => import("@/pages/EducationPage").then((m) => { markChunkResolved("education"); return { default: m.EducationPage }; }));
const MoneroPage         = React.lazy(() => import("@/pages/MoneroPage").then((m) => { markChunkResolved("monero"); return { default: m.MoneroPage }; }));
const FuturePage         = React.lazy(() => import("@/pages/FuturePage").then((m) => { markChunkResolved("future"); return { default: m.FuturePage }; }));
const OutlookPage        = React.lazy(() => import("@/pages/future/OutlookPage").then((m) => { markChunkResolved("outlook"); return { default: m.OutlookPage }; }));
const TrustedPeersPage   = React.lazy(() => import("@/pages/TrustedPeersPage").then((m) => { markChunkResolved("peers"); return { default: m.TrustedPeersPage }; }));
const NodePage           = React.lazy(() => import("@/pages/NodePage").then((m) => { markChunkResolved("node"); return { default: m.NodePage }; }));
const MinePage           = React.lazy(() => import("@/pages/MinePage").then((m) => { markChunkResolved("mine"); return { default: m.MinePage }; }));
const SuperstressPage    = React.lazy(() => import("@/pages/SuperstressPage").then((m) => { markChunkResolved("superstress"); return { default: m.SuperstressPage }; }));
const SourcesPage        = React.lazy(() => import("@/pages/SourcesPage").then((m) => { markChunkResolved("sources"); return { default: m.SourcesPage }; }));
const NotFoundPage       = React.lazy(() => import("@/pages/NotFoundPage").then((m) => { markChunkResolved("notfound"); return { default: m.NotFoundPage }; }));
const SimulatePage       = React.lazy(() => import("@/pages/SimulatePage").then((m) => { markChunkResolved("simulate"); return m; }));

// v6.1.8 cold boot (app/src/coldboot/ColdBoot.tsx) — lazy so the splash costs
// HomePage's eager entry chunk nothing; `fallback={null}` is also what makes
// prerendering (renderToString, which never awaits a lazy import) resolve to
// "nothing here" for this boundary rather than a "loading…"-shaped string
// that would trip the prerenderer's own SUSPENDED_RE resolution loop.
const ColdBoot = React.lazy(() => import("@/coldboot/ColdBoot").then((m) => ({ default: m.ColdBoot })));

// The orb is mounted as its OWN sibling, deliberately NOT inside <ColdBoot>.
// A ColdBoot-owned orb would unmount the instant ColdBoot reaches phase
// "done" — which is exactly when the Enter handoff completes — and
// verify-coldboot §4 requires [data-orb] to be the SAME node before and
// after Enter, persisting and moving. Mounting it here makes "the orb
// survives the collapse" true by construction: nothing has to remember not
// to unmount it, because nothing is in a position to. The rect flows the
// other way, via ColdBoot's exported useColdBootOrbState().
const Orb = React.lazy(() => import("@/coldboot/Orb").then((m) => ({ default: m.Orb })));

/**
 * Renders children only on `/`. A wrapper rather than an early return inside
 * Orb itself, because a guard inside the component runs AFTER its hooks —
 * React requires a stable hook order, so `useOrbData()` and its `/api/nodes`
 * subscription would still execute on every route before the component could
 * decline to render. Gating at the mount point is what actually skips the
 * work, and it also stops the orb's lazy chunk being fetched at all off-Home,
 * which is the half that matters on Slow-4G.
 */
function HomeOnly({ children }: { children: React.ReactNode }) {
  return useLocation().pathname === R.HOME ? <>{children}</> : null;
}

export interface AppProps {
  /** Swap in your own MoneroLive hook from the host runtime. */
  useFeed?: Parameters<typeof DataProvider>[0]["useFeed"];
}

export function App({ useFeed }: AppProps = {}) {
  return (
    // AmbientField (design/AmbientField.tsx) is a sibling of <Routes>, not a
    // descendant of any page's `.art` (isolation: isolate) — see that
    // file's header for why. DataProvider renders no DOM element of its own,
    // so this nesting still puts AmbientField's actual DOM output directly
    // beside whatever the active route renders.
    <VisualProvider>
      <AmbientField />
      <NavTransitions />
      <DataProvider useFeed={useFeed}>
        {/* v6.1.8 cold boot — INSIDE DataProvider: ColdBoot renders
            <ColdBootConsole>, which reads useMoneroLive() and therefore
            throws outside this provider (caught the hard way — see the
            return notes). Sibling of <AmbientField/> is about z-order/DOM
            position, not about which provider wraps it. */}
        <React.Suspense fallback={null}>
          <ColdBoot />
        </React.Suspense>
        {/* Sibling of <ColdBoot/>, not a child — see the Orb declaration above.
            Its own boundary too, so a slow orb chunk can never delay the
            splash root appearing, and vice versa.

            HOME-ONLY, and this is a measured fix rather than tidiness. The orb
            previously mounted on EVERY route and merely hid itself with
            display:none — so on /live/mempool it still fetched its lazy chunk,
            subscribed useNodePopulation (an /api/nodes request) and
            useFeedEvents, and ran its hooks, all to render nothing. Under
            verify-vitals' 6x CPU + Slow-4G profile that cost /live/mempool
            about a second of LCP: 3010ms historically, 4036ms measured against
            a 4000ms budget, on a run whose CPU probe (247ms) was inside the
            contention threshold, so it was a real regression and not noise.

            Unmounting on a route change is safe for verify-coldboot §4, which
            requires [data-orb] to be the same node before and after ENTER —
            that handoff happens entirely within `/`, and the route never
            changes during it. */}
        <HomeOnly>
          <React.Suspense fallback={null}>
            <Orb />
          </React.Suspense>
        </HomeOnly>
        {/* D0745 — the route announcer is a SIBLING of <Suspense>, not a
            descendant of any page. A live region has to be in the DOM BEFORE
            the text it announces changes; one that is created in the same
            commit as its content is not reliably read out. AppShell (which
            remounts per route) is therefore the one place it could not go. */}
        <RouteAnnouncer />
        {/* ONE boundary for the whole router rather than one per route. With a
            single lazy route the per-route <Suspense> was fine; at eleven it is
            eleven copies of the same fallback. Placing it outside <Routes> also
            means a navigation between two lazy routes shows the fallback once,
            in one place, instead of unmounting and remounting a boundary.

            DELIBERATELY UNRESERVED, measured rather than assumed. v6.1.5 PR B
            set out to give this fallback and /simulate's a reserved box, on the
            theory that a ~100px fallback replacing a full-viewport route must
            shift layout. It does not, on either path:

              cold load  — React 18 keeps the prerendered HTML for a boundary
                           that suspends during hydration, so the fallback is
                           never painted. All six routes in verify-cls read
                           0.0000-0.0012 behind these unreserved fallbacks.
              client nav — measured directly (verify-cls only ever cold-loads,
                           so no committed gate covers this): 0.0001 with and
                           without a `min-height` reserve, 3 runs each, to both
                           /markets and /simulate.

            And the null result is not vacuous — the treatment demonstrably
            engaged. The probe captured "loading…", "loading simulators…" and
            "loading simulator…" actually rendering, with `main` swinging
            0..4786px across the swap. A route change REPLACES nodes rather than
            moving them, and layout-shift scores moved elements, so the swap
            produces no entries to score.

            If you add a reserve here, measure first. */}
        <React.Suspense fallback={<div className="mono dim" style={{ padding: 40 }}>loading…</div>}>
        <Routes>
          {/* ── Live ─────────────────────────────────────────────── */}
          <Route path={R.HOME}                            element={<HomePage />} />
          <Route path={R.LIVE_MEMPOOL}                     element={<MempoolPage />} />
          <Route path={`${R.LIVE_MEMPOOL}/tx/:txid`}       element={<MempoolTxPage />} />
          <Route path={R.LIVE_MARKETS}                     element={<MarketsPage />} />
          <Route path={R.MARKETS_THESIS}                   element={<MarketsThesisPage />} />
          <Route path={R.LIVE_NETWORK}                     element={<NetworkPage />} />

          {/* ── Learn ────────────────────────────────────────────── */}
          <Route path={R.LEARN}                            element={<EducationPage />} />
          <Route path={`${R.LEARN}/:tab`}                  element={<EducationPage />} />
          {/* v6.0.7: the lazy chunk needs an error boundary, not just Suspense.
              Suspense handles "still loading"; it does NOT handle "the fetch
              failed" — that throw propagated uncaught and blanked the whole app.
              A dropped chunk is a routine Tor outcome, so this degrades to an
              inline message and leaves every other route working. */}
          <Route path={R.LEARN_SIM}  element={
            <RootBoundary inline={() => (
              <div className="mono dim" style={{ padding: 40 }}>
                the simulators failed to load — this is usually a blocked or dropped
                request. <a href={R.LEARN_SIM}>Retry</a>, or carry on with the rest of the site.
              </div>
            )}>
              <React.Suspense fallback={<div className="mono dim" style={{ padding: 40 }}>loading simulators…</div>}><SimulatePage /></React.Suspense>
            </RootBoundary>
          } />

          {/* ── Monero ───────────────────────────────────────────── */}
          <Route path={R.MONERO}                           element={<MoneroPage />} />
          <Route path={`${R.MONERO}/:tab`}                 element={<MoneroPage />} />

          {/* ── Future ───────────────────────────────────────────── */}
          <Route path={R.FUTURE}                           element={<FuturePage />} />
          <Route path={R.FUTURE_OUTLOOK}                   element={<OutlookPage />} />

          {/* ── Operate ──────────────────────────────────────────── */}
          <Route path={R.OPERATE_NODE}                     element={<NodePage />} />
          <Route path={R.OPERATE_MINE}                     element={<MinePage />} />
          <Route path={R.OPERATE_SUPERSTRESS}              element={<SuperstressPage />} />

          {/* ── About ────────────────────────────────────────────── */}
          <Route path={R.ABOUT_PEERS}                      element={<TrustedPeersPage />} />
          <Route path={R.ABOUT_SOURCES}                    element={<SourcesPage />} />

          {/* ── Redirects · the 12 old paths, generated from REDIRECTS ──
              (scripts/routes.mjs — vercel.json's server 301s mirrored 1:1).
              Static segments outrank a `:param` in react-router v6 by
              specificity, not declaration order, so e.g. /monero/future
              (in this list) wins over /monero/:tab (above) regardless of
              where either is written. RedirectTo owns :param substitution
              and search/hash preservation — see that file's header. */}
          {REDIRECTS.map(({ from, to }) => (
            <Route key={from} path={from} element={<RedirectTo to={to} />} />
          ))}

          <Route path="*"          element={<NotFoundPage />} />
        </Routes>
        </React.Suspense>
      </DataProvider>
    </VisualProvider>
  );
}
