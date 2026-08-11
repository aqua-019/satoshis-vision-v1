---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260811-23
branch: claude/prompt-in-file-j9auvc
status: done              # open -> in_progress -> done | blocked
written_by: claude-code    # manual mode — task arrived as a prompt (v2·3 Terminal v2)
owner: claude-code
---

# HANDOFF — v2·3 Terminal v2 · chart-kit charts, density, and two gate corrections

## 1 · GOAL

`app/src/mempool/terminal.tsx` gains 3–5× the information it renders today and a set of
higher-fidelity charts built on `design/chart-kit.tsx`, without losing the three properties that
make Terminal structurally different from the other v2 views: it is **outside `FitView`**, it
**must pan at 390px**, and it carries `stats={false}` plus its **own nested `.rail`**.

Two corrections ship alongside, because the work cannot be verified without them:

1. `claude/V2-VIEW-CONFORMANCE.md` §6 says "390px usable, no horizontal scroll". For Terminal
   that is false and `verify-mobile.mjs:36-44` asserts the opposite. Rev 3 gains a named
   exception for pan-mode views.
2. `styles.css:2643` declares a **bare** `.rail { display: none }` in the 769–1199px band, which
   defeats the deliberate child-combinator at `:2157` and hides Terminal's nested rail. This is
   why `verify-pageshell`'s Terminal nested-rail assertion is **already red on `260c99f`**.

## 2 · CONTEXT

- Contract: `claude/V2-VIEW-CONFORMANCE.md` (Rev 3) — read with this handoff's §1, which
  overrides its §6 for Terminal.
