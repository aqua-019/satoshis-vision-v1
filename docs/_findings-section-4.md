# Section 4 — Performance (static audit)

> Lighthouse / WebPageTest / real-device FPS require live browsers — flagged as MANUAL.
> Static-friendly findings below.

## Asset weight summary

- **Total HTML** (22 files): 884.7 KB
- **`js/`**: ~1.9 MB (root ~400 KB, sims/ 104 KB, genui/ ~520 KB, vendor 1.14 MB)
- **`css/`**: 100.8 KB (`d10.css` 72 KB + `d09.css` 28 KB)
- **Images**: zero PNG/JPG/GIF/WebP — all visualization is text/SVG/WebGL/Canvas

### Top 5 heaviest pages

| Page | Size | Inline CSS lines | Inline % |
|---|---|---|---|
| `bottom-line.html` | 123 KB | 1,638 | 51% |
| `btc-xmr-education.html` | 94 KB | 2,015 | 55% |
| `mempool-explorer.html` | 66 KB | 1,617 | 50% |
| `mempool-ocean.html` | 54 KB | 1,273 | 51% |
| `mempool-mining.html` | 54 KB | 1,273 | 53% |

## Script count + load order

| Page | Script count | Module loads | Render-blocking |
|---|---|---|---|
| `mempool-mining.html` | 30 | 0 | **30** |
| `mempool-ocean.html` | 30 | 0 | **30** |
| `mempool-explorer.html` | 29 | 0 | **29** |
| `protocol-simulations.html` | 12 | 6 | 6 (ES modules) |
| `bottom-line.html` | 6 | 0 | 6 |
| `btc-xmr-education.html` | 6 | 0 | 6 |
| `index.html` | 6 | 0 | 6 |

**Pf-3:** Mempool sub-pages (out of 18-page scope but in same site) load 29–30 scripts sequentially with no `defer` / `async`. Defer to v5.0.

## Findings

| # | Finding | Class | Effort |
|---|---|---|---|
| Pf-1 | `js/vendor/three.module.js` is 1.14 MB **unminified**. r128 ships `three.module.min.js` (~550 KB / ~210 KB gzip) at `https://unpkg.com/three@0.128.0/build/three.module.min.js`. Swap importmap entry in `protocol-simulations.html:18`. | DECIDE → likely FIX | ~5 min + sim re-test |
| Pf-2 | `protocol-simulations.html:164-172` loads all 6 sim modules + Three.js upfront. Even if user never clicks a card. | DECIDE | v5.0 (lazy-load needs scaffolding) |
| Pf-3 | Mempool sub-pages load 29-30 render-blocking scripts. | DECIDE | v5.0 (refactor) |
| Pf-4 | 5 heavy pages embed >50% inline CSS, defeating HTTP cache. ~400 KB uncacheable on repeat visits. | DECIDE | v5.0 (extract) |
| Pf-5 | Zero pages preload `fonts.bunny.net` fonts. Render-blocking FOIT. Add `<link rel="preload" as="font" ... crossorigin>` to `<head>`. Estimated +50–150 ms FCP. | FIX | ~10 min (template) |
| Pf-6 | `vercel.json` sets cache headers only for `/api/*`. Static assets (CSS/JS/fonts) default to Vercel CDN's 60s. Phase 6 §4.5 requires `max-age=31536000` for static. **SHIP-BLOCKER per §4.5.** | FIX | ~5 min |
| Pf-7 | `fcmp-implementation.js` Phase 3 with default `displayedUtxoCount=50_000` may stall low-end phones. No frame-rate adaptive scaling. | DECIDE | v5.0 (adaptive) |

## Per-sim FPS prediction

| Sim | Heaviest work | Risk | Notes |
|---|---|---|---|
| Decoy Selection | `ringSize=16` log-normal sampling | LOW | |
| Dandelion Propagation | `networkSize=50-100`, O(n) per frame | LOW | Graph built once at init |
| View Tag Matching | `scanIterations=100-1000` | MEDIUM | Slider-scaled; no throttle |
| RingCT Construction | Fixed 16-member ring | LOW | Phase-based animation |
| Stealth Address | Discrete-step DH | LOW | |
| FCMP++ Implementation | `displayedUtxoCount=50_000` instanced render | **HIGH** | 100K = 600K triangles; Firefox stress threshold |

**S-4 (no dispose):** Confirmed — no `.dispose()` on Three.js resources in `js/genui/engine.js`.
**S-5 (timer leaks):** No `setInterval` in sims; all use RAF via engine.

## Cache header gap (Pf-6) — proposed fix

Add to `vercel.json` `headers` array:

```json
{
  "source": "/(.*)\\.(?:js|css|woff2?|ttf|otf)$",
  "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
},
{
  "source": "/(.*)\\.html$",
  "headers": [{ "key": "Cache-Control", "value": "public, max-age=300, must-revalidate" }]
}
```

## MANUAL items (live URL required)

- Lighthouse mobile + desktop on top 5 pages (record into baseline metrics).
- WebPageTest Mobile 4G profile on `/` for FCP / LCP / TTI / CLS / FID.
- Real-device FPS test on Sim 6 (iPhone SE, Samsung A15) with `displayedUtxoCount` swept 5K → 100K.
- Verify Vercel auto-applies Brotli on deploy (no manual config needed).

## Static ship-blockers

1. **Pf-6** — cache headers gap. Quick `vercel.json` edit.
2. **Pf-1** — Three.js unminified. Swap to minified variant.

Both are <10 min fixes; can be applied in Phase D.
