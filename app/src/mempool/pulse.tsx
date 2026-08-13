// mempool/pulse.tsx — PULSE · the pending pool in the TIME DOMAIN.
//
// The THIRD net-new view of the eleven (docs/v6-mempool-views-spec.md:144-146):
// "a time-domain view: a rolling waveform of arrivals per second with fee
// amplitude, so bursts read as spikes. Closest in spirit to the existing
// session-series charts, and the one that most needs MemStatStrip's oldest-age
// and ETA numbers."
//
// ── WHAT IT IS: THE FLOW, NOT THE STOCK ───────────────────────────────────
//
// Every one of the eight shipped views draws the POOL — the stock, its current
// contents, arranged by some pair of axes. Pulse draws the FLOW: how fast
// transactions are arriving, over real time. The stock is the integral of what
// this view plots, which is why it can be adjacent to all eight and identical
// to none.
//
// TIME IS THE HORIZONTAL AXIS, and it is the first real one in the suite. That
// is the differentiation, stated rather than hoped, and it is checkable against
// each of the eight:
//
//   • REACTOR is radial and ORBITAL is polar. Orbital is the near miss and the
//     separation is sharp: its age is a BEARING — cyclic, with no origin and no
//     direction, so "later" is not a direction you can point in. Here time is
//     LINEAR and DIRECTED. It has a past, a present, and — uniquely in this app
//     — a FUTURE: the segment to the right of `now`, ending at the instant the
//     next block is due. Orbital structurally cannot have one.
//   • ABYSS is the other near miss, and the inversion is exact. Abyss puts AGE
//     on the vertical axis (log depth) and takes fee OUT of geometry into a
//     brightness channel. Pulse puts TIME on the horizontal axis and puts fee
//     BACK into geometry as a vertical amplitude. Same two quantities, both
//     axes swapped, and fee positional in one and not the other.
//   • BRIDGE and ABYSS both hash their horizontal axis away and say so. This
//     one is the view where the horizontal axis carries the most it ever
//     carries: the reading the whole picture is about.
//   • SEDIMENT shares the vertical quantity — fee — and that is worth stating
//     plainly rather than claiming a clean inversion against all eight. The
//     separation is two-fold. Sediment's x is WEIGHT, not time; and sediment's
//     fee is a STRATUM — a position, where a transaction IS — while here it is
//     an AMPLITUDE, a distance from the axis. Two arrivals at the same
//     amplitude are the same fee; two at the same stratum are the same fee too,
//     but the stratum is a place in a column and the amplitude is a magnitude
//     hanging off a timeline.
//   • TERMINAL and CLASSIC are text.
//
// ── THE HONESTY DECISION: WHERE THE HISTORY COMES FROM ────────────────────
//
// A "rolling waveform of arrivals" needs a history, and there are exactly two
// places to get one. This view takes the FIRST, deliberately:
//
//   TAKEN — THE POOL'S OWN AGE DISTRIBUTION. Every pending transaction's `age`
//   IS its arrival time, so a single snapshot yields the entire arrivals series
//   instantly, from the node, with nothing accumulated and nothing waited for.
//   Provenance: NODE (the panels carry `<NodeProvenance source="node">`; only
//   the inferred next-block cut is additionally marked `session`, as it is in
//   every other view that draws one).
//
//   THE CAVEAT, AND IT IS ON THE FACE OF THE VIEW, NOT ONLY HERE: this series
//   is SURVIVOR-BIASED. Transactions that arrived and were then mined or
//   dropped are gone from the pool, so they are gone from the history too, and
//   the older end of the window under-counts what really arrived. What the
//   waveform plots is therefore "arrivals STILL PENDING", not "arrivals", and
//   the stage caption says exactly that. The decay toward the left is not a
//   data gap — it is the mining process, drawn.
//
//   NOT TAKEN — A SESSION-OBSERVED LOG. `data/useFeedEvents.ts` is the
//   precedent and it would be honestly SESSION-provenanced, but it is empty at
//   load and grows rightward, so a first-time visitor gets a blank instrument
//   for minutes; and its own `TX_EVENTS_PER_TICK` cap (useFeedEvents.ts:26,
//   which is 8 — the 40 on the line below it is the ring buffer's total size,
//   a different quantity) clips each poll to eight arrivals so a burst "stays
//   readable". Inheriting that cap silently would flatten exactly the signal a
//   burst view exists to show, and deriving an uncapped count would still leave
//   the empty-at-load problem. A full-width waveform fabricated at t=0 was
//   never an option (ALL-REAL-DATA; the em-dash rule).
//
// ── THE TWO NAMED DEPENDENCIES ARE STRUCTURAL, NOT DECORATIVE ─────────────
//
// The spec calls this the view that most needs `oldest` and `eta`. Both arrive
// as PARAMETERS to `usePulseField`, the discipline `useAbyssField(data,
// oldestAgeSec)` established, so contract §3 is satisfied BY CONSTRUCTION
// rather than by two implementations agreeing:
//
//   • `oldest` CHOOSES THE WINDOW. The visible span of past is the smallest
//     rung of a block-target ladder that holds the pool's oldest pending
//     transaction (see PLS_WINDOW_STEPS). So the window is as wide as the pool
//     really is, and no wider.
//   • `eta` IS THE FUTURE EDGE. The axis runs out to the instant the next block
//     is due, and the marker there sweeps toward the present in real time — the
//     fastest-moving thing on the stage, and the one reading a time axis makes
//     available that no other view in the app can show. When the tip goes
//     overdue the marker is REMOVED rather than parked on the present:
//     `nextBlockEtaSec` deliberately goes negative because block arrival is
//     Poisson (mem-stats.tsx:67), and a marker sitting on `now` would assert a
//     block is arriving now for as long as the wait lasts. The panel reports
//     "+N overdue" instead, which stays true.
//
// ── decisions worth knowing before editing ────────────────────────────────
//
// THE COMPOSITION IS TWO TRACES HINGED ON ONE TIME AXIS, and each half answers
// one half of the spec's sentence:
//   ABOVE — the arrival RATE. One equal segment per arrival, stacked per bin,
//   so a column's height is exactly its arrival count and the axis ticks are
//   honest integers. This is the half that makes "bursts read as spikes" true.
//   Its colour composition is the fee mix, so a tall cyan column and a tall gold
//   one are the same number of transactions and a very different event.
//   BELOW — the fee AMPLITUDE, one mark per arrival at its own log fee/byte.
//   Per-transaction, never aggregated, and it is where the inferred next-block
//   cut becomes a horizontal threshold the marks visibly cross.
// An earlier composition put fee amplitude on per-transaction strokes ALONE and
// was discarded on the spec's own sentence: a burst of cheap transactions is
// then a dense band of SHORT strokes, which reads as a smudge and not a spike.
// Weighting the height by fee was discarded too, and measured rather than
// guessed: on the gate fixture one dear transaction carries ~180× a cheap one's
// fee, so a single whale would out-spike a thirty-transaction burst and the
// spec's sentence would be false in the other direction.
//
// THE CLOCK IS `Date.now()`, NOT `useMemCanvas`'s elapsed `t` — orbital's and
// abyss's argument, unchanged and load-bearing twice here, because BOTH axes
// are wall-clock: the window rolls and the ETA counts down. A view resuming
// from a frozen animation clock would draw a waveform parked where the tab was
// backgrounded and a block still 90 seconds away that was due five minutes ago.
//
// THE VIEW IS FLUID — `fit: false`, `reflow: true`, orbital's mechanism
// verbatim and abyss's re-use of it: `contain: inline-size` on the root plus
// tabular grids as `.pls-*` CSS CLASSES rather than inline `gridTemplateColumns`
// (the ≤768 reflow layer collapses every INLINE grid to one column while an item
// still carrying `grid-column: span 8` rebuilds the desktop grid out of implicit
// tracks). A waveform is the composition fluid width was made for — there is no
// authored artboard to preserve, only more or less time on screen.
//
// AXIS LABELS ARE DOM, NOT CANVAS TEXT, on all three axes. See the note in
// pulse-instruments.tsx.
//
// Every helper is prefixed `Pls` so it cannot collide with Reactor / Bridge /
// Terminal / Orbital / Abyss in the shared babel global scope.
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
  PLS_TIER_COLORS, PlsStage, PlsStatic, fmtPcn, fmtSpan, usePulseField, type PlsField,
} from "@/mempool/pulse-instruments";

