/* ═══════════════════════════════════════════════════════════════
   api/xmr.js — Vercel serverless relay bridge
   Implements the full /api/xmr/* REST surface that xmr-relay-ws.js
   expects, calling monerod directly via the existing cascade pattern.
   This is the no-VPS fallback — all REST data works, WebSocket push
   requires relay.xmr.irish once it is deployed.
   ═══════════════════════════════════════════════════════════════ */

const { nodesFor, markNodeDown, markNodeUp } = require('./_nodes.js');

/* Resolve the cascade PER CALL, never at module scope: _nodes.js sorts
   cold-marked nodes to the back, and a module-scope snapshot would freeze the
   order for the warm Lambda's whole life and defeat that entirely. */
const nodes = () => nodesFor('mainnet');

/* Overall budget for one cascade walk. The per-node timeouts (6s/8s) across a
   6-node list add up to 36s+, which exceeds this function's maxDuration of 30s
   (vercel.json) — the platform would kill us mid-flight and the client would see
   a hang rather than a clean failure. Give up at 12s and let the caller fall
   back to last-good values instead. */
const CASCADE_BUDGET_MS = 12_000;

const POOL_TAGS = [
  { name: 'P2Pool',        tags: ['p2pool'],                  type: 'decentralized', url: 'https://p2pool.io' },
  { name: 'SupportXMR',    tags: ['SupportXMR','supportxmr'], type: 'centralized',   url: 'https://supportxmr.com' },
  { name: 'MoneroOcean',   tags: ['MoneroOcean','moneroocean'],type: 'centralized',   url: 'https://moneroocean.stream' },
  { name: 'Nanopool',      tags: ['nanopool','xmr.nanopool'], type: 'centralized',   url: 'https://xmr.nanopool.org' },
  { name: 'HashVault',     tags: ['hashvault','HashVault'],   type: 'centralized',   url: 'https://monero.hashvault.pro' },
  { name: '2Miners',       tags: ['2miners','2Miners'],       type: 'centralized',   url: 'https://xmr.2miners.com' },
  { name: 'C3Pool',        tags: ['c3pool','C3Pool'],         type: 'centralized',   url: 'https://c3pool.com' },
  { name: 'Solo/Unknown',  tags: [],                          type: 'solo',          url: null },
];

function identifyPool(extraHex) {
  if (!extraHex) return POOL_TAGS[POOL_TAGS.length - 1];
  let text = '';
  try {
    const bytes = Buffer.from(extraHex, 'hex');
    text = bytes.toString('utf8');
  } catch (_) { return POOL_TAGS[POOL_TAGS.length - 1]; }
  for (const pool of POOL_TAGS) {
    if (pool.tags.some(t => text.includes(t))) return pool;
  }
  return POOL_TAGS[POOL_TAGS.length - 1];
}

async function rpc(method, params = {}) {
  const body = JSON.stringify({ jsonrpc: '2.0', id: '0', method, params });
  const deadline = Date.now() + CASCADE_BUDGET_MS;
  for (const node of nodes()) {
    if (Date.now() >= deadline) break;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), Math.min(6000, deadline - Date.now()));
      const res = await fetch(`${node}/json_rpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) { markNodeDown(node); continue; }
      const json = await res.json();
      /* The node answered, so it is HEALTHY — even if monerod replied with a
         JSON-RPC error (e.g. a restricted-RPC "Method not found"). Marking it
         down here would evict good nodes for admin-only methods. */
      markNodeUp(node);
      if (json?.result) return json.result;
    } catch (_) {
      /* transport-level: timeout, refused, DNS, TLS */
      markNodeDown(node);
    }
  }
  return null;
}

async function rpcHttp(path, payload) {
  const body = payload != null ? JSON.stringify(payload) : '{}';
  const deadline = Date.now() + CASCADE_BUDGET_MS;
  for (const node of nodes()) {
    if (Date.now() >= deadline) break;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), Math.min(8000, deadline - Date.now()));
      const res = await fetch(`${node}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) { markNodeDown(node); continue; }
      markNodeUp(node);
      return await res.json();
    } catch (_) {
      markNodeDown(node);
    }
  }
  return null;
}

/* ── fee tiers: the node's own vocabulary ──────────────────────────────────
   p4·M9a. `feeTier()` used to classify a rate against 1/5/20/80 pcn/B —
   thresholds three orders of magnitude UNDER mainnet's ~20,000 pcn/B floor —
   so every pool tx was tagged `priority` and the histogram read [0,0,0,0,N].
   The node publishes its own four tiers (`get_fee_estimate.fees`, the array
   /api/xmr/network and /api/xmr/fees already relay), and the client's table,
   stat strip and classic cards all classify against THAT with the identical
   `<` comparisons (app/src/data/map.ts feeTierIndex). One vocabulary:
   slow · normal · fast · fastest, index 0..3 — or null when no node answered
   the estimate, never a plausible default. api/_tests/verify-tx-parse.mjs
   pins the boundary semantics so the two implementations cannot drift. */
const FEE_TIER_LABELS = ['slow', 'normal', 'fast', 'fastest'];
function feeTierIndex(rate, tiers) {
  if (!Array.isArray(tiers) || tiers.length !== 4 || !Number.isFinite(rate)) return -1;
  if (rate < tiers[1]) return 0;
  if (rate < tiers[2]) return 1;
  if (rate < tiers[3]) return 2;
  return 3;
}
function feeTier(rate, tiers) {
  const k = feeTierIndex(rate, tiers);
  return k < 0 ? null : FEE_TIER_LABELS[k];
}
const FEE_TIER_COLORS = { slow: '#3D8EFF', normal: '#00C97A', fast: '#F26822', fastest: '#FF4455' };

/* ── first-sighting memory ────────────────────────────────────────────────
   p4·M9a. The production node answers `receive_time: 0` on every pool tx, so
   the node's clock says nothing about when a tx arrived (the client renders
   an em-dash for it — app/src/data/map.ts). This function polls the pool
   every few seconds, so it CAN know, honestly, when IT first listed a txid —
   an observation, not a synthesis. It is a LOWER BOUND on the network age,
   which is why the client labels it "seen" and never "age".
     • A txid already in the pool when this instance first polled gets NOTHING:
       the function never watched it arrive and has no honest sighting for it.
       `first_seen_since` is published beside the rows so a reader of the JSON
       can tell "unknown" from "not stamped yet".
     • Warm-Lambda lifetime only, like _nodes.js's health map. A cold start
       forgets everything, correctly; the client carries a sighting forward
       across polls (map.ts) so a recycled instance does not regress an age a
       page already knows. Concurrent instances each keep their own memory —
       the client's carry-forward takes the EARLIEST sighting it has ever been
       handed, so an age never moves backwards on a reader's screen.
     • Bounded by construction: an entry whose txid left the pool is dropped on
       the next answered poll, so the map is never larger than the pool.
     • NEVER updated from a failed poll. An upstream outage answers no list, and
       pruning against an empty list would forget every sighting the outage did
       not actually end. */
