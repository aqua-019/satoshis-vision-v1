# Section 2: Mobile QA — Phase 6 Pre-launch Audit
**xmr.irish static site — 17-page readiness review**

---

## Summary: Mobile Readiness by Page

| Page | Viewport Meta | Fixed Widths | @Media Queries | Risk Score | Notes |
|------|:---:|:---:|:---:|:---:|---|
| index.html | ✓ | None | 4 | LOW | Good coverage; nav search responsive. |
| protocol-simulations.html | ✓ | None | 0 | **HIGH** | No media queries; flex canvas container may not reflow <600px. |
| fcmp.html | ✓ | 880px max (has override) | 1 | LOW | @media 680px handles timeline reflow. |
| privacy-architecture.html | ✓ | None | 1 | LOW | Lightweight layout; single breakpoint sufficient. |
| bottom-line.html | ✓ | 1200px max (NO override) | 1 | **MED** | main max-width:1200px never resets; @media only handles flexbox. |
| btc-xmr-education.html | ✓ | 800px/1200px (both have overrides) | 2 | LOW | Proper @media 768px resets content-narrow/wide. |
| hold-monero.html | ✓ | Grid layout (has override) | 4 | LOW | Swap iframe width:100%; @media 900px/640px cover reflow. |
| markets.html | ✓ | None | 1 | LOW | Straightforward layout. |
| network.html | ✓ | None | 1 | LOW | Responsive grid. |
| timeline.html | ✓ | None | 0 | **MED** | No media queries; needs verification on <640px. |
| secrets.html | ✓ | None | 0 | **MED** | No media queries; text-heavy — needs manual check. |
| quotes.html | ✓ | None | 0 | **MED** | No media queries; may have layout stacking issues. |
| mining.html | ✓ | None | 3 | LOW | Multiple responsive breakpoints. |
| ecosystem.html | ✓ | None | 1 | LOW | Single query covers mobile reflow. |
| community.html | ✓ | None | 1 | LOW | Simple structure. |
| legal.html | ✓ | None | 3 | LOW | Three breakpoints; good coverage. |
| future-outlook.html | ✓ | None | 1 | LOW | Minimal responsive needs. |

---

## 1. Viewport Meta Tag Audit

**Status: PASS (All 17 pages)**

Every page includes the correct viewport meta tag:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

No issues identified.

---

## 2. Fixed-Width Content Risk Analysis

**Hardcoded widths found:**

- **btc-xmr-education.html**
  - `.cta-glow { width: 800px; }` — *decorative element; `pointer-events: none`, not content*
  - `.content-narrow { max-width: 800px; }` — *has `@media (max-width: 768px)` override*
  - `.content-wide { max-width: 1200px; }` — *has `@media (max-width: 768px)` override*
  
- **bottom-line.html** (⚠️ POTENTIAL RISK)
  - `main { max-width: 1200px; margin: 0 auto; padding: 8px var(--space-page-x) 24px; }`
  - **Issue:** 1200px max-width has NO corresponding `@media` query to reset/reflow on narrow screens.
  - **Mitigation:** Padding uses `var(--space-page-x)` (clamp(16px, 3vw, 28px)), which scales down. Horizontal overflow is unlikely unless content inside main exceeds max-width.

- **fcmp.html**
  - `.fp-hero, .fp-section` — all use `max-width: 880px` with `margin: 0 auto`
  - **Has:** `@media (max-width: 680px)` resets grid layout; content stays readable.

- **hold-monero.html**
  - `.swap-layout { grid-template-columns: 1fr 1fr; }` defaults to two-column
  - **Has:** `@media (max-width: 900px)` collapses to single column; `@media (max-width: 640px)` further adjusts footer.

**No tables or pre blocks wider than 400px without overflow wrappers found.**

---

## 3. Horizontal Scroll & Overflow Risk

**Findings:**

- **Tables:** Only `mining.html` (2) and `bottom-line.html` (1) contain tables.
  - bottom-line.html table: `.comparison-table { width: 100%; }` — full-width with `overflow: hidden` on parent. Safe.
  - mining.html tables: embedded in `mempool-mining.html`, not in scope.

- **Code blocks / `<pre>`:** Only `fcmp.html` (1) and `network.html` (1) have `<code>` elements.
  - Both styled with `word-break: break-all` — safe on mobile.

- **Large SVGs / Iframes:** 
  - hold-monero.html ChangeNOW iframe: `width: 100%; height: 420px;` — responsive width but fixed height.

---

## 4. Touch Target Sizes

**Analysis:**

Buttons and links across the site use:
- Font sizes: `9px–17px` (mostly 10–13px)
- Padding: `6px–22px` vertically; `10px–16px` horizontally

Most link and button targets compute to 30–45px in height (font + padding). Many fall in the marginal zone (30–40px), requiring real-device verification.

**No `<input type="submit">` elements found with problematic inline sizing.**

**MANUAL verification required** for tap-target adequacy on 300–375px viewports.

---

## 5. Responsive Iframe: hold-monero.html ChangeNOW Widget

**Structure:**
```html
<div class="swap-iframe-wrap">
  <iframe id="changenow-widget" 
    src="https://changenow.io/embeds/exchange-widget/v2/widget.html?..."
    width="100%" min-height="420px" height="420px">
  </iframe>
</div>
```

