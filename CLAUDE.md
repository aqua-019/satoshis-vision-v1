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

## Key Decisions Log

<!-- Add decisions here as they are made, newest first -->
- **2026-03-11**: Established CLAUDE.md memory system for cross-session persistence

## Current Status / Progress

<!-- Update this section as work progresses -->
- Memory system established (CLAUDE.md)
- All 7 pages present and functional

## Known Issues / TODOs

<!-- Track open items here -->
- (none currently — add items as they come up)

## Session Notes

<!--
  Use this section to leave notes for future sessions.
  Format: **YYYY-MM-DD**: Note content
-->
- **2026-03-11**: Initial CLAUDE.md created. Repo is a static HTML site with 7 pages,
  deployed via Netlify/Vercel. No build tools or dependencies.
