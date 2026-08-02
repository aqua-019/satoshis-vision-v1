/**
 * layout/NavTop.tsx — global navigation strip + live ticker.
 *
 * Uses react-router-dom <NavLink>, so the "active" highlight is computed
 * from the URL, not from a prop. Every link is a real route — bookmarkable,
 * shareable, refresh-safe.
 */

import * as React from "react";
import { NavLink, Link } from "react-router-dom";
import { useMoneroLive } from "@/data/DataContext";
import { Provenance } from "@/design/primitives";
import { DesignPanel } from "@/design/DesignPanel";
import { SITE_VERSION } from "@/data/releases";
import { assertNever, CHAIN_MARKET_CHROME_KEYS, chromePhase, hasData } from "@/data/feed-status";

const NAV: ReadonlyArray<{ to: string; label: string }> = [
  { to: "/",           label: "Home" },
  { to: "/mempool",    label: "Mempool" },
  { to: "/markets",    label: "Markets" },
  { to: "/network",    label: "Network" },
  { to: "/monero",     label: "Monero" },
  { to: "/education",  label: "Education" },
  { to: "/future",     label: "Future" },
  { to: "/peers",      label: "Peers" },
  { to: "/simulate",   label: "Simulate" },
  { to: "/node",       label: "Run a node" },
  { to: "/sources",    label: "Sources" },
];

const NAV_MENU_ID = "navtop-menu";

export function NavTop() {
  const data = useMoneroLive();
  const [menu, setMenu] = React.useState(false);
  const toggleRef = React.useRef<HTMLButtonElement>(null);
  const navRef = React.useRef<HTMLElement>(null);

  // Escape closes the drawer; focus management mirrors a standard disclosure
  // menu (focus into the drawer on open, back to the trigger on close).
  React.useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(false); };
    document.addEventListener("keydown", onKey);
    navRef.current?.querySelector<HTMLElement>("a")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [menu]);

  const closeMenu = () => {
    setMenu(false);
    toggleRef.current?.focus();
  };

  return (
    <div className="topbar">
      <div className="brand-col" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Link to="/" className="brand" style={{ textDecoration: "none", color: "inherit" }}>
          <span className="brand-mark" />
          <span>xmr<b>.irish</b></span>
        </Link>
        <Link to="/sources#release-notes" className="kicker" style={{ textDecoration: "none" }} title="Release notes">{SITE_VERSION}</Link>
      </div>

      <nav
        ref={navRef}
        id={NAV_MENU_ID}
        className={"topnav" + (menu ? " is-open" : "")}
      >
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === "/"}
            onClick={() => setMenu(false)}
            className={({ isActive }) => (isActive ? "on" : "")}
          >
            {n.label}
            {n.to === "/simulate" ? <Provenance source="model" compact style={{ marginLeft: 6 }} /> : null}
          </NavLink>
        ))}
      </nav>

      <div className="ticker-strip">
        {/* Exhaustive over FeedPhase: a fifth phase stops compiling here rather
            than silently falling through to LIVE. "error" deliberately shares
            the CONNECTING copy for now — see chromePhase's note. */}
        {(() => {
          const phase = chromePhase(data.status, CHAIN_MARKET_CHROME_KEYS);
          switch (phase) {
            case "loading":
            case "error":
              return (
                <span className="pill">
                  <span className="led" style={{ background: "var(--ink-40)", boxShadow: "none" }} />
                  CONNECTING
                </span>
              );
            case "stale":
              return (
                <span className="pill">
                  <span className="led pulse" style={{ background: "var(--y-50)" }} />
                  STALE · reconnecting
                </span>
              );
            case "live":
              return (
                <span className="pill live">
                  <span className="led pulse" />
                  LIVE
                </span>
              );
            default:
              return assertNever(phase, "NavTop pill");
          }
        })()}
        <span className="tk dim">
          XMR <b className="acc">{hasData(data.status.market) ? `$${data.price.toFixed(2)}` : "—"}</b>
          <em className={data.change24h < 0 ? "dn" : ""}>
            {hasData(data.status.market) ? `${data.change24h >= 0 ? "+" : ""}${data.change24h.toFixed(2)}%` : "—"}
          </em>
        </span>
        <span className="tk dim tk--btc">
          BTC <b>{hasData(data.status.market) ? `$${Math.round(data.btc).toLocaleString()}` : "—"}</b>
          <em className={data.btcChg < 0 ? "dn" : ""}>
            {hasData(data.status.market) ? `${data.btcChg >= 0 ? "+" : ""}${data.btcChg.toFixed(2)}%` : "—"}
          </em>
        </span>
        {/* Must stay the LAST child of .ticker-strip — see
            design/DesignPanel.tsx's header comment for why. */}
        <DesignPanel />
      </div>

      <button
        ref={toggleRef}
        type="button"
        className="navtop-toggle"
        aria-label={menu ? "Close menu" : "Open menu"}
        aria-expanded={menu}
        aria-controls={NAV_MENU_ID}
        onClick={() => (menu ? closeMenu() : setMenu(true))}
      >
        {menu ? "✕" : "☰"}
      </button>
    </div>
  );
}
