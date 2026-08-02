# Satoshi's Vision Archive — xmr.irish

An educational site on Bitcoin's surveillance trajectory and Monero's privacy
architecture, rendered from live chain and market data.

![Bitcoin](https://img.shields.io/badge/Bitcoin-F7931A?style=flat&logo=bitcoin&logoColor=white)
![Monero](https://img.shields.io/badge/Monero-FF6600?style=flat&logo=monero&logoColor=white)

**Live**: [xmr.irish](https://xmr.irish)

---

## 📁 Project Structure

```
satoshis-vision-v1/
├── app/                    # React 18 + Vite + TypeScript SPA — the front-end
│   ├── index.html          # Vite entry (carries the critical paint floor)
│   ├── src/                # routes, layout, data hooks, protocol simulators
│   ├── public/             # favicon + 12 self-hosted woff2
│   ├── scripts/
│   │   ├── routes.mjs      # the 11 static routes — single source of truth
│   │   ├── prerender.mjs   # emits dist/<route>/index.html (works with JS off)
│   │   ├── gen-sitemap.mjs # emits dist/sitemap.xml + dist/robots.txt
│   │   └── serve-dist.mjs  # local mirror of Vercel's resolution order
│   └── verify-*.mjs        # 54 gates + verify-lib.mjs and verify-reporter.mjs (shared, not gates)
├── api/                    # Vercel serverless functions — CommonJS
│   └── verify-*.mjs        # 4 offline gates
├── relay/                  # websocket relay (not currently deployed)
├── docs/                   # design specs and historical v4 audits
├── vercel.json             # deploy config: build, rewrites, CSP, HSTS
└── LICENSE
```

> The v4 static site that used to live at the repo root (22 `.html` pages, `js/`,
> `css/`) was deleted in v6.1.0. It had been unreachable since the SPA migration —
> `vercel.json` publishes `app/dist`, which those files were never part of.

---

## 🚀 Development

```bash
cd app
npm ci
npm run dev        # vite dev server
npm run build      # tsc + vite build + SSR + prerender + sitemap
```

To serve a production build exactly as Vercel resolves it — real file, then
directory index, then the SPA catch-all:

```bash
node scripts/serve-dist.mjs &
npm run wait-preview
```

`npm run preview` (plain `vite preview`) is an SPA server that falls back to
`index.html` for every path, so it hides prerender breakage. Prefer `serve-dist`.

### Adding or removing a route

Edit **`app/scripts/routes.mjs`**. The prerenderer and the sitemap generator both
read it, so the two stay in step. Register the route in `app/src/App.tsx` as well.

---

## ✅ Verification

59 gates guard this repo (54 in `app/`, 5 in `api/`; `verify-lib.mjs` and
`verify-reporter.mjs` are shared modules, not gates).
`.github/workflows/ci.yml` runs **45 distinct** files on every PR to `main`, in
two jobs: 10 named offline gates, then `verify:static` and `verify:e2e` (four of
the 10 also appear in `verify:static`, and `verify-origins` appears in both
chains, which is why 10 + 17 + 23 is not 50).

```bash
cd app
npm run typecheck
npm run build

npm run verify:static   # 17 source-assertion gates, no browser, ~30s

npx playwright install --with-deps chromium
node scripts/serve-dist.mjs &
npm run wait-preview
npm run verify:e2e      # 23 Playwright gates
```

Three more are npm-wired but deliberately not in CI — `verify:shots`,
`verify:perf`, `verify:mem:perf`. `verify-shots.mjs`'s `--baseline` diff needs a
shot tree built from another commit, which CI has no way to produce; the two
perf gates measure framerate, which a shared runner cannot measure honestly.

The remaining 11 are wired to neither npm nor CI. Several expect live upstreams
the sandbox cannot reach; auditing and wiring them is its own task. (v6.1.4
wired in `verify-allreal-dom.mjs` and `verify-tiers-dom.mjs`, which between them
already asserted the CONNECTING / LIVE / STALE vocabulary, last-good retention
under outage, and the tier cadence — exactly the regression surface of that
release's status refactor.)

---

## 🛡️ Security and privacy invariants

These are enforced by gates, not convention:

- **One origin.** CSP is `connect-src 'self'`. The browser reaches no third party;
  everything is proxied through `/api/`. Gated by `verify-origins.mjs`.
- **Self-hosted fonts.** 12 woff2 in `app/public/fonts/`. No CDN — the site is used
  over Tor and the external-request count must stay at zero.
- **No fabricated data.** `Math.random()` is confined to `app/src/protocols/` (the
  educational simulators). Live surfaces show real values or an em-dash, never an
  invented one. Degradation is "STALE · reconnecting" plus last-good, never synthesis.
- **Works with JavaScript off.** Every static route is prerendered to real HTML.
- **No white flash.** Every route keeps its `noscript` block and a literal
  background floor. Gated by `verify-degraded.mjs`.
- **Usable at 390px**, no text under 12px, and a `prefers-reduced-motion` path that
  loses no information.

Security headers (`vercel.json`): `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
`Strict-Transport-Security` with preload, and the CSP above.

---

## ⚠️ Legal Disclaimers

```
FOR EDUCATIONAL AND DEMONSTRATION PURPOSES ONLY

• This website documents publicly available information
• NOT financial, legal, or investment advice
• No endorsement of any cryptocurrency or financial product
• Users are responsible for compliance with local regulations
• The creators assume no liability for use or misuse
```

---

## 📜 License

MIT License — see [LICENSE](LICENSE)

---

## 🔗 External Resources

- [GetMonero.org](https://www.getmonero.org/) — Official Monero site
- [Bitcoin.org](https://bitcoin.org/) — Official Bitcoin site
- [Nakamoto Institute](https://nakamotoinstitute.org/) — Satoshi's writings
- [Monero Research Lab](https://www.getmonero.org/resources/research-lab/)

---

*"Privacy is not a crime. It is a right."*
— The Monero Community
