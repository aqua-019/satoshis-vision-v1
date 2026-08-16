/* verify-bands.mjs — offline gate for pages/network/bands.ts, the threshold-band
   arithmetic behind /live/network's D0832 bands.
   Run: node verify-bands.mjs   (Node >=22.6 strips the .ts type annotations)

   WHY THIS GATE EXISTS, AND WHY IT IS OFFLINE

   A band is a claim about what "normal" looks like, drawn as a coloured
   rectangle over live numbers. This repo's first rule is that a live surface
   carries no fabricated values, and a band is the easiest way to smuggle one
   in: it looks like decoration and reads like authority. Two failure modes,
   both of which this gate is built to catch:

     1. A band whose LABEL claims a window the data does not cover. The mockup
        this page is specced from asks for "the trailing 30-day ±1σ envelope";
        nothing in app/ fetches a 30-day series (measured — /api/xmr/blocks is
        capped at 100 headers by data/map.ts BLOCKS_CAP), so that label would be
        a fabricated value wearing a tint. §3 asserts the window is IN the
        sentence and that the sentence is never empty.

     2. A band whose ARITHMETIC is right about the wrong quantity. The mockup's
        per-block cadence band (healthy 96–150 s) is a sound band for the MEAN
        of ~100 intervals and a badly wrong one for a single interval, because
        Monero block arrivals are Poisson. §2 pins the exponential
        probabilities that make that true, so nobody re-derives the per-tick
        band from the mockup a second time.

   Offline because all of it is arithmetic: no browser, no network, no dist/.
   That also means it runs in CI's `build` job alongside the other offline
   gates rather than costing an e2e slot. */

import { readFileSync } from 'node:fs';
import { makeReporter } from './verify-reporter.mjs';
import {
  BLOCK_TARGET_S, MIN_SIGMA_SAMPLES,
  backlogBand, bandWindowLabel, cadenceBand, classify, meanOf, sigmaBand, worstZone,
} from './src/pages/network/bands.ts';

const r = makeReporter('verify-bands');

/* ── 1 · the target is protocol, and it is named once ─────────────── */

r.group('1 · the consensus target is a named constant, not a literal');

r.ok(BLOCK_TARGET_S === 120, `BLOCK_TARGET_S is Monero's 120 s consensus target (${BLOCK_TARGET_S})`);

{
  /* A bare 120 in the band module would be the same defect as a hardcoded
     route literal: correct today, silently wrong the day the target moves, and
     invisible to a reader checking the source sentence. The constant is
     declared once and every band reads it. Scope stated: the band module's own
     source text, comments stripped, so the prose above may discuss 120 freely. */
  const src = readFileSync(new URL('./src/pages/network/bands.ts', import.meta.url), 'utf8');
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, '')     // block comments
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1') // line comments (not :// in a URL)
    /* …and the DECLARATION itself, which is the one line that must contain the
       number. Without this the assertion is unsatisfiable by any correct file —
       it went red on the very constant it exists to promote, which is the
       "assertion that was the wrong statement" family, caught by running it. */
    .replace(/export const BLOCK_TARGET_S\s*=\s*120\s*;/, '');
  const offenders = code.split('\n').filter((l) => /\b120\b/.test(l));
  r.ok(offenders.length === 0,
    `no bare 120 survives outside the declaration (${offenders.length} found; comments and the declaration stripped first)`,
    offenders.join(' | '));
}

/* ── 2 · the cadence band, and the Poisson arithmetic behind it ───── */

r.group('2 · cadence band — ±2σ of the MEAN, because arrivals are Poisson');

