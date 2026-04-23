/* mempool-mining-emission.js — M4 Task 19a: emission curve skeleton.
   Renders the header stats, grid, axes, and gradient-filled supply curve
   from data.curve_points. Annotations (tail marker, TODAY dot, projection
   dash) land in Task 19b. */
(function (global) {
    'use strict';

    var MAX_HEIGHT = 6e6;
    var MAX_SUPPLY = 26;        // million XMR on the Y axis
    var Y_TICKS    = [0, 5, 10, 15, 20, 25];
    var X_TICKS    = [0, 1e6, 2e6, 3e6, 4e6, 5e6, 6e6];

    function fmtBlockTick(h) {
        if (!h) return 'Gen';
        return (h / 1e6) + 'M';
    }

    function fmtMXmr(m) { return m ? m + 'M' : '0'; }

    function MempoolMiningEmission() {
        this.container = null;
        this.ws = null;
        this.data = null;
        this.canvas = null;
        this._unsub = null;
    }

    MempoolMiningEmission.prototype.init = function (ws, container) {
        this.ws = ws;
        this.container = container;
        this.renderShell();
        this.refresh();
        var self = this;
        if (global.MPChart && this.canvas) {
            this._unsub = global.MPChart.observeResize(this.canvas, function () { self.draw(); });
        }
    };

    MempoolMiningEmission.prototype.renderShell = function () {
        this.container.innerHTML =
            '<div class="mp-mining-card-head">' +
              '<h3 class="mp-mining-card-title">XMR Emission Curve — Monero-exclusive</h3>' +
            '</div>' +
            '<div class="stats" data-role="stats">' +
              '<span>Current supply: <b>—</b></span>' +
              '<span>Tail emission: <b>0.6 XMR / block (permanent)</b></span>' +
              '<span>Daily emission: <b>—</b></span>' +
              '<span>Annual inflation: <b>—</b></span>' +
            '</div>' +
            '<canvas data-role="canvas"></canvas>';

        this.canvas = this.container.querySelector('[data-role="canvas"]');
    };

    MempoolMiningEmission.prototype.refresh = function () {
        if (!this.ws || !this.container) return Promise.resolve();
        var self = this;
        return this.ws.fetchEmission().then(function (data) {
            self.data = data || null;
            self.updateStats();
            self.draw();
        }).catch(function (err) {
            if (self.ws && self.ws.debug) console.warn('[mining-emission] fetch failed', err);
        });
    };

    MempoolMiningEmission.prototype.updateStats = function () {
        var stats = this.container.querySelector('[data-role="stats"]');
        if (!stats || !this.data) return;
        var d = this.data;
        var supply = d.current_supply_xmr != null
            ? (Number(d.current_supply_xmr) / 1e6).toFixed(2) + 'M XMR'
            : '—';
        var daily = d.daily_emission_xmr != null
            ? Number(d.daily_emission_xmr).toFixed(0) + ' XMR/day'
            : '—';
        var inflation = d.annual_inflation_pct != null
            ? Number(d.annual_inflation_pct).toFixed(2) + '%'
            : '—';
        stats.innerHTML =
            '<span>Current supply: <b>' + supply + '</b></span>' +
            '<span>Tail emission: <b>0.6 XMR / block (permanent)</b></span>' +
            '<span>Daily emission: <b>' + daily + '</b></span>' +
            '<span>Annual inflation: <b>' + inflation + '</b></span>';
    };

    MempoolMiningEmission.prototype.draw = function () {
        if (!this.canvas || !this.data || !this.data.curve_points) return;
        var utils = global.MPChart;
        var setup = utils ? utils.setupCanvas(this.canvas, 260) : null;
        var ctx = setup ? setup.ctx : this.canvas.getContext('2d');
        var W = setup ? setup.W : this.canvas.clientWidth;
        var H = setup ? setup.H : 260;
        ctx.clearRect(0, 0, W, H);

        var pad = { t: 22, r: 20, b: 40, l: 62 };
        var cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;

        var xmr  = (utils && utils.cssVar('--xmr'))  || '#FF6600';
        var dim  = 'rgba(255,255,255,0.04)';
        var lbl  = 'rgba(255,255,255,0.30)';

        function px(h) { return pad.l + (Math.min(h, MAX_HEIGHT) / MAX_HEIGHT) * cW; }
        function py(m) { return pad.t + cH - (Math.min(m, MAX_SUPPLY) / MAX_SUPPLY) * cH; }

        ctx.strokeStyle = dim; ctx.lineWidth = 0.5;
        ctx.font = '9px "DM Mono", monospace';
        ctx.fillStyle = lbl; ctx.textAlign = 'right';
        for (var i = 0; i < Y_TICKS.length; i++) {
            var gy = py(Y_TICKS[i]);
            ctx.beginPath(); ctx.moveTo(pad.l, gy); ctx.lineTo(W - pad.r, gy); ctx.stroke();
            ctx.fillText(fmtMXmr(Y_TICKS[i]), pad.l - 6, gy + 3);
        }

        ctx.textAlign = 'center';
        for (var j = 0; j < X_TICKS.length; j++) {
            ctx.fillText(fmtBlockTick(X_TICKS[j]), px(X_TICKS[j]), H - pad.b + 14);
        }

        var pts = this.data.curve_points
            .slice()
            .sort(function (a, b) { return a.height - b.height; });

        ctx.beginPath();
        for (var k = 0; k < pts.length; k++) {
            var x = px(pts[k].height);
            var y = py((Number(pts[k].supply) || 0) / 1e6);
            if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = xmr;
        ctx.lineWidth = 1.8;
        ctx.stroke();

        ctx.lineTo(px(pts[pts.length - 1].height), pad.t + cH);
        ctx.lineTo(pad.l, pad.t + cH);
        ctx.closePath();
        var grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + cH);
        grad.addColorStop(0, 'rgba(242,104,34,0.25)');
        grad.addColorStop(1, 'rgba(242,104,34,0.02)');
        ctx.fillStyle = grad;
        ctx.fill();

        this.drawAnnotations(ctx, px, py);   // Task 19b no-op until extended
    };

    MempoolMiningEmission.prototype.drawAnnotations = function (/* ctx, px, py */) {
        /* Task 19b extends this with tail-emission marker, TODAY dot, projection. */
    };

    global.MempoolMiningEmission = new MempoolMiningEmission();
})(window);
