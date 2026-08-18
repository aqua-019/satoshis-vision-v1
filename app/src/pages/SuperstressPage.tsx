/**
 * pages/SuperstressPage.tsx — the Superstress hub (/operate/superstress).
 *
 * The FOURTEENTH route, and the first one minted since the v6.1.6 nav
 * restructure. It is the Operate section's second leaf, beside "Run a node",
 * and the framing is deliberate: everything on this page is software you run
 * on hardware you own. Nothing here is a service to sign up for.
 *
 * ── WHAT IS WRITTEN HERE AND WHAT IS NOT ─────────────────────────────────
 * The five apps' one-line functions are NOT written in this file. They live
 * in pages/future/data.ts's SUPERBRAIN_APPS, which the Superbrain partner
 * entry's "The five apps" block also derives from, so the two surfaces cannot
 * disagree. The install steps are the same entry's `blocks[]`. This page adds
 * detail — what each app is, why running it yourself changes anything, its
 * prerequisites — and reads everything it shares with /about/peers.
 *
 * ── TWO EMBARGOES, BOTH LIVE ─────────────────────────────────────────────
 * (1) MoneroSpace's provenance is an open question with its maintainer. It is
 *     described by FUNCTION ONLY, with its `caveat` beside it. verify-future
 *     §15 walks the WHOLE repo for a lineage claim and fails the build on one,
 *     so this file's copy is inside that sweep from its first commit.
 * (2) This chain's own parameters are not documented anywhere yet. The deep
 *     dive below explains what a stressnet IS — protocol-level, generic, true
 *     of any such chain — and says plainly that the specifics are not
 *     published. The one dated fact it cites is the fork version, and that is
 *     READ from FUTURE_PROTOCOLS rather than retyped. Superstress's OWN
 *     daemon's ports are inside this embargo too — see the port note below.
 *
 * ── THE BETANET QUESTION WAS ASKED AND ANSWERED (p3·19) ──────────────────
 * §5 used to reserve a 220px box for a public telemetry endpoint and say that
 * whether one existed at all was an open question. It is not open any more.
 * The maintainer answered: Superstress is self-hosted and runs its own
 * monerod, so no public endpoint exists and none is planned. The reservation
 * is gone because the thing it was holding space for is not coming — and §5
 * now ARGUES that self-hosted-only is the better answer rather than
 * apologising for a gap. There is no path from this page to a reader's node
 * and there never will be: CSP is `connect-src 'self'`, and a box on
 * somebody's LAN, Tailnet or onion is not this site's to reach or to proxy.
 * That is said ON THE PAGE, not only here, so nobody re-opens it in v7.
 *
 * ── EVERY PORT NUMBER ON THIS PAGE IS ATTRIBUTED, OR IT IS ABSENT ────────
 * The maintainer's reachability quote names three ports. They belong to the
 * MONERO NODE ADDON — the mainnet prerequisite in §3 — and NOT to Superstress's
 * own daemon, which brings its own and whose ports nobody has published. The
 * failure mode being guarded is a reader copying a config that cannot connect,
 * so the numbers are quoted inside `[data-ports]` with the attribution beside
 * them and are never restated loose anywhere else. verify-superstress §6
 * asserts that every occurrence on the rendered page sits inside that block.
 *
 * The one genuinely LIVE element is the repo pulse, which is real data from
 * /api/feeds and degrades to a named absence rather than to a number.
 */

import * as React from "react";
// In-app destinations go through <Link>, not a bare <a href>. Both render a
// real anchor — which is what verify-nojs needs in the prerendered document —
// but <a> also triggers a full document load, discarding the SPA's warm state
// on a site whose whole point is that the live tiers keep running.
import { Link } from "react-router-dom";

import { PageShell } from "@/layout/PageShell";
import { PageHeader } from "@/layout/AppShell";
import { Card, Crumbs, Pill } from "@/design/primitives";
import { Disclosure } from "@/design/Disclosure";
import {
  ECOSYSTEM,
  FUTURE_PROTOCOLS,
  SUPERBRAIN_APPS,
  SUPERBRAIN_SHARED_PREREQ,
  type SuperbrainAppId,
} from "./future/data";
// The LEAF, never "./future/cards" — cards.tsx re-exports this name, and
// importing it through the fat module would drag ProtocolCard and
// MoneroNewsCard into this route's chunk. That mistake has already cost
// /about/peers 1,052 B once; see repoPulse.tsx's header.
import { RepoPulseReadout } from "./future/repoPulse";
import { R } from "../../scripts/routes.mjs";

