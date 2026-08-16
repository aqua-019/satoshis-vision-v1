/**
 * pages/network/diffBuffer.ts — THE ONE INGEST SEAM for the streaming
 * difficulty series (D0828).
 *
 * ── THIS MODULE IMPORTS NOTHING, AND THAT IS THE WHOLE POINT ──────────────
 *
 * Read the import list above this comment: it is empty. No `fetch`, no
 * polling hook, no WebSocket, no feed types, no React. Every point that ever
 * reaches the chart passes through `ingest()`, and `ingest()` cannot tell —
 * and must never be able to tell — where its caller got them.
 *
 * That is what makes "a future socket is a data-source swap, not a rewrite" a
 * PROVABLE claim rather than an aspirational comment. Today the seam has
 * exactly TWO callers:
 *
 *   1. the seed      — one `/api/xmr/network/difficulty` fetch (real past)
 *   2. the append    — the chain tier's existing `data.blocks`, whose headers
 *                      already carry `timestamp` and `difficulty`, so an
 *                      append costs ZERO new requests
 *
 * A socket would be a third caller of the same function. Nothing else changes:
 * not the window arithmetic, not the band, not the component. A gate can
 * assert this structurally by reading this file's import list — an assertion
 * that a comment could never support.
 *
 * ── WHY A FACTORY AND NOT A MODULE SINGLETON ──────────────────────────────
 *
 * A module-level buffer would be shared by every mount in the process, which
 * makes it invisible state a test cannot reset and a second consumer would
 * silently join. `createDiffBuffer()` hands the caller an instance it owns.
 *
 * ── HONESTY RULES BAKED IN, NOT DOCUMENTED ────────────────────────────────
 *
 * · A point with a non-finite or non-positive `t`, `height` or `difficulty` is
 *   REJECTED, never defaulted. `map.ts` used to fall back to `nowSec()` for a
 *   missing block timestamp; a wall-clock stand-in for a block header's own
 *   time is a fabricated x-coordinate, so this seam refuses it outright and
 *   reports the count instead.
 * · Heights are unique. A re-poll that re-delivers the same block updates
 *   nothing and adds nothing — the chain is append-only and so is this.
 * · `gap` is reported, never repaired. When the caller has been away long
 *   enough that the incoming batch does not touch what is held, this buffer
 *   says so and lets the caller re-seed from the real endpoint. Interpolating
 *   across the hole would draw difficulty the node never reported.
 */

/** One difficulty reading, at the block header's OWN timestamp. */
export interface DiffPoint {
  /** Block header timestamp, UNIX **seconds**, exactly as the node reported it. */
  t: number;
  height: number;
  difficulty: number;
}

export interface IngestResult {
  /** Points that were new and well-formed. */
  added: number;
  /** Points refused for a non-finite/non-positive field. Never silently zeroed. */
  rejected: number;
  /**
   * True when this batch does not connect to what was already held — the
   * lowest NEW height sits more than `gapTolerance` above the highest held
   * height, so there is a hole between them. The caller re-seeds; this buffer
   * never invents the missing blocks.
   */
  gap: boolean;
}

export interface DiffBuffer {
  /** The ONE way points enter. Two callers today; a socket would be a third. */
  ingest(points: readonly DiffPoint[]): IngestResult;
  /** Everything held, ascending by height (and therefore by chain order). */
  snapshot(): DiffPoint[];
  size(): number;
  /** Highest height held, or null when empty. */
  tip(): number | null;
  clear(): void;
}

/**
 * How far the newest held height may lag an incoming batch before the caller
 * is told to re-seed.
 *
 * Derived, not chosen: the append source is `data.blocks`, which
 * `xmrirish-feed.ts` caps at `BLOCKS_CAP = 100` headers. So a client that was
 * away for under 100 blocks (~3.3 h at the 120 s target) receives every block
 * it missed inside the very next chain tick and there is no hole. Past that,
 * the blocks endpoint itself cannot close the gap and only a re-seed can.
 */
export const GAP_TOLERANCE_BLOCKS = 100;

