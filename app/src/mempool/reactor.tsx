// AUTO-PORTED from mempool/reactor.jsx
// Run `npm run port` to refresh. Manual fixups land in MIGRATION.md.
import * as React from "react";
import { Stat, Pill, PanelFrame } from "@/design/primitives";
import { fmtBytes, shortHash as ShortHash, randHex } from "@/data/types";
import type { MoneroLive, Tx, Block } from "@/data/types";

interface ViewProps {
  data: MoneroLive;
  bg?: { intensity?: "calm" | "busy" | "chaotic"; scan?: boolean };
}

// Deterministic, in-memory simulated tx (from lookupTx). No /api/tx wiring.
interface ReactorTx {
  id: string;
  size: number;
  fee: number;
  perB: number;
  ringSize: number;
  inputs: number;
  outputs: number;
  blockHeight: number | null;
  confirmations: number;
  status: string;
  eta: string;
  timelock: number;
  privacy: number;
}

type SearchQuery = { kind: "tx"; id: string } | { kind: "block"; height: number };
type Tracking =
  | { kind: "tx"; id: string; tx: ReactorTx }
  | { kind: "block"; height: number; block?: Block }
  | null;

// The block ribbon mixes real Blocks with synthetic queued/padded pseudo-blocks.
type RibbonBlock = {
  height: number;
  txs?: number;
  eta?: string;
  sizeKB?: number;
  reward?: number;
  age?: number;
  conf?: number;
  hash?: string;
  pool?: string;
};

interface Tier { id: string; label: string; color: string; eta: string }

// reactor.jsx — REACTOR · the flagship mempool explorer
//
// Matches xmr.irish v4 "mempool-explorer" UX (mempool.space-style for Monero):
//   - Horizontal block ribbon: newest QUEUED → 1 CONF → 10 CONF (UNLOCK)
//   - Search bar accepts block height (number) OR 64-char txid (hex)
//   - Track a transaction: arrow under its block, slides right with each conf
//   - Gold line marks the 10-conf full-unlock threshold
//   - Transaction detail panel below: hash, fee, ring size, privacy score,
//     CLSAG/BP+/ViewTags/Dandelion++ badges, key images, status timeline
//
// Data: reads from window.useMoneroLive(). Augments with a deterministic
// tx-lookup helper that simulates "find tx by hash". Swap-in path is the
// same as for the rest of the app: wire a real /api/tx/:txid in shared.jsx.

const REACTOR_RIBBON_LEN = 12;

// ── currency toggle (right corner) ──
const CURRENCIES = ["XMR", "BTC", "BTC/XMR"];

// ── 64-char hex test for txid input ──
const IS_TXID = (s: string) => /^[0-9a-f]{64}$/i.test(s.trim());
const IS_HEIGHT = (s: string) => /^\d{1,8}$/.test(s.trim());

/* ── simulated tx lookup ───────────────────────────────────────
   In production this is `fetch("/api/tx/" + txid)`. For now it
   constructs a deterministic tx given the txid, anchored to a
   mempool entry or recent block. */
function lookupTx(txid: string, data: MoneroLive): ReactorTx {
  // Hash → mempool index or block index
  const intHash = Array.from(txid).reduce((a, c) => (a + c.charCodeAt(0)) >>> 0, 0);
  const inMempool = (intHash & 3) === 0;
  if (inMempool && data.mempool.length) {
    const t = data.mempool[intHash % data.mempool.length];
    return {
      id: txid,
      size: t.size,
      fee: t.fee,
      perB: t.perB,
      ringSize: 16,
      inputs: t.inputs,
      outputs: t.outputs,
      blockHeight: null,           // not in a block yet
      confirmations: 0,
      status: "in mempool",
      eta: "~" + (1 + (intHash % 3)) + " min until block",
      timelock: 0,
      privacy: 90,
    };
  }
  // Otherwise: pin to a recent block
  const idx = intHash % Math.min(8, data.blocks.length);
  const block = data.blocks[idx];
  return {
    id: txid,
    size: 1500 + (intHash % 3000),
    fee: 0.0011 + (intHash % 9000) / 1e10,
    perB: 600000 + (intHash % 200000),
    ringSize: 16,
    inputs: 1 + (intHash % 2),
    outputs: 2,
    blockHeight: block.height,
    confirmations: block.conf,
    status: block.conf >= 10 ? "fully unlocked" : "confirming",
    eta: block.conf >= 10 ? "Confirmed" : "~" + ((10 - block.conf) * 2) + " min until unlock",
    timelock: 0,
    privacy: 90,
  };
}

/* ── search bar ─────────────────────────────────────────────── */

export function SearchBar({ onSearch }: { onSearch: (q: SearchQuery) => void }) {
  const [q, setQ] = React.useState("");
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) return;
    if (IS_TXID(trimmed)) onSearch({ kind: "tx", id: trimmed });
    else if (IS_HEIGHT(trimmed)) onSearch({ kind: "block", height: parseInt(trimmed, 10) });
  };
  return (
    <form onSubmit={onSubmit} style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, maxWidth: 460 }}>
      <span className="mono" style={{ color: "var(--ink-40)", fontSize: 14 }}>⌕</span>
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search block / tx hash…"
        spellCheck={false}
        style={{
          flex: 1, appearance: "none",
          background: "rgba(0,0,0,0.4)", color: "var(--ink-100)",
          border: "1px solid var(--ink-10)", borderRadius: 22,
          padding: "8px 14px", fontFamily: "var(--f-mono)", fontSize: 12,
          letterSpacing: "0.04em", outline: "none",
        }}
        onFocus={(e) => (e.target.style.borderColor = "var(--tk-accent)")}
        onBlur={(e) => (e.target.style.borderColor = "var(--ink-10)")}
      />
      <button type="submit" className="proto-btn"
        style={{ padding: "8px 14px", fontSize: 11, borderRadius: 22 }}>→</button>
    </form>
  );
}

/* ── block ribbon ───────────────────────────────────────────── */

