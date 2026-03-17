/* ═══════════════════════════════════════════════════════════════
   Monero RPC Proxy — Vercel Serverless Function
   Forwards JSON-RPC calls to public Monero nodes
   Solves CORS restrictions for browser-side fetching
   
   Usage: POST /api/monero
   Body: { method: "get_info" } or { method: "get_transaction_pool" }
         or { method: "get_transactions", params: { txs_hashes: ["hash"] } }
   ═══════════════════════════════════════════════════════════════ */

const NODES = [
    'https://node.moneroworld.com:18089',
    'https://node.sethforprivacy.com:18089',
    'https://xmr-node.cakewallet.com:18081',
    'https://nodes.hashvault.pro:18081'
];

// JSON-RPC methods that go through /json_rpc endpoint
const JSON_RPC_METHODS = ['get_info', 'get_block', 'get_block_header_by_height', 'get_last_block_header'];
// Direct methods that go to their own endpoint
const DIRECT_METHODS = ['get_transaction_pool', 'get_transactions'];

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const { method, params } = req.body;
    if (!method) return res.status(400).json({ error: 'method required' });

    let lastError = null;

    for (const node of NODES) {
        try {
            let url, body;

            if (JSON_RPC_METHODS.includes(method)) {
                url = `${node}/json_rpc`;
                body = JSON.stringify({
                    jsonrpc: '2.0',
                    id: '0',
                    method,
                    params: params || {}
                });
            } else if (method === 'get_transaction_pool') {
                url = `${node}/get_transaction_pool`;
                body = JSON.stringify({});
            } else if (method === 'get_transactions') {
                url = `${node}/get_transactions`;
                body = JSON.stringify({
                    txs_hashes: params?.txs_hashes || [],
                    decode_as_json: true
                });
            } else {
                return res.status(400).json({ error: `unknown method: ${method}` });
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
                signal: AbortSignal.timeout(10000) // 10s timeout per node
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            return res.status(200).json(data);

        } catch (err) {
            lastError = err;
            console.warn(`[monero-proxy] ${node} failed: ${err.message}`);
            continue; // Try next node
        }
    }

    return res.status(502).json({
        error: 'All Monero nodes unreachable',
        detail: lastError?.message
    });
}