function newFirstSeenState() { return { seen: new Map(), baseline: null, since: null }; }
const FIRST_SEEN = newFirstSeenState();
function noteFirstSightings(state, txids, nowS) {
  const present = new Set(txids);
  if (state.baseline === null) {
    state.baseline = present;
    state.since = nowS;
  } else {
    for (const id of present) {
      if (!state.seen.has(id) && !state.baseline.has(id)) state.seen.set(id, nowS);
    }
  }
  for (const id of [...state.seen.keys()]) if (!present.has(id)) state.seen.delete(id);
  for (const id of [...state.baseline]) if (!present.has(id)) state.baseline.delete(id);
  return state;
}

/* One /get_transaction_pool entry → one API row. Pure, exported for
   api/_tests/verify-tx-parse.mjs. `tiers` is the node's get_fee_estimate
   array (or null); `firstSeenHere` is this instance's own sighting (or null). */
function poolTxRow(t, tiers, firstSeenHere) {
  const rate = t.blob_size > 0 ? t.fee / t.blob_size : 0;
  let txJson = {};
  try { txJson = typeof t.tx_json === 'string' ? JSON.parse(t.tx_json || '{}') : (t.tx_json || {}); } catch (_) { txJson = {}; }
  const vin = Array.isArray(txJson.vin) ? txJson.vin : [];
  const vout = Array.isArray(txJson.vout) ? txJson.vout : [];
  /* ring_size is the RING LENGTH — vin[0].key.key_offsets.length, exactly what
     parseTransaction reads for /api/xmr/tx. Until p4·M9a it was `vin.length`,
     the INPUT COUNT, so a one-input tx reported ring_size 1 on a chain whose
     rings have been 16 by consensus since v15 — for every row, by
     construction. The 16 fallback is that consensus rule, not a guess. */
  const ring = Array.isArray(vin[0]?.key?.key_offsets) ? vin[0].key.key_offsets.length : 16;
  return {
    txid: t.id_hash,
    blob_size: t.blob_size,
    fee: t.fee,
    fee_rate: rate,
    /* As the node reported it. 0 means it reported NOTHING (map.ts treats any
       value before the chain's genesis as an absence) — passed through raw so
       a reader of the JSON sees what the upstream said. */
    receive_time: t.receive_time,
    first_seen_here: firstSeenHere ?? null,
    relayed: t.relayed,
    double_spend_seen: t.double_spend_seen,
    do_not_relay: t.do_not_relay,
    kept_by_block: t.kept_by_block,
    ring_size: ring,
    rct_type: txJson.rct_signatures?.type || 6,
    has_view_tags: !!(vout[0]?.target?.tagged_key),
    unlock_time: txJson.unlock_time || 0,
    output_count: vout.length || 2,
    input_count: vin.length || 1,
    fee_tier: feeTier(rate, tiers),
  };
}

/* ── Edge caching ──────────────────────────────────────────────────────────

   The single most important cost control in this file. The client polls in three
   tiers (fast 3s / chain 15s / market 60s); WITHOUT edge caching that is
   3s × N visitors of upstream node load and Vercel invocations. WITH it, the CDN
   collapses all concurrent visitors into ~1 upstream request per s-maxage window,
   so upstream sees a flat ~1 request per tier interval regardless of traffic.

   Each value is matched to how fast the underlying data can actually change:
   mempool moves every few seconds; the block target is 120s; range queries and
   pool attribution are minutes-stale by nature and cost 100+ RPC calls.

   Routes absent from this table keep the handler's default `no-store` — that is
   deliberate for per-user/one-shot lookups (block/*, decoys/*, health, stale).

   vercel.json declares no `Cache-Control` header rule for any `/api/*` path, so
   these are not overridden. */
const CACHE_CONTROL = {
  '':                    's-maxage=3, stale-while-revalidate=10',   // fast tier
  'mempool':             's-maxage=3, stale-while-revalidate=10',   // fast tier
  'mempool/recent':      's-maxage=3, stale-while-revalidate=10',
  'mempool/projected':   's-maxage=3, stale-while-revalidate=10',
  'fees':                's-maxage=3, stale-while-revalidate=10',   // fast tier
  'mempool/fees':        's-maxage=3, stale-while-revalidate=10',
  'tip':                 's-maxage=10, stale-while-revalidate=30',  // chain tier watch
  'blocks/tip':          's-maxage=10, stale-while-revalidate=30',
  'network':             's-maxage=15, stale-while-revalidate=30',  // chain tier
  'blocks':              's-maxage=15, stale-while-revalidate=30',  // chain tier
  'block_intervals':     's-maxage=60, stale-while-revalidate=120',
  'network/hashrate':    's-maxage=300, stale-while-revalidate=600',
  'network/difficulty':  's-maxage=300, stale-while-revalidate=600',
  'emission':            's-maxage=300, stale-while-revalidate=600',
  'mining/pools':        's-maxage=300, stale-while-revalidate=600', // ~100 RPC calls
  'mining/pools/live':   's-maxage=300, stale-while-revalidate=600',
};

/* D6 (S1-CONTRACT.md): a degraded (ok:false) history response must never
   inherit the long 300s TTL above — the same failure mode api/markets.js's
   DEGRADED_S_MAXAGE guards against, where one transient upstream error got
   cached as "no data" for the full window (see that file's header comment).
   Short enough that an outage self-heals in well under a minute; long enough
   that a burst of concurrent visitors during the outage still collapses to
   ~1 origin request rather than stampeding it. Successful history responses
   deliberately KEEP the long TTL — see the "history is immutable" note at
   handleHashrate/handleDifficulty — so this constant exists only for the
   failure path. */
const DEGRADED_HISTORY_S_MAXAGE = 30;

/** Cache-Control for a resolved sub-path, or null to keep the default no-store.
 *  `data` is the response body about to be sent. A per-PATH table alone
 *  (CACHE_CONTROL above) cannot express "this specific response is
 *  degraded" — only the payload itself carries that (D6) — so the two
 *  history routes get a per-RESPONSE override ahead of the table lookup
 *  whenever their own envelope reports ok:false. */
