/* LiveTxFeed — scrolling 20-row list of most recent mempool txs.
   New rows slide in from top, old rows evicted at bottom.
   Click a row → /mempool?tx={txid} (M3 will upgrade this). */
(function (global) {
    'use strict';
    var MO = global.MempoolOceanShared || (global.MempoolOceanShared = {});
    var MAX_ROWS = 20;

    function LiveTxFeed(root, opts) {
        this.root = root;
        this.reduced = !!(opts && opts.reducedMotion);
        this.seen = Object.create(null); // txid → true, for dedupe
        this.rows = [];                   // newest → oldest
        this._renderSkeleton();
    }

    LiveTxFeed.prototype._renderSkeleton = function () {
        this.root.innerHTML =
            '<div class="mp-txfeed-h">' +
                '<span class="c-txid">TXID</span>' +
                '<span class="c-size">SIZE</span>' +
                '<span class="c-fee">FEE</span>' +
                '<span class="c-rate">p/B</span>' +
                '<span class="c-tier">TIER</span>' +
                '<span class="c-age">AGE</span>' +
            '</div>' +
            '<div class="mp-txfeed-list" id="mp-txfeed-list"></div>';
        this.list = this.root.querySelector('.mp-txfeed-list');
    };

    LiveTxFeed.prototype.render = function (recentTxs) {
        if (!Array.isArray(recentTxs)) return;
        // Ingest new txs in reverse so earliest-new ends up deeper.
        for (var i = recentTxs.length - 1; i >= 0; i--) {
            var tx = recentTxs[i];
            if (!tx || !tx.txid) continue;
            if (this.seen[tx.txid]) continue;
            this.seen[tx.txid] = true;
            this.rows.unshift(tx);
        }
        while (this.rows.length > MAX_ROWS) {
            var evict = this.rows.pop();
            if (evict) delete this.seen[evict.txid];
        }
        this._paint();
    };

    function isMobile() {
        if (window.MPChart && window.MPChart.isMobileViewport) {
            return window.MPChart.isMobileViewport();
        }
        if (window.matchMedia) return window.matchMedia('(max-width: 767px)').matches;
        return (window.innerWidth || 1024) < 768;
    }

    LiveTxFeed.prototype._paint = function () {
        var fmt = MO.fmt, tierByKey = window.XmrRelayWS.tierByKey;
        var now = Date.now();
        var mobile = isMobile();
        // Toggle a class on the feed root so CSS can hide the desktop header
        // and any leftover .mp-txrow elements from a prior render.
        if (mobile) this.root.classList.add('is-mobile');
        else this.root.classList.remove('is-mobile');
        var html = '';
        for (var i = 0; i < this.rows.length; i++) {
            var t = this.rows[i];
            var tier = tierByKey(t.fee_tier) || window.XmrRelayWS.classify(t.fee_rate);
            var ageMs = now - (t.receive_time || 0) * 1000;
            if (mobile) {
                html += '<div class="mp-tx-card" data-txid="' + t.txid + '">' +
                    '<div class="mp-tx-card__primary">' +
                        '<span class="mp-tx-card__id">' + fmt.txidShort(t.txid) + '</span>' +
                        '<span class="mp-tx-card__age">' + fmt.age(ageMs) + '</span>' +
                    '</div>' +
                    '<div class="mp-tx-card__metrics">' +
                        '<div class="mp-tx-card__metric"><span class="lbl">FEE</span><span class="val">' + fmt.xmr(t.fee) + '</span></div>' +
                        '<div class="mp-tx-card__metric"><span class="lbl">p/B</span><span class="val">' + (t.fee_rate || 0).toFixed(1) + '</span></div>' +
                        '<div class="mp-tx-card__metric"><span class="lbl">SIZE</span><span class="val">' + fmt.bytes(t.blob_size) + '</span></div>' +
                        '<div class="mp-tx-card__metric"><span class="lbl">TIER</span><span class="val tier"><span class="mp-tier-dot" style="background:' + tier.color + '"></span>' + tier.label + '</span></div>' +
                    '</div>' +
                '</div>';
            } else {
                html += '<div class="mp-txrow' + (this.reduced ? '' : ' mp-txrow-in') + '" data-txid="' + t.txid + '">' +
                    '<span class="c-txid">' + fmt.txidShort(t.txid) + '</span>' +
                    '<span class="c-size">' + fmt.bytes(t.blob_size) + '</span>' +
                    '<span class="c-fee">' + fmt.xmr(t.fee) + '</span>' +
                    '<span class="c-rate">' + (t.fee_rate || 0).toFixed(1) + '</span>' +
                    '<span class="c-tier"><span class="mp-tier-dot" style="background:' + tier.color + '"></span>' + tier.label + '</span>' +
                    '<span class="c-age">' + fmt.age(ageMs) + '</span>' +
                '</div>';
            }
        }
        this.list.innerHTML = html;
    };

    /* Re-paint when crossing the mobile/desktop breakpoint so the markup
       matches the new viewport without a page reload. */
    LiveTxFeed.prototype._wireBreakpointWatcher = function () {
        if (!window.matchMedia) return;
        var mq = window.matchMedia('(max-width: 767px)');
        var self = this;
        var handler = function () { self._paint(); };
        if (mq.addEventListener) mq.addEventListener('change', handler);
        else if (mq.addListener) mq.addListener(handler);
    };

    LiveTxFeed.prototype.onClickRow = function (handler) {
        var self = this;
        // Wire breakpoint watcher once we have a click handler (i.e. the feed is live).
        if (!self._bpWired) { self._wireBreakpointWatcher(); self._bpWired = true; }
        this.root.addEventListener('click', function (e) {
            // Match either desktop row or mobile card.
            var row = e.target.closest && (e.target.closest('.mp-txrow') || e.target.closest('.mp-tx-card'));
            if (row && row.getAttribute('data-txid')) handler(row.getAttribute('data-txid'));
            self && 0;
        });
    };

    MO.LiveTxFeed = LiveTxFeed;
})(window);
