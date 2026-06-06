/**
 * pages/NetworkPage.tsx — NEW surface (the skeleton had no Network page).
 *
 * Typed SHELL with correct chrome. Port the body from the authoritative source
 * (the file the live index.html loads):
 *   UPDATED-additions/app01-source/network.jsx
 *   UPDATED-additions/app01-source/tilt-card.jsx          (mouse-reactive panels)
 * NOTE: app01-source/markets-network.jsx is a SUPERSEDED earlier combined
 *   file — NOT loaded by index.html. Port from network.jsx, not it.
 *
 * The source renders: hashrate + difficulty curves, pool distribution with HHI
 * decentralization index, live peer table (geo + latency + version), and recent
 * blocks. Everything reads from `useMoneroLive()`.
 *
 * Visual target: screenshots/08-network.png
 */

import * as React from "react";
import { AppShell, PageHeader } from "@/layout/AppShell";
import { Card, Crumbs } from "@/design/primitives";
import { useMoneroLive } from "@/data/DataContext";
import { fmtN } from "@/data/types";

export function NetworkPage() {
  const data = useMoneroLive();
  return (
    <AppShell active="network" data={data} bg={{ intensity: "calm" }}>
      <div style={{ padding: "32px 48px 48px", display: "flex", flexDirection: "column", gap: 28, maxWidth: 1400, margin: "0 auto", width: "100%" }}>
        <Crumbs items={["xmr.irish", "v5.0", "network"]} />
        <PageHeader
          kicker="Hashrate · pools · peers · blocks"
          title='The mesh that <em style="color:var(--c-50);font-style:normal">won\u2019t go quiet</em>.'
          sub="RandomX keeps mining on consumer CPUs; tail emission keeps miners paid. Here's the live state of the network."
        />

        {/* TODO(port): replace this strip with the full network.jsx body. */}
        <section style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          <Stat k="Height" v={fmtN(data.height)} sub="blocks" tone="c" />
          <Stat k="Hashrate" v={`${fmtN(data.hashrate)} H/s`} sub="RandomX" tone="c" />
          <Stat k="Difficulty" v={fmtN(data.difficulty)} sub={`target ${data.blockTarget}s`} />
          <Stat k="Peers" v={`${data.peers.length}`} sub={`${data.peerOut} out · ${data.peerIn} in`} tone="g" />
        </section>

        <Card style={{ padding: 22 }}>
          <div className="kicker">Port target</div>
          <p className="mono dim" style={{ fontSize: 12, lineHeight: 1.7, marginTop: 8 }}>
            Port the full body from <b style={{ color: "var(--c-50)" }}>app01-source/network.jsx</b>:
            hashrate/difficulty curves, pool distribution + HHI, geo peer table,
            and recent-blocks list. Match <b>screenshots/08-network.png</b>.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}

function Stat({ k, v, sub, tone }: { k: string; v: string; sub?: string; tone?: "g" | "c" | "y" }) {
  const c = tone === "g" ? "var(--g-50)" : tone === "c" ? "var(--c-50)" : tone === "y" ? "var(--y-50)" : "var(--ink-100)";
  return (
    <Card style={{ padding: 18 }}>
      <div className="kicker">{k}</div>
      <div className="mono" style={{ fontSize: 24, color: c, margin: "6px 0 2px", textShadow: tone ? "var(--glow-1)" : "none" }}>{v}</div>
      {sub ? <div className="mono dim" style={{ fontSize: 11 }}>{sub}</div> : null}
    </Card>
  );
}
