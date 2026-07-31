/**
 * pages/monero/LegalityTab.tsx — Monero legality: per-jurisdiction activity matrix + delistings.
 *
 * v6.0.10 §3 — rebuilt mobile-first. The page previously rendered an 8-column grid
 * declared INLINE at every width; at 390px "COUNTRY" wrapped one character per line,
 * the header row bled off-screen and status chips were clipped mid-word.
 *
 * The cause was structural, not cosmetic: the mobile layer's blanket rule matches on
 * the inline style ATTRIBUTE (`.main [style*="grid-template-columns"] { … 1fr !important }`),
 * so the old code opted out with `.keep-cols` — which drags in
 * `min-width: max-content !important` and turns the table into a horizontal swipe. That
 * swipe is what bled off-screen. Nothing on this page declares a grid inline any more;
 * the `.lg-*` classes in styles.css own both presentations, so there is no rule to fight
 * and no escape hatch to buy.
 *
 * Data and derivation live in ./legality/ — data.ts (the matrix), status.ts (pure:
 * headline, summary, search, filter). Every number rendered here is computed from the
 * matrix; the jurisdiction count is nowhere hand-typed.
 */

import * as React from "react";
import { PageHeader } from "@/layout/AppShell";
import { Card } from "@/design/primitives";
import type { MoneroTabProps } from "./tabs";

import { LEGALITY_MATRIX, ACTIVITIES } from "./legality/data";
import type { ActivityStatus } from "./legality/data";
import { STATUS_META, summarize, applyFilters } from "./legality/status";
import { JurisdictionRow } from "./legality/JurisdictionRow";
import { LegalityControls } from "./legality/LegalityControls";

const LEGEND: { status: ActivityStatus; d: string }[] = [
  { status: "legal", d: "No specific restriction. Treated like any digital asset." },
  { status: "restricted", d: "Permitted but with reporting requirements or licensing limits." },
  { status: "illegal", d: "Specifically prohibited or fully criminalized for individuals." },
  { status: "unclear", d: "Legal grey zone; no specific guidance or active enforcement." },
];

const DELISTINGS = [
  { d: "2018-06-18", v: "Japan FSA · all privacy coins", who: "All licensed JP exchanges", why: "FSA orders 'anonymous virtual currencies' removed from licensed venues" },
  { d: "2020-12-31", v: "BitBay (PL)", who: "Polish exchange", why: "AML directive pre-MiCA" },
  { d: "2021-01-26", v: "Shapeshift exits all crypto", who: "ShapeShift", why: "Pivot to DEX model · indirect Monero loss" },
  { d: "2023-06-21", v: "Kraken UK", who: "Kraken UK retail", why: "FCA registration requirement" },
  { d: "2023-11-08", v: "Binance · global delisting", who: "Binance globally on regulated rails", why: "Compliance with multiple jurisdictions" },
  { d: "2024-12-30", v: "MiCA enforcement live", who: "All EU CASPs", why: "Anti-anonymity provisions of EU Markets in Crypto-Assets" },
  { d: "2025-09-15", v: "LocalMonero.co shuts down", who: "P2P platform itself", why: "Operator citing increasing legal complexity" },
  { d: "2026-01-22", v: "73 delistings YTD", who: "Various CEXs", why: "Cumulative MiCA / OFAC / AUSTRAC pressure across 2025" },
];

