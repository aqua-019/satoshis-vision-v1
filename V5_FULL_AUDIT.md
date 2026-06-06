# V5 FULL AUDIT — current `index.html` vs the skeleton you started with

> **Read this if:** you started the v5 migration from the `repo/` skeleton and
> discovered it's missing a lot. It is. This document is a **deep, surface-by-
> surface, component-by-component diff** between the **shipped 0.1 build**
> (`design-reference/index.html` + `five01/`, finalized in the last edit) and the
> **portable skeleton** (`repo/`). For every gap: *what exists now*, *what the
> skeleton has*, and *how to add it*.

## Why the gap exists

The `repo/` skeleton was scaffolded from an **earlier, thinner pre-release** of
the design — back when the plan was "5 mempool views + 6 protocol sims + a few
stub pages." The build then grew substantially: a 4-tab Education hub, a 10-tab
Monero surface, a full Markets surface with candlesticks, a Network surface with
an animated geo-map, a shared mempool search/track layer, 14 protocol sims, and
more. **The skeleton never caught up.** `five01/` is the ground truth; `repo/`
is a starting shell that is behind it.

This audit treats `design-reference/five01/` as authoritative. Every file
referenced here is included in this bundle.

---

## 0 · The single source of truth: what `index.html` actually loads

The shipped `index.html` mounts these script modules **in order** (all under
`five01/`). This is the literal, complete manifest of the app:

```
lib/tweaks-panel.jsx          design-time tweaks (NOT shipped to prod)
src/shared.jsx                ★ data hook + 20 shared atoms + chrome + background
src/mempool/tx-detail.jsx     full TX + full Block detail panels
src/mempool/mempool-shared.jsx search + tracking router (all mempool views)
src/app01/tilt-card.jsx       mouse-reactive panel wrapper (Markets/Network)
src/mempool/{reactor,classic,bridge,sediment,constellation,terminal}.jsx   ← 6 views
src/protocols/sim-fx.jsx      ★ FX ENGINE (SvgDefs/ParticleStream/Volumetric3D/GlowOrb/useFrame/useMouseParallax)
src/protocols/{decoy-selection,dandelion,view-tags,ringct,stealth,fcmp}.jsx ← 6 primitives
src/protocols/metaphors.jsx   ← 8 metaphor sims (Hearth…Balance)
src/app01/router.jsx          useHashRoute + NavTopApp + AppShell + PageHeader
src/app01/pages.jsx           Home·Mempool·Education·Simulate·Dashboard·Node·Design·404
src/app01/markets.jsx         Markets surface (candles + multiline + ranges)
src/app01/network.jsx         Network surface (geo-map + 9 telemetry panels)
src/app01/monero-pages.jsx    10-tab Monero surface (overrides the stub MoneroPage)
src/app01/education-hub.jsx   4-tab Education hub (overrides the flat EducationPage)
src/app01/education-journey.jsx   10-chapter BTC→XMR narrative
src/app01/education-timeline.jsx  48-event privacy-evolution timeline
src/app01/education-quotes.jsx    Satoshi quote archive (7 categories)
src/app01/bottom-line.jsx     Monero "Bottom line" + "2027+ Outlook" tabs
src/app01/main.jsx            ROUTE_TABLE + App01 root + tweaks wiring
```

> Note the **override pattern**: `pages.jsx` defines thin `MoneroPage` /
> `EducationPage`, then `monero-pages.jsx` and `education-hub.jsx` load *after*
> and replace them on `window`. When porting to React modules, collapse each
> override into the single real component — don't replicate the load-order hack.

---

## 1 · Surface inventory — current vs skeleton

