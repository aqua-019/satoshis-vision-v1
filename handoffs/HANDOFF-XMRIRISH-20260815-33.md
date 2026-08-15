---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260815-33
branch: claude/prompt-attached-k50xej
status: in_progress       # open -> in_progress -> done | blocked
written_by: claude-code (manual mode — prompt-driven, no open handoff)
owner: claude-code
---

# HANDOFF — p3·12d VITALS CALIBRATION: the mempool ceiling, the silent abstention, and main's missing baseline

## 1 · GOAL

`verify-vitals` stops drawing tickets it cannot cash. Three things exist when this is
done that do not exist now:

1. `/live/mempool`'s LCP ceiling is **calibrated to the runner that judges it**, with the
   derivation written next to the literal — not a number carried over from a sandbox.
2. An INCONCLUSIVE/UNVERIFIABLE decline **prints the median and spread it declined to
   judge**, and shouts when that declined median is over its own ceiling. An abstention
   stops reading as a pass.
3. `main` carries **its own same-runner baseline**, so a future PR can difference against
   a measured tree rather than against a PR-head proxy.

Scope is the vitals INSTRUMENT. No src file is touched; `npm run build` must produce
byte-identical output.

## 2 · CONTEXT

- `main` = `fc5cfc1` (PR #179 merged over one evidenced red).
- Evidence base, all read from primary artifacts rather than retyped:
  - PR #179 comment 5297707533 (own).
  - CI runs **#159** (job 94795231881, head `f0fc8179`), **#160** (job 94830926198, head
    `d3aa03ee`), **#161** (job 94872852645, head `690ead63`) — `hardening gates` job logs.
  - p3·12b's paired local measurement, recorded in `CLAUDE.md`.
- Files: `app/verify-vitals.mjs`, `.github/workflows/ci.yml`, `CLAUDE.md`.

## 3 · SCOPE

IN: `/live/mempool` LCP ceiling · the decline/abstention output path in
`verify-vitals.mjs` · the `on:` trigger in `ci.yml` · minimal doc corrections where this
PR falsifies a recorded claim.

OUT (non-goals): every other vitals ceiling · every `verify-bundle` literal · the 30fps
`mem:perf` bar · the `totalJsRaw` construction · CSP hygiene · the gate census (77 files /
73 gates — recount, never increment) · any `src/**` change.

## 4 · CONSTRAINTS

- Node 22 / TS strict. No new dependencies.
- `verify-reporter.mjs` is a SHARED module (8 importers). Its four-counter contract
  (`passed · fixtured · skipped · failed`) must not grow a fifth counter in this PR.
- Two-polarity execution transcript per changed assertion or print, no truncation,
  summary line printed.
- Break-test protocol: mutate → observe red → `git checkout --` → `git status --short`
  clean → `grep -rn "MUTATION|BREAK TEST"` empty → re-run.
- CI must stay at **62** gate invocations. A `push:` trigger adds no `run:` line.

## 5 · DONE-CRITERIA — the gate reads ONLY this section

- [x] `npm run typecheck` exits 0
- [x] `npm run build` output is byte-identical to `fc5cfc1` (no src change)
- [x] `npm run verify:bundle` exits 0 with every literal untouched
- [x] `/live/mempool` `lcpMs` is derived from the observed CI plateau, with the
      arithmetic written in-file, and no other route's ceiling moved
- [x] a declined route prints its median LCP, its median blocking, both ceilings, and the
      LCP spread — demonstrated in a transcript
- [x] a declined median over its ceiling prints a WARNING banner — demonstrated in a
      transcript
- [x] a quiet skip is shown impossible: every decline path routes through one helper, and
      the forced-decline transcript shows all four routes printing
- [x] `npm run verify:vitals` runs at head on this runner, full output quoted, failure
      count stated
- [x] CI `run:` line count unchanged at 62; gate census unchanged at 77 files / 73 gates
- [x] `§3` decision taken out loud, with reasoning, in the PR body and in `ci.yml`

## 6 · VERIFY COMMANDS

```
cd app
npm run typecheck
npm run build && npm run verify:bundle
node scripts/serve-dist.mjs &   # own port, own dist — see the shared-dist race
npm run wait-preview
npm run verify:vitals
sed 's/#.*//' ../.github/workflows/ci.yml | grep -c '^\s*run:'      # == 62 gate lines? see §7
find .. -name 'verify-*.mjs' -not -path '*/node_modules/*' | wc -l  # == 77
```

## 7 · REPORT

See the PR body for the full report. Summary is appended to `handoffs/LOG.md`.

## 8 · LOOP FEEDBACK

- The brief asserted "The contention guard skips a route when its runs disagree >10%" and
  attributed #179's red to that guard. Measured: `/live/mempool`'s nine CI samples span
  **1.4%**, so the spread guard has never fired on that route. Both abstentions (#159,
  #160) came from the **CPU-probe** guard. The brief's §2 remains correct in substance —
  there are two decline paths and both were silent — but the mechanism it named was the
  wrong one of the two.
- The brief said "four releases of green on a ceiling that was never satisfiable". The
  measurable evidence covers **two** consecutive CI runs (#159, #160) in which
  `/live/mempool` was declined at 4080 and 4108 against a 4000 ceiling. Two is what is
  proven; four is not.
