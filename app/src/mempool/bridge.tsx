// mempool/bridge.tsx — OPERATIONS BRIDGE · hi-fi mission control.
//
// "Bloomberg-meets-NASA." A flight deck of live instruments: a PPI radar
// sweeping the live mempool by FEE RATE, a bank of flat gauges over real node
// health, a fee/byte oscilloscope, a block-cadence clock with real interval
// statistics, an alert tape, pool attribution and a fee-sorted transaction
// console — every number comes from the live MoneroLive feed. Chain figures
// gate on hasData(data.status.network), market figures on
// hasData(data.status.market).
//
// v2 REBUILD (claude/V2-VIEW-CONFORMANCE.md Rev 4, and this task's brief):
//
//   • THE ARTBOARD IS DEFINITE. naturalW was 2517 against a 1180 canvas, so
//     FitView scaled the view by 0.4688 and authored 11px painted at 5.16px.
//     MEASURED CAUSE: hiding each composition row moved naturalW only for the
//     pool-attribution row (2517 → 1360), whose unbounded §6 disclosure prose
//     demanded 1174px of max-content — read on a clone OUTSIDE the grid, since
//     a grid item's own scrollWidth is circular. Its `1fr 1.1fr` tracks then
//     amplified that: 1174 + 1174×1.1 + 12 gap + 40 padding = 2517.4. Second
//     order, once that row is gone: the gauge bank demanded 638 and the
//     `1.05fr 1fr` hero amplified it to 1360 the same way. Both are contract
//     §8's `max-content` grid amplification. The fix is REACTOR'S — one
//     explicit ARTBOARD_W plus `minmax(0, 1fr)` tracks, so no cell's
//     max-content contribution can size a track. Captions keep width bounds
//     anyway: the artboard protects the width, not the reader.
//   • RADAR RANGE IS FEE, not age, and carries the whole pool rather than
//     `slice(0, 60)`. Angle stays `hashToUnit(txid)` — never Math.random.
//   • THE OSCILLOSCOPE'S Y AXIS IS THE OBSERVED RANGE. It was a histogram over
//     [0, max×1.05], which crushes every sample into the first few percent as
//     soon as one tx pays 60× the median.
//   • THE NEXT-BLOCK CUT IS DERIVED ONCE (`useNextBlockCut`) and read by three
//     surfaces: the radar's cut ring, the scope's cut line, the console's CUT
//     column. SESSION-computed and labelled inferred (§6) — a miner's real
//     template is unobservable from here.
//   • PanelFrame everywhere. `BrgCard` is gone: the same violation `SedCard`
//     and `ConCard` were, typed `any` and unable to carry `dataKey` /
//     `updatedAt`, so no panel could report its own endpoint's freshness.
//
// Every helper is prefixed `Brg` so it can't collide with Reactor / Terminal /
// monero-pages in the shared babel global scope.
import * as React from "react";
import { Link } from "react-router-dom";
import { useTick } from "@/design/ArtBackground";
import { useReducedMotion } from "@/design/useReducedMotion";
import { observeDrawable } from "@/design/usePageActive";
import { NodeProvenance, PanelFrame } from "@/design/primitives";
import { AXIS, GRID, ChartCrosshair, ChartTip, useGradientId, useSvgCursor, VB_W } from "@/design/chart-kit";
import { useChartMetrics, spreadLabels, tickCount } from "@/design/useChartMetrics";
import { fmtBytes, shortHash as ShortHash } from "@/data/types";
import { hashToUnit, FEE_TIER_LABELS, feeTierIndex } from "@/data/map";
import { useFeedEvents } from "@/data/useFeedEvents";
import { useMempoolTracking, MemViewShell, TrackChip, MemTxTable } from "@/mempool/mempool-shared";
import type { Tracking } from "@/mempool/mempool-shared";
import { confOf, CONF_UNLOCK } from "@/mempool/conf";
import type { MoneroLive, Tx } from "@/data/types";
import { freshAt, hasData, lastOkAt, oldestFreshAt } from "@/data/feed-status";
import type { FeedKey } from "@/data/feed-status";
import { R } from "../../scripts/routes.mjs";
import {
  BrgGauge, BrgRadar, RADAR_PX, TIER_COLORS, fmtFeeK, type BrgCut,
} from "@/mempool/bridge-instruments";

interface ViewProps {
  data: MoneroLive;
  bg?: { intensity?: "calm" | "busy" | "chaotic"; scan?: boolean };
}

/* ──────────────────────────────────────────────────────────────
   ARTBOARD — a DEFINITE width, independent of the feed
   ────────────────────────────────────────────────────────────── */

/** Equals `canvasW` (`.mp-canvas-scroll`'s clientWidth) at the 1440 reference
 *  viewport, which is what `useFitToView.ts:52` divides by. Same constant and
 *  same reason as `reactor.tsx`'s ARTBOARD_W: fixing naturalW here is what
 *  takes bridge off the scaling path entirely. */
const ARTBOARD_W = 1180;

/** The 12-column composition every panel places itself on: c5 c7 | c7 c5 |
 *  c8 c4. Each conceptual row sums to 12, so auto-flow tiles them with no
 *  per-row wrapper. `minmax(0, 1fr)` is load-bearing exactly as it is in
 *  reactor: with a definite grid width it stops any one panel's max-content
 *  contribution from stretching its track — the mechanism that produced the
 *  2517 this rebuild removes. */
const GRID12: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
  gap: "var(--sp-3)",
};
/** A grid cell whose panels FILL the row. A grid item stretches by default but
 *  a `.panel` inside it does not, so row 3 measured console 402 against
 *  pool-attribution ~260 and the composition's bottom edge was ragged by 142px.
 *  Flex column + `flex: 1 1 auto` closes it without touching any panel's
 *  content. `minWidth: 0` stops a long unbroken token giving the item an
 *  automatic minimum, which would reopen the track-sizing hole the definite
 *  artboard exists to close. */
