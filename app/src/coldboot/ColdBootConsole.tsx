/**
 * coldboot/ColdBootConsole.tsx — the HUD console the cold-boot splash
 * GATES on. It never times out: it renders complete on mount (no multi-second
 * staged reveal — see the note below) and waits for the user to press Enter.
 *
 * Structurally mirrors docs/v6-mockups/coldboot-splash.html:453-554 (three
 * panes — left HUD/verification/ring/probe/matrix, centre log/histogram/CTA,
 * right the network orb) and :1162-1300 (HUD/verification/matrix build,
 * histogram, log/live-tail). The mockup supplies MECHANICS only — every
 * number below is either a real read of `useMoneroLive()` / `useNodePopulation()`
 * gated on `hasData()`/`status`, a build-time constant, or explicitly
 * MODEL-provenanced decoy data from `./decoys`. Nothing here is fabricated.
 *
 * ── THE BOOT LOG IS A FIXED, OPERATOR-RESOLVED TABLE — NOT RE-DERIVED ──────
 * See HANDOFF-XMRIRISH-20260803-15.md §4's 12-row table. Three mockup lines
 * (hostname pings) are omitted entirely, not em-dashed — an em-dashed line
 * still asserts the line exists, and this client cannot observe per-node
 * transport state. Mockup line 15 ("ready") is dropped too: coordinator-
 * ruled brief defect, accepted — it asserted nothing about the world and is
 * redundant with the Enter button itself being present and enabled.
 *
 * ── WHY THE CONSOLE DOESN'T STAGE ITS OWN REVEAL ────────────────────────────
 * The mockup animates each field in over ~1s of `T`. This component renders
 * its content whole on mount instead, for two reasons: (1) "gates on the
 * user, never times out" makes a multi-second theatrical reveal pure
 * decoration, not function — the decrypt canvas (owned elsewhere) is the
 * show; this is what it resolves into. (2) verify-coldboot.mjs §2 freezes a
 * screenshot at a fixed t=1200ms wall-clock offset and diffs two cold runs —
 * a still-animating multi-stage reveal at that instant is exactly the kind
 * of timing-sensitive state that would make two otherwise-identical runs
 * differ under real scheduler jitter. Rendering complete removes the risk
 * instead of managing it.
 *
 * ── DETERMINISM FALLS OUT OF THE HONESTY GATING, NOT EXTRA MACHINERY ───────
 * Under the e2e harness (scripts/serve-dist.mjs), every unmocked `/api/*`
 * path answers 501, so `hasData()` is false for every LIVE key throughout
 * the run: every LIVE HUD/log/net row renders a stable em-dash on both cold
 * runs. Nothing here reads `Date.now()`/`performance.now()` into visible
 * text. The two runs are byte-identical because there is nothing left that
 * could differ, not because of any determinism-specific code in this file.
 *
 * ── PERFORMANCE: MODULE-SCOPE, NOT PER-RENDER ───────────────────────────────
 * Every style object that varies per ring member / per histogram bar is
 * built ONCE at module load into a parallel array (see the `_STYLE` /
 * `_TEXT` constants below) — the component's JSX only ever picks a
 * reference (`ARR[i]`), it never constructs an object inside `.map()`.
 *
 * ── ZERO NEW CSS ─────────────────────────────────────────────────────────
 * Every rule this file needs already exists: `.mono`/`.dim`/`.dim2`/`.acc`
 * (styles.css), the global `:focus-visible` outline (styles-legibility.css:59,
 * site-wide — no new focus rule needed), and `.proto-btn`'s existing
 * `:hover`/`[disabled]` (styles.css:1590). Hover/active highlighting on ring
 * dots, histogram points and matrix rows is done by SELECTING between two
 * PRE-BUILT style-object references (idle/hot), never a CSS `:hover` rule —
 * so it works identically for mouse hover and keyboard focus. The mockup's
 * pane corner-brackets (`::before`/`::after`) are simplified to a plain
 * `border` for the same reason: buys real CSS budget for a decorative flourish.
 * CSS NEEDS LIST for the styles-motion.css owner: none.
 */

import * as React from "react";
import type { FeedKey } from "@/data/feed-status";
import { hasData } from "@/data/feed-status";
import { useMoneroLive } from "@/data/DataContext";
import type { MoneroLive } from "@/data/types";
import { fmtBytes } from "@/data/types";
import { useFeedEvents, type FeedEvent } from "@/data/useFeedEvents";
import { useNodePopulation, heightAgreementPct, type NodeHeight } from "@/data/useNodePopulation";
import { useMemStats, BlockEta } from "@/mempool/mem-stats";
import { NodeProvenance, Provenance } from "@/design/primitives";
import { useReducedMotion } from "@/design/useReducedMotion";
import { R } from "../../scripts/routes.mjs";
import { SITE_VERSION } from "@/data/siteVersion";
import {
  DECOY_RING,
  DEMO_DISCLOSURE,
  RING_MU,
  RING_SIGMA,
  HIST_XMAX_DAYS,
  HIST_BAR_HEIGHTS,
  HIST_POINTS,
  type RingMember,
} from "./decoys";

/* ══════════════════════════════════════════════════════════════════════════
 * MODULE-SCOPE CONSTANTS — computed once at import time, never inside render.
 * ══════════════════════════════════════════════════════════════════════════ */

/** Derived, never a literal — table row 3 ("routes · 13 static"). */
const ROUTE_COUNT = Object.keys(R).length;

const RING_COUNT = DECOY_RING.length;

/* ── layout shells ── */

const ROOT_STYLE: React.CSSProperties = {
  position: "relative",
  display: "flex",
  flexDirection: "column",
  /* fills the stage so the grid below has slack to give the orb stage */
  flex: 1,
  minHeight: 0,
  gap: 10,
  padding: 14,
  background: "var(--bg-1)",
  border: "1px solid var(--line-d)",
  borderRadius: 2,
  fontFamily: "var(--f-mono)",
  color: "var(--ink-100)",
};

const TOPBAR_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontSize: "var(--fs-label)",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--ink-60)",
};

