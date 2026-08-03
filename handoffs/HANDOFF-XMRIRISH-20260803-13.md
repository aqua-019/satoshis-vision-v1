---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260803-13
branch: chore/aqua-v4.1
status: in_progress     # open -> in_progress -> done | blocked
written_by: claude-code (manual mode — prompt-driven, self-authored per CLAUDE.md loopflow)
owner: claude-code
---

# HANDOFF — AQUA stack v4 → v4.1, exact-anchor patch

## 1 · GOAL

The AQUA orchestration stack config in this repo — `CLAUDE.md`'s per-repo block plus
the 12 agent definitions in `.claude/agents/` — moves from v4 to v4.1, carrying the
lead contract the prompt-07 pilot produced. When this is done, four rules that
currently exist only as pilot narrative are enforceable text in the stack:

1. **A verification artifact is `DONE` only with a two-polarity execution transcript
   per new or modified assertion** — a state that makes it pass and one that makes it
   fail, actuals for both; untouched assertions grandfathered. Artifact-level polarity
   is retired as sufficient evidence.
2. **Every claim in every return is one of exactly three kinds** — *executed* (output
   shown), *read* (cited with the state read at), or *UNVERIFIED*. Stale is a citation
   failure; fabricated is never acceptable; an APPROVE is a return like any other.
3. **Directors self-ID spawn mode as a mandatory FIRST output**, proven by attempting
   the delegation tool rather than assumed; the lead's report names every director it
   spawned, so one that was never created is visible as an absence.
4. **PREFLIGHT widens to mechanical-rule dispatches**, whose reply adds `NOT-MATCHED:`
   — the cases a handed-over pattern cannot catch — and assumption disposition becomes
   written (`ACCEPTED` / `CORRECTED` / `DEFERRED — <reason>`, every `DEFERRED` into §8).

Plus block prose synced: three rules not two, gate tooling added to the mandatory
re-judgment list, and cloud-session reality notes (`gh` absent, Stop hook machine-scope).

## 2 · CONTEXT

- **Source**: `PROMPT — AQUA stack v4 → v4.1, exact-anchor patch`, supplied to this
  session, corrected 2026-08-03 (four hyphens in the claim-kind insert restored to
  em-dashes so the agent files match the stack source byte-for-byte).