function cacheControlFor(sub, data) {
  if ((sub === 'network/hashrate' || sub === 'network/difficulty') && data && data.ok === false) {
    return `s-maxage=${DEGRADED_HISTORY_S_MAXAGE}, stale-while-revalidate=${DEGRADED_HISTORY_S_MAXAGE}`;
  }
  if (Object.prototype.hasOwnProperty.call(CACHE_CONTROL, sub)) return CACHE_CONTROL[sub];
  if (sub.startsWith('tx/')) return 's-maxage=5, stale-while-revalidate=15';
  return null;
}

// ── Route handlers ────────────────────────────────────────────────────────

async function handleMempool() {
  const [info, pool, stats, feeEst] = await Promise.all([
    rpc('get_info'),
    rpcHttp('/get_transaction_pool'),
    rpcHttp('/get_transaction_pool_stats'),
    rpc('get_fee_estimate'),   // p4·M9a: the tier vocabulary is the node's, fetched beside the pool it classifies
  ]);

  const poolStats = stats?.pool_stats || {};
  const tiers = Array.isArray(feeEst?.fees) && feeEst.fees.length === 4 ? feeEst.fees : null;
  const nowS = Math.floor(Date.now() / 1000);
  const rawTxs = Array.isArray(pool?.transactions) ? pool.transactions : null;
  if (rawTxs) noteFirstSightings(FIRST_SEEN, rawTxs.map(t => t.id_hash), nowS);   // never from a failed poll
  const txs = (rawTxs || []).map(t => poolTxRow(t, tiers, FIRST_SEEN.seen.get(t.id_hash) ?? null));

  // Fee histogram — one bucket per NODE tier, or null when the node gave no
  // tiers (a histogram over a vocabulary nobody published is a fabrication).
  const buckets = { slow:[], normal:[], fast:[], fastest:[] };
  let untiered = 0;
  txs.forEach(t => { if (t.fee_tier) buckets[t.fee_tier].push(t); else untiered++; });
  const feeHistogram = tiers ? FEE_TIER_LABELS.map((key, k) => ({
    fee_rate_min: k === 0 ? 0 : tiers[k],
    fee_rate_max: k === 3 ? null : tiers[k + 1],
    tx_count: buckets[key].length,
    bytes: buckets[key].reduce((s,t) => s + t.blob_size, 0),
    label: key.toUpperCase(),
    color: FEE_TIER_COLORS[key],
  })) : null;

  // Projected block. `reportedLimit` is null when the node didn't tell us the
  // dynamic block weight limit; the packing loop still needs a bound, so it uses
  // the 600 KB protocol floor, but we never PUBLISH that floor as if the node had
  // reported it — bytes_limit / fill_pct go null instead.
  const reportedLimit = info?.block_weight_limit ?? null;
  const blockLimit = reportedLimit || 600000;
  const sorted = [...txs].sort((a,b) => b.fee_rate - a.fee_rate);
  const inBlock = []; let projBytes = 0;
  const tierBytes = { slow:0, normal:0, fast:0, fastest:0 };
  for (const t of sorted) {
    if (projBytes + t.blob_size > blockLimit) break;
    inBlock.push(t);
    projBytes += t.blob_size;
    if (t.fee_tier) tierBytes[t.fee_tier] += t.blob_size;
  }
  const projFees = inBlock.reduce((s,t) => s + t.fee, 0);
  const rates = inBlock.map(t => t.fee_rate).sort((a,b) => a-b);
  const medRate = rates[Math.floor(rates.length/2)] || 0;

  const projectedBlock = {
    tx_count: inBlock.length,
    bytes: projBytes,
    bytes_limit: reportedLimit,
    fill_pct: reportedLimit ? Math.round((projBytes/reportedLimit)*100) : null,
    total_fees: projFees,
    median_fee_rate: medRate,
    fee_tiers: tiers ? tierBytes : null,
  };

  const allRates = txs.map(t => t.fee_rate).sort((a,b) => a-b);
  const medianFeeRate = allRates[Math.floor(allRates.length/2)] || 0;
  const p98FeeRate = allRates[Math.floor(allRates.length*0.98)] || 0;

  return {
    tx_count: txs.length,
    bytes_total: poolStats.bytes_total || txs.reduce((s,t) => s+t.blob_size, 0),
    fees_total: poolStats.fee_total || txs.reduce((s,t) => s+t.fee, 0),
    fee_histogram: feeHistogram,
    /* the node's own tier floors, pcn/B, slow → fastest — the vocabulary every
       `fee_tier` above and every bucket in `fee_histogram` is keyed on */
    fee_tiers: tiers,
    /* txs no tier could classify because the node gave no estimate */
    untiered_tx_count: untiered,
    recent_txs: txs.slice(0,100),
    projected_block: projectedBlock,
    median_fee_rate: medianFeeRate,
    p98_fee_rate: p98FeeRate,
    /* the node's aggregate, from /get_transaction_pool_stats: null, never 0,
       when it did not report one — 0 would read as "the oldest tx is brand new" */
    oldest_tx_age_seconds: poolStats.oldest ? nowS - poolStats.oldest : null,
    /* when this instance began watching the pool (unix s); a row whose
       first_seen_here is null was already present then, or the poll that would
       have stamped it has not happened */
    first_seen_since: FIRST_SEEN.since,
  };
}

async function handleFees() {
  const feeEst = await rpc('get_fee_estimate');
  /* No invented tiers. The old `|| [20000, 80000, 320000, 4000000]` fallback
     published a plausible-looking fee table that no node had reported — the
     client would render fabricated numbers as live node data. Omit instead: the
     client's mappers carry the last-good value forward (map.ts `num(v, prev.x)`)
     and render "—" when nothing has ever landed. */
  const fees = Array.isArray(feeEst?.fees) && feeEst.fees.length ? feeEst.fees : null;
  if (!fees) return { tiers: null, recommended: null, slow: null, normal: null, fast: null, fastest: null };
  return {
    tiers: fees,
    recommended: fees[1] ?? null,
    slow: fees[0] ?? null, normal: fees[1] ?? null, fast: fees[2] ?? null, fastest: fees[3] ?? null,
  };
}

/* Retry an RPC call up to N times when it returns null/throws.
   The cascade itself handles upstream node failover; this layer
   handles transient network errors and brief node desyncs. */
async function rpcRetry(method, params, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      const result = await rpc(method, params);
      if (result != null) return result;
    } catch (err) {
      if (i === attempts - 1) throw err;
    }
    /* Backoff between attempts: 100ms, 300ms, 600ms */
    await new Promise(r => setTimeout(r, 100 * (1 + i * 2)));
  }
  return null;
}

