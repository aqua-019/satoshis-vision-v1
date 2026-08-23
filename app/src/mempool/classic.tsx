// AUTO-PORTED from mempool/classic.jsx
// Run `npm run port` to refresh. Manual fixups land in MIGRATION.md.
import * as React from "react";
import { fmtBytes, shortHash as ShortHash } from "@/data/types";
import type { MoneroLive, Tx } from "@/data/types";
import { useMempoolTracking, MemViewShell, TrackChip, MemTxTable} from "@/mempool/mempool-shared";
import { chainTip, confOf, CONF_UNLOCK, RIBBON_BLOCKS } from "@/mempool/conf";
import { BlockEta } from "@/mempool/mem-stats";
import { NodeProvenance } from "@/design/primitives";
import { useRibbonGlide } from "@/mempool/useRibbonGlide";
import { useLadderAnchor } from "@/mempool/useLadderAnchor";
import { useReducedMotion } from "@/design/useReducedMotion";

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
// NOTE on "overdue": an earlier version of this comment claimed Classic surfaces
// an "+M:SS overdue" state once more than ~120s has elapsed since the last
// confirmation. That was never actually true — the old ClassicEta clamped at
// Math.max(0, …), same as the shared BlockEta (mem-stats.tsx) this view now
// uses. Overdue detection is still unimplemented; BlockEta would need to grow
// it (out of scope here — mem-stats.tsx isn't owned by this file).

// A tracked tx pins its block height ONCE at search time (see mempool/conf.ts);
// the ribbon highlight and the detail panel both derive confirmations live from
// that pinned height + the current tip, so they can never disagree.

/* ── flatter block ribbon ─────────────────────────────────── */

