/**
 * pages/network/StreamPanel.tsx — the windowed, appending difficulty series
 * (D0828).
 *
 * ── WHAT "STREAMING" MEANS HERE, AND WHAT IT DELIBERATELY DOES NOT ────────
 *
 * The window is `[now − window_seconds, now]` and it is re-projected every
 * time the chain tier commits, so the axis advances because time does and old
 * readings leave the frame on their own. What it does NOT do is interpolate
 * between polls, and that refusal is MEASURED rather than stylistic:
 *
 *   window   px/poll (15 s tier, ~700 px plot)   px/second
 *   1h       2.917                               0.194
 *   6h       0.486                               0.032
 *   12h      0.243                               0.016
 *   1d       0.122                               0.008        ← the served default
 *
 * At the windows this endpoint actually serves (§1 contract: 1h/6h/12h/1d) a
 * per-frame glide advances the axis by between 2.9 px and 0.12 px PER POLL. At
 * the default 1d window that is 0.008 px/second — three orders of magnitude
 * below perception. A rAF loop drawing that would not be showing the reader
 * time passing; it would be showing them an animation, and this file's whole
 * subject is the difference. So the axis STEPS, on real commits, and the
 * motion path and the reduced-motion path are the same path.
 *
 * Consequences worth stating because they are usually expensive to buy:
 *   · The reduced-motion twin loses NOTHING — not a number, not a position,
 *     not a click target. There is no branch to keep in sync.
 *   · Render count does not grow with time. It grows with COMMITS, which is
 *     the honest denominator. `data-stream-renders` publishes the count so a
 *     gate can assert exactly that rather than take this comment's word.
 *   · No rAF is introduced, so there is no D0699 driver to gate and no second
 *     per-frame heartbeat on a data page.
 *
 * A new block arrives every ~120 s — one point per 8 chain ticks — so the line
 * genuinely extends about once every eight polls. That cadence IS the signal.
 */

import * as React from "react";
import { PanelFrame } from "@/design/primitives";
import { NodeProvenance } from "@/design/provenance";
import { PanelBoundary } from "@/design/PanelBoundary";
import { Swap, SkeletonBox } from "@/design/Skeleton";
import type { FeedKey } from "@/data/feed-status";
import { sigmaBand, MIN_SIGMA_SAMPLES, type Band } from "./bands";
import { BandNote, SimLink } from "./BandPanels";
import { SeriesTile, MAX_NODES } from "./SeriesTile";
import { decimate, values, windowOf } from "./diffBuffer";
import type { DiffStream } from "./useDifficultyStream";

/** Reserved height. Quoted at the call site's `reserve` too, so the skeleton
 *  and the real chart cannot drift — the CLS budget on this route is 0.005. */
export const STREAM_H = 190;

/** Appends come from the chain tier's block headers; the seed does not. */
const KEYS_BLOCKS = ["blocks"] as const satisfies readonly FeedKey[];

/**
 * The seed's own path, declared so `PanelBoundary` can name it in a failure.
 *
 * THIS LITERAL IS GATED, and the route by which it became gated is worth
 * recording. `verify-resilience.mjs` §8 used to match `also=` with
 * `/\balso=\{?"(\/api\/[a-z0-9-]+)"/` — a character class excluding `/`, with
 * the closing quote required immediately after. A SUB-PATH therefore never
 * matched at all: not counted, not resolved, not checked, under a message
 * reading "every literal also=… has a real handler behind it". Writing
 * `/api/xmr` here would have been matched and would have passed, and would
 * also have been a less true statement about where this panel's data comes
 * from — so the true path was written and the gap reported rather than the
 * claim trimmed to fit the instrument.
 *
 * §8 was widened in this same release by the gate owner and now captures
 * broadly (`[^"]*`) and judges explicitly, including the production-reachability
 * half a handler check alone would miss: Vercel serves `api/<seg>.js` at
 * `/api/<seg>` and nothing beneath it, so a sub-path is only real where
 * `vercel.json` rewrites `/api/<seg>/:path*`. Exactly one segment is rewritten
 * today — `xmr`, whose `?_p=` `api/xmr.js` parses — which is what makes this
 * three-segment path resolvable rather than a 404 that resolves on paper.
 */
const SEED_PATH = "/api/xmr/network/difficulty";

/** Human window label, from the server's own `window_seconds`. Never a literal
 *  window — the entire reason §1 returns an envelope. */
function fmtWindow(seconds: number): string {
  if (seconds >= 172800) return `${(seconds / 86400).toFixed(1)} days`;
  if (seconds >= 5400) return `${(seconds / 3600).toFixed(seconds % 3600 ? 1 : 0)} h`;
  return `${Math.round(seconds / 60)} min`;
}

/**
 * The projected window, computed ONCE and consumed twice — by this panel and
 * by the small-multiples tile for the same series.
 *
 * It is a plain function rather than a hook precisely so there is one
 * implementation: two call sites each deriving "the last 24 h of difficulty"
 * from the same envelope would agree the day they were written and nothing
 * would make them agree the day after. `heightAgreementPct` in
 * `useNodePopulation.ts` carries the same reasoning in its own docblock, for
 * the same defect found the same way.
 */
