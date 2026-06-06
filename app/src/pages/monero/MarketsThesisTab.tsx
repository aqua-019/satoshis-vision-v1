/**
 * pages/monero/MarketsThesisTab.tsx — Price action · thesis · macro view · 2026.
 * Ported verbatim from five01 monero-pages.jsx → MoneroMarketsThesis (lines 598–807).
 */

import * as React from "react";
import { PageHeader } from "@/layout/AppShell";
import { Card } from "@/design/primitives";
import type { MoneroTabProps } from "./tabs";

const THESIS_STATS = [
  { v: "$625,000", w: "IRS bounty for cracking Monero. They failed." },
  { v: "$22M",     w: "Chainalysis contract to trace it. Their own leaked training admits they cannot." },
  { v: "73",       w: "Exchange delistings in 2025 alone. Because they cannot comply with surveillance laws while offering true privacy." },
  { v: "+195%",    w: "Monero's price in 2025. Because demand for privacy is not a crime — it is a human right." },
] as const;

const CATALYST_CARDS = [
  { h: "Political shift",    c: "var(--tk-accent)", b: "High-profile US policymakers reframed privacy as a 'constitutional right' alongside global economic uncertainty driving capital toward financial-autonomy assets." },
  { h: "Technical breakout", c: "var(--c-50)",      b: "Cleared multi-year resistance into price discovery. Capital rotation out of transparent chains into privacy-focused assets accelerated the move." },
  { h: "Zcash collapse",     c: "var(--y-50)",      b: "ECC dev team resignation triggered a ~20% ZEC drawdown. Major capital rotation directly into Monero." },
  { h: "Paradox validation", c: "var(--p-50)",      b: "Dubai DFSA ban on privacy tokens paradoxically validated Monero's tech. CLARITY Act progress highlighted the surveillance-vs-privacy divide." },
  { h: "The descent",        c: "var(--r-50)",      b: "By early February, XMR retraced 57% — driven by accelerated delistings including Binance. Pattern: pump on validation, retrace on access restriction, higher lows each cycle." },
] as const;

const DEMAND_DRIVERS = [
  {
    n: "I", t: "CLARITY · GENIUS · DAC8",
    h: "The 'tracked economy' reaction",
    c: "var(--tk-accent)",
    b: "The GENIUS and CLARITY Acts now require all digital-currency trading to follow disclosure and registration rules similar to other regulated assets. New IRS rules require Form 1099-DA reporting starting 2026; the EU's DAC8 directive (live since Jan 1 2026) forces CASPs to disclose customer and transaction details to tax officials. Every new reporting mandate is essentially free marketing for the one asset that can't be surveilled.",
  },
  {
    n: "II", t: "Sanctions evasion · geopolitics",
    h: "Iran, the IRGC, and the BTC→XMR migration",
    c: "var(--r-50)",
    b: "Iran built a multi-billion-dollar parallel economy on state-sponsored BTC mining and stablecoins. IRGC accounts received >$3B in 2025 alone. Cost to mine 1 BTC in Iran ≈ $1,320 (subsidized power) vs. market ~$68,000 — a massive arbitrage. As Chainalysis improves BTC tracing of IRGC wallets, the logical next step for sanctioned actors is migration toward untraceable assets. State-driven sanctions evasion volume surged 694% in 2025.",
  },
  {
    n: "III", t: "Darknet markets · already happening",
    h: "Privacy as a network effect",
    c: "var(--p-50)",
    b: "TRM Labs data shows 48% of newly launched darknet marketplaces in 2025 now support XMR exclusively — a sharp acceleration from prior years. Monero is mandatory or preferred on 89% of active markets, with monthly transaction volume estimated at $450M+. Every Chainalysis upgrade, every BTC seizure using on-chain forensics, pushes more volume into XMR permanently.",
  },
  {
    n: "IV", t: "CBDC surveillance state",
    h: "The macro tailwind",
    c: "var(--c-50)",
    b: "BIS reports 91 of 93 surveyed central banks are actively investigating retail or wholesale CBDCs. China's digital yuan is already live; EU is deep into digital-euro pilots. During the ECB consultation, 41% of public comments centered on privacy concerns. Every CBDC launch creates a new cohort of users who realize their government can now see every transaction, freeze funds programmatically, and restrict spending categories. Monero becomes the escape valve.",
  },
  {
    n: "V", t: "Technical upgrades making XMR stronger",
    h: "FCMP++, Cuprate, Seraphis, Jamtis",
    c: "var(--g-50)",
    b: "FCMP++ (mid-2026, tentative) replaces 16-decoy rings with proofs over the entire 150M+ UTXO set, making chain analysis computationally impractical. Cuprate (Rust node) cuts sync times sharply, supporting decentralization under political pressure. Seraphis & Jamtis modernize the transaction structure and add human-readable addresses — currently in beta/audit.",
  },
  {
    n: "VI", t: "The meta-thesis",
    h: "Structural inevitability",
    c: "var(--ink-100)",
    b: "The world is simultaneously doing two contradictory things: making transparent crypto the regulated norm (GENIUS, CLARITY, DAC8, 1099-DA, Travel Rule) while expanding state surveillance capacity (CBDCs, chain analytics, KYC everywhere). Every step in that direction creates organic, non-speculative demand for the one asset that provides genuine financial privacy by default. The supply side matters too — Monero is already in tail emission with 0.6 XMR / block forever. 73 exchanges delisted in 2025; on-chain activity stayed flat or grew.",
  },
] as const;

