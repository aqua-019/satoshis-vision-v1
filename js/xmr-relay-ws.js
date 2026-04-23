/* ═══════════════════════════════════════════════════════════════
   XmrRelayWS — WebSocket client for the xmr.irish relay (M1)
   Endpoint: wss://relay.xmr.irish/ws (same-origin proxy: /api/xmr)
   Protocol (from relay/src/types.ts):
     Client → {action:'want'|'track-tx'|'untrack-tx'|'ping', ...}
     Server → {type:'hello'|'mempool-update'|'fee-update'|'block'|
                     'network-update'|'tx-confirmed'|'pong', ...}
   Provides: auto-reconnect (exp backoff), heartbeat, pubsub,
             REST fallback helpers, FEE_TIERS palette, classify().
   Reusable by M3 (EXPLORER) and M4 (MINING).
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
    'use strict';

    /* ── Fee tier palette ──
       Tier colors are DATA (tier identity), not chrome. FAST #F26822
       intentionally diverges from --xmr #FF6600 so tier legends stay
       portable across pages. Mirrors relay/src/types.ts FEE_TIERS. */
    var FEE_TIERS = [
        { key: 'stuck',    max: 1,        color: '#444444', label: 'STUCK'    },
        { key: 'economy',  max: 5,        color: '#3D8EFF', label: 'ECONOMY'  },
        { key: 'normal',   max: 20,       color: '#00C97A', label: 'NORMAL'   },
        { key: 'fast',     max: 80,       color: '#F26822', label: 'FAST'     },
        { key: 'priority', max: Infinity, color: '#FF4455', label: 'PRIORITY' }
    ];

    function classify(feePerByte) {
        var r = Number(feePerByte) || 0;
        for (var i = 0; i < FEE_TIERS.length; i++) {
            if (r <= FEE_TIERS[i].max) return FEE_TIERS[i];
        }
        return FEE_TIERS[FEE_TIERS.length - 1];
    }

    function tierByKey(key) {
        for (var i = 0; i < FEE_TIERS.length; i++) if (FEE_TIERS[i].key === key) return FEE_TIERS[i];
        return FEE_TIERS[2];
    }

    /* ── Constructor ── */
    function XmrRelayWS(opts) {
        opts = opts || {};
        this.url = opts.url || XmrRelayWS.defaultUrl();
        this.want = opts.want || ['mempool', 'blocks', 'fees', 'network'];
        this.debug = !!opts.debug;
        this.ws = null;
        this.state = 'offline';           // 'connecting' | 'live' | 'offline'
        this.backoff = 2000;
        this.maxBackoff = 30000;
        this.listeners = {};              // type → [fn]
        this._reconnectTimer = null;
        this._heartbeatTimer = null;
        this._lastFrameAt = 0;
        this._closed = false;
    }

    XmrRelayWS.defaultUrl = function () {
        return 'wss://relay.xmr.irish/ws';
    };

    XmrRelayWS.prototype.on = function (type, fn) {
        if (!this.listeners[type]) this.listeners[type] = [];
        this.listeners[type].push(fn);
        return this;
    };

    XmrRelayWS.prototype.off = function (type, fn) {
        var arr = this.listeners[type];
        if (!arr) return this;
        var idx = arr.indexOf(fn);
        if (idx !== -1) arr.splice(idx, 1);
        return this;
    };

    XmrRelayWS.prototype._emit = function (type, payload) {
        var arr = this.listeners[type] || [];
        for (var i = 0; i < arr.length; i++) {
            try { arr[i](payload); }
            catch (e) { if (this.debug) console.warn('[XmrRelayWS]', type, e); }
        }
    };

    XmrRelayWS.prototype._setState = function (next) {
        if (this.state === next) return;
        this.state = next;
        this._emit('state', next);
    };

    XmrRelayWS.prototype.connect = function () {
        var self = this;
        this._closed = false;
        this._setState('connecting');

        try {
            this.ws = new WebSocket(this.url);
        } catch (e) {
            if (this.debug) console.warn('[XmrRelayWS] ctor threw', e);
            this._scheduleReconnect();
            return this;
        }

        this.ws.onopen = function () {
            self._setState('live');
            self.backoff = 2000;
            self._lastFrameAt = Date.now();
            self._send({ action: 'want', data: self.want });
            self._startHeartbeat();
        };

        this.ws.onmessage = function (e) {
            self._lastFrameAt = Date.now();
            var msg;
            try { msg = JSON.parse(e.data); } catch (_) { return; }
            if (!msg || typeof msg.type !== 'string') return;
            if (self.debug) console.log('[XmrRelayWS] <-', msg.type);
            if (msg.type === 'pong') return;
            // Most frames are {type, data}; tx-confirmed is flat ({type, txid, ...}).
            self._emit(msg.type, msg.data !== undefined ? msg.data : msg);
        };

        this.ws.onclose = function () {
            self._stopHeartbeat();
            if (self._closed) { self._setState('offline'); return; }
            self._scheduleReconnect();
        };

        this.ws.onerror = function () {
            // onclose will fire too; let it handle reconnect.
            if (self.debug) console.warn('[XmrRelayWS] socket error');
        };

        return this;
    };

    XmrRelayWS.prototype._send = function (obj) {
        if (!this.ws || this.ws.readyState !== 1) return false;
        try { this.ws.send(JSON.stringify(obj)); return true; }
        catch (_) { return false; }
    };

    XmrRelayWS.prototype._scheduleReconnect = function () {
        var self = this;
        this._setState('offline');
        if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
        var delay = this.backoff;
        this.backoff = Math.min(Math.round(this.backoff * 2), this.maxBackoff);
        if (this.debug) console.log('[XmrRelayWS] reconnect in', delay, 'ms');
        this._reconnectTimer = setTimeout(function () {
            if (!self._closed) self.connect();
        }, delay);
    };

    XmrRelayWS.prototype._startHeartbeat = function () {
        var self = this;
        this._stopHeartbeat();
        this._heartbeatTimer = setInterval(function () {
            if (Date.now() - self._lastFrameAt > 45000) {
                if (self.debug) console.log('[XmrRelayWS] stale — force reconnect');
                try { self.ws && self.ws.close(); } catch (_) {}
                return;
            }
            self._send({ action: 'ping' });
        }, 25000);
    };

    XmrRelayWS.prototype._stopHeartbeat = function () {
        if (this._heartbeatTimer) { clearInterval(this._heartbeatTimer); this._heartbeatTimer = null; }
    };

    XmrRelayWS.prototype.close = function () {
        this._closed = true;
        this._stopHeartbeat();
        if (this._reconnectTimer) { clearTimeout(this._reconnectTimer); this._reconnectTimer = null; }
        try { this.ws && this.ws.close(); } catch (_) {}
        this._setState('offline');
    };

    XmrRelayWS.prototype.track   = function (txid) { return this._send({ action: 'track-tx',   txid: txid }); };
    XmrRelayWS.prototype.untrack = function (txid) { return this._send({ action: 'untrack-tx', txid: txid }); };

    /* ── REST helpers (for initial hydration and fallback) ──
       Uses the Vercel proxy /api/xmr/* on foreign origins and hits
       relay.xmr.irish directly when served from xmr.irish. */
    function restBase() {
        var host = (global.location && global.location.hostname) || '';
        if (/(^|\.)xmr\.irish$/.test(host)) return 'https://relay.xmr.irish/api';
        return '/api/xmr';
    }

    function restGet(path) {
        return fetch(restBase() + path, { headers: { 'accept': 'application/json' } })
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            });
    }

    XmrRelayWS.prototype.fetchMempool   = function ()      { return restGet('/mempool'); };
    XmrRelayWS.prototype.fetchFees      = function ()      { return restGet('/mempool/fees'); };
    XmrRelayWS.prototype.fetchProjected = function ()      { return restGet('/mempool/projected'); };
    XmrRelayWS.prototype.fetchRecent    = function (limit) { return restGet('/mempool/recent?limit=' + (limit || 20)); };

    /* ── M4 mining REST helpers ── */
    XmrRelayWS.prototype.fetchNetwork    = function ()      { return restGet('/network'); };
    XmrRelayWS.prototype.fetchHashrate   = function (range) { return restGet('/network/hashrate?range=' + (range || '7d')); };
    XmrRelayWS.prototype.fetchDifficulty = function (range) { return restGet('/network/difficulty?range=' + (range || '7d')); };
    XmrRelayWS.prototype.fetchPools      = function ()      { return restGet('/mining/pools'); };
    XmrRelayWS.prototype.fetchEmission   = function ()      { return restGet('/emission'); };

    /* ── Static exports ── */
    XmrRelayWS.FEE_TIERS  = FEE_TIERS;
    XmrRelayWS.classify   = classify;
    XmrRelayWS.tierByKey  = tierByKey;

    global.XmrRelayWS = XmrRelayWS;
})(window);
