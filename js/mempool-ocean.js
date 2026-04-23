/* ═══════════════════════════════════════════════════════════════
   Mempool 3.0 — OCEAN mode add-ons
   Reuses the inline particle ocean (mempool.html). Adds:
   - 30-segment fee heatmap strip (above ocean)
   - 24h congestion sparkline
   - 24h mempool clock (radial)
   - Privacy density meter (Ring-16 share)
   - Block formation preview (right edge of ocean)
   Z-depth on existing particles is patched into MoneroNetwork's
   pool subscriber by augmenting particle objects directly.
   ═══════════════════════════════════════════════════════════════ */

(function (global) {
    'use strict';

    var REDUCED_MOTION = global.matchMedia &&
        global.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function $(id) { return document.getElementById(id); }

    /* ─── DPR-aware canvas sizing ─── */
    function fitCanvas(canvas) {
        if (!canvas) return null;
        var dpr = Math.min(global.devicePixelRatio || 1, 2);
        var w = canvas.clientWidth, h = canvas.clientHeight;
        canvas.width = w * dpr; canvas.height = h * dpr;
        var ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return { ctx: ctx, w: w, h: h };
    }

    /* ─── 1. Fee heatmap strip ─── */
    var heatmapBuilt = false;
    function renderHeatmap(hist, bands) {
        var bar = $('fee-heatmap-bar');
        if (!bar) return;
        if (!heatmapBuilt) {
            bar.innerHTML = '';
            for (var i = 0; i < 30; i++) {
                var s = document.createElement('div');
                s.className = 'seg';
                bar.appendChild(s);
            }
            heatmapBuilt = true;
        }
        if (!hist || !hist.length) return;
        var maxRate = hist[hist.length - 1].feeRate || 1;
        // bucket counts into 30 equal-width bands
        var counts = new Array(30).fill(0);
        for (var k = 0; k < hist.length; k++) {
            var idx = Math.min(29, Math.floor((hist[k].feeRate / maxRate) * 30));
            counts[idx] += hist[k].txCount;
        }
        var maxCount = Math.max.apply(null, counts) || 1;
        var segs = bar.children;
        for (var j = 0; j < 30; j++) {
            var w = counts[j] / maxCount;
            var color;
            if (j < 10) {
                color = 'rgba(0,204,136,' + (0.25 + w * 0.7) + ')';
            } else if (j < 20) {
                color = 'rgba(255,215,0,' + (0.25 + w * 0.7) + ')';
            } else {
                color = 'rgba(255,102,0,' + (0.25 + w * 0.7) + ')';
            }
            segs[j].style.background = color;
        }

        var fmt = function (n) { return n ? n.toFixed(6) : '—'; };
        if (bands) {
            var e = $('fee-economy'); if (e) e.textContent = fmt(bands.economy);
            var s = $('fee-standard'); if (s) s.textContent = fmt(bands.standard);
            var p = $('fee-priority'); if (p) p.textContent = fmt(bands.priority);
        }
    }

    /* ─── 2. 24h congestion sparkline ─── */
    function renderSparkline(history) {
        var canvas = $('cong-spark-canvas');
        if (!canvas) return;
        var pen = fitCanvas(canvas);
        if (!pen) return;
        var ctx = pen.ctx, W = pen.w, H = pen.h;
        ctx.clearRect(0, 0, W, H);

        if (!history || history.length < 2) return;

        var minV = Infinity, maxV = -Infinity;
        for (var i = 0; i < history.length; i++) {
            if (history[i].n < minV) minV = history[i].n;
            if (history[i].n > maxV) maxV = history[i].n;
        }
        if (maxV === minV) maxV = minV + 1;

        ctx.beginPath();
        for (var k = 0; k < history.length; k++) {
            var x = (k / (history.length - 1)) * W;
            var y = H - ((history[k].n - minV) / (maxV - minV)) * (H - 4) - 2;
            k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = 'rgba(255,102,0,0.65)';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        // gradient under-fill
        ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
        var grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, 'rgba(255,102,0,0.18)');
        grad.addColorStop(1, 'rgba(255,102,0,0)');
        ctx.fillStyle = grad; ctx.fill();

        var ct = $('cong-spark-ct');
        if (ct) ct.textContent = history[history.length - 1].n + ' tx';
    }

    /* ─── 3. Mempool clock (radial 24h) ─── */
    function renderClock(hourly) {
        var canvas = $('mempool-clock');
        if (!canvas) return;
        var pen = fitCanvas(canvas);
        if (!pen) return;
        var ctx = pen.ctx, W = pen.w, H = pen.h;
        ctx.clearRect(0, 0, W, H);

        var cx = W / 2, cy = H / 2;
        var maxR = Math.min(cx, cy) - 18;
        var minR = maxR * 0.4;
        var maxV = Math.max.apply(null, hourly || [0]) || 1;
        var anyData = (hourly || []).some(function (v) { return v > 0; });

        // backdrop ring
        ctx.beginPath();
        ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1; ctx.stroke();

        if (!anyData) {
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            ctx.font = '9px monospace';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('—', cx, cy);
            return;
        }

        for (var hr = 0; hr < 24; hr++) {
            var v = hourly[hr] || 0;
            var ang = (hr / 24) * Math.PI * 2 - Math.PI / 2;
            var r = minR + (v / maxV) * (maxR - minR);
            var intensity = v / maxV;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, r, ang, ang + (Math.PI * 2 / 24) - 0.025);
            ctx.closePath();
            ctx.fillStyle = 'rgba(255,' + Math.floor(102 + intensity * 100) + ',0,' + (0.25 + intensity * 0.55) + ')';
            ctx.fill();
        }

        // hour ticks
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        var labels = [['00', 0], ['06', 6], ['12', 12], ['18', 18]];
        for (var t = 0; t < labels.length; t++) {
            var lAng = (labels[t][1] / 24) * Math.PI * 2 - Math.PI / 2;
            var lx = cx + Math.cos(lAng) * (maxR + 8);
            var ly = cy + Math.sin(lAng) * (maxR + 8);
            ctx.fillText(labels[t][0], lx, ly);
        }
    }

    /* ─── 4. Privacy density meter (Ring-16 share is 100% post-v17) ─── */
    function renderDensity() {
        var pct = $('ring16-pct');
        var fill = $('density-fill');
        if (pct) pct.textContent = '100%';
        if (fill) fill.style.width = '100%';
    }

    /* ─── 5. Block formation preview ─── */
    var blockFormShown = false;
    var lastBlockTs = 0;
    function checkBlockFormation() {
        var el = $('block-form');
        if (!el) return;
        var blocks = (global.MoneroNetwork && global.MoneroNetwork.blocks) || [];
        if (!blocks.length) return;
        var newest = blocks[0];
        if (lastBlockTs && newest.timestamp > lastBlockTs) {
            el.classList.add('flash');
            setTimeout(function () { el.classList.remove('flash', 'vis'); blockFormShown = false; }, 500);
        }
        lastBlockTs = newest.timestamp;
        var sinceLast = (Date.now() / 1000) - newest.timestamp;
        var eta = 120 - sinceLast; // ~2 min target
        if (eta < 30 && eta > 0) {
            if (!blockFormShown) { el.classList.add('vis'); blockFormShown = true; }
        } else {
            if (blockFormShown) { el.classList.remove('vis'); blockFormShown = false; }
        }
    }

    /* ─── 6. Z-depth on existing particles ───
       The inline syncOceanToPool sets s, c, f. We can't easily patch the
       drawOcean loop, but we CAN visually approximate Z-depth by
       remapping each particle's size after sync: high-fee particles get
       slightly larger (closer), low-fee slightly smaller (sunk). The
       inline draw already factors size+opacity by f, so this just
       amplifies the existing depth read. */
    function applyDepthToParticles() {
        var pool = global.oceanParticles;
        if (!pool || !pool.length) return;
        for (var i = 0; i < pool.length; i++) {
            var p = pool[i];
            // store original once
            if (p._baseS == null) p._baseS = p.s;
            // depth multiplier 0.55 (sunk) → 1.45 (floating)
            var depth = 0.55 + (p.f || 0) * 0.9;
            p.s = p._baseS * depth;
        }
    }

    /* ─── boot ─── */
    function boot() {
        // initial paint of static UI
        renderDensity();
        renderHeatmap([], { economy: 0, standard: 0, priority: 0 });
        renderClock(new Array(24).fill(0));

        if (global.MempoolData) {
            global.MempoolData.subscribe('fee_histogram', function (h) {
                renderHeatmap(h, global.MempoolData.fee_bands);
            });
            global.MempoolData.subscribe('bands', function (b) {
                renderHeatmap(global.MempoolData.fee_histogram, b);
            });
            global.MempoolData.subscribe('size', function (s) { renderSparkline(s); });
            global.MempoolData.subscribe('hourly', function (h) { renderClock(h); });
        }

        if (global.MoneroNetwork) {
            global.MoneroNetwork.subscribePool(function () {
                applyDepthToParticles();
                checkBlockFormation();
            });
            global.MoneroNetwork.subscribeBlocks(function () { checkBlockFormation(); });
        }

        if (!REDUCED_MOTION) {
            setInterval(checkBlockFormation, 5000);
        }

        // resize redraws
        global.addEventListener('resize', function () {
            renderSparkline(global.MempoolData ? global.MempoolData.size_history : []);
            renderClock(global.MempoolData ? global.MempoolData.hourly_clock : new Array(24).fill(0));
        });

        if (global.Mempool) {
            global.Mempool.register('ocean', {
                onEnter: function () {
                    // Re-fit canvases on entry (they may have been hidden, with 0 size)
                    setTimeout(function () {
                        renderSparkline(global.MempoolData ? global.MempoolData.size_history : []);
                        renderClock(global.MempoolData ? global.MempoolData.hourly_clock : new Array(24).fill(0));
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
