# v6 mempool view contract — and the five views that don't exist yet

Status: written during v6.0.3 (chart fidelity + mempool display detail).

The v6.1 prototype brief named **11** mempool views. This repo has **6**. This document records
the contract the 6 now share, so the remaining 5 can be built later without re-deriving it — and
so nobody mistakes "not built" for "built and broken".

## What exists

`app/src/views/index.tsx` → `MEMPOOL_VIEWS`:

| id | label | component | file | `fit` |
|---|---|---|---|---|
| `reactor` | Reactor | `ReactorView` | `mempool/reactor.tsx` | ✅ |
| `bridge` | Ops Bridge | `BridgeView` | `mempool/bridge.tsx` | ✅ |
| `sediment` | Sediment | `SedimentView` | `mempool/sediment.tsx` | ✅ |
| `constellation` | Constellation | `ConstellationView` | `mempool/constellation.tsx` | ✅ |
| `terminal` | Terminal | `TerminalHubView` | `mempool/terminal.tsx` | — |
| `classic` | Classic ★ | `ClassicView` | `mempool/classic.tsx` | — |

`fit: true` means `MempoolPage` wraps the view in `<FitView>`, which applies a CSS
`transform: scale()` to fit the canvas width. **Any hover/pointer math inside a `fit` view must use
`getBoundingClientRect()`**, never `offsetWidth`/`clientWidth` — only the former reports the
transformed box. `useSvgCursor` (`@/design/chart-kit`) already does this; use it rather than
re-deriving cursor math.

## What does not exist

**Relay, Orbital, Abyss, Circuit, Pulse.** There is no source for them anywhere in the repo — not in
`app/src/mempool/`, not in `app/legacy/mempool/` (which holds only `bridge`, `constellation`,
`reactor`, `sediment`, `terminal` as `.jsx`), and there is no `six-new-a.jsx`. Building them is
net-new design work, not a port.

## The contract a new view must satisfy

### 1. Props
```ts
// app/src/views/index.tsx
export interface ViewProps {
  data: MoneroLive;
  bg?: { intensity?: "calm" | "busy" | "chaotic"; scan?: boolean };
  focusBlock?: number | null;   // deep link /mempool?block=N
  onClearFocus?: () => void;
}
```
`focusBlock`/`onClearFocus` are currently honoured only by Classic and Reactor. A new view should
honour them: scroll/point to that block and call `onClearFocus` when its detail closes.

### 2. Shell
Wrap the body in `MemViewShell` (`@/mempool/mempool-shared`). It supplies the search bar, the
heartbeat pill, the `TrackChip`, and `MemStatStrip`, and renders `MempoolTrackingDetail` **below**
the body rather than in place of it:

```tsx
const { tracking, onSearch, clearTracking } = useMempoolTracking(data);
return (
  <MemViewShell data={data} tracking={tracking} onSearch={onSearch} onClearTracking={clearTracking}>
    {/* the view's own visual language goes here */}
  </MemViewShell>
);
```

`keepBodyWhileTracking` defaults to **true** and should stay true. Before v6.0.3, four of the six
views replaced their entire body with the detail panel the moment a tx was tracked — which meant a
per-view highlight could never actually be seen. Don't reintroduce that.

### 3. Numbers come from `MemStatStrip`, visuals don't
`useMemStats(data)` (`@/mempool/mem-stats`) is the single source for tx count, total pool bytes,
fee-band distribution, oldest-tx age, median piconero/B, and next-block ETA. A view must not compute
its own version of any of these — the whole point is that the numbers are identical across views and
only the *visualisation* differs.

**Never hardcode a number that reads as a live measurement.** This repo has an ALL-REAL-DATA
invariant (v5.0.14): simulated or illustrative values are confined to `app/src/protocols/**`.
Sediment shipped literal `"≈1:54"`, `"84 p/B"` and `"246 p/B"` styled as live readings until
v6.0.3 — that was a bug. When there is no reading yet, render `—`, never a plausible-looking zero.

### 4. Confirmation tracking, in the view's own language
All confirmation math comes from `@/mempool/conf`:
```ts
chainTip(data)                      // newest CONFIRMED height — NOT data.height
confOf(blockHeight, data)           // the one formula
CONF_UNLOCK                         // 10
confProgress(blockHeight, data)     // 0…1
```
`data.height` is `get_info.height` = chain length = newest + 1. Using it as the tip yields a count
one higher than the ribbon label. Always use `chainTip`.

