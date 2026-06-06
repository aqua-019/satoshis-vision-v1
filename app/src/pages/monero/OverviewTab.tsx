/**
 * pages/monero/OverviewTab.tsx — Monero overview: three pillars + "where to next".
 * Ported verbatim from five01 monero-pages.jsx → MoneroOverview.
 */

import * as React from "react";
import { PageHeader } from "@/layout/AppShell";
import { Card } from "@/design/primitives";
import type { MoneroTabProps } from "./tabs";

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
    b: 'The tail emission keeps miners paid into deep time. There is no "security budget cliff" — the hearth stays lit.',
  },
] as const;

export function OverviewTab({ navigate }: MoneroTabProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <PageHeader
        kicker="Origin · philosophy · why now"
        title='A coin that <em style="color:var(--tk-accent);text-shadow:var(--glow-1);font-style:normal">refuses</em> to know who you are.'
        sub="Eleven years old. No premine, no founder reward, no on-chain identity. Built by a rotating cast of cypherpunks."
      />
      <section style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {PILLARS.map((p, i) => (
          <Card key={i} style={{ padding: 22 }}>
            <div className="kicker" style={{ color: p.c }}>{p.k}</div>
            <div className="serif" style={{ fontSize: 28, fontWeight: 500, color: "var(--ink-100)", margin: "8px 0" }}>{p.t}</div>
            <p className="mono dim" style={{ margin: 0, fontSize: 12, lineHeight: 1.65 }}>{p.b}</p>
          </Card>
        ))}
      </section>
      <Card style={{ padding: 24, display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 24 }}>
        <div>
          <div className="kicker">Where to next?</div>
          <div className="serif" style={{ fontSize: 22, color: "var(--ink-100)", marginTop: 6 }}>
            Walk through every primitive that makes the privacy work, or dig into how Monero has survived a decade of pressure.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={() => navigate("/monero/tech")}
            className="proto-btn"
            style={{ borderColor: "var(--p-50)", color: "var(--p-50)", boxShadow: "var(--glow-p)" }}
          >
            Tech →
          </button>
          <button type="button" onClick={() => navigate("/monero/legality")} className="proto-btn">
            Legality →
          </button>
        </div>
      </Card>
    </div>
  );
}
