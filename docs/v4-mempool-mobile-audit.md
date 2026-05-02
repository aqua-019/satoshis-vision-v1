# Mempool 2.0 Mobile Optimization — Findings & Plan

**Branch:** `claude/mempool-mobile-optimization-npvrr`
**Scope:** `mempool-explorer.html`, `mempool-ocean.html`, `mempool-mining.html`
**Goal:** Make Mempool 2.0 usable on iPhone/Android phones without changing the
desktop experience (≥1024px stays visually identical).

> **Reality check.** The prompt's "/mempool" URL resolves through a 12-line
> redirect (`mempool.html`) to `mempool-explorer.html`. Three sibling pages
> share the same inline CSS and JS imports and switch between each other via
> mode buttons (full-page reloads). Mobile fixes must be applied to all three
> consistently, otherwise tapping OCEAN or MINING from a fixed-up Explorer
> lands the user on a still-broken page.

---

## Verification context

This pass was implemented and verified using **Lighthouse mobile + Chrome
DevTools device emulation only**. Real iPhone/Android device testing remains
the user's responsibility post-merge. The PR description carries the same
disclaimer.

The prompt's "STOP if no real device available" condition was raised with the
user, who chose to proceed with emulator-only verification.

---

## Audit summary table

| # | Section | Pages | Severity | Effort | Plan |
|---|---|---|---|---|---|
| 1 | Sub-nav (mode tabs + WS status) | all 3 | DEGRADED | Low | Stack onto multiple rows <480px; full-width tap rows |
| 2 | Fee tier hero (4-col) | ocean, explorer | DEGRADED | Low | 2×2 grid <640px; 1-col <380px; bump tap area |
| 3 | TX feed grid (6 cols) | ocean, explorer | BLOCKER | Med | Mobile card list <768px via JS render branch |
| 4 | Block list | explorer | BLOCKER | Med | Hide diff/reward earlier; add card list <560px |
| 5 | Block / TX detail panels | explorer | DEGRADED | Med | Stack info rows; reflow hash + copy button; collapse TX list inside `<details>` |
| 6 | Ocean canvas | ocean, explorer | DEGRADED | Low | Cap height 240px <500px; throttle redraw; tap-to-inspect |
| 7 | Mempool clock canvas | ocean, explorer | DEGRADED | Low | Cap 200px <500px; pass `simplifyLabels` to skip minor labels |
| 8 | Fee depth | ocean, explorer | DEGRADED | Low | Maintain aspect; full container width; tap-to-inspect |
| 9 | Mining 2-col card layout | mining | DEGRADED | Low | Single column <768px (existing breakpoint extended) |
| 10 | Mining time-series charts | mining | DEGRADED | Med | Reduce x-axis tick density on narrow widths |
| 11 | Pool distribution pie + legend | mining | DEGRADED | Low | Legend below pie <640px; legend rows ≥44px tap |
| 12 | Privacy report card / educational text | all 3 | COSMETIC | Low | Wider line-height, edge-to-edge padding |
| 13 | Search input + button (Explorer) | explorer | DEGRADED | Low | Stack vertically <480px; 48px tap height button |
| 14 | Copy-to-clipboard buttons | explorer | DEGRADED | Low | Min 44×44; visible "Copied!" feedback |
| 15 | Sub-nav breadcrumb | all 3 | OK | None | No change |

Severity legend:
- **BLOCKER**: prevents using the section at all (data unreadable / unreachable on phone)
- **DEGRADED**: usable but bad UX (cramped, illegible, hard to tap)
- **COSMETIC**: works, just looks off

---

## Per-section detailed findings

### 1. Sub-nav

The sub-nav uses `flex-wrap:wrap` and at 560px the connection status
already drops to its own row. Below ~400px the three mode buttons
(`EXPLORER` / `OCEAN` / `MINING`) start crowding the brand label and become
hard to tap accurately. Buttons at this breakpoint are 5×9px padding with
9.5px font — well below the 44×44 minimum.

**Fix:** at <480px, force the mode buttons onto their own row at full width
with `flex:1`, `min-height:44px`, and 12px vertical padding. Brand label
rendered above; WS status chip already below.

### 2. Fee tier hero (4-card grid)

