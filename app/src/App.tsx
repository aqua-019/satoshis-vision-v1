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
import { MarketsPage } from "@/pages/MarketsPage";
import { NetworkPage } from "@/pages/NetworkPage";
import { EducationPage } from "@/pages/EducationPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { MoneroPage } from "@/pages/MoneroPage";
import { SimulatePage } from "@/pages/SimulatePage";
import { NodePage } from "@/pages/NodePage";
import { DesignPage } from "@/pages/DesignPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

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
        <Route path="/markets"   element={<MarketsPage />} />
        <Route path="/network"   element={<NetworkPage />} />
        <Route path="/education" element={<EducationPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/monero"    element={<MoneroPage />} />
        <Route path="/simulate"  element={<SimulatePage />} />
        <Route path="/node"      element={<NodePage />} />
        <Route path="/design"    element={<DesignPage />} />
        <Route path="*"          element={<NotFoundPage />} />
      </Routes>
    </DataProvider>
  );
}
