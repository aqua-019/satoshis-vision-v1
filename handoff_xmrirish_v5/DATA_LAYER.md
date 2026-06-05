# DATA LAYER — reuse v4's backend, optimize for v5

The v5 design does **not** need a new data backend. v4 already ships a working,
privacy-correct one. The migration's data job is small: write **one hook** that
maps v4's endpoints into the `MoneroLive` shape every v5 view already reads.

This doc covers (A) what v4 has, (B) how to wire v5 to it unchanged, and
(C) the optimized v5 data layer you asked for — concrete upgrades worth making
once parity lands.

---

## A. What v4 already provides (reuse all of this)

From `satoshis-vision-v1` (`vercel.json` + `api/` + optional `relay/`):

| Endpoint | What it does | Source |
|---|---|---|
| `/api/monero` | JSON-RPC proxy to public Monero nodes, **4-node cascade fallback** | `api/monero.js` |
| `/api/xmr/*` | full relay-bridge REST surface (mempool, blocks, tx, mining, network, stats) | `api/xmr.js` |
| `/api/coingecko` | CoinGecko price proxy (so the browser never hits CoinGecko on Tor) | `api/coingecko.js` |
| `wss://relay/ws` | **optional** Node relay: `monerod --zmq-pub` → WebSocket push (instant tip/mempool) | `relay/` |

Two deployment modes, both already working:
- **Vercel-only (polling):** everything flows through the three serverless
  functions. No WS push, but complete. *This is what xmr.irish runs today.*
- **Vercel + relay (push):** add the Node relay on a VPS next to your own
  `monerod` for real-time mempool/block deltas over WebSocket.

**Privacy properties to preserve:** all third-party data is fetched server-side;
the browser only ever talks to same-origin `/api/*` (and the relay WS). No
direct CoinGecko / RPC / pool-API calls from the client. Keep it that way.

---

## B. Wire v5 to it — the single seam

Every v5 surface reads from one hook, `useMoneroLive()`, which returns the
`MoneroLive` object (full shape in `repo/src/data/types.ts` and
`five01/README.md`). The repo ships this as a swappable provider:

```tsx
// repo/src/App usage
<DataProvider useFeed={useXmrIrishFeed}>
  <App />
</DataProvider>
```

If you pass nothing, the **simulated feed** runs (CoinGecko price + synthetic
mempool/blocks) — keep that as the dev default. For production, write one file:

```ts
// repo/src/data/xmrirish-feed.ts
import { useEffect, useState } from "react";
import type { MoneroLive } from "@/data/types";
import { SIM_SEED } from "@/data/simulated"; // initial shape so the UI never flashes empty

export function useXmrIrishFeed(): MoneroLive {
  const [state, setState] = useState<MoneroLive>({ ...SIM_SEED, source: "rpc", live: false });

  useEffect(() => {
    let alive = true;

    // 1. Snapshot on mount (reuses v4 proxies)
    async function snapshot() {
      const [info, pool, market] = await Promise.all([
        fetch("/api/monero", { method: "POST",
          body: JSON.stringify({ jsonrpc: "2.0", id: "0", method: "get_info" }) }).then(r => r.json()),
        fetch("/api/xmr/mempool").then(r => r.json()),
        fetch("/api/coingecko?ids=monero,bitcoin").then(r => r.json()),
      ]);
      if (!alive) return;
      setState(s => mapToMoneroLive(s, { info, pool, market }));
    }
    snapshot();

    // 2. Live deltas when the relay is present; otherwise poll
    let ws: WebSocket | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    try {
      ws = new WebSocket(`${location.origin.replace(/^http/, "ws")}/ws`); // or wss://relay/ws
      ws.onmessage = (e) => {
        const m = JSON.parse(e.data);
        setState(s => {
          if (m.type === "block") return { ...s, height: m.payload.height, blocks: [m.payload, ...s.blocks].slice(0, 14), live: true, source: "ws" };
          if (m.type === "tx")    return { ...s, mempool: [...s.mempool, m.payload], live: true, source: "ws" };
          if (m.type === "price") return { ...s, price: m.payload.usd, change24h: m.payload.chg };
          return s;
        });
      };
      ws.onerror = () => { ws?.close(); startPolling(); };
    } catch { startPolling(); }

    function startPolling() {
      poll = setInterval(snapshot, 2500); // matches the sim cadence; tune per §C
    }

    return () => { alive = false; ws?.close(); if (poll) clearInterval(poll); };
  }, []);

  return state;
}
```

