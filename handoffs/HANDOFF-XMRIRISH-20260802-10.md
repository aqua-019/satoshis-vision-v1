---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260802-10
branch: claude/verify-gates-performance-budgets-iwbv21
status: done             # open -> in_progress -> done | blocked
written_by: claude-code (manual mode — prompt-driven, self-authored)
owner: claude-code
---

# HANDOFF — v6.1.5 PR A: performance budgets in the verify gates (the ruler)

## 1 · GOAL

The repo has 59 verification gates and every one of them checks *correctness*.
Nothing checks *cost*. When this is done there are two new gates that measure
bytes and Core Web Vitals, both hard-failing in CI; a recorded baseline for LCP,
blocking time, worst scripted interaction, CLS and per-route bundle size, each
stamped with the harness and commit that produced it; a `verify:all` command that
finally names something concrete; and a measured audit table of every gate CI
does not reach. Nothing the site does changes — that is what makes the baseline
mean anything, and it is proven rather than asserted.

## 2 · CONTEXT

- Branched from origin/main at **5fca6ba** (the merge of #155, prompt 05's PR D).
- Source of this task: prompt 06 of 19, prompt-driven with no pre-existing
  handoff file. Its *Verify — PR A* list is §5 below, verbatim.
- Prior handoff: `handoffs/HANDOFF-XMRIRISH-20260802-09.md` (prompt 05 PR D).
- Relevant files: `app/vite.config.ts`, `app/verify-cls.mjs`, `app/verify-lib.mjs`,
  `app/verify-reporter.mjs`, `app/scripts/serve-dist.mjs`, `app/scripts/routes.mjs`,
  `.github/workflows/ci.yml`, `app/PERF-BASELINE.md`.
- Plan: `/root/.claude/plans/v6-1-5-performance-unified-seal.md`, approved after
  three review rounds.

**The seam.** The prompt carries nine work items. Items 1–4 build the ruler;
items 5–9 move the thing being measured. They cannot honestly share one PR: item
1 says "set the initial thresholds from a measurement of `main`", and if the same
PR also splits chunks and adds containment then the baseline describes a tree the
PR itself is rewriting. **This handoff is PR A (items 1–4). PR B is not opened
here.**

**Premise audit.** The prompt's own gate inventory is accurate at `5fca6ba`:
61 files (56 app + 5 api), 2 shared libs, 59 gates; `verify:static` 17,
`verify:e2e` 23, 10 CI by-name, **45 reached**; Set B 3, Set C 11, **14
unreached** — the arithmetic closes at 45+3+11=59. Corrections it did not state
are recorded in §7.

## 3 · SCOPE

IN:
- D1751 Core Web Vitals as budgets (LCP, interaction latency, blocking time),
  measured in a new gate, thresholds calibrated on the CI runner.
- D1727 bundle analysis in CI with a visualiser artifact, zero new dependencies.
- D1784 hard byte budgets that block the merge.
- D1728 vitals on `/`, `/mempool`, `/markets`, against `serve-dist`, no egress.
- `verify:all`; `/sources` added to `verify-cls`; CLS re-baselined and given a
  mocked pass; the 0.0853/0.0841/~0.07 reconciliation; the gate-audit table.

OUT (non-goals):
- **Items 5–9 of the prompt** — INP optimisation, component-level code splitting,
  `content-visibility`, CSS containment, passive listeners. That is PR B.
- **Wiring any of the 14 unreached gates.** The audit table is the deliverable;
  wiring is a later decision, made per-gate on evidence.
- **Adding compression to `serve-dist`.** It changed once already (#155's 501);
  changing it again would invalidate the numbers this PR records.
- Any change that alters what the site renders.

## 4 · CONSTRAINTS

- Stack: React 18 · Vite 5 · TS strict · Node 22 · Playwright 1.60 · Vercel.
- `api/` is mixed CJS/ESM — match the file being edited, not a rule.
- CSP `connect-src 'self'`; no third-party browser requests, ever.
- `Math.random()` only in `app/src/protocols/`.
- New CSS in `@layer components`; a new stylesheet must join
  `verify-legibility`'s `STYLESHEETS`.
- **New dependencies: none.** The zero-dep decision is an operator condition;
  `app/package-lock.json` must come out byte-identical.
- Do not touch: `vite.config.ts`'s `manualChunks` / `chunkFileNames` /
  `entryFileNames` and their Tor-cache reasoning; `app/scripts/serve-dist.mjs`;
  `handoffs/HANDOFF-*.md` other than this file.
- No session note appended to `CLAUDE.md`.

## 5 · DONE-CRITERIA

- [x] `npm run typecheck` exits 0
- [x] `npm run lint` — **N/A, no such script**
- [x] `npm run test` — **N/A**; the verify gates are this repo's tests
- [x] `npm run build` exits 0 — **11/11 routes prerender**
- [x] `verify:all` exists and runs — **50 commands · 0 failed · 485 passed · 6 fixtured
      · 0 skipped · 0 failed**, every command named in its own output
- [x] The gate-audit table is in the PR body and in this handoff: one row per gate
      not reached by CI, each with category, pass-or-fail today, and needs-egress.
      **Row count measured, not quoted.**
- [x] Every new gate reports a **number**, not just pass/fail, and uses
      `makeReporter`'s separate `ok` / `skip` / `fixture` counters
- [x] A deliberate 50KB bundle regression fails CI — **run #63**, `Gate: bundle
      budgets` → FAILURE in 34s. Report printed `eager 127.6 KB gzip · 32 chunks`
      against the 78.05 KB / 35-chunk baseline. Reverted; `git diff 924c57f HEAD
      -- app/src/pages/HomePage.tsx` empty.
- [x] A deliberate CLS regression fails CI — **run #66**, `verify-cls` →
      `8 passed · 0 fixtured · 0 skipped · 2 failed`, and nothing else failed:
      `degraded · /mempool CLS 0.0841 ≤ 0.005` · `healthy · /mempool CLS 0.1102
      ≤ 0.005`. CI reproduced the sandbox figures to four decimals. Reverted;
      `git diff 924c57f HEAD -- app/src/pages/MempoolPage.tsx` empty.
- [x] CLS thresholds re-measured (8 runs/route/pass) and **tightened** from #152's
      0.01/0.01/0.02/0.01 to a uniform **0.005**; printed every run
- [x] The 0.0853 / 0.0841 unreserved-fallback discrepancy is stated once with its
      provenance, and the other sites point at it
- [x] `/sources` added to `MEASURED` **and** `MEASURED_MOCKED`, 8-run baseline each
      (0.0000 on 8 of 8 in both passes). The four existing routes stay.
- [x] `verify:static` (**17**), `verify:e2e` (**24**), `verify:all` and the **five**
      `api/verify-*.mjs` all green
- [x] Measured baseline reported for LCP / interaction / CLS / per-route bundle size
      — `app/PERF-BASELINE.md` § Current, every row harness-stamped
- [x] Working tree clean; the break-test grep is empty **before** the final chain run
      — and two gate headers were reworded because they quoted the banned token in
      prose, which had made the grep match forever and stop being a check
- [ ] Branch pushed · PR ready for review (not draft) · `mergeable: true`,
      `mergeable_state: clean`, every CI check concluded green

## 6 · VERIFY COMMANDS

```
cd app && npm ci
npm run typecheck && npm run build
npm run verify:static
npm run verify:bundle
node verify-tiers.mjs
node ../api/verify-nodehealth.mjs && node ../api/verify-tx-parse.mjs \
  && node ../api/verify-feeds.mjs && node ../api/verify-markets.mjs \
  && node ../api/verify-status.mjs
node scripts/serve-dist.mjs & npm run wait-preview
npm run verify:e2e
CLS_RUNS=8 node verify-cls.mjs --measure
npm run verify:all
```

## 7 · REPORT

**status:** done. Both break-test boxes are closed with CI evidence. Items 1-4 landed; items 5-9 are PR B and are
explicitly not in this PR — see §3 OUT and the seam argument in §2.
**pr:** see `handoffs/LOG.md`.
**deps added:** none. `app/package-lock.json` is byte-identical to `origin/main`.

### The gate audit — 14 gates CI does not reach, every row RUN, not inferred

Re-derived at `5fca6ba`: 63 `verify-*.mjs` files (58 `app/` + 5 `api/`) minus 2
shared libraries = **61 gates**; CI reaches **47**; **14** do not. Each was
executed against `node scripts/serve-dist.mjs` on :4173.

**Cat B** = wired to an npm script CI never runs (the worse category — they
*look* wired). **Cat C** = wired to no npm script and named in no CI job.

| gate | cat | exit | time | result |
|---|:-:|:-:|--:|---|
| `verify-shots` | B | 0 | 342s | **vacuous pass** — wrote 387 screenshots, compared none |
| `verify-perf-classic` | B | 0 | 25s | **vacuous pass** — took the INCONCLUSIVE path (0.99x ratio) and exited 0 |
| `verify-memperf` | B | 0 | 18s | **vacuous pass** — all 6 views `n/a — DOM/SVG`, yet prints "every canvas view holds >=30fps" |
| `verify-chart-legibility` | C | **1** | 17s | 57 passed · 7 failed — real assertions |
| `verify-desktop` | C | 0 | 7s | passes |
| `verify-fit` | C | 0 | 9s | passes |
| `verify-gradients` | C | 0 | 11s | passes |
| `verify-legality` | C | 0 | 4s | passes — 26 assertions |
| `verify-mobile` | C | 0 | 8s | passes |
| `verify-pageshell` | C | **1** | 46s | Terminal's nested `.rail` still visible at 1024 |
| `verify-perf` | C | **1** | 48s | un-gated `setInterval` in `src/design/useFreshClock.ts`; pre-paint stamp `tier=low hydrated=true` |
| `verify-responsive` | C | 0 | 90s | passes — 131 assertions, widest coverage of any orphan |
| `verify-sims` | C | 0 | 41s | passes |
| `verify-v508` | C | **1** | 42s | `TimeoutError` — **self-marked HISTORICAL** |

**Roll-up, and the number that matters is not 10.**

- **4 of 14 exit non-zero.** But **3 of the 10 that exit 0 measure nothing**, so
  only **7 of 14 genuinely pass**. Counting exit codes would have reported 10
  and been wrong in exactly the way this batch keeps re-learning.
- **`verify-memperf` is the sharpest example in the repo of a gate passing what
  it never checked**: every one of its six views reports `n/a — DOM/SVG (no rAF
  loop to sample)` and it then prints `✅ every canvas view holds >=30fps at the
  5th percentile`. Zero views measured, all views claimed.
- **A fourth instance turned up in MY OWN CI wiring**, not in the orphans:
  `actions/upload-artifact@v4` skips hidden files, so `app/.perf/` uploaded
  nothing while the step reported success. Same species as the two above —
  a green result standing in for work that never happened — and it survived
  precisely because the failure mode was a warning, not an error. Recorded
  here rather than only in the fix's commit message, because the pattern is
  the finding, not the YAML key.
- **`verify-perf-classic` is the live proof of the INCONCLUSIVE hazard** that
  shaped `verify-vitals.mjs`. It printed `⚠️ INCONCLUSIVE … Exiting 0` and its
  exit code says success. That is why the new gate reports `R.skip()` — a
  counted outcome in the tally — instead of copying the pattern.
- **Zero of the 14 need third-party egress.** The only third-party hosts named
  in any of them appear in comments explaining why they mock instead.
- **All 14 need `serve-dist` + Playwright.** `verify-perf`'s §8 static block is
  the only browserless section among them.
- **2 need an artifact CI cannot produce**: `verify-shots` (a baseline shot tree
  from another commit) and `verify-perf-classic` (a second server on a
  pre-change worktree).
- **10 of 14 call `.route()` zero times**, so they exercise a fully degraded
  feed under the post-#155 harness — the same defect class #155 found in 10 of
  the then-22 `verify:e2e` gates.
- **Orphaned *and* stale: `verify-v508`** — header line 8 calls it HISTORICAL,
  it iterates 15 simulator ids against an app shipping 21, `:95` admits a check
  "has been failing ever since — for the wrong reason", and it now times out.

**`verify-perf` found real drift while being audited**: `src/design/useFreshClock.ts`
carries an un-gated `setInterval` that is not in its allowlist. That file
postdates the gate. Reported, not fixed — wiring and fixing these is the later
per-gate decision this table exists to inform.

**No gate was wired in by this PR.** Two have previously been resolved this way
— `verify-v510` deleted as dead code, `verify-future` fixed and wired — both
individually, on evidence. That pattern is kept deliberately: wiring all 14
wholesale would trade one silent problem for a red build.

### Three findings from the break test itself

Each is worth more than the gate it came from, and all three are the same
species as the audit-table findings below: a check that reports success while
having verified nothing.

1. **`git checkout -- <file>` restores from the INDEX, so it silently no-ops on
   an already-committed break.** I used it to revert the bundle half, the break
   was already in `HEAD`, and the command did nothing — CI ran the identical
   regression twice more and I read the second red as a new problem rather than
   the same one. This is v6.1.3's uncommitted-mutation failure recurring inside
   the very PR that adds the gate meant to catch it. **The correct idiom is
   `git checkout <sha> -- <file>`**, and the revert must then be *proven*:
   `git diff <sha> HEAD -- <file>` empty, not assumed.

2. **A failing `build` job silently skips every hardening gate.** `verify`
   declares `needs: build`, so two red builds produced ZERO e2e evidence and the
   absence looked like nothing had gone wrong — the `verify` check simply did
   not appear. Any break test that trips a `build`-job gate can therefore never
   prove anything about a `verify`-job gate: the two proofs must be separate
   commits. Structural, not a one-off.

3. **`actions/upload-artifact@v4` skips hidden files by default**, so
   `app/.perf/` uploaded NOTHING while the step stayed green and logged only
   `No files were found with the provided path`. The visualiser this release was
   asked for did not exist on any run, and a warning inside a green step is
   exactly how that stays true for months. Fixed with `include-hidden-files:
   true` and `if-no-files-found: error` — the second half matters more than the
   first, because it converts a future silent regression into a failure. Now
   confirmed uploading: `there will be 4 files uploaded` (bundle report) and
   `1 file uploaded` (vitals).

### Deviations from spec

- **`verify:all` is not wired into CI**, by design. CI runs `build` and `verify`
  in parallel; the orchestrator would serialise them for zero extra coverage.
- **The `/` CLS defect is recorded, not fixed.** Fixing it would change runtime
  behaviour and destroy the equality that makes this PR's baseline meaningful.
- **No test-only global ships.** The plan considered `__XMR_NO_RESERVE__` in
  `MempoolPage.tsx`; the CLS break test is driven harness-side instead, so PR A
  touches no app source except one comment.

### Open questions

- `MempoolPage.tsx:210` said `~0.07 CLS`, which matches neither recorded run
  (0.0841 / 0.0853). Third unrecorded measurement, or a slip? Corrected to
  ~0.085 with a pointer to the single source of truth.
- Neither CLS pass exercises the Markets charts (`{groups:{}}` fixture), so the
  case that justified `/markets`' old looser ceiling is unmeasured.

## 8 · LOOP FEEDBACK

*(none — prompt-driven, no cowork loop)*
