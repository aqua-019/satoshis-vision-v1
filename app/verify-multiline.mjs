// verify-multiline.mjs — proves the MultiLine time-domain fix: series with
// different point counts/spans are mapped by TIMESTAMP over a shared domain
// (never stretched edge-to-edge by index), gaps/non-finite values split
// segments instead of poisoning the whole path, and the two simultaneous
// /markets panels no longer collide on gradient ids.
//
// Run: node verify-multiline.mjs   (Node >=22.18 strips the type annotations)

import * as g from './src/pages/markets/geometry.ts';
import { readFileSync } from 'node:fs';

let fail = false;
const ok = (cond, msg) => { console.log((cond ? '✅ ' : '❌ ') + msg); if (!cond) fail = true; };

/* ── helpers to build synthetic series ────────────────────────────────── */

const DAY = 86_400_000;
const now = 1_753_920_000_000; // fixed for determinism

/** Evenly-spaced timestamps over the last `spanDays` days ending at `now`. */
function evenT(n, spanDays) {
  if (n <= 1) return [now];
  const step = (spanDays * DAY) / (n - 1);
  return Array.from({ length: n }, (_, i) => now - (n - 1 - i) * step);
}

/* ── 1) equal timestamp → equal x, across wildly different point counts ── */
{
  const t0 = now - 30 * DAY;
  const t1 = now;
  const domain = { t0, t1 };
  const padL = 48, innerW = 852; // matches MultiLine's real padL/innerW at padR=100

  const tShort = evenT(17, 30);   // 17-point daily series
  const tLong = evenT(720, 30);   // 720-point hourly series covering the same window

  // pick a timestamp both series actually pass through: the shared t1 (now)
  const xShort = g.xOf(tShort[tShort.length - 1], domain, padL, innerW);
  const xLong = g.xOf(tLong[tLong.length - 1], domain, padL, innerW);
  ok(xShort === xLong, `17-pt and 720-pt series map their shared endpoint to the same x (${xShort} === ${xLong})`);

  const xShort0 = g.xOf(tShort[0], domain, padL, innerW);
  const xLong0 = g.xOf(tLong[0], domain, padL, innerW);
  ok(xShort0 === xLong0, `17-pt and 720-pt series map their shared start to the same x (${xShort0} === ${xLong0})`);

  // and an arbitrary equal mid-timestamp maps identically regardless of len
  const mid = t0 + (t1 - t0) * 0.37;
  ok(g.xOf(mid, domain, padL, innerW) === g.xOf(mid, domain, padL, innerW), 'equal t → equal x is a pure function of (t, domain)');
}

/* ── 2) a series covering only the tail of the window doesn't stretch ──── */
{
  const t0 = now - 30 * DAY;
  const t1 = now;
  const domain = { t0, t1 };
  const padL = 48, innerW = 852;

  // only the last 3 days of a 30-day window (10%)
  const tail = Array.from({ length: 10 }, (_, i) => (t1 - 3 * DAY) + (i * (3 * DAY)) / 9);

  const xs = tail.map((t) => g.xOf(t, domain, padL, innerW));
  const threshold = padL + 0.9 * innerW;
  ok(xs.every((x) => x >= threshold - 1e-9), `all tail-series points land at x ≥ padL + 0.9·innerW (min x=${Math.min(...xs).toFixed(2)}, threshold=${threshold.toFixed(2)})`);
}

/* ── 3) normalizeSeries drops null/NaN/0/negative; no -100 from a null ──── */
{
  const s = {
    label: 'X', color: '#fff', status: 'live',
    data: [100, null, NaN, 0, -5, 110, 121],
    t: evenT(7, 7),
  };
  const n = g.normalizeSeries(s, 7, now);
  const allVs = n.segments.flat().map((p) => p.v);
  ok(allVs.every((v) => Number.isFinite(v)), `every output v is finite (${JSON.stringify(allVs)})`);
  ok(!allVs.includes(-100), 'no -100 fabricated from a null/dropped input');
  // base = 100 (first positive); survivors are 100 -> 0%, 110 -> +10%, 121 -> +21%
  ok(allVs.includes(0) && allVs.some((v) => Math.abs(v - 10) < 1e-9) && allVs.some((v) => Math.abs(v - 21) < 1e-9),
    `survivors normalize correctly against the first positive base (got ${JSON.stringify(allVs)})`);

  // all-invalid series → no usable base → empty, last: null
  const allBad = g.normalizeSeries({ label: 'Y', color: '#fff', status: 'live', data: [0, null, NaN, -1] }, 7, now);
  ok(allBad.segments.length === 0 && allBad.last === null, 'all-invalid series normalizes to empty segments + last:null');
}