`mapToMoneroLive()` is the only real work: translate v4's RPC/relay JSON into
the `MoneroLive` fields (`height, hashrate, difficulty, mempool[], blocks[],
peers[], poolDist[], price, change24h, btcRatio, …`). Use
`five01/src/shared.jsx`'s simulated generator as the field-by-field reference —
it already produces every field with realistic ranges, so you know exactly what
each view expects. **No view, sparkline, grid, or dashboard changes** once the
hook returns the right shape.

> Set `data.source` honestly: `"rpc"` / `"ws"` when live, `"coingecko"` for
> price-only, `"simulated"` until the worker answers. The UI surfaces a
> LIVE/SYNCED badge from this — never let it lie about its source.

---

## C. Optimized v5 data layer (recommended upgrades)

Reuse v4 to reach parity fast; then make these upgrades. They cut latency,
reduce node load, and harden privacy.

### 1. One snapshot endpoint, WS deltas — stop fanning out
Today the client makes 3+ calls on load. Collapse to a single
`GET /api/snapshot` that the edge composes (info + mempool stats + market) and
caches, then stream only **deltas** over WS. One round trip to first paint,
near-zero polling after.

```
GET /api/snapshot   → { network, market, peers, pools, recent_blocks }   (edge-cached 5s)
GET /api/mempool    → { txs: Tx[], totalBytes, count }                     (cached 1s)
GET /api/block/:h   → Block                                                (immutable, cache 1d)
GET /api/tx/:txid   → Tx                                                    (immutable once confirmed, 1d)
WS  /api/live       → push { type:"block"|"tx"|"peer"|"price", payload }
```

### 2. Edge caching tiers
- `/api/snapshot` — `s-maxage=5`, push WS updates in between.
- `/api/mempool` — `s-maxage=1`; clients also get WS deltas.
- `/api/block/:h`, `/api/tx/:txid` — immutable, `s-maxage=86400`.
- CoinGecko proxy — `s-maxage=60`, respect their free-tier limit (v4 polls every
  30 min; a 60s edge cache with shared fan-out is safe and fresher).

### 3. Consolidate the relay into the edge
v4's relay is a separate VPS process. For v5, run the aggregator as a
**Cloudflare Worker (or Durable Object) in front of your own `monerod`**: poll
RPC, cache hot endpoints, fan out a single WS to all clients, rate-limit per IP.
Removes the always-on VPS while keeping push. (Keep the Node `relay/` as the
self-host option for sovereign operators.)

```ts
// Cloudflare Worker sketch
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === "/api/snapshot") {
      const [info, pool, market] = await Promise.all([
        fetch(env.MONEROD + "/get_info").then(r => r.json()),
        fetch(env.MONEROD + "/get_transaction_pool_stats").then(r => r.json()),
        fetch(env.COINGECKO_PROXY + "?ids=monero,bitcoin&vs_currencies=usd&include_24hr_change=true").then(r => r.json()),
      ]);
      return Response.json({ network: info, mempool: pool, market }, {
        headers: { "Cache-Control": "s-maxage=5", "Access-Control-Allow-Origin": "*" },
      });
    }
    // ...block/:h, tx/:txid, WS upgrade for /api/live
    return new Response("not found", { status: 404 });
  },
};
```

### 4. Stable wire contract = future-proofing
Freeze the `MoneroLive` TypeScript types (`repo/src/data/types.ts`) as the
contract between front and back end. Both the sim feed and the live feed satisfy
it, so you can develop the UI offline and swap backends without touching views.

### 5. Onion-aware data path
For the `.onion` mirror, the same Worker should be reachable over Tor (or run a
sibling onion service) so onion users get same-origin `/api/*` with no clearnet
beacon. `HashRouter` build + onion-served API = fully self-contained.

### 6. Resilience & honesty
- Keep v4's **multi-node cascade** in the aggregator (nodes go down).
- Per-IP rate limit at the edge to protect your `monerod`.
- Degrade gracefully: WS → polling → simulated, flipping `data.source` each step
  so the LIVE badge stays truthful.
- No `localStorage` of txids/addresses; cache only non-identifying aggregates.

---

## D. Migration order for data (maps to Brief Phase 2)

1. Ship v5 on the **simulated** feed (parity-build the UI offline).
2. Add `useXmrIrishFeed()` pointing at v4's **existing** `/api/*` (+ relay WS) —
   zero view changes. **You are now live on the v4 backend.**
3. Post-parity, introduce the **optimized** `/api/snapshot` + edge Worker (§C)
   behind the same hook. Views never notice.
