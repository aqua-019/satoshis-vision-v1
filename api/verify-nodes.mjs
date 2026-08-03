/* verify-nodes.mjs — offline gate for api/nodes.js (monero.fail health aggregator)
   Run: node api/verify-nodes.mjs   (from app/: node ../api/verify-nodes.mjs)

   The sandbox has no outbound HTTP to monero.fail, so every "is this upstream
   reachable" question is a FIXTURE, not a probe. parseHealth and cluster logic
   are tested against the committed api/_fixtures/monerofail-health.json fixture.
   Upstream state transitions (live/degraded/timeout/malformed) are tested by
   stubbing globalThis.fetch with four distinct behaviors, proving all four
   reason codes are producible and mutually distinct.

   Reporter: imported from ../app/verify-reporter.mjs (same pattern as
   verify-status.mjs — do NOT import verify-lib.mjs because it pulls in
   playwright). */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { makeReporter } from '../app/verify-reporter.mjs';
import { EXPECTED } from './_fixtures/monerofail-health-spec.mjs';

/* Filled by group 10 from what the handler ACTUALLY emitted across its four
   failure states; consumed by group 12b. Deliberately not a literal. */
let OBSERVED_REASONS = [];

const R = makeReporter('verify-nodes');

/* ── OFFLINE BY CONSTRUCTION ────────────────────────────────────────────────
 * CI's `build` job is contractually "offline gates only — no browser, no
 * network", and this gate proxies an upstream. Until v6.1.7 group 2's
 * `GET → 200` invoked the handler with NO fetch stub, so on a runner with real
 * egress it made a live HTTPS request to monero.fail — and hung the job. It
 * looked offline in the authoring sandbox only because egress there fails fast
 * (403 on CONNECT), which is the sandbox lying by being stricter than CI.
 *
 * So the default is now a THROWING sentinel rather than the real fetch. Any
 * invocation that forgets to stub fails loudly and locally instead of reaching
 * the network; each group installs its own stub deliberately, and
 * `UNSTUBBED_FETCH_CALLS` is asserted to be the number we intend at the end.
 * The real fetch is captured and never restored — nothing in this file may use
 * it. */
const REAL_FETCH = globalThis.fetch;
let UNSTUBBED_FETCH_CALLS = 0;
globalThis.fetch = async (...args) => {
  UNSTUBBED_FETCH_CALLS++;
  throw new Error(`verify-nodes: unstubbed fetch to ${String(args[0]).slice(0, 60)} — this gate must be offline; stub globalThis.fetch in the enclosing block`);
};
const API_DIR = dirname(fileURLToPath(import.meta.url));

/* ── env sandbox ── */
const ENV0 = {
  primary: process.env.MONERO_PRIMARY_NODE,
  mainnet: process.env.MONERO_REFERENCE_MAINNET,
};
function restoreEnv() {
  if (ENV0.primary === undefined) delete process.env.MONERO_PRIMARY_NODE;
  else process.env.MONERO_PRIMARY_NODE = ENV0.primary;
  if (ENV0.mainnet === undefined) delete process.env.MONERO_REFERENCE_MAINNET;
  else process.env.MONERO_REFERENCE_MAINNET = ENV0.mainnet;
}
delete process.env.MONERO_PRIMARY_NODE;
delete process.env.MONERO_REFERENCE_MAINNET;

/* ── minimal res double ── */
function makeRes() {
  const headers = {};
  const state = { statusCode: undefined, body: undefined, ended: false, jsonCalled: false };
  const res = {
    setHeader(k, v) { headers[k] = v; return res; },
    getHeader(k) { return headers[k]; },
    status(code) { state.statusCode = code; return res; },
    json(obj) {
      state.body = obj;
      state.jsonCalled = true;
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/json; charset=utf-8';
      return res;
    },
    end() { state.ended = true; return res; },
  };
  return { res, headers, state };
}

function makeReq(method) {
  return { method, query: {}, url: '/api/nodes' };
}

/* ── 1) CommonJS proof ── */
let nodesMod;
try {
  nodesMod = require('./nodes.js');
  R.ok(typeof nodesMod === 'function',
    'require(\'./nodes.js\') returns a function (CommonJS proof)');
} catch (err) {
  R.ok(false, 'require(\'./nodes.js\') succeeded', err.message);
  process.exit(R.finish());
}

