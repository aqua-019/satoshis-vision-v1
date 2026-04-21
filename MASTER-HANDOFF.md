# xmr.irish v4.0 — Master Handoff Document
## Executive Index + Global Context for Claude Code
## Last updated: April 2026

---

## REPO & DEPLOYMENT

```
GitHub:        github.com/aqua-019/satoshis-vision-v1  (public, auto-deploy)
Live site:     https://xmr.irish
Vercel team:   aquatic-17b9f112
Vercel project: prj_xs4rLItZCzfgnJwke5sU4Hbf435h
Deploy:        git push origin main → auto-deploy
Stack:         Static HTML + vanilla JS + CSS custom properties (no framework)
```

---

## MODEL RECOMMENDATION

| Task | Recommended Model | Reason |
|------|-------------------|--------|
| HANDOFF-01 (infra) | Sonnet 4.6 | Config edits, one-liners |
| HANDOFF-02 (mining rebuild) | **Opus 4.5+** | Ground-up HTML, 8 complex sections, Canvas charts |
| HANDOFF-03 (hold-monero) | **Opus 4.5+** | Content restoration + new suppression visualization |
| HANDOFF-04 (legal fixes) | Sonnet 4.6 | Three surgical changes |
| HANDOFF-05 (bottom-line typography) | **Opus 4.5+** | 2765-line file, preserve every word exactly |
| HANDOFF-06 (typography batch) | Sonnet 4.6 | Pattern established, apply consistently |
| HANDOFF-07 (ecosystem) | Sonnet 4.6 | Tier system on existing content |
| HANDOFF-08 (trust system) | Sonnet 4.6 | Add citation component + apply sitewide |
| HANDOFF-09 (homepage SEO) | Sonnet 4.6 | Static fallbacks + path cards |
| HANDOFF-10 (Mempool 3.0) | **Opus 4.5+** | Complex multi-mode visualization architecture |

---

## EXECUTION ORDER (dependencies matter)

```
PHASE A — Infrastructure (do first, unblocks everything)
  └─ HANDOFF-01: vercel.json, cleanUrls, CSP, no-referrer audit

PHASE B — Critical page rebuilds (highest user impact)
  ├─ HANDOFF-02: mining.html — ground-up rebuild
  ├─ HANDOFF-03: hold-monero.html — content restoration + ChangeNOW
  └─ HANDOFF-04: legal.html — three surgical fixes

PHASE C — Typography overhauls (pattern-based, can batch)
  ├─ HANDOFF-05: bottom-line.html — preserve every word, replace all styling
  └─ HANDOFF-06: timeline + quotes + secrets + btc-xmr-education

PHASE D — Content enhancements
  ├─ HANDOFF-07: ecosystem.html — tier system
  ├─ HANDOFF-08: sitewide trust + citation system
  └─ HANDOFF-09: homepage SEO + user path architecture

PHASE E — Major new feature
  └─ HANDOFF-10: Mempool 3.0 — full architecture rebuild
```

---

## d10 DESIGN SYSTEM — COMPLETE REFERENCE

Every page Claude Code writes must use these exact tokens. No exceptions.

### Typography
```css
/* Primary: JetBrains Mono — self-hosted, already in /fonts/ */
font-family: 'JetBrains Mono', 'DM Mono', monospace;

/* Accent headlines only (not body): */
font-family: 'Playfair Display', serif;

/* Scale */
--text-eyebrow:  9px uppercase letter-spacing: 0.12em   /* section labels */
--text-caption:  11px                                    /* metadata */
--text-body:     13px                                    /* body copy */
--text-label:    13px font-weight: 500                   /* labels */
--text-title:    28–32px                                 /* page titles */
--text-hero:     36–48px                                 /* hero numbers */
```

### Color Tokens (from d10.css)
```css
--xmr:        #FF6600   /* Monero orange, primary brand */
--xmr-text:   #FF8533   /* Lighter orange for text on dark bg */
--grn:        #00CC88   /* Success green, links, active states */
--blue:       #4488FF   /* Info, charts, secondary accents */
--gold:       #FFD700   /* Warning, gray-zone states */
--red:        #FF4444   /* Error, restricted states */
--surface-0:  #0A0A0A   /* Page background */
--surface-1:  #111111   /* Card background */
--surface-2:  #1A1A1A   /* Elevated card */
--surface-3:  #222222   /* Input background */
--border-default: rgba(255,255,255,0.08)
--border-active:  rgba(255,255,255,0.15)
--text-primary:   #F0F0F0
--text-secondary: #888888
--text-muted:     #555555
```

### Layout Tokens
```css
--space-page-x: clamp(16px, 4vw, 40px)   /* horizontal page padding */
--space-section: 48px                      /* between sections */
--space-card: 24px                         /* card internal padding */
--radius-card: 10px                        /* card border-radius */
--radius-sm: 6px                           /* small element radius */
```

### Sub-nav Pattern (required on every page)
```html
<nav class="sub-nav">
  <a href="/" class="sub-nav-home">xmr.irish</a>
  <span class="sub-nav-sep">/</span>
  <span class="sub-nav-current">page-name</span>
  <div class="sub-nav-links">
    <a href="/markets.html">Markets</a>
    <a href="/network.html">Network</a>
    <a href="/mining.html">Mining</a>
    <a href="/mempool.html">Mempool</a>
  </div>
</nav>
```

