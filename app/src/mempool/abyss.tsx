// mempool/abyss.tsx — ABYSS · the pending pool as a dark-water particle field.
//
// The SECOND net-new view of the eleven (docs/v6-mempool-views-spec.md:137-139):
// "a deep-water field where each tx is a particle; fee sets luminosity, age sets
// depth. Tracked tx stays lit while everything else dims."
//
// WHAT IT IS, AND WHAT SEPARATES IT FROM THE TWO CANVAS PARTICLE FIELDS ALREADY
// SHIPPED — sediment (#p2·2) and orbital (#174). Both are adjacent, both encode
// fee, both are `useMemCanvas` fields, so the difference is DESIGNED rather than
// hoped, and it is one axis inversion against each:
//
//   • AGAINST SEDIMENT — fee is not a POSITION. Sediment's core tube stratifies
//     the pool by fee: a stratum IS a fee band, and vertical placement is the
//     fee reading. Here vertical placement is AGE, and fee has left geometry
//     altogether for the brightness channel. Sediment's vertical axis and this
//     one carry different quantities, so the two pictures answer different
//     questions about the same pool: "how is the pool distributed across fee
//     bands" against "how long has the pool been waiting".
//   • AGAINST ORBITAL — fee is not a RADIUS, and age is not a BEARING. Orbital
//     puts fee on the radial axis and age on the angular one, so both of its
//     dimensions are positional and its cut is a geometric boundary — a ring you
//     can point at. Abyss has ONE positional data axis (depth = age) and one
//     non-positional one (luminosity = fee), which makes the next-block cut a
//     BRIGHTNESS THRESHOLD rather than a ring: "everything brighter than this
//     gets mined". That is a different sentence about the same inference, and it
//     is the sentence the spec's "fee sets luminosity" forces.
//   • THE HORIZONTAL AXIS CARRIES NOTHING, and this is stated rather than left
//     to look meaningful. `abyLane` is `hashToUnit(txid)` — deterministic,
//     uniform, no reading. Bridge's blip angle is the same function for the same
//     reason, and orbital's header records that as the axis it deliberately does
//     NOT reuse. A water column has no second variable; the width is the width
//     of the water.
//   • THE TRACKED IDIOM IS SUBTRACTIVE — the only one in the app. Every other
//     view LIGHTS the tracked transaction; this one keeps it lit and DIMS the
//     rest. Dimming is opacity on the un-tracked population, never removal:
//     every particle stays present, stays clickable, stays counted. That is
//     contract §6's suppress-animation-not-content instinct applied to tracking,
//     and it is why `ABY_DIM_FLOOR` exists — see its note in the instruments.
//
// FOUR REAL DIMENSIONS PER PARTICLE, all from the feed, none decorative:
//   luminosity = log(perB) over the pool's observed span · depth = log(age)
//   over the pool's real oldest · dot area = tx size in bytes · presence in the
//   lit set = inside the inferred next-block cut.
//
// ── decisions worth knowing before editing ────────────────────────────────
//
// THE DEPTH DOMAIN IS THE SHARED STRIP'S `oldest`, PASSED IN, NOT RE-DERIVED.
// `useAbyssField(data, stats.oldestAgeSec)` takes the number as an argument, so
// contract §3's "a view must not compute its own version" is satisfied BY
// CONSTRUCTION rather than by two implementations agreeing. The deepest particle
// sits on the floor because it is the pool's real oldest transaction.
//
// THE CLOCK IS `Date.now()`, NOT `useMemCanvas`'s elapsed `t` — orbital's
// argument, unchanged, because the quantity is the same kind: depth is derived
// from a transaction's real age, so a view resuming from a frozen animation
// clock would draw every particle at the depth it held when the tab was
// backgrounded. A stale reading rendered as a live one is the ALL-REAL-DATA
// invariant broken by an animation detail.
//
// THE VIEW IS FLUID — `fit: false`, `reflow: true`, orbital's mechanism
// verbatim and for the same measured reason: `contain: inline-size` on the root
// (a `repeat(12, 1fr)` grid amplifies its widest cell's max-content
// contribution, and `minmax(0, 1fr)` bounds a track's automatic MINIMUM, which
// is a different quantity — see OrbitalView's long note), plus tabular grids as
// CSS classes rather than inline `gridTemplateColumns`, because the ≤768 reflow
// layer collapses every INLINE grid to one column.
//
// DEPTH LABELS ARE DOM, NOT CANVAS TEXT. Canvas glyphs are invisible to
// verify-legibility, to verify-memviews scenario 6's collision sweep and to its
// sub-12px SVG check. The canvas draws geometry only; see the note in
// abyss-instruments.tsx.
//
// THE STAGE DOES NOT SCROLL. A "deep water" column invites tallness, and the
// brief allows the depth axis its own scroll — but the axis is LOG, so the whole
// pool fits between the surface and the floor at any height, and a nested
// scroller inside `.mp-canvas-scroll` would give the instrument a second scroll
// axis to buy resolution the log scale already provides. Height is derived from
// measured width (`abyStageH`), clamped to 620 so the desktop composition stays
// inside the 702px canvas budget.
//
// Every helper is prefixed `Aby` so it cannot collide with Reactor / Bridge /
// Terminal / Orbital in the shared babel global scope.
import * as React from "react";
import { useReducedMotion } from "@/design/useReducedMotion";
import { NodeProvenance, PanelFrame } from "@/design/primitives";
import { fmtBytes, shortHash as ShortHash } from "@/data/types";
import { FEE_TIER_LABELS } from "@/data/map";
import { useMempoolTracking, MemViewShell, TrackChip, MemTxTable } from "@/mempool/mempool-shared";
import type { Tracking } from "@/mempool/mempool-shared";
import { chainTip, confOf, CONF_UNLOCK } from "@/mempool/conf";
import { useMemStats } from "@/mempool/mem-stats";
import type { MoneroLive } from "@/data/types";
import { hasData, oldestFreshAt } from "@/data/feed-status";
import type { FeedKey } from "@/data/feed-status";
import {
  ABY_LUM_TOKENS, ABY_LUM_BUCKETS, ABY_TIER_COLORS, AbyStage, AbyStatic,
  abyDepthTicks, abyLumBucket, fmtAge, fmtPcn, useAbyssField, type AbyField,
} from "@/mempool/abyss-instruments";

