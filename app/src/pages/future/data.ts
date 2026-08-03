/**
 * pages/future/data.ts — pure data for the FUTURE tab (roadmap rail, five
 * incoming-protocol cards, ecosystem partner panels, automation registry).
 *
 * Ported verbatim (copy unchanged) from the v6 future.jsx prototype. Imports
 * no React — consumed structurally via .find()/props by FutureMini, V6Modal
 * consumers, and the page components another agent builds on top of this.
 *
 * HARD CONSTRAINT: this file (and everything else in pages/future/) imports
 * simulator metadata only from @/views/protocol-meta, never from
 * @/views/protocols or @/protocols/* — those are confined to the lazy
 * /simulate chunk, and a stray import here would drag all 15 simulators
 * into the main bundle.
 */

import {
  PROTOCOL_PRIMITIVES_META,
  PROTOCOL_FUTURE_META,
  PROTOCOL_METAPHORS_META,
} from "@/views/protocol-meta";
import { R } from "../../../scripts/routes.mjs";

export type MiniMode = "fcmp" | "seraphis" | "jamtis" | "carrot" | "cuprate" | "stressnet";
export type Metric = readonly [k: string, v: string];
export type Resource = readonly [label: string, href: string, kind: string];
export type EcoLink = readonly [label: string, href: string | null];

export interface FutureProtocol {
  id: string;
  tag: string;
  sub: string;
  c: string; // literal hex, used inline for textShadow/borderColor
  mini: MiniMode;
  status: string;
  sc: string; // a `var(--…)` string
  eta: string;
  sim: string | null; // simulator id, or null when none exists — see SIM_IDS
  head: string;
  lede: string;
  deep: readonly string[];
  metrics: readonly Metric[];
  repo: string; // owner/name
  resources: readonly Resource[];
}

export interface EcoSlot {
  label: string;
  h?: number;
}

export interface EcoEntry {
  id: string;
  name: string;
  head: string;
  kind: string;
  status: "LIVE · BETA" | "PARTNER"; // union, not string — the peers page
  // filters on === "PARTNER", so a typo becomes a compile error, not an
  // empty grid
  c: string;
  url?: string; // the partner's own site
  blurb: string;
  body: readonly string[];
  simLink?: string;
  simLabel?: string;
  slots: readonly EcoSlot[];
  links: readonly EcoLink[];
}

// A roadmap stop is EITHER a fork that maps onto one or more
// FUTURE_PROTOCOLS entries (status text is *derived*, never restated — see
// roadmapStatus() below) OR a stop with no protocol member yet, which still
// carries its own literal `d` string. A stop can never carry both fields or
// neither — that's the whole point of the union.
export type RoadmapStop =
  | { v: string; t: string; c: string; on: boolean; protocols: readonly string[] }
  | { v: string; t: string; c: string; on: boolean; d: string };

export interface AutomationRow {
  k: string;
  src: string;
  mode: string;
  tone: "live" | "pending"; // green = wired end-to-end today
  // yellow = needs something that doesn't exist yet
}

export interface DevLabPulse {
  /** owner/name in GitHub's EXACT casing — api.github.com paths are
   *  case-sensitive even where github.com redirects, and this string is
   *  matched against api/feeds.js's GH_ALLOWED. */
  repo: string;
  label: string;
  /** Leading "/" → in-app <Link>; anything else → external anchor. */
  href: string;
}

/**
 * The always-on repo pulse under "Automation". Data rather than JSX so the
 * set is one list, assertable from source, and FuturePage stays a `.map()`.
 * Four repos = four /api/feeds requests per visitor per 24h.
 * Every entry must also exist in api/feeds.js's GH_ALLOWED, or the proxy
 * 400s the request.
 */
