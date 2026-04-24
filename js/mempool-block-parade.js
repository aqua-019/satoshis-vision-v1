/* mempool-block-parade.js — mempool.space-mirror block parade.
   Pending blocks on the LEFT of a center divider, confirmed blocks on the
   RIGHT with the newest adjacent to the divider. Tracker overlays (arrow,
   10-conf dashed line) live in a sibling .bp-overlay so they are NOT
   clipped by the .bp-wrap overflow context. Only genuinely new blocks
   animate in. */
(function (global) {
    'use strict';

    var REFRESH_MS    = 15000;
    var MAX_CONFIRMED = 12;   /* API returns 15; render up to 12 so a 10-conf line has blocks on both sides */
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

    /* Tier is driven by absolute tx count, not the normalized %, so an
       80-tx block always reads as "busy" even on a day every other
       block has 200. */
    function tierForTxCount(n) {
        n = Number(n) || 0;
        if (n < 15)  return 'quiet';
        if (n < 40)  return 'normal';
        if (n < 80)  return 'active';
        if (n < 160) return 'busy';
        return 'congested';
    }
    var GRADIENTS = {
        quiet:     'linear-gradient(0deg, rgba(140,88,255,.55), rgba(140,88,255,.12))',
        normal:    'linear-gradient(0deg, rgba(74,158,255,.65), rgba(74,158,255,.12))',
        active:    'linear-gradient(0deg, rgba(255,209,0,.7),  rgba(255,209,0,.12))',
        busy:      'linear-gradient(0deg, rgba(255,102,0,.8),  rgba(255,102,0,.15))',
        congested: 'linear-gradient(0deg, rgba(255,68,85,.85), rgba(255,68,85,.18))'
    };
    function gradientForTier(t) { return GRADIENTS[t] || GRADIENTS.normal; }

    function BlockParade(container, onBlockClick) {
        this.container    = container;
        this.onBlockClick = onBlockClick || null;
        this.blocks       = [];
        this.pending      = null;
        this.topHeight    = 0;
        this._timer       = null;
        this._confirmedNodes = Object.create(null);
        this._txScale     = { max: 20 };
        this._resizeTimer = 0;
        this._resizeHandler = null;

        /* Tracking state */
        this.trackedTxid      = null;
        this.trackedBlock     = null;
        this.trackedConfs     = 0;
        this.trackedStatus    = 'none';   /* none | pending | confirming | confirmed */
        this._highlightedBlock = null;     /* purely visual "point at this block" */

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

    /* Purely visual "point the arrow at this block" — independent of TX
       lifecycle tracking. Used when navigating to a block detail view. */
    BlockParade.prototype.highlightBlock = function (height) {
        this._highlightedBlock = height ? Number(height) : null;
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
        /* Status bar */
        var statusBar = document.createElement('div');
        statusBar.className = 'bp-status-bar';
        statusBar.hidden = true;

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

        /* Wrap status-bar + outer in a shared .bp-host so sticky positioning
           can pin both together. Prepend into the container so the parade is
           the FIRST child of #mp-panel-explorer (the explorer panel renders
           ~2,000px of tx detail below it otherwise). */
        var host = document.createElement('div');
        host.className = 'bp-host';
        host.appendChild(statusBar);
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
            '.bp-fill-bar{position:absolute;bottom:0;left:0;right:0;transition:height .5s ease-out,background .3s ease}',
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

            /* Sticky host so parade stays visible while scrolling a tx/block detail */
            '.bp-host{position:sticky;top:var(--nav-height,60px);z-index:30;background:var(--surface-0);padding:8px 12px 10px;margin:0 -12px 12px;border-bottom:1px solid var(--border-subtle)}',

            /* Tx-count meta (replaces weight %) */
            '.bp-tx-count{display:flex;align-items:baseline;gap:4px;font-family:"DM Mono",monospace}',
            '.bp-tx-num{font-size:14px;font-weight:700;color:var(--text-primary);font-variant-numeric:tabular-nums}',
            '.bp-tx-lbl{font-size:9px;color:var(--text-muted);letter-spacing:.1em;text-transform:uppercase}',

            /* Tier tint on height label — at-a-glance activity */
            '.bp-block.tier-quiet .bp-height{color:rgba(140,88,255,.9)}',
            '.bp-block.tier-normal .bp-height{color:rgba(74,158,255,.95)}',
            '.bp-block.tier-active .bp-height{color:var(--gold)}',
            '.bp-block.tier-busy .bp-height{color:var(--xmr)}',
            '.bp-block.tier-congested .bp-height{color:var(--red)}',

            /* Highlight arrow (block view, not TX tracking) */
            '.bp-arrow.is-highlight .bp-arrow-glyph,.bp-arrow.is-highlight .bp-arrow-label{color:var(--xmr);text-shadow:0 0 8px rgba(255,102,0,.5)}',
            /* is-confirming mirrors the default blue tracking color (same as base) */

            /* Off-range hint — tracked/highlighted block not in visible range */
            '.bp-offscreen-hint{position:absolute;transform:translate(6px,-50%);font:600 9px/1 "DM Mono",monospace;color:var(--text-tertiary);letter-spacing:.1em;text-transform:uppercase;white-space:nowrap;padding:4px 8px;border-radius:4px;background:var(--surface-2);border:1px solid var(--border-subtle);pointer-events:none}',
            '.bp-offscreen-hint[hidden]{display:none}',
            '.bp-offscreen-hint.is-visible{color:var(--xmr);border-color:rgba(255,102,0,.3)}',

            '@keyframes bp-pulse{from{opacity:.55}to{opacity:1}}'
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
        var txCount = Number(b.tx_count) || 0;
        var scale   = this._txScale || { max: 20 };
        var pct     = Math.min(100, Math.round((txCount / scale.max) * 100));
        var tier    = tierForTxCount(txCount);
        var isP2P   = /p2pool/i.test(b.pool_name || '');

        var el = document.createElement('div');
        el.className = 'bp-block is-confirmed tier-' + tier + (isNew ? ' bp-block-new' : '');
        el.setAttribute('data-height', b.height);

        var html =
            '<div class="bp-fill-area">' +
              '<div class="bp-fill-bar" style="height:' + pct + '%;background:' + gradientForTier(tier) + '"></div>' +
              (isP2P ? '<div class="bp-pool-badge">P2P</div>' : '') +
            '</div>' +
            '<div class="bp-meta">' +
              '<div class="bp-height">#' + Number(b.height).toLocaleString() + '</div>' +
              '<div class="bp-tx-count">' +
                '<span class="bp-tx-num">' + txCount + '</span>' +
                '<span class="bp-tx-lbl">txs</span>' +
              '</div>' +
              '<div class="bp-age">' + fmtAgo(b.timestamp) + '</div>' +
            '</div>';
        el.innerHTML = html;

        var self = this;
        el.addEventListener('click', function () {
            if (self.onBlockClick) self.onBlockClick(String(b.height));
        });
        return el;
    };

    /* Update a persistent confirmed-block node in place. Age ticks each
       refresh; tier/fill can shift when _txScale.max rebalances (e.g. a
       very-busy block enters the window). */
    BlockParade.prototype._updateConfirmedBlock = function (node, b) {
        var age = node.querySelector('.bp-age');
        if (age) age.textContent = fmtAgo(b.timestamp);

        var txCount = Number(b.tx_count) || 0;
        var scale = this._txScale || { max: 20 };
        var pct = Math.min(100, Math.round((txCount / scale.max) * 100));
        var tier = tierForTxCount(txCount);

        node.classList.remove('tier-quiet', 'tier-normal', 'tier-active', 'tier-busy', 'tier-congested');
        node.classList.add('tier-' + tier);

        var fill = node.querySelector('.bp-fill-bar');
        if (fill) {
            fill.style.height = pct + '%';
            fill.style.background = gradientForTier(tier);
        }

        var num = node.querySelector('.bp-tx-num');
        if (num) num.textContent = txCount;
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

        /* ── Confirmed group: true keyed DOM diff ───────────────── */
        /* Compute tx-count scale. Floor at 20 so a quiet chain doesn't
           render every block as 100% full. */
        var txCounts = this.blocks.map(function (b) { return b.tx_count || 0; });
        this._txScale = { max: Math.max(20, Math.max.apply(null, txCounts.length ? txCounts : [20])) };

        var wanted = Object.create(null);
        this.blocks.forEach(function (b) { wanted[b.height] = true; });

        if (!this._confirmedNodes) this._confirmedNodes = Object.create(null);

        /* Remove nodes no longer wanted */
        Object.keys(this._confirmedNodes).forEach(function (h) {
            if (!wanted[h]) {
                self._confirmedNodes[h].remove();
                delete self._confirmedNodes[h];
            }
        });

        /* Create-or-update each wanted block, ensure correct position.
           blocks is newest-first → index 0 is the DOM's first child
           (adjacent to the divider on the confirmed side). */
        this.blocks.forEach(function (b, idx) {
            var node = self._confirmedNodes[b.height];
            if (!node) {
                node = self._makeConfirmedBlock(b, true);
                self._confirmedNodes[b.height] = node;
            } else {
                self._updateConfirmedBlock(node, b);
            }
            var currentAtIdx = confirmedGroup.children[idx];
            if (currentAtIdx !== node) {
                confirmedGroup.insertBefore(node, currentAtIdx || null);
            }
        });

        /* Strip .bp-block-new after animation completes so re-renders don't
           re-trigger. */
        setTimeout(function () {
            Object.keys(self._confirmedNodes).forEach(function (h) {
                self._confirmedNodes[h].classList.remove('bp-block-new');
            });
        }, 450);

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

        var outerRect      = outer.getBoundingClientRect();
        var confirmedGroup = this.container.querySelector('.bp-confirmed-group');

        /* Arrow priority: pending > tracked-block > highlight > none */
        var target   = null;   /* height the arrow wants to point at (if any) */
        var targetEl = null;
        var mode     = null;   /* 'pending' | 'confirming' | 'confirmed' | 'highlight' */

        if (this.trackedStatus === 'pending') {
            targetEl = this.container.querySelector('.bp-block.is-pending-next');
            mode = 'pending';
        } else if (this.trackedBlock) {
            target   = this.trackedBlock;
            targetEl = this.container.querySelector('.bp-block[data-height="' + this.trackedBlock + '"]');
            mode     = this.trackedConfs >= CONF_REQ ? 'confirmed' : 'confirming';
        } else if (this._highlightedBlock) {
            target   = this._highlightedBlock;
            targetEl = this.container.querySelector('.bp-block[data-height="' + this._highlightedBlock + '"]');
            mode     = 'highlight';
        }

        arrow.classList.remove('is-pending', 'is-confirming', 'is-confirmed', 'is-highlight');
        if (!targetEl || !mode) {
            arrow.hidden = true;
        } else {
            arrow.hidden = false;
            arrow.classList.add('is-' + mode);
            var r = targetEl.getBoundingClientRect();
            arrow.style.left = (r.left + r.width / 2 - outerRect.left) + 'px';
            arrow.style.top  = (r.bottom - outerRect.top + 6) + 'px';

            var label = arrow.querySelector('.bp-arrow-label');
            if (label) {
                if      (mode === 'pending')    label.textContent = '⟳ UNCONF';
                else if (mode === 'confirmed')  label.textContent = '✓ 10/10';
                else if (mode === 'confirming') label.textContent = this.trackedConfs + '/10';
                else if (mode === 'highlight')  label.textContent = '#' + Number(this._highlightedBlock).toLocaleString();
            }
        }

        /* Dotline — only when a TX is bound to a block (not for highlight-only). */
        if (!this.trackedBlock) {
            dotline.hidden = true;
        } else {
            var tenthH = this.trackedBlock + (CONF_REQ - 1);
            var tenthEl = this.container.querySelector('.bp-block[data-height="' + tenthH + '"]');
            if (!tenthEl) {
                dotline.hidden = true;
            } else {
                dotline.hidden = false;
                var tr = tenthEl.getBoundingClientRect();
                dotline.style.left = (tr.left - outerRect.left - 4) + 'px';
            }
        }

        /* Off-range hint — target height known but not in visible blocks. */
        if (hint && confirmedGroup) {
            if (target && !targetEl) {
                hint.hidden = false;
                hint.classList.toggle('is-visible', !!this._highlightedBlock || this.trackedStatus !== 'none');
                var tipH = this.blocks.length ? this.blocks[0].height : this.topHeight;
                var back = Math.max(0, Number(tipH) - Number(target));
                hint.textContent = '→ #' + Number(target).toLocaleString() + ' (' + back + ' back)';
                var cRect = confirmedGroup.getBoundingClientRect();
                hint.style.left = (cRect.right - outerRect.left) + 'px';
                hint.style.top  = (cRect.top  - outerRect.top + cRect.height / 2) + 'px';
            } else {
                hint.hidden = true;
            }
        }
    };

    global.BlockParade = BlockParade;
})(window);
