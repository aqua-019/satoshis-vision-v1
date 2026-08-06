---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260805-18
branch: claude/orb-position-listener-race-pc570p
status: done                 # open -> in_progress -> done | blocked
written_by: claude-code (manual mode — prompt-driven, no cowork handoff existed)
owner: claude-code
---

# HANDOFF — v6.1.11 the orb's position: one wrong listener target, one base-rect race

## 1 · GOAL

After this task the Home orb tracks `#hm-orb` through a scroll at every viewport width
rather than only at ≤768px, and the cold-boot orb is drawn as a circle on every cold load
rather than as an ellipse on some of them. Two new `verify-orb.mjs` sections make both
machine-checkable — one with a ≤768px positive control that already passes today, one
sampled over ten cold loads and asserted on the worst — and one pre-existing
`verify-coldboot.mjs` precondition is tightened so the second fix cannot turn an
always-green assertion into a usually-green one.

## 2 · CONTEXT

- Base: `origin/main` at `06e60fe` (PR #164, v6.1.10).
- Prompt: v6.1.11, pasted into this session. Issue 2 was recorded as instance fifteen in
  `HANDOFF-XMRIRISH-20260805-17.md` §7/§8 and deliberately left unfixed there.
- Relevant files: `app/src/coldboot/{Orb,ColdBoot,ColdBootConsole}.tsx`,
  `app/src/coldboot/gate.ts`, `app/src/routes/useRouteChrome.ts`, `app/src/styles.css`,
  `app/verify-{orb,coldboot}.mjs`.
- Approved plan: `/root/.claude/plans/prompt-v6-1-11-shiny-peach.md`.

**Premise verification (§2 rule).** Two of the prompt's own premises were checked against
the tree before building on them, and one is wrong:

1. *Correct.* "`styles.css:674` gives `.main` `overflow-y: auto` … `styles.css:2053`'s
   `@media (max-width: 768px)` block sets `.main, .main--fluid { height:auto;
   overflow:visible }` at `:2075-2077`." Both read exactly as stated.
2. *Wrong, and it changes the cost story.* The prompt says the capture-phase listener
   "fires for every scrollable element on the page — the telemetry rail, the console's own
   panes, the matrix". The telemetry rail is **not rendered on Home**:
   `PageShell.tsx:66` defaults `rail = false`, so `AppShell.tsx:73` renders `null` and
   `.rail`'s `overflow-y:auto` (`styles.css:641`) never exists there. The console's panes
   only exist while the splash is up, and during the splash `useHomeOrbRect` is disabled
   entirely, so it has no listener registered at all. The adversarial design review
   independently asserted the opposite (that `NetRail` *does* render on Home); it was
   settled by reading `PageShell.tsx:66`. Because two readings of the same codebase
   disagreed, the cost probe enumerates Home's live scroll containers itself rather than
   trusting any CSS reading — see §8.

## 3 · SCOPE

IN:
- `Orb.tsx`'s scroll-tracking target, its rAF coalescing and its identity-stable commit.
- `ColdBoot.tsx`'s orb store: sequencing the two rect sources, and scoping the base freeze
  to the handoff travel rather than to the whole splash.
- `verify-orb.mjs` §8 (scroll drift, four viewports) and §9 (rendered-vs-backing-store
  aspect, ten cold loads).
- `verify-coldboot.mjs` §4's precondition, which fix 2 would otherwise make racy.

OUT (non-goals):
- The z-index / stacking question on Home. Measured and reported as `R.info`; a change
  there is an operator decision (`Orb.tsx:562-578` argues against a permanent raise).
- `#hm-orb` moving because content *above* it reflows — a fourth movement source that
  fires neither `resize` nor `scroll` nor its own `ResizeObserver`. Named in the docblock,
  recorded in §8, not fixed.
- `ORB_ASSEMBLE_FROM`'s duplicate encoding and `PANE_STYLE`'s missing `overflow`, both
  carried from v6.1.10.

## 4 · CONSTRAINTS

- Stack: React 18 · Vite 5 · TS strict · Node 22. No new dependencies.
- No hardcoded `#main` / `.main` in `Orb.tsx` — the scroller is a stylesheet decision that
  already changes at a breakpoint.
- The ENTER handoff must still travel by transform, never by re-layout (#163 CLS fix).
- `/` CLS stays 0.0000 healthy and degraded.
- `coldBootOffBrowser` must never appear in `verify-orb.mjs`.
- Zero new CSS.

## 5 · DONE-CRITERIA — the gate reads ONLY this section

- [x] `npm run typecheck` exits 0
- [x] `npm run build` exits 0 (it runs `scripts/prerender.mjs` in plain Node, which is what
      catches a module-scope `window` reference in `ColdBoot.tsx`)
- [x] `npm run verify:static` exits 0 (21 gates)
- [x] `npm run verify:bundle` exits 0
- [x] all six `api/verify-*.mjs` exit 0
- [x] all 29 `verify:e2e` gates exit 0, each run individually with its real exit code read
      before any pipe
- [x] `verify-orb` §8 asserts drift ≤1px at 1440×900, 769×900, 768×900 and 390×844, at
      several depths, each with a precondition that the box actually moved
- [x] §8 break-tested by restoring the window-only listener: `held` reds at ≥769 and stays
      green at ≤768, with every precondition green at all four widths
- [x] `verify-orb` §9 asserts the orb canvas's rendered aspect matches its backing store
      over ≥10 cold loads, asserted on the worst sample, distribution printed
- [x] §9 break-tested by deterministically reintroducing the race: §9 reds while §7's
      `onSlot` and §5's backing-store assertion both stay green
- [x] the chosen listener mechanism's cost measured against the alternative and reported
- [x] `verify-coldboot` §4's travel distance re-measured across several runs and reported
      as stable-or-not, with the distribution
- [x] `git status --short` clean; no break-test mutation left in the tree
- [x] Branch pushed · PR opened against `main` via the GitHub MCP, ready for review (not a
      draft), `mergeable_state: clean`

## 6 · VERIFY COMMANDS

```
npm ci
npm run typecheck
npm run build
npm run verify:static
npm run verify:bundle
node ../api/verify-nodehealth.mjs && node ../api/verify-tx-parse.mjs && node ../api/verify-feeds.mjs
node ../api/verify-markets.mjs && node ../api/verify-status.mjs && node ../api/verify-nodes.mjs
node scripts/serve-dist.mjs &   # then each verify:e2e gate individually
```

## 7 · REPORT

status: done
pr: (opened against main after this commit — link appended in the PR body's own commit)
commits: `b8560af` fix 1 + §8 · `04ee208` fix 2 + §9 + verify-coldboot precondition · this one, records
deps added: none
deviations from spec: one, and it grew the change. The plan named a single base-rect
  defect (the cold-boot race). A second instance of the SAME defect was found while
  fixing it — the freeze keyed on `active`, which is true for the whole splash, so a slot
  resize during the console phase produced the identical non-uniform scale by another
  route. Fixing only the first would have left §9 reddening intermittently on a tree I
  had called fixed, so `travelling` scopes the freeze to the ENTER ramp. Also: the
  operator chose to clip the orb to its scrolling column (a decision surfaced mid-work,
  not in the plan) after the tracking fix exposed a 61px topbar bleed.

### The numbers

Defect 1, reproduced on `06e60fe` and fixed:

```
viewport   scroller                 drift BEFORE   drift AFTER
1440x900   main#main.main               400.0          0.0
1280x800   main#main.main               400.0          0.0
 900x800   main#main.main               400.0          0.0
 769x900   main#main.main               400.0          0.0
 768x900   html (document)                0.0          0.0   <- positive control
 390x844   html (document)                0.0          0.0   <- positive control
```

Defect 2, 1920x1080 cold loads: BEFORE 1/10 SCALED at ratio 0.6411,
`matrix(0.8352, 0, 0, 1.3017, ...)`, store 660x450 (Home's box) — AFTER 14/14 identity,
worst ratio 1.0006.

Listener cost, mechanism A (capture-phase on `document`, shipped) vs B (resolved
ancestor), 3 runs per cell, counters harness-side except one temporary draw counter:

```
viewport (live census)          realistic 60-step   burst 60-in-1-task   CROSS-TALK
1440x900 (main only)      A/B   60 ev/60 rd/60 cm    1 ev/1 rd/1 cm      0/0/0
 769x900 (main+nav-main)  A     60 ev/60 rd/60 cm    1 ev/1 rd/1 cm      20 ev/20 rd/0 cm
 769x900 (main+nav-main)  B     60 ev/60 rd/60 cm    1 ev/1 rd/1 cm      20 ev/ 0 rd/0 cm
 390x844 (document)       A/B   60 ev/60 rd/60 cm    1 ev/1 rd/1 cm      0/0/0
```

Zero long tasks in every cell. Structural zeros, measured: off Home `[data-orb]` count 0,
0 rect reads, 0 draws; during the splash 0 rect reads and 0 commits. **A's entire cost
over B is 20 rect reads for 20 nav-strip scroll events, and A converts them to zero
renders and zero redraws.** B was rejected on correctness — its "actually overflowing"
predicate is content- and therefore time-dependent — not on those 20 reads.

Topbar bleed (created BY the tracking fix; it does not exist on `main`, where the frozen
orb never enters the band): 61px capped, 13% of a 468px orb at 1440x900 and 23.7% of a
257px orb at 769x900, flat across depth rather than growing. After the clip: 0.0px at
every viewport and depth, confirmed in a screenshot as well as in arithmetic.

`clip-path` paint order, WITHIN-BRANCH A/B (toggle the clip off at runtime, sample inside
the KEPT region — sampling the same absolute point before and after would red a correct
fix, since the clipped band legitimately stops hitting the orb):

```
1440x900 @400   applied/off/restored: orbIdx 7, depth 13, z auto — above identical
 769x900 @120   applied/off/restored: orbIdx 7, depth 12, z auto — above identical
above = div#hm-orb.hm-orb · section · div.page-shell · main#main.main · div.shell ·
        div.art-stage · div.art     (byte-identical in all six states)
```

A first pass sampled 769 at depth 400, where the 257px orb is essentially fully clipped:
`orbIdx -1` in all three states, i.e. it compared "orb absent" with "orb absent" and could
not have detected a reorder. Re-run at 120. Recorded because it is the same
subject-narrower-than-claim shape this repo keeps finding, in my own probe.

CLS on this branch, `layout-shift` buffered, installed pre-script, 1440x900, 3 runs:
cold boot → ENTER `0.00000` before ENTER and `0.00006` after, every run, the single entry
`span.prov · span.mono` (provenance text, not the orb); Home direct `0.00000`, no entries.
Identical to the pre-change baseline. The ENTER handoff still contributes exactly zero.
`verify-coldboot` §4 travel: `144.5px` on 3 pre-change runs and 3 post-change runs —
stable, as predicted once the race is closed.

`verify-govern` on this branch: 39 rAF call sites (baseline 38 — the +1 is the new
coalescer), 9 driver files, **12 exempt at the call site, unchanged**, because no
`D0699-EXEMPT` marker was added: `Orb.tsx` matches the gate's `SHARED` test through a real
`observeDrawable` import and never reaches the marker path. 50 passed / 0 failed.

### Break tests, both run, and WHICH assertion reddened

§8 — revert only the listener target to `window`, changing nothing else:
`held` RED at 1440x900 and 769x900 with |Δ| equal to the scroll offset exactly
(120.00 / 400.00 / 800.00); all six `held` at 768x900 and 390x844 GREEN; every
precondition GREEN at all four widths. 186 passed · 5 failed.

§9 — reintroduce the race deterministically (revert `useHome`, revert the freeze to
`active`, delay the console publish 600ms): §9 RED 10/10 at ratio 0.6411 while §7's
`onSlot` (402x527 vs 402x527), §5's "backing store tracks its CSS box" and §5's
"not 300x150" all stayed GREEN. 190 passed · 1 failed. That green-while-red result is the
evidence §9 covers ground the existing assertions could not.

A first attempt at the §9 break test reverted `useHome` ALONE and did not reproduce —
§9 stayed green 10/10. That is a real finding rather than a broken break test: the
`travelling` scoping alone re-anchors the base as soon as the console rect arrives. The
two changes fix different failure modes and neither is redundant — `live` keeps the orb
from ever being laid out at Home's rect during the splash, `travelling` handles a slot
resize once it is there.

### Chain

`npm ci` · `typecheck` 0 · `build` 0 · `verify:static` (21) 0 · `verify:bundle` 0 ·
six `api/verify-*.mjs` 0 · **29/29 `verify:e2e` 0**, each run individually with its exit
code read before any pipe. `verify-orb` 191 passed / 0 failed; `verify-cls` 20/0;
`verify-vitals` 17/0; `verify-coldboot` 82/0.

`verify-coldboot-live` reddened once on the first final pass, with
`STALE DIST: serving a build of b8560afb while HEAD is 04ee2083` — I had built before
committing, so the stamp was one commit behind. Content-identical, and the gate was right
to refuse. Rebuilt after the commit and re-ran all 29.

`verify-motion` §3 (`[reduce] the transition still ran — >=1 animation on a
::view-transition-* pseudo`) failed **once in 18 runs** on this branch and **0 in 14** on
a clean `06e60fe` build. Seventeen consecutive branch runs after it passed. The assertion
is about View Transition pseudos under reduced motion, which nothing here touches. Called
UNCALIBRATED for this hardware, not "pre-existing" — 0/14 on base does not prove that.

notes for ARCHITECTURE.md patch: none. No CLAUDE.md edit either, checked rather than
assumed: both new sections live inside the existing `verify-orb.mjs`, so 71 gates /
57 CI-reached / `verify:static` 21 / `verify:e2e` 29 are all unchanged, and nothing in
Development Conventions or Architecture Notes describes the orb's listeners or base rect.

open questions: whether the orb should be in-flow inside `#hm-orb` on Home rather than
viewport-fixed. See §8.

## 8 · LOOP FEEDBACK


- **A NEW SUB-SHAPE of the standing family (instance sixteen).** Every prior instance was
  an assertion whose SUBJECT was wider or narrower than its CLAIM. This one is not an
  assertion at all: it is CODE whose assumption about its ENVIRONMENT is conditional on a
  breakpoint declared in another file. `Orb.tsx:267`'s `window` scroll listener is correct
  at <=768px, where the document scrolls, and inert at >=769px, where `styles.css:674`
  makes `main.main` the scroller — and `Orb.tsx` never mentions `styles.css`. The
  docblock three lines above it described the tracking accurately and was still wrong
  about the outcome. Nothing in the suite scrolled, so 118 green assertions in
  `verify-orb.mjs` could not have caught a 1:1 decoupling.

- **The fix for one instance can mask another, and the break test is how you find out.**
  §9's first break test reverted `useHome` alone and stayed GREEN 10/10. The `travelling`
  scoping was silently covering the race. Had the break test been skipped, or had it been
  written to assert only "something went red", both changes would have shipped with one of
  them unproven.

- **A probe that mutates scroll state and reads geometry in the same task measures the
  pre-listener frame.** Confirmed independently on both sides of this task. §8's settle is
  three rAFs plus a macrotask for exactly this reason, and it is deliberately NOT
  `waitForFunction(drift <= 1)` — that predicate IS the assertion, so it would turn a red
  into a timeout-then-red and make the break-test transcript incomparable to the green one.

- **A within-page A/B beats a cross-commit comparison, and its sampling point is part of
  the claim.** My own first paint-order run sampled 769x900 at a depth where the orb is
  fully clipped, compared "absent" with "absent", and reported `true`. Re-run at a depth
  where the orb is under the sample. Same shape as everything else in this ledger.

- **A count's subject is the lines matching a string, not the thing being counted.**
  `grep -c "setOrbState("` returns 8 on the base tree; seven are call sites and one is the
  definition. This branch has eight call sites (those seven, converted, plus the new `live`
  corrector) and one definition.

- **A stale `dist` is a stale claim.** `verify-coldboot-live`'s build-SHA check caught a
  build made one commit before HEAD. Build AFTER committing, or the stamp lies.

- **`getComputedStyle()` returns a LIVE declaration** — stash the object and a later read
  reports the element's state then, not at capture. And Chromium re-serializes: authored
  `inset(61px 0 0 0)` computes to `inset(61px 0px 0px)`, so a gate asserting the authored
  string reds on a correct fix. Both avoided here by snapshotting to plain strings inside
  one evaluate, and by asserting `clipPath === 'none'` rather than a positive string.

- **CARRIED, not fixed, and now with numbers.** CLAUDE.md's Known Issues still says the
  desktop ENTER handoff "carries real CLS ... counted CLS 0.0232-0.0434". Measured on a
  clean `06e60fe` and again on this branch: `0.00000` before ENTER and `0.00006` after,
  three runs each, and the single entry is `span.prov · span.mono` rather than the orb.
  That entry appears to describe the pre-#163 layout-driven travel. NOT edited here,
  because this PR does not make it false — it was already stale against `main`.

- **Open, and named so the clip reads as a choice rather than the only idea anyone had:**
  the structurally correct answer is to render the orb IN-FLOW inside `#hm-orb` on Home,
  where it would scroll naturally and be clipped by `main`'s own `overflow:auto` for free,
  needing neither a scroll listener nor a `clip-path`. It is unavailable in this PR
  because the orb must be viewport-fixed during the ENTER handoff — it lerps across the
  cut while `ColdBoot` unmounts, and cannot be a child of `#hm-orb` while the splash owns
  the screen. A two-element hand-off would be worse than the clip.

- **Still uncovered, and named in the docblock rather than left implied:** `#hm-orb` can
  move with no scroll, no viewport resize and no size change of its own, when content
  ABOVE it reflows. It needs a different observer target, not a re-measure on the 24fps
  tick — that would be a poll, and `verify-govern` §5 exists to stop this repo shipping
  polls.

- **The FOUC console warning, triaged and NOT a work item.** A report of "Layout was forced
  before the page was fully loaded" is not this site's JS and there is no flash to have:
  with a stylesheet held back 2.5s, `/` and `/learn` show 0 layout reads before
  `complete`, 0 white frames of 33 and 39 sampled, and `rgb(5,5,5)` from first commit. The
  two inline `<head>` scripts contain zero layout-forcing calls; the only code that could
  force layout is the deferred module bundle, which cannot run while a stylesheet blocks
  scripts. It is a Chromium message, so Firefox and therefore Tor Browser do not emit it.
  **It does not interact with this PR:** the new scroll listener lives in that same
  deferred bundle and cannot run before the stylesheet resolves. Recorded so the next
  person who hears the report does not re-triage it.
