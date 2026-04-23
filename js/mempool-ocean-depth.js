/* FeeDepthChart — Canvas 2D horizontal bar chart.
   Y-axis: fee rate (piconero/byte, log scale).
   X-axis: cumulative bytes at that fee rate.
   Colored by tier. Tier threshold markers as dashed vertical lines.
   Data source: MempoolUpdatePayload.fee_histogram  (FeeHistogramBucket[]). */
(function (global) {
    'use strict';
    var MO = global.MempoolOceanShared || (global.MempoolOceanShared = {});

    function FeeDepthChart(canvas, opts) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.reduced = !!(opts && opts.reducedMotion);
        this.histogram = [];
        this.feeTiers = null;  // from FeeUpdatePayload {tiers, recommended, timestamp}
        this._resize();
        var self = this;
        this._ro = ('ResizeObserver' in global) ? new ResizeObserver(function () { self._resize(); self.draw(); }) : null;
        if (this._ro) this._ro.observe(canvas);
        else global.addEventListener('resize', function () { self._resize(); self.draw(); });
    }

    FeeDepthChart.prototype._resize = function () {
        var dpr = Math.min(global.devicePixelRatio || 1, 2);
        var c = this.canvas;
        var w = c.clientWidth || 800;
        var h = c.clientHeight || 240;
        c.width = w * dpr;
        c.height = h * dpr;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.w = w;
        this.h = h;
    };

    FeeDepthChart.prototype.setHistogram = function (hist) {
        this.histogram = Array.isArray(hist) ? hist : [];
        this.draw();
    };

    FeeDepthChart.prototype.setFeeTiers = function (t) {
        this.feeTiers = t; // {tiers:[slow,normal,fast,fastest], recommended}
        this.draw();
    };

    FeeDepthChart.prototype.draw = function () {
        var ctx = this.ctx, w = this.w, h = this.h;
        ctx.clearRect(0, 0, w, h);

        // Chart padding
        var padL = 44, padR = 14, padT = 14, padB = 22;
        var cw = w - padL - padR;
        var ch = h - padT - padB;

        // Background grid
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        for (var gy = 0; gy <= 4; gy++) {
            var y = padT + (ch / 4) * gy;
            ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + cw, y); ctx.stroke();
        }

        // Y-axis: log scale 0.1 → 200 p/B
        var yMin = 0.1, yMax = 200;
        var ylog = function (r) {
            var clamped = Math.max(yMin, Math.min(yMax, r || yMin));
            var t = (Math.log(clamped) - Math.log(yMin)) / (Math.log(yMax) - Math.log(yMin));
            return padT + ch - t * ch;
        };

        // Y-axis labels
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.font = '10px "DM Mono", monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        var yTicks = [0.1, 1, 5, 20, 80, 200];
        for (var i = 0; i < yTicks.length; i++) {
            ctx.fillText(yTicks[i] + '', padL - 6, ylog(yTicks[i]));
        }

        // X-axis max = sum of bucket bytes
        var totalBytes = 0;
        for (var k = 0; k < this.histogram.length; k++) totalBytes += (this.histogram[k].bytes || 0);
        if (totalBytes < 1) totalBytes = 1;

        // Draw bars: one row per bucket, x=cumulative bytes fraction, y=avg fee_rate.
        // Sort by fee_rate_min ascending so highest-rate sits top.
        var buckets = this.histogram.slice().sort(function (a, b) {
            return (a.fee_rate_min || 0) - (b.fee_rate_min || 0);
        });
        var cum = 0;
        for (var b = 0; b < buckets.length; b++) {
            var buck = buckets[b];
            var wfrac = (buck.bytes || 0) / totalBytes;
            var barX = padL + (cum / totalBytes) * cw;
            var barW = Math.max(1, wfrac * cw);
            var yLo = ylog(buck.fee_rate_min || yMin);
            var yHi = ylog(buck.fee_rate_max || buck.fee_rate_min || yMin);
            var barY = Math.min(yLo, yHi);
            var barH = Math.max(1.5, Math.abs(yLo - yHi));
            ctx.fillStyle = buck.color || 'rgba(0,201,122,0.6)';
            ctx.globalAlpha = 0.8;
            ctx.fillRect(barX, barY, barW, barH);
            cum += (buck.bytes || 0);
        }
        ctx.globalAlpha = 1;

        // Vertical dashed lines at tier thresholds (from XmrRelayWS.FEE_TIERS).
        var tiers = window.XmrRelayWS.FEE_TIERS;
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1;
        for (var t = 0; t < tiers.length; t++) {
            var tier = tiers[t];
            if (!isFinite(tier.max)) continue;
            var y = ylog(tier.max);
            ctx.strokeStyle = tier.color + '99';
            ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + cw, y); ctx.stroke();
        }
        ctx.restore();

        // X-axis label
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.textAlign = 'left';
        ctx.fillText('0', padL, padT + ch + 10);
        ctx.textAlign = 'right';
        ctx.fillText(MO.fmt.bytes(totalBytes), padL + cw, padT + ch + 10);
        ctx.textAlign = 'center';
        ctx.fillText('cumulative bytes', padL + cw / 2, padT + ch + 10);
    };

    FeeDepthChart.prototype.destroy = function () {
        if (this._ro) { try { this._ro.disconnect(); } catch (_) {} this._ro = null; }
    };

    MO.FeeDepthChart = FeeDepthChart;
})(window);
