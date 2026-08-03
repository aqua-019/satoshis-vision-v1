/* ═══════════════════════════════════════════════════════════════
   api/nodes.js — Monero node health aggregator, reading from
   monero.fail/health.json
   ═══════════════════════════════════════════════════════════════

   This file is DISTINCT from api/_nodes.js, which is the node-cascade
   list that xmr.js uses for RPC routing. That file imports a hardcoded
   reference list and env vars; this file fetches a live census of
   third-party nodes' aggregate health and derives statistics from it.
   They share no code and must not.

   CommonJS module (matching api/status.js, api/feeds.js pattern).
   Single fetch per invocation from https://monero.fail/health.json
   with 8s timeout. Returns aggregated data without republishing any
   hostnames.

   WHY NO CONFIG CACHING: a vercel.json `functions` entry or `headers`
   cache rule would apply a blanket Cache-Control that overrides the
   handler's setHeader calls. Caching at the source (module scope) and
   deciding cache headers AFTER quality is known is the correct pattern
   (see api/markets.js:541-560, the warm-lambda grace precedent).
   ═══════════════════════════════════════════════════════════════ */

const GRACE_MS = 30 * 60 * 1000; // 30 minutes

/* ── module-scope cache ──────────────────────────────────────────
   Survives a warm lambda instance. Last-good payload + timestamp. */
let lastPayload = null;
let lastPayloadAt = null;
let lastPayloadQuality = null;

/* ─────────────────────────────────────────────────────────────────
   HELPERS — bound to module.exports, callable from tests
   ───────────────────────────────────────────────────────────────── */

/**
 * Parse the monero.fail health.json structure.
 * Reads .monero.clear / .onion / .i2p sections.
 * Missing/null section → [] + partial:true
 * Present but empty {} → [] without partial penalty
 * Returns { clear, onion, i2p, excluded, partial }
 */
function parseHealth(json) {
  if (!json || typeof json !== 'object') {
    return { clear: [], onion: [], i2p: [], excluded: 0, partial: true };
  }

  const monero = json.monero;
  if (!monero || typeof monero !== 'object') {
    return { clear: [], onion: [], i2p: [], excluded: 0, partial: true };
  }

  let partial = false;
  /* Accumulated across ALL sections, not per-section. A per-section counter
     that never reaches the return value is a field no input can change — and
     an assertion on a constant passes forever, which is worse than no
     assertion at all. This is the one number that says "an entry arrived that
     we could not materialise", so it has exactly one definition and this is
     it; the envelope reports it verbatim rather than re-deriving it. */
  let excluded = 0;
  const sections = {};
  const KNOWN_SECTIONS = new Set(['clear', 'onion', 'i2p']);
  const IGNORED_SECTIONS = new Set(['web_compatible']); // view over clear, not a transport

  for (const key of Object.keys(monero)) {
    if (IGNORED_SECTIONS.has(key)) continue;
    if (!KNOWN_SECTIONS.has(key)) {
      partial = true; // unknown section forces partial
      continue;
    }

    const sectionData = monero[key];
    const nodes = [];

    // Missing/null section
    if (!sectionData || typeof sectionData !== 'object') {
      partial = true;
      sections[key] = nodes;
      continue;
    }

    // Empty section — no partial penalty
    const entries = Object.entries(sectionData);
    if (entries.length === 0) {
      sections[key] = nodes;
      continue;
    }

    // Parse each node. `excluded` is the function-scoped accumulator declared
    // above — deliberately NOT redeclared here.
    for (const [host, entry] of entries) {
      if (!entry || typeof entry !== 'object') {
        excluded++;
        continue;
      }

      const available = entry.available === true;
      const checks = Array.isArray(entry.checks) ? entry.checks : [];
      const lastHeight = entry.last_height;
      const checkedAt = typeof entry.datetime_checked === 'string' ? entry.datetime_checked : null;

      // Validate: must have at least available field
      if (entry.hasOwnProperty('available')) {
        nodes.push({
          transport: key,
          available,
          checks,
          lastHeight: Number.isInteger(lastHeight) ? lastHeight : null,
          checkedAt,
        });
      } else {
        excluded++;
      }
    }

    sections[key] = nodes;
  }

  // Ensure all three sections exist (empty if missing)
  const clear = sections.clear || [];
  const onion = sections.onion || [];
  const i2p = sections.i2p || [];

  // Check for missing/null sections
  if (!monero.hasOwnProperty('clear') || monero.clear === null || monero.clear === undefined) {
    partial = true;
  }
  if (!monero.hasOwnProperty('onion') || monero.onion === null || monero.onion === undefined) {
    partial = true;
  }
  if (!monero.hasOwnProperty('i2p') || monero.i2p === null || monero.i2p === undefined) {
    partial = true;
  }

  return {
    clear,
    onion,
    i2p,
    excluded,
    partial,
  };
}

