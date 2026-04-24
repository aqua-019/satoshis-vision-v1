/* mempool-tx-tracker.js
   Monero transaction tracker for the block parade.
   Inspired by mempool.space's blockchain-blocks.component.ts:
     arrowLeftPx = blockIndex * blockOffset + blockPadding
     CSS border trick for triangle arrow
     transition: left 2s so arrow slides with block animations

   XMR innovation over BTC:
     - 10-confirmation threshold (XMR unlock time)
     - Dotted vertical line at the 10-conf position
     - Confirmation progress bar (1→10)
     - Line slides left with blocks; when TX block passes it = CONFIRMED
*/
(function (global) {
    'use strict';

    var BLOCK_W  = 132;   /* bp-block flex-basis in px */
    var GAP      = 8;     /* bp-wrap gap in px (matches mempool-block-parade.js) */
    var CELL_W   = BLOCK_W + GAP;   /* total width per block cell */
    var CONF_REQ = 10;    /* XMR unlock confirmations */

    /* ── State ────────────────────────────────────────────────── */
    var state = {
        txid:       null,
        blockHeight: null,   /* null = pending (mempool) */
        confs:       0,
        status:      'none', /* none | pending | confirming | confirmed */
        chainTip:    0,
    };

    /* ── CSS injection (once) ──────────────────────────────────── */
    function injectCSS() {
        if (document.getElementById('tx-tracker-css')) return;
        var s = document.createElement('style');
        s.id = 'tx-tracker-css';
        s.textContent = [

            /* Status bar above parade */
            '.tt-bar{display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:7px;',
            'font:600 10px/1 "DM Mono","JetBrains Mono",monospace;letter-spacing:.06em;',
            'margin-bottom:10px;flex-wrap:wrap;position:relative;overflow:hidden;}',

            '.tt-bar.tt-pending{background:rgba(255,209,0,.07);border:1px solid rgba(255,209,0,.3);}',
            '.tt-bar.tt-confirming{background:rgba(74,158,255,.07);border:1px solid rgba(74,158,255,.3);}',
            '.tt-bar.tt-confirmed{background:rgba(0,201,122,.07);border:1px solid rgba(0,201,122,.4);}',

            /* Shimmer fill on status bar = progress toward 10 conf */
            '.tt-bar::before{content:"";position:absolute;inset:0;opacity:.08;',
            'background:linear-gradient(90deg,currentColor var(--tt-pct,0%),transparent var(--tt-pct,0%));',
            'pointer-events:none;border-radius:inherit;}',

            /* Dot indicator */
            '.tt-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}',
            '.tt-pending .tt-dot{background:var(--gold);box-shadow:0 0 5px var(--gold);animation:tt-blink 1.6s ease-in-out infinite;}',
            '.tt-confirming .tt-dot{background:var(--blue);box-shadow:0 0 5px var(--blue);animation:tt-blink 1.2s ease-in-out infinite;}',
            '.tt-confirmed .tt-dot{background:var(--grn);box-shadow:0 0 5px var(--grn);}',
            '@keyframes tt-blink{0%,100%{opacity:1}50%{opacity:.3}}',

            /* Labels */
            '.tt-txid{color:var(--text-secondary);letter-spacing:.02em;font-weight:400;}',
            '.tt-sep{color:var(--text-tertiary);}',
            '.tt-msg{letter-spacing:.04em;}',
            '.tt-pending .tt-msg{color:var(--gold);}',
            '.tt-confirming .tt-msg{color:var(--blue);}',
            '.tt-confirmed .tt-msg{color:var(--grn);}',

            /* Confirmation progress bar */
            '.tt-prog-wrap{display:flex;align-items:center;gap:6px;margin-left:auto;}',
            '.tt-prog{height:4px;width:80px;background:var(--surface-2);border-radius:2px;overflow:hidden;}',
            '.tt-prog-fill{height:100%;border-radius:2px;transition:width .5s ease-out;}',
            '.tt-confirming .tt-prog-fill{background:var(--blue);}',
            '.tt-confirmed .tt-prog-fill{background:var(--grn);}',
            '.tt-prog-label{font-size:9px;color:var(--text-muted);letter-spacing:.04em;white-space:nowrap;}',

            /* Dismiss button */
            '.tt-dismiss{margin-left:4px;background:transparent;border:1px solid var(--border-subtle);',
            'color:var(--text-tertiary);font:10px/1 "DM Mono",monospace;',
            'padding:2px 7px;border-radius:3px;cursor:pointer;transition:color .15s,border-color .15s;flex-shrink:0;}',
            '.tt-dismiss:hover{color:var(--red);border-color:var(--red);}',

            /* Arrow-up triangle (mempool.space technique — border triangle) */
            /* Positioned absolutely under bp-wrap, slides with CSS transition */
            '#tt-arrow{',
            '  position:absolute;',
            '  width:0;height:0;',
            '  border-left:8px solid transparent;',
            '  border-right:8px solid transparent;',
            '  border-bottom:10px solid var(--blue);', /* points UP toward block */
            '  bottom:-14px;',                         /* sits just below block cards */
            '  transition:left 2s cubic-bezier(0.25,0.46,0.45,0.94),',
            '             border-bottom-color .4s;',
            '  pointer-events:none;z-index:10;',
            '}',
            '#tt-arrow.tt-arrow-pending{border-bottom-color:var(--gold);}',
            '#tt-arrow.tt-arrow-confirming{border-bottom-color:var(--blue);}',
            '#tt-arrow.tt-arrow-confirmed{border-bottom-color:var(--grn);}',

            /* Glow under tracked block card */
            '.bp-block.tt-tracked-pending{',
            '  border-color:rgba(255,209,0,.5)!important;',
            '  box-shadow:0 0 14px rgba(255,209,0,.12),inset 0 0 8px rgba(255,209,0,.04);',
            '}',
            '.bp-block.tt-tracked-confirming{',
            '  border-color:rgba(74,158,255,.5)!important;',
            '  box-shadow:0 0 14px rgba(74,158,255,.12),inset 0 0 8px rgba(74,158,255,.04);',
            '}',
            '.bp-block.tt-tracked-confirmed{',
            '  border-color:rgba(0,201,122,.5)!important;',
            '  box-shadow:0 0 14px rgba(0,201,122,.12),inset 0 0 8px rgba(0,201,122,.04);',
            '}',

            /* Star on tracked block fill area */
            '.tt-star{position:absolute;top:5px;left:7px;font-size:12px;',
            'line-height:1;filter:drop-shadow(0 0 4px currentColor);}',
            '.tt-tracked-pending .tt-star{color:var(--gold);}',
            '.tt-tracked-confirming .tt-star{color:var(--blue);}',
            '.tt-tracked-confirmed .tt-star{color:var(--grn);}',

            /* Dotted 10-confirmation threshold line */
            /* Also slides via CSS transition when blocks shift */
            '#tt-dotline{',
            '  position:absolute;',
            '  top:0;bottom:-20px;', /* extends slightly below cards */
            '  width:0;',
            '  border-left:2px dashed rgba(255,209,0,.45);',
            '  transition:left 2s cubic-bezier(0.25,0.46,0.45,0.94);',
            '  pointer-events:none;z-index:8;',
            '}',
            '#tt-dotline::after{',
            '  content:"10 CONF";',
            '  position:absolute;',
            '  bottom:-18px;',
            '  left:4px;',
            '  font:600 7px/1 "DM Mono",monospace;',
            '  color:rgba(255,209,0,.55);',
            '  letter-spacing:.06em;',
            '  white-space:nowrap;',
            '}',

            /* Spotlight under tracked block (mempool.space "spotlight-bottom" replica) */
            '.tt-spotlight{',
            '  position:absolute;',
            '  bottom:-12px;',
            '  width:0;height:0;',
            '  border-left:6px solid transparent;',
            '  border-right:6px solid transparent;',
            '  pointer-events:none;z-index:9;',
            '  transition:left 2s cubic-bezier(0.25,0.46,0.45,0.94),',
            '             border-top-color .4s;',
            '}',
            /* Spotlight points DOWN from the block (inverted triangle below the card) */
            '.tt-spotlight.tt-sp-pending{border-top:8px solid rgba(255,209,0,.3);}',
            '.tt-spotlight.tt-sp-confirming{border-top:8px solid rgba(74,158,255,.3);}',
            '.tt-spotlight.tt-sp-confirmed{border-top:8px solid rgba(0,201,122,.3);}',

            /* bp-wrap needs position:relative for absolute children */
            '.bp-wrap{position:relative;}',

        ].join('');
        document.head.appendChild(s);
    }

    /* ── Public API ────────────────────────────────────────────── */

    function setTracked(txid, blockHeight, chainTip) {
        state.txid        = txid;
        state.blockHeight = blockHeight || null;
        state.chainTip    = chainTip || 0;

        if (!blockHeight) {
            state.confs  = 0;
            state.status = 'pending';
        } else {
            state.confs  = Math.max(0, (chainTip || 0) - blockHeight + 1);
            state.status = state.confs >= CONF_REQ ? 'confirmed' : 'confirming';
        }
        _updateUI();
    }

    function clearTracked() {
        state.txid        = null;
        state.blockHeight = null;
        state.confs       = 0;
        state.status      = 'none';
        _updateUI();
    }

    /* Called by BlockParade.refresh() after blocks update */
    function onBlocksUpdate(blocks) {
        if (!blocks || !blocks.length || state.status === 'none') return;
        var tip = blocks[0].height;
        state.chainTip = tip;
        if (state.blockHeight) {
            state.confs  = Math.max(0, tip - state.blockHeight + 1);
            state.status = state.confs >= CONF_REQ ? 'confirmed' : 'confirming';
        }
        _updateUI();
    }

    /* ── Internal rendering ────────────────────────────────────── */

    function _updateUI() {
        _updateStatusBar();
        _updateParadeOverlays();
    }

    function _updateStatusBar() {
        /* Find or create status bar inside #mp-panel-explorer */
        var panel = document.getElementById('mp-panel-explorer');
        if (!panel) return;

        var bar = document.getElementById('tt-status-bar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'tt-status-bar';
            /* Insert before the bp-wrap (parade) */
            var wrap = panel.querySelector('.bp-wrap');
            if (wrap) {
                panel.insertBefore(bar, wrap);
            } else {
                panel.insertBefore(bar, panel.firstChild);
            }
        }

        if (state.status === 'none') {
            bar.hidden = true;
            bar.innerHTML = '';
            return;
        }
        bar.hidden = false;

        var txShort = state.txid
            ? state.txid.slice(0, 8) + '…' + state.txid.slice(-4)
            : '—';
        var pct  = state.status === 'confirmed' ? 100
                 : state.status === 'confirming' ? Math.round(state.confs / CONF_REQ * 100)
                 : 0;
        var need = Math.max(0, CONF_REQ - state.confs);

        var cls, msgContent, progContent;
        if (state.status === 'pending') {
            cls        = 'tt-bar tt-pending';
            msgContent = '⟳ UNCONFIRMED — awaiting block inclusion';
            progContent = '';
        } else if (state.status === 'confirming') {
            cls        = 'tt-bar tt-confirming';
            msgContent = state.confs + ' / ' + CONF_REQ + ' CONFIRMATIONS';
            progContent =
                '<div class="tt-prog-wrap">' +
                  '<div class="tt-prog"><div class="tt-prog-fill" style="width:' + pct + '%"></div></div>' +
                  '<span class="tt-prog-label">' + need + ' block' + (need !== 1 ? 's' : '') + ' to unlock</span>' +
                '</div>';
        } else {
            cls        = 'tt-bar tt-confirmed';
            msgContent = '✓ FULLY CONFIRMED · ' + state.confs + ' CONFIRMATIONS · UNLOCKED';
            progContent =
                '<div class="tt-prog-wrap">' +
                  '<div class="tt-prog"><div class="tt-prog-fill" style="width:100%"></div></div>' +
                  '<span class="tt-prog-label">XMR unlocked</span>' +
                '</div>';
        }

        bar.className = cls;
        /* Shimmer fill = pct */
        bar.style.setProperty('--tt-pct', pct + '%');
        bar.innerHTML =
            '<span class="tt-dot"></span>' +
            '<span class="tt-txid">TRACKING ' + txShort + '</span>' +
            '<span class="tt-sep">·</span>' +
            '<span class="tt-msg">' + msgContent + '</span>' +
            progContent +
            '<button class="tt-dismiss" id="tt-dismiss-btn">✕</button>';

        var btn = document.getElementById('tt-dismiss-btn');
        if (btn) btn.addEventListener('click', clearTracked);
    }

    function _updateParadeOverlays() {
        /* Find the bp-wrap */
        var panel = document.getElementById('mp-panel-explorer');
        if (!panel) return;
        var wrap = panel.querySelector('.bp-wrap');
        if (!wrap) return;

        /* Get or create arrow element */
        var arrow = document.getElementById('tt-arrow');
        if (!arrow) {
            arrow = document.createElement('div');
            arrow.id = 'tt-arrow';
            wrap.appendChild(arrow);
        }

        /* Get or create dotline element */
        var dotline = document.getElementById('tt-dotline');
        if (!dotline) {
            dotline = document.createElement('div');
            dotline.id = 'tt-dotline';
            wrap.appendChild(dotline);
        }

        /* Get or create spotlight element */
        var spotlight = document.getElementById('tt-spotlight');
        if (!spotlight) {
            spotlight = document.createElement('div');
            spotlight.id = 'tt-spotlight';
            spotlight.className = 'tt-spotlight';
            wrap.appendChild(spotlight);
        }

        if (state.status === 'none') {
            arrow.hidden     = true;
            dotline.hidden   = true;
            spotlight.hidden = true;
            /* Remove tracked classes from all blocks */
            wrap.querySelectorAll('[class*="tt-tracked"]').forEach(function (el) {
                el.classList.remove('tt-tracked-pending','tt-tracked-confirming','tt-tracked-confirmed');
            });
            return;
        }

        /* Find all .bp-block elements in the wrap (each is inside a .bp-cell or direct) */
        var blocks = wrap.querySelectorAll('.bp-block[data-height]');

        /* Remove previous tracked classes */
        blocks.forEach(function (bl) {
            bl.classList.remove('tt-tracked-pending','tt-tracked-confirming','tt-tracked-confirmed');
            /* Remove old star */
            var star = bl.querySelector('.tt-star');
            if (star) star.remove();
        });

        var trackedCls = 'tt-tracked-' + state.status;
        var arrowCls   = 'tt-arrow-'   + state.status;
        var spCls      = 'tt-sp-'      + state.status;

        if (state.status === 'pending') {
            /* Arrow on the pending block */
            var pendingEl = wrap.querySelector('.bp-block.is-pending');
            if (pendingEl) {
                pendingEl.classList.add('tt-tracked-pending');
                _addStar(pendingEl, '⟳');
                var rect = _cellRect(pendingEl, wrap);
                var cx   = rect.left + rect.width / 2 - 8; /* center - half arrow width */
                arrow.style.left     = cx + 'px';
                arrow.className      = arrowCls;
                arrow.hidden         = false;
                spotlight.style.left = (cx + 2) + 'px';
                spotlight.className  = 'tt-spotlight ' + spCls;
                spotlight.hidden     = false;
            } else {
                arrow.hidden     = true;
                spotlight.hidden = true;
            }
            dotline.hidden = true; /* no dotline when pending */

        } else {
            /* Find the tracked block element */
            var targetH = String(state.blockHeight);
            var trackedEl = null;
            blocks.forEach(function (bl) {
                if (bl.getAttribute('data-height') === targetH) {
                    trackedEl = bl;
                }
            });

            if (trackedEl) {
                trackedEl.classList.add(trackedCls);
                _addStar(trackedEl, state.status === 'confirmed' ? '✓' : '★');

                var rect = _cellRect(trackedEl, wrap);
                var trackedCellLeft   = rect.left;
                var trackedCellCenter = rect.left + rect.width / 2 - 8;

                /* Arrow under tracked block */
                arrow.style.left    = trackedCellCenter + 'px';
                arrow.className     = arrowCls;
                arrow.hidden        = false;

                /* Spotlight (soft glow triangle below block) */
                spotlight.style.left = (trackedCellCenter + 2) + 'px';
                spotlight.className  = 'tt-spotlight ' + spCls;
                spotlight.hidden     = false;

                /* Dotted line: CELL_W × 10 to the RIGHT of the tracked block's left edge.
                   As new blocks arrive, tracked block slides LEFT, dotline slides with it
                   via CSS transition. When TX block crosses to the LEFT of where the line
                   started = fully confirmed. */
                var dotLeft = trackedCellLeft + (CONF_REQ * CELL_W);
                dotline.style.left = dotLeft + 'px';
                dotline.hidden     = false;

            } else {
                /* Tracked block not visible in the current parade window */
                arrow.hidden     = true;
                spotlight.hidden = true;
                if (state.status === 'confirming') {
                    /* Estimate position based on confirmations */
                    var wrapW   = wrap.getBoundingClientRect().width || (blocks.length * CELL_W);
                    var dotLeft2 = wrapW - (state.confs * CELL_W) + (CONF_REQ * CELL_W);
                    dotline.style.left = dotLeft2 + 'px';
                    dotline.hidden     = false;
                } else {
                    dotline.hidden = true;
                }
            }
        }
    }

    /* Get element rect relative to the wrap element */
    function _cellRect(el, wrap) {
        var elRect   = el.getBoundingClientRect();
        var wrapRect = wrap.getBoundingClientRect();
        return {
            left:   elRect.left   - wrapRect.left + wrap.scrollLeft,
            top:    elRect.top    - wrapRect.top,
            width:  elRect.width,
            height: elRect.height,
        };
    }

    /* Add a star/checkmark to the fill area of a tracked block card */
    function _addStar(blockEl, symbol) {
        var fillArea = blockEl.querySelector('.bp-fill-area');
        if (!fillArea) return;
        var star = document.createElement('div');
        star.className = 'tt-star';
        star.textContent = symbol;
        fillArea.appendChild(star);
    }

    /* ── Init ──────────────────────────────────────────────────── */
    injectCSS();

    /* Expose public API */
    global.TxTracker = {
        setTracked:     setTracked,
        clearTracked:   clearTracked,
        onBlocksUpdate: onBlocksUpdate,
    };

})(window);
