// sediment.tsx — SEDIMENT v2·1 · hi-fi core sample
//
// The mempool drawn as a chemistry core: pending txs suspended by fee-per-byte
// (high floats, low sinks) above a bright confirmation meniscus, crossing into
// stratigraphic bands of confirmed blocks below. The core column is the HERO —
// it is the metaphor, so it gets the room (~5 of 12 grid columns on desktop).
//
// v2·1 rebuild (claude/V2-VIEW-CONFORMANCE.md, both revisions):
//   • the suspended-tx field is now a real useMemCanvas particle field
//     (min(txCount, 320) real txs, never padded — CLAUDE.md's zero-fabrication
//     rule), not DOM nodes with a hardcoded "320 p/B..0 p/B" ruler.
//   • every panel uses PanelFrame; SedCard is gone.
//   • the core-column fee axis and the grain-size scatter's axes are
//     hand-rolled (AXIS/GRID/tickCount from chart-kit) with the reason stated
//     at each site, per Rev 2 §3 — neither is a `charts.tsx` series.
//   • every particle opens the shared tx inspector; every stratum opens the
//     shared block inspector.
//   • low-pool (<8 tx): the field becomes a labelled single-file column and
//     the fee depth-profile becomes a ladder. No empty plots.
//   • reduced motion: the canvas is REMOVED from the DOM (MemViewShell does
//     NOT do this for us — verified false, see SedCoreColumn below) and
//     replaced by a static, information-equivalent SVG rendering.
//
// All helpers prefixed `Sed` to avoid the shared-scope collisions.

import * as React from "react";
import { useReducedMotion } from "@/design/useReducedMotion";
import { NodeProvenance, PanelFrame } from "@/design/primitives";
import { AXIS, GRID, ChartCrosshair, ChartTip, useSvgCursor, canvasCursor } from "@/design/chart-kit";
import { FS_FALLBACK, tickCount } from "@/design/useChartMetrics";
import { h3 } from "@/design/prng";
import { fmtAgeS, fmtBytes, shortHash as ShortHash } from "@/data/types";
import { MemViewShell, TrackChip, useMempoolTracking, type Tracking, MemTxTable } from "@/mempool/mempool-shared";
import { useMemStats, BlockEta } from "@/mempool/mem-stats";
import { CONF_UNLOCK, confOf, txHash32 } from "@/mempool/conf";
import { useMemCanvas, glowSprite, blitGlow, cssColor, type MemDrawFn } from "@/mempool/useMemCanvas";
import { AreaSeries, BarSeries } from "@/pages/markets/charts";
import { feeTierIndex } from "@/data/map";
import type { MoneroLive, Tx } from "@/data/types";
import { hasData, oldestFreshAt } from "@/data/feed-status";

/* Chart formatters are hoisted to module scope so their identity is stable
   across renders. `AreaSeries`/`BarSeries` are React.memo'd (see
   pages/markets/charts.tsx) and an inline `format={(v) => …}` arrow allocates
   a fresh function every render, which defeats the boundary entirely. None of
   these close over anything, so module scope is where they belonged anyway. */
const fmtTx = (v: number): string => v + " tx";
const fmtPerB = (v: number): string => Math.round(v).toLocaleString() + " p/B";
const fmtRound = (v: number): string => String(Math.round(v));

export const BLOCKS_CAP = 100;

interface ViewProps {
  data: MoneroLive;
  bg?: { intensity?: "calm" | "busy" | "chaotic"; scan?: boolean };
}

/* ── fee-tier ramp — LOCAL to this view (contract §4, verbatim) ──────────
   bridge/terminal/constellation/reactor each carry a DIFFERENT four-colour
   array (--c-50,--g-50,--y-50,--r-50, keyed by *urgency*). This view's ramp
   is the one the v2 contract states explicitly, keyed by fee tier, and is
   NOT hoisted to a shared module — that would widen this PR's diff into
   files this task does not own. */
const SED_TIER_TOKENS = ["var(--c-50)", "var(--accent-data)", "var(--o-80)", "var(--y-50)"] as const;
const SED_TIER_FALLBACK = "var(--tk-accent)";

function sedTierToken(perB: number, tiers: number[]): string {
  const i = feeTierIndex(perB, tiers);
  return i >= 0 ? SED_TIER_TOKENS[i] : SED_TIER_FALLBACK;
}

/* ── deterministic, TX-IDENTITY-keyed decoration ──────────────────────────
   Keyed on txHash32(tx.id), never on array index or draw order. The mempool
   array re-sorts on every ~3s poll (mem-stats/useMemStats reads data.mempool
   fresh each tick) — an index-keyed hash would reassign a tx's depth band and
   screen position every time the pool reordered, which reads as noise, not
   depth. Keying on identity means a given tx keeps its band/position for its
   whole life in the pool. `role` decorrelates the several draws so a tx's
   band, x-position and animation phase don't all move together. */
const SED_SEED = 0x5ed1;
function sedUnit(id: string, role: number): number {
  return h3(txHash32(id) | 0, role, SED_SEED);
}

/* ── depth bands: 4 bands, radius 0.9–2.8px END TO END across all bands
   (not per band), near band smallest+crispest, far band largest+softest.
   WITHIN a band, radius still tracks weight (tx.size) — band sets the base
   scale and the softness, weight modulates inside it, so the weight channel
   is never erased by the band channel. Purely decorative/session-derived:
   nothing in the contract ties a band to any real tx property, so band
   membership carries no data claim of its own. */
const SED_BANDS = 4;
const SED_R_MIN = 0.9;
const SED_R_MAX = 2.8;
const SED_BAND_SPAN = (SED_R_MAX - SED_R_MIN) / SED_BANDS;
/** glow-sprite radius multiplier over the particle's own radius, near→far. */
const SED_BAND_GLOW = [1.4, 2.0, 2.8, 3.8] as const;
/** base opacity, near→far — the atmospheric-depth read. */
const SED_BAND_ALPHA = [0.96, 0.8, 0.6, 0.42] as const;
/** whether this band paints a crisp hard core in addition to its glow. */
const SED_BAND_CORE = [true, true, false, false] as const;

function sedBand(id: string): number {
  return Math.min(SED_BANDS - 1, Math.floor(sedUnit(id, 1) * SED_BANDS));
}
function sedRadiusRange(band: number): [number, number] {
  const lo = SED_R_MIN + band * SED_BAND_SPAN;
  return [lo, lo + SED_BAND_SPAN];
}
function sedRadius(band: number, weightFrac: number): number {
  const [lo, hi] = sedRadiusRange(band);
  return lo + Math.max(0, Math.min(1, weightFrac)) * (hi - lo);
}

/** Highest fee/byte first — the honest truncation for a fee-sorted column: the
 *  320 a viewer would see "at the top" if the whole pool were drawn. Never a
 *  silent index-order slice, which would look like "the whole pool" while
 *  quietly dropping an arbitrary tail. Never padded when the pool is smaller
 *  — 320 is a CEILING, not a fabricated floor. */
