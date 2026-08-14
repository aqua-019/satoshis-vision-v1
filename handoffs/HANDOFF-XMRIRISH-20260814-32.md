---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260814-32
branch: claude/markets-canvas-candles-brush-9l5rsd
status: in_progress
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
status:
pr:
commits:
deps added:
deviations from spec:
notes for ARCHITECTURE.md patch:
open questions:

## 8 · LOOP FEEDBACK
