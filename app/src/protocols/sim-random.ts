/**
 * protocols/sim-random.ts — pseudo-random helpers for the EDUCATIONAL protocol
 * simulators ONLY (MODEL surfaces; see design/provenance). No live-data surface
 * may import from this file — real data is never synthesised.
 */
const HEX = "0123456789abcdef";

/** Random hex string of `len` chars — illustrative simulator output only. */
export const randHex = (len: number): string => {
  let s = "";
  for (let i = 0; i < len; i++) s += HEX[(Math.random() * 16) | 0];
  return s;
};
