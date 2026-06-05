/**
 * pages/EducationPage.tsx — 6 protocol cards + roadmap teaser.
 */

import * as React from "react";
import { useNavigate } from "react-router-dom";
import { AppShell, PageHeader } from "@/layout/AppShell";
import { Card, Crumbs } from "@/design/primitives";
import { PROTOCOL_VIEWS } from "@/views";

export function EducationPage() {
  const navigate = useNavigate();
  return (
    <AppShell hideRail bg={{ intensity: "calm" }}>
      <div style={{ padding: "32px 48px 48px", display: "flex", flexDirection: "column", gap: 28, maxWidth: 1600, margin: "0 auto", width: "100%" }}>
        <Crumbs items={["xmr.irish", "v5.0", "education"]} />
        <PageHeader
          kicker="Six protocols · six metaphors"
          title='The privacy stack, <em style="color:var(--p-50);text-shadow:var(--glow-p);font-style:normal">explained visually</em>.'
          sub="Each simulator is interactive. Click into one — the math comes second, the metaphor comes first."
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {PROTOCOL_VIEWS.map((p) => (
            <Card key={p.id}
              onClick={() => navigate("/simulate?p=" + p.id)}
              style={{ padding: 22, minHeight: 220, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div className="kicker" style={{ color: p.tone === "priv" ? "var(--p-50)" : "var(--tk-accent)" }}>{p.kicker}</div>
                <h3 className="serif" style={{ margin: "10px 0 8px", fontSize: 26, fontWeight: 500, color: "var(--ink-100)" }}>{p.label}</h3>
                <p className="mono dim" style={{ margin: 0, fontSize: 12, lineHeight: 1.55 }}>{p.sub}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 18 }}>
                <span className={"proto-badge " + (p.tone === "priv" ? "priv" : "acc")}>
                  {p.tone === "priv" ? "PRIVACY" : "EFFICIENCY"}
                </span>
                <span className="mono" style={{ fontSize: 12, color: "var(--tk-accent)" }}>Open simulator →</span>
              </div>
            </Card>
          ))}
        </div>

        <Card style={{ padding: 22 }}>
          <div className="kicker">Coming next · from METAPHORS.md</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginTop: 10 }}>
            {[
              ["The eternal hearth", "Tail emission"],
              ["The metronome", "Block target"],
              ["Grain silo & faucet", "Monetary policy"],
              ["Handshake over a chasm", "Atomic swaps"],
              ["The keyholder split", "View vs spend key"],
              ["Post-office mailboxes", "Sub-addresses"],
              ["Pneumatic tubes", "Tor + I2P"],
              ["Grain of sand", "Atomic units"],
            ].map(([m, c]) => (
              <div key={m} style={{ borderLeft: "2px solid var(--ink-10)", padding: "6px 10px" }}>
                <div className="serif" style={{ fontSize: 15, color: "var(--ink-100)" }}>{m}</div>
                <div className="mono dim" style={{ fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 2 }}>{c}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
