/* ═══════════════════════════════════════════════════════════════
   M5DecoyAgeChart — Decoy age distribution chart for Monero tx
   Renders a horizontal bar chart into a <canvas>, showing how
   ring members (decoys + real spend) are distributed across 5
   age buckets based on the relative key_offsets in tx.vin[0].

   Usage:
     window.M5DecoyAgeChart.render(
       canvas,         // HTMLCanvasElement target
       keyOffsets,     // number[] — relative offsets from tx.vin[0].key.key_offsets
       currentHeight,  // number — current blockchain height (unused in age proxy)
       totalOutputs    // number — rough "all outputs ever" count
     );

   Age estimation is a proxy: absolute global index per ring
   member is the cumulative sum of keyOffsets; estimated age is
   max(0, totalOutputs - absoluteIndex). Without totalOutputs a
   fallback "insufficient chain data" message is rendered.

   No external dependencies. Pure ES5, DPR-aware, one-shot render.
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
    'use strict';

    /* ── Age buckets (blocks; ~1 block = 2 min on Monero) ── */
    var BUCKETS = [
        { label: '< 1 hour',    min: 0,     max: 30     },
        { label: '1h - 1day',   min: 30,    max: 720    },
        { label: '1 - 7 days',  min: 720,   max: 5040   },
        { label: '7 - 30 days', min: 5040,  max: 21600  },
        { label: '> 30 days',   min: 21600, max: Infinity }
    ];

    var PAD = { t: 12, r: 96, b: 28, l: 100 };
    var BG  = '#0D0D0D';
    var BAR_FILL_RGB   = '0, 201, 122';
    var BAR_STROKE     = 'rgba(0, 201, 122, 0.3)';
    var LABEL_LEFT     = '#6b7280';
    var LABEL_RIGHT    = '#8a8f98';
    var LABEL_FOOTER   = '#4a4a4a';
    var LABEL_FALLBACK = '#555555';
    var FONT_SMALL     = "9px 'JetBrains Mono','DM Mono',monospace";
    var FONT_FALLBACK  = "10px 'JetBrains Mono','DM Mono',monospace";

    function setupCanvas(canvas) {
        var dpr = Math.min(global.devicePixelRatio || 1, 2);
        var W = canvas.offsetWidth || (canvas.parentElement && canvas.parentElement.clientWidth) || 520;
        var H = 160;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        var ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        return { ctx: ctx, W: W, H: H };
    }

    function drawBackground(ctx, W, H) {
        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, W, H);
    }

    function drawCenteredMessage(ctx, W, H, text, color, font) {
        ctx.fillStyle = color;
        ctx.font = font;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, W / 2, H / 2);
    }

    function bucketize(keyOffsets, totalOutputs) {
        var counts = [0, 0, 0, 0, 0];
        var absIdx = 0;
        for (var i = 0; i < keyOffsets.length; i++) {
            var off = Number(keyOffsets[i]) || 0;
            absIdx += off;
            var age = Math.max(0, (Number(totalOutputs) || 0) - absIdx);
            for (var b = 0; b < BUCKETS.length; b++) {
                if (age >= BUCKETS[b].min && age < BUCKETS[b].max) {
                    counts[b]++;
                    break;
                }
            }
        }
        return counts;
    }

    function render(canvas, keyOffsets, currentHeight, totalOutputs) {
        /* ── Guard clauses ── */
        if (!canvas || typeof canvas.getContext !== 'function') return;

        var setup = setupCanvas(canvas);
        var ctx = setup.ctx;
        var W = setup.W;
        var H = setup.H;

        drawBackground(ctx, W, H);

        if (!keyOffsets || Object.prototype.toString.call(keyOffsets) !== '[object Array]' || keyOffsets.length === 0) {
            drawCenteredMessage(ctx, W, H, 'No ring data', LABEL_FALLBACK, FONT_FALLBACK);
            return;
        }

        var chartWidth  = W - PAD.l - PAD.r;
        var chartHeight = H - PAD.t - PAD.b;
        var slotHeight  = chartHeight / BUCKETS.length;
        var barHeight   = slotHeight * 0.68;

        /* ── If totalOutputs missing or zero, render empty bars + fallback ── */
        var hasChainData = !!(Number(totalOutputs) && Number(totalOutputs) > 0);
        var counts = hasChainData
            ? bucketize(keyOffsets, totalOutputs)
            : [0, 0, 0, 0, 0];

        var maxCount = 1;
        for (var i = 0; i < counts.length; i++) {
            if (counts[i] > maxCount) maxCount = counts[i];
        }

        /* ── Draw bars + labels ── */
        for (var b = 0; b < BUCKETS.length; b++) {
            var count = counts[b];
            var slotTop = PAD.t + slotHeight * b;
            var barY = slotTop + (slotHeight - barHeight) / 2;
            var ratio = count / maxCount;
            var barWidth = Math.max(0, chartWidth * ratio);

            /* Alpha 0.18 (empty) → 0.7 (max) */
            var alpha = 0.18 + (0.7 - 0.18) * ratio;

            if (barWidth > 0) {
                ctx.fillStyle = 'rgba(' + BAR_FILL_RGB + ', ' + alpha.toFixed(3) + ')';
                ctx.fillRect(PAD.l, barY, barWidth, barHeight);
                ctx.lineWidth = 1;
                ctx.strokeStyle = BAR_STROKE;
                ctx.strokeRect(PAD.l + 0.5, barY + 0.5, Math.max(0, barWidth - 1), Math.max(0, barHeight - 1));
            }

            /* Left label — bucket name, right-aligned at PAD.l - 8 */
            ctx.fillStyle = LABEL_LEFT;
            ctx.font = FONT_SMALL;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(BUCKETS[b].label, PAD.l - 8, barY + barHeight / 2);

            /* Right label — "N members", left-aligned at PAD.l + barWidth + 8 */
            ctx.fillStyle = LABEL_RIGHT;
            ctx.font = FONT_SMALL;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(count + ' members', PAD.l + barWidth + 8, barY + barHeight / 2);
        }

        /* ── Footer: total ring members OR fallback message ── */
        if (!hasChainData) {
            drawCenteredMessage(
                ctx,
                W,
                PAD.t + chartHeight,
                'insufficient chain data',
                LABEL_FALLBACK,
                FONT_FALLBACK
            );
        } else {
            ctx.fillStyle = LABEL_FOOTER;
            ctx.font = FONT_SMALL;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(
                'Total: ' + keyOffsets.length + ' ring members',
                W / 2,
                H - PAD.b / 2
            );
        }
    }

    /* ── Export ── */
    global.M5DecoyAgeChart = {
        render: render
    };
})(window);
