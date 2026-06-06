// terminal.jsx — TERMINAL HUB · hi-fi CLI
//
// The "I run my own node" power-user surface. A self-typing command palette,
// a live auto-tailing monerod log, a reactive ASCII block stream, a live ASCII
// fee histogram, compact radial gauges and a wallet/privacy rail. Scanlines on.
//
// All helpers prefixed `Term` to avoid shared-scope collisions.

/* ── self-typing command palette ────────────────────────────── */
function TermPalette() {
  const cmds = React.useMemo(() => [
    { q: "get_block 3676070", rows: [["BLOCK", "#3,676,070", "0.601 XMR · 4 tx · 6.8 KB · P2Pool"]] },
    { q: "get_transactions 5e27cfc8", rows: [["TX", "5e27cfc8…de2263", "1.8 KB · 0.0004928 XMR · ring 16"]] },
    { q: "print_pl", rows: [["PEER", "65.21.187.214:18080", "DE · 42ms · monerod 0.18.4.0"], ["PEER", "5.9.84.122:18080", "DE · 51ms · 0.18.4.0"]] },
    { q: "search dandelion", rows: [["TOPIC", "Dandelion++", "stem→fluff propagation"], ["TOPIC", "FCMP++", "full-chain membership proofs"]] },
  ], []);
  const [ci, setCi] = React.useState(0);
  const [typed, setTyped] = React.useState("");
  const [phase, setPhase] = React.useState("typing"); // typing → hold → clearing
  React.useEffect(() => {
    const full = cmds[ci].q;
    let to;
    if (phase === "typing") {
      if (typed.length < full.length) to = setTimeout(() => setTyped(full.slice(0, typed.length + 1)), 55 + Math.random() * 60);
      else to = setTimeout(() => setPhase("hold"), 1600);
    } else if (phase === "hold") {
      to = setTimeout(() => setPhase("clearing"), 1400);
    } else {
      if (typed.length > 0) to = setTimeout(() => setTyped(typed.slice(0, -1)), 24);
      else { setPhase("typing"); setCi((c) => (c + 1) % cmds.length); }
    }
    return () => clearTimeout(to);
  }, [typed, phase, ci, cmds]);
  const showResults = phase === "hold";
  return (
    <div style={{ border: "1px solid var(--tk-accent)", background: "rgba(0,0,0,0.65)", boxShadow: "0 0 24px rgba(255,122,26,0.22), inset 0 0 30px rgba(255,122,26,0.05)", borderRadius: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid var(--rule)", fontFamily: "var(--f-mono)", fontSize: 13 }}>
        <span style={{ color: "var(--tk-accent)", textShadow: "var(--glow-1)" }}>›</span>
        <span style={{ color: "var(--ink-100)" }}>{typed}</span>
        <span style={{ width: 8, height: 16, background: "var(--tk-accent)", boxShadow: "var(--glow-1)", animation: "term-blink 1s steps(2) infinite", display: "inline-block" }} />
        <span style={{ marginLeft: "auto", color: "var(--ink-40)", fontSize: 10 }}>⌘K · ESC</span>
      </div>
      <div style={{ padding: 8, fontFamily: "var(--f-mono)", fontSize: 11.5, minHeight: 96 }}>
        {(showResults ? cmds[ci].rows : []).map((r, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "60px 1fr 1.1fr 18px", gap: 10, padding: "6px 8px", background: i === 0 ? "rgba(255,122,26,0.12)" : "transparent", borderLeft: i === 0 ? "2px solid var(--tk-accent)" : "2px solid transparent", animation: "term-slidein 0.25s ease" }}>
            <span className="dim2" style={{ fontSize: 9, letterSpacing: "0.1em" }}>{r[0]}</span>
            <span className={i === 0 ? "acc" : ""}>{r[1]}</span>
            <span className="dim">{r[2]}</span>
            <span className="dim2" style={{ textAlign: "right" }}>{i === 0 ? "↵" : ""}</span>
          </div>
        ))}
        {!showResults ? <div className="dim2" style={{ padding: "30px 8px", textAlign: "center", letterSpacing: "0.14em" }}>{phase === "typing" ? "querying daemon…" : "—"}</div> : null}
      </div>
      <style>{`@keyframes term-blink { 0%,50% { opacity: 1; } 50.01%,100% { opacity: 0; } } @keyframes term-slidein { from { opacity: 0; transform: translateX(-4px); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  );
}

/* ── reactive ASCII block stream ────────────────────────────── */
function TermAsciiBlocks({ data }) {
  const cols = data.blocks.slice(0, 13);
  const rowsMax = 18;
  const cell = (label, q, txs, height, conf, sizeKB, newest) => {
    const filled = q ? 0 : Math.min(rowsMax - 2, 2 + Math.floor((txs / 140) * (rowsMax - 4)));
    const empty = rowsMax - filled - 2;
    const ascii = q
      ? "┌──┐\n" + "│  │\n".repeat(rowsMax - 3) + `│ ${label} │\n` + "└──┘"
      : "┌──┐\n" + "│  │\n".repeat(empty) + "██\n".repeat(filled) + "└──┘";
    return (
      <div style={{ fontFamily: "var(--f-mono)", fontSize: 10, color: "var(--ink-80)" }}>
        <div style={{ textAlign: "center", marginBottom: 4, color: q ? "var(--ink-40)" : "var(--tk-accent)", textShadow: q ? "none" : "var(--glow-1)" }}>{q ? "~+" + label : height.toString().slice(-3)}</div>
        <pre style={{ margin: 0, lineHeight: 1, fontSize: 11, color: "var(--tk-accent)", textShadow: newest ? "0 0 9px rgba(255,122,26,0.7)" : "0 0 6px rgba(255,122,26,0.4)", animation: newest ? "term-flash 1.4s ease-in-out infinite" : "none" }}>{ascii}</pre>
        <div style={{ textAlign: "center", marginTop: 4, color: q ? "var(--ink-40)" : "var(--ink-60)" }}>{q ? "0 tx" : txs + "t"}</div>
        {!q ? <div style={{ textAlign: "center", color: "var(--ink-40)", fontSize: 9 }}>{sizeKB.toFixed(0)}K · {conf}c</div> : null}
      </div>
    );
  };
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols.length + 2}, 1fr)`, gap: 8, padding: "8px 0", overflowX: "auto" }}>
      {cell("2", true)}{cell("N", true)}
      {cols.map((b, i) => <React.Fragment key={b.height}>{cell(null, false, b.txs, b.height, b.conf, b.sizeKB, i === 0)}</React.Fragment>)}
      <style>{`@keyframes term-flash { 0%,100% { opacity: 1; } 50% { opacity: 0.65; } }`}</style>
    </div>
  );
}

