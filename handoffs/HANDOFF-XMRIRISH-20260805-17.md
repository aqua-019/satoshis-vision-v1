---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260805-17
branch: claude/prompt164-cold-boot-console-gp6gfp
status: done                 # open -> in_progress -> done | blocked
written_by: claude-code (manual mode — prompt-driven, no cowork handoff existed)
owner: claude-code
---

# HANDOFF — v6.1.10 cold boot: an overlay that never faded, a console that never grew, a hold that halved

## 1 · GOAL

After this task the cold-boot orb's badge/caption block fades in with the orb instead of
sitting at full strength over the decrypt field for 5.5 seconds; the console's centre and
left panes carry the mockup's vertical growers, so the log fills its pane and ENTER sits on
the pane floor instead of leaving up to 723.9px of dead space below it; and the frame-zero
hold is 750ms rather than 1500ms, with every prose site that states the old number corrected.
Three new gate sections make the first two machine-checkable, and one pre-existing vacuous
assertion in `verify-orb` §7 is given back its subject.

## 2 · CONTEXT

- Base: `origin/main` at `63dc1a8` (PR #163, v6.1.9).
- Prompt: v6.1.10, pasted into this session. A separate verifier session checked the plan by
  execution across three pre-flight rounds and corrected it four times; see §8.
- Relevant files: `app/src/coldboot/{Orb,ColdBoot,ColdBootConsole}.tsx`,
  `app/src/coldboot/gate.ts`, `app/verify-{orb,coldboot,coldboot-live,cbpending}.mjs`,
  `docs/v6-mockups/coldboot-splash.html`.
- Approved plan: `/root/.claude/plans/root-claude-uploads-3fc6b90f-216b-528f-effervescent-mango.md`.

**Premise verification (§2 rule): the prompt's gate placement for issue 1 is wrong, measured.**
It says the overlay assertion "cannot live in `verify-orb` as that gate is currently
configured". True of §1–§6, which go through `openHome()` (`:219`) and its `coldBootOff(ctx)`
(`:221`). False of §7 (`:887`), which builds a plain context with only `mockNodesUnavailable`
and visits `/` un-bypassed — and whose existing read point was measured standing inside the
defect's window (phase `decrypt`, canvas wrap opacity 0, overlay opacity 1, at 1676/1729/2169ms
from `__xmriCbT0`, against `assemble` first going non-zero at ~6250ms). The assertion goes in
§7. That also moves the blast radius of a regression from 28 downstream gates to one.

## 3 · SCOPE

IN: the orb overlay fade + its §7 assertions; `verify-orb` §7's Z2 relabel and re-time; the
console's centre/left vertical growers + `verify-coldboot` §8; the log's render order;
`CB_HOLD_MS` 1500 → 750 + eight prose sites; three stale in-tree docblocks that this change
makes readable as wrong.

OUT (non-goals): the phone console's total height (the standing known issue); the mockup's
typewriter log and ghost replay button; unifying the two `0.86` encodings; `/live/mempool`'s
LCP calibration; any `CLAUDE.md` session note.

## 4 · CONSTRAINTS

- Stack: React 18 · Vite 5 · TS strict · Node 22. `app/` only plus this handoff.
- No new dependencies.
- A gate must never report a pass on something it did not check; every new assertion is
  break-tested with a seam that redirects its subject.
- Do not touch: `api/`, `vercel.json`, `.github/workflows/`.

## 5 · DONE-CRITERIA — the gate reads ONLY this section

- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` exits 0
- [ ] `npm run verify:static` exits 0 (21 gates)
- [ ] `npm run verify:bundle` exits 0
- [ ] the six `api/verify-*.mjs` gates each exit 0
- [ ] all 29 `verify:e2e` gates exit 0, tallied individually
- [ ] the orb's badge/caption block carries the same computed opacity as its own canvas
      mid-decrypt, asserted in `verify-orb` §7 at 1440×900 and 390×844, break-tested four ways
- [ ] `verify-orb` §7's Z2 runs at the console phase and its label names hit-testing, not
      visibility; the `:986` skip text is re-measured and both false sentences rewritten
- [ ] the centre log fills its pane and ENTER sits within 4px of the pane floor at 2560×1440,
      1920×1080 and 1440×900
- [ ] the log is `|logH − LOG_MIN_STACKED_PX| ≤ 1` at 1100×900 and 390×844
- [ ] log lines are not compressed below their own computed `line-height` at 390×844
- [ ] `CB_HOLD_MS` is 750 and all eight prose sites agree with it
- [ ] `git status` clean; `grep -rn "MUTATION\|BREAKTEST" app/src app/*.mjs` empty
- [ ] Branch pushed · PR opened via the GitHub MCP, ready for review, `mergeable_state: clean`

## 6 · VERIFY COMMANDS

```
cd app
npm run typecheck
npm run build
npm run verify:static
npm run verify:bundle
node ../api/verify-nodehealth.mjs && node ../api/verify-tx-parse.mjs && node ../api/verify-feeds.mjs
node ../api/verify-markets.mjs && node ../api/verify-status.mjs && node ../api/verify-nodes.mjs
node scripts/serve-dist.mjs &        # record the PID; kill by PID, never pkill -f
npm run wait-preview
# each of the 29 verify:e2e gates individually, exit code captured before any pipe
```

## 7 · REPORT

status: done
pr: https://github.com/aqua-019/satoshis-vision-v1/pull/164 (mergeable_state: clean)
commits: 5 (orb fade + §7 assertions · console growers + §8 · a seam correction ·
  the hold + eight prose sites · records)
deps added: none

### What shipped, with numbers

**Issue 1 — the orb's badge/caption block now fades with the orb.** `Orb.tsx`'s
overlay reads `assembleStyle.opacity`, one value with one owner. Measured before:
5514 ms of text over the decrypt field at 1440×900, 4708 ms of it with its own
canvas at exactly 0, in a 402×154 px block. `verify-orb` §7 O1–O5 assert it at
1440×900 and 390×844; the section's existing read point was measured standing
inside the defect's window (phase `decrypt`, wrap opacity 0, overlay opacity 1, at
1676/1729/2169 ms from `__xmriCbT0`, against `assemble` first moving at ~6250 ms —
4.1–4.6 s of headroom), so no sampler and no derived window were needed.

**Issue 2 — the centre and left panes carry the mockup's growers.** Dead pane
below ENTER: 723.9 / 363.9 / 195.7 / 105.7 px at 2560×1440 / 1920 / 1440 / 1280
before, **0.0 px at all four** after. Log height 943.9 / 583.9 / 415.7 / 325.7.
Stacked, the log holds exactly 150 px at both 1100×900 and 390×844 and the matrix
stays at 150. Orb slot unchanged where it should be — 400 stacked, 526.5 at 1440,
731 at 1920, 1091 at 2560 — and pane `scrollHeight === clientHeight` at every
viewport, so nothing spills. Resize 900→1080 moves +164.0 px of 180 into the log,
ratio 0.91; the 16 px shortfall is the histogram's `clamp(70px, 10vh, 106px)`
saturating.

**Issue 3 — `CB_HOLD_MS` is 750**, with all eight prose sites corrected: detail
strings interpolate the imported constant, comments name `gate.ts#CB_HOLD_MS`
without restating a number.

### Break tests — every new assertion, both polarities

| Seam | Red | Green alongside |
|---|---|---|
| overlay pinned `opacity: 1` | O3 ×2, \|Δ\| 1.0000 | O4, O5 |
| phase read forced `"console"` | O2 ×2, O3+O4 citing it | O5 |
| overlay pinned `opacity: 0` | **O5 only** ×2 | **O3** — the seam O5 exists for |
| overlay `display: none` | O4 ×2 + O5 ×2 | **O3** — the seam O4 exists for |
| log cap restored to 220 | 11 reds, reproducing 723.9 / 363.9 / 195.7 / 105.7 exactly; resize ratio 0.00 | — |
| stacked floor dropped | log 0.0 px at 1100 and 390 | — |
| matrix cap restored to 220 | HUD 417.2 at 2560, 67.0 at 1920 — **and green at 1440 / 1280**, which is why the break-test viewport is named | — |
| log line wrapper removed | 12.5 px against a computed 20 px | — |
| `stacked` forced `false` | branch precondition ×2 | — |

### The chain — 58 of 59 gates exit 0

`npm ci` · `typecheck` exit 0 · `build` exit 0 · `verify-bundle` 25 passed ·
six `api/` gates exit 0 (`verify-status` 28 passed + 6 fixtured, `verify-nodes`
99 + 12 fixtured + 1 reasoned skip) · **21 static gates all exit 0** ·
**28 of 29 e2e gates exit 0**, each run individually with its real exit code
written to the log before any pipe.

The cold-boot set: `verify-coldboot-live` 22 · `verify-cbpending` 27 ·
`verify-coldboot` 81 · `verify-orb` 118 · `verify-cls` 20 — **0 skipped in all
five**. `/` CLS **0.0000 healthy and 0.0000 degraded** against a 0.005 ceiling.
Orb backing store tracks its CSS box at every context: console 402×365 at
1440×900 and 288×212 at 390×844, home 539×363 and 334×162. §4's orb travel
re-measured at **144.5 px** (the predicate is `moved > 1` and no number is
hard-coded anywhere, so nothing needed updating).

**`verify-vitals` exits 1, and it does so on the base commit too.** The failing
budget is `/ · median blocking ≤ 400 ms` — not an LCP, and `verify-vitals` drives
`coldBootOffBrowser`, so neither the console layout nor the hold can reach it.
Measured, same container, same session:

| tree | `/` median blocking, per run |
|---|---|
| this branch | 458 / 501 / 437 / 394 / 437 / 515 ms |
| **`63dc1a8` (base)** | **367 / 595 / 487 ms** |

Two of three baseline runs fail, with a worse worst case (595) than anything this
branch produced. The final run also skipped `/learn/sim` for an 87.4 % spread
across its own three samples (4428 / 4632 / 2472 ms), which is the machine moving
under the measurement. **The budget is uncalibrated for this hardware** — that
word, never "flaky": flaky invites a retry, uncalibrated invites a decision.

**CI settles it.** Both jobs passed on GitHub's runner, and `hardening gates`
runs `npm run verify:e2e` as a single `&&` chain ending in `verify-vitals` — so
**all 29 e2e gates including that one are green there**. The budget is not wrong
in general; it is wrong for this container. Steps were checked individually
rather than trusting the job's own green: install 4 s, typecheck 7 s, build 13 s,
each offline gate ~1 s, 21 of 21 succeeded. A 37-second job is fast enough to be
worth confirming it ran at all.

### Deviations from spec

**The overlay assertion is in `verify-orb` §7, not `verify-coldboot-live` §1d.**
The prompt's reason — "it cannot live in `verify-orb` as that gate is currently
configured" — holds for §1–§6 (`openHome()` → `coldBootOff`) and not for §7, which
builds a plain context and visits `/` un-bypassed. §7 was already standing in the
defect's window, and `onSlot` is already a hard precondition proving the
`React.lazy` chunk resolved and the orb took the console's rect. Placement also
moves the blast radius of a regression from the 28 gates downstream of gate #1 to
`verify-vitals` alone.

**Instance fourteen was fixed here rather than recorded.** Pre-existing on
`63dc1a8` and widened by the Issue-1 fix, so leaving it would have meant shipping
a claim my own change made more wrong.

### Recorded, not fixed

- **The cold-visit LCP blind spot — instance twelve, still open.**
  `verify-vitals.mjs:305`, `verify-cls.mjs:235` and `verify-shots.mjs:137` all call
  `coldBootOffBrowser`, so the console never mounts in any of them. Two consequences,
  both stated as reasons rather than as evidence of care: halving the hold cannot
  move the `/` LCP budget by a millisecond, and this PR's layout change **cannot**
  move `/` CLS as any gate measures it.
- **The log's event ORDER is asserted statically, and labelled so.** The
  bottom-anchoring half is measured (last child's bottom = the log's bottom,
  516.2 = 516.2 at 1440×900). The ordering half is a source assertion, because
  `serve-dist` answers `/api/*` with 501 — the differ never reaches `ready && !stale`
  and the log holds boot lines only, measured 12 lines and a `boot` header in every
  run. A mocked two-tick feed was attempted and did not reach that state either.
  Absent and said, rather than vacuous and counted.
- **`verify-orb` §7's skip branch is now unreachable**, and was already unreachable
  on `63dc1a8` — not retired by moving Z2. At 390×844 the console measures 796 px in
  an 844 px viewport since #163, so the orb's centre is in view and Z2 runs at both
  viewports. Kept as insurance with text that says the guard is for a layout which
  does not currently occur.
- **INSTANCE FIFTEEN — `[data-orb]`'s base rect is a race, and it draws the globe as an
  ellipse.** Found by the independent verifier of this PR and **reproduced here before
  recording**. Measured at 1920×1080 across cold loads, reading `[data-orb]`'s computed
  transform at the console phase:

  ```
  this container   hold shipped  identity 9/10 · SCALED 1/10   (twice)
  this container   hold 1500     identity 9/10 · SCALED 1/10
  verifier's       hold 750      identity 7/10 · SCALED 3/10
  verifier's       hold 1500     identity 5/10 · SCALED 5/10
  ```

  In the SCALED state: `transform: scale(0.835, 1.302)`, canvas backing store **and** CSS
  box both 660×450, displayed at 551×586 inside a 551×731 slot. **Aspect distortion
  1.302 / 0.835 = 1.56×** — the globe is ~56 % taller relative to its width than it should
  be, and it is plainly visible.

  Mechanism: `Orb.tsx:598-600` captures `baseRef` on the first render where `effectiveRect`
  is non-null and `active` is still false, and `effectiveRect` is `homeRect ?? coldBootOrb.rect`
  (`:377-378`) — Home's `#hm-orb` if it has measured by then, the console slot if it has
  not. Nothing sequences the two.

  **Pre-existing, not caused by this PR**: the diff touches `Orb.tsx` in exactly one line
  near that code and it is a docblock sentence; `baseRef`, `effectiveRect` and `homeRect`
  are byte-identical to `main`. It arrived with #163's CLS fix, which deliberately made the
  travel a transform.

  **Why no gate sees it, and it is the tracked family again.** `verify-orb`'s "backing store
  tracks its CSS box" compares `canvas.width/height` to `clientWidth/clientHeight × dpr` —
  both are the LAYOUT box, so 660×450 into 660×450 passes. §7's `onSlot` compares
  `[data-orb]`'s POST-transform bounding rect to the slot — 551×731 against 551×731, which
  also passes. The distortion lives entirely in the transform, which neither assertion
  reads, so both are green in both states. Subject: the layout box. Claim: the orb is sized
  correctly. **This is the first instance in the family visible to a visitor.**

  **Deliberately not fixed here.** Both states are green, it is pre-existing, and the fix is
  a decision about which rect should own the orb at the console phase rather than a
  mechanical change.

- **§4's travel distance is a SAMPLE, not a re-measured constant.** It reads through
  whichever base rect that run captured, so it is a draw from the two-valued variable above.
  Measured 144.5 px on five consecutive runs here — but this container flips the race only
  ~10 % of the time, so five identical draws are what that rate predicts and are not evidence
  of stability in general. A future 135 px is a different draw, not drift. The predicate
  remains `moved > 1` and no number is hard-coded anywhere.

- **`ORB_ASSEMBLE_FROM`'s `0.86` is encoded twice** — `schedule.ts:77`
  `settle: [0.86, 1]` and `ColdBoot.tsx:243`, plus four prose copies
  (`ColdBoot.tsx:134, :235, :241, :608`). Not unified here; both line numbers recorded.
- **The mockup pins every non-grower pane child `flex:none`; production leaves them
  at `0 1 auto`** — and that default shrink is why nothing spills today, which is why
  §8's HUD assertion is two-sided.
- **`PANE_STYLE` has no `overflow` where the mockup's `.pane` does.**
- **The mockup's log is a typewriter terminal** — `[mm.ss]` prefixes, a per-line
  `E.decel` reveal and a blinking `.cursor` (`coldboot-splash.html:1285-1298`), none
  of which exists in `ColdBootConsole.tsx`.
- **The mockup's ghost `↺` replay button** (`:515`, styled `:271`); production ships
  ENTER alone.
- **`/live/mempool` LCP is still ~97% of its 4000 ms budget and uncalibrated for this
  hardware.** Uncalibrated, never "flaky".

open questions: none.

## 8 · LOOP FEEDBACK

**Instance thirteen — a gate blinded by its CONFIGURATION, not its predicates.**
`verify-orb` carried 104 assertions about the orb, several specifically about the
badge block, and every one ran with `__XMR_COLDBOOT__ = "off"`, where
`coldBootOrb.active` is false and `assemble` is pinned to 1. Every opacity was 1
*by construction*, so an equality check would have compared 1 against 1 and printed
green on a tree with the defect fully present. The predicates were fine. The subject
was Home and the claim was the orb. New sub-shape worth naming: when a gate has one
context factory, auditing its predicates tells you nothing about what it looked at.

**Instance fourteen — a probe that ignores the property its label claims.**
`verify-orb` §7's Z2 read `elementFromPoint`, which ignores opacity at *every*
value, under the label "the compositor agrees". It ran at a moment when the canvas
wrap is at opacity 0 — measured green over a completely invisible orb, **at both
viewports**, not one plus a skip. Two fixes, not alternatives: run it where the
assemble chain is independently 1, *and* say what the probe measures.

**A refinement to standing rule 7, earned three times in one session.** Rule 7 says
build → serve → run, never rebuild while `serve-dist` is serving. Its mirror is
missing and cost three wrong measurements here: (1) `git checkout` reverting an
uncommitted fix along with the break-test seam, so the next two seams found no
anchor; (2) a gate-only seam run against the *previous* seam's `dist` because the
loop skipped its rebuild; (3) a "baseline" run that never rebuilt after the revert
and therefore measured the broken tree. All three were self-caught, all three are
the same shape. **Never measure without rebuilding after the tree changes — a
break-test has two states and both of them are builds; the baseline is not a
memory.**

**A seam that reds for the wrong reason is as dangerous as one that stays green.**
Assertion 10's first seam stripped `LOG_LINES_STYLE` and stayed green, which
correctly revealed that the style is not the mechanism — the wrapper *element* is.
The corrected seam removed the element and went red, but via "0 sampled" from the
vacuity guard, because `measure()` found the rows positionally and the wrapper is
exactly the node a positional lookup walks through. Red both ways; the claim
falsified neither way. Fixed by finding the rows structurally. Only reading *which*
assertion went red separates these two cases, which is the argument for recording
break-test output rather than exit codes.

**Instance fifteen — the first one a visitor can see.** `[data-orb]`'s base rect is
captured in a race, so on some cold loads the orb draws a 660×450 buffer into a
551×731 slot through `scale(0.835, 1.302)` — a 1.56× aspect distortion, an
elliptical globe. Two gates cover that element and BOTH are green in both states:
one compares the layout box to the backing store, the other compares the
post-transform bounding rect to the slot. The distortion is in the transform,
which neither reads. Found by this PR's independent verifier and reproduced here
before being written down. Full numbers and mechanism in §7.

**Reading a cached status and reasoning from it — the same shape, once more.**
Mid-run I reported CI's hardening job as taking 27 then 36 minutes and concluded
"slow runner". The check-runs endpoint was serving stale `in_progress`; the
step-level view showed the job had finished in 16 m 05 s, matching the previous
run on byte-identical code almost exactly. The measurement was never slow — the
poll was stale. Fifth instance of the staleness family in this session, and the
first where the stale value came from an API rather than from `dist/`. The rule
generalises: **a status you did not just observe is a memory, whatever produced
it.**

**A stale comment repeated as a conclusion.** Both the verifier and I asserted that
§7's `R.skip` still fires at 390 — taken from the skip's own text, in the same
breath as calling that text stale, without executing it. It has been unreachable
since #163. A comment being corrected for wording is not evidence its conclusion
survived.
