/**
 * pages/monero/LegalityTab.tsx — Monero legality: per-jurisdiction activity matrix + delistings.
 * Ported verbatim from five01 monero-pages.jsx → MoneroLegality.
 */

import * as React from "react";
import { PageHeader } from "@/layout/AppShell";
import { Card } from "@/design/primitives";
import type { MoneroTabProps } from "./tabs";

// ── Types ──────────────────────────────────────────────────────────────────────

type ActivityStatus = "legal" | "restricted" | "illegal" | "unclear";

type MatrixRow = {
  c: string;
  n: string;
  hold: ActivityStatus;
  cex: ActivityStatus;
  p2p: ActivityStatus;
  mine: ActivityStatus;
  pay: ActivityStatus;
  note: string;
};

type ActivityKey = "hold" | "cex" | "p2p" | "mine" | "pay";

// ── Data ───────────────────────────────────────────────────────────────────────

const LEGALITY_MATRIX: MatrixRow[] = [
  { c: "🇺🇸", n: "United States",       hold: "legal",      cex: "restricted", p2p: "legal",      mine: "legal",      pay: "legal",
    note: "FinCEN classifies XMR as a 'convertible virtual currency'. Several US-facing exchanges have delisted (Kraken, Bittrex, Coinbase). Non-custodial holding, P2P trade, mining, and accepting XMR as payment remain fully legal in all 50 states." },
  { c: "🇨🇦", n: "Canada",              hold: "legal",      cex: "restricted", p2p: "legal",      mine: "legal",      pay: "legal",
    note: "FINTRAC reporting threshold of $10K CAD applies to MSBs but not individuals. Kraken Canada still lists XMR. Mining is taxed as business income; payment acceptance treated like any commodity." },
  { c: "🇪🇺", n: "European Union (MiCA)", hold: "legal",   cex: "illegal",    p2p: "legal",      mine: "legal",      pay: "legal",
    note: "MiCA Article 76 prohibits CASPs from listing privacy coins as of Dec 30, 2024. Holding, P2P trade, mining, and merchant acceptance remain legal across all 27 member states. Wallet providers exempted (so far)." },
  { c: "🇬🇧", n: "United Kingdom",      hold: "legal",      cex: "restricted", p2p: "legal",      mine: "legal",      pay: "legal",
    note: "FCA registration requirement effectively delisted XMR from UK-licensed CEXs. The Travel Rule applies to MSBs, not individuals. P2P and self-custody remain fully unrestricted." },
  { c: "🇯🇵", n: "Japan",               hold: "legal",      cex: "illegal",    p2p: "legal",      mine: "legal",      pay: "legal",
    note: "FSA banned 'anonymous virtual currencies' from JFSA-licensed exchanges in 2018. P2P, holding, mining, and merchant use are not regulated at the individual level." },
  { c: "🇰🇷", n: "South Korea",         hold: "legal",      cex: "illegal",    p2p: "unclear",    mine: "legal",      pay: "legal",
    note: "FSC required 'dark coin' delisting from licensed exchanges in 2021. P2P platforms operate in legal grey zone (no specific ban; AML reporting required at scale)." },
  { c: "🇨🇭", n: "Switzerland",         hold: "legal",      cex: "legal",      p2p: "legal",      mine: "legal",      pay: "legal",
    note: "FINMA treats Monero like any virtual asset. Bity offers up to CHF 1,000/day KYC-free. Zug ('Crypto Valley') accepts XMR for tax payments below CHF 100K." },
  { c: "🇩🇪", n: "Germany",             hold: "legal",      cex: "illegal",    p2p: "legal",      mine: "legal",      pay: "legal",
    note: "BaFin treats XMR as 'units of account'. MiCA delisting applies. Held >1 year = tax-free under §23 EStG (private sale rule). Payment acceptance fully legal." },
  { c: "🇦🇺", n: "Australia",           hold: "legal",      cex: "restricted", p2p: "legal",      mine: "legal",      pay: "legal",
    note: "AUSTRAC pressured major exchanges (Coinbase, Binance) to delist privacy coins in 2020. ATO treats Monero like any digital asset for CGT. P2P and mining unaffected." },
  { c: "🇷🇺", n: "Russia",              hold: "legal",      cex: "restricted", p2p: "legal",      mine: "restricted", pay: "restricted",
    note: "Crypto mining permitted for registered entities only since Nov 2024. Crypto payments for goods/services within Russia are prohibited (only cross-border)." },
  { c: "🇨🇳", n: "China",               hold: "illegal",   cex: "illegal",    p2p: "illegal",   mine: "illegal",   pay: "illegal",
    note: "Total crypto ban since 2021. All transactions, exchanges, mining, and holding are prohibited. Enforcement focuses on businesses; individual holders face confiscation." },
  { c: "🇦🇪", n: "UAE / Dubai",         hold: "legal",      cex: "restricted", p2p: "legal",      mine: "legal",      pay: "legal",
    note: "Dubai's VARA permits regulated venues to delist privacy assets (most have). Free zones (ADGM, DIFC) have relaxed individual rules. P2P and self-custody fully legal." },
  { c: "🇧🇷", n: "Brazil",              hold: "legal",      cex: "legal",      p2p: "legal",      mine: "legal",      pay: "legal",
    note: "CVM treats Monero like any crypto. Bitso (regional CEX) lists XMR. Mining taxed as business activity. Merchant acceptance is common in fintech and remittance corridors." },
  { c: "🇸🇬", n: "Singapore",           hold: "legal",      cex: "restricted", p2p: "legal",      mine: "legal",      pay: "legal",
    note: "MAS guidance disfavors privacy coins on regulated venues but doesn't prohibit them. Most retail-facing CEXs have delisted; P2P and merchant payment fully legal." },
  { c: "🇲🇽", n: "Mexico",              hold: "legal",      cex: "legal",      p2p: "legal",      mine: "legal",      pay: "legal",
    note: "Banxico requires authorization for fintechs offering crypto; Monero not singled out. Bitso continues to list. Merchant acceptance growing in border corridors." },
  { c: "🇮🇳", n: "India",               hold: "legal",      cex: "unclear",    p2p: "legal",      mine: "legal",      pay: "unclear",
    note: "30% flat tax on crypto gains + 1% TDS on transfers since 2022. Most Indian CEXs do not list XMR. Holding and mining are legal; payment use exists in legal grey zone." },
  { c: "🇮🇩", n: "Indonesia",           hold: "legal",      cex: "legal",      p2p: "legal",      mine: "legal",      pay: "illegal",
    note: "Bappebti permits crypto trading as a commodity. Bank Indonesia prohibits using crypto as a payment method. Some local exchanges list XMR." },
  { c: "🇹🇷", n: "Turkey",              hold: "legal",      cex: "legal",      p2p: "legal",      mine: "legal",      pay: "illegal",
    note: "Crypto payments for goods/services banned since 2021. Trading and holding remain fully legal. Major Turkish exchanges list XMR." },
  { c: "🇦🇷", n: "Argentina",           hold: "legal",      cex: "legal",      p2p: "legal",      mine: "legal",      pay: "legal",
    note: "Crypto activity broadly permitted. Heavy inflation drives extensive P2P trading. Monero used in remittance corridors via Lemon Cash and Bitso." },
  { c: "🇿🇦", n: "South Africa",        hold: "legal",      cex: "legal",      p2p: "legal",      mine: "legal",      pay: "legal",
    note: "SARB classifies crypto as a 'financial asset'. Luno doesn't list XMR but VALR does. Mining is taxed; payment acceptance unrestricted." },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

type LegalityRowProps = {
  row: MatrixRow;
  open: boolean;
  onToggle: () => void;
};

function LegalityRow({ row, open, onToggle }: LegalityRowProps) {
  const chip = (key: ActivityKey) => {
    const v = row[key];
    const palette: Record<ActivityStatus, { c: string; l: string }> = {
      legal:      { c: "var(--g-50)",   l: "Legal" },
      restricted: { c: "var(--y-50)",   l: "Restricted" },
      illegal:    { c: "var(--r-50)",   l: "Illegal" },
      unclear:    { c: "var(--ink-60)", l: "Unclear" },
    };
    const p = palette[v] ?? palette.unclear;
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "3px 8px", border: "1px solid " + p.c, color: p.c, borderRadius: 2,
        fontFamily: "var(--f-mono)", fontSize: 9.5, letterSpacing: "0.08em", textTransform: "uppercase",
        background: v === "illegal" ? "rgba(255,77,109,0.06)" : "transparent",
      }}>
        <span style={{ width: 5, height: 5, borderRadius: 5, background: p.c, boxShadow: `0 0 4px ${p.c}` }} />
        {p.l}
      </span>
    );
  };
  return (
    <div style={{ border: "1px solid var(--rule)", borderRadius: 3, overflow: "hidden" }}>
      <button type="button" onClick={onToggle}
        style={{
          appearance: "none", cursor: "pointer", width: "100%", background: open ? "rgba(255,122,26,0.05)" : "transparent",
          border: 0, padding: "12px 16px", color: "inherit", textAlign: "left",
          display: "grid", gridTemplateColumns: "32px 1.4fr repeat(5, 1fr) 24px", gap: 10, alignItems: "center",
          fontFamily: "var(--f-mono)",
        }}>
        <span style={{ fontSize: 18 }}>{row.c}</span>
        <span style={{ fontSize: 12.5, color: "var(--ink-100)" }}>{row.n}</span>
        {chip("hold")}{chip("cex")}{chip("p2p")}{chip("mine")}{chip("pay")}
        <span style={{ color: "var(--ink-60)", fontSize: 11 }}>{open ? "▾" : "▸"}</span>
      </button>
      {open ? (
        <div style={{ padding: "10px 18px 14px 60px", borderTop: "1px dashed var(--ink-10)", background: "rgba(0,0,0,0.3)" }}>
          <p className="mono dim" style={{ margin: 0, fontSize: 11.5, lineHeight: 1.7 }}>{row.note}</p>
          <div className="mono" style={{ marginTop: 10, fontSize: 10.5, color: "var(--ink-60)", letterSpacing: "0.06em" }}>
            <b style={{ color: "var(--ink-80)" }}>Activity legend:</b> <span style={{ color: "var(--ink-80)" }}>Hold</span> · <span style={{ color: "var(--ink-80)" }}>CEX trade</span> · <span style={{ color: "var(--ink-80)" }}>P2P trade</span> · <span style={{ color: "var(--ink-80)" }}>Mine</span> · <span style={{ color: "var(--ink-80)" }}>Accept as payment</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Exported tab component ─────────────────────────────────────────────────────

export function LegalityTab(_props: MoneroTabProps) {
  const [open, setOpen] = React.useState<number | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <PageHeader
        kicker="Legal status · jurisdictions · per-activity"
        title={'Where Monero <em style="color:var(--p-50);font-style:normal">is, and isn’t</em>, legal.'}
        sub="Monero itself has never been outlawed in most countries. What's restricted, jurisdiction by jurisdiction, is specific activities — centralized exchange access, mining, or merchant acceptance. Click any country for details."
      />

      {/* Quick reference legend */}
      <Card style={{ padding: 18 }}>
        <div className="kicker" style={{ marginBottom: 10 }}>Quick reference · 5 activities × 4 statuses</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, fontFamily: "var(--f-mono)", fontSize: 11.5 }}>
          {[
            { c: "var(--g-50)", l: "Legal", d: "No specific restriction. Treated like any digital asset." },
            { c: "var(--y-50)", l: "Restricted", d: "Permitted but with reporting requirements or licensing limits." },
            { c: "var(--r-50)", l: "Illegal", d: "Specifically prohibited or fully criminalized for individuals." },
            { c: "var(--ink-60)", l: "Unclear", d: "Legal grey zone; no specific guidance or active enforcement." },
          ].map((s) => (
            <div key={s.l} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 8 }}>
              <span style={{ width: 6, height: 6, borderRadius: 3, background: s.c, boxShadow: `0 0 5px ${s.c}`, marginTop: 6 }} />
              <div>
                <div style={{ color: s.c, letterSpacing: "0.1em", textTransform: "uppercase", fontSize: 10.5 }}>{s.l}</div>
                <div className="dim" style={{ fontSize: 11, lineHeight: 1.5, marginTop: 2 }}>{s.d}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Activity-matrix header */}
      <Card style={{ padding: 22 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div className="kicker">Country × activity matrix</div>
            <div className="mono dim" style={{ fontSize: 11.5, marginTop: 4 }}>{LEGALITY_MATRIX.length} jurisdictions · click any row to expand</div>
          </div>
          <div className="mono" style={{ display: "grid", gridTemplateColumns: "32px 1.4fr repeat(5, 1fr) 24px", gap: 10, fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-40)", minWidth: 720 }}>
            <span></span><span>Country</span>
            <span>Hold</span><span>CEX</span><span>P2P</span><span>Mine</span><span>Pay</span><span></span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {LEGALITY_MATRIX.map((row, i) => (
            <LegalityRow key={row.n} row={row}
              open={open === i}
              onToggle={() => setOpen(open === i ? null : i)} />
          ))}
        </div>

        <p className="mono dim" style={{ fontSize: 10.5, marginTop: 14, lineHeight: 1.5 }}>
          ⚠ This is design preview content. Verify current legal status before relying on it for any jurisdiction or activity. Laws change quickly in crypto.
        </p>
      </Card>

      {/* Existing timeline (kept) */}
      <Card style={{ padding: 26 }}>
        <div className="kicker">Exchange delistings · timeline</div>
        <h3 className="serif" style={{ margin: "10px 0 6px", fontSize: 22, fontWeight: 400, color: "var(--ink-100)" }}>The long retreat from regulated venues.</h3>
        <p className="mono dim" style={{ fontSize: 12, lineHeight: 1.7, marginBottom: 16 }}>
          Delisting is a regulatory artefact, not a verdict on the protocol. Jurisdictions have made compliance with anti-anonymity rules incompatible with listing.
          The on-ramps thinned; the protocol did not.
        </p>
        <div style={{ position: "relative", paddingLeft: 18, borderLeft: "1px dashed var(--ink-20)", display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            { d: "2018-06-18", v: "Japan FSA · all privacy coins",  who: "All licensed JP exchanges",   why: "FSA orders 'anonymous virtual currencies' removed from licensed venues" },
            { d: "2020-12-31", v: "BitBay (PL)",                   who: "Polish exchange",             why: "AML directive pre-MiCA" },
            { d: "2021-01-26", v: "Shapeshift exits all crypto",   who: "ShapeShift",                   why: "Pivot to DEX model · indirect Monero loss" },
            { d: "2023-06-21", v: "Kraken UK",                     who: "Kraken UK retail",             why: "FCA registration requirement" },
            { d: "2023-11-08", v: "Binance · global delisting",    who: "Binance globally on regulated rails", why: "Compliance with multiple jurisdictions" },
            { d: "2024-12-30", v: "MiCA enforcement live",         who: "All EU CASPs",                 why: "Anti-anonymity provisions of EU Markets in Crypto-Assets" },
            { d: "2025-09-15", v: "LocalMonero.co shuts down",     who: "P2P platform itself",          why: "Operator citing increasing legal complexity" },
            { d: "2026-01-22", v: "73 delistings YTD",             who: "Various CEXs",                 why: "Cumulative MiCA / OFAC / AUSTRAC pressure across 2025" },
          ].map((e, i) => (
            <div key={i} style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: -25, top: 6, width: 10, height: 10, borderRadius: 5, border: "1px solid var(--r-50)", background: "var(--bg-0)", boxShadow: "var(--glow-1)" }} />
              <div className="mono" style={{ fontSize: 10, letterSpacing: "0.16em", color: "var(--ink-60)" }}>{e.d}</div>
              <div className="mono" style={{ fontSize: 13, color: "var(--ink-100)", marginTop: 2 }}><b className="dn">{e.v}</b> · <span className="dim">{e.who}</span></div>
              <p className="mono dim" style={{ margin: "4px 0 0", fontSize: 11, lineHeight: 1.55 }}>{e.why}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
