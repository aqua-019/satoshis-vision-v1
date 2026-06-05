/**
 * pages/monero/FutureTab.tsx — Monero future roadmap: feature cards, hardfork schedule, research frontier.
 * Ported verbatim from five01 monero-pages.jsx → MoneroFuture.
 */

import * as React from "react";
import { PageHeader } from "@/layout/AppShell";
import { Card } from "@/design/primitives";
import type { MoneroTabProps } from "./tabs";

const FEATURES = [
  {
    tag: "FCMP++", sub: "Full-chain membership proofs",
    status: "BETA · stressnet live", statusColor: "var(--y-50)", eta: "Q3 2026 (tentative)", c: "var(--p-50)",
    head: "The anonymity set goes from 16 → 150M+.",
    body: "FCMP++ replaces the 16-decoy ring signature with a proof of membership over the entire UTXO set. A spender proves their input is somewhere in the cloud of ~150 million outputs — without specifying where. Chain analysis becomes computationally intractable. Currently in beta on a public stressnet; mainnet activation depends on audit completion.",
    metrics: [["Set size", "150M+"], ["Today", "ring-16"], ["Multiplier", "≈10M×"], ["Proof size", "~3 KB"]] as const,
  },
  {
    tag: "Carrot", sub: "Audit-class view keys",
    status: "DESIGN · spec draft", statusColor: "var(--c-50)", eta: "2027", c: "var(--c-50)",
    head: "Audit-friendly view keys without compromising spend privacy.",
    body: "Carrot is a new transaction format that lets wallet operators give a strictly-bounded view key to an auditor — one that reveals incoming payments but not outgoing spends or balances. Designed for institutions that need to demonstrate solvency without revealing their full transaction graph. Pairs naturally with FCMP++.",
    metrics: [["Replaces", "RingCT v6"], ["View cap", "Incoming"], ["Class", "Selective"], ["Compat", "Wallet-side"]] as const,
  },
  {
    tag: "Seraphis", sub: "Next-gen transaction protocol",
    status: "BETA · audit in progress", statusColor: "var(--y-50)", eta: "2027 (post-FCMP++)", c: "var(--tk-accent)",
    head: "A clean-room rewrite of Monero's transaction format.",
    body: "Seraphis modernizes how Monero builds, signs, and verifies transactions. Built to slot in alongside FCMP++ — together they're often referred to as 'Monero 2.0'. Smaller signatures, faster verification, simpler wallet logic. Backwards-compatible migration path.",
    metrics: [["Sig size", "−30%"], ["Verify", "+40%"], ["Wallet", "Simpler"], ["Migration", "Soft fork"]] as const,
  },
  {
    tag: "Jamtis", sub: "Human-readable addresses",
    status: "BETA · paired with Seraphis", statusColor: "var(--y-50)", eta: "With Seraphis", c: "var(--g-50)",
    head: "Addresses you can read aloud.",
    body: "Today's Monero addresses are 95 base58 characters — unreadable, hard to verify in person, easy to typo. Jamtis introduces a structured format with built-in checksums, sub-address indices encoded inline, and an optional human-readable encoding. Same privacy guarantees, dramatically better UX.",
    metrics: [["Length", "75 ch"], ["Checksum", "Built-in"], ["Sub-addr", "Native"], ["Recovery", "Mnemonic"]] as const,
  },
  {
    tag: "Cuprate", sub: "Rust-language full node",
    status: "ALPHA · sync working", statusColor: "var(--tk-accent)", eta: "2026–2027", c: "var(--y-50)",
    head: "An independent, memory-safe Monero implementation.",
    body: "Cuprate is a parallel Rust implementation of the monerod daemon. Modern toolchain, memory-safe, sharply reduced sync times for new nodes. Critical for network resilience: a second client means a bug or backdoor in one can't take down the network. Active development, alpha builds public.",
    metrics: [["Language", "Rust"], ["Sync", "+40%"], ["Clients", "1 → 2"], ["Resilience", "Multi"]] as const,
  },
  {
    tag: "Atomic swaps", sub: "Haveno · BasicSwap · ETA",
    status: "LIVE · scaling", statusColor: "var(--g-50)", eta: "Continuous", c: "var(--ink-100)",
    head: "Replacing CEX rails with trustless XMR↔BTC↔LTC swaps.",
    body: "Haveno (a fork of Bisq), BasicSwap, and Haveno-Reto are scaling P2P atomic-swap volumes by ~30%+ per quarter through 2025–2026. As MiCA delisting accelerates, these become the primary on-ramp. Cross-chain, custody-free, no KYC.",
    metrics: [["Q3 25 wk", "$2.98M"], ["Growth", "+34% QoQ"], ["KYC", "None"], ["Custody", "Trustless"]] as const,
  },
] as const;

const HARDFORKS = [
  { d: "v15 · 2022-08", s: "shipped", t: "View tags · BP+ · CLSAG", b: "Wallet sync sped up 30–40%. Verification cost reduced. View tag adds 1 byte per output, no privacy loss." },
  { d: "v16 · 2022-08", s: "live", t: "Ring size 16 mandatory", b: "Permanent minimum ring size. Every spend has 15 decoys. Backstop until FCMP++." },
  { d: "v17 · 2026 Q3", s: "in audit", t: "FCMP++ activation", b: "Anonymity set goes from 16 to 150M+. The most material protocol change since RingCT." },
  { d: "v18 · 2027", s: "design", t: "Seraphis + Jamtis", b: "New transaction format + human-readable addresses. Often referred to as 'Monero 2.0'." },
  { d: "v19 · 2027–28", s: "planned", t: "Carrot", b: "Audit-class view keys for institutional disclosure without spending-side leakage." },
  { d: "v20 · 2028+", s: "speculative", t: "Cuprate v1 + post-quantum prep", b: "Second mainline client. Post-quantum cryptographic primitives enter design phase." },
] as const;

