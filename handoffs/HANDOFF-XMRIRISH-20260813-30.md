---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260813-30
branch: claude/pulse-mempool-time-view-3ydcwo
status: in_progress       # open -> in_progress -> done | blocked
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

- [ ] `npm run build` exits 0 (includes `tsc --noEmit`)
- [ ] `npm run verify:static` exits 0 (21 gates)
- [ ] `npm run verify:e2e` exits 0 (29 gates)
- [ ] `node verify-tracking.mjs` exits 0 and prints `VERIFY_TRACKING_COMPLETE`
- [ ] `node verify-memstats.mjs` exits 0
- [ ] `npm run verify:fit` · `verify:mobile` · `verify:perf-runtime` exit 0
- [ ] `node verify-bundle.mjs` exits 0 against the raised ceilings
- [ ] `verify-memviews` scenario 9 prints a `pulse` row with `naturalW == canvasW`
- [ ] both budget raises demonstrated RED at the old ceiling and GREEN at the new
      one, on the FINAL tree (after the last `src/` edit)
- [ ] renders taken at 1440/1280/390 in both feed states, plus BURST, QUIET and
      TRACKED, and inspected
- [ ] Branch pushed · draft PR opened · `mergeable_state` reported

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
status:
pr:
commits:

## 8 · LOOP FEEDBACK