/**
 * Height of the empty box this pane reserves for the orb — the orb itself is a
 * viewport-fixed overlay mounted from App.tsx, and only measures this rect.
 *
 * It was 160, and 160 is what broke the orb. `Orb.tsx` renders a flex column of
 * [canvas wrap, badge/caption overlay] where only the wrap can shrink, so the
 * whole 160 went to the overlay and the canvas got zero height — measured on
 * 95316a3: overlay 153.5 in a 160 box at 1440x900, and 180.1 in the same 160 at
 * 390x844. See `orb.ts#ORB_MIN_CANVAS_PX` for the full mechanism.
 *
 * 400 is derived, not chosen by eye: worst measured overlay 180.1 (390x844,
 * 288px-wide pane) + `Orb.tsx#BASE_STYLE`'s 8px gap + a canvas worth drawing.
 * Measured after the change, the canvas receives 238.5px at 1440x900 and
 * 211.9px at 390x844 — both far above the 120 floor, which is the intent: the
 * floor is insurance, this number is the feature.
 *
 * It costs the console no height at all on desktop.
 *
 * The two sentences that used to follow — "The grid is `alignItems:"start"` and
 * its row is driven by the HUD pane, measured at 870.8 against this pane's 430
 * at 1440x900" — were true when written and are both false now. `gridStyle`
 * ships `alignItems: stacked ? "start" : "stretch"`, so `start` describes the
 * stacked branch only; and under `stretch` the row is VIEWPORT-driven rather
 * than driven by any pane, measured 976 at 1920x1080 and 796.5 at 1440x900.
 * The conclusion survives its own reasoning: the console root measures 852 at
 * 1440x900 and this floor is nowhere near binding there.
 */
const ORB_SLOT_MIN_PX = 400;

/** The three panes are NOT equal width. Verbatim from the mockup's `.con-grid`
 *  (docs/v6-mockups/coldboot-splash.html:185) — LOG is deliberately widest, and
 *  equal columns are why production read evenly divided where the mockup reads
 *  composed. Confirmed against that file's own selector before adopting: the
 *  rule belongs to `.con-grid`, which is the console grid, not to a neighbour.
 *
 *  This costs the auto-fit reflow the previous value got for free, so the
 *  one-column collapse is now explicit and keyed to the mockup's own 1100px
 *  breakpoint (`@media (max-width:1100px)` at :357). Resolved with matchMedia
 *  rather than a stylesheet because this file ships zero new CSS by design. */
const GRID_COLS_WIDE = "minmax(0,1.00fr) minmax(0,1.12fr) minmax(0,1.04fr)";
const GRID_COLS_STACKED = "minmax(0, 1fr)";
const GRID_STACK_QUERY = "(max-width: 1100px)";

function gridStyle(stacked: boolean): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: stacked ? GRID_COLS_STACKED : GRID_COLS_WIDE,
    /* p4·M1 · THE OVERPRINT FIX, and it is the whole mobile hotfix.
       Stacked, this grid is `flex:1; minHeight:0; overflowY:auto`, so it has a
       DEFINITE height (the console body, ~738px at 390x844). With one column and
       three children the browser makes three IMPLICIT rows, and implicit-`auto`
       rows under a definite height are stretched by the default `align-content`
       to EQUAL fractions — measured `236.672px x3` at 390. The three panes carry
       `minHeight:0` (PANE_STYLE), so they are crushed to those 237px rows while
       their real content (HUD 861px · LOG 590px · NETWORK 733px) overflows the
       row and OVERPRINTS the panes below: measured 1288px of total pane overlap
       at 390 (1389 at 360, 1103 at 430). That overprint is the "wall of glyphs".
       `gridAutoRows: max-content` sizes each implicit row to its pane's own
       content instead, so the panes stack cleanly at natural height and the grid
       scrolls — no overlap, orb floor intact. Stacked ONLY; wide is untouched and
       its equal-height rows are load-bearing (they hand slack to the orb stage). */
    ...(stacked ? { gridAutoRows: "max-content" as const } : null),
    gap: 14,
    /* `stretch`, not `start`: the row must be as tall as the grid so the
       Network pane can hand its slack to the orb stage. Stacked, the panes go
       back to content height (via gridAutoRows above) and the console scrolls. */
    alignItems: stacked ? "start" : "stretch",
    flex: 1,
    minHeight: 0,
    /* Stacked, the three panes are far taller than the viewport (measured 2184px
       of natural stack at 390) and the stage clips with overflow:hidden, so the
       orb was unreachable. The mockup solves it the same way — `.con-grid`
       gains `overflow-y:auto` inside its own 1100px block. */
    overflowY: stacked ? "auto" : "visible",
  };
}

/* ── THE OTHER TWO GROWERS ────────────────────────────────────────────────
 * The mockup gives each of the three panes exactly ONE `flex:1` child, and
 * production ported one of them — the orb stage. The LEFT output table and the
 * CENTRE log were hard `maxHeight: 220` boxes, so nothing in those columns
 * could absorb slack: the centre column ended where its content ended and
 * ENTER, its last child, ended with it. Measured dead space below ENTER on
 * 63dc1a8: 723.9px at 2560x1440, 363.9 at 1920, 200.4 at 1600, 195.7 at 1440,
 * 105.7 at 1280.
 *
 * Each constant carries its mockup line, because a bare literal cannot hold its
 * own citation — which is how `220` came to ship twice with nothing pointing at
 * either. `verify-coldboot.mjs` §8 PARSES these by name rather than restating
 * them, the same idiom verify-orb uses for ORB_RADIUS_FRAC.
 */
const MATRIX_MIN_PX = 80;            // mockup :227  .matrix{flex:1 1 auto;min-height:80px}
const MATRIX_MAX_STACKED_PX = 150;   // mockup :361  .matrix{max-height:150px;flex:none}
const LOG_MIN_STACKED_PX = 150;      // mockup :362  .log{min-height:150px}

