// /learn/timeline · privacy-evolution timeline, filterable by category.
// Content editorial (49 events across 5 eras) — verify before publishing.
//
// THE CONTENT MOVED, THE RENDERING DID NOT. `TL_CAT`, `TlEvent` and the 49
// events used to be declared right here and this was the only page that could
// read them. The markets annotation layer (D0833) needs the same events, and
// importing THIS COMPONENT from /live/markets would pull EducationPage's whole
// chunk into the markets graph — so the data went to `@/data/timeline`, a leaf
// that imports nothing, and both pages import that.
//
// Every string below is byte-identical to what it replaced and every element is
// the element it was; `verify-markets-dom` §7 asserts the rendered result
// against a pinned per-event manifest rather than trusting that sentence.
//
// What IS new is an anchor: each event carries `id={ev.slug}` so an annotation
// flag can deep-link to it, and `?e=<slug>` scrolls to and highlights one.
// Attributes only — no text, no node, no ordering changed.

import * as React from "react";
import { useLocation } from "react-router-dom";
import { PageHeader } from "@/layout/AppShell";
import type { MoneroLive } from "@/data/types";
import { TL_CAT, TL_ERAS, type TlCat, type TlEvent } from "@/data/timeline";


function TlNode({ ev, dimmed, focused }: { ev: TlEvent; dimmed: boolean; focused: boolean }) {
  const cat = TL_CAT[ev.c];
  return (
    <div
      id={ev.slug}
      data-tl-slug={ev.slug}
      data-tl-focus={focused ? "" : undefined}
      className={focused ? "tl-node tl-node-focus" : "tl-node"}
      style={{ display: "grid", gridTemplateColumns: "24px 1fr", gap: 16, opacity: dimmed ? 0.18 : 1, transition: "opacity var(--d-3) var(--e-standard)" /* D0651: 0.3s exact → --d-3 */ }}
    >
      <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
        <div style={{ position: "absolute", top: 6, bottom: -22, width: 1, background: "var(--rule)" }} />
        <div style={{ width: 11, height: 11, borderRadius: 6, background: cat.color, boxShadow: `0 0 8px ${cat.color}`, marginTop: 4, zIndex: 1 }} />
      </div>
      <div style={{ paddingBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span className="mono" style={{ fontSize: "var(--fs-label)", color: cat.color, letterSpacing: "0.04em" }}>{ev.d}</span>
          <span className="mono" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.14em", textTransform: "uppercase", color: cat.color, border: "1px solid " + cat.color, borderRadius: 2, padding: "1px 6px" }}>{cat.label}</span>
        </div>
        <div className="serif" style={{ fontSize: 19, fontWeight: 500, color: "var(--ink-100)", margin: "5px 0 5px" }}>{ev.t}</div>
        <p className="mono dim" style={{ margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.65, maxWidth: "80ch" }}>{ev.b}</p>
      </div>
    </div>
  );
}

export function EduTimeline({ data }: { data: MoneroLive }) {
  const [filter, setFilter] = React.useState<string>("all");
  const total = TL_ERAS.reduce((a, e) => a + e.events.length, 0);

  /* ?e=<slug> — where an annotation flag on /live/markets lands. Deliberately a
     query param rather than a #hash: `routes/useRouteChrome.ts` resets the
     scroller on every navigation keyed on `location.key`, so a native fragment
     jump would be undone a tick later by the app's own chrome. Running inside
     rAF puts this AFTER that reset rather than in a race with it.
     `scrollIntoView` (not `window.scrollTo`) because `.art` makes the document
     unscrollable above 768px and `main.main` is the real scroller — the trap
     v6.1.3 recorded. Instant, never smooth: a scroll animation is motion, and
     the reduced-motion path for it would be this same call. */
  const search = useLocation().search;
  const focus = React.useMemo(() => new URLSearchParams(search).get("e"), [search]);
  React.useEffect(() => {
    if (!focus) return;
    let raf = 0;
    // D0699-EXEMPT: one deferred scroll after the chrome's own reset, not a loop
    raf = requestAnimationFrame(() => {
      document.getElementById(focus)?.scrollIntoView({ block: "center" });
    });
    return () => cancelAnimationFrame(raf);
  }, [focus]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      <div className="edu-head">
        <PageHeader kicker="Interactive history"
          title='The Privacy Evolution <em style="color:var(--tk-accent);text-shadow:var(--glow-1);font-style:normal">Timeline</em>'
          sub="From Satoshi's genesis block to the regulatory storm — every pivotal moment in the evolution of financial privacy." />
      </div>

      <section style={{ display: "flex", gap: 28, alignItems: "center", flexWrap: "wrap" }}>
        {([[total, "Events"], [18, "Years"], [5, "Eras"]] as [number, string][]).map(([v, k], i) => (
          <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span className="mono acc glow" style={{ fontSize: 30, fontWeight: 500 }}>{v}</span>
            <span className="kicker">{k}</span>
          </div>
        ))}
        <div className="edu-chips" style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["all", ...Object.keys(TL_CAT)].map((k) => {
            const on = filter === k;
            const color = k === "all" ? "var(--ink-100)" : TL_CAT[k as TlCat].color;
            return (
              <button key={k} type="button" onClick={() => setFilter(k)}
                style={{ appearance: "none", cursor: "pointer", background: on ? "color-mix(in srgb, var(--text-primary) 6%, transparent)" : "transparent",
                  border: "1px solid " + (on ? color : "var(--ink-20)"), borderRadius: 999, padding: "5px 12px",
                  color: on ? color : "var(--ink-60)", fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                {k === "all" ? "All" : TL_CAT[k as TlCat].label}
              </button>
            );
          })}
        </div>
      </section>

      {TL_ERAS.map((era) => (
        <section key={era.id} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8 }}>
            <span className="mono" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.16em", color: "var(--tk-accent)" }}>{era.span}</span>
            <span className="serif" style={{ fontSize: 26, fontWeight: 500, color: "var(--ink-100)" }}>{era.name}</span>
            <span style={{ height: 1, flex: 1, background: "var(--rule)" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {era.events.map((ev, i) => (
              <TlNode key={i} ev={ev} dimmed={filter !== "all" && filter !== ev.c} focused={ev.slug === focus} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
