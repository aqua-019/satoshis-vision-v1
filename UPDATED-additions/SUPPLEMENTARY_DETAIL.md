# SUPPLEMENTARY DETAIL — the depth inside every surface

> **Framing:** my first handoff under-specified the build. This document is the
> correction — an **expansive, component-by-component** breakdown of what's
> actually inside each surface of the shipped `index.html`, so nothing gets lost
> in the v5 port. Every file named here is collected, complete, in
> **`full-source/`** (a 1:1 copy of the shipped `five01/`, organized by surface).
>
> Use this with `../V5_FULL_AUDIT.md` (the gap analysis) and `MISSING_IN_V5.md`
> (the repo-skeleton diff). This file answers: *for each surface, exactly what
> components exist, what they animate, and what data they read.*

`full-source/` layout (everything loads in this order — see `src/` ):
```
full-source/
├── styles.css                      all design tokens + component CSS
├── lib/{tweaks-panel,design-canvas}.jsx
└── src/
    ├── shared.jsx                  data hook + 20 atoms + chrome + ParticleField
    ├── mempool/   reactor classic bridge sediment constellation terminal
    │               tx-detail mempool-shared
    ├── protocols/ sim-fx decoy-selection dandelion view-tags ringct stealth
    │               fcmp metaphors
    └── app01/     router pages main · markets network tilt-card
                    monero-pages bottom-line
                    education-hub education-journey education-timeline education-quotes
                    (markets-network.jsx is also present but SUPERSEDED — NOT loaded)
```

Legend: ▸ = sub-component · ⟳ = animated (rAF or `useTick`) · ◈ = reads `useMoneroLive()`.

---

## HOME — `src/app01/pages.jsx` → `HomePage`

A single scroll, `hideRail`, `bg:"busy"`. Four bands:

1. **Hero card** ◈ — kicker "a privacy network · since 2014"; 34px serif headline
   with orange + purple `<em>` accents ("hiding *somewhere* in *this cloud*");
   mono lede citing the 150,000,000+ anonymity set; two CTAs (Open mempool /
   Learn the protocols).
2. ▸ **Live ticker card** ◈ — `data.source` label + SYNCED pill; XMR/USD at 30px
   glow; 24h ▲/▼ colored; `Sparkline` of `priceSeries.slice(-90)`; a 3-up
   `Stat` row (block height, hashrate GH/s, mempool tx + bytes).
3. **Recent-blocks ribbon** ◈ — 14 `.mblock` tiles from `data.blocks` (height
   tail, tx count, KB + pool).
4. **Surface grid** — 7 cards (mempool, education, dashboard, monero, simulate,
   node, design) each color-keyed, navigating on click.

⚠ **Port fixes:** (a) the grid still says "7 surfaces" and links a **dashboard**
card to `/dashboard`, which no longer routes — repoint to `/network` (and/or add
a Markets card). (b) Copy mentions "5 visualisations" — it's now **6**. (c) the
hero lede lists the privacy primitives; keep in sync with the 6 in `PROTOCOLS`.

---

## MEMPOOL — `src/mempool/*` (6 views + shared search/detail)

The single richest area. `MempoolPage` (in `pages.jsx`) renders one view
full-bleed and floats a **top-right dropdown** (260px, `position:fixed; top:60`)
to switch among the 6; selection deep-links via `/mempool?v=<id>`; default is
**Classic ★**. Each view brings its **own** NavTop/NetRail/Footer/art-stage and
wires the shared search/track layer.

### Shared layer — `mempool-shared.jsx` + `tx-detail.jsx`
- ▸ `useMempoolTracking(data)` ◈ — holds `{tracking}`; `onSearch` routes a
  64-hex string → tx, an integer → block; re-resolves the tracked block each
  data tick so confirmations stay live.
