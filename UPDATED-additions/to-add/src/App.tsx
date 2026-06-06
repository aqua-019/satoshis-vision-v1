/**
 * App.tsx — CORRECTED routes for v5 (replaces repo/src/App.tsx).
 *
 * WHY THIS REPLACES THE SKELETON'S App.tsx:
 * The skeleton shipped a single `/dashboard` route. The authoritative 0.1 UI
 * (index.html + five01/src/app01/main.jsx `ROUTE_TABLE`) has NO dashboard —
 * Markets and Network are two SEPARATE top-level surfaces. This file fixes the
 * route table to match. See MISSING_IN_V5.md §3.
 *
 * Shipped nav order: Home · Mempool · Markets · Network · Monero · Education ·
 * Simulate · Run a node  (+ an internal ⌘ Design link).
 */

import * as React from "react";
import { Routes, Route } from "react-router-dom";

import { DataProvider } from "@/data/DataContext";
import { HomePage } from "@/pages/HomePage";
import { MempoolPage } from "@/pages/MempoolPage";
import { MarketsPage } from "@/pages/MarketsPage";   // NEW — see to-add/src/pages/MarketsPage.tsx
import { NetworkPage } from "@/pages/NetworkPage";   // NEW — see to-add/src/pages/NetworkPage.tsx
import { EducationPage } from "@/pages/EducationPage";
import { MoneroPage } from "@/pages/MoneroPage";     // REPLACE stub with the 10-tab port
import { SimulatePage } from "@/pages/SimulatePage";
import { NodePage } from "@/pages/NodePage";
import { NotFoundPage } from "@/pages/NotFoundPage";

export interface AppProps {
  /** Swap in your own MoneroLive hook (e.g. useXmrIrishFeed). */
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
        <Route path="/monero"    element={<MoneroPage />} />
        <Route path="/monero/:tab" element={<MoneroPage />} />{/* overview·origin·tech·legality·markets·comparison·attacks·future·bottomline·outlook */}
        <Route path="/education" element={<EducationPage />} />
        <Route path="/simulate"  element={<SimulatePage />} />
        <Route path="/node"      element={<NodePage />} />
        <Route path="*"          element={<NotFoundPage />} />
      </Routes>
    </DataProvider>
  );
}
