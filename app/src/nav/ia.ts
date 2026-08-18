/**
 * nav/ia.ts — the single runtime source for the site's information
 * architecture: six sections (Live · Monero · Learn · Future · Operate ·
 * About), each a handful of columns of real destinations.
 *
 * Consumers (NavTop's dropdowns, the mobile tab bar, breadcrumbs, the ⌘K
 * palette registry) are future work — this file only declares the DATA.
 *
 * ── NO `@/` ALIASES ──────────────────────────────────────────────────────
 * verify-ia.mjs imports this file under bare Node (`node verify-ia.mjs`),
 * where `@/` does not resolve — it is a Vite/tsconfig alias, not something
 * bare Node's module loader knows about. Every import below is relative.
 *
 * ── PATHS COME FROM `R`, NEVER A LITERAL ────────────────────────────────
 * `R` (scripts/routes.mjs) is the single authority for the 13 real route
 * paths; every leaf below is built from it (`${R.LIVE_MEMPOOL}?v=${id}`,
 * `${R.MONERO}/${tab.id}`, …) rather than retyping a path string. The three
 * SECTION-level `path` fields for Live/Operate/About are the one deliberate
 * exception: those three were never real routes (see IA below and
 * verify-ia.mjs's own premise), so `R` has no constant for them to read
 * through — there is nothing to alias.
 *
 * ── REAL INVENTORY ONLY ──────────────────────────────────────────────────
 * Every leaf here corresponds to something that actually exists in this
 * repo. Most registries are IMPORTED (via ./registries.mjs, a small re-export
 * shim — see its header for why a direct import doesn't work under bare
 * Node) rather than retyped: MONERO_TABS, EDU_TABS, the three protocol-meta
 * arrays (21 simulators), and MEMPOOL_VIEW_META (the mempool views).
 *
 * ── THE MEMPOOL VIEW LIST USED TO BE HAND-COPIED, AND IT DRIFTED ─────────
 * The wall was real: views/index.tsx is a .tsx file, and Node's native TS
 * type-stripping does not support the .tsx extension AT ALL, independent of
 * whether the file contains JSX (confirmed empirically). So this file could
 * not import the registry, and carried a copy of the ids/labels plus a
 * SECOND literal — the "· N views" column header — with a comment saying the
 * copy could drift.
 *
 * It drifted on the very first view added after that comment was written.
 * `orbital` shipped in #174 and appeared in NO nav surface — not the LIVE
 * mega-menu, not ⌘K, not the tab bar, not prefetch, not breadcrumbs — because
 * all of them read this file. It was reachable only from the on-page switcher
 * (which derives from the registry) and from a typed `?v=orbital` URL.
 *
 * The fix was to remove the wall rather than to add a seventh entry: p2·7b
 * split the component-free half of the registry into views/mempool-meta.ts,
 * which imports nothing and so loads fine under bare Node. Both the list and
 * the count below are derived from it. verify-ia.mjs §7b asserts the two
 * agree in BOTH directions, so a rename cannot hide as an add plus a drop.
 *
 * ── ONE HAND-COPY REMAINS, DELIBERATELY ─────────────────────────────────
 *   - the 5 future-protocol + 5 ecosystem ids/labels (pages/future/data.ts
 *     itself imports `@/views/protocol-meta` — a `@/` alias INSIDE that
 *     file — so importing it, even transitively, drags an unresolvable
 *     specifier into bare Node regardless of what this file does)
 * That list is checked against its source file's current contents as of this
 * writing; it is not derived automatically and can drift if the source
 * changes without this file being updated too. It has NOT drifted — but it is
 * the same defect class the mempool list just demonstrated, and curing it
 * means giving pages/future/data.ts the same pure-data split. That is its own
 * change, not this one's.
 *
 * ── SECTION MATCHING (for a future nav consumer) ─────────────────────────
 * `sectionForPath` below uses LONGEST PREFIX WITH A SEGMENT BOUNDARY
 * (`p === path || p.startsWith(path + "/")`), not a bare `startsWith` — the
 * nav mockup gets this wrong, and a bare `startsWith("/future")` would match
 * a hypothetical "/futures-x" too.
 *
 * ── `/`, `/live`, `/operate`, `/about` ───────────────────────────────────
 * `/live`, `/operate` and `/about` are section GROUPINGS, never routes —
 * nothing renders at those bare paths, and clicking a section goes to
 * `cols[0].items[0].p`. `/` (Home) is owned by the brand mark, not a
 * section child — but it still needs to be findable as a leaf: see the
 * Home entry in the Live section's Mempool column below.
 */