interface ViewProps {
  data: MoneroLive;
  bg?: { intensity?: "calm" | "busy" | "chaotic"; scan?: boolean };
  focusBlock?: number | null;
  onClearFocus?: () => void;
}

/** Console rows. Declared once — it is the tallest panel's height budget. */
const CONSOLE_ROWS = 14;

/* ──────────────────────────────────────────────────────────────
   PANEL — delegates to PanelFrame, never hand-rolled chrome (§1)
   ────────────────────────────────────────────────────────────── */

/**
 * Every panel in this view, so none can forget its provenance.
 *
 * Same delegation `OrbPanel` and `BrgPanel` make, for the same reason:
 * `dataKey`, `updatedAt` (worst-of `oldestFreshAt` over the endpoints this panel
 * actually reads, never `lastUpdate`) and `stale` are the three props a call
 * site gets wrong by omission, so passing `keys` once makes them unable to
 * disagree.
 */
function AbyPanel({ data, title, keys, also, right, children, fill = true }: {
  data: MoneroLive;
  title: React.ReactNode;
  keys: readonly [FeedKey, ...FeedKey[]];
  also?: "session";
  right?: React.ReactNode;
  children: React.ReactNode;
  fill?: boolean;
}) {
  return (
    <PanelFrame
      style={fill ? { flex: "1 1 auto" } : undefined}
      title={title}
      dataKey={keys[0]}
      updatedAt={oldestFreshAt(data.status, keys)}
      stale={keys.some((k) => data.status[k].phase === "stale")}
      right={<>{right}<NodeProvenance source="node" also={also} keys={keys} status={data.status} /></>}
    >
      {children}
    </PanelFrame>
  );
}

/** Prose bound. §8's rule stated literally — cap every caption to the width of
 *  the thing it describes. The artboard is fluid rather than definite, so an
 *  unbounded caption cannot rescale the view (there is no wrapper to rescale)
 *  but it CAN push `.mp-view`'s max-content past `canvasW` and force a desktop
 *  pan nothing else in the composition needs. */
const PROSE: React.CSSProperties = { maxWidth: "38ch", whiteSpace: "normal" };

