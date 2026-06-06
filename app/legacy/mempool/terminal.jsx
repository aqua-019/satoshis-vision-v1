// v5-terminal.jsx — TERMINAL HUB
// CLI-first. Live monerod log rail. ASCII-art block visualization.
// Scanlines default on. The "I run my own node" power-user view.

function AsciiBlocks({ blocks }) {
  // Render block heights as vertical ASCII bars using CSS grid cells
  // Each cell is a "pixel" colored by intensity
  const cols = blocks.slice(0, 14);
  const rowsMax = 20;
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols.length + 2}, 1fr)`, gap: 8, padding: "8px 0" }}>
      {/* queued + next */}
      {[{ q: true, l: "Q" }, { q: true, l: "N" }].map((q, idx) => (
        <div key={"q" + idx} style={{ fontFamily: "var(--f-mono)", fontSize: 10, color: "var(--tk-accent)", textShadow: "var(--glow-1)" }}>
          <div style={{ textAlign: "center", marginBottom: 4 }}>~+{2 - idx}</div>
          <pre style={{ margin: 0, lineHeight: 1, fontSize: 11, color: "var(--tk-accent)", textShadow: "var(--glow-1)" }}>
{`┌──┐
│  │
│  │
│  │
│  │
│  │
│  │
│  │
│  │
│  │
│ ${q.l} │
│  │
│  │
│  │
│  │
└──┘`}</pre>
          <div style={{ textAlign: "center", marginTop: 4, color: "var(--ink-40)" }}>0 tx</div>
        </div>
      ))}
      {cols.map((b, i) => {
        const filled = Math.min(rowsMax - 2, 2 + Math.floor((b.txs / 140) * (rowsMax - 4)));
        const empty = rowsMax - filled - 2;
        const fillChar = "█";
        const ascii = "┌──┐\n" + "│  │\n".repeat(empty) + (fillChar + fillChar + "\n").repeat(filled) + "└──┘";
        return (
          <div key={b.height} style={{ fontFamily: "var(--f-mono)", fontSize: 10, color: "var(--ink-80)" }}>
            <div style={{ textAlign: "center", marginBottom: 4, color: "var(--tk-accent)", textShadow: "var(--glow-1)" }}>
              {b.height.toString().slice(-3)}
            </div>
            <pre style={{ margin: 0, lineHeight: 1, fontSize: 11, color: "var(--tk-accent)", textShadow: "0 0 6px rgba(255,122,26,0.45)" }}>
              {ascii}
            </pre>
            <div style={{ textAlign: "center", marginTop: 4, color: "var(--ink-60)" }}>{b.txs}t</div>
            <div style={{ textAlign: "center", color: "var(--ink-40)", fontSize: 9 }}>{b.sizeKB.toFixed(0)}K</div>
            <div style={{ textAlign: "center", color: "var(--ink-40)", fontSize: 9 }}>{b.conf}c</div>
          </div>
        );
      })}
    </div>
  );
}

function MonerodLog() {
  const lines = [
    ["I", "12:49:18.221", "txpool", "Transaction added to pool: txid=<5e27cfc8...de2263> size=1788 fee=0.0004928 XMR"],
    ["I", "12:49:18.198", "p2p",    "Received TX from peer 5.9.84.122:18080, stem hop=1 weight=1.8KB"],
    ["I", "12:49:18.092", "dand",   "Stem→Fluff conversion p=0.13 < 0.10 fail · stays stem, forwarding"],
    ["I", "12:49:18.044", "core",   "BLOCK_ADDED #3,676,070 hash=b9cfbf...8e2d89 by P2Pool reward=0.601000000000 XMR"],
    ["I", "12:49:17.881", "p2p",    "Forwarded stem tx <5e27...> → 138.201.131.49:18080 h=2"],
    ["I", "12:49:17.766", "p2p",    "New outgoing peer 212.83.175.67:18080 agent=monerod/0.18.4.0 (Fluorine)"],
    ["W", "12:49:17.612", "rpc",    "Slow request /get_info from 65.21.187.214 took 311ms"],
    ["I", "12:49:17.503", "dand",   "Embargo timer set t=39s for tx <fcae53...056c75>"],
    ["I", "12:49:17.401", "core",   "Difficulty recomputed: 773,885,427,585 (Δ +0.21%)"],
    ["I", "12:49:17.288", "p2p",    "Sync: at height 3676070 / 3676070 (100.00%)"],
    ["I", "12:49:17.123", "p2p",    "Incoming peer node.community.rino.io:18080 agent=monerod/0.18.4.0"],
    ["I", "12:49:17.001", "txpool", "Removed 4 txs from pool (included in block #3,676,070)"],
    ["I", "12:49:16.890", "core",   "Long-term block weight 176,470 bytes (median 600,000)"],
    ["I", "12:49:16.755", "p2p",    "TX broadcast complete: 12/12 peers acknowledged"],
    ["I", "12:49:16.612", "core",   "Block hash verified, signing as v16 (CLSAG + Bulletproofs+)"],
    ["I", "12:49:16.501", "rpc",    "Subscriber wss://xmr.irish/ws/blocks notified"],
    ["I", "12:49:16.388", "wallet", "Scanning new block for outputs (subaddress account=0)"],
    ["W", "12:49:16.221", "p2p",    "Peer 159.203.62.18 fell behind: height=3676068 (expected 3676070)"],
    ["I", "12:49:16.144", "core",   "FCMP++ readiness gauge: 72% (membership proof draft 4)"],
    ["I", "12:49:16.001", "dand",   "Stem path generated: 10 hops, seed=0x4a72f9e1"],
    ["I", "12:49:15.892", "core",   "Verifying ring signature CLSAG size=16 ✓"],
  ];
  const colorFor = (lvl, cat) => {
    if (lvl === "W") return "#ffd400";
    if (lvl === "E") return "#ff4d6d";
    if (cat === "dand") return "#b87aff";
    if (cat === "core") return "#ff7a1a";
    if (cat === "p2p") return "#5ed3f4";
    return "var(--ink-60)";
  };
  return (
    <div style={{ fontFamily: "var(--f-mono)", fontSize: 10.5, lineHeight: 1.5 }}>
      {lines.map((l, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "16px 90px 56px 1fr", gap: 8, padding: "1px 0" }}>
          <span style={{ color: colorFor(l[0]), fontWeight: 600 }}>{l[0]}</span>
          <span className="dim2">{l[1]}</span>
          <span style={{ color: colorFor(l[0], l[2]) }}>{l[2]}</span>
          <span className="dim">{l[3]}</span>
        </div>
      ))}
    </div>
  );
}

function CmdPalette() {
  return (
    <div style={{
      position: "relative",
      border: "1px solid var(--tk-accent)",
      background: "rgba(0,0,0,0.65)",
      boxShadow: "0 0 24px rgba(255,122,26,0.25), inset 0 0 30px rgba(255,122,26,0.05)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 14px", borderBottom: "1px solid var(--rule)",
        fontFamily: "var(--f-mono)", fontSize: 13,
      }}>
        <span style={{ color: "var(--tk-accent)", textShadow: "var(--glow-1)" }}>›</span>
        <span style={{ color: "var(--ink-100)" }}>search block #</span>
        <span style={{ color: "var(--ink-100)", borderLeft: "2px solid var(--tk-accent)", paddingLeft: 2, animation: "blink 1s steps(2) infinite" }}></span>
        <span style={{ marginLeft: "auto", color: "var(--ink-40)", fontSize: 10 }}>⌘K · ESC to close</span>
      </div>
      <div style={{ padding: 8, fontFamily: "var(--f-mono)", fontSize: 11.5 }}>
        {[
          ["BLOCK", "#3,676,070", "0.601 XMR · 4 tx · 6.8 KB · P2Pool"],
          ["BLOCK", "#3,676,069", "0.608 XMR · 39 tx · 74.6 KB · SupportXMR"],
          ["TX",    "5e27cfc8...de2263", "1.8 KB · 0.0004928 XMR · ring 16"],
          ["TX",    "c52f67d3...b347cd", "1.8 KB · 0.0001227 XMR · ring 16"],
          ["PEER",  "65.21.187.214:18080", "DE · 42ms · monerod 0.18.4.0"],
          ["TOPIC", "Dandelion++", "Education · stem→fluff propagation"],
          ["TOPIC", "FCMP++",      "Education · full-chain membership proofs"],
        ].map((r, i) => (
          <div key={i} style={{
            display: "grid", gridTemplateColumns: "60px 1fr 1fr 18px",
            gap: 10, padding: "5px 8px",
            background: i === 0 ? "rgba(255,122,26,0.12)" : "transparent",
            borderLeft: i === 0 ? "2px solid var(--tk-accent)" : "2px solid transparent",
          }}>
            <span className="dim2" style={{ fontSize: 9, letterSpacing: "0.1em" }}>{r[0]}</span>
            <span className={i === 0 ? "acc" : ""}>{r[1]}</span>
            <span className="dim">{r[2]}</span>
            <span className="dim2" style={{ textAlign: "right" }}>{i === 0 ? "↵" : ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TerminalHubView({ data, bg }) {
  const scan = bg?.scan ?? true;
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
              <PanelFrame
                title={<><span>$ monerod --status</span></>}
                right={<span className="acc">tail −f</span>}
              >
                <pre style={{
                  margin: 0, fontFamily: "var(--f-mono)", fontSize: 11.5, lineHeight: 1.5,
                  color: "var(--ink-100)",
                  textShadow: "0 0 6px rgba(255,122,26,0.18)",
                }}>
{`╭─ monerod 0.18.4.0 ────────────────────────────────╮
│ Status:    `}<span style={{ color: "#4ade80", textShadow: "var(--glow-g)" }}>SYNCED</span>{`  100.00% (3676070/3676070)        │
│ Network:   mainnet · hardfork v16 (CLSAG+BP+)     │
│ Hash rate: `}<span className="acc">6.45 GH/s</span>{` · diff 773,885,427,585  │
│ Mempool:   `}<span className="acc">${pad(data.mempool.length, 3)} tx</span>{` · ${fmtBytes(data.mempool.reduce((a,t)=>a+t.size,0)).padEnd(8," ")}      │
│ Peers:     ${pad(data.peers.length, 3)}  ↓ 12.4 KB/s   ↑ 8.1 KB/s         │
│ Wallet:    `}<span style={{ color: "#b87aff", textShadow: "var(--glow-p)" }}>connected</span>{` · subaddr 0/0 · ring 16     │
│ Uptime:    47d 12h 18m                            │
╰───────────────────────────────────────────────────╯`}
                </pre>
                <div style={{ marginTop: 12, fontFamily: "var(--f-mono)", fontSize: 11 }}>
                  <div className="kicker" style={{ marginBottom: 6 }}>RPC ENDPOINTS</div>
                  {[
                    ["get_info",        "GET", "127.0.0.1:18089/json_rpc", "12ms"],
                    ["get_block",       "GET", "127.0.0.1:18089/json_rpc", "8ms"],
                    ["get_transactions","GET", "127.0.0.1:18089/get_transactions", "21ms"],
                    ["send_raw_tx",     "PUT", "127.0.0.1:18089/send_raw_transaction", "—"],
                    ["get_fee_estim.",  "GET", "127.0.0.1:18089/json_rpc", "5ms"],
                  ].map((r, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "120px 32px 1fr 50px", gap: 6, padding: "1px 0" }}>
                      <span className="acc">{r[0]}</span>
                      <span className="dim2">{r[1]}</span>
                      <span className="dim">{r[2]}</span>
                      <span className="dim2" style={{ textAlign: "right" }}>{r[3]}</span>
                    </div>
                  ))}
                </div>
              </PanelFrame>

              <PanelFrame title="$ jump · ⌘K" right={<span className="acc">PALETTE</span>}>
                <CmdPalette />
              </PanelFrame>
            </div>

            <PanelFrame title="$ block-stream --ascii" right={<><span>10 LAST</span><span className="acc">+2 QUEUED</span></>}>
              <AsciiBlocks blocks={data.blocks} />
              <div style={{
                marginTop: 10, fontFamily: "var(--f-mono)", fontSize: 10, color: "var(--ink-60)",
                borderTop: "1px dashed var(--ink-10)", paddingTop: 8,
                display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8,
              }}>
                <span><span className="acc">▮</span> queue depth ←</span>
                <span><span className="acc">█</span> tx fill ratio</span>
                <span><span className="dim">0c</span> just mined</span>
                <span><span className="dim">+10c</span> unlock</span>
                <span className="dim2">ring=16</span>
                <span className="dim2">target=2:00</span>
                <span className="dim2 acc">scroll: ←→</span>
              </div>
            </PanelFrame>

            <PanelFrame title="$ tail -f /var/log/monero/monero.log" right={<><span>−f</span><span className="acc blink">●</span></>}>
              <MonerodLog />
            </PanelFrame>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <PanelFrame title="$ awk · fee distribution">
                <pre style={{ margin: 0, fontFamily: "var(--f-mono)", fontSize: 10.5, lineHeight: 1.5, color: "var(--tk-accent)", textShadow: "0 0 4px rgba(255,122,26,0.4)" }}>
{`  0 |▍                          1
 40 |█▍                         3
 80 |████▎                      9
