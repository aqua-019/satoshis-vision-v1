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

### Load — v6.0.8, **superseded** (see § Current, v6.1.5)

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
a code change. **v6.1.5 re-ran the experiment a third time**, as the break test
for the tightened ceilings: removing `minHeight` from that fallback and
measuring under `HARNESS_DEGRADED` reproduced **0.0841 exactly** — independent
confirmation of the 06 handoff's figure under a harness two revisions newer.
The same break under the *healthy* pass measured **0.1102**, i.e. the shift is
worse when data actually arrives, and only that pass puts it above the Web
Vitals 0.1 bound at all. Quote it as **~0.085** and cite this table rather than repeating
a bare figure — `verify-cls.mjs` and `src/pages/MempoolPage.tsx` both now point
here instead of carrying their own number. (`MempoolPage.tsx:210` previously
said `~0.07`, which matches neither recorded run; it was either a third
unrecorded measurement or a slip, and is corrected to ~0.085 with a pointer.)

Decisively, **both readings sit below the Web Vitals 0.1 "good" bound.** That
is the empirical reason `verify-cls.mjs`'s ceilings are measured from this tree
rather than taken from that bound: a 0.1 threshold would have waved through a
real, documented regression.

## § Current — v6.1.5 measured baseline

Everything above this line is the v6.0.8 pass and is superseded. These are the
numbers the cost gates enforce, and the harness each was measured under.
**A number without a harness stamp is not a number** — four undocumented
vintages of CLS figures existed in this tree before this section was written.

Reproduce with `npm run verify:all`, or individually:
`npm run verify:bundle` · `VITALS_RUNS=8 node verify-vitals.mjs --measure` ·
`CLS_RUNS=8 node verify-cls.mjs --measure`.

### Bundle — `verify-bundle.mjs`

Deterministic: `vite build` emits byte-identical assets for a given tree and
gzip is pinned to level 9, so these hold on any machine and need no per-runner
calibration. Measured at `5fca6ba`.

| class | measured | budget | headroom |
|---|---:|---:|---:|
| eager JS (entry + vendor), gzip | 79,919 B | 88,000 | 10% |
| CSS, gzip | 14,863 B | 17,000 | 14% |
| total JS, raw, 35 chunks | 849,267 B | 940,000 | 11% |
| largest chunk, raw (`SimulatePage`) | 180,572 B | 500,000 | Vite's own warning constant |

Per-route first load, gzip — `EAGER ∪ the route chunk's static closure`.
Dynamic imports are excluded (`/mempool`'s six view engines are a second
round-trip). A shared chunk counts once per route, so **do not sum this
column**; `total JS` above is the non-double-counted figure.

| route | measured | budget | | route | measured | budget |
|---|---:|---:|---|---|---:|---:|
| `/` | 79,919 | 88,000 | | `/future` | 96,034 | 106,000 |
| `/mempool` | 95,236 | 105,000 | | `/peers` | 90,243 | 100,000 |
| `/markets` | 95,007 | 105,000 | | `/simulate` | 133,676 | 148,000 |
| `/network` | 95,610 | 106,000 | | `/node` | 82,493 | 91,000 |
| `/education` | 97,034 | 107,000 | | `/sources` | 85,770 | 95,000 |
| `/monero` | 109,514 | 121,000 | | | | |

The v6.0.8 Load table above recorded 29 chunks and 673.8 kB total; both have
grown with the app (35 chunks, 849.3 kB). Entry+vendor gzip has gone 69.70 kB →
78.05 kB over the same span.

### LCP · blocking · interaction — `verify-vitals.mjs`

**Harness:** `serve-dist (UNCOMPRESSED assets, 501 /api) · mocked feed @120 ms ·
390×844 dpr3 · 6× CPU · Slow-4G · load + 3000 ms`. Median of 8 runs per route.

Two asymmetries make these **not** production timings, and both are stated in
the gate's own header rather than left implicit:

- `serve-dist` sends no `content-encoding`, so the stylesheet arrives at
  73,031 B where Vercel sends 14,863 B. Local LCP is inflated by an artifact
  production never pays, and a CSS optimisation will look larger here than it
  is for real users.