/** LEFT · the decoy-output table. Mockup `.matrix` — a grower in wide, a capped
 *  non-grower stacked. Keeps `1 1 auto` because its stacked branch is
 *  `flex:"none"`, so the inert-floor hazard documented on the log below cannot
 *  arise here, and MATRIX_MIN_PX stays a real shrink floor in wide. */
function matrixScrollerStyle(stacked: boolean): React.CSSProperties {
  return stacked
    ? { flex: "none", maxHeight: MATRIX_MAX_STACKED_PX, overflowY: "auto", overflowX: "hidden" }
    : { flex: "1 1 auto", minHeight: MATRIX_MIN_PX, overflowY: "auto", overflowX: "hidden" };
}

/** CENTRE · the log. `flex:"1 1 0"`, mockup-exact, and the basis is load-bearing
 *  rather than stylistic. Measured stacked, identical at 390x844 and 1100x900:
 *
 *    flex:1 1 0     min-height:0     -> logH   0    the collapse the floor prevents
 *    flex:1 1 auto  min-height:0     -> logH 240    no collapse
 *    flex:1 1 0     min-height:150   -> logH 150    the mockup's behaviour
 *    flex:1 1 auto  min-height:150   -> logH 240    the floor is INERT
 *
 *  Wide (1440x900) all four read 415.7, so the two forms are interchangeable
 *  wherever the pane has a definite height. They are not interchangeable in the
 *  content-sized stacked column: basis-`auto` does not degrade safely to content
 *  height, it makes LOG_MIN_STACKED_PX control NOTHING — the constant would
 *  ship, cite its mockup line, be parsed by §8, and be dead. §8's stacked
 *  assertion is two-sided (`|logH - LOG_MIN_STACKED_PX| <= 1`) for the same
 *  reason: a one-sided `>= 149` passes at 240, which is exactly what an inert
 *  floor reads.
 *
 *  `minHeight: 0` in the wide branch is the honest else-branch of the ternary
 *  and nothing more. It is NOT preventing a min-content blowout — `overflow:
 *  hidden` already zeroes the flex automatic minimum size, measured
 *  byte-identical at 1920x1080 with `min-height` at `auto` and at `0` (logH
 *  583.9, lastChildBottom 1029, scrollHeight 584 both ways). It is written out
 *  so the stacked branch's floor has a visible counterpart.
 *
 *  `overflow: hidden` + `justify-content: flex-end` is the mockup's own
 *  composition and is what makes the pane header's "live tail" label true: the
 *  newest line sits on the pane floor and the TOP is what clips. Once boot lines
 *  plus events exceed the pane the boot table scrolls off and is not
 *  recoverable — correct terminal behaviour, and what the mockup's own
 *  `.slice(-80)` does. */
function logScrollerStyle(stacked: boolean): React.CSSProperties {
  return {
    fontFamily: "var(--f-mono)",
    fontSize: "var(--fs-mono)",
    lineHeight: 1.6,
    flex: "1 1 0",
    minHeight: stacked ? LOG_MIN_STACKED_PX : 0,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
  };
}

/** The log's lines, as ONE child of that flex column.
 *
 *  THE WRAPPER ELEMENT IS THE MECHANISM; this style is insurance. Without a
 *  wrapper each line div is itself a flex item, and those divs carry
 *  `overflow:"hidden"` for their ellipsis — which zeroes their flex automatic
 *  minimum size, so they COMPRESS instead of overflowing. Measured at 390 with
 *  the 150px floor and no wrapper: rendered line heights 12.5px against a
 *  computed `line-height` of 20px, a 37.5% crush, while `scrollHeight ===
 *  clientHeight` (150/150) so nothing anywhere reports overflow — a box that
 *  "fits" because its contents were crushed. With the wrapper: 20px.
 *
 *  `flex: "0 0 auto"` is deliberately NOT load-bearing, and that was measured
 *  rather than assumed: a break test that stripped this style but kept the
 *  wrapper div stayed GREEN at 20px, because a plain div sets no `overflow` and
 *  so keeps `min-height: auto` == min-content and cannot shrink either way. It
 *  is written out because the containing column's whole job is distributing
 *  free space, and a child that must never participate should say so rather
 *  than rely on not having opted in. `verify-coldboot.mjs` §8 finds the line
 *  rows STRUCTURALLY (leaf divs bearing text) for the matching reason — a
 *  positional lookup walks through this node, so removing it would report
 *  "0 sampled" instead of measuring the crush that removing it causes. */
const LOG_LINES_STYLE: React.CSSProperties = { flex: "0 0 auto" };

const PANE_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  minWidth: 0,
  minHeight: 0,
  border: "1px solid var(--line-d)",
  borderRadius: 2,
  padding: 11,
  background: "var(--bg-0)",
};

const PANE_HD_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 9,
  flexWrap: "wrap",
};

const PANE_HD_TITLE_STYLE: React.CSSProperties = {
  fontFamily: "var(--f-mono)",
  fontSize: "var(--fs-label)",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "var(--o-50)",
};

const PANE_HD_SUB_STYLE: React.CSSProperties = {
  marginLeft: "auto",
  fontFamily: "var(--f-mono)",
  fontSize: "var(--fs-label)",
  color: "var(--ink-40)",
  letterSpacing: "0.08em",
};

const SUB_STYLE: React.CSSProperties = {
  fontFamily: "var(--f-mono)",
  fontSize: "var(--fs-label)",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--ink-40)",
};

const SUB_NOCAPS_STYLE: React.CSSProperties = { ...SUB_STYLE, textTransform: "none", letterSpacing: "0.1em" };

/* ── HUD rows ── */

const HUD_ROW_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  alignItems: "baseline",
  gap: 8,
  padding: "3px 0",
  fontSize: "var(--fs-mono)",
};

const HUD_KEY_STYLE: React.CSSProperties = { color: "var(--ink-40)", letterSpacing: "0.06em" };
const HUD_VAL_STYLE: React.CSSProperties = { color: "var(--o-60)", whiteSpace: "nowrap" };
const HUD_VAL_MUTED_STYLE: React.CSSProperties = { ...HUD_VAL_STYLE, color: "var(--ink-40)" };

