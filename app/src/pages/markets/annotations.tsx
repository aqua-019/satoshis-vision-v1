/**
 * pages/markets/annotations.tsx — the annotation layer (D0833).
 *
 * Dated events from the site's own timeline, placed on a time axis. The DATA is
 * `@/data/timeline` — the same 49 events `/learn/timeline` renders, extracted to
 * a lazy leaf so both surfaces read one source. There is no markets-only copy of
 * the history and there must never be one.
 *
 * ── EVERYTHING HERE IS DOM ────────────────────────────────────────────
 *
 * Not one glyph is painted. The hero's own header says why for its price
 * labels and the reasoning is identical for a flag: a canvas symbol is
 * invisible to `verify-legibility`, to every collision sweep, to find-in-page,
 * to translation and to a screen reader, and a flag is a LINK — it has to be
 * focusable and it has to have an accessible name. The canvas draws geometry;
 * this draws language.
 *
 * ── HONEST DATES ──────────────────────────────────────────────────────
 *
 * The timeline is editorial and much of it is imprecise: "2013 – 2014",
 * "Mid-2026 (tentative)", a bare "2026". `tlSpan()` turns each display string
 * into the INTERVAL it denotes, and this layer renders that interval:
 *
 *   · day-precise event      → a point flag
 *   · anything wider         → a point flag at the interval's START plus a
 *                              translucent BAND covering the interval, so the
 *                              reader sees the uncertainty rather than a
 *                              confident dot at a midpoint nobody wrote down
 *   · `tent` (tentative)     → the dot is hollow and the band is dashed
 *
 * and the tooltip prints `ev.d` VERBATIM — never a formatted `iso`. The ISO
 * fields position a flag; they never become text. That is the whole guarantee,
 * and `verify-markets-dom` §6 asserts it by comparing the rendered date string
 * against `d` for every visible flag.
 *
 * WIDE INTERVALS ARE DROPPED, NOT STRETCHED. An event denoting a whole year is
 * meaningless as a position inside a 30-day window — its band would cover the
 * plot and say nothing. Above `MAX_SPAN_FRAC` of the visible window it is not
 * drawn at all and is counted separately in the layer's note, which is why a
 * 30-day window on this data reads "no events in view · 8 in the fetched year"
 * rather than three full-width smears.
 *
 * ── CLUSTERING ────────────────────────────────────────────────────────
 *
 * `CLUSTER_MIN_PX = 26`, which is the mockup's own literal
 * (docs/v6-mockups/markets-network-mockup.html:513 `const MIN=26`), not a taste
 * call. Neighbours closer than that merge into a count badge and the badge
 * re-anchors to the group's mean x — so zooming in genuinely separates them
 * rather than re-laying the same overlap out differently.
 */

import * as React from "react";
import { TL_CAT, TL_EVENTS, tlSpan, type TlCat, type TlEvent } from "@/data/timeline";
// scripts/routes.mjs is the single authority for the 13 real route paths — a
// retyped "/learn" here is the fifth route list CLAUDE.md spent a release
// deleting. It is already in the eager entry (App.tsx imports it), so reading
// it from this lazy chunk costs no bytes anywhere.
import { R } from "../../../scripts/routes.mjs";

/** The mockup's literal. See the header. */
const CLUSTER_MIN_PX = 26;
/** An interval wider than this fraction of the window carries no position. */
const MAX_SPAN_FRAC = 0.6;
/** Below this the band is indistinguishable from the flag's own rule. */
const MIN_BAND_PX = 2;

export type LayerState = Record<TlCat, boolean>;

export const ALL_LAYERS: LayerState = { bitcoin: true, monero: true, crossover: true, regulatory: true };

export const TL_CATS = Object.keys(TL_CAT) as TlCat[];

interface Placed {
  ev: TlEvent;
  /** flag x, in the host's CSS pixels */
  px: number;
  /** band start/end in px; equal when the event is day-precise */
  bx0: number;
  bx1: number;
}

export interface FlagGroup {
  px: number;
  members: Placed[];
  /** the merged interval, for the zoom-to-cluster affordance */
  from: number;
  to: number;
}

export interface FlagPlacement {
  groups: FlagGroup[];
  /** events the layers allow but the window excludes */
  outside: number;
  /** events inside the window whose interval is too wide to carry a position */
  unplaceable: number;
}

