// verify-feedstatus.mjs — proves the v6.1.4 feed status union is TOTAL, that its
// phase is DERIVED rather than stored, and that `feedDegraded` still means
// exactly what the four booleans it replaced meant.
//
// Run: node verify-feedstatus.mjs   (Node >=22.18 strips the type annotations)
//
// Exercises the REAL shipped module — no rendering, no DOM, no network.
//
// Why the truth table matters more than the type: TypeScript proves the union is
// closed, but nothing in the type system proves that "never succeeded and now
// failing" maps to `error` rather than `loading`. That single mapping is the
// whole point of the change — it is what stops a dead-from-cold feed rendering
// a spinner forever — so it gets asserted over every cell, not spot-checked.

import { readFileSync } from 'node:fs';

const f = await import('./src/data/feed-status.ts');
const {
  FEED_KEYS, FEED_ENDPOINT, STALE_AFTER, BOOT_OBS,
  deriveStatus, deriveAll, hasData, isStale, isDown, isDegraded,
  feedDegraded, chromePhase, lastOkAt,
  CHAIN_CHROME_KEYS, CHAIN_MARKET_CHROME_KEYS,
} = f;

let fail = false;
const ok = (cond, msg) => { console.log((cond ? '✅ ' : '❌ ') + msg); if (!cond) fail = true; };
const group = (t) => console.log(`\n— ${t} —`);

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
/* Comments legitimately NAME the fields this gate proves are gone, so strip them
   before grepping — the same reason verify-memshell.mjs strips them. */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const obs = (okAt, fails, reason = null) => ({ okAt, fails, reason });

/* ── 1 · the keys ────────────────────────────────────────────────────── */
group('keys');
ok(FEED_KEYS.length === 6, `six endpoints tracked (got ${FEED_KEYS.length})`);
ok(FEED_KEYS.every((k) => typeof FEED_ENDPOINT[k] === 'string' && FEED_ENDPOINT[k].startsWith('/api/')),
   'every key names a same-origin /api/ endpoint');
ok(Object.keys(FEED_ENDPOINT).length === FEED_KEYS.length,
   'FEED_ENDPOINT has exactly one entry per key — no orphan, no missing');
ok(FEED_KEYS.every((k) => Number.isInteger(STALE_AFTER[k]) && STALE_AFTER[k] > 0),
   'every key has a positive failure threshold');
ok(FEED_KEYS.every((k) => BOOT_OBS[k].okAt === 0 && BOOT_OBS[k].fails === 0),
   'BOOT_OBS starts every key at "never succeeded, never failed"');

/* ── 2 · the truth table. This is the assertion that matters. ─────────── */
group('deriveStatus — the full 2×2');
{
  const T = STALE_AFTER.network;                       // 2

  const loading = deriveStatus(obs(0, 0), 'network');
  ok(loading.phase === 'loading', 'never succeeded + not failing → loading');
  ok(loading.at === null, '  …and carries no timestamp');

  const stillLoading = deriveStatus(obs(0, T - 1), 'network');
  ok(stillLoading.phase === 'loading',
     'never succeeded + failing BELOW threshold → still loading (one miss is a wobble)');

  const errored = deriveStatus(obs(0, T), 'network');
  ok(errored.phase === 'error',
     'never succeeded + failing AT threshold → error, NOT loading — the state the old `ready` boolean could not express');
  ok(errored.at === null, '  …and still carries no timestamp, because there is nothing to show');
  ok(errored.reason !== null, '  …and carries a reason');

  const live = deriveStatus(obs(1000, 0), 'network');
  ok(live.phase === 'live' && live.at === 1000, 'succeeded + not failing → live, with its timestamp');

  const wobble = deriveStatus(obs(1000, T - 1), 'network');
  ok(wobble.phase === 'live', 'succeeded + failing below threshold → still live');

  const stale = deriveStatus(obs(1000, T), 'network');
  ok(stale.phase === 'stale' && stale.at === 1000,
     'succeeded + failing at threshold → stale, and `at` is LAST-GOOD so data stays renderable');

  // The type guard is the payoff — `at` is number exactly when there is data.
  ok(hasData(live) && hasData(stale) && !hasData(loading) && !hasData(errored),
     'hasData() is true for exactly the two phases that carry a timestamp');
  ok(isStale(stale) && !isStale(live) && !isStale(errored), 'isStale() means stale and nothing else');
  ok(isDown(errored) && !isDown(stale), 'isDown() means error and nothing else');
  ok(isDegraded(stale) && isDegraded(errored) && !isDegraded(live) && !isDegraded(loading),
     'isDegraded() covers stale ∪ error');
}

/* ── 3 · feedDegraded — the pair-AND rule, preserved verbatim ─────────── */
group('feedDegraded — preserves the pre-v6.1.4 pair-AND semantics');
{
  const up = obs(1000, 0);
  const down = obs(1000, 9);
  const mk = (over) => deriveAll({ ...BOOT_OBS, mempool: up, fees: up, tip: up, network: up, blocks: up, ...over });

  ok(feedDegraded(mk({})) === false, 'everything healthy → not degraded');

  // The heart of it: the old fast tier only counted a failure when BOTH of its
  // endpoints failed, so a single dead endpoint has NEVER raised STALE.
  ok(feedDegraded(mk({ mempool: down })) === false,
     'mempool alone failing → NOT degraded (single-endpoint failure never raised STALE before)');
  ok(feedDegraded(mk({ fees: down })) === false, 'fees alone failing → NOT degraded');
  ok(feedDegraded(mk({ network: down })) === false, 'network alone failing → NOT degraded');
  ok(feedDegraded(mk({ blocks: down })) === false, 'blocks alone failing → NOT degraded');

  ok(feedDegraded(mk({ mempool: down, fees: down })) === true,
     'BOTH fast-tier endpoints failing → degraded');
  ok(feedDegraded(mk({ network: down, blocks: down })) === true,
     'BOTH chain-tier endpoints failing → degraded');

  // market and tip are excluded, and that exclusion is load-bearing.
  ok(feedDegraded(mk({ market: down })) === false,
     'CoinGecko down does NOT mark the chain feed stale — different upstream, different provenance');
  ok(feedDegraded(mk({ market: down, tip: down })) === false,
     'market + tip down still does not degrade the chain feed');
  ok(feedDegraded(mk({ tip: down })) === false,
     'a failed tip watch falls through to the full pull — a cost, not a degradation');

  // Cross-pair failures must NOT degrade: one endpoint from each pair is exactly
  // the case the old counters reset on.
  ok(feedDegraded(mk({ mempool: down, network: down })) === false,
     'one endpoint from each pair failing → NOT degraded (each pair still has a survivor)');
}

