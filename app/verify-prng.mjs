/* verify-prng.mjs — offline gate for design/prng.ts, the seeded generator
   that replaces every Math.random() call in app/src/design/.
   Run: node verify-prng.mjs   (Node >=22.6 strips the .ts type annotations)

   This is a determinism change, not a design change: the star/stream field
   in ArtBackground.tsx must look the same to a human as it did on
   Math.random() — same count, same distribution, same character. That has
   to hold BY CONSTRUCTION, not by eyeballing a screenshot, so this gate
   proves the substituted generator has the same statistical shape
   (uniform [0,1), independent across role indices) and that the specific
   arithmetic ArtBackground.tsx builds on top of it still lands in the same
   ranges the original Math.random() version did. */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { makeReporter } from './verify-lib.mjs';
import { h3, mulberry32 } from './src/design/prng.ts';

const r = makeReporter('verify-prng');

/* ── 1 · determinism ──────────────────────────────────────────────── */

r.group('1 · determinism');

{
  const calls = [[0, 0, 0], [7, 3, 0x5eed], [119, 14, 0x5eed + 42], [-5, -1, -100]];
  let allStable = true;
  for (const [x, y, s] of calls) {
    const first = h3(x, y, s);
    for (let i = 0; i < 5; i++) if (h3(x, y, s) !== first) allStable = false;
  }
  r.ok(allStable, `h3(x,y,s) is a pure function — ${calls.length} inputs × 5 repeats each, all stable`);
}

{
  // A fixed seed must reproduce an identical SEQUENCE, not just an identical
  // first value — this is what AmbientField's seedOrbs() relies on.
  const seqA = Array.from({ length: 50 }, () => 0).map((_, i) => i);
  const genA = mulberry32(0x0c0ffee);
  const genB = mulberry32(0x0c0ffee);
  const outA = seqA.map(() => genA());
  const outB = seqA.map(() => genB());
  const identical = outA.every((v, i) => v === outB[i]);
  r.ok(identical, 'mulberry32(seed) reproduces an identical 50-value sequence from a fresh instance');

  const genC = mulberry32(0x0c0ffee + 1);
  const outC = seqA.map(() => genC());
  const differs = outA.some((v, i) => v !== outC[i]);
  r.ok(differs, 'a different seed produces a different mulberry32 sequence (sanity check on the check above)');
}

/* ── 2 · range ────────────────────────────────────────────────────── */

r.group('2 · range');

{
  const N = 200_000;
  let bad = 0, nan = 0;
  for (let i = 0; i < N; i++) {
    const v = h3(i, i % 15, 0x5eed);
    if (Number.isNaN(v)) nan++;
    else if (!(v >= 0 && v < 1)) bad++;
  }
  r.ok(nan === 0 && bad === 0, `h3: ${N} draws all in [0,1), 0 NaN, 0 out-of-range`, `nan=${nan} bad=${bad}`);
}

{
  const N = 200_000;
  const gen = mulberry32(999);
  let bad = 0, nan = 0;
  for (let i = 0; i < N; i++) {
    const v = gen();
    if (Number.isNaN(v)) nan++;
    else if (!(v >= 0 && v < 1)) bad++;
  }
  r.ok(nan === 0 && bad === 0, `mulberry32: ${N} draws all in [0,1), 0 NaN, 0 out-of-range`, `nan=${nan} bad=${bad}`);
}

/* ── 3 · uniformity ───────────────────────────────────────────────── */

r.group('3 · uniformity');

{
  // 100k draws (per the brief), 10 equal-width bins, expect ~10k each.
  // Tolerance: ±10% of the expected count (9,000–11,000). A hash function
  // this simple could plausibly land within a percent or two on any given
  // run; 10% is generous headroom against sampling noise while still
  // catching a genuinely broken distribution (e.g. a sign bug clustering
  // everything into one bin, or a stuck LCG cycling through a handful of
  // values).
  const N = 100_000;
  const bins = new Array(10).fill(0);
  for (let i = 0; i < N; i++) {
    const v = h3(i, 0, 0x5eed);
    bins[Math.min(9, Math.floor(v * 10))]++;
  }
  const expected = N / 10;
  const tolerance = expected * 0.10;
  const worst = bins.reduce((m, c) => Math.max(m, Math.abs(c - expected)), 0);
  r.ok(
    bins.every((c) => Math.abs(c - expected) <= tolerance),
    `h3: ${N} draws bucket into 10 bins within ±10% of expected ${expected} each`,
    `bins=[${bins.join(',')}] worst-deviation=${worst}`,
  );
}

/* ── 4 · independence across role indices ────────────────────────── */

r.group('4 · independence across role indices');

