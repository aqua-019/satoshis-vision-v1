/**
 * pages/network/SmallMultiples.tsx — the D0837 grid.
 *
 * ── THE SCALE RULE ────────────────────────────────────────────────────────
 *
 * **Every tile scales to its OWN series' extent. What is shared is the band
 * grammar and the axis treatment, never the y-axis.**
 *
 * That sentence is the answer to "why don't these share a y-axis", and it is
 * a decision rather than an omission. The tiles carry different UNITS —
 * difficulty in the hundreds of billions, mempool depth in transactions,
 * fullness as a fraction of a dynamic cap, cadence in seconds. Forcing one
 * y-axis across them would flatten every series except the numerically
 * largest into a hairline, and the reader would come away knowing which
 * quantity has the biggest numbers. That is a fact about units, not about the
 * chain.
 *
 * What IS held identical across every tile, and is enforced structurally by
 * all of them being one component (`SeriesTile`) rather than by review:
 *
 *   · identical height           (`TILE_H`)
 *   · identical padding fraction (`PAD_FRAC`, inside SeriesTile)
 *   · identical band rendering   (same rect + two rules, same opacities)
 *   · identical tone thresholds  (`classify`, from bands.ts, one implementation)
 *   · identical axis treatment   (no y-axis at all; the band IS the reference)
 *
 * So the eye is asked one scale-free question per tile — *is this series
 * inside its own band?* — and asking it eleven times across eleven units is
 * meaningful in a way that comparing eleven absolute heights is not.
 *
 * ── WHY A TILE MAY CARRY NO BAND ──────────────────────────────────────────
 *
 * `sigmaBand` returns `null` under `MIN_SIGMA_SAMPLES`, and a session buffer
 * starts empty on a cold load. A tile in that state draws its line and says
 * "no band yet" rather than drawing an envelope over three points — a σ over
 * n=2 is noise wearing a Greek letter, and a band is an authority claim.
 */

import * as React from "react";
import { PanelFrame } from "@/design/primitives";
import { NodeProvenance } from "@/design/provenance";
import type { FeedPhase } from "@/data/feed-status";
import { classify, type Band } from "./bands";
import { HealthChip } from "./BandPanels";
import { SeriesTile } from "./SeriesTile";

/** One tile's height. Shared by every tile — see the scale rule above. */
export const TILE_H = 64;

/** Header + caption + gap above each tile's chart box, measured from the
 *  rendered rows rather than counted from a formula. Used only to reserve. */
export const TILE_CHROME_H = 38;

/** Minimum tile width before the grid wraps. At 390px this yields one column,
 *  which is what keeps the 12px type floor reachable inside a 64px tile. */
const TILE_MIN_PX = 190;

export interface TileSpec {
  id: string;
  title: string;
  /** Unit, printed once per tile — the compensation for not sharing an axis. */
  unit: string;
  xs: readonly number[];
  ys: readonly number[];
  band: Band | null;
  color: string;
  stale: boolean;
  /** Formats the latest reading for the tile's own readout. */
  format: (v: number) => string;
}

export function SmallMultiples({
  specs, phase,
}: { specs: readonly TileSpec[]; phase: FeedPhase }) {
  /* One watermark per PANEL, not per tile: verify-failure's selector is
     panel-scoped and four STALE words inside one panel would be noise. The
     first STALE tile carries it, so the flag cannot disagree with the panel. */
  const firstStale = specs.findIndex((s) => s.stale);
  const anyStale = firstStale >= 0;

  return (
    <PanelFrame
      title={`Small multiples · ${specs.length} series, each on its own scale`}
      stale={anyStale}
      right={<NodeProvenance source="node" phase={phase} detail="one band grammar" />}
    >
      <div
        data-small-multiples={specs.length}
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(auto-fit, minmax(${TILE_MIN_PX}px, 1fr))`,
          gap: 12,
        }}
      >
        {specs.map((s, i) => {
          const last = s.ys.length ? s.ys[s.ys.length - 1] : null;
          const zone = s.band && last != null && Number.isFinite(last) ? classify(last, s.band) : null;
          return (
            <div key={s.id} data-tile={s.id} style={{ minHeight: TILE_H + TILE_CHROME_H }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                <span className="kicker" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.title}</span>
                {zone ? <HealthChip zone={zone} /> : <span className="mono dim" style={{ fontSize: "var(--fs-mono)", color: "var(--ink-40)" }}>no band</span>}
              </div>
              <SeriesTile
                xs={s.xs} ys={s.ys}
                band={s.band}
                height={TILE_H}
                color={s.color}
                stale={s.stale}
                watermark={i === firstStale}
                toneByBand
                label={
                  `${s.title}: ${s.ys.length} samples in ${s.unit}. ` +
                  (s.band ? `Band is ${s.band.source}` : "No band — too few samples.")
                }
              />
              <div className="mono dim" style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 3, fontSize: "var(--fs-mono)", color: "var(--ink-40)" }}>
                <span>{s.unit}</span>
                <span style={{ color: "var(--ink-80)" }}>{last != null && Number.isFinite(last) ? s.format(last) : "—"}</span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mono dim" style={{ fontSize: "var(--fs-mono)", margin: "10px 0 0", lineHeight: 1.5, color: "var(--ink-40)" }}>
        Each tile is scaled to its own series — the units differ, so heights are not comparable between
        tiles and are not meant to be. What is shared is the grammar: same height, same padding, same ±1σ
        band rendering, same thresholds. The one question every tile answers is whether its latest reading
        sits inside its own band.
      </p>
    </PanelFrame>
  );
}
