/**
 * layout/Footer.tsx — bottom telemetry strip.
 */

import * as React from "react";
import { Link } from "react-router-dom";
import { useMoneroLive } from "@/data/DataContext";
import { fmtN } from "@/data/types";
import { assertNever, CHAIN_CHROME_KEYS, hasData } from "@/data/feed-status";
import { CHROME_LABEL, chromeDetail, useChromeState, type ChromeState } from "@/design/useOnline";
import { R } from "../../scripts/routes.mjs";

/** Exhaustive over ChromeState. The degraded words come from the shared map so
 *  this strip stops being a fourth dialect of the same three facts; only the
 *  healthy word stays local, because nothing is at stake in that one. */
function statusWord(state: ChromeState): string {
  switch (state) {
    case "live":
      return "NETWORK NOMINAL";
    case "offline":
    case "loading":
    case "error":
    case "stale":
      return CHROME_LABEL[state];
    default:
      return assertNever(state, "Footer status", CHROME_LABEL.loading);
  }
}

export function Footer() {
  const data = useMoneroLive();
  const chromeState = useChromeState(data.status, CHAIN_CHROME_KEYS);
  /* PRE-EXISTING defect, fixed here because it is the cardinal rule and
   * because it is the only thing making `npm run build` non-reproducible.
   *
   * `new Date()` unguarded meant prerender baked the BUILD MACHINE's wall
   * clock into all thirteen shipped HTML files. A JS-off visitor — Tor at
   * Safest, which is this site's most privacy-conscious segment — read a
   * timestamp frozen at deploy time as if it were now, and a clock looks
   * self-evidently live in a way a block height does not.
   *
   * Look at what it sits beside: HEIGHT, HASH, TXS, MEMPOOL and FORK all
   * degrade to an em-dash via hasData(), because this app never invents a
   * figure it did not receive. The clock was the single element in that row
   * inventing one, and the only one no gate looked at — verify-nojs proves
   * the live figures render as em-dashes and never checked this.
   *
   * main.tsx uses createRoot, which DISCARDS prerendered markup and
   * re-renders, so there is no hydration to mismatch: server renders the
   * em-dash, the client renders the real clock on its first pass.
   *
   * Side effect worth having: dist/ is now byte-reproducible. Two builds of
   * one tree previously differed in exactly thirteen files — every prerendered
   * index.html, on this one string — which is noise the new build-stamp guards
   * would otherwise have had to tolerate. */
  const t = typeof window === "undefined" ? null : new Date();
  return (
    <div className="footer-tele">
      <span title={chromeDetail(chromeState, data.status, CHAIN_CHROME_KEYS) ?? undefined}><span className="blink">●</span> {statusWord(chromeState)}</span>
      <span>HEIGHT <b className="acc" style={{ color: "var(--tk-accent)" }}>{hasData(data.status.network) ? data.height.toLocaleString() : "—"}</b></span>
      <span>HASH {hasData(data.status.network) ? `${(data.hashrate / 1e9).toFixed(2)} GH/s` : "—"}</span>
      <span>TXS {hasData(data.status.network) ? fmtN(data.txCountTotal) : "—"}</span>
      <span>MEMPOOL {hasData(data.status.network) ? data.mempool.length : "—"}</span>
      <span>RING 16</span>
      <span>FORK {data.majorVersion ? "v" + data.majorVersion : "—"} · FCMP++ Q3</span>
      <span style={{ marginLeft: "auto" }}>UTC {t ? t.toISOString().slice(11, 19) : "—"}</span>
      <span><Link to={R.ABOUT_SOURCES} style={{ color: "inherit", textDecoration: "none" }}>SOURCES</Link></span>
      <span>©2026 XMR.IRISH</span>
    </div>
  );
}