interface ViewProps {
  data: MoneroLive;
  bg?: { intensity?: "calm" | "busy" | "chaotic"; scan?: boolean };
  focusBlock?: number | null;
  onClearFocus?: () => void;
}

/** Console rows. Declared once — it is the tallest panel's height budget. */
const CONSOLE_ROWS = 14;

/** Cadence bands. The window is split into this many equal spans for the
 *  census, so a row there is a real, nameable slice of the axis rather than a
 *  bin (bins are px-sized and there can be a hundred of them). */
const CADENCE_BANDS = 6;

/** Fallback inner width, in CSS px, used for the FIRST render only — before
 *  either stage has measured its own box. It is a bin-sizing input, not a
 *  layout value: nothing is positioned with it, and the stage overwrites it on
 *  its first effect. Chosen at the 1440 desktop's real inner width so the
 *  common case never re-bins on mount. */
const INNER_W_SEED = 1092;

/* ──────────────────────────────────────────────────────────────
   PANEL — delegates to PanelFrame, never hand-rolled chrome (§1)
   ────────────────────────────────────────────────────────────── */

/**
 * Every panel in this view, so none can forget its provenance.
 *
 * Same delegation `OrbPanel`, `BrgPanel` and `AbyPanel` make, for the same
 * reason: `dataKey`, `updatedAt` (worst-of `oldestFreshAt` over the endpoints
 * this panel actually reads, never `lastUpdate`) and `stale` are the three props
 * a call site gets wrong by omission, so passing `keys` once makes them unable
 * to disagree.
 */
