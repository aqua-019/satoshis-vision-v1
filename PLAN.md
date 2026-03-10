# Satoshi's Vision v1 — Upgrade Plan

## Current State Analysis

### Architecture
- **7 standalone HTML files** with ALL CSS and JS inlined in every page
- Zero code reuse — navigation, CSS variables, resets, fonts, and responsive styles are copy-pasted across every file
- Total combined size: ~420KB of HTML (massive for a static site)
- No build system, no shared stylesheets, no shared JavaScript

### Pages
| File | Title | Size |
|------|-------|------|
| `index.html` | The Privacy Evolution: Bitcoin → Monero (homepage) | 77KB |
| `bottom-line.html` | The Bottom Line - Bitcoin TradFi vs Monero Privacy | 121KB |
| `btc-xmr-education.html` | The Genesis of Privacy - Bitcoin & Monero Education | 84KB |
| `hold-monero.html` | Hold Monero - Acquire XMR Privately | 57KB |
| `quotes.html` | Satoshi Quote Archive | 29KB |
| `secrets.html` | The Secret Threads — Satoshi's Privacy Vision | 26KB |
| `timeline.html` | Interactive Timeline — Bitcoin to Monero | 28KB |

### Security Audit Findings
1. **Good**: X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy headers in vercel.json
2. **Missing**: Content-Security-Policy (CSP) header — critical for XSS protection
3. **Missing**: Strict-Transport-Security (HSTS) header
4. **Risk**: Inline `<style>` and `<script>` blocks in every page would conflict with strict CSP — needs extraction to external files
5. **Good**: No user input handling, no forms, no backend — low attack surface
6. **Good**: No third-party JS loaded (only Google Fonts)
7. **Note**: `X-XSS-Protection: 1; mode=block` is deprecated in modern browsers — CSP is the replacement

### Mobile Responsiveness Findings
1. **Inconsistent**: `index.html` has NO hamburger menu or mobile nav — nav links just overflow/hide on small screens
2. **Inconsistent**: Other pages have hamburger menus but implementations vary (different class names, different behaviors)
3. **Missing**: No touch-friendly tap targets in many places
4. **Missing**: No safe-area-inset handling for iPhone notch/dynamic island
5. **Missing**: No prefers-reduced-motion support
6. **Partial**: Some pages use `clamp()` for font sizing (good), others use fixed sizes

---

## Upgrade Plan

### Phase 1: Architecture Refactor — Extract Shared Code

**Create shared external files:**
- `css/variables.css` — CSS custom properties, color palette, typography
- `css/reset.css` — Box-sizing, margin reset, base styles
- `css/nav.css` — Navigation styles (desktop + mobile)
- `css/layout.css` — Common layout patterns (hero, sections, cards, grids)
- `css/components.css` — Buttons, badges, tags, tooltips, blockquotes
- `css/responsive.css` — All media queries and mobile-first overrides
- `js/nav.js` — Hamburger menu toggle, scroll behavior, active page highlighting
- `js/animations.js` — IntersectionObserver scroll animations (shared)

**Result**: Each HTML page drops from 50-120KB to ~15-40KB, linking shared assets.

### Phase 2: Unified Navigation & Mobile Menu

**Standardize across all 7 pages:**
- Consistent hamburger menu with smooth slide-in animation
- Active page indicator
- Touch-friendly tap targets (min 44x44px per Apple HIG)
- Safe-area-inset padding for iPhone notch/dynamic island
- Backdrop blur overlay on mobile menu open
- Close on outside tap and Escape key

### Phase 3: Mobile Optimization (iPhone + Android)

- Full responsive audit at breakpoints: 320px, 375px, 414px, 768px, 1024px, 1440px
- `viewport-fit=cover` + `env(safe-area-inset-*)` for edge-to-edge iPhone displays
- Font size floor of 16px on inputs (prevents iOS zoom)
- Touch scroll improvements (`-webkit-overflow-scrolling: touch`)
- `prefers-reduced-motion` media query for accessibility
- `prefers-color-scheme` detection (future-proof)
- Grid/flex layout fixes for narrow screens
- Image/card stacking on mobile
- Horizontal scroll prevention on all pages

### Phase 4: Visual Layout Upgrades

- Consistent spacing system using CSS custom properties
- Improved card designs with subtle hover states
- Better visual hierarchy with section dividers
- Enhanced hero sections with animated gradient backgrounds
- Consistent footer across all pages with site map and links
- Typography scale refinement
- Improved blockquote/citation styling for quotes page
- Better table/comparison layouts on bottom-line page

### Phase 5: New Sections & Content Enhancements

- **Site-wide footer** with navigation, resources, and disclaimer
- **"Why Privacy Matters"** introductory section on homepage
- **FAQ section** on education page
- **Glossary/terminology** section for newcomers
- **Resource links** section (books, videos, tools)
- Enhanced meta tags (Open Graph, Twitter Card) for social sharing

### Phase 6: Security Hardening

- Add Content-Security-Policy header (allowing Google Fonts + external stylesheets)
- Add Strict-Transport-Security header
- Move all inline styles to external CSS files (CSP compatibility)
- Move all inline scripts to external JS files (CSP compatibility)
- Add `integrity` attributes where applicable (SRI)
- Update vercel.json and netlify.toml with new headers