/** The store's own partner entry — the source for the install steps, the
 *  shared-prerequisite paragraph and the repo. Found by id rather than by
 *  index so a reordering of ECOSYSTEM cannot silently retarget this page. */
const STORE = ECOSYSTEM.find((e) => e.id === "superbrain");
/** The stressnet entry — the source for the beta chain's own framing. */
const CHAIN = ECOSYSTEM.find((e) => e.id === "stressnet");
/** The FCMP++ card — the ONLY place the fork version is written down. */
const FCMP = FUTURE_PROTOCOLS.find((p) => p.id === "fcmp");

const INSTALL = STORE?.blocks?.find((b) => b.ordered);
const MINER_CMD = STORE?.blocks?.find((b) => !b.ordered && b.lines.length === 1)?.lines[0];

const SUPERBRAIN_REPO = "https://github.com/brainchainz/Monero-Superbrain";

interface AppDetail {
  /** Longer explanation, in paragraphs. EMPTY where none may be asserted. */
  what: readonly string[];
  /** Why running it yourself changes anything. NULL where none is asserted. */
  why: string | null;
  /** An honest note that travels with the app wherever it is described. */
  caveat?: string;
  href: string;
  /** Honestly-empty screenshot slot label — reserved, never a generated image. */
  shot: string;
}

/**
 * The hub's per-app essay. Lives HERE rather than in data.ts because
 * FuturePage and TrustedPeersPage both import that module and neither renders
 * a word of this — see the SUPERBRAIN_APPS header for the byte count that
 * decision is worth.
 *
 * `Record<SuperbrainAppId, …>` is the whole exhaustiveness mechanism: the id
 * union comes from the spine's `as const`, so a sixth app added there is a
 * COMPILE ERROR here rather than a row that silently renders empty. Nothing
 * else pins these two lists together, exactly as the two
 * `Record<ProvSource, …>` maps in design/provenance.tsx are the only thing
 * pinning the provenance vocabulary.
 *
 * MoneroSpace is the one entry with an empty `what` and a null `why`, and
 * that is deliberate and load-bearing: its provenance is an open question
 * with its maintainer, so this site describes it by FUNCTION ONLY. Filling
 * these in without an answer is exactly what verify-future.mjs §15 fails the
 * build over.
 */
