/* ═══════════════════════════════════════════════════════════════
   Mempool 3.0 — EXPLORER mode (M3)
   Block detail · TX detail · Search · Broadcast
   Namespace: window.MempoolExplorer
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
    'use strict';

    var VIEWS = ['recent', 'block', 'tx', 'broadcast', 'loading', 'error'];

    function el(id) { return document.getElementById(id); }

    /* ── Live TX panel state ── */
    var _txLive = {
        txid: null,
        tx: null,
        blockHeight: null,
        receiveTime: null,
        timer: null,
        lastTip: null
    };
    var _feeUsd = { currentTx: null, subscribed: false };
    var XMR_BLOCK_TIME_S = 120;
    var XMR_BLOCK_TIME_FALLBACK_S = 120;   /* used until parade has data */

    function avgBlockIntervalS() {
        var bp = window._blockParade;
        if (!bp || !bp.blocks || bp.blocks.length < 3) return XMR_BLOCK_TIME_FALLBACK_S;

        /* blocks are newest-first; timestamp deltas between adjacent blocks. */
        var deltas = [];
        for (var i = 0; i < Math.min(bp.blocks.length - 1, 10); i++) {
            var a = Number(bp.blocks[i].timestamp);
            var b = Number(bp.blocks[i + 1].timestamp);
            if (!a || !b) continue;
            var d = a - b;
            /* Sanity-clamp: discard outliers (clock skew, restored chains). */
            if (d > 5 && d < 1800) deltas.push(d);
        }
        if (!deltas.length) return XMR_BLOCK_TIME_FALLBACK_S;
        var sum = 0;
        for (var j = 0; j < deltas.length; j++) sum += deltas[j];
        return Math.round(sum / deltas.length);
    }

    /* ── REST base (mirrors XmrRelayWS.restBase) ── */
    function restBase() {
        return '/api/xmr';
    }

    function restGet(path) {
        return fetch(restBase() + path, { headers: { 'accept': 'application/json' } })
            .then(function (r) {
                if (r.status === 404) return null;
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            });
    }

    function fetchBlock(hashOrHeight)      { return restGet('/block/'  + encodeURIComponent(hashOrHeight)); }
    function fetchTx(txid)                 { return restGet('/tx/'     + encodeURIComponent(txid)); }
    function fetchRecentBlocks(limit)      { return restGet('/blocks?limit=' + (limit || 10)); }
    function fetchBlockTxs(ref, page, lim) { return restGet('/block/'  + encodeURIComponent(ref) + '/txs?page=' + (page||0) + '&limit=' + (lim||25)); }

    /* ── Formatters ── */
    function fmtInt(n) {
        if (n == null || !isFinite(n)) return '—';
        return Number(n).toLocaleString('en-US');
    }
    function fmtXmr(piconero) {
        if (piconero == null || !isFinite(piconero)) return '—';
        var xmr = Number(piconero) / 1e12;
        // 3 decimals for block rewards, more for tiny fees
        if (xmr >= 0.01) return xmr.toFixed(3) + ' XMR';
        if (xmr > 0)     return xmr.toFixed(7) + ' XMR';
        return '0 XMR';
    }
    function fmtBytes(b) {
        if (b == null || !isFinite(b)) return '—';
        if (b < 1024)       return b + ' B';
        if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
        return (b / (1024 * 1024)).toFixed(2) + ' MB';
    }
    function fmtDiff(d) {
        if (d == null || !isFinite(d)) return '—';
        if (d >= 1e9) return (d / 1e9).toFixed(2) + 'G';
        if (d >= 1e6) return (d / 1e6).toFixed(1) + 'M';
        if (d >= 1e3) return (d / 1e3).toFixed(1) + 'K';
        return String(d);
    }
    function truncHash(h) {
        if (!h || h.length < 20) return h || '—';
        return h.slice(0, 8) + '…' + h.slice(-6);
    }
    function fmtAgo(tsSec) {
        var now = Math.floor(Date.now() / 1000);
        var s = Math.max(0, now - (Number(tsSec) || 0));
        if (s < 60)   return s + 's ago';
        if (s < 3600) return Math.floor(s / 60) + 'm ago';
        if (s < 86400) return Math.floor(s / 3600) + 'h ago';
        return Math.floor(s / 86400) + 'd ago';
    }
    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function buildStepperMarkup() {
        var html = '';
        for (var i = 1; i <= 10; i++) {
            if (i > 1) html += '<div class="exp-stepper-line" data-step="' + (i - 1) + '"></div>';
            html += '<div class="exp-stepper-dot" data-step="' + i + '" aria-label="Confirmation ' + i + '"></div>';
        }
        return html;
    }

    function updateStepper(confs) {
        var stepper = el('exp-tx-stepper');
        if (!stepper) return;
        confs = Math.max(0, Math.min(10, Number(confs) || 0));
        stepper.dataset.confs = String(confs);

        var dots = stepper.querySelectorAll('.exp-stepper-dot');
        var lines = stepper.querySelectorAll('.exp-stepper-line');
        for (var i = 0; i < dots.length; i++) {
            var stepNum = i + 1;
            dots[i].classList.toggle('is-filled', stepNum <= confs);
            dots[i].classList.toggle('is-current', stepNum === confs && confs < 10);
        }
        for (var j = 0; j < lines.length; j++) {
            lines[j].classList.toggle('is-filled', (j + 1) < confs);
        }
        stepper.classList.toggle('is-fully-unlocked', confs >= 10);

        var cap = el('exp-tx-stepper-caption');
        if (cap) {
            if (confs === 0) cap.textContent = 'Awaiting first confirmation';
            else if (confs >= 10) cap.textContent = '✓ Fully unlocked — spendable';
            else if (confs === 9) cap.textContent = 'One more block to unlock';
            else cap.textContent = 'Confirming · ' + confs + ' of 10';
        }
    }

    function privacyTier(s) {
        if (s >= 95) return 'EXCELLENT';
        if (s >= 80) return 'STRONG';
        if (s >= 60) return 'GOOD';
        if (s >= 40) return 'FAIR';
        return 'WEAK';
    }

    /* ── View switching ── */
    function showView(name) {
        if (VIEWS.indexOf(name) < 0) name = 'recent';
        for (var i = 0; i < VIEWS.length; i++) {
            var node = el('exp-view-' + VIEWS[i]);
            if (node) node.hidden = (VIEWS[i] !== name);
        }
    }

    function showError(msg) {
        var m = el('exp-error-msg');
        if (m) m.textContent = msg || 'Something went wrong.';
        showView('error');
    }

    /* ── Search routing ──
       Rules:
         - pure integer < 10M  → block by height
         - 64-char hex         → try block, fall back to tx
         - anything else       → error
    */
    function routeSearch(query) {
        var q = (query || '').trim();
        if (!q) return;

        /* Clear any prior tracked TX overlays on a fresh search. */
        if (window._blockParade) {
            window._blockParade.clearTracked();
            window._blockParade.clearHighlight();
        }
        stopTxLive();

        showView('loading');

        // Rule 1: pure integer → block by height.
        if (/^\d+$/.test(q) && parseInt(q, 10) < 10000000) {
            return fetchBlock(parseInt(q, 10)).then(function (block) {
                if (!block) return showError('No block found at height ' + q + '.');
                return renderBlockView(block);
            }).catch(function (err) {
                showError('Error loading block: ' + (err && err.message || err));
            });
        }

        // Rule 2: 64-char hex → block first, then tx.
        if (/^[0-9a-f]{64}$/i.test(q)) {
            return fetchBlock(q).then(function (block) {
                if (block) return renderBlockView(block);
                return fetchTx(q).then(function (tx) {
                    if (tx) return renderTxView(tx);
                    return showError('No block or transaction found for hash ' + q.slice(0, 16) + '…');
                });
            }).catch(function (err) {
                showError('Error loading hash: ' + (err && err.message || err));
            });
        }

        return showError('Enter a block height (number) or a 64-character hex hash.');
    }

    /* ── Privacy scoring ── */
    function computePrivacyScore(tx) {
        if (!tx) return 0;
        var score = 0;
        if (tx.ring_size >= 16)   score += 25;   // mandatory since HF15
        if (tx.rct_type === 6)    score += 25;   // CLSAG + Bulletproofs+
        if (tx.has_view_tags)     score += 15;
        if ((tx.unlock_time || 0) === 0) score += 15;
        if ((tx.output_count || 0) <= 2) score += 10;
        if (tx.relayed !== false) score += 10;
        return Math.min(100, score);
    }

    function renderPrivacyGauge(canvas, score) {
        if (!canvas || !canvas.getContext) return;
        var dpr = global.devicePixelRatio || 1;
        var W = 200, H = 110;
        canvas.width = W * dpr; canvas.height = H * dpr;
        canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
        var ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        var cx = W / 2, cy = H - 10, r = 72;
        var col = score >= 90 ? '#00C97A' : score >= 70 ? '#FFD100' : '#FF4455';
        // Background arc
        ctx.beginPath();
        ctx.arc(cx, cy, r, -Math.PI, 0);
        ctx.strokeStyle = '#1e1e1e';
        ctx.lineWidth = 14;
        ctx.stroke();
        // Score arc
        var end = -Math.PI + (Math.max(0, Math.min(100, score)) / 100) * Math.PI;
        ctx.beginPath();
        ctx.arc(cx, cy, r, -Math.PI, end);
        ctx.strokeStyle = col;
        ctx.lineWidth = 14;
        ctx.lineCap = 'round';
        ctx.stroke();
        // Score number
        ctx.fillStyle = col;
        ctx.font = 'bold 26px "JetBrains Mono","DM Mono",monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(String(score), cx, cy - 8);
        // Tier label
        ctx.fillStyle = '#777';
        ctx.font = '9px "JetBrains Mono","DM Mono",monospace';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(score >= 90 ? 'EXCELLENT' : score >= 70 ? 'GOOD' : 'REVIEW', cx, cy + 4);
    }

    function privacyComponents(tx) {
        return [
            { lbl: 'Ring Size',    pct: tx.ring_size >= 16 ? 100 : (tx.ring_size >= 10 ? 60 : 20), pts: tx.ring_size >= 16 ? 25 : 0 },
            { lbl: 'CLSAG + BP+',  pct: tx.rct_type === 6 ? 100 : (tx.rct_type >= 5 ? 70 : 30),     pts: tx.rct_type === 6 ? 25 : 0 },
            { lbl: 'View Tags',    pct: tx.has_view_tags ? 100 : 0,                                  pts: tx.has_view_tags ? 15 : 0 },
            { lbl: 'No Timelock',  pct: (tx.unlock_time || 0) === 0 ? 100 : 0,                       pts: (tx.unlock_time || 0) === 0 ? 15 : 0 },
            { lbl: 'Output Count', pct: (tx.output_count || 0) <= 2 ? 100 : 50,                      pts: (tx.output_count || 0) <= 2 ? 10 : 0 },
            { lbl: 'Relayed',      pct: tx.relayed !== false ? 100 : 0,                              pts: tx.relayed !== false ? 10 : 0 }
        ];
    }

    /* ── Privacy component breakdown (expandable cards) ── */
    var PBD_CONTENT = {
        'Ring Size': {
            body: 'Mandatory since Monero hard fork 15 (August 2021). A ring of 16 means 15 decoys per real input. The minimum is protocol-enforced — wallets cannot create transactions with smaller rings.',
            link: 'privacy-architecture.html#pc_clsag'
        },
        'CLSAG + BP+': {
            body: 'RingCT type 6 is the current standard (HF15+). CLSAG signatures are smaller and faster than the previous MLSAG format. Bulletproofs+ range proofs are 5% smaller than Bulletproofs, with significant batch-verification speedups for nodes.',
            link: 'privacy-architecture.html#pc_bulletproofs'
        },
        'View Tags': {
            body: 'View tags (Monero 0.18 / HF16) are 1-byte hints that let wallets scan the blockchain up to 40× faster by filtering outputs. Modern wallets (Cake, Feather, Official GUI) include them automatically.',
            link: 'privacy-architecture.html#pc_cryptonote'
        },
        'No Timelock': {
            body: 'Transactions with no unlock_time are spendable immediately once confirmed. A non-zero timelock is unusual and can make a transaction stand out in chain analysis.',
            link: null
        },
        'Output Count': {
            body: 'Transactions with ≤2 outputs are the most common pattern. Unusually high output counts can leak information about merchant payment batching or churning behavior.',
            link: null
        },
        'Relayed': {
            body: 'This transaction propagated through the Dandelion++ mempool. Relayed transactions benefit from stem-phase IP privacy before public flooding.',
            link: 'privacy-architecture.html#pc_dandelion'
        }
    };

    function renderPrivacyBreakdown(container, tx) {
        if (!container) return;
        var comps = privacyComponents(tx);
        var html = '';
        for (var i = 0; i < comps.length; i++) {
            var c = comps[i];
            var info = PBD_CONTENT[c.lbl] || { body: '', link: null };
            var color = c.pts > 0 ? 'var(--grn)' : 'var(--text-muted)';
            var ptsLbl = c.pts > 0 ? '+' + c.pts : '—';
            var linkHtml = info.link
                ? '<span class="pbd-link"><a href="' + esc(info.link) + '">Learn more →</a></span>'
                : '';
            html +=
                '<div class="pbd-item">' +
                  '<button type="button" class="pbd-header" data-pbd-toggle>' +
                    '<span class="pbd-pts" style="color:' + color + '">' + esc(ptsLbl) + '</span>' +
                    '<span class="pbd-name">' + esc(c.lbl) + '</span>' +
                    '<span class="pbd-toggle">▾</span>' +
                  '</button>' +
                  '<div class="pbd-body">' +
                    esc(info.body) +
                    linkHtml +
                  '</div>' +
                '</div>';
        }
        container.innerHTML = html;

        if (container.dataset.pbdWired === '1') return;
        container.dataset.pbdWired = '1';
        container.addEventListener('click', function (e) {
            var btn = e.target && e.target.closest && e.target.closest('[data-pbd-toggle]');
            if (!btn) return;
            var item = btn.closest('.pbd-item');
            if (!item) return;
            if (item.classList.contains('open')) item.classList.remove('open');
            else item.classList.add('open');
        });
    }

    function rctLabel(t) {
        if (t === 0) return 'Type 0 (coinbase / no RingCT)';
        if (t === 1) return 'Type 1 (RingCT Full)';
        if (t === 2) return 'Type 2 (RingCT Simple)';
        if (t === 3) return 'Type 3 (RingCT Bulletproofs)';
        if (t === 4) return 'Type 4 (RingCT Bulletproofs v2)';
        if (t === 5) return 'Type 5 (CLSAG)';
        if (t === 6) return 'Type 6 (CLSAG + Bulletproofs+)';
        return 'Type ' + t;
    }

    /* ── TX detail view ── */
    var txState = { current: null, tracking: false };

    function renderTxView(tx) {
        txState.current = tx;
        txState.tracking = true;

        /* Defensive: API now sends `confirmed`, but accept any of these signals too. */
        var confirmed = !!(tx.confirmed
            || tx.status === 'confirmed'
            || (tx.block_height && !tx.in_pool));

        /* Bind the tx to the block-parade tracker (status bar, arrow, dotline). */
        if (window._blockParade) {
            var tip = (window._blockParade.blocks && window._blockParade.blocks[0])
                ? window._blockParade.blocks[0].height : null;
            var bh = (confirmed && tx.block_height > 0) ? tx.block_height : null;
            window._blockParade.setTracked(tx.txid || tx.id || '', bh, tip);
        }

        try {
            var _autoWs = getSharedWs();
            if (_autoWs && typeof _autoWs.track === 'function') {
                _autoWs.track(tx.txid);
            }
        } catch (_) {}

        var node = el('exp-view-tx');
        if (!node) return;

        var score = computePrivacyScore(tx);
        var comps = privacyComponents(tx);
        var compHtml = '';
        for (var i = 0; i < comps.length; i++) {
            var c = comps[i];
            var dim = c.pts === 0 ? ' dim' : '';
            compHtml +=
                '<div class="exp-pscore-row">' +
                  '<span class="lbl">' + esc(c.lbl) + '</span>' +
                  '<span class="exp-pscore-bar' + dim + '"><span style="width:' + Math.max(0, Math.min(100, c.pct)) + '%"></span></span>' +
                  '<span class="val">' + (c.pts > 0 ? '+' + c.pts : '0') + '</span>' +
                '</div>';
        }

        var inputsCount = tx.input_count || 0;
        var outputsCount = tx.output_count || 0;
        var ringSize = tx.ring_size || 0;

        var firstSeenStr, firstSeenLabel;
        if (tx.receive_time) {
            firstSeenStr = fmtAgo(tx.receive_time).replace(' ago', '');
            firstSeenLabel = 'First seen';
        } else if (tx.block_timestamp) {
            firstSeenStr = fmtAgo(tx.block_timestamp).replace(' ago', '');
            firstSeenLabel = 'Mined';
        } else {
            firstSeenStr = '—';
            firstSeenLabel = 'First seen';
        }
        var etaStr;
        if (confirmed) {
            etaStr = 'Confirmed';
        } else {
            var _parade  = window._blockParade;
            var _lastBlk = (_parade && _parade.blocks && _parade.blocks[0]) || null;
            var _since   = (_lastBlk && _lastBlk.timestamp)
                ? Math.max(0, Math.floor(Date.now() / 1000) - Number(_lastBlk.timestamp)) : 0;
            var _etaSec  = Math.max(0, avgBlockIntervalS() - _since);
            etaStr = '~' + Math.max(1, Math.round(_etaSec / 60)) + ' min';
        }
        var heightHtml = '—';
        if (confirmed) {
            var heightTxt = tx.block_height != null ? fmtInt(tx.block_height) : '—';
            heightHtml = tx.block_height != null
                ? '<a class="exp-tx-metalink" data-exp-goto-block="' + esc(tx.block_height) + '">#' + esc(heightTxt) + '</a>'
                : '#' + esc(heightTxt);
        }

        node.innerHTML =
            '<button type="button" class="exp-btn-back" data-exp-back-detail>← Back</button>' +

            '<div class="exp-tx-header">' +
              '<div class="exp-tx-header-left">' +
                '<h2 class="exp-tx-title">Transaction</h2>' +
                '<span class="exp-tx-hash" title="' + esc(tx.txid) + '">' + esc(tx.txid) + '</span>' +
                '<button type="button" class="exp-tx-copy-btn" data-exp-copy="' + esc(tx.txid) + '" aria-label="Copy TXID" title="Copy TXID">⧉</button>' +
              '</div>' +
              '<div class="exp-tx-header-right">' +
                (confirmed
                  ? '<span class="exp-tx-pill exp-tx-pill-confirmed">Confirmed</span>'
                  : '<span class="exp-tx-pill exp-tx-pill-unconfirmed">Unconfirmed</span>'
                ) +
                /* Auto-tracking is on by default; click to STOP. */
                '<button type="button" class="exp-tx-track-btn is-tracking" id="exp-tx-track">' +
                  '<span class="exp-track-icon">🔔</span> TRACKING · <span class="exp-track-toggle">✕ STOP</span>' +
                '</button>' +
              '</div>' +
            '</div>' +

            '<section class="exp-tx-metagrid-wrap">' +
              '<div class="exp-tx-metagrid">' +
                (confirmed
                  ? '<div class="exp-tx-metacell"><div class="exp-tx-metalbl">Included in block</div><div class="exp-tx-metaval">' +
                    heightHtml + '</div></div>'
                  : '<div class="exp-tx-metacell"><div class="exp-tx-metalbl">' + esc(firstSeenLabel) + '</div><div class="exp-tx-metaval">' + esc(firstSeenStr) + '</div></div>') +
                '<div class="exp-tx-metacell"><div class="exp-tx-metalbl">Fee</div><div class="exp-tx-metaval">' + esc(fmtXmr(tx.fee)) +
                  ' <span class="exp-tx-metausd" id="exp-tx-fee-usd">$—</span></div></div>' +
                '<div class="exp-tx-metacell"><div class="exp-tx-metalbl">ETA</div><div class="exp-tx-metaval">' + (confirmed ? 'Confirmed' : 'In ' + esc(etaStr)) + '</div></div>' +
                '<div class="exp-tx-metacell"><div class="exp-tx-metalbl">Fee rate</div><div class="exp-tx-metaval">' +
                  esc(tx.fee_rate != null ? tx.fee_rate.toFixed(2) + ' pcn/B' : '—') + '</div></div>' +
                '<div class="exp-tx-metacell"><div class="exp-tx-metalbl">Size</div><div class="exp-tx-metaval">' + esc(fmtBytes(tx.blob_size)) + '</div></div>' +
                '<div class="exp-tx-metacell"><div class="exp-tx-metalbl">Ring size</div><div class="exp-tx-metaval">' + esc(fmtInt(ringSize)) + ' decoys</div></div>' +
              '</div>' +
              '<div class="exp-tx-metafooter"><div class="exp-tx-metachips">' +
                '<span class="exp-tx-chip exp-tx-chip-on">CLSAG</span>' +
                '<span class="exp-tx-chip exp-tx-chip-on">BP+</span>' +
                '<span class="exp-tx-chip ' + (tx.has_view_tags ? 'exp-tx-chip-on' : 'exp-tx-chip-off') + '">View Tags</span>' +
                '<span class="exp-tx-chip ' + ((tx.unlock_time || 0) === 0 ? 'exp-tx-chip-on' : 'exp-tx-chip-off') + '">No Timelock</span>' +
                (tx.relayed !== false ? '<span class="exp-tx-chip exp-tx-chip-on">Dandelion++</span>' : '') +
              '</div></div>' +
            '</section>' +

            '<div class="exp-tx-live" id="exp-tx-live">' +
              '<div class="exp-tx-live-header">' +
                '<span class="exp-tx-live-label">Confirmation Status</span>' +
                '<span class="exp-tx-live-pulse" id="exp-tx-live-pulse">● LIVE</span>' +
              '</div>' +
              '<div class="exp-tx-live-grid">' +
                '<div class="exp-tx-live-cell">' +
                  '<div class="exp-tx-live-val" id="exp-tx-live-confs">0</div>' +
                  '<div class="exp-tx-live-sub" id="exp-tx-live-confs-sub">of 10 confirmations</div>' +
                '</div>' +
                '<div class="exp-tx-live-cell">' +
                  '<div class="exp-tx-live-val" id="exp-tx-live-remain">10</div>' +
                  '<div class="exp-tx-live-sub">blocks remaining</div>' +
                '</div>' +
                '<div class="exp-tx-live-cell">' +
                  '<div class="exp-tx-live-val" id="exp-tx-live-next-eta">~2:00</div>' +
                  '<div class="exp-tx-live-sub">until next confirmation</div>' +
                '</div>' +
                '<div class="exp-tx-live-cell">' +
                  '<div class="exp-tx-live-val" id="exp-tx-live-unlock-eta">~20:00</div>' +
                  '<div class="exp-tx-live-sub">until full unlock (10/10)</div>' +
                '</div>' +
              '</div>' +
              '<div class="exp-tx-stepper" id="exp-tx-stepper" data-confs="0"></div>' +
              '<div class="exp-tx-stepper-caption" id="exp-tx-stepper-caption">Awaiting first confirmation</div>' +
              '<div class="exp-tx-live-footer">' +
                '<span id="exp-tx-live-status-line">Awaiting first confirmation…</span>' +
                '<span class="exp-tx-live-lastupdate" id="exp-tx-live-lastupdate">updated just now</span>' +
              '</div>' +
            '</div>' +

            '<div class="exp-privacy-pill" id="exp-privacy-pill" data-expanded="false">' +
              '<button type="button" class="exp-privacy-toggle" id="exp-privacy-toggle" aria-expanded="false" aria-controls="exp-privacy-body">' +
                '<span class="exp-privacy-icon">✓</span>' +
                '<span class="exp-privacy-label">Privacy <strong>' + score + '/100</strong> ' + privacyTier(score) + '</span>' +
                '<span class="exp-privacy-summary">CLSAG · BP+ · ' + fmtInt(ringSize) + ' ring · View Tags · No Timelock</span>' +
                '<span class="exp-privacy-chevron" aria-hidden="true">▾</span>' +
              '</button>' +
              '<div class="exp-privacy-body" id="exp-privacy-body" hidden>' +
                '<div class="exp-gauge-wrap"><canvas class="exp-gauge" id="exp-tx-gauge" aria-label="Privacy score gauge"></canvas></div>' +
                '<div class="exp-pscore-list">' + compHtml + '</div>' +
                '<div class="pbd-list" id="exp-tx-pbd"></div>' +
                '<div class="exp-pscore-total"><span>Total</span><span><b>' + score + '</b> / 100</span></div>' +
              '</div>' +
            '</div>' +

            '<div class="exp-tx-section" id="exp-tx-inputs-mount">' +
              '<h3>Inputs (' + esc(fmtInt(inputsCount)) + ')</h3>' +
              renderInputsSection(tx) +
            '</div>' +

            '<div class="exp-tx-section" id="exp-tx-ring-mount">' +
              '<h3>Ring Signature Visualization</h3>' +
              '<div class="exp-ring-wrap">' +
                '<canvas class="exp-ring-canvas" id="exp-tx-ring" aria-label="Ring signature — ' + esc(fmtInt(ringSize)) + ' ring members"></canvas>' +
                '<div class="exp-ring-tip" id="exp-tx-ring-tip" hidden></div>' +
              '</div>' +
              '<div class="exp-ring-caption">' +
                '<h4>Ring Signature Proof</h4>' +
                '<span class="hero">' + esc(fmtInt(ringSize)) + ' possible senders. 1 cryptographic proof. ' +
                  'Zero information revealed about which is real.</span>' +
                'One of these ' + esc(fmtInt(ringSize)) + ' outputs funded this transaction. ' +
                'Cryptography makes it impossible to determine which. ' +
                '<a href="privacy-architecture.html#ring-signatures">Learn about ring signatures →</a>' +
              '</div>' +
            '</div>' +

            '<div class="exp-tx-section">' +
              '<div class="m5-chart-block">' +
                '<div class="m5-chart-title">DECOY SELECTION ANALYSIS — INPUT 0</div>' +
                '<canvas id="exp-tx-decoy-age" aria-label="Decoy age distribution chart"></canvas>' +
                '<div class="m5-chart-caption">Monero\'s wallet software selects decoys using a log-normal age distribution, weighting toward recently created outputs. This makes statistical timing attacks ineffective — an observer cannot reliably identify which ring member is the true spender based on age alone.</div>' +
              '</div>' +
            '</div>' +

            '<div class="exp-tx-section">' +
              '<h3>Outputs (' + esc(fmtInt(outputsCount)) + ')</h3>' +
              renderOutputsSection(tx) +
            '</div>' +

            '<div class="exp-tx-section">' +
              '<h3>Bulletproof+ Proof</h3>' +
              '<div class="exp-bp-note">' +
                '<b>' + esc(rctLabel(tx.rct_type)) + '</b> — proves that <code>sum(inputs) = sum(outputs) + fee</code> ' +
                'without revealing any amount. ' +
                (tx.rct_type === 6
                  ? 'Bulletproofs+ is the current standard (2022+): smaller, faster verification.'
                  : 'This transaction uses an earlier RingCT variant.') +
                '<span class="exp-bp-size">~1,500 bytes today vs ~13,000 bytes in 2017 (−88%)</span>' +
              '</div>' +
              '<div class="m5-chart-block" style="margin-top:12px">' +
                '<div class="m5-chart-title">ZERO-KNOWLEDGE PROOF SIZE EVOLUTION</div>' +
                '<canvas id="exp-tx-bp-timeline" aria-label="Bulletproof+ size timeline"></canvas>' +
                '<div class="m5-chart-caption" id="exp-tx-bp-caption">Monero has reduced range-proof size from 13 KB (2017) to 1.5 KB (2022), an 89% reduction.</div>' +
              '</div>' +
            '</div>' +

            (tx.extra_hex ?
              ('<div class="exp-tx-section">' +
                '<h3>Extra Field</h3>' +
                '<div class="exp-expandable">' +
                  '<button type="button" class="exp-expandable-head" data-exp-toggle-hex>Show raw extra hex ▾</button>' +
                  '<div class="exp-hex-wrap" id="exp-tx-extra">' + esc(tx.extra_hex) + '</div>' +
                '</div>' +
              '</div>') : '');

        var stepperEl = el('exp-tx-stepper');
        if (stepperEl) stepperEl.innerHTML = buildStepperMarkup();

        attachCopyButtons(node);
        wireTxDetailNav(node, tx, score);
        renderPrivacyBreakdown(el('exp-tx-pbd'), tx);
        renderRingViz(el('exp-tx-ring'), el('exp-tx-ring-tip'), tx);

        try {
            var decoyCanvas = el('exp-tx-decoy-age');
            if (decoyCanvas && window.M5DecoyAgeChart && typeof window.M5DecoyAgeChart.render === 'function') {
                var firstInput = (tx.inputs && tx.inputs[0]) || {};
                var keyOffsets = firstInput.key_offsets || firstInput.keyOffsets || [];
                window.M5DecoyAgeChart.render(decoyCanvas, keyOffsets, tx.block_height || 0, tx.total_outputs || 0);
            }
        } catch (e) { if (window.console) console.warn('[m5] decoy chart failed', e); }

        try {
            var bpCanvas = el('exp-tx-bp-timeline');
            if (bpCanvas && window.M5BulletproofTimeline && typeof window.M5BulletproofTimeline.render === 'function') {
                window.M5BulletproofTimeline.render(bpCanvas, tx);
                var size = window.M5BulletproofTimeline.estimateProofSize(tx);
                var pct = Math.round((1 - size / 13200) * 100);
                var cap = el('exp-tx-bp-caption');
                if (cap) cap.textContent = 'This transaction uses ~' + size + ' bytes — ' + pct + '% smaller than the 2017 RingCT baseline.';
            }
        } catch (e) { if (window.console) console.warn('[m5] bp timeline failed', e); }

        /* PriceService fee-USD wiring.
           TODO: PriceService lacks unsubscribe — we register once per page load and
           route all ticks to _feeUsd.currentTx. Tracking issue: add unsubscribe to
           js/price-service.js and drop this guard. */
        try {
            _feeUsd.currentTx = tx;
            updateFeeUsd();
            if (!_feeUsd.subscribed && window.PriceService && typeof window.PriceService.subscribe === 'function') {
                window.PriceService.subscribe(function () { updateFeeUsd(); });
                _feeUsd.subscribed = true;
            }
        } catch (_) {}

        showView('tx');
        startTxLive(tx);

        var _parade = document.querySelector('.bp-host');
        if (_parade) _parade.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /* ── Ring signature visualizer (Canvas 2D) ── */
    // Ages displayed in decoys: months since that output was created.
    // If the relay exposes key_offsets, we could derive real ages; for
    // now we use the handoff's example age array as a visual placeholder.
    var RING_AGE_EXAMPLES = ['8mo','14mo','3mo','22mo','5mo','1mo','18mo','7mo',
                             '11mo','2mo','16mo','4mo','9mo','6mo','21mo','12mo'];

    function renderRingViz(canvas, tip, tx) {
        if (!canvas || !canvas.getContext) return;
        var count = (tx && tx.ring_size) || 16;
        // Use explicit ages from tx.inputs[0].ages if relay ever provides them.
        var ages = (tx && tx.inputs && tx.inputs[0] && tx.inputs[0].ages) || null;

        var parent = canvas.parentElement || canvas;
        var dpr = global.devicePixelRatio || 1;
        var W = parent.clientWidth || 520;
        var H = 260;
        canvas.width = W * dpr; canvas.height = H * dpr;
        canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
        var ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);

        var cx = W / 2, cy = H / 2 - 8;
        var r  = Math.min(100, Math.max(70, Math.min(W, H) / 2 - 40));
        var nodeR = 18;

        var positions = [];
        for (var i = 0; i < count; i++) {
            var angle = (i / count) * Math.PI * 2 - Math.PI / 2;
            var x = cx + Math.cos(angle) * r;
            var y = cy + Math.sin(angle) * r;
            positions.push({ x: x, y: y, age: ages ? ages[i] : RING_AGE_EXAMPLES[i % RING_AGE_EXAMPLES.length] });

            // Circle — identical appearance for ALL members.
            ctx.beginPath();
            ctx.arc(x, y, nodeR, 0, Math.PI * 2);
            ctx.fillStyle = '#12161c';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,102,0,.45)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Age label inside.
            ctx.fillStyle = '#8a8f98';
            ctx.font = '10px "JetBrains Mono","DM Mono",monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(positions[i].age, x, y);
        }

        // Center label.
        ctx.fillStyle = '#e5e7eb';
        ctx.font = 'bold 14px "JetBrains Mono","DM Mono",monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('1 of ' + count, cx, cy - 6);
        ctx.fillStyle = '#6b7280';
        ctx.font = '9.5px "JetBrains Mono","DM Mono",monospace';
        ctx.fillText('true sender', cx, cy + 10);

        // Hover tooltip (decoy only — we never mark a true signer).
        if (!tip) return;
        canvas.onmousemove = function (e) {
            var rect = canvas.getBoundingClientRect();
            var mx = e.clientX - rect.left;
            var my = e.clientY - rect.top;
            for (var i = 0; i < positions.length; i++) {
                var p = positions[i];
                var dx = mx - p.x, dy = my - p.y;
                if (dx * dx + dy * dy <= nodeR * nodeR) {
                    tip.className = 'exp-ring-tip m5-ring-tip';
                    tip.hidden = false;
                    tip.innerHTML =
                        '<div class="rt-hdr">Ring member ' + (i + 1) + ' of ' + positions.length + '</div>' +
                        '<div class="rt-age">Estimated age: ' + esc(p.age) + '</div>' +
                        '<div class="rt-eq">Could be: True spender OR decoy</div>' +
                        '<div class="rt-cryp">Cryptographically indistinguishable</div>';
                    tip.style.left = p.x + 'px';
                    tip.style.top  = p.y + 'px';
                    return;
                }
            }
            tip.hidden = true;
        };
        canvas.onmouseleave = function () { tip.hidden = true; };
    }

    function renderInputsSection(tx) {
        if (tx.inputs && tx.inputs.length) {
            var html = '';
            for (var i = 0; i < tx.inputs.length; i++) {
                var inp = tx.inputs[i];
                html +=
                    '<div class="exp-keyimg">' +
                      '<div>Input ' + i + ' — Key Image</div>' +
                      '<span class="hash">' + esc(inp.key_image || '—') + '</span>' +
                      '<div class="meta">Ring: ' + esc(fmtInt(inp.ring_member_count || tx.ring_size || 0)) + ' members · ' +
                        'Amount: <span class="hidden-val">HIDDEN</span> (Pedersen commitment)</div>' +
                      '<div class="exp-expandable" style="margin-top:6px">' +
                        '<button type="button" class="exp-expandable-head" data-exp-toggle>What is a key image? ▾</button>' +
                        '<div class="exp-expandable-body">' +
                          'A key image is a deterministic hash of the private key used to spend an output. ' +
                          'It acts as a nullifier — once seen on-chain, it proves a coin was spent without ' +
                          'revealing which coin or by whom. Two key images match only if the same private ' +
                          'key signed twice — that\'s how Monero detects double-spends. ' +
                          '<a href="privacy-architecture.html#key-images">Learn more →</a>' +
                        '</div>' +
                      '</div>' +
                    '</div>';
            }
            return html;
        }
        // Graceful fallback when relay doesn't expose per-input detail.
        return '<div class="exp-keyimg">' +
                 '<div class="meta">This transaction has <b>' + esc(fmtInt(tx.input_count || 0)) + '</b> input' +
                 ((tx.input_count || 0) === 1 ? '' : 's') +
                 ', each spending one key image backed by a ring of <b>' + esc(fmtInt(tx.ring_size || 16)) + '</b> possible outputs. ' +
                 'Per-input key image detail is not currently exposed by the relay.</div>' +
                 '<div class="exp-expandable" style="margin-top:6px">' +
                   '<button type="button" class="exp-expandable-head" data-exp-toggle>What is a key image? ▾</button>' +
                   '<div class="exp-expandable-body">' +
                     'A key image is a deterministic hash of the private key used to spend an output. ' +
                     'It acts as a nullifier — once seen on-chain, it proves a coin was spent without ' +
                     'revealing which coin or by whom. ' +
                     '<a href="privacy-architecture.html#key-images">Learn more →</a>' +
                   '</div>' +
                 '</div>' +
               '</div>';
    }

    function renderOutputsSection(tx) {
        if (tx.outputs && tx.outputs.length) {
            var html = '';
            for (var i = 0; i < tx.outputs.length; i++) {
                var o = tx.outputs[i];
                html +=
                    '<div class="exp-out-row">' +
                      '<span class="stealth">' + esc(o.stealth_key || '—') + '</span>' +
                      '<span class="amt">AMT HIDDEN</span>' +
                      '<span class="vt">view-tag: ' + esc(o.view_tag || '—') + '</span>' +
                    '</div>';
            }
            html +=
                '<div class="exp-expandable" style="margin-top:8px">' +
                  '<button type="button" class="exp-expandable-head" data-exp-toggle>What is a stealth address? ▾</button>' +
                  '<div class="exp-expandable-body">' +
                    'Every Monero output is sent to a freshly derived one-time address. The sender ' +
                    'computes it from the recipient\'s public view+spend keys plus a random scalar. ' +
                    'Only the recipient, using their private view key, can recognise outputs intended ' +
                    'for them — even the sender cannot prove the link after the fact. ' +
                    '<a href="privacy-architecture.html#stealth-addresses">Learn more →</a>' +
                  '</div>' +
                '</div>';
            return html;
        }
        return '<div class="exp-keyimg">' +
                 '<div class="meta">This transaction has <b>' + esc(fmtInt(tx.output_count || 0)) + '</b> output' +
                 ((tx.output_count || 0) === 1 ? '' : 's') +
                 '. Each goes to a fresh stealth address — amounts are hidden by Pedersen commitments. ' +
                 'Per-output detail is not currently exposed by the relay.</div>' +
                 '<div class="exp-expandable" style="margin-top:6px">' +
                   '<button type="button" class="exp-expandable-head" data-exp-toggle>What is a stealth address? ▾</button>' +
                   '<div class="exp-expandable-body">' +
                     'Every Monero output is sent to a freshly derived one-time address. ' +
                     '<a href="privacy-architecture.html#stealth-addresses">Learn more →</a>' +
                   '</div>' +
                 '</div>' +
               '</div>';
    }

    function wireTxDetailNav(root, tx, score) {
        var back = root.querySelector('[data-exp-back-detail]');
        if (back) back.addEventListener('click', function () {
            // Back from tx → block (if we came from one) or recent.
            if (window._blockParade) {
                window._blockParade.clearTracked();
                window._blockParade.clearHighlight();
            }
            stopTxLive();
            txState.tracking = false;
            if (blockState.current) showView('block');
            else showView('recent');
        });

        // Clickable confirmed-block link.
        var gb = root.querySelector('[data-exp-goto-block]');
        if (gb) gb.addEventListener('click', function () {
            loadBlockView(gb.getAttribute('data-exp-goto-block'));
        });

        var track = el('exp-tx-track');
        if (track) {
            track.addEventListener('click', function () {
                if (window._blockParade) window._blockParade.clearTracked();
                var ws = getSharedWs();
                if (ws && typeof ws.untrack === 'function') { try { ws.untrack(tx.txid); } catch (_) {} }
                stopTxLive();
                txState.tracking = false;
                track.classList.remove('is-tracking');
                track.innerHTML = '<span class="exp-track-icon">🔔</span> TRACKING STOPPED · ' +
                                  '<span class="exp-track-toggle">search again to resume</span>';
                track.disabled = true;
            });
        }

        // Extra hex toggle.
        var hexBtn = root.querySelector('[data-exp-toggle-hex]');
        if (hexBtn) {
            hexBtn.addEventListener('click', function () {
                var wrap = el('exp-tx-extra');
                if (wrap) wrap.classList.toggle('is-open');
            });
        }

        var pill = root.querySelector('#exp-privacy-pill');
        var pToggle = root.querySelector('#exp-privacy-toggle');
        var pBody = root.querySelector('#exp-privacy-body');
        if (pill && pToggle && pBody) {
            pToggle.addEventListener('click', function () {
                var expanded = pill.dataset.expanded === 'true';
                var next = !expanded;
                pill.dataset.expanded = String(next);
                pToggle.setAttribute('aria-expanded', String(next));
                pBody.hidden = !next;
                if (next) {
                    var canvas = root.querySelector('#exp-tx-gauge');
                    if (canvas && !canvas.dataset.rendered) {
                        renderPrivacyGauge(canvas, score);
                        canvas.dataset.rendered = '1';
                    }
                }
            });
        }

        wireExpandables(root);
    }

    /* ── tx-confirmed WS event handling ── */
    function subscribeTxConfirmed() {
        var ws = getSharedWs();
        if (!ws) { setTimeout(subscribeTxConfirmed, 500); return; }
        ws.on('tx-confirmed', function (p) {
            if (!p || !p.txid) return;
            if (txState.current && txState.current.txid === p.txid) {
                // Re-fetch to get confirmed payload + block context.
                fetchTx(p.txid).then(function (fresh) { if (fresh) renderTxView(fresh); });
            }
        });
    }

    /* ── Clipboard copy helper ── */
    function attachCopyButtons(root) {
        var btns = (root || document).querySelectorAll('[data-exp-copy]');
        for (var i = 0; i < btns.length; i++) {
            (function (btn) {
                btn.addEventListener('click', function () {
                    var val = btn.getAttribute('data-exp-copy');
                    if (!val) return;
                    try {
                        if (global.navigator && global.navigator.clipboard) {
                            global.navigator.clipboard.writeText(val);
                        } else {
                            var ta = document.createElement('textarea');
                            ta.value = val; document.body.appendChild(ta);
                            ta.select(); document.execCommand('copy');
                            document.body.removeChild(ta);
                        }
                        var old = btn.textContent;
                        btn.textContent = 'COPIED';
                        btn.classList.add('ok');
                        setTimeout(function () {
                            btn.textContent = old;
                            btn.classList.remove('ok');
                        }, 1200);
                    } catch (_) {}
                });
            })(btns[i]);
        }
    }

    /* ── Block detail view ── */
    var blockState = { current: null, txPage: 0, txPageSize: 25, txLoaded: [] };

    function hardForkLabel(v) {
        // Monero hard fork milestones (abbreviated).
        if (v >= 16) return 'v' + v + ' (CLSAG + Bulletproofs+)';
        if (v >= 14) return 'v' + v + ' (CLSAG)';
        if (v >= 10) return 'v' + v + ' (Bulletproofs)';
        if (v >= 7)  return 'v' + v + ' (RingCT mandatory)';
        return 'v' + v;
    }

    function poolTypeLabel(t) {
        if (t === 'decentralized') return 'decentralized';
        if (t === 'centralized')   return 'centralized';
        if (t === 'solo')          return 'solo / unknown';
        return t || '—';
    }

    function renderBlockView(block) {
        blockState.current = block;
        blockState.txPage = 0;
        blockState.txLoaded = [];

        var node = el('exp-view-block');
        if (!node) return;

        var fill = block.block_weight_limit > 0
            ? (block.block_weight / block.block_weight_limit) * 100 : 0;
        var fillPct = Math.min(100, Math.max(0, fill));

        var orphan = block.orphan
            ? '<div class="exp-banner is-orphan">⚠  <b>ORPHAN BLOCK</b> — this block was not accepted into the main chain. ' +
              'A competing block was found at height ' + esc(fmtInt(block.height)) +
              ' first. Transactions from this block may still be in the mempool or in the winning block.</div>'
            : '';

        node.innerHTML =
            '<button type="button" class="exp-btn-back" data-exp-back-detail>← Back</button>' +
            orphan +
            '<div class="exp-detail-head">' +
              '<div class="exp-detail-title">' +
                '<span class="exp-kicker">Block</span>' +
                '#' + esc(fmtInt(block.height)) +
              '</div>' +
              '<div class="exp-detail-age">' + esc(fmtAgo(block.timestamp)) + '</div>' +
            '</div>' +
            '<div class="exp-hash-row">' +
              '<span>' + esc(block.hash) + '</span>' +
              '<button type="button" class="exp-copy-btn" data-exp-copy="' + esc(block.hash) + '">COPY</button>' +
            '</div>' +

            '<div class="exp-stats">' +
              '<div class="exp-stat"><div class="exp-stat-l">Reward</div><div class="exp-stat-v">' + esc(fmtXmr(block.reward)) + '</div></div>' +
              '<div class="exp-stat"><div class="exp-stat-l">Txs</div><div class="exp-stat-v">' + esc(fmtInt(block.tx_count)) + '</div></div>' +
              '<div class="exp-stat"><div class="exp-stat-l">Size</div><div class="exp-stat-v">' + esc(fmtBytes(block.block_weight)) + '</div></div>' +
              '<div class="exp-stat">' +
                '<div class="exp-stat-l">Mined By</div>' +
                '<div class="exp-stat-v">' + esc(block.pool_name || 'Solo/Unknown') + '</div>' +
                '<div class="exp-stat-sub">' + esc(poolTypeLabel(block.pool_type)) + '</div>' +
                '<div class="exp-expandable">' +
                  '<button type="button" class="exp-expandable-head" data-exp-toggle>' +
                    'Identified from: miner_tx.extra field tag  ▾' +
                  '</button>' +
                  '<div class="exp-expandable-body">' +
                    'Mining pools embed a UTF-8 tag string in the coinbase transaction\'s ' +
                    '<code>extra</code> field. Unlike Bitcoin — where pool addresses are visible — ' +
                    'Monero identifies pools only by these optional tag strings. ' +
                    'If no known tag is found, we classify the block as Solo/Unknown.' +
                  '</div>' +
                '</div>' +
              '</div>' +
            '</div>' +

            '<dl class="exp-info">' +
              '<dt>Difficulty</dt><dd>' + esc(fmtInt(block.difficulty)) + '</dd>' +
              '<dt>Nonce</dt><dd>' + esc(fmtInt(block.nonce)) + '</dd>' +
              '<dt>Hard Fork</dt><dd>' + esc(hardForkLabel(block.major_version)) + '</dd>' +
              '<dt>Timestamp</dt><dd>' + esc(new Date((block.timestamp || 0) * 1000).toISOString().replace('T', ' ').replace(/\..+$/, '') + ' UTC') + '</dd>' +
              '<dt>Prev Hash</dt><dd><a data-exp-nav="' + esc(block.prev_hash) + '">' + esc(block.prev_hash) + '</a></dd>' +
              '<dt>Block Weight</dt><dd>' + esc(fmtInt(block.block_weight)) + ' / ' + esc(fmtInt(block.block_weight_limit)) + ' bytes (' + fillPct.toFixed(1) + '% full)</dd>' +
              '<dt>Long-Term Weight</dt><dd>' + esc(fmtInt(block.long_term_weight)) + ' bytes</dd>' +
              '<dt>Miner Tx</dt><dd><a data-exp-tx="' + esc(block.miner_tx_hash) + '">' + esc(block.miner_tx_hash) + '</a></dd>' +
            '</dl>' +

            '<div class="exp-fill">' +
              '<div class="exp-fill-head"><span>Block Fill</span><span>' + fillPct.toFixed(1) + '% full</span></div>' +
              '<div class="exp-fill-bar"><span style="width:' + fillPct.toFixed(2) + '%"></span></div>' +
            '</div>' +

            '<div class="exp-nav-row">' +
              '<button type="button" class="exp-nav-btn" data-exp-nav-prev>← #' + esc(fmtInt((block.height || 0) - 1)) + '</button>' +
              '<button type="button" class="exp-nav-btn" data-exp-nav-next>#' + esc(fmtInt((block.height || 0) + 1)) + ' →</button>' +
            '</div>' +

            '<div class="exp-section">' +
              '<div class="exp-section-head"><span>Transactions (' + esc(fmtInt(block.tx_count)) + ')</span><span id="exp-txlist-count">—</span></div>' +
              '<div class="exp-txlist" id="exp-txlist">' +
                '<div class="exp-txlist-row is-coinbase" data-exp-tx="' + esc(block.miner_tx_hash) + '">' +
                  '<span class="c-txid">' + esc(truncHash(block.miner_tx_hash)) + '</span>' +
                  '<span class="c-size">coinbase</span>' +
                  '<span class="c-fee">' + esc(fmtXmr(block.reward)) + ' reward</span>' +
                  '<span class="c-rate">—</span>' +
                  '<span class="c-ring">ring: N/A</span>' +
                '</div>' +
              '</div>' +
              '<button type="button" class="exp-txlist-load" id="exp-txlist-more">LOAD MORE TRANSACTIONS</button>' +
            '</div>';

        // Wire: back, copy, prev/next, prev-hash link, miner-tx link, tx list.
        attachCopyButtons(node);
        wireBlockNav(node, block);
        wireExpandables(node);
        wireTxListPagination(block);

        if (window._blockParade && block.height != null) {
            window._blockParade.highlightBlock(block.height);
        }
        showView('block');

        var _parade = document.querySelector('.bp-host');
        if (_parade) _parade.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function wireBlockNav(root, block) {
        var back = root.querySelector('[data-exp-back-detail]');
        if (back) back.addEventListener('click', function () {
            if (window._blockParade) window._blockParade.clearHighlight();
            showView('recent');
        });

        var prev = root.querySelector('[data-exp-nav-prev]');
        var next = root.querySelector('[data-exp-nav-next]');
        if (prev) {
            if (!block.height || block.height <= 0) prev.disabled = true;
            else prev.addEventListener('click', function () { loadBlockView(block.height - 1); });
        }
        if (next) {
            // Only enable "next" if we know a later block exists.
            var tipHeight = getKnownTipHeight();
            if (tipHeight == null || block.height >= tipHeight) next.disabled = true;
            else next.addEventListener('click', function () { loadBlockView(block.height + 1); });
        }

        var prevLink = root.querySelector('[data-exp-nav]');
        if (prevLink) {
            prevLink.addEventListener('click', function () {
                loadBlockView(prevLink.getAttribute('data-exp-nav'));
            });
        }

        var txLinks = root.querySelectorAll('[data-exp-tx]');
        for (var i = 0; i < txLinks.length; i++) {
            (function (a) {
                a.addEventListener('click', function () {
                    loadTxView(a.getAttribute('data-exp-tx'));
                });
            })(txLinks[i]);
        }
    }

    function wireExpandables(root) {
        var heads = root.querySelectorAll('[data-exp-toggle]');
        for (var i = 0; i < heads.length; i++) {
            (function (btn) {
                btn.addEventListener('click', function () {
                    var box = btn.closest('.exp-expandable');
                    if (box) box.classList.toggle('is-open');
                });
            })(heads[i]);
        }
    }

    function getKnownTipHeight() {
        if (recentState.rows.length && recentState.rows[0].height != null) {
            return recentState.rows[0].height;
        }
        return null;
    }

    /* ── TX list pagination inside block detail ── */
    function wireTxListPagination(block) {
        var btn = el('exp-txlist-more');
        var count = el('exp-txlist-count');
        var list = el('exp-txlist');
        if (!btn || !list) return;

        var totalNonCoinbase = (block.tx_hashes && block.tx_hashes.length) || 0;
        if (count) count.textContent = '0 / ' + fmtInt(totalNonCoinbase) + ' loaded';
        if (totalNonCoinbase === 0) { btn.style.display = 'none'; return; }

        btn.addEventListener('click', function () { loadNextTxPage(block, btn, count, list); });
        // Auto-load the first page.
        loadNextTxPage(block, btn, count, list);
    }

    function loadNextTxPage(block, btn, countEl, listEl) {
        btn.disabled = true;
        btn.textContent = 'LOADING…';
        fetchBlockTxs(block.hash || block.height, blockState.txPage, blockState.txPageSize)
            .then(function (data) {
                var txs = (data && data.tx_hashes) || [];
                var total = (data && data.total) || 0;
                if (!txs.length) {
                    btn.style.display = 'none';
                    return;
                }
                return appendTxRows(txs, listEl).then(function () {
                    blockState.txPage += 1;
                    blockState.txLoaded = blockState.txLoaded.concat(txs);
                    if (countEl) countEl.textContent = fmtInt(blockState.txLoaded.length) + ' / ' + fmtInt(total) + ' loaded';
                    if (blockState.txLoaded.length >= total) {
                        btn.style.display = 'none';
                    } else {
                        btn.disabled = false;
                        btn.textContent = 'LOAD MORE TRANSACTIONS';
                    }
                });
            })
            .catch(function (err) {
                btn.disabled = false;
                btn.textContent = 'RETRY — ' + (err && err.message || 'error');
            });
    }

    function appendTxRows(txids, listEl) {
        // Fetch each tx in parallel for size/fee/rate/ring. Errors render a minimal row.
        var requests = txids.map(function (id) {
            return fetchTx(id).then(
                function (t) { return { id: id, tx: t }; },
                function ()  { return { id: id, tx: null }; }
            );
        });
        return Promise.all(requests).then(function (results) {
            var html = '';
            for (var i = 0; i < results.length; i++) {
                var id = results[i].id, t = results[i].tx;
                var rate = t ? (t.fee_rate != null ? t.fee_rate.toFixed(2) + ' p/B' : '—') : '—';
                var ring = t && t.ring_size ? 'ring:' + t.ring_size : '—';
                var size = t ? fmtBytes(t.blob_size) : '—';
                var fee  = t ? fmtXmr(t.fee) : '—';
                html +=
                    '<div class="exp-txlist-row" data-exp-tx="' + esc(id) + '">' +
                      '<span class="c-txid">' + esc(truncHash(id)) + '</span>' +
                      '<span class="c-size">' + esc(size) + '</span>' +
                      '<span class="c-fee">' + esc(fee) + '</span>' +
                      '<span class="c-rate">' + esc(rate) + '</span>' +
                      '<span class="c-ring">' + esc(ring) + '</span>' +
                    '</div>';
            }
            listEl.insertAdjacentHTML('beforeend', html);
            // Wire new rows.
            var rows = listEl.querySelectorAll('.exp-txlist-row[data-exp-tx]:not([data-wired])');
            for (var j = 0; j < rows.length; j++) {
                (function (row) {
                    row.setAttribute('data-wired', '1');
                    row.addEventListener('click', function () {
                        loadTxView(row.getAttribute('data-exp-tx'));
                    });
                })(rows[j]);
            }
        });
    }

    /* ── Broadcast view ── */
    function mountBroadcastView() {
        var node = el('exp-view-broadcast');
        if (!node || node.dataset.mounted === '1') return;
        node.innerHTML =
            '<button type="button" class="exp-btn-back" data-exp-back>← Back</button>' +
            '<h2>Broadcast Transaction</h2>' +
            '<div class="dandelion-info" style="margin:14px 0">' +
              '<div class="dand-flow">' +
                '<div class="dand-step">YOUR TX<span>paste hex</span></div>' +
                '<div class="dand-arrow">→</div>' +
                '<div class="dand-step stem">STEM PHASE<span>1 private peer</span></div>' +
                '<div class="dand-arrow">→</div>' +
                '<div class="dand-step fluff">FLUFF PHASE<span>all peers</span></div>' +
              '</div>' +
              '<p>Transactions submitted through this tool are forwarded to a Monero node via the xmr.irish relay and enter the Dandelion++ stem phase, protecting the origin IP before the transaction fluffs to the public mempool.</p>' +
            '</div>' +
            '<label class="exp-bc-label" for="exp-bc-hex" style="display:block;font-family:var(--font-mono);font-size:10px;color:var(--text-secondary);margin:14px 0 6px">RAW TRANSACTION HEX</label>' +
            '<textarea id="exp-bc-hex" rows="6" placeholder="Paste raw transaction hex (no 0x prefix)…" style="width:100%;background:var(--card-bg);border:1px solid var(--border);color:var(--text-primary);font-family:var(--font-mono);font-size:11px;padding:10px;border-radius:4px;resize:vertical"></textarea>' +
            '<button type="button" id="exp-bc-submit" class="exp-broadcast-cta" style="margin-top:10px">📡 Broadcast via relay</button>' +
            '<div id="exp-bc-result" class="exp-bc-result" style="margin-top:10px;font-family:var(--font-mono);font-size:10px;color:var(--text-muted)"></div>';
        node.dataset.mounted = '1';

        // Wire back button (init()'s querySelectorAll already ran before this view was mounted).
        var back = node.querySelector('[data-exp-back]');
        if (back) back.addEventListener('click', function () {
            if (window._blockParade) {
                window._blockParade.clearTracked();
                window._blockParade.clearHighlight();
            }
            showView('recent');
        });

        var submitBtn = el('exp-bc-submit');
        var hexInput  = el('exp-bc-hex');
        var resultEl  = el('exp-bc-result');
        if (submitBtn && hexInput && resultEl) {
            submitBtn.addEventListener('click', function () {
                var hex = (hexInput.value || '').trim();
                if (!hex) {
                    resultEl.style.color = 'var(--red)';
                    resultEl.textContent = '✗ Please paste the raw transaction hex.';
                    return;
                }
                resultEl.style.color = 'var(--text-muted)';
                resultEl.textContent = 'Submitting…';
                fetch(restBase() + '/tx/submit', {
                    method: 'POST',
                    headers: { 'accept': 'application/json', 'content-type': 'application/json' },
                    body: JSON.stringify({ hex: hex })
                }).then(function (r) {
                    return r.json().then(function (j) { return { ok: r.ok, body: j }; });
                }).then(function (res) {
                    if (res.ok && res.body && res.body.txid) {
                        resultEl.style.color = 'var(--grn)';
                        resultEl.textContent = '✓ Broadcast accepted: ' + res.body.txid;
                    } else {
                        var msg = (res.body && (res.body.error || res.body.message)) || ('HTTP error');
                        resultEl.style.color = 'var(--red)';
                        resultEl.textContent = '✗ ' + msg;
                    }
                }).catch(function (err) {
                    resultEl.style.color = 'var(--red)';
                    resultEl.textContent = '✗ ' + ((err && err.message) || err);
                });
            });
        }
    }

    /* ── Recent blocks view ── */
    var RECENT_MAX = 10;
    var recentState = { rows: [] };

    function mountRecentView() {
        var node = el('exp-view-recent');
        if (!node || node.dataset.mounted === '1') return;
        node.innerHTML =
            '<div class="exp-section">' +
              '<div class="exp-section-head">' +
                '<span>Recent Blocks</span><span>Last ' + RECENT_MAX + '</span>' +
              '</div>' +
              '<table class="exp-blocks-table" aria-label="Recent blocks">' +
                '<thead><tr>' +
                  '<th class="c-h">Height</th>' +
                  '<th>Hash</th>' +
                  '<th>Txs</th>' +
                  '<th>Size</th>' +
                  '<th class="c-reward">Reward</th>' +
                  '<th class="c-diff">Difficulty</th>' +
                  '<th>Pool</th>' +
                '</tr></thead>' +
                '<tbody id="exp-blocks-tbody">' +
                  '<tr><td colspan="7" class="exp-blocks-empty">Loading blocks…</td></tr>' +
                '</tbody>' +
              '</table>' +
            '</div>' +
            '<button type="button" class="exp-broadcast-cta" id="exp-show-broadcast">' +
              '📡 Broadcast transaction' +
            '</button>' +
            '<div id="exp-stale-mount"></div>';
        node.dataset.mounted = '1';

        // Delegated row click → block detail.
        var tbody = el('exp-blocks-tbody');
        tbody.addEventListener('click', function (e) {
            var tr = e.target.closest && e.target.closest('tr[data-height]');
            if (!tr) return;
            var ref = tr.getAttribute('data-hash') || tr.getAttribute('data-height');
            if (ref) loadBlockView(ref);
        });

        var cta = el('exp-show-broadcast');
        if (cta) cta.addEventListener('click', function () {
            mountBroadcastView();
            showView('broadcast');
        });
    }

    function renderRecentBlocks(rows) {
        mountRecentView();
        recentState.rows = Array.isArray(rows) ? rows.slice(0, RECENT_MAX) : [];
        var tbody = el('exp-blocks-tbody');
        if (!tbody) return;
        if (!recentState.rows.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="exp-blocks-empty">No blocks yet.</td></tr>';
            return;
        }
        var html = '';
        for (var i = 0; i < recentState.rows.length; i++) {
            html += rowHtml(recentState.rows[i], false);
        }
        tbody.innerHTML = html;
    }

    function rowHtml(b, isNew) {
        var poolName = (b.pool_name || 'Solo/Unknown');
        var poolClass = /p2pool/i.test(poolName) ? 'c-pool is-p2pool' : 'c-pool';
        var trCls = (b.orphan ? 'is-orphan' : '') + (isNew ? ' is-new' : '');
        return '<tr class="' + trCls.trim() + '" data-height="' + esc(b.height) + '" data-hash="' + esc(b.hash) + '">' +
            '<td class="c-h">' + esc(fmtInt(b.height)) + '</td>' +
            '<td class="c-hash">' + esc(truncHash(b.hash)) + '</td>' +
            '<td>' + esc(fmtInt(b.tx_count)) + '</td>' +
            '<td>' + esc(fmtBytes(b.block_weight)) + '</td>' +
            '<td class="c-reward">' + esc(fmtXmr(b.reward)) + '</td>' +
            '<td class="c-diff">' + esc(fmtDiff(b.difficulty)) + '</td>' +
            '<td class="' + poolClass + '">' + esc(poolName) + '</td>' +
            '</tr>';
    }

    function prependBlockRow(b) {
        mountRecentView();
        if (!b || b.height == null) return;
        // Dedup by height (block reorg / duplicate event).
        for (var i = 0; i < recentState.rows.length; i++) {
            if (recentState.rows[i].height === b.height) {
                recentState.rows[i] = b;
                renderRecentBlocks(recentState.rows);
                return;
            }
        }
        recentState.rows.unshift(b);
        if (recentState.rows.length > RECENT_MAX) recentState.rows.length = RECENT_MAX;
        var tbody = el('exp-blocks-tbody');
        if (!tbody) return;
        // Replace entirely but flag top row as new for animation.
        var html = rowHtml(recentState.rows[0], true);
        for (var j = 1; j < recentState.rows.length; j++) html += rowHtml(recentState.rows[j], false);
        tbody.innerHTML = html;
    }

    function loadRecentBlocks() {
        mountRecentView();
        fetchRecentBlocks(RECENT_MAX).then(function (rows) {
            renderRecentBlocks(rows || []);
        }).catch(function (err) {
            var tbody = el('exp-blocks-tbody');
            if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="exp-blocks-empty">Unable to load blocks: ' + esc(err && err.message || err) + '</td></tr>';
        });
    }

    /* ── Shared WS instance (from MempoolOcean) ── */
    function getSharedWs() {
        return (global.MempoolOcean && global.MempoolOcean._ws) || null;
    }

    function subscribeWs() {
        var ws = getSharedWs();
        if (!ws) {
            // Ocean boots after us on the first paint; retry once.
            return setTimeout(subscribeWs, 500);
        }
        ws.on('block', function (payload) {
            // Payload shape from relay ws-handler: {type:'block', data: XmrBlockSummary}
            // XmrRelayWS already unwraps .data, so `payload` IS the summary.
            if (payload && payload.height != null) prependBlockRow(payload);
        });
    }

    /* ── Public entry points ── */
    function loadBlockView(hashOrHeight) {
        showView('loading');
        return fetchBlock(hashOrHeight).then(function (block) {
            if (!block) return showError('Block not found.');
            return renderBlockView(block);
        }).catch(function (err) {
            showError('Error loading block: ' + (err && err.message || err));
        });
    }
    function loadTxView(txid) {
        showView('loading');
        return fetchTx(txid).then(function (tx) {
            if (!tx) return showError('Transaction not found.');
            return renderTxView(tx);
        }).catch(function (err) {
            showError('Error loading transaction: ' + (err && err.message || err));
        });
    }

    /* ── Init ── */
    function init() {
        // Back buttons (error view today, more added in later phases).
        var backs = document.querySelectorAll('[data-exp-back]');
        for (var i = 0; i < backs.length; i++) {
            backs[i].addEventListener('click', function () {
                if (window._blockParade) {
                    window._blockParade.clearTracked();
                    window._blockParade.clearHighlight();
                }
                showView('recent');
            });
        }

        // Search button + Enter key.
        var btn = el('exp-search-btn');
        var input = el('exp-search-input');
        if (btn && input) {
            btn.addEventListener('click', function () { routeSearch(input.value); });
            input.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') { e.preventDefault(); routeSearch(input.value); }
            });
        }

        // Mount recent view + hydrate + subscribe to live block events.
        mountRecentView();
        loadRecentBlocks();
        subscribeWs();
        subscribeTxConfirmed();

        // Default view.
        showView('recent');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    /* ── Live TX panel logic ──
       Piggy-backs on the block parade's 15s tip refresh. Ticks every 1s to
       drive the seconds-until-next-confirmation countdown. */

    function startTxLive(tx) {
        stopTxLive();
        _txLive.txid = tx.txid;
        _txLive.tx = tx;
        var _confirmed = !!(tx.confirmed
            || tx.status === 'confirmed'
            || (tx.block_height && !tx.in_pool));
        _txLive.blockHeight = _confirmed ? tx.block_height : null;
        _txLive.confirmed = _confirmed;
        _txLive.receiveTime = tx.receive_time || null;
        _txLive.lastTip = (window._blockParade && window._blockParade.blocks && window._blockParade.blocks[0])
            ? window._blockParade.blocks[0].height : null;

        updateTxLiveFromParade();
        _txLive.timer = setInterval(updateTxLiveFromParade, 1000);
    }

    function stopTxLive() {
        if (_txLive.timer) { clearInterval(_txLive.timer); _txLive.timer = null; }
        _txLive.txid = null;
        _txLive.tx = null;
    }

    function updateTxLiveFromParade() {
        if (!_txLive.tx) return;
        var host = el('exp-tx-live');
        if (!host) { stopTxLive(); return; }

        if (!window._blockParade || !window._blockParade.blocks || window._blockParade.blocks.length === 0) {
            setField('exp-tx-live-confs', '—');
            setField('exp-tx-live-confs-sub', 'connecting…');
            return;
        }

        var parade = window._blockParade;
        var tip = (parade && parade.blocks && parade.blocks[0]) ? parade.blocks[0].height : null;
        if (tip != null) _txLive.lastTip = tip;

        var CONF_REQ = 10;
        var avgBlock = avgBlockIntervalS();   /* fresh each tick */
        var confs, remaining, nextEtaS, unlockEtaS, statusLine, confClass;

        if (!_txLive.blockHeight) {
            /* Unconfirmed (in mempool). */
            confs = 0;
            remaining = CONF_REQ;
            /* Account for time elapsed since the last seen block — the wait isn't
               a full avgBlock anymore. */
            var sinceTipTs = (parade && parade.blocks && parade.blocks[0] && parade.blocks[0].timestamp)
                ? Math.max(0, Math.floor(Date.now() / 1000) - Number(parade.blocks[0].timestamp))
                : 0;
            nextEtaS = Math.max(15, avgBlock - sinceTipTs);   /* never below 15s */
            unlockEtaS = nextEtaS + (CONF_REQ - 1) * avgBlock;
            statusLine = 'Awaiting block inclusion…';
            confClass = 'is-pending';
        } else if (tip != null) {
            confs = Math.max(0, tip - _txLive.blockHeight + 1);
            remaining = Math.max(0, CONF_REQ - confs);

            if (confs >= CONF_REQ) {
                nextEtaS = 0;
                unlockEtaS = 0;
                statusLine = '✓ Fully unlocked — spendable';
                confClass = 'is-confirmed';
            } else {
                var lastBlock = parade.blocks[0];
                var sinceLastBlock = lastBlock && lastBlock.timestamp
                    ? Math.max(0, Math.floor(Date.now() / 1000) - Number(lastBlock.timestamp))
                    : 0;
                nextEtaS = Math.max(15, avgBlock - sinceLastBlock);
                unlockEtaS = remaining > 1
                    ? nextEtaS + (remaining - 1) * avgBlock
                    : nextEtaS;
                statusLine = confs === 1
                    ? 'First confirmation received — 9 more for unlock'
                    : remaining === 1
                    ? 'One more block until unlock'
                    : confs + ' of 10 — ' + remaining + ' more until unlock';
                confClass = 'is-updating';
            }
        } else {
            /* Confirmed but no tip info yet. */
            confs = _txLive.tx.confirmations || 0;
            remaining = Math.max(0, CONF_REQ - confs);
            nextEtaS = remaining > 0 ? avgBlock : 0;
            unlockEtaS = remaining * avgBlock;
            statusLine = 'Connecting to network…';
            confClass = 'is-updating';
        }

        if (window._xmrDebug && _txLive.txid) {
            console.log('[live.tick]', {
                ts: new Date().toISOString().slice(11, 19),
                txid8: (_txLive.txid || '').slice(0, 8),
                blockHeight: _txLive.blockHeight,
                tip: tip,
                confs: confs,
                remaining: remaining,
                avgBlock: avgBlock,
                sinceLastBlock: typeof sinceLastBlock !== 'undefined' ? sinceLastBlock : 'n/a',
                nextEtaS: nextEtaS,
                unlockEtaS: unlockEtaS,
                statusLine: statusLine,
                paradeRefreshAge: window._blockParade && window._blockParade._lastRefreshAt
                    ? Math.floor((Date.now() - window._blockParade._lastRefreshAt) / 1000) + 's'
                    : 'no parade'
            });
        }

        setField('exp-tx-live-confs', confs, confClass);
        setField('exp-tx-live-confs-sub', confs >= CONF_REQ
            ? 'fully confirmed — spendable'
            : 'of 10 confirmations');
        setField('exp-tx-live-remain', remaining);
        setField('exp-tx-live-next-eta', remaining > 0 ? '~' + fmtMinSec(nextEtaS) : '—');
        setField('exp-tx-live-unlock-eta', remaining > 0 ? '~' + fmtMinSec(unlockEtaS) : 'unlocked');
        setField('exp-tx-live-status-line', statusLine);
        setField('exp-tx-live-lastupdate', 'updated ' + (tip != null ? 'just now' : 'waiting…'));
        updateStepper(confs);
    }

    function setField(id, text, addClass) {
        var n = el(id);
        if (!n) return;
        if (n.textContent !== String(text)) n.textContent = text;
        if (addClass) {
            n.classList.remove('is-pending', 'is-updating', 'is-confirmed');
            n.classList.add(addClass);
        }
    }

    function fmtMinSec(s) {
        s = Math.max(0, Math.floor(s));
        var m = Math.floor(s / 60);
        var r = s % 60;
        return m + ':' + (r < 10 ? '0' : '') + r;
    }

    function fmtFeeUsd(xmrFee, xmrUsd) {
        if (!isFinite(xmrFee) || !isFinite(xmrUsd) || xmrUsd <= 0) return '$—';
        var usd = (Number(xmrFee) / 1e12) * Number(xmrUsd);
        if (usd > 0 && usd < 0.01) return '< $0.01';
        if (usd <= 0) return '$0.00';
        return '$' + usd.toFixed(2);
    }
    function updateFeeUsd() {
        var n = document.getElementById('exp-tx-fee-usd');
        if (!n) return;
        var tx = _feeUsd.currentTx;
        if (!tx) return;
        try {
            var ps = window.PriceService;
            if (!ps || !ps.data || !ps.data.xmr || typeof ps.data.xmr.usd !== 'number') {
                n.textContent = '$—'; return;
            }
            n.textContent = fmtFeeUsd(tx.fee, ps.data.xmr.usd);
        } catch (_) { n.textContent = '$—'; }
    }

    /* ── Public API ── */
    global.MempoolExplorer = {
        showView:          showView,
        showError:         showError,
        routeSearch:       routeSearch,
        loadBlockView:     loadBlockView,
        loadTxView:        loadTxView,
        loadRecentBlocks:  loadRecentBlocks,
        fetchBlock:        fetchBlock,
        fetchTx:           fetchTx,
        fetchRecentBlocks: fetchRecentBlocks,
        fetchBlockTxs:     fetchBlockTxs,
        restBase:          restBase
    };

})(window);
