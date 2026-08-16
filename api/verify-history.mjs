/* verify-history.mjs — offline unit test for the shared /network/hashrate
   and /network/difficulty history handlers in api/xmr.js
   (S1-CONTRACT.md, p3·14b, decisions D1-D7).
   Run: node api/verify-history.mjs

   The sandbox has no network egress to Monero nodes, so this exercises the
   pure range/sampler/envelope helpers directly, and the two RPC-calling
   handlers (handleHashrate / handleDifficulty) via an INJECTED fixture
   rpc() that simulates exactly what a public RESTRICTED monerod node does:
   a get_block_headers_range call whose span exceeds
   RESTRICTED_BLOCK_HEADER_RANGE (1000) returns no `result` field ("Too many
   block headers requested."), which api/xmr.js's real rpc() turns into
   null — same as this fixture. Same idiom as verify-tx-parse.mjs
   (createRequire to load the CommonJS module under test) and
   verify-markets.mjs / verify-nodehealth.mjs (✅/❌ reporter, plain exit
   code discipline, no shared verify-lib — api/ has none).

   TWO-POLARITY, PERMANENT NEGATIVE CONTROL: api/_fixtures/xmr-history-prefix.mjs
   is a behavioural copy of the two range tables and the downsampler
   api/xmr.js shipped BEFORE this change (quoted verbatim in
   S1-CONTRACT.md), reparameterised to run offline against the same kind of
   fixture node instead of calling rpc() itself. Every assertion below runs
   against BOTH modules — the shipped one must pass, the pre-fix one must
   fail the same assertion — so the red state is a committed file, not a
   working-tree mutation that could be forgotten mid-restore (see CLAUDE.md
   "the restore protocol failed twice"). */

import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire(import.meta.url);
const xmr = require('./xmr.js');
import * as prefix from './_fixtures/xmr-history-prefix.mjs';

let failed = 0;
let total = 0;
function ok(cond, msg) {
  total++;
  if (cond) {
    console.log(`✅ ${msg}`);
  } else {
    console.log(`❌ ${msg}`);
    failed++;
  }
}

/* ── fixture node ──────────────────────────────────────────────────────
   Mirrors exactly what api/xmr.js's rpc() sees from a public restricted
   monerod node: get_info returns {height, target}; get_block_headers_range
   returns {headers:[...]} ascending by height when the requested span is
   <= RESTRICTED_BLOCK_HEADER_RANGE (1000), or null (no `result` field —
   same shape rpc() produces for any JSON-RPC error) when it isn't. */
const MONEROD_RESTRICTED_SPAN = 1000; // independent literal — not read from xmr.js, so this fixture can't inherit the fix under test

function makeFixtureRpc(chainHeight, { target = 120, down = false } = {}) {
  return async function fixtureRpc(method, params) {
    if (down) return null;
    if (method === 'get_info') return { height: chainHeight, target };
    if (method === 'get_block_headers_range') {
      const { start_height, end_height } = params;
      const span = end_height - start_height;
      if (span > MONEROD_RESTRICTED_SPAN) return null;
      const headers = [];
      for (let h = Math.max(0, start_height); h <= end_height; h++) {
        headers.push({ height: h, timestamp: 1_700_000_000 + h * target, difficulty: 300_000_000_000 + h });
      }
      return { headers };
    }
    return null;
  };
}

const CHAIN_HEIGHT = 3_500_000;

/* ═══════════════════════════════════════════════════════════════════════
   D2 — the range table is bounded by the protocol, not by taste
   ═══════════════════════════════════════════════════════════════════════ */
console.log('-- D2: range table bounded by the protocol (RESTRICTED_HEADER_SPAN) --');

for (const [key, blocks] of Object.entries(xmr.HISTORY_RANGES)) {
  ok(blocks - 1 <= xmr.RESTRICTED_HEADER_SPAN,
    `HISTORY_RANGES['${key}']=${blocks} blocks -> span ${blocks - 1} <= RESTRICTED_HEADER_SPAN (${xmr.RESTRICTED_HEADER_SPAN})`);
}

ok(xmr.RESTRICTED_HEADER_SPAN === 1000,
  "RESTRICTED_HEADER_SPAN === 1000 (monerod's RESTRICTED_BLOCK_HEADER_RANGE, src/rpc/core_rpc_server_commands_defs.h)");