async function handleBlocks(limit) {
  const want = Math.max(1, Math.min(100, parseInt(limit, 10) || 22));
  const info = await rpcRetry('get_info');
  if (!info?.height) return [];
  const tip = info.height - 1;
  const range = await rpcRetry('get_block_headers_range',
    { start_height: Math.max(0, tip - want + 1), end_height: tip });
  let headers = (range?.headers || []).slice();
  // dedupe by height + newest-first
  const seen = new Set(); const unique = [];
  for (const bh of headers) { if (!seen.has(bh.height)) { seen.add(bh.height); unique.push(bh); } }
  unique.sort((a, b) => b.height - a.height);
  return unique.map(bh => ({
    height: bh.height, hash: bh.hash, prev_hash: bh.prev_hash,
    timestamp: bh.timestamp, reward: bh.reward, difficulty: bh.difficulty,
    block_weight: bh.block_weight || bh.block_size,
    tx_count: bh.num_txes, pool_name: 'Unknown', pool_type: 'solo',
    orphan: bh.orphan_status || false,
  }));
}

async function handleBlockDetail(hashOrHeight) {
  let res;
  if (/^\d+$/.test(hashOrHeight)) {
    res = await rpc('get_block', { height: parseInt(hashOrHeight) });
  } else {
    res = await rpc('get_block', { hash: hashOrHeight });
  }
  if (!res?.block_header) return null;
  const bh = res.block_header;
  // Try to identify pool from miner_tx.extra
  let pool = { name: 'Unknown', type: 'solo', url: null };
  try {
    const minerTxJson = typeof res.json === 'string' ? JSON.parse(res.json) : {};
    const extra = minerTxJson.miner_tx?.extra;
    if (extra) pool = identifyPool(Buffer.from(extra).toString('hex'));
  } catch (_) {}
  return {
    height: bh.height, hash: bh.hash, prev_hash: bh.prev_hash,
    timestamp: bh.timestamp, reward: bh.reward, difficulty: bh.difficulty,
    block_weight: bh.block_weight || bh.block_size,
    block_weight_limit: 600000, long_term_weight: bh.long_term_weight || 0,
    tx_count: bh.num_txes, nonce: bh.nonce,
    major_version: bh.major_version, minor_version: bh.minor_version,
    miner_tx_hash: bh.miner_tx_hash, pool_name: pool.name,
    pool_type: pool.type, orphan: bh.orphan_status || false,
    tx_hashes: res.tx_hashes || [],
  };
}

/* Compute the real tx size in bytes from a monerod get_transactions entry.
   monerod does NOT return a per-tx `block_size`, so we derive size from the
   hex blob. Returns null when no blob is available — NEVER the old 1847
   fallback constant (which silently corrupted fee_rate). */
function txSizeFromEntry(raw) {
  if (raw && typeof raw.as_hex === 'string' && raw.as_hex.length) return Math.floor(raw.as_hex.length / 2);
  const p = ((raw && raw.pruned_as_hex) || '').length + ((raw && raw.prunable_as_hex) || '').length;
  return p ? Math.floor(p / 2) : null;   // null => "unavailable", NEVER 1847
}

/* Pure parser for a single monerod get_transactions tx entry → API shape.
   Extracted from handleTx so it can be unit-tested without network access. */
function parseTransaction(raw, txid) {
  const txJson = typeof raw.as_json === 'string' ? JSON.parse(raw.as_json) : (raw.as_json || {});
  const sizeBytes = txSizeFromEntry(raw);

  const inputs = (txJson.vin || []).map(v => ({
    key_image: v.key?.k_image || '',
    ring_member_count: Array.isArray(v.key?.key_offsets) ? v.key.key_offsets.length : 16,
    key_offsets: v.key?.key_offsets || [],
  }));
  const outputs = (txJson.vout || []).map(v => ({
    stealth_key: v.target?.tagged_key?.key || v.target?.key || '',
    view_tag: v.target?.tagged_key?.view_tag || '',
  }));

  const isConfirmed = !raw.in_pool && (raw.block_height != null);

  return {
    txid,
    status: isConfirmed ? 'confirmed' : 'mempool',

    /* Frontend reads `tx.confirmed`. Provide it as a real boolean. */
    confirmed: isConfirmed,
    in_pool: !!raw.in_pool,

    block_height: raw.block_height != null ? raw.block_height : null,
    block_hash: raw.block_hash || null,
    block_timestamp: raw.block_timestamp != null ? raw.block_timestamp : null,
    confirmations: typeof raw.confirmations === 'number' ? raw.confirmations : 0,

    /* monerod returns `received_timestamp` (with the `d`), not `receive_time`. */
    receive_time: raw.received_timestamp != null ? raw.received_timestamp : null,

    blob_size: sizeBytes,
    fee: txJson.rct_signatures?.txnFee || 0,
    fee_rate: sizeBytes ? (txJson.rct_signatures?.txnFee || 0) / sizeBytes : null,
    ring_size: inputs[0]?.ring_member_count || 16,
    rct_type: txJson.rct_signatures?.type || 6,
    has_view_tags: !!(txJson.vout?.[0]?.target?.tagged_key),
    unlock_time: txJson.unlock_time || 0,
    output_count: outputs.length,
    input_count: inputs.length,
    version: txJson.version || 2,
    inputs, outputs,
    extra_hex: Array.isArray(txJson.extra)
      ? Buffer.from(txJson.extra).toString('hex')
      : (txJson.extra || ''),
  };
}

