/**
 * layout/Footer.tsx — bottom telemetry strip.
 */

import * as React from "react";
import { useMoneroLive } from "@/data/DataContext";

export function Footer() {
  const data = useMoneroLive();
  const t = new Date();
  return (
    <div className="footer-tele">
      <span><span className="blink">●</span> NETWORK NOMINAL</span>
      <span>HEIGHT <b className="acc" style={{ color: "var(--tk-accent)" }}>{data.height.toLocaleString()}</b></span>
      <span>HASH {(data.hashrate / 1e9).toFixed(2)} GH/s</span>
      <span>PEERS {data.peers.length}</span>
      <span>MEMPOOL {data.mempool.length}</span>
      <span>RING 16</span>
      <span>FORK v16 · FCMP++ Q3</span>
      <span style={{ marginLeft: "auto" }}>UTC {t.toISOString().slice(11, 19)}</span>
      <span>©2026 XMR.IRISH</span>
    </div>
  );
}
