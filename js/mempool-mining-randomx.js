/* mempool-mining-randomx.js — M4 Task 13: RandomX seed hash tracker.
   Monero-exclusive. Rotates every 2,048 blocks (~68h). */
(function (global) {
    'use strict';

    var SEED_PERIOD = 2048;
    var BLOCK_SECS  = 120;

    function fmtHours(h) {
        if (h < 1) return Math.round(h * 60) + ' min';
        if (h < 24) return h.toFixed(1) + ' hours';
        return (h / 24).toFixed(1) + ' days';
    }

    function MempoolMiningRandomX() { this.container = null; this.ws = null; }

    MempoolMiningRandomX.prototype.init = function (ws, container) {
        this.ws = ws;
        this.container = container;
        this.renderShell();
        this.refresh();
    };

    MempoolMiningRandomX.prototype.renderShell = function () {
        this.container.innerHTML =
            '<div class="mp-mining-card-head">' +
              '<h3 class="mp-mining-card-title">RandomX Seed Hash — Monero-exclusive</h3>' +
              '<span class="mp-mining-card-sub">Rotates every 2,048 blocks (~68 hours)</span>' +
            '</div>' +
            '<div class="hash" data-role="hash">—</div>' +
            '<div class="progress"><div class="fill" data-role="fill" style="width:0%"></div></div>' +
            '<div class="meta" data-role="meta"></div>' +
            '<p class="explainer">' +
              'RandomX generates a 2&nbsp;GB dataset from this seed hash. Every 2,048 ' +
              'blocks (~68 hours), the seed changes and miners must regenerate the dataset. ' +
              'The 2&nbsp;GB working set makes specialized ASIC hardware economically unviable — ' +
              'your gaming CPU competes on equal footing.' +
            '</p>';
    };

    MempoolMiningRandomX.prototype.refresh = function () {
        if (!this.ws || !this.container) return Promise.resolve();
        var self = this;
        return this.ws.fetchNetwork().then(function (d) { self.update(d || {}); })
            .catch(function (err) {
                if (self.ws && self.ws.debug) console.warn('[mining-randomx] fetch failed', err);
            });
    };

    MempoolMiningRandomX.prototype.update = function (d) {
        if (!this.container) return;
        var height = Number(d.height) || 0;
        var seed   = d.randomx_seed_hash || '';
        var hashEl = this.container.querySelector('[data-role="hash"]');
        var fillEl = this.container.querySelector('[data-role="fill"]');
        var metaEl = this.container.querySelector('[data-role="meta"]');

        if (hashEl) hashEl.textContent = seed || '—';

        if (!height || !seed) {
            if (fillEl) fillEl.style.width = '0%';
            if (metaEl) metaEl.innerHTML = '<span>Awaiting network data…</span>';
            return;
        }

        var since       = height % SEED_PERIOD;
        var remaining   = SEED_PERIOD - since;
        var pct         = (since / SEED_PERIOD) * 100;
        var nextBlock   = height + remaining;
        var hours       = (remaining * BLOCK_SECS) / 3600;

        if (fillEl) fillEl.style.width = pct.toFixed(1) + '%';
        if (metaEl) {
            metaEl.innerHTML =
                '<span>Progress: <b>' + since.toLocaleString() + ' / ' + SEED_PERIOD + '</b> blocks (' + pct.toFixed(1) + '%)</span>' +
                '<span>Next rotation: block <b>#' + nextBlock.toLocaleString() + '</b></span>' +
                '<span>In <b>~' + remaining.toLocaleString() + '</b> blocks (~' + fmtHours(hours) + ')</span>';
        }
    };

    global.MempoolMiningRandomX = new MempoolMiningRandomX();
})(window);
