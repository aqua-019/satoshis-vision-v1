---
task_id: XMRIRISH-20260822-M7b
title: "p4·M7b — the two mark ceilings and the dpr invariant"
branch: claude/mobile-terminal-bootup-prompt-dlp5ju
status: done
base: 1ba3923
---

## 1 GOAL
Close three operator-review items on the p4·M7 release (#200, merged as 1ba3923).
Gate-only: no `src/` change, no route, no budget move.

## 2 CONTEXT
Review of the p4·M7 close raised four items. One was a process rule (below), one
confirmed a classification, two were concrete gate work.

## 3 SCOPE
`app/verify-coldboot.mjs`, `CLAUDE.md`. Nothing else.

## 4 CONSTRAINTS
- A merged PR cannot track new work: rebase the unmerged commits onto the new
  default branch and open a NEW pull request.
- No `src/` change, so no budget may move. Verified: verify-bundle 32 passed.

## 5 DONE-CRITERIA
- [x] The dpr question is answered by a GATE, not by a human. §10e already ran
      three dpr-2 stages; the uncovered half was §10's composition assertions.
      Measured dpr 1/2/3 across three viewports: every field identical. Added a
      control asserting that invariance. M11 → exactly one red.
- [x] `MARK_SHARE_MAX` / `MARK_ROW_SHARE_MAX` each have a demonstrated polarity.
      Split from one `&&` assertion into two. M12 → BOX red 45.1 % with ROW green
      (an independent red). M13 → ROW red 94.1 %, BOX red 70.6 %.
- [x] The mono-face geometry race is a durable Known Issues item, not a log line.
- [x] verify-coldboot green: 224 passed · 0 failed. verify:static exit 0.
      verify-bundle 32 passed, no ceiling moved.

## 6 VERIFY COMMANDS
`npm run build && node verify-coldboot.mjs && node verify-bundle.mjs && npm run verify:static`

## 7 REPORT
The first item reframed under measurement. The review's premise — "nothing you
added this PR runs at dpr 2 either" — is wrong: §10e runs three dpr-2 stages and
is the release's centrepiece gate. The real gap was one level over, in §10's
composition half. Measuring first turned "add a lane because it is blind" into
"assert the invariance that makes one lane sufficient", which is a stronger
result: it names WHY the single-dpr lane is sound and reds if that stops holding.

The ceilings turned out complementary rather than merely slack. boxShare IS
rowShare scaled by the mark's width ratio, so at the shipped 0.77 fit ROW binds
first and at full width BOX binds first. Neither is redundant — visible only
once they were separate assertions.

**LIMIT**: rowShare has a demonstrated red but not a demonstrated INDEPENDENT
one; the window is rowShare 0.55..0.584, ~3 grid rows at 390. Recorded rather
than manufactured with a mark tuned to the gap.

## 8 LOOP FEEDBACK
- **A green head the operator is waiting on is FROZEN.** p4·M7 banked two ledger
  items to avoid crowding the runner, then pushed them the moment CI landed,
  resetting a green tree for two paragraphs. "Docs-only on top of green" is not a
  safety argument here: `logMax <= SITE_PR <= logMax + 1` is exactly what a docs
  commit reds, silently, until CI runs. Ledger material goes in the next PR.
- **A conjunction has no per-term polarity.** Two ceilings joined by `&&` cannot
  be shown to red individually however many mutations run. Split before claiming
  either is exercised.
- **Measure before accepting a review premise.** Two of four items were partly
  false as stated, and in both cases measuring produced better work than
  complying would have.
