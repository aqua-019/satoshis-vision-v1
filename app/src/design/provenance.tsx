/**
 * design/provenance.tsx — the canonical data-source attribution badge.
 *
 * ONE vocabulary, ONE badge, everywhere. Every number on the site comes from
 * exactly one of four sources; this component is the only place those four
 * labels are written, so the vocabulary can never drift again.
 *
 *   NODE      — live telemetry from the Monero node cascade
 *   COINGECKO — live market data
 *   SESSION   — real, but computed in-browser this session from the live data
 *               (confirmation counts, hash-derived visual positions)
 *   MODEL     — educational illustration of a protocol concept (the only
 *               non-live category; the /simulate simulators)
 *
 * This is source ATTRIBUTION, not a "fake data" warning — after v5.0.14–v5.0.18
 * there is no fabricated data left. The badge only says where a number came from.
 * It is also the V6 foundation: when the operator's own monerod comes online its
 * peer/node data is simply NODE-sourced and a paused placeholder flips to a live
 * NODE badge with zero relabeling.
 *
 * ── FRESHNESS, THE OTHER AXIS ─────────────────────────────────────────────
 * Source says WHERE a number came from; freshness says WHETHER it is current.
 * All FIVE members, in the order a healthy endpoint moves through them:
 *
 *   loading — asked, nothing back yet. Dim " · loading" suffix, no dot.
 *   live    — last poll succeeded. Pulsing dot, no suffix.
 *   stale   — succeeded before, failing now. The number on screen is LAST-GOOD,
 *             so it stays rendered and gains a gold " · stale".
 *   error   — never succeeded and now failing. There is nothing to show and it
 *             IS broken; red " · unavailable". This is the state v6.1.4 added,
 *             and the one the old four-member union could not say — before it,
 *             a cold load against a dead node was indistinguishable from a slow
 *             one and spun forever.
 *   none    — no freshness claim at all. MODEL artboards, static meta, and the
 *             legend specimen. Silence is correct here; it is not "unknown".
 *
 * `freshSuffix` below is exhaustive over this union with `assertNever`. That
 * guard is the point: before v6.1.4 the suffixes were two independent ternaries,
 * so widening ProvFreshness compiled clean and rendered nothing — proven by a
 * guard sweep that added a fifth member and got zero errors out of this file.
 *
 * ── DERIVE, DO NOT DECLARE ────────────────────────────────────────────────
 * Prefer <NodeProvenance keys={[…]} status={…}> over passing `fresh` by hand.
 * A literal fresh="live" is a claim no call site can keep — it stays green
 * through a total outage. verify-provenance.mjs fails the build on one that is
 * not in its allowlist.
 */

import * as React from "react";
import { assertNever, type FeedKey, type FeedPhase, type FeedStatusMap } from "@/data/feed-status";

export type ProvSource = "node" | "coingecko" | "session" | "model";

/** Freshness is orthogonal to source: a NODE/COINGECKO value can be live,
 *  loading, stale or error. "none" = no freshness suffix (MODEL, static meta).
 *  Glossed member-by-member in the header block above. */
export type ProvFreshness = "live" | "loading" | "stale" | "error" | "none";

/** The ONLY place the four canonical label strings live. */
const PROV_LABEL: Record<ProvSource, string> = {
  node: "NODE",
  coingecko: "COINGECKO",
  session: "SESSION",
  model: "MODEL",
};

/** Three-to-four word gloss for the legend. */
const PROV_GLOSS: Record<ProvSource, string> = {
  node: "live node telemetry",
  coingecko: "live market data",
  session: "computed in-browser",
  model: "educational simulator",
};

