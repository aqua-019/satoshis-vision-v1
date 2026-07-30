---
handoff: v1
project: <LUXXPOOL | XMR.IRISH | DJPEPE.WTF | CUSTOMPEN>
task_id: <PROJ>-<YYYYMMDD>-<nn>
branch: <feat/short-name>
status: open            # open -> in_progress -> done | blocked
written_by: cowork
owner: claude-code
---

# HANDOFF — <one-line task name>

## 1 · GOAL
One paragraph. What exists when this is done that does not exist now.
Outcome, not procedure.

## 2 · CONTEXT
- ARCHITECTURE.md sections: <refs>
- claude.ai thread(s) referenced: <title or link>
- Relevant files: <paths>
- Research findings from cowork: <links / notes>

## 3 · SCOPE
IN: <what this task covers>
OUT (non-goals): <explicitly excluded — protects the loop from drift>

## 4 · CONSTRAINTS
- Stack: <per project — e.g. React 19 / Vite / TS strict / Node 22>
- Design system: dark glassmorphism · indigofera structural · monero
  orange for XMR accents only · JetBrains Mono · SVG icons only · zero emoji
- New dependencies: allowed only if recorded in §7 REPORT
- Do not touch: <paths, configs, env files>

## 5 · DONE-CRITERIA  — the gate reads ONLY this section
Every box must be binary and machine-checkable. If it can't be verified
by a command or a visible artifact, rewrite it until it can.

- [ ] `npm run typecheck` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run test` exits 0 (or stated N/A with reason)
- [ ] `npm run build` exits 0
- [ ] <task-specific acceptance #1 — observable, binary>
- [ ] <task-specific acceptance #2>
- [ ] design-reviewer returned APPROVE (UI/payment changes)
- [ ] Branch pushed · PR opened via `gh pr create`

## 6 · VERIFY COMMANDS
Exact commands, in order. These are what the hooks run.

```
npm run typecheck
npm run lint
npm run test
npm run build
```

## 7 · REPORT  — claude code fills this on exit, completely
status:
pr:
commits:
deps added:
deviations from spec:
notes for ARCHITECTURE.md patch:
open questions:

## 8 · LOOP FEEDBACK  — cowork appends here when verify (step 04) fails
<vercel build / runtime errors, minimal context, dated>