/* ── 4 · chromePhase — the pill's three-way, unchanged ────────────────── */
group('chromePhase');
{
  const up = obs(1000, 0);
  const down = obs(1000, 9);
  const never = obs(0, 0);
  const neverFailing = obs(0, 9);
  const mk = (over) => deriveAll({ ...BOOT_OBS, ...over });

  ok(chromePhase(mk({ network: never }), CHAIN_CHROME_KEYS) === 'loading',
     'cold boot → loading (the CONNECTING pill)');
  ok(chromePhase(mk({ network: neverFailing }), CHAIN_CHROME_KEYS) === 'error',
     'cold AND failing → error — representable at last');
  ok(chromePhase(mk({ network: up, mempool: up, fees: up, blocks: up, tip: up }), CHAIN_CHROME_KEYS) === 'live',
     'healthy → live');
  ok(chromePhase(mk({ network: down, blocks: down }), CHAIN_CHROME_KEYS) === 'stale',
     'chain pair down after a good start → stale');
  ok(chromePhase(mk({ network: never, market: up }), CHAIN_MARKET_CHROME_KEYS) === 'live',
     'NavTop: price landing is enough to stop saying CONNECTING, as before');

  // It must NOT be a worst-wins roll-up — that would be a louder rule than ships today.
  ok(chromePhase(mk({ network: up, mempool: down }), CHAIN_CHROME_KEYS) !== 'stale',
     'one stale endpoint does not turn the chrome pill yellow (not a worst-wins roll-up)');
}

/* ── 5 · lastOkAt ────────────────────────────────────────────────────── */
group('lastOkAt');
{
  const m = deriveAll({ ...BOOT_OBS, network: obs(500, 0), blocks: obs(900, 0), market: obs(0, 0) });
  ok(lastOkAt(m) === 900, 'returns the newest success across keys (got ' + lastOkAt(m) + ')');
  ok(lastOkAt(deriveAll(BOOT_OBS)) === 0, 'zero when nothing has ever succeeded');
}

/* ── 6 · D1624 — the phase is DERIVED, never stored ──────────────────── */
group('D1624 · derived, not stored');
{
  const feed = stripComments(read('./src/data/xmrirish-feed.ts'));
  const types = stripComments(read('./src/data/types.ts'));
  const map = stripComments(read('./src/data/map.ts'));

  for (const field of ['live', 'ready', 'marketReady', 'stale']) {
    ok(!new RegExp(`\\b${field}\\s*:\\s*(true|false|boolean)`).test(types),
       `MoneroLive no longer declares \`${field}\``);
  }
  ok(/status\s*:\s*FeedStatusMap/.test(types), 'MoneroLive declares `status: FeedStatusMap`');

  // The feed must not write a phase into state — that was the bug.
  ok(!/\b(ready|marketReady|stale|live)\s*:\s*(true|false|!?[a-z])/i.test(feed),
     'the feed assigns no status boolean anywhere');
  ok(/deriveAll\(/.test(feed), 'the feed derives its status map during render');
  ok(/useMemo/.test(feed), 'the derived snapshot is memoised (12 context consumers read it)');
  ok(!/\blive\s*:\s*true/.test(map), 'map.ts no longer stamps `live: true`');

  // lastUpdate stays the heartbeat map.ts stamps — NOT max(at). Swapping it would
  // freeze the mempool LED and NetRail's clock during an outage, which is the
  // freshness work's job, not this one's.
  ok(/lastUpdate\s*=\s*Date\.now\(\)/.test(map) || /lastUpdate:\s*Date\.now\(\)/.test(map),
     'map.ts still stamps lastUpdate per commit (the feed heartbeat is unchanged)');
  ok(!/lastUpdate:\s*lastOkAt/.test(feed), 'the feed does NOT redefine lastUpdate as max(at)');
}

/* ── 7 · one vocabulary ──────────────────────────────────────────────── */
group('one vocabulary');
{
  const mh = stripComments(read('./src/data/useMarketHistory.ts'));
  ok(/export type SeriesStatus = FeedPhase;/.test(mh),
     'useMarketHistory reuses FeedPhase rather than declaring a second status union');
  ok(/import type \{ FeedPhase \}/.test(mh),
     'and imports it type-only, so verify-stale.mjs can still load it in bare Node');

  const src = read('./src/data/feed-status.ts');
  const decls = (src.match(/export type FeedPhase\b/g) || []).length;
  ok(decls === 1, `FeedPhase is declared exactly once (found ${decls})`);
}

console.log('');
console.log(fail ? '❌ verify-feedstatus: FAILED' : '✅ verify-feedstatus: all assertions passed');
process.exit(fail ? 1 : 0);
