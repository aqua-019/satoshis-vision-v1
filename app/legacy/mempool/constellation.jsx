// v4-constellation.jsx — CONSTELLATION
// Network as a luminous sphere. Peers = points, txs = arcs.
// Map-style overview answering "where in the world is this tx right now?"

function NetSphere({ data, size = 600 }) {
  const tick = useTick(50);
  const cx = size / 2, cy = size / 2, r = size / 2 - 30;
  // Generate stable peer lat/long
  const peers = React.useMemo(() => {
    const arr = [];
    const N = 96;
    for (let i = 0; i < N; i++) {
      const lat = (Math.random() - 0.5) * Math.PI;
      const lon = Math.random() * Math.PI * 2;
      arr.push({ lat, lon, lat0: lat, lon0: lon, h: 3676070 - (Math.random() < 0.06 ? 1 : 0), agent: Math.random() < 0.85 ? "0.18.4.0" : "0.18.3.4", cnt: ["US", "DE", "FR", "NL", "JP", "BR", "AU", "GB", "CA", "SG"][Math.floor(Math.random() * 10)] });
    }
    return arr;
  }, []);

  const rot = (tick * 0.008) % (Math.PI * 2);

  // Active stem path (10 hops)
  const stem = React.useMemo(() => {
    const path = [];
    for (let i = 0; i < 10; i++) {
      const lat = (Math.random() - 0.5) * Math.PI;
      const lon = Math.random() * Math.PI * 2;
      path.push({ lat, lon });
    }
    return path;
  }, []);

  const project = (lat, lon) => {
    const lonR = lon + rot;
    const x = Math.cos(lat) * Math.sin(lonR);
    const z = Math.cos(lat) * Math.cos(lonR);
    const y = Math.sin(lat);
    return {
      x: cx + x * r,
      y: cy - y * r,
      z, // depth for opacity
    };
  };

  // Arcs — propagation events
  const arcs = React.useMemo(() => {
    const a = [];
    for (let i = 0; i < 16; i++) {
      a.push({
        a: { lat: (Math.random() - 0.5) * Math.PI, lon: Math.random() * Math.PI * 2 },
        b: { lat: (Math.random() - 0.5) * Math.PI, lon: Math.random() * Math.PI * 2 },
        progress: Math.random(),
        speed: 0.005 + Math.random() * 0.012,
        kind: i % 3 === 0 ? "stem" : "fluff",
      });
    }
    return a;
  }, []);
  arcs.forEach((a) => {
    a.progress = (a.progress + a.speed) % 1;
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
      <defs>
        <radialGradient id="sphereGrad" cx="40%" cy="35%">
          <stop offset="0%" stopColor="rgba(255,180,80,0.18)" />
          <stop offset="55%" stopColor="rgba(255,122,26,0.06)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.7)" />
        </radialGradient>
        <radialGradient id="atmoGrad">
          <stop offset="60%" stopColor="rgba(255,122,26,0)" />
          <stop offset="100%" stopColor="rgba(255,122,26,0.35)" />
        </radialGradient>
        <linearGradient id="arcGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,200,120,0)" />
          <stop offset="50%" stopColor="rgba(255,200,120,1)" />
          <stop offset="100%" stopColor="rgba(255,122,26,0)" />
        </linearGradient>
        <linearGradient id="arcGradP" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(184,122,255,0)" />
          <stop offset="50%" stopColor="rgba(184,122,255,1)" />
          <stop offset="100%" stopColor="rgba(184,122,255,0)" />
        </linearGradient>
        <filter id="sphGlow"><feGaussianBlur stdDeviation="3" /></filter>
      </defs>

      {/* atmosphere halo */}
      <circle cx={cx} cy={cy} r={r + 16} fill="url(#atmoGrad)" opacity="0.7" />
      {/* sphere body */}
      <circle cx={cx} cy={cy} r={r} fill="url(#sphereGrad)" stroke="rgba(255,122,26,0.25)" strokeWidth="0.5" />

      {/* equator + tropics */}
      {[-Math.PI / 3, -Math.PI / 6, 0, Math.PI / 6, Math.PI / 3].map((lat, i) => {
        const ry = Math.abs(Math.sin(lat)) * r;
        const rx = r * Math.cos(lat);
        return (
          <ellipse key={i} cx={cx} cy={cy - Math.sin(lat) * r} rx={rx} ry={Math.max(2, ry * 0.001 + 1)} fill="none"
            stroke="rgba(255,122,26,0.14)" strokeWidth="0.5" strokeDasharray="2 4" />
        );
      })}

      {/* meridians — drawn as ellipses rotated */}
      {[0, 30, 60, 90, 120, 150].map((deg, i) => {
        const w = Math.abs(Math.sin((deg + (rot * 180 / Math.PI)) * Math.PI / 180)) * r;
        return (
          <ellipse key={i} cx={cx} cy={cy} rx={Math.max(1, w)} ry={r} fill="none"
            stroke="rgba(255,122,26,0.1)" strokeWidth="0.5" />
        );
      })}

      {/* peers */}
      {peers.map((p, i) => {
        const pr = project(p.lat, p.lon);
        if (pr.z < -0.1) return null;
        const opacity = Math.max(0.15, (pr.z + 1) / 2);
        const sz = 1 + pr.z * 1.6;
        const color = p.h < 3676070 ? "#ffd400" : "#ff7a1a";
        return (
          <circle key={i} cx={pr.x} cy={pr.y} r={Math.max(0.8, sz)}
            fill={color} opacity={opacity}
            style={pr.z > 0.5 ? { filter: `drop-shadow(0 0 4px ${color})` } : undefined} />
        );
      })}

      {/* dandelion stem path */}
      {stem.map((s, i) => {
        if (i === stem.length - 1) return null;
        const a = project(s.lat, s.lon);
        const b = project(stem[i + 1].lat, stem[i + 1].lon);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 30 };
        const active = i === (Math.floor(tick / 20) % 9);
        return (
          <path key={i}
            d={`M ${a.x} ${a.y} Q ${mid.x} ${mid.y} ${b.x} ${b.y}`}
            fill="none"
            stroke={active ? "url(#arcGradP)" : "rgba(184,122,255,0.25)"}
            strokeWidth={active ? 2 : 0.8}
            style={active ? { filter: "drop-shadow(0 0 6px #b87aff)" } : undefined} />
        );
      })}

      {/* propagation arcs */}
      {arcs.map((arc, i) => {
        const a = project(arc.a.lat, arc.a.lon);
        const b = project(arc.b.lat, arc.b.lon);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 60 };
        return (
          <path key={i}
            d={`M ${a.x} ${a.y} Q ${mid.x} ${mid.y} ${b.x} ${b.y}`}
            fill="none"
            stroke={arc.kind === "stem" ? "url(#arcGradP)" : "url(#arcGrad)"}
            strokeWidth="1"
            opacity="0.55"
            strokeDasharray="60 240"
            strokeDashoffset={-arc.progress * 300} />
        );
      })}

      {/* originator pulse */}
      {(() => {
        const o = project(stem[0].lat, stem[0].lon);
        return (
          <g>
            <circle cx={o.x} cy={o.y} r="12" fill="none" stroke="#b87aff" strokeWidth="1">
              <animate attributeName="r" values="6;22;6" dur="2.6s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;0;1" dur="2.6s" repeatCount="indefinite" />
            </circle>
            <circle cx={o.x} cy={o.y} r="3" fill="#b87aff" style={{ filter: "drop-shadow(0 0 8px #b87aff)" }} />
          </g>
        );
      })()}

      {/* HUD reticle */}
      <g stroke="var(--tk-accent)" fill="none" strokeWidth="0.5" opacity="0.5">
        <line x1={cx - r - 24} y1={cy} x2={cx - r - 6} y2={cy} />
        <line x1={cx + r + 6} y1={cy} x2={cx + r + 24} y2={cy} />
        <line x1={cx} y1={cy - r - 24} x2={cx} y2={cy - r - 6} />
        <line x1={cx} y1={cy + r + 6} x2={cx} y2={cy + r + 24} />
        <circle cx={cx} cy={cy} r={r + 8} strokeDasharray="2 8" />
      </g>

      {/* annotations */}
      <text x={cx} y={28} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="11" fill="var(--tk-accent)" letterSpacing="0.18em" style={{ filter: "drop-shadow(0 0 4px var(--tk-accent))" }}>
        MONERO P2P · 4,217 NODES VISIBLE
      </text>
      <text x={cx} y={size - 12} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-40)" letterSpacing="0.16em">
        ◀ DANDELION++ STEM ACTIVE · 4/10 ▶ · FLUFF p=0.10
      </text>
    </svg>
  );
}

