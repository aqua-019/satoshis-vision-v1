---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260812-26
branch: claude/ops-bridge-v2-spacing-80iw7k
status: done
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
change to all six views), the bundle budget in `verify-bundle.mjs`. (The brief named a
pre-existing `verify-pageshell` `/future@1600` red to leave as found — it does NOT reproduce
here; measured 369 ✅ / 0 ❌ at both endpoints. See §7.)

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
- [x] `npm run verify:pageshell` — 369 ✅ / 0 ❌ at both endpoints (the brief's predicted
      `/future@1600` red does not reproduce on this builder; my green is not a fix)
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

## 7 · REPORT

status: done
pr: https://github.com/aqua-019/satoshis-vision-v1/pull/173 (draft)
commits: 6121432 feat(bridge): v2·5 Ops Bridge — the artboard is definite, so the view is unscaled
deps added: none

**Result.** `naturalW` 2517 → **1180** in BOTH feed states at every viewport; `.mp-fit` scale at
the 1440 reference 0.468812 → **1.000000**; authored 11px 5.16px → **11.00px**. `naturalH`
1856/2300 → 1229/1360, inside the reactor-only `natH ≤ 2 × canvasH` bound (1404), so the canvas
shows 51.6% per screen rather than 37.8%.

**Cause, measured before the grid was designed.** Row-hiding + clone-outside-the-grid: the
pool-attribution row was the sole mover (2517 → 1360), its §6 disclosure prose demanding 1174px,
amplified by `1fr 1.1fr` to `1174 + 1291.16 + 12 + 40 = 2517.16`. The brief's named candidate
(the `repeat(7, 1fr)` stat strip) contributes **zero**. Fixed with reactor's `ARTBOARD_W = 1180`
plus `minmax(0, 1fr)`; break-tested — removing only the explicit width returns naturalW to
1394 empty / 1430 fixtured, i.e. over budget AND feed-dependent again.

**Gates.** All seven green at both endpoints (baseline `bb8b74e` and after). Two went red during
the work and both reds are two-polarity evidence produced by the gate against a real tree state:
`verify-gpu` (`transition: width` on the gauge bar → `transform: scaleX()`), and
`verify-memshell`'s 200–1084 line band (1265 → 871 after the instruments split).
`FITS_AT_1440.bridge` red-then-green quoted in the PR body.

**Density pair.** N 100 → 115 (floor 88, unchanged). M 16 → 18: +blockTarget, +peerCount,
+randomxSeedHash, +txCountTotal, +version; −btcRatio, −change24h, −price (market figures are not
ops-bridge telemetry and already ship in NavTop and the rail).

**Bundle.** eagerJsRaw 261,392 → 261,392 (+0, as a lazy-chunk change should be).
lazyJsRaw 705,264 → 711,561 (+6,297), 8,439 B under the 720,000 ceiling. Budget untouched.

deviations from spec:
- Radar rings are fixed QUANTILES carrying live fee values, not the live fee-TIER values the brief
  asked for. Rendered, tier rings land at their quantiles: the three tiers inside the fixture's
  range sat at radii 146.4 / 141.4 / 118.9, two of them 5px apart, all three in the outer fifth.
  Fixed quantiles make non-overlap structural and every label is still a live number.
- PEERS ships as the designed unavailable state (em-dash + the tape row that says why) rather than
  a substituted field — the brief allowed either.
- RING is NOT added to the shared `MemStatStrip`: that is a six-view change and would move
  `EXPECT_MEMSTAT` for all of them.
- `bridge.tsx` exceeded `verify-memshell`'s line band at 1265, so the two instruments moved to
  `bridge-instruments.tsx` — the remedy the gate's own failure text names. The VIEW got bigger
  (708 → 1228), not smaller, and the PR body says so.

notes for ARCHITECTURE.md patch: none — this is a view PR; the contract (§8) already carries the
`max-content` amplification mechanism and now has a second worked instance.

open questions:
- `FITS_AT_1440` is an EMPTY-FEED claim. Constellation is declared `true` (1132 empty) while
  scenario 9 measures `naturalW 1510` for it under the fixture — over the 1180 canvas with real
  data. Bridge is 1180 in both states because its artboard is definite; constellation's
  caption-cap fix does not carry that property. Not this PR's view.
- Scenario 6's one bridge allowlist entry is now UNEXERCISED (the gauge stack no longer overlaps).
  Left in place deliberately; whoever next touches scenario 6 should know it waives nothing.
- 390px is still 3.64px against an 11px floor. Structural, `FINDING-fit-scale-type.md`.

## 8 · LOOP FEEDBACK

- `PREFLIGHT`-equivalent finding: the brief named `claude/FINDING-maxcontent-grid-amplification.md`
  as the reference for the amplification mechanism. **That file has never existed** — not in the
  tree, not in `git log --all --diff-filter=A`. The mechanism is real and lives in contract §8's
  sediment section. A brief citing a non-existent artifact is the same shape as a stale line
  reference, and it cost a search before the real source was found.
- `INFERRED`: the brief's "one unproven candidate to check first" was the wrong element. Measuring
  before building is what caught it; had the grid been designed around that hypothesis, the
  artboard fix would still have worked and the recorded cause would have been wrong.
- `SPEC-WAS-AMBIGUOUS`: "ring-label values come from the live tier data" reads as a geometry
  instruction but is an anti-fabrication instruction. Resolved by keeping the intent (nothing
  hard-coded) and changing the geometry, declared in the PR body.
- Gate-vs-eye, both directions in one PR: rendering found four defects no gate sees; `verify-gpu`
  found one the eye cannot. Neither channel is sufficient alone.