/**
 * Default retention. The seed's own window is whatever the endpoint served
 * (`window_seconds` in the envelope); this is a memory bound on top of it, not
 * a window — the window is applied at render time by `windowOf()` below.
 */
export const DEFAULT_CAP = 1500;

function usable(p: DiffPoint): boolean {
  return (
    Number.isFinite(p.t) && p.t > 0 &&
    Number.isFinite(p.height) && p.height > 0 &&
    Number.isFinite(p.difficulty) && p.difficulty > 0
  );
}

export function createDiffBuffer(
  cap: number = DEFAULT_CAP,
  gapTolerance: number = GAP_TOLERANCE_BLOCKS,
): DiffBuffer {
  /** Keyed by height: the chain's own unique index. Dedupe is structural. */
  const byHeight = new Map<number, DiffPoint>();

  const highest = (): number | null => {
    let hi: number | null = null;
    for (const h of byHeight.keys()) if (hi === null || h > hi) hi = h;
    return hi;
  };

  return {
    ingest(points) {
      let added = 0;
      let rejected = 0;
      let minNew: number | null = null;
      const heldMax = highest();

      for (const p of points) {
        if (!usable(p)) { rejected++; continue; }
        if (byHeight.has(p.height)) continue;
        byHeight.set(p.height, { t: p.t, height: p.height, difficulty: p.difficulty });
        added++;
        if (minNew === null || p.height < minNew) minNew = p.height;
      }

      /* A hole is only meaningful when we already held something AND the batch
         landed entirely above it. A batch that overlaps what we hold — the
         ordinary case, since `data.blocks` re-delivers the last 100 headers
         every tick — closes no gap because there was none. */
      const gap =
        heldMax !== null && minNew !== null && minNew - heldMax > gapTolerance;

      /* Evict the oldest by height once over cap. Sorting here rather than
         keeping a parallel structure: this runs once per poll on <=1500 keys,
         not per frame. */
      if (byHeight.size > cap) {
        const heights = [...byHeight.keys()].sort((a, b) => a - b);
        for (let i = 0; i < heights.length - cap; i++) byHeight.delete(heights[i]);
      }

      return { added, rejected, gap };
    },

    snapshot() {
      return [...byHeight.values()].sort((a, b) => a.height - b.height);
    },

    size() {
      return byHeight.size;
    },

    tip() {
      return highest();
    },

    clear() {
      byHeight.clear();
    },
  };
}

/* ── pure projection helpers ───────────────────────────────────────────────
   Kept here beside the buffer because they are the same kind of thing — pure
   arithmetic over points, importable by a gate under bare Node. They are NOT
   part of the ingest seam and no data enters through them. */

/**
 * The sub-series inside `[from, to]`, in seconds.
 *
 * A point outside the window is DROPPED, never clamped to an edge. Clamping
 * would pile every older reading onto the left border at a time it does not
 * belong to — the same mistake `pls X` made in p2·9's pulse view and the same
 * refusal `containsT` makes for the shared time cursor.
 */
export function windowOf(points: readonly DiffPoint[], from: number, to: number): DiffPoint[] {
  return points.filter((p) => p.t >= from && p.t <= to);
}

/** Difficulty values only — what `sigmaBand` consumes. */
export function values(points: readonly DiffPoint[]): number[] {
  return points.map((p) => p.difficulty);
}

/**
 * Decimate to at most `max` points, keeping the FIRST and LAST.
 *
 * Anchored at the NEWEST element, mirroring the server contract's D5: the tip
 * must survive, because the tip is where the live tail joins. A stride that
 * anchors at index 0 drops the newest point whenever the length is not a
 * multiple of the stride, which is the exact defect the §1 contract records in
 * the endpoint it replaced.
 */
export function decimate<T>(xs: readonly T[], max: number): T[] {
  if (max <= 0) return [];
  if (xs.length <= max) return [...xs];
  const step = Math.ceil(xs.length / max);
  const out: T[] = [];
  for (let i = xs.length - 1; i >= 0; i -= step) out.push(xs[i]);
  out.reverse();
  return out;
}
