# Backend Evaluation — Railway + Node.js + PostgreSQL

**Date:** 2026-03-16
**Status:** Evaluated — not needed yet, recommended path documented

---

## Current Architecture

XMR.IRISH is a fully static site (HTML/CSS/JS) with:
- **CoinGecko API** for live prices (client-side fetch, 30-min interval)
- **TradingView widgets** for embedded charts (dashboard.html)
- **ChangeNOW widget** for exchange functionality (hold-monero.html)

All API calls are made client-side. No server-side logic exists.

---

## When a Backend Becomes Necessary

| Trigger | Why a Backend Helps |
|---------|-------------------|
| **Historical price charts** | CoinGecko free tier has no historical data; a backend can cache `/coins/{id}/market_chart` responses in PostgreSQL |
| **Rate limit pressure** | Multiple users hitting CoinGecko directly from their browsers will hit rate limits; a backend acts as a shared cache |
| **Custom ChangeNOW API swap** | Requires hiding the API key server-side; creates regulatory complexity |
| **User analytics** | Privacy-respecting analytics (Plausible/Umami) require a server |
| **Newsletter / notifications** | Email integration needs server-side processing |

---

## Recommended Stack

```
┌─────────────┐     ┌──────────────────┐     ┌────────────┐
│  Static Site │────▶│  Node.js + Fastify │────▶│ PostgreSQL │
│  (Netlify)   │     │  (Railway)        │     │ (Railway)  │
└─────────────┘     └──────────────────┘     └────────────┘
       │                     │
       │  /api/prices        │  CoinGecko API
       │  /api/chart-data    │  (server-side, cached)
       └─────────────────────┘
```

### Why This Stack

| Choice | Reasoning |
|--------|-----------|
| **Node.js** | Same language as frontend; minimal learning curve |
| **Fastify** | Fastest Node.js framework; built-in validation, logging |
| **PostgreSQL** | Reliable, free on Railway starter plan (500MB) |
| **Railway** | One-click deploy from GitHub; $5/mo hobby plan; auto-SSL |

### Alternative Considered

| Alternative | Verdict |
|------------|---------|
| **Cloudflare Workers** | Good for simple proxy/cache, but no persistent DB without D1 (still beta) |
| **Supabase** | Overkill — adds auth/realtime we don't need; PostgreSQL-compatible though |
| **Deno Deploy** | Fast but smaller ecosystem; Railway has better DX for this use case |
| **Firebase** | Google lock-in; doesn't align with privacy-focused ethos |

---

## API Endpoints (If Built)

```
GET /api/prices
  → Returns cached BTC/USD, XMR/USD, BTC/XMR from PostgreSQL
  → Cache TTL: 5 minutes
  → Falls back to CoinGecko if cache stale

GET /api/chart/:coin/:days
  → Returns historical price data for BTC or XMR
  → Cached in PostgreSQL, refreshed every 6 hours
  → Replaces TradingView widgets with custom charts

GET /api/health
  → Returns 200 + uptime + cache status
```

---

## Database Schema (If Built)

```sql
CREATE TABLE price_cache (
    coin_id    TEXT NOT NULL,
    usd        NUMERIC(18,8),
    change_24h NUMERIC(8,4),
    market_cap NUMERIC(20,2),
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (coin_id)
);

CREATE TABLE chart_data (
    coin_id    TEXT NOT NULL,
    timestamp  TIMESTAMPTZ NOT NULL,
    price_usd  NUMERIC(18,8),
    volume_usd NUMERIC(20,2),
    PRIMARY KEY (coin_id, timestamp)
);

CREATE INDEX idx_chart_data_time ON chart_data (coin_id, timestamp DESC);
```

---

## Cost Estimate (Railway)

| Resource | Cost |
|----------|------|
| Hobby plan | $5/month |
| PostgreSQL (500MB) | Included |
| Compute (~100 req/day) | ~$0.50/month |
| **Total** | **~$5.50/month** |

---

## Migration Path

1. **Phase 1 (current):** Static site with client-side CoinGecko calls — no backend needed
2. **Phase 2 (if needed):** Add Railway backend with `/api/prices` endpoint; frontend switches from direct CoinGecko to `/api/prices`
3. **Phase 3 (if charts needed):** Add `/api/chart/:coin/:days` endpoint; replace TradingView widgets with custom Chart.js/D3 charts
4. **Phase 4 (if custom swap needed):** Add `/api/swap` proxy for ChangeNOW API key — requires legal review first

---

## Recommendation

**Stay static for now.** The current architecture handles the site's needs well:
- CoinGecko free tier is sufficient for single-user price updates
- TradingView widgets provide professional charts without backend
- ChangeNOW widget avoids regulatory risk

**Build the backend when:**
- Traffic exceeds CoinGecko free tier limits (~30 req/min)
- Custom historical charts are required
- Analytics or newsletter features are added
