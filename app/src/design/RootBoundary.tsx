/**
 * RootBoundary.tsx — v6.0.7. The app had NO error boundary of any kind before
 * this: main.tsx threw uncaught, App.tsx's /simulate <Suspense> had no partner
 * boundary, and nothing caught a render throw. Any of those produced a blank
 * page — and because index.html's <noscript> only renders when scripting is
 * DISABLED, a JS-enabled-but-failed boot showed the user nothing at all.
 *
 * That is one half of the Brave-mobile / Tor white-page report. The other half
 * (the bundle never executing) is covered by the shell fallback in
 * index.html's #root; this covers the case where the bundle DID execute and
 * then threw.
 *
 * Styling rule, same as index.html's critical floor and .nojs block: literal
 * hex, no var(). A boundary that reaches for var(--ui-accent) is useless in
 * exactly the case where the stylesheet or palette is what failed.
 */

import * as React from "react";

// R is scripts/routes.mjs's single authority for the 13 real route paths —
// see that file's header. Safe to import here (plain data, no CSS/JS
// dependency): the literal-hex-only rule below governs colours only, so a
// boundary that reaches for var(--ui-accent) stays useless in exactly the
// case where the stylesheet failed, but the route PATHS themselves are not
// styling and carry no such risk.
import { R } from "../../scripts/routes.mjs";

const WRAP: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  overflow: "auto",
  background: "#050505",
  color: "#a8a094",
  boxSizing: "border-box",
  fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace',
  lineHeight: 1.6,
  padding: "48px 20px",
};

const INNER: React.CSSProperties = { maxWidth: 640, margin: "0 auto" };
const MARK: React.CSSProperties = { fontSize: 22, letterSpacing: "0.04em", color: "#a8a094" };
const DESC: React.CSSProperties = { margin: "6px 0 28px", fontSize: 14, color: "#6f6a61" };
const NOTE: React.CSSProperties = {
  border: "1px solid rgba(255,122,26,.28)",
  borderRadius: 6,
  padding: "14px 16px",
  fontSize: 14,
  color: "#a8a094",
  marginBottom: 24,
  background: "rgba(255,122,26,.04)",
};
const LINK: React.CSSProperties = {
  color: "#ff7a1a",
  textDecoration: "none",
  borderBottom: "1px solid rgba(255,122,26,.4)",
};
const NAV: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: "0 0 24px",
  fontSize: 14,
  display: "flex",
  flexWrap: "wrap",
  gap: "8px 18px",
};

/** Same route list as index.html's shell fallback and App.tsx's <Routes>,
 *  in nav/ia.ts's section order (Live → Monero → Learn → Future → Operate →
 *  About). Built from R rather than retyped path literals.
 *
 *  ── DERIVED PATHS, HAND-COPIED MEMBERSHIP — AND IT HAD DRIFTED (p4·04) ──
 *  Read that sentence above carefully, because it is the half-truth that let
 *  this rot: every PATH here comes from `R`, so a renamed route follows
 *  automatically — but WHICH routes appear is hand-kept, and nothing derives
 *  or gates it. p3·16 minted `/operate/superstress` and never reached this
 *  file, so this list shipped 13 entries against 14 routes for a full release
 *  series, and the crash screen quietly omitted the newest page. CLAUDE.md's
 *  own "four route lists, one truth — RESOLVED in v6.1.6" entry names this
 *  file among the resolved; that claim covers the paths and not the set.
 *
 *  p4·04 adds `/operate/mine` AND backfills the missing hub. If you add a
 *  route, add it here: a `git grep` for the SIBLING route's constant is the
 *  reliable way to find every list like this one. */
const ROUTES: ReadonlyArray<readonly [string, string]> = [
  [R.HOME, "Home"],
  [R.LIVE_MEMPOOL, "Mempool"],
  [R.LIVE_MARKETS, "Markets"],
  [R.MARKETS_THESIS, "Market thesis"],
  [R.LIVE_NETWORK, "Network"],
  [R.MONERO, "Monero"],
  [R.LEARN, "Learn"],
  [R.LEARN_SIM, "Simulators"],
  [R.FUTURE, "Future"],
  [R.FUTURE_OUTLOOK, "Outlook"],
  [R.FUTURE_PROTOCOL, "Protocols"],
  [R.OPERATE_NODE, "Run a node"],
  [R.OPERATE_MINE, "Mine"],
  [R.OPERATE_SUPERSTRESS, "Superstress hub"],
  [R.OPERATE_PEERS, "Peers"],
  [R.ABOUT_SOURCES, "Sources"],
  [R.ABOUT_SITE, "Mission"],
];

export interface RootBoundaryProps {
  children: React.ReactNode;
  /**
   * Rendered instead of the full-screen shell. Used for the /simulate chunk,
   * where only one route failed and the surrounding app is still healthy —
   * blanking the whole page there would be a regression, not a fix.
   */
  inline?: (error: Error) => React.ReactNode;
}

interface RootBoundaryState {
  error: Error | null;
}

export class RootBoundary extends React.Component<RootBoundaryProps, RootBoundaryState> {
  override state: RootBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RootBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    // No telemetry — this is a Monero privacy site and app/README.md's
    // "Privacy hygiene" rule is no third-party analytics. Console only.
    console.error("[xmr.irish] render failed:", error, info.componentStack);
  }

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.inline) return this.props.inline(error);

    return (
      <div style={WRAP} role="alert">
        <div style={INNER}>
          <div style={MARK}>
            xmr<b style={{ color: "#ff7a1a", fontWeight: 600 }}>.irish</b>
          </div>
          <div style={DESC}>Monero education + live mempool, network &amp; market data.</div>
          <div style={NOTE}>
            Something failed while rendering this page. The site is read-only and non-custodial, so
            nothing was at risk. Reloading usually resolves it; the pages below are plain links and
            still work.
          </div>
          <ul style={NAV}>
            {ROUTES.map(([href, label]) => (
              <li key={href}>
                <a style={LINK} href={href}>
                  {label}
                </a>
              </li>
            ))}
          </ul>
          <a style={LINK} href="https://getmonero.org" rel="noopener noreferrer">
            Learn about Monero → getmonero.org
          </a>
        </div>
      </div>
    );
  }
}
