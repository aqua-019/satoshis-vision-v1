/**
 * views/index.tsx — CORRECTED registry (replaces repo/src/views/index.tsx).
 *
 * The skeleton's registry claimed "5 mempool surfaces and 6 protocol
 * simulators." The authoritative 0.1 UI (index.html) actually wires:
 *   • 6 MEMPOOL views  (the skeleton omitted `classic`)
 *   • 6 protocol PRIMITIVES + 8 METAPHORS = 14 simulations
 *     (the skeleton omitted sim-fx.jsx + all of metaphors.jsx)
 *
 * Before this registry resolves to real components, copy the missing source
 * into repo/legacy/ and run `npm run port`:
 *   legacy/mempool/classic.jsx        ← from legacy-dropin/
 *   legacy/mempool/tx-detail.jsx      ← from legacy-dropin/
 *   legacy/mempool/mempool-shared.jsx ← from legacy-dropin/
 *   legacy/protocols/sim-fx.jsx       ← from legacy-dropin/  (FX ENGINE — port FIRST)
 *   legacy/protocols/metaphors.jsx    ← from legacy-dropin/  (the 8 metaphors)
 *
 * Then replace the `stub(...)` calls below with real imports, e.g.
 *   import { ReactorView } from "@/mempool/reactor";
 *   import { HearthView, MetronomeView, … } from "@/protocols/metaphors";
 *
 * See MISSING_IN_V5.md §2 (mempool) and §4 (simulations / high-fidelity viz).
 */

import * as React from "react";
import { Card } from "@/design/primitives";
import type { MoneroLive } from "@/data/types";

export interface ViewProps {
  data: MoneroLive;
  bg?: { intensity?: "calm" | "busy" | "chaotic"; scan?: boolean; animSpeed?: number };
}
export type ViewComponent = React.ComponentType<ViewProps>;

function Placeholder({ name, sub }: { name: string; sub: string }) {
  return (
    <div style={{ padding: 48, display: "grid", placeItems: "center", height: "100%" }}>
      <Card style={{ padding: 32, maxWidth: 600 }}>
        <div className="kicker">View not yet ported</div>
        <h2 className="serif" style={{ margin: "10px 0", fontSize: 30, color: "var(--ink-100)" }}>{name}</h2>
        <p className="mono dim" style={{ fontSize: 12, lineHeight: 1.6 }}>{sub}</p>
        <p className="mono" style={{ fontSize: 11, marginTop: 16, color: "var(--tk-accent)" }}>$ npm run port</p>
      </Card>
    </div>
  );
}
const stub = (name: string, sub: string): ViewComponent => () => <Placeholder name={name} sub={sub} />;

// ── Mempool views · 6 (was 5 — `classic` added) ───────────────────

export interface MempoolViewMeta { id: string; label: string; sub: string; star?: boolean; Component: ViewComponent; }

export const MEMPOOL_VIEWS: MempoolViewMeta[] = [
  { id: "reactor",       label: "Reactor",       sub: "3D iso · hex lattice · ring fan", star: true,
    Component: stub("Reactor", "3D iso block stack, hex-grid mempool, ring-signature fan.") },
  { id: "classic",       label: "Classic",       sub: "mempool.space-style fee buckets",
    Component: stub("Classic", "Familiar fee-bucket projection blocks + recent-blocks rail.") },
  { id: "bridge",        label: "Ops Bridge",    sub: "12-pane mission control",
    Component: stub("Operations Bridge", "Bloomberg-meets-NASA layout of 12 telemetry panes.") },
  { id: "sediment",      label: "Sediment",      sub: "vertical core-sample tube",
    Component: stub("Sediment", "Vertical core-sample tube. Heavier transactions sink.") },
  { id: "constellation", label: "Constellation", sub: "luminous network sphere",
    Component: stub("Constellation", "Globe-shaped peer-graph of the live Monero P2P mesh.") },
  { id: "terminal",      label: "Terminal",      sub: "cli-first · monerod tail",
    Component: stub("Terminal Hub", "CLI-first view: streaming monerod tail with parsed events.") },
];

/** Full-fidelity TX/Block drilldown shared across every mempool view. */
export const TX_DETAIL: ViewComponent = stub("TX / Block detail", "Port legacy/mempool/tx-detail.jsx — drilldown panel.");

// ── Protocol simulations · 14 total ───────────────────────────────

