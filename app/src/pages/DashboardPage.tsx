/**
 * pages/DashboardPage.tsx — KPIs + sparklines + pools + peers + blocks.
 */

import * as React from "react";
import { AppShell, PageHeader } from "@/layout/AppShell";
import { Card, Crumbs, MiniBar, PanelFrame, Pill, Sparkline, Stat } from "@/design/primitives";
import { useMoneroLive } from "@/data/DataContext";
import { fmtBytes, shortHash } from "@/data/types";

export function DashboardPage() {
  const data = useMoneroLive();
  const memBytes = data.mempool.reduce((a, t) => a + t.size, 0);

  return (
    <AppShell bg={{ intensity: "calm" }}>
      <Crumbs items={["xmr.irish", "v5.0", "dashboard"]} status="Polling 30s" />
      <PageHeader
        kicker="Network telemetry · live"
        title='Dashboard — the <em style="color:var(--tk-accent);text-shadow:var(--glow-1);font-style:normal">numbers</em>.'
        sub="One column: KPIs you check every morning. Pools, peers, difficulty, fee curve."
        right={<><Pill tone="live" dot>LIVE</Pill><Pill>UPDATED {new Date(data.lastUpdate).toISOString().slice(11, 19)}</Pill></>}
      />

      <section style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
        <Stat k="Block height" v={data.height.toLocaleString()} sub="live · CG" tone="acc" />
        <Stat k="Hashrate"     v={`${(data.hashrate / 1e9).toFixed(2)} GH/s`} sub="vs 5.8 last wk" />
        <Stat k="Difficulty"   v={`${(data.difficulty / 1e9).toFixed(2)}G`} sub="adj every 720" />
        <Stat k="Peers"        v={data.peers.length} sub={`${data.peerOut} out · ${data.peerIn} in`} />
        <Stat k="Mempool"      v={`${data.mempool.length} tx`} sub={fmtBytes(memBytes)} />
        <Stat k="Fork"         v="v16" sub="FCMP++ Q3" tone="p" />
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 12 }}>
        <PanelFrame title="Hashrate · 7d" right={<span>GH/s</span>}>
          <Sparkline data={data.hashSeries} width={680} height={140} />
        </PanelFrame>
        <PanelFrame title="Price · 7d (CG)" right={<span>USD</span>}>
          <Sparkline data={data.priceSeries} width={420} height={140} color="var(--c-50)" />
        </PanelFrame>
        <PanelFrame title="Fee histogram" right={<span>piconero / B</span>}>
          <MiniBar data={data.feeHist} width={420} height={140} color="var(--p-50)" />
        </PanelFrame>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <PanelFrame title="Pool distribution" right={<span>last 24h shares</span>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "4px 0" }}>
            {data.poolDist.map((p) => (
              <div key={p.name} style={{ display: "grid", gridTemplateColumns: "160px 1fr 80px 70px", gap: 10, alignItems: "center", fontSize: 11 }} className="mono">
                <span style={{ color: "var(--ink-80)" }}>
                  <span className="led" style={{ background: p.color, boxShadow: `0 0 6px ${p.color}` }} />
                  {p.name}
                </span>
                <span style={{ height: 8, background: "var(--ink-10)", position: "relative", borderRadius: 1 }}>
                  <span style={{ position: "absolute", inset: "0 auto 0 0", width: `${(p.share * 100).toFixed(1)}%`, background: p.color, boxShadow: `0 0 8px ${p.color}` }} />
                </span>
                <span className="dim" style={{ textAlign: "right" }}>{(p.share * 100).toFixed(1)}%</span>
                <span style={{ color: p.rec ? "var(--g-50)" : "var(--ink-40)", textTransform: "uppercase", fontSize: 9.5, letterSpacing: "0.12em" }}>{p.type}</span>
              </div>
            ))}
          </div>
        </PanelFrame>
        <PanelFrame title="Peers · live · 12" right={<span>{data.peers.length} connected</span>}>
          <div className="peerlist" style={{ fontSize: 11 }}>
            {data.peers.map((p, i) => (
              <div className="row" key={i} style={{ gridTemplateColumns: "14px 1fr 60px 50px 60px" }}>
                <span className={"led " + (p.lat < 60 ? "" : p.lat < 100 ? "q" : "o")} style={{ width: 5, height: 5 }} />
                <span style={{ color: "var(--ink-80)" }}>{p.ip}</span>
                <span className="dim">{p.cnt}</span>
                <span className="dim">{p.lat}ms</span>
                <span className="dim">#{p.h}</span>
              </div>
            ))}
          </div>
        </PanelFrame>
      </section>

      <PanelFrame title="Recent blocks" right={<span>height ↓</span>}>
        <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 60px 80px 80px 110px 60px", gap: 10, fontSize: 11 }} className="mono">
          {["#", "Hash", "Txs", "Size", "Reward", "Pool", "Age"].map((h) => (
            <div key={h} className="kicker" style={{ borderBottom: "1px solid var(--rule)", paddingBottom: 6, marginBottom: 2 }}>{h}</div>
          ))}
          {data.blocks.slice(0, 10).map((b) => (
            <React.Fragment key={b.height}>
              <span className="acc">{b.height.toLocaleString()}</span>
              <span style={{ color: "var(--c-50)" }}>{shortHash(b.hash)}</span>
              <span>{b.txs}</span>
              <span className="dim">{b.sizeKB.toFixed(1)} KB</span>
              <span className="up">{b.reward.toFixed(3)}</span>
              <span style={{ color: "var(--ink-80)" }}>{b.pool}</span>
              <span className="dim">{Math.floor(b.age / 60)}m{b.age % 60}s</span>
            </React.Fragment>
          ))}
        </div>
      </PanelFrame>
    </AppShell>
  );
}
