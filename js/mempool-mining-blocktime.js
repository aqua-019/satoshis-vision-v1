/* mempool-mining-blocktime.js — M4 Task 20: block-time distribution.
   Builds a histogram of the last N block intervals (derived from the
   hashrate series timestamps) and overlays the theoretical Poisson/
   exponential density with lambda = 1/120s for reference. */
(function (global) {
    'use strict';

    var BUCKETS = [
        [0,   30],  [30,  60],  [60,  90],  [90,  120],
        [120, 150], [150, 180], [180, 240], [240, Infinity]
    ];
    var LABELS = ['0-30s', '30-60s', '60-90s', '90-120s',
                  '120-150s', '150-180s', '180-240s', '240s+'];
    var TARGET = 120;

    function bucketIndex(sec) {
        for (var i = 0; i < BUCKETS.length; i++) {
            if (sec >= BUCKETS[i][0] && sec < BUCKETS[i][1]) return i;
        }
        return BUCKETS.length - 1;
    }

    function midpoint(i) {
        var b = BUCKETS[i];
        if (!isFinite(b[1])) return b[0] + 30;
        return (b[0] + b[1]) / 2;
    }

    function MempoolMiningBlocktime() {
        this.container = null;
        this.ws = null;
        this.canvas = null;
        this.intervals = [];
        this._unsub = null;
    }

    MempoolMiningBlocktime.prototype.init = function (ws, container) {
        this.ws = ws;
        this.container = container;
        this.renderShell();
        this.refresh();
        var self = this;
        if (global.MPChart && this.canvas) {
            this._unsub = global.MPChart.observeResize(this.canvas, function () { self.draw(); });
        }
    };

    MempoolMiningBlocktime.prototype.renderShell = function () {
        this.container.innerHTML =
            '<div class="mp-mining-card-head">' +
              '<h3 class="mp-mining-card-title">Block Time Distribution</h3>' +
              '<span class="mp-mining-card-sub" data-role="sub">Target: 120s</span>' +
            '</div>' +
            '<canvas data-role="canvas"></canvas>' +
            '<p class="mp-mining-card-sub" style="margin-top:10px">' +
              'Monero\'s 2-minute target is a Poisson process — most intervals cluster near ' +
              'the mean while long tails are normal. The orange curve shows the theoretical ' +
              'exponential distribution for lambda = 1/120s.' +
            '</p>';
        this.canvas = this.container.querySelector('[data-role="canvas"]');
    };

    MempoolMiningBlocktime.prototype.refresh = function () {
        if (!this.ws || !this.container) return Promise.resolve();
        var self = this;
        return this.ws.fetchHashrate('7d').then(function (data) {
            var rows = Array.isArray(data) ? data : (data && data.series) || [];
            rows = rows.filter(function (p) { return p && p.timestamp; });
            rows.sort(function (a, b) { return a.timestamp - b.timestamp; });
            var ivs = [];
            for (var i = 1; i < rows.length; i++) {
                var dt = rows[i].timestamp - rows[i - 1].timestamp;
                if (dt > 0 && dt < 3600) ivs.push(dt);
            }
            self.intervals = ivs;
            self.draw();
            var sub = self.container.querySelector('[data-role="sub"]');
            if (sub) {
                var avg = ivs.length
                    ? ivs.reduce(function (a, b) { return a + b; }, 0) / ivs.length
                    : 0;
                sub.textContent = 'Avg: ' + avg.toFixed(1) + 's · Target: 120s · n=' + ivs.length;
            }
        }).catch(function (err) {
            if (self.ws && self.ws.debug) console.warn('[mining-blocktime] fetch failed', err);
        });
    };

    MempoolMiningBlocktime.prototype.draw = function () {
        if (!this.canvas || !this.intervals.length) return;
        var utils = global.MPChart;
        var setup = utils ? utils.setupCanvas(this.canvas, 200) : null;
        var ctx = setup ? setup.ctx : this.canvas.getContext('2d');
        var W = setup ? setup.W : this.canvas.clientWidth;
        var H = setup ? setup.H : 200;
        ctx.clearRect(0, 0, W, H);

        var pad = { t: 16, r: 18, b: 36, l: 40 };
        var cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;

        var counts = BUCKETS.map(function () { return 0; });
        for (var i = 0; i < this.intervals.length; i++) {
            counts[bucketIndex(this.intervals[i])]++;
        }
        var maxCount = Math.max.apply(null, counts) || 1;

        var grn     = (utils && utils.cssVar('--grn'))        || '#00D395';
        var muted   = (utils && utils.cssVar('--surface-2'))  || '#1A1A1E';
        var border  = (utils && utils.cssVar('--border-default')) || '#2A2A32';
        var lblDim  = (utils && utils.cssVar('--text-tertiary'))  || '#70707A';

        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 0.5;
        for (var g = 0; g <= 4; g++) {
            var gy = pad.t + (cH / 4) * g;
            ctx.beginPath(); ctx.moveTo(pad.l, gy); ctx.lineTo(W - pad.r, gy); ctx.stroke();
        }

        var bw = cW / BUCKETS.length;
        for (var b = 0; b < BUCKETS.length; b++) {
            var h = (counts[b] / maxCount) * cH;
            var x = pad.l + b * bw + 4;
            var w = bw - 8;
            var y = pad.t + cH - h;
            var isTarget = (BUCKETS[b][0] === 90 || BUCKETS[b][0] === 120);
            ctx.fillStyle = isTarget ? grn : muted;
            ctx.fillRect(x, y, w, h);
            ctx.strokeStyle = isTarget ? grn : border;
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, w, h);

            ctx.fillStyle = lblDim;
            ctx.font = '8px "DM Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(LABELS[b], x + w / 2, pad.t + cH + 13);
            if (counts[b]) {
                ctx.fillStyle = isTarget ? grn : 'rgba(255,255,255,0.55)';
                ctx.fillText(counts[b], x + w / 2, y - 3);
            }
        }

        ctx.strokeStyle = 'rgba(255,104,34,0.75)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        var lambda = 1 / TARGET;
        var peak   = lambda;
        for (var k = 0; k < BUCKETS.length; k++) {
            var t = midpoint(k);
            var density = lambda * Math.exp(-lambda * t);
            var yP = pad.t + cH - (density / peak) * cH;
            var xP = pad.l + k * bw + bw / 2;
            if (k === 0) ctx.moveTo(xP, yP); else ctx.lineTo(xP, yP);
        }
        ctx.stroke();
    };

    global.MempoolMiningBlocktime = new MempoolMiningBlocktime();
})(window);