const TRACKED_ECONOMY_ITEMS = [
  "Regulation tightens.",
  "Surveillance expands.",
  "CBDCs launch.",
  "Chain analytics improves.",
  "Reporting mandates multiply.",
  "The tracked economy becomes inescapable.",
] as const;

const OTHER_SIDE_ITEMS = [
  "One protocol.",
  "Mathematically private.",
  "Perpetually maintained.",
  "Increasingly hardened.",
  "Supply fixed at tail emission.",
  "Access window narrows with every delisting.",
] as const;

const CYCLE_HIGHS = [
  { cyc: "2017 cycle", peak: "$494 (Jan 2018)",    drawdown: "−92% to $40",       note: "Pre-bulletproofs, fee shock, exchange hype" },
  { cyc: "2020 cycle", peak: "$517 (May 2021)",    drawdown: "−74% to $135",      note: "DeFi bull, ring-16 mandatory, Bulletproofs+" },
  { cyc: "2024 cycle", peak: "$487 (Mar 2025)",    drawdown: "−42% to $282",      note: "Post-MiCA panic, shallow drawdown · structural buyers" },
  { cyc: "2026 ATH",   peak: "$799.89 (Jan 2026)", drawdown: "−57% retrace · Feb", note: "Convergence: CLARITY · DAC8 · Zcash collapse · sanctions migration" },
] as const;