- Playwright's `route.fulfill` short-circuits before the network stack, so the
  emulated Slow-4G throttles the document, bundle and fonts but not the mocked
  feed; the feed instead gets a fixed 120 ms latency so it is neither
  unrealistically instant nor variable.

| route | LCP (median of 8) | spread | blocking | worst scripted interaction | LCP element |
|---|---:|---|---:|---:|---|
| `/` | **1824 ms** | 1788–1852 | 166.5 ms | 96 ms | `p.mono` |
| `/mempool` | **3010 ms** | 2976–3044 | 54.5 ms | 160 ms | `span.pill` |
| `/markets` | **1896 ms** | 1868–1924 | 170.0 ms | 176 ms | `p.mono` |

"Worst scripted interaction" is a **lab** number from a handful of scripted
clicks. It is **not INP**: field INP is a high-percentile over real user
sessions and no lab probe can produce it. `blocking` is `Σ max(0, task − 50 ms)`
over long tasks after FCP within the 3 s window — related to Lighthouse TBT but
not equal to it, since TBT runs FCP→TTI and TTI is not measurable here.

CPU reference probe: 241–262 ms across 24 runs. A run measuring far above that
reports `skip` — a counted outcome — rather than a false regression.

### CLS — `verify-cls.mjs`, two passes

| route | degraded (unmocked, 501 feed) | healthy (mocked @120 ms) |
|---|---:|---:|
| `/` | 0.0006 | **0.3482** ← defect, see below |
| `/mempool` | 0.0000 | 0.0000 |
| `/markets` | 0.0000 | 0.0000 |
| `/network` | 0.0000 | 0.0000 |
| `/sources` | 0.0000 | 0.0000 |

Worst of 8 runs per route per pass. **The two passes measure different
phenomena and are never compared or averaged.** Ceilings tightened from #152's
0.01/0.01/0.02/0.01 to a uniform 0.005, except `/` healthy.

**`/` healthy = 0.3482 is a recorded production defect, not a target.**
`DIV.ticker-strip` grows from h25 to h38 at ~2.9 s when the first market tick
lands, displacing `.shell` (746 px on an 844 px viewport) by 3 px; a
near-full-viewport element moving at all yields a large impact × distance
product. 0.3475–0.3482 across 8 runs, so not noise, and 3.5× the Web Vitals 0.1
bound. It is invisible to the degraded pass — which is precisely why the mocked
pass was added, and why every CLS number recorded in this repo before v6.1.5
described a page where data never arrives. Its ceiling is set at the measured
value so the ruler is green on the tree as it stands; **it is to be lowered.**

**Not covered by either pass:** the Markets charts. The degraded pass 501s
`/api/markets` and the healthy pass fulfils it with `{groups:{}}`, so those
charts render empty in both and their shift behaviour — the reason `/markets`
used to carry a looser ceiling — is unmeasured.

### Build reproducibility

`npm run build` is **not** reproducible. `Footer.tsx` renders a live UTC clock
and `scripts/prerender.mjs` bakes the build machine's wall clock into all 11
`index.html` files: two consecutive builds of identical source measured
`UTC 13:32:51` and `UTC 13:33:29`. Assets are unaffected — all 71 files in
`dist/assets` are byte-identical across builds, which is what makes the
`bundleGraph` plugin's output-neutrality checkable.

## Gates

`node verify-perf.mjs` (new) — 22 assertions, all passing **as of v6.0.8**.
**Nothing currently checks that claim**: `verify-perf.mjs` is wired to no npm
script and is named in no CI job, so it has not run in this repo since it was
written. Treat the list below as a description of what it asserts, not as a
statement about the present tree.


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
npm run verify:all
```

**The previous recipe here was wrong twice**, and both errors would have made
the numbers meaningless rather than merely inconvenient. It said `npx vite
build`, which runs the client build ONLY — skipping `build:ssr`, `prerender.mjs`
and `gen-sitemap.mjs`, so `dist/` would carry no prerendered routes and every
route would serve the SPA shell. And it said `npx vite preview`, which is the
SPA server this repo explicitly bans for gates (README "Verification",
`ci.yml`'s "Start static server"): it falls back to `index.html` for every path,
which hides prerender breakage completely. `npm run verify:all` does the whole
build and uses `scripts/serve-dist.mjs`, which mirrors Vercel's resolution
order.
