// mempool/circuit.tsx — CIRCUIT · the pending pool as a PRINTED CIRCUIT BOARD.
//
// The FOURTH net-new view of the eleven and the tenth to ship
// (docs/v6-mempool-views-spec.md:140-141):
//   "the mempool as a PCB: traces carry txs from arrival to block inclusion,
//    fee tiers are parallel bus lanes. Tracked tx = its trace illuminates end
//    to end."
//
// ── WHAT IT IS: THE QUEUE, NOT THE POPULATION ─────────────────────────────
//
// The nine shipped views place each transaction by ITS OWN properties — fee and
// weight (sediment), fee and age (orbital, abyss), arrival time (pulse), a hash
// (bridge, constellation), or as text (terminal, classic). This one draws the
// ORDER: the single fee-sorted line every transaction is standing in, and how
// far down it each one is. Its coordinate is a SUM OVER OTHER TRANSACTIONS, and
// it is the only one in the suite that is.
//
// THAT DISTINCTION NEEDS STATING PRECISELY, because a loose version of it is
// false. Orbital, Abyss and Pulse all normalise a fee against the pool's own
// observed [lo, hi], so the rest of the pool does affect where a mark lands —
// but only as a SCALE. Under any renormalisation, two transactions paying the
// same rate coincide, always. Here they do not and cannot: their positions
// differ by the weight of everything between them, so the coordinate is
// cumulative rather than rescaled. That is the property, and it is the one
// worth having, because it is what makes distance-to-the-chip mean
// distance-to-inclusion.
//
// ── THE TWO AXES, AND THE SEPARATION FROM EACH ADJACENCY ──────────────────
//
// THE LANE IS A CATEGORY, NOT A COORDINATE — and this is the whole separation
// from sediment and orbital, the two views that already own a fee axis.
// Sediment encodes fee as a CONTINUOUS vertical stratum; orbital as a
// CONTINUOUS radius. A bus lane is neither. It is one of the node's own FOUR
// tiers, published by `get_fee_estimate` and classified by `feeTierIndex` —
// discrete, four-valued, and the same four the tier table in every census on
// this site already names. Within a lane, position encodes NOTHING about fee:
// the moment it did, this would be sediment with gaps.
//
// THE ALONG-TRACE AXIS IS THE JOURNEY, and no shipped view owns that quantity.
// "From arrival to block inclusion" is a PROGRESSION toward the cut, so a
// transaction's distance from the chip is its position in the fee-sorted fill:
// the cumulative weight AHEAD of it, in bytes. Approaching the chip is
// literally approaching inclusion, and the die's left edge is the cut.
// Checkable against each of the nine:
//
//   • ORBITAL's radius is `perB` — a property of ONE transaction. Two
//     transactions paying the same rate sit at one radius; their positions in
//     the fill differ by every byte between them. This axis is CUMULATIVE and
//     orbital's is not, which is why a 3 KB transaction and a 1 KB one at the
//     same fee occupy different amounts of it.
//     • SEDIMENT is the one to state precisely, because it is the only other
//     view with a WEIGHT channel and a loose claim here would be this repo's
//     own narrower-subject failure. Checked against the source rather than
//     asserted: sediment's weight is `tx.size` — a PER-TRANSACTION quantity,
//     carried as particle radius (sediment.tsx:87-88) and as one axis of its
//     grain-size scatter (:630, "fee/B × weight"); its vertical is fee/B.
//     Nothing in it is cumulative. Same unit, opposite subject — one measures
//     the transaction, the other measures its queue.
//   • PULSE's x is wall-clock time and ABYSS's y is age. Nothing on this stage
//     is derived from time at all; see the note on motion below.
//   • BRIDGE, REACTOR, CONSTELLATION, TERMINAL, CLASSIC arrange by tier, by
//     block, by graph or as text.
//
// A PACKET'S EXTENT ON THE AXIS IS ITS WEIGHT, which is the property the whole
// composition rests on: the pool TILES the axis, edge to edge, with no gaps and
// no overlaps, so occlusion between packets is STRUCTURALLY IMPOSSIBLE rather
// than managed. Every other canvas view solves density by bucketing; this one
// does not have the problem. See `cirPacketRect`.
//
// ── THE STAIRCASE IS REAL, AND IT IS THE READING ──────────────────────────
//
// `feeTierIndex` is monotone in `perB` (data/map.ts:51-54) and the fill is
// fee-sorted, so a lane's traffic occupies exactly ONE contiguous stretch of
// the axis and the four stretches tile it in order. The lanes therefore do NOT
// overlap in x — three of the four are bare copper at any given depth — and
// that is stated here rather than dressed up as a dense scatter.
//
// It is not a defect: the boundaries between those stretches are the node's own
// published tier floors expressed as a QUEUE DEPTH, which is a reading nothing
// else in this app offers. "The fastest tier ends 40 KB into the queue; the cut
// falls 293 KB in, inside the normal lane" is a sentence a viewer can take
// straight off the board. The jogs that carry the route from lane to lane are
// drawn as vias (`cirVias`), which is exactly how a PCB changes trace.
//
// ── MOTION IS HONEST, AND A PCB INVITES THE DISHONEST KIND ────────────────
//
// A packet gliding smoothly down its lane between polls would be ASSERTING
// positions the feed never reported. That is interpolation, and on a live
// surface interpolation is fabrication. So EVERY PACKET IS STILL between polls:
// its x is a pure function of the snapshot, and it steps when the feed steps.
//
// The only thing that moves is a DIRECTION CURRENT — a dash offset running
// along each lane's centre line — and it carries no data reading. That is said
// on the face of the view, not only here.
//
// AND THE CLOCK IS `useMemCanvas`'s ELAPSED `t`, NOT `Date.now()` — the one
// place this view deliberately inverts orbital's, abyss's and pulse's choice.
// All three of those derive a COORDINATE from wall-clock (a bearing, a depth, a
// position on a time axis), so a frozen animation clock would resume drawing a
// stale reading as a live one. Nothing here is derived from time: the axis is
// weight. The elapsed clock is therefore correct, and a tab hidden for ten
// minutes resumes with the current where it left off — which is the right
// behaviour for the one thing on the stage that means nothing.
//
// THE VIEW IS FLUID — `fit: false`, `reflow: true`, orbital's mechanism
// verbatim and abyss's and pulse's re-use of it: `contain: inline-size` on the
// root plus tabular grids as `.cir-*` CSS CLASSES rather than inline
// `gridTemplateColumns` (the ≤768 reflow layer collapses every INLINE grid to
// one column while an item still carrying `grid-column: span 8` rebuilds the
// desktop grid out of implicit tracks). A board is the composition fluid width
// was made for — there is no authored artboard to preserve, only more or less
// queue on screen.
//
// AXIS AND LANE LABELS ARE DOM, NOT CANVAS TEXT. See the note in
// circuit-instruments.tsx.
//
// Every helper is prefixed `Cir` so it cannot collide with Reactor / Bridge /
// Terminal / Orbital / Abyss / Pulse in the shared babel global scope.
import * as React from "react";
import { useReducedMotion } from "@/design/useReducedMotion";
import { NodeProvenance, PanelFrame } from "@/design/primitives";
import { fmtBytes, shortHash as ShortHash } from "@/data/types";
import { FEE_TIER_LABELS } from "@/data/map";
import { useMempoolTracking, MemViewShell, TrackChip, MemTxTable } from "@/mempool/mempool-shared";
import type { Tracking } from "@/mempool/mempool-shared";
import { chainTip, confOf, CONF_UNLOCK } from "@/mempool/conf";
import { useMemStats, fmtMMSS } from "@/mempool/mem-stats";
import type { MoneroLive } from "@/data/types";
import { hasData, oldestFreshAt } from "@/data/feed-status";
import type { FeedKey } from "@/data/feed-status";
import {
  CIR_TIER_COLORS, CIR_LANES, CirStage, CirStatic, fmtPcn, useCircuitField, cirVias, type CirField,
} from "@/mempool/circuit-instruments";

