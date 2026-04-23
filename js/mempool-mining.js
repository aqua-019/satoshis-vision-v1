/* mempool-mining.js — M4 Task 21/22: MINING mode orchestrator.
   Wires submodules to the shared XmrRelayWS instance, refreshes on
   WS 'block' / 'network-update' events, polls periodically, and
   respects pause/resume from setMode(). */
(function (global) {
    'use strict';

    var LIVE_POLL_MS   = 30 * 1000;        /* health + randomx + pool */
    var SERIES_POLL_MS = 5 * 60 * 1000;    /* hashrate + difficulty + emission + blocktime */
    var LIVE_DEBOUNCE  = 2000;

    function resolveContainer(id) { return document.getElementById(id); }

    function MempoolMining() {
        this.ws          = null;
        this.debug       = false;
        this._paused     = true;      /* starts paused; resume() fires on mode switch */
        this._initialized = false;
        this._modules    = [];
        this._liveTimer   = null;
        this._seriesTimer = null;
        this._lastLive    = 0;
        this._pendingLive = null;
        this._onBlock     = null;
        this._onNetwork   = null;
    }

    MempoolMining.prototype.init = function (opts) {
        if (this._initialized) return;
        opts = opts || {};
        this.ws    = opts.ws || global.__xmrWs || (global.XmrRelayWS && new global.XmrRelayWS());
        this.debug = !!opts.debug;
        if (!this.ws) {
            console.warn('[mining] no XmrRelayWS instance available');
            return;
        }
        if (typeof this.ws.connect === 'function' && this.ws.state === 'offline') {
            try { this.ws.connect(); } catch (e) { /* ignore */ }
        }

        this._modules = [
            { key: 'health',     mod: global.MempoolMiningHealth,     el: resolveContainer('mp-mining-health'),     series: false },
            { key: 'pool',       mod: global.MempoolMiningPool,       el: resolveContainer('mp-mining-pool'),       series: false },
            { key: 'randomx',    mod: global.MempoolMiningRandomX,    el: resolveContainer('mp-mining-randomx'),    series: false },
            { key: 'p2pool',     mod: global.MempoolMiningP2Pool,     el: resolveContainer('mp-mining-p2pool'),     series: false },
            { key: 'hashrate',   mod: global.MempoolMiningHashrate,   el: resolveContainer('mp-mining-hashrate'),   series: true  },
            { key: 'difficulty', mod: global.MempoolMiningDifficulty, el: resolveContainer('mp-mining-difficulty'), series: true  },
            { key: 'emission',   mod: global.MempoolMiningEmission,   el: resolveContainer('mp-mining-emission'),   series: true  },
            { key: 'blocktime',  mod: global.MempoolMiningBlocktime,  el: resolveContainer('mp-mining-blocktime'),  series: true  }
        ].filter(function (m) { return m.mod && m.el; });

        for (var i = 0; i < this._modules.length; i++) {
            try { this._modules[i].mod.init(this.ws, this._modules[i].el); }
            catch (err) { console.warn('[mining] init ' + this._modules[i].key, err); }
        }

        var self = this;
        this._onBlock = function () { self.refreshLive(); };
        this._onNetwork = function () { self.refreshModule('health'); self.refreshModule('randomx'); };
        this.ws.on('block',          this._onBlock);
        this.ws.on('network-update', this._onNetwork);

        this._initialized = true;
    };

    MempoolMining.prototype.refreshModule = function (key) {
        if (this._paused) return;
        var entry = this._modules.find(function (m) { return m.key === key; });
        if (!entry || typeof entry.mod.refresh !== 'function') return;
        try { entry.mod.refresh(); }
        catch (err) { if (this.debug) console.warn('[mining] refresh ' + key, err); }
    };

    MempoolMining.prototype.refreshLive = function () {
        if (this._paused) return;
        var now = Date.now();
        var wait = LIVE_DEBOUNCE - (now - this._lastLive);
        if (wait > 0) {
            var self = this;
            if (this._pendingLive) return;
            this._pendingLive = setTimeout(function () {
                self._pendingLive = null;
                self.refreshLive();
            }, wait);
            return;
        }
        this._lastLive = now;
        var keys = ['health', 'randomx', 'pool', 'p2pool'];
        for (var i = 0; i < keys.length; i++) this.refreshModule(keys[i]);
    };

    MempoolMining.prototype.refreshSeries = function () {
        if (this._paused) return;
        for (var i = 0; i < this._modules.length; i++) {
            if (this._modules[i].series) {
                try { this._modules[i].mod.refresh && this._modules[i].mod.refresh(); }
                catch (err) { if (this.debug) console.warn('[mining] series', err); }
            }
        }
    };

    MempoolMining.prototype.pause = function () {
        this._paused = true;
        if (this._liveTimer)   { clearInterval(this._liveTimer);   this._liveTimer = null; }
        if (this._seriesTimer) { clearInterval(this._seriesTimer); this._seriesTimer = null; }
        if (this._pendingLive) { clearTimeout(this._pendingLive);  this._pendingLive = null; }
    };

    MempoolMining.prototype.resume = function () {
        if (!this._initialized) return;
        if (!this._paused) return;
        this._paused = false;
        this.refreshLive();
        this.refreshSeries();
        var self = this;
        this._liveTimer   = setInterval(function () { self.refreshLive(); },   LIVE_POLL_MS);
        this._seriesTimer = setInterval(function () { self.refreshSeries(); }, SERIES_POLL_MS);
    };

    global.MempoolMining = new MempoolMining();
})(window);