| Surface | Shipped build (`five01`) | Skeleton (`repo`) | Status |
|---|---|---|---|
| **Shell/chrome** | NavTop (8 links + live ticker), NetRail (4 live blocks), Footer (telemetry), ArtBackground (canvas ParticleField), Crumbs, PanelFrame, ProtoArtboard | NavTop, NetRail, Footer, ArtBackground, primitives | ◑ present but verify parity |
| **Home** | hero + live price card + 14-block ribbon + 7-surface grid | HomePage stub | ◑ thinner |
| **Mempool** | **6 views** + floating view dropdown + **search/track layer** + TX/Block detail | 5 view stubs, no search, no detail | ● major gap |
| **Markets** | candlesticks + multiline + range selector + exchange tables | **absent** | ● missing surface |
| **Network** | animated **geo-map** + 9 telemetry panels (difficulty, fullness, mempool-over-time, fee hist, pool HHI, version/fork-readiness, peers, Tor/I2P) | folded into a `DashboardPage` stub | ● missing surface |
| **Monero** | **10 tabs** incl. **Future**, Bottom line, 2027+ Outlook | 1-page stub (3 pillars + 7-row timeline) | ● major gap |
| **Education** | **4-tab hub**: Journey (10 ch) · Timeline (48 ev) · Quotes · Simulators | flat page | ● major gap |
| **Simulate** | **14 sims** + ViewTabs switcher, URL `?p=` | 6 sim stubs | ● major gap |
| **Run a node** | copy-to-clipboard cmds, docker + Tor/I2P paths, sanity check | NodePage stub | ◑ thinner |
| **Design** | iframe to `design-hub.html` + standalone link | — | ○ optional/internal |
| **404** | themed NotFound | NotFoundPage | ◑ ok |

● = major gap · ◑ = present but behind · ○ = optional

---

## 2 · Routing — the authoritative table (and a live bug to fix)

Shipped routing is **hash-based** (`src/app01/router.jsx` `useHashRoute`,
`src/app01/main.jsx` `ROUTE_TABLE`). The real route keys are:

```
""(home) · mempool · markets · network · monero · education · simulate · node · design
```

The skeleton's `repo/src/App.tsx` instead ships `/dashboard` and **no**
`/markets` or `/network`. Use `UPDATED-additions/to-add/src/App.tsx` (already
corrected).

> **Bug found during audit (carry the fix into v5):** the Home "7 surfaces" grid
> in `pages.jsx` still links a `dashboard` card to `/dashboard`, but
> `ROUTE_TABLE` has no `dashboard` key — so it falls through to 404.
> `DashboardPage` is still *defined* in `pages.jsx` but is **unrouted/retired**;
> its content was split into **Markets** + **Network**. When you port Home, point
> that card at `/network` (or split into two cards) and delete `DashboardPage`.

Mempool and Simulate carry **query params** for deep-linking: `/mempool?v=<id>`
and `/simulate?p=<id>`. Monero and Education use **in-page tab state** (not the
URL in the current build) — recommend promoting these to `/monero/:tab` and
`/education/:tab` in v5 so tabs deep-link (the corrected `App.tsx` adds
`/monero/:tab`).

---

## 3 · Shell & chrome (`src/shared.jsx`, `src/app01/router.jsx`)

The skeleton has equivalents, but verify these specifics — they're easy to lose:

- **NavTop**: 8 links (Home·Mempool·Markets·Network·Monero·Education·Simulate·Run
  a node) + a live ticker strip (XMR/BTC price + 24h Δ, `LIVE`/`SIM` pill from
  `data.source`) + a `⌘ DESIGN` link. Brand shows `v5.0 · 0.1`.
- **NetRail** (left): four live blocks — *Network*, *Local node*, *Peers·12*,
  *Market·CG* with a price Sparkline + a source/timestamp footer. Many pages hide
  it (`hideRail`).
- **Footer**: single telemetry strip — NETWORK NOMINAL · HEIGHT · HASH · PEERS ·
  MEMPOOL · RING 16 · FORK v16·FCMP++ Q3 · UTC clock.
- **ArtBackground / ParticleField**: a **Canvas 2D** animated backdrop — 60
  drifting stars + 4 upward "tx" streams, density driven by `intensity`
  (`calm|busy|chaotic`). Reduced from earlier 120+8 to avoid glow halo stacking.
  Wrapped in a `ResizeObserver` that defers via `requestAnimationFrame` (kills
  the "ResizeObserver loop" warning). **Keep the rAF guard when porting.**
