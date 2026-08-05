---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260805-17
branch: claude/prompt164-cold-boot-console-gp6gfp
status: in_progress          # open -> in_progress -> done | blocked
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

## 7 · REPORT — filled on exit

status:
pr:
commits:
deps added:
deviations from spec:
notes for ARCHITECTURE.md patch:
open questions:

## 8 · LOOP FEEDBACK