- ▸ `MempoolSearchBar` — regex-validated input + SEARCH button (`compact` variant).
- ▸ `TrackingDetail` — swaps the view for `FullTxDetail` / `FullBlockDetail`.
- ▸ `txSynthFromId` / `blockSynth` — **deterministic** FNV-hash + LCG RNG
  synthesizers (idempotent: same id → same tx), so a searched txid always yields
  a stable, realistic tx. ⚠ keep deterministic when wiring real `/api/tx/:txid`.
- ▸ `FullTxDetail` ◈ — ring-member list (expandable input `openIn` state),
  inputs/outputs, key images, decoy age histogram, `PrivacyBadges`
  (CLSAG·BP+·View Tags·Stealth·Dandelion++), raw-JSON toggle, `DKV`/`Section` atoms.
- ▸ `FullBlockDetail` ◈ — block header, tx table (clickable → `onPickTx`),
  live confirmation count, JSON toggle.

### 1 · Classic — `classic.jsx` (default ★)
"Cleaner/sleeker v4-style polish." `classicLookupTx`, fee-bucket projection
blocks + recent-blocks rail, confirmation panel with **overdue logic**
(`CLASSIC_BLOCK_TARGET=120`). The familiar mempool.space mental model.

### 2 · Reactor — `reactor.jsx` (the deepest; "v4 parity")
A ~1100-line engine. Sub-components:
- ⟳◈ `ReactorCore({mempool})` — **canvas** orbital particle system; each tx
  orbits at a radius set by its fee **tier**; live rAF loop.
- ▸ fee-tier system — `REACTOR_TIERS` (PRIORITY/FAST/…/with colors+ETA),
  `reactorThresholds(mempool)` (percentile split), `reactorTierOf(tx,thr)`.
- ⟳◈ `ReactorBlockForge` — "next block" filling by tier bucket.
- ⟳◈ `ReactorHashScope` — hashrate oscilloscope from `hashSeries`.
- ⟳◈ `ReactorBlockPulse` — block countdown/overdue ring.
- ⟳◈ `ReactorTierRivers` — animated horizontal flow lanes per tier.
- ◈ `ReactorTxFeed` — live feed rows w/ tier dot + sparkbar (`onPickTx`).
- ▸ `BlockRibbon` ◈ — **2 queued + 10 past** blocks (1..10 conf), `BlockBox`
  status (queued/next/past/tracked), `TrackingStrip` overlay.
- ▸ `SearchBar` (+ `IS_TXID`/`IS_HEIGHT`), `CurrencyToggle` (**XMR / BTC /
  BTC-XMR**), `TxDetailPanel` + `ReactorConfirmationPanel` (overdue logic),
  `BlockDetailPanel`, `OverviewPanels` (shown when nothing is tracked), `BigKpi`/`Detail`.

### 3 · Ops Bridge — `bridge.jsx` (12-pane mission control)
- ⟳◈ `BrgRadar` — PPI sweep; peers as blips lit by the rotating arm (SVG, rAF).
- ⟳ `BrgGauge` / `BrgGaugeBank` — semicircular gauges w/ eased needles;
  decentralization = 1−HHI of pool shares.
- ⟳◈ `BrgFeeScope` — fee/byte oscilloscope w/ running scan dot.
- ⟳◈ `BrgBlockCadence` — 120s countdown ring + last-10 interval bars.
- ◈ `BrgPoolDist` — pool concentration bars + HHI.
- ⟳ `BrgAlertTape` — scrolling mission-control alert log (timestamped).
- ◈ `BrgTxConsole` — live tx feed tagged STEM/QUEUE/FLUFF/POOL (`onPickTx`).
- `BrgOverview` composes the 12 panes; `BrgCard` chrome.

### 4 · Sediment — `sediment.jsx` (vertical core-sample)
- ⟳◈ `SedColumn` — the core column: suspended txs → meniscus → settled strata,
  height by `perB`.
- ⟳◈ `SedGrainScatter` — fee/B vs weight scatter.
- ▸ `SedRingFan` — 16-member anonymity fan.
- ◈ `SedStrataLog` — confirmed blocks as a depth core.
- ◈ `SedFeeProfile` — fee depth-profile.
- ⟳◈ `SedClearance` — mempool-depth-over-time trace.
- ◈ `SedTxFeed` (`onPickTx`), `SedOverview`, `SedCard`.

