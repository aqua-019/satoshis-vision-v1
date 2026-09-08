/**
 * pages/TermsPage.tsx — /about/terms, the NINETEENTH route and the About
 * section's fourth leaf: the site's Terms of Service.
 *
 * ── THIS PAGE HAS AN AUTOMATED READER, AND THAT DECIDED ITS SHAPE ────────
 * xmr.irish is listed on kycnot.me, a directory of services usable without
 * identity disclosure. That directory re-reads this document MONTHLY with an
 * AI, hashes it, and re-scores the service from what it parses. Three
 * consequences, each of which is a decision on this page rather than a
 * preference:
 *
 *   1. IT IS PRERENDERED, like every other route here — `scripts/routes.mjs`
 *      carries R.ABOUT_TERMS and `scripts/prerender.mjs` walks ROUTES, so
 *      `dist/about/terms/index.html` is real HTML with the words in it. That
 *      is not house style being applied out of habit: their scoring carries a
 *      "Can't analyse ToS" attribute (0 privacy, -3 trust) whose stated causes
 *      are captchas, CLIENT SIDE RENDERING, DDoS interstitials and non-text
 *      formats. A client-rendered terms page would hand back three trust
 *      points to a parser that fetches HTML and does not run scripts.
 *
 *   2. NOTHING ON IT DEPENDS ON A HOOK, A FETCH, OR A CLIENT-ONLY BRANCH.
 *      It is prose and a mailto: anchor. `renderToString` under
 *      prerender.mjs produces the whole document, so the JS-off reader and
 *      the parser get identical content — and `verify-terms.mjs` §1 asserts
 *      the load-bearing sentence out of the STATIC file on disk rather than
 *      out of the DOM, which is precisely the thing that proves it.
 *
 *   3. THE SENTENCE IN §2 IS LOAD-BEARING FOR A QUARTER OF THIS SITE'S
 *      PUBLISHED PRIVACY SCORE. Their "Guaranteed no KYC" attribute (+25
 *      privacy) is defined as "Terms explicitly state KYC will never be
 *      requested". Prose has no type system: a hedge added in good faith
 *      during some future edit — "unless required by law", "at this time" —
 *      withdraws those points at the next monthly re-scan, with no CI
 *      failure, no error and no notification. `verify-terms.mjs` §2 exists
 *      for exactly that silent regression: it pins the sentence byte-for-byte
 *      and forbids thirteen hedging constructions inside the element that
 *      carries it. Do not soften it, and do not "improve" it.
 *
 * ── EVERY CLAIM NAMES ITS MECHANISM, AND THAT IS THE HONESTY RULE ────────
 * The page asserts nothing the tree does not enforce. Where a guarantee is
 * weaker than it could be made to sound, it says so out loud rather than
 * rounding up — §4's "what we will not overclaim" block exists because a
 * terms page that overstates its own guarantees is worse than none, and
 * because this site's whole argument is that claims should be checkable.
 * Four attributes worth +13 combined are deliberately NOT claimed (an onion
 * or I2P address, a warrant canary, a third-party audit, maturity), because
 * none of them is true today. `verify-terms.mjs` §3 asserts their ABSENCE as
 * well as the true claims' presence, so the page cannot drift into them.
 *
 * ── WHY THIS IS A ROUTE AND NOT A SECTION OF /about/site ─────────────────
 * The two overlap on purpose and neither is the other's source. SitePage is
 * EDITORIAL — what this site is and how it is funded, in the operator's own
 * voice. This one is CONTRACTUAL, written to be parsed. Merging them would
 * make one document serve two registers and one automated reader parse a
 * mission statement looking for a warranty disclaimer.
 *
 * ── THE COMPONENTS BELOW ARE LOCAL COPIES, DELIBERATELY ──────────────────
 * `Section` and `P` mirror SitePage's shapes and are NOT imported from it.
 * SitePage is `React.lazy`, so importing across two lazy chunk groups is the
 * "a leaf shared ACROSS GROUPS costs a chunk" defect this repo has recorded
 * five times — SitePage's own header documents it as the reason
 * `data/releases.ts` is not imported there. Twenty lines of duplication buys
 * a chunk that is not minted.
 *
 * ── NO FIGURES, NO RUNTIME DATES, NO COUNTS ──────────────────────────────
 * A terms page carrying a live number is a terms page that can disagree with
 * itself between two readers. EFFECTIVE_DATE is a literal string used in both
 * places it appears, so the two cannot drift apart.
 */
