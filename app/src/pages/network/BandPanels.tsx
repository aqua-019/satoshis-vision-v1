/**
 * pages/network/BandPanels.tsx — the D0832 band vocabulary and the block
 * cadence strip, for /live/network.
 *
 * Three pieces, and the first one is the point of the other two:
 *
 *   BandNote      the sentence under a chart naming where its threshold came
 *                 from. Takes a `Band`, not a string, so a band and its
 *                 receipts cannot be separated at a call site.
 *   HealthChip    one reading's zone, as shape + word + colour — never colour
 *                 alone (D0831 wants colourblind-safe deltas and a tinted pill
 *                 with no glyph is exactly what that rules out).
 *   CadenceStrip  every recent block a tick against the 120 s target.
 *
 * ── WHY THE STRIP CARRIES NO PER-TICK HEALTH BAND ─────────────────────
 *
 * This is the one place the implementation departs hardest from the mockup, and
 * it is arithmetic rather than taste. `bands.ts`'s `cadenceBand` docblock has
 * the full derivation; the short version is that Monero block arrivals are a
 * Poisson process, so a per-interval band at the mockup's 96–150 s would paint
 * 18.9% of a HEALTHY chain critical and leave only 16.3% of it inside
 * "healthy". The strip therefore draws the 120 s reference and the deviation
 * from it, and the BAND goes on the aggregate readout above, where 120 ± 2σ
 * with σ = 120/√n is exact.
 *
 * That is not a downgrade — it is the strip's actual thesis. A single interval
 * is not a health signal and never was; the RUN of ticks is, which is what the
 * mockup's own caption says and what the Metronome simulator explains.
 *
 * ── HONEST MOTION ─────────────────────────────────────────────────────
 *
 * Nothing here interpolates. A tick appears when the feed reports its block and
 * sits still until the next poll; there is no glide between polls, because a
 * glide would draw positions the chain never reported. The only thing that
 * moves is the strip's own contents shifting left as blocks arrive, which is
 * the data changing rather than an animation of it — so the reduced-motion path
 * loses nothing at all and needs no separate branch.
 */

import * as React from "react";
import { Link } from "react-router-dom";
import { BLOCK_TARGET_S, classify, type Band, type BandZone } from "./bands";

/* ── the receipts ─────────────────────────────────────────────────── */

/**
 * The sentence under a chart. `band` rather than `children`, deliberately: a
 * free-text note would let a caller print a threshold with no provenance, which
 * is the entire failure this component exists to prevent.
 */
export function BandNote({ band, children }: { band: Band; children?: React.ReactNode }) {
  return (
    <p
      className="mono dim"
      data-band-source="1"
      style={{ fontSize: "var(--fs-mono)", margin: "6px 0 0", lineHeight: 1.5, color: "var(--ink-40)" }}
    >
      {band.source}
      {children ? <> {children}</> : null}
    </p>
  );
}

const ZONE_GLYPH: Record<BandZone, string> = { healthy: "●", warn: "▲", critical: "■" };
const ZONE_WORD: Record<BandZone, string> = { healthy: "in band", warn: "above band", critical: "outside band" };
const ZONE_COLOR: Record<BandZone, string> = { healthy: "var(--g-50)", warn: "var(--y-50)", critical: "var(--r-50)" };

/**
 * A zone as SHAPE + WORD + colour. All three, always — the glyph and the word
 * each carry the full reading on their own, so the pill survives both
 * colourblindness and a monochrome print, and colour is the redundant channel
 * rather than the load-bearing one.
 */
export function HealthChip({ zone, label }: { zone: BandZone; label?: string }) {
  return (
    <span
      className="mono"
      data-health-zone={zone}
      style={{
        display: "inline-flex", alignItems: "baseline", gap: 5,
        fontSize: "var(--fs-mono)", color: ZONE_COLOR[zone], whiteSpace: "nowrap",
      }}
    >
      <span aria-hidden="true">{ZONE_GLYPH[zone]}</span>
      <span>{label ?? ZONE_WORD[zone]}</span>
    </span>
  );
}

/* ── the cadence strip ────────────────────────────────────────────── */

/** Reserved height. Quoted at the call site's `reserve` too, so the skeleton
 *  and the real strip cannot drift — the CLS budget on this route is 0.005. */
export const CADENCE_H = 118;

