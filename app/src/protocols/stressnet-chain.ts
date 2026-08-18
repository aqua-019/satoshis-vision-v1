/**
 * protocols/stressnet-chain.ts — a SIMULATED beta-chain, built from the wind
 * tunnel's closed-form model plus a seeded hash. Nothing here is a measurement
 * of anything, and every surface that renders it says so.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────
 * `stressnet-model.ts` answers one question: at storm level u, what does a
 * steady-state block look like? That is an EQUILIBRIUM — a single point, with
 * no time axis and no memory. An explorer needs the other thing: a SEQUENCE of
 * blocks, each with transactions in it, each with an interval before it, and a
 * mempool that fills and drains between them.
 *
 * This module turns the first into the second, and it does it WITHOUT giving
 * the model state — the model stays pure, so `/learn/sim?p=stressnet` renders
 * exactly what it rendered before p4·07.
 *
 * ── IT LIVES IN protocols/ BECAUSE THAT IS WHERE SYNTHESIS IS LICENSED ──
 * CLAUDE.md's rule is absolute: zero fabricated values on live surfaces, and
 * `app/src/protocols/` is the one directory allowed to invent numbers, because
 * everything in it is an openly-labelled educational model. This file invents
 * an entire blockchain. It could not live anywhere else.
 *
 * ── AND IT IS SEEDED, NOT RANDOM — WHICH IS THE STRONGER PROPERTY ───────
 * `protocols/sim-random.ts` exists and its `Math.random` would be licensed
 * here. This file uses `design/prng.ts`'s `h3` instead, and the reason is not
 * convenience:
 *
 *   - A random chain renders a DIFFERENT history on every reload, so no two
 *     readers ever see the same page and no screenshot is reproducible.
 *   - Under `prefers-reduced-motion` the chain is frozen. If it were random,
 *     "frozen" would mean "frozen on one arbitrary draw", and the reduced-
 *     motion reader would get a strictly poorer page than everyone else. With
 *     `h3` the frozen chain is the SAME chain, just not advancing — which is
 *     what lets this release claim the reduced-motion path loses no
 *     information rather than merely asserting it.
 *   - `h3` is INDEX-ADDRESSABLE (see design/prng.ts): block 4,210,003's
 *     contents are a pure function of its own height, not of how many blocks
 *     have been drawn before it. So the chain can be windowed, re-windowed and
 *     scrubbed without a cursor, and two components asking about the same
 *     height always agree.
 *
 * ── THE CLOCK IS COMPRESSED, AND THE PAGE SAYS SO ───────────────────────
 * Monero targets a 120-second block. An explorer in which nothing happens for
 * two minutes is not an explorer, so the simulated clock runs at `SIM_SPEED`×
 * wall time. That is a presentation decision and therefore a HONESTY decision:
 * an unlabelled compressed cadence is a fabricated reading of how fast this
 * chain produces blocks. The page states the multiplier on its face, next to
 * the ticker. Do not change it without moving that copy.
 *
 * ── THE SOURCE SEAM ─────────────────────────────────────────────────────
 * `ChainSource` below is the whole of the "endpoint-ready" architecture, and
 * it ships with EXACTLY ONE implementation. There is no config object, no
 * environment variable, no feature flag, and no UI affordance to switch it —
 * because there is nothing to switch to, and shipping the switch before the
 * second source exists would be a promise this repo cannot keep. (The real
 * Superstress Net is self-hosted, has no public endpoint, and this site's CSP
 * is `connect-src 'self'` — see /operate/superstress.)
 *
 * What the seam DOES buy is that adding one later is a typed change rather
 * than a rewrite: `ChainSourceId` is a union of one, `SOURCE_PROVENANCE` is a
 * `Record` over it, and every consumer reads `chain.source`. A second member
 * is a COMPILE ERROR until its provenance is declared — which is the same
 * exhaustiveness mechanism `ProvSource` uses, and the reason a badge cannot be
 * forgotten. An `/api/betanet` adapter would slot in here as a second
 * `ChainSource` whose `read()` is async; nothing else in this file changes.
 */

import { h3 } from "@/design/prng";
import { model, kb, CAP_KB, BLOCK_SEC, PROOF_KB } from "@/protocols/stressnet-model";
import type { Model } from "@/protocols/stressnet-model";

export { kb, BLOCK_SEC, CAP_KB };
export type { Model };

/** Fixed seed. Changing it changes every simulated block on the page. */
const SEED = 0x5e7ce55;