A tracked tx must be visibly highlighted **in the view's own idiom**, not by dropping a shared
widget on top. How the existing six do it:

| View | Highlight |
|---|---|
| Classic | ▲ marker + `n/10` chip on its block tile, plus the gold UNLOCK divider in the ribbon |
| Reactor | tile outline + glow, ▲ with `n/10` badge |
| Bridge | radar blip pinned to the tx, its fee-band pane border pulses |
| Terminal | the ASCII cell inverts to reverse video, `>> TRACKING <txid>` in the log tail |
| Sediment | the stratum holding the tx gets a gold band + depth marker in the core tube |
| Constellation | the tracked node glows and its edges brighten while the rest of the sphere dims |

A new view should invent its own equivalent. Dimming everything else, or lighting one element, are
both fine — flattening every view into the same chip is not.

The highlight must survive the mempool → block transition. That is free: `useMempoolTracking`
resolves the real height from the node via `useTrackedTxHeight`, and `TrackChip` re-derives state
from `confOf` on every render, so `IN MEMPOOL → 1/10 CONF → … → CONFIRMED · UNLOCKED` happens
without the view doing anything.

### 5. Motion
- Any `requestAnimationFrame` loop must be **delta-time driven**, not frame-count driven — frame-count
  integration runs faster on high-refresh displays. Use `pages/future/FutureMini.tsx` as the
  reference: clamp `dt`, pause on `document.hidden`, reset the timestamp on resume.
- Never call `setState` per frame; mutate refs or DOM/SVG attributes.
- Never schedule the next `requestAnimationFrame` from inside a `setState` updater — React can invoke
  an updater more than once and silently fork the loop.
- Honour `useReducedMotion()` (`@/design/useReducedMotion`): render one static frame, don't animate.
  Note that inline `style={{ transition }}` cannot be overridden by the
  `@media (prefers-reduced-motion: reduce)` block in `styles.css` — inline styles win. Put
  transitions in a class, or gate them in JS.

### 6. Registering
Add to `MEMPOOL_VIEWS` in `app/src/views/index.tsx`. The switcher label in
`app/src/pages/MempoolPage.tsx` derives its count from `MEMPOOL_VIEWS.length`, so it updates itself.

## Briefs for the five

Each is one paragraph — enough to build from, deliberately not prescriptive about the visual.

- **Relay** — the propagation view. Dandelion++ stem-then-fluff is the story: a tx enters as a single
  stem hop and then bursts outward. Shows the mempool as a *network in motion* rather than a
  container. Honest caveat: the public restricted-RPC node cascade exposes no peer topology, so the
  relay graph must be presented as protocol illustration, not measured peer data — or the view must
  stay behind the same "Soon" treatment `NetworkPage`'s peer panel uses.
- **Orbital** — concentric rings by fee tier, txs orbiting at a radius set by `perB` and an angle by
  age, so the next block is "everything inside this radius". Tracked tx = its orbit ring lights up.
- **Abyss** — a deep-water field where each tx is a particle; fee sets luminosity, age sets depth.
  Tracked tx stays lit while everything else dims. This is the view the prototype brief describes as
  "Abyss dims other particles".
- **Circuit** — the mempool as a PCB: traces carry txs from arrival to block inclusion, fee tiers are
  parallel bus lanes. Tracked tx = its trace illuminates end to end.
- **Pulse** — a time-domain view: a rolling waveform of arrivals per second with fee amplitude, so
  bursts read as spikes. Closest in spirit to the existing session-series charts, and the one that
  most needs `MemStatStrip`'s oldest-age and ETA numbers.

## Verification a new view must pass

- `verify-tracking.mjs` — search a txid, assert the view highlights it, the chip persists across the
  mempool → block transition, and depth counts 0→10.
- `verify-memstats.mjs` — assert its `MemStatStrip` numbers match every other view for the same feed.
- `verify-glide.mjs` — if it renders a block ribbon, the FLIP glide must fire once per real block
  advance and snap under reduced motion.
