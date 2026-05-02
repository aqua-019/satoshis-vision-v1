/* mempool-chart-utils.js — shared Canvas 2D helpers for M4 mining charts.
   No external deps. Reads colors from d10.css via CSS variables. */
(function (global) {
    'use strict';

    function setupCanvas(canvas, fixedHeight, opts) {
        opts = opts || {};
        var dpr = Math.min(global.devicePixelRatio || 1, 2);
        var W   = canvas.clientWidth  || canvas.parentElement.clientWidth || 600;
        var H   = fixedHeight || canvas.clientHeight || 180;
        // Mobile cap: keep tall charts from eating the viewport on small screens.
        if (opts.mobileMaxHeight && isMobileViewport()) {
            H = Math.min(H, opts.mobileMaxHeight);
        }
        canvas.width  = W * dpr;
        canvas.height = H * dpr;
        canvas.style.height = H + 'px';
        var ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return { ctx: ctx, W: W, H: H, dpr: dpr, isMobile: isMobileViewport() };
    }

    /* Mobile viewport detection used by chart consumers to decide
       tick density, label simplification, etc. */
    function isMobileViewport() {
        if (global.matchMedia) {
            return global.matchMedia('(max-width: 767px)').matches;
        }
        return (global.innerWidth || 1024) < 768;
    }

    /* Touch-device detection (orthogonal to viewport). Used to pick
       tap-to-inspect over hover-to-inspect on chart tooltips. */
    function isTouchDevice() {
        return ('ontouchstart' in global) ||
               (global.navigator && global.navigator.maxTouchPoints > 0);
    }

    /* Suggested tick count for a given chart width — fewer ticks on narrow
       widths to prevent label overlap. Consumers that don't pass an explicit
       count fall back to this. */
    function tickHint(widthPx) {
        if (widthPx < 360) return 3;
        if (widthPx < 560) return 4;
        if (widthPx < 768) return 5;
        return 8;
    }

    var _varCache = {};
    function cssVar(name) {
        if (_varCache[name]) return _varCache[name];
        var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        if (v) _varCache[name] = v;
        return v || '#ffffff';
    }

    function observeResize(canvas, cb) {
        if ('ResizeObserver' in global) {
            var ro = new ResizeObserver(function () { cb(); });
            ro.observe(canvas.parentElement || canvas);
            return function () { ro.disconnect(); };
        }
        var h = function () { cb(); };
        global.addEventListener('resize', h);
        return function () { global.removeEventListener('resize', h); };
    }

    function fmtBigNum(n) {
        var a = Math.abs(n);
        if (a >= 1e12) return (n / 1e12).toFixed(2) + 'T';
        if (a >= 1e9)  return (n / 1e9).toFixed(2)  + 'G';
        if (a >= 1e6)  return (n / 1e6).toFixed(2)  + 'M';
        if (a >= 1e3)  return (n / 1e3).toFixed(1)  + 'K';
        return '' + Math.round(n);
    }

    function hexToRgb(hex) {
        hex = (hex || '').replace('#', '');
        if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
        var n = parseInt(hex, 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }

    global.MPChart = {
        setupCanvas:      setupCanvas,
        cssVar:           cssVar,
        observeResize:    observeResize,
        fmtBigNum:        fmtBigNum,
        hexToRgb:         hexToRgb,
        isMobileViewport: isMobileViewport,
        isTouchDevice:    isTouchDevice,
        tickHint:         tickHint
    };
})(window);