import { R } from "../../scripts/routes.mjs";
import {
  MONERO_TABS,
  EDU_TABS,
  MEMPOOL_VIEW_META,
  PROTOCOL_PRIMITIVES_META,
  PROTOCOL_FUTURE_META,
  PROTOCOL_METAPHORS_META,
} from "./registries.mjs";

export interface IaItem {
  l: string;
  p: string;
  note?: string;
}
export interface IaCol {
  h: string;
  items: IaItem[];
}
export interface IaSection {
  key: string;
  label: string;
  path: string;
  blurb: string;
  cols: IaCol[];
}

/** Market history range keys, from data/useMarketHistory.ts's RANGE_DAYS. */
const MARKET_RANGE_META: readonly { id: string; label: string }[] = [
  { id: "7D", label: "7 days" },
  { id: "30D", label: "30 days" },
  { id: "90D", label: "90 days" },
  { id: "1Y", label: "1 year" },
];

/**
 * Future protocol ids/labels, hand-copied from pages/future/data.ts's
 * FUTURE_PROTOCOLS — see this file's header for why that module can't be
 * imported directly. The fifth protocol is `cuprate`, NOT tail emission —
 * tail emission is the `hearth` Learn simulator (PROTOCOL_METAPHORS_META),
 * a distinct destination.
 *
 * ── ECOSYSTEM_META IS GONE (p4·06), AND THAT IS THE FIX ──────────────────
 * A sibling `ECOSYSTEM_META` array sat here and was spread into futureCol as
 * five more `/future#<id>` rows. All five were hollow, and the list was the
 * SECOND hand-copy of data.ts in this file — so it could drift, and
 * verify-ia §7c existed to catch it drifting.
 *
 * It was not repointed, it was DELETED. The four PARTNER entries are now
 * reached through the "Trusted peers" leaf in the Operate column, which is
 * ONE working destination in place of four broken ones, and `stressnet` /
 * `superbrain` are covered by the Superstress hub beside it. Nothing became
 * unreachable: /future still renders the ecosystem band and its popups.
 *
 * The drift class did not get a better gate — it stopped existing. A list
 * this file does not hold cannot disagree with data.ts. §7c keeps the
 * protocol half (now keyed on `?p=`) and adds one assertion in its place:
 * that no IA leaf names an ECOSYSTEM id, so a half-restored copy reds.
 */
const FUTURE_PROTOCOL_META: readonly { id: string; label: string }[] = [
  { id: "fcmp", label: "FCMP++" },
  { id: "seraphis", label: "Seraphis" },
  { id: "jamtis", label: "Jamtis" },
  { id: "carrot", label: "Carrot" },
  { id: "cuprate", label: "Cuprate" },
];

