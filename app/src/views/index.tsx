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
import { ReactorView } from "@/mempool/reactor";
import { BridgeView } from "@/mempool/bridge";
import { SedimentView } from "@/mempool/sediment";
import { ConstellationView } from "@/mempool/constellation";
import { TerminalHubView } from "@/mempool/terminal";
import { ClassicView } from "@/mempool/classic";

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

export const MEMPOOL_VIEWS: MempoolViewMeta[] = [
  { id: "reactor",       label: "Reactor",       sub: "3D iso · hex lattice · ring fan",  star: false, fit: true,
    Component: ReactorView },
  { id: "bridge",        label: "Ops Bridge",    sub: "12-pane mission control",            star: false, fit: true,
    Component: BridgeView },
  { id: "sediment",      label: "Sediment",      sub: "vertical core-sample tube",         star: false, fit: true,
    Component: SedimentView },
  { id: "constellation", label: "Constellation", sub: "luminous network sphere",           star: false, fit: true,
    Component: ConstellationView },
  { id: "terminal",      label: "Terminal",      sub: "cli-first · monerod tail",          star: false,
    Component: TerminalHubView },
  { id: "classic",       label: "Classic",       sub: "explorer · tx + block inspectors", star: true,
    Component: ClassicView },
];
