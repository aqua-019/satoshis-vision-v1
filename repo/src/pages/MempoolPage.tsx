/**
 * pages/MempoolPage.tsx — flagship surface with 5 switchable views.
 *
 * The view itself renders its own NavTop/NetRail/Footer chrome — we render
 * it full-bleed and float the switcher over the top-right corner.
 */

import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { useMoneroLive } from "@/data/DataContext";
import { MEMPOOL_VIEWS } from "@/views";

export function MempoolPage() {
  const data = useMoneroLive();
  const [params, setParams] = useSearchParams();
  const active = MEMPOOL_VIEWS.find((v) => v.id === params.get("v"))?.id ?? "reactor";
  const meta = MEMPOOL_VIEWS.find((v) => v.id === active)!;
  const View = meta.Component;

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <View data={data} />

      {/* Floating switcher */}
      <div style={{
        position: "fixed", top: 60, right: 16, zIndex: 50,
        padding: 10, background: "rgba(5,5,5,0.86)", backdropFilter: "blur(8px)",
        border: "1px solid var(--rule)", borderRadius: 2,
        display: "flex", flexDirection: "column", gap: 6, maxWidth: 220,
      }}>
        <div className="kicker" style={{ marginBottom: 2 }}>Mempool view · 5 directions</div>
        {MEMPOOL_VIEWS.map((it) => {
          const on = it.id === active;
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => setParams({ v: it.id })}
              style={{
                appearance: "none", cursor: "pointer",
                background: on ? "rgba(255,122,26,0.08)" : "transparent",
                border: "1px solid " + (on ? "var(--tk-accent)" : "var(--ink-10)"),
                color: on ? "var(--tk-accent)" : "var(--ink-80)",
                padding: "6px 10px",
                fontFamily: "var(--f-mono)", fontSize: 10.5,
                letterSpacing: "0.1em", textTransform: "uppercase",
                boxShadow: on ? "var(--glow-1)" : "none",
                display: "flex", flexDirection: "column", gap: 1, textAlign: "left",
              }}
            >
              <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {it.star ? <span style={{ color: "var(--tk-accent)" }}>★</span> : null}
                {it.label}
              </span>
              <span style={{ fontSize: 9, color: "var(--ink-40)", letterSpacing: "0.04em", textTransform: "none" }}>{it.sub}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
