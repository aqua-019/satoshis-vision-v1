// AUTO-PORTED from mempool/mempool-shared.jsx
// Run `npm run port` to refresh. Manual fixups land in MIGRATION.md.
import * as React from "react";
import type { MoneroLive, Block } from "@/data/types";
import { TxDetailPanel, BlockDetailPanel } from "@/mempool/reactor";
import { pinTxBlockHeight, liveConf } from "@/mempool/conf";
import { useTick } from "@/design/ArtBackground";

// mempool-shared.tsx — search + tracking state shared by all mempool views.
//
// Every mempool surface (Reactor, Classic, Bridge, Sediment, Constellation,
// Terminal) gets the same search behaviour: paste a 64-char txid or a block
// height. The shared detail routing (MempoolTrackingDetail, below) renders the
// tracking result through the Reactor-owned TxDetailPanel / BlockDetailPanel.
// It is fully self-contained and deterministic — no /api/tx (404s on the
// backend) and ZERO dependency on the Phase 4c tx-detail inspectors.

type SearchQuery = { kind: "tx"; id: string } | { kind: "block"; height: number };
type Tracking =
  | { kind: "tx"; id: string; blockHeight: number | null }
  | { kind: "block"; height: number; block?: Block }
  | null;

// MempoolHeartbeat — a per-mempool liveness chip. Real Monero blocks are ~2 min
// apart, so the block ribbon is legitimately quiet between them; this gives the
// user a per-second signal the feed is alive. `useTick(1000)` re-renders it each
// second to advance "updated Ns ago"; the LED is keyed on `lastUpdate` so it
// remounts (replaying the one-shot `mp-beat` flash) exactly when a new poll lands,
// not every second. Shows SIM when no external source is reaching us.
export function MempoolHeartbeat({ data }: { data: MoneroLive }) {
  useTick(1000);
  const live = data.live;
  const ageSec = Math.max(0, Math.round((Date.now() - data.lastUpdate) / 1000));
  return (
    <span
      className={"pill" + (live ? " live" : "")}
      title={live ? "Feed polling ~every 2.5s · source: " + data.source : "Showing seed data — no external source reaching the browser"}
    >
      <span
        key={data.lastUpdate}
        className="led"
        style={live
          ? { animation: "mp-beat 0.5s ease-out" }
          : { background: "var(--ink-40)", boxShadow: "none" }}
      />
      {live ? <>LIVE · updated {ageSec}s ago</> : "SIM"}
    </span>
  );
}

export function useMempoolTracking(data: MoneroLive) {
  const [tracking, setTracking] = React.useState<Tracking>(null);

  const onSearch = React.useCallback((q: SearchQuery) => {
    if (q.kind === "tx") {
      // Pin the block height ONCE; confirmations derive live at render.
      setTracking({ kind: "tx", id: q.id, blockHeight: pinTxBlockHeight(q.id, data) });
    } else {
      const block = data.blocks.find((b) => b.height === q.height);
      setTracking({ kind: "block", height: q.height, block });
    }
  }, [data.blocks]);

  const clearTracking = React.useCallback(() => setTracking(null), []);

  // Re-resolve block on every data tick so confirmation count stays live
  React.useEffect(() => {
    setTracking((t) => {
      if (t?.kind === "block") {
        const b = data.blocks.find((x) => x.height === t.height);
        if (b && b !== t.block) return { ...t, block: b };
      }
      return t;
    });
  }, [data.blocks]);

  return { tracking, onSearch, clearTracking };
}