/** Wall-clock compression. One simulated block ≈ BLOCK_SEC / SIM_SPEED
 *  seconds of real time. Rendered on the page — see the file header. */
export const SIM_SPEED = 30;

/** How many blocks the ribbon carries, and how deep confirmations run. */
export const CHAIN_DEPTH = 12;

/** Mempool rows the feed renders. Bounded so a full storm cannot put four
 *  thousand DOM nodes on a phone. */
export const MEMPOOL_ROWS = 48;

/** A height with no relationship to any real chain's height, and deliberately
 *  so: a plausible mainnet height printed beside simulated blocks is exactly
 *  the confusion this page exists to prevent. Beta chains start at zero. */
export const GENESIS_OFFSET = 0;

/* ── the source seam ────────────────────────────────────────────────────── */

/** Union of ONE. A second member is a compile error until `SOURCE_PROVENANCE`
 *  and every `switch` over it are widened — see the file header. */
export type ChainSourceId = "model";

/** Which provenance badge a chain from each source must carry. Exhaustive by
 *  `Record`, so a new source cannot ship without declaring one. */
export const SOURCE_PROVENANCE: Record<ChainSourceId, "model"> = {
  model: "model",
};

/** Human-readable name for each source, rendered beside the badge.
 *  NOT "wind-tunnel model": the badge itself already says MODEL, and
 *  `<Provenance source="model" detail={…}>` renders them adjacent, so that
 *  string printed "MODEL · wind-tunnel model" — the same word twice in one
 *  chip. Found by looking at the render. */
export const SOURCE_LABEL: Record<ChainSourceId, string> = {
  model: "wind tunnel",
};

/* ── the simulated objects ──────────────────────────────────────────────── */

export interface SimTx {
  /** ALWAYS `sim:` + 16 hex. Never 64 hex — a 64-hex string is what a real
   *  Monero txid looks like, and a screenshot of one circulates as real. The
   *  prefix is part of the id itself rather than a decoration added at render
   *  time, so no call site can print an unmarked one. */
  id: string;
  sizeB: number;
  /** piconero per byte, the units the rest of this site uses. */
  perB: number;
  tierIdx: 0 | 1 | 2 | 3;
  ageSec: number;
}

export interface SimBlock {
  height: number;
  weightKB: number;
  txCount: number;
  /** Seconds since the previous block — an exponential draw, because arrivals
   *  are Poisson. A constant 120 would be the one thing about block timing
   *  that every reader already knows is false. */
  intervalSec: number;
  penaltyPct: number;
  /** True when this block hit the 2× median cap and left demand behind. */
  capped: boolean;
}

export interface SimChain {
  source: ChainSourceId;
  tip: number;
  blocks: SimBlock[];
  mempool: SimTx[];
  /** Bytes that could not fit under the cap and are queuing. */
  backlogKB: number;
  m: Model;
}

/* ── the model source ───────────────────────────────────────────────────── */

const HEX = "0123456789abcdef";

/** 16 hex chars derived from the seeded hash — deterministic per (height,
 *  index). Short by design: nothing here should be mistakable for a 64-hex
 *  Monero txid even before the `sim:` prefix goes on. */
function synthId(height: number, i: number): string {
  let s = "";
  for (let k = 0; k < 16; k++) {
    s += HEX[Math.floor(h3(height * 97 + i, 40 + k, SEED) * 16)];
  }
  return "sim:" + s;
}

/** Exponential inter-arrival with mean `BLOCK_SEC`, drawn from the seeded
 *  hash and clamped so one unlucky draw cannot render a 40-minute gap that
 *  dominates the ribbon's scale. */
function interval(height: number): number {
  const u = Math.min(0.995, Math.max(0.005, h3(height, 7, SEED)));
  return Math.max(8, Math.min(4 * BLOCK_SEC, -BLOCK_SEC * Math.log(1 - u)));
}

/**
 * One simulated block at `height`, under storm level `intensity`.
 *
 * The model supplies the equilibrium (demand, the median, the cap, the
 * penalty); the hash supplies the per-block variation around it. Variation is
 * ±18% of demand, which is wide enough that the ribbon is not a row of
 * identical tiles and narrow enough that the cap is still visibly the binding
 * constraint at storm — which is the finding the wind tunnel exists to deliver
 * and must survive being dressed as an explorer.
 */