// two-polarity negative control: the OLD tables, flattened to 7 entries
// (4 hashrate + 3 difficulty), against the SAME span rule.
{
  let oldViolations = 0;
  let oldEntries = 0;
  for (const table of Object.values(prefix.OLD_COUNTS_TABLES)) {
    for (const rawCount of Object.values(table)) {
      oldEntries++;
      const count = Math.min(rawCount, 5000); // the old `Math.min(counts[range] || 504, 5000)` clamp
      const span = count - 1;
      if (span > MONEROD_RESTRICTED_SPAN) oldViolations++;
    }
  }
  ok(oldEntries === 7, `pre-fix negative control: old tables flatten to 7 entries (4 hashrate + 3 difficulty), got ${oldEntries}`);
  ok(oldViolations === 5,
    `pre-fix negative control: OLD range tables have ${oldViolations} of ${oldEntries} entries (expected 5) that VIOLATE the same span rule this handler's node actually enforces -- this is the defect D2 makes structurally impossible`);
  ok(prefix.RESTRICTED_HEADER_SPAN === undefined,
    'pre-fix negative control: the old code named no RESTRICTED_HEADER_SPAN constant at all (no export exists to even check)');
}

/* ═══════════════════════════════════════════════════════════════════════
   D1 — one shared helper serves both handlers
   ═══════════════════════════════════════════════════════════════════════ */
console.log('\n-- D1: one shared helper serves both handlers (same point count, same key) --');

{
  const rpcImpl = makeFixtureRpc(CHAIN_HEIGHT);
  for (const key of Object.keys(xmr.HISTORY_RANGES)) {
    const hr = await xmr.handleHashrate(key, rpcImpl);
    const df = await xmr.handleDifficulty(key, rpcImpl);
    ok(hr.returned === df.returned,
      `range='${key}': handleHashrate.returned (${hr.returned}) === handleDifficulty.returned (${df.returned})`);
    ok(hr.tip === df.tip, `range='${key}': both handlers agree on tip height (${hr.tip})`);
    ok(hr.blocks === df.blocks, `range='${key}': both handlers requested the same block count (${hr.blocks})`);
  }
  const hrUnknown = await xmr.handleHashrate('totally-unknown-key', rpcImpl);
  const dfUnknown = await xmr.handleDifficulty('totally-unknown-key', rpcImpl);
  ok(hrUnknown.returned === dfUnknown.returned && hrUnknown.range === dfUnknown.range,
    `unknown range key: both handlers still agree (range='${hrUnknown.range}', ${hrUnknown.returned} points)`);
}

