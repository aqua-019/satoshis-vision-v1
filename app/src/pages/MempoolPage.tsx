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
import { Crumbs, DataLegend } from "@/design/primitives";
import { useMoneroLive } from "@/data/DataContext";
import { MEMPOOL_VIEWS } from "@/views";
import { MempoolHeartbeat } from "@/mempool/mempool-shared";
import { useDragPan } from "@/mempool/useDragPan";
import { FitView } from "@/mempool/FitView";

export function MempoolPage() {
  const data = useMoneroLive();
  const [params, setParams] = useSearchParams();
  const active = MEMPOOL_VIEWS.find((v) => v.id === params.get("v"))?.id ?? "classic";
  const meta = MEMPOOL_VIEWS.find((v) => v.id === active)!;
  const View = meta.Component;

  // Deep-link: /mempool?v=classic&block=<height> opens that block's detail in
  // the active view. clearFocus drops ?block (keeping ?v) when the panel closes.
  const blockRaw = params.get("block");
  const focusBlock = blockRaw != null && /^\d{1,8}$/.test(blockRaw) ? parseInt(blockRaw, 10) : null;
  const clearFocus = React.useCallback(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("block");
        return next;
      },
      { replace: true },
    );
  }, [setParams]);

  // Drag-to-pan the canvas (P4); scrollbar is hidden in CSS, wheel still scrolls.
  const panRef = useDragPan<HTMLDivElement>();

  // Fit-to-view (P1): the wide canvas views load scaled to the canvas width. The
  // "fit / 100%" toggle lets power users jump to actual size and pan; default = fit.
  // Reset to fit whenever the active view changes so switching never strands you at
  // 100% on a huge view.
  const [zoom, setZoom] = React.useState<"fit" | "100">("fit");
  React.useEffect(() => { setZoom("fit"); }, [active]);

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
        {/* breadcrumb — page chrome; heartbeat surfaces per-second feed liveness */}
        <div style={{ padding: "10px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          {/* breadcrumb + fit/100% zoom toggle on the LEFT (the fixed .mp-switcher
              occupies the top-right, so the toggle must not live in the right group). */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <Crumbs items={["xmr.irish", "mempool", "explorer", meta.label]} />
            {meta.fit ? (
              <div className="mp-zoom" role="group" aria-label="Zoom">
                {(["fit", "100"] as const).map((z) => (
                  <button
                    key={z}
                    type="button"
                    aria-pressed={zoom === z}
                    className={"mp-zoom__btn" + (zoom === z ? " is-on" : "")}
                    onClick={() => setZoom(z)}
                  >
                    {z === "fit" ? "Fit" : "100%"}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <MempoolHeartbeat data={data} />
        </div>

        {/* source vocabulary legend — mempool mixes live node subjects with
            session-computed positions/confirmations. */}
        <div style={{ padding: "2px 20px 0" }}>
          <DataLegend sources={["node", "session"]} />
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

        {/* active view fills the remaining height and scrolls internally. Fit-enabled
            views (reactor/bridge/sediment/constellation) load scaled to the canvas
            width via <FitView>; classic/terminal keep their natural layout. */}
        <div className="mp-canvas-scroll" ref={panRef}>
          {meta.fit ? (
            <FitView scrollRef={panRef} mode={zoom}>
              <View data={data} bg={{ intensity: "calm" }} focusBlock={focusBlock} onClearFocus={clearFocus} />
            </FitView>
          ) : (
            <div className="mp-view">
              <View data={data} bg={{ intensity: "calm" }} focusBlock={focusBlock} onClearFocus={clearFocus} />
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
