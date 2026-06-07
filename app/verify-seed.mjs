// verify-seed.mjs — proves the P3 fallback-seed hardening: a transient CoinGecko
// failure now seeds the synthetic random-walk from the live spot instead of the
// hardcoded SYNTH_ANCHOR baseline. Exercises the REAL shipped helpers.
//
// genCandles sets the first candle's OPEN exactly to `start` (`let p = start;
// const o = p`), so the seed threading is deterministically assertable.
//
// Run: node verify-seed.mjs   (Node >=22.18 strips the type annotations)

import { seedOr, simCandles, simLineData, genCandles } from './src/data/useMarketHistory.ts';

let fail = false;
const ok = (cond, msg) => { console.log((cond ? '✅ ' : '❌ ') + msg); if (!cond) fail = true; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;

// 1) seedOr guard: live spot when usable, anchor otherwise.
ok(seedOr(302.5, 160) === 302.5, 'seedOr(302.5,160) === 302.5 (uses live spot)');
ok(seedOr(undefined, 160) === 160, 'seedOr(undefined,160) === 160 (anchor)');
ok(seedOr(0, 160) === 160, 'seedOr(0,160) === 160 (anchor)');
ok(seedOr(NaN, 160) === 160, 'seedOr(NaN,160) === 160 (anchor)');
ok(seedOr(-5, 160) === 160, 'seedOr(-5,160) === 160 (anchor)');
ok(seedOr(Infinity, 160) === 160, 'seedOr(Infinity,160) === 160 (anchor)');

// 2) genCandles seeds the first open exactly.
ok(genCandles(10, 500, 5, 7)[0].o === 500, 'genCandles first open === seed (500)');

// 3) simCandles (XMR/USD fallback): seeded near live spot, default at anchor 160.
const seeded = simCandles(30, 302.5);
const anchor = simCandles(30);
ok(seeded[0].o === 302.5, 'simCandles(30, 302.5) first open === 302.5 (live spot)');
ok(anchor[0].o === 160, 'simCandles(30) first open === 160 (SYNTH_ANCHOR default)');
const mSeed = mean(seeded.map((c) => c.c));
const mAnch = mean(anchor.map((c) => c.c));
console.log(`   mean close — seeded@302.5: ${mSeed.toFixed(1)} · anchor@160: ${mAnch.toFixed(1)}`);
ok(mSeed > 260, 'simCandles(30, 302.5) walk stays near live spot (mean > 260, not ~192)');
ok(mAnch < 230, 'simCandles(30) walk stays near anchor (mean < 230)');

// 4) simLineData (BTC/USD fallback): seeded near live spot, default at anchor 60000.
const btcSeed = simLineData('bitcoin', 30, 95000);
const btcAnch = simLineData('bitcoin', 30);
ok(near(btcSeed[0], 95000, 3000), 'simLineData("bitcoin",30,95000) first close near 95000');
ok(near(btcAnch[0], 60000, 5000), 'simLineData("bitcoin",30) first close near 60000 (anchor)');

// 5) XMR/BTC ratio fallback seed (via genCandles, the same path the hook uses).
ok(seedOr(0.0048, 0.0035) === 0.0048, 'seedOr(0.0048,0.0035) === 0.0048 (live ratio used)');
ok(genCandles(20, seedOr(undefined, 0.0035), 0.00008, 30)[0].o === 0.0035, 'ratio fallback first open === 0.0035 anchor when no spot');

console.log(fail ? '\nSEED CHECKS FAILED' : '\nALL SEED CHECKS PASSED');
process.exit(fail ? 1 : 0);
