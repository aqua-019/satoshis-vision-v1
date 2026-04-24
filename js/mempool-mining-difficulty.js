/* mempool-mining-difficulty.js — M4 Task 17: difficulty history chart.
   Twin of the hashrate module (Task 16) with a different series + color
   and an LWMA-3 explainer footer. */
(function (global) {
    'use strict';

    var RANGES = ['7d', '30d', '1y', 'all'];
    var LABELS = { '7d': '7D', '30d': '30D', '1y': '1Y', 'all': 'ALL' };

    function fmtDifficulty(d) {
        var n = Number(d) || 0;
        if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
        if (n >= 1e9)  return (n / 1e9).toFixed(2)  + 'G';
        if (n >= 1e6)  return (n / 1e6).toFixed(1)  + 'M';
        if (n >= 1e3)  return (n / 1e3).toFixed(1)  + 'K';
        return '' + Math.round(n);
    }

    function fmtDate(range, ts) {
        var d = new Date(ts * 1000);
        if (range === '7d' || range === '30d') {
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
        return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    }

    function MempoolMiningDifficulty() {
        this.container = null;
        this.ws = null;
        this.range = '7d';
        this.canvas = null;
        this.series = [];
        this._unsub = null;
    }

    MempoolMiningDifficulty.prototype.init = function (ws, container) {
        this.ws = ws;
        this.container = container;
        this.renderShell();
        this.refresh();
        var self = this;
        if (global.MPChart && this.canvas) {
            this._unsub = global.MPChart.observeResize(this.canvas, function () { self.draw(); });
        }
    };

    MempoolMiningDifficulty.prototype.renderShell = function () {
        var buttons = RANGES.map(function (r) {
            return '<button data-range="' + r + '">' + LABELS[r] + '</button>';
        }).join('');

        this.container.innerHTML =
            '<div class="mp-mining-card-head">' +
              '<h3 class="mp-mining-card-title">Difficulty History</h3>' +
              '<div class="mp-mining-range" data-role="range">' + buttons + '</div>' +
            '</div>' +
            '<div class="mp-mining-card-sub" data-role="current">Current: —</div>' +
            '<canvas data-role="canvas"></canvas>' +
            '<p class="mp-mining-card-sub" style="margin-top:10px">' +
              "Monero retargets every block via LWMA-3 (vs Bitcoin's 2016-block cycle)" +
            '</p>';

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

    MempoolMiningDifficulty.prototype.setActiveButton = function () {
        var buttons = this.container.querySelectorAll('[data-role="range"] button');
        var self = this;
        buttons.forEach(function (b) {
            b.classList.toggle('active', b.getAttribute('data-range') === self.range);
        });
    };

    MempoolMiningDifficulty.prototype.refresh = function () {
        if (!this.ws || !this.container) return Promise.resolve();
        var self = this;
        return this.ws.fetchDifficulty(this.range).then(function (data) {
            var rows = Array.isArray(data) ? data : (data && data.series) || [];
            self.series = rows
                .filter(function (p) { return p && p.timestamp && p.difficulty != null; })
                .map(function (p) { return { timestamp: p.timestamp, value: Number(p.difficulty) || 0 }; });
            self.draw();
        }).catch(function (err) {
            if (self.ws && self.ws.debug) console.warn('[mining-difficulty] fetch failed', err);
        });
    };

    MempoolMiningDifficulty.prototype.draw = function () {
        if (!this.canvas || !this.series.length || !global.MPTimeSeries) return;
        var range = this.range;
        var color = (global.MPChart && global.MPChart.cssVar('--xmr')) || '#FF6600';
        var stats = global.MPTimeSeries.draw(this.canvas, this.series, {
            color: color,
            height: 200,
            fmtY: fmtDifficulty,
            fmtX: function (ts) { return fmtDate(range, ts); }
        });
        var cur = this.container.querySelector('[data-role="current"]');
        if (cur && stats) cur.textContent = 'Current: ' + fmtDifficulty(stats.last);
    };

    global.MempoolMiningDifficulty = new MempoolMiningDifficulty();
})(window);
