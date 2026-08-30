/**
 * pages/FuturePage.tsx — the FUTURE surface (/future).
 *
 * Roadmap rail → three BANDS of protocol cards, each card opening an expansive
 * pop-up (deep copy, metrics, animated mini-viz, live GitHub pulse, community
 * resources, jump-to-simulator) → the live news surface → the data-automation
 * registry.
 *
 * p4·M5 replaced one flat five-card grid with the bands, because the five are
 * not equals: `next` (riding the fork the rail marks NEXT), `live` (shipped
 * something runnable, and sharing its band with the Umbrel stressnet card),
 * and `horizon` (later forks). All three memberships are DERIVED — see
 * splitProtocols() below — so no list here can disagree with the rail or with
 * a card's own copy. Section order is pinned by `data-future-section` markers,
 * read in document order by verify-future; without them a permutation of this
 * file shipped green through every gate in CI.
 *
 * v6.0.1: every repo/issue/announcement number on this page is real, fetched
 * once per source per 24h through the same-origin /api/feeds proxy. The five
 * protocol cards ping their repos on mount, so the grid carries live signal
 * without anyone opening a modal.
 *
 * Replaces the static /monero/future tab, which redirected here in v6.0.1.
 */

import * as React from "react";
import { flushSync } from "react-dom";

import { PageShell } from "@/layout/PageShell";
import { PageHeader } from "@/layout/AppShell";
import { Card, Crumbs, Pill } from "@/design/primitives";
import { startVt } from "@/design/viewTransition";
import { FUTURE_PROTOCOLS, ECOSYSTEM, ROADMAP, AUTOMATION_ROWS, DEV_LAB_PULSES, roadmapStatus, type FutureProtocol } from "./future/data";
import { ProtocolCard, DevLabPulseCard, MoneroNewsCard } from "./future/cards";
import { ProtoPopup } from "./future/ProtoPopup";
import { EcoPopup } from "./future/EcoPopup";
import { R } from "../../scripts/routes.mjs";

/**
 * p4·M5 — THE THREE BANDS, DERIVED RATHER THAN LISTED.
 *
 * The page used to render all five protocol cards as one flat grid of equals.
 * They are not equals: two ride the next hard fork, one has shipped something
 * a reader can run today, and two are later forks. A flat grid says none of
 * that, and at 1440 it also laid out 4-across-then-1 — a widow card, measured,
 * which is a large part of why the page read as scattered.
 *
 * NOTHING HERE IS A HARDCODED ID LIST, deliberately. This file has no business
 * holding a second opinion about which protocol ships when:
 *   · "landing next" is exactly the membership of the roadmap stop already
 *     flagged `on: true` — the rail's own NEXT marker. Change the rail and
 *     this grid follows.
 *   · "live to try" is exactly the protocols carrying a `live` sentence, so
 *     the band and the sentence it prints cannot disagree.
 *   · "further out" is everything else, so the three bands PARTITION
 *     FUTURE_PROTOCOLS by construction — no card can be dropped by a future
 *     edit, and none can appear twice.
 * `next` wins over `live` when a protocol is both, because a fork that is
 * landing is the more urgent fact about it.
 */
function splitProtocols() {
  const nextStop = ROADMAP.find((s) => s.on && "protocols" in s);
  const nextIds = new Set<string>(nextStop && "protocols" in nextStop ? nextStop.protocols : []);
  const next = FUTURE_PROTOCOLS.filter((p) => nextIds.has(p.id));
  const rest = FUTURE_PROTOCOLS.filter((p) => !nextIds.has(p.id));
  return { next, live: rest.filter((p) => p.live), horizon: rest.filter((p) => !p.live) };
}

/**
 * One band of protocol cards.
 *
 * The grid stays an INLINE `gridTemplateColumns` on `.v6-proto-grid`, which is
 * a bare hook class with no stylesheet rule of its own. That is load-bearing
 * rather than lazy: styles.css's ≤768 layer collapses any element carrying an
 * inline `grid-template-columns` to one column, so the phone composition comes
 * from the same mechanism that has been shipping it, unchanged, and this
 * release adds no stylesheet rule at all.
 *
 * `minWidth: 0` on the stagger wrapper is a FIX, not decoration. The wrapper is
 * the grid item, its default `min-width: auto` resolves to min-content, and in
 * the feed-failure state each card contains an unbreakable ~60-character
 * `/api/feeds?src=ghrepo&repo=…` string. Measured on the untouched base at
 * 1440: the wrappers rendered 320-411px inside 315px tracks and `main.main`
 * grew a 17px horizontal scroll — only when the proxy was down, which is the
 * state real visitors are in whenever it is.
 */