### 5 · Constellation — `constellation.jsx` (network sphere)
- ⟳ `ConSphere` — rotating 3D propagation sphere (`useTick(50)`).
- ⟳ `ConStemTracker` — Dandelion stem hop tracker (10-hop path).
- ◈ `ConLatencyRadar` — peer-latency polar radar.
- ⟳ `ConPropLog` — live propagation log (STEM-FORWARD/FLUFF rows, 1.6s tick).
- ⟳ `ConGeoBars` — animated geographic distribution.
- ▸ `ConVersionDonut` — client-version donut (0.18.4.0 83.2% …).
- ◈ `ConBlockStream`, `ConOverview`, `ConCard`.

### 6 · Terminal — `terminal.jsx` (CLI-first)
- ⟳ `TermPalette` — **self-typing** command palette (typing→hold→clearing phases).
- ◈ `TermAsciiBlocks` — reactive ASCII block stream from `data.blocks`.
- ⟳ `TermLiveLog` — auto-tailing `monerod` log (1.1s tick, W/E/dand/p2p coloring).
- ⟳◈ `TermFeeHisto` — live ASCII fee histogram.
- ⟳ `TermGauge` — compact radial gauge. `scan` defaults **on** here.

> **Port plan for mempool:** copy `classic/tx-detail/mempool-shared` from
> `legacy-dropin/` into `repo/legacy/` (the other 4 are there), `npm run port`,
> then carry over the dropdown switcher + `?v=` + the shared search/track wiring.
> The canvas engines (`ReactorCore`, `BrgRadar`, particle layers) port as-is —
> keep their rAF loops and size their parents explicitly.

---

## MARKETS — `src/app01/markets.jsx` → `MarketsPage` ◈

- ▸ `genCandles(days,start,vol)` — OHLC candle synthesizer (mirror shape in
  `shared.jsx` when wiring real OHLC).
- ▸ `CandleChart` — SVG candlesticks (wicks + bodies, up/down colored).
- ▸ `MultiLine` — multi-series overlay (XMR vs BTC) w/ right-edge labels.
- ▸ **Range selector** — `7D / 30D / 90D / 1Y` (`RANGE_DAYS`), `range` state.
- Exchange/liquidity tables: instant-swap venues + volumes, incl. delisted
  (LocalMonero RIP 2024, Bisq P2P). Uses `tilt-card.jsx` mouse-reactive panels.

Target `screenshots/07-markets.png`. Typed shell:
`to-add/src/pages/MarketsPage.tsx` (replace body with this port).

---

## NETWORK — `src/app01/network.jsx` → `NetworkPage` ◈

Nine panels + an animated map (none in the skeleton):
- ⟳ `GeoMap` — SVG world silhouette (`WORLD_DOTS`), 11 geo buckets (`PEER_GEO`,
  incl. a Tor/I2P offshore anchor), **`animateMotion` propagation packets**
  fanning DE/US/JP→peers, pulsing peer rings (SMIL `<animate>`).
- KPI row (height/hashrate/difficulty/peers/mempool/fork).
- ◈ `DifficultyCurve` (168-pt drift), ◈ `BlockFullness` (last 60, amber→green),
  ◈ `MempoolSizeOverTime` (96 ticks), fee histogram (`MiniBar`).
- ◈ Pool distribution **+ HHI** ("moderately concentrated" threshold note).
- `NODE_VERSIONS` distribution **+ fork-readiness %** vs 85% target.
- Peer list (latency-colored), **Tor/I2P share** bars (clearnet 61.2 / Tor 28.6
  / I2P 9.4), recent-blocks table.

Target `screenshots/08-network.png`. Typed shell:
`to-add/src/pages/NetworkPage.tsx`. The SMIL arcs survive the TSX port unchanged.

---

