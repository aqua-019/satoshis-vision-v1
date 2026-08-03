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
 * repo. Two registries are IMPORTED (via ./registries.mjs, a small re-export
 * shim — see its header for why a direct import doesn't work under bare
 * Node) rather than retyped: MONERO_TABS and EDU_TABS, plus the three
 * protocol-meta arrays (21 simulators). Two more are HAND-COPIED, each with
 * a comment explaining the specific technical wall that makes importing
 * them unsafe under bare Node:
 *   - the 6 mempool view ids/labels (views/index.tsx is a .tsx file; Node's
 *     native TS type-stripping does not support the .tsx extension AT ALL,
 *     independent of whether the file contains JSX — confirmed empirically)
 *   - the 5 future-protocol + 4 ecosystem ids/labels (pages/future/data.ts
 *     itself imports `@/views/protocol-meta` — a `@/` alias INSIDE that
 *     file — so importing it, even transitively, drags an unresolvable
 *     specifier into bare Node regardless of what this file does)
 * Both hand-copied lists are checked against their source file's current
 * contents as of this writing; they are not derived automatically and can
 * drift if the source changes without this file being updated too.
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

/**
 * Mempool view ids/labels, hand-copied from views/index.tsx's
 * MEMPOOL_VIEWS (6 entries, same order) — see this file's header for why
 * that registry can't be imported directly.
 */
const MEMPOOL_VIEW_META: readonly { id: string; label: string }[] = [
  { id: "reactor", label: "Reactor" },
  { id: "bridge", label: "Ops Bridge" },
  { id: "sediment", label: "Sediment" },
  { id: "constellation", label: "Constellation" },
  { id: "terminal", label: "Terminal" },
  { id: "classic", label: "Classic" },
];

/** Market history range keys, from data/useMarketHistory.ts's RANGE_DAYS. */
const MARKET_RANGE_META: readonly { id: string; label: string }[] = [
  { id: "7D", label: "7 days" },
  { id: "30D", label: "30 days" },
  { id: "90D", label: "90 days" },
  { id: "1Y", label: "1 year" },
];

/**
 * Future protocol + ecosystem ids/labels, hand-copied from
 * pages/future/data.ts's FUTURE_PROTOCOLS and ECOSYSTEM — see this file's
 * header for why that module can't be imported directly. The fifth
 * protocol is `cuprate`, NOT tail emission — tail emission is the `hearth`
 * Learn simulator (PROTOCOL_METAPHORS_META), a distinct destination.
 */
const FUTURE_PROTOCOL_META: readonly { id: string; label: string }[] = [
  { id: "fcmp", label: "FCMP++" },
  { id: "seraphis", label: "Seraphis" },
  { id: "jamtis", label: "Jamtis" },
  { id: "carrot", label: "Carrot" },
  { id: "cuprate", label: "Cuprate" },
];
const ECOSYSTEM_META: readonly { id: string; label: string }[] = [
  { id: "stressnet", label: "Umbrel Superstress Net" },
  { id: "xmrhub", label: "XMRHUB" },
  { id: "kycrip", label: "kyc.rip" },
  { id: "xmrclub", label: "xmr.club" },
];

// ── Live ───────────────────────────────────────────────────────────────
const liveMempoolCol: IaCol = {
  h: "Mempool · 6 views",
  items: [
    // "/live/mempool?v=classic" does not satisfy the bare "/live/mempool"
    // route ("?" is not "/") — this bare item is what makes that route
    // findable as a leaf in its own right, not just via a view variant.
    // It also carries Home: `/` has nowhere else in the IA to live (see
    // file header), and this is the first, most-findable slot.
    { l: "Home", p: R.HOME },
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
    ...FUTURE_PROTOCOL_META.map((m) => ({ l: m.label, p: `${R.FUTURE}#${m.id}` })),
    ...ECOSYSTEM_META.map((m) => ({ l: m.label, p: `${R.FUTURE}#${m.id}` })),
  ],
};

// ── Operate ────────────────────────────────────────────────────────────
const operateCol: IaCol = {
  h: "Operate",
  items: [{ l: "Run a node", p: R.OPERATE_NODE }],
};

// ── About ──────────────────────────────────────────────────────────────
const aboutCol: IaCol = {
  h: "About",
  items: [
    { l: "Sources & provenance", p: R.ABOUT_SOURCES },
    { l: "Release notes", p: `${R.ABOUT_SOURCES}#release-notes` },
    { l: "Trusted peers", p: R.ABOUT_PEERS },
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
