---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260812-27
branch: claude/orbital-mempool-view-mwbkpu
status: done
written_by: claude-code (manual mode — task arrived as a prompt, no mockup)
owner: claude-code
---

# HANDOFF — p2·7 ORBITAL: the first net-new view, two new gates, a loud budget raise

## 1 · GOAL

`/live/mempool?v=orbital` serves a seventh mempool view that did not exist in any
form — the first of Phase 2's five net-new surfaces, built from
`docs/v6-mempool-views-spec.md:135-136` rather than from a mockup. It reads the
pending pool as a polar clock: radius is log fee/byte with the node's own fee
tiers drawn as concentric rings, bearing is arrival phase (one lap per block
target), and the transactions themselves orbit, so motion is the data advancing
rather than decoration. The two gates the spec has required since v6.0.3 —
`verify-tracking.mjs` and `verify-memstats.mjs` — exist, are registry-driven so
they sweep every view including the four still unbuilt, and are wired to npm and
CI. `verify-bundle`'s `lazyJsRaw` ceiling is raised once, loudly, with the red
quoted and the arithmetic rewritten.

## 2 · CONTEXT

- Spec: `docs/v6-mempool-views-spec.md` — shared contract `:35-124`, Orbital's
  paragraph `:135-136`, required gates `:146-152`.
- Contract: `claude/V2-VIEW-CONFORMANCE.md` Rev 4 (§1 primitives, §2 chart-kit,
  §4 tokens, §5 spacing ramp, §6 standing rules, §8 max-content/fit, §9
  assertion space, §10 the density PAIR).