export function ClassicBlock({ block, status, confLabel, tracked, tracking, data, onClick, glideKey, etaNode }: any) {
  const isQueued = status === "queued" || status === "next";
  // A card is interactive exactly when a tap does something: it is confirmed AND
  // a handler was supplied. `isQueued` is the same predicate ClassicRibbon's own
  // `confirmed` uses, negated — kept derived here so the two cannot disagree.
  const interactive = !isQueued && typeof onClick === "function";
  const trackedTxId = tracked && tracking?.kind === "tx" ? tracking.id : undefined;
  return (
    // p4·M8 — a card that opens a panel is a CONTROL, and this one was a bare
    // <div>: no role, no tabindex, no accessible name, so it was unreachable by
    // keyboard and announced as nothing. It also showed `cursor: pointer` on the
    // two QUEUED/NEXT cards and did nothing when they were tapped — the guard
    // `confirmed && …` lives INSIDE the handler, so every card claimed to be
    // interactive and two of twelve were not. `interactive` is now derived from
    // the same fact the handler tests, so the cursor, the role, the tab stop and
    // the label all agree with what a tap actually does.
    <div
      onClick={interactive ? onClick : undefined}
      onKeyDown={interactive ? (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); }
      } : undefined}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? `Block ${block.height.toLocaleString()}, ${confLabel}` : undefined}
      data-glide-key={glideKey}
      data-tracked-block={tracked ? block.height : undefined}
      data-tracked-tx={trackedTxId}
      className={"mp-block" + (glideKey != null ? " glide-block" : "")}
      style={{
        display: "flex", flexDirection: "column", gap: "var(--sp-1)",
        cursor: interactive ? "pointer" : "default", minWidth: 108,
      }}
    >
      <div style={{ padding: "0 2px" }}>
        <div className="mono" style={{ fontSize: "var(--fs-mono)", color: isQueued ? "var(--ink-40)" : "var(--ink-100)" }}>
          {isQueued ? "~" + block.height : "#" + block.height.toLocaleString()}
        </div>
        <div className="mono" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.08em", color: isQueued ? "var(--ink-40)" : "var(--tk-accent)", textTransform: "uppercase", marginTop: 1 }}>
          {confLabel}
        </div>
      </div>
      <div style={{
        minHeight: 132, padding: "var(--sp-3) var(--sp-2)",
        borderRadius: 6,
        border: tracked ? "1.5px solid var(--y-50)" : isQueued ? "1px dashed var(--ink-20)" : "1px solid color-mix(in srgb, var(--accent-structural) 45%, transparent)",
        background: isQueued
          ? "color-mix(in srgb, var(--surface-sunk) 30%, transparent)"
          : "linear-gradient(180deg, color-mix(in srgb, var(--accent-structural) 42%, transparent), color-mix(in srgb, var(--accent-structural) 78%, transparent))",
        color: isQueued ? "var(--ink-60)" : "var(--bg-0)",
        boxShadow: tracked ? "0 0 12px color-mix(in srgb, var(--status-warn) 40%, transparent)" : "none",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        fontFamily: "var(--f-mono)",
      }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 500, lineHeight: 1, color: isQueued ? "var(--ink-80)" : "var(--bg-0)" }}>
            {isQueued && status === "queued" ? "—" : block.txs}
          </div>
          {!isQueued ? (
            <div style={{ fontSize: "var(--fs-label)", opacity: 0.7, marginTop: 2 }}>TXS</div>
          ) : (
            <div style={{ fontSize: "var(--fs-label)", opacity: 0.6, marginTop: "var(--sp-1)" }}>
              {status === "next" ? "NEXT · " + (block.txs || 0) + " TXS" : "QUEUED"}
            </div>
          )}
        </div>
        <div style={{ fontSize: "var(--fs-label)", opacity: 0.9, lineHeight: 1.5 }}>
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
      {tracked ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 2 }}>
          <div style={{ fontSize: "var(--fs-mono)", color: "var(--y-50)", lineHeight: 1 }}>▲</div>
          <TrackChip tracking={tracking} data={data} />
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
  const past = data.blocks.slice(0, RIBBON_BLOCKS);
  while (past.length < CONF_UNLOCK) past.push({ height: data.height - past.length, hash: "—", txs: 0, sizeKB: 0, reward: 0, pool: "—", age: 120 * past.length, conf: past.length + 1 });

  const ribbon = [
    ...queued.map((b, i) => ({ b, status: i === 0 ? "queued" : "next", confLabel: i === 0 ? "QUEUED" : "NEXT" })),
    ...past.map((b: any, i: number) => ({ b, status: i === 0 ? "current" : "past", confLabel: b.conf + (b.conf === 1 ? " confirmation" : " confirmations") })),
  ];

  const trackedHeight = tracking?.kind === "tx" ? (tracking.blockHeight ?? null) : null;
  const trackedConf = trackedHeight != null ? confOf(trackedHeight, data) : null;

  // The 10th confirmation is the unlock point — find that block's slot so we can
  // drop a single vertical UNLOCK divider in the gap immediately before it.
  const dividerIndex = ribbon.findIndex((r) => r.status !== "queued" && r.status !== "next" && r.b.conf === CONF_UNLOCK);

  // The pending/mined boundary — the first slot that is neither queued nor next.
  // Derived rather than written as a literal 2 so it follows `queued` above.
  const nowIndex = ribbon.findIndex((r) => r.status !== "queued" && r.status !== "next");

  // Glide the row when the tip advances (FLIP). Keyed to chainTip(data) — the
  // newest CONFIRMED block height (data.blocks[0].height), i.e. the exact value
  // the ribbon renders from — NOT data.height (get_info chain length), which
  // ticks on a different poll and would fire the glide against an unchanged DOM
  // (no-op) or let a new block arrive with no glide (pop). The tracked ▲ arrow
  // is a child of ClassicBlock, so it travels with its block automatically.
  const glideRef = useRibbonGlide(chainTip(data));

  // p4·M8 — land the ladder on the NOW divider instead of on its far-left card.
  // The ladder is the one element on the phone composition that still scrolls
  // horizontally, and it opened at scrollLeft 0 — i.e. on `~QUEUED`, the card
  // carrying an em-dash and no reading. See useLadderAnchor for why this is a
  // one-shot and why it is instant at every motion preference.
  const ladderRef = useLadderAnchor(glideRef);

  return (
    <div className="classic-ribbon" style={{ position: "relative", padding: "var(--sp-4) 20px var(--sp-6)" }}>
      <div className="mono" style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", marginBottom: "var(--sp-2)", fontSize: "var(--fs-label)", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-40)" }}>
        Confirmations <NodeProvenance source="session" keys={["blocks"]} status={data.status} /> <span className="dim2">tip − block height</span>
      </div>
      {/* `data-mem-ladder` is the ladder's only stable handle. It had none — an
          unclassed div with an inline `overflowX: auto`, reachable only as the
          parent of `[data-glide-key]` — so no gate could address the one
          element the phone composition permits to scroll. */}
      <div ref={ladderRef} data-mem-ladder style={{ display: "flex", alignItems: "flex-start", gap: "var(--sp-2)", overflowX: "auto", paddingBottom: "var(--sp-3)" }}>
        {ribbon.map((r, i) => {
          const confirmed = r.status !== "queued" && r.status !== "next";
          // Live next-block countdown on the QUEUED/NEXT cards, via the shared
          // BlockEta leaf (mem-stats.tsx) — isolated so only its text re-renders
          // each second (own useTick(1000)); the ribbon + FLIP glide stay
          // untouched. Reads the node's real data.blockTarget instead of the
          // hardcoded 120s literal this view used to carry. offsetSec shifts the
          // QUEUED card one block-target further out than the imminent NEXT card.
          const etaNode =
            r.status === "next" ? <BlockEta data={data} /> :
            r.status === "queued" ? <BlockEta data={data} offsetSec={data.blockTarget || 120} /> :
            undefined;
          return (
            // Confirmed blocks: stable identity by height (so React reuses the DOM
            // node across the shift — a FLIP prerequisite). Queued/next placeholders
            // keep an index key and do not glide. The UNLOCK divider is a static
            // flex sibling with no data-glide-key, so it's invisible to the glide.
            <React.Fragment key={confirmed ? "b" + r.b.height : "q" + i}>
              {/* p4·M8 — the NOW divider. mempool.space keeps a dashed rule at
                  the pending/mined boundary and it is what makes a two-card
                  phone viewport legible: one block either side says "this is
                  the present". `nowIndex` is the first CONFIRMED slot, derived
                  from the same `status` the cards read rather than from a
                  literal 2, so a change to the queued-card count moves it.
                  It is also the anchor useLadderAnchor scrolls to. */}
              {i === nowIndex ? (
                <div data-now-divider aria-hidden style={{ alignSelf: "stretch", flex: "0 0 auto", display: "flex",
                     flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "var(--sp-1)", padding: "0 var(--sp-1)" }}>
                  <div style={{ width: 0, flex: 1, borderLeft: "1px dashed var(--ink-40)" }} />
                  <div className="mono classic-now" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.14em", color: "var(--ink-60)",
                       writingMode: "vertical-rl", transform: "rotate(180deg)" }}>NOW</div>
                </div>
              ) : null}
              {i === dividerIndex ? (
                <div aria-hidden style={{ alignSelf: "stretch", flex: "0 0 auto", display: "flex",
                     flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "var(--sp-1)", padding: "0 var(--sp-1)" }}>
                  <div style={{ width: 2, flex: 1, borderRadius: 1,
                       background: "linear-gradient(180deg, color-mix(in srgb, var(--status-warn) 12%, transparent), color-mix(in srgb, var(--status-warn) 85%, transparent), color-mix(in srgb, var(--status-warn) 12%, transparent))",
                       boxShadow: "0 0 8px color-mix(in srgb, var(--status-warn) 50%, transparent)" }} />
                  <div className="mono" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.14em", color: "var(--y-50)",
                       writingMode: "vertical-rl", transform: "rotate(180deg)" }}>UNLOCK</div>
                </div>
              ) : null}
              <ClassicBlock
                glideKey={confirmed ? r.b.height : undefined}
                block={r.b}
                status={r.status}
                confLabel={r.confLabel}
                etaNode={etaNode}
                tracked={trackedHeight != null && r.b.height === trackedHeight}
                tracking={tracking}
                data={data}
                onClick={() => confirmed && onSelectBlock?.(r.b.height)}
              />
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}