function blockAt(height: number, m: Model): SimBlock {
  const jitter = 1 + (h3(height, 1, SEED) - 0.5) * 0.36;
  const demand = Math.max(12, m.demandKB * jitter);
  const weightKB = Math.min(demand, CAP_KB);
  const over = weightKB / m.medianKB;
  const penaltyPct = over > 1 ? Math.pow(over - 1, 2) * 100 : 0;
  // Transactions are FCMP++-sized on average, with per-block spread.
  const avgKB = PROOF_KB * (0.82 + h3(height, 2, SEED) * 0.5);
  return {
    height,
    weightKB,
    txCount: Math.max(1, Math.round(weightKB / avgKB)),
    intervalSec: interval(height),
    penaltyPct,
    capped: demand > CAP_KB,
  };
}

/**
 * The pending pool at `tip`, under storm level `intensity`.
 *
 * Size follows the model: when demand fits under the cap the pool is a thin
 * working set that drains every block; when it does not, the backlog is real
 * and the pool is deep. Fee rates are scaled by the model's own `feeMult`, so
 * the fee market visibly responds to the dial rather than being decorated to
 * look like it does.
 */
function poolAt(tip: number, m: Model): SimTx[] {
  const workingSet = Math.min(MEMPOOL_ROWS, 6 + Math.round(m.demandKB / 26));
  const backlogRows = m.broken ? Math.round(Math.min(MEMPOOL_ROWS, m.backlogKB / 9)) : 0;
  const n = Math.max(3, Math.min(MEMPOOL_ROWS, workingSet + backlogRows));

  // Base rate in piconero/byte, scaled by the model's fee multiplier. The base
  // is this site's own resting figure for a normal-tier mainnet transaction;
  // everything above it is the model responding to the storm.
  const BASE_PER_B = 20000;

  const out: SimTx[] = [];
  for (let i = 0; i < n; i++) {
    const spread = 0.45 + h3(tip, 300 + i, SEED) * 2.6;
    const perB = Math.round(BASE_PER_B * m.feeMult * spread);
    const sizeB = Math.round(PROOF_KB * 1000 * (0.7 + h3(tip, 600 + i, SEED) * 0.9));
    // Age is bounded by how long the pool has been unable to clear: a draining
    // pool holds nothing old, a backed-up one does.
    const maxAge = m.broken ? BLOCK_SEC * (2 + m.backlogKB / 260) : BLOCK_SEC * 0.9;
    out.push({
      id: synthId(tip, i),
      sizeB,
      perB,
      tierIdx: 0,
      ageSec: Math.round(h3(tip, 900 + i, SEED) * maxAge),
    });
  }

  // Tier by quartile over this pool — the classic view's own bucketing idiom
  // (classic.tsx's classicComputeThresholds), so the two surfaces bucket the
  // same way and a reader moving between them is not learning a second scheme.
  const sorted = [...out].map((t) => t.perB).sort((a, b) => b - a);
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  const thr = [q(0.15), q(0.4), q(0.7)];
  for (const t of out) {
    t.tierIdx = t.perB >= thr[0] ? 0 : t.perB >= thr[1] ? 1 : t.perB >= thr[2] ? 2 : 3;
  }

  return out.sort((a, b) => b.perB - a.perB);
}

/**
 * A `ChainSource` produces a whole chain state for a (storm level, tip) pair.
 * Synchronous here because the model is arithmetic; an endpoint-backed source
 * would return a promise and every consumer already treats the chain as data
 * that can change under it.
 */
export interface ChainSource {
  readonly id: ChainSourceId;
  read(intensity: number, tip: number): SimChain;
}

export const MODEL_SOURCE: ChainSource = {
  id: "model",
  read(intensity: number, tip: number): SimChain {
    const m = model(intensity);
    const blocks: SimBlock[] = [];
    for (let d = 0; d < CHAIN_DEPTH; d++) blocks.push(blockAt(tip - d, m));
    return {
      source: "model",
      tip,
      blocks,          // newest first — blocks[0].height === tip
      mempool: poolAt(tip, m),
      backlogKB: m.backlogKB,
      m,
    };
  },
};

/** The four fee tiers, in the classic explorer's own vocabulary and order.
 *  Kept here rather than in the page so the bucketing above and the labels
 *  below cannot drift into two different four-tier schemes. */
export const SIM_TIERS = [
  { id: "priority", label: "PRIORITY", eta: "next block", desc: "confirms in the next simulated block" },
  { id: "fast", label: "FAST", eta: "1–2 blocks", desc: "just above the median bid" },
  { id: "normal", label: "NORMAL", eta: "~5 blocks", desc: "clears once the pool drains" },
  { id: "economy", label: "ECONOMY", eta: "when it clears", desc: "outbid while the storm holds" },
] as const;