interface ViewProps {
  data: MoneroLive;
  bg?: { intensity?: "calm" | "busy" | "chaotic"; scan?: boolean };
  focusBlock?: number | null;
  onClearFocus?: () => void;
}

/** Console rows. Declared once — it is the tallest panel's height budget. */
const CONSOLE_ROWS = 14;

/** Rows the fill schedule shows before folding the rest into one line. Six
 *  ceilings is twelve minutes of chain at the mainnet target, which is as far
 *  ahead as a fee-sorted inference is worth reading. */
const SCHEDULE_BLOCKS = 6;

/* ──────────────────────────────────────────────────────────────
   PANEL — delegates to PanelFrame, never hand-rolled chrome (§1)
   ────────────────────────────────────────────────────────────── */

/**
 * Every panel in this view, so none can forget its provenance.
 *
 * Same delegation `OrbPanel`, `BrgPanel`, `AbyPanel` and `PlsPanel` make, for
 * the same reason: `dataKey`, `updatedAt` (worst-of `oldestFreshAt` over the
 * endpoints this panel actually reads, never `lastUpdate`) and `stale` are the
 * three props a call site gets wrong by omission, so passing `keys` once makes
 * them unable to disagree.
 */
function CirPanel({ data, title, keys, also, right, children, fill = true }: {
  data: MoneroLive;
  title: React.ReactNode;
  keys: readonly [FeedKey, ...FeedKey[]];
  also?: "session";
  right?: React.ReactNode;
  children: React.ReactNode;
  fill?: boolean;
}) {
  return (
    <PanelFrame
      style={fill ? { flex: "1 1 auto" } : undefined}
      title={title}
      dataKey={keys[0]}
      updatedAt={oldestFreshAt(data.status, keys)}
      stale={keys.some((k) => data.status[k].phase === "stale")}
      right={<>{right}<NodeProvenance source="node" also={also} keys={keys} status={data.status} /></>}
    >
      {children}
    </PanelFrame>
  );
}

