---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260811-25
branch: claude/prompted-attachment-rv90jh
status: done               # open -> in_progress -> done | blocked
written_by: claude-code    # manual mode — task arrived as a prompt (v2·4 REACTOR)
owner: claude-code
---

# HANDOFF — v2·4 REACTOR: the artboard is content-derived, and that is the whole defect

## 1 · GOAL
Reactor is a `fit: true` view, so `FitView` wraps it in
`transform: scale(min(1, canvasW / naturalW))` (`useFitToView.ts:52`). Measured on
`bfa5e2a` at 1440×900 under a populated-mempool fixture, `naturalW` is **1668**
against `canvasW` **1180** — scale **0.707434**, so authored 11px type renders at
**7.78px**, and at 390×844 it renders at **2.6px**. `.mp-view` and `.mp-fit` are
`width: max-content`, so the artboard width is whatever the widest ROW demands and
it swings with the feed (1413 on an empty feed, 1668 populated).

When this is done Reactor's artboard is a **definite** width — 1180, by
construction, independent of how much data arrives — so `naturalW <= canvasW` at
the reference viewport and the view leaves `FitView`'s scaling path entirely at
1440. The operator's brief for this view is spacing, not density: it already
carries 130 readouts and no amount of spacing work is visible at 0.707.

## 2 · CONTEXT
- Base: `main` = `bfa5e2a` (PR #171: four orphan gates wired, `verify-perf` fixed).
- Prompt: v2·4, supplied in full by the operator.
- Contract: `claude/V2-VIEW-CONFORMANCE.md` at Rev 4 — §8 (the fit scale has two
  terms and both are properties of a composition), §5 (spacing ramp), §6
  (standing v6 rules), §10 (density is two numbers).
- Relevant files: `app/src/mempool/reactor.tsx` (the subject),
  `app/src/mempool/useFitToView.ts`, `app/src/mempool/FitView.tsx`,
  `app/src/styles.css` (`.mp-view` / `.mp-fit` at `:1229` / `:1252`),
  `app/verify-fit.mjs`, `app/verify-memviews.mjs`.
- **The mockup named by the brief, `reactor-v2.html`, is not in the tree and was
  not attached.** Its composition is reconstructed from the brief's §1 span list.
  Recorded as an absence rather than silently assumed — see §7.

## 3 · SCOPE
IN: `app/src/mempool/reactor.tsx` — a layout and spacing rebuild around the three
existing renderers (`MempoolHexGrid`, `IsoBlockStack`, `RingSigFan`); whatever
gate change the width target provably forces, with the reasoning recorded.
OUT (non-goals): the `HEIGHT_FIT_TOLERANCE` coverage gap; `useChartMetrics`'
unreachable `minWidth`/`k` inflation; sediment's 3281; `/future`'s two
`.main`-clipped overflows; moving Reactor between the fit / pan / reflow layers.

## 4 · CONSTRAINTS
- Stack: React 18 · Vite 5 · TS strict. Edit `app/src/**` only.
- Tokens only, no literal hex. Spacing from `--sp-1..7` (§5).
- `PanelFrame` for every panel; no hand-rolled panel chrome (§1).
- Zero `Math.random()` outside `src/protocols/`.
- Reduced motion suppresses ANIMATION, not CONTENT (§6).
- Do not touch: `api/`, `vercel.json`, `relay/`, `.github/`.

## 5 · DONE-CRITERIA — the gate reads ONLY this section

- [x] `npm run typecheck` exits 0
- [x] `npm run build` exits 0
- [x] `naturalW` measured on the SHIPPED composition at 1440×900, **fixtured and
      empty-feed**, and reported with `canvasW`, `naturalH`, `canvasH`, the
      resulting `.mp-fit` scale, and the rendered px for authored 11px — per the
      form §8 prescribes. Fixtured `naturalW <= canvasW` at 1180, or the
      measurement that blocks it is stated.
- [x] Which child established the old 1668, **measured** (clone-outside-the-grid
      demand, not inferred), and re-measured after.
- [x] `node verify-fit.mjs` completes and its summary line is green
- [x] `node verify-memviews.mjs` completes and its summary line is green
- [x] `node verify-mobile.mjs` completes and its summary line is green
- [x] `node verify-perf.mjs` completes and its summary line is green
- [x] `node verify-pageshell.mjs` completes and its summary line is green (npm-wired
      only — NOT in CI, so it is run by hand)
- [x] `node verify-coldboot-live.mjs` completes and its summary line is green
- [x] scenario 9 `reactor` readout count reported, both endpoints, `>= 114`
- [x] `EXPECT_SVG_TEXT.reactor` green at all four widths [390, 768, 1440, 2560]
- [x] `eagerJsRaw` / `lazyJsRaw` reported BUILT at both endpoints, never cited
- [x] every claimed fix carries a two-polarity break test — a mutation that reds
      the gate and a restore that greens it, with both counts reported, and the
      mutation proven to have APPLIED before the red is interpreted
- [x] design-reviewer returned APPROVE — bounded convergence, 2 rounds:
      round 1 FAIL (3 findings) -> 2 ACCEPTED+fixed, 1 CORRECTED (pre-existing;
      0 occurrences in the diff, disposition independently re-verified in round 2);
      round 2 APPROVE, covering the gate changes that round 1 predated.
- [x] Branch pushed · draft PR opened, `mergeable_state` reported

## 6 · VERIFY COMMANDS

```
cd app
npm run typecheck
npm run build
node scripts/serve-dist.mjs 4173 &        # single writer; identify the holder with lsof
node verify-fit.mjs
node verify-memviews.mjs
node verify-mobile.mjs
node verify-perf.mjs
node verify-pageshell.mjs
node verify-coldboot-live.mjs
node verify-bundle.mjs
```

## 7 · REPORT — filled on exit
status: done
pr: see LOG.md entry (draft PR from `claude/prompted-attachment-rv90jh`)
commits: 1 — `feat(reactor): definite artboard, 12-col grid, next-block cut`
deps added: none

### The headline, in §8's prescribed form
Measured on the SHIPPED composition at 1440x900, fixtured AND empty-feed (identical —
the artboard no longer moves with the feed):

```
                naturalW  canvasW  naturalH  canvasH   wS      hS      scale   11px renders
before fixtured     1668     1180      1201      702  0.7074  0.5845  0.7074      7.78px
before empty        1413     1180       991      702  0.8351  0.7084  0.8351      9.19px
after  both         1180     1180       851      702  1.0000  0.8249  1.0000     11.00px
before mobile 390   1668/1441 390      -         -    0.234/0.2706    same        2.57/2.98px
after  mobile 390   1180      390     3071       -    0.3305          0.3305      3.64px
```

**Qualified, because the unqualified version is false on a 1366 laptop:** reactor meets the
11px floor at viewport >= 1440 and <= 1279, and misses it across **1280-1439** (9.51px at
1280, 10.31px at 1366, 10.99px at 1439) and on mobile. That band is `styles.css:2149`'s rail
breakpoint, not the composition: crossing 1279 -> 1280 makes the canvas 259px NARROWER and it
does not recover 1180 until 1440. v2.4 did not create it, it REVEALED it — at naturalW 1668
every viewport was under the floor so nothing distinguished the band.

### Which child established the old 1668 — measured, not inferred
Clone-outside-the-grid max-content demand (allocation-free; `scrollWidth` on a grid item is
circular and was not used):

```
naturalW 1668 = row0 demand 1628 + 40px column padding
  row0 "1fr 380px"        1628 = blockstream 1236 + iso 380 + gap 12   <- THE DRIVER
     the ribbon's own .panel-b demanded 1234 of that 1236
  row1 "1fr 240px 320px"  1386 = hex 802 + 240 + 320 + 24
  row2 live tx feed        857
```
The driver DIFFERS by feed: fixtured it is row0 (the block ribbon grows with blocks),
empty-feed it is row1. That is why the old number was 1668/1413 rather than one number.

### Per-row heights, before and after — the number that speaks to the brief
```
                       before(922 state)   after      content delta
row1 block stream            271            226       ribbon 142 -> 155
row2 hex / iso               301.5          226       iso 150 -> 165, keycol 187 -> 167
row3 ring / pool / cut       331            229       ring svg 130 -> 150
shell chrome                 150             98       stat strip 66 -> 14 (compact)
naturalH                    1125            851
```
The spacing win was NOT spent on the ceiling: the ribbon, the iso stack and the ring fan are
all LARGER than the intermediate state, paid for out of chrome. On screen the view occupies
about the footprint it did before (828px rendered then, 851 now) at **1.42x the rendered
scale**.

### Gates — before / after, summary lines checked, not exit codes
```
verify-fit             22 ✅ 0 ❌   ->   46 ✅ 0 ❌   (+2 viewports, +1 assertion class)
verify-memviews       179 ✅ 0 ❌   ->  185 ✅ 0 ❌
verify-mobile      3 ✅ 0 ❌ 1 skip ->  3 ✅ 0 ❌ 1 skip
verify-perf        23 ✅ 0 ❌ 3 skip -> 23 ✅ 0 ❌ 3 skip
verify-pageshell      369 ✅ 0 ❌   ->  369 ✅ 0 ❌   (npm-only, run by hand)
verify-coldboot-live   22 passed    ->   22 passed   (brief said 21 — recount, do not increment)
verify-glide                        ->   22 ✅ 0 ❌
verify-bundle          27 ✅        ->   28 ✅
verify-reduce / memshell / chartkit / legibility  ->  32 / 53 / 52 / 25 ✅, 0 ❌
typecheck 0 · build 0
```

### Density, as the §10 PAIR
N (scenario 9, `[data-mem-body]`) **130 -> 147**, floor 114.
M (distinct `data.<field>` reads in reactor.tsx, from source) **8 -> 10**; the two new fields
are `blockWeightMedian` and `blockWeightLimit` — exactly the next-block-cut inputs.
A modest N rise against a real M rise: more surfaces onto the same feed, plus two new fields.

### Bundle — both endpoints BUILT, never cited
```
eagerJsRaw   263,456 -> 263,456   ZERO   (the brief's "if it moves, that is a finding")
lazyJsRaw    700,990 -> 702,407   +1,417 B
```
On-disk read of `dist/assets`; `verify-bundle`'s own table agrees (255.27 -> 255.27 KiB,
686.58 -> 687.96 KiB, i.e. +1,413 B by that table's rounding). Far under the series mean of
8,670 B per rebuild, because this is a layout rebuild rather than a new-visual one.

### Break tests — two polarity, mutation proven applied before any red was read
```
1 · FITS_AT_1440 defends the width fix
    mutate: drop `width: ARTBOARD_W` from the root
    applied: occurrences 1 -> 0 (verified before reading)
    MUTATED   45 ✅ 1 ❌   naturalW 3865, scale 0.305304, 11px -> 3.36px
    RESTORED  46 ✅ 0 ❌
    The PRE-EXISTING "scaled to fit" assertion PASSED at 3865. Only the new one caught it.

2 · EXPECT_MEMSTAT catches a KEY RENAME a cardinality check would miss
    mutate: `oldest` -> `age` in the COMPACT branch only
    applied: compact emits `age` x1, full strip still emits `oldest` x1
    MUTATED   183 ✅ 3 ❌   RESTORED  185 ✅ 0 ❌
    (one of the three reds is scenario 7's known sediment intermittent; it did not recur)
```
Restore owned by a `trap`, from a pre-mutation snapshot, and it rebuilds `dist/` — a `dist/`
built from a mutation survives a clean `git status`.

### Deviations from spec
- **The mockup `reactor-v2.html` does not exist** in the repo or the upload. The composition
  was reconstructed from the brief's span list, which tiles exactly once: `12 | 8+4 | 4+4+4`.
- **Two gate assertions changed, neither because it went red**, each because its subject
  stopped matching its claim: `verify-fit`'s 100%-toggle pan (asserts a symptom the fix
  removes) and its `mustScale` predicate (predicts a transform from width while the code
  derives it from width AND height). `:109`'s <=200 bound was the candidate third and was
  NOT touched — the 40px recovered from chrome made it unnecessary.