export const DEV_LAB_PULSES: readonly DevLabPulse[] = [
  { repo: "monero-project/monero", label: "Core client", href: "https://github.com/monero-project/monero" },
  { repo: "monero-project/research-lab", label: "MRL · research", href: "https://github.com/monero-project/research-lab" },
  // Links to /sources, not github.com: this site's release feed is rendered
  // there from its own commit log.
  { repo: "aqua-019/satoshis-vision-v1", label: "This site", href: R.ABOUT_SOURCES },
  { repo: "brainchainz/Monero-Superbrain", label: "Superstress · Umbrel apps", href: "https://github.com/brainchainz/Monero-Superbrain" },
];

/** Simulator ids actually registered in the (lazy) /simulate chunk. Gate
 * "RUN THE X SIMULATOR" buttons on membership here — see FutureProtocol.sim. */
export const SIM_IDS: ReadonlySet<string> = new Set(
  [...PROTOCOL_PRIMITIVES_META, ...PROTOCOL_FUTURE_META, ...PROTOCOL_METAPHORS_META].map(
    (m) => m.id,
  ),
);

/* ── protocol catalogue · the five incoming upgrades ──────────── */
export const FUTURE_PROTOCOLS: readonly FutureProtocol[] = [
  {
    id: "fcmp", tag: "FCMP++", sub: "Full-chain membership proofs", c: "#b87aff", mini: "fcmp",
    status: "BETA · stressnet live", sc: "var(--y-50)", eta: "Q3 2026 · fork v17", sim: "fcmp",
    head: "The anonymity set goes from 16 to the entire chain.",
    lede: "Today every spend hides among 15 decoys. FCMP++ replaces the ring with a zero-knowledge proof that the spent output exists somewhere in the full set of ~150 million — without revealing which.",
    deep: [
      "The ring signature was always a compromise: big enough to give plausible deniability, small enough to verify fast. FCMP++ (Full-Chain Membership Proofs, plus spend authorization, plus key images) dissolves the compromise. The proof says 'this input is one of every output that has ever existed' — a curve-tree membership proof over the whole chain.",
      "Statistical decoy analysis, the workhorse of every chain-surveillance contract ever sold against Monero, stops being a research field. There is no distribution to fit when the candidate set is the entire UTXO history.",
      "It activates as hard fork v17 without changing addresses or breaking wallets — Seraphis-grade privacy on the current transaction format.",
    ],
    metrics: [["Anonymity set", "150M+"], ["Today", "ring-16"], ["Multiplier", "≈10M×"], ["Proof size", "~3-4 KB"], ["Verify", "~35 ms"], ["Addresses", "unchanged"]],
    repo: "kayabaNerve/fcmp-plus-plus",
    resources: [
      ["Reference implementation", "https://github.com/kayabaNerve/fcmp-plus-plus", "github"],
      ["MRL tracking issue", "https://github.com/monero-project/research-lab/issues/100", "research-lab"],
      ["getmonero.org · FCMP dev update", "https://www.getmonero.org/2024/04/27/fcmps.html", "blog"],
      ["monero-project/monero", "https://github.com/monero-project/monero", "github"],
    ],
  },
  {
    id: "seraphis", tag: "Seraphis", sub: "Next-generation tx protocol", c: "#ff7a1a", mini: "seraphis",
    status: "BETA · audit in progress", sc: "var(--y-50)", eta: "2027 · fork v18", sim: "seraphis",
    head: "A clean-room rewrite of how transactions work.",
    lede: "Smaller signatures, ~40% faster verification, and a sane modular wallet model. Together with FCMP++ and Jamtis it's what the community calls 'Monero 2.0'.",
    deep: [
      "Seraphis re-derives Monero's transaction structure from first principles: membership proof, ownership proof, and amount proof become cleanly separable components instead of one entangled ring-signature blob. That separation is what lets future proof systems slot in without another decade of surgery.",
      "Wallets get a six-tier key hierarchy — from 'can generate addresses' to 'can spend' — so an exchange's address server, a payment processor, and a hardware wallet each hold exactly the capability they need and nothing more.",
      "The migration is the largest consensus change in Monero's history, which is why it ships after FCMP++ delivers the privacy win on the current format.",
    ],
    metrics: [["Signature", "−30%"], ["Verify", "+40%"], ["Key tiers", "6"], ["Wallets", "simpler"], ["Fork", "v18 · 2027"], ["Pairs with", "Jamtis"]],
    repo: "seraphis-migration/wallet3",
    resources: [
      ["Seraphis spec (UkoeHB)", "https://github.com/UkoeHB/Seraphis", "github"],
      ["seraphis-migration · wallet3", "https://github.com/seraphis-migration/wallet3", "github"],
      ["MRL discussion", "https://github.com/monero-project/research-lab/issues", "research-lab"],
    ],
  },
  {
    id: "jamtis", tag: "Jamtis", sub: "Structured addresses", c: "#4ade80", mini: "jamtis",
    status: "BETA · addressing layer", sc: "var(--y-50)", eta: "ships with v18", sim: "jamtis",
    head: "Addresses become structured, checksummed, readable.",
    lede: "95 characters of base58 noise become a 75-character format with meaningful spans, native sub-address tags, and a checksum that catches typos before money moves.",
    deep: [
      "Jamtis is the addressing layer designed alongside Seraphis by tevador (author of RandomX). Every span of the address means something: network prefix, view-balance key, view-received key, spend key, address tag, checksum. Wallet UIs can highlight exactly which span differs between two addresses — the look-alike-address scam dies on contact.",
      "It also fixes the view-key dilemma: separate 'view balance' and 'view received' capabilities mean light wallets and audit tools no longer require handing over your whole incoming history.",
    ],
    metrics: [["Length", "75 ch (−21%)"], ["Checksum", "built-in"], ["Sub-addr", "native tags"], ["Scam class", "eliminated"], ["Author", "tevador"], ["Fork", "with Seraphis"]],
    repo: "UkoeHB/Seraphis",
    resources: [
      ["Jamtis specification gist", "https://gist.github.com/tevador/50160d160d24cfc6c52ae02eb3d17024", "spec"],
      ["Seraphis pairing", "https://github.com/UkoeHB/Seraphis", "github"],
    ],
  },
  {
    id: "carrot", tag: "Carrot", sub: "Bounded view keys", c: "#5ed3f4", mini: "carrot",
    status: "DESIGN · spec draft", sc: "var(--c-50)", eta: "2027+ · wallet-side", sim: "carrot",
    head: "Give an auditor a keyhole, not the front door.",
    lede: "A new wallet addressing protocol — compatible with FCMP++ era Monero — that allows strictly-bounded disclosure: incoming payments visible, outgoing spends and balance sealed forever.",
    deep: [
      "Carrot (Cryptonote Address on Rerandomizable-RingCT Output Transactions) is jeffro256's answer to the institutional question: how does a business prove revenue to an accountant without handing surveillance-grade access to its whole financial life?",
      "Because it's an addressing protocol rather than a consensus change, Carrot can roll out wallet-by-wallet — no hard fork required — and it's designed to remain compatible with today's addresses.",
    ],
    metrics: [["Disclosure", "incoming only"], ["Spends", "sealed"], ["Balance", "sealed"], ["Fork needed", "none"], ["Author", "jeffro256"], ["Era", "FCMP++"]],
    repo: "jeffro256/carrot",
    resources: [
      ["Carrot specification", "https://github.com/jeffro256/carrot", "github"],
      ["MRL discussions", "https://github.com/monero-project/research-lab/issues", "research-lab"],
    ],
  },
  {
    id: "cuprate", tag: "Cuprate", sub: "Rust full node", c: "#ffd400", mini: "cuprate",
    status: "ALPHA · full sync working", sc: "var(--tk-accent)", eta: "2026–27", sim: "cuprate",
    head: "A second, independent implementation of Monero.",
    lede: "Memory-safe Rust, modern tooling, faster initial sync — and the thing money networks actually need: no single client as a single point of failure.",
    deep: [
      "Since 2014, effectively every Monero node has been monerod. One consensus bug, one poisoned dependency, one bad release — and the network stutters as one. Cuprate breaks the monoculture: an independent codebase that must agree with monerod block-by-block, written by a new generation of contributors (boog900, hinto-janai).",
      "First full mainnet sync landed in 2024. The roadmap runs through P2P hardening, RPC parity, and the long-term goal of a meaningful share of reachable nodes running Rust.",
    ],
    metrics: [["Language", "Rust"], ["Sync", "~1.4× faster"], ["Clients", "1 → 2"], ["First sync", "2024-06"], ["License", "AGPL/MIT"], ["Book", "architecture"]],
    repo: "Cuprate/cuprate",
    resources: [
      ["Cuprate repository", "https://github.com/Cuprate/cuprate", "github"],
      ["Architecture book", "https://architecture.cuprate.org", "docs"],
      ["Monero docs · nodes", "https://docs.getmonero.org", "docs"],
    ],
  },
];