- **PanelFrame**: the workhorse panel with corner ticks + header/right-slot +
  optional scroll. **Used everywhere** — port it precisely.
- **ProtoArtboard / ProtoHeader / ProtoStep**: the chrome every protocol sim
  renders inside (stage + side panel + badges). `title` accepts an **HTML
  string** via `dangerouslySetInnerHTML` — widen the TS prop accordingly.

---

## 4 · Mempool — the biggest single gap

**Shipped:** 6 full views, a floating top-right **view dropdown**, a **shared
search/track layer**, and full TX/Block detail panels.

- **6 views** (`src/mempool/`), default is **Classic** (★), not Reactor:
  1. **classic.jsx** — "cleaner/sleeker v4-style polish" (the default)
  2. **reactor.jsx** — "v4 parity · search + track + 10-conf ribbon"
  3. **bridge.jsx** — 12-pane operations/mission-control
  4. **sediment.jsx** — vertical core-sample tube
  5. **constellation.jsx** — rotating network sphere + latency radar + geo bars +
     version donut + prop-log (see its `Con*` sub-components)
  6. **terminal.jsx** — CLI-first monerod tail
- **Search/track layer** (`src/mempool/mempool-shared.jsx`): `useMempoolTracking`,
  `<MempoolSearchBar>` (regex-routes a 64-hex txid vs an integer height), and
  `<TrackingDetail>` which swaps the view for a detail panel. **Every** mempool
  view wires this in. The skeleton has none of it.
- **Detail panels** (`src/mempool/tx-detail.jsx`): `FullTxDetail` (ring members,
  inputs/outputs, key images, JSON toggle, privacy badges) and `FullBlockDetail`
  (re-resolves live so confirmations tick up). Plus `txSynthFromId` /
  `blockSynth` deterministic synthesizers.

**Skeleton:** 5 placeholder stubs, no `classic`, no search, no detail.

**How to add:**
1. Copy `UPDATED-additions/legacy-dropin/mempool/{classic,tx-detail,mempool-shared}.jsx`
   into `repo/legacy/mempool/`; the other 5 views are already in `repo/legacy/`.
2. `cd repo && npm run port` → emits `repo/src/mempool/*.tsx`.
3. Replace `repo/src/views/index.tsx` with
   `UPDATED-additions/to-add/src/views/index.tsx` (lists all 6 + `TX_DETAIL`).
4. Port the **floating view dropdown** + the `?v=` deep-link from
   `MempoolPage` in `app01-source/pages.jsx`.
5. Wire `useMempoolTracking`/`MempoolSearchBar`/`TrackingDetail` so search swaps
   in the detail panel from any view.
   Targets: `screenshots/03/04/05/06-mempool-*.png`.

---

## 5 · Markets — an entire surface the skeleton lacks (`src/app01/markets.jsx`)

**Shipped:** `MarketsPage` with:
- `CandleChart` — OHLC candlesticks synthesized by `genCandles(days, start, vol)`.
- `MultiLine` — multi-series overlay (e.g. XMR vs BTC) with right-edge labels.
- **Range selector** — `7D / 30D / 90D / 1Y` (`RANGE_DAYS`).
- Exchange/volume tables incl. delisted venues (LocalMonero RIP, Bisq, instant-swap).

**Skeleton:** nothing.

**How to add:** port `app01-source/markets.jsx` → `repo/src/pages/MarketsPage.tsx`
(a typed shell is provided at `to-add/src/pages/MarketsPage.tsx` — replace its
body). Uses `tilt-card.jsx` (copy that too). Target `screenshots/07-markets.png`.

---

## 6 · Network — animated geo-map + 9 telemetry panels (`src/app01/network.jsx`)

**Shipped:** `NetworkPage` — the densest data surface, none of which is in the
skeleton:
- **GeoMap** — SVG world silhouette (`WORLD_DOTS`), 11 geo buckets (`PEER_GEO`),
  **animated propagation arcs** (`animateMotion` packets fanning from DE/US/JP
  hubs), pulsing peer rings.
- **DifficultyCurve**, **BlockFullness** (last 60 blocks, amber→green),
  **MempoolSizeOverTime** (96 ticks), **fee histogram** (`MiniBar`).
