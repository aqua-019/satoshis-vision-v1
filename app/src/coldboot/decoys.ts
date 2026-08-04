/**
 * coldboot/decoys.ts — the ONE seeded decoy-ring dataset feeding all four
 * cold-boot console surfaces that hover bidirectionally off it: the ring, the
 * probe, the decoy-age histogram, and the candidate matrix
 * (ColdBootConsole.tsx). Mechanically ported from the age distribution in
 * docs/v6-mockups/coldboot-splash.html:708-721 (log-normal µ1.70 σ0.85 via
 * Box–Muller) — mechanics only. The mockup's own numbers are placeholders;
 * this repo supplies the shape (the distribution, the seed, which index is
 * marked "real") and computes its own values from it.
 *
 * ── WHY mulberry32 STANDS IN FOR THE MOCKUP'S PRIVATE srand/seedTo ─────────
 * This repo has exactly one sanctioned sequential-stream PRNG
 * (design/prng.ts's `mulberry32`) and the brief banned adding a second one.
 * Bit-exact reproduction of the mockup's own internal generator is therefore
 * neither required nor possible — what IS required, and is satisfied here,
 * is that `mulberry32(RING_SEED)` produces the SAME 16 members every load,
 * every environment: load-bearing for verify-coldboot.mjs §2's cold-run
 * screenshot diff and for hover state addressing the same member across
 * ring/histogram/matrix.
 *
 * ── PROVENANCE: THIS IS A MODEL SURFACE, NOT A LIVE ONE ────────────────────
 * Every field below is fabricated — a demonstration ring, not a real
 * transaction's decoys. It must always render behind a MODEL-sourced
 * <Provenance source="model" …> and beside DEMO_DISCLOSURE (lifted verbatim
 * from coldboot-splash.html:506-507): without that pairing, colouring
 * RING_REAL_INDEX quietly contradicts the exact thing ring signatures exist
 * to prove — that no observer can tell which output is the real spend.
 */

import { mulberry32 } from "@/design/prng";

/** Ring size — CLSAG/ring-CT's standard decoy-set size since the 2020
 *  hard-fork, and the mockup's own constant. */
export const RING_SIZE = 16;

/** Log-normal shape parameters for decoy output age, in days. */
export const RING_MU = 1.7;
export const RING_SIGMA = 0.85;

/** Fixed seed — a compiled-in constant, not a claim about the live world, so
 *  it is safe to keep literal (same status as the boot log's "entropy pool
 *  seeded" line). */
export const RING_SEED = 20140418;

/**
 * Index of the ring member marked "real" for THIS DEMONSTRATION ONLY. Real
 * Monero ring signatures encode no such marker — see DEMO_DISCLOSURE, which
 * must accompany any render of this flag. Carried over unchanged from the
 * mockup (coldboot-splash.html:709, `REAL=7`).
 */
export const RING_REAL_INDEX = 7;

/** Verbatim — coldboot-splash.html:506-507. Do not paraphrase. */
export const DEMO_DISCLOSURE =
  "The bright point is the true spender — marked here because this is a " +
  "demonstration. Nothing in the transaction records which one it is.";

export interface RingMember {
  readonly i: number;
  /** decoy age in days since the referenced output entered the chain */
  readonly age: number;
  /** 8-hex fabricated id — MODEL data; never render without a MODEL badge nearby */
  readonly id: string;
  /** fabricated global output index — MODEL data */
  readonly oidx: number;
  /** normalised log-normal density weight; sums to 1 across the ring */
  readonly weight: number;
  /** true only for RING_REAL_INDEX — see DEMO_DISCLOSURE */
  readonly real: boolean;
}

const HEX = "0123456789abcdef";

/** Log-normal PDF at age `a` (days). 0 for a <= 0 — an output cannot be
 *  negatively old, and log(0) is undefined. */
export function ringPdf(a: number): number {
  if (a <= 0) return 0;
  const z = Math.log(a) - RING_MU;
  return Math.exp(-(z * z) / (2 * RING_SIGMA * RING_SIGMA)) / (a * RING_SIGMA * Math.sqrt(2 * Math.PI));
}

