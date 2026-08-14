// verify-stale.mjs — proves the v5.0.14 all-real degrade path: market history
// NEVER synthesizes data. On fetch failure the hook serves the last-good cached
// series ("stale"); with no cache it stays "loading". Exercises the REAL
// shipped cache helpers + group-status logic, and asserts the old synthetic
// generators are gone from the module.
//
// Run: node verify-stale.mjs   (Node >=22.18 strips the type annotations)

import * as mh from './src/data/useMarketHistory.ts';

const {
  cacheKey, readCache, writeCache, groupStatus, LS_PREFIX, LS_MAX_AGE_MS,
  seriesColor, PEER_PALETTE, MAJOR_PALETTE, XMR_COLOR, pruneLegacyCache, attachVolume,
} = mh;

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

/* 5b) p3·12 · the base rewrite retires three key KINDS without bumping the
   `mh:v1:` prefix, because no surviving key changed shape. That is only safe if
   the retirement is exhaustive AND surgical — a prune that took one live key
   with it would silently cost every returning visitor their offline fallback,
   which is the whole reason the prefix was NOT bumped. So both directions are
   asserted: everything doomed goes, everything else stays, byte for byte. */
ok(typeof pruneLegacyCache === 'function',
  'useMarketHistory exports pruneLegacyCache (absent = the retirement never runs)');
if (typeof pruneLegacyCache === 'function') {
  const store = new Map([
    // doomed — nothing reads these after p3·12
    [`${LS_PREFIX}ratio|monero|btc|30`, '{"at":1,"data":[1]}'],
    [`${LS_PREFIX}ratio|monero|btc|365`, '{"at":1,"data":[1]}'],
    [`${LS_PREFIX}line|bitcoin|usd|7`, '{"at":1,"data":[1]}'],
    [`${LS_PREFIX}ohlc|monero|usd|90`, '{"at":1,"data":[1]}'],
    [`${LS_PREFIX}ohlc|monero|usd|365`, '{"at":1,"data":[1]}'],
    // survivors — the fine base, the group series, the manifests, the meta
    [`${LS_PREFIX}ohlc|monero|usd|30`, '{"at":1,"data":[1]}'],
    [`${LS_PREFIX}samples|monero|usd|90`, '{"at":1,"data":{}}'],
    [`${LS_PREFIX}samples|monero|btc|365`, '{"at":1,"data":{}}'],
    [`${LS_PREFIX}chart|zcash|usd|30`, '{"at":1,"data":{}}'],
    [`${LS_PREFIX}members|peers|usd|0`, '{"at":1,"data":[]}'],
    [`${LS_PREFIX}meta|monero|usd|0`, '{"at":1,"data":{}}'],
    // a foreign key: this prefix is not ours to sweep
    ['unrelated:thing', 'x'],
  ]);
  const shimStore = {
    get length() { return store.size; },
    key: (i) => [...store.keys()][i] ?? null,
    removeItem: (k) => { store.delete(k); },
  };
  const removed = pruneLegacyCache(shimStore, 30).sort();
  const expected = [
    `${LS_PREFIX}line|bitcoin|usd|7`,
    `${LS_PREFIX}ohlc|monero|usd|365`,
    `${LS_PREFIX}ohlc|monero|usd|90`,
    `${LS_PREFIX}ratio|monero|btc|30`,
    `${LS_PREFIX}ratio|monero|btc|365`,
  ].sort();
  ok(JSON.stringify(removed) === JSON.stringify(expected),
    `prune removes exactly the five retired keys (got ${removed.length}: ${JSON.stringify(removed)})`);
  ok(store.size === 7, `prune leaves the six live keys + the foreign one (${store.size})`);
  ok(store.has(`${LS_PREFIX}ohlc|monero|usd|30`), 'prune KEEPS the fine base — the offline fallback survives');
  ok(store.has('unrelated:thing'), 'prune touches nothing outside the mh: prefix');
  ok(pruneLegacyCache(null).length === 0, 'prune on a null store (private mode) is a no-op');
  const again = pruneLegacyCache(shimStore, 30);
  ok(again.length === 0, `prune is idempotent — a second pass removes nothing (${again.length})`);
}

/* 5c) p3·12b · attachVolume, the three properties that shipped a wrong dollar
   figure between them. Pure, so it is exercised here rather than only through a
   browser: the DOM gate proves the number on screen, this proves the function.

   Samples: hourly, constant 100 per sample, spanning 24 h. */
