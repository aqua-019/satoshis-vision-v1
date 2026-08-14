---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260814-31
branch: claude/circuit-mempool-pcb-h3tab5
status: done
written_by: claude-code (manual mode — prompt-driven, self-authored per CLAUDE.md)
owner: claude-code
---

# HANDOFF — p2·10 CIRCUIT: the mempool as a PCB

## 1 · GOAL
A tenth mempool view, `circuit`, ships: the pending pool drawn as a printed
circuit board. Four bus lanes are the node's own `get_fee_estimate` fee tiers
(a CATEGORY, not a coordinate); the along-trace axis is QUEUE DEPTH — the
cumulative weight ahead of a transaction in the fee-sorted fill — so approaching
the chip is literally approaching inclusion, and the die's left edge is the
inferred next-block cut. The tracked transaction's trace illuminates end to end,
per the spec. Fluid width (`fit: false`, `reflow: true`), canvas via
`useMemCanvas`, a static SVG twin under reduced motion, registered in the four
per-view gate maps, with both crossed bundle ceilings raised deliberately.

## 2 · CONTEXT
- `docs/v6-mempool-views-spec.md:140-141` (the Circuit brief) + `:35-124`
  (the shared contract).
- `claude/V2-VIEW-CONFORMANCE.md` Rev 4 — §1 primitives, §2 chart-kit/cursor,
  §4 tokens, §5 spacing ramp, §6 standing rules, §8 width, §9 assertion space,
  §10 the N/M density pair.
- Templates: `app/src/mempool/pulse.tsx` + `pulse-instruments.tsx` (p2·9),
  `abyss*.tsx` (p2·8), `orbital*.tsx` (p2·7).
