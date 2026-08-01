/**
 * pages/SimulatePage.tsx — the protocol simulator surface (21 switchable sims).
 *
 * These are EDUCATIONAL models: illustrative, metaphor-driven animations of how
 * each protocol works — not live network data. That is stated on the page now,
 * not just in this comment: every sim carries a MODEL provenance badge and the
 * header strip below spells out what MODEL means.
 *
 * Protocol views render ProtoArtboard (header+stage+panel) only — no full page
 * chrome — so we wrap in PageShell at `width="fluid"`, which renders no centred
 * container at all and leaves the rail hidden (the default).
 *
 * v6.0.9: an unknown ?p= used to resolve to the decoy sim with no indication,
 * which is how a "RUN THE JAMTIS SIMULATOR" button could open decoy selection.
 * A wrong simulator is worse than an honest error, so unknown ids now render a
 * named not-found state instead.
 */

import * as React from "react";
import { useMoneroLive } from "@/data/DataContext";
import { PROTOCOL_VIEWS } from "@/views/protocols";
import { PROTOCOL_GROUP_ORDER } from "@/views/protocol-meta";
import { PageShell } from "@/layout/PageShell";
import { Crumbs } from "@/design/primitives";
import { Provenance } from "@/design/provenance";
import { useUrlState } from "@/routes/useUrlState";

const DEFAULT_ID = "decoy";

/** Hoisted so useUrlState's setter identity is stable across renders. */
const PROTOCOL_IDS: readonly string[] = PROTOCOL_VIEWS.map((p) => p.id);

export function SimulatePage() {
  const data = useMoneroLive();

  // `?p=` is PRIMARY, SHAREABLE content — which simulator you are running —
  // so it PUSHes. The THIRD tuple slot is why this page needs the hook rather
  // than a bare `params.get("p")`: "absent" and "present but unrecognised"
  // are different facts here. Absent opens the default sim; unrecognised must
  // render SimNotFound, because substituting a different protocol is the
  // v6.0.9 bug (a "RUN THE JAMTIS SIMULATOR" button silently opening decoy
  // selection). Collapsing both to the fallback would resurrect it.
  //
  // The write was also the same query-clobbering bug MempoolPage had:
  // `setParams({ p: p.id })` replaced the whole query string. Functional form
  // now, via the hook.
  const [activeSim, setSim, { raw: requested, isKnown }] = useUrlState({
    key: "p",
    values: PROTOCOL_IDS,
    fallback: DEFAULT_ID,
  });

  const notFound = requested != null && requested !== "" && !isKnown;
  const meta = PROTOCOL_VIEWS.find((p) => p.id === activeSim)!;
  const View = meta.Component;
  const activeId = notFound ? null : meta.id;

  return (
    <PageShell width="fluid" bg={{ intensity: "calm" }}>
      <div style={{ height: "100%", display: "grid", gridTemplateRows: "auto 1fr" }}>
        {/* D0744 — the simulator surface's visible title is ProtoArtboard's
            `<div class="title">`, rendered by 21 protocol modules; promoting
            that to an <h1> would put a heading inside every embedded artboard,
            including the ones the education page inlines. So the landmark's
            name is stated once here, screen-reader-only: `.sr-only` is
            position:absolute with a 1px box, which means it is not a grid item
            for track sizing and costs zero layout. */}
        <h1 id="page-title" className="sr-only">
          {notFound ? `Simulate · no such simulator “${requested}”` : `Simulate · ${meta.label}`}
        </h1>
        <div style={{ padding: "12px 20px", display: "flex", gap: 18, alignItems: "flex-start", borderBottom: "1px solid var(--rule)", flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 220 }}>
            <Crumbs items={["xmr.irish", "v5.0", "simulate", notFound ? "not found" : meta.label]} />
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <Provenance source="model" />
              <span className="mono" style={{ fontSize: "var(--fs-label)", color: "var(--ink-40)", letterSpacing: "0.04em" }}>
                educational models of protocol behaviour — not live chain data
              </span>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 20 }} />
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {PROTOCOL_GROUP_ORDER.map((group) => {
              const inGroup = PROTOCOL_VIEWS.filter((p) => p.group === group);
              if (!inGroup.length) return null;
              return (
                <div key={group} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <div className="kicker" style={{ color: "var(--ink-40)" }}>{group}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {inGroup.map((p) => {
                      const on = p.id === activeId;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          aria-current={on ? "page" : undefined}
                          onClick={() => setSim(p.id)}
                          style={{
                            appearance: "none", cursor: "pointer", background: "transparent",
                            border: "1px solid " + (on ? "var(--tk-accent)" : "var(--ink-10)"),
                            color: on ? "var(--tk-accent)" : "var(--ink-60)",
                            padding: "6px 10px",
                            fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)",
                            letterSpacing: "0.1em", textTransform: "uppercase",
                            boxShadow: on ? "var(--glow-1)" : "none",
                            display: "flex", flexDirection: "column", gap: 1, textAlign: "left",
                          }}
                        >
                          <span>{p.label}</span>
                          <span style={{ fontSize: "var(--fs-label)", color: "var(--ink-40)", letterSpacing: "0.04em", textTransform: "none" }}>{p.kicker}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ position: "relative", overflow: "hidden" }}>
          {notFound ? <SimNotFound requested={requested!} /> : <View data={data} />}
        </div>
      </div>
    </PageShell>
  );
}

/** Names what was asked for and what exists. Never substitutes a sim. */
function SimNotFound({ requested }: { requested: string }) {
  return (
    <div
      role="alert"
      style={{ height: "100%", overflow: "auto", padding: "48px 24px", display: "flex", justifyContent: "center" }}
    >
      <div style={{ maxWidth: "72ch", display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="kicker" style={{ color: "var(--y-50)" }}>NO SUCH SIMULATOR</div>
        <h2 className="serif" style={{ margin: 0, fontSize: "var(--fs-h1)", fontWeight: 400, color: "var(--ink-100)", lineHeight: 1.1 }}>
          There is no simulator with the id{" "}
          <em style={{ fontStyle: "normal", color: "var(--y-50)" }}>“{requested}”</em>.
        </h2>
        <p className="mono" style={{ margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.75, color: "var(--ink-60)" }}>
          You were not redirected to a different simulator, because showing you the wrong
          protocol would be worse than showing you nothing. Pick one of the{" "}
          {PROTOCOL_VIEWS.length} registered simulators from the switcher above.
        </p>
        <div className="mono" style={{ fontSize: "var(--fs-mono)", color: "var(--ink-40)", lineHeight: 1.9 }}>
          <div className="kicker" style={{ marginBottom: 6 }}>Registered ids</div>
          {PROTOCOL_VIEWS.map((p) => p.id).join(" · ")}
        </div>
      </div>
    </div>
  );
}

export default SimulatePage;
