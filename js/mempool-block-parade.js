/* mempool-block-parade.js — Scrolling block parade for Explorer mode.
   Fetches recent blocks + mempool state. Renders horizontal strip
   of confirmed blocks (newest on right of the confirmed section)
   plus a pending (mempool) block. Animated slide-in on new block. */
(function (global) {
    'use strict';

    var REFRESH_MS = 15000;
    var MAX_BLOCKS = 8;

    function fmtAgo(ts) {
        if (!ts) return '—';
        var s = Math.max(0, Math.floor(Date.now() / 1000) - Number(ts));
        if (s < 60)   return s + 's ago';
        if (s < 3600) return Math.floor(s / 60) + 'm ago';
        return Math.floor(s / 3600) + 'h ago';
    }

    function fmtBytes(b) {
        if (!b) return '—';
        if (b < 1024) return b + ' B';
        return (b / 1024).toFixed(1) + ' KB';
    }

    function BlockParade(container, onBlockClick) {
        this.container   = container;
        this.onBlockClick = onBlockClick || null;
        this.blocks      = [];
        this.pending     = null;
        this.topHeight   = 0;
        this._timer      = null;
        this._inject();
        this.refresh();
    }

    BlockParade.prototype._inject = function () {
        /* Inject CSS once */
        if (document.getElementById('bp-css')) return;
        var style = document.createElement('style');
        style.id = 'bp-css';
        style.textContent = [
            '.bp-wrap{overflow-x:auto;display:flex;gap:8px;padding:0 0 8px;margin-bottom:16px;scrollbar-width:none}',
            '.bp-wrap::-webkit-scrollbar{display:none}',
            '.bp-block{flex:0 0 132px;border-radius:8px;overflow:hidden;cursor:pointer;border:1px solid var(--border-subtle);background:var(--surface-1);display:flex;flex-direction:column;transition:border-color .15s,transform .15s;animation:bp-in .3s ease-out}',
            '.bp-block:hover{border-color:var(--border-default);transform:translateY(-2px)}',
            '.bp-block.is-p2pool{border-color:rgba(255,102,0,.4)}',
            '.bp-block.is-pending{border-color:rgba(255,209,0,.35);animation:bp-pulse 2s ease-in-out infinite alternate}',
            '.bp-fill-area{height:56px;position:relative;background:var(--surface-2)}',
            '.bp-fill-bar{position:absolute;bottom:0;left:0;right:0;transition:height .5s ease-out}',
            '.bp-fill-label{position:absolute;top:4px;right:5px;font:8px/1 "DM Mono",monospace;color:rgba(255,255,255,.45)}',
            '.bp-pool-badge{position:absolute;top:4px;left:5px;font:7px/1 "DM Mono",monospace;padding:1px 4px;border-radius:2px;background:rgba(255,102,0,.2);color:var(--xmr);letter-spacing:.04em}',
            '.bp-meta{flex:1;padding:6px 8px;display:flex;flex-direction:column;gap:2px}',
            '.bp-height{font:600 11px/1 "JetBrains Mono","DM Mono",monospace;color:var(--text-primary)}',
            '.bp-stats{font:9px/1 "DM Mono",monospace;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
            '.bp-age{font:9px/1 "DM Mono",monospace;color:var(--text-tertiary)}',
            '.bp-divider{width:1px;flex:0 0 1px;background:var(--border-subtle);align-self:stretch;margin:0 2px}',
            '.bp-pending-label{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font:9px/1 "DM Mono",monospace;color:var(--gold);opacity:.8;white-space:nowrap}',
            '@keyframes bp-in{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}',
            '@keyframes bp-pulse{from{border-color:rgba(255,209,0,.2)}to{border-color:rgba(255,209,0,.55)}}'
        ].join('');
        document.head.appendChild(style);
    };

    BlockParade.prototype.refresh = function () {
        var self = this;
        Promise.all([
            fetch('/api/xmr/blocks', { headers: { accept: 'application/json' } })
                .then(function (r) { return r.ok ? r.json() : []; })
                .catch(function () { return []; }),
            fetch('/api/xmr?_p=mempool', { headers: { accept: 'application/json' } })
                .then(function (r) { return r.ok ? r.json() : null; })
                .catch(function () { return null; })
        ]).then(function (res) {
            var blocks  = res[0] || [];
            var mempool = res[1] || null;
            var newTop  = blocks.length ? blocks[0].height : 0;
            var isNew   = newTop > self.topHeight && self.topHeight > 0;
            self.topHeight = newTop;
            self.blocks  = blocks.slice(0, MAX_BLOCKS);
            self.pending = mempool;
            self.render(isNew);

            /* Notify tx tracker of new chain tip so it can re-apply overlays
               after the parade's innerHTML was rebuilt. */
            if (window.TxTracker && self.blocks.length) {
                window.TxTracker.onBlocksUpdate(self.blocks);
            }
        });
    };

    BlockParade.prototype.render = function (animate) {
        var self = this;
        var wrap = this.container.querySelector('.bp-wrap');
        if (!wrap) {
            wrap = document.createElement('div');
            wrap.className = 'bp-wrap';
            this.container.insertBefore(wrap, this.container.firstChild);
        }

        var html = '';

        /* Confirmed blocks — render oldest first (left) to newest (right before divider) */
        var ordered = this.blocks.slice().reverse();
        ordered.forEach(function (b) {
            var fillPct   = b.block_weight_limit > 0
                ? Math.min(100, Math.round(b.block_weight / b.block_weight_limit * 100))
                : 0;
            var fillColor = fillPct > 80
                ? 'linear-gradient(0deg,var(--xmr),rgba(255,102,0,.35))'
                : fillPct > 40
                ? 'linear-gradient(0deg,var(--blue),rgba(74,158,255,.25))'
                : 'linear-gradient(0deg,rgba(74,158,255,.5),rgba(74,158,255,.1))';
            var isP2P     = /p2pool/i.test(b.pool_name || '');
            var cls       = 'bp-block' + (isP2P ? ' is-p2pool' : '') + (animate ? '' : '');

            html +=
                '<div class="' + cls + '" data-height="' + b.height + '">' +
                  '<div class="bp-fill-area">' +
                    '<div class="bp-fill-bar" style="height:' + fillPct + '%;background:' + fillColor + '"></div>' +
                    (isP2P ? '<div class="bp-pool-badge">P2P</div>' : '') +
                    '<div class="bp-fill-label">' + fillPct + '%</div>' +
                  '</div>' +
                  '<div class="bp-meta">' +
                    '<div class="bp-height">#' + Number(b.height).toLocaleString() + '</div>' +
                    '<div class="bp-stats">' + (b.tx_count || 0) + ' txs · ' + fmtBytes(b.block_weight) + '</div>' +
                    '<div class="bp-age">' + fmtAgo(b.timestamp) + '</div>' +
                  '</div>' +
                '</div>';
        });

        /* Divider between confirmed and pending */
        html += '<div class="bp-divider"></div>';

        /* Pending (mempool) block */
        var pb = this.pending;
        var pbFill   = pb && pb.projected_block ? Math.min(100, pb.projected_block.fill_pct || 0) : 0;
        var pbTxs    = pb ? (pb.tx_count || 0) : 0;
        var estHeight = this.topHeight > 0 ? this.topHeight + 1 : '—';
        html +=
            '<div class="bp-block is-pending">' +
              '<div class="bp-fill-area">' +
                '<div class="bp-fill-bar" style="height:' + pbFill + '%;background:linear-gradient(0deg,var(--gold),rgba(255,209,0,.2))"></div>' +
                '<div class="bp-pending-label">⟳ NEXT</div>' +
              '</div>' +
              '<div class="bp-meta">' +
                '<div class="bp-height" style="color:var(--gold)">~#' + (typeof estHeight === 'number' ? estHeight.toLocaleString() : estHeight) + '</div>' +
                '<div class="bp-stats">' + pbTxs + ' txs · ' + pbFill + '% full</div>' +
                '<div class="bp-age" style="color:var(--gold)">~2 min</div>' +
              '</div>' +
            '</div>';

        wrap.innerHTML = html;

        /* Scroll newest confirmed block into view (right side of confirmed area) */
        wrap.scrollLeft = 0;

        /* Wire click handlers */
        wrap.querySelectorAll('.bp-block[data-height]').forEach(function (el) {
            el.addEventListener('click', function () {
                var h = el.getAttribute('data-height');
                if (h && self.onBlockClick) self.onBlockClick(h);
            });
        });
    };

    BlockParade.prototype.start = function () {
        var self = this;
        if (this._timer) return;
        this._timer = setInterval(function () { self.refresh(); }, REFRESH_MS);
    };

    BlockParade.prototype.stop = function () {
        if (this._timer) { clearInterval(this._timer); this._timer = null; }
        this._timer = null;
    };

    global.BlockParade = BlockParade;
})(window);