// ── Live ───────────────────────────────────────────────────────────────
const liveMempoolCol: IaCol = {
  // The count is DERIVED, never typed. It was the second of the two literals
  // that hid `orbital`: even with the list fixed by hand, a stale "6" here
  // would have contradicted the six entries beside it. See the header.
  h: `Mempool · ${MEMPOOL_VIEW_META.length} views`,
  items: [
    // "/live/mempool?v=classic" does not satisfy the bare "/live/mempool"
    // route ("?" is not "/") — this bare item is what makes that route
    // findable as a leaf in its own right, not just via a view variant.
    //
    // Home is deliberately NOT here. It was, briefly, because verify-ia §7
    // required every route to be an IA leaf and `/` had nowhere to sit — and
    // since a section navigates to `cols[0].items[0].p`, a Home leaf in this
    // first slot made clicking "Live" go to Home. `/` is owned by the brand
    // mark and by the palette's own canonical Home row; §7 now exempts it.
    { l: "Mempool", p: R.LIVE_MEMPOOL },
    ...MEMPOOL_VIEW_META.map((v) => ({ l: v.label, p: `${R.LIVE_MEMPOOL}?v=${v.id}` })),
  ],
};
const liveNetworkCol: IaCol = {
  h: "Network",
  items: [{ l: "Chain telemetry", p: R.LIVE_NETWORK }],
};
const liveMarketsCol: IaCol = {
  h: "Markets",
  items: [
    { l: "Price & candles", p: R.LIVE_MARKETS },
    ...MARKET_RANGE_META.map((r) => ({ l: r.label, p: `${R.LIVE_MARKETS}?range=${r.id}` })),
    { l: "Market thesis", p: R.MARKETS_THESIS, note: "moved from /monero" },
  ],
};

// ── Monero ─────────────────────────────────────────────────────────────
const moneroCol: IaCol = {
  h: "Chapters",
  items: MONERO_TABS.map((t) => ({
    l: t.label,
    p: t.id === "overview" ? R.MONERO : `${R.MONERO}/${t.id}`,
  })),
};

// ── Learn ──────────────────────────────────────────────────────────────
const learnEducationCol: IaCol = {
  h: "Education",
  items: [
    { l: "Hub", p: R.LEARN },
    ...EDU_TABS.map((t) => ({ l: t.label, p: `${R.LEARN}/${t.id}` })),
    // "/learn/sim?p=<id>" does not satisfy the bare "/learn/sim" route
    // ("?" is not "/") — same reasoning as the mempool bare path above.
    { l: "Run a simulator", p: R.LEARN_SIM },
  ],
};
const learnPrimitivesCol: IaCol = {
  h: "Simulators · privacy primitives",
  items: PROTOCOL_PRIMITIVES_META.map((m) => ({ l: m.label, p: `${R.LEARN_SIM}?p=${m.id}` })),
};
const learnFutureCol: IaCol = {
  h: "Simulators · future protocols",
  items: PROTOCOL_FUTURE_META.map((m) => ({ l: m.label, p: `${R.LEARN_SIM}?p=${m.id}` })),
};
const learnMetaphorsCol: IaCol = {
  h: "Simulators · metaphors",
  items: PROTOCOL_METAPHORS_META.map((m) => ({ l: m.label, p: `${R.LEARN_SIM}?p=${m.id}` })),
};

// ── Future ─────────────────────────────────────────────────────────────
const futureCol: IaCol = {
  h: "Future",
  items: [
    { l: "Roadmap rail", p: R.FUTURE },
    { l: "Outlook", p: R.FUTURE_OUTLOOK, note: "moved from /monero" },
    { l: "Protocols", p: R.FUTURE_PROTOCOL, note: "all five, one page each" },
    // p4·06 — REAL DESTINATIONS. These five were `${R.FUTURE}#${m.id}`, and
    // the operateCol comment below has said since p3·16 that #184 measured
    // /future as rendering no panel any of them can scroll to: every one was
    // hollow. They now key the `?p=` page, which is the same shape the
    // Learn column's simulator rows already use.
    ...FUTURE_PROTOCOL_META.map((m) => ({ l: m.label, p: `${R.FUTURE_PROTOCOL}?p=${m.id}` })),
  ],
};

