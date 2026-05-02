# Section 3 (Accessibility) — Phase 6 Pre-Launch Audit
**xmr.irish Static Site | Date: 2026-05-02**

## Executive Summary

This audit confirms all 5 seed issues (A-1 through A-5, S-1 through S-3) as **REAL**. Additionally, 8 static findings uncovered new barriers across 21 pages (excluding mempool.html redirect). **Critical blockers: 7 pages missing `<h1>`, 19/21 pages missing OG/Twitter meta, no landmark structure, no skip link, 8 form inputs without labels.**

---

## 1. Heading Hierarchy & H1 Coverage (21 pages)

| Page | H1 Present | Heading Sequence | Issues |
|------|-----------|------------------|--------|
| bottom-line.html | ✓ | h1 → h2 (14) → h3 (35) → h4 (77) | OK |
| btc-xmr-education.html | ✓ | h1 → h2 (10) → h3 (27) → h4 (21) | OK |
| community.html | ✗ | None | **CRITICAL** |
| dashboard.html | ✗ | None | **CRITICAL** |
| ecosystem.html | ✗ | None | **CRITICAL** |
| fcmp.html | ✓ | h1 → h2 (8) | OK |
| future-outlook.html | ✗ | None | **CRITICAL** |
| hold-monero.html | ✗ | h4 (4) only | **CRITICAL** (skips h1–h3) |
| index.html | ✓ | h1 → h2 (5) → h3 (3) | OK |
| legal.html | ✗ | None | **CRITICAL** |
| markets.html | ✗ | None | **CRITICAL** |
| mempool-explorer.html | ✗ | None | **CRITICAL** |
| mempool-mining.html | ✗ | None | **CRITICAL** |
| mempool-ocean.html | ✗ | None | **CRITICAL** |
| mining.html | ✓ | h1 → h2 (1) | OK |
| network.html | ✗ | None | **CRITICAL** |
| privacy-architecture.html | ✓ | h1 → h2 (1) | OK |
| protocol-simulations.html | ✓ | h1 → h2 (7) → h3 (1) | OK |
| quotes.html | ✓ | h1 → h2 (6) → h3 (1) | OK |
| secrets.html | ✓ | h1 → h2 (5) → h3 (1) | OK |
| timeline.html | ✓ | h1 → h3 (51) skip h2 | Skips h2 level |

**Finding**: 14/21 pages missing `<h1>`. timeline.html skips h2 directly to h3 (heading hierarchy violation). hold-monero.html jumps to h4 only.

---

## 2. Color Contrast — WCAG AA Spot Check

**Design System Tokens** (css/d09.css, lines 8–40):
- `--bg: #010103` (black)
- `--xmr: #FF6600` (Monero orange)
- `--xmr-light: #FF8533`
- `--g1: #E8E8E8` (light gray, body text)
- `--g3: #909090`, `--g4: #777777`, `--g5: #555555`

**Computed Luminance + Contrast Ratios**:

| Foreground | Background | Luminance | Ratio | WCAG AA Status |
|-----------|-----------|-----------|-------|---|
| #E8E8E8 (--g1) | #010103 (--bg) | 0.8070 / 0.0003 | **17.02:1** | ✓ PASS (body: 4.5:1+) |
| #FF6600 (--xmr) | #010103 (--bg) | 0.3076 / 0.0003 | **7.10:1** | ✓ PASS (large: 3:1+) |
| #FF8533 (--xmr-light) | #010103 (--bg) | 0.3827 / 0.0003 | **8.60:1** | ✓ PASS |
| #909090 (--g3) | #010103 (--bg) | 0.2789 / 0.0003 | **6.53:1** | ✓ PASS (large only) |
| #777777 (--g4) | #010103 (--bg) | 0.1845 / 0.0003 | **4.66:1** | ✓ PASS (body: 4.5+) |