{
  /* The numbers that make the mockup's per-tick band wrong. Quoted here so the
     correction survives whoever reads the mockup next and sees 96–150 in it.
     Exponential(τ=120): P(X > x) = exp(−x/τ). */
  const P = (x) => Math.exp(-x / BLOCK_TARGET_S);
  const pWarn = P(150), pCrit = P(200), pFast = 1 - P(96);
  const inHealthy = P(96) - P(150);

  r.ok(Math.abs(pCrit - 0.1889) < 5e-4,
    `P(single interval > 200 s) on a HEALTHY chain = ${pCrit.toFixed(4)} — the mockup's "critical" would fire on ~19% of blocks`);
  r.ok(Math.abs(pWarn - 0.2865) < 5e-4,
    `P(single interval > 150 s) = ${pWarn.toFixed(4)} — its "warn" edge fires on ~29%`);
  r.ok(Math.abs(pFast - 0.5507) < 5e-4,
    `P(single interval < 96 s) = ${pFast.toFixed(4)} — over half of all blocks sit BELOW its healthy floor`);
  r.ok(Math.abs(inHealthy - 0.1628) < 5e-4,
    `⇒ only ${(inHealthy * 100).toFixed(1)}% of a healthy chain's blocks land inside the mockup's per-tick "healthy" band`);
}

{
  /* And the same numbers are very nearly right for the MEAN of 100, which is
     the quantity this page bands. σ = τ/√n. */
  const b = cadenceBand(100);
  r.ok(b.lo === 96 && b.hi === 144,
    `cadenceBand(100) healthy = [${b.lo}, ${b.hi}] s — 120 ± 2σ with σ = 120/√100 = 12 s`);
  r.ok(b.warnHi === 156, `…warn edge at +3σ = ${b.warnHi} s (a healthy chain exceeds it ~0.13% of the time)`);
  r.ok(b.warnLo === null, 'a chain running FAST never escalates to critical — warnLo is null, deliberately');

  const b14 = cadenceBand(14);
  r.ok(b14.lo === 56 && b14.hi === 184,
    `cadenceBand(14) = [${b14.lo}, ${b14.hi}] — a shorter window gives a WIDER band, which is the point (σ = ${(BLOCK_TARGET_S / Math.sqrt(14)).toFixed(1)} s)`);
  r.ok(b14.hi - b14.lo > b.hi - b.lo,
    `band width shrinks as √n: n=14 spans ${b14.hi - b14.lo} s, n=100 spans ${b.hi - b.lo} s`);

  r.ok(cadenceBand(0).lo === cadenceBand(1).lo,
    'n=0 is floored to 1 rather than dividing by zero — a band is still returned, just the widest possible');
}

{
  const b = cadenceBand(100);
  r.ok(classify(120, b) === 'healthy', 'a mean sitting exactly on target classifies healthy');
  r.ok(classify(96, b) === 'healthy' && classify(144, b) === 'healthy', 'the healthy edges are INCLUSIVE on both sides');
  r.ok(classify(150, b) === 'warn', 'a mean between +2σ and +3σ classifies warn (150 s)');
  r.ok(classify(200, b) === 'critical', 'a mean beyond +3σ classifies critical (200 s)');
  r.ok(classify(60, b) === 'warn', 'a mean far BELOW target is warn, never critical (60 s)');
  r.ok(classify(Number.NaN, b) === 'healthy', 'a non-finite reading does not manufacture an alarm');
}

/* ── 3 · every band carries a non-empty source naming its window ──── */

r.group('3 · a band without receipts cannot be constructed');

{
  const bands = [
    ['cadenceBand(100)', cadenceBand(100)],
    ['sigmaBand(100 samples)', sigmaBand(Array.from({ length: 100 }, (_, i) => 400 + (i % 7)), bandWindowLabel(100))],
    ['backlogBand(300000)', backlogBand(300_000)],
  ];
  for (const [name, b] of bands) {
    r.ok(b != null && typeof b.source === 'string' && b.source.length > 40,
      `${name} carries a source sentence (${b ? b.source.length : 0} chars)`);
  }

  /* The load-bearing one: the sigma band's sentence must contain the window it
     was actually measured over, and must NOT claim a month. */
  const sb = sigmaBand(Array.from({ length: 100 }, (_, i) => 400 + (i % 7)), bandWindowLabel(100));
  r.ok(sb.source.includes('100'), `the ±1σ sentence names its sample count — "${sb.source.slice(0, 60)}…"`);
  r.ok(!/30[- ]day|30 days|month/i.test(sb.source),
    'the ±1σ sentence does NOT claim a 30-day window — the data does not cover one');

  const cb = cadenceBand(100);
  r.ok(cb.source.includes('Poisson'), 'the cadence sentence names the distribution its band depends on');
  r.ok(cb.source.includes(String(BLOCK_TARGET_S)), 'the cadence sentence names the consensus target it is derived from');

  const bb = backlogBand(300_000);
  r.ok(/node/i.test(bb.source), 'the backlog sentence attributes its divisor to the node');
  r.ok(bb.source.includes('300,000'), 'the backlog sentence prints the actual limit it divided by');
}