function PropagationLog({ data }) {
  const lines = [
    ["12:49:18.221", "STEM-FORWARD", "h=2 → 5.9.84.122:18080", "lat 51ms"],
    ["12:49:18.198", "TX-RECV",      "65.21.187.214 ⟶ stem h1", "ring 16"],
    ["12:49:18.092", "FLUFF-GOSSIP", "94.130.157.81 → 8 peers", "embargo 39s"],
    ["12:49:18.044", "BLOCK-SOLVE",  "#3,676,070 · P2Pool", "0.601 XMR"],
    ["12:49:17.881", "STEM-FORWARD", "h=1 → 138.201.131.49", "weight 1.8KB"],
    ["12:49:17.766", "PEER-OUT",     "212.83.175.67 conn", "v0.18.4.0"],
    ["12:49:17.612", "TX-RECV",      "176.9.34.221 ⟶ stem h0", "ring 16"],
    ["12:49:17.503", "FLUFF-GOSSIP", "37.187.74.171 → 12 peers", "p=0.13"],
    ["12:49:17.401", "STEM-FORWARD", "h=4 → 108.61.176.10", "lat 88ms"],
    ["12:49:17.288", "TX-CONFIRM",   "block #3,676,070 incl. 4 tx", "1 conf"],
    ["12:49:17.123", "PEER-IN",      "node.community.rino.io", "agent 0.18.4.0"],
    ["12:49:17.001", "STEM-FORWARD", "h=7 → 159.203.62.18", "lat 122ms"],
  ];
  return (
    <div style={{ fontFamily: "var(--f-mono)", fontSize: 10.5, lineHeight: 1.55 }}>
      {lines.map((l, i) => {
        const tone = {
          "STEM-FORWARD": "p", "FLUFF-GOSSIP": "acc", "TX-RECV": "g",
          "BLOCK-SOLVE": "acc", "TX-CONFIRM": "g", "PEER-IN": "dim", "PEER-OUT": "dim",
        }[l[1]];
        return (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "84px 110px 1fr 90px", gap: 8, padding: "2px 0", borderBottom: "1px dashed rgba(255,255,255,0.04)" }}>
            <span className="dim2">{l[0]}</span>
            <span className={tone ? tone : ""} style={{ textShadow: tone === "p" ? "var(--glow-p)" : tone === "g" ? "var(--glow-g)" : tone === "acc" ? "var(--glow-1)" : undefined }}>{l[1]}</span>
            <span className="dim">{l[2]}</span>
            <span className="dim2" style={{ textAlign: "right" }}>{l[3]}</span>
          </div>
        );
      })}
    </div>
  );
}

