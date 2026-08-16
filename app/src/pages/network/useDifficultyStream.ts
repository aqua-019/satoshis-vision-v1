/**
 * pages/network/useDifficultyStream.ts — the ONLY network-aware module in the
 * D0828 streaming-difficulty path.
 *
 * `diffBuffer.ts` beside this file imports nothing and knows nothing about the
 * wire. This file is where the wire lives, and it is deliberately the only
 * place: everything it does ends in one call to `buffer.ingest(points)`.
 *
 * ── WHY THIS IS PAGE-LOCAL AND NOT A NEW `FeedKey` ────────────────────────
 *
 * The obvious home would be `data/xmrirish-feed.ts` with a fifth `FeedKey`.
 * It is the wrong home, measured rather than assumed: `xmrirish-feed.ts` is
 * EAGER — `App.tsx` imports `data/DataContext`, which imports it, and the
 * topbar's live chrome (`NavTop`, `Footer`, `NetRail`) consumes it too. The
 * built entry chunk carries all three of the feed's endpoint literals. A new
 * FeedKey would additionally touch eager `feed-status.ts` (STALE_AFTER,
 * BOOT_OBS, deriveAll). This route is lazy and this series is read on exactly
 * one page, so the cost belongs on that page's chunk.
 *
 * The TIER DISCIPLINE is not skipped, it is reused: `usePolling("chain", …)`
 * is the same primitive the feed's own chain tier runs on, imported directly.
 * Using it from a lazy page is legitimate — the rule it enforces is cadence,
 * and cadence is not a property of who calls it.
 *
 * ── SEED ONCE, APPEND FOREVER, RE-SEED ONLY ON A GAP ──────────────────────
 *
 * · SEED — one `/api/xmr/network/difficulty` request gives real past history
 *   immediately, so the chart is never a slowly-filling session buffer the way
 *   the hashrate panel beside it honestly has to be.
 * · APPEND — every chain tick already fetches `/api/xmr/blocks?limit=100`, and
 *   every header in it carries `timestamp` and `difficulty`. Appending from
 *   that costs ZERO new requests. This is why the chain tier's cadence is
 *   inherited for free rather than argued for.
 * · RE-SEED — only when `ingest()` reports a `gap`, mirroring the
 *   `first || advanced || floorDue` gating in `xmrirish-feed.ts`'s chainTick.
 *   In steady state this hook issues one request per session.
 *
 * The polling task therefore returns `true` WITHOUT touching the network on
 * almost every tick. That is not a no-op loop being wasteful: it is the tier
 * owning the decision about when a seed is due, in the one place that knows.
 */

import * as React from "react";
import { usePolling } from "@/data/usePolling";
import type { FeedPhase } from "@/data/feed-status";
import type { Block } from "@/data/types";
import { createDiffBuffer, type DiffPoint } from "./diffBuffer";

/**
 * The §1 envelope, as this consumer reads it.
 *
 * Only the fields this surface actually uses are modelled. `window_seconds`
 * and `range` are the ONLY legitimate source of the band's window label — the
 * entire reason the endpoint returns an envelope instead of a bare array is so
 * the client never re-derives a window it would then have to keep in sync.
 */
export interface DiffMeta {
  /** The key the server actually served (not necessarily the one requested). */
  range: string;
  /** blocks × target_seconds, from the server. Never computed here. */
  windowSeconds: number;
  /** Node-reported block target. Never a literal 120 on this path. */
  targetSeconds: number;
  tip: number;
}

export interface DiffStream {
  /** Everything held, ascending by height. */
  points: DiffPoint[];
  /** Envelope metadata, or null when no conforming envelope has been seen. */
  meta: DiffMeta | null;
  /** Derived, never declared — `verify-provenance` bans a literal here. */
  phase: FeedPhase;
  /** ms epoch of the last SUCCESSFUL seed; 0 = never. */
  seededAt: number;
  /** Points refused for a missing/!finite field, cumulative. Reported, not hidden. */
  rejected: number;
}

/** Which range key to ask for. The server may serve a different one and says
 *  so in `range`; we display what it served, never what we asked. */
const WANT_RANGE = "1d";

const ENDPOINT = `/api/xmr/network/difficulty?range=${WANT_RANGE}`;