/**
 * Every recent interval a tick against the target.
 *
 * `intervals` is newest-LAST (oldest → newest, left → right), matching the
 * reading direction and the "run of ticks" the caption talks about.
 *
 * The vertical scale is capped at `±SPAN_S` around the target rather than
 * fitted to the data, for a reason worth stating: an exponential distribution
 * produces the occasional 600 s interval, and a fitted scale would squash every
 * ordinary tick into a hairline to make room for it. Overflowing ticks are
 * drawn at the cap AND marked, so the reader can see that the tick is clipped
 * rather than believing it is exactly at the cap.
 */
const SPAN_S = 240;

export function CadenceStrip({
  intervals, stale, targetS = BLOCK_TARGET_S,
}: { intervals: number[]; stale?: boolean; targetS?: number }) {
  const n = intervals.length;
  const W = 1000;                 // viewBox units; the SVG scales to its box
  const H = CADENCE_H;
  const padT = 10, padB = 18;
  const innerH = H - padT - padB;
  const mid = padT + innerH / 2;
  /* seconds → y. Positive deviation (slow) goes UP, matching the caption's
     "above the line is slow" — SVG y grows downward, hence the subtraction. */
  const yOf = (s: number) => mid - (Math.max(-SPAN_S, Math.min(SPAN_S, s - targetS)) / SPAN_S) * (innerH / 2);
  const barW = n > 0 ? W / n : W;
  const tickW = Math.max(1, Math.min(9, barW * 0.62));

  return (
    <div className="chart-box" style={{ width: "100%", minHeight: H }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: "block", opacity: stale ? 0.45 : 1 }}
        role="img"
        aria-label={
          n
            ? `Block cadence: ${n} recent intervals against the ${targetS} second target. ` +
              `Ticks above the centre line are slower than target, below are faster.`
            : "Block cadence: no intervals available"
        }
      >
        {/* the target line — the only reference on the strip, and the thing
            every tick is measured against */}
        <line x1={0} y1={mid} x2={W} y2={mid} stroke="var(--tk-accent)" strokeOpacity="0.5" strokeWidth="1" />

        {intervals.map((s, i) => {
          const x = i * barW + (barW - tickW) / 2;
          const y = yOf(s);
          const slow = s > targetS;
          const clipped = Math.abs(s - targetS) > SPAN_S;
          const h = Math.max(1, Math.abs(y - mid));
          return (
            <g key={i}>
              <rect
                x={x} y={Math.min(y, mid)} width={tickW} height={h}
                fill={slow ? "var(--y-50)" : "var(--c-50)"}
                opacity={clipped ? 0.95 : 0.62}
              />
              {/* A clipped tick is marked so the cap cannot be read as a
                  reading. Without this, a 600 s interval and a 360 s one are
                  the same bar. */}
              {clipped ? (
                <rect x={x} y={slow ? padT - 3 : padT + innerH} width={tickW} height={3} fill={slow ? "var(--y-50)" : "var(--c-50)"} />
              ) : null}
            </g>
          );
        })}

        {/* axis end-labels, in SVG only because they must sit inside the
            plot's own coordinate space; both are ≥12px at every rendered
            width because this strip is never inside a .mp-fit wrapper */}
        <text x={4} y={H - 5} fontFamily="var(--f-mono)" fontSize="12" fill="var(--ink-40)">older</text>
        <text x={W - 4} y={H - 5} textAnchor="end" fontFamily="var(--f-mono)" fontSize="12" fill="var(--ink-40)">newer</text>
        <text x={W - 4} y={padT + 11} textAnchor="end" fontFamily="var(--f-mono)" fontSize="12" fill="var(--ink-40)">
          slow ↑ · target {targetS}s · ↓ fast
        </text>
      </svg>
    </div>
  );
}

/**
 * The cross-link under a panel. Kept here rather than inline at the call sites
 * so both simulator links are built the same way and neither can drift into a
 * hand-typed path — `R.LEARN_SIM` plus a registry id from
 * `views/protocol-meta.ts`, which is the idiom this page already uses for
 * Skyline.
 */
export function SimLink({ to, children }: { to: string; children: React.ReactNode }) {
  return <Link to={to} className="acc" data-sim-link={to}>{children}</Link>;
}

/** Zone for one reading against one band — re-exported so call sites do not
 *  import `classify` and `Band` separately just to render a chip. */
export function zoneOf(v: number | null, band: Band | null): BandZone {
  if (v == null || band == null) return "healthy";
  return classify(v, band);
}