export function LegalityTab(_props: MoneroTabProps) {
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState<ReadonlySet<ActivityStatus>>(() => new Set());
  // Keyed on row.n, NEVER an index. With filtering, an index would reattach the
  // expanded panel to whichever country happens to land at that position as you type.
  const [openKey, setOpenKey] = React.useState<string | null>(null);

  // LEGALITY_MATRIX is a module constant, so this runs exactly once.
  const summary = React.useMemo(() => summarize(LEGALITY_MATRIX), []);
  const rows = React.useMemo(() => applyFilters(LEGALITY_MATRIX, query, active), [query, active]);

  const toggleActive = React.useCallback((s: ActivityStatus) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  }, []);

  const clear = React.useCallback(() => { setQuery(""); setActive(new Set()); }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <PageHeader
        kicker="Legal status · jurisdictions · per-activity"
        title={'Where Monero <em style="color:var(--p-50);font-style:normal">is, and isn’t</em>, legal.'}
        sub="Monero itself has never been outlawed in most countries. What's restricted, jurisdiction by jurisdiction, is specific activities — centralized exchange access, mining, or merchant acceptance. Search, filter, or open any jurisdiction for the detail."
      />

      {/* Summary + filters + search — above the fold at EVERY width. Previously a
          reader had to scroll every row before learning anything at all. */}
      <LegalityControls
        summary={summary}
        query={query}
        onQueryChange={setQuery}
        active={active}
        onToggleActive={toggleActive}
        resultCount={rows.length}
      />

      {/* Activity matrix (≥769px) / one card per country (≤768px) — same DOM. */}
      <Card style={{ padding: 22 }}>
        <div style={{ marginBottom: 14 }}>
          <div className="kicker">Country × activity matrix</div>
          <div className="mono dim" style={{ fontSize: "var(--fs-body)", marginTop: 4 }}>
            {summary.total} jurisdictions · open any row for the detail
          </div>
        </div>

        {/* Column header — a class, not an inline grid, so it stays in lockstep with
            the rows instead of silently desyncing the way the old minWidth:720
            duplicate did. Hidden below 769px, where rows become cards. */}
        <div className="lg-head" aria-hidden="true">
          <span />
          <span>Country</span>
          {ACTIVITIES.map((a) => <span key={a.key}>{a.short}</span>)}
          <span />
        </div>

        {rows.length === 0 ? (
          <p className="mono dim" style={{ fontSize: "var(--fs-body)", padding: "18px 0" }}>
            No jurisdiction matches {query ? <b>“{query}”</b> : "these filters"}.{" "}
            <button type="button" className="lg-chip" onClick={clear} style={{ marginLeft: 8 }}>Clear</button>
          </p>
        ) : (
          <ul className="lg-list">
            {rows.map((row) => (
              <JurisdictionRow
                key={row.n}
                row={row}
                open={openKey === row.n}
                onToggle={() => setOpenKey(openKey === row.n ? null : row.n)}
              />
            ))}
          </ul>
        )}

        <p className="mono dim" style={{ fontSize: "var(--fs-body)", marginTop: 14, lineHeight: 1.5 }}>
          ⚠ This is design preview content. Verify current legal status before relying on it for any jurisdiction or activity. Laws change quickly in crypto.
        </p>
      </Card>

      {/* Quick reference — demoted from first to third. It is reference material,
          not an entry point; the summary above is the entry point now. */}
      <Card style={{ padding: 18 }}>
        <div className="kicker" style={{ marginBottom: 10 }}>
          Quick reference · {ACTIVITIES.length} activities × {LEGEND.length} statuses
        </div>
        <div className="lg-legend" style={{ fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)" }}>
          {LEGEND.map((s) => {
            const meta = STATUS_META[s.status];
            return (
              <div key={s.status} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: meta.c, boxShadow: `0 0 5px ${meta.c}`, marginTop: 6, flexShrink: 0 }} />
                <div>
                  <div style={{ color: meta.c, letterSpacing: "0.1em", textTransform: "uppercase", fontSize: "var(--fs-label)" }}>{meta.label}</div>
                  <div className="dim" style={{ fontSize: "var(--fs-body)", lineHeight: 1.5, marginTop: 2 }}>{s.d}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mono" style={{ marginTop: 12, fontSize: "var(--fs-label)", color: "var(--ink-60)", letterSpacing: "0.06em" }}>
          <b style={{ color: "var(--ink-80)" }}>Activity legend:</b>{" "}
          {ACTIVITIES.map((a, i) => (
            <React.Fragment key={a.key}>
              {i > 0 ? " · " : ""}
              <span style={{ color: "var(--ink-80)" }}>{a.long}</span>
            </React.Fragment>
          ))}
        </div>
      </Card>

      {/* Existing timeline (kept) */}
      <Card style={{ padding: 26 }}>
        <div className="kicker">Exchange delistings · timeline</div>
        <h3 className="serif" style={{ margin: "10px 0 6px", fontSize: 22, fontWeight: 400, color: "var(--ink-100)" }}>The long retreat from regulated venues.</h3>
        <p className="mono dim" style={{ fontSize: "var(--fs-body)", lineHeight: 1.7, marginBottom: 16 }}>
          Delisting is a regulatory artefact, not a verdict on the protocol. Jurisdictions have made compliance with anti-anonymity rules incompatible with listing.
          The on-ramps thinned; the protocol did not.
        </p>
        <div style={{ position: "relative", paddingLeft: 18, borderLeft: "1px dashed var(--ink-20)", display: "flex", flexDirection: "column", gap: 14 }}>
          {DELISTINGS.map((e, i) => (
            <div key={i} style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: -25, top: 6, width: 10, height: 10, borderRadius: 5, border: "1px solid var(--r-50)", background: "var(--bg-0)", boxShadow: "var(--glow-1)" }} />
              <div className="mono" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.16em", color: "var(--ink-60)" }}>{e.d}</div>
              <div className="mono" style={{ fontSize: "var(--fs-mono)", color: "var(--ink-100)", marginTop: 2 }}><b className="dn">{e.v}</b> · <span className="dim">{e.who}</span></div>
              <p className="mono dim" style={{ margin: "4px 0 0", fontSize: "var(--fs-body)", lineHeight: 1.55 }}>{e.why}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