- Base: `main` = `260c99f` (PR #169 merged), 2026-08-11. Branch is at `origin/main`, 0 ahead / 0 behind.
- Subject: `app/src/mempool/terminal.tsx` — **470 by `wc -l` / 471 by `split("\n").length`**.
- Shell consumed: `mempool-shared.tsx` (`MemViewShell`, `MemTxTable`, `useMempoolTracking`),
  `design/primitives.tsx` (`PanelFrame`, `NodeProvenance`), `design/chart-kit.tsx`,
  `mempool/mem-stats.tsx` (`useMemStats`, `BlockEta`, `fmtMMSS`).
- Terminal is registered `fit: false, reflow: false` (`src/views/index.tsx`) — it is
  rendered directly by `MempoolPage` in a plain `.mp-view`, per `FitView.tsx:11`.
- **Nine gates name `terminal`**: bundle · chartkit · memdetail · memshell · memviews ·
  mobile · nav · pageshell · reduce.

### Binding constraints, measured on `260c99f` rather than assumed

| constraint | source | value | headroom |
|---|---|---|---|
| view file line band | `verify-memshell.mjs:90-91` | `BAND_LO 200 · BAND_HI 1084` | 470 → 614 lines |
| all-JS raw ceiling | `verify-bundle.mjs:293` | `totalJsRaw 960_000` | 948,435 → **11,565 B** |
| `/live/mempool` gz | `verify-bundle.mjs:320` | `107_000` | 96,835 → 10,165 B |
| SVG-text expectation | `verify-memviews.mjs:647` | `terminal: [1440, 2560]` | bidirectional |
| pan at 390 | `verify-mobile.mjs:40` | `clientW<=420 && scrollW>=850 && left>50` | measured 900 |
| nested rail @1024 | `verify-pageshell.mjs:219` | non-`.shell`-child `.rail` visible, `w>0` | **RED on main** |

## 3 · SCOPE

**IN:** `app/src/mempool/terminal.tsx` (the subject) · `claude/V2-VIEW-CONFORMANCE.md` (§6
exception) · `app/src/styles.css` (the one over-reaching `.rail` selector at `:2643`) ·
`app/verify-memviews.mjs` (`EXPECT_SVG_TEXT.terminal` + a new information-density scenario) ·
this handoff · `handoffs/LOG.md`.

**OUT (non-goals):**
- Wiring `verify-mobile` / `verify-pageshell` / `verify-fit` / `verify-perf` into npm or CI.
  Four orphan gates are now recorded; wiring them is its own task.
- Fixing `verify-perf`'s three pre-existing failures.
- `useChartMetrics`' inert `k`/`u`/`minWidth` inflation (19 call sites).
- Any other mempool view. Any file in `api/`.
- The 11px-vs-12px type-floor standards conflict.

## 4 · CONSTRAINTS

- Stack: React 18 · Vite 5 · TS strict. `npm run build` runs `tsc --noEmit` first.
- Tokens only — no literal hex/hsl/rgb in the view. Spacing from `--sp-1..7`.
- Charts on `chart-kit`: `VB_W`, `AXIS`, `GRID`, `useSvgCursor`, `ChartCrosshair`, `ChartTip`,
  `useGradientId`. **Cursor math is never re-derived** — `verify-chartkit.mjs` greps
  `/clientX\s*-\s*rect\.left/` tree-wide with no allowlist outside `chart-kit.tsx`.
- Zero `Math.random()`. Zero fabricated values — a live number is real or it is an em-dash.
- **No peer readouts.** The restricted public pool reports 0 and the repo does not publish
  peer zeros at all.
- Reduced motion suppresses ANIMATION, not CONTENT. The body stays; the table is an addition.
- Keep `stats={false}`, the nested `<aside className="rail">`, and `id="terminal"`.
- Do not touch: `api/`, `vercel.json`, `package.json`, any other `src/mempool/*.tsx`.

## 5 · DONE-CRITERIA — the gate reads ONLY this section

- [x] `npm run build` exits 0 (includes `tsc --noEmit`)
- [x] `npm run verify:static` — all 21 gates green
- [x] `verify-memviews` completes (summary line present) and is green
- [x] `verify-memdetail` completes and is green
- [x] `verify-reduce` completes and is green
- [x] `verify-nav` completes and is green
- [x] `verify-mobile` completes and is green (Terminal still pans at 390)
- [x] `verify-pageshell` completes and is green — **including** the Terminal nested-rail
      assertion that is red on `260c99f`
- [x] `verify-chartkit` green with no new `clientX - rect.left` hit outside `chart-kit.tsx`
- [x] `verify-bundle` green, or the `totalJsRaw` arithmetic explicitly argued with in §7
- [x] `terminal.tsx` line count inside `verify-memshell`'s `200..1084` band
- [x] Information-density countable measured by ONE instrument on BOTH endpoints, before and
      after stated, and asserted with a floor so a regression reds
- [x] Five break tests run, each asserting its mutation APPLIED and reporting its effect size,
      each restored by an owner that survives the mutator's death, tree verified clean after
- [x] Branch pushed · PR opened **ready for review, not draft** · `mergeable` /
      `mergeable_state` reported

## 6 · VERIFY COMMANDS

```
cd app
npm run build
npm run verify:static
node scripts/serve-dist.mjs 4173 &          # own port; identify holder with lsof, never ps
node verify-memviews.mjs
node verify-memdetail.mjs
node verify-reduce.mjs
node verify-nav.mjs
node verify-mobile.mjs
node verify-pageshell.mjs
node verify-bundle.mjs
```

## 7 · REPORT — filled on exit, completely

status: **done**
pr: https://github.com/aqua-019/satoshis-vision-v1/pull/170
head measured: `43ecc8b` (every figure below taken on this SHA unless it says `260c99f`)
commits: 6 — contract Rev 4 (§6) · styles rail dedupe · scenario 9 · handoff ·
  contract Rev 4 (§2 + §10 + gate message) · the view rebuild · bundle re-derivation

deps added: none

**GATES — before on `260c99f`, after on `43ecc8b`. Counting method stated per gate
because §4's single method does not hold across all three output formats.**

| gate | before | after | note |
|---|---|---|---|
| `verify:static` (21) | exit 0 | exit 0 | |
| `verify-memviews` | 172 ✅ / 1 ❌ (173 asserts) | **179 ✅ / 0** | +6 = scenario 9, one per view |
| `verify-memdetail` | 39 / 0 | 39 / 0 | |
| `verify-reduce` | 31 / 0 | 31 / 0 | reporter |
| `verify-nav` | 128 / 0 | 128 / 0 | reporter |
| `verify-mobile` | 2 / 0 | 2 / 0 | no summary line at all |
| `verify-pageshell` | **367 ✅ / 1 ❌** | **368 / 0** | was red on main |
| `verify-bundle` | 25 / 0 @ 948,435 | **24 / 1 @ 964,046** | crossed, left RED deliberately |
| `verify-chartkit` | 52/52 | 52/52 | |
| `verify-memshell` | all owned passed | all owned passed | 973 lines, band 200–1084 |

**DENSITY — the pair, per contract §10.**

```
N  readouts under [data-mem-body]   97 -> 351   3.62x   (brief: 3-5x)
M1 distinct data.<field>            20 ->  23   +adjustedTime, hashSeries, protocol
M2 distinct feed leaf fields        29 ->  40   +11
```

M2 is the anti-padding guard and it is what makes the N claim honest: the view now
renders EVERY field of `Block` (9/9 — gained age, difficulty, pool, reward) and every
meaningful field of `Tx` (8/8 — gained age, inputs, outputs, ringSize). A tripled N
against a flat M would have been repetition; it is not.

**BUNDLE — both endpoints BUILT, neither cited.** `260c99f` built in an isolated
worktree with its own `dist/`; `43ecc8b` built in the main tree.

```
build(260c99f)  totalJsRaw 948,435       terminal chunk 20,361
build(43ecc8b)  totalJsRaw 964,046       terminal chunk 35,969
delta                     +15,611                      +15,608
index (eager)                     +3       everything else 0
/live/mempool first load  104,183 gz <= 107,000  (97%)  PASSES
```

**PREDICTION ON RECORD BEFORE THE BUILD: +5,000..+9,000 B. ACTUAL +15,611. I was
wrong by 1.7-3.1x**, and the error was assuming terminal would cost what the two
prior v2 rebuilds cost. It is the only one that added charts on top of text.

**CORRECTED AFTER REVIEW — my constellation delta was wrong, and the ceiling raise
is WITHDRAWN.** I derived constellation as `948,435 - 944,271 = 4,164`, taking the
left endpoint from `verify-bundle`'s own comment (`a67867e`, a BRANCH commit of the
sediment PR) rather than building it. The merged base is `fdf4ecc` — built and
measured at **945,306**, so constellation is **+3,129**. A cited endpoint where
this prompt asks for two built ones; off by 1,035 B, and it moved the mean.