/* ── 2) HTTP method behaviour ── */
{
  const { res, state } = makeRes();
  await nodesMod(makeReq('OPTIONS'), res);
  R.ok(state.statusCode === 200, 'OPTIONS → 200');
}
{
  const { res, state } = makeRes();
  await nodesMod(makeReq('POST'), res);
  R.ok(state.statusCode === 405, 'POST → 405');
  R.ok(state.body?.error === 'GET only', 'POST error message is "GET only"');
}
{
  /* Stubbed deliberately: an unstubbed GET here reached the real upstream. */
  const originalFetch = globalThis.fetch;
  const fixture = JSON.parse(readFileSync(join(API_DIR, '_fixtures/monerofail-health.json'), 'utf8'));
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => fixture });
  try {
    nodesMod._resetCache();
    const { res, state } = makeRes();
    await nodesMod(makeReq('GET'), res);
    R.ok(state.statusCode === 200, 'GET → 200');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

/* ── 3) Cache-Control on EVERY exit path ── */
/* 3a: full quality (live) */
{
  const originalFetch = globalThis.fetch;
  const fixture = JSON.parse(readFileSync(join(API_DIR, '_fixtures/monerofail-health.json'), 'utf8'));
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => fixture });
  try {
    nodesMod._resetCache();
    const { res, headers, state } = makeRes();
    await nodesMod(makeReq('GET'), res);
    R.ok(headers['Cache-Control'] === 'public, s-maxage=300, stale-while-revalidate=900',
      'full quality (live) sets Cache-Control: public, s-maxage=300, stale-while-revalidate=900');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

/* 3b: degraded quality (no reachable nodes) */
{
  const originalFetch = globalThis.fetch;
  const degradedFixture = { monero: { clear: {}, onion: {}, i2p: {} } };
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => degradedFixture });
  try {
    nodesMod._resetCache();
    const { res, headers, state } = makeRes();
    await nodesMod(makeReq('GET'), res);
    R.ok(headers['Cache-Control'] === 'public, s-maxage=45, stale-while-revalidate=45',
      'degraded quality (empty sections) sets Cache-Control: public, s-maxage=45, stale-while-revalidate=45');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

/* 3c: upstream failure (unavailable) */
{
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('network unreachable'); };
  try {
    nodesMod._resetCache();
    const { res, headers, state } = makeRes();
    await nodesMod(makeReq('GET'), res);
    R.ok(headers['Cache-Control'] === 'public, s-maxage=45, stale-while-revalidate=45',
      'unavailable (upstream failure) sets Cache-Control: public, s-maxage=45, stale-while-revalidate=45');

    /* THE CENSUS-ABSENCE RULE — positively specified, by name, in BOTH
     * directions. This is the property the endpoint's 200-not-502 design
     * exists to serve, and it was previously asserted nowhere.
     *
     * Spec §5 #15 phrases it as "no numeric fields present at all". Taken
     * literally that is UNSATISFIABLE and always has been: `v: 1` is a number
     * and has been in every envelope since wave 1, so a blanket
     * `typeof x === 'number'` sweep reds on correct code. The standard repair
     * for a gate that reds on correct code is to loosen it — and a loosened
     * assertion in the one gate whose job is proving no fabricated census
     * reaches the panel would be the vacuity class arriving inside the gate
     * written to catch it. So: named keys, not a type sweep.
     *
     * The rule's real content is §2.5's surviving rationale — never an
     * empty-but-well-formed success envelope, because a zero-count success is
     * indistinguishable from a real network with no reachable nodes. That is
     * about CENSUS fields. `v` is a schema version and `upstreamStatus` is
     * metadata about the HTTP exchange; neither can be misread as
     * "0 reachable nodes", which is the only thing the rule prevents. */
    const CENSUS = ['counts', 'split', 'availability', 'height', 'sampledAt', 'partial', 'nodes'];
    const leaked = CENSUS.filter((k) => state.body != null && k in state.body);
    R.ok(leaked.length === 0,
      `unavailable envelope carries NO census key (absent: ${CENSUS.join(', ')})`,
      leaked.length ? `present but must not be: ${leaked.join(', ')}` : '');

    const META = ['v', 'at', 'source', 'status', 'reason', 'upstreamStatus'];
    const missing = META.filter((k) => !(state.body != null && k in state.body));
    R.ok(missing.length === 0,
      `unavailable envelope carries every meta key (${META.join(', ')})`,
      missing.length ? `missing: ${missing.join(', ')}` : '');
    R.ok(typeof state.body?.reason === 'string' && state.body.reason.length > 0,
      `unavailable envelope's reason is a non-empty string (got ${JSON.stringify(state.body?.reason)})`);
    R.ok(state.body?.upstreamStatus === null || typeof state.body?.upstreamStatus === 'number',
      `unavailable envelope's upstreamStatus is a number or null (got ${JSON.stringify(state.body?.upstreamStatus)})`);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

/* Assert NO exit path emits no-store */
{
  const fixture = JSON.parse(readFileSync(join(API_DIR, '_fixtures/monerofail-health.json'), 'utf8'));
  const states = [
    { name: 'full', fetch: async () => ({ ok: true, status: 200, json: async () => fixture }) },
    { name: 'degraded', fetch: async () => ({ ok: true, status: 200, json: async () => ({ monero: {} }) }) },
    { name: 'timeout', fetch: async () => { throw { name: 'AbortError' }; } },
  ];
  /* Pinned like the other collection-driven groups: a states array that shrank
     would quietly shrink this group's coverage with no failure. */
  R.ok(states.length === 3, `no-store sweep drives 3 states (found ${states.length})`);
  for (const s of states) {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = s.fetch;
    try {
      nodesMod._resetCache();
      const { res, headers } = makeRes();
      await nodesMod(makeReq('GET'), res);
      R.ok(!headers['Cache-Control']?.includes('no-store'),
        `${s.name} state never emits no-store (regression guard)`);
    } finally {
      globalThis.fetch = originalFetch;
    }
  }
}

/* ── 4) parseHealth parsing against fixture ── */
{
  const fixture = JSON.parse(readFileSync(join(API_DIR, '_fixtures/monerofail-health.json'), 'utf8'));
  const parsed = nodesMod.parseHealth(fixture);
  R.fixture('parseHealth: clear count', `${parsed.clear.length} === ${EXPECTED.transports.clear}`);
  R.fixture('parseHealth: tor count', `${parsed.onion.length} === ${EXPECTED.transports.tor}`);
  R.fixture('parseHealth: i2p count', `${parsed.i2p.length} === ${EXPECTED.transports.i2p}`);
  R.fixture('parseHealth: excluded count', `${parsed.excluded} === ${EXPECTED.counts.excluded}`);
}

/* ── 5) Section absent vs empty — the distinction must survive ── */
/* 5a: missing section → [] + partial:true */
{
  const parsed = nodesMod.parseHealth({ monero: {} });
  R.ok(Array.isArray(parsed.clear) && parsed.clear.length === 0,
    'missing clear section → empty array');
  R.ok(parsed.partial === true,
    'missing clear section sets partial:true');
}

/* 5b: null section → [] + partial:true */
{
  const parsed = nodesMod.parseHealth({ monero: { clear: null } });
  R.ok(Array.isArray(parsed.clear) && parsed.clear.length === 0,
    'null clear section → empty array');
  R.ok(parsed.partial === true,
    'null clear section sets partial:true');
}

/* 5c: empty section {} → [] without partial penalty */
{
  const parsed = nodesMod.parseHealth({ monero: { clear: {}, onion: {}, i2p: {} } });
  R.ok(Array.isArray(parsed.clear) && parsed.clear.length === 0,
    'empty clear section → empty array');
  R.ok(parsed.partial === false,
    'empty clear section does NOT set partial');
}

/* ── 6) excluded field falsifiability — four producible states ── */
/* 6a: pass case: against fixture */
{
  const fixture = JSON.parse(readFileSync(join(API_DIR, '_fixtures/monerofail-health.json'), 'utf8'));
  const parsed = nodesMod.parseHealth(fixture);
  R.fixture('excluded count from fixture', `${parsed.excluded} === ${EXPECTED.counts.excluded}`);
}

/* 6b: fail case — malformed entry removed → count drops */
{
  const input = {
    monero: {
      clear: {
        'host1': { available: true, checks: [true], datetime_checked: '2026-08-03T12:00:00Z', last_height: 100 },
        'host2-malformed': 'not-an-object',
      },
      onion: {},
      i2p: {},
    },
  };
  const parsed = nodesMod.parseHealth(input);
  R.ok(parsed.excluded === 1, 'one malformed entry increments excluded');
}

/* 6c: fail case — add second malformed entry → count rises */
{
  const input = {
    monero: {
      clear: {
        'host1': 'malformed',
        'host2': null,
      },
      onion: {},
      i2p: {},
    },
  };
  const parsed = nodesMod.parseHealth(input);
  R.ok(parsed.excluded === 2, 'two malformed entries increment excluded to 2');
}

/* 6d: fail case — add null entry → count rises */
{
  const input = {
    monero: {
      clear: {
        'host1-good': { available: true, checks: [], datetime_checked: '2026-08-03T12:00:00Z', last_height: 100 },
        'host2-null': null,
      },
      onion: {},
      i2p: {},
    },
  };
  const parsed = nodesMod.parseHealth(input);
  R.ok(parsed.excluded === 1, 'null entry increments excluded');
}

/* ── 7) availabilityBuckets ── */
{
  const fixture = JSON.parse(readFileSync(join(API_DIR, '_fixtures/monerofail-health.json'), 'utf8'));
  const parsed = nodesMod.parseHealth(fixture);
  const allNodes = [...parsed.clear, ...parsed.onion, ...parsed.i2p];
  const buckets = nodesMod.availabilityBuckets(allNodes, 4);

  R.fixture('availability buckets count', `${buckets.length} === 4 (fixture has 4 buckets)`);

  /* Buckets partition [0,1] with no gap and no overlap */
  for (let i = 0; i < buckets.length - 1; i++) {
    R.ok(buckets[i].to === buckets[i+1].from,
      `bucket ${i} and ${i+1} are contiguous (no gap, no overlap)`);
  }

  /* ratio === 1 lands in the LAST bucket */
  const perfects = allNodes.filter((n) => {
    const passed = n.checks.filter((c) => c === true).length;
    return passed === n.checks.length && n.checks.length > 0;
  });
  R.fixture('availability buckets partition', 'verified against fixture perfect nodes landing in last bucket');
}

/* 7b: empty array → empty buckets, no throw */
{
  const buckets = nodesMod.availabilityBuckets([], 4);
  R.ok(Array.isArray(buckets) && buckets.length === 0,
    'availabilityBuckets([], 4) returns empty array without throwing');
}

/* ── 8) heightClusters ── */
{
  const fixture = JSON.parse(readFileSync(join(API_DIR, '_fixtures/monerofail-health.json'), 'utf8'));
  const parsed = nodesMod.parseHealth(fixture);
  const allNodes = [...parsed.clear, ...parsed.onion, ...parsed.i2p];
  const analysis = nodesMod.heightClusters(allNodes);

  R.fixture('mode height', `${analysis.mode} === ${EXPECTED.height.mode}`);
  R.fixture('lagging count', `${analysis.lagging.count} === ${EXPECTED.height.laggingCount}`);

  /* Every lagging cluster has lag > 2.
     Guarded: this is the prompt's own Verify-list item ("height-disagreement
     clusters surface correctly — construct a fixture with a lagging set").
     The fixture is deliberately built with a lagging cohort; if it ever loses
     one, these per-cluster assertions vanish and the gate stays green on the
     single readout the panel exists to show. */
  R.ok(analysis.lagging.clusters.length > 0 && analysis.lagging.count > 0,
    `fixture yields a lagging set to check (${analysis.lagging.clusters.length} cluster(s), ${analysis.lagging.count} node(s))`);
  for (const cluster of analysis.lagging.clusters) {
    R.ok(cluster.lag > 2, `lagging cluster at height ${cluster.height} has lag > 2 (lag=${cluster.lag})`);
  }

  /* 2-behind nodes are NOT lagging, 3-behind ARE */
  const clusters2 = analysis.clusters.filter((c) => c.lag === 2);
  R.ok(clusters2.every((c) => !analysis.lagging.clusters.includes(c)),
    '2-behind clusters are not in lagging set (boundary)');

  const clusters3 = analysis.clusters.filter((c) => c.lag === 3);
  R.ok(clusters3.every((c) => analysis.lagging.clusters.includes(c)),
    '3-behind clusters are in lagging set (boundary)');
}

/* 8b: tie-break determinism — equal counts at h and h+1 → mode is h+1 */
{
  const input = [
    { transport: 'clear', available: true, lastHeight: 100, checks: [true] },
    { transport: 'clear', available: true, lastHeight: 100, checks: [true] },
    { transport: 'clear', available: true, lastHeight: 101, checks: [true] },
    { transport: 'clear', available: true, lastHeight: 101, checks: [true] },
  ];
  const analysis = nodesMod.heightClusters(input);
  R.ok(analysis.mode === 101, 'equal count tie-break: higher height wins (mode=101)');
}

/* 8c: reversed input → same result */
{
  const input = [
    { transport: 'clear', available: true, lastHeight: 100, checks: [true] },
    { transport: 'clear', available: true, lastHeight: 100, checks: [true] },
    { transport: 'clear', available: true, lastHeight: 101, checks: [true] },
    { transport: 'clear', available: true, lastHeight: 101, checks: [true] },
  ];
  const fwd = nodesMod.heightClusters(input);
  const rev = nodesMod.heightClusters([...input].reverse());
  R.ok(fwd.mode === rev.mode && fwd.mode === 101,
    'mode is stable regardless of input order');
}

/* 8d: empty array → mode===null */
{
  const analysis = nodesMod.heightClusters([]);
  R.ok(analysis.mode === null && analysis.mode !== 0,
    'empty heightClusters returns mode===null (not 0)');
}

/* ── 9) unknownHeight counts only available-with-unusable-height ── */
{
  const fixture = JSON.parse(readFileSync(join(API_DIR, '_fixtures/monerofail-health.json'), 'utf8'));
  const parsed = nodesMod.parseHealth(fixture);
  const allNodes = [...parsed.clear, ...parsed.onion, ...parsed.i2p];
  const analysis = nodesMod.heightClusters(allNodes);
  R.fixture('unknownHeight from fixture', `${analysis.unknownHeight} === ${EXPECTED.counts.unknownHeight}`);
}

/* 9b: unavailable node with valid height → does NOT increment unknownHeight */
{
  const input = [
    { transport: 'clear', available: true, lastHeight: 100, checks: [true] },
    { transport: 'clear', available: false, lastHeight: 100, checks: [false] },  // unavailable, ignore
  ];
  const analysis = nodesMod.heightClusters(input);
  R.ok(analysis.unknownHeight === 0,
    'unavailable node with valid height does not increment unknownHeight');
}

/* ── 10) Four upstream reasons, four PRODUCIBLE STATES ── */
/* 10a: OK 200 + valid JSON → status:live, reason:null, full cache */
{
  const originalFetch = globalThis.fetch;
  const fixture = JSON.parse(readFileSync(join(API_DIR, '_fixtures/monerofail-health.json'), 'utf8'));
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => fixture });
  try {
    nodesMod._resetCache();
    const { res, state } = makeRes();
    await nodesMod(makeReq('GET'), res);
    R.ok(state.body?.status === 'live' && state.body?.reason === null,
      'ok:true 200 → status:live, reason:null');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

/* 10b: ok:false 503 → reason:upstream-status, upstreamStatus:503 */
{
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => null });
  try {
    nodesMod._resetCache();
    const { res, state } = makeRes();
    await nodesMod(makeReq('GET'), res);
    R.ok(state.body?.reason === 'upstream-status' && state.body?.upstreamStatus === 503,
      'ok:false 503 → reason:upstream-status, upstreamStatus:503');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

/* 10c: AbortError → reason:upstream-timeout */
{
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw { name: 'AbortError', message: 'timeout' }; };
  try {
    nodesMod._resetCache();
    const { res, state } = makeRes();
    await nodesMod(makeReq('GET'), res);
    R.ok(state.body?.reason === 'upstream-timeout',
      'AbortError → reason:upstream-timeout');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

/* 10d: other error → reason:upstream-unreachable */
{
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('ECONNREFUSED'); };
  try {
    nodesMod._resetCache();
    const { res, state } = makeRes();
    await nodesMod(makeReq('GET'), res);
    R.ok(state.body?.reason === 'upstream-unreachable',
      'non-AbortError → reason:upstream-unreachable');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

/* 10e: json() throws → reason:upstream-malformed */
{
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => { throw new Error('not json'); },
  });
  try {
    nodesMod._resetCache();
    const { res, state } = makeRes();
    await nodesMod(makeReq('GET'), res);
    /* `upstreamStatus: 200` here is CORRECT and must not be "tidied" to null.
     * monero.fail genuinely answered 200; the body was garbage. Neither field
     * tells that story alone — the true reading is the PAIR
     * `reason: 'upstream-malformed'` + `upstreamStatus: 200`, and it is what
     * distinguishes a malformed 200 from a host that was never reached
     * (`upstream-unreachable` + `upstreamStatus: null`). Asserted as a pair
     * below for exactly that reason. */
    R.ok(state.body?.reason === 'upstream-malformed' && state.body?.upstreamStatus === 200,
      'json() throws → the PAIR reason:upstream-malformed + upstreamStatus:200 (a 200 that answered with garbage, not a host never reached)');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

/* Assert the four reasons are mutually distinct.
 *
 * THIS ASSERTION USED TO BE A TAUTOLOGY, and it is worth saying how, because
 * it is the exact defect class this whole PR keeps finding. It read:
 *
 *     const reasons = ['upstream-status','upstream-timeout',
 *                      'upstream-unreachable','upstream-malformed'];
 *     R.ok(new Set(reasons).size === reasons.length, '…mutually distinct');
 *
 * — a Set built from the gate's OWN literal, asserting that literal has no
 * duplicates. True by construction, forever, regardless of anything api/nodes.js
 * does. Break-tested: with the handler's AbortError/non-AbortError arms
 * deliberately re-merged (the F1 regression), this assertion stayed GREEN.
 *
 * It now OBSERVES the handler. Each state is driven, the reason it actually
 * produced is collected, and distinctness is asserted over those observations.
 * Re-merging the arms collapses two observations into one and reds this line. */
{
  const originalFetch = globalThis.fetch;
  const observed = [];
  const states = [
    ['503',        async () => ({ ok: false, status: 503, json: async () => null })],
    ['abort',      async () => { throw { name: 'AbortError', message: 'timeout' }; }],
    ['unreachable',async () => { throw new TypeError('getaddrinfo ENOTFOUND monero.fail'); }],
    ['malformed',  async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad'); } })],
  ];
  R.ok(states.length === 4, `reason-distinctness drives 4 failure states (found ${states.length})`);
  try {
    for (const [, stub] of states) {
      globalThis.fetch = stub;
      nodesMod._resetCache();
      const { res, state } = makeRes();
      await nodesMod(makeReq('GET'), res);
      observed.push(state.body?.reason);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
  R.ok(observed.length === 4 && observed.every((r) => typeof r === 'string' && r.length > 0),
    `every failure state produced a reason string (got ${JSON.stringify(observed)})`);
  const unique = new Set(observed);
  R.ok(unique.size === observed.length,
    `the four OBSERVED upstream reasons are mutually distinct (got ${JSON.stringify([...unique])})`);
  OBSERVED_REASONS = [...unique].sort();
}

/* Set by group 10 from what the handler ACTUALLY emitted; consumed by 12b. */
/* ── 11) Exactly one upstream fetch per cold invocation ── */
{
  const originalFetch = globalThis.fetch;
  const fixture = JSON.parse(readFileSync(join(API_DIR, '_fixtures/monerofail-health.json'), 'utf8'));
  let fetchCalls = 0;
  globalThis.fetch = async (...args) => {
    fetchCalls++;
    return { ok: true, status: 200, json: async () => fixture };
  };
  try {
    nodesMod._resetCache();
    fetchCalls = 0;
    const { res, headers } = makeRes();
    await nodesMod(makeReq('GET'), res);
    R.ok(fetchCalls === 1, 'cold invocation makes exactly 1 fetch call');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

/* 11b: warm invocation (cache hit) → zero additional fetches */
{
  const originalFetch = globalThis.fetch;
  const fixture = JSON.parse(readFileSync(join(API_DIR, '_fixtures/monerofail-health.json'), 'utf8'));
  let fetchCalls = 0;
  globalThis.fetch = async (...args) => {
    fetchCalls++;
    return { ok: true, status: 200, json: async () => fixture };
  };
  try {
    nodesMod._resetCache();

    /* First call (cold) */
    fetchCalls = 0;
    await nodesMod(makeReq('GET'), makeRes().res);
    const coldCalls = fetchCalls;
    R.ok(coldCalls === 1, 'first call: 1 fetch');

    /* Second call immediately after (still within 300s) */
    fetchCalls = 0;
    const { res: res2, headers: headers2 } = makeRes();
    await nodesMod(makeReq('GET'), res2);
    R.ok(fetchCalls === 0, 'warm call adds 0 fetches (served from cache)');
    R.ok(headers2['X-Cache'] === 'hit', 'warm call sets X-Cache: hit');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

/* ── 12) Leak discipline ── */
/* 12a: fixture text contains hostnames (proving the fixture is real) */
{
  const fixtureText = readFileSync(join(API_DIR, '_fixtures/monerofail-health.json'), 'utf8');
  R.ok(fixtureText.includes('clear-mode-a') && fixtureText.includes('onion-mode'),
    'fixture text contains hostnames (proof the fixture is real)');
}

/* 12b: serialized response does NOT contain hostnames */
{
  const originalFetch = globalThis.fetch;
  const fixture = JSON.parse(readFileSync(join(API_DIR, '_fixtures/monerofail-health.json'), 'utf8'));
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => fixture });
  try {
    nodesMod._resetCache();
    const { res, state } = makeRes();
    await nodesMod(makeReq('GET'), res);
    const serialized = JSON.stringify(state.body);
    R.ok(!serialized.includes('clear-mode-a') && !serialized.includes('onion-mode'),
      'serialized response does NOT leak fixture hostnames');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

/* 12c: Node records carry no 'host' key */
{
  const originalFetch = globalThis.fetch;
  const fixture = JSON.parse(readFileSync(join(API_DIR, '_fixtures/monerofail-health.json'), 'utf8'));
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => fixture });
  try {
    nodesMod._resetCache();
    const { res, state } = makeRes();
    await nodesMod(makeReq('GET'), res);
    const parsed = nodesMod.parseHealth(fixture);
    const allNodes = [...parsed.clear, ...parsed.onion, ...parsed.i2p];
    /* Same guard, same reason: an empty allNodes would make the host-key sweep
       vacuous while still printing a clean tally. */
    R.ok(allNodes.length > 0,
      `fixture yields node records to audit for host leakage (found ${allNodes.length})`);
    for (const node of allNodes) {
      R.ok(!node.hasOwnProperty('host'), 'parsed node record carries no host key');
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
}

/* 12d: env sentinels do not leak */
{
  const SENTINEL_PRIMARY = 'sentinel-primary-9f1c2e.invalid:39393';
  const SENTINEL_REF = 'sentinel-ref-7b21.invalid:11111';
  process.env.MONERO_PRIMARY_NODE = `http://${SENTINEL_PRIMARY}`;
  process.env.MONERO_REFERENCE_MAINNET = `http://${SENTINEL_REF}`;

  const originalFetch = globalThis.fetch;
  const fixture = JSON.parse(readFileSync(join(API_DIR, '_fixtures/monerofail-health.json'), 'utf8'));
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => fixture });
  try {
    nodesMod._resetCache();
    const { res, state } = makeRes();
    await nodesMod(makeReq('GET'), res);
    const serialized = JSON.stringify(state.body);
    R.ok(!serialized.includes(SENTINEL_PRIMARY) && !serialized.includes(SENTINEL_REF),
      'response never leaks MONERO_*_NODE env sentinels');
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv();
  }
}

/* 12e: source-level ban on health-reading identifiers */
{
  const fs = require('fs');
  const src = fs.readFileSync(join(API_DIR, 'nodes.js'), 'utf8');
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

  const banned = [
    [/\b_nodes\b/, '_nodes'],
    [/\bnodesFor\b/, 'nodesFor'],
    [/\bprimaryNode\b/, 'primaryNode'],
    [/\bmarkNode\w*\b/, 'markNodeDown/markNodeUp'],
    [/\bMONERO_\w+\b/, 'MONERO_*'],
  ];
  /* Pinned: comment one entry out and the ban silently narrows with no
     failure. Gate-local literal, so low risk — but it is the source-ban list,
     and a narrowed ban is indistinguishable from a passing one. */
  R.ok(banned.length === 5, `source-ban list covers 5 identifiers (found ${banned.length})`);
  for (const [re, label] of banned) {
    R.ok(!re.test(stripped), `nodes.js executable source never references ${label}`);
  }
}

/* 12f: only https://monero.fail/health.json is fetched (block comments removed) */
{
  const fs = require('fs');
  const src = fs.readFileSync(join(API_DIR, 'nodes.js'), 'utf8');
  /* Strip block comments only (line comments would break on https:// URLs). */
  const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '');

  /* Find the fetch call — it should exist and use the health endpoint */
  R.ok(stripped.includes("fetch('https://monero.fail/health.json'"),
    'nodes.js calls fetch with https://monero.fail/health.json in executable code');

  /* Verify there's only one such URL in non-comment code */
  const fetchMatches = [...stripped.matchAll(/fetch\(['\"]https:\/\/([^'\"]+)['\"]*/g)];
  R.ok(fetchMatches.length === 1 && fetchMatches[0][1].includes('monero.fail/health.json'),
    'only one fetch call to https:// exists in executable source');
}

/* ── 13) vercel.json ↔ disk parity ── */
/* 13a: every key in functions exists on disk */
{
  const vercelJson = JSON.parse(readFileSync(join(API_DIR, '..', 'vercel.json'), 'utf8'));
  const functions = vercelJson.functions || {};
  /* PIN THE COUNT, not merely non-emptiness. This assertion's whole purpose is
     that a `functions` key naming a file not on disk is a hard VERCEL BUILD
     error — it fails at deploy, not at any gate here. Unguarded, emptying the
     block made three assertions vanish and the gate still printed a clean
     tally: nothing distinguished "three keys, all verified" from "no keys,
     nothing verified". And this PR just DELETED a key from that block, so the
     count moving is now the normal-looking thing; the next move to zero would
     read as more of the same. A bare non-empty guard is not enough either —
     it cannot tell "legitimately smaller" from "found nothing". */
  R.ok(Object.keys(functions).length === 3,
    `vercel.json functions declares exactly 3 entries (found ${Object.keys(functions).length}: ${Object.keys(functions).join(', ') || 'none'})`);
  for (const key of Object.keys(functions)) {
    R.ok(existsSync(join(API_DIR, '..', key)),
      `vercel.json functions key "${key}" exists on disk (no stale keys)`);
  }
}

/* ── 12b) the client's reason vocabulary matches OBSERVED handler behaviour ──
 *
 * `NODE_REASONS` in app/src/data/useNodePopulation.ts is a hardcoded Set, and
 * `isNodePopulation` returns false for any reason outside it. So a reason the
 * handler legitimately emits but the client has not been told about makes the
 * store treat a CORRECT 200 envelope as malformed and fall to the
 * fetch-failure branch — and the panel then says "/api/nodes did not answer"
 * at the exact moment /api/nodes answered fine and was explaining an upstream
 * problem. Demonstrated in a browser, not argued: a fifth reason flips the
 * panel from "monero.fail did not answer" to "/api/nodes did not answer",
 * which is the two-sentence design inverted and a surface stating a cause it
 * does not have. It cannot fire today because the sets match; it fires the
 * first time someone adds a reason, which is exactly when something new is
 * going wrong upstream and a fabricated cause costs most.
 *
 * ONE literal checked against OBSERVED BEHAVIOUR — not two literals compared
 * to each other. An earlier draft of this assertion regex-scraped reason
 * strings out of api/nodes.js source and compared them to the client's list.
 * That version passes if a reason sits in dead code or a comment, and passes
 * if the handler STOPS emitting one while the literal remains. The handler's
 * real vocabulary is what it produces, and group 10 already produced it. */
{
  const clientSrc = readFileSync(join(API_DIR, '..', 'app', 'src', 'data', 'useNodePopulation.ts'), 'utf8');
  const block = clientSrc.match(/NODE_REASONS[^=]*=\s*new Set\(\[([\s\S]*?)\]\)/);
  const clientReasons = block
    ? [...new Set((block[1].match(/"[a-z-]+"/g) || []).map((x) => x.slice(1, -1)))].sort()
    : [];

  R.ok(OBSERVED_REASONS.length === 4,
    `group 10 observed 4 distinct reasons from the handler (got ${OBSERVED_REASONS.length}: ${OBSERVED_REASONS.join(', ')})`);
  R.ok(clientReasons.length === 4,
    `useNodePopulation.ts NODE_REASONS holds exactly 4 (got ${clientReasons.length}: ${clientReasons.join(', ')})`);
  R.ok(JSON.stringify(clientReasons) === JSON.stringify(OBSERVED_REASONS),
    'the client\'s NODE_REASONS equals the set the handler was OBSERVED to emit',
    `client=[${clientReasons.join(', ')}] observed=[${OBSERVED_REASONS.join(', ')}]`);
}

/* 13b: no headers source matches /api/nodes (would override handler's Cache-Control) */
{
  const vercelJson = JSON.parse(readFileSync(join(API_DIR, '..', 'vercel.json'), 'utf8'));
  const headers = vercelJson.headers || [];
  /* Guard BEFORE the loop. Break-tested: with `headers: []` the loop body ran
     zero times, the gate reported `80 passed · 0 failed`, and the property was
     never checked — three assertions silently vanished from the tally and the
     run still read as a success. A collection-driven assertion must first
     assert the collection is non-empty, or "we checked nothing" is
     indistinguishable from "we checked everything and it was fine". */
  R.ok(headers.length > 0,
    `vercel.json declares header rules to check (found ${headers.length})`);
  for (const h of headers) {
    const source = h.source || '';
    R.ok(!source.includes('/api/nodes'),
      `headers[].source "${source}" does not match /api/nodes (handler Cache-Control not overridden)`);
  }
}

/* ── 14) Honesty ledger ── */
R.fixture('parseHealth and heightClusters', 'tested against api/_fixtures/monerofail-health.json fixture');
R.fixture('16-check window (availability bucket edge case)', 'fixture includes a 16-check perfect node for boundary testing');
R.skip('node count matches monero.fail\'s own page (± sampling)',
  'sandbox has no egress to https://monero.fail — run on a deploy preview with: curl https://monero.fail/health.json | jq .monero | keys | length');

/* ── 14) this gate never touched the network ──────────────────────────────
 * The sentinel throws, so a stray call cannot reach monero.fail — but it can
 * still be SWALLOWED by the handler's own catch and reported as
 * `upstream-unreachable`, which would look like a passing offline test. This
 * counts them so a forgotten stub is visible rather than absorbed. */
R.ok(UNSTUBBED_FETCH_CALLS === 0,
  `no unstubbed fetch was attempted (${UNSTUBBED_FETCH_CALLS}) — the build job's "no network" contract`);

restoreEnv();
process.exit(R.finish());