const dash = "—";

/** A key/value row. Not panel chrome — a text line inside PanelFrame's body. */
function AbyRow({ k, v, tone }: { k: string; v: React.ReactNode; tone?: string }) {
  return (
    <div className="mono" style={{ display: "flex", justifyContent: "space-between", gap: "var(--sp-2)", fontSize: "var(--fs-label)", padding: "2px 0", borderBottom: "1px solid var(--line-d)" }}>
      <span style={{ color: "var(--ink-40)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{k}</span>
      <span style={{ color: tone || "var(--ink-80)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
    </div>
  );
}

/** The luminosity ramp, as a legend. The stage's fee axis is a colour channel,
 *  so it needs a key the way an ordinary chart needs an axis — without it
 *  "brighter is dearer" is a claim the reader has to take on trust. */
function AbyRamp({ field }: { field: AbyField }) {
  const cutBucket = field.cutU == null ? null : abyLumBucket(field.cutU);
  return (
    <div>
      <div className="aby-ramp">
        {ABY_LUM_TOKENS.map((c, i) => (
          <div key={i} title={`luminosity ${i + 1} of ${ABY_LUM_BUCKETS}`}
            style={{ background: c, opacity: 0.34 + (i / (ABY_LUM_BUCKETS - 1)) * 0.66 }} />
        ))}
      </div>
      <div className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--fs-label)", color: "var(--ink-40)", marginTop: "var(--sp-1)" }}>
        <span>{field.lo > 0 ? `${fmtPcn(field.lo)} pcn/B` : dash} · faint</span>
        <span>bright · {field.hi > 0 ? `${fmtPcn(field.hi)} pcn/B` : dash}</span>
      </div>
      {cutBucket != null ? (
        <div className="mono" style={{ fontSize: "var(--fs-label)", color: "var(--g-50)", marginTop: "2px", letterSpacing: "0.06em" }}>
          next block ≥ luminosity {cutBucket + 1}/{ABY_LUM_BUCKETS}
        </div>
      ) : null}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   PANELS
   ────────────────────────────────────────────────────────────── */

/** The next-block manifest — what the brightness threshold encloses. */
export function AbyManifest({ data, field }: { data: MoneroLive; field: AbyField }) {
  const ready = hasData(data.status.network);
  const inside = field.cutIndex == null ? null : Math.min(field.cutIndex, field.pts.length);
  const fillPct = field.limit > 0 && field.cumAtCut > 0 ? (field.cumAtCut / field.limit) * 100 : null;
  const waiting = inside == null ? null : field.pts.length - inside;
  return (
    // TITLE SHORTENED AFTER LOOKING AT THE RENDER. "Next-block cut · by
    // luminosity" plus "above the threshold" wrapped to three lines in a c4
    // panel at 1440 and ran the provenance badge off the panel's right edge —
    // no gate sees a wrapped panel header, and §8's caption rule is about the
    // body, not the chrome. The qualifier moved to `right`, where it had room.
    <AbyPanel data={data} title="Next-block cut" also="session" keys={["mempool", "fees", "network"]}
      right={<span className="dim2" style={{ letterSpacing: "0.08em" }}>by luminosity</span>}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--sp-2)", marginBottom: "var(--sp-2)" }}>
        <span className="mono acc" style={{ fontSize: 20 }}>{inside != null ? inside.toLocaleString() : dash}</span>
        <span className="dim2" style={{ fontSize: "var(--fs-label)" }}>txs lit for inclusion</span>
      </div>
      <AbyRow k="cut fee/B" v={field.cutPerB != null ? fmtPcn(field.cutPerB) : dash} tone="var(--g-50)" />
      <AbyRow k="cut luminosity" v={field.cutU != null ? `${abyLumBucket(field.cutU) + 1} of ${ABY_LUM_BUCKETS}` : dash} />
      <AbyRow k="weight used" v={fillPct != null ? `${fillPct.toFixed(1)}%` : dash} />
      <AbyRow k="ceiling" v={ready && field.limit > 0 ? fmtBytes(field.limit) : dash} />
      <AbyRow k="left in the dark" v={waiting != null ? waiting.toLocaleString() : dash} />
      <AbyRow k="no arrival time" v={field.total ? field.unaged.toLocaleString() : dash} tone={field.unaged > 0 ? "var(--y-50)" : undefined} />
      <AbyRow k="pool span" v={field.hi > 0 ? `${fmtPcn(field.lo)} – ${fmtPcn(field.hi)}` : dash} />
      <p className="mono dim" style={{ ...PROSE, fontSize: "var(--fs-label)", lineHeight: 1.55, marginTop: "var(--sp-3)", color: "var(--ink-40)" }}>
        Inferred, not a miner's template: this node publishes a weight ceiling,
        not a block plan. The threshold is where a fee-sorted fill would stop.
      </p>
    </AbyPanel>
  );
}

/**
 * Depth census — the age axis made readable as counts.
 *
 * The bands are the SAME ladder the stage draws its gridlines from
 * (`abyDepthTicks`), so a row here is exactly the water between two lines on the
 * stage. That is what makes the visual claim checkable: "most of the pool is in
 * the top third" is a reading a viewer takes off the picture, and this panel is
 * the same reading as a number.
 */
export function AbyDepthCensus({ data, field }: { data: MoneroLive; field: AbyField }) {
  const bands = React.useMemo(() => {
    const ticks = abyDepthTicks(field.maxAgeSec);
    const out: { from: number; to: number; label: string; n: number; lit: number }[] = [];
    for (let i = 0; i < ticks.length - 1; i++) {
      // THE FINAL BAND IS OPEN-ENDED, and it has to be. `abyDepthTicks` drops
      // the floor tick when it would land on top of the rung above it (see
      // FLOOR_TICK_MIN_GAP), so the last rung is not always the pool's oldest —
      // at maxAge 31 the ladder ends at 30 and the 31s transaction would fall
      // through a half-open `[from, to)` and be counted in NO band. A census
      // that does not sum to the pool is a census that is quietly wrong, and
      // nothing here would have shown it.
      const last = i === ticks.length - 2;
      const from = ticks[i].sec;
      const to = last ? Math.max(ticks[i + 1].sec, field.maxAgeSec) : ticks[i + 1].sec;
      const inBand = field.pts.filter((p) => p.age >= from && (last ? p.age <= to : p.age < to));
      out.push({
        from, to,
        label: `${fmtAge(from)} – ${fmtAge(to)}`,
        n: inBand.length,
        lit: inBand.filter((p) => p.fits === true).length,
      });
    }
    return out.filter((b) => b.to > b.from);
  }, [field]);
  // Parity, rendered rather than assumed: the bands partition the pool, so the
  // counted total is the pool size or the panel is lying about its own subject.
  const counted = bands.reduce((a, b) => a + b.n, 0);
  const total = field.pts.length;
  const peak = Math.max(1, ...bands.map((b) => b.n));
  return (
    <AbyPanel data={data} title="Depth census" also="session" keys={["mempool"]}
      right={<span className="dim2" style={{ letterSpacing: "0.08em" }}>by age band</span>}>
      <div className="table-scroll">
        <div className="mono aby-census" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-40)", padding: "0 0 var(--sp-1)", borderBottom: "1px solid var(--rule)" }}>
          <span>band</span><span>depth</span><span>txs</span><span>share</span><span>lit</span>
        </div>
        {bands.length === 0 ? (
          <div className="mono dim" style={{ padding: "var(--sp-3) 0", fontSize: "var(--fs-mono)" }}>awaiting mempool…</div>
        ) : bands.map((b) => (
          <div key={`${b.from}-${b.to}`} className="mono aby-census" style={{ fontSize: "var(--fs-mono)", padding: "var(--sp-1) 0", borderBottom: "1px solid var(--line-d)" }}>
            <span className="dim">{b.label}</span>
            <span aria-hidden="true" style={{ display: "block", height: 6, background: "var(--b-50)", opacity: 0.2 + 0.8 * (b.n / peak), width: `${Math.max(4, (b.n / peak) * 100)}%` }} />
            <span className="acc">{total ? b.n.toLocaleString() : dash}</span>
            <span className="dim2">{total ? `${Math.round((b.n / total) * 100)}%` : dash}</span>
            <span style={{ color: b.lit > 0 ? "var(--g-50)" : "var(--ink-40)" }}>{total ? b.lit.toLocaleString() : dash}</span>
          </div>
        ))}
      </div>
      <AbyRow k="counted" v={total ? `${counted.toLocaleString()} of ${total.toLocaleString()}` : dash}
        tone={counted === total ? undefined : "var(--y-50)"} />
      <p className="mono dim" style={{ ...PROSE, fontSize: "var(--fs-label)", lineHeight: 1.55, marginTop: "var(--sp-2)", color: "var(--ink-40)" }}>
        Depth is log age across the pool's real oldest transaction, so the
        recent minutes get the room they earn and the tail still shows. The
        bands are the stage's own gridlines, so a row here is the water between
        two lines.
      </p>
    </AbyPanel>
  );
}

/** Luminosity census — the fee axis as counts, against the node's own tiers.
 *  This is where TIERS appear, so it is where contract §4's tier table applies;
 *  the stage itself has no tier colours, its fee axis being the ramp. */
export function AbyLumCensus({ data, field }: { data: MoneroLive; field: AbyField }) {
  const ready = hasData(data.status.network);
  const rows = FEE_TIER_LABELS.map((label, k) => {
    const inTier = field.pts.filter((p) => p.tier === k);
    const lit = inTier.filter((p) => p.fits === true).length;
    const meanLum = inTier.length
      ? Math.round(inTier.reduce((a, p) => a + p.lum, 0) / inTier.length) + 1
      : null;
    return { label, k, n: inTier.length, lit, meanLum, bound: data.feeTiers.length === 4 ? data.feeTiers[k] : null };
  });
  const total = field.pts.length;
  return (
    <AbyPanel data={data} title="Luminosity census" keys={["mempool", "fees"]}
      right={<span className="dim2" style={{ letterSpacing: "0.08em" }}>by fee tier</span>}>
      <div className="table-scroll">
        <div className="mono aby-census" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-40)", padding: "0 0 var(--sp-1)", borderBottom: "1px solid var(--rule)" }}>
          <span>tier</span><span>floor pcn/B</span><span>txs</span><span>mean lum</span><span>lit</span>
        </div>
        {rows.map((r) => (
          <div key={r.label} className="mono aby-census" style={{ fontSize: "var(--fs-mono)", padding: "var(--sp-1) 0", borderBottom: "1px solid var(--line-d)" }}>
            <span style={{ color: ABY_TIER_COLORS[r.k], letterSpacing: "0.06em" }}>
              <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: ABY_TIER_COLORS[r.k], marginRight: "var(--sp-1)" }} />
              {r.label}
            </span>
            <span className="dim">{ready && r.bound != null ? fmtPcn(r.bound) : dash}</span>
            <span className="acc">{total ? r.n.toLocaleString() : dash}</span>
            <span className="dim2">{r.meanLum != null ? `${r.meanLum}/${ABY_LUM_BUCKETS}` : dash}</span>
            <span style={{ color: r.lit > 0 ? "var(--g-50)" : "var(--ink-40)" }}>{total ? r.lit.toLocaleString() : dash}</span>
          </div>
        ))}
      </div>
      <p className="mono dim" style={{ ...PROSE, fontSize: "var(--fs-label)", lineHeight: 1.55, marginTop: "var(--sp-2)", color: "var(--ink-40)" }}>
        Tier floors are the node's own <code>get_fee_estimate</code> values.
        Brightness is log fee/byte across the observed pool, so a tier spans
        whatever range of the ramp it really spans.
      </p>
    </AbyPanel>
  );
}

