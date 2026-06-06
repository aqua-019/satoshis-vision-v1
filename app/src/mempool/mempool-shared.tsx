// AUTO-PORTED from mempool/mempool-shared.jsx
// Run `npm run port` to refresh. Manual fixups land in MIGRATION.md.
import * as React from "react";
import type { MoneroLive, Block } from "@/data/types";
import { TxDetailPanel, BlockDetailPanel } from "@/mempool/reactor";

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
  | { kind: "tx"; id: string }
  | { kind: "block"; height: number; block?: Block }
  | null;

export function useMempoolTracking(data: MoneroLive) {
  const [tracking, setTracking] = React.useState<Tracking>(null);

  const onSearch = React.useCallback((q: SearchQuery) => {
    if (q.kind === "tx") {
      setTracking({ kind: "tx", id: q.id });
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

function buildTrackedTx(txid: string, data: MoneroLive): TrackedTx {
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
      blockHeight: null,
      confirmations: 0,
      status: "in mempool",
      eta: "~" + (1 + (intHash % 3)) + " min until block",
      timelock: 0,
      privacy: 90,
    };
  }
  const idx = intHash % Math.max(1, Math.min(8, data.blocks.length));
  const block = data.blocks[idx];
  return {
    id: txid,
    size: 1500 + (intHash % 3000),
    fee: 0.0011 + (intHash % 9000) / 1e10,
    perB: 600000 + (intHash % 200000),
    ringSize: 16,
    inputs: 1 + (intHash % 2),
    outputs: 2,
    blockHeight: block ? block.height : null,
    confirmations: block ? block.conf : 0,
    status: block && block.conf >= 10 ? "fully unlocked" : "confirming",
    eta: block && block.conf >= 10 ? "Confirmed" : "~" + ((10 - (block ? block.conf : 0)) * 2) + " min until unlock",
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
    return <TxDetailPanel tx={buildTrackedTx(tracking.id, data)} onBack={onBack} />;
  }
  const block =
    tracking.block ?? data.blocks.find((b) => b.height === tracking.height) ?? data.blocks[0];
  if (!block) return null;
  return <BlockDetailPanel block={block} onBack={onBack} />;
}