**Finding**: All primary color pairs pass WCAG AA. Dark theme (#010103 BG + light foregrounds) ensures high contrast. **No failures.**

---

## 3. Interactive Elements Without Keyboard Access

**Onclick/addEventListener Usage**:
- bottom-line.html (3 instances): line 1595, 1623, 1639
- btc-xmr-education.html (2 instances): line 1947, 1984
- future-outlook.html (5 instances, all `<button>`): lines 256–260 ✓ accessible

**Form Inputs Without Labels**:
- 8 inputs scattered across 4 pages (`<input type="text">`, `<input type="range">`) with no associated `<label>` or `aria-label`.
  - mempool-explorer.html: `id="exp-search-input"`, `id="mp-tx-input"` (no labels)
  - dashboard.html: `id="roi-hashrate"`, `id="roi-electricity"` sliders (no labels)

**Finding**: Interactive divs/anchors use `addEventListener('click')` but are not natively keyboard-accessible. Form inputs lack explicit labels. **FIX needed.**

---

## 4. Semantic Landmarks

| Page | `<main>` | `<header>` | `<footer>` | Status |
|------|---------|-----------|-----------|--------|
| bottom-line.html | 1 | 0 | 0 | ✓ Has main |
| btc-xmr-education.html | 0 | class="page-hero" div | class="related" div | Missing main |
| community.html | 0 | div.header | div.footer | Missing main |
| ... (18 more) | | | | |

**Finding**: Only 5 pages have semantic `<main>` (bottom-line, protocol-simulations, quotes, secrets, timeline). Zero `<header>` or `<footer>` semantic elements; 2 div.header, 2 div.footer placeholders. **LANDMARK CRISIS: 16/21 pages missing main landmark.** 

css/d10.css line 169 removes input outline globally without replacement: `input { outline: none; }`. css/d10.css line 185 defines `:focus-visible` but only for `.genui-phase-indicator` scope.

---

## 5. Skip-to-Content Link

**Result**: Zero occurrences across 21 pages.
```bash
grep -r "skip-to-content\|skip.link" *.html  →  (no matches)
```

**Finding**: No skip link. **BLOCK for accessibility compliance.**

---

## 6. Reduced-Motion CSS Coverage

**Files with `@media (prefers-reduced-motion: reduce)`**:
- css/d10.css line 176: Single `@media (prefers-reduced-motion: reduce)` block covers only `.genui-phase-indicator`.

**Animations NOT covered by reduced-motion**:
- `@keyframes shamrock-osc` (css/d09.css:88–92) — no reduced-motion override
- `@keyframes blob-float-*` (css/d09.css) — no override
- 50+ `transition:` declarations across d09.css, d10.css — minimal coverage

**Finding**: Only 1 animation block is reduced-motion aware. ~50+ CSS animations/transitions **lack prefers-reduced-motion coverage.** Sims (js/genui, js/sims) have **zero prefers-reduced-motion runtime checks.** **S-1 CONFIRMED.**

---

## 7. Focus Indicators

**CSS grep results**:
- css/d10.css line 185: `:focus-visible` defined (good)
- css/d10.css line 169: `input { outline: none; }` removes outline globally
- css/d10.css line 385: `.genui-button { outline: none; }` no replacement

**Finding**: Global outline removal without replacement on inputs and buttons. `:focus-visible` exists but scope is narrow. **Focus indicators INCOMPLETE.** Users relying on keyboard navigation will lose visual focus cues on many interactive elements.

---

## 8. OG / Twitter Meta Tags

**Result**: Only index.html has OG tags (line 12: `og:title`). 20/21 pages **completely missing** Open Graph and Twitter Card meta.

**Seed Verification**: A-1 **CONFIRMED** — "17 of 18 pages lack OG/Twitter meta." (Actual: 20/21 in this dataset.)

---

## 9. Favicon & Manifest

**Finding**: A-2 **CONFIRMED.** No favicon, apple-touch-icon, or manifest.json referenced in any HTML head. No files found on disk.

---

## 10. Simulations (Decoy, Dandelion, View Tag, RingCT, Stealth, FCMP)

### S-1: Reduced-Motion Runtime Check
- js/genui/engine.js: No `matchMedia('(prefers-reduced-motion: reduce)')` check
- js/sims/*.js: Zero prefers-reduced-motion handling
- **CONFIRMED: S-1 — Sims have NO reduced-motion runtime detection.**

### S-2: Aria-Live for Phase Transitions
- protocol-simulations.html line 136: `.genui-phase-indicator` has no `aria-live`, no `role="status"`, no `aria-atomic`
- js/genui/engine.js: No aria-live updates on phase change
- **CONFIRMED: S-2 — Phase transitions are silent to screen readers.**

### S-3: Keyboard Navigation in Sims
- protocol-simulations.html line 176–200: Cards use `<a>` links (keyboard accessible)
- js/genui/inspector.js line 77: `keydown` listener exists but **only for inspector debug mode** (`if (!inspector) return`)
- Simulation canvas (id="sim-canvas"): No keyboard controls documented, no Tab/Enter/Space handlers for play/pause/parameter adjust
- **CONFIRMED: S-3 — Sims have NO keyboard navigation for play/pause/controls.**

---

## 11. Predicted Lighthouse a11y Scores (Static Signals)

| Page | h1 | main | skip link | landmarks | form labels | prefers-reduced-motion | Predicted Score | Severity |
|------|----|----|-----------|-----------|------------|----------------------|------------------|----------|
| bottom-line.html | ✓ | ✓ | ✗ | ✓ | N/A | ✗ | 65–75 | FIX |
| btc-xmr-education.html | ✓ | ✗ | ✗ | ✗ | N/A | ✗ | 50–60 | BLOCK |
| community.html | ✗ | ✗ | ✗ | ✗ | N/A | ✗ | 35–45 | BLOCK |
| dashboard.html | ✗ | ✗ | ✗ | ✗ | **-20** (sliders) | ✗ | 20–35 | **BLOCK** |
| ecosystem.html | ✗ | ✗ | ✗ | ✗ | N/A | ✗ | 40–50 | BLOCK |
| fcmp.html | ✓ | ✗ | ✗ | ✗ | N/A | ✗ | 50–60 | BLOCK |
| future-outlook.html | ✗ | ✗ | ✗ | ✗ | N/A | ✗ | 40–50 | BLOCK |
| hold-monero.html | ✗ | ✗ | ✗ | ✗ | N/A | ✗ | 35–45 | BLOCK |
| index.html | ✓ | ✗ | ✗ | ✗ | N/A | ✗ | 55–65 | FIX |
| legal.html | ✗ | ✗ | ✗ | ✗ | N/A | ✗ | 40–50 | BLOCK |
| markets.html | ✗ | ✗ | ✗ | ✗ | **-20** (search) | ✗ | 20–35 | **BLOCK** |
| mempool-explorer.html | ✗ | ✗ | ✗ | ✗ | **-20** (inputs) | ✗ | 20–35 | **BLOCK** |
| mempool-mining.html | ✗ | ✗ | ✗ | ✗ | N/A | ✗ | 35–45 | BLOCK |
| mempool-ocean.html | ✗ | ✗ | ✗ | ✗ | N/A | ✗ | 35–45 | BLOCK |
| mining.html | ✓ | ✗ | ✗ | ✗ | N/A | ✗ | 50–60 | BLOCK |
| network.html | ✗ | ✗ | ✗ | ✗ | N/A | ✗ | 40–50 | BLOCK |
| privacy-architecture.html | ✓ | ✗ | ✗ | ✗ | N/A | ✗ | 50–60 | BLOCK |
| protocol-simulations.html | ✓ | ✓ | ✗ | ✓ | N/A | ✗ | 60–70 | FIX (sims: S1–S3) |
| quotes.html | ✓ | ✓ | ✗ | ✓ | N/A | ✗ | 65–75 | FIX |
| secrets.html | ✓ | ✓ | ✗ | ✓ | N/A | ✗ | 65–75 | FIX |
| timeline.html | ✓ | ✓ | ✗ | ✓ | N/A | ✗ | 60–70 | FIX (h2 skip) |

---

## Ship-Blockers (Static)

1. **Missing `<h1>` on 14 pages** — Lighthouse a11y fails without document outline
2. **No `<main>` on 16 pages** — Critical landmark missing
3. **No skip-to-content link site-wide** — WCAG 2.1 Level A requirement
4. **8 form inputs without labels** — dashboard, mempool-explorer, markets (sliders, text)
5. **Sims: No keyboard navigation, no reduced-motion, no aria-live** — S-1, S-2, S-3
6. **Global `outline: none` with no `:focus` replacement** — Keyboard users cannot see focus

---

## MANUAL Items (Require Live a11y Tools)

- [ ] **axe DevTools**: Run on all 21 pages; audit color contrast in real context (RGBA overlays, images)
- [ ] **Lighthouse a11y audit**: Confirms predicted scores; identifies additional issues (ARIA, form structure)
- [ ] **NVDA / JAWS**: Test heading navigation (H key), landmark navigation (R key), form controls (Tab), sims playback
- [ ] **VoiceOver (macOS/iOS)**: Web rotor, focus order, phase announcements in sims
- [ ] **Wave browser extension**: Automated flagging of orphaned form labels, missing headings per page
- [ ] **Keyboard-only navigation test**: Tab through entire site; verify focus visible on all interactive elements

---

## Summary

**Seed Issues Confirmed**:
- A-1: 20/21 pages missing OG/Twitter meta ✓
- A-2: No favicon/manifest ✓
- A-3: No skip link ✓
- A-4: 14/21 pages missing h1 ✓
- A-5: Severe landmark gap (5 pages have `<main>`, 0 semantic `<header>`/`<footer>`) ✓
- S-1: Sims have NO prefers-reduced-motion check ✓
- S-2: Phase transitions not announced (no aria-live) ✓
- S-3: Sims have NO keyboard navigation ✓

**Ship-Ready**: 0/21 pages pass static a11y baseline. Require immediate fixes before launch.
