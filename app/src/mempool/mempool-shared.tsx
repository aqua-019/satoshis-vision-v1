// AUTO-PORTED from mempool/mempool-shared.jsx
// Run `npm run port` to refresh. Manual fixups land in MIGRATION.md.
import * as React from "react";
import type { MoneroLive, Block } from "@/data/types";
import { FullTxDetail, FullBlockDetail, txSynthFromId, blockSynth } from "@/mempool/tx-detail";
import { pinTxBlockHeight, confOf } from "@/mempool/conf";
import { useTick } from "@/design/ArtBackground";

// mempool-shared.tsx — search + tracking state shared by all mempool views.
//
// Every mempool surface (Reactor, Classic, Bridge, Sediment, Constellation,
// Terminal) gets the same search behaviour: paste a 64-char txid or a block
// height. The shared detail routing (MempoolTrackingDetail, below) renders the
// tracking result through the Reactor-owned TxDetailPanel / BlockDetailPanel.
// It is fully self-contained and deterministic — no /api/tx (404s on the
// backend) and ZERO dependency on the Phase 4c tx-detail inspectors.

type SearchQuery =
  | { kind: "tx"; id: string; blockHeight?: number | null }
  | { kind: "block"; height: number };
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
      // Resolve the pin ONCE, here, and store only the height — it never hops:
      //   • number    → clicked from a confirmed block (pin to it; confirmed)
      //   • null       → clicked from a mempool list (unconfirmed)
      //   • undefined → raw txid typed in the search box → resolve from snapshot
      // Confirmations then derive live (confOf) on every render.
      const blockHeight = q.blockHeight === undefined ? pinTxBlockHeight(q.id, data) : q.blockHeight;
      setTracking({ kind: "tx", id: q.id, blockHeight });
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
// ONE tracking detail for every mempool surface (Classic, Reactor, Bridge,
// Sediment, Constellation, Terminal) and the /mempool/tx deep-link. It renders
// the RICH tx-detail inspectors (FullTxDetail / FullBlockDetail) — the same ones
// the deep-link uses — and derives confirmations from confOf (the single
// newest-block tip), so the ribbon label, the tracked arrow, and this panel can
// never disagree. The tx's block height is pinned ONCE (useMempoolTracking
// onSearch) and threaded through txSynthFromId; it never re-derives from the hash.
export function MempoolTrackingDetail({ tracking, data, onBack, onPickTx }: {
  tracking: Tracking;
  data: MoneroLive;
  onBack: () => void;
  onPickTx?: (id: string, blockHeight?: number | null) => void;
}) {
  if (!tracking) return null;
  if (tracking.kind === "tx") {
    const tx = txSynthFromId(tracking.id, data, tracking.blockHeight);
    if (import.meta.env.DEV) {
      // Invariant guard (P1d): the detail reports the block it was opened from,
      // and a confirmation count equal to confOf(pinnedHeight) — no off-by-one.
      console.assert(
        tx.block_height === tracking.blockHeight,
        `[mempool] tracked tx block_height ${tx.block_height} !== pinned ${tracking.blockHeight}`,
      );
      console.assert(
        tx.confirmations === confOf(tracking.blockHeight, data),
        `[mempool] tracked tx conf ${tx.confirmations} !== confOf ${confOf(tracking.blockHeight, data)}`,
      );
    }
    return <FullTxDetail tx={tx} onBack={onBack} />;
  }
  const block =
    tracking.block ?? data.blocks.find((b) => b.height === tracking.height) ?? data.blocks[0];
  if (!block) return null;
  // Clicking a tx inside the block pins it to THIS block height (no hash hop).
  return (
    <FullBlockDetail
      block={blockSynth(block, data)}
      onBack={onBack}
      onPickTx={(id, h) => onPickTx?.(id, h)}
    />
  );
}
