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
import { HomePage } from "@/pages/HomePage";
import { MempoolPage } from "@/pages/MempoolPage";
import { MempoolTxPage } from "@/pages/MempoolTxPage";
import { MarketsPage } from "@/pages/MarketsPage";
import { NetworkPage } from "@/pages/NetworkPage";
import { EducationPage } from "@/pages/EducationPage";
import { MoneroPage } from "@/pages/MoneroPage";
import { FuturePage } from "@/pages/FuturePage";
import { TrustedPeersPage } from "@/pages/TrustedPeersPage";
import { NodePage } from "@/pages/NodePage";
import { SourcesPage } from "@/pages/SourcesPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

// Lazy-loaded: /simulate pulls in all of @/protocols/** (the 15 educational
// simulators), which Vite splits into its own chunk via this dynamic import.
const SimulatePage = React.lazy(() => import("@/pages/SimulatePage"));

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
          <Route path="/simulate"  element={<React.Suspense fallback={<div className="mono dim" style={{ padding: 40 }}>loading simulators…</div>}><SimulatePage /></React.Suspense>} />
          <Route path="/node"      element={<NodePage />} />
          <Route path="/sources"   element={<SourcesPage />} />
          <Route path="*"          element={<NotFoundPage />} />
        </Routes>
      </DataProvider>
    </VisualProvider>
  );
}