/* ── live auto-tailing monerod log ──────────────────────────── */
function TermLiveLog() {
  const tmpl = [
    ["I", "txpool", "Transaction added to pool: txid=<{hx}…{hx2}> size={sz} fee=0.000{f} XMR"],
    ["I", "p2p", "Received TX from peer 5.9.84.122:18080, stem hop={h} weight=1.8KB"],
    ["I", "dand", "Stem→Fluff p=0.{p} ≥ 0.10 fail · stays stem, forwarding"],
    ["I", "p2p", "Forwarded stem tx <{hx}…> → 138.201.131.49:18080 h={h}"],
    ["I", "p2p", "New outgoing peer 212.83.175.67:18080 agent=monerod/0.18.4.0"],
    ["W", "rpc", "Slow request /get_info from 65.21.187.214 took {l}ms"],
    ["I", "core", "Difficulty recomputed: 773,885,427,585 (Δ +0.21%)"],
    ["I", "p2p", "Sync: at height 3676070 / 3676070 (100.00%)"],
    ["I", "core", "Block hash verified, signing as v16 (CLSAG + Bulletproofs+)"],
    ["I", "core", "FCMP++ readiness gauge: 72% (membership proof draft 4)"],
    ["I", "dand", "Stem path generated: 10 hops, seed=0x{hx}"],
    ["I", "core", "Verifying ring signature CLSAG size=16 ✓"],
  ];
  const hx = () => Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0");
  const ts = () => new Date().toISOString().slice(11, 23);
  const fill = (s) => s.replace(/\{hx\}/g, hx).replace("{hx2}", hx()).replace("{sz}", 1500 + (Math.random() * 1800 | 0)).replace("{f}", (4000 + (Math.random() * 900 | 0))).replace(/\{h\}/g, () => 1 + (Math.random() * 9 | 0)).replace("{p}", 10 + (Math.random() * 9 | 0)).replace("{l}", 200 + (Math.random() * 250 | 0));
  const mk = () => { const t = tmpl[Math.floor(Math.random() * tmpl.length)]; return { id: Math.random(), lvl: t[0], cat: t[1], ts: ts(), msg: fill(t[2]) }; };
  const [rows, setRows] = React.useState(() => Array.from({ length: 16 }, mk));
  React.useEffect(() => { const id = setInterval(() => setRows((r) => [mk(), ...r].slice(0, 16)), 1100); return () => clearInterval(id); }, []);
  const colorFor = (lvl, cat) => lvl === "W" ? "var(--y-50)" : lvl === "E" ? "var(--r-50)" : cat === "dand" ? "var(--p-50)" : cat === "core" ? "var(--tk-accent)" : cat === "p2p" ? "var(--c-50)" : "var(--ink-60)";
  return (
    <div style={{ fontFamily: "var(--f-mono)", fontSize: 10.5, lineHeight: 1.5 }}>
      {rows.map((l) => (
        <div key={l.id} style={{ display: "grid", gridTemplateColumns: "16px 100px 56px 1fr", gap: 8, padding: "1px 0", animation: "term-logslide 0.35s ease" }}>
          <span style={{ color: colorFor(l.lvl), fontWeight: 600 }}>{l.lvl}</span>
          <span className="dim2">{l.ts}</span>
          <span style={{ color: colorFor(l.lvl, l.cat) }}>{l.cat}</span>
          <span className="dim" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.msg}</span>
        </div>
      ))}
      <style>{`@keyframes term-logslide { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  );
}

/* ── live ASCII fee histogram ───────────────────────────────── */
function TermFeeHisto({ data }) {
  const tick = useTick(1200);
  const bins = React.useMemo(() => {
    const b = new Array(11).fill(0);
    data.mempool.forEach((t) => { const i = Math.min(10, Math.floor(t.perB / 4e4)); b[i] += 1; });
    return b;
  }, [data.mempool, tick]);
  const max = Math.max(...bins, 1);
  const medianBin = bins.indexOf(Math.max(...bins));
  const bar = (v) => "█".repeat(Math.round((v / max) * 24));
  return (
    <pre style={{ margin: 0, fontFamily: "var(--f-mono)", fontSize: 10.5, lineHeight: 1.5, color: "var(--tk-accent)", textShadow: "0 0 4px rgba(255,122,26,0.4)" }}>
      {bins.map((v, i) => `${String(i * 40).padStart(3, " ")} |${bar(v).padEnd(24, " ")} ${String(v).padStart(3, " ")}${i === medianBin ? "  ← median" : ""}`).join("\n")}
      <div className="dim" style={{ fontFamily: "var(--f-mono)", fontSize: 10, marginTop: 6 }}>fee in piconero/byte · {data.mempool.length} tx sample</div>
    </pre>
  );
}

/* ── compact radial gauge ───────────────────────────────────── */
function TermGauge({ value, label, color = "var(--tk-accent)", size = 84 }) {
  const r = size / 2 - 8, c = size / 2, ring = 2 * Math.PI * r, dash = ring * (value / 100) * 0.75;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size * 0.78}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" strokeDasharray={ring * 0.75 + " " + ring} transform={`rotate(135 ${c} ${c})`} strokeLinecap="round" />
        <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth="5" strokeDasharray={dash + " " + ring} transform={`rotate(135 ${c} ${c})`} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
        <text x={c} y={c + 2} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="15" fontWeight="500" fill={color}>{value}</text>
      </svg>
      <div className="mono" style={{ fontSize: 8.5, letterSpacing: "0.16em", color: "var(--ink-40)", marginTop: -2 }}>{label}</div>
    </div>
  );
}

function TerminalHubView({ data, bg }) {
  const scan = bg?.scan ?? true;
  const memBytes = data.mempool.reduce((a, t) => a + t.size, 0);
  return (
    <div className={"art " + (scan ? "scan-on" : "")} data-screen-label="05 Mempool · TERMINAL HUB">
      <ArtBackground intensity={bg?.intensity || "busy"} scan={scan} />
      <div className="art-stage">
        <NavTop active="mempool" data={data} />
        <div className="shell" style={{ gridTemplateColumns: "300px 1fr 320px" }}>
          <NetRail data={data} />
          <div className="main" style={{ overflow: "auto" }}>
            <Crumbs items={["XMR.IRISH", "MEMPOOL", "TERMINAL"]} status="MONEROD · 0.18.4.0" />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <PanelFrame title={<span>$ monerod --status</span>} right={<span className="acc">tail −f</span>}>
                <pre style={{ margin: 0, fontFamily: "var(--f-mono)", fontSize: 11.5, lineHeight: 1.5, color: "var(--ink-100)", textShadow: "0 0 6px rgba(255,122,26,0.18)" }}>
{`╭─ monerod 0.18.4.0 ────────────────────────────────╮
│ Status:    `}<span style={{ color: "var(--g-50)", textShadow: "var(--glow-g)" }}>SYNCED</span>{`  100.00% (3676070/3676070)        │
│ Network:   mainnet · hardfork v16 (CLSAG+BP+)     │
│ Hash rate: `}<span className="acc">6.45 GH/s</span>{` · diff 773,885,427,585  │
│ Mempool:   `}<span className="acc">{pad(data.mempool.length, 3)} tx</span>{` · ${fmtBytes(memBytes).padEnd(8, " ")}      │
│ Peers:     ${pad(data.peers.length, 3)}  ↓ 12.4 KB/s   ↑ 8.1 KB/s         │
│ Wallet:    `}<span style={{ color: "var(--p-50)", textShadow: "var(--glow-p)" }}>connected</span>{` · subaddr 0/0 · ring 16     │
│ Uptime:    47d 12h 18m                            │
╰───────────────────────────────────────────────────╯`}
                </pre>
                <div style={{ marginTop: 12, fontFamily: "var(--f-mono)", fontSize: 11 }}>
                  <div className="kicker" style={{ marginBottom: 6 }}>RPC ENDPOINTS</div>
                  {[["get_info", "GET", "127.0.0.1:18089/json_rpc", "12ms"], ["get_block", "GET", "127.0.0.1:18089/json_rpc", "8ms"], ["get_transactions", "GET", "…/get_transactions", "21ms"], ["send_raw_tx", "PUT", "…/send_raw_transaction", "—"], ["get_fee_estim.", "GET", "127.0.0.1:18089/json_rpc", "5ms"]].map((r, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "120px 32px 1fr 50px", gap: 6, padding: "1px 0" }}>
                      <span className="acc">{r[0]}</span><span className="dim2">{r[1]}</span><span className="dim">{r[2]}</span><span className="dim2" style={{ textAlign: "right" }}>{r[3]}</span>
                    </div>
                  ))}
                </div>
              </PanelFrame>

              <PanelFrame title="$ jump · ⌘K" right={<span className="acc">PALETTE</span>}>
                <TermPalette />
              </PanelFrame>
            </div>

            <PanelFrame title="$ block-stream --ascii" right={<><span>13 LAST</span><span className="acc">+2 QUEUED</span></>}>
              <TermAsciiBlocks data={data} />
              <div style={{ marginTop: 10, fontFamily: "var(--f-mono)", fontSize: 10, color: "var(--ink-60)", borderTop: "1px dashed var(--ink-10)", paddingTop: 8, display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
                <span><span className="acc">█</span> tx fill ratio</span><span><span className="dim">0c</span> just mined</span><span><span className="dim">+10c</span> unlock</span><span className="dim2">ring=16</span><span className="dim2">target=2:00</span><span className="dim2 acc">scroll ←→</span>
              </div>
            </PanelFrame>

            <PanelFrame title="$ tail -f /var/log/monero/monero.log" right={<><span>−f</span><span className="acc" style={{ animation: "term-blink 1s steps(2) infinite" }}>●</span></>}>
              <TermLiveLog />
            </PanelFrame>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <PanelFrame title="$ awk · fee distribution">
                <TermFeeHisto data={data} />
              </PanelFrame>
              <PanelFrame title="$ peer · top 10 by latency">
                <pre style={{ margin: 0, fontFamily: "var(--f-mono)", fontSize: 10.5, lineHeight: 1.45, color: "var(--ink-80)" }}>
{data.peers.slice(0, 10).map((p, i) => `${pad(i + 1, 2)} ${p.ip.padEnd(22, " ").slice(0, 22)} ${String(p.lat).padStart(4, " ")}ms ${p.cnt}`).join("\n")}
                </pre>
              </PanelFrame>
              <PanelFrame title="$ env · runtime">
                <pre style={{ margin: 0, fontFamily: "var(--f-mono)", fontSize: 10.5, lineHeight: 1.55, color: "var(--ink-80)" }}>
{`MONEROD_VERSION=0.18.4.0
MONEROD_NETWORK=mainnet
MONEROD_DB_SYNC=safe
DATA_DIR=/var/lib/monero
DB_SIZE=210.4 GB
TOR_PROXY=127.0.0.1:9050
I2P_SAM=127.0.0.1:7656
TX_PROXY=dandelion++
RING_SIZE=16
BP_VARIANT=BP+`}
                </pre>
              </PanelFrame>
            </div>

            <PanelFrame title="$ help" ticks={false}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 10, fontFamily: "var(--f-mono)", fontSize: 10.5 }}>
                {[["⌘K", "palette"], ["G H", "home"], ["G M", "mempool"], ["G E", "education"], ["G D", "dashboard"], ["G S", "simulate"], ["?", "help"], ["[", "prev block"], ["]", "next block"], ["/", "search"], ["F", "follow log"], ["S", "scanlines"], ["D", "density"], ["L", "lock"], ["⎋", "back"], ["⇧?", "keys"]].map(([k, v], i) => (
                  <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ border: "1px solid var(--ink-20)", padding: "1px 6px", fontSize: 9.5, color: "var(--tk-accent)", textShadow: "var(--glow-1)" }}>{k}</span>
                    <span className="dim">{v}</span>
                  </div>
                ))}
              </div>
            </PanelFrame>
          </div>

          <aside className="rail" style={{ borderLeft: "1px solid var(--rule)", borderRight: "none" }}>
            <div className="rail-block">
              <h6>Wallet · sub 0/0</h6>
              <div className="kv"><span className="k">Balance</span><span className="v acc">●●●● XMR</span></div>
              <div className="kv"><span className="k">Unlocked</span><span className="v acc">●●●● XMR</span></div>
              <div className="kv"><span className="k">Subaddrs</span><span className="v">14</span></div>
              <div className="kv"><span className="k">Daemon</span><span className="v g">local</span></div>
              <div className="kv"><span className="k">Privacy</span><span className="v p">maximal</span></div>
              <div style={{ marginTop: 8 }}>
                <button style={{ display: "block", width: "100%", background: "transparent", border: "1px solid var(--tk-accent)", color: "var(--tk-accent)", padding: "6px 8px", fontFamily: "var(--f-mono)", fontSize: 10.5, letterSpacing: "0.16em", textTransform: "uppercase", boxShadow: "var(--glow-1)", cursor: "pointer" }}>$ send tx</button>
              </div>
            </div>
            <div className="rail-block">
              <h6>Privacy fence</h6>
              <div className="kv"><span className="k">Ring size</span><span className="v acc">16</span></div>
              <div className="kv"><span className="k">Stem hops</span><span className="v p">10</span></div>
              <div className="kv"><span className="k">Tor relay</span><span className="v g">on</span></div>
              <div className="kv"><span className="k">I2P relay</span><span className="v g">on</span></div>
              <div className="kv"><span className="k">View key</span><span className="v">private</span></div>
              <div className="kv"><span className="k">FCMP++ test</span><span className="v p">opt-in</span></div>
            </div>
            <div className="rail-block">
              <h6>Recent CLI</h6>
              <pre style={{ margin: 0, fontFamily: "var(--f-mono)", fontSize: 10, lineHeight: 1.5, color: "var(--ink-60)" }}>
{`$ status
$ get_block_count
$ get_mempool
$ transfer 0.42 8A4…
$ relay_tx 5e27cfc8…
$ print_height`}
              </pre>
            </div>
            <div className="rail-block">
              <h6>Network gauges</h6>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                <TermGauge value={100} label="SYNC" />
                <TermGauge value={94} label="PRIV" color="var(--p-50)" />
                <TermGauge value={68} label="P2P" color="var(--c-50)" />
                <TermGauge value={72} label="FCMP" color="var(--g-50)" />
              </div>
            </div>
          </aside>
        </div>
        <Footer data={data} />
      </div>
    </div>
  );
}

window.TerminalHubView = TerminalHubView;
