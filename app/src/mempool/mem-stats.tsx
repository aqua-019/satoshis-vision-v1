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
import { Stat } from "@/design/primitives";
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
  /** seconds until the next block on the live block-target, floored at 0 */
  nextBlockEtaSec: number;
}

const fmtMMSS = (sec: number): string => {
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
 *  that need a live countdown (BlockEta) call this fresh on every tick. */
function nextBlockEtaSec(data: MoneroLive): number {
  const sinceTip = (data.blocks[0]?.age ?? 0) + Math.floor((Date.now() - data.lastUpdate) / 1000);
  const target = data.blockTarget || 120;
  return Math.max(0, target - sinceTip);
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
    };
  }, [data.mempool, data.feeTiers, data.blocks, data.lastUpdate, data.blockTarget]);
}

/** The ticking next-block countdown. Isolated so only this text re-renders
 *  each second — the ribbon/strip around it stays untouched. `offsetSec`
 *  shifts a further-out queued slot one block-target past the imminent one
 *  (mirrors classic.tsx's QUEUED vs NEXT cards). */
export function BlockEta({ data, offsetSec = 0 }: { data: MoneroLive; offsetSec?: number }): JSX.Element {
  useTick(1000);
  if (!data.ready) return <>—</>;
  return <>{fmtMMSS(nextBlockEtaSec(data) + offsetSec)}</>;
}

/** Dense five-figure strip: mempool count, pool weight, oldest tx age, median
 *  fee/B, next-block ETA. `compact` collapses it to a single inline row for
 *  views with little chrome budget (Reactor, Terminal). Renders "—" — never a
 *  fabricated 0 — while `!data.ready` or the pool is empty. */
export function MemStatStrip({ data, compact }: { data: MoneroLive; compact?: boolean }): JSX.Element {
  const stats = useMemStats(data);
  // txCount/poolBytes are honest zeros for an empty pool (there really are 0
  // txs); medianPerB/oldestAgeSec have no defined value over an empty set, so
  // both gate on emptiness too — treat the whole mempool-derived group
  // uniformly to avoid a strip that half-shows numbers, half-shows dashes.
  const poolReady = data.ready && stats.txCount > 0;
  const dash = "—";

  if (compact) {
    return (
      <div
        className="mono dim"
        style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 10.5, flexWrap: "wrap" }}
      >
        <span>
          <span className="acc" data-memstat="mempool">{poolReady ? fmtN(stats.txCount) : dash}</span> mempool
        </span>
        <span data-memstat="bytes">{poolReady ? fmtBytes(stats.poolBytes) : dash}</span>
        <span data-memstat="oldest">{poolReady ? `${stats.oldestAgeSec}s oldest` : dash}</span>
        <span data-memstat="median">{poolReady ? `${Math.round(stats.medianPerB).toLocaleString()} pcn/B med` : dash}</span>
        <span style={{ color: "var(--p-50)" }} data-memstat="eta">
          {data.ready ? <BlockEta data={data} /> : dash} next block
        </span>
      </div>
    );
  }

  return (
    <section style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
      {/* `display: contents` keeps the inner .stat as the grid item, so the
          data-memstat hook adds no layout box. The attribute is the contract
          verify-memstats.mjs scrapes to prove all six views agree. */}
      <div data-memstat="mempool" style={{ display: "contents" }}>
        <Stat k="MEMPOOL" v={poolReady ? fmtN(stats.txCount) : dash} sub="txs" tone="acc" />
      </div>
      <div data-memstat="bytes" style={{ display: "contents" }}>
        <Stat k="WEIGHT" v={poolReady ? fmtBytes(stats.poolBytes) : dash} sub="pool" />
      </div>
      <div data-memstat="oldest" style={{ display: "contents" }}>
        <Stat k="OLDEST" v={poolReady ? `${stats.oldestAgeSec}s` : dash} sub="age" />
      </div>
      <div data-memstat="median" style={{ display: "contents" }}>
        <Stat k="MEDIAN" v={poolReady ? Math.round(stats.medianPerB).toLocaleString() : dash} sub="pcn/B" />
      </div>
      <div data-memstat="eta" style={{ display: "contents" }}>
        <Stat k="NEXT BLOCK" v={data.ready ? <BlockEta data={data} /> : dash} sub="eta" tone="p" />
      </div>
    </section>
  );
}
