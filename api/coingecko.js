/* ═══════════════════════════════════════════════════════════════
   CoinGecko Proxy — Vercel Serverless Function
   Privacy-preserving proxy so the browser never connects to
   api.coingecko.com directly. Browser hits /api/coingecko?path=...
   and this function relays to the upstream CoinGecko v3 API.

   Allowed upstream paths are pinned to what the site actually uses:
     - simple/price                      (spot price + 24h change)
     - coins/<id>/market_chart           (price line + total_volumes, any coin)
     - coins/<id>/ohlc                   (real OHLC candles, any coin)
     - coins/<id>/tickers                (real per-exchange volume/spread)
   The <id> is restricted to [a-z0-9-]+ (no slashes), so the proxy can only
   reach /coins/<id>/{market_chart,ohlc,tickers} — no arbitrary upstream traversal.

   Usage:
     /api/coingecko?path=simple/price&ids=bitcoin,monero&vs_currencies=usd
     /api/coingecko?path=coins/monero/market_chart&vs_currency=usd&days=30
     /api/coingecko?path=coins/monero/ohlc&vs_currency=usd&days=30
     /api/coingecko?path=coins/monero/tickers

   ENV: COINGECKO_API_KEY (optional) — a free CoinGecko *demo* key, sent
   as 'x-cg-demo-api-key'. Shared with api/markets.js: both hit the same
   upstream quota from the same egress IP, so set it once and both
   benefit. Unset = anonymous public tier (current behaviour, no crash).
   ═══════════════════════════════════════════════════════════════ */

const ALLOWED = [
    /^simple\/price$/,
    /^coins\/[a-z0-9-]+\/market_chart$/,  // any coin id, vs_currency=usd|btc
    /^coins\/[a-z0-9-]+\/ohlc$/,          // real OHLC candles
    /^coins\/[a-z0-9-]+\/tickers$/,       // real per-exchange volume/spread
];

/* ── the upstream's own budget, written down where the TTLs are chosen ──
   A free CoinGecko *demo* key allows ~30 calls/minute and 10,000 calls/month
   from one key; the anonymous public tier is lower and shared with every other
   tenant on the egress IP. Both numbers are here rather than in a comment three
   files away because they are the only reason the history TTL below is an hour:
   10,000 a month is ~13 an hour for the WHOLE SITE, and this proxy and
   /api/markets spend from the same pocket.

   Not enforced in code, deliberately — a client-side counter on a serverless
   function with no shared state would be a number that looks like a limit and
   isn't. It is a budget the CACHE TIERS are sized against. */
const CG_TIER = Object.freeze({
    name: 'demo',
    callsPerMinute: 30,
    callsPerMonth: 10_000,
    keyHeader: 'x-cg-demo-api-key',
    host: 'api.coingecko.com',
});

// History endpoints are slow-moving → cache far harder than spot.
const HISTORY_RX = /^coins\/[a-z0-9-]+\/(market_chart|ohlc)$/;
const SPOT_RX = /^simple\/price$/;
const TICKERS_RX = /^coins\/[a-z0-9-]+\/tickers$/;

// Last-known-good cache. CoinGecko's free tier 429s on shared IPs under load; when
// that happens we serve the most recent good response (within a per-class TTL) as a
// 200 so the UI never blanks — the client renders it with a STALE badge. Module
// scope survives within a warm serverless instance; keyed by the full upstream URL
// so ids/vs_currencies variants don't collide.
const staleTtlMs = (path) =>
    SPOT_RX.test(path) ? 5 * 60 * 1000
    : TICKERS_RX.test(path) ? 15 * 60 * 1000
    : 30 * 60 * 1000; // market_chart / ohlc
const lastGoodCache = new Map();

