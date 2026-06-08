// AUTO-PORTED from mempool/classic.jsx
// Run `npm run port` to refresh. Manual fixups land in MIGRATION.md.
import * as React from "react";
import { fmtBytes, shortHash as ShortHash, randHex } from "@/data/types";
import type { MoneroLive, Tx } from "@/data/types";
import { useMempoolTracking, MempoolTrackingDetail } from "@/mempool/mempool-shared";
import { confOf } from "@/mempool/conf";
import { useRibbonGlide } from "@/mempool/useRibbonGlide";
import { useTick } from "@/design/ArtBackground";

interface ViewProps {
  data: MoneroLive;
  bg?: { intensity?: "calm" | "busy" | "chaotic"; scan?: boolean };
  focusBlock?: number | null;
  onClearFocus?: () => void;
}

// classic.jsx — CLASSIC · cleaner / sleeker take on the v4 mempool-explorer.
//
// Same data + behavior as Reactor (search, track-tx, 10-conf ribbon, tx detail,
// confirmation panel), but with the HUD chrome stripped: no scanlines, lighter
// glow, simpler borders, generous whitespace. The "default-pretty" option for
// users who want signal-over-style.
//
// Also implements the "overdue" state: when more than ~120s has elapsed since
// the last confirmation, the panel flips the "until next confirmation" KPI to
// "+M:SS overdue" in caution-yellow.

const CLASSIC_BLOCK_TARGET = 120; // seconds

const fmtMMSS = (sec: number): string => {
  const s = Math.max(0, Math.round(sec));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
};

// ClassicEta — a per-second countdown to the next block, isolated so only this
// text re-renders each second (the ribbon + FLIP glide are untouched). Honest to
// Monero's ~2-min cadence: interpolates "seconds since the tip's block" from the
// last data update, so the number visibly moves even when no block has landed,
// and resets toward ~2:00 when a real block arrives. `offsetSec` shifts the
// QUEUED card one block-target further out than the imminent NEXT card.
function ClassicEta({ tipAge, lastUpdate, offsetSec = 0 }: { tipAge: number; lastUpdate: number; offsetSec?: number }) {
  useTick(1000);
  const sinceTip = tipAge + Math.floor((Date.now() - lastUpdate) / 1000);
  const remain = Math.max(0, CLASSIC_BLOCK_TARGET - sinceTip) + offsetSec;
  return <>{fmtMMSS(remain)}</>;
}

// A tracked tx pins its block height ONCE at search time (see mempool/conf.ts);
// the ribbon highlight and the detail panel both derive confirmations live from
// that pinned height + the current tip, so they can never disagree.

/* ── clean search bar ─────────────────────────────────────── */

export function ClassicSearch({ onSearch }: any) {
  const [q, setQ] = React.useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = q.trim();
    if (!t) return;
    if (/^[0-9a-f]{64}$/i.test(t)) onSearch({ kind: "tx", id: t });
    else if (/^\d{1,8}$/.test(t)) onSearch({ kind: "block", height: parseInt(t, 10) });
  };
  return (
    <form onSubmit={submit} style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, maxWidth: 540 }}>
      <input
        type="text" value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="Search by block height or 64-char transaction hash…"
        spellCheck={false}
        style={{
          flex: 1, appearance: "none",
          background: "rgba(0,0,0,0.5)", color: "var(--ink-100)",
          border: "1px solid var(--ink-20)", borderRadius: 6,
          padding: "10px 14px", fontFamily: "var(--f-mono)", fontSize: 12.5,
          letterSpacing: "0.02em", outline: "none",
        }}
        onFocus={(e) => (e.target.style.borderColor = "var(--tk-accent)")}
        onBlur={(e) => (e.target.style.borderColor = "var(--ink-20)")}
      />
      <button type="submit"
        style={{
          appearance: "none", cursor: "pointer", padding: "10px 18px", fontSize: 11,
          background: "var(--tk-accent)", color: "#1a0f04",
          border: 0, borderRadius: 6, fontWeight: 500,
          fontFamily: "var(--f-mono)", letterSpacing: "0.08em", textTransform: "uppercase",
        }}>Search</button>
    </form>
  );
}

/* ── flatter block ribbon ─────────────────────────────────── */

