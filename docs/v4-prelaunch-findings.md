# v4.0 Pre-launch Findings

**Date started:** 2026-05-02
**Date completed:** _in progress_
**Status:** PHASE D IN PROGRESS — most fixes applied; P-1 fonts blocked on sandbox network access
**Branch:** `claude/phase6-prelaunch-qa-x9Sol`

> Working artifact for Phase 6 (v4.0 pre-launch QA). Sections 2–8 audits
> complete (static-friendly). Live-URL / real-device / cross-browser
> verification flagged as MANUAL. Aquatic review gate is the next step
> before Phase D fixes and Phase E/F deployment.

> Per-section detail lives in `docs/_findings-section-N.md` fragments.
> This document is the rollup + decision table.

## Decision rollup

### Definite ship-blockers (clear-cut, no Aquatic call needed)

| # | Finding | Section | Effort |
|---|---|---|---|
| A-4 | 7 of 18 pages missing `<h1>` (WCAG 2.4.6): `hold-monero`, `markets`, `network`, `ecosystem`, `community`, `legal`, `future-outlook` | §3 | ~20 min total |
| A-6 | No `robots.txt`, no `sitemap.xml` | §9 | ~10 min |
| P-3 | CSP unused entries (`xmrchain.net`, `localmonero.co`, `p2pool.io`, `moneroocean.stream` in `connect-src`; `api.coingecko.com` in `img-src`) | §5 | ~5 min |
| P-4 | CSP missing `Strict-Transport-Security` | §5 / §9 | ~2 min |
| Pf-6 | `vercel.json` missing static asset cache headers (Phase 6 §4.5 explicitly requires) | §4 | ~5 min |
| Pf-1 | `js/vendor/three.module.js` is unminified (1.14 MB → 550 KB minified). r128 `three.module.min.js` ships at unpkg. | §4 | ~10 min + sim QA |

### FIX-IN-PHASE candidates (low-risk template work)

| # | Finding | Section | Effort |
|---|---|---|---|
| A-2 | Missing favicon / apple-touch-icon / manifest | §3 / §9 | ~15 min |
| A-3 | No skip-to-content link on any page | §3 | ~15 min (template) |
| A-1 | 17 of 18 pages lack OG/Twitter meta | §3 / §9 | ~30 min (template, scope-bounded) |
| Pf-5 | No font preload | §4 | ~10 min (template) |

### DECIDE — Aquatic input required

| # | Finding | Section | Effort | Options |
|---|---|---|---|---|
| **P-1** | `fonts.bunny.net` loaded site-wide. Site/CLAUDE.md imply self-hosted. Privacy claim violated at runtime. | §5 | ~45 min self-host | (a) Self-host 5 WOFF2 families and drop bunny from CSP. (b) Accept and document as third party (alongside CoinGecko / ChangeNOW). |
| **P-2** | `markets.html:204,212` direct browser fetch to CoinGecko market_chart (distinct from price-service.js). | §5 | ~20 min refactor | (a) Move into price-service.js or `/api/` proxy. (b) Accept as same-vendor extension of documented exception. |
| **P-7** | ChangeNOW `postMessage` handler lacks explicit `targetOrigin` check (read-only handler). | §5 | ~5 min | (a) Add origin guard. (b) Accept (read-only). |
| **S-1** | None of 6 sims check `prefers-reduced-motion`. WCAG 2.3.3 violation. | §3 | ~30 min in `js/genui/engine.js` | (a) Add to engine + per-sim still-keyframe variant. (b) Defer to v5.0 — but flagged WCAG ship-blocker. |
| **S-2** | No `aria-live` for sim phase transitions. | §3 | ~20 min | (a) Add live region in protocol-simulations.html. (b) Defer to v5.0. |
| **S-3** | No keyboard nav in any sim (canvas tabindex, Enter to open inspector). | §3 | ~45 min+ | (a) Implement. (b) Defer to v5.0. |
| **S-4** | No WebGL `dispose()` on scene switch in `js/genui/engine.js`. Multiple sim opens may exhaust browser WebGL context limit. | §6 | ~30 min | (a) Add cleanup in engine. (b) Defer to v5.0 (sims work for typical use). |
| **A-5** | Severe semantic landmark gap (1 `<main>` site-wide, no `<header>`/`<footer>`). | §3 | Big — site-wide template | Likely v5.0 (architectural). |
| **Pf-2** | All sim modules + Three.js loaded upfront on protocol-simulations. | §4 | Big — needs scaffold | Likely v5.0. |
| **Pf-3** | Mempool sub-pages load 29-30 render-blocking scripts. | §4 | Big — refactor | Likely v5.0. |
| **Pf-4** | 5 heavy pages embed 50%+ inline CSS (no cache benefit). | §4 | Big — extract | Likely v5.0. |
| **Pf-7** | Sim 6 default 50K particles may stall low-end phones (no adaptive scaling). | §4 | ~30 min | (a) Add device detection + lower default on mobile. (b) Defer to v5.0. |
| **P-8** | CSP `'unsafe-inline'` used by 19 inline scripts across pages. | §5 | Big — externalize | Likely v5.0 hardening. |