/**
 * The water column — what the field sits in, plus the deep-link target when one
 * is set.
 *
 * `focusBlock`/`onClearFocus` are honoured here (spec §1 asks new views to; only
 * Classic, Reactor and Orbital did).
 */
export function AbyColumn({ data, field, focusBlock, onClearFocus, onPickBlock }: {
  data: MoneroLive; field: AbyField; focusBlock?: number | null;
  onClearFocus?: () => void; onPickBlock: (h: number) => void;
}) {
  const ready = hasData(data.status.network);
  const tip = chainTip(data);
  const focused = focusBlock != null ? data.blocks.find((b) => b.height === focusBlock) : undefined;
  return (
    <AbyPanel data={data} title={focusBlock != null ? `Column · block #${focusBlock.toLocaleString()}` : "Column · what the water sits in"}
      keys={["blocks", "network"]}
      right={focusBlock != null && onClearFocus ? (
        <button type="button" onClick={onClearFocus} className="proto-btn"
          style={{ fontSize: "var(--fs-label)", padding: "1px var(--sp-2)" }}>clear</button>
      ) : null}>
      {focusBlock != null ? (
        focused ? (
          <>
            <AbyRow k="height" v={focused.height.toLocaleString()} tone="var(--y-50)" />
            <AbyRow k="confirmations" v={`${confOf(focused.height, data)}/${CONF_UNLOCK}`} />
            <AbyRow k="transactions" v={focused.txs.toLocaleString()} />
            <AbyRow k="weight" v={fmtBytes(Math.round(focused.sizeKB * 1024))} />
            <AbyRow k="reward" v={`${focused.reward.toFixed(4)} XMR`} />
            <AbyRow k="pool" v={focused.pool || dash} />
          </>
        ) : (
          <div className="mono dim" style={{ fontSize: "var(--fs-mono)", padding: "var(--sp-2) 0" }}>
            block #{focusBlock.toLocaleString()} is outside the {data.blocks.length} blocks this node returned
          </div>
        )
      ) : (
        <>
          <AbyRow k="chain tip" v={ready ? `#${tip.toLocaleString()}` : dash} tone="var(--o-60)" />
          <AbyRow k="floor depth" v={field.maxAgeSec > 0 ? fmtAge(field.maxAgeSec) : dash} />
          <AbyRow k="weight ceiling" v={ready && field.limit > 0 ? fmtBytes(field.limit) : dash} />
          <AbyRow k="pool weight" v={field.pts.length ? fmtBytes(field.pts.reduce((a, p) => a + p.size, 0)) : dash} />
          <AbyRow k="alt blocks" v={ready ? data.altBlocksCount.toLocaleString() : dash} />
          <AbyRow k="hardfork" v={ready && data.hardfork ? data.hardfork : dash} />
        </>
      )}
      <div className="mono" style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-1)", marginTop: "var(--sp-3)" }}>
        {data.blocks.slice(0, 8).map((b) => (
          <button key={b.hash + b.height} type="button" onClick={() => onPickBlock(b.height)}
            style={{
              appearance: "none", cursor: "pointer", fontFamily: "var(--f-mono)",
              fontSize: "var(--fs-label)", padding: "1px var(--sp-2)",
              background: b.height === focusBlock ? "color-mix(in srgb, var(--status-warn) 12%, transparent)" : "transparent",
              border: "1px solid " + (b.height === focusBlock ? "var(--y-50)" : "var(--ink-20)"),
              borderRadius: 2, color: b.height === focusBlock ? "var(--y-50)" : "var(--ink-60)",
            }}>
            {b.height.toLocaleString()}
          </button>
        ))}
      </div>
    </AbyPanel>
  );
}

