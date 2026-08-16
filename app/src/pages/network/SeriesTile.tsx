/**
 * pages/network/SeriesTile.tsx — ONE chart primitive, two sizes.
 *
 * The streaming difficulty line (D0828) and every tile in the small-multiples
 * grid (D0837) are the SAME component at different heights. That is not a
 * convenience; it is the mechanism behind the grid's central claim, below.
 *
 * ── THE SCALE RULE, AND WHY THESE TILES DO NOT SHARE A Y-AXIS ─────────────
 *
 * Every tile scales to its OWN series' extent. What is shared is the GRAMMAR,
 * not the scale: identical height, identical padding fraction, identical band
 * rendering, identical tone thresholds, identical axis treatment.
 *
 * The reason is that the tiles carry DIFFERENT UNITS — difficulty in the
 * hundreds of billions, mempool depth in transactions, block fullness as a
 * fraction of a dynamic cap, cadence in seconds. A shared y-axis across those
 * is not a comparison, it is a category error: it would render every series
 * except the largest as a flat line at the bottom of its box, and the reader
 * would learn only which quantity happens to be numerically biggest — a fact
 * about units, not about the chain.
 *
 * So the eye is asked exactly one question per tile, and it is the same
 * question every time: **is this series inside its own band, or outside it?**
 * That question is scale-free, which is precisely why it survives being asked
 * of eleven different units side by side. Absolute height across tiles carries
 * no meaning and is not intended to.
 *
 * ── WHY SVG AND NOT CANVAS ────────────────────────────────────────────────
 *
 * A stated bound, not a hope: `MAX_NODES` caps the rendered vertex count per
 * tile and `decimate()` (diffBuffer.ts) enforces it, anchored at the NEWEST
 * sample so the tip always survives. At that bound SVG is comfortably cheaper
 * than a canvas plus its DPR/visibility/intersection machinery, and it keeps
 * the series in the accessibility tree and in find-in-page. The mempool
 * canvas discipline exists for views drawing thousands of marks; this draws at
 * most a few hundred and would be paying that tax for nothing.
 *
 * ── NO <text> INSIDE THE SVG ──────────────────────────────────────────────
 *
 * `preserveAspectRatio="none"` is what lets the x-axis stretch to the panel
 * width instead of letterboxing at 1000 units — and it would stretch every
 * glyph with it (~1.4x horizontally at 1440). Labels are therefore DOM, which
 * also keeps them inside `verify-legibility`'s reach; SVG presentation-attribute
 * font sizes are exempt from it by design and are the repo's standing
 * sub-12px-on-mobile hazard. Geometry scales; type does not.
 *
 * The single exception is the STALE watermark, which is its own SVG with the
 * DEFAULT aspect handling so the word is undistorted — the same construction
 * CadenceStrip uses, and it is required rather than decorative:
 * `verify-failure` §A counts any `.panel-b svg` as a chart and requires a
 * `text[data-decorative]` in that panel to AGREE with the panel's `data-stale`.
 * Both polarities matter — a watermark on a live panel fails just as a missing
 * one on a stale panel does.
 */

import * as React from "react";
import { classify, type Band } from "./bands";

/** Rendered vertex cap per tile. See "WHY SVG AND NOT CANVAS" above. */
export const MAX_NODES = 300;

/** viewBox width in user units. The SVG stretches to its box; this is arbitrary
 *  precision, not a pixel count. */
const VB_W = 1000;

/**
 * Vertical padding as a FRACTION of tile height, shared by every tile — this
 * is one of the four things that make the grid one instrument. A fixed pixel
 * pad would mean a 64px tile and a 200px chart had different proportions and
 * so were not, in fact, drawn the same way.
 */
const PAD_FRAC = 0.12;

const ZONE_STROKE: Record<string, string> = {
  healthy: "var(--g-50)",
  warn: "var(--y-50)",
  critical: "var(--r-50)",
};

export interface SeriesTileProps {
  /** Domain x per sample — real timestamps (seconds) for a time series, or
   *  indices for a session buffer. Must be the same length as `ys`. */
  xs: readonly number[];
  ys: readonly number[];
  /** Explicit x window. Omitted = fit to the data's own extent. Passing this is
   *  what makes the streaming line's axis advance with wall-clock while the
   *  session tiles stay index-fitted. */
  xDomain?: readonly [number, number];
  /** The ±kσ envelope, with its own provenance sentence. `null` renders none —
   *  never a band drawn from too few samples. */
  band?: Band | null;
  height: number;
  /** Series colour when no band verdict applies. */
  color?: string;
  stale?: boolean;
  /** Render the panel's STALE watermark from this tile. Exactly one tile per
   *  PANEL should do so — the gate's selector is panel-scoped. */
  watermark?: boolean;
  /** Screen-reader description; also the tile's visible caption when `caption`. */
  label: string;
  caption?: React.ReactNode;
  /** Tone the line by the LAST reading's zone rather than a fixed colour. */
  toneByBand?: boolean;
}

/** Linear map, guarding the degenerate single-value domain. */
function scale(v: number, d0: number, d1: number, r0: number, r1: number): number {
  if (!(d1 > d0)) return (r0 + r1) / 2;
  return r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
}

