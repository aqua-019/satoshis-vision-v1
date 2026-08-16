/* api/_fixtures/xmr-history-prefix.mjs — a PERMANENT NEGATIVE CONTROL.

   This is a byte-for-byte-behavioural copy of the /network/hashrate and
   /network/difficulty logic api/xmr.js shipped BEFORE the S1-CONTRACT.md
   fix (quoted verbatim there, measured at 7589c50), reparameterised so it
   runs OFFLINE against a synthetic chain instead of calling rpc() itself:
     - the two range-count tables are copy-pasted exactly as they were,
       including hashrate's extra 'all' key that difficulty never had
     - the downsampler is the old `i % step === 0` filter, anchored at
       index 0 instead of the newest header
     - there is no RESTRICTED_HEADER_SPAN constant, no shared range
       resolver, and no per-response cache override — none of those
       existed yet, and that ABSENCE is itself part of the negative control

   api/verify-history.mjs runs its assertions against BOTH this file and the
   shipped api/xmr.js, and expects the shipped module to pass every one and
   this file to fail it. This makes the red state a committed file rather
   than a working-tree mutation that has to be remembered and reverted — see
   CLAUDE.md's "restore protocol failed twice" entries for why that matters.

   Do NOT "fix" the bug reproduced below. Reproducing it is the entire
   reason this file exists. If a future edit here ever makes an assertion in
   verify-history.mjs start PASSING against this file, the gate has stopped
   proving anything — fix the gate (or delete this file and the assertion
   together, deliberately), never patch this fixture to behave correctly. */

const OLD_HASHRATE_COUNTS = { '7d': 504, '30d': 2160, '1y': 26280, 'all': 5000 };
const OLD_DIFFICULTY_COUNTS = { '7d': 504, '30d': 2160, '1y': 26280 };

export const OLD_COUNTS_TABLES = {
  hashrate: OLD_HASHRATE_COUNTS,
  difficulty: OLD_DIFFICULTY_COUNTS,
};

/* Simulates get_block_headers_range against a public RESTRICTED monerod
   node: returns [] once the requested span exceeds monerod's real
   RESTRICTED_BLOCK_HEADER_RANGE (1000) — "Too many block headers
   requested." 1000 is monerod's own protocol fact, hardcoded here
   independently of whatever constant the module under test exports, so
   this fixture cannot accidentally inherit the fix it exists to be
   compared against. */
const MONEROD_RESTRICTED_SPAN = 1000;

function simulateHeaders(count, chainHeight) {
  const span = count - 1;
  if (span > MONEROD_RESTRICTED_SPAN) return [];
  const start = Math.max(0, chainHeight - count);
  const end = chainHeight - 1;
  const headers = [];
  for (let h = start; h <= end; h++) {
    headers.push({ height: h, timestamp: 1_700_000_000 + h * 120, difficulty: 300_000_000_000 + h });
  }
  return headers;
}

/* The old sampler: `i % step === 0`, anchored at index 0. Exported directly
   so the gate can feed it an arbitrary headers array. */
export function oldSample(headers) {
  const step = Math.max(1, Math.floor(headers.length / 200));
  return headers.filter((_, i) => i % step === 0);
}

/* Old handleHashrate, quoted verbatim from S1-CONTRACT.md except `info` is
   replaced by a `chainHeight` parameter and rpc() is replaced by
   simulateHeaders() — the only two points that touched the network. */
export function oldHandleHashrate(range, chainHeight) {
  const now = chainHeight;
  const counts = OLD_HASHRATE_COUNTS;
  const count = Math.min(counts[range] || 504, 5000);
  const headers = simulateHeaders(count, now);
  return oldSample(headers).map(h => ({
    height: h.height,
    timestamp: h.timestamp,
    hashrate_ghs: Math.round(h.difficulty / 120 / 1e9 * 100) / 100,
  }));
}

/* Old handleDifficulty, same treatment. */
export function oldHandleDifficulty(range, chainHeight) {
  const now = chainHeight;
  const counts = OLD_DIFFICULTY_COUNTS;
  const count = Math.min(counts[range] || 504, 5000);
  const headers = simulateHeaders(count, now);
  return oldSample(headers).map(h => ({ height: h.height, timestamp: h.timestamp, difficulty: h.difficulty }));
}

/* Old cacheControlFor: single-argument, no response body, so it structurally
   cannot see ok:false and always returns the long TTL for these two routes. */
const OLD_CACHE_CONTROL = {
  'network/hashrate': 's-maxage=300, stale-while-revalidate=600',
  'network/difficulty': 's-maxage=300, stale-while-revalidate=600',
};
export function oldCacheControlFor(sub) {
  if (Object.prototype.hasOwnProperty.call(OLD_CACHE_CONTROL, sub)) return OLD_CACHE_CONTROL[sub];
  return null;
}

/* Deliberately NOT exported: RESTRICTED_HEADER_SPAN, resolveHistoryRange,
   HISTORY_RANGES, HISTORY_DEFAULT, sampleHeaders, buildHistoryEnvelope,
   DEGRADED_HISTORY_S_MAXAGE. None of those existed before the fix; their
   absence here (checked via `typeof prefix.X === 'undefined'`) IS the
   negative control for every assertion that checks for them. */
