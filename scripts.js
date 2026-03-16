/* ═══════════════════════════════════════════════════════════════
   SHARED SCRIPTS — XMR.IRISH / Satoshi's Vision Archive
   Common JS extracted from all page-level inline scripts.
   ═══════════════════════════════════════════════════════════════ */

/* ── Mobile Menu Toggle ─────────────────────────────────────── */
function toggleMenu() {
    var el = document.getElementById('mobileMenu');
    if (el) el.classList.toggle('active');
}

/* ── Price Ticker ───────────────────────────────────────────── */
/* Fetches BTC/USD, XMR/USD, BTC/XMR ratio from CoinGecko.
   Updates elements with IDs: btc-price, btc-change, xmr-price,
   xmr-change, btc-xmr-ratio.  30-minute refresh. */
(function() {
    function fetchPrices() {
        var controller = new AbortController();
        setTimeout(function() { controller.abort(); }, 15000);
        fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,monero&vs_currencies=usd&include_24hr_change=true', { signal: controller.signal })
            .then(function(r) { return r.json(); })
            .then(function(d) {
                var btc = d.bitcoin || {};
                var xmr = d.monero || {};

                var fmt = function(v) { return '$' + v.toLocaleString('en-US', { maximumFractionDigits: v >= 1000 ? 0 : 2 }); };
                var pct = function(v) { return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'; };

                if (btc.usd) {
                    var btcEl = document.getElementById('btc-price');
                    if (btcEl) btcEl.textContent = fmt(btc.usd);
                    var btcChg = document.getElementById('btc-change');
                    if (btcChg) { btcChg.textContent = pct(btc.usd_24h_change); btcChg.className = 'price-change ' + (btc.usd_24h_change >= 0 ? 'up' : 'down'); }
                }
                if (xmr.usd) {
                    var xmrEl = document.getElementById('xmr-price');
                    if (xmrEl) xmrEl.textContent = fmt(xmr.usd);
                    var xmrChg = document.getElementById('xmr-change');
                    if (xmrChg) { xmrChg.textContent = pct(xmr.usd_24h_change); xmrChg.className = 'price-change ' + (xmr.usd_24h_change >= 0 ? 'up' : 'down'); }
                }
                if (btc.usd && xmr.usd) {
                    var ratioEl = document.getElementById('btc-xmr-ratio');
                    if (ratioEl) ratioEl.textContent = (btc.usd / xmr.usd).toFixed(1);
                }
            }).catch(function(e) { console.log('Price fetch error:', e); });
    }
    fetchPrices();
    setInterval(fetchPrices, 1800000);
})();