function buildRing(): readonly RingMember[] {
  const srand = mulberry32(RING_SEED);

  // Box–Muller, drawing from the same seeded stream as everything else here
  // (coldboot-splash.html:710's algorithm, this repo's own PRNG).
  const boxMuller = (): number => {
    const u = Math.max(1e-9, srand());
    const v = srand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  const hex8 = (): string => {
    let s = "";
    for (let k = 0; k < 8; k++) s += HEX[(srand() * 16) | 0];
    return s;
  };

  const raw: Array<{ i: number; age: number; id: string; oidx: number; real: boolean }> = [];
  for (let i = 0; i < RING_SIZE; i++) {
    const age = Math.min(59.5, Math.exp(RING_MU + RING_SIGMA * boxMuller()));
    const id = hex8();
    const oidx = 3_210_000 + Math.floor(srand() * 480_000);
    raw.push({ i, age, id, oidx, real: i === RING_REAL_INDEX });
  }
  const total = raw.reduce((s, r) => s + ringPdf(r.age), 0);
  return Object.freeze(raw.map((r) => ({ ...r, weight: total > 0 ? ringPdf(r.age) / total : 0 })));
}

/** Computed ONCE at module load. Same 16 members every render, every reload,
 *  every environment — the whole point (see the header's determinism note). */
export const DECOY_RING: readonly RingMember[] = buildRing();

/* ── histogram curve — precomputed ONCE at module scope, never inside a
   render or a .map(), so ColdBootConsole allocates zero style objects per
   bar per render (46 bars × a style object per render would be exactly the
   per-row-per-render allocation the brief bans). ── */
export const HIST_BINS = 46;
export const HIST_XMAX_DAYS = 60;

/** Raw peak density across the 46 sampled bins — computed once, and shared by
 *  both HIST_BAR_HEIGHTS and HIST_POINTS below so a ring member's point lands
 *  at the correct height relative to the SAME curve the bars are drawn from.
 *  (Normalising the bars first and then re-deriving "peak" from the already-
 *  normalised array would silently divide by 1 — a real bug caught while
 *  writing this, not a hypothetical one.) */
const HIST_PEAK: number = (() => {
  let max = 0;
  for (let b = 0; b < HIST_BINS; b++) {
    const v = ringPdf(((b + 0.5) / HIST_BINS) * HIST_XMAX_DAYS);
    if (v > max) max = v;
  }
  return max;
})();

/** Bar heights, one per bin, normalised 0..1 against HIST_PEAK.
 *  ColdBootConsole turns each into a CSS percentage; the array itself never
 *  changes after module load. */
export const HIST_BAR_HEIGHTS: readonly number[] = Object.freeze(
  Array.from({ length: HIST_BINS }, (_, b) => {
    const v = ringPdf(((b + 0.5) / HIST_BINS) * HIST_XMAX_DAYS);
    return HIST_PEAK > 0 ? Math.max(0.01, v / HIST_PEAK) : 0.01;
  }),
);

/** Each ring member's position on the 46-bar histogram axis, precomputed
 *  once alongside the bars themselves — `left%`/`bottom%` for the point
 *  overlay, against the SAME HIST_PEAK the bars use. The caption text needs
 *  `oidx`/`id`/`age`/`weight` verbatim from DECOY_RING; this only adds the
 *  two derived placement numbers. */
export interface RingHistPoint {
  readonly i: number;
  readonly leftPct: number;
  readonly bottomPct: number;
  readonly real: boolean;
}

export const HIST_POINTS: readonly RingHistPoint[] = Object.freeze(
  DECOY_RING.map((r) =>
    Object.freeze({
      i: r.i,
      leftPct: (r.age / HIST_XMAX_DAYS) * 100,
      bottomPct: HIST_PEAK > 0 ? Math.min(97, (ringPdf(r.age) / HIST_PEAK) * 100) : 0,
      real: r.real,
    }),
  ),
);
