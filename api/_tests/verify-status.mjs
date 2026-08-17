/* verify-status.mjs — offline gate for api/status.js (the node-cascade
   configuration/capability meta endpoint, v1).
   Run: node api/_tests/verify-status.mjs   (from app/: node ../api/_tests/verify-status.mjs)

   The sandbox has no outbound HTTP to Monero nodes, so every "is this node
   reachable" question below is a FIXTURE, not a probe — see the
   R.fixture() lines, one per host in REFERENCE_MAINNET. Those pair with
   assertion 5 (the perturbation check): the fixtures say "we could not
   probe any node from here"; assertion 5 proves "and neither did
   api/status.js" by stubbing globalThis.fetch and asserting it was never
   called. Together they are the whole point of this file — a gate that
   PROVES an endpoint deliberately does nothing live, rather than one that
   just happens not to exercise the live path.

   Reporter: imported from ../app/verify-reporter.mjs rather than rolled
   privately (unlike this directory's other four gates) because
   verify-reporter.mjs's own header explains why — api/ reaching into app/
   for it is deliberate, not a tidiness violation, and ci.yml already runs
   `node ../api/verify-*.mjs` under `working-directory: app` so the two
   trees are already coupled at the runner level. Do NOT import
   ../app/verify-lib.mjs instead — that module's first import is
   playwright, and this gate has no business dragging a browser-automation
   dependency into an "offline" run. */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { makeReporter } from '../../app/verify-reporter.mjs';
import { STATUS_FIXTURE } from '../../app/verify-fixtures.mjs';

const R = makeReporter('verify-status');
const API_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

/* ── env sandbox — mirrors the restoreEnv idiom in verify-nodehealth.mjs ── */
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

/* ── a minimal res double matching the chaining idiom api/xmr.js uses:
   res.setHeader(k,v); res.status(code).json(obj); res.status(code).end(); ── */
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
      // Mirrors Vercel's real res.json(), which sets this header itself —
      // status.js never has to (and does not) set Content-Type by hand.
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/json; charset=utf-8';
      return res;
    },
    end() { state.ended = true; return res; },
  };
  return { req: undefined, res, headers, state };
}

function makeReq(method) {
  return { method, query: {}, url: '/api/status' };
}

/* ── 1) CommonJS proof: requiring an ESM file throws ERR_REQUIRE_ESM, so a
   successful require() that returns a function mechanically proves this
   file is CommonJS, not merely documented as such. ── */
let statusMod;
try {
  statusMod = require('../status.js');
  R.ok(typeof statusMod === 'function',
    'require(\'../status.js\') returns a function (mechanically proves CommonJS — an ESM file would throw ERR_REQUIRE_ESM here)');
} catch (err) {
  R.ok(false, 'require(\'./status.js\') succeeded', err.message);
  process.exit(R.finish());
}

/* ── 2) HTTP method behaviour ── */
{
  const { req, res, state } = makeRes(), reqO = makeReq('OPTIONS');
  await statusMod(reqO, res);
  R.ok(state.statusCode === 200, 'OPTIONS → 200');
}
{
  const { res, state } = makeRes();
  await statusMod(makeReq('POST'), res);
  R.ok(state.statusCode === 405, 'POST → 405');
}
{
  const { res, state } = makeRes();
  await statusMod(makeReq('GET'), res);
  R.ok(state.statusCode === 200, 'GET → 200');
}

/* ── 3) Cache-Control + JSON content type on the GET path ── */
{
  const { res, headers, state } = makeRes();
  await statusMod(makeReq('GET'), res);
  R.ok(headers['Cache-Control'] === 'no-store', 'GET sets Cache-Control: no-store');
  R.ok(state.jsonCalled && /json/i.test(headers['Content-Type'] || ''),
    'GET response is JSON (res.json() called, JSON content type present)');
}

