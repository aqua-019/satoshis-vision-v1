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

    LiveTxFeed.prototype._paint = function () {
        var fmt = MO.fmt, tierByKey = window.XmrRelayWS.tierByKey;
        var now = Date.now();
        var html = '';
        for (var i = 0; i < this.rows.length; i++) {
            var t = this.rows[i];
            var tier = tierByKey(t.fee_tier) || window.XmrRelayWS.classify(t.fee_rate);
            var ageMs = now - (t.receive_time || 0) * 1000;
            html += '<div class="mp-txrow' + (this.reduced ? '' : ' mp-txrow-in') + '" data-txid="' + t.txid + '">' +
                '<span class="c-txid">' + fmt.txidShort(t.txid) + '</span>' +
                '<span class="c-size">' + fmt.bytes(t.blob_size) + '</span>' +
                '<span class="c-fee">' + fmt.xmr(t.fee) + '</span>' +
                '<span class="c-rate">' + (t.fee_rate || 0).toFixed(1) + '</span>' +
                '<span class="c-tier"><span class="mp-tier-dot" style="background:' + tier.color + '"></span>' + tier.label + '</span>' +
                '<span class="c-age">' + fmt.age(ageMs) + '</span>' +
            '</div>';
        }
        this.list.innerHTML = html;
    };

    LiveTxFeed.prototype.onClickRow = function (handler) {
        var self = this;
        this.root.addEventListener('click', function (e) {
            var row = e.target.closest && e.target.closest('.mp-txrow');
            if (row && row.getAttribute('data-txid')) handler(row.getAttribute('data-txid'));
            self && 0;
        });
    };

    MO.LiveTxFeed = LiveTxFeed;
})(window);
