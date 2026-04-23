/* ═══════════════════════════════════════════════════════════════
   Mempool 3.0 — mode switcher + shared data adapter
   Modes: ocean (default), market, track
   Persists selection in localStorage('mempool-mode').
   Provides MempoolData: derives fee_histogram + block_history +
   hourly_series client-side from MoneroNetwork polling.
   Layered so a future wss://relay.xmr.irish can replace the
   internal source without changing subscriber code.
   ═══════════════════════════════════════════════════════════════ */

(function (global) {
    'use strict';

    /* ─── mode switcher ─── */
    var STORAGE_KEY = 'mempool-mode';
    var DEFAULT_MODE = 'ocean';
    var VALID = { ocean: 1, market: 1, track: 1 };

    var Mempool = {
        activeMode: DEFAULT_MODE,
        hooks: { ocean: [], market: [], track: [] },

        register: function (modeId, fns) {
            if (!this.hooks[modeId]) return;
            this.hooks[modeId].push(fns || {});
        },

        setMode: function (mode) {
            if (!VALID[mode]) mode = DEFAULT_MODE;
            var prev = this.activeMode;
            this.activeMode = mode;
            try { localStorage.setItem(STORAGE_KEY, mode); } catch (_) {}

            // toggle visibility on every [data-mode] section
            var sections = document.querySelectorAll('[data-mode]');
            for (var i = 0; i < sections.length; i++) {
                var allowed = sections[i].getAttribute('data-mode').split(',');
                sections[i].hidden = allowed.indexOf(mode) === -1;
            }

            // toggle button state
            var btns = document.querySelectorAll('[data-mode-btn]');
            for (var j = 0; j < btns.length; j++) {
                var on = btns[j].getAttribute('data-mode-btn') === mode;
                btns[j].classList.toggle('active', on);
                btns[j].setAttribute('aria-selected', on ? 'true' : 'false');
            }

            // fire onLeave / onEnter
            if (prev !== mode) {
                this._fire(prev, 'onLeave');
                this._fire(mode, 'onEnter');
            }
        },

        _fire: function (mode, name) {
            var arr = this.hooks[mode] || [];
            for (var i = 0; i < arr.length; i++) {
                var fn = arr[i][name];
                if (typeof fn === 'function') {
                    try { fn(); } catch (e) { console.warn('[mempool-3]', mode, name, e); }
                }
            }
        }
    };

    /* ─── data adapter ─── */
    var MempoolData = {
        fee_histogram: [],
        block_history: [],
        size_history: [],          // [{t, n}] up to 288 samples (24h @ 5min)
        hourly_clock: new Array(24).fill(0),
        hourly_counts: new Array(24).fill(0),
        fee_bands: { economy: 0, standard: 0, priority: 0 },
        latest_pool: [],
        latest_blocks: [],

        _channels: { fee_histogram: [], block_history: [], hourly: [], bands: [], size: [] },

        subscribe: function (channel, fn) {
            if (!this._channels[channel]) this._channels[channel] = [];
            this._channels[channel].push(fn);
        },

        _emit: function (channel, payload) {
            var arr = this._channels[channel] || [];
            for (var i = 0; i < arr.length; i++) {
                try { arr[i](payload); } catch (e) { console.warn('[MempoolData]', channel, e); }
            }
        },

        _percentile: function (sortedArr, p) {
            if (!sortedArr.length) return 0;
            var idx = Math.min(sortedArr.length - 1, Math.floor(sortedArr.length * p));
            return sortedArr[idx];
        },

        _derivePoolStats: function (pool) {
            this.latest_pool = pool;
            // fee rates in XMR/kB (already kB, fee already XMR)
            var rates = [];
            for (var i = 0; i < pool.length; i++) {
                var tx = pool[i];
                if (tx.size > 0) rates.push(tx.fee / (tx.size / 1024));
            }
            rates.sort(function (a, b) { return a - b; });

            // fee bands (25/50/90 percentile)
            this.fee_bands = {
                economy: this._percentile(rates, 0.25),
                standard: this._percentile(rates, 0.50),
                priority: this._percentile(rates, 0.90)
            };

            // bucket fee histogram (round to 6 decimals)
            var buckets = {};
            for (var k = 0; k < rates.length; k++) {
                var b = Math.round(rates[k] * 1000000) / 1000000;
                buckets[b] = (buckets[b] || 0) + 1;
            }
            var hist = [];
            for (var key in buckets) {
                hist.push({ feeRate: parseFloat(key), txCount: buckets[key] });
            }
            hist.sort(function (a, b) { return a.feeRate - b.feeRate; });
            this.fee_histogram = hist;

            // size_history rolling buffer (sample once per minute max)
            var now = Date.now();
            var last = this.size_history[this.size_history.length - 1];
            if (!last || now - last.t > 60000) {
                this.size_history.push({ t: now, n: pool.length });
                if (this.size_history.length > 1440) this.size_history.shift(); // 24h @ 1min
                this._persistSize();
            }

            // hourly clock accumulator (UTC hour bucket)
            var hr = new Date(now).getUTCHours();
            this.hourly_counts[hr]++;
            this.hourly_clock[hr] = ((this.hourly_clock[hr] * (this.hourly_counts[hr] - 1)) + pool.length) / this.hourly_counts[hr];
            this._persistClock();

            this._emit('fee_histogram', this.fee_histogram);
            this._emit('bands', this.fee_bands);
            this._emit('size', this.size_history);
            this._emit('hourly', this.hourly_clock);
        },

        _deriveBlockHistory: function (blocks) {
            this.latest_blocks = blocks;
            // blocks already sorted newest-first; take 10
            var out = [];
            var blockSizeLimit = (global.MoneroNetwork && global.MoneroNetwork.data.blockSizeLimit) || 300000;
            for (var i = 0; i < Math.min(10, blocks.length); i++) {
                var b = blocks[i];
                var fillPct = blockSizeLimit > 0 ? Math.round((b.size / blockSizeLimit) * 100) : 0;
                // Without per-tx fee data per block we approximate from current pool fee bands
                // (visible to the user — the relay would supply real medians).
                out.push({
                    height: b.height,
                    txCount: b.numTxes,
                    medianFee: this.fee_bands.standard,
                    minFeeConfirmed: this.fee_bands.economy,
                    fillPct: Math.min(100, Math.max(0, fillPct)),
                    timestamp: b.timestamp
                });
            }
            this.block_history = out;
            this._emit('block_history', this.block_history);
        },

        _persistSize: function () {
            try {
                localStorage.setItem('mempool-size-history', JSON.stringify(this.size_history.slice(-288)));
            } catch (_) {}
        },
        _persistClock: function () {
            try {
                localStorage.setItem('mempool-clock-hourly', JSON.stringify({
                    avg: this.hourly_clock,
                    cnt: this.hourly_counts,
                    ts: Date.now()
                }));
            } catch (_) {}
        },
        _restorePersisted: function () {
            try {
                var s = localStorage.getItem('mempool-size-history');
                if (s) this.size_history = JSON.parse(s) || [];
            } catch (_) {}
            try {
                var c = localStorage.getItem('mempool-clock-hourly');
                if (c) {
                    var p = JSON.parse(c);
                    if (p && p.avg && p.avg.length === 24) {
                        this.hourly_clock = p.avg;
                        this.hourly_counts = p.cnt || new Array(24).fill(0);
                    }
                }
            } catch (_) {}
        },

        init: function () {
            this._restorePersisted();
            var self = this;
            if (global.MoneroNetwork) {
                global.MoneroNetwork.subscribePool(function (pool) { self._derivePoolStats(pool); });
                global.MoneroNetwork.subscribeBlocks(function (blocks) { self._deriveBlockHistory(blocks); });
            }
        }
    };

    /* ─── boot mode switcher ─── */
    function bootSwitcher() {
        var initial = DEFAULT_MODE;
        try {
            var stored = localStorage.getItem(STORAGE_KEY);
            if (stored && VALID[stored]) initial = stored;
        } catch (_) {}

        var btns = document.querySelectorAll('[data-mode-btn]');
        for (var i = 0; i < btns.length; i++) {
            (function (btn) {
                btn.addEventListener('click', function () {
                    Mempool.setMode(btn.getAttribute('data-mode-btn'));
                });
            })(btns[i]);
        }
        Mempool.setMode(initial);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { bootSwitcher(); MempoolData.init(); });
    } else {
        bootSwitcher();
        MempoolData.init();
    }

    global.Mempool = Mempool;
    global.MempoolData = MempoolData;
})(window);
