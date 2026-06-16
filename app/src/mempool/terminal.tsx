// AUTO-PORTED from terminal.jsx
// Run `npm run port` to refresh. Manual fixups land in MIGRATION.md.
import * as React from "react";
import { useTick } from "@/design/ArtBackground";
import { PanelFrame } from "@/design/primitives";
import { fmtBytes, fmtN, shortHash } from "@/data/types";
import { FEE_TIER_LABELS } from "@/data/map";
import { useFeedEvents } from "@/data/useFeedEvents";
import type { FeedEvent } from "@/data/useFeedEvents";
import { MempoolSearchBar, useMempoolTracking, MempoolTrackingDetail } from "@/mempool/mempool-shared";
import type { MoneroLive, Block } from "@/data/types";

interface ViewProps {
  data: MoneroLive;
  bg?: { intensity?: "calm" | "busy" | "chaotic"; scan?: boolean };
}

// Left-pad a number to a fixed width for the ASCII status panel.
const pad = (n: number, w: number) => String(n).padStart(w, " ");

/** Tier colors, slow → fastest. */
const TIER_COLORS = ["var(--c-50)", "var(--g-50)", "var(--y-50)", "var(--r-50)"] as const;

/** GB string from a real byte count; "—" until the node has reported it. */
const dbGB = (data: MoneroLive) =>
  data.ready && data.databaseSize ? (data.databaseSize / 1e9).toFixed(1) + " GB" : "—";

// terminal.jsx — TERMINAL HUB · hi-fi CLI
//
// The "I run my own node" power-user surface. A self-typing command palette
// fed by live RPC data, an auto-tailing log derived from real feed diffs,
// a reactive ASCII block stream, a live ASCII fee histogram, compact radial
// gauges and a node/fee/chain rail. Scanlines on. Every number rendered here
// comes from the daemon feed; unknowns render "—" until data.ready.
//
// All helpers prefixed `Term` to avoid shared-scope collisions.

