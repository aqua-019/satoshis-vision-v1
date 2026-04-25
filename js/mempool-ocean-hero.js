/* FeeHeroCards — 4 cards (SLOW/NORMAL/FAST/PRIORITY) with pcn/B + ETA + USD cost.
   Data sources:
     • FeeUpdatePayload {tiers:[slow,normal,fast,fastest], recommended, timestamp}
       tiers[] from monerod get_fee_estimate (piconero/byte).
     • PriceService.data.xmr.usd — used to convert pcn/B → USD per typical tx.
   A typical 2-input Monero transaction is ~1.8 KB. We surface the USD cost
   for that envelope so non-Monero users can read fees as money. */
(function (global) {
    'use strict';
    var MO = global.MempoolOceanShared || (global.MempoolOceanShared = {});

    /* Average bytes per Monero transaction (2-in, 2-out, ringsize 16, BP+). */
    var TYPICAL_TX_BYTES = 1800;

    var CARDS = [
        { key: 'slow',     label: 'SLOW',     eta: '~60 min wait',  colorVar: '#3D8EFF' },
        { key: 'normal',   label: 'NORMAL',   eta: '~10 min wait',  colorVar: '#00C97A' },
        { key: 'fast',     label: 'FAST',     eta: '~2 min wait',   colorVar: '#F26822' },
        { key: 'priority', label: 'PRIORITY', eta: 'Next block',    colorVar: '#FF4455' }
    ];

    function formatUsd(usd) {
        if (usd == null || isNaN(usd)) return null;
        if (usd < 0.001) return '<$0.001';
        if (usd < 0.01)  return '$' + usd.toFixed(4);
        if (usd < 1)     return '$' + usd.toFixed(3);
        return '$' + usd.toFixed(2);
    }

    function xmrPriceUsd() {
        var ps = global.PriceService;
        return (ps && ps.data && ps.data.xmr && ps.data.xmr.usd) || null;
    }

    function FeeHeroCards(root) {
        this.root = root;
        this._lastFeeUpdate = null;
        this.render(null);

        /* Re-render whenever the live XMR price arrives or refreshes,
           so USD costs stay in sync with the latest fetch. */
        var self = this;
        if (global.PriceService && typeof global.PriceService.subscribe === 'function') {
            global.PriceService.subscribe(function () { self.render(self._lastFeeUpdate); });
        }
    }

    FeeHeroCards.prototype.render = function (feeUpdate) {
        this._lastFeeUpdate = feeUpdate || null;
        var tiers = feeUpdate && feeUpdate.tiers;
        var xmrUsd = xmrPriceUsd();
        var html = '';
        for (var i = 0; i < CARDS.length; i++) {
            var c = CARDS[i];
            var rate = tiers && typeof tiers[i] === 'number' ? tiers[i] : null;
            var rateStr = rate === null ? '—' : rate.toFixed(1);

            /* USD cost for a typical-sized tx at this fee rate. */
            var costStr = '';
            if (rate != null && xmrUsd != null) {
                var totalXmr = (rate * TYPICAL_TX_BYTES) / 1e12;
                var totalUsd = totalXmr * xmrUsd;
                var fmt = formatUsd(totalUsd);
                if (fmt) costStr = '~' + fmt + ' typical tx';
            }

            var tip = rate === null ? '' : ' title="' + (rate / 1e12).toFixed(12) + ' XMR per byte"';
            html += '<div class="mp-fee-card" style="border-top-color:' + c.colorVar + '"' + tip + '>' +
                '<div class="mp-fee-card-label" style="color:' + c.colorVar + '">' + c.label + '</div>' +
                '<div class="mp-fee-card-rate"><span class="mp-fee-rate-val">' + rateStr + '</span>' +
                    '<span class="mp-fee-rate-unit">pcn/B</span></div>' +
                (costStr ? '<div class="mp-fee-card-cost">' + costStr + '</div>' : '') +
                '<div class="mp-fee-card-eta">' + c.eta + '</div>' +
            '</div>';
        }
        this.root.innerHTML = html;
    };

    MO.FeeHeroCards = FeeHeroCards;
})(window);
