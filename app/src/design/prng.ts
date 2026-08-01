/**
 * design/prng.ts — the two seeded generators every decorative field in
 * `design/` draws from, so the JS runtime's built-in unseeded RNG has zero
 * call sites left outside `src/protocols/**` (that file's own `sim-random.ts`
 * header restricts it to the educational simulators' illustrative output —
 * decor is a different consumer with a different contract, which is why it
 * gets its own module rather than reaching across that boundary).
 *
 * Two shapes, because "seeded" covers two different access patterns:
 *
 *   h3(x, y, s)     INDEX-ADDRESSABLE. A pure function of its three integer
 *                   inputs — no state, nothing to advance. Call it with
 *                   (particle index, role index, seed) and the result for
 *                   particle 7's radius is the same whether it's the first
 *                   particle drawn or the fifty-first, and whether 3 more
 *                   particles get added to the field or 3 get removed. That
 *                   property is what makes ArtBackground's per-frame stream
 *                   respawns (fired independently, in whatever order streams
 *                   happen to expire) reproducible without a shared cursor:
 *                   fold a per-stream respawn counter into `s` and every
 *                   respawn gets its own independent draw, keyed only by
 *                   (which stream, which respawn) — never by call order.
 *
 *   mulberry32(seed) SEQUENTIAL STREAM. Stateful: each call advances an
 *                   internal counter and the n-th value depends on the
 *                   (n-1) draws before it. Right for a one-shot "walk through
 *                   a fixed-size array and fill it in order" seeding pass
 *                   (AmbientField's orb field) where nothing downstream ever
 *                   needs value #12 without having produced #0..#11 first.
 *                   Wrong for anything that respawns, reorders, or resizes
 *                   independently — see `h3` above.
 *
 * Neither is cryptographic. The only property either needs is that a fixed
 * seed always reproduces the identical output, so a decorative field is
 * stable across re-renders, reloads and resizes — load-bearing for visual
 * review, screenshot diffing, and (for h3) not having a star's colour depend
 * on how many other stars happen to be alive that frame.
 */

/**
 * Integer hash → a float in [0, 1). Three signed 32-bit inputs, stateless.
 * `x`/`y` are typically an entity index and a "role" index (so one entity can
 * draw several independent values without colliding — e.g. `h3(i, 0, S)` for
 * an x-coordinate and `h3(i, 1, S)` for the y that goes with it); `s` is the
 * seed. All three are coerced to int32 with `|0` so a caller passing a plain
 * loop index never has to think about it.
 */
export function h3(x: number, y: number, s: number): number {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (s | 0) * 2246822519;
  h = (h ^ (h >>> 13)) >>> 0;
  h = (h * 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * mulberry32 — tiny deterministic 32-bit PRNG (xorshift + multiply). Returns
 * a closure: each call advances internal state and returns the next float in
 * [0, 1). A fixed seed always reproduces the identical sequence.
 *
 * Moved here from `design/AmbientField.tsx` (v6.0.2–v6.x it lived there as a
 * private helper, byte-identical to this) so `h3` and `mulberry32` have one
 * shared home instead of the next sequential-stream consumer growing its own
 * copy.
 */
export function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
