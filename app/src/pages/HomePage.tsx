/**
 * pages/HomePage.tsx — hero, live ticker, recent blocks, surfaces grid.
 */

import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppShell } from "@/layout/AppShell";
import { useMoneroLive } from "@/data/DataContext";
import { fmtBytes } from "@/data/types";
import { Card, Crumbs, Pill, Sparkline, Stat } from "@/design/primitives";

export function HomePage() {
  const data = useMoneroLive();
  const navigate = useNavigate();
  const memBytes = data.mempool.reduce((a, t) => a + t.size, 0);

  return (
    <AppShell hideRail bg={{ intensity: "busy" }}>
      <div style={{ padding: "32px 48px 48px", display: "flex", flexDirection: "column", gap: 36, maxWidth: 1600, margin: "0 auto", width: "100%" }}>

        <Crumbs items={["xmr.irish", "v5.0", "home"]} status="Network nominal" />

        {/* Hero */}
        <section style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 48, alignItems: "stretch" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18, paddingTop: 18 }}>
            <div className="kicker">a privacy network · since 2014</div>
            <h1 className="serif" style={{ margin: 0, fontSize: 34, lineHeight: 1.12, fontWeight: 400, letterSpacing: "-0.01em", color: "var(--ink-80)", maxWidth: "22ch" }}>
              Every Monero output<br />
              is hiding <em style={{ color: "var(--tk-accent)", fontStyle: "normal", textShadow: "var(--glow-2)" }}>somewhere</em><br />
              in <em style={{ color: "var(--p-50)", fontStyle: "normal", textShadow: "var(--glow-2)" }}>this cloud</em>.
            </h1>
            <p className="mono dim" style={{ margin: 0, maxWidth: "52ch", fontSize: 13, lineHeight: 1.7, letterSpacing: "0.02em" }}>
              An anonymity set of <b style={{ color: "var(--p-50)" }}>150,000,000+</b> outputs.
              Live mempool, protocol explainers, an interactive simulator for every privacy primitive in the stack —
              RingCT, Stealth addresses, Dandelion++, View tags, FCMP++.
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <Link to="/mempool" className="proto-btn" style={{ textDecoration: "none" }}>Open mempool →</Link>
              <Link to="/education" className="proto-btn"
                style={{ textDecoration: "none", borderColor: "var(--p-50)", color: "var(--p-50)", boxShadow: "var(--glow-p)" }}>
                Learn the protocols
              </Link>
            </div>
          </div>

          <Card style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div className="kicker">Live · {data.source}</div>
              <Pill tone="live" dot>SYNCED</Pill>
            </div>
            <div>
              <div className="mono dim" style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase" }}>XMR / USD</div>
              <div className="mono acc glow" style={{ fontSize: 64, fontWeight: 500, lineHeight: 1, marginTop: 6 }}>${data.price.toFixed(2)}</div>
              <div className="mono" style={{ marginTop: 6, fontSize: 12, color: data.change24h >= 0 ? "var(--g-50)" : "var(--r-50)" }}>
                {data.change24h >= 0 ? "▲" : "▼"} {Math.abs(data.change24h).toFixed(2)}% · 24h
              </div>
            </div>
            <Sparkline data={data.priceSeries.slice(-90)} width={420} height={90} />
            <div className="kpi-grid" style={{ ["--kpi-cols" as any]: 3, gap: 8 }}>
              <Stat k="Block height" v={data.height.toLocaleString()} sub="live" tone="acc" />
              <Stat k="Hashrate" v={`${(data.hashrate / 1e9).toFixed(2)} GH/s`} sub="2:00 target" />
              <Stat k="Mempool" v={`${data.mempool.length} tx`} sub={fmtBytes(memBytes)} />
            </div>
          </Card>
        </section>

        {/* Recent blocks ribbon */}
        <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="kicker">Recent blocks · last {data.blocks.length}</div>
          <div className="table-scroll">
          <div className="keep-cols" style={{ display: "grid", gridTemplateColumns: "repeat(14, 1fr)", gap: 8 }}>
            {data.blocks.slice(0, 14).map((b) => (
              <div key={b.height} className="mblock">
                <div className="hh">#{b.height.toString().slice(-5)}</div>
                <div className="nm">{b.txs}</div>
                <div className="sz">{b.sizeKB.toFixed(1)}KB · {b.pool.split(" ")[0]}</div>
              </div>
            ))}
          </div>
          </div>
        </section>

        {/* Surfaces grid */}
        <section>
          <div className="kicker" style={{ marginBottom: 12 }}>The site · 7 surfaces</div>
          <div className="kpi-grid" style={{ ["--kpi-cols" as any]: 4, gap: 12 }}>
            {[
              { to: "/mempool",   t: "Mempool",   d: "5 visualisations. Reactor · Bridge · Sediment · Constellation · Terminal.", c: "var(--tk-accent)" },
              { to: "/markets",   t: "Markets",   d: "Spot price, volume, order-book depth, the XMR/BTC ratio. Where XMR trades.", c: "var(--c-50)" },
              { to: "/network",   t: "Network",   d: "Pools, peers, hashrate, difficulty, fork readiness. The raw chain telemetry.", c: "var(--y-50)" },
              { to: "/monero",    t: "Monero",    d: "Origin story, tail emission, the eternal hearth. Why this coin won't die.", c: "var(--g-50)" },
              { to: "/education", t: "Education", d: "Six metaphor-driven protocol simulators. Decoy, Dandelion++, view tags, RingCT, stealth, FCMP++.", c: "var(--p-50)" },
              { to: "/simulate",  t: "Simulate",  d: "Run any protocol with knobs. Spend a stealth output, watch RingCT sign.", c: "var(--tk-accent)" },
              { to: "/node",      t: "Run a node", d: "monerod in one command. Tor + I2P optional. Free seed peers.", c: "var(--y-50)" },
            ].map((s) => (
              <Card key={s.to} onClick={() => navigate(s.to)} style={{ padding: 14 }}>
                <div className="mono" style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: s.c }}>{s.t}</div>
                <p className="mono" style={{ margin: "8px 0 0", fontSize: 11.5, lineHeight: 1.55, color: "var(--ink-60)" }}>{s.d}</p>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
