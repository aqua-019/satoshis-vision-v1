/**
 * pages/TrustedPeersPage.tsx — the collaborator directory (/operate/peers).
 *
 * ── p4·M6b · THE CARD OPENS THE BRIEF, AND THE BRIEF HAS AN ADDRESS ───────
 * Two changes that are one mechanism, which is why they land together.
 *
 * 1 · A CARD BODY NO LONGER LEAVES THE SITE. v6.0.1 made `<Card onClick>` call
 *     `window.open(partner.url)`. Measured before this change: every one of
 *     the six PARTNER entries carries a `url`, so the `else` branch of that
 *     handler was DEAD CODE here and the whole card unconditionally navigated
 *     off-site on first click. A reader who wanted to know who these people
 *     are had to find a 52.8x16px button (p4·M3 measured it, and enlarged it
 *     to 44px precisely because a near-miss on it was destructive).
 *
 *     This page's own claim is that no request leaves this origin while you
 *     are on it, and that a link you follow is a link you CHOSE. A card that
 *     navigates on first click makes the reader leave before they know where
 *     they are going. So the card opens our brief, and the partner's site is a
 *     second, deliberate click on the `VISIT <NAME> ↗` anchor already inside
 *     the dialog. Nothing that was reachable became unreachable — the footer
 *     `visit <domain> ↗` anchor is still there and still stops propagation.
 *
 *     AND THE NEAR-MISS ASYMMETRY p4·M3 RECORDED INVERTS, IN THE SAFE
 *     DIRECTION. That note explains why `our brief` was enlarged and the
 *     sibling anchor deliberately was not: a near-miss on the anchor landed on
 *     the card, which did the same thing the anchor did. Both halves still
 *     hold, with the destinations swapped — a near-miss on `visit ↗` now lands
 *     on the card, which opens the brief: in-site, dismissible, and not a
 *     navigation the reader did not ask for. There is no longer ANY control on
 *     this page whose near-miss sends a reader off-site.
 *
 * 2 · `?p=<id>` MAKES A BRIEF SHAREABLE. Before this, all seven briefs shared
 *     one address: opening any of them left the URL at /operate/peers, so
 *     copying it sent the recipient to the grid rather than to the brief they
 *     were reading. There was no way to share a partner.
 *
 *     The shape is `/future/protocol?p=` (p4·06), through the same `useUrlState`
 *     hook, and a QUERY PARAM rather than a path segment deliberately: a path
 *     would demand a new ROUTES entry, a prerendered file, a sitemap row, a
 *     budget row and the rest of the twelve-surface registration sweep, for one
 *     component rendering one array. It buys the reader nothing.
 *
 *     PUSH, NOT REPLACE, per that hook's own documented policy: a parameter
 *     naming PRIMARY, SHAREABLE CONTENT gets a history entry (`?v=` on the
 *     mempool and `?p=` on the simulators both do), so Back closes the brief —
 *     which is the gesture a phone reader reaches for first.
 *
 *     `clearAtFallback` is what makes closing honest: the fallback is the empty
 *     string, which is not in `PEER_IDS`, so writing it DELETES the key rather
 *     than pinning `?p=` onto a closed page. Absent and closed are the same
 *     state, and the canonical /operate/peers URL stays clean.
 *
 *     AN UNKNOWN SLUG COSTS NO CODE. `isKnown` is false for anything not in
 *     PEER_IDS, so `?p=nonsense` renders the index with no dialog — the honest
 *     answer, and the one a broken shared link produces.
 *
 * KEYBOARD, STATED RATHER THAN ASSUMED: `Card` sets `role="button"` but no
 * tabIndex and no key handler (design/primitives.tsx), so a card has never been
 * keyboard-operable and this change does not alter that. Every brief stays
 * reachable by keyboard through the real `<button>` in the footer, which is why
 * that button is kept rather than folded into the card it now duplicates.
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
import { useUrlState } from "@/routes/useUrlState";
import { R } from "../../scripts/routes.mjs";

/* Hoisted to module scope on `useUrlState`'s own instruction: `values` is
   deliberately not a dependency of its setter, so an inline array literal would
   rebuild that callback every render for no behavioural gain.

   THESE IDS ARE AN INTERFACE, NOT AN IMPLEMENTATION DETAIL. Each one is a URL
   somebody can post, and a posted URL cannot be renamed later without breaking
   it. They are `EcoEntry.id` verbatim — the same keys the popup, the stagger
   index and the brief control already use — so there is no second list to
   drift. Renaming one is a breaking change to a public address. */
