/* FeeHeroCards — 4 cards (SLOW/NORMAL/FAST/PRIORITY) with p/B + ETA.
   Data source: FeeUpdatePayload {tiers:[slow,normal,fast,fastest], recommended, timestamp}
   tiers[] comes from monerod get_fee_estimate (piconero/byte). */
(function (global) {
    'use strict';
    var MO = global.MempoolOceanShared || (global.MempoolOceanShared = {});

    // Card tier → block-target ETA. monerod priorities 1=slow, 2=normal, 3=fast, 4=fastest
    // The typical block wait in Monero at each tier (block target 120s):
    var CARDS = [
        { key: 'slow',     label: 'SLOW',     eta: '~60 min', colorVar: '#3D8EFF' },
        { key: 'normal',   label: 'NORMAL',   eta: '~10 min', colorVar: '#00C97A' },
        { key: 'fast',     label: 'FAST',     eta: '~2 min',  colorVar: '#F26822' },
        { key: 'priority', label: 'PRIORITY', eta: 'Next block', colorVar: '#FF4455' }
    ];

    function FeeHeroCards(root) {
        this.root = root;
        this.render(null);
    }

    FeeHeroCards.prototype.render = function (feeUpdate) {
        var tiers = feeUpdate && feeUpdate.tiers;
        var html = '';
        for (var i = 0; i < CARDS.length; i++) {
            var c = CARDS[i];
            var rate = tiers && typeof tiers[i] === 'number' ? tiers[i] : null;
            var val = rate === null ? '—' : rate.toFixed(1);
            var tip = rate === null ? '' : ' title="' + (rate / 1e12).toFixed(12) + ' XMR per byte"';
            html += '<div class="mp-fee-card" style="border-top-color:' + c.colorVar + '"' + tip + '>' +
                '<div class="mp-fee-card-label" style="color:' + c.colorVar + '">' + c.label + '</div>' +
                '<div class="mp-fee-card-rate"><span class="mp-fee-rate-val">' + val + '</span>' +
                    '<span class="mp-fee-rate-unit">p/B</span></div>' +
                '<div class="mp-fee-card-eta">' + c.eta + '</div>' +
            '</div>';
        }
        this.root.innerHTML = html;
    };

    MO.FeeHeroCards = FeeHeroCards;
})(window);
