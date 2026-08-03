/**
 * pages/home/passages.ts — the seven rotating Main Home hero passages.
 *
 * Every `lines` array is lifted from this repo's own education/thesis content
 * — never from the mockup, never retyped from a brief. `verify-hero.mjs`
 * diffs TEXT and ATTRIBUTION against the named source file, per passage, and
 * is the reason this file carries a `source.mode` per entry rather than one
 * blanket claim:
 *
 *   exact      `lines.join(' ')` equals a whole quoted string literal in the
 *              source, character for character.
 *   prefix     it is the opening of a longer quoted literal (shown as one
 *              sentence of a multi-sentence quote) — shorter, not equal.
 *   substring  it occurs inside the source's raw text but is not itself a
 *              whole (or leading) quoted literal — e.g. a JSX text node, or a
 *              mid-sentence clause. The loosest relation, so every substring
 *              passage below documents exactly what "loosest" still means:
 *              a real, contiguous run of the source's own words in the
 *              source's own order — never words present-but-reordered
 *              (that defect is why P6 exists in this shape; see its note).
 *
 * `who`/`meta`/`where`/`href` are the visible attribution. `meta` is the field
 * the gate diffs (numeric tokens — #NNN thread ids, four-digit years — must
 * each occur in the source; with no such token the whole `meta` string must
 * occur verbatim). `who` is NOT diffed — it may name a role or a publisher,
 * never a person the source does not quote as speaking. `lede` is NOT diffed
 * either: it is this site's own framing, and every fact in it below was
 * verified against the SAME source file, not invented to fit the slide.
 *
 * `href` is always built from `R` (scripts/routes.mjs) — see each passage's
 * comment for why its link target is not always its text's own source file.
 */

import { R } from "../../../scripts/routes.mjs";

export type PassageMode = "exact" | "prefix" | "substring";

export interface PassageSource {
  /** Path relative to src/, no leading "src/". */
  file: string;
  mode: PassageMode;
}

export interface Passage {
  id: string;
  /** Headline, pre-broken into display lines. `lines.join(' ')` is the string
   *  verify-hero.mjs diffs — never introduce a word, drop one, or reorder one
   *  when choosing where to break a line. */
  lines: string[];
  /** This site's own framing. Not diffed, but every fact in it is verified
   *  against `source.file`, not invented. */
  lede: string;
  who: string;
  meta: string;
  where: string;
  href: string;
  source: PassageSource;
}

export const PASSAGES: Passage[] = [
  {
    id: "satoshi-ring",
    lines: [
      "With group signatures,",
      "it is possible for something",
      "to be signed but not know",
      "who signed it.",
    ],
    lede: "Satoshi described ring signatures in a public Bitcoin forum thread — years before Monero would implement them.",
    who: "Satoshi Nakamoto",
    meta: "BitcoinTalk Thread #174 · August 11, 2010",
    where: "Learn · Quotes",
    href: `${R.LEARN}/quotes`,
    source: { file: "pages/_education/Quotes.tsx", mode: "exact" },
  },
  {
    id: "satoshi-stealth",
    lines: [
      "What we need is a way",
      "to generate additional blinded",
      "variations of a public key.",
    ],
    lede: "A description of stealth addresses, one day earlier in the same thread — a way to receive payments without revealing which key they belonged to.",
    who: "Satoshi Nakamoto",
    meta: "BitcoinTalk Thread #174 · August 11, 2010",
    where: "Learn · Quotes",
    href: `${R.LEARN}/quotes`,
    // PREFIX: the source quote continues for two more sentences; this shows
    // only the first, verbatim from its start.
    source: { file: "pages/_education/Quotes.tsx", mode: "prefix" },
  },
  {
    id: "ciphertrace-ceo",
    lines: [
      "CipherTrace's CEO admitted",
      "tracing Monero is",
      '"more of a probabilistic',
      'game."',
    ],
    lede: "CipherTrace was contracted to build a Monero-tracing toolkit. Its own CEO described what tracing Monero actually amounts to.",
    who: "xmr.irish",
    meta: "Bottom Line",
    where: "Monero · Bottom line",
    href: `${R.MONERO}/bottomline`,
    // SUBSTRING: this is JSX text, not a quoted string literal, so it cannot
    // be an `exact`/`prefix` match against the file's quoted literals.
    source: { file: "pages/monero/BottomLineTab.tsx", mode: "substring" },
  },
  {
    id: "delisting-paradox",
    lines: ["They delist it because", "they cannot see inside."],
    lede: "If Monero could be traced, regulators would keep it listed on exchanges as a honeypot instead.",
    who: "xmr.irish",
    meta: "Bottom Line",
    where: "Monero · Bottom line",
    href: `${R.MONERO}/bottomline`,
    // SUBSTRING: the tail of a longer quoted `sub=` string, not the whole
    // literal and not its prefix.
    source: { file: "pages/monero/BottomLineTab.tsx", mode: "substring" },
  },
  {
    id: "irs-bounty",
    lines: [
      "The deadline passed.",
      "No deterministic tracing",
      "tool was ever delivered.",
    ],
    lede: "The IRS bounty for a working Monero-tracing tool: 22 companies applied, two contractors were chosen and given eight months.",
    who: "IRS Criminal Investigation",
    meta: "September 2020",
    where: "Monero · Attacks",
    // Deep link goes to the fuller attacks record, not the bottom-line
    // paragraph this text is quoted from — a deliberate editorial choice,
    // not an error.
    href: `${R.MONERO}/attacks`,
    // SUBSTRING: a contiguous two-sentence run of JSX text, not a quoted
    // literal. The mockup's own words here ("$625,000 offered... Nobody
    // collected.") do not occur in this source at all; this passage was
    // rebuilt from what the source actually says instead of paraphrasing it
    // into fitting.
    source: { file: "pages/monero/BottomLineTab.tsx", mode: "substring" },
  },
  {
    id: "monero-launch",
    lines: ["from day one", "— privacy mandatory", "and default"],
    lede: "Monero forked from Bytecoin without the premine, shipping ring signatures and stealth addresses at launch. Privacy was never a setting.",
    who: "April 2014",
    meta: "BitMonero → Monero",
    where: "Learn · Timeline",
    href: `${R.LEARN}/timeline`,
    // SUBSTRING, and the reason this passage exists in this exact shape:
    // the source clause is "...from day one — privacy mandatory and
    // default.", in that word order. An earlier draft reordered it to
    // "Privacy mandatory, and default, from day one." — which reads well but
    // is not what Timeline.tsx:54 says; copied here character-for-character,
    // including the U+2014 em dash (not a retyped hyphen).
    source: { file: "pages/_education/Timeline.tsx", mode: "substring" },
  },
  {
    id: "fcmp-outlook",
    lines: [
      "every transaction hiding",
      "among the entire history",
      "of the chain",
    ],
    lede: "FCMP++ replaces ring signatures with full-chain membership proofs, bundled with CARROT addressing.",
    who: "Full-Chain Membership Proofs",
    meta: "Mid-2026 (tentative)",
    where: "Future · Outlook",
    href: R.FUTURE_OUTLOOK,
    // SUBSTRING: a mid-sentence clause, not the quoted literal's start or
    // whole. Source file sits under pages/monero/ even though the tab moved
    // to /future/outlook — that is correct, not a stray import.
    source: { file: "pages/monero/OutlookTab.tsx", mode: "substring" },
  },
];

/** Dwell per passage before auto-advance, in ms. Suspended entirely under
 *  reduced motion and while paused (hover/focus) — see useHeroRotation.ts. */
export const HERO_DWELL_MS = 9000;
