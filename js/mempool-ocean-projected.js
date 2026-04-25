/* ProjectedBlockStrip — stacked colored fill representing the next block.
   Data source: MempoolUpdatePayload.projected_block {
     tx_count, bytes, bytes_limit, fill_pct, total_fees, median_fee_rate,
     fee_tiers: { stuck, economy, normal, fast, priority }  // bytes per tier
   }
   The ETA in the header reactively counts down each second using the same
   100-block average + last block timestamp the explorer uses. When the block
   is overdue, it counts up (`+0:30 overdue`); past 5m it shows `imminent`. */
(function (global) {
    'use strict';
    var MO = global.MempoolOceanShared || (global.MempoolOceanShared = {});

    // Emission reward floor (tail emission) for display when block reward absent.
    var TAIL_REWARD_XMR = 0.6;
    var XMR_BLOCK_TIME_FALLBACK_S = 120;

    function fmtEta(s) {
        if (s == null || isNaN(s)) return '—';
        if (s > 0) {
            var sec = Math.floor(s);
            var m = Math.floor(sec / 60);
            var r = sec % 60;
            return '~' + m + ':' + (r < 10 ? '0' : '') + r;
        }
        var overdue = -Math.floor(s);
        if (overdue >= 300) return 'imminent';
        var om = Math.floor(overdue / 60);
        var os = overdue % 60;
        return '+' + om + ':' + (os < 10 ? '0' : '') + os + ' overdue';
    }

    function avgBlock() {
        /* Reuse the explorer's cached value if present — single source of truth.
           Falls back to 120s if the explorer hasn't fetched yet. */
        var c = global.MempoolExplorer && global.MempoolExplorer._avgBlockCache;
        if (c && c.value) return c.value;
        return XMR_BLOCK_TIME_FALLBACK_S;
    }

    function lastBlockTs() {
        var bp = global._blockParade;
        if (bp && bp.blocks && bp.blocks[0] && bp.blocks[0].timestamp) {
            return Number(bp.blocks[0].timestamp);
        }
        return 0;
    }

    function ProjectedBlockStrip(root) {
        this.root = root;
        this._renderSkeleton();

        /* Per-second ticker keeps the ETA fresh — the header counts down even
           when no mempool-update arrives (mempool-update fires only on diff). */
        var self = this;
        this._ticker = setInterval(function () { self._refreshEta(); }, 1000);
    }

    ProjectedBlockStrip.prototype._renderSkeleton = function () {
        this.root.innerHTML =
            '<div class="mp-proj-head">' +
                '<span class="mp-proj-label">PROJECTED NEXT BLOCK</span>' +
                '<span class="mp-proj-eta" id="mp-proj-eta">—</span>' +
            '</div>' +
            '<div class="mp-proj-bar"><div class="mp-proj-fill" id="mp-proj-fill"></div></div>' +
            '<div class="mp-proj-pct" id="mp-proj-pct">—</div>' +
            '<div class="mp-proj-meta" id="mp-proj-meta">waiting for data…</div>';
        this.fill = this.root.querySelector('#mp-proj-fill');
        this.pct  = this.root.querySelector('#mp-proj-pct');
        this.meta = this.root.querySelector('#mp-proj-meta');
        this.eta  = this.root.querySelector('#mp-proj-eta');
    };

    ProjectedBlockStrip.prototype._refreshEta = function () {
        if (!this.eta) return;
        var ts = lastBlockTs();
        if (!ts) { this.eta.textContent = '—'; return; }
        var since = Math.max(0, Math.floor(Date.now() / 1000) - ts);
        this.eta.textContent = fmtEta(avgBlock() - since);
    };

    ProjectedBlockStrip.prototype.render = function (pb) {
        var fmt = MO.fmt, tiers = window.XmrRelayWS.FEE_TIERS;
        if (!pb) {
            this.fill.innerHTML = '';
            this.pct.textContent = '—';
            this.meta.textContent = 'waiting for data…';
            return;
        }

        // Build colored segments proportional to fee_tiers[key] bytes.
        // Order: priority → fast → normal → economy → stuck (highest-value left).
        var order = ['priority', 'fast', 'normal', 'economy', 'stuck'];
        var limit = pb.bytes_limit || 300000;
        var html = '';
        for (var i = 0; i < order.length; i++) {
            var key = order[i];
            var bytes = pb.fee_tiers && pb.fee_tiers[key] ? pb.fee_tiers[key] : 0;
            if (bytes <= 0) continue;
            var w = Math.max(0, Math.min(100, (bytes / limit) * 100));
            var tier = null;
            for (var j = 0; j < tiers.length; j++) if (tiers[j].key === key) tier = tiers[j];
            html += '<span class="mp-proj-seg" title="' + (tier ? tier.label : key) +
                ' — ' + fmt.bytes(bytes) + '" ' +
                'style="width:' + w.toFixed(2) + '%;background:' + (tier ? tier.color : '#888') + '"></span>';
        }
        this.fill.innerHTML = html;

        var fillPct = typeof pb.fill_pct === 'number' ? pb.fill_pct : (pb.bytes && limit ? (pb.bytes / limit) * 100 : 0);
        this.pct.textContent = fillPct.toFixed(0) + '% full';

        var reward = TAIL_REWARD_XMR; // approximate; exact reward isn't in projected_block
        this.meta.textContent =
            (pb.tx_count || 0) + ' txs · ' +
            fmt.bytes(pb.bytes || 0) + ' / ' + fmt.bytes(limit) + ' · ' +
            fmt.xmr(pb.total_fees || 0) + ' XMR fees · ~' + reward.toFixed(3) + ' XMR rwd';
    };

    MO.ProjectedBlockStrip = ProjectedBlockStrip;
})(window);
