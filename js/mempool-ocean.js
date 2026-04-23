/* ═══════════════════════════════════════════════════════════════
   MempoolOcean — OCEAN mode orchestrator for mempool.html (M2).
   Wires six components to XmrRelayWS.  Falls back to MoneroNetwork
   polling when the relay WS is offline.
   Depends on (loaded before this):
     js/xmr-relay-ws.js
     js/monero-network.js
     js/mempool-ocean-stats.js
     js/mempool-ocean-feed.js
     js/mempool-ocean-hero.js
     js/mempool-ocean-projected.js
     js/mempool-ocean-depth.js
     js/mempool-ocean-viz.js
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
    'use strict';
    var MO = global.MempoolOceanShared || (global.MempoolOceanShared = {});

    /* ── Formatting helpers (shared across components via MO.fmt) ── */
    var fmt = {
        int: function (n) {
            if (n == null || !isFinite(n)) return '—';
            return Math.round(n).toLocaleString();
        },
        bytes: function (n) {
            if (!n && n !== 0) return '—';
            if (n < 1024) return n + ' B';
            if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
            return (n / 1024 / 1024).toFixed(2) + ' MB';
        },
        // fee passed in as piconero (integer) — convert to XMR with up to 6 sig decimals.
        xmr: function (piconero) {
            if (piconero == null || !isFinite(piconero)) return '—';
            var xmr = piconero / 1e12;
            if (xmr >= 1) return xmr.toFixed(4);
            if (xmr >= 0.0001) return xmr.toFixed(6);
            return xmr.toFixed(8);
        },
        age: function (ms) {
            if (!ms || ms < 0) return 'just now';
            var s = Math.floor(ms / 1000);
            if (s < 2) return 'just now';
            if (s < 60) return s + 's';
            var m = Math.floor(s / 60);
            if (m < 60) return m + 'm';
            var h = Math.floor(m / 60);
            return h + 'h';
        },
        txidShort: function (id) {
            if (!id || id.length < 12) return id || '—';
            return id.slice(0, 6) + '…' + id.slice(-4);
        }
    };
    MO.fmt = fmt;

    /* ── Fallback adapter ──
       Shapes MoneroNetwork.mempool output into the payloads our components
       expect when relay WS is offline.  MoneroNetwork provides fee in XMR
       and size in bytes; relay provides fee in piconero and fee_rate in p/B. */
    var Fallback = {
        active: false,

        start: function (ctx) {
            if (this.active) return;
            this.active = true;
            var self = this;
            if (!global.MoneroNetwork) return;
            if (typeof global.MoneroNetwork.startFast === 'function' && !global.MoneroNetwork._started) {
                global.MoneroNetwork.startFast();
                global.MoneroNetwork._started = true;
            }
            this._poolHandler = function (pool) { self._onPool(ctx, pool); };
            global.MoneroNetwork.subscribePool(this._poolHandler);
        },

        stop: function () { this.active = false; },

        _onPool: function (ctx, pool) {
            if (!this.active) return;
            var payload = this._shapeMempool(pool);
            ctx.applyMempoolUpdate(payload);
            ctx.applyFeeUpdate(this._shapeFees(pool));
        },

        _shapeMempool: function (pool) {
            var recent = [], total_bytes = 0, total_fees_pico = 0;
            var rates = [];
            for (var i = 0; i < pool.length; i++) {
                var t = pool[i];
                var size = t.size || 0;
                var feePico = (t.fee || 0) * 1e12;
                var rate = size > 0 ? feePico / size : 0;
                var tier = global.XmrRelayWS.classify(rate);
                recent.push({
                    txid: t.hash,
                    blob_size: size,
                    fee: feePico,
                    fee_rate: rate,
                    receive_time: t.receiveTime || Math.floor(Date.now() / 1000),
                    fee_tier: tier.key
                });
                total_bytes += size;
                total_fees_pico += feePico;
                rates.push(rate);
            }
            rates.sort(function (a, b) { return a - b; });
            var median = rates.length ? rates[Math.floor(rates.length / 2)] : 0;

            // 20 log-spaced buckets 0.1→200 p/B for client-side fee histogram.
            var hist = [], NB = 20, lmin = Math.log(0.1), lmax = Math.log(200);
            for (var b = 0; b < NB; b++) {
                var lo = Math.exp(lmin + (lmax - lmin) * (b / NB));
                var hi = Math.exp(lmin + (lmax - lmin) * ((b + 1) / NB));
                var bucketBytes = 0, bucketCount = 0;
                for (var r = 0; r < recent.length; r++) {
                    if (recent[r].fee_rate > lo && recent[r].fee_rate <= hi) {
                        bucketBytes += recent[r].blob_size;
                        bucketCount++;
                    }
                }
                if (bucketCount === 0) continue;
                var tier2 = global.XmrRelayWS.classify((lo + hi) / 2);
                hist.push({
                    fee_rate_min: lo, fee_rate_max: hi,
                    tx_count: bucketCount, bytes: bucketBytes,
                    label: tier2.label, color: tier2.color
                });
            }

            // Client-side projected block: highest-fee txs until ~300 KB.
            var limit = 300000;
            var sorted = recent.slice().sort(function (a, b) { return b.fee_rate - a.fee_rate; });
            var projBytes = 0, projTxCount = 0, projFees = 0;
            var projTierBytes = { stuck: 0, economy: 0, normal: 0, fast: 0, priority: 0 };
            for (var s = 0; s < sorted.length && projBytes < limit; s++) {
                var tx = sorted[s];
                projBytes += tx.blob_size;
                projTxCount++;
                projFees += tx.fee;
                projTierBytes[tx.fee_tier] += tx.blob_size;
            }

            return {
                tx_count: pool.length,
                bytes_total: total_bytes,
                fees_total: total_fees_pico,
                fee_histogram: hist,
                recent_txs: recent.slice(0, 40),
                projected_block: {
                    tx_count: projTxCount,
                    bytes: projBytes,
                    bytes_limit: limit,
                    fill_pct: (projBytes / limit) * 100,
                    total_fees: projFees,
                    median_fee_rate: median,
                    fee_tiers: projTierBytes
                },
                median_fee_rate: median
            };
        },

        _shapeFees: function (pool) {
            var rates = [];
            for (var i = 0; i < pool.length; i++) {
                var t = pool[i];
                if ((t.size || 0) > 0) rates.push((t.fee || 0) * 1e12 / t.size);
            }
            rates.sort(function (a, b) { return a - b; });
            function pct(p) { return rates.length ? rates[Math.min(rates.length - 1, Math.floor(rates.length * p))] : 0; }
            var tiers = [pct(0.1), pct(0.5), pct(0.9), pct(0.99)];
            return { tiers: tiers, recommended: tiers[1], timestamp: Date.now() };
        }
    };

    /* ── Connection indicator ── */
    function wireConnStatus(el, ws) {
        function apply(state) {
            el.classList.remove('live', 'connecting', 'offline');
            el.classList.add(state);
            var label = el.querySelector('.label');
            if (label) label.textContent = state.toUpperCase();
        }
        apply(ws.state);
        ws.on('state', apply);
    }

    /* ── Orchestrator ── */
    function MempoolOceanCtrl(opts) {
        this.ws = opts.ws;
        this.els = opts.els;
        this.reduced = !!opts.reducedMotion;
        this.paused = false;
        this._fallbackArmed = false;
        this._fallbackTimer = 0;

        this.stats     = new MO.MempoolStatsRow(this.els.stats);
        this.feed      = new MO.LiveTxFeed(this.els.feed, { reducedMotion: this.reduced });
        this.hero      = new MO.FeeHeroCards(this.els.hero);
        this.projected = new MO.ProjectedBlockStrip(this.els.projected);
        this.depth     = new MO.FeeDepthChart(this.els.depthCanvas, { reducedMotion: this.reduced });
        this.ocean     = new MO.OceanViz(this.els.oceanCanvas, {
            reducedMotion: this.reduced,
            tooltipEl: this.els.oceanTip,
            onClickTx: function (txid) {
                try { global.location.assign('/mempool?tx=' + encodeURIComponent(txid)); } catch (_) {}
            }
        });

        this.feed.onClickRow(function (txid) {
            try { global.location.assign('/mempool?tx=' + encodeURIComponent(txid)); } catch (_) {}
        });

        this.ocean.start();

        var self = this;
        this.ws.on('mempool-update', function (p) { self.applyMempoolUpdate(p); });
        this.ws.on('fee-update',     function (p) { self.applyFeeUpdate(p); });
        this.ws.on('block',          function () { /* ocean handles via next mempool diff */ });
        this.ws.on('tx-confirmed',   function (p) { self.ocean.confirmTxids([p && p.txid]); });
        this.ws.on('state',          function (s) { self._onWsState(s); });

        // Seed initial state via REST.
        this.ws.fetchMempool().then(function (p) { self.applyMempoolUpdate(p); }).catch(function () {});
        this.ws.fetchFees().then(function (p) { self.applyFeeUpdate(p); }).catch(function () {});
    }

    MempoolOceanCtrl.prototype.applyMempoolUpdate = function (p) {
        if (!p) return;
        this.stats.render(p);
        if (p.recent_txs) this.feed.render(p.recent_txs);
        this.projected.render(p.projected_block);
        this.depth.setHistogram(p.fee_histogram || []);
        this.ocean.sync(p.recent_txs || []);
    };

    MempoolOceanCtrl.prototype.applyFeeUpdate = function (p) {
        this.hero.render(p);
        this.depth.setFeeTiers(p);
    };

    MempoolOceanCtrl.prototype._onWsState = function (s) {
        var self = this;
        if (s === 'live') {
            if (this._fallbackTimer) { clearTimeout(this._fallbackTimer); this._fallbackTimer = 0; }
            if (this._fallbackArmed) { Fallback.stop(); this._fallbackArmed = false; }
        } else if (s === 'offline' && !this._fallbackTimer && !this._fallbackArmed) {
            this._fallbackTimer = setTimeout(function () {
                self._fallbackTimer = 0;
                if (self.ws.state !== 'live') {
                    self._fallbackArmed = true;
                    Fallback.start(self);
                }
            }, 10000);
        }
    };

    MempoolOceanCtrl.prototype.pause = function () {
        if (this.paused) return;
        this.paused = true;
        this.ocean.stop();
    };

    MempoolOceanCtrl.prototype.resume = function () {
        if (!this.paused) return;
        this.paused = false;
        this.ocean.start();
    };

    /* ── Public init ── */
    global.MempoolOcean = {
        init: function (opts) {
            opts = opts || {};
            var reduced = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
            var els = {
                hero:         document.getElementById('mp-fee-hero'),
                projected:    document.getElementById('mp-proj-block'),
                oceanCanvas:  document.getElementById('mp-ocean-canvas'),
                oceanTip:     document.getElementById('mp-ocean-tip'),
                depthCanvas:  document.getElementById('mp-depth-canvas'),
                feed:         document.getElementById('mp-txfeed'),
                stats:        document.getElementById('mp-stats-row'),
                conn:         document.getElementById('mp-conn')
            };
            var ws = opts.ws || new global.XmrRelayWS({ debug: !!opts.debug });
            if (els.conn) wireConnStatus(els.conn, ws);
            ws.connect();
            var ctrl = new MempoolOceanCtrl({ ws: ws, els: els, reducedMotion: reduced });
            this._ctrl = ctrl;
            this._ws = ws;
            return ctrl;
        },
        pause:  function () { if (this._ctrl) this._ctrl.pause(); },
        resume: function () { if (this._ctrl) this._ctrl.resume(); }
    };
})(window);
