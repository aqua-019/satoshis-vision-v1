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
 * TEST-ONLY (as of v5.0.15): a deterministic, hash-derived block-height generator.
 *
 * The production tracked-tx path NO LONGER guesses a tx's block from its hash — a
 * typed txid's block is unknown until the node answers, so useTrackedTxHeight /
 * useLiveTx resolve the REAL height from /api/xmr/tx (re-polled while pending). This
 * helper is retained solely because verify-confirmations.mjs uses it to manufacture a
 * spread of pinned heights when exercising the confOf invariant. Do NOT call it from
 * any UI path. Returns null for a mempool tx (or when there are no blocks yet).
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

/**
 * The single canonical tip for counting confirmations: the newest CONFIRMED
 * block height. This MUST be the same tip map.ts mapBlocks() uses for
 * toBlock().conf (data.blocks[0].height) — NOT data.height.
 *
 * data.height is monerod get_info.height = chain length = newest block + 1, so
 * using it as the tip yields a confirmation count that is +1 vs the ribbon block
 * label. chainTip() resolves that off-by-one by always counting from the newest
 * block. It falls back to data.height only before any blocks have loaded.
 */
export function chainTip(data: MoneroLive): number {
  return data.blocks[0]?.height ?? data.height;
}

/**
 * Confirmations for a (pinned) block height against the canonical tip — the ONE
 * accessor every mempool surface must use. By construction this equals
 * map.ts toBlock().conf for any confirmed block, so the ribbon label, the
 * tracked-arrow badge, and the tx-detail panel can never disagree.
 */
export function confOf(blockHeight: number | null, data: MoneroLive): number {
  return liveConf(blockHeight, chainTip(data));
}