{
  // For two INDEPENDENT uniform [0,1) draws, E[|U1 - U2|] = 1/3. If role 0
  // and role 1 were accidentally correlated (e.g. via a shared intermediate
  // term), this would drift toward 0 (near-identical values) or away from
  // 1/3 in a detectable way.
  const N = 100_000;
  let sum = 0;
  for (let i = 0; i < N; i++) {
    const a = h3(i, 0, 0x5eed);
    const b = h3(i, 1, 0x5eed);
    sum += Math.abs(a - b);
  }
  const meanAbsDiff = sum / N;
  const expected = 1 / 3;
  const tolerance = 0.02; // ~6% relative — observed runs land within ~0.001
  r.ok(
    Math.abs(meanAbsDiff - expected) <= tolerance,
    `h3(i,0,S) and h3(i,1,S) behave as independent uniforms over ${N} draws of i`,
    `mean |a-b| = ${meanAbsDiff.toFixed(5)}, expected ≈${expected.toFixed(5)}, tolerance ±${tolerance}`,
  );
}

/* ── 5 · the particle-field distribution contract ────────────────── */

r.group('5 · particle-field distribution contract (ArtBackground.tsx arithmetic)');

{
  // Reproduces seed()'s exact arithmetic for a representative budget — the
  // `high` tier's default (120 stars, 8 streams) — against a representative
  // box, and checks every field lands where the brief's marginals say it
  // must. This is NOT re-deriving the file; it is the same formulas with the
  // same role-index scheme, run here so a future edit to either copy can be
  // caught by diverging from this contract.
  const SEED = 0x5eed;
  const w = 1440, h = 900;
  const N_STARS = 120, N_STREAMS = 8;

  const stars = Array.from({ length: N_STARS }, (_, i) => ({
    x: h3(i, 0, SEED) * w, y: h3(i, 1, SEED) * h,
    vx: (h3(i, 2, SEED) - 0.5) * 0.15,
    vy: (h3(i, 3, SEED) - 0.5) * 0.15,
    r: h3(i, 4, SEED) * 1.3 + 0.2,
    a: h3(i, 5, SEED) * 0.7 + 0.1,
    ph: h3(i, 6, SEED) * Math.PI * 2,
  }));
  const streams = Array.from({ length: N_STREAMS }, (_, i) => ({
    x: h3(i, 7, SEED) * w, y: h + h3(i, 8, SEED) * h,
    vy: -(h3(i, 9, SEED) * 1.6 + 0.6),
    life: h3(i, 10, SEED) * 200 + 200,
    hue: h3(i, 11, SEED) < 0.85 ? 28 : 280,
  }));

  const within = (v, lo, hi) => v >= lo && v < hi;
  r.ok(stars.every((s) => within(s.x, 0, w)), `star x within [0, ${w})`);
  r.ok(stars.every((s) => within(s.y, 0, h)), `star y within [0, ${h})`);
  r.ok(stars.every((s) => within(s.r, 0.2, 1.5)), 'star r within [0.2, 1.5)');
  r.ok(stars.every((s) => within(s.a, 0.1, 0.8)), 'star a (alpha) within [0.1, 0.8)');
  r.ok(stars.every((s) => within(s.ph, 0, Math.PI * 2)), 'star ph within [0, 2π)');
  r.ok(stars.every((s) => within(s.vx, -0.075, 0.075) && within(s.vy, -0.075, 0.075)),
    'star vx/vy within [-0.075, 0.075) (±0.5 · 0.15 · speed=1)');

  r.ok(streams.every((s) => within(s.x, 0, w)), `stream x within [0, ${w})`);
  r.ok(streams.every((s) => within(s.y, h, h + h)), 'stream y within [h, 2h) — spawns below the fold');
  r.ok(streams.every((s) => within(s.life, 200, 400)), 'stream life within [200, 400)');

  // Respawn path: role indices 12-14, seed folds in a per-stream generation
  // counter (SEED + gen). Assert respawn draws land in the same ranges AND
  // that successive generations of the SAME stream differ.
  const respawn = (i, gen) => ({
    x: h3(i, 12, SEED + gen) * w,
    vy: -(h3(i, 13, SEED + gen) * 1.6 + 0.6),
    hue: h3(i, 14, SEED + gen) < 0.85 ? 28 : 280,
  });
  const gen1 = Array.from({ length: N_STREAMS }, (_, i) => respawn(i, 1));
  const gen2 = Array.from({ length: N_STREAMS }, (_, i) => respawn(i, 2));
  r.ok(gen1.every((s) => within(s.x, 0, w)), 'respawn x within [0, w)');
  r.ok(gen1.every((s) => within(s.vy, -2.2, -0.6)), 'respawn vy within [-2.2, -0.6) (-(0..1.6+0.6))');
  r.ok(
    gen1.some((s, i) => s.x !== gen2[i].x || s.vy !== gen2[i].vy),
    'successive respawn generations of the same stream draw different values',
  );

  // Hue split: 85% hue=28 (orange), 15% hue=280 (violet), sampled at N=100k
  // per the brief (independent from the small N_STREAMS budget above, which
  // is too small a sample to test a proportion against).
  const N = 100_000;
  let orange = 0;
  for (let i = 0; i < N; i++) {
    const hue = h3(i, 11, SEED) < 0.85 ? 28 : 280;
    if (hue === 28) orange++;
  }
  const pct = orange / N;
  const tolerance = 0.02; // ±2 percentage points
  r.ok(
    Math.abs(pct - 0.85) <= tolerance,
    `hue split over ${N} draws is ~85/15 orange/violet (got ${(pct * 100).toFixed(2)}% orange)`,
    `tolerance ±${tolerance * 100}pp`,
  );
}