/**
 * Place, filter and cluster. Pure — no DOM, no refs — so the gate can reason
 * about it and so the two hosts (plot and brush strip) share one implementation
 * despite having completely different x mappings.
 *
 * `xOf` is the HOST's own projection. The plot's includes its left gutter; the
 * brush strip's spans the full width. Neither is derivable here, which is the
 * point: this module never does geometry, exactly as `design/timeCursor.ts`
 * never does pixels.
 */
export function placeFlags(
  from: number, to: number, layers: LayerState, xOf: (t: number) => number,
): FlagPlacement {
  const span = Math.max(1, to - from);
  const placed: Placed[] = [];
  let outside = 0, unplaceable = 0;

  for (const ev of TL_EVENTS) {
    if (!layers[ev.c]) continue;
    const s = tlSpan(ev);
    if (s.to < from || s.from > to) { outside++; continue; }
    if (s.to - s.from > span * MAX_SPAN_FRAC) { unplaceable++; continue; }
    const bx0 = xOf(Math.max(s.from, from));
    const bx1 = xOf(Math.min(s.to, to));
    placed.push({ ev, px: xOf(s.from), bx0, bx1 });
  }

  // TL_EVENTS is pre-sorted by interval start, so a single forward pass merges
  // every run of neighbours. Re-anchoring to the running mean is the mockup's
  // rule and it matters: anchoring to the first member would let a long chain
  // drift left of everything in it.
  const groups: FlagGroup[] = [];
  for (const p of placed) {
    const last = groups[groups.length - 1];
    if (last && p.px - last.px < CLUSTER_MIN_PX) {
      last.members.push(p);
      last.px = last.members.reduce((a, m) => a + m.px, 0) / last.members.length;
      last.to = Math.max(last.to, tlSpan(p.ev).to);
    } else {
      const s = tlSpan(p.ev);
      groups.push({ px: p.px, members: [p], from: s.from, to: s.to });
    }
  }
  return { groups, outside, unplaceable };
}

/** `/learn/timeline?e=<slug>` — the `?p=` idiom `/learn/sim` already uses. */
export function timelineHref(slug: string): string {
  return `${R.LEARN}/timeline?e=${encodeURIComponent(slug)}`;
}

/* ── the layer toggles ───────────────────────────────────────────────── */

export function AnnotationLayers({
  layers, onChange, note,
}: {
  layers: LayerState;
  onChange: (l: LayerState) => void;
  note?: React.ReactNode;
}) {
  return (
    /* `role="group"` sits on the element that already exists rather than on a
       `display: contents` wrapper: an element with `display: contents` has a
       history of dropping out of the accessibility tree, which would take its
       role and its label with it — a wrapper added FOR accessibility that
       removes it. */
    <div className="mk-ann-layers" data-ann-layers="" role="group" aria-labelledby="ann-layers-label">
      <span className="mk-ann-legend" id="ann-layers-label">Events</span>
      {TL_CATS.map((k) => {
          const on = layers[k];
          return (
            <button
              key={k}
              type="button"
              className="mk-ann-toggle"
              data-ann-toggle={k}
              aria-pressed={on}
              onClick={() => onChange({ ...layers, [k]: !on })}
              style={{
                borderColor: on ? TL_CAT[k].color : "var(--ink-20)",
                color: on ? TL_CAT[k].color : "var(--ink-60)",
              }}
            >
              <i style={{ background: on ? TL_CAT[k].color : "transparent", borderColor: TL_CAT[k].color }} />
              {TL_CAT[k].label}
            </button>
          );
      })}
      {note ? <span className="mk-ann-note" data-ann-note="">{note}</span> : null}
    </div>
  );
}

/* ── the flags ───────────────────────────────────────────────────────── */

/**
 * `compact` is the brush strip: 62px tall, no room for a band or a tooltip, and
 * its whole job is "there is an event over there" rather than "here is what it
 * was". It renders the same groups with the dot only.
 */
