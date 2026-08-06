---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260805-19
branch: claude/caret-symbol-1x1q2j
status: in_progress     # open -> in_progress -> done | blocked
written_by: claude-code (manual mode — prompt-driven, no cowork handoff)
owner: claude-code
---

# HANDOFF — the topbar clip has no assertion, and two citations point at the wrong lines

## 1 · GOAL

`app/verify-orb.mjs` §8 gains a clip section that would go RED if v6.1.11's `clip-path`
stopped working, and that is never vacuous where it claims to measure. Today the clip has
exactly one assertion (`:1551`) and its subject is when the clip must be **absent**; the
only observation of the live value (`:1074`) is an `R.info` taken at rest, where the value
is the no-op `inset(0px)`. A sign flip, a wrong ancestor, an `effectiveRect`/`base` mix-up
or returning `clipAncestor`'s child would leave all 191 assertions green. Alongside it,
three record defects are corrected: two citations whose subject moved when #165 inserted
423 lines, and one stale gate count in the previous handoff.

## 2 · CONTEXT

- Source of truth for the mechanism: `app/src/coldboot/Orb.tsx:255-270` (`clipAncestor`,
  predicate `overflowY !== "visible"`) and `:793-826` (the `inset()` computation off `base`).
- The gate this extends: `app/verify-orb.mjs:1051-1164` (§8), which already opens Home at
  four widths, installs `window.__orbProbe` (`installScrollProbe`, `:987-1030`), scrolls to
  `DEPTHS = [120, 400, 800]` and settles with `settleFrames(page, 3)`.
- The breakpoint that makes ≤768 a positive control rather than a lucky pass:
  `app/src/styles.css:2075-2077` gives `.main` `overflow: visible`, so the clip-ancestor walk
  returns `null` and no `clip-path` property is emitted at all.
- Relevant files: `app/verify-orb.mjs`, `handoffs/HANDOFF-XMRIRISH-20260805-18.md`.
- Prior work: PR #165 (v6.1.11) added the clip. Measured base for every number in the brief:
  `088a6e8`.

## 3 · SCOPE

IN: new clip assertions inside §8's existing per-width loop (arithmetic invariant, band
hit-test, ≤768 positive assertion, reasoned skips, a permanent self-check); the two citation
fixes at `verify-orb.mjs:1134` and `:1585`; the `verify-coldboot` count fix in handoff 18.

OUT (non-goals): any change to `app/src/**` — if the work requires editing `Orb.tsx`, stop
and report why. No new page loads or browser contexts. No `CLAUDE.md` session note (edit it
only where this PR makes an existing sentence false, and name the sentence). No merge.

## 4 · CONSTRAINTS

- Stack: React 18 / Vite 5 / TS strict / Playwright-driven headless Chromium gates.
- The gate must reuse §8's existing contexts, scroll depths and settle — cost is one extra
  `page.evaluate` per depth, not another page load.
- A self-check injects a **stylesheet rule with `!important`**, never an inline style:
  `Orb.tsx` rewrites `[data-orb]`'s inline style on its 24fps `seconds` tick and reverts an
  inline injection within ~42ms. This is the trap recorded at `verify-orb.mjs:913-920`.
- A skip is counted and reasoned, never folded into a pass. The reason must carry the
  measured overlap.
- New dependencies: none.
- Do not touch: `app/src/**`, `api/**`, `vercel.json`, CI config.

## 5 · DONE-CRITERIA  — the gate reads ONLY this section

- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` exits 0
- [ ] `node verify-orb.mjs` exits 0, with more passed assertions than the 191 baseline and
      at least one **counted, reasoned** skip
- [ ] `node verify-coldboot.mjs` exits 0 at 82 · 0 · 0 · 0
- [ ] `node verify-coldboot-live.mjs` exits 0 at 21 · 0 · 0 · 0
- [ ] `node verify-cbpending.mjs` exits 0 at 27 · 0 · 0 · 0
- [ ] `node verify-govern.mjs` exits 0 at 50 · 0 · 0 · 0
- [ ] BREAK TEST: with `clipAncestor` returning `null` unconditionally, the arithmetic
      invariant reds at every live cell and the band assertion reds at every live cell,
      while the ≤768 positive assertion stays GREEN and the skips still skip
- [ ] Tree restored and PROVEN restored: `git status --short` shows only intended changes
      and `grep -rn "MUTATION\|BREAK TEST" src *.mjs` is empty, before the final chain
- [ ] `verify-orb.mjs:1134` and `:1585` cite `:913-920`
- [ ] `handoffs/HANDOFF-XMRIRISH-20260805-18.md` reports `verify-coldboot` 82/0
- [ ] Branch pushed · draft PR opened via the GitHub MCP · `mergeable_state` reported

## 6 · VERIFY COMMANDS

```
cd app
npm ci
npm run typecheck
npm run build
node scripts/serve-dist.mjs &      # :4173, VERIFY_BASE default
node verify-orb.mjs           ; echo $?
node verify-coldboot.mjs      ; echo $?
node verify-coldboot-live.mjs ; echo $?
node verify-cbpending.mjs     ; echo $?
node verify-govern.mjs        ; echo $?
```

Each run individually, with its exit code read **before any pipe**.

## 7 · REPORT  — filled on exit, completely

status:
pr:
commits:
deps added:
deviations from spec:
notes for ARCHITECTURE.md patch:
open questions:

## 8 · LOOP FEEDBACK

- **Open on entry, from the brief's own numbers.** The brief states SIX counted skips. A
  static read of §8's loop gives that only if `at0.max < 800` at 768 and 390 (nine cells);
  if all four widths run three depths (eleven cells, which is the count the brief itself
  states) the same rule yields TWO skips, with the six ≤768 cells covered *positively*
  rather than skipped. `at0.max` is a per-width measurement. Implement the rule, report the
  cell-by-cell outcome, and flag the delta — do not tune the floor to hit a number.
  **RESOLVED — the reading was right, and the author confirmed it.** The brief's six were
  the six ≤768 C-cells counted as skips, which contradicted its own §3C where those cells
  get a POSITIVE assertion. The `at0.max < 800` conditional does not rescue the number
  either: 768 and 390 measure 1146px and 1989px of travel, so all three depths run at both.
  Eleven cells, split 3 B-asserts / 6 C-asserts / 2 skips. Same defect family as the rest of
  this ledger — a count whose subject was the wrong set.
- **A guard written to prevent vacuity reintroduced it.** The first draft skipped below an
  8px geometric-overlap floor. At a 61px topbar the three sample rows sit at
  y = 12.2 / 30.5 / 51.85, and once the orb's top is above the viewport the intersection
  runs `0 → orb.bottom` — so a 10px overlap clears the floor and tests ZERO points, and the
  assertion reports green having run on nothing. The floor was a PROXY; `tested === 0` is
  the property itself, needs no constant, and cannot drift when the bar height or the row
  fractions change. Recorded because the failure mode is the one §2 exists to prevent, and
  it arrived inside the guard against it.
- **`tested > 0` was necessary and not sufficient.** It proves the sample points are inside
  both boxes; it does not prove they would have hit the orb. A cell where the orb is absent
  or occluded by something else entirely would read as "the clip worked". The A/B was
  already being taken for the self-check, so the third leg — `off.hits === off.tested` — is
  free, and every asserting cell now carries all three: `tested > 0`, `off.hits === tested`,
  `on.hits === 0`.
