// AUTO-PORTED from mempool/mempool-shared.jsx
// Run `npm run port` to refresh. Manual fixups land in MIGRATION.md.
import * as React from "react";
import type { MoneroLive, Block } from "@/data/types";
import { shortHash, fmtBytes } from "@/data/types";
import { LiveTxDetail, LiveBlockDetail } from "@/mempool/tx-detail";
import { useTrackedTxHeight } from "@/mempool/live-detail";
import { useTick } from "@/design/ArtBackground";
import { useReducedMotion } from "@/design/useReducedMotion";
import { confOf, CONF_UNLOCK } from "@/mempool/conf";
import { FEE_TIER_LABELS, feeTierIndex } from "@/data/map";
import { CHAIN_CHROME_KEYS, freshAt, hasData } from "@/data/feed-status";
import { CHROME_LABEL, chromeDetail, useChromeState } from "@/design/useOnline";
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
// user a per-second signal the feed is alive. `useTick(1000, { motion: false })`
// re-renders it each second to advance "updated Ns ago"; the LED is keyed on
// `lastUpdate` so it remounts (replaying the one-shot `mp-beat` flash) exactly
// when a new poll lands, not every second. This is a real elapsed-time readout,
// not decoration — `motion: false` keeps its 1s cadence exact on the mid/low
// tiers instead of being floored to 80/200ms, and it stays live under
// prefers-reduced-motion instead of freezing (see design/ArtBackground.tsx's
// UseTickOptions doc comment). Five states, one vocabulary shared with the
// other chrome surfaces (design/useOnline.ts): OFFLINE (the browser never
// dialled), CONNECTING (no node snapshot yet), NO NODE RESPONSE (asked,
// nothing came back, and nothing cached to fall back to), STALE (was live,
// polls now failing — values shown are last-good), LIVE.
export function MempoolHeartbeat({ data }: { data: MoneroLive }) {
  useTick(1000, { motion: false });
  // Age of the NODE snapshot this pill reports on. During an outage it now
  // counts UP instead of resetting every tick — the reading the pill was
  // always meant to give, and could not while it measured the heartbeat.
  const ageSec = Math.max(0, Math.round((Date.now() - freshAt(data.status.network)) / 1000));
  const state = useChromeState(data.status, CHAIN_CHROME_KEYS);
  const detail = chromeDetail(state, data.status, CHAIN_CHROME_KEYS) ?? undefined;
  if (state === "offline" || state === "loading") {
    return (
      <span className="pill" title={detail}>
        <span className="led" style={{ background: "var(--ink-40)", boxShadow: "none" }} />
        {CHROME_LABEL[state]}
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="pill" title={detail}>
        <span className="led" style={{ background: "var(--r-50)", boxShadow: "0 0 6px var(--r-50)" }} />
        {CHROME_LABEL.error}
      </span>
    );
  }
  if (state === "stale") {
    return (
      <span className="pill" title={`Last good snapshot ${ageSec}s ago · ${detail}`}>
        <span className="led" style={{ background: "var(--y-50)", boxShadow: "0 0 6px var(--y-50)" }} />
        {CHROME_LABEL.stale}
      </span>
    );
  }
  // Exhaustiveness, by `satisfies` rather than an assertNever default: after the
  // guards above `state` has narrowed to "live", and a fifth FeedPhase would
  // widen ChromeState and fail this line at compile time (TS1360). Same
  // protection as the switch sites, one line, no unreachable branch to render.
  state satisfies "live";
  return (
    <span className="pill live" title={"Feed polling ~every 2.5s · source: " + data.source}>
      <span
        // Remounts (replaying mp-beat) when the NETWORK endpoint delivers, not
        // on any tier commit — so the LED stops flashing while it is down.
        key={freshAt(data.status.network)}
        className="led"
        // D0651/D0652: 0.5s exact → var(--d-4). `ease-out` (cubic-bezier(0,0,.58,1)) kept
        // literal, not mapped to var(--e-decel) — sampled at y=0.2/0.5/0.9 the two curves
        // sit ~0.05-0.15 apart in x, a materially bigger gap than the reconciled cases
        // elsewhere (~0.03-0.08), so this is a genuinely different curve, not a rename.
        style={{ animation: "mp-beat var(--d-4) ease-out" }}
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
    // minWidth:0 on BOTH the form and the input. A flex item defaults to
    // min-width:auto, which is its content's intrinsic minimum — for a text
    // input that is wide enough to hold the placeholder. Without this the row
    // cannot shrink at 390px: it overflows the view, and whichever sibling is
    // allowed to give (the SEARCH button) collapses to a vertical stack of
    // letters instead.
    <form onSubmit={submit} style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", flex: "1 1 0", minWidth: 0, maxWidth: compact ? 380 : 520 }}>
      <input
        type="text" value={q} onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder || "Search by 64-char txid or block height…"}
        spellCheck={false}
        style={{
          flex: "1 1 0", minWidth: 0, appearance: "none",
          background: "var(--surface-sunk)", color: "var(--ink-100)",
          border: "1px solid var(--ink-20)", borderRadius: 3,
          padding: compact ? "var(--sp-2) var(--sp-2)" : "var(--sp-2) var(--sp-3)",
          fontFamily: "var(--f-mono)", fontSize: compact ? "var(--fs-label)" : "var(--fs-mono)",
          letterSpacing: "0.02em", outline: "none",
        }}
        onFocus={(e) => (e.target.style.borderColor = "var(--tk-accent)")}
        onBlur={(e) => (e.target.style.borderColor = "var(--ink-20)")}
      />
      {/* flexShrink:0 + nowrap. Without them the button is the flex item that
          gives when the row is tight, and at 390px it collapses to ~40px wide,
          wrapping the label into a vertical column of letters. */}
      <button type="submit" className="proto-btn"
        style={{
          padding: compact ? "var(--sp-1) var(--sp-3)" : "var(--sp-2) var(--sp-3)",
          fontSize: compact ? "var(--fs-label)" : "var(--fs-mono)",
          flexShrink: 0, whiteSpace: "nowrap",
        }}>
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
        color: "inherit", fontSize: "var(--fs-mono)", lineHeight: 1, padding: 0, marginLeft: 2,
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
      // The data-* attributes are the machine-readable form of what the text
      // says. A gate asserting "tracking survives the mempool → block
      // transition and counts 0→10" cannot reliably parse a rendered pill —
      // the shortened txid runs straight into the count — but it can read these.
      <span
        className="pill mono"
        style={{ borderColor: tone, color: tone }}
        data-mem-track-phase={pending ? "mempool" : unlocked ? "unlocked" : "confirmed"}
        data-mem-track-conf={conf}
      >
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
    <span
      className="pill mono"
      style={{ borderColor: tone, color: tone }}
      data-mem-track-phase="block"
      data-mem-track-conf={conf}
    >
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
  /** The view's MEMPOOL_VIEWS id, surfaced as `data-mem-view`. Deep-link and
   *  per-view DOM assertions key off it — without it a gate cannot tell which
   *  of the eleven surfaces it is actually looking at, and an unknown `?v=`
   *  silently serving the classic fallback is indistinguishable from success. */
  id?: string;
  /**
   * Static equivalent of the view — a table of the same data.
   *
   * Rendered under `prefers-reduced-motion` INSTEAD of `children`, so an
   * animated field is never merely paused but genuinely not mounted, and the
   * data stays readable. Also rendered below the body on small screens, where
   * a wide canvas has to be panned to read.
   */
  table?: React.ReactNode;
  children: React.ReactNode;
}

