---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260818-M2
branch: claude/readme-about-redesign-4aqutw
status: in_progress
written_by: claude-code (manual mode — prompt-driven, self-authored)
owner: claude-code
---

# HANDOFF — p4·M2 "THE README REDESIGN, AND THE ABOUT PAGE'S CENTRE OF GRAVITY"

## 1 · GOAL
Three independent operator asks, kept apart in three commits on one PR.
**A** — `README.md` stops being a contributor's map and becomes a statement of
how the site treats its readers, with every claim naming the mechanism that
enforces it. **B** — `/about/site` puts the support section second instead of
fifth and gives the fundraiser link real visual weight without begging.
**C** — the theme toggle leaves Main Home and lives only in ⌘ DESIGN.

## 2 · CONTEXT
- Base: `e0c87ad` (post-#196). The prompt named `0f00d26`; #195 and #196 had
  merged since, so the stated base was two merges stale.
- Files: `README.md` · `app/src/pages/SitePage.tsx` · `app/src/pages/HomePage.tsx`
  · `app/src/design/ThemeToggle.tsx` · `app/verify-site.mjs` ·
  `app/verify-contrast.mjs` (comment only) · `app/verify-bundle.mjs` (own row).
- Parallel work: p4·M3 may run concurrently. Page files are disjoint; the
  shared bookkeeping files are `siteVersion.ts`, `handoffs/LOG.md`, `CLAUDE.md`
  and `verify-bundle.mjs` (different rows).

## 3 · SCOPE
IN: the three parts above, their gates, budgets, census, renders.
OUT: the phosphor theme's green-overlay feel (operator decision, flagged not
actioned); `LICENSE`'s stale ADDITIONAL DISCLAIMERS (reported, not edited —
a legal document needs operator sign-off); every non-`/about/site` budget-row
comment (owned by a concurrent PR or out of scope).

## 4 · CONSTRAINTS
- Kuno stays a LINK: zero browser requests to `kuno.anne.media`, no figures,
  no modal/banner/sticky bar. Reuse existing classes — cssGz margin is thin.
- Part A touches nothing under `app/` or `api/`.
- Part C is a mount removal only: VisualContext, the `ThemeKey` union, the
  index.html pre-paint stamp and `styles-theme.css` stay untouched.

## 5 · DONE-CRITERIA
- [x] `npm run typecheck` exits 0
- [x] `npm run build` exits 0, 18 routes prerendered
- [x] Part A's commit diff contains no file under `app/` or `api/`
- [x] The clover is byte-identical to the delivered file (round-trip diff)
- [x] Every claim in the README's mechanism table verified against the tree
- [x] `verify-site` green, with §12 pinning section ORDER and CTA shape
- [x] Five break tests on §12/§8, each red where intended, mutation proven
      applied and each restore proven against the committed blob
- [x] `verify-contrast` green (Part C's dropdown instance still works)
- [x] `verify-origins` green — zero off-origin requests, fundraiser untouched
- [x] `verify-mobile` green — `/about/site` 0 elements below 12px
- [x] `verify-nojs`, `verify-ia`, `verify-releases`, `verify-bundle` green
- [x] Part C two-polarity: 0 theme toggles on `/`, all three themes still
      selectable and applying from the ⌘ DESIGN dropdown on `/` itself
- [x] Budgets attributed with residual ZERO against an isolated base build
- [x] Census recounted with the instrument controlled against three commits
- [x] Renders captured and LOOKED AT at 1440 and 390, before and after

## 6 · VERIFY COMMANDS
```
cd app
npm run typecheck && npm run build
node scripts/serve-dist.mjs 4173 &
node verify-site.mjs && node verify-contrast.mjs && node verify-origins.mjs
node verify-nojs.mjs && node verify-ia.mjs && node verify-mobile.mjs
node verify-releases.mjs && node verify-bundle.mjs
```

## 7 · REPORT
See the PR body and the CLAUDE.md session note for p4·M2.

## 8 · LOOP FEEDBACK
- **The brief's §0.1 was a false positive and it was in the authority slot.**
  It reported `Math.random()` in nine files outside `app/src/protocols/` and
  instructed that the README's claim be rewritten around them. All nine are
  COMMENTS, and every one says `Math.random` is *not* used there. A grep that
  counts mentions is not a grep that counts call sites — the same family this
  repo already records. `verify-prng` §6 strips comments and reports zero.
- **The brief's own scope hid the real call sites.** Its grep covered
  `app/src`; the two genuine call sites are in `api/`, and `app/legacy/` holds
  dozens more. A premise's SCOPE needs stating alongside its result.
- **`clover.txt` was not in the tree when work began** — the same
  "the operator approved X, read it" gap p4·06 recorded. It arrived mid-task.
- **The prompt's base commit was two merges stale.** Read `git log`, not the
  brief, for what `main` is.
