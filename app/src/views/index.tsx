/**
 * views/index.tsx — registry for the mempool view-engine COMPONENTS.
 *
 * Holds the shared ViewProps contract and binds one lazy component per
 * registered mempool surface (src/mempool/*.tsx). It no longer decides WHICH
 * views exist: that list is views/mempool-meta.ts, and MEMPOOL_VIEWS below is
 * derived from it. See that file's header for why the split is forced (nav/
 * ia.ts must read the list under bare Node, which cannot load a .tsx at all).
 *
 * The 21 protocol simulators are deliberately NOT here: their component
 * registry lives in views/protocols.tsx (reached only via the lazy-loaded
 * /simulate route, so @/protocols/* compiles into its own chunk) and their
 * pure metadata lives in views/protocol-meta.ts for main-chunk consumers like
 * the education card grid. mempool-meta.ts is that same separation, applied to
 * the mempool views for a harder reason than bundle size.
 */

import * as React from "react";
import type { MoneroLive } from "@/data/types";
import { MEMPOOL_VIEW_META, type MempoolViewId, type MempoolViewMetaBase } from "./mempool-meta";

export type { ProtocolMetaBase } from "./protocol-meta";
export { MEMPOOL_VIEW_META } from "./mempool-meta";
export type { MempoolViewId, MempoolViewMetaBase } from "./mempool-meta";

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

/** A registered view: everything views/mempool-meta.ts declares about it, plus
 *  the lazy component this file binds to it. The data half lives there so that
 *  nav/ia.ts can read it under bare Node; see that file's header. */
export interface MempoolViewMeta extends MempoolViewMetaBase {
  Component: ViewComponent;
}

/**
 * v6.0.8: each view is `React.lazy`, so the engines compile into one chunk
 * each instead of riding the main bundle. (Counts are deliberately not
 * restated here — MEMPOOL_VIEW_META is the list, and prose that repeats a
 * count is prose that goes stale the next time a view lands. It said "six"
 * through the whole of #174, which shipped a seventh.)
 *
 * MempoolPage mounts exactly ONE of these (selected by `?v=`, default
 * `classic`) but statically importing them all meant every visitor to any
 * route downloaded `reactor` (457 lines), `bridge` (493), `classic` (608),
 * `constellation`, `orbital`, `sediment` and `terminal` whether they opened
 * /mempool or not.
 *
 * `Component` is a lazy reference, NOT a call — reading `meta.Component` to
 * build the switcher's button list is a plain property read and does not
 * start a fetch. React only invokes the importer when the element is actually
 * rendered, which is why the switcher can map over every view for labels while
 * only the active one's chunk loads. (This is the reason `label`/`sub`/`star`/
 * `fit` are plain data in mempool-meta.ts rather than something read out of
 * the module — the same separation `protocol-meta.ts` already makes for the
 * simulators, see this file's header.)
 */
export const lazyView = (load: () => Promise<{ [k: string]: unknown }>, name: string): ViewComponent =>
  React.lazy(async () => ({ default: (await load())[name] as ViewComponent }));

/**
 * id → lazy component. `Record<MempoolViewId, ViewComponent>` is the whole
 * safety mechanism and it is a COMPILE-TIME one: MempoolViewId is a union
 * derived from mempool-meta.ts's `as const` array, so a view registered there
 * with no entry here is a missing-property error, and an entry here naming an
 * id that is not a registered view is an excess-property error. Neither can
 * reach a gate. Same idiom as the two `Record<ProvSource, …>` maps in
 * design/provenance.tsx — the Record IS the exhaustiveness check.
 *
 * Vite needs each `import()` specifier to be a static string literal to split
 * a chunk for it, which is why this map is written out rather than derived
 * from the id: a template literal here would collapse all seven engines into
 * one glob chunk and undo v6.0.8's code-splitting.
 */
const VIEW_COMPONENTS: Record<MempoolViewId, ViewComponent> = {
  reactor: lazyView(() => import("@/mempool/reactor"), "ReactorView"),
  bridge: lazyView(() => import("@/mempool/bridge"), "BridgeView"),
  sediment: lazyView(() => import("@/mempool/sediment"), "SedimentView"),
  constellation: lazyView(() => import("@/mempool/constellation"), "ConstellationView"),
  orbital: lazyView(() => import("@/mempool/orbital"), "OrbitalView"),
  terminal: lazyView(() => import("@/mempool/terminal"), "TerminalHubView"),
  classic: lazyView(() => import("@/mempool/classic"), "ClassicView"),
};

/** The registry every consumer reads. Membership and ORDER come from
 *  mempool-meta.ts; this file only attaches the components. */
export const MEMPOOL_VIEWS: MempoolViewMeta[] = MEMPOOL_VIEW_META.map((m) => ({
  ...m,
  Component: VIEW_COMPONENTS[m.id],
}));