export function BlockBox({ block, confLabel, status, trackedHere, onClick, tone }: {
  block?: RibbonBlock;
  confLabel?: string;
  status: string;
  trackedHere?: string | null;
  onClick?: () => void;
  tone?: string;
}) {
  const isQueued = status === "queued" || status === "next";
  const isPast = status === "past";
  return (
    <div
      onClick={onClick}
      data-block={block?.height}
      style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 6, cursor: onClick ? "pointer" : "default", minWidth: 102 }}
    >
      {/* Header above box */}
      <div style={{ display: "flex", flexDirection: "column", gap: 1, padding: "0 4px" }}>
        <div className="mono" style={{ fontSize: 10, letterSpacing: "0.08em", color: isQueued ? "var(--ink-40)" : "var(--tk-accent)", textShadow: isQueued ? "none" : "var(--glow-1)" }}>
          {status === "queued" ? "~" + (block?.height ?? "—") : "#" + (block?.height ?? "—").toLocaleString()}
        </div>
        <div className="kicker" style={{ fontSize: 8.5, color: isQueued ? "var(--ink-40)" : "var(--ink-60)" }}>
          {confLabel}
        </div>
      </div>

      {/* Block */}
      <div
        className={"mblock " + (isQueued ? "q" : "")}
        style={{
          minHeight: 130,
          background: isQueued ? "transparent"
            : isPast ? "linear-gradient(180deg, rgba(255,122,26,0.32) 0%, rgba(255,138,42,0.72) 100%)"
            : "linear-gradient(180deg, rgba(255,122,26,0.55) 0%, rgba(255,138,42,0.95) 100%)",
          border: trackedHere ? "1.5px solid var(--y-50)" : isQueued ? "1px dashed var(--tk-accent)" : "1px solid var(--tk-accent)",
          boxShadow: trackedHere
            ? "0 0 14px var(--y-50), inset 0 0 18px rgba(255,212,0,0.18)"
            : isQueued
              ? "inset 0 0 16px rgba(255,122,26,0.08)"
              : "inset 0 0 22px rgba(255,255,255,0.12), 0 0 12px rgba(255,122,26,0.28)",
          padding: "10px 8px", color: isQueued ? "var(--tk-accent)" : "#1a0f04",
          display: "flex", flexDirection: "column", justifyContent: "space-between",
          fontFamily: "var(--f-mono)", position: "relative",
        }}
      >
        {block ? (
          <>
            <div>
              <div className="nm" style={{ fontSize: 22, fontWeight: 500, lineHeight: 1, color: isQueued ? "var(--tk-accent)" : "#1a0f04", textShadow: isQueued ? "var(--glow-1)" : "none" }}>
                {isQueued && status === "queued" ? "—" : (block.txs ?? 0)}
                {!isQueued ? <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 4, opacity: 0.65 }}>TXS</span> : null}
              </div>
              {isQueued ? (
                <div style={{ fontSize: 9, opacity: 0.65, marginTop: 4 }}>
                  {status === "next" ? "NEXT · " + (block.txs || 0) + " TXS" : "QUEUED"}
                </div>
              ) : null}
            </div>
            <div style={{ fontSize: 9.5, lineHeight: 1.4, opacity: 0.92 }}>
              {isQueued ? (
                <>
                  <div>—</div>
                  <div>In ~{block.eta || "2 min"}</div>
                </>
              ) : (
                <>
                  <div>{(block.sizeKB ?? 0).toFixed(1)} KB</div>
                  <div>{(block.reward ?? 0).toFixed(2)} XMR</div>
                  <div style={{ opacity: 0.75 }}>{Math.floor((block.age ?? 0) / 60)}m ago</div>
                </>
              )}
            </div>
          </>
        ) : null}
      </div>

      {/* Arrow + label if tracked */}
      {trackedHere ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 2 }}>
          <div style={{ fontSize: 14, color: "var(--y-50)", lineHeight: 1, textShadow: "0 0 6px var(--y-50)" }}>▲</div>
          <div className="mono" style={{ fontSize: 10, color: "var(--y-50)", padding: "2px 6px", border: "1px solid var(--y-50)", borderRadius: 2, marginTop: 2, textShadow: "var(--glow-g)" }}>
            {trackedHere}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function BlockRibbon({ data, tracking, onSelectBlock }: {
  data: MoneroLive;
  tracking: Tracking;
  onSelectBlock: (h: number) => void;
}) {
  // Compose ribbon: 2 queued + 10 past blocks (1..10 conf)
  const queued: RibbonBlock[] = [
    { height: data.height + 2, eta: "4 min", txs: 0 },
    { height: data.height + 1, eta: "2 min", txs: data.mempool.length },
  ];
  const past: RibbonBlock[] = data.blocks.slice(0, 10);   // most recent = 1 conf, oldest = 10 conf
  // pad if fewer than 10
  while (past.length < 10) past.push({ height: data.height - past.length, hash: "—", txs: 0, sizeKB: 0, reward: 0, pool: "—", age: 120 * past.length, conf: past.length + 1 });

  const ribbon: { b: RibbonBlock; status: string; conf: number; confLabel: string }[] = [];
  queued.forEach((b, i) => ribbon.push({ b, status: i === 0 ? "queued" : "next", conf: 0, confLabel: i === 0 ? "QUEUED" : "NEXT" }));
  past.forEach((b, i) => ribbon.push({ b, status: i === 0 ? "current" : "past", conf: b.conf ?? 0, confLabel: (b.conf ?? 0) + ((b.conf ?? 0) === 1 ? " CONF" : " CONFS") }));

  // Identify which ribbon-slot the tracked tx lives in
  const trackedConf = tracking?.kind === "tx" ? tracking.tx.confirmations : null;
  const trackedHeight = tracking?.kind === "tx" ? tracking.tx.blockHeight : null;

  return (
    <div style={{ position: "relative", padding: "12px 16px 22px" }}>
      {/* Ribbon */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 6, overflowX: "auto", paddingBottom: 8 }}>
        {ribbon.map((r, i) => {
          const isTracked = trackedHeight && r.b.height === trackedHeight;
          return (
            <BlockBox
              key={r.b.height + "-" + i}
              block={r.b}
              status={r.status}
              confLabel={r.confLabel}
              trackedHere={isTracked ? ((trackedConf ?? 0) + "/10") : null}
              onClick={() => r.status !== "queued" && r.status !== "next" && onSelectBlock?.(r.b.height)}
            />
          );
        })}
      </div>

      {/* Gold line + unlock badge */}
      <div style={{ position: "absolute", left: 16, right: 16, bottom: 0, height: 14, pointerEvents: "none" }}>
        <div style={{
          position: "absolute", left: 0, right: 100, bottom: 6, height: 2,
          background: "linear-gradient(to right, rgba(255,212,0,0.12), rgba(255,212,0,0.7) 24%, rgba(255,212,0,0.7) 90%, rgba(255,212,0,0.4))",
          boxShadow: "0 0 6px rgba(255,212,0,0.4)",
        }} />
        <div style={{
          position: "absolute", right: 0, top: -22,
          fontFamily: "var(--f-mono)", fontSize: 9.5, letterSpacing: "0.16em",
          color: "var(--y-50)", padding: "3px 8px", border: "1px solid var(--y-50)",
          background: "rgba(0,0,0,0.7)", textShadow: "0 0 4px var(--y-50)",
        }}>
          10 CONF · UNLOCK
        </div>
      </div>
    </div>
  );
}

