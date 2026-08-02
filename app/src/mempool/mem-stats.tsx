// mempool/mem-stats.tsx — the ONE derivation of mempool telemetry (tx count,
// pool weight, oldest tx, median fee/B, fee-tier bands, next-block ETA), shared
// by every mempool surface (Reactor, Classic, Bridge, Sediment, Constellation,
// Terminal).
//
// Before this module, medianPerB existed four times (terminal.tsx, constellation.tsx,
// classic.tsx twice — once across the whole pool, once per fee tier inside a render
// loop), and the next-block ETA existed once, hardcoded to Classic's own 120s literal
// (CLASSIC_BLOCK_TARGET) instead of reading the node's real data.blockTarget. This
// repo has had an ALL-REAL-DATA invariant since v5.0.14 — a hardcoded number styled
// as a live reading is a bug, not a placeholder — so every figure here is derived
// from `data`, and the empty/not-ready case renders "—", never a fabricated 0.
//
// `useMemStats` is a pure derivation memoised on `data.mempool` (+ the handful of
// other fields it reads) — it must NEVER call `useTick`, or every consumer of
// `MemStatStrip` would re-render once a second. The one figure that legitimately
// ticks (the next-block countdown) is isolated in `BlockEta`, a leaf component that
// owns its own `useTick(1000)` so only its text re-renders each second — mirroring
// `classic.tsx`'s `ClassicEta` (classic.tsx:37-48), which this generalises.

import * as React from "react";
import type { MoneroLive, Tx } from "@/data/types";
import { fmtBytes, fmtN } from "@/data/types";
import { FEE_TIER_LABELS, feeTierIndex } from "@/data/map";
import { freshAt, hasData } from "@/data/feed-status";
import { Stat } from "@/design/primitives";
import { SkeletonBox } from "@/design/Skeleton";
import { useTick } from "@/design/ArtBackground";

export interface FeeBand {
  label: string;
  count: number;
  pct: number;
}

export interface MemStats {
  txCount: number;
  poolBytes: number;
  oldestAgeSec: number;
  medianPerB: number;
  feeBands: FeeBand[];
  /** Seconds until the next block is DUE on the node's live block-target.
   *  MAY BE NEGATIVE — see nextBlockEtaSec(). */
  nextBlockEtaSec: number;
  /** the tip is already older than blockTarget */
  overdue: boolean;
}

export const fmtMMSS = (sec: number): string => {
  const s = Math.max(0, Math.round(sec));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
};