export interface ProvenanceProps {
  source: ProvSource;
  /**
   * "live" shows a pulsing dot; "loading"/"stale"/"error" append a dim/gold/red
   * suffix. Defaults to "none" — a badge that makes no freshness claim.
   *
   * Passing this as a LITERAL is what verify-provenance.mjs polices. Reach for
   * <NodeProvenance> instead and let the endpoints decide.
   *
   * (There was a `pulse?: boolean` here that forced the dot on independent of
   * `fresh`. It had zero call sites and was a second way to hardcode a live dot,
   * so v6.1.4 deleted it rather than leave the ban on `fresh="live"` trivially
   * side-steppable. The gate asserts it stays gone.)
   */
  fresh?: ProvFreshness;
  /** Dim trailing detail, e.g. data.source ("rpc"/"ws"/"host"), "node-reported". */
  detail?: React.ReactNode;
  /** Compound second tag (e.g. constellation: SESSION ∣ NODE). */
  also?: ProvSource;
  /** Baseline-aligned, no box — for use inside flowing mono text. */
  inline?: boolean;
  /** Label only, no border/box — for kicker / Stat sub / <h6> slots. */
  bare?: boolean;
  /** Dot + tight label — for the dense NavTop strip. */
  compact?: boolean;
  style?: React.CSSProperties;
  title?: string;
}

/**
 * The freshness suffix, exhaustive over ProvFreshness.
 *
 * A switch rather than the two ternaries this replaced, because a ternary chain
 * is not a guard: widening the union used to compile clean and silently render
 * nothing. `assertNever` makes the next member a compile error here first.
 *
 * COPY CONSTRAINT, load-bearing: none of these strings may match `SUSPENDED_RE`
 * (`entry-ssr.tsx`), which is substring-tested against every prerendered
 * document — `/loading(\s+[a-z]+)?[….]|does not support Suspense/i`. " · loading"
 * is safe only because it carries no trailing `.`/`…`; adding one fails the
 * build on ALL 11 routes with the message "still suspended", which points at
 * Suspense rather than at this line. "unavailable" is chosen partly for that
 * (it contains no "loading" token) and partly because it is the word the error
 * branch already rendered via `detail`, so innerText is unchanged.
 */
function freshSuffix(fresh: ProvFreshness): React.ReactNode {
  switch (fresh) {
    case "stale":
      return <span className="prov-fresh prov-fresh--stale"> · stale</span>;
    case "loading":
      return <span className="prov-fresh prov-fresh--loading"> · loading</span>;
    case "error":
      return <span className="prov-fresh prov-fresh--error"> · unavailable</span>;
    case "live":
    case "none":
      return null;
    default:
      return assertNever(fresh, "Provenance freshSuffix");
  }
}

export function Provenance({
  source, fresh = "none", detail, also, inline, bare, compact, style, title,
}: ProvenanceProps) {
  const showDot = fresh === "live";

  const Tag = (s: ProvSource, withDot: boolean) => (
    <span className={"prov-tag prov--" + s}>
      {withDot ? <span className="prov-dot" /> : null}
      {PROV_LABEL[s]}
    </span>
  );

  const cls =
    "prov" +
    (inline ? " prov--inline" : "") +
    (bare ? " prov--bare" : "") +
    (compact ? " prov--compact" : "");

  return (
    <span className={cls} style={style} title={title}>
      {Tag(source, showDot)}
      {also ? (<><span className="prov-sep" />{Tag(also, false)}</>) : null}
      {freshSuffix(fresh)}
      {detail != null ? <span className="prov-detail"> · {detail}</span> : null}
    </span>
  );
}

/* ── NodeProvenance — freshness DERIVED from the endpoints a panel reads ───── */

/**
 * FeedPhase → ProvFreshness. Exhaustive, with assertNever.
 *
 * The parameter is annotated `FeedPhase` DELIBERATELY, not `FeedStatus["phase"]`.
 * `FeedStatus` is a union of variants each carrying a *literal* phase and does
 * not reference `FeedPhase` at all, so a switch narrowed over `status.phase`
 * would keep compiling when `FeedPhase` grows — invisible to the guard sweep and
 * protected by nothing. Callers pass `status[k].phase`, which is assignable.
 */
