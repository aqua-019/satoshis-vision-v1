/* mempool-block-parade.js — Scrolling block parade for Explorer mode.
   Fetches recent blocks + mempool state. Renders horizontal strip
   of confirmed blocks (newest on right of the confirmed section)
   plus a pending (mempool) block. Animated slide-in on new block.

   Monero TX tracking is integrated directly into the parade:
     - Status bar above the strip (TRACKING <txid> · N/10 CONF)
     - ★ marker + colored glow on the TX's block
     - ▲ arrow + confirmation label beneath the TX's block
     - Dotted vertical line at the 10-confirmation threshold
       (XMR unlock point). Left of line = fully confirmed/unlocked. */
(function (global) {
    'use strict';

    var REFRESH_MS = 15000;
    var MAX_BLOCKS = 8;
    var CONF_REQ   = 10;

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
        this.container    = container;
        this.onBlockClick = onBlockClick || null;
        this.blocks       = [];
        this.pending      = null;
        this.topHeight    = 0;
        this._timer       = null;

        /* Tracking state */
        this.trackedTxid   = null;
        this.trackedBlock  = null;   /* confirmed block height of TX */
        this.trackedConfs  = 0;
        this.trackedStatus = 'none'; /* 'none' | 'pending' | 'confirming' | 'confirmed' */
        this._statusBar    = null;

        this._inject();
        this.refresh();
    }

    BlockParade.prototype.setTracked = function (txid, blockHeight, currentTip) {
        this.trackedTxid  = txid;
        this.trackedBlock = blockHeight || null;   /* null = still in mempool */
        if (!blockHeight) {
            this.trackedConfs  = 0;
            this.trackedStatus = 'pending';
        } else {
            var tip = currentTip || (this.blocks[0] ? this.blocks[0].height : blockHeight);
            this.trackedConfs  = Math.max(0, tip - blockHeight + 1);
            this.trackedStatus = this.trackedConfs >= CONF_REQ ? 'confirmed' : 'confirming';
        }
        this.render(false);
    };

    BlockParade.prototype.clearTracked = function () {
        this.trackedTxid   = null;
        this.trackedBlock  = null;
        this.trackedConfs  = 0;
        this.trackedStatus = 'none';
        this.render(false);
    };

    BlockParade.prototype._inject = function () {
        /* Inject CSS once */
        if (document.getElementById('bp-css')) return;
        var style = document.createElement('style');
        style.id = 'bp-css';
        style.textContent = [
            /* Parade strip */
            '.bp-wrap{overflow-x:auto;display:flex;align-items:flex-start;gap:6px;padding:0 0 8px;margin-bottom:4px;scrollbar-width:none}',
            '.bp-wrap::-webkit-scrollbar{display:none}',

            /* Cells wrap block + tracker below */
            '.bp-cell{display:flex;flex-direction:column;align-items:center;gap:0}',

            /* Block cards */
            '.bp-block{flex:0 0 132px;width:132px;border-radius:8px;overflow:hidden;cursor:pointer;border:1px solid var(--border-subtle);background:var(--surface-1);display:flex;flex-direction:column;transition:border-color .15s,transform .15s,box-shadow .15s;animation:bp-in .3s ease-out}',
            '.bp-block:hover{border-color:var(--border-default);transform:translateY(-2px)}',
            '.bp-block.is-p2pool{border-color:rgba(255,102,0,.4)}',
            '.bp-block.is-pending{border-color:rgba(255,209,0,.35);animation:bp-pulse 2s ease-in-out infinite alternate}',

            /* Tracked block variants */
            '.bp-block-tracked-live{border-color:rgba(74,158,255,.6)!important;box-shadow:0 0 12px rgba(74,158,255,.15)}',
            '.bp-block-tracked-done{border-color:rgba(0,201,122,.6)!important;box-shadow:0 0 12px rgba(0,201,122,.15)}',
            '.bp-tx-star{position:absolute;top:4px;right:5px;font-size:11px;color:var(--gold);text-shadow:0 0 6px var(--gold)}',

            /* Fill area */
            '.bp-fill-area{height:56px;position:relative;background:var(--surface-2)}',
            '.bp-fill-bar{position:absolute;bottom:0;left:0;right:0;transition:height .5s ease-out}',
            '.bp-fill-label{position:absolute;top:4px;right:5px;font:8px/1 "DM Mono",monospace;color:rgba(255,255,255,.45)}',
            '.bp-pool-badge{position:absolute;top:4px;left:5px;font:7px/1 "DM Mono",monospace;padding:1px 4px;border-radius:2px;background:rgba(255,102,0,.2);color:var(--xmr);letter-spacing:.04em}',
            '.bp-pending-label{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font:9px/1 "DM Mono",monospace;color:var(--gold);opacity:.8;white-space:nowrap}',

            /* Meta row */
            '.bp-meta{flex:1;padding:6px 8px;display:flex;flex-direction:column;gap:2px}',
            '.bp-height{font:600 11px/1 "JetBrains Mono","DM Mono",monospace;color:var(--text-primary)}',
            '.bp-stats{font:9px/1 "DM Mono",monospace;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
            '.bp-age{font:9px/1 "DM Mono",monospace;color:var(--text-tertiary)}',
            '.bp-divider{width:1px;flex:0 0 1px;background:var(--border-subtle);align-self:stretch;margin:0 2px}',

            /* Arrow + label under tracked block */
            '.bp-tracker-arrow{font-size:14px;line-height:1;margin-top:2px;text-shadow:0 0 6px currentColor}',
            '.bp-tracker-label{font:700 8px/1 "DM Mono",monospace;letter-spacing:.08em;text-transform:uppercase;margin-top:1px;white-space:nowrap}',
            '.bp-arrow-gold{color:var(--gold)}.bp-label-gold{color:var(--gold)}',
            '.bp-arrow-blue{color:var(--blue)}.bp-label-blue{color:var(--blue)}',
            '.bp-arrow-grn{color:var(--grn)}.bp-label-grn{color:var(--grn)}',

            /* Dotted vertical confirmation threshold line */
            '.bp-dotline{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;width:20px;position:relative;align-self:stretch}',
            '.bp-dotline-inner{width:1px;flex:1;border-left:2px dashed rgba(255,209,0,.45);margin:0 auto}',
            '.bp-dotline-label{font:7px/1 "DM Mono",monospace;color:rgba(255,209,0,.6);letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;position:absolute;bottom:4px;writing-mode:vertical-lr;transform:rotate(180deg);transform-origin:center}',

            /* Status bar above parade */
            '.bp-status-bar{display:flex;align-items:center;gap:8px;padding:7px 12px;margin-bottom:8px;border-radius:6px;font:10px/1 "DM Mono",monospace;flex-wrap:wrap}',
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

            /* Confirmation progress bar */
            '.bp-conf-bar{height:4px;width:60px;background:var(--surface-2);border-radius:2px;overflow:hidden}',
            '.bp-conf-fill{height:100%;background:var(--blue);border-radius:2px;transition:width .4s ease-out}',

            /* Keyframes */
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

            /* Update tracked confirmation count */
            if (self.trackedBlock && self.blocks.length) {
                var tip = self.blocks[0].height;
                self.trackedConfs  = Math.max(0, tip - self.trackedBlock + 1);
                self.trackedStatus = self.trackedConfs >= CONF_REQ ? 'confirmed' : 'confirming';
            }

            self.render(isNew);

            /* Re-render to update confirmation count in status bar */
            if (self.trackedStatus !== 'none') {
                self.render(false);
            }

            /* Back-compat: notify legacy TxTracker if still present (no-op when
               tracker state is 'none'). Safe to leave — won't double-render. */
            if (window.TxTracker && self.blocks.length) {
                window.TxTracker.onBlocksUpdate(self.blocks);
            }
        });
    };

    BlockParade.prototype.render = function (animate) {
        var self = this;
        var container = this.container;
        var isTracking = this.trackedStatus !== 'none';

        /* ── STATUS BAR ─────────────────────────────────────────── */
        var statusBar = container.querySelector('.bp-status-bar');
        if (!statusBar) {
            statusBar = document.createElement('div');
            statusBar.className = 'bp-status-bar';
            container.insertBefore(statusBar, container.firstChild);
        }
        if (!isTracking) {
            statusBar.hidden = true;
            statusBar.innerHTML = '';
        } else {
            statusBar.hidden = false;
            var txShort = this.trackedTxid
                ? this.trackedTxid.slice(0, 8) + '…' + this.trackedTxid.slice(-4)
                : '…';
            var statusContent, statusCls;
            if (this.trackedStatus === 'pending') {
                statusCls     = 'bp-status-pending';
                statusContent =
                    '<span class="bp-status-dot bp-dot-gold"></span>' +
                    '<span class="bp-status-label">TRACKING ' + txShort + '</span>' +
                    '<span class="bp-status-sep">·</span>' +
                    '<span class="bp-status-msg">⟳ UNCONFIRMED — awaiting block inclusion</span>' +
                    '<button class="bp-status-clear" data-bp-clear title="Stop tracking">✕</button>';
            } else if (this.trackedStatus === 'confirming') {
                var need = CONF_REQ - this.trackedConfs;
                var pct  = Math.round((this.trackedConfs / CONF_REQ) * 100);
                statusCls     = 'bp-status-confirming';
                statusContent =
                    '<span class="bp-status-dot bp-dot-blue"></span>' +
                    '<span class="bp-status-label">TRACKING ' + txShort + '</span>' +
                    '<span class="bp-status-sep">·</span>' +
                    '<span class="bp-status-msg">' + this.trackedConfs + '/10 CONFIRMATIONS</span>' +
                    '<div class="bp-conf-bar"><div class="bp-conf-fill" style="width:' + pct + '%"></div></div>' +
                    '<span class="bp-status-need">' + need + ' more block' + (need !== 1 ? 's' : '') + '</span>' +
                    '<button class="bp-status-clear" data-bp-clear title="Stop tracking">✕</button>';
            } else {
                statusCls     = 'bp-status-confirmed';
                statusContent =
                    '<span class="bp-status-dot bp-dot-grn"></span>' +
                    '<span class="bp-status-label">TRACKING ' + txShort + '</span>' +
                    '<span class="bp-status-sep">·</span>' +
                    '<span class="bp-status-msg">✓ FULLY CONFIRMED · ' + this.trackedConfs + ' CONFIRMATIONS</span>' +
                    '<button class="bp-status-clear" data-bp-clear title="Stop tracking">✕</button>';
            }
            statusBar.className = 'bp-status-bar ' + statusCls;
            statusBar.innerHTML = statusContent;
            var clearBtn = statusBar.querySelector('[data-bp-clear]');
            if (clearBtn) clearBtn.addEventListener('click', function () { self.clearTracked(); });
        }

        /* ── BLOCK PARADE WRAP ───────────────────────────────────── */
        var wrap = container.querySelector('.bp-wrap');
        if (!wrap) {
            wrap = document.createElement('div');
            wrap.className = 'bp-wrap';
            if (statusBar.nextSibling) {
                container.insertBefore(wrap, statusBar.nextSibling);
            } else {
                container.appendChild(wrap);
            }
        }

        /* Build block list: oldest first (left) → pending (rightmost) */
        var ordered = this.blocks.slice().reverse();   /* oldest at index 0 */
        var html = '';

        /* Determine dotted line position.
           The dotted line is placed BETWEEN the block at (trackedBlock + 9)
           and the block at (trackedBlock + 10), i.e. after the 10th confirmation.
           Everything LEFT  of the line = fully confirmed zone.
           Everything RIGHT of the line = still confirming / pending zone. */
        var dotAfterHeight = this.trackedBlock ? (this.trackedBlock + 9) : null;

        ordered.forEach(function (b) {
            var fillPct   = b.block_weight_limit > 0
                ? Math.min(100, Math.round(b.block_weight / b.block_weight_limit * 100))
                : 45;
            var fillColor = fillPct > 80
                ? 'linear-gradient(0deg,var(--xmr),rgba(255,102,0,.35))'
                : fillPct > 40
                ? 'linear-gradient(0deg,var(--blue),rgba(74,158,255,.25))'
                : 'linear-gradient(0deg,rgba(74,158,255,.45),rgba(74,158,255,.08))';
            var isP2P    = /p2pool/i.test(b.pool_name || '');
            var isTx     = self.trackedBlock && b.height === self.trackedBlock;
            var txCls    = isTx
                ? (self.trackedStatus === 'confirmed' ? ' bp-block-tracked-done' : ' bp-block-tracked-live')
                : '';
            var p2pCls   = isP2P ? ' is-p2pool' : '';

            /* Arrow + label beneath tracked block */
            var trackerHtml = '';
            if (isTx) {
                if (self.trackedStatus === 'confirmed') {
                    trackerHtml =
                        '<div class="bp-tracker-arrow bp-arrow-grn">▲</div>' +
                        '<div class="bp-tracker-label bp-label-grn">✓ CONFIRMED</div>';
                } else {
                    trackerHtml =
                        '<div class="bp-tracker-arrow bp-arrow-blue">▲</div>' +
                        '<div class="bp-tracker-label bp-label-blue">' +
                            self.trackedConfs + '/10</div>';
                }
            }

            html +=
                '<div class="bp-cell">' +
                  '<div class="bp-block' + p2pCls + txCls + '" data-height="' + b.height + '">' +
                    '<div class="bp-fill-area">' +
                      '<div class="bp-fill-bar" style="height:' + fillPct + '%;background:' + fillColor + '"></div>' +
                      (isP2P ? '<div class="bp-pool-badge">P2P</div>' : '') +
                      (isTx  ? '<div class="bp-tx-star">★</div>' : '') +
                      '<div class="bp-fill-label">' + fillPct + '%</div>' +
                    '</div>' +
                    '<div class="bp-meta">' +
                      '<div class="bp-height">#' + Number(b.height).toLocaleString() + '</div>' +
                      '<div class="bp-stats">' + (b.tx_count || 0) + ' txs · ' + fmtBytes(b.block_weight) + '</div>' +
                      '<div class="bp-age">' + fmtAgo(b.timestamp) + '</div>' +
                    '</div>' +
                  '</div>' +
                  trackerHtml +
                '</div>';

            /* Insert dotted line AFTER this block if it's the 10th-conf position */
            if (dotAfterHeight && b.height === dotAfterHeight) {
                html +=
                    '<div class="bp-dotline" title="10-confirmation threshold · XMR unlock point">' +
                      '<div class="bp-dotline-inner"></div>' +
                      '<div class="bp-dotline-label">10 CONF</div>' +
                    '</div>';
            }
        });

        /* Divider line between confirmed and pending */
        html += '<div class="bp-divider"></div>';

        /* Pending block */
        var pb     = this.pending;
        var pbFill = pb && pb.projected_block ? Math.min(100, pb.projected_block.fill_pct || 0) : 0;
        var pbTxs  = pb ? (pb.tx_count || 0) : 0;
        var estH   = this.blocks[0] ? this.blocks[0].height + 1 : '—';
        var isPendingTracked = isTracking && this.trackedStatus === 'pending';

        html +=
            '<div class="bp-cell">' +
              '<div class="bp-block is-pending' + (isPendingTracked ? ' bp-block-tracked-live' : '') + '">' +
                '<div class="bp-fill-area">' +
                  '<div class="bp-fill-bar" style="height:' + pbFill + '%;background:linear-gradient(0deg,var(--gold),rgba(255,209,0,.18))"></div>' +
                  '<div class="bp-pending-label">⟳ NEXT</div>' +
                '</div>' +
                '<div class="bp-meta">' +
                  '<div class="bp-height" style="color:var(--gold)">~#' + (typeof estH === 'number' ? estH.toLocaleString() : estH) + '</div>' +
                  '<div class="bp-stats">' + pbTxs + ' txs · ' + pbFill + '% full</div>' +
                  '<div class="bp-age" style="color:var(--gold)">~2 min</div>' +
                '</div>' +
              '</div>' +
              (isPendingTracked
                ? '<div class="bp-tracker-arrow bp-arrow-gold">▲</div><div class="bp-tracker-label bp-label-gold">⟳ UNCONF</div>'
                : '') +
            '</div>';

        wrap.innerHTML = html;

        /* Wire block click handlers */
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