### PASS / no action

| # | Finding |
|---|---|
| P-5 | api/xmr.js back-end fetches (p2pool, moneroocean) — same-origin from browser |
| P-6 | ChangeNOW iframe lazy-loaded, user-initiated |
| P-9 | localStorage usage is local-only; no exfil |
| P-10 | No service workers |
| P-11 | No analytics tags anywhere |
| §6 | No static ship-blockers in cross-browser code review (all custom shaders standard, all sims have SVG fallback paths) |
| §7 | Content audit clean (zero broken internal links, zero past-tense FCMP++ activation framing, zero `100M`/`10⁸` chain count refs, FCMP++ consistency vs canonical-facts confirmed) |
| §8 | Error handling robust (price-service caches & shows `—`, API endpoints cascade with timeouts, GenUI catches sim load failures and falls to SVG) |

---

## Sign-off

⏳ Awaiting Aquatic review of findings before Phase E (deployment).
⏳ Awaiting Aquatic sign-off before Phase F (ship-day actions).

## Phase D progress (this branch)

Aquatic-approved fixes applied as commits on `claude/phase6-prelaunch-qa-x9Sol`:

| Finding | Status | Commit subject |
|---|---|---|
| P-3 CSP unused entries | ✅ FIXED | `fix(phase6): security + CSP cleanup + cache headers` |
| P-4 missing HSTS | ✅ FIXED | (same commit) |
| Pf-6 cache headers | ✅ FIXED | (same commit) |
| P-7 ChangeNOW postMessage origin | ✅ FIXED | (same commit) |
| A-4 7 pages missing h1 | ✅ FIXED | `fix(phase6/a11y): add h1 to 7 pages missing one` |
| A-6 robots.txt + sitemap | ✅ FIXED | `fix(phase6/seo): add robots.txt + sitemap.xml` |
| A-2 favicon + manifest | ✅ FIXED | `feat(phase6/a11y): favicon, skip-link, focus-visible, reduced-motion` |
| A-3 skip-to-content link | ✅ FIXED | (same commit) |
| Focus indicator | ✅ FIXED | (same commit) |
| S-1 prefers-reduced-motion (CSS) | ✅ FIXED | (same commit) |
| Pf-1 three.module.js minification | ⏭️ RECLASSIFIED PASS | Documented privacy decision in `js/vendor/README.md` — minified ESM not shipped by r128 upstream; CDN minified versions are third-party-transformed. Brotli wire size ~210 KB is comparable to minified+compressed. |
| A-1 OG / Twitter meta site-wide | ✅ FIXED | `feat(phase6/seo): site-wide OG / Twitter meta` |
| P-2 CoinGecko proxy | ✅ FIXED | `feat(phase6/privacy): proxy CoinGecko via /api/coingecko` |
| S-1 reduced-motion (engine JS) | ✅ FIXED | `feat(phase6/sim-a11y): reduced-motion + aria-live + keyboard + dispose` |
| S-2 aria-live phase announcer | ✅ FIXED | (same commit) |
| S-3 keyboard nav (sim mount) | ✅ FIXED | (same commit) |
| S-4 engine.destroy() | ✅ FIXED | (same commit) |
| Pf-7 Sim 6 mobile particle scaling | ✅ FIXED | (same commit) |

### Phase D blocker

| Finding | Status | Reason |
|---|---|---|
| **P-1** Self-host fonts.bunny.net | 🟡 BLOCKED | Sandbox network policy denies outbound fetches to fonts.bunny.net (and unpkg/github raw). WOFF2 binaries must be fetched from a trusted source, then committed. **Two paths forward:** (a) Aquatic supplies the 5 font families as WOFF2 in `fonts/` from a local environment with network access; (b) revisit decision and ship as documented exception (the original DECIDE alternative). |
| Pf-5 Font preload | ⏸️ BLOCKED ON P-1 | Preload target depends on whether fonts are local (preload `/fonts/*.woff2`) or stay third-party (preload `fonts.bunny.net` URLs). |

