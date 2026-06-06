// shared.jsx — XMRIRISH v5 shared atoms, data hooks, background layers
// Exports to window: useMoneroLive, useTick, GlowText, Hash, Stat, Pill,
// Sparkline, MiniBar, PeerList, ScanField, Ticker, NavTop, NetRail, Footer,
// Crumbs, PanelFrame, ParticleField, ShortHash, fmtN, fmtFee, fmtBytes.

/* ─── helpers ─────────────────────────────────────────────────────── */

const fmtN = (n, d = 0) => {
  if (n == null || isNaN(n)) return "—";
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(2) + "K";
  return Number(n).toFixed(d);
};
const fmtFee = (n) => (n == null ? "—" : n.toFixed(7) + " XMR");
const fmtBytes = (b) => (b == null ? "—" : b < 1024 ? b + " B" : (b / 1024).toFixed(1) + " KB");
const pad = (n, w = 2) => String(n).padStart(w, "0");
const hexChar = "0123456789abcdef";
const randHex = (len) => {
  let s = "";
  for (let i = 0; i < len; i++) s += hexChar[(Math.random() * 16) | 0];
  return s;
};
const ShortHash = (h) => (h ? h.slice(0, 8) + "…" + h.slice(-6) : "—");

window.fmtN = fmtN;
window.fmtFee = fmtFee;
window.fmtBytes = fmtBytes;
window.ShortHash = ShortHash;
window.randHex = randHex;
window.pad = pad;

/* ─── animation tick ──────────────────────────────────────────── */

