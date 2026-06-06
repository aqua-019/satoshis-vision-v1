/**
 * pages/monero/OriginTab.tsx — Monero origin: lineage, founders, CCS funding, culture.
 * Ported verbatim from five01 monero-pages.jsx → MoneroOrigin (lines 100–295).
 */

import * as React from "react";
import { PageHeader } from "@/layout/AppShell";
import { Card } from "@/design/primitives";
import type { MoneroTabProps } from "./tabs";

const LINEAGE = [
  {
    y: "OCT 2012",
    t: "CryptoNote v2 whitepaper",
    c: "var(--p-50)",
    b: 'Anonymous "Nicolas van Saberhagen" publishes the foundational privacy framework. Ring signatures, stealth addresses, one-time keys.',
  },
  {
    y: "MAR 2014",
    t: "Bytecoin (BCN) launch",
    c: "var(--ink-60)",
    b: "Claims a 2-year history. Investigators find 82% of supply was premined. Trust evaporates within weeks.",
  },
  {
    y: "APR 2014",
    t: "BitMonero fork",
    c: "var(--y-50)",
    b: "thankful_for_today forks Bytecoin, proposes a 60s block target. Community rejects his unilateral changes within 5 days.",
  },
  {
    y: "APR 2014",
    t: "Monero v0.1 (the rename)",
    c: "var(--tk-accent)",
    b: "Seven anonymous developers — known as the Core Team — take over the fork. 120s block target. No premine, no founder reward.",
  },
  {
    y: "TODAY",
    t: "11 years, no insider exits",
    c: "var(--g-50)",
    b: "Pseudonymous core team. Donation-funded. No company, no CEO, no token sale. Has shipped every hardfork on schedule.",
  },
] as const;

const CORE_TEAM = [
  {
    n: "fluffypony (Riccardo Spagni)",
    r: "Maintainer 2014–2019",
    c: "var(--tk-accent)",
    desc: "Public face for years. Stepped back to focus on Tari. Currently entangled in personal legal issues unrelated to Monero.",
  },
  {
    n: "luigi1111",
    r: "Maintainer · still active",
    c: "var(--p-50)",
    desc: "Reproducible-build infrastructure, payment-tooling lead. Quiet and consistent.",
  },
  {
    n: "binaryFate",
    r: "Cryptographer",
    c: "var(--c-50)",
    desc: "Bulletproofs+, RingCT review, FCMP++ co-author.",
  },
  {
    n: "moneromooo",
    r: "Core dev · prolific",
    c: "var(--g-50)",
    desc: "Largest single contributor by commits. Real name still unknown.",
  },
  {
    n: "Snipa22",
    r: "Infra / mining-pool dev",
    c: "var(--y-50)",
    desc: "Author of nodejs-pool, runs SupportXMR.",
  },
  {
    n: "dEBRUYNE",
    r: "Community + comms",
    c: "var(--ink-60)",
    desc: "Moderator on r/Monero, release notes, security disclosure routing.",
  },
  {
    n: "selsta",
    r: "Maintainer · 2020–",
    c: "var(--tk-accent)",
    desc: "Current de-facto lead maintainer. Steady ship cadence.",
  },
] as const;

const CCS_PROPOSALS: readonly [string, string, string][] = [
  ["Bulletproofs+ implementation",    "112 XMR",    "binaryFate, 2022"],
  ["FCMP++ core proof system",         "1,800 XMR",  "kayabaNerve + binaryFate, 2024"],
  ["P2Pool integration",               "640 XMR",    "SChernykh, 2021"],
  ["CLSAG audit (Kudelski Security)",  "12,000 EUR", "2020 — paid in XMR"],
  ["Monero GUI accessibility",         "84 XMR",     "selsta, 2023"],
  ["Tor onion-services hardening",     "55 XMR",     "rottenwheel, 2022"],
  ["LWS (light-wallet server) v2",     "210 XMR",    "moneromooo, 2023"],
  ["Atomic swap (Haveno fork)",        "750 XMR",    "Haveno team, 2023"],
];

