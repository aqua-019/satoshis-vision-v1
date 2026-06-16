/**
 * pages/NodePage.tsx — quick-start guide for running monerod.
 */

import * as React from "react";
import { AppShell, PageHeader } from "@/layout/AppShell";
import { Card, Crumbs, Stat } from "@/design/primitives";
import { ProtoStep } from "@/design/ProtoArtboard";
import { useMoneroLive } from "@/data/DataContext";

function Cmd({ id, cmd, copied, setCopied }: { id: string; cmd: string; copied: string | null; setCopied: (v: string | null) => void }) {
  const copy = () => {
    try {
      navigator.clipboard.writeText(cmd);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* clipboard blocked */ }
  };
  return (
    <div className="panel" style={{ padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <code className="mono" style={{ color: "var(--c-50)", fontSize: 13 }}>
        $ <span style={{ color: "var(--ink-100)" }}>{cmd}</span>
      </code>
      <button type="button" className="proto-btn" style={{ padding: "5px 10px", fontSize: 10 }} onClick={copy}>
        {copied === id ? "✓ COPIED" : "COPY"}
      </button>
    </div>
  );
}

export function NodePage() {
  const data = useMoneroLive();
  const [copied, setCopied] = React.useState<string | null>(null);

  return (
    <AppShell hideRail bg={{ intensity: "calm" }}>
      <div style={{ padding: "32px 48px 48px", display: "flex", flexDirection: "column", gap: 28, maxWidth: 1200, margin: "0 auto", width: "100%" }}>
        <Crumbs items={["xmr.irish", "v5.0", "run a node"]} />
        <PageHeader
          kicker="monerod · five paths · pick one"
          title='Run a <em style="color:var(--tk-accent);text-shadow:var(--glow-1);font-style:normal">node</em>. Sovereign in 12 minutes.'
          sub="A full Monero node verifies every block. Yours, not someone else's. CLI on a Pi, Docker on a server, or click-to-install on macOS."
        />

        <section style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          <Stat k="Disk" v="~205 GB" sub="as of v16" />
          <Stat k="RAM" v="4 GB min" sub="8 GB rec" />
          <Stat k="Bandwidth" v="~5 GB/day" sub="after sync" />
          <Stat k="Initial sync" v="8–24 hrs" sub="SSD strongly rec" />
        </section>

        <Card style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div className="kicker" style={{ color: "var(--tk-accent)" }}>Quick path · docker · 60 seconds</div>
            <p className="mono dim" style={{ margin: "8px 0 14px", fontSize: 12 }}>
              The fastest way. Pulls the official image and starts a pruned node listening on 18089.
            </p>
          </div>
          <Cmd id="d1" cmd="docker volume create monerod-data" copied={copied} setCopied={setCopied} />
          <Cmd id="d2" cmd="docker run -d --name monerod --restart=always -p 18080:18080 -p 18089:18089 -v monerod-data:/home/monero/.bitmonero sethsimmons/simple-monerod:latest --prune-blockchain --rpc-restricted-bind-ip=0.0.0.0 --rpc-restricted-bind-port=18089" copied={copied} setCopied={setCopied} />
          <Cmd id="d3" cmd="docker logs -f monerod" copied={copied} setCopied={setCopied} />
        </Card>

        <Card style={{ padding: 22 }}>
          <div className="kicker" style={{ color: "var(--p-50)" }}>Privacy path · Tor + I2P · 12 minutes</div>
          <p className="mono dim" style={{ margin: "8px 0 14px", fontSize: 12 }}>
            Add anonymity at the network layer. Your peers see neither your IP nor your geography.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            <ProtoStep n={1} title="Install Tor + I2P">apt install tor i2pd · enable systemd · open ports 9050 / 7656.</ProtoStep>
            <ProtoStep n={2} on title="Configure monerod">Edit <code className="hash">monerod.conf</code>: add tx-proxy &amp; anonymous-inbound lines.</ProtoStep>
            <ProtoStep n={3} title="Verify routing">curl through Tor to check your <code className="hash">.onion</code> is reachable.</ProtoStep>
          </div>
        </Card>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {[
            { t: "macOS · click-to-install", b: "GUI bundle from getmonero.org. Pre-configured. Good first node." },
            { t: "Raspberry Pi 5 · headless", b: "External NVMe required. Pi 5 + 8GB SDRAM keeps up nicely." },
            { t: "Bare metal · monerod -d", b: "Build from source. ~12 min on a modern CPU. Pinned releases on getmonero.org." },
          ].map((p) => (
            <Card key={p.t} style={{ padding: 16 }}>
              <div className="serif" style={{ fontSize: 17, color: "var(--ink-100)" }}>{p.t}</div>
              <p className="mono dim" style={{ margin: "8px 0 0", fontSize: 11.5, lineHeight: 1.55 }}>{p.b}</p>
            </Card>
          ))}
        </section>

        <Card style={{ padding: 22 }}>
          <div className="kicker">After sync · sanity check</div>
          <div className="mono" style={{ marginTop: 10, fontSize: 12, lineHeight: 1.8, color: "var(--ink-80)" }}>
            <div><span style={{ color: "var(--c-50)" }}>$</span> curl <span style={{ color: "var(--ink-100)" }}>http://localhost:18089/get_info</span> | jq <span style={{ color: "var(--g-50)" }}>'.height, .target, .nettype'</span></div>
            <div className="dim" style={{ marginTop: 6 }}>Expected: <span className="acc">{data.ready ? data.height.toLocaleString() : "—"}</span> · 120 · "mainnet"</div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
