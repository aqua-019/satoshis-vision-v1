/**
 * App.tsx — react-router routes + DataProvider wrap.
 *
 * Want to plug your own live data? Pass `useFeed` to <DataProvider>.
 * See PORTING.md.
 */

import * as React from "react";
import { Routes, Route } from "react-router-dom";

import { DataProvider } from "@/data/DataContext";
import { HomePage } from "@/pages/HomePage";
import { MempoolPage } from "@/pages/MempoolPage";
import { MempoolTxPage } from "@/pages/MempoolTxPage";
import { MarketsPage } from "@/pages/MarketsPage";
import { NetworkPage } from "@/pages/NetworkPage";
import { EducationPage } from "@/pages/EducationPage";
import { MoneroPage } from "@/pages/MoneroPage";
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
        <Route path="/monero/:tab" element={<MoneroPage />} />
        <Route path="/simulate"  element={<React.Suspense fallback={<div className="mono dim" style={{ padding: 40 }}>loading simulators…</div>}><SimulatePage /></React.Suspense>} />
        <Route path="/node"      element={<NodePage />} />
        <Route path="/sources"   element={<SourcesPage />} />
        <Route path="*"          element={<NotFoundPage />} />
      </Routes>
    </DataProvider>
  );
}
