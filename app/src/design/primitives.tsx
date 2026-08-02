/**
 * design/primitives.tsx — small, framework-free atoms used by every page.
 *
 * Kept tiny and stateless. Style via CSS variables (see styles.css `--tk-*`).
 * Tweaks are NOT in this repo — they live in the design hub.
 */

import * as React from "react";
import { fmtN } from "@/data/types";
import { fmtAge, useFreshSecond } from "./useFreshClock";
import {
  ChartCrosshair,
  ChartTip,
  GRID,
  nearestIndex,
  useGradientId,
  useSvgCursor,
} from "./chart-kit";

// Canonical data-source attribution badge — re-exported so the many
// `@/design/primitives` import sites can pull it from one place.
export { Provenance, NodeProvenance, DataLegend } from "./provenance";
export type { ProvSource, ProvFreshness, ProvenanceProps, NodeProvenanceProps, DataLegendProps } from "./provenance";

// ── Stat tile ───────────────────────────────────────────────────

export interface StatProps {
  k: React.ReactNode;
  v: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "acc" | "g" | "p" | "dn";
  big?: boolean;
}

export function Stat({ k, v, sub, tone, big }: StatProps) {
  return (
    <div className="stat" style={big ? { padding: "12px 14px" } : undefined}>
      <div className="lbl">{k}</div>
      <div className={"val" + (tone ? " " + tone : "")} style={big ? { fontSize: 26 } : undefined}>{v}</div>
      {sub ? <div className="sub">{sub}</div> : null}
    </div>
  );
}

// ── Pill ────────────────────────────────────────────────────────

export interface PillProps {
  tone?: "live" | "warn" | "acc";
  dot?: boolean;
  /** Tooltip. A degraded pill names the endpoint here rather than in its label,
   *  which has to stay short enough not to reflow the 390px ticker strip. */
  title?: string;
  children: React.ReactNode;
}

export function Pill({ tone, dot, title, children }: PillProps) {
  return (
    <span className={"pill" + (tone ? " " + tone : "")} title={title}>
      {dot ? <span className="led pulse" style={{ width: 5, height: 5 }} /> : null}
      {children}
    </span>
  );
}

// ── Panel frame (HUD-bracketed) ─────────────────────────────────

export interface PanelFrameProps {
  title?: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
  scrollable?: string | number;
  style?: React.CSSProperties;
  ticks?: boolean;
  /**
   * The FeedKey(s) this panel's numbers actually come from, space-separated.
   * Rendered as `data-panel-key` so a gate can assert that killing ONE endpoint
   * degrades exactly the panels fed by it and leaves the rest live — which is
   * not observable from rendered text, since a stale chart and a live one
   * differ only by opacity and a decorative watermark.
   */
  dataKey?: string;
  /**
   * This panel's data is last-good, not current.
   *
   * Renders a header chip and stamps `data-stale`, which is what makes
   * staleness observable on panels that are not charts. The chart components
   * draw their own STALE watermark inside the body; a table or a stat-plus-bar
   * has nowhere to draw one, so before this the Pool-attribution and
   * Recent-blocks panels showed last-good numbers formatted exactly like live
   * ones and said nothing. The chip lives in the HEADER precisely so it does
   * not double-dim the chart bodies that already handle themselves.
   */
  stale?: boolean;
  /**
   * When this panel's OWN endpoint last answered — `freshAt(status[key])`, or
   * the oldest of them when the panel reads several. 0 / undefined = never.
   *
   * Never `lastUpdate`. That is the feed heartbeat: it stamps whenever ANY tier
   * commits, so a panel fed by a dead endpoint would show a time that keeps
   * advancing because some other endpoint is healthy. verify-feedstatus.mjs
   * fails the build on any UI read of it, which is the mechanised version of
   * this sentence.
   */
  updatedAt?: number;
}

/**
 * "UPD 12s" — how long ago this panel's endpoint answered.
 *
 * Two readouts from one stamp, and the split is the point. `at` is LAST-GOOD on
 * the stale variant, so during an outage the absolute instant in the `title`
 * FREEZES — it is the last time anything was actually received — while the
 * visible relative age keeps climbing off the shared clock. The number a reader
 * needs during an outage is the age, and an age that stops growing is the same
 * lie in a different font.
 *
 * Rendered unconditionally, including in the prerender where every `at` is 0 and
 * this reads "UPD —". No node is inserted after hydration, so it contributes no
 * layout shift; `min-width` + tabular figures absorb 9s→10s and 59s→1m.
 */
function PanelUpdated({ at }: { at?: number }) {
  useFreshSecond();
  const has = typeof at === "number" && at > 0;
  return (
    <span
      className="panel-updated"
      title={has ? `last response ${new Date(at).toISOString().slice(11, 19)} UTC` : "this endpoint has not answered yet"}
    >
      UPD {has ? fmtAge(Date.now() - at) : "—"}
    </span>
  );
}

