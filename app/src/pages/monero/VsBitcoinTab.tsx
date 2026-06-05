/**
 * pages/monero/VsBitcoinTab.tsx — XMR vs BTC side-by-side comparison table.
 * Ported verbatim from five01 monero-pages.jsx → MoneroComparison.
 */

import * as React from "react";
import { PageHeader } from "@/layout/AppShell";
import { Card } from "@/design/primitives";
import type { MoneroTabProps } from "./tabs";

const ROWS = [
  { k: "Genesis date",         xmr: "April 18, 2014",     btc: "January 3, 2009",    note: "Bitcoin is 5 years older." },
  { k: "Premine",              xmr: "0 XMR",              btc: "0 BTC",              note: "Both fair launches. Rare." },
  { k: "Founder reward",       xmr: "None",                btc: "None",                note: "Satoshi mined alongside everyone." },
  { k: "Foundation / VCs",     xmr: "None · CCS only",     btc: "Multiple foundations", note: "Monero has no central org." },
  { k: "Block time",           xmr: "2 min",               btc: "10 min",              note: "Monero confirms 5× faster." },
  { k: "Block size",           xmr: "Dynamic",             btc: "1 MB (4 MB witness)", note: "XMR scales with median tx demand." },
  { k: "Hardfork cadence",     xmr: "~12–18 months",       btc: "Years; soft forks only", note: "XMR ships protocol upgrades aggressively." },
  { k: "Privacy",              xmr: "Mandatory · all txs", btc: "Optional · CoinJoin", note: "Different defaults." },
  { k: "Fungibility",          xmr: "Cryptographic",       btc: "Tainted by history",  note: "No coin can be blacklisted on XMR." },
  { k: "Supply",               xmr: "Asymptotic · 22M+",   btc: "Hard cap · 21M",      note: "Different monetary theses." },
  { k: "Emission post-2140",   xmr: "0.6 XMR / block · forever", btc: "0 BTC / block (predicted)", note: "Tail emission vs hard cap." },
  { k: "Mining algo",          xmr: "RandomX · CPU-friendly", btc: "SHA-256 · ASIC-only", note: "XMR resists mining centralisation." },
  { k: "P2Pool · decentralised mining", xmr: "Yes · 7% network share", btc: "No equivalent (Stratum V2 partial)", note: "XMR has a true permissionless pool." },
  { k: "Transaction fees",     xmr: "Sub-cent · stable",   btc: "$0.40 – $40+ · volatile", note: "Predictable on XMR." },
  { k: "On-chain throughput",  xmr: "~2 tps avg · dynamic", btc: "~4–7 tps",            note: "Comparable layer-1." },
  { k: "Lightning / L2",        xmr: "No · monolithic privacy", btc: "Yes · Lightning",    note: "Different design choices." },
  { k: "Anonymity set",        xmr: "16 → 150M+ (FCMP++)", btc: "1 (unless mixed)",    note: "Order-of-magnitude difference." },
  { k: "Wallet sync (cold)",   xmr: "~15–60 min",          btc: "Hours (full node)",    note: "XMR uses view-tags + LWS." },
  { k: "Exchange listings",    xmr: "Thinning (regulatory)", btc: "Universal",          note: "Different surface area." },
  { k: "DEX liquidity",        xmr: "Growing · Haveno/Basic", btc: "Growing · Bisq/Lightning", note: "Both moving same direction." },
  { k: "Censorship resistance · network", xmr: "Tor/I2P 38% peer share", btc: "Tor 6% peer share", note: "XMR has stronger network privacy." },
] as const;

export function VsBitcoinTab(_props: MoneroTabProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <PageHeader
        kicker="XMR · BTC · side-by-side"
        title='Two answers to the <em style="color:var(--p-50);text-shadow:var(--glow-p);font-style:normal">same question</em>.'
        sub="Bitcoin chose transparency and scarcity. Monero chose privacy and predictability. Both can be right. Both have tradeoffs."
      />
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 1fr 1fr", gap: 0 }}>
          {["Property", "XMR", "BTC", "Note"].map((h) => (
            <div key={h} className="kicker" style={{ padding: "12px 16px", background: "rgba(255,122,26,0.04)", borderBottom: "1px solid var(--rule)" }}>{h}</div>
          ))}
          {ROWS.map((r, i) => (
            <React.Fragment key={r.k}>
              <div className="mono" style={{ padding: "10px 16px", borderBottom: "1px solid var(--rule)", background: i % 2 ? "rgba(255,255,255,0.01)" : "transparent", fontSize: 11.5, color: "var(--ink-80)" }}>{r.k}</div>
              <div className="mono acc" style={{ padding: "10px 16px", borderBottom: "1px solid var(--rule)", background: i % 2 ? "rgba(255,255,255,0.01)" : "transparent", fontSize: 11.5 }}>{r.xmr}</div>
              <div className="mono" style={{ padding: "10px 16px", borderBottom: "1px solid var(--rule)", background: i % 2 ? "rgba(255,255,255,0.01)" : "transparent", color: "var(--c-50)", fontSize: 11.5 }}>{r.btc}</div>
              <div className="mono dim" style={{ padding: "10px 16px", borderBottom: "1px solid var(--rule)", background: i % 2 ? "rgba(255,255,255,0.01)" : "transparent", fontSize: 11, lineHeight: 1.55 }}>{r.note}</div>
            </React.Fragment>
          ))}
        </div>
      </Card>
    </div>
  );
}