export interface ProtocolMeta { id: string; label: string; kicker: string; tone: "acc" | "priv"; sub: string; Component: ViewComponent; }

/** 6 cryptographic primitives. */
export const PROTOCOL_PRIMITIVES: ProtocolMeta[] = [
  { id: "decoy",     label: "Decoy selection", kicker: "Time tide",         tone: "acc",  sub: "Log-normal decoy sampling across the timeline.",      Component: stub("Decoy selection", "Log-normal sampling of decoys across recent blocks.") },
  { id: "dandelion", label: "Dandelion++",     kicker: "Botanical bloom",   tone: "priv", sub: "Stem-then-fluff propagation hides the origin peer.",  Component: stub("Dandelion++", "A stem grows hop-by-hop, then bursts into 360° gossip.") },
  { id: "viewtags",  label: "View tags",       kicker: "Lighthouse in fog", tone: "acc",  sub: "256× wallet scan acceleration with a 1-byte hint.",   Component: stub("View tags", "1-byte tag accelerates wallet scan by 256×.") },
  { id: "ringct",    label: "RingCT",          kicker: "Assembly line",     tone: "acc",  sub: "Output → confidential tx in five stations.",          Component: stub("RingCT", "Five cryptographic stations producing a confidential tx.") },
  { id: "stealth",   label: "Stealth address", kicker: "Two-key chamber",   tone: "priv", sub: "Diffie-Hellman exchange across silent rooms.",        Component: stub("Stealth address", "DH exchange producing a one-time output address.") },
  { id: "fcmp",      label: "FCMP++",          kicker: "Murmuration",       tone: "priv", sub: "Ring of 16 → anonymity set of 150M+ outputs.",        Component: stub("FCMP++", "Murmuration of 150M+ outputs — the anonymity set explodes.") },
];

/**
 * 8 metaphor-driven visualizations — ALL live in legacy/protocols/metaphors.jsx
 * and ALL depend on legacy/protocols/sim-fx.jsx (ParticleStream, GlowOrb,
 * Volumetric3D, SvgDefs, useFrame, useMouseParallax) PLUS useTick from shared.
 * These are the high-fidelity, animated set the skeleton entirely omitted.
 */
export const PROTOCOL_METAPHORS: ProtocolMeta[] = [
  { id: "hearth",     label: "Eternal hearth", kicker: "Tail emission",        tone: "acc",  sub: "Volumetric flame — subsidy vs tail over 50 years.",  Component: stub("Hearth", "Tail emission as an eternal hearth; embers + flame layers.") },
  { id: "metronome",  label: "Metronome",      kicker: "Block target",          tone: "acc",  sub: "The 2-minute block heartbeat.",                       Component: stub("Metronome", "Block-target cadence as a swinging metronome.") },
  { id: "silo",       label: "Grain silo",     kicker: "Monetary policy",       tone: "priv", sub: "BTC fixed cap vs XMR perpetual faucet.",              Component: stub("Silo", "Monetary policy: grain silo + faucet, BTC vs XMR.") },
  { id: "thermostat", label: "Thermostat",     kicker: "Difficulty adjustment", tone: "acc",  sub: "Two needles tracking toward target.",                 Component: stub("Thermostat", "Difficulty adjustment as a tracking thermostat.") },
  { id: "auction",    label: "Auction",        kicker: "Mempool fees",          tone: "acc",  sub: "Bidding paddles set the fee market.",                 Component: stub("Auction", "Mempool fees as competing bid paddles.") },
  { id: "skyline",    label: "Skyline",        kicker: "Pool decentralization", tone: "priv", sub: "City skyline + HHI concentration index.",             Component: stub("Skyline", "Pool decentralization as a city skyline + HHI.") },
  { id: "bloodhound", label: "Bloodhound",     kicker: "Privacy attacks",       tone: "priv", sub: "A hound losing the scent.",                           Component: stub("Bloodhound", "Privacy attacks as a hound losing the trail.") },
  { id: "balance",    label: "Balance",        kicker: "Confidential amounts",  tone: "priv", sub: "Sealed envelope on a balance scale.",                 Component: stub("Balance", "Confidential amounts as a sealed envelope on a scale.") },
];

/** Everything the Education + Simulate surfaces iterate over. */
export const PROTOCOL_VIEWS: ProtocolMeta[] = [...PROTOCOL_PRIMITIVES, ...PROTOCOL_METAPHORS];
