# MISSING IN V5 — what the `repo/` skeleton lacks, and the code to add it

> Read this first. It is the exact, file-by-file gap between the **runnable
> ground-truth design** (`design-reference/index.html` + `five01/`) and the
> **portable skeleton** (`repo/`). Everything called out here is already
> provided in this `UPDATED-additions/` folder — either as drop-in JSX source or
> as net-new TypeScript.

The skeleton boots and routes, but it is **deliberately behind** the design. It
stubs the heavy visualizations and ships an outdated route model. This document
closes that gap with zero guesswork.

---

## TL;DR — the five gaps

| # | Gap | Severity | Fix provided in |
|---|---|---|---|
| 1 | **Monero is a 10-tab sub-app**, skeleton has a 1-page stub (incl. the **Future** tab) | High | `app01-source/monero-pages.jsx`, `bottom-line.jsx` |
| 2 | **6 mempool views**, skeleton registers 5 (missing `classic`) + no tx-detail | High | `legacy-dropin/mempool/*`, `to-add/src/views/index.tsx` |
| 3 | **Markets + Network are separate surfaces**, skeleton has one wrong `/dashboard` | High | `to-add/src/App.tsx`, `to-add/src/pages/{Markets,Network}Page.tsx` |
| 4 | **14 protocol sims** (high-fidelity, animated), skeleton stubs 6 and omits the FX engine | High | `legacy-dropin/protocols/{sim-fx,metaphors}.jsx`, `to-add/src/views/index.tsx` |
| 5 | **No live data hook** — skeleton runs only the simulated feed | Medium | `to-add/src/data/xmrirish-feed.ts` |

---

## How this folder is organized

```
UPDATED-additions/
├── MISSING_IN_V5.md          ← you are here
│
├── legacy-dropin/            ← MISSING porting source. Copy into repo/legacy/, then `npm run port`.
│   ├── mempool/
│   │   ├── classic.jsx          (6th mempool view — skeleton omitted it)
│   │   ├── tx-detail.jsx        (full-fidelity TX/Block drilldown)
│   │   └── mempool-shared.jsx   (atoms every mempool view imports)
│   └── protocols/
│       ├── sim-fx.jsx           ★ FX ENGINE — ParticleStream/GlowOrb/Volumetric3D/useFrame. PORT FIRST.
│       └── metaphors.jsx        (the 8 metaphor visualizations)
│
├── app01-source/             ← the entire CONTENT layer the skeleton has no equivalent for.
│   ├── monero-pages.jsx         (10-tab Monero surface — incl. the Future tab)
│   ├── bottom-line.jsx          (Bottom-line + 2027+ Outlook tabs)
│   ├── markets.jsx · network.jsx · tilt-card.jsx
│   │     (markets-network.jsx is also present but SUPERSEDED — not loaded by index.html)
│   ├── education-hub.jsx · education-journey.jsx · education-timeline.jsx · education-quotes.jsx
│   ├── pages.jsx · router.jsx · main.jsx   (shell + hash routing + ROUTE_TABLE)
│   └── monero-pages.jsx …
│
└── to-add/                   ← NET-NEW TypeScript. Drop into repo/src/ (overwrite where noted).
    └── src/
        ├── App.tsx                       (REPLACES repo/src/App.tsx — fixes routes)
        ├── data/xmrirish-feed.ts         (NEW — the live data hook)
        ├── pages/MarketsPage.tsx         (NEW)
        ├── pages/NetworkPage.tsx         (NEW)
        └── views/index.tsx               (REPLACES repo/src/views/index.tsx — 6 mempool + 14 sims)
```

---

## 1 · Monero surface — the **Future** tab (and 9 others) are missing

**This is the gap you flagged.** In the shipped design, `/monero` is not a page —
it's a **10-tab sub-application** (`MONERO_TABS` in `app01-source/monero-pages.jsx`):

```
overview · origin · tech · legality · markets · comparison · attacks · FUTURE · bottomline · outlook(2027+)
```

- The **Future** tab renders `MoneroFuture()` —
  `app01-source/monero-pages.jsx`, function defined at ~line 862, wired in the
  switch at `case "future": content = <MoneroFuture />`.