/* ── roadmap rail data ────────────────────────────────────────── */
// v16 and v20 have no FUTURE_PROTOCOLS member (v16 predates this catalogue;
// v20 is a node-share + PQ-research milestone, a different claim than
// Cuprate's own "full sync working" card — see FuturePage TASK 2 audit
// notes) so they keep a literal `d`. v17/v18/v19 derive their status text
// from FUTURE_PROTOCOLS — see roadmapStatus() — so the rail can never
// disagree with the cards again.
export const ROADMAP: readonly RoadmapStop[] = [
  { v: "v16", t: "Ring 16 · CLSAG", d: "2022 · live", c: "var(--g-50)", on: false },
  { v: "v17", t: "FCMP++", protocols: ["fcmp"], c: "#b87aff", on: true },
  { v: "v18", t: "Seraphis + Jamtis", protocols: ["seraphis", "jamtis"], c: "var(--tk-accent)", on: false },
  { v: "v19", t: "Carrot era wallets", protocols: ["carrot"], c: "#5ed3f4", on: false },
  { v: "v20", t: "Cuprate share + PQ prep", d: "2028+ · horizon", c: "#ffd400", on: false },
];

/** Ordered least → most advanced. Only these four tokens are expected as the
 * leading " · "-delimited segment of a FutureProtocol.status string. */
