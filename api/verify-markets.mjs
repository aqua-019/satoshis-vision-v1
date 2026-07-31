/* verify-markets.mjs — offline unit test for api/markets.js.
   Run: node api/verify-markets.mjs
   This sandbox cannot reach api.coingecko.com, so we verify the pure
   isPegged / isDerivative / selectMembers / parseDays / cacheSeconds /
   downsample / pool helpers against committed fixtures that mirror
   real coins/markets rows (api/_fixtures/cg-markets-privacy.json,
   api/_fixtures/cg-markets-majors.json). Same style as verify-feeds.mjs.
   Live-network verification is deferred to a post-deploy curl pass. */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  isPegged,
  isDerivative,
  selectMembers,
  parseDays,
  cacheSeconds,
  downsample,
  pool,
} from './markets.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let failed = 0;
function ok(cond, msg) {
  if (cond) {
    console.log(`✅ ${msg}`);
  } else {
    console.log(`❌ ${msg}`);
    failed++;
  }
}

const privacyFixture = JSON.parse(readFileSync(join(__dirname, '_fixtures', 'cg-markets-privacy.json'), 'utf8'));
const majorsFixture = JSON.parse(readFileSync(join(__dirname, '_fixtures', 'cg-markets-majors.json'), 'utf8'));
const privacyRows = privacyFixture.rows;
const majorsRows = majorsFixture.rows;

function byId(rows, id) {
  return rows.find((r) => r.id === id);
}
const majorsById = {};
for (const r of majorsRows) majorsById[r.id] = r;

/* ── isPegged ──────────────────────────────────────────────────────── */

ok(isPegged(byId(majorsRows, 'tether')) === true, 'isPegged: USDT (ath 1.32, atl 0.5725) -> true');
ok(isPegged(byId(majorsRows, 'usd-coin')) === true, 'isPegged: USDC -> true');
ok(isPegged(byId(majorsRows, 'dai')) === true, 'isPegged: DAI (ath 3.67, price 1.00) -> true via the |p-1| disjunct');
ok(isPegged(byId(majorsRows, 'euro-coin')) === true, 'isPegged: EURC -> true');
ok(isPegged(byId(majorsRows, 'bitcoin')) === false, 'isPegged: BTC -> false');
ok(isPegged(byId(majorsRows, 'legit-dollar-coin')) === false,
  'isPegged: legit $1.00 coin (ath $47, atl $0.02) -> FALSE (over-filter guard)');

/* Defensive: missing/garbage fields never throw and never look pegged. */
ok(isPegged({}) === false, 'isPegged({}) -> false, no throw');
ok(isPegged({ current_price: 'n/a', ath: 10, atl: 1 }) === false, 'isPegged: non-finite price -> false, no throw');

/* ── isDerivative ──────────────────────────────────────────────────── */

ok(isDerivative(byId(majorsRows, 'wrapped-bitcoin'), majorsById) === true, 'isDerivative: WBTC -> true (descriptor)');
ok(isDerivative(byId(majorsRows, 'staked-ether'), majorsById) === true, 'isDerivative: stETH -> true (descriptor)');
ok(isDerivative(byId(majorsRows, 'wrapped-steth'), majorsById) === true, 'isDerivative: wstETH -> true (descriptor)');
ok(isDerivative(byId(majorsRows, 'coinbase-wrapped-btc'), majorsById) === true, 'isDerivative: cbBTC -> true (descriptor)');
ok(isDerivative(byId(majorsRows, 'innocuous-btc-fund'), majorsById) === true,
  'isDerivative: BTC-priced coin with an innocuous name -> true (price-shadow backstop)');
ok(isDerivative(byId(majorsRows, 'bitcoin'), majorsById) === false, 'isDerivative: BTC itself -> false');
ok(isDerivative(byId(majorsRows, 'ethereum'), majorsById) === false, 'isDerivative: ETH itself -> false');

/* ── selectMembers: peers ─────────────────────────────────────────── */

const peers = selectMembers(privacyRows, { pinId: 'monero', chartN: 6, listN: 10 });

ok(peers.members[0]?.id === 'monero' && peers.members[0]?.pinned === true && peers.members[0]?.charted === true,
  'selectMembers(peers): XMR pinned at index 0, pinned:true, charted:true');
ok(peers.members.slice(1).every((m) => m.id !== 'monero'),
  'selectMembers(peers): monero never duplicated among the others');
ok(peers.members.length === 10, 'selectMembers(peers): exactly listN=10 members');
ok(peers.members.filter((m) => m.charted).length === 6, 'selectMembers(peers): exactly chartN=6 charted');

for (const [id, reason] of [
  ['tether', 'pegged'],
  ['shadow-coin', 'no-rank'],
  ['wrapped-monero', 'derivative'],
  ['void-cap-coin', 'no-marketcap'],
  ['glitch-price-coin', 'invalid-price'],
  ['monero', 'pinned'],
]) {
  const hit = peers.excluded.find((e) => e.id === id);
  ok(!!hit && hit.reason === reason, `selectMembers(peers): excluded[] has {id:"${id}", reason:"${reason}"}`);
}
ok(peers.excluded.length === 6, 'selectMembers(peers): excluded[] has exactly the 6 logged drops (no rank-cutoff noise)');

/* ── selectMembers: majors ────────────────────────────────────────── */

const majors = selectMembers(majorsRows, { pinId: 'monero', chartN: 9, listN: 9 });

ok(majors.members[0]?.id === 'monero' && majors.members[0]?.pinned === true && majors.members[0]?.charted === true,
  'selectMembers(majors): XMR pinned at index 0, pinned:true, charted:true');
ok(majors.members.slice(1).every((m) => m.id !== 'monero'),
  'selectMembers(majors): monero never duplicated among the others');
