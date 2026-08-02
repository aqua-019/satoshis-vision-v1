/**
 * layout/Footer.tsx — bottom telemetry strip.
 */

import * as React from "react";
import { Link } from "react-router-dom";
import { useMoneroLive } from "@/data/DataContext";
import { fmtN } from "@/data/types";
import { assertNever, CHAIN_CHROME_KEYS, chromePhase, hasData, type FeedPhase } from "@/data/feed-status";

/** Exhaustive over FeedPhase — the telemetry strip's own vocabulary. "error"
 *  shares the CONNECTING word for now; see chromePhase in data/feed-status.ts. */
function statusWord(phase: FeedPhase): string {
  switch (phase) {
    case "stale":
      return "FEED STALE";
    case "live":
      return "NETWORK NOMINAL";
    case "loading":
    case "error":
      return "CONNECTING";
    default:
      return assertNever(phase, "Footer status", "CONNECTING");
  }
}

export function Footer() {
  const data = useMoneroLive();
  const t = new Date();
  return (
    <div className="footer-tele">
      <span><span className="blink">●</span> {statusWord(chromePhase(data.status, CHAIN_CHROME_KEYS))}</span>
      <span>HEIGHT <b className="acc" style={{ color: "var(--tk-accent)" }}>{hasData(data.status.network) ? data.height.toLocaleString() : "—"}</b></span>
      <span>HASH {hasData(data.status.network) ? `${(data.hashrate / 1e9).toFixed(2)} GH/s` : "—"}</span>
      <span>TXS {hasData(data.status.network) ? fmtN(data.txCountTotal) : "—"}</span>
      <span>MEMPOOL {hasData(data.status.network) ? data.mempool.length : "—"}</span>
      <span>RING 16</span>
      <span>FORK {data.majorVersion ? "v" + data.majorVersion : "—"} · FCMP++ Q3</span>
      <span style={{ marginLeft: "auto" }}>UTC {t.toISOString().slice(11, 19)}</span>
      <span><Link to="/sources" style={{ color: "inherit", textDecoration: "none" }}>SOURCES</Link></span>
      <span>©2026 XMR.IRISH</span>
    </div>
  );
}