/* ── verification checklist ── */

const VF_ROW_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "14px 1fr auto",
  gap: 7,
  alignItems: "baseline",
  fontSize: "var(--fs-mono)",
};

const VF_ROWS: ReadonlyArray<{ mark: string; label: string; value: string; bad: boolean }> = [
  { mark: "✓", label: "ring size", value: "16 / 16", bad: false },
  { mark: "✓", label: "key image", value: "unique", bad: false },
  { mark: "✓", label: "range proof", value: "bulletproof+", bad: false },
  { mark: "✓", label: "signature", value: "valid over ring", bad: false },
  { mark: "✗", label: "signer index", value: "indeterminate", bad: true },
];

/* ── ring (SVG) — positions computed once ── */

const RING_VB = 200;
const RING_CX = RING_VB / 2;
const RING_CY = RING_VB / 2;
const RING_R = 78;

interface RingDot {
  readonly i: number;
  readonly cx: number;
  readonly cy: number;
  readonly real: boolean;
}

const RING_DOTS: readonly RingDot[] = DECOY_RING.map((m) => {
  const ang = (m.i / RING_COUNT) * Math.PI * 2 - Math.PI / 2;
  return {
    i: m.i,
    cx: RING_CX + Math.cos(ang) * RING_R,
    cy: RING_CY + Math.sin(ang) * RING_R,
    real: m.real,
  };
});

const RING_DOT_IDLE: readonly React.CSSProperties[] = RING_DOTS.map(() => ({
  fill: "var(--o-50)",
  fillOpacity: 0.46,
  cursor: "pointer",
}));
const RING_DOT_HOT: readonly React.CSSProperties[] = RING_DOTS.map(() => ({
  fill: "var(--o-100)",
  fillOpacity: 0.98,
  cursor: "pointer",
}));

/* ── histogram — bars and points, precomputed once ── */

const HIST_BAR_STYLE: readonly React.CSSProperties[] = HIST_BAR_HEIGHTS.map((h) => ({
  flex: 1,
  height: `${(h * 100).toFixed(1)}%`,
  background: "linear-gradient(to top, rgba(255,122,26,0.30), rgba(255,122,26,0.07))",
  minWidth: 1,
}));

const HIST_POINT_IDLE: readonly React.CSSProperties[] = HIST_POINTS.map((p) => ({
  position: "absolute",
  left: `${p.leftPct.toFixed(2)}%`,
  bottom: `${p.bottomPct.toFixed(2)}%`,
  width: p.real ? 7 : 5,
  height: p.real ? 7 : 5,
  borderRadius: "50%",
  transform: "translate(-50%, 50%)",
  background: p.real ? "var(--tk-accent)" : "var(--ink-40)",
  boxShadow: p.real ? "var(--glow-1)" : "none",
  cursor: "pointer",
}));
const HIST_POINT_HOT: readonly React.CSSProperties[] = HIST_POINT_IDLE.map((base) => ({
  ...base,
  background: "var(--o-50)",
  width: 7,
  height: 7,
}));

const HIST_AXIS_LABELS: readonly string[] = ["0 d", "10 d", "30 d", "60 d"];

/* ── candidate matrix — text + row styles, precomputed once ── */

const MATRIX_COLS = "22px minmax(0,1fr) 52px 44px 50px";

interface MatrixRowText {
  readonly n: string;
  readonly output: string;
  readonly age: string;
  readonly wt: string;
}

const MATRIX_TEXT: readonly MatrixRowText[] = DECOY_RING.map((m) => ({
  n: String(m.i).padStart(2, "0"),
  output: `${m.id}…`,
  age: `${m.age.toFixed(1)} d`,
  wt: m.weight.toFixed(3),
}));

const MATRIX_ROW_BASE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: MATRIX_COLS,
  gap: 6,
  fontSize: "var(--fs-mono)",
  padding: "2px 4px",
  borderRadius: 2,
  cursor: "pointer",
  alignItems: "baseline",
};
const MATRIX_ROW_IDLE: readonly React.CSSProperties[] = DECOY_RING.map((m) => ({
  ...MATRIX_ROW_BASE,
  color: m.real ? "var(--o-80)" : "var(--ink-60)",
}));
const MATRIX_ROW_HOT: readonly React.CSSProperties[] = DECOY_RING.map((m) => ({
  ...MATRIX_ROW_BASE,
  color: "var(--o-100)",
  background: "rgba(255,122,26,0.12)",
}));
const MATRIX_HD_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: MATRIX_COLS,
  gap: 6,
  fontSize: "var(--fs-label)",
  color: "var(--ink-20)",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  padding: "0 4px 4px",
};

/* ══════════════════════════════════════════════════════════════════════════
 * data helpers
 * ══════════════════════════════════════════════════════════════════════════ */

/* `heightAgreementPct` was defined here, character-identical to the copy in
 * NodePopulationPanel.tsx, under a comment naming that exact hazard. It now
 * lives once in @/data/useNodePopulation beside the type it reads, so the two
 * surfaces cannot drift rather than being checked for drift. */

interface HudRow {
  readonly label: string;
  readonly value: string;
  readonly keys: readonly FeedKey[];
}

function buildHudRows(data: MoneroLive, memTxCount: number, memBytes: number): HudRow[] {
  const netOk = hasData(data.status.network);
  const memOk = hasData(data.status.mempool);
  const mktOk = hasData(data.status.market);
  return [
    { label: "Height", value: netOk ? data.height.toLocaleString() : "—", keys: ["network"] },
    { label: "Hashrate", value: netOk && data.hashrate > 0 ? `${(data.hashrate / 1e9).toFixed(2)} GH/s` : "—", keys: ["network"] },
    { label: "Difficulty", value: netOk && data.difficulty > 0 ? `${(data.difficulty / 1e9).toFixed(2)}G` : "—", keys: ["network"] },
    { label: "Mempool", value: memOk ? `${memTxCount} tx · ${fmtBytes(memBytes)}` : "—", keys: ["mempool"] },
    { label: "XMR / USD", value: mktOk ? `$${data.price.toFixed(2)}` : "—", keys: ["market"] },
  ];
}

