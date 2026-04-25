/* ═══════════════════════════════════════════════════════════════
   api/xmr.js — Vercel serverless relay bridge
   Implements the full /api/xmr/* REST surface that xmr-relay-ws.js
   expects, calling monerod directly via the existing cascade pattern.
   This is the no-VPS fallback — all REST data works, WebSocket push
   requires relay.xmr.irish once it is deployed.
   ═══════════════════════════════════════════════════════════════ */

const NODES = [
  'http://node.moneroworld.com:18089',
  'http://nodes.hashvault.pro:18081',
  'http://node.community.rino.io:18081',
  'http://opennode.xmr-tw.org:18089',
];

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
  for (const node of NODES) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(`${node}/json_rpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const json = await res.json();
      if (json?.result) return json.result;
    } catch (_) { /* try next node */ }
  }
  return null;
}

async function rpcHttp(path, payload) {
  const body = payload != null ? JSON.stringify(payload) : '{}';
  for (const node of NODES) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(`${node}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      return await res.json();
    } catch (_) { /* try next */ }
  }
  return null;
}

function feeTier(rate) {
  if (rate <= 1)  return 'stuck';
  if (rate <= 5)  return 'economy';
  if (rate <= 20) return 'normal';
  if (rate <= 80) return 'fast';
  return 'priority';
}

function feeColor(rate) {
  const t = feeTier(rate);
  return { stuck: '#444444', economy: '#3D8EFF', normal: '#00C97A', fast: '#F26822', priority: '#FF4455' }[t];
}

// ── Route handlers ────────────────────────────────────────────────────────

async function handleMempool() {
  const [info, pool, stats] = await Promise.all([
    rpc('get_info'),
    rpcHttp('/get_transaction_pool'),
    rpcHttp('/get_transaction_pool_stats'),
  ]);

  const poolStats = stats?.pool_stats || {};
  const txs = (pool?.transactions || []).map(t => {
    const rate = t.blob_size > 0 ? t.fee / t.blob_size : 0;
    const txJson = typeof t.tx_json === 'string' ? JSON.parse(t.tx_json || '{}') : (t.tx_json || {});
    return {
      txid: t.id_hash,
      blob_size: t.blob_size,
      fee: t.fee,
      fee_rate: rate,
      receive_time: t.receive_time,
      relayed: t.relayed,
      double_spend_seen: t.double_spend_seen,
      do_not_relay: t.do_not_relay,
      kept_by_block: t.kept_by_block,
      ring_size: Array.isArray(txJson.vin) ? txJson.vin.length : 16,
      rct_type: txJson.rct_signatures?.type || 6,
      has_view_tags: !!(txJson.vout && txJson.vout[0]?.target?.tagged_key),
      unlock_time: txJson.unlock_time || 0,
      output_count: Array.isArray(txJson.vout) ? txJson.vout.length : 2,
      input_count: Array.isArray(txJson.vin) ? txJson.vin.length : 1,
      fee_tier: feeTier(rate),
    };
  });

  // Build fee histogram from raw txs (5 tiers)
  const buckets = { stuck:[], economy:[], normal:[], fast:[], priority:[] };
  txs.forEach(t => buckets[t.fee_tier].push(t));
  const feeHistogram = Object.entries(buckets).map(([key, arr]) => ({
    fee_rate_min: { stuck:0, economy:1, normal:5, fast:20, priority:80 }[key],
    fee_rate_max: { stuck:1, economy:5, normal:20, fast:80, priority:Infinity }[key],
    tx_count: arr.length,
    bytes: arr.reduce((s,t) => s + t.blob_size, 0),
    label: key.toUpperCase(),
    color: feeColor(({ stuck:0.5, economy:2, normal:12, fast:50, priority:100 })[key]),
  }));

  // Projected block
  const blockLimit = info?.block_weight_limit || 600000;
  const sorted = [...txs].sort((a,b) => b.fee_rate - a.fee_rate);
  const inBlock = []; let projBytes = 0;
  const tierBytes = { stuck:0, economy:0, normal:0, fast:0, priority:0 };
  for (const t of sorted) {
    if (projBytes + t.blob_size > blockLimit) break;
    inBlock.push(t);
    projBytes += t.blob_size;
    tierBytes[t.fee_tier] += t.blob_size;
  }
  const projFees = inBlock.reduce((s,t) => s + t.fee, 0);
  const rates = inBlock.map(t => t.fee_rate).sort((a,b) => a-b);
  const medRate = rates[Math.floor(rates.length/2)] || 0;

  const projectedBlock = {
    tx_count: inBlock.length,
    bytes: projBytes,
    bytes_limit: blockLimit,
    fill_pct: Math.round((projBytes/blockLimit)*100),
    total_fees: projFees,
    median_fee_rate: medRate,
    fee_tiers: tierBytes,
  };

  const allRates = txs.map(t => t.fee_rate).sort((a,b) => a-b);
  const medianFeeRate = allRates[Math.floor(allRates.length/2)] || 0;
  const p98FeeRate = allRates[Math.floor(allRates.length*0.98)] || 0;

  return {
    tx_count: txs.length,
    bytes_total: poolStats.bytes_total || txs.reduce((s,t) => s+t.blob_size, 0),
    fees_total: poolStats.fee_total || txs.reduce((s,t) => s+t.fee, 0),
    fee_histogram: feeHistogram,
    recent_txs: txs.slice(0,20),
    projected_block: projectedBlock,
    median_fee_rate: medianFeeRate,
    p98_fee_rate: p98FeeRate,
    oldest_tx_age_seconds: poolStats.oldest
      ? Math.floor(Date.now()/1000) - poolStats.oldest
      : 0,
  };
}