const RESEARCH = [
  { h: "Post-quantum signatures", b: "Migration path from Ed25519 → quantum-resistant primitives. Active research; not currently a near-term threat but a multi-year preparation." },
  { h: "Multi-asset confidential", b: "Extending RingCT-style hiding to multiple asset types on the same chain. Speculative; no commitment to ship." },
  { h: "Privacy-preserving L2", b: "An L2 with snark-rollup compression that preserves Monero's privacy guarantees on commit. Early-stage." },
  { h: "Encrypted node discovery", b: "Beyond Tor/I2P — gossiped-key node directories that can survive deeper network censorship." },
  { h: "Stateless light wallets", b: "Verify your balance without scanning the full chain. View-tag++ proposals." },
  { h: "Atomic-swap UX standard", b: "Universal cross-chain interface so wallets can swap XMR↔* without per-chain integration work." },
] as const;

export function FutureTab(_props: MoneroTabProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <PageHeader
        kicker="Roadmap · 2026 → 2028 · in flight"
        title='What <em style="color:var(--p-50);font-style:normal">comes next</em>.'
        sub="Six major protocol upgrades are in audit, beta, or active development. Each one re-prices Monero structurally — anonymity set, sync speed, address ergonomics, transaction format, node infrastructure."
      />

      <section style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
        {FEATURES.map((u) => (
          <Card key={u.tag} style={{ padding: 22 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
              <div>
                <div className="kicker" style={{ color: u.c }}>{u.sub}</div>
                <div className="serif" style={{ fontSize: 26, fontWeight: 400, color: u.c, marginTop: 4 }}>{u.tag}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span className="mono" style={{ display: "inline-block", padding: "3px 9px", border: `1px solid ${u.statusColor}`, color: u.statusColor, borderRadius: 2, fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase" }}>{u.status}</span>
                <div className="mono dim" style={{ fontSize: 10.5, marginTop: 6 }}>{u.eta}</div>
              </div>
            </div>
            <p className="serif" style={{ margin: "10px 0", fontSize: 17, lineHeight: 1.4, color: "var(--ink-100)", fontWeight: 400 }}>{u.head}</p>
            <p className="mono dim" style={{ margin: "0 0 14px", fontSize: 11.5, lineHeight: 1.7 }}>{u.body}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, paddingTop: 12, borderTop: "1px dashed var(--ink-10)" }}>
              {u.metrics.map(([k, v]: readonly [string, string]) => (
                <div key={k}>
                  <div className="kicker" style={{ marginBottom: 4 }}>{k}</div>
                  <div className="mono" style={{ fontSize: 12, color: "var(--ink-100)" }}>{v}</div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </section>

      <Card style={{ padding: 26 }}>
        <div className="kicker">Hardfork schedule</div>
        <h3 className="serif" style={{ margin: "10px 0 14px", fontSize: 24, fontWeight: 400, color: "var(--ink-100)" }}>
          The protocol upgrade cadence is <em style={{ color: "var(--tk-accent)", fontStyle: "normal" }}>fast and disciplined</em>.
        </h3>
        <div style={{ position: "relative", paddingLeft: 18, borderLeft: "1px dashed var(--ink-20)", display: "flex", flexDirection: "column", gap: 16 }}>
          {HARDFORKS.map((e, i) => {
            const c = e.s === "shipped" || e.s === "live" ? "var(--g-50)"
                    : e.s === "in audit" ? "var(--y-50)"
                    : e.s === "design"    ? "var(--c-50)"
                    : e.s === "planned"   ? "var(--p-50)"
                    : "var(--ink-40)";
            return (
              <div key={i} style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: -25, top: 6, width: 10, height: 10, borderRadius: 5, border: `1px solid ${c}`, background: "var(--bg-0)", boxShadow: `0 0 6px ${c}` }} />
                <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
                  <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", color: "var(--ink-60)" }}>{e.d}</div>
                  <span className="mono" style={{ fontSize: 9.5, letterSpacing: "0.12em", textTransform: "uppercase", color: c, padding: "2px 8px", border: `1px solid ${c}`, borderRadius: 2 }}>{e.s}</span>
                </div>
                <div className="serif" style={{ fontSize: 18, color: "var(--ink-100)", marginTop: 4, fontWeight: 400 }}>{e.t}</div>
                <p className="mono dim" style={{ margin: "4px 0 0", fontSize: 11.5, lineHeight: 1.6, maxWidth: "78ch" }}>{e.b}</p>
              </div>
            );
          })}
        </div>
      </Card>

      <Card style={{ padding: 22 }}>
        <div className="kicker">Research frontier · further out</div>
        <p className="mono dim" style={{ fontSize: 12, lineHeight: 1.7, margin: "10px 0 16px" }}>
          Beyond the scheduled hardforks, the Monero Research Lab is actively exploring directions that may or may not ship — but inform the next decade of design.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {RESEARCH.map((r) => (
            <div key={r.h} style={{ padding: 12, borderLeft: "2px solid var(--p-50)" }}>
              <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-100)" }}>{r.h}</div>
              <p className="mono dim" style={{ margin: "6px 0 0", fontSize: 10.5, lineHeight: 1.6 }}>{r.b}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
