/* ═══════════════════════════════════════════════════════════════
   M5MempoolClock — radial mempool visualizer (M5 / xmr.irish)
   Host page: mempool.html (canvas id="mp-clock-canvas")
   Boot:  var clk = new window.M5MempoolClock(canvas);
          clk.update(txs);   // txs: [{txid, fee_rate, blob_size, ...}]
                             // fee_rate is piconero/byte (relay schema)
   Visual: four concentric fee-tier rings (priority→economy, inner→
           outer). High-fee txs plot near center (next-block zone),
           low-fee txs drift to the outer economy ring. Jitter is
           deterministic so dots sit still between re-renders.
   Palette mirrors FEE_TIERS in js/xmr-relay-ws.js (tier identity
   is DATA — colors are stable across M3/M4/M5 surfaces).
   ES5 IIFE house style. No classes, no arrow fns, no Math.random.
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
    'use strict';

    /* ── Tier palette (alpha ≈ 0xCC / 0.8 matches FEE_TIERS@CC) ── */
    var DOT_COLORS = {
        stuck:    'rgba(68,68,68,0.8)',
        economy:  'rgba(61,142,255,0.8)',
        normal:   'rgba(0,201,122,0.8)',
        fast:     'rgba(242,104,34,0.8)',
        priority: 'rgba(255,68,85,0.8)'
    };

    /* ── Guide-ring definitions (radius + stroke) ── */
    var RINGS = [
        { key: 'priority', radius: 50,  stroke: 'rgba(255,68,85,0.22)',  label: 'PRIORITY', labelColor: 'rgba(255,68,85,0.55)' },
        { key: 'fast',     radius: 80,  stroke: 'rgba(242,104,34,0.22)', label: 'FAST',     labelColor: 'rgba(242,104,34,0.55)' },
        { key: 'normal',   radius: 110, stroke: 'rgba(0,201,122,0.22)',  label: 'NORMAL',   labelColor: 'rgba(0,201,122,0.55)' },
        { key: 'economy',  radius: 130, stroke: 'rgba(61,142,255,0.22)', label: 'ECONOMY',  labelColor: 'rgba(61,142,255,0.55)' }
    ];

    var MONO_FONT = "'JetBrains Mono','DM Mono',monospace";

    /* ── Classify a fee_rate (piconero/byte) into a tier key ── */
    function tierKeyFor(rate) {
        var r = Number(rate) || 0;
        if (r < 1)  return 'stuck';
        if (r < 5)  return 'economy';
        if (r < 20) return 'normal';
        if (r < 80) return 'fast';
        return 'priority';
    }

    /* ── Constructor ──
       opts.simplifyLabels: skip minor on-canvas labels on small screens
       (currently the labels live in an external HTML legend, so this is
       reserved for future use without a breaking constructor change). */
    function M5MempoolClock(canvas, opts) {
        this.canvas         = canvas || null;
        this.txs            = [];
        this._raf           = 0;
        this._running       = false;
        opts                = opts || {};
        this.simplifyLabels = !!opts.simplifyLabels;

        /* bound tick so stop() can cancel the same identity */
        var self = this;
        this._tick = function () {
            if (!self._running) return;
            self.render();
            self._raf = global.requestAnimationFrame(self._tick);
        };
    }

    /* Mobile viewport detection — prefer the shared MPChart helper if loaded,
       fall back to matchMedia, fall back to innerWidth. */
    function isMobileViewport() {
        if (global.MPChart && global.MPChart.isMobileViewport) {
            return global.MPChart.isMobileViewport();
        }
        if (global.matchMedia) {
            return global.matchMedia('(max-width: 767px)').matches;
        }
        return (global.innerWidth || 1024) < 768;
    }

    /* ── update: replace list, cap at 500, re-render once ── */
    M5MempoolClock.prototype.update = function (txs) {
        var src = (txs && typeof txs.length === 'number') ? txs : [];
        var cap = src.length > 500 ? 500 : src.length;
        var copy = new Array(cap);
        for (var i = 0; i < cap; i++) copy[i] = src[i];
        this.txs = copy;
        this.render();
    };

    /* ── start: begin rAF loop ── */
    M5MempoolClock.prototype.start = function () {
        if (this._running) return;
        this._running = true;
        this._raf = global.requestAnimationFrame(this._tick);
    };

    /* ── stop: cancel rAF loop, no leaks ── */
    M5MempoolClock.prototype.stop = function () {
        this._running = false;
        if (this._raf) {
            global.cancelAnimationFrame(this._raf);
            this._raf = 0;
        }
    };

    /* ── render: one frame. Never schedules itself. ── */
    M5MempoolClock.prototype.render = function () {
        var canvas = this.canvas;
        if (!canvas || typeof canvas.getContext !== 'function') return;

        var dpr = Math.min(global.devicePixelRatio || 1, 2);
        var W = canvas.offsetWidth || (canvas.parentElement && canvas.parentElement.clientWidth) || 520;
        /* Phone-friendly: shorten the canvas so it doesn't dominate a 568px-tall iPhone SE viewport. */
        var mobile = isMobileViewport();
        var H = mobile ? (W < 360 ? 200 : 220) : 260;

        canvas.width  = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width  = W + 'px';
        canvas.style.height = H + 'px';

        var ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        /* ── Background ── */
        ctx.fillStyle = '#0D0D0D';
        ctx.fillRect(0, 0, W, H);

        var cx = W / 2;
        var cy = H / 2;

        /* ── Guide rings (dashed) + tier labels ──
           On phones the canvas height shrinks so we scale the ring radii to
           fit; on desktop the original 50/80/110/130 layout is preserved. */
        var maxRingRadius = RINGS[RINGS.length - 1].radius;
        var ringScale = mobile ? Math.min(1, ((H / 2) - 12) / maxRingRadius) : 1;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 6]);
        for (var r = 0; r < RINGS.length; r++) {
            var ring = RINGS[r];
            ctx.strokeStyle = ring.stroke;
            ctx.beginPath();
            ctx.arc(cx, cy, ring.radius * ringScale, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.setLineDash([]);

        /* Tier labels are rendered as an external HTML legend (.m5-clock-legend)
           rather than crammed onto the canvas — they overlapped at the right
           edge when stacked at the same y. */

        /* ── Transaction dots ── */
        var txs = this.txs || [];
        var n = txs.length;
        if (n > 0) {
            for (var i = 0; i < n; i++) {
                var tx = txs[i] || {};
                var rate = Number(tx.fee_rate) || 0;
                var ratePct = rate / 100;
                if (ratePct > 1) ratePct = 1;
                if (ratePct < 0) ratePct = 0;

                /* Deterministic jitter — stable across renders */
                var rJitter = Math.sin(i * 7.3) * 8;
                var aJitter = Math.cos(i * 3.1) * 4;

                var radius = (45 + (1 - ratePct) * 85) * ringScale + rJitter;
                if (radius < 10) radius = 10;

                var angle = (i / n) * Math.PI * 2 + (aJitter * Math.PI / 180);

                var x = cx + Math.cos(angle) * radius;
                var y = cy + Math.sin(angle) * radius;

                ctx.fillStyle = DOT_COLORS[tierKeyFor(rate)] || DOT_COLORS.stuck;
                ctx.beginPath();
                ctx.arc(x, y, 2.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        /* ── Center readout: count + "pending" ── */
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';

        ctx.fillStyle = '#e5e7eb';
        ctx.font = 'bold 13px ' + MONO_FONT;
        ctx.fillText(String(n), cx, cy + 2);

        ctx.fillStyle = '#6b7280';
        ctx.font = '9px ' + MONO_FONT;
        ctx.fillText('pending', cx, cy + 14);
    };

    /* Re-render once on resize so the canvas dimensions and ring scale
       follow viewport changes (e.g. mobile landscape rotation, browser
       chrome show/hide). Throttled via requestAnimationFrame. */
    M5MempoolClock.prototype._wireResize = function () {
        if (this._resizeWired) return;
        var self = this;
        var pending = false;
        var handler = function () {
            if (pending) return;
            pending = true;
            global.requestAnimationFrame(function () {
                pending = false;
                self.render();
            });
        };
        if (global.matchMedia) {
            var mq = global.matchMedia('(max-width: 767px)');
            if (mq.addEventListener) mq.addEventListener('change', handler);
            else if (mq.addListener) mq.addListener(handler);
        }
        global.addEventListener('resize', handler);
        this._resizeWired = true;
    };

    var _origUpdate = M5MempoolClock.prototype.update;
    M5MempoolClock.prototype.update = function (txs) {
        this._wireResize();
        return _origUpdate.call(this, txs);
    };

    /* ── Export ── */
    global.M5MempoolClock = M5MempoolClock;

})(window);