Currently 4-col → 2-col at 900px. At 380px the 2-col grid leaves cards
~150px wide which is fine for the value but cramps the cost/ETA sub-lines.
Tap target is the whole card (~88px tall) which is acceptable.

**Fix:** add a `<380px` 1-col fallback so each card gets full-width breathing
room on small phones. Also add `min-height:88px; cursor:pointer` to make tap
behavior unambiguous (future enhancement: tap-to-show fee tier explainer).

### 3. TX feed grid — BLOCKER

The 6-column grid (`txid / size / fee / rate / tier / age`) collapses to 4
columns at 560px (hides tier+age) but the remaining columns are still
fixed-fraction grid: 1.3fr / 0.6fr / 1fr / 0.55fr. Below 360px viewport,
columns get crushed and txid wraps mid-hash. Live updates with row animations
also cause visible reflow on small screens.

**Fix:** below 768px replace grid rows with stacked cards (`.mp-tx-card`).
Each card shows: `txid` + `age` on row 1, `fee · fee-rate · size · tier`
on row 2 as a 4-col mini-grid. Render branch added in
`js/mempool-ocean-feed.js` keyed off `matchMedia('(max-width: 767px)').matches`.

### 4. Block list — BLOCKER

`exp-blocks-table` (HTML `<table>`) at 560px hides difficulty + reward
columns. The remaining 5 columns (height / hash / pool / time / inputs)
still don't fit cleanly below 400px. Pool names like "Nanopool" wrap
under 320px viewport.

