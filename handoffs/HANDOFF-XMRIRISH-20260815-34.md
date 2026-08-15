---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260815-34
branch: claude/markets-cursor-annotations-k9jh26
status: done
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

- [x] `npm run typecheck` exits 0
- [x] `npm run build` exits 0
- [x] `npm run verify:static` exits 0 (21 gates)
- [x] `npm run verify:e2e` exits 0 (29 gates) — `verify-vitals` report-and-stop per repo policy
- [x] `node verify-bundle.mjs` exits 0 on the FINAL tree, with every raised ceiling shown
      red before the raise and green after (built + stated margin ≤ 4,000)
- [x] `eagerJsRaw` byte-parity: the eager figure is unchanged from `04006ff`'s 262,852, or
      every moved byte is attributed in the report
- [x] Synced cursor: hovering chart A yields a crosshair at the SAME timestamp on B, C, D —
      asserted in `verify-markets-dom`
- [x] Domain mismatch: with the hero brush-zoomed to a window excluding `t`, hovering a
      group chart at `t` draws NO hero crosshair — asserted, not clamped
- [x] Pin persists across pointer-leave and is releasable without a pointer — asserted
- [x] Annotation flags render from the extracted timeline data, cluster to a count badge,
      carry layer toggles for all four `TL_CAT` categories, deep-link to a slug, and appear
      on the brush strip — asserted
- [x] Education page DOM before == after (extraction parity) — asserted
- [x] Two-polarity execution transcript for EVERY new or modified assertion (a state that
      passes it and a state that fails it, actuals for both)
- [x] Census recounted (not incremented) and CLAUDE.md corrected where falsified
- [x] Branch pushed · draft PR opened via GitHub MCP · `mergeable_state` reported

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

status: done
pr: https://github.com/aqua-019/satoshis-vision-v1/pull/181 (draft)
commits:
  - `446c9df` feat(markets): synced time cursor + the annotation layer
  - `7de58a2` test(markets): gate the synced cursor, the annotation layer and the extraction
  - `5aa637b` docs(bundle): measure what actually catches an eager import of a lazy leaf
  - `680aaa8` fix(govern): mark the two new one-shot rAFs, and put the marker where the gate looks
  - `c6f608c` fix(markets): three things the render pass found and no gate could
  - `ea0c2c5` docs(p3-13): record the session, the leaves, and the claim that was wrong
  - `5fe302e` docs(bundle): re-measure the byte table on the final tree
  - `15fc198` docs: quote the instrument for verify-markets-dom's assertion count
deps added: none
deviations from spec:
  - **`DEEP_DAYS` NOT extended** (§0.5's explicit option). Annotations are scoped to the
    fetched span; the note says how many events sit outside it. Reaching deeper history is
    a request-budget and cache decision that the §1d request gate and the coingecko cache
    comment would own, and the brief said it is not this PR's to take silently.
  - **Annotation flags on the hero plot and the brush strip only**, not on all four charts.
    §2's own text is "flags on the time axis … and flags ALSO on the brush strip". The two
    `MultiLine` groups and the ratio chart carry the synced CURSOR but not flags: their
    x-domain is the range, not the window, so the same event would land at three different
    places on one screen, and the layer toggle belongs to one panel.
  - **Native CSS anchor positioning not implemented at all**, not even as an enhancement.
    §0.6 permits it behind feature detection; the in-repo clamp is the main path and adding
    a second positioning mechanism for a Firefox-ESR audience that will not receive it is
    cost without a reader. Recorded rather than silently dropped.
notes for ARCHITECTURE.md patch:
  - CLAUDE.md gained two Architecture rows (`design/timeCursor.ts`, `data/timeline.ts`) and
    a **correction** to the `canvasColor` row: the lazy-leaf invariant's claim that it "has
    no gate" and that `eagerJsRaw` "would swallow a violation silently" is half wrong, and
    was asserted rather than measured. The measurement is in the session note and beside
    `lazyJsRaw` in `verify-bundle.mjs`.
open questions:
  - **The real assertion for the lazy-leaf rule is still unwritten.** "No eager chunk
    contains a string only this leaf declares" is a small, separate change. Today an eager
    leak under ~650 B gzip clears every ceiling in `verify-bundle.mjs`.
  - **`verify-effects`' ledger is scoped to `src/data/` only.** This PR added three effects
    outside it (two in `charts.tsx`, one in `CandleCanvas.tsx`) and the gate correctly did
    not move. Whether that scope is right is its own question.
  - **No human has seen the rendered result in a browser.** Renders were read from
    screenshots.

## 8 · LOOP FEEDBACK

- `INFERRED` (would have been a PREFLIGHT reply): the brief did not say where annotation
  flags go when the window contains none — the empty state turned out to be the DEFAULT
  view at 30D, so it is the state a reader meets first, not an edge case.
- `SPEC-WAS-AMBIGUOUS`: "flags on the time axis" — one chart or four? Resolved to the hero
  plus the brush strip, from §2's own wording; recorded because the mockup places them on
  a companion chart too.
- Gate rounds: 1 (verify-hero, repointed) · 1 (verify-govern, two rAF markers) · 2 rounds
  inside `verify-markets-dom`'s own new sections, both of which were defects in the new
  assertions rather than in the code.
