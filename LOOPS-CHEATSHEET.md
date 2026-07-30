# Loops Cheatsheet — Official Primitives Mapped to the AQUA Loop

Anthropic's framework (claude.com/blog/getting-started-with-loops): a loop is an agent repeating work cycles until a stop condition. Four rungs, each hands off one more piece — the check, the stop condition, the trigger, and finally the prompt itself. Your AQUA closed loop already implemented most of this by hand; here is the mapping and the upgrade path.

## Concept map

| AQUA concept (your build) | Official primitive (new) | Relationship |
|---|---|---|
| CLAUDE.md verification block + skills | Turn-based loop, verification skills | Same idea — now also packaged as `.claude/skills/verify-frontend-change` |
| `§5 DONE-CRITERIA` as the gate | `/goal` with explicit criteria + turn cap | `/goal` adds a server-side evaluator model that bounces Claude back until criteria pass |
| `stop-gate.sh` Stop hook | — | Keep it. Deterministic backstop under `/goal`'s model-judged layer; also covers sessions started without `/goal` |
| Cowork step 04 VERIFY (watching Vercel/PR by hand) | `/loop <interval> <prompt>` | Automates the watch locally; stops when you cancel or the work completes |
| Cowork scheduled routines | `/schedule` | Moves the trigger to the cloud — runs even when your machine is off |
| `while true` around headless `claude -p` (Prometheus fleet) | Dynamic workflows + agent teams | Managed orchestration replaces the hand-rolled outer while-loop |

## Recipes

**Goal-based (hand off the stop condition)** — start every handoff session with:

```
/goal every DONE-CRITERIA box in the newest open handoff passes its verify command, design-reviewer returned APPROVE, and the PR is opened; stop after 5 tries
```

Deterministic criteria work best: test counts, exit codes, Lighthouse thresholds.

```
/goal get the checkout page Lighthouse score to 90+ with zero console errors, stop after 5 tries
```

**Time-based (hand off the trigger)** — after the PR opens:

```
/loop 10m check the open PR for this branch: address review comments, fix failing CI, and if the Vercel preview build failed, append the minimal error context to the active handoff under §8 LOOP FEEDBACK and fix
```

`/loop` runs on your machine and dies with it. For routines that should survive:

```
/schedule every weekday 9am: scan /handoffs/ for status: blocked or stale in_progress handoffs; summarize each blocker and what was tried into LOG.md
```

```
/schedule weekly Monday: check the Anthropic release notes, claude.com blog, and Claude Code changelog for new features relevant to the AQUA stack; write a short digest to updates/ with links
```

That last one automates this very project — feeding you Anthropic updates instead of you catching them on X.

**Proactive (hand off the prompt)** — compose primitives for recurring streams of well-defined work:

```
/schedule every hour: check for new bug reports in <source>. /goal: don't stop until every report found this run is triaged, actioned, and responded to. When fixing, use a workflow to explore two solutions in parallel worktrees and have design-reviewer adversarially pick one.
```

## Managing usage (from the guide, adapted)

Match the primitive to the task — most tasks need no loop at all. Give `/goal` explicit turn caps. Longer `/loop` intervals unless the watched thing changes fast. Route heavy reading to the researcher subagent (Sonnet rates) and keep the Fable lead's context clean. Pilot dynamic workflows on a small slice first. `/usage` breaks down recent spend by skills, subagents, and MCPs; `/goal` with no arguments shows turns and tokens so far.

## Quality rules that survive every loop type

Branch → gate → PR in every mode, including from the phone. The gate reads `§5` and nothing else, so criteria must stay binary and machine-checkable. Reviewer must be a different agent than the builder. Production promotion remains the one human click in the stack.
