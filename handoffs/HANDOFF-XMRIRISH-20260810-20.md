---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260810-20
branch: claude/new-session-r2322c
status: in_progress
written_by: claude-code (manual mode — prompt-driven)
owner: claude-code
---

# HANDOFF — V2·0 the layout system (no redesign)

## 1 · GOAL
`src/mempool/` and `src/views/` derive every gap/padding/margin from a seven-rung
`--sp-*` ramp declared once in `:root`; every axis in those directories derives its
label count from `labelStep()` and its tick count from `tickCount()` with the font
scale read via `readChartFontScale()`; and `.mp-switcher` sits in the document flow
at every width with the `top: 61px` topbar coupling deleted. The site looks
almost identical to today — the only intended visible deltas are the switcher
moving into flow and axis labels ceasing to overlap.

## 2 · CONTEXT
- Premise measured against `main` = `292227a` (v6.1.12), 2026-08-10.
- Relevant: `app/src/styles.css`, `app/src/mempool/**`, `app/src/views/**`,
  `app/src/design/useChartMetrics.ts`, `app/src/pages/MempoolPage.tsx`,
  `app/verify-memviews.mjs`, `app/verify-shots.mjs`.
- Known defects, all three previously written down and never fixed:
  1a no spacing scale (2 of 70 custom props are spacing);
  1b `labelStep`/`tickCount` exist and no view imports them — Sediment's
     stratigraphy x-axis renders overlapping block heights in production;
  1c `.mp-switcher` is `position: fixed; top: 61px; right: 16px; z-index: 50`,
     occupying the top-right ~236px of every mempool view, out of flow.

## 3 · SCOPE
IN: the spacing ramp + migration of `src/mempool/` and `src/views/` only;
`labelStep`/`tickCount`/`readChartFontScale` adoption on every axis in those two
directories; moving `.mp-switcher` into flow; one new no-overlap axis assertion;
pricing the `verify-shots` option.

OUT (non-goals): view composition, colours, canvas drawing logic, any of the five
view files' visual logic; migrating the rest of the app to `--sp-*`;
renumbering `--pad-main` / `--pad-page`.

## 4 · CONSTRAINTS
- React 18 · Vite 5 · TS strict. Edit `app/src/**` only; no hand-edited HTML.
- Zero fabricated values on live surfaces. `Math.random()` only in `src/protocols/`.
- No new dependencies.
- If editing what a view *draws*, stop and report why.

## 5 · DONE-CRITERIA — the gate reads ONLY this section

- [ ] `npx tsc --noEmit` exits 0 errors
- [ ] `npm run build` exits 0
- [ ] `--sp-1`..`--sp-7` declared exactly once in `:root` in `styles.css`
- [ ] Spacing-literal count in `src/mempool/` + `src/views/` reduced to the ramp;
      residue enumerated with a written reason per value
- [ ] Every axis in `src/mempool/` + `src/views/` derives label count from
      `labelStep()` and tick count from `tickCount()`; font scale via
      `readChartFontScale()` — grep shows matches where it previously showed none
- [ ] `.mp-switcher` has no `position: fixed` and no `top:` coupling
- [ ] New assertion: no two axis `<text>` bounding boxes intersect, at
      390 / 768 / 1440 / 2560 — break-tested by forcing `labelStep()` → 1
- [ ] Switcher break test: `.mp-switcher` box does not intersect the active
      view's panel region at 1440 (reds on today's `position: fixed`)
- [ ] `verify-orb` · `verify-coldboot` · `verify-coldboot-live` · `verify-cbpending`
      · `verify-govern` report their §3 baselines, or the delta is explained
- [ ] `verify:static` (21) and `verify:e2e` (29) green, or each mover explained
- [ ] design-reviewer returned APPROVE
- [ ] Tree clean after break tests (`git status --short`, no MUTATION/BREAK TEST)
- [ ] Branch pushed · PR ready for review (not draft) · CI ran on final head SHA

## 6 · VERIFY COMMANDS
```
npx tsc --noEmit
npm run build
npm run verify:static
npm run verify:e2e
node verify-orb.mjs / verify-coldboot.mjs / verify-coldboot-live.mjs
node verify-cbpending.mjs / verify-govern.mjs
```

## 7 · REPORT — filled on exit
status:
pr:
commits:
deps added:
deviations from spec:
notes for ARCHITECTURE.md patch:
open questions:

## 8 · LOOP FEEDBACK

### Two standing-rule candidates this run paid for

**A · A break test must assert its mutation applied before interpreting the gate.**
The mutation's own effect — sites changed, nodes injected, bytes differing — is a
precondition with its own number, reported separately from the gate's colour. A break
test that reads only the colour cannot distinguish "the assertion fired" from "my
mutation silently no-op'd and something else was red." This run produced exactly that:
the cross-gauge negative printed four ❌ lines that looked like a clean red, while
`other-gauge wrappers injected: 0` showed the mutation never applied — the reds were
damage from the *previous* test. One incidental count was all that stood between this
and a recorded pass for a test that never ran. Make it structural, not lucky.

**B · `git checkout --` is repo-state-relative; a break test needs mutation-relative.**
`git checkout -- <file>` means "make this file match HEAD," which equals "undo my
mutation" only when HEAD already contains everything else you wanted. Against an
uncommitted tree it discards the branch work too. It cost this run `bridge.tsx`'s entire
spacing migration plus its gauge markers, and the script's own check reported
`reverted: 0 unexpected entries` — *clean*, which read as success and actually meant
"all branch work on this file is gone." Clean and complete are different claims.
Durable primitives, correct regardless of commit state, because the revert is written at
the same moment as the mutation from the same object:
```
cp file file.bak   →  cp file.bak file
git diff > m.patch →  git apply -R m.patch
```
"Commit first" also works and was the right immediate move, but it is a rule that gets
skipped under time pressure; the primitive cannot be.

### Brief-quality notes for the next revolution

- The premise's §1b was a subject-narrower-than-claim error: a grep scoped to
  `src/mempool/` + `src/views/` generalised to "no view imports the helpers." The shared
  chart component they render (`pages/markets/charts.tsx:31`) imports all four. Scope a
  grep's *conclusion* to the grep's *scope*.
- §2B said "derives its label count from `labelStep()`"; `labelStep` returns a **stride**.
- The spacing census in the premise (17 values / 288 uses) undercounts by ~a third
  because it missed unitless JSX numbers and per-token shorthand. Measured: 408 sites.
- Scale: four scouts and a four-way build fan-out were sized off the prompt's apparent
  breadth ("every axis in two directories") before scouting established the real target
  was two call sites. **Size the fan-out from what scouting found, not from the prompt's
  surface area.**
- A worker validated a collision fix against the numbers quoted in its brief rather than
  against a render, and shipped a fix for the wrong colliding pair with a confident
  self-authored 15/15 self-test. The gate this same PR added is what caught it. Briefs
  for collision work must say: run the gate, do not re-derive the brief.
- Two subagents completed without calling StructuredOutput and returned nothing. A
  non-returning agent leaves no statement of intent, so its work cannot be cleared by
  inspecting the tree — inspection then checks the work against itself.