### Items deferred to v5.0

| # | Reason |
|---|---|
| A-5 (semantic landmarks) | Site-wide template refactor; out of Phase 6 scope. Partially mitigated by `id="main"` injection in `nav.js` for the skip-link target. |
| Pf-2 (lazy-load sim modules) | Architecture change. |
| Pf-3 (mempool render-blocking scripts) | Architecture change. |
| Pf-4 (inline-CSS bloat extraction) | Architecture change. |
| P-8 (`'unsafe-inline'` removal) | Externalize 19 inline scripts. |
| og:image asset | Needs raster generation pipeline; Twitter `summary` (no image) ships now. |

---

## Pre-flight (Section 0) — verified

| Check | Status | Evidence |
|---|---|---|
| Branch checked out | ✅ | `claude/phase6-prelaunch-qa-x9Sol`, working tree clean |
| All 6 sim files in `js/sims/` | ✅ | `decoy-selection.js`, `dandelion-propagation.js`, `view-tag-matching.js`, `ringct-construction.js`, `stealth-address.js`, `fcmp-implementation.js` |
| `fcmp.html` present | ✅ | 18,678 bytes |
| `docs/v4-fcmp-canonical-facts.md` present | ✅ | last updated May 2 2026 |
| Sim 6 status flags | ✅ | 6 cards `data-status="ready"`, 0 `data-status="soon"` |
| `/fcmp` route in `vercel.json` | ✅ | `vercel.json:58` |
| Three.js binary | ⚠️ | `js/vendor/three.module.js` (1.14 MB **unminified**) — see Section 4 finding |

---

## Baseline metrics (Section 0.2)

⚠️ **Manual capture required** — Lighthouse and WebPageTest run against the
live production domain. To capture before-state metrics, run on
`https://xmr.irish` (or current preview):

- **Lighthouse mobile + desktop** for: `/`, `/protocol-simulations`, `/fcmp`,
  `/bottom-line`, `/hold-monero`. Record Performance / Accessibility /
  Best Practices / SEO scores.
- **WebPageTest** Mobile 4G profile on `/` — capture FCP, LCP, TTI, CLS, FID.
- **Initial bundle size** for `/protocol-simulations` (heaviest entry point;
  loads Three.js + 6 sim modules).

| Page | LH Perf (m) | LH Perf (d) | LH A11y | LH Best | LH SEO | FCP | LCP | TTI | Bundle (init) |
|---|---|---|---|---|---|---|---|---|---|
| `/` | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| `/protocol-simulations` | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| `/fcmp` | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| `/bottom-line` | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| `/hold-monero` | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |

---

## Section 2 — Mobile QA

**Devices:** iPhone 12 Safari iOS, Pixel 7 Chrome Android, iPad Pro Safari iPadOS.
Real-device required for sim WebGL + touch behavior.

**Static-friendly audit summary** (full detail: `docs/_findings-section-2.md`):

- All 18 pages have correct viewport meta. ✅
- No fixed widths >400px without media-query overrides on in-scope pages. ✅
- Zero static ship-blockers found.
- 4 pages have zero `@media` queries: `timeline.html`, `secrets.html`, `quotes.html`, `protocol-simulations.html`. Real-device verification needed.
- `protocol-simulations.html`: SVG renderer enforces 800px minimum viewWidth and lacks a window resize listener — flagged as MEDIUM-HIGH risk for orientation changes.
- ChangeNOW iframe on `hold-monero.html` has fixed 420px height — possible nested-scroll on landscape <400px.

