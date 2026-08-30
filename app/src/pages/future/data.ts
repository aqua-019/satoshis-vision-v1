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

/**
 * A dated, third-party REVIEW of one protocol, rendered as CONTENT rather than
 * as one more row in `resources`.
 *
 * ── WHY THIS IS A FIELD AND NOT A PARAGRAPH IN `deep` ────────────────────
 * `deep` is this site's own prose about how a protocol works. A review is
 * somebody else's finding about a specific artifact at a specific commit on a
 * specific date, and those three qualifiers are the whole value: without them
 * "it was audited" is a reassurance rather than a fact. Keeping it a separate
 * shape is what lets the renderer show the qualifiers every time and lets a
 * gate assert they are present.
 *
 * ── `scope` IS LOAD-BEARING AND MUST NARROW ──────────────────────────────
 * The failure mode this field exists to prevent is the reader concluding "the
 * protocol was audited" from "an implementation of part of it was reviewed".
 * `scope` names what was actually looked at. A `scope` that restates the
 * protocol's own name is a defect, not a shortcut.
 *
 * ── `dated` IS THE REPORT'S OWN DATE ─────────────────────────────────────
 * Not the announcement's, not today's. Same doctrine as `EcoShot.captured`
 * and `LEGALITY_MATRIX.reviewed`: a finding starts aging the moment it is
 * published, and undated it silently claims to be current.
 */
export interface ProtoReview {
  /** Who performed it. */
  by: string;
  /** What was actually examined — narrower than the protocol. See above. */
  scope: string;
  /** The report's own date, rendered verbatim. */
  dated: string;
  /** The finding, in the reviewer's terms. Hedges in the source survive. */
  lines: readonly string[];
  /** The report itself, so the reader can check every sentence above. */
  href: string;
}

export interface FutureProtocol {
  id: string;
  tag: string;
  sub: string;
  c: string; // literal hex, used inline for textShadow/borderColor
  mini: MiniMode;
  status: string;
  sc: string; // a `var(--…)` string
  eta: string;
  /**
   * The word the card prints before `eta`. Defaults to "ETA".
   *
   * It exists because one of these five has SHIPPED, and "ETA released" is a
   * contradiction. `eta` is a string rendered after a label; when the thing
   * has arrived, the label is the part that has to change, not the date.
   */
  etaLabel?: string;
  /**
   * Present ONLY when a reader can run this today, and then it says what they
   * can do, dated.
   *
   * Its PRESENCE is also the page's grouping key — FuturePage puts every
   * protocol carrying it in the "live to try" band. One field decides both,
   * deliberately: a separate boolean could disagree with the sentence, and a
   * grouping that disagrees with its own copy is the defect this file's
   * `roadmapStatus()` was written to prevent one level up.
   */
  live?: string;
  sim: string | null; // simulator id, or null when none exists — see SIM_IDS
  head: string;
  lede: string;
  deep: readonly string[];
  /** A dated third-party review of this protocol, if one exists. */
  review?: ProtoReview;
  metrics: readonly Metric[];
  repo: string; // owner/name
  resources: readonly Resource[];
}

/**
 * A partner screenshot — a real capture, self-hosted, dated.
 *
 * THERE IS NO LONGER AN EMPTY COUNTERPART, AND THAT IS THE POINT (p4·M6b).
 * A reservation type used to sit beside this one, rendered as a dashed box
 * captioned "screenshot · <thing>", meaning "this artifact has not arrived".
 * It is gone — the type, the field and the markup — because on a live page a
 * dashed empty box does not read as a reservation. It reads as an image that
 * FAILED TO LOAD, which tells the reader the page is broken rather than that
 * the picture was never taken. On a site whose whole discipline is honest
 * absence, that is the one shape of absence that lies.
 *
 * So the rule is structural rather than remembered: A SCREENSHOT SLOT WITH AN
 * IMAGE SHIPS, AND CARRIES ITS CAPTURE DATE. A SCREENSHOT SLOT WITHOUT AN
 * IMAGE DOES NOT EXIST — an entry with no capture renders nothing at all, and
 * there is no type left in which to express a pending one.
 *
 * p4·M5 stated that rule in this file's own words, ~200 lines below, while
 * retiring the stressnet reservations. It was not applied to the Superbrain
 * entry in the same pass, which went on rendering two empty boxes for another
 * release — which is why the rule is now a deleted mechanism and a gate
 * (verify-peers §11) rather than a paragraph.
 *
 * `captured` IS NOT DECORATION. A screenshot is a point-in-time reading of
 * somebody else's site, and it starts going stale the moment it is taken —
 * exactly the property every live figure on this site carries a provenance
 * badge for. Undated, it silently claims to be current; dated, a reader can
 * weigh it. Same doctrine as `LEGALITY_MATRIX`'s `reviewed` field: the date
 * says when the capture was made, and asserts nothing about whether the site
 * still looks like this.
 *
 * `src` MUST be a same-origin path under `/peers/`. `vercel.json` ships
 * `img-src 'self' data:`, so an off-origin screenshot is not a slow image, it
 * is a BLOCKED one — and the site is read over Tor, where a third-party image
 * request is a deanonymisation surface rather than a performance note.
 * verify-peers §9 asserts the path shape; verify-origins phase 2 opens a brief
 * and counts the requests, which is the half that catches an off-origin src
 * that happens to load.
 */
