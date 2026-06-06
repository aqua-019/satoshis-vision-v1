/**
 * pages/monero/AttacksTab.tsx — Attacks survived: bounties, academic papers, operational vectors.
 * Ported verbatim from five01 monero-pages.jsx → MoneroAttacks.
 */

import * as React from "react";
import { PageHeader } from "@/layout/AppShell";
import { Card } from "@/design/primitives";
import type { MoneroTabProps } from "./tabs";

const BOUNTIES = [
  { y: "2020 · IRS-CI", co: "Chainalysis + Integra Fec", amt: "$625,000",     out: "Vendor declared no usable tracing capability. Contract not renewed at full scope." },
  { y: "2021 · CipherTrace", co: "Mastercard subsidiary",   amt: "Confidential",  out: "Filed a Monero-tracing patent. Public capabilities never demonstrated; product line discontinued." },
  { y: "2022 · IRS-CI", co: "Chainalysis (renewed)",       amt: "$1,250,000",   out: "Refocused on metadata correlation (timing, IP) rather than on-chain breaks. No protocol-level deanonymisation." },
  { y: "2024 · Europol", co: "Internal R&D",                amt: "EUR 700,000",  out: "Disclosed limitations report citing FCMP++ as making future approaches infeasible." },
  { y: "2024 · FBI",     co: "Internal + private vendor",   amt: "Unknown",       out: "Leaked court filings suggest reliance on operational-security failures, not protocol breaks." },
  { y: "2025 · UK NCA",  co: "Open contract",               amt: "GBP 350,000",  out: "No public completion. Vendor unwilling to provide tracing guarantees." },
] as const;

const PAPERS = [
  {
    title: "An Empirical Analysis of Linkability in Monero (Möser et al., 2017)",
    status: "Mitigated",
    severity: "var(--g-50)",
    note: "Identified the 0-decoy issue — when most users picked decoys of 0, real spenders were obvious. Patched immediately. Mandatory minimum ring-3, then ring-7, then ring-11, then ring-16.",
  },
  {
    title: "Traceable Monero (Yu et al., 2019)",
    status: "Mitigated",
    severity: "var(--g-50)",
    note: "Studied legacy chain pre-RingCT. Conclusions don't extend to post-2017 transactions.",
  },
  {
    title: "Decoy Selection Heuristics Revisited (Ronge et al., 2021)",
    status: "Improved",
    severity: "var(--y-50)",
    note: "Showed decoy-selection algorithm had subtle bias. Patched in v0.18 with new gamma distribution.",
  },
  {
    title: "Eve, Alice and the Onion (anonymous, 2023)",
    status: "Inconclusive",
    severity: "var(--y-50)",
    note: "Attempted Tor-layer correlation against onion-routed nodes. Findings did not generalise to a population of nodes.",
  },
  {
    title: "FCMP Analysis (kayabaNerve + Diamond, 2024)",
    status: "Pre-deployment",
    severity: "var(--g-50)",
    note: "Formal-method analysis. Confirms anonymity-set expands to full UTXO set with no privacy regressions vs current ring system.",
  },
] as const;

const VECTORS = [
  {
    t: "Sybil attempt · 2014–2015",
    d: "Early P2P network seeded with hostile nodes designed to map peer-to-IP. Mitigated by Dandelion++ rollout in 2018. Net effect: brief operational risk; permanent design improvement.",
  },
  {
    t: "KYC pressure · 2018–present",
    d: "Continuous regulatory campaign to remove Monero from CEX rails. Material on liquidity; immaterial on the protocol. Atomic swaps absorbing displaced volume.",
  },
  {
    t: "Infrastructure DDoS · 2019",
    d: "Coordinated DDoS targeting community nodes during a hardfork window. Network reorganised onto private/cloud-hosted nodes; no chain halt.",
  },
  {
    t: "Malware mining campaigns",
    d: "RandomX is CPU-friendly, which attracts misuse. Counterargument: same property gives Monero its mining decentralisation; few coins can claim a 7%-network-share permissionless pool.",
  },
  {
    t: "Supply-chain attempts · 2022",
    d: "Malicious commits attempted on monero-project repo. Detected by maintainers in review; no shipped binary affected. Reproducible builds harden this.",
  },
] as const;

export function AttacksTab(_props: MoneroTabProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <PageHeader
        kicker="Survived attacks · open record"
        title='A decade of <em style="color:var(--r-50);text-shadow:var(--glow-1);font-style:normal">people trying</em>, and failing.'
        sub="Every attempted break, every contract bounty, every academic deanonymisation paper — on the record."
      />

      <Card style={{ padding: 22 }}>
        <div className="kicker">Bounties · what was offered, what was delivered</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginTop: 14 }}>
          {BOUNTIES.map((b) => (
            <div key={b.y} style={{ padding: 14, border: "1px solid var(--rule)", borderRadius: 2 }}>
              <div className="kicker" style={{ color: "var(--r-50)" }}>{b.y}</div>
              <div className="mono" style={{ fontSize: 13, color: "var(--ink-100)", marginTop: 4 }}>{b.co}</div>
              <div className="mono acc" style={{ fontSize: 12, marginTop: 2 }}>Offered: {b.amt}</div>
              <p className="mono dim" style={{ margin: "8px 0 0", fontSize: 11, lineHeight: 1.6 }}>{b.out}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ padding: 22 }}>
        <div className="kicker">Academic deanonymisation attempts · 2017–2024</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
          {PAPERS.map((p) => (
            <div key={p.title} style={{ display: "grid", gridTemplateColumns: "12px 1fr 120px", gap: 12, padding: "10px 0", borderTop: "1px dashed var(--ink-10)", alignItems: "flex-start" }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: p.severity, boxShadow: `0 0 4px ${p.severity}`, marginTop: 6 }} />
              <div>
                <div className="mono" style={{ fontSize: 12.5, color: "var(--ink-100)" }}>{p.title}</div>
                <p className="mono dim" style={{ margin: "4px 0 0", fontSize: 11, lineHeight: 1.6 }}>{p.note}</p>
              </div>
              <span style={{ fontSize: 10, color: p.severity, textTransform: "uppercase", letterSpacing: "0.14em", textAlign: "right" }}>{p.status}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ padding: 22 }}>
        <div className="kicker">Operational attacks · sybils, KYC pressure, infrastructure</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
          {VECTORS.map((p) => (
            <div key={p.t} style={{ padding: 14, borderLeft: "2px solid var(--y-50)" }}>
              <div className="mono" style={{ fontSize: 12.5, color: "var(--ink-100)" }}>{p.t}</div>
              <p className="mono dim" style={{ margin: "6px 0 0", fontSize: 11.5, lineHeight: 1.7 }}>{p.d}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ padding: 22 }}>
        <div className="kicker">The take-away</div>
        <p className="serif" style={{ margin: "12px 0", fontSize: 22, fontWeight: 400, color: "var(--ink-100)", lineHeight: 1.5 }}>
          After eleven years, six government bounties, and a dozen serious academic papers,
          <em style={{ color: "var(--g-50)", fontStyle: "normal" }}> no party has publicly demonstrated </em>
          a method to deanonymise a current-protocol Monero transaction at scale.
        </p>
        <p className="mono dim" style={{ fontSize: 12, lineHeight: 1.75 }}>
          Operational attacks — phishing, timing correlation, KYC at the on-ramp — remain effective against careless users.
          The protocol itself has held. FCMP++ will close most remaining theoretical attack surface in Q3 2026.
        </p>
      </Card>
    </div>
  );
}