- Standing mobile finding: `claude/FINDING-fit-scale-type.md`.
- Base: `main` = `1887edc` (PR #173, Ops Bridge v2·5, Phase 1 complete).
- Relevant files: `app/src/mempool/orbital.tsx` (new), `app/src/views/index.tsx`,
  `app/src/styles.css`, `app/verify-tracking.mjs` (new),
  `app/verify-memstats.mjs` (new), `app/verify-memviews.mjs`,
  `app/verify-bundle.mjs`, `app/package.json`, `.github/workflows/ci.yml`.

## 3 · SCOPE

IN: the new view + its registry entry; the three per-view map rows registration
demands; the two new gates and their wiring; the `lazyJsRaw` raise; whatever
layout defects measuring the new view exposes in the reflow layer it joins.

OUT (non-goals): rebuilding any of the six existing views; `eagerJsRaw` or any
other budget; the standing sub-12px type-floor gap; wiring `verify:pageshell`
into CI; the four remaining new views.

## 4 · CONSTRAINTS

- Stack: React 18 · Vite 5 · TS strict · Node 22. No new dependencies.
- Tokens only, no literal hex. Spacing from `--sp-1..7`. `PanelFrame`, never
  hand-rolled panel chrome. `canvasCursor` imported, never re-derived.
- `useMemCanvas`, never `useTick`, on a canvas path. No `ctx.shadowBlur`.
- Zero `Math.random()` outside `src/protocols/`. Zero fabricated readings — a
  missing figure is an em-dash.
- Do not touch: `api/`, `vercel.json`, `relay/`.

## 5 · DONE-CRITERIA — the gate reads ONLY this section

- [x] `npm run typecheck` exits 0
- [x] `npm run build` exits 0
- [x] `/live/mempool?v=orbital` resolves and mounts `.mem-view[data-mem-view="orbital"]`
- [x] `verify-memviews.mjs` green for all 7 views, with `DENSITY_FLOOR`,
      `EXPECT_SVG_TEXT` and `EXPECT_MEMSTAT` rows added from measured values
- [x] `verify-tracking.mjs` exists, is registry-driven, and is green on all 7 views
- [x] `verify-memstats.mjs` exists, is registry-driven, and is green on all 7 views
- [x] both new gates two-polarity break-tested, mutation proven applied AND effective
- [x] both new gates wired to npm AND to CI as individually-answerable steps
- [x] `lazyJsRaw` red quoted at 720,000, then raised with a stated margin ≤ 4,000 B
- [x] `eagerJsRaw` unchanged
- [x] naturalW measured in BOTH feed states at 1440 / 1280 / 390
- [x] `verify:static`, `verify:e2e`, `verify:fit`, `verify:mobile`,
      `verify:perf-runtime` green; `verify:pageshell` run by hand and reported
- [x] Branch pushed · draft PR opened · `mergeable_state` reported

## 6 · VERIFY COMMANDS

```
npm run typecheck
npm run build
npm run verify:bundle
npm run verify:static
node scripts/serve-dist.mjs &   # then:
npm run verify:e2e
npm run verify:tracking
npm run verify:memstats
npm run verify:fit
npm run verify:mobile
npm run verify:perf-runtime
npm run verify:pageshell
npm run verify:mem:perf
```

## 7 · REPORT

status: done — every §5 box checked.

pr: see LOG.md line for XMRIRISH-20260812-27.

commits: one feature commit on `claude/orbital-mempool-view-mwbkpu`.

deps added: none.

deviations from spec:
- `verify-fit`'s `VIEWS` / `FITS_AT_1440` were NOT given an orbital row. The brief
  made that conditional on registering `fit: true`; the view is fluid, so
  `verify-fit` correctly does not sweep it (Classic/Terminal precedent). Stated
  in the PR body rather than left silent.
- The brief's §2 tripwire list was incomplete: `verify-nav` §6 hardcodes the view
  count in five assertions plus a literal cascade string and is in `verify:e2e`.
  Registering a seventh view reddened 8 assertions on measurements that were all
  CORRECT, and because `verify:e2e` is an `&&` chain it also stopped the ten
  gates after it from running. Fixed by deriving the count from the registry —
  the property `verify-memshell` already asserts of the app.
- Three defects were found by rendering and had to be fixed inside this PR
  (fabricated block target; `.mem-canvas` pinned to 2:1 on phones, which is
  pre-existing and also hits sediment; the reflow layer collapsing MemTxTable's
  inline grid, pre-existing and also hitting Classic). Each is a scope decision
  made out loud in the PR body rather than a drift.

notes for ARCHITECTURE.md patch:
- Seven mempool views now, not six. Orbital is the first `fit: false, reflow: true`
  hero surface: naturalW == canvasW at 1440/1280/390 in both feed states, so no
  FitView transform and authored 11px renders at 11px at every width.
- `contain: inline-size` is the mechanism that makes a fluid view safe under
  `.mp-view { width: max-content }`. `minmax(0, 1fr)` alone is NOT sufficient —
  it bounds a track's automatic minimum, not its max-content contribution.
- Two new gates exist and are registry-driven: `verify-tracking.mjs` (61) and
  `verify-memstats.mjs` (36). They widen by themselves as the remaining four
  views land.
- `lazyJsRaw` 720,000 -> 736,000 (built 733,772, margin 2,228 B). It is a per-view
  loud raise and will fire four more times. `totalJsRaw` has 4,836 B of headroom and
  the next view crosses it.
- The shared <=768px layer is this PR's second subject. Three rules changed there;
  two fix PRE-EXISTING defects that reach sediment and Classic. `.mem-canvas` is
  mounted by exactly two files and `reflow: true` by exactly two views, so the blast
  radius is closed and nothing reaches /live/markets or /live/network.

open questions:
- `verify-vitals` was characterised idle per the operator's pre-committed protocol and
  the branch is GREEN (/live/markets median blocking 397ms then 392ms, both <= 400).
  The earlier 401/407 reds were contention; nothing was widened.
- `verify:mem:perf` FAILs for orbital (p5 17) and for sediment (p5 7, untouched).
  The 30fps bar at 6x throttle is met by no canvas view in the repo. Whether the
  bar or the views should move is a decision nobody has taken.
- No human has seen the rendered result.

## 8 · LOOP FEEDBACK

- `INFERRED` (things the brief did not say and I had to decide): the direction of
  fee on the radial axis; the orbital period; how to reconcile "concentric rings
  by fee tier" with "radius set by perB", which are discrete and continuous
  respectively. All three are recorded in orbital.tsx's header with the reasoning.
- `NOT-MATCHED` (cases the brief's registration-tripwire pattern cannot catch):
  any gate that hardcodes a per-view COUNT rather than holding a per-view MAP.
  `verify-nav` §6 was one; the brief's list was built from maps only. A future
  view should grep for the current view count as a literal across `verify-*.mjs`
  before assuming the list is complete.
- `SPEC-WAS-AMBIGUOUS`: "prefer the composition that never enters `.mp-fit`" reads
  as though fluid follows from not setting `fit: true`. It does not; the grid
  around the canvas is what decides, and the first build measured naturalW 2076.
- A break test of my own produced a FALSE NEGATIVE and nearly published it: the
  `verify-nav` mutation matched the first `MEMPOOL_VIEWS.map(` in MempoolPage.tsx
  (line 28's id list) rather than the switcher at line 166, so the gate stayed green
  and the derived assertion looked vacuous. Re-targeted, it reds 8. Always confirm the
  mutation reached the element the gate reads, not merely that it applied to the file.
- Gate convergence: one round. `verify-nav` red (8) -> green (0); `verify-vitals`
  characterised as environmental rather than fixed, with four runs of one tree
  returning 0/1/1/2 failures.
