/**
 * pages/SimulatePage.tsx — protocol simulator with 6 switchable surfaces.
 *
 * Protocol views render ProtoArtboard (header+stage+panel) only — no full
 * page chrome — so we wrap in AppShell with `fluid` + `hideRail`.
 */

import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { useMoneroLive } from "@/data/DataContext";
import { PROTOCOL_VIEWS } from "@/views";
import { AppShell } from "@/layout/AppShell";
import { Crumbs } from "@/design/primitives";

export function SimulatePage() {
  const data = useMoneroLive();
  const [params, setParams] = useSearchParams();
  const active = PROTOCOL_VIEWS.find((p) => p.id === params.get("p"))?.id ?? "decoy";
  const meta = PROTOCOL_VIEWS.find((p) => p.id === active)!;
  const View = meta.Component;

  return (
    <AppShell hideRail fluid bg={{ intensity: "calm" }}>
      <div style={{ height: "100%", display: "grid", gridTemplateRows: "auto 1fr" }}>
        <div style={{ padding: "12px 20px", display: "flex", gap: 18, alignItems: "center", borderBottom: "1px solid var(--rule)", flexWrap: "wrap" }}>
          <Crumbs items={["xmr.irish", "v5.0", "simulate", meta.label]} />
          <div style={{ flex: 1, minWidth: 20 }} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {PROTOCOL_VIEWS.map((p) => {
              const on = p.id === active;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setParams({ p: p.id })}
                  style={{
                    appearance: "none", cursor: "pointer", background: "transparent",
                    border: "1px solid " + (on ? "var(--tk-accent)" : "var(--ink-10)"),
                    color: on ? "var(--tk-accent)" : "var(--ink-60)",
                    padding: "6px 10px",
                    fontFamily: "var(--f-mono)", fontSize: 10.5,
                    letterSpacing: "0.1em", textTransform: "uppercase",
                    boxShadow: on ? "var(--glow-1)" : "none",
                    display: "flex", flexDirection: "column", gap: 1, textAlign: "left",
                  }}
                >
                  <span>{p.label}</span>
                  <span style={{ fontSize: 9, color: "var(--ink-40)", letterSpacing: "0.04em", textTransform: "none" }}>{p.kicker}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ position: "relative", overflow: "hidden" }}>
          <View data={data} />
        </div>
      </div>
    </AppShell>
  );
}
