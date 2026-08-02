---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260802-10
branch: claude/verify-gates-performance-budgets-iwbv21
status: in_progress      # open -> in_progress -> done | blocked
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

- [ ] `npm run typecheck` exits 0
- [ ] `npm run lint` — **N/A, no such script**
- [ ] `npm run test` — **N/A**; the verify gates are this repo's tests
- [ ] `npm run build` exits 0 (11/11 routes prerender)
- [ ] `verify:all` exists and runs; the finish line's "verify scripts you ran" is
      nameable
- [ ] The gate-audit table is in the PR body and in this handoff: one row per gate
      not reached by CI, each with category, pass-or-fail today, and needs-egress.
      **Row count measured, not quoted.**
- [ ] Every new gate reports a **number**, not just pass/fail, and uses
      `makeReporter`'s separate `ok` / `skip` / `fixture` counters
- [ ] A deliberate 50KB bundle regression fails CI — proven, then reverted
- [ ] A deliberate CLS regression fails CI — proven, then reverted
- [ ] CLS thresholds re-measured on merged `main` and tightened from the #152
      values, with the measured numbers printed in the gate's own output
- [ ] The 0.0853 / 0.0841 unreserved-fallback discrepancy is stated once with its
      provenance, and the other sites point at it
- [ ] `/sources` is added to `verify-cls.mjs`'s `MEASURED`, with its own 8-run
      baseline. The four existing routes stay.
- [ ] `npm run verify:static` (17+), `npm run verify:e2e` (23+), `verify:all` and
      the **five** `api/verify-*.mjs` all green on the change
- [ ] The measured baseline is reported for LCP / INP / CLS / per-route bundle
      size
- [ ] Working tree clean; `grep -rn "MUTATION\|BREAK TEST" app/src app/*.mjs`
      empty **before** the final chain run
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

*(filled on exit)*

## 8 · LOOP FEEDBACK

*(none — prompt-driven, no cowork loop)*
