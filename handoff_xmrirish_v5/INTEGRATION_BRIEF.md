# INTEGRATION BRIEF — xmr.irish v4 → v5

Full migration plan: take the live vanilla-JS site to the v5 React / Vite /
TypeScript design, all seven surfaces, without losing the site's privacy
properties or its working data backend.

---

## 1. Where we are vs. where we're going

| | **v4 (live today)** | **v5 (this design)** |
|---|---|---|
| Repo | `aqua-019/satoshis-vision-v1` | same repo, `v5-migration` branch |
| Stack | Vanilla JS, **no build step** | React 18 + Vite + TypeScript |
| Rendering | Canvas 2D viz, full-page nav between modes | SPA, client routing, React components |
| Design system | **d10** — JetBrains Mono / DM Mono / Playfair Display | **five01** — Newsreader / Geist / JetBrains Mono |
| Pages | mempool-explorer / ocean / mining (3 modes) | 7 surfaces (see §5) |
| Data | Vercel `api/*` proxies + optional Node `relay/` (ZMQ→WS) | one `useMoneroLive()` hook — **wires to the same backend** |
| Host | Vercel, `vercel.json` (CSP, cleanUrls, rewrites) | same Vercel project, build output to `dist/` |

**The core gap:** v4 is a no-build static site; v5 is a bundled React app. This
is a real rewrite of the *presentation layer*. The **data layer does not get
rewritten** — it gets re-pointed (see `DATA_LAYER.md`).

---

## 2. Two sources of truth — and which wins

This bundle ships the design in two forms. Use both, but know their roles:

- **`design-reference/five01/` (+ `index.html`)** — the **design + behavior
  ground truth.** This is the runnable 0.1 UI. Every screenshot came from here.
  It has all seven surfaces, the real copy, the real interactions, the real
  visualizations. When in doubt, render `index.html` and read the JSX.

- **`repo/`** — a **Vite + React + TS skeleton** that scaffolds the migration:
  routing, the `DataProvider` seam, typed design tokens, page shells, and a
  one-shot JSX→TSX porter (`npm run port`). It is intentionally a *starting
  point* and is **behind** five01 — it stubs several views and has none of the
  app01 pages ported.

> **Rule:** the `repo/` is the *destination*. The `five01/` JSX is the *spec*.
> Port from five01 into the repo's structure. Where the repo's stub and the
> five01 source disagree, five01 is correct.

What the repo skeleton already gives you (don't rebuild these):
`src/App.tsx` routes, `src/data/{types,simulated,DataContext}.ts(x)`,
`src/design/{primitives,ArtBackground,ProtoArtboard}.tsx`,
`src/layout/{NavTop,NetRail,Footer,AppShell,PageHeader}.tsx`, `src/styles.css`
(tokens), and `scripts/port-jsx-to-tsx.mjs`. See `repo/README.md`,
`repo/PORTING.md`, `repo/MIGRATION.md`.

---

## 3. Design system: d10 → five01

v5 keeps the site's **black / orange / green / grey** DNA and adds two phosphors
to encode meaning. Don't invent new colors — these are the tokens (in
`repo/src/styles.css` `:root`, mirrored in `five01/styles.css`):

| Token | Value | Use |
|---|---|---|
| `--tk-accent` | phosphor orange | primary action, network telemetry |
| `--p-50` | `#b87aff` privacy purple | Dandelion, stealth, FCMP — "this layer hides something" |
| `--c-50` | `#5ed3f4` telemetry cyan | secondary data, peers, view-tags |
| `--g-50` | `#4ade80` acid green | confirmation, sync, up-ticks |
| `--y-50` | `#ffd400` caution yellow | queued, true-spender |
| `--r-50` | `#ff4d6d` drop red | down-ticks, errors |

**Type:** `--f-serif` Newsreader (display / lede) · `--f-sans` Geist (UI) ·
`--f-mono` JetBrains Mono (every number, txid, address, log line). The v4 d10
system used Playfair + DM Mono; v5 replaces them. Self-host the trio or serve
via the privacy-respecting bunny.net mirror already used in v4 — **do not add
a fresh Google Fonts CDN call from the browser on Tor** (see §7).

The visual signature is a **terminal-CRT phosphor** aesthetic: HUD brackets,
scanlines, particle background, mono kickers. The `ArtBackground` component and
the `--glow` / scanline tokens carry it. Keep it consistent across all surfaces.

---

## 4. Migration phases

Land these as sequential PRs against `v5-migration`. **Stop for review between
phases.** Estimated effort assumes Claude Code doing the porting with a human
reviewing.