const APP_DETAIL: Record<SuperbrainAppId, AppDetail> = {
  superbrain: {
    what: [
      "P2Pool is a peer-to-peer mining pool: instead of a company running a server that collects everyone's work and pays out from its own wallet, the participants run the pool between them and the chain itself pays each miner directly. There is no operator to trust, no account, and no minimum payout held on your behalf.",
      "XMRig is the miner that does the actual hashing. Pairing the two on one box gives you a pool and a miner you own, and the app opens a port so other machines on your LAN — or across a Tailscale network — can point their own miners at it.",
    ],
    why: "Pool centralisation is the standing critique of proof-of-work: a handful of operators end up choosing which transactions get mined. A pool you host, mining to a wallet you hold, removes you from that count entirely.",
    href: SUPERBRAIN_REPO,
    shot: "screenshot · superbrain mining dashboard",
  },
  superpay: {
    what: [
      "A view-only wallet holds the key that lets it RECOGNISE incoming payments and not the key that lets it move them. That is what makes a till safe to put on a counter: it can tell you a payment arrived and for how much, and it cannot spend a thing.",
      "Running it yourself means the payment goes from the customer to your wallet with no processor in between — nobody to freeze it, take a percentage, or file a report about it.",
    ],
    why: "Every hosted payment processor is a party that can be compelled to hand over a record of who paid you and when. A till that only ever holds a view key produces no such record for anyone else to keep.",
    href: SUPERBRAIN_REPO,
    shot: "screenshot · superpay till view",
  },
  monerospace: {
    what: [],
    why: null,
    caveat:
      "Where its interface design comes from is an open question we have put to its maintainer. Until that is answered this site names the project, links the repo, and claims nothing further either way.",
    href: SUPERBRAIN_REPO,
    shot: "screenshot · monerospace on the beta chain",
  },
  superstress: {
    what: [
      "This is the app the rest of this page is about: a node that joins the FCMP++ beta chain rather than mainnet, so the proof system due at the next hard fork can be run under load before anyone's real money depends on it.",
      "The wallet lab is the other half — somewhere to build, send and inspect transactions against that chain, which is how a wallet author finds out their assumptions broke before their users do.",
    ],
    why: "A beta chain is only as useful as the number of independent nodes on it. One node on somebody else's hardware measures one machine; a node on yours adds a data point nobody had, and Tor routing means adding it does not also publish where you are.",
    href: SUPERBRAIN_REPO,
    shot: "screenshot · superstress node dashboard",
  },
  superatomic: {
    what: [
      "An atomic swap trades XMR for BTC directly between two people, with the protocol itself guaranteeing that either both halves happen or neither does. There is no exchange holding both sides mid-trade, which means there is no moment at which somebody else has your coins.",
      "Its swap engine is a GPLv3 fork of eigenwallet/core, and the complete corresponding source is published at github.com/brainchainz/eigenwallet-core — real licence compliance, worth naming in public.",
    ],
    why: "The identity check happens at the exchange, not on the chain. A swap with no exchange in the middle is the one acquisition path that never creates a file linking your name to an amount.",
    href: "https://github.com/brainchainz/eigenwallet-core",
    shot: "screenshot · superatomic swap view",
  },
};

/**
 * The prerequisite, made concrete. "Monero" in the install order is ONE
 * specific Umbrel app, and a reader who installs a different one — or who
 * assumes it joins the beta chain — has installed the wrong thing.
 *
 * These were READ from the upstream app repo when this page was written and
 * are recorded here rather than re-derived, because nothing in this browser
 * can confirm them: CSP is `connect-src 'self'`, so the page reaches no
 * third party. Anything that could NOT be confirmed is absent rather than
 * guessed — which is why there is no row here for the beta chain's own
 * daemon, its version, or its ports. That absence is the embargo, not an
 * oversight.
 *
 * I2P IS DELIBERATELY LISTED AS A NEGATIVE. Upstream leaves the i2pd daemon
 * commented out, so a reader planning an I2P-only deployment would get all
 * the way to a node that cannot reach anything. A transport this app does
 * not have is worth more words than one it does.
 */
const PREREQ: readonly (readonly [string, string])[] = [
  ["app", "Monero Node v0.18.5.1, by deverickapollo — listed in Umbrel's official store"],
  ["source", "github.com/deverickapollo/umbrel-monero"],
  ["daemon", "ghcr.io/sethforprivacy/simple-monerod:v0.18.5.1"],
  ["network", "mainnet — this is the shared prerequisite, NOT the beta chain"],
  ["its own UI", "port 9976 on your node"],
  ["transports", "Tor is bundled. I2P is NOT — upstream leaves the i2pd daemon commented out, so do not plan around it."],
  ["ports", "configuration, not constants — they are published as APP_MONERO_P2P_PORT and APP_MONERO_RPC_PORT, so read your own app's config rather than copying a number."],
];

/**
 * The maintainer's own words, kept verbatim — including the missing
 * apostrophe in the third — with editorial insertions in [brackets] and
 * nothing else changed.
 *
 * Quoted rather than paraphrased on purpose. A paraphrase of a chat message
 * is a claim this site would be making on somebody else's behalf, and the
 * whole reason these three sentences are load-bearing is that they are the
 * only published answers about a chain whose specification is not published.
 * Where his words stop, this page stops.
 */
const MAINTAINER = {
  reach:
    "superstress is self-hosted, the monero node add[on] exposes 18081 p2p 18083 zmq-pub (for p2pool) 18089 (restricted) and is reachable from lan/tor/tailscale",
  ownNode: "superstress has its own monerod",
  chain: "Its the FCMP++ stressnet/testnet",
} as const;

