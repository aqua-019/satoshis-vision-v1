/**
 * layout/Footer.tsx — bottom telemetry strip.
 */

import * as React from "react";
import { useMoneroLive } from "@/data/DataContext";
import { fmtN } from "@/data/types";

export function Footer() {
  const data = useMoneroLive();
  const t = new Date();
  return (
    <div className="footer-tele">
      <span><span className="blink">●</span> {data.stale ? "FEED STALE" : data.ready ? "NETWORK NOMINAL" : "CONNECTING"}</span>
      <span>HEIGHT <b className="acc" style={{ color: "var(--tk-accent)" }}>{data.ready ? data.height.toLocaleString() : "—"}</b></span>
      <span>HASH {data.ready ? `${(data.hashrate / 1e9).toFixed(2)} GH/s` : "—"}</span>
      <span>TXS {data.ready ? fmtN(data.txCountTotal) : "—"}</span>
      <span>MEMPOOL {data.ready ? data.mempool.length : "—"}</span>
      <span>RING 16</span>
      <span>FORK {data.majorVersion ? "v" + data.majorVersion : "—"} · FCMP++ Q3</span>
      <span style={{ marginLeft: "auto" }}>UTC {t.toISOString().slice(11, 19)}</span>
      <span>©2026 XMR.IRISH</span>
    </div>
  );
}