- **Bottom line** and **2027+ Outlook** render `MoneroBottomLine` and
  `MoneroOutlook` from `app01-source/bottom-line.jsx` — the `MoneroOutlook`
  component is the forward-looking roadmap (FCMP++ mainnet, Seraphis & Jamtis,
  EU AMLR enforcement, the next Bitcoin halving).

**What the skeleton has instead:** `repo/src/pages/MoneroPage.tsx` is a single
page — 3 pillars + a 7-row timeline + one CTA. **No tabs. No Future tab. No
outlook.** It must be replaced by a port of the 10-tab surface.

**To add it:**
1. Port `app01-source/monero-pages.jsx` → `repo/src/pages/MoneroPage.tsx`,
   keeping the `MoneroTabs` switch and all 10 tab components
   (`MoneroOverview/Origin/Tech/Legality/MarketsThesis/Comparison/Attacks/`
   **`Future`**`/` + the two from bottom-line).
2. Port `app01-source/bottom-line.jsx` → `repo/src/pages/_monero/BottomLine.tsx`
   (exports `MoneroBottomLine`, `MoneroOutlook`).
3. Drive the active tab from the route param (`/monero/:tab`) — the corrected
   `to-add/src/App.tsx` already adds that route. Keep tab state in the URL so
   `/monero/future` deep-links.
4. The Tech tab embeds a hand-built SVG `EmissionCurve` (100-year supply vs
   emission) — keep it; it's high-fidelity and self-contained.

> Porting notes: titles use `dangerouslySetInnerHTML` with `<em>` accents — keep
> that pattern. The content is editorial; flag it for review before publishing
> (the source already warns on this).

---

## 2 · Mempool — 6 views, not 5 (+ tx-detail)

The skeleton's `repo/src/views/index.tsx` registers **5** mempool views and a
comment that says "5 mempool surfaces." The shipped UI wires **6**:

```
reactor ★ · classic · bridge · sediment · constellation · terminal
```

`classic.jsx` (the mempool.space-style fee-bucket view) is **absent from
`repo/legacy/`**, as are `tx-detail.jsx` (the shared TX/Block drilldown) and
`mempool-shared.jsx` (atoms every view imports).

**To add it:**
1. Copy `legacy-dropin/mempool/{classic,tx-detail,mempool-shared}.jsx` into
   `repo/legacy/mempool/`.
2. Run `cd repo && npm run port` to emit `repo/src/mempool/*.tsx`.
3. Replace `repo/src/views/index.tsx` with `to-add/src/views/index.tsx` — it
   already lists all 6 views + a `TX_DETAIL` entry.