export interface EcoShot {
  /** Same-origin, under /peers/. Never an absolute URL — see above. */
  src: string;
  alt: string;
  /** ISO day, YYYY-MM-DD. Rendered verbatim as "captured <date>". */
  captured: string;
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
  /**
   * A SECOND primary control, beside the simulator CTA. Same shape as
   * `simLink`/`simLabel` above, deliberately — a reader meeting two buttons
   * should meet two of the same thing.
   *
   * ── WHY NOT JUST A `links[]` ROW ─────────────────────────────────────
   * It was one. `links[]` renders `.v6-res` chips at 28px in a wrapped row
   * under a "Links" rule, which is where a reader goes to leave; the ask was
   * for a control they meet while reading. The destination therefore appears
   * ONCE, here, and its former chip is gone — a page that offers the same
   * place twice in one dialog is teaching the reader that one of them is
   * different when it is not.
   *
   * A leading "/" means an in-app route and is navigated through the router
   * with the dialog closed first, exactly as `links[]` and `resources[]`
   * already do. That convention is declared once at `DevLabPulse.href`.
   */
  ctaLink?: string;
  ctaLabel?: string;
  /** One real, dated screenshot. Optional — an entry with none renders
   *  nothing in its place. See EcoShot's header for why there is no longer
   *  an empty counterpart to fall back to. */
  shot?: EcoShot;
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
    // p4·M5 — ETA RE-DERIVED FROM THE PUBLISHED PLAN, and it moved by two
    // quarters. It read "Q3 2026 · fork v17", which was already inside the
    // quarter it named. jeffro256's `fcmp-carrot-plan` — the working plan for
    // this fork, Manager "jeffro256", Company "The Monero Project" — carries
    // its own Finish field of March 4, 2027, and its README states
    // independently that activation lands "in week 9 of 2027". ISO week 9 of
    // 2027 is Mar 1-7, so the two agree. The fork NUMBER is untouched: the
    // plan speaks to schedule, never to v17.
    //
    // THE PLAN DISCLAIMS ITS OWN ACCURACY, IN ITS OWN CAUTION BLOCK — "a
    // non-binding working draft … I make no guarantee of its accuracy … or if
    // the update fails to materialize at all". That is why `deep` below
    // attributes the date to the plan rather than asserting it, and why the
    // plan is a cited resource rather than an invisible source.
    status: "BETA · stressnet live", sc: "var(--y-50)", eta: "Mar 2027 · fork v17", sim: "fcmp",
    head: "The anonymity set goes from 16 to the entire chain.",
    lede: "Today every spend hides among 15 decoys. FCMP++ replaces the ring with a zero-knowledge proof that the spent output exists somewhere in the full set of ~150 million — without revealing which.",
    deep: [
      "The ring signature was always a compromise: big enough to give plausible deniability, small enough to verify fast. FCMP++ (Full-Chain Membership Proofs, plus spend authorization, plus key images) dissolves the compromise. The proof says 'this input is one of every output that has ever existed' — a curve-tree membership proof over the whole chain.",
      "Statistical decoy analysis, the workhorse of every chain-surveillance contract ever sold against Monero, stops being a research field. There is no distribution to fit when the candidate set is the entire UTXO history.",
      "It activates as hard fork v17 without changing addresses or breaking wallets — Seraphis-grade privacy on the current transaction format.",
      "Carrot rides the same fork. jeffro256's working plan for the release is titled FCMP++/Carrot and treats them as one hard fork, with the Carrot merges landing before the activation task; that plan targets March 2027, and says of itself that it is a non-binding draft that guarantees nothing about its own timeline.",
    ],
    // p4·M5 — THE FINDING, NOT ANOTHER LINK. Both audit URLs already shipped
    // at p4·06; what was missing was the RESULT, which no reader gets from a
    // filename. Every sentence below is quoted or derived from the report
    // itself, which this sandbox fetched from raw.githubusercontent.com
    // (818,386 B, http 200) rather than from the announcement post — that
    // host answers 403 to CONNECT here, so the report is both the stronger
    // source and the only reachable one.
    //
    // FOUR THINGS ARE DELIBERATE:
    //  · "appear to" survives. The report hedges twice ("appear to be
    //    correct", "none appear to lead to"), and an unhedged restatement
    //    would be a stronger claim than the auditors made.
    //  · the fix review is REPORTED, because it is in the report's own
    //    Appendix B with a date and per-finding PR numbers. p4·06 and p4·07
    //    both declined to render Trail of Bits' index GLYPH as a completion
    //    claim and that reasoning stands — a glyph in a legend is not
    //    evidence. Appendix B is. Different artifact, different standard.
    //  · the scope names phases 1a AND 1b. The report says both.
    //  · the last line exists so the reader cannot conclude "the network was
    //    audited" from "an implementation was reviewed". FCMP++ is not on
    //    mainnet, and the sentence that says so is the one that makes the
    //    rest of the block honest.
    review: {
      by: "Trail of Bits",
      scope: "the FCMP++ cryptography implementation — phases 1a and 1b of the integration audit plan, at one commit of monero-project/monero (PR #10360)",
      dated: "15 July 2026",
      lines: [
        "Six findings, every one of them informational: none high, none medium, none low. The reviewers' own summary is that the changes “appear to be correct”, and that none of the six “appear to lead to incorrect results or exploitable behavior within the Monero system”.",
        "At the fix review on 15 June 2026 the Monero team had resolved five of the six and partially resolved the last.",
        "This reviewed one implementation of part of FCMP++, at one commit. It is not a review of the protocol, and it is not a review of a running network — FCMP++ has not activated on mainnet.",
      ],
      href: "https://github.com/trailofbits/publications/blob/master/reviews/2026-07-magicgrants-monerofcmp++crypto-securityreview.pdf",
    },
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
      // Linked, NOT transcribed. Its checkboxes are the live state of the
      // launch list and would be stale here within a week — the link is the
      // only form of it that cannot rot.
      ["seraphis-migration · TODO list for launch", "https://github.com/seraphis-migration/monero/issues/53", "issue"],
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
    // p4·M5 — BOTH FIELDS RE-DERIVED, and both were wrong in the same
    // direction: they described Carrot as a later, separate, wallet-side
    // effort. Three primary sources say otherwise and none of them is this
    // site: jeffro256's plan repo is named `fcmp-carrot-plan` and its README
    // describes "the FCMP++/Carrot hardfork of Monero" — one fork; the plan's
    // own task list puts `carrot_core merge`, `carrot_impl merge` and
    // `carrot-fcmp integration merges` before its `HF activation merge`; and
    // the Carrot specification's opening sentence calls it "an addressing
    // protocol for the upcoming FCMP++ upgrade to Monero".
    //
    // "DESIGN · spec draft" -> "BETA": the specification is a finished
    // document carrying no draft marker, and the plan records UkoeHB's review
    // of `carrot_impl` as COMPLETE while the three merge tasks sit at 0%. So
    // the implementation exists and has been reviewed, and has not shipped —
    // which is the same standing Jamtis is already described with, and is
    // strictly past "spec draft".
    //
    // `sc` moves with the phase: every other BETA card on this page uses
    // --y-50, and a status colour that disagrees with its own status token is
    // a second reading of the same fact.
    status: "BETA · merging for the FCMP++ fork", sc: "var(--y-50)", eta: "Mar 2027 · with FCMP++", sim: "carrot",
    head: "Give an auditor a keyhole, not the front door.",
    lede: "A new wallet addressing protocol — compatible with FCMP++ era Monero — that allows strictly-bounded disclosure: incoming payments visible, outgoing spends and balance sealed forever.",
    deep: [
      "Carrot (Cryptonote Address on Rerandomizable-RingCT Output Transactions) is jeffro256's answer to the institutional question: how does a business prove revenue to an accountant without handing surveillance-grade access to its whole financial life?",
      // KEPT, because it is a true property of the design and not a schedule.
      // What follows it is the schedule, so the two can no longer be read as
      // one claim — "needs no fork of its own" was being read as "ships later,
      // separately", which the plan contradicts.
      "Because it's an addressing protocol rather than a consensus change, Carrot can roll out wallet-by-wallet — no hard fork required — and it's designed to remain compatible with today's addresses.",
      "That is a property of the design, not a release schedule. In practice Carrot is shipping WITH FCMP++: the working plan for the fork is titled FCMP++/Carrot, and it merges carrot_core, carrot_impl and the carrot-fcmp integration before the activation task. As of 30 August 2026 that plan records the implementation review as done and all three merges as still ahead of it.",
    ],
    // "Fork needed · none" is about CARROT'S OWN requirement and stays true;
    // "Ships with" is the schedule, and the pair is what stops either being
    // read as the other.
    metrics: [["Disclosure", "incoming only"], ["Spends", "sealed"], ["Balance", "sealed"], ["Fork needed", "none"], ["Ships with", "FCMP++"], ["Author", "jeffro256"]],
    repo: "jeffro256/carrot",
    resources: [
      ["Carrot specification", "https://github.com/jeffro256/carrot", "github"],
      // The schedule's source, cited rather than silently consumed — and
      // labelled with what it says about itself, because a plan that
      // disclaims its own accuracy should not be linked as if it were a
      // commitment.
      ["jeffro256 · FCMP++/Carrot plan · non-binding working draft", "https://github.com/jeffro256/fcmp-carrot-plan", "plan"],
      // The concrete prerequisite the plan schedules twice (tasks 11 and 13).
      // Linked, never described by STATE: api.github.com answers 403 through
      // this sandbox's gateway, so "open"/"merged" is a claim nothing here
      // could check, and an anchor with a wrong state in its label is worse
      // than an anchor with none.
      ["monero-project/monero · external: add mx25519", "https://github.com/monero-project/monero/pull/10964", "pr"],
      ["MRL discussions", "https://github.com/monero-project/research-lab/issues", "research-lab"],
    ],
  },
  {
    id: "cuprate", tag: "Cuprate", sub: "Rust full node", c: "#ffd400", mini: "cuprate",
    // p4·M5 — CUPRATE SHIPPED SOMETHING RUNNABLE AND THIS CARD DID NOT SAY SO.
    // It read "ALPHA · full sync working" / "ETA 2026-27", which described a
    // project you could watch rather than one you could run.
    //
    // WHAT IS VERIFIED FROM HERE, AND WHAT IS NOT — the two are different and
    // the difference is stated rather than blurred. `cuprate.org` answers 000
    // through this sandbox's gateway, so the release POST was not fetched
    // here; it is the operator's reading, and it is cited as a resource, which
    // is an anchor rather than a fetch. What WAS reproduced from a reachable
    // host is the version string itself: `binaries/cuprated/Cargo.toml` on
    // Cuprate/cuprate@main declares `version = "0.1.0-preview"`.
    //
    // THE FENCE, honoured deliberately: the release calls itself BETA and
    // PREVIEW and both words survive into the status. Nothing here says
    // production-ready, mainnet-ready, or safe for funds — that question was
    // put to the release and it does not answer it, and an absence of a
    // warning is not a clearance. What is claimed is the CAPABILITY, which
    // the release does state: wallets connect, sync, and send.
    //
    // `etaLabel` exists because "ETA released" is a contradiction; see the
    // field's own note on FutureProtocol.
    status: "BETA · 0.1.0-preview released", sc: "var(--y-50)",
    eta: "0.1.0-preview · Aug 2026", etaLabel: "RELEASED", sim: "cuprate",
    live: "A beta preview is out — as of 30 August 2026 wallets can connect to a Cuprate node and use it to sync and send, instead of monerod. Its own authors call it beta, a preview, and a work in progress.",
    head: "A second, independent implementation of Monero.",
    lede: "Memory-safe Rust, modern tooling, faster initial sync — and the thing money networks actually need: no single client as a single point of failure.",
    deep: [
      "Since 2014, effectively every Monero node has been monerod. One consensus bug, one poisoned dependency, one bad release — and the network stutters as one. Cuprate breaks the monoculture: an independent codebase that must agree with monerod block-by-block, written by a new generation of contributors (boog900, hinto-janai).",
      "First full mainnet sync landed in 2024. The roadmap runs through P2P hardening, RPC parity, and the long-term goal of a meaningful share of reachable nodes running Rust.",
      "In August 2026 that stopped being something to watch and became something to run: the Beta 0.1.0-preview release reports that wallets can connect to a Cuprate node and use it to sync and send in place of monerod. It is a preview, and the project still describes itself as a work in progress — the release makes no claim about production use, and neither does this page.",
    ],
    metrics: [["Language", "Rust"], ["Sync", "~1.4× faster"], ["Clients", "1 → 2"], ["Release", "0.1.0-preview"], ["License", "AGPL/MIT"], ["Book", "architecture"]],
    repo: "Cuprate/cuprate",
    resources: [
      ["Cuprate repository", "https://github.com/Cuprate/cuprate", "github"],
      // Dated in the label, because a preview version number ages fast and
      // `Resource` is a positional tuple with nowhere else to put a date.
      ["Cuprate · Beta 0.1.0-preview “Kesterite” released · Aug 2026", "https://cuprate.org/blog/release-cuprate-0-1-0-preview-kesterite/", "release"],
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
// p4·M5 — THE v19 STOP IS GONE, AND THAT IS A CORRECTION RATHER THAN A
// REDESIGN. It read "v19 · Carrot era wallets" and mapped Carrot to a fork of
// its own. Three primary sources say Carrot activates at the FCMP++ fork
// instead (see the Carrot card above for all three), so the rail was asserting
// a fork that the people building it do not plan. A stop that names a fork
// nobody is shipping is not a placeholder — it is a claim, and it was false.
//
// Carrot therefore joins v17. `roadmapStatus()` already handles a
// multi-protocol stop: it derives from the LEAST-advanced member, so v17 now
// reads for both, and the tie between two BETA cards resolves to the first
// listed, which is FCMP++.
//
// The rail is four stops. v18 -> v20 skips a number, which is honest: fork
// numbers are the network's, not this page's, and inventing a v19 to keep the
// sequence tidy is how the false stop got here.
//
// SERAPHIS AND JAMTIS ARE DELIBERATELY UNTOUCHED. Their "2027 · fork v18" now
// sits oddly close to v17's March 2027 — but no source reachable from here
// speaks to their schedule, and re-deriving one card from evidence while
// guessing at the next is worse than leaving the guess visible. Named in the
// release report as an open question rather than quietly adjusted.
export const ROADMAP: readonly RoadmapStop[] = [
  { v: "v16", t: "Ring 16 · CLSAG", d: "2022 · live", c: "var(--g-50)", on: false },
  { v: "v17", t: "FCMP++ + Carrot", protocols: ["fcmp", "carrot"], c: "#b87aff", on: true },
  { v: "v18", t: "Seraphis + Jamtis", protocols: ["seraphis", "jamtis"], c: "var(--tk-accent)", on: false },
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
    // p4·M5 — the simulated explorer was already here, as the third `.v6-res`
    // chip in `links` below. It is now a control rather than a chip, and it is
    // REMOVED from `links` rather than duplicated: one destination, one
    // affordance. "SIMULATED" leads the label because the reader decides what
    // to expect when they read the button, not when the page they land on
    // tells them.
    ctaLink: R.OPERATE_SUPERSTRESS_EXPLORER,
    ctaLabel: "OPEN THE SIMULATED BETA-CHAIN EXPLORER",
    // p4·M5 — ONE RESERVATION IS SATISFIED AND THE OTHER IS RETIRED, under one
    // rule rather than two special cases: a screenshot slot with an image
    // ships and carries its capture date; a slot with no image does not exist.
    //
    // p4·M6b — AND THAT RULE IS NOW STRUCTURAL. The reservation mechanism it
    // was written against is gone entirely: no type, no field, no markup, so
    // "a slot with no image" is not a state this file can express any more.
    // The earlier note here recorded that a reserved box cannot say "answered
    // no" — that a reservation reads as a promise the thing is coming, which
    // for the telemetry endpoint was false by design. That reasoning is why
    // the mechanism went; the prose it recommended (body[2]) is what carries
    // the answer.
    //
    // SLOT 1 — "screenshot · umbrel node dashboard" — IS SATISFIED by the
    // capture below, and this is the decision rather than an inheritance. The
    // same file already renders in the Monero Superbrain brief, so it was
    // worth asking whether reusing it is duplication. Measured: it is not
    // visible twice anywhere. `/future` can open exactly ONE ecosystem popup
    // (FuturePage's only setEco call names "stressnet"), and
    // `/operate/peers` filters to `status === "PARTNER"`, which this entry is
    // not — so the two popups are on two different pages and no reader meets
    // the image twice on one. p4·M3 refused this same file for BOTH of
    // Superbrain's reservations, correctly: those name a store listing and a
    // mining dashboard, and it is neither. It IS an Umbrel node dashboard,
    // which is what slot 1 named. A reservation is satisfied by the artifact
    // it names — and this one names it.
    //
    // SLOT 2 — "screenshot · MoneroSpace on the beta chain" — is DELETED. No
    // such capture exists, and a dashed box on a live page reads as an image
    // that failed to load rather than as an artifact nobody has taken. If one
    // arrives it returns as a `shot` with its own date, never as a
    // placeholder.
    //
    // THE CAPTION IS THE HONESTY. The node in this capture has synced
    // nothing — TESTNET, difficulty 0, transaction count 0, database 0 B, no
    // top block, every connection count 0 — so the alt text says that. This
    // entry's own headline is "the FCMP++ beta chain, live", and an
    // undescribed screenshot of an empty node underneath it would let a
    // reader take the picture as evidence of the sentence.
    shot: {
      src: "/peers/peer-superbrain.webp",
      alt: "The Superstress app's monitor tab on a Tor-only Umbrel node, running v0.19.0.0-beta.2.0: network TESTNET, difficulty 0, transaction count 0, database size 0 B, no top block yet and every connection count at zero — a node that has just been installed and has not begun syncing.",
      captured: "2026-08-18",
    },
    // p3·16 replaces the null "Umbrel node writeup" placeholder with the hub
    // that IS the Umbrel node writeup — the placeholder was a promise of a
    // page, and the page now exists on this site.
    //
    // p4·07 closes the last null on the same test that sentence set: an honest
    // placeholder is only dishonest once the thing it stands for arrives, and
    // something has now arrived. Note carefully WHAT: not the beta-chain
    // explorer that row was reserving, which would need a public endpoint that
    // does not exist and is not coming. What arrived is a SIMULATED one — the
    // wind tunnel rendered in the classic explorer's layout — so the label
    // carries "simulated" and does so BEFORE the destination, because a reader
    // decides whether to expect a chain reading at the moment they read the
    // link, not when the banner tells them on arrival.
    // The explorer chip is GONE from this row — it is `ctaLink` above now.
    // Leaving both would put one destination in two affordances in one
    // dialog, which teaches the reader that they differ.
    links: [["MoneroSpace · brainchainz/Monero-Superbrain", "https://github.com/brainchainz/Monero-Superbrain"], ["The Superstress hub · on this site", R.OPERATE_SUPERSTRESS], ["MRL stressnet thread", "https://github.com/monero-project/research-lab/issues"]],
  },
  {
    id: "xmrhub", name: "XMRHUB", head: "the ecosystem, in one directory.",
    kind: "Collaborator · directory + swap", status: "PARTNER", c: "#ff7a1a",
    url: "https://xmrhub.org/index.html",
    blurb: "A curated directory of Monero ecosystem resources with a highly-functional XMR swap front-end.",
    body: [
      "XMRHUB collects the working ecosystem — wallets, nodes, explorers, merchants, swap rails — into one navigable directory, with a swap interface that actually works in a hurry.",
      // p4·M3 — THE SWAP-EMBED PROMISE IS GONE FROM THIS SENTENCE, and deleting
      // the slot without deleting the clause would have been the worse half of
      // the change: a page promising an embed with no box reserved for it reads
      // as an oversight, where the box at least said what was missing. The
      // reason the embed is not coming is structural rather than editorial —
      // `vercel.json` ships no `frame-src` at all under a `connect-src 'self'`
      // policy, so a third-party swap iframe is refused by the browser before
      // it is refused by anyone here. Deep-link targets survive: those are
      // ordinary anchors and cost nothing.
      "xmr.irish and XMRHUB cross-link as sister surfaces: we render the protocol, they route you to the tools. Deep-link targets land here once finalized.",
    ],
    shot: {
      src: "/peers/peer-xmrhub.webp",
      alt: "The XMRHUB home page: a Monero portal with Buy, Swap, Directory, Learn, Social, Shop and Forum sections above a live XMR/USD chart.",
      captured: "2026-08-18",
    },
    // BOTH reservations retired here in p4·M3, for two DIFFERENT reasons:
    //   · "screenshot · xmrhub directory" — SATISFIED. The capture above is it.
    //   · "embed · swap widget (iframe target pending)" — NEVER COMING, per the
    //     CSP note on body[1]. A reservation is honest right up until the thing
    //     it reserves is known not to exist; past that it is a promise, which
    //     is the one thing this page must not make.
    // The closing line here used to read "a screenshot reservation that has NOT
    // been satisfied still stands — see Superbrain below, which keeps both of
    // its." p4·M6b deleted those two and the mechanism with them: an unsatisfied
    // reservation does not read as a reservation on a live page, it reads as a
    // broken image. See EcoShot's header.
    links: [["xmrhub.org", "https://xmrhub.org/index.html"], ["@XMRHub_org on X", "https://x.com/XMRHub_org"]],
  },
  {
    id: "kycrip", name: "kyc.rip", head: "exit the panopticon.",
    kind: "Collaborator · no-KYC resources", status: "PARTNER", c: "#ff4d6d",
    url: "https://kyc.rip/",
    blurb: "A resource for acquiring and using crypto without identity capture — rest in peace, KYC.",
    body: [
      "kyc.rip documents the no-KYC path: where to acquire XMR peer-to-peer, which services respect users, and what surveillance the mainstream on-ramps actually perform.",
      "It pairs naturally with the Education tab's privacy-stack material — the protocol protects you on-chain; kyc.rip helps you arrive on-chain unprofiled.",
      // p4·M3 — ADDED, and the reason is that the screenshot below contradicted
      // the two paragraphs above it. Both of those describe a site that
      // DOCUMENTS; the capture shows a site that also OPERATES — an exchange
      // widget above the fold, a live XMR price, and two operator-built tools
      // of its own. Shipping the image under copy that names only the
      // documentation half would have put a contradiction in one screenful,
      // which is the defect p3·16 recorded on the Superstress hub.
      //
      // ADDITIVE, NOT A REWRITE. "Documents the route" stays true and stays on
      // the page — xmr.club's own entry differentiates against that exact
      // phrase and is deliberately untouched by this release. What was missing
      // is that the route is one it also runs.
      //
      // SOURCED FROM THE CAPTURE ALONE. This session could not reach kyc.rip
      // (the gateway answers 403 to CONNECT), so every clause here is something
      // legible in `/peers/peer-kycrip.webp` and nothing else: the swap panel,
      // the no-accounts claim printed under it, and the two tools it labels
      // "operator-built". NO COUNTS — the shot advertises a provider tally, and
      // a number like that is wrong the day the aggregator adds one.
      "It is not only a reading surface. The site fronts its own no-KYC swap desk — pick a pair, no account, no signup — and publishes operator-built tools beside it, so the same people documenting the route also run part of it.",
    ],
    shot: {
      src: "/peers/peer-kycrip.webp",
      alt: "The kyc.rip home page: a FINANCIAL PRIVACY banner beside a no-KYC exchange panel, above two operator-built tools.",
      captured: "2026-08-18",
    },
    // "panel embed · kyc.rip featured guides" retired on XMRHUB's second
    // ground: an EMBED of a third-party panel is a `frame-src` this site's CSP
    // does not grant and will not.
    links: [["kyc.rip", "https://kyc.rip/"], ["@kyc_rip on X", "https://x.com/kyc_rip"]],
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
    // p4·M3 — THE COPY ABOVE IS BYTE-UNTOUCHED. p4·06 rewrote it from the
    // site's own headings and it is done; this release adds the capture the
    // slot was reserving and nothing else in this entry moves.
    shot: {
      src: "/peers/peer-xmrclub.webp",
      alt: "The xmr.club front page: \u201cNo-KYC services for the Monero economy\u201d beside a directory index, over a row of headline sponsors marked as paid placement.",
      captured: "2026-08-18",
    },
    links: [["xmr.club", "https://xmr.club/"], ["@xmr_club on X", "https://x.com/xmr_club"]],
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
    // p4·M3 — THE CAPTURE IS OF NEITHER RESERVED SHOT, AND THE CAPTION SAYS SO.
    // What arrived is the Superstress app itself, running: its monitor tab,
    // reporting a testnet at height zero. That is not the store listing and it
    // is not the mining dashboard, so NEITHER slot is retired — a reservation
    // is satisfied by the artifact it names or it is not satisfied at all, and
    // "close enough" is how a placeholder quietly becomes a lie. This is the
    // one partner of the six where a real screenshot and an open reservation
    // sit in the same column, which is simply the true state of the world.
    //
    // The alt text names the app and the nettype rather than calling this
    // "Superbrain": a reader who cannot see the image should learn what the
    // capture shows, not what the entry is about.
    shot: {
      src: "/peers/peer-superbrain.webp",
      alt: "The Superstress app from the Superbrain store, running on a Tor-only testnet node: a monitor tab with network, difficulty, transaction-count and chain-info panels.",
      captured: "2026-08-18",
    },
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
  {
    /* p4·M3 — MONERICA. The fifth PARTNER, and the one with the longest
       standing: the oldest directory on this page, and the first peer in the
       ecosystem to link back to xmr.irish. Both of those are the OPERATOR'S
       claims rather than this session's findings — "oldest" is a superlative
       about the world that nothing reachable from here can settle — and the PR
       flags them as such. The relationship half is ours to know; the
       superlative half is theirs to confirm.

       EVERY OTHER CLAUSE IS FROM THE SITE'S OWN WORDS, read at monerica.com on
       2026-08-18: the title "Monerica - Monero Directory"; the tagline "A
       directory for a Monero circular economy"; the mission paragraph naming
       "the freedom ideals of the United States of America in the age of
       cryptocurrency by using Monero"; and the footer line "Links are not
       endorsements. Some may be affiliate links. No JavaScript. Cookies not
       required."

       NO COUNTS, on this page's standing rule. The site prints a listing
       tally, a sponsor-slot tally and a category sidebar; every one of those
       is true the day it ships and wrong the day the directory grows. What is
       written here is what the thing IS.

       THE DIFFERENTIATION IS THE LOAD-BEARING PART, and there are now FOUR
       directories on this page rather than the two p4·06 had to tell apart.
       Stated once, here, because this is the entry that arrives last into a
       crowded field: kyc.rip and xmr.club both grade where you ACQUIRE Monero
       privately — the route and the destinations. Monerica indexes where you
       SPEND and EARN it: businesses, merchant services, jobs, freelancers,
       non-profits. A circular economy is the other half of the transaction,
       which is why a fourth directory is not a fourth of the same thing. */
    id: "monerica", name: "Monerica", head: "the original directory.",
    kind: "Collaborator · circular-economy directory", status: "PARTNER",
    // Distinct hue, measured rather than picked by eye: every colour already
    // carrying meaning in this file or in the semantic palette sits at hue
    // 25 / 50 / 142 / 188 / 193 / 268 / 306 / 349. #8ba3ff is hue 228 — 35°
    // from its nearest neighbour (--c-50 cyan) and the only blue on the page —
    // and it clears 6.86:1 against all three theme grounds and their bg-2s.
    c: "#8ba3ff",
    url: "https://monerica.com/",
    blurb: "A directory for a Monero circular economy \u2014 where to spend it and who accepts it, indexed by hand and openly disclosing its own affiliate links.",
    body: [
      "Monerica is the oldest directory in this list and the first peer in the ecosystem to link back to xmr.irish, which is why it leads. Its own framing is explicitly American: the site says its goal is to reflect the freedom ideals of the United States of America in the age of cryptocurrency by using Monero, and that there are no borders to Monerica \u2014 the ability to transact freely and privately without a bank account, without anyone's permission, and without being watched.",
      "Where the other directories here grade how you ACQUIRE Monero, this one indexes where it already circulates: businesses, merchant services, jobs, freelancers, non-profits, hosting, VPNs. That is the other half of a currency, and it is the half that decides whether the first half was worth doing.",
      "It also discloses what most directories do not. The site states in its own footer that links are not endorsements, that some may be affiliate links, and that it runs with no JavaScript and requires no cookies \u2014 and it carries a visible status legend against every listing rather than a silent one. A directory that tells you how it is paid is a directory you can read critically.",
    ],
    shot: {
      src: "/peers/peer-monerica.webp",
      alt: "The Monerica home page: a category sidebar beside sponsor listings, a mission statement about transacting freely and privately, and a legend of per-listing statuses.",
      captured: "2026-08-18",
    },
    links: [["monerica.com", "https://monerica.com/"], ["@MonericaProject on X", "https://x.com/MonericaProject"]],
  },
  {
    /* p4·M3 — PRIVACY GATEWAY. THE ONE ENTRY ON THIS PAGE WHOSE COPY HAS NO
       CONFIRMED TEXT SOURCE, and that is said here rather than discovered by
       the next person to touch it.

       privacygateway.io ANSWERED 403 to this session's fetch. So unlike every
       other entry in this array, no clause below was read off the live site.
       There are exactly two sources and they are both named:
         1. the operator, who supplied the site's function \u2014 swap, mining
            pool, cards;
         2. `/peers/peer-privacygateway.webp`, the capture below, which is
            legible and adds a fourth surface the operator did not name (an RPC
            node) plus the pool's payout scheme.
       Nothing else is asserted. THE OPERATOR REVIEWS THIS ENTRY IN THE PR.

       NO NUMBERS, and the shot is full of them: a pool hashrate, an active
       miner count, a current effort percentage, a fee, a minimum payout, a
       "first block bonus" promotion. Every one of those is a point-in-time
       reading of somebody else's box, and this file's rule is that a live
       number is real or it is absent \u2014 there is no third state where it is
       true-as-of-a-Tuesday. The capture carries them, dated; the prose does
       not repeat them.

       PPLNS IS A SCHEME NAME, NOT A READING, which is why it survives the rule
       above: it says how the pool splits a reward, and it is printed on the
       page in the shot. The hostname is the same category \u2014 an address, not
       a measurement \u2014 and it is the one fact that makes a mining-pool entry
       useful at all. Ports are deliberately omitted: four of them, none
       load-bearing to a brief, all of them rot. */
    id: "privacygateway", name: "Privacy Gateway", head: "swap, mine, spend.",
    kind: "Collaborator · swap \u00b7 pool \u00b7 cards", status: "PARTNER",
    // Hue 83, the lime gap: 33° from --y-50 (warning) and 59° from --g-50
    // (confirm), so it borrows neither meaning, and 10.89:1 against every
    // theme ground. Measured on the same sweep as Monerica's.
    c: "#a3e635",
    url: "https://privacygateway.io/",
    blurb: "One operator running several rails at once \u2014 a no-KYC swap desk, an XMR mining pool, prepaid cards and a public RPC node, on surfaces that ask for no account.",
    body: [
      "Privacy Gateway is a set of rails rather than a single service. Its own navigation carries four: cards, swap, an RPC node, and a Monero mining pool \u2014 the acquire, hold, spend and support ends of using Monero, run by one operator instead of assembled from four.",
      "The pool is the surface captured below. It answers at pool.xmr.privacygateway.io, pays on a PPLNS scheme, and starts by asking for nothing except the address you want paid \u2014 no account, no registration step between reading the page and pointing a miner at it. Our own mining guide argues that a pool's honesty is visible in what it discloses before you connect; this one puts its scheme, its fee and its payout floor on the same screen as the address field.",
      "This entry is the one on the page written without a confirmed text source. The site declined this build's requests, so what is above comes from the operator and from the capture, and the numbers the capture carries are deliberately not repeated here \u2014 read them off the shot, with its date, or off the site itself.",
    ],
    shot: {
      src: "/peers/peer-privacygateway.webp",
      alt: "Privacy Gateway's mining pool page: a Cards / Swap / RPC node / Mining pool tab row above the pool address, a wallet-address field, a strip of pool statistics and a 24-hour hashrate chart.",
      captured: "2026-08-18",
    },
    links: [["privacygateway.io", "https://privacygateway.io/"], ["@Privacygateway_ on X", "https://x.com/Privacygateway_"]],
  },
  {
    /* p4·M6b — KATHIE. The seventh PARTNER, and the one the other six do not
       prepare a reader for: they are surfaces you visit, and this is somebody
       who makes a thing and takes Monero for it.

       ── WHAT WAS READ, AND WHERE ──────────────────────────────────────
       TWO sources were reachable on 2026-08-23, and every clause below traces
       to one of them.

         1. xmrbazaar.com/user/kafi — her seller page. The bio is three words:
            "i sell art". The listings are stickers: a lucky cat, a bear, a
            piggy bank, a chopper, a birthday card, a sheet, and plain Monero
            stickers sold in lots.

         2. xmrchat.com/kath — a Monero TIPPING page, and the word matters. It
            is not a portfolio. Its only heading is "Recent Tips" and it
            carries NO self-description at all, so nothing here is sourced
            from it except the fact it demonstrates by existing: she takes
            tips in XMR, and it is where her outbound links are collected.

       HER OWN SENTENCE IS QUOTED, NOT PARAPHRASED. "i sell art" is better
       than anything that could be written over it, and a three-word bio is
       itself a fact about a person. Rewriting it into a register she did not
       use would be the marketing voice this file bans everywhere else.

       ── WHAT IS NOT CLAIMED, AND WHY ──────────────────────────────────
       THE OPERATOR'S LINE IS "XMR Artist — Physical Art, Stickers,
       Merchandise." Of those three, one is measurable. Stickers are on the
       page, in her own listings. "Physical art" and "merchandise" are
       plausible — a sticker is arguably both — and nothing reachable says she
       sells a painting or a shirt. The copy says stickers. If the range is
       wider the listings will say so, and this entry can grow then.

       THE DENOMINATION IS NOT ASSERTED EITHER, and that one is finer. XMR
       Bazaar is a Monero marketplace and the listings carry prices, but
       nobody in this chain read a price or its unit — so "priced in monero"
       would be a PLATFORM INFERENCE wearing a measurement's clothes, and
       `head` is the string a reader meets on the card face before opening
       anything. Compare Privacy Gateway one entry up, which states PPLNS
       because PPLNS is printed in the capture. Nothing here is printed in
       anything anybody read.

       X IS LINKED AND NEVER DESCRIBED. x.com/kathiful is
       authentication-walled and this build could not read one post. The link
       ships — the operator supplied it, and a reader may be logged in — but
       no sentence anywhere characterises what is on it. Same standing rule as
       the X row in AUTOMATION_ROWS: we can link it, we cannot read it, and we
       do not pretend otherwise.

       YOUTUBE AND TWITCH ARE DELIBERATELY ABSENT FROM `links`, and NOT merely
       because the operator did not supply them — xmrchat links out to both,
       which makes them sourced in the way this page cares about. They lose on
       two grounds. First, no URL was captured, and this file's placeholder
       for that case (a `null` href, rendered "link pending — send it over")
       is the same dashed shape p4·M6b just deleted for screenshots, on the
       finding that an unsatisfied reservation reads as breakage rather than
       as honesty. Second, and this half would hold even with the URLs in
       hand: a row in `links` is this site VOUCHING for a destination, and
       vouching for a channel nobody here has watched is a claim about
       content rather than a signpost. body[2] names xmrchat as where her
       links are collected, one hop away, and lets the reader follow them
       without this page asserting what is at the end.

       NO COUNTS, on Monerica's rule two entries up — not of listings, not of
       stock, and not of how many partners this page carries. The catalogue is
       described by its CHARACTER and the named designs are what was on the
       page on the read date, not an inventory. NO SUPERLATIVE: nothing here
       calls her the first, the only or the best, because nothing reachable
       could settle any of those, and an unattributed superlative is worse
       than none. (Monerica's "oldest directory" is the counter-example that
       proves the rule: it is the OPERATOR'S claim and is flagged as one.)

       ── NO SCREENSHOT, SAID OUT LOUD ──────────────────────────────────
       THIS ENTRY SHIPS WITH NO `shot`, AND THE ABSENCE IS DELIBERATE. The
       artwork was never delivered to this build. `shot` has been optional
       since p4·M3, and p4·M6b deleted the reservation mechanism outright — so
       an entry with no capture renders NOTHING in its place rather than a
       dashed box claiming one is coming. See EcoShot's header for the rule
       and verify-peers §9, which asserts exactly this: an entry declaring no
       shot must render zero images. When a capture arrives it lands here,
       dated, like the other six. This paragraph exists so the next person to
       open this file does not spend ten minutes deciding whether the picture
       is missing or broken.

       ── THE NAMING DECISIONS ──────────────────────────────────────────
       `id` IS "kathie" — the display name, not either handle, because it
       becomes /operate/peers?p=kathie and a shared URL cannot be renamed
       later without breaking it. Both handles are third-party account names
       on somebody else's platform ("kafi" on xmrbazaar, "kath" on xmrchat)
       and either could change without her changing. Every existing id here is
       name-derived for the same reason.

       `url` IS THE XMR BAZAAR SELLER PAGE, chosen between three surfaces she
       does not own. xmrchat is a TIP JAR — sending a reader there first asks
       for money before showing them anything, and a page whose only heading
       is "Recent Tips" cannot answer "who is this". X cannot be opened
       without an account, which on a site read over Tor is close to no
       destination at all. xmrbazaar is where the work is. "Primary site" here
       means "where the work is", not "her domain", because there is no
       domain.

       `links[0]` IS "xmrbazaar.com" AND SHORT ON PURPOSE: TrustedPeersPage
       derives the card footer's "visit X ↗" text from the first link with an
       href, and p4·M3 measured what a long one does to that row. The
       label/path mismatch is precedented — XMRHUB ships "xmrhub.org" against
       an href of /index.html.

       `c` IS MEASURED, NOT PICKED, on p4·M3's method and with its instrument
       re-run. Against the eleven accents already carrying meaning in this
       tree, #5eead4's smallest perceptual distance (CIEDE2000) is 16.91 — to
       stressnet's green, with superbrain's cyan at 16.95 and carrot's at
       19.50 — while the SMALLEST GAP BETWEEN TWO ACCENTS ALREADY SHIPPING is
       4.36 (superbrain #22d3ee against carrot #5ed3f4). So it is roughly four
       times as separable as a pair already in production. Contrast is 11.10:1
       at worst across all three themes' grounds and their bg-2s. It sits in
       the 142→188 hue gap, the widest this palette has left. The betanet accent
       reserved by p4·07 (hue 305.5) was excluded by name — and its HEX IS
       DELIBERATELY NOT WRITTEN HERE, because `verify-explorer` asserts that
       literal appears in exactly one file and reds if any other names it. The
       first version of this comment quoted it while explaining that it was
       excluded, and the full chain caught it at position 17 of 39: a gate that
       checks a string's uniqueness cannot tell a mention from a use, which is
       `verify-orb` §4's recorded shape. */
    id: "kathie", name: "Kathie", head: "stickers, on XMR Bazaar.",
    kind: "Collaborator · artist", status: "PARTNER", c: "#5eead4",
    url: "https://xmrbazaar.com/user/kafi",
    blurb: "An artist selling Monero stickers on XMR Bazaar as kafi, under a seller bio three words long: \u201ci sell art\u201d.",
    body: [
      "Kathie sells stickers on XMR Bazaar as kafi, and her bio there is three words long: \u201ci sell art\u201d, lowercase. Among the designs on the seller page when it was read: a lucky cat, a bear, a piggy bank, a chopper, a birthday card and a sheet, alongside plain Monero stickers sold in lots. XMR Bazaar is a Monero marketplace; her listings sit on it.",
      "The directories above index where Monero circulates. This is one of the places it actually does, one object at a time \u2014 the argument the rest of this site makes at protocol scale is that a currency is only a currency if somebody accepts it for something, and somebody selling a cat sticker to a stranger for XMR is that claim tested rather than argued. The others here are projects, services and directories; this one is a person.",
      "Her tipping page at xmrchat.com/kath takes tips in XMR. It carries no description of her work \u2014 its only heading is \u201cRecent Tips\u201d \u2014 but it is where she collects her own outbound links, including destinations this build did not read. Her X account is linked below; it is behind a login wall, so nothing here describes what is on it.",
    ],
    links: [
      ["xmrbazaar.com", "https://xmrbazaar.com/user/kafi"],
      ["xmrchat.com/kath \u00b7 tips", "https://xmrchat.com/kath"],
      ["@kathiful on X", "https://x.com/kathiful"],
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
