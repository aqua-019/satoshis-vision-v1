// mempool-shared.jsx — search + detail routing shared by all mempool views.
//
// Every mempool surface (Reactor, Classic, Bridge, Sediment, Constellation,
// Terminal) gets the same search behaviour: paste a 64-char txid or a block
// height, and the page swaps in the FullTxDetail or FullBlockDetail panel.
//
// Exports to window:
//   useMempoolTracking(data)  → { tracking, onSearch, clearTracking }
//   <MempoolSearchBar onSearch />  — clean horizontal search field
//   <TrackingDetail tracking data onBack onPickTx />  — auto-routes to
//     FullTxDetail / FullBlockDetail when tracking is active

function useMempoolTracking(data) {
  const [tracking, setTracking] = React.useState(null);

  const onSearch = React.useCallback(({ kind, id, height }) => {
    if (kind === "tx") {
      setTracking({ kind: "tx", id });
    } else if (kind === "block") {
      const block = data.blocks.find((b) => b.height === height);
      setTracking({ kind: "block", height, block });
    }
  }, [data.blocks]);

  const clearTracking = React.useCallback(() => setTracking(null), []);

  // Re-resolve block on every data tick so confirmation count stays live
  React.useEffect(() => {
    if (tracking?.kind === "block") {
      const b = data.blocks.find((x) => x.height === tracking.height);
      if (b && b !== tracking.block) setTracking((t) => ({ ...t, block: b }));
    }
  }, [data.blocks, tracking]);

  return { tracking, onSearch, clearTracking };
}

function MempoolSearchBar({ onSearch, placeholder, compact }) {
  const [q, setQ] = React.useState("");
  const submit = (e) => {
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

function TrackingDetail({ tracking, data, onBack, onPickTx }) {
  if (!tracking) return null;
  const FullTxDetail = window.FullTxDetail;
  const FullBlockDetail = window.FullBlockDetail;
  if (tracking.kind === "tx") {
    const tx = window.txSynthFromId(tracking.id, data);
    return <FullTxDetail tx={tx} onBack={onBack} />;
  }
  if (tracking.kind === "block" && tracking.block) {
    const block = window.blockSynth(tracking.block, data);
    return <FullBlockDetail block={block} onBack={onBack} onPickTx={onPickTx} />;
  }
  return null;
}

Object.assign(window, { useMempoolTracking, MempoolSearchBar, TrackingDetail });
