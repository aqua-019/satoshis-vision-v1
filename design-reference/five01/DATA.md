# DATA · wiring live Monero data

The simulations and mempool views need live data. Here's how to wire it
without losing the design system.

## Single source of truth

Everything funnels through `useMoneroLive()` in `five01/src/shared.jsx`.
Replace the simulation `setInterval` blocks with real subscriptions; keep
the `setState({ ... })` shape exactly as-is and every view automatically
follows.

## Recommended live sources

| Datum | Free public source | CORS? | Notes |
|---|---|---|---|
| XMR/USD, BTC/USD | CoinGecko `simple/price` | ✅ open | already wired |
| XMR market data, sparklines | CoinGecko `coins/monero` | ✅ open | swap in for the synthetic priceSeries |
| Block height, hashrate, diff | `monerod` RPC `/get_info` | ❌ usually | needs a proxy |
| Mempool snapshots | `monerod` RPC `/get_transaction_pool` | ❌ | needs a proxy |
| Pool distribution | https://miningpoolstats.stream/monero (scraped) | partial | scrape server-side |
| Per-block details | `monerod` RPC `/get_block` | ❌ | needs a proxy |
| Per-tx details | `monerod` RPC `/get_transactions` | ❌ | needs a proxy |
| Tor/I2P peer share | none — derive from your own node's peerlist | n/a | self-hosted |

## Suggested topology

```
                  ┌────────────────────────────────┐
  Browser ◀──HTTPS──▶  xmr.irish edge worker      │
   │              │  (Cloudflare / Fly / Render)  │
   │              │                                │
   │              │  ┌──────────────────────────┐ │
   │              │  │ XMR data aggregator      │ │
   │              │  │ - poll monerod RPC       │ │
   │              │  │ - cache hot endpoints    │ │
   │              │  │ - WS fan-out for tip     │ │
   │              │  │ - rate-limit per IP      │ │
   │              │  └─────────────┬────────────┘ │
   │              │                │              │
   │              │     ┌──────────▼──────────┐   │
   │              │     │   your monerod      │   │
   │              │     │   (or rino, melo)   │   │
   │              │     └─────────────────────┘   │
   │              └────────────────────────────────┘
   │
   └─ also direct ─▶ CoinGecko (price only, CORS open)
```

The browser **never** talks to a monerod RPC directly — every public
node we tested lacks `Access-Control-Allow-Origin: *`, and you don't
want users sharing your RPC limits.

## Endpoint contract (suggested)

Run your own worker exposing a tiny REST + WS surface. Suggested shape
(matches `MoneroLive` in README.md):

```
GET  /api/snapshot           → { network, market, peers, pools, recent_blocks }
GET  /api/mempool            → { txs: Tx[], totalBytes, count }
GET  /api/block/:height      → Block { hash, txs, ... }
GET  /api/tx/:txid           → Tx { id, size, fee, ring, inputs, outputs }
WS   /api/live               → push { type: "block"|"tx"|"peer"|"price", payload }
```

Then the `useMoneroLive` hook becomes:

```js
React.useEffect(() => {
  fetch("/api/snapshot").then(r => r.json()).then(snap => setState(s => ({ ...s, ...snap })));
  const ws = new WebSocket("wss://xmr.irish/api/live");
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    setState(s => {
      if (m.type === "block") return { ...s, height: m.payload.height, blocks: [m.payload, ...s.blocks].slice(0, 14) };
      if (m.type === "tx")    return { ...s, mempool: [...s.mempool, m.payload] };
      if (m.type === "price") return { ...s, price: m.payload.usd, change24h: m.payload.chg };
      return s;
    });
  };
  return () => ws.close();
}, []);
```

## Caching guidance

- `/api/snapshot` — cache 5s edge, push WS updates between
- `/api/mempool` — cache 1s; clients also receive WS deltas
- `/api/block/:height` — immutable; cache 1d
- `/api/tx/:txid` — immutable once confirmed; cache 1d
- CoinGecko proxy — cache 60s, respect their rate limits

## What's already realistic in the mock

The simulation in `useMoneroLive()` produces:
- 64-char-hex txids (correct length)
- Fee/byte ratios that look like real Monero txs (50–1000 piconero/B)
- Block sizes that match the 0.6 XMR reward + variable tx count
- Peer latency distribution that looks like real peerlist data
- Hashrate sparkline that drifts plausibly
- Pool distribution **based on real recent shares** (P2Pool, SupportXMR,
  etc.) — see `POOLS` in `shared.jsx`

Swap in real data and nothing visually changes — the design holds because
the data shape and value ranges are realistic.

## Privacy hygiene

xmr.irish is a privacy site. The data layer must match:

- ✅ No third-party analytics
- ✅ No external font CDN beyond Google Fonts (or self-host the trio)
- ✅ No CoinGecko-style fetches from the browser if your users are on
   Tor — proxy server-side and serve from same origin
- ✅ No `localStorage` persistence of anything tx-identifiable (txids,
   wallet addresses) — the tweak panel uses host-rewrite, not local
   storage
- ✅ No CSP-violating inline trackers
- ✅ Optional: Onion mirror at `.onion` URL, served from the same worker
   over Tor — Monero users will respect this

## Server-side proxy snippets

### Cloudflare Worker (TypeScript)

```ts
export default {
  async fetch(req: Request, env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/api/snapshot") {
      const [info, pool, market] = await Promise.all([
        fetch(env.MONEROD + "/get_info").then(r => r.json()),
        fetch(env.MONEROD + "/get_transaction_pool_stats").then(r => r.json()),
        fetch("https://api.coingecko.com/api/v3/simple/price?ids=monero,bitcoin&vs_currencies=usd&include_24hr_change=true").then(r => r.json()),
      ]);
      return Response.json({ network: info, mempool: pool, market }, {
        headers: { "Cache-Control": "s-maxage=5", "Access-Control-Allow-Origin": "*" }
      });
    }
    return new Response("not found", { status: 404 });
  }
};
```

### Python / FastAPI

```py
from fastapi import FastAPI
import httpx

app = FastAPI()
NODE = "http://localhost:18089/json_rpc"

@app.get("/api/snapshot")
async def snapshot():
    async with httpx.AsyncClient() as c:
        info = await c.post(NODE, json={"jsonrpc":"2.0","id":"0","method":"get_info"})
        pool = await c.get("http://localhost:18089/get_transaction_pool_stats")
        market = await c.get("https://api.coingecko.com/api/v3/simple/price?ids=monero,bitcoin&vs_currencies=usd")
    return {"network": info.json(), "mempool": pool.json(), "market": market.json()}
```

## Live preview safety net

Until your edge worker exists, the `simulated` source mode in
`useMoneroLive()` keeps every page populated with realistic-looking
data. Ship to staging, point at the simulator, validate the design;
swap in the worker when ready. No design changes required.