```
fdf4ecc   945,306   (260c99f's first parent)      BUILT
260c99f   948,435   constellation +3,129          BUILT
head      964,046   terminal     +15,611          BUILT
sediment            +5,836  <- still CITED, not re-measured
mean 8,192 · spread 3,129 -> 15,611, a 5x range · 6 views remain -> ~1,013,000
```

So 960,000 was too low AND the 1,000,000 it was argued down from would also have
been crossed. The level was never the problem; the sample was. **`totalJsRaw` is
left at 960,000 and this PR ships it RED**, because twice now the answer to a
crossing has been a bigger number derived from too little, and the detector's own
docstring (`:247`) says it exists for "lazy code nobody has opened yet" — Terminal's
chunk IS opened, while the thing it actually protects did not move (eager +3 B,
route budget green at 97%). Subject-narrower-than-claim, in a budget's comment.

**WHERE THE +15,611 WENT**, measured by rebuilding with each group's render sites
removed so the components tree-shake, in an isolated worktree:

```
terminal chunk 20,361 -> 35,969                          +15,608
  minus the 3 charts          25,939     charts   10,030   (64%)
  minus the 4 readout panels  31,724     readouts  4,245   (27%)
  residual (status/env, imports)                   1,333    (9%)
```

A trim exists and it is the charts — removing them lands totalJsRaw at 954,013,
under the ceiling. Not taken: "higher fidelity charts" is the brief, and trimming a
LAZY chunk to satisfy a detector aimed at UNOPENED code costs the user information
to satisfy a metric that was not measuring them. The resolution is an
`eagerJsRaw`/`lazyJsRaw` split in its own PR with its own baselines.

Ceiling 960,000 -> 981,000, argued against the arithmetic in the gate's own comment
rather than the round number. The gate WORKED — it was sized to speak a third of the
way through a nine-view roadmap and it fired on view three, naming one view. What was
wrong is the per-view premise: 9 x 5,836 came from one observation; three are now
measured (5,836 / 4,164 / 15,611, mean 8,537). 981,000 = 964,046 + 2 x 8,537. The
minimum that clears (966,000) leaves 1,954 B — the exact condition the comment records
as the previous ceiling's failure. It does not make the roadmap fit: 7 x 8,537 projects
to ~1,023,805, still 42,805 B over.

