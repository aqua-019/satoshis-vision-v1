/* mempool-mining-pool.js — Pool Distribution panel.
   Calls /api/xmr/mining/pools/live for live stats from P2Pool + MoneroOcean
   APIs; renders a unified table of 6 pools with hashrate, share, fee,
   min payout, and type. P2Pool is highlighted and sorted first. */
(function (global) {
    'use strict';

    var FALLBACK_SHARE = { P2Pool: 7.2, MoneroOcean: 4.5, SupportXMR: 3.2, Nanopool: 5.8, HashVault: 1.5, C3Pool: 2.1 };
    var FALLBACK_HR    = { P2Pool: 403e6, MoneroOcean: 250e6, SupportXMR: 180e6, Nanopool: 323e6, HashVault: 85e6, C3Pool: 120e6 };

    function MempoolMiningPool() {
        this.container = null;
        this.ws = null;
    }

    MempoolMiningPool.prototype.init = function (ws, container) {
        this.ws = ws;
        this.container = container;
        this.refresh();
    };

    MempoolMiningPool.prototype.refresh = function () {
        var self = this;
        var container = this.container;
        if (!container) return Promise.resolve();

        container.innerHTML = renderPoolHeader() + '<div class="mp-mining-card-loading">Loading pool data…</div>';

        return fetch('/api/xmr/mining/pools/live', { headers: { accept: 'application/json' } })
            .then(function (res) { return res.ok ? res.json() : null; })
            .catch(function () { return null; })
            .then(function (data) {
                if (!data) {
                    container.innerHTML = renderPoolHeader() + '<div class="mp-mining-card-loading" style="color:var(--red)">Pool data unavailable</div>';
                    return;
                }
                self.render(data);
            });
    };

    MempoolMiningPool.prototype.render = function (data) {
        var container = this.container;
        var netGhs = data.network_hashrate_hs ? (data.network_hashrate_hs / 1e9).toFixed(2) : '—';

        var html = renderPoolHeader(netGhs);

        html += '' +
          '<div style="overflow-x:auto;margin-top:12px">' +
            '<table style="width:100%;border-collapse:collapse;font-size:11px;font-family:var(--font-mono)">' +
              '<thead>' +
                '<tr style="border-bottom:1px solid var(--border-subtle)">' +
                  '<th style="text-align:left;padding:6px 8px;font-size:9px;letter-spacing:.1em;color:var(--text-muted);font-weight:400">POOL</th>' +
                  '<th style="text-align:right;padding:6px 8px;font-size:9px;letter-spacing:.1em;color:var(--text-muted);font-weight:400">HASHRATE</th>' +
                  '<th style="text-align:right;padding:6px 8px;font-size:9px;letter-spacing:.1em;color:var(--text-muted);font-weight:400">SHARE</th>' +
                  '<th style="text-align:right;padding:6px 8px;font-size:9px;letter-spacing:.1em;color:var(--text-muted);font-weight:400">FEE</th>' +
                  '<th style="text-align:right;padding:6px 8px;font-size:9px;letter-spacing:.1em;color:var(--text-muted);font-weight:400">MIN PAY</th>' +
                  '<th style="text-align:left;padding:6px 8px;font-size:9px;letter-spacing:.1em;color:var(--text-muted);font-weight:400">TYPE</th>' +
                '</tr>' +
              '</thead>' +
              '<tbody>';

        var pools = (data.pools || []).slice();
        pools.sort(function (a, b) {
            if (a.name === 'P2Pool') return -1;
            if (b.name === 'P2Pool') return 1;
            var ah = a.hashrate_hs != null ? a.hashrate_hs : (FALLBACK_HR[a.name] || 0);
            var bh = b.hashrate_hs != null ? b.hashrate_hs : (FALLBACK_HR[b.name] || 0);
            return bh - ah;
        });

        for (var i = 0; i < pools.length; i++) {
            var pool = pools[i];
            var isP2P = pool.name === 'P2Pool';
            var nameColor = isP2P ? 'var(--xmr)' : pool.type === 'decentralized' ? 'var(--grn)' : 'var(--text-primary)';
            var liveDot = pool.live
                ? '<span title="Live data" style="display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--grn);box-shadow:0 0 4px var(--grn);margin-right:4px;vertical-align:middle"></span>'
                : '';
            var feeColor = pool.fee_pct === 0 ? 'var(--grn)' : pool.fee_pct > 0.8 ? 'var(--red)' : 'var(--text-secondary)';

            var hrVal = pool.hashrate_hs != null ? pool.hashrate_hs : (FALLBACK_HR[pool.name] || 0);
            var hrDisplay = hrVal >= 1e9 ? (hrVal / 1e9).toFixed(2) + ' GH/s'
                           : hrVal >= 1e6 ? (hrVal / 1e6).toFixed(0) + ' MH/s'
                           : (hrVal / 1e3).toFixed(0) + ' KH/s';
            var hrText = pool.live ? hrDisplay : '≈' + hrDisplay;

            var shareVal = pool.network_share_pct != null ? pool.network_share_pct : (FALLBACK_SHARE[pool.name] || 0);
            var shareText = pool.live ? shareVal + '%' : '≈' + shareVal + '%';

            var rowBg = isP2P ? 'rgba(242,104,34,0.04)' : 'transparent';
            var rowBorder = isP2P ? '1px solid rgba(242,104,34,0.12)' : 'transparent';

            html += '' +
              '<tr style="background:' + rowBg + ';border:' + rowBorder + ';border-radius:4px">' +
                '<td style="padding:9px 8px">' +
                  liveDot +
                  '<a href="' + pool.url + '" target="_blank" rel="noopener noreferrer" style="color:' + nameColor + ';text-decoration:none;font-weight:' + (isP2P ? '700' : '400') + '">' + pool.name + '</a>' +
                  (isP2P ? '<span style="font-size:8px;color:var(--xmr);margin-left:6px;border:1px solid rgba(242,104,34,.3);padding:1px 5px;border-radius:3px">RECOMMENDED</span>' : '') +
                '</td>' +
                '<td style="text-align:right;padding:9px 8px;color:' + (pool.live ? 'var(--text-primary)' : 'var(--text-muted)') + '">' + hrText + '</td>' +
                '<td style="text-align:right;padding:9px 8px;color:var(--text-secondary)">' + shareText + '</td>' +
                '<td style="text-align:right;padding:9px 8px;color:' + feeColor + '">' + pool.fee_pct + '%</td>' +
                '<td style="text-align:right;padding:9px 8px;color:var(--text-secondary)">' + pool.min_payout + ' XMR</td>' +
                '<td style="padding:9px 8px;color:var(--text-muted);font-size:9px">' + pool.type + '</td>' +
              '</tr>';
        }

        html += '</tbody></table></div>';
        html += '<div style="margin-top:10px;font-size:9px;color:var(--text-muted)">' +
                  'Live data: P2Pool API · MoneroOcean API · ≈ = estimated from recent blocks' +
                '</div>';

        container.innerHTML = html;
    };

    function renderPoolHeader(netGhs) {
        return '' +
          '<div class="mp-mining-card-head">' +
            '<h3 class="mp-mining-card-title">POOL DISTRIBUTION</h3>' +
            (netGhs ? '<span style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono)">Network: ' + netGhs + ' GH/s</span>' : '') +
          '</div>';
    }

    global.MempoolMiningPool = new MempoolMiningPool();
})(window);