- **Pool distribution** with a live **HHI** concentration index.
- **monerod version distribution** with **fork-readiness %** vs the 85% target
  (`NODE_VERSIONS`).
- **Peer list** (latency-colored), **Tor/I2P share** bars (38% privacy-routed),
  **recent blocks** table.

**Skeleton:** a `DashboardPage` stub with a few KPIs.

**How to add:** port `app01-source/network.jsx` → `repo/src/pages/NetworkPage.tsx`
(typed shell at `to-add/src/pages/NetworkPage.tsx`). The geo-map's `animateMotion`
arcs are pure SVG SMIL — they survive the TSX port unchanged; just keep the
`<g>`/`<animateMotion>` structure. Target `screenshots/08-network.png`.

---

## 7 · Monero — 10 tabs, incl. the **Future** tab (`src/app01/monero-pages.jsx` + `bottom-line.jsx`)

**Shipped:** `/monero` is a **10-tab sub-app** (`MONERO_TABS`):

```
overview · origin · tech · legality · markets · comparison · attacks · FUTURE · bottomline · outlook(2027+)
```

- **Future** → `MoneroFuture()` (monero-pages.jsx ~line 862; switch `case "future"`).
- **Tech** embeds a hand-built `EmissionCurve` SVG (100-yr supply vs emission).
- **Legality** → a 20-jurisdiction × 5-activity expandable matrix (`LEGALITY_MATRIX`).
- **Origin** → CryptoNote→Bytecoin→Monero lineage, the 7 pseudonymous founders,
  CCS funding table, culture essay.
- **Bottom line** / **2027+ Outlook** → `MoneroBottomLine` / `MoneroOutlook` from
  `bottom-line.jsx` (BTC↔XMR divergence table, failed-tracing evidence cards,
  delisting paradox, and the forward roadmap: FCMP++ mainnet, Seraphis & Jamtis,
  EU AMLR enforcement, next BTC halving).

**Skeleton:** `repo/src/pages/MoneroPage.tsx` is **one page** — 3 pillars + a
7-row timeline + a CTA. No tabs, no Future, no outlook.

**How to add:** port `app01-source/monero-pages.jsx` + `bottom-line.jsx` →
`repo/src/pages/MoneroPage.tsx` (+ a `_monero/` folder for the tab bodies). Drive
the active tab from `/monero/:tab` (the corrected `App.tsx` adds that route).
Target `screenshots/09-monero.png`. (Full detail in `UPDATED-additions/MISSING_IN_V5.md` §1.)

---

## 8 · Education — 4-tab hub, not a flat page (`src/app01/education-*.jsx`)

**Shipped:** `education-hub.jsx` overrides the flat page with **4 tabs** (`EDU_TABS`):
- **Journey** (`education-journey.jsx`) — a **10-chapter** BTC→XMR narrative
  (genesis → Satoshi's privacy problem → Bitcoin upgrades → Monero → tech →
  comparison → controversy → Wagyu → self-custody → the choice), with a 64px hero.
- **Timeline** (`education-timeline.jsx`) — a **48-event** privacy-evolution
  timeline with category filters (`EduTimeline`, `TlNode`, `TL_ERAS`).
- **Quotes** (`education-quotes.jsx`) — a **Satoshi quote archive** across 7
  categories (privacy/philosophy/technical/economics/security/farewell), with
  "key" highlights.
- **Simulators** — the 14 protocol sims as cards, grouped by 5 disciplines.

The flat `EducationPage` in `pages.jsx` (still used as the Simulators tab body)
also has a **"Coming next" panel** listing 8 unbuilt metaphor ideas (atomic
swaps, view/spend key, sub-addresses, Tor+I2P, piconero, CLSAG, key images,
Bulletproofs+).

**Skeleton:** a single flat education page.

**How to add:** port `education-hub.jsx` (the tab shell + `EduChapter` /
`EduMilestone` atoms) and the three content modules. Promote to `/education/:tab`.

---

## 9 · Simulate — 14 sims, not 6 (`src/app01/pages.jsx` + protocols)

