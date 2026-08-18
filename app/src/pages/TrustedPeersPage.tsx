/**
 * pages/TrustedPeersPage.tsx — the collaborator directory (/operate/peers).
 *
 * v6.0.1 behaviour change: a card's body now opens the partner's OWN site in
 * a new tab (noopener,noreferrer) rather than our in-site brief. The brief is
 * not removed — it moved to the `our brief` button in each card's footer,
 * which stops propagation so it never navigates away. Nothing that was
 * reachable before became unreachable.
 *
 * The stressnet entry has no `url` (it has no external site), so it keeps
 * modal-on-click.
 *
 * Any EcoEntry that carries a `repo` (currently only Superbrain) also gets a
 * live GitHub pulse readout on its card, via future/repoPulse.tsx's
 * RepoPulseReadout — the same markup DevLabPulseCard renders on /future, in
 * its own leaf module rather than in future/cards.tsx (see that file's
 * header for why a shared component that big cannot live in the fat module).
 */

import * as React from "react";

import { PageShell } from "@/layout/PageShell";
import { PageHeader } from "@/layout/AppShell";
import { Card, Crumbs, Pill } from "@/design/primitives";
import { ECOSYSTEM } from "./future/data";
import { EcoPopup } from "./future/EcoPopup";
// Imported from the LEAF, not from "./future/cards" — cards.tsx also
// re-exports this name (so ProtoPopup's existing import keeps working), but
// importing it from here means TrustedPeersPage's chunk never pulls in
// ProtocolCard/MoneroNewsCard. See repoPulse.tsx's header: routing this
// import through cards.tsx once already put /about/peers at 101,152 B gzip
// against a 100,000 B ceiling.
import { RepoPulseReadout } from "./future/repoPulse";
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
      <Crumbs path={R.OPERATE_PEERS} status={partners.length + " collaborators"} />
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
      {/* p4·06 — gridTemplateColumns moved OUT of this inline style and into
          styles.css's `.v6-peer-grid`, because an inline declaration cannot
          carry a media query and the column count is now explicit per band
          (1 / 2 / 3). See that rule for why explicit beats auto-fit here and
          why the grid flows rather than pads. */}
      <section className="v6-peer-grid" style={{ display: "grid", gap: 18 }}>
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
                  {/* Live repo pulse — only the entries that carry a `repo`
                      get one (today: Superbrain). Not rendered on /future:
                      neither FuturePage nor EcoPopup imports this component,
                      so the page's pinned data-pulse="live" count (9) is
                      unaffected — see TrustedPeersPage's own header note if
                      that assumption is ever revisited. */}
                  {e.repo ? (
                    <div data-peer-pulse={e.repo}>
                      <div className="kicker" style={{ marginBottom: 4 }}>Live repo pulse · {e.repo}</div>
                      <RepoPulseReadout repo={e.repo} />
                    </div>
                  ) : null}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--rule)", paddingTop: 13 }}>
                    {/* p4·M3 — A REAL TAP TARGET, AND THE BUG IT FIXES IS NOT
                        "small text". Measured on the shipped build at 390x844
                        before this change: this control's box was 52.8 x 16.
                        The failure is what sits UNDERNEATH a near-miss — the
                        whole Card carries `onClick={visit}`, so a thumb that
                        lands a few pixels off does not miss, it hits the card
                        and `window.open`s the partner's site. The reader asked
                        to stay and read our brief and was sent off-site
                        instead, which is why this reads as "kyc.rip has no
                        popup" rather than as a sizing complaint. It was never
                        one card's defect: all six measured identically.

                        44 IS THE FLOOR, both axes (WCAG 2.2 AA 2.5.5 Target
                        Size (Minimum)). The height comes from `minHeight`
                        rather than vertical padding so the box is the stated
                        44 whatever the label wraps to, and `minWidth` covers a
                        future shorter label. `alignItems: center` on the row
                        means the taller control does not push the sibling
                        anchor around.

                        VISIBLY A CONTROL, not merely a bigger invisible one. A
                        44px hit area on text that still looks like text
                        teaches nothing — the reader who was missing it goes on
                        aiming at the words. The border is `--ink-10`, the same
                        weight `.v6-res` uses for the resource chips inside the
                        brief this button opens, so it reads as the same family
                        of thing; the dotted underline survives because it is
                        what said "this opens something" before.

                        THE SIBLING `visit ...` ANCHOR IS DELIBERATELY LEFT AT
                        ITS NATURAL SIZE, and the asymmetry is the argument: a
                        near-miss there lands on the card, whose click does the
                        SAME THING the anchor does — open the partner's site.
                        Missing it costs nothing. Only this button's near-miss
                        is destructive, so only this button is enlarged.

                        NO NEW CSS RULE: `cssGz` runs a 416 B margin and this
                        page's idiom is inline style throughout. */}
                    <button
                      type="button"
                      className="mono dim2"
                      onClick={(ev) => { ev.stopPropagation(); setEco(e.id); }}
                      aria-label={`Read our brief on ${e.name}`}
                      data-peer-brief={e.id}
                      style={{
                        background: "none",
                        border: "1px solid var(--ink-10)",
                        minHeight: 44,
                        minWidth: 44,
                        padding: "0 14px",
                        display: "inline-flex",
                        alignItems: "center",
                        cursor: "pointer",
                        font: "inherit",
                        fontSize: "var(--fs-label)",
                        letterSpacing: "0.06em",
                        textDecoration: "underline dotted",
                      }}
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