export function DetailItem({ k, v, tone }: any) {
  return (
    <div>
      <div className="kicker">{k}</div>
      <div className={"mono " + (tone === "acc" ? "acc" : "")} style={{ fontSize: 16, marginTop: "var(--sp-1)" }}>{v}</div>
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
    <div className="main" style={{ overflow: "auto", padding: 0 }}>
      <div className="classic-shell" style={{ padding: "var(--sp-3) 20px 0" }}>
        {/* MemViewShell (mempool-shared.tsx) supplies the search bar, heartbeat,
            tracked-chip and stat strip shared by all six mempool views. The
            ribbon stays mounted while tracking (keepBodyWhileTracking, default
            true) so the tracked ▲ rides its block alongside the detail panel
            below (both read confOf) — same placement as before this refactor. */}
        <MemViewShell id="classic" table={<MemTxTable data={data} tracking={tracking} viewId="classic" columns={["txid", "perB", "tier", "size", "age", "inout"]} onPickTx={(id) => onSearch({ kind: "tx", id })} />} data={data} tracking={tracking} onSearch={onSearch} onClearTracking={clear}>
          <ClassicRibbon data={data} tracking={tracking} onSelectBlock={(h: number) => onSearch({ kind: "block", height: h })} />
          {!tracking ? (
            // trackedTxId is always null here: ClassicLanding (and its tx feed)
            // only renders while nothing is tracked — see MempoolTrackingDetail
            // below, which takes over as soon as `tracking` is set. ClassicTxFeed
            // still accepts the prop (and wires data-tracked-tx off it) for
            // whichever consumer keeps the feed mounted during tracking.
            <ClassicLanding
              data={data}
              onPickTx={(id: string) => onSearch({ kind: "tx", id, blockHeight: null })}
              trackedTxId={null}
            />
          ) : null}
        </MemViewShell>
      </div>
    </div>
  );
}

