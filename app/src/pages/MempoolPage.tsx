/**
 * pages/MempoolPage.tsx — flagship surface with 5 switchable views.
 *
 * The PAGE owns the chrome: <AppShell> renders NavTop + the left NetRail
 * telemetry rail + Footer, and we render the breadcrumb + a floating view
 * switcher over the content. Each view renders ONLY its content (a single
 * scroll container), so no ancestor overflow clips the view's overlays.
 *
 * `fluid` makes AppShell's <main> full-bleed (padding:0, non-scrolling) while
 * keeping the NetRail; the active view supplies its own scroll region.
 */

import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { AppShell } from "@/layout/AppShell";
import { Crumbs } from "@/design/primitives";
import { useMoneroLive } from "@/data/DataContext";
import { MEMPOOL_VIEWS } from "@/views";

export function MempoolPage() {
  const data = useMoneroLive();
  const [params, setParams] = useSearchParams();
  const active = MEMPOOL_VIEWS.find((v) => v.id === params.get("v"))?.id ?? "reactor";
  const meta = MEMPOOL_VIEWS.find((v) => v.id === active)!;
  const View = meta.Component;

  return (
    <AppShell fluid bg={{ intensity: "calm" }}>
      <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
        {/* breadcrumb — page chrome */}
        <div style={{ padding: "10px 20px 0" }}>
          <Crumbs items={["xmr.irish", "mempool", "explorer", meta.label]} />
        </div>

        {/* active view fills the remaining height and scrolls internally */}
        <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
          <View data={data} bg={{ intensity: "calm" }} />
        </div>

        {/* Floating view switcher — fixed, top-right */}
        <div style={{
          position: "fixed", top: 60, right: 16, zIndex: 50,
          padding: 10, background: "rgba(5,5,5,0.86)", backdropFilter: "blur(8px)",
          border: "1px solid var(--rule)", borderRadius: 2,
          display: "flex", flexDirection: "column", gap: 6, maxWidth: 220,
        }}>
          <div className="kicker" style={{ marginBottom: 2 }}>Mempool view · 6 views</div>
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
    </AppShell>
  );
}
