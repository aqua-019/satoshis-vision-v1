/* api/_nodes.js — single source of truth for the Monero node cascade.
   CommonJS (the api/ runtime default); required by both RPC proxies.
   Underscore prefix ⇒ Vercel excludes it from routing.

   ROLES (the V6 architecture this foundation prepares for):
     • PRIMARY  — the operator's own monerod. In V6 this is the FEATURED data
       source and the only node with unrestricted peer/connection RPC. Set via
       MONERO_PRIMARY_NODE. Unset in 5.0.x, so the public pool serves everything.
     • REFERENCE POOL — 4–10 public nodes. In 5.0.x this IS the working cascade
       (all chain data). In V6 it is the reference set for incoming node / peer
       data, cross-referenced against the primary.

   With NO env vars set AND no recorded failures, nodesFor('mainnet') returns the
   historical working cascade in the historical order — behaviour is
   byte-identical to before.

   HEALTH MEMORY (v6.0.6). Public nodes are unreliable: of five well-known nodes
   tested 2026-07-30, four were down. Previously every RPC call restarted the
   cascade at index 0, so a dead head-of-list cost a full 6s timeout on EVERY
   request. Nodes are now cold-marked on transport failure and sorted to the back
   of the cascade until their cooldown expires.

   Two deliberate properties:
     • A cold node is REORDERED, never dropped. If every node is cold the full
       list is still returned, so a total-outage false positive can't blank the
       page — it only costs ordering.
     • State is module-scope, so it lives only as long as a warm Lambda. That is
       intentional: cold-marking is an OPTIMISATION and correctness never depends
       on it surviving a cold start. */

const REFERENCE_MAINNET = [
  // proven working set — xmr.js's live order, DO NOT reorder:
  'http://node.moneroworld.com:18089',
  'http://nodes.hashvault.pro:18081',
  'http://node.community.rino.io:18081',
  'http://opennode.xmr-tw.org:18089',
  // additional proven fallbacks (previously isolated in api/monero.js, deleted in v6.1.7):
  'https://node.sethforprivacy.com:18089',
  'https://xmr-node.cakewallet.com:18081',
];

const csv = (v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);

/* ── health memory ──────────────────────────────────────────────────────── */

/** url → { failures, until }. Warm-Lambda lifetime only. */
const health = new Map();

/** First cooldown after a single failure. Doubles per consecutive failure. */
const COOLDOWN_BASE_MS = 30_000;
/** Ceiling, so a node that recovers is retried within a few minutes. */
const COOLDOWN_MAX_MS = 5 * 60_000;

/** Record a TRANSPORT failure (timeout, refused, non-2xx). Callers must NOT use
 *  this for an RPC-level `{error:{...}}` reply — a node that answers with a
 *  protocol error is alive and healthy. */
function markNodeDown(url, now = Date.now()) {
  const failures = (health.get(url)?.failures || 0) + 1;
  // 30s, 60s, 120s, 240s, 300s (capped)
  const cooldown = Math.min(COOLDOWN_MAX_MS, COOLDOWN_BASE_MS * Math.pow(2, failures - 1));
  health.set(url, { failures, until: now + cooldown });
}

/** Record a success — clears any cooldown and the failure streak immediately. */
function markNodeUp(url) {
  health.delete(url);
}

/** True while `url` is inside its cooldown window. */
function isNodeCold(url, now = Date.now()) {
  const h = health.get(url);
  if (!h) return false;
  if (now >= h.until) {
    // Cooldown served — forget it so the node returns to its natural position
    // and its next failure starts the backoff ladder afresh.
    health.delete(url);
    return false;
  }
  return true;
}

/** Stable partition: warm nodes first (original order), cold nodes last
 *  (original order). Never drops a node. */
function byHealth(list, now) {
  const warm = [];
  const cold = [];
  for (const n of list) (isNodeCold(n, now) ? cold : warm).push(n);
  return warm.concat(cold);
}

/* ── configuration ──────────────────────────────────────────────────────── */

/** The operator's own node, or null when unconfigured (5.0.x → null). */
function primaryNode() {
  const v = process.env.MONERO_PRIMARY_NODE;
  return v && v.trim() ? v.trim() : null;
}

/** The 4–10 public reference nodes for a network. Env-overridable per network;
 *  mainnet falls back to the proven default set. Grow toward 10 via env or V6. */
function referenceNodes(network = 'mainnet') {
  switch (network) {
    case 'stagenet': return csv(process.env.MONERO_REFERENCE_STAGENET);
    case 'testnet':  return csv(process.env.MONERO_REFERENCE_TESTNET);
    case 'betanet':  return csv(process.env.MONERO_REFERENCE_BETANET);
    case 'mainnet':
    default: {
      const override = csv(process.env.MONERO_REFERENCE_MAINNET);
      return override.length ? override : REFERENCE_MAINNET;
    }
  }
}

/** The operative cascade a proxy iterates: primary first (when set), then the
 *  public reference pool, with cold nodes sorted to the back of each group.
 *  Call this PER REQUEST — caching it at module scope freezes the order for the
 *  warm Lambda's whole life and defeats the health memory. */
function nodesFor(network = 'mainnet', now = Date.now()) {
  const primary = network === 'mainnet' ? primaryNode() : null;
  const pool = byHealth(referenceNodes(network), now);
  if (!primary) return pool;
  const rest = pool.filter((n) => n !== primary);
  // A cold primary still leads only if it's warm; otherwise it falls behind the
  // healthy pool rather than costing a timeout on every request.
  return isNodeCold(primary, now) ? [...rest, primary] : [primary, ...rest];
}

/* ── test-only introspection ────────────────────────────────────────────── */

/** TEST ONLY — clear all health state. */
function _resetHealth() {
  health.clear();
}

/** TEST ONLY — snapshot of the health map. */
function _healthSnapshot() {
  return new Map(health);
}

module.exports = {
  nodesFor,
  primaryNode,
  referenceNodes,
  markNodeDown,
  markNodeUp,
  isNodeCold,
  _resetHealth,
  _healthSnapshot,
  COOLDOWN_BASE_MS,
  COOLDOWN_MAX_MS,
  REFERENCE_MAINNET,
};