const PARTNERS = ECOSYSTEM.filter((e) => e.status === "PARTNER");
const PEER_IDS = PARTNERS.map((e) => e.id);

export function TrustedPeersPage() {
  /* The empty string is the "no brief open" fallback and is deliberately NOT a
     member of PEER_IDS: `isKnown` is therefore false for it, so a bare `?p=`
     behaves exactly like no parameter at all, and `clearAtFallback` turns the
     close into a delete rather than a `?p=` that pins an empty value. */
  const [, setPeer, { raw: requested, isKnown }] = useUrlState<string>({
    key: "p",
    values: PEER_IDS,
    fallback: "",
    clearAtFallback: true,
  });
  const partners = PARTNERS;
  const openE = isKnown ? ECOSYSTEM.find((e) => e.id === requested) : undefined;
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
        sub="Independent Monero collaborators we cross-link with and vouch for. Open any card to read our brief; their own site is one click further, from inside it."
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
          /* Card click → OUR BRIEF, at this peer's own address. The partner's
             site is a deliberate second click, on the `VISIT ↗` anchor inside
             the dialog or on the footer anchor below. See the header. */
          const openBrief = () => setPeer(e.id);
          return (
            <div key={e.id} className="v6-stagger" style={{ ["--stagger-i" as never]: String(i) }}>
              <Card onClick={openBrief} style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 300, borderColor: e.c + "44" }}>
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
                  {/* p4·M3 — `flexWrap` + `gap`, AND THE REASON IS A DEFECT ONLY
                      LOOKING FOUND. This row is `space-between` with two
                      children, and at 390 the card's inner width is ~254px.
                      `visit privacygateway.io ↗` — the longest partner domain
                      on the page, arriving with this release — measures 176px,
                      so the two children could not both fit: the button was
                      flex-shrunk to 79.7px and its label SHATTERED to "our /
                      brief" over two lines, while the anchor wrapped and left
                      its ↗ orphaned on a line of its own.

                      Nothing caught it. §9's clip check cannot: the button
                      wrapped INSIDE a 44px box rather than overflowing one, so
                      `scrollHeight === clientHeight` and the assertion was
                      correctly green. p4·04 recorded the identical shape on
                      `/operate/mine`'s copy button (27×60 where 58×24 was
                      intended) and the identical fix.

                      Wrapping is the honest answer rather than shrinking: on a
                      narrow card the two controls belong on two lines, whole,
                      not on one line in pieces. Above 390 the row still fits
                      and never wraps, so desktop is unchanged. */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, borderTop: "1px solid var(--rule)", paddingTop: 13 }}>
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
                      /* stopPropagation still matters even though the card
                         now does the same thing: without it one tap fires
                         `setPeer` twice, and `useUrlState` PUSHES, so a single
                         click would leave two identical history entries and
                         Back would appear not to work. */
                      onClick={(ev) => { ev.stopPropagation(); setPeer(e.id); }}
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
                        /* Never squeezed by a long sibling, never broken
                           mid-label. MEASURED, and the measurement corrected
                           what this comment first claimed: these two and the
                           row's `flexWrap` above are INDEPENDENTLY SUFFICIENT
                           at 390 — removing either pair alone leaves
                           verify-mobile §9 green, and only removing BOTH
                           reproduces the shatter (spread 3.1px). Both are
                           kept deliberately, because they express different
                           intents: `flexWrap` says the two controls may take
                           two lines, this pair says THIS control is never the
                           thing that gives way. Redundancy that has been
                           measured is not the same as redundancy assumed. */
                        flexShrink: 0,
                        whiteSpace: "nowrap",
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

      {shownE ? <EcoPopup e={shownE} open={!!openE} onClose={() => setPeer("")} /> : null}
    </PageShell>
  );
}