export interface StreamView {
  xs: number[];
  ys: number[];
  from: number;
  to: number;
  /** Derived from the SERVER's `window_seconds`/`range`, or null. */
  windowLabel: string | null;
  band: Band | null;
}

export function streamView(stream: DiffStream, nowS: number = Math.floor(Date.now() / 1000)): StreamView {
  const { points, meta } = stream;
  const latest = points.length ? points[points.length - 1].t : nowS;
  /* Miner timestamps are not monotonic and may sit slightly ahead of local
     clock; extending the right edge to the newest sample stops the tip being
     dropped by its own window. */
  const to = Math.max(nowS, latest);
  const from = meta ? to - meta.windowSeconds : (points.length ? points[0].t : to - 3600);

  const win = decimate(windowOf(points, from, to), MAX_NODES);
  const ys = values(win);
  const xs = win.map((p) => p.t);

  /* THE LABEL COMES FROM THE ENVELOPE OR THE BAND DOES NOT RENDER. A window
     label assembled client-side would duplicate the server's range table,
     which is the exact drift §1 exists to remove. No envelope ⇒ no claim. */
  const windowLabel = meta ? `${fmtWindow(meta.windowSeconds)} (range ${meta.range})` : null;
  const band = windowLabel ? sigmaBand(ys, windowLabel) : null;

  return { xs, ys, from, to, windowLabel, band };
}

export function StreamPanel({ stream, view }: { stream: DiffStream; view: StreamView }) {
  const { meta, phase, seededAt, rejected } = stream;
  const { xs, ys, from, to, windowLabel, band } = view;

  /** Published so a gate can assert the render count tracks COMMITS and not
   *  wall-clock. A ref, incremented in render: the value must reflect this
   *  render, which a state update or an effect could not do without causing
   *  the very re-render being counted. */
  const renders = React.useRef(0);
  renders.current += 1;

  const stale = phase === "stale";
  const hasContent = ys.length > 0;
  const ready = hasContent || phase === "error";

  return (
    <PanelFrame
      title={`Difficulty · streaming${meta ? ` · ${fmtWindow(meta.windowSeconds)}` : ""} · ${ys.length} point${ys.length === 1 ? "" : "s"}`}
      dataKey={KEYS_BLOCKS.join(" ")}
      stale={stale}
      updatedAt={seededAt}
      right={<NodeProvenance source="node" phase={phase} detail="header history + chain tier" />}
    >
      <div data-stream-renders={renders.current} data-stream-points={ys.length}>
        <PanelBoundary
          keys={KEYS_BLOCKS}
          also={SEED_PATH}
          reserve={STREAM_H}
          resetKeys={[seededAt, ys.length]}
        >
          <Swap ready={ready} reserve={STREAM_H} skeleton={<SkeletonBox h={STREAM_H} />}>
            {hasContent ? (
              <SeriesTile
                xs={xs} ys={ys}
                xDomain={[from, to]}
                band={band}
                height={STREAM_H}
                color="var(--p-50)"
                stale={stale}
                watermark
                toneByBand
                label={
                  `Difficulty over the last ${windowLabel ?? "available window"}: ` +
                  `${ys.length} block headers, oldest to newest, left to right.`
                }
                caption={`${new Date(from * 1000).toISOString().slice(11, 16)} → ${new Date(to * 1000).toISOString().slice(11, 16)} UTC`}
              />
            ) : (
              <div
                className="mono dim"
                style={{ minHeight: STREAM_H, display: "flex", alignItems: "center", fontSize: "var(--fs-mono)", color: "var(--ink-40)" }}
              >
                {phase === "error"
                  ? `${SEED_PATH} not answering — no difficulty history to stream`
                  : "Waiting for the first block-header history response"}
              </div>
            )}
          </Swap>
        </PanelBoundary>
      </div>

      {band ? (
        <BandNote band={band}>
          The window and its label come from the endpoint's own envelope, not from a constant here.
          Difficulty is the retarget controller's output — its feedback loop is the{" "}
          <SimLink to="/learn/sim?p=thermostat">Thermostat simulator</SimLink>.
        </BandNote>
      ) : (
        <p className="mono dim" style={{ fontSize: "var(--fs-mono)", margin: "6px 0 0", lineHeight: 1.5, color: "var(--ink-40)" }}>
          {ys.length && ys.length < MIN_SIGMA_SAMPLES
            ? `No band yet — a ±1σ envelope needs ${MIN_SIGMA_SAMPLES} samples and this window holds ${ys.length}.`
            : "No band — the endpoint has not returned a window envelope, and a band labelled from a client-side constant would be a claim this page cannot keep."}
        </p>
      )}

      {rejected > 0 ? (
        <p className="mono dim" style={{ fontSize: "var(--fs-mono)", margin: "6px 0 0", color: "var(--ink-40)" }}>
          {rejected} header{rejected === 1 ? "" : "s"} carried no usable timestamp and {rejected === 1 ? "was" : "were"} dropped rather than placed at an invented time.
        </p>
      ) : null}
    </PanelFrame>
  );
}