const MAX_FIELD_PARTICLES = 320;
function sedSelectField(mempool: Tx[]): { drawn: Tx[]; truncated: boolean } {
  if (mempool.length <= MAX_FIELD_PARTICLES) return { drawn: mempool, truncated: false };
  const sorted = [...mempool].sort((a, b) => b.perB - a.perB);
  return { drawn: sorted.slice(0, MAX_FIELD_PARTICLES), truncated: true };
}

/** The one deterministic probe particle for data-sed-probe — identity-sorted
 *  (never draw-order/fee-order, which can tie or shift), so the SAME tx is
 *  the probe on every render as long as it's still in the drawn set. */
function sedProbeTx(drawn: Tx[]): Tx | null {
  if (!drawn.length) return null;
  return [...drawn].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
}

interface SedParticle {
  tx: Tx;
  x: number;
  y: number;
  r: number;
  band: number;
  alpha: number;
  color: string;
}

const FIELD_PAD_T = 10;
const FIELD_PAD_B = 10;
const FIELD_MARGIN_L = 8;
const FIELD_MARGIN_R = 8;

/** Pure layout — same function drives the canvas paint, the static SVG
 *  fallback, the click hit-test and the published data-sed-* attributes, so
 *  none of those four can disagree about where a particle is. */
function sedLayout(
  drawn: Tx[], w: number, h: number, maxPerB: number, maxSize: number,
  tiers: number[], colors: readonly string[], fallback: string,
): SedParticle[] {
  const top = FIELD_PAD_T, bottom = h - FIELD_PAD_B;
  return drawn.map((tx) => {
    const band = sedBand(tx.id);
    const wf = maxSize > 0 ? tx.size / maxSize : 0;
    const r = sedRadius(band, wf);
    const x = FIELD_MARGIN_L + sedUnit(tx.id, 2) * Math.max(1, w - FIELD_MARGIN_L - FIELD_MARGIN_R);
    const t = maxPerB > 0 ? Math.min(1, tx.perB / maxPerB) : 0;
    const y = bottom - t * Math.max(1, bottom - top);
    const i = feeTierIndex(tx.perB, tiers);
    const color = i >= 0 ? colors[i] : fallback;
    return { tx, x, y, r, band, alpha: SED_BAND_ALPHA[band], color };
  });
}

function onEnterKey(fn: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); }
  };
}

/* ── fee axis — hand-rolled, justified (Rev 2 §3) ─────────────────────────
   Not a `charts.tsx` series: AreaSeries/BarSeries plot ONE value per discrete
   sample along an x-axis and thin THOSE labels with labelStep(); this is a
   single continuous y-axis behind a particle field, with only
   tickCount()-many (2..5) ticks. There are no candidate labels to stride
   through, so labelStep() has nothing to do here — tickCount() alone decides
   the count, exactly as BarSeries' own y-axis does (charts.tsx:959,
   `niceTicks(yMin, yMax, tickCount(innerH, fs.tick))`). AXIS/GRID still come
   from chart-kit, and ticks are the real max(perB) of the drawn set, never a
   hand-typed "320 p/B..0 p/B" ruler. */
