/* FeeDepthChart — DOM-based labeled tier bars.
   Replaces the previous Canvas2D log-scale histogram, which users found hard
   to interpret. The new layout shows five named fee tiers, each as a
   horizontal bar whose width is the % of mempool weight in that tier:

      Low       ▓▓                                  3 txs · 4%   median 87 pcn/B
      Standard  ▓▓▓▓▓▓▓▓▓▓                         14 txs · 22%  median 220 pcn/B
      Priority  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                 18 txs · 38%  median 612 pcn/B
      Urgent    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓                      7 txs · 28%  median 2,840 pcn/B
      Express   ▓▓                                   1 tx  · 8%   median 8,200 pcn/B

   Data source: MempoolUpdatePayload.fee_histogram (FeeHistogramBucket[]) —
   server-side mapping uses the same five tiers (see api/xmr.js feeTier()). */
(function (global) {
    'use strict';
    var MO = global.MempoolOceanShared || (global.MempoolOceanShared = {});

    /* Display tiers — match the names users will see, computed from
       fee_rate_min so we can co-locate counts/medians by tier. The thresholds
       follow Monero's empirical tier boundaries (piconero/byte). */
    var TIERS = [
        { key: 'low',      label: 'Low',      max: 100,     hint: '< 100 pcn/B',   color: 'rgba(255,102,0,0.20)' },
        { key: 'standard', label: 'Standard', max: 300,     hint: '100–300',       color: 'rgba(255,102,0,0.40)' },
        { key: 'priority', label: 'Priority', max: 1000,    hint: '300–1k',        color: 'rgba(255,102,0,0.60)' },
        { key: 'urgent',   label: 'Urgent',   max: 5000,    hint: '1k–5k',         color: 'rgba(255,102,0,0.80)' },
        { key: 'express',  label: 'Express',  max: Infinity,hint: '> 5k',          color: 'rgba(255,102,0,1.00)' }
    ];

    function tierIndexFor(rate) {
        for (var i = 0; i < TIERS.length; i++) if (rate < TIERS[i].max) return i;
        return TIERS.length - 1;
    }

    function fmtBytes(b) {
        if (!isFinite(b) || b < 0) b = 0;
        if (b < 1024)         return b + ' B';
        if (b < 1024 * 1024)  return (b / 1024).toFixed(1) + ' KB';
        return (b / (1024 * 1024)).toFixed(2) + ' MB';
    }

    function FeeDepthChart(canvas /* legacy first arg */, opts) {
        /* The constructor still accepts a canvas for backwards compatibility
           with mempool-ocean.js; we render DOM siblings into its parent and
           hide the canvas itself. */
        this.canvas = canvas || null;
        this.host   = canvas ? (canvas.parentElement || canvas) : null;
        this.histogram = [];
        this.recentTxs = [];

        if (this.canvas) this.canvas.style.display = 'none';
        if (this.host) {
            /* Build the bar container once. Subsequent renders update widths
               and labels in place to avoid layout thrash. */
            var bars = document.createElement('div');
            bars.className = 'fee-depth-bars';
            bars.id = 'mp-depth-bars';
            this.host.appendChild(bars);
            this.bars = bars;
            this._injectCss();
        }
    }

    FeeDepthChart.prototype._injectCss = function () {
        if (document.getElementById('fee-depth-bars-css')) return;
        var s = document.createElement('style');
        s.id = 'fee-depth-bars-css';
        s.textContent = [
            '.fee-depth-bars{display:flex;flex-direction:column;gap:6px;padding:8px 0}',
            '.fee-depth-row{display:grid;grid-template-columns:80px 1fr auto;align-items:center;gap:10px;font-family:"DM Mono",monospace}',
            '.fee-depth-tier{font-size:11px;color:var(--text-secondary,#bbb);letter-spacing:.06em;text-transform:uppercase}',
            '.fee-depth-bar-wrap{position:relative;height:18px;background:rgba(255,255,255,0.04);border-radius:3px;overflow:hidden}',
            '.fee-depth-bar{position:absolute;top:0;left:0;height:100%;border-radius:3px;transition:width .35s ease,background .25s ease}',
            '.fee-depth-stats{font-size:10px;color:var(--text-tertiary,#888);white-space:nowrap;text-align:right;min-width:200px}',
            '.fee-depth-stats .fdr-count{color:var(--text-primary,#eee)}',
            '.fee-depth-stats .fdr-pct{color:var(--text-secondary,#bbb);margin:0 4px}',
            '.fee-depth-stats .fdr-median{color:var(--text-tertiary,#888)}',
            '.fee-depth-empty{padding:18px 4px;color:var(--text-tertiary,#888);font-size:11px;text-align:center}',
            '@media(max-width:640px){.fee-depth-row{grid-template-columns:64px 1fr;gap:6px}.fee-depth-stats{grid-column:1/3;text-align:left;min-width:0}}'
        ].join('\n');
        document.head.appendChild(s);
    };

    FeeDepthChart.prototype.setHistogram = function (hist) {
        this.histogram = Array.isArray(hist) ? hist : [];
        this.draw();
    };

    /* Optional: pass through recent_txs so we can compute a true median
       fee-rate per tier. Without it we fall back to the bucket midpoint. */
    FeeDepthChart.prototype.setRecentTxs = function (txs) {
        this.recentTxs = Array.isArray(txs) ? txs : [];
        this.draw();
    };

    FeeDepthChart.prototype.setFeeTiers = function (_t) { /* legacy no-op */ };

    FeeDepthChart.prototype._bucketize = function () {
        /* Re-bucket into our five display tiers. The server's fee_histogram
           uses keys (stuck/economy/normal/fast/priority) at coarser thresholds
           (1/5/20/80 pcn/B) which don't match user-facing labels. We rebuild
           from recent_txs when available; otherwise we map server buckets
           into our tiers as a best effort. */
        var buckets = TIERS.map(function (t) { return { tier: t, count: 0, weight: 0, rates: [] }; });

        if (this.recentTxs && this.recentTxs.length) {
            for (var i = 0; i < this.recentTxs.length; i++) {
                var tx = this.recentTxs[i];
                var rate = tx.fee_rate || 0;
                var idx = tierIndexFor(rate);
                buckets[idx].count += 1;
                buckets[idx].weight += (tx.blob_size || 0);
                buckets[idx].rates.push(rate);
            }
        } else if (this.histogram && this.histogram.length) {
            for (var j = 0; j < this.histogram.length; j++) {
                var b = this.histogram[j];
                var midRate = ((b.fee_rate_min || 0) + (isFinite(b.fee_rate_max) ? b.fee_rate_max : (b.fee_rate_min || 0) * 2)) / 2;
                var k = tierIndexFor(midRate);
                buckets[k].count += (b.tx_count || 0);
                buckets[k].weight += (b.bytes || 0);
                if (b.tx_count > 0) buckets[k].rates.push(midRate);
            }
        }

        return buckets;
    };

    FeeDepthChart.prototype.draw = function () {
        if (!this.bars) return;
        var buckets = this._bucketize();
        var totalWeight = 0;
        for (var i = 0; i < buckets.length; i++) totalWeight += buckets[i].weight;

        if (totalWeight <= 0) {
            this.bars.innerHTML = '<div class="fee-depth-empty">Mempool is empty.</div>';
            return;
        }

        var html = '';
        for (var b = 0; b < buckets.length; b++) {
            var bk = buckets[b];
            var pct = totalWeight > 0 ? (bk.weight / totalWeight * 100) : 0;
            bk.rates.sort(function (a, b) { return a - b; });
            var median = bk.rates.length ? bk.rates[Math.floor(bk.rates.length / 2)] : 0;
            var medianStr = median > 0 ? Math.round(median).toLocaleString() : '—';
            var widthCss = pct > 0 ? Math.max(1, pct).toFixed(1) + '%' : '0';
            var title = bk.tier.label + ' tier (' + bk.tier.hint + ' pcn/B) · ' +
                bk.count + ' tx · ' + fmtBytes(bk.weight) + ' · median ' + medianStr + ' pcn/B';

            html +=
                '<div class="fee-depth-row" title="' + title.replace(/"/g, '&quot;') + '">' +
                  '<div class="fee-depth-tier">' + bk.tier.label + '</div>' +
                  '<div class="fee-depth-bar-wrap">' +
                    '<div class="fee-depth-bar" style="width:' + widthCss + ';background:' + bk.tier.color + '"></div>' +
                  '</div>' +
                  '<div class="fee-depth-stats">' +
                    '<span class="fdr-count">' + bk.count + ' tx' + (bk.count === 1 ? '' : 's') + '</span>' +
                    '<span class="fdr-pct">· ' + pct.toFixed(0) + '%</span>' +
                    '<span class="fdr-median">median ' + medianStr + ' pcn/B</span>' +
                  '</div>' +
                '</div>';
        }
        this.bars.innerHTML = html;
    };

    FeeDepthChart.prototype.destroy = function () {
        if (this.bars && this.bars.parentNode) {
            try { this.bars.parentNode.removeChild(this.bars); } catch (_) {}
        }
        this.bars = null;
    };

    MO.FeeDepthChart = FeeDepthChart;
})(window);
