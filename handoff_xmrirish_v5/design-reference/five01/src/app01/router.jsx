// router.jsx — minimal hash router + page-aware NavTop
// Exposes: useHashRoute, NavTopApp, AppShell, PageHeader

function useHashRoute() {
  const [hash, setHash] = React.useState(() => location.hash || "#/");
  React.useEffect(() => {
    const fn = () => setHash(location.hash || "#/");
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  const raw = hash.replace(/^#/, "") || "/";
  const [path, qs = ""] = raw.split("?");
  const params = Object.fromEntries(new URLSearchParams(qs));
  const segments = path.split("/").filter(Boolean);
  // Top-level key: first segment, or "" for "/".
  const topKey = segments[0] || "";
  const navigate = (to) => {
    if (typeof to !== "string") return;
    location.hash = to.startsWith("#") ? to : "#" + (to.startsWith("/") ? to : "/" + to);
  };
  return { path, segments, topKey, params, hash, navigate };
}

// Map nav key → URL
const NAV = [
  { k: "home",      label: "Home",      href: "#/"           },
  { k: "mempool",   label: "Mempool",   href: "#/mempool"    },
  { k: "education", label: "Education", href: "#/education"  },
  { k: "dashboard", label: "Dashboard", href: "#/dashboard"  },
  { k: "monero",    label: "Monero",    href: "#/monero"     },
  { k: "simulate",  label: "Simulate",  href: "#/simulate"   },
  { k: "node",      label: "Run a node", href: "#/node"      },
];

function NavTopApp({ active, data }) {
  return (
    <div className="topbar">
      <a href="#/" className="brand" style={{ textDecoration: "none", color: "inherit" }}>
        <span className="brand-mark" />
        <span>xmr<b>.irish</b></span>
        <span className="kicker" style={{ marginLeft: 8 }}>v5.0 · 0.1</span>
      </a>
      <div className="topnav">
        <a href="#/"           className={active === "home" ? "on" : ""}>Home</a>
        <a href="#/mempool"    className={active === "mempool" ? "on" : ""}>Mempool</a>
        <a href="#/markets"    className={active === "markets" ? "on" : ""}>Markets</a>
        <a href="#/network"    className={active === "network" ? "on" : ""}>Network</a>
        <a href="#/monero"     className={active === "monero" ? "on" : ""}>Monero</a>
        <a href="#/education"  className={active === "education" ? "on" : ""}>Education</a>
        <a href="#/simulate"   className={active === "simulate" ? "on" : ""}>Simulate</a>
        <a href="#/node"       className={active === "node" ? "on" : ""}>Run a node</a>
      </div>
      <div className="ticker-strip">
        <span className="pill live">
          <span className="led pulse" />
          {data?.source === "coingecko" ? "LIVE" : "SIM"}
        </span>
        <span className="tk dim">
          XMR <b className="acc">${(data?.price ?? 0).toFixed(2)}</b>
          <em className={data?.change24h >= 0 ? "" : "dn"}>
            {data?.change24h >= 0 ? "+" : ""}{(data?.change24h ?? 0).toFixed(2)}%
          </em>
        </span>
        <span className="tk dim">
          BTC <b>${Math.round(data?.btc ?? 0).toLocaleString()}</b>
          <em className={data?.btcChg >= 0 ? "" : "dn"}>
            {data?.btcChg >= 0 ? "+" : ""}{(data?.btcChg ?? 0).toFixed(2)}%
          </em>
        </span>
        <a href="#/design" className="tk dim" style={{ textDecoration: "none", color: "var(--ink-40)" }}>⌘ DESIGN</a>
      </div>
    </div>
  );
}

function AppShell({ active, data, hideRail, fluid, scan, bg, children }) {
  return (
    <div className={"art " + (scan ? "scan-on" : "")} style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <ArtBackground intensity={bg?.intensity || "calm"} scan={scan} />
      <div className="art-stage" style={{ height: "100%" }}>
        <NavTopApp active={active} data={data} />
        <div className="shell" style={hideRail ? { gridTemplateColumns: "1fr" } : undefined}>
          {hideRail ? null : <NetRail data={data} />}
          <main className="main" style={fluid ? { padding: 0, overflow: "hidden" } : undefined}>
            {children}
          </main>
        </div>
        <Footer data={data} />
      </div>
    </div>
  );
}

function PageHeader({ kicker, title, sub, right }) {
  return (
    <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, padding: "4px 0 14px", borderBottom: "1px solid var(--rule)" }}>
      <div>
        {kicker ? <div className="kicker">{kicker}</div> : null}
        <h1 className="serif" style={{ margin: "6px 0 4px", fontSize: 26, fontWeight: 400, letterSpacing: "-0.01em", color: "var(--ink-80)" }}>
          <span dangerouslySetInnerHTML={{ __html: title }} />
        </h1>
        {sub ? <p className="mono dim" style={{ margin: 0, fontSize: 12, letterSpacing: "0.04em" }}>{sub}</p> : null}
      </div>
      {right ? <div style={{ display: "flex", gap: 10, alignItems: "center" }}>{right}</div> : null}
    </header>
  );
}

Object.assign(window, { useHashRoute, NavTopApp, AppShell, PageHeader, NAV });
