# Section 5 — Privacy invariant audit

> Privacy violations are **always ship-blocker or accept** per Phase 6 contract.
> No v5.0 deferral path.

## Runtime external-call inventory

| File:Line | Method | Target | Class |
|---|---|---|---|
| `markets.html:204` | `fetch` | `api.coingecko.com/api/v3/coins/monero/market_chart` | DOCUMENTED EXCEPTION (CoinGecko, but extends price-service path — **see P-2 DECIDE**) |
| `markets.html:212` | `fetch` | `api.coingecko.com/api/v3/coins/bitcoin/market_chart` | Same as above |
| `js/price-service.js:29` | `fetch` | `api.coingecko.com/api/v3/simple/price` | DOCUMENTED EXCEPTION (30-min interval confirmed) |
| `hold-monero.html:285` | `<iframe src=>` | `changenow.io/embeds/...` | DOCUMENTED EXCEPTION (user-initiated, lazy-loaded) |
| `api/xmr.js:716` | server-side `fetch` | `p2pool.io/api/stats` | PASS (back-end only, same-origin from browser) |
| `api/xmr.js:720` | server-side `fetch` | `moneroocean.stream/api/pool/stats` | PASS (back-end only) |
| `api/monero.js` | server-side proxy | 4 Monero RPC nodes | PASS (back-end only) |
| `js/xmr-relay-ws.js:121` | `WebSocket` | `defaultUrl=null` | PASS (currently disabled; polling-only) |
| All 18 HTML `<head>` | `<link rel="stylesheet">` | `fonts.bunny.net/css2?family=...` | DOCUMENTED EXCEPTION (per CSP) — **see P-1 DECIDE** |

**No NEW violations** beyond the seed list. No analytics tags. No tracking pixels. No service workers.

## Findings

| # | Finding | Class |
|---|---|---|
| P-1 | `fonts.bunny.net` loaded in every page `<head>` (5 font families: JetBrains Mono, Playfair Display, DM Mono, Geologica, Sora). CLAUDE.md and site marketing imply self-hosted fonts. CSP allows it but the privacy-invariant claim breaks at runtime. | DECIDE: ship-blocker (self-host) or accept (document exception) |
| P-2 | `markets.html:204,212` direct browser fetch to CoinGecko market_chart. Distinct from `price-service.js`. | DECIDE: extend price-service or accept as same-vendor extension |
| P-3 | CSP unused entries: `connect-src` lists `xmrchain.net`, `localmonero.co`; `img-src` allows `api.coingecko.com`. None used at runtime. | FIX (CSP tightening, low-risk) |
| P-4 | CSP missing `Strict-Transport-Security`. Phase 6 §9.2 requires. | FIX |
| P-5 | Server-side fetches in `api/xmr.js` to p2pool.io / moneroocean.stream. Back-end only. | PASS |
| P-6 | ChangeNOW iframe — confirmed `loading="lazy"`, user-initiated. | PASS |
| P-7 | ChangeNOW `postMessage` handler in `hold-monero.html:614-640` lacks explicit `targetOrigin` check. Read-only handler (no sensitive data sent back). | DECIDE: defensive add or accept |
| P-8 | CSP `script-src` allows `'unsafe-inline'`. 19 inline `<script>` blocks across pages depend on this. Externalizing to drop unsafe-inline = v5.0 hardening. | DECIDE: v5.0 deferral |
| P-9 | `localStorage` used for session cache (price ticker, scroll depth, chart history). No exfil to external. | PASS |
| P-10 | No service workers registered. | PASS |
| P-11 | No analytics (gtag/fbq/mixpanel/hotjar/amplitude/plausible/umami) found anywhere. | PASS |

## CSP tightening — proposed (P-3)

In `vercel.json:19`, current:
```
connect-src 'self' https://api.coingecko.com https://xmrchain.net https://localmonero.co https://p2pool.io https://moneroocean.stream wss://relay.xmr.irish;
img-src 'self' data: https://api.coingecko.com;
```

Proposed:
```
connect-src 'self' https://api.coingecko.com;
img-src 'self' data:;
```

Removed: `xmrchain.net`, `localmonero.co` (link-only references), `p2pool.io`, `moneroocean.stream` (server-side only — browser never connects), `wss://relay.xmr.irish` (relay disabled in `xmr-relay-ws.js`), `api.coingecko.com` from `img-src` (unused).

## CSP HSTS addition (P-4)

Add to top-level `headers` block:
```json
{ "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains; preload" }
```

## Static ship-blockers

**Per the prompt**, privacy ship-blockers cannot be deferred. The ONLY DECIDE-grade items requiring Aquatic input are:

1. **P-1** (fonts.bunny.net) — fix (self-host, ~30-60 min) or accept (document)
2. **P-2** (markets.html CoinGecko market_chart) — extend price-service abstraction (~15-30 min) or accept

**P-3** and **P-4** are clear FIX items; will be applied in Phase D.

## MANUAL items

- DevTools Network audit per page on live URL: confirm only allowed origins fire on hard-reload.
- Confirm sim animation triggers zero requests during 30-second loop.
- Verify no inflight CSP violations in console on production.