/* ── tracking strip (over ribbon) ──────────────────────────── */

export function TrackingStrip({ tracking, onClose }: { tracking: Tracking; onClose: () => void }) {
  if (!tracking) {
    return (
      <div className="mono dim" style={{ padding: "10px 16px", fontSize: 11, letterSpacing: "0.04em", color: "var(--ink-40)", borderBottom: "1px dashed var(--ink-10)" }}>
        Number → block height · 64-char hex → block hash or txid
      </div>
    );
  }

  const tx = tracking.kind === "tx" ? tracking.tx : null;
  const conf = tx?.confirmations ?? 0;
  const pct = Math.min(1, conf / 10);
  const moreBlocks = tracking.kind === "tx" && conf < 10 ? (10 - conf) : 0;
  const label = tracking.kind === "tx"
    ? "TRACKING " + ShortHash(tx?.id) + " · " + conf + "/10 CONFIRMATIONS"
    : "TRACKING BLOCK #" + tracking.height;

  return (
    <div style={{ padding: "10px 16px", borderBottom: "1px dashed var(--ink-10)", display: "flex", alignItems: "center", gap: 14, fontFamily: "var(--f-mono)", fontSize: 11 }}>
      <span className="led pulse" style={{ background: "var(--c-50)", boxShadow: "0 0 6px var(--c-50)" }} />
      <span style={{ letterSpacing: "0.06em", color: "var(--ink-100)" }}>{label}</span>
      {tracking.kind === "tx" ? (
        <>
          <div style={{ flex: 1, maxWidth: 240, height: 4, background: "var(--ink-10)", position: "relative", borderRadius: 1 }}>
            <div style={{ position: "absolute", inset: "0 auto 0 0", width: (pct * 100).toFixed(0) + "%", background: "var(--c-50)", boxShadow: "0 0 6px var(--c-50)", borderRadius: 1 }} />
          </div>
          {moreBlocks > 0 ? <span className="dim" style={{ fontSize: 10.5 }}>{moreBlocks} more blocks</span> : null}
        </>
      ) : null}
      <span style={{ marginLeft: "auto" }} />
      <button type="button" onClick={onClose} className="proto-btn"
        style={{ padding: "4px 10px", fontSize: 10, borderColor: "var(--ink-20)", color: "var(--ink-60)", boxShadow: "none" }}>✕</button>
    </div>
  );
}

/* ── transaction detail panel ──────────────────────────────── */

export function TxDetailPanel({ tx, onBack }: { tx: ReactorTx; onBack: () => void }) {
  const [tracking, setTracking] = React.useState(true);
  if (!tx) return null;

  const isConfirmed = (tx.confirmations ?? 0) >= 10;
  return (
    <div style={{ padding: "20px 24px 40px", borderTop: "1px solid var(--rule)", background: "rgba(0,0,0,0.4)" }}>

      <button type="button" onClick={onBack} className="proto-btn"
        style={{ padding: "5px 10px", fontSize: 10, borderColor: "var(--ink-20)", color: "var(--ink-60)", boxShadow: "none", marginBottom: 14 }}>
        ← BACK
      </button>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, paddingBottom: 14, borderBottom: "1px solid var(--rule)", marginBottom: 14 }}>
        <div>
          <h2 className="serif" style={{ margin: 0, fontSize: 28, fontWeight: 400, color: "var(--ink-100)" }}>Transaction</h2>
          <div className="mono" style={{ fontSize: 12, color: "var(--c-50)", marginTop: 6, wordBreak: "break-all", maxWidth: "92ch" }}>{tx.id}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button type="button" className="proto-btn" style={{ padding: "4px 8px", fontSize: 10, borderColor: "var(--ink-20)", color: "var(--ink-60)", boxShadow: "none" }}
            onClick={() => { try { navigator.clipboard.writeText(tx.id); } catch(e){} }}>⧉</button>
          <Pill tone={isConfirmed ? "live" : "warn"} dot>{isConfirmed ? "Confirmed" : "Confirming"}</Pill>
          <button type="button" onClick={() => setTracking((v) => !v)} className="proto-btn"
            style={{ padding: "4px 10px", fontSize: 10, borderColor: tracking ? "var(--y-50)" : "var(--ink-20)", color: tracking ? "var(--y-50)" : "var(--ink-60)", boxShadow: tracking ? "0 0 6px rgba(255,212,0,0.35)" : "none" }}>
            {tracking ? "● TRACKING" : "▶ TRACK"}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
        <Detail k="Included in block" v={tx.blockHeight ? "#" + tx.blockHeight.toLocaleString() : "Pending"} tone="acc" />
        <Detail k="Fee" v={tx.fee.toFixed(7) + " XMR"} sub="$—" tone="acc" />
        <Detail k="ETA" v={tx.eta} />
        <Detail k="Fee rate" v={tx.perB.toFixed(2) + " pcn/B"} />
        <Detail k="Size" v={(tx.size / 1024).toFixed(1) + " KB"} />
        <Detail k="Ring size" v={tx.ringSize + " decoys"} />
      </section>

      {/* Privacy badges */}
      <section style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {[
          { l: "CLSAG",       tone: "g" },
          { l: "BP+",         tone: "g" },
          { l: "View Tags",   tone: "g" },
          { l: "No Timelock", tone: "g" },
          { l: "Dandelion++", tone: "g" },
        ].map((b) => (
          <span key={b.l} className="proto-badge ready" style={{ background: "rgba(74,222,128,0.06)" }}>{b.l}</span>
        ))}
      </section>

      {/* Confirmation status */}
      <ReactorConfirmationPanel tx={tx} />

      {/* Privacy strength bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", marginTop: 14, border: "1px solid var(--g-50)", background: "rgba(74,222,128,0.04)" }}>
        <span style={{ color: "var(--g-50)", fontSize: 18 }}>✓</span>
        <div className="mono" style={{ fontSize: 11, color: "var(--ink-100)" }}>
          Privacy <b className="up" style={{ fontSize: 13 }}>{tx.privacy}/100</b> <span className="up">STRONG</span>
          <span className="dim" style={{ marginLeft: 16 }}>CLSAG · BP+ · 16 ring · View Tags · No Timelock</span>
        </div>
        <span style={{ marginLeft: "auto", color: "var(--ink-40)" }}>▾</span>
      </div>

      {/* Inputs */}
      <PanelFrame title={`Inputs (${tx.inputs})`} right={<span>Ring 16 · Pedersen commitments</span>} style={{ marginTop: 14 }}>
        {Array.from({ length: tx.inputs }).map((_, i) => (
          <div key={i} style={{ padding: "12px 0", borderBottom: i < tx.inputs - 1 ? "1px dashed var(--ink-10)" : "none" }}>
            <div className="mono dim" style={{ fontSize: 10.5, letterSpacing: "0.06em" }}>Input {i} — Key Image</div>
            <div className="mono" style={{ fontSize: 11, color: "var(--c-50)", marginTop: 4, wordBreak: "break-all" }}>{randHex(64)}</div>
            <div className="mono dim" style={{ fontSize: 10.5, marginTop: 6 }}>
              Ring: <b style={{ color: "var(--ink-100)" }}>16 members</b> · Amount: <b style={{ color: "var(--y-50)" }}>HIDDEN</b> (Pedersen commitment)
            </div>
            <a href="#/education" className="mono dim" style={{ fontSize: 10.5, marginTop: 4, display: "inline-block", color: "var(--c-50)", textDecoration: "underline", textDecorationStyle: "dotted" }}>What is a key image?</a>
          </div>
        ))}
      </PanelFrame>
    </div>
  );
}

