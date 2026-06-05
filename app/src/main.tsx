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
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element in index.html");

createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
