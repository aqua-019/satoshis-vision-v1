/**
 * App.tsx — react-router routes + DataProvider wrap.
 *
 * Want to plug your own live data? Pass `useFeed` to <DataProvider>.
 * See PORTING.md.
 */

import * as React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import { DataProvider } from "@/data/DataContext";
import { VisualProvider } from "@/design/VisualContext";
import { AmbientField } from "@/design/AmbientField";
import { RootBoundary } from "@/design/RootBoundary";
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
const MempoolPage      = React.lazy(() => import("@/pages/MempoolPage").then((m) => ({ default: m.MempoolPage })));
const MempoolTxPage    = React.lazy(() => import("@/pages/MempoolTxPage").then((m) => ({ default: m.MempoolTxPage })));
const MarketsPage      = React.lazy(() => import("@/pages/MarketsPage").then((m) => ({ default: m.MarketsPage })));
const NetworkPage      = React.lazy(() => import("@/pages/NetworkPage").then((m) => ({ default: m.NetworkPage })));
const EducationPage    = React.lazy(() => import("@/pages/EducationPage").then((m) => ({ default: m.EducationPage })));
const MoneroPage       = React.lazy(() => import("@/pages/MoneroPage").then((m) => ({ default: m.MoneroPage })));
const FuturePage       = React.lazy(() => import("@/pages/FuturePage").then((m) => ({ default: m.FuturePage })));
const TrustedPeersPage = React.lazy(() => import("@/pages/TrustedPeersPage").then((m) => ({ default: m.TrustedPeersPage })));
const NodePage         = React.lazy(() => import("@/pages/NodePage").then((m) => ({ default: m.NodePage })));
const SourcesPage      = React.lazy(() => import("@/pages/SourcesPage").then((m) => ({ default: m.SourcesPage })));
const NotFoundPage     = React.lazy(() => import("@/pages/NotFoundPage").then((m) => ({ default: m.NotFoundPage })));
const SimulatePage     = React.lazy(() => import("@/pages/SimulatePage"));

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
      <DataProvider useFeed={useFeed}>
        {/* ONE boundary for the whole router rather than one per route. With a
            single lazy route the per-route <Suspense> was fine; at eleven it is
            eleven copies of the same fallback. Placing it outside <Routes> also
            means a navigation between two lazy routes shows the fallback once,
            in one place, instead of unmounting and remounting a boundary. */}
        <React.Suspense fallback={<div className="mono dim" style={{ padding: 40 }}>loading…</div>}>
        <Routes>
          <Route path="/"          element={<HomePage />} />
          <Route path="/mempool"   element={<MempoolPage />} />
          <Route path="/mempool/tx/:txid" element={<MempoolTxPage />} />
          <Route path="/markets"   element={<MarketsPage />} />
          <Route path="/network"   element={<NetworkPage />} />
          <Route path="/education" element={<EducationPage />} />
          <Route path="/education/:tab" element={<EducationPage />} />
          <Route path="/monero"    element={<MoneroPage />} />
          {/* v6.0.1: the static Future tab was retired in favour of the live
              /future page. Static segments outrank the :tab param in v6, so this
              wins over /monero/:tab regardless of order. */}
          <Route path="/monero/future" element={<Navigate to="/future" replace />} />
          <Route path="/monero/:tab" element={<MoneroPage />} />
          <Route path="/future"    element={<FuturePage />} />
          <Route path="/peers"     element={<TrustedPeersPage />} />
          {/* v6.0.7: the lazy chunk needs an error boundary, not just Suspense.
              Suspense handles "still loading"; it does NOT handle "the fetch
              failed" — that throw propagated uncaught and blanked the whole app.
              A dropped chunk is a routine Tor outcome, so this degrades to an
              inline message and leaves every other route working. */}
          <Route path="/simulate"  element={
            <RootBoundary inline={() => (
              <div className="mono dim" style={{ padding: 40 }}>
                the simulators failed to load — this is usually a blocked or dropped
                request. <a href="/simulate">Retry</a>, or carry on with the rest of the site.
              </div>
            )}>
              <React.Suspense fallback={<div className="mono dim" style={{ padding: 40 }}>loading simulators…</div>}><SimulatePage /></React.Suspense>
            </RootBoundary>
          } />
          <Route path="/node"      element={<NodePage />} />
          <Route path="/sources"   element={<SourcesPage />} />
          <Route path="*"          element={<NotFoundPage />} />
        </Routes>
        </React.Suspense>
      </DataProvider>
    </VisualProvider>
  );
}