async function handleTx(txid) {
  const res = await (async () => {
    const deadline = Date.now() + CASCADE_BUDGET_MS;
    for (const node of nodes()) {
      if (Date.now() >= deadline) break;
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), Math.min(6000, deadline - Date.now()));
        const r = await fetch(`${node}/get_transactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ txs_hashes: [txid], decode_as_json: true }),
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (!r.ok) { markNodeDown(node); continue; }
        /* Answered ⇒ healthy. An empty list just means this node doesn't have
           the tx (unindexed / already mined out of its pool), not a fault. */
        markNodeUp(node);
        const data = await r.json();
        const list = data?.txs || data?.txs_as_json || [];
        if (list.length > 0) return data;
      } catch (_) { markNodeDown(node); }
    }
    return null;
  })();

  const txList = res?.txs || res?.txs_as_json || [];
  if (!txList.length) return null;
  return parseTransaction(txList[0], txid);
}

async function handleNetwork() {
  const [info, feeEst, minerData, hardFork] = await Promise.all([
    rpc('get_info'),
    rpc('get_fee_estimate'),
    rpc('get_miner_data'),
    rpc('hard_fork_info'),
  ]);
  if (!info) return null;
  return {
    height: info.height,
    difficulty: info.difficulty,
    hashrate_ghs: Math.round(info.difficulty / 120 / 1e9 * 100) / 100,
    tx_pool_size: info.tx_pool_size,
    tx_count_total: info.tx_count,
    /* Everything below reports null rather than a plausible default when the
       node didn't supply it. A hard-coded stand-in reaches the UI indistinguishable
       from live node data, which breaks the site's core invariant ("never show a
       number that didn't come from the node"). The client carries last-good values
       forward (map.ts `num(v, prev.x)`) and renders "—" until something real lands. */
    block_weight_limit: info.block_weight_limit ?? null,
    block_weight_median: info.block_weight_median ?? null,
    /* 120s is the protocol's block target, not a stand-in for missing data. */
    target_seconds: info.target || 120,
    top_block_hash: info.top_block_hash || '',
    alt_blocks_count: info.alt_blocks_count ?? null,
    version: info.version ?? null,
    // hard_fork_info is the authoritative source. When every node's call fails we
    // report null — claiming "v16" would be inventing chain state.
    major_version: hardFork?.version ?? null,
    fee_tiers: Array.isArray(feeEst?.fees) && feeEst.fees.length ? feeEst.fees : null,
    randomx_seed_hash: minerData?.seed_hash || '',
    database_size: info.database_size ?? null,
    synchronized: !!info.synchronized,
    // Never assume 'mainnet' — which network a node serves is reported, not guessed.
    nettype: info.nettype ?? null,
    adjusted_time: info.adjusted_time ?? null,
  };
}

/* ── Network history (hashrate / difficulty) ──────────────────────────────

   D1-D7 below are the decisions in S1-CONTRACT.md (p3·14b). Both
   /network/hashrate and /network/difficulty used to carry their own
   copy-pasted range table and downsampler; the drift between those two
   copies is exactly what let a table entry silently exceed monerod's
   restricted-RPC span cap and return `[]` for three of the four documented
   range keys on every public node this site uses (measured and quoted in
   S1-CONTRACT.md). One table, one sampler, one envelope builder now serve
   both endpoints — each handler keeps only its own point mapping
   (difficulty vs hashrate_ghs) at its own call site. */

/* D2: monerod's restricted RPC rejects get_block_headers_range with "Too
   many block headers requested." once (end_height - start_height) exceeds
   this — RESTRICTED_BLOCK_HEADER_RANGE in monerod's
   src/rpc/core_rpc_server_commands_defs.h. Every node in this site's
   cascade is a public restricted node, so this is a hard protocol ceiling,
   not a tuning knob. */
const RESTRICTED_HEADER_SPAN = 1000;

/* D2: block counts, one RPC round trip each. `blocks × target_seconds` is
   the window a range key denotes (see buildHistoryEnvelope below) — every
   entry here satisfies `blocks - 1 <= RESTRICTED_HEADER_SPAN` (asserted
   per-entry by api/verify-history.mjs so a future key can't silently
   reintroduce the defect) and is also clamped defensively at runtime in
   resolveHistoryRange. Paging for deeper windows (a 7-day seed needs 6
   calls) is deliberately not done: every range downsamples to ~200 points
   regardless, so more blocks per range buys coarser resolution for the same
   pixel budget, not more information. */
const HISTORY_RANGES = { '1h': 30, '6h': 180, '12h': 360, '1d': 720 };
const HISTORY_DEFAULT = '1d';

/* D3: resolve a requested range key against HISTORY_RANGES. Pure — no
   network, never throws. api/ and app/ cannot share a module (CommonJS vs
   the Vite graph), so their two range tables can drift; an unknown/missing
   key degrades to HISTORY_DEFAULT rather than 400ing, so drift blanks
   nothing. The envelope's `requested` vs `range` fields (D4) let the client
   see that a substitution happened instead of hiding it. */
function resolveHistoryRange(requestedRange) {
  const requested = requestedRange == null ? null : String(requestedRange);
  const range = Object.prototype.hasOwnProperty.call(HISTORY_RANGES, requested) ? requested : HISTORY_DEFAULT;
  const blocks = Math.min(HISTORY_RANGES[range], RESTRICTED_HEADER_SPAN + 1);
  return { requested, range, blocks };
}

/* D5: downsample ascending-by-height headers to ~200 points, anchoring the
   stride at the NEWEST header so the tip always survives sampling. The old
   `i % step === 0` filter anchored at index 0 instead, so the newest header
   survived only when `(len-1) % step === 0` — at 504 headers / step 2 that
   silently drops the tip, opening a gap between a streaming line's seed and
   its live tail. `(len-1-i) % step === 0` always keeps i = len-1, whatever
   step is. Pure — no network. */
function sampleHeaders(headers) {
  const len = headers.length;
  if (!len) return { points: [], step: 1, tip: null };
  const step = Math.max(1, Math.floor(len / 200));
  const points = headers.filter((_, i) => (len - 1 - i) % step === 0);
  return { points, step, tip: points[points.length - 1].height };
}

/* Shared network fetch (D1): resolves the range, pulls get_info once for
   the tip height and the node's own block target, then one
   get_block_headers_range call for the span. `rpcImpl` defaults to the
   module's real rpc() and exists only so tests can inject a fixture without
   touching the network — every production call site below relies on the
   default and never passes it. */
async function historyHeaders(requestedRange, rpcImpl = rpc) {
  const { requested, range, blocks } = resolveHistoryRange(requestedRange);
  const info = await rpcImpl('get_info');
  /* target_seconds is NODE-REPORTED, never a literal (D7) — `info.target`
     is the same field handleNetwork and the `tip` handler above already
     read. A node that doesn't report it yields null, never a fabricated
     120. */
  const target_seconds = typeof info?.target === 'number' && info.target > 0 ? info.target : null;
  if (!info?.height) {
    return { ok: false, requested, range, blocks, points: [], step: null, tip: null, target_seconds };
  }
  const now = info.height;
  const start = Math.max(0, now - blocks);
  const res = await rpcImpl('get_block_headers_range', { start_height: start, end_height: now - 1 });
  const headers = (res?.headers || []).slice().sort((a, b) => a.height - b.height);
  if (!headers.length) {
    return { ok: false, requested, range, blocks, points: [], step: null, tip: null, target_seconds };
  }
  const { points, step, tip } = sampleHeaders(headers);
  return { ok: true, requested, range, blocks, points, step, tip, target_seconds };
}

/* D4: envelope shape shared by both endpoints. `mapPoint` is the one thing
   that differs per endpoint (difficulty vs hashrate_ghs — kept at each
   handler's own call site, not here). window_seconds is
   `blocks × target_seconds` (null when the node didn't report a target) —
   the ONLY legitimate source of a band's window label, so a client never
   has to re-derive it from a range key and risk drifting from this table. */
function buildHistoryEnvelope(h, mapPoint) {
  return {
    ok: h.ok,
    requested: h.requested,
    range: h.range,
    blocks: h.blocks,
    returned: h.points.length,
    step: h.step,
    tip: h.tip,
    target_seconds: h.target_seconds,
    window_seconds: h.target_seconds != null ? h.blocks * h.target_seconds : null,
    points: h.points.map(mapPoint),
  };
}

async function handleHashrate(range, rpcImpl = rpc) {
  const h = await historyHeaders(range, rpcImpl);
  /* D7: full precision, never rounded, never divided by a hard-coded 120.
     Difficulty moves in integer units and one unit is
     1/target_seconds/1e9 GH/s, so any fixed decimal quantises a signal a
     streaming line exists to show. Null (never a guess) when the node
     didn't report its own target. */
  return buildHistoryEnvelope(h, p => ({
    height: p.height,
    timestamp: p.timestamp,
    hashrate_ghs: h.target_seconds != null ? p.difficulty / h.target_seconds / 1e9 : null,
  }));
}

async function handleDifficulty(range, rpcImpl = rpc) {
  const h = await historyHeaders(range, rpcImpl);
  return buildHistoryEnvelope(h, p => ({
    height: p.height,
    timestamp: p.timestamp,
    difficulty: p.difficulty,
  }));
}

async function handlePools() {
  const info = await rpc('get_info');
  if (!info) return { period_blocks: 0, pools: [] };
  const now = info.height;
  const start = Math.max(0, now - 1000);
  const res = await rpc('get_block_headers_range', { start_height: start, end_height: now - 1 });
  const headers = res?.headers || [];

  // For each block, we'd need to call get_block to read miner_tx.extra
  // That's 1000 calls — too slow. Sample 100 blocks instead.
  const sample = headers.filter((_,i) => i % 10 === 0);
  const poolCounts = {};
  await Promise.all(sample.map(async h => {
    const b = await rpc('get_block', { height: h.height });
    if (!b) return;
    let extra = '';
    try {
      const bj = typeof b.json === 'string' ? JSON.parse(b.json) : {};
      extra = Array.isArray(bj.miner_tx?.extra)
        ? Buffer.from(bj.miner_tx.extra).toString('hex')
        : '';
    } catch (_) {}
    const pool = identifyPool(extra);
    poolCounts[pool.name] = poolCounts[pool.name] || { ...pool, block_count: 0, last_block_height: 0 };
    poolCounts[pool.name].block_count += 10; // each sample represents ~10 blocks
    if (h.height > poolCounts[pool.name].last_block_height) {
      poolCounts[pool.name].last_block_height = h.height;
    }
  }));

  const total = Object.values(poolCounts).reduce((s,p) => s + p.block_count, 0) || 1;
  const pools = Object.values(poolCounts)
    .sort((a,b) => b.block_count - a.block_count)
    .map(p => ({ ...p, percentage: Math.round((p.block_count/total)*1000)/10 }));

  return { period_blocks: headers.length, pools };
}

function handleEmission(currentHeight) {
  // Pre-computed emission curve + live height annotation
  const TAIL_START = 2641623;
  const curve = [
    { height: 0,       supply: 0 },
    { height: 400000,  supply: 2800000 },
    { height: 800000,  supply: 5000000 },
    { height: 1200000, supply: 7000000 },
    { height: 1600000, supply: 8700000 },
    { height: 2000000, supply: 10200000 },
    { height: 2400000, supply: 11600000 },
    { height: TAIL_START, supply: 18132000 },
    { height: currentHeight, supply: 18132000 + (currentHeight - TAIL_START) * 0.6 },
    { height: 4000000, supply: 19344000 },
    { height: 5000000, supply: 21744000 },
    { height: 6000000, supply: 24144000 },
  ].filter(p => p.height <= 6000000);

  const currentSupply = 18132000 + Math.max(0, currentHeight - TAIL_START) * 0.6;

  return {
    current_height: currentHeight,
    current_supply_xmr: Math.round(currentSupply * 100) / 100,
    tail_emission_started_height: TAIL_START,
    tail_emission_started_date: '2022-05-15',
    block_reward_current: 0.6,
    daily_emission_xmr: 432,
    annual_inflation_pct: parseFloat((432 * 365 / currentSupply * 100).toFixed(2)),
    curve_points: curve,
  };
}

async function handleStale() {
  const res = await rpc('get_alternate_chains');
  return { chains: res?.chains || [] };
}

// ── Main handler ──────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET')     { res.status(405).json({ error: 'GET only' }); return; }

  // Parse sub-path — Vercel passes it as ?_p= from the rewrite rule,
  // with req.url as a safety fallback.
  const url = req.url || '';
  const urlSub = url.replace(/^\/api\/xmr\/?/, '').replace(/\?.*$/, '').replace(/^\//, '');
  const sub = (req.query && req.query._p
    ? (Array.isArray(req.query._p) ? req.query._p.join('/') : String(req.query._p))
    : urlSub).replace(/^\//, '');
  const qs = req.query || {};

  try {
    let data;

    if (sub === '' || sub === 'mempool') {
      data = await handleMempool();

    } else if (sub === 'mempool/fees' || sub === 'fees') {
      data = await handleFees();

    } else if (sub === 'mempool/recent') {
      const m = await handleMempool();
      data = m.recent_txs;

    } else if (sub === 'mempool/projected') {
      const m = await handleMempool();
      data = m.projected_block;

    } else if (sub === 'blocks') {
      data = await handleBlocks(qs.limit);

    } else if (sub === 'blocks/tip') {
      const info = await rpc('get_info');
      data = info ? { height: info.height, hash: info.top_block_hash } : {};

    } else if (sub === 'tip') {
      /* Lightweight tip-watch endpoint. One RPC call vs handleBlocks's 22+.
         Frontend polls this every 15s; only triggers a full blocks fetch
         when the observed tip advances. */
      const info = await rpcRetry('get_info');
      data = {
        height: info?.height ? info.height - 1 : 0,   /* tip = info.height - 1 */
        target: info?.target || 120,
        difficulty: info?.difficulty || 0,
      };

    } else if (sub === 'block_intervals') {
      /* Average block interval over the last 100 blocks. Used by the explorer
         to compute "until next confirmation" ETAs with low variance — n=10
         (parade strip) is too noisy for a Poisson process. One get_block_headers_range
         RPC call returns all 100 headers in a single round trip. Edge-cached
         for 60s — block intervals don't change fast enough to need fresher data. */
      const info = await rpcRetry('get_info');
      if (!info?.height) {
        res.status(503).json({ error: 'no info' });
        return;
      }
      const tip = info.height - 1;
      const N = 100;
      const range = await rpcRetry('get_block_headers_range', {
        start_height: Math.max(0, tip - N),
        end_height: tip,
      });
      const headers = range?.headers || [];
      if (headers.length < 2) {
        res.status(503).json({ error: 'too few blocks' });
        return;
      }
      headers.sort((a, b) => b.height - a.height);
      const deltas = [];
      for (let i = 0; i < headers.length - 1; i++) {
        const d = Number(headers[i].timestamp) - Number(headers[i + 1].timestamp);
        if (d > 5 && d < 1800) deltas.push(d);
      }
      if (!deltas.length) {
        res.status(503).json({ error: 'no valid deltas' });
        return;
      }
      const avg = Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length);
      /* Cache-Control comes from the CACHE_CONTROL table at the bottom of the
         handler — one place, so cadence and cache window can't drift apart. */
      data = {
        avg_block_interval_s: avg,
        sample_size: deltas.length,
        tip_height: tip,
        tip_timestamp: Number(headers[0].timestamp),
      };

    } else if (sub.startsWith('block/')) {
      const rest = sub.slice(6);  // everything after 'block/'
      if (rest.endsWith('/txs')) {
        // Paginated tx list for a block: /block/HASH/txs?page=0&limit=25
        const ref = rest.slice(0, -4);
        const page  = Math.max(0, parseInt(qs.page  || '0', 10));
        const limit = Math.max(1, Math.min(100, parseInt(qs.limit || '25', 10)));
        const block = await handleBlockDetail(ref);
        if (!block) { res.status(404).json({ error: 'Block not found' }); return; }
        const allTxs   = block.tx_hashes || [];
        const total    = allTxs.length;
        const pageSlice = allTxs.slice(page * limit, page * limit + limit);
        data = { tx_hashes: pageSlice, total, page, limit,
                 block_height: block.height, block_hash: block.hash,
                 miner_tx_hash: page === 0 ? block.miner_tx_hash : null };
      } else {
        // Block detail: /block/HASH  or  /block/HEIGHT
        data = await handleBlockDetail(rest);
        if (!data) { res.status(404).json({ error: 'Block not found' }); return; }
      }

    } else if (sub.startsWith('tx/')) {
      const txid = sub.slice(3);
      if (!/^[0-9a-f]{64}$/i.test(txid)) {
        res.status(400).json({ error: 'Invalid txid' }); return;
      }
      data = await handleTx(txid);
      if (!data) { res.status(404).json({ error: 'Transaction not found' }); return; }

    } else if (sub.startsWith('decoys/')) {
      /* Real decoy age analysis. Fetches the tx to read its ring members'
         key_offsets, converts relative offsets to absolute output indices,
         then issues a single batched /get_outs HTTP RPC to resolve all ring
         members across all inputs. ~200-500ms per call.

         Note: /get_outs uses amount=0 for RingCT outputs (post-HF13 — every
         modern Monero tx). Pre-RingCT outputs are not currently surfaced here. */
      const decTxid = sub.slice('decoys/'.length);
      if (!/^[0-9a-f]{64}$/i.test(decTxid)) {
        res.status(400).json({ error: 'invalid txid' }); return;
      }

      const txData = await (async () => {
        const deadline = Date.now() + CASCADE_BUDGET_MS;
        for (const node of nodes()) {
          if (Date.now() >= deadline) break;
          try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), Math.min(6000, deadline - Date.now()));
            const r = await fetch(`${node}/get_transactions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ txs_hashes: [decTxid], decode_as_json: true }),
              signal: ctrl.signal,
            });
            clearTimeout(timer);
            if (!r.ok) { markNodeDown(node); continue; }
            markNodeUp(node);
            const j = await r.json();
            if (j?.txs?.length || j?.txs_as_json?.length) return j;
          } catch (_) { markNodeDown(node); }
        }
        return null;
      })();

      const decTx = txData?.txs?.[0] || null;
      if (!decTx) { res.status(404).json({ error: 'tx not found' }); return; }
      let decJson;
      try { decJson = typeof decTx.as_json === 'string' ? JSON.parse(decTx.as_json) : decTx.as_json; }
      catch { res.status(500).json({ error: 'tx json parse failed' }); return; }

      const decInputs = (decJson?.vin || []).filter(v => v.key);
      if (!decInputs.length) {
        data = { txid: decTxid, tip_height: null, inputs: [] };
      } else {
        const allOutputs = [];
        for (let i = 0; i < decInputs.length; i++) {
          const offs = decInputs[i].key.key_offsets || [];
          let cum = 0;
          for (let j = 0; j < offs.length; j++) {
            cum += Number(offs[j]);
            allOutputs.push({ inputIdx: i, ringIdx: j, abs_idx: cum });
          }
        }

        const outsRes = await rpcHttp('/get_outs', {
          outputs: allOutputs.map(o => ({ amount: 0, index: o.abs_idx })),
          get_txid: false,
        });
        const outs = outsRes?.outs || [];

        const tipInfo = await rpcRetry('get_info');
        const tipHeight = tipInfo?.height ? tipInfo.height - 1 : null;

        const inputsResult = decInputs.map((_, i) => ({ inputIdx: i, ring: [] }));
        for (let k = 0; k < allOutputs.length; k++) {
          const meta = allOutputs[k];
          const out = outs[k] || {};
          inputsResult[meta.inputIdx].ring.push({
            ringIdx: meta.ringIdx,
            block_height: out.height != null ? Number(out.height) : null,
            age_blocks: tipHeight != null && out.height != null ? tipHeight - Number(out.height) : null,
            unlocked: !!out.unlocked,
          });
        }

        data = { txid: decTxid, tip_height: tipHeight, inputs: inputsResult };
      }

    } else if (sub === 'network') {
      data = await handleNetwork();
      if (!data) { res.status(503).json({ error: 'Node unavailable' }); return; }

    } else if (sub === 'network/hashrate') {
      data = await handleHashrate(qs.range);

    } else if (sub === 'network/difficulty') {
      data = await handleDifficulty(qs.range);

    } else if (sub === 'mining/pools') {
      data = await handlePools();

    } else if (sub === 'mining/pools/live') {
      // Fetch live pool stats from public pool APIs in parallel
      const [p2poolData, moData] = await Promise.allSettled([
        fetch('https://p2pool.io/api/stats', {
          headers: { 'accept': 'application/json' },
          signal: AbortSignal.timeout(8000)
        }).then(r => r.ok ? r.json() : null),
        fetch('https://moneroocean.stream/api/pool/stats', {
          headers: { 'accept': 'application/json' },
          signal: AbortSignal.timeout(8000)
        }).then(r => r.ok ? r.json() : null),
      ]);

      const p2 = p2poolData.status === 'fulfilled' ? p2poolData.value : null;
      const mo = moData.status === 'fulfilled' ? moData.value : null;

      const networkInfo = await rpc('get_info');
      const networkHashrate = networkInfo
        ? networkInfo.difficulty / 120
        : 5000000000;

      const pools = [
        {
          name: 'P2Pool',
          type: 'decentralized',
          url: 'https://p2pool.io',
          fee_pct: 0,
          min_payout: 0.0003,
          method: 'Local PPLNS',
          hashrate_hs: p2?.pool_statistics?.hashRate ?? null,
          miners: p2?.pool_statistics?.miners ?? null,
          blocks_found: p2?.pool_statistics?.totalBlocksFound ?? null,
          network_share_pct: p2?.pool_statistics?.hashRate
            ? parseFloat(((p2.pool_statistics.hashRate / networkHashrate) * 100).toFixed(2))
            : null,
          last_block_height: p2?.pool_statistics?.height ?? null,
          live: !!p2,
          note: 'No trusted operator · privacy-maximizing · requires full node'
        },
        {
          name: 'MoneroOcean',
          type: 'centralized',
          url: 'https://moneroocean.stream',
          fee_pct: 0,
          min_payout: 0.003,
          method: 'PPLNS',
          hashrate_hs: mo?.pool?.hashrate ?? null,
          miners: mo?.pool?.miners ?? null,
          blocks_found: mo?.pool?.totalBlocksFound ?? null,
          network_share_pct: mo?.pool?.hashrate
            ? parseFloat(((mo.pool.hashrate / networkHashrate) * 100).toFixed(2))
            : null,
          last_block_height: null,
          live: !!mo,
          note: 'Algo-switch supported · 0% fee'
        },
        {
          name: 'SupportXMR',
          type: 'centralized',
          url: 'https://supportxmr.com',
          fee_pct: 0.6,
          min_payout: 0.1,
          method: 'PPLNS',
          hashrate_hs: null,
          miners: null,
          network_share_pct: null,
          live: false,
          note: 'Strong reputation · longest-running'
        },
        {
          name: 'Nanopool',
          type: 'centralized',
          url: 'https://xmr.nanopool.org',
          fee_pct: 1.0,
          min_payout: 1.0,
          method: 'PPLNS',
          hashrate_hs: null,
          miners: null,
          network_share_pct: null,
          live: false,
          note: 'High minimum payout'
        },
        {
          name: 'HashVault',
          type: 'centralized',
          url: 'https://monero.hashvault.pro',
          fee_pct: 0.9,
          min_payout: 0.5,
          method: 'PPLNS',
          hashrate_hs: null,
          miners: null,
          network_share_pct: null,
          live: false,
          note: '—'
        },
        {
          name: 'C3Pool',
          type: 'centralized',
          url: 'https://c3pool.com',
          fee_pct: 0,
          min_payout: 0.003,
          method: 'PPLNS',
          hashrate_hs: null,
          miners: null,
          network_share_pct: null,
          live: false,
          note: '0% fee · smaller pool'
        }
      ];

      data = {
        network_hashrate_hs: networkHashrate,
        pools,
        timestamp: Date.now()
      };

    } else if (sub === 'emission') {
      const info = await rpc('get_info');
      /* The whole emission curve is annotated off the live height, so a fabricated
         height (the old `|| 3200000`) would produce a wrong-but-plausible supply
         figure. Fail loudly instead and let the client keep its last-good values. */
      if (!info?.height) { res.status(503).json({ error: 'Node unavailable' }); return; }
      data = handleEmission(info.height);

    } else if (sub === 'stale') {
      data = await handleStale();

    } else if (sub === 'health') {
      const info = await rpc('get_info');
      /* No `peers` field. Restricted public RPC reports every peer counter as 0,
         and publishing "0 peers" for a healthy network is worse than publishing
         nothing — see the paused peer panel on /network. Peer data returns only
         when an unrestricted primary node is configured (MONERO_PRIMARY_NODE). */
      data = { ok: !!info, height: info?.height ?? null };

    } else {
      res.status(404).json({ error: `Unknown endpoint: /api/xmr/${sub}` }); return;
    }

    const cc = cacheControlFor(sub, data);
    if (cc) res.setHeader('Cache-Control', cc);

    res.status(200).json(data);

  } catch (err) {
    console.error('[api/xmr] error:', err);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
};

