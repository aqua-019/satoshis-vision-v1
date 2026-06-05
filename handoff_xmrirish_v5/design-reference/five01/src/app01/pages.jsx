// pages.jsx — XMRIRISH v5 · 0.1 pages
// Home · Mempool (5 view switcher) · Education · Dashboard · Monero · Simulate · Run a node · Design

/* ────────────────────────────────────────────────────────────────
   Page registry — view-switcher and protocol simulations
   ──────────────────────────────────────────────────────────────── */

const MEMPOOL_VIEWS = [
  { id: "classic",       label: "Classic",        sub: "cleaner / sleeker v4-style polish",            star: true,  component: () => window.ClassicView },
  { id: "reactor",       label: "Reactor",        sub: "v4 parity · search + track + 10-conf ribbon",               component: () => window.ReactorView },
  { id: "bridge",        label: "Ops Bridge",     sub: "12-pane mission control",                                    component: () => window.BridgeView },
  { id: "sediment",      label: "Sediment",       sub: "vertical core-sample tube",                                  component: () => window.SedimentView },
  { id: "constellation", label: "Constellation",  sub: "luminous network sphere",                                    component: () => window.ConstellationView },
  { id: "terminal",      label: "Terminal",       sub: "cli-first · monerod tail",                                   component: () => window.TerminalHubView },
];

const PROTOCOLS = [
  // — Protocol primitives —
  { id: "decoy",     label: "Decoy selection", kicker: "Time tide",         tone: "acc",  group: "Privacy primitive", sub: "Log-normal decoy sampling across the blockchain timeline.", component: () => window.DecoySelectionView },
  { id: "dandelion", label: "Dandelion++",     kicker: "Botanical bloom",   tone: "priv", group: "Privacy primitive", sub: "Stem-then-fluff propagation. Hides the origin peer.", component: () => window.DandelionView },
  { id: "viewtags",  label: "View tags",       kicker: "Lighthouse in fog", tone: "acc",  group: "Privacy primitive", sub: "256× wallet scan acceleration with a 1-byte hint.", component: () => window.ViewTagsView },
  { id: "ringct",    label: "RingCT",          kicker: "Assembly line",     tone: "acc",  group: "Privacy primitive", sub: "Five cryptographic stations: from output to confidential tx.", component: () => window.RingctView },
  { id: "stealth",   label: "Stealth address", kicker: "Two-key chamber",   tone: "priv", group: "Privacy primitive", sub: "Diffie-Hellman exchange across silent rooms.", component: () => window.StealthView },
  { id: "fcmp",      label: "FCMP++",          kicker: "Murmuration",       tone: "priv", group: "Privacy primitive", sub: "Ring of 16 → anonymity set of 150M+ outputs.", component: () => window.FcmpView },

  // — Economics & policy —
  { id: "hearth",    label: "Eternal hearth",  kicker: "Tail emission",     tone: "acc",  group: "Economics",         sub: "The fireplace that refuses to go cold. 0.6 XMR / block forever.", component: () => window.HearthView },
  { id: "silo",      label: "Grain silo",      kicker: "Monetary policy",   tone: "acc",  group: "Economics",         sub: "Two faucets, two silos. Bitcoin shuts off. Monero never does.", component: () => window.SiloView },
  { id: "auction",   label: "Bidding auction", kicker: "Fee market",        tone: "acc",  group: "Economics",         sub: "Every 2 minutes the hammer drops on the highest-paddle paddles.", component: () => window.AuctionView },

  // — Consensus & dynamics —
  { id: "metronome", label: "Metronome",       kicker: "Block target",      tone: "acc",  group: "Consensus",         sub: "120 seconds, forever. The chain that ticks like clockwork.", component: () => window.MetronomeView },
  { id: "thermostat",label: "Thermostat",      kicker: "Difficulty",        tone: "acc",  group: "Consensus",         sub: "Per-block feedback that holds the block time at 2:00.", component: () => window.ThermostatView },
  { id: "skyline",   label: "City skyline",    kicker: "Pool decentralization", tone: "acc",  group: "Consensus",     sub: "Mining pools as buildings. The cathedral is P2Pool.", component: () => window.SkylineView },

  // — Adversarial / Crypto —
  { id: "bloodhound",label: "Bloodhound",      kicker: "Privacy defense",   tone: "priv", group: "Adversarial",       sub: "Six stations. The hound loses the trail at every one.", component: () => window.BloodhoundView },
  { id: "balance",   label: "Balance",         kicker: "Confidential amounts", tone: "priv", group: "Cryptography",   sub: "Envelopes on a balance. Verifies without disclosing.", component: () => window.BalanceView },
];

window.MEMPOOL_VIEWS = MEMPOOL_VIEWS;
window.PROTOCOLS = PROTOCOLS;

/* ────────────────────────────────────────────────────────────────
   Shared atoms used by pages
   ──────────────────────────────────────────────────────────────── */