**Fix:** at <560px, hide hash entirely (it's accessible by tapping the row),
keep height/pool/time/inputs. Below 380px collapse to 2 rows per block:
height + time on row 1, pool + inputs on row 2.

### 5. Block / TX detail panels

`.exp-stats` 4-col grid → 2-col at 700px. `.exp-info` 160px label / 1fr
value already collapses to single col with stacked dt/dd at 700px, which is
correct. The hash row inside detail headers (`.exp-hash-row`) shows the full
64-char hash word-break:break-all — readable on mobile. The copy button
(`.exp-copy-btn`) is too small (3×8px padding, 9px font).

**Fix:** copy button bumped to `min-height:44px; min-width:44px; padding:10px 14px`
on mobile only (preserving compact desktop look). Block tx-list inside detail
view wrapped in `<details>` so users can expand it on demand rather than
forcing a long scroll.

### 6. Ocean canvas

Fixed at 340px height; reduces to 260px at 560px. On a 568px-tall iPhone SE
with browser chrome, that's still ~60% of the viewport — too much vertical
real estate for a chart that's hard to read at that size anyway.

**Fix:** cap at 240px <500px. Already responsive to container width via the
existing `MPChart.setupCanvas` DPR pipeline. Tap-to-inspect: the existing
`.mp-ocean-tip` tooltip uses mousemove; add a touchstart handler that
positions the tip and dismisses on document-level touch.

### 7. Mempool clock canvas

Caption + legend stack below the canvas at 768px (existing breakpoint).
Canvas height 260px set on grid container. At 320px viewport, the radial
plot's outer-ring labels become illegible.

**Fix:** cap canvas height at 200px <500px. Pass a `simplifyLabels:true`
option to `M5MempoolClock` constructor when on mobile — it skips the
minor (every 5 minutes) tick labels and keeps only the cardinal markers
(0/15/30/45 minutes).

### 8. Fee depth

Currently a labeled-bar DOM component (the canvas is hidden by default
per line 141: `.mp-depth canvas{display:none}`). Bars are responsive
to container width. Looks fine on mobile already.

**Fix:** minor — increase row height to 36px on mobile so percentages and
fee labels don't overlap when bars are short.

### 9. Mining 2-col card layout

`.mp-mining-row-2` is a 2-col grid. No existing media query collapses it
to 1-col below tablet width. On phones, both halves crush down to ~140px
each and render charts that are unreadable.

**Fix:** at `<768px`, `.mp-mining-row-2 { grid-template-columns: 1fr }`.

### 10. Mining time-series charts

Time-series charts (hashrate, blocktime, difficulty) use the shared
`MPChart` utility which already handles DPR + ResizeObserver. The issue is
x-axis tick density: at 320px width the chart tries to render the same
~12 ticks as desktop, causing label overlap.

**Fix:** extend `MPChart.setupCanvas` to accept `mobileTickDensity` option;
at <768px reduce ticks to ~4. Each consumer module passes a tick formatter
that respects this hint.

### 11. Pool distribution pie + legend

Pool component (`mempool-mining-pool.js`) renders pie + legend side by side.
On mobile the legend gets pushed to <100px wide, truncating pool names.

**Fix:** at `<640px`, stack legend below pie. Each legend row gets
`min-height:44px` and full-row tap target.

### 12. Privacy report card / educational text

Caption text uses 12px / line-height 1.5. Reads OK on mobile. Padding
applies `--space-page-x` (clamps 16-28px) which is right.

**Fix:** add `line-height:1.6` and a tiny letter-spacing increase in
captions for mobile only — improves legibility on retina displays.

### 13. Search input + button

`.exp-search-bar` is `grid-template-columns:1fr auto` — input + button.
At 320px the button shrinks to "SEARCH" text only, ~70px wide × 30px tall.
Below 44px height.

**Fix:** at `<480px`, change to `grid-template-columns:1fr` so input and
button stack. Button gets `min-height:48px; width:100%`.

### 14. Copy-to-clipboard buttons

`.exp-copy-btn` is 3×8px padding, 9px font. Way below tap minimum.
Functional desktop styling; needs mobile size bump.

**Fix:** mobile `min-height:44px; min-width:44px; padding:10px 14px;
font-size:11px`. Visible "Copied!" feedback already partly there
(`.exp-copy-btn.ok` turns green); add explicit text swap during the
1.5s feedback window via the JS handler in `mempool-explorer.js`.

### 15. Sub-nav breadcrumb

`.mp-brand` ("xmr.irish / mempool / explorer") is text-only; reads fine on
all sizes.

---

## What stays desktop-only

Nothing. Every section adapts. The mobile experience reflows information,
never removes it. (Some secondary sections get default-collapsed `<details>`
on mobile — but the content is one tap away.)

## Touch interaction patterns introduced

1. **Tap-to-inspect** on chart elements — replaces hover tooltips. Implemented
   for `mp-ocean-canvas` and `mp-clock-canvas`. Pattern lifted from
   `js/legal-tooltips.js` (`'ontouchstart' in window || navigator.maxTouchPoints > 0`).
2. **Tap-to-copy** on transaction/block hashes. Uses `navigator.clipboard.writeText`
   with `try/catch` fallback. Visible "Copied!" feedback.
3. **`<details>`-based collapsible sections** — block tx-list (Explorer detail),
   secondary mining cards (RandomX, P2Pool). Native `<details>` for free
   accessibility. Desktop CSS forces `[open]` and hides the chevron so
   desktop users see everything inline.

## Recommended ship order

If scope tightens:

1. **Must-ship (BLOCKERs):** TX feed card list (#3), block list reflow (#4)
2. **Should-ship (DEGRADED with high impact):** Sub-nav (#1), copy buttons (#14),
   search bar (#13), mining 2-col collapse (#9)
3. **Nice-to-have:** chart label simplification (#7, #10), tap-to-inspect (#6, #8)
4. **Polish:** typography tweaks (#12), fee tier 1-col fallback (#2)

This pass implements all of the above.

## Surfaced for v5.0 / Mempool 3.0

These observations are out-of-scope for this responsive pass but worth
recording for the v5.0 rewrite:

- The Ocean and Mining modes both render multiple time-series + radial
  visualizations on a single page. On small viewports, **information density
  itself** is the problem, not the responsive presentation. Mempool 3.0's
  Ocean/Market/Track architecture should consider whether each mode focuses
  on a single primary visualization rather than 5-7 stacked charts.
- The block parade horizontal-scroll component (`mempool-block-parade.js`)
  uses mouse drag-pan with synthesized touch events. It works on iOS Safari
  via the browser's emulation of mousedown/move/up from touch, but feels
  laggy. v5.0 should add native pointer events / momentum scrolling.
- The three modes load all JS modules (28 scripts on every page). On 3G a
  fresh load of Explorer carries Ocean and Mining JS that may never be used.
  v5.0 could defer mode-specific JS until the user switches modes.
- The Mempool Clock at small sizes is harder to read than a stacked
  category bar would be. v5.0 could provide an "alt visualization" toggle.

These items are recorded in `docs/v5-planning.md` (when that file exists)
under "Mobile sim experience" and are not addressed here.