/**
 * Somebody else's words, marked as theirs.
 *
 * THE QUOTATION IS A `<p>` INSIDE THE `<blockquote>`, and that is load-bearing
 * rather than tidy markup. `styles-legibility.css:51` sets the site's reading
 * measure as `.main p, .panel p, … { max-width: 74ch }` — the L1 layer that
 * exists so no palette rule can override a readability one. A bare
 * `<blockquote>` is not a `<p>`, so the first version of this component escaped
 * that rule entirely and rendered the reachability quote as a SINGLE 1254px
 * line at 1440 — roughly 150 characters, about twice the measure every other
 * paragraph on the page obeys, and wider than the attribution paragraph
 * correcting it. Wrapping the text restores the measure by INHERITING the
 * existing declaration: no new stylesheet rule (cssGz has a 300 B margin) and
 * no second copy of the number 74. Found by measuring computed `max-width`,
 * which read `638.948px` on a sibling paragraph and `none` here.
 */
function Quote({ children }: { children: React.ReactNode }) {
  return (
    <blockquote
      data-maintainer-quote
      className="mono"
      style={{
        margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.7, color: "var(--ink-100)",
        borderLeft: "2px solid var(--g-50)", padding: "4px 0 4px 14px",
      }}
    >
      <p style={{ margin: 0 }}>“{children}”</p>
      <span style={{ display: "block", marginTop: 6, fontSize: "var(--fs-mono)", color: "var(--ink-40)" }}>
        — the Superstress maintainer, asked directly
      </span>
    </blockquote>
  );
}

/** A reserved, labelled box that states what is missing. Never a generated
 *  image, never a shimmer that reads as "loading". */