export function Detail({ k, v, sub, tone }: { k: React.ReactNode; v: React.ReactNode; sub?: React.ReactNode; tone?: string }) {
  return (
    <div>
      <div className="kicker">{k}</div>
      <div className={"mono " + (tone === "acc" ? "acc" : "")} style={{ fontSize: 17, marginTop: 4 }}>{v}</div>
      {sub ? <div className="mono dim" style={{ fontSize: 10.5, marginTop: 2 }}>{sub}</div> : null}
    </div>
  );
}

export function BigKpi({ k, v, tone }: { k: React.ReactNode; v: React.ReactNode; tone?: string }) {
  return (
    <div style={{ padding: "14px 16px", border: "1px solid var(--rule)", borderRadius: 2, background: "rgba(0,0,0,0.3)" }}>
      <div className={"mono " + (tone === "acc" ? "acc" : "")} style={{ fontSize: 28, fontWeight: 500, lineHeight: 1, textShadow: tone === "acc" ? "var(--glow-1)" : "none", color: tone === "warn" ? "var(--y-50)" : undefined }}>{v}</div>
      <div className="kicker" style={{ marginTop: 6 }}>{k}</div>
    </div>
  );
}

/* ── Reactor's confirmation panel — same overdue logic as Classic ── */
const REACTOR_BLOCK_TARGET = 120;
export function ReactorConfirmationPanel({ tx }: { tx: ReactorTx }) {
  const confRef = React.useRef(tx.confirmations ?? 0);
  const sinceRef = React.useRef(Date.now());
  React.useEffect(() => {
    if (tx.confirmations !== confRef.current) {
      confRef.current = tx.confirmations;
      sinceRef.current = Date.now();
    }
  }, [tx.confirmations]);

  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const conf = tx.confirmations ?? 0;
  const elapsed = Math.floor((now - sinceRef.current) / 1000);
  const overdue = elapsed > REACTOR_BLOCK_TARGET;
  const secsToNext = Math.max(0, REACTOR_BLOCK_TARGET - elapsed);
  const nextTxt = overdue
    ? "+" + Math.floor((elapsed - REACTOR_BLOCK_TARGET) / 60) + ":" + String((elapsed - REACTOR_BLOCK_TARGET) % 60).padStart(2, "0") + " overdue"
    : "~" + Math.floor(secsToNext / 60) + ":" + String(secsToNext % 60).padStart(2, "0");
  const unlockSecs = Math.max(0, (10 - conf) * REACTOR_BLOCK_TARGET - (overdue ? 0 : elapsed));
  const unlockTxt = "~" + Math.floor(unlockSecs / 60) + ":" + String(unlockSecs % 60).padStart(2, "0");

  return (
    <PanelFrame title="Confirmation status" right={<><span className="led pulse" style={{ background: "var(--g-50)", boxShadow: "0 0 6px var(--g-50)" }} /> LIVE</>}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <BigKpi k="of 10 confirmations" v={conf} tone="acc" />
        <BigKpi k="Blocks remaining" v={Math.max(0, 10 - conf)} />
        <BigKpi k="Until next confirmation" v={nextTxt} tone={overdue ? "warn" : ""} />
        <BigKpi k="Until full unlock (10/10)" v={unlockTxt} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 18, marginBottom: 6 }}>
        {Array.from({ length: 11 }).map((_, i) => {
          const reached = i <= conf;
          return (
            <React.Fragment key={i}>
              {i > 0 ? (
                <div style={{ flex: 1, height: 2, background: reached ? "var(--c-50)" : "var(--ink-10)", boxShadow: reached ? "0 0 4px var(--c-50)" : "none" }} />
              ) : null}
              <div style={{
                width: 12, height: 12, borderRadius: 6,
                background: reached ? "var(--c-50)" : "transparent",
                border: "1px solid " + (reached ? "var(--c-50)" : "var(--ink-20)"),
                boxShadow: reached ? "0 0 6px var(--c-50)" : "none",
              }} />
            </React.Fragment>
          );
        })}
      </div>
      <div className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--ink-40)", marginTop: 6, flexWrap: "wrap", gap: 12 }}>
        <span>{conf} of 10 · {Math.max(0, 10 - conf)} more until unlock</span>
        <span>{conf >= 10 ? "Unlocked ✓" : "Confirming · " + conf + " of 10"}</span>
        <span>updated just now</span>
      </div>
    </PanelFrame>
  );
}

/* ── currency toggle (right rail of search) ───────────────── */

export function CurrencyToggle({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 6, fontFamily: "var(--f-mono)", fontSize: 11 }}>
      {CURRENCIES.map((c) => {
        const on = c === value;
        return (
          <button key={c} type="button" onClick={() => onChange(c)}
            style={{
              appearance: "none", cursor: "pointer", background: "transparent",
              border: 0, padding: "4px 8px",
              color: on ? "var(--tk-accent)" : "var(--ink-60)",
              letterSpacing: "0.08em", textShadow: on ? "var(--glow-1)" : "none",
              borderBottom: "1.5px solid " + (on ? "var(--tk-accent)" : "transparent"),
            }}>{c} {on ? "▾" : ""}</button>
        );
      })}
    </div>
  );
}

/* ── REACTOR VIEW · root ──────────────────────────────────── */

