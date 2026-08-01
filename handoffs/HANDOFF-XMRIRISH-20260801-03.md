---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260801-03
branch: claude/theme-system-v612-a5c0ph
status: in_progress            # open -> in_progress -> done | blocked
written_by: claude-code (manual mode — prompt-driven, no cowork handoff)
owner: claude-code
---

# HANDOFF — v6.1.2 Theme system: classic default, three themes

## 1 · GOAL

`classic` is the default theme and three themes ship (Classic · Phosphor · Indigo),
selected from a control on the Main Home page whose choice is read before first paint.
Underneath that, every colour on a chrome or live surface resolves through a **semantic
role token** rather than a literal, the cascade is ordered by an explicit `@layer`
declaration instead of by stylesheet import order, and the colour roles are
`@property`-registered so a theme swap crossfades instead of flickering property by
property. Before this, indigo was the default and inverted the site's identity —
structure violet, Monero orange demoted to data-only — and a fourth theme would have
cost an afternoon of `!important` archaeology instead of thirty lines.

## 2 · CONTEXT

- Prompt 03 of 19 (v6.1.2). Prompt 01 deleted the v4 front-end; prompt 02 shipped the
  Future tab feeds. Spec artifact: `theme-system-mockup.html` (uploaded, not in repo).
- Relevant files: `app/src/styles.css`, `styles-ambient.css`, `styles-theme.css`,
  `styles-legibility.css`, `app/index.html`, `app/src/design/{VisualContext,DesignPanel,
  ThemeToggle,ArtBackground,RootBoundary}.tsx`, `app/src/pages/HomePage.tsx`,
  `app/scripts/prerender.mjs`, `app/verify-{legibility,degraded,contrast,ground,shots,lib}.mjs`.
- Plan of record: the approved plan for this task, including the four-question decision
  table and the two user-mandated carve-outs to the audit scope.

### Premises in the prompt that did not survive contact with the repo

- **"~43 gates … `verify:e2e` (9)"** — 44 files (`app/`×40, `api/`×4) = 43 gates plus
  the shared `verify-lib.mjs`. `verify:e2e` runs **10** (prompt 02 wired in
  `verify-future.mjs`); `verify:static` runs 11; CI runs **25 distinct files**.
  **16** gates are wired to neither npm nor CI — `CLAUDE.md`'s "17" counts
  `verify-lib.mjs`, which is imported rather than run.
- **"Pixel-diff classic against v5 `main`" is not runnable as written.** The last
  pre-theme commit is `bf7fc805` (2026-07-30), but main has since rebuilt Markets
  (v6.0.5), added six mempool views (v6.0.11) and rewritten the Future tab (v6.1.1) —
  a v5 build differs on nearly every page for non-colour reasons. `main` already ships
  the v5 classic identity as its `:root:not([data-theme="indigo"])` branch, so the
  acceptance test is **branch-classic vs `origin/main`-classic**, via the
  already-written-but-orphaned `app/verify-shots.mjs`.
- **`verify-darkfloor.mjs` does not exist.** `app/index.html:12` names it as the gate
  owning the paint floor; the real owner is `verify-degraded.mjs`.
- **Classic is already the CSS-level default** — `styles-theme.css` scopes it as the
  `:not([data-theme="indigo"])` fallback branch, which is why JS-off loads already
  paint `#050505`. Flipping the *product* default is a small JS/HTML change.
- **The structural/data accent split already exists and is correct**: `--tk-accent`
  (data, orange in both themes) vs `--ui-accent`/`--ui-primary` (chrome). The mockup's
  `--accent-data`/`--accent-structural` is a rename of it, not a new idea.
- **"Zero hardcoded colours" conflicts with a green CI gate.**
  `verify-chartkit.mjs:88-93` requires the literal `rgba(8,7,5,0.94)` to exist in
  exactly one file; tokenising it takes the count to 0 and fails.
- **`ci.yml` has no `push:` trigger** — PR-only, to `main` or `v5-migration`.
- **Environment**: no `gh` CLI (GitHub MCP tools instead); Playwright has Chromium only
  at `/opt/pw-browsers`, no WebKit, so every gate's `webkit → chromium` preamble always
  falls through to Chromium.
- **The census undercounted.** `grep --include=*.tsx --include=*.css` misses
  `protocols/pool-data.ts`; the audit surface includes `.ts` files.

## 3 · SCOPE

IN: `@layer` retrofit across the four stylesheets; `@property`-registered role tokens
and a one-way alias block; three theme blocks; per-theme aurora; the default flip
(index.html pre-paint stamp, `VisualContext`, prerender, the literal-hex fallback
surfaces); a shared `ThemeToggle` mounted on Home and in `⌘ DESIGN`; the colour audit
across `design/`, `pages/`, `mempool/` and the CSS; the two `protocols/` carve-outs;
gate updates and the wiring of `verify-contrast` + `verify-ground`; doc corrections.

