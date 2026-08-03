/* ═══════════════════════════════════════════════════════════════
   api/status.js — meta endpoint reporting node-cascade CONFIGURATION,
   never node HEALTH or LIVENESS.
   ═══════════════════════════════════════════════════════════════

   CommonJS, matching api/xmr.js:578's house pattern — this file
   `require('./_nodes.js')`, which is itself CommonJS (api/_nodes.js:140),
   and Vercel's api/ runtime default is CommonJS. Do NOT copy
   api/coingecko.js or api/markets.js as a template; those two are ESM.

   ─────────────────────────────────────────────────────────────────
   WHY THIS ENDPOINT CANNOT REPORT NODE HEALTH (read this before adding
   anything that looks like a health check)
   ─────────────────────────────────────────────────────────────────

   api/_nodes.js keeps a module-scope `health` Map (_nodes.js:47) that
   records transport failures/successes per node URL, with exponential
   cooldown. api/xmr.js reads and writes that Map on every RPC call via
   markNodeDown/markNodeUp, and it is the ONLY thing that makes the Map
   meaningful.

   On Vercel, each file under api/ that exports a handler becomes its OWN
   serverless function, and each function gets its OWN Node.js module
   registry. `require('./_nodes.js')` from api/status.js therefore
   instantiates a SEPARATE copy of _nodes.js, with its own SEPARATE
   `health` Map — one that api/xmr.js's traffic can never write to, and
   one that starts empty and STAYS empty for as long as this function's
   Lambda instance lives. This is not a cold-start transient that warms
   up: two different functions, on two different Lambda instances (which
   Vercel is free to route to independently, and will, since they scale
   and cool independently), can NEVER share this in-memory state. There
   is no version of "wait longer" or "call it twice" that fixes it.

   Concretely: `isNodeCold(url)` would ALWAYS return false here, and
   `_healthSnapshot()` would ALWAYS be empty — not because every node is
   healthy, but because this process has never made a single RPC call to
   observe otherwise. Surfacing that as "node X is healthy" would be a
   fabricated value on a live surface — exactly the failure mode
   CLAUDE.md says "has regressed once already." A live number is real or
   it is an em-dash; this endpoint has no way to make a node-health
   number real, so it does not report one at all.

   Consequently this file calls ONLY the two PURE, read-only exports of
   _nodes.js:
     • referenceNodes(network) — reads REFERENCE_MAINNET / env csv lists
     • primaryNode()           — reads MONERO_PRIMARY_NODE
     • REFERENCE_MAINNET       — the literal default array, for counting
   and NEVER:
     • nodesFor()          — routes through byHealth() → isNodeCold()
     • byHealth() (private, not exported)
     • isNodeCold()         — MUTATES: deletes expired Map entries as a
                              side effect of being called (_nodes.js:69-80)
     • markNodeDown/markNodeUp — write health state this process can't own
     • _healthSnapshot()    — would report this function's perpetually-
                              empty Map as if it meant something

   What IS safe to report, and what this endpoint reports instead, is
   CONFIGURATION (what env vars / defaults are set) and CAPABILITY (which
   API routes exist) — both are true statements independent of which
   Lambda instance answers the request. `probed: false` in the envelope
   makes that explicit at the wire level so no downstream reader has to
   infer it. */

const { referenceNodes, primaryNode, REFERENCE_MAINNET } = require('./_nodes.js');

/* Strip credentials and scheme, keep host:port. Reference hosts drawn from
   the PUBLIC default array are safe to name (already in git, see
   _nodes.js:31-40); anything env-supplied is an operator value and must
   never be named — see hostsForDisplay() below. */
function hostPort(url) {
  try {
    const u = new URL(url);
    return u.port ? `${u.hostname}:${u.port}` : u.hostname;
  } catch (_) {
    return null;
  }
}

/* referenceCount counts EVERY configured reference node for a network,
   whether it came from the public default array or an operator's env var.
   referenceHosts names ONLY hosts that also appear in the built-in
   REFERENCE_MAINNET default — never anything supplied via
   MONERO_REFERENCE_MAINNET (or the other per-network env vars), because
   those are operator values, not public defaults. This is why
   referenceHosts.length can be SHORTER than referenceCount: on a
   deployment that overrides the mainnet pool via env, every configured
   host is counted but none of them may be named (the override list has no
   overlap with the default array by construction). That asymmetry is
   deliberate, not a bug — do not "fix" referenceHosts to just list
   whatever referenceNodes() returns. */
function hostsForDisplay(network) {
  const configured = referenceNodes(network);
  if (network !== 'mainnet') return []; // only the mainnet default array is public
  const publicHosts = new Set(REFERENCE_MAINNET.map(hostPort).filter(Boolean));
  return configured
    .map(hostPort)
    .filter((h) => h && publicHosts.has(h));
}

function networkCounts() {
  return {
    mainnet: referenceNodes('mainnet').length,
    stagenet: referenceNodes('stagenet').length,
    testnet: referenceNodes('testnet').length,
    betanet: referenceNodes('betanet').length,
  };
}

const ENDPOINTS = [
  { path: '/api/xmr', file: 'xmr.js', kind: 'node' },
  { path: '/api/nodes', file: 'nodes.js', kind: 'network' },
  { path: '/api/coingecko', file: 'coingecko.js', kind: 'market' },
  { path: '/api/markets', file: 'markets.js', kind: 'market' },
  { path: '/api/feeds', file: 'feeds.js', kind: 'editorial' },
  { path: '/api/status', file: 'status.js', kind: 'meta' },
];

module.exports = async function handler(req, res) {
  // CORS + Cache-Control set IN-HANDLER, mirroring api/xmr.js:579-582 — this
  // route needs its own headers because vercel.json declares no `Cache-Control`
  // header rule for any `/api/*` path, and the `functions` block is optional
  // (api/coingecko.js has no entry there either).
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'GET only' }); return; }

  const mainnetRef = referenceNodes('mainnet');

  const body = {
    v: 1,
    at: new Date().toISOString(),
    probed: false,
    note: 'configuration only — this endpoint does not probe any upstream',
    cascade: {
      primaryConfigured: !!primaryNode(),
      referenceCount: mainnetRef.length,
      referenceHosts: hostsForDisplay('mainnet'),
      networks: networkCounts(),
    },
    endpoints: ENDPOINTS,
  };

  res.status(200).json(body);
};
