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

export interface ProtocolMetaBase {
  id: string;
  label: string;
  kicker: string;
  tone: "acc" | "priv";
  sub: string;
}

export const PROTOCOL_PRIMITIVES_META: ProtocolMetaBase[] = [
  { id: "decoy",     label: "Decoy selection", kicker: "Time tide",         tone: "acc",
    sub: "Log-normal decoy sampling across the timeline." },
  { id: "dandelion", label: "Dandelion++",     kicker: "Botanical bloom",   tone: "priv",
    sub: "Stem-then-fluff propagation hides the origin peer." },
  { id: "viewtags",  label: "View tags",       kicker: "Lighthouse in fog", tone: "acc",
    sub: "256× wallet scan acceleration with a 1-byte hint." },
  { id: "ringct",    label: "RingCT",          kicker: "Assembly line",     tone: "acc",
    sub: "Output → confidential tx in five stations." },
  { id: "stealth",   label: "Stealth address", kicker: "Two-key chamber",   tone: "priv",
    sub: "Diffie-Hellman exchange across silent rooms." },
  { id: "fcmp",      label: "FCMP++",          kicker: "Murmuration",       tone: "priv",
    sub: "Ring of 16 → anonymity set of 150M+ outputs." },
];

export const PROTOCOL_METAPHORS_META: ProtocolMetaBase[] = [
  { id: "hearth",     label: "Eternal hearth", kicker: "Tail emission",          tone: "acc",
    sub: "Volumetric flame — subsidy vs tail over 50 years." },
  { id: "metronome",  label: "Metronome",      kicker: "Block target",           tone: "acc",
    sub: "The 2-minute block heartbeat." },
  { id: "silo",       label: "Grain silo",     kicker: "Monetary policy",        tone: "priv",
    sub: "BTC fixed cap vs XMR perpetual faucet." },
  { id: "thermostat", label: "Thermostat",     kicker: "Difficulty adjustment",  tone: "acc",
    sub: "Two needles tracking toward target." },
  { id: "lighthouse", label: "Lighthouse",     kicker: "Hashrate rotation",      tone: "acc",
    sub: "Sweep speed = hashrate; difficulty keeps the rhythm at 2:00." },
  { id: "auction",    label: "Auction",        kicker: "Mempool fees",           tone: "acc",
    sub: "Bidding paddles set the fee market." },
  { id: "skyline",    label: "Skyline",        kicker: "Pool decentralization",  tone: "priv",
    sub: "City skyline + HHI concentration index." },
  { id: "bloodhound", label: "Bloodhound",     kicker: "Privacy attacks",        tone: "priv",
    sub: "A hound losing the scent." },
  { id: "balance",    label: "Balance",        kicker: "Confidential amounts",   tone: "priv",
    sub: "Sealed envelope on a balance scale." },
];