function finitePos(x: unknown): number | null {
  const n = Number(x);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Parse whatever the endpoint returned into points + optional meta.
 *
 * Tolerant of the PRE-envelope bare-array shape on purpose: this consumer and
 * the endpoint ship in the same release but not in the same file, and a client
 * that hard-crashes on the old shape would turn a deploy-order accident into a
 * blank panel. A bare array yields points with NO meta — which means no band
 * label, because a band whose window came from a literal is exactly the defect
 * the envelope exists to prevent.
 */
function parse(json: unknown): { points: DiffPoint[]; meta: DiffMeta | null; ok: boolean } {
  const rawPoints: unknown[] = Array.isArray(json)
    ? json
    : Array.isArray((json as { points?: unknown[] })?.points)
      ? (json as { points: unknown[] }).points
      : [];

  const points: DiffPoint[] = [];
  for (const r of rawPoints) {
    const o = r as Record<string, unknown>;
    const t = finitePos(o?.timestamp);
    const height = finitePos(o?.height);
    const difficulty = finitePos(o?.difficulty);
    if (t === null || height === null || difficulty === null) continue;
    points.push({ t, height, difficulty });
  }

  let meta: DiffMeta | null = null;
  if (!Array.isArray(json) && json && typeof json === "object") {
    const o = json as Record<string, unknown>;
    const windowSeconds = finitePos(o.window_seconds);
    const targetSeconds = finitePos(o.target_seconds);
    const tip = finitePos(o.tip);
    const range = typeof o.range === "string" ? o.range : null;
    /* ALL FOUR or none. A partial envelope is not a cheaper envelope — a
       window label assembled from three real fields and one guessed one is
       indistinguishable, on screen, from a fully real one. */
    if (windowSeconds !== null && targetSeconds !== null && tip !== null && range) {
      meta = { range, windowSeconds, targetSeconds, tip };
    }
  }

  const ok = Array.isArray(json)
    ? true
    : (json as { ok?: unknown })?.ok !== false;

  return { points, meta, ok: ok && points.length > 0 };
}

/**
 * @param blocks the chain tier's existing block headers (newest-first). Their
 *        `timestamp` is the header's own; `null` entries are dropped by the
 *        seam rather than reconstructed from wall-clock.
 */
export function useDifficultyStream(blocks: readonly Block[]): DiffStream {
  /* One buffer per mount, created lazily. `useRef(createDiffBuffer())` would
     call the factory on every render and throw the result away. */
  const bufRef = React.useRef<ReturnType<typeof createDiffBuffer> | null>(null);
  if (bufRef.current === null) bufRef.current = createDiffBuffer();
  const buf = bufRef.current;

  const [meta, setMeta] = React.useState<DiffMeta | null>(null);
  const [seededAt, setSeededAt] = React.useState(0);
  const [rejected, setRejected] = React.useState(0);
  /** Bumped ONLY when the buffer actually grew, so a tick that re-delivers the
   *  same 100 headers re-renders nothing. */
  const [version, setVersion] = React.useState(0);
  /** null = never settled (loading); true/false = last attempt's outcome. */
  const [lastOk, setLastOk] = React.useState<boolean | null>(null);

  /** Set by the append path when `ingest` reports a hole, cleared by the seed. */
  const needSeed = React.useRef(true);

  /* ── caller 1 of the seam: the seed ──────────────────────────────────── */
  usePolling("chain", async (signal) => {
    if (!needSeed.current) return true;   // steady state: no request at all
    try {
      const res = await fetch(ENDPOINT, { signal, headers: { accept: "application/json" } });
      if (!res.ok) { setLastOk(false); return false; }
      const { points, meta: m, ok } = parse(await res.json());
      if (!ok) { setLastOk(false); return false; }
      const r = buf.ingest(points);
      needSeed.current = false;
      if (m) setMeta(m);
      setSeededAt(Date.now());
      setLastOk(true);
      if (r.rejected) setRejected((n) => n + r.rejected);
      if (r.added) setVersion((v) => v + 1);
      return true;
    } catch {
      /* Includes the AbortError from unmount/timeout. Counting it as a failure
         is what feeds usePolling's backoff; the phase below reports it. */
      setLastOk(false);
      return false;
    }
  });

  /* ── caller 2 of the seam: the append, from data already on hand ─────── */
  React.useEffect(() => {
    const fresh: DiffPoint[] = [];
    for (const b of blocks) {
      if (b.timestamp === null) continue;   // node reported no header time — drop, never reconstruct
      if (!Number.isFinite(b.difficulty) || b.difficulty <= 0) continue;
      fresh.push({ t: b.timestamp, height: b.height, difficulty: b.difficulty });
    }
    if (!fresh.length) return;
    const r = buf.ingest(fresh);
    if (r.gap) needSeed.current = true;     // reported, never repaired
    if (r.rejected) setRejected((n) => n + r.rejected);
    if (r.added) setVersion((v) => v + 1);
  }, [blocks, buf]);

  /* `version` is read so the memo recomputes when the buffer grew; the buffer
     is mutable and its identity never changes, so it cannot be the trigger. */
  const points = React.useMemo(() => buf.snapshot(), [buf, version]);

  /**
   * Phase, DERIVED. Four states, and the two failure ones are genuinely
   * different: "we have last-good and it is going stale" vs "we have nothing
   * and it is broken" — the distinction v6.1.4 added `error` for.
   */
  const phase: FeedPhase =
    lastOk === null ? "loading"
      : lastOk ? "live"
        : points.length ? "stale"
          : "error";

  return { points, meta, phase, seededAt, rejected };
}