OUT (non-goals): orange-maxi (the mockup ships it; the prompt says don't build it);
tokenising `protocols/**` diagram palettes beyond the two carve-outs; View Transitions
(prompt 04); the other 14 orphaned gates; the four duplicated route lists;
`api/monero.js`; the `useChartMetrics` callback-ref fix; `networkidle` in the nine
gates this PR does not wire; the SVG sub-12px mobile text issue.

## 4 · CONSTRAINTS

- Stack: React 18 · Vite 5 · TS strict · Node 22. `api/` is **CommonJS** (untouched here).
- CSP `connect-src 'self'`; zero third-party browser requests; fonts self-hosted from
  `app/public/fonts/` — do not move `@font-face` out of `app/src/*.css` or
  `verify-origins.mjs` fails on a zero font-reference count.
- `Math.random()` only in `app/src/protocols/`. No fabricated values on live surfaces.
- **A theme must never change what a diagram means.** When a `protocols/` semantic
  collides with a theme accent, the **theme accent moves**, not the diagram.
- **Roles are declared from the hue scale, never from an alias** — `alias → role →
  scale`, one way. A cycle computes to guaranteed-invalid, then falls back to the
  registered `initial-value`, so indigo and phosphor would silently render orange with
  no error anywhere.
- The hue scale (`--o-*`, `--g-50`, `--r-50`, `--y-50`, `--p-50`, `--c-50`) is
  theme-invariant. Themes rebind roles only.
- Every route keeps its `noscript` block and a literal background floor; the pre-paint
  floor is literal hex with **no `var()`**.
- Usable at 390px, no text under 12px, every animation ships a `prefers-reduced-motion`
  path that loses no information.
- Do not touch: `verify-chartkit.mjs`'s `rgba(8,7,5,0.94)` literal; `api/`.

## 5 · DONE-CRITERIA  — the gate reads ONLY this section

- [ ] `npm run typecheck` exits 0
- [ ] `npm run lint` — N/A, no such script in `app/package.json`
- [ ] `npm run test` — N/A, no such script in `app/package.json`
- [ ] `npm run build` exits 0
- [ ] classic pixel-diffs against the `origin/main` classic baseline within tolerance,
      and the run reports `compared + unmatched === count` with phosphor counted as
      unmatched, never as compared
- [ ] `@layer reset, base, theme, components, utilities;` declared exactly once, and
      no top-level rule in the four stylesheets sits outside a layer
- [ ] every registered role resolves to its theme's declared value in all three themes
      — none falls through to `initial-value` (the acyclicity check)
- [ ] the hue scale resolves identically under all three themes
- [ ] audit grep over `app/src` (`.tsx` + `.ts`, `protocols/` excluded) shows zero
      hardcoded colours; `grep "#ff7a1a" app/src/protocols` returns 0 (carve-out 1)
- [ ] every `protocols/` palette collision against all three themes is reported with
      measurements, and each `#ffce8a` site is classified role-longhand vs pedagogy
- [ ] no flash of the wrong theme on cold load under 6× CPU throttle
- [ ] all three themes legible at AA on every route; classic's `CLASSIC_BASELINE`
      ratios pass **unchanged**
- [ ] aurora tint changes with the theme
- [ ] theme toggle reachable and operable by keyboard from Main Home
- [ ] theme choice survives a reload and an SPA navigation
- [ ] `npm run verify:static` green (11 gates)
- [ ] `npm run verify:e2e` green, with `verify-contrast` and `verify-ground` newly
      wired in and de-networkidled
- [ ] Branch pushed · PR opened ready-for-review · `mergeable_state: clean` · CI green

## 6 · VERIFY COMMANDS

```
cd app && npm ci
npm run typecheck
npm run build
npm run verify:static
node scripts/serve-dist.mjs &
npm run wait-preview
npm run verify:e2e
node verify-contrast.mjs
node verify-ground.mjs
node ../api/verify-feeds.mjs && node ../api/verify-markets.mjs
grep -rnE "#[0-9a-fA-F]{3,8}|rgba?\(" src --include=*.tsx --include=*.ts | grep -v "^src/protocols/"
grep -rn "#ff7a1a" src/protocols --include=*.ts --include=*.tsx
```

Pixel diff (acceptance test for classic):

```
git worktree add /tmp/base origin/main && cd /tmp/base/app && npm ci && npm run build
node scripts/serve-dist.mjs 4174 &
VERIFY_BASE=http://localhost:4174 node verify-shots.mjs --out /tmp/shots-main
# then on the branch, against its own dist:
node verify-shots.mjs --baseline /tmp/shots-main
```

## 7 · REPORT  — filled on exit

status:

pr:

commits:

deps added:

deviations from spec:

collision table (literal · sites · theme · measured before/after · what moved):

notes for ARCHITECTURE.md patch:

open questions:

## 8 · LOOP FEEDBACK

(none)
