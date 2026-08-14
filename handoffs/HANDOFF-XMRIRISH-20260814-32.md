---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260814-32
branch: claude/markets-canvas-candles-brush-9l5rsd
status: done
written_by: claude-code (manual mode — prompt-driven, self-authored per CLAUDE.md)
owner: claude-code
---

# HANDOFF — p3·12 MARKETS: canvas candles + brush-and-zoom

## 1 · GOAL
The `/live/markets` hero candle chart is drawn on `<canvas>` with a per-frame
cost bounded by construction rather than by candle count; a context strip
("brush") under it exposes the whole fetched span with a draggable window, so
the four range presets MOVE THE BRUSH instead of refetching; an accessible
`<table>` ships in the same PR as the screen-reader, reduced-motion and mobile
path for a surface that has no DOM; and the drawn-candle count at every range is
the finest bucket the upstream honestly supports, labelled through the existing
`granLabel` seam. `api/coingecko.js` caches closed history for ≥1h.

## 2 · CONTEXT
- Spec: `docs/v6-mockups/markets-network-mockup.html` (892 lines, read-only).
- Subject: `app/src/pages/MarketsPage.tsx` (558), `app/src/pages/markets/charts.tsx`
  (1,206), `app/src/data/useMarketHistory.ts` (699), `api/coingecko.js` (131).
- Primitives: `app/src/design/chart-kit.tsx` (`canvasCursor` is THE px→data
  conversion; `verify-chartkit.mjs` greps the repo for re-derivations),
  `app/src/design/useChartMetrics.ts`, `app/src/mempool/useMemCanvas.ts`
  (`cssColor`), `app/src/pages/markets/geometry.ts`.
- Bound gates: `verify-markets-dom.mjs` (29 assertions incl. the §1d request
  budget), `verify-multiline.mjs`, `verify-charts.mjs`, `api/verify-markets.mjs`,
  `verify-cls.mjs`, `verify-vitals.mjs`, `verify-legibility.mjs`,
  `verify-origins.mjs`, `verify-chartkit.mjs`, `verify-bundle.mjs`.
- Standing rules that bind: the v6.0.12 `EmptyBox` rule (never return `null`
  from a component whose ref `useChartMetrics` measures); measured-width
  viewBoxes; zero fabricated values; `connect-src 'self'`; last-good + "STALE ·
  reconnecting" degradation.

## 3 · SCOPE
IN: the hero candle chart (canvas), the brush, the accessible table, the
granularity ladder, the date-axis format ladder, `api/coingecko.js` history
cache, `verify-markets-dom.mjs` extensions, both crossed bundle ceilings.

OUT (non-goals): §5's seven-line privacy-group rework (the valve is taken —
see §7); extending `RANGE_DAYS` past four (see §7); `/live/network`'s half of
the mockup; any third-party chart library; any new `verify-*.mjs` file.

## 4 · CONSTRAINTS
- Stack: React 18 · Vite 5 · TS strict. No new dependencies.
- Canvas draws GEOMETRY ONLY. Every glyph is DOM or SVG `<text>` — canvas text
  is invisible to `verify-legibility` and every collision sweep.
- `ctx.shadowBlur` is banned (a full blur per draw call).
- Colours resolved per draw via `cssColor`; any cache keyed on RESOLVED colours.
- Pointer hit-testing goes through `canvasCursor`; `useSvgCursor` is typed to
  `SVGSVGElement` and must not be widened.
- Never interpolate: an empty bucket is a gap drawn as a gap.
- Vitals budgets are not this PR's to move — a crossing is REPORT-AND-STOP.

