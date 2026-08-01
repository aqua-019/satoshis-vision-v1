---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260801-04
branch: claude/motion-transition-foundation-4452ip
status: in_progress        # open -> in_progress -> done | blocked
written_by: claude-code (manual mode — prompt-driven, no cowork handoff)
owner: claude-code
---

# HANDOFF — v6.1.3 Motion & transition foundation

## 1 · GOAL

The site has a motion vocabulary: four duration tokens and four easings declared once,
consumed everywhere, and zeroed as a set under `prefers-reduced-motion`. Route changes morph
rather than cut where the browser supports it and fall through to today's behaviour where it
does not. Back-navigation restores the scroll offset you left, focus lands in the new page's
main region, and a screen reader is told the route changed. Animation is confined to
`transform` and `opacity` on the two directories where a layout-property animation is most
expensive, gated so it stays that way. Underneath, two carried defects close: `design/` no
longer calls `Math.random()`, and the acyclicity assertion that three files claim exists is
actually written.

Before this: 37 `transition:` declarations and 59+ timing literals with two cubic-beziers
between them, hard cuts on every navigation, no scroll restoration, no route announcement,
no focus move, and a standing rule (`Math.random()` only inside `app/src/protocols/`) that
was false site-wide.

## 2 · CONTEXT

- Prompt 04 of 19 (v6.1.3), D2000 blocks A (D0651–0700) and B (D0701–0750).
  Prompts 01–03 shipped: layers + `@property` roles + three themes (PR #148).
- Must land **before prompt 07**, which restructures the nav. Doing that restructure
  without View Transitions means touching every route twice.
- Plan of record: the approved plan for this task, including the two-point sweep staging
  and the decision to keep `React.lazy`.

### Premises in the prompt that did not survive contact with the repo

The prompt says not to trust its own counts. **Six failed.**

| Prompt claim | Reality |
|---|---|
| "`verify:e2e` (9)" | **12** (`app/package.json:15`) |
| "~43 gates, only about half wired" | 43 gates + `verify-lib.mjs`; **30 wired** (27 CI + 3 npm-only), 13 orphaned |
| "the 12 simulators in `app/src/protocols/`" | **21 registered views** across 16 `.tsx` (`views/protocols.tsx:38-59`) |
| "18 surfaces" for the reduced-motion audit | **27** (21 simulators + 6 mempool views) |
| "13 `Math.random()` call sites" | 13 *lines*, **15 calls**; 3 of those lines (`:237-239`) are the per-frame stream respawn path, not `seed()` |
| "`classic.tsx:411` and `:460`" | Stale by +6 — real lines **417** and **466**. The behaviour claim is correct. |

True as stated: `verify:static` (11), nine gates named in `ci.yml`, `react-router-dom ^6.26`
(lockfile resolves 6.30.4), and the prompt's own self-correction that `PageShell` is *not*
already a persistent shell.

### Findings the prompt could not have known

1. **`react-router` is on the JSX `<Routes>` API, not `createBrowserRouter`** — so
   `<ScrollRestoration>` and the router's view-transition support are unavailable at *any*
   version. Hand-rolling is forced, not merely preferred.
2. **Three of the surfaces the prompt asks to URL-sync do not exist**: a Markets "brush"
   (`chart-kit.tsx:48` is a transient hover crosshair), a Network "metric selection"
   (`NetworkPage` renders all charts unconditionally), and a command palette
   (`terminal.tsx:368`'s ⌘K is a decorative legend).
3. **`mempool/useMemCanvas.ts` (327 lines) has zero consumers** and there is no `<canvas>`
   in `app/src/mempool/`. Staged infrastructure; not touched.
4. **Six of the 21 simulators are visited by no gate at all** — `verify-lib.mjs:54-56` walks
   15 `?p=` ids, omitting `seraphis`, `jamtis`, `carrot`, `cuprate`, `stressnet`, `ospead`.
   `carrot.tsx` is one of the five bar fills this task rewrites, so that rewrite would have
   been unobserved. Added to `ROUTES`.
5. **`verify-shots.mjs:59-72`'s recorded diagnosis is wrong.** It blames ParticleField's
   `Math.random()` for the 1440 byte instability, but `verify-shots.mjs:73` calls
   `page.emulateMedia({reducedMotion:'reduce'})`, `deviceTier.ts:121` demotes to `low` under
   reduced motion, and `ArtBackground.tsx:40` does not mount ParticleField on `low`.
   `git blame`: the `emulateMedia` call landed in `bd8d5c2` (v6.0.10), the comment in
   `0344b3d` (prompt 03) — the emulation was already there when the diff was attributed.
   See §7 for what the cause actually turned out to be.

## 3 · SCOPE

IN: duration/easing tokens + migration · reduced-motion contract across 27 surfaces ·
GPU-only property discipline + gate · seeded PRNG in `design/` · the acyclicity gate ·
View Transitions (route, theme, one shared-element pair) · scroll restoration · focus
handoff + route announcement · `useUrlState` · frame-budget governor · `@starting-style`.

OUT (non-goals, each stated in the PR as a decision rather than an omission):
- **D0721 persistent layout shell** → prompt 07. The shell is per-page; hoisting it means
  converting all 13 pages and moving shell props into a route table, which is 07's job.
- **D0723 speculation rules / D0724 hover prefetch** → prompt 07, with the route table.
- **Mempool tile → view morph** — dropped on merit; see §7.
- `useMemCanvas.ts`, the 13 orphaned gates, and the four-copy route list.

## 4 · CONSTRAINTS

- CSP `connect-src 'self'`; no third-party browser requests, ever; fonts self-hosted.
- `Math.random()` only inside `app/src/protocols/`. This task makes that true again.
- `api/` is CommonJS and is not touched.
- Every route keeps its `noscript` block and literal background floor; usable at 390px;
  no text under 12px; every animation ships a reduced-motion path that loses no information.
- No new runtime dependencies.
- New CSS must sit inside a `@layer` block — `verify-legibility.mjs` fails otherwise.

## 5 · DONE-CRITERIA — the gate reads ONLY this section

- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` exits 0
- [ ] `npm run verify:static` passes
- [ ] `npm run verify:e2e` passes
- [ ] `grep -rn "Math.random" app/src --include=*.tsx --include=*.ts` returns hits only under `app/src/protocols/`
- [ ] The PRNG determinism + distribution gate exists, runs in CI, and passes
- [ ] PRNG-only checkpoint sweep is byte-identical to `origin/main` (classic)
- [ ] Full-branch sweep: every diff enumerated by route with a cause; the `unexplained` bucket is empty
- [ ] `verify-shots.mjs` reports compared / no-baseline / **skipped-by-filter** as separate numbers
- [ ] The acyclicity assertion exists, runs, is named correctly by `verify-legibility.mjs`, and goes red when a role is deliberately cycled
- [ ] Zero ad-hoc durations left in `app/src` (each remaining literal justified in a comment)
- [ ] All 27 surfaces enumerated below with three separate counts
- [ ] CI grep for layout-property animation returns zero hits under `mempool/` and `protocols/`
- [ ] Route changes morph in Chromium and cut cleanly without View Transition support
- [ ] Back-navigation restores scroll on `/mempool` and `/simulate`
- [ ] `/mempool?v=terminal` deep-links; `grep -rn 'HashRouter' app/src` returns nothing
- [ ] Focus lands in the new view's main region; the route is announced
- [ ] Theme toggle crossfades, and swaps instantly under reduced motion
- [ ] design-reviewer returned APPROVE
- [ ] Branch pushed · PR opened (ready, not draft) · `mergeable_state: clean` · CI green

## 6 · VERIFY COMMANDS

```
cd app
npm ci
npm run typecheck
npm run build
npm run verify:static
npx playwright install --with-deps chromium
node scripts/serve-dist.mjs &
npm run wait-preview
npm run verify:e2e
node verify-roles.mjs
node verify-motion.mjs
node verify-prng.mjs
node verify-shots.mjs --theme classic --baseline <baseline-tree>
```

## 7 · REPORT — filled on exit

status:
pr:
commits:
deps added:
deviations from spec:
notes for ARCHITECTURE.md patch:
open questions:

### 7.1 · Reduced-motion audit — 27 surfaces

_Three counts, never merged: already compliant · fixed · not applicable._

(filled during Wave 2E)

### 7.2 · Sweep results

(filled during the checkpoint and Wave 3J)

## 8 · LOOP FEEDBACK

<!-- cowork appends here when verify fails -->
