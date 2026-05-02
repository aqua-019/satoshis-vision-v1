/* ═══════════════════════════════════════════════════════════════
   Price Service — xmr.irish C.3.3
   CoinGecko API with 30-min pub/sub pattern
   Shared across all pages via PriceService.subscribe()

   Diagnostics: set window._xmrDebug = true in DevTools to see
   the [price] log chain (start → fetch → parse → render).
   ═══════════════════════════════════════════════════════════════ */

const PriceService = {
    data: { btc: null, xmr: null, eth: null, sol: null, ltc: null, btcXmrRatio: null },
    listeners: [],
    INTERVAL: 1800000, // 30 minutes
    _started: false,
    _timer: null,

    subscribe(fn) { this.listeners.push(fn); },
    notify() {
        if (window._xmrDebug) console.log('[price] notify', this.listeners.length, 'listener(s)', this.data);
        this.listeners.forEach(fn => {
            try { fn(this.data); }
            catch (err) { console.warn('[PriceService] listener error:', err); }
        });
    },

    async fetch() {
        if (window._xmrDebug) console.log('[price] fetch start');
        try {
            const res = await fetch(
                '/api/coingecko?path=simple/price&ids=bitcoin,monero,ethereum,solana,litecoin&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true'
            );
            if (window._xmrDebug) console.log('[price] response status', res.status);
            if (!res.ok) {
                console.warn('[PriceService] non-ok response:', res.status);
                return;
            }
            const raw = await res.json();
            if (window._xmrDebug) console.log('[price] data parsed', raw);

            // Defensive: bail if shape is unexpected (rate-limit HTML, partial data).
            if (!raw || !raw.bitcoin || !raw.monero) {
                console.warn('[PriceService] unexpected payload shape:', raw);
                return;
            }

            const pickCoin = (c) => c ? {
                usd:       c.usd       != null ? c.usd       : null,
                change24h: c.usd_24h_change != null ? c.usd_24h_change : null,
                mcap:      c.usd_market_cap != null ? c.usd_market_cap : null,
                vol:       c.usd_24h_vol    != null ? c.usd_24h_vol    : null
            } : null;

            this.data = {
                btc: pickCoin(raw.bitcoin),
                xmr: pickCoin(raw.monero),
                eth: pickCoin(raw.ethereum),
                sol: pickCoin(raw.solana),
                ltc: pickCoin(raw.litecoin),
                btcXmrRatio: (raw.bitcoin.usd && raw.monero.usd)
                    ? (raw.bitcoin.usd / raw.monero.usd) : null
            };

            if (window._xmrDebug) console.log('[price] normalized', this.data);
            this.notify();
            try { sessionStorage.setItem('xmr_prices', JSON.stringify(this.data)); } catch (_) {}
        } catch (err) {
            console.warn('[PriceService] fetch error:', err);
        }
    },

    start() {
        if (this._started) {
            if (window._xmrDebug) console.log('[price] start() already running, skip');
            return;
        }
        this._started = true;
        if (window._xmrDebug) console.log('[price] start() called');

        /* Restore cached prices immediately so nav shows on first paint */
        try {
            const cached = sessionStorage.getItem('xmr_prices');
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed && parsed.btc && parsed.xmr) {
                    this.data = parsed;
                    if (window._xmrDebug) console.log('[price] restored from cache', parsed);
                    this.notify();
                }
            }
        } catch (_) {}
        this.fetch();
        this._timer = setInterval(() => this.fetch(), this.INTERVAL);
    },

    // Formatting helpers
    fmt(v, digits = 0) {
        if (v == null || isNaN(v)) return '—';
        return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: digits });
    },
    fmtCompact(v) {
        if (v == null || isNaN(v)) return '—';
        if (v >= 1e12) return '$' + (v / 1e12).toFixed(2) + 'T';
        if (v >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B';
        if (v >= 1e6) return '$' + (v / 1e6).toFixed(0) + 'M';
        return '$' + v.toLocaleString();
    },
    pct(v) {
        if (v == null || isNaN(v)) return '';
        return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
    },
    cls(v) { return (v != null && v >= 0) ? 'up' : 'dn'; }
};

// Nav ticker subscriber — updates BTC/XMR/ratio in header on all pages
PriceService.subscribe(function updateNavTicker(prices) {
    if (!prices || !prices.btc || !prices.xmr) {
        if (window._xmrDebug) console.log('[price] nav ticker skipped — incomplete data');
        return;
    }

    const update = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };
    const updateCls = (id, val, cls) => {
        const el = document.getElementById(id);
        if (el) { el.textContent = val; el.className = 'chg-' + cls; }
    };

    if (window._xmrDebug) {
        const targets = ['nav-btc-price','nav-xmr-price','nav-ratio-val'].map(function (id) {
            return id + '=' + (document.getElementById(id) ? '✓' : '✗');
        }).join(' ');
        console.log('[price] nav ticker targets:', targets);
    }

    if (prices.btc.usd != null) {
        update('nav-btc-price', PriceService.fmt(prices.btc.usd, 0));
        updateCls('nav-btc-change', PriceService.pct(prices.btc.change24h), PriceService.cls(prices.btc.change24h));
    }
    if (prices.xmr.usd != null) {
        update('nav-xmr-price', PriceService.fmt(prices.xmr.usd, 0));
        updateCls('nav-xmr-change', PriceService.pct(prices.xmr.change24h), PriceService.cls(prices.xmr.change24h));
    }
    if (prices.btcXmrRatio != null) {
        update('nav-ratio-val', prices.btcXmrRatio.toFixed(1));
    }

    // Ring center price (homepage)
    if (prices.xmr.usd != null) {
        update('rc-price', PriceService.fmt(prices.xmr.usd, 0));
        // Orbit price (homepage)
        update('orb-price', PriceService.fmt(prices.xmr.usd, 0));
    }
});