const CELL_FILL: React.CSSProperties = { flex: "1 1 auto" };
function Cell({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div style={{ gridColumn: `span ${n}`, minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
      {children}
    </div>
  );
}

/**
 * Every panel in this view, so no panel can forget its provenance.
 *
 * NOT hand-rolled chrome — contract §1 bans that and `BrgCard` was exactly it.
 * This DELEGATES to PanelFrame and only derives the three props a call site
 * gets wrong by omission: `dataKey`, `updatedAt` (worst-of `oldestFreshAt`
 * across the endpoints this panel actually reads, never `lastUpdate`) and
 * `stale`. Passing `keys` once is what makes those three impossible to
 * disagree with each other.
 */
function BrgPanel({ data, title, keys, also, right, children, fill = true }: {
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
      style={fill ? CELL_FILL : undefined}
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

/** Cadence ring artboard, 1:1 with its rendered CSS size (`maxWidth`), so the
 *  captions inside it are authored in real pixels. It was 90 with 9px text. */
const RING_PX = 112;

/** Console rows. 12 in the mockup; it is the tallest panel in the composition
 *  and naturalH is a first-class budget here (contract §8's band), so the
 *  count is declared once rather than buried in a `slice`. */
const CONSOLE_ROWS = 12;

/** RandomX rotates its seed on a fixed 2048-block schedule, so epoch progress
 *  is a pure function of height — SESSION, derived, never fetched. The seed
 *  HASH itself is real feed (`data.randomxSeedHash`) and is shown beside it. */
const RANDOMX_EPOCH_BLOCKS = 2048;

/* ──────────────────────────────────────────────────────────────
   SHARED DERIVATION — the next-block cut, computed ONCE
   ────────────────────────────────────────────────────────────── */

function useNextBlockCut(data: MoneroLive): BrgCut {
  return React.useMemo(() => {
    const sorted = [...data.mempool].sort((a, b) => b.perB - a.perB);
    const limit = data.blockWeightMedian || data.blockWeightLimit || 0;
    if (!limit) return { sorted, cutIndex: null, cutPerB: null, cumAtCut: 0, limit: 0 };
    let cum = 0;
    let cutIndex = sorted.length;          // the whole pool fits under the ceiling
    for (let i = 0; i < sorted.length; i++) {
      if (cum + sorted[i].size > limit) { cutIndex = i; break; }
      cum += sorted[i].size;
    }
    return {
      sorted, cutIndex, cumAtCut: cum, limit,
      cutPerB: cutIndex > 0 && cutIndex <= sorted.length ? sorted[Math.min(cutIndex, sorted.length - 1)].perB : null,
    };
  }, [data.mempool, data.blockWeightMedian, data.blockWeightLimit]);
}

/** Shared chart plumbing: a wrapper ref measured by `useChartMetrics` in FLUID
 *  mode (no `vbWidth`, so `k === 1` and one user unit is one CSS px — contract
 *  §2's rule) plus `useSvgCursor` at that same width. Terminal's
 *  `useTermChartBase` is the same shape for the same bundle-budget reason. */
function useBrgChartBase() {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const m = useChartMetrics(wrapRef);
  const vw = m.w || VB_W;
  const [svgRef, vx, handlers] = useSvgCursor(vw);
  return { wrapRef, m, vw, svgRef, vx, handlers };
}

const fmtPcn = (v: number): string => Math.round(v).toLocaleString();
const fmtSec = (s: number): string => `${Math.floor(s / 60)}:${String(Math.abs(Math.round(s)) % 60).padStart(2, "0")}`;


export function BrgInstrumentBank({ data, cut, poolBytes }: { data: MoneroLive; cut: BrgCut; poolBytes: number }) {
  const ready = hasData(data.status.network);
  const dash = "—";

  const weightFrac = ready && data.blockWeightLimit > 0 ? data.blockWeightMedian / data.blockWeightLimit : null;
  const feeFloorFrac = ready && data.feeTiers.length === 4 && data.feeTiers[1] > 0 ? data.feeTiers[0] / data.feeTiers[1] : null;
  // Backlog in BLOCKS: how many of this node's own median-weight blocks the
  // current pool would fill. Real on both sides — pool bytes from /mempool,
  // the divisor from /network — and it moves every 3s.
  const backlog = ready && cut.limit > 0 && poolBytes > 0 ? poolBytes / cut.limit : null;
  const epochPos = ready && data.height > 0 ? (data.height % RANDOMX_EPOCH_BLOCKS) / RANDOMX_EPOCH_BLOCKS : null;

  return (
    <BrgPanel data={data} title="Instrument bank · node health" also="session" fill={false}
      keys={["network", "mempool"]}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "var(--sp-4) var(--sp-3)" }}>
        <BrgGauge label="SYNC" color="var(--g-50)"
          value={ready ? (data.synchronized ? "100%" : "0%") : dash}
          frac={ready ? (data.synchronized ? 1 : 0) : null} />
        <BrgGauge label={`FORK v${ready && data.majorVersion ? data.majorVersion : "—"}`} color="var(--c-50)"
          value={ready && data.majorVersion ? `v${data.majorVersion}` : dash}
          frac={ready && data.majorVersion ? (data.majorVersion >= 16 ? 1 : data.majorVersion / 16) : null}
          note="daemon hard-fork major version" />
        <BrgGauge label="WEIGHT / LIMIT" color="var(--tk-accent)"
          value={weightFrac == null ? dash : Math.round(weightFrac * 100) + "%"}
          frac={weightFrac} note="median block weight against the dynamic limit" />
        <BrgGauge label="FEE FLOOR / NORMAL" color="var(--y-50)"
          value={feeFloorFrac == null ? dash : Math.round(feeFloorFrac * 100) + "%"}
          frac={feeFloorFrac} note="slow tier as a fraction of the normal tier" />
        <BrgGauge label="POOL BACKLOG" color="var(--o-60)"
          value={backlog == null ? dash : "×" + backlog.toFixed(2)}
          frac={backlog == null ? null : Math.min(1, backlog / 3)}
          note="pool weight in whole blocks at this node's ceiling · bar caps at ×3" />
        {/* PEERS IS THE HONEST-UNAVAILABLE CASE, and it is deliberate.
            types.ts:128-134 records that peerCount/incomingPeers/outgoingPeers
            are 0 on the restricted public reference pool — per-peer detail
            exists only when an operator PRIMARY node is wired — and
            verify-memviews' network fixture supplies no peer fields at all
            (contract §9: a fixture's OMISSIONS are part of its contract). So a
            "14 peers" gauge here would render a live-looking 0 in production
            and would be gate-covered only on its absent-field branch. This
            reads the real field and says why it is empty; it lights up by
            itself the day a primary node is wired. */}
        <BrgGauge label="PEERS" color="var(--c-50)"
          value={data.peerCount > 0 ? `${data.peerCount}` : dash}
          frac={data.peerCount > 0 ? Math.min(1, data.peerCount / 24) : null}
          note="restricted public RPC does not expose connection counts" />
        <BrgGauge label="ALT BLOCKS" color={ready && data.altBlocksCount > 0 ? "var(--y-50)" : "var(--g-50)"}
          value={ready ? `${data.altBlocksCount}` : dash}
          frac={ready ? Math.min(1, data.altBlocksCount / 5) : null}
          note="alternative chains this node is holding · bar caps at 5" />
        <BrgGauge label="RANDOMX EPOCH" color="var(--p-50)"
          value={epochPos == null ? dash : Math.round(epochPos * 100) + "%"}
          frac={epochPos} note={`derived: height mod ${RANDOMX_EPOCH_BLOCKS}`} />
      </div>
    </BrgPanel>
  );
}

/* ──────────────────────────────────────────────────────────────
   FEE/BYTE OSCILLOSCOPE — y is the OBSERVED RANGE
   ────────────────────────────────────────────────────────────── */

/**
 * HAND-ROLLED RATHER THAN `charts.tsx`'s series components, with the reason
 * contract §3 asks for: `AreaSeries` / `BarSeries` plot ONE value per DISCRETE
 * CATEGORY and label per datum, while this is 240 continuous samples over a
 * rank axis with nothing to label — `sediment.tsx:178` records the same
 * argument for its own fee curve. Everything a series component would have
 * supplied is IMPORTED, never re-derived: AXIS/GRID, `useSvgCursor` (never
 * `clientX - rect.left`, which verify-chartkit greps for tree-wide),
 * ChartCrosshair, ChartTip, `useGradientId`, `tickCount`.
 */
export function BrgFeeScope({ data, cut }: { data: MoneroLive; cut: BrgCut }) {
  const { wrapRef, m, vw, svgRef, vx, handlers } = useBrgChartBase();
  const gradId = useGradientId("brg-scope");
  const H = 208;
  const padL = 58, padR = 14, padT = 14, padB = 30;
  const innerW = Math.max(10, vw - padL - padR);
  const innerH = H - padT - padB;

  const scope = React.useMemo(() => {
    const rows = cut.sorted;
    if (rows.length < 2) return null;
    const hi = rows[0].perB, lo = rows[rows.length - 1].perB;
    if (!(hi > lo)) return null;
    // MEDIAN of the same population, not of a bucketed approximation of it.
    const mid = Math.floor(rows.length / 2);
    const median = rows.length % 2 ? rows[mid].perB : (rows[mid - 1].perB + rows[mid].perB) / 2;
    return { rows, hi, lo, median };
  }, [cut.sorted]);

  const yOf = (v: number) => scope ? padT + innerH - ((v - scope.lo) / (scope.hi - scope.lo)) * innerH : padT;
  const xOf = (i: number) => scope ? padL + (i / (scope.rows.length - 1)) * innerW : padL;

  const path = React.useMemo(() => {
    if (!scope) return "";
    // One point per tx, but never more segments than the chart has pixels:
    // 240 samples across ~630px is fine, 4000 would be 6 per pixel and the
    // path string alone would outweigh the panel. Stride is derived from the
    // measured width, so it is 1 at every pool depth this node reports.
    const stride = Math.max(1, Math.ceil(scope.rows.length / Math.max(1, innerW)));
    const pts: string[] = [];
    for (let i = 0; i < scope.rows.length; i += stride) pts.push(`${xOf(i).toFixed(1)},${yOf(scope.rows[i].perB).toFixed(1)}`);
    const last = scope.rows.length - 1;
    pts.push(`${xOf(last).toFixed(1)},${yOf(scope.rows[last].perB).toFixed(1)}`);
    return "M" + pts.join(" L ");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, innerW, innerH, padL, padT]);

  const yTicks = React.useMemo(() => {
    if (!scope) return [] as number[];
    const n = tickCount(innerH, m.fs.tick);
    return Array.from({ length: n }, (_, i) => scope.lo + (i / (n - 1)) * (scope.hi - scope.lo));
  }, [scope, innerH, m.fs.tick]);

  // Cursor → rank, in the chart's own space. `vx` is already in viewBox units
  // and the viewBox width IS the measured CSS width (fluid mode), so no
  // conversion happens here at all — which is the point of importing it.
  const hoverI = scope && vx != null && vx >= padL && vx <= padL + innerW
    ? Math.max(0, Math.min(scope.rows.length - 1, Math.round(((vx - padL) / innerW) * (scope.rows.length - 1))))
    : null;
  const hoverTx = hoverI != null && scope ? scope.rows[hoverI] : null;

  return (
    <BrgPanel data={data} title="Fee/byte oscilloscope" keys={["mempool", "fees"]}
      right={<span className="dim2" style={{ letterSpacing: "0.08em" }}>{scope ? `${fmtFeeK(scope.lo)}–${fmtFeeK(scope.hi)} pcn/B` : "no samples"}</span>}>
      {/* The measured wrapper mounts on EVERY branch — see BrgRadar. */}
      <div ref={wrapRef} style={{ width: "100%" }}>
        {m.ready && scope ? (
          <svg ref={svgRef} {...handlers} viewBox={`0 0 ${vw} ${H}`} width="100%" height={H}
            style={{ display: "block" }} role="img"
            aria-label="Fee per byte for every mempool transaction, fee-sorted, over the observed range">
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-data)" stopOpacity="0.34" />
                <stop offset="100%" stopColor="var(--accent-data)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {yTicks.map((v, i) => (
              <g key={i}>
                <line x1={padL} x2={padL + innerW} y1={yOf(v)} y2={yOf(v)} stroke={GRID} strokeDasharray="2 5" />
                <text x={padL - 6} y={yOf(v) + 4} textAnchor="end" fontFamily="var(--f-mono)" fontSize={m.fs.tick} fill={AXIS}>{fmtFeeK(v)}</text>
              </g>
            ))}

            <path d={`${path} L ${(padL + innerW).toFixed(1)},${padT + innerH} L ${padL},${padT + innerH} Z`} fill={`url(#${gradId})`} />
            <path d={path} fill="none" stroke="var(--tk-accent)" strokeWidth="1.6" />

            {/* median — of the same 240 samples the trace draws */}
            <line x1={padL} x2={padL + innerW} y1={yOf(scope.median)} y2={yOf(scope.median)} stroke="var(--y-50)" strokeWidth="1" strokeDasharray="5 4" opacity="0.85" />
            <text x={padL + innerW} y={yOf(scope.median) - 5} textAnchor="end" fontFamily="var(--f-mono)" fontSize={m.fs.tick} fill="var(--y-50)">MEDIAN {fmtFeeK(scope.median)}</text>

            {/* next-block cut — INFERRED (§6), labelled as such */}
            {cut.cutIndex != null && cut.cutIndex > 0 && cut.cutIndex < scope.rows.length ? (
              <g>
                <line x1={xOf(cut.cutIndex)} x2={xOf(cut.cutIndex)} y1={padT} y2={padT + innerH} stroke="var(--o-80)" strokeWidth="1" opacity="0.8" />
                <text x={xOf(cut.cutIndex) + 5} y={padT + 11} fontFamily="var(--f-mono)" fontSize={m.fs.tick} fill="var(--o-80)">CUT · rank {cut.cutIndex} · inferred</text>
              </g>
            ) : null}

            <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke={AXIS} strokeOpacity="0.5" />
            <line x1={padL} y1={padT + innerH} x2={padL + innerW} y2={padT + innerH} stroke={AXIS} strokeOpacity="0.5" />
            <text x={padL} y={H - 8} fontFamily="var(--f-mono)" fontSize={m.fs.tick} fill={AXIS}>richest</text>
            <text x={padL + innerW} y={H - 8} textAnchor="end" fontFamily="var(--f-mono)" fontSize={m.fs.tick} fill={AXIS}>cheapest · {scope.rows.length} tx</text>

            {hoverTx ? <ChartCrosshair x={xOf(hoverI!)} y1={padT} y2={padT + innerH} /> : null}
            {hoverTx ? (
              <ChartTip x={xOf(hoverI!)} bounds={{ left: padL, right: padL + innerW }} rows={[
                { label: "rank", value: `${hoverI! + 1} / ${scope.rows.length}` },
                { label: "fee/B", value: `${fmtPcn(hoverTx.perB)} pcn`, color: "var(--tk-accent)" },
                { label: "size", value: fmtBytes(hoverTx.size) },
                { label: "next block", value: cut.cutIndex == null ? "—" : (hoverI! < cut.cutIndex ? "in" : "wait") },
              ]} />
            ) : null}
          </svg>
        ) : (
          <div className="mono dim" style={{ height: H, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "var(--fs-mono)" }}>
            {m.ready ? "awaiting mempool — no fee spread to plot" : "measuring…"}
          </div>
        )}
      </div>
    </BrgPanel>
  );
}

