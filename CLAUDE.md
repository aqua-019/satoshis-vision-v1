# CLAUDE.md — Project Memory for Claude Code

This file is automatically read by Claude Code at the start of every session.
It serves as persistent memory so context, decisions, and progress carry forward.

---

## Project Overview

**Satoshi's Vision Archive** — An educational static website exploring the evolution
from Bitcoin to Monero, documenting Satoshi Nakamoto's writings on privacy and the
divergent paths of transparent vs. private cryptocurrency.

- **Type**: Static HTML site (no build step, no framework)
- **Hosting**: Netlify / Vercel / GitHub Pages
- **License**: MIT

## Tech Stack

- Pure HTML/CSS/JS (no frameworks, no bundler)
- Netlify config: `netlify.toml`
- Vercel config: `vercel.json`
- No `package.json` — no npm dependencies

## Site Pages

| File                    | Purpose                                      |
|-------------------------|----------------------------------------------|
| `index.html`            | Splash page — privacy evolution overview     |
| `bottom-line.html`      | Full BTC/XMR analysis, timeline, bounties    |
| `hold-monero.html`      | Exchange widget demo (Wagyu + ChangeNOW)     |
| `btc-xmr-education.html` | Visual infographics comparing BTC vs XMR   |
| `quotes.html`           | Interactive Satoshi quote explorer (18 quotes)|
| `secrets.html`          | Deep dive into Satoshi's privacy writings    |
| `timeline.html`         | Historical milestones visualization          |

## Development Conventions

- All pages are self-contained HTML files with inline CSS and JS
- No build process — edit HTML files directly
- Security headers configured in `netlify.toml` and `vercel.json`
- Keep pages consistent in styling and navigation

## Dynamic Features

### PriceService (index.html)
- Shared pub/sub price service: `PriceService.subscribe(fn)` pattern
- Fetches BTC/USD, XMR/USD from CoinGecko, calculates BTC/XMR ratio
- 30-minute refresh interval (was 60s — reduced to respect rate limits)
- Any component can subscribe to price updates via `PriceService.subscribe()`

### WidgetLoader (hold-monero.html)
- IntersectionObserver-based lazy loading for all exchange iframes
- ChangeNOW and Wagyu iframes only load when scrolled into view
- Tracks loaded state to prevent duplicate loads

### SwapTracker (hold-monero.html)
- Users can check ChangeNOW swap status by pasting transaction ID
- Uses ChangeNOW public API (`/api/v1/transactions/{id}/`)
- Color-coded status display with support link
- Clear disclaimer that ChangeNOW handles all swap operations

### LiveRate (hold-monero.html)
- Shows live BTC→XMR conversion rate on swap page
- 30-minute refresh, same CoinGecko source

## Key Decisions Log

<!-- Add decisions here as they are made, newest first -->
- **2026-03-11**: ChangeNOW custom swap — decided to keep widget approach (not custom API)
  to avoid money transmitter liability. Added swap status tracker as value-add.
  Custom API integration would create shared liability; widget keeps ChangeNOW as
  sole service provider. Site clearly disclaims it does not custody funds.
- **2026-03-11**: CoinGecko API reduced from 60s to 30min interval to respect free-tier
  rate limits and reduce unnecessary calls. Added BTC/XMR ratio pair.
- **2026-03-11**: Iframe widgets now lazy-loaded via IntersectionObserver for performance.
- **2026-03-11**: Established CLAUDE.md memory system for cross-session persistence

## Current Status / Progress

<!-- Update this section as work progresses -->
- Memory system established (CLAUDE.md)
- All 7 pages present and functional
- PriceService dynamic layer added (index.html) — BTC/USD, XMR/USD, BTC/XMR
- WidgetLoader + SwapTracker + LiveRate added (hold-monero.html)
- Exchange iframes now lazy-loaded

## Known Issues / TODOs

<!-- Track open items here -->
- **Cake Wallet integration**: Research deep-linking / URI schemes for direct wallet connection
- **Backend evaluation**: Needed if adding charts/tickers, image/video hosting, multi-ticker dashboards
- **Railway + PostgreSQL**: Evaluate for future dynamic data (historical prices, chart data)
- **Custom ChangeNOW API swap**: Possible but creates regulatory risk — keep as widget for now
- **Wagyu API**: Docs at docs.wagyu.xyz — evaluate for custom DEX UI if widget insufficient

## Architecture Notes — Backend Evaluation

If the project grows beyond static content, here's the recommended path:

| Need | Solution | Hosting |
|------|----------|---------|
| Historical price charts | Node.js + CoinGecko historical API → PostgreSQL cache | Railway |
| Multi-ticker dashboard | Backend cron fetches prices, frontend polls `/api/prices` | Railway |
| Image/video hosting | Cloudflare R2 or Backblaze B2 (cheap object storage) | External CDN |
| Cake Wallet integration | Deep-link URIs (`monero:address?amount=X`) + QR codes | Static (no backend) |
| Custom ChangeNOW swap | Node.js proxy with API key (hides key from client) | Railway |
| Analytics (privacy-respecting) | Plausible or Umami self-hosted | Railway |

**Recommended stack if backend added:** Node.js + Fastify + PostgreSQL on Railway.
Keep current static pages as-is; add `/api` endpoints only for features that need server logic.

## Session Notes

<!--
  Use this section to leave notes for future sessions.
  Format: **YYYY-MM-DD**: Note content
-->
- **2026-03-11**: Added dynamic layers — PriceService, WidgetLoader, SwapTracker, LiveRate.
  ChangeNOW widget kept (not custom API) due to liability concerns. Iframes now lazy-loaded.
  Backend evaluation documented: Railway + PostgreSQL recommended if dynamic features expand.
  Cake Wallet integration research started — open-source, uses ChangeNOW/SideShift internally.
  Next steps: Cake Wallet deep-link integration, chart system if backend approved.
- **2026-03-11**: Initial CLAUDE.md created. Repo is a static HTML site with 7 pages,
  deployed via Netlify/Vercel. No build tools or dependencies.
