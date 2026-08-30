/**
 * pages/SitePage.tsx — /about/site, the SIXTEENTH route and the About
 * section's third leaf: the site's page about itself.
 *
 * ── THE FILE NAME CARRIES NO SECTION PREFIX ──────────────────────────────
 * `SitePage`, not `AboutSitePage`. Measured, not preferred: NO page in this
 * directory carries its section prefix — `/operate/node` → NodePage,
 * `/operate/mine` → MinePage, `/operate/peers` → TrustedPeersPage,
 * `/about/sources` → SourcesPage, `/live/network` → NetworkPage. MinePage's
 * own header states the convention: `<Thing>Page.tsx`, with the section in
 * the ROUTE and not the filename.
 *
 * ── THE OVERVIEW IS DERIVED, NOT WRITTEN ─────────────────────────────────
 * The "what is on this site" section walks `nav/ia.ts`'s `IA` — the same
 * runtime source NavTop's dropdowns, the ⌘K palette, the mobile tab bar and
 * the breadcrumbs read. A hand-written list of the site's own contents is a
 * list that rots on the next route, and this repo has the receipts: p3·16
 * shipped a route that appeared in NO nav surface because one list was
 * hand-copied.
 *
 * It is also FREE. `IA` is eager (NavTop imports it), measured at `768ba13`
 * by grepping the built entry chunk for three of its blurbs — one hit each.
 * So this section costs no bytes in this page's chunk and cannot disagree
 * with the navigation, because it IS the navigation's source.
 *
 * ── WHY THE RELEASE LIST IS LINKED AND NOT RENDERED ──────────────────────
 * `data/releases.ts` is deliberately NOT imported here, and a gate enforces
 * it: verify-releases §7 asserts that module has exactly ONE value importer
 * and that it is the lazy SourcesPage. Importing it from this page would make
 * it a leaf shared across TWO lazy chunk groups, which Rollup answers by
 * hoisting it into a chunk of its own — the "a leaf shared ACROSS GROUPS
 * costs a chunk" rule this repo has recorded five times. It would have taken
 * CHUNK_COUNT to 73, onto its own band ceiling.
 *
 * The gate caught this on the first static run, which is the gate working.
 * The editorial answer is better anyway: this page tells the story, and
 * `/about/sources#release-notes` holds the ledger. Rendering the same five
 * rows on two routes would be duplication whatever it cost.
 *
 * ── THE HISTORY DRAWS ONLY ON THE REPO'S OWN RECORDS ─────────────────────
 * Every claim below is backed by something committed: `data/releases.ts`'s
 * five curated v5.0.x notes (verify-releases pins their COUNT and shape, not
 * their text — so this page says "in the words they shipped in" and does not
 * claim a byte-pin nothing enforces), CLAUDE.md's
 * decision log, `data/siteVersion.ts`'s own measured finding that the `vX.Y.Z`
 * convention stopped, and — for the one hard number in the section — the
 * PRE-DELETION TREE ITSELF. `0a49c1d` is the last commit on main that still
 * carries the static site, and it stays reachable even though the clone is
 * shallow: `git ls-tree --name-only 0a49c1d | grep '\.html$' | wc -l` -> 22,
 * with no root package.json, which is what "no build step" means literally
 * rather than impressionistically. Nothing is recalled from memory, and where
 * the records are thin the page says they are thin rather than smoothing it.
 *
 * ── THE PHRASINGS THIS SECTION MAY NOT USE ───────────────────────────────
 * `verify-future.mjs:99` walks the WHOLE REPO — every .ts/.tsx/.js/.mjs/.css/
 * .json/.md/.html from the root, skipping only node_modules/.git/dist/.vercel,
 * and exempting only itself — for a set of phrasings that would assert an
 * unproven MoneroSpace lineage. Two of its alternates are shapes a history
 * section reaches for naturally: one binds the site's own name to a
 * possessive-plus-"mempool", the other binds "this site" the same way.
 *
 * They are avoided here by construction, not by luck. Say "the v4 era", "the
 * fourth generation", "the static site that preceded this one". The gate's
 * bluntness is the point — it exists to kill a claim nobody has been able to
 * verify with the maintainer — so prose bends around it and the gate is never
 * edited to fit prose. Run `node verify-future.mjs` before shipping copy here.
 *
 * ── THE ETHOS SECTION CITES MECHANISMS, NOT INTENTIONS ───────────────────
 * Every privacy claim names the thing that ENFORCES it, because a
 * self-description that can rot is worse than none. The claims were verified
 * against the tree at `768ba13` rather than inherited:
 *
 *   · `connect-src 'self'`      vercel.json:17, read verbatim.
 *   · zero third-party origins  verify-origins.mjs. Phase 1 sweeps src/ + index.html
 *                               for subresource positions (things that FETCH) and
 *                               deliberately does NOT flag <a href> — its own
 *                               comment: "an anchor issues no request until a user
 *                               clicks it … that is not a leak", which is what makes
 *                               the fundraiser link legal. Phase 2 drives routes in a
 *                               browser counting off-origin requests; p4·05 adds
 *                               /about/site to that list, so the page's claim covers
 *                               the page itself.
 *   · 12 self-hosted woff2      `ls app/public/fonts` → 12.
 *   · prerendered, JS-off       scripts/prerender.mjs + verify-nojs.mjs.
 *   · no tracking code          swept for analytics/gtag/plausible/fathom/
 *                               umami/posthog/segment/mixpanel/sentry/
 *                               sendBeacon/document.cookie across app/src and
 *                               api/. Every hit was a false positive: prose
 *                               stating the rule, or the ordinary English
 *                               words "plausible" and "segment".
 *   · server-side third parties every client fetch is same-origin; CoinGecko,
 *                               GitHub and the node census are contacted from
 *                               api/ only.
 *
 * WHAT IT DELIBERATELY DOES NOT CLAIM. Not "no logs exist" — an origin is
 * metered by its host and saying otherwise would be the fabricated-reading
 * defect applied to the site's own conduct. Not "no storage": localStorage
 * genuinely is used, for last-good market data, a 24h feed cache and the
 * reader's own display preferences, under app/README.md's own rule that no
 * tx-identifiable data goes there. The honest version of each is on the page.
 *
 * ── THE SUPPORT SECTION IS A LINK AND NEVER A FETCH ──────────────────────
 * The fundraiser is an ANCHOR. The browser makes zero requests to its host:
 * no widget, no progress badge, no favicon. `connect-src 'self'` would forbid
 * a fetch and verify-origins would fail the build on one — but the stronger
 * reason is that the page has nothing to fetch, because it prints NO figures.
 * A live total would need the forbidden request; a hardcoded one rots into a
 * lie the day it changes, which is the SITE_PR lesson with money attached.
 */

