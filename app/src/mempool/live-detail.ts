// mempool/live-detail.ts — React fetch hooks for REAL tx / block / decoy detail.
//
// The pure mappers + view-model types live in detail-map.ts (React-free, so the
// tx-detail mapper is unit-testable under plain node). This module adds the
// fetch + state machinery: each hook owns loading/error state and recomputes the
// view (and thus confOf-based confirmations) on every render, so the count stays
// live as the chain tip advances without refetching.

import * as React from "react";
import { getJSON } from "@/data/http";
import { confOf, chainTip } from "@/mempool/conf";
import type { MoneroLive } from "@/data/types";
import {
  mapTxDetail,
  mapBlockDetail,
  mapDecoys,
  txBlockHeight,
  type ApiTxDetail,
  type ApiBlockDetail,
  type ApiDecoys,
  type RealTxView,
  type RealBlockView,
  type DecoyInputView,
} from "@/mempool/detail-map";

// Re-export the view types so existing imports (`from "@/mempool/live-detail"`) keep working.
export type { RealTxView, RealBlockView, DecoyInputView, DecoyRingMember } from "@/mempool/detail-map";

export interface TxDetailResult {
  status: "loading" | "ready" | "error";
  tx: RealTxView | null;
}

const TXID_RE = /^[0-9a-f]{64}$/i;
/** Fallback re-poll cadence while a tracked tx is still pending (a tip update missed). */
const PENDING_POLL_MS = 15_000;

interface TxRawState {
  raw: ApiTxDetail | null;
  status: "loading" | "ready" | "error";
}

/**
 * Shared fetch state machine for /api/xmr/tx/<txid>. Fetch ONCE, then RE-FETCH while
 * the tx is still unconfirmed:
 *   • immediately when the chain tip advances (a new block may have mined it), and
 *   • on a ~15s fallback timer (covers a tx mined into a block we already saw, or a
 *     node that briefly lags the tip we observe).
 * STOP permanently once raw.confirmed === true — a confirmed tx's block height is
 * fixed (Monero reorgs are negligible), and confOf then recomputes the live count
 * every render with no further fetch. Both useLiveTx (detail) and useTrackedTxHeight
 * (ribbon) consume this, so the two surfaces resolve the SAME node-reported height.
 */
