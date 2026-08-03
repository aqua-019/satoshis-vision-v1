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
import { RootBoundary } from "./design/RootBoundary";

// v6.0.2 visual system — import order is load-bearing:
//   base      · the v5 terminal-dense identity, unchanged
//   L3 ambient· aurora/dust/grain; owns the html+body background
//   L2 theme  · [data-theme="indigo"] chrome palette (+ classic identity)
//   motion    · view-transition pseudo-element policy (route slide, theme
//               crossfade, Future card→modal morph); between theme and
//               legibility so legibility still loads LAST, unconditionally
//   L1 legibility · unconditional; loads LAST so no palette rule can
//                   override a readability rule
import "./styles.css";
import "./styles-ambient.css";
import "./styles-theme.css";
import "./styles-motion.css";
import "./styles-legibility.css";

// v6.0.7 — boot defensively. Every failure path here used to end in a blank
// white page on Brave mobile / Tor:
//   · a missing #root threw uncaught (nothing rendered, nothing explained)
//   · a throw inside render() unwound with no boundary to catch it
// index.html ships a static #boot-fallback beside #root, hidden, revealed by a
// watchdog if nothing mounts. Mounting successfully is what cancels it.
const bootFallback = () => document.getElementById("boot-fallback");
const root = document.getElementById("root");

if (!root) {
  // No container at all. Nothing to render into, so surface the static
  // fallback immediately rather than throwing into a blank page.
  console.error("[xmr.irish] Missing #root element in index.html");
  bootFallback()?.removeAttribute("hidden");
} else {
  try {
    createRoot(root).render(
      <React.StrictMode>
        <RootBoundary>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </RootBoundary>
      </React.StrictMode>
    );
    // Proof that the MODULE bundle executed, which is a different claim from
    // "scripting is enabled". styles.css hides `.nav-noscript` on this flag:
    // NavTop's six section triggers are <button>s and the dropdown holding the
    // real links is absent while closed, so without that always-rendered list
    // 6 of the 13 prerendered routes have no anchor at all when the bundle is
    // blocked (Shields, a 404'd chunk over Tor) or scripting is off.
    // index.html's inline pre-paint script cannot serve as this signal — it
    // runs even when the module is blocked, which is exactly the case covered.
    document.documentElement.dataset.boot = "ok";

    // createRoot's initial commit is synchronous, so reaching this line means
    // we really did paint. Cancel the watchdog. (On a very slow boot the
    // watchdog may have already shown the fallback — hiding it here is what
    // makes that self-healing rather than sticky.)
    bootFallback()?.setAttribute("hidden", "");
  } catch (err) {
    // A synchronous throw out of render() — the boundary above never got to
    // mount, so it cannot help here. Reveal the fallback NOW rather than
    // leaving the user on a blank page for the rest of the 10s watchdog.
    console.error("[xmr.irish] mount failed, revealing boot fallback:", err);
    bootFallback()?.removeAttribute("hidden");
  }
}
