/**
 * pages/markets/charts.tsx — hand-rolled SVG chart primitives for the Markets
 * surface. No third-party / CDN chart libraries (privacy invariant).
 *
 * Every chart measures its container (design/useChartMetrics.ts) and sets its
 * viewBox width to the measured CSS width, so ONE USER UNIT IS ONE CSS PIXEL.
 * That is what makes `fontSize={fs.tick}` mean 11 real pixels instead of 11
 * pre-scaling units — under the old fixed `viewBox="0 0 1000 H"`, a 358px-wide
 * phone render painted a 9.5 axis label at 3.4 CSS px. It also fixes a height
 * bug nobody had noticed: with a 1000-unit viewBox and no height attribute, the
 * intrinsic ratio squashed a `height={320}` chart to 114px on a phone.
 *
 * Consequence: every gutter that exists to make room for text is DERIVED from
 * that text (estTextW/labelStep/tickCount), never a constant — a fixed padL
 * clips the moment the type changes size. Below 420px the y labels move inside
 * the plot entirely.
 *
 * They render REAL data when given it; the source/status badge is the caller's
 * job (see SourceBadge in MarketsPage). prefers-reduced-motion disables the
 * mount fade.
 */

import * as React from "react";
import type { Candle, LineSeries, SeriesStatus } from "@/data/useMarketHistory";
import { useChartMetrics, estTextW, labelStep, tickCount, spreadLabels } from "@/design/useChartMetrics";

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

/** Keep a centred label inside the plot: half its own width from either edge.
 *  Replaces the hardcoded `- 50` clamps, which assumed a label width that only
 *  held while the type was 9.5px. */
