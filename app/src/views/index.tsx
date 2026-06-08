/**
 * views/index.tsx — registry for the heavy view-engine components.
 *
 * 5 mempool surfaces and 14 protocol simulators live in src/mempool/*.tsx and
 * src/protocols/*.tsx — but until you run `npm run port`, they don't exist
 * yet. This registry returns a clean "needs porting" placeholder so the
 * skeleton builds and runs immediately.
 *
 * After running `npm run port`, replace the placeholders with real imports:
 *
 *   import { ReactorView }       from "@/mempool/reactor";
 *   import { BridgeView }        from "@/mempool/bridge";
 *   import { SedimentView }      from "@/mempool/sediment";
 *   import { ConstellationView } from "@/mempool/constellation";
 *   import { TerminalHubView }   from "@/mempool/terminal";
 *
 *   import { DecoySelectionView } from "@/protocols/decoy-selection";
 *   import { DandelionView }      from "@/protocols/dandelion";
 *   …
 *
 * Then update MEMPOOL_VIEWS / PROTOCOL_VIEWS arrays below to point at them.
 */

import * as React from "react";
import type { MoneroLive } from "@/data/types";
import { ReactorView } from "@/mempool/reactor";
import { BridgeView } from "@/mempool/bridge";
import { SedimentView } from "@/mempool/sediment";
import { ConstellationView } from "@/mempool/constellation";
import { TerminalHubView } from "@/mempool/terminal";
import { ClassicView } from "@/mempool/classic";
import { DecoySelectionView } from "@/protocols/decoy-selection";
import { DandelionView } from "@/protocols/dandelion";
import { ViewTagsView } from "@/protocols/view-tags";
import { RingctView } from "@/protocols/ringct";
import { StealthView } from "@/protocols/stealth";
import { FcmpView } from "@/protocols/fcmp";
import { HearthView, MetronomeView, SiloView, ThermostatView, AuctionView, SkylineView, BloodhoundView, BalanceView } from "@/protocols/metaphors";
import { LighthouseView } from "@/protocols/lighthouse";

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

// ── Protocol simulations ───────────────────────────────────────

export interface ProtocolMeta {
  id: string;
  label: string;
  kicker: string;
  tone: "acc" | "priv";
  sub: string;
  Component: ViewComponent;
}

export const PROTOCOL_PRIMITIVES: ProtocolMeta[] = [
  { id: "decoy",     label: "Decoy selection", kicker: "Time tide",         tone: "acc",
    sub: "Log-normal decoy sampling across the timeline.",
    Component: DecoySelectionView },
  { id: "dandelion", label: "Dandelion++",     kicker: "Botanical bloom",   tone: "priv",
    sub: "Stem-then-fluff propagation hides the origin peer.",
    Component: DandelionView },
  { id: "viewtags",  label: "View tags",       kicker: "Lighthouse in fog", tone: "acc",
    sub: "256× wallet scan acceleration with a 1-byte hint.",
    Component: ViewTagsView },
  { id: "ringct",    label: "RingCT",          kicker: "Assembly line",     tone: "acc",
    sub: "Output → confidential tx in five stations.",
    Component: RingctView },
  { id: "stealth",   label: "Stealth address", kicker: "Two-key chamber",   tone: "priv",
    sub: "Diffie-Hellman exchange across silent rooms.",
    Component: StealthView },
  { id: "fcmp",      label: "FCMP++",          kicker: "Murmuration",       tone: "priv",
    sub: "Ring of 16 → anonymity set of 150M+ outputs.",
    Component: FcmpView },
];

export const PROTOCOL_METAPHORS: ProtocolMeta[] = [
  { id: "hearth",     label: "Eternal hearth", kicker: "Tail emission",          tone: "acc",
    sub: "Volumetric flame — subsidy vs tail over 50 years.",
    Component: HearthView },
  { id: "metronome",  label: "Metronome",      kicker: "Block target",           tone: "acc",
    sub: "The 2-minute block heartbeat.",
    Component: MetronomeView },
  { id: "silo",       label: "Grain silo",     kicker: "Monetary policy",        tone: "priv",
    sub: "BTC fixed cap vs XMR perpetual faucet.",
    Component: SiloView },
  { id: "thermostat", label: "Thermostat",     kicker: "Difficulty adjustment",  tone: "acc",
    sub: "Two needles tracking toward target.",
    Component: ThermostatView },
  { id: "lighthouse", label: "Lighthouse",     kicker: "Hashrate rotation",      tone: "acc",
    sub: "Sweep speed = hashrate; difficulty keeps the rhythm at 2:00.",
    Component: LighthouseView },
  { id: "auction",    label: "Auction",        kicker: "Mempool fees",           tone: "acc",
    sub: "Bidding paddles set the fee market.",
    Component: AuctionView },
  { id: "skyline",    label: "Skyline",        kicker: "Pool decentralization",  tone: "priv",
    sub: "City skyline + HHI concentration index.",
    Component: SkylineView },
  { id: "bloodhound", label: "Bloodhound",     kicker: "Privacy attacks",        tone: "priv",
    sub: "A hound losing the scent.",
    Component: BloodhoundView },
  { id: "balance",    label: "Balance",        kicker: "Confidential amounts",   tone: "priv",
    sub: "Sealed envelope on a balance scale.",
    Component: BalanceView },
];

export const PROTOCOL_VIEWS: ProtocolMeta[] = [...PROTOCOL_PRIMITIVES, ...PROTOCOL_METAPHORS];
