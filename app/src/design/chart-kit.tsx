/**
 * design/chart-kit.tsx — shared hover-inspection primitives for self-hosted
 * SVG charts (candles, area, bar, and the newer mempool detail views).
 *
 * Every chart in markets/charts.tsx re-implemented the same three things
 * inline: a pointer→viewBox coordinate conversion, a nearest-sample lookup,
 * and a tooltip box. That was fine while there was one chart family, but the
 * mempool detail surfaces need the identical math and would otherwise be a
 * fourth (fifth, sixth…) copy to keep in sync. This module is the one place
 * that logic lives now.
 *
 * The coordinate conversion is deliberately NOT `offsetWidth`/`clientWidth`
 * based — it reads `getBoundingClientRect()`, which is the only API that
 * reports the actual on-screen box when an ancestor applies a CSS
 * `transform: scale()` (the mempool `FitView` wrapper does exactly this).
 * Using an untransformed size there would silently mis-locate the cursor
 * readout the moment a chart is scaled down to fit its panel.
 *
 * Leaf module: imports only `react`, so `@/design/primitives` (and anything
 * else) can safely import FROM here without risking an import cycle.
 */

import * as React from "react";

export const VB_W = 1000;
export const AXIS = "var(--ink-40)";
export const GRID = "rgba(255,255,255,0.05)";

/* ── cursor tracking ──────────────────────────────────────────────── */

export interface SvgCursorHandlers {
  onPointerMove: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerDown: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerLeave: () => void;
}

/**
 * Hover-inspection primitive for viewBox-scaled SVG charts.
 * Returns [ref, viewX | null, handlers]; viewX is in viewBox units.
 *
 * Pointer events, not mouse events, so a tap on a touch device produces a
 * readout too — `onPointerDown` sets the cursor for that reason. Callers
 * must also set `style={{ touchAction: "pan-y" }}` on the `<svg>` so a
 * horizontal drag across the chart doesn't fight the page's vertical scroll.
 */
export function useSvgCursor(viewW: number): [React.RefObject<SVGSVGElement>, number | null, SvgCursorHandlers] {
  const ref = React.useRef<SVGSVGElement>(null);
  const [vx, setVx] = React.useState<number | null>(null);

  const measure = React.useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    // rect MUST come from getBoundingClientRect() — see file header. Prefer
    // currentTarget (the <svg> the handlers are spread onto); fall back to
    // the ref for the rare case currentTarget isn't a live Element.
    const el = e.currentTarget instanceof Element ? e.currentTarget : ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width) return;
    setVx((e.clientX - rect.left) * (viewW / rect.width));
  }, [viewW]);

  const handlers: SvgCursorHandlers = {
    onPointerMove: measure,
    onPointerDown: measure,
    onPointerLeave: () => setVx(null),
  };

  return [ref, vx, handlers];
}

/** Nearest sample index for evenly-spaced points spanning padL … padL+innerW. */
export function nearestIndex(vx: number | null, o: { padL: number; innerW: number; n: number }): number | null {
  if (vx == null) return null;
  const { padL, innerW, n } = o;
  if (n <= 1) return 0;
  const i = Math.round(((vx - padL) / innerW) * (n - 1));
  return i >= 0 && i < n ? i : null;
}

/** Nearest slot index for slot-based charts (candles/bars) where each datum owns a `slot` wide column. */
export function slotIndex(vx: number | null, o: { padL: number; slot: number; cw: number; n: number }): number | null {
  if (vx == null) return null;
  const { padL, slot, cw, n } = o;
  const i = Math.round((vx - padL - (slot - cw) / 2) / slot);
  return i >= 0 && i < n ? i : null;
}

/* ── tooltip ───────────────────────────────────────────────────────── */

export interface ChartTipRow { label?: string; value: string; color?: string }

export interface ChartTipProps {
  /** anchor x in viewBox units (usually the crosshair x) */
  x: number;
  /** top y in viewBox units; default 18 */
  y?: number;
  /** clamp range, usually { left: padL, right: padL + innerW } */
  bounds: { left: number; right: number };
  width?: number;
  height?: number;
  rows?: ChartTipRow[];
  /** escape hatch: raw <text> children positioned in the tip's LOCAL coords (0,0 = tip top-left) */
  children?: React.ReactNode;
}

const TIP_CHAR_W = 6.3; // ~monospace glyph width in viewBox units at fontSize 10.5
const TIP_ROW_H = 14;
const TIP_PAD = 10;

function deriveTipSize(rows: ChartTipRow[]): { w: number; h: number } {
  const longest = rows.reduce((m, r) => {
    const len = (r.label ? r.label.length + 2 : 0) + r.value.length;
    return Math.max(m, len);
  }, 0);
  return { w: Math.max(60, Math.round(longest * TIP_CHAR_W + 16)), h: rows.length * TIP_ROW_H + TIP_PAD };
}

export function ChartTip({ x, y = 18, bounds, width, height, rows, children }: ChartTipProps): JSX.Element | null {
  const derived = rows?.length ? deriveTipSize(rows) : null;
  const w = width ?? derived?.w;
  const h = height ?? derived?.h;
  if (w == null || h == null) return null;
  if (!rows?.length && !children) return null;

  const tx = Math.max(bounds.left, Math.min(x + 8, bounds.right - w));

  return (
    <g pointerEvents="none" transform={`translate(${tx}, ${y})`}>
      <rect x={0} y={0} width={w} height={h} rx={2} fill="rgba(8,7,5,0.94)" stroke="var(--rule)" />
      {rows?.length
        ? rows.map((r, i) => (
            <text
              key={i}
              x={8}
              y={TIP_ROW_H + i * TIP_ROW_H}
              fontFamily="var(--f-mono)"
              fontSize={10.5}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {r.label ? <tspan fill="var(--ink-60)">{r.label + "  "}</tspan> : null}
              <tspan fill={r.color ?? "var(--ink-100)"}>{r.value}</tspan>
            </text>
          ))
        : children}
    </g>
  );
}

/** Vertical crosshair rule. */
export function ChartCrosshair(p: { x: number; y1: number; y2: number; color?: string }): JSX.Element {
  const { x, y1, y2, color = "rgba(236,234,246,0.22)" } = p;
  return (
    <g pointerEvents="none">
      <line x1={x} y1={y1} x2={x} y2={y2} stroke={color} strokeWidth={0.8} strokeDasharray="3 3" />
    </g>
  );
}

/** Sanitises React.useId() into something safe inside url(#…). */
export function useGradientId(prefix: string): string {
  return `${prefix}-${React.useId().replace(/:/g, "")}`;
}
