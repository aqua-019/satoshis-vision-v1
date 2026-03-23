/* ═══════════════════════════════════════════════════════════════
   Monero Network Service — xmr.irish C.3.3
   Live data from Monero daemon RPC via /api/monero proxy
   Powers: Mempool page, Network page, Homepage block counter
   ═══════════════════════════════════════════════════════════════ */

const MoneroNetwork = {
    data: {
        height: 0, difficulty: 0, hashrate: 0,
        txPoolSize: 0, blockSizeLimit: 0, blockSizeMedian: 0,
        reward: 0, totalTxns: 0
    },
    blocks: [],
    mempool: [],
    listeners: [],
    POLL_INTERVAL: 30000, // 30 seconds

    subscribe(fn) { this.listeners.push(fn); },
    notify() { this.listeners.forEach(fn => fn(this.data)); },

    async rpc(method, params) {
        try {
            const res = await fetch('/api/monero', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ method, params })
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (err) {
            console.warn(`[MoneroNetwork] RPC ${method} failed:`, err);
            return null;
        }
    },

    async fetchInfo() {
        const res = await this.rpc('get_info');
        if (!res?.result) return;

        const r = res.result;
        this.data.height = r.height;
        this.data.difficulty = r.difficulty;
        this.data.hashrate = Math.round(r.difficulty / 120); // ~2min block target
        this.data.txPoolSize = r.tx_pool_size;
        this.data.blockSizeLimit = r.block_size_limit;
        this.data.blockSizeMedian = r.block_size_median;

        // Update nav block counter on all pages
        const navBlock = document.getElementById('nav-block-height');
        if (navBlock) navBlock.textContent = r.height.toLocaleString();
        const msBlock = document.getElementById('ms-block');
        if (msBlock) msBlock.textContent = String(r.height).slice(-3);

        this.notify();
    },

    async fetchRecentBlocks(count = 10) {
        const height = this.data.height;
        if (!height) return;

        const promises = [];
        for (let i = 0; i < count; i++) {
            promises.push(this.rpc('get_block_header_by_height', { height: height - 1 - i }));
        }

        const results = await Promise.all(promises);
        this.blocks = results
            .filter(r => r?.result?.block_header)
            .map(r => {
                const bh = r.result.block_header;
                return {
                    height: bh.height,
                    numTxes: bh.num_txes,
                    reward: bh.reward / 1e12,
                    size: bh.block_size,
                    timestamp: bh.timestamp,
                    difficulty: bh.difficulty,
                    confirmations: height - bh.height
                };
            })
            .sort((a, b) => b.height - a.height);
    },

    async fetchMempool() {
        const res = await this.rpc('get_transaction_pool');
        if (!res?.transactions) { this.mempool = []; return; }

        this.mempool = res.transactions.map(tx => ({
            hash: tx.id_hash,
            fee: tx.fee / 1e12,
            size: tx.blob_size,
            receiveTime: tx.receive_time,
            weight: tx.weight
        })).sort((a, b) => b.fee - a.fee); // highest fee first
    },

    async lookupTransaction(hash) {
        const res = await this.rpc('get_transactions', { txs_hashes: [hash] });
        if (!res) return null;

        // Check if in pool
        if (res.txs_as_hex && res.txs_as_hex.length > 0) {
            // Transaction found
            const inPool = res.txs?.[0]?.in_pool || false;
            const blockHeight = res.txs?.[0]?.block_height || 0;

            return {
                hash,
                inPool,
                blockHeight,
                confirmations: inPool ? 0 : Math.max(0, this.data.height - blockHeight),
                found: true
            };
        }

        // Check txs array
        if (res.txs && res.txs.length > 0) {
            const tx = res.txs[0];
            return {
                hash,
                inPool: tx.in_pool || false,
                blockHeight: tx.block_height || 0,
                confirmations: tx.in_pool ? 0 : Math.max(0, this.data.height - (tx.block_height || 0)),
                found: true
            };
        }

        return { hash, found: false };
    },

    // Formatting helpers
    fmtHashrate(h) {
        if (h >= 1e9) return (h / 1e9).toFixed(2) + ' GH/s';
        if (h >= 1e6) return (h / 1e6).toFixed(2) + ' MH/s';
        if (h >= 1e3) return (h / 1e3).toFixed(2) + ' KH/s';
        return h + ' H/s';
    },
    fmtDifficulty(d) {
        if (d >= 1e12) return (d / 1e12).toFixed(1) + ' T';
        if (d >= 1e9) return (d / 1e9).toFixed(1) + ' B';
        if (d >= 1e6) return (d / 1e6).toFixed(1) + ' M';
        return d.toLocaleString();
    },
    fmtTimeAgo(timestamp) {
        const diff = Math.floor(Date.now() / 1000) - timestamp;
        if (diff < 60) return 'just now';
        if (diff < 3600) return Math.floor(diff / 60) + ' min ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        return Math.floor(diff / 86400) + 'd ago';
    },
    truncHash(hash) {
        return hash.slice(0, 8) + '...' + hash.slice(-6);
    },

    async start() {
        await this.fetchInfo();
        setInterval(() => this.fetchInfo(), this.POLL_INTERVAL);
    },

    async startFull() {
        await this.fetchInfo();
        await Promise.all([this.fetchRecentBlocks(), this.fetchMempool()]);
        setInterval(async () => {
            const prevHeight = this.data.height;
            await this.fetchInfo();
            if (this.data.height !== prevHeight) {
                await this.fetchRecentBlocks();
                this.notifyBlocks();
            }
            await this.fetchMempool();
            this.notifyPool();
        }, this.POLL_INTERVAL);
    },

    // Fast polling for mempool page (5s)
    POLL_FAST: 5000,
    blockListeners: [],
    poolListeners: [],

    subscribeBlocks(fn) { this.blockListeners.push(fn); },
    subscribePool(fn) { this.poolListeners.push(fn); },
    notifyBlocks() { this.blockListeners.forEach(fn => fn(this.blocks)); },
    notifyPool() { this.poolListeners.forEach(fn => fn(this.mempool)); },

    async startFast() {
        await this.fetchInfo();
        await Promise.all([this.fetchRecentBlocks(), this.fetchMempool()]);
        this.notify();
        this.notifyBlocks();
        this.notifyPool();
        setInterval(async () => {
            const prevHeight = this.data.height;
            await this.fetchInfo();
            if (this.data.height !== prevHeight) {
                await this.fetchRecentBlocks();
                this.notifyBlocks();
            }
            await this.fetchMempool();
            this.notify();
            this.notifyPool();
        }, this.POLL_FAST);
    }
};