function EmptySlot({ label, note, h = 120 }: { label: string; note?: string; h?: number }) {
  return (
    <div
      data-empty-slot={label}
      style={{
        border: "1px dashed var(--ink-20)",
        minHeight: h,
        display: "grid",
        placeItems: "center",
        gap: 6,
        padding: "12px 14px",
        textAlign: "center",
        background:
          "repeating-linear-gradient(-45deg, color-mix(in srgb, var(--text-primary) 1.5%, transparent) 0 10px, color-mix(in srgb, var(--text-primary) 4%, transparent) 10px 20px)",
      }}
    >
      <span
        className="mono"
        style={{ fontSize: "var(--fs-label)", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-40)" }}
      >
        {label}
      </span>
      {note ? (
        <span className="mono" style={{ fontSize: "var(--fs-body)", lineHeight: 1.6, color: "var(--ink-60)", maxWidth: "52ch" }}>
          {note}
        </span>
      ) : null}
    </div>
  );
}

export function SuperstressPage() {
  // A Set, not a single key: these five rows are independent readings rather
  // than a menu, so opening one has no reason to shut another. LegalityTab's
  // single-open accordion is the right shape for a filtered list you scan;
  // this is a list you read.
  const [open, setOpen] = React.useState<ReadonlySet<string>>(() => new Set());
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <PageShell width="standard" bg={{ intensity: "calm" }}>
      {/* NO `status` on the crumbs, and that is a fix rather than an omission.
          It first read `${SUPERBRAIN_APPS.length} apps` — the SAME words as
          the header pill three lines below, so the page said "5 APPS" twice
          within 60px, once behind a pulsing LED that implies a live reading
          for a number that is a constant. TrustedPeersPage carries both
          slots legitimately because its two say different things
          ("collaborators" / "partners"); duplicating one string is not that
          pattern. NodePage — this section's other leaf — passes no status at
          all, which is the precedent followed here. Found by looking at the
          render; no gate compares two labels for saying the same thing. */}
      <Crumbs path={R.OPERATE_SUPERSTRESS} />
      <PageHeader
        kicker="Umbrel community app store · sovereignty tooling"
        title='Run the <em style="color:var(--g-50);text-shadow:var(--glow-g);font-style:normal">whole stack</em> yourself.'
        sub="One community app store added to your Umbrel node, five Monero apps that run on your own hardware, and a beta chain you can join. Nothing here is a service; nothing here holds your keys."
        right={<Pill tone="acc" dot>{SUPERBRAIN_APPS.length} apps</Pill>}
      />

      {/* ── 1 · what the store IS ─────────────────────────────────────── */}
      <Card style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="kicker" style={{ color: "var(--g-50)" }}>One add · five apps</div>
        {STORE?.body.map((par, i) => (
          <p key={i} className="mono" style={{ margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.78, color: "var(--ink-80)" }}>
            {par}
          </p>
        ))}
        {STORE?.repo ? (
          <div data-peer-pulse={STORE.repo}>
            <div className="kicker" style={{ marginBottom: 4 }}>Live repo pulse · {STORE.repo}</div>
            <RepoPulseReadout repo={STORE.repo} />
          </div>
        ) : null}
      </Card>

      {/* ── 2 · the five apps ─────────────────────────────────────────── */}
      <section style={{ display: "flex", flexDirection: "column", gap: 8 }} data-superstress-apps={SUPERBRAIN_APPS.length}>
        <div className="kicker">The apps · open any row</div>
        {SUPERBRAIN_APPS.map((a) => {
          const d = APP_DETAIL[a.id];
          // Stated in FULL here, because the trigger row's `meta` chip is
          // dropped at 390px — see the .disc-meta media rule in styles.css.
          const needs = [SUPERBRAIN_SHARED_PREREQ, ...a.prereqs];
          return (
            <Disclosure
              key={a.id}
              id={a.id}
              label={<span style={{ color: "var(--ink-100)" }}>{a.name}</span>}
              summary={a.fn}
              meta={a.prereqs.length ? `+ ${a.prereqs.join(" · ")}` : "monero only"}
              open={open.has(a.id)}
              onToggle={() => toggle(a.id)}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 10 }}>
                {d.what.map((par, i) => (
                  <p key={i} className="mono" style={{ margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.75, color: "var(--ink-80)" }}>
                    {par}
                  </p>
                ))}
                {d.caveat ? (
                  <p
                    data-app-caveat={a.id}
                    className="mono"
                    style={{
                      margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.7, color: "var(--y-50)",
                      border: "1px dashed var(--ink-20)", padding: "10px 12px",
                    }}
                  >
                    {d.caveat}
                  </p>
                ) : null}
                {d.why ? (
                  <p className="mono" style={{ margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.75, color: "var(--ink-100)" }}>
                    <span className="kicker" style={{ display: "block", marginBottom: 4 }}>Why it matters</span>
                    {d.why}
                  </p>
                ) : null}
                <div className="mono" style={{ fontSize: "var(--fs-mono)", color: "var(--ink-60)" }} data-app-needs={a.id}>
                  needs · {needs.join(" · ")}
                </div>
                <EmptySlot label={d.shot} h={110} />
                <a
                  className="mono"
                  href={d.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${a.name} source (opens in a new tab)`}
                  style={{ fontSize: "var(--fs-mono)", color: "var(--g-50)", textDecoration: "none", alignSelf: "flex-start" }}
                >
                  source ↗
                </a>
              </div>
            </Disclosure>
          );
        })}
      </section>

      {/* ── 3 · the install walkthrough ───────────────────────────────── */}
      <Card style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="kicker" style={{ color: "var(--tk-accent)" }}>{INSTALL?.label}</div>
        <p className="mono dim" style={{ margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.7 }}>
          Order matters. The store itself installs nothing on its own — it is a catalogue your
          node reads — so the Monero app goes on first, and the two apps that read Bitcoin chain
          state need Bitcoin and Electrs before they will start.
        </p>
        {INSTALL ? (
          <ol
            data-install-steps={INSTALL.lines.length}
            className="mono"
            style={{ margin: 0, paddingLeft: 22, fontSize: "var(--fs-body)", lineHeight: 1.8, color: "var(--ink-80)" }}
          >
            {INSTALL.lines.map((line, i) => (
              <li key={i} style={{ marginBottom: i === INSTALL.lines.length - 1 ? 0 : 6 }}>{line}</li>
            ))}
          </ol>
        ) : null}
        <div className="mono" style={{ fontSize: "var(--fs-mono)", color: "var(--ink-60)", lineHeight: 1.8 }}>
          <div className="kicker" style={{ marginBottom: 6 }}>Then, per app</div>
          <div>1 · {SUPERBRAIN_SHARED_PREREQ} — every app in the store needs it</div>
          <div>
            2 · Bitcoin + Electrs — only for{" "}
            {SUPERBRAIN_APPS.filter((a) => a.prereqs.length).map((a) => a.name).join(" and ")}
          </div>
          <div>3 · the app itself</div>
        </div>

        {/* ── what step 1 actually is ─────────────────────────────────── */}
        <div>
          <div className="kicker" style={{ marginBottom: 6 }}>What “{SUPERBRAIN_SHARED_PREREQ}” means in step 1</div>
          <p className="mono dim" style={{ margin: "0 0 4px", fontSize: "var(--fs-body)", lineHeight: 1.7 }}>
            One specific app, and it is a <em style={{ fontStyle: "normal", color: "var(--ink-100)" }}>mainnet</em> node.
            Installing it does not put you on the beta chain — Superstress brings its own daemon for
            that. Getting this step wrong is the one mistake that costs you an afternoon.
          </p>
          <div
            data-prereq-identity={PREREQ.length}
            className="mono"
            style={{ fontSize: "var(--fs-mono)", color: "var(--ink-80)", lineHeight: 1.7 }}
          >
            {PREREQ.map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: "flex", gap: 12, flexWrap: "wrap",
                  borderTop: "1px dashed var(--ink-10)", paddingTop: 7, marginTop: 7,
                }}
              >
                <span
                  style={{
                    flex: "0 0 auto", minWidth: 84, color: "var(--ink-40)",
                    fontSize: "var(--fs-label)", letterSpacing: "0.12em", textTransform: "uppercase",
                  }}
                >
                  {k}
                </span>
                <span style={{ flex: "1 1 16rem" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
        {MINER_CMD ? (
          <div>
            <div className="kicker" style={{ marginBottom: 8 }}>Point external miners at Superbrain</div>
            <code
              className="mono"
              style={{
                display: "block", fontSize: "var(--fs-mono)", color: "var(--ink-100)",
                background: "var(--bg-2)", border: "1px solid var(--rule)", padding: "8px 12px",
                overflowWrap: "anywhere",
              }}
            >
              {MINER_CMD}
            </code>
          </div>
        ) : null}

        {/* ── reachability, in the maintainer's own words ──────────────── */}
        {/* EVERY PORT NUMBER ON THIS PAGE LIVES INSIDE `[data-ports]`, with
            its attribution in the same box. The quote says "18081 p2p", and
            mainnet convention says 18080 — so a reader who trusts the number
            without the paragraph beside it has a node that will not connect.
            Splitting the two across a scroll is the failure; keeping them in
            one container is what verify-superstress §6 asserts. */}
        <div data-ports>
          <div className="kicker" style={{ marginBottom: 8 }}>Reaching it once it runs</div>
          <Quote>{MAINTAINER.reach}</Quote>
          <p
            data-port-attribution
            className="mono"
            style={{
              margin: "10px 0 0", fontSize: "var(--fs-body)", lineHeight: 1.7, color: "var(--y-50)",
              border: "1px dashed var(--ink-20)", padding: "10px 12px",
            }}
          >
            Those are the <strong>Monero node addon&rsquo;s</strong> ports — the mainnet
            prerequisite above — and not Superstress&rsquo;s own. Superstress runs its own
            monerod, and its ports are not documented anywhere this site can cite. Read yours
            off your own app&rsquo;s configuration rather than copying them: upstream publishes
            them as variables rather than fixed numbers, and mainnet convention puts
            peer-to-peer traffic on 18080 with 18081 the unrestricted RPC — so treat the line
            above as one operator describing his own box, not as a config to paste.
          </p>
        </div>
        <p className="mono" style={{ margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.78, color: "var(--ink-80)" }}>
          The three routes he names are the three you would expect from hardware you own: the LAN
          for a machine in the same building, Tailscale for one that is not, and Tor for reaching
          it without either end publishing where it is. None of the three is a service, and all
          three terminate on your box — which is also the reason this page cannot show you what
          they return. See below.
        </p>
      </Card>

      {/* ── 4 · the deep dive ─────────────────────────────────────────── */}
      <Card style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="kicker" style={{ color: "var(--g-50)" }}>The Superstress net · what it is, from zero</div>
        <h2 className="serif" style={{ margin: 0, fontSize: "var(--fs-h2)", fontWeight: 400, color: "var(--ink-100)" }}>
          A chain that exists to be broken.
        </h2>
        <p className="mono" style={{ margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.78, color: "var(--ink-80)" }}>
          A <em style={{ fontStyle: "normal", color: "var(--g-50)" }}>stressnet</em> is a copy of the
          network that carries no real money and is deliberately abused. It runs the same software
          as the real chain and is fed traffic no ordinary day would produce — floods of
          transactions, blocks pushed to their size limits, proofs verified faster than any wallet
          would ask. The point is to find the breaking point somewhere it costs nothing.
        </p>
        <p className="mono" style={{ margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.78, color: "var(--ink-80)" }}>
          It runs BEFORE a hard fork because a hard fork is not reversible. Once the network
          adopts new consensus rules, every node either follows them or leaves; there is no
          staging environment and no rollback. So the new rules get their punishment in advance,
          on a chain where a crash is a bug report rather than an outage.
        </p>
        <p className="mono" style={{ margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.78, color: "var(--ink-80)" }}>
          What is being punished here is {FCMP?.tag} — {FCMP?.sub.toLowerCase()} — which replaces the
          ring signature with a proof over the whole chain. It is scheduled for{" "}
          <span className="acc" data-fcmp-eta>{FCMP?.eta}</span>, and that figure is read from the
          protocol card on <Link className="mono" to={R.FUTURE} style={{ color: "var(--tk-accent)" }}>the roadmap</Link>{" "}
          rather than restated here, so the two can never disagree.
        </p>
        <p className="mono" style={{ margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.78, color: "var(--ink-80)" }}>
          The <em style={{ fontStyle: "normal", color: "var(--g-50)" }}>wallet lab</em> is the other
          half of the Superstress app. A consensus change breaks wallets as readily as nodes, and a
          wallet author needs somewhere to build a transaction under the new rules and watch what
          happens to it. Tor routing matters for the same reason it matters on mainnet: a node
          announces itself to its peers, and on a small beta network with few participants the set
          of addresses is small enough to be worth writing down. Routing through Tor means joining
          the experiment does not also publish where you are.
        </p>
        <p
          data-embargo="chain-params"
          className="mono"
          style={{
            margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.7, color: "var(--y-50)",
            border: "1px dashed var(--ink-20)", padding: "12px 14px",
          }}
        >
          What this page does NOT tell you: this chain's own parameters — whether it is a separate
          network or a fork of an existing testnet, its genesis, its block target, its difficulty
          — are not documented anywhere we can cite. We have asked. Until there is an answer, the
          honest version is that the node software is public and the chain's specification is not.
        </p>
        {/* Every destination here is a REAL route or a registered simulator
            id — deliberately no `/future#<id>` fragment. #184 measured that
            all four partner `/future#…` palette anchors are hollow: /future
            renders no panel any of them can scroll to. A fifth hollow anchor
            would be this page propagating a recorded defect, so the roadmap
            link goes to /future itself and says so. */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} data-crosslinks>
          <Link className="v6-res" to={`${R.LEARN_SIM}?p=stressnet`}>
            <span className="led" style={{ background: "var(--g-50)", boxShadow: "0 0 6px var(--g-50)" }} />
            Run the stressnet simulator →
          </Link>
          <Link className="v6-res" to={R.FUTURE}>
            <span className="led" style={{ background: "var(--tk-accent)", boxShadow: "0 0 6px var(--tk-accent)" }} />
            {FCMP?.tag} on the roadmap →
          </Link>
          <Link className="v6-res" to={R.OPERATE_PEERS}>
            <span className="led" style={{ background: "var(--p-50)", boxShadow: "0 0 6px var(--p-50)" }} />
            Trusted peers →
          </Link>
          <Link className="v6-res" to={R.OPERATE_NODE}>
            <span className="led" style={{ background: "var(--c-50)", boxShadow: "0 0 6px var(--c-50)" }} />
            Run a mainnet node →
          </Link>
        </div>
      </Card>

      {/* ── 5 · asked and answered ────────────────────────────────────── */}
      {/* This section used to be a 220px reserved box waiting for a public
          telemetry endpoint. The question behind it has been answered, so the
          box is gone and the answer is here instead — including the part that
          says no such panel will ever exist on this site, which is the whole
          reason to write it down rather than quietly delete a placeholder. */}
      <Card style={{ padding: 22 }}>
        <div data-betanet-answer style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div className="kicker" style={{ color: "var(--g-50)" }}>The betanet panel · asked and answered</div>
            <Pill tone="live">self-hosted by design</Pill>
          </div>

          <h2 className="serif" style={{ margin: 0, fontSize: "var(--fs-h2)", fontWeight: 400, color: "var(--ink-100)" }}>
            What you have at the end.
          </h2>
          <p className="mono" style={{ margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.78, color: "var(--ink-80)" }}>
            An Umbrel node running the mainnet Monero app, and beside it a Superstress node with
            its own daemon on the FCMP++ beta chain — reachable from your LAN, over Tailscale, or
            through Tor, because it is yours. MoneroSpace points at that chain from the same app
            store. What you get is not a dashboard someone else operates: it is a participant on a
            small network that is worth more the more independent participants it has.
          </p>

          <div className="kicker" style={{ marginTop: 2 }}>We asked. This is what came back.</div>
          <Quote>{MAINTAINER.ownNode}</Quote>
          <Quote>{MAINTAINER.chain}</Quote>

          <p data-answered className="mono" style={{ margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.78, color: "var(--ink-100)" }}>
            So the question this section used to hold space for has an answer, and the answer is
            no. There is no public endpoint for the beta chain, none is planned, and the chain is
            self-hosted by design rather than by delay. Nothing is being waited for here.
          </p>
          <p className="mono" style={{ margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.78, color: "var(--ink-80)" }}>
            That is the better answer, not a smaller one. A public endpoint would have been one
            machine everybody reads — a party to trust and a single point of failure, on a chain
            whose entire purpose is to be attacked. Self-hosted-only means every participant reads
            their own node and no one operator can misreport the network to everyone at once. It
            is the argument this site makes about mainnet, applied to the chain that tests it.
          </p>

          <p
            data-no-live-panel
            className="mono"
            style={{
              margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.7, color: "var(--y-50)",
              border: "1px dashed var(--ink-20)", padding: "12px 14px",
            }}
          >
            Why this page will never show you a live beta-chain panel: its content-security policy
            is <code>connect-src &lsquo;self&rsquo;</code>, so the browser is not permitted to
            contact any origin but this one — which is what keeps the site safe to read over Tor,
            and is not a setting we would relax for a chart. And your node sits on your LAN, your
            Tailnet, or an onion address; none of those are ours to reach, and proxying them
            through this site would put us between you and your own machine. There is no path from
            here to your beta chain, by design rather than by omission.
          </p>

          {/* The rule is written down BEFORE there is anything to apply it to,
              so a later change inherits it instead of re-deciding it. #184's
              hollow-anchor family: a convention nobody recorded is a
              convention the next PR invents from scratch. */}
          <p data-betanet-rule className="mono dim" style={{ margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.7 }}>
            And if beta-chain data ever does land on this site, it inherits a rule set down here
            before there was anything to apply it to: it ships behind a persistent{" "}
            <span className="mono" style={{ color: "var(--y-50)" }}>BETANET · NOT MAINNET · TEST FUNDS ONLY</span>{" "}
            banner, in an accent used nowhere else, carrying its own provenance badge — never
            sharing a colour, a badge or a panel with mainnet numbers.
          </p>

          <p className="mono dim" style={{ margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.7 }}>
            {CHAIN?.blurb}
          </p>
        </div>
      </Card>
    </PageShell>
  );
}