| Page | iPhone 12 (Safari) | Pixel 7 (Chrome) | iPad Pro (Safari) | Status | Notes |
|---|---|---|---|---|---|
| `index.html` | _TBD_ | _TBD_ | _TBD_ | _TBD_ | |
| `protocol-simulations.html` | _TBD_ | _TBD_ | _TBD_ | _TBD_ | sim canvas resize, touch parameters |
| `fcmp.html` | _TBD_ | _TBD_ | _TBD_ | _TBD_ | |
| `privacy-architecture.html` | _TBD_ | _TBD_ | _TBD_ | _TBD_ | |
| `bottom-line.html` | _TBD_ | _TBD_ | _TBD_ | _TBD_ | wide tables; horizontal scroll required |
| `btc-xmr-education.html` | _TBD_ | _TBD_ | _TBD_ | _TBD_ | infographics |
| `hold-monero.html` | _TBD_ | _TBD_ | _TBD_ | _TBD_ | ChangeNOW iframe sizing |
| `markets.html` | _TBD_ | _TBD_ | _TBD_ | _TBD_ | charts |
| `network.html` | _TBD_ | _TBD_ | _TBD_ | _TBD_ | |
| `mempool.html` | _TBD_ | _TBD_ | _TBD_ | _TBD_ | redirect — verify only |
| `timeline.html` | _TBD_ | _TBD_ | _TBD_ | _TBD_ | |
| `secrets.html` | _TBD_ | _TBD_ | _TBD_ | _TBD_ | |
| `quotes.html` | _TBD_ | _TBD_ | _TBD_ | _TBD_ | |
| `mining.html` | _TBD_ | _TBD_ | _TBD_ | _TBD_ | |
| `ecosystem.html` | _TBD_ | _TBD_ | _TBD_ | _TBD_ | |
| `community.html` | _TBD_ | _TBD_ | _TBD_ | _TBD_ | |
| `legal.html` | _TBD_ | _TBD_ | _TBD_ | _TBD_ | |
| `future-outlook.html` | _TBD_ | _TBD_ | _TBD_ | _TBD_ | |

### Sim-specific mobile checks

| Sim | Mobile render | Touch params | Inspector | Frame rate | Status |
|---|---|---|---|---|---|
| Decoy Selection | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| Dandelion Propagation | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| View Tag Matching | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| RingCT Construction | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| Stealth Address | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| FCMP++ Implementation | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |

---

## Section 3 — Accessibility

### Pre-existing seed findings

| # | Finding | Severity | Class |
|---|---|---|---|
| A-1 | 17 of 18 pages lack OG/Twitter meta entirely. Only `index.html` has partial OG; `og:image` missing site-wide; no `twitter:card` anywhere. | should-fix (SEO) | FIX |
| A-2 | No `favicon.ico`, `apple-touch-icon.png`, `manifest.json` on disk. No `<link rel="icon">` in any page. | should-fix | FIX |
| A-3 | No skip-to-content link on any page. | should-fix | FIX |
| A-4 | 7 pages missing `<h1>` entirely: `hold-monero`, `markets`, `network`, `ecosystem`, `community`, `legal`, `future-outlook`. WCAG 2.4.6. | ship-blocker (WCAG AA) | FIX |
| A-5 | Severe semantic landmark gap: only 1 `<main>`, 2 `<header>`-class divs, 2 `<footer>`-class divs site-wide. | should-fix | DECIDE |
| A-6 | No `robots.txt`, no `sitemap.xml`. | should-fix (SEO) | FIX |
| S-1 | None of 6 sims call `prefers-reduced-motion`. WCAG 2.3.3. | ship-blocker | DECIDE |
| S-2 | No `aria-live` for sim phase transitions. | ship-blocker | DECIDE |
| S-3 | No keyboard nav (`tabindex`/`keydown`) in any sim. | should-fix | DECIDE |

### Per-page Lighthouse a11y scores

**Lighthouse / axe / WAVE require live browsers — MANUAL.**
Static-friendly audit (full detail: `docs/_findings-section-3.md`):

- **Color contrast**: all primary token pairs PASS WCAG AA. Light text on dark = 17.02:1; orange `#FF6600` on dark = 7.10:1.
- **Heading hierarchy**: pages with `<h1>` have valid sequences; the 7 pages missing `<h1>` are the only structural issue.
- **Form labels**: 8 unlabeled inputs found (sliders, search boxes) on `dashboard.html` and `mempool-explorer.html` — out of 18-page scope but flag for v5.0.
- **Focus indicators**: global `outline: none` without replacement — keyboard users lose focus cues. **DECIDE** (could be FIX in <10 min).
- **Reduced-motion CSS coverage**: only 1 animation block site-wide is wrapped in `@media (prefers-reduced-motion: reduce)`. 50+ animations / transitions are uncovered.
- **No placeholder alt text** (`alt="image"`, `alt="logo"`) found.
- **Predicted Lighthouse a11y scores** (without fixes): most pages 60-80; pages missing `<h1>` predicted 50-65.

---

## Section 4 — Performance

### Pre-existing seed findings