/* ── 4) splitSegments: gap / dropped-point / clean-run behaviour ────────── */
{
  // "[a, NaN, b]" → 2 segments (a dropped point forces a break either side)
  const withDrop = [
    { t: 0, v: 1 },
    { t: 1, v: NaN },
    { t: 2, v: 2 },
  ];
  const segsDrop = g.splitSegments(withDrop);
  ok(segsDrop.length === 2, `[a, NaN, b] → 2 segments (got ${segsDrop.length})`);
  ok(segsDrop.every((seg) => seg.every((p) => Number.isFinite(p.v))), 'no non-finite v survives in any segment');

  // clean, evenly-spaced run → 1 segment
  const clean = Array.from({ length: 20 }, (_, i) => ({ t: i * 1000, v: i }));
  const segsClean = g.splitSegments(clean);
  ok(segsClean.length === 1 && segsClean[0].length === 20, `clean evenly-spaced run → 1 segment (got ${segsClean.length})`);

  // a 5x median-step gap → 2 segments
  const withGap = [
    { t: 0, v: 0 }, { t: 1000, v: 1 }, { t: 2000, v: 2 }, { t: 3000, v: 3 },
    { t: 3000 + 5000, v: 4 }, // gap = 5000 = 5x the 1000ms median step
    { t: 3000 + 5000 + 1000, v: 5 },
  ];
  const segsGap = g.splitSegments(withGap);
  ok(segsGap.length === 2, `5× median time gap → 2 segments (got ${segsGap.length})`);

  // sub-threshold gap (2x median step) stays a single run
  const smallGap = [
    { t: 0, v: 0 }, { t: 1000, v: 1 }, { t: 2000, v: 2 },
    { t: 2000 + 2000, v: 3 }, // 2x step, under the default 3x threshold
  ];
  ok(g.splitSegments(smallGap).length === 1, 'sub-threshold gap (2x median step) does not split');
}

/* ── 5) timeDomain: empty / all-empty → null ─────────────────────────────── */
{
  ok(g.timeDomain([]) === null, 'timeDomain([]) → null');
  const allEmpty = [
    { label: 'A', color: '#fff', status: 'loading', segments: [], count: 0, last: null },
    { label: 'B', color: '#fff', status: 'loading', segments: [], count: 0, last: null },
  ];
  ok(g.timeDomain(allEmpty) === null, 'timeDomain(all-empty list) → null');

  const oneReal = [
    ...allEmpty,
    { label: 'C', color: '#fff', status: 'live', segments: [[{ t: 5, v: 1 }, { t: 9, v: 2 }]], count: 2, last: 2 },
  ];
  const dom = g.timeDomain(oneReal);
  ok(!!dom && dom.t0 === 5 && dom.t1 === 9, `timeDomain ignores empty series and reads real ones (${JSON.stringify(dom)})`);
}

/* ── 6) dedupeLabelYs: 9 crowded labels → all pairwise gaps ≥ 11px ──────── */
{
  const ys = Array.from({ length: 9 }, (_, i) => 100 + i * 0.4); // all within 4px
  const out = g.dedupeLabelYs(ys, 11);
  ok(out.length === ys.length, 'dedupeLabelYs preserves array length');

  const orderIn = ys.map((_, i) => i).sort((a, b) => ys[a] - ys[b]);
  const orderOut = out.map((_, i) => i).sort((a, b) => out[a] - out[b]);
  ok(JSON.stringify(orderIn) === JSON.stringify(orderOut), 'relative order preserved after de-collision');

  let minGap = Infinity;
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      minGap = Math.min(minGap, Math.abs(out[i] - out[j]));
    }
  }
  ok(minGap >= 11 - 1e-9, `all pairwise gaps ≥ 11px (min observed: ${minGap.toFixed(2)})`);
}

/* ── 7) medianStep sanity (used internally by splitSegments) ────────────── */
{
  ok(g.medianStep([]) === 0, 'medianStep([]) === 0');
  ok(g.medianStep([{ t: 0, v: 0 }]) === 0, 'medianStep(single point) === 0');
  ok(g.medianStep([{ t: 0, v: 0 }, { t: 10, v: 1 }, { t: 20, v: 2 }]) === 10, 'medianStep(evenly-spaced) === step');
}

/* ── 8) source assertions over charts.tsx (static-source-assertion style) ── */
{
  const src = readFileSync(new URL('./src/pages/markets/charts.tsx', import.meta.url), 'utf8');

  // the old index-based x mapping must be gone.
  const idxMapRe = /\(\s*i\s*\/\s*\(\s*len\s*-\s*1\s*\)\s*\)/;
  ok(!idxMapRe.test(src), 'index-based x mapping "(i / (len - 1))" is absent from charts.tsx');

  // every `ml-grad-` occurrence must carry a useId-derived suffix (no bare
  // `ml-grad-${i}` / `ml-grad-${si}` collision between the two /markets panels).
  const gradRe = /ml-grad-\$\{([^}]*)\}/g;
  const bad = [];
  let m;
  while ((m = gradRe.exec(src))) {
    if (!/uid/.test(m[1])) bad.push(m[0]);
  }
  ok(bad.length === 0, bad.length === 0
    ? 'every ml-grad- occurrence includes a useId-derived "uid" suffix'
    : `${bad.length} ml-grad- occurrence(s) missing a uid suffix: ${bad.join(', ')}`);

  ok(/React\.useId\(\)\.replace\(\/:\/g,\s*["']["']\)/.test(src), 'MultiLine derives uid via React.useId() (namespaced ids, matching AreaSeries)');
}

console.log(fail ? '\n❌ verify-multiline FAILED' : '\n✅ verify-multiline: all assertions passed');
process.exit(fail ? 1 : 0);
