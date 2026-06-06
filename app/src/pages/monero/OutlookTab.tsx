/**
 * pages/monero/OutlookTab.tsx — Monero 2027+ forward outlook: the demand thesis,
 * the upcoming-upgrades timeline, and the final BTC/XMR accounting.
 * Ported from five01 bottom-line.jsx → MoneroOutlook. Editorial content — verify figures before publishing.
 */

import * as React from "react";
import { PageHeader } from "@/layout/AppShell";
import { Card } from "@/design/primitives";
import { EduChapter, EduMilestone } from "@/pages/_education/EduAtoms";
import type { MoneroTabProps } from "./tabs";

/* ══ 2027+ OUTLOOK TAB ══════════════════════════════════════ */
export function OutlookTab({ data }: MoneroTabProps) {
  void data; // data not needed by this static editorial tab; satisfies the shared props contract
  const FUTURE: { d: string; t: string; c: string; b: string }[] = [
    { d: "July 2027 (expected)", t: "EU AMLR Full Enforcement", c: "var(--y-50)", b: "The EU Anti-Money-Laundering Regulation becomes fully effective. CASPs are prohibited from offering privacy coins — but self-custody wallets and peer-to-peer trading remain accessible. The rules target service providers, not the technology." },
    { d: "Mid-2026 (tentative)", t: "FCMP++ Mainnet Deployment", c: "var(--tk-accent)", b: "Full-Chain Membership Proofs replace ring signatures with anonymity sets of 150M+ outputs — every transaction hiding among the entire history of the chain. Bundled with CARROT addressing; backward compatible with 95-character addresses." },
    { d: "April 2028 (expected)", t: "Fifth Bitcoin Halving", c: "var(--c-50)", b: "Block ~1,050,000. The reward drops from 3.125 to 1.5625 BTC; daily supply falls to ~225 BTC. By then 97%+ of all Bitcoin will have been mined." },
    { d: "2026 – 2028", t: "Seraphis & Jamtis", c: "var(--p-50)", b: "Seraphis redesigns the transaction protocol; Jamtis brings new addressing with forward secrecy and tiered wallet permissions — the most ambitious protocol evolution since RingCT." },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
      <PageHeader kicker="2026 – 2030 · forward outlook"
        title='The road <em style="color:var(--p-50);text-shadow:var(--glow-p);font-style:normal">ahead</em>'
        sub="Where the two monetary paths go next — surveillance frameworks tightening on one side, the largest privacy upgrade in Monero's history landing on the other." />

      <Card style={{ padding: 26 }}>
        <div className="kicker">The demand thesis</div>
        <p className="serif" style={{ fontSize: 22, lineHeight: 1.45, color: "var(--ink-100)", margin: "12px 0 14px" }}>
          Privacy demand is structural, not speculative.
        </p>
        <p className="mono dim" style={{ fontSize: 13, lineHeight: 1.72, margin: 0 }}>
          In 2025, dozens of jurisdictions implemented stricter compliance frameworks targeting privacy coins — and yet Monero's price rose 195%, its network processed 15,000–25,000 daily transactions, and its community grew. Every new surveillance framework (DAC8, CLARITY, GENIUS, AMLR) expands the addressable market for private money. Supply tightened by delistings + persistent demand moving P2P = structural price support.
        </p>
      </Card>

      <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <EduChapter n="2027+" kicker="Upcoming" title="What's coming"
          sub="Scheduled hard forks, regulatory deadlines, and the upgrades that define the next era of private money." />
        <div>
          {FUTURE.map((f, i) => (
            <EduMilestone key={i} date={f.d} title={f.t} tone={f.c}>{f.b}</EduMilestone>
          ))}
        </div>
      </section>

      <Card style={{ padding: 26 }}>
        <div className="kicker">The final accounting</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 14 }}>
          <div>
            <div className="serif" style={{ fontSize: 20, color: "var(--c-50)", marginBottom: 6 }}>Bitcoin chose traceability</div>
            <p className="mono dim" style={{ fontSize: 12.5, lineHeight: 1.65, margin: 0 }}>Gained Wall Street, ETFs, corporate treasuries, Strategic Reserve status, and a $2T+ market cap — by becoming fully auditable.</p>
          </div>
          <div>
            <div className="serif" style={{ fontSize: 20, color: "var(--tk-accent)", marginBottom: 6 }}>Monero chose privacy</div>
            <p className="mono dim" style={{ fontSize: 12.5, lineHeight: 1.65, margin: 0 }}>Gained the mathematical guarantee that no government, corporation, or surveillance state can see your transactions — by accepting institutional exclusion.</p>
          </div>
        </div>
        <p className="serif" style={{ fontSize: 18, color: "var(--ink-100)", marginTop: 18, marginBottom: 0 }}>The world needs both. Bitcoin for when you want Wall Street's blessing. Monero for when you want freedom.</p>
      </Card>
    </div>
  );
}
