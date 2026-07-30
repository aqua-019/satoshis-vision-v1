// AUTO-PORTED from mempool/mempool-shared.jsx
// Run `npm run port` to refresh. Manual fixups land in MIGRATION.md.
import * as React from "react";
import type { MoneroLive, Block } from "@/data/types";
import { shortHash } from "@/data/types";
import { LiveTxDetail, LiveBlockDetail } from "@/mempool/tx-detail";
import { useTrackedTxHeight } from "@/mempool/live-detail";
import { useTick } from "@/design/ArtBackground";
import { confOf, CONF_UNLOCK } from "@/mempool/conf";
import { MemStatStrip } from "@/mempool/mem-stats";

// mempool-shared.tsx — search + tracking state shared by all mempool views.
//
// Every mempool surface (Reactor, Classic, Bridge, Sediment, Constellation,
// Terminal) gets the same search behaviour: paste a 64-char txid or a block
// height. The shared detail routing (MempoolTrackingDetail, below) renders the
// tracking result through the REAL-data inspectors (LiveTxDetail / LiveBlockDetail
// in tx-detail.tsx), which fetch /api/xmr/tx and /api/xmr/block from the node and
// own their loading / error / placeholder states. Confirmations derive from the
// single confOf accessor, fed the real block height the node reports.

export type SearchQuery =
  | { kind: "tx"; id: string; blockHeight?: number | null }
  | { kind: "block"; height: number };
export type Tracking =
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
      //   • null       → clicked a mempool list (unconfirmed → resolve from the node)
      //   • undefined → raw txid typed in the search box (→ resolve from the node)
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

// ── Track chip ──────────────────────────────────────────────────
//
// A compact mono chip for the shared header row, showing what's currently
// tracked and its live state. State is derived ONLY from confOf/CONF_UNLOCK —
// the same accessor the ribbons and the detail panel use — so this chip can
// never disagree with them, and it keeps rendering unchanged across the
// mempool → block transition: useMempoolTracking already resolves the real
// height via useTrackedTxHeight, so tracking.blockHeight simply flips from
// null to a number and confOf picks that up on the next render.
export interface TrackChipProps { tracking: Tracking; data: MoneroLive; onClear?: () => void }

export function TrackChip({ tracking, data, onClear }: TrackChipProps): JSX.Element | null {
  if (!tracking) return null;

  const clearBtn = onClear ? (
    <button
      type="button"
      onClick={onClear}
      aria-label="Clear tracked"
      style={{
        appearance: "none", cursor: "pointer", background: "transparent", border: 0,
        color: "inherit", fontSize: 13, lineHeight: 1, padding: 0, marginLeft: 2,
      }}
    >
      ×
    </button>
  ) : null;

  if (tracking.kind === "tx") {
    const conf = confOf(tracking.blockHeight, data);
    const pending = tracking.blockHeight == null;
    const unlocked = !pending && conf >= CONF_UNLOCK;
    const tone = pending ? "var(--tk-accent)" : unlocked ? "var(--g-50)" : "var(--y-50)";
    const state = pending ? "IN MEMPOOL" : unlocked ? "CONFIRMED · UNLOCKED" : `${conf}/${CONF_UNLOCK} CONF`;
    return (
      <span className="pill mono" style={{ borderColor: tone, color: tone }}>
        {shortHash(tracking.id)}
        <span className="dim2" style={{ color: tone, opacity: 0.6 }}>·</span>
        {state}
        {clearBtn}
      </span>
    );
  }

  // tracking.kind === "block"
  const conf = confOf(tracking.height, data);
  const unlocked = conf >= CONF_UNLOCK;
  const tone = unlocked ? "var(--g-50)" : "var(--y-50)";
  const state = unlocked ? "CONFIRMED · UNLOCKED" : `${conf}/${CONF_UNLOCK} CONF`;
  return (
    <span className="pill mono" style={{ borderColor: tone, color: tone }}>
      {`BLOCK #${tracking.height.toLocaleString()}`}
      <span className="dim2" style={{ color: tone, opacity: 0.6 }}>·</span>
      {state}
      {clearBtn}
    </span>
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

// ── Mempool view shell ───────────────────────────────────────────
//
// The common wrapper every mempool surface (Reactor, Classic, Bridge,
// Sediment, Constellation, Terminal) assembles by hand today: search bar +
// heartbeat + (when tracking) a chip identifying what's tracked, the dense
// stat strip, the view's own content, and the shared tracking detail panel.
// This generalises Reactor's (reactor.tsx:361-362) and Classic's
// (classic.tsx:285-286) pattern of keeping the view body mounted while a tx
// is tracked, rather than swapping it out for the detail panel — that's what
// lets a per-view tracked-tx highlight (a ribbon arrow, a lit hex cell) stay
// visible at the same time as the detail panel below it.
export interface MemViewShellProps {
  data: MoneroLive;
  tracking: Tracking;
  onSearch: (q: SearchQuery) => void;
  onClearTracking: () => void;
  /** Keep the view body mounted while a tx is tracked (default true) so the
   *  view's own highlight stays visible; detail renders below it. */
  keepBodyWhileTracking?: boolean;
  /** Hide the stats strip for views that render their own dense telemetry. */
  stats?: boolean;
  children: React.ReactNode;
}

export function MemViewShell({
  data,
  tracking,
  onSearch,
  onClearTracking,
  keepBodyWhileTracking = true,
  stats = true,
  children,
}: MemViewShellProps): JSX.Element {
  const showBody = !tracking || keepBodyWhileTracking;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, minHeight: 0 }}>
      <div className="mempool-search-bar">
        <MempoolSearchBar onSearch={onSearch} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
          <MempoolHeartbeat data={data} />
          {tracking ? <TrackChip tracking={tracking} data={data} onClear={onClearTracking} /> : null}
        </div>
      </div>
      {stats !== false ? <MemStatStrip data={data} /> : null}
      {showBody ? children : null}
      {tracking ? (
        <MempoolTrackingDetail
          tracking={tracking}
          data={data}
          onBack={onClearTracking}
          onPickTx={(id, h) => onSearch({ kind: "tx", id, blockHeight: h })}
        />
      ) : null}
    </div>
  );
}