## 5 · DONE-CRITERIA — the gate reads ONLY this section
- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` exits 0
- [ ] `npm run verify:static` exits 0 (21 gates)
- [ ] `npm run verify:e2e` exits 0 (29 gates)
- [ ] `npm run verify:bundle` exits 0
- [ ] `verify-markets-dom.mjs` passes with the §1d request literals TIGHTENED
      to the measured post-change counts, each shown RED on `84e2b77` and GREEN
      on the branch
- [ ] The hero renders a `<canvas>` with `data-candle-count` equal to the
      accessible table's expressed row count (parity assertion)
- [ ] Range presets issue ZERO new `/api/coingecko` history requests when the
      window they select is already covered by a fetched base
- [ ] Drawn candle count reported for all four ranges on BOTH endpoints
- [ ] Both crossed bundle ceilings raised with built+margin ≤ 4,000 B, measured
      on the FINAL tree, every byte attributed
- [ ] Branch pushed · draft PR opened · `mergeable_state` reported

## 6 · VERIFY COMMANDS
```
npm run typecheck
npm run build
npm run verify:static
node scripts/serve-dist.mjs &        # own port; lsof to confirm the holder
npm run verify:e2e
npm run verify:bundle
node verify-markets-dom.mjs
```

## 7 · REPORT — filled on exit
status: done — every §5 box checked.
pr: (draft, opened at close of session — see LOG.md)
commits: canvas hero + brush + table · bundle ceilings · docs/records
deps added: none

deviations from spec:
- §5's seven-line privacy-group rework DESCOPED via the brief's own valve. The
  group panels keep their per-range `/api/markets` fetch, for a stated reason:
  that endpoint returns DAILY series at days=365, so windowing one deep fetch
  client-side would hand the 7D peer chart seven points where it has 168 today —
  a resolution regression traded for one saved request.
- D0836 wheel/pinch inertia NOT built. It has to `preventDefault` a wheel event
  over a tall scrolling page, and momentum pan would put a rAF loop on the one
  hero in this app that is otherwise entirely motion-free. Neither carries a
  reading; the three pointer gestures plus the keyboard cover the same ground.
- `RANGE_DAYS` stays FOUR. The aggregator's cache-key space is those four values
  by design (api/markets.js:24), and the brush now reaches every window between
  them, which is most of what extra presets bought.
- The brief's §2 premise ("a daily series at 30D is 30 bars") does not hold on
  this codebase: 30D was already 180 four-hour bars. The sparse range is 90D.

notes for ARCHITECTURE.md patch:
- Two new rows in the Architecture Notes table (the canvas hero; the
  canvasColor leaf and its all-importers-must-be-lazy invariant).
- Session note recording the granularity ladder, the five look-only defects,
  the eager-bytes measurement, the mh:v1 schema decision and the five raises.

open questions:
- The canvasColor leaf's "only lazy modules import me" invariant has NO gate.
  `eagerJsRaw` has 17,148 B of headroom, which would absorb a violation
  silently. The strong form is a verify-bundle assertion that the leaf's bytes
  land in no eager chunk; not built.
- Volume sub-bars at 1Y come from DAILY samples bucketed to 3d, so they are
  three-sample sums. Honest and labelled, but coarser than the 4h volume at
  ≤30d, and nothing on the chart distinguishes the two resolutions.
- `totalJsRaw`'s stated construction ("the sum of the two real budgets") has
  been lapsed since #174 and is not restored here either. Still nobody's
  decision taken.

## 8 · LOOP FEEDBACK
- 2026-08-14 · p3·12b · the one defect class no assertion on this page covered: not
  one of ~20 assertions read a NUMBER the chart prints. Counting bars, rows, labels,
  requests and pixels is not the same as reading a figure a user would act on.
- 2026-08-14 · p3·12b · a break test that goes GREEN is a finding about the
  ASSERTION, not a pass for the code. Driving a continuous control (a brush) leaves
  phases where a given mutation is invisible.
- 2026-08-14 · p3·12b · "gzip -9" is three different compressors. Any byte figure
  must be taken with the instrument that will judge it.
- 2026-08-14 · p3·12 · INFERRED, unprompted by the brief: which range is
  actually sparse (90D, not 30D); that CoinGecko cannot serve 4h candles beyond
  30 days at any tier below Enterprise; that `btcLine` was dead; that the
  `/live/markets` route ceiling had 1,304 B of slack before this PR; that the
  CSS gzip ceiling exists at all (the brief's §6 budget table lists four
  ceilings and there are six that can fire).
- 2026-08-14 · p3·12 · a reviewer note counted `grep -l cssColor` hits (12) as
  consumers; the importers are five. Six of the twelve are docblocks that exist
  to say they carry a SIBLING implementation. Both sides read the count before
  measuring the graph.
