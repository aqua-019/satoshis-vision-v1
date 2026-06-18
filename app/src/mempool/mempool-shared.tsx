// AUTO-PORTED from mempool/mempool-shared.jsx
// Run `npm run port` to refresh. Manual fixups land in MIGRATION.md.
import * as React from "react";
import type { MoneroLive, Block } from "@/data/types";
import { LiveTxDetail, LiveBlockDetail } from "@/mempool/tx-detail";
import { useTrackedTxHeight } from "@/mempool/live-detail";
import { useTick } from "@/design/ArtBackground";

// mempool-shared.tsx — search + tracking state shared by all mempool views.
//
// Every mempool surface (Reactor, Classic, Bridge, Sediment, Constellation,
// Terminal) gets the same search behaviour: paste a 64-char txid or a block
// height. The shared detail routing (MempoolTrackingDetail, below) renders the
// tracking result through the REAL-data inspectors (LiveTxDetail / LiveBlockDetail
// in tx-detail.tsx), which fetch /api/xmr/tx and /api/xmr/block from the node and
// own their loading / error / placeholder states. Confirmations derive from the
// single confOf accessor, fed the real block height the node reports.

type SearchQuery =
  | { kind: "tx"; id: string; blockHeight?: number | null }
  | { kind: "block"; height: number };
type Tracking =
  | { kind: "tx"; id: string; blockHeight: number | null; explicit?: boolean }
  | { kind: "block"; height: number; block?: Block }
  | null;

// MempoolHeartbeat — a per-mempool liveness chip. Real Monero blocks are ~2 min
// apart, so the block ribbon is legitimately quiet between them; this gives the
// user a per-second signal the feed is alive. `useTick(1000)` re-renders it each
// second to advance "updated Ns ago"; the LED is keyed on `lastUpdate` so it
// remounts (replaying the one-shot `mp-beat` flash) exactly when a new poll lands,
// not every second. Three states: CONNECTING… (no node snapshot yet), STALE
// (feed was live then polls started failing — values shown are last-good), and
// LIVE (healthy feed).
export function MempoolHeartbeat({ data }: { data: MoneroLive }) {
  useTick(1000);
  const ageSec = Math.max(0, Math.round((Date.now() - data.lastUpdate) / 1000));
  if (!data.ready) {
    return (
      <span className="pill" title="Waiting for the first node snapshot">
        <span className="led" style={{ background: "var(--ink-40)", boxShadow: "none" }} />
        CONNECTING…
      </span>
    );
  }
  if (data.stale) {
    return (
      <span className="pill" title={`Last good snapshot ${ageSec}s ago · retrying every 2.5s`}>
        <span className="led" style={{ background: "var(--y-50)", boxShadow: "0 0 6px var(--y-50)" }} />
        STALE · reconnecting
      </span>
    );
  }
  return (
    <span className="pill live" title={"Feed polling ~every 2.5s · source: " + data.source}>
      <span
        key={data.lastUpdate}
        className="led"
        style={{ animation: "mp-beat 0.5s ease-out" }}
      />
      LIVE · updated {ageSec}s ago
    </span>
  );
}

export function useMempoolTracking(data: MoneroLive) {
  const [tracking, setTracking] = React.useState<Tracking>(null);

  const onSearch = React.useCallback((q: SearchQuery) => {
    if (q.kind === "tx") {
      // The tx's block is UNKNOWN until the node answers — never guess it from the
      // txid hash. Seed only an EXPLICIT click-from-a-confirmed-block height; otherwise
      // null (pending) and let useTrackedTxHeight resolve the real height from the node:
      //   • number    → clicked a confirmed block (authoritative; keep, drives the arrow now)
      //   • null       → clicked a mempool list (unconfirmed → resolve from node)
      //   • undefined → raw txid typed in the search box (→ resolve from node)
      // Confirmations then derive live (confOf) on every render.
      const explicit = typeof q.blockHeight === "number";
      setTracking({ kind: "tx", id: q.id, blockHeight: explicit ? q.blockHeight! : null, explicit });
    } else {
      const block = data.blocks.find((b) => b.height === q.height);
      setTracking({ kind: "block", height: q.height, block });
    }
  }, [data.blocks]);

  const clearTracking = React.useCallback(() => setTracking(null), []);

  // ONE real block height, resolved from the node and re-polled while pending. The
  // ribbon reads tracking.blockHeight and the detail panel resolves the same height,
  // so they can never disagree. (Empty id when not tracking a tx → no fetch.)
  const resolved = useTrackedTxHeight(tracking?.kind === "tx" ? tracking.id : "", data);

  // Write the node-resolved height back into tracking (null while pending → no arrow;
  // real once mined → arrow snaps to the right block). Guarded so it never clobbers an
  // explicit click-from-block height and never loops: the functional updater returns the
  // SAME reference when the value is unchanged, so React bails out of the re-render.
  React.useEffect(() => {
    setTracking((t) => {
      if (t?.kind !== "tx" || t.explicit) return t;
      if (resolved.blockHeight === t.blockHeight) return t;
      return { ...t, blockHeight: resolved.blockHeight };
    });
  }, [resolved.blockHeight]);

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
// the REAL-data inspectors (LiveTxDetail / LiveBlockDetail), which fetch the tx /
// block from the node and own loading / error / placeholder states. Confirmations
// derive from confOf fed the real height the node reports (re-polled while a tx is
// pending, frozen once mined), so the ribbon label, the tracked arrow, and this
// panel can never disagree.
export function MempoolTrackingDetail({ tracking, data, onBack, onPickTx }: {
  tracking: Tracking;
  data: MoneroLive;
  onBack: () => void;
  onPickTx?: (id: string, blockHeight?: number | null) => void;
}) {
  if (!tracking) return null;
  if (tracking.kind === "tx") {
    return <LiveTxDetail txid={tracking.id} data={data} onBack={onBack} />;
  }
  // Clicking a tx inside the block pins it to THIS block height (no hash hop).
  return (
    <LiveBlockDetail
      height={tracking.height}
      data={data}
      onBack={onBack}
      onPickTx={(id, h) => onPickTx?.(id, h)}
    />
  );
}