// ── Operate ────────────────────────────────────────────────────────────
const operateCol: IaCol = {
  h: "Operate",
  // p3·16 — the Operate column's SECOND item, and the first thing added to
  // this section since the restructure. Order matters here beyond reading
  // order: a section header navigates to `cols[0].items[0].p`, so "Run a
  // node" staying first is what keeps clicking "Operate" going where it
  // always has.
  //
  // A REAL ROUTE, not a `/future#superstress` fragment. The five ecosystem
  // rows in futureCol above are `${R.FUTURE}#${m.id}` and #184 measured that
  // /future renders no panel any of them can scroll to — every one of those
  // anchors is hollow. This entry is a leaf with its own page, so it is the
  // one ecosystem destination in this file that resolves to content.
  // p4·04 — the THIRD item, inserted between the other two rather than
  // appended. "Run a node" still leads, so the section header keeps
  // navigating where it always has; and mining sits directly under its own
  // prerequisite, which is the order the two pages describe each other in.
  items: [
    { l: "Run a node", p: R.OPERATE_NODE },
    { l: "Mine Monero", p: R.OPERATE_MINE, note: "RandomX · CPU · four platforms" },
    { l: "Superstress hub", p: R.OPERATE_SUPERSTRESS, note: "Umbrel community app store" },
    // p4·07 — the explorer, directly under the hub it belongs to, which is
    // both the reading order and the URL nesting. Its note carries the word
    // SIMULATED because a nav leaf is the one place a reader decides whether
    // to expect a chain reading, and by the time the banner tells them it is
    // simulated they have already clicked.
    { l: "Beta-chain explorer", p: R.OPERATE_SUPERSTRESS_EXPLORER, note: "simulated · the wind tunnel as an explorer" },
    // p4·06 — MOVED here from the About column, and appended rather than
    // inserted for the reason the two comments above already give twice: the
    // section header navigates to `cols[0].items[0].p`, so only a leaf placed
    // FIRST can move where clicking "Operate" goes.
    //
    // It also inherits the four ecosystem rows that used to sit in the Future
    // column as `/future#<id>` fragments. This one leaf is where all four
    // PARTNERs are actually rendered, so it replaces four hollow anchors with
    // one destination rather than relocating them.
    { l: "Trusted peers", p: R.OPERATE_PEERS, note: "the collaborators we vouch for" },
  ],
};

// ── About ──────────────────────────────────────────────────────────────
const aboutCol: IaCol = {
  h: "About",
  items: [
    { l: "Sources & provenance", p: R.ABOUT_SOURCES },
    { l: "Release notes", p: `${R.ABOUT_SOURCES}#release-notes` },
    // p4·06 — "Trusted peers" left this column for Operate. A directory of
    // projects you RUN is not a statement about this site, which is what the
    // other three leaves here are.
    { l: "Mission & ethos", p: R.ABOUT_SITE, note: "what this is · how it is funded" },
  ],
};

export const IA: readonly IaSection[] = [
  {
    key: "live",
    label: "Live",
    path: "/live",
    blurb: "The three surfaces that move. Read from public nodes, never fabricated.",
    cols: [liveMempoolCol, liveNetworkCol, liveMarketsCol],
  },
  {
    key: "monero",
    label: "Monero",
    path: R.MONERO,
    blurb: "The argument, in seven chapters.",
    cols: [moneroCol],
  },
  {
    key: "learn",
    label: "Learn",
    path: R.LEARN,
    blurb: "Run it, don't read it — education and the simulators, together.",
    cols: [learnEducationCol, learnPrimitivesCol, learnFutureCol, learnMetaphorsCol],
  },
  {
    key: "future",
    label: "Future",
    path: R.FUTURE,
    blurb: "What lands next, and what you can already run.",
    cols: [futureCol],
  },
  {
    key: "operate",
    label: "Operate",
    path: "/operate",
    blurb: "The only version of this that needs no trust at all.",
    cols: [operateCol],
  },
  {
    key: "about",
    label: "About",
    path: "/about",
    blurb: "Where every number comes from.",
    cols: [aboutCol],
  },
];

/**
 * Which section (if any) a pathname belongs to — LONGEST PREFIX WITH A
 * SEGMENT BOUNDARY, not a bare `startsWith` (see file header). Exact match
 * counts too, so a hypothetical direct link to a section's own `path`
 * (never a real route for Live/Operate/About, but Monero/Learn/Future's
 * `path` IS one) still resolves.
 */
export function sectionForPath(pathname: string): IaSection | undefined {
  return IA.find((s) => pathname === s.path || pathname.startsWith(s.path + "/"));
}
