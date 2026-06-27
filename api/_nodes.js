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

   With NO env vars set, nodesFor('mainnet') returns the historical working
   cascade in the historical order — behaviour is byte-identical to before. */

const REFERENCE_MAINNET = [
  // proven working set — xmr.js's live order, DO NOT reorder:
  'http://node.moneroworld.com:18089',
  'http://nodes.hashvault.pro:18081',
  'http://node.community.rino.io:18081',
  'http://opennode.xmr-tw.org:18089',
  // additional proven fallbacks (previously isolated in api/monero.js):
  'https://node.sethforprivacy.com:18089',
  'https://xmr-node.cakewallet.com:18081',
];

const csv = (v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);

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
 *  public reference pool. 5.0.x with no primary ⇒ exactly the historical pool. */
function nodesFor(network = 'mainnet') {
  const primary = network === 'mainnet' ? primaryNode() : null;
  const pool = referenceNodes(network);
  return primary ? [primary, ...pool.filter((n) => n !== primary)] : pool;
}

module.exports = { nodesFor, primaryNode, referenceNodes };
