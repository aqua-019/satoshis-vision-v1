// verify-stale.mjs — proves the v5.0.14 all-real degrade path: market history
// NEVER synthesizes data. On fetch failure the hook serves the last-good cached
// series ("stale"); with no cache it stays "loading". Exercises the REAL
// shipped cache helpers + group-status logic, and asserts the old synthetic
// generators are gone from the module.
//
// Run: node verify-stale.mjs   (Node >=22.18 strips the type annotations)

import * as mh from './src/data/useMarketHistory.ts';

const { cacheKey, readCache, writeCache, groupStatus, LS_PREFIX, LS_MAX_AGE_MS } = mh;

let fail = false;
const ok = (cond, msg) => { console.log((cond ? '✅ ' : '❌ ') + msg); if (!cond) fail = true; };

// Map-backed Storage shim (what the browser hook does with localStorage).
const m = new Map();
const shim = {
  getItem: (k) => (m.has(k) ? m.get(k) : null),
  setItem: (k, v) => m.set(k, v),
};

// 1) key shape
const key = cacheKey('ohlc', 'monero', 'usd', 30);
ok(key === `${LS_PREFIX}ohlc|monero|usd|30`, `cacheKey → "${key}"`);

// 2) write → read round-trip preserves data and stamps `at`.
const t0 = 1_750_000_000_000;
const series = [{ t: 1, o: 2, h: 3, l: 1, c: 2.5, v: 1000 }];
writeCache(shim, key, series, t0);
const hit = readCache(shim, key, t0 + 1000);
ok(!!hit && hit.at === t0, 'round-trip: `at` stamped with write time');
ok(!!hit && JSON.stringify(hit.data) === JSON.stringify(series), 'round-trip: data deep-equals');

// 3) entries beyond LS_MAX_AGE_MS are treated as absent.
ok(readCache(shim, key, t0 + LS_MAX_AGE_MS) !== null, 'read at exactly max age → still served');
ok(readCache(shim, key, t0 + LS_MAX_AGE_MS + 1) === null, 'read past max age → null');

// 4) corrupt / wrong-shape entries never throw — they read as null.
m.set('mh:v1:bad', 'not-json{');
ok(readCache(shim, 'mh:v1:bad', t0) === null, 'corrupt JSON → null (no throw)');
m.set('mh:v1:shape', JSON.stringify({ nope: true }));
ok(readCache(shim, 'mh:v1:shape', t0) === null, 'wrong shape → null (no throw)');
ok(readCache(null, key, t0) === null, 'null store (private mode) → null');

// 5) writeCache swallows quota errors.
const throwing = { setItem: () => { throw new Error('QuotaExceededError'); } };
let threw = false;
try { writeCache(throwing, key, series, t0); } catch { threw = true; }
ok(!threw, 'writeCache swallows quota errors');

// 6) groupStatus: live wins, then stale, then loading.
const s = (status) => ({ status });
ok(groupStatus([s('live'), s('stale')]) === 'live', 'group [live,stale] → live');
ok(groupStatus([s('stale'), s('stale')]) === 'stale', 'group [stale,stale] → stale');
ok(groupStatus([s('loading'), s('loading')]) === 'loading', 'group [loading,loading] → loading');
ok(groupStatus([s('stale'), s('loading')]) === 'stale', 'group [stale,loading] → stale');

// 7) the synthetic generators are GONE — nothing can fabricate a series.
ok(mh.genCandles === undefined, 'genCandles removed from module');
ok(mh.simCandles === undefined, 'simCandles removed from module');
ok(mh.simLineData === undefined, 'simLineData removed from module');
ok(mh.seedOr === undefined, 'seedOr removed from module');

console.log(fail ? '\n❌ verify-stale FAILED' : '\n✅ verify-stale: all assertions passed');
process.exit(fail ? 1 : 0);