**CSS:**
```css
.swap-iframe-wrap {
  border-radius: 8px; overflow: hidden; min-height: 420px;
}
.swap-iframe-wrap iframe {
  width: 100%;
  min-height: 420px;
  height: 420px;
}
```

**Assessment:**
- ✓ Width scales to viewport (100%)
- ⚠️ Height is fixed at 420px — reasonable default for desktop; verify on landscape <400px viewports to ensure no vertical scroll within iframe.
- ✓ Has `@media (max-width: 640px)` adjusting outer swap-layout layout.

**MANUAL CHECK:** Test ChangeNOW widget height on iPhone SE (375w) in landscape.

---

## 6. Simulation Canvas: Resize Behavior & Viewport Support

**Files analyzed:** `js/genui/engine.js`, `js/genui/renderer-svg.js`

### Key Findings:

1. **SVG Renderer Initialization (renderer-svg.js:30–32)**
   ```javascript
   const { width, height } = this.canvas.getBoundingClientRect();
   this.viewWidth = Math.max(800, width);
   this.viewHeight = Math.max(400, height);
   ```
   - **Issue:** Enforces minimum 800px viewWidth. On a 360px mobile screen, internal viewport scales to 800px, forcing horizontal scroll or shrinking.
   - **Impact:** Simulation canvas may overflow at viewport <360px.

2. **No Window Resize Listener**
   - No `window.addEventListener('resize', ...)` found in engine.js or renderer-svg.js.
   - Canvas dimensions are set at initialization only.
   - **Risk:** Orientation change (portrait ↔ landscape) will not trigger canvas reflow.

3. **Fallback Architecture:**
   - WebGL available → uses WebGLRenderer (not examined, not in scope)
   - WebGL unavailable → falls back to SVGRenderer with hardcoded aspect-ratio viewBox

4. **protocol-simulations.html Canvas Container:**
   - `<div class="genui-canvas-container">` has no explicit width/height constraints in d10.css
   - Uses `flex-shrink: 1` implicitly — should respect parent width
   - **Risk:** If parent is constrained by outer layout, canvas getBoundingClientRect() may read a width <800px, then Math.max(800, ...) forces expansion.

### Static Ship-Blocker Assessment:

**Not a blocker.** The 800px minimum is problematic for very small viewports but:
- Simulations are educational add-ons, not core content.
- Fallback (SVG) is readable at small viewports despite the constraint.
- Requires MANUAL real-device testing to confirm acceptable UX.

---

## 7. Media Query Coverage Summary

| Count | Pages | Risk |
|:---:|---|---|
| 0 queries | protocol-simulations, timeline, secrets, quotes | **HIGH** — no responsive adaptation |
| 1 query | fcmp, privacy-architecture, bottom-line, markets, network, ecosystem, community, future-outlook | **MED** — single breakpoint may miss intermediate sizes |
| 2+ queries | index (4), hold-monero (4), btc-xmr-education (2), mining (3), legal (3) | **LOW** — tiered responsive design |

**Pages with 0 media queries:**
- protocol-simulations.html — layout relies on flexbox + width:100%; canvas container expansion is a concern.
- timeline.html — text-heavy, no obvious layout issues, but needs manual check.
- secrets.html — text-heavy, no obvious layout issues.
- quotes.html — quote cards, no media queries; layout behavior on <375px needs verification.

---

## 8. Long-Form Text Overflow

**Audit:**
- `.swap-txid { word-break: break-all; }` — txids/hashes wrap on mobile. ✓
- `.fp-sources li { word-break: break-all; }` — source URLs wrap. ✓
- fcmp.html displays hex strings with monospace font; no overflow-x detected. ✓

**No issues identified.**

---

## Manual Items (Real-Device QA Required)

1. **Simulation canvas reflow on orientation change** — protocol-simulations.html may not resize when switching portrait ↔ landscape. Verify SVG canvas updates dimensions.

2. **Touch target adequacy on 320–375px viewports** — buttons/links compute to 30–40px height; measure actual tap target areas on iPhone SE.

3. **ChangeNOW iframe behavior on landscape <400px** — 420px fixed height may cause nested scrolling; test on iPad mini in landscape.

4. **Pages with 0 media queries on narrow viewports:**
   - timeline.html: Verify timeline layout (grid-template-columns) on <375px.
   - secrets.html: Verify paragraph line-length doesn't exceed readable width on narrow screens.
   - quotes.html: Verify quote-card width on <360px; check spacing between cards.

5. **Bottom-line.html comparison table** — 1200px max-width with minimal mobile override; test table `<td>` wrapping on 320px.

6. **Canvas min-height enforcement** — Hold-Monero suppress-canvas (180px height) and ChangeNOW widget (420px height) — verify vertical scroll doesn't appear on small landscapes.

---

## Static Ship-Blockers

**Status: No blockers identified.**

- All 17 pages have correct viewport meta tag.
- No absolutely-positioned fixed-width blocks that overflow without override.
- btc-xmr-education.html and hold-monero.html have proper media queries for their max-width constraints.
- bottom-line.html's 1200px max-width lacks explicit media-query reset but uses responsive padding; unlikely to break.

**Recommendation:** Proceed to Phase 6 real-device QA. Flag the 4 pages without media queries (protocol-simulations, timeline, secrets, quotes) for manual verification on narrow viewports.

---

**Audit completed:** 2026-05-02 | Static analysis only | 1,420 words
