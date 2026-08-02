/**
 * pages/HomePage.tsx — hero, live ticker, recent blocks, surfaces grid.
 */

import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageShell } from "@/layout/PageShell";
import { useMoneroLive } from "@/data/DataContext";
import { fmtBytes } from "@/data/types";
import { assertNever, CHAIN_MARKET_CHROME_KEYS, hasData } from "@/data/feed-status";
import { CHROME_LABEL, chromeDetail, useChromeState } from "@/design/useOnline";
import { Card, Crumbs, Pill, Sparkline, Stat, Provenance, NodeProvenance } from "@/design/primitives";
import { ThemeToggle } from "@/design/ThemeToggle";
// TEMPORARY — reverted in the very next commit. Eagerly importing the protocol
// registry from the LCP route drags all 16 simulator modules into the entry
// closure: a real +50KB gzip regression, and the realistic version of the
// mistake verify-bundle exists to catch.
import { PROTOCOL_VIEWS } from "@/views/protocols";

const __breakTestKeys = Object.keys(PROTOCOL_VIEWS).length;
if (__breakTestKeys < 0) console.log(__breakTestKeys);

export function HomePage() {
  const data = useMoneroLive();
  const navigate = useNavigate();
  const chromeState = useChromeState(data.status, CHAIN_MARKET_CHROME_KEYS);
  const memBytes = data.mempool.reduce((a, t) => a + t.size, 0);

  return (
    <PageShell width="wide" className="home-hero" bg={{ intensity: "busy" }}>

      <Crumbs items={["xmr.irish", "v5.0", "home"]} status="Network nominal" />

      {/* Hero */}
      <section style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 48, alignItems: "stretch" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, paddingTop: 18 }}>
          <div className="kicker">a privacy network · since 2014</div>
          {/* id="page-title" — names the <main> landmark (AppShell.tsx). Home
              does not use PageHeader, so it carries the id itself. */}
          <h1 id="page-title" className="serif" style={{ margin: 0, fontSize: 34, lineHeight: 1.12, fontWeight: 400, letterSpacing: "-0.01em", color: "var(--ink-80)", maxWidth: "22ch" }}>
            Every Monero output<br />
            is hiding <em style={{ color: "var(--tk-accent)", fontStyle: "normal", textShadow: "var(--glow-2)" }}>somewhere</em><br />
            in <em style={{ color: "var(--p-50)", fontStyle: "normal", textShadow: "var(--glow-2)" }}>this cloud</em>.
          </h1>
          <p className="mono dim" style={{ margin: 0, maxWidth: "52ch", fontSize: "var(--fs-body)", lineHeight: 1.7, letterSpacing: "0.02em" }}>
            An anonymity set of <b style={{ color: "var(--p-50)" }}>150,000,000+</b> outputs.
            Live mempool and chain telemetry, protocol explainers, and interactive educational
            simulators for every privacy primitive in the stack — RingCT, Stealth addresses,
            Dandelion++, View tags, FCMP++.
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
            <Link to="/mempool" className="proto-btn" style={{ textDecoration: "none" }}>Open mempool →</Link>
            <Link to="/education" className="proto-btn"
              style={{ textDecoration: "none", borderColor: "var(--p-50)", color: "var(--p-50)", boxShadow: "var(--glow-p)" }}>
              Learn the protocols
            </Link>
            <ThemeToggle style={{ marginLeft: 8 }} />
          </div>
        </div>

        <Card style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div className="kicker">Live snapshot</div>
            {(() => {
              // Exhaustive over ChromeState — the FIFTH chrome surface, missed
              // when the other four were converted. It was still collapsing
              // `error` onto CONNECTING, i.e. still telling the lie.
              const title = chromeDetail(chromeState, data.status, CHAIN_MARKET_CHROME_KEYS) ?? undefined;
              switch (chromeState) {
                case "offline": return <Pill dot title={title}>{CHROME_LABEL.offline}</Pill>;
                case "loading": return <Pill title={title}>{CHROME_LABEL.loading}</Pill>;
                case "error": return <Pill tone="warn" dot title={title}>{CHROME_LABEL.error}</Pill>;
                case "stale": return <Pill tone="warn" dot title={title}>{CHROME_LABEL.stale}</Pill>;
                case "live": return <Pill tone="live" dot>SYNCED</Pill>;
                default: return assertNever(chromeState, "HomePage pill");
              }
            })()}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="mono dim" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.16em", textTransform: "uppercase" }}>XMR / USD</div>
              {/* status.market, not feedDegraded: this badge is labelled
                  COINGECKO, and feedDegraded is the chain-feed pair-AND, which
                  deliberately EXCLUDES market. So a dead node cascade used to
                  grey a badge for an upstream that may have been answering
                  perfectly — the same class of mis-attribution as a /network
                  chart dimming on someone else's endpoint. */}
              <NodeProvenance source="coingecko" keys={["market"]} status={data.status} />
            </div>
            <div className="mono acc glow" style={{ fontSize: 64, fontWeight: 500, lineHeight: 1, marginTop: 6 }}>{hasData(data.status.market) ? `$${data.price.toFixed(2)}` : "—"}</div>
            <div className="mono" style={{ marginTop: 6, fontSize: "var(--fs-mono)", color: data.change24h >= 0 ? "var(--g-50)" : "var(--r-50)" }}>
              {hasData(data.status.market) ? <>{data.change24h >= 0 ? "▲" : "▼"} {Math.abs(data.change24h).toFixed(2)}% · 24h</> : "—"}
            </div>
          </div>
          {data.priceSeries.length > 1 && (
            <Sparkline
              data={data.priceSeries.slice(-90)}
              width={420}
              height={90}
              detail
              hover
              fmt={(v) => "$" + v.toFixed(2)}
            />
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="mono dim" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.16em", textTransform: "uppercase" }}>On-chain</div>
            <NodeProvenance source="node" keys={["network"]} status={data.status} detail={data.source !== "coingecko" ? data.source : undefined} />
          </div>
          <div className="kpi-grid" style={{ ["--kpi-cols" as any]: 3, gap: 8 }}>
            <Stat k="Block height" v={hasData(data.status.network) ? data.height.toLocaleString() : "—"} tone="acc" />
            <Stat k="Hashrate" v={hasData(data.status.network) ? `${(data.hashrate / 1e9).toFixed(2)} GH/s` : "—"} sub="2:00 target" />
            <Stat k="Mempool" v={hasData(data.status.network) ? `${data.mempool.length} tx` : "—"} sub={hasData(data.status.network) ? fmtBytes(memBytes) : "—"} />
          </div>
        </Card>
      </section>

      {/* Recent blocks ribbon */}
      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="kicker">Recent blocks · last {data.blocks.slice(0, 14).length}</div>
        <div className="table-scroll">
        <div className="keep-cols" style={{ display: "grid", gridTemplateColumns: "repeat(14, 1fr)", gap: 8 }}>
          {data.blocks.slice(0, 14).map((b) => (
            <Link
              key={b.height}
              to={`/mempool?v=classic&block=${b.height}`}
              className="mblock"
              style={{ textDecoration: "none", color: "inherit", display: "block" }}
              aria-label={`Block ${b.height}, ${b.txs} transactions — open in mempool`}
            >
              <div className="hh">#{b.height.toString().slice(-5)}</div>
              <div className="nm">{b.txs}</div>
              <div className="sz">{b.sizeKB.toFixed(1)}KB · {b.pool.split(" ")[0]}</div>
            </Link>
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
            { to: "/network",   t: "Network",   d: "Pools, hashrate, difficulty, block weight, fork readiness. Raw chain telemetry · peer telemetry soon.", c: "var(--y-50)" },
            { to: "/monero",    t: "Monero",    d: "Origin story, tail emission, the eternal hearth. Why this coin won't die.", c: "var(--g-50)" },
            { to: "/education", t: "Education", d: "The BTC→XMR journey, privacy timeline, Satoshi quotes, and metaphor-driven protocol simulators (educational).", c: "var(--p-50)" },
            { to: "/simulate",  t: "Simulate",  d: "Educational protocol models — run any one with knobs. Spend a stealth output, watch RingCT sign.", c: "var(--tk-accent)" },
            { to: "/node",      t: "Run a node", d: "monerod in one command. Tor + I2P optional. Free seed peers.", c: "var(--y-50)" },
          ].map((s) => (
            <Card key={s.to} onClick={() => navigate(s.to)} style={{ padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div className="mono" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.18em", textTransform: "uppercase", color: s.c }}>{s.t}</div>
                {s.to === "/simulate" ? <Provenance source="model" /> : null}
              </div>
              <p className="mono" style={{ margin: "8px 0 0", fontSize: "var(--fs-body)", lineHeight: 1.55, color: "var(--ink-60)" }}>{s.d}</p>
            </Card>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