const SEVEN_WHO_TOOK_OVER = [
  {
    n: "tacotime",
    r: "Original architect",
    c: "var(--tk-accent)",
    desc: "Wrote the first official Monero codebase. Stepped back from public view within a year. Real identity unknown.",
  },
  {
    n: "smooth",
    r: "Crypto + monetary",
    c: "var(--c-50)",
    desc: "Pushed the case for tail emission. Influential in the 2014 debate against thankful_for_today's 60-second block target. Active through 2018.",
  },
  {
    n: "othe",
    r: "Core developer",
    c: "var(--g-50)",
    desc: "Early CryptoNote analyst. Co-authored the technical critique of Bytecoin's premine.",
  },
  {
    n: "eizh",
    r: "Comms + advocacy",
    c: "var(--p-50)",
    desc: "Edited /r/Monero and the Monero StackExchange in its first years. Public-facing pseudonym; widely respected.",
  },
  {
    n: "fluffypony",
    r: "Maintainer 2014–19",
    c: "var(--y-50)",
    desc: "(Riccardo Spagni) The first developer to use his real name. Maintained for ~5 years. Now focused on Tari.",
  },
  {
    n: "NoodleDoodle",
    r: "Crypto + GUI",
    c: "var(--c-50)",
    desc: "Wrote the early CLI wallet. Performance work on the daemon's transaction validation path.",
  },
  {
    n: "BinaryFate",
    r: "Cryptographer · still active",
    c: "var(--p-50)",
    desc: "Author of Bulletproofs+ implementation. Co-author of FCMP++ paper. Still ships code in 2026.",
  },
] as const;

const NOTABLE_SHIPPING: readonly [string, string, string][] = [
  ["2023-04", "Bulletproofs+ shipped · v15 hardfork",       "binaryFate, with audit by Kudelski Security"],
  ["2023-08", "P2Pool v3 · stratum hardening",               "SChernykh + community"],
  ["2024-01", "View-tags reach 30%+ sync time reduction",    "selsta, moneromooo"],
  ["2024-06", "Cuprate alpha · first Rust full sync",        "boog900, hinto-janai"],
  ["2024-10", "FCMP++ paper · published",                    "kayabaNerve, binaryFate, jeffro256"],
  ["2025-02", "Atomic-swap volume crosses $100M lifetime",   "Haveno team + community"],
  ["2025-07", "Seraphis spec freeze for review",              "jeffro256, kayabaNerve"],
  ["2026-01", "FCMP++ stressnet launches",                   "Core dev + MRL"],
];