export function ClassicBlockDetail({ block, onBack }: any) {
  return (
    <div style={{ padding: "var(--sp-5) 28px 60px" }}>
      <button type="button" onClick={onBack}
        style={{ appearance: "none", cursor: "pointer", background: "transparent",
          border: "1px solid var(--ink-20)", color: "var(--ink-60)",
          padding: "var(--sp-1) var(--sp-3)", borderRadius: 4,
          fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)",
          marginBottom: "var(--sp-4)",
        }}>← Back</button>
      <h2 className="serif" style={{ margin: 0, fontSize: 26, fontWeight: 400, color: "var(--ink-100)" }}>Block #{block.height.toLocaleString()}</h2>
      <div className="mono" style={{ fontSize: "var(--fs-mono)", color: "var(--c-50)", marginTop: "var(--sp-1)", wordBreak: "break-all" }}>{block.hash}</div>
      <section style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "var(--sp-5)", padding: "20px 0", borderTop: "1px solid var(--rule)", marginTop: "var(--sp-4)" }}>
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
// Tier colour is a 4-way qualitative legend (fastest → slowest), the same
// concept as terminal.tsx's TIER_COLORS array — not a single accent axis, so
// it draws from the existing ramp rather than accent-structural/accent-data:
// no blue role exists in the new vocabulary (economy was true blue) and forcing
// this array through the structural/data split would leave three of the four
// hues untouched while "fast" alone became theme-reactive.
const CLASSIC_TIERS = [
  { id: "priority", label: "PRIORITY", color: "var(--r-50)",     eta: "Next block",  desc: "Confirms in the next block" },
  { id: "fast",     label: "FAST",     color: "var(--tk-accent)", eta: "~4 min",      desc: "Within 1–2 blocks"          },
  { id: "normal",   label: "NORMAL",   color: "var(--g-50)",     eta: "~10 min",     desc: "Within ~5 blocks"           },
  { id: "economy",  label: "ECONOMY",  color: "var(--c-50)",     eta: "~60 min+",    desc: "When mempool clears"        },
];

