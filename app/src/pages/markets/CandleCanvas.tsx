/**
 * pages/markets/CandleCanvas.tsx — the /live/markets hero: candles on canvas,
 * a brush context strip, and the accessible table that ships with them.
 *
 * WHY CANVAS. The SVG CandleChart this replaces emitted three nodes per candle
 * (wick line, body rect, volume rect). At the counts the granularity ladder now
 * reaches — 361 bars at 90D, and any brush window in between — that is over a
 * thousand nodes rebuilt on every window change, and the brush changes the
 * window on every pointermove. Canvas costs a fixed number of draw calls
 * instead, so dragging is O(1) in DOM work.
 *
 * THE PER-FRAME BOUND, AND ITS MECHANISM. Every candle is a rect and a line;
 * both are batched into ONE path per colour, so the whole series costs the same
 * number of calls whether it holds 40 candles or 420:
 *
 *     clear                              1
 *     y gridlines                        1 stroke
 *     x gridlines                        1 stroke
 *     wicks            up/down           2 strokes
 *     bodies           up/down           2 fills + 2 strokes
 *     volume sub-bars  up/down           2 fills
 *     average rule + last-price rule     2 strokes
 *     crosshair (only while hovering)    1 stroke
 *                                       ── 14 draw calls, upper bound ──
 *
 * `ctx.shadowBlur` appears nowhere: it is a full-canvas blur per draw call, and
 * it is gated out of the mempool views for exactly that reason. The reasoning
 * travels even though this gate does not.
 *
 * NO TEXT ON THE CANVAS. Every glyph here is a DOM node positioned over the
 * stage. Canvas glyphs are invisible to verify-legibility, to every collision
 * sweep, to find-in-page, to translation and to a screen reader — four mempool
 * views paid for that lesson and this surface does not re-buy it. The canvas
 * draws geometry; the overlay draws language.
 *
 * D0847 — THE TABLE IS NOT A NICETY. A canvas has no accessibility tree at all,
 * so the table below is the only way this chart can be read by a screen reader,
 * and it doubles as the small-viewport and find-in-page path. It lists what is
 * DRAWN, not what was fetched, so it moves with the brush; `data-candle-count`
 * on the root and the table's own row count are two independent expressions of
 * one number, which is what makes the parity checkable rather than asserted.
 *
 * MOTION. There is none, and that is deliberate rather than a reduced-motion
 * branch: the chart is a still image that changes when the data or the window
 * changes, so `prefers-reduced-motion` costs it nothing except the mount fade.
 * Wheel/pinch zoom (D0836) is NOT implemented — see the note on BrushStrip.
 */

import * as React from "react";
import type { Candle, PriceSamples, SeriesStatus } from "@/data/useMarketHistory";
import { attachVolume } from "@/data/useMarketHistory";
import { useReducedMotion } from "@/design/useReducedMotion";
import { useChartMetrics, estTextW, tickCount } from "@/design/useChartMetrics";
import { canvasCursor } from "@/design/chart-kit";
import { cssColor } from "@/design/canvasColor";
import {
  clearTimeCursor, containsT, setTimeCursor, toggleTimeCursorPin, useTimeCursorSync,
} from "@/design/timeCursor";
import { TimeAnnotations, placeFlags, type LayerState } from "./annotations";
import {
  BODY_FILL,
  DAY_MS,
  axisStepMs,
  axisTicks,
  fmtAxisDate,
  resolveSeries,
  tableStride,
  type DrawnSeries,
} from "./candle-data";

export interface TimeWindow { from: number; to: number }

export interface CandleCanvasProps {
  /** FINE base — CoinGecko's own 4h OHLC over 30 days. */
  fine: Candle[] | null;
  /** MID base — hourly samples over 90 days; also the volume carrier. */
  mid: PriceSamples | null;
  /** DEEP base — daily samples over 365 days. */
  deep: PriceSamples | null;
  window: TimeWindow;
  onWindow: (w: TimeWindow) => void;
  /** The whole fetched span, which is what the brush shows. */
  fullSpan: TimeWindow | null;
  height?: number;
  status?: SeriesStatus;
  /** Reported upward so the panel header can name the granularity. */
  onSeries?: (s: DrawnSeries | null) => void;
  /** D0833 layer toggles. Omit to draw no annotations at all. */
  annLayers?: LayerState | null;
  /** Placement counts reported upward so the panel can print the honest note
   *  about what this window does NOT show. */
  onFlags?: (p: { inView: number; outside: number; unplaceable: number }) => void;
}