function PlsPanel({ data, title, keys, also, right, children, fill = true }: {
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
function PlsRow({ k, v, tone }: { k: string; v: React.ReactNode; tone?: string }) {
  return (
    <div className="mono" style={{ display: "flex", justifyContent: "space-between", gap: "var(--sp-2)", fontSize: "var(--fs-label)", padding: "2px 0", borderBottom: "1px solid var(--line-d)" }}>
      <span style={{ color: "var(--ink-40)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{k}</span>
      <span style={{ color: tone || "var(--ink-80)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
    </div>
  );
}

/**
 * The stage's key.
 *
 * Both traces are tier-coloured and the halves carry DIFFERENT quantities, so
 * neither is self-describing from its geometry alone — a non-positional
 * encoding needs a legend the way an ordinary chart needs an axis. `AbyRamp` is
 * the precedent; this one has more to say, because it has to name the two
 * halves as well as the colours.
 */
function PlsKey({ field }: { field: PlsField }) {
  return (
    <div>
      <div className="pls-key mono">
        <span style={{ color: "var(--ink-40)", letterSpacing: "0.08em", textTransform: "uppercase" }}>above · arrivals</span>
        <span style={{ color: "var(--ink-40)", letterSpacing: "0.08em", textTransform: "uppercase" }}>below · fee/B</span>
      </div>
      <div className="pls-ramp">
        {PLS_TIER_COLORS.map((c, i) => (
          <div key={i} title={`${FEE_TIER_LABELS[i]} tier`} style={{ background: c, opacity: 0.55 + (i / 3) * 0.45 }} />
        ))}
      </div>
      <div className="mono pls-key" style={{ marginTop: "var(--sp-1)" }}>
        <span style={{ color: "var(--ink-40)" }}>{FEE_TIER_LABELS[0]} · {field.lo > 0 ? `${fmtPcn(field.lo)} pcn/B` : dash}</span>
        <span style={{ color: "var(--ink-40)", textAlign: "right" }}>{field.hi > 0 ? `${fmtPcn(field.hi)} pcn/B` : dash} · {FEE_TIER_LABELS[3]}</span>
      </div>
      <div className="mono" style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-3)", fontSize: "var(--fs-label)", color: "var(--ink-40)", marginTop: "2px", letterSpacing: "0.06em" }}>
        <span style={{ color: "var(--g-50)" }}>— — next-block cut</span>
        <span style={{ color: "var(--p-50)" }}>· · block due</span>
        <span>bins of {fmtSpan(field.binSec)}</span>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   PANELS
   ────────────────────────────────────────────────────────────── */

/** The next-block manifest — what the cut threshold encloses, plus the countdown
 *  that owns the future half of the axis. */
export function PlsNextBlock({ data, field }: { data: MoneroLive; field: PlsField }) {
  const ready = hasData(data.status.network);
  const inside = field.cutIndex == null ? null : Math.min(field.cutIndex, field.txs.length);
  const fillPct = field.limit > 0 && field.cumAtCut > 0 ? (field.cumAtCut / field.limit) * 100 : null;
  const waiting = inside == null ? null : field.txs.length - inside;
  const overdue = field.etaSec < 0;
  return (
    // TITLE AND QUALIFIER BOTH KEPT SHORT AFTER LOOKING AT THE RENDER, which is
    // the same lesson p2·8 recorded one PR earlier: "the cut, and the clock"
    // wrapped this c4 panel's header to FOUR lines in the degraded state, where
    // the provenance badge is at its widest ("NODE · UNAVAILABLE"). No gate sees
    // a wrapped panel header — §8's caption rule is about the body, not the
    // chrome — and the shared PanelFrame wrap is pre-existing, so the only part
    // that was mine to fix is the length.
    <PlsPanel data={data} title="Next block" also="session" keys={["mempool", "fees", "network"]}
      right={<span className="dim2" style={{ letterSpacing: "0.08em" }}>cut · clock</span>}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--sp-2)", marginBottom: "var(--sp-2)" }}>
        <span className="mono acc" style={{ fontSize: 20 }}>{inside != null ? inside.toLocaleString() : dash}</span>
        <span className="dim2" style={{ fontSize: "var(--fs-label)" }}>txs past the cut</span>
      </div>
      {/* The ETA is the strip's own number, passed in — not a second countdown.
          Rendered as text rather than as a live tick because `BlockEta` already
          owns the ticking readout in the strip above; two clocks a second apart
          is exactly the defect p2·7's gate caught elsewhere. */}
      <PlsRow k="due in" v={ready ? (overdue ? `+${fmtMMSS(-field.etaSec)} overdue` : fmtMMSS(field.etaSec)) : dash}
        tone={overdue ? "var(--y-50)" : "var(--p-50)"} />
      <PlsRow k="block target" v={ready ? fmtMMSS(field.blockTargetSec) : dash} />
      <PlsRow k="cut fee/B" v={field.cutPerB != null ? fmtPcn(field.cutPerB) : dash} tone="var(--g-50)" />
      <PlsRow k="weight used" v={fillPct != null ? `${fillPct.toFixed(1)}%` : dash} />
      <PlsRow k="ceiling" v={ready && field.limit > 0 ? fmtBytes(field.limit) : dash} />
      <PlsRow k="still waiting" v={waiting != null ? waiting.toLocaleString() : dash} />
      <p className="mono dim" style={{ ...PROSE, fontSize: "var(--fs-label)", lineHeight: 1.55, marginTop: "var(--sp-3)", color: "var(--ink-40)" }}>
        Inferred, not a miner's template: this node publishes a weight ceiling,
        not a block plan. The threshold is where a fee-sorted fill would stop.
        Running past the target is ordinary — arrivals are Poisson.
      </p>
    </PlsPanel>
  );
}

/**
 * Cadence census — the arrival rate made readable as counts.
 *
 * The bands are equal slices of the SAME window the stage draws, so a row here
 * is exactly a span of the axis. That is what makes the visual claim checkable:
 * "the pool has been quiet for the last two minutes" is a reading a viewer takes
 * off the picture, and this panel is the same reading as a number.
 */
export function PlsCadence({ data, field }: { data: MoneroLive; field: PlsField }) {
  const bands = React.useMemo(() => {
    const span = field.windowSec / CADENCE_BANDS;
    const out: { from: number; to: number; label: string; n: number; lit: number }[] = [];
    for (let i = CADENCE_BANDS - 1; i >= 0; i--) {
      const from = i * span;              // seconds ago, older edge
      const to = (i + 1) * span;
      // THE OLDEST BAND IS CLOSED AT ITS OUTER EDGE, and it has to be. The
      // window is a rung >= the pool's oldest, so a transaction can land exactly
      // on the outer boundary; a half-open [from, to) would drop it and the
      // census would not sum to the in-window pool. A census that does not sum
      // to its own subject is quietly wrong, and nothing here would have shown
      // it.
      const last = i === CADENCE_BANDS - 1;
      const inBand = field.txs.filter((a) => a.age >= from && (last ? a.age <= to : a.age < to));
      out.push({
        from, to,
        label: `${fmtSpan(from)} – ${fmtSpan(to)}`,
        n: inBand.length,
        lit: inBand.filter((a) => a.fits === true).length,
      });
    }
    return out;
  }, [field]);
  // Parity, rendered rather than assumed: the bands partition the window, so
  // counted + offWindow is the pool or the panel is lying about its subject.
  const counted = bands.reduce((a, b) => a + b.n, 0);
  const total = field.txs.length;
  const peak = Math.max(1, ...bands.map((b) => b.n));
  const bandSec = field.windowSec / CADENCE_BANDS;
  return (
    <PlsPanel data={data} title="Cadence" also="session" keys={["mempool"]}
      right={<span className="dim2" style={{ letterSpacing: "0.08em" }}>by time band</span>}>
      <div className="table-scroll">
        <div className="mono pls-census" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-40)", padding: "0 0 var(--sp-1)", borderBottom: "1px solid var(--rule)" }}>
          <span>band</span><span>rate</span><span>txs</span><span>per min</span><span>past cut</span>
        </div>
        {bands.map((b) => (
          <div key={`${b.from}-${b.to}`} className="mono pls-census" style={{ fontSize: "var(--fs-mono)", padding: "var(--sp-1) 0", borderBottom: "1px solid var(--line-d)" }}>
            <span className="dim">{b.label}</span>
            <span aria-hidden="true" style={{ display: "block", height: 6, background: "var(--b-50)", opacity: 0.2 + 0.8 * (b.n / peak), width: `${Math.max(4, (b.n / peak) * 100)}%` }} />
            <span className="acc">{total ? b.n.toLocaleString() : dash}</span>
            <span className="dim2">{total && bandSec > 0 ? (b.n / (bandSec / 60)).toFixed(1) : dash}</span>
            <span style={{ color: b.lit > 0 ? "var(--g-50)" : "var(--ink-40)" }}>{total ? b.lit.toLocaleString() : dash}</span>
          </div>
        ))}
      </div>
      <PlsRow k="peak bin" v={field.peakN > 0 ? `${field.peakN} in ${fmtSpan(field.binSec)}` : dash} />
      <PlsRow k="in window" v={total ? `${counted.toLocaleString()} of ${total.toLocaleString()}` : dash}
        tone={counted + field.offWindow === total ? undefined : "var(--y-50)"} />
      <p className="mono dim" style={{ ...PROSE, fontSize: "var(--fs-label)", lineHeight: 1.55, marginTop: "var(--sp-2)", color: "var(--ink-40)" }}>
        Rates count transactions STILL PENDING, so the older bands under-count
        what really arrived — anything mined or dropped has left the pool and
        left this history with it. The fall-off is the mining process, not a gap.
      </p>
    </PlsPanel>
  );
}

/** Fee census — the amplitude axis as counts, against the node's own tiers.
 *  Contract §4's tier table applies here and on the stage, which is unusual:
 *  most views keep tier colour off the field. Here both traces are tier-coloured
 *  because the tier IS the stage's fee legend. */
export function PlsFeeCensus({ data, field }: { data: MoneroLive; field: PlsField }) {
  const ready = hasData(data.status.network);
  const rows = FEE_TIER_LABELS.map((label, k) => {
    const inTier = field.txs.filter((a) => a.tier === k);
    const lit = inTier.filter((a) => a.fits === true).length;
    const newest = inTier.length ? Math.min(...inTier.map((a) => a.age)) : null;
    return { label, k, n: inTier.length, lit, newest, bound: data.feeTiers.length === 4 ? data.feeTiers[k] : null };
  });
  const total = field.txs.length;
  return (
    <PlsPanel data={data} title="Fee census" keys={["mempool", "fees"]}
      right={<span className="dim2" style={{ letterSpacing: "0.08em" }}>by tier</span>}>
      <div className="table-scroll">
        <div className="mono pls-census" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-40)", padding: "0 0 var(--sp-1)", borderBottom: "1px solid var(--rule)" }}>
          <span>tier</span><span>floor pcn/B</span><span>txs</span><span>newest</span><span>past cut</span>
        </div>
        {rows.map((r) => (
          <div key={r.label} className="mono pls-census" style={{ fontSize: "var(--fs-mono)", padding: "var(--sp-1) 0", borderBottom: "1px solid var(--line-d)" }}>
            <span style={{ color: PLS_TIER_COLORS[r.k], letterSpacing: "0.06em" }}>
              <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: PLS_TIER_COLORS[r.k], marginRight: "var(--sp-1)" }} />
              {r.label}
            </span>
            <span className="dim">{ready && r.bound != null ? fmtPcn(r.bound) : dash}</span>
            <span className="acc">{total ? r.n.toLocaleString() : dash}</span>
            <span className="dim2">{r.newest != null ? fmtSpan(r.newest) : dash}</span>
            <span style={{ color: r.lit > 0 ? "var(--g-50)" : "var(--ink-40)" }}>{total ? r.lit.toLocaleString() : dash}</span>
          </div>
        ))}
      </div>
      <p className="mono dim" style={{ ...PROSE, fontSize: "var(--fs-label)", lineHeight: 1.55, marginTop: "var(--sp-2)", color: "var(--ink-40)" }}>
        Tier floors are the node's own <code>get_fee_estimate</code> values, and
        they are drawn on the stage as reference lines. Amplitude itself is log
        fee/byte across the observed pool, so a tier spans whatever it spans.
      </p>
    </PlsPanel>
  );
}

/**
 * The time base — what the axis is, and the deep-link target when one is set.
 *
 * `focusBlock`/`onClearFocus` are honoured here (spec §1 asks new views to; only
 * Classic, Reactor, Orbital and Abyss did).
 */
export function PlsWindow({ data, field, focusBlock, onClearFocus, onPickBlock }: {
  data: MoneroLive; field: PlsField; focusBlock?: number | null;
  onClearFocus?: () => void; onPickBlock: (h: number) => void;
}) {
  const ready = hasData(data.status.network);
  const tip = chainTip(data);
  const focused = focusBlock != null ? data.blocks.find((b) => b.height === focusBlock) : undefined;
  return (
    <PlsPanel data={data} title={focusBlock != null ? `Time base · block #${focusBlock.toLocaleString()}` : "Time base · what the axis is"}
      keys={["blocks", "network"]}
      right={focusBlock != null && onClearFocus ? (
        <button type="button" onClick={onClearFocus} className="proto-btn"
          style={{ fontSize: "var(--fs-label)", padding: "1px var(--sp-2)" }}>clear</button>
      ) : null}>
      {focusBlock != null ? (
        focused ? (
          <>
            <PlsRow k="height" v={focused.height.toLocaleString()} tone="var(--y-50)" />
            <PlsRow k="confirmations" v={`${confOf(focused.height, data)}/${CONF_UNLOCK}`} />
            <PlsRow k="transactions" v={focused.txs.toLocaleString()} />
            <PlsRow k="weight" v={fmtBytes(Math.round(focused.sizeKB * 1024))} />
            <PlsRow k="reward" v={`${focused.reward.toFixed(4)} XMR`} />
            <PlsRow k="pool" v={focused.pool || dash} />
          </>
        ) : (
          <div className="mono dim" style={{ fontSize: "var(--fs-mono)", padding: "var(--sp-2) 0" }}>
            block #{focusBlock.toLocaleString()} is outside the {data.blocks.length} blocks this node returned
          </div>
        )
      ) : (
        <>
          <PlsRow k="window" v={field.windowSec > 0 ? `${fmtSpan(field.windowSec)} of past` : dash} tone="var(--o-60)" />
          <PlsRow k="bin" v={fmtSpan(field.binSec)} />
          <PlsRow k="pool reaches back" v={field.oldestAgeSec > 0 ? fmtSpan(field.oldestAgeSec) : dash} />
          {/* Never silently dropped. The window is a rung chosen to hold the
              pool, so this is 0 in the ordinary case and non-zero only at the
              ladder's top rung — which is exactly the outlier case the clamp
              exists for, and the case a reader most needs told about. */}
          <PlsRow k="older than window" v={field.txs.length ? field.offWindow.toLocaleString() : dash}
            tone={field.offWindow > 0 ? "var(--y-50)" : undefined} />
          <PlsRow k="chain tip" v={ready ? `#${tip.toLocaleString()}` : dash} tone="var(--o-60)" />
          <PlsRow k="alt blocks" v={ready ? data.altBlocksCount.toLocaleString() : dash} />
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
    </PlsPanel>
  );
}

/** Arrivals console — the newest arrivals, as numbers. Sorted by ARRIVAL, not
 *  by fee: this is the time-domain view, and its console is a tape. */
export function PlsConsole({ data, field, tracking, onPickTx }: {
  data: MoneroLive; field: PlsField; tracking: Tracking; onPickTx: (id: string) => void;
}) {
  const rows = React.useMemo(
    () => [...field.txs].sort((a, b) => a.age - b.age).slice(0, CONSOLE_ROWS),
    [field],
  );
  const trackedId = tracking?.kind === "tx" ? tracking.id : null;
  return (
    <PlsPanel data={data} title={`Arrivals console · ${rows.length} of ${field.txs.length}`} also="session"
      keys={["mempool", "fees"]}
      right={<span className="dim2" style={{ letterSpacing: "0.08em" }}>newest first</span>}>
      <div className="table-scroll">
        <div className="mono pls-console" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-40)", padding: "0 var(--sp-2) var(--sp-1)", borderBottom: "1px solid var(--rule)" }}>
          <span>arrived</span><span>txid</span><span>fee/B</span><span>tier</span>
          <span title="rank in the fee-sorted order the cut walks">rank</span>
          <span>size</span>
          <span title="inferred: past the next-block threshold">cut</span>
        </div>
        {rows.length === 0 ? (
          <div className="mono dim" style={{ padding: "var(--sp-3) var(--sp-2)", fontSize: "var(--fs-mono)" }}>awaiting mempool…</div>
        ) : rows.map((a) => {
          const isTracked = a.id === trackedId;
          return (
            <div key={a.id} data-tracked-tx={isTracked ? a.id : undefined}>
              <div onClick={() => onPickTx(a.id)}
                className="pls-console"
                style={{
                  fontSize: "var(--fs-mono)",
                  padding: "var(--sp-1) var(--sp-2)", borderBottom: "1px solid var(--line-d)",
                  borderLeft: isTracked ? "2px solid var(--y-50)" : "2px solid transparent",
                  background: isTracked ? "color-mix(in srgb, var(--status-warn) 7%, transparent)" : undefined,
                  cursor: "pointer", fontFamily: "var(--f-mono)", alignItems: "center",
                }}>
                <span className="dim2">−{fmtSpan(a.age)}</span>
                <span style={{ color: PLS_TIER_COLORS[a.tier >= 0 ? a.tier : 0], overflow: "hidden", textOverflow: "ellipsis" }}>{ShortHash(a.id)}</span>
                <span className="acc">{fmtPcn(a.perB)}</span>
                <span className="dim">{a.tier >= 0 ? FEE_TIER_LABELS[a.tier] : dash}</span>
                <span className="dim2">{a.rank + 1}</span>
                <span className="dim">{fmtBytes(a.size)}</span>
                <span style={{ color: a.fits == null ? "var(--ink-40)" : a.fits ? "var(--g-50)" : "var(--ink-40)" }}>{a.fits == null ? dash : a.fits ? "in" : "out"}</span>
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
    </PlsPanel>
  );
}

/* ──────────────────────────────────────────────────────────────
   COMPOSITION
   ────────────────────────────────────────────────────────────── */

/** The 12-column composition: c8 stage | c4 next block ‖ c4 cadence | c4 fee
 *  | c4 time base ‖ c12 console.
 *
 *  `.pls-grid12` is a CLASS in styles.css rather than an inline style, and that
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

export function PlsOverview({ data, tracking, focusBlock, onClearFocus, onPickTx, onPickBlock }: {
  data: MoneroLive; tracking: Tracking; focusBlock?: number | null; onClearFocus?: () => void;
  onPickTx: (id: string) => void; onPickBlock: (h: number) => void;
}) {
  // The strip's own derivation, read here so BOTH axes are anchored on the
  // numbers the strip publishes rather than on second implementations of them.
  // See usePulseField's docblock.
  const stats = useMemStats(data);

  /* THE BIN WIDTH IS A FUNCTION OF THE MEASURED BOX, so the derivation needs it
     and the stage is the only thing that knows it. It is reported UPWARD rather
     than measured a second time: two measurements of one box is exactly the
     class of duplication contract §3 exists to prevent, and a second
     ResizeObserver on a different element would disagree at every breakpoint.
     The setter bails on an unchanged value, so the stage's effect cannot drive
     a render loop — React skips the update when the state is identical. */
  const [innerW, setInnerW] = React.useState(INNER_W_SEED);
  const onMeasure = React.useCallback((n: number) => {
    setInnerW((prev) => (prev === n ? prev : n));
  }, []);

  const field = usePulseField(data, stats.oldestAgeSec, stats.nextBlockEtaSec, innerW);
  const reduced = useReducedMotion();
  const trackedId = tracking?.kind === "tx" ? tracking.id : null;
  const trackedA = trackedId ? field.txs.find((a) => a.id === trackedId) : undefined;

  return (
    <div className="pls-grid12">
      <Cell n={8}>
        <PlsPanel data={data} title="Pulse · arrivals over real time" also="session" keys={["mempool", "fees"]}
          right={<span className="dim2" style={{ letterSpacing: "0.08em" }}>{field.txs.length || dash} pending · window {fmtSpan(field.windowSec)}</span>}>
          {reduced
            ? <PlsStatic field={field} tracking={tracking} onPickTx={onPickTx} onMeasure={onMeasure} />
            : <PlsStage field={field} tracking={tracking} onPickTx={onPickTx} onMeasure={onMeasure} />}
          <div style={{ marginTop: "var(--sp-2)" }}><PlsKey field={field} /></div>
          {/* §8: capped to the width of the instrument it describes. THE
              SURVIVOR-BIAS SENTENCE IS NOT OPTIONAL — see this file's header.
              The face has to say what it shows. */}
          <p className="mono" style={{ ...PROSE, margin: "var(--sp-2) 0 0", fontSize: "var(--fs-label)", color: "var(--ink-40)", lineHeight: 1.55 }}>
            Above the axis, one mark per arrival stacked by the second it landed
            — a burst is a tall column. Below it, the same arrivals at their own
            fee rate; the next block is everything past the dashed floor. These
            are arrivals <em>still pending</em>: anything already mined has left
            the pool and left this history, so the older end under-counts.
            {trackedA ? " The tracked transaction holds a cursor at the instant it arrived, and the cursor rolls with the window." : ""}
          </p>
        </PlsPanel>
      </Cell>

      <Cell n={4}>
        <PlsNextBlock data={data} field={field} />
        {trackedA ? (
          <PlsPanel data={data} title="Tracked arrival" keys={["mempool"]} also="session" fill={false}>
            <PlsRow k="txid" v={ShortHash(trackedA.id)} tone="var(--y-50)" />
            <PlsRow k="arrived" v={`${fmtSpan(trackedA.age)} ago`} />
            <PlsRow k="fee/B" v={fmtPcn(trackedA.perB)} />
            <PlsRow k="tier" v={trackedA.tier >= 0 ? FEE_TIER_LABELS[trackedA.tier] : dash} />
            <PlsRow k="rank" v={`${trackedA.rank + 1} of ${field.txs.length}`} />
            <PlsRow k="past the cut" v={trackedA.fits == null ? dash : trackedA.fits ? "yes" : "waiting"}
              tone={trackedA.fits ? "var(--g-50)" : undefined} />
          </PlsPanel>
        ) : null}
      </Cell>

      <Cell n={4}><PlsCadence data={data} field={field} /></Cell>
      <Cell n={4}><PlsFeeCensus data={data} field={field} /></Cell>
      <Cell n={4}>
        <PlsWindow data={data} field={field} focusBlock={focusBlock} onClearFocus={onClearFocus} onPickBlock={onPickBlock} />
      </Cell>

      <Cell n={12}><PlsConsole data={data} field={field} tracking={tracking} onPickTx={onPickTx} /></Cell>
    </div>
  );
}

export function PulseView({ data, focusBlock, onClearFocus }: ViewProps) {
  const { tracking, onSearch, clearTracking } = useMempoolTracking(data);
  return (
    // NO fixed width, and `contain: inline-size` is what makes that safe —
    // orbital's mechanism, reused rather than re-derived, exactly as abyss
    // reused it. Its header carries the measurement that established it
    // (naturalW 2076 against a 1180 canvas until containment was added, and why
    // `minmax(0, 1fr)` is not a substitute: it bounds a track's automatic
    // MINIMUM while the amplified quantity is the max-content CONTRIBUTION).
    // This view's own six-cell measurement is in the PR body; the mechanism is
    // identical because the composition is the same `repeat(12, 1fr)` shape.
    <div className="main" style={{ overflow: "auto", padding: 0, width: "100%", contain: "inline-size", boxSizing: "border-box" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)", padding: "var(--sp-4) var(--sp-4) var(--sp-6)", boxSizing: "border-box" }}>
        <MemViewShell
          id="pulse"
          table={<MemTxTable data={data} tracking={tracking} viewId="pulse" columns={["txid", "age", "perB", "tier", "size", "inout"]} onPickTx={(id) => onSearch({ kind: "tx", id })} />}
          data={data}
          tracking={tracking}
          onSearch={onSearch}
          onClearTracking={clearTracking}
        >
          <PlsOverview
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