/* ──────────────────────────────────────────────────────────────
   BLOCK CADENCE — elapsed clock + real interval statistics
   ────────────────────────────────────────────────────────────── */

export function BrgBlockCadence({ data, trackedTxId, trackedHeight }: {
  data: MoneroLive; trackedTxId?: string | null; trackedHeight?: number | null;
}) {
  // `useTick` rather than a raw setInterval so it also PAUSES while the tab is
  // hidden and fires one tick immediately on return. `{ motion: false }`
  // because this is a real elapsed-time clock, not decoration: never floored
  // per-tier, never frozen under prefers-reduced-motion — a countdown that
  // freezes is a clock that lies. See UseTickOptions in design/ArtBackground.
  useTick(1000, { motion: false });
  const now = Date.now();
  const reduced = useReducedMotion();
  const ready = hasData(data.status.network);
  const TARGET = data.blockTarget || 120;

  // From the BLOCKS endpoint, for the same reason as mem-stats: the ring
  // measures a block's age, so it must stop advancing when block data stops.
  const elapsed = ready ? (data.blocks?.[0]?.age || 0) + Math.max(0, Math.floor((now - freshAt(data.status.blocks)) / 1000)) : 0;
  const overdue = ready && elapsed > TARGET;
  const pct = Math.min(1, elapsed / TARGET);
  const rr = RING_PX / 2 - 14;
  const ring = 2 * Math.PI * rr;
  const dashOffset = ring - ring * pct;
  const tone = overdue ? "var(--y-50)" : "var(--tk-accent)";

  /* Real intervals between consecutive recent blocks (age deltas), each tagged
     with the (newer) block height it belongs to so a tracked block's bar can be
     tinted. Miner timestamps are non-monotonic, so clamp each delta to
     [0, 1800]s. EVERY block the feed holds is used — it was `slice(0, 11)`, i.e.
     ten bars regardless of whether the client had pulled 14 or 100. The count
     is rendered, so "last N intervals" is a reading rather than a caption. */
  const ivs = React.useMemo(() => {
    const bs = data.blocks;
    const out: { height: number; iv: number }[] = [];
    for (let i = 0; i + 1 < bs.length; i++) {
      out.push({ height: bs[i].height, iv: Math.max(0, Math.min(1800, bs[i + 1].age - bs[i].age)) });
    }
    return out;
  }, [data.blocks]);

  const stats = React.useMemo(() => {
    if (!ivs.length) return null;
    const n = ivs.length;
    const mu = ivs.reduce((a, b) => a + b.iv, 0) / n;
    const variance = ivs.reduce((a, b) => a + (b.iv - mu) ** 2, 0) / n;
    return { mu, sigma: Math.sqrt(variance), longest: Math.max(...ivs.map((x) => x.iv)), n };
  }, [ivs]);

  const hiIv = Math.max(TARGET * 2, ...ivs.map((x) => x.iv));
  const first = ivs.length ? ivs[ivs.length - 1].height : null;
  const last = ivs.length ? ivs[0].height : null;
  const BAR_H = 46;

  return (
    <BrgPanel data={data} title={`Block cadence · ${fmtSec(TARGET)} target`} keys={["blocks", "network"]}
      right={ready ? (overdue ? <span style={{ color: "var(--y-50)" }}>overdue</span> : <span className="dim2">locked</span>) : null}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
        <svg viewBox={`0 0 ${RING_PX} ${RING_PX}`} width={RING_PX} height={RING_PX} style={{ display: "block", flex: "0 0 auto" }}
          role="img" aria-label="Time elapsed since the chain tip, against the block target">
          <circle cx={RING_PX / 2} cy={RING_PX / 2} r={rr} fill="none" stroke="var(--line)" strokeWidth="6" />
          <circle cx={RING_PX / 2} cy={RING_PX / 2} r={rr} fill="none" stroke={tone} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={ring} strokeDashoffset={dashOffset} transform={`rotate(-90 ${RING_PX / 2} ${RING_PX / 2})`}
            style={{
              // D0651: stroke-dashoffset 0.95s linear stays literal — it
              // approximates the real 1s clock tick of the elapsed-time ring,
              // and forcing an eased curve onto a per-second countdown would
              // make its speed visibly non-uniform. `stroke` (the colour swap
              // on lock/overdue) is a genuine UI timing: --d-3.
              transition: reduced ? "none" : "stroke-dashoffset 0.95s linear, stroke var(--d-3) var(--e-standard)",
            }} />
          {/* TEST-VISIBILITY hooks: `data-gauge` names this gauge and the pair
              carries `data-gauge-caption` / `data-gauge-value`, so scenario 6
              can waive their stack by RELATIONSHIP (caption over its OWN
              gauge's value, same nearest `data-gauge` ancestor) rather than by
              element or by text — the value is wall-clock derived and a
              text-matched waiver expired mid-run about one run in six.
              `data-gauge` ids must be UNIQUE per rendered gauge; this is still
              the only marked gauge in the tree, and the eight flat gauges above
              are DOM rather than SVG, so they are outside scenario 6's subject
              and carry no markers.
              THE STACK NO LONGER OVERLAPS, and the offsets below are what make
              that unambiguous rather than incidental. At RING_PX 90 with 9/14px
              text the two boxes overlapped and the waiver fired at all four
              widths; at 112 with 11/17px they came out EDGE-TO-EDGE — measured
              gap 0.0px at 1440/2560, 0.1px at 768, −0.4px at 390 — i.e. inside
              the range where sub-pixel rounding decides, which turns scenario
              6's bridge cell into a coin flip. −10/+16 puts a clear 6px between
              them at scale 1 (≈2px at the 390 fit scale). The waiver is
              therefore now UNEXERCISED; it is deliberately left in place, since
              the markers are still correct and the overlap returns if the ring
              ever shrinks. See the PR body. */}
          <g data-gauge="block-cadence-elapsed">
            <text data-gauge-caption x={RING_PX / 2} y={RING_PX / 2 - 10} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="11" fill={AXIS} letterSpacing="0.1em">ELAPSED</text>
            <text data-gauge-value x={RING_PX / 2} y={RING_PX / 2 + 16} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="17" fontWeight="500" fill={overdue ? "var(--y-50)" : "var(--ink-100)"}>
              {ready ? fmtSec(elapsed) : "—:—"}
            </text>
          </g>
        </svg>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mono dim" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "var(--sp-1)", display: "flex", justifyContent: "space-between" }}>
            <span>last {ivs.length || "—"} intervals</span>
            <span>{first != null && last != null ? `#${first.toLocaleString()} → #${last.toLocaleString()}` : "—"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: BAR_H, position: "relative" }}>
            {/* THE TARGET LINE SITS AT THE TARGET, which is the whole point of
                drawing it. The first version put a rule under the bars, where
                it marked the BASELINE while its comment claimed it marked the
                target — a caption asserting something the geometry did not do.
                `hiIv` is the same scale the bars use, so the line and the bars
                cannot disagree. */}
            <div aria-hidden="true" style={{
              position: "absolute", left: 0, right: 0,
              bottom: Math.round(TARGET / hiIv * BAR_H),
              height: 1, background: "var(--y-50)", opacity: 0.45,
            }} />
            {ivs.slice().reverse().map((item, i) => {
              const over = item.iv > TARGET;
              const tracked = trackedHeight != null && item.height === trackedHeight;
              const tone2 = tracked || over ? "var(--y-50)" : "var(--tk-accent)";
              return (
                <div key={item.height} title={`#${item.height.toLocaleString()} · ${item.iv}s`}
                  data-tracked-tx={tracked ? trackedTxId : undefined}
                  data-tracked-block={tracked ? item.height : undefined}
                  style={{
                    flex: 1, minWidth: 0,
                    height: Math.max(2, Math.round(item.iv / hiIv * BAR_H)) + "px",
                    background: tone2, opacity: 0.5 + Math.min(0.45, i * 0.02),
                    outline: tracked ? "1px solid var(--y-50)" : undefined,
                  }} />
              );
            })}
            {ivs.length === 0 ? <span className="mono dim2" style={{ fontSize: "var(--fs-label)" }}>awaiting blocks</span> : null}
          </div>
          <div className="mono" style={{ display: "flex", justifyContent: "space-between", gap: "var(--sp-2)", fontSize: "var(--fs-label)", color: "var(--ink-40)", marginTop: "var(--sp-2)" }}>
            <span>μ {stats ? Math.round(stats.mu) + "s" : "—"}</span>
            <span>σ {stats ? Math.round(stats.sigma) + "s" : "—"}</span>
            <span>max {stats ? Math.round(stats.longest) + "s" : "—"}</span>
            <span>alt {ready ? data.altBlocksCount : "—"}</span>
          </div>
        </div>
      </div>
    </BrgPanel>
  );
}

