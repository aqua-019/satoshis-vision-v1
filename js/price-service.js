/* ═══════════════════════════════════════════════════════════════
   Price Service — xmr.irish C.3.3
   CoinGecko API with 30-min pub/sub pattern
   Shared across all pages via PriceService.subscribe()
   ═══════════════════════════════════════════════════════════════ */

const PriceService = {
    data: { btc: null, xmr: null, eth: null, sol: null, ltc: null, btcXmrRatio: null },
    listeners: [],
    INTERVAL: 1800000, // 30 minutes

    subscribe(fn) { this.listeners.push(fn); },
    notify() { this.listeners.forEach(fn => fn(this.data)); },

    async fetch() {
        try {
            const res = await fetch(
                'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,monero,ethereum,solana,litecoin&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true'
            );
            const raw = await res.json();

            this.data = {
                btc: {
                    usd: raw.bitcoin.usd,
                    change24h: raw.bitcoin.usd_24h_change,
                    mcap: raw.bitcoin.usd_market_cap,
                    vol: raw.bitcoin.usd_24h_vol
                },
                xmr: {
                    usd: raw.monero.usd,
                    change24h: raw.monero.usd_24h_change,
                    mcap: raw.monero.usd_market_cap,
                    vol: raw.monero.usd_24h_vol
                },
                eth: {
                    usd: raw.ethereum.usd,
                    change24h: raw.ethereum.usd_24h_change,
                    mcap: raw.ethereum.usd_market_cap,
                    vol: raw.ethereum.usd_24h_vol
                },
                sol: {
                    usd: raw.solana.usd,
                    change24h: raw.solana.usd_24h_change,
                    mcap: raw.solana.usd_market_cap,
                    vol: raw.solana.usd_24h_vol
                },
                ltc: {
                    usd: raw.litecoin.usd,
                    change24h: raw.litecoin.usd_24h_change,
                    mcap: raw.litecoin.usd_market_cap,
                    vol: raw.litecoin.usd_24h_vol
                },
                btcXmrRatio: raw.bitcoin.usd / raw.monero.usd
            };

            this.notify();
        } catch (err) {
            console.warn('[PriceService] fetch error:', err);
        }
    },

    start() {
        this.fetch();
        setInterval(() => this.fetch(), this.INTERVAL);
    },

    // Formatting helpers
    fmt(v, digits = 0) {
        return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: digits });
    },
    fmtCompact(v) {
        if (v >= 1e12) return '$' + (v / 1e12).toFixed(2) + 'T';
        if (v >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B';
        if (v >= 1e6) return '$' + (v / 1e6).toFixed(0) + 'M';
        return '$' + v.toLocaleString();
    },
    pct(v) { return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`; },
    cls(v) { return v >= 0 ? 'up' : 'dn'; }
};

// Nav ticker subscriber — updates BTC/XMR/ratio in header on all pages
PriceService.subscribe(function updateNavTicker(prices) {
    if (!prices.btc) return;

    const update = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };
    const updateCls = (id, val, cls) => {
        const el = document.getElementById(id);
        if (el) { el.textContent = val; el.className = 'chg-' + cls; }
    };

    update('nav-btc-price', PriceService.fmt(prices.btc.usd, 0));
    updateCls('nav-btc-change', PriceService.pct(prices.btc.change24h), PriceService.cls(prices.btc.change24h));

    update('nav-xmr-price', PriceService.fmt(prices.xmr.usd, 0));
    updateCls('nav-xmr-change', PriceService.pct(prices.xmr.change24h), PriceService.cls(prices.xmr.change24h));

    update('nav-ratio-val', prices.btcXmrRatio.toFixed(1));

    // Ring center price (homepage)
    update('rc-price', PriceService.fmt(prices.xmr.usd, 0));
    // Orbit price (homepage)
    update('orb-price', PriceService.fmt(prices.xmr.usd, 0));
});
