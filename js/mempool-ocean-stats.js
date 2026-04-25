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
            /* Prefer the API's `oldest_tx_age_seconds`, derived server-side from
               poolStats.oldest — covers the entire mempool, not just the 20
               entries in `recent_txs`. Fall back to the recent-list scan if the
               server didn't provide it. */
            var ageMs = 0;
            if (typeof p.oldest_tx_age_seconds === 'number' && p.oldest_tx_age_seconds > 0) {
                ageMs = p.oldest_tx_age_seconds * 1000;
            } else if (p.recent_txs && p.recent_txs.length) {
                var oldest = p.recent_txs.reduce(function (a, t) {
                    return Math.min(a, t.receive_time || Infinity);
                }, Infinity);
                if (oldest && oldest !== Infinity) {
                    ageMs = Math.max(0, Date.now() - oldest * 1000);
                }
            }
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