export function ReactorView({ data }: ViewProps) {
  const [tracking, setTracking] = React.useState<Tracking>(null);
  const [currency, setCurrency] = React.useState("XMR");

  const onSearch = (q: SearchQuery) => {
    if (q.kind === "tx") {
      setTracking({ kind: "tx", id: q.id, tx: lookupTx(q.id, data) });
    } else {
      const block = data.blocks.find((b) => b.height === q.height);
      setTracking({ kind: "block", height: q.height, block });
    }
  };
  const clearTracking = () => setTracking(null);

  // Re-resolve the tracked tx/block each time data updates (confirmations grow).
  React.useEffect(() => {
    setTracking((t) => {
      if (t?.kind === "tx") return { ...t, tx: lookupTx(t.id, data) };
      if (t?.kind === "block") return { ...t, block: data.blocks.find((b) => b.height === t.height) ?? t.block };
      return t;
    });
    // eslint-disable-next-line
  }, [data.height, data.mempool.length]);

  // Chrome (NavTop / NetRail / Footer) is supplied by the PAGE (MempoolPage).
  // The view renders only content. The tool strip + tracking strip + ribbon are
  // SIBLINGS of the scrolling panel area so the ribbon's absolutely-positioned
  // gold "unlock" badge + tracking arrows are never clipped (the v4 bug).
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Top tool strip: search + currency + status */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 20px", borderBottom: "1px solid var(--rule)", background: "linear-gradient(to bottom, rgba(0,0,0,0.4), transparent)" }}>
        <SearchBar onSearch={onSearch} />
        <span style={{ flex: 1 }} />
        <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-60)", border: "1px solid var(--ink-20)", borderRadius: 999, padding: "3px 10px", display: "flex", alignItems: "center", gap: 6 }}>
          <span className="led" style={{ background: "var(--r-50)", boxShadow: "0 0 4px var(--r-50)" }} /> block
        </span>
        <CurrencyToggle value={currency} onChange={setCurrency} />
      </div>

      {/* Tracking strip */}
      <TrackingStrip tracking={tracking} onClose={clearTracking} />

      {/* Block ribbon */}
      <BlockRibbon data={data} tracking={tracking} onSelectBlock={(h) => onSearch({ kind: "block", height: h })} />

      {/* Content — the ONLY overflow:auto in the view subtree (besides the
          ribbon's own inner row). padding:0 keeps the tool strip/ribbon edge-to-edge. */}
      <div className="main" style={{ overflow: "auto", padding: 0 }}>
        {tracking?.kind === "tx" ? (
          <TxDetailPanel tx={tracking.tx} onBack={clearTracking} />
        ) : tracking?.kind === "block" && tracking.block ? (
          <BlockDetailPanel block={tracking.block} onBack={clearTracking} />
        ) : (
          <OverviewPanels data={data} onPickTx={(id) => onSearch({ kind: "tx", id })} />
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   REACTOR · hi-fi overview · animated SVG instruments
   ──────────────────────────────────────────────────────────── */

const REACTOR_TIERS: Tier[] = [
  { id: "priority", label: "PRIORITY", color: "#FF4455", eta: "Next"     },
  { id: "fast",     label: "FAST",     color: "#FF7A1A", eta: "1–2 blk"  },
  { id: "normal",   label: "NORMAL",   color: "#4ADE80", eta: "~10 min"  },
  { id: "economy",  label: "ECONOMY",  color: "#3D8EFF", eta: "60 min+"  },
];

function reactorThresholds(mempool: Tx[]): number[] {
  if (!mempool.length) return [10000, 6000, 4000];
  const sorted = mempool.map((t) => t.perB).sort((a, b) => b - a);
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  return [q(0.15), q(0.4), q(0.7)];
}

function reactorTierOf(t: Tx, thr: number[]): Tier {
  if (t.perB >= thr[0]) return REACTOR_TIERS[0];
  if (t.perB >= thr[1]) return REACTOR_TIERS[1];
  if (t.perB >= thr[2]) return REACTOR_TIERS[2];
  return REACTOR_TIERS[3];
}

/* ── orbital reactor core: tx particles orbit at fee-tier radii ── */

export function ReactorCore({ mempool }: { mempool: Tx[] }) {
  const ref = React.useRef<SVGSVGElement | null>(null);
  const cx = 240, cy = 240, R = 220;
  // Pre-compute tier ring radii
  const tierR: Record<string, number> = { priority: 60, fast: 100, normal: 150, economy: 200 };

  const thr = React.useMemo(() => reactorThresholds(mempool), [mempool]);
  // Build particles from mempool — one per tx, with tier, angle, speed.
  const particles = React.useMemo(() => {
    return mempool.slice(0, 220).map((t, i) => {
      const tier = reactorTierOf(t, thr);
      return {
        tier,
        r: tierR[tier.id] + ((i * 7) % 12) - 6, // jitter
        a0: (i * 13.7) % 360,
        speed: 8 + ((i % 5) * 3) + (tier.id === "priority" ? 14 : tier.id === "fast" ? 8 : 0),
        size: Math.max(1.2, Math.min(4.5, t.size / 1200)),
      };
    });
  }, [mempool]);

  React.useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = () => {
      const el = ref.current;
      if (!el) return;
      const t = (performance.now() - t0) / 1000;
      // rotate ring groups
      el.querySelectorAll("[data-ring]").forEach((g) => {
        const speed = parseFloat(g.getAttribute("data-speed") || "") || 6;
        g.setAttribute("transform", `rotate(${(t * speed) % 360} ${cx} ${cy})`);
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [particles.length]);

  // Group particles per tier so each tier rotates as a body
  const grouped = REACTOR_TIERS.map((tier) => ({
    tier,
    parts: particles.filter((p) => p.tier.id === tier.id),
  }));

  return (
    <svg ref={ref} viewBox="0 0 480 480" width="100%" style={{ display: "block", maxHeight: 460 }}>
      <defs>
        <radialGradient id="rx-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255,122,26,0.35)" />
          <stop offset="60%" stopColor="rgba(255,122,26,0.04)" />
          <stop offset="100%" stopColor="rgba(255,122,26,0)" />
        </radialGradient>
        <filter id="rx-soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.7" />
        </filter>
      </defs>

      {/* outer reactor halo */}
      <circle cx={cx} cy={cy} r={R} fill="url(#rx-glow)" />

      {/* tier rings */}
      {REACTOR_TIERS.map((tier) => (
        <circle key={tier.id} cx={cx} cy={cy} r={tierR[tier.id]}
          fill="none" stroke={tier.color} strokeOpacity="0.18"
          strokeDasharray="2 4" strokeWidth="1" />
      ))}

      {/* tick marks at cardinal points (HUD framing) */}
      {[0, 90, 180, 270].map((a) => {
        const x1 = cx + Math.cos(a * Math.PI / 180) * (R - 4);
        const y1 = cy + Math.sin(a * Math.PI / 180) * (R - 4);
        const x2 = cx + Math.cos(a * Math.PI / 180) * (R + 8);
        const y2 = cy + Math.sin(a * Math.PI / 180) * (R + 8);
        return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--tk-accent)" strokeOpacity="0.4" strokeWidth="1" />;
      })}

      {/* radial sweep arm */}
      <g style={{ transformOrigin: cx + "px " + cy + "px" }}>
        <line x1={cx} y1={cy} x2={cx + R} y2={cy} stroke="var(--tk-accent)" strokeOpacity="0.18" strokeWidth="1">
          <animateTransform attributeName="transform" type="rotate" from="0 240 240" to="360 240 240" dur="14s" repeatCount="indefinite" />
        </line>
      </g>

      {/* particles, grouped by tier so they orbit at their own speed */}
      {grouped.map(({ tier, parts }, gi) => {
        const speedSign = gi % 2 === 0 ? 1 : -1;
        const speed = (4 + gi * 3) * speedSign;
        return (
          <g key={tier.id} data-ring={tier.id} data-speed={speed}>
            {parts.map((p, i) => {
              const x = cx + Math.cos(p.a0 * Math.PI / 180) * p.r;
              const y = cy + Math.sin(p.a0 * Math.PI / 180) * p.r;
              return (
                <circle key={i} cx={x} cy={y} r={p.size}
                  fill={tier.color}
                  opacity="0.92"
                  style={{ filter: "drop-shadow(0 0 3px " + tier.color + ")" }} />
              );
            })}
          </g>
        );
      })}

      {/* core: pulsing block-tip readout */}
      <circle cx={cx} cy={cy} r="42" fill="rgba(0,0,0,0.85)" stroke="var(--tk-accent)" strokeWidth="1" />
      <circle cx={cx} cy={cy} r="42" fill="none" stroke="var(--tk-accent)" strokeOpacity="0.6">
        <animate attributeName="r" values="42;46;42" dur="2.4s" repeatCount="indefinite" />
        <animate attributeName="stroke-opacity" values="0.6;0.1;0.6" dur="2.4s" repeatCount="indefinite" />
      </circle>
      <text x={cx} y={cy - 4} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="8" fill="var(--ink-40)" letterSpacing="0.18em">MEMPOOL</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="16" fontWeight="500" fill="var(--tk-accent)" style={{ filter: "drop-shadow(0 0 4px var(--tk-accent))" }}>{mempool.length}</text>

      {/* tier legend rail */}
      {REACTOR_TIERS.map((tier, i) => {
        const y = 18 + i * 16;
        return (
          <g key={tier.id}>
            <rect x="12" y={y - 4} width="6" height="6" fill={tier.color} />
            <text x="24" y={y + 1} fontFamily="var(--f-mono)" fontSize="8" fill="var(--ink-60)" letterSpacing="0.16em">{tier.label}</text>
          </g>
        );
      })}
      <text x="468" y="22" textAnchor="end" fontFamily="var(--f-mono)" fontSize="8" fill="var(--ink-40)" letterSpacing="0.16em">REACTOR CORE · LIVE</text>
    </svg>
  );
}

/* ── block forge: a "next block" filling-by-tier visualisation ── */

export function ReactorBlockForge({ mempool, height }: { mempool: Tx[]; height: number }) {
  const thr = reactorThresholds(mempool);
  const buckets = REACTOR_TIERS.map((tier) => ({
    tier, txs: mempool.filter((t) => reactorTierOf(t, thr).id === tier.id),
  }));
  const total = mempool.length || 1;
  const cap = 250;
  const fill = Math.min(1, total / cap);
  return (
    <div style={{ background: "rgba(0,0,0,0.45)", border: "1px solid var(--rule)", borderRadius: 8, padding: "16px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div className="mono" style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-40)" }}>Forge · projected block</div>
          <div className="mono acc glow" style={{ fontSize: 22, fontWeight: 500, marginTop: 4 }}>#{(height + 1).toLocaleString()}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="mono" style={{ fontSize: 10, color: "var(--ink-40)", letterSpacing: "0.14em", textTransform: "uppercase" }}>ETA</div>
          <div className="mono" style={{ fontSize: 18, color: "var(--y-50)", textShadow: "0 0 6px rgba(255,212,0,0.4)", marginTop: 2 }}>~2:00</div>
        </div>
      </div>

      {/* the block — a tall stacked container of tier-segments */}
      <svg viewBox="0 0 360 220" width="100%" style={{ display: "block" }}>
        <defs>
          <linearGradient id="rx-block-edge" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,122,26,0.45)" />
            <stop offset="100%" stopColor="rgba(255,122,26,0.05)" />
          </linearGradient>
        </defs>
        {/* outline */}
        <rect x="60" y="10" width="240" height="200" fill="rgba(0,0,0,0.7)" stroke="url(#rx-block-edge)" strokeWidth="1.5" />
        {/* fill segments by tier */}
        {(() => {
          let yAcc = 210;
          return buckets.map((b, i) => {
            const h = (b.txs.length / cap) * 200;
            const y = yAcc - h;
            yAcc = y;
            return (
              <g key={b.tier.id}>
                <rect x="60" y={y} width="240" height={h}
                  fill={b.tier.color}
                  opacity="0.55"
                  style={{ filter: "drop-shadow(0 0 8px " + b.tier.color + "44)" }} />
                {/* texture: tx-as-pixel cells */}
                {Array.from({ length: Math.min(b.txs.length, 60) }).map((_, j) => {
                  const col = j % 12;
                  const row = Math.floor(j / 12);
                  return <rect key={j} x={62 + col * 20} y={y + 2 + row * 10}
                    width="18" height="8" fill={b.tier.color} opacity="0.85" />;
                })}
                {h > 18 ? (
                  <text x="68" y={y + 14} fontFamily="var(--f-mono)" fontSize="9" fill="rgba(0,0,0,0.7)" letterSpacing="0.12em">
                    {b.tier.label} · {b.txs.length}
                  </text>
                ) : null}
              </g>
            );
          });
        })()}
        {/* ticks on the right showing capacity */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1="300" x2="310" y1={210 - t * 200} y2={210 - t * 200} stroke="var(--ink-40)" strokeWidth="0.8" />
            <text x="316" y={213 - t * 200} fontFamily="var(--f-mono)" fontSize="8" fill="var(--ink-40)" letterSpacing="0.1em">{Math.round(t * 100)}%</text>
          </g>
        ))}
        {/* fill % */}
        <text x="180" y="240" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-60)" letterSpacing="0.16em">
          {Math.round(fill * 100)}% OF CAPACITY · {total} TX
        </text>
        {/* incoming particles */}
        {[0, 1, 2].map((i) => (
          <circle key={i} cx="20" cy={50 + i * 50} r="2.4" fill="var(--tk-accent)">
            <animate attributeName="cx" values="20;58" dur={(1.6 + i * 0.4) + "s"} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;1;0" dur={(1.6 + i * 0.4) + "s"} repeatCount="indefinite" />
          </circle>
        ))}
      </svg>
    </div>
  );
}