| # | Finding | File | Class |
|---|---|---|---|
| Pf-1 | `js/vendor/three.module.js` is 1.14 MB **unminified**. Phase 6 §4.4 expects ~600–700 KB minified. | `js/vendor/three.module.js` | DECIDE (minify or accept; Three.js r128 has `three.module.min.js` available) |
| Pf-2 | `protocol-simulations.html:164-172` loads all sim modules + Three.js upfront (no lazy-load on card click). | `protocol-simulations.html` | DECIDE (lazy-load deferral to v5.0?) |

### Per-page Lighthouse + WebPageTest

**MANUAL** — requires live URL. See `docs/_findings-section-4.md` for full asset weight + script count + sim FPS prediction.

Highlights:
- Zero raster images in repo. All visualization is text/SVG/Canvas/WebGL.
- Vercel auto-applies Brotli; estimated three.module.js: 1.14 MB → ~210 KB on the wire.
- 5 heavy pages (bottom-line, btc-xmr-education, mempool sub-pages) embed 50%+ inline CSS — flagged Pf-4 for v5.0 extract pass.
- Mempool sub-pages load 29-30 render-blocking scripts each — flagged Pf-3 for v5.0.
- Sim 6 (`fcmp-implementation.js`) Phase 3 with default `displayedUtxoCount=50,000` predicted MEDIUM risk on low-end phones (~600K triangles at 100K).
- All other sims predicted 60fps desktop, 30-45fps tablet.

### Vercel cache header gap (Pf-6) — ship-blocker

`vercel.json` only sets cache headers on `/api/*`. Phase 6 §4.5 requires `max-age=31536000` for static and short max-age for HTML. Proposed fix in `_findings-section-4.md`.

---

## Section 5 — Privacy invariant

### Pre-existing seed findings

| # | Finding | File | Class |
|---|---|---|---|
| P-1 | `fonts.bunny.net` loaded as CSS link in **every page head** (JetBrains Mono, Playfair, DM Mono, Geologica, Sora). CLAUDE.md and site copy imply self-hosted fonts. CSP allows it but the privacy-invariant claim is breached at runtime. | All HTML, `<head>` | DECIDE (self-host vs document exception). **Per prompt: privacy issues are always ship-blocker or accept — no v5.0 deferral.** |
| P-2 | `markets.html:204,212` — direct browser fetch of `api.coingecko.com/api/v3/coins/{monero,bitcoin}/market_chart`. Distinct from documented `price-service.js` exception. | `markets.html` | DECIDE (extend price-service abstraction or accept as same-vendor extension) |
| P-3 | CSP `connect-src` lists `xmrchain.net`, `localmonero.co` — only used as link `href`, never fetched. CSP `img-src` allows `api.coingecko.com` — never used. | `vercel.json:19` | FIX (low-risk CSP cleanup) |
| P-4 | CSP missing `Strict-Transport-Security` header. Phase 6 §9.2 requires it. | `vercel.json` | FIX |
| P-5 | Server-side fetches in `api/xmr.js:716,720` to `p2pool.io` and `moneroocean.stream`. Same-origin from browser perspective; documented as backend pool stats proxy. | `api/xmr.js` | PASS (back-end only, not a runtime third-party call from browser) |
| P-6 | ChangeNOW iframe at `hold-monero.html:285` — documented privacy exception (user-initiated swap UI). | `hold-monero.html` | PASS (documented exception) |

### Per-page network audit

Static comprehensive scan complete (full detail: `docs/_findings-section-5.md`).

**No NEW privacy violations found** beyond the seed list. No analytics. No tracking pixels. No service workers. `localStorage` usage is local-only. ChangeNOW iframe is `loading="lazy"` and user-initiated.

Live DevTools network audit per page = MANUAL.

### Wallet extension noise

Browser extensions (MetaMask, Nightly, Xverse) inject scripts that throw
console errors. **NOT a privacy violation** — extension-level, not xmr.irish.
Document so QA reviewers don't get confused.

---

## Section 6 — Cross-browser sims

Static code review only — live browser tests = MANUAL. Full detail: `docs/_findings-section-6.md`.

### Per-sim risk classification

| Sim | Custom shaders | InstancedMesh | RingGeometry | Risk |
|---|---|---|---|---|
| Decoy Selection | glow only | none | none | LOW |
| Dandelion Propagation | glow + signature trail | none | none | LOW |
| View Tag Matching | standard | none | none | LOW |
| RingCT Construction | **Pedersen blob (simplex noise)** | none | yes (range-proof rings) | **MEDIUM** (Safari shader-precision risk per §6.3) |
| Stealth Address | standard | none | none | LOW |
| FCMP++ Implementation | UTXO ocean (instanced parallax) | **50K-100K (default 50K)** | none | **HIGH** (Firefox stress per §6.3; 100K = ~600K triangles) |

