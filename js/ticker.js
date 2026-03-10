/* ============================================
   Satoshi's Vision — Price Ticker
   CoinGecko BTC/XMR price display
   ============================================ */

(function () {
    'use strict';

    var REFRESH_INTERVAL = 60000; // 60 seconds

    function formatPrice(value) {
        return value.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0
        });
    }

    function formatChange(value) {
        var sign = value > 0 ? '+' : '';
        return sign + value.toFixed(2) + '%';
    }

    function updateElement(id, text) {
        var el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    function updateClass(id, className) {
        var el = document.getElementById(id);
        if (el) el.className = className;
    }

    async function fetchPrices() {
        try {
            var response = await fetch(
                'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,monero&vs_currencies=usd&include_24hr_change=true'
            );
            var data = await response.json();

            var btcPrice = formatPrice(data.bitcoin.usd);
            var btcChange = data.bitcoin.usd_24h_change;
            var xmrPrice = formatPrice(data.monero.usd);
            var xmrChange = data.monero.usd_24h_change;

            // Desktop
            updateElement('btc-price', btcPrice);
            updateElement('btc-change', formatChange(btcChange));
            updateClass('btc-change', 'price-change ' + (btcChange >= 0 ? 'up' : 'down'));

            updateElement('xmr-price', xmrPrice);
            updateElement('xmr-change', formatChange(xmrChange));
            updateClass('xmr-change', 'price-change ' + (xmrChange >= 0 ? 'up' : 'down'));

            // Mobile
            updateElement('btc-price-mobile', btcPrice);
            updateElement('xmr-price-mobile', xmrPrice);
        } catch (err) {
            // Silently fail — prices are supplementary
        }
    }

    // Only run if ticker elements exist on page
    if (document.getElementById('btc-price') || document.getElementById('btc-price-mobile')) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () {
                fetchPrices();
                setInterval(fetchPrices, REFRESH_INTERVAL);
            });
        } else {
            fetchPrices();
            setInterval(fetchPrices, REFRESH_INTERVAL);
        }
    }
})();
