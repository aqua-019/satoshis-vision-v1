/* mempool-mining-hashrate.js — M4 Task 16: hashrate line chart card.
   Fetches XmrRelayWS.fetchHashrate(range), renders via MPTimeSeries.draw,
   and wires a [7D][30D][1Y][ALL] range selector. */
(function (global) {
    'use strict';

    var RANGES = ['7d', '30d', '1y', 'all'];
    var LABELS = { '7d': '7D', '30d': '30D', '1y': '1Y', 'all': 'ALL' };

    function fmtHashrate(ghs) {
        var n = Number(ghs) || 0;
        if (n >= 1000) return (n / 1000).toFixed(2) + ' TH/s';
        if (n >= 1)    return n.toFixed(2) + ' GH/s';
        return (n * 1000).toFixed(1) + ' MH/s';
    }

    function fmtDate(range, ts) {
        var d = new Date(ts * 1000);
        if (range === '7d' || range === '30d') {
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
        return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    }

    function MempoolMiningHashrate() {
        this.container = null;
        this.ws = null;
        this.range = '7d';
        this.canvas = null;
        this.series = [];
        this._unsub = null;
    }

    MempoolMiningHashrate.prototype.init = function (ws, container) {
        this.ws = ws;
        this.container = container;
        this.renderShell();
        this.refresh();
        var self = this;
        if (global.MPChart && this.canvas) {
            this._unsub = global.MPChart.observeResize(this.canvas, function () { self.draw(); });
        }
    };

    MempoolMiningHashrate.prototype.renderShell = function () {
        var buttons = RANGES.map(function (r) {
            return '<button data-range="' + r + '">' + LABELS[r] + '</button>';
        }).join('');

        this.container.innerHTML =
            '<div class="mp-mining-card-head">' +
              '<h3 class="mp-mining-card-title">Network Hashrate</h3>' +
              '<div class="mp-mining-range" data-role="range">' + buttons + '</div>' +
            '</div>' +
            '<div class="mp-mining-card-sub" data-role="current">Current: —</div>' +
            '<canvas data-role="canvas"></canvas>';

        this.canvas = this.container.querySelector('[data-role="canvas"]');
        this.setActiveButton();

        var self = this;
        var rangeEl = this.container.querySelector('[data-role="range"]');
        rangeEl.addEventListener('click', function (ev) {
            var btn = ev.target.closest('button[data-range]');
            if (!btn) return;
            var r = btn.getAttribute('data-range');
            if (r === self.range) return;
            self.range = r;
            self.setActiveButton();
            self.refresh();
        });
    };

    MempoolMiningHashrate.prototype.setActiveButton = function () {
        var buttons = this.container.querySelectorAll('[data-role="range"] button');
        var self = this;
        buttons.forEach(function (b) {
            b.classList.toggle('active', b.getAttribute('data-range') === self.range);
        });
    };

    MempoolMiningHashrate.prototype.refresh = function () {
        if (!this.ws || !this.container) return Promise.resolve();
        var self = this;
        return this.ws.fetchHashrate(this.range).then(function (data) {
            var rows = Array.isArray(data) ? data : (data && data.series) || [];
            self.series = rows
                .filter(function (p) { return p && p.timestamp && (p.hashrate_ghs != null || p.difficulty != null); })
                .map(function (p) {
                    var ghs = p.hashrate_ghs != null
                        ? Number(p.hashrate_ghs)
                        : (Number(p.difficulty) || 0) / 120 / 1e9;
                    return { timestamp: p.timestamp, value: ghs || 0 };
                });
            self.draw();
        }).catch(function (err) {
            if (self.ws && self.ws.debug) console.warn('[mining-hashrate] fetch failed', err);
        });
    };

    MempoolMiningHashrate.prototype.draw = function () {
        if (!this.canvas || !this.series.length || !global.MPTimeSeries) return;
        var range = this.range;
        var color = (global.MPChart && global.MPChart.cssVar('--grn')) || '#00D395';
        var stats = global.MPTimeSeries.draw(this.canvas, this.series, {
            color: color,
            height: 200,
            fmtY: fmtHashrate,
            fmtX: function (ts) { return fmtDate(range, ts); }
        });
        var cur = this.container.querySelector('[data-role="current"]');
        if (cur && stats) cur.textContent = 'Current: ' + fmtHashrate(stats.last);
    };

    global.MempoolMiningHashrate = new MempoolMiningHashrate();
})(window);
