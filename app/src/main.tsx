/**
 * main.tsx — browser entry. Mounts <App /> under a BrowserRouter.
 *
 * If you embed this app inside another runtime that already has a router,
 * import { App } from "./App" directly and skip this file.
 */

import * as React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { App } from "./App";
import { useXmrIrishFeed } from "./data/xmrirish-feed";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element in index.html");

// Simulated stays the dev default. The live xmr.irish feed activates only when
// VITE_LIVE_DATA is set (and in production builds). With no env, `useFeed` is
// undefined and <DataProvider> falls back to the built-in simulator.
const useFeed = import.meta.env.VITE_LIVE_DATA ? useXmrIrishFeed : undefined;

createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter>
      <App useFeed={useFeed} />
    </BrowserRouter>
  </React.StrictMode>
);
