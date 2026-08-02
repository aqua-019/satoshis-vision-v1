---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260802-12
branch: claude/navigation-command-palette-rj979r
status: in_progress     # open -> in_progress -> done | blocked
written_by: claude-code (manual mode — prompt-driven, self-authored per CLAUDE.md loopflow)
owner: claude-code
---

# HANDOFF — v6.1.6 · navigation 11 → 6 + ⌘K command palette

## 1 · GOAL

The site's eleven flat top-level nav items become **six sections** — Live · Monero · Learn ·
Future · Operate · About — with hover-intent dropdowns on desktop, a thumb-reachable bottom
tab bar under 720px, a morphing active pill, and breadcrumbs that reflect the new hierarchy.
A ⌘K command palette reaches every page, tab, simulator and mempool view by typing, which is
what makes a six-item nav viable at all. Every URL that resolved before still resolves: the
old top-level paths 301 to their new homes and are mirrored by client-side redirects so the
behaviour is testable. `app/src/nav/ia.ts` becomes the single runtime source for the
information architecture, so the change ends with **fewer** hand-maintained route lists than
the eight that exist today, not a ninth.

## 2 · CONTEXT

- **Source of this handoff**: prompt 07 of 19 in the v6 batch (manual mode — no pre-existing
  open `HANDOFF-*.md`; self-authored from `_TEMPLATE.md` per CLAUDE.md's loopflow).
- **Binding spec for mechanics**: `docs/v6-mockups/nav-ia-mockup.html` (in repo since #154).
  **Read-only — an edited mockup stops being a spec.** Its *inventory* is aspirational; ~20 of
  its 60 child destinations do not exist in this repo (see §7 deviations).
- **Base**: `origin/main` at `0e7f73b` (PR #158, AQUA stack v4). Verified `HEAD == origin/main`
  with a clean tree before branching.
- **Consume, do not rebuild** (all from prompt 04): `src/design/viewTransition.ts` (`startVt`),
  `src/design/useViewTransitionNavigate.ts`, `src/routes/useRouteChrome.ts` (scroll restore +
  post-nav focus), `src/routes/RouteAnnouncer.tsx`, `src/routes/useUrlState.ts`,
  `src/routes/NavTransitions.tsx` (upgrades any in-app `<a href>` click to a VT navigation).
- **Reuse**: `src/pages/future/V6Modal.tsx` — the app's only `createPortal`, already carrying a
  focus trap, scroll lock, Escape and a measured exit frame. Its own header says every future
  dialog should build on it.
- **Full research + decisions**: `/root/.claude/plans/v6-1-6-navigation-splendid-fog.md`.

## 3 · SCOPE

**IN** — `app/src/nav/ia.ts` (new single IA source) · `scripts/routes.mjs` 11→13 ·
`App.tsx` routes + 12 client `<Navigate>` redirects · `vercel.json` 12 server 301s ·
`NavTop.tsx` rewritten to 6 sections + dropdowns + morphing pill · new `BottomTabBar` ·
container queries at 900/780/720 · ⌘K palette (lazy, mounted-on-open) · `Crumbs` upgraded to
a real `<nav aria-label="Breadcrumb"><ol>` across 12 call sites · `MarketsThesisTab` →
`/live/markets/thesis`, `OutlookTab` → `/future/outlook` (Monero 9→7 tabs) · speculation
rules + hover prefetch · lockstep updates to every route-list copy · new gates `verify-ia.mjs`
and `verify-palette.mjs`, `verify-nav.mjs` extended · correct `CLAUDE.md` / `README.md` where
this PR makes them false.

**OUT (non-goals)** — Creating content pages that do not exist (`/operate/pro`,
`/operate/mining`, `/operate/superstress`, `/about/status`, the 5 fictional mempool views, the
`/live/network/*` and `/live/markets/*` sub-pages, the `orange-maxi` theme, the Cold Boot
splash). **Deliberately NOT merging the FCMP++/Seraphis/Jamtis/CARROT/Tail-emission
duplicates** — each appears once as a Future protocol card and once as a Learn simulator, both
stay, both resolve, both appear in the palette; the prompt defers this past v6 launch. No new
npm dependencies. No changes to `api/`. No appended session note in `CLAUDE.md`.

## 4 · CONSTRAINTS

- **Stack**: React 18.3 · Vite 5 · TS strict · react-router-dom **6.26** (JSX `<Routes>` API,
  not `createBrowserRouter`) · Node 22 · Playwright 1.60 (the package, no test runner).
- **CSP is `connect-src 'self'`** — zero third-party browser requests, ever. Gated by
  `verify-origins.mjs`. `script-src 'self' 'unsafe-inline'` already permits inline
  speculation rules with no `vercel.json` change.
- **`Math.random()` only inside `app/src/protocols/`.** Zero fabricated values on live
  surfaces. Gated tree-wide by `verify-prng.mjs`.
- **Byte budgets, measured, ~10% headroom and no more**: `eagerJsGz` 88,000 (79,919 used →
  **8,081 B free**) · `cssGz` 17,000 (14,863 used → **2,137 B free**). The palette is
  therefore **lazy-loaded on first ⌘K**, never eager.
- **Usable at 390px · no text under 12px · every animation ships a `prefers-reduced-motion`
  path that loses no information** (a zeroed duration is not a variant if movement carried the
  meaning). Every route keeps its `noscript` block and literal background floor.
- **New dependencies**: none. The LOG repeatedly cites "zero new dependencies; package-lock
  byte-identical" as a virtue; the mockup's `fuzzy()` is ~15 lines.
- **Do not touch**: `docs/v6-mockups/*` · `api/**` · dated records in `handoffs/` and
  `MASTER-HANDOFF.md` · `.claude/hooks/session-start.sh` (its route count is derived, so it
  survives).

### Placement constraints that silently break existing gates
1. The ⌘K trigger must sit **after** `.skip-link` in DOM order — `verify-nav.mjs` §5 #51
   asserts the first Tab from a fresh load lands on the skip link, #7 that it is
   `.art-stage`'s first element child.
2. The palette must be **mounted only when open** — `verify-future.mjs:259` asserts **zero**
   `[role="dialog"]` on a page where nothing was opened. `role="dialog"` also survives one
   exit's worth of frames, so assertions must use `waitFor({ state: 'hidden' })`.
3. `.mp-switcher { top: 60px }` (`styles.css:1073`) hardcodes the topbar height and must be
   re-anchored; `styles.css:518` already flags it as "about to change again in prompt 07".
   The degraded banner anchors `.shell` and is genuinely 07-proof — leave it alone.
4. **CLS**: `.topbar`'s `flex-wrap` re-solving is a proven landmine (LOG -11 took `/` from
   0.3483 → 0.0012 by pinning the status pill's `min-width` to 29ch). 11→6 changes exactly
   those widths. Measure before and after.

## 5 · DONE-CRITERIA — the gate reads ONLY this section

Mapped by hand from the prompt's *Verify* section (`.claude/hooks/stop-gate.sh` does not
exist in cloud checkouts — V4 rule 7).

- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` exits 0 (tsc + vite + ssr + prerender + gen-sitemap)
- [ ] `npm run lint` / `npm run test` — **N/A, neither script exists in `app/package.json`**
- [ ] **6 top-level items, no wrap at any width ≥360px**
- [ ] **Every old URL still resolves** — 12 server 301s in `vercel.json`, mirrored 1:1 by 12
      client `<Navigate>` routes; 2 hash rows client-side; 3 identity rows need nothing.
      Counted separately, never reported as "15/15 server redirects"
- [ ] **⌘K reaches ≥70 real destinations; typing `sim` returns simulators, not *Sediment***
- [ ] **Keyboard-only navigable end to end; focus lands on the new heading**
- [ ] **Mobile bottom tab bar under 720px**
- [ ] **Hover intent: crossing an item quickly opens nothing** (150ms open / 220ms close)
- [ ] **No orphan pages** — every route reachable from nav or palette, proven by `grep`
- [ ] **`ia.ts` + `routes.mjs` are the only route lists** — `grep` proves no second
      hand-maintained list crept back
- [ ] **`app/dist/sitemap.xml` regenerates from `routes.mjs` at build**, lists exactly the
      6-item structure's routes, every entry resolves against `serve-dist`
- [ ] **Route changes morph via the prompt-04 View Transitions**
- [ ] `verify-ia.mjs`, `verify-palette.mjs` pass and are **break-tested red**, then restored
      on a clean tree before the final run
- [ ] `npm run verify:static`, `npm run verify:e2e`, `npm run verify:bundle` pass — **named
      individually in the report, never as `verify:*`**
- [ ] design-reviewer returned APPROVE; `director-quality` (Opus) **personally re-judged**
      every finding (standing gate-tooling flag — this PR adds gates)
- [ ] Branch pushed · PR opened **via GitHub MCP** (`gh` is not installed), ready for review,
      `mergeable: true` / `mergeable_state: clean` / every check concluded

## 6 · VERIFY COMMANDS

```
cd app && npm ci
npm run typecheck
npm run build
npm run verify:bundle
node scripts/serve-dist.mjs 4173 &
npm run wait-preview
npm run verify:static
npm run verify:e2e
npm run verify:all
```

## 7 · REPORT — filled on exit, completely

status:
pr:
commits:
deps added:
deviations from spec:
notes for ARCHITECTURE.md patch:
open questions:

## 8 · LOOP FEEDBACK

<docs-scribe appends every QUESTION:, every non-empty INFERRED, every SPEC-WAS-AMBIGUOUS,
and the per-gate round counts at write-back. Pilot watch (V4 rule 6): a test-engineer
OUT-OF-DEPTH or a NOT CONVERGING on gate-authoring work is a roster signal and goes in the
final report prominently.>