### Phase 0 — Stand up the skeleton (½ day)
- Drop `repo/` into the project (e.g. as the new app root, or `app/` alongside
  the legacy `public/` v4 pages during transition).
- `npm install && npm run dev` → confirm the home page renders on the simulated
  feed at `localhost:5173`.
- Wire CI: `npm run typecheck` + `npm run build` must pass.

### Phase 1 — Design system + app shell (1 day)
- Finalize tokens in `src/styles.css` (colors, type, glow, scanlines).
- Port `NavTop`, `NetRail`, `Footer`, `AppShell`, `ArtBackground`,
  `primitives` to pixel-match the screenshots. These are shared by every page.
- Verify against `screenshots/01-home.png` chrome (top nav, bottom status bar,
  left telemetry rail).

### Phase 2 — Data seam (1 day) → see `DATA_LAYER.md`
- Keep the simulated feed as the dev default.
- Write `useXmrIrishFeed()` that points the `MoneroLive` shape at v4's existing
  `/api/*` endpoints (and the relay WS when present). **No view changes** — the
  whole app follows the hook.

### Phase 3 — Home + Monero (1 day)
- `Home`: hero, live price card, recent-blocks strip, "7 surfaces" grid.
  Targets: `screenshots/01-home.png`, `02-home-hero-card.png`.
- `Monero`: origin / philosophy / 11-year timeline.
  Target: `screenshots/09-monero.png`. Source: `five01/src/app01/monero-pages.jsx`.

### Phase 4 — Mempool (the flagship, 2–3 days)
- Port the **5 view directions** + classic + tx/block detail. This is the
  densest surface. Source files in `five01/src/mempool/`:
  `reactor.jsx` ★, `classic.jsx`, `bridge.jsx`, `sediment.jsx`,
  `constellation.jsx`, `terminal.jsx`, plus `tx-detail.jsx` and
  `mempool-shared.jsx`.
- The view switcher (top-right) selects between directions.
- Targets: `screenshots/03-mempool-reactor.png`, `04-mempool-classic.png`,
  `05-mempool-sediment.png`, `06-mempool-tx-detail.png`.
- Follow `repo/MIGRATION.md` §5 — each legacy view embedded its own page chrome;
  the page renders chrome, the view renders only content.

### Phase 5 — Education + Simulate (2 days)
- The **protocol simulators** (decoy selection, Dandelion++, view-tags, RingCT,
  stealth, FCMP++, plus metaphor variants). Source: `five01/src/protocols/`.
  Each uses the `ProtoArtboard` shell (`repo/src/design/ProtoArtboard.tsx`).
- `Education`: the simulators as cards + roadmap. `Simulate`: full-bleed with a
  switcher. Same components, two presentations.
- Education content sections: `five01/src/app01/education-*.jsx`.
- Target: `screenshots/10-simulate-protocols.png`.
- Note `repo/MIGRATION.md` §4 — `ProtoArtboard title` takes JSX in five01; in TS
  pass an HTML string or widen the prop.

### Phase 6 — Dashboard / Markets / Network + Run a Node (1–2 days)
- KPI dashboard: hashrate, price, fee histogram, pools, peers, blocks.
- Markets + Network surfaces. Source: `five01/src/app01/markets.jsx`,
  `network.jsx`, `markets-network.jsx`, `tilt-card.jsx` (mouse-reactive panels).
  Targets: `screenshots/07-markets.png`, `08-network.png`.
- `Run a Node`: quick-start guide for `monerod`.

### Phase 7 — Hardening & cutover (1–2 days)
- Static export (`npm run build`), SPA fallback rewrite in `vercel.json`
  (`/* → /index.html`), or swap `BrowserRouter` → `HashRouter` for .onion.
- Re-apply v4's CSP / security headers / `cleanUrls` (see §7).
- Onion mirror, cache headers, Lighthouse + a11y pass.
- Flip the Vercel project's output to `dist/`; retire the v4 vanilla pages.

> **Out of scope** (design-time only, do not port): the Tweaks panel and edit
> mode. They live in the design hub, not the shipped site. See
> `repo/PORTING.md` → "What's deliberately NOT in this repo."

---

## 5. Surface map (routes → source → target)