export function ClassicBlock({ block, status, confLabel, trackedHere, onClick, glideKey, etaNode }: any) {
  const isQueued = status === "queued" || status === "next";
  return (
    <div
      onClick={onClick}
      data-glide-key={glideKey}
      className={glideKey != null ? "glide-block" : undefined}
      style={{
        display: "flex", flexDirection: "column", gap: 6,
        cursor: onClick ? "pointer" : "default", minWidth: 108,
      }}
    >
      <div style={{ padding: "0 2px" }}>
        <div className="mono" style={{ fontSize: 11, color: isQueued ? "var(--ink-40)" : "var(--ink-100)" }}>
          {isQueued ? "~" + block.height : "#" + block.height.toLocaleString()}
        </div>
        <div className="mono" style={{ fontSize: 9.5, letterSpacing: "0.08em", color: isQueued ? "var(--ink-40)" : "var(--tk-accent)", textTransform: "uppercase", marginTop: 1 }}>
          {confLabel}
        </div>
      </div>
      <div style={{
        minHeight: 132, padding: "12px 10px",
        borderRadius: 6,
        border: trackedHere ? "1.5px solid var(--y-50)" : isQueued ? "1px dashed var(--ink-20)" : "1px solid rgba(255,122,26,0.45)",
        background: isQueued
          ? "rgba(0,0,0,0.3)"
          : "linear-gradient(180deg, rgba(255,122,26,0.42), rgba(255,138,42,0.78))",
        color: isQueued ? "var(--ink-60)" : "#1a0f04",
        boxShadow: trackedHere ? "0 0 12px rgba(255,212,0,0.4)" : "none",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        fontFamily: "var(--f-mono)",
      }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 500, lineHeight: 1, color: isQueued ? "var(--ink-80)" : "#0e0805" }}>
            {isQueued && status === "queued" ? "—" : block.txs}
          </div>
          {!isQueued ? (
            <div style={{ fontSize: 9.5, opacity: 0.7, marginTop: 2 }}>TXS</div>
          ) : (
            <div style={{ fontSize: 9, opacity: 0.6, marginTop: 4 }}>
              {status === "next" ? "NEXT · " + (block.txs || 0) + " TXS" : "QUEUED"}
            </div>
          )}
        </div>
        <div style={{ fontSize: 9.5, opacity: 0.9, lineHeight: 1.5 }}>
          {isQueued ? (
            <>
              <div>—</div>
              <div>In ~{etaNode || block.eta || "2 min"}</div>
            </>
          ) : (
            <>
              <div>{block.sizeKB.toFixed(1)} KB</div>
              <div>{block.reward.toFixed(2)} XMR</div>
              <div style={{ opacity: 0.7 }}>{Math.floor(block.age / 60)}m ago</div>
            </>
          )}
        </div>
      </div>
      {trackedHere ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 2 }}>
          <div style={{ fontSize: 13, color: "var(--y-50)", lineHeight: 1 }}>▲</div>
          <div className="mono" style={{ fontSize: 10, color: "var(--y-50)", padding: "3px 8px", border: "1px solid var(--y-50)", borderRadius: 4, marginTop: 2 }}>
            {trackedHere}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ClassicRibbon({ data, tracking, onSelectBlock }: any) {
  const queued = [
    { height: data.height + 2, eta: "4 min", txs: 0 },
    { height: data.height + 1, eta: "2 min", txs: data.mempool.length },
  ];
  const past = data.blocks.slice(0, 10);
  while (past.length < 10) past.push({ height: data.height - past.length, hash: "—", txs: 0, sizeKB: 0, reward: 0, pool: "—", age: 120 * past.length, conf: past.length + 1 });

  const ribbon = [
    ...queued.map((b, i) => ({ b, status: i === 0 ? "queued" : "next", confLabel: i === 0 ? "QUEUED" : "NEXT" })),
    ...past.map((b: any, i: number) => ({ b, status: i === 0 ? "current" : "past", confLabel: b.conf + (b.conf === 1 ? " confirmation" : " confirmations") })),
  ];

  const trackedHeight = tracking?.kind === "tx" ? (tracking.blockHeight ?? null) : null;
  const trackedConf = trackedHeight != null ? confOf(trackedHeight, data) : null;

  // Seconds since the newest block, for the live next-block countdown.
  const tipAge = data.blocks?.[0]?.age || 0;
  // The 10th confirmation is the unlock point — find that block's slot so we can
  // drop a single vertical UNLOCK divider in the gap immediately before it.
  const dividerIndex = ribbon.findIndex((r) => r.status !== "queued" && r.status !== "next" && r.b.conf === 10);

  // Glide the row when the tip advances (FLIP). The tracked ▲ arrow is a child
  // of ClassicBlock, so it travels with its block automatically.
  const glideRef = useRibbonGlide(data.height);

  return (
    <div style={{ position: "relative", padding: "18px 20px 30px" }}>
      <div ref={glideRef} style={{ display: "flex", alignItems: "flex-start", gap: 8, overflowX: "auto", paddingBottom: 12 }}>
        {ribbon.map((r, i) => {
          const confirmed = r.status !== "queued" && r.status !== "next";
          // Live next-block countdown on the QUEUED/NEXT cards (ticks each second
          // via ClassicEta's own useTick — the ribbon itself does not re-render).
          const etaNode =
            r.status === "next" ? <ClassicEta tipAge={tipAge} lastUpdate={data.lastUpdate} /> :
            r.status === "queued" ? <ClassicEta tipAge={tipAge} lastUpdate={data.lastUpdate} offsetSec={CLASSIC_BLOCK_TARGET} /> :
            undefined;
          return (
            // Confirmed blocks: stable identity by height (so React reuses the DOM
            // node across the shift — a FLIP prerequisite). Queued/next placeholders
            // keep an index key and do not glide. The UNLOCK divider is a static
            // flex sibling with no data-glide-key, so it's invisible to the glide.
            <React.Fragment key={confirmed ? "b" + r.b.height : "q" + i}>
              {i === dividerIndex ? (
                <div aria-hidden style={{ alignSelf: "stretch", flex: "0 0 auto", display: "flex",
                     flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: "0 4px" }}>
                  <div style={{ width: 2, flex: 1, borderRadius: 1,
                       background: "linear-gradient(180deg, rgba(255,212,0,0.12), rgba(255,212,0,0.85), rgba(255,212,0,0.12))",
                       boxShadow: "0 0 8px rgba(255,212,0,0.5)" }} />
                  <div className="mono" style={{ fontSize: 8, letterSpacing: "0.14em", color: "var(--y-50)",
                       writingMode: "vertical-rl", transform: "rotate(180deg)" }}>UNLOCK</div>
                </div>
              ) : null}
              <ClassicBlock
                glideKey={confirmed ? r.b.height : undefined}
                block={r.b}
                status={r.status}
                confLabel={r.confLabel}
                etaNode={etaNode}
                trackedHere={trackedHeight && r.b.height === trackedHeight ? (trackedConf + "/10") : null}
                onClick={() => confirmed && onSelectBlock?.(r.b.height)}
              />
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

/* ── confirmation panel — with "overdue" state ─────────────── */

export function ClassicConfirmationPanel({ tx, confChangedAt }: any) {
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const conf = tx.confirmations ?? 0;
  const elapsed = Math.floor((now - confChangedAt) / 1000);
  const overdue = elapsed > CLASSIC_BLOCK_TARGET;
  const secsToNext = Math.max(0, CLASSIC_BLOCK_TARGET - elapsed);
  const sinceTxt = overdue
    ? "+" + Math.floor((elapsed - CLASSIC_BLOCK_TARGET) / 60) + ":" + String((elapsed - CLASSIC_BLOCK_TARGET) % 60).padStart(2, "0") + " overdue"
    : "~" + Math.floor(secsToNext / 60) + ":" + String(secsToNext % 60).padStart(2, "0");
  const unlockSecs = Math.max(0, (10 - conf) * CLASSIC_BLOCK_TARGET - (overdue ? 0 : elapsed));
  const unlockTxt = "~" + Math.floor(unlockSecs / 60) + ":" + String(unlockSecs % 60).padStart(2, "0");

  return (
    <div style={{ border: "1px solid var(--rule)", borderRadius: 8, padding: "16px 18px", background: "rgba(0,0,0,0.35)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div className="mono" style={{ fontSize: 11, color: "var(--ink-80)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Confirmation status</div>
        <span className="mono" style={{ fontSize: 10.5, color: "var(--g-50)" }}>
          <span className="led pulse" style={{ background: "var(--g-50)", boxShadow: "0 0 6px var(--g-50)" }} /> LIVE
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <ClassicKpi
          big={conf}
          k="of 10 confirmations"
          tone="acc"
        />
        <ClassicKpi
          big={Math.max(0, 10 - conf)}
          k="blocks remaining"
        />
        <ClassicKpi
          big={sinceTxt}
          k="until next confirmation"
          tone={overdue ? "warn" : ""}
          fontSize={overdue ? 22 : 26}
        />
        <ClassicKpi
          big={unlockTxt}
          k="until full unlock (10/10)"
          fontSize={26}
        />
      </div>

      {/* timeline of 10 dots */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 22 }}>
        {Array.from({ length: 11 }).map((_, i) => {
          const reached = i <= conf;
          return (
            <React.Fragment key={i}>
              {i > 0 ? (
                <div style={{ flex: 1, height: 2, background: reached ? "var(--c-50)" : "rgba(255,255,255,0.06)" }} />
              ) : null}
              <div style={{
                width: 12, height: 12, borderRadius: 6,
                background: reached ? "var(--c-50)" : "transparent",
                border: "1px solid " + (reached ? "var(--c-50)" : "var(--ink-20)"),
                boxShadow: reached ? "0 0 4px rgba(94,211,244,0.55)" : "none",
              }} />
            </React.Fragment>
          );
        })}
      </div>
      <div className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--ink-40)", marginTop: 8, flexWrap: "wrap", gap: 12 }}>
        <span>{conf} of 10 — {Math.max(0, 10 - conf)} more until unlock</span>
        <span>{conf >= 10 ? "Unlocked ✓" : "Confirming · " + conf + " of 10"}</span>
        <span>updated just now</span>
      </div>
    </div>
  );
}

export function ClassicKpi({ big, k, tone, fontSize = 28 }: any) {
  return (
    <div>
      <div className={"mono " + (tone === "acc" ? "acc" : tone === "warn" ? "" : "")}
        style={{
          fontSize, fontWeight: 500, lineHeight: 1,
          color: tone === "acc" ? "var(--tk-accent)"
            : tone === "warn" ? "var(--y-50)"
            : "var(--ink-100)",
          textShadow: tone === "acc" ? "var(--glow-1)" : tone === "warn" ? "0 0 6px rgba(255,212,0,0.45)" : "none",
        }}>{big}</div>
      <div className="kicker" style={{ marginTop: 6 }}>{k}</div>
    </div>
  );
}

/* ── transaction detail (clean) ───────────────────────────── */

export function ClassicTxDetail({ tx, onBack }: any) {
  const confChangedAtRef = React.useRef(Date.now());
  const lastConfRef = React.useRef(tx.confirmations ?? 0);
  React.useEffect(() => {
    if (tx.confirmations !== lastConfRef.current) {
      lastConfRef.current = tx.confirmations;
      confChangedAtRef.current = Date.now();
    }
  }, [tx.confirmations]);

  const isConfirmed = (tx.confirmations ?? 0) >= 10;
  return (
    <div style={{ padding: "24px 28px 60px", borderTop: "1px solid var(--rule)" }}>

      <button type="button" onClick={onBack}
        style={{ appearance: "none", cursor: "pointer", background: "transparent",
          border: "1px solid var(--ink-20)", color: "var(--ink-60)",
          padding: "5px 12px", borderRadius: 4,
          fontFamily: "var(--f-mono)", fontSize: 11,
          marginBottom: 18,
        }}>← Back</button>

      {/* header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, paddingBottom: 14, borderBottom: "1px solid var(--rule)" }}>
        <div style={{ minWidth: 0 }}>
          <h2 className="serif" style={{ margin: 0, fontSize: 26, fontWeight: 400, color: "var(--ink-100)" }}>Transaction</h2>
          <div className="mono" style={{ fontSize: 12, color: "var(--c-50)", marginTop: 6, wordBreak: "break-all" }}>{tx.id}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span className={"pill " + (isConfirmed ? "live" : "warn")}>
            <span className="led pulse" />
            {isConfirmed ? "Confirmed" : "Confirming"}
          </span>
        </div>
      </div>

      {/* stat grid */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, padding: "20px 0", borderBottom: "1px solid var(--rule)", marginBottom: 22 }}>
        <DetailItem k="Included in block" v={tx.blockHeight ? "#" + tx.blockHeight.toLocaleString() : "Pending"} tone="acc" />
        <DetailItem k="Fee" v={tx.fee.toFixed(7) + " XMR"} tone="acc" />
        <DetailItem k="ETA" v={tx.eta} />
        <DetailItem k="Fee rate" v={tx.perB.toFixed(2) + " piconero / B"} />
        <DetailItem k="Size" v={(tx.size / 1024).toFixed(1) + " KB"} />
        <DetailItem k="Ring size" v={tx.ringSize + " decoys"} />
      </section>

      {/* badges */}
      <section style={{ display: "flex", gap: 8, marginBottom: 22, flexWrap: "wrap" }}>
        {["CLSAG", "BP+", "View Tags", "No Timelock", "Dandelion++"].map((l) => (
          <span key={l} style={{
            padding: "5px 12px",
            border: "1px solid var(--g-50)", color: "var(--g-50)",
            background: "rgba(74,222,128,0.06)",
            borderRadius: 4,
            fontFamily: "var(--f-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase",
          }}>{l}</span>
        ))}
      </section>

      <ClassicConfirmationPanel tx={tx} confChangedAt={confChangedAtRef.current} />

      {/* privacy strip */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", marginTop: 14, border: "1px solid var(--g-50)", background: "rgba(74,222,128,0.06)", borderRadius: 6 }}>
        <span style={{ color: "var(--g-50)", fontSize: 18 }}>✓</span>
        <div className="mono" style={{ fontSize: 12, color: "var(--ink-100)" }}>
          Privacy <b className="up" style={{ fontSize: 14 }}>{tx.privacy}/100</b> <span className="up">STRONG</span>
          <span className="dim" style={{ marginLeft: 18 }}>CLSAG · BP+ · 16 ring · View Tags · No Timelock</span>
        </div>
      </div>

      {/* inputs */}
      <div style={{ marginTop: 22 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <h3 className="mono" style={{ margin: 0, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-80)" }}>Inputs ({tx.inputs})</h3>
          <span className="mono dim" style={{ fontSize: 10.5 }}>Ring 16 · Pedersen commitments</span>
        </div>
        {Array.from({ length: tx.inputs }).map((_, i) => (
          <div key={i} style={{ padding: 16, border: "1px solid var(--rule)", borderRadius: 6, marginBottom: 8 }}>
            <div className="mono dim" style={{ fontSize: 10.5, letterSpacing: "0.06em" }}>Input {i} — Key Image</div>
            <div className="mono" style={{ fontSize: 11.5, color: "var(--c-50)", marginTop: 6, wordBreak: "break-all" }}>{randHex(64)}</div>
            <div className="mono dim" style={{ fontSize: 10.5, marginTop: 8 }}>
              Ring: <b style={{ color: "var(--ink-100)" }}>16 members</b> · Amount: <b style={{ color: "var(--y-50)" }}>HIDDEN</b> (Pedersen commitment)
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DetailItem({ k, v, tone }: any) {
  return (
    <div>
      <div className="kicker">{k}</div>
      <div className={"mono " + (tone === "acc" ? "acc" : "")} style={{ fontSize: 16, marginTop: 6 }}>{v}</div>
    </div>
  );
}

/* ── CLASSIC VIEW · root ──────────────────────────────────── */

export function ClassicView({ data, focusBlock, onClearFocus }: ViewProps) {
  // Shared tracking — the SAME hook + detail every other view uses. The pin is
  // resolved once (onSearch) and confirmations derive live via confOf, so the
  // ribbon arrow and the detail panel always read one number.
  const { tracking, onSearch, clearTracking } = useMempoolTracking(data);
  const clear = () => {
    clearTracking();
    onClearFocus?.();
  };

  // Deep-link: open the block detail for ?block=<height>. Fires only when
  // focusBlock CHANGES (a ref guards repeats / StrictMode); resets on clear so
  // the same block can be re-opened later.
  const lastFocus = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (focusBlock == null) { lastFocus.current = null; return; }
    if (focusBlock === lastFocus.current) return;
    lastFocus.current = focusBlock;
    onSearch({ kind: "block", height: focusBlock });
    // eslint-disable-next-line
  }, [focusBlock]);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ padding: "20px 24px 4px", display: "flex", alignItems: "center", gap: 18, borderBottom: "1px solid var(--rule)" }}>
        <ClassicSearch onSearch={onSearch} />
        <span style={{ flex: 1 }} />
        <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-60)" }}>
          <span className="led pulse" /> Block {data.height.toLocaleString()} · Live
        </span>
      </div>
      {/* Ribbon stays mounted while tracking, so the tracked ▲ rides its block
          alongside the detail panel below (both read confOf). */}
      <ClassicRibbon data={data} tracking={tracking} onSelectBlock={(h: number) => onSearch({ kind: "block", height: h })} />
      <div className="main" style={{ overflow: "auto", padding: 0 }}>
        {tracking ? (
          <MempoolTrackingDetail
            tracking={tracking}
            data={data}
            onBack={clear}
            onPickTx={(id, h) => onSearch({ kind: "tx", id, blockHeight: h })}
          />
        ) : (
          <ClassicLanding data={data} onPickTx={(id: string) => onSearch({ kind: "tx", id, blockHeight: null })} />
        )}
      </div>
    </div>
  );
}

export function ClassicBlockDetail({ block, onBack }: any) {
  return (
    <div style={{ padding: "24px 28px 60px" }}>
      <button type="button" onClick={onBack}
        style={{ appearance: "none", cursor: "pointer", background: "transparent",
          border: "1px solid var(--ink-20)", color: "var(--ink-60)",
          padding: "5px 12px", borderRadius: 4,
          fontFamily: "var(--f-mono)", fontSize: 11,
          marginBottom: 18,
        }}>← Back</button>
      <h2 className="serif" style={{ margin: 0, fontSize: 26, fontWeight: 400, color: "var(--ink-100)" }}>Block #{block.height.toLocaleString()}</h2>
      <div className="mono" style={{ fontSize: 12, color: "var(--c-50)", marginTop: 6, wordBreak: "break-all" }}>{block.hash}</div>
      <section style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 24, padding: "20px 0", borderTop: "1px solid var(--rule)", marginTop: 18 }}>
        <DetailItem k="Txs" v={block.txs} tone="acc" />
        <DetailItem k="Size" v={block.sizeKB.toFixed(1) + " KB"} />
        <DetailItem k="Reward" v={block.reward.toFixed(3) + " XMR"} />
        <DetailItem k="Pool" v={block.pool} />
        <DetailItem k="Confirmations" v={block.conf} tone="acc" />
      </section>
    </div>
  );
}

/* ── v4-mimic fee tiers ─────────────────────────────────────
   Mirrors mempool-explorer.html: Priority / Fast / Normal /
   Economy, each with rate (pcn/B), per-tx cost, ETA, color.
   ──────────────────────────────────────────────────────────── */
const CLASSIC_TIERS = [
  { id: "priority", label: "PRIORITY", color: "#FF4455", eta: "Next block",  desc: "Confirms in the next block" },
  { id: "fast",     label: "FAST",     color: "#FF7A1A", eta: "~4 min",      desc: "Within 1–2 blocks"          },
  { id: "normal",   label: "NORMAL",   color: "#4ADE80", eta: "~10 min",     desc: "Within ~5 blocks"           },
  { id: "economy",  label: "ECONOMY",  color: "#3D8EFF", eta: "~60 min+",    desc: "When mempool clears"        },
];

// Quartile-based thresholds computed from the live mempool, so bucketing
// always produces a sensible distribution regardless of simulated/real
// scale (sim data is ~2k–60k pcn/B; real Monero is similar order).
function classicComputeThresholds(mempool: Tx[]) {
  if (!mempool.length) return [800000, 600000, 400000];
  const sorted = mempool.map((t) => t.perB).sort((a, b) => b - a);
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  return [q(0.15), q(0.4), q(0.7)]; // top 15 / 25 / 30 / 30 split
}

function classicTierOf(t: Tx, thr: number[]) {
  if (t.perB >= thr[0]) return CLASSIC_TIERS[0];
  if (t.perB >= thr[1]) return CLASSIC_TIERS[1];
  if (t.perB >= thr[2]) return CLASSIC_TIERS[2];
  return CLASSIC_TIERS[3];
}

function classicBucketByTier(mempool: Tx[]) {
  const thr = classicComputeThresholds(mempool);
  const out: Record<string, any> = { priority: [], fast: [], normal: [], economy: [], thr };
  mempool.forEach((t) => out[classicTierOf(t, thr).id].push(t));
  return out;
}

/* ── 4-card fee hero ──────────────────────────────────────── */

export function ClassicFeeHero({ buckets, xmrUsd }: any) {
  return (
    <section style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
      {CLASSIC_TIERS.map((tier, ti) => {
        const tx = buckets[tier.id];
        const thrFallback = buckets.thr ? buckets.thr[Math.min(ti, 2)] : 1000;
        const med = tx.length ? tx.map((t: any) => t.perB).sort((a: number, b: number) => a - b)[Math.floor(tx.length / 2)] : thrFallback;
        const sampleTx = tx[0] || { fee: (thrFallback * 1800) / 1e12, perB: thrFallback };
        const costXmr = sampleTx.fee;
        const costUsd = costXmr * xmrUsd;
        return (
          <div key={tier.id} style={{
            background: "rgba(0,0,0,0.45)",
            border: "1px solid var(--rule)",
            borderTop: "3px solid " + tier.color,
            borderRadius: 8,
            padding: "16px 18px",
            transition: "transform 0.18s, border-color 0.18s",
          }}
            onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-2px)"}
            onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}>
            <div className="mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", color: tier.color, marginBottom: 8 }}>{tier.label}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
              <span className="mono" style={{ fontSize: 22, fontWeight: 500, color: "var(--ink-100)" }}>{Math.round(med).toLocaleString()}</span>
              <span className="mono dim" style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" }}>pcn/B</span>
            </div>
            <div className="mono" style={{ fontSize: 11, color: "var(--ink-80)", marginBottom: 3 }}>
              ≈ {costXmr.toFixed(6)} XMR <span className="dim">· ${costUsd.toFixed(4)}</span>
            </div>
            <div className="mono" style={{ fontSize: 10, color: "var(--ink-40)", letterSpacing: "0.12em", textTransform: "uppercase" }}>{tier.eta} · {tx.length} tx</div>
          </div>
        );
      })}
    </section>
  );
}

/* ── pcn/B caption ───────────────────────────────────────── */

function ClassicCaption() {
  return (
    <div className="mono" style={{
      fontSize: 11.5, color: "var(--ink-60)", lineHeight: 1.55,
      padding: "10px 14px", borderLeft: "2px solid rgba(255,122,26,0.5)",
      background: "rgba(255,122,26,0.04)", borderRadius: "0 4px 4px 0",
    }}>
      <b style={{ color: "var(--ink-100)" }}>pcn/B</b> = piconero per byte. One piconero is 10⁻¹² XMR — the smallest unit. Monero fees scale with transaction size in bytes; a typical 2-input transaction is ≈ 1.8 KB.
    </div>
  );
}

/* ── projected next-block strip ──────────────────────────── */

export function ClassicProjBlock({ buckets, mempool, height }: any) {
  const total = mempool.length || 1;
  const totalBytes = mempool.reduce((a: number, t: any) => a + t.size, 0);
  const target = 250; // approx block-tx capacity
  const fill = Math.min(1, total / target);
  return (
    <div style={{
      background: "rgba(0,0,0,0.45)", border: "1px solid var(--rule)",
      borderRadius: 8, padding: "14px 18px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span className="mono" style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-60)" }}>Projected next block · #{(height + 1).toLocaleString()}</span>
        <span className="mono" style={{ fontSize: 11, color: "var(--tk-accent)", letterSpacing: "0.06em" }}>ETA ~2:00</span>
      </div>
      {/* segmented bar */}
      <div style={{ height: 22, background: "rgba(0,0,0,0.6)", borderRadius: 5, overflow: "hidden", display: "flex", border: "1px solid var(--ink-10)" }}>
        {CLASSIC_TIERS.map((tier, i) => {
          const tx = buckets[tier.id];
          const pct = tx.length / total;
          return (
            <div key={tier.id} title={tier.label + " · " + tx.length + " tx"} style={{
              width: (pct * 100) + "%", height: "100%",
              background: tier.color,
              opacity: 0.78,
              borderRight: i < 3 ? "1px solid rgba(0,0,0,0.4)" : "none",
              transition: "width 0.6s ease",
            }} />
          );
        })}
      </div>
      <div className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--ink-60)", marginTop: 8 }}>
        <span>{Math.round(fill * 100)}% of block capacity</span>
        <span>{total} tx · {fmtBytes(totalBytes)}</span>
      </div>
      <div className="mono" style={{ display: "flex", gap: 14, fontSize: 10, color: "var(--ink-40)", marginTop: 6, flexWrap: "wrap" }}>
        {CLASSIC_TIERS.map((tier) => (
          <span key={tier.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, background: tier.color, borderRadius: 2 }} />
            {tier.label} {buckets[tier.id].length}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── fee depth (DOM bars) ────────────────────────────────── */

export function ClassicFeeDepth({ buckets }: any) {
  const total = CLASSIC_TIERS.reduce((a, tier) => a + buckets[tier.id].reduce((s: number, t: any) => s + t.size, 0), 0) || 1;
  return (
    <div style={{
      background: "rgba(0,0,0,0.45)", border: "1px solid var(--rule)",
      borderRadius: 8, padding: "14px 18px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
        <span className="mono" style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-60)" }}>Fee depth</span>
        <span className="mono dim" style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" }}>by tier · % of mempool weight</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {CLASSIC_TIERS.map((tier) => {
          const tx = buckets[tier.id];
          const bytes = tx.reduce((s: number, t: any) => s + t.size, 0);
          const pct = bytes / total;
          return (
            <div key={tier.id} style={{ display: "grid", gridTemplateColumns: "84px 1fr 80px 60px", gap: 12, alignItems: "center" }}>
              <span className="mono" style={{ fontSize: 10.5, color: tier.color, letterSpacing: "0.12em", fontWeight: 600 }}>{tier.label}</span>
              <div style={{ position: "relative", height: 18, background: "rgba(255,255,255,0.04)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                  position: "absolute", inset: "0 auto 0 0",
                  width: Math.max(2, pct * 100) + "%", height: "100%",
                  background: "linear-gradient(90deg, " + tier.color + "40, " + tier.color + "ee)",
                  boxShadow: "0 0 8px " + tier.color + "55",
                  transition: "width 0.6s ease",
                }} />
              </div>
              <span className="mono dim" style={{ fontSize: 10.5, textAlign: "right" }}>{fmtBytes(bytes)}</span>
              <span className="mono" style={{ fontSize: 11, color: "var(--ink-100)", textAlign: "right" }}>{(pct * 100).toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── live tx feed ────────────────────────────────────────── */

export function ClassicTxFeed({ mempool, onPickTx, thr }: any) {
  const rows = mempool.slice(0, 14);
  return (
    <div style={{
      background: "rgba(0,0,0,0.45)", border: "1px solid var(--rule)",
      borderRadius: 8, padding: "12px 14px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span className="mono" style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-60)" }}>Live · last {rows.length} tx in mempool</span>
        <span className="mono dim" style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          <span className="led pulse" style={{ background: "var(--g-50)", boxShadow: "0 0 4px var(--g-50)" }} /> streaming
        </span>
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1.6fr 0.8fr 1fr 0.7fr 0.9fr 0.7fr",
        gap: 10, fontSize: 9.5, letterSpacing: "0.14em", textTransform: "uppercase",
        color: "var(--ink-40)", padding: "6px 8px", borderBottom: "1px solid var(--rule)",
      }} className="mono">
        <span>TXID</span><span>Size</span><span>Fee · XMR</span><span>Pcn/B</span><span>Tier</span><span>Age</span>
      </div>
      <div>
        {rows.map((t: any) => {
          const tier = classicTierOf(t, thr);
          return (
            <div key={t.id} onClick={() => onPickTx(t.id)}
              style={{
                display: "grid",
                gridTemplateColumns: "1.6fr 0.8fr 1fr 0.7fr 0.9fr 0.7fr",
                gap: 10, fontSize: 11, padding: "8px 8px",
                borderBottom: "1px solid rgba(255,255,255,0.03)",
                cursor: "pointer", transition: "background 0.12s",
                fontFamily: "var(--f-mono)",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.025)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
              <span style={{ color: "var(--c-50)" }}>{ShortHash(t.id)}</span>
              <span style={{ color: "var(--ink-80)" }}>{fmtBytes(t.size)}</span>
              <span style={{ color: "var(--tk-accent)" }}>{t.fee.toFixed(7)}</span>
              <span style={{ color: "var(--ink-80)" }}>{Math.round(t.perB).toLocaleString()}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, color: tier.color, fontSize: 9.5, letterSpacing: "0.14em" }}>
                <span style={{ width: 7, height: 7, borderRadius: 4, background: tier.color, boxShadow: "0 0 4px " + tier.color }} />
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

/* ── stats chip row ──────────────────────────────────────── */

export function ClassicChipRow({ data, mempool }: any) {
  const bytes = mempool.reduce((a: number, t: any) => a + t.size, 0);
  const avgFee = mempool.length ? mempool.reduce((a: number, t: any) => a + t.fee, 0) / mempool.length : 0;
  const medPerB = mempool.length ? [...mempool].map((t) => t.perB).sort((a, b) => a - b)[Math.floor(mempool.length / 2)] : 0;
  const chips = [
    { v: data.height.toLocaleString(),       l: "Tip" },
    { v: mempool.length + " tx",             l: "Mempool" },
    { v: fmtBytes(bytes),                    l: "Weight" },
    { v: Math.round(medPerB).toLocaleString(), l: "Median pcn/B" },
    { v: avgFee.toFixed(7),                  l: "Avg fee · XMR" },
  ];
  return (
    <section style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
      {chips.map((c) => (
        <div key={c.l} style={{
          background: "rgba(0,0,0,0.45)", border: "1px solid var(--rule)",
          borderRadius: 8, padding: "12px 14px", textAlign: "center",
        }}>
          <div className="mono" style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-100)" }}>{c.v}</div>
          <div className="mono" style={{ fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--ink-40)", marginTop: 4 }}>{c.l}</div>
        </div>
      ))}
    </section>
  );
}

export function ClassicLanding({ data, onPickTx }: any) {
  const buckets = React.useMemo(() => classicBucketByTier(data.mempool), [data.mempool]);
  return (
    <div style={{ padding: "20px 24px 48px", display: "flex", flexDirection: "column", gap: 14 }}>
      <ClassicFeeHero buckets={buckets} xmrUsd={data.price || 0} />
      <ClassicCaption />
      <ClassicProjBlock buckets={buckets} mempool={data.mempool} height={data.height} />
      <ClassicFeeDepth buckets={buckets} />
      <ClassicTxFeed mempool={data.mempool} onPickTx={onPickTx} thr={buckets.thr} />
      <ClassicChipRow data={data} mempool={data.mempool} />
    </div>
  );
}

export function ClassicStat({ k, v, tone }: any) {
  return (
    <div style={{ padding: "12px 14px", border: "1px solid var(--rule)", borderRadius: 6, background: "rgba(0,0,0,0.25)" }}>
      <div className="kicker">{k}</div>
      <div className={"mono " + (tone === "acc" ? "acc" : "")} style={{ fontSize: 20, marginTop: 4, fontWeight: 500 }}>{v}</div>
    </div>
  );
}


