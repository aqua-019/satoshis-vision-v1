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

    try {
        const upstream = await fetch(url.toString(), {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(12000),
        });
        if (!upstream.ok) {
            return res.status(upstream.status).json({
                error: 'upstream',
                status: upstream.status,
            });
        }
        const data = await upstream.json();
        // Edge cache — CoinGecko free-tier rate limits are tight. History is
        // slow-moving so it caches harder; spot stays fresh.
        if (HISTORY_RX.test(path)) {
            res.setHeader('Cache-Control', 'public, s-maxage=300, max-age=120');
        } else {
            res.setHeader('Cache-Control', 'public, s-maxage=60, max-age=30');
        }
        return res.status(200).json(data);
    } catch (err) {
        return res.status(502).json({
            error: 'fetch failed',
            detail: err && err.message ? err.message : String(err),
        });
    }
}
