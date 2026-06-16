/**
 * data/useFeedEvents.ts — derive a real event stream from the live feed.
 *
 * Log/tape surfaces (terminal log, constellation propagation log, bridge alert
 * tape) render REAL happenings: they diff consecutive MoneroLive snapshots and
 * emit an event per new block, per newly-seen mempool tx, per batch of txs that
 * left the pool, and on stale/recover edges. Every field on every event comes
 * from the node — formatting (log-line text, colors) stays in each consumer.
 *
 * The first successful snapshot primes the differ WITHOUT emitting, so there is
 * never a fabricated backlog on mount.
 */

import * as React from "react";
import type { MoneroLive } from "./types";

export type FeedEvent =
  | { kind: "block"; ts: number; height: number; hash: string; txs: number; sizeKB: number; reward: number }
  | { kind: "tx"; ts: number; id: string; size: number; fee: number; perB: number }
  | { kind: "txdrop"; ts: number; count: number }
  | { kind: "stale"; ts: number }
  | { kind: "recover"; ts: number };

/** Max tx events emitted per poll tick (a burst of arrivals stays readable). */
const TX_EVENTS_PER_TICK = 8;

export function useFeedEvents(data: MoneroLive, cap = 40): FeedEvent[] {
  const [events, setEvents] = React.useState<FeedEvent[]>([]);
  const ref = React.useRef<{ tipHeight: number; txIds: Set<string>; stale: boolean; primed: boolean }>({
    tipHeight: 0,
    txIds: new Set(),
    stale: false,
    primed: false,
  });

  React.useEffect(() => {
    const prev = ref.current;
    const fresh: FeedEvent[] = [];
    const now = Date.now();

    // stale/recover edges fire even before the differ is primed
    if (data.ready && data.stale !== prev.stale) {
      fresh.push({ kind: data.stale ? "stale" : "recover", ts: now });
      prev.stale = data.stale;
    }

    if (data.ready && !data.stale) {
      if (!prev.primed) {
        // First real snapshot: seed the differ silently (no fake backlog).
        prev.tipHeight = data.height;
        prev.txIds = new Set(data.mempool.map((t) => t.id));
        prev.primed = true;
      } else {
        for (const b of data.blocks) {
          if (b.height > prev.tipHeight) {
            fresh.push({ kind: "block", ts: now, height: b.height, hash: b.hash, txs: b.txs, sizeKB: b.sizeKB, reward: b.reward });
          }
        }
        prev.tipHeight = Math.max(prev.tipHeight, data.height);

        const current = new Set(data.mempool.map((t) => t.id));
        let emitted = 0;
        for (const t of data.mempool) {
          if (!prev.txIds.has(t.id) && emitted < TX_EVENTS_PER_TICK) {
            fresh.push({ kind: "tx", ts: now, id: t.id, size: t.size, fee: t.fee, perB: t.perB });
            emitted++;
          }
        }
        let dropped = 0;
        for (const id of prev.txIds) if (!current.has(id)) dropped++;
        if (dropped > 0) fresh.push({ kind: "txdrop", ts: now, count: dropped });
        prev.txIds = current;
      }
    }

    if (fresh.length) {
      setEvents((old) => [...fresh.reverse(), ...old].slice(0, cap));
    }
    // Diff exactly once per feed tick (lastUpdate) and on stale edges.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.lastUpdate, data.stale]);

  return events;
}
