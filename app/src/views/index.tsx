/**
 * views/index.tsx — registry for the heavy view-engine components.
 *
 * 5 mempool surfaces and 6 protocol simulators live in src/mempool/*.tsx and
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
import { Card } from "@/design/primitives";
import type { MoneroLive } from "@/data/types";
import { ReactorView } from "@/mempool/reactor";
import { BridgeView } from "@/mempool/bridge";
import { SedimentView } from "@/mempool/sediment";
import { ConstellationView } from "@/mempool/constellation";
import { TerminalHubView } from "@/mempool/terminal";

export interface ViewProps {
  data: MoneroLive;
  bg?: { intensity?: "calm" | "busy" | "chaotic"; scan?: boolean };
}

export type ViewComponent = React.ComponentType<ViewProps>;

/** Placeholder until you run `npm run port`. */
function Placeholder({ name, sub }: { name: string; sub: string }) {
  return (
    <div style={{ padding: 48, display: "grid", placeItems: "center", height: "100%" }}>
      <Card style={{ padding: 32, maxWidth: 600 }}>
        <div className="kicker">View not yet ported</div>
        <h2 className="serif" style={{ margin: "10px 0", fontSize: 30, color: "var(--ink-100)" }}>{name}</h2>
        <p className="mono dim" style={{ fontSize: 12, lineHeight: 1.6 }}>{sub}</p>
        <p className="mono" style={{ fontSize: 11, marginTop: 16, color: "var(--tk-accent)" }}>
          $ npm run port
        </p>
      </Card>
    </div>
  );
}

const stub = (name: string, sub: string): ViewComponent => () =>
  <Placeholder name={name} sub={sub} />;

// ── Mempool views ──────────────────────────────────────────────

export interface MempoolViewMeta {
  id: string;
  label: string;
  sub: string;
  star?: boolean;
  Component: ViewComponent;
}

export const MEMPOOL_VIEWS: MempoolViewMeta[] = [
  { id: "reactor",       label: "Reactor",       sub: "orbital core · block forge · fee rivers",  star: true,
    Component: ReactorView },
  { id: "bridge",        label: "Ops Bridge",    sub: "12-pane mission control",            star: false,
    Component: BridgeView },
  { id: "sediment",      label: "Sediment",      sub: "vertical core-sample tube",         star: false,
    Component: SedimentView },
  { id: "constellation", label: "Constellation", sub: "luminous network sphere",           star: false,
    Component: ConstellationView },
  { id: "terminal",      label: "Terminal",      sub: "cli-first · monerod tail",          star: false,
    Component: TerminalHubView },
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

export const PROTOCOL_VIEWS: ProtocolMeta[] = [
  { id: "decoy",     label: "Decoy selection", kicker: "Time tide",         tone: "acc",
    sub: "Log-normal decoy sampling across the blockchain timeline.",
    Component: stub("Decoy selection", "Log-normal sampling of decoys across recent blocks.") },
  { id: "dandelion", label: "Dandelion++",     kicker: "Botanical bloom",   tone: "priv",
    sub: "Stem-then-fluff propagation. Hides the origin peer.",
    Component: stub("Dandelion++", "A stem grows hop-by-hop, then bursts into 360° gossip.") },
  { id: "viewtags",  label: "View tags",       kicker: "Lighthouse in fog", tone: "acc",
    sub: "256× wallet scan acceleration with a 1-byte hint.",
    Component: stub("View tags", "1-byte tag accelerates wallet scan by 256×.") },
  { id: "ringct",    label: "RingCT",          kicker: "Assembly line",     tone: "acc",
    sub: "Five cryptographic stations: from output to confidential tx.",
    Component: stub("RingCT", "Five cryptographic stations producing a confidential tx.") },
  { id: "stealth",   label: "Stealth address", kicker: "Two-key chamber",   tone: "priv",
    sub: "Diffie-Hellman exchange across silent rooms.",
    Component: stub("Stealth address", "DH exchange producing a one-time output address.") },
  { id: "fcmp",      label: "FCMP++",          kicker: "Murmuration",       tone: "priv",
    sub: "Ring of 16 → anonymity set of 150M+ outputs.",
    Component: stub("FCMP++", "Murmuration of 150M+ outputs — the anonymity set explodes.") },
];