/* ── 4 · the window label is wall-clock, never bare blocks ────────── */

r.group('4 · bandWindowLabel converts blocks to time at the target');

r.ok(bandWindowLabel(14) === '14 blocks ≈ 28 min', `14 blocks reads "${bandWindowLabel(14)}"`);
r.ok(bandWindowLabel(100) === '100 blocks ≈ 3.3 h', `100 blocks reads "${bandWindowLabel(100)}"`);
r.ok(bandWindowLabel(2160) === '2160 blocks ≈ 3.0 days', `2160 blocks reads "${bandWindowLabel(2160)}" — the true span of api/xmr.js's "30d"`);
r.ok(/≈/.test(bandWindowLabel(100)), 'the label is explicitly approximate — actual intervals vary');

/* ── 5 · sigmaBand refuses to invent statistics ───────────────────── */

r.group('5 · a σ over too few samples is not returned at all');

{
  const few = Array.from({ length: MIN_SIGMA_SAMPLES - 1 }, (_, i) => i);
  r.ok(sigmaBand(few, bandWindowLabel(few.length)) === null,
    `${MIN_SIGMA_SAMPLES - 1} samples returns null (below MIN_SIGMA_SAMPLES=${MIN_SIGMA_SAMPLES}) — noise wearing a Greek letter is still noise`);
  const enough = Array.from({ length: MIN_SIGMA_SAMPLES }, (_, i) => i);
  r.ok(sigmaBand(enough, bandWindowLabel(enough.length)) !== null,
    `${MIN_SIGMA_SAMPLES} samples returns a band — the floor is a floor, not a moat`);

  /* Sample (n−1) rather than population (n). On a short window the difference
     is not cosmetic: it is the difference between under-reporting the spread
     of exactly the window this page has. */
  const xs = [2, 4, 4, 4, 5, 5, 7, 9];   // textbook set: population σ = 2, sample σ = 2.13809…
  const b = sigmaBand(xs, 'test');
  const mean = meanOf(xs);
  r.ok(mean === 5, `mean of the reference set is ${mean}`);
  r.ok(Math.abs((b.hi - mean) - 2.13809) < 1e-4,
    `±1σ uses the SAMPLE deviation (n−1): got ${(b.hi - mean).toFixed(5)}, population form would give 2.00000`);

  r.ok(sigmaBand([1, 2, NaN, 4, 5, 6, 7, 8, 9], 'test') !== null,
    'non-finite samples are filtered rather than poisoning the mean');
  r.ok(meanOf([]) === null, 'meanOf([]) is null, not 0 — "no samples" is not a reading of zero');
}

/* ── 6 · the backlog band refuses a guessed divisor ───────────────── */

r.group('6 · backlogBand needs a node-reported limit');

r.ok(backlogBand(0) === null, 'a zero limit returns null — a backlog over a guessed capacity is fabricated');
r.ok(backlogBand(-1) === null, 'a negative limit returns null');
r.ok(backlogBand(Number.NaN) === null, 'a non-finite limit returns null');
{
  const b = backlogBand(300_000);
  r.ok(classify(0.4, b) === 'healthy', 'under one block of backlog is healthy');
  r.ok(classify(2, b) === 'warn', 'two blocks deep is warn');
  r.ok(classify(4, b) === 'critical', 'four blocks deep is critical');
  r.ok(classify(0, b) === 'healthy', 'an EMPTY mempool is healthy, never critical — warnLo is null');
}