// Quartile-based thresholds computed from the live mempool, so bucketing
// always produces a sensible distribution at any fee scale.
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
  const reduceMotion = useReducedMotion();
  // Per-tier median + sample tx, computed ONCE per `buckets` change instead of
  // on every render — this used to sort each tier's tx list inline inside the
  // render-time .map() below (4 sorts/render regardless of whether the mempool
  // actually changed).
  const tierStats = React.useMemo(
    () => CLASSIC_TIERS.map((tier, ti) => {
      const tx = buckets[tier.id];
      const thrFallback = buckets.thr ? buckets.thr[Math.min(ti, 2)] : 1000;
      const med = tx.length ? tx.map((t: any) => t.perB).sort((a: number, b: number) => a - b)[Math.floor(tx.length / 2)] : thrFallback;
      const sampleTx = tx[0] || { fee: (thrFallback * 1800) / 1e12, perB: thrFallback };
      return { tier, tx, med, sampleTx };
    }),
    [buckets],
  );

  return (
    <section className="classic-tiers" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--sp-2)" }}>
      {tierStats.map(({ tier, tx, med, sampleTx }) => {
        const costXmr = sampleTx.fee;
        const costUsd = costXmr * xmrUsd;
        return (
          <div key={tier.id} style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--rule)",
            borderTop: "3px solid " + tier.color,
            borderRadius: 8,
            padding: "var(--sp-4) var(--sp-4)",
            // D0651: 0.18s (bare, no easing keyword) → var(--d-2) var(--e-standard)
            transition: reduceMotion ? "border-color var(--d-2) var(--e-standard)" : "transform var(--d-2) var(--e-standard), border-color var(--d-2) var(--e-standard)",
          }}
            onMouseEnter={(e) => { if (!reduceMotion) e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={(e) => { if (!reduceMotion) e.currentTarget.style.transform = "translateY(0)"; }}>
            <div className="mono" style={{ fontSize: "var(--fs-mono)", fontWeight: 700, letterSpacing: "0.18em", color: tier.color, marginBottom: "var(--sp-2)" }}>{tier.label}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "var(--sp-1)", marginBottom: "var(--sp-1)" }}>
              <span className="mono" style={{ fontSize: 22, fontWeight: 500, color: "var(--ink-100)" }}>{Math.round(med).toLocaleString()}</span>
              <span className="mono dim" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.12em", textTransform: "uppercase" }}>pcn/B</span>
            </div>
            <div className="mono" style={{ fontSize: "var(--fs-mono)", color: "var(--ink-80)", marginBottom: 3 }}>
              ≈ {costXmr.toFixed(6)} XMR <span className="dim">· ${costUsd.toFixed(4)}</span>
            </div>
            <div className="mono" style={{ fontSize: "var(--fs-label)", color: "var(--ink-40)", letterSpacing: "0.12em", textTransform: "uppercase" }}>{tier.eta} · {tx.length} tx</div>
          </div>
        );
      })}
    </section>
  );
}

/* ── pcn/B caption ───────────────────────────────────────── */

function ClassicCaption() {
  return (
    <div className="mono classic-caption" style={{
      fontSize: "var(--fs-body)", color: "var(--ink-60)", lineHeight: 1.55,
      padding: "var(--sp-2) var(--sp-3)", borderLeft: "2px solid color-mix(in srgb, var(--accent-structural) 50%, transparent)",
      background: "color-mix(in srgb, var(--accent-structural) 4%, transparent)", borderRadius: "0 4px 4px 0",
    }}>
      <b style={{ color: "var(--ink-100)" }}>pcn/B</b> = piconero per byte. One piconero is 10⁻¹² XMR — the smallest unit. Monero fees scale with transaction size in bytes; a typical 2-input transaction is ≈ 1.8 KB.
    </div>
  );
}

/* ── projected next-block strip ──────────────────────────── */

