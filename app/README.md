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

Styling splits into three layers — L1/L2/L3 below are this doc's own
numbering for the three files, not the CSS `@layer` names further down —
imported from `src/main.tsx` in this order (the order itself is no longer
what enforces precedence; see "Layer order is load-bearing" below):

```tsx
import "./styles.css";           // base — the v5 terminal-dense identity, unchanged
import "./styles-ambient.css";   // L3 — ambient background
import "./styles-theme.css";     // L2 — chrome palette
import "./styles-legibility.css"; // L1 — legibility, unconditional
```

| Layer | File | Scope | Owns |
|---|---|---|---|
| L1 | `styles-legibility.css` | Unconditional, never theme-scoped | The fluid type scale (`--fs-hero` … `--fs-label`), global readability primitives (`text-wrap`, measure guards, tabular numerals), the app's first `:focus-visible` ring, and two structural bugfixes (`.art-canvas` sizing, topbar overflow). |
| L2 | `styles-theme.css` | Contributes to *two* layers: colour-role rebindings to `theme`, ~49 chrome-override rules to `components` (`theme` is declared before `components` in the order statement, so an override left in `theme` would silently lose to `styles.css`'s base rules regardless of specificity — nothing errors when this happens, which is exactly how it regressed once during the v6.1.2 retrofit). Scoped explicitly per theme — `:root[data-theme="classic"]` / `="phosphor"` / `="indigo"` — plus `:root:not([data-theme])` for the JS-off case where the pre-paint stamp never runs | The chrome palette — everything that changes a *colour* when the Design panel's Theme knob (now three-way: Classic · Phosphor · Indigo) is toggled. |
| L3 | `styles-ambient.css` | Always on, intensity-scaled | The aurora/dust/grain background field. Geometry and timing are unconditional; every colour routes through an `--amb-*` token that L2 re-binds per theme. |

### Device tiering (v6.0.8)

A fourth axis sits under the three style layers: `design/deviceTier.ts` resolves
`high | mid | low` once per page load and stamps it on `documentElement` as
`data-tier` (pre-paint, from `index.html`'s inline script, then re-stamped by
`VisualProvider`).

| Tier | Plates | Orbs | Dust | Sweep | Ribbon | ParticleField canvas |
|---|---:|---:|:-:|:-:|:-:|---|
| high | 8 | 10 / 30 / 60 per Ambient | 2 | yes | yes | 120·density stars |
| mid | 4 | ≤10 | 1 | no | no | 30 stars |
| low | 2, unanimated | 0 | 0 | no | no | not mounted |

Derived from `hardwareConcurrency`, `deviceMemory`, viewport area and
coarse-pointer; `prefers-reduced-motion` and `saveData` force `low`. Append
`?tier=high|mid|low` to override (this is how `verify-perf.mjs` asserts each
tier, and an escape hatch for hardware the heuristic misreads).

**`tier` is not a third Design-panel knob.** It rides on `VisualState`
read-only, is never persisted, and has no radio group — the two-knob decision
in `design/VisualContext.tsx` stands. Excluded layers are *not rendered*, never
`display: none`: a hidden element still allocates its compositor layer, which
is the entire cost being removed.

Everything animated is also gated on visibility (`design/usePageActive.ts`) and,
for canvases, on intersection. React-rendered motion shares one rAF via
`design/useAnimationClock.ts` — prefer its `useAnimationSeconds` over the frame
counter, since a frame counter changes meaning per tier and seconds don't.

See `PERF-BASELINE.md` for measured before/after.

**Layer order is load-bearing — v6.1.2 moved this off the import list above.**
`styles.css:1` declares `@layer reset, base, theme, components, utilities;`
exactly once, and every rule in all four stylesheets lives inside one of
those five layers (`@font-face`, `@keyframes` and `@property` sit outside
all of them — they take no part in cascade layering, so wrapping them would
just make the registration invisible to the layering machinery). `utilities`
— L1's layer — is declared last, so no palette rule in `theme` or
`components` can ever override a readability rule in L1, exactly as before;
the guarantee just no longer depends on `main.tsx`'s import order, which is
now documentation rather than the mechanism. A theme switch can recolour
type, but it can never again shrink it below the legible floor.

**Governing palette rule: Monero orange means crypto data, never decoration.**
`--tk-accent` stays bound to orange data in all three themes — it's read by
32 CSS rules and 235 TSX inline styles, and those sites are overwhelmingly
data (prices, hashrate, block heights, tx counts, `.acc`, `.mblock`
numerals). Chrome reads `--ui-accent` / `--ui-accent-text` / `--ui-primary`
instead.

v6.1.2 moved the implementation behind role tokens without changing the
rule. `styles.css` registers 18 colour roles with `@property`
(`syntax:'<color>'`, so a theme value that fails to parse as a colour
computes to guaranteed-invalid and falls back to the registered
`initial-value` instead of silently becoming some other type) and declares
the three aliases once, unscoped, in `@layer base`: `--tk-accent:
var(--accent-data)`, `--ui-accent: var(--accent-structural)`, `--ui-primary:
var(--accent-structural)`. No theme block touches an alias — only
`styles-theme.css` rebinds `--accent-data` / `--accent-structural` per
theme, and because `var()` resolves against the cascade at use time, the
aliases pick up whichever theme is active with zero per-theme
redeclaration. That indirection is still the whole trick: ~49 chrome rules
change across three themes, and the 235 data call sites need zero edits —
which is exactly why phosphor, the third theme, cost about thirty lines
instead of an afternoon of `!important` archaeology.

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
  classic/phosphor/indigo, classic default · Ambient: calm/busy/chaotic) now
  ships in the app itself, reachable from a `⌘ DESIGN` control in the topbar
  — this is user-facing, not a design-time tool. v6.1.2 added phosphor as a
  third Theme option and flipped the default from indigo to classic; it also
  mounted the same Theme control (`design/ThemeToggle.tsx`) directly on Main
  Home, beside the hero CTAs, as a first-class control rather than a
  topbar-only footnote — both toggles render from one definition so they
  can't drift out of sync. The full tweaks system (Accent/Type/Glow/Density)
  is still deliberately **not** in this repo; that remains a design-time
  concern and still lives in the design hub. Don't conflate the two: the
  in-app panel is two knobs, not the whole tweaks surface.

---

## Roadmap

- Port the remaining `legacy/*.jsx` to TS (run `npm run port`)
- Add Onion mirror config
- Add edge worker example for live monerod data (Cloudflare Workers)
- Optional: i18n via `react-i18next`