/* ── 7 · worstZone drives the page-header summary ─────────────────── */

r.group('7 · worstZone is a max over severity, not a vote');

r.ok(worstZone([]) === 'healthy', 'no readings summarise as healthy');
r.ok(worstZone(['healthy', 'healthy', 'warn']) === 'warn', 'one warn among many healthy summarises as warn');
r.ok(worstZone(['critical', 'healthy']) === 'critical', 'one critical dominates');
r.ok(worstZone(['warn', 'critical', 'warn']) === 'critical', 'critical beats a warn majority — severity, not counting');

/* ── 8 · the ±1σ sentence's PROVENANCE CLAUSE, defended at the call sites ──
   D0837 added six small-multiple tiles. Ruling on the "any new band shape
   extends this gate" criterion: there is NO new shape — `SeriesTile` renders
   a `Band` and constructs none, and all four banded series go through the
   `sigmaBand` above. The criterion is met by ARGUMENT, and this section is
   what stops the argument from decaying into a claim.

   The thing at risk is one CLAUSE. `sigmaBand`'s sentence ends "measured from
   the node's own block headers", which is true of all four of today's banded
   series — block difficulty, header-timestamp intervals, block weights, and
   the stream (whose seed the server builds from `get_block_headers_range`).
   It would become FALSE the moment a session buffer were banded: `hashSeries`
   and `mempoolSeries` accumulate in the tab and are not headers. Both session
   tiles correctly pass `band: null` today, with a reason.

   §3 was believed to pin this clause and does NOT — it asserts only that the
   sentence is >40 chars, names its sample count, and does not claim a month.
   So a session series could be banded, the sentence would assert a source it
   does not have, and all 48 assertions here would stay green. That is this
   repo's standing failure mode — a pinned assertion protecting a sentence
   that has quietly become false — so the clause and its call sites are pinned
   together, because either alone is satisfiable while the other rots. */

r.group('8 · the ±1σ provenance clause is true of every series that bands');

{
  const PAGE = './src/pages/NetworkPage.tsx';
  const src = readFileSync(new URL(PAGE, import.meta.url), 'utf8');
  const strip = (s) => s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  const code = strip(src);

  const sb = sigmaBand(Array.from({ length: 100 }, (_, i) => 400 + (i % 7)), bandWindowLabel(100));
  r.ok(/node's own block headers/.test(sb.source),
    'the ±1σ sentence still claims the node\'s own block headers as its source');

  /* The session buffers, by the identifiers the page builds them under. A
     NEGATIVE list rather than a positive one: banding something header-derived
     is fine and unbounded, banding one of these two is the specific lie. */
  const SESSION_SERIES = ['hashSeries', 'mempoolSeries'];
  const banded = [...code.matchAll(/sigmaBand\(\s*([A-Za-z_$][\w$]*)/g)].map((m) => m[1]);
  r.ok(banded.length > 0,
    `the page has sigmaBand call sites to check (${banded.length}: ${banded.join(', ')}) — a zero here would pass this section vacuously`);
  const lying = banded.filter((v) => SESSION_SERIES.includes(v));
  r.ok(lying.length === 0,
    `no SESSION buffer is banded — ${SESSION_SERIES.join(' / ')} are accumulated in the tab, not read from headers, so the sentence above would be false of them`,
    lying.join(', '));

  /* A tile that drops its band must say why, or "no band" becomes
     indistinguishable from "nobody thought about it". */
  const nullBands = (code.match(/band:\s*null/g) || []).length;
  const reasons = (code.match(/noBandReason:/g) || []).length;
  r.ok(nullBands > 0 && reasons === nullBands,
    `every band-less tile carries a noBandReason (${nullBands} null, ${reasons} reasons)`);
}

r.finish();