### Hero Pattern (required on rebuilt pages)
```html
<div class="page-hero">
  <div class="hero-eyebrow">CATEGORY · SUBCATEGORY</div>
  <h1 class="hero-title">Page <em>Title</em></h1>
  <p class="hero-subtitle">12–13px italic description of what this page does.</p>
</div>
```

### Card Pattern
```html
<div class="card">
  <div class="card-label">LABEL</div>
  <div class="card-value">Value</div>
  <div class="card-sub">supporting text</div>
</div>
```

### Section Pattern
```html
<section class="page-section">
  <div class="section-header">
    <div class="section-eyebrow">SECTION 01 / CATEGORY</div>
    <h2 class="section-title">Section Title</h2>
  </div>
  <!-- content -->
</section>
```

### Chart Requirements
- All charts: Canvas 2D, self-hosted, NO TradingView, NO external chart embeds
- Annotations required: high/low/avg/change markers
- Color: use --xmr, --grn, --blue, --gold from token system
- ARIA: every canvas needs `role="img"` + `aria-label`

### Required Meta (every page)
```html
<meta name="referrer" content="no-referrer">
<link rel="stylesheet" href="/css/d10.css">
<!-- NO Google Fonts CDN links -->
<!-- NO genui debug bars -->
<!-- NO TradingView scripts -->
```

---

## WHAT "REBUILT" LOOKS LIKE

Reference pages to match: `markets.html`, `network.html`, `future-outlook.html`

These pages have:
- JetBrains Mono throughout
- Sub-nav breadcrumb at top
- Hero section with eyebrow → title → subtitle
- Sections with eyebrow labels (SECTION 01 / OVERVIEW)
- Cards with consistent sizing
- Self-hosted Canvas charts with annotations
- No inline styles (all styling via d10.css classes + CSS vars)
- Monospace data display (`font-family: var(--font-mono)`)
- Orange emphasis with `var(--xmr-text)` color

---

## WHAT IS BROKEN (and why)

Pages that got `d09.css → d10.css` in the `<link>` tag but have ALL typography in **inline styles** that override the CSS file. The CSS swap did nothing because:

```html
<!-- This is what the broken pages look like: -->
<h1 style="font-family: 'Playfair Display'; font-size: 3rem; color: #FFA500;">
  The Case
</h1>
<!-- The inline style wins over d10.css every time. -->
```

Fix: strip ALL inline styles from typography. Use d10.css classes. Keep content verbatim.

---

## SITEWIDE RULES (non-negotiable)

1. **No content loss** — every word, every data point, every statistic must survive any rebuild
2. **No Google Fonts CDN** — all fonts must be self-hosted from `/fonts/`
3. **No TradingView** — self-hosted Canvas charts only
4. **No genui debug bars** — old `genui-bar` elements get removed
5. **No third-party analytics or tracking scripts**
6. **`<meta name="referrer" content="no-referrer">` on every page**
7. **All charts need annotations** (high/low/avg/change) — not just blank lines
8. **Mobile responsive** — test at 375px, 768px, 1440px
9. **`prefers-reduced-motion`** — all animations must respect this

---

## DEFINITION OF DONE (per page)

A page is complete when:
- [ ] Loads d10.css (no d09 reference)
- [ ] No inline `style="font-family: Playfair..."` or old serif fonts
- [ ] Has sub-nav breadcrumb
- [ ] Has hero section (eyebrow → title → subtitle)
- [ ] All original content preserved verbatim
- [ ] No genui-bar in DOM
- [ ] `<meta name="referrer" content="no-referrer">` present
- [ ] All links work
- [ ] Responsive at 375px minimum
- [ ] git commit + push → verify on xmr.irish

---

## HANDOFF INDEX

| File | Task | Priority | Est. Time |
|------|------|----------|-----------|
| HANDOFF-01-INFRA.md | vercel.json + route fixes | 🔴 FIRST | 30min |
| HANDOFF-02-MINING.md | mining.html ground-up rebuild | 🔴 HIGH | 3h |
| HANDOFF-03-HOLD-MONERO.md | hold-monero content + ChangeNOW | 🔴 HIGH | 2h |
| HANDOFF-04-LEGAL.md | 3 surgical legal.html fixes | 🟡 MED | 45min |
| HANDOFF-05-BOTTOM-LINE.md | bottom-line typography overhaul | 🔴 HIGH | 2h |
| HANDOFF-06-TYPOGRAPHY-BATCH.md | timeline+quotes+secrets+btc-xmr | 🟡 MED | 3h |
| HANDOFF-07-ECOSYSTEM.md | ecosystem tier system | 🟢 LOW | 1h |
| HANDOFF-08-TRUST-SYSTEM.md | citation component + sitewide | 🟡 MED | 2h |
| HANDOFF-09-HOMEPAGE-SEO.md | homepage SEO + user paths | 🟡 MED | 2h |
| HANDOFF-10-MEMPOOL-3.md | Mempool 3.0 full architecture | 🔴 HIGH | 6h |