function SedFeeAxis({ maxPerB, height, width }: { maxPerB: number; height: number; width: number }) {
  const innerH = height - FIELD_PAD_T - FIELD_PAD_B;
  const n = tickCount(innerH, FS_FALLBACK.tick);
  const ticks = Array.from({ length: n }, (_, i) => (maxPerB * i) / Math.max(1, n - 1));
  // STANDARDS CONFLICT, reported per Rev 2 §6 rather than silently picked a
  // side, and named precisely: `--fs-label` (styles-legibility.css:23,
  // `clamp(11px, 0.74vw, 12px)`) is the repo's deliberate v6.0.10 floor and
  // sits at exactly 11px for every viewport below ~1486px; the v6 prompt
  // series asserts a 12px floor instead. This axis renders at `var(--fs-label)`
  // — the repo-floor side of that dispute — rather than a number this PR
  // invents, so it tracks the token if the token ever moves. Resolving the
  // 11-vs-12 disagreement is not this PR's job. (`FS_FALLBACK.tick`, used
  // below only for the tick-fitting ARITHMETIC, mirrors a different token —
  // `--fs-chart-tick` — that happens to share the same 11px number; it is
  // not itself part of this dispute and is not what renders.)
  // It previously rendered at 9.02px/7.92px via silent *0.82/*0.72 shrink
  // multipliers, below BOTH candidate floors and endorsed by neither side —
  // that was the defect, not the 11-vs-12 disagreement itself.
  // No standalone "p/B" caption INSIDE the SVG: verify-memviews scenario 6
  // caught the previous shape (a separate SVG <text> at the bottom, sharing
  // the same ~10px margin as the "0" tick) as a real overlap once both moved
  // to 11px. The unit is an HTML label rendered by the caller instead — a
  // different rendering layer that scenario 6's SVG-<text>-only sweep never
  // compares against the tick numbers, so the collision class is gone
  // structurally, not just repositioned into a smaller one.
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block", overflow: "visible" }} aria-hidden="true">
      {ticks.map((v, i) => {
        const t = maxPerB > 0 ? v / maxPerB : 0;
        const y = height - FIELD_PAD_B - t * innerH;
        return (
          <g key={i}>
            <line x1={0} x2={6} y1={y} y2={y} stroke={AXIS} strokeWidth="1" />
            <text x={10} y={y + 3} fontFamily="var(--f-mono)" fontSize="var(--fs-label)" fill={AXIS}>
              {i === n - 1 ? Math.round(v).toLocaleString() : Math.round(v)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// Widened 52 -> 64 alongside the fontSize fix below: raising the axis text
// from a shrunk 9.02px to the repo's real 11px floor needs more horizontal
// room for the widest tick label ("900,000"-class values) not to run past
// the gutter's right edge.
const AXIS_GUTTER = 64;

/* ── the core column's suspended field: canvas (≥8 tx, motion) / static SVG
   (≥8 tx, reduced motion) / labelled column (<8 tx, either) ─────────────── */
interface SedFieldProps {
  data: MoneroLive;
  tracking: Tracking;
  onPickTx: (id: string) => void;
}

function SedParticleField({ drawn, maxPerB, maxSize, tiers, truncated, total, trackedTxId, hostWidth, hostHeight, onPickTx }: {
  drawn: Tx[]; maxPerB: number; maxSize: number; tiers: number[]; truncated: boolean; total: number;
  trackedTxId: string | null; hostWidth: number; hostHeight: number; onPickTx: (id: string) => void;
}) {
  // Resolved once per mount (the established pattern — see
  // pages/future/FutureMini.tsx's useMiniPalette: canvas cannot consume
  // var(), and re-resolving inside the draw loop would call
  // getComputedStyle() 60×/sec for a value that only changes when the theme
  // does). A theme toggle mid-session gets its new palette on this view's
  // next mount, same as FutureMini's popups.
  const resolved = React.useMemo(
    () => ({ colors: SED_TIER_TOKENS.map((c) => cssColor(c)), fallback: cssColor(SED_TIER_FALLBACK) }),
    [],
  );

  const draw: MemDrawFn = (ctx, w, h, t) => {
    ctx.clearRect(0, 0, w, h);
    if (!drawn.length) return;
    const list = sedLayout(drawn, w, h, maxPerB, maxSize, tiers, resolved.colors, resolved.fallback);
    // painter's order: far band first (behind), near band last (in front).
    const ordered = [...list].sort((a, b) => b.band - a.band);
    for (const p of ordered) {
      // D0651: a slow per-tx bob (±1.2px, identity-keyed phase) is what makes
      // this an ANIMATED field rather than one static paint — ambient, not an
      // interaction, same category as the rest of this codebase's float
      // loops. The published attributes (data-sed-probe, radius min/max)
      // report the BASE (non-bobbing) position so repeated reads are stable;
      // the click hit-test below uses a tolerance wide enough to absorb it.
      const phase = sedUnit(p.tx.id, 3) * Math.PI * 2;
      const by = p.y + Math.sin(t * 0.6 + phase) * 1.2;
      const glowR = Math.round(p.r * SED_BAND_GLOW[p.band] * 4) / 4; // quarter-px sprite-cache buckets
      blitGlow(ctx, glowSprite(p.color, glowR), p.x, by, p.alpha);
      if (SED_BAND_CORE[p.band]) {
        ctx.beginPath();
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.min(1, p.alpha + 0.15);
        ctx.arc(p.x, by, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // Observable contract — refreshed every frame so it can never lag what is
    // actually drawn (a strict superset of "whenever the drawn set changes").
    const rs = list.map((p) => p.r);
    const counts = [0, 0, 0, 0];
    for (const p of list) counts[p.band]++;
    const probe = sedProbeTx(drawn);
    const probeLayout = probe ? list.find((p) => p.tx.id === probe.id) : null;
    const el = ctx.canvas;
    el.dataset.sedParticles = String(list.length);
    el.dataset.sedBands = String(SED_BANDS);
    el.dataset.sedBandCounts = counts.join(",");
    el.dataset.sedRadiusMin = (rs.length ? Math.min(...rs) : 0).toFixed(2);
    el.dataset.sedRadiusMax = (rs.length ? Math.max(...rs) : 0).toFixed(2);
    if (probeLayout) {
      el.dataset.sedProbe = `${probeLayout.x.toFixed(2)},${probeLayout.y.toFixed(2)},${probeLayout.tx.id}`;
    } else {
      delete el.dataset.sedProbe;
    }
    el.setAttribute(
      "aria-label",
      truncated
        ? `Suspended-transaction depth field — ${list.length} of ${total} pending transactions, height by fee per byte, size by weight, colour by fee tier`
        : `Suspended-transaction depth field — ${list.length} pending transactions, height by fee per byte, size by weight, colour by fee tier`,
    );
  };

  const { ref } = useMemCanvas(draw);

  /* Pointer→canvas conversion comes from chart-kit's `canvasCursor`, never
     re-derived here. `verify-chartkit.mjs` keeps that math singular ("cursor
     math lives only in chart-kit") and it caught this file's first version
     doing its own; the rule is right, and the fix was to add the missing
     canvas primitive rather than waive it — every remaining v2 view is a canvas
     view and will need the same thing. */
  const onCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const at = canvasCursor(e);
    if (!w || !h || !at) return;
    const cx = at.x, cy = at.y;
    const list = sedLayout(drawn, w, h, maxPerB, maxSize, tiers, resolved.colors, resolved.fallback);
    let best: SedParticle | null = null, bestD = Infinity;
    for (const p of list) {
      const d = Math.hypot(p.x - cx, p.y - cy);
      const hitR = Math.max(p.r + 3, 6); // generous tap target beyond the visual radius
      if (d <= hitR && d < bestD) { bestD = d; best = p; }
    }
    if (best) onPickTx(best.tx.id);
  };

  // "you are here" marker for a tracked PENDING tx — a DOM overlay, not
  // canvas-painted, so it can carry data-tracked-tx (the cross-view highlight
  // idiom every other mempool surface uses). Only shown when the tracked tx
  // is actually in the drawn set — a marker for a tx the 320-cap dropped
  // would point at a particle that isn't there.
  const trackedTx = trackedTxId ? drawn.find((t) => t.id === trackedTxId) ?? null : null;
  // ONE WIDTH, TWO SOURCES — known, cosmetic, deliberately not "fixed" here.
  // The hit-test above lays out against `canvas.clientWidth` (MEASURED, integer-
  // rounded); this marker lays out against `hostWidth - AXIS_GUTTER` (COMPUTED,
  // fractional). They are the same quantity — the canvas is styled
  // `width: calc(100% - AXIS_GUTTER px)` — derived two ways, so they can differ
  // by up to a pixel and put the "you are here" ring up to a pixel off the
  // particle it marks. Written down rather than left as a surprise: it is the
  // two-sources-for-one-number shape, and the durable fix is to measure the
  // canvas once and pass that width to both.
  const markerW = Math.max(1, hostWidth - AXIS_GUTTER);
  const markerLayout = trackedTx ? sedLayout([trackedTx], markerW, hostHeight, maxPerB, maxSize, tiers, resolved.colors, resolved.fallback)[0] : null;

  return (
    <>
      <canvas
        ref={ref}
        className="mem-canvas"
        role="img"
        aria-label="Suspended-transaction depth field"
        style={{ width: `calc(100% - ${AXIS_GUTTER}px)` }}
        onClick={onCanvasClick}
      />
      {markerLayout ? (
        <div
          aria-hidden
          data-tracked-tx={trackedTx!.id}
          style={{
            position: "absolute", left: markerLayout.x - 8, top: markerLayout.y - 8, width: 16, height: 16,
            borderRadius: "50%", border: "1.5px solid var(--y-50)", pointerEvents: "none",
            boxShadow: "0 0 10px var(--y-50)",
          }}
        />
      ) : null}
    </>
  );
}

/** Reduced-motion fallback for a ≥8-tx pool. Same `sedLayout`, so the read is
 *  literally the same field — just not mounted as a canvas and not animated.
 *  Decorative circles are mouse-clickable (parity with the field) but not
 *  individually keyboard-focusable: 320 tab stops would be a worse
 *  accessibility outcome than the `table` slot MemViewShell already renders
 *  as the keyboard-operable equivalent for this state. */
function SedStaticField({ drawn, maxPerB, maxSize, tiers, truncated, total, width, height, trackedTxId, onPickTx }: {
  drawn: Tx[]; maxPerB: number; maxSize: number; tiers: number[]; truncated: boolean; total: number;
  width: number; height: number; trackedTxId: string | null; onPickTx: (id: string) => void;
}) {
  const w = Math.max(1, width - AXIS_GUTTER);
  const list = sedLayout(drawn, w, height, maxPerB, maxSize, tiers, SED_TIER_TOKENS, SED_TIER_FALLBACK);
  const label = truncated
    ? `Suspended-transaction depth field, static — ${list.length} of ${total} pending transactions`
    : `Suspended-transaction depth field, static — ${list.length} pending transactions`;
  return (
    <svg
      width={w} height={height} viewBox={`0 0 ${w} ${height}`}
      style={{ display: "block" }} role="img" aria-label={label}
    >
      {[...list].sort((a, b) => b.band - a.band).map((p) => {
        const isTracked = trackedTxId != null && p.tx.id === trackedTxId;
        return (
          <circle
            key={p.tx.id} cx={p.x} cy={p.y} r={p.r} fill={p.color} opacity={isTracked ? 1 : p.alpha}
            data-tracked-tx={isTracked ? p.tx.id : undefined}
            stroke={isTracked ? "var(--y-50)" : undefined} strokeWidth={isTracked ? 1.5 : undefined}
            style={{ cursor: "pointer", filter: isTracked ? "drop-shadow(0 0 4px var(--y-50))" : p.band >= 2 ? `blur(${0.3 + p.band * 0.15}px)` : undefined }}
            onClick={() => onPickTx(p.tx.id)}
          />
        );
      })}
    </svg>
  );
}

/** Low-pool (<8 tx) fallback, both for motion and reduced motion — a labelled
 *  single-file column, "readable, not a dot". Sorted high-fee-first (same
 *  "high floats" reading as the field). Every drop opens the tx inspector, on
 *  click or Enter — the same rule the field's particles follow, just with
 *  individually addressable, keyboard-reachable rows because there are at
 *  most 7 of them. */
function SedColumnList({ txs, tiers, width, trackedTxId, onPickTx }: {
  txs: Tx[]; tiers: number[]; width: number; trackedTxId: string | null; onPickTx: (id: string) => void;
}) {
  const sorted = [...txs].sort((a, b) => b.perB - a.perB);
  const maxPerB = Math.max(...sorted.map((t) => t.perB), 1);
  return (
    <div style={{ width, height: "100%", minHeight: 180, display: "flex", flexDirection: "column", justifyContent: sorted.length ? "flex-start" : "center", gap: "var(--sp-2)", padding: "var(--sp-3) 0", overflowY: "auto" }}>
      {sorted.length ? sorted.map((t) => {
        const frac = t.perB / maxPerB;
        const isTracked = trackedTxId != null && t.id === trackedTxId;
        return (
          <div
            key={t.id}
            data-sed-drop={t.id}
            data-tracked-tx={isTracked ? t.id : undefined}
            role="button"
            tabIndex={0}
            onClick={() => onPickTx(t.id)}
            onKeyDown={onEnterKey(() => onPickTx(t.id))}
            style={{
              display: "grid", gridTemplateColumns: "14px 1fr auto", alignItems: "center",
              gap: "var(--sp-2)", cursor: "pointer", fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)",
              padding: "var(--sp-1) var(--sp-2)",
              border: isTracked ? "1px solid var(--y-50)" : "1px solid var(--line)", borderRadius: 3,
              background: "var(--surface-sunk)",
              boxShadow: isTracked ? "0 0 10px color-mix(in srgb, var(--y-50) 45%, transparent)" : undefined,
            }}
          >
            <span aria-hidden style={{ width: 10, height: 10, borderRadius: "50%", background: sedTierToken(t.perB, tiers), justifySelf: "center", boxShadow: `0 0 6px ${sedTierToken(t.perB, tiers)}` }} />
            <span style={{ color: isTracked ? "var(--y-50)" : "var(--ink-100)" }}>{ShortHash(t.id)} <span className="dim2">· {fmtBytes(t.size)}</span></span>
            <span className="acc" style={{ textAlign: "right", minWidth: 70, opacity: isTracked ? 1 : 0.4 + frac * 0.6 }}>{Math.round(t.perB).toLocaleString()} p/B</span>
          </div>
        );
      }) : (
        <div className="mono dim" style={{ textAlign: "center", fontSize: "var(--fs-mono)" }}>mempool empty</div>
      )}
    </div>
  );
}

/** minimum comfortable per-stratum band — one line of --fs-label text plus a
 *  little breathing room, so a strata list with plenty of blocks never
 *  crushes below legibility even if the flex column above claimed most of
 *  the available height. */
const SED_STRATUM_MIN_H = 18;
const SED_STRATUM_GAP = 2;

/** The core column's DOM strata: confirmed blocks below the meniscus. Kept as
 *  discrete, individually clickable/keyboard-focusable divs in every mode
 *  (field/static/column) — a canvas can't cheaply give 12 regions a label,
 *  a role and a keyboard handler each.
 *
 *  Self-measures its own FLEX-allocated height (ResizeObserver on its own
 *  wrapper) rather than taking a hardcoded pixel height — the wrapper is a
 *  `flex: 2 1 0` child in SedCoreColumn, so its size is whatever the row
 *  actually gives it, and per-stratum height is a proportional share of
 *  that (weighted by tx count, floored at SED_STRATUM_MIN_H so text stays
 *  legible even when 12 blocks share a short row). */
function SedStrata({ data, tracking, onPickBlock }: {
  data: MoneroLive; tracking: Tracking; onPickBlock: (h: number) => void;
}) {
  const blocks = data.blocks.slice(0, 12);
  const trackedHeight = tracking?.kind === "tx" ? (tracking.blockHeight ?? null) : tracking?.kind === "block" ? tracking.height : null;
  const trackedTxId = tracking?.kind === "tx" ? tracking.id : null;

  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [wrapH, setWrapH] = React.useState(260);
  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWrapH(el.clientHeight || 260));
    ro.observe(el);
    setWrapH(el.clientHeight || 260);
    return () => ro.disconnect();
  }, []);

  const n = blocks.length;
  const avail = Math.max(0, wrapH - SED_STRATUM_GAP * Math.max(0, n - 1));
  const totalTxs = blocks.reduce((a, b) => a + b.txs, 0) || 1;
  let cursor = 0;
  const strata = blocks.map((b, i) => {
    const proportional = n ? (b.txs / totalTxs) * avail : 0;
    const stratH = Math.max(SED_STRATUM_MIN_H, proportional);
    const top = cursor;
    cursor += stratH + SED_STRATUM_GAP;
    return { b, i, top, stratH };
  });
  return (
    <div ref={wrapRef} style={{ position: "relative", height: "100%", minHeight: 0 }}>
      {strata.map(({ b, i, top, stratH }) => {
        const isTracked = trackedHeight != null && b.height === trackedHeight;
        return (
          <div
            key={b.height}
            data-sed-stratum={b.height}
            data-tracked-block={isTracked ? b.height : undefined}
            data-tracked-tx={isTracked ? trackedTxId ?? undefined : undefined}
            role="button"
            tabIndex={0}
            onClick={() => onPickBlock(b.height)}
            onKeyDown={onEnterKey(() => onPickBlock(b.height))}
            style={{
              position: "absolute", left: 0, right: 0, top, height: stratH, cursor: "pointer",
              background: `linear-gradient(180deg, color-mix(in srgb, var(--accent-structural) ${Math.round((0.55 - i * 0.04) * 100)}%, transparent) 0%, color-mix(in srgb, var(--accent-structural-dim) ${Math.round((0.85 - i * 0.05) * 100)}%, transparent) 100%)`,
              borderTop: isTracked ? "2px solid var(--y-50)" : (i === 0 ? "1px solid color-mix(in srgb, var(--accent-structural) 85%, transparent)" : "1px solid color-mix(in srgb, var(--accent-structural-dim) 40%, transparent)"),
              borderBottom: "1px solid color-mix(in srgb, var(--accent-structural-dim) 60%, transparent)",
              boxShadow: isTracked ? "0 0 18px var(--y-50)" : (i === 0 ? "0 0 22px color-mix(in srgb, var(--accent-structural) 50%, transparent)" : "none"),
              display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 var(--sp-2)",
              fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)",
              color: i < 3 ? "var(--bg-0)" : "color-mix(in srgb, var(--bg-0) 80%, transparent)", fontWeight: 600,
            }}
          >
            <span>#{b.height.toLocaleString()}</span>
            {isTracked && tracking ? <TrackChip tracking={tracking} data={data} /> : <span style={{ opacity: 0.72 }}>{b.txs}tx · {b.conf}c</span>}
          </div>
        );
      })}
    </div>
  );
}

function SedCoreColumn({ data, tracking, onPickTx, onPickBlock }: SedFieldProps & { onPickBlock: (h: number) => void }) {
  const reduced = useReducedMotion();
  const allTxs = data.mempool;
  const { drawn, truncated } = sedSelectField(allTxs);
  const maxPerB = Math.max(...drawn.map((t) => t.perB), 1);
  const maxSize = Math.max(...drawn.map((t) => t.size), 1);
  const lowPool = allTxs.length < 8;
  const mode: "field" | "column" | "static" = lowPool ? "column" : reduced ? "static" : "field";
  // A tracked CONFIRMED tx is marked on its stratum (SedStrata); a tracked
  // PENDING one (still in the mempool) is marked here, in whichever of the
  // three field idioms is showing — same "you are here" convention every
  // other mempool surface uses (data-tracked-tx).
  const trackedTxId = tracking?.kind === "tx" && tracking.blockHeight == null ? tracking.id : null;

  // The field area is measured, both dimensions — not a fixed FIELD_H. The
  // core column is a `height:"100%"` CSS Grid item in a `align-items:stretch`
  // row (SedOverview), so it naturally matches the right-hand panel stack's
  // rendered height with zero JS measurement of the SIBLING — that part is
  // free. What still needs measuring is how THIS column's own flexible
  // regions (field vs strata) divide up whatever height the grid handed it,
  // because canvas/SVG geometry (sedLayout, SedFeeAxis) needs real pixel
  // numbers, not a CSS ratio.
  const [fieldW, setFieldW] = React.useState(320);
  const [fieldH, setFieldH] = React.useState(260);
  const areaRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const measure = () => {
      setFieldW(el.clientWidth || 320);
      setFieldH(el.clientHeight || 260);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  return (
    <div data-sed-core data-sed-mode={mode} style={{ position: "relative", height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}>
      {/* mouth annotation — an incoming-mempool label. If it names Dandelion++
          stem/fluff at all it must say so is illustration (contract §6): a
          node cannot observe another transaction's stem, so relay-style
          propagation is drawn, never measured. */}
      <div style={{ flex: "0 0 auto", textAlign: "center", marginBottom: "var(--sp-1)", fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)", letterSpacing: "0.18em", color: "var(--ink-40)" }}>
        ▼ INCOMING MEMPOOL
        <span className="dim2" style={{ marginLeft: "var(--sp-2)", letterSpacing: "0.04em", textTransform: "none" }}>
          stem → fluff illustrated, not observed
        </span>
      </div>

      {/* The particle field is the primary subject of the core column, so it
          gets the larger flex-grow share (3 of 5) against the strata's 2 of
          5 — both are `flex: N 1 0` growable regions, never a hardcoded
          height, so the split scales with whatever total height the grid
          stretch hands this column. minHeight is a floor for a pathologically
          short row, not the normal case. */}
      <div ref={areaRef} style={{ flex: "3 1 0", minHeight: 180, minWidth: 0, position: "relative", border: "1px solid color-mix(in srgb, var(--accent-structural) 32%, transparent)", borderRadius: "4px 4px 0 0", background: "linear-gradient(180deg, color-mix(in srgb, var(--bg-0) 60%, transparent) 0%, color-mix(in srgb, var(--accent-structural) 4%, transparent) 52%, color-mix(in srgb, var(--accent-structural) 7%, transparent) 100%)" }}>
        {mode === "field" ? (
          <SedParticleField drawn={drawn} maxPerB={maxPerB} maxSize={maxSize} tiers={data.feeTiers} truncated={truncated} total={allTxs.length} trackedTxId={trackedTxId} hostWidth={fieldW} hostHeight={fieldH} onPickTx={onPickTx} />
        ) : mode === "static" ? (
          <SedStaticField drawn={drawn} maxPerB={maxPerB} maxSize={maxSize} tiers={data.feeTiers} truncated={truncated} total={allTxs.length} width={fieldW} height={fieldH} trackedTxId={trackedTxId} onPickTx={onPickTx} />
        ) : (
          <SedColumnList txs={allTxs} tiers={data.feeTiers} width={fieldW} trackedTxId={trackedTxId} onPickTx={onPickTx} />
        )}
        {mode !== "column" ? (
          <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: AXIS_GUTTER }}>
            {/* HTML label, not SVG text — see SedFeeAxis's own comment: this
                is what keeps the unit caption out of scenario 6's SVG-<text>
                collision sweep entirely, rather than merely repositioning it
                into a smaller version of the same risk. */}
            <span style={{ position: "absolute", top: 0, right: 2, fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)", color: "var(--ink-40)", letterSpacing: "0.06em" }}>p/B</span>
            <SedFeeAxis maxPerB={maxPerB} height={fieldH} width={AXIS_GUTTER} />
          </div>
        ) : null}
      </div>

      {/* meniscus */}
      <div style={{ flex: "0 0 auto", height: 4, margin: "0 0 var(--sp-1)", background: "linear-gradient(to right, transparent, color-mix(in srgb, var(--accent-structural) 85%, transparent), transparent)", boxShadow: "0 0 14px var(--tk-accent)" }} />
      <div style={{ flex: "0 0 auto", textAlign: "center", fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)", color: "var(--tk-accent)", letterSpacing: "0.12em", marginBottom: "var(--sp-1)" }}>CONFIRMATION INTERFACE</div>

      <div style={{ flex: "2 1 0", minHeight: 120, minWidth: 0 }}>
        <SedStrata data={data} tracking={tracking} onPickBlock={onPickBlock} />
      </div>
    </div>
  );
}

/* ── grain-size scatter — fee/B vs weight ────────────────────────────────
   Hand-rolled, justified (Rev 2 §3): a 2-D scatter isn't a `charts.tsx`
   series (those plot one value per discrete sample along an x-axis), so
   there's no series component to defer to. AXIS/GRID/tickCount and the
   cursor/crosshair/tooltip primitives still come from chart-kit; only the
   "nearest point" search is local, because chart-kit's nearestIndex assumes
   evenly-spaced samples along one axis and a scatter's x is continuous. */
export function SedGrainScatter({ data, onPickTx }: { data: MoneroLive; onPickTx: (id: string) => void }) {
  // padL widened 34 -> 46 alongside the fontSize fix below: a 6-digit p/B
  // tick at the repo's real 11px floor needs ~41px of label width
  // (estTextW(6,11)), which didn't fit the old 34px gutter either — it was
  // already tight at the previous shrunk size and would now clip.
  const W = 300, H = 188, padL = 46, padR = 12, padT = 14, padB = 26;
  const iw = W - padL - padR, ih = H - padT - padB;
  const pts = data.mempool.slice(0, 80);
  const maxFee = Math.max(...pts.map((t) => t.perB), 1);
  const maxSz = Math.max(...pts.map((t) => t.size), 1);
  // STANDARDS CONFLICT, reported per Rev 2 §6 and named precisely:
  // `--fs-label` (styles-legibility.css:23, `clamp(11px, 0.74vw, 12px)`) is
  // the repo's deliberate v6.0.10 floor, 11px at every viewport below
  // ~1486px; the v6 prompt series asserts 12px instead. This axis renders at
  // `var(--fs-label)` — the repo-floor side — rather than a number this PR
  // invents, so it tracks the token. Resolving the 11-vs-12 disagreement is
  // not this PR's job. It previously rendered at 9.02px via a silent *0.82
  // shrink (before that, a literal fontSize="8"), below either candidate
  // floor — THAT was the defect.
  //
  // `fontPx` below is `FS_FALLBACK.tick` (11) used ONLY for the tick-fitting
  // ARITHMETIC (tickCount/estTextW-style budgeting) — it mirrors a different
  // token, `--fs-chart-tick`, that is not itself part of this dispute. The
  // rendered fontSize is the separate `axisFontSize` constant below, tied to
  // `--fs-label` — the two are kept apart on purpose: one is a plain number
  // JS math needs, the other is the CSS value that actually paints.
  const fontPx = FS_FALLBACK.tick;
  const axisFontSize = "var(--fs-label)";
  const yTickN = tickCount(ih, fontPx);
  const xTickN = Math.min(4, tickCount(iw, fontPx * 2.4));
  const yTicks = Array.from({ length: yTickN }, (_, i) => (maxFee * i) / Math.max(1, yTickN - 1));
  const xTicks = Array.from({ length: xTickN }, (_, i) => (maxSz * i) / Math.max(1, xTickN - 1));
  const [svgRef, vx] = useSvgCursor(W);

  let hover: Tx | null = null;
  if (vx != null) {
    let bestD = Infinity;
    for (const t of pts) {
      const x = padL + (t.size / maxSz) * iw;
      const d = Math.abs(x - vx);
      if (d < bestD) { bestD = d; hover = t; }
    }
  }

  return (
    <PanelFrame title="Grain-size analysis" right={<span className="dim">fee/B × weight</span>} dataKey="mempool" updatedAt={oldestFreshAt(data.status, ["mempool"])}>
      {pts.length ? (
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", touchAction: "pan-y" }}
          onPointerMove={(e) => { const el = svgRef.current; if (!el) return; }}>
          {yTicks.map((v, i) => {
            const y = padT + ih - (maxFee > 0 ? v / maxFee : 0) * ih;
            return (
              <g key={"y" + i}>
                <line x1={padL} x2={W - padR} y1={y} y2={y} stroke={GRID} strokeDasharray="2 3" />
                <text x={padL - 4} y={y + 3} textAnchor="end" fontFamily="var(--f-mono)" fontSize={axisFontSize} fill={AXIS}>{Math.round(v)}</text>
              </g>
            );
          })}
          {xTicks.map((v, i) => {
            const x = padL + (maxSz > 0 ? v / maxSz : 0) * iw;
            return <text key={"x" + i} x={x} y={H - 6} textAnchor="middle" fontFamily="var(--f-mono)" fontSize={axisFontSize} fill={AXIS}>{fmtBytes(v)}</text>;
          })}
          <line x1={padL} y1={padT} x2={padL} y2={padT + ih} stroke={AXIS} strokeWidth="1" />
          <line x1={padL} y1={padT + ih} x2={W - padR} y2={padT + ih} stroke={AXIS} strokeWidth="1" />
          {pts.map((t) => {
            const x = padL + (t.size / maxSz) * iw;
            const y = padT + ih - (t.perB / maxFee) * ih;
            const isHover = hover === t;
            return (
              <circle key={t.id} cx={x} cy={y} r={isHover ? 3.6 : 2 + (t.size / maxSz) * 2.2}
                fill={sedTierToken(t.perB, data.feeTiers)} opacity={isHover ? 1 : 0.4 + (t.perB / maxFee) * 0.5}
                style={{ cursor: "pointer" }} onClick={() => onPickTx(t.id)} />
            );
          })}
          {hover ? (() => {
            const hx = padL + (hover.size / maxSz) * iw;
            return (
              <>
                <ChartCrosshair x={hx} y1={padT} y2={padT + ih} />
                <ChartTip x={hx} bounds={{ left: padL, right: W - padR }}
                  rows={[{ label: "wt", value: fmtBytes(hover.size) }, { label: "fee/B", value: Math.round(hover.perB).toLocaleString() }]} />
              </>
            );
          })() : null}
        </svg>
      ) : (
        <div className="mono dim" style={{ padding: "var(--sp-5)", textAlign: "center", fontSize: "var(--fs-mono)" }}>mempool empty</div>
      )}
    </PanelFrame>
  );
}

/* ── ring-16 anonymity fan ───────────────────────────────────────────────
   An ILLUSTRATION of Monero's fixed ring-16 structure (contract §6: any
   inferred element says so) — not a reading of any specific tx's real
   decoys, so it carries no NodeProvenance badge and its own copy says
   "illustrated" rather than reading as a fact about this pool. */
function SedRingFan() {
  const reduced = useReducedMotion();
  const N = 16, cx = 100, cy = 96, r = 74;
  return (
    <PanelFrame
      title="Ring · 16 anonymity"
      right={<span className="dim" title="Illustration of Monero's fixed ring-16 structure — not decoy data for any specific transaction in this pool.">1 real · 15 decoys · illustrated</span>}
    >
      <svg width="100%" viewBox="0 0 200 188" style={{ display: "block" }}>
        <defs>
          <radialGradient id="sed-ringpulse"><stop offset="0%" stopColor="var(--accent-structural)" stopOpacity="0.55" /><stop offset="100%" stopColor="var(--accent-structural)" stopOpacity="0" /></radialGradient>
          <linearGradient id="sed-ringline" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="var(--accent-structural)" stopOpacity="0.05" /><stop offset="60%" stopColor="var(--accent-structural)" stopOpacity="0.5" /><stop offset="100%" stopColor="var(--accent-structural)" stopOpacity="0.95" /></linearGradient>
        </defs>
        {/* D0651: SMIL <animate> dur is XML, not CSS — it cannot consume a
            var() token, here or anywhere else in src. Reported, not tokenised. */}
        <circle cx={cx} cy={cy} r="50" fill="url(#sed-ringpulse)">{reduced ? null : <animate attributeName="r" values="46;66;46" dur="3.4s" repeatCount="indefinite" />}</circle>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--accent-structural)" strokeOpacity={0.18} strokeDasharray="3 3" />
        {Array.from({ length: N }).map((_, i) => {
          const ang = (i / N) * Math.PI * 2 - Math.PI / 2;
          const x2 = cx + Math.cos(ang) * r, y2 = cy + Math.sin(ang) * r;
          const real = i === 11;
          return (
            <g key={i}>
              <line x1={cx} y1={cy} x2={x2} y2={y2} stroke={real ? "url(#sed-ringline)" : "var(--accent-structural-dim)"} strokeOpacity={real ? undefined : 0.15} strokeWidth={real ? 1.6 : 0.5} />
              <circle cx={x2} cy={y2} r={real ? 4 : 2.4} fill={real ? "var(--accent-structural)" : "var(--accent-structural-dim)"} fillOpacity={real ? undefined : 0.65} style={{ filter: `drop-shadow(0 0 ${real ? 4 : 2}px ${real ? "var(--accent-structural)" : "color-mix(in srgb, var(--accent-structural-dim) 60%, transparent)"})` }}>
                {real && !reduced ? <animate attributeName="opacity" values="0.4;1;0.4" dur="1.6s" repeatCount="indefinite" /> : null}
              </circle>
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r="6" fill="var(--accent-structural)" style={{ filter: "drop-shadow(0 0 5px var(--accent-structural))" }} />
      </svg>
    </PanelFrame>
  );
}

/* ── stratigraphy log — confirmed blocks as a scrollable depth log ──────── */
export function SedStrataLog({ data, tracking, onPickBlock }: { data: MoneroLive; tracking: Tracking; onPickBlock: (h: number) => void }) {
  const blocks = data.blocks.slice(0, BLOCKS_CAP);
  const maxTx = Math.max(...blocks.map((b) => b.txs), 1);
  const trackedHeight = tracking?.kind === "tx" ? (tracking.blockHeight ?? null) : tracking?.kind === "block" ? tracking.height : null;
  return (
    <PanelFrame
      title={"Stratigraphy log · " + blocks.length + " strata"}
      right={<><NodeProvenance source="node" keys={["blocks"]} status={data.status} /><span className="acc" style={{ marginLeft: "var(--sp-2)" }}>surface → unlock</span></>}
      dataKey="blocks"
      updatedAt={oldestFreshAt(data.status, ["blocks"])}
    >
      <BarSeries
        data={blocks.slice().reverse().map((b) => b.txs)}
        labels={blocks.slice().reverse().map((b) => "#" + b.height)}
        format={fmtTx}
        color="var(--tk-accent)"
        baseline="zero"
        height={150}
      />
      <div style={{ maxHeight: 300, overflowY: "auto", marginTop: "var(--sp-3)", display: "flex", flexDirection: "column", gap: 3 }}>
        {blocks.map((b, i) => {
          const isTracked = trackedHeight != null && b.height === trackedHeight;
          return (
            <div
              key={b.height}
              data-sed-stratum={b.height}
              data-tracked-block={isTracked ? b.height : undefined}
              role="button"
              tabIndex={0}
              onClick={() => onPickBlock(b.height)}
              onKeyDown={onEnterKey(() => onPickBlock(b.height))}
              style={{ display: "grid", gridTemplateColumns: "30px 80px 1fr 54px", gap: "var(--sp-2)", alignItems: "center", cursor: "pointer", fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)", opacity: isTracked ? 1 : Math.max(0.25, 0.9 - i * 0.05) }}
            >
              <span className="dim2" style={{ fontSize: "var(--fs-label)" }}>{i === 0 ? "TOP" : b.conf + "c"}</span>
              <span style={{ color: isTracked ? "var(--y-50)" : i === 0 ? "var(--tk-accent)" : "var(--ink-60)" }}>#{b.height.toLocaleString()}</span>
              <div style={{ height: 9, background: "var(--line-d)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: (b.txs / maxTx * 100).toFixed(0) + "%", background: isTracked ? "var(--y-50)" : `linear-gradient(90deg, color-mix(in srgb, var(--accent-structural-dim) ${Math.round((0.9 - i * 0.05) * 100)}%, transparent), color-mix(in srgb, var(--accent-structural) ${Math.round((0.85 - i * 0.05) * 100)}%, transparent))` }} />
              </div>
              <span className="dim" style={{ textAlign: "right" }}>{b.txs}tx</span>
            </div>
          );
        })}
      </div>
    </PanelFrame>
  );
}

/** 90th-percentile fee/B — derived locally, same as the (single) median
 *  implementation it sits beside. Never a fabricated constant: null over an
 *  empty pool. */
function p90PerB(txs: Tx[]): number | null {
  if (!txs.length) return null;
  const sorted = txs.map((t) => t.perB).sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * 0.9) - 1));
  return sorted[idx];
}

/* ── fee depth-profile: area (≥8 tx) / ladder (<8 tx) ────────────────────
   `data-sed-profile` lives on this wrapping div — PanelFrame has no generic
   data-* passthrough, so the host is the smallest element that both carries
   the attribute and contains the panel. */
export function SedFeeProfile({ data, onPickTx }: { data: MoneroLive; onPickTx: (id: string) => void }) {
  const ladder = data.mempool.length < 8;
  const fees = data.mempool.map((t) => t.perB).sort((a, b) => b - a); // high→low
  const sorted = [...data.mempool].sort((a, b) => b.perB - a.perB);
  const maxPerB = Math.max(...sorted.map((t) => t.perB), 1);
  return (
    <div data-sed-profile={ladder ? "ladder" : "area"}>
      <PanelFrame title="Fee depth-profile" right={<span className="dim">high → low p/B</span>} dataKey="mempool" updatedAt={oldestFreshAt(data.status, ["mempool"])}>
        {!sorted.length ? (
          <div className="mono dim" style={{ padding: "var(--sp-5)", textAlign: "center", fontSize: "var(--fs-mono)" }}>mempool empty</div>
        ) : ladder ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-1)" }}>
            {sorted.map((t) => {
              const w = (t.perB / maxPerB) * 100;
              return (
                <div key={t.id} onClick={() => onPickTx(t.id)}
                  style={{ display: "grid", gridTemplateColumns: "70px 1fr 90px", gap: "var(--sp-2)", alignItems: "center", cursor: "pointer", fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)" }}>
                  <span className="dim2">{ShortHash(t.id)}</span>
                  <div style={{ height: 8, background: "var(--line-d)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: w.toFixed(0) + "%", background: sedTierToken(t.perB, data.feeTiers) }} />
                  </div>
                  <span className="acc" style={{ textAlign: "right" }}>{Math.round(t.perB).toLocaleString()} p/B</span>
                </div>
              );
            })}
          </div>
        ) : (
          <AreaSeries data={fees} xLabels={false} markers baseline="zero" color="var(--tk-accent)" height={188} format={fmtPerB} />
        )}
      </PanelFrame>
    </div>
  );
}

/* ── live clearance trace — mempool depth over time ─────────────────────── */
export function SedClearance({ data }: { data: MoneroLive }) {
  const [series, setSeries] = React.useState(() => Array.from({ length: 48 }, () => data.mempool.length));
  React.useEffect(() => {
    setSeries((s) => [...s.slice(1), data.mempool.length]);
  }, [data.mempool.length]);
  const stats = useMemStats(data);
  const poolReady = hasData(data.status.network) && stats.txCount > 0;
  const p90 = poolReady ? p90PerB(data.mempool) : null;
  return (
    <PanelFrame title="Clearance rate" right={<NodeProvenance source="node" keys={["mempool", "network"]} status={data.status} />} dataKey="mempool network" updatedAt={oldestFreshAt(data.status, ["mempool", "network"])}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--sp-2)", marginBottom: "var(--sp-1)" }}>
        <span className="mono acc glow" style={{ fontSize: 24, fontWeight: 500 }}>{data.mempool.length}</span>
        <span className="mono dim" style={{ fontSize: "var(--fs-mono)" }}>tx suspended</span>
      </div>
      <AreaSeries data={series} height={84} color="var(--tk-accent)" baseline="zero" xLabels={false} markers={false} format={fmtRound} />
      <div className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--fs-label)", color: "var(--ink-40)", marginTop: "var(--sp-1)" }}>
        <span>median {poolReady ? Math.round(stats.medianPerB).toLocaleString() + " p/B" : "—"}</span>
        <span>P90 {poolReady && p90 != null ? Math.round(p90).toLocaleString() + " p/B" : "—"}</span>
        <span>next {hasData(data.status.network) ? <BlockEta data={data} /> : "—"}</span>
      </div>
    </PanelFrame>
  );
}

/* ── live tx feed ────────────────────────────────────────────────────────── */
export function SedTxFeed({ data, onPickTx }: { data: MoneroLive; onPickTx: (id: string) => void }) {
  const max = Math.max(...data.mempool.map((t) => t.perB), 1);
  const rows = data.mempool.slice(0, 12);
  return (
    <PanelFrame
      title={"Suspended transactions · " + rows.length + " of " + data.mempool.length}
      right={<><NodeProvenance source="node" keys={["mempool"]} status={data.status} /><span className="acc" style={{ marginLeft: "var(--sp-2)" }}>sorted by depth</span></>}
      dataKey="mempool"
      updatedAt={oldestFreshAt(data.status, ["mempool"])}
    >
      <div className="mono" style={{ display: "grid", gridTemplateColumns: "1.5fr 80px 110px 96px 1fr 60px", gap: "var(--sp-2)", fontSize: "var(--fs-label)", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-40)", padding: "0 var(--sp-2) var(--sp-1)", borderBottom: "1px solid var(--rule)" }}>
        <span>TXID</span><span>Size</span><span>Fee · XMR</span><span>Fee/B</span><span>Depth</span><span>Age</span>
      </div>
      {rows.map((t) => {
        const depth = 1 - t.perB / max;
        return (
          <div key={t.id} onClick={() => onPickTx(t.id)} style={{ display: "grid", gridTemplateColumns: "1.5fr 80px 110px 96px 1fr 60px", gap: "var(--sp-2)", fontSize: "var(--fs-mono)", padding: "var(--sp-2) var(--sp-2)", borderBottom: "1px solid var(--line-d)", cursor: "pointer", fontFamily: "var(--f-mono)", alignItems: "center" }}>
            <span style={{ color: "var(--c-50)" }}>{ShortHash(t.id)}</span>
            <span className="dim">{fmtBytes(t.size)}</span>
            <span className="acc">{t.fee.toFixed(7)}</span>
            <span className="dim">{Math.round(t.perB).toLocaleString()}</span>
            <div style={{ height: 6, background: "var(--line)", borderRadius: 3, overflow: "hidden", alignSelf: "center" }}>
              <div style={{ height: "100%", width: ((1 - depth) * 100).toFixed(0) + "%", background: "var(--tk-accent)" }} />
            </div>
            <span className="dim2">{fmtAgeS(t.age)}</span>
          </div>
        );
      })}
    </PanelFrame>
  );
}

export function SedOverview({ data, tracking, onPickTx, onPickBlock }: { data: MoneroLive; tracking: Tracking; onPickTx: (id: string) => void; onPickBlock: (h: number) => void }) {
  return (
    <div style={{ padding: "var(--sp-4) 20px 40px", display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
      {/* the core column is the HERO: ~5 of 12 columns AND full row height —
          `alignItems: "stretch"` (CSS Grid's default, stated explicitly here
          because it is load-bearing) makes this column match the right-hand
          panel stack's rendered height with zero JS measurement of its
          sibling. Width alone ("5 of 12") is not "the room" the brief asked
          for; a wide-but-short strip reads as a confetti band, not a core
          sample — depth needs vertical room to look like depth. */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: "var(--sp-4)", alignItems: "stretch" }}>
        <div style={{ gridColumn: "span 5", minHeight: 0 }}>
          <SedCoreColumn data={data} tracking={tracking} onPickTx={onPickTx} onPickBlock={onPickBlock} />
        </div>
        <div style={{ gridColumn: "span 7", minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
          <PanelFrame title="How to read this core">
            <div style={{ fontFamily: "var(--f-serif)", fontSize: 17, lineHeight: 1.34, color: "var(--ink-100)", marginBottom: "var(--sp-2)" }}>A cross-section of the mempool, drawn as a sample column.</div>
            <div style={{ fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)", color: "var(--ink-60)", lineHeight: 1.55 }}>
              Each <span className="acc">particle</span> is one pending transaction — its <em style={{ color: "var(--ink-100)", fontStyle: "normal" }}>height</em> tracks fee-per-byte and its <em style={{ color: "var(--ink-100)", fontStyle: "normal" }}>size</em> tracks weight. The bright band is the <span className="acc">confirmation interface</span>; strata below are confirmed blocks, brightest at the surface, fading toward <span className="dim">{CONF_UNLOCK}-deep unlock</span>.
            </div>
          </PanelFrame>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-3)" }}>
            <SedGrainScatter data={data} onPickTx={onPickTx} />
            <SedRingFan />
          </div>
          <SedClearance data={data} />
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-3)" }}>
        <SedStrataLog data={data} tracking={tracking} onPickBlock={onPickBlock} />
        <SedFeeProfile data={data} onPickTx={onPickTx} />
      </section>

      <SedTxFeed data={data} onPickTx={onPickTx} />
    </div>
  );
}

export function SedimentView({ data }: ViewProps) {
  const { tracking, onSearch, clearTracking } = useMempoolTracking(data);
  const onPickTx = (id: string) => onSearch({ kind: "tx", id, blockHeight: null });
  const onPickBlock = (h: number) => onSearch({ kind: "block", height: h });
  return (
    <div className="main" style={{ overflow: "auto", padding: 0 }}>
      <MemViewShell
        id="sediment"
        table={<MemTxTable data={data} tracking={tracking} viewId="sediment" columns={["txid", "perB", "tier", "size", "age"]} onPickTx={(id) => onSearch({ kind: "tx", id })} />}
        data={data}
        tracking={tracking}
        onSearch={onSearch}
        onClearTracking={clearTracking}
      >
        <SedOverview data={data} tracking={tracking} onPickTx={onPickTx} onPickBlock={onPickBlock} />
      </MemViewShell>
    </div>
  );
}