function freshOfPhase(p: FeedPhase): ProvFreshness {
  switch (p) {
    case "live": return "live";
    case "loading": return "loading";
    case "stale": return "stale";
    case "error": return "error";
    default: return assertNever(p, "freshOfPhase", "none");
  }
}

/** Worst-of, by severity. Ranked so a two-endpoint panel reports the endpoint
 *  that is doing worse — a panel is only as fresh as its least fresh input. */
const PHASE_RANK: Record<FeedPhase, number> = { live: 0, loading: 1, stale: 2, error: 3 };

function worstPhase(keys: readonly FeedKey[], status: FeedStatusMap): FeedPhase {
  let worst: FeedPhase = "live";
  for (const k of keys) {
    if (PHASE_RANK[status[k].phase] > PHASE_RANK[worst]) worst = status[k].phase;
  }
  return worst;
}

/**
 * Props. `fresh` is OMITTED rather than merely unused: leaving it in the
 * pass-through would let a call site write
 * `<NodeProvenance keys={…} status={…} fresh="live" />` and win, which is the
 * exact hole this component exists to close.
 *
 * Two mutually-exclusive forms, discriminated so passing both is a type error:
 *   keys + status — the normal case, for anything the polled feed covers.
 *   phase         — for live surfaces OUTSIDE the FeedKey union. There are two
 *                   classes: /api/xmr/tx/<txid> and /api/xmr/block/<h>, which
 *                   live-detail.ts fetches one-shot per id, and the market
 *                   history series, whose SeriesStatus IS FeedPhase. Neither is
 *                   a polled endpoint with a failure streak, so neither can have
 *                   a FeedKey without putting a lie in feed-status.ts.
 *
 * The `phase` form is not an escape hatch: verify-provenance.mjs bans a literal
 * `phase="live"` exactly as it bans a literal `fresh="live"`, so the only way to
 * use it is with a computed FeedPhase.
 */
export type NodeProvenanceProps = Omit<ProvenanceProps, "fresh"> &
  (
    | { keys: readonly [FeedKey, ...FeedKey[]]; status: FeedStatusMap; phase?: never }
    | { phase: FeedPhase; keys?: never; status?: never }
  );

/**
 * A provenance badge whose freshness it does not get to choose.
 *
 * THIS DOES NOT CALL `feedDegraded`, and that is the whole point. `feedDegraded`
 * is a pair-AND global — it reports healthy while a single endpoint is dead. A
 * panel with keys={["mempool"]} must go stale when /api/xmr/mempool alone fails,
 * even though the feed as a whole is fine. That difference IS the per-endpoint
 * claim this component makes.
 *
 * `keys` is a NON-EMPTY tuple because a worst-of fold seeded at "live" would
 * otherwise return "live" for keys={[]} — a live dot derived from nothing, which
 * is the defect in a new costume.
 */
export function NodeProvenance(props: NodeProvenanceProps) {
  const { keys, status, phase, ...rest } = props;
  const resolved: FeedPhase = phase ?? worstPhase(keys, status);
  return <Provenance {...rest} fresh={freshOfPhase(resolved)} />;
}

/** Same chrome as <Provenance>, no source tag — for curated editorial content
 *  that has no upstream (e.g. the swap-venue directory). */
export function ProvNote({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <span className="prov" style={style}><span className="prov-detail">{children}</span></span>;
}

export interface DataLegendProps {
  /** Which source tags to explain, in order. */
  sources: ProvSource[];
  style?: React.CSSProperties;
}

/** A compact one-line key making the four-source vocabulary self-explaining.
 *  Goes near the top of data-heavy pages so the badge needs no prior knowledge. */
export function DataLegend({ sources, style }: DataLegendProps) {
  return (
    <div className="data-legend" style={style}>
      <span className="data-legend__k">Sources</span>
      {sources.map((s) => (
        <span key={s} className="data-legend__item">
          <Provenance source={s} bare />
          <span className="data-legend__gloss">{PROV_GLOSS[s]}</span>
        </span>
      ))}
    </div>
  );
}