**Shipped:** `SimulatePage` renders any of **14** sims full-bleed with a
`ViewTabs` switcher and `?p=` deep-link. The 14 (grouped, per `PROTOCOLS`):
- **Privacy primitive (6):** decoy · dandelion · viewtags · ringct · stealth · fcmp
- **Economics (3):** hearth · silo · auction
- **Consensus (3):** metronome · thermostat · skyline
- **Adversarial (1):** bloodhound
- **Cryptography (1):** balance

The 8 non-primitives all live in `metaphors.jsx` and **all depend on
`sim-fx.jsx`** (`ParticleStream`, `GlowOrb`, `Volumetric3D`, `useFrame`; plus
`useTick` from `shared.jsx`). FCMP++ (`fcmp.jsx`) animates a
16-flame→150M-starling murmuration on a 12s cycle + a fractal `CurveTree`.

**Skeleton:** 6 primitive stubs, no metaphors, **no `sim-fx`**.

**How to add (order matters):**
1. Copy `legacy-dropin/protocols/sim-fx.jsx` → `repo/legacy/protocols/`,
   `npm run port` **first** (everything depends on it).
2. Copy `legacy-dropin/protocols/metaphors.jsx` → port.
3. Use the corrected `to-add/src/views/index.tsx`
   (`PROTOCOL_PRIMITIVES` 6 + `PROTOCOL_METAPHORS` 8 + combined `PROTOCOL_VIEWS`).
4. Keep rAF/`useTick` loops alive; honor `prefers-reduced-motion`; size
   particle parents explicitly (artboards are fixed-size).
   Target `screenshots/10-simulate-protocols.png`. (Detail: `MISSING_IN_V5.md` §4.)

---

## 10 · Run a node + Design + 404

- **Run a node** (`pages.jsx` `NodePage`): copy-to-clipboard command rows
  (`Cmd`), a **docker quick path** (3 commands), a **Tor/I2P privacy path**
  (3 `ProtoStep`s), 3 platform cards, and a post-sync `curl get_info` sanity
  check that echoes the live height. Skeleton's NodePage is thinner — port the
  copy interactions.
- **Design** (`pages.jsx` `DesignPage`): an **iframe** to `design-hub.html` +
  an "open standalone" link. Internal review surface — optional for prod; if you
  drop it, also remove the `⌘ DESIGN` nav link.
- **404** (`NotFoundPage`): themed, present in both. Fine.

---

## 11 · Data layer — real seed shape (`src/shared.jsx` `useMoneroLive`)

The shipped hook seeds **deterministic, realistic** values, then live-updates
price via CoinGecko and simulates mempool/blocks. When you wire the real feed
(`to-add/src/data/xmrirish-feed.ts`), match these field shapes/ranges so the UI
never looks wrong before live data lands:

- height `3,676,070` · hashrate `6.45 GH/s` · difficulty `7.738e11` ·
  blockTarget `120` · hardfork `v16 (CLSAG + Bulletproofs+)` · ring `16`.
- price `$394.53` · change24h `+4.11%` · btc `$78,368` · btcRatio `0.005034`.
- 7 pools (`POOLS`, incl. P2Pool decentralized/recommended, Solo 44.6%), 12
  peers (`PEERS`, DE/US/FR/NL/CA…), `hashSeries`/`priceSeries` 168-pt,
  `feeHist` 32-bucket gaussian.
- `source`: `simulated` → `coingecko` when price returns; `live` flips true.

The skeleton's `simulated.ts` is close but verify the field set matches
`types.ts` exactly (the registry/views assume every field above exists).

> **Privacy note:** the *current build* calls CoinGecko **directly from the
> browser**. That's fine for a design preview but **violates the Tor/no-beacon
> rule for production** — in v5, route it through v4's `/api/coingecko` proxy
> (already handled in `xmrirish-feed.ts`). See `../DATA_LAYER.md`.

---

## 12 · What's provided in this bundle to close the gaps