export function PanelFrame({ title, right, children, scrollable, style, ticks = true, dataKey, stale, updatedAt }: PanelFrameProps) {
  return (
    <div className="panel" style={style} data-panel-key={dataKey} data-stale={stale ? "true" : undefined}>
      {ticks ? (<>
        <span className="tick tl" />
        <span className="tick tr" />
        <span className="tick bl" />
        <span className="tick br" />
      </>) : null}
      {title ? (
        <div className="panel-h">
          <div className="l">{typeof title === "string" ? <span>{title}</span> : title}</div>
          <div className="r">
            {stale ? <span className="panel-stale" title="last-good values — this endpoint is not answering">· stale</span> : null}
            {updatedAt !== undefined ? <PanelUpdated at={updatedAt} /> : null}
            {right}
          </div>
        </div>
      ) : null}
      <div className="panel-b" style={scrollable ? { overflow: "auto", maxHeight: scrollable } : undefined}>
        {children}
      </div>
    </div>
  );
}

// ── Sparkline / MiniBar ─────────────────────────────────────────

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
  dots?: boolean;
  area?: number;
  /** gridlines at 25/50/75% + min/max/last labels */
  detail?: boolean;
  /** number → display string, used by detail labels and the hover readout */
  fmt?: (v: number) => string;
  /** crosshair + ChartTip on hover */
  hover?: boolean;
}

export function Sparkline({
  data, width = 220, height = 40,
  color = "var(--tk-accent)", fill = true, dots = false, area = 0.25,
  detail = false, fmt = (v: number) => fmtN(v, 2), hover = false,
}: SparklineProps) {
  // Hooks run unconditionally, before any early return below.
  const gradId = useGradientId("spark");
  const [svgRef, vx, cursorHandlers] = useSvgCursor(width);

  if (!data || !data.length) return null;

  const svgStyle: React.CSSProperties = {
    display: "block",
    maxWidth: width,
    height: "auto",
    ...(hover ? { touchAction: "pan-y" as const } : null),
  };

  // Single-sample series: no line to draw, `width / (data.length - 1)` would
  // divide by zero and emit NaN path coordinates. Render just the one point.
  if (data.length === 1) {
    const cx = width / 2;
    const cy = height / 2;
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={svgStyle}>
        <circle cx={cx} cy={cy} r="2.4" fill={color} />
        {detail ? (
          <text x={cx} y={Math.max(10, cy - 8)} textAnchor="middle"
                fontFamily="var(--f-mono)" fontSize="9.5" fill="var(--ink-40)">
            {fmt(data[0])}
          </text>
        ) : null}
      </svg>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const rng = max - min || 1;

  // Reserve vertical room for the min/max/last labels so `detail` mode
  // doesn't clip them against the top/bottom edge of the viewBox.
  const padTop = detail ? 16 : 0;
  const padBottom = detail ? 14 : 0;
  const plotH = height - padTop - padBottom;

  const step = width / (data.length - 1);
  const points = data.map<[number, number]>((v, i) => [
    i * step,
    padTop + plotH - ((v - min) / rng) * (plotH - 4) - 2,
  ]);
  const d = "M" + points.map((p) => p.join(",")).join(" L ");
  const f = d + ` L ${width},${padTop + plotH} L 0,${padTop + plotH} Z`;

  // Stride derived from series length so short series still get dots and
  // long ones don't turn into a solid row (was a hardcoded `i % 12`).
  const dotStride = Math.max(1, Math.round(data.length / 8));

  const gridYs = detail ? [0.25, 0.5, 0.75].map((p) => padTop + p * plotH) : [];

  const hoverIdx = hover ? nearestIndex(vx, { padL: 0, innerW: width, n: data.length }) : null;
  const hoverPt = hoverIdx != null ? points[hoverIdx] : null;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      style={svgStyle}
      {...(hover ? cursorHandlers : {})}
    >
      {fill ? (
        <>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={Math.min(0.6, area + 0.3)} />
              <stop offset="55%" stopColor={color} stopOpacity={area * 0.45} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={f} fill={`url(#${gradId})`} />
        </>
      ) : null}

      {detail ? gridYs.map((gy, i) => (
        <line key={i} x1={0} y1={gy} x2={width} y2={gy} stroke={GRID} strokeDasharray="2 3" />
      )) : null}

      <path d={d} fill="none" stroke={color} strokeWidth="1.2" strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 4px ${color})` }} />

      {dots ? points.filter((_, i) => i % dotStride === 0).map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="1.2" fill={color} />
      )) : null}

      {detail ? (
        <>
          <text x={2} y={10} fontFamily="var(--f-mono)" fontSize="9.5" fill="var(--ink-40)">
            max {fmt(max)}
          </text>
          <text x={2} y={height - 3} fontFamily="var(--f-mono)" fontSize="9.5" fill="var(--ink-40)">
            min {fmt(min)}
          </text>
          <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r="2.2" fill={color} />
          <text x={width - 2} y={10} textAnchor="end" fontFamily="var(--f-mono)" fontSize="9.5" fill={color}>
            {fmt(data[data.length - 1])}
          </text>
        </>
      ) : null}

      {hover && hoverPt ? (
        <>
          <ChartCrosshair x={hoverPt[0]} y1={padTop} y2={padTop + plotH} />
          <circle cx={hoverPt[0]} cy={hoverPt[1]} r="2.4" fill={color} />
          <ChartTip
            x={hoverPt[0]}
            bounds={{ left: 0, right: width }}
            rows={[{ value: fmt(data[hoverIdx as number]) }]}
          />
        </>
      ) : null}
    </svg>
  );
}

export interface MiniBarProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  /** per-bucket label, e.g. a fee range — shown in the hover readout */
  labels?: string[];
  fmt?: (v: number) => string;
  hover?: boolean;
}

export function MiniBar({
  data, width = 220, height = 36, color = "var(--tk-accent)",
  labels, fmt = (v: number) => fmtN(v, 2), hover = false,
}: MiniBarProps) {
  // Hooks run unconditionally, before the early return below.
  const gradId = useGradientId("bar");
  const [svgRef, vx, cursorHandlers] = useSvgCursor(width);

  if (!data || !data.length) return null;

  const max = Math.max(...data) || 1;
  const n = data.length;
  const w = width / n;

  const hoverIdx = hover && vx != null
    ? Math.max(0, Math.min(n - 1, Math.floor((vx / width) * n)))
    : null;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      style={{
        display: "block",
        maxWidth: width,
        height: "auto",
        ...(hover ? { touchAction: "pan-y" as const } : null),
      }}
      {...(hover ? cursorHandlers : {})}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.9" />
          <stop offset="100%" stopColor={color} stopOpacity="0.35" />
        </linearGradient>
      </defs>
      {data.map((v, i) => {
        const h = (v / max) * (height - 2);
        const isHover = hoverIdx === i;
        return (
          <rect key={i} x={i * w + 0.5} y={height - h}
            width={Math.max(1, w - 1.5)} height={h}
            fill={`url(#${gradId})`}
            opacity={isHover ? 1 : 0.3 + (v / max) * 0.7}
            stroke={isHover ? color : "none"} strokeWidth={isHover ? 0.8 : 0} />
        );
      })}
      {hover && hoverIdx != null ? (
        <>
          <ChartCrosshair x={(hoverIdx + 0.5) * w} y1={0} y2={height} />
          <ChartTip
            x={(hoverIdx + 0.5) * w}
            y={4}
            bounds={{ left: 0, right: width }}
            rows={[{ label: labels?.[hoverIdx] ?? `bucket ${hoverIdx + 1} / ${n}`, value: fmt(data[hoverIdx]) }]}
          />
        </>
      ) : null}
    </svg>
  );
}

