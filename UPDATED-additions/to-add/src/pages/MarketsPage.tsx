/**
 * pages/MarketsPage.tsx — NEW surface (the skeleton had no Markets page).
 *
 * This is a typed SHELL with the correct chrome (AppShell + tabs). Port the
 * body from the authoritative source (the file the live index.html loads):
 *   UPDATED-additions/app01-source/markets.jsx
 *   UPDATED-additions/app01-source/tilt-card.jsx         (mouse-reactive panels)
 * NOTE: app01-source/markets-network.jsx is a SUPERSEDED earlier combined
 *   file — NOT loaded by index.html. Port from markets.jsx, not it.
 *
 * The source renders: live XMR/BTC price, 24h change, fee histogram, exchange
 * volume table (incl. delisted venues), and instant-swap liquidity. Every
 * number reads from `useMoneroLive()` — no hardcoded values once ported.
 *
 * Visual target: screenshots/07-markets.png
 */

import * as React from "react";
import { AppShell, PageHeader } from "@/layout/AppShell";
import { Card, Crumbs } from "@/design/primitives";
import { useMoneroLive } from "@/data/DataContext";
import { fmtN } from "@/data/types";

export function MarketsPage() {
  const data = useMoneroLive();
  return (
    <AppShell active="markets" data={data} bg={{ intensity: "calm" }}>
      <div style={{ padding: "32px 48px 48px", display: "flex", flexDirection: "column", gap: 28, maxWidth: 1400, margin: "0 auto", width: "100%" }}>
        <Crumbs items={["xmr.irish", "v5.0", "markets"]} />
        <PageHeader
          kicker="Price · liquidity · venues"
          title='Where private money <em style="color:var(--tk-accent);font-style:normal">clears</em>.'
          sub="Live price action and the shrinking set of venues that still list it. The on-ramps thinned; the protocol did not."
        />

        {/* TODO(port): replace this strip with the full markets.jsx body. */}
        <section style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          <Stat k="XMR / USD" v={`$${data.price.toFixed(2)}`} sub={`${data.change24h >= 0 ? "+" : ""}${data.change24h.toFixed(2)}% 24h`} tone={data.change24h >= 0 ? "g" : "r"} />
          <Stat k="XMR / BTC" v={data.btcRatio.toFixed(6)} sub={`BTC $${fmtN(data.btc)}`} />
          <Stat k="Mempool" v={`${data.mempool.length} tx`} sub="pending" />
          <Stat k="Source" v={data.live ? data.source.toUpperCase() : "SIM"} sub={data.live ? "live feed" : "simulated"} tone={data.live ? "g" : "y"} />
        </section>

        <Card style={{ padding: 22 }}>
          <div className="kicker">Port target</div>
          <p className="mono dim" style={{ fontSize: 12, lineHeight: 1.7, marginTop: 8 }}>
            Port the full body from <b style={{ color: "var(--tk-accent)" }}>app01-source/markets.jsx</b>:
            exchange-volume table, instant-swap liquidity, fee histogram, and the
            tilt-card panels. Match <b>screenshots/07-markets.png</b>.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}

function Stat({ k, v, sub, tone }: { k: string; v: string; sub?: string; tone?: "g" | "r" | "y" }) {
  const c = tone === "g" ? "var(--g-50)" : tone === "r" ? "var(--r-50)" : tone === "y" ? "var(--y-50)" : "var(--ink-100)";
  return (
    <Card style={{ padding: 18 }}>
      <div className="kicker">{k}</div>
      <div className="mono" style={{ fontSize: 26, color: c, margin: "6px 0 2px", textShadow: tone ? "var(--glow-1)" : "none" }}>{v}</div>
      {sub ? <div className="mono dim" style={{ fontSize: 11 }}>{sub}</div> : null}
    </Card>
  );
}
