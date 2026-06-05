/**
 * pages/MoneroPage.tsx — origin / philosophy / timeline.
 */

import * as React from "react";
import { useNavigate } from "react-router-dom";
import { AppShell, PageHeader } from "@/layout/AppShell";
import { Card, Crumbs } from "@/design/primitives";

const PILLARS = [
  {
    c: "var(--tk-accent)",
    k: "Private by default",
    t: "Every transaction.",
    b: "Bitcoin's privacy is opt-in and circumstantial. Monero's is mandatory at the protocol layer — every sender, recipient, and amount is hidden by construction.",
  },
  {
    c: "var(--p-50)",
    k: "Fungible by design",
    t: "1 XMR ≡ 1 XMR.",
    b: "No coin has a transparent history. Exchanges can't blacklist outputs because there are no addresses on chain to blacklist.",
  },
  {
    c: "var(--g-50)",
    k: "Permanent emission",
    t: "0.6 XMR forever.",
    b: "The tail emission keeps miners paid into deep time. There is no \"security budget cliff\" — the hearth stays lit.",
  },
];

const TIMELINE = [
  ["2012", "CryptoNote whitepaper",      "Anonymous author 'Nicolas van Saberhagen' publishes the foundational privacy framework — ring signatures and stealth addresses."],
  ["2014", "Monero forks from Bytecoin", "thankful_for_today proposes BitMonero. Community rejects the premine; fork to Monero v0.1 in April."],
  ["2017", "RingCT mandatory",            "Confidential transactions hide amounts on every transaction. No opt-out — fungibility by force."],
  ["2018", "Bulletproofs",                "Range proofs shrink ~80%. Fees drop. The 'private but bloated' tradeoff dissolves."],
  ["2022", "Ring size 16 · CLSAG",        "Permanent ring-16. Plausible-deniability for every output gets a 16× multiplier."],
  ["2024", "Bulletproofs+ · view tags",   "Wallet sync gets 30-40% faster. Verification cost drops. The math gets quieter."],
  ["2026", "FCMP++ ← you are here",       "Full-chain Membership Proofs. Anonymity set goes from 16 to 150M+. The end-state of CryptoNote."],
] as const;

export function MoneroPage() {
  const navigate = useNavigate();
  return (
    <AppShell hideRail bg={{ intensity: "calm" }}>
      <div style={{ padding: "32px 48px 48px", display: "flex", flexDirection: "column", gap: 32, maxWidth: 1400, margin: "0 auto", width: "100%" }}>
        <Crumbs items={["xmr.irish", "v5.0", "monero"]} />
        <PageHeader
          kicker="Origin · philosophy · why now"
          title='A coin that <em style="color:var(--tk-accent);text-shadow:var(--glow-1);font-style:normal">refuses</em> to know who you are.'
          sub="Eleven years old. No premine, no founder reward, no on-chain identity. Built by a rotating cast of cypherpunks."
        />

        <section style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {PILLARS.map((p) => (
            <Card key={p.k} style={{ padding: 22 }}>
              <div className="kicker" style={{ color: p.c }}>{p.k}</div>
              <div className="serif" style={{ fontSize: 28, fontWeight: 500, color: "var(--ink-100)", margin: "8px 0" }}>{p.t}</div>
              <p className="mono dim" style={{ margin: 0, fontSize: 12, lineHeight: 1.65 }}>{p.b}</p>
            </Card>
          ))}
        </section>

        <Card style={{ padding: 28 }}>
          <div className="kicker">Timeline · the lineage</div>
          <div style={{ position: "relative", marginTop: 24, paddingLeft: 18, borderLeft: "1px dashed var(--ink-20)", display: "flex", flexDirection: "column", gap: 18 }}>
            {TIMELINE.map(([y, t, b]) => (
              <div key={y} style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: -25, top: 6, width: 12, height: 12, borderRadius: "50%", border: "1px solid var(--tk-accent)", background: "var(--bg-0)", boxShadow: "var(--glow-1)" }} />
                <div className="mono" style={{ fontSize: 10, letterSpacing: "0.18em", color: "var(--tk-accent)", textShadow: "var(--glow-1)" }}>{y}</div>
                <div className="serif" style={{ fontSize: 20, fontWeight: 500, color: "var(--ink-100)", marginTop: 2 }}>{t}</div>
                <p className="mono dim" style={{ margin: "4px 0 0", fontSize: 11.5, lineHeight: 1.6, maxWidth: "70ch" }}>{b}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card style={{ padding: 24, display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 24 }}>
          <div>
            <div className="kicker">Want to feel it?</div>
            <div className="serif" style={{ fontSize: 26, color: "var(--ink-100)", marginTop: 6 }}>Walk through every primitive that makes the privacy work.</div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={() => navigate("/education")} className="proto-btn"
              style={{ borderColor: "var(--p-50)", color: "var(--p-50)", boxShadow: "var(--glow-p)" }}>
              Education →
            </button>
            <button type="button" onClick={() => navigate("/simulate")} className="proto-btn">Simulate →</button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
