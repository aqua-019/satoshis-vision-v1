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
│   │   ├── xmrirish-feed.ts    default feed (same-origin /api/* polling)
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

You'll land on the home page with the live feed (the dev server proxies
`/api/*` to the production origin). Open `/mempool`,
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

If you don't supply `useFeed`, the real xmr.irish feed runs: it polls
the same-origin `/api/monero`, `/api/xmr/*`, and `/api/coingecko`
proxies every 2.5s. First paint shows skeletons until real data lands
(`data.ready` / `data.marketReady`), and on poll failure the last-good
snapshot is kept with `data.stale === true` — the UI never shows a
number that didn't come from the node or CoinGecko.

### Suggested host endpoints (if you're building from scratch)

```
GET  /api/snapshot           → MoneroLive (initial)
WS   /api/live               → {type:"tx"|"block"|"price", payload}
GET  /api/tx/:txid           → Tx
GET  /api/block/:height      → Block
```

Then your hook becomes ~30 lines of `fetch` + `WebSocket` wiring. See
`src/data/xmrirish-feed.ts` for the reference implementation.

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

## Visual system (v6.0.2)

Styling splits into three layers, imported from `src/main.tsx` in this exact
order:

```tsx
import "./styles.css";           // base — the v5 terminal-dense identity, unchanged
import "./styles-ambient.css";   // L3 — ambient background
import "./styles-theme.css";     // L2 — chrome palette
import "./styles-legibility.css"; // L1 — legibility, unconditional
```

| Layer | File | Scope | Owns |
|---|---|---|---|
| L1 | `styles-legibility.css` | Unconditional, never theme-scoped | The fluid type scale (`--fs-hero` … `--fs-label`), global readability primitives (`text-wrap`, measure guards, tabular numerals), the app's first `:focus-visible` ring, and two structural bugfixes (`.art-canvas` sizing, topbar overflow). |
| L2 | `styles-theme.css` | Scoped to `:root[data-theme="indigo"]` (plus a classic-identity `:root` block) | The chrome palette — everything that changes a *colour* when the Design panel's Theme knob is toggled. |
| L3 | `styles-ambient.css` | Always on, intensity-scaled | The aurora/dust/grain background field. Geometry and timing are unconditional; every colour routes through an `--amb-*` token that L2 re-binds per theme. |

**Import order is load-bearing.** L1 loads *last* specifically so that no
palette rule in L2 can ever override a readability rule in L1 — a theme
switch can recolour type, but it can never again shrink it below the legible
floor.

**Governing palette rule: Monero orange means crypto data, never decoration.**
`--tk-accent` stays bound to orange in *both* themes — it's read by 32 CSS
rules and 235 TSX inline styles, and those sites are overwhelmingly data
(prices, hashrate, block heights, tx counts, `.acc`, `.mblock` numerals).
Rebinding `--tk-accent` itself would recolour every one of them. Chrome reads
`--ui-accent` / `--ui-accent-text` / `--ui-primary` instead, which L2 binds to
`--tk-accent` (identity) under classic and to Indigofera Nocturne under
indigo. That indirection is the whole trick: ~15 chrome rules change per
theme, and the 235 data call sites need zero edits — which is exactly why
adding a theme toggle didn't require touching every `var(--tk-accent)` site
in the codebase.

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
- **Partial reversal, v6.0.2**: a minimal two-knob **Design panel** (Theme:
  indigo/classic · Ambient: calm/busy/chaotic) now ships in the app itself,
  reachable from a `⌘ DESIGN` control in the topbar — this is user-facing,
  not a design-time tool. The full tweaks system (Accent/Type/Glow/Density)
  is still deliberately **not** in this repo; that remains a design-time
  concern and still lives in the design hub. Don't conflate the two: the
  in-app panel is two knobs, not the whole tweaks surface.

---

## Roadmap

- Port the remaining `legacy/*.jsx` to TS (run `npm run port`)
- Add Onion mirror config
- Add edge worker example for live monerod data (Cloudflare Workers)
- Optional: i18n via `react-i18next`