ok(majors.members.length === 9, 'selectMembers(majors): exactly listN=9 members');
ok(majors.members.filter((m) => m.charted).length === 9, 'selectMembers(majors): exactly chartN=9 charted (listN==chartN)');
ok(majors.members.every((m) => m.id !== 'legit-dollar-coin'),
  'selectMembers(majors): legit-dollar-coin loses the rank cutoff (8 majors outrank it), not selected');
ok(!majors.excluded.some((e) => e.id === 'legit-dollar-coin'),
  'selectMembers(majors): legit-dollar-coin is NOT in excluded[] (valid candidate, just rank-cut, not a heuristic drop)');

for (const [id, reason] of [
  ['tether', 'pegged'],
  ['usd-coin', 'pegged'],
  ['dai', 'pegged'],
  ['euro-coin', 'pegged'],
  ['wrapped-bitcoin', 'derivative'],
  ['staked-ether', 'derivative'],
  ['wrapped-steth', 'derivative'],
  ['coinbase-wrapped-btc', 'derivative'],
  ['innocuous-btc-fund', 'derivative'],
  ['no-rank-major', 'no-rank'],
  ['monero', 'pinned'],
]) {
  const hit = majors.excluded.find((e) => e.id === id);
  ok(!!hit && hit.reason === reason, `selectMembers(majors): excluded[] has {id:"${id}", reason:"${reason}"}`);
}

/* ── parseDays ─────────────────────────────────────────────────────── */

ok(parseDays('30') === 30, 'parseDays("30") -> 30');
ok(parseDays('31') === 30, 'parseDays("31") -> 30 (nearest allowed)');
ok(parseDays('') === 30, 'parseDays("") -> 30 (default)');
ok(parseDays('abc') === 30, 'parseDays("abc") -> 30 (unparseable, never 400)');
ok(parseDays('365') === 365, 'parseDays("365") -> 365');
ok(parseDays('7') === 7, 'parseDays("7") -> 7');
ok(parseDays(undefined) === 30, 'parseDays(undefined) -> 30');
ok(parseDays('90') === 90, 'parseDays("90") -> 90');
ok(parseDays('1000') === 365, 'parseDays("1000") -> 365 (clamped to nearest, not rejected)');

/* ── cacheSeconds ──────────────────────────────────────────────────── */

ok(JSON.stringify(cacheSeconds(7)) === JSON.stringify({ sMaxAge: 900, swr: 86400 }), 'cacheSeconds(7) -> 900/86400');
ok(JSON.stringify(cacheSeconds(30)) === JSON.stringify({ sMaxAge: 1800, swr: 86400 }), 'cacheSeconds(30) -> 1800/86400');
ok(JSON.stringify(cacheSeconds(90)) === JSON.stringify({ sMaxAge: 3600, swr: 86400 }), 'cacheSeconds(90) -> 3600/86400');
ok(JSON.stringify(cacheSeconds(365)) === JSON.stringify({ sMaxAge: 3600, swr: 86400 }), 'cacheSeconds(365) -> 3600/86400');

/* ── downsample ────────────────────────────────────────────────────── */

const bigSeries = [];
const startT = 1_700_000_000_000;
for (let i = 0; i < 720; i++) {
  bigSeries.push([startT + i * 3_600_000, 100 + Math.sin(i / 11) * 10]);
}

const sampled = downsample(bigSeries, 400);

ok(sampled.length === 400, 'downsample(720 points, 400) -> exactly 400 points');
ok(sampled[0] === bigSeries[0], 'downsample: first point is byte-identical (same reference) to input[0]');
ok(sampled[sampled.length - 1] === bigSeries[bigSeries.length - 1],
  'downsample: last point is byte-identical (same reference) to input[last]');

let monotonic = true;
for (let i = 1; i < sampled.length; i++) {
  if (sampled[i][0] < sampled[i - 1][0]) monotonic = false;
}
ok(monotonic, 'downsample: output is monotonic (non-decreasing) in t');

const inputSet = new Set(bigSeries);
ok(sampled.every((pt) => inputSet.has(pt)), 'downsample: every output point exists in the input (nothing synthesised)');

/* n <= max: pass-through, no truncation. */
const small = [[1, 1], [2, 2], [3, 3]];
const smallOut = downsample(small, 400);
ok(smallOut.length === 3 && smallOut.every((pt, i) => pt === small[i]), 'downsample: n <= max returns all input points, same references');
ok(downsample([], 400).length === 0, 'downsample([], 400) -> [] (no throw)');

/* ── pool ──────────────────────────────────────────────────────────── */

const poolResults = await pool([1, 2, 3, 4, 5, 6, 7], 4, async (n) => {
  await new Promise((r) => setTimeout(r, (7 - n) % 3));
  return n * 10;
});
ok(JSON.stringify(poolResults) === JSON.stringify([10, 20, 30, 40, 50, 60, 70]),
  'pool: output order matches input order regardless of completion timing');

let maxConcurrent = 0;
let concurrent = 0;
await pool(Array.from({ length: 10 }, (_, i) => i), 4, async () => {
  concurrent++;
  maxConcurrent = Math.max(maxConcurrent, concurrent);
  await new Promise((r) => setTimeout(r, 5));
  concurrent--;
  return null;
});
ok(maxConcurrent <= 4, `pool: never exceeds the requested concurrency (saw max ${maxConcurrent})`);
ok(maxConcurrent > 1, 'pool: actually runs concurrently, not serially');

ok((await pool([], 4, async () => 1)).length === 0, 'pool([], 4, fn) -> [] (no throw)');

if (failed > 0) {
  console.log(`\n${failed} check(s) FAILED`);
  process.exit(1);
}
console.log('\nAll checks passed ✅');
