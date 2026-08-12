/**
 * views/index.tsx — registry for the mempool view-engine components.
 *
 * Holds the shared ViewProps contract and the 6 mempool surfaces
 * (src/mempool/*.tsx). The 21 protocol simulators are deliberately NOT here:
 * their component registry lives in views/protocols.tsx (reached only via the
 * lazy-loaded /simulate route, so @/protocols/* compiles into its own chunk)
 * and their pure metadata lives in views/protocol-meta.ts for main-chunk
 * consumers like the education card grid.
 */

import * as React from "react";
import type { MoneroLive } from "@/data/types";

export type { ProtocolMetaBase } from "./protocol-meta";

export interface ViewProps {
  data: MoneroLive;
  bg?: { intensity?: "calm" | "busy" | "chaotic"; scan?: boolean };
  /** Deep-link target block height (e.g. /mempool?block=123). Views may ignore. */
  focusBlock?: number | null;
  /** Called when a view's detail panel closes, so the page can drop ?block. */
  onClearFocus?: () => void;
}

export type ViewComponent = React.ComponentType<ViewProps>;

// ── Mempool views ──────────────────────────────────────────────

export interface MempoolViewMeta {
  id: string;
  label: string;
  sub: string;
  star?: boolean;
  /** Default to a fit-to-canvas-width scale on load (P1). The wide canvas views
   *  (reactor/bridge/sediment/constellation) opt in; Classic's intentional block
   *  ribbon and Terminal are excluded. */
  fit?: boolean;
  /** Reflows to the viewport on phones instead of panning inside the 900px-pinned
   *  box (styles.css:2502-2516). Classic and Orbital.
   *
   *  It is NOT "pure-DOM only", which is what this said while Classic was the sole
   *  member: the pin exists for views whose proportions are FIXED, and Orbital's
   *  canvas is fluid — `.mem-canvas` is `position: absolute; inset: 0` inside a
   *  host whose height is derived from its measured width, so it has no authored
   *  width to preserve and reflowing costs it nothing. Terminal deliberately KEEPS
   *  the pin: its shell is `1fr 320px` with 8-column readouts, so unpinned it
   *  squeezes to an unreadable sliver instead of panning at desktop proportions. */
  reflow?: boolean;
  Component: ViewComponent;
}

/**
 * v6.0.8: each view is `React.lazy`, so the six engines compile into six
 * chunks instead of riding the main bundle.
 *
 * MempoolPage mounts exactly ONE of these (selected by `?v=`, default
 * `classic`) but statically importing all six meant every visitor to any
 * route downloaded `reactor` (457 lines), `bridge` (493), `classic` (608),
 * `constellation`, `sediment` and `terminal` whether they opened /mempool or
 * not.
 *
 * `Component` is a lazy reference, NOT a call — reading `meta.Component` to
 * build the switcher's button list is a plain property read and does not
 * start a fetch. React only invokes the importer when the element is actually
 * rendered, which is why the switcher can map over all six for labels while
 * only the active one's chunk loads. (This is the reason the registry keeps
 * `label`/`sub`/`star`/`fit` as plain data next to the component rather than
 * reaching into the module for them — same separation `protocol-meta.ts`
 * already makes for the simulators, see this file's header.)
 */
export const lazyView = (load: () => Promise<{ [k: string]: unknown }>, name: string): ViewComponent =>
  React.lazy(async () => ({ default: (await load())[name] as ViewComponent }));

export const MEMPOOL_VIEWS: MempoolViewMeta[] = [
  { id: "reactor",       label: "Reactor",       sub: "3D iso · hex lattice · ring fan",  star: false, fit: true,
    Component: lazyView(() => import("@/mempool/reactor"), "ReactorView") },
  // v2·5: "12-pane" was already wrong before the rebuild — the shipped view had
  // seven panels and a stat row. Recounted, not adjusted: radar · instrument
  // bank · alert tape · oscilloscope · cadence · console · pool attribution.
  { id: "bridge",        label: "Ops Bridge",    sub: "7-panel mission control",           star: false, fit: true,
    Component: lazyView(() => import("@/mempool/bridge"), "BridgeView") },
  { id: "sediment",      label: "Sediment",      sub: "vertical core-sample tube",         star: false, fit: true,
    Component: lazyView(() => import("@/mempool/sediment"), "SedimentView") },
  { id: "constellation", label: "Constellation", sub: "luminous network sphere",           star: false, fit: true,
    Component: lazyView(() => import("@/mempool/constellation"), "ConstellationView") },
  // p2·7: the first NET-NEW view of the eleven, and the first hero surface that
  // is neither scaled nor panned — `fit: false` + `reflow: true`, so naturalW
  // settles at canvasW at every viewport and authored 11px renders at 11px,
  // including at 390. See orbital.tsx's header for why that is available to
  // this composition and not to reactor/bridge.
  { id: "orbital",       label: "Orbital",       sub: "fee rings · age bearing",           star: false, reflow: true,
    Component: lazyView(() => import("@/mempool/orbital"), "OrbitalView") },
  { id: "terminal",      label: "Terminal",      sub: "cli-first · monerod tail",          star: false,
    Component: lazyView(() => import("@/mempool/terminal"), "TerminalHubView") },
  { id: "classic",       label: "Classic",       sub: "explorer · tx + block inspectors", star: true, reflow: true,
    Component: lazyView(() => import("@/mempool/classic"), "ClassicView") },
];
