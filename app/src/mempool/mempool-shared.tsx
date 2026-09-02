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
/**
 * p4·M8 — bring the panel to the reader on a phone, and put them back after.
 *
 * MEASURED at 390×844 before this: tapping a block opened its panel at document
 * offset 2,870px — 3.35 viewports below the fold — and the page did not move, so
 * NOTHING VISIBLE CHANGED and the tap read as broken. Reordering the shell's
 * children (see MemViewShell above) closed 1,915px of that; this closes the rest.
 *
 * ── WHY A WIDTH BRANCH IS SAFE HERE AND IS NOT SAFE IN RENDER ──────────────
 * This is an EFFECT. It runs only in the browser, after mount, so
 * `scripts/prerender.mjs`'s `renderToString` never reaches it and the JS-off
 * document is byte-identical either way. A width branch in RENDER would emit one
 * viewport's composition into every prerendered file — which is why the rest of
 * the phone composition is CSS.
 *
 * ── WHY IT IS SCOPED TO ≤720 RATHER THAN RUN EVERYWHERE ────────────────────
 * On desktop the panel is already the tallest thing on screen when it opens and
 * three gates (verify-memdetail, verify-tracking, verify-glide) drive tracking at
 * 1440 and measure geometry afterwards. Moving the desktop viewport would change
 * what they measure for a reader who did not need it. 720 is the same threshold
 * the rest of this release uses — the width at which BottomTabBar appears.
 *
 * ── WHY THE SCROLL IS RESTORED ────────────────────────────────────────────
 * Dismissing used to strand the reader: `← Back` clears tracking, the document
 * shrinks by ~900px, and they are left in the middle of the transaction table
 * with no idea where the ladder went. The position is captured before the jump
 * and restored on unmount, so open-then-dismiss is a round trip.
 *
 * Both moves are INSTANT (`behavior` is left at its default `auto`). A smooth
 * scroll here would be motion carrying no information, and the reduced-motion
 * path and the default path are therefore one path.
 */
function useDetailReveal(active: boolean) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!active || typeof window === "undefined") return;
    if (!window.matchMedia || !window.matchMedia("(max-width: 720px)").matches) return;
    const node = ref.current;
    if (!node) return;
    const from = window.scrollY;
    // One frame, so the panel has been laid out before we measure it. The
    // detail mounts in a loading state and grows as the fetch lands, so
    // `block: "start"` on the panel's own top is the stable anchor — its
    // HEIGHT changes, its top does not.
    // D0699-EXEMPT: one deferred scroll after layout, cancelled on cleanup — not a loop
    const id = requestAnimationFrame(() => node.scrollIntoView({ block: "start" }));
    return () => {
      cancelAnimationFrame(id);
      window.scrollTo(0, from);
    };
  }, [active]);
  return ref;
}