### Notes for ARCHITECTURE.md / contract patch
- **A `repeat(N, 1fr)` grid inside `width: max-content` does not lay out to its container.**
  Every track equalises to the widest track's max-content, so the element is
  `N x (widest track) + gaps` regardless of how narrow the other N-1 are. A definite width on
  the grid is not an optimisation; it is what makes the grid a grid. Break test 1 measured
  reactor at **3865** without it. The same structure is at `sediment.tsx:934`, and applying a
  definite width there at runtime takes sediment **3281 -> 1220** — so sediment's long-open
  width is this mechanism. Belongs next to §8 before Ops Bridge and the five Phase 2 views
  are built on twelve-column grids in the same canvas.
- The "co-equal drivers" framing of sediment is sharper stated as: there are not two
  co-equal heroes, there are twelve equalised tracks; only the maximum matters and there are
  twelve candidates for it. That is why single-column fixes measured exactly zero.
- Second independent sighting of **"a completion marker must be emitted by the thing that
  completed"**: `npm run build | tail -4 && echo BUILD_OK` printed BUILD_OK on a FAILED build,
  because a pipeline's exit status is the last command's. Worse than #171's instance — a
  green marker on an already-failed step.

### Open questions / located but not spent
- **`styles.css:2149` rail breakpoint, `max-width: 1279px` -> `1439px`** closes the
  1280-1439 type-floor band for every fit view in one line. Not taken: it moves layout for
  every view in that band, `verify-pageshell` is npm-only so CI would not catch fallout, and
  that same media block's duplicate at `:2643` is what hid Terminal's rail and cost #170.