function useTick(intervalMs = 1000) {
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setN((x) => x + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return n;
}

/* ─── monero live data hook ────────────────────────────────────
   Tries CoinGecko for live XMR price (CORS-friendly), tries a few
   public node endpoints for chain info, falls back to a deterministic
   simulated feed if CORS or the network bites us. ────────────── */

const SEED_HEIGHT = 3676070;
const POOLS = [
  { name: "P2Pool",     share: 0.072, fee: 0.000, type: "decentralized", rec: true,  color: "#ff7a1a" },
  { name: "Nanopool",   share: 0.058, fee: 0.010, type: "centralized",   rec: false, color: "#5ed3f4" },
  { name: "SupportXMR", share: 0.310, fee: 0.006, type: "centralized",   rec: false, color: "#ff4d6d" },
  { name: "MineXMR",    share: 0.018, fee: 0.010, type: "centralized",   rec: false, color: "#ffd400" },
  { name: "HashVault",  share: 0.042, fee: 0.009, type: "centralized",   rec: false, color: "#b87aff" },
  { name: "MoneroOcean",share: 0.054, fee: 0.001, type: "decentralized", rec: false, color: "#4ade80" },
  { name: "Solo / Unknown", share: 0.446, fee: 0.000, type: "solo", rec: false, color: "rgba(255,255,255,0.5)" },
];

const PEERS = [
  { ip: "65.21.187.214",  port: 18080, h: 3676070, agent: "monerod 0.18.4.0", lat: 42,  cnt: "DE" },
  { ip: "108.61.176.10",  port: 18080, h: 3676070, agent: "monerod 0.18.3.4", lat: 88,  cnt: "US" },
  { ip: "5.9.84.122",     port: 18080, h: 3676069, agent: "monerod 0.18.4.0", lat: 51,  cnt: "DE" },
  { ip: "176.9.34.221",   port: 18080, h: 3676070, agent: "monerod 0.18.4.0", lat: 39,  cnt: "DE" },
  { ip: "37.187.74.171",  port: 18080, h: 3676070, agent: "monerod 0.18.3.4", lat: 64,  cnt: "FR" },
  { ip: "159.203.62.18",  port: 18080, h: 3676068, agent: "monerod 0.18.4.0", lat: 122, cnt: "CA" },
  { ip: "94.130.157.81",  port: 18080, h: 3676070, agent: "monerod 0.18.4.0", lat: 57,  cnt: "DE" },
  { ip: "node.community.rino.io", port: 18080, h: 3676070, agent: "monerod 0.18.4.0", lat: 71, cnt: "EU" },
  { ip: "138.201.131.49", port: 18080, h: 3676070, agent: "monerod 0.18.4.0", lat: 48,  cnt: "DE" },
  { ip: "212.83.175.67",  port: 18080, h: 3676070, agent: "monerod 0.18.4.0", lat: 92,  cnt: "FR" },
  { ip: "node.melo.tools", port: 18080, h: 3676070, agent: "monerod 0.18.4.0", lat: 67, cnt: "US" },
  { ip: "xmr.suprnova.cc", port: 18080, h: 3676068, agent: "monerod 0.18.3.4", lat: 114, cnt: "NL" },
];

function genTx(seed = Math.random()) {
  const ringSize = 16;
  const fee = (50 + Math.pow(seed, 3) * 950) * 1e-7; // 5e-6 .. 1e-4 XMR-ish
  return {
    id: randHex(64),
    size: 1500 + ((seed * 50) | 0) * 60, // ~1.5 .. 4.5 KB
    fee,
    ringSize,
    perB: fee / (1500 + seed * 1500) * 1e9,
    age: 0,
    inputs: 1 + ((seed * 4) | 0),
    outputs: 2,
    seed,
  };
}

function seedBlocks(count) {
  const arr = [];
  for (let i = 0; i < count; i++) {
    const h = SEED_HEIGHT - i;
    const txCount = [4, 17, 22, 39, 103, 7, 9, 47, 6, 140, 12, 18, 24][i % 13];
    const sizeKB = 6.8 + txCount * 1.4 + Math.random() * 8;
    arr.push({
      height: h,
      hash: randHex(64),
      txs: txCount,
      sizeKB,
      reward: 0.6 + Math.random() * 0.04,
      difficulty: 7.738e11 + (Math.random() - 0.5) * 2e9,
      pool: POOLS[Math.floor(Math.random() * POOLS.length)].name,
      age: i * 120 + Math.floor(Math.random() * 30),
      conf: i + 1,
    });
  }
  return arr;
}

function useMoneroLive() {
  const [state, setState] = React.useState(() => {
    const blocks = seedBlocks(14);
    const mempool = Array.from({ length: 38 }, () => ({ ...genTx(Math.random()), age: Math.floor(Math.random() * 240) }));
    return {
      price: 394.53, change24h: 4.11, btcRatio: 0.005034,
      btc: 78368, btcChg: 0.44,
      height: SEED_HEIGHT,
      hashrate: 6.45e9,     // 6.45 GH/s
      difficulty: 7.738e11,
      nonce: 65797,
      hardfork: "v16 (CLSAG + Bulletproofs+)",
      protocol: "v16",
      blockTarget: 120,
      peers: PEERS.slice(0, 12).map((p) => ({ ...p })),
      peerIn: 0, peerOut: 12,
      blocks,
      mempool,
      poolDist: POOLS,
      hashSeries: Array.from({ length: 168 }, (_, i) => 6.1e9 + Math.sin(i * 0.2) * 0.3e9 + Math.random() * 0.2e9),
      priceSeries: Array.from({ length: 168 }, (_, i) => 380 + Math.sin(i * 0.18) * 18 + Math.cos(i * 0.07) * 12 + Math.random() * 4),
      feeHist: Array.from({ length: 32 }, (_, i) => Math.exp(-Math.pow((i - 8) / 7, 2)) * 100 + Math.random() * 8),
      live: false, // becomes true if CoinGecko returns
      source: "simulated",
      lastUpdate: Date.now(),
    };
  });

  // Try CoinGecko price (open CORS)
  React.useEffect(() => {
    let cancelled = false;
    const fetchPrice = async () => {
      try {
        const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=monero,bitcoin&vs_currencies=usd&include_24hr_change=true");
        if (!r.ok) throw new Error();
        const d = await r.json();
        if (cancelled) return;
        setState((s) => ({
          ...s,
          price: d.monero?.usd ?? s.price,
          change24h: d.monero?.usd_24h_change ?? s.change24h,
          btc: d.bitcoin?.usd ?? s.btc,
          btcChg: d.bitcoin?.usd_24h_change ?? s.btcChg,
          btcRatio: (d.monero?.usd ?? s.price) / (d.bitcoin?.usd ?? s.btc),
          live: true,
          source: "coingecko",
          lastUpdate: Date.now(),
        }));
      } catch (e) { /* keep simulated */ }
    };
    fetchPrice();
    const id = setInterval(fetchPrice, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Simulated live mempool + blocks
  React.useEffect(() => {
    const id = setInterval(() => {
      setState((s) => {
        const newTx = Math.random() < 0.7 ? [genTx(Math.random())] : [];
        const updated = [...s.mempool.map((t) => ({ ...t, age: t.age + 2 })), ...newTx];
        // every ~120s "confirm" txs into next block — emulate by dropping oldest 1-3 occasionally
        let mem = updated;
        if (Math.random() < 0.06 && mem.length > 4) mem = mem.slice(0, Math.max(8, mem.length - 3));
        // bump price slightly
        const drift = (Math.random() - 0.5) * 0.3;
        const series = [...s.priceSeries.slice(-167), s.price + drift];
        return { ...s, mempool: mem, price: s.price + drift, priceSeries: series, lastUpdate: Date.now() };
      });
    }, 2200);
    return () => clearInterval(id);
  }, []);

  // Simulated block tick every ~2 minutes — speed up to ~30s for visual interest
  React.useEffect(() => {
    const id = setInterval(() => {
      setState((s) => {
        const newH = s.height + 1;
        const nb = {
          height: newH,
          hash: randHex(64),
          txs: 1 + Math.floor(Math.random() * 30),
          sizeKB: 8 + Math.random() * 80,
          reward: 0.6 + Math.random() * 0.04,
          difficulty: s.difficulty + (Math.random() - 0.5) * 2e9,
          pool: POOLS[Math.floor(Math.random() * POOLS.length)].name,
          age: 0,
          conf: 1,
        };
        const blocks = [nb, ...s.blocks.slice(0, 13).map((b) => ({ ...b, conf: b.conf + 1, age: b.age + 120 }))];
        return { ...s, height: newH, blocks };
      });
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  return state;
}

window.useMoneroLive = useMoneroLive;
window.useTick = useTick;
window.POOLS = POOLS;
window.PEERS = PEERS;

/* ─── primitive components ────────────────────────────────────── */

function Stat({ k, v, sub, tone, big }) {
  return (
    <div className="stat" style={big ? { padding: "12px 14px" } : undefined}>
      <div className="lbl">{k}</div>
      <div className={"val" + (tone ? " " + tone : "") + (big ? "" : "")} style={big ? { fontSize: 26 } : undefined}>{v}</div>
      {sub ? <div className="sub">{sub}</div> : null}
    </div>
  );
}

function Pill({ children, tone, dot }) {
  return (
    <span className={"pill" + (tone ? " " + tone : "")}>
      {dot ? <span className="led pulse" style={{ width: 5, height: 5 }} /> : null}
      {children}
    </span>
  );
}

function PanelFrame({ title, right, children, scrollable, style, ticks = true }) {
  return (
    <div className="panel" style={style}>
      {ticks ? (<>
        <span className="tick tl" />
        <span className="tick tr" />
        <span className="tick bl" />
        <span className="tick br" />
      </>) : null}
      {title ? (
        <div className="panel-h">
          <div className="l">{typeof title === "string" ? <span>{title}</span> : title}</div>
          <div className="r">{right}</div>
        </div>
      ) : null}
      <div className="panel-b" style={scrollable ? { overflow: "auto", maxHeight: scrollable } : undefined}>
        {children}
      </div>
    </div>
  );
}

function Sparkline({ data, width = 220, height = 40, color = "var(--tk-accent)", fill = true, dots = false, area = 0.25 }) {
  if (!data || !data.length) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const rng = max - min || 1;
  const step = width / (data.length - 1);
  const points = data.map((v, i) => [i * step, height - ((v - min) / rng) * (height - 4) - 2]);
  const d = "M" + points.map((p) => p.join(",")).join(" L ");
  const f = d + ` L ${width},${height} L 0,${height} Z`;
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      {fill ? <path d={f} fill={color} opacity={area} /> : null}
      <path d={d} fill="none" stroke={color} strokeWidth="1.2" style={{ filter: "drop-shadow(0 0 4px " + color + ")" }} />
      {dots ? points.filter((_, i) => i % 12 === 0).map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="1.2" fill={color} />) : null}
    </svg>
  );
}

function MiniBar({ data, width = 220, height = 36, color = "var(--tk-accent)" }) {
  if (!data || !data.length) return null;
  const max = Math.max(...data) || 1;
  const w = width / data.length;
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      {data.map((v, i) => {
        const h = (v / max) * (height - 2);
        return <rect key={i} x={i * w + 0.5} y={height - h} width={Math.max(1, w - 1.5)} height={h} fill={color} opacity={0.3 + (v / max) * 0.7} />;
      })}
    </svg>
  );
}

function Crumbs({ items, status }) {
  return (
    <div className="crumbs">
      {items.map((it, i) => (
        <React.Fragment key={i}>
          {i === items.length - 1 ? <b>{it}</b> : <span>{it}</span>}
          {i < items.length - 1 ? <s>/</s> : null}
        </React.Fragment>
      ))}
      {status ? (
        <span style={{ marginLeft: "auto" }}>
          <span className="led pulse" /> {status}
        </span>
      ) : null}
    </div>
  );
}

function NavTop({ active = "mempool", live, data }) {
  // Live-data aware top nav with real hash routing. data is optional —
  // falls back to fixed values for legacy callers that don't pass it.
  const xmrPrice = data?.price;
  const xmrChg = data?.change24h;
  const btcPrice = data?.btc;
  const btcChg = data?.btcChg;
  const source = data?.source;
  return (
    <div className="topbar">
      <a href="#/" className="brand" style={{ textDecoration: "none", color: "inherit" }}>
        <span className="brand-mark" />
        <span>xmr<b>.irish</b></span>
        <span className="kicker" style={{ marginLeft: 8 }}>v5.0 · 0.1</span>
      </a>
      <div className="topnav">
        <a href="#/"          className={active === "home" ? "on" : ""}>Home</a>
        <a href="#/mempool"   className={active === "mempool" ? "on" : ""}>Mempool</a>
        <a href="#/education" className={active === "education" ? "on" : ""}>Education</a>
        <a href="#/dashboard" className={active === "dashboard" ? "on" : ""}>Dashboard</a>
        <a href="#/monero"    className={active === "monero" ? "on" : ""}>Monero</a>
        <a href="#/simulate"  className={active === "simulate" ? "on" : ""}>Simulate</a>
        <a href="#/node"      className={active === "node" ? "on" : ""}>Run a node</a>
      </div>
      <div className="ticker-strip">
        <span className="pill live"><span className="led pulse" />{source === "coingecko" ? "LIVE" : "SIM"}</span>
        <span className="tk dim">
          XMR <b className="acc">${xmrPrice != null ? xmrPrice.toFixed(2) : "394.53"}</b>
          <em className={xmrChg != null && xmrChg < 0 ? "dn" : ""}>{xmrChg != null ? (xmrChg >= 0 ? "+" : "") + xmrChg.toFixed(2) + "%" : "+4.11%"}</em>
        </span>
        <span className="tk dim">
          BTC <b>${btcPrice != null ? Math.round(btcPrice).toLocaleString() : "78,368"}</b>
          <em className={btcChg != null && btcChg < 0 ? "dn" : ""}>{btcChg != null ? (btcChg >= 0 ? "+" : "") + btcChg.toFixed(2) + "%" : "+0.44%"}</em>
        </span>
        <a href="#/design" className="tk dim" style={{ textDecoration: "none" }}>⌘ DESIGN</a>
      </div>
    </div>
  );
}

function NetRail({ data, extra }) {
  return (
    <aside className="rail">
      <div className="rail-block">
        <h6>Network · live</h6>
        <div className="kv"><span className="k"><span className="led pulse" />Block height</span><span className="v acc">{data.height.toLocaleString()}</span></div>
        <div className="kv"><span className="k">Hashrate</span><span className="v">{(data.hashrate / 1e9).toFixed(2)} GH/s</span></div>
        <div className="kv"><span className="k">Difficulty</span><span className="v">{(data.difficulty / 1e9).toFixed(2)}G</span></div>
        <div className="kv"><span className="k">Block target</span><span className="v">2:00 min</span></div>
        <div className="kv"><span className="k">Mempool depth</span><span className="v acc">{data.mempool.length} tx</span></div>
        <div className="kv"><span className="k">Hard fork</span><span className="v">v16</span></div>
      </div>
      <div className="rail-block">
        <h6>Local node</h6>
        <div className="kv"><span className="k"><span className="led" />Synced</span><span className="v up">100.00%</span></div>
        <div className="kv"><span className="k">Peers in / out</span><span className="v">{data.peerIn} / {data.peerOut}</span></div>
        <div className="kv"><span className="k">Bandwidth</span><span className="v">12.4 / 8.1 KB/s</span></div>
        <div className="kv"><span className="k">RPC port</span><span className="v">18089</span></div>
        <div className="kv"><span className="k">Tx pool</span><span className="v">{data.mempool.length} · {fmtBytes(data.mempool.reduce((a, t) => a + t.size, 0))}</span></div>
      </div>
      <div className="rail-block">
        <h6>Peers · 12</h6>
        <div className="peerlist">
          {data.peers.slice(0, 10).map((p, i) => (
            <div className="row" key={i}>
              <span className={"led " + (p.lat < 60 ? "" : p.lat < 100 ? "q" : "o")} style={{ width: 5, height: 5 }} />
              <span title={p.ip}>{p.ip}</span>
              <span>{p.lat}ms</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rail-block">
        <h6>Market · live · CG</h6>
        <div className="kv"><span className="k">XMR/USD</span><span className="v acc">${data.price.toFixed(2)}</span></div>
        <div className="kv"><span className="k">24h Δ</span><span className={"v " + (data.change24h >= 0 ? "up" : "dn")}>{data.change24h >= 0 ? "+" : ""}{data.change24h.toFixed(2)}%</span></div>
        <div className="kv"><span className="k">XMR/BTC</span><span className="v">{data.btcRatio.toFixed(6)}</span></div>
        <div style={{ marginTop: 6 }}>
          <Sparkline data={data.priceSeries.slice(-56)} width={224} height={36} color="var(--tk-accent)" />
        </div>
      </div>
      {extra}
      <div className="rail-block" style={{ marginTop: "auto", color: "var(--ink-40)", fontSize: 10 }}>
        Source: <span className="acc">{data.source}</span> · <span className="blink" style={{ animation: "blink 0.9s steps(2,end) infinite" }}>● live</span>
        <div style={{ marginTop: 4 }}>{new Date(data.lastUpdate).toISOString().slice(11, 19)} UTC</div>
      </div>
    </aside>
  );
}

function Footer({ data }) {
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

/* ─── particle canvas backdrop ─────────────────────────────────
   Animated dots that drift; some shoot upward as "tx" streams. */
function ParticleField({ density = 1.0, speed = 1.0, color = "rgba(255,122,26,0.5)", className }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf, w, h;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);

    const N = Math.floor(120 * density);
    const stars = Array.from({ length: N }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.15 * speed,
      vy: (Math.random() - 0.5) * 0.15 * speed,
      r: Math.random() * 1.3 + 0.2,
      a: Math.random() * 0.7 + 0.1,
      ph: Math.random() * Math.PI * 2,
    }));
    const streams = Array.from({ length: Math.floor(8 * density) }, () => ({
      x: Math.random() * w, y: h + Math.random() * h,
      vy: -(Math.random() * 1.6 + 0.6) * speed,
      life: Math.random() * 200 + 200,
      age: 0, hue: Math.random() < 0.85 ? 28 : 280,
    }));
    let t = 0;
    const tick = () => {
      t++;
      ctx.clearRect(0, 0, w, h);
      // soft grid pulse
      ctx.fillStyle = color;
      for (const s of stars) {
        s.x += s.vx; s.y += s.vy; s.ph += 0.02 * speed;
        if (s.x < 0) s.x += w; if (s.x > w) s.x -= w;
        if (s.y < 0) s.y += h; if (s.y > h) s.y -= h;
        const a = s.a * (0.5 + 0.5 * Math.sin(s.ph));
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      // streams (tx)
      for (const s of streams) {
        s.y += s.vy; s.age++;
        if (s.y < -20 || s.age > s.life) {
          s.x = Math.random() * w; s.y = h + 20; s.age = 0;
          s.vy = -(Math.random() * 1.6 + 0.6) * speed;
          s.hue = Math.random() < 0.85 ? 28 : 280;
        }
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = `hsl(${s.hue}, 100%, ${60 - Math.abs(s.age - s.life / 2) / s.life * 40}%)`;
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(s.x, s.y, 1.6, 0, Math.PI * 2); ctx.fill();
        // trail
        ctx.shadowBlur = 0; ctx.globalAlpha = 0.18;
        ctx.fillRect(s.x, s.y, 1, 28);
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [density, speed, color]);
  return <canvas ref={ref} className={"art-canvas " + (className || "")} />;
}

function ArtBackground({ intensity = "busy", scan = false }) {
  return (
    <>
      <div className="art-grid" />
      <ParticleField
        density={intensity === "calm" ? 0.45 : intensity === "chaotic" ? 1.6 : 1.0}
        speed={intensity === "chaotic" ? 1.6 : 1.0}
      />
      <div className="art-noise" />
      <div className="art-vignette" />
      {scan ? <div className="art-scan" /> : null}
    </>
  );
}

Object.assign(window, {
  Stat, Pill, PanelFrame, Sparkline, MiniBar, Crumbs,
  NavTop, NetRail, Footer, ParticleField, ArtBackground,
  genTx,
});

/* ── protocol artboard chrome ─────────────────────────────────── */

function ProtoHeader({ kicker, title, sub, badges, right }) {
  return (
    <div className="proto-head">
      <div className="l">
        <div className="kicker">{kicker}</div>
        <div className="title" dangerouslySetInnerHTML={{ __html: title }} />
        {sub ? <div className="sub">{sub}</div> : null}
      </div>
      <div className="r">
        {(badges || []).map((b, i) => (
          <span key={i} className={"proto-badge " + (b.tone || "")}>{b.label}</span>
        ))}
        {right}
      </div>
    </div>
  );
}

function ProtoArtboard({ label, kicker, title, sub, badges, right, stage, panel, scan, bg }) {
  return (
    <div className={"art proto " + (scan ? "scan-on" : "")} data-screen-label={label}>
      <ArtBackground intensity={bg?.intensity || "calm"} scan={scan ?? bg?.scan} />
      <div className="art-stage">
        <ProtoHeader kicker={kicker} title={title} sub={sub} badges={badges} right={right} />
        <div className="proto-body">
          <div className="proto-stage">{stage}</div>
          <aside className="proto-panel">{panel}</aside>
        </div>
      </div>
    </div>
  );
}

function ProtoStep({ n, on, done, title, children }) {
  return (
    <div className={"proto-step " + (done ? "done" : on ? "on" : "")} data-n={n}>
      <h5>{title}</h5>
      <p>{children}</p>
    </div>
  );
}

Object.assign(window, { ProtoHeader, ProtoArtboard, ProtoStep });
