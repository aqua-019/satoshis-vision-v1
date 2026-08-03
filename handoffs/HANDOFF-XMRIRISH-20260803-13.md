---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260803-13
branch: chore/aqua-v4.1
status: done            # open -> in_progress -> done | blocked
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

- [x] `grep -c "AQUA-STACK-VERSION: v4.1" CLAUDE.md` → `0`
- [x] `grep -rl "NOT-MATCHED" .claude/agents | wc -l` → `0`
- [x] `grep -rl "exactly three kinds" .claude/agents | wc -l` → `0`

Pass state, after the patch:

- [x] `grep -c "AQUA-STACK-VERSION: v4.1" CLAUDE.md` → `1`
- [x] `grep -c "AQUA-STACK-VERSION" CLAUDE.md` → `1` (total — no stale marker left behind)
- [x] `grep -rl "NOT-MATCHED" .claude/agents | wc -l` → `11` (10 workers + the `director-build` reference)
- [x] `grep -rl "exactly three kinds" .claude/agents | wc -l` → `10`
- [x] `grep -rl "execution transcript" .claude/agents | wc -l` → `3` (`test-engineer`, `director-build`, `director-quality`)
- [x] `grep -rl "mandatory FIRST output" .claude/agents | wc -l` → `2`
- [x] `grep -rl "a floor, never a census" .claude/agents | wc -l` → `1`
- [x] tier split from `.claude/agents/*` frontmatter → `3 sonnet / 7 haiku / 2 claude-opus-5`
- [x] `grep -c "^# Per-repo CLAUDE.md" CLAUDE.md` → `1`
- [x] `grep -c "^## Loopflow core" CLAUDE.md` → `1`

Composition proof — the agent files carry the four em-dashes of the corrected source,
which **no `CLAUDE.md` check can establish**: the em-dashes live only in the agent
files, and the corrected and pre-correction prompts produce a byte-identical
`CLAUDE.md` tail (same sha256). These two rows are the only decisive evidence:

- [x] `cat .claude/agents/*.md | sha256sum` → `f641086f5985cd28b4763c96de6a58585bb8ba798965e253d304e8d6fb78f13c`
      (glob sorts deterministically. The corrupted variant hashes `d2a7fe0b…` — if that
      appears, the extraction came from the pre-correction file: **stop and report**.)
- [x] `grep -c 'A \*stale\* claim — true of the tree' .claude/agents/ui-builder.md` → `1`,
      and the hyphen form `'claim - true of the tree'` → `0` (human-readable canary)

Scope fence:

- [x] on the patch commit, `git status --porcelain` shows exactly **13** paths, all
      `.claude/agents/*.md` or `CLAUDE.md`
- [x] nothing under `app/`, `api/`, `relay/`, `.github/`; not `.claude/hooks/`,
      not `.claude/settings.json`
- [x] `git diff CLAUDE.md` shows **no hunk above the stack block**

Exit:

- [ ] Branch `chore/aqua-v4.1` pushed · PR opened **ready for review, not a draft**  <!-- postdates this commit; see §7 -->
      (a draft reports `mergeable_state: draft`, which makes the mergeable check
      unsatisfiable by construction)
- [ ] PR reports `mergeable: true`, `mergeable_state: clean`, every check **concluded**  <!-- postdates this commit; see §7 -->
- [x] **Not merged.** The operator merges by hand.

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

**status:** done. All 44 anchor assertions applied without failure. 19 of 21 §5 boxes
ticked with evidence below; the 2 unticked describe events that postdate this commit
(disclosed, see *deviations*).

**pr:** opened from `chore/aqua-v4.1` immediately after this commit — URL, mergeable
state and check conclusions are recorded in the session report and appended to
`LOG.md`. Ready for review, not a draft: a draft reports `mergeable_state: draft`,
which makes the mergeable criterion unsatisfiable by construction.

**commits:** three.
1. `a8475eb` docs(handoff) — this file, `status: in_progress`, committed ahead of the
   patch so the patch commit's fence reads exactly 13.
2. `3744610` chore(stack) — the patch. **13 files, +57 / −24.**
3. this commit — §7, ticks, `status: done`, LOG.md line.

**deps added:** none. No `package.json`, no lockfile, no build input touched.

### Fail state — recorded BEFORE the patch, proving the checks can fail

| Check | Measured |
|---|---|
| `grep -c "AQUA-STACK-VERSION: v4.1" CLAUDE.md` | **0** |
| `grep -rl "NOT-MATCHED" .claude/agents \| wc -l` | **0** |
| `grep -rl "exactly three kinds" .claude/agents \| wc -l` | **0** |

Three further pre-patch zeros were recorded beyond the prompt's trio, so every
pass-state row below has a measured fail-side counterpart rather than three of ten:
`"mandatory FIRST output"` → **0**, `"a floor, never a census"` → **0**,
`"execution transcript"` → **0**.

### Pass state — measured after the patch