| Route | Surface | Source (five01) | Screenshot |
|---|---|---|---|
| `/` | Home | `app01/pages.jsx`, `app01/main.jsx` | `01-home.png`, `02-home-hero-card.png` |
| `/mempool` | Mempool (5 dirs + classic + detail) | `mempool/*.jsx` | `03/04/05/06-mempool-*.png` |
| `/education` | Education hub (protocol cards + roadmap) | `app01/education-*.jsx`, `protocols/*.jsx` | `10-simulate-protocols.png` |
| `/dashboard` | KPI dashboard | `app01/markets.jsx`, `network.jsx` | `07-markets.png`, `08-network.png` |
| `/monero` | Origin / philosophy / timeline | `app01/monero-pages.jsx` | `09-monero.png` |
| `/simulate` | Full-bleed protocol simulators | `protocols/*.jsx` | `10-simulate-protocols.png` |
| `/node` | Run-a-node quick start | `app01/pages.jsx` | — |
| `/design` | (internal) design canvas | `design-hub.html` | `11-design-hub.png` |

> The live nav in the 0.1 UI labels these **HOME · MEMPOOL · MARKETS · NETWORK ·
> MONERO · EDUCATION · SIMULATE · RUN A NODE**. Markets and Network are split out
> of the dashboard in the newest five01 source — follow the nav in `index.html`,
> not the older route table in `repo/`.

---

## 6. Reconciling repo ⟷ five01 (the porting loop)

For each surface:

1. Open `design-reference/index.html`, navigate to the route, and read the live
   behavior. Cross-check the screenshot.
2. Find the matching `five01/src/...jsx` source.
3. Port it into the repo's TS structure. For the mempool/protocol view-engine
   files, run `cd repo && npm run port` first (auto-converts `legacy/*.jsx` →
   `src/{mempool,protocols}/*.tsx`), then follow `repo/MIGRATION.md`'s manual
   checklist (tighten `any` → `MoneroLive`/`Tx[]`/`Peer[]`, strip embedded
   chrome, fix `ProtoArtboard` titles, remove `window.X` globals).
4. Register real components in `repo/src/views/index.tsx` (replace the stubs).
5. `npm run typecheck && npm run build`; visual-diff against the screenshot.

> The repo's `legacy/` folder only has the **5 original mempool views + 6
> protocols** — it predates `classic.jsx`, `tx-detail.jsx`, `mempool-shared.jsx`,
> and the app01 pages. Copy those newer files from `design-reference/five01/`
> into `repo/legacy/` (or port them by hand) before running `npm run port`.

---

## 7. Non-negotiable constraints (carried from v4)

xmr.irish is a privacy site. The migration must preserve:

- **No analytics, no trackers, no third-party embeds.** None. Ever.
- **Browser never hits a Monero RPC directly** — always via our `api/` proxy or
  the relay. Public nodes lack CORS and you don't want users sharing RPC limits.
- **No browser-side CoinGecko on Tor** — proxy it server-side (v4 already does:
  `api/coingecko.js`). Keep that.
- **Keep `vercel.json`** CSP, `X-Frame-Options: DENY`, `Referrer-Policy:
  no-referrer`, HSTS, `cleanUrls`, and the cache headers. Update the CSP only to
  cover the new bundled asset paths — don't loosen it.
- **Static-export friendly** — Tor / I2P / IPFS / `.onion` mirror must keep
  working. Prefer `HashRouter` for the onion build, or add the SPA fallback.
- **No `localStorage` of tx-identifiable data** (txids, addresses).
- Self-host the font trio (or bunny.net mirror) — no new CDN beacon.

---

## 8. Git & rollout strategy

```
main                     ← v4 vanilla site, stays deployable
 └─ v5-migration         ← long-lived integration branch
     ├─ phase-0-skeleton       PR #1
     ├─ phase-1-shell          PR #2
     ├─ phase-2-data           PR #3
     ├─ phase-3-home-monero    PR #4
     ├─ phase-4-mempool        PR #5
     ├─ phase-5-edu-simulate   PR #6
     ├─ phase-6-dashboard-node PR #7
     └─ phase-7-harden-cutover PR #8  ← flip Vercel output to dist/, retire v4
```

- Keep v4 pages live throughout. Optionally deploy v5 to a preview subdomain or
  `/v5` subpath (`VITE_BASE=/v5/ npm run build`) for parallel review.
- Cut over only when v5 reaches parity and the privacy/CSP checklist (§7) passes.
- Tag the cutover commit `v5.0.0`.

---

## 9. Definition of done

- All 8 routes render on real data through `useMoneroLive()`.
- `npm run typecheck` and `npm run build` are clean.
- Each surface visually matches its screenshot in `screenshots/`.
- The §7 privacy/CSP checklist passes; Tor/onion build works.
- v4 retired; `dist/` is the deployed artifact; commit tagged `v5.0.0`.
