/* ═══════════════════════════════════════════════════════════════
   js/mining-charts.js — Interactive ROI calculator + helpers for
   the mining page. Reads live network hashrate from /api/xmr?_p=network,
   live block reward from /api/xmr?_p=blocks, live XMR/USD price from
   the global PriceService (subscribed via the xmrPriceUpdate event,
   plus a polling fallback).
   ═══════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    var SECONDS_PER_DAY = 86400;
    var BLOCK_TIME_S    = 120;   /* Monero protocol target */

    /* ── Live-data accessors ───────────────────────────────────── */

    function getNetworkHashrate() {
        /* Falls back to ~3.5 GH/s if the API hasn't responded yet. */
        return window._cachedHashrate || 3.5e9;
    }

    function getBlockReward() {
        /* Tail emission default — matches the current protocol value. */
        return window._cachedBlockReward || 0.6;
    }

    function getXmrPrice() {
        /* PriceService stores its latest snapshot on .data per
           the d10 service contract. Tolerate either shape. */
        if (typeof PriceService !== 'undefined') {
            var snap = PriceService.data || PriceService._latest;
            if (snap && snap.xmr && snap.xmr.usd) return snap.xmr.usd;
        }
        return null;
    }

    /* ── Calculation ───────────────────────────────────────────── */

    function calcRoi() {
        var hr = document.getElementById('roi-hashrate');
        if (!hr) return null;

        var myHashrate = Number(hr.value);
        var elecRate   = Number(document.getElementById('roi-electricity').value);
        var powerW     = Number(document.getElementById('roi-power').value);
        var uptimeHrs  = Number(document.getElementById('roi-uptime').value);

        var networkHr = getNetworkHashrate();
        var xmrPrice  = getXmrPrice();
        var reward    = getBlockReward();

        var blocksPerDay = SECONDS_PER_DAY / BLOCK_TIME_S;
        var dailyXmr = (myHashrate / networkHr) * blocksPerDay * reward;
        var dailyRevenue = xmrPrice != null ? dailyXmr * xmrPrice : null;

        var dailyKwh  = (powerW / 1000) * uptimeHrs;
        var dailyCost = dailyKwh * elecRate;

        var dailyNet   = dailyRevenue != null ? dailyRevenue - dailyCost : null;
        var monthlyNet = dailyNet != null ? dailyNet * 30.44  : null;
        var annualNet  = dailyNet != null ? dailyNet * 365.25 : null;

        var breakeven = dailyXmr > 0 ? dailyCost / dailyXmr : null;

        return {
            dailyXmr: dailyXmr,
            dailyRevenue: dailyRevenue,
            dailyCost: dailyCost,
            dailyNet: dailyNet,
            monthlyNet: monthlyNet,
            annualNet: annualNet,
            breakeven: breakeven,
            xmrPrice: xmrPrice
        };
    }

    /* ── Formatting ────────────────────────────────────────────── */

    function fmtUsd(v) {
        if (v == null || isNaN(v)) return '—';
        var sign = v < 0 ? '-' : '';
        var abs  = Math.abs(v);
        return sign + '$' + abs.toFixed(2);
    }

    function fmtXmr(v) {
        if (v == null || isNaN(v)) return '—';
        return v.toFixed(6) + ' XMR';
    }

    /* ── Render ────────────────────────────────────────────────── */

    function set(sel, text) {
        var el = document.querySelector(sel);
        if (el) el.textContent = text;
    }

    function renderRoi() {
        var r = calcRoi();
        if (!r) return;

        set('[data-roi-hashrate-display]', Number(document.getElementById('roi-hashrate').value).toLocaleString());
        set('[data-roi-electricity-display]', '$' + Number(document.getElementById('roi-electricity').value).toFixed(2));
        set('[data-roi-power-display]', String(Number(document.getElementById('roi-power').value)));
        set('[data-roi-uptime-display]', String(Number(document.getElementById('roi-uptime').value)));

        set('[data-roi-daily-xmr]', fmtXmr(r.dailyXmr));
        set('[data-roi-daily-rev]', fmtUsd(r.dailyRevenue));
        set('[data-roi-daily-cost]', fmtUsd(r.dailyCost));

        var netEl = document.querySelector('[data-roi-daily-net]');
        if (netEl) {
            netEl.textContent = fmtUsd(r.dailyNet);
            netEl.classList.toggle('positive', r.dailyNet != null && r.dailyNet > 0);
            netEl.classList.toggle('negative', r.dailyNet != null && r.dailyNet <= 0);
        }

        set('[data-roi-monthly-net]', fmtUsd(r.monthlyNet));
        set('[data-roi-annual-net]',  fmtUsd(r.annualNet));
        set('[data-roi-breakeven]',   fmtUsd(r.breakeven));
    }

    /* ── Live-data refresh (decoupled from the page's own loop) ── */

    function refreshNetworkCache() {
        fetch('/api/xmr?_p=network')
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (data) {
                if (!data) return;
                /* api returns hashrate_ghs (already GH/s) */
                if (data.hashrate_ghs) window._cachedHashrate = data.hashrate_ghs * 1e9;
                renderRoi();
            }).catch(function () { /* ignore — fallback used */ });

        fetch('/api/xmr?_p=blocks')
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (blocks) {
                if (!blocks || !blocks.length) return;
                var raw = blocks[0].reward;
                /* api returns reward in piconeros (1e12 = 1 XMR) */
                window._cachedBlockReward = raw > 1e6 ? raw / 1e12 : raw;
                renderRoi();
            }).catch(function () { /* ignore */ });
    }

    /* ── Wire-up ───────────────────────────────────────────────── */

    function init() {
        if (!document.getElementById('roi-hashrate')) return; /* not on this page */

        ['roi-hashrate', 'roi-electricity', 'roi-power', 'roi-uptime'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.addEventListener('input', renderRoi);
        });

        /* Subscribe to PriceService updates if it's present so revenue
           re-renders whenever the XMR/USD tick fires. */
        if (typeof PriceService !== 'undefined' && PriceService.subscribe) {
            PriceService.subscribe(function () { renderRoi(); });
        }
        document.addEventListener('xmrPriceUpdate', renderRoi);
        document.addEventListener('miningStatsUpdate', renderRoi);

        refreshNetworkCache();
        setInterval(refreshNetworkCache, 60000);
        renderRoi();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