export default async function handler(req, res) {
    const path = (req.query.path || '').toString();
    if (!ALLOWED.some(rx => rx.test(path))) {
        return res.status(400).json({ error: 'path not allowed', path });
    }

    const url = new URL(`https://${CG_TIER.host}/api/v3/` + path);
    for (const [k, v] of Object.entries(req.query)) {
        if (k === 'path') continue;
        url.searchParams.set(k, Array.isArray(v) ? v.join(',') : v);
    }

    const cacheKey = url.toString();

    // Serve the last-known-good response (within the path-class TTL) with a 200
    // instead of an error, so a throttle/outage never blanks any series. Returns
    // true if it responded.
    const serveStale = (reason) => {
        const hit = lastGoodCache.get(cacheKey);
        if (hit && Date.now() - hit.at < staleTtlMs(path)) {
            res.setHeader('X-Cache', 'stale');
            res.setHeader('X-Cache-Reason', reason);
            res.setHeader('Cache-Control', 'public, max-age=15');
            res.status(200).json(hit.data);
            return true;
        }
        return false;
    };

    // A single upstream attempt. CoinGecko's free tier 429s on shared IPs under load.
    // v6.0.6: send the demo API key when configured. This proxy and /api/markets
    // share one upstream quota and one egress IP, and this one carries the far
    // more frequent traffic (the spot poll, tickers, OHLC) — so keying only the
    // aggregator would leave it starved by its own sibling.
    // A PRO key instead uses pro-api.coingecko.com with 'x-cg-pro-api-key'.
    const cgHeaders = () => {
        const headers = { 'Accept': 'application/json' };
        if (process.env.COINGECKO_API_KEY) headers[CG_TIER.keyHeader] = process.env.COINGECKO_API_KEY;
        return headers;
    };
    const attempt = (timeoutMs) => fetch(url.toString(), {
        headers: cgHeaders(),
        signal: AbortSignal.timeout(timeoutMs),
    });

    try {
        let upstream = await attempt(12000);
        // One jittered backoff-retry, only on 429: a transient throttle usually clears
        // within a second, so a single retry turns it into real fresh data instead of a
        // degraded render — most valuable on a cold cache with no last-good to serve.
        if (upstream.status === 429) {
            await new Promise((r) => setTimeout(r, 300 + Math.floor(Math.random() * 400)));
            upstream = await attempt(8000);
        }
        if (!upstream.ok) {
            // Still throttled/erroring → fall back to the last-known-good body.
            if (serveStale('upstream-' + upstream.status)) return;
            return res.status(upstream.status).json({
                error: 'upstream',
                status: upstream.status,
            });
        }
        const data = await upstream.json();
        lastGoodCache.set(cacheKey, { data, at: Date.now() });
        // Edge cache — CoinGecko free-tier rate limits are tight. History is
        // slow-moving so it caches harder; tickers sit in between; spot stays fresh.
        if (HISTORY_RX.test(path)) {
            /* p3·12: 300 -> 3600 at the edge. A CLOSED candle never changes —
               the only part of a market_chart/ohlc response that moves is its
               final, still-open bucket, and the client draws that bucket from
               the same partial data whether it is five minutes old or fifty.
               So a five-minute edge TTL was re-buying an unchanging body every
               five minutes out of a ${CG_TIER.callsPerMonth}-call month.

               The client TTL stays SHORT (max-age=120): a browser that keeps
               its own copy for an hour cannot be told the market moved, while
               the shared edge copy can be revalidated for everyone at once.
               `stale-while-revalidate` is what makes the raise safe rather than
               merely cheap — the hour is how long a response may be SERVED, not
               how long it may be BELIEVED, and the refresh happens off the
               critical path. */
            res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400, max-age=120');
        } else if (TICKERS_RX.test(path)) {
            res.setHeader('Cache-Control', 'public, s-maxage=120, max-age=60');
        } else {
            res.setHeader('Cache-Control', 'public, s-maxage=60, max-age=30');
        }
        return res.status(200).json(data);
    } catch (err) {
        if (serveStale('fetch-error')) return;
        return res.status(502).json({
            error: 'fetch failed',
            detail: err && err.message ? err.message : String(err),
        });
    }
}