export function MempoolTrackingDetail({ tracking, data, onBack, onPickTx }: {
  tracking: Tracking;
  data: MoneroLive;
  onBack: () => void;
  onPickTx?: (id: string, blockHeight?: number | null) => void;
}) {
  // The hook is called UNCONDITIONALLY and takes `active` as a parameter — the
  // early `return null` below used to be the first statement, and a hook after
  // it would be called on some renders and not others. `useDetailReveal` is a
  // no-op when inactive.
  const revealRef = useDetailReveal(Boolean(tracking));
  if (!tracking) return null;
  return (
    // `data-mem-detail` is the panel's handle — it had none, so no gate could
    // say where the detail renders or whether a tap reached it. The wrapper is
    // a plain block box that adds no geometry of its own.
    <div ref={revealRef} data-mem-detail={tracking.kind}>
      {tracking.kind === "tx" ? (
        <LiveTxDetail txid={tracking.id} data={data} onBack={onBack} />
      ) : (
        // Clicking a tx inside the block pins it to THIS block height (no hash hop).
        <LiveBlockDetail
          height={tracking.height}
          data={data}
          onBack={onBack}
          onPickTx={(id, h) => onPickTx?.(id, h)}
        />
      )}
    </div>
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
  /** Hide the stats strip for views that render their own dense telemetry.
   *
   *  `"compact"` collapses it to `MemStatStrip`'s single inline row instead of
   *  hiding it — the same five `data-memstat` / `data-memstat-value` pairs, at
   *  roughly 40px less height. That mode has existed in `mem-stats.tsx:159`
   *  since it was written, and its own docblock names the two views it was for
   *  ("views with little chrome budget (Reactor, Terminal)") — but nothing
   *  could reach it, because this prop was boolean and no other passthrough
   *  existed. Widening the prop rather than adding one keeps the per-view
   *  control singular: every existing caller passes `true`, `false` or nothing
   *  and is unaffected, and the type makes any unhandled site a compile error.
   *  Reactor spends the 40px on its composition — see ARTBOARD_W in reactor.tsx. */
  stats?: boolean | "compact";
  /** The view's MEMPOOL_VIEWS id, surfaced as `data-mem-view`. Deep-link and
   *  per-view DOM assertions key off it — without it a gate cannot tell which
   *  of the eleven surfaces it is actually looking at, and an unknown `?v=`
   *  silently serving the classic fallback is indistinguishable from success. */
  id?: string;
  /**
   * Static equivalent of the view — a table of the same data.
   *
   * ALWAYS mounted when supplied, and CSS-gated to the states that need it:
   * `.mem-table` is `display: none` by default and `display: block` under
   * `@media (prefers-reduced-motion: reduce)` and at ≤768px
   * (`styles.css:1468-1469`, `:2471`). It is an ADDITION to the body, never a
   * replacement for it — see the reasoning at the top of MemViewShell below.
   *
   * CORRECTED (v2·2): this docstring previously read "Rendered under
   * `prefers-reduced-motion` INSTEAD of `children`, so an animated field is
   * never merely paused but genuinely not mounted." That described a revision
   * which was REVERTED — it removed Classic's and Reactor's block ribbons —
   * and it contradicted the implementation comment twenty lines below it. The
   * binding line is `showBody` further down, which consults `tracking` and
   * never reduced motion. Suppressing the animated surface under reduce is the
   * VIEW's job (sediment renders a static field instead of its canvas), not
   * the shell's. The stale text had already propagated into
   * `claude/V2-VIEW-CONFORMANCE.md` §6 and was one step from a break test
   * asserting the opposite of the intended behaviour.
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
          so whenever the body is suppressed the view would be left with no
          numbers at all. The strip therefore comes back on `!showBody`:
          opting out of it is a layout choice, not a reason to lose the
          readings.

          CORRECTED (v2·2): this comment previously justified the `!showBody`
          term with "under reduced motion the body is not rendered". That is
          false — `showBody` consults `tracking` only. The condition is right;
          the reason given for it was not, and it named the one state that
          cannot trigger it. The state that DOES trigger it is
          `tracking && !keepBodyWhileTracking`. */}
      {stats !== false || !showBody ? <MemStatStrip data={data} compact={stats === "compact"} /> : null}
      {showBody ? <div className="mem-body" data-mem-body>{children}</div> : null}
      {/* p4·M8 — THE DETAIL NOW PRECEDES THE TABLE, and the reason is measured
          rather than aesthetic. `.mem-table` is `display: block` at ≤768px, so on
          a phone a 60-row transaction table sat PHYSICALLY BETWEEN the view body
          and the detail a reader had just opened. Tapping a block put its panel
          at document offset 2,870px — 3.35 viewports down — and the page did not
          scroll, so nothing visible changed and the tap read as broken.
          Measured: 1,915px of that 1,971px gap was this table.

          Swapping the two closes it without moving a pixel of layout in any
          state where both are visible at once, because they are siblings in a
          plain block flow: the tracked state renders the detail, the untracked
          state renders neither. Desktop is unaffected — `.mem-table` is
          `display: none` above 768px, so above that width this reorder changes
          the DOM order of one rendered element and one unrendered one.
          Reduced motion at desktop DOES render both, and there the detail
          moving above the table is the same improvement for the same reason. */}
      {tracking ? (
        <MempoolTrackingDetail
          tracking={tracking}
          data={data}
          onBack={onClearTracking}
          onPickTx={(id, h) => onSearch({ kind: "tx", id, blockHeight: h })}
        />
      ) : null}
      {/* Always in the DOM, CSS-gated to the states that need it (reduced
          motion and ≤768px) so it costs desktop no height — Reactor has only
          ~116px of headroom before verify-fit.mjs's bound. */}
      {table ? <div className="mem-table" data-mem-table>{table}</div> : null}
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

const fmtAgeShort = (sec: number | null): string => {
  if (sec == null || !Number.isFinite(sec)) return "—";   // no clock reported an arrival (p4·M9a)
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
    // Newest first; a tx with no known age sorts LAST rather than as 0 (which
    // would put every unaged tx at the top as if it had just arrived).
    () => [...data.mempool].sort((a, b) => (a.age ?? Infinity) - (b.age ?? Infinity)).slice(0, cap),
    [data.mempool, cap],
  );
  const grid = columns.map((c) => COL_WIDTH[c]).join(" ");

  const cell = (t: (typeof rows)[number], c: MemTxColumn): React.ReactNode => {
    switch (c) {
      case "txid": return shortHash(t.id);
      // p4·M8 — the unit is its own element so the phone can drop it. It is the
      // column's own heading (`FEE/B`) restated on every row, and at four columns
      // in a 320px viewport it was the difference between a fee that reads and a
      // fee that ellipsises: the cell had 71.3px and needed ~106. Split here
      // rather than branched on viewport in JS, because a width branch would
      // emit the wrong one into the prerendered HTML.
      case "perB": return <>{Math.round(t.perB)}<span className="mem-tbl__u">{" pcn/B"}</span></>;
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
      {/* p4·M8 — `data-col` is the field id and `data-label` its heading, emitted
          on EVERY cell including the header's. Below 720px the table has no room
          for six columns in ~326px, so the phone composition selects a subset BY
          FIELD (styles.css's p4·M8 block) rather than by position — position
          differs between views (pulse orders `txid, age, perB, …` where classic
          orders `txid, perB, tier, …`), so an nth-child rule would hide a
          different quantity on each view. The label rides along so a phone form
          that needs an inline heading can read it from the same source as the
          header row rather than restating COL_LABEL in CSS. */}
      <div className="mem-tbl__r mem-tbl__h" role="row">
        {columns.map((c) => <div key={c} className="mem-tbl__c" data-col={c} data-label={COL_LABEL[c]} role="columnheader">{COL_LABEL[c]}</div>)}
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
            {columns.map((c) => <div key={c} className="mem-tbl__c" data-col={c} data-label={COL_LABEL[c]} role="cell">{cell(t, c)}</div>)}
          </div>
        );
      }) : (
        <div className="mem-tbl__r" role="row">
          <div className="mem-tbl__c dim" data-col="empty" style={{ gridColumn: "1 / -1" }} role="cell">
            {hasData(data.status.network) ? "mempool is empty" : "awaiting the first node snapshot…"}
          </div>
        </div>
      )}
    </div>
  );
}