/** Median of `tx.perB` — null-safe, even/odd handled. The one implementation. */
function medianOfPerB(txs: Tx[]): number {
  if (!txs.length) return 0;
  const sorted = txs.map((t) => t.perB).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Seconds since the tip's block, interpolated from the last snapshot to now —
 *  the same shape as classic.tsx's ClassicEta, generalised to read the node's
 *  real `data.blockTarget` instead of a hardcoded 120. Not memoised: callers
 *  that need a live countdown (BlockEta) call this fresh on every tick.
 *
 *  DELIBERATELY NOT FLOORED AT 0. Monero block arrival is a Poisson process, so
 *  running past the target is the ordinary case, not an anomaly — roughly a
 *  third of blocks do. A countdown clamped at zero parks on "0:00" and keeps
 *  asserting a block is due *now* for as long as the wait lasts, which is a
 *  fabricated reading of exactly the kind the ALL-REAL-DATA invariant exists to
 *  prevent. Callers render a negative value as "+0:37 overdue". */
function nextBlockEtaSec(data: MoneroLive): number {
  // Elapsed since the BLOCKS endpoint last answered — that is where
  // blocks[0].age comes from, so measuring from the feed-wide heartbeat
  // would keep the countdown moving on a snapshot that never arrived.
  const sinceTip = (data.blocks[0]?.age ?? 0) + Math.floor((Date.now() - freshAt(data.status.blocks)) / 1000);
  const target = data.blockTarget || 120;
  return target - sinceTip;
}

/** Pure derivation of mempool telemetry from `data`. Memoised on the fields it
 *  reads — does NOT call useTick, so consumers only re-render when the
 *  underlying snapshot actually changes. */
export function useMemStats(data: MoneroLive): MemStats {
  return React.useMemo<MemStats>(() => {
    const txs = data.mempool;
    const txCount = txs.length;

    const feeBands: FeeBand[] = FEE_TIER_LABELS.map((label) => ({ label, count: 0, pct: 0 }));
    if (txCount) {
      for (const t of txs) {
        const idx = feeTierIndex(t.perB, data.feeTiers);
        if (idx >= 0) feeBands[idx].count++;
      }
      for (const band of feeBands) band.pct = band.count / txCount;
    }

    return {
      txCount,
      poolBytes: txs.reduce((a, t) => a + t.size, 0),
      oldestAgeSec: txCount ? Math.max(...txs.map((t) => t.age)) : 0,
      medianPerB: medianOfPerB(txs),
      feeBands,
      nextBlockEtaSec: nextBlockEtaSec(data),
      overdue: nextBlockEtaSec(data) < 0,
    };
  }, [data.mempool, data.feeTiers, data.blocks, data.status, data.blockTarget]);
}

/** The ticking next-block countdown. Isolated so only this text re-renders
 *  each second — the ribbon/strip around it stays untouched. `offsetSec`
 *  shifts a further-out queued slot one block-target past the imminent one
 *  (mirrors classic.tsx's QUEUED vs NEXT cards). */
export function BlockEta({ data, offsetSec = 0 }: { data: MoneroLive; offsetSec?: number }): JSX.Element {
  // `{ motion: false }` because this is a real MM:SS countdown, not decoration.
  // v6.0.8 made `useTick` tier-aware and reduced-motion-aware by default: a
  // plain `useTick(1000)` here would FREEZE under prefers-reduced-motion, and a
  // countdown frozen at "1:47" is a clock that lies. The opt-out keeps the
  // cadence exact on every tier; it is still paused while the tab is hidden and
  // still fires one tick immediately on return, so nothing is wasted either.
  useTick(1000, { motion: false });
  if (!hasData(data.status.network)) return <>—</>;
  const eta = nextBlockEtaSec(data) + offsetSec;
  // Overdue is normal for Poisson arrivals, so say so rather than parking on
  // "0:00" — the reading stays true for as long as the wait lasts.
  if (eta < 0) return <span className="warn" style={{ color: "var(--y-50)" }}>+{fmtMMSS(-eta)} overdue</span>;
  return <>{fmtMMSS(eta)}</>;
}

/** Dense five-figure strip: mempool count, pool weight, oldest tx age, median
 *  fee/B, next-block ETA. `compact` collapses it to a single inline row for
 *  views with little chrome budget (Reactor, Terminal). Renders "—" — never a
 *  fabricated 0 — while `!hasData(data.status.network)` or the pool is empty. */
export function MemStatStrip({ data, compact }: { data: MoneroLive; compact?: boolean }): JSX.Element {
  const stats = useMemStats(data);
  // txCount/poolBytes are honest zeros for an empty pool (there really are 0
  // txs); medianPerB/oldestAgeSec have no defined value over an empty set, so
  // both gate on emptiness too — treat the whole mempool-derived group
  // uniformly to avoid a strip that half-shows numbers, half-shows dashes.
  const poolReady = hasData(data.status.network) && stats.txCount > 0;
  const dash = "—";

  /* D0851 · the fourth skeleton surface, and the narrowest of the four.
     The <Stat> boxes are ALREADY box-exact: `.stat .val` is `font: 18px/1.1`,
     so the line box is fixed whatever the content, and an inline-block
     placeholder of 0.8em is zero-CLS by construction. Nothing needs reserving.

     What was missing is the DISTINCTION. A dash meant three different things:
     still arriving, answered-and-empty, and endpoint dead. Only the first is a
     skeleton. Shimmering a dead endpoint would claim "arriving" about something
     that is not coming — the fabrication rule applied to motion rather than to
     a number. So: phase "loading" (never answered, not yet failed) shimmers;
     everything else keeps the honest em-dash. */
  const arriving = data.status.network.phase === "loading";
  const pending = (w: number) =>
    arriving ? <SkeletonBox w={w} h="0.8em" style={{ display: "inline-block", verticalAlign: "-0.05em" }} /> : dash;

  if (compact) {
    return (
      <div
        className="mono dim"
        style={{ display: "flex", alignItems: "center", gap: 14, fontSize: "var(--fs-label)", flexWrap: "wrap" }}
      >
        <span>
          <span className="acc" data-memstat="mempool" data-memstat-value={poolReady ? stats.txCount : ""}>{poolReady ? fmtN(stats.txCount) : dash}</span> mempool
        </span>
        <span data-memstat="bytes" data-memstat-value={poolReady ? stats.poolBytes : ""}>{poolReady ? fmtBytes(stats.poolBytes) : dash}</span>
        <span data-memstat="oldest" data-memstat-value={poolReady ? stats.oldestAgeSec : ""}>{poolReady ? `${stats.oldestAgeSec}s oldest` : dash}</span>
        <span data-memstat="median" data-memstat-value={poolReady ? Math.round(stats.medianPerB) : ""}>{poolReady ? `${Math.round(stats.medianPerB).toLocaleString()} pcn/B med` : dash}</span>
        <span style={{ color: "var(--p-50)" }} data-memstat="eta" data-memstat-value={hasData(data.status.network) ? stats.nextBlockEtaSec : ""}>
          {hasData(data.status.network) ? <BlockEta data={data} /> : dash} next block
        </span>
      </div>
    );
  }

  return (
    <section className="mem-stat-strip" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
      {/* `display: contents` keeps the inner .stat as the grid item, so these
          hooks add no layout box.
          data-memstat names the figure; data-memstat-value carries the RAW
          number. verify-memstats.mjs compares the raw values, not the rendered
          text, because each view is free to format in its own idiom — Terminal
          zero-pads its tx count to "038" where the strip renders "38". Those
          are the same reading, and the gate has to be able to say so. */}
      <div data-memstat="mempool" data-memstat-value={poolReady ? stats.txCount : ""} style={{ display: "contents" }}>
        <Stat k="MEMPOOL" v={poolReady ? fmtN(stats.txCount) : pending(38)} sub="txs" tone="acc" />
      </div>
      <div data-memstat="bytes" data-memstat-value={poolReady ? stats.poolBytes : ""} style={{ display: "contents" }}>
        <Stat k="WEIGHT" v={poolReady ? fmtBytes(stats.poolBytes) : pending(56)} sub="pool" />
      </div>
      <div data-memstat="oldest" data-memstat-value={poolReady ? stats.oldestAgeSec : ""} style={{ display: "contents" }}>
        <Stat k="OLDEST" v={poolReady ? `${stats.oldestAgeSec}s` : pending(44)} sub="age" />
      </div>
      <div data-memstat="median" data-memstat-value={poolReady ? Math.round(stats.medianPerB) : ""} style={{ display: "contents" }}>
        <Stat k="MEDIAN" v={poolReady ? Math.round(stats.medianPerB).toLocaleString() : pending(52)} sub="pcn/B" />
      </div>
      <div data-memstat="eta" data-memstat-value={hasData(data.status.network) ? stats.nextBlockEtaSec : ""} style={{ display: "contents" }}>
        <Stat k="NEXT BLOCK" v={hasData(data.status.network) ? <BlockEta data={data} /> : pending(48)} sub="eta" tone="p" />
      </div>
    </section>
  );
}