import * as React from "react";
import { R } from "../../scripts/routes.mjs";
import { Link } from "react-router-dom";
import { PageShell } from "@/layout/PageShell";
import { PageHeader } from "@/layout/AppShell";
import { Card, Crumbs, Pill } from "@/design/primitives";
import { IA } from "@/nav/ia";
import { CloverOverlay } from "./about/CloverOverlay";

/* ── the operator's social link ───────────────────────────────────────────
 * OPERATOR-SUPPLIED, AND IT ARRIVED UNFILLED. The brief carries a bracket for
 * the handle and the bracket was not filled in, so this ships as an HONEST
 * NULL in the house's own unlinked idiom (`.v6-res`, dashed, `--ink-40`) —
 * the same treatment `monero/legality/JurisdictionRow.tsx` gives a citation
 * whose URL could not be confirmed, and `future/EcoPopup.tsx` gives a project
 * with no link.
 *
 * The prose beside it says the site is run INDEPENDENTLY and does not say by
 * how many people. The repository has a single owner, which is suggestive and
 * is not evidence, and headcount is a claim about real people that no record
 * in this tree establishes. The argument the section needs — no commercial
 * pressure, so the rules above can be absolute — follows from "no company, no
 * sponsor" and needs nothing more.
 *
 * A handle is NOT guessed here. An invented social link on the page that
 * says who runs the site is an impersonation vector, and this is the worst
 * possible place in the tree to fabricate one. Filling it is a one-line
 * change: set OPERATOR_X to the handle and the anchor renders itself. */
const OPERATOR_X: { handle: string; href: string } | null = null;

interface SectionProps {
  /** Stable identity, stamped as `data-site-section` on the header block.
   *  It is what makes the page's section ORDER machine-checkable: the
   *  reorder this page just went through (support second, the derived
   *  overview last) is an editorial decision that nothing structural
   *  protects, so `verify-site` §12 reads these in document order and
   *  pins the sequence. Without it a later edit could quietly restore the
   *  old order and every other assertion on the page would stay green. */
  id: string;
  kicker: string;
  title: string;
  children: React.ReactNode;
}