/** Prose bound. §8's rule stated literally — cap every caption to the width of
 *  the thing it describes. The artboard is fluid rather than definite, so an
 *  unbounded caption cannot rescale the view (there is no wrapper to rescale)
 *  but it CAN push `.mp-view`'s max-content past `canvasW` and force a desktop
 *  pan nothing else in the composition needs. */
const PROSE: React.CSSProperties = { maxWidth: "38ch", whiteSpace: "normal" };

const dash = "—";

/** A key/value row. Not panel chrome — a text line inside PanelFrame's body. */
function CirRow({ k, v, tone }: { k: string; v: React.ReactNode; tone?: string }) {
  return (
    <div className="mono" style={{ display: "flex", justifyContent: "space-between", gap: "var(--sp-2)", fontSize: "var(--fs-label)", padding: "2px 0", borderBottom: "1px solid var(--line-d)" }}>
      <span style={{ color: "var(--ink-40)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{k}</span>
      <span style={{ color: tone || "var(--ink-80)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
    </div>
  );
}

/**
 * The board's key.
 *
 * The lane is a CATEGORY, so the colour is a lookup and not a ramp — which is
 * exactly why it needs a legend and why that legend is a row of four named
 * swatches rather than `AbyRamp`'s continuous strip. It also has to say what
 * the current is, because a moving thing that carries no reading is the one
 * element on this stage a viewer would otherwise be right to interrogate.
 */
function CirKey({ field }: { field: CirField }) {
  return (
    <div>
      <div className="cir-ramp mono">
        {FEE_TIER_LABELS.map((label, i) => (
          <span key={label} style={{ color: CIR_TIER_COLORS[i], letterSpacing: "0.06em" }}>
            <span style={{ display: "inline-block", width: 9, height: 5, background: CIR_TIER_COLORS[i], marginRight: "var(--sp-1)", verticalAlign: "middle" }} />
            {label}
            <span style={{ color: "var(--ink-40)" }}> · {field.lanes[i].n > 0 ? field.lanes[i].n.toLocaleString() : dash}</span>
          </span>
        ))}
      </div>
      <div className="mono" style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-3)", fontSize: "var(--fs-label)", color: "var(--ink-40)", marginTop: "var(--sp-1)", letterSpacing: "0.06em" }}>
        <span style={{ color: "var(--g-50)" }}>— — the cut · the die's edge</span>
        <span>packet width = its weight</span>
        <span>· · · current is decoration, not a reading</span>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   PANELS
   ────────────────────────────────────────────────────────────── */

/** The die — what the package encloses, as numbers. */
export function CirDie({ data, field, etaSec }: { data: MoneroLive; field: CirField; etaSec: number }) {
  const ready = hasData(data.status.network);
  const inside = field.cutIndex == null ? null : Math.min(field.cutIndex, field.txs.length);
  const fillPct = field.limit > 0 && field.cumAtCut > 0 ? (field.cumAtCut / field.limit) * 100 : null;
  const waiting = inside == null ? null : field.txs.length - inside;
  // PASSED IN, not re-derived. `nextBlockEtaSec` reads `Date.now()` inside its
  // own memo, so a second `useMemStats` call here would capture a different
  // instant from the one CirOverview captured — two numbers that are the same
  // formula and not the same reading. Abyss's and Pulse's parameter discipline,
  // applied to the one strip figure this view displays rather than plots.
  const overdue = etaSec < 0;
  return (
    // TITLE AND QUALIFIER BOTH KEPT SHORT AFTER LOOKING AT THE RENDER — p2·8's
    // and p2·9's lesson, third time. "The die · next block" plus "at the pins"
    // wrapped this c4 header to THREE lines at 1440, where the provenance badge
    // is at its widest ("NODE · UNAVAILABLE"). No gate sees a wrapped panel
    // header (§8's caption rule is about the body, not the chrome) and the wrap
    // itself is pre-existing shared PanelFrame behaviour; only the length was
    // mine.
    <CirPanel data={data} title="The die" also="session" keys={["mempool", "fees", "network"]}
      right={<span className="dim2" style={{ letterSpacing: "0.08em" }}>next block</span>}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--sp-2)", marginBottom: "var(--sp-2)" }}>
        <span className="mono acc" style={{ fontSize: 20 }}>{inside != null ? inside.toLocaleString() : dash}</span>
        <span className="dim2" style={{ fontSize: "var(--fs-label)" }}>packets on the die</span>
      </div>
      {/* The ETA is the strip's own number — not a second countdown. `BlockEta`
          already owns the ticking readout in the strip above; two clocks a
          second apart is exactly the defect p2·7's gate caught elsewhere. */}
      <CirRow k="due in" v={ready ? (overdue ? `+${fmtMMSS(-etaSec)} overdue` : fmtMMSS(etaSec)) : dash}
        tone={overdue ? "var(--y-50)" : "var(--p-50)"} />
      <CirRow k="cut at" v={field.limit > 0 ? `${fmtBytes(field.limit)} deep` : dash} tone="var(--g-50)" />
      <CirRow k="cut fee/B" v={field.cutPerB != null ? fmtPcn(field.cutPerB) : dash} tone="var(--g-50)" />
      <CirRow k="package filled" v={fillPct != null ? `${fillPct.toFixed(1)}%` : dash} />
      <CirRow k="still on the traces" v={waiting != null ? waiting.toLocaleString() : dash} />
      <CirRow k="demand" v={field.blocksDeep > 0 ? `${field.blocksDeep.toFixed(2)} blocks` : dash}
        tone={field.blocksDeep > 1 ? "var(--y-50)" : undefined} />
      <p className="mono dim" style={{ ...PROSE, fontSize: "var(--fs-label)", lineHeight: 1.55, marginTop: "var(--sp-3)", color: "var(--ink-40)" }}>
        Inferred, not a miner's template: this node publishes a weight ceiling,
        not a block plan. The die's edge is where a fee-sorted fill would stop.
        {field.dieFull ? " Everything pending fits under the ceiling, so the package spans the whole board." : ""}
      </p>
    </CirPanel>
  );
}

/**
 * The bus-lane census — the four lanes as counts, and their extents as queue
 * depths.
 *
 * `from`/`to` are what make the staircase checkable: they are the stretch of
 * the axis each lane occupies, so "the fastest tier ends 40 KB in" is a number
 * here and a via on the stage, derived once in `useCircuitField` and read
 * twice.
 */
export function CirLanes({ data, field }: { data: MoneroLive; field: CirField }) {
  const ready = hasData(data.status.network);
  const total = field.txs.length;
  return (
    <CirPanel data={data} title="Bus lanes" also="session" keys={["mempool", "fees"]}
      right={<span className="dim2" style={{ letterSpacing: "0.08em" }}>by node tier</span>}>
      <div className="table-scroll">
        <div className="mono cir-census" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-40)", padding: "0 0 var(--sp-1)", borderBottom: "1px solid var(--rule)" }}>
          <span>lane</span><span>floor pcn/B</span><span>txs</span>
          <span title="the stretch of queue this lane occupies, in weight ahead">extent</span>
          <span>on die</span>
        </div>
        {field.lanes.map((lane) => (
          <div key={lane.tier} className="mono cir-census" style={{ fontSize: "var(--fs-mono)", padding: "var(--sp-1) 0", borderBottom: "1px solid var(--line-d)" }}>
            <span style={{ color: CIR_TIER_COLORS[lane.tier], letterSpacing: "0.06em" }}>
              <span style={{ display: "inline-block", width: 9, height: 5, background: CIR_TIER_COLORS[lane.tier], marginRight: "var(--sp-1)", verticalAlign: "middle" }} />
              {FEE_TIER_LABELS[lane.tier]}
            </span>
            <span className="dim">{ready && lane.floor != null ? fmtPcn(lane.floor) : dash}</span>
            <span className="acc">{total ? lane.n.toLocaleString() : dash}</span>
            <span className="dim2">{lane.n ? `${fmtBytes(lane.from)} → ${fmtBytes(lane.to)}` : dash}</span>
            <span style={{ color: lane.lit > 0 ? "var(--g-50)" : "var(--ink-40)" }}>{total ? lane.lit.toLocaleString() : dash}</span>
          </div>
        ))}
      </div>
      <CirRow k="vias" v={total ? cirVias(field).length.toLocaleString() : dash} />
      <p className="mono dim" style={{ ...PROSE, fontSize: "var(--fs-label)", lineHeight: 1.55, marginTop: "var(--sp-2)", color: "var(--ink-40)" }}>
        A lane is one of the node's four <code>get_fee_estimate</code> tiers, not
        a fee position — nothing inside a lane encodes fee. Because the tiers are
        ordered and the fill is fee-sorted, each lane occupies one unbroken
        stretch of the queue and the vias mark the boundaries.
      </p>
    </CirPanel>
  );
}

/**
 * The depth axis — what the along-trace coordinate is, in the units it is drawn
 * in.
 *
 * This panel exists because the axis is a CUMULATIVE quantity, which is the one
 * thing about this view a reader is most likely to mis-take for a per-tx one.
 * Naming the domain rung, the pool's own weight and the deepest occupied point
 * side by side is what makes "the board holds the pool" checkable rather than
 * asserted.
 */
export function CirDepth({ data, field }: { data: MoneroLive; field: CirField }) {
  const ready = hasData(data.status.network);
  const deepest = field.txs.length ? field.txs[field.txs.length - 1] : null;
  /* THE FILL SCHEDULE — the depth axis quantised by the node's own ceiling.
     The die is one ceiling wide, so the queue behind it is the second block,
     the third, and so on: a transaction at 640 KB of depth against a 300 KB
     ceiling is third in line. This is the same walk the board draws, read at a
     different granularity, and it is the one place the abstract "1.86 blocks of
     demand" becomes a row a reader can point at.

     Capped at SCHEDULE_BLOCKS and the remainder folded into a final row, so a
     40-block backlog is six rows plus "and 34 more", not forty. A cap that
     silently truncated would be the "no silent caps" failure this repo
     records. Inferred, fee-sorted, and it inherits the die's caveat exactly:
     nothing here is a miner's plan. */
  const schedule = React.useMemo(() => {
    if (!(field.limit > 0) || !field.txs.length) return [];
    const out: { k: number; n: number; bytes: number; cheapest: number | null }[] = [];
    for (const p of field.txs) {
      const k = Math.floor(p.ahead / field.limit);
      const row = out[k] || (out[k] = { k, n: 0, bytes: 0, cheapest: null });
      row.n++;
      row.bytes += p.size;
      row.cheapest = p.perB;          // fee-sorted, so the last one wins
    }
    return out.filter(Boolean);
  }, [field]);
  const shown = schedule.slice(0, SCHEDULE_BLOCKS);
  const rest = schedule.slice(SCHEDULE_BLOCKS);
  return (
    <CirPanel data={data} title="Queue depth" keys={["mempool", "network"]}
      right={<span className="dim2" style={{ letterSpacing: "0.08em" }}>weight ahead</span>}>
      <CirRow k="board spans" v={field.domain > 0 ? fmtBytes(field.domain) : dash} tone="var(--o-60)" />
      <CirRow k="pool weight" v={field.poolBytes > 0 ? fmtBytes(field.poolBytes) : dash} />
      <CirRow k="deepest packet" v={deepest ? fmtBytes(deepest.ahead + deepest.size) : dash} />
      <CirRow k="board used" v={field.domain > 0 && field.poolBytes > 0 ? `${((field.poolBytes / field.domain) * 100).toFixed(1)}%` : dash} />
      {/* Never silently dropped. The domain is a rung chosen to hold the pool,
          so this is 0 in the ordinary case and non-zero only at the ladder's top
          rung — the outlier case the clamp exists for, and the case a reader
          most needs told about. */}
      <CirRow k="past the board" v={field.txs.length ? fmtBytes(field.offBoard) : dash}
        tone={field.offBoard > 0 ? "var(--y-50)" : undefined} />
      <CirRow k="ceiling" v={ready && field.limit > 0 ? fmtBytes(field.limit) : dash} />
      <div className="table-scroll" style={{ marginTop: "var(--sp-3)" }}>
        <div className="mono cir-census" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-40)", padding: "0 0 var(--sp-1)", borderBottom: "1px solid var(--rule)" }}>
          <span title="inferred: how many ceilings deep this stretch of queue is">block</span>
          <span>txs</span><span>weight</span><span>fills</span><span>floor pcn/B</span>
        </div>
        {shown.length === 0 ? (
          <div className="mono dim" style={{ padding: "var(--sp-2) 0", fontSize: "var(--fs-mono)" }}>{dash}</div>
        ) : shown.map((r) => (
          <div key={r.k} className="mono cir-census" style={{ fontSize: "var(--fs-mono)", padding: "var(--sp-1) 0", borderBottom: "1px solid var(--line-d)" }}>
            <span style={{ color: r.k === 0 ? "var(--g-50)" : "var(--ink-60)" }}>{r.k === 0 ? "next" : `+${r.k}`}</span>
            <span className="acc">{r.n.toLocaleString()}</span>
            <span className="dim">{fmtBytes(r.bytes)}</span>
            <span className="dim2">{((r.bytes / field.limit) * 100).toFixed(0)}%</span>
            <span className="dim2">{r.cheapest != null ? fmtPcn(r.cheapest) : dash}</span>
          </div>
        ))}
        {rest.length ? (
          <div className="mono dim" style={{ padding: "var(--sp-1) 0", fontSize: "var(--fs-label)", color: "var(--ink-40)" }}>
            and {rest.length.toLocaleString()} more block{rest.length === 1 ? "" : "s"} of queue behind these,
            carrying {rest.reduce((a, r) => a + r.n, 0).toLocaleString()} txs
          </div>
        ) : null}
      </div>
      <p className="mono dim" style={{ ...PROSE, fontSize: "var(--fs-label)", lineHeight: 1.55, marginTop: "var(--sp-2)", color: "var(--ink-40)" }}>
        A packet sits at the total weight of everything paying more than it, and
        its width on the board is its own weight — so the pool tiles the axis
        exactly and two packets can never overlap. The schedule quantises that
        depth by the node's ceiling; it is inferred the same way the cut is.
      </p>
    </CirPanel>
  );
}

/**
 * The board's context — chain tip, and the deep-link target when one is set.
 *
 * `focusBlock`/`onClearFocus` are honoured here (spec §1 asks new views to;
 * Classic, Reactor, Orbital, Abyss and Pulse did).
 */
export function CirBoard({ data, field, focusBlock, onClearFocus, onPickBlock }: {
  data: MoneroLive; field: CirField; focusBlock?: number | null;
  onClearFocus?: () => void; onPickBlock: (h: number) => void;
}) {
  const ready = hasData(data.status.network);
  const tip = chainTip(data);
  const focused = focusBlock != null ? data.blocks.find((b) => b.height === focusBlock) : undefined;
  return (
    <CirPanel data={data} title={focusBlock != null ? `Board · #${focusBlock.toLocaleString()}` : "Board"}
      keys={["blocks", "network"]}
      right={focusBlock != null && onClearFocus ? (
        <button type="button" onClick={onClearFocus} className="proto-btn"
          style={{ fontSize: "var(--fs-label)", padding: "1px var(--sp-2)" }}>clear</button>
      ) : null}>
      {focusBlock != null ? (
        focused ? (
          <>
            <CirRow k="height" v={focused.height.toLocaleString()} tone="var(--y-50)" />
            <CirRow k="confirmations" v={`${confOf(focused.height, data)}/${CONF_UNLOCK}`} />
            <CirRow k="transactions" v={focused.txs.toLocaleString()} />
            <CirRow k="weight" v={fmtBytes(Math.round(focused.sizeKB * 1024))} />
            <CirRow k="reward" v={`${focused.reward.toFixed(4)} XMR`} />
            <CirRow k="pool" v={focused.pool || dash} />
          </>
        ) : (
          <div className="mono dim" style={{ fontSize: "var(--fs-mono)", padding: "var(--sp-2) 0" }}>
            block #{focusBlock.toLocaleString()} is outside the {data.blocks.length} blocks this node returned
          </div>
        )
      ) : (
        <>
          <CirRow k="chain tip" v={ready ? `#${tip.toLocaleString()}` : dash} tone="var(--o-60)" />
          <CirRow k="block target" v={ready && data.blockTarget ? fmtMMSS(data.blockTarget) : dash} />
          <CirRow k="pending" v={field.txs.length ? field.txs.length.toLocaleString() : dash} />
          <CirRow k="alt blocks" v={ready ? data.altBlocksCount.toLocaleString() : dash} />
          <CirRow k="daemon" v={data.version || dash} />
          <CirRow k="nettype" v={data.nettype || dash} />
        </>
      )}
      <div className="mono" style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-1)", marginTop: "var(--sp-3)" }}>
        {data.blocks.slice(0, 8).map((b) => (
          <button key={b.hash + b.height} type="button" onClick={() => onPickBlock(b.height)}
            style={{
              appearance: "none", cursor: "pointer", fontFamily: "var(--f-mono)",
              fontSize: "var(--fs-label)", padding: "1px var(--sp-2)",
              background: b.height === focusBlock ? "color-mix(in srgb, var(--status-warn) 12%, transparent)" : "transparent",
              border: "1px solid " + (b.height === focusBlock ? "var(--y-50)" : "var(--ink-20)"),
              borderRadius: 2, color: b.height === focusBlock ? "var(--y-50)" : "var(--ink-60)",
            }}>
            {b.height.toLocaleString()}
          </button>
        ))}
      </div>
    </CirPanel>
  );
}

/** Fill console — the queue in the order the board draws it. Sorted by RANK,
 *  not by age: this is the queue view, and its console is the running order. */
export function CirConsole({ data, field, tracking, onPickTx }: {
  data: MoneroLive; field: CirField; tracking: Tracking; onPickTx: (id: string) => void;
}) {
  const rows = React.useMemo(() => field.txs.slice(0, CONSOLE_ROWS), [field]);
  const trackedId = tracking?.kind === "tx" ? tracking.id : null;
  return (
    <CirPanel data={data} title={`Fill console · ${rows.length} of ${field.txs.length}`} also="session"
      keys={["mempool", "fees"]}
      right={<span className="dim2" style={{ letterSpacing: "0.08em" }}>fee-sorted, chip first</span>}>
      <div className="table-scroll">
        <div className="mono cir-console" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-40)", padding: "0 var(--sp-2) var(--sp-1)", borderBottom: "1px solid var(--rule)" }}>
          <span title="position in the fee-sorted fill">rank</span>
          <span>txid</span><span>fee/B</span><span>lane</span>
          <span title="cumulative weight ahead of it — its distance from the chip">ahead</span>
          <span>size</span>
          <span title="inferred: inside the die">cut</span>
        </div>
        {rows.length === 0 ? (
          <div className="mono dim" style={{ padding: "var(--sp-3) var(--sp-2)", fontSize: "var(--fs-mono)" }}>awaiting mempool…</div>
        ) : rows.map((p) => {
          const isTracked = p.id === trackedId;
          return (
            <div key={p.id} data-tracked-tx={isTracked ? p.id : undefined}>
              <div onClick={() => onPickTx(p.id)}
                className="cir-console"
                style={{
                  fontSize: "var(--fs-mono)",
                  padding: "var(--sp-1) var(--sp-2)", borderBottom: "1px solid var(--line-d)",
                  borderLeft: isTracked ? "2px solid var(--y-50)" : "2px solid transparent",
                  background: isTracked ? "color-mix(in srgb, var(--status-warn) 7%, transparent)" : undefined,
                  cursor: "pointer", fontFamily: "var(--f-mono)", alignItems: "center",
                }}>
                <span className="dim2">{p.rank + 1}</span>
                <span style={{ color: CIR_TIER_COLORS[p.tier >= 0 ? Math.min(CIR_LANES - 1, p.tier) : 0], overflow: "hidden", textOverflow: "ellipsis" }}>{ShortHash(p.id)}</span>
                <span className="acc">{fmtPcn(p.perB)}</span>
                <span className="dim">{p.tier >= 0 ? FEE_TIER_LABELS[p.tier] : dash}</span>
                <span className="dim2">{fmtBytes(p.ahead)}</span>
                <span className="dim">{fmtBytes(p.size)}</span>
                <span style={{ color: p.fits == null ? "var(--ink-40)" : p.fits ? "var(--g-50)" : "var(--ink-40)" }}>{p.fits == null ? dash : p.fits ? "in" : "out"}</span>
              </div>
              {isTracked ? (
                <div style={{ padding: "2px var(--sp-2) var(--sp-1)", borderLeft: "2px solid var(--y-50)" }}>
                  <TrackChip tracking={tracking} data={data} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </CirPanel>
  );
}

/* ──────────────────────────────────────────────────────────────
   COMPOSITION
   ────────────────────────────────────────────────────────────── */

/** The 12-column composition: c8 stage | c4 die ‖ c4 lanes | c4 depth
 *  | c4 board ‖ c12 console.
 *
 *  `.cir-grid12` is a CLASS in styles.css rather than an inline style, and that
 *  is load-bearing twice over — the reflow layer collapses every INLINE
 *  `grid-template-columns` under a reflow view to `1fr`, and an item still
 *  carrying `grid-column: span 8` then creates eight IMPLICIT tracks and
 *  rebuilds the desktop grid inside a 366px box. Owning the class lets the
 *  phone rule collapse the tracks AND the spans together. Measured on orbital
 *  before its split: ~122px-wide panels, each c4 cell 2,523px tall, and no
 *  horizontal overflow to red a gate. */
function Cell({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div style={{ gridColumn: `span ${n}`, minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
      {children}
    </div>
  );
}

export function CirOverview({ data, tracking, focusBlock, onClearFocus, onPickTx, onPickBlock }: {
  data: MoneroLive; tracking: Tracking; focusBlock?: number | null; onClearFocus?: () => void;
  onPickTx: (id: string) => void; onPickBlock: (h: number) => void;
}) {
  // The strip's own derivation, read here so the ONE axis is anchored on the
  // number the strip publishes rather than on a second implementation of it.
  // See useCircuitField's docblock.
  const stats = useMemStats(data);
  const field = useCircuitField(data, stats.poolBytes);
  const reduced = useReducedMotion();
  const trackedId = tracking?.kind === "tx" ? tracking.id : null;
  const trackedP = trackedId ? field.txs.find((p) => p.id === trackedId) : undefined;

  return (
    <div className="cir-grid12">
      <Cell n={8}>
        <CirPanel data={data} title="Circuit · the fee-sorted fill" also="session" keys={["mempool", "fees"]}
          right={<span className="dim2" style={{ letterSpacing: "0.08em" }}>{field.txs.length || dash} pending · board {fmtBytes(field.domain)}</span>}>
          {reduced
            ? <CirStatic field={field} tracking={tracking} onPickTx={onPickTx} />
            : <CirStage field={field} tracking={tracking} onPickTx={onPickTx} />}
          <div style={{ marginTop: "var(--sp-2)" }}><CirKey field={field} /></div>
          {/* §8: capped to the width of the instrument it describes. */}
          <p className="mono" style={{ ...PROSE, margin: "var(--sp-2) 0 0", fontSize: "var(--fs-label)", color: "var(--ink-40)", lineHeight: 1.55 }}>
            Four bus lanes, one per node fee tier. A packet's distance from the
            chip is the weight paying more than it, so moving right is moving
            toward inclusion, and its width is its own weight. Positions step
            when the feed does — the running dashes are decoration and carry no
            reading.
            {trackedP ? " The tracked transaction's lane is lit from the arrival pad to the pin." : ""}
          </p>
        </CirPanel>
      </Cell>

      <Cell n={4}>
        <CirDie data={data} field={field} etaSec={stats.nextBlockEtaSec} />
        {trackedP ? (
          <CirPanel data={data} title="Tracked packet" keys={["mempool"]} also="session" fill={false}>
            <CirRow k="txid" v={ShortHash(trackedP.id)} tone="var(--y-50)" />
            <CirRow k="lane" v={trackedP.tier >= 0 ? FEE_TIER_LABELS[trackedP.tier] : dash} />
            <CirRow k="fee/B" v={fmtPcn(trackedP.perB)} />
            <CirRow k="weight ahead" v={fmtBytes(trackedP.ahead)} />
            <CirRow k="rank" v={`${trackedP.rank + 1} of ${field.txs.length}`} />
            <CirRow k="on the die" v={trackedP.fits == null ? dash : trackedP.fits ? "yes" : "waiting"}
              tone={trackedP.fits ? "var(--g-50)" : undefined} />
          </CirPanel>
        ) : null}
      </Cell>

      <Cell n={4}><CirLanes data={data} field={field} /></Cell>
      <Cell n={4}><CirDepth data={data} field={field} /></Cell>
      <Cell n={4}>
        <CirBoard data={data} field={field} focusBlock={focusBlock} onClearFocus={onClearFocus} onPickBlock={onPickBlock} />
      </Cell>

      <Cell n={12}><CirConsole data={data} field={field} tracking={tracking} onPickTx={onPickTx} /></Cell>
    </div>
  );
}

export function CircuitView({ data, focusBlock, onClearFocus }: ViewProps) {
  const { tracking, onSearch, clearTracking } = useMempoolTracking(data);
  return (
    // NO fixed width, and `contain: inline-size` is what makes that safe —
    // orbital's mechanism, reused rather than re-derived, exactly as abyss and
    // pulse reused it. Its header carries the measurement that established it
    // (naturalW 2076 against a 1180 canvas until containment was added, and why
    // `minmax(0, 1fr)` is not a substitute: it bounds a track's automatic
    // MINIMUM while the amplified quantity is the max-content CONTRIBUTION).
    // This view's own six-cell measurement is in the PR body; the mechanism is
    // identical because the composition is the same `repeat(12, 1fr)` shape.
    <div className="main" style={{ overflow: "auto", padding: 0, width: "100%", contain: "inline-size", boxSizing: "border-box" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)", padding: "var(--sp-4) var(--sp-4) var(--sp-6)", boxSizing: "border-box" }}>
        <MemViewShell
          id="circuit"
          table={<MemTxTable data={data} tracking={tracking} viewId="circuit" columns={["txid", "perB", "tier", "size", "inout", "age"]} onPickTx={(id) => onSearch({ kind: "tx", id })} />}
          data={data}
          tracking={tracking}
          onSearch={onSearch}
          onClearTracking={clearTracking}
        >
          <CirOverview
            data={data}
            tracking={tracking}
            focusBlock={focusBlock}
            onClearFocus={onClearFocus}
            onPickTx={(id) => onSearch({ kind: "tx", id, blockHeight: null })}
            onPickBlock={(h) => onSearch({ kind: "block", height: h })}
          />
        </MemViewShell>
      </div>
    </div>
  );
}