// Static check: both handler BODIES literally call the shared helper, so a
// future edit can't quietly reintroduce two copy-pasted tables while still
// passing the behavioural check above by coincidence.
{
  const src = readFileSync(new URL('./xmr.js', import.meta.url), 'utf8');
  const hashrateStart = src.indexOf('async function handleHashrate');
  const difficultyStart = src.indexOf('async function handleDifficulty');
  const poolsStart = src.indexOf('async function handlePools');
  ok(hashrateStart !== -1 && difficultyStart !== -1 && poolsStart !== -1 && hashrateStart < difficultyStart && difficultyStart < poolsStart,
    'source anchors for handleHashrate / handleDifficulty / handlePools all found in order (extraction span is valid)');
  const hashrateBody = src.slice(hashrateStart, difficultyStart);
  const difficultyBody = src.slice(difficultyStart, poolsStart);
  ok(/historyHeaders\(/.test(hashrateBody), 'source: handleHashrate body calls historyHeaders(...)');
  ok(/historyHeaders\(/.test(difficultyBody), 'source: handleDifficulty body calls historyHeaders(...)');
  ok(!/counts\s*=\s*\{/.test(hashrateBody) && !/counts\s*=\s*\{/.test(difficultyBody),
    'source: neither handler body re-declares its own inline range-count table');
}

// two-polarity negative control: the OLD code's two DIFFERENT tables
// disagree for range='all' (only hashrate's table has that key, and it
// exceeds the span cap while difficulty's fallback doesn't).
{
  const oldHr = prefix.oldHandleHashrate('all', CHAIN_HEIGHT);
  const oldDf = prefix.oldHandleDifficulty('all', CHAIN_HEIGHT);
  ok(oldHr.length !== oldDf.length,
    `pre-fix negative control: range='all' -- old hashrate (${oldHr.length} pts, its table clamps to 5000 -> span 4999 -> node rejects) and old difficulty (${oldDf.length} pts, its table has no 'all' key so it falls back to 504 -> span 503 -> node accepts) DISAGREE`);
}

/* ═══════════════════════════════════════════════════════════════════════
   D4 / D7 — window_seconds = blocks × target_seconds, and the key names it
   ═══════════════════════════════════════════════════════════════════════ */
console.log('\n-- D4/D7: window_seconds = blocks × target_seconds, and the key NAME denotes it --');

const NAME_UNIT_SECONDS = { h: 3600, d: 86400 };
function windowFromKeyName(key) {
  const m = /^(\d+)([a-z])$/.exec(key);
  if (!m) return null;
  const unitSeconds = NAME_UNIT_SECONDS[m[2]];
  return unitSeconds != null ? Number(m[1]) * unitSeconds : null;
}

{
  const rpcImpl = makeFixtureRpc(CHAIN_HEIGHT, { target: 120 });
  for (const [key, blocks] of Object.entries(xmr.HISTORY_RANGES)) {
    const env = await xmr.handleDifficulty(key, rpcImpl);
    const expected = blocks * 120;
    ok(env.window_seconds === expected,
      `range='${key}': window_seconds (${env.window_seconds}) === blocks(${blocks}) × target_seconds(120) = ${expected}`);
    const named = windowFromKeyName(key);
    ok(named !== null && named === expected,
      `range='${key}': the key's own NAME denotes ${named}s, which equals the served window (${expected}s)`);
  }
}

// two-polarity negative control: the old response is a bare array (no
// window_seconds field at all), and even reconstructed from its own counts
// table the implied window doesn't match the key's name -- the exact
// 10x mislabel S1-CONTRACT.md documents for '7d'/'30d'.
{
  const oldPts = prefix.oldHandleDifficulty('30d', CHAIN_HEIGHT);
  ok(Array.isArray(oldPts) && oldPts.window_seconds === undefined,
    'pre-fix negative control: old response has no window_seconds field at all to check (bare array)');

  const oldCount = prefix.OLD_COUNTS_TABLES.difficulty['30d'];
  const oldImpliedWindow = oldCount * 120; // the only target this repo ever used, 120s
  const namedWindow = windowFromKeyName('30d'); // what "30d" the string actually denotes
  ok(oldImpliedWindow !== namedWindow,
    `pre-fix negative control: '30d' names ${namedWindow}s but the old table's count (${oldCount}) x 120s target implies ${oldImpliedWindow}s -- a ${(namedWindow / oldImpliedWindow).toFixed(1)}x mislabel`);
}

/* ═══════════════════════════════════════════════════════════════════════
   D5 — the stride anchors at the newest header, so tip is never behind
   ═══════════════════════════════════════════════════════════════════════ */
console.log('\n-- D5: stride anchors at the NEWEST header, so the tip always survives sampling --');

{
  // 504 headers, step = floor(504/200) = 2; (len-1) = 503, 503 % 2 = 1 != 0
  // -- deliberately NOT a multiple of the stride. A length that divides
  // evenly would pass under BOTH the old and the new sampler and prove
  // nothing (S1-CONTRACT.md makes this point explicitly).
  const headers = [];
  for (let h = 0; h < 504; h++) {
    headers.push({ height: 1000 + h, timestamp: 1_700_000_000 + h * 120, difficulty: 300_000_000_000 + h });
  }
  const naiveStep = Math.max(1, Math.floor(headers.length / 200));
  ok((headers.length - 1) % naiveStep !== 0,
    `fixture sanity: 504 headers is NOT a multiple of its own stride (${headers.length - 1} % ${naiveStep} = ${(headers.length - 1) % naiveStep})`);

  const { points, step, tip } = xmr.sampleHeaders(headers);
  const newestHeight = headers[headers.length - 1].height;
  ok(step === naiveStep, `sampleHeaders derives the same stride (${step}) as the naive floor(len/200) computation`);
  ok(tip === newestHeight, `sampleHeaders: tip (${tip}) === newest header height (${newestHeight})`);
  ok(points[points.length - 1].height === newestHeight,
    `sampleHeaders: the LAST returned point IS the tip, not up to step-1 (${step - 1}) block(s) behind it`);

  // two-polarity negative control: the OLD `i % step === 0` filter, same input.
  const oldPoints = prefix.oldSample(headers);
  ok(oldPoints[oldPoints.length - 1].height !== newestHeight,
    `pre-fix negative control: the OLD sampler's last point (height ${oldPoints[oldPoints.length - 1].height}) is NOT the tip (${newestHeight}) -- it silently drops the newest header`);
}

/* ═══════════════════════════════════════════════════════════════════════
   D6 — a degraded (ok:false) response never carries the 300s TTL
   ═══════════════════════════════════════════════════════════════════════ */
console.log('\n-- D6: an ok:false history response never carries the 300s TTL --');

{
  const ccFail = xmr.cacheControlFor('network/hashrate', { ok: false });
  const ccPass = xmr.cacheControlFor('network/hashrate', { ok: true });
  ok(!/s-maxage=300\b/.test(ccFail), `cacheControlFor('network/hashrate', {ok:false}) -> "${ccFail}" does NOT carry s-maxage=300`);
  ok(/s-maxage=300\b/.test(ccPass), `cacheControlFor('network/hashrate', {ok:true}) -> "${ccPass}" keeps the long s-maxage=300`);
  ok(ccFail === `s-maxage=${xmr.DEGRADED_HISTORY_S_MAXAGE}, stale-while-revalidate=${xmr.DEGRADED_HISTORY_S_MAXAGE}`,
    `degraded TTL is exactly DEGRADED_HISTORY_S_MAXAGE (${xmr.DEGRADED_HISTORY_S_MAXAGE}s), both s-maxage and swr`);

  const ccDiffFail = xmr.cacheControlFor('network/difficulty', { ok: false });
  ok(!/s-maxage=300\b/.test(ccDiffFail), "cacheControlFor('network/difficulty', {ok:false}) also does not carry s-maxage=300");

  // an unrelated route's degraded-shaped body must NOT be swept in by this
  // check -- the override is scoped to the two history routes only.
  const ccUnrelated = xmr.cacheControlFor('mempool', { ok: false });
  ok(ccUnrelated === xmr.cacheControlFor('mempool', { ok: true }),
    "cacheControlFor('mempool', ...) ignores data.ok entirely -- the D6 override is scoped to the two history routes, not every route");

  // two-polarity negative control: the old single-argument cacheControlFor
  // ignores the payload entirely and always returns the long TTL.
  const oldCc = prefix.oldCacheControlFor('network/hashrate');
  ok(/s-maxage=300\b/.test(oldCc),
    `pre-fix negative control: the OLD cacheControlFor(sub) takes no data parameter and returns "${oldCc}" regardless of whether the response is degraded`);
}

/* ═══════════════════════════════════════════════════════════════════════
   D3 / D4 — requested vs range distinction survives an unknown key
   ═══════════════════════════════════════════════════════════════════════ */
console.log('\n-- D3/D4: requested vs range survives an unknown key --');

{
  const r1 = xmr.resolveHistoryRange('nonsense-key');
  ok(r1.requested === 'nonsense-key', "resolveHistoryRange('nonsense-key').requested === 'nonsense-key' (verbatim as received)");
  ok(r1.range === xmr.HISTORY_DEFAULT, `resolveHistoryRange('nonsense-key').range === HISTORY_DEFAULT ('${xmr.HISTORY_DEFAULT}')`);
  ok(r1.requested !== r1.range, 'requested and range are NOT collapsed into one value when they differ');

  const r2 = xmr.resolveHistoryRange(undefined);
  ok(r2.requested === null, 'resolveHistoryRange(undefined).requested === null (absent, not the literal string "undefined")');
  ok(r2.range === xmr.HISTORY_DEFAULT, 'resolveHistoryRange(undefined).range === HISTORY_DEFAULT');

  const r3 = xmr.resolveHistoryRange('1d');
  ok(r3.requested === '1d' && r3.range === '1d', "resolveHistoryRange('1d'): a valid key passes through unchanged on both fields");

  // two-polarity negative control: the old handlers had no requested/range
  // distinction at all -- an unmatched key silently became a raw block
  // count via `|| 504` with nothing in the response recording that a
  // substitution happened.
  ok(typeof prefix.resolveHistoryRange === 'undefined',
    'pre-fix negative control: the old code exports no range-resolution function to even check -- an unknown key just fell through `|| 504` inline, unrecorded');
}

/* ═══════════════════════════════════════════════════════════════════════
   D7 — hashrate_ghs: full precision, node-reported target, never 120
   ═══════════════════════════════════════════════════════════════════════ */
console.log('\n-- D7: hashrate_ghs is full precision and uses the NODE\'S OWN target, never a literal 120 --');

{
  // Deliberately NOT 120, so a hard-coded /120 in the implementation would
  // produce numbers that provably disagree with this assertion.
  const rpcImpl = makeFixtureRpc(CHAIN_HEIGHT, { target: 123 });
  const env = await xmr.handleHashrate('1h', rpcImpl);
  ok(env.target_seconds === 123, "handleHashrate reports the node's OWN target_seconds (123), never a hard-coded 120");
  ok(env.points.length > 0, 'fixture sanity: handleHashrate returned at least one point to check');

  const allExact = env.points.every(p => {
    const expectedDiff = 300_000_000_000 + p.height; // matches makeFixtureRpc's difficulty formula
    const expectedGhs = expectedDiff / 123 / 1e9;
    return p.hashrate_ghs === expectedGhs;
  });
  ok(allExact, 'every hashrate_ghs point equals difficulty / target_seconds / 1e9 at FULL precision (no Math.round, no hard-coded /120)');

  const hasMoreThan2Decimals = env.points.some(p => {
    const s = String(p.hashrate_ghs);
    const dot = s.indexOf('.');
    return dot !== -1 && s.length - dot - 1 > 2;
  });
  ok(hasMoreThan2Decimals, 'at least one point carries more than 2 decimal digits, proving the old Math.round(...*100)/100 quantisation is gone');

  // Node doesn't report a target at all.
  const rpcNoTarget = async (method, params) => {
    if (method === 'get_info') return { height: CHAIN_HEIGHT }; // no .target field
    return makeFixtureRpc(CHAIN_HEIGHT)(method, params);
  };
  const envNoTarget = await xmr.handleHashrate('1h', rpcNoTarget);
  ok(envNoTarget.target_seconds === null, 'target_seconds is null (never 120) when the node does not report one');
  ok(envNoTarget.points.length > 0 && envNoTarget.points.every(p => p.hashrate_ghs === null),
    'hashrate_ghs is null (never computed against an invented target) for every point when target_seconds is unavailable');
}

// two-polarity negative control: the old code always divided by a
// hard-coded 120 and rounded to 2 decimal places, regardless of what the
// node's real target was.
{
  const oldPts = prefix.oldHandleHashrate('7d', CHAIN_HEIGHT);
  ok(oldPts.length > 0, 'fixture sanity: old hashrate returned at least one point to check');
  const p0 = oldPts[0];
  const trueGhsAtRealTarget123 = (300_000_000_000 + p0.height) / 123 / 1e9; // what D7-correct code would report if this node's real target were 123
  ok(p0.hashrate_ghs !== trueGhsAtRealTarget123,
    `pre-fix negative control: old hashrate_ghs (${p0.hashrate_ghs}) hardcodes /120 regardless of the node's real target -- diverges from the D7-correct value (${trueGhsAtRealTarget123}) whenever target_seconds !== 120`);
  ok(Math.round(p0.hashrate_ghs * 100) === p0.hashrate_ghs * 100,
    'pre-fix negative control: old hashrate_ghs is quantised to 2 decimal places (Math.round(x*100)/100)');
}

/* ── summary ──────────────────────────────────────────────────────────── */
console.log(`\n${total - failed}/${total} assertions passed`);
if (failed > 0) {
  console.log(`\n${failed} check(s) FAILED`);
  process.exit(1);
}
console.log('\nAll checks passed ✅');
console.log('\n✅ verify-history: all assertions passed');
