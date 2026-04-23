/* MempoolStatsRow — aggregate chips below the tx feed.
   Subscribes to mempool-update; reads tx_count, bytes_total, fees_total,
   median_fee_rate, and derives oldest age from recent_txs. */
(function (global) {
    'use strict';
    var MO = global.MempoolOceanShared || (global.MempoolOceanShared = {});

    function MempoolStatsRow(root) {
        this.root = root;
        this.render(null);
    }

    MempoolStatsRow.prototype.render = function (p) {
        var fmt = MO.fmt;
        var chips;
        if (!p) {
            chips = [
                { l: 'TXs',        v: '—' },
                { l: 'Size',       v: '—' },
                { l: 'Fees (XMR)', v: '—' },
                { l: 'Oldest',     v: '—' },
                { l: 'Median p/B', v: '—' }
            ];
        } else {
            var oldest = p.recent_txs && p.recent_txs.length
                ? p.recent_txs.reduce(function (a, t) { return Math.min(a, t.receive_time || Infinity); }, Infinity)
                : 0;
            var ageMs = oldest && oldest !== Infinity ? Date.now() - oldest * 1000 : 0;
            chips = [
                { l: 'TXs',        v: fmt.int(p.tx_count) },
                { l: 'Size',       v: fmt.bytes(p.bytes_total) },
                { l: 'Fees (XMR)', v: fmt.xmr(p.fees_total) },
                { l: 'Oldest',     v: ageMs ? fmt.age(ageMs) : '—' },
                { l: 'Median p/B', v: (p.median_fee_rate || 0).toFixed(1) }
            ];
        }
        var html = '';
        for (var i = 0; i < chips.length; i++) {
            html += '<div class="mp-stat-chip">'
                 +  '<div class="mp-stat-v">' + chips[i].v + '</div>'
                 +  '<div class="mp-stat-l">' + chips[i].l + '</div>'
                 +  '</div>';
        }
        this.root.innerHTML = html;
    };

    MO.MempoolStatsRow = MempoolStatsRow;
})(window);