export function MempoolSearchBar({ onSearch, placeholder, compact }: {
  onSearch: (q: SearchQuery) => void;
  placeholder?: string;
  compact?: boolean;
}) {
  const [q, setQ] = React.useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = q.trim();
    if (!t) return;
    if (/^[0-9a-f]{64}$/i.test(t)) onSearch({ kind: "tx", id: t });
    else if (/^\d{1,8}$/.test(t)) onSearch({ kind: "block", height: parseInt(t, 10) });
  };
  return (
    <form onSubmit={submit} style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, maxWidth: compact ? 380 : 520 }}>
      <input
        type="text" value={q} onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder || "Search by 64-char txid or block height…"}
        spellCheck={false}
        style={{
          flex: 1, appearance: "none",
          background: "rgba(0,0,0,0.6)", color: "var(--ink-100)",
          border: "1px solid var(--ink-20)", borderRadius: 3,
          padding: compact ? "7px 10px" : "9px 12px",
          fontFamily: "var(--f-mono)", fontSize: compact ? 11 : 12,
          letterSpacing: "0.02em", outline: "none",
        }}
        onFocus={(e) => (e.target.style.borderColor = "var(--tk-accent)")}
        onBlur={(e) => (e.target.style.borderColor = "var(--ink-20)")}
      />
      <button type="submit" className="proto-btn"
        style={{ padding: compact ? "6px 12px" : "8px 14px", fontSize: compact ? 9.5 : 10 }}>
        SEARCH
      </button>
    </form>
  );
}

// ── Shared tracking detail ─────────────────────────────────────
//
// `useMempoolTracking` returns an id-only tracking result; the Reactor-owned
// TxDetailPanel expects a fully-resolved tx. `buildTrackedTx` deterministically
// simulates that tx from the txid (mirrors Reactor's internal lookup) so every
// non-Reactor surface (Bridge / Sediment / Constellation) can reuse the same
// detail panels. Deterministic + simulated: no network, no tx-detail/4c import.

interface TrackedTx {
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

// `pinnedHeight` is the tx's block height pinned ONCE at track time (mempool/conf.ts):
//   • null   → tx is in the mempool (unconfirmed)
//   • number → the ABSOLUTE block height the tx was pinned to
// Confirmations are derived LIVE from that pinned height + the current tip, never frozen.
function buildTrackedTx(txid: string, data: MoneroLive, pinnedHeight: number | null): TrackedTx {
  const intHash = Array.from(txid).reduce((a, c) => (a + c.charCodeAt(0)) >>> 0, 0);
  if (pinnedHeight === null) {
    const t = data.mempool.length ? data.mempool[intHash % data.mempool.length] : null;
    return {
      id: txid,
      size: t ? t.size : 1500 + (intHash % 3000),
      fee: t ? t.fee : 0.0011 + (intHash % 9000) / 1e10,
      perB: t ? t.perB : 600000 + (intHash % 200000),
      ringSize: 16,
      inputs: t ? t.inputs : 1 + (intHash % 2),
      outputs: t ? t.outputs : 2,
      blockHeight: null,
      confirmations: 0,
      status: "in mempool",
      eta: "~" + (1 + (intHash % 3)) + " min until block",
      timelock: 0,
      privacy: 90,
    };
  }
  const confirmations = liveConf(pinnedHeight, data.height);
  return {
    id: txid,
    size: 1500 + (intHash % 3000),
    fee: 0.0011 + (intHash % 9000) / 1e10,
    perB: 600000 + (intHash % 200000),
    ringSize: 16,
    inputs: 1 + (intHash % 2),
    outputs: 2,
    blockHeight: pinnedHeight,
    confirmations,
    status: confirmations >= 10 ? "fully unlocked" : "confirming",
    eta: confirmations >= 10 ? "Confirmed" : "~" + ((10 - confirmations) * 2) + " min until unlock",
    timelock: 0,
    privacy: 90,
  };
}

/**
 * MempoolTrackingDetail — drop-in replacement for the legacy `window.TrackingDetail`.
 * Renders the active tracking result through the Reactor-owned detail panels.
 * `onPickTx` is accepted for call-site parity with the legacy component; the
 * current panels don't surface a tx picker, so it is intentionally unused.
 */
export function MempoolTrackingDetail({ tracking, data, onBack }: {
  tracking: Tracking;
  data: MoneroLive;
  onBack: () => void;
  onPickTx?: (id: string) => void;
}) {
  if (!tracking) return null;
  if (tracking.kind === "tx") {
    return <TxDetailPanel tx={buildTrackedTx(tracking.id, data, tracking.blockHeight)} onBack={onBack} />;
  }
  const block =
    tracking.block ?? data.blocks.find((b) => b.height === tracking.height) ?? data.blocks[0];
  if (!block) return null;
  return <BlockDetailPanel block={block} onBack={onBack} />;
}
