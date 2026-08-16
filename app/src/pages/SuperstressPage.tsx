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
 *     READ from FUTURE_PROTOCOLS rather than retyped.
 *
 * ── THE BETANET SLOT IS A RESERVED BOX THAT NAMES ITS OWN ABSENCE ────────
 * It is not a placeholder dressed up as a feature. There is no public
 * telemetry endpoint for the beta chain, and whether one exists at all is an
 * open question — so the slot says that, in the same words the automation
 * registry already uses. Its height is reserved so the day it is filled costs
 * no layout shift.
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
          <Link className="v6-res" to={R.ABOUT_PEERS}>
            <span className="led" style={{ background: "var(--p-50)", boxShadow: "0 0 6px var(--p-50)" }} />
            Trusted peers →
          </Link>
          <Link className="v6-res" to={R.OPERATE_NODE}>
            <span className="led" style={{ background: "var(--c-50)", boxShadow: "0 0 6px var(--c-50)" }} />
            Run a mainnet node →
          </Link>
        </div>
      </Card>

      {/* ── 5 · the betanet slot ──────────────────────────────────────── */}
      <Card style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div className="kicker" style={{ color: "var(--y-50)" }}>Beta-chain mempool · reserved</div>
          <Pill tone="warn">not wired</Pill>
        </div>
        {/* The box is RESERVED at its final height so the day it is filled
            costs no layout shift — the CLS discipline applied forward rather
            than retrofitted. The words are the automation registry's own:
            "repo pulse live · telemetry endpoint still pending". */}
        <EmptySlot
          label="beta-chain mempool · to be wired"
          note="Awaiting a public telemetry endpoint for the beta chain — whether one exists is an open question with the maintainer. This box is reserved rather than filled: a mempool drawn from mainnet data and labelled as the beta chain would be a fabricated reading, and this site does not ship one."
          h={220}
        />
        <p className="mono dim" style={{ margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.7 }}>
          {CHAIN?.blurb}
        </p>
      </Card>
    </PageShell>
  );
}