**§8 FIT-SCALE APPARATUS IS INAPPLICABLE — a stated non-measurement, not a silent one.**
`FitView.tsx:11`: *"Classic/Terminal are rendered directly by MempoolPage without this
wrapper."* Terminal is registered `fit: false` (`src/views/index.tsx`), so there is no
`.mp-fit` transform, no `naturalW <= canvasW` budget, no `HEIGHT_FIT_TOLERANCE` band,
and authored 11px renders at 11px at every viewport. The width rule still applies in its
pan-mode form and was measured: **naturalW 1491 -> 1180 against canvasW 1180 at 1440**.
The pre-rebuild view already exceeded the canvas and panned on desktop; a 780px cap on
the main column removed it. (1180 is the `min-width: 100%` floor, so it reads as "content
now fits", not "content is exactly 1180 wide".)

**EXPECT_SVG_TEXT: [1440, 2560] -> [390, 768, 1440, 2560].** A tightening — those two
widths move from "must be exactly 0" to "must be > 0". Rail-only placement would have
kept the entry unchanged and hidden every new chart below 1200px; DOM charts would also
have kept it but are foreclosed by contract §2, whose chart-kit primitives are SVG-native.

**BREAK TESTS — five, each proving its mutation applied, reporting effect size, restored
by a trap plus an independent watchdog, tree verified clean after.**

| test | gate | green -> under mutation | effect size |
|---|---|---|---|
| cursor math re-derived | `verify-chartkit` | 52/0 -> 51/1 | failure names `terminal.tsx` |
| density (blocks table -> 0 rows) | `verify-memviews` | 179/0 -> 177/1 | N **351 -> 263**, floor 300 |
| rail over-reach restored | `verify-pageshell` | 368/0 -> 367/1 | rail hidden at 1024 |
| 900px pin removed | `verify-mobile` | 2/0 -> 1/1 | "canvas does NOT pan" |
| reduce gate removed | `verify-reduce` | 31/0 -> 29/2 | css 1, smil 0 |

deviations from spec: **§5's pan break test as written is structurally impossible.**
It says "narrow the composition until scrollW < 850". `styles.css:2438` pins non-fit
views to `width: 900px; min-width: 900px !important` at <=768, so Terminal's scrollW is
900 by CSS fiat and no composition change can move it. The test targets the pin instead,
which is the actual controlling mechanism. Same shape as v2·0's labels test.

notes for ARCHITECTURE.md patch: gate count unchanged at 71 — scenario 9 is a section
inside `verify-memviews`, not a new file. `verify:static` stays 21.

**THE COST OF SHIPPING IT RED, MEASURED — and it is larger than "one gate is red".**
`verify-bundle` runs as step 7 of the `build` job, and the `hardening gates` job
`needs:` it. So the deliberate failure does not merely mark the crossing:

```
CI run 31513481630 @ aa6e131
  Typecheck                success
  Build                    success
  Gate: bundle budgets     FAILURE     <- deliberate
  steps 8-21 (12 api gates)  skipped
  job "hardening gates"      SKIPPED   <- all 21 static + 29 e2e gates
```

**CI now proves nothing about the rest of this PR.** Every one of those gates was run
locally on the same head and is green — verify:static 21 · memviews 179/0 ·
memdetail 39/0 · reduce 31/0 · nav 128/0 · mobile 2/0 · pageshell 368/0 — but the
independent reproduction is gone, and this is the release where CI caught something
local runs could not on two previous rounds. This is a consequence of a deliberate
decision, not a defect, and it is recorded so the decision can be re-taken knowing
its real price. The cheapest fix if the coverage is wanted back is to move the
bundle gate out of `hardening gates`' dependency path rather than to change the
number.

open questions:
- Three gates were red on the untouched tree: `verify-perf` (3 failures), `verify-pageshell`
  (fixed here), `verify-memviews` (scenario 7 sediment, intermittent — passed on re-run).
  Two of the three are in no npm script and no CI.
- `MarketsThesisTab.tsx:198` ships a fixed 1000-unit viewBox on a live route with authored
  SVG text at 8.5-10px. No gate sees it, for two independent reasons. Recorded in §2.
- `useChartMetrics`' `k`/`u`/`minWidth` inflation is still inert app-wide.
- No human has seen the rendered result.

## 8 · LOOP FEEDBACK

- **PREFLIGHT paid for itself.** `ui-builder`'s reply corrected the brief three times
  before a line was written: `majorVersion` was already rendered (my brief listed it as
  missing), the main column needed an explicit `maxWidth` rather than trusting
  shrink-to-fit, and median tx age is not in `useMemStats`. `INFERRED` was the payload,
  exactly as the architecture predicts.
- **I gave the worker a wrong fact and had to correct it mid-flight**: I said Terminal's
  nested rail is hidden 769-1199 by `:2149`'s block. It is not — that rule is child-scoped
  and has never matched it. Corrected before it could reach a comment. The worker had
  already left the rail untouched, so no damage.
- **A spec-author review would have caught the stride clause; there was no second hop to
  run one.** The builder reused `i % xStep === 0 || i === n - 1`, the exact clause #167
  removed and contract §3 documents. Flat mode means the lead is the only reviewer, and it
  was caught by reading the diff rather than by a process step.
- **My own break-test harness reported success having run NOTHING.** `breaktest.sh` was
  created with Write and never `chmod +x`, so every invocation failed "Permission denied";
  the runner had no `set -e` and printed its completion marker unconditionally. Caught only
  because the log directory was empty. Then debugging it by piping through `head` SIGPIPE'd
  past the EXIT trap and stranded a mutation in the working tree — the exact hazard the
  harness exists to prevent, committed by the harness's own author while fixing it. Both
  fixed: exec bit set, per-test exit codes classified (a harness failure is now visibly
  distinct from a red gate), never pipe a mutating run through `head`.
- **A gate's completion line is gate-specific.** Three formats: reporter gates indent
  their marks (so `grep -c '^\(✅\|❌\) '` returns 1 for 128 assertions), `verify-memviews`
  matches the documented `raw = assertions + 1`, and `verify-pageshell`/`memdetail`/`mobile`
  have unmarked summaries. `verify-mobile` has no summary line at all.