## MONERO — `src/app01/monero-pages.jsx` + `bottom-line.jsx` (10 tabs) ◈

`MONERO_TABS`: overview · origin · tech · legality · markets · comparison ·
attacks · **future** · bottomline · outlook(2027+). Tab via `MoneroTabs`.
- `MoneroOverview` — 3 pillars + "where next" CTA.
- `MoneroOrigin` — CryptoNote→Bytecoin→Monero lineage; **7 pseudonymous
  founders**; CCS funding table (~25k XMR / ~150 proposals); culture essay;
  36-month shipping log.
- `MoneroTech` — 6 primitives ELI5 grid + **`EmissionCurve`** (100-yr SVG, supply
  linear vs emission log, "tail begins 2022" marker) + tail-emission math.
- `MoneroLegality` — **20-jurisdiction × 5-activity** expandable matrix
  (`LEGALITY_MATRIX`, `LegalityRow` legal/restricted/illegal/unclear chips) +
  delisting timeline.
- `MoneroMarketsThesis` — manifesto block + Jan-2026 ATH catalyst ($799.89).
- `MoneroComparison`, `MoneroAttacks` (IRS bounty / Chainalysis evidence).
- **`MoneroFuture`** ← the Future tab (monero-pages.jsx ~L862; `case "future"`).
- `MoneroBottomLine` / `MoneroOutlook` (from `bottom-line.jsx`): BTC↔XMR
  divergence table, failed-tracing evidence cards, delisting paradox, and the
  **2027+ roadmap** (`FUTURE[]`: EU AMLR enforcement, FCMP++ mainnet, next BTC
  halving, Seraphis & Jamtis).

Target `screenshots/09-monero.png`. Promote tabs to `/monero/:tab`
(corrected `to-add/src/App.tsx` adds the route). Detail: `MISSING_IN_V5.md` §1.

---

## EDUCATION — `src/app01/education-*.jsx` (4-tab hub) ◈

`education-hub.jsx` overrides the flat page; `EDU_TABS`: Journey · Timeline ·
Quotes · Simulators. Shared atoms `EduChapter` / `EduMilestone`.
- **Journey** (`education-journey.jsx`) — **10 chapters** BTC→XMR (genesis →
  Satoshi's privacy problem → Bitcoin upgrades → Monero → tech → comparison →
  controversy → Wagyu → self-custody → the choice); 64px hero `JrnHero`;
  `JrnStatGrid`, `JrnTechCard` atoms.
- **Timeline** (`education-timeline.jsx`) — `EduTimeline` over `TL_ERAS`, a
  **multi-era, ~48-event** privacy-evolution timeline; category filter
  (`filter` state), `TlNode` w/ `TL_CAT` colors.
- **Quotes** (`education-quotes.jsx`) — Satoshi archive, **7 categories**
  (`Q_CATS`: privacy/philosophy/technical/economics/security/farewell), `key`
  highlights, primary-source attributions.
- **Simulators** — the 14 sims as cards, grouped by 5 disciplines (the
  `EducationPage` body in `pages.jsx`, incl. the "Coming next" 8-idea panel).

Promote to `/education/:tab`.

---

## SIMULATE — `src/app01/pages.jsx` `SimulatePage` + `src/protocols/*` (14 sims) ◈

Full-bleed single sim + `ViewTabs` switcher + `/simulate?p=<id>`. All 14 use
`ProtoArtboard` chrome; the 8 metaphors + fcmp build on the **`sim-fx.jsx`**
engine (`SvgDefs`, `ParticleStream`, `Volumetric3D`, `GlowOrb`, `useFrame`,
`useMouseParallax`) plus `useTick` from `shared.jsx`.

**6 primitives** — each is a `*Stage` (the animation) + a `*View` (ProtoArtboard wrap):
- `decoy-selection.jsx` ⟳◈ — log-normal decoy sampling across the timeline
  (`DecoySelectionView`, ring/trueAge state).
