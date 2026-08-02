# PERF-BASELINE — v6.0.8 framerate & performance, mobile-first

Before/after for the v6.0.8 performance pass. Both halves were captured with
the same harness, engine, throttle and route list, so the *deltas* are
meaningful even where the absolute numbers are not portable.

## Method

Chromium via Playwright + CDP:

| Setting | Value |
|---|---|
| Viewport | 390 × 844, `deviceScaleFactor: 3` (iPhone-class) |
| CPU | `Emulation.setCPUThrottlingRate(6)` — 6× slowdown |
| Network | `Network.emulateNetworkConditions` ≈ Slow 4G: 1.6 Mbps down, 750 Kbps up, 150 ms RTT |
| FPS | 8 s `requestAnimationFrame` inter-frame sample, taken 2.5 s after load |
| Long tasks / CLS / LCP | `PerformanceObserver` (`longtask`, `layout-shift`, `largest-contentful-paint`), installed via `addInitScript` before app code — **but see the correction below: that harness was never committed** |
| Background | `visibilityState` forced to `hidden` + `visibilitychange` dispatched, then rAF callbacks counted over 3 s |

> These are **CDP-derived metrics, not a Lighthouse run.** Lighthouse is not
> installed in this environment. LCP/CLS come from the same browser APIs
> Lighthouse reads, but there is no Lighthouse score here and none is claimed.

At 390 × 844 with 6× CPU throttling the device heuristic resolves to the
**`low`** tier, which is the intended reading for a mobile-first pass — this is
what a phone gets.

## Results

### Framerate and main-thread cost

| Route | FPS before | FPS after | p95 frame before | p95 after | Long tasks before | after |
|---|---:|---:|---:|---:|---:|---:|
| `/` | 14.5 | **50.0** | 100 ms | 33.4 ms | 120 (8289 ms) | **3 (531 ms)** |
| `/mempool` | 15.7 | **60.1** | 83.4 ms | 16.7 ms | 46 (3571 ms) | **6 (782 ms)** |
| `/markets` | 13.7 | **46.4** | 100 ms | 33.4 ms | 115 (8112 ms) | **4 (563 ms)** |

`/mempool` is pinned at the 60 fps ceiling with a 16.7 ms p95 — i.e. no
dropped frames at all. Long-task *time* falls by 84–93% across the three
routes.

### Background tab — the "single cheapest fix"

| Route | rAF callbacks in 3 s while hidden, before | after |
|---|---:|---:|
| `/` | 44 | **0** |
| `/mempool` | 51 | **0** |
| `/markets` | 40 | **0** |

Zero, not "fewer". Every rAF loop and every timer stops; the polls suspend and
fire one immediate refresh on return.

### Compositor layers (`/`, mobile viewport)

| | before | after (`low`) |
|---|---|---|
| plates | 8 | **2** |
| orbs | 30 | **0** |
| dust | 2 | **0** |
| sweep | 1 | **0** |
| ribbon (170vmax conic) | 1 | **0** |
| rAF canvas | 1 | **0** |
| `data-tier` | *(absent)* | `low` |

**43 animated layers + a canvas → 2 static layers.**

### Load

| | before | after |
|---|---:|---:|
| Initial JS (entry, raw) | 560.72 kB | **45.67 kB** |
| Initial JS (entry, gzip) | 164.07 kB | **15.97 kB** |
| Initial JS incl. vendor chunk (gzip) | 164.07 kB | **69.70 kB** |
| JS chunks emitted | 2 | 29 |
| Total JS across all chunks | 658.6 kB | 673.8 kB |
| Vite >500 kB chunk warning | fires | silent |

Total bytes rise ~2% (per-chunk overhead); **bytes needed for first paint fall
58% gzipped**. The framework sits in its own `vendor` chunk so a returning
visitor re-downloads only what changed — the same goal the config's stable
chunk hashes already serve for Tor.

### LCP / CLS — v6.0.8, **SUPERSEDED**, and the LCP half is unreproducible

| Route | LCP before | LCP after | CLS before | CLS after |
|---|---:|---:|---:|---:|
| `/` | 2264 ms | **1540 ms** | 0.0008 | 0.0009 |
| `/mempool` | 2520 ms | **2376 ms** | 0.0117 | **0** |
| `/markets` | 2308 ms | **1916 ms** | 0.0124 | 0.0078 |