export function ClassicProjBlock({ buckets, mempool, height, data }: any) {
  const reduceMotion = useReducedMotion();
  const total = mempool.length || 1;
  const totalBytes = mempool.reduce((a: number, t: any) => a + t.size, 0);
  // Real block-weight capacity from the node (bytes) — this used to be a
  // hardcoded `target = 250` styled as an "approx block-tx capacity", which
  // rendered a fabricated percentage (ALL-REAL-DATA, v5.0.14, forbids a
  // plausible-looking number that isn't actually measured). blockWeightLimit
  // is 0 until the node snapshot lands, so fill is null (renders "—") then —
  // never a guessed number.
  const weightLimit = data.blockWeightLimit || 0;
  const fill = weightLimit > 0 ? Math.min(1, totalBytes / weightLimit) : null;
  return (
    <div className="classic-panel" style={{
      background: "var(--surface-raised)", border: "1px solid var(--rule)",
      borderRadius: 8, padding: "var(--sp-3) var(--sp-4)",
    }}>
      <div className="classic-hd" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-2)" }}>
        <span className="mono" style={{ fontSize: "var(--fs-mono)", letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-60)" }}>Projected next block · #{(height + 1).toLocaleString()}</span>
        <span className="mono" style={{ fontSize: "var(--fs-mono)", color: "var(--tk-accent)", letterSpacing: "0.06em" }}>ETA ~<BlockEta data={data} /></span>
      </div>
      {/* Segmented bar — D0673, and the one shape here where scaleX alone cannot
          work. As flex items each segment's LAYOUT width positioned the next one,
          so scaling only the paint would leave gaps or overlaps. The container is
          therefore `position: relative` and each segment is absolutely positioned
          at full width, then placed AND sized by one compositor transform:
          translateX to its cumulative offset, scaleX to its share. */}
      <div style={{ height: 22, background: "var(--surface-sunk)", borderRadius: 5, overflow: "hidden", position: "relative", border: "1px solid var(--ink-10)" }}>
        {(() => {
          let offset = 0;
          return CLASSIC_TIERS.map((tier, i) => {
            const tx = buckets[tier.id];
            const pct = tx.length / total;
            const at = offset;
            offset += pct;
            // Guarded because an empty tier gives pct === 0, and the separator
            // below counter-scales by 1/pct — 1/0 is Infinity, which silently
            // produces an unrendered element rather than an error.
            const seg = Math.max(pct, 0.0001);
            return (
              <div key={tier.id} title={tier.label + " · " + tx.length + " tx"} style={{
                position: "absolute", left: 0, top: 0, bottom: 0, width: "100%",
                background: tier.color,
                opacity: 0.78,
                transformOrigin: "left",
                transform: `translateX(${at * 100}%) scaleX(${seg})`,
                transition: reduceMotion ? "none" : "transform var(--d-4) var(--e-standard)",
              }}>
                {/* The 1px tier separator, counter-scaled. Left on the segment it
                    would be scaled by that segment's share — at scaleX(0.05) a 1px
                    rule renders as 0.05px and the divisions between small tiers
                    disappear. scaleX(1/seg) inside the already-scaled segment nets
                    out to 1, so it stays a crisp 1px at every share; origin `right`
                    pins it to the segment's trailing edge. */}
                {i < 3 ? (
                  <div style={{
                    position: "absolute", top: 0, bottom: 0, right: 0, width: 1,
                    background: "color-mix(in srgb, var(--bg-0) 40%, transparent)",
                    transformOrigin: "right",
                    transform: `scaleX(${1 / seg})`,
                    pointerEvents: "none",
                  }} />
                ) : null}
              </div>
            );
          });
        })()}
      </div>
      <div className="mono classic-hd" style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--fs-mono)", color: "var(--ink-60)", marginTop: "var(--sp-2)" }}>
        <span>{fill != null ? Math.round(fill * 100) + "% of block capacity" : "— capacity"}</span>
        <span>{total} tx · {fmtBytes(totalBytes)}</span>
      </div>
      <div className="mono" style={{ display: "flex", gap: "var(--sp-3)", fontSize: "var(--fs-label)", color: "var(--ink-40)", marginTop: "var(--sp-1)", flexWrap: "wrap" }}>
        {CLASSIC_TIERS.map((tier) => (
          <span key={tier.id} style={{ display: "flex", alignItems: "center", gap: "var(--sp-1)" }}>
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
  const reduceMotion = useReducedMotion();
  const total = CLASSIC_TIERS.reduce((a, tier) => a + buckets[tier.id].reduce((s: number, t: any) => s + t.size, 0), 0) || 1;
  return (
    <div className="classic-panel" style={{
      background: "var(--surface-raised)", border: "1px solid var(--rule)",
      borderRadius: 8, padding: "var(--sp-3) var(--sp-4)",
    }}>
      <div className="classic-hd" style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--sp-3)" }}>
        <span className="mono" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-60)" }}>Fee depth</span>
        <span className="mono dim" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.12em", textTransform: "uppercase" }}>by tier · % of mempool weight</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
        {CLASSIC_TIERS.map((tier) => {
          const tx = buckets[tier.id];
          const bytes = tx.reduce((s: number, t: any) => s + t.size, 0);
          const pct = bytes / total;
          // Floor carried over from the old `Math.max(2, pct * 100) + "%"`: an
          // empty tier still shows a sliver rather than vanishing. 0.02 of an
          // 18px-tall track is ~2px at the widths this renders at, matching the
          // old 2% intent closely enough that the bars measure the same.
          const barScale = Math.max(0.02, pct);
          return (
            <div key={tier.id} className="classic-depth-row" style={{ display: "grid", gridTemplateColumns: "84px 1fr 80px 60px", gap: "var(--sp-3)", alignItems: "center" }}>
              <span className="mono" style={{ fontSize: "var(--fs-label)", color: tier.color, letterSpacing: "0.12em", fontWeight: 600 }}>{tier.label}</span>
              <div style={{ position: "relative", height: 18, background: "var(--line-d)", borderRadius: 3, overflow: "hidden" }}>
                {/* D0673: scaleX rather than width. The element is laid out at full
                    width and scaled down, so the animated property is a compositor
                    one. Two things had to move off the scaled node to survive that:
                    the 8px glow (a box-shadow scales WITH the transform, so at
                    scaleX(0.06) it renders as a smeared 0.5px smudge) now lives on
                    a non-scaled overlay below, and the old `Math.max(2, …)` floor —
                    which existed to keep an empty tier visibly non-zero — becomes a
                    floor on the SCALE factor, same intent expressed in the new
                    unit. `inset: "0 auto 0 0"` was a static position, never a
                    transition target, and is replaced by an explicit left/width. */}
                <div style={{
                  position: "absolute", left: 0, top: 0, bottom: 0,
                  width: "100%",
                  transformOrigin: "left",
                  transform: `scaleX(${barScale})`,
                  background: `linear-gradient(90deg, color-mix(in srgb, ${tier.color} 25%, transparent), color-mix(in srgb, ${tier.color} 93%, transparent))`,
                  transition: reduceMotion ? "none" : "transform var(--d-4) var(--e-standard)",
                }}>
                  {/* The glow, counter-scaled back to net 1. Nested inside the
                      scaled bar it inherits scaleX(barScale), so scaleX(1/barScale)
                      cancels it exactly — the blur renders round instead of smeared,
                      and because transform-origin is `right` the two right edges
                      stay coincident, so the halo tracks the bar's leading edge for
                      free instead of needing its own position animation. */}
                  <div style={{
                    position: "absolute", inset: 0,
                    transformOrigin: "right",
                    transform: `scaleX(${1 / barScale})`,
                    boxShadow: `0 0 8px color-mix(in srgb, ${tier.color} 33%, transparent)`,
                    pointerEvents: "none",
                  }} />
                </div>
              </div>
              <span className="mono dim" style={{ fontSize: "var(--fs-mono)", textAlign: "right" }}>{fmtBytes(bytes)}</span>
              <span className="mono" style={{ fontSize: "var(--fs-mono)", color: "var(--ink-100)", textAlign: "right" }}>{(pct * 100).toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── live tx feed ────────────────────────────────────────── */

// Keyframes for a newly-arrived row's enter transition. Defined inline (NOT in
// styles.css, which this file doesn't own) and named `classic-tx-enter-kf` —
// deliberately distinct from styles.css's `glide-enter-kf` (verify-glide.mjs
// counts that exact name; a collision would silently corrupt an already-green
// gate). Applying the class is gated in JS via useReducedMotion() below, so
// both mechanisms honour prefers-reduced-motion.
// D0651/D0652: 0.4s tie → var(--d-4) (round-half-up, same as styles.css:.panel). `ease-out`
// kept literal, not mapped to var(--e-decel) — see mempool-shared.tsx's TrackChip comment
// for the numeric reconciliation (sampled ~0.05-0.15 apart in x, a real curve difference).
const CLASSIC_TX_ENTER_CSS = `
@keyframes classic-tx-enter-kf {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.classic-tx-enter { animation: classic-tx-enter-kf var(--d-4) ease-out; }
`;

export function ClassicTxFeed({ mempool, onPickTx, thr, trackedTxId, status }: any) {
  const rows = mempool.slice(0, 14);
  const reduceMotion = useReducedMotion();

  // Ids already rendered in a PRIOR commit — read during render (pure, safe
  // under React.StrictMode's double-invoke), written only from the effect
  // below (once per real commit, idempotent), so the two passes can't race.
  const seenIds = React.useRef<Set<string>>(new Set());
  const newIds = React.useMemo(() => {
    const fresh = new Set<string>();
    for (const t of rows) if (!seenIds.current.has(t.id)) fresh.add(t.id);
    return fresh;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mempool]);
  React.useEffect(() => {
    seenIds.current = new Set(rows.map((t: any) => t.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mempool]);

  return (
    <div className="classic-panel classic-txfeed" style={{
      background: "var(--surface-raised)", border: "1px solid var(--rule)",
      borderRadius: 8, padding: "var(--sp-3) var(--sp-3)",
    }}>
      <style>{CLASSIC_TX_ENTER_CSS}</style>
      <div className="classic-hd" style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--sp-2)" }}>
        <span className="mono" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-60)", display: "flex", alignItems: "center", gap: "var(--sp-2)" }}><NodeProvenance source="node" keys={["mempool"]} status={status} inline /> last {rows.length} tx in mempool</span>
        <span className="mono dim" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
          <span className="led pulse" style={{ background: "var(--g-50)", boxShadow: "0 0 4px var(--g-50)" }} /> streaming
        </span>
      </div>
      <div className="table-scroll"><div className="mp-txbody">
      <div style={{
        fontSize: "var(--fs-label)", letterSpacing: "0.14em", textTransform: "uppercase",
        color: "var(--ink-40)", padding: "var(--sp-1) var(--sp-2)", borderBottom: "1px solid var(--rule)",
      }} className="mono mp-txgrid">
        <span>TXID</span><span>Size</span><span>Fee · XMR</span><span>Pcn/B</span><span>Tier</span><span>Age</span>
      </div>
      <div>
        {rows.map((t: any) => {
          const tier = classicTierOf(t, thr);
          const entering = !reduceMotion && newIds.has(t.id);
          return (
            <div key={t.id} onClick={() => onPickTx(t.id)}
              data-tracked-tx={trackedTxId && trackedTxId === t.id ? t.id : undefined}
              className={"mp-txgrid" + (entering ? " classic-tx-enter" : "")}
              onAnimationEnd={(e) => e.currentTarget.classList.remove("classic-tx-enter")}
              style={{
                fontSize: "var(--fs-mono)", padding: "var(--sp-2) var(--sp-2)",
                borderBottom: "1px solid var(--line-d)",
                cursor: "pointer", transition: "background var(--d-2) var(--e-standard)", // D0651: 0.12s → --d-2 (nearest)
                fontFamily: "var(--f-mono)",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--line-d)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
              <span style={{ color: "var(--c-50)" }}>{ShortHash(t.id)}</span>
              <span style={{ color: "var(--ink-80)" }}>{fmtBytes(t.size)}</span>
              <span style={{ color: "var(--tk-accent)" }}>{t.fee.toFixed(7)}</span>
              <span style={{ color: "var(--ink-80)" }}>{Math.round(t.perB).toLocaleString()}</span>
              <span style={{ display: "flex", alignItems: "center", gap: "var(--sp-1)", color: tier.color, fontSize: "var(--fs-label)", letterSpacing: "0.14em" }}>
                <span style={{ width: 7, height: 7, borderRadius: 4, background: tier.color, boxShadow: "0 0 4px " + tier.color }} />
                {tier.label}
              </span>
              <span style={{ color: "var(--ink-60)" }}>{t.age}s</span>
            </div>
          );
        })}
      </div>
      </div></div>
    </div>
  );
}

export function ClassicLanding({ data, onPickTx, trackedTxId }: any) {
  const buckets = React.useMemo(() => classicBucketByTier(data.mempool), [data.mempool]);
  return (
    <div className="classic-landing" style={{ padding: "20px var(--sp-5) var(--sp-7)", display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
      <ClassicFeeHero buckets={buckets} xmrUsd={data.price || 0} />
      <ClassicCaption />
      <ClassicProjBlock buckets={buckets} mempool={data.mempool} height={data.height} data={data} />
      <ClassicFeeDepth buckets={buckets} />
      <ClassicTxFeed mempool={data.mempool} onPickTx={onPickTx} thr={buckets.thr} trackedTxId={trackedTxId} status={data.status} />
    </div>
  );
}

export function ClassicStat({ k, v, tone }: any) {
  return (
    <div style={{ padding: "var(--sp-3) var(--sp-3)", border: "1px solid var(--rule)", borderRadius: 6, background: "var(--surface-raised)" }}>
      <div className="kicker">{k}</div>
      <div className={"mono " + (tone === "acc" ? "acc" : "")} style={{ fontSize: 20, marginTop: "var(--sp-1)", fontWeight: 500 }}>{v}</div>
    </div>
  );
}