export function TimeAnnotations({
  placement, top = 0, bottom = 0, compact = false, onZoom,
}: {
  placement: FlagPlacement;
  top?: number;
  bottom?: number;
  compact?: boolean;
  onZoom?: (from: number, to: number) => void;
}) {
  const [open, setOpen] = React.useState<number | null>(null);
  const hostRef = React.useRef<HTMLDivElement>(null);

  // A tooltip that outlives its flag is a tooltip describing nothing: the brush
  // moves the window on every pointermove of a drag, so the group under index
  // `open` is a different event a frame later.
  const n = placement.groups.length;
  React.useEffect(() => { setOpen((o) => (o != null && o < n ? o : null)); }, [n]);

  return (
    <div
      ref={hostRef}
      className={"mk-anns" + (compact ? " mk-anns-compact" : "")}
      data-annotations=""
      data-ann-count={placement.groups.length}
      data-ann-outside={placement.outside}
      data-ann-unplaceable={placement.unplaceable}
      style={{ top, bottom }}
    >
      {placement.groups.map((g, i) => {
        const many = g.members.length > 1;
        const first = g.members[0];
        const cat = first.ev.c;
        const color = TL_CAT[cat].color;
        const bandW = many ? 0 : Math.max(0, first.bx1 - first.bx0);
        const showBand = !compact && bandW >= MIN_BAND_PX;
        const label = many
          ? `${g.members.length} timeline events`
          : `${first.ev.t} — ${first.ev.d}`;

        return (
          <div
            key={many ? "g" + i : first.ev.slug}
            className={"mk-ann" + (many ? " mk-ann-cluster" : "") + (!many && first.ev.tent ? " mk-ann-tent" : "")}
            data-ann-cat={cat}
            data-ann-slug={many ? "" : first.ev.slug}
            data-ann-members={g.members.length}
            style={{ left: g.px }}
          >
            {showBand ? (
              <span
                className="mk-ann-band"
                data-ann-band=""
                aria-hidden="true"
                style={{ left: first.bx0 - g.px, width: bandW, borderColor: color, background: color }}
              />
            ) : null}
            <span className="mk-ann-rule" aria-hidden="true" style={{ background: color }} />
            {many ? (
              <button
                type="button"
                className="mk-ann-dot mk-ann-badge"
                style={{ background: color }}
                aria-label={`${label}. Zoom to separate them.`}
                onClick={() => (onZoom ? onZoom(g.from, g.to) : setOpen(open === i ? null : i))}
                onPointerEnter={() => setOpen(i)}
                onFocus={() => setOpen(i)}
                onPointerLeave={() => setOpen((o) => (o === i ? null : o))}
                onBlur={() => setOpen((o) => (o === i ? null : o))}
              >{g.members.length}</button>
            ) : (
              <a
                className="mk-ann-dot"
                href={timelineHref(first.ev.slug)}
                style={{ background: first.ev.tent ? "transparent" : color, borderColor: color }}
                aria-label={label}
                onPointerEnter={() => setOpen(i)}
                onFocus={() => setOpen(i)}
                onPointerLeave={() => setOpen((o) => (o === i ? null : o))}
                onBlur={() => setOpen((o) => (o === i ? null : o))}
              />
            )}

            {open === i && !compact ? (
              <AnnTip group={g} hostW={hostRef.current?.clientWidth ?? 0} x={g.px} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Clamped inside its host, `ChartTip`'s rule and the hero's `cc-tip` rule —
 * NOT the mockup's `position: fixed`. A fixed tooltip escapes the panel, which
 * on this page means it can cover the range buttons and the provenance badge,
 * and it would need a z-index above chrome it has no business above.
 */
function AnnTip({ group, hostW, x }: { group: FlagGroup; hostW: number; x: number }) {
  const W = 250;
  const dx = hostW ? Math.min(hostW - W - 4, Math.max(4, x + 10)) - x : 10;
  const many = group.members.length > 1;
  return (
    <span className="mk-ann-tip" data-ann-tip="" role="tooltip" style={{ left: dx, width: W }}>
      {many ? (
        <>
          <b>{group.members.length} events</b>
          {group.members.map((m) => (
            <span key={m.ev.slug} className="mk-ann-tip-row">
              <i style={{ background: TL_CAT[m.ev.c].color }} />
              <span data-ann-date="">{m.ev.d}</span> · {m.ev.t}
            </span>
          ))}
          <em>Zoom in to separate them.</em>
        </>
      ) : (
        <>
          <b>{group.members[0].ev.t}</b>
          <span className="mk-ann-tip-meta">
            {/* `d` VERBATIM. Never a formatted iso — see the file header. */}
            <span data-ann-date="">{group.members[0].ev.d}</span>
            {group.members[0].ev.tent ? <em className="mk-ann-tent-mark">tentative date</em> : null}
            {" · "}{TL_CAT[group.members[0].ev.c].label}
          </span>
          <span className="mk-ann-tip-body">{group.members[0].ev.b}</span>
          <em>Click → timeline entry</em>
        </>
      )}
    </span>
  );
}
