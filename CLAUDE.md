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

| File                    | Nav Name         | Purpose                                          |
|-------------------------|------------------|--------------------------------------------------|
| `index.html`            | Home             | Splash page — privacy evolution overview         |
| `bottom-line.html`      | XMR Bottom Line  | Full BTC/XMR analysis, thesis, timeline, bounties|
| `dashboard.html`        | Dashboard        | Multi-ticker, charts, analytics, crime stats     |
| `hold-monero.html`      | XMR              | Ecosystem hub — swaps, wallets, community        |
| `btc-xmr-education.html` | Education (Learn↓) | Visual infographics comparing BTC vs XMR      |
| `quotes.html`           | Quote Archive (Learn↓) | Interactive Satoshi quote explorer (30 quotes)|
| `secrets.html`          | Secrets (Learn↓)     | Deep dive into Satoshi's privacy writings    |
| `timeline.html`         | Timeline (Learn↓)    | Historical milestones visualization          |

## Development Conventions

- All pages are self-contained HTML files with inline CSS and JS
- No build process — edit HTML files directly
- Security headers configured in `netlify.toml` and `vercel.json`
- Keep pages consistent in styling and navigation

## Navigation Structure

Header: `₿ → ɱ | Home | Learn ▾ | XMR Bottom Line | Dashboard | XMR | [BTC] [XMR] [BTC/XMR]`

- **Learn** dropdown: Secrets, Quote Archive, Timeline, Education
- **Price tickers** in header on ALL pages (CoinGecko, 30-min refresh)
- Responsive: collapses to hamburger at 1024px
- Mobile menu: full-screen overlay with all links + prices

## Dynamic Features

### PriceService (all pages)
- Live BTC/USD, XMR/USD, BTC/XMR ratio tickers in every page header
- CoinGecko free API, 30-minute refresh interval
- Full pub/sub pattern on index.html; lightweight fetch on other pages

### Dashboard Charts (dashboard.html)
- TradingView Lightweight Charts (CDN, ~45KB)
- XMR price chart: area chart with 7D/30D/90D/6M/1Y range buttons
- BTC vs XMR comparison: normalized % change, dual line chart
- Multi-ticker grid: 8 coins (BTC, XMR, ETH, LTC, SOL, DOGE, ADA, DOT)
- Fiat comparisons: XMR in USD, EUR, JPY, GBP, CHF, AUD
- localStorage caching (tickers: 5min, charts: 30min-24hr by range)
- Charts lazy-loaded via IntersectionObserver

### Crime & Privacy Statistics (dashboard.html)
- Less than 1% of crypto crime involves Monero (Chainalysis)
- $625K+ IRS bounty with 0 successful traces
- 73 exchange delistings, +195% price growth
- $3.1B ransomware used BTC not XMR (FinCEN)
- XMR holdings, circulating supply, mining stats

### WidgetLoader (hold-monero.html → XMR hub)
- IntersectionObserver-based lazy loading for exchange iframes
- ChangeNOW and Wagyu iframes only load when scrolled into view

### SwapTracker (hold-monero.html → XMR hub)
- Users can check ChangeNOW swap status by pasting transaction ID
- Uses ChangeNOW public API (`/api/v1/transactions/{id}/`)
- Color-coded status display with support link

### LiveRate (hold-monero.html → XMR hub)
- Enhanced rate display: BTC→XMR ratio + individual prices + ratio bar
- Visual breakdown: BTC/USD, XMR/USD, conversion rate, update timestamp
- 30-minute refresh, CoinGecko source

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

- All 8 pages present and functional (7 original + dashboard.html)
- Unified header navigation across all pages with Learn dropdown
- Price tickers on every page header
- Dashboard page: live charts, multi-ticker, fiat comparisons, analytics
- XMR hub page: ecosystem, wallets, community, improved swap widget
- Crime statistics and XMR analytics integrated into Dashboard
- ChangeNOW widget with enhanced visual ratio display
- Cake Wallet deep-link integration: **ditched** (per user decision)

## Known Issues / TODOs

- **ChangeNOW 0.4% revenue setup**: Affiliate/revenue configuration pending
- **Wagyu API integration**: Evaluate interactive widget (currently iframe-only)
- **Backend evaluation**: Still needed for high-traffic chart caching
- **Custom ChangeNOW API swap**: Possible but regulatory risk — keep as widget
- **CoinGecko rate limits**: 10,000 calls/month on free tier; heavy traffic needs backend cache
- **All-time charts**: Require paid CoinGecko plan (free tier max 365 days)

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

- **2026-03-12** (PR#4): Home page overhaul, timeline expansion, security hardening.
  - Home splash: Rewritten with Monero-centric cypherpunk theme, "Satoshi Built the Vision.
    Monero Is the Reality." hero, removed vague opener
  - Home layout: BTC vs XMR comparison moved above crime stats, timeline + quote explorer removed
  - Crime stats: 8 stat cards (was 4), new data sources (UNODC, Nasdaq, Chainalysis 2025),
    added pie chart, bar chart, gauge comparison. Sources cited with links.
  - ChangeNOW widget: fixed white space issue (removed min-height, darkened background)
  - XMR page: added 5-coin privacy comparison (BTC vs XMR vs ZCash vs LTC vs SOL)
  - Timeline: expanded from 13 to ~40 events spanning 2008-2026
  - Footer: "AQUATIC" allusion added to home page footer
  - Security: Added CSP headers (netlify.toml + vercel.json), SRI hash for CDN scripts,
    standardized rel="noopener noreferrer" across all external links
- **2026-03-12** (PR#3): Major UX overhaul and new pages.
  - Header redesigned: 8 cluttered links → 5 cohesive items + Learn dropdown
  - Price tickers now on ALL page headers (were only on index.html)
  - "The Bottom Line" renamed to "XMR Bottom Line"
  - "Hold Monero" renamed to "XMR" — transformed into ecosystem hub
  - New dashboard.html: TradingView Lightweight Charts, multi-ticker grid,
    BTC vs XMR comparison, fiat currencies, crime statistics, XMR analytics
  - ChangeNOW widget UI improved: enhanced rate display with BTC/USD, XMR/USD,
    ratio bar, and update timestamps
  - XMR hub expanded: ecosystem links (GetMonero, Haveno, CCS, mining),
    wallets (Feather, Cake, GUI/CLI, Monerujo), community (Reddit, Matrix, SE, GitHub)
  - Cake Wallet deep-link integration ditched per user decision
  - All footers updated with new nav structure
  - Responsive breakpoint updated to 1024px for wider nav
- **2026-03-11**: Added dynamic layers — PriceService, WidgetLoader, SwapTracker, LiveRate.
  ChangeNOW widget kept (not custom API) due to liability concerns. Iframes now lazy-loaded.
  Backend evaluation documented: Railway + PostgreSQL recommended if dynamic features expand.
- **2026-03-11**: Initial CLAUDE.md created. Repo is a static HTML site with 7 pages,
  deployed via Netlify/Vercel. No build tools or dependencies.