function clampLabelX(x: number, text: string, fontPx: number, lo: number, hi: number): number {
  const half = estTextW(text.length, fontPx) / 2 + 2;
  return Math.max(lo + half, Math.min(x, hi - half));
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
  const boxRef = React.useRef<HTMLDivElement>(null);
  // Fluid mode: the viewBox width tracks the measured CSS width, so one user
  // unit IS one CSS px and a fontSize attribute is the rendered pixel size.
  const { w: W, ready, fs } = useChartMetrics(boxRef);

  if (!candles?.length) return null;
  const stale = status === "stale";
  const padT = 14;
  const volH = Math.max(28, Math.round(height * 0.16));
  const dateH = 22;
  const priceH = height - padT - volH - dateH - 10;
  const n = candles.length;

  const lo = Math.min(...candles.map((c) => c.l));
  const hi = Math.max(...candles.map((c) => c.h));
  const pad = (hi - lo || 1) * 0.06;
  const yMin = lo - pad, yMax = hi + pad, yRng = yMax - yMin || 1;
  const py = (v: number) => padT + priceH - ((v - yMin) / yRng) * priceH;

  // Gutters are DERIVED, not constants. They exist to make room for text, and
  // the text just changed size — a fixed padL:54 clipped "$105.0k" the moment
  // ticks became legible. Below 420px the y labels move INSIDE the plot, riding
  // above their own gridline, which reclaims ~55px of a 358px canvas.
  const yTicks = niceTicks(yMin, yMax, tickCount(priceH, fs.tick));
  const yInside = W < 420;
  const maxTickChars = Math.max(...yTicks.map((t) => fmtPrice(t).length));
  const padL = yInside ? 8 : Math.ceil(estTextW(maxTickChars, fs.tick)) + 10;
  const padR = Math.ceil(estTextW(fmtPrice(candles[n - 1].c).length, fs.label)) + 14;
  const innerW = Math.max(10, W - padL - padR);

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

  // Seven date ticks is fine at 1440px and unreadable at 390px. Deriving the
  // step from measured width is what stops the higher floor from turning into
  // a collision — the whole point of raising it is lost if the labels touch.
  const xStep = labelStep(n, innerW, fs.tick, 6);

  // 1 user unit == 1 CSS px now, so no scale conversion is needed.
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.round((e.clientX - rect.left - padL - (slot - cw) / 2) / slot);
    setCross(i >= 0 && i < n ? i : null);
  };

  const cc = cross != null ? candles[cross] : null;
  const tipW = Math.ceil(estTextW(22, fs.tick)) + 16;
  const tipH = fs.label * 4 + 14;

  return (
    <div ref={boxRef} className="chart-box" style={{ width: "100%", minHeight: height }}>
    {ready ? (
    <svg
      data-chart
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
          <text
            x={yInside ? padL + 3 : padL - 8}
            y={yInside ? py(t) - 4 : py(t) + 3}
            textAnchor={yInside ? "start" : "end"}
            fontFamily="var(--f-mono)" fontSize={fs.tick} fill={AXIS}
          >{fmtPrice(t)}</text>
        </g>
      ))}

      {/* x date ticks */}
      {candles.map((c, i) => (i % xStep === 0 ? (
        <g key={"x" + i}>
          <line x1={mid(i)} y1={padT + priceH} x2={mid(i)} y2={padT + priceH + 4} stroke={AXIS} />
          <text x={mid(i)} y={height - 6} textAnchor="middle" fontFamily="var(--f-mono)" fontSize={fs.tick} fill={AXIS}>{fmtDate(c.t, days)}</text>
        </g>
      ) : null))}

      {/* average line */}
      <line x1={padL} y1={py(avg)} x2={padL + innerW} y2={py(avg)} stroke="var(--ink-40)" strokeWidth="0.8" strokeDasharray="5 4" opacity={0.7} />
      <text x={padL + 4} y={py(avg) - 4} fontFamily="var(--f-mono)" fontSize={fs.tick} fill={AXIS}>avg {fmtPrice(avg)}</text>

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
      <text x={yInside ? padL + 3 : padL - 8} y={volTop + 9} textAnchor={yInside ? "start" : "end"} fontFamily="var(--f-mono)" fontSize={fs.tick} fill={AXIS}>VOL</text>
      <g opacity={stale ? 0.35 : 0.55}>
        {candles.map((c, i) => {
          if (!c.v) return null;
          const up = c.c >= c.o;
          const y = vy(c.v);
          return <rect key={"v" + i} x={cx(i)} y={y} width={cw} height={volTop + volH - y} fill={up ? UP_STROKE : DN_STROKE} />;
        })}
      </g>

      {/* high / low markers */}
      <g fontFamily="var(--f-mono)" fontSize={fs.label}>
        <circle cx={mid(hiIdx)} cy={py(candles[hiIdx].h)} r="2" fill={UP_STROKE} />
        <text x={clampLabelX(mid(hiIdx), `H ${fmtPrice(candles[hiIdx].h)}`, fs.label, padL, padL + innerW)} y={py(candles[hiIdx].h) - 6} textAnchor="middle" fill={UP_STROKE}>H {fmtPrice(candles[hiIdx].h)}</text>
        <circle cx={mid(loIdx)} cy={py(candles[loIdx].l)} r="2" fill={DN_STROKE} />
        <text x={clampLabelX(mid(loIdx), `L ${fmtPrice(candles[loIdx].l)}`, fs.label, padL, padL + innerW)} y={py(candles[loIdx].l) + 13} textAnchor="middle" fill={DN_STROKE}>L {fmtPrice(candles[loIdx].l)}</text>
      </g>

      {/* last-price line + pill */}
      <line x1={padL} y1={py(last)} x2={padL + innerW} y2={py(last)} stroke={lastUp ? UP_STROKE : DN_STROKE} strokeWidth="0.8" strokeDasharray="1 3" opacity={0.8} />
      <g transform={`translate(${padL + innerW + 3}, ${py(last)})`}>
        <rect x="0" y={-fs.label * 0.8} width={padR - 6} height={fs.label * 1.6} rx="2" fill={lastUp ? UP_STROKE : DN_STROKE} />
        <text x={(padR - 6) / 2} y={fs.label * 0.36} textAnchor="middle" fontFamily="var(--f-mono)" fontSize={fs.label} fill="#0b0a08" fontWeight={600}>{fmtPrice(last)}</text>
      </g>

      {/* period-change badge */}
      <g transform={`translate(${padL + 4}, ${padT + 4})`}>
        <text fontFamily="var(--f-mono)" fontSize={Math.round(fs.label * 1.15)} fill={changePct >= 0 ? UP_STROKE : DN_STROKE} fontWeight={600}>
          {changePct >= 0 ? "▲ +" : "▼ "}{changePct.toFixed(1)}%
        </text>
      </g>

      {stale ? (
        <text data-decorative x={W / 2} y={padT + priceH / 2} textAnchor="middle" fontFamily="var(--f-mono)" fontSize={Math.max(fs.label * 2, Math.min(34, W * 0.09))} fill="var(--ink-20)" opacity={0.25} letterSpacing="0.3em">STALE</text>
      ) : null}

      {/* crosshair + readout */}
      {cc ? (
        <g pointerEvents="none">
          <line x1={mid(cross!)} y1={padT} x2={mid(cross!)} y2={padT + priceH} stroke="var(--ink-40)" strokeDasharray="2 3" />
          <line x1={padL} y1={py(cc.c)} x2={padL + innerW} y2={py(cc.c)} stroke="var(--ink-40)" strokeDasharray="2 3" />
          <g transform={`translate(${Math.max(padL, Math.min(mid(cross!) + 8, padL + innerW - tipW))}, ${padT + 6})`}>
            <rect x="0" y="0" width={tipW} height={tipH} rx="3" fill="var(--surface-ground)" stroke="var(--rule)" />
            <text x="8" y={fs.label * 1.2} fontFamily="var(--f-mono)" fontSize={fs.tick} fill={AXIS}>{fmtDate(cc.t, days)}</text>
            <text x="8" y={fs.label * 2.4} fontFamily="var(--f-mono)" fontSize={fs.label} fill="var(--ink-80)">O {fmtPrice(cc.o)}  H {fmtPrice(cc.h)}</text>
            <text x="8" y={fs.label * 3.5} fontFamily="var(--f-mono)" fontSize={fs.label} fill="var(--ink-80)">L {fmtPrice(cc.l)}  C {fmtPrice(cc.c)}</text>
            <text x="8" y={fs.label * 4.6} fontFamily="var(--f-mono)" fontSize={fs.tick} fill={AXIS}>V {fmtVol(cc.v)}</text>
          </g>
        </g>
      ) : null}
    </svg>
    ) : null}
    </div>
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