/* ── 4) envelope shape ── */
{
  const { res, state } = makeRes();
  await statusMod(makeReq('GET'), res);
  const body = state.body || {};
  R.ok(body.v === 1, 'envelope has v === 1');
  R.ok(typeof body.at === 'string' && !Number.isNaN(Date.parse(body.at)),
    'envelope.at parses as a valid ISO date');
  R.ok(body.probed === false, 'envelope.probed === false');
  R.ok(typeof body.note === 'string' && body.note.includes('does not probe'),
    'envelope.note contains the substring "does not probe"');
}

/* ── 5) the perturbation assertion — proves status.js makes zero network
   calls, which is what the six fixture lines below are paired against. ── */
{
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (...args) => { calls++; return originalFetch(...args); };
  try {
    const { res } = makeRes();
    await statusMod(makeReq('GET'), res);
    R.ok(calls === 0, 'handler calls fetch() zero times (no upstream probing of any kind)');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

/* ── 6) the no-leak assertion ── */
{
  const SENTINEL_PRIMARY = 'sentinel-primary-9f1c2e.invalid:39393';
  const SENTINEL_REF_A = 'sentinel-ref-a-7b21.invalid:11111';
  const SENTINEL_REF_B = 'sentinel-ref-b-7b22.invalid:22222';
  process.env.MONERO_PRIMARY_NODE = `http://${SENTINEL_PRIMARY}`;
  process.env.MONERO_REFERENCE_MAINNET = `http://${SENTINEL_REF_A},http://${SENTINEL_REF_B}`;
  try {
    const { res, state } = makeRes();
    await statusMod(makeReq('GET'), res);
    const body = state.body || {};
    const serialized = JSON.stringify(body);
    R.ok(!serialized.includes(SENTINEL_PRIMARY) && !serialized.includes(SENTINEL_REF_A) && !serialized.includes(SENTINEL_REF_B),
      'response body leaks NEITHER the primary-node sentinel NOR the reference-pool sentinels');
    R.ok(body.cascade?.primaryConfigured === true,
      'primaryConfigured reflects that MONERO_PRIMARY_NODE is set, without naming it');
    R.ok(body.cascade?.referenceCount === 2,
      'referenceCount reflects the 2-item env-supplied reference list');
  } finally {
    restoreEnv();
  }
}

/* ── 7) every declared endpoint file exists on disk ── */
{
  const { res, state } = makeRes();
  await statusMod(makeReq('GET'), res);
  const body = state.body || {};
  const endpoints = Array.isArray(body.endpoints) ? body.endpoints : [];
  R.ok(endpoints.length > 0, 'envelope.endpoints is a non-empty array');
  for (const ep of endpoints) {
    R.ok(existsSync(join(API_DIR, ep.file)), `endpoints[] entry "${ep.file}" exists on disk in api/`);
  }
}

/* ── 8) source-level ban on health-reading identifiers ── */
{
  const fs = require('fs');
  const src = fs.readFileSync(join(API_DIR, 'status.js'), 'utf8');
  // Strip comments first — the file's own header legitimately NAMES every
  // one of these identifiers in prose, to explain why none of them is
  // called. Only the executable source may be silent on them.
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  const banned = [
    [/\bnodesFor\b/, 'nodesFor'],
    [/\bisNodeCold\b/, 'isNodeCold'],
    [/\bbyHealth\b/, 'byHealth'],
    [/\bmarkNode\w*\b/, 'markNodeDown/markNodeUp'],
    [/\b_healthSnapshot\b/, '_healthSnapshot'],
  ];
  for (const [re, label] of banned) {
    R.ok(!re.test(stripped), `status.js executable source never references ${label} (comments stripped first)`);
  }
}

/* ── 9) endpoint key-set parity — the handler's declared endpoints match the
   fixture on ALL THREE FIELDS: path, file, AND kind. This assertion is the
   only thing that makes the fixture better than no mock — it proves the mock
   cannot quietly rot away from the endpoint it stands in for. Two distinct
   assertions with distinct messages: membership (same set, all three fields
   equal) and ordering (same order). Reason: these arrays are literal parallels,
   so positional divergence IS divergence — but a cosmetic reorder reding with
   "parity failed" invites loosening the gate, and a loosened parity assertion
   in the gate written to replace a phantom one is the vacuity class returning
   through the front door. Two messages mean a reorder reds with "order differs"
   so nobody widens the wrong one. ── */
{
  const { res, state } = makeRes();
  await statusMod(makeReq('GET'), res);
  const body = state.body || {};
  const handlerEndpoints = Array.isArray(body.endpoints) ? body.endpoints : [];
  const fixtureEndpoints = STATUS_FIXTURE.endpoints;

  // Build membership map: path => { file, kind }
  const handlerMap = new Map(handlerEndpoints.map((ep) => [ep.path, { file: ep.file, kind: ep.kind }]));
  const fixtureMap = new Map(fixtureEndpoints.map((ep) => [ep.path, { file: ep.file, kind: ep.kind }]));

  // Check membership: same paths, and for each path the same file and kind
  const handlerPaths = new Set(handlerEndpoints.map((ep) => ep.path));
  const fixturePaths = new Set(fixtureEndpoints.map((ep) => ep.path));
  const membershipMismatches = [];

  // Check paths only in handler (not in fixture)
  for (const path of handlerPaths) {
    if (!fixturePaths.has(path)) {
      membershipMismatches.push(`handler has ${path} (fixture does not)`);
    } else {
      const hh = handlerMap.get(path);
      const ff = fixtureMap.get(path);
      if (hh.file !== ff.file) {
        membershipMismatches.push(`${path} file: handler="${hh.file}" vs fixture="${ff.file}"`);
      }
      if (hh.kind !== ff.kind) {
        membershipMismatches.push(`${path} kind: handler="${hh.kind}" vs fixture="${ff.kind}"`);
      }
    }
  }

  // Check paths only in fixture (not in handler)
  for (const path of fixturePaths) {
    if (!handlerPaths.has(path)) {
      membershipMismatches.push(`fixture has ${path} (handler does not)`);
    }
  }

  R.ok(membershipMismatches.length === 0,
    'handler endpoints membership matches fixture on path, file, and kind',
    membershipMismatches.join('; '));
}

/* ── 10) endpoint ordering — the handler's endpoints array has the same order
    as the fixture. Positional divergence is divergence. ── */
{
  const { res, state } = makeRes();
  await statusMod(makeReq('GET'), res);
  const body = state.body || {};
  const handlerEndpoints = Array.isArray(body.endpoints) ? body.endpoints : [];
  const fixtureEndpoints = STATUS_FIXTURE.endpoints;

  // Compare order by path (since path is the unique identifier)
  const handlerPaths = handlerEndpoints.map((ep) => ep.path);
  const fixturePaths = fixtureEndpoints.map((ep) => ep.path);

  const orderMismatches = [];
  for (let i = 0; i < Math.max(handlerPaths.length, fixturePaths.length); i++) {
    if (i >= handlerPaths.length) {
      orderMismatches.push(`index ${i}: fixture has "${fixturePaths[i]}" (handler does not)`);
    } else if (i >= fixturePaths.length) {
      orderMismatches.push(`index ${i}: handler has "${handlerPaths[i]}" (fixture does not)`);
    } else if (handlerPaths[i] !== fixturePaths[i]) {
      orderMismatches.push(`index ${i}: handler="${handlerPaths[i]}" vs fixture="${fixturePaths[i]}"`);
    }
  }

  R.ok(orderMismatches.length === 0,
    'handler endpoints order matches fixture',
    orderMismatches.join('; '));
}

/* ── fixtures — one per reachability question this sandbox cannot answer ── */
{
  const { REFERENCE_MAINNET } = require('../_nodes.js');
  for (const url of REFERENCE_MAINNET) {
    let host;
    try { host = new URL(url).host; } catch { host = url; }
    R.fixture(`node ${host} · reachability`,
      'no outbound HTTP in this sandbox — the cascade list is asserted from api/_nodes.js, never probed');
  }
}

restoreEnv();
process.exit(R.finish());