module.exports.parseTransaction = parseTransaction;
module.exports.txSizeFromEntry = txSizeFromEntry;
/* p4·M9a — the pool row builder, the node-tier classifier and the sighting
   memory, exported for api/_tests/verify-tx-parse.mjs. `newFirstSeenState`
   gives the test its own memory rather than the module's. */
module.exports.poolTxRow = poolTxRow;
module.exports.feeTierIndex = feeTierIndex;
module.exports.FEE_TIER_LABELS = FEE_TIER_LABELS;
module.exports.noteFirstSightings = noteFirstSightings;
module.exports.newFirstSeenState = newFirstSeenState;

/* Exported for api/verify-history.mjs (S1-CONTRACT.md D1-D7). Pure helpers
   plus the two RPC-calling handlers, which accept an injectable rpcImpl so
   the offline gate can exercise them end-to-end without network egress. */
module.exports.historyHeaders = historyHeaders;
module.exports.resolveHistoryRange = resolveHistoryRange;
module.exports.sampleHeaders = sampleHeaders;
module.exports.buildHistoryEnvelope = buildHistoryEnvelope;
module.exports.handleHashrate = handleHashrate;
module.exports.handleDifficulty = handleDifficulty;
module.exports.cacheControlFor = cacheControlFor;
module.exports.HISTORY_RANGES = HISTORY_RANGES;
module.exports.HISTORY_DEFAULT = HISTORY_DEFAULT;
module.exports.RESTRICTED_HEADER_SPAN = RESTRICTED_HEADER_SPAN;
module.exports.DEGRADED_HISTORY_S_MAXAGE = DEGRADED_HISTORY_S_MAXAGE;
