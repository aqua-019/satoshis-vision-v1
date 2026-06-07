/**
 * layout/NetRail.tsx — persistent left-rail telemetry.
 * Shows network, local-node, peers (top 10), and a market block.
 */

import * as React from "react";
import { useMoneroLive } from "@/data/DataContext";
import { Sparkline } from "@/design/primitives";
import { fmtBytes } from "@/data/types";

export interface NetRailProps {
  /** Optional extra blocks to render below the standard set. */
  extra?: React.ReactNode;
}

export function NetRail({ extra }: NetRailProps) {
  const data = useMoneroLive();
  const memBytes = data.mempool.reduce((a, t) => a + t.size, 0);
  return (
    <aside className="rail">
      <div className="rail-block">
        <h6>Network · live</h6>
        <KV k={<><span className="led pulse" />Block height</>} v={data.height.toLocaleString()} accent />
        <KV k="Hashrate"      v={`${(data.hashrate / 1e9).toFixed(2)} GH/s`} />
        <KV k="Difficulty"    v={`${(data.difficulty / 1e9).toFixed(2)}G`} />
        <KV k="Block target"  v="2:00 min" />
        <KV k="Mempool depth" v={`${data.mempool.length} tx`} accent />
        <KV k="Hard fork"     v="v16" />
      </div>

      <div className="rail-block">
        <h6>Local node · illustrative</h6>
        <KV k={<><span className="led" />Synced</>} v={<span className="up">100.00%</span>} />
        <KV k="Peers in / out" v={`${data.peerIn} / ${data.peerOut}`} />
        <KV k="Bandwidth"      v="12.4 / 8.1 KB/s" />
        <KV k="RPC port"       v="18089" />
        <KV k="Tx pool"        v={`${data.mempool.length} · ${fmtBytes(memBytes)}`} />
      </div>

      <div className="rail-block">
        <h6>Peers · illustrative</h6>
        <div className="peerlist">
          {data.peers.slice(0, 10).map((p, i) => (
            <div className="row" key={i}>
              <span className={"led " + (p.lat < 60 ? "" : p.lat < 100 ? "q" : "o")} style={{ width: 5, height: 5 }} />
              <span title={p.ip}>{p.ip}</span>
              <span>{p.lat}ms</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rail-block">
        <h6>Market · live · CG</h6>
        <KV k="XMR/USD" v={`$${data.price.toFixed(2)}`} accent />
        <KV k="24h Δ" v={
          <span className={data.change24h >= 0 ? "up" : "dn"}>
            {data.change24h >= 0 ? "+" : ""}{data.change24h.toFixed(2)}%
          </span>
        } />
        <KV k="XMR/BTC" v={data.btcRatio.toFixed(6)} />
        <div style={{ marginTop: 6 }}>
          <Sparkline data={data.priceSeries.slice(-56)} width={224} height={36} />
        </div>
      </div>

      {extra}

      <div className="rail-block" style={{ marginTop: "auto", color: "var(--ink-40)", fontSize: 10 }}>
        Source: <span className="acc">{data.source}</span> · <span style={{ animation: "blink 0.9s steps(2,end) infinite" }}>● live</span>
        <div style={{ marginTop: 4 }}>{new Date(data.lastUpdate).toISOString().slice(11, 19)} UTC</div>
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