| Need | Provided |
|---|---|
| Missing mempool source | `UPDATED-additions/legacy-dropin/mempool/{classic,tx-detail,mempool-shared}.jsx` |
| Missing sim engine + metaphors | `UPDATED-additions/legacy-dropin/protocols/{sim-fx,metaphors}.jsx` |
| Entire content layer (Monero 10-tab, Education hub, Markets, Network, Node, Home) | `UPDATED-additions/app01-source/*.jsx` |
| Corrected routing | `UPDATED-additions/to-add/src/App.tsx` |
| New Markets/Network pages | `UPDATED-additions/to-add/src/pages/{Markets,Network}Page.tsx` |
| Corrected view registry (6 + 14) | `UPDATED-additions/to-add/src/views/index.tsx` |
| Live data hook | `UPDATED-additions/to-add/src/data/xmrirish-feed.ts` |
| Visual targets | `screenshots/01–11` |
| Runnable ground truth | `design-reference/index.html` (+ `five01/`) |

---

## 13 · Recommended port order (full parity)

1. **Chrome parity** — NavTop/NetRail/Footer/ArtBackground/PanelFrame/ProtoArtboard;
   confirm against Home + Network screenshots.
2. **Data** — drop in `xmrirish-feed.ts`; confirm LIVE badge.
3. **Routing** — replace `App.tsx`; delete `DashboardPage`; fix the Home
   `/dashboard` link → `/network`.
4. **Mempool** — copy 3 JSX, port, new registry, dropdown + search/track + detail.
5. **Simulate** — `sim-fx` first, then `metaphors`; verify animations.
6. **Markets** + **Network** — port both surfaces (tilt-card first).
7. **Monero 10-tab** — incl. **Future** + 2027+ Outlook; `/monero/:tab`.
8. **Education 4-tab hub** — Journey/Timeline/Quotes/Simulators; `/education/:tab`.
9. **Run a node** — copy interactions + Tor/I2P path.
10. Privacy/CSP pass (`../INTEGRATION_BRIEF.md` §7), proxy CoinGecko, ship.

When anything is ambiguous, open `design-reference/index.html`, navigate to the
surface, and read the matching `five01/src/...jsx`. That is the final word.

---

## 14 · Completeness verification (this audit ↔ the live build)

This audit was machine-checked against the live `index.html`, not eyeballed.

- **`index.html` loads exactly 30 modules.** All 30 are documented above and in
  `UPDATED-additions/SUPPLEMENTARY_DETAIL.md`. The 30:
  `lib/tweaks-panel` · `shared` · `mempool/{tx-detail, mempool-shared, reactor,
  classic, bridge, sediment, constellation, terminal}` · `app01/tilt-card` ·
  `protocols/{sim-fx, decoy-selection, dandelion, view-tags, ringct, stealth,
  fcmp, metaphors}` · `app01/{router, pages, markets, network, monero-pages,
  education-hub, education-journey, education-timeline, education-quotes,
  bottom-line, main}`.
- **Every `window`-exported component is accounted for** — all 6 mempool
  `*View`s, the 14 protocol `*View`s, the 4 Education tabs + atoms, the 10 Monero
  tabs (+ `MoneroBottomLine`/`MoneroOutlook`), Markets/Network pages, the full
  `shared.jsx` chrome/atoms, the `tx-detail` + `mempool-shared` layer, and the
  `sim-fx` FX toolkit.
- **Two files in `five01/src` are NOT loaded by `index.html`** (so they're out of
  scope for the port, kept in `full-source/` only for completeness):
  - `app01/markets-network.jsx` — a **superseded** earlier combined Markets+
    Network module. The live build loads `markets.jsx` + `network.jsx` instead.
  - `app.jsx` — the **design-canvas** entry used by `design-hub.html`, not by the
    main app.
- **`sim-fx.jsx` exact exports:** `SvgDefs`, `ParticleStream`, `Volumetric3D`,
  `GlowOrb`, `useFrame`, `useMouseParallax`, `Spotlight`. (`useTick` is in
  `shared.jsx`, not sim-fx.)

If a future edit adds a module to `index.html`, re-run the same check: diff the
`<script src>` list against the per-surface coverage here.
