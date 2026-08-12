---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260812-26
branch: claude/ops-bridge-v2-spacing-80iw7k
status: in_progress
written_by: claude-code (manual mode — task arrived as a prompt with an attached mockup)
owner: claude-code
---

# HANDOFF — v2·5 OPS BRIDGE: rebuild `bridge.tsx` against the approved mockup

## 1 · GOAL

`/live/mempool?v=bridge` renders the approved `ops-bridge-v2.html` composition at
**identity `.mp-fit` scale** at the 1440 reference viewport — i.e. `naturalW <= canvasW`
(1180) — so authored 11px paints at 11px instead of the 5.16px it paints today at scale
0.468812. The view keeps every gate green, gains the mockup's semantic changes (fee/byte
radar range, observed-range oscilloscope, eight flat gauges, real cadence statistics, a
next-block CUT column), and drops `BrgCard` for `PanelFrame` so every panel can report its
own endpoint's freshness.

## 2 · CONTEXT

- `claude/V2-VIEW-CONFORMANCE.md` **Rev 4** — §1 (primitives), §2 (chart-kit / fluid
  viewBox), §4 (token map), §5 (spacing ramp), §6 (standing rules), §8 (the fit-scale
  apparatus and the caption rule), §9 (assertion space), §10 (the density PAIR).
- Mockup: `ops-bridge-v2.html` (attached to the task; rendered, not summarised).
- Precedent: PR #172 (reactor v2 — `ARTBOARD_W` made `naturalW` definite), PR #169
  (constellation v2 — the caption/`max-content` mechanism), `claude/FINDING-fit-scale-type.md`.
- Subject file: `app/src/mempool/bridge.tsx` (707 lines at `bb8b74e`, untouched since #167).
- Gates that already name this view: `verify-fit.mjs` (`FITS_AT_1440.bridge`),
  `verify-memviews.mjs` (`EXPECT_SVG_TEXT.bridge`, `DENSITY_FLOOR.bridge`, scenario 6's
  one structural allowlist entry, `EXPECT_MEMSTAT.bridge`).

## 3 · SCOPE

IN: `app/src/mempool/bridge.tsx`; the one-line `FITS_AT_1440.bridge` flip in
`verify-fit.mjs`; the registry's switcher `sub` copy if the pane count changes.

OUT (non-goals): the 1280–1439 rail band (`styles.css:2149`), sediment's 3281,
`useChartMetrics`' inert `minWidth`/`k`, the shared `MemStatStrip` (adding RING to it is a
change to all six views), `verify-pageshell`'s pre-existing `/future@1600` red, the bundle
budget in `verify-bundle.mjs`.

## 4 · CONSTRAINTS

- Tokens only — no literal hex. Spacing from `--sp-1..7`. Type from `--fs-*`. Motion from
  `--d-*` / `--e-*`.
- Zero fabricated values. Every figure is a live read, a labelled derivation, or an em-dash.
- Zero `Math.random()` in `src/mempool/`.
- Reduced motion suppresses ANIMATION, not CONTENT; the real `MemTxTable` is always passed.
- Cursor math imported (`useSvgCursor`), never re-derived — gated tree-wide.
- SVG type authored at the sanctioned 11px floor (`--fs-chart-tick`), not the 8/8.5/9 the
  file shipped.
- `lazyJsRaw` must stay under 720,000 B. Do NOT raise the budget.

## 5 · DONE-CRITERIA — the gate reads ONLY this section

- [x] `npx tsc --noEmit` exits 0
- [x] `npm run build` exits 0
- [x] `naturalW <= 1180` at 1440×900 in BOTH feed states, measured
- [x] `naturalH` outside the height-clause band at 1440×900 and 1280×900, measured
- [x] `FITS_AT_1440.bridge` flipped to `true`, with the red-then-green quoted
- [x] `npm run verify:fit` exits 0
- [x] `npm run verify:static` exits 0
- [x] `npm run verify:e2e` exits 0 (contains `verify-memviews` and `verify-glide`)
- [x] `npm run verify:mobile` exits 0
- [x] `npm run verify:perf-runtime` — no NEW failures vs baseline
- [x] `npm run verify:pageshell` — no NEW failures vs baseline (`/future@1600` is pre-existing)
- [x] `npm run verify:bundle` exits 0 and `lazyJsRaw < 720000`
- [x] scenario 9 density `N >= 88` for bridge, with `M` reported at both SHAs
- [x] rendered and LOOKED AT: 1440×900 and 1280×900, both feed states
- [x] Branch pushed · draft PR opened

## 6 · VERIFY COMMANDS

```
cd /home/user/satoshis-vision-v1/app
npx tsc --noEmit
npm run build
node scripts/serve-dist.mjs 4173 &
npm run verify:static
npm run verify:e2e
npm run verify:fit
npm run verify:mobile
npm run verify:perf-runtime
npm run verify:pageshell
npm run verify:bundle
```

## 7 · REPORT — filled on exit

status:
pr:
commits:
deps added:
deviations from spec:
notes for ARCHITECTURE.md patch:
open questions:

## 8 · LOOP FEEDBACK
