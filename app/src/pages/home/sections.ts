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
 * `IA`'s public shape does not expose a protocols-vs-ecosystem split for the
 * Future section (`FUTURE_PROTOCOL_META` and `ECOSYSTEM_META` are internal to
 * ia.ts, unexported, and both write their paths as `${R.FUTURE}#${id}` —
 * indistinguishable from outside). Rather than hardcode the mockup's
 * protocols-only "5", the Future card below counts the combined total (9) and
 * is worded to match — derived-and-honest over matching-the-mockup.
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

/** Future protocols + ecosystem combined (see file header — cannot split). */
const FUTURE_ITEMS = itemsOf("future").filter((i) => i.p.includes("#")).length;

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
    meta: `${FUTURE_ITEMS} protocols & ecosystem`,
    body: "FCMP++ and what comes after it, with a betanet you can actually run.",
    cta: "roadmap",
    color: "var(--c-50)",
  },
  {
    to: R.OPERATE_NODE,
    title: "Operate",
    meta: "run a node",
    body: "monerod in one command. Tor + I2P optional. Free seed peers.",
    cta: "start",
    color: "var(--y-50)",
  },
  {
    to: R.ABOUT_SOURCES,
    title: "About",
    meta: "sources · trusted peers",
    body: "Where every number on this site comes from, and who else is worth reading.",
    cta: "sources",
    color: "var(--ink-60)",
  },
];
