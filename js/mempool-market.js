/* ═══════════════════════════════════════════════════════════════
   Mempool 3.0 — MARKET mode
   - Fee depth chart (cumulative distribution)
   - Stat triplet (median fee / confirmed-10blk / pool size)
   - Fee histogram (30 buckets)
   - Fee estimator (1/3/10 block targets)
   - Block history table (last 10 blocks)
   ═══════════════════════════════════════════════════════════════ */

(function (global) {
    'use strict';

    var TYPICAL_TX_KB = 1.5; // typical Monero tx size (~1.5 kB)
    var currentTarget = 1;

    function $(id) { return document.getElementById(id); }

    function fitCanvas(canvas) {
        if (!canvas) return null;
        var dpr = Math.min(global.devicePixelRatio || 1, 2);
        var w = canvas.clientWidth, h = canvas.clientHeight;
        if (!w || !h) return null;
        canvas.width = w * dpr; canvas.height = h * dpr;
        var ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return { ctx: ctx, w: w, h: h };
    }

    function fmtFee(n) { return n ? n.toFixed(6) : '—'; }
    function fmtCost(n) { return n ? (n * TYPICAL_TX_KB).toFixed(6) : '—'; }

    /* ─── 1. Depth chart ─── */
    function renderDepth(hist) {
        var canvas = $('fee-depth-chart');
        var pen = fitCanvas(canvas);
        if (!pen) return;
        var ctx = pen.ctx, W = pen.w, H = pen.h;
        ctx.clearRect(0, 0, W, H);

        var pad = { l: 50, r: 12, t: 14, b: 26 };
        var pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;

        // grid
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 0.5;
        for (var g = 0; g <= 4; g++) {
            var gy = pad.t + (ph * g / 4);
            ctx.beginPath(); ctx.moveTo(pad.l, gy); ctx.lineTo(W - pad.r, gy); ctx.stroke();
        }

        if (!hist || !hist.length) {
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            ctx.font = '10px monospace'; ctx.textAlign = 'center';
            ctx.fillText('—', W / 2, H / 2);
            return;
        }

        var total = 0;
        for (var i = 0; i < hist.length; i++) total += hist[i].txCount;
        var maxRate = hist[hist.length - 1].feeRate || 1;

        // build cumulative points
        var cumul = 0, pts = [];
        for (var k = 0; k < hist.length; k++) {
            cumul += hist[k].txCount;
            pts.push({ r: hist[k].feeRate, p: cumul / total });
        }

        // filled area
        ctx.beginPath();
        ctx.moveTo(pad.l, pad.t + ph);
        for (var p = 0; p < pts.length; p++) {
            var px = pad.l + (pts[p].r / maxRate) * pw;
            var py = pad.t + ph - (pts[p].p * ph);
            ctx.lineTo(px, py);
        }
        ctx.lineTo(pad.l + pw, pad.t + ph);
        ctx.closePath();
        var grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ph);
        grad.addColorStop(0, 'rgba(255,102,0,0.22)');
        grad.addColorStop(1, 'rgba(255,102,0,0.02)');
        ctx.fillStyle = grad; ctx.fill();

        // line
        ctx.beginPath();
        for (var q = 0; q < pts.length; q++) {
            var qx = pad.l + (pts[q].r / maxRate) * pw;
            var qy = pad.t + ph - (pts[q].p * ph);
            q === 0 ? ctx.moveTo(qx, qy) : ctx.lineTo(qx, qy);
        }
        ctx.strokeStyle = '#FF6600'; ctx.lineWidth = 1.6; ctx.stroke();

        // next-block threshold
        var bands = (global.MempoolData && global.MempoolData.fee_bands) || {};
        var th = bands.economy || 0;
        if (th > 0 && th <= maxRate) {
            var tx = pad.l + (th / maxRate) * pw;
            ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.moveTo(tx, pad.t); ctx.lineTo(tx, pad.t + ph);
            ctx.strokeStyle = '#00CC88'; ctx.lineWidth = 1; ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = '#00CC88'; ctx.font = '9px monospace'; ctx.textAlign = 'left';
            ctx.fillText('next-blk threshold', tx + 4, pad.t + 10);
        }

        // y-axis labels (0%, 50%, 100%)
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '8px monospace'; ctx.textAlign = 'right';
        ctx.fillText('100%', pad.l - 4, pad.t + 4);
        ctx.fillText('50%', pad.l - 4, pad.t + ph / 2);
        ctx.fillText('0%', pad.l - 4, pad.t + ph);

        // x-axis labels (min/max fee rate)
        ctx.textAlign = 'left';
        ctx.fillText(fmtFee(pts[0].r) + ' XMR/kB', pad.l, H - 6);
        ctx.textAlign = 'right';
        ctx.fillText(fmtFee(maxRate) + ' XMR/kB', W - pad.r, H - 6);

        var sub = $('mk-depth-sub');
        if (sub) sub.textContent = total + ' tx · ' + hist.length + ' rates';
    }

    /* ─── 2. Histogram ─── */
    function renderHistogram(hist) {
        var canvas = $('fee-histogram');
        var pen = fitCanvas(canvas);
        if (!pen) return;
        var ctx = pen.ctx, W = pen.w, H = pen.h;
        ctx.clearRect(0, 0, W, H);

        if (!hist || !hist.length) return;

        var maxRate = hist[hist.length - 1].feeRate || 1;
        var buckets = new Array(30).fill(0);
        for (var i = 0; i < hist.length; i++) {
            var idx = Math.min(29, Math.floor((hist[i].feeRate / maxRate) * 30));
            buckets[idx] += hist[i].txCount;
        }
        var maxC = Math.max.apply(null, buckets) || 1;
        var barW = W / 30;
        var bottomPad = 16, topPad = 6;
        var avail = H - topPad - bottomPad;

        for (var j = 0; j < 30; j++) {
            var bh = (buckets[j] / maxC) * avail;
            var fill;
            if (j < 10) fill = 'rgba(0,204,136,' + (0.4 + (j / 10) * 0.5) + ')';
            else if (j < 20) fill = 'rgba(68,136,255,' + (0.35 + ((j - 10) / 10) * 0.55) + ')';
            else fill = 'rgba(255,102,0,' + (0.4 + ((j - 20) / 10) * 0.55) + ')';
            ctx.fillStyle = fill;
            ctx.fillRect(j * barW, H - bottomPad - bh, barW - 1, bh);
        }

        // baseline
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.beginPath();
        ctx.moveTo(0, H - bottomPad); ctx.lineTo(W, H - bottomPad); ctx.stroke();

        // band markers
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '8px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('economy', 4, H - 4);
        ctx.textAlign = 'center';
        ctx.fillText('standard', W / 2, H - 4);
        ctx.textAlign = 'right';
        ctx.fillText('priority', W - 4, H - 4);
    }

    /* ─── 3. Stat triplet ─── */
    function renderStats() {
        var bands = (global.MempoolData && global.MempoolData.fee_bands) || {};
        var blocks = (global.MempoolData && global.MempoolData.block_history) || [];
        var pool = (global.MempoolData && global.MempoolData.latest_pool) || [];
        var sumTx = 0;
        for (var i = 0; i < blocks.length; i++) sumTx += blocks[i].txCount;

        var m = $('stat-median-fee'); if (m) m.textContent = fmtFee(bands.standard);
        var c = $('stat-confirmed-10blk'); if (c) c.textContent = sumTx;
        var p = $('stat-pool-size'); if (p) p.textContent = pool.length;
    }

    /* ─── 4. Estimator ─── */
    function recommendRate(target) {
        var bands = (global.MempoolData && global.MempoolData.fee_bands) || {};
        if (target <= 1) return bands.priority;
        if (target <= 3) return bands.standard;
        return bands.economy;
    }
    function renderEstimator() {
        var rate = recommendRate(currentTarget);
        var r = $('est-fee-rate'); if (r) r.textContent = fmtFee(rate);
        var c = $('est-fee-cost'); if (c) c.textContent = fmtCost(rate);
    }
    function bindEstimatorButtons() {
        var btns = document.querySelectorAll('.est-btn[data-target]');
        for (var i = 0; i < btns.length; i++) {
            (function (b) {
                b.addEventListener('click', function () {
                    currentTarget = parseInt(b.getAttribute('data-target'), 10) || 1;
                    for (var k = 0; k < btns.length; k++) btns[k].classList.remove('active');
                    b.classList.add('active');
                    renderEstimator();
                });
            })(btns[i]);
        }
    }

    /* ─── 5. Block history table ─── */
    function fillClass(p) {
        if (p < 70) return 'bh-fill-g';
        if (p < 85) return 'bh-fill-y';
        return 'bh-fill-r';
    }
    function renderBlockHistory(rows) {
        var body = $('block-history-body');
        if (!body) return;
        if (!rows || !rows.length) { body.innerHTML = ''; return; }
        var html = '';
        for (var i = 0; i < rows.length; i++) {
            var b = rows[i];
            html += '<div class="bh-row">' +
                '<span class="bh-h">#' + b.height.toLocaleString() + '</span>' +
                '<span>' + b.txCount + '</span>' +
                '<span>' + fmtFee(b.medianFee) + '</span>' +
                '<span>' + fmtFee(b.minFeeConfirmed) + '</span>' +
                '<span class="' + fillClass(b.fillPct) + '">' + b.fillPct + '%</span>' +
                '</div>';
        }
        body.innerHTML = html;
    }

    /* ─── boot ─── */
    function boot() {
        bindEstimatorButtons();
        renderEstimator();

        if (global.MempoolData) {
            global.MempoolData.subscribe('fee_histogram', function (h) {
                renderDepth(h);
                renderHistogram(h);
                renderStats();
                renderEstimator();
            });
            global.MempoolData.subscribe('block_history', function (rows) {
                renderBlockHistory(rows);
                renderStats();
            });
            global.MempoolData.subscribe('bands', function () {
                renderEstimator();
                renderStats();
            });
        }

        global.addEventListener('resize', function () {
            if (global.MempoolData) {
                renderDepth(global.MempoolData.fee_histogram);
                renderHistogram(global.MempoolData.fee_histogram);
            }
        });

        if (global.Mempool) {
            global.Mempool.register('market', {
                onEnter: function () {
                    setTimeout(function () {
                        if (global.MempoolData) {
                            renderDepth(global.MempoolData.fee_histogram);
                            renderHistogram(global.MempoolData.fee_histogram);
                            renderBlockHistory(global.MempoolData.block_history);
                            renderStats();
                        }
                    }, 50);
                }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})(window);
