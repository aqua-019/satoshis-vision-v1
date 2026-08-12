// mempool/bridge-instruments.tsx — the Ops Bridge's two INSTRUMENTS, and the
// vocabulary its panels share with them.
//
// Split out of bridge.tsx because that file crossed verify-memshell's 200–1084
// line band (1265) and the gate's own failure text names the remedy: "over the
// ceiling — split it". The seam is the one the code already had — an instrument
// owns a coordinate system and, for the radar, a rAF loop; a panel owns a
// composition and a provenance claim. Every other verify-memshell check
// (Math.random, useTick, ctx.shadowBlur, the .mem-canvas contract) walks
// src/mempool/** rather than one file, so nothing but the line count changes
// scope. bridge.tsx is 870 lines after this and this file is 348; the VIEW is
// 1218, and the PR body states both rather than reporting the split as a
// shrink of the composition.
//
// Imports one-directionally: bridge.tsx imports from here, never the reverse.
import * as React from "react";
import { observeDrawable } from "@/design/usePageActive";
import { AXIS, GRID } from "@/design/chart-kit";
import { useChartMetrics, spreadLabels } from "@/design/useChartMetrics";
import { shortHash as ShortHash } from "@/data/types";
import type { MoneroLive, Tx } from "@/data/types";
import { hashToUnit, FEE_TIER_LABELS, feeTierIndex } from "@/data/map";

/** Fee-tier ramp, index-aligned with FEE_TIER_LABELS (slow…fastest), mapped
 *  through contract §4's table. Was `[c-50, g-50, y-50, r-50]`: green and red
 *  are the semantic status colours here (`--status-up` / `--status-down`), so a
 *  NORMAL tx reading green and a FASTEST one reading red was a fee rate wearing
 *  an alert's clothes. Console chips, radar blips and scope share this array. */
export const TIER_COLORS = ["var(--c-50)", "var(--o-60)", "var(--o-80)", "var(--y-50)"] as const;

/** Radar artboard in CSS px — CAPPED rather than square-to-its-column, and
 *  derived from the row rather than chosen: sized to the c5 body (~445px) it
 *  made the hero row 557 against a right column of 366, i.e. 191px of dead
 *  column — the mockup's own ~450px defect reproduced. At 330 the row lands
 *  471 and the stretched alert tape fills the remainder exactly. */
export const RADAR_PX = 330;

/** Half-gutter between the radar's vertical axis and a ring label. Tier labels
 *  live to the right of it, the inferred-cut label to the left, which is what
 *  makes their non-overlap structural rather than measured. */
export const LBL_GUTTER = 10;

export interface BrgCut {
  /** the pool, fee-sorted richest → cheapest */
  sorted: Tx[];
  /** index of the first tx that does NOT fit under the weight ceiling, or null
   *  when the node has reported no ceiling yet */
  cutIndex: number | null;
  /** fee rate at the cut, or null */
  cutPerB: number | null;
  /** cumulative weight consumed up to the cut */
  cumAtCut: number;
  /** the ceiling used — the node's median block weight, else its hard limit */
  limit: number;
}

/**
 * A fee-sorted walk of the pool against the node's own per-block weight
 * ceiling. INFERRED (§6), labelled so wherever it is rendered: a miner's real
 * template is unobservable here and miners may order by anything. What IS
 * observable is the pool, each tx's weight and the ceiling — the same
 * derivation reactor's next-block cut panel makes. `limit` is 0, and every
 * consumer an em-dash, until the node reports a weight; never a guessed 300000.
 */

/* ──────────────────────────────────────────────────────────────
   PPI RADAR — range is FEE/BYTE
   ────────────────────────────────────────────────────────────── */

/** Compact piconero/byte, the mockup's own vocabulary: 20000 → "20k". `fmtN`
 *  renders that as "20.00K" — two characters longer, and a precision no
 *  instrument axis here has. */
export const fmtFeeK = (v: number): string =>
  v >= 1000 ? `${Math.round(v / 1000).toLocaleString()}k` : `${Math.round(v)}`;

