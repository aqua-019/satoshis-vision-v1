/* ═══════════════════════════════════════════════════════════════
   M5BulletproofTimeline — Range-proof size evolution chart (M5)
   Renders Monero's bulletproof size history on a <canvas>:
     2017 Original RingCT   13,200 B   (#FF4455)
     2018 Bulletproofs HF12  2,100 B   (#FFD100)
     2022 Bulletproofs+ HF15 1,500 B   (#00C97A)
   Plots "THIS TX" as a green dot at year 2023.5 using a size
   estimated from tx.rct_type / tx.output_count. Public API:
     window.M5BulletproofTimeline.render(canvas, tx)
     window.M5BulletproofTimeline.estimateProofSize(tx)
   After drawing, dispatches a `m5-bp-rendered` CustomEvent on
   the canvas with { detail: { size, savingsPct } } so callers
   can render a savings caption without re-computing.
   DPR-aware, single static render per call, no animation.
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
    'use strict';

    var FONT = "'JetBrains Mono','DM Mono',monospace";

    var MILESTONES = [
        { year: 2017, size: 13200, label: 'Original RingCT',      sizeLabel: '13.2KB', color: '#FF4455' },
        { year: 2018, size: 2100,  label: 'Bulletproofs (HF12)',  sizeLabel: '2.1KB',  color: '#FFD100' },
        { year: 2022, size: 1500,  label: 'Bulletproofs+ (HF15)', sizeLabel: '1.5KB',  color: '#00C97A' }
    ];

    var MIN_YEAR = 2016.5;
    var MAX_YEAR = 2024;
    var MAX_SIZE = 14000;
    var PAD = { t: 18, r: 110, b: 30, l: 52 };
    var THIS_TX_YEAR = 2023.5;

    /* ── Proof-size estimator ──
       rct_type 6 → Bulletproofs+ era, rct_type 5 → original Bulletproofs,
       anything else falls back to pre-BP RingCT worst case. */
    function estimateProofSize(tx) {
        var t = tx || { rct_type: 6, output_count: 2 };
        var outs = t.output_count || 2;
        if (t.rct_type === 6) return 640 + outs * 256;
        if (t.rct_type === 5) return 2100 + outs * 256;
        return 13200;
    }

    function yearToX(year, plotW) {
        return PAD.l + (year - MIN_YEAR) / (MAX_YEAR - MIN_YEAR) * plotW;
    }

    function sizeToY(size, plotH) {
        var s = size;
        if (s < 0) s = 0;
        if (s > MAX_SIZE) s = MAX_SIZE;
        return PAD.t + (1 - s / MAX_SIZE) * plotH;
    }

    function render(canvas, tx) {
        if (!canvas || !canvas.getContext) return;

        var dpr = Math.min(global.devicePixelRatio || 1, 2);
        var cssW = canvas.offsetWidth ||
                   (canvas.parentElement && canvas.parentElement.clientWidth) ||
                   520;
        var cssH = 120;

        canvas.width  = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
        canvas.style.width  = cssW + 'px';
        canvas.style.height = cssH + 'px';

        var ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        var W = cssW;
        var H = cssH;
        var plotW = W - PAD.l - PAD.r;
        var plotH = H - PAD.t - PAD.b;

        /* Background */
        ctx.fillStyle = '#0D0D0D';
        ctx.fillRect(0, 0, W, H);

        /* Y-axis grid + labels */
        var yTicks = [0, 5000, 10000, 14000];
        var yLabels = ['0KB', '5KB', '10KB', '14KB'];
        ctx.font = '8px ' + FONT;
        ctx.fillStyle = '#333';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (var i = 0; i < yTicks.length; i++) {
            var yy = sizeToY(yTicks[i], plotH);
            ctx.fillText(yLabels[i], PAD.l - 6, yy);
        }

        /* X-axis year labels */
        var xTicks = [2017, 2018, 2020, 2022, 2024];
        ctx.fillStyle = '#333';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (var j = 0; j < xTicks.length; j++) {
            var xx = yearToX(xTicks[j], plotW);
            ctx.fillText(String(xTicks[j]), xx, PAD.t + plotH + 8);
        }

        /* Connecting line through milestones */
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (var k = 0; k < MILESTONES.length; k++) {
            var mx = yearToX(MILESTONES[k].year, plotW);
            var my = sizeToY(MILESTONES[k].size, plotH);
            if (k === 0) ctx.moveTo(mx, my);
            else ctx.lineTo(mx, my);
        }
        ctx.stroke();

        /* Milestone dots + size labels */
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        for (var m = 0; m < MILESTONES.length; m++) {
            var ms = MILESTONES[m];
            var dx = yearToX(ms.year, plotW);
            var dy = sizeToY(ms.size, plotH);

            ctx.fillStyle = ms.color;
            ctx.beginPath();
            ctx.arc(dx, dy, 5, 0, Math.PI * 2);
            ctx.fill();

            ctx.font = '8px ' + FONT;
            ctx.fillStyle = ms.color;
            ctx.fillText(ms.sizeLabel, dx, dy - 8);
        }

        /* THIS TX dot */
        var estSize = estimateProofSize(tx);
        var tx_x = yearToX(THIS_TX_YEAR, plotW);
        var tx_y = sizeToY(estSize, plotH);

        ctx.fillStyle = '#00C97A';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(tx_x, tx_y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        /* THIS TX label stacked above the dot */
        ctx.font = 'bold 8px ' + FONT;
        ctx.fillStyle = '#00C97A';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(estSize + 'B', tx_x, tx_y - 10);
        ctx.fillText('THIS TX',     tx_x, tx_y - 20);

        /* Notify listeners */
        try {
            canvas.dispatchEvent(new CustomEvent('m5-bp-rendered', {
                detail: {
                    size: estSize,
                    savingsPct: Math.round((1 - estSize / 13200) * 100)
                }
            }));
        } catch (_) { /* CustomEvent may be unavailable in very old envs */ }
    }

    global.M5BulletproofTimeline = {
        render: render,
        estimateProofSize: estimateProofSize
    };
})(window);
