/* mempool-mining-health.js — M4 Task 12: Network Health Bar.
   Renders 7 stat chips (+ protocol version tooltip) inside #mp-mining-health.
   Data source: XmrRelayWS.fetchNetwork().  Re-renders on every update(). */
(function (global) {
    'use strict';

    function fmtHashrate(ghs) {
        var n = Number(ghs) || 0;
        if (n >= 1000) return (n / 1000).toFixed(2) + ' TH/s';
        if (n >= 1)    return n.toFixed(2) + ' GH/s';
        return (n * 1000).toFixed(1) + ' MH/s';
    }

    function fmtDifficulty(d) {
        var n = Number(d) || 0;
        if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
        if (n >= 1e9)  return (n / 1e9).toFixed(2)  + 'G';
        if (n >= 1e6)  return (n / 1e6).toFixed(1)  + 'M';
        if (n >= 1e3)  return (n / 1e3).toFixed(1)  + 'K';
        return '' + n;
    }

    function fmtInt(n) {
        return (Number(n) || 0).toLocaleString('en-US');
    }

    function fmtTarget(seconds) {
        var s = Math.max(0, Math.round(seconds || 120));
        var m = Math.floor(s / 60), r = s % 60;
        return m + ':' + (r < 10 ? '0' : '') + r + ' min';
    }

    var FORKS = {
        16: 'Hard fork 16 — CLSAG + Bulletproofs+',
        15: 'Hard fork 15 — mandatory ring size 16',
        14: 'Hard fork 14 — CLSAG signatures',
    };

    function MempoolMiningHealth() { this.container = null; this.ws = null; this._last = null; }

    MempoolMiningHealth.prototype.init = function (ws, container) {
        this.ws = ws;
        this.container = container;
        this.render({});              // initial empty shell
        this.refresh();
    };

    MempoolMiningHealth.prototype.refresh = function () {
        if (!this.ws || !this.container) return Promise.resolve();
        var self = this;
        return this.ws.fetchNetwork().then(function (data) {
            self._last = data || {};
            self.render(self._last);
        }).catch(function (err) {
            if (self.ws && self.ws.debug) console.warn('[mining-health] fetchNetwork failed', err);
        });
    };

    MempoolMiningHealth.prototype.render = function (d) {
        d = d || {};
        var peers    = (d.peer_count != null) ? d.peer_count : '—';
        var incoming = (d.incoming_peers != null) ? d.incoming_peers : '—';
        var protoV   = (d.major_version != null) ? ('v' + d.major_version) : '—';
        var tooltip  = FORKS[d.major_version] || 'Monero network protocol version';

        var chips = [
            { k: 'HEIGHT',        v: fmtInt(d.height),                  cls: 'accent-xmr' },
            { k: 'DIFFICULTY',    v: fmtDifficulty(d.difficulty),       cls: '' },
            { k: 'HASHRATE',      v: fmtHashrate(d.hashrate_ghs),       cls: 'accent-grn' },
            { k: 'BLOCK TARGET',  v: fmtTarget(d.target_seconds || 120), cls: '' },
            { k: 'PEERS',         v: peers + ' (' + incoming + ' in)',  cls: '' },
            { k: 'ALL-TIME TXS',  v: fmtDifficulty(d.tx_count_total),   cls: '' },
            { k: 'PROTOCOL',      v: protoV,                            cls: '', title: tooltip }
        ];

        var html = chips.map(function (c) {
            var t = c.title ? (' title="' + c.title.replace(/"/g, '&quot;') + '"') : '';
            return '<div class="mp-mining-chip"' + t + '>' +
                   '<span class="k">' + c.k + '</span>' +
                   '<span class="v ' + c.cls + '">' + (c.v || '—') + '</span>' +
                   '</div>';
        }).join('');

        this.container.innerHTML = html;
    };

    global.MempoolMiningHealth = new MempoolMiningHealth();
})(window);