/**
 * ChartLegend — swatch · label · last-% per series, laid out as wrapping HTML.
 *
 * Extracted from MarketsPage, which rendered exactly this markup beside a
 * `labels={false}` MultiLine. MultiLine now owns it, so there is ONE legend
 * implementation and it is correct at every width instead of two that agree
 * only by accident.
 */
export function ChartLegend({ series }: { series: LineSeries[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 8, fontFamily: "var(--f-mono)", fontSize: "var(--fs-chart-label)" }}>
      {series.map((s) => {
        const first = s.data.find((v) => v > 0) ?? s.data[0] ?? 1;
        const lastV = ((s.data[s.data.length - 1] ?? first) / first - 1) * 100;
        return (
          <span key={s.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
            <span style={{ width: 8, height: 2, background: s.color, boxShadow: `0 0 4px ${s.color}`, flexShrink: 0 }} />
            <span className="dim">{s.label}</span>
            <span style={{ color: s.color }}>{(lastV >= 0 ? "+" : "") + lastV.toFixed(1)}%</span>
            {s.status === "stale" ? <span className="dim">·stale</span> : null}
          </span>
        );
      })}
    </div>
  );
}

export function MultiLine({ series, days, height = 280, labels = true }: MultiLineProps) {
  const reduced = useReducedMotion();
  const fade = useMountFade(reduced);
  const boxRef = React.useRef<HTMLDivElement>(null);
  const { w: W, ready, fs } = useChartMetrics(boxRef);
  if (!series?.length) return null;

  const padT = 16, padB = 26;

  const norm = series.map((s) => {
    const first = s.data.find((v) => v > 0) ?? s.data[0] ?? 1;
    return { ...s, n: s.data.map((v) => (v / first - 1) * 100) };
  });
  const all = norm.flatMap((s) => s.n).filter((v) => isFinite(v));
  const min = Math.min(0, ...all), max = Math.max(0, ...all);
  const rng = max - min || 1;

  // padR was a flat 100 units — a guess that "ETH +23.0%" fits, which it does
  // not once the label is a real 12px. Decide from the actual longest legend
  // string, and if it would eat more than ~28% of the plot, drop the inline
  // legend entirely and render it below in HTML instead.
  const yTickChars = Math.max(...niceTicks(min, max, 5).map((t) => ((t > 0 ? "+" : "") + t.toFixed(0) + "%").length));
  // Same narrow-width treatment as the other charts: below 420px the % labels
  // ride above their own gridline inside the plot, which frees the left gutter
  // AND lifts the bottom-most label clear of the date row it used to sit on.
  const yInside = W < 420;
  const padL = yInside ? 8 : Math.ceil(estTextW(yTickChars, fs.tick)) + 8;
  const legendChars = Math.max(...series.map((s) => s.label.length + 9));
  const needPadR = Math.ceil(estTextW(legendChars, fs.label)) + 12;
  const inlineLegend = labels && W >= 520 && needPadR <= W * 0.28;
  const padR = inlineLegend ? needPadR : 14;
  const innerW = Math.max(10, W - padL - padR);
  const innerH = height - padT - padB;
  const y = (v: number) => padT + innerH - ((v - min) / rng) * innerH;
  const xOf = (i: number, len: number) => padL + (len <= 1 ? 0 : (i / (len - 1)) * innerW);

  const yTicks = niceTicks(min, max, tickCount(innerH, fs.tick));
  const ref = norm.reduce((a, b) => ((b.t?.length ?? 0) > (a.t?.length ?? 0) ? b : a), norm[0]);
  const refLen = ref.n.length;
  const xStep = labelStep(refLen, innerW, fs.tick, 6);

  // Two series that end close together used to paint their end-labels on top of
  // each other; push them apart before drawing.
  const endYs = spreadLabels(
    norm.map((s) => y(s.n[s.n.length - 1] ?? 0)),
    fs.label * 1.15, padT, height - padB,
  );

  return (
    <div ref={boxRef} className="chart-box" style={{ width: "100%", minHeight: height }}>
    {ready ? (<>
    <svg data-chart viewBox={`0 0 ${W} ${height}`} width="100%" style={{ display: "block", opacity: fade, transition: reduced ? "none" : "opacity 0.35s ease" }}>
      <defs>
        {norm.map((s, i) => (
          <linearGradient key={"g" + i} id={`ml-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={s.color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={s.color} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>

      {/* y gridlines + % labels */}
      {yTicks.map((t) => {
        // Drop a label that would land on the date row rather than draw it
        // there — the gridline still communicates the level.
        const ly = yInside ? y(t) - 4 : y(t) + 3;
        const clearOfDates = ly < height - padB + fs.tick * 0.4;
        return (
          <g key={"y" + t}>
            <line x1={padL} y1={y(t)} x2={padL + innerW} y2={y(t)} stroke={t === 0 ? "rgba(255,255,255,0.14)" : GRID} strokeDasharray={t === 0 ? undefined : "2 4"} />
            {clearOfDates ? (
              <text
                x={yInside ? padL + 3 : padL - 6}
                y={ly}
                textAnchor={yInside ? "start" : "end"}
                fontFamily="var(--f-mono)" fontSize={fs.tick} fill={AXIS}
              >{(t > 0 ? "+" : "") + t.toFixed(0)}%</text>
            ) : null}
          </g>
        );
      })}

      {/* x date ticks (from the longest real series) */}
      {ref.t ? ref.n.map((_, i) => (i % xStep === 0 ? (
        <text key={"x" + i} x={clampLabelX(xOf(i, refLen), fmtDate(ref.t![i], days), fs.tick, 0, W)} y={height - 6} textAnchor="middle" fontFamily="var(--f-mono)" fontSize={fs.tick} fill={AXIS}>{fmtDate(ref.t![i], days)}</text>
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
            {inlineLegend ? (
              <text x={padL + innerW + 5} y={endYs[si] + 3} fontFamily="var(--f-mono)" fontSize={fs.label} fill={s.color}>
                {s.label} {(lastV >= 0 ? "+" : "") + lastV.toFixed(1)}%{isStale ? " ·stale" : ""}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
    {/* Below the plot on narrow widths, where competing for horizontal space is
        what clipped it in the first place. */}
    {labels && !inlineLegend ? <ChartLegend series={series} /> : null}
    </>) : null}
    </div>
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
  const boxRef = React.useRef<HTMLDivElement>(null);
  const { w: W, ready, fs } = useChartMetrics(boxRef);

  if (!data?.length) return null;
  const n = data.length;
  const padT = 14;
  const dateH = xLabels ? 22 : 8;
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

  // Derived gutters — see CandleChart. `yInside` matters most here: sediment
  // renders AreaSeries at height 84, where a 55px left gutter is most of the
  // chart.
  const yTicks = niceTicks(yMin, yMax, tickCount(innerH, fs.tick));
  const yInside = W < 420;
  const padL = yInside ? 8 : Math.ceil(estTextW(Math.max(...yTicks.map((tk) => format(tk).length)), fs.tick)) + 10;
  const padR = Math.ceil(estTextW(format(data[n - 1]).length, fs.label)) + 14;
  const innerW = Math.max(10, W - padL - padR);

  const py = (v: number) => padT + innerH - ((v - yMin) / yRng) * innerH;
  const xOf = (i: number) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);

  const now = Date.now();
  const stepMs = (days * 86_400_000) / Math.max(1, n - 1);
  const tAt = (i: number) => (t && t[i] != null ? t[i] : now - (n - 1 - i) * stepMs);

  const xStep = labelStep(n, innerW, fs.tick, 6);

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
    const i = n <= 1 ? 0 : Math.round(((e.clientX - rect.left - padL) / innerW) * (n - 1));
    setCross(i >= 0 && i < n ? i : null);
  };
  const cv = cross != null ? data[cross] : null;
  const tipW = Math.ceil(estTextW(Math.max(12, format(cv ?? last).length + 4), fs.label)) + 16;
  const tipH = xLabels ? fs.label * 2.6 + 6 : fs.label * 1.6 + 4;

  return (
    <div ref={boxRef} className="chart-box" style={{ width: "100%", minHeight: height }}>
    {ready ? (
    <svg
      data-chart
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
          <text x={yInside ? padL + 3 : padL - 8} y={yInside ? py(tk) - 4 : py(tk) + 3} textAnchor={yInside ? "start" : "end"} fontFamily="var(--f-mono)" fontSize={fs.tick} fill={AXIS}>{format(tk)}</text>
        </g>
      ))}

      {/* x date ticks */}
      {xLabels ? data.map((_, i) => (i % xStep === 0 ? (
        <g key={"x" + i}>
          <line x1={xOf(i)} y1={padT + innerH} x2={xOf(i)} y2={padT + innerH + 4} stroke={AXIS} />
          <text x={clampLabelX(xOf(i), fmtDate(tAt(i), days), fs.tick, 0, W)} y={height - 6} textAnchor="middle" fontFamily="var(--f-mono)" fontSize={fs.tick} fill={AXIS}>{fmtDate(tAt(i), days)}</text>
        </g>
      ) : null)) : null}

      {/* area + line */}
      <g opacity={stale ? 0.5 : 1}>
        <path d={area} fill={`url(#${gradId})`} stroke="none" />
        <path d={line} fill="none" stroke={color} strokeWidth="1.6" style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
      </g>

      {/* high / low markers */}
      {markers && n > 1 ? (
        <g fontFamily="var(--f-mono)" fontSize={fs.label}>
          <circle cx={xOf(hiIdx)} cy={py(data[hiIdx])} r="2" fill={color} />
          <text x={clampLabelX(xOf(hiIdx), format(data[hiIdx]), fs.label, padL, padL + innerW)} y={py(data[hiIdx]) - 6} textAnchor="middle" fill={AXIS}>{format(data[hiIdx])}</text>
          <circle cx={xOf(loIdx)} cy={py(data[loIdx])} r="2" fill={color} opacity={0.65} />
          <text x={clampLabelX(xOf(loIdx), format(data[loIdx]), fs.label, padL, padL + innerW)} y={py(data[loIdx]) + 13} textAnchor="middle" fill={AXIS}>{format(data[loIdx])}</text>
        </g>
      ) : null}

      {/* last-value line + pill */}
      <line x1={padL} y1={py(last)} x2={padL + innerW} y2={py(last)} stroke={color} strokeWidth="0.8" strokeDasharray="1 3" opacity={0.8} />
      <g transform={`translate(${padL + innerW + 3}, ${py(last)})`}>
        <rect x="0" y={-fs.label * 0.8} width={padR - 6} height={fs.label * 1.6} rx="2" fill={color} />
        <text x={(padR - 6) / 2} y={fs.label * 0.36} textAnchor="middle" fontFamily="var(--f-mono)" fontSize={fs.label} fill="#0b0a08" fontWeight={600}>{format(last)}</text>
      </g>

      {/* period-change badge */}
      {n > 1 ? (
        <g transform={`translate(${padL + 4}, ${padT + 4})`}>
          <text fontFamily="var(--f-mono)" fontSize={Math.round(fs.label * 1.15)} fill={up ? UP_STROKE : DN_STROKE} fontWeight={600}>
            {(changePct >= 0 ? "▲ +" : "▼ ") + changePct.toFixed(1)}%
          </text>
        </g>
      ) : null}

      {stale ? (
        <text data-decorative x={W / 2} y={padT + innerH / 2} textAnchor="middle" fontFamily="var(--f-mono)" fontSize={Math.max(fs.label * 2, Math.min(34, W * 0.09))} fill="var(--ink-20)" opacity={0.25} letterSpacing="0.3em">STALE</text>
      ) : null}

      {/* crosshair + readout */}
      {cv != null ? (
        <g pointerEvents="none">
          <line x1={xOf(cross!)} y1={padT} x2={xOf(cross!)} y2={padT + innerH} stroke="var(--ink-40)" strokeDasharray="2 3" />
          <line x1={padL} y1={py(cv)} x2={padL + innerW} y2={py(cv)} stroke="var(--ink-40)" strokeDasharray="2 3" />
          <circle cx={xOf(cross!)} cy={py(cv)} r="2.5" fill={color} />
          <g transform={`translate(${Math.max(padL, Math.min(xOf(cross!) + 8, padL + innerW - tipW))}, ${padT + 6})`}>
            <rect x="0" y="0" width={tipW} height={tipH} rx="3" fill="var(--surface-ground)" stroke="var(--rule)" />
            {xLabels ? <text x="8" y={fs.label * 1.15} fontFamily="var(--f-mono)" fontSize={fs.tick} fill={AXIS}>{fmtDate(tAt(cross!), days)}</text> : null}
            <text x="8" y={xLabels ? fs.label * 2.3 : fs.label * 1.15} fontFamily="var(--f-mono)" fontSize={fs.label} fill="var(--ink-80)">{format(cv)}</text>
          </g>
        </g>
      ) : null}
    </svg>
    ) : null}
    </div>
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
  const boxRef = React.useRef<HTMLDivElement>(null);
  const { w: W, ready, fs } = useChartMetrics(boxRef);

  if (!data?.length) return null;
  const n = data.length;
  const padT = 14;
  const dateH = 22;
  const innerH = height - padT - dateH - 10;

  const lo = Math.min(0, ...data);
  const hi = Math.max(0, ...data);
  const yMin = baseline === "zero" ? Math.min(0, lo) : lo - (hi - lo || 1) * 0.08;
  const yMax = hi * 1.05 || 1;
  const yRng = yMax - yMin || 1;

  const yTicks = niceTicks(yMin, yMax, tickCount(innerH, fs.tick));
  const yInside = W < 420;
  const padL = yInside ? 8 : Math.ceil(estTextW(Math.max(...yTicks.map((tk) => format(tk).length)), fs.tick)) + 10;
  const padR = 16;
  const innerW = Math.max(10, W - padL - padR);

  const py = (v: number) => padT + innerH - ((v - yMin) / yRng) * innerH;

  const slot = innerW / n;
  const bw = Math.max(1, slot - Math.max(1.5, slot * 0.2));
  const bx = (i: number) => padL + i * slot + (slot - bw) / 2;

  const maxIdx = data.reduce((m, v, i) => (v > data[m] ? i : m), 0);
  // Bin labels are wider than dates, so measure the widest one we will draw.
  const xChars = labels ? Math.max(...labels.map((l) => l.length)) : 6;
  const xStep = labelStep(n, innerW, fs.tick, xChars);
  const now = Date.now();
  const baseY = py(Math.max(0, yMin));

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientX - rect.left - padL) / slot);
    setCross(i >= 0 && i < n ? i : null);
  };
  const cv = cross != null ? data[cross] : null;
  const tipW = Math.ceil(estTextW(Math.max(10, format(cv ?? 0).length + 2), fs.label)) + 16;

  return (
    <div ref={boxRef} className="chart-box" style={{ width: "100%", minHeight: height }}>
    {ready ? (
    <svg
      data-chart
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
          <text x={yInside ? padL + 3 : padL - 8} y={yInside ? py(tk) - 4 : py(tk) + 3} textAnchor={yInside ? "start" : "end"} fontFamily="var(--f-mono)" fontSize={fs.tick} fill={AXIS}>{format(tk)}</text>
        </g>
      ))}

      {/* x labels */}
      {labels ? data.map((_, i) => (i % xStep === 0 || i === n - 1 ? (
        <text key={"x" + i} x={clampLabelX(bx(i) + bw / 2, labels[i], fs.tick, 0, W)} y={height - 6} textAnchor="middle" fontFamily="var(--f-mono)" fontSize={fs.tick} fill={AXIS}>{labels[i]}</text>
      ) : null)) : endLabels ? (
        <>
          <text x={padL} y={height - 6} textAnchor="start" fontFamily="var(--f-mono)" fontSize={fs.tick} fill={AXIS}>{endLabels[0]}</text>
          <text x={padL + innerW} y={height - 6} textAnchor="end" fontFamily="var(--f-mono)" fontSize={fs.tick} fill={AXIS}>{endLabels[1]}</text>
        </>
      ) : t ? data.map((_, i) => (i % xStep === 0 ? (
        <text key={"x" + i} x={clampLabelX(bx(i) + bw / 2, fmtDate(t[i] ?? now, days), fs.tick, 0, W)} y={height - 6} textAnchor="middle" fontFamily="var(--f-mono)" fontSize={fs.tick} fill={AXIS}>{fmtDate(t[i] ?? now, days)}</text>
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
                fontFamily="var(--f-mono)" fontSize={fs.tick} fill="var(--tk-accent)">{marker.label}</text>
            ) : null}
          </g>
        );
      })() : null}

      {stale ? (
        <text data-decorative x={W / 2} y={padT + innerH / 2} textAnchor="middle" fontFamily="var(--f-mono)" fontSize={Math.max(fs.label * 2, Math.min(34, W * 0.09))} fill="var(--ink-20)" opacity={0.25} letterSpacing="0.3em">STALE</text>
      ) : null}

      {/* hover readout */}
      {cv != null ? (
        <g pointerEvents="none">
          <g transform={`translate(${Math.max(padL, Math.min(bx(cross!) + bw + 6, padL + innerW - tipW))}, ${padT + 6})`}>
            <rect x="0" y="0" width={tipW} height={fs.label * 2.6 + 6} rx="3" fill="var(--surface-ground)" stroke="var(--rule)" />
            <text x="8" y={fs.label * 1.15} fontFamily="var(--f-mono)" fontSize={fs.tick} fill={AXIS}>{labels ? labels[cross!] : `#${cross! + 1}`}</text>
            <text x="8" y={fs.label * 2.3} fontFamily="var(--f-mono)" fontSize={fs.label} fill="var(--ink-80)">{format(cv)}</text>
          </g>
        </g>
      ) : null}
    </svg>
    ) : null}
    </div>
  );
}
