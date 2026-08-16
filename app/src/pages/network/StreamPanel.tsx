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
import { isStale, type FeedKey, type FeedStatus, type FeedStatusMap } from "@/data/feed-status";
import { sigmaBand, MIN_SIGMA_SAMPLES, type Band } from "./bands";
import { BandNote, SimLink } from "./BandPanels";
import { SeriesTile, MAX_NODES } from "./SeriesTile";
import { decimate, values, windowOf } from "./diffBuffer";
import { HISTORY_PATH } from "./useDifficultyStream";
import type { DiffStream } from "./useDifficultyStream";

/** Reserved height. Quoted at the call site's `reserve` too, so the skeleton
 *  and the real chart cannot drift — the CLS budget on this route is 0.005. */
export const STREAM_H = 190;

/** Appends come from the chain tier's block headers; the seed does not. */
const KEYS_BLOCKS = ["blocks"] as const satisfies readonly FeedKey[];

/* WHY THE PATH IS IMPORTED RATHER THAN RE-DECLARED, and why it is imported
   WITHOUT RENAMING — two separate lessons, both learned from a red gate.

   ONE COPY: a badge and a fetch holding independent copies of one path is how
   a badge comes to name an endpoint the fetch no longer calls — the same root
   cause as §1's two drifted range tables. So `HISTORY_PATH` lives with the
   hook that fetches it.

   NO ALIAS: this was first written `import { HISTORY_PATH as SEED_PATH }`, and
   `verify-resilience` §8 went red with "UNRESOLVABLE — an also= this gate
   cannot read is an also= it is not checking". That is the correct verdict and
   not a gate limitation to work around: a rename is a second name for one
   path, which is a smaller version of the very duplication the import removes.
   The gate refused to guess, said so, and named the fix. Imported plainly, it
   resolves — the run reports it as "1 via identifier … 1 sub-path".

   THIS LITERAL IS GATED AT ALL only because §8 was widened in this same
   release. It used to match `/\balso=\{?"(\/api\/[a-z0-9-]+)"/`, a class
   excluding `/`, so a SUB-PATH never matched: not counted, not resolved, not
   checked, under a message reading "every literal also=… has a real handler
   behind it". Writing `/api/xmr` here would have matched and passed, and would
   have been a less true statement about where this panel's data comes from. */

/** Human window label, from the server's own `window_seconds`. Never a literal
 *  window — the entire reason §1 returns an envelope. */
function fmtWindow(seconds: number): string {
  if (seconds >= 172800) return `${(seconds / 86400).toFixed(1)} days`;
  if (seconds >= 5400) return `${(seconds / 3600).toFixed(seconds % 3600 ? 1 : 0)} h`;
  return `${Math.round(seconds / 60)} min`;
}

/**
 * The chart's own "HH:MM → HH:MM UTC" caption, plus the SPAN — GENERAL, not a
 * 24h special case, because the defect it fixes recurs at any window that is
 * a whole multiple of a day.
 *
 * `.slice(11, 16)` (HH:MM only) is exact and correct for the ranges §1 serves
 * TODAY (1h/6h/12h/1d) with one exception: whenever `to - from` is a whole
 * number of days, `from` and `to` land on the SAME clock minute and the
 * caption reads e.g. "03:06 → 03:06 UTC" — which a reader parses as a
 * zero-width instant, not the panel's actual 24h claim. Measured on the
 * shipped default (1d): exactly that string. A future `2d` (or any Nd) key
 * hits the identical case, so this is fixed generally rather than for `1d`
 * alone — the same lesson CLAUDE.md records for the markets date axis
 * (p3·12b, "a tick must be locatable, not merely true").
 *
 * A duration suffix rather than a date prefix: it is far shorter (this panel
 * lives at 390px), it directly answers the question the collapsed string
 * raises ("is this an instant or a range?"), and the window IS this panel's
 * whole claim — its title already states it in exactly this unit
 * (`fmtWindow`). It also degrades correctly when there is no server envelope:
 * `to - from` is still the real held span even with `meta` null, so the
 * suffix never depends on a field that might be absent.
 */
