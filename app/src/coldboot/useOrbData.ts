/**
 * coldboot/useOrbData.ts — the three data tiers `./Orb.tsx` assembles into
 * an `OrbState` (`./orb.ts`) each frame.
 *
 *   T1 · LIVE          — `useNodePopulation()`. Narrowed on `status` before
 *                         any numeric field is read. Never null-coalesced —
 *                         see the note below.
 *   T2 · REAL EVENT,    — `useFeedEvents(data)`'s `kind:"block"` entries,
 *       UNKNOWABLE         passed through untouched. This hook does not
 *       ORIGIN             build the ripple (no node is ever attached to a
 *                           block event anywhere in this file) — `./orb.ts`
 *                           and `./Orb.tsx` do that, deliberately without an
 *                           origin. See `./orb.ts`'s header.
 *   T3 · ILLUSTRATIVE   — this hook surfaces the real `kind:"tx"` arrivals
 *                         that time/count it; `./Orb.tsx` is what actually
 *                         spawns a stem per new tx id (it owns the
 *                         animation clock those events are stamped against,
 *                         which this hook — plain data derivation, no rAF,
 *                         no seconds — does not have).
 *
 * ── WHY THIS HOOK DOES NOT BUILD OrbEvent[] ITSELF ─────────────────────────
 * A `StemOrbEvent`/`BlockOrbEvent` carries `t0` in ANIMATION-SECONDS — the
 * same clock `orb.ts#drawOrb`'s `seconds` argument uses, driven by
 * `useAnimationSeconds` (paused while hidden/off-screen). This hook has no
 * such clock: it is plain `useSyncExternalStore`/`useState` derivation, with
 * no rAF anywhere in it. Stamping a spawn time in the wrong clock space (this
 * hook reaching for `Date.now()`, say) would desync every event's progress
 * from what the canvas is actually drawing. So this hook hands back the RAW,
 * already-real `FeedEvent`s for block/tx kinds, and `./Orb.tsx` — which owns
 * `useAnimationSeconds` — is where a new source event becomes a timed
 * `OrbEvent`.
 *
 * ── THE COMPILE ERROR THAT MUST STAY A COMPILE ERROR ───────────────────────
 * `NodePopulationUnavailable` carries no `counts`/`split`/`height` at all —
 * absent from the wire body, not zeroed (`@/data/useNodePopulation.ts:101-106`).
 * Reading `nodePop.data.counts.reachable` without first narrowing
 * `status !== "unavailable"` is therefore a TypeScript error, not a runtime
 * one, and every read below narrows before touching a numeric field. No
 * `?? 0` / `|| 0` / non-null assertion appears anywhere in this file: a real
 * "reachable: 0" (the census answered and reports zero) must stay
 * distinguishable from "reachable: null" (nothing real to show), and folding
 * the second into the first would be exactly the fabrication CLAUDE.md bans.
 */

import * as React from "react";
import type { MoneroLive } from "@/data/types";
import type { FeedPhase } from "@/data/feed-status";
import { useNodePopulation } from "@/data/useNodePopulation";
import { useFeedEvents, type FeedEvent } from "@/data/useFeedEvents";
import { buildOrbLattice, orbNodeCount, type OrbNode } from "./orb";

/** Fixed, not derived from anything live — the lattice's own seed just needs
 *  to be stable across reloads so a given `count` always draws the same
 *  relative arrangement (screenshot-diffable in a fixture-mocked run; a real
 *  live run can still change the DOT COUNT as `counts.reachable` moves,
 *  which is expected and not a determinism defect — see `./orb.ts`'s
 *  sample-not-identity note). */
const LATTICE_SEED = 20260803;

export type FeedTxEvent = Extract<FeedEvent, { kind: "tx" }>;
export type FeedBlockEvent = Extract<FeedEvent, { kind: "block" }>;

export interface OrbData {
  /** `counts.reachable`, or `null` when there is nothing real to show
   *  (loading / error / wire-level "unavailable"). This is the number a
   *  caption may print; it is never the dot count. */
  readonly reachable: number | null;
  readonly seen: number | null;
  /** For `<NodeProvenance source="network" phase={...}>` — computed, never a
   *  literal `"live"`. */
  readonly phase: FeedPhase;
  /** The rendered lattice for this frame. Empty exactly when `reachable` is
   *  `null` or the live payload has nothing to scale from (`split.total` or
   *  `counts.reachable` at or below zero). */
  readonly nodes: readonly OrbNode[];
  /** `nodes.length` — exposed separately so a caption doesn't need to import
   *  `./orb.ts`'s `OrbNode` shape just to read a count. */
  readonly latticeSize: number;
  /** Real block arrivals since mount (bounded by `useFeedEvents`'s own cap).
   *  No node is attached to any of these — see this file's header. */
  readonly blockFeedEvents: readonly FeedBlockEvent[];
  /** Real mempool tx arrivals — the timing/count source for T3's stems. */
  readonly txFeedEvents: readonly FeedTxEvent[];
}

function isTx(e: FeedEvent): e is FeedTxEvent {
  return e.kind === "tx";
}
function isBlock(e: FeedEvent): e is FeedBlockEvent {
  return e.kind === "block";
}

export function useOrbData(data: MoneroLive): OrbData {
  const nodePop = useNodePopulation();
  const events = useFeedEvents(data);

  const ok = !!nodePop.data && nodePop.data.status !== "unavailable";

  const nodes = React.useMemo<readonly OrbNode[]>(() => {
    if (!nodePop.data || nodePop.data.status === "unavailable") return [];
    const { counts, split, height } = nodePop.data;
    if (split.total <= 0 || counts.reachable <= 0) return [];
    return buildOrbLattice({
      count: orbNodeCount(counts.reachable),
      clearFrac: split.clear / split.total,
      torFrac: split.tor / split.total,
      // `height.lagging` is ALREADY the `lag > 2` filtered set, computed
      // server-side (api/nodes.js's `heightClusters`) — reused as-is, not
      // re-thresholded, for the same reason `NodePopulationPanel.tsx`'s
      // `heightAgreementPct` formula is reused rather than re-derived.
      lagFrac: height.lagging.count / counts.reachable,
      seed: LATTICE_SEED,
    });
  }, [nodePop.data]);

  const blockFeedEvents = React.useMemo(() => events.filter(isBlock), [events]);
  const txFeedEvents = React.useMemo(() => events.filter(isTx), [events]);

  const reachable = ok && nodePop.data && nodePop.data.status !== "unavailable" ? nodePop.data.counts.reachable : null;
  const seen = ok && nodePop.data && nodePop.data.status !== "unavailable" ? nodePop.data.counts.seen : null;

  return {
    reachable,
    seen,
    phase: nodePop.status,
    nodes,
    latticeSize: nodes.length,
    blockFeedEvents,
    txFeedEvents,
  };
}
