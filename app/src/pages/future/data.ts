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

export interface EcoBlock {
  label: string;
  /** true → <ol>, false/absent → <ul>. Ordered means the steps must be
   *  followed in sequence. */
  ordered?: boolean;
  lines: readonly string[];
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
  /** owner/name in GitHub's EXACT casing — api.github.com paths are
   *  case-sensitive even where github.com redirects, and this string is
   *  matched against api/feeds.js's GH_ALLOWED. See DevLabPulse.repo above,
   *  which carries the identical contract. */
  repo?: string;
  blurb: string;
  body: readonly string[];
  /** Structured blocks (install steps, command lines) that body[]'s plain
   *  <p> rendering (EcoPopup.tsx:71-73 renders each body string as one
   *  paragraph) cannot carry — a multi-step install sequence folded into
   *  body[] would collapse to a single run-on line with no step structure. */
  blocks?: readonly EcoBlock[];
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
  /**
   * green = wired end-to-end today · amber = NOT wired end-to-end.
   *
   * AMBER DELIBERATELY COVERS TWO DIFFERENT STATES, and saying so is more
   * honest than pretending it covers one. The colour answers "is this row
   * live?", and both states answer no: something that does not exist YET (the
   * XMRHUB directory feed), and something that will never exist because the
   * question was asked and the answer came back no (stressnet telemetry — the
   * chain is self-hosted, so there is no public endpoint to wire).
   *
   * This comment used to read "yellow = needs something that doesn't exist
   * yet". The "yet" was ALREADY false for the X row before p3·19 touched
   * anything: X publishes no unauthenticated read API and is not about to.
   *
   * A third tone was considered and DECLINED. It would put the distinction in
   * a HUE — the channel StatusMark exists precisely to avoid relying on — and
   * it would add a third colour to a registry whose whole job is a two-way
   * live/not-live read. `mode` is prose and carries the difference losslessly,
   * which is where a distinction this verbal belongs.
   */
  tone: "live" | "pending";
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
    // p3·16 adds the hub. This card's `status` already reads "BETA · stressnet
    // live", which is a claim about a chain the reader has no way to reach from
    // here — the hub is the page that says what that chain is and how to join
    // it, so it belongs in the resources list rather than only in the nav.
    // p4·06 — THE TRAIL OF BITS AUDIT. Two rows, each dated by its OWN
    // publisher rather than by one date applied to both, because they are
    // two artifacts:
    //
    //   · the REVIEW is dated Jul 2026. That is Trail of Bits' own Date
    //     column for this entry, and their filename says `2026-07` too.
    //   · the ANNOUNCEMENT is dated Aug 2026 — MAGIC Grants' post.
    //
    // Worth stating because the obvious shortcut is to date the audit by its
    // announcement and write "audited … Aug 2026", which is a month later
    // than the work. `Resource` is a positional tuple [label, href, kind]
    // with no date field, so the date lives in the label; that is the only
    // place it can go without changing the type for every other resource.
    //
    // VERIFIED FROM PRIMARY SOURCE, not from the brief: this sandbox's
    // gateway answers 403 to CONNECT for magicgrants.org, but
    // raw.githubusercontent.com resolves, and Trail of Bits' publications
    // README lists this review under "Cryptography Reviews" — which is what
    // licenses the word "cryptography" below — while the PDF itself returns
    // 200 at 818,386 B. The announcement URL could NOT be reached from here
    // and is carried on the brief's authority; it is an anchor, never a
    // fetch, so a wrong URL is a dead link and never a broken page.
    //
    // NOT CLAIMED: ToB's index marks this entry with their "fix review
    // report" glyph. That is a real fact from their own legend and it is
    // deliberately not rendered — "the findings were fixed" is a completion
    // claim, and this page does not make one it did not verify. The links
    // say what they are and the reader can read them.
    //
    // The `status` line above is UNTOUCHED, and that is a decision. Its
    // first " · "-delimited token is parsed by roadmapStatus() against
    // PHASE_ORDER, so it is load-bearing for the roadmap rail this release
    // is scoped out of; "BETA · stressnet live" is also still true. The
    // audit is fully expressed by these two rows.
    resources: [
      ["Reference implementation", "https://github.com/kayabaNerve/fcmp-plus-plus", "github"],
      ["Trail of Bits · cryptography implementation review · Jul 2026", "https://github.com/trailofbits/publications/blob/master/reviews/2026-07-magicgrants-monerofcmp++crypto-securityreview.pdf", "audit"],
      ["MAGIC Grants · the audit announced · Aug 2026", "https://magicgrants.org/2026/08/17/Monero-FCMP-Cryptography-Implementation-ToB", "blog"],
      ["MRL tracking issue", "https://github.com/monero-project/research-lab/issues/100", "research-lab"],
      ["getmonero.org · FCMP dev update", "https://www.getmonero.org/2024/04/27/fcmps.html", "blog"],
      ["monero-project/monero", "https://github.com/monero-project/monero", "github"],
      ["The stressnet, and how to run a node on it", R.OPERATE_SUPERSTRESS, "site"],
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
/**
 * The five apps the Umbrel community app store publishes — the SHARED SPINE.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────
 * Two surfaces describe these apps: the Superbrain partner brief on
 * /operate/peers (rendered by EcoPopup from the `blocks[]` below) and the
 * Superstress hub on /operate/superstress, which gives each app a row of its
 * own. The one-line function is the line BOTH carry, so it is written here
 * exactly once and the partner entry's "The five apps" block is DERIVED from
 * it (`SUPERBRAIN_APPS.map(...)`, below). Retyping five app descriptions in a
 * second file is how the two would drift, and the drift would be invisible —
 * both would read plausibly, and only a reader who happened to open both
 * would ever see the disagreement.
 *
 * ── AND WHY THE HUB'S PROSE IS **NOT** HERE ──────────────────────────────
 * This carries the SHARED fields only. The hub's per-app essay — what the app
 * is, why running it yourself changes anything, its screenshot slot — lives
 * in SuperstressPage.tsx, keyed by these ids through an exhaustive
 * `Record<SuperbrainAppId, …>` so a new app is a COMPILE ERROR there rather
 * than a silently missing row.
 *
 * That split is MEASURED, not tidiness. This module is imported by
 * FuturePage, TrustedPeersPage and now the hub — three chunk groups, so
 * Rollup mints it its own chunk and every one of those routes downloads all
 * of it. With the essays in here, `/future` measured 106,401 B gzip against a
 * 107,000 ceiling: 599 B of margin on a route this PR barely touches, for
 * prose it never renders. It is the same call `repoPulse.tsx` and
 * `canvasColor.ts` already record — Rollup chunks per MODULE, not per export,
 * so the only way to stop a route paying for something is to put it in a
 * different file. Keep this array to fields BOTH surfaces use.
 *
 * `prereqs` is the app's OWN extra requirements and is shared: the partner
 * entry's `body` names them in prose and the hub renders them as data. Every
 * app in the store also needs the official Monero app — that is the
 * store-wide prerequisite below, stated once rather than on five rows.
 */
export interface SuperbrainApp {
  id: string;
  name: string;
  /** The one-line function. THE single source — the EcoEntry block below
   *  derives its lines from this, and the hub renders it as a row summary. */
  fn: string;
  /** Extra Umbrel apps this one needs, BEYOND the store-wide Monero app. */
  prereqs: readonly string[];
}

/* `as const satisfies` rather than a plain annotation: `satisfies` keeps the
   shape checked while `as const` preserves the id LITERALS, which is what
   makes SuperbrainAppId a five-member union instead of `string`. Without it
   the hub's detail map degrades to Record<string, …> and a missing app stops
   being a compile error — the same mechanism, and the same reasoning, as the
   two Record<ProvSource, …> maps in design/provenance.tsx. */
export const SUPERBRAIN_APPS = [
  {
    id: "superbrain",
    name: "Superbrain",
    fn: "P2Pool + XMRig decentralised mining, accepting external miners over LAN or Tailscale.",
    prereqs: [],
  },
  {
    id: "superpay",
    name: "SuperPay",
    fn: "self-hosted point-of-sale on a view-only wallet; spend keys never leave the device.",
    prereqs: [],
  },
  {
    id: "monerospace",
    name: "MoneroSpace",
    // FUNCTION ONLY, here and on the hub. The provenance question is open with
    // its maintainer; verify-future.mjs §15 sweeps the whole tree for a lineage
    // claim and fails the build on one. Do not enrich this line.
    fn: "self-hosted block explorer and mempool visualiser; reads public chain data from your node.",
    prereqs: ["Bitcoin", "Electrs"],
  },
  {
    id: "superstress",
    name: "Superstress",
    fn: "a full FCMP++ stressnet node routed through Tor, with a wallet lab.",
    prereqs: [],
  },
  {
    id: "superatomic",
    name: "SuperAtomic",
    fn: "XMR/BTC atomic-swap backend to the Eigen network.",
    prereqs: ["Bitcoin", "Electrs"],
  },
] as const satisfies readonly SuperbrainApp[];

/** The five ids as a union — see the `as const satisfies` note above. */
export type SuperbrainAppId = (typeof SUPERBRAIN_APPS)[number]["id"];


/** The prerequisite EVERY app in the store shares — stated once, here, and
 *  rendered once on the hub rather than repeated on five rows. */
export const SUPERBRAIN_SHARED_PREREQ = "Monero";

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
      "The same Umbrel app repo publishes MoneroSpace, a visual mempool pointed at the beta chain. Where its interface design comes from is an open question we have put to its maintainer; until that is answered this page names the project and links the repo and claims nothing further either way. Screenshots and the node's story land here as they're provided.",
      // The endpoint half of that sentence was retired in p3·19: the chain is
      // self-hosted and runs its own daemon, so there is no public endpoint to
      // wire and none is planned. Said here rather than left as an absence,
      // because "we are still waiting" and "the answer is no" look identical
      // on a page that simply stops mentioning it. The MoneroSpace clause
      // above is a DIFFERENT open question and is still genuinely open.
      // NO bare route path in this sentence. An early draft closed it with
      // "/operate/superstress is the guide to running one", which renders in
      // EcoPopup as INERT TEXT — the modal renders `body` as plain paragraphs —
      // while `links` below already carries that exact destination as a real
      // anchor. A path a reader cannot click, one scroll above the same path
      // they can, is worse than no path. Found by reading the rendered modal.
      "The chain itself is self-hosted: every node on it is somebody's own box, so there is no public endpoint for a dashboard to read and none is coming. The hub linked below is the guide to running one.",
    ],
    // The wind-tunnel simulator tells this same story from the modelling side:
    // storm intensity in, dynamic block size and fee response out. Gated on
    // SIM_IDS by EcoPopup, exactly like the protocol cards' CTAs.
    simLink: `${R.LEARN_SIM}?p=stressnet`,
    simLabel: "RUN THE STRESSNET SIMULATOR",
    // The two screenshot slots stay: screenshots were promised as-provided and
    // still may arrive, so an honest reservation is still honest. The third
    // slot — "telemetry endpoint · to be wired" — was retired in p3·19. A
    // reserved box is a promise that the thing is coming, and this one is not:
    // the chain is self-hosted and has no public endpoint by design. Note that
    // EcoPopup renders every slot identically, so a slot cannot express
    // "answered no" — the only honest form for that is prose, which body[2]
    // now carries.
    slots: [
      { label: "screenshot · umbrel node dashboard", h: 130 },
      { label: "screenshot · MoneroSpace on the beta chain", h: 130 },
    ],
    // p3·16 replaces the null "Umbrel node writeup" placeholder with the hub
    // that IS the Umbrel node writeup — the placeholder was a promise of a
    // page, and the page now exists on this site. "Beta-chain explorer" stays
    // null because nothing has been supplied for it; an honest placeholder is
    // only dishonest once the thing it stands for arrives.
    links: [["MoneroSpace · brainchainz/Monero-Superbrain", "https://github.com/brainchainz/Monero-Superbrain"], ["The Superstress hub · on this site", R.OPERATE_SUPERSTRESS], ["Beta-chain explorer", null], ["MRL stressnet thread", "https://github.com/monero-project/research-lab/issues"]],
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
    // p4·06 — REWRITTEN. Every string in this entry described a different
    // site. It said "the social layer", "Community hub for Monero people —
    // discussion, projects, culture", and "where the humans hang out …
    // meetup coordination". xmr.club is a manually audited no-KYC DIRECTORY
    // with a published grading rubric. On the one page whose whole subject is
    // who we vouch for, describing a partner as something it is not is the
    // ethos inverted — so this is a correction, not a copy edit.
    //
    // SOURCED FROM THE SITE'S OWN HEADINGS, and every clause below traces to
    // one: the title "xmr.club — 2026 No-KYC Monero Directory · Manually
    // Audited"; "No-KYC services for the Monero economy"; "Directory index";
    // "recently verified"; "methodology · public rubric"; and "curator's
    // stack · what the curator actually uses".
    //
    // NO COUNTS, deliberately. Listing and category totals were available and
    // are not written here: a number like that rots the day the directory
    // grows, and this file has already paid for a figure nothing re-measures.
    // Describe what the thing IS, never how much it holds.
    //
    // NOT RE-PROBEABLE FROM CI OR FROM THIS SANDBOX — the gateway answers 403
    // to CONNECT for xmr.club, so no gate can check these sentences against
    // the live site and none pretends to. They are the operator's to review.
    id: "xmrclub", name: "xmr.club", head: "the directory that shows its marking.",
    kind: "Collaborator · audited directory", status: "PARTNER", c: "#b87aff",
    url: "https://xmr.club/",
    blurb: "A manually audited index of no-KYC services for the Monero economy, graded against a rubric the site publishes.",
    body: [
      "xmr.club is a directory with a marking scheme. Entries are checked by hand rather than crowd-submitted, each carries when it was last verified, and the methodology they are graded against is published on the site — so a reader who disagrees with a rating can see exactly which criterion they are disagreeing with.",
      // The differentiation is load-bearing: two partners cannot both be "the
      // no-KYC one" without this page saying how they differ. kyc.rip's own
      // entry describes the ROUTE (where to acquire XMR peer-to-peer, what the
      // mainstream on-ramps record); this one grades the DESTINATIONS.
      "It sits beside kyc.rip rather than on top of it. kyc.rip documents the route — how to arrive on-chain unprofiled, and what the mainstream on-ramps actually record. xmr.club grades the places that route ends at, and publishes a curator's stack naming what the curator actually uses.",
    ],
    slots: [{ label: "screenshot · xmr.club directory index", h: 150 }],
    links: [["xmr.club", "https://xmr.club/"]],
  },
  {
    id: "superbrain", name: "Monero Superbrain", head: "run the whole stack yourself.",
    kind: "Collaborator · sovereignty tooling", status: "PARTNER",
    // Distinct hue: stressnet #4ade80, xmrhub #ff7a1a, kycrip #ff4d6d,
    // xmrclub #b87aff — this is the fifth panel and fourth PARTNER, so it
    // gets its own colour rather than reusing one that already carries
    // meaning elsewhere on the page.
    c: "#22d3ee",
    url: "https://github.com/brainchainz/Monero-Superbrain",
    repo: "brainchainz/Monero-Superbrain",
    blurb: "An Umbrel community app store packaging five Monero apps for self-hosting — sovereignty tooling you run on your own hardware, not a site you visit.",
    body: [
      "An Umbrel community app store is a third-party catalogue pointed at from your own Umbrel node — not a hosted service, not a login, a directory of apps that install onto hardware you already own. Everything in it runs on your box, reads what your box can see, and stays up exactly as long as you keep it running.",
      "The official Monero app is the one prerequisite every app here shares. MoneroSpace and SuperAtomic ask for more: both additionally need Bitcoin and Electrs installed first, since each reads chain state that neither the Monero node nor the store itself provides.",
      "SuperAtomic's swap engine is a GPLv3 fork of eigenwallet/core, and the complete corresponding source is published at github.com/brainchainz/eigenwallet-core. That is real licence compliance, not a footnote, and it is worth naming in public.",
    ],
    blocks: [
      {
        label: "The five apps",
        // DERIVED from SUPERBRAIN_APPS above, not retyped. These five lines
        // and the Superstress hub's five row summaries are the same sentences,
        // and they used to be the same sentences in two files — which is a
        // drift that reads plausibly on both surfaces and is visible only to
        // someone who happens to open both. verify-peers §4 still asserts all
        // five NAMES render here, so the derivation cannot silently empty.
        lines: SUPERBRAIN_APPS.map((a) => `${a.name} — ${a.fn}`),
      },
      {
        label: "Install · Umbrel community app store",
        ordered: true,
        lines: [
          "Open your Umbrel dashboard",
          "App Store → Community App Stores",
          "Add → paste: https://github.com/brainchainz/Monero-Superbrain",
          "Install from the Brainchainz store",
        ],
      },
      {
        label: "Point external miners at Superbrain",
        lines: ["xmrig -o umbrel.local:8888 -u \"Rig Name\" -p x"],
      },
    ],
    slots: [
      { label: "screenshot · umbrel community store listing", h: 130 },
      { label: "screenshot · superbrain mining dashboard", h: 130 },
    ],
    // Link[0]'s label doubles as the card footer's short "visit X" text
    // (TrustedPeersPage.tsx derives `primary` from links[0]) — kept short
    // like its siblings' domain-style labels (xmrhub.org, kyc.rip, xmr.club)
    // rather than the full repo path, so the footer row doesn't wrap.
    // p3·16 appends the hub LAST, deliberately. TrustedPeersPage derives the
    // card footer's "visit X ↗" text from the first link that HAS an href
    // (`links.find(([, href]) => href)`), so anything inserted ahead of
    // "Superbrain" would silently rewrite that footer and, being longer, wrap
    // it — the exact failure the note above this array exists to prevent.
    links: [
      ["Superbrain", "https://github.com/brainchainz/Monero-Superbrain"],
      ["eigenwallet-core source (GPLv3)", "https://github.com/brainchainz/eigenwallet-core"],
      ["Umbrel app store listing", null],
      ["The Superstress hub · on this site", R.OPERATE_SUPERSTRESS],
    ],
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
   X ingest (X publishes no unauthenticated read API) and the XMRHUB directory
   feed (no public feed exists yet).

   STRESSNET TELEMETRY IS NO LONGER ON THAT LIST, and the distinction is the
   point: it is not pending, it is ANSWERED NO. The maintainer confirmed the
   chain is self-hosted and runs its own daemon, so there is no public endpoint
   to wire and none is planned. "Pending" and "answered no" render the same
   amber here, which is a limit of a two-value tone rather than a claim — see
   the AutomationRow docblock. ─────────────────────────────── */
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
  // Half live, half permanently not applicable — and amber is right for the
  // row as a whole, because the row is not wired end-to-end and never will be.
  // Green would claim it is. See the `tone` docblock for why there is no third
  // colour for "answered no".
  { k: "Stressnet telemetry", src: "brainchainz/Monero-Superbrain · Superstress", mode: "repo pulse live · no public endpoint, by design — the chain is self-hosted", tone: "pending" },
  { k: "Ecosystem links", src: "xmrhub directory feed", mode: "pending wiring · no public feed exists yet", tone: "pending" },
  { k: "Chain data", src: "/api/xmr/{tip,mempool,fees,network,blocks}", mode: "live · 3s / 15s tiers, all-real since v5.0.14", tone: "live" },
];
