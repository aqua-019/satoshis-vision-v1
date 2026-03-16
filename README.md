# XMR.IRISH — Satoshi's Vision Archive

An educational website exploring the evolution from Bitcoin to Monero, documenting Satoshi Nakamoto's writings on privacy and the divergent paths of transparent vs. private cryptocurrency.

![Bitcoin](https://img.shields.io/badge/Bitcoin-F7931A?style=flat&logo=bitcoin&logoColor=white)
![Monero](https://img.shields.io/badge/Monero-FF6600?style=flat&logo=monero&logoColor=white)

## Live Demo

Deploy to any static hosting platform:
- **Netlify**: Drag & drop or connect repo
- **Vercel**: One-click deploy
- **GitHub Pages**: Enable in repo settings

---

## Project Structure

```
xmr-irish/
├── index.html              # Home — privacy evolution overview
├── bottom-line.html        # Full BTC/XMR analysis, timeline, bounties
├── hold-monero.html        # Exchange widgets (Wagyu + ChangeNOW)
├── btc-xmr-education.html  # Visual infographics comparing BTC vs XMR
├── quotes.html             # Interactive Satoshi quote explorer (18 quotes)
├── secrets.html            # Deep dive into Satoshi's privacy writings
├── timeline.html           # Historical milestones visualization
├── dashboard.html          # Crypto market analytics, TradingView charts
├── future-outlook.html     # 2027+ outlook — adoption drivers, projections
├── 404.html                # Custom error page
├── styles.css              # Shared CSS (nav, footer, variables, responsive)
├── scripts.js              # Shared JS (mobile menu, price ticker)
├── netlify.toml            # Netlify configuration + security headers
├── vercel.json             # Vercel configuration + security headers
├── CLAUDE.md               # Claude Code project memory
├── .gitignore              # Git ignore rules
├── LICENSE                 # MIT License
└── README.md               # This file
```

---

## Pages Overview

| Page | Route | Description |
|------|-------|-------------|
| **index.html** | `/` | Home page with privacy evolution narrative and PriceService |
| **bottom-line.html** | `/bottom-line` | Comprehensive analysis: timeline, bounties, delistings |
| **hold-monero.html** | `/hold-monero` | Exchange widget demo (Wagyu + ChangeNOW), swap tracker |
| **btc-xmr-education.html** | `/education` | Visual infographics comparing BTC vs XMR |
| **quotes.html** | `/quotes` | Interactive Satoshi quote explorer |
| **secrets.html** | `/secrets` | Deep dive into Satoshi's privacy writings |
| **timeline.html** | `/timeline` | Historical milestones visualization |
| **dashboard.html** | `/dashboard` | Live market analytics with TradingView charts |
| **future-outlook.html** | `/future-outlook` | 2027+ outlook and adoption projections |

---

## Tech Stack

- **Pure HTML/CSS/JS** — no frameworks, no bundler, no npm
- **Shared assets**: `styles.css` (common CSS) + `scripts.js` (common JS)
- **Live prices**: CoinGecko API (BTC/USD, XMR/USD, BTC/XMR ratio)
- **Charts**: TradingView embedded widgets (dashboard)
- **Exchange**: ChangeNOW widget + Wagyu DEX widget
- **Hosting**: Netlify / Vercel / GitHub Pages

---

## Deployment

### Netlify (Recommended)

**Drag & Drop:**
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag the project folder
3. Done — get your URL instantly

**From GitHub:**
1. Push this repo to GitHub
2. Connect to Netlify
3. Build settings auto-configured via `netlify.toml`

### Vercel

**From GitHub:**
1. Push this repo to GitHub
2. Import to [vercel.com/new](https://vercel.com/new)
3. Settings auto-configured via `vercel.json`

**CLI Deploy:**
```bash
npm i -g vercel
vercel
```

### GitHub Pages

1. Create new GitHub repository
2. Upload all files
3. Go to **Settings > Pages**
4. Source: **Deploy from a branch** > **main** / **/ (root)**
5. Save — site live at `https://[username].github.io/[repo-name]`

---

## Security Headers

Both `netlify.toml` and `vercel.json` include:
- `Content-Security-Policy` — restricts script/style/font/frame sources
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security` — HSTS with preload
- `Permissions-Policy` — camera, microphone, geolocation disabled

---

## Legal Disclaimers

```
FOR EDUCATIONAL AND DEMONSTRATION PURPOSES ONLY

- This website documents publicly available information
- NOT financial, legal, or investment advice
- No endorsement of any cryptocurrency or financial product
- Third-party exchange widgets are for demonstration only
- Users are responsible for compliance with local regulations
- The creators assume no liability for use or misuse
```

---

## License

MIT License — See [LICENSE](LICENSE) file

---

## External Resources

- [GetMonero.org](https://www.getmonero.org/) — Official Monero site
- [Bitcoin.org](https://bitcoin.org/) — Official Bitcoin site
- [Nakamoto Institute](https://nakamotoinstitute.org/) — Satoshi's writings
- [Monero Research Lab](https://www.getmonero.org/resources/research-lab/)

---

*"Privacy is not a crime. It is a right."*
— The Monero Community