function ViewTabs({ items, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "stretch", flexWrap: "wrap" }}>
      {items.map((it) => {
        const on = it.id === active;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onChange(it.id)}
            style={{
              appearance: "none", cursor: "pointer", background: "transparent",
              border: "1px solid " + (on ? "var(--tk-accent)" : "var(--ink-10)"),
              color: on ? "var(--tk-accent)" : "var(--ink-60)",
              padding: "8px 12px",
              fontFamily: "var(--f-mono)", fontSize: 11,
              letterSpacing: "0.12em", textTransform: "uppercase",
              boxShadow: on ? "var(--glow-1)" : "none",
              display: "flex", flexDirection: "column", gap: 2,
              textAlign: "left", minWidth: 140,
            }}
          >
            <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {it.star ? <span style={{ color: "var(--tk-accent)" }}>★</span> : null}
              {it.label}
            </span>
            <span style={{ fontSize: 9.5, color: "var(--ink-40)", letterSpacing: "0.06em", textTransform: "none" }}>{it.sub}</span>
          </button>
        );
      })}
    </div>
  );
}

function Card({ children, onClick, accentBorder, style }) {
  return (
    <div
      role={onClick ? "button" : undefined}
      onClick={onClick}
      className="panel"
      style={{
        cursor: onClick ? "pointer" : "default",
        borderColor: accentBorder ? "var(--tk-accent)" : "var(--rule)",
        transition: "transform 0.18s, border-color 0.18s, box-shadow 0.18s",
        ...style,
      }}
      onMouseEnter={(e) => { if (onClick) { e.currentTarget.style.borderColor = "var(--tk-accent)"; e.currentTarget.style.boxShadow = "var(--glow-1)"; } }}
      onMouseLeave={(e) => { if (onClick) { e.currentTarget.style.borderColor = accentBorder ? "var(--tk-accent)" : "var(--rule)"; e.currentTarget.style.boxShadow = "none"; } }}
    >
      <span className="tick tl" /><span className="tick tr" /><span className="tick bl" /><span className="tick br" />
      {children}
    </div>
  );
}

window.ViewTabs = ViewTabs;
window.Card = Card;

/* ────────────────────────────────────────────────────────────────
   HOME · hero + live ticker + recent blocks teaser + nav grid
   ──────────────────────────────────────────────────────────────── */

