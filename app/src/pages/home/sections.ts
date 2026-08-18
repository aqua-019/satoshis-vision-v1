/**
 * pages/home/sections.ts — the six Main Home section cards, one per
 * `nav/ia.ts` section (Live · Monero · Learn · Future · Operate · About).
 *
 * Every count below is DERIVED from `IA`'s exported shape at module scope,
 * never a literal — the mockup's own numbers are wrong (it says 11 mempool
 * views where the repo ships 7, and 12 simulators where it ships 21) and a
 * hardcoded correction would only be right until the next simulator lands.
 *
 * That prose said "ships 6" until p2·7b, and the reason it was wrong is the
 * point of this file: the DERIVATION was right the whole time and rendered 6
 * because `IA` itself was wrong — `ia.ts` hand-copied six of the seven views.
 * This card is a consumer, not an authority, and it corrected itself the
 * moment ia.ts started deriving. Only the comment needed a human.
 *
 * ── THE FUTURE COUNT, AND A DERIVATION THAT WOULD HAVE SILENTLY READ 0 ──
 * This paragraph used to say `IA`'s public shape "does not expose a
 * protocols-vs-ecosystem split for the Future section", because both metas
 * wrote their paths as `${R.FUTURE}#${id}` and were indistinguishable from
 * outside. So the count below filtered on `p.includes("#")` and the card was
 * worded "protocols & ecosystem" to match what it could actually measure.
 *
 * p4·06 gave the five protocols a real `?p=` destination and deleted
 * ECOSYSTEM_META outright. THE FILTER STILL COMPILED AND STILL RAN — it just
 * matched nothing, so this card would have rendered "0 protocols & ecosystem"
 * on Main Home. Nothing reds: the number is derived, and a derivation that
 * has stopped matching is indistinguishable from a section that is empty.
 * Found by reading the derivation against the new URL shape, not by a gate.
 *
 * The filter is now `?p=`, the same discriminator MEMPOOL_VIEWS uses for
 * `?v=`, and the split the old paragraph called impossible is now free:
 * every `?p=` leaf in the Future section IS a protocol. The card says so.
 */

import { IA } from "@/nav/ia";
import { R } from "../../../scripts/routes.mjs";

function itemsOf(key: string): readonly { p: string }[] {
  const s = IA.find((sec) => sec.key === key);
  return s ? s.cols.flatMap((c) => c.items) : [];
}

/** Mempool view links carry `?v=`; the bare `/live/mempool` entry does not. */
const MEMPOOL_VIEWS = itemsOf("live").filter((i) => i.p.includes("?v=")).length;

/** Every Learn col whose header starts "Simulators" is a simulator group. */
const LEARN_SIMULATORS = (() => {
  const learn = IA.find((s) => s.key === "learn");
  if (!learn) return 0;
  return learn.cols
    .filter((c) => c.h.startsWith("Simulators"))
    .reduce((n, c) => n + c.items.length, 0);
})();

/** One Monero nav item per tab/chapter. */
const MONERO_CHAPTERS = (() => {
  const monero = IA.find((s) => s.key === "monero");
  return monero ? monero.cols[0].items.length : 0;
})();

/** Future PROTOCOL links carry `?p=`; the rail and outlook entries do not —
 *  the same shape-based discriminator MEMPOOL_VIEWS uses above. Since p4·06
 *  there are no ecosystem leaves in this section to fold in. */
const FUTURE_PROTOCOLS_N = itemsOf("future").filter((i) => i.p.includes("?p=")).length;

export interface HomeSection {
  to: string;
  title: string;
  meta: string;
  body: string;
  cta: string;
  color: string;
}

export const HOME_SECTIONS: HomeSection[] = [
  {
    to: R.LIVE_MEMPOOL,
    title: "Live",
    meta: `${MEMPOOL_VIEWS} mempool views · network · markets`,
    body: `The chain as it happens. ${MEMPOOL_VIEWS} ways of seeing one pool of unconfirmed transactions.`,
    cta: "watch",
    color: "var(--tk-accent)",
  },
  {
    to: R.MONERO,
    title: "Monero",
    meta: `${MONERO_CHAPTERS} chapters`,
    body: "Origin, tech, legality, versus Bitcoin, the attacks, the bottom line.",
    cta: "read",
    color: "var(--g-50)",
  },
  {
    to: R.LEARN,
    title: "Learn",
    meta: `${LEARN_SIMULATORS} simulators · timeline · quotes`,
    // "privacy primitives" is load-bearing copy, not decoration. With
    // JavaScript off only the FIRST hero passage prerenders, and the rewrite's
    // first passage is Satoshi on group signatures — so the word naming what
    // this entire site is about had disappeared from the JS-off page, which is
    // the version a Tor visitor at Safest actually receives. The old hero
    // kicker ("a privacy network · since 2014") carried it and the rewrite
    // dropped it. verify-nojs caught the absence; this sentence is where it
    // belongs, because these three ARE the privacy primitives and naming them
    // as such tells the reader more than the list alone did.
    body: "Ring signatures, stealth addresses, Dandelion++ — the privacy primitives, run rather than read.",
    cta: "run",
    color: "var(--p-50)",
  },
  {
    to: R.FUTURE,
    title: "Future",
    meta: `${FUTURE_PROTOCOLS_N} protocols · roadmap · outlook`,
    body: "FCMP++ and what comes after it, with a betanet you can actually run.",
    cta: "roadmap",
    color: "var(--c-50)",
  },
  {
    to: R.OPERATE_NODE,
    title: "Operate",
    // p4·06 — these two metas are hand-written, not derived, and BOTH named a
    // leaf that moved in this release: "trusted peers" was advertised under
    // About while the leaf itself moved to Operate. A hand-written summary of
    // a section's contents is a claim about the IA, and this one was false the
    // moment the IA changed. Nothing gates it.
    meta: "run a node · mine · peers",
    body: "monerod in one command. Tor + I2P optional. Free seed peers.",
    cta: "start",
    color: "var(--y-50)",
  },
  {
    to: R.ABOUT_SOURCES,
    title: "About",
    meta: "sources · provenance · ethos",
    body: "Where every number on this site comes from, and what this site is for.",
    cta: "sources",
    color: "var(--ink-60)",
  },
];
