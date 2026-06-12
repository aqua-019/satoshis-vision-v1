/**
 * views/protocols.tsx — component-bearing registry for the 15 protocol
 * simulators (src/protocols/*.tsx).
 *
 * This is the ONLY module that statically imports @/protocols/* — it is
 * reached exclusively through the lazy-loaded /simulate route (SimulatePage),
 * so Vite splits the simulators into their own chunk. Pure metadata
 * (ids/labels/kickers) lives in views/protocol-meta.ts for main-chunk
 * consumers; this file zips that meta with the actual components.
 */

import type { ViewComponent } from "./index";
import {
  PROTOCOL_PRIMITIVES_META,
  PROTOCOL_METAPHORS_META,
  type ProtocolMetaBase,
} from "./protocol-meta";
import { DecoySelectionView } from "@/protocols/decoy-selection";
import { DandelionView } from "@/protocols/dandelion";
import { ViewTagsView } from "@/protocols/view-tags";
import { RingctView } from "@/protocols/ringct";
import { StealthView } from "@/protocols/stealth";
import { FcmpView } from "@/protocols/fcmp";
import { HearthView, MetronomeView, SiloView, ThermostatView, AuctionView, SkylineView, BloodhoundView, BalanceView } from "@/protocols/metaphors";
import { LighthouseView } from "@/protocols/lighthouse";

export interface ProtocolMeta extends ProtocolMetaBase {
  Component: ViewComponent;
}

const COMPONENTS: Record<string, ViewComponent> = {
  decoy:      DecoySelectionView,
  dandelion:  DandelionView,
  viewtags:   ViewTagsView,
  ringct:     RingctView,
  stealth:    StealthView,
  fcmp:       FcmpView,
  hearth:     HearthView,
  metronome:  MetronomeView,
  silo:       SiloView,
  thermostat: ThermostatView,
  lighthouse: LighthouseView,
  auction:    AuctionView,
  skyline:    SkylineView,
  bloodhound: BloodhoundView,
  balance:    BalanceView,
};

function withComponents(meta: ProtocolMetaBase[]): ProtocolMeta[] {
  return meta.map((m) => {
    const Component = COMPONENTS[m.id];
    if (!Component) throw new Error(`views/protocols: no component registered for protocol id "${m.id}"`);
    return { ...m, Component };
  });
}

export const PROTOCOL_PRIMITIVES: ProtocolMeta[] = withComponents(PROTOCOL_PRIMITIVES_META);
export const PROTOCOL_METAPHORS: ProtocolMeta[] = withComponents(PROTOCOL_METAPHORS_META);
export const PROTOCOL_VIEWS: ProtocolMeta[] = [...PROTOCOL_PRIMITIVES, ...PROTOCOL_METAPHORS];