/**
 * RANGE IS FEE RANK, MAPPED EQUAL-AREA — `r = R·√(rank/N)`, richest at centre.
 *
 * The first implementation mapped the fee VALUE logarithmically and RENDERING
 * it is what killed it: fee rates are not log-uniform, so on the gate fixture
 * (uniform in LINEAR space over [15k, 915k]) everything above the median 465k
 * fell inside r/R = 0.23 — half the pool as one clump, the outer two-thirds
 * empty. Rank is uniform BY CONSTRUCTION at any pool composition, and the
 * square root turns "uniform in rank" into "uniform in AREA", the only mapping
 * under which blip density means the same thing at every radius. It also makes
 * the cut ring exact: the area it encloses IS the fraction of the pool that
 * fits in the next block.
 */
export const brgRankRadius = (rank: number, n: number, R: number): number =>
  n > 0 ? Math.sqrt((rank + 0.5) / n) * R : 0;

export function BrgRadar({ data, cut, trackedId }: { data: MoneroLive; cut: BrgCut; trackedId?: string | null }) {
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const m = useChartMetrics(wrapRef);
  // FLUID: one user unit is one CSS px, so the 11px ring labels really are 11px
  // (contract §2). Falls back to the cap before the first measure rather than
  // to VB_W's 1000, which would make the pre-measure frame 2.7x too big.
  const W = Math.min(RADAR_PX, m.w || RADAR_PX);
  const cx = W / 2, cy = W / 2, R = W / 2 - 18;

  const { blips, rings, cutRing, span: rangeSpan } = React.useMemo(() => {
    const empty = { blips: [] as { id: string; ang: number; r: number; color: string }[], rings: [] as { r: number; y: number; label: string }[], cutRing: null as { r: number; y: number } | null, span: null };
    const sorted = cut.sorted;                       // fee-sorted, richest first
    const n = sorted.length;
    if (n < 2) return empty;
    const hi = sorted[0].perB, lo = sorted[n - 1].perB;
    if (!(hi > lo)) return empty;

    // THE WHOLE POOL, not slice(0, 60). The radar's claim is "this is the
    // mempool"; showing a sixtieth of it made that claim false at any real
    // pool depth. Iterating `sorted` makes the array index the fee RANK, which
    // is the radial coordinate.
    const blips = sorted.map((t, rank) => {
      const tier = feeTierIndex(t.perB, data.feeTiers);
      return {
        id: t.id,
        ang: hashToUnit(t.id) * Math.PI * 2,
        r: brgRankRadius(rank, n, R),
        color: tier >= 0 ? TIER_COLORS[tier] : "var(--ink-40)",
      };
    });

    /* RINGS SIT AT FIXED QUANTILES AND CARRY LIVE VALUES — the one place this
       composition departs from the brief, which asked for rings at the live
       FEE-TIER values. Rendered, that does not work: under a rank radius a
       tier's ring sits at that tier's QUANTILE, so the three tiers inside the
       fixture's range landed at radii 146.4, 141.4 and 118.9 — two of them 5px
       apart, all three in the outer fifth, the interior unlabelled. Fixed
       quantiles invert the dependency: the RADII are constants (√.25/.50/.75 →
       0.50/0.71/0.87 R, ~23px apart), so non-overlap is structural, and the
       LABEL is the live rate at that point in the pool plus its tier. Nothing
       is hard-coded, which is what the brief's instruction protects. */
    const rings = [0.25, 0.5, 0.75].map((q) => {
      const rank = Math.min(n - 1, Math.round(q * n));
      const perB = sorted[rank].perB;
      const tier = feeTierIndex(perB, data.feeTiers);
      return {
        r: Math.sqrt(q) * R,
        y: cy - Math.sqrt(q) * R + 4,
        label: `${fmtFeeK(perB)}${tier >= 0 ? " " + FEE_TIER_LABELS[tier] : ""}`,
      };
    });
    // Belt and braces: the radii above cannot collide, but `spreadLabels` is
    // the repo's existing 1-D separator and costs nothing to keep in the path,
    // so a future ring set cannot reintroduce the defect silently.
    const ys = spreadLabels(rings.map((g) => g.y), 15, 12, cy - 6);
    const laid = rings.map((g, i) => ({ ...g, y: ys[i] }));

    const cutRing = cut.cutIndex != null && cut.cutIndex > 0 && cut.cutIndex < n
      ? { r: brgRankRadius(cut.cutIndex, n, R), y: cy - brgRankRadius(cut.cutIndex, n, R) + 4 }
      : null;
    return { blips, rings: laid, cutRing, span: { lo, hi } };
  }, [cut.sorted, cut.cutIndex, data.feeTiers, R, cy]);

  const trackedIdx = React.useMemo(
    () => (trackedId ? blips.findIndex((b) => b.id === trackedId) : -1),
    [blips, trackedId],
  );
  const trackedIdxRef = React.useRef(trackedIdx);
  trackedIdxRef.current = trackedIdx;

  const blipRefs = React.useRef<(SVGCircleElement | null)[]>([]);
  // `blips` lives in a ref the loop reads, NOT as an effect dep. It is a
  // useMemo on [data.mempool, …] and the feed polls every 3s, so an effect
  // keyed on it tore the rAF loop down and rebuilt it on every tick — the
  // loop's own `t0` reset each time, snapping the sweep arm back to bearing 0.
  // (v6.0.8 perf pass; the property is earned, keep it.)
  const blipsRef = React.useRef(blips);
  blipsRef.current = blips;

  React.useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    let raf = 0;
    let running = false;
    const t0 = performance.now();
    const PERIOD = 4.2; // seconds per revolution
    // PER-FRAME COST BOUNDED BY CONSTRUCTION, and it had to be: contacts went
    // from 60 to the whole pool (240 fixtured), so the old per-blip
    // `style.filter` write — a string allocation plus a filter re-parse — would
    // have quadrupled with it. The glow now lives on ONE element (the tracked
    // reticle); blips carry `r` and `opacity` only, so a frame is 1 transform
    // + 2N attribute sets.
    const tick = () => {
      const t = (performance.now() - t0) / 1000;
      const sweep = ((t / PERIOD) % 1) * Math.PI * 2;       // 0..2π
      const arm = el.querySelector("[data-arm]");
      if (arm) arm.setAttribute("transform", `rotate(${sweep * 180 / Math.PI} ${cx} ${cy})`);
      const list = blipsRef.current;
      for (let i = 0; i < list.length; i++) {
        const node = blipRefs.current[i];
        if (!node) continue;
        let d = sweep - list[i].ang; while (d < 0) d += Math.PI * 2;   // radians since the sweep passed
        const recency = Math.max(0, 1 - d / (Math.PI * 0.8));          // fades over ~144°
        const locked = i === trackedIdxRef.current;
        node.setAttribute("r", (1.5 + recency * 2.6).toFixed(2));
        // The tracked blip stays pinned at full opacity rather than fading with
        // sweep recency — it must stay visible between sweep passes, which is
        // what scenario 2 checks.
        node.setAttribute("opacity", locked ? "1" : (0.22 + recency * 0.78).toFixed(3));
      }
      raf = requestAnimationFrame(tick);
    };
    const start = () => { if (running) return; running = true; raf = requestAnimationFrame(tick); };
    const stop = () => { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; };
    // Stops entirely when the tab is backgrounded or this SVG scrolls off
    // screen (D0699); verify-govern §5 walks every rAF site.
    const undrawable = observeDrawable(el, (drawable) => (drawable ? start() : stop()));
    return () => { undrawable(); stop(); };
  }, [cx, cy]);

  const tracked = trackedIdx >= 0 ? blips[trackedIdx] : null;

  return (
    // The wrapper renders UNCONDITIONALLY — never `return null` from a
    // component whose ref useChartMetrics measures, or the layout effect fires
    // once against a null ref, no ResizeObserver is ever attached and `ready`
    // stays false forever (the v6.0.12 Markets defect).
    <div ref={wrapRef} style={{ width: "100%" }}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${W}`} width={W} height={W}
        style={{ display: "block", margin: "0 auto", maxWidth: "100%" }}
        role="img" aria-label="PPI radar: range is fee per byte, centre is the next block, edge is the fee floor">
        <defs>
          <radialGradient id="brg-ppi" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--accent-structural)" stopOpacity="0.14" />
            <stop offset="100%" stopColor="var(--accent-structural)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="brg-wedge" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--accent-structural)" stopOpacity="0.34" />
            <stop offset="100%" stopColor="var(--accent-structural)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <circle cx={cx} cy={cy} r={R} fill="url(#brg-ppi)" />

        {/* Range rings — LIVE fee-tier values.
            THE CUT LABEL SITS ON THE OPPOSITE SIDE OF THE AXIS, and that is a
            collision fix by CONSTRUCTION rather than a styling choice: tier
            labels start at cx + LBL_GUTTER, the cut label ends at
            cx − LBL_GUTTER, so the two families are 2·LBL_GUTTER apart in x
            and cannot intersect at any pool composition or any radius.
            Scenario 6 asserts non-overlap at four widths and this view is
            width-invariant, so a collision here would be permanent rather than
            intermittent — which is exactly the class §9 says to close by
            tracing the geometry instead of by trusting the assertion. */}
        {rings.map((ring, i) => (
          <g key={i}>
            <circle cx={cx} cy={cy} r={ring.r} fill="none" stroke={GRID} strokeWidth="1" strokeDasharray="2 5" />
            <text x={cx + LBL_GUTTER} y={ring.y} fontFamily="var(--f-mono)" fontSize="11" fill={AXIS} letterSpacing="0.06em">{ring.label}</text>
          </g>
        ))}
        {cutRing ? (
          <g>
            <circle cx={cx} cy={cy} r={cutRing.r} fill="none" stroke="var(--tk-accent)" strokeOpacity="0.75" strokeWidth="1" strokeDasharray="5 4" />
            <text x={cx - LBL_GUTTER} y={cutRing.y} textAnchor="end" fontFamily="var(--f-mono)" fontSize="11" fill="var(--tk-accent)" letterSpacing="0.06em">CUT</text>
          </g>
        ) : null}

        {/* bearing spokes */}
        {Array.from({ length: 12 }).map((_, i) => {
          const a = i * 30 * Math.PI / 180;
          return <line key={i} x1={cx} y1={cy} x2={cx + Math.cos(a) * R} y2={cy + Math.sin(a) * R}
            stroke={GRID} strokeOpacity={0.55} strokeWidth="1" />;
        })}

        {/* sweep arm + trailing wedge */}
        <g data-arm>
          <path d={`M ${cx} ${cy} L ${cx + R} ${cy} A ${R} ${R} 0 0 0 ${cx + R * Math.cos(-0.9)} ${cy + R * Math.sin(-0.9)} Z`} fill="url(#brg-wedge)" />
          <line x1={cx} y1={cy} x2={cx + R} y2={cy} stroke="var(--tk-accent)" strokeWidth="1.4" />
        </g>

        {/* contacts — the whole pool */}
        {/* Keyed by INDEX, not by txid, and deliberately: the pool turns over
            every 3s and an id key would make React reorder 240 DOM nodes per
            tick to preserve identities the radar does not use — position is
            recomputed from the datum anyway. */}
        {blips.map((b, i) => (
          <circle key={i} ref={(n) => { blipRefs.current[i] = n; }}
            data-tracked-tx={i === trackedIdx ? trackedId : undefined}
            cx={cx + Math.cos(b.ang) * b.r} cy={cy + Math.sin(b.ang) * b.r}
            r="2" fill={b.color} opacity="0.4" />
        ))}

        {/* tracked-tx lock reticle: bracket on the blip + leader to the rim, so
            the tracked tx reads even while the sweep is elsewhere. */}
        {tracked ? (() => {
          const bx = cx + Math.cos(tracked.ang) * tracked.r, by = cy + Math.sin(tracked.ang) * tracked.r;
          const rx = cx + Math.cos(tracked.ang) * R, ry = cy + Math.sin(tracked.ang) * R;
          const lx = cx + Math.cos(tracked.ang) * (R + 12), ly = cy + Math.sin(tracked.ang) * (R + 12);
          const anchor = Math.cos(tracked.ang) > 0.15 ? "start" : Math.cos(tracked.ang) < -0.15 ? "end" : "middle";
          return (
            <g data-tracked-tx={trackedId}>
              <line x1={bx} y1={by} x2={rx} y2={ry} stroke="var(--y-50)" strokeWidth="1" strokeDasharray="2 2" opacity="0.85" />
              <rect x={bx - 7} y={by - 7} width="14" height="14" fill="none" stroke="var(--y-50)" strokeWidth="1.4"
                transform={`rotate(45 ${bx} ${by})`} style={{ filter: "drop-shadow(0 0 4px var(--y-50))" }} />
              <text x={lx} y={ly} textAnchor={anchor} fontFamily="var(--f-mono)" fontSize="11" fill="var(--y-50)">{ShortHash(trackedId!)}</text>
            </g>
          );
        })() : null}

        {/* centre — the next block */}
        <circle cx={cx} cy={cy} r="4" fill="var(--tk-accent)" style={{ filter: "drop-shadow(0 0 5px var(--tk-accent))" }} />
        <text x={cx} y={W - 3} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="11" fill={AXIS} letterSpacing="0.1em">
          {rangeSpan ? `CENTRE ${fmtFeeK(rangeSpan.hi)} · EDGE ${fmtFeeK(rangeSpan.lo)} pcn/B` : "AWAITING MEMPOOL"}
        </text>
      </svg>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   INSTRUMENT BANK — eight flat gauges at one weight
   ────────────────────────────────────────────────────────────── */

/**
 * One flat gauge: value, label, thin bar. Replaces the four semicircular needle
 * gauges, ~130px of height each plus an easing rAF loop per instrument to
 * animate a number that changes once per 15s chain tier.
 *
 * `frac` may be NULL — a designed state, not a fallback: a gauge whose
 * denominator does not exist on this feed renders an em-dash and says why,
 * rather than a confident 0. See BrgInstrumentBank's PEERS entry.
 */
export function BrgGauge({ value, label, frac, color = "var(--tk-accent)", note }: {
  value: React.ReactNode;
  label: string;
  frac: number | null;
  color?: string;
  note?: string;
}) {
  const pct = frac == null ? 0 : Math.max(0, Math.min(1, frac));
  return (
    <div style={{ minWidth: 0 }}>
      <div className="mono" style={{ fontSize: 20, lineHeight: 1.15, color: frac == null ? "var(--ink-40)" : color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
      <div className="mono" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-40)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={note || label}>{label}</div>
      <div style={{ height: 5, background: "var(--line)", marginTop: "var(--sp-1)", position: "relative" }}>
        {frac == null
          ? <span style={{ position: "absolute", inset: 0, borderBottom: "1px dashed var(--ink-40)" }} />
          : (
            // scaleX, NOT width — caught by verify-gpu, which bans a transition
            // on any layout property under src/mempool. A width tween relayouts
            // the bar every frame; scaleX runs on the compositor. The span is
            // full-width and scaled from its left edge, so `pct` means the same
            // thing it did.
            // D0651: the bar tracks a 15s chain tier, so it moves at most once
            // per poll — --d-3 var(--e-decel) is a settle, not an animation
            // loop. Zeroed by the global reduce block in styles.css:221-223.
            <span style={{
              position: "absolute", inset: 0, background: color,
              transform: `scaleX(${pct.toFixed(4)})`, transformOrigin: "left center",
              transition: "transform var(--d-3) var(--e-decel)",
            }} />
          )}
      </div>
    </div>
  );
}
