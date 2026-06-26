/**
 * pages/_education/EduSimulators.tsx — /education/simulators
 *
 * Cards for every protocol simulator. READS the pure-data meta arrays from
 * views/protocol-meta.ts (split into primitives + metaphors) READ-ONLY and
 * links each card to /simulate?p=<id> — it never imports the simulator
 * components themselves, so @/protocols/* stays out of this chunk. Tone color
 * per p.tone (priv = purple, else orange).
 */

import * as React from "react";
import { PageHeader } from "@/layout/AppShell";
import { Card } from "@/design/primitives";
import { PROTOCOL_PRIMITIVES_META, PROTOCOL_METAPHORS_META, type ProtocolMetaBase } from "@/views/protocol-meta";

export interface EduSimulatorsProps {
  navigate: (to: string) => void;
}

const GROUPS: { group: string; items: ProtocolMetaBase[] }[] = [
  { group: "Privacy primitives", items: PROTOCOL_PRIMITIVES_META },
  { group: "Metaphors & economics", items: PROTOCOL_METAPHORS_META },
];

export function EduSimulators({ navigate }: EduSimulatorsProps) {
  const total = PROTOCOL_PRIMITIVES_META.length + PROTOCOL_METAPHORS_META.length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      <div className="edu-head">
        <PageHeader
          kicker={"Interactive · " + total + " protocol simulators"}
          title='See the cryptography <em style="color:var(--p-50);text-shadow:var(--glow-p);font-style:normal">move</em>.'
          sub="Every privacy primitive in the Monero stack, rendered as a metaphor you can run. Open any one full-bleed in the simulator."
        />
      </div>
      <div className="edu-meta-tag">
        <span className="dot" />
        <span>Metadata · for educational purposes only</span>
        <span className="sub">illustrative protocol models — not live network data</span>
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