- `dandelion.jsx` ⟳ — `DandelionStage` stem→fluff with 360° propagation rays.
- `view-tags.jsx` ⟳ — `ViewTagsView` 1-byte tag, 256× scan accel (left/right counters).
- `ringct.jsx` ⟳ — 5-station assembly line, walking "active station".
- `stealth.jsx` ⟳ — `ChamberPanel` (Alice/Bob two-key chambers), 8-phase cycle.
- `fcmp.jsx` ⟳◈ — `Murmuration` (16 flames→150M starlings, 12s cycle) +
  fractal `CurveTree` commitment tree.

**8 metaphors** (`metaphors.jsx`, all ⟳, each `*Stage`+`*View`):
Hearth (volumetric flame + embers, subsidy vs tail over 50y) · Metronome (2-min
swing) · Silo (BTC fixed cap vs XMR faucet, 400-frame loop) · Thermostat (two
needles) · Auction (80-seat bid paddles) ◈ · Skyline (pools as buildings + HHI)
◈ · Bloodhound (6-stage scent loss) · Balance (sealed envelope on a scale).

> **Port order:** `sim-fx.jsx` **first** (the metaphors depend on its
> `ParticleStream`/`GlowOrb`/`Volumetric3D`; `useTick` comes from `shared.jsx`),
> then `metaphors.jsx`, then register via
> `to-add/src/views/index.tsx`. Keep every `useTick`/rAF loop; honor
> `prefers-reduced-motion`. Detail: `MISSING_IN_V5.md` §4.

---

## RUN A NODE — `src/app01/pages.jsx` → `NodePage` ◈

- 4-up requirements `Stat` row (disk ~205GB / RAM / bandwidth / sync time).
- ▸ `Cmd` rows with **copy-to-clipboard** (`copied` state, 1.5s "✓ COPIED").
- **Docker quick path** — 3 commands (volume create, run pruned node on 18089,
  logs -f).
- **Tor/I2P privacy path** — 3 `ProtoStep`s (install tor+i2pd, edit
  monerod.conf, verify .onion).
- 3 platform cards (macOS GUI / Pi 5 headless / bare metal).
- Post-sync sanity check: `curl …/get_info | jq` echoing the live `data.height`.

Port the **copy interactions** and the two install paths — the skeleton's
NodePage is a thin stub.

---

## CROSS-CUTTING — don't lose these in the port

- **Chrome** (`shared.jsx`): NavTop (8 links + live ticker), NetRail (4 live
  blocks), Footer (telemetry strip), `PanelFrame` (corner ticks), `Crumbs`,
  `Stat`/`Pill`/`Sparkline`/`MiniBar`, `ProtoArtboard`/`ProtoHeader`/`ProtoStep`,
  and `ParticleField` (canvas backdrop w/ the **rAF ResizeObserver guard** that
  suppresses the "ResizeObserver loop" warning — keep it).
- **Data hook** (`shared.jsx` `useMoneroLive`): seeds the real shape (height
  3,676,070 · 6.45 GH/s · v16 · 7 pools · 12 peers · price $394.53), live-updates
  price from CoinGecko every 60s, simulates mempool every 2.2s and blocks every
  30s. ⚠ In prod, proxy CoinGecko via `/api/coingecko` (privacy). Wire-up:
  `to-add/src/data/xmrirish-feed.ts`.
- **`tilt-card.jsx`** — mouse-reactive 3D panels used by Markets + Network; port
  before those surfaces.
- **Superseded file:** `app01/markets-network.jsx` is an earlier combined
  Markets+Network module. The live `index.html` does **not** load it — it loads
  `markets.jsx` and `network.jsx` separately. Port from those two; ignore
  markets-network.jsx (kept in `full-source/` only for completeness).
- **Override pattern** — `monero-pages.jsx` and `education-hub.jsx` replace the
  thin `pages.jsx` versions at load. In React, collapse each into one component.

When anything is ambiguous, open `../design-reference/index.html`, navigate to
the surface, and read the matching file in `full-source/src/…`. That is the
final word.