export const PHASE_ORDER = ["DESIGN", "ALPHA", "BETA", "LIVE"] as const;

/** The phase token a status string leads with, e.g. "BETA · audit in
 * progress" → "BETA". Uppercased so callers never have to re-normalize. */
function phaseOf(status: string): string {
  return status.split(" · ")[0]!.trim().toUpperCase();
}

/**
 * Single source of truth for what a roadmap stop's status line reads.
 * A stop with a literal `d` just returns it. A stop that maps onto one or
 * more FUTURE_PROTOCOLS members derives its text as `{date} · {phase}`:
 *   - phase is the LEAST-ADVANCED member's phase token (never an average,
 *     never a third invented state) — a multi-protocol fork isn't done
 *     until every protocol riding it is.
 *   - date is that same least-advanced protocol's own `eta`, taking only
 *     the text before its first " · " (so "2027 · fork v18" contributes
 *     "2027", keeping the rail reading as date + phase, e.g. "2027 · beta").
 * Tie-break: if two mapped protocols land on the same phase rank (as
 * Seraphis and Jamtis both do at BETA), the FIRST one listed in the stop's
 * `protocols` array wins — comparison below is strict `<`, so a later equal
 * rank never displaces the earlier pick. This keeps the result deterministic
 * without inventing a rule the data doesn't already imply (declaration order).
 */
