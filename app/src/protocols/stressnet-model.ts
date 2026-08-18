/**
 * protocols/stressnet-model.ts — the wind tunnel's closed-form model, and
 * NOTHING else. A pure leaf: it imports zero modules.
 *
 * ── WHY THIS IS ITS OWN FILE (p4·07) ────────────────────────────────────
 * `model()` and its six consensus constants lived inside `stressnet.tsx`,
 * which also imports `ProtoArtboard`, `ProtoCanvas`, `Stat`, `Provenance` and
 * `react-router-dom`. When `/operate/superstress/explorer` needed the same
 * arithmetic, importing it from there would have dragged that whole component
 * graph into the explorer's chunk closure for the sake of one pure function.
 *
 * Rollup chunks per MODULE, not per export. This repo has now learned that
 * five times — `design/canvasColor.ts`, `pages/future/repoPulse.tsx`,
 * `pages/future/data.ts`, `data/siteVersion.ts`, and `pages/future/
 * ProtocolDetail.tsx` — and the fix has been the same one every time: move the
 * shared symbol to a module whose importers have the reachability you want.
 * This is the sixth.
 *
 * KEEP THIS LEAF PURE. It has two importers in two different chunk groups
 * (`stressnet.tsx` under `/learn/sim`, `stressnet-chain.ts` under the
 * explorer), so anything added here is paid for by both. A React import, a
 * design-system import, or a `Provenance` badge here would defeat the whole
 * point of the extraction.
 *
 * ── WHAT THE MODEL IS, AND WHAT IT IS NOT ───────────────────────────────
 * A CLOSED-FORM STEADY STATE. `model(intensity)` is a pure function of the
 * storm dial alone: there is no time axis, no state, no history. Two calls
 * with the same argument return the same object, which is what lets
 * `stressnet.tsx` say its readouts "are identical whether the canvas is
 * animating or frozen at t=0 under prefers-reduced-motion".
 *
 * That property is load-bearing for its second consumer too, and in a way
 * worth stating because it is easy to misread: the explorer's chain is NOT
 * produced by this file. This file answers "at storm level u, what does a
 * steady-state block look like?" — a single equilibrium. Turning that
 * equilibrium into a SEQUENCE of blocks, each with transactions in it, is
 * `stressnet-chain.ts`'s job, and it does that with a seeded hash rather than
 * by giving this function memory. Adding state here would silently change what
 * `stressnet.tsx` renders.
 *
 * ── EVERY NUMBER BELOW IS A CONSENSUS RULE OR THIS SITE'S OWN CITED FIGURE ──
 * Nothing here is tuned to make a picture look good. The block-size ratchet
 * and the penalty curve are Monero's actual dynamic-block-size rules; the
 * FCMP++ footprint and verification cost are the figures this site's own
 * FCMP++ card carries. The model is a MODEL — it is not a measurement of the
 * Umbrel Superstress Net, and no surface built on it may say otherwise.
 */

/** Penalty-free zone — 300 kB under the current rules. */
export const FLOOR_KB = 300;
/** Long-term median at rest; the ratchet's anchor. */
export const LTM_KB = 300;
/** Hard per-block ceiling: 2× median. */
export const CAP_KB = 2 * Math.round(1.7 * LTM_KB);
/** The 2-minute block target. */
export const BLOCK_SEC = 120;
/** FCMP++ tx footprint, per this site's own FCMP++ card. */
export const PROOF_KB = 3.5;
/** ~35 ms per proof, same source. */
export const VERIFY_MS = 35;

export interface Model {
  demandKB: number; medianKB: number; blockKB: number;
  penaltyPct: number; backlogKB: number; feeMult: number;
  tier: string; verifyMs: number; verifyPct: number; broken: boolean;
}

/** Closed-form steady state for a storm level. Derived from the dial alone, so
 *  the readouts are identical whether the canvas is animating or frozen at t=0
 *  under prefers-reduced-motion. */
export function model(intensity: number): Model {
  const u = intensity / 100;
  const demandKB = 55 + Math.pow(u, 1.5) * 2400;
  const medianKB = Math.max(FLOOR_KB, Math.min(demandKB, Math.round(1.7 * LTM_KB)));
  const blockKB = Math.min(demandKB, CAP_KB);
  const over = blockKB / medianKB;
  const penaltyPct = over > 1 ? Math.pow(over - 1, 2) * 100 : 0;
  const backlogKB = Math.max(0, demandKB - CAP_KB);
  const broken = backlogKB > 0;
  const feeMult = 1 + Math.pow(Math.max(0, over - 1), 2) * 6 + (broken ? backlogKB / 220 : 0);
  const tier = feeMult < 1.4 ? "low" : feeMult < 4 ? "normal" : feeMult < 18 ? "high" : "highest";
  const verifyMs = (blockKB / PROOF_KB) * VERIFY_MS;
  return {
    demandKB, medianKB, blockKB, penaltyPct, backlogKB, feeMult, tier,
    verifyMs, verifyPct: (verifyMs / (BLOCK_SEC * 1000)) * 100, broken,
  };
}

/** kB / MB, the wind tunnel's own formatting. Shared so the explorer and the
 *  simulator cannot disagree about how a block weight is written down. */
export const kb = (n: number): string =>
  n >= 1000 ? (n / 1000).toFixed(2) + " MB" : Math.round(n) + " kB";
