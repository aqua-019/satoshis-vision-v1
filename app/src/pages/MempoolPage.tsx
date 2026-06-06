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
  const active = MEMPOOL_VIEWS.find((v) => v.id === params.get("v"))?.id ?? "classic";
  const meta = MEMPOOL_VIEWS.find((v) => v.id === active)!;
  const View = meta.Component;

  // Mobile: the switcher is a collapsible dropdown. On desktop CSS keeps the
  // list always shown (the trigger is hidden), so this state is inert there.
  const [open, setOpen] = React.useState(false);
  const switcherRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <AppShell fluid bg={{ intensity: "calm" }}>
      <div className="mp-shell">
        {/* breadcrumb — page chrome */}
        <div style={{ padding: "10px 20px 0" }}>
          <Crumbs items={["xmr.irish", "mempool", "explorer", meta.label]} />
        </div>

        {/* View switcher — fixed top-right on desktop; inline dropdown on mobile.
            Rendered before the view so position:fixed (desktop) is out of flow
            and position:static (mobile) lands it inline under the breadcrumb. */}
        <div className="mp-switcher" ref={switcherRef}>
          <div className="kicker mp-switcher__kicker" style={{ marginBottom: 2 }}>Mempool view · 6 views</div>
          <button
            type="button"
            className="mp-switcher__trigger"
            aria-expanded={open}
            aria-controls="mp-view-list"
            onClick={() => setOpen((o) => !o)}
          >
            <span>View · {meta.label}</span>
            <span aria-hidden="true">{open ? "▴" : "▾"}</span>
          </button>
          <div id="mp-view-list" className={"mp-switcher__list" + (open ? " is-open" : "")}>
            {MEMPOOL_VIEWS.map((it) => {
              const on = it.id === active;
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => { setParams({ v: it.id }); setOpen(false); }}
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

        {/* active view fills the remaining height and scrolls internally */}
        <div className="mp-view">
          <View data={data} bg={{ intensity: "calm" }} />
        </div>
      </div>
    </AppShell>
  );
}