120 |████████▌                 17
160 |██████████████▎           28
200 |███████████████████▏      38  ← median
240 |██████████████████▎       36
280 |█████████████▍            27
320 |███████▎                  14
360 |███▍                       7
400 |▊                          2
`}
                </pre>
                <div className="dim" style={{ fontFamily: "var(--f-mono)", fontSize: 10, marginTop: 6 }}>
                  fee in piconero/byte · 220 tx sample
                </div>
              </PanelFrame>

              <PanelFrame title="$ peer · top 10 by latency">
                <pre style={{ margin: 0, fontFamily: "var(--f-mono)", fontSize: 10.5, lineHeight: 1.45, color: "var(--ink-80)" }}>
{data.peers.slice(0, 10).map((p, i) =>
  `${pad(i + 1, 2)} ${p.ip.padEnd(24, " ").slice(0, 24)} ${String(p.lat).padStart(4, " ")}ms  ${p.cnt}`
).join("\n")}
                </pre>
              </PanelFrame>

              <PanelFrame title="$ env · runtime">
                <pre style={{ margin: 0, fontFamily: "var(--f-mono)", fontSize: 10.5, lineHeight: 1.55, color: "var(--ink-80)" }}>
{`MONEROD_VERSION=0.18.4.0
MONEROD_NETWORK=mainnet
MONEROD_LOG_LEVEL=1
MONEROD_DB_SYNC=safe
MONEROD_BLOCK_SYNC=fast
DATA_DIR=/var/lib/monero
DB_SIZE=210.4 GB
LMDB_MMAP=mmap_lock
TOR_PROXY=127.0.0.1:9050
I2P_SAM=127.0.0.1:7656
TX_PROXY=dandelion++
RING_SIZE=16
BP_VARIANT=BP+`}
                </pre>
              </PanelFrame>
            </div>

            {/* Help / hotkeys footer */}
            <PanelFrame title="$ help" ticks={false}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 10, fontFamily: "var(--f-mono)", fontSize: 10.5 }}>
                {[
                  ["⌘K", "palette"],
                  ["G H", "home"],
                  ["G M", "mempool"],
                  ["G E", "education"],
                  ["G D", "dashboard"],
                  ["G S", "simulate"],
                  ["?",   "help"],
                  ["[",   "prev block"],
                  ["]",   "next block"],
                  ["/",   "search"],
                  ["F",   "follow log"],
                  ["S",   "scanlines"],
                  ["D",   "density"],
                  ["L",   "lock layout"],
                  ["⎋",   "back"],
                  ["⇧?",  "shortcuts"],
                ].map(([k, v], i) => (
                  <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ border: "1px solid var(--ink-20)", padding: "1px 6px", fontSize: 9.5, color: "var(--tk-accent)", textShadow: "var(--glow-1)" }}>{k}</span>
                    <span className="dim">{v}</span>
                  </div>
                ))}
              </div>
            </PanelFrame>
          </div>

          {/* right rail — wallet + privacy ctrls */}
          <aside className="rail" style={{ borderLeft: "1px solid var(--rule)", borderRight: "none" }}>
            <div className="rail-block">
              <h6>Wallet · sub 0/0</h6>
              <div className="kv"><span className="k">Balance</span><span className="v acc">●●●● XMR</span></div>
              <div className="kv"><span className="k">Unlocked</span><span className="v acc">●●●● XMR</span></div>
              <div className="kv"><span className="k">Subaddrs</span><span className="v">14</span></div>
              <div className="kv"><span className="k">Daemon</span><span className="v g">local</span></div>
              <div className="kv"><span className="k">Privacy</span><span className="v p">maximal</span></div>
              <div style={{ marginTop: 8 }}>
                <button style={{
                  display: "block", width: "100%",
                  background: "transparent",
                  border: "1px solid var(--tk-accent)", color: "var(--tk-accent)",
                  padding: "6px 8px", fontFamily: "var(--f-mono)", fontSize: 10.5,
                  letterSpacing: "0.16em", textTransform: "uppercase",
                  boxShadow: "var(--glow-1)", cursor: "pointer",
                }}>$ send tx</button>
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
$ transfer 0.42 8A4...
$ relay_tx 5e27cfc8...
$ print_height
$ show_blockchain_stats`}
              </pre>
            </div>
            <div className="rail-block">
              <h6>Network gauges</h6>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                <Gauge value={100} max={100} label="SYNC" size={86} />
                <Gauge value={94} max={100} label="PRIV" color="#b87aff" size={86} />
                <Gauge value={68} max={100} label="P2P" color="#5ed3f4" size={86} />
                <Gauge value={72} max={100} label="FCMP" color="#4ade80" size={86} />
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