export function MarketsThesisTab(_props: MoneroTabProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <PageHeader
        kicker="Price action · thesis · macro view · 2026"
        title='The <em style="color:var(--tk-accent);font-style:normal">refusing-to-die</em> chart.'
        sub="Eleven years of price action and a thesis for what's next. The market hasn't decided yet whether scarcity-of-privacy is a premium or a discount."
      />

      {/* ── THE THESIS · manifesto block ───────────────────── */}
      <Card style={{ padding: 32, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at top right, rgba(255,122,26,0.06), transparent 60%)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <div className="kicker">The thesis · what Monero represents</div>
          <h2 className="serif" style={{ margin: "12px 0 18px", fontSize: 30, fontWeight: 400, color: "var(--ink-100)", lineHeight: 1.2, letterSpacing: "-0.005em" }}>
            In a world where every transaction is tracked, every purchase logged,
            and every human reduced to a data point —
            Monero exists as the only <em style={{ color: "var(--tk-accent)", fontStyle: "normal" }}>mathematical guarantee</em> of financial privacy on Earth.
          </h2>
          <p className="serif" style={{ margin: "0 0 14px", fontSize: 17, lineHeight: 1.65, color: "var(--ink-80)", fontStyle: "italic" }}>
            This is not hyperbole. This is cryptographic fact.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, marginTop: 22 }}>
            <div>
              <p className="mono" style={{ fontSize: 12.5, lineHeight: 1.85, color: "var(--ink-80)" }}>
                Those in power — governments, corporations, surveillance states — have visibility over everything. They see your bank accounts. They see your card purchases. They see your Bitcoin transactions on a permanent, public ledger. They know when you donate to causes they dislike. They know when you buy books they find subversive. They know when you send money to family in countries they've sanctioned.
              </p>
              <p className="serif" style={{ margin: "16px 0 0", fontSize: 22, lineHeight: 1.35, color: "var(--tk-accent)", fontWeight: 400 }}>
                With Monero, they see nothing.
              </p>
            </div>
            <div>
              <p className="mono" style={{ fontSize: 12.5, lineHeight: 1.85, color: "var(--ink-80)" }}>
                <b style={{ color: "var(--p-50)" }}>Ring signatures</b> hide the sender. <b style={{ color: "var(--p-50)" }}>Stealth addresses</b> hide the receiver. <b style={{ color: "var(--p-50)" }}>RingCT</b> hides the amount. The entire transaction is a mathematical black box. Not private by policy. Not private by promise. <em style={{ color: "var(--ink-100)", fontStyle: "normal" }}>Private by mathematics.</em>
              </p>
              <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 8 }}>
                {THESIS_STATS.map((s) => (
                  <div key={s.v} style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 12, padding: "6px 0", borderTop: "1px dashed var(--ink-10)" }}>
                    <span className="mono acc" style={{ fontSize: 16, color: "var(--tk-accent)", textAlign: "right", textShadow: "var(--glow-1)" }}>{s.v}</span>
                    <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-80)", lineHeight: 1.55 }}>{s.w}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="mono dim" style={{ marginTop: 20, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-40)", textAlign: "right" }}>
            — The Monero Archive, 2026
          </p>
        </div>
      </Card>

      {/* ── THE 2026 CATALYST ───────────────────────────────── */}
      <Card style={{ padding: 26 }}>
        <div className="kicker">The catalyst · January 2026 ATH</div>
        <h3 className="serif" style={{ margin: "10px 0 6px", fontSize: 26, fontWeight: 400, color: "var(--ink-100)" }}>
          XMR hit <em style={{ color: "var(--tk-accent)", fontStyle: "normal", textShadow: "var(--glow-1)" }}>$799.89</em> in mid-January 2026 — a 195% move from early 2025.
        </h3>
        <p className="mono dim" style={{ fontSize: 12, lineHeight: 1.7, margin: "10px 0 18px" }}>
          It wasn't one catalyst. It was the convergence of several forces — political, technical, and structural — that revalued financial privacy from "niche" to "necessary" over the span of twelve months.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
          {CATALYST_CARDS.map((p) => (
            <div key={p.h} style={{ padding: 12, borderTop: `2px solid ${p.c}` }}>
              <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: p.c }}>{p.h}</div>
              <p className="mono dim" style={{ margin: "8px 0 0", fontSize: 11, lineHeight: 1.65 }}>{p.b}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* ── DEMAND DRIVERS ──────────────────────────────────── */}
      <div>
        <div className="kicker" style={{ marginBottom: 12 }}>Demand drivers · structural · 2026</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          {DEMAND_DRIVERS.map((d) => (
            <Card key={d.n} style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <span className="serif" style={{ fontSize: 32, color: d.c, fontWeight: 400, lineHeight: 1, letterSpacing: "-0.02em" }}>{d.n}</span>
                <div>
                  <div className="kicker" style={{ color: d.c }}>{d.t}</div>
                  <div className="serif" style={{ fontSize: 19, color: "var(--ink-100)", margin: "4px 0 0", fontWeight: 400 }}>{d.h}</div>
                </div>
              </div>
              <p className="mono dim" style={{ margin: "12px 0 0", fontSize: 11.5, lineHeight: 1.75 }}>{d.b}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* ── THE CONVERGENCE ─────────────────────────────────── */}
      <Card style={{ padding: 32, background: "rgba(255,122,26,0.04)", borderColor: "rgba(255,122,26,0.3)" }}>
        <div className="kicker">The convergence</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 24, marginTop: 14, alignItems: "stretch" }}>
          <div>
            <div className="mono" style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--r-50)", marginBottom: 10 }}>The tracked economy</div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
              {TRACKED_ECONOMY_ITEMS.map((l) => (
                <li key={l} className="mono" style={{ fontSize: 12.5, color: "var(--ink-80)", paddingLeft: 14, position: "relative" }}>
                  <span style={{ position: "absolute", left: 0, color: "var(--r-50)" }}>×</span>{l}
                </li>
              ))}
            </ul>
          </div>
          <div style={{ width: 1, background: "var(--rule)" }} />
          <div>
            <div className="mono" style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--g-50)", marginBottom: 10 }}>And on the other side</div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
              {OTHER_SIDE_ITEMS.map((l) => (
                <li key={l} className="mono" style={{ fontSize: 12.5, color: "var(--ink-80)", paddingLeft: 14, position: "relative" }}>
                  <span style={{ position: "absolute", left: 0, color: "var(--g-50)" }}>✓</span>{l}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--rule)", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <div className="serif" style={{ fontSize: 22, color: "var(--ink-100)", lineHeight: 1.3 }}>The demand is <em style={{ color: "var(--tk-accent)", fontStyle: "normal" }}>structural</em>.</div>
          <div className="serif" style={{ fontSize: 22, color: "var(--ink-100)", lineHeight: 1.3 }}>The supply is <em style={{ color: "var(--tk-accent)", fontStyle: "normal" }}>fixed</em>.</div>
          <div className="serif" style={{ fontSize: 22, color: "var(--ink-100)", lineHeight: 1.3 }}>The technology is <em style={{ color: "var(--tk-accent)", fontStyle: "normal" }}>unbroken</em>.</div>
        </div>
        <p className="mono dim" style={{ marginTop: 22, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-40)", textAlign: "right" }}>
          — The Monero Archive, March 2026
        </p>
      </Card>

      {/* ── COUNTERARGUMENTS ────────────────────────────────── */}
      <Card style={{ padding: 22 }}>
        <div className="kicker">Counterarguments · eyes open</div>
        <p className="mono dim" style={{ fontSize: 12, lineHeight: 1.75, margin: "10px 0 0" }}>
          The counterarguments are real — exchange delistings reduce liquidity, regulatory crackdowns could intensify, and quantum computing is a theoretical long-term risk. But every demand driver identified above is substantiated by what's actually happening on the ground right now.
        </p>
      </Card>

      {/* ── EXISTING CYCLE TABLE (kept for chart-watchers) ── */}
      <Card style={{ padding: 22 }}>
        <div className="kicker">Cycle highs · marked</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 14, fontSize: 12 }} className="mono">
          {CYCLE_HIGHS.map((c) => (
            <div key={c.cyc} style={{ padding: 12, border: "1px solid var(--rule)", borderRadius: 2 }}>
              <div className="kicker" style={{ color: "var(--tk-accent)" }}>{c.cyc}</div>
              <div className="serif" style={{ fontSize: 18, color: "var(--ink-100)", margin: "6px 0" }}>{c.peak}</div>
              <div className="dn" style={{ fontSize: 11 }}>{c.drawdown}</div>
              <p className="mono dim" style={{ margin: "8px 0 0", fontSize: 10.5, lineHeight: 1.55 }}>{c.note}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