function useTxRaw(txid: string, data: MoneroLive): TxRawState {
  const [state, setState] = React.useState<TxRawState>({ raw: null, status: "loading" });

  // Still pending? Drives whether the tip-advance / interval effects fetch at all.
  const pending = state.status !== "ready" || state.raw?.confirmed !== true;
  // The tip PRIMITIVE — NOT `data`. A fresh MoneroLive lands every ~2.5s poll, but the
  // tip only changes when a block is mined, which is exactly when to re-fetch a pending tx.
  const tip = chainTip(data);

  // (A) Reset + initial fetch — keyed on txid ONLY. Only this effect sets error / wipes
  //     the last-good raw (re-polls below keep last-good on a transient miss).
  React.useEffect(() => {
    let alive = true;
    setState({ raw: null, status: "loading" });
    if (!TXID_RE.test(txid)) {
      setState({ raw: null, status: "error" });
      return;
    }
    getJSON<ApiTxDetail>(`/api/xmr/tx/${txid}`).then((r) => {
      if (!alive) return;
      if (r && r.txid) setState({ raw: r, status: "ready" });
      else setState({ raw: null, status: "error" });
    });
    return () => { alive = false; };
  }, [txid]);

  // (B) Re-fetch when the tip ADVANCES while pending. The tipAtMount ref makes this a
  //     pure "tip changed" trigger, so it never duplicates (A)'s initial fetch on mount.
  const tipAtMount = React.useRef(tip);
  React.useEffect(() => {
    if (tip === tipAtMount.current) return; // first run / no advance → leave to (A)
    tipAtMount.current = tip;
    if (!pending || !TXID_RE.test(txid)) return;
    let alive = true;
    getJSON<ApiTxDetail>(`/api/xmr/tx/${txid}`).then((r) => {
      if (!alive || !r || !r.txid) return; // transient miss → keep last-good
      setState({ raw: r, status: "ready" });
    });
    return () => { alive = false; };
  }, [txid, tip, pending]);

  // (C) Fallback interval while pending. `tip` is deliberately NOT a dep — including it
  //     would re-arm the timer on every 2.5s poll so it could never fire.
  React.useEffect(() => {
    if (!pending || !TXID_RE.test(txid)) return;
    let alive = true;
    const id = setInterval(() => {
      getJSON<ApiTxDetail>(`/api/xmr/tx/${txid}`).then((r) => {
        if (!alive || !r || !r.txid) return; // transient miss → keep last-good
        setState({ raw: r, status: "ready" });
      });
    }, PENDING_POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, [txid, pending]);

  return state;
}

export function useLiveTx(txid: string, data: MoneroLive): TxDetailResult {
  const { raw, status } = useTxRaw(txid, data);
  // Recompute the view (and thus confirmations via confOf) every render so the count
  // stays live as the tip advances — no refetch once confirmed. The height is the REAL
  // one the node reports (txBlockHeight), so the panel matches the ribbon and a public
  // explorer; header "in block #H" and the count derive from that one height.
  const tx = raw ? mapTxDetail(raw, confOf(txBlockHeight(raw), data)) : null;
  return { status, tx };
}

export interface TrackedTxHeight {
  /** the REAL block height the node reports — null while pending, real once mined */
  blockHeight: number | null;
  inMempool: boolean;
  status: "loading" | "ready" | "error";
}

/**
 * Resolve (and keep live) the REAL block height a tracked tx landed in, via the shared
 * useTxRaw core: re-polled while pending, frozen once mined. Hoisted into
 * useMempoolTracking and written into tracking.blockHeight so the ribbon arrow and the
 * detail panel read ONE height — never the old hash-derived guess.
 */
export function useTrackedTxHeight(txid: string, data: MoneroLive): TrackedTxHeight {
  const { raw, status } = useTxRaw(txid, data);
  return {
    blockHeight: raw ? txBlockHeight(raw) : null,
    inMempool: raw ? (!raw.confirmed || raw.in_pool === true) : false,
    status,
  };
}

export interface BlockDetailResult {
  status: "loading" | "ready" | "error";
  block: RealBlockView | null;
}

export function useLiveBlock(height: number, data: MoneroLive): BlockDetailResult {
  const [raw, setRaw] = React.useState<ApiBlockDetail | null>(null);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");

  React.useEffect(() => {
    let alive = true;
    setRaw(null);
    if (!Number.isFinite(height) || height < 0) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    getJSON<ApiBlockDetail>(`/api/xmr/block/${height}`).then((r) => {
      if (!alive) return;
      if (r && r.hash) {
        setRaw(r);
        setStatus("ready");
      } else {
        setStatus("error");
      }
    });
    return () => {
      alive = false;
    };
  }, [height]);

  const known = raw ? data.blocks.find((b) => b.height === raw.height) : undefined;
  const block = raw ? mapBlockDetail(raw, confOf(raw.height, data), known ? known.reward : null) : null;
  return { status, block };
}

export interface DecoysResult {
  status: "idle" | "loading" | "ready" | "error";
  tipHeight: number | null;
  inputs: DecoyInputView[] | null;
}

/**
 * Real ring-decoy ages via /api/xmr/decoys/<txid> (resolves each ring member's
 * on-chain block height through a batched /get_outs). Lazy: only fetches when
 * `enabled` (e.g. the Inputs section is expanded), since it costs an extra RPC.
 */
export function useLiveDecoys(txid: string, enabled: boolean): DecoysResult {
  const [state, setState] = React.useState<DecoysResult>({ status: "idle", tipHeight: null, inputs: null });

  React.useEffect(() => {
    if (!enabled) return;
    if (!/^[0-9a-f]{64}$/i.test(txid)) {
      setState({ status: "error", tipHeight: null, inputs: null });
      return;
    }
    let alive = true;
    setState({ status: "loading", tipHeight: null, inputs: null });
    getJSON<ApiDecoys>(`/api/xmr/decoys/${txid}`).then((r) => {
      if (!alive) return;
      if (r && Array.isArray(r.inputs)) {
        setState({ status: "ready", tipHeight: r.tip_height ?? null, inputs: mapDecoys(r) });
      } else {
        setState({ status: "error", tipHeight: null, inputs: null });
      }
    });
    return () => {
      alive = false;
    };
  }, [txid, enabled]);

  return state;
}