/** Particle console — every particle's four coordinates, as numbers. */
export function AbyConsole({ data, field, tracking, onPickTx }: {
  data: MoneroLive; field: AbyField; tracking: Tracking; onPickTx: (id: string) => void;
}) {
  const rows = field.pts.slice(0, CONSOLE_ROWS);
  const trackedId = tracking?.kind === "tx" ? tracking.id : null;
  return (
    <AbyPanel data={data} title={`Particle console · ${rows.length} of ${field.pts.length}`} also="session"
      keys={["mempool", "fees"]}
      right={<span className="dim2" style={{ letterSpacing: "0.08em" }}>fee-sorted · brightest first</span>}>
      <div className="table-scroll">
        <div className="mono aby-console" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-40)", padding: "0 var(--sp-2) var(--sp-1)", borderBottom: "1px solid var(--rule)" }}>
          <span>rank</span><span>txid</span><span>fee/B</span>
          <span title="luminosity bucket — the stage's fee axis">lum</span>
          <span title="depth: log age across the pool's oldest">depth</span>
          <span>age</span><span>size</span>
          <span title="inferred: above the next-block threshold">lit</span>
        </div>
        {rows.length === 0 ? (
          <div className="mono dim" style={{ padding: "var(--sp-3) var(--sp-2)", fontSize: "var(--fs-mono)" }}>awaiting mempool…</div>
        ) : rows.map((p) => {
          const isTracked = p.id === trackedId;
          const depthPct = field.maxAgeSec > 0
            ? Math.round((Math.log1p(p.age) / Math.log1p(field.maxAgeSec)) * 100)
            : 0;
          return (
            <div key={p.id} data-tracked-tx={isTracked ? p.id : undefined}>
              <div onClick={() => onPickTx(p.id)}
                className="aby-console"
                style={{
                  fontSize: "var(--fs-mono)",
                  padding: "var(--sp-1) var(--sp-2)", borderBottom: "1px solid var(--line-d)",
                  borderLeft: isTracked ? "2px solid var(--y-50)" : "2px solid transparent",
                  background: isTracked ? "color-mix(in srgb, var(--status-warn) 7%, transparent)" : undefined,
                  cursor: "pointer", fontFamily: "var(--f-mono)", alignItems: "center",
                }}>
                <span className="dim2">{String(p.rank + 1).padStart(4, "0")}</span>
                <span style={{ color: ABY_LUM_TOKENS[p.lum], overflow: "hidden", textOverflow: "ellipsis" }}>{ShortHash(p.id)}</span>
                <span className="acc">{fmtPcn(p.perB)}</span>
                <span className="dim">{p.lum + 1}/{ABY_LUM_BUCKETS}</span>
                <span className="dim">{depthPct}%</span>
                <span className="dim2">{fmtAge(p.age)}</span>
                <span className="dim">{fmtBytes(p.size)}</span>
                <span style={{ color: p.fits == null ? "var(--ink-40)" : p.fits ? "var(--g-50)" : "var(--ink-40)" }}>{p.fits == null ? dash : p.fits ? "lit" : "dark"}</span>
              </div>
              {isTracked ? (
                <div style={{ padding: "2px var(--sp-2) var(--sp-1)", borderLeft: "2px solid var(--y-50)" }}>
                  <TrackChip tracking={tracking} data={data} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </AbyPanel>
  );
}

/* ──────────────────────────────────────────────────────────────
   COMPOSITION
   ────────────────────────────────────────────────────────────── */

/** The 12-column composition: c8 stage | c4 manifest ‖ c4 depth | c4 luminosity
 *  | c4 column ‖ c12 console.
 *
 *  `.aby-grid12` is a CLASS in styles.css rather than an inline style, and that
 *  is load-bearing twice over — the reflow layer collapses every INLINE
 *  `grid-template-columns` under a reflow view to `1fr`, and an item still
 *  carrying `grid-column: span 8` then creates eight IMPLICIT tracks and
 *  rebuilds the desktop grid inside a 366px box. Owning the class lets the
 *  phone rule collapse the tracks AND the spans together. Measured on orbital
 *  before its split: ~122px-wide panels, each c4 cell 2,523px tall, and no
 *  horizontal overflow to red a gate. */
function Cell({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div style={{ gridColumn: `span ${n}`, minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
      {children}
    </div>
  );
}

export function AbyOverview({ data, tracking, focusBlock, onClearFocus, onPickTx, onPickBlock }: {
  data: MoneroLive; tracking: Tracking; focusBlock?: number | null; onClearFocus?: () => void;
  onPickTx: (id: string) => void; onPickBlock: (h: number) => void;
}) {
  // The strip's own derivation, read here so the depth axis is anchored on the
  // SAME number the strip publishes rather than a second `Math.max` over ages.
  // See useAbyssField's docblock.
  const stats = useMemStats(data);
  const field = useAbyssField(data, stats.oldestAgeSec);
  const reduced = useReducedMotion();
  const trackedId = tracking?.kind === "tx" ? tracking.id : null;
  const trackedPt = trackedId ? field.pts.find((p) => p.id === trackedId) : undefined;

  return (
    <div className="aby-grid12">
      <Cell n={8}>
        <AbyPanel data={data} title="Abyss · fee is brightness, age is depth" also="session" keys={["mempool", "fees"]}
          right={<span className="dim2" style={{ letterSpacing: "0.08em" }}>{field.pts.length || dash} in the water</span>}>
          {reduced
            ? <AbyStatic field={field} tracking={tracking} onPickTx={onPickTx} />
            : <AbyStage field={field} tracking={tracking} onPickTx={onPickTx} />}
          <div style={{ marginTop: "var(--sp-2)" }}><AbyRamp field={field} /></div>
          {/* §8: capped to the width of the instrument it describes. */}
          <p className="mono" style={{ ...PROSE, margin: "var(--sp-2) 0 0", fontSize: "var(--fs-label)", color: "var(--ink-40)", lineHeight: 1.55 }}>
            Each particle is one pending transaction. Brightness is log fee/byte
            across the observed pool, so the next block is everything above a
            brightness — not a boundary you can draw. Depth is log age, newest at
            the surface{field.maxAgeSec > 0 ? `, the floor at ${fmtAge(field.maxAgeSec)}` : ""}.
            Horizontal position carries nothing.
            {trackedPt ? " While a transaction is tracked the rest of the pool dims — it is still there, and still selectable." : ""}
          </p>
        </AbyPanel>
      </Cell>

      <Cell n={4}>
        <AbyManifest data={data} field={field} />
        {trackedPt ? (
          <AbyPanel data={data} title="Tracked particle" keys={["mempool"]} also="session" fill={false}>
            <AbyRow k="txid" v={ShortHash(trackedPt.id)} tone="var(--y-50)" />
            <AbyRow k="tier" v={trackedPt.tier >= 0 ? FEE_TIER_LABELS[trackedPt.tier] : dash} />
            <AbyRow k="luminosity" v={`${trackedPt.lum + 1} of ${ABY_LUM_BUCKETS}`} />
            <AbyRow k="depth" v={fmtAge(trackedPt.age)} />
            <AbyRow k="rank" v={`${trackedPt.rank + 1} of ${field.total}`} />
            <AbyRow k="in next block" v={trackedPt.fits == null ? dash : trackedPt.fits ? "yes" : "waiting"}
              tone={trackedPt.fits ? "var(--g-50)" : undefined} />
          </AbyPanel>
        ) : null}
      </Cell>

      <Cell n={4}><AbyDepthCensus data={data} field={field} /></Cell>
      <Cell n={4}><AbyLumCensus data={data} field={field} /></Cell>
      <Cell n={4}>
        <AbyColumn data={data} field={field} focusBlock={focusBlock} onClearFocus={onClearFocus} onPickBlock={onPickBlock} />
      </Cell>

      <Cell n={12}><AbyConsole data={data} field={field} tracking={tracking} onPickTx={onPickTx} /></Cell>
    </div>
  );
}

export function AbyssView({ data, focusBlock, onClearFocus }: ViewProps) {
  const { tracking, onSearch, clearTracking } = useMempoolTracking(data);
  return (
    // NO fixed width, and `contain: inline-size` is what makes that safe —
    // orbital's mechanism, reused rather than re-derived. Its header carries the
    // measurement that established it (naturalW 2076 against a 1180 canvas until
    // containment was added, and why `minmax(0, 1fr)` is not a substitute:
    // it bounds a track's automatic MINIMUM while the amplified quantity is the
    // max-content CONTRIBUTION). This view's own six-cell measurement is in the
    // PR body; the mechanism is identical because the composition is the same
    // `repeat(12, 1fr)` shape.
    <div className="main" style={{ overflow: "auto", padding: 0, width: "100%", contain: "inline-size", boxSizing: "border-box" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)", padding: "var(--sp-4) var(--sp-4) var(--sp-6)", boxSizing: "border-box" }}>
        <MemViewShell
          id="abyss"
          table={<MemTxTable data={data} tracking={tracking} viewId="abyss" columns={["txid", "perB", "tier", "size", "age", "inout"]} onPickTx={(id) => onSearch({ kind: "tx", id })} />}
          data={data}
          tracking={tracking}
          onSearch={onSearch}
          onClearTracking={clearTracking}
        >
          <AbyOverview
            data={data}
            tracking={tracking}
            focusBlock={focusBlock}
            onClearFocus={onClearFocus}
            onPickTx={(id) => onSearch({ kind: "tx", id, blockHeight: null })}
            onPickBlock={(h) => onSearch({ kind: "block", height: h })}
          />
        </MemViewShell>
      </div>
    </div>
  );
}