export function OriginTab(_props: MoneroTabProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <PageHeader
        kicker="Lineage · CryptoNote · founders"
        title='The <em style="color:var(--tk-accent);text-shadow:var(--glow-1);font-style:normal">unlikely</em> fork.'
        sub="Bytecoin was a botched launch. BitMonero was a quiet rebellion. Monero is what happened when nobody was in charge."
      />

      {/* Lineage diagram */}
      <Card style={{ padding: 26 }}>
        <div className="kicker">Lineage · 2012 → today</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginTop: 20, alignItems: "stretch" }}>
          {LINEAGE.map((e, i) => (
            <div key={i} style={{ borderTop: `2px solid ${e.c}`, paddingTop: 12, paddingRight: 6 }}>
              <div className="mono" style={{ fontSize: 9.5, letterSpacing: "0.16em", color: e.c, textShadow: `0 0 6px ${e.c}` }}>{e.y}</div>
              <div className="serif" style={{ fontSize: 17, fontWeight: 500, color: "var(--ink-100)", marginTop: 6, lineHeight: 1.2 }}>{e.t}</div>
              <p className="mono dim" style={{ margin: "8px 0 0", fontSize: 11, lineHeight: 1.55 }}>{e.b}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Founders / contributors */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card style={{ padding: 22 }}>
          <div className="kicker">The Core Team · 7 pseudonyms</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            {CORE_TEAM.map((p) => (
              <div key={p.n} style={{ display: "grid", gridTemplateColumns: "12px 1fr", gap: 12, padding: "6px 0", borderTop: "1px dashed var(--ink-10)" }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: p.c, boxShadow: `0 0 6px ${p.c}`, marginTop: 6 }} />
                <div>
                  <div className="mono" style={{ fontSize: 12, color: "var(--ink-100)" }}>{p.n}</div>
                  <div className="mono dim" style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: p.c }}>{p.r}</div>
                  <p className="mono dim" style={{ margin: "4px 0 0", fontSize: 11, lineHeight: 1.55 }}>{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card style={{ padding: 22 }}>
          <div className="kicker">Funding model · CCS (Community Crowdfunding System)</div>
          <p className="mono dim" style={{ margin: "10px 0 14px", fontSize: 12, lineHeight: 1.7 }}>
            Every Monero feature since 2017 has been built via the CCS — a milestone-based bounty system funded by community donations.
            No VCs, no token sale, no foundation salary roll. Developers propose work, community funds it, milestones gate payouts.
          </p>
          <div className="mono" style={{ fontSize: 12, color: "var(--ink-100)", marginTop: 4 }}>Sample funded proposals</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8, fontSize: 11 }} className="mono">
            {CCS_PROPOSALS.map(([t, amt, who]) => (
              <div key={t} style={{ display: "grid", gridTemplateColumns: "1fr 90px 1fr", gap: 8, padding: "3px 0", borderBottom: "1px dashed var(--ink-10)" }}>
                <span style={{ color: "var(--ink-80)" }}>{t}</span>
                <span className="acc" style={{ textAlign: "right" }}>{amt}</span>
                <span className="dim2" style={{ fontSize: 10 }}>{who}</span>
              </div>
            ))}
          </div>
          <p className="mono dim" style={{ fontSize: 10.5, marginTop: 12, color: "var(--ink-40)" }}>
            Total disbursed via CCS: ~25,000 XMR across ~150 proposals (2017–2026). No salaries; only deliverables.
          </p>
        </Card>
      </section>

      {/* The Bytecoin scandal */}
      <Card style={{ padding: 22 }}>
        <div className="kicker">Why the fork was necessary</div>
        <p className="serif" style={{ margin: "12px 0", fontSize: 21, fontWeight: 400, color: "var(--ink-100)", lineHeight: 1.5 }}>
          When researchers analyzed Bytecoin's claimed-2012 launch in 2014, they found
          <em style={{ color: "var(--r-50)", fontStyle: "normal" }}> 82% of the supply had been quietly mined </em>
          before public release. The "two-year-old chain" was a marketing fiction.
        </p>
        <p className="mono dim" style={{ fontSize: 12, lineHeight: 1.7 }}>
          CryptoNote was sound. Bytecoin was not. The Monero fork preserved the protocol and threw out the launch. Every feature since — RingCT, Bulletproofs, CLSAG, view tags, FCMP++ — has been built in the open, audited, and released under a community process. The "fair launch" lineage is rare; Monero is one of perhaps three major coins (with Bitcoin and Litecoin) that genuinely had one.
        </p>
      </Card>

      {/* The 7 founders / split / who-is-who */}
      <Card style={{ padding: 26 }}>
        <div className="kicker">The seven who took over · April 2014</div>
        <h3 className="serif" style={{ margin: "10px 0 14px", fontSize: 22, fontWeight: 400, color: "var(--ink-100)" }}>
          When <em style={{ color: "var(--r-50)", fontStyle: "normal" }}>thankful_for_today</em> proposed changes the community rejected, seven pseudonyms forked his fork. None of them had a name. None of them have one today.
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginTop: 12 }}>
          {SEVEN_WHO_TOOK_OVER.map((p) => (
            <div key={p.n} style={{ padding: 12, border: "1px solid var(--rule)", borderRadius: 2, display: "grid", gridTemplateColumns: "8px 1fr", gap: 12 }}>
              <span style={{ width: 6, height: 6, borderRadius: 3, background: p.c, boxShadow: `0 0 5px ${p.c}`, marginTop: 6 }} />
              <div>
                <div className="mono" style={{ fontSize: 13, color: "var(--ink-100)" }}>{p.n}</div>
                <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: p.c, marginTop: 2 }}>{p.r}</div>
                <p className="mono dim" style={{ margin: "8px 0 0", fontSize: 11, lineHeight: 1.6 }}>{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mono dim" style={{ marginTop: 16, fontSize: 11, lineHeight: 1.7 }}>
          The seventh seat has rotated several times since 2014 — the active core has averaged 5–7 people. <b style={{ color: "var(--g-50)" }}>No founder ever sold a stake</b>; there was no stake to sell. The protocol is governed by donation-funded contributors with no equity, no token allocation, no central foundation salary roll.
        </p>
      </Card>

      {/* Eleven-year cultural arc */}
      <Card style={{ padding: 26 }}>
        <div className="kicker">Culture · eleven years · no insider exits</div>
        <h3 className="serif" style={{ margin: "10px 0 18px", fontSize: 22, fontWeight: 400, color: "var(--ink-100)" }}>
          What kept it together when there was nothing holding it together.
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 22 }}>
          <div>
            <h4 className="mono" style={{ margin: 0, fontSize: 12, color: "var(--tk-accent)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Governance posture</h4>
            <p className="mono dim" style={{ fontSize: 12, lineHeight: 1.75, marginTop: 8 }}>
              Monero has <b style={{ color: "var(--ink-100)" }}>no token holders</b>, no DAO, no quadratic vote. Protocol changes happen through MRL (Monero Research Lab) papers, public IRC/Matrix review, and CCS funding. A change must clear three filters: cryptographic correctness, performance acceptable to node operators, and rough consensus among ~30 active contributors. The bar is high; very few proposals ever ship.
            </p>
          </div>
          <div>
            <h4 className="mono" style={{ margin: 0, fontSize: 12, color: "var(--p-50)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Conflict, openly</h4>
            <p className="mono dim" style={{ fontSize: 12, lineHeight: 1.75, marginTop: 8 }}>
              Monero is also one of the few protocols with a public record of internal disagreements — fluffypony's resignation, the 2018 bulletproof timeline debate, the tail-emission dispute. None of these caused a fork. The community ships its disagreements as PRs and CCS proposals, not as token-vote referendums.
            </p>
          </div>
          <div>
            <h4 className="mono" style={{ margin: 0, fontSize: 12, color: "var(--c-50)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Funding · CCS</h4>
            <p className="mono dim" style={{ fontSize: 12, lineHeight: 1.75, marginTop: 8 }}>
              Every protocol upgrade since 2017 was funded by the Community Crowdfunding System — milestone-based bounties paid in XMR by donors. Total disbursed: ~25,000 XMR across ~150 proposals. No salaries; only deliverables. This funding model is the reason Monero has never required a treasury or company.
            </p>
          </div>
          <div>
            <h4 className="mono" style={{ margin: 0, fontSize: 12, color: "var(--g-50)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Pseudonymous credibility</h4>
            <p className="mono dim" style={{ fontSize: 12, lineHeight: 1.75, marginTop: 8 }}>
              By staying pseudonymous, contributors limit legal exposure as anti-privacy regulation accelerates. There is no "Monero Foundation CEO" to subpoena, no compliance officer to threaten. The Bitcoin "Satoshi" departure created a power vacuum; Monero's design avoids the vacuum by never having a king.
            </p>
          </div>
        </div>
      </Card>

      {/* Notable contributors (deeper) */}
      <Card style={{ padding: 22 }}>
        <div className="kicker">Notable shipping in the last 36 months</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginTop: 14, fontFamily: "var(--f-mono)", fontSize: 11.5 }}>
          {NOTABLE_SHIPPING.map(([d, t, who]) => (
            <div key={d + t} style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 12, paddingTop: 6, borderTop: "1px dashed var(--ink-10)" }}>
              <span className="dim" style={{ color: "var(--tk-accent)", letterSpacing: "0.1em" }}>{d}</span>
              <div>
                <div style={{ color: "var(--ink-100)" }}>{t}</div>
                <div className="dim" style={{ fontSize: 10.5, marginTop: 2 }}>{who}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
