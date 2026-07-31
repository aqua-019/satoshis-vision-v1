/**
 * views/index.tsx — registry for the mempool view-engine components.
 *
 * Holds the shared ViewProps contract and the 6 mempool surfaces
 * (src/mempool/*.tsx). The 15 protocol simulators are deliberately NOT here:
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
const lazyView = (load: () => Promise<{ [k: string]: unknown }>, name: string): ViewComponent =>
  React.lazy(async () => ({ default: (await load())[name] as ViewComponent }));

export const MEMPOOL_VIEWS: MempoolViewMeta[] = [
  { id: "reactor",       label: "Reactor",       sub: "3D iso · hex lattice · ring fan",  star: false, fit: true,
    Component: lazyView(() => import("@/mempool/reactor"), "ReactorView") },
  { id: "bridge",        label: "Ops Bridge",    sub: "12-pane mission control",            star: false, fit: true,
    Component: lazyView(() => import("@/mempool/bridge"), "BridgeView") },
  { id: "sediment",      label: "Sediment",      sub: "vertical core-sample tube",         star: false, fit: true,
    Component: lazyView(() => import("@/mempool/sediment"), "SedimentView") },
  { id: "constellation", label: "Constellation", sub: "luminous network sphere",           star: false, fit: true,
    Component: lazyView(() => import("@/mempool/constellation"), "ConstellationView") },
  { id: "terminal",      label: "Terminal",      sub: "cli-first · monerod tail",          star: false,
    Component: lazyView(() => import("@/mempool/terminal"), "TerminalHubView") },
  { id: "classic",       label: "Classic",       sub: "explorer · tx + block inspectors", star: true,
    Component: lazyView(() => import("@/mempool/classic"), "ClassicView") },
];