async function handleFees() {
  const feeEst = await rpc('get_fee_estimate');
  const fees = feeEst?.fees || [20000, 80000, 320000, 4000000];
  return {
    tiers: fees,
    recommended: fees[1] || 80000,
    slow: fees[0], normal: fees[1], fast: fees[2], fastest: fees[3],
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

async function handleBlocks() {
  const info = await rpcRetry('get_info');
  if (!info?.height) return [];
  const tipHeight = info.height - 1;   /* `info.height` is next block to mine */

  const want = 22;
  const heights = [];
  for (let i = 0; i < want; i++) heights.push(tipHeight - i);

  /* First pass: parallel fetch with retry. */
  const results = await Promise.all(
    heights.map(h => rpcRetry('get_block_header_by_height', { height: h }))
  );

  /* Identify gaps and fill them sequentially. Sequential is OK because
     the gap count is bounded by the parallel failure rate — typically
     0-3 misses out of 22. */
  const filled = [];
  for (let i = 0; i < want; i++) {
    if (results[i]?.block_header) {
      filled.push(results[i].block_header);
    } else {
      const retry = await rpcRetry('get_block_header_by_height', { height: heights[i] }, 2);
      if (retry?.block_header) filled.push(retry.block_header);
    }
  }

  /* Deduplicate by height (defense in depth). */
  const seen = new Set();
  const unique = [];
  for (const b of filled) {
    if (!seen.has(b.height)) {
      seen.add(b.height);
      unique.push(b);
    }
  }

  /* Sort height-desc to guarantee newest-first ordering. */
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

async function handleTx(txid) {
  const res = await (async () => {
    for (const node of NODES) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 6000);
        const r = await fetch(`${node}/get_transactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ txs_hashes: [txid], decode_as_json: true }),
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (!r.ok) continue;
        const data = await r.json();
        const list = data?.txs || data?.txs_as_json || [];
        if (list.length > 0) return data;
      } catch (_) {}
    }
    return null;
  })();

  const txList = res?.txs || res?.txs_as_json || [];
  if (!txList.length) return null;
  const raw = txList[0];
  const txJson = typeof raw.as_json === 'string' ? JSON.parse(raw.as_json) : (raw.as_json || {});
  const rate = (txJson.rct_signatures?.txnFee || 0) / (raw.block_size || 1847);

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

    blob_size: raw.block_size || 1847,
    fee: txJson.rct_signatures?.txnFee || 0,
    fee_rate: rate,
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

async function handleNetwork() {
  const [info, feeEst, minerData] = await Promise.all([
    rpc('get_info'),
    rpc('get_fee_estimate'),
    rpc('get_miner_data'),
  ]);
  if (!info) return null;
  return {
    height: info.height,
    difficulty: info.difficulty,
    hashrate_ghs: Math.round(info.difficulty / 120 / 1e9 * 100) / 100,
    tx_pool_size: info.tx_pool_size,
    tx_count_total: info.tx_count,
    block_weight_limit: info.block_weight_limit || 600000,
    block_weight_median: info.block_weight_median || 300000,
    target_seconds: info.target || 120,
    peer_count: (info.incoming_connections_count || 0) + (info.outgoing_connections_count || 0),
    incoming_peers: info.incoming_connections_count || 0,
    outgoing_peers: info.outgoing_connections_count || 0,
    top_block_hash: info.top_block_hash || '',
    alt_blocks_count: info.alt_blocks_count || 0,
    version: info.version || '0.18.3.4',
    major_version: 16,
    fee_tiers: feeEst?.fees || [20000, 80000, 320000, 4000000],
    randomx_seed_hash: minerData?.seed_hash || '',
  };
}

async function handleHashrate(range) {
  const info = await rpc('get_info');
  if (!info) return [];
  const now = info.height;
  const counts = { '7d': 504, '30d': 2160, '1y': 26280, 'all': 5000 };
  const count = Math.min(counts[range] || 504, 5000);
  const start = Math.max(0, now - count);
  const res = await rpc('get_block_headers_range', { start_height: start, end_height: now - 1 });
  const headers = res?.headers || [];
  // Sample every Nth block to keep response small
  const step = Math.max(1, Math.floor(headers.length / 200));
  return headers
    .filter((_,i) => i % step === 0)
    .map(h => ({
      height: h.height,
      timestamp: h.timestamp,
      hashrate_ghs: Math.round(h.difficulty / 120 / 1e9 * 100) / 100,
    }));
}

async function handleDifficulty(range) {
  const info = await rpc('get_info');
  if (!info) return [];
  const now = info.height;
  const counts = { '7d': 504, '30d': 2160, '1y': 26280 };
  const count = Math.min(counts[range] || 504, 5000);
  const start = Math.max(0, now - count);
  const res = await rpc('get_block_headers_range', { start_height: start, end_height: now - 1 });
  const headers = res?.headers || [];
  const step = Math.max(1, Math.floor(headers.length / 200));
  return headers
    .filter((_,i) => i % step === 0)
    .map(h => ({ height: h.height, timestamp: h.timestamp, difficulty: h.difficulty }));
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
      data = await handleBlocks();

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
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
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
                 block_height: block.height, block_hash: block.hash };
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
        for (const node of NODES) {
          try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 6000);
            const r = await fetch(`${node}/get_transactions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ txs_hashes: [decTxid], decode_as_json: true }),
              signal: ctrl.signal,
            });
            clearTimeout(timer);
            if (!r.ok) continue;
            const j = await r.json();
            if (j?.txs?.length || j?.txs_as_json?.length) return j;
          } catch (_) {}
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
      data = await handleHashrate(qs.range || '7d');

    } else if (sub === 'network/difficulty') {
      data = await handleDifficulty(qs.range || '7d');

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
      data = handleEmission(info?.height || 3200000);

    } else if (sub === 'stale') {
      data = await handleStale();

    } else if (sub === 'health') {
      const info = await rpc('get_info');
      data = { ok: !!info, height: info?.height || 0, peers: (info?.incoming_connections_count || 0) + (info?.outgoing_connections_count || 0) };

    } else {
      res.status(404).json({ error: `Unknown endpoint: /api/xmr/${sub}` }); return;
    }

    res.status(200).json(data);

  } catch (err) {
    console.error('[api/xmr] error:', err);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
};