function HomePage({ data, navigate }) {
  return (
    <AppShell active="home" data={data} hideRail bg={{ intensity: "busy" }}>
      <div style={{ padding: "32px 48px 48px", display: "flex", flexDirection: "column", gap: 36, maxWidth: 1600, margin: "0 auto", width: "100%" }}>

        <Crumbs items={["xmr.irish", "v5.0", "home"]} status="Network nominal" />

        {/* Hero */}
        <section style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 32, alignItems: "stretch" }}>
          <Card style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: 16, justifyContent: "center" }}>
            <div className="kicker">a privacy network · since 2014</div>
            <h1 className="serif" style={{ margin: 0, fontSize: 34, lineHeight: 1.12, fontWeight: 400, letterSpacing: "-0.01em", color: "var(--ink-80)", maxWidth: "22ch" }}>
              Every Monero output is hiding{" "}
              <em style={{ color: "var(--tk-accent)", fontStyle: "normal", textShadow: "var(--glow-1)" }}>somewhere</em>{" "}
              in <em style={{ color: "var(--p-50)", fontStyle: "normal" }}>this cloud</em>.
            </h1>
            <p className="mono" style={{ margin: 0, maxWidth: "52ch", fontSize: 12, lineHeight: 1.7, letterSpacing: "0.02em", color: "var(--ink-60)" }}>
              An anonymity set of <b style={{ color: "var(--p-50)" }}>{(150_000_000).toLocaleString()}+</b> outputs.
              Live mempool, protocol explainers, an interactive simulator for every privacy primitive in the stack — RingCT, Stealth addresses, Dandelion++, View tags, FCMP++.
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button type="button" onClick={() => navigate("/mempool")} className="proto-btn">Open mempool →</button>
              <button type="button" onClick={() => navigate("/education")} className="proto-btn" style={{ borderColor: "var(--p-50)", color: "var(--p-50)" }}>Learn the protocols</button>
            </div>
          </Card>

          {/* Live ticker card */}
          <Card style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div className="kicker">Live · {data.source}</div>
              <Pill tone="live" dot>SYNCED</Pill>
            </div>
            <div>
              <div className="mono dim" style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase" }}>XMR / USD</div>
              <div className="mono acc glow" style={{ fontSize: 30, fontWeight: 500, lineHeight: 1, marginTop: 6 }}>${data.price.toFixed(2)}</div>
              <div className="mono" style={{ marginTop: 6, fontSize: 12, color: data.change24h >= 0 ? "var(--g-50)" : "var(--r-50)" }}>
                {data.change24h >= 0 ? "▲" : "▼"} {Math.abs(data.change24h).toFixed(2)}% · 24h
              </div>
            </div>
            <Sparkline data={data.priceSeries.slice(-90)} width={420} height={90} color="var(--tk-accent)" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              <Stat k="Block height" v={data.height.toLocaleString()} sub="live" tone="acc" />
              <Stat k="Hashrate" v={(data.hashrate / 1e9).toFixed(2) + " GH/s"} sub="2:00 target" />
              <Stat k="Mempool" v={data.mempool.length + " tx"} sub={fmtBytes(data.mempool.reduce((a, t) => a + t.size, 0))} />
            </div>
          </Card>
        </section>

        {/* Recent blocks ribbon */}
        <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="kicker">Recent blocks · last {data.blocks.length}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(14, 1fr)", gap: 8 }}>
            {data.blocks.slice(0, 14).map((b, i) => (
              <div key={b.height} className={"mblock " + (i > 0 ? "" : "")}>
                <div className="hh">#{b.height.toString().slice(-5)}</div>
                <div className="nm">{b.txs}</div>
                <div className="sz">{b.sizeKB.toFixed(1)}KB · {b.pool.split(" ")[0]}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Where to go */}
        <section>
          <div className="kicker" style={{ marginBottom: 12 }}>The site · 7 surfaces</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {[
              { k: "mempool",   t: "Mempool",       d: "5 visualisations. Reactor · Bridge · Sediment · Constellation · Terminal.", c: "var(--tk-accent)" },
              { k: "education", t: "Education",     d: "Six metaphor-driven protocol simulators. Decoy, Dandelion++, view tags, RingCT, stealth, FCMP++.", c: "var(--p-50)" },
              { k: "dashboard", t: "Dashboard",     d: "Hashrate, pools, peers, difficulty curve, fork-readiness. The numbers, with HUDs.", c: "var(--c-50)" },
              { k: "monero",    t: "Monero",        d: "Origin story, tail emission, the eternal hearth. Why this coin won't die.", c: "var(--g-50)" },
              { k: "simulate",  t: "Simulate",      d: "Run any protocol with knobs. Spend a stealth output, watch RingCT sign.", c: "var(--p-50)" },
              { k: "node",      t: "Run a node",    d: "monerod in one command. Tor + I2P optional. Free seed peers.", c: "var(--y-50)" },
              { k: "design",    t: "Design hub",    d: "Five mempool directions side-by-side on a canvas. For internal review.", c: "var(--ink-60)" },
            ].map((s) => (
              <Card key={s.k} onClick={() => navigate(s.k === "design" ? "/design" : "/" + s.k)} style={{ padding: 14 }}>
                <div className="mono" style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: s.c }}>{s.t}</div>
                <p className="mono" style={{ margin: "8px 0 0", fontSize: 11.5, lineHeight: 1.55, color: "var(--ink-60)" }}>{s.d}</p>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

/* ────────────────────────────────────────────────────────────────
   MEMPOOL · 5 switchable views
   ──────────────────────────────────────────────────────────────── */

function MempoolPage({ data, bg, navigate, params }) {
  const initial = MEMPOOL_VIEWS.find((v) => v.id === params.v)?.id || "classic";
  const [active, setActive] = React.useState(initial);
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    if (params.v && params.v !== active) setActive(params.v);
    // eslint-disable-next-line
  }, [params.v]);

  const View = (MEMPOOL_VIEWS.find((v) => v.id === active)?.component() || (() => null));
  const activeMeta = MEMPOOL_VIEWS.find((v) => v.id === active);

  const onSwitch = (id) => {
    setActive(id);
    setOpen(false);
    navigate("/mempool?v=" + id);
  };

  // Each mempool view brings its OWN NavTop/NetRail/Footer/art-stage.
  // We render the view directly and float a dropdown selector in the
  // top-right under the topbar.
  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <View data={data} bg={bg} />

      {/* Floating dropdown · top-right under the topbar */}
      <div style={{ position: "fixed", top: 60, right: 16, zIndex: 50, width: 260 }}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          style={{
            appearance: "none", cursor: "pointer", width: "100%",
            background: "rgba(5,5,5,0.9)", backdropFilter: "blur(8px)",
            border: "1px solid var(--tk-accent)", borderRadius: 2,
            color: "var(--ink-100)", padding: "10px 12px",
            fontFamily: "var(--f-mono)", fontSize: 11,
            letterSpacing: "0.08em", textTransform: "uppercase",
            display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 10, alignItems: "center",
            boxShadow: "var(--glow-1)", textAlign: "left",
          }}
          aria-expanded={open}
        >
          <span className="kicker" style={{ color: "var(--ink-40)" }}>VIEW</span>
          <span style={{ color: "var(--tk-accent)", textShadow: "var(--glow-1)" }}>
            {activeMeta?.star ? "★ " : ""}{activeMeta?.label || "—"}
          </span>
          <span style={{ color: "var(--ink-60)", fontSize: 9 }}>{open ? "▲" : "▼"}</span>
        </button>

        {open ? (
          <div style={{
            marginTop: 6,
            background: "rgba(5,5,5,0.94)", backdropFilter: "blur(10px)",
            border: "1px solid var(--rule)", borderRadius: 2,
            display: "flex", flexDirection: "column",
            boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
          }}>
            <div className="kicker" style={{ padding: "10px 12px 6px", color: "var(--ink-40)", borderBottom: "1px dashed var(--ink-10)" }}>
              Mempool · 5 directions
            </div>
            {MEMPOOL_VIEWS.map((it) => {
              const on = it.id === active;
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => onSwitch(it.id)}
                  style={{
                    appearance: "none", cursor: "pointer", textAlign: "left",
                    background: on ? "rgba(255,122,26,0.08)" : "transparent",
                    border: 0,
                    borderLeft: "3px solid " + (on ? "var(--tk-accent)" : "transparent"),
                    color: on ? "var(--tk-accent)" : "var(--ink-80)",
                    padding: "10px 12px",
                    fontFamily: "var(--f-mono)", fontSize: 11,
                    display: "flex", flexDirection: "column", gap: 2,
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                  onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    <span>{it.star ? "★ " : ""}{it.label}</span>
                    {on ? <span style={{ fontSize: 9, color: "var(--tk-accent)" }}>● ACTIVE</span> : null}
                  </span>
                  <span style={{ fontSize: 10, color: "var(--ink-40)", letterSpacing: "0.02em" }}>{it.sub}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* Click-outside catcher */}
      {open ? (
        <div
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 49 }}
        />
      ) : null}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   EDUCATION · 6 protocol cards
   ──────────────────────────────────────────────────────────────── */

function EducationPage({ data, navigate }) {
  // Group protocols by category, preserving array order within each group.
  const grouped = PROTOCOLS.reduce((acc, p) => {
    const g = p.group || "Other";
    (acc[g] = acc[g] || []).push(p);
    return acc;
  }, {});
  const groupOrder = ["Privacy primitive", "Cryptography", "Consensus", "Economics", "Adversarial"];

  return (
    <AppShell active="education" data={data} hideRail bg={{ intensity: "calm" }}>
      <div style={{ padding: "32px 48px 48px", display: "flex", flexDirection: "column", gap: 32, maxWidth: 1600, margin: "0 auto", width: "100%" }}>
        <Crumbs items={["xmr.irish", "v5.0", "education"]} />
        <PageHeader
          kicker={`${PROTOCOLS.length} simulators · ${groupOrder.length} disciplines`}
          title='The privacy stack, <em style="color:var(--p-50);font-style:normal">explained visually</em>.'
          sub="Click into any simulator. The metaphor comes first. The math comes second."
          right={
            <>
              <Pill tone="acc" dot>{PROTOCOLS.length}</Pill>
              <span className="mono dim" style={{ fontSize: 11 }}>simulators</span>
            </>
          }
        />

        {groupOrder.map((g) => {
          const items = grouped[g] || [];
          if (!items.length) return null;
          return (
            <section key={g} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", borderBottom: "1px solid var(--rule)", paddingBottom: 6 }}>
                <h3 className="serif" style={{ margin: 0, fontSize: 18, fontWeight: 400, color: "var(--ink-100)", letterSpacing: "-0.005em" }}>{g}</h3>
                <span className="mono dim" style={{ fontSize: 10.5, letterSpacing: "0.16em", textTransform: "uppercase" }}>{items.length} · simulators</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                {items.map((p) => (
                  <Card key={p.id} onClick={() => navigate("/simulate?p=" + p.id)}
                    style={{ padding: 20, minHeight: 196, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div>
                      <div className="kicker" style={{ color: p.tone === "priv" ? "var(--p-50)" : "var(--tk-accent)" }}>{p.kicker}</div>
                      <h4 className="serif" style={{ margin: "8px 0 6px", fontSize: 21, fontWeight: 400, color: "var(--ink-100)" }}>{p.label}</h4>
                      <p className="mono dim" style={{ margin: 0, fontSize: 11.5, lineHeight: 1.55 }}>{p.sub}</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
                      <span className={"proto-badge " + (p.tone === "priv" ? "priv" : "acc")}>{p.group}</span>
                      <span className="mono" style={{ fontSize: 11, color: "var(--tk-accent)" }}>open →</span>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          );
        })}

        {/* Future ideas — still in METAPHORS.md but unbuilt */}
        <Card style={{ padding: 22, marginTop: 8 }}>
          <div className="kicker">Coming next · from METAPHORS.md</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginTop: 10 }}>
            {[
              ["Handshake over a chasm", "Atomic swaps"],
              ["The keyholder split", "View vs spend key"],
              ["Post-office mailboxes", "Sub-addresses"],
              ["Pneumatic tubes", "Tor + I2P routing"],
              ["Grain of sand", "Atomic units · piconero"],
              ["The wax seal", "CLSAG signing"],
              ["The inkpad stamp", "Key images"],
              ["The press", "Bulletproofs+ compression"],
            ].map(([m, c], i) => (
              <div key={i} style={{ borderLeft: "2px solid var(--ink-10)", padding: "6px 10px" }}>
                <div className="serif" style={{ fontSize: 14, color: "var(--ink-80)" }}>{m}</div>
                <div className="mono dim" style={{ fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 2 }}>{c}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

/* ────────────────────────────────────────────────────────────────
   SIMULATE · one protocol full-bleed with stage + panel
   ──────────────────────────────────────────────────────────────── */

function SimulatePage({ data, bg, navigate, params }) {
  const initial = PROTOCOLS.find((p) => p.id === params.p)?.id || "decoy";
  const [active, setActive] = React.useState(initial);
  React.useEffect(() => { if (params.p && params.p !== active) setActive(params.p); }, [params.p]);

  const meta = PROTOCOLS.find((p) => p.id === active);
  const View = meta?.component() || (() => null);

  const onSwitch = (id) => { setActive(id); navigate("/simulate?p=" + id); };

  return (
    <AppShell active="simulate" data={data} hideRail fluid bg={{ intensity: "calm" }}>
      <div style={{ height: "100%", display: "grid", gridTemplateRows: "auto 1fr" }}>
        <div style={{ padding: "12px 20px", display: "flex", gap: 18, alignItems: "center", borderBottom: "1px solid var(--rule)" }}>
          <Crumbs items={["xmr.irish", "v5.0", "simulate", meta?.label || "—"]} />
          <div style={{ flex: 1 }} />
          <ViewTabs items={PROTOCOLS.map((p) => ({ id: p.id, label: p.label, sub: p.kicker }))} active={active} onChange={onSwitch} />
        </div>
        <div style={{ position: "relative", overflow: "hidden" }}>
          <View data={data} bg={bg} />
        </div>
      </div>
    </AppShell>
  );
}

/* ────────────────────────────────────────────────────────────────
   DASHBOARD · network telemetry, KPI-dense, no view-as-art
   ──────────────────────────────────────────────────────────────── */

function DashboardPage({ data }) {
  return (
    <AppShell active="dashboard" data={data} bg={{ intensity: "calm" }}>
      <Crumbs items={["xmr.irish", "v5.0", "dashboard"]} status="Polling 30s" />
      <PageHeader
        kicker="Network telemetry · live"
        title='Dashboard — the <em style="color:var(--tk-accent);text-shadow:var(--glow-1);font-style:normal">numbers</em>.'
        sub="One column: KPIs you check every morning. Pools, peers, difficulty, fee curve."
        right={<><Pill tone="live" dot>LIVE</Pill><Pill>UPDATED {new Date(data.lastUpdate).toISOString().slice(11, 19)}</Pill></>}
      />

      {/* KPI row */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
        <Stat k="Block height" v={data.height.toLocaleString()} sub="live · CG" tone="acc" />
        <Stat k="Hashrate" v={(data.hashrate / 1e9).toFixed(2) + " GH/s"} sub="vs 5.8 last wk" />
        <Stat k="Difficulty" v={(data.difficulty / 1e9).toFixed(2) + "G"} sub="adj every 720" />
        <Stat k="Peers" v={data.peers.length} sub={data.peerOut + " out · " + data.peerIn + " in"} />
        <Stat k="Mempool" v={data.mempool.length + " tx"} sub={fmtBytes(data.mempool.reduce((a, t) => a + t.size, 0))} />
        <Stat k="Fork" v="v16" sub="FCMP++ Q3" tone="p" />
      </section>

      {/* Charts row */}
      <section style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 12 }}>
        <PanelFrame title="Hashrate · 7d" right={<span>GH/s</span>}>
          <Sparkline data={data.hashSeries} width={680} height={140} color="var(--tk-accent)" />
        </PanelFrame>
        <PanelFrame title="Price · 7d (CG)" right={<span>USD</span>}>
          <Sparkline data={data.priceSeries} width={420} height={140} color="var(--c-50)" />
        </PanelFrame>
        <PanelFrame title="Fee histogram" right={<span>piconero / B</span>}>
          <MiniBar data={data.feeHist} width={420} height={140} color="var(--p-50)" />
        </PanelFrame>
      </section>

      {/* Pools + Peers row */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <PanelFrame title="Pool distribution" right={<span>last 24h shares</span>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "4px 0" }}>
            {data.poolDist.map((p) => (
              <div key={p.name} style={{ display: "grid", gridTemplateColumns: "160px 1fr 80px 70px", gap: 10, alignItems: "center", fontSize: 11 }} className="mono">
                <span style={{ color: "var(--ink-80)" }}>
                  <span className="led" style={{ background: p.color, boxShadow: "0 0 6px " + p.color }} />
                  {p.name}
                </span>
                <span style={{ height: 8, background: "var(--ink-10)", position: "relative", borderRadius: 1 }}>
                  <span style={{ position: "absolute", inset: "0 auto 0 0", width: (p.share * 100).toFixed(1) + "%", background: p.color, boxShadow: "0 0 8px " + p.color }} />
                </span>
                <span className="dim" style={{ textAlign: "right" }}>{(p.share * 100).toFixed(1)}%</span>
                <span style={{ color: p.rec ? "var(--g-50)" : "var(--ink-40)", textTransform: "uppercase", fontSize: 9.5, letterSpacing: "0.12em" }}>{p.type}</span>
              </div>
            ))}
          </div>
        </PanelFrame>
        <PanelFrame title="Peers · live · 12" right={<span>{data.peers.length} connected</span>}>
          <div className="peerlist" style={{ fontSize: 11 }}>
            {data.peers.map((p, i) => (
              <div className="row" key={i} style={{ gridTemplateColumns: "14px 1fr 60px 50px 60px" }}>
                <span className={"led " + (p.lat < 60 ? "" : p.lat < 100 ? "q" : "o")} style={{ width: 5, height: 5 }} />
                <span style={{ color: "var(--ink-80)" }}>{p.ip}</span>
                <span className="dim">{p.cnt}</span>
                <span className="dim">{p.lat}ms</span>
                <span className="dim">#{p.h}</span>
              </div>
            ))}
          </div>
        </PanelFrame>
      </section>

      {/* Recent blocks table */}
      <PanelFrame title="Recent blocks" right={<span>height ↓</span>}>
        <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 60px 80px 80px 110px 60px", gap: 10, fontSize: 11 }} className="mono">
          {["#", "Hash", "Txs", "Size", "Reward", "Pool", "Age"].map((h, i) => (
            <div key={i} className="kicker" style={{ borderBottom: "1px solid var(--rule)", paddingBottom: 6, marginBottom: 2 }}>{h}</div>
          ))}
          {data.blocks.slice(0, 10).map((b) => (
            <React.Fragment key={b.height}>
              <span className="acc">{b.height.toLocaleString()}</span>
              <span style={{ color: "var(--c-50)" }}>{ShortHash(b.hash)}</span>
              <span>{b.txs}</span>
              <span className="dim">{b.sizeKB.toFixed(1)} KB</span>
              <span className="up">{b.reward.toFixed(3)}</span>
              <span style={{ color: "var(--ink-80)" }}>{b.pool}</span>
              <span className="dim">{Math.floor(b.age / 60)}m{b.age % 60}s</span>
            </React.Fragment>
          ))}
        </div>
      </PanelFrame>
    </AppShell>
  );
}

/* ────────────────────────────────────────────────────────────────
   MONERO · educational landing
   ──────────────────────────────────────────────────────────────── */

function MoneroPage({ data, navigate }) {
  return (
    <AppShell active="monero" data={data} hideRail bg={{ intensity: "calm" }}>
      <div style={{ padding: "32px 48px 48px", display: "flex", flexDirection: "column", gap: 32, maxWidth: 1400, margin: "0 auto", width: "100%" }}>
        <Crumbs items={["xmr.irish", "v5.0", "monero"]} />
        <PageHeader
          kicker="Origin · philosophy · why now"
          title='A coin that <em style="color:var(--tk-accent);text-shadow:var(--glow-1);font-style:normal">refuses</em> to know who you are.'
          sub="Eleven years old. No premine, no founder reward, no on-chain identity. Built by a rotating cast of cypherpunks."
        />
        {/* Three pillars */}
        <section style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {[
            { c: "var(--tk-accent)", k: "Private by default", t: "Every transaction.", b: "Bitcoin's privacy is opt-in and circumstantial. Monero's is mandatory at the protocol layer — every sender, recipient, and amount is hidden by construction." },
            { c: "var(--p-50)",      k: "Fungible by design", t: "1 XMR ≡ 1 XMR.",    b: "No coin has a transparent history. Exchanges can't blacklist outputs because there are no addresses on chain to blacklist." },
            { c: "var(--g-50)",      k: "Permanent emission", t: "0.6 XMR forever.",  b: "The tail emission keeps miners paid into deep time. There is no \"security budget cliff\" — the hearth stays lit." },
          ].map((p, i) => (
            <Card key={i} style={{ padding: 22 }}>
              <div className="kicker" style={{ color: p.c }}>{p.k}</div>
              <div className="serif" style={{ fontSize: 28, fontWeight: 500, color: "var(--ink-100)", margin: "8px 0" }}>{p.t}</div>
              <p className="mono dim" style={{ margin: 0, fontSize: 12, lineHeight: 1.65 }}>{p.b}</p>
            </Card>
          ))}
        </section>

        {/* Timeline */}
        <Card style={{ padding: 28 }}>
          <div className="kicker">Timeline · the lineage</div>
          <div style={{ position: "relative", marginTop: 24, paddingLeft: 18, borderLeft: "1px dashed var(--ink-20)", display: "flex", flexDirection: "column", gap: 18 }}>
            {[
              { y: "2012", t: "CryptoNote whitepaper", b: "Anonymous author 'Nicolas van Saberhagen' publishes the foundational privacy framework — ring signatures and stealth addresses." },
              { y: "2014", t: "Monero forks from Bytecoin", b: "thankful_for_today proposes BitMonero. Community rejects the premine; fork to Monero v0.1 in April." },
              { y: "2017", t: "RingCT mandatory", b: "Confidential transactions hide amounts on every transaction. No opt-out — fungibility by force." },
              { y: "2018", t: "Bulletproofs", b: "Range proofs shrink ~80%. Fees drop. The 'private but bloated' tradeoff dissolves." },
              { y: "2022", t: "Ring size 16 · CLSAG", b: "Permanent ring-16. Plausible-deniability for every output gets a 16× multiplier." },
              { y: "2024", t: "Bulletproofs+ · view tags", b: "Wallet sync gets 30-40% faster. Verification cost drops. The math gets quieter." },
              { y: "2026", t: "FCMP++ ←  you are here", b: "Full-chain Membership Proofs. Anonymity set goes from 16 to 150M+. The end-state of CryptoNote." },
            ].map((e, i) => (
              <div key={i} style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: -25, top: 6, width: 12, height: 12, borderRadius: "50%", border: "1px solid var(--tk-accent)", background: "var(--bg-0)", boxShadow: "var(--glow-1)" }} />
                <div className="mono" style={{ fontSize: 10, letterSpacing: "0.18em", color: "var(--tk-accent)", textShadow: "var(--glow-1)" }}>{e.y}</div>
                <div className="serif" style={{ fontSize: 20, fontWeight: 500, color: "var(--ink-100)", marginTop: 2 }}>{e.t}</div>
                <p className="mono dim" style={{ margin: "4px 0 0", fontSize: 11.5, lineHeight: 1.6, maxWidth: "70ch" }}>{e.b}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* CTA */}
        <Card style={{ padding: 24, display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 24 }}>
          <div>
            <div className="kicker">Want to feel it?</div>
            <div className="serif" style={{ fontSize: 26, color: "var(--ink-100)", marginTop: 6 }}>Walk through every primitive that makes the privacy work.</div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={() => navigate("/education")} className="proto-btn" style={{ borderColor: "var(--p-50)", color: "var(--p-50)", boxShadow: "var(--glow-p)" }}>Education →</button>
            <button type="button" onClick={() => navigate("/simulate")} className="proto-btn">Simulate →</button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

/* ────────────────────────────────────────────────────────────────
   RUN A NODE · setup guide
   ──────────────────────────────────────────────────────────────── */

function NodePage({ data }) {
  const [copied, setCopied] = React.useState(null);
  const copy = (cmd, k) => {
    try { navigator.clipboard.writeText(cmd); setCopied(k); setTimeout(() => setCopied(null), 1500); } catch (e) {}
  };
  const Cmd = ({ id, cmd, c }) => (
    <div className="panel" style={{ padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <code className="mono" style={{ color: "var(--c-50)", fontSize: 13 }}>{c || "$"} <span style={{ color: "var(--ink-100)" }}>{cmd}</span></code>
      <button type="button" className="proto-btn" style={{ padding: "5px 10px", fontSize: 10 }} onClick={() => copy(cmd, id)}>{copied === id ? "✓ COPIED" : "COPY"}</button>
    </div>
  );

  return (
    <AppShell active="node" data={data} hideRail bg={{ intensity: "calm" }}>
      <div style={{ padding: "32px 48px 48px", display: "flex", flexDirection: "column", gap: 28, maxWidth: 1200, margin: "0 auto", width: "100%" }}>
        <Crumbs items={["xmr.irish", "v5.0", "run a node"]} />
        <PageHeader
          kicker="monerod · five paths · pick one"
          title='Run a <em style="color:var(--tk-accent);text-shadow:var(--glow-1);font-style:normal">node</em>. Sovereign in 12 minutes.'
          sub="A full Monero node verifies every block. Yours, not someone else's. CLI on a Pi, Docker on a server, or click-to-install on macOS."
        />

        <section style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {[
            { l: "Disk", v: "~205 GB", s: "as of v16" },
            { l: "RAM", v: "4 GB min", s: "8 GB rec" },
            { l: "Bandwidth", v: "~5 GB/day", s: "after sync" },
            { l: "Initial sync", v: "8–24 hrs", s: "SSD strongly rec" },
          ].map((s) => <Stat key={s.l} k={s.l} v={s.v} sub={s.s} />)}
        </section>

        <Card style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div className="kicker" style={{ color: "var(--tk-accent)" }}>Quick path · docker · 60 seconds</div>
            <p className="mono dim" style={{ margin: "8px 0 14px", fontSize: 12 }}>The fastest way. Pulls the official image and starts a pruned node listening on 18089. Replace <code>~/xmr-data</code> with your storage path.</p>
          </div>
          <Cmd id="docker-1" cmd="docker volume create monerod-data" />
          <Cmd id="docker-2" cmd="docker run -d --name monerod --restart=always -p 18080:18080 -p 18089:18089 -v monerod-data:/home/monero/.bitmonero sethsimmons/simple-monerod:latest --prune-blockchain --rpc-restricted-bind-ip=0.0.0.0 --rpc-restricted-bind-port=18089" />
          <Cmd id="docker-3" cmd="docker logs -f monerod" />
        </Card>

        <Card style={{ padding: 22 }}>
          <div className="kicker" style={{ color: "var(--p-50)" }}>Privacy path · Tor + I2P · 12 minutes</div>
          <p className="mono dim" style={{ margin: "8px 0 14px", fontSize: 12 }}>Add anonymity at the network layer. Your peers see neither your IP nor your geography. Recommended for any node you'll use as your wallet RPC backend.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            <ProtoStep n={1} title="Install Tor + I2P">apt install tor i2pd · enable systemd · open ports 9050 / 7656.</ProtoStep>
            <ProtoStep n={2} title="Configure monerod" on>Edit <code className="hash">monerod.conf</code>: add tx-proxy &amp; anonymous-inbound lines.</ProtoStep>
            <ProtoStep n={3} title="Verify routing">curl through Tor to check your <code className="hash">.onion</code> is reachable.</ProtoStep>
          </div>
        </Card>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {[
            { t: "macOS · click-to-install", b: "GUI bundle from getmonero.org. Pre-configured. Good first node." },
            { t: "Raspberry Pi 5 · headless", b: "External NVMe required. Pi 5 + 8GB SDRAM keeps up nicely." },
            { t: "Bare metal · monerod -d",  b: "Build from source. ~12 min on a modern CPU. Pinned releases on getmonero.org." },
          ].map((p, i) => (
            <Card key={i} style={{ padding: 16 }}>
              <div className="serif" style={{ fontSize: 17, color: "var(--ink-100)" }}>{p.t}</div>
              <p className="mono dim" style={{ margin: "8px 0 0", fontSize: 11.5, lineHeight: 1.55 }}>{p.b}</p>
            </Card>
          ))}
        </section>

        {/* Status check */}
        <Card style={{ padding: 22 }}>
          <div className="kicker">After sync · sanity check</div>
          <div className="mono" style={{ marginTop: 10, fontSize: 12, lineHeight: 1.8, color: "var(--ink-80)" }}>
            <div><span style={{ color: "var(--c-50)" }}>$</span> curl <span style={{ color: "var(--ink-100)" }}>http://localhost:18089/get_info</span> | jq <span style={{ color: "var(--g-50)" }}>'.height, .target, .nettype'</span></div>
            <div className="dim" style={{ marginTop: 6 }}>Expected: <span className="acc">{data.height.toLocaleString()}</span> · 120 · "mainnet"</div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

/* ────────────────────────────────────────────────────────────────
   DESIGN · embed legacy canvas hub
   ──────────────────────────────────────────────────────────────── */

function DesignPage({ data }) {
  return (
    <AppShell active="design" data={data} hideRail fluid bg={{ intensity: "calm" }}>
      <div style={{ height: "100%", display: "grid", gridTemplateRows: "auto 1fr" }}>
        <div style={{ padding: "12px 20px", display: "flex", gap: 18, alignItems: "center", borderBottom: "1px solid var(--rule)" }}>
          <Crumbs items={["xmr.irish", "v5.0", "design hub"]} status="Internal · review surface" />
          <div style={{ flex: 1 }} />
          <a href="design-hub.html" target="_blank" className="proto-btn" style={{ textDecoration: "none", padding: "6px 12px", fontSize: 10 }}>OPEN STANDALONE ↗</a>
        </div>
        <iframe src="design-hub.html" title="Design hub" style={{ border: 0, width: "100%", height: "100%" }} />
      </div>
    </AppShell>
  );
}

/* ────────────────────────────────────────────────────────────────
   404
   ──────────────────────────────────────────────────────────────── */

function NotFoundPage({ data, navigate }) {
  return (
    <AppShell active="" data={data} hideRail bg={{ intensity: "calm" }}>
      <div style={{ padding: "60px 48px", display: "flex", flexDirection: "column", gap: 18, alignItems: "center", textAlign: "center" }}>
        <div className="mono acc glow" style={{ fontSize: 96, letterSpacing: "0.05em" }}>404</div>
        <div className="serif" style={{ fontSize: 28, color: "var(--ink-100)" }}>This page is not in the mempool.</div>
        <p className="mono dim" style={{ maxWidth: "50ch", fontSize: 12, lineHeight: 1.6 }}>The route you tried doesn't exist in 0.1 yet. Try the nav above, or jump straight to the live mempool.</p>
        <button type="button" onClick={() => navigate("/")} className="proto-btn">← HOME</button>
      </div>
    </AppShell>
  );
}

Object.assign(window, {
  HomePage, MempoolPage, EducationPage, SimulatePage,
  DashboardPage, NodePage, DesignPage, NotFoundPage,
  // MoneroPage handled by monero-pages.jsx (loads after this file).
});
