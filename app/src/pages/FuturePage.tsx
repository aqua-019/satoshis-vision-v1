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

import { AppShell, PageHeader } from "@/layout/AppShell";
import { Card, Crumbs, Pill } from "@/design/primitives";
import { FUTURE_PROTOCOLS, ECOSYSTEM, ROADMAP, AUTOMATION_ROWS } from "./future/data";
import { ProtocolCard, DevLabPulseCard, MoneroNewsCard } from "./future/cards";
import { ProtoPopup } from "./future/ProtoPopup";
import { EcoPopup } from "./future/EcoPopup";

export function FuturePage() {
  const [popup, setPopup] = React.useState<string | null>(null); // protocol id
  const [eco, setEco] = React.useState<string | null>(null); // ecosystem id
  const openP = FUTURE_PROTOCOLS.find((p) => p.id === popup);
  const openE = ECOSYSTEM.find((e) => e.id === eco);

  return (
    <AppShell hideRail bg={{ intensity: "busy" }}>
      <div style={{ padding: "28px var(--pad-page) 64px", display: "flex", flexDirection: "column", gap: 34, maxWidth: 1720, margin: "0 auto", width: "100%" }}>
        <Crumbs items={["xmr.irish", "v6.0", "future"]} status="FCMP++ stressnet live" />
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
              <div className="mono dim2" style={{ fontSize: "var(--fs-label)", marginTop: 2, letterSpacing: "0.06em", textTransform: "uppercase" }}>{r.d}</div>
            </div>
          ))}
        </div>

        {/* five protocol cards — each pings its own repo on mount */}
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 14 }}>
          {FUTURE_PROTOCOLS.map((p) => <ProtocolCard key={p.id} p={p} onOpen={() => setPopup(p.id)} />)}
        </section>

        {/* stressnet hero band */}
        <Card onClick={() => setEco("stressnet")} style={{ padding: "26px 30px", display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 28, alignItems: "center", borderColor: "rgba(74,222,128,0.35)" }}>
          <div style={{ width: 64, height: 64, border: "1px solid var(--g-50)", display: "grid", placeItems: "center", boxShadow: "var(--glow-g)", borderRadius: 2 }}>
            <span className="mono" style={{ color: "var(--g-50)", fontSize: 22, textShadow: "var(--glow-g)" }}>β</span>
          </div>
          <div>
            <div className="kicker" style={{ color: "var(--g-50)" }}>Live now · community FCMP++ beta · friend of the site</div>
            <div className="serif" style={{ fontSize: "clamp(20px, 1.7vw, 30px)", color: "var(--ink-100)", margin: "6px 0 4px" }}>
              The Umbrel <em style={{ fontStyle: "normal", color: "var(--g-50)", textShadow: "var(--glow-g)" }}>superstress net</em> is hammering FCMP++ — with this site&apos;s V4 mempool watching it live.
            </div>
            <p className="mono dim" style={{ margin: 0, fontSize: "var(--fs-body)" }}>Storm campaigns · dynamic block size under load · the first FCMP++ chain with a visual mempool. Screenshots + endpoints landing soon.</p>
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
          <div className="col-2" style={{ gap: 10, marginBottom: 16 }}>
            <DevLabPulseCard repo="monero-project/monero" label="Core client" />
            <DevLabPulseCard repo="monero-project/research-lab" label="MRL · research issues" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px 28px" }} className="mono">
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

      {openP ? <ProtoPopup p={openP} onClose={() => setPopup(null)} /> : null}
      {openE ? <EcoPopup e={openE} onClose={() => setEco(null)} /> : null}
    </AppShell>
  );
}
