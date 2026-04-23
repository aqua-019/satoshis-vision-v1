/* ═══════════════════════════════════════════════════════════════
   Mempool 3.0 — TRACK mode extras
   The core tracker (input → trackTransaction → ring SVG) stays
   inline in mempool.html. This module wires the new privacy
   report card + propagation timeline to tracked-tx events.
   ═══════════════════════════════════════════════════════════════ */

(function (global) {
    'use strict';

    var trackedFirstSeen = 0;
    var trackedConfirmedAt = 0;
    var inMempoolTimer = null;

    function $(id) { return document.getElementById(id); }

    function fmtClock(ts) {
        if (!ts) return '—';
        var d = new Date(ts);
        var hh = String(d.getUTCHours()).padStart(2, '0');
        var mm = String(d.getUTCMinutes()).padStart(2, '0');
        var ss = String(d.getUTCSeconds()).padStart(2, '0');
        return hh + ':' + mm + ':' + ss;
    }

    function fmtDuration(ms) {
        if (!ms || ms < 0) return '—';
        var s = Math.floor(ms / 1000);
        if (s < 60) return s + 's';
        var m = Math.floor(s / 60);
        if (m < 60) return m + 'm ' + (s % 60) + 's';
        var h = Math.floor(m / 60);
        return h + 'h ' + (m % 60) + 'm';
    }

    function clearTimer() {
        if (inMempoolTimer) {
            clearInterval(inMempoolTimer);
            inMempoolTimer = null;
        }
    }

    function updateMempoolDuration() {
        var el = $('prop-mempool-time');
        if (!el || !trackedFirstSeen) return;
        var endpoint = trackedConfirmedAt || Date.now();
        el.textContent = fmtDuration(endpoint - trackedFirstSeen);
    }

    function resetTimeline() {
        var fs = $('prop-first-seen'); if (fs) fs.textContent = '—';
        var mt = $('prop-mempool-time'); if (mt) mt.textContent = '—';
        var ct = $('prop-confirmed-time'); if (ct) ct.textContent = '—';
        trackedFirstSeen = 0;
        trackedConfirmedAt = 0;
        clearTimer();
    }

    /* ─── public hooks the inline tracker calls ─── */
    var Track = {
        onTrackStart: function (hash) {
            trackedFirstSeen = Date.now();
            trackedConfirmedAt = 0;
            var fs = $('prop-first-seen');
            if (fs) fs.textContent = fmtClock(trackedFirstSeen);
            clearTimer();
            updateMempoolDuration();
            inMempoolTimer = setInterval(updateMempoolDuration, 1000);
        },

        onTrackConfirmed: function (blockHeight, blockTimestampSec) {
            if (trackedConfirmedAt) return;
            trackedConfirmedAt = blockTimestampSec ? blockTimestampSec * 1000 : Date.now();
            var ct = $('prop-confirmed-time');
            if (ct) ct.textContent = fmtClock(trackedConfirmedAt);
            updateMempoolDuration();
            clearTimer();
        },

        onTrackReset: function () { resetTimeline(); }
    };

    /* ─── observe txd visibility to reset when cleared ─── */
    function watchTxd() {
        var txd = $('txd');
        if (!txd || !global.MutationObserver) return;
        var obs = new MutationObserver(function () {
            if (!txd.classList.contains('vis')) resetTimeline();
        });
        obs.observe(txd, { attributes: true, attributeFilter: ['class'] });
    }

    /* ─── expose + boot ─── */
    function boot() {
        watchTxd();
        if (global.Mempool) {
            global.Mempool.register('track', {
                onEnter: function () {
                    // No-op: the inline tracker handles its own state.
                    // We only need to make sure the timeline is in sync.
                    if (!trackedFirstSeen) resetTimeline();
                },
                onLeave: function () { /* keep state for round-trip */ }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    global.MempoolTrack = Track;
})(window);
