// mempool/orbital.tsx — ORBITAL · the pending pool as a polar clock.
//
// The first NET-NEW view of the eleven (docs/v6-mempool-views-spec.md:135-136):
// "concentric rings by fee tier, txs orbiting at a radius set by perB and an
// angle by age, so the next block is 'everything inside this radius'. Tracked
// tx = its orbit ring lights up."
//
// WHAT IT IS, AND WHAT SEPARATES IT FROM THE OPS BRIDGE RADAR (#173 shipped
// adjacent ground in a c5 panel, so the difference is stated rather than
// assumed — all four axes differ):
//
//   • MOTION IS THE MEDIUM. Bridge's blips are STATIC positions lit by a
//     rotating sweep arm; nothing about a blip moves. Here the transactions
//     themselves orbit, and the orbit IS the datum: bearing is a pure function
//     of (age, wall clock), so a tx's position at any instant is derivable
//     from the feed. Deterministic, resumable after a hidden tab, and the
//     reduced-motion frame is simply the current ages frozen — one static
//     frame that loses no information (spec §5).
//   • RADIUS IS A FEE VALUE, not a fee RANK. Bridge ranges by quantile
//     position in the fee-sorted array (brgRankRadius), which is
//     rank-continuous and says nothing about how much a tx actually pays.
//     Orbital's radius is log(perB) against the pool's observed span, and the
//     NODE'S OWN feeTiers are drawn as concentric rings on it — so the four
//     tier BANDS are the annuli between real node values, which is what the
//     spec asked for.
//   • BEARING IS ARRIVAL PHASE. Bridge's angle is hashToUnit(txid) —
//     deliberate uniform noise, carrying nothing. Orbital's angle is
//     `age mod blockTarget`, so ONE LAP IS ONE BLOCK INTERVAL WAITED and
//     transactions that arrived together sit on the same spoke. Arrival bursts
//     read as spokes; that is an information claim bridge structurally cannot
//     make.
//   • CANVAS, not SVG. 240 orbiting elements at 60fps is a useMemCanvas job.
//
// FOUR REAL DIMENSIONS PER PARTICLE, all from the feed, none decorative:
//   radius = perB (log) · bearing = age mod blockTarget · alpha = laps
//   completed · dot area = tx size in bytes.
//
// ── decisions worth knowing before editing ────────────────────────────────
//
// THE CLOCK IS `Date.now()`, NOT `useMemCanvas`'s elapsed `t`. The hook's `t`
// is ANIMATION time: it freezes while the tab is hidden or the canvas is
// scrolled off, which is exactly right for decorative motion and exactly WRONG
// here. Bearing is derived from the transaction's real age, so a view that
// resumed from a frozen clock would draw every tx at the bearing it held when
// the tab was backgrounded — a stale reading rendered as a live one, which is
// the ALL-REAL-DATA invariant broken by an animation detail. Wall-clock makes
// the resume correct by construction: the positions are recomputed from
// `age + (now − snapshot)`, so a tab hidden for ten minutes resumes ten minutes
// further round. `t`/`dt` are deliberately unused; the hook's gating still
// stops the loop, it just no longer owns the coordinate.
//
// THE VIEW IS FLUID — `fit: false`, `reflow: true`, and it is the first hero
// surface that is neither scaled nor panned at any viewport. `.mp-view` is
// `width: max-content; min-width: 100%` on desktop (styles.css:1229), so a view
// whose content contributes no max-content settles at exactly canvasW, and with
// no `<FitView>` wrapper there is no transform to shrink type: authored 11px
// renders at 11px at 1440, 1280 AND 390. `reflow: true` takes the phone off the
// 900px pin (styles.css:2502-2516) rather than panning it.
//
// TWO MECHANISMS BUY THAT, AND BOTH WERE FOUND BY MEASUREMENT AFTER THE FIRST
// VERSION OF THIS PARAGRAPH CLAIMED THE JOB WAS ALREADY DONE:
//   • `contain: inline-size` on the root — `minmax(0, 1fr)` tracks and bounded
//     captions are NOT sufficient on their own, and this view measured
//     naturalW 2076 against a 1180 canvas before it was added. See the long
//     note at `OrbitalView`.
//   • Tabular grids live in CSS classes (`.orb-console` / `.orb-census` /
//     `.orb-sectors`, styles.css) rather than inline `gridTemplateColumns`,
//     because the reflow layer collapses every INLINE grid to one column and
//     that turned each console row into eight stacked rows — naturalH 20,651 at
//     390 before the split.
//
// The canvas is `position: absolute` inside a definite-height host
// (`.mem-canvas`, styles.css:1479): an in-flow percentage-width canvas under a
// max-content ancestor is the documented runaway (useMemCanvas.ts:115-121).
//
// Contract §8's fit budgets and its height-clause band are STRUCTURALLY
// INAPPLICABLE here rather than merely unmeasured: `useFitToView` runs only
// inside `<FitView>`, and MempoolPage:245-251 wraps only `meta.fit` views.
//
// RING LABELS ARE DOM, NOT CANVAS TEXT. Canvas glyphs are invisible to
// verify-legibility, to verify-memviews scenario 6's collision sweep, and to
// its sub-12px SVG check — three gates whose nominal subject includes this
// view. Rather than author text into a blind spot, the labels are absolutely
// positioned DOM over the canvas: real text nodes, selectable, counted by the
// density scenario, and carried by the reflow layer. The canvas draws geometry
// only.
//
// Every helper is prefixed `Orb` so it cannot collide with Reactor / Bridge /
// Terminal in the shared babel global scope.
import * as React from "react";
import { useReducedMotion } from "@/design/useReducedMotion";
import { NodeProvenance, PanelFrame } from "@/design/primitives";
import { fmtBytes, shortHash as ShortHash } from "@/data/types";
import { FEE_TIER_LABELS, feeTierIndex } from "@/data/map";
import { useMempoolTracking, MemViewShell, TrackChip, MemTxTable } from "@/mempool/mempool-shared";
import type { Tracking } from "@/mempool/mempool-shared";
import { chainTip, confOf, CONF_UNLOCK } from "@/mempool/conf";
import type { MoneroLive } from "@/data/types";
import { hasData, oldestFreshAt } from "@/data/feed-status";
import {
  ORB_TIER_COLORS, OrbStage, OrbStatic, fmtPcn, orbBearing, orbLaps, useOrbitalField,
  type OrbField,
} from "@/mempool/orbital-instruments";
import type { FeedKey } from "@/data/feed-status";

