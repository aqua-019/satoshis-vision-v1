/* mempool-mining-p2pool.js — M4 Task 14: P2Pool decentralized mining panel.
   Monero-exclusive. Pulls pool share + network hashrate and derives P2Pool
   hashrate. Adds a banner when P2Pool ranks #1. */
(function (global) {
    'use strict';

    function fmtHashrate(ghs) {
        var n = Number(ghs) || 0;
        if (n >= 1000) return (n / 1000).toFixed(2) + ' TH/s';
        if (n >= 1)    return n.toFixed(2) + ' GH/s';
        return (n * 1000).toFixed(1) + ' MH/s';
    }

    function MempoolMiningP2Pool() { this.container = null; this.ws = null; }

    MempoolMiningP2Pool.prototype.init = function (ws, container) {
        this.ws = ws;
        this.container = container;
        this.render({ share: 0, pools: [], hashrate_ghs: 0 });
        this.refresh();
    };

    MempoolMiningP2Pool.prototype.refresh = function () {
        if (!this.ws || !this.container) return Promise.resolve();
        var self = this;
        return Promise.all([
            this.ws.fetchNetwork().catch(function () { return {}; }),
            this.ws.fetchPools().catch(function () { return { pools: [] }; })
        ]).then(function (res) {
            var net = res[0] || {};
            var pools = (res[1] && res[1].pools) || [];
            var p2p = pools.find(function (p) { return /p2pool/i.test(p.name); });
            self.render({
                share:        p2p ? Number(p2p.percentage) || 0 : 0,
                pools:        pools,
                hashrate_ghs: Number(net.hashrate_ghs) || 0,
                isTop:        pools.length ? /p2pool/i.test(pools[0].name) : false
            });
        });
    };

    MempoolMiningP2Pool.prototype.render = function (d) {
        var shareTxt = d.share ? d.share.toFixed(1) + '%' : '—';
        var p2pHashrate = d.share && d.hashrate_ghs
            ? fmtHashrate((d.hashrate_ghs * d.share) / 100)
            : '—';
        var banner = d.isTop
            ? '<div class="banner">P2Pool is currently the #1 mining pool by hashrate — a major decentralization milestone. The network is more censorship-resistant than ever.</div>'
            : '';

        this.container.innerHTML =
            '<div class="mp-mining-card-head">' +
              '<h3 class="mp-mining-card-title">P2Pool — Decentralized Mining (no Bitcoin equivalent)</h3>' +
            '</div>' +
            banner +
            '<div class="cards">' +
              '<div><span class="k">Share</span><span class="v">' + shareTxt + '</span></div>' +
              '<div><span class="k">P2Pool hashrate</span><span class="v">' + p2pHashrate + '</span></div>' +
              '<div><span class="k">Share interval</span><span class="v">~10 sec</span></div>' +
              '<div><span class="k">Payout frequency</span><span class="v">~every 2 min</span></div>' +
            '</div>' +
            '<p class="explainer" style="margin-top:14px">' +
              'P2Pool runs a parallel side-chain (share chain) alongside Monero mainnet. ' +
              'Miners submit shares every ~10 seconds and receive proportional payouts with ' +
              'no trusted pool operator required. Zero pool fee. P2Pool&nbsp;Mini offers lower ' +
              'minimum hashrate and longer share time for smaller miners.' +
            '</p>' +
            '<div class="links">' +
              '<a href="https://p2pool.io" target="_blank" rel="noopener noreferrer">p2pool.io →</a>' +
              '<a href="https://github.com/SChernykh/p2pool" target="_blank" rel="noopener noreferrer">P2Pool GitHub →</a>' +
              '<a href="https://p2pool.observer" target="_blank" rel="noopener noreferrer">P2Pool Observer →</a>' +
            '</div>';
    };

    global.MempoolMiningP2Pool = new MempoolMiningP2Pool();
})(window);