- **Origin of the amendments**: the pilot recorded in `handoffs/LOG.md` as
  `XMRIRISH-20260802-12` (v6.1.6, PR #159). Its findings, in the pilot's own words:
  two gates that could not go red under *any* tree (`R.ok(X || true, …)` and a `catch`
  collapsing a section to `R.skip`) both survived a file-level break test, "because
  break-testing a FILE proves the file can go red and says nothing about any individual
  assertion in it — which is how all 396 `R.ok` calls in this repo have ever been
  validated"; and an eleventh finding "sat three lines away in the same file", found
  only by re-reading the committed tree, so "a review handing you N findings is telling
  you where to LOOK and never how many there are."
- **Relevant files**: `CLAUDE.md` (per-repo stack block only, from
  `# Per-repo CLAUDE.md` to EOF) · all 12 `.claude/agents/*.md`.
- **Base**: `origin/main` at `2c30b94`, the commit the prompt states it was
  pre-validated against.

## 3 · SCOPE

**IN**: mechanical application of 17 `sub1()` anchor→replacement operations (44 total
assertions) across 13 files; the two-polarity verification report; branch, PR.

**OUT (non-goals)** — explicitly excluded, protects the loop from drift:
- Authoring, re-deriving, or "improving" any replacement text. The prompt supplies
  every change as anchor→replacement. Nothing is composed here.
- Any application code: nothing under `app/`, `api/`, `relay/`, `.github/`.
- `.claude/hooks/` and `.claude/settings.json` — untouched.
- Merging. The operator merges by hand.

## 4 · CONSTRAINTS

- Config only — no application code, no dependency changes, no build changes.
- Do not touch: `app/`, `api/`, `relay/`, `.github/`, `.claude/hooks/`,
  `.claude/settings.json`.
- `CLAUDE.md`'s project-memory head (everything above `# Per-repo CLAUDE.md`) must be
  byte-identical after the patch. The patch script hash-asserts this and aborts on
  mutation; it is additionally verified by eye in the diff.
- Any `ANCHOR FAIL [name]` is the **designed exit**, not a problem to work around:
  stop, report the anchor name, do not hand-apply the change.
- New dependencies: none permitted.

## 5 · DONE-CRITERIA — the gate reads ONLY this section

Fail state, recorded **before** the patch ran (these prove the pass-state checks are
capable of failing):

- [ ] `grep -c "AQUA-STACK-VERSION: v4.1" CLAUDE.md` → `0`
- [ ] `grep -rl "NOT-MATCHED" .claude/agents | wc -l` → `0`
- [ ] `grep -rl "exactly three kinds" .claude/agents | wc -l` → `0`

Pass state, after the patch:

- [ ] `grep -c "AQUA-STACK-VERSION: v4.1" CLAUDE.md` → `1`
- [ ] `grep -c "AQUA-STACK-VERSION" CLAUDE.md` → `1` (total — no stale marker left behind)
- [ ] `grep -rl "NOT-MATCHED" .claude/agents | wc -l` → `11` (10 workers + the `director-build` reference)
- [ ] `grep -rl "exactly three kinds" .claude/agents | wc -l` → `10`
- [ ] `grep -rl "execution transcript" .claude/agents | wc -l` → `3` (`test-engineer`, `director-build`, `director-quality`)
- [ ] `grep -rl "mandatory FIRST output" .claude/agents | wc -l` → `2`
- [ ] `grep -rl "a floor, never a census" .claude/agents | wc -l` → `1`
- [ ] tier split from `.claude/agents/*` frontmatter → `3 sonnet / 7 haiku / 2 claude-opus-5`
- [ ] `grep -c "^# Per-repo CLAUDE.md" CLAUDE.md` → `1`
- [ ] `grep -c "^## Loopflow core" CLAUDE.md` → `1`

Composition proof — the agent files carry the four em-dashes of the corrected source,
which **no `CLAUDE.md` check can establish**: the em-dashes live only in the agent
files, and the corrected and pre-correction prompts produce a byte-identical
`CLAUDE.md` tail (same sha256). These two rows are the only decisive evidence:

- [ ] `cat .claude/agents/*.md | sha256sum` → `f641086f5985cd28b4763c96de6a58585bb8ba798965e253d304e8d6fb78f13c`
      (glob sorts deterministically. The corrupted variant hashes `d2a7fe0b…` — if that
      appears, the extraction came from the pre-correction file: **stop and report**.)
- [ ] `grep -c 'A \*stale\* claim — true of the tree' .claude/agents/ui-builder.md` → `1`,
      and the hyphen form `'claim - true of the tree'` → `0` (human-readable canary)

Scope fence:

- [ ] on the patch commit, `git status --porcelain` shows exactly **13** paths, all
      `.claude/agents/*.md` or `CLAUDE.md`
- [ ] nothing under `app/`, `api/`, `relay/`, `.github/`; not `.claude/hooks/`,
      not `.claude/settings.json`
- [ ] `git diff CLAUDE.md` shows **no hunk above the stack block**

Exit:

- [ ] Branch `chore/aqua-v4.1` pushed · PR opened **ready for review, not a draft**
      (a draft reports `mergeable_state: draft`, which makes the mergeable check
      unsatisfiable by construction)
- [ ] PR reports `mergeable: true`, `mergeable_state: clean`, every check **concluded**
- [ ] **Not merged.** The operator merges by hand.

## 6 · VERIFY COMMANDS

Exact commands, in order.

```
grep -c "AQUA-STACK-VERSION: v4.1" CLAUDE.md
grep -c "AQUA-STACK-VERSION" CLAUDE.md
grep -rl "NOT-MATCHED" .claude/agents | wc -l
grep -rl "exactly three kinds" .claude/agents | wc -l
grep -rl "execution transcript" .claude/agents | wc -l
grep -rl "mandatory FIRST output" .claude/agents | wc -l
grep -rl "a floor, never a census" .claude/agents | wc -l
grep -c "^# Per-repo CLAUDE.md" CLAUDE.md
grep -c "^## Loopflow core" CLAUDE.md
cat .claude/agents/*.md | sha256sum
grep -c 'A \*stale\* claim — true of the tree' .claude/agents/ui-builder.md
git status --porcelain
git diff CLAUDE.md
```

`npm run typecheck` / `lint` / `test` / `build` are **N/A**: this change touches no
file the build reads. CI runs the full suite on the PR regardless (the workflow has no
path filter), which is the real check.

## 7 · REPORT — claude code fills this on exit, completely

status:
pr:
commits:
deps added:
deviations from spec:
notes for ARCHITECTURE.md patch:
open questions:

## 8 · LOOP FEEDBACK

<!-- appended when verify fails, and per CLAUDE.md when a brief proves thin -->
