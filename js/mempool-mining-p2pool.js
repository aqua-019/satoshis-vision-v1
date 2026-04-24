/* mempool-mining-p2pool.js — Top 3 Pools live dashboard.
   Shows P2Pool (via p2pool.io/api/stats), MoneroOcean, SupportXMR. */
(function (global) {
    'use strict';

    function fmtHr(hs) {
        var n = Number(hs) || 0;
        if (n >= 1e12) return (n / 1e12).toFixed(2) + ' TH/s';
        if (n >= 1e9)  return (n / 1e9).toFixed(2)  + ' GH/s';
        if (n >= 1e6)  return (n / 1e6).toFixed(1)   + ' MH/s';
        return Math.round(n) + ' H/s';
    }

    var POOLS = [
        {
            key:      'p2pool',
            name:     'P2Pool',
            type:     'decentralized',
            fee:      '0%',
            minPay:   '0.0003 XMR',
            url:      'https://p2pool.io',
            color:    'var(--xmr)',
            apiUrl:   'https://p2pool.io/api/stats',
            parseLive: function (json) {
                var s = json && json.pool_statistics;
                if (!s) return null;
                return {
                    hashrate_hs:   Number(s.hashRate)           || 0,
                    miners:        Number(s.miners)             || 0,
                    blocks_found:  Number(s.totalBlocksFound)   || 0,
                    share_pct:     null   /* derived from network */
                };
            }
        },
        {
            key:      'moneroocean',
            name:     'MoneroOcean',
            type:     'centralized',
            fee:      '0%',
            minPay:   '0.003 XMR',
            url:      'https://moneroocean.stream',
            color:    '#3D8EFF',
            apiUrl:   'https://moneroocean.stream/api/pool/stats',
            parseLive: function (json) {
                var p = json && json.pool;
                if (!p) return null;
                return {
                    hashrate_hs:   Number(p.hashrate)           || 0,
                    miners:        Number(p.miners)             || 0,
                    blocks_found:  Number(p.totalBlocksFound)   || 0,
                    share_pct:     null
                };
            }
        },
        {
            key:      'supportxmr',
            name:     'SupportXMR',
            type:     'centralized',
            fee:      '0.6%',
            minPay:   '0.1 XMR',
            url:      'https://supportxmr.com',
            color:    '#00C97A',
            apiUrl:   null,   /* no public CORS-friendly API */
            parseLive: null
        }
    ];

    /* Fallback hashrates (MH/s) when live API unavailable */
    var FALLBACK = { p2pool: 403e6, moneroocean: 250e6, supportxmr: 180e6 };

    function MempoolMiningP2Pool() { this.container = null; }

    MempoolMiningP2Pool.prototype.init = function (ws, container) {
        this.container = container;
        this._render([]);   /* skeleton */
        this.refresh();
    };

    MempoolMiningP2Pool.prototype.refresh = function () {
        var self = this;
        /* Fetch network hashrate for share % + live pool APIs in parallel */
        var networkP = fetch('/api/xmr/network', { headers: { accept: 'application/json' } })
            .then(function (r) { return r.ok ? r.json() : {}; })
            .catch(function () { return {}; });

        var poolFetches = POOLS.map(function (pool) {
            if (!pool.apiUrl) return Promise.resolve(null);
            return fetch(pool.apiUrl, { headers: { accept: 'application/json' } })
                .then(function (r) { return r.ok ? r.json() : null; })
                .then(function (json) { return pool.parseLive ? pool.parseLive(json) : null; })
                .catch(function () { return null; });
        });

        Promise.all([networkP].concat(poolFetches)).then(function (results) {
            var net = results[0] || {};
            var networkHr = (Number(net.hashrate_ghs) || 5.3) * 1e9;
            var liveData = results.slice(1);

            var enriched = POOLS.map(function (pool, idx) {
                var live = liveData[idx];
                var hr = (live && live.hashrate_hs) || FALLBACK[pool.key] || 0;
                var share = networkHr > 0 ? (hr / networkHr * 100) : 0;
                return {
                    pool:     pool,
                    live:     !!live,
                    hr:       hr,
                    miners:   live ? live.miners : null,
                    share:    share,
                    blocks:   live ? live.blocks_found : null
                };
            });

            self._render(enriched);
        });
    };

    MempoolMiningP2Pool.prototype._render = function (data) {
        if (!this.container) return;

        var html =
            '<div class="mp-mining-card-head">' +
              '<h3 class="mp-mining-card-title">Top 3 Mining Pools — Live</h3>' +
              '<span class="mp-mining-card-sub" style="font-size:9px">P2Pool · MoneroOcean · SupportXMR</span>' +
            '</div>';

        if (!data.length) {
            html += '<p style="color:var(--text-muted);font-size:11px">Loading pool data…</p>';
            this.container.innerHTML = html;
            return;
        }

        html += '<div style="display:flex;flex-direction:column;gap:10px;margin-top:4px">';

        data.forEach(function (d) {
            var pool = d.pool;
            var liveDot = d.live
                ? '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:' + pool.color + ';box-shadow:0 0 4px ' + pool.color + ';margin-right:5px;vertical-align:middle"></span>'
                : '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--border-default);margin-right:5px;vertical-align:middle"></span>';

            var hrTxt  = d.live ? fmtHr(d.hr)  : '≈' + fmtHr(FALLBACK[pool.key] || 0);
            var shrTxt = d.share > 0 ? d.share.toFixed(1) + '%' : '—';
            var minTxt = d.miners != null ? d.miners.toLocaleString() + ' miners' : '';

            var shareBarW = Math.min(100, d.share || 0);
            var isP2P = pool.key === 'p2pool';

            html +=
                '<div style="background:var(--surface-0);border:1px solid ' +
                  (isP2P ? 'rgba(255,102,0,.22)' : 'var(--border-subtle)') +
                  ';border-radius:8px;padding:12px 14px">' +

                  '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
                    '<div style="display:flex;align-items:center;gap:6px">' +
                      liveDot +
                      '<a href="' + pool.url + '" target="_blank" rel="noopener noreferrer" ' +
                         'style="color:' + pool.color + ';text-decoration:none;font:600 12px/1 var(--font-mono)">' +
                         pool.name + '</a>' +
                      (isP2P ? '<span style="font:7px/1 var(--font-mono);padding:1px 4px;border-radius:2px;background:rgba(255,102,0,.12);color:var(--xmr);border:1px solid rgba(255,102,0,.2)">DECENTRALIZED</span>' : '') +
                    '</div>' +
                    '<span style="font:10px/1 var(--font-mono);color:var(--text-muted)">' + pool.fee + ' fee</span>' +
                  '</div>' +

                  /* Share bar */
                  '<div style="height:4px;background:var(--surface-2);border-radius:2px;margin-bottom:8px;overflow:hidden">' +
                    '<div style="height:100%;width:' + shareBarW.toFixed(1) + '%;background:' + pool.color + ';border-radius:2px;transition:width .4s ease-out"></div>' +
                  '</div>' +

                  /* Stats row */
                  '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px">' +
                    '<div><div style="font:8px/1 var(--font-mono);color:var(--text-muted);letter-spacing:.08em;text-transform:uppercase;margin-bottom:2px">Hashrate</div>' +
                         '<div style="font:600 12px/1 var(--font-mono);color:var(--text-primary)">' + hrTxt + '</div></div>' +
                    '<div><div style="font:8px/1 var(--font-mono);color:var(--text-muted);letter-spacing:.08em;text-transform:uppercase;margin-bottom:2px">Share</div>' +
                         '<div style="font:600 12px/1 var(--font-mono);color:' + pool.color + '">' + shrTxt + '</div></div>' +
                    '<div><div style="font:8px/1 var(--font-mono);color:var(--text-muted);letter-spacing:.08em;text-transform:uppercase;margin-bottom:2px">Min payout</div>' +
                         '<div style="font:11px/1 var(--font-mono);color:var(--text-secondary)">' + pool.minPay + '</div></div>' +
                  '</div>' +
                  (minTxt ? '<div style="margin-top:6px;font:9px/1 var(--font-mono);color:var(--text-muted)">' + minTxt + '</div>' : '') +

                '</div>';
        });

        html += '</div>';

        /* Add to vercel.json CSP note about p2pool.io and moneroocean.stream
           (already in CSP from previous fix) */

        this.container.innerHTML = html;
    };

    global.MempoolMiningP2Pool = new MempoolMiningP2Pool();
})(window);