function Section({ id, kicker, title, children }: SectionProps) {
  return (
    <Card style={{ padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
      <div data-site-section={id}>
        <div className="kicker" style={{ color: "var(--tk-accent)" }}>{kicker}</div>
        <h2
          className="serif"
          style={{ margin: "8px 0 0", fontSize: 22, lineHeight: 1.3, color: "var(--ink-100)", fontWeight: 500 }}
        >
          {title}
        </h2>
      </div>
      {children}
    </Card>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="mono dim" style={{ margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.65 }}>
      {children}
    </p>
  );
}

/** A claim paired with the thing in this repo that enforces it. The mechanism
 *  is rendered in `.mono` at label size beneath the claim, so a reader can go
 *  and check it — which is the entire difference between a stated ethos and a
 *  demonstrated one. */
function Claim({ head, mech, children }: { head: string; mech: string; children: React.ReactNode }) {
  return (
    <div
      data-ethos-claim
      style={{ display: "flex", flexDirection: "column", gap: 6, height: "100%" }}
    >
      <div className="kicker">{head}</div>
      <P>{children}</P>
      {/* `marginTop: auto` pins every citation to the bottom of its grid cell.
          Without it they stair-step with paragraph length and the row of
          mechanisms — the thing that makes the section checkable — reads as
          ragged afterthoughts rather than a column of evidence. */}
      <div
        style={{ marginTop: "auto" }}
        data-ethos-mech
      >
        <span
          className="mono"
          style={{ fontSize: "var(--fs-label)", color: "var(--ink-40)", letterSpacing: "0.02em" }}
        >
          enforced by · {mech}
        </span>
      </div>
    </div>
  );
}

/**
 * The static clover mark. Present on EVERY path — animated entry, reduced
 * motion, and JavaScript off — because it is the information the overlay
 * carries, and the overlay is only how it arrives. It is inline SVG rather
 * than a canvas so it survives prerendering and costs no runtime at all.
 *
 * `aria-hidden`: the heading beside it already names the site. A second
 * announcement of the same thing is noise to a screen reader.
 */
function CloverMark({ size = 30 }: { size?: number }) {
  return (
    <svg
      data-clover-mark
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
      style={{ flex: "0 0 auto", display: "block" }}
    >
      <g fill="var(--g-50)">
        {[45, 135, 225, 315].map((deg) => (
          <path
            key={deg}
            d="M 0 0 C -9.9 -7.1 -19.8 -13.4 -17.7 -23.4 C -15.6 -31.9 -4.6 -33.3 0 -22.7 C 4.6 -33.3 15.6 -31.9 17.7 -23.4 C 19.8 -13.4 9.9 -7.1 0 0 Z"
            transform={`translate(50 46) rotate(${deg}) translate(0 -1.6)`}
          />
        ))}
        <path d="M -2.5 0.7 C -0.4 18.4 7.8 33.3 21.2 43.2 C 9.2 39.1 -1.4 29.8 -5.3 14.9 Z" transform="translate(50 46)" />
      </g>
    </svg>
  );
}

export function SitePage() {
  return (
    <PageShell width="standard" bg={{ intensity: "calm" }}>
      {/* Laid OVER everything below, out of the document flow, so its CLS
          contribution is zero by construction. Under reduced motion it
          returns null before a canvas or a rAF exists. */}
      <CloverOverlay />

      <Crumbs path={R.ABOUT_SITE} />
      <PageHeader
        kicker="non-profit · educational · no trackers"
        title='<em style="color:var(--tk-accent);text-shadow:var(--glow-1);font-style:normal">xmr.irish</em>: a non-profit educational system &amp; blockchain explorer'
        sub="What this site is, what is on it, where it came from, how it treats you, and how it stays up."
      />

      {/* ── The mission ─────────────────────────────────────────────────── */}
      <Section id="mission" kicker="the mission" title="An argument you can check, built out of live data.">
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <CloverMark size={38} />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <P>
              xmr.irish exists to make one argument legible: that a transparent ledger is a
              surveillance ledger, and that Monero's privacy is an architecture rather than a
              setting. It is a teaching tool and a blockchain explorer at the same time — the
              explanations sit beside the live chain they describe, so a claim on this site can
              be checked against the numbers on the same screen.
            </P>
            <P>
              It is non-profit. There is nothing to buy here, no account to make, no wallet to
              connect, and nothing that takes custody of anything. It holds no funds and cannot
              move money.
            </P>
          </div>
        </div>
      </Section>

      {/* ── Support ─────────────────────────────────────────────────────── */}
      <Section id="support" kicker="support" title="Support xmr.irish.">
        <P>
          This site is non-profit and carries no ads, no sponsors, and no trackers. Nothing here
          is paid for with your data, so it is paid for the old way: by people who want it to
          exist. If that is you, the XMR IRISH Fund runs on Kuno, a Monero-ecosystem fundraising
          platform, and takes XMR directly. Contributions go to hosting, node access, and
          continued development.
        </P>
        {/* THE ONE PLACE ON THIS PAGE THE EYE IS MEANT TO LAND.
            `a.proto-btn` is the house's existing primary affordance — accent
            border, accent text, `--glow-1`, uppercase — the same control Main
            Home gives "Open the mempool". Reusing it rather than authoring a
            donate style is deliberate on two counts: the reader already knows
            what it does, and it adds ZERO stylesheet rules, which matters at
            this repo's cssGz margin. The padding bump is inline, so it costs
            JS bytes and not CSS bytes. NO inline fontSize — `verify-legibility`
            bans sub-14px inline literals, and the class already resolves to
            11.5px desktop / 12px below 720px, which clears the touch floor.

            THE LABEL IS SHORT ON PURPOSE. `proto-btn` is uppercase with
            0.16em tracking, so a long label is wide out of proportion to its
            character count, and at 390px `.main * { min-width: 0 !important }`
            removes the min-content floor that would otherwise protect it —
            p4·04's recorded shatter. The prose directly above already names
            the XMR IRISH Fund, so the control only has to name the action and
            the destination. Measured at 390, not estimated.

            EMPHASIS, NOT A NAG. It is a link in the flow of the page: no
            modal, no banner, no sticky bar, no interstitial. A site whose
            whole argument is that it does not manipulate its readers cannot
            beg in the section that makes the argument. */}
        <div className="chip-row" style={{ marginTop: 6, marginBottom: 2 }}>
          <a
            className="proto-btn"
            data-support-link
            data-support-cta="primary"
            href="https://kuno.anne.media/fundraiser/tu3b/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ padding: "12px 20px" }}
          >
            Donate XMR · Kuno →
          </a>
        </div>
        <P>
          No total is shown here, and that is deliberate: a live figure would need the one thing
          this site does not do — a request to somebody else's server from your browser — and a
          number typed in by hand becomes wrong the day after it is typed. The fundraiser page
          holds the figures, because that is where the donations are.
        </P>
        <P>
          And if a donation is not in the cards, the network itself is the thing worth
          supporting: running a node or pointing a spare CPU at P2Pool strengthens exactly what
          this site exists to explain.
        </P>
        <div className="chip-row" style={{ marginTop: 2 }}>
          <Link className="v6-res" to={R.OPERATE_NODE}>Run a node</Link>
          <Link className="v6-res" to={R.OPERATE_MINE}>Mine Monero</Link>
        </div>
      </Section>

      {/* ── Lineage ─────────────────────────────────────────────────────── */}
      <Section id="record" kicker="the record" title="Where this came from.">
        <P>
          The site is on its sixth generation. The fourth was twenty-two hand-written HTML pages
          with no build step at all — a count taken from the last commit that still holds them
          rather than from memory — plus the layers that grew on top: client-side polling, lazy
          loading, an embedded exchange widget. None of it survives. The v6.1.0 release deleted
          the static front-end outright, and what you are reading is the React application that
          replaced it, prerendered back into real HTML at build time so that nothing was lost by
          the move.
        </P>
        <P>
          The v5 era is the one with a paper trail, and it was mostly about honesty rather than
          features: a purge of every simulated figure, one provenance vocabulary applied to every
          data surface, a fallback for hardened browsers, and the page that says where each
          number comes from. Those notes are kept as a ledger rather than retold here — they live
          on the sources page, in the words they shipped in.
        </P>
        <P>
          One of them set the rule everything since has followed. The v5.0.14 release removed
          every simulated and illustrative number from the live surfaces, and split the
          educational simulators off into the one place invented values are allowed and labelled
          as such. A figure on this site is real or it is an em-dash; it is never a plausible
          guess wearing the clothes of a measurement.
        </P>
        <P>
          Version stamps stopped after v6.1.9. That is measured rather than remembered — the
          repository carries no tags and no recent commit subject parses as a version — so
          releases are identified by their pull request number now, and the label in the top bar
          is checked against the project's own log on every build. Beyond the v4 era the records
          in this repository run out, and this page will not invent what they do not hold.
        </P>
        <div style={{ marginTop: 2 }}>
          <Link to={`${R.ABOUT_SOURCES}#release-notes`} className="mono acc" style={{ fontSize: "var(--fs-label)" }}>
            Every release, with its own notes →
          </Link>
        </div>
      </Section>

      {/* ── The ethos brief ─────────────────────────────────────────────── */}
      <Section id="ethos" kicker="zero bots · zero tracking · data-safe" title="Nothing here reports on you.">
        <P>
          If you use Monero, you already know why this matters: a tool that teaches financial
          privacy while quietly measuring the people who read it is not teaching, it is
          collecting. So this site is built so that it cannot. Each claim below names the thing
          in the codebase that enforces it, because an ethos you cannot check is a slogan.
        </P>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: 20, marginTop: 6 }}>
          <Claim head="No measurement code" mech="Content-Security-Policy: connect-src 'self' · verify-origins">
            No analytics, no beacons, no tracking pixels, no cookies, no accounts, no
            fingerprinting scripts. This is enforced rather than promised: the security policy
            this site is served under forbids your browser from making a request to any other
            origin at all. A build gate backs it from both ends — it sweeps the whole source
            tree for anything that would fetch off-origin, and it drives the site in a real
            browser counting the requests that actually leave, this page among them.
          </Claim>

          <Claim head="Even the fonts are local" mech="app/public/fonts — 12 files, no CDN">
            Typefaces are served from this origin. No font network sees a request for a page you
            opened, because there is no font network in the loop.
          </Claim>

          <Claim head="It works with JavaScript off" mech="scripts/prerender.mjs · verify-nojs">
            Every route is real HTML, generated at build time. Tor Browser at its Safest setting
            reads this site whole. Live data enriches a page; it is never the price of admission.
          </Claim>

          <Claim head="No bots, no gatekeeping" mech="absent by decision — no challenge code in the tree">
            No CAPTCHAs, no bot-management challenges, no interstitials, no "checking your
            browser". The machinery that makes so much of the web hostile to Tor is deliberately
            and permanently not here.
          </Claim>

          <Claim head="Third parties never see you" mech="api/ proxies · Referrer-Policy: no-referrer">
            The site does read outside sources — market data, repository activity, a public
            census of Monero nodes. Every one of those is fetched by the server on the site's
            behalf, so your address never reaches them. Outbound links carry no referrer either:
            a site you open from here is not told where you came from.
          </Claim>

          <Claim head="What is honestly still true" mech="stated, because overclaiming is the same defect">
            This site keeps no log of its own, but it is served by a host that meters requests
            the way any origin does, and caching collapses simultaneous readers into a single
            upstream fetch — so even the operator's view is that a page was read, never who read
            it. Your browser does store things locally: the last good market data, a short-lived
            feed cache, and your own display settings. None of it identifies you, and none of it
            leaves your machine.
          </Claim>
        </div>

        <div style={{ marginTop: 4 }}>
          <Link to={R.ABOUT_SOURCES} className="mono acc" style={{ fontSize: "var(--fs-label)" }}>
            Where every number on this site comes from →
          </Link>
        </div>
      </Section>

      {/* ── Who runs it ─────────────────────────────────────────────────── */}
      <Section id="operator" kicker="the operator" title="Who runs this.">
        <P>
          xmr.irish is run independently, with no company behind it and no sponsor to answer
          to. That is the reason the rules above can be absolute: there is nobody to sell an
          exception to.
        </P>
        <div className="chip-row" style={{ marginTop: 2 }}>
          {OPERATOR_X ? (
            <a
              className="v6-res"
              data-operator-link="linked"
              href={OPERATOR_X.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {OPERATOR_X.handle} · X
            </a>
          ) : (
            <span
              className="v6-res"
              data-operator-link="pending"
              style={{ borderStyle: "dashed", color: "var(--ink-40)", cursor: "default" }}
            >
              X · handle pending
            </span>
          )}
          <Pill>no company · no sponsor</Pill>
        </div>
      </Section>
      {/* ── What is on it — DERIVED from nav/ia.ts ──────────────────────── */}
      <Section id="overview" kicker="the whole site" title="Six sections, and everything under them.">
        <P>
          This list is not written down anywhere. It is read at render time from the same
          information architecture the navigation, the ⌘K palette and the breadcrumbs use, so it
          cannot fall behind the site it describes.
        </P>
        <div
          data-ia-overview
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: 20, marginTop: 4 }}
        >
          {IA.map((section) => (
            <div key={section.key} data-ia-section={section.key} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="kicker" style={{ color: "var(--tk-accent)" }}>{section.label}</div>
              <div className="mono dim2" style={{ fontSize: "var(--fs-label)", lineHeight: 1.5 }}>
                {section.blurb}
              </div>
              <ul style={{ listStyle: "none", margin: "2px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 5 }}>
                {section.cols.flatMap((col) => col.items).map((item) => (
                  <li key={item.p + item.l}>
                    <Link
                      to={item.p}
                      className="mono"
                      style={{ fontSize: "var(--fs-label)", color: "var(--ink-100)", textDecoration: "none" }}
                    >
                      {item.l}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

    </PageShell>
  );
}
