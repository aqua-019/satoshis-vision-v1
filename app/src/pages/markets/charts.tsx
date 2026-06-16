/**
 * pages/markets/charts.tsx — hand-rolled SVG chart primitives for the Markets
 * surface. No third-party / CDN chart libraries (privacy invariant).
 *
 * Both components are responsive: a fixed logical viewBox (VB_W units) scaled to
 * the container via width:100%, height by prop. They render REAL data when given
 * it; the source/status badge is the caller's job (see SourceBadge in
 * MarketsPage). prefers-reduced-motion disables the mount fade.
 */

import * as React from "react";
import type { Candle, LineSeries, SeriesStatus } from "@/data/useMarketHistory";

const VB_W = 1000;
const UP_FILL = "rgba(74,222,128,0.72)";
const UP_STROKE = "rgba(74,222,128,1)";
const DN_FILL = "rgba(255,77,109,0.72)";
const DN_STROKE = "rgba(255,77,109,1)";

/* ── helpers ───────────────────────────────────────────────────────── */

function useReducedMotion(): boolean {
  const [r, setR] = React.useState(() =>
    typeof matchMedia !== "undefined" ? matchMedia("(prefers-reduced-motion: reduce)").matches : false,
  );
  React.useEffect(() => {
    if (typeof matchMedia === "undefined") return;
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setR(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return r;
}

/** Fade the chart in once on mount (skipped under reduced-motion). */
function useMountFade(reduced: boolean): number {
  const [o, setO] = React.useState(reduced ? 1 : 0);
  React.useEffect(() => {
    if (reduced) { setO(1); return; }
    const id = requestAnimationFrame(() => setO(1));
    return () => cancelAnimationFrame(id);
  }, [reduced]);
  return o;
}

function niceNum(range: number, round: boolean): number {
  const r = range || 1;
  const exp = Math.floor(Math.log10(r));
  const f = r / Math.pow(10, exp);
  const nf = round
    ? f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10
    : f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nf * Math.pow(10, exp);
}

function niceTicks(min: number, max: number, count = 5): number[] {
  if (!isFinite(min) || !isFinite(max) || min === max) return [min];
  const step = niceNum(niceNum(max - min, false) / Math.max(1, count - 1), true);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step * 0.5; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

function fmtPrice(v: number): string {
  const a = Math.abs(v);
  if (a >= 1000) return "$" + (v / 1000).toFixed(a >= 100_000 ? 0 : 1) + "k";
  if (a >= 100) return "$" + v.toFixed(0);
  if (a >= 1) return "$" + v.toFixed(2);
  if (a >= 0.01) return "$" + v.toFixed(4);
  return "$" + v.toPrecision(2);
}

function fmtVol(v: number): string {
  if (v >= 1e9) return "$" + (v / 1e9).toFixed(1) + "B";
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(1) + "M";
  if (v >= 1e3) return "$" + (v / 1e3).toFixed(0) + "k";
  return "$" + v.toFixed(0);
}

function fmtDate(ts: number, days: number): string {
  const d = new Date(ts);
  if (days > 90) return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function smoothPath(pts: [number, number][]): string {
  if (pts.length === 0) return "";
  if (pts.length < 3) return "M" + pts.map((p) => `${p[0]},${p[1]}`).join(" L ");
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? 0 : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

const AXIS = "var(--ink-40)";
const GRID = "rgba(255,255,255,0.05)";

/* ════════════════════════════════════════════════════════════════════
   CandleChart — real OHLC + volume sub-bars + axes + annotations
   ════════════════════════════════════════════════════════════════════ */

export interface CandleChartProps {
  candles: Candle[];
  days: number;
  height?: number;
  status?: SeriesStatus;
}

export function CandleChart({ candles, days, height = 300, status = "live" }: CandleChartProps) {
  const reduced = useReducedMotion();
  const fade = useMountFade(reduced);
  const [cross, setCross] = React.useState<number | null>(null);

  if (!candles?.length) return null;
  const stale = status === "stale";
  const W = VB_W;
  const padL = 54, padR = 66, padT = 14;
  const volH = Math.max(28, Math.round(height * 0.16));
  const dateH = 22;
  const priceH = height - padT - volH - dateH - 10;
  const innerW = W - padL - padR;
  const n = candles.length;

  const lo = Math.min(...candles.map((c) => c.l));
  const hi = Math.max(...candles.map((c) => c.h));
  const pad = (hi - lo || 1) * 0.06;
  const yMin = lo - pad, yMax = hi + pad, yRng = yMax - yMin || 1;
  const py = (v: number) => padT + priceH - ((v - yMin) / yRng) * priceH;

  const maxV = Math.max(1, ...candles.map((c) => c.v));
  const volTop = padT + priceH + 8;
  const vy = (v: number) => volTop + volH - (v / maxV) * volH;

  const slot = innerW / n;
  const cw = Math.max(0.6, Math.min(14, slot - slot * 0.28));
  const cx = (i: number) => padL + i * slot + (slot - cw) / 2;
  const mid = (i: number) => cx(i) + cw / 2;

  // annotations (d10): high / low / average / period change
  const hiIdx = candles.reduce((m, c, i) => (c.h > candles[m].h ? i : m), 0);
  const loIdx = candles.reduce((m, c, i) => (c.l < candles[m].l ? i : m), 0);
  const avg = candles.reduce((a, c) => a + c.c, 0) / n;
  const first = candles[0].o, last = candles[n - 1].c;
  const changePct = ((last - first) / (first || 1)) * 100;
  const lastUp = last >= first;

  const yTicks = niceTicks(yMin, yMax, 5);
  const xStep = Math.max(1, Math.ceil(n / 7));

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const vbX = (e.clientX - rect.left) * (W / rect.width);
    const i = Math.round((vbX - padL - (slot - cw) / 2) / slot);
    setCross(i >= 0 && i < n ? i : null);
  };

  const cc = cross != null ? candles[cross] : null;

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      width="100%"
      style={{ display: "block", touchAction: "pan-y", opacity: fade, transition: reduced ? "none" : "opacity 0.35s ease" }}
      onPointerMove={onMove}
      onPointerDown={onMove}
      onPointerLeave={() => setCross(null)}
    >
      {/* y gridlines + price labels */}
      {yTicks.map((t) => (
        <g key={"y" + t}>
          <line x1={padL} y1={py(t)} x2={padL + innerW} y2={py(t)} stroke={GRID} strokeDasharray="2 4" />
          <text x={padL - 8} y={py(t) + 3} textAnchor="end" fontFamily="var(--f-mono)" fontSize="10" fill={AXIS}>{fmtPrice(t)}</text>
        </g>
      ))}

      {/* x date ticks */}
      {candles.map((c, i) => (i % xStep === 0 ? (
        <g key={"x" + i}>
          <line x1={mid(i)} y1={padT + priceH} x2={mid(i)} y2={padT + priceH + 4} stroke={AXIS} />
          <text x={mid(i)} y={height - 6} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="9.5" fill={AXIS}>{fmtDate(c.t, days)}</text>
        </g>
      ) : null))}

      {/* average line */}
      <line x1={padL} y1={py(avg)} x2={padL + innerW} y2={py(avg)} stroke="var(--ink-40)" strokeWidth="0.8" strokeDasharray="5 4" opacity={0.7} />
      <text x={padL + 4} y={py(avg) - 4} fontFamily="var(--f-mono)" fontSize="9.5" fill={AXIS}>avg {fmtPrice(avg)}</text>

      {/* candles */}
      <g opacity={stale ? 0.5 : 1}>
        {candles.map((c, i) => {
          const up = c.c >= c.o;
          const x = cx(i);
          const bodyTop = py(Math.max(c.o, c.c));
          const bodyH = Math.max(0.8, Math.abs(py(c.o) - py(c.c)));
          return (
            <g key={i}>
              <line x1={x + cw / 2} y1={py(c.h)} x2={x + cw / 2} y2={py(c.l)} stroke={up ? UP_STROKE : DN_STROKE} strokeWidth={Math.max(0.5, cw * 0.14)} />
              <rect x={x} y={bodyTop} width={cw} height={bodyH} fill={up ? UP_FILL : DN_FILL} stroke={up ? UP_STROKE : DN_STROKE} strokeWidth="0.5" />
            </g>
          );
        })}
      </g>

      {/* volume sub-bars (aligned 1:1 under candles) */}
      <line x1={padL} y1={volTop + volH} x2={padL + innerW} y2={volTop + volH} stroke={GRID} />
      <text x={padL - 8} y={volTop + 9} textAnchor="end" fontFamily="var(--f-mono)" fontSize="8.5" fill={AXIS}>VOL</text>
      <g opacity={stale ? 0.35 : 0.55}>
        {candles.map((c, i) => {
          if (!c.v) return null;
          const up = c.c >= c.o;
          const y = vy(c.v);
          return <rect key={"v" + i} x={cx(i)} y={y} width={cw} height={volTop + volH - y} fill={up ? UP_STROKE : DN_STROKE} />;
        })}
      </g>

      {/* high / low markers */}
      <g fontFamily="var(--f-mono)" fontSize="9.5">
        <circle cx={mid(hiIdx)} cy={py(candles[hiIdx].h)} r="2" fill={UP_STROKE} />
        <text x={Math.min(mid(hiIdx), padL + innerW - 50)} y={py(candles[hiIdx].h) - 6} textAnchor="middle" fill={UP_STROKE}>H {fmtPrice(candles[hiIdx].h)}</text>
        <circle cx={mid(loIdx)} cy={py(candles[loIdx].l)} r="2" fill={DN_STROKE} />
        <text x={Math.min(mid(loIdx), padL + innerW - 50)} y={py(candles[loIdx].l) + 13} textAnchor="middle" fill={DN_STROKE}>L {fmtPrice(candles[loIdx].l)}</text>
      </g>

      {/* last-price line + pill */}
      <line x1={padL} y1={py(last)} x2={padL + innerW} y2={py(last)} stroke={lastUp ? UP_STROKE : DN_STROKE} strokeWidth="0.8" strokeDasharray="1 3" opacity={0.8} />
      <g transform={`translate(${padL + innerW + 3}, ${py(last)})`}>
        <rect x="0" y="-8" width={padR - 6} height="16" rx="2" fill={lastUp ? UP_STROKE : DN_STROKE} />
        <text x={(padR - 6) / 2} y="3.5" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="9.5" fill="#0b0a08" fontWeight={600}>{fmtPrice(last)}</text>
      </g>

      {/* period-change badge */}
      <g transform={`translate(${padL + 4}, ${padT + 4})`}>
        <text fontFamily="var(--f-mono)" fontSize="11" fill={changePct >= 0 ? UP_STROKE : DN_STROKE} fontWeight={600}>
          {changePct >= 0 ? "▲ +" : "▼ "}{changePct.toFixed(1)}%
        </text>
      </g>

      {stale ? (
        <text x={W / 2} y={padT + priceH / 2} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="34" fill="var(--ink-20)" opacity={0.25} letterSpacing="0.3em">STALE</text>
      ) : null}

      {/* crosshair + readout */}
      {cc ? (
        <g pointerEvents="none">
          <line x1={mid(cross!)} y1={padT} x2={mid(cross!)} y2={padT + priceH} stroke="var(--ink-40)" strokeDasharray="2 3" />
          <line x1={padL} y1={py(cc.c)} x2={padL + innerW} y2={py(cc.c)} stroke="var(--ink-40)" strokeDasharray="2 3" />
          <g transform={`translate(${Math.min(mid(cross!) + 8, padL + innerW - 150)}, ${padT + 6})`}>
            <rect x="0" y="0" width="148" height="58" rx="3" fill="rgba(8,7,5,0.94)" stroke="var(--rule)" />
            <text x="8" y="14" fontFamily="var(--f-mono)" fontSize="9" fill={AXIS}>{fmtDate(cc.t, days)}</text>
            <text x="8" y="28" fontFamily="var(--f-mono)" fontSize="9.5" fill="var(--ink-80)">O {fmtPrice(cc.o)}  H {fmtPrice(cc.h)}</text>
            <text x="8" y="40" fontFamily="var(--f-mono)" fontSize="9.5" fill="var(--ink-80)">L {fmtPrice(cc.l)}  C {fmtPrice(cc.c)}</text>
            <text x="8" y="52" fontFamily="var(--f-mono)" fontSize="9" fill={AXIS}>V {fmtVol(cc.v)}</text>
          </g>
        </g>
      ) : null}
    </svg>
  );
}

/* ════════════════════════════════════════════════════════════════════
   MultiLine — normalized %-gain lines + axes + area + smoothing
   ════════════════════════════════════════════════════════════════════ */

export interface MultiLineProps {
  series: LineSeries[];
  days: number;
  height?: number;
  labels?: boolean;
}

export function MultiLine({ series, days, height = 280, labels = true }: MultiLineProps) {
  const reduced = useReducedMotion();
  const fade = useMountFade(reduced);
  if (!series?.length) return null;

  const W = VB_W;
  const padL = 48, padR = labels ? 100 : 16, padT = 16, padB = 26;
  const innerW = W - padL - padR;
  const innerH = height - padT - padB;

  const norm = series.map((s) => {
    const first = s.data.find((v) => v > 0) ?? s.data[0] ?? 1;
    return { ...s, n: s.data.map((v) => (v / first - 1) * 100) };
  });
  const all = norm.flatMap((s) => s.n).filter((v) => isFinite(v));
  const min = Math.min(0, ...all), max = Math.max(0, ...all);
  const rng = max - min || 1;
  const y = (v: number) => padT + innerH - ((v - min) / rng) * innerH;
  const xOf = (i: number, len: number) => padL + (len <= 1 ? 0 : (i / (len - 1)) * innerW);

  const yTicks = niceTicks(min, max, 5);
  const ref = norm.reduce((a, b) => ((b.t?.length ?? 0) > (a.t?.length ?? 0) ? b : a), norm[0]);
  const refLen = ref.n.length;
  const xStep = Math.max(1, Math.ceil(refLen / 7));

  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" style={{ display: "block", opacity: fade, transition: reduced ? "none" : "opacity 0.35s ease" }}>
      <defs>
        {norm.map((s, i) => (
          <linearGradient key={"g" + i} id={`ml-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={s.color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={s.color} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>

      {/* y gridlines + % labels */}
      {yTicks.map((t) => (
        <g key={"y" + t}>
          <line x1={padL} y1={y(t)} x2={padL + innerW} y2={y(t)} stroke={t === 0 ? "rgba(255,255,255,0.14)" : GRID} strokeDasharray={t === 0 ? undefined : "2 4"} />
          <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontFamily="var(--f-mono)" fontSize="9.5" fill={AXIS}>{(t > 0 ? "+" : "") + t.toFixed(0)}%</text>
        </g>
      ))}

      {/* x date ticks (from the longest real series) */}
      {ref.t ? ref.n.map((_, i) => (i % xStep === 0 ? (
        <text key={"x" + i} x={xOf(i, refLen)} y={height - 6} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="9.5" fill={AXIS}>{fmtDate(ref.t![i], days)}</text>
      ) : null)) : null}

      {/* area + line per series */}
      {norm.map((s, si) => {
        const len = s.n.length;
        if (!len) return null;
        const pts = s.n.map((v, i) => [xOf(i, len), y(v)] as [number, number]);
        const line = smoothPath(pts);
        const area = `${line} L ${pts[pts.length - 1][0]},${y(min)} L ${pts[0][0]},${y(min)} Z`;
        const isStale = s.status === "stale";
        const lastV = s.n[len - 1];
        return (
          <g key={si} opacity={isStale ? 0.6 : 1}>
            <path d={area} fill={`url(#ml-grad-${si})`} stroke="none" />
            <path d={line} fill="none" stroke={s.color} strokeWidth={isStale ? 1.1 : 1.5} strokeDasharray={isStale ? "4 3" : undefined} style={{ filter: `drop-shadow(0 0 2px ${s.color})` }} />
            {labels ? (
              <text x={padL + innerW + 5} y={y(lastV) + 3} fontFamily="var(--f-mono)" fontSize="10" fill={s.color}>
                {s.label} {(lastV >= 0 ? "+" : "") + lastV.toFixed(1)}%{isStale ? " ·stale" : ""}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

/* ════════════════════════════════════════════════════════════════════
   AreaSeries — single line + filled area + real axes + value pill + hover.
   Hi-fi replacement for the stretched Sparkline (no preserveAspectRatio).
   Pass `data`+`days` (timestamps derived evenly over the window) or `t[]`.
   ════════════════════════════════════════════════════════════════════ */

export interface AreaSeriesProps {
  /** values; OR pass `t[]` for explicit per-point timestamps. */
  data: number[];
  /** window length in days — derives evenly-spaced x timestamps when `t` omitted. */
  days?: number;
  /** explicit per-point ms timestamps (length must match `data`). */
  t?: number[];
  height?: number;
  color?: string;
  /** y-value → display string for ticks, pill, hover, markers. */
  format?: (v: number) => string;
  /** "auto" = tight min/max ±8% pad; "zero" = include 0. */
  baseline?: "auto" | "zero";
  /** dim + "STALE" watermark, mirroring CandleChart's stale treatment. */
  stale?: boolean;
  /** subtle high/low dot markers on the line. */
  markers?: boolean;
  /** x-axis date labels. */
  xLabels?: boolean;
}

export function AreaSeries({
  data,
  days = 7,
  t,
  height = 200,
  color = "var(--tk-accent)",
  format = (v) => String(Math.round(v)),
  baseline = "auto",
  stale = false,
  markers = true,
  xLabels = true,
}: AreaSeriesProps) {
  const reduced = useReducedMotion();
  const fade = useMountFade(reduced);
  const [cross, setCross] = React.useState<number | null>(null);
  const gradId = "area-grad-" + React.useId().replace(/:/g, "");

  if (!data?.length) return null;
  const n = data.length;
  const W = VB_W;
  const padL = 54, padR = 66, padT = 14;
  const dateH = 22;
  const innerW = W - padL - padR;
  const innerH = height - padT - dateH - 10;

  const lo = Math.min(...data);
  const hi = Math.max(...data);
  let yMin: number, yMax: number;
  if (baseline === "zero") {
    yMin = Math.min(0, lo);
    yMax = hi * 1.05 || 1;
  } else {
    const pad = (hi - lo || Math.abs(hi) || 1) * 0.08;
    yMin = lo - pad;
    yMax = hi + pad;
  }
  const yRng = yMax - yMin || 1;
  const py = (v: number) => padT + innerH - ((v - yMin) / yRng) * innerH;
  const xOf = (i: number) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);

  const now = Date.now();
  const stepMs = (days * 86_400_000) / Math.max(1, n - 1);
  const tAt = (i: number) => (t && t[i] != null ? t[i] : now - (n - 1 - i) * stepMs);

  const yTicks = niceTicks(yMin, yMax, 5);
  const xStep = Math.max(1, Math.ceil(n / 7));

  const hiIdx = data.reduce((m, v, i) => (v > data[m] ? i : m), 0);
  const loIdx = data.reduce((m, v, i) => (v < data[m] ? i : m), 0);
  const first = data[0], last = data[n - 1];
  const up = last >= first;
  const changePct = ((last - first) / (Math.abs(first) || 1)) * 100;

  const pts = data.map((v, i) => [xOf(i), py(v)] as [number, number]);
  const line = smoothPath(pts);
  const baseY = py(yMin);
  const area = `${line} L ${pts[n - 1][0]},${baseY} L ${pts[0][0]},${baseY} Z`;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const vbX = (e.clientX - rect.left) * (W / rect.width);
    const i = n <= 1 ? 0 : Math.round(((vbX - padL) / innerW) * (n - 1));
    setCross(i >= 0 && i < n ? i : null);
  };
  const cv = cross != null ? data[cross] : null;

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      width="100%"
      style={{ display: "block", touchAction: "pan-y", opacity: fade, transition: reduced ? "none" : "opacity 0.35s ease" }}
      onPointerMove={onMove}
      onPointerDown={onMove}
      onPointerLeave={() => setCross(null)}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* y gridlines + labels */}
      {yTicks.map((tk) => (
        <g key={"y" + tk}>
          <line x1={padL} y1={py(tk)} x2={padL + innerW} y2={py(tk)} stroke={GRID} strokeDasharray="2 4" />
          <text x={padL - 8} y={py(tk) + 3} textAnchor="end" fontFamily="var(--f-mono)" fontSize="10" fill={AXIS}>{format(tk)}</text>
        </g>
      ))}

      {/* x date ticks */}
      {xLabels ? data.map((_, i) => (i % xStep === 0 ? (
        <g key={"x" + i}>
          <line x1={xOf(i)} y1={padT + innerH} x2={xOf(i)} y2={padT + innerH + 4} stroke={AXIS} />
          <text x={xOf(i)} y={height - 6} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="9.5" fill={AXIS}>{fmtDate(tAt(i), days)}</text>
        </g>
      ) : null)) : null}

      {/* area + line */}
      <g opacity={stale ? 0.5 : 1}>
        <path d={area} fill={`url(#${gradId})`} stroke="none" />
        <path d={line} fill="none" stroke={color} strokeWidth="1.6" style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
      </g>

      {/* high / low markers */}
      {markers && n > 1 ? (
        <g fontFamily="var(--f-mono)" fontSize="9.5">
          <circle cx={xOf(hiIdx)} cy={py(data[hiIdx])} r="2" fill={color} />
          <text x={Math.min(Math.max(xOf(hiIdx), padL + 22), padL + innerW - 22)} y={py(data[hiIdx]) - 6} textAnchor="middle" fill={AXIS}>{format(data[hiIdx])}</text>
          <circle cx={xOf(loIdx)} cy={py(data[loIdx])} r="2" fill={color} opacity={0.65} />
          <text x={Math.min(Math.max(xOf(loIdx), padL + 22), padL + innerW - 22)} y={py(data[loIdx]) + 13} textAnchor="middle" fill={AXIS}>{format(data[loIdx])}</text>
        </g>
      ) : null}

      {/* last-value line + pill */}
      <line x1={padL} y1={py(last)} x2={padL + innerW} y2={py(last)} stroke={color} strokeWidth="0.8" strokeDasharray="1 3" opacity={0.8} />
      <g transform={`translate(${padL + innerW + 3}, ${py(last)})`}>
        <rect x="0" y="-8" width={padR - 6} height="16" rx="2" fill={color} />
        <text x={(padR - 6) / 2} y="3.5" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="9.5" fill="#0b0a08" fontWeight={600}>{format(last)}</text>
      </g>

      {/* period-change badge */}
      {n > 1 ? (
        <g transform={`translate(${padL + 4}, ${padT + 4})`}>
          <text fontFamily="var(--f-mono)" fontSize="11" fill={up ? UP_STROKE : DN_STROKE} fontWeight={600}>
            {(changePct >= 0 ? "▲ +" : "▼ ") + changePct.toFixed(1)}%
          </text>
        </g>
      ) : null}

      {stale ? (
        <text x={W / 2} y={padT + innerH / 2} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="34" fill="var(--ink-20)" opacity={0.25} letterSpacing="0.3em">STALE</text>
      ) : null}

      {/* crosshair + readout */}
      {cv != null ? (
        <g pointerEvents="none">
          <line x1={xOf(cross!)} y1={padT} x2={xOf(cross!)} y2={padT + innerH} stroke="var(--ink-40)" strokeDasharray="2 3" />
          <line x1={padL} y1={py(cv)} x2={padL + innerW} y2={py(cv)} stroke="var(--ink-40)" strokeDasharray="2 3" />
          <circle cx={xOf(cross!)} cy={py(cv)} r="2.5" fill={color} />
          <g transform={`translate(${Math.min(xOf(cross!) + 8, padL + innerW - 132)}, ${padT + 6})`}>
            <rect x="0" y="0" width="130" height={xLabels ? 32 : 20} rx="3" fill="rgba(8,7,5,0.94)" stroke="var(--rule)" />
            {xLabels ? <text x="8" y="14" fontFamily="var(--f-mono)" fontSize="9" fill={AXIS}>{fmtDate(tAt(cross!), days)}</text> : null}
            <text x="8" y={xLabels ? 26 : 14} fontFamily="var(--f-mono)" fontSize="10" fill="var(--ink-80)">{format(cv)}</text>
          </g>
        </g>
      ) : null}
    </svg>
  );
}

/* ════════════════════════════════════════════════════════════════════
   BarSeries — responsive bars + real axes + gridlines + hover value.
   Hi-fi replacement for the fixed-pixel MiniBar.
   ════════════════════════════════════════════════════════════════════ */

export interface BarSeriesProps {
  data: number[];
  /** optional per-bar x labels (e.g. piconero/B bin edges). */
  labels?: string[];
  /** low/high captions at the axis ends when per-bar labels are omitted. */
  endLabels?: [string, string];
  t?: number[];
  days?: number;
  height?: number;
  color?: string;
  format?: (v: number) => string;
  baseline?: "auto" | "zero";
  stale?: boolean;
  /** optional on-chart vertical marker at a fractional bucket index (e.g. the
   *  median fee bucket). Drawn at the center of bucket `index`. */
  marker?: { index: number; label?: string };
}

export function BarSeries({
  data,
  labels,
  endLabels,
  t,
  days = 7,
  height = 200,
  color = "var(--p-50)",
  format = (v) => String(Math.round(v)),
  baseline = "zero",
  stale = false,
  marker,
}: BarSeriesProps) {
  const reduced = useReducedMotion();
  const fade = useMountFade(reduced);
  const [cross, setCross] = React.useState<number | null>(null);

  if (!data?.length) return null;
  const n = data.length;
  const W = VB_W;
  const padL = 54, padR = 16, padT = 14;
  const dateH = 22;
  const innerW = W - padL - padR;
  const innerH = height - padT - dateH - 10;

  const lo = Math.min(0, ...data);
  const hi = Math.max(0, ...data);
  const yMin = baseline === "zero" ? Math.min(0, lo) : lo - (hi - lo || 1) * 0.08;
  const yMax = hi * 1.05 || 1;
  const yRng = yMax - yMin || 1;
  const py = (v: number) => padT + innerH - ((v - yMin) / yRng) * innerH;

  const slot = innerW / n;
  const bw = Math.max(1, slot - Math.max(1.5, slot * 0.2));
  const bx = (i: number) => padL + i * slot + (slot - bw) / 2;

  const maxIdx = data.reduce((m, v, i) => (v > data[m] ? i : m), 0);
  const yTicks = niceTicks(yMin, yMax, 5);
  const xStep = Math.max(1, Math.ceil(n / 8));
  const now = Date.now();
  const baseY = py(Math.max(0, yMin));

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const vbX = (e.clientX - rect.left) * (W / rect.width);
    const i = Math.floor((vbX - padL) / slot);
    setCross(i >= 0 && i < n ? i : null);
  };
  const cv = cross != null ? data[cross] : null;

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      width="100%"
      style={{ display: "block", touchAction: "pan-y", opacity: fade, transition: reduced ? "none" : "opacity 0.35s ease" }}
      onPointerMove={onMove}
      onPointerDown={onMove}
      onPointerLeave={() => setCross(null)}
    >
      {/* y gridlines + labels */}
      {yTicks.map((tk) => (
        <g key={"y" + tk}>
          <line x1={padL} y1={py(tk)} x2={padL + innerW} y2={py(tk)} stroke={GRID} strokeDasharray="2 4" />
          <text x={padL - 8} y={py(tk) + 3} textAnchor="end" fontFamily="var(--f-mono)" fontSize="10" fill={AXIS}>{format(tk)}</text>
        </g>
      ))}

      {/* x labels */}
      {labels ? data.map((_, i) => (i % xStep === 0 || i === n - 1 ? (
        <text key={"x" + i} x={bx(i) + bw / 2} y={height - 6} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="9" fill={AXIS}>{labels[i]}</text>
      ) : null)) : endLabels ? (
        <>
          <text x={padL} y={height - 6} textAnchor="start" fontFamily="var(--f-mono)" fontSize="9" fill={AXIS}>{endLabels[0]}</text>
          <text x={padL + innerW} y={height - 6} textAnchor="end" fontFamily="var(--f-mono)" fontSize="9" fill={AXIS}>{endLabels[1]}</text>
        </>
      ) : t ? data.map((_, i) => (i % xStep === 0 ? (
        <text key={"x" + i} x={bx(i) + bw / 2} y={height - 6} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="9" fill={AXIS}>{fmtDate(t[i] ?? now, days)}</text>
      ) : null)) : null}

      {/* bars */}
      <g opacity={stale ? 0.5 : 1}>
        {data.map((v, i) => {
          const y = py(v);
          const h = Math.max(0, baseY - y);
          const isMax = i === maxIdx;
          return (
            <rect key={i} x={bx(i)} y={Math.min(y, baseY)} width={bw} height={h}
              rx={Math.min(1.5, bw / 3)} fill={color}
              opacity={cross === i ? 1 : 0.4 + (v / (hi || 1)) * 0.55}
              style={{ filter: isMax ? `drop-shadow(0 0 4px ${color})` : undefined }} />
          );
        })}
      </g>

      {/* optional median (or other) marker, anchored to a bucket center */}
      {marker && marker.index >= 0 && marker.index <= n ? (() => {
        const mx = padL + (marker.index + 0.5) * slot;
        const nearRight = mx > padL + innerW - 64;
        return (
          <g pointerEvents="none">
            <line x1={mx} y1={padT} x2={mx} y2={padT + innerH}
              stroke="var(--tk-accent)" strokeWidth="1" strokeDasharray="4 3" opacity={0.85} />
            {marker.label ? (
              <text x={nearRight ? mx - 4 : mx + 4} y={padT + 10}
                textAnchor={nearRight ? "end" : "start"}
                fontFamily="var(--f-mono)" fontSize="9" fill="var(--tk-accent)">{marker.label}</text>
            ) : null}
          </g>
        );
      })() : null}

      {stale ? (
        <text x={W / 2} y={padT + innerH / 2} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="34" fill="var(--ink-20)" opacity={0.25} letterSpacing="0.3em">STALE</text>
      ) : null}

      {/* hover readout */}
      {cv != null ? (
        <g pointerEvents="none">
          <g transform={`translate(${Math.min(bx(cross!) + bw + 6, padL + innerW - 112)}, ${padT + 6})`}>
            <rect x="0" y="0" width="110" height="32" rx="3" fill="rgba(8,7,5,0.94)" stroke="var(--rule)" />
            <text x="8" y="14" fontFamily="var(--f-mono)" fontSize="9" fill={AXIS}>{labels ? labels[cross!] : `#${cross! + 1}`}</text>
            <text x="8" y="26" fontFamily="var(--f-mono)" fontSize="10" fill="var(--ink-80)">{format(cv)}</text>
          </g>
        </g>
      ) : null}
    </svg>
  );
}