// ── Crumbs ──────────────────────────────────────────────────────

export interface CrumbsProps {
  items: string[];
  status?: React.ReactNode;
}

export function Crumbs({ items, status }: CrumbsProps) {
  return (
    <div className="crumbs">
      {items.map((it, i) => (
        <React.Fragment key={i}>
          {i === items.length - 1 ? <b>{it}</b> : <span>{it}</span>}
          {i < items.length - 1 ? <s>/</s> : null}
        </React.Fragment>
      ))}
      {status ? (
        <span style={{ marginLeft: "auto" }}>
          <span className="led pulse" /> {status}
        </span>
      ) : null}
    </div>
  );
}

// ── Card with HUD corners ───────────────────────────────────────

export interface CardProps {
  children: React.ReactNode;
  onClick?: () => void;
  accentBorder?: boolean;
  style?: React.CSSProperties;
}

export function Card({ children, onClick, accentBorder, style }: CardProps) {
  return (
    <div
      role={onClick ? "button" : undefined}
      onClick={onClick}
      className="panel"
      style={{
        cursor: onClick ? "pointer" : "default",
        borderColor: accentBorder ? "var(--tk-accent)" : "var(--rule)",
        // D0651: 0.18s → var(--d-2); bare (no easing keyword) → var(--e-standard)
        transition: "transform var(--d-2) var(--e-standard), border-color var(--d-2) var(--e-standard), box-shadow var(--d-2) var(--e-standard)",
        ...style,
      }}
    >
      <span className="tick tl" /><span className="tick tr" />
      <span className="tick bl" /><span className="tick br" />
      {children}
    </div>
  );
}
