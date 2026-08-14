---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260813-30
branch: claude/pulse-mempool-time-view-3ydcwo
status: done              # open -> in_progress -> done | blocked
written_by: claude-code   # manual mode — prompt-driven, self-authored per CLAUDE.md
owner: claude-code
---

# HANDOFF — p2·9 PULSE: the mempool in the time domain

## 1 · GOAL
A ninth mempool view, `pulse`, exists at `/live/mempool?v=pulse`: the first view in
the suite whose horizontal axis is WALL-CLOCK TIME, and the first that draws the
FLOW (arrivals over time) rather than the STOCK (the pool's current contents). It
renders a rolling two-sided waveform — arrival rate above the time axis, per-arrival
fee amplitude below it — with the next block's due instant marked in a real FUTURE
segment to the right of "now". It is registered in every per-view map the suite
hand-maintains, and the two bundle ceilings its chunk crosses are raised with the
arithmetic in their comments rewritten.

## 2 · CONTEXT
- Spec: `docs/v6-mempool-views-spec.md:144-146` (the Pulse brief) and `:35-124`
  (the shared contract a new view must satisfy).
- Conformance doc: `claude/V2-VIEW-CONFORMANCE.md` (Rev 4).
- Closest precedents: `app/src/mempool/abyss.tsx` + `abyss-instruments.tsx` (p2·8,
  the second fluid view, the instruments/panels split seam, the draw-loop-owned DOM
  marker), `orbital.tsx` (p2·7, the fluid-width mechanism).
- Base: `origin/main` = `fe4b999` (PR #176, Abyss).
- Named dependencies from the spec: `MemStatStrip`'s `oldest` and `eta`, taken from
  `useMemStats` as PARAMETERS (contract §3 satisfied by construction, not by two
  implementations agreeing) — the same discipline `useAbyssField(data, oldestAgeSec)`
  established.

## 3 · SCOPE
IN:
- `app/src/mempool/pulse.tsx` + `app/src/mempool/pulse-instruments.tsx` (new)
- one `MEMPOOL_VIEW_META` row + one `VIEW_COMPONENTS` binding
- `.pls-*` CSS classes in `styles.css` + the ≤768 reflow pair
- per-view gate rows: `DENSITY_FLOOR.pulse`, `EXPECT_SVG_TEXT.pulse`,
  `EXPECT_MEMSTAT.pulse`, `verify-lib.mjs` `ROUTES`
- `verify-bundle.mjs`: `lazyJsRaw` and `totalJsRaw` raises + comment arithmetic
- optional rider: prune shipped `orbital`/`abyss` from `verify-memshell.mjs`'s `NEW`

OUT (non-goals):
- the `totalJsRaw` backstop-identity reconciliation (recorded as an open decision
  in that file — the raise stays mechanical)
- the `verify:mem:perf` 30fps bar (report the number, do not move the bar)
- `verify:pageshell`'s pre-existing `/future` red
- any change to `useMemStats`, `MemViewShell`, `useMemCanvas` or the other eight views

## 4 · CONSTRAINTS
- Stack: React 18 · Vite 5 · TS strict. Edit `app/src/**` only.
- ALL-REAL-DATA: zero fabricated values. `Math.random()` only in `src/protocols/`.
- Provenance vocabulary verbatim; freshness DERIVED via `NodeProvenance keys=…`.
- `ctx.shadowBlur` banned in `src/mempool/`. `canvasCursor` is the only cursor
  conversion. No `setState` per frame.
- Every animation ships a `prefers-reduced-motion` path that loses no information.
- Usable at 390px; no HTML text under 12px.
- Do not touch: `api/`, `vercel.json`, `relay/`.

## 5 · DONE-CRITERIA  — the gate reads ONLY this section

- [x] `npm run build` exits 0 (includes `tsc --noEmit`)
- [x] `npm run verify:static` exits 0 (21 gates)
- [x] `npm run verify:e2e` exits 0 (29 gates)
- [x] `node verify-tracking.mjs` exits 0 and prints `VERIFY_TRACKING_COMPLETE`
- [x] `node verify-memstats.mjs` exits 0
- [x] `npm run verify:fit` · `verify:mobile` · `verify:perf-runtime` exit 0
- [x] `node verify-bundle.mjs` exits 0 against the raised ceilings
- [x] `verify-memviews` scenario 9 prints a `pulse` row with `naturalW == canvasW`
- [x] both budget raises demonstrated RED at the old ceiling and GREEN at the new
      one, on the FINAL tree (after the last `src/` edit)
- [x] renders taken at 1440/1280/390 in both feed states, plus BURST, QUIET and
      TRACKED, and inspected
- [x] Branch pushed · draft PR opened · `mergeable_state` reported

## 6 · VERIFY COMMANDS
```
cd app
npm run build
npm run verify:static
npm run verify:e2e
node verify-tracking.mjs
node verify-memstats.mjs
npm run verify:fit && npm run verify:mobile && npm run verify:perf-runtime
node verify-bundle.mjs
npm run verify:mem:perf     # reported, bar untouched
```

## 7 · REPORT  — filled on exit
status: done
pr: https://github.com/aqua-019/satoshis-vision-v1/pull/177
commits: 1121575 feat(mempool): Pulse — the mempool in the time domain
         a1bc708 docs(handoffs): §7 REPORT and §8 loop ledger

**What shipped.** `pulse`, the ninth mempool view and the first whose horizontal axis is
wall-clock time. Two traces hinged on one time axis: arrival RATE above (one equal
segment per arrival, stacked per bin, so a column's height is exactly the count and
bursts read as spikes), per-arrival fee AMPLITUDE below (log fee/byte, where the inferred
next-block cut becomes a horizontal threshold the marks visibly cross). The window is a
block-target ladder rung chosen from the strip's `oldest`; the future segment is one
block target wide and the strip's `eta` marks the due instant inside it.

**History source (the honesty decision).** The pool's own age distribution — NODE
provenance, complete at t=0, SURVIVOR-BIASED. The caption says so: arrivals *still
pending*, older end under-counts, fall-off is the mining process. The session-log
alternative was rejected for being empty at load and for `useFeedEvents`'s per-tick cap.

**Measurements.** Six fluid cells all equal (1440→1180/1180, 1280→1020/1020,
390→366/366, both feed states). Density 154 → floor 135. `verify-tracking` 71→80,
`verify-memstats` 38→39, ROUTES 45→46. Budgets: lazy 759,000→790,000 (built 787,894),
total 1,021,000→1,052,000 (built 1,049,839), eager ceiling untouched (+83 structural).
`verify:mem:perf` p5 24 fps — FAIL vs the 30 bar, reported, bar untouched.

**Five defects found by LOOKING, none gate-visible**: the ETA-as-`tMax` bug that pinned
the due marker and rescaled the domain every frame; the ¼-block bottom rung that left a
3-tx pool 80% empty future; fee marks at u=0/u=1 hidden under gridlines; a rate ceiling
of 1 and quartered tick ladders; and the two floating labels colliding. Plus one found by
reasoning: `plsX` clamping painted rolled-out arrivals on the border at a false time.

## 8 · LOOP FEEDBACK

- **The brief mis-stated `useFeedEvents`'s cap** (`:25 → 40 per tick`). Measured: `:26` is
  `TX_EVENTS_PER_TICK = 8`; the `40` below it is the ring buffer's size. The number was
  load-bearing — it was the argument against the session-log option.
- **"one axis inversion against ALL EIGHT" was not achievable** and asserting it would
  have been this repo's own narrower-subject failure. Pulse shares fee-on-vertical with
  sediment; recorded as a named narrower separation instead.
- **A subagent reported `DENSITY_FLOOR` did not exist** in `verify-memviews.mjs`. It does
  (`:1889`), and a missing entry is a hard red (`:1982`), not a skip. Verified directly
  before acting; the delegated inventory was right about seven maps and wrong about the
  one that would have blocked the build.
- **`| head -N` SIGPIPEs a probe that writes files.** A render probe was killed after its
  first printed table and before any screenshot, so a set of fixes was judged against PNGs
  five minutes stale and read as "the fix did not take". The numbers printed *before* the
  kill were fresh, which is what made it convincing. New standing rule.
- **DEFERRED — `totalJsRaw`'s lapsed backstop identity.** Raised per standing policy; the
  reconciliation (derive it, or retire it) remains an open decision recorded in the file.
- **DEFERRED — sub-12px HTML at 390.** Pulse reports 127 nodes; every view reports
  59–189 from the same shared chrome (`span.pill live`, `div.lbl`, `div.sub`). Standing
  CLAUDE.md item, not this view's.