export function MemViewShell({
  data,
  tracking,
  onSearch,
  onClearTracking,
  keepBodyWhileTracking = true,
  stats = true,
  id,
  table,
  children,
}: MemViewShellProps): JSX.Element {
  // Reduced motion suppresses ANIMATION, not CONTENT. An earlier revision hid
  // the body outright and swapped in the table; that also removed Classic's and
  // Reactor's block ribbons, which are static information a reduced-motion user
  // still needs — verify-glide.mjs scenario 4 asserts exactly that (the new head
  // block must still render, snapped). Views already stop their own animation
  // via useReducedMotion; the table is an ADDITION for that state, not a
  // replacement for the view.
  const showBody = !tracking || keepBodyWhileTracking;
  return (
    <div className="mem-view" data-mem-view={id} style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)", minHeight: 0 }}>
      <div className="mempool-search-bar">
        <MempoolSearchBar onSearch={onSearch} />
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", marginLeft: "auto" }}>
          <MempoolHeartbeat data={data} />
          {tracking ? <TrackChip tracking={tracking} data={data} onClear={onClearTracking} /> : null}
        </div>
      </div>
      {/* `stats={false}` lets a view carry its own dense telemetry instead of
          the strip (Terminal does). But that telemetry lives INSIDE the body,
          and under reduced motion the body is not rendered — which would leave
          the view with no numbers at all. So the strip comes back whenever the
          body is suppressed: opting out of it is a layout choice, not a reason
          to lose the readings. */}
      {stats !== false || !showBody ? <MemStatStrip data={data} /> : null}
      {showBody ? <div className="mem-body" data-mem-body>{children}</div> : null}
      {/* Always in the DOM, CSS-gated to the states that need it (reduced
          motion and ≤768px) so it costs desktop no height — Reactor has only
          ~116px of headroom before verify-fit.mjs's bound. */}
      {table ? <div className="mem-table" data-mem-table>{table}</div> : null}
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

// ── Table fallback ─────────────────────────────────────────────
//
// The static equivalent of a mempool view: the same real txs, as rows.
// MemViewShell renders it INSTEAD of the animated body under
// prefers-reduced-motion, and alongside it on small screens where a wide
// canvas has to be panned to read.
//
// One implementation with a per-view column set, not six bespoke tables. The
// per-view *idiom* matters for the visualisation — that is the whole point of
// having eleven of them — but the fallback is the plain reading of the same
// numbers, and six copies of a tx table would only be six places for the
// columns to drift apart.
//
// The tracked tx is marked with `data-track-idiom` here too, so a view whose
// highlight only exists on a canvas still has a checkable, accessible one in
// the reduced-motion state.

export type MemTxColumn = "txid" | "perB" | "tier" | "size" | "age" | "inout" | "ring" | "fee";

const COL_LABEL: Record<MemTxColumn, string> = {
  txid: "txid", perB: "fee/B", tier: "tier", size: "size",
  age: "age", inout: "in/out", ring: "ring", fee: "fee",
};
const COL_WIDTH: Record<MemTxColumn, string> = {
  txid: "1.5fr", perB: "88px", tier: "74px", size: "80px",
  age: "68px", inout: "74px", ring: "56px", fee: "110px",
};

const fmtAgeShort = (sec: number): string => {
  const s = Math.max(0, Math.round(sec));
  if (s < 90) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${Math.floor(s / 3600)}h ${String(Math.round((s % 3600) / 60)).padStart(2, "0")}m`;
};

export function MemTxTable({ data, tracking, viewId, columns, cap = 60, onPickTx }: {
  data: MoneroLive;
  tracking: Tracking;
  /** view id, echoed onto the tracked row's data-track-idiom */
  viewId: string;
  columns: MemTxColumn[];
  cap?: number;
  onPickTx?: (id: string) => void;
}): JSX.Element {
  const trackedId = tracking?.kind === "tx" ? tracking.id.toLowerCase() : null;
  const rows = React.useMemo(
    () => [...data.mempool].sort((a, b) => a.age - b.age).slice(0, cap),
    [data.mempool, cap],
  );
  const grid = columns.map((c) => COL_WIDTH[c]).join(" ");

  const cell = (t: (typeof rows)[number], c: MemTxColumn): React.ReactNode => {
    switch (c) {
      case "txid": return shortHash(t.id);
      case "perB": return `${Math.round(t.perB)} pcn/B`;
      case "tier": {
        const i = feeTierIndex(t.perB, data.feeTiers);
        return i >= 0 ? FEE_TIER_LABELS[i] : "—";
      }
      case "size": return fmtBytes(t.size);
      case "age": return fmtAgeShort(t.age);
      case "inout": return `${t.inputs}/${t.outputs}`;
      case "ring": return String(t.ringSize);
      case "fee": return t.fee.toFixed(6);
    }
  };

  return (
    <div className="mem-tbl" style={{ gridTemplateColumns: grid }} role="table">
      <div className="mem-tbl__r mem-tbl__h" role="row">
        {columns.map((c) => <div key={c} className="mem-tbl__c" role="columnheader">{COL_LABEL[c]}</div>)}
      </div>
      {rows.length ? rows.map((t) => {
        const isTracked = trackedId != null && t.id.toLowerCase() === trackedId;
        return (
          <div
            key={t.id}
            role="row"
            className={"mem-tbl__r" + (isTracked ? " is-tracked" : "")}
            data-track-idiom={isTracked ? viewId : undefined}
            onClick={onPickTx ? () => onPickTx(t.id) : undefined}
            style={onPickTx ? { cursor: "pointer" } : undefined}
          >
            {columns.map((c) => <div key={c} className="mem-tbl__c" role="cell">{cell(t, c)}</div>)}
          </div>
        );
      }) : (
        <div className="mem-tbl__r" role="row">
          <div className="mem-tbl__c dim" style={{ gridColumn: "1 / -1" }} role="cell">
            {hasData(data.status.network) ? "mempool is empty" : "awaiting the first node snapshot…"}
          </div>
        </div>
      )}
    </div>
  );
}