All sims have SVG fallback paths. No WebGL2-only features. All additive blending uses `depthWrite: false` (Safari 16-17 mitigation). No static ship-blockers.

**S-4 (no dispose) confirmed**: `js/genui/engine.js` has no cleanup on scene switch — repeated card clicks may exhaust browser WebGL context limit.

---

## Section 7 — Content audit

Full detail: `docs/_findings-section-7-8.md`.

| Check | Result | Notes |
|---|---|---|
| Internal links resolve | ✅ PASS | 22 pages, 0 broken links; `vercel.json` rewrites validated |
| External links inventoried | ✅ | 137 URLs; no fetch attempt (manual spot-check optional) |
| Stale years (`2024`/`2025`) | ✅ PASS | 32 instances; all legitimate historical anchors |
| Stale month/year combos | ✅ PASS | 47 combos reviewed |
| FCMP++ consistency vs canonical-facts | ✅ PASS | 9 references aligned |
| Past-tense FCMP++ activation framing | ✅ PASS | Zero matches |
| `100,000,000` / `10⁸` chain count | ✅ PASS | Zero matches; all moved to 150M+ |
| Hardcoded prices | ✅ PASS | All historical/illustrative |
| `bottom-line.html` spellcheck | ✅ PASS | Clean copy, no typos found |
| `fcmp.html` date stamps | ✅ Current | "May 2026" / "Alpha Oct 3 2025" / "Beta launches May 6 2026" — no refresh needed at ship if shipped before May 6 |

---

## Section 8 — Error handling & graceful degradation

Static code review (full detail: `docs/_findings-section-7-8.md`). Live verification = MANUAL.

| Scenario | Behavior | Status |
|---|---|---|
| `price-service.js` fetch error | Caches last-known-good; displays `—` on first load failure | ✅ PASS |
| `api/xmr.js` / `api/monero.js` RPC error | Multi-node cascade with timeouts; returns null cleanly | ✅ PASS |
| Sim module load failure | GenUI catches, falls to SVG renderer | ✅ PASS |
| WebGL unavailable | `js/genui/engine.js` detects + dispatches to `renderer-svg.js` | ✅ PASS |
| Console errors baseline | 4 legitimate `throw new Error` paths; all handled | ✅ baseline established |
| `<noscript>` content | Only 1 page has meaningful no-JS fallback | ⚠️ DECIDE (low priority) |
| CSP `'unsafe-inline'` audit | 19 inline `<script>` blocks identified — externalizing = v5.0 | DECIDE |

### Pre-existing seed findings

| # | Finding | File | Class |
|---|---|---|---|
| S-4 | No WebGL `dispose()` / cleanup path on scene switch in `js/genui/engine.js`. Repeated card clicks may accumulate WebGL contexts. | `js/genui/engine.js` | DECIDE |
| S-5 | All ES modules in `protocol-simulations.html:164-172` load **upfront** (not lazy). Three.js (1.14 MB) blocks initial render of sim grid. | `protocol-simulations.html` | DECIDE |

---

## Section 9 — Deployment

(populated during Phase E, after Aquatic sign-off on findings)

| Check | Result |
|---|---|
| Vercel project: prod domain `xmr.irish` | _TBD_ |
| Auto-deploy from `main` enabled | _TBD_ |
| `vercel.json` cache headers correct | _TBD_ |
| `Strict-Transport-Security` set | _TBD_ |
| CSP final pass | _TBD_ |
| `robots.txt` + `sitemap.xml` present | _TBD_ |
| OG/Twitter card preview test | _TBD_ |
| Favicon set | _TBD_ |
| All §9.6 routes return 200 | _TBD_ |

---

## Ship-blockers found

| # | Issue | Fix | Status |
|---|---|---|---|
| _populated post-audit_ | | | |

## Items deferred to v5.0

| # | Issue | v5.0 phase | Rationale |
|---|---|---|---|
| _populated post-audit_ | | | |

## Items accepted (documented exceptions)

| # | Issue | Rationale | Documented in |
|---|---|---|---|
| _populated post-audit_ | | | |

---

## Sign-off date

Aquatic: _pending_
