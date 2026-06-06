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

const NAV: ReadonlyArray<{ to: string; label: string }> = [
  { to: "/",           label: "Home" },
  { to: "/mempool",    label: "Mempool" },
  { to: "/markets",    label: "Markets" },
  { to: "/network",    label: "Network" },
  { to: "/monero",     label: "Monero" },
  { to: "/education",  label: "Education" },
  { to: "/simulate",   label: "Simulate" },
  { to: "/node",       label: "Run a node" },
];

export function NavTop() {
  const data = useMoneroLive();
  return (
    <div className="topbar">
      <Link to="/" className="brand" style={{ textDecoration: "none", color: "inherit" }}>
        <span className="brand-mark" />
        <span>xmr<b>.irish</b></span>
        <span className="kicker" style={{ marginLeft: 8 }}>v5.0 · 0.1</span>
      </Link>

      <div className="topnav">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === "/"}
            className={({ isActive }) => (isActive ? "on" : "")}
          >
            {n.label}
          </NavLink>
        ))}
      </div>

      <div className="ticker-strip">
        <span className="pill live">
          <span className="led pulse" />
          {data.source === "rpc" || data.source === "ws" ? "LIVE" : "SIM"}
        </span>
        <span className="tk dim">
          XMR <b className="acc">${data.price.toFixed(2)}</b>
          <em className={data.change24h < 0 ? "dn" : ""}>
            {data.change24h >= 0 ? "+" : ""}{data.change24h.toFixed(2)}%
          </em>
        </span>
        <span className="tk dim">
          BTC <b>${Math.round(data.btc).toLocaleString()}</b>
          <em className={data.btcChg < 0 ? "dn" : ""}>
            {data.btcChg >= 0 ? "+" : ""}{data.btcChg.toFixed(2)}%
          </em>
        </span>
        <Link to="/design" className="tk dim" style={{ textDecoration: "none" }}>
          ⌘ DESIGN
        </Link>
      </div>
    </div>
  );
}