interface ViewProps {
  data: MoneroLive;
  bg?: { intensity?: "calm" | "busy" | "chaotic"; scan?: boolean };
  focusBlock?: number | null;
  onClearFocus?: () => void;
}

/** Console rows. Declared once — it is the tallest panel's height budget. */
const CONSOLE_ROWS = 14;

/* ──────────────────────────────────────────────────────────────
   PANEL — delegates to PanelFrame, never hand-rolled chrome (§1)
   ────────────────────────────────────────────────────────────── */

/**
 * Every panel in this view, so none can forget its provenance.
 *
 * Same delegation `BrgPanel` makes and for the same reason: `dataKey`,
 * `updatedAt` (worst-of `oldestFreshAt` over the endpoints this panel actually
 * reads, never `lastUpdate`) and `stale` are the three props a call site gets
 * wrong by omission, so passing `keys` once makes them unable to disagree.
 */
function OrbPanel({ data, title, keys, also, right, children, fill = true }: {
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
 *  the thing it describes. The artboard is fluid here rather than definite, so
 *  an unbounded caption cannot rescale the view (there is no wrapper to
 *  rescale) but it CAN push `.mp-view`'s max-content past `canvasW` and force a
 *  desktop pan that nothing else in the composition needs. */
const PROSE: React.CSSProperties = { maxWidth: "38ch", whiteSpace: "normal" };

const fmtDeg = (rad: number): string => {
  const d = ((rad + Math.PI / 2) * 180) / Math.PI;
  return `${Math.round(((d % 360) + 360) % 360)}°`;
};

/* ──────────────────────────────────────────────────────────────
   PANELS
   ────────────────────────────────────────────────────────────── */

/** A key/value row. Not panel chrome — a text line inside PanelFrame's body. */
function OrbRow({ k, v, tone }: { k: string; v: React.ReactNode; tone?: string }) {
  return (
    <div className="mono" style={{ display: "flex", justifyContent: "space-between", gap: "var(--sp-2)", fontSize: "var(--fs-label)", padding: "2px 0", borderBottom: "1px solid var(--line-d)" }}>
      <span style={{ color: "var(--ink-40)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{k}</span>
      <span style={{ color: tone || "var(--ink-80)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
    </div>
  );
}

/** The next-block manifest: what the cut ring encloses. SESSION, inferred. */
export function OrbManifest({ data, field }: { data: MoneroLive; field: OrbField }) {
  const ready = hasData(data.status.network);
  const dash = "—";
  const inside = field.cutIndex == null ? null : Math.min(field.cutIndex, field.pts.length);
  const fillPct = field.limit > 0 && field.cumAtCut > 0 ? (field.cumAtCut / field.limit) * 100 : null;
  const waiting = inside == null ? null : field.pts.length - inside;
  return (
    <OrbPanel data={data} title="Next-block manifest" also="session" keys={["mempool", "fees", "network"]}
      right={<span className="dim2" style={{ letterSpacing: "0.08em" }}>inside the ring</span>}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--sp-2)", marginBottom: "var(--sp-2)" }}>
        <span className="mono acc" style={{ fontSize: 20 }}>{inside != null ? inside.toLocaleString() : dash}</span>
        <span className="dim2" style={{ fontSize: "var(--fs-label)" }}>txs enclosed</span>
      </div>
      <OrbRow k="cut fee/B" v={field.cutPerB != null ? fmtPcn(field.cutPerB) : dash} tone="var(--g-50)" />
      <OrbRow k="cut radius" v={field.cutU != null ? `${Math.round(field.cutU * 100)}% in` : dash} />
      <OrbRow k="weight used" v={fillPct != null ? `${fillPct.toFixed(1)}%` : dash} />
      <OrbRow k="ceiling" v={ready && field.limit > 0 ? fmtBytes(field.limit) : dash} />
      <OrbRow k="left orbiting" v={waiting != null ? waiting.toLocaleString() : dash} />
      <OrbRow k="pool span" v={field.hi > 0 ? `${fmtPcn(field.lo)} – ${fmtPcn(field.hi)}` : dash} />
      <p className="mono dim" style={{ ...PROSE, fontSize: "var(--fs-label)", lineHeight: 1.55, marginTop: "var(--sp-3)", color: "var(--ink-40)" }}>
        Inferred, not a miner's template: this node publishes a weight ceiling,
        not a block plan. The ring is where a fee-sorted fill would stop.
      </p>
    </OrbPanel>
  );
}

/** Per-tier census — the four bands, with the node's own boundaries. */
export function OrbRingCensus({ data, field }: { data: MoneroLive; field: OrbField }) {
  const ready = hasData(data.status.network);
  const dash = "—";
  const rows = FEE_TIER_LABELS.map((label, k) => {
    const inTier = field.pts.filter((p) => p.tier === k);
    const inside = inTier.filter((p) => p.fits === true).length;
    return { label, k, n: inTier.length, inside, bound: data.feeTiers.length === 4 ? data.feeTiers[k] : null };
  });
  const total = field.pts.length;
  return (
    <OrbPanel data={data} title="Ring census · by fee tier" keys={["mempool", "fees"]}
      right={<span className="dim2" style={{ letterSpacing: "0.08em" }}>{total || dash} orbiting</span>}>
      <div className="table-scroll">
      <div className="mono orb-census" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-40)", padding: "0 0 var(--sp-1)", borderBottom: "1px solid var(--rule)" }}>
        <span>ring</span><span>floor pcn/B</span><span>txs</span><span>share</span><span>in</span>
      </div>
      {rows.map((r) => (
        <div key={r.label} className="mono orb-census" style={{ fontSize: "var(--fs-mono)", padding: "var(--sp-1) 0", borderBottom: "1px solid var(--line-d)" }}>
          <span style={{ color: ORB_TIER_COLORS[r.k], letterSpacing: "0.06em" }}>
            <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: ORB_TIER_COLORS[r.k], marginRight: "var(--sp-1)" }} />
            {r.label}
          </span>
          <span className="dim">{ready && r.bound != null ? fmtPcn(r.bound) : dash}</span>
          <span className="acc">{total ? r.n.toLocaleString() : dash}</span>
          <span className="dim2">{total ? `${Math.round((r.n / total) * 100)}%` : dash}</span>
          <span style={{ color: r.inside > 0 ? "var(--g-50)" : "var(--ink-40)" }}>{total ? r.inside.toLocaleString() : dash}</span>
        </div>
      ))}
      </div>
      <p className="mono dim" style={{ ...PROSE, fontSize: "var(--fs-label)", lineHeight: 1.55, marginTop: "var(--sp-2)", color: "var(--ink-40)" }}>
        Ring floors are the node's own <code>get_fee_estimate</code> tiers. Radius
        is log fee/byte across the observed pool, so band widths are real.
      </p>
    </OrbPanel>
  );
}

/**
 * Arrival cadence — the bearing axis made readable.
 *
 * Twelve sectors of one block target each. A burst of arrivals lands in one
 * sector, which is what a spoke on the stage IS; this panel is the same reading
 * as a count, so the visual claim is checkable.
 */
export function OrbCadence({ data, field }: { data: MoneroLive; field: OrbField }) {
  const dash = "—";
  const sectors = React.useMemo(() => {
    const buckets = Array.from({ length: 12 }, () => 0);
    const elapsed = field.snapAt > 0 ? (Date.now() - field.snapAt) / 1000 : 0;
    for (const p of field.pts) {
      const phase = ((p.age + elapsed) % field.periodSec + field.periodSec) % field.periodSec;
      buckets[Math.min(11, Math.floor((phase / field.periodSec) * 12))]++;
    }
    return buckets;
  }, [field]);
  const peak = Math.max(1, ...sectors);
  const total = field.pts.length;
  const laps = field.pts.length
    ? Math.max(...field.pts.map((p) => orbLaps(p.age, field.periodSec)))
    : null;
  // `field.periodSec` falls back to 120 so the geometry always has a divisor,
  // but 120 is NOT a reading — until /api/xmr/network answers, the node has not
  // told us its block target. Rendering the fallback as a figure is exactly the
  // fabricated-live-value the ALL-REAL-DATA invariant bans, and it is easy to
  // miss because the number is correct for mainnet. Shown only when real.
  const lapReal = hasData(data.status.network) && data.blockTarget > 0;
  const lapTxt = lapReal ? `${Math.round(field.periodSec)}s` : dash;
  return (
    <OrbPanel data={data} title="Arrival cadence · bearing" also="session" keys={["mempool", "network"]}
      right={<span className="dim2" style={{ letterSpacing: "0.08em" }}>{lapTxt} / lap</span>}>
      <div className="orb-sectors" style={{ marginBottom: "var(--sp-2)" }}>
        {sectors.map((n, i) => (
          <div key={i} title={`sector ${i * 30}°–${(i + 1) * 30}° · ${n} tx`}
            style={{ height: `${Math.max(2, (n / peak) * 100)}%`, background: "var(--o-60)", opacity: 0.25 + 0.75 * (n / peak) }} />
        ))}
      </div>
      <div className="mono dim2" style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--fs-label)", marginBottom: "var(--sp-2)" }}>
        <span>0°</span><span>90°</span><span>180°</span><span>270°</span>
      </div>
      <OrbRow k="busiest sector" v={total ? `${sectors.indexOf(peak) * 30}° · ${peak} tx` : dash} />
      <OrbRow k="lap length" v={lapTxt} />
      <OrbRow k="deepest wait" v={laps != null && total ? `${laps} lap${laps === 1 ? "" : "s"}` : dash} />
      <OrbRow k="no arrival time" v={field.total ? field.unaged.toLocaleString() : dash} tone={field.unaged > 0 ? "var(--y-50)" : undefined} />
      <OrbRow k="snapshot age" v={field.snapAt > 0 ? `${Math.max(0, Math.round((Date.now() - field.snapAt) / 1000))}s` : dash} />
    </OrbPanel>
  );
}

/**
 * The block hub — what the centre of the stage represents, plus the deep-link
 * target when one is set.
 *
 * `focusBlock`/`onClearFocus` are honoured here (spec §1 asks new views to;
 * only Classic and Reactor did). The hub is "the block that is forming", so a
 * deep-linked CONFIRMED block is shown as the hub's captured state with a
 * dismissal that clears the query.
 */
export function OrbHub({ data, field, focusBlock, onClearFocus, onPickBlock }: {
  data: MoneroLive; field: OrbField; focusBlock?: number | null;
  onClearFocus?: () => void; onPickBlock: (h: number) => void;
}) {
  const ready = hasData(data.status.network);
  const dash = "—";
  const tip = chainTip(data);
  const focused = focusBlock != null ? data.blocks.find((b) => b.height === focusBlock) : undefined;
  return (
    <OrbPanel data={data} title={focusBlock != null ? `Hub · block #${focusBlock.toLocaleString()}` : "Hub · the forming block"}
      keys={["blocks", "network"]}
      right={focusBlock != null && onClearFocus ? (
        <button type="button" onClick={onClearFocus} className="proto-btn"
          style={{ fontSize: "var(--fs-label)", padding: "1px var(--sp-2)" }}>clear</button>
      ) : null}>
      {focusBlock != null ? (
        focused ? (
          <>
            <OrbRow k="height" v={focused.height.toLocaleString()} tone="var(--y-50)" />
            <OrbRow k="confirmations" v={`${confOf(focused.height, data)}/${CONF_UNLOCK}`} />
            <OrbRow k="transactions" v={focused.txs.toLocaleString()} />
            <OrbRow k="weight" v={fmtBytes(Math.round(focused.sizeKB * 1024))} />
            <OrbRow k="reward" v={`${focused.reward.toFixed(4)} XMR`} />
            <OrbRow k="pool" v={focused.pool || dash} />
          </>
        ) : (
          <div className="mono dim" style={{ fontSize: "var(--fs-mono)", padding: "var(--sp-2) 0" }}>
            block #{focusBlock.toLocaleString()} is outside the {data.blocks.length} blocks this node returned
          </div>
        )
      ) : (
        <>
          <OrbRow k="chain tip" v={ready ? `#${tip.toLocaleString()}` : dash} tone="var(--o-60)" />
          <OrbRow k="target" v={ready ? `${Math.round(field.periodSec)}s` : dash} />
          <OrbRow k="weight ceiling" v={ready && field.limit > 0 ? fmtBytes(field.limit) : dash} />
          <OrbRow k="pool weight" v={field.pts.length ? fmtBytes(field.pts.reduce((a, p) => a + p.size, 0)) : dash} />
          <OrbRow k="alt blocks" v={ready ? data.altBlocksCount.toLocaleString() : dash} />
          <OrbRow k="hardfork" v={ready && data.hardfork ? data.hardfork : dash} />
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
    </OrbPanel>
  );
}

/** Orbit console — every particle's four coordinates, as numbers. */
export function OrbConsole({ data, field, tracking, onPickTx }: {
  data: MoneroLive; field: OrbField; tracking: Tracking; onPickTx: (id: string) => void;
}) {
  const rows = field.pts.slice(0, CONSOLE_ROWS);
  const trackedId = tracking?.kind === "tx" ? tracking.id : null;
  const elapsed = field.snapAt > 0 ? (Date.now() - field.snapAt) / 1000 : 0;
  return (
    <OrbPanel data={data} title={`Orbit console · ${rows.length} of ${field.pts.length}`} also="session"
      keys={["mempool", "fees"]}
      right={<span className="dim2" style={{ letterSpacing: "0.08em" }}>fee-sorted · innermost first</span>}>
      <div className="table-scroll">
      <div className="mono orb-console" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-40)", padding: "0 var(--sp-2) var(--sp-1)", borderBottom: "1px solid var(--rule)" }}>
        <span>rank</span><span>txid</span><span>fee/B</span><span title="orbit radius, 100% = the hub">radius</span>
        <span title="bearing: arrival phase within one block target">bearing</span><span>laps</span><span>size</span>
        <span title="inferred: inside the cut ring">in</span>
      </div>
      {rows.length === 0 ? (
        <div className="mono dim" style={{ padding: "var(--sp-3) var(--sp-2)", fontSize: "var(--fs-mono)" }}>awaiting mempool…</div>
      ) : rows.map((p) => {
        const isTracked = p.id === trackedId;
        const laps = orbLaps(p.age + elapsed, field.periodSec);
        return (
          <div key={p.id} data-tracked-tx={isTracked ? p.id : undefined}>
            <div onClick={() => onPickTx(p.id)}
              className="orb-console"
              style={{
                fontSize: "var(--fs-mono)",
                padding: "var(--sp-1) var(--sp-2)", borderBottom: "1px solid var(--line-d)",
                borderLeft: isTracked ? "2px solid var(--y-50)" : "2px solid transparent",
                background: isTracked ? "color-mix(in srgb, var(--status-warn) 7%, transparent)" : undefined,
                cursor: "pointer", fontFamily: "var(--f-mono)", alignItems: "center",
              }}>
              <span className="dim2">{String(p.rank + 1).padStart(4, "0")}</span>
              <span style={{ color: p.tier >= 0 ? ORB_TIER_COLORS[p.tier] : "var(--ink-40)", overflow: "hidden", textOverflow: "ellipsis" }}>{ShortHash(p.id)}</span>
              <span className="acc">{fmtPcn(p.perB)}</span>
              <span className="dim">{Math.round(p.u * 100)}%</span>
              <span className="dim">{fmtDeg(orbBearing(p.age + elapsed, field.periodSec))}</span>
              <span className="dim2">{laps}</span>
              <span className="dim">{fmtBytes(p.size)}</span>
              <span style={{ color: p.fits == null ? "var(--ink-40)" : p.fits ? "var(--g-50)" : "var(--ink-40)" }}>{p.fits == null ? "—" : p.fits ? "in" : "wait"}</span>
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
    </OrbPanel>
  );
}

/* ──────────────────────────────────────────────────────────────
   COMPOSITION
   ────────────────────────────────────────────────────────────── */

/** The 12-column composition: c8 stage | c4 manifest ‖ c4 census | c4 cadence
 *  | c4 hub ‖ c12 console.
 *
 *  `.orb-grid12` is a CLASS in styles.css rather than an inline style, and that
 *  is load-bearing twice over. The reflow layer collapses every INLINE
 *  `grid-template-columns` under a reflow view to `1fr`; an item still carrying
 *  `grid-column: span 8` then creates eight IMPLICIT tracks and rebuilds the
 *  desktop grid inside a 366px box — measured, the panels laid out ~122px wide
 *  and each c4 cell ran 2,523px tall, with no horizontal overflow to red a
 *  gate. Owning the class lets the phone rule collapse the tracks AND the spans
 *  together. */

function Cell({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div style={{ gridColumn: `span ${n}`, minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
      {children}
    </div>
  );
}

export function OrbOverview({ data, tracking, focusBlock, onClearFocus, onPickTx, onPickBlock }: {
  data: MoneroLive; tracking: Tracking; focusBlock?: number | null; onClearFocus?: () => void;
  onPickTx: (id: string) => void; onPickBlock: (h: number) => void;
}) {
  const field = useOrbitalField(data);
  const reduced = useReducedMotion();
  // Same rule as OrbCadence's: the 120 fallback keeps the geometry divisible,
  // it is not a reading, so the caption states the target only when the node has.
  const lapReal = hasData(data.status.network) && data.blockTarget > 0;
  const trackedId = tracking?.kind === "tx" ? tracking.id : null;
  const trackedPt = trackedId ? field.pts.find((p) => p.id === trackedId) : undefined;

  return (
    <div className="orb-grid12">
      <Cell n={8}>
        <OrbPanel data={data} title="Orbital · fee rings, age bearing" also="session" keys={["mempool", "fees"]}
          right={<span className="dim2" style={{ letterSpacing: "0.08em" }}>{field.pts.length || "—"} in orbit</span>}>
          {reduced
            ? <OrbStatic field={field} tracking={tracking} onPickTx={onPickTx} />
            : <OrbStage field={field} tracking={tracking} onPickTx={onPickTx} />}
          <div className="mono" style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-1) var(--sp-3)", fontSize: "var(--fs-label)", color: "var(--ink-40)", marginTop: "var(--sp-2)" }}>
            {FEE_TIER_LABELS.map((label, i) => (
              <span key={label}>
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: ORB_TIER_COLORS[i], marginRight: "var(--sp-1)" }} />
                {label.toUpperCase()}
              </span>
            ))}
            <span>
              <span style={{ display: "inline-block", width: 12, height: 0, borderTop: "1.4px dashed var(--g-50)", marginRight: "var(--sp-1)", verticalAlign: "middle" }} />
              CUT RING
            </span>
          </div>
          {/* §8: capped to the width of the instrument it describes. */}
          <p className="mono" style={{ ...PROSE, margin: "var(--sp-2) 0 0", fontSize: "var(--fs-label)", color: "var(--ink-40)", lineHeight: 1.55 }}>
            Radius is log fee/byte — dearest at the hub, so everything inside the
            dashed ring is the next block. Bearing is arrival phase: one lap per
            block target{lapReal ? ` (${Math.round(field.periodSec)}s)` : ""}, so a
            burst reads as a spoke and older transactions fade. The cut ring is
            inferred, not a miner's plan.
          </p>
        </OrbPanel>
      </Cell>

      <Cell n={4}>
        <OrbManifest data={data} field={field} />
        {trackedPt ? (
          <OrbPanel data={data} title="Tracked orbit" keys={["mempool"]} also="session" fill={false}>
            <OrbRow k="txid" v={ShortHash(trackedPt.id)} tone="var(--y-50)" />
            <OrbRow k="ring" v={trackedPt.tier >= 0 ? FEE_TIER_LABELS[trackedPt.tier] : "—"} />
            <OrbRow k="radius" v={`${Math.round(trackedPt.u * 100)}% in`} />
            <OrbRow k="rank" v={`${trackedPt.rank + 1} of ${field.total}`} />
            <OrbRow k="in next block" v={trackedPt.fits == null ? "—" : trackedPt.fits ? "yes" : "waiting"}
              tone={trackedPt.fits ? "var(--g-50)" : undefined} />
          </OrbPanel>
        ) : null}
      </Cell>

      <Cell n={4}><OrbRingCensus data={data} field={field} /></Cell>
      <Cell n={4}><OrbCadence data={data} field={field} /></Cell>
      <Cell n={4}>
        <OrbHub data={data} field={field} focusBlock={focusBlock} onClearFocus={onClearFocus} onPickBlock={onPickBlock} />
      </Cell>

      <Cell n={12}><OrbConsole data={data} field={field} tracking={tracking} onPickTx={onPickTx} /></Cell>
    </div>
  );
}

export function OrbitalView({ data, focusBlock, onClearFocus }: ViewProps) {
  const { tracking, onSearch, clearTracking } = useMempoolTracking(data);
  return (
    // NO fixed width, unlike reactor/bridge's ARTBOARD_W — and `contain:
    // inline-size` is what makes that safe. MEASURED, not assumed: without it
    // this view's naturalW is 2076 against a 1180 canvas at 1440, and the cause
    // is contract §8's `repeat(12, 1fr)` amplification, isolated by hiding each
    // cell in turn and re-measuring each cell's demand on a clone OUTSIDE the
    // grid (a grid item's own scrollWidth is circular):
    //
    //     cell 4 · Hub · span 4 · demand 673  ->  implies grid 12x673/4 = 2019
    //     cell 1 · Manifest    · demand 548   ->  1644
    //     cell 2 · Census      · demand 505   ->  1515
    //     hide cell 4 only: 2076 -> 1700.  hide all six: -> 1180.
    //
    // `minmax(0, 1fr)` DOES NOT PREVENT THIS, and believing it does is the trap
    // worth naming: it bounds a track's automatic MINIMUM, while the number
    // being amplified is the max-content CONTRIBUTION — a different quantity,
    // exactly as the conformance doc records for sediment. Bridge and reactor
    // are safe because their grid width is DEFINITE (`ARTBOARD_W`), so fr
    // tracks divide a known width rather than resolving from content;
    // `minmax(0, 1fr)` is the companion to that, not a substitute for it.
    //
    // `contain: inline-size` buys the same definiteness without pinning a
    // width: `.mp-view`'s `width: max-content` (styles.css:1229) asks this
    // element for a max-content contribution and inline-size containment makes
    // the answer 0, so `.mp-view` falls to its `min-width: 100%` — i.e. exactly
    // canvasW — and `width: 100%` here then divides that definite width.
    // Measured at three viewports: 1440 -> 1180, 1280 -> 1020, 390 -> 366, each
    // equal to canvasW. An engine without it degrades to the 2076 desktop pan,
    // which is a worse layout and not a broken one.
    <div className="main" style={{ overflow: "auto", padding: 0, width: "100%", contain: "inline-size", boxSizing: "border-box" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)", padding: "var(--sp-4) var(--sp-4) var(--sp-6)", boxSizing: "border-box" }}>
        <MemViewShell
          id="orbital"
          table={<MemTxTable data={data} tracking={tracking} viewId="orbital" columns={["txid", "perB", "tier", "size", "age", "inout", "ring"]} onPickTx={(id) => onSearch({ kind: "tx", id })} />}
          data={data}
          tracking={tracking}
          onSearch={onSearch}
          onClearTracking={clearTracking}
        >
          <OrbOverview
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