/* ── 6 · no Math.random() anywhere in app/src/ outside protocols/ ──────────
 *
 * SCOPE, and why it is the whole tree rather than src/design/.
 *
 * The standing rule (CLAUDE.md) is "Math.random() only inside
 * app/src/protocols/" — sitewide. Enforcement was not: this section only
 * walked src/design/ (the directory prompt 04 was fixing) and
 * verify-memshell.mjs only walks src/mempool/. Everything else — src/pages,
 * src/routes, src/data, src/layout, src/mempool's siblings — was ungated, and
 * an adversarial pass proved it live: Math.random() dropped into
 * src/routes/useUrlState.ts passed the entire verify:static chain green.
 *
 * CLAUDE.md records that this invariant "has regressed once already", which is
 * exactly the case for gating the rule as written instead of the directory
 * that happened to be under repair. So: walk all of src/, exempt protocols/.
 *
 * ── COMMENT STRIPPING HAS A SHARP EDGE. Know it before you lose an hour. ──
 *
 * The filter below removes block comments and lines whose FIRST non-space
 * characters are `//`. It does not remove a trailing comment on a code line.
 * Measured against these four cases (v6.1.4, by deliberate injection):
 *
 *     stripped      / * ... Math.random( ... * /        (block)
 *     stripped      // ... Math.random( ...             (line-start)
 *     stripped          // ... Math.random( ...         (indented line-start)
 *     TRIPS         const x = 1; // ... Math.random( ...   (TRAILING)
 *
 * So a file may freely explain why it avoids the call — usePolling.ts and
 * useMarketHistory.ts both do at length — as long as the prose is in a block
 * comment or on its own line. Put it after code on the same line and this gate
 * fails on the documentation rather than on an offence, and the message gives
 * you no hint which of the two it found.
 */

r.group('6 · Math.random() is gone from app/src/ (except src/protocols/)');

{
  const dir = new URL('./src/', import.meta.url).pathname;
  const EXEMPT = 'protocols/'; // the educational simulators — the rule's one carve-out
  const files = [];
  const walk = (p) => {
    for (const name of readdirSync(p)) {
      const full = join(p, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(name)) files.push(full);
    }
  };
  walk(dir);
  const scanned = files.filter((f) => !f.replace(dir, '').startsWith(EXEMPT));
  r.info(`scanned ${scanned.length} .ts/.tsx files under src/ (${files.length - scanned.length} under src/protocols/ exempt by rule)`);

  const offenders = [];
  for (const f of scanned) {
    const src = readFileSync(f, 'utf8');
    // Strip comments first so a documentation line naming Math.random()
    // (this gate's own migration comments, e.g.) doesn't false-positive.
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((l) => !/^\s*\/\//.test(l))
      .join('\n');
    if (/Math\.random\(/.test(stripped)) offenders.push(f.replace(dir, ''));
  }
  r.ok(offenders.length === 0, 'zero Math.random() call sites in app/src/ outside src/protocols/', offenders.join(', '));

  // The exemption is only honest if it is a real carve-out rather than a
  // vacuous one: assert the simulators DO use it, so a future refactor that
  // empties protocols/ makes this line fail loudly instead of passing silently.
  const inProtocols = files
    .filter((f) => f.replace(dir, '').startsWith(EXEMPT))
    .filter((f) => /Math\.random\(/.test(readFileSync(f, 'utf8')));
  r.ok(inProtocols.length > 0,
    `the src/protocols/ exemption is load-bearing — ${inProtocols.length} simulator file(s) use Math.random()`);
}

process.exit(r.finish());