/* ── hashrate oscilloscope ── */

export function ReactorHashScope({ data }: { data: MoneroLive }) {
  const series: number[] = data.hashSeries || [];
  const W = 360, H = 110, padL = 10, padR = 10, padT = 14, padB = 14;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const min = Math.min(...series, data.hashrate);
  const max = Math.max(...series, data.hashrate);
  const rng = max - min || 1;
  const points = series.length ? series.map((v, i) => {
    const x = padL + (i / (series.length - 1)) * innerW;
    const y = padT + innerH - ((v - min) / rng) * innerH;
    return [x, y];
  }) : [];
  const path = "M" + points.map(([x, y]) => x.toFixed(1) + "," + y.toFixed(1)).join(" L ");
  const area = path + ` L ${padL + innerW},${padT + innerH} L ${padL},${padT + innerH} Z`;
  return (
    <div style={{ background: "rgba(0,0,0,0.45)", border: "1px solid var(--rule)", borderRadius: 8, padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span className="mono" style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-40)" }}>Hashrate · 7d</span>
        <span className="mono acc glow" style={{ fontSize: 12 }}>{(data.hashrate / 1e9).toFixed(2)} GH/s</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
        <defs>
          <linearGradient id="rx-hash" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,122,26,0.45)" />
            <stop offset="100%" stopColor="rgba(255,122,26,0.0)" />
          </linearGradient>
        </defs>
        {/* gridlines */}
        {[0.25, 0.5, 0.75].map((t) => (
          <line key={t} x1={padL} x2={W - padR} y1={padT + innerH * t} y2={padT + innerH * t}
            stroke="rgba(255,255,255,0.04)" strokeDasharray="2 3" />
        ))}
        <path d={area} fill="url(#rx-hash)" />
        <path d={path} fill="none" stroke="var(--tk-accent)" strokeWidth="1.4" style={{ filter: "drop-shadow(0 0 3px var(--tk-accent))" }} />
        {points.length ? (
          <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r="2.4"
            fill="var(--tk-accent)" style={{ filter: "drop-shadow(0 0 4px var(--tk-accent))" }}>
            <animate attributeName="r" values="2.4;3.6;2.4" dur="1.8s" repeatCount="indefinite" />
          </circle>
        ) : null}
      </svg>
    </div>
  );
}

