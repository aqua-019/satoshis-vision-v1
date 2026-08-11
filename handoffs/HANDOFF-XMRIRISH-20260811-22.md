---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260811-22
branch: claude/constellation-v2-contract-rev3-51rqon
status: done              # open -> in_progress -> done | blocked
written_by: claude-code    # manual mode — task arrived as a prompt (v2·2), self-authored
owner: claude-code
---

# HANDOFF — v2·2 Constellation hero + contract Rev 3

## 1 · GOAL

`app/src/mempool/constellation.tsx` is rebuilt to the approved `constellation-v2-1`
composition: the sphere is the hero, ~190 nodes with limb darkening so it reads as a volume
rather than a disc, tier is colour, position is propagation state, size is weight. Every node
opens the shared transaction inspector and every block glyph opens the shared block inspector —
`tx-detail.tsx` is not reimplemented. The view composes at 3 tx as well as 190. `ConCard`, the
hand-rolled panel chrome, is gone in favour of `PanelFrame`.

`claude/V2-VIEW-CONFORMANCE.md` is at Rev 3, carrying the three deltas learned in v2·1 plus one
correction found while writing it: the contract's own §6 reduced-motion rule was false.

## 2 · CONTEXT

- Contract: `claude/V2-VIEW-CONFORMANCE.md` (Rev 2 → Rev 3 in this PR)
- Finding: `claude/FINDING-fit-scale-type.md` (**did not exist on `fdf4ecc`** — added here so
  Rev 3 §8's citation resolves; content supplied by the operator)
- Base: `main` = `fdf4ecc` (PR #168 merged), 2026-08-11
- Subject file: `app/src/mempool/constellation.tsx` (503 by `wc -l` / 504 by the gate's
  `split("\n").length`)
- Shell consumed: `app/src/mempool/mempool-shared.tsx`, `app/src/design/primitives.tsx`,
  `app/src/design/chart-kit.tsx`
- Nine gates name `constellation`: bundle, chartkit, fit, memdetail, memshell, memviews, perf,
  reduce, shots

## 3 · SCOPE

**IN:** `app/src/mempool/constellation.tsx` (the subject) · `claude/V2-VIEW-CONFORMANCE.md`
Rev 3 · `claude/FINDING-fit-scale-type.md` (new) · two stale comments in
`app/src/mempool/mempool-shared.tsx` (`:339-342`, `:378`) that assert the opposite of the code ·
gate additions for the four §5 break tests · this handoff + `LOG.md`.

**OUT (non-goals):**
- Mobile / phone layout — owned by the mobile port, which now has a measured root cause (§8).
- Fixing the `.mp-fit` type-floor problem. **State the scale; do not fix it.**
- `verify-perf`'s RED on `main` (`useNodePopulation.ts`, `useFreshClock.ts` un-gated
  `setInterval`) — **pre-existing, reproduces on `6039d64`, not this PR's job.** Must not be
  reported as green either.
- Wiring `verify-fit` / `verify-perf` into npm or CI. Record that they are unwired; do not fix
  it in a view PR.
- Any other mempool view. Any change to `useChartMetrics`.

## 4 · CONSTRAINTS

- Stack: React 18 · Vite 5 · TS strict. No new dependencies.
- **Tokens only** — no literal hex/hsl/rgb in the view. Tier→token per contract §4.
- **Zero `Math.random()`** outside `src/protocols/`. Positions stay hash-derived from the txid.
- **Zero fabricated values.** A live number is real or it is an em-dash.
- **Cursor math imported, never re-derived** — `useSvgCursor` / `canvasCursor` only.
  `verify-chartkit` greps `clientX - rect.left` tree-wide with no allowlist.
- **Reduced motion suppresses ANIMATION, not CONTENT** (contract §6 as corrected). The body
  stays in the DOM; a static equivalent must carry the same data *and* the same click targets.
- **Natural width is a budget.** Constellation is the only fit-enabled view at identity scale on
  desktop (natural 1028 ≤ canvas 1180). Crossing 1180 silently introduces a scale transform.
- Line count must stay inside `verify-memshell`'s 200–1084 band (`split("\n").length`).
- `verify-perf` caps `?v=constellation&tier=high` at **≤4** live intervals.
- Every break test asserts its mutation APPLIED before interpreting the gate's colour.
  Mutations are patches reverted with `git apply -R`; **`git checkout --` is not used.**

## 5 · DONE-CRITERIA — the gate reads ONLY this section

- [x] `npm run typecheck` exits 0
- [x] `npm run build` exits 0
- [x] `npm run verify:static` exits 0 (21 gates)
- [x] `npm run verify:e2e` — 29/29 ran to completion, 0 stack traces, **28 green**;
      `verify-vitals` red on `/` and `/live/markets` (wall-clock blocking budgets).
      Both routes' closures are byte-identical to `origin/main`, so not attributable here.
- [x] `npm run verify:bundle` exits 0
- [x] `node verify-fit.mjs` exits 0
- [x] `node verify-memdetail.mjs` exits 0
- [x] `node verify-reduce.mjs` exits 0
- [x] Contract Rev 3 committed as the FIRST commit, carrying §1/§2 addenda, §6 correction,
      new §8 and §9
- [x] `ConCard` no longer exists in the tree; `PanelFrame` used instead
- [x] Node count and limb-darkening profile shipped and asserted
- [x] A node click opens the shared tx inspector for that txid — asserted, with units verified
      by construction rather than by the assertion's tolerance
- [x] Composes at 3 tx — no empty sphere — asserted
- [x] Break test: flattening the falloff reds 8a — per-node alpha (110/111 disagree)
      and the monotonic profile. The AREAL DENSITY assertion does NOT red, stated
      plainly: density falls from the filled-ball geometry alone, so its subject is
      ball-vs-shell, not the falloff curve. Two assertions, two subjects.
- [x] Break test: reduced motion — content survives, animation does not
- [x] Each break test's mutation proven applied before the gate's colour is interpreted
- [x] design-reviewer returned APPROVE
- [x] Branch pushed · PR opened (ready for review, not draft) · `mergeable` /
      `mergeable_state` reported · CI confirmed on the FINAL head SHA, with that SHA quoted

## 6 · VERIFY COMMANDS

```
cd app
npm run typecheck
npm run build
node scripts/serve-dist.mjs 4173 &      # own port; identify holder with lsof, never pkill by name
npm run verify:static
npm run verify:e2e
npm run verify:bundle
node verify-fit.mjs
node verify-memdetail.mjs
node verify-reduce.mjs
```

## 7 · REPORT — filled on exit, completely

status: **done**
pr: see LOG.md (opened from `claude/constellation-v2-contract-rev3-51rqon`)
commits: 7 — contract Rev 3 · shell comment corrections · §8 height mechanism ·
  finding bands + styles.css staleness · §9 completion rule · §8 two width
  mechanisms · the view rebuild + scenario 8

deps added: none

**Canvas or SVG: SVG.** Native hit-testing means no coordinate conversion in the
click path, so no hit-radius tolerance can absorb a coordinate-space bug (§9).
`EXPECT_SVG_TEXT.constellation` is asserted in both directions at four widths.
And this is the one fit-enabled view at identity scale on desktop, where canvas
text would be invisible to the legibility gates.

**Shipped:** 190-node ceiling (fee-first, truncation disclosed); limb darkening
from `LIMB_K = 1.8` with `LIMB_KEEP_FLOOR = 0.35`; tier→token
`--c-50 / --accent-data / --o-80 / --y-50` (contract §4 verbatim).

**`.mp-fit` scale at 1440 = 1.0** — `naturalW` 1132 <= `canvasW` 1180,
`heightScale` 0.548 outside `[0.92, 1)`. Authored 11px renders at 11px.

deviations from spec: tier ramp moved to §4's table, which knowingly disagrees
with `sediment.tsx:58-64`'s claim that this file keeps the urgency ramp.
Recorded in the file header; one 4-element array to reverse.

notes for ARCHITECTURE.md patch: `verify-memviews` scenario 8 is the second
per-view observable contract (after scenario 7). Gate count unchanged at 71.

open questions:
- sediment's `naturalW` 3281 is two co-equal `repeat(12, 1fr)` drivers; bounding
  one column measures zero. Not this PR's view.
- `HEIGHT_FIT_TOLERANCE` is exercised by no gate at either `verify-fit` viewport.
- `verify-memviews` scenario 7 is intermittent (1 red in 6 runs); mechanism is a
  candidate, not established.

## 8 · LOOP FEEDBACK

- `INFERRED` (motion-designer preflight, 17 items) — all disposed: 16 ACCEPTED,
  1 CORRECTED (backface culling must not persist under reduced motion).
- `QUESTION:` none raised.
- design-reviewer round 1: CHANGES-REQUESTED on five spacing literals →
  **CORRECTED**; multiset diff vs `origin/main` shows the only branch-only
  off-ramp value is `marginInline: "auto"`, a keyword not a rung. Round 2: APPROVE.
- Gate convergence: memviews 12 failures → 3 → 1 → 0. Four rounds, monotonically
  decreasing, no fingerprint recurrence.
- The brief's own errors, found by measurement: `useMemCanvas x3` was a string
  count; `verify:static` is 21 gates not 20; `verify-perf` has 3 failures not 1
  (its recorded baseline came from a crashed run); `chart-kit:95` is `:111`;
  `claude/FINDING-fit-scale-type.md` did not exist.
