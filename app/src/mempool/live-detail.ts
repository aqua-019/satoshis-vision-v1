// mempool/live-detail.ts — React fetch hooks for REAL tx / block / decoy detail.
//
// The pure mappers + view-model types live in detail-map.ts (React-free, so the
// tx-detail mapper is unit-testable under plain node). This module adds the
// fetch + state machinery: each hook owns loading/error state and recomputes the
// view (and thus confOf-based confirmations) on every render, so the count stays
// live as the chain tip advances without refetching.

import * as React from "react";
import { getJSON } from "@/data/http";
import { confOf } from "@/mempool/conf";
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
  /** shown while loading, from the click that opened the panel */
  optimisticHeight: number | null;
  optimisticConf: number;
}

export function useLiveTx(
  txid: string,
  data: MoneroLive,
  pinnedHeight?: number | null,
): TxDetailResult {
  const [raw, setRaw] = React.useState<ApiTxDetail | null>(null);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");

  React.useEffect(() => {
    let alive = true;
    setRaw(null);
    if (!/^[0-9a-f]{64}$/i.test(txid)) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    getJSON<ApiTxDetail>(`/api/xmr/tx/${txid}`).then((r) => {
      if (!alive) return;
      if (r && r.txid) {
        setRaw(r);
        setStatus("ready");
      } else {
        setStatus("error");
      }
    });
    return () => {
      alive = false;
    };
  }, [txid]);

  // Recompute the view (and thus confirmations via confOf) every render so the
  // count stays live as the tip advances — no refetch needed.
  const tx = raw ? mapTxDetail(raw, confOf(txBlockHeight(raw), data)) : null;
  const optimisticHeight = pinnedHeight ?? null;
  return { status, tx, optimisticHeight, optimisticConf: confOf(optimisticHeight, data) };
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
