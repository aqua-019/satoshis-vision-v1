/* mempool-mining-blocktime.js — M4 Block Time Distribution.
   Fetches hashrate series, computes inter-block intervals, draws
   histogram with Poisson overlay. */
(function (global) {
    'use strict';

    var BUCKETS = [
        [0,30],[30,60],[60,90],[90,120],
        [120,150],[150,180],[180,240],[240,Infinity]
    ];
    var LABELS = ['0-30s','30-60s','60-90s','90-120s',
                  '120-150s','150-180s','180-240s','240s+'];
    var TARGET = 120;

    function bucketIndex(sec) {
        for (var i = 0; i < BUCKETS.length; i++) {
            if (sec >= BUCKETS[i][0] && (BUCKETS[i][1] === Infinity || sec < BUCKETS[i][1])) return i;
        }
        return BUCKETS.length - 1;
    }

    function midpoint(i) {
        var b = BUCKETS[i];
        if (b[1] === Infinity) return b[0] + 60;
        return (b[0] + b[1]) / 2;
    }

    function MempoolMiningBlocktime() {
        this.container = null;
        this.ws = null;
        this.canvas = null;
        this.intervals = [];
        this._drawn = false;
    }

    MempoolMiningBlocktime.prototype.init = function (ws, container) {
        this.ws = ws;
        this.container = container;
        this.renderShell();
        this.refresh();
    };

    MempoolMiningBlocktime.prototype.renderShell = function () {
        this.container.innerHTML =
            '<div class="mp-mining-card-head">' +
              '<h3 class="mp-mining-card-title">Block Time Distribution</h3>' +
              '<span class="mp-mining-card-sub" data-role="sub">Loading…</span>' +
            '</div>' +
            '<canvas data-role="canvas" style="width:100%;height:200px;display:block"></canvas>' +
            '<p class="mp-mining-card-sub" style="margin-top:10px">' +
              'Monero\'s 2-minute target is a Poisson process — most intervals cluster near ' +
              'the mean while long tails are normal. The orange curve shows the theoretical ' +
              'exponential distribution for lambda = 1/120s.' +
            '</p>';
        this.canvas = this.container.querySelector('[data-role="canvas"]');
    };

    MempoolMiningBlocktime.prototype.refresh = function () {
        var self = this;
        /* Direct fetch — bypasses WS state, works even when WS is offline */
        return fetch('/api/xmr/network/hashrate?range=7d', {
            headers: { accept: 'application/json' }
        })
        .then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
        })
        .then(function (data) {
            var rows = Array.isArray(data) ? data : [];
            rows = rows.filter(function (p) { return p && Number(p.timestamp) > 0; });
            rows.sort(function (a, b) { return Number(a.timestamp) - Number(b.timestamp); });
            var ivs = [];
            for (var i = 1; i < rows.length; i++) {
                var dt = Number(rows[i].timestamp) - Number(rows[i - 1].timestamp);
                /* Each sample covers ~2 blocks. Accept intervals up to 30 min */
                if (dt > 0 && dt < 1800) ivs.push(dt);
            }
            self.intervals = ivs;
            self.draw();
            var sub = self.container.querySelector('[data-role="sub"]');
            if (sub) {
                if (!ivs.length) {
                    sub.textContent = 'Awaiting data…';
                } else {
                    var avg = ivs.reduce(function (a, b) { return a + b; }, 0) / ivs.length;
                    sub.textContent = 'Avg: ' + avg.toFixed(1) + 's · Target: 120s · n=' + ivs.length;
                }
            }
        })
        .catch(function (err) {
            console.warn('[blocktime] fetch failed:', err);
        });
    };

    MempoolMiningBlocktime.prototype.draw = function () {
        if (!this.canvas) return;
        /* Force correct canvas dimensions — handle hidden parent */
        var parent = this.canvas.parentElement;
        var W = (parent && parent.clientWidth > 0) ? parent.clientWidth : 600;
        var H = 200;
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.canvas.width  = W * dpr;
        this.canvas.height = H * dpr;
        this.canvas.style.width  = W + 'px';
        this.canvas.style.height = H + 'px';
        var ctx = this.canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);

        if (!this.intervals.length) {
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.font = '11px "DM Mono",monospace';
            ctx.textAlign = 'center';
            ctx.fillText('No data yet', W / 2, H / 2);
            return;
        }

        var pad = { t: 16, r: 18, b: 36, l: 40 };
        var cW = W - pad.l - pad.r;
        var cH = H - pad.t - pad.b;

        var counts = BUCKETS.map(function () { return 0; });
        for (var i = 0; i < this.intervals.length; i++) {
            counts[bucketIndex(this.intervals[i])]++;
        }
        var maxCount = Math.max.apply(null, counts) || 1;

        /* Grid */
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 0.5;
        for (var g = 0; g <= 4; g++) {
            var gy = pad.t + (cH / 4) * g;
            ctx.beginPath(); ctx.moveTo(pad.l, gy); ctx.lineTo(W - pad.r, gy); ctx.stroke();
        }

        /* Bars */
        var bw = cW / BUCKETS.length;
        for (var b = 0; b < BUCKETS.length; b++) {
            var h = (counts[b] / maxCount) * cH;
            var x = pad.l + b * bw + 4;
            var w = bw - 8;
            var y = pad.t + cH - h;
            var isTarget = (BUCKETS[b][0] === 90 || BUCKETS[b][0] === 120);
            ctx.fillStyle = isTarget ? '#00D395' : 'rgba(255,255,255,0.06)';
            ctx.fillRect(x, y, w, h);
            ctx.strokeStyle = isTarget ? '#00D395' : 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, w, h);

            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.font = '8px "DM Mono",monospace';
            ctx.textAlign = 'center';
            ctx.fillText(LABELS[b], x + w / 2, pad.t + cH + 14);
            if (counts[b]) {
                ctx.fillStyle = isTarget ? '#00D395' : 'rgba(255,255,255,0.55)';
                ctx.fillText(counts[b], x + w / 2, y - 3);
            }
        }

        /* Poisson overlay curve */
        var lambda = 1 / TARGET;
        var peak = lambda;
        ctx.strokeStyle = 'rgba(255,102,0,0.7)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (var k = 0; k < BUCKETS.length; k++) {
            var t = midpoint(k);
            var density = lambda * Math.exp(-lambda * t);
            var yP = pad.t + cH - (density / peak) * cH;
            var xP = pad.l + k * bw + bw / 2;
            if (k === 0) ctx.moveTo(xP, yP); else ctx.lineTo(xP, yP);
        }
        ctx.stroke();

        this._drawn = true;
    };

    global.MempoolMiningBlocktime = new MempoolMiningBlocktime();
})(window);
