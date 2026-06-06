// AUTO-PORTED from mempool/mempool-shared.jsx
// Run `npm run port` to refresh. Manual fixups land in MIGRATION.md.
import * as React from "react";
import type { MoneroLive, Block } from "@/data/types";

// mempool-shared.tsx — search + tracking state shared by all mempool views.
//
// Every mempool surface (Reactor, Classic, Bridge, Sediment, Constellation,
// Terminal) gets the same search behaviour: paste a 64-char txid or a block
// height. The detail-routing component (TrackingDetail → FullTxDetail /
// FullBlockDetail) depends on the tx-detail inspectors that land in Phase 4c;
// it will be re-added then.

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
