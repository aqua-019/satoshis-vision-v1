/* mempool-mining-pool.js — M4 Task 18: pool distribution donut + table.
   Renders a Canvas 2D donut chart plus a companion table inside
   #mp-mining-pool. Colors are keyed by pool name via POOL_COLORS;
   unknown pools fall back to a greyscale palette. */
(function (global) {
    'use strict';

    var POOL_COLORS = {
        'P2Pool':       '--xmr',
        'SupportXMR':   '--grn',
        'MoneroOcean':  '--blue',
        'HashVault':    '--gold',
        '2Miners':      '#AA44FF',
        'Nanopool':     '#FF6699',
        'C3Pool':       '#44FFAA',
        'Solo/Unknown': '--surface-3'
    };
    var FALLBACKS = ['#888888', '#CC66AA', '#66CCAA', '#AACC66', '#6688CC', '#CCAA66'];

    function resolveColor(pool, idx) {
        var raw = POOL_COLORS[pool.name];
        if (!raw) return FALLBACKS[idx % FALLBACKS.length];
        if (raw.charAt(0) !== '-') return raw;
        return (global.MPChart && global.MPChart.cssVar(raw)) || '#888';
    }

    function MempoolMiningPool() {
        this.container = null;
        this.ws = null;
        this.pools = [];
        this.canvas = null;
        this.tableEl = null;
        this._unsub = null;
        this._hoverIdx = -1;
    }

    MempoolMiningPool.prototype.init = function (ws, container) {
        this.ws = ws;
        this.container = container;
        this.renderShell();
        this.refresh();
        var self = this;
        if (global.MPChart && this.canvas) {
            this._unsub = global.MPChart.observeResize(this.canvas, function () { self.draw(); });
        }
    };

    MempoolMiningPool.prototype.renderShell = function () {
        this.container.innerHTML =
            '<div class="mp-mining-card-head">' +
              '<h3 class="mp-mining-card-title">Pool Distribution · last 1,000 blocks</h3>' +
              '<span class="mp-mining-card-sub" data-role="sub">Loading…</span>' +
            '</div>' +
            '<div class="mp-mining-pool-body">' +
              '<canvas data-role="canvas"></canvas>' +
              '<div data-role="table"></div>' +
            '</div>' +
            '<p class="mp-mining-card-sub" style="margin-top:10px">' +
              'Bitcoin identifies pools by coinbase scriptSig patterns. Monero identifies pools ' +
              'by UTF-8 tag strings embedded in the miner_tx.extra field — unknown tags are ' +
              'classified as Solo/Unknown.' +
            '</p>';

        this.canvas = this.container.querySelector('[data-role="canvas"]');
        this.tableEl = this.container.querySelector('[data-role="table"]');

        var self = this;
        this.canvas.addEventListener('mousemove', function (ev) {
            var rect = self.canvas.getBoundingClientRect();
            var mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
            var idx = self.hitSlice(mx, my);
            if (idx !== self._hoverIdx) { self._hoverIdx = idx; self.draw(); }
        });
        this.canvas.addEventListener('mouseleave', function () {
            if (self._hoverIdx !== -1) { self._hoverIdx = -1; self.draw(); }
        });
    };

    MempoolMiningPool.prototype.hitSlice = function (mx, my) {
        if (!this.pools.length) return -1;
        var W = this.canvas.clientWidth, H = this.canvas.clientHeight;
        var cx = W / 2, cy = H / 2;
        var R = Math.min(W, H) / 2 - 4;
        var dx = mx - cx, dy = my - cy;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < R * 0.42 || d > R) return -1;
        var ang = Math.atan2(dy, dx);
        ang += Math.PI / 2; if (ang < 0) ang += Math.PI * 2;
        var total = this.pools.reduce(function (s, p) { return s + (p.block_count || 0); }, 0);
        if (!total) return -1;
        var acc = 0;
        for (var i = 0; i < this.pools.length; i++) {
            var sweep = ((this.pools[i].block_count || 0) / total) * Math.PI * 2;
            if (ang >= acc && ang < acc + sweep) return i;
            acc += sweep;
        }
        return -1;
    };

    MempoolMiningPool.prototype.refresh = function () {
        if (!this.ws || !this.container) return Promise.resolve();
        var self = this;
        return this.ws.fetchPools().then(function (data) {
            self.pools = (data && data.pools) || [];
            self.draw();
            self.renderTable(data && data.period_blocks);
            var sub = self.container.querySelector('[data-role="sub"]');
            if (sub) sub.textContent = self.pools.length + ' pools tracked';
        }).catch(function (err) {
            if (self.ws && self.ws.debug) console.warn('[mining-pool] fetch failed', err);
        });
    };

    MempoolMiningPool.prototype.draw = function () {
        if (!this.canvas) return;
        var utils = global.MPChart;
        if (utils) utils.setupCanvas(this.canvas, this.canvas.clientHeight || 180);
        var ctx = this.canvas.getContext('2d');
        var W = this.canvas.clientWidth, H = this.canvas.clientHeight;
        ctx.clearRect(0, 0, W, H);
        if (!this.pools.length) return;

        var cx = W / 2, cy = H / 2;
        var R = Math.min(W, H) / 2 - 4;
        var total = this.pools.reduce(function (s, p) { return s + (p.block_count || 0); }, 0) || 1;
        var angle = -Math.PI / 2;
        var bg = (utils && utils.cssVar('--surface-0')) || '#0A0A0C';
        var hole = (utils && utils.cssVar('--surface-1')) || '#111114';

        for (var i = 0; i < this.pools.length; i++) {
            var sweep = ((this.pools[i].block_count || 0) / total) * Math.PI * 2;
            var color = resolveColor(this.pools[i], i);
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, R, angle, angle + sweep);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.globalAlpha = (this._hoverIdx === -1 || this._hoverIdx === i) ? 1 : 0.35;
            ctx.fill();
            ctx.strokeStyle = bg;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            angle += sweep;
        }
        ctx.globalAlpha = 1;

        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.42, 0, Math.PI * 2);
        ctx.fillStyle = hole;
        ctx.fill();

        if (this._hoverIdx > -1) {
            var p = this.pools[this._hoverIdx];
            ctx.fillStyle = (utils && utils.cssVar('--text-primary')) || '#E8E8EC';
            ctx.font = '11px "DM Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(p.name, cx, cy - 2);
            ctx.font = '10px "DM Mono", monospace';
            ctx.fillStyle = (utils && utils.cssVar('--text-secondary')) || '#90909A';
            ctx.fillText(((p.percentage || 0).toFixed(1)) + '%', cx, cy + 12);
        }
    };

    MempoolMiningPool.prototype.renderTable = function (period) {
        if (!this.tableEl) return;
        var rows = this.pools.map(function (p, i) {
            var swatch = '<span class="swatch" style="background:' + resolveColor(p, i) + '"></span>';
            var name = p.url && p.url !== 'defunct'
                ? '<a href="' + p.url + '" target="_blank" rel="noopener noreferrer">' + p.name + '</a>'
                : p.name;
            var type = p.type ? p.type.charAt(0).toUpperCase() + p.type.slice(1) : '—';
            var last = p.last_block_height ? '#' + Number(p.last_block_height).toLocaleString() : '—';
            return '<tr>' +
                   '<td>' + swatch + name + '</td>' +
                   '<td>' + (p.block_count || 0) + '</td>' +
                   '<td>' + ((p.percentage || 0).toFixed(1)) + '%</td>' +
                   '<td>' + type + '</td>' +
                   '<td>' + last + '</td>' +
                   '</tr>';
        }).join('');

        var caption = period
            ? '<caption style="caption-side:bottom;text-align:right;font-size:9px;color:var(--text-tertiary);padding-top:4px">period: ' + period + ' blocks</caption>'
            : '';

        this.tableEl.innerHTML =
            '<table class="mp-mining-pool-table">' +
              caption +
              '<thead><tr>' +
                '<th>Pool</th><th>Blocks</th><th>Share</th><th>Type</th><th>Last block</th>' +
              '</tr></thead>' +
              '<tbody>' + (rows || '<tr><td colspan="5">—</td></tr>') + '</tbody>' +
            '</table>';
    };

    global.MempoolMiningPool = new MempoolMiningPool();
})(window);