import * as React from "react";
import { R } from "../../scripts/routes.mjs";
import { PageShell } from "@/layout/PageShell";
import { PageHeader } from "@/layout/AppShell";
import { Card, Crumbs } from "@/design/primitives";

/** Written once, rendered twice. See the header: no runtime date, ever. */
const EFFECTIVE_DATE = "8 September 2026";

/** The operator's contact address. A `mailto:` is an ANCHOR — it issues no
 *  request until a reader clicks it, which is what keeps `verify-origins`
 *  phase 1 satisfied for the same reason the Kuno fundraiser link is legal
 *  on /about/site (that gate's own comment: "an anchor issues no request
 *  until a user clicks it … that is not a leak"). */
const CONTACT = "aqua@xmr.irish";

interface SectionProps {
  /** Stable identity, stamped as `data-terms-section` on the header block —
   *  SitePage's `data-site-section` idiom, and it does the same job: the
   *  ORDER of a terms document is part of its meaning, and nothing
   *  structural protects a reorder. `verify-terms` §4 reads these in
   *  document order and pins the sequence. */
  id: string;
  kicker: string;
  /** Optional: the preamble block has no heading in the shipped copy, and
   *  inventing one to satisfy a prop would be adding words to a legal
   *  document to satisfy a component. */
  title?: string;
  children: React.ReactNode;
}

