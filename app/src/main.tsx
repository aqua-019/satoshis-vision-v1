/**
 * main.tsx — browser entry. Mounts <App /> under a BrowserRouter.
 *
 * If you embed this app inside another runtime that already has a router,
 * import { App } from "./App" directly and skip this file. The real xmr.irish
 * feed is the unconditional default (see DataContext) — pass `useFeed` to App
 * only when a host runtime supplies its own MoneroLive source.
 */

import * as React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { App } from "./App";

// v6.0.2 visual system — import order is load-bearing:
//   base      · the v5 terminal-dense identity, unchanged
//   L3 ambient· aurora/dust/grain; owns the html+body background
//   L2 theme  · [data-theme="indigo"] chrome palette (+ classic identity)
//   L1 legibility · unconditional; loads LAST so no palette rule can
//                   override a readability rule
import "./styles.css";
import "./styles-ambient.css";
import "./styles-theme.css";
import "./styles-legibility.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element in index.html");

createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