const PAD = { t: 14, r: 12, b: 24, l: 56 };
const VOL_FRAC = 0.16;
const BRUSH_H = 62;
const MIN_WINDOW_MS = 6 * 3_600_000; // six hours: below this a candle has no bucket

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

/** ISO day for the table's date column — unambiguous, sortable, locale-free. */
function isoStamp(t: number, bucketMs: number): string {
  const d = new Date(t).toISOString();
  return bucketMs < DAY_MS ? d.slice(0, 16).replace("T", " ") + "Z" : d.slice(0, 10);
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

/** DPR cap. A 3× phone would otherwise allocate 9× the pixels for a chart whose
 *  finest feature is a 1px rule; the mempool canvases cap at 2 for the same
 *  reason and this matches them rather than inventing a second policy. */
const dpr = (): number => Math.min(2, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);

interface Geom {
  W: number; H: number;
  padL: number; innerW: number; priceH: number; volTop: number; volH: number;
  yMin: number; yMax: number;
  x: (t: number) => number;
  y: (v: number) => number;
  slotPx: number;
}

function geometry(s: DrawnSeries, win: TimeWindow, W: number, H: number, tickFs: number): Geom | null {
  const { candles, bucketMs } = s;
  if (!candles.length) return null;
  let lo = Infinity, hi = -Infinity;
  for (const c of candles) { if (c.l < lo) lo = c.l; if (c.h > hi) hi = c.h; }
  if (!isFinite(lo) || !isFinite(hi)) return null;
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.06;
  const yMin = lo - pad, yMax = hi + pad;
  const yRng = yMax - yMin || 1;

  const ticks = niceTicks(yMin, yMax, 5);
  const widest = Math.max(...ticks.map((t) => fmtPrice(t).length));
  // Gutters exist to make room for TEXT, so they are derived from it — the same
  // rule charts.tsx has always followed. Below 420 the y labels ride inside the
  // plot, which reclaims ~50px of a 358px canvas.
  const yInside = W < 420;
  const padL = yInside ? 8 : Math.ceil(estTextW(widest, tickFs)) + 10;
  const innerW = Math.max(10, W - padL - PAD.r);
  const volH = Math.max(24, Math.round(H * VOL_FRAC));
  const priceH = Math.max(40, H - PAD.t - volH - PAD.b - 8);
  const volTop = PAD.t + priceH + 8;

  const span = Math.max(1, win.to - win.from);
  return {
    W, H, padL, innerW, priceH, volTop, volH, yMin, yMax,
    x: (t) => padL + ((t - win.from) / span) * innerW,
    y: (v) => PAD.t + priceH - ((v - yMin) / yRng) * priceH,
    slotPx: (bucketMs / span) * innerW,
  };
}

/* ══ the canvas painter ══════════════════════════════════════════════ */

/**
 * `yTicks`/`xTicks` are PASSED IN, not recomputed here.
 *
 * They were computed twice — once by the painter for its gridlines, once by the
 * component for its DOM labels — with different arguments: the painter hardcoded
 * a font size of 11 and a tick count of 5, the labels used `fs.tick` and
 * `tickCount(priceH, …)`. Two derivations of "where the gridlines go" agree only
 * as long as nobody touches either, and the whole point of putting the text in
 * the DOM is that the line and its label are now in different systems. One array
 * makes them the same line by construction.
 */
function paint(
  cv: HTMLCanvasElement, s: DrawnSeries, g: Geom, win: TimeWindow,
  cursorT: number | null, stale: boolean,
  yTicks: number[], xTicks: number[],
): void {
  const d = dpr();
  const wantW = Math.max(2, Math.round(g.W * d));
  const wantH = Math.max(2, Math.round(g.H * d));
  if (cv.width !== wantW) cv.width = wantW;
  if (cv.height !== wantH) cv.height = wantH;
  const ctx = cv.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(d, 0, 0, d, 0, 0);
  ctx.clearRect(0, 0, g.W, g.H);

  // Colours resolved ONCE per paint, never per candle: cssColor() reads
  // getComputedStyle, and doing that inside the loop would make a 420-bar
  // window 420 style resolutions.
  const C = {
    grid: cssColor("--line-d"),
    axis: cssColor("--ink-40"),
    up: cssColor("--status-up"),
    down: cssColor("--status-down"),
    accent: cssColor("--tk-accent"),
  };
  const dim = stale ? 0.5 : 1;

  // 1 · y gridlines — one path, one stroke
  ctx.beginPath();
  for (const t of yTicks) {
    const y = Math.round(g.y(t)) + 0.5;
    ctx.moveTo(g.padL, y); ctx.lineTo(g.padL + g.innerW, y);
  }
  ctx.strokeStyle = C.grid; ctx.lineWidth = 1; ctx.setLineDash([2, 4]); ctx.stroke();

  // 2 · x gridlines — one path, one stroke
  ctx.beginPath();
  for (const t of xTicks.slice(1, -1)) {
    const x = Math.round(g.x(t)) + 0.5;
    ctx.moveTo(x, PAD.t); ctx.lineTo(x, PAD.t + g.priceH);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // 3-5 · the series itself. Two passes, up and down, each one path per shape
  //       family — this is the whole bound: four paths, six calls, any N.
  const bw = Math.max(1, g.slotPx * BODY_FILL);
  const half = bw / 2;
  const maxV = Math.max(1, ...s.candles.map((c) => c.v));
  const vy = (v: number) => g.volTop + g.volH - (v / maxV) * g.volH;

  for (const up of [true, false]) {
    const col = up ? C.up : C.down;
    let n = 0;
    // wicks
    ctx.beginPath();
    for (const c of s.candles) {
      if ((c.c >= c.o) !== up) continue;
      n++;
      const x = Math.round(g.x(c.t) + g.slotPx / 2) + 0.5;
      ctx.moveTo(x, g.y(c.h)); ctx.lineTo(x, g.y(c.l));
    }
    if (!n) continue;
    ctx.globalAlpha = dim;
    ctx.strokeStyle = col;
    ctx.lineWidth = Math.max(1, Math.min(2, bw * 0.14));
    ctx.stroke();

    // bodies
    ctx.beginPath();
    for (const c of s.candles) {
      if ((c.c >= c.o) !== up) continue;
      const cx = g.x(c.t) + g.slotPx / 2;
      const y0 = g.y(Math.max(c.o, c.c));
      const h = Math.max(0.8, Math.abs(g.y(c.o) - g.y(c.c)));
      ctx.rect(cx - half, y0, bw, h);
    }
    ctx.fillStyle = col;
    ctx.globalAlpha = dim * 0.62;
    ctx.fill();
    ctx.globalAlpha = dim;
    ctx.lineWidth = 1;
    ctx.stroke();

    // volume sub-bars, aligned 1:1 under the candles
    ctx.beginPath();
    for (const c of s.candles) {
      if ((c.c >= c.o) !== up || !c.v) continue;
      const cx = g.x(c.t) + g.slotPx / 2;
      const y = vy(c.v);
      ctx.rect(cx - half, y, bw, g.volTop + g.volH - y);
    }
    ctx.fillStyle = col;
    ctx.globalAlpha = dim * 0.5;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // 6 · average + last-price rules
  const avg = s.candles.reduce((a, c) => a + c.c, 0) / s.candles.length;
  const last = s.candles[s.candles.length - 1];
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(g.padL, Math.round(g.y(avg)) + 0.5); ctx.lineTo(g.padL + g.innerW, Math.round(g.y(avg)) + 0.5);
  ctx.strokeStyle = C.axis; ctx.lineWidth = 1; ctx.globalAlpha = 0.7; ctx.stroke();
  ctx.setLineDash([1, 3]);
  ctx.beginPath();
  ctx.moveTo(g.padL, Math.round(g.y(last.c)) + 0.5); ctx.lineTo(g.padL + g.innerW, Math.round(g.y(last.c)) + 0.5);
  ctx.strokeStyle = last.c >= s.candles[0].o ? C.up : C.down; ctx.globalAlpha = 0.85; ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);

  // 7 · crosshair.
  //
  // THE DOMAIN GUARD IS THE WHOLE POINT OF THE SYNC (D0834). `cursorT` no
  // longer comes from this canvas — any of the four time-axis charts can write
  // it, and the group charts show the RANGE while this one shows the brushed
  // WINDOW, so a moment that exists over there routinely does not exist here.
  // Drawing it anyway would put the rule at `x` outside [padL, padL+innerW],
  // over the y-axis gutter or past the right edge; CLAMPING it to the edge
  // would be worse, because a rule pinned to the boundary reads as "the cursor
  // is here" when the honest answer is "this chart does not cover that
  // moment". Nothing is the honest answer, and `containsT` is the one
  // predicate every consumer asks.
  if (containsT(cursorT, win.from, win.to)) {
    const x = Math.round(g.x(cursorT)) + 0.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x, PAD.t); ctx.lineTo(x, g.volTop + g.volH);
    ctx.strokeStyle = C.accent; ctx.globalAlpha = 0.6; ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
  }
}

/* ══ the brush ═══════════════════════════════════════════════════════ */

/**
 * The context strip: the whole fetched span as one closing-price area, with a
 * draggable window over it. Drag the middle to pan, an edge to resize,
 * double-click to reset — and the window is a real focusable element with arrow
 * keys, because a pointer-only control on a data surface is a control half the
 * audience does not have.
 *
 * WHEEL / PINCH ZOOM (D0836) IS DELIBERATELY ABSENT. It would have to
 * preventDefault on a wheel event over a tall scrolling page to work at all,
 * which takes the page's own scroll away from a reader who was only passing
 * through the chart; and momentum pan would put a rAF loop on the one hero in
 * this app that is otherwise completely motion-free. Neither carries a reading.
 * The three pointer gestures plus the keyboard cover the same ground.
 */
function BrushStrip({
  samples, window: win, onWindow, fullSpan, width, annLayers,
}: {
  samples: { t: number[]; p: number[] } | null;
  window: TimeWindow;
  onWindow: (w: TimeWindow) => void;
  fullSpan: TimeWindow;
  width: number;
  annLayers: LayerState | null;
}) {
  const cvRef = React.useRef<HTMLCanvasElement>(null);
  const hostRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<{ mode: "move" | "l" | "r"; t0: number; from: number; to: number } | null>(null);

  const total = Math.max(1, fullSpan.to - fullSpan.from);
  const frac = (t: number) => Math.min(1, Math.max(0, (t - fullSpan.from) / total));

  React.useLayoutEffect(() => {
    const cv = cvRef.current;
    if (!cv || !width) return;
    const d = dpr();
    cv.width = Math.max(2, Math.round(width * d));
    cv.height = Math.max(2, Math.round(BRUSH_H * d));
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.clearRect(0, 0, width, BRUSH_H);
    if (!samples || samples.t.length < 2) return;
    let lo = Infinity, hi = -Infinity;
    for (const v of samples.p) { if (v < lo) lo = v; if (v > hi) hi = v; }
    const rng = hi - lo || 1;
    const accent = cssColor("--tk-accent");
    // One path, one fill, one stroke — the strip redraws on every pointermove
    // of a drag, so its own cost has to be a constant too.
    ctx.beginPath();
    for (let i = 0; i < samples.t.length; i++) {
      const x = frac(samples.t[i]) * width;
      const y = BRUSH_H - 4 - ((samples.p[i] - lo) / rng) * (BRUSH_H - 12);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.lineTo(width, BRUSH_H); ctx.lineTo(0, BRUSH_H); ctx.closePath();
    ctx.globalAlpha = 0.18; ctx.fillStyle = accent; ctx.fill();
    ctx.globalAlpha = 0.75; ctx.strokeStyle = accent; ctx.lineWidth = 1; ctx.stroke();
    ctx.globalAlpha = 1;
  }, [samples, width, fullSpan.from, fullSpan.to]);

  const tAt = (clientX: number): number => {
    const el = hostRef.current;
    if (!el) return win.from;
    const r = el.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - r.left) / Math.max(1, r.width)));
    return fullSpan.from + f * total;
  };

  const clampWin = (from: number, to: number): TimeWindow => {
    const span = Math.max(MIN_WINDOW_MS, Math.min(total, to - from));
    let f = Math.max(fullSpan.from, Math.min(from, fullSpan.to - span));
    return { from: f, to: f + span };
  };

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const mode = (e.target as HTMLElement).dataset.brushHandle as "l" | "r" | undefined;
    const t = tAt(e.clientX);
    if (mode) dragRef.current = { mode, t0: t, from: win.from, to: win.to };
    else if (t >= win.from && t <= win.to) dragRef.current = { mode: "move", t0: t, from: win.from, to: win.to };
    else {
      // A click on bare track re-centres the current span there rather than
      // doing nothing — the alternative (start a new window from zero width) is
      // one twitch away from a 6-hour window nobody asked for.
      const span = win.to - win.from;
      onWindow(clampWin(t - span / 2, t + span / 2));
      return;
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dt = tAt(e.clientX) - d.t0;
    if (d.mode === "move") onWindow(clampWin(d.from + dt, d.to + dt));
    else if (d.mode === "l") onWindow(clampWin(Math.min(d.from + dt, d.to - MIN_WINDOW_MS), d.to));
    else onWindow(clampWin(d.from, Math.max(d.to + dt, d.from + MIN_WINDOW_MS)));
  };

  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const span = win.to - win.from;
    const step = e.shiftKey ? span : span / 8;
    if (e.key === "ArrowLeft") { e.preventDefault(); onWindow(clampWin(win.from - step, win.to - step)); }
    else if (e.key === "ArrowRight") { e.preventDefault(); onWindow(clampWin(win.from + step, win.to + step)); }
    else if (e.key === "+" || e.key === "=") { e.preventDefault(); onWindow(clampWin(win.from + span * 0.15, win.to - span * 0.15)); }
    else if (e.key === "-") { e.preventDefault(); onWindow(clampWin(win.from - span * 0.2, win.to + span * 0.2)); }
    else if (e.key === "Home") { e.preventDefault(); onWindow({ ...fullSpan }); }
  };

  const l = frac(win.from) * 100;
  const r = frac(win.to) * 100;

  /* THE WHOLE REASON THE STRIP CARRIES FLAGS. The plot shows only the brushed
     window, so an event three months outside it is invisible and the reader
     has no way to know it is there. The strip spans the ENTIRE fetched span,
     so a flag out here is a visible reason to travel — and clicking it takes
     you there. Its projection is `frac(t) * width`: full-bleed, no gutter,
     nothing like the plot's, which is why `placeFlags` takes `xOf` rather than
     deriving one. */
  const brushFlags = React.useMemo(
    () => (annLayers && width
      ? placeFlags(fullSpan.from, fullSpan.to, annLayers, (t) => frac(t) * width)
      : { groups: [], outside: 0, unplaceable: 0 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `frac` closes over fullSpan/total, both listed
    [annLayers, width, fullSpan.from, fullSpan.to],
  );

  return (
    <div
      ref={hostRef}
      className="cc-brush"
      data-candle-brush=""
      style={{ height: BRUSH_H }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={() => { dragRef.current = null; }}
      onPointerCancel={() => { dragRef.current = null; }}
      onDoubleClick={() => onWindow({ ...fullSpan })}
    >
      <canvas ref={cvRef} className="cc-brush-canvas" aria-hidden="true" />
      <div className="cc-brush-mask" style={{ left: 0, width: `${l}%` }} />
      <div className="cc-brush-mask" style={{ left: `${r}%`, right: 0 }} />
      <div
        className="cc-brush-win"
        data-brush-window=""
        style={{ left: `${l}%`, width: `${Math.max(0.5, r - l)}%` }}
        tabIndex={0}
        role="group"
        aria-label={`Chart window: ${new Date(win.from).toISOString().slice(0, 10)} to ${new Date(win.to).toISOString().slice(0, 10)}. Arrow keys pan, plus and minus zoom, Home resets.`}
        onKeyDown={onKey}
      >
        <span className="cc-brush-grip" data-brush-handle="l" aria-hidden="true" />
        <span className="cc-brush-grip cc-brush-grip-r" data-brush-handle="r" aria-hidden="true" />
      </div>
      <TimeAnnotations
        placement={brushFlags}
        compact
        onZoom={(from, to) => onWindow(clampWin(from - (to - from) * 0.5, to + (to - from) * 0.5))}
      />
    </div>
  );
}

/* ══ the hero ════════════════════════════════════════════════════════ */

/**
 * A cluster's own interval is often far narrower than `MIN_WINDOW_MS`, and
 * zooming to it exactly would put its flags hard against both edges. Pad to
 * 25% either side, floor at the brush's own minimum, and never leave the
 * fetched span — the same clamp `BrushStrip` applies to a drag.
 */
function padWindow(from: number, to: number): TimeWindow {
  const pad = Math.max((to - from) * 0.25, MIN_WINDOW_MS / 4);
  const f = from - pad;
  return { from: f, to: Math.max(to + pad, f + MIN_WINDOW_MS) };
}

export function CandleCanvasImpl({
  fine, mid, deep, window: win, onWindow, fullSpan, height = 320, status = "live", onSeries,
  annLayers = null, onFlags,
}: CandleCanvasProps) {
  const reduced = useReducedMotion();
  const boxRef = React.useRef<HTMLDivElement>(null);
  const cvRef = React.useRef<HTMLCanvasElement>(null);
  const { w: measured, ready, fs } = useChartMetrics(boxRef);

  /* THE CURSOR IS A REF, NOT STATE — and this is a byte-for-byte removal of a
     re-render, not an addition of one. It was `useState<number | null>`, so
     every pointermove over this canvas re-rendered the hero and everything the
     hero renders (the label layer, the brush, the D0847 table's memo chain).
     Now a move mutates a ref, the shared store coalesces the frame, and the
     subscriber repaints the canvas and mutates four text nodes. See
     design/timeCursor.ts for why the store is not React state either. */
  const cursorRef = React.useRef<number | null>(null);
  const tipRef = React.useRef<HTMLSpanElement>(null);
  const tipRows = React.useRef<(HTMLElement | null)[]>([]);

  const series = React.useMemo(
    () => resolveSeries(win.from, win.to, { fine, mid, deep }),
    [win.from, win.to, fine, mid, deep],
  );

  // Volume rides the sample bases; the FINE base is /ohlc, which carries none.
  const withVol = React.useMemo(() => {
    if (!series) return null;
    if (!series.derived) {
      // Prefer the FINER source. `mid ?? deep` alone would hand daily samples
      // to 4h buckets whenever the 90-day fetch is the one that failed;
      // attachVolume refuses that outright, so preferring mid here is about
      // getting volume AT ALL in the common case, not about correctness.
      const src = mid ?? deep;
      // No window is passed: the candles are clipped at CANDLE granularity, so
      // clipping the volume at SAMPLE granularity made one bar's two halves
      // describe different spans. See attachVolume's header.
      return { ...series, candles: attachVolume(series.candles, src, series.bucketMs) };
    }
    return series;
  }, [series, mid, deep]);

  React.useEffect(() => { onSeries?.(withVol); }, [withVol, onSeries]);

  const geom = React.useMemo(
    () => (withVol && measured ? geometry(withVol, win, measured, height, fs.tick) : null),
    [withVol, win, measured, height, fs.tick],
  );

  /* CLIPPED TO THE PLOT. `niceTicks` rounds outward to a round number, so the
     top and bottom rungs routinely sit ABOVE yMax / BELOW yMin — in SVG they
     were clipped by the viewBox and nobody noticed. Over a canvas the label
     layer has no viewport of its own, so a "$500" tick escaped the panel and
     rendered against the page background above the chart. Seen in the 90D
     render; there is no equivalent of a viewBox to hide behind here. */
  const priceTicks = React.useMemo(
    () => (geom ? niceTicks(geom.yMin, geom.yMax, tickCount(geom.priceH, fs.tick)).filter((t) => t >= geom.yMin && t <= geom.yMax) : []),
    [geom, fs.tick],
  );
  const dateTicks = React.useMemo(
    () => (geom ? axisTicks(win.from, win.to, geom.innerW, fs.tick) : []),
    [geom, win.from, win.to, fs.tick],
  );
  const dateStep = axisStepMs(dateTicks);

  /* D0833 placement, in the PLOT's own pixel space — `geom.x` is the same
     projection the crosshair and the candles use, so a flag and the bar it
     annotates cannot drift apart. Recomputed with the window because that is
     exactly when it changes; it is O(49) over a frozen array. */
  const plotFlags = React.useMemo(
    () => (geom && annLayers
      ? placeFlags(win.from, win.to, annLayers, geom.x)
      : { groups: [], outside: 0, unplaceable: 0 }),
    [geom, annLayers, win.from, win.to],
  );
  const inView = plotFlags.groups.reduce((a, g) => a + g.members.length, 0);
  React.useEffect(
    () => onFlags?.({ inView, outside: plotFlags.outside, unplaceable: plotFlags.unplaceable }),
    [inView, plotFlags.outside, plotFlags.unplaceable, onFlags],
  );

  /* ONE APPLY, held in a ref so both the render path and the cursor
     subscription drive the identical code. Reassigned during render rather
     than memoised on purpose: it closes over `geom`, `win`, `withVol` and the
     two tick arrays, and a stale closure here would paint the previous
     window's candles under the current cursor. */
  const applyRef = React.useRef<() => void>(() => {});
  applyRef.current = () => {
    const cv = cvRef.current;
    if (!cv || !withVol || !geom) return;
    const t = cursorRef.current;
    paint(cv, withVol, geom, win, t, status === "stale", priceTicks, dateTicks);

    // The hovered candle: the one whose bucket CONTAINS the cursor's time.
    // Absent when the cursor is outside this chart's window, which is the
    // shared-cursor case — the reading and the crosshair appear and disappear
    // together, because they are the same claim.
    const tip = tipRef.current;
    if (!tip) return;
    let hit: Candle | null = null;
    if (containsT(t, win.from, win.to)) {
      for (const c of withVol.candles) if (t >= c.t && t < c.t + withVol.bucketMs) { hit = c; break; }
    }
    if (!hit) {
      tip.hidden = true;
      // Emptied, not merely hidden: verify-markets-dom scans `.cc-labels > span`
      // for a sub-11px glyph and skips empty nodes, so a persistently-mounted
      // tip must carry text only while it is making a claim.
      for (const r of tipRows.current) if (r) r.textContent = "";
      return;
    }
    tip.hidden = false;
    tip.style.left = `${Math.min(geom.padL + geom.innerW - 150, Math.max(geom.padL, geom.x(hit.t) + 8))}px`;
    const [d0, d1, d2, d3] = tipRows.current;
    if (d0) d0.textContent = isoStamp(hit.t, withVol.bucketMs);
    if (d1) d1.textContent = `O ${fmtPrice(hit.o)}  H ${fmtPrice(hit.h)}`;
    if (d2) d2.textContent = `L ${fmtPrice(hit.l)}  C ${fmtPrice(hit.c)}`;
    if (d3) d3.textContent = `V ${hit.v ? fmtVol(hit.v) : "—"}`;
  };

  React.useLayoutEffect(() => { applyRef.current(); });
  useTimeCursorSync((s) => { cursorRef.current = s.t; applyRef.current(); });

  /** Pointer x → a moment in THIS chart's window, or null past its edges. */
  const tOf = (e: React.PointerEvent<HTMLCanvasElement>): number | null => {
    if (!geom) return null;
    const pos = canvasCursor(e as unknown as { nativeEvent: MouseEvent; currentTarget: HTMLCanvasElement });
    if (!pos) return null;
    const f = (pos.x - geom.padL) / Math.max(1, geom.innerW);
    if (f < -0.02 || f > 1.02) return null;
    return win.from + Math.min(1, Math.max(0, f)) * (win.to - win.from);
  };

  const onPointer = (e: React.PointerEvent<HTMLCanvasElement>) => setTimeCursor(tOf(e));

  /* Tap to pin, tap again to release. A pin is real state: it survives
     pointerleave and it is what makes the sync usable on a touch device at
     all, where "hover" ends the moment the finger lifts. The tolerance is one
     BUCKET — "the same moment" is a different number on a 4h candle than on a
     daily sample, so each chart passes its own. */
  const onPin = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const t = tOf(e);
    if (t != null) toggleTimeCursorPin(t, (withVol?.bucketMs ?? 0) / 2);
  };

  const drawn = withVol?.candles.length ?? 0;
  const stride = tableStride(drawn);
  const rows = React.useMemo(
    () => (withVol ? withVol.candles.filter((_, i) => i % stride === 0) : []),
    [withVol, stride],
  );

  const span = win.to - win.from;
  const yInside = (measured || 0) < 420;
  const first = withVol?.candles[0];
  const last = withVol?.candles[withVol.candles.length - 1];
  const changePct = first && last ? ((last.c - first.o) / (first.o || 1)) * 100 : 0;

  return (
    <div
      ref={boxRef}
      className="chart-box cc-root"
      data-candle-count={drawn}
      data-candle-gran={withVol?.granularity ?? ""}
      data-candle-base={withVol?.base ?? ""}
      style={{ width: "100%", minHeight: height }}
    >
      {ready && geom && withVol ? (
        <>
          <div
            className="cc-stage"
            style={{ height, opacity: 1, transition: reduced ? "none" : "opacity var(--d-3) var(--e-standard)" }}
          >
            <canvas
              ref={cvRef}
              className="cc-canvas"
              style={{ width: "100%", height }}
              role="img"
              aria-label={`XMR/USD candles, ${drawn} bars at ${withVol.granularity}. The table below carries the same data.`}
              onPointerMove={onPointer}
              onPointerDown={onPointer}
              onClick={onPin}
              onPointerLeave={clearTimeCursor}
            />
            {/* ── the language layer. Nothing below is painted. ── */}
            <div className="cc-labels" aria-hidden="true">
              {priceTicks.map((t) => (
                <span
                  key={"y" + t}
                  className="cc-ytick"
                  style={{
                    top: geom.y(t),
                    left: yInside ? geom.padL + 3 : 0,
                    width: yInside ? undefined : geom.padL - 8,
                    textAlign: yInside ? "left" : "right",
                    transform: yInside ? "translateY(-100%)" : "translateY(-50%)",
                  }}
                >{fmtPrice(t)}</span>
              ))}
              {dateTicks.map((t, i) => (
                <span
                  key={"x" + i}
                  className="cc-xtick"
                  style={{
                    left: geom.x(t),
                    top: geom.volTop + geom.volH + 4,
                    transform: i === 0 ? "none" : i === dateTicks.length - 1 ? "translateX(-100%)" : "translateX(-50%)",
                  }}
                >{fmtAxisDate(t, dateStep, win.to - win.from)}</span>
              ))}
              <span className="cc-vol-label" style={{ top: geom.volTop, left: yInside ? geom.padL + 3 : 0, width: yInside ? undefined : geom.padL - 8, textAlign: yInside ? "left" : "right" }}>VOL</span>
              {last ? (
                <span
                  className="cc-pill"
                  style={{
                    top: geom.y(last.c),
                    left: geom.padL + geom.innerW,
                    background: last.c >= (first?.o ?? last.c) ? "var(--status-up)" : "var(--status-down)",
                  }}
                >{fmtPrice(last.c)}</span>
              ) : null}
              <span
                className="cc-change"
                style={{ left: geom.padL + 4, top: PAD.t + 2, color: changePct >= 0 ? "var(--status-up)" : "var(--status-down)" }}
              >{(changePct >= 0 ? "▲ +" : "▼ ") + changePct.toFixed(1)}%</span>
              {status === "stale" ? <span className="cc-stale" data-decorative>STALE</span> : null}
              {/* Mounted unconditionally and filled imperatively — the whole
                  point of the ref cursor is that a hover changes no React
                  tree. `hidden` and empty text move together; see applyRef. */}
              <span
                ref={tipRef}
                className="cc-tip"
                data-candle-tip=""
                hidden
                style={{ top: PAD.t + 6 }}
              >
                <b ref={(el) => { tipRows.current[0] = el; }} />
                <span ref={(el) => { tipRows.current[1] = el; }} />
                <span ref={(el) => { tipRows.current[2] = el; }} />
                <span ref={(el) => { tipRows.current[3] = el; }} />
              </span>
            </div>

            {/* D0833 — the annotation layer sits ABOVE the label layer and is
                the only thing in the stage that takes pointer events besides
                the canvas. It is not inside `.cc-labels`, which is
                aria-hidden: a flag is a link and has to reach the a11y tree. */}
            {annLayers ? (
              <TimeAnnotations
                placement={plotFlags}
                top={PAD.t}
                bottom={height - (PAD.t + geom.priceH)}
                onZoom={(from, to) => onWindow(padWindow(from, to))}
              />
            ) : null}
          </div>

          {fullSpan ? (
            <BrushStrip
              samples={deep ?? mid ?? (fine ? { t: fine.map((c) => c.t), p: fine.map((c) => c.c) } : null)}
              window={win}
              onWindow={onWindow}
              fullSpan={fullSpan}
              width={measured}
              annLayers={annLayers}
            />
          ) : null}
        </>
      ) : null}

      {/* D0847 — always in the DOM, never display:none. A screen reader has no
          other way in, and `hidden`/`display:none` would take it away again. */}
      <table className="cc-table" data-candle-table="" data-table-stride={stride} data-table-rows={rows.length}>
        <caption>
          {drawn
            ? `XMR/USD — ${drawn} candles at ${withVol?.granularity ?? "—"}, ` +
              `${new Date(win.from).toISOString().slice(0, 10)} to ${new Date(win.to).toISOString().slice(0, 10)}` +
              (stride > 1 ? `. Listing every ${stride}${stride === 2 ? "nd" : stride === 3 ? "rd" : "th"} candle (${rows.length} rows).` : ".")
            : "XMR/USD candles — no data for this window."}
        </caption>
        <thead>
          <tr>
            <th scope="col">Bucket</th>
            <th scope="col">Open</th>
            <th scope="col">High</th>
            <th scope="col">Low</th>
            <th scope="col">Close</th>
            <th scope="col">Volume</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.t}>
              <th scope="row">{isoStamp(c.t, withVol?.bucketMs ?? DAY_MS)}</th>
              <td>{fmtPrice(c.o)}</td>
              <td>{fmtPrice(c.h)}</td>
              <td>{fmtPrice(c.l)}</td>
              <td>{fmtPrice(c.c)}</td>
              <td>{c.v ? fmtVol(c.v) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const CandleCanvas = React.memo(CandleCanvasImpl);