/* ── block-pulse: countdown / overdue indicator ── */

export function ReactorBlockPulse({ data }: { data: MoneroLive }) {
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const lastBlockAge = (data.blocks && data.blocks[0]) ? data.blocks[0].age : 0;
  const TARGET = 120;
  const elapsed = lastBlockAge + Math.floor((now - data.lastUpdate) / 1000);
  const overdue = elapsed > TARGET;
  const pct = Math.min(1, elapsed / TARGET);
  const ring = 2 * Math.PI * 36;
  const dash = ring * pct;
  return (
    <div style={{ background: "rgba(0,0,0,0.45)", border: "1px solid var(--rule)", borderRadius: 8, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span className="mono" style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-40)" }}>Block pulse · 2:00 target</span>
        {overdue ? (
          <span className="mono" style={{ fontSize: 10, color: "var(--y-50)", letterSpacing: "0.14em" }}>OVERDUE</span>
        ) : (
          <span className="mono" style={{ fontSize: 10, color: "var(--g-50)", letterSpacing: "0.14em" }}>
            <span className="led pulse" style={{ background: "var(--g-50)", boxShadow: "0 0 4px var(--g-50)" }} /> NOMINAL
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <svg viewBox="0 0 100 100" width="84" height="84">
          <circle cx="50" cy="50" r="36" fill="none" stroke="var(--ink-10)" strokeWidth="6" />
          <circle cx="50" cy="50" r="36" fill="none"
            stroke={overdue ? "var(--y-50)" : "var(--tk-accent)"}
            strokeWidth="6" strokeLinecap="round"
            strokeDasharray={dash + " " + (ring - dash)}
            transform="rotate(-90 50 50)"
            style={{ filter: "drop-shadow(0 0 4px " + (overdue ? "var(--y-50)" : "var(--tk-accent)") + ")" }} />
          <text x="50" y="46" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="10" fill="var(--ink-40)" letterSpacing="0.12em">ELAPSED</text>
          <text x="50" y="60" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="14" fontWeight="500"
            fill={overdue ? "var(--y-50)" : "var(--ink-100)"}>
            {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
          </text>
        </svg>
        <div style={{ flex: 1, fontFamily: "var(--f-mono)", fontSize: 11, color: "var(--ink-60)", lineHeight: 1.6 }}>
          <div>Last block <b style={{ color: "var(--ink-100)" }}>#{data.height.toLocaleString()}</b></div>
          <div>{data.blocks?.[0]?.pool || "—"}</div>
          <div className="dim">Difficulty {(data.difficulty / 1e9).toFixed(2)}G</div>
          <div className="dim">Ring 16 · CLSAG · BP+</div>
        </div>
      </div>
    </div>
  );
}

/* ── tier rivers: animated horizontal flow per tier ── */

export function ReactorTierRivers({ mempool }: { mempool: Tx[] }) {
  const thr = reactorThresholds(mempool);
  return (
    <div style={{ background: "rgba(0,0,0,0.45)", border: "1px solid var(--rule)", borderRadius: 8, padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <span className="mono" style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-40)" }}>Fee tier rivers</span>
        <span className="mono dim" style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" }}>tx flowing → block</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {REACTOR_TIERS.map((tier, ti) => {
          const txs = mempool.filter((t) => reactorTierOf(t, thr).id === tier.id);
          const count = txs.length;
          const dots = Math.min(count, 18);
          return (
            <div key={tier.id} style={{ display: "grid", gridTemplateColumns: "84px 1fr 50px", gap: 10, alignItems: "center" }}>
              <span className="mono" style={{ fontSize: 10, color: tier.color, letterSpacing: "0.14em", fontWeight: 600 }}>{tier.label}</span>
              <div style={{ position: "relative", height: 18, background: "rgba(255,255,255,0.03)", borderRadius: 9, overflow: "hidden", border: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{
                  position: "absolute", inset: 0,
                  background: "linear-gradient(90deg, transparent, " + tier.color + "20, transparent)",
                  animation: "rx-shimmer 3.6s linear infinite",
                  backgroundSize: "200% 100%",
                }} />
                {Array.from({ length: dots }).map((_, i) => (
                  <div key={i} style={{
                    position: "absolute", top: "50%", left: "0",
                    width: 4, height: 4, borderRadius: 2,
                    background: tier.color,
                    boxShadow: "0 0 4px " + tier.color,
                    transform: "translateY(-50%)",
                    animation: `rx-flow-${ti} ${(4 + ti * 0.6)}s linear ${(-i * (4 + ti * 0.6) / dots)}s infinite`,
                  }} />
                ))}
              </div>
              <span className="mono" style={{ fontSize: 11, color: "var(--ink-100)", textAlign: "right" }}>{count}</span>
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes rx-shimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }
        @keyframes rx-flow-0 { from { left: -8px; } to { left: 102%; } }
        @keyframes rx-flow-1 { from { left: -8px; } to { left: 102%; } }
        @keyframes rx-flow-2 { from { left: -8px; } to { left: 102%; } }
        @keyframes rx-flow-3 { from { left: -8px; } to { left: 102%; } }
      `}</style>
    </div>
  );
}

/* ── enhanced live tx feed (with tier dot + sparkbar) ── */

export function ReactorTxFeed({ mempool, onPickTx }: { mempool: Tx[]; onPickTx: (id: string) => void }) {
  const thr = reactorThresholds(mempool);
  const rows = mempool.slice(0, 16);
  return (
    <div style={{ background: "rgba(0,0,0,0.45)", border: "1px solid var(--rule)", borderRadius: 8, padding: "12px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span className="mono" style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-40)" }}>Live tx feed · {rows.length} of {mempool.length}</span>
        <span className="mono dim" style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          <span className="led pulse" style={{ background: "var(--g-50)", boxShadow: "0 0 4px var(--g-50)" }} /> streaming
        </span>
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "1.5fr 0.8fr 1fr 0.7fr 0.9fr 0.7fr",
        gap: 10, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase",
        color: "var(--ink-40)", padding: "6px 8px", borderBottom: "1px solid var(--rule)",
      }} className="mono">
        <span>TXID</span><span>Size</span><span>Fee · XMR</span><span>Pcn/B</span><span>Tier</span><span>Age</span>
      </div>
      <div>
        {rows.map((t) => {
          const tier = reactorTierOf(t, thr);
          return (
            <div key={t.id} onClick={() => onPickTx(t.id)}
              style={{
                display: "grid", gridTemplateColumns: "1.5fr 0.8fr 1fr 0.7fr 0.9fr 0.7fr",
                gap: 10, fontSize: 11, padding: "7px 8px",
                borderBottom: "1px solid rgba(255,255,255,0.03)",
                cursor: "pointer", fontFamily: "var(--f-mono)",
                background: "linear-gradient(90deg, " + tier.color + "08, transparent 30%)",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "linear-gradient(90deg, " + tier.color + "22, rgba(255,255,255,0.02))"}
              onMouseLeave={(e) => e.currentTarget.style.background = "linear-gradient(90deg, " + tier.color + "08, transparent 30%)"}>
              <span style={{ color: "var(--c-50)" }}>{ShortHash(t.id)}</span>
              <span style={{ color: "var(--ink-80)" }}>{fmtBytes(t.size)}</span>
              <span style={{ color: "var(--tk-accent)" }}>{t.fee.toFixed(7)}</span>
              <span style={{ color: "var(--ink-80)" }}>{Math.round(t.perB).toLocaleString()}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, color: tier.color, fontSize: 9, letterSpacing: "0.14em" }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: tier.color, boxShadow: "0 0 5px " + tier.color }} />
                {tier.label}
              </span>
              <span style={{ color: "var(--ink-60)" }}>{t.age}s</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── overview panels (when nothing tracked) — hi-fi composition ── */

export function OverviewPanels({ data, onPickTx }: { data: MoneroLive; onPickTx: (id: string) => void }) {
  const memBytes = data.mempool.reduce((a, t) => a + t.size, 0);
  return (
    <div style={{ padding: "16px 20px 40px", display: "flex", flexDirection: "column", gap: 14 }}>
      {/* KPI strip */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
        <Stat k="Block height" v={data.height.toLocaleString()} sub="live" tone="acc" />
        <Stat k="Mempool" v={data.mempool.length + " tx"} sub={fmtBytes(memBytes)} />
        <Stat k="Hashrate" v={(data.hashrate / 1e9).toFixed(2) + " GH/s"} sub="2:00 target" />
        <Stat k="Difficulty" v={(data.difficulty / 1e9).toFixed(2) + "G"} />
        <Stat k="Ring size" v="16" sub="CLSAG" tone="p" />
        <Stat k="Fork" v="v16" sub="FCMP++ Q3" tone="p" />
      </section>

      {/* Hero row: orbital reactor core + forge */}
      <section style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 14 }}>
        <div style={{ background: "rgba(0,0,0,0.45)", border: "1px solid var(--rule)", borderRadius: 8, padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span className="mono" style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-40)" }}>Reactor core · orbital fee-tiers</span>
            <span className="mono dim" style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" }}>{data.mempool.length} particles</span>
          </div>
          <ReactorCore mempool={data.mempool} />
        </div>
        <ReactorBlockForge mempool={data.mempool} height={data.height} />
      </section>

      {/* Instruments row */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        <ReactorBlockPulse data={data} />
        <ReactorHashScope data={data} />
        <ReactorTierRivers mempool={data.mempool} />
      </section>

      {/* Live tx feed */}
      <ReactorTxFeed mempool={data.mempool} onPickTx={onPickTx} />
    </div>
  );
}

export function BlockDetailPanel({ block, onBack }: { block: Block; onBack: () => void }) {
  return (
    <div style={{ padding: "20px 24px 40px" }}>
      <button type="button" onClick={onBack} className="proto-btn" style={{ padding: "5px 10px", fontSize: 10, borderColor: "var(--ink-20)", color: "var(--ink-60)", boxShadow: "none", marginBottom: 14 }}>← BACK</button>
      <h2 className="serif" style={{ margin: 0, fontSize: 28, fontWeight: 400, color: "var(--ink-100)" }}>Block #{block.height.toLocaleString()}</h2>
      <div className="mono" style={{ fontSize: 12, color: "var(--c-50)", marginTop: 6, wordBreak: "break-all", maxWidth: "92ch" }}>{block.hash}</div>
      <section style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginTop: 18 }}>
        <Detail k="Txs" v={block.txs} tone="acc" />
        <Detail k="Size" v={block.sizeKB.toFixed(1) + " KB"} />
        <Detail k="Reward" v={block.reward.toFixed(3) + " XMR"} />
        <Detail k="Pool" v={block.pool} />
        <Detail k="Confirmations" v={block.conf} tone="acc" />
      </section>
    </div>
  );
}