if (typeof attachVolume === 'function') {
  const H = 3_600_000, D = 86_400_000;
  const hourly = { t: [], p: [], v: [], stepMs: H };
  for (let i = 0; i < 24; i++) { hourly.t.push(i * H); hourly.p.push(1); hourly.v.push(100); }
  const cand = (ts) => ts.map((t) => ({ t, o: 1, h: 1, l: 1, c: 1, v: 0 }));

  /* THE ORIGINAL DEFECT. Three 4h buckets covering 0-12h, against 24h of
     samples: the old code closed the last bucket at Infinity, so it took the
     other twelve hours with it. 400, not 1,300. */
  const three = attachVolume(cand([0, 4 * H, 8 * H]), hourly, 4 * H);
  ok(JSON.stringify(three.map((c) => c.v)) === JSON.stringify([400, 400, 400]),
    `the last bucket takes 4 samples, not the rest of the series (${JSON.stringify(three.map((c) => c.v))})`);

  /* A GAP is not absorbed. Buckets at 0 and 8h with 4h missing: the 4-7h
     samples belong to a bucket nobody drew, so they belong to nobody. The old
     `candles[i+1].t` bound gave the first bucket 800. */
  const gapped = attachVolume(cand([0, 8 * H]), hourly, 4 * H);
  ok(JSON.stringify(gapped.map((c) => c.v)) === JSON.stringify([400, 400]),
    `a bucket before a gap does not absorb the gap (${JSON.stringify(gapped.map((c) => c.v))})`);

  /* A SOURCE COARSER THAN THE BUCKET IS REFUSED. Daily samples cannot be
     apportioned across 4h buckets without inventing the split, so no volume is
     attached at all and the UI renders an em-dash. Reachable whenever the
     90-day fetch fails and the 365-day one succeeds. */
  const daily = { t: [0, D], p: [1, 1], v: [2400, 2400], stepMs: D };
  const refused = attachVolume(cand([0, 4 * H, 8 * H]), daily, 4 * H);
  ok(refused.every((c) => c.v === 0),
    `daily samples are refused for 4h buckets — em-dash, never a day in a 4h bar (${JSON.stringify(refused.map((c) => c.v))})`);
  /* ...and the same samples ARE accepted once the bucket is wide enough. This
     is the pair's vacuity guard: without it, a function that always refused
     would pass the check above. */
  const accepted = attachVolume(cand([0, D]), daily, D);
  ok(JSON.stringify(accepted.map((c) => c.v)) === JSON.stringify([2400, 2400]),
    `the same daily samples ARE attached at a 1d bucket (${JSON.stringify(accepted.map((c) => c.v))})`);

  /* No source, no bucket, empty series — all no-ops rather than throws. */
  ok(attachVolume(cand([0]), null, 4 * H)[0].v === 0, 'a null sample base attaches nothing');
  ok(attachVolume(cand([0]), hourly, 0)[0].v === 0, 'a zero bucket width attaches nothing');
} else {
  ok(false, 'useMarketHistory exports attachVolume (absent = the volume rule is unverifiable here)');
}

// 6) groupStatus: live wins, then stale, then loading.
const s = (status) => ({ status });
ok(groupStatus([s('live'), s('stale')]) === 'live', 'group [live,stale] → live');
ok(groupStatus([s('stale'), s('stale')]) === 'stale', 'group [stale,stale] → stale');
ok(groupStatus([s('loading'), s('loading')]) === 'loading', 'group [loading,loading] → loading');
ok(groupStatus([s('stale'), s('loading')]) === 'stale', 'group [stale,loading] → stale');

// 6b) v6.1.4 — SeriesStatus is FeedPhase now, so `error` joined the union.
// It ranks BELOW live and stale (either of those means something is renderable)
// and is only reached when every member is down. A mix of error and loading is
// still partly in flight, and "loading" is the honest word for that.
ok(groupStatus([s('error'), s('error')]) === 'error', 'group [error,error] → error');
ok(groupStatus([s('error'), s('loading')]) === 'loading',
   'group [error,loading] → loading (still partly in flight — never overstate a failure)');
ok(groupStatus([s('live'), s('error')]) === 'live', 'group [live,error] → live (something renders)');
ok(groupStatus([s('stale'), s('error')]) === 'stale', 'group [stale,error] → stale (last-good renders)');
ok(groupStatus([]) === 'loading', 'group [] → loading, never error (nothing was attempted)');

// 7) the synthetic generators are GONE — nothing can fabricate a series.
ok(mh.genCandles === undefined, 'genCandles removed from module');
ok(mh.simCandles === undefined, 'simCandles removed from module');
ok(mh.simLineData === undefined, 'simLineData removed from module');
ok(mh.seedOr === undefined, 'seedOr removed from module');

// 8) hardcoded group membership is GONE — the aggregator owns rankings now.
ok(mh.PEER_GROUP === undefined, 'PEER_GROUP removed from module');
ok(mh.TOP_GROUP === undefined, 'TOP_GROUP removed from module');

// 9) the membership manifest reuses cacheKey() unchanged, days pinned to 0.
const membersKey = cacheKey('members', 'peers', 'usd', 0);
ok(membersKey === `${LS_PREFIX}members|peers|usd|0`, `members manifest key → "${membersKey}"`);
ok(cacheKey('members', 'majors', 'usd', 0) === `${LS_PREFIX}members|majors|usd|0`, 'majors manifest key shape');

// 10) seriesColor: index 0 is always XMR_COLOR, regardless of group; palettes
//     are the declared sizes with no internal duplicate colours.
ok(seriesColor('peers', 0) === 'var(--tk-accent)', "seriesColor('peers', 0) → XMR accent");
ok(seriesColor('majors', 0) === 'var(--tk-accent)', "seriesColor('majors', 0) → XMR accent");
ok(seriesColor('peers', 0) === XMR_COLOR && seriesColor('majors', 0) === XMR_COLOR, 'both groups agree with XMR_COLOR export');
ok(PEER_PALETTE.length === 5, `PEER_PALETTE has 5 entries (got ${PEER_PALETTE.length})`);
ok(MAJOR_PALETTE.length === 8, `MAJOR_PALETTE has 8 entries (got ${MAJOR_PALETTE.length})`);
ok(new Set(PEER_PALETTE).size === PEER_PALETTE.length, 'PEER_PALETTE entries are all distinct');
ok(new Set(MAJOR_PALETTE).size === MAJOR_PALETTE.length, 'MAJOR_PALETTE entries are all distinct');
const peerColors1to5 = [1, 2, 3, 4, 5].map((i) => seriesColor('peers', i));
ok(new Set(peerColors1to5).size === 5, 'seriesColor("peers", 1..5) are 5 distinct colours');
const majorColors1to5 = [1, 2, 3, 4, 5].map((i) => seriesColor('majors', i));
ok(new Set(majorColors1to5).size === 5, 'seriesColor("majors", 1..5) are 5 distinct colours');

console.log(fail ? '\n❌ verify-stale FAILED' : '\n✅ verify-stale: all assertions passed');
process.exit(fail ? 1 : 0);
