# Satoshi's Vision Archive

An educational website exploring the evolution from Bitcoin to Monero, documenting Satoshi Nakamoto's writings on privacy and the divergent paths of transparent vs. private cryptocurrency.

![Bitcoin](https://img.shields.io/badge/Bitcoin-F7931A?style=flat&logo=bitcoin&logoColor=white)
![Monero](https://img.shields.io/badge/Monero-FF6600?style=flat&logo=monero&logoColor=white)

## 🌐 Live Demo

Deploy to any static hosting platform:
- **Netlify**: Drag & drop or connect repo
- **Vercel**: One-click deploy
- **GitHub Pages**: Enable in repo settings

---

## 📁 Project Structure

```
satoshis-vision/
├── index.html              # Splash page - Privacy Evolution overview
├── bottom-line.html        # The Bottom Line - Complete BTC/XMR analysis
│                           # ├── TradFi Comparison Table
│                           # ├── Full Timeline (2008-2027)
│                           # ├── Government Bounties
│                           # ├── Cryptographic Architecture
│                           # └── Exchange Delistings
├── hold-monero.html        # Hold Monero - Wagyu + ChangeNOW integration
├── btc-xmr-education.html  # Educational comparison infographics
├── quotes.html             # Satoshi Quote Explorer (18 curated quotes)
├── secrets.html            # Satoshi's Privacy Secrets
├── timeline.html           # Visual Timeline
├── vercel.json             # Vercel configuration
├── netlify.toml            # Netlify configuration
├── .gitignore              # Git ignore rules
├── LICENSE                 # MIT License
└── README.md               # This file
```

---

## 🚀 Deployment Instructions

### Option 1: Netlify (Recommended)

**Drag & Drop:**
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag the `satoshis-vision-deploy` folder
3. Done! Get your URL instantly

**From GitHub:**
1. Push this repo to GitHub
2. Connect to Netlify
3. Build settings auto-configured via `netlify.toml`

---

### Option 2: Vercel

**From GitHub:**
1. Push this repo to GitHub
2. Import to [vercel.com/new](https://vercel.com/new)
3. Settings auto-configured via `vercel.json`

**CLI Deploy:**
```bash
npm i -g vercel
cd satoshis-vision-deploy
vercel
```

---

### Option 3: GitHub Pages

1. Create new GitHub repository
2. Upload all files from this folder
3. Go to **Settings → Pages**
4. Source: **Deploy from a branch**
5. Branch: **main** / Folder: **/ (root)**
6. Save → Wait 2-3 minutes
7. Your site: `https://[username].github.io/[repo-name]`

---

## 📄 Pages Overview

| Page | Description |
|------|-------------|
| **index.html** | Splash page with privacy evolution narrative |
| **bottom-line.html** | Comprehensive analysis: timeline, bounties, delistings |
| **hold-monero.html** | Exchange widget demo (Wagyu + ChangeNOW) |
| **btc-xmr-education.html** | Visual infographics comparing BTC vs XMR |
| **quotes.html** | Interactive Satoshi quote explorer |
| **secrets.html** | Deep dive into Satoshi's privacy writings |
| **timeline.html** | Historical milestones visualization |

---

## ⚠️ Legal Disclaimers

```
FOR EDUCATIONAL AND DEMONSTRATION PURPOSES ONLY

• This website documents publicly available information
• NOT financial, legal, or investment advice
• No endorsement of any cryptocurrency or financial product
• Third-party exchange widgets are for demonstration only
• Users are responsible for compliance with local regulations
• The creators assume no liability for use or misuse
```

---

## 🛡️ Security Headers

Both `netlify.toml` and `vercel.json` include security headers:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

---

## 📜 License

MIT License - See [LICENSE](LICENSE) file

---

## 🔗 External Resources

- [GetMonero.org](https://www.getmonero.org/) - Official Monero site
- [Bitcoin.org](https://bitcoin.org/) - Official Bitcoin site
- [Nakamoto Institute](https://nakamotoinstitute.org/) - Satoshi's writings
- [Monero Research Lab](https://www.getmonero.org/resources/research-lab/)

---

*"Privacy is not a crime. It is a right."*
— The Monero Community