export function roadmapStatus(stop: RoadmapStop): string {
  if ("d" in stop) return stop.d;

  let chosen: FutureProtocol | undefined;
  let chosenRank = Infinity;
  for (const id of stop.protocols) {
    const proto = FUTURE_PROTOCOLS.find((p) => p.id === id);
    if (!proto) continue;
    const rank = PHASE_ORDER.indexOf(phaseOf(proto.status) as (typeof PHASE_ORDER)[number]);
    if (rank !== -1 && rank < chosenRank) {
      chosenRank = rank;
      chosen = proto;
    }
  }
  if (!chosen) return ""; // unreachable given today's data; never fabricate a fallback string

  const phase = phaseOf(chosen.status).toLowerCase();
  const date = chosen.eta.split(" · ")[0]!.trim();
  return `${date} · ${phase}`;
}

/* ── ecosystem panels (xmrhub / kyc.rip / xmr.club / stressnet) ─── */
export const ECOSYSTEM: readonly EcoEntry[] = [
  {
    id: "stressnet", name: "Umbrel Superstress Net", head: "the FCMP++ beta chain, live.",
    kind: "Community testnet · Umbrel apps", status: "LIVE · BETA", c: "#4ade80",
    blurb: "A community FCMP++ stress-test chain running on Umbrel nodes, packaged as Umbrel apps in brainchainz/Monero-Superbrain alongside MoneroSpace, a visual mempool for the beta chain.",
    // The second paragraph deliberately asserts NO provenance for MoneroSpace.
    // An earlier revision claimed it descended from this site's own mempool
    // work; that was never confirmed, and the project's own repo points at a
    // different origin. Naming it and linking it is the honest maximum until
    // its maintainer answers — do not restore a lineage sentence here without
    // a source. verify-future.mjs fails the build if one comes back.
    body: [
      "Before FCMP++ activates on mainnet, the community runs it under fire. The superstress net is a deliberately abused beta chain: storm campaigns, dynamic-block-size pressure, proof-verification load — measured, shared, fixed, repeated.",
      "The same Umbrel app repo publishes MoneroSpace, a visual mempool pointed at the beta chain. Where its interface design comes from is an open question we have put to its maintainer; until that is answered this page names the project and links the repo and claims nothing further either way. Screenshots, endpoints, and the node's story land here as they're provided.",
    ],
    // The wind-tunnel simulator tells this same story from the modelling side:
    // storm intensity in, dynamic block size and fee response out. Gated on
    // SIM_IDS by EcoPopup, exactly like the protocol cards' CTAs.
    simLink: `${R.LEARN_SIM}?p=stressnet`,
    simLabel: "RUN THE STRESSNET SIMULATOR",
    slots: [
      { label: "screenshot · umbrel node dashboard", h: 130 },
      { label: "screenshot · MoneroSpace on the beta chain", h: 130 },
      { label: "telemetry endpoint · to be wired", h: 64 },
    ],
    links: [["MoneroSpace · brainchainz/Monero-Superbrain", "https://github.com/brainchainz/Monero-Superbrain"], ["Umbrel node writeup", null], ["Beta-chain explorer", null], ["MRL stressnet thread", "https://github.com/monero-project/research-lab/issues"]],
  },
  {
    id: "xmrhub", name: "XMRHUB", head: "the ecosystem, in one directory.",
    kind: "Collaborator · directory + swap", status: "PARTNER", c: "#ff7a1a",
    url: "https://xmrhub.org/index.html",
    blurb: "A curated directory of Monero ecosystem resources with a highly-functional XMR swap front-end.",
    body: [
      "XMRHUB collects the working ecosystem — wallets, nodes, explorers, merchants, swap rails — into one navigable directory, with a swap interface that actually works in a hurry.",
      "xmr.irish and XMRHUB cross-link as sister surfaces: we render the protocol, they route you to the tools. Deep-link targets and the swap embed land here once finalized.",
    ],
    slots: [
      { label: "screenshot · xmrhub directory", h: 130 },
      { label: "embed · swap widget (iframe target pending)", h: 96 },
    ],
    links: [["xmrhub.org", "https://xmrhub.org/index.html"]],
  },
  {
    id: "kycrip", name: "kyc.rip", head: "exit the panopticon.",
    kind: "Collaborator · no-KYC resources", status: "PARTNER", c: "#ff4d6d",
    url: "https://kyc.rip/",
    blurb: "A resource for acquiring and using crypto without identity capture — rest in peace, KYC.",
    body: [
      "kyc.rip documents the no-KYC path: where to acquire XMR peer-to-peer, which services respect users, and what surveillance the mainstream on-ramps actually perform.",
      "It pairs naturally with the Education tab's privacy-stack material — the protocol protects you on-chain; kyc.rip helps you arrive on-chain unprofiled.",
    ],
    slots: [{ label: "panel embed · kyc.rip featured guides", h: 150 }],
    links: [["kyc.rip", "https://kyc.rip/"]],
  },
  {
    id: "xmrclub", name: "xmr.club", head: "the social layer.",
    kind: "Collaborator · community", status: "PARTNER", c: "#b87aff",
    url: "https://xmr.club/",
    blurb: "Community hub for Monero people — discussion, projects, culture.",
    body: [
      "xmr.club is where the humans hang out. Project showcases, meetup coordination, and the culture that keeps a cypherpunk project alive across decades.",
      "Panel content and feed embeds land here once the club finalizes its public API surface.",
    ],
    slots: [{ label: "panel embed · xmr.club feed", h: 150 }],
    links: [["xmr.club", "https://xmr.club/"]],
  },
];