function ConstellationView({ data, bg }) {
  return (
    <div className="art" data-screen-label="04 Mempool · CONSTELLATION">
      <ArtBackground intensity={bg?.intensity || "chaotic"} scan={bg?.scan} />
      <div className="art-stage">
        <NavTop active="mempool" data={data} />
        <div className="shell">
          <NetRail data={data} />
          <div className="main" style={{ overflow: "auto" }}>
            <Crumbs items={["XMR.IRISH", "MEMPOOL", "NETWORK", "CONSTELLATION"]} status="GLOBAL PROPAGATION" />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 460px", gap: 16 }}>
              <PanelFrame
                title={<><span>◯ Global propagation</span><span className="dim2">live p2p mesh · 4,217 visible</span></>}
                right={<><span>ROTATE · 60s</span><span className="acc">DANDELION++ ACTIVE</span></>}
              >
                <div style={{ display: "flex", justifyContent: "center", padding: "10px 0" }}>
                  <NetSphere data={data} size={600} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, padding: "10px 6px 0" }}>
                  <Stat k="REACHABLE" v="4,217" sub="dec 2026" />
                  <Stat k="V0.18.4" v="83.2%" sub="majority" tone="acc" />
                  <Stat k="V0.18.3" v="14.1%" sub="lag" />
                  <Stat k="TOR EXIT" v="14.8%" sub="anon" tone="p" />
                  <Stat k="I2P" v="6.4%" sub="anon" tone="p" />
                  <Stat k="CLEARNET" v="78.8%" sub="" />
                </div>
              </PanelFrame>

              {/* right column — log + cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <PanelFrame title="◇ Active stem" right={<span className="acc">HOP 4 / 10</span>}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 4, marginBottom: 10 }}>
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div key={i} style={{
                        height: 26,
                        background: i < 4 ? "linear-gradient(180deg, rgba(184,122,255,0.5), rgba(184,122,255,0.2))" : "rgba(255,255,255,0.04)",
                        border: i === 4 ? "1px solid #b87aff" : "1px solid var(--ink-10)",
                        boxShadow: i === 4 ? "0 0 12px #b87aff" : "none",
                        position: "relative", display: "grid", placeItems: "center",
                        fontFamily: "var(--f-mono)", fontSize: 9, color: i <= 4 ? "#fff" : "var(--ink-40)",
                      }}>{i + 1}</div>
                    ))}
                  </div>
                  <div className="kv"><span className="k">Originator</span><span className="v p">94.130.157.81</span></div>
                  <div className="kv"><span className="k">Current hop</span><span className="v acc">5.9.84.122 (DE)</span></div>
                  <div className="kv"><span className="k">Fluff p</span><span className="v">0.10 · stays stem</span></div>
                  <div className="kv"><span className="k">Embargo</span><span className="v">39 s</span></div>
                  <div className="kv"><span className="k">Anon set</span><span className="v p">152.8 M</span></div>
                </PanelFrame>

                <PanelFrame title="◇ Geographic distribution">
                  <div style={{ fontFamily: "var(--f-mono)", fontSize: 10 }}>
                    {[
                      ["DE", "Germany", 24.3, "#ff7a1a"],
                      ["US", "United States", 19.8, "#5ed3f4"],
                      ["FR", "France", 11.2, "#4ade80"],
                      ["NL", "Netherlands", 7.4, "#b87aff"],
                      ["FI", "Finland", 5.6, "#ffd400"],
                      ["JP", "Japan", 4.1, "#ff4d6d"],
                      ["AU", "Australia", 3.9, "#ff7a1a"],
                      ["??", "Tor/I2P (hidden)", 21.2, "rgba(255,255,255,0.5)"],
                    ].map(([c, n, p, color], i) => (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "24px 1fr 90px 36px", gap: 6, padding: "3px 0", alignItems: "center" }}>
                        <span className="dim2">{c}</span>
                        <span className="dim">{n}</span>
                        <div style={{ height: 6, background: "rgba(255,255,255,0.05)", position: "relative" }}>
                          <div style={{ height: "100%", width: p + "%", background: color, boxShadow: `0 0 6px ${color}` }} />
                        </div>
                        <span style={{ textAlign: "right" }}>{p}%</span>
                      </div>
                    ))}
                  </div>
                </PanelFrame>
              </div>
            </div>

            <PanelFrame title="● Propagation log · tail" right={<><span>FOLLOW</span><span className="acc">−f</span></>}>
              <PropagationLog data={data} />
            </PanelFrame>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <PanelFrame title="◇ Block stream">
                <div style={{ display: "flex", gap: 4, height: 90, alignItems: "flex-end" }}>
                  <div className="mblock q" style={{ width: 40, height: 70 }}><div className="hh">~+2</div><div className="nm" style={{ fontSize: 11 }}>Q</div></div>
                  <div className="mblock q" style={{ width: 40, height: 76 }}><div className="hh">~+1</div><div className="nm" style={{ fontSize: 11 }}>NXT</div></div>
                  {data.blocks.slice(0, 8).map((b) => (
                    <div className="mblock" key={b.height} style={{ width: 40, height: 56 + (b.txs / 140) * 30 }}>
                      <div className="hh" style={{ fontSize: 8 }}>{b.conf}c</div>
                      <div className="nm" style={{ fontSize: 11 }}>{b.txs}</div>
                    </div>
                  ))}
                </div>
              </PanelFrame>
              <PanelFrame title="◇ Hashrate · 7d">
                <Sparkline data={data.hashSeries.slice(-60)} width={300} height={70} color="var(--tk-accent)" />
              </PanelFrame>
              <PanelFrame title="◇ Privacy posture">
                <div className="kv"><span className="k">Ring size</span><span className="v acc">16</span></div>
                <div className="kv"><span className="k">Dandelion stem</span><span className="v p">10 hops</span></div>
                <div className="kv"><span className="k">Tor exits</span><span className="v p">14.8%</span></div>
                <div className="kv"><span className="k">I2P seeds</span><span className="v p">6.4%</span></div>
                <div className="kv"><span className="k">FCMP++ ETA</span><span className="v">Q3 2026</span></div>
              </PanelFrame>
            </div>

          </div>
        </div>
        <Footer data={data} />
      </div>
    </div>
  );
}

window.ConstellationView = ConstellationView;
