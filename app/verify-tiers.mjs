/* verify-tiers.mjs — offline gate for the v6.0.6 tiered-polling contract.
   Run: node verify-tiers.mjs   (Node >=22.18 strips the type annotations)

   The sandbox has no network egress to Monero nodes, so this proves the parts
   that are checkable without one: the pure backoff maths, and static assertions
   that the client and the proxy still agree about cadence.

   The invariant worth protecting: a tier's poll interval and the matching
   `s-maxage` on the proxy route must move together. If a tier speeds up but the
   edge cache window doesn't, every visitor becomes a multiplier on upstream node
   load again — which is exactly the regression v6.0.6 exists to remove. */

import { readFileSync } from 'node:fs';
import { TIER_MS, BACKOFF_CAP_MS, backoffMs, jitterFrac, jitterMs, JITTER_RATIO } from './src/data/usePolling.ts';
import { jitterFracMH, jitterMsMH } from './src/data/useMarketHistory.ts';

let fail = false;
const ok = (cond, msg) => { console.log((cond ? '✅ ' : '❌ ') + msg); if (!cond) fail = true; };

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

/* Strip block comments and whole-line `//` comments, so "this used to be X"
   documentation can quote the removed code without tripping the absence checks
   below. Deliberately does NOT strip a trailing `//` on a code line — that would
   truncate URLs inside string literals and could make an absence check
   false-pass by deleting real code. */
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '')
     .split('\n')
     .filter((l) => !/^\s*\/\//.test(l))
     .join('\n');

/* `*Raw` keeps the comments (for the assertions that check documentation);
   the bare name is code-only (for assertions that check behaviour). */
const pollingRaw = read('./src/data/usePolling.ts');
const feedRaw = read('./src/data/xmrirish-feed.ts');
const mapRaw = read('./src/data/map.ts');
const proxyRaw = read('../api/xmr.js');
const nodesRaw = read('../api/_nodes.js');

const polling = stripComments(pollingRaw);
const feed = stripComments(feedRaw);
const map = stripComments(mapRaw);
const proxy = stripComments(proxyRaw);
const nodes = stripComments(nodesRaw);

/** Count non-overlapping matches. */
const count = (src, rx) => (src.match(rx) || []).length;

// 1) the three tiers, declared once, at the documented cadence
ok(TIER_MS.fast === 3_000, `fast tier is 3s (${TIER_MS.fast}ms)`);
ok(TIER_MS.chain === 15_000, `chain tier is 15s (${TIER_MS.chain}ms)`);
ok(TIER_MS.market === 60_000, `market tier is 60s (${TIER_MS.market}ms)`);
ok(TIER_MS.fast < TIER_MS.chain && TIER_MS.chain < TIER_MS.market,
   'tiers are strictly ordered fast < chain < market');
ok(count(pollingRaw, /^export const TIER_MS/gm) === 1,
   'TIER_MS is declared exactly once (one source of truth for cadence)');

// 2) backoff: doubles, capped, and NEVER faster than the tier's own interval
ok(backoffMs(3_000, 0) === 3_000, 'no failures ⇒ the tier polls at its base rate');
ok(backoffMs(3_000, 1) === 6_000, '1 failure ⇒ 2× base');
ok(backoffMs(3_000, 2) === 10_000, '2 failures ⇒ capped at 10s, not 12s');
ok(backoffMs(3_000, 20) === BACKOFF_CAP_MS, 'runaway failures stay at the 10s cap');
/* The load-bearing one: a naive min(cap, base·2ⁿ) would make the 60s market tier
   "back off" to 10s and hammer a rate-limited upstream 6× FASTER while failing. */
ok(backoffMs(60_000, 5) === 60_000,
   'backoff never polls a tier faster than its base interval (market stays 60s)');
ok(backoffMs(15_000, 3) === 15_000, 'chain tier likewise never drops below 15s');

// 3) visibility pausing is wired to the real browser signal
ok(/visibilitychange/.test(polling) && /visibilityState/.test(polling),
   'usePolling listens for visibilitychange and reads visibilityState');
ok(/removeEventListener\(["']visibilitychange/.test(polling),
   'the visibilitychange listener is removed on cleanup (no leak per mount)');
ok(/setTimeout\(/.test(polling) && !/setInterval\(/.test(polling),
   'usePolling reschedules with setTimeout, never setInterval (no stacking)');

// 4) the client polls each endpoint on the right tier, and nothing faster
ok(/usePolling\("fast"/.test(feed), 'feed registers a fast tier');
ok(/usePolling\("chain"/.test(feed), 'feed registers a chain tier');
ok(/usePolling\("market"/.test(feed), 'feed registers a market tier');
ok(count(feed, /usePolling\(/g) === 3, 'exactly three tiers exist — no fourth poll loop');
ok(!/POLL_MS/.test(feed), 'the old single POLL_MS interval is gone');
ok(!/setInterval\(/.test(feed), 'the feed no longer owns a raw setInterval');

/* The uncacheable POST. A CDN cannot cache a POST, so every visitor hit the node
   cascade directly 24×/min. /api/xmr/network supplies the same fields over GET. */
ok(!/["']\/api\/monero["']/.test(feed),
   'the client no longer calls POST /api/monero (uncacheable by design)');
ok(/\/api\/xmr\/tip/.test(feed), 'the chain tier uses the cheap /api/xmr/tip watch');
ok(/\/api\/xmr\/fees/.test(feed), 'the fast tier polls /api/xmr/fees');

// 5) the tip is a CHANGE DETECTOR, never MoneroLive.height
/* /api/xmr/tip returns get_info.height - 1 (the tip block number) while
   /api/xmr/network returns the raw block count. Folding tip into height would
   put the whole site one block behind every public explorer. */
ok(/change detector/i.test(feedRaw),
   'the tip/height off-by-one is documented at the call site');
ok(!/mapToMoneroLive\([^)]*\btip\b/.test(feed),
   'the tip response is never folded into MoneroLive');

// 6) sparkline series advance on their own tier only
ok(/pushHash/.test(map) && /opts\.pushHash/.test(map),
   'mapToMoneroLive gates the hashSeries push behind pushHash');
ok(count(feed, /pushHash:\s*true/g) === 1,
   'exactly one tier sets pushHash (the chain tier) — a 3s push would fake resolution');
ok(/pushHash:\s*true/.test(feedRaw.slice(feedRaw.indexOf('CHAIN tier'))),
   'the pushHash:true call site is inside the chain tier');

// 7) peer zeros are not mapped anywhere (restricted RPC reports 0, not absent)
ok(!/peer_count|incoming_peers|outgoing_peers/.test(map),
   'map.ts no longer maps peer counts (public RPC reports a misleading 0)');
ok(!/peer_count|incoming_peers|outgoing_peers/.test(proxy),
   'api/xmr.js no longer publishes peer counts');

// 8) proxy cache windows match the tier cadences
const cc = (route) => {
  const rx = new RegExp(`'${route.replace(/\//g, '\\/')}':\\s*'([^']+)'`);
  const m = proxy.match(rx);
  return m ? m[1] : null;
};
const smaxage = (route) => {
  const v = cc(route);
  const m = v && v.match(/s-maxage=(\d+)/);
  return m ? Number(m[1]) : null;
};
ok(smaxage('mempool') === 3, `/mempool is edge-cached to the 3s fast tier (got ${smaxage('mempool')})`);
ok(smaxage('fees') === 3, `/fees is edge-cached to the 3s fast tier (got ${smaxage('fees')})`);
ok(smaxage('network') === 15, `/network is edge-cached to the 15s chain tier (got ${smaxage('network')})`);
ok(smaxage('blocks') === 15, `/blocks is edge-cached to the 15s chain tier (got ${smaxage('blocks')})`);
ok(smaxage('tip') !== null && smaxage('tip') <= 15,
   `/tip is edge-cached within the chain tier (got ${smaxage('tip')})`);
ok(smaxage('mining/pools') >= 60,
   `/mining/pools (~100 RPC calls) is cached for minutes, never no-store (got ${smaxage('mining/pools')})`);
ok(/stale-while-revalidate/.test(cc('mempool') || ''),
   'tier routes use stale-while-revalidate so a revalidation never blocks a reader');
ok(count(proxyRaw, /^const CACHE_CONTROL = \{/gm) === 1,
   'the proxy has exactly one cache-header table');

// 9) no invented numbers survive on the proxy
ok(!/\|\|\s*\[20000,\s*80000,\s*320000,\s*4000000\]/.test(proxy),
   'the fabricated fee-tier fallback [20000,80000,320000,4000000] is gone');
ok(!/\|\|\s*'0\.18\.3\.4'/.test(proxy), "the fabricated daemon version '0.18.3.4' is gone");
ok(!/\|\|\s*3200000/.test(proxy), 'the fabricated emission height 3200000 is gone');
ok(!/block_weight_median:\s*info\.block_weight_median\s*\|\|/.test(proxy),
   'block_weight_median no longer falls back to an invented 300000');
ok(!/nettype:\s*info\.nettype\s*\|\|\s*'mainnet'/.test(proxy),
   "nettype is reported, never assumed to be 'mainnet'");

// 10) cascade health memory is wired, and bounded by the function's maxDuration
ok(/markNodeDown/.test(nodes) && /markNodeUp/.test(nodes),
   '_nodes.js exports cold-marking helpers');
ok(/markNodeDown/.test(proxy) && /markNodeUp/.test(proxy),
   'the proxy records node health as it walks the cascade');
ok(!/^const NODES = nodesFor/m.test(proxy),
   'the node list is resolved per request, not frozen at module scope');
const budget = proxy.match(/CASCADE_BUDGET_MS\s*=\s*([\d_]+)/);
ok(budget && Number(budget[1].replace(/_/g, '')) < 30_000,
   `the cascade deadline stays inside the 30s maxDuration (${budget ? budget[1] : 'missing'})`);

// 11) simulators stay off the live data path (prompt §5.9 — still true)
ok(!/genTx|randHex/.test(feed) && !/genTx|randHex/.test(map),
   'no simulator helpers on the live data path');

/* 12) D0868 · jittered retry — the properties, not a sample of the output.
   The floor is the load-bearing one: backoffMs() exists partly to stop a
   failing 60s tier polling FASTER than its base rate, and a jitter that could
   subtract would quietly undo that. */
{
  let everBelow = false, everAbove = false, everNonZero = false;
  for (let seed of [1, 7, 4294967295]) {
    for (let seq = 0; seq <= 200; seq++) {
      const f = jitterFrac(seq, seed);
      if (f < 0 || f >= 1) everAbove = true;
      for (const base of [3_000, 15_000, 60_000]) {
        const j = jitterMs(base, seq, seed);
        if (j < base) everBelow = true;
        if (j > Math.round(base * (1 + JITTER_RATIO))) everAbove = true;
        if (j !== base) everNonZero = true;
      }
    }
  }
  ok(!everBelow, 'jitter only ever ADDS — never below the tier floor backoffMs() protects');
  ok(!everAbove, `jitter stays inside [delay, delay x ${1 + JITTER_RATIO}] and frac stays in [0,1)`);
  ok(everNonZero, 'jitter actually spreads — it is not a no-op dressed up as one');

  ok(jitterMs(3_000, 5, 12345) === jitterMs(3_000, 5, 12345),
     'jitter is deterministic for a fixed (delay, seq, seed)');
  ok(jitterFrac(5, 1) !== jitterFrac(5, 2),
     'two clients with different seeds do not share a schedule');

  // Low-discrepancy is the whole reason for the golden-ratio recurrence: 64
  // consecutive waits must cover the unit interval evenly, not clump. Uniform
  // random draws would routinely fail this bound; frac(n*phi) cannot.
  const xs = Array.from({ length: 64 }, (_, i) => jitterFrac(i, 1)).sort((a, b) => a - b);
  let maxGap = xs[0];
  for (let i = 1; i < xs.length; i++) maxGap = Math.max(maxGap, xs[i] - xs[i - 1]);
  ok(maxGap < 3 / 64, `64 consecutive waits spread evenly (largest gap ${maxGap.toFixed(4)} < ${(3 / 64).toFixed(4)})`);

  ok(backoffMs(3_000, 1) === 6_000 && backoffMs(60_000, 5) === 60_000,
     'backoffMs itself is untouched by the jitter work — composition happens at the call site');

  /* The twin sweep. useMarketHistory.ts cannot import usePolling.ts (bare-Node
     load, no extensionless relative resolution), so it inlines a copy. That is
     only safe while this assertion exists: change one implementation and this
     reddens. See the comment above jitterFracMH for why this duplication is
     acceptable where the makeReporter one was not. */
  let drift = 0;
  for (const seed of [1, 7, 4294967295]) {
    for (let seq = 0; seq <= 200; seq++) {
      if (jitterFrac(seq, seed) !== jitterFracMH(seq, seed)) drift++;
      if (jitterMs(45_000, seq, seed) !== jitterMsMH(45_000, seq, seed)) drift++;
    }
  }
  ok(drift === 0, `usePolling and useMarketHistory jitter agree over 603 x 2 samples (${drift} disagreements)`);
}

/* 13) D0868 · the call sites are actually jittered. A pure function nothing
   calls is not a fix, and this is exactly the "wired but unreached" shape. */
{
  const polling = read('./src/data/usePolling.ts');
  const tickers = read('./src/data/useTickers.ts');
  const mh = read('./src/data/useMarketHistory.ts');
  /* Match on the composition, not on one formatting of it: these assertions
     exist to catch a jitter that was deleted or bypassed, not to freeze a line
     break. An earlier version pinned the exact `setTimeout(...)` spelling and
     reddened the moment the wait was hoisted into a local — a gate failing on
     formatting teaches people to edit the gate, which is how gates die. */
  ok(/jitterMs\(backoffMs\(tierMs\(tier\), failures\)/.test(polling),
     'usePolling schedules through jitterMs(backoffMs(...)) — jitter wraps backoff, not the reverse');
  ok(/setTimeout\(run,\s*jitterMs\(nextDelay/.test(tickers),
     'useTickers jitters both its refresh and its retry wait');
  ok(/jitterMsMH\(RETRY_MS,/.test(mh) && /setTimeout\(bump,\s*wait\)/.test(mh),
     'useMarketHistory jitters its 45s retry');
  /* Strip comments before grepping — all three files legitimately NAME the
     banned call while explaining why they avoid it, and a raw grep flags the
     documentation as the offence. verify-prng.mjs:250-254 does the same, and
     its stripping has a sharp edge worth restating: it removes block comments
     and LINE-START `//` only, so a TRAILING `// ... Math.random( ...` on a code
     line still trips it. Keep such notes on their own line. */
  const strip = (s) => s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  ok(![polling, tickers, mh].some((s) => /Math\.random\(/.test(strip(s))),
     'none of the three jitter sites reached for Math.random() (comment-stripped)');
}

console.log(fail ? '\n❌ verify-tiers FAILED' : '\n✅ verify-tiers: all assertions passed');
process.exit(fail ? 1 : 0);