/** Boot log — the operator-resolved 12-row table (HANDOFF §4). Ordered
 *  exactly as given: always-true facts first (rows 1-5), then LIVE facts
 *  that resolve once the feed has something to say (6-11), closing on the
 *  thematic MODEL line (12). Hostname lines are omitted upstream (never
 *  existed here); mockup's "ready" (line 15) is dropped per coordinator
 *  ruling — redundant with the Enter button's own enabled state. */
function buildLogLines(
  data: MoneroLive,
  memTxCount: number,
  memBytes: number,
  nodePop: ReturnType<typeof useNodePopulation>,
): ReadonlyArray<{ text: string; tone: "acc" | "ok" | "warn" | "dim" }> {
  const netOk = hasData(data.status.network);
  const memOk = hasData(data.status.mempool);
  const mktOk = hasData(data.status.market);
  const nodeOk = !!nodePop.data && nodePop.data.status !== "unavailable";
  const agreement = nodeOk && nodePop.data && nodePop.data.status !== "unavailable" ? heightAgreementPct(nodePop.data.height) : null;

  return [
    { text: `cold boot · ${SITE_VERSION}`, tone: "acc" },
    { text: "csp connect-src self · ok", tone: "dim" },
    { text: `routes · ${ROUTE_COUNT} static`, tone: "dim" },
    { text: "entropy pool seeded · mulberry32", tone: "dim" },
    { text: `decoys sampled · log-normal µ${RING_MU.toFixed(2)} σ${RING_SIGMA.toFixed(2)} · n=${RING_COUNT}`, tone: "dim" },
    { text: `chain tip ${netOk ? data.height.toLocaleString() : "—"}`, tone: netOk ? "ok" : "dim" },
    { text: `txpool ${memOk ? `${memTxCount} tx / ${fmtBytes(memBytes)}` : "—"}`, tone: memOk ? "ok" : "dim" },
    { text: `xmr/usd ${mktOk ? `$${data.price.toFixed(2)}` : "—"}`, tone: mktOk ? "ok" : "dim" },
    {
      text: `monero.fail · ${nodeOk && nodePop.data && nodePop.data.status !== "unavailable" ? nodePop.data.counts.reachable.toLocaleString() : "—"} reachable`,
      tone: nodeOk ? "ok" : "dim",
    },
    {
      text:
        nodeOk && nodePop.data && nodePop.data.status !== "unavailable"
          ? `transports ${nodePop.data.split.clear} / ${nodePop.data.split.tor} / ${nodePop.data.split.i2p} · clear tor i2p`
          : "transports — · clear tor i2p",
      tone: nodeOk ? "ok" : "dim",
    },
    { text: `height agreement ${agreement != null ? `${agreement.toFixed(1)} %` : "—"} at tip`, tone: agreement != null ? "ok" : "dim" },
    { text: "ring verified · signer ???", tone: "warn" },
  ];
}

const LOG_TONE_COLOR: Record<"acc" | "ok" | "warn" | "dim", string> = {
  acc: "var(--o-50)",
  ok: "var(--g-50)",
  warn: "var(--y-50)",
  dim: "var(--ink-60)",
};

/** One line of real, honest live-tail copy per FeedEvent kind. No invented
 *  hashes, no drifted counters — every field is read straight off the event
 *  useFeedEvents (@/data/useFeedEvents) already derived from real snapshots. */
function feedEventLine(e: FeedEvent): string {
  switch (e.kind) {
    case "block":
      return `block ${e.height.toLocaleString()} · ${e.txs} tx · ${fmtBytes(e.sizeKB * 1024)}`;
    case "tx":
      return `tx ${e.id.slice(0, 8)}… · ${fmtBytes(e.size)} · ${e.fee.toFixed(8)} XMR`;
    case "txdrop":
      return `pool –${e.count} tx`;
    case "stale":
      return "feed degraded · STALE · reconnecting";
    case "recover":
      return "feed recovered";
    /* istanbul ignore next -- exhaustive union, no default needed at runtime */
  }
}

/* ══════════════════════════════════════════════════════════════════════════
 * component
 * ══════════════════════════════════════════════════════════════════════════ */

export interface ColdBootConsoleProps {
  /** Fired once, on click OR the Enter key, when the user activates the CTA.
   *  This component does not touch sessionStorage itself — the parent owns
   *  the once-per-session write and the splash/console unmount. */
  onEnter: () => void;
  /**
   * Rendered inside the right-column network-orb slot this component owns
   * and measures. Typically the orb component itself (owned elsewhere) —
   * per verify-coldboot.mjs §4 it must be a PERSISTENT node that survives
   * the Enter handoff (same `[data-orb]` element, not destroyed/recreated),
   * so this component deliberately does not mount or key the orb itself.
   */
  orbSlot?: React.ReactNode;
  /**
   * Fires with the slot's current viewport rect on mount, on resize, and
   * with `null` on unmount — so a persistent orb component can position
   * itself to match this slot while the console is showing, then animate to
   * Main Home's slot across the handoff.
   */
  onOrbRectChange?: (rect: DOMRect | null) => void;
}