function ProtocolBand({ items, kicker, note, section, onOpen, morph, popup }: {
  items: readonly FutureProtocol[];
  kicker: string;
  note?: string;
  section: string;
  onOpen: (id: string) => void;
  morph: string | null;
  popup: string | null;
}) {
  if (items.length === 0) return null;
  return (
    <section data-future-section={section}>
      <div className="kicker" style={{ marginBottom: note ? 4 : 10 }}>{kicker}</div>
      {note ? <p className="mono dim" style={{ margin: "0 0 12px", fontSize: "var(--fs-body)" }}>{note}</p> : null}
      <div className="v6-proto-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 14 }}>
        {items.map((p, i) => (
          <div key={p.id} className="v6-stagger" style={{ ["--stagger-i" as never]: String(i), minWidth: 0 }}>
            <ProtocolCard p={p} onOpen={() => onOpen(p.id)} morphed={morph === p.id && popup !== p.id} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function FuturePage() {
  const [popup, setPopup] = React.useState<string | null>(null); // protocol id
  const [eco, setEco] = React.useState<string | null>(null); // ecosystem id
  // §6 shared-element morph (design/viewTransition.ts's contract). Names the
  // ONE protocol id, if any, currently morphing between its card <h3> and
  // its popup <h2> — never both surfaces at once (a duplicate
  // view-transition-name in one DOM snapshot aborts the whole transition).
  // See openProtocol/closeProtocol below and the `morphed` props passed to
  // ProtocolCard/ProtoPopup for how exactly one side holds it at a time.
  const [morph, setMorph] = React.useState<string | null>(null);
  const openP = FUTURE_PROTOCOLS.find((p) => p.id === popup);
  const openE = ECOSYSTEM.find((e) => e.id === eco);
  // Pure function of two module constants, so it is computed once rather than
  // per render — and never memoised on state it does not read.
  const bands = React.useMemo(splitProtocols, []);

  // D0666 — the popups are no longer unmounted on close. V6Modal now plays an
  // exit before it removes itself, and it cannot do that if the component
  // rendering it has already been torn down. So the page RETAINS whichever
  // entry was last opened and flips `open` instead: the dialog keeps its own
  // content for the whole exit rather than blanking to an empty box mid-fade.
  //
  // Refs, not state, on purpose — this is a render-time cache of a value
  // derived from `popup`/`eco`, and writing to it changes nothing about what
  // renders NOW (`open` already carries that). Making it state would schedule
  // a second render per open for no observable difference.
  //
  // The retained component stays mounted for the rest of the page's life,
  // which costs nothing: <V6Modal> returns null once `present` drops, so none
  // of the popup's children — including FutureMini's canvas — are ever
  // mounted while closed, and ProtoPopup's own useRepoPulse reads the same
  // 24h cache the card already filled (no extra /api/feeds request; see
  // verify-future.mjs's assertion 17, which counts them).
  const lastP = React.useRef<typeof openP>(undefined);
  const lastE = React.useRef<typeof openE>(undefined);
  if (openP) lastP.current = openP;
  if (openE) lastE.current = openE;
  const shownP = openP ?? lastP.current;
  const shownE = openE ?? lastE.current;

  const openProtocol = React.useCallback((id: string) => {
    // Two-phase: at the moment startVt captures the "old" snapshot the
    // modal does not exist yet, so the name has to land on the CARD's <h3>
    // FIRST — flushSync, because a plain setState would not have committed
    // before startVt reads the DOM — and only then does the transition's
    // own update swap `popup`, which is what mounts <ProtoPopup> and moves
    // the name onto its <h2> (see the `morphed` props below).
    flushSync(() => setMorph(id));
    startVt("modal", undefined, () => flushSync(() => setPopup(id)))
      // Clears once the OPEN transition truly settles, not immediately —
      // the modal stays named for the whole entrance animation, then loses
      // it, so a popup just sitting open carries no stale
      // view-transition-name (verify-motion.mjs's "lingering-name"
      // assertion checks exactly this).
      .then(() => setMorph((m) => (m === id ? null : m)));
  }, []);

  const closeProtocol = React.useCallback(() => {
    // Both cleared in the SAME synchronous update: whichever of {card,
    // modal} held the name at close time simply loses it (a name present in
    // the "old" snapshot with no match in "new" is a well-defined exit, not
    // a duplicate), rather than handing it back to the card for a reverse
    // morph — this feature is card→modal only, per §6's title.
    startVt("modal", undefined, () => flushSync(() => { setPopup(null); setMorph(null); }));
  }, []);

  return (
    <PageShell width="wide" bg={{ intensity: "busy" }}>
      <Crumbs path={R.FUTURE} status="FCMP++ stressnet live" />
      <PageHeader
        kicker="Roadmap · what is landing, what runs today, what comes after"
        title='The protocol is <em style="color:var(--p-50);text-shadow:var(--glow-soft-p);font-style:normal">still being forged</em>.'
        sub="Open any protocol for the deep dive — status, math, simulators, and the canonical community sources it stays synced against."
        right={<><Pill tone="acc" dot>{FUTURE_PROTOCOLS.length} protocols</Pill><Pill>1 live beta</Pill></>}
      />

      {/* roadmap rail — KEPT as the section landing. It is the spine every
          band below hangs off, and the "landing next" band derives its
          membership from the stop marked NEXT here. */}
      <div className="v6-rail" data-future-section="rail">
        {ROADMAP.map((r) => (
          <div key={r.v} className="stop" style={{ ["--node-c" as never]: r.c }}>
            <div className="mono" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.2em", color: r.c, textShadow: `0 0 8px ${r.c}66` }}>{r.v}{r.on ? " ● NEXT" : ""}</div>
            <div className="serif" style={{ fontSize: "clamp(15px, 1.15vw, 20px)", color: "var(--ink-100)", marginTop: 3 }}>{r.t}</div>
            <div className="mono dim2" style={{ fontSize: "var(--fs-label)", marginTop: 2, letterSpacing: "0.06em", textTransform: "uppercase" }}>{roadmapStatus(r)}</div>
          </div>
        ))}
      </div>

      {/* BAND 1 · what is landing next — derived from the rail's NEXT stop.
          D0661: each card is wrapped in `.v6-stagger`, which is what carries
          the entrance animation (styles.css) and the 0-based index it reads
          as --stagger-i. The wrapper exists because neither obvious hook
          works: ProtocolCard's inner `.v6-future-card` is `display: contents`
          (no box at all) and the card's own `.panel` already has its
          `animation` slot taken by the ambient breathe, which styles-theme.css
          then rebinds per theme at a specificity nothing here could beat
          without deleting it. Full reasoning at the CSS rule. The wrapper is
          `display: grid`, so it takes over as the grid item and the card
          stretches inside it exactly as it did when it WAS the grid item.
          All of that now lives in <ProtocolBand> above, which the three bands
          share — the wrapper, the index and the grid are written once. */}
      <ProtocolBand
        section="next" items={bands.next} onOpen={openProtocol} morph={morph} popup={popup}
        kicker="Landing next · one hard fork"
        note="FCMP++ and Carrot activate together. The working plan for the release is titled FCMP++/Carrot and merges both before a single activation task."
      />

      {/* BAND 2 · what a reader can run today. The stressnet band leads it
          because the beta chain is the thing this page is about being able to
          touch, and any protocol carrying a `live` sentence joins it below.

          The band stays a TOP-LEVEL <Card> and is deliberately NOT nested
          inside another Card: three gate call sites locate it with
          `.panel` filtered on its text and take `.first()`, which resolves
          against an ancestor chain and would break on a nested panel. */}
      <div data-future-section="live" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="kicker">Live to try · running today</div>

      {/* stressnet hero band */}
      <Card onClick={() => setEco("stressnet")} style={{ padding: "26px 30px", display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 28, alignItems: "center", borderColor: "color-mix(in srgb, var(--status-up) 35%, transparent)" }}>
        <div style={{ width: 64, height: 64, border: "1px solid var(--g-50)", display: "grid", placeItems: "center", boxShadow: "var(--glow-g)", borderRadius: 2 }}>
          <span className="mono" style={{ color: "var(--g-50)", fontSize: 22, textShadow: "var(--glow-g)" }}>β</span>
        </div>
        <div>
          <div className="kicker" style={{ color: "var(--g-50)" }}>Live now · community FCMP++ beta · Umbrel apps</div>
          {/* "Umbrel superstress net" must stay contiguous here —
              verify-sims.mjs finds this band by that text to open the
              stressnet simulator. HONOURED, WITH A CORRECTION: verify-sims is
              an ORPHAN, wired to neither npm nor CI, so nothing actually
              enforces this today. The constraint is real (that gate is one
              wiring away from running) and the enforcement claim was not —
              keep the phrase contiguous, and do not read this comment as
              "a gate has my back". */}
          <div className="serif" style={{ fontSize: "clamp(20px, 1.7vw, 30px)", color: "var(--ink-100)", margin: "6px 0 4px" }}>
            The Umbrel <em style={{ fontStyle: "normal", color: "var(--g-50)", textShadow: "var(--glow-g)" }}>superstress net</em> is hammering FCMP++ before it reaches mainnet.
          </div>
          {/* Names MoneroSpace, claims nothing about where it came from. */}
          <p className="mono dim" style={{ margin: 0, fontSize: "var(--fs-body)" }}>Storm campaigns · dynamic block size under load · proof-verification pressure — with MoneroSpace, the beta chain&apos;s visual mempool, in the same Umbrel app repo. The chain is self-hosted — every node on it is somebody&apos;s own box.</p>
        </div>
        <span className="open-cue mono" style={{ opacity: 1, color: "var(--g-50)", fontSize: "var(--fs-mono)" }}>open window →</span>
      </Card>

        {/* …and any protocol that has shipped something runnable. Today that
            is Cuprate, and it is here rather than under "further out" because
            a beta preview a reader can point a wallet at is not a horizon
            item. It arrives here by carrying a `live` sentence, not by being
            named. */}
        <ProtocolBand
          section="live-protocols" items={bands.live} onOpen={openProtocol} morph={morph} popup={popup}
          kicker="…and one you can run on mainnet today"
        />
      </div>

      {/* BAND 3 · later forks. */}
      <ProtocolBand
        section="horizon" items={bands.horizon} onOpen={openProtocol} morph={morph} popup={popup}
        kicker="Further out · later forks"
      />

      {/* Trusted peers live on their own page (/peers) */}

      {/* fork status / ETAs / dev labs · live, 24h-cached */}
      <div data-future-section="news">
        <MoneroNewsCard />
      </div>

      {/* data automation registry */}
      <div data-future-section="automation">
      <Card style={{ padding: 22 }}>
        <div className="kicker" style={{ marginBottom: 12 }}>Automation · how this tab stays current</div>

        {/* dev-lab pulse — always-on, not gated behind a click */}
        {/* Four repos, one /api/feeds request each per visitor per 24h.
            .col-2 renders 2×2 here and stacks 1-up at ≤768px. Each row
            reports push age and issue age SEPARATELY — research-lab is
            push-quiet and issue-active at the same time, and one combined
            badge used to report that as a dead repo. */}
        <div className="col-2" style={{ gap: 10, marginBottom: 16 }}>
          {DEV_LAB_PULSES.map((p) => <DevLabPulseCard key={p.repo} {...p} />)}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "8px 28px" }} className="mono">
          {AUTOMATION_ROWS.map((row) => (
            <div key={row.k} style={{ display: "flex", flexDirection: "column", gap: 2, borderTop: "1px dashed var(--ink-10)", paddingTop: 8 }}>
              <span style={{ fontSize: "var(--fs-label)", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-40)" }}>{row.k}</span>
              <span style={{ fontSize: "var(--fs-mono)", color: "var(--ink-80)" }}>{row.src}</span>
              <span style={{ fontSize: "var(--fs-mono)", color: row.tone === "live" ? "var(--g-50)" : "var(--y-50)" }}>{row.mode}</span>
            </div>
          ))}
        </div>
      </Card>
      </div>

      {shownP ? <ProtoPopup p={shownP} open={!!openP} onClose={closeProtocol} morphed={morph === shownP.id} /> : null}
      {shownE ? <EcoPopup e={shownE} open={!!openE} onClose={() => setEco(null)} /> : null}
    </PageShell>
  );
}