/**
 * Split nodes by transport, return counts.
 * { clear, tor, i2p, total }
 */
function transportSplit(nodes) {
  const split = { clear: 0, tor: 0, i2p: 0, total: 0 };
  for (const n of nodes) {
    split.total++;
    if (n.transport === 'clear') split.clear++;
    else if (n.transport === 'onion') split.tor++;
    else if (n.transport === 'i2p') split.i2p++;
  }
  return split;
}

/**
 * Partition nodes by availability ratio into N buckets over [0,1].
 * Nodes with ratio === 1.0 land in the LAST bucket.
 * Returns [] if nodes cannot be binned honestly (empty array input).
 */
function availabilityBuckets(nodes, bins) {
  if (!Array.isArray(nodes) || nodes.length === 0) return [];
  if (!Number.isInteger(bins) || bins < 1) return [];

  const buckets = [];
  for (let i = 0; i < bins; i++) {
    buckets.push({ from: i / bins, to: (i + 1) / bins, count: 0 });
  }

  for (const node of nodes) {
    // Ratio = passed / this node's own checks.length
    const passed = node.checks ? node.checks.filter((c) => c === true).length : 0;
    const total = node.checks ? node.checks.length : 0;

    if (total === 0) continue; // skip nodes with no check history

    const ratio = total > 0 ? passed / total : 0;

    // ratio === 1.0 goes to the LAST bucket
    if (ratio === 1.0) {
      buckets[bins - 1].count++;
    } else {
      // Find the bucket for this ratio
      const bucketIdx = Math.floor(ratio * bins);
      const clamped = Math.min(bucketIdx, bins - 1);
      buckets[clamped].count++;
    }
  }

  return buckets;
}

/**
 * Analyze height distribution, detect lagging nodes.
 * Sample = available === true AND Number.isInteger(lastHeight) AND lastHeight > 0
 * Lagging = clusters with lag > 2 (where lag = mode - clusterHeight)
 * unknownHeight = available nodes with invalid/missing/unusable height
 * Returns { mode, clusters, lagging, unknownHeight }
 */
function heightClusters(nodes) {
  if (!Array.isArray(nodes)) {
    return { mode: null, clusters: [], lagging: { count: 0, clusters: [] }, unknownHeight: 0 };
  }

  // Build sample: available nodes with valid height
  const sample = nodes.filter(
    (n) => n.available === true && Number.isInteger(n.lastHeight) && n.lastHeight > 0
  );

  // unknownHeight = available nodes with invalid/missing/non-positive height
  // (NOT including unavailable nodes, whose heights are known but untrusted)
  const availableNodes = nodes.filter((n) => n.available === true);
  const unknownHeight = availableNodes.filter(
    (n) => !Number.isInteger(n.lastHeight) || n.lastHeight <= 0
  ).length;

  if (sample.length === 0) {
    return { mode: null, clusters: [], lagging: { count: 0, clusters: [] }, unknownHeight };
  }

  // Count occurrences of each height
  const heightCounts = {};
  for (const n of sample) {
    const h = n.lastHeight;
    heightCounts[h] = (heightCounts[h] || 0) + 1;
  }

  // Find mode (highest height on tie)
  let mode = null;
  let modeCount = 0;
  for (const [heightStr, count] of Object.entries(heightCounts)) {
    const h = Number(heightStr);
    if (count > modeCount || (count === modeCount && h > mode)) {
      mode = h;
      modeCount = count;
    }
  }

  // Build clusters
  const clusters = [];
  for (const [heightStr, count] of Object.entries(heightCounts)) {
    const h = Number(heightStr);
    clusters.push({
      height: h,
      count,
      lag: mode !== null ? mode - h : 0,
    });
  }

  // Sort by height descending for consistency
  clusters.sort((a, b) => b.height - a.height);

  // Extract lagging clusters (lag > 2)
  const laggingClusters = clusters.filter((c) => c.lag > 2);
  const laggingCount = laggingClusters.reduce((sum, c) => sum + c.count, 0);

  return {
    mode,
    clusters,
    lagging: { count: laggingCount, clusters: laggingClusters },
    unknownHeight,
  };
}

