---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260815-34
branch: claude/markets-cursor-annotations-k9jh26
status: in_progress
written_by: claude-code (manual mode — prompt-driven, no open handoff)
owner: claude-code
---

# HANDOFF — p3·13 MARKETS: synced time cursor + the annotation layer

## 1 · GOAL

`/live/markets` stops being four charts that happen to share a page and becomes one
instrument. Three things exist when this is done that do not exist now:

1. **A synced time cursor (D0834).** Hovering any of the four time-axis charts — the
   CandleCanvas hero, the XMR/BTC ratio `AreaSeries`, the peers `MultiLine`, the majors
   `MultiLine` — writes a TIMESTAMP into a shared context; the other three project that
   timestamp through their own geometry and draw their own crosshair. Tooltips (D0385)
   read the nearest datum **at that chart's own bucketing**, so a 4h hero bar and a daily
   group point are two honest readings of one moment.
2. **A domain-mismatch rule that never lies.** The four charts do not share a domain (the
   hero can be brush-zoomed to two days while the groups show thirty). A chart whose
   domain does not contain the cursor's `t` draws **nothing**. Never clamp — a clamped
   crosshair asserts a position the data does not have.
3. **An annotation layer (D0833)** on the time axis, sourced from the ONE timeline the
   `/learn` page already renders, extracted to a shared lazy leaf: category-keyed flags
   with layer toggles, clustering to a count badge, click-through to the timeline entry's
   slug, and flags on the brush strip so an event outside the window is a visible reason
   to travel there.

## 2 · CONTEXT

- Base: `main` = `04006ff` (PR #180 merged — vitals calibrated; #179 gave the hero its
  canvas candles, the brush and the D0847 table).
- Spec: `docs/v6-mockups/markets-network-mockup.html` (892 lines, byte-identical since
  #154). **Do not modify it** — an edited mockup stops being a spec.
- Relevant files: `app/src/pages/markets/{MarketsPage,CandleCanvas,charts,candle-data,
  useMarketHistory}.tsx|ts` · `app/src/design/chart-kit.tsx` · `app/src/design/canvasColor.ts`
  (the lazy-leaf precedent) · `app/src/pages/_education/Timeline.tsx` (the ONE annotation
  source) · `app/verify-{markets-dom,bundle,chartkit,effects,legibility,cls,lib}.mjs`.
- The prompt's §0 carries eight premise corrections measured at `04006ff`; §6.1 of the
  report must confirm or re-correct each against my own measurement.

## 3 · SCOPE

IN:
- A new **lazy leaf** carrying the shared time-cursor context (NOT `chart-kit.tsx`, which
  is eager-reachable — `design/primitives.tsx` imports it and the entry imports primitives).
- Timestamp-valued context; each chart projects `t`→x through its OWN geometry.
- Crosshair + tooltip on all four charts; pin (tap/keyboard) as real state.
- Extraction of `TL_ERAS`/`TL_CAT` from `Timeline.tsx` into a shared lazy data leaf, plus
  an optional machine-readable ISO date with an honest tentative/range flag, plus stable
  slugs. Education page rendering provably unchanged.
- Annotation flags scoped to the fetched span, on the chart axis AND the brush strip;
  layer toggles keyed on the existing four `TL_CAT` categories; cluster badges; deep links.
- Gate work: `verify-markets-dom` extensions, `verify-legibility` coverage of the new DOM,
  an education-parity assertion, `verify-effects` ledger movement if hooks change.
- Budget raises: `lazyJsRaw`, `totalJsRaw` (both cross), `cssGz` if flag CSS needs it,
  `/live/markets` route gzip if it crosses, `CHUNK_COUNT` re-centre if a leaf mints a chunk.

OUT (non-goals):
- **Extending `DEEP_DAYS`** past 365 to reach deeper timeline history. That is a
  request-budget and cache decision with its own consequences (§1d request gate, the
  coingecko cache comment) and is not this PR's to take silently.
- Native CSS anchor positioning as the PRIMARY tooltip path (D1230/D1232). The audience is
  Tor Browser = Firefox ESR; the in-repo `ChartTip`/`cc-tip` clamp is the main path.
  Native anchor positioning is optional, feature-detected, and lives in `design/`.
- Any change to `docs/v6-mockups/markets-network-mockup.html`.
- Adding `content-visibility` anywhere (its premise is absent at this head).
- Moving `eagerJsRaw`. This is a non-view PR; any eager move is a finding attributed to
  the byte.

## 4 · CONSTRAINTS

- Stack: React 18 · Vite 5 · TS strict · Node 22. `app/` is the only front-end.
- **Zero fabricated values on live surfaces.** An annotation with an uncertain date says
  so; it never invents precision. An empty window renders as nothing plus a quiet count of
  events outside the span — never an invented marker.
- **No text on canvas.** Flags, badges and tooltips are DOM — canvas glyphs are invisible
  to `verify-legibility`, to collision sweeps, to find-in-page and to a screen reader.
- CSP `connect-src 'self'`; zero third-party browser requests; usable at 390px; no text
  under the token floor; every animation ships a `prefers-reduced-motion` path.
- Highest-frequency listener surface on the site: passive listeners (D1770), one
  rAF-aligned throttle (D1769), and the context write must not re-render four charts per
  `pointermove`.
- No layout shift from flags (`verify-cls` is watching).
- Do not touch: `docs/v6-mockups/**`, `vercel.json` security headers, `api/**` unless a
  premise forces it (it should not).

## 5 · DONE-CRITERIA — the gate reads ONLY this section

- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` exits 0
- [ ] `npm run verify:static` exits 0 (21 gates)
- [ ] `npm run verify:e2e` exits 0 (29 gates) — `verify-vitals` report-and-stop per repo policy
- [ ] `node verify-bundle.mjs` exits 0 on the FINAL tree, with every raised ceiling shown
      red before the raise and green after (built + stated margin ≤ 4,000)
- [ ] `eagerJsRaw` byte-parity: the eager figure is unchanged from `04006ff`'s 262,852, or
      every moved byte is attributed in the report
- [ ] Synced cursor: hovering chart A yields a crosshair at the SAME timestamp on B, C, D —
      asserted in `verify-markets-dom`
- [ ] Domain mismatch: with the hero brush-zoomed to a window excluding `t`, hovering a
      group chart at `t` draws NO hero crosshair — asserted, not clamped
- [ ] Pin persists across pointer-leave and is releasable without a pointer — asserted
- [ ] Annotation flags render from the extracted timeline data, cluster to a count badge,
      carry layer toggles for all four `TL_CAT` categories, deep-link to a slug, and appear
      on the brush strip — asserted
- [ ] Education page DOM before == after (extraction parity) — asserted
- [ ] Two-polarity execution transcript for EVERY new or modified assertion (a state that
      passes it and a state that fails it, actuals for both)
- [ ] Census recounted (not incremented) and CLAUDE.md corrected where falsified
- [ ] Branch pushed · draft PR opened via GitHub MCP · `mergeable_state` reported

## 6 · VERIFY COMMANDS

```
cd app
npm run typecheck
npm run build
node verify-bundle.mjs
npm run verify:static
npm run verify:e2e
node verify-markets-dom.mjs
node verify-legibility.mjs
node verify-cls.mjs
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
