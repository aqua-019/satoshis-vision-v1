/**
 * layout/NetRail.tsx — persistent left-rail telemetry.
 * Shows network, remote-node, fee-tier, and market blocks — all real data
 * from the node / CoinGecko. Values render "—" until the feed is ready.
 */

import * as React from "react";
import { useMoneroLive } from "@/data/DataContext";
import { Sparkline, Provenance } from "@/design/primitives";
import { fmtBytes, fmtN, shortHash } from "@/data/types";
import { FEE_TIER_LABELS } from "@/data/map";

export interface NetRailProps {
  /** Optional extra blocks to render below the standard set. */
  extra?: React.ReactNode;
}

export function NetRail({ extra }: NetRailProps) {
  const data = useMoneroLive();
  const memBytes = data.mempool.reduce((a, t) => a + t.size, 0);
  const ready = data.ready;
  const t = data.blockTarget;
  const tiers = data.feeTiers;
  return (
    <aside className="rail">
      <div className="rail-block">
        <h6 style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>Network <Provenance source="node" fresh="live" bare /></h6>
        <KV k={<><span className="led pulse" />Block height</>} v={ready ? data.height.toLocaleString() : "—"} accent />
        <KV k="Hashrate"      v={ready ? `${(data.hashrate / 1e9).toFixed(2)} GH/s` : "—"} />
        <KV k="Difficulty"    v={ready ? `${(data.difficulty / 1e9).toFixed(2)}G` : "—"} />
        <KV k="Block target"  v={ready ? `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")} min` : "—"} />
        <KV k="Mempool depth" v={ready ? `${data.mempool.length} tx` : "—"} accent />
        <KV k="Hard fork"     v={data.majorVersion ? `v${data.majorVersion}` : "—"} />
      </div>

      <div className="rail-block">
        <h6 style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>Remote node <Provenance source="node" fresh="live" bare /></h6>
        <KV k="Daemon"     v={data.version || "—"} />
        <KV k="Network"    v={data.nettype || "—"} />
        <KV k="DB size"    v={data.databaseSize ? `${(data.databaseSize / 1e9).toFixed(1)} GB` : "—"} />
        <KV k={<><span className="led" />Sync</>} v={ready ? (data.synchronized ? <span className="up">✓ synced</span> : <span>syncing</span>) : "—"} />
        <KV k="Top block"  v={shortHash(data.topBlockHash)} />
        <KV k="Alt blocks" v={ready ? data.altBlocksCount.toLocaleString() : "—"} />
        <KV k="Tx pool"    v={ready ? `${data.mempool.length} · ${fmtBytes(memBytes)}` : "—"} />
      </div>

      <div className="rail-block">
        <h6 style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>Fee tiers <Provenance source="node" fresh="live" bare /></h6>
        {FEE_TIER_LABELS.map((label, i) => (
          <KV
            key={label}
            k={label}
            v={tiers.length === 4 ? (
              <>
                {tiers[i].toLocaleString()} pcn/B
                <span className="dim2" style={{ marginLeft: 4 }}>· {(tiers[i] * 1000 / 1e12).toFixed(5)} XMR/kB</span>
              </>
            ) : "—"}
          />
        ))}
        <KV k="Txs all-time" v={ready ? fmtN(data.txCountTotal) : "—"} accent />
      </div>

      <div className="rail-block">
        <h6 style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>Market <Provenance source="coingecko" fresh="live" bare /></h6>
        <KV k="XMR/USD" v={data.marketReady ? `$${data.price.toFixed(2)}` : "—"} accent />
        <KV k="24h Δ" v={data.marketReady ? (
          <span className={data.change24h >= 0 ? "up" : "dn"}>
            {data.change24h >= 0 ? "+" : ""}{data.change24h.toFixed(2)}%
          </span>
        ) : "—"} />
        <KV k="XMR/BTC" v={data.marketReady ? data.btcRatio.toFixed(6) : "—"} />
        {data.priceSeries.length > 1 && (
          <div style={{ marginTop: 6 }}>
            <Sparkline data={data.priceSeries.slice(-56)} width={224} height={36} />
          </div>
        )}
      </div>

      {extra}

      <div className="rail-block" style={{ marginTop: "auto", color: "var(--ink-40)", fontSize: 10 }}>
        <Provenance source="node" fresh={data.stale ? "stale" : "live"} detail={data.source} />
        <div style={{ marginTop: 4 }}>{data.lastUpdate ? `${new Date(data.lastUpdate).toISOString().slice(11, 19)} UTC` : "—"}</div>
      </div>
    </aside>
  );
}

interface KVProps { k: React.ReactNode; v: React.ReactNode; accent?: boolean }
function KV({ k, v, accent }: KVProps) {
  return (
    <div className="kv">
      <span className="k">{k}</span>
      <span className={"v" + (accent ? " acc" : "")}>{v}</span>
    </div>
  );
}
