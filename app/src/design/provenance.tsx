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
 */

import * as React from "react";

export type ProvSource = "node" | "coingecko" | "session" | "model";

/** Freshness is orthogonal to source: a NODE/COINGECKO value can be live,
 *  loading, or stale. "none" = no freshness suffix (MODEL, or static meta). */
export type ProvFreshness = "live" | "loading" | "stale" | "none";

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
  /** "live" shows a pulsing dot; "stale"/"loading" append a gold/dim suffix. */
  fresh?: ProvFreshness;
  /** Dim trailing detail, e.g. data.source ("rpc"/"ws"/"host"), "node-reported". */
  detail?: React.ReactNode;
  /** Compound second tag (e.g. constellation: SESSION ∣ NODE). */
  also?: ProvSource;
  /** Force the live dot independent of `fresh` (feed logs that are always live). */
  pulse?: boolean;
  /** Baseline-aligned, no box — for use inside flowing mono text. */
  inline?: boolean;
  /** Label only, no border/box — for kicker / Stat sub / <h6> slots. */
  bare?: boolean;
  /** Dot + tight label — for the dense NavTop strip. */
  compact?: boolean;
  style?: React.CSSProperties;
  title?: string;
}

export function Provenance({
  source, fresh = "none", detail, also, pulse, inline, bare, compact, style, title,
}: ProvenanceProps) {
  const showDot = pulse || fresh === "live";

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
      {fresh === "stale" ? <span className="prov-fresh prov-fresh--stale"> · stale</span> : null}
      {fresh === "loading" ? <span className="prov-fresh prov-fresh--loading"> · loading</span> : null}
      {detail != null ? <span className="prov-detail"> · {detail}</span> : null}
    </span>
  );
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
