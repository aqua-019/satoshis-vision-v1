/**
 * views/protocols.tsx — component-bearing registry for the 21 protocol
 * simulators (src/protocols/*.tsx), across 16 modules: metaphors.tsx alone
 * exports 8 of them.
 *
 * This is the ONLY module that references @/protocols/* — it is reached
 * exclusively through the lazy-loaded /simulate route (SimulatePage). Pure
 * metadata (ids/labels/kickers) lives in views/protocol-meta.ts for main-chunk
 * consumers; this file zips that meta with the actual components.
 *
 * v6.1.5 PR B: those references are now DYNAMIC. Previously all 16 modules were
 * statically imported here, so /simulate's chunk carried all 21 simulators and
 * opening one downloaded twenty you did not ask for — the largest chunk in the
 * tree at 180,572 B raw. Each id now resolves through `lazyView`, the helper
 * views/index.tsx already uses for the six mempool surfaces; this file is
 * adopting an existing idiom, not inventing one. That file's header even
 * describes the separation "protocol-meta.ts already makes for the simulators",
 * which is the split this change finally uses.
 *
 * `Component` stays a lazy REFERENCE, not a call: SimulatePage maps over all 21
 * to build its switcher, and a property read starts no fetch. React invokes the
 * importer only when the element is rendered, so only the active simulator's
 * chunk loads.
 */

import { type ViewComponent, lazyView } from "./index";
import {
  PROTOCOL_PRIMITIVES_META,
  PROTOCOL_FUTURE_META,
  PROTOCOL_METAPHORS_META,
  type ProtocolMetaBase,
} from "./protocol-meta";

/* metaphors.tsx exports EIGHT of the 21, so its eight entries share one
 * importer — Vite emits one chunk for the module and the eight lazy wrappers
 * all resolve against it. Opening any one metaphor loads the other seven, which
 * is correct: splitting them apart would mean eight chunks of a single source
 * file. The other 13 simulators are one module each. */
const metaphors = () => import("@/protocols/metaphors");

export interface ProtocolMeta extends ProtocolMetaBase {
  Component: ViewComponent;
}

const COMPONENTS: Record<string, ViewComponent> = {
  decoy:      lazyView(() => import("@/protocols/decoy-selection"), "DecoySelectionView"),
  dandelion:  lazyView(() => import("@/protocols/dandelion"), "DandelionView"),
  viewtags:   lazyView(() => import("@/protocols/view-tags"), "ViewTagsView"),
  ringct:     lazyView(() => import("@/protocols/ringct"), "RingctView"),
  stealth:    lazyView(() => import("@/protocols/stealth"), "StealthView"),
  fcmp:       lazyView(() => import("@/protocols/fcmp"), "FcmpView"),
  seraphis:   lazyView(() => import("@/protocols/seraphis"), "SeraphisView"),
  jamtis:     lazyView(() => import("@/protocols/jamtis"), "JamtisView"),
  carrot:     lazyView(() => import("@/protocols/carrot"), "CarrotView"),
  cuprate:    lazyView(() => import("@/protocols/cuprate"), "CuprateView"),
  stressnet:  lazyView(() => import("@/protocols/stressnet"), "StressnetView"),
  ospead:     lazyView(() => import("@/protocols/ospead"), "OspeadView"),
  lighthouse: lazyView(() => import("@/protocols/lighthouse"), "LighthouseView"),
  hearth:     lazyView(metaphors, "HearthView"),
  metronome:  lazyView(metaphors, "MetronomeView"),
  silo:       lazyView(metaphors, "SiloView"),
  thermostat: lazyView(metaphors, "ThermostatView"),
  auction:    lazyView(metaphors, "AuctionView"),
  skyline:    lazyView(metaphors, "SkylineView"),
  bloodhound: lazyView(metaphors, "BloodhoundView"),
  balance:    lazyView(metaphors, "BalanceView"),
};

function withComponents(meta: ProtocolMetaBase[]): ProtocolMeta[] {
  return meta.map((m) => {
    const Component = COMPONENTS[m.id];
    if (!Component) throw new Error(`views/protocols: no component registered for protocol id "${m.id}"`);
    return { ...m, Component };
  });
}

export const PROTOCOL_PRIMITIVES: ProtocolMeta[] = withComponents(PROTOCOL_PRIMITIVES_META);
export const PROTOCOL_FUTURE: ProtocolMeta[] = withComponents(PROTOCOL_FUTURE_META);
export const PROTOCOL_METAPHORS: ProtocolMeta[] = withComponents(PROTOCOL_METAPHORS_META);
export const PROTOCOL_VIEWS: ProtocolMeta[] = [
  ...PROTOCOL_PRIMITIVES,
  ...PROTOCOL_FUTURE,
  ...PROTOCOL_METAPHORS,
];