| Check | Expected | Measured |
|---|---|---|
| `grep -c "AQUA-STACK-VERSION: v4.1" CLAUDE.md` | 1 | **1** |
| `grep -c "AQUA-STACK-VERSION" CLAUDE.md` | 1 | **1** |
| `grep -rl "NOT-MATCHED" .claude/agents \| wc -l` | 11 | **11** |
| `grep -rl "exactly three kinds" .claude/agents \| wc -l` | 10 | **10** |
| `grep -rl "execution transcript" .claude/agents \| wc -l` | 3 | **3** — `director-build`, `director-quality`, `test-engineer` |
| `grep -rl "mandatory FIRST output" .claude/agents \| wc -l` | 2 | **2** — `director-build`, `director-quality` |
| `grep -rl "a floor, never a census" .claude/agents \| wc -l` | 1 | **1** — `director-quality` |
| tier split from frontmatter | 3/7/2 | **3 sonnet · 7 haiku · 2 claude-opus-5** |
| `grep -c "^# Per-repo CLAUDE.md" CLAUDE.md` | 1 | **1** |
| `grep -c "^## Loopflow core" CLAUDE.md` | 1 | **1** |
| `cat .claude/agents/*.md \| sha256sum` | `f641086f…f13c` | **`f641086f5985cd28b4763c96de6a58585bb8ba798965e253d304e8d6fb78f13c`** |
| em-dash canary in `ui-builder.md` | 1 / 0 | **1 em-dash form · 0 hyphen form** |

### Scope fence

`git status --porcelain` on the patch commit: **exactly 13 paths**, all
`.claude/agents/*.md` or `CLAUDE.md`. Nothing under `app/`, `api/`, `relay/`,
`.github/`; not `.claude/hooks/`, not `.claude/settings.json` — verified by an
inverted grep that returned empty.

`git diff CLAUDE.md`: **6 hunks, lowest touched line 638**, against a stack-block
header at line **636** — every hunk below it. Verified independently of the script's
own assertion by diffing `HEAD:CLAUDE.md` against the working tree: project-memory
head **46,343 chars, sha256 identical both sides**. Stack block after the patch:
**16,354 chars / 16,526 bytes**, sha256
`06F990F741FA2ED892CD869138BE582913E7BB29AD905C764A756005AAD933DC` — matching the
prompt's stated composition.

**deviations from spec:** two, both disclosed rather than absorbed.

1. **Three commits instead of one.** The prompt's 13-path fence and this repo's
   loopflow (a handoff is mandatory for prompt-driven work) are in direct conflict.
   Resolved by the operator: the fence's real content is *no application code*, and a
   handoff is a record, not code. Committing the handoff first makes the patch
   commit read exactly 13 with nothing weakened.
2. **Two §5 exit boxes are unticked in this commit** — they describe the PR, which
   postdates it. This is stated rather than silent: `LOG.md` entries for #156 and #157
   both read `done` while boxes sat unticked and nothing mechanical caught it. A box
   ticked before its evidence exists is precisely the fabricated-claim species v4.1
   adds provenance for, so they stay unticked here and are closed in a follow-up
   commit once the PR reports its state.

**notes for ARCHITECTURE.md patch:** none. No architectural surface changed — this is
orchestration config only. `CLAUDE.md`'s project-memory head is byte-identical, so no
project-memory statement was altered, added, or invalidated.

**open questions:** none blocking. One measurement worth recording: CI reaches **50
distinct `verify-*.mjs` gates** at `2c30b94` — executed, by resolving `ci.yml`'s
10 individually-named steps plus `npm run` indirection into `verify:static` (19) and
`verify:e2e` (25) and de-duplicating. A first count returned 49 by missing the
`npm run verify:bundle` indirection and was corrected. This agrees with `CLAUDE.md`'s
stated 50 and supersedes the 47 figure, which was correct for `0e7f73b` — PR #159
raised it 47 → 50, as its own LOG entry states.

## 8 · LOOP FEEDBACK

<!-- appended when verify fails, and per CLAUDE.md when a brief proves thin -->

**2026-08-03 · operator correction to a lead claim — the first v4.1 rule catching its
own author.** The plan asserted that the stack-block sha256 matching
`06F990F7…933DC` proved the agent files carried the corrected source's four
em-dashes. It proves no such thing: the em-dashes live **only** in
`.claude/agents/*.md`, and the corrected and pre-correction prompts produce a
byte-identical `CLAUDE.md` tail — the operator ran both and got the same hash. Every
other row in the prompt's own pass-state table also passes on the corrupted variant,
so the published table could not discriminate the two compositions at all. That is a
*read* claim carrying an *executed* claim's weight, which is exactly the species the
three-kinds rule added in this very patch exists to stop.

Two rows were added to §5 as the fix, and both are now the only decisive evidence in
the gate: `cat .claude/agents/*.md | sha256sum` → `f641086f…f13c` (corrupted variant
`d2a7fe0b…`), and a human-readable em-dash canary in `ui-builder.md`. Extraction
source was additionally checked *before* writing anything — 4 em-dashes, 0 hyphen
forms in the claim-kind insert of the uploaded prompt.

**Standing lesson for the next revolution:** a hash proves only what is *inside* the
bytes it covers. When a correction lands in file set A, a hash over file set B is not
weak evidence of it — it is no evidence, and it reads as strong. Name the file set a
check covers before claiming what it establishes.

**Second, smaller:** the same session stated "the full 50-gate suite runs" with no
citation. The figure was right for this tree but arrived at without measurement, and
disagreed with the number the operator held. Measuring it produced 49 on the first
attempt — wrong, because `npm run verify:bundle` indirection was missed — then 50.
Both the bare figure and the first measurement would have shipped unchallenged.