export function ColdBootConsole({ onEnter, orbSlot, onOrbRectChange }: ColdBootConsoleProps): React.JSX.Element {
  const data = useMoneroLive();
  const nodePop = useNodePopulation();
  const events = useFeedEvents(data);
  /* `useFeedEvents` PREPENDS (`useFeedEvents.ts:85` —
     `[...fresh.reverse(), ...old].slice(0, cap)`), so `events[0]` is the NEWEST.
     The log below is bottom-anchored, and rendering that raw order would pin the
     OLDEST event to the pane floor and push the newest up under the boot table —
     making the header's "live tail" label LESS true, which is the opposite of
     the reason the anchoring was adopted. The mockup is unambiguous: `paintLog`
     (coldboot-splash.html:1285-1298) pushes boot rows in order, then live rows
     in order, then `.slice(-80)` — chronological ascending, newest last.

     Scoped to this file rather than fixed in the hook ON PURPOSE. `useFeedEvents`
     has five consumers (here, `useOrbData`, and mempool's bridge/terminal/
     constellation); reversing inside it would silently flip render order on four
     surfaces that are not part of this change. The spread copies before
     `reverse()` mutates, so the hook's own state array is untouched. */
  const tail = React.useMemo(() => [...events].reverse(), [events]);
  const memStats = useMemStats(data);
  useReducedMotion(); // read for parity with the rest of the app; this component has no
  // motion to suppress (see the "doesn't stage its own reveal" header note) —
  // called so a future reduced-motion-gated addition here has the hook already
  // in scope rather than a silent re-introduction of an ungated animation.

  const [hoverI, setHoverI] = React.useState<number>(-1);
  const firedRef = React.useRef(false);

  const fireEnter = React.useCallback(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    onEnter();
  }, [onEnter]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        fireEnter();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fireEnter]);

  const orbSlotRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const el = orbSlotRef.current;
    if (!el || !onOrbRectChange) return;
    const report = () => onOrbRectChange(el.getBoundingClientRect());
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    window.addEventListener("resize", report);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", report);
      onOrbRectChange(null);
    };
  }, [onOrbRectChange]);

  const hudRows = buildHudRows(data, memStats.txCount, memStats.poolBytes);
  const logLines = buildLogLines(data, memStats.txCount, memStats.poolBytes, nodePop);

  const nodeOk = !!nodePop.data && nodePop.data.status !== "unavailable";
  const nodeD = nodeOk && nodePop.data && nodePop.data.status !== "unavailable" ? nodePop.data : null;
  const splitTotal = nodeD ? nodeD.split.total : 0;
  const clearPct = nodeD && splitTotal > 0 ? (nodeD.split.clear / splitTotal) * 100 : 0;
  const torPct = nodeD && splitTotal > 0 ? (nodeD.split.tor / splitTotal) * 100 : 0;
  const i2pPct = nodeD && splitTotal > 0 ? (nodeD.split.i2p / splitTotal) * 100 : 0;
  // Evaluated ONCE per render. The previous form called it twice in one JSX
  // expression — for the null check and again for the value — inside a render
  // path on the LCP route.
  const agreementPct = nodeD ? heightAgreementPct(nodeD.height) : null;

  const hovered: RingMember | null = hoverI >= 0 ? DECOY_RING[hoverI] : null;

  /* Live, because the console is mounted across an orientation flip and a
     desktop window resize, and a value read once at mount would strand the
     wrong column count there. useSyncExternalStore rather than an effect so the
     FIRST render already has the right answer — an effect would paint three
     weighted columns at 390px for a frame. */
  const stacked = React.useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(GRID_STACK_QUERY);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(GRID_STACK_QUERY).matches,
    () => false,
  );

  return (
    <section data-coldboot-console="ready" style={ROOT_STYLE} aria-label="Cold boot console">
      <div style={TOPBAR_STYLE}>
        <span>Cold boot · {SITE_VERSION}</span>
        <NodeProvenance source="node" keys={["network", "mempool", "market"]} status={data.status} compact style={{ marginLeft: "auto" }} />
      </div>

      {/* `data-cb-grid` carries the branch matchMedia CHOSE, so a gate can check
          it against what the browser RESOLVED. Without it a 390 run that
          resolved `wide` passes every height assertion while the stacked branch
          — the one that reads 0.0px without its floor — is never exercised. */}
      <div data-cb-grid={stacked ? "stacked" : "wide"} style={gridStyle(stacked)}>
        {/* ── LEFT · HUD + verification + ring + probe + matrix ── */}
        <div data-cb-pane="hud" style={PANE_STYLE}>
          <div style={PANE_HD_STYLE}>
            <span style={PANE_HD_TITLE_STYLE}>HUD</span>
            <span style={PANE_HD_SUB_STYLE}>chain state</span>
          </div>

          <div>
            {hudRows.map((row) => (
              <div key={row.label} style={HUD_ROW_STYLE}>
                <span style={HUD_KEY_STYLE}>{row.label}</span>
                <span style={row.value === "—" ? HUD_VAL_MUTED_STYLE : HUD_VAL_STYLE}>{row.value}</span>
              </div>
            ))}
            <div style={HUD_ROW_STYLE}>
              <span style={HUD_KEY_STYLE}>Block target</span>
              <span style={{ ...HUD_VAL_MUTED_STYLE, color: "var(--ink-60)" }}>
                {data.blockTarget > 0 ? `${data.blockTarget}s (protocol constant)` : "—"}
              </span>
            </div>
          </div>

          <div style={SUB_STYLE}>Verification</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {VF_ROWS.map((row) => (
              <div key={row.label} style={{ ...VF_ROW_STYLE, color: row.bad ? "var(--r-50)" : undefined }}>
                <span style={{ color: row.bad ? "var(--r-50)" : "var(--g-50)" }}>{row.mark}</span>
                <span style={{ color: row.bad ? "var(--r-50)" : "var(--ink-60)" }}>{row.label}</span>
                <span style={{ color: row.bad ? "var(--r-50)" : "var(--ink-40)" }}>{row.value}</span>
              </div>
            ))}
          </div>
          <p style={{ margin: 0, fontSize: "var(--fs-label)", lineHeight: 1.45, color: "var(--ink-40)" }}>
            Four checks pass. The fifth has no answer — not because the proof is weak, but because the
            protocol never encoded one.
          </p>

          <div style={SUB_STYLE}>
            Ring <span style={{ color: "var(--ink-20)", textTransform: "none", letterSpacing: 0 }}>{RING_COUNT} members · 1 signer</span>
          </div>
          <svg
            viewBox={`0 0 ${RING_VB} ${RING_VB}`}
            style={{ width: "100%", height: "clamp(140px, 16.5vh, 206px)" }}
            role="img"
            aria-label="Ring of 16 candidate signers, indistinguishable from outside the transaction"
          >
            <circle cx={RING_CX} cy={RING_CY} r={RING_R} fill="none" stroke="rgba(255,122,26,0.24)" strokeWidth={1} />
            {RING_DOTS.map((d) => (
              <circle
                key={d.i}
                cx={d.cx}
                cy={d.cy}
                r={hoverI === d.i ? 5.5 : 3.2}
                style={hoverI === d.i ? RING_DOT_HOT[d.i] : RING_DOT_IDLE[d.i]}
                tabIndex={0}
                role="button"
                aria-label={`Ring member ${d.i}`}
                onMouseEnter={() => setHoverI(d.i)}
                onMouseLeave={() => setHoverI(-1)}
                onFocus={() => setHoverI(d.i)}
                onBlur={() => setHoverI(-1)}
              />
            ))}
            <text x={RING_CX} y={RING_CY - 3} textAnchor="middle" fill="rgba(255,206,138,0.95)" fontSize={13} fontFamily="var(--f-mono)">
              {hoverI >= 0 ? `#${String(hoverI).padStart(2, "0")}` : `${RING_COUNT} / ${RING_COUNT}`}
            </text>
            <text x={RING_CX} y={RING_CY + 13} textAnchor="middle" fill="rgba(168,160,148,0.5)" fontSize={11} fontFamily="var(--f-mono)">
              {hoverI >= 0 ? "MEMBER" : "INDISTINGUISHABLE"}
            </text>
          </svg>

          <div
            style={{
              border: "1px solid var(--line-d)",
              borderRadius: 2,
              background: "var(--bg-1)",
              padding: "8px 10px",
              fontSize: "var(--fs-label)",
              lineHeight: 1.5,
            }}
          >
            {hovered ? (
              <>
                <b style={{ color: "var(--o-60)", fontWeight: 400 }}>#{String(hovered.i).padStart(2, "0")}</b>
                {" · out "}
                <b style={{ color: "var(--o-60)", fontWeight: 400 }}>{hovered.oidx.toLocaleString()}</b>
                {" · id "}
                <b style={{ color: "var(--o-60)", fontWeight: 400 }}>{hovered.id}…</b>
                <br />
                {"age "}
                <b style={{ color: "var(--o-60)", fontWeight: 400 }}>{hovered.age.toFixed(1)} d</b>
                {" · weight "}
                <b style={{ color: "var(--o-60)", fontWeight: 400 }}>{hovered.weight.toFixed(3)}</b>
                {" · amount "}
                <span style={{ color: "var(--ink-40)" }}>▮ hidden by RingCT ▮</span>
              </>
            ) : (
              <span style={{ color: "var(--ink-40)" }}>Select a ring member or a matrix row.</span>
            )}
            <em style={{ fontStyle: "normal", color: "var(--ink-40)", display: "block", marginTop: 2 }}>
              Verification confirms this output could have signed. So could the other {RING_COUNT - 1}.
            </em>
          </div>

          <div data-cb-matrix="" style={matrixScrollerStyle(stacked)}>
            <div style={MATRIX_HD_STYLE}>
              <span>#</span>
              <span>output</span>
              <span>age</span>
              <span>wt</span>
              <span>amt</span>
            </div>
            {DECOY_RING.map((m) => (
              <div
                key={m.i}
                style={hoverI === m.i ? MATRIX_ROW_HOT[m.i] : MATRIX_ROW_IDLE[m.i]}
                tabIndex={0}
                role="button"
                aria-label={`Matrix row ${m.i}`}
                onMouseEnter={() => setHoverI(m.i)}
                onMouseLeave={() => setHoverI(-1)}
                onFocus={() => setHoverI(m.i)}
                onBlur={() => setHoverI(-1)}
              >
                <span style={{ color: "var(--ink-20)" }}>{MATRIX_TEXT[m.i].n}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{MATRIX_TEXT[m.i].output}</span>
                <span>{MATRIX_TEXT[m.i].age}</span>
                <span>{MATRIX_TEXT[m.i].wt}</span>
                <span style={{ color: "var(--ink-20)", letterSpacing: "0.06em" }}>▮▮▮▮</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── CENTRE · log + decoys + CTA ── */}
        <div data-cb-pane="log" style={PANE_STYLE}>
          <div style={PANE_HD_STYLE}>
            <span style={PANE_HD_TITLE_STYLE}>Log</span>
            <span style={PANE_HD_SUB_STYLE}>{events.length > 0 ? "live tail" : "boot"}</span>
          </div>

          <div data-cb-log="" style={logScrollerStyle(stacked)}>
            <div style={LOG_LINES_STYLE}>
              {logLines.map((line, i) => (
                <div key={i} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: LOG_TONE_COLOR[line.tone] }}>
                  {line.text}
                </div>
              ))}
              {tail.map((e, i) => (
                <div key={`ev-${i}`} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--ink-60)" }}>
                  {feedEventLine(e)}
                </div>
              ))}
            </div>
          </div>

          <div style={SUB_NOCAPS_STYLE}>
            Decoy age distribution{" "}
            <span style={{ color: "var(--ink-20)", textTransform: "none", letterSpacing: 0 }}>
              log-normal µ {RING_MU.toFixed(2)} σ {RING_SIGMA.toFixed(2)}
            </span>
          </div>
          <Provenance source="model" detail="demonstration ring" />

          <div style={{ position: "relative", height: "clamp(70px, 10vh, 106px)", display: "flex", alignItems: "flex-end", gap: 1 }}>
            {HIST_BAR_STYLE.map((s, i) => (
              <i key={i} style={s} />
            ))}
            {HIST_POINTS.map((p) => (
              <span
                key={p.i}
                style={hoverI === p.i ? HIST_POINT_HOT[p.i] : HIST_POINT_IDLE[p.i]}
                tabIndex={0}
                role="button"
                aria-label={`Decoy age point ${p.i}`}
                onMouseEnter={() => setHoverI(p.i)}
                onMouseLeave={() => setHoverI(-1)}
                onFocus={() => setHoverI(p.i)}
                onBlur={() => setHoverI(-1)}
              />
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)", color: "var(--ink-20)" }}>
            {HIST_AXIS_LABELS.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </div>
          <p style={{ margin: 0, fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)", lineHeight: 1.42, color: "var(--ink-40)" }}>
            {DEMO_DISCLOSURE}
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            <div style={{ border: "1px solid var(--line-d)", borderRadius: 2, padding: "6px 8px", background: "var(--bg-1)" }}>
              <b style={{ display: "block", fontSize: "var(--fs-label)", letterSpacing: "0.14em", color: "var(--ink-40)", fontWeight: 400 }}>Mempool</b>
              <span style={{ fontSize: "var(--fs-mono)", color: "var(--o-60)" }}>{hasData(data.status.mempool) ? `${memStats.txCount} tx` : "—"}</span>
            </div>
            <div style={{ border: "1px solid var(--line-d)", borderRadius: 2, padding: "6px 8px", background: "var(--bg-1)" }}>
              <b style={{ display: "block", fontSize: "var(--fs-label)", letterSpacing: "0.14em", color: "var(--ink-40)", fontWeight: 400 }}>Pool</b>
              <span style={{ fontSize: "var(--fs-mono)", color: "var(--o-60)" }}>{hasData(data.status.mempool) ? fmtBytes(memStats.poolBytes) : "—"}</span>
            </div>
            <div style={{ border: "1px solid var(--line-d)", borderRadius: 2, padding: "6px 8px", background: "var(--bg-1)" }}>
              <b style={{ display: "block", fontSize: "var(--fs-label)", letterSpacing: "0.14em", color: "var(--ink-40)", fontWeight: 400 }}>Next block</b>
              <span style={{ fontSize: "var(--fs-mono)", color: "var(--o-60)" }}>
                <BlockEta data={data} />
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {/* `data-cb-enter` so a gate can find this without `button.proto-btn`,
                which is a class shared app-wide and would survive a rename badly.
                Gates scope every lookup to the console root as well — belt and
                braces, since Main Home stays mounted underneath the splash. */}
            <button type="button" data-cb-enter="" className="proto-btn" style={{ flex: 1, textAlign: "center" }} onClick={fireEnter}>
              Enter ▸
            </button>
          </div>
        </div>

        {/* ── RIGHT · the network orb ──
            The orb stage below is `flex:1 1 auto`, so with the grid row
            stretched this pane's leftover height lands THERE rather than being
            spread across every pane.

            This comment used to end "the stage grows, the HUD and Log keep
            their content height and are not stretched into clipping", and v6.1.10
            deliberately reversed that half. It was right about THIS pane and
            wrong about the centre one, for a reason that is structural rather
            than a matter of taste: the orb stage is in the RIGHT column, so it
            can only absorb the RIGHT pane's slack. The centre pane's leftover
            landed nowhere at all — it fell out of the bottom of the column as
            dead space below ENTER, measured 723.9px at 2560x1440 and 363.9 at
            1920. Each pane now has the one grower the mockup gives it: this
            stage here, `.matrix` in the HUD pane, `.log` in the centre. Nothing
            is stretched into clipping — the two scrollers still bound
            themselves, they simply bound themselves to the pane instead of to a
            literal 220. */}
        <div data-cb-pane="network" style={PANE_STYLE}>
          <div style={PANE_HD_STYLE}>
            <span style={PANE_HD_TITLE_STYLE}>Network</span>
            <span style={PANE_HD_SUB_STYLE}>public node population</span>
          </div>

          <div
            ref={orbSlotRef}
            data-orb-slot="coldboot-console"
            style={{ position: "relative", flex: "1 1 auto", minHeight: ORB_SLOT_MIN_PX, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            {orbSlot}
          </div>

          <div style={{ fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)", color: "var(--ink-40)" }}>
            Dandelion++ · stem privately, then fluff to the world <Provenance source="model" detail="propagation paths, not observable from a node" />
          </div>

          <div style={{ display: "flex", height: 8, background: "var(--ink-10)", borderRadius: 1, overflow: "hidden" }}>
            <div style={{ width: `${clearPct}%`, background: "var(--o-50)" }} />
            <div style={{ width: `${torPct}%`, background: "var(--p-50)" }} />
            <div style={{ width: `${i2pPct}%`, background: "var(--c-50)" }} />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 12px", fontSize: "var(--fs-label)", color: "var(--ink-40)" }}>
            <span><i style={SWATCH_CLEAR} />clear</span>
            <span><i style={SWATCH_TOR} />tor</span>
            <span><i style={SWATCH_I2P} />i2p</span>
            <span style={{ color: "var(--ink-20)" }}>tor/i2p orbit — no location to place them at</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <NetRow label="Reachable nodes" value={nodeD ? nodeD.counts.reachable.toLocaleString() : "—"} />
            <NetRow label="clear / tor / i2p" value={nodeD ? `${nodeD.split.clear} / ${nodeD.split.tor} / ${nodeD.split.i2p}` : "—"} />
            <NetRow
              label="Height agreement"
              value={agreementPct != null ? `${agreementPct.toFixed(1)} %` : "—"}
            />
          </div>

          <div style={{ fontSize: "var(--fs-label)", color: "var(--ink-40)", display: "flex", flexDirection: "column", gap: 4 }}>
            <div>
              <Provenance source="network" detail="monero.fail" /> population · transports · agreement
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const SWATCH_CLEAR: React.CSSProperties = { display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "var(--o-50)", marginRight: 4 };
const SWATCH_TOR: React.CSSProperties = { display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "var(--p-50)", marginRight: 4 };
const SWATCH_I2P: React.CSSProperties = { display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "var(--c-50)", marginRight: 4 };

const NET_ROW_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 8,
  fontSize: "var(--fs-mono)",
  alignItems: "baseline",
};

function NetRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div style={NET_ROW_STYLE}>
      <span style={{ color: "var(--ink-40)" }}>{label}</span>
      <span style={{ color: value === "—" ? "var(--ink-40)" : "var(--o-60)" }}>{value}</span>
    </div>
  );
}
