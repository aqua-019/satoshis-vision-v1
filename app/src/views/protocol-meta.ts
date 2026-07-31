/**
 * views/protocol-meta.ts — pure-data metadata for the protocol simulators.
 *
 * Deliberately imports NO React and NO @/protocols/* code: this file lives in
 * the main chunk so light consumers (e.g. the /education/simulators card grid)
 * can read labels/ids/kickers without pulling the heavy simulator components
 * into their bundle. The component-bearing registry lives in
 * views/protocols.tsx, which is only reached via the lazy-loaded /simulate
 * route.
 */

/** Taxonomy used by the /simulate switcher to group 21 buttons into something
 *  navigable — especially at 390px, where one flat row is unusable. */
export type ProtocolGroup =
  | "Privacy primitive"
  | "Future protocol"
  | "Economics"
  | "Consensus";

export interface ProtocolMetaBase {
  id: string;
  label: string;
  kicker: string;
  tone: "acc" | "priv";
  sub: string;
  group: ProtocolGroup;
}

export const PROTOCOL_PRIMITIVES_META: ProtocolMetaBase[] = [
  { id: "decoy",     label: "Decoy selection", kicker: "Time tide",         tone: "acc",  group: "Privacy primitive",
    sub: "Gamma-over-log-age decoy sampling across the timeline." },
  { id: "dandelion", label: "Dandelion++",     kicker: "Botanical bloom",   tone: "priv", group: "Privacy primitive",
    sub: "Stem-then-fluff propagation hides the origin peer." },
  { id: "viewtags",  label: "View tags",       kicker: "Lighthouse in fog", tone: "acc",  group: "Privacy primitive",
    sub: "256× wallet scan acceleration with a 1-byte hint." },
  { id: "ringct",    label: "RingCT",          kicker: "Assembly line",     tone: "acc",  group: "Privacy primitive",
    sub: "Output → confidential tx in five stations." },
  { id: "stealth",   label: "Stealth address", kicker: "Two-key chamber",   tone: "priv", group: "Privacy primitive",
    sub: "Diffie-Hellman exchange across silent rooms." },
  { id: "fcmp",      label: "FCMP++",          kicker: "Murmuration",       tone: "priv", group: "Privacy primitive",
    sub: "Ring of 16 → anonymity set of 150M+ outputs." },
];

/* ── Future protocols (v6.0.9) ────────────────────────────────────
   These six are the work-in-progress protocols the FUTURE tab writes about.
   Adding an id here is what un-gates that protocol's "RUN THE X SIMULATOR"
   button: pages/future/data.ts derives SIM_IDS from these arrays, and
   ProtoPopup/EcoPopup render a disabled SIMULATOR PENDING affordance for
   anything absent. So the gate mechanism stays — it just has fewer members.
   ──────────────────────────────────────────────────────────────── */
export const PROTOCOL_FUTURE_META: ProtocolMetaBase[] = [
  { id: "seraphis",  label: "Seraphis",  kicker: "The new engine",   tone: "priv", group: "Future protocol",
    sub: "Membership, ownership and amount proofs pulled apart." },
  { id: "jamtis",    label: "Jamtis",    kicker: "Address loom",     tone: "priv", group: "Future protocol",
    sub: "75 characters with meaning, and a checksum that bites." },
  { id: "carrot",    label: "Carrot",    kicker: "The keyhole",      tone: "priv", group: "Future protocol",
    sub: "Incoming visible; spends and balance sealed." },
  { id: "cuprate",   label: "Cuprate",   kicker: "Twin engines",     tone: "acc",  group: "Consensus",
    sub: "Two implementations agreeing block by block." },
  { id: "stressnet", label: "Stressnet", kicker: "Wind tunnel",      tone: "acc",  group: "Consensus",
    sub: "FCMP++ under deliberate load; dynamic block size responds." },
  { id: "ospead",    label: "OSPEAD",    kicker: "Camouflage tailor", tone: "acc", group: "Economics",
    sub: "The decoy distribution vs how outputs are really spent." },
];

export const PROTOCOL_METAPHORS_META: ProtocolMetaBase[] = [
  { id: "hearth",     label: "Eternal hearth", kicker: "Tail emission",          tone: "acc",  group: "Economics",
    sub: "Volumetric flame — subsidy vs tail over 50 years." },
  { id: "metronome",  label: "Metronome",      kicker: "Block target",           tone: "acc",  group: "Consensus",
    sub: "The 2-minute block heartbeat." },
  { id: "silo",       label: "Grain silo",     kicker: "Monetary policy",        tone: "priv", group: "Economics",
    sub: "BTC fixed cap vs XMR perpetual faucet." },
  { id: "thermostat", label: "Thermostat",     kicker: "Difficulty adjustment",  tone: "acc",  group: "Consensus",
    sub: "Two needles tracking toward target." },
  { id: "lighthouse", label: "Lighthouse",     kicker: "Hashrate rotation",      tone: "acc",  group: "Consensus",
    sub: "Sweep speed = hashrate; difficulty keeps the rhythm at 2:00." },
  { id: "auction",    label: "Auction",        kicker: "Mempool fees",           tone: "acc",  group: "Economics",
    sub: "Bidding paddles set the fee market." },
  { id: "skyline",    label: "Skyline",        kicker: "Pool decentralization",  tone: "priv", group: "Consensus",
    sub: "City skyline + HHI concentration index." },
  { id: "bloodhound", label: "Bloodhound",     kicker: "Privacy attacks",        tone: "priv", group: "Privacy primitive",
    sub: "A hound losing the scent." },
  { id: "balance",    label: "Balance",        kicker: "Confidential amounts",   tone: "priv", group: "Privacy primitive",
    sub: "Sealed envelope on a balance scale." },
];

/** Switcher render order. Not a re-export of the arrays themselves — consumers
 *  that only need "every simulator id" (SIM_IDS) spread the arrays directly. */
export const PROTOCOL_GROUP_ORDER: readonly ProtocolGroup[] = [
  "Privacy primitive",
  "Future protocol",
  "Consensus",
  "Economics",
];
