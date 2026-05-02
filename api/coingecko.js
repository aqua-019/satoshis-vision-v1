/* ═══════════════════════════════════════════════════════════════
   CoinGecko Proxy — Vercel Serverless Function
   Privacy-preserving proxy so the browser never connects to
   api.coingecko.com directly. Browser hits /api/coingecko?path=...
   and this function relays to the upstream CoinGecko v3 API.

   Allowed upstream paths are pinned to what the site actually uses:
     - simple/price            (price-service.js)
     - coins/monero/market_chart   (markets.html)
     - coins/bitcoin/market_chart  (markets.html)

   Usage:
     /api/coingecko?path=simple/price&ids=bitcoin,monero&vs_currencies=usd
     /api/coingecko?path=coins/monero/market_chart&vs_currency=usd&days=30
   ═══════════════════════════════════════════════════════════════ */

const ALLOWED = [
    /^simple\/price$/,
    /^coins\/monero\/market_chart$/,
    /^coins\/bitcoin\/market_chart$/,
];

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
        // Light edge cache — CoinGecko free-tier rate limits are tight
        res.setHeader('Cache-Control', 'public, s-maxage=60, max-age=30');
        return res.status(200).json(data);
    } catch (err) {
        return res.status(502).json({
            error: 'fetch failed',
            detail: err && err.message ? err.message : String(err),
        });
    }
}