/* ──────────────────────────────────────────────────────────────
   ALERT TAPE — real events, plus derived state rows
   ────────────────────────────────────────────────────────────── */

type BrgAlertRow = { lvl: string; tone: string; msg: string; ts: string; t: number };

const BRG_TONE: Record<string, string> = {
  g: "var(--g-50)", acc: "var(--tk-accent)", p: "var(--p-50)", y: "var(--y-50)", m: "var(--ink-40)",
};

function BrgTapeRow({ lvl, tone, msg, ts, tracked }: {
  lvl: string; tone: string; msg: React.ReactNode; ts?: string; tracked?: { id: string; height: number };
}) {
  return (
    <div
      data-tracked-tx={tracked ? tracked.id : undefined}
      data-tracked-block={tracked ? tracked.height : undefined}
      style={{
        display: "grid", gridTemplateColumns: "62px 74px 1fr", gap: "var(--sp-2)", padding: "3px 0",
        borderBottom: tracked ? "1px solid var(--y-50)" : "1px dashed var(--line-d)",
      }}
    >
      <span className="dim2">{ts ?? "—"}</span>
      <span style={{ color: BRG_TONE[tone] ?? "var(--ink-40)" }}>{lvl}</span>
      <span className="dim" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{msg}</span>
    </div>
  );
}