**Correction, v6.1.5 — read this before quoting any LCP figure above.**
The Method table says these came from a `PerformanceObserver` over `longtask`
and `largest-contentful-paint`. **That harness was never committed.** Before
v6.1.5 the tree contained zero references to `largest-contentful-paint`,
`longtask` or `interactionId`; the only `PerformanceObserver` in the repo was
`verify-cls.mjs`'s `layout-shift`. So the LCP column cannot be reproduced, and
for three independent reasons it cannot be *continued* either:

1. **The harness does not exist.** It was a throwaway script.
2. **v6.0.9 added prerendering.** These numbers were measured against an empty
   SPA shell where LCP *required* the JS bundle to arrive first. Every route
   now ships real HTML, so the critical path is a different one.
3. **`scripts/serve-dist.mjs` serves assets uncompressed** — no gzip, no
   brotli, a raw `content-length`. Vercel compresses. Any local LCP is
   inflated by an artifact production never pays (the one stylesheet is
   73,031 B raw against 14,863 B gzipped), and these figures were presumably
   measured the same way.

`verify-vitals.mjs` (v6.1.5) is the first *committed* LCP harness. It starts a
new series and stamps every number with the harness that produced it; see
§ Current below.

**The unreserved-fallback experiment — the single source of truth.**
`/mempool`'s CLS reached 0 only after the lazy-view Suspense fallback was given
a `minHeight`. The unreserved version has been measured **twice**:

| reading | harness | recorded in |
|---|---|---|
| **0.0853** | v6.0.8, this document's Method section | `app/PERF-BASELINE.md` (here) |
| **0.0841** | the #152 harness, on a later re-run | `handoffs/HANDOFF-XMRIRISH-20260802-06.md` |

Two runs of one experiment, ~1.4 % apart; the spread is the harness change, not
a code change. Quote it as **~0.085** and cite this table rather than repeating
a bare figure — `verify-cls.mjs` and `src/pages/MempoolPage.tsx` both now point
here instead of carrying their own number. (`MempoolPage.tsx:210` previously
said `~0.07`, which matches neither recorded run; it was either a third
unrecorded measurement or a slip, and is corrected to ~0.085 with a pointer.)

Decisively, **both readings sit below the Web Vitals 0.1 "good" bound.** That
is the empirical reason `verify-cls.mjs`'s ceilings are measured from this tree
rather than taken from that bound: a 0.1 threshold would have waved through a
real, documented regression.

## Gates

`node verify-perf.mjs` (new) — 22 assertions, all passing:

- pre-paint `data-tier` stamped **before hydration**
- per-tier layer census for `low` / `mid` / `high`
- background quiescence on `/`, `/mempool`, `/markets`
- no horizontal overflow: 8 routes × 8 widths (390 / 480 / 768 / 1024 / 1200 / 1440 / 1920 / 2560)
- portrait ↔ landscape flip recovers and the canvas re-fits
- `prefers-reduced-motion` forces `low` and the page still renders content
- ≤4 live intervals on `/mempool?v=constellation` (was 21 `useTick` timers app-wide)
- static: `getDeviceTier()` declared once, no un-gated `setInterval` outside the allowlist

Also passing: `verify-mobile.mjs`, `verify-legibility.mjs`, `npm run typecheck`,
`npm run build`.

## Not measurable in this environment

Playwright device emulation approximates layout and CPU cost. It does **not**
substitute for real hardware. Still outstanding, for a human with devices:

- [ ] Sustained FPS on a real mid-range Android (target ≥50) and a low-end / older iPhone (target ≥30)
- [ ] Battery draw over 5 minutes on the site, before vs after
- [ ] iOS Safari · Android Chrome · Brave Android · Firefox Android on real hardware
- [ ] Tor Browser: confirm it lands `mid`/`low` and CPU stays quiet
- [ ] A real Lighthouse mobile run (targets: Perf ≥85, LCP <2.5 s, TBT <200 ms, CLS <0.1)
- [ ] Memory profile over 5 minutes on `/mempool` — confirm flat, no rAF leak

To re-run the machine-checkable half:

```bash
cd app
npm ci
npx vite build
npx vite preview --port 4173 &
node verify-perf.mjs
node verify-mobile.mjs
node verify-legibility.mjs
```
