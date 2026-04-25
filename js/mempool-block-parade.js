/* mempool-block-parade.js — mempool.space-mirror block parade.
   Pending blocks on the LEFT of a center divider, confirmed blocks on the
   RIGHT with the newest adjacent to the divider. Tracker overlays (arrow,
   10-conf dashed line) live in a sibling .bp-overlay so they are NOT
   clipped by the .bp-wrap overflow context. Only genuinely new blocks
   animate in. */
(function (global) {
    'use strict';

    var REFRESH_MS    = 15000;
    var MAX_CONFIRMED = 12;
    var PENDING_COUNT = 2;
    var CONF_REQ      = 10;
    var AVG_BLOCK_SEC = 120;   /* Monero ~2 min */

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

    function shortTxid(t) {
        if (!t) return '…';
        return t.slice(0, 8) + '…' + t.slice(-4);
    }

    /* Map an avg fee rate (XMR per kB, rough) to one of four tiers.
       Thresholds are generous because Monero mempool is usually one-tier. */
    function feeTier(rate) {
        if (!rate || rate <= 0) return 'med';
        if (rate < 20000)       return 'low';
        if (rate < 80000)       return 'med';
        if (rate < 300000)      return 'high';
        return 'vhigh';
    }

    function tierForTxCount(n) {
        if (n < 15)  return 'quiet';
        if (n < 40)  return 'normal';
        if (n < 80)  return 'active';
        if (n < 160) return 'busy';
        return 'congested';
    }
    var TIER_GRADIENTS = {
        quiet:     'linear-gradient(0deg, rgba(140,88,255,.55), rgba(140,88,255,.12))',
        normal:    'linear-gradient(0deg, rgba(74,158,255,.65), rgba(74,158,255,.12))',
        active:    'linear-gradient(0deg, rgba(255,209,0,.7),  rgba(255,209,0,.12))',
        busy:      'linear-gradient(0deg, rgba(255,102,0,.8),  rgba(255,102,0,.15))',
        congested: 'linear-gradient(0deg, rgba(255,68,85,.85), rgba(255,68,85,.18))'
    };
    function gradientForTier(t) { return TIER_GRADIENTS[t] || TIER_GRADIENTS.normal; }

    function BlockParade(container, onBlockClick) {
        this.container    = container;
        this.onBlockClick = onBlockClick || null;
        this.blocks       = [];
        this.pending      = null;
        this.topHeight    = 0;
        this._timer       = null;
        this._prevHeights = Object.create(null);
        this._resizeTimer = 0;
        this._resizeHandler = null;

        /* Tracking state */
        this.trackedTxid   = null;
        this.trackedBlock  = null;
        this.trackedConfs  = 0;
        this.trackedStatus = 'none';   /* none | pending | confirming | confirmed */

        /* Highlight (block search nav — distinct from tx tracking) */
        this._highlightedBlock = null;

        /* Tx-count scale (Fix 3) — recomputed on every render */
        this._txScale = { max: 20 };

        /* Keyed-diff cache (Fix 4) — height → DOM node */
        this._confirmedNodes = Object.create(null);

        this._inject();
        this.refresh();
    }

    BlockParade.prototype.setTracked = function (txid, blockHeight, currentTip) {
        this.trackedTxid  = txid;
        this.trackedBlock = blockHeight || null;
        if (!blockHeight) {
            this.trackedConfs  = 0;
            this.trackedStatus = 'pending';
        } else {
            var tip = currentTip || (this.blocks[0] ? this.blocks[0].height : blockHeight);
            this.trackedConfs  = Math.max(0, tip - blockHeight + 1);
            this.trackedStatus = this.trackedConfs >= CONF_REQ ? 'confirmed' : 'confirming';
        }
        this.render();
    };

    BlockParade.prototype.clearTracked = function () {
        this.trackedTxid   = null;
        this.trackedBlock  = null;
        this.trackedConfs  = 0;
        this.trackedStatus = 'none';
        this.render();
    };

    BlockParade.prototype.highlightBlock = function (h) {
        this._highlightedBlock = h ? Number(h) : null;
        this._positionOverlays();
    };

    BlockParade.prototype.clearHighlight = function () {
        this._highlightedBlock = null;
        this._positionOverlays();
    };

    BlockParade.prototype.start = function () {
        var self = this;
        if (this._timer) return;
        this._timer = setInterval(function () { self.refresh(); }, REFRESH_MS);
    };

    BlockParade.prototype.stop = function () {
        if (this._timer) { clearInterval(this._timer); this._timer = null; }
    };

    BlockParade.prototype._inject = function () {
        this._injectCSS();

        var c = this.container;

        /* Sticky host wrapper (Fix 1) */
        var host = document.createElement('div');
        host.className = 'bp-host';

        /* Status bar */
        var statusBar = document.createElement('div');
        statusBar.className = 'bp-status-bar';
        statusBar.hidden = true;
        host.appendChild(statusBar);

        /* Outer positioning context */
        var outer = document.createElement('div');
        outer.className = 'bp-outer';

        var wrap = document.createElement('div');
        wrap.className = 'bp-wrap';

        var pendingGroup = document.createElement('div');
        pendingGroup.className = 'bp-pending-group';
        var divider = document.createElement('div');
        divider.className = 'bp-divider';
        var confirmedGroup = document.createElement('div');
        confirmedGroup.className = 'bp-confirmed-group';

        wrap.appendChild(pendingGroup);
        wrap.appendChild(divider);
        wrap.appendChild(confirmedGroup);

        /* Overlay — absolute, sibling of wrap, escapes overflow clipping */
        var overlay = document.createElement('div');
        overlay.className = 'bp-overlay';
        overlay.innerHTML =
            '<div class="bp-arrow" hidden>' +
              '<span class="bp-arrow-glyph">▲</span>' +
              '<span class="bp-arrow-label"></span>' +
            '</div>' +
            '<div class="bp-dotline" hidden>' +
              '<span class="bp-dotline-label">10 CONF · UNLOCK</span>' +
            '</div>' +
            '<div class="bp-offscreen-hint" hidden></div>';

        outer.appendChild(wrap);
        outer.appendChild(overlay);
        host.appendChild(outer);
        c.insertBefore(host, c.firstChild);

        var self = this;
        this._resizeHandler = function () {
            if (self._resizeTimer) clearTimeout(self._resizeTimer);
            self._resizeTimer = setTimeout(function () { self._positionOverlays(); }, 100);
        };
        window.addEventListener('resize', this._resizeHandler);
        wrap.addEventListener('scroll', function () { self._positionOverlays(); });
    };

    BlockParade.prototype._injectCSS = function () {
        if (document.getElementById('bp-css')) return;
        var style = document.createElement('style');
        style.id = 'bp-css';
        style.textContent = [
            '.bp-outer{position:relative;overflow:visible}',
            '.bp-wrap{overflow-x:auto;display:flex;align-items:center;gap:6px;padding:4px 0 8px;scrollbar-width:none}',
            '.bp-wrap::-webkit-scrollbar{display:none}',
            '.bp-pending-group,.bp-confirmed-group{display:flex;gap:6px;flex:0 0 auto}',
            '.bp-divider{flex:0 0 auto;width:1px;height:220px;background:var(--border-default);margin:0 10px;position:relative}',
            '.bp-divider::before{content:"\\2195";position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font:10px/1 "JetBrains Mono",monospace;color:var(--text-tertiary);background:var(--surface-0);padding:2px 1px}',

            /* Blocks — shared */
            '.bp-block{flex:0 0 128px;width:128px;min-height:210px;border-radius:8px;overflow:hidden;border:1px solid var(--border-subtle);background:var(--surface-1);display:flex;flex-direction:column;position:relative;transition:border-color .15s,transform .15s,box-shadow .15s}',
            '.bp-block:hover{border-color:var(--border-default);transform:translateY(-2px)}',
            '.bp-block-new{animation:bp-slide-in .4s ease-out}',
            '@keyframes bp-slide-in{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}',

            /* Confirmed */
            '.bp-block.is-confirmed{cursor:pointer}',
            '.bp-block.is-confirmed .bp-fill-area{background:rgba(140,88,255,.05)}',
            '.bp-fill-area{flex:1;position:relative;min-height:120px}',
            '.bp-fill-bar{position:absolute;bottom:0;left:0;right:0;transition:height .5s ease-out}',
            '.bp-fill-label{position:absolute;top:4px;right:5px;font:8px/1 "DM Mono",monospace;color:rgba(255,255,255,.45)}',
            '.bp-pool-badge{position:absolute;top:4px;left:5px;font:7px/1 "DM Mono",monospace;padding:1px 4px;border-radius:2px;background:rgba(255,102,0,.2);color:var(--xmr);letter-spacing:.04em}',

            /* Pending — fee tier colors */
            '.bp-block.is-pending{border-color:rgba(255,209,0,.35)}',
            '.bp-block.is-pending.tier-low{border-color:rgba(0,201,122,.45)}',
            '.bp-block.is-pending.tier-med{border-color:rgba(255,209,0,.55)}',
            '.bp-block.is-pending.tier-high{border-color:rgba(255,102,0,.55)}',
            '.bp-block.is-pending.tier-vhigh{border-color:rgba(255,90,90,.65)}',
            '.bp-block.is-pending.is-far{opacity:.75}',
            '.bp-pending-label{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font:9px/1 "DM Mono",monospace;color:var(--gold);opacity:.8;white-space:nowrap}',

            /* Meta */
            '.bp-meta{padding:6px 8px;display:flex;flex-direction:column;gap:2px}',
            '.bp-height{font:600 11px/1 "JetBrains Mono","DM Mono",monospace;color:var(--text-primary)}',
            '.bp-stats{font:9px/1 "DM Mono",monospace;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
            '.bp-age{font:9px/1 "DM Mono",monospace;color:var(--text-tertiary)}',

            /* Tracker overlay */
            '.bp-overlay{position:absolute;inset:0;overflow:visible;pointer-events:none}',
            '.bp-arrow{position:absolute;pointer-events:none;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;transition:left .6s ease,top .2s ease}',
            '.bp-arrow[hidden]{display:none}',
            '.bp-arrow-glyph{font:14px/1 "JetBrains Mono",monospace;color:var(--blue);text-shadow:0 0 8px rgba(74,158,255,.6)}',
            '.bp-arrow-label{font:700 9px/1 "DM Mono",monospace;color:var(--blue);letter-spacing:.1em;margin-top:3px;white-space:nowrap}',
            '.bp-arrow.is-confirmed .bp-arrow-glyph,.bp-arrow.is-confirmed .bp-arrow-label{color:var(--grn);text-shadow:0 0 8px rgba(0,201,122,.6)}',
            '.bp-arrow.is-pending .bp-arrow-glyph,.bp-arrow.is-pending .bp-arrow-label{color:var(--gold);text-shadow:0 0 8px rgba(255,209,0,.6)}',

            '.bp-dotline{position:absolute;top:0;bottom:0;border-left:2px dashed rgba(255,209,0,.55);transition:left .6s ease;pointer-events:none;width:0}',
            '.bp-dotline[hidden]{display:none}',
            '.bp-dotline-label{position:absolute;top:4px;left:4px;font:7px/1 "DM Mono",monospace;color:rgba(255,209,0,.8);writing-mode:vertical-lr;transform:rotate(180deg);letter-spacing:.12em;white-space:nowrap}',

            /* Status bar */
            '.bp-status-bar{display:flex;align-items:center;gap:8px;padding:7px 12px;margin-bottom:8px;border-radius:6px;font:10px/1 "DM Mono",monospace;flex-wrap:wrap}',
            '.bp-status-bar[hidden]{display:none}',
            '.bp-status-bar.bp-status-pending{background:rgba(255,209,0,.06);border:1px solid rgba(255,209,0,.25)}',
            '.bp-status-bar.bp-status-confirming{background:rgba(74,158,255,.06);border:1px solid rgba(74,158,255,.25)}',
            '.bp-status-bar.bp-status-confirmed{background:rgba(0,201,122,.06);border:1px solid rgba(0,201,122,.35)}',
            '.bp-status-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}',
            '.bp-dot-gold{background:var(--gold);box-shadow:0 0 4px var(--gold);animation:bp-pulse 2s ease-in-out infinite}',
            '.bp-dot-blue{background:var(--blue);box-shadow:0 0 4px var(--blue);animation:bp-pulse 1.5s ease-in-out infinite}',
            '.bp-dot-grn{background:var(--grn);box-shadow:0 0 4px var(--grn)}',
            '.bp-status-label{font-weight:700;color:var(--text-secondary);letter-spacing:.06em}',
            '.bp-status-sep{color:var(--text-tertiary)}',
            '.bp-status-msg{color:var(--text-primary);letter-spacing:.03em}',
            '.bp-status-need{color:var(--text-muted);font-size:9px;letter-spacing:.04em}',
            '.bp-status-clear{margin-left:auto;background:transparent;border:1px solid var(--border-subtle);color:var(--text-tertiary);font:10px/1 "DM Mono",monospace;padding:2px 7px;border-radius:3px;cursor:pointer;transition:color .15s,border-color .15s}',
            '.bp-status-clear:hover{color:var(--red);border-color:var(--red)}',
            '.bp-conf-bar{height:4px;width:60px;background:var(--surface-2);border-radius:2px;overflow:hidden}',
            '.bp-conf-fill{height:100%;background:var(--blue);border-radius:2px;transition:width .4s ease-out}',

            '@keyframes bp-pulse{from{opacity:.55}to{opacity:1}}',

            /* Sticky host (Fix 1) */
            '.bp-host{position:sticky;top:52px;z-index:30;background:var(--surface-0);padding:8px 12px 10px;margin:0 -12px 12px;border-bottom:1px solid var(--border-subtle)}',

            /* Tx-count tiers (Fix 3) */
            '.bp-tx-count{display:flex;align-items:baseline;gap:4px;font-family:"DM Mono",monospace}',
            '.bp-tx-num{font-size:14px;font-weight:700;color:var(--text-primary);font-variant-numeric:tabular-nums}',
            '.bp-tx-lbl{font-size:9px;color:var(--text-muted);letter-spacing:.1em;text-transform:uppercase}',
            '.bp-block.tier-quiet     .bp-height{color:rgba(140,88,255,.9)}',
            '.bp-block.tier-normal    .bp-height{color:rgba(74,158,255,.95)}',
            '.bp-block.tier-active    .bp-height{color:var(--gold)}',
            '.bp-block.tier-busy      .bp-height{color:var(--xmr)}',
            '.bp-block.tier-congested .bp-height{color:var(--red)}',

            /* Highlight arrow + off-range hint (Fix 5) */
            '.bp-arrow.is-highlight .bp-arrow-glyph,.bp-arrow.is-highlight .bp-arrow-label{color:var(--xmr);text-shadow:0 0 8px rgba(255,102,0,.5)}',
            '.bp-offscreen-hint{position:absolute;font:600 9px/1 "DM Mono",monospace;color:var(--text-tertiary);letter-spacing:.1em;text-transform:uppercase;white-space:nowrap;padding:4px 8px;border-radius:4px;background:var(--surface-2);border:1px solid var(--border-subtle);pointer-events:none}',
            '.bp-offscreen-hint[hidden]{display:none}',
            '.bp-offscreen-hint.is-visible{color:var(--xmr);border-color:rgba(255,102,0,.3)}'
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
            self.topHeight = blocks.length ? blocks[0].height : 0;
            self.blocks    = blocks.slice(0, MAX_CONFIRMED);
            self.pending   = res[1] || null;

            if (self.trackedBlock && self.blocks.length) {
                var tip = self.blocks[0].height;
                self.trackedConfs  = Math.max(0, tip - self.trackedBlock + 1);
                self.trackedStatus = self.trackedConfs >= CONF_REQ ? 'confirmed' : 'confirming';
            }

            self.render();
        });
    };

    BlockParade.prototype._renderStatusBar = function () {
        var bar = this.container.querySelector('.bp-status-bar');
        if (!bar) return;
        if (this.trackedStatus === 'none') {
            bar.hidden = true;
            bar.innerHTML = '';
            return;
        }
        bar.hidden = false;
        var self = this;
        var tx = shortTxid(this.trackedTxid);
        var cls, html;
        if (this.trackedStatus === 'pending') {
            cls = 'bp-status-pending';
            html =
                '<span class="bp-status-dot bp-dot-gold"></span>' +
                '<span class="bp-status-label">TRACKING ' + tx + '</span>' +
                '<span class="bp-status-sep">·</span>' +
                '<span class="bp-status-msg">⟳ UNCONFIRMED — awaiting block inclusion</span>' +
                '<button class="bp-status-clear" data-bp-clear title="Stop tracking">✕</button>';
        } else if (this.trackedStatus === 'confirming') {
            var need = CONF_REQ - this.trackedConfs;
            var pct  = Math.round((this.trackedConfs / CONF_REQ) * 100);
            cls = 'bp-status-confirming';
            html =
                '<span class="bp-status-dot bp-dot-blue"></span>' +
                '<span class="bp-status-label">TRACKING ' + tx + '</span>' +
                '<span class="bp-status-sep">·</span>' +
                '<span class="bp-status-msg">' + this.trackedConfs + '/10 CONFIRMATIONS</span>' +
                '<div class="bp-conf-bar"><div class="bp-conf-fill" style="width:' + pct + '%"></div></div>' +
                '<span class="bp-status-need">' + need + ' more block' + (need !== 1 ? 's' : '') + '</span>' +
                '<button class="bp-status-clear" data-bp-clear title="Stop tracking">✕</button>';
        } else {
            cls = 'bp-status-confirmed';
            html =
                '<span class="bp-status-dot bp-dot-grn"></span>' +
                '<span class="bp-status-label">TRACKING ' + tx + '</span>' +
                '<span class="bp-status-sep">·</span>' +
                '<span class="bp-status-msg">✓ FULLY CONFIRMED · ' + this.trackedConfs + ' CONFIRMATIONS</span>' +
                '<button class="bp-status-clear" data-bp-clear title="Stop tracking">✕</button>';
        }
        bar.className = 'bp-status-bar ' + cls;
        bar.innerHTML = html;
        var clr = bar.querySelector('[data-bp-clear]');
        if (clr) clr.addEventListener('click', function () { self.clearTracked(); });
    };

    BlockParade.prototype._makeConfirmedBlock = function (b, isNew) {
        var txCount  = Number(b.tx_count) || 0;
        var tier     = tierForTxCount(txCount);
        var scaleMax = (this._txScale && this._txScale.max) || 20;
        var pct      = Math.min(100, Math.round(txCount / scaleMax * 100));
        var isP2P    = /p2pool/i.test(b.pool_name || '');

        var el = document.createElement('div');
        el.className = 'bp-block is-confirmed tier-' + tier + (isNew ? ' bp-block-new' : '');
        el.setAttribute('data-height', b.height);

        el.innerHTML =
            '<div class="bp-fill-area">' +
              '<div class="bp-fill-bar" style="height:' + pct + '%;background:' + gradientForTier(tier) + '"></div>' +
              (isP2P ? '<div class="bp-pool-badge">P2P</div>' : '') +
            '</div>' +
            '<div class="bp-meta">' +
              '<div class="bp-height">#' + Number(b.height).toLocaleString() + '</div>' +
              '<div class="bp-tx-count"><span class="bp-tx-num">' + txCount + '</span><span class="bp-tx-lbl">txs</span></div>' +
              '<div class="bp-age">' + fmtAgo(b.timestamp) + '</div>' +
            '</div>';

        var self = this;
        el.addEventListener('click', function () {
            if (self.onBlockClick) self.onBlockClick(String(b.height));
        });
        return el;
    };

    BlockParade.prototype._updateConfirmedBlock = function (node, b) {
        var txCount  = Number(b.tx_count) || 0;
        var tier     = tierForTxCount(txCount);
        var scaleMax = (this._txScale && this._txScale.max) || 20;
        var pct      = Math.min(100, Math.round(txCount / scaleMax * 100));

        /* Strip prior tier-* class, re-apply current */
        var cls = node.className.split(/\s+/).filter(function (c) {
            return c && c.indexOf('tier-') !== 0;
        });
        cls.push('tier-' + tier);
        node.className = cls.join(' ');

        /* Fill bar — height + gradient (scaleMax may have shifted) */
        var bar = node.querySelector('.bp-fill-bar');
        if (bar) {
            bar.style.height = pct + '%';
            bar.style.background = gradientForTier(tier);
        }

        /* Tx count number */
        var num = node.querySelector('.bp-tx-num');
        if (num) num.textContent = txCount;

        /* Age tick */
        var age = node.querySelector('.bp-age');
        if (age) age.textContent = fmtAgo(b.timestamp);

        /* P2Pool badge — add/remove if pool changed */
        var isP2P = /p2pool/i.test(b.pool_name || '');
        var fillArea = node.querySelector('.bp-fill-area');
        var existingBadge = fillArea ? fillArea.querySelector('.bp-pool-badge') : null;
        if (isP2P && !existingBadge && fillArea) {
            var nb = document.createElement('div');
            nb.className = 'bp-pool-badge';
            nb.textContent = 'P2P';
            fillArea.insertBefore(nb, fillArea.firstChild);
        } else if (!isP2P && existingBadge) {
            existingBadge.parentNode.removeChild(existingBadge);
        }
    };

    BlockParade.prototype._makePendingBlock = function (opts) {
        var el = document.createElement('div');
        el.className = 'bp-block is-pending tier-' + opts.tier +
            (opts.isNext ? ' is-pending-next' : ' is-far');
        el.setAttribute('data-height', opts.height);

        var fill = opts.isNext ? Math.max(8, Math.min(100, opts.fillPct || 0)) : 6;
        var html =
            '<div class="bp-fill-area">' +
              '<div class="bp-fill-bar" style="height:' + fill + '%;background:linear-gradient(0deg,var(--gold),rgba(255,209,0,.18))"></div>' +
              '<div class="bp-pending-label">' + opts.label + '</div>' +
            '</div>' +
            '<div class="bp-meta">' +
              '<div class="bp-height" style="color:var(--gold)">~#' + Number(opts.height).toLocaleString() + '</div>' +
              '<div class="bp-stats">' + (opts.txCount != null ? opts.txCount + ' txs' : '—') + '</div>' +
              '<div class="bp-age" style="color:var(--gold)">' + opts.eta + '</div>' +
            '</div>';
        el.innerHTML = html;
        return el;
    };

    BlockParade.prototype.render = function () {
        var self = this;
        this._renderStatusBar();

        var pendingGroup   = this.container.querySelector('.bp-pending-group');
        var confirmedGroup = this.container.querySelector('.bp-confirmed-group');
        if (!pendingGroup || !confirmedGroup) return;

        var tip = this.blocks.length ? this.blocks[0].height : this.topHeight;

        /* Compute tx-count scale for tier coloring (Fix 3) */
        var txCounts = this.blocks.map(function (b) { return Number(b.tx_count) || 0; });
        this._txScale = { max: Math.max(20, txCounts.length ? Math.max.apply(null, txCounts) : 20) };

        /* ── Pending group ───────────────────────────────────────── */
        var mp = this.pending || {};
        var recent = Array.isArray(mp.recent_txs) ? mp.recent_txs : [];
        var avgRate = 0;
        if (recent.length) {
            var sum = 0, n = 0;
            for (var i = 0; i < recent.length; i++) {
                var r = Number(recent[i].fee_rate);
                if (r > 0) { sum += r; n++; }
            }
            avgRate = n > 0 ? sum / n : 0;
        }
        var nextTier = avgRate > 0 ? feeTier(avgRate) : 'med';   /* fallback gold */
        var farTier  = 'low';                                     /* dim green */

        var projFill = mp.projected_block && mp.projected_block.fill_pct != null
            ? mp.projected_block.fill_pct : 0;
        var pendTxs  = mp.tx_count != null ? mp.tx_count : null;

        var pendingFrag = document.createDocumentFragment();
        /* Far-future block first (FAR LEFT), then next-to-mine adjacent to divider. */
        pendingFrag.appendChild(this._makePendingBlock({
            height:  tip ? tip + 2 : '—',
            isNext:  false,
            tier:    farTier,
            fillPct: 0,
            txCount: null,
            label:   '⟳ QUEUED',
            eta:     'In ~4 min'
        }));
        pendingFrag.appendChild(this._makePendingBlock({
            height:  tip ? tip + 1 : '—',
            isNext:  true,
            tier:    nextTier,
            fillPct: projFill,
            txCount: pendTxs,
            label:   '⟳ NEXT',
            eta:     'In ~2 min'
        }));
        pendingGroup.replaceChildren(pendingFrag);

        /* ── Confirmed group: keyed DOM diff ─────────────────────── */
        var wanted = Object.create(null);
        for (var j0 = 0; j0 < this.blocks.length; j0++) wanted[this.blocks[j0].height] = true;

        /* Remove nodes no longer in wanted set */
        var heights = Object.keys(this._confirmedNodes);
        for (var k0 = 0; k0 < heights.length; k0++) {
            var h = heights[k0];
            if (!wanted[h]) {
                var gone = this._confirmedNodes[h];
                if (gone && gone.parentNode) gone.parentNode.removeChild(gone);
                delete this._confirmedNodes[h];
            }
        }

        var nextPrev = Object.create(null);
        var newCreated = [];
        for (var j = 0; j < this.blocks.length; j++) {
            var b = this.blocks[j];
            var node = this._confirmedNodes[b.height];
            if (node) {
                this._updateConfirmedBlock(node, b);
            } else {
                var isNew = !this._prevHeights[b.height];
                node = this._makeConfirmedBlock(b, isNew);
                this._confirmedNodes[b.height] = node;
                if (isNew) newCreated.push(node);
            }
            /* Reorder: position j must match confirmedGroup.children[j] */
            var atJ = confirmedGroup.children[j];
            if (atJ !== node) confirmedGroup.insertBefore(node, atJ || null);
            nextPrev[b.height] = true;
        }
        this._prevHeights = nextPrev;

        /* Strip .bp-block-new only on freshly created nodes */
        if (newCreated.length) {
            setTimeout(function () {
                for (var k = 0; k < newCreated.length; k++) newCreated[k].classList.remove('bp-block-new');
            }, 450);
        }

        requestAnimationFrame(function () { self._positionOverlays(); });
    };

    BlockParade.prototype._positionOverlays = function () {
        var outer   = this.container.querySelector('.bp-outer');
        var overlay = this.container.querySelector('.bp-overlay');
        if (!outer || !overlay) return;
        var arrow   = overlay.querySelector('.bp-arrow');
        var dotline = overlay.querySelector('.bp-dotline');
        var hint    = overlay.querySelector('.bp-offscreen-hint');
        if (!arrow || !dotline) return;

        var outerRect = outer.getBoundingClientRect();

        /* Arrow priority: pending → tracked → highlight */
        var trackedEl = null;
        var mode = 'none';
        var offRangeHeight = null;

        if (this.trackedStatus === 'pending') {
            trackedEl = this.container.querySelector('.bp-block.is-pending-next');
            if (trackedEl) mode = 'pending';
        } else if (this.trackedBlock) {
            trackedEl = this.container.querySelector('.bp-block[data-height="' + this.trackedBlock + '"]');
            if (trackedEl) mode = 'tracked';
            else offRangeHeight = this.trackedBlock;
        }
        if (mode === 'none' && this._highlightedBlock != null) {
            trackedEl = this.container.querySelector('.bp-block[data-height="' + this._highlightedBlock + '"]');
            if (trackedEl) mode = 'highlight';
            else offRangeHeight = this._highlightedBlock;
        }

        arrow.classList.remove('is-pending', 'is-confirmed', 'is-highlight');
        if (mode === 'none' || !trackedEl) {
            arrow.hidden = true;
        } else {
            arrow.hidden = false;
            var label = arrow.querySelector('.bp-arrow-label');
            if (mode === 'pending') {
                arrow.classList.add('is-pending');
                if (label) label.textContent = '⟳ UNCONF';
            } else if (mode === 'tracked') {
                if (this.trackedConfs >= CONF_REQ) arrow.classList.add('is-confirmed');
                if (label) label.textContent = this.trackedConfs >= CONF_REQ
                    ? '✓ 10/10' : (this.trackedConfs + '/10');
            } else { /* highlight */
                arrow.classList.add('is-highlight');
                if (label) label.textContent = '#' + Number(this._highlightedBlock).toLocaleString();
            }
            var r = trackedEl.getBoundingClientRect();
            arrow.style.left = (r.left + r.width / 2 - outerRect.left) + 'px';
            arrow.style.top  = (r.bottom - outerRect.top + 6) + 'px';
        }

        /* Dotline (tracked only — 10-conf unlock) */
        if (!this.trackedBlock) {
            dotline.hidden = true;
        } else {
            var tenthH  = this.trackedBlock + (CONF_REQ - 1);
            var tenthEl = this.container.querySelector('.bp-block[data-height="' + tenthH + '"]');
            if (!tenthEl) {
                dotline.hidden = true;
            } else {
                dotline.hidden = false;
                var tr = tenthEl.getBoundingClientRect();
                dotline.style.left = (tr.left - outerRect.left - 4) + 'px';
            }
        }

        /* Off-range hint */
        if (hint) {
            if (offRangeHeight == null) {
                hint.hidden = true;
            } else {
                var tip = this.blocks.length ? this.blocks[0].height : this.topHeight;
                var back = tip ? (tip - offRangeHeight) : 0;
                var isTracked = (this.trackedBlock === offRangeHeight);
                hint.hidden = false;
                hint.classList.toggle('is-visible', isTracked);
                hint.textContent = '→ #' + Number(offRangeHeight).toLocaleString() +
                    (back > 0 ? ' (' + back + ' back)' : '');
                var cg = this.container.querySelector('.bp-confirmed-group');
                if (cg) {
                    var cgr = cg.getBoundingClientRect();
                    hint.style.right = (outerRect.right - cgr.right + 4) + 'px';
                    hint.style.left  = 'auto';
                    hint.style.top   = (cgr.top - outerRect.top + cgr.height / 2 - 10) + 'px';
                }
            }
        }
    };

    global.BlockParade = BlockParade;
})(window);
