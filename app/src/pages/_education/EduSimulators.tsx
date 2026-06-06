/**
 * pages/_education/EduSimulators.tsx — /education/simulators
 *
 * Cards for every protocol simulator in the registry. READS the PROTOCOL_VIEWS
 * registry (split into primitives + metaphors) READ-ONLY and links each card to
 * /simulate?p=<id>. Tone color per p.tone (priv = purple, else orange).
 */

import * as React from "react";
import { PageHeader } from "@/layout/AppShell";
import { Card } from "@/design/primitives";
import { PROTOCOL_PRIMITIVES, PROTOCOL_METAPHORS, type ProtocolMeta } from "@/views";

export interface EduSimulatorsProps {
  navigate: (to: string) => void;
}

const GROUPS: { group: string; items: ProtocolMeta[] }[] = [
  { group: "Privacy primitives", items: PROTOCOL_PRIMITIVES },
  { group: "Metaphors & economics", items: PROTOCOL_METAPHORS },
];

export function EduSimulators({ navigate }: EduSimulatorsProps) {
  const total = PROTOCOL_PRIMITIVES.length + PROTOCOL_METAPHORS.length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      <div className="edu-head">
        <PageHeader
          kicker={"Interactive · " + total + " protocol simulators"}
          title='See the cryptography <em style="color:var(--p-50);text-shadow:var(--glow-p);font-style:normal">move</em>.'
          sub="Every privacy primitive in the Monero stack, rendered as a metaphor you can run. Open any one full-bleed in the simulator."
        />
      </div>
      {GROUPS.map(({ group, items }) => (
        <section key={group} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="kicker">{group}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {items.map((p) => (
              <Card key={p.id} onClick={() => navigate("/simulate?p=" + p.id)} style={{ padding: 18, cursor: "pointer" }}>
                <div className="kicker" style={{ color: p.tone === "priv" ? "var(--p-50)" : "var(--tk-accent)" }}>{p.kicker}</div>
                <div className="serif" style={{ fontSize: 22, fontWeight: 500, color: "var(--ink-100)", margin: "8px 0 6px" }}>{p.label}</div>
                <p className="mono dim" style={{ margin: 0, fontSize: 12, lineHeight: 1.6 }}>{p.sub}</p>
                <div className="mono acc" style={{ fontSize: 11, marginTop: 12, letterSpacing: "0.08em" }}>Run simulator →</div>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