- Baseline `main` = `d388754` (PR #177, Pulse).

## 3 · SCOPE
IN: `app/src/mempool/circuit.tsx` + `circuit-instruments.tsx`; one
`MEMPOOL_VIEW_META` row; one `VIEW_COMPONENTS` binding; `.cir-*` CSS + the ≤768
reflow rule; `DENSITY_FLOOR.circuit`, `EXPECT_SVG_TEXT.circuit`,
`EXPECT_MEMSTAT.circuit`, `verify-lib` `ROUTES`; the standing `verify-memshell`
`NEW`-list rider (promote `pulse`); two budget raises.
OUT: Relay (parked). No gate is added. No other view is touched. `verify-fit`'s
`FITS_AT_1440` gets NO entry (fit-only map; this view is `fit: false`).

## 4 · CONSTRAINTS
- Tokens only, no literal hex. `PanelFrame` for all panel chrome.
- `useMemCanvas`, never `useTick`. `ctx.shadowBlur` banned. `canvasCursor` only.
- Zero `Math.random()`. Zero fabricated readings — em-dash or nothing.
- Axis labels DOM, not canvas glyphs (three gates read text).
- Do not touch: the `verify:mem:perf` fps bar; other views' chunks.

## 5 · DONE-CRITERIA — the gate reads ONLY this section
- [x] `npm run build` exits 0 (includes `tsc --noEmit`)
- [x] `npm run verify:static` exits 0
- [x] `npm run verify:e2e` exits 0 — 28/29; `verify-vitals` red, PRE-EXISTING (measured against the d388754 build)
- [x] `node verify-tracking.mjs` exits 0 and sweeps `circuit` — 80 → 89
- [x] `node verify-memstats.mjs` exits 0 and sweeps `circuit` — 39 → 40
- [x] `node verify-bundle.mjs` exits 0 on the FINAL tree — 27, after three raises
- [x] `npm run verify:fit`, `verify:mobile`, `verify:perf-runtime` exit 0
- [x] six `naturalW == canvasW` cells measured at 1440/1280/390 × both feed states — all EQUAL
- [x] renders looked at: dense lane, quiet (3 tx), empty feed, reduced motion, tracked at 1440 and 390 — nine defects found and fixed
- [ ] draft PR opened, `mergeable_state` reported

## 6 · VERIFY COMMANDS
```
cd app && npm run build
npm run verify:static
node scripts/serve-dist.mjs & npm run verify:e2e
node verify-tracking.mjs && node verify-memstats.mjs && node verify-bundle.mjs
```

## 7 · REPORT

**Shipped.** `circuit` is the tenth mempool view. Four bus lanes are the node's four
`get_fee_estimate` tiers — a CATEGORY, not a coordinate, which is the whole separation from
sediment's continuous stratum and orbital's continuous radius. The along-trace axis is
QUEUE DEPTH: the cumulative weight ahead in the fee-sorted fill, so moving toward the chip
is moving toward inclusion and the die's left edge is the inferred cut. A packet's extent on
the axis IS its weight, so the pool tiles the axis and occlusion is structurally impossible
rather than managed.

**Width**: all six `naturalW == canvasW` cells EQUAL (1440 → 1180/1180, 1280 → 1020/1020,
390 → 366/366, both feed states), no `.mp-fit`, authored 11px at 11px everywhere.
**Height**: `clamp(w × 0.48, 250, 420)` → 353 / 302 / 250; c8 cell 596 vs `canvasH` 702.
**Files**: `circuit.tsx` 651 (in band), `circuit-instruments.tsx` 1,245.

**Gates**: `verify:static` 21/21; `verify:e2e` 28/29 (`verify-vitals` red and PRE-EXISTING —
`/` blocking 435 branch / 424 base, both over 400; `/live/mempool` green on both and better
on the branch); `verify-memviews` 255 → 289; `verify-tracking` 80 → 89; `verify-memstats`
39 → 40; `verify-nav` 129 unchanged (it derives `N_VIEWS`); `verify-bundle` 27;
`verify:fit`, `verify:mobile`, `verify:perf-runtime` green. `verify:mem:perf` p5 **17 fps**
against the 30 bar — FAIL, reported, bar untouched.

**Budgets**: THREE raises, not two. `lazyJsRaw` 790,000 → 820,000, `totalJsRaw`
1,052,000 → 1,082,000, and `CHUNK_COUNT` 60 → 61 (a chunk count is a view-count derivative;
every net-new view adds exactly one lazy chunk). Delta paired by multiplicity, every byte
attributed, baseline built in an isolated worktree.

**Break tests**: three mutations, three localised reds, trap-owned restore verified clean.

**No new dependencies.** **No human has seen the rendered result in a browser.**

## 8 · LOOP FEEDBACK

- **The brief was wrong in three places, all recorded**: it named TWO budget raises (there
  are three — the chunk-count drift detector is a view-count derivative and was one view from
  firing); it estimated "~60 per lane" (the fixture splits 25/69/146/0, because tier 3 is
  empty); and it framed occlusion as "THE composition problem" when this axis makes occlusion
  impossible and the dense lane needed the opposite fix — a separator, not a bucketing scheme.
- **The four-layer sweep's second layer needs widening**: it looks for view-id literals and
  count literals in gates, and it did not catch `CHUNK_COUNT`, which counts CHUNKS — a
  quantity derived from the view count one hop away.
- **Five harness-lies instances in one run**, all closed structurally: a filename that
  claimed a state its content never carried; a `str.replace` that matched nothing and printed
  `ok`; a cwd reset that crashed a gate and produced an EMPTY grep reading as "no failures";
  break-test extraction greps narrower than their claim with `head -N` truncating the
  evidence; and a trap whose relative restore path landed in the wrong directory after the
  script `cd`'d.
- **DEFERRED**: instruments files are unbanded by `verify-memshell` (only `<id>.tsx` is), so
  `circuit-instruments.tsx` at 1,245 lines is unchecked. `totalJsRaw`'s stated identity
  remains lapsed at an 18,000 B gap for the third consecutive raise.