/* ── self-typing command palette (real RPC outputs) ─────────── */
function TermPalette({ data }: { data: MoneroLive }) {
  const cmds = React.useMemo(() => {
    if (!data.ready) return [] as { q: string; rows: string[][] }[];
    const b = data.blocks[0];
    const pool = data.mempool.slice(0, 2);
    return [
      { q: "get_info", rows: [["INFO", `height ${data.height.toLocaleString()}`, `diff ${data.difficulty.toLocaleString()}`]] },
      { q: "get_last_block_header", rows: [b ? ["BLOCK", `#${b.height.toLocaleString()} ${shortHash(b.hash)}`, `txs=${b.txs}`] : ["BLOCK", "—", ""]] },
      { q: "get_fee_estimate", rows: [["FEE", data.feeTiers.length === 4 ? data.feeTiers.map((t) => Math.round(t)).join(" / ") : "—", "pcn/B · slow→fastest"]] },
      { q: "print_pool", rows: pool.length ? pool.map((t) => ["TX", shortHash(t.id), `${Math.round(t.perB)} pcn/B · ${t.size} B`]) : [["POOL", "—", "pool empty"]] },
    ];
  }, [data.ready, data.height, data.difficulty, data.mempool, data.blocks, data.feeTiers]);
  const [ci, setCi] = React.useState(0);
  const [typed, setTyped] = React.useState("");
  const [phase, setPhase] = React.useState("typing"); // typing → hold → clearing
  React.useEffect(() => {
    if (!cmds.length) return;
    const full = cmds[ci % cmds.length].q;
    let to: ReturnType<typeof setTimeout> | undefined;
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
  const showResults = phase === "hold" && cmds.length > 0;
  return (
    <div style={{ border: "1px solid var(--tk-accent)", background: "rgba(0,0,0,0.65)", boxShadow: "0 0 24px rgba(255,122,26,0.22), inset 0 0 30px rgba(255,122,26,0.05)", borderRadius: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid var(--rule)", fontFamily: "var(--f-mono)", fontSize: 13 }}>
        <span style={{ color: "var(--tk-accent)", textShadow: "var(--glow-1)" }}>›</span>
        <span style={{ color: "var(--ink-100)" }}>{typed}</span>
        <span style={{ width: 8, height: 16, background: "var(--tk-accent)", boxShadow: "var(--glow-1)", animation: "term-blink 1s steps(2) infinite", display: "inline-block" }} />
        <span style={{ marginLeft: "auto", color: "var(--ink-40)", fontSize: 10 }}>⌘K · ESC</span>
      </div>
      <div style={{ padding: 8, fontFamily: "var(--f-mono)", fontSize: 11.5, minHeight: 96 }}>
        {(showResults ? cmds[ci % cmds.length].rows : []).map((r, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "60px 1fr 1.1fr 18px", gap: 10, padding: "6px 8px", background: i === 0 ? "rgba(255,122,26,0.12)" : "transparent", borderLeft: i === 0 ? "2px solid var(--tk-accent)" : "2px solid transparent", animation: "term-slidein 0.25s ease" }}>
            <span className="dim2" style={{ fontSize: 9, letterSpacing: "0.1em" }}>{r[0]}</span>
            <span className={i === 0 ? "acc" : ""}>{r[1]}</span>
            <span className="dim">{r[2]}</span>
            <span className="dim2" style={{ textAlign: "right" }}>{i === 0 ? "↵" : ""}</span>
          </div>
        ))}
        {!showResults ? <div className="dim2" style={{ padding: "30px 8px", textAlign: "center", letterSpacing: "0.14em" }}>{!cmds.length || phase === "typing" ? "querying daemon…" : "—"}</div> : null}
      </div>
      <style>{`@keyframes term-blink { 0%,50% { opacity: 1; } 50.01%,100% { opacity: 0; } } @keyframes term-slidein { from { opacity: 0; transform: translateX(-4px); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  );
}

/* ── reactive ASCII block stream ────────────────────────────── */
export function TermAsciiBlocks({ data }: { data: MoneroLive }) {
  const cols: Block[] = data.blocks.slice(0, 13);
  const rowsMax = 18;
  const cell = (
    label: string | null,
    q: boolean,
    txs = 0,
    height = 0,
    conf = 0,
    sizeKB = 0,
    newest = false,
  ) => {
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

/* ── live auto-tailing log · real feed diffs ────────────────── */
function TermLiveLog({ data }: { data: MoneroLive }) {
  const events = useFeedEvents(data, 16);
  const fmtTs = (ts: number) => new Date(ts).toTimeString().slice(0, 8);
  const line = (e: FeedEvent): { lvl: string; cat: string; msg: string } => {
    switch (e.kind) {
      case "block": return { lvl: "I", cat: "core", msg: `block #${e.height} ${e.hash.slice(0, 8)}… txs=${e.txs} ${e.sizeKB.toFixed(1)}KB` };
      case "tx": return { lvl: "I", cat: "txpool", msg: `tx ${e.id.slice(0, 8)}… ${e.size}B fee=${e.fee.toFixed(6)} rate=${Math.round(e.perB)} pcn/B` };
      case "txdrop": return { lvl: "I", cat: "txpool", msg: `${e.count} tx left pool (mined/expired)` };
      case "stale": return { lvl: "W", cat: "net", msg: "feed stale · retrying" };
      case "recover": return { lvl: "I", cat: "net", msg: "feed recovered" };
    }
  };
  const colorFor = (lvl: string, cat?: string) => lvl === "W" ? "var(--y-50)" : lvl === "E" ? "var(--r-50)" : cat === "core" ? "var(--tk-accent)" : cat === "txpool" ? "var(--c-50)" : cat === "net" ? "var(--g-50)" : "var(--ink-60)";
  return (
    <div style={{ fontFamily: "var(--f-mono)", fontSize: 10.5, lineHeight: 1.5 }}>
      {events.length === 0 ? (
        <div className="dim2" style={{ padding: "8px 0", letterSpacing: "0.12em" }}>waiting for feed…</div>
      ) : events.map((e, i) => {
        const l = line(e);
        return (
          <div key={`${e.ts}-${i}`} style={{ display: "grid", gridTemplateColumns: "16px 70px 56px 1fr", gap: 8, padding: "1px 0", animation: "term-logslide 0.35s ease" }}>
            <span style={{ color: colorFor(l.lvl), fontWeight: 600 }}>{l.lvl}</span>
            <span className="dim2">{fmtTs(e.ts)}</span>
            <span style={{ color: colorFor(l.lvl, l.cat) }}>{l.cat}</span>
            <span className="dim" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.msg}</span>
          </div>
        );
      })}
      <style>{`@keyframes term-logslide { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  );
}

/* ── live ASCII fee histogram ───────────────────────────────── */
export function TermFeeHisto({ data }: { data: MoneroLive }) {
  const tick = useTick(1200);
  const bins = React.useMemo(() => {
    const b = new Array(11).fill(0);
    data.mempool.forEach((t) => { const i = Math.min(10, Math.floor(t.perB / 4e4)); b[i] += 1; });
    return b;
  }, [data.mempool, tick]);
  const max = Math.max(...bins, 1);
  const medianBin = bins.indexOf(Math.max(...bins));
  const bar = (v: number) => "█".repeat(Math.round((v / max) * 24));
  return (
    <pre style={{ margin: 0, fontFamily: "var(--f-mono)", fontSize: 10.5, lineHeight: 1.5, color: "var(--tk-accent)", textShadow: "0 0 4px rgba(255,122,26,0.4)" }}>
      {bins.map((v, i) => `${String(i * 40).padStart(3, " ")} |${bar(v).padEnd(24, " ")} ${String(v).padStart(3, " ")}${i === medianBin ? "  ← median" : ""}`).join("\n")}
      <div className="dim" style={{ fontFamily: "var(--f-mono)", fontSize: 10, marginTop: 6 }}>fee in piconero/byte · {data.mempool.length} tx sample</div>
    </pre>
  );
}

/* ── compact radial gauge ───────────────────────────────────── */
export function TermGauge({ value, label, color = "var(--tk-accent)", size = 84 }: any) {
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

export function TerminalHubView({ data }: ViewProps) {
  const memBytes = data.mempool.reduce((a, t) => a + t.size, 0);
  // Shared tracking — same hook + detail (confOf) as every other view.
  const { tracking, onSearch, clearTracking } = useMempoolTracking(data);
  const tiersKnown = data.feeTiers.length === 4;
  // Median mempool fee rate (piconero/B) — real txs only.
  const medianPerB = React.useMemo(() => {
    if (!data.mempool.length) return 0;
    const s = data.mempool.map((t) => t.perB).sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  }, [data.mempool]);
  const syncPct = data.ready && data.synchronized ? 100 : 0;
  const poolPct = data.ready && data.blockWeightLimit ? Math.min(100, Math.round((memBytes / data.blockWeightLimit) * 100)) : 0;
  const weightPct = data.ready && data.blockWeightLimit ? Math.min(100, Math.round((data.blockWeightMedian / data.blockWeightLimit) * 100)) : 0;
  const feePct = data.ready && tiersKnown && medianPerB && data.feeTiers[2] ? Math.min(100, Math.round((medianPerB / data.feeTiers[2]) * 100)) : 0;
  return (
    <div className="main" style={{ overflow: "auto", padding: 0 }}>
      <div className="mempool-search-bar">
        <MempoolSearchBar onSearch={onSearch} />
        <span className="mono dim" style={{ fontSize: 10.5, marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <span className="led pulse" /> monerod tail · Block {data.ready ? data.height.toLocaleString() : "—"} · {data.mempool.length} mempool
        </span>
      </div>
      {tracking ? (
        <MempoolTrackingDetail tracking={tracking} data={data} onBack={clearTracking} onPickTx={(id, h) => onSearch({ kind: "tx", id, blockHeight: h })} />
      ) : (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 14, padding: "16px 20px 40px" }}>
        <div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <PanelFrame title={<span>$ monerod --status</span>} right={<span className="acc">tail −f</span>}>
                <pre style={{ margin: 0, fontFamily: "var(--f-mono)", fontSize: 11.5, lineHeight: 1.5, color: "var(--ink-100)", textShadow: "0 0 6px rgba(255,122,26,0.18)" }}>
{`╭─ monerod ${data.version || "—"} `.padEnd(52, "─") + "\n│ Status:    "}
{data.ready ? (
  <>
    <span style={{ color: data.synchronized ? "var(--g-50)" : "var(--y-50)", textShadow: data.synchronized ? "var(--glow-g)" : "none" }}>{data.synchronized ? "SYNCED" : "SYNCING"}</span>
    {` (${data.height.toLocaleString()}/${data.height.toLocaleString()})`}
  </>
) : "—"}
{"\n│ Network:   " + (data.ready ? `${data.nettype || "—"} · hardfork ${data.hardfork}` : "—")}
{"\n│ Hash rate: "}
{data.ready ? (
  <>
    <span className="acc">{(data.hashrate / 1e9).toFixed(2)} GH/s</span>
    {` · diff ${data.difficulty.toLocaleString()}`}
  </>
) : "—"}
{"\n│ Mempool:   "}
<span className="acc">{pad(data.mempool.length, 3)} tx</span>
{` · ${fmtBytes(memBytes)}\n`}
{"╰" + "─".repeat(51)}
                </pre>
                <div style={{ marginTop: 12, fontFamily: "var(--f-mono)", fontSize: 11 }}>
                  <div className="kicker" style={{ marginBottom: 6 }}>CHAIN TOTALS</div>
                  {[
                    ["txs all-time", data.ready ? fmtN(data.txCountTotal) : "—"],
                    ["db size", dbGB(data)],
                    ["alt blocks", data.ready ? String(data.altBlocksCount) : "—"],
                    ["top block", data.ready ? shortHash(data.topBlockHash) : "—"],
                  ].map((r, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 6, padding: "1px 0" }}>
                      <span className="dim">{r[0]}</span><span className="acc">{r[1]}</span>
                    </div>
                  ))}
                </div>
              </PanelFrame>

              <PanelFrame title="$ jump · ⌘K" right={<span className="acc">PALETTE</span>}>
                <TermPalette data={data} />
              </PanelFrame>
            </div>

            <PanelFrame title="$ block-stream --ascii" right={<span>{Math.min(13, data.blocks.length)} LAST</span>}>
              <TermAsciiBlocks data={data} />
              <div style={{ marginTop: 10, fontFamily: "var(--f-mono)", fontSize: 10, color: "var(--ink-60)", borderTop: "1px dashed var(--ink-10)", paddingTop: 8, display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
                <span><span className="acc">█</span> tx fill ratio</span><span><span className="dim">0c</span> just mined</span><span><span className="dim">+10c</span> unlock</span><span className="dim2">ring=16</span><span className="dim2">target=2:00</span><span className="dim2 acc">scroll ←→</span>
              </div>
            </PanelFrame>

            <PanelFrame title="$ tail -f · live feed" right={<><span>−f</span><span className="acc" style={{ animation: "term-blink 1s steps(2) infinite" }}>●</span></>}>
              <TermLiveLog data={data} />
            </PanelFrame>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <PanelFrame title="$ awk · fee distribution">
                <TermFeeHisto data={data} />
              </PanelFrame>
              <PanelFrame title="$ fee · tiers · live">
                <pre style={{ margin: 0, fontFamily: "var(--f-mono)", fontSize: 10.5, lineHeight: 1.7 }}>
                  {FEE_TIER_LABELS.map((label, i) => (
                    <div key={label} style={{ color: tiersKnown ? TIER_COLORS[i] : "var(--ink-40)" }}>
                      {tiersKnown
                        ? `${label.padEnd(8)} ${String(Math.round(data.feeTiers[i])).padStart(8)} pcn/B   ${((data.feeTiers[i] * 1000) / 1e12).toFixed(5)} XMR/kB`
                        : `${label.padEnd(8)} ${"—".padStart(8)} pcn/B   — XMR/kB`}
                    </div>
                  ))}
                </pre>
              </PanelFrame>
              <PanelFrame title="$ env · runtime">
                <pre style={{ margin: 0, fontFamily: "var(--f-mono)", fontSize: 10.5, lineHeight: 1.55, color: "var(--ink-80)" }}>
{`MONEROD_VERSION=${data.version || "—"}
NETTYPE=${data.nettype || "—"}
SYNCHRONIZED=${data.ready ? String(data.synchronized) : "—"}
DB_SIZE=${dbGB(data)}
FORK=v${data.majorVersion || "—"}
TOP_BLOCK=${data.ready ? shortHash(data.topBlockHash) : "—"}
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
              <h6>Remote node</h6>
              <div className="kv"><span className="k">Daemon</span><span className="v acc">{data.version || "—"}</span></div>
              <div className="kv"><span className="k">Network</span><span className="v">{data.nettype || "—"}</span></div>
              <div className="kv"><span className="k">DB</span><span className="v">{dbGB(data)}</span></div>
              <div className="kv"><span className="k">Sync</span><span className={data.ready && data.synchronized ? "v g" : "v"}>{data.ready ? (data.synchronized ? "✓ synced" : "syncing") : "—"}</span></div>
            </div>
            <div className="rail-block">
              <h6>Fee tiers</h6>
              {FEE_TIER_LABELS.map((label, i) => (
                <div className="kv" key={label}>
                  <span className="k">{label}</span>
                  <span className="v" style={tiersKnown ? { color: TIER_COLORS[i] } : undefined}>
                    {tiersKnown ? `${Math.round(data.feeTiers[i])} pcn/B` : "—"}
                  </span>
                </div>
              ))}
            </div>
            <div className="rail-block">
              <h6>Chain totals</h6>
              <div className="kv"><span className="k">Txs all-time</span><span className="v acc">{data.ready ? fmtN(data.txCountTotal) : "—"}</span></div>
              <div className="kv"><span className="k">Alt blocks</span><span className="v">{data.ready ? String(data.altBlocksCount) : "—"}</span></div>
              <div className="kv"><span className="k">RandomX seed</span><span className="v">{data.ready ? shortHash(data.randomxSeedHash) : "—"}</span></div>
              <div className="kv"><span className="k">Top block</span><span className="v">{data.ready ? shortHash(data.topBlockHash) : "—"}</span></div>
            </div>
            <div className="rail-block">
              <h6>Network gauges</h6>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                <div title="node sync state"><TermGauge value={syncPct} label="SYNC" /></div>
                <div title="mempool bytes vs one full block"><TermGauge value={poolPct} label="POOL" color="var(--c-50)" /></div>
                <div title="median block weight vs dynamic limit"><TermGauge value={weightPct} label="WEIGHT" color="var(--p-50)" /></div>
                <div title="median pool fee rate vs fast tier"><TermGauge value={feePct} label="FEE" color="var(--g-50)" /></div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
