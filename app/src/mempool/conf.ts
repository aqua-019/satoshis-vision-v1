// mempool/conf.ts — single source of truth for tracked-tx confirmation logic.
//
// Every mempool surface (Reactor, Classic, Bridge, Sediment, Constellation,
// Terminal, and the /mempool/tx deep-link) must agree on:
//   1. WHICH block a tracked tx landed in (a tx does not hop blocks), and
//   2. HOW MANY confirmations it has (derived LIVE from the current tip).
//
// Before this module there were three divergent derivations (classicLookupTx,
// txSynthFromId, buildTrackedTx) — different hash functions, different index
// rules, and a `confirmations` value FROZEN at lookup time. Because the blocks
// array re-derives every tick (newest unshifted to front), an index into it
// points at a DIFFERENT block over time → the tx appeared to hop blocks and the
// count disagreed with the ribbon arrow.
//
// The fix: pin the ABSOLUTE block height ONCE (deterministically from the txid +
// the snapshot at search time), store only that height, and recompute
// confirmations every render via `liveConf` — the same formula map.ts uses in
// toBlock(): conf = Math.max(1, tip - height + 1). No second formula anywhere.

import type { MoneroLive } from "@/data/types";

/** FNV-1a 32-bit hash of a txid. Identical to tx-detail.tsx's former `_hash32`. */
export function txHash32(id: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

/** Deterministically decide whether a txid is (still) sitting in the mempool. */
export function isMempoolTx(id: string): boolean {
  return (txHash32(id) & 7) === 0;
}

/**
 * Pin the ABSOLUTE block height a (non-mempool) tx landed in, resolved from the
 * CURRENT snapshot. Call this ONCE (at search/track time) and store the result;
 * do NOT call it every tick or the pin would slide with the blocks window.
 * Returns null for a mempool tx (or when there are no blocks yet).
 */
export function pinTxBlockHeight(id: string, data: MoneroLive): number | null {
  if (isMempoolTx(id) || !data.blocks.length) return null;
  const idx = txHash32(id) % Math.min(data.blocks.length, 9);
  return data.blocks[idx]?.height ?? null;
}

/**
 * The ONE live confirmation formula — mirrors map.ts toBlock().conf exactly.
 * `blockHeight === null` means the tx is unconfirmed (in mempool) → 0 conf.
 */
export function liveConf(blockHeight: number | null, tipHeight: number): number {
  return blockHeight == null ? 0 : Math.max(1, tipHeight - blockHeight + 1);
}
