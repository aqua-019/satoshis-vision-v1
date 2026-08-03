/**
 * pages/TrustedPeersPage.tsx — the collaborator directory (/peers).
 *
 * v6.0.1 behaviour change: a card's body now opens the partner's OWN site in
 * a new tab (noopener,noreferrer) rather than our in-site brief. The brief is
 * not removed — it moved to the `our brief` button in each card's footer,
 * which stops propagation so it never navigates away. Nothing that was
 * reachable before became unreachable.
 *
 * The stressnet entry has no `url` (it has no external site), so it keeps
 * modal-on-click.
 */

import * as React from "react";

import { PageShell } from "@/layout/PageShell";
import { PageHeader } from "@/layout/AppShell";
import { Card, Crumbs, Pill } from "@/design/primitives";
import { ECOSYSTEM } from "./future/data";
import { EcoPopup } from "./future/EcoPopup";
import { R } from "../../scripts/routes.mjs";

export function TrustedPeersPage() {
  const [eco, setEco] = React.useState<string | null>(null);
  const partners = ECOSYSTEM.filter((e) => e.status === "PARTNER");
  const openE = ECOSYSTEM.find((e) => e.id === eco);
  // D0666 — retain the last-opened brief so V6Modal can play its exit before
  // unmounting. Dropping <EcoPopup> on close (what this used to do) removes
  // the dialog from the DOM on the same frame, which is the exact absence of
  // an exit frame the change fixes. See FuturePage.tsx for the full note.
  const lastE = React.useRef<typeof openE>(undefined);
  if (openE) lastE.current = openE;
  const shownE = openE ?? lastE.current;

  return (
    <PageShell width="standard" bg={{ intensity: "calm" }}>
      <Crumbs path={R.ABOUT_PEERS} status={partners.length + " collaborators"} />
      <PageHeader
        kicker="Trusted peers · the surfaces around the protocol"
        title='The projects we <em style="color:var(--p-50);text-shadow:var(--glow-soft-p);font-style:normal">stand beside</em>.'
        sub="Independent Monero collaborators we cross-link with and vouch for. Open any card for their site, or read our brief on it."
        right={<Pill tone="acc" dot>{partners.length} partners</Pill>}
      />

      {/* D0661: each card is wrapped in `.v6-stagger`, which carries the
          entrance animation and the 0-based --stagger-i index — the same
          wrapper the /future grid uses, and for the same reason: `.panel`'s
          `animation` slot already belongs to the ambient breathe (see the
          CSS rule). The wrapper is `display: grid`, so it becomes the grid
          item and the card stretches inside it unchanged. */}
      <section className="v6-peer-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 }}>
        {partners.map((e, i) => {
          const primary = (e.links.find(([, href]) => href) || e.links[0] || [])[0];
          /* Card click → the partner's own site (new tab, noopener). The
             in-site brief stays one click away in the footer, so nothing
             that was in the modal is lost. */
          const visit = () => {
            if (e.url) window.open(e.url, "_blank", "noopener,noreferrer");
            else setEco(e.id);
          };
          return (
            <div key={e.id} className="v6-stagger" style={{ ["--stagger-i" as never]: String(i) }}>
              <Card onClick={visit} style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 300, borderColor: e.c + "44" }}>
                <div style={{ height: 4, background: e.c, boxShadow: `0 0 14px ${e.c}` }} />
                <div style={{ padding: "22px 24px 20px", display: "flex", flexDirection: "column", gap: 13, flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="v6-status" style={{ color: e.c }}>
                      <span className="led pulse" style={{ background: e.c, boxShadow: `0 0 8px ${e.c}`, margin: 0 }} />
                      {e.status}
                    </span>
                    <span className="kicker">{e.kind.replace("Collaborator · ", "")}</span>
                  </div>
                  <h3 className="serif" style={{ margin: 0, fontSize: "clamp(28px, 2.2vw, 38px)", fontWeight: 400, color: e.c, textShadow: `0 0 16px ${e.c}55` }}>{e.name}</h3>
                  <div className="serif" style={{ fontSize: 15, color: "var(--ink-80)", fontStyle: "italic" }}>{e.head}</div>
                  <p className="mono dim" style={{ margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.7, flex: 1 }}>{e.blurb}</p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--rule)", paddingTop: 13 }}>
                    <button
                      type="button"
                      className="mono dim2"
                      onClick={(ev) => { ev.stopPropagation(); setEco(e.id); }}
                      aria-label={`Read our brief on ${e.name}`}
                      style={{ background: "none", border: 0, padding: 0, cursor: "pointer", font: "inherit", fontSize: "var(--fs-label)", letterSpacing: "0.06em", textDecoration: "underline dotted" }}
                    >
                      our brief
                    </button>
                    {e.url ? (
                      <a
                        className="mono"
                        href={e.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(ev) => ev.stopPropagation()}
                        aria-label={`Visit ${e.name} (opens in a new tab)`}
                        style={{ fontSize: "var(--fs-mono)", color: e.c, textDecoration: "none" }}
                      >
                        visit {primary} ↗
                      </a>
                    ) : (
                      <span className="mono" style={{ fontSize: "var(--fs-mono)", color: e.c }}>open panel →</span>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          );
        })}
      </section>

      {shownE ? <EcoPopup e={shownE} open={!!openE} onClose={() => setEco(null)} /> : null}
    </PageShell>
  );
}
