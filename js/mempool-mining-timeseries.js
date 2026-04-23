/* mempool-mining-timeseries.js — M4 Task 15: shared Canvas 2D line chart.
   Consumed by the hashrate (Task 16) and difficulty (Task 17) cards.
   Pattern mirrors markets.html drawC(): DPR setup, 5-line grid, dashed
   average, gradient fill under the curve, current-value dot + label.
   Returns {min,max,avg,last} so callers can render stat rows. */
(function (global) {
    'use strict';

    function hexRgb(hex) {
        hex = (hex || '#ffffff').replace('#', '');
        if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
        var n = parseInt(hex, 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }

    function defaultFmt(v) { return (Math.round(v * 100) / 100) + ''; }
    function defaultDate(ts) {
        var d = new Date(ts * 1000);
        return (d.getMonth() + 1) + '/' + d.getDate();
    }

    function draw(canvas, series, opts) {
        if (!canvas || !series || !series.length) return null;
        opts = opts || {};
        var utils = global.MPChart;
        var setup = utils
            ? utils.setupCanvas(canvas, opts.height || 200)
            : (function () {
                var dpr = Math.min(global.devicePixelRatio || 1, 2);
                var W = canvas.clientWidth || canvas.parentElement.clientWidth || 600;
                var H = opts.height || 200;
                canvas.width = W * dpr; canvas.height = H * dpr;
                canvas.style.height = H + 'px';
                var ctx = canvas.getContext('2d');
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                return { ctx: ctx, W: W, H: H, dpr: dpr };
            })();

        var ctx = setup.ctx, W = setup.W, H = setup.H;
        ctx.clearRect(0, 0, W, H);

        var pad = { t: 20, r: 20, b: 32, l: 58 };
        var cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;
        var values = series.map(function (p) { return p.value; });
        var mn = Math.min.apply(null, values), mx = Math.max.apply(null, values);
        var rng = mx - mn; if (!rng) rng = (Math.abs(mx) * 0.01) || 1;
        var avg = values.reduce(function (a, b) { return a + b; }, 0) / values.length;
        var fmtY = opts.fmtY || defaultFmt;
        var fmtX = opts.fmtX || defaultDate;
        var color = opts.color || '#FF6600';
        var rgb = hexRgb(color);

        function yPix(v) { return pad.t + cH - ((v - mn) / rng) * cH; }
        function xPix(i) { return pad.l + (i / (series.length - 1)) * cW; }

        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 0.5;
        ctx.font = '9px "DM Mono", monospace';
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        for (var g = 0; g <= 5; g++) {
            var gv = mn + (rng * g / 5);
            var gy = yPix(gv);
            ctx.beginPath(); ctx.moveTo(pad.l, gy); ctx.lineTo(W - pad.r, gy); ctx.stroke();
            ctx.fillText(fmtY(gv), pad.l - 6, gy + 3);
        }

        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(255,255,255,0.10)';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(pad.l, yPix(avg)); ctx.lineTo(W - pad.r, yPix(avg)); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.textAlign = 'left'; ctx.font = '8px "DM Mono", monospace';
        ctx.fillText('avg ' + fmtY(avg), W - pad.r - 80, yPix(avg) - 3);

        ctx.textAlign = 'center';
        ctx.font = '8px "DM Mono", monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        var ticks = Math.min(6, Math.floor(cW / 80));
        for (var i = 0; i <= ticks; i++) {
            var idx = Math.floor((i / ticks) * (series.length - 1));
            ctx.fillText(fmtX(series[idx].timestamp), xPix(idx), H - 8);
        }

        ctx.beginPath();
        for (var j = 0; j < series.length; j++) {
            var x = xPix(j), y = yPix(series[j].value);
            if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.8;
        ctx.stroke();

        ctx.lineTo(xPix(series.length - 1), pad.t + cH);
        ctx.lineTo(pad.l, pad.t + cH);
        ctx.closePath();
        var grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + cH);
        grad.addColorStop(0, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0.18)');
        grad.addColorStop(1, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0)');
        ctx.fillStyle = grad;
        ctx.fill();

        var last = series[series.length - 1];
        var lx = xPix(series.length - 1), ly = yPix(last.value);
        ctx.beginPath(); ctx.arc(lx, ly, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.fill();

        ctx.font = '9px "DM Mono", monospace';
        ctx.fillStyle = color;
        ctx.textAlign = 'right';
        ctx.fillText('CURRENT ' + fmtY(last.value), W - pad.r, pad.t + 2);

        return { min: mn, max: mx, avg: avg, last: last.value };
    }

    global.MPTimeSeries = { draw: draw };
})(window);