export function BrgAlertTape({ data, oldestAgeSec, trackedTxId, trackedHeight, trackedConf }: {
  data: MoneroLive; oldestAgeSec: number;
  trackedTxId?: string | null; trackedHeight?: number | null; trackedConf?: number | null;
}) {
  const events = useFeedEvents(data, 20);
  const [rows, setRows] = React.useState<BrgAlertRow[]>([]);
  const seq = React.useRef(0);
  const mk = React.useCallback((lvl: string, tone: string, msg: string, ms: number): BrgAlertRow =>
    ({ lvl, tone, msg, ts: new Date(ms).toISOString().slice(11, 19), t: seq.current++ }), []);

  // Block / stale / recover alerts from the real event stream (object identity
  // marks which events have already been turned into tape rows).
  const seenRef = React.useRef<Set<unknown>>(new Set());
  React.useEffect(() => {
    const fresh: BrgAlertRow[] = [];
    for (const ev of events) {            // events arrive newest-first
      if (seenRef.current.has(ev)) continue;
      if (ev.kind === "block") fresh.push(mk("NOMINAL", "g", `chain tip → #${ev.height.toLocaleString()} (${ev.txs} tx)`, ev.ts));
      else if (ev.kind === "stale") fresh.push(mk("WATCH", "y", "feed stale · reconnecting", ev.ts));
      else if (ev.kind === "recover") fresh.push(mk("NOMINAL", "g", "feed recovered", ev.ts));
    }
    seenRef.current = new Set(events);
    if (fresh.length) setRows((r) => [...fresh, ...r].slice(0, 6));
  }, [events, mk]);

  // Threshold alerts diffed against the previous tick's real values.
  const prevRef = React.useRef<{ poolLen: number | null; feeFloor: number | null; weightHot: boolean }>({ poolLen: null, feeFloor: null, weightHot: false });
  const ready = hasData(data.status.network);
  React.useEffect(() => {
    if (!ready) return;
    const fresh: BrgAlertRow[] = [];
    const now = Date.now();
    const p = prevRef.current;

    const len = data.mempool.length;
    if (p.poolLen != null && [50, 100, 200].some((th) => p.poolLen! < th && len >= th)) {
      fresh.push(mk("TXPOOL", "acc", `mempool depth ${len} tx`, now));
    }
    p.poolLen = len;

    if (data.blockWeightLimit > 0 && data.blockWeightMedian > 0) {
      const ratio = data.blockWeightMedian / data.blockWeightLimit;
      if (ratio >= 0.8 && !p.weightHot) {
        fresh.push(mk("WATCH", "y", `weight median ${Math.round(ratio * 100)}% of limit`, now));
        p.weightHot = true;
      } else if (ratio < 0.8) p.weightHot = false;
    }

    if (data.feeTiers.length === 4) {
      const floor = data.feeTiers[0];
      if (p.feeFloor != null && floor !== p.feeFloor) {
        fresh.push(mk("FEES", "p", `fee floor → ${Math.round(floor).toLocaleString()} pcn/B`, now));
      }
      p.feeFloor = floor;
    }

    if (fresh.length) setRows((r) => [...fresh, ...r].slice(0, 6));
    // Diff once per successful feed tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  // lastOkAt: this differ fires on ANY tier committing, not on one endpoint.
  }, [lastOkAt(data.status), ready]);

  /* STATE ROWS — the node's standing condition, where the rows above are
     transitions. Every one is a live read that changes with the feed; a row
     printing the same string regardless of the feed is decoration, so there
     isn't one. The mockup's "ZMQ unavailable · polling 15s" is exactly that and
     is deliberately NOT ported: true of this pipeline, but a constant. */
  const blocksBehind = oldestAgeSec > 0 && (data.blockTarget || 120) > 0
    ? Math.floor(oldestAgeSec / (data.blockTarget || 120)) : 0;
  const weightRatio = ready && data.blockWeightLimit > 0 ? data.blockWeightMedian / data.blockWeightLimit : null;
  const states: { lvl: string; tone: string; msg: string }[] = ready ? [
    data.synchronized
      ? { lvl: "OK", tone: "g", msg: `daemon synchronized · tip #${data.height.toLocaleString()}` }
      : { lvl: "WATCH", tone: "y", msg: "daemon NOT synchronized" },
    weightRatio == null
      ? { lvl: "INFO", tone: "m", msg: "block weight not reported" }
      : weightRatio >= 0.8
        ? { lvl: "WATCH", tone: "y", msg: `median weight ${Math.round(weightRatio * 100)}% of the ${fmtBytes(data.blockWeightLimit)} limit` }
        : { lvl: "OK", tone: "g", msg: `median weight ${Math.round(weightRatio * 100)}% of the ${fmtBytes(data.blockWeightLimit)} limit` },
    blocksBehind >= 2
      ? { lvl: "WATCH", tone: "y", msg: `oldest tx ${Math.round(oldestAgeSec / 60)}m · ~${blocksBehind} blocks unmined` }
      : { lvl: "OK", tone: "g", msg: `oldest tx ${oldestAgeSec}s · under one block target` },
    data.altBlocksCount > 0
      ? { lvl: "WATCH", tone: "y", msg: `${data.altBlocksCount} alt block${data.altBlocksCount === 1 ? "" : "s"} held · possible reorg` }
      : { lvl: "OK", tone: "g", msg: "0 alt blocks · no reorg" },
    data.peerCount > 0
      ? { lvl: "OK", tone: "g", msg: `${data.peerCount} peers connected` }
      : { lvl: "INFO", tone: "m", msg: "peer count unobservable · restricted RPC" },
  ] : [];

  const pinned = trackedTxId && trackedHeight != null ? (
    <BrgTapeRow lvl="TRACK" tone="y" ts="PINNED" tracked={{ id: trackedTxId, height: trackedHeight }}
      msg={`${ShortHash(trackedTxId)} · confirmed #${trackedHeight.toLocaleString()} · ${trackedConf}/${CONF_UNLOCK}`} />
  ) : null;

  // BrgPanel's default `fill` STRETCHES this to the hero column's remaining
  // height. That row is sized by the radar beside it and the two panels stacked
  // here are naturally shorter, so without it the row carries the dead column
  // this composition exists to remove. The tape is the right panel to give the
  // slack to — the one surface here whose content grows as the node runs.
  return (
    <BrgPanel data={data} title="Alert tape" keys={["network", "blocks", "mempool", "fees"]}>
      <div style={{ fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)", lineHeight: 1.45 }}>
        {pinned}
        {states.map((s, i) => <BrgTapeRow key={"s" + i} lvl={s.lvl} tone={s.tone} msg={s.msg} ts="STATE" />)}
        {rows.length === 0 && !states.length && !pinned ? (
          <div className="dim" style={{ padding: "3px 0" }}>standing by · no feed events yet</div>
        ) : null}
        {rows.map((r) => (
          // D0651: brg-slidein 0.4s (bare) — tie between --d-3/--d-4, round-half-up to --d-4.
          <div key={r.t} style={{ animation: "brg-slidein var(--d-4) var(--e-standard)" }}>
            <BrgTapeRow lvl={r.lvl} tone={r.tone} msg={r.msg} ts={r.ts} />
          </div>
        ))}
      </div>
      <style>{`@keyframes brg-slidein { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }`}</style>
    </BrgPanel>
  );
}

/* ──────────────────────────────────────────────────────────────
   TRANSACTION CONSOLE — fee-sorted, with the inferred CUT column
   ────────────────────────────────────────────────────────────── */

const CONSOLE_COLS = "56px 76px 1.4fr 74px 92px 52px 62px 54px";

export function BrgTxConsole({ data, cut, tracking, onPickTx }: {
  data: MoneroLive; cut: BrgCut; tracking: Tracking; onPickTx: (id: string) => void;
}) {
  // FEE-SORTED, sharing `cut.sorted` — the same array the scope plots and the
  // radar ranges, so "rank 148" means the same thing on all three.
  const rows = cut.sorted.slice(0, CONSOLE_ROWS);
  const trackedId = tracking?.kind === "tx" ? tracking.id : null;
  return (
    <BrgPanel data={data} title={`Transaction console · ${rows.length} of ${data.mempool.length}`}
      also="session" keys={["mempool", "fees"]}
      right={<span className="dim2" style={{ letterSpacing: "0.08em" }}>fee-sorted</span>}>
      <div className="mono" style={{ display: "grid", gridTemplateColumns: CONSOLE_COLS, gap: "var(--sp-2)", fontSize: "var(--fs-label)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-40)", padding: "0 var(--sp-2) var(--sp-1)", borderBottom: "1px solid var(--rule)" }}>
        <span>rank</span><span>tier</span><span>txid</span><span>size</span><span>fee/B</span><span>ring</span><span>age</span>
        <span title="inferred: would this tx fit under the node's own per-block weight ceiling, fee-sorted">cut</span>
      </div>
      {rows.length === 0 ? (
        <div className="mono dim" style={{ padding: "var(--sp-3) var(--sp-2)", fontSize: "var(--fs-mono)" }}>awaiting mempool…</div>
      ) : rows.map((t, i) => {
        const tier = feeTierIndex(t.perB, data.feeTiers);
        const label = tier >= 0 ? FEE_TIER_LABELS[tier].toUpperCase() : "—";
        const tc = tier >= 0 ? TIER_COLORS[tier] : "var(--ink-40)";
        const isTracked = t.id === trackedId;
        const fits = cut.cutIndex == null ? null : i < cut.cutIndex;
        return (
          <div key={t.id} data-tracked-tx={isTracked ? t.id : undefined}>
            <div onClick={() => onPickTx(t.id)}
              style={{
                display: "grid", gridTemplateColumns: CONSOLE_COLS, gap: "var(--sp-2)", fontSize: "var(--fs-mono)",
                padding: "var(--sp-1) var(--sp-2)", borderBottom: "1px solid var(--line-d)",
                borderLeft: isTracked ? "2px solid var(--y-50)" : "2px solid transparent",
                background: isTracked ? "color-mix(in srgb, var(--status-warn) 7%, transparent)" : undefined,
                cursor: "pointer", fontFamily: "var(--f-mono)", alignItems: "center",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = isTracked ? "color-mix(in srgb, var(--status-warn) 12%, transparent)" : "color-mix(in srgb, var(--accent-structural) 7%, transparent)"}
              onMouseLeave={(e) => e.currentTarget.style.background = isTracked ? "color-mix(in srgb, var(--status-warn) 7%, transparent)" : "transparent"}>
              <span className="dim2">{String(i + 1).padStart(4, "0")}</span>
              <span style={{ color: tc, border: "1px solid " + tc, borderRadius: 2, fontSize: "var(--fs-label)", padding: "1px var(--sp-1)", letterSpacing: "0.08em", justifySelf: "start" }}>{label}</span>
              <span style={{ color: "var(--c-50)", overflow: "hidden", textOverflow: "ellipsis" }}>{ShortHash(t.id)}</span>
              <span className="dim">{fmtBytes(t.size)}</span>
              <span className="acc">{fmtPcn(t.perB)}</span>
              <span className="dim">{t.ringSize}</span>
              <span className="dim2">{t.age}s</span>
              <span style={{ color: fits == null ? "var(--ink-40)" : fits ? "var(--g-50)" : "var(--ink-40)" }}>{fits == null ? "—" : fits ? "in" : "wait"}</span>
            </div>
            {isTracked ? (
              <div style={{ padding: "2px var(--sp-2) var(--sp-1)", borderLeft: "2px solid var(--y-50)" }}>
                <TrackChip tracking={tracking} data={data} />
              </div>
            ) : null}
          </div>
        );
      })}
    </BrgPanel>
  );
}

/* ──────────────────────────────────────────────────────────────
   POOL ATTRIBUTION — the honest disclosure, plus chain constants
   ────────────────────────────────────────────────────────────── */

/** Every prose node in this view carries a width bound. The artboard is
 *  definite now, so an unbounded caption can no longer rescale the view — but
 *  it can still force its own panel's track to overflow, and contract §8's
 *  rule ("cap every caption to the width of the thing it describes") is about
 *  the reader as much as about naturalW. This is the caption that measured
 *  1174px of max-content demand and set the old 2517. */
const PROSE: React.CSSProperties = { maxWidth: "34ch", whiteSpace: "normal" };

export function BrgPoolDist({ data }: { data: MoneroLive }) {
  const recentBlocks = data.blocks.slice(0, 14);
  const unattributed = recentBlocks.filter((b) => !b.pool || b.pool === "Unknown" || b.pool === "—").length;
  const ready = hasData(data.status.network);
  const row = (k: string, v: React.ReactNode) => (
    <div className="mono" style={{ display: "flex", justifyContent: "space-between", gap: "var(--sp-2)", fontSize: "var(--fs-label)", padding: "2px 0", borderBottom: "1px solid var(--line-d)" }}>
      <span style={{ color: "var(--ink-40)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{k}</span>
      <span className="dim" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
    </div>
  );
  return (
    <BrgPanel data={data} title="Pool attribution" keys={["blocks", "network"]}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--sp-2)", marginBottom: "var(--sp-2)" }}>
        <span className="mono" style={{ fontSize: 20, color: "var(--ink-100)" }}>{unattributed}/{recentBlocks.length}</span>
        <span className="dim2" style={{ fontSize: "var(--fs-label)" }}>recent blocks · pool unknown</span>
      </div>
      <p className="mono dim" style={{ ...PROSE, fontSize: "var(--fs-label)", lineHeight: 1.55, marginBottom: "var(--sp-3)", color: "var(--ink-40)" }}>
        Monero coinbases don't tag pools, so per-pool share isn't measurable
        on-chain. Decentralisation &amp; HHI live in the{" "}
        <Link to={`${R.LEARN_SIM}?p=skyline`} className="acc">Skyline simulator</Link>.
      </p>
      {row("hashrate", ready ? (data.hashrate / 1e9).toFixed(2) + " GH/s" : "—")}
      {row("difficulty", ready ? (data.difficulty / 1e9).toFixed(1) + " G" : "—")}
      {row("randomx seed", ready && data.randomxSeedHash ? ShortHash(data.randomxSeedHash) : "—")}
      {row("chain txs", ready && data.txCountTotal ? data.txCountTotal.toLocaleString() : "—")}
      {row("daemon", ready && data.version ? `${data.version} · ${data.nettype || "—"}` : "—")}
    </BrgPanel>
  );
}

/* ──────────────────────────────────────────────────────────────
   COMPOSITION
   ────────────────────────────────────────────────────────────── */

/**
 * Seven panels on one 12-column grid: c5 c7 | c7 c5 | c8 c4. Each conceptual
 * row sums to 12, so auto-flow tiles them without a wrapper per row.
 *
 * THE MOCKUP'S HERO ROW DOES NOT SURVIVE A HEIGHT BUDGET, and this is where
 * that was resolved. Rendered at 1440 the mockup's c5 radar is square at ~660px
 * while its 8-gauge bank fills ~210px of the c7 — ~450px of dead column in the
 * tallest row. BOTH available fixes are taken, because either alone tips the
 * row the other way: the radar is capped at RADAR_PX, and the ALERT TAPE moves
 * out of its mockup slot into this column under the bank. Measured, the row is
 * 471 and the right column is 167 + 12 + 292 = 471.
 *
 * The mockup's strip is the SHARED MemStatStrip (MemViewShell renders it); this
 * view does not re-implement it, and the view-local 7-stat row that duplicated
 * HEIGHT/HASHRATE/DIFFICULTY/XMR is gone — those figures are read in the
 * instrument bank and pool-attribution panels rather than listed.
 */
export function BrgOverview({ data, tracking, onPickTx }: { data: MoneroLive; tracking: Tracking; onPickTx: (id: string) => void }) {
  const cut = useNextBlockCut(data);
  const poolBytes = React.useMemo(() => data.mempool.reduce((a, t) => a + t.size, 0), [data.mempool]);
  const oldestAgeSec = React.useMemo(
    () => (data.mempool.length ? Math.max(...data.mempool.map((t) => t.age)) : 0),
    [data.mempool],
  );

  // Tracked tx, resolved once via useMempoolTracking + confOf everywhere —
  // pending (still in mempool) shows on the radar/console; confirmed (left the
  // mempool) shows on the alert tape + block-cadence panel instead.
  const trackedTxId = tracking?.kind === "tx" ? tracking.id : null;
  const trackedHeight = tracking?.kind === "tx" ? tracking.blockHeight : null;
  const trackedConf = trackedHeight != null ? confOf(trackedHeight, data) : null;

  return (
    <div style={GRID12}>
      {/* row 1 · c5 radar | c7 [instrument bank / alert tape] */}
      <Cell n={5}>
        <BrgPanel data={data} title="Mempool radar · PPI scope" also="session" keys={["mempool", "fees"]}
          right={<span className="dim2" style={{ letterSpacing: "0.08em" }}>{data.mempool.length} contacts</span>}>
          <BrgRadar data={data} cut={cut} trackedId={trackedTxId} />
          <div className="mono" style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-1) var(--sp-3)", fontSize: "var(--fs-label)", color: "var(--ink-40)", marginTop: "var(--sp-2)" }}>
            {FEE_TIER_LABELS.map((label, i) => (
              <span key={label}>
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: TIER_COLORS[i], marginRight: "var(--sp-1)" }} />
                {label.toUpperCase()}
              </span>
            ))}
          </div>
          {/* Capped to RADAR_PX — the width of the instrument it describes,
              which is contract §8's rule stated literally. PROSE's 34ch is the
              cap for the narrower c4 column; here it would wrap this to five
              lines inside a 445px body and cost the hero row ~50px. */}
          <p className="mono" style={{ maxWidth: RADAR_PX, margin: "var(--sp-2) auto 0", fontSize: "var(--fs-label)", color: "var(--ink-40)", lineHeight: 1.5 }}>
            Range is fee/byte, not age; bearing is derived from the txid. The
            cut ring is inferred, not a miner's template.
          </p>
        </BrgPanel>
      </Cell>

      <Cell n={7}>
        <BrgInstrumentBank data={data} cut={cut} poolBytes={poolBytes} />
        <BrgAlertTape data={data} oldestAgeSec={oldestAgeSec} trackedTxId={trackedTxId} trackedHeight={trackedHeight} trackedConf={trackedConf} />
      </Cell>

      {/* row 2 · c7 oscilloscope | c5 cadence */}
      <Cell n={7}><BrgFeeScope data={data} cut={cut} /></Cell>
      <Cell n={5}><BrgBlockCadence data={data} trackedTxId={trackedTxId} trackedHeight={trackedHeight} /></Cell>

      {/* row 3 · c8 console | c4 pool attribution */}
      <Cell n={8}><BrgTxConsole data={data} cut={cut} tracking={tracking} onPickTx={onPickTx} /></Cell>
      <Cell n={4}><BrgPoolDist data={data} /></Cell>
    </div>
  );
}

export function BridgeView({ data }: ViewProps) {
  const { tracking, onSearch, clearTracking } = useMempoolTracking(data);
  return (
    // `width: ARTBOARD_W` with `boxSizing: border-box` is what makes naturalW a
    // constant — see the header. `.mp-view`'s `width: max-content` used to size
    // this from content, which is how one 1174px prose node set a 2517px
    // artboard.
    <div className="main" style={{ overflow: "auto", padding: 0, width: ARTBOARD_W, boxSizing: "border-box" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)", padding: "var(--sp-4) var(--sp-4) var(--sp-6)", boxSizing: "border-box" }}>
        <MemViewShell
          id="bridge"
          table={<MemTxTable data={data} tracking={tracking} viewId="bridge" columns={["txid", "perB", "tier", "size", "age", "inout", "ring"]} onPickTx={(id) => onSearch({ kind: "tx", id })} />}
          data={data}
          tracking={tracking}
          onSearch={onSearch}
          onClearTracking={clearTracking}
        >
          <BrgOverview data={data} tracking={tracking} onPickTx={(id) => onSearch({ kind: "tx", id, blockHeight: null })} />
        </MemViewShell>
      </div>
    </div>
  );
}
