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

    var POLL_MS  = 20000; /* pending → confirming poll cadence */
    var ORPHAN_THRESHOLD = 3; /* consecutive 404s before auto-clear */

    /* ── State ────────────────────────────────────────────────── */
    var state = {
        txid:           null,
        blockHeight:    null,   /* null = pending (mempool) */
        confs:          0,
        status:         'none', /* none | pending | confirming | confirmed */
        chainTip:       0,
        trackedTs:      null,   /* seconds; tracked block timestamp */
        firstSeenAt:    null,   /* ms; first setTracked for this txid */
        pollTimer:      null,   /* setTimeout id for pending poller */
        pollGen:        0,      /* monotonic id; invalidates stale responses */
        notFoundStreak: 0,      /* consecutive 404s while pending */
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
            '  border-left:2px dotted rgba(255,209,0,.45);',
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

            /* Floating labeled pointer plate below tracked/pending block.
               Sits beneath the spotlight triangle, slides in lockstep with
               arrow/dotline on block arrival. */
            '#tt-plate{',
            '  position:absolute;',
            '  bottom:-62px;',
            '  transform:translateX(-50%);',
            '  min-width:110px;padding:4px 8px;',
            '  background:var(--surface-1);',
            '  border:1px solid var(--border-subtle);',
            '  border-radius:5px;',
            '  font:600 9px/1.35 "DM Mono","JetBrains Mono",monospace;',
            '  letter-spacing:.06em;text-align:center;',
            '  transition:left 2s cubic-bezier(0.25,0.46,0.45,0.94),',
            '             border-color .4s,color .4s;',
            '  z-index:11;pointer-events:none;',
            '}',
            '.tt-plate-txid{color:var(--text-secondary);font-weight:400;margin-bottom:2px;}',
            '.tt-plate-pending{border-color:rgba(255,209,0,.45);}',
            '.tt-plate-pending .tt-plate-state{color:var(--gold);}',
            '.tt-plate-confirming{border-color:rgba(74,158,255,.5);}',
            '.tt-plate-confirming .tt-plate-state{color:var(--blue);}',
            '.tt-plate-confirmed{border-color:rgba(0,201,122,.55);}',
            '.tt-plate-confirmed .tt-plate-state{color:var(--grn);}',

            /* bp-wrap needs position:relative for absolute children */
            '.bp-wrap{position:relative;}',

        ].join('');
        document.head.appendChild(s);
    }

    /* ── Public API ────────────────────────────────────────────── */

    function setTracked(txid, blockHeight, chainTip) {
        /* Always stop any prior poller on re-entry (new txid or promotion). */
        _stopPolling();

        /* First-time seeing this txid → stamp firstSeenAt for STATE 1 copy. */
        if (state.txid !== txid) {
            state.firstSeenAt = Date.now();
            state.trackedTs   = null;
            state.notFoundStreak = 0;
        }

        state.txid        = txid;
        state.blockHeight = blockHeight || null;
        state.chainTip    = chainTip || 0;

        if (!blockHeight) {
            state.confs  = 0;
            state.status = 'pending';
            _startPollingIfPending();
        } else {
            state.confs  = Math.max(0, (chainTip || 0) - blockHeight + 1);
            state.status = state.confs >= CONF_REQ ? 'confirmed' : 'confirming';
        }
        _updateUI();
    }

    function clearTracked() {
        _stopPolling();
        state.txid           = null;
        state.blockHeight    = null;
        state.confs          = 0;
        state.status         = 'none';
        state.trackedTs      = null;
        state.firstSeenAt    = null;
        state.notFoundStreak = 0;
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

            /* Capture tracked-block timestamp once it's in the parade window,
               needed for STATE 3 "included N min ago" copy. */
            var targetH = state.blockHeight;
            for (var i = 0; i < blocks.length; i++) {
                if (blocks[i].height === targetH) {
                    state.trackedTs = Number(blocks[i].timestamp) || state.trackedTs;
                    break;
                }
            }
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
            msgContent = '⟳ UNCONFIRMED · awaiting block inclusion';
            if (state.firstSeenAt) {
                var seenSec = Math.max(0, (Date.now() - state.firstSeenAt) / 1000);
                progContent =
                    '<div class="tt-prog-wrap">' +
                      '<span class="tt-prog-label">seen ' + _fmtAgo(seenSec) + '</span>' +
                    '</div>';
            } else {
                progContent = '';
            }
        } else if (state.status === 'confirming') {
            cls        = 'tt-bar tt-confirming';
            msgContent = state.confs + ' / ' + CONF_REQ + ' CONFIRMATIONS';
            var etaLabel = need + ' more block' + (need !== 1 ? 's' : '') +
                           ' · ~' + _fmtEta(need * 2) + ' remaining';
            progContent =
                '<div class="tt-prog-wrap">' +
                  '<div class="tt-prog"><div class="tt-prog-fill" style="width:' + pct + '%"></div></div>' +
                  '<span class="tt-prog-label">' + etaLabel + '</span>' +
                '</div>';
        } else {
            cls        = 'tt-bar tt-confirmed';
            msgContent = '✓ FULLY CONFIRMED · ' + state.confs + ' CONFIRMATIONS · UNLOCKED';
            var ageLabel;
            if (state.trackedTs) {
                var ageSec = Math.max(0, (Date.now() / 1000) - Number(state.trackedTs));
                ageLabel = 'included ' + _fmtAgo(ageSec) + ' ago';
            } else {
                ageLabel = 'XMR unlocked';
            }
            progContent =
                '<div class="tt-prog-wrap">' +
                  '<div class="tt-prog"><div class="tt-prog-fill" style="width:100%"></div></div>' +
                  '<span class="tt-prog-label">' + ageLabel + '</span>' +
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

        /* Get or create plate element (labeled pointer box below block) */
        var plate = document.getElementById('tt-plate');
        if (!plate) {
            plate = document.createElement('div');
            plate.id = 'tt-plate';
            wrap.appendChild(plate);
        }

        if (state.status === 'none') {
            arrow.hidden     = true;
            dotline.hidden   = true;
            spotlight.hidden = true;
            plate.hidden     = true;
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
                _renderPlate(plate, rect.left + rect.width / 2, 'pending', '⟳ PENDING');
            } else {
                arrow.hidden     = true;
                spotlight.hidden = true;
                plate.hidden     = true;
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

                /* Plate (labeled pointer box below arrow) */
                var plateLabel = state.status === 'confirmed'
                    ? '✓ ' + state.confs + ' CONF ✓'
                    : state.confs + '/' + CONF_REQ + ' ●';
                _renderPlate(plate, rect.left + rect.width / 2, state.status, plateLabel);

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
                plate.hidden     = true;
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

    /* Position and fill the floating labeled pointer plate. xCenter is the
       cell midpoint — plate uses transform:translateX(-50%) so this centers
       horizontally on the same x as the arrow tip. */
    function _renderPlate(plate, xCenter, statusKey, label) {
        plate.className = 'tt-plate tt-plate-' + statusKey;
        plate.style.left = xCenter + 'px';
        plate.hidden = false;
        var txShort = state.txid
            ? state.txid.slice(0, 8) + '…' + state.txid.slice(-4)
            : '—';
        plate.innerHTML =
            '<div class="tt-plate-txid">' + txShort + '</div>' +
            '<div class="tt-plate-state">' + label + '</div>';
    }

    /* "12 min" / "1h 5m" */
    function _fmtEta(min) {
        min = Math.max(0, Math.round(min));
        if (min < 60) return min + ' min';
        var h = Math.floor(min / 60);
        var m = min % 60;
        return h + 'h ' + (m > 0 ? m + 'm' : '0m');
    }

    /* "45s" / "28 min" / "2h 14m" */
    function _fmtAgo(sec) {
        sec = Math.max(0, Math.floor(sec));
        if (sec < 60)   return sec + 's';
        if (sec < 3600) return Math.floor(sec / 60) + ' min';
        var h = Math.floor(sec / 3600);
        var m = Math.floor((sec % 3600) / 60);
        return h + 'h ' + m + 'm';
    }

    /* ── Pending → confirming auto-promotion poller ────────────── */

    function _startPollingIfPending() {
        if (state.status !== 'pending' || !state.txid) return;
        /* Fire once on next tick so caller's DOM paint completes first. */
        state.pollTimer = setTimeout(_pollTxOnce, POLL_MS);
    }

    function _stopPolling() {
        if (state.pollTimer) {
            clearTimeout(state.pollTimer);
            state.pollTimer = null;
        }
        state.pollGen++;
    }

    function _pollTxOnce() {
        state.pollTimer = null;
        if (state.status !== 'pending' || !state.txid) return;

        var gen  = state.pollGen;
        var txid = state.txid;
        var url  = '/api/xmr/tx/' + encodeURIComponent(txid);

        var ctrl = null, timer = null;
        if (typeof AbortController !== 'undefined') {
            ctrl = new AbortController();
            timer = setTimeout(function () { ctrl.abort(); }, 6000);
        }

        var opts = { headers: { accept: 'application/json' } };
        if (ctrl) opts.signal = ctrl.signal;

        fetch(url, opts).then(function (r) {
            if (timer) clearTimeout(timer);
            /* Stale response? Discard. */
            if (gen !== state.pollGen || txid !== state.txid) return null;

            if (r.status === 404) {
                state.notFoundStreak++;
                if (state.notFoundStreak >= ORPHAN_THRESHOLD) {
                    /* Tx dropped from mempool without inclusion. */
                    clearTracked();
                    return null;
                }
                return null;
            }
            state.notFoundStreak = 0;
            return r.ok ? r.json() : null;
        }).then(function (data) {
            if (!data) return;
            if (gen !== state.pollGen || txid !== state.txid) return;

            if (data.status === 'confirmed' && data.block_height) {
                /* Cache receive_time as a fallback for STATE 3 age copy in
                   case the block isn't in the parade window yet. */
                if (data.receive_time && !state.trackedTs) {
                    state.trackedTs = Number(data.receive_time);
                }
                var tip = Math.max(state.chainTip || 0, Number(data.block_height));
                /* Recursive call promotes state → confirming/confirmed and
                   naturally stops this poller via _stopPolling() at the top
                   of setTracked(). */
                setTracked(txid, Number(data.block_height), tip);
            }
        }).catch(function () {
            if (timer) clearTimeout(timer);
            /* Swallow — next tick will retry. */
        }).then(function () {
            /* Reschedule unless state has moved on. */
            if (state.status === 'pending' && txid === state.txid && gen === state.pollGen) {
                state.pollTimer = setTimeout(_pollTxOnce, POLL_MS);
            }
        });
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
