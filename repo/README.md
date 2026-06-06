# xmr.irish v5.0 — portable repo skeleton

A Vite + React 18 + TypeScript scaffold of the xmr.irish v5.0 design.
Self-contained, statically exportable (Tor / I2P / IPFS friendly), and
designed to slot into any host runtime — including claude.ai's live
data stack — via a single `DataProvider` seam.

---

## What you get

```
repo/
├── index.html                Vite entry
├── package.json              dev/build/preview/port scripts
├── vite.config.ts            stable hashes, base override via env
├── tsconfig.json             strict TS, @/ path alias
├── src/
│   ├── main.tsx              browser mount under BrowserRouter
│   ├── App.tsx               routes + DataProvider seam
│   ├── styles.css            terminal-CRT base + protocol chrome
│   ├── data/                 ◆ the seam for live data
│   │   ├── types.ts            MoneroLive — the stable wire shape
│   │   ├── simulated.ts        default in-browser feed (CoinGecko + sim)
│   │   └── DataContext.tsx     <DataProvider useFeed={…}>
│   ├── layout/               NavTop, NetRail, Footer, AppShell, PageHeader
│   ├── design/               primitives, ParticleField, ArtBackground, ProtoArtboard
│   ├── pages/                Home · Mempool · Education · Dashboard · Monero · Simulate · Node · NotFound
│   ├── views/index.tsx       registry of mempool views + protocol simulators (stubs until ported)
│   ├── mempool/              ← created by `npm run port`
│   └── protocols/            ← created by `npm run port`
├── legacy/                   pristine copies of the five01/ JSX source
│   ├── shared.jsx
│   ├── mempool/              5 view-engine surfaces
│   └── protocols/            6 protocol simulators
└── scripts/
    └── port-jsx-to-tsx.mjs   one-shot porter
```

---

## Quick start

```bash
cd repo
npm install
npm run dev
```

You'll land on the home page with the simulated feed. Open `/mempool`,
`/education`, `/dashboard`, `/simulate`, etc. The 5 mempool surfaces
and 6 protocol simulators show "needs porting" stubs until you run:

```bash
npm run port
```

This auto-converts the JSX in `legacy/` to TypeScript modules under
`src/mempool/` and `src/protocols/`. Then update `src/views/index.tsx`
to import them (instructions in that file). See **MIGRATION.md** for
the manual fixup list.

---

## Plugging your own live data

The whole runtime reads from one hook: `useMoneroLive()`. Swap in your
host feed at the root:

```tsx
import { App } from "@/App";
import { useMyLiveFeed } from "./my-feed";   // your worker / WS / RPC bridge

<App useFeed={useMyLiveFeed} />
```

Your hook must return the `MoneroLive` shape (see `src/data/types.ts`).
Everything else (sparklines, mempool grids, peer lists, dashboards)
follows automatically — no other change required.

If you don't supply `useFeed`, the simulated feed runs. It polls
CoinGecko for live XMR/BTC prices (CORS-open, no key) and simulates
mempool + block ticks every 2.2s / 30s. Realistic shape, never lies
about its source — `data.source === "simulated"` until your worker
replaces it.

### Suggested host endpoints (if you're building from scratch)

```
GET  /api/snapshot           → MoneroLive (initial)
WS   /api/live               → {type:"tx"|"block"|"price", payload}
GET  /api/tx/:txid           → Tx
GET  /api/block/:height      → Block
```

Then your hook becomes ~30 lines of `fetch` + `WebSocket` wiring. See
`legacy/shared.jsx` for the simulated-feed reference implementation.

---

## Design tokens

CSS variables in `src/styles.css` — primary palette:

| Token        | Use                                          |
|--------------|----------------------------------------------|
| `--tk-accent`| Primary action / network telemetry (orange)  |
| `--p-50`     | Privacy purple (Dandelion, stealth, FCMP)    |
| `--c-50`     | Telemetry cyan (secondary data, peers)       |
| `--g-50`     | Acid green (confirmation, sync, up-ticks)    |
| `--y-50`     | Caution yellow (queued, true-spender)        |
| `--r-50`     | Drop red (down-ticks, errors)                |

Fonts: Newsreader serif · Geist sans · JetBrains Mono. Swap by editing
`--f-serif`, `--f-sans`, `--f-mono` at `:root`.

---

## Privacy hygiene

The default build:
- No third-party analytics
- No external fetches except optional CoinGecko (opt-out by passing
  your own `useFeed`)
- No `localStorage` of tx-identifiable data
- Vite chunk hashes are stable → Tor users get long-tail HTTP cache hits
- Static export friendly — `npm run build` outputs to `dist/` for
  Cloudflare Pages, IPFS, or .onion mirror

---

## Caveats

- Public Monero RPC nodes generally don't serve `Access-Control-Allow-Origin`.
  Run a thin edge proxy and point your `useFeed` hook at it. See
  `DATA.md` in the source project.
- The simulated feed is for design preview. Don't ship to production
  without `useFeed`.
- Tweaks panel from the design hub is **not** in this repo — it's a
  design-time concern. The hub lives at the v5 design-hub URL.

---

## Roadmap

- Port the remaining `legacy/*.jsx` to TS (run `npm run port`)
- Add Onion mirror config
- Add edge worker example for live monerod data (Cloudflare Workers)
- Optional: i18n via `react-i18next`
