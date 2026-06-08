/* ═══════════════════════════════════════════════════════════════
   CoinGecko Proxy — Vercel Serverless Function
   Privacy-preserving proxy so the browser never connects to
   api.coingecko.com directly. Browser hits /api/coingecko?path=...
   and this function relays to the upstream CoinGecko v3 API.

   Allowed upstream paths are pinned to what the site actually uses:
     - simple/price                      (spot price + 24h change)
     - coins/<id>/market_chart           (price line + total_volumes, any coin)
     - coins/<id>/ohlc                   (real OHLC candles, any coin)
   The <id> is restricted to [a-z0-9-]+ (no slashes), so the proxy can only
   reach /coins/<id>/{market_chart,ohlc} — no arbitrary upstream traversal.

   Usage:
     /api/coingecko?path=simple/price&ids=bitcoin,monero&vs_currencies=usd
     /api/coingecko?path=coins/monero/market_chart&vs_currency=usd&days=30
     /api/coingecko?path=coins/monero/ohlc&vs_currency=usd&days=30
   ═══════════════════════════════════════════════════════════════ */

const ALLOWED = [
    /^simple\/price$/,
    /^coins\/[a-z0-9-]+\/market_chart$/,  // any coin id, vs_currency=usd|btc
    /^coins\/[a-z0-9-]+\/ohlc$/,          // real OHLC candles
];

// History endpoints are slow-moving → cache far harder than spot.
const HISTORY_RX = /^coins\/[a-z0-9-]+\/(market_chart|ohlc)$/;
const SPOT_RX = /^simple\/price$/;

// Last-known spot cache. CoinGecko's free tier 429s on shared IPs under load; when
// that happens we serve the most recent good price (within TTL) as a 200 so the UI
// never blanks. Module scope survives within a warm serverless instance; keyed by
// the full upstream URL so ids/vs_currencies variants don't collide.
const SPOT_TTL_MS = 5 * 60 * 1000;
const spotCache = new Map();

export default async function handler(req, res) {
    const path = (req.query.path || '').toString();
    if (!ALLOWED.some(rx => rx.test(path))) {
        return res.status(400).json({ error: 'path not allowed', path });
    }

    const url = new URL('https://api.coingecko.com/api/v3/' + path);
    for (const [k, v] of Object.entries(req.query)) {
        if (k === 'path') continue;
        url.searchParams.set(k, Array.isArray(v) ? v.join(',') : v);
    }

    const isSpot = SPOT_RX.test(path);
    const cacheKey = url.toString();

    // Serve the last-known spot price (within TTL) with a 200 instead of an error,
    // so a throttle/outage never blanks the price. Returns true if it responded.
    const serveStale = (reason) => {
        if (!isSpot) return false;
        const hit = spotCache.get(cacheKey);
        if (hit && Date.now() - hit.at < SPOT_TTL_MS) {
            res.setHeader('X-Cache', 'stale');
            res.setHeader('X-Cache-Reason', reason);
            res.setHeader('Cache-Control', 'public, max-age=15');
            res.status(200).json(hit.data);
            return true;
        }
        return false;
    };

    try {
        const upstream = await fetch(url.toString(), {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(12000),
        });
        if (!upstream.ok) {
            // 429 (or any upstream error) on spot → fall back to last-known price.
            if (serveStale('upstream-' + upstream.status)) return;
            return res.status(upstream.status).json({
                error: 'upstream',
                status: upstream.status,
            });
        }
        const data = await upstream.json();
        if (isSpot) spotCache.set(cacheKey, { data, at: Date.now() });
        // Edge cache — CoinGecko free-tier rate limits are tight. History is
        // slow-moving so it caches harder; spot stays fresh.
        if (HISTORY_RX.test(path)) {
            res.setHeader('Cache-Control', 'public, s-maxage=300, max-age=120');
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
