/* verify-nodehealth.mjs — offline unit test for the api/_nodes.js cascade health
   memory (v6.0.6).
   Run: node api/_tests/verify-nodehealth.mjs

   The sandbox has no network egress to Monero nodes, so this exercises the pure
   ordering/cooldown logic directly with injected timestamps — never Date.now().

   What it proves:
     • the historical cascade order is byte-identical when nothing has failed
     • a failed node is REORDERED to the back, never dropped
     • cooldown grows exponentially, is capped, and expires
     • a success clears state immediately
     • an all-cold cascade still returns every node ("never let one dead node
       blank the page") */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const nodes = require('../_nodes.js');
const {
  nodesFor, markNodeDown, markNodeUp, isNodeCold,
  _resetHealth, COOLDOWN_BASE_MS, COOLDOWN_MAX_MS,
} = nodes;

let fail = false;
const ok = (cond, msg) => { console.log((cond ? '✅ ' : '❌ ') + msg); if (!cond) fail = true; };

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* Deterministic clock. Never Date.now(). */
const T0 = 1_750_000_000_000;

const HISTORICAL = [
  'http://node.moneroworld.com:18089',
  'http://nodes.hashvault.pro:18081',
  'http://node.community.rino.io:18081',
  'http://opennode.xmr-tw.org:18089',
  'https://node.sethforprivacy.com:18089',
  'https://xmr-node.cakewallet.com:18081',
];

// Keep a pristine env; several sections mutate it.
const ENV0 = {
  primary: process.env.MONERO_PRIMARY_NODE,
  mainnet: process.env.MONERO_REFERENCE_MAINNET,
};
const restoreEnv = () => {
  if (ENV0.primary === undefined) delete process.env.MONERO_PRIMARY_NODE;
  else process.env.MONERO_PRIMARY_NODE = ENV0.primary;
  if (ENV0.mainnet === undefined) delete process.env.MONERO_REFERENCE_MAINNET;
  else process.env.MONERO_REFERENCE_MAINNET = ENV0.mainnet;
};
delete process.env.MONERO_PRIMARY_NODE;
delete process.env.MONERO_REFERENCE_MAINNET;

// 1) default order invariant — the whole point of the "DO NOT reorder" comment
_resetHealth();
ok(eq(nodesFor('mainnet', T0), HISTORICAL),
   'no failures ⇒ historical cascade order is byte-identical');
ok(nodesFor('mainnet', T0).length === 6, 'default cascade has 6 nodes');

// 2) a failed node moves to the BACK and is never dropped
_resetHealth();
markNodeDown(HISTORICAL[0], T0);
const afterDown = nodesFor('mainnet', T0 + 1);
ok(afterDown.length === 6, 'cold node is reordered, not dropped (length still 6)');
ok(afterDown[5] === HISTORICAL[0], 'cold node sorts to the back');
ok(eq(afterDown.slice(0, 5), HISTORICAL.slice(1)),
   'the five healthy nodes keep their relative order');

// 3) cooldown expiry returns the node to its natural position
_resetHealth();
markNodeDown(HISTORICAL[0], T0);
ok(isNodeCold(HISTORICAL[0], T0 + 1), 'node is cold inside the cooldown window');
ok(!isNodeCold(HISTORICAL[0], T0 + COOLDOWN_BASE_MS + 1),
   'node is warm again once the cooldown elapses');
_resetHealth();
markNodeDown(HISTORICAL[0], T0);
ok(eq(nodesFor('mainnet', T0 + COOLDOWN_BASE_MS + 1), HISTORICAL),
   'after cooldown the historical order is restored exactly');

// 4) exponential growth, capped
_resetHealth();
markNodeDown(HISTORICAL[1], T0);
ok(isNodeCold(HISTORICAL[1], T0 + COOLDOWN_BASE_MS - 1) &&
   !isNodeCold(HISTORICAL[1], T0 + COOLDOWN_BASE_MS + 1),
   `1 failure ⇒ ${COOLDOWN_BASE_MS}ms cooldown`);
_resetHealth();
markNodeDown(HISTORICAL[1], T0);          // failures = 1
markNodeDown(HISTORICAL[1], T0);          // failures = 2 → 2× base
ok(isNodeCold(HISTORICAL[1], T0 + COOLDOWN_BASE_MS * 2 - 1),
   '2 consecutive failures ⇒ cooldown doubled');
ok(!isNodeCold(HISTORICAL[1], T0 + COOLDOWN_BASE_MS * 2 + 1),
   '2-failure cooldown still expires at 2× base');
_resetHealth();
for (let i = 0; i < 20; i++) markNodeDown(HISTORICAL[1], T0);
ok(!isNodeCold(HISTORICAL[1], T0 + COOLDOWN_MAX_MS + 1),
   `cooldown is capped at ${COOLDOWN_MAX_MS}ms however many failures accrue`);

// 5) success clears state immediately
_resetHealth();
markNodeDown(HISTORICAL[0], T0);
markNodeUp(HISTORICAL[0]);
ok(!isNodeCold(HISTORICAL[0], T0 + 1), 'markNodeUp clears the cooldown at once');
ok(eq(nodesFor('mainnet', T0 + 1), HISTORICAL), 'recovered node returns to its slot');
// and the failure streak resets, so the next failure starts at base again
markNodeDown(HISTORICAL[0], T0);
ok(!isNodeCold(HISTORICAL[0], T0 + COOLDOWN_BASE_MS + 1),
   'markNodeUp also resets the backoff ladder to base');

// 6) every node cold ⇒ still returns all of them (never blank the page)
_resetHealth();
for (const n of HISTORICAL) markNodeDown(n, T0);
const allCold = nodesFor('mainnet', T0 + 1);
ok(allCold.length === 6, 'all nodes cold ⇒ cascade is still 6 long, never empty');
ok(eq([...allCold].sort(), [...HISTORICAL].sort()),
   'all nodes cold ⇒ the same six nodes, just reordered');

// 7) env overrides still behave, and health ordering composes with them
_resetHealth();
process.env.MONERO_REFERENCE_MAINNET = 'http://a:1, http://b:2 ,http://c:3';
ok(eq(nodesFor('mainnet', T0), ['http://a:1', 'http://b:2', 'http://c:3']),
   'MONERO_REFERENCE_MAINNET overrides the pool (trimmed, order preserved)');
markNodeDown('http://a:1', T0);
ok(eq(nodesFor('mainnet', T0 + 1), ['http://b:2', 'http://c:3', 'http://a:1']),
   'health ordering applies to an env-supplied pool too');

_resetHealth();
process.env.MONERO_PRIMARY_NODE = 'http://primary:18081';
ok(nodesFor('mainnet', T0)[0] === 'http://primary:18081',
   'a healthy MONERO_PRIMARY_NODE leads the cascade');
markNodeDown('http://primary:18081', T0);
const coldPrimary = nodesFor('mainnet', T0 + 1);
ok(coldPrimary[coldPrimary.length - 1] === 'http://primary:18081',
   'a cold primary falls behind the healthy pool instead of costing a timeout');
ok(coldPrimary.length === 4, 'cold primary is still present (3 pool + 1 primary)');

// stagenet never gets the mainnet primary or the mainnet default pool
_resetHealth();
ok(eq(nodesFor('stagenet', T0), []),
   'stagenet with no env var returns [] (no mainnet leakage)');

restoreEnv();
_resetHealth();

console.log(fail ? '\n❌ verify-nodehealth FAILED' : '\n✅ verify-nodehealth: all assertions passed');
process.exit(fail ? 1 : 0);
