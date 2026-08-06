---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260805-19
branch: claude/caret-symbol-1x1q2j
status: done            # open -> in_progress -> done | blocked
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

- [x] `npm run typecheck` exits 0
- [x] `npm run build` exits 0
- [x] `node verify-orb.mjs` exits 0, with more passed assertions than the 191 baseline and
      at least one **counted, reasoned** skip — **223 · 0 · 1 · 0**
- [x] `node verify-coldboot.mjs` exits 0 at 82 · 0 · 0 · 0
- [x] `node verify-coldboot-live.mjs` exits 0 at 21 · 0 · 0 · 0
- [x] `node verify-cbpending.mjs` exits 0 at 27 · 0 · 0 · 0
- [x] `node verify-govern.mjs` exits 0 at 50 · 0 · 0 · 0
- [x] BREAK TEST: with `clipAncestor` returning `null` unconditionally, the arithmetic
      invariant reds at every live cell and the band assertion reds at every live cell,
      while the ≤768 positive assertion stays GREEN and the skips still skip
      — **9 reds**: A at all 5 clip-emitting cells, B at all 4 pixel-live cells, the 6
      ≤768 assertions green, the skip still a skip
- [x] Tree restored and PROVEN restored: `git status --short` shows only intended changes
      and `grep -rn "MUTATION\|BREAK TEST" src *.mjs` is empty, before the final chain
- [x] `verify-orb.mjs:1134` and `:1585` cite `:913-920`
- [x] `handoffs/HANDOFF-XMRIRISH-20260805-18.md` reports `verify-coldboot` 82/0
- [x] Branch pushed · draft PR opened via the GitHub MCP · `mergeable_state` reported

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

status: done

pr: https://github.com/aqua-019/satoshis-vision-v1/pull/166 (draft)

commits:
- `674b320` test(orb): the topbar clip had no assertion that it works
- `89bcd6a` fix(orb): the band assertion hit-tested a paint fact and saw nothing

deps added: none.

**The headline is not the clip section, it is that the clip section shipped green and
vacuous, and that the guard added for exactly that reason is what caught it.**

The first commit asserted the band was clean by hit-testing nine points through
`.topbar` with `elementFromPoint`. It passed at every live cell and measured nothing.
`.topbar` is painted OVER the orb and receives the hit itself, so the answer inside the
band is `div.topbar` — or the full-viewport ambient `canvas` — whether the clip works,
is broken, or is absent. The bleed is visible precisely because `.topbar` is
`background: rgba(0,0,0,0)`; transparency is a PAINT property and hit-testing does not
consult it. Paint order and hit order are different orders, and the claim was always
about the first. This file's own §8 `R.info` had been printing the disproof for as long
as it has existed: `elementFromPoint over the orb canvas centre → div.topbar` at
1440x900 @400px.

Nothing found it by inspection. The `off.hits === off.tested` leg found it — the leg
added so "clean" could not be satisfied by absence. Forcing the clip OFF left the count
at 0/9 rather than moving it to 9/9: nine points, nine misses, in BOTH polarities, which
is a measurement that cannot mean what it says. The sample density was never the
problem; the instrument was. Had that leg not been added, this would have merged as
five green assertions over a defect they could not see — the same shape as v6.1.9's
`verify-orb` (26 green assertions whose subject was the bypassed Main Home) and the
eleventh instance of the standing family.

**The instrument is now pixels.** Per live cell, five captures at one scroll position
with the page frozen — orb hidden · shipped · clip forced off · shipped again · orb
hidden — with equality expressed as a differing-PIXEL count decoded in-page rather than
byte equality on a compressed stream. Three legs, each the others' vacuity guard:
`offVsHidden > 0` (there is something here for the clip to remove), `onVsHidden === 0`
(the band is pixel-identical to the same band with no orb at all), `backVsOn === 0`. The
two orb-hidden captures are taken FIRST and LAST and `h1 === h2` guards all three, by
proving the freeze held across the whole window — without it, "identical" is also what a
page that never repainted would report.

**The freeze queues rAF callbacks and re-submits them, rather than stubbing the
function.** A no-op stub permanently kills every rAF loop on the page: a loop that is not
re-scheduled never restarts when the function is put back, and §8 scrolls to the next
depth immediately after, so every later cell would have measured a dead page. The
restoration is asserted rather than assumed.

deviations from spec:
- **The cell split is 4 / 6 / 1, not the 3 / 6 / 2 agreed in the ANSWER**, and the
  difference is entirely the instrument. `769x900 @400px` has 3.63px of geometric
  overlap; the hit-test's three sample rows (y = 12.2/30.5/51.85 of a 61px bar) all fall
  outside a 3.6px sliver, so it tested 0 points and skipped. The pixel instrument reads
  the sliver directly and finds **1820 of 15738 band pixels** bleeding there, so the cell
  now ASSERTS. `769x900 @800px` remains the one skip: the orb is clear of the bar
  (bottom −396.4) and paints nothing there even with the clip forced off. Reported, not
  reconciled, per the ANSWER's instruction.
- The plan predicted that a null `clipAncestor` would push every width into the ≤768
  branch. It does not: the gate walks the clip ancestor ITSELF (`clipWalk`, deliberately
  a re-implementation of Orb.tsx's predicate rather than a reuse of `resolve()`), so
  `g.has` stays true and the cells red inside the A/B branch where they should. The
  handoff's own prediction was the right one.
- Under the break test the two A/B legs stay GREEN. That is correct and worth stating:
  they are the vacuity guards, not the subject. The subject is `onVsHidden === 0`.

notes for ARCHITECTURE.md patch:
- No gate count change: this extends `verify-orb.mjs`, it does not add a file. Gates stay
  **71**, CI-reached **57**, `verify:e2e` 29.
- `verify-orb` baseline moves **191 → 223 passed, with 1 counted skip** (was 0 skips).
  Any handoff quoting 191/0 is now stale.
- Worth carrying forward as a rule: **`elementFromPoint` answers a hit-testing question
  and must never be used to assert a paint fact.** A transparent element above the
  subject takes the hit while the subject remains visible. Where the claim is "what does
  the user see", the instrument is pixels.

open questions: none.

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
  free, and every asserting cell now carries all three.
- **THE THIRD LEG IMMEDIATELY CAUGHT THE SECTION IT WAS ADDED TO GUARD.** On its first run
  it went red at all three live cells: clip forced OFF still gave `0/9`. The whole
  hit-test instrument was blind — `.topbar` is painted over the orb and takes the hit
  itself, so `elementFromPoint` in the band never returns the orb at any sample density or
  threshold. The five assertions above it had been passing on a measurement that could not
  see its own subject. Instrument replaced with a frozen five-capture pixel comparison; see
  §7. **The general rule, and it is not specific to this gate: `elementFromPoint` answers a
  HIT-TESTING question, and a paint fact must never be asserted through it.** A fully
  transparent element above the subject takes the hit while the subject stays visible.
- **The agreed 3/6/2 cell split became 4/6/1 when the instrument changed, and the number
  was not tuned back.** `769@400`'s 3.63px sliver falls between the hit-test's sample rows
  and so skipped; the pixel instrument reads 1820 of 15738 pixels bleeding there and
  asserts. Third time in this ledger that a count's subject was the wrong set — and the
  first where the correction came from replacing the measuring device rather than the
  count.