/* ── automation registry · actual wiring, not aspiration ─────────
   Reflects the real data seam (data/xmrirish-feed.ts, App.tsx). Since v6.0.6
   chain and market data arrive on THREE polling tiers — FAST 3s (mempool +
   fee estimate), CHAIN 15s (tip watch, full pull only when the tip moves),
   MARKET 60s (CoinGecko) — not the single 2.5s loop this comment and three
   of the rows below used to claim, and `POST /api/monero` was dropped from
   the React client in that same change and the endpoint was deleted in v6.1.7.
   GitHub and getmonero.org route through the same-origin /api/feeds proxy
   (24h edge cache + 24h localStorage) — also live. Genuinely still pending:
   X ingest (X publishes no unauthenticated read API), stressnet telemetry
   (no endpoint exists yet), and the XMRHUB directory feed (no public feed
   exists yet). ─────────────────────────────────────────────────── */
export const AUTOMATION_ROWS: readonly AutomationRow[] = [
  { k: "Repo activity", src: "api.github.com/repos/*, via /api/feeds proxy", mode: "live · 4 repos · 24h edge + localStorage cache", tone: "live" },
  { k: "Dev labs · MRL", src: "research-lab/issues?sort=updated, via /api/feeds", mode: "live · 24h edge + localStorage cache", tone: "live" },
  { k: "Spot price", src: "/api/coingecko?path=simple/price", mode: "live · 60s market tier", tone: "live" },
  { k: "Announcements", src: "getmonero.org, via /api/feeds proxy", mode: "live · 24h edge + localStorage cache", tone: "live" },
  { k: "X · @monero, @MoneroResearchL", src: "x.com — no public API (401)", mode: "link-out only", tone: "pending" },
  // isStale() computes both readouts from live timestamps — pushed_at and the
  // repo's newest issue updated_at — on the pulse rows and in the popup
  // alike. Two signals, never merged: see DevLabPulseCard.
  { k: "Fork ETAs", src: "editorial, sourced from MRL + blog", mode: "live · flags a push idle >90d, separately from issue activity", tone: "live" },
  { k: "Stressnet telemetry", src: "brainchainz/Monero-Superbrain · Superstress", mode: "repo pulse live · telemetry endpoint still pending", tone: "pending" },
  { k: "Ecosystem links", src: "xmrhub directory feed", mode: "pending wiring · no public feed exists yet", tone: "pending" },
  { k: "Chain data", src: "/api/xmr/{tip,mempool,fees,network,blocks}", mode: "live · 3s / 15s tiers, all-real since v5.0.14", tone: "live" },
];