- **Constellation is threshold-adjacent too** (natural 1132): it clears 1180 at >=1440 and
  falls off it in the same band. Two of four fit views, which is why the rail is the shared
  cause rather than a reactor quirk.
- **`verify-memstats.mjs` does not exist.** `mem-stats.tsx:158` justifies the whole raw-value
  design by citing it. Item 5 and the new key-set assertion are the only things checking the
  strip today.
- The fit/100% zoom control **renders at 390 while being incapable of changing the geometry
  there** (`.mp-view--fit` is clamped to the canvas). Pre-existing and previously untested.
- `TrackChip`'s `marginLeft: 2` (`mempool-shared.tsx:228`) is off-ramp and PRE-EXISTING —
  design-reviewer reported it as changed by this PR; it appears zero times in the diff.

## 8 · LOOP FEEDBACK
- **The brief named a mockup that does not exist.** `reactor-v2.html` is described as
  "approved, signed off" and is in neither the repo nor the upload.
- **The brief's `verify-coldboot-live` count (21) is one low** — the gate's own summary says
  22 passed. Same recount-don't-increment pattern this repo keeps hitting.
- **The brief's §0 desktop scale (0.9019) was wrong** and the operator corrected it mid-run to
  0.8351; my independent probe had already measured 0.835103.
- **The brief's §0 target and `verify-fit`'s toggle assertion were in direct conflict** and
  nothing said so: `naturalW <= canvasW` makes a >50px pan structurally impossible.
- **`INFERRED` earned its place twice.** The builder flagged that row 2 was key-column-bound
  at 187 against my stated "not binding" — it was right and I was wrong; and it named the
  `MemStatStrip.compact` dead branch, which became the 40px that saved the composition.
- **Two of my own new assertions were wrong on first draft and their own runs caught them**:
  relocating the pan test to 390 (a fit view cannot pan there — `.mp-view--fit` is clamped),
  and asserting a uniform `stripCount === 5` (Terminal emits 2 by design, a fact recorded in
  `verify-memviews:185`, ~100 lines above where I put the constant). A gate that goes red on
  its author's first draft is a gate.