/**
 * Determine payload quality from structure and content.
 * 'degraded' when: partial, reachable === 0, or body fails shape guard
 */
function payloadQuality(body) {
  if (!body || typeof body !== 'object') return 'degraded';
  if (body.partial === true) return 'degraded';
  if (body.status === 'unavailable') return 'degraded'; // no quality for unavailable
  if (body.counts && body.counts.reachable === 0) return 'degraded';
  return 'full';
}

/**
 * Cache headers based on quality.
 * full: 300s s-maxage, 900s swr
 * degraded: 45s s-maxage, 45s swr
 */
function cacheHeadersFor(quality) {
  if (quality === 'full') {
    return { sMaxAge: 300, swr: 900 };
  }
  return { sMaxAge: 45, swr: 45 };
}

/**
 * Test-only reset cache.
 */
function _resetCache() {
  lastPayload = null;
  lastPayloadAt = null;
  lastPayloadQuality = null;
}

/* ─────────────────────────────────────────────────────────────────
   MAIN HANDLER
   ───────────────────────────────────────────────────────────────── */

module.exports = async function handler(req, res) {
  // CORS + Cache-Control set IN-HANDLER
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET only' });
    return;
  }

  const now = Date.now();

  // Check warm-lambda grace cache first
  if (lastPayload !== null && lastPayloadAt !== null) {
    const age = now - lastPayloadAt;
    const { sMaxAge, swr } = cacheHeadersFor(lastPayloadQuality);
    const freshMs = sMaxAge * 1000;
    const graceMs = GRACE_MS;

    if (age < freshMs) {
      // Within fresh window: serve as live
      res.setHeader('Cache-Control', `public, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`);
      res.setHeader('X-Cache', 'hit');
      res.setHeader('X-Nodes-Quality', lastPayloadQuality);
      return res.status(200).json(lastPayload);
    } else if (age < graceMs) {
      // Within grace window: serve as stale
      const staleBody = {
        ...lastPayload,
        status: 'stale',
        quality: 'degraded',
      };
      res.setHeader('Cache-Control', `public, s-maxage=45, stale-while-revalidate=45`);
      res.setHeader('X-Cache', 'hit (stale)');
      res.setHeader('X-Nodes-Quality', 'degraded');
      return res.status(200).json(staleBody);
    }
  }

  // Fetch from upstream
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  let upstreamStatus = null;
  let upstreamReason = null;
  let json = null;

  try {
    const response = await fetch('https://monero.fail/health.json', {
      signal: controller.signal,
    });

    upstreamStatus = response.status;

    if (!response.ok) {
      upstreamReason = 'upstream-status';
    } else {
      try {
        json = await response.json();
      } catch (e) {
        upstreamReason = 'upstream-malformed';
      }
    }
  } catch (err) {
    /* FOUR reasons, FOUR producible states — and that is the whole point.
       This block previously read `if (err.name === 'AbortError') { timeout }
       else { timeout }`, with a comment saying "treat all errors as timeout".
       Both arms were identical, so no input could distinguish them: a DNS
       failure, a refused connection and a TLS error all reported that
       monero.fail TIMED OUT when it was never reached. That is a fabricated
       cause on a live surface, in the one field whose only job is to say why —
       and any gate asserting the timeout path would have been green on every
       throwing input while testing nothing.

       Scope, stated honestly: this try covers `fetch` and reading
       `.status`/`.ok` only. A throw inside parseHealth or the aggregation is
       OUTSIDE it, becomes a platform 500, and correctly reaches the panel as
       "/api/nodes did not answer" — which is a different and also true claim. */
    upstreamReason = err && err.name === 'AbortError'
      ? 'upstream-timeout'      // the 8s AbortController fired
      : 'upstream-unreachable'; // DNS, refused, TLS, socket — never reached
  } finally {
    clearTimeout(timeoutId);
  }

  // Handle upstream failure with grace fallback
  if (upstreamReason !== null) {
    if (lastPayload !== null && now - lastPayloadAt < GRACE_MS) {
      // Serve stale last-good
      const staleBody = {
        ...lastPayload,
        status: 'stale',
        quality: 'degraded',
      };
      res.setHeader('Cache-Control', `public, s-maxage=45, stale-while-revalidate=45`);
      res.setHeader('X-Cache', 'hit (stale)');
      res.setHeader('X-Nodes-Quality', 'degraded');
      return res.status(200).json(staleBody);
    }

    /* No cache: unavailable, with NO numeric fields at all — a zero-count
       success is indistinguishable from a real network with no reachable
       nodes, which is exactly the fabrication this endpoint exists to avoid.
       `upstreamReason` is non-null inside this branch by construction (it is
       the branch condition), so it is used directly; an earlier
       `upstreamReason || 'upstream-timeout'` here had an unreachable right
       arm that read as a safety net while being decoration. */
    const body = {
      v: 1,
      at: new Date().toISOString(),
      source: 'monero.fail',
      status: 'unavailable',
      reason: upstreamReason,
      /* The status code, when there was one. F2: this was captured and
         discarded, so the envelope could not say WHICH status the upstream
         returned. A bare code — no URL echo, no body, nothing that could
         carry an upstream error string onto our surface. */
      upstreamStatus,
    };

    /* 45/45, NOT no-store — matching the two sibling degraded exits above and
       this file's own header. `no-store` here would remove the CDN collapse
       precisely during an outage, turning every visitor request into a fresh
       upstream fetch: an origin stampede against a third party that is
       already struggling. DEGRADED_S_MAXAGE exists to retry SOON while still
       collapsing concurrent visitors; opting out of the second half is not a
       faster retry, it is an amplifier. */
    const { sMaxAge: dm, swr: dw } = cacheHeadersFor('degraded');
    res.setHeader('Cache-Control', `public, s-maxage=${dm}, stale-while-revalidate=${dw}`);
    res.setHeader('X-Nodes-Quality', 'degraded');
    return res.status(200).json(body);
  }

  // Parse and aggregate
  const parsed = parseHealth(json);
  const allNodes = [...parsed.clear, ...parsed.onion, ...parsed.i2p];

  // Counts
  const seen = allNodes.length;
  const reachable = allNodes.filter((n) => n.available === true).length;
  const heightAnalysis = heightClusters(allNodes);
  const unknownHeight = heightAnalysis.unknownHeight;

  const split = transportSplit(allNodes);
  const availability = availabilityBuckets(allNodes, 4);

  // Sample max checkedAt for sampledAt
  let sampledAt = null;
  for (const n of allNodes) {
    if (n.checkedAt && (!sampledAt || n.checkedAt > sampledAt)) {
      sampledAt = n.checkedAt;
    }
  }

  // Build response
  const body = {
    v: 1,
    at: new Date().toISOString(),
    source: 'monero.fail',
    sampledAt,
    status: 'live',
    /* Explicit null, not absent. The client narrows a discriminated union on
       `status`, and a shape guard that reads `typeof body.reason` sees
       `undefined` for a missing key — indistinguishable from a malformed
       payload. Present-and-null says "nothing went wrong"; absent says
       nothing at all. */
    reason: null,
    quality: null, // will be set after building
    counts: {
      seen,
      reachable,
      /* Reported verbatim from parseHealth, never re-derived. An earlier
         version computed `seen - allNodes.length + (partial ? 1 : 0)` here,
         which added an entry-level exclusion for a SECTION-level absence —
         two different facts, one number, and a count nothing in the payload
         could justify. `partial` already says a section was missing. */
      excluded: parsed.excluded,
      unknownHeight,
    },
    split,
    availability,
    height: {
      mode: heightAnalysis.mode,
      clusters: heightAnalysis.clusters,
      lagging: heightAnalysis.lagging,
    },
    partial: parsed.partial,
  };

  // Determine quality
  const quality = payloadQuality(body);
  body.quality = quality;

  // Cache this payload
  lastPayload = body;
  lastPayloadAt = now;
  lastPayloadQuality = quality;

  // Set cache headers
  const { sMaxAge, swr } = cacheHeadersFor(quality);
  res.setHeader('Cache-Control', `public, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`);
  res.setHeader('X-Cache', 'miss');
  res.setHeader('X-Nodes-Quality', quality);

  return res.status(200).json(body);
};

// Export helpers for testing
module.exports.parseHealth = parseHealth;
module.exports.transportSplit = transportSplit;
module.exports.availabilityBuckets = availabilityBuckets;
module.exports.heightClusters = heightClusters;
module.exports.payloadQuality = payloadQuality;
module.exports.cacheHeadersFor = cacheHeadersFor;
module.exports._resetCache = _resetCache;