function fmtCaptionRange(from: number, to: number): string {
  const hhmm = (t: number) => new Date(t * 1000).toISOString().slice(11, 16);
  return `${hhmm(from)} → ${hhmm(to)} UTC · ${fmtWindow(Math.max(0, to - from))}`;
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

/**
 * TWO SOURCES, TWO CLAIMS, AND THEY MUST NOT BE CONFLATED — a defect
 * `verify-failure` §B caught in this panel's first draft.
 *
 * The first version set the panel's `stale` from the STREAM's phase, which is
 * driven by the SEED request. Under the static gate server `/api/xmr/...` is
 * not served at all, so the seed 404s while the mocked `blocks` endpoint feeds
 * appends perfectly — and the panel rendered `data-panel-key="blocks"` with
 * `data-stale="true"` while the blocks endpoint was healthy. §B's assertion
 * ("killing mempool leaves the blocks-fed panels live") went red, correctly:
 * the panel was naming one endpoint and reporting another's health.
 *
 * The split, and it is a content/freshness split rather than a fudge:
 *
 *   FRESHNESS (the header chip, the watermark, the badge) comes from the
 *   endpoint this panel NAMES — `blocks`. That is what makes the line advance;
 *   if it stops, the chart is last-good and must say so.
 *
 *   CONTENT (how much window there is, whether a band can be drawn) comes from
 *   the seed. A dead seed does not make the chart stale — the appends are
 *   live and the line is genuinely current — it makes the WINDOW SHORTER and
 *   removes the band, which the copy below says in those words.
 *
 * A live chart over a short window is a true rendering. Marking it stale would
 * have been the lie, and the gate found it before a reader did.
 */

/** Field equality, never reference — `deriveAll` (feed-status.ts) rebuilds
 *  every key's `FeedStatus` as a fresh object literal whenever ANY key's
 *  observation changes, so `status.blocks` gets a new reference on a fast-tier
 *  tick even though nothing about `blocks` moved. This is the predicate that
 *  makes that distinguishable from an endpoint that genuinely re-answered. */
function blocksStatusEqual(a: FeedStatus, b: FeedStatus): boolean {
  return a === b || (a.phase === b.phase && a.at === b.at && a.fails === b.fails && a.reason === b.reason);
}

/** Field equality for a `Band` — derived purely from `ys` and `windowLabel`
 *  (see bands.ts's `sigmaBand`), so this is redundant with the `xs`/`ys`
 *  check below by construction, and kept anyway: a future change to the band
 *  arithmetic that adds a hidden dependency should not silently reopen a
 *  stale-band bug behind a memo boundary that was never asked to watch it. */
function bandEqual(a: Band | null, b: Band | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.lo === b.lo && a.hi === b.hi && a.warnLo === b.warnLo && a.warnHi === b.warnHi && a.source === b.source;
}

/**
 * `view` is rebuilt by the CALLER (`NetworkPage`) every one of ITS renders,
 * from `streamView(stream)` with a live `Date.now()`-derived `nowS` — so
 * `view.to` differs by a few seconds on nearly every call, REGARDLESS of
 * whether anything the reader can perceive changed. Comparing `view` by
 * reference (or by naive deep-equality including `from`/`to`) would defeat
 * the whole point of memoising `stream` upstream.
 *
 * This intentionally does NOT compare `from`/`to`. That is not a shortcut —
 * it is what "the axis STEPS, on real commits" (this file's own header)
 * actually requires: the window's right edge is allowed to be a few seconds
 * behind wall-clock between real content changes, because at every window
 * this endpoint serves that drift is 0.008–2.9 px/poll (below perception; see
 * the table above). `xs`/`ys`/`windowLabel` are the reader-visible content;
 * `from`/`to` are presentation metadata derived from wall-clock and are
 * allowed to lag until the content itself changes.
 */
function viewContentEqual(a: StreamView, b: StreamView): boolean {
  if (a === b) return true;
  if (a.windowLabel !== b.windowLabel) return false;
  if (a.xs.length !== b.xs.length || a.ys.length !== b.ys.length) return false;
  for (let i = 0; i < a.xs.length; i++) {
    if (a.xs[i] !== b.xs[i] || a.ys[i] !== b.ys[i]) return false;
  }
  return bandEqual(a.band, b.band);
}

export interface StreamPanelProps {
  stream: DiffStream;
  view: StreamView;
  status: FeedStatusMap;
}

/**
 * Skip the re-render unless something this panel actually shows has changed.
 *
 * `stream` is reference-compared, which is sound because `useDifficultyStream`
 * now memoises its return — a fast-only tick hands back the SAME `DiffStream`
 * object, so this is a cheap `Object.is` rather than a deep walk. `status` is
 * the whole per-endpoint map (five keys this panel never reads), so it is
 * narrowed to `status.blocks` and compared by field — the only key `KEYS_BLOCKS`
 * ever selects (see `NodeProvenance`'s own `status[k]` reads). `view` is
 * compared by content, deliberately excluding wall-clock-only drift (see
 * `viewContentEqual`'s own comment).
 *
 * Net effect, measured (see the handoff report): renders that used to fire on
 * every fast-tier tick (2 per tick, ~zero of them touching this panel's data)
 * now fire only when `status.blocks` or the stream's own content changes —
 * i.e. on the chain tier's own full pulls, which is what "tracks block
 * arrivals, not wall-clock" means for an endpoint that also gets a periodic
 * no-new-block refresh (`floorDue` in xmrirish-feed.ts).
 */
function streamPanelPropsEqual(prev: StreamPanelProps, next: StreamPanelProps): boolean {
  return (
    prev.stream === next.stream &&
    blocksStatusEqual(prev.status.blocks, next.status.blocks) &&
    viewContentEqual(prev.view, next.view)
  );
}

function StreamPanelImpl({ stream, view, status }: StreamPanelProps) {
  const { meta, phase, seededAt, rejected } = stream;
  const { xs, ys, from, to, windowLabel, band } = view;

  /** Published so a gate can assert the render count tracks COMMITS and not
   *  wall-clock. A ref, incremented in render: the value must reflect this
   *  render, which a state update or an effect could not do without causing
   *  the very re-render being counted. */
  const renders = React.useRef(0);
  renders.current += 1;

  /* FRESHNESS: the endpoint this panel names, never the seed. */
  const stale = isStale(status.blocks);
  const hasContent = ys.length > 0;
  const ready = hasContent || phase === "error";

  return (
    <PanelFrame
      title={`Difficulty · streaming${meta ? ` · ${fmtWindow(meta.windowSeconds)}` : ""} · ${ys.length} point${ys.length === 1 ? "" : "s"}`}
      dataKey={KEYS_BLOCKS.join(" ")}
      stale={stale}
      updatedAt={seededAt}
      /* keys+status, not a hand-passed phase: freshness is the named
         endpoint's, derived, and `verify-provenance` bans the literal form. */
      right={
        <NodeProvenance
          source="node" keys={KEYS_BLOCKS} status={status}
          detail={phase === "live" ? "seeded history + chain tier" : "chain tier only — seed unavailable"}
        />
      }
    >
      <div data-stream-renders={renders.current} data-stream-points={ys.length}>
        <PanelBoundary
          keys={KEYS_BLOCKS}
          also={HISTORY_PATH}
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
                caption={fmtCaptionRange(from, to)}
              />
            ) : (
              <div
                className="mono dim"
                style={{ minHeight: STREAM_H, display: "flex", alignItems: "center", fontSize: "var(--fs-mono)", color: "var(--ink-40)" }}
              >
                {phase === "error"
                  ? `${HISTORY_PATH} not answering — no difficulty history to stream`
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
            : phase === "live"
              ? "No band — the endpoint answered without a window envelope, and a band labelled from a client-side constant would be a claim this page cannot keep."
              : `No band — ${HISTORY_PATH} has not returned history, so this line is the chain tier's own block headers only: a SHORTER window, not a stale one. The line above is current.`}
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

/**
 * The public export. Memoised with `streamPanelPropsEqual` rather than the
 * default shallow-props comparison, because a shallow comparison would never
 * bail: `NetworkPage` (not memoised itself, and re-rendering on every tier's
 * every commit) hands this component a freshly-computed `view` object and a
 * freshly-deriveAll'd `status` map on every one of ITS renders regardless of
 * whether anything this panel reads actually changed.
 */
export const StreamPanel = React.memo(StreamPanelImpl, streamPanelPropsEqual);
