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
    var trackedBlockHeight = 0;
    var trackedFeeRate = 0;
    var segmentMeta = new Array(10);   // {height, timestamp, feePct}
    var segmentElems = [];
    var SVG_NS = 'http://www.w3.org/2000/svg';
    var RING_R = 82;
    var RING_CIRC = 2 * Math.PI * RING_R;
    var SEG_SPAN = RING_CIRC / 10;     // 51.52
    var SEG_GAP = 3;                   // visible gap between segments
    var SEG_VIS = SEG_SPAN - SEG_GAP;  // 48.52

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
        trackedBlockHeight = 0;
        segmentMeta = new Array(10);
        clearTimer();
        paintSegments(0);
    }

    /* ─── confirmation ring segments ─── */
    function initRingSegments() {
        var grp = $('ring-seg-group');
        if (!grp || segmentElems.length) return;
        for (var i = 0; i < 10; i++) {
            var c = document.createElementNS(SVG_NS, 'circle');
            c.setAttribute('cx', '100');
            c.setAttribute('cy', '100');
            c.setAttribute('r', String(RING_R));
            c.setAttribute('fill', 'none');
            c.setAttribute('stroke', '#1A1A22');
            c.setAttribute('stroke-width', '7');
            c.setAttribute('stroke-linecap', 'butt');
            c.setAttribute('stroke-dasharray', SEG_VIS.toFixed(2) + ' ' + (RING_CIRC - SEG_VIS).toFixed(2));
            c.setAttribute('stroke-dashoffset', (-i * SEG_SPAN).toFixed(2));
            c.setAttribute('class', 'ring-seg');
            c.setAttribute('data-i', String(i));
            grp.appendChild(c);
            segmentElems.push(c);
            bindSegmentHover(c, i);
        }
    }

    function paintSegments(confs) {
        for (var i = 0; i < 10; i++) {
            var el = segmentElems[i]; if (!el) continue;
            var isFilled = i < confs;
            var allConfirmed = confs >= 10;
            el.setAttribute('stroke', isFilled ? (allConfirmed ? '#00CC88' : '#FF6600') : '#1A1A22');
        }
    }

    function percentileLabel(rate, bands) {
        if (!rate || !bands) return '—';
        if (rate >= bands.priority) return 'top 10%';
        if (rate >= bands.standard) return 'top 50%';
        if (rate >= bands.economy) return 'top 75%';
        return 'below median';
    }

    function timeAgo(sec) {
        if (!sec) return '—';
        var diff = Math.floor(Date.now() / 1000) - sec;
        if (diff < 60) return 'just now';
        if (diff < 3600) return Math.floor(diff / 60) + ' min ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        return Math.floor(diff / 86400) + 'd ago';
    }

    function bindSegmentHover(el, i) {
        el.addEventListener('mouseenter', function (e) { showTip(i, el); });
        el.addEventListener('mouseleave', hideTip);
        el.addEventListener('focus', function () { showTip(i, el); });
        el.addEventListener('blur', hideTip);
    }

    function showTip(i, el) {
        var tip = $('ring-tip'); if (!tip) return;
        var meta = segmentMeta[i];
        if (!meta) {
            tip.innerHTML = '<div><span class="rt-m">Seg</span>' + (i + 1) + '/10</div><div><span class="rt-m">Status</span>pending</div>';
        } else {
            tip.innerHTML =
                '<div class="rt-h">#' + meta.height.toLocaleString() + '</div>' +
                '<div><span class="rt-m">Seen</span>' + timeAgo(meta.timestamp) + '</div>' +
                '<div><span class="rt-m">Fee</span><span class="rt-v">' + meta.feePct + '</span></div>';
        }

        // Position tip above the hovered segment
        var svg = el.ownerSVGElement;
        if (svg) {
            var svgRect = svg.getBoundingClientRect();
            var parent = tip.offsetParent || svg.parentNode;
            var parentRect = parent.getBoundingClientRect();
            var angle = (i / 10) * Math.PI * 2 - Math.PI / 2 + (Math.PI / 10);
            var cx = (100 / 200) * svgRect.width + svgRect.left - parentRect.left;
            var cy = (100 / 200) * svgRect.height + svgRect.top - parentRect.top;
            var rPx = (RING_R / 200) * svgRect.width;
            tip.style.left = (cx + Math.cos(angle) * rPx) + 'px';
            tip.style.top = (cy + Math.sin(angle) * rPx) + 'px';
        }
        tip.classList.add('vis');
        tip.setAttribute('aria-hidden', 'false');
    }

    function hideTip() {
        var tip = $('ring-tip'); if (!tip) return;
        tip.classList.remove('vis');
        tip.setAttribute('aria-hidden', 'true');
    }

    function updateRing(confs, blockHeight) {
        initRingSegments();
        confs = Math.min(Math.max(0, confs | 0), 10);
        trackedBlockHeight = blockHeight || trackedBlockHeight;

        var blocks = (global.MoneroNetwork && global.MoneroNetwork.blocks) || [];
        var bands = (global.MempoolData && global.MempoolData.fee_bands) || null;
        var feeLabel = percentileLabel(trackedFeeRate, bands);

        for (var i = 0; i < confs; i++) {
            var bh = trackedBlockHeight ? (trackedBlockHeight + i) : 0;
            var ts = 0;
            for (var j = 0; j < blocks.length; j++) if (blocks[j].height === bh) { ts = blocks[j].timestamp; break; }
            segmentMeta[i] = { height: bh, timestamp: ts, feePct: feeLabel };
        }
        for (var k = confs; k < 10; k++) segmentMeta[k] = null;

        paintSegments(confs);

        var cEl = $('ring-count'); if (cEl) cEl.textContent = confs + '/10';
        var eEl = $('ring-eta');   if (eEl) eEl.textContent = confs >= 10 ? 'fully confirmed' : '~' + ((10 - confs) * 2) + ' min to 10/10';
    }

    /* ─── public hooks the inline tracker calls ─── */
    var Track = {
        onTrackStart: function (hash, feeRate) {
            trackedFirstSeen = Date.now();
            trackedConfirmedAt = 0;
            trackedFeeRate = feeRate || 0;
            trackedBlockHeight = 0;
            segmentMeta = new Array(10);
            initRingSegments();
            paintSegments(0);
            var fs = $('prop-first-seen');
            if (fs) fs.textContent = fmtClock(trackedFirstSeen);
            clearTimer();
            updateMempoolDuration();
            inMempoolTimer = setInterval(updateMempoolDuration, 1000);
        },

        updateRing: updateRing,

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