function Section({ id, kicker, title, children }: SectionProps) {
  return (
    <Card style={{ padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
      <div data-terms-section={id}>
        <div className="kicker" style={{ color: "var(--tk-accent)" }}>{kicker}</div>
        {title ? (
          <h2
            className="serif"
            style={{ margin: "8px 0 0", fontSize: 22, lineHeight: 1.3, color: "var(--ink-100)", fontWeight: 500 }}
          >
            {title}
          </h2>
        ) : null}
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

/** A bulleted list in the body voice. `--fs-body` like `P`, never a literal:
 *  `verify-legibility` bans sub-14px inline font sizes, and the token is the
 *  thing the ≤720px block redefines to hold the 12px touch floor. */
function Ul({ children }: { children: React.ReactNode }) {
  return (
    <ul
      className="mono dim"
      style={{
        margin: 0,
        paddingLeft: 20,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        fontSize: "var(--fs-body)",
        lineHeight: 1.65,
      }}
    >
      {children}
    </ul>
  );
}

/** Inline literal — a header value, a CSS directive, a query parameter. */
function C({ children }: { children: React.ReactNode }) {
  return <code className="mono" style={{ color: "var(--ink-100)" }}>{children}</code>;
}

/** Emphasis inside body prose, at body size. */
function B({ children }: { children: React.ReactNode }) {
  return <strong style={{ color: "var(--ink-100)", fontWeight: 600 }}>{children}</strong>;
}

export function TermsPage() {
  return (
    <PageShell width="standard" bg={{ intensity: "calm" }}>
      <Crumbs path={R.ABOUT_TERMS} />
      <PageHeader
        kicker="non-profit · educational · non-custodial"
        title="Terms of Service"
        sub="What this site does, what it will never do, and what it does not promise."
      />

      {/* ── Preamble ────────────────────────────────────────────────────── */}
      <Section id="intro" kicker={`effective ${EFFECTIVE_DATE} · last updated ${EFFECTIVE_DATE}`}>
        <P>
          xmr.irish is a non-profit educational website and a read-only Monero blockchain
          explorer. These terms describe what the site does, what it will never do, and what it
          does not promise. They are short because the site is small, and specific because vague
          terms are worth nothing to the person reading them.
        </P>
        <P>
          Everything asserted here is enforced by something in the site&rsquo;s public source code,
          and each section names the mechanism so you can check it yourself rather than take our
          word for it.
        </P>
      </Section>

      {/* ── 1 · What this service is ────────────────────────────────────── */}
      <Section id="what" kicker="1" title="What this service is">
        <P>
          xmr.irish is an educational hub and a live mempool and network explorer for the Monero
          mainnet. It reads public data from Monero nodes and public APIs and presents it
          alongside written explanations.
        </P>
        <P>
          <B>It is not a financial service.</B> xmr.irish:
        </P>
        <Ul>
          <li>does not exchange, swap, buy, sell, or trade any asset;</li>
          <li>does not take custody of funds, and holds no balance for anyone;</li>
          <li>
            does not operate a wallet, and never asks for, generates, stores, or transmits a
            private key, seed phrase, view key, or wallet file;
          </li>
          <li>does not process payments;</li>
          <li>has no user accounts.</li>
        </Ul>
        <P>
          The site holds no funds and is technically incapable of moving money. Nothing on it is
          an offer, a solicitation, or a brokered service of any kind. It embeds no third-party
          service: there is no exchange widget, no swap interface, and no embedded frame of any
          kind anywhere on this site.
        </P>
      </Section>

      {/* ── 2 · Identity: no KYC, ever ──────────────────────────────────── */}
      <Section id="identity" kicker="2" title="Identity: no KYC, ever">
        {/* THE LOAD-BEARING SENTENCE. `data-terms-nokyc` is what verify-terms
            §2 reads: §2a pins the first sentence byte-for-byte out of the
            PRERENDERED HTML, and §2b sweeps this element for thirteen hedging
            constructions lifted from kycnot's own NEGATIVE attributes. Every
            word inside this block is load-bearing. Do not hedge it, do not
            qualify it, and do not add an exception. If the site's conduct ever
            changes, the honest response is to take the page down, not to
            soften the sentence — which is what §13 says in as many words. */}
        <div data-terms-nokyc style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <P>
            <B>
              xmr.irish will never request, collect, or verify your identity. There is no Know
              Your Customer procedure on this site, there never has been one, and one will never
              be introduced.
            </B>
          </P>
          <P>
            This is not a current policy that may change with circumstances. It is a permanent
            term of this service. Specifically, and without exception:
          </P>
          <Ul>
            <li>We will never ask for your name, address, date of birth, or nationality.</li>
            <li>
              We will never ask for a government-issued identity document, a photograph, a selfie,
              a proof of address, or a biometric sample.
            </li>
            <li>We will never ask for a phone number, and no part of this site sends SMS or places calls.</li>
            <li>We will never ask for an email address, and there is no mailing list.</li>
            <li>We will never ask for Source of Funds or Source of Wealth information.</li>
            <li>
              We will never run an AML screen, a transaction-risk score, or a blockchain-analytics
              check against anything you look at.
            </li>
            <li>
              We will never require an account, a login, a session, a token, or a registration of
              any kind in order to use any part of this site.
            </li>
          </Ul>
          <P>
            <B>No personal information is verified, because none is collected.</B> There is no
            field anywhere on xmr.irish into which personal information can be entered.
          </P>
          <P>
            This term cannot be satisfied by a future change of business model, because there is
            no business model: see section 8.
          </P>
        </div>
      </Section>

      {/* ── 3 · Custody and funds ───────────────────────────────────────── */}
      <Section id="custody" kicker="3" title="Custody and funds">
        <P>
          xmr.irish is <B>entirely non-custodial</B>. It never holds, controls, freezes, seizes,
          delays, or returns funds, because it never receives them.
        </P>
        <P>
          It follows that certain risks common to crypto services do not exist here, and cannot be
          introduced:
        </P>
        <Ul>
          <li>Your funds cannot be frozen by this site, because this site never holds them.</li>
          <li>
            No deposit can be flagged, blocked, or held pending verification, because there are no
            deposits.
          </li>
          <li>
            There is no refund policy, because there is nothing to refund. Nothing on xmr.irish
            costs anything.
          </li>
          <li>
            There are no transaction limits, no liquidity partners, and no upstream provider that
            could impose conditions of its own.
          </li>
        </Ul>
        <P>
          <B>Donations.</B> The site accepts voluntary donations in Monero through a third-party
          fundraising page (Kuno). That link is an ordinary hyperlink: your browser makes no
          request to it until you click it, and the site displays no total, no widget, and no
          badge from it. Donations are gifts, are not payment for any service, confer no rights or
          entitlements, and are not refundable. Once you leave for that page, that platform&rsquo;s
          own terms apply, and we have no visibility into and no control over it.
        </P>
      </Section>

      {/* ── 4 · Data ────────────────────────────────────────────────────── */}
      <Section id="data" kicker="4" title="Data: what is collected, and what is honestly still true">
        <P>
          <B>We operate a strict no-log policy.</B> xmr.irish keeps no logs of its own: no access
          log, no analytics store, no user database, no search history, no record of which
          transactions or blocks anyone looked up. There is nothing to keep, because there is no
          identifier for a reader to key a record against.
        </P>
        <P>There is no tracking of any kind:</P>
        <Ul>
          <li>
            <B>No analytics, beacons, tracking pixels, cookies, fingerprinting, or advertising.</B>{" "}
            None of it is present in the source, and the site is served under a
            Content-Security-Policy of <C>connect-src &apos;self&apos;</C>, which forbids your
            browser from opening a connection to any other origin. A build gate
            (<C>verify-origins.mjs</C>) sweeps the source tree for off-origin fetches and
            separately drives the site in a real browser counting the requests that actually
            leave.
          </li>
          <li>
            <B>No consent banner</B>, because there is nothing to consent to.
          </li>
          <li>
            <B>No CAPTCHAs, bot challenges, or interstitials.</B> Absent by decision, permanently.
            The machinery that makes much of the web hostile to Tor is not in this repository and
            is not coming.
          </li>
          <li>
            <B>The fonts are local.</B> Twelve font files are served from this origin. No font
            network is told which page you opened.
          </li>
          <li>
            <B>Third parties never see you.</B> The site does read outside sources &mdash; market
            data, repository activity, a public census of Monero nodes. Every one of those is
            fetched by the server on the site&rsquo;s behalf, so your address reaches them exactly
            never. Outbound links are served with <C>Referrer-Policy: no-referrer</C>, so a site
            you open from here is not told where you came from.
          </li>
        </Ul>
        <P>
          <B>What we will not overclaim.</B> A term that overstates its own guarantees is worse
          than none, so:
        </P>
        <Ul>
          <li>
            The site is served by a hosting provider that meters requests the way any internet
            origin does. We do not receive, request, or retain reader-identifying data from it,
            and caching collapses simultaneous readers into a single upstream fetch &mdash; so
            even the operator&rsquo;s view is that a page was read, never who read it. We cannot
            make promises on a host&rsquo;s behalf, and we do not.
          </li>
          <li>
            <B>Your browser stores a small amount of data locally</B>, on your own machine, under
            an <C>xmri.</C> prefix: the last good market data, a short-lived feed cache, and your
            own display preferences. None of it identifies you, none of it is transmitted
            anywhere, and no transaction-identifiable data is written to it. Clearing your
            browser&rsquo;s site data removes all of it.
          </li>
          <li>
            <B>If you use the transaction tracker, that transaction id reaches this site&rsquo;s
            server</B>, because looking it up requires asking a node. It is not stored, not logged
            against you, and not associated with anything &mdash; but it is transmitted, and we
            say so rather than pretending otherwise.
          </li>
        </Ul>
        <P>
          <B>Links you share.</B> A link copied from this site may carry a query parameter naming
          what you were looking at: a mempool view, a block, a peer brief, a chart range, a
          timeline event, or a tracked transaction (<C>?tx=</C>). None of these names you &mdash;
          there is no name, account, session id, or reader identifier to put there, because none
          exists. Note that <C>?tx=</C> names a transaction you chose to track: if you share that
          link, whoever opens it learns which transaction you were watching. Treat it accordingly.
        </P>
      </Section>

      {/* ── 5 · Access ──────────────────────────────────────────────────── */}
      <Section id="access" kicker="5" title="Access, availability, and the absence of gatekeeping">
        <P>
          <B>Anyone may use xmr.irish, from anywhere, without asking.</B> There is no registration,
          no account, no approval, no waitlist, and no geographic restriction. We do not block
          countries, IP ranges, VPNs, Tor exit nodes, or I2P.
        </P>
        <P>
          <B>We cannot suspend, ban, or terminate you</B>, because there is no account to suspend
          and no relationship to terminate. There is no user record, so there is nothing that
          could be revoked at anyone&rsquo;s discretion.
        </P>
        <P>
          <B>Every page works with JavaScript disabled.</B> This site does not require JavaScript
          in order to be read. All routes are real HTML generated at build time. Tor Browser at
          its Safest setting reads this site whole. Live data enriches a page; it is never the
          price of admission.
        </P>
        <P>
          <B>Availability is best-effort.</B> The site is provided free of charge with no uptime
          guarantee, no service level, and no support obligation. It may be slow, degraded, or
          offline. Where a live data feed fails, the site shows the last known value marked{" "}
          <C>STALE &middot; reconnecting</C>, or an em-dash &mdash; it never invents a substitute
          figure.
        </P>
      </Section>

      {/* ── 6 · Accuracy ────────────────────────────────────────────────── */}
      <Section id="accuracy" kicker="6" title="Accuracy, and what nothing here is">
        <P>
          <B>Every figure on a live surface is one the site actually received, or it is an
          em-dash.</B>{" "}
          It is never a plausible guess wearing the clothes of a measurement. Where educational
          simulators display invented values, they are labelled as simulations, in the one part of
          the site where invented values are permitted.
        </P>
        <P>
          Nevertheless, blockchain data is read from public sources that can be delayed,
          incomplete, or wrong, and written explanations can go out of date. Verify anything that
          matters against a node you run yourself. The site tells you where every number comes
          from on its Sources &amp; provenance page, so that you can.
        </P>
        <P>
          <B>Nothing on xmr.irish is financial, investment, legal, or tax advice.</B> It is
          educational material about a cryptocurrency and its protocol. No content here is a
          recommendation to buy, sell, hold, or transact in anything. The operator is not a
          financial advisor, a broker, or a lawyer.
        </P>
        <P>
          <B>You are responsible for your own compliance.</B> Laws concerning cryptocurrency
          ownership, transfer, privacy tooling, and taxation differ by jurisdiction and change.
          Determining what applies to you is your responsibility, not this site&rsquo;s. The site
          describes what the law is in various places as an educational matter; it does not tell
          you what to do about it.
        </P>
        <P>
          <B>Mention is not endorsement.</B> The site links to and describes third-party projects,
          wallets, pools, exchanges and services, including a page of peer projects and a
          directory of trading venues. These are editorial descriptions, not recommendations or
          guarantees, and no third-party service is embedded or operated here. Each third party
          has its own terms and its own risks; review them yourself. We receive no payment,
          commission, referral fee, or consideration of any kind for any mention or link on this
          site &mdash; see section 8.
        </P>
      </Section>

      {/* ── 7 · Content and reuse ───────────────────────────────────────── */}
      <Section id="content" kicker="7" title="Content and reuse">
        <P>The source code of this site is public and MIT-licensed; see section 10.</P>
        <P>
          Written explanations, editorial content and design are the work of the operator. You are
          welcome to quote, teach from, translate and link to this material. If you republish a
          substantial part of it, attribute it and link back &mdash; not as a licence condition,
          but because a site whose whole argument is that claims should be checkable would rather
          readers could find the original.
        </P>
      </Section>

      {/* ── 8 · Funding ─────────────────────────────────────────────────── */}
      <Section id="funding" kicker="8" title="How it is funded, and why these terms can be absolute">
        <P>
          xmr.irish is non-profit and independent. It has no company behind it, no sponsor, no
          advertising, no affiliate arrangements, no referral revenue, no paid placements, and no
          data to sell. It is funded by voluntary donations and by the operator.
        </P>
        <P>
          This is stated in the terms rather than in marketing copy because it is the reason the
          sections above can be unconditional: <B>there is nobody to sell an exception to.</B> A
          site that monetised its readers would eventually need to know something about them. This
          one has no such pressure, and so it has built itself to be incapable.
        </P>
      </Section>

      {/* ── 9 · Legal process ───────────────────────────────────────────── */}
      <Section id="legal" kicker="9" title="Legal process, takedown requests, and abuse complaints">
        <P>
          We evaluate any takedown request, abuse complaint, or third-party demand on its merits,
          in writing, rather than acting on it automatically.
        </P>
        <P>
          Because the site keeps no user records, <B>a request for user data cannot be complied
          with</B>: there is no log, no account, no identifier, and no stored record of who read
          what. This is not a policy of refusal &mdash; it is a property of how the site is built.
          We do not undertake to break the law, and we do not undertake to voluntarily assist
          requests that seek data we have deliberately arranged not to hold.
        </P>
        <P>
          Where a request concerns published content rather than user data, we will read it,
          respond, and correct genuine errors &mdash; the site&rsquo;s own standard is that a
          claim which cannot be verified does not ship. We do not remove accurate, lawfully
          published educational material on request alone.
        </P>
        <P>
          Requests, corrections and reports may be sent to{" "}
          <a
            href={`mailto:${CONTACT}`}
            style={{ color: "var(--ink-100)", textDecoration: "underline", textUnderlineOffset: 2 }}
          >
            <B>{CONTACT}</B>
          </a>
          .
        </P>
      </Section>

      {/* ── 10 · Acceptable use ─────────────────────────────────────────── */}
      <Section id="use" kicker="10" title="Acceptable use">
        <P>
          Use of this site is subject to almost nothing, but not quite nothing. Do not:
        </P>
        <Ul>
          <li>
            attempt to disrupt, overload, or damage the site or the infrastructure it depends on;
          </li>
          <li>attempt to gain unauthorised access to any system;</li>
          <li>
            scrape the site at a volume that degrades it for others &mdash; the source and the
            underlying data are public, so if you want the data in bulk, run a node or use the
            repository rather than hammering this origin.
          </li>
        </Ul>
        <P>
          There is no penalty mechanism attached to this section, because there are no accounts to
          penalise. It is a request, made in the only terms available.
        </P>
      </Section>

      {/* ── 11 · Source code ────────────────────────────────────────────── */}
      <Section id="source" kicker="11" title="Source code">
        <P>
          The source code of this site is publicly available and released under the MIT Licence.
          You may read it, audit it, run it, fork it, and verify every claim in these terms
          against it. The verification gates named throughout this document are in that repository
          and run on every build &mdash; including one whose only job is to prove that the
          guarantee in section 2 has not been quietly weakened.
        </P>
      </Section>

      {/* ── 12 · Warranty ───────────────────────────────────────────────── */}
      <Section id="warranty" kicker="12" title="Warranty and liability">
        <P>
          The site is provided <B>&ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without
          warranty of any kind</B>, express or implied, including any warranty of merchantability,
          fitness for a particular purpose, accuracy, or non-infringement.
        </P>
        <P>
          To the maximum extent permitted by applicable law, the operator is not liable for any
          loss or damage arising from use of, or inability to use, this site &mdash; including
          financial loss, loss of data, or loss arising from reliance on information published
          here. You use it at your own risk, and you verify what matters.
        </P>
        <P>Nothing in these terms limits liability that cannot lawfully be limited.</P>
      </Section>

      {/* ── 13 · Changes ────────────────────────────────────────────────── */}
      <Section id="changes" kicker="13" title="Changes to these terms">
        <P>
          These terms may be updated as the site changes. The effective date at the top will
          change with them, and material changes will be noted in the site&rsquo;s release notes.
        </P>
        {/* The permanence clause. verify-terms §2c asserts this block still
            contains "is permanent" and still names the identity commitment as
            not subject to change — §2 is worthless if §13 quietly makes it
            revocable, and that is the cheapest possible way to gut the page
            while leaving §2 word-for-word intact. */}
        <P>
          <B>One part of these terms is not subject to change.</B> The commitment in section 2
          &mdash; that xmr.irish will never request, collect, or verify identity, and will never
          introduce a KYC procedure &mdash; <B>is permanent</B>. It is not a policy under review.
          Were the site ever to be transferred, sold, or discontinued, the honest outcome is that
          it goes offline, not that it acquires identity checks. If you ever encounter a page on
          this domain asking you for identity documents, it is not this site.
        </P>
      </Section>

      {/* ── 14 · Contact ────────────────────────────────────────────────── */}
      <Section id="contact" kicker="14" title="Contact">
        <div className="chip-row">
          <a className="v6-res" href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>
        </div>
      </Section>

      <Card style={{ padding: 22 }}>
        <P>
          <em>
            These terms describe a site that collects nothing, holds nothing, and asks for
            nothing. Every mechanism named above is in the public source code and enforced by a
            build gate. If a claim here and the code ever disagree, the code is the truth, and the
            claim is the bug &mdash; report it.
          </em>
        </P>
      </Card>
    </PageShell>
  );
}