4. Wire the TX/Block drilldown so any view can open it (it's shared chrome).
   Visual targets: `screenshots/03/04/05/06-mempool-*.png`.

---

## 3 · Markets + Network are two surfaces, not one "Dashboard"

The skeleton ships `repo/src/App.tsx` with a single `/dashboard` route and a
`DashboardPage` stub. **The authoritative route table has no dashboard.**
`app01-source/main.jsx` `ROUTE_TABLE` and the live nav both define **two
independent surfaces**: `/markets` and `/network`.

**To add it:**
1. Replace `repo/src/App.tsx` with `to-add/src/App.tsx` (drops `/dashboard`,
   adds `/markets`, `/network`, and `/monero/:tab`).
2. Add `to-add/src/pages/MarketsPage.tsx` and `NetworkPage.tsx` (typed shells
   with correct chrome — port their bodies from `app01-source/markets.jsx` and
   `network.jsx`; both use `tilt-card.jsx`).
3. Delete `repo/src/pages/DashboardPage.tsx` once parity is reached.
   Targets: `screenshots/07-markets.png`, `08-network.png`.

---

## 4 · Protocol simulations — 14, and the FX engine is missing

This is the **high-fidelity visualization** core. The skeleton stubs 6
primitives and omits the rest. The shipped UI runs **14 animated simulations**:

- **6 primitives** (`legacy/protocols/`): decoy-selection, dandelion, view-tags,
  ringct, stealth, **fcmp** (the FCMP++ "murmuration" — 16 flames dissolving
  into a 150M+ starling cloud, `kicker="… Q3 2026"`).
- **8 metaphors** (all in `metaphors.jsx`): **Hearth** (tail emission, volumetric
  flame + embers), **Metronome** (block target), **Silo** (BTC vs XMR monetary
  policy), **Thermostat** (difficulty adjustment), **Auction** (mempool fees),
  **Skyline** (pool decentralization + HHI), **Bloodhound** (privacy attacks),
  **Balance** (confidential amounts).

**Every metaphor depends on `sim-fx.jsx`** — the shared engine exporting
`SvgDefs`, `ParticleStream`, `Volumetric3D`, `GlowOrb`, `useFrame`, and
`useMouseParallax`. (They also use `useTick`, which lives in `shared.jsx`, not
sim-fx.) **`sim-fx.jsx` is absent from `repo/legacy/`.** Nothing in the metaphor
set renders without it.

**To add it — order matters:**
1. Copy `legacy-dropin/protocols/sim-fx.jsx` into `repo/legacy/protocols/` and
   **port it first** (`npm run port`). It has no dependencies; everything depends
   on it.
2. Copy `legacy-dropin/protocols/metaphors.jsx` into `repo/legacy/protocols/`
   and port. It pulls `ParticleStream`/`GlowOrb`/etc. from sim-fx, `useTick`
   from shared, and `ProtoArtboard` from `repo/src/design/ProtoArtboard.tsx`.
3. Replace `repo/src/views/index.tsx` with `to-add/src/views/index.tsx` — it
   exposes `PROTOCOL_PRIMITIVES` (6) + `PROTOCOL_METAPHORS` (8) + a combined
   `PROTOCOL_VIEWS` (14) for the Education and Simulate surfaces to iterate.

**High-fidelity checklist** (don't lose these in the port):
- `requestAnimationFrame`/`useTick` loops must keep running — many sims animate
  continuously. Gate decorative loops on visibility, not on a one-shot mount.
- Canvas/SVG particle layers (`ParticleStream`) need their parent sized
  explicitly; the artboards are fixed-size, not flex-to-fill.
- `prefers-reduced-motion`: fall back to the visible end-state, never a blank
  frame.
- FCMP++ murmuration runs a ~12s cycle with a long tail — verify the easing in
  `fcmp.jsx` survives the TSX conversion (`any` → typed `t` param).

---

## 5 · Live data hook (net-new)

The skeleton only has the simulated feed. `to-add/src/data/xmrirish-feed.ts` is
a complete `useXmrIrishFeed()` that returns the exact `MoneroLive` shape, wired
to v4's existing `/api/*` proxies + relay WS, with snapshot→WS→poll graceful
degradation and honest `source`/`live` reporting. Wire it in:

```tsx
import { DataProvider } from "@/data/DataContext";
import { useXmrIrishFeed } from "@/data/xmrirish-feed";

<DataProvider useFeed={useXmrIrishFeed}>
  <App />
</DataProvider>
```

No view changes — the whole app follows the hook. Full rationale + the
optimized v5 backend (single snapshot endpoint, edge caching, Cloudflare Worker
aggregator) is in `../DATA_LAYER.md`.

---

## Recommended order of operations

1. **Data first** — drop in `xmrirish-feed.ts`, confirm the home page goes LIVE.
2. **Routes** — replace `App.tsx`, add Markets/Network pages, delete Dashboard.
3. **Mempool** — copy the 3 missing JSX, `npm run port`, swap in the new registry.
4. **Simulations** — port `sim-fx.jsx` then `metaphors.jsx`; verify animations.
5. **Monero 10-tab surface** — port `monero-pages.jsx` + `bottom-line.jsx`,
   wire `/monero/:tab`, confirm the **Future** and **2027+ Outlook** tabs render.
6. **Education** — port the `education-*.jsx` sections + hub.
7. Re-run the privacy/CSP checklist in `../INTEGRATION_BRIEF.md` §7 and ship.

Every file referenced above is included in this folder. Cross-check any visual
against `../screenshots/` and, when in doubt, open
`../design-reference/index.html` and navigate to the surface — that is the
authoritative behavior.
