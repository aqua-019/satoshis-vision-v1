/**
 * pages/FuturePage.tsx — the FUTURE surface (/future).
 *
 * Roadmap rail → five incoming-protocol cards, each opening an expansive
 * pop-up (deep copy, metrics, animated mini-viz, live GitHub pulse, community
 * resources, jump-to-simulator) → the Umbrel stressnet band → the live news
 * surface → the data-automation registry.
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
import { FUTURE_PROTOCOLS, ECOSYSTEM, ROADMAP, AUTOMATION_ROWS, DEV_LAB_PULSES, roadmapStatus } from "./future/data";
import { ProtocolCard, DevLabPulseCard, MoneroNewsCard } from "./future/cards";
import { ProtoPopup } from "./future/ProtoPopup";
import { EcoPopup } from "./future/EcoPopup";
import { R } from "../../scripts/routes.mjs";

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
        kicker="Roadmap · five incoming upgrades · one live beta chain"
        title='The protocol is <em style="color:var(--p-50);text-shadow:var(--glow-soft-p);font-style:normal">still being forged</em>.'
        sub="Click any protocol for the deep dive — status, math, simulators, and the canonical community sources it stays synced against."
        right={<><Pill tone="acc" dot>{FUTURE_PROTOCOLS.length} protocols</Pill><Pill>1 live beta</Pill></>}
      />

      {/* roadmap rail */}
      <div className="v6-rail">
        {ROADMAP.map((r) => (
          <div key={r.v} className="stop" style={{ ["--node-c" as never]: r.c }}>
            <div className="mono" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.2em", color: r.c, textShadow: `0 0 8px ${r.c}66` }}>{r.v}{r.on ? " ● NEXT" : ""}</div>
            <div className="serif" style={{ fontSize: "clamp(15px, 1.15vw, 20px)", color: "var(--ink-100)", marginTop: 3 }}>{r.t}</div>
            <div className="mono dim2" style={{ fontSize: "var(--fs-label)", marginTop: 2, letterSpacing: "0.06em", textTransform: "uppercase" }}>{roadmapStatus(r)}</div>
          </div>
        ))}
      </div>

      {/* five protocol cards — each pings its own repo on mount.
          D0661: each card is wrapped in `.v6-stagger`, which is what carries
          the entrance animation (styles.css) and the 0-based index it reads
          as --stagger-i. The wrapper exists because neither obvious hook
          works: ProtocolCard's inner `.v6-future-card` is `display: contents`
          (no box at all) and the card's own `.panel` already has its
          `animation` slot taken by the ambient breathe, which styles-theme.css
          then rebinds per theme at a specificity nothing here could beat
          without deleting it. Full reasoning at the CSS rule. The wrapper is
          `display: grid`, so it takes over as the grid item and the card
          stretches inside it exactly as it did when it WAS the grid item. */}
      <section className="v6-proto-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 14 }}>
        {FUTURE_PROTOCOLS.map((p, i) => (
          <div key={p.id} className="v6-stagger" style={{ ["--stagger-i" as never]: String(i) }}>
            <ProtocolCard
              p={p}
              onOpen={() => openProtocol(p.id)}
              morphed={morph === p.id && popup !== p.id}
            />
          </div>
        ))}
      </section>

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

      {/* Trusted peers live on their own page (/peers) */}

      {/* fork status / ETAs / dev labs · live, 24h-cached */}
      <MoneroNewsCard />

      {/* data automation registry */}
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

      {shownP ? <ProtoPopup p={shownP} open={!!openP} onClose={closeProtocol} morphed={morph === shownP.id} /> : null}
      {shownE ? <EcoPopup e={shownE} open={!!openE} onClose={() => setEco(null)} /> : null}
    </PageShell>
  );
}