export function SeriesTile({
  xs, ys, xDomain, band, height, color = "var(--tk-accent)",
  stale, watermark, label, caption, toneByBand,
}: SeriesTileProps) {
  const H = height;
  const pad = H * PAD_FRAC;
  const innerH = H - 2 * pad;

  const n = Math.min(xs.length, ys.length);

  /* X DOMAIN — the caller's window, or the data's own extent. */
  const x0 = xDomain ? xDomain[0] : (n ? xs[0] : 0);
  const x1 = xDomain ? xDomain[1] : (n ? xs[n - 1] : 1);

  /* Y DOMAIN — this series' own extent, UNION the band's, so a band that sits
     outside the data is still visible. A band clipped out of frame would be a
     threshold the reader is told about and cannot see. */
  let yMin = Infinity, yMax = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = ys[i];
    if (!Number.isFinite(v)) continue;
    if (v < yMin) yMin = v;
    if (v > yMax) yMax = v;
  }
  if (band) {
    yMin = Math.min(yMin, band.lo);
    yMax = Math.max(yMax, band.hi);
  }
  const hasData = Number.isFinite(yMin) && Number.isFinite(yMax);
  if (!hasData) { yMin = 0; yMax = 1; }
  if (yMin === yMax) { yMin -= 1; yMax += 1; }

  const px = (v: number) => scale(v, x0, x1, 0, VB_W);
  const py = (v: number) => scale(v, yMin, yMax, H - pad, pad);   // SVG y grows down

  /* The polyline. Points outside the x window were dropped upstream by
     `windowOf` rather than clamped here — a clamp would stack every older
     reading on the left border at a time it does not belong to. */
  let d = "";
  for (let i = 0; i < n; i++) {
    if (!Number.isFinite(ys[i]) || !Number.isFinite(xs[i])) continue;
    d += (d ? "L" : "M") + px(xs[i]).toFixed(2) + " " + py(ys[i]).toFixed(2);
  }

  const last = n ? ys[n - 1] : null;
  const zone = band && last != null && Number.isFinite(last) ? classify(last, band) : null;
  const stroke = toneByBand && zone ? ZONE_STROKE[zone] : color;

  const bandTop = band ? py(band.hi) : 0;
  const bandBot = band ? py(band.lo) : 0;

  return (
    <div className="chart-box" style={{ position: "relative", width: "100%", height: H }}>
      <svg
        viewBox={`0 0 ${VB_W} ${H}`}
        width="100%"
        /* EXPLICIT height, always. `width="100%"` with a viewBox and no height
           lays the SVG out at the viewBox ASPECT RATIO, which at a 1400px panel
           is 1400 x (H/1000) — nothing like H — and `minHeight` only floors it.
           That cost CadenceStrip 52px of unreserved shift; the CLS budget on
           this route is 0.005. */
        height={H}
        preserveAspectRatio="none"
        style={{ display: "block", opacity: stale ? 0.45 : 1 }}
        role="img"
        aria-label={label}
      >
        {/* the band, drawn UNDER the series */}
        {band ? (
          <>
            <rect
              x={0} y={Math.min(bandTop, bandBot)} width={VB_W}
              height={Math.max(1, Math.abs(bandBot - bandTop))}
              fill="var(--tk-accent)" fillOpacity="0.07"
            />
            <line x1={0} y1={bandTop} x2={VB_W} y2={bandTop}
              stroke="var(--tk-accent)" strokeOpacity="0.28" strokeWidth="1"
              vectorEffect="non-scaling-stroke" />
            <line x1={0} y1={bandBot} x2={VB_W} y2={bandBot}
              stroke="var(--tk-accent)" strokeOpacity="0.28" strokeWidth="1"
              vectorEffect="non-scaling-stroke" />
          </>
        ) : null}

        {/* the series. `vectorEffect="non-scaling-stroke"` is load-bearing under
            preserveAspectRatio="none": without it the horizontal stretch (~1.4x
            at 1440) thickens vertical segments and thins horizontal ones, so a
            single line would render at two different weights depending only on
            its slope. */}
        {d ? (
          <path d={d} fill="none" stroke={stroke} strokeWidth="1.5"
            strokeLinejoin="round" strokeLinecap="round"
            vectorEffect="non-scaling-stroke" />
        ) : null}
      </svg>

      {caption ? (
        <span
          className="mono dim"
          style={{
            position: "absolute", left: 2, bottom: 2, pointerEvents: "none",
            fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)",
            color: "var(--ink-40)", lineHeight: 1, opacity: stale ? 0.45 : 1,
          }}
        >{caption}</span>
      ) : null}

      {/* Required, not decorative — see this file's header. */}
      {stale && watermark ? (
        <svg
          width="100%" height={H} viewBox={`0 0 ${VB_W} ${H}`}
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
          aria-hidden="true"
        >
          <text
            data-decorative
            x={VB_W / 2} y={H / 2 + 5} textAnchor="middle"
            fontFamily="var(--f-mono)" fontSize="26" fill="var(--ink-20)"
            opacity={0.25} letterSpacing="0.3em"
          >STALE</text>
        </svg>
      ) : null}
    </div>
  );
}
