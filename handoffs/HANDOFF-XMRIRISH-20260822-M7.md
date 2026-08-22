---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260822-M7
branch: claude/mobile-terminal-bootup-prompt-dlp5ju
status: done
written_by: claude-code (manual mode — task arrived as a prompt, p4·M7)
owner: claude-code
---

# HANDOFF — p4·M7 · THE PHONE GETS ITS OWN TERMINAL SEQUENCE

## 1 · GOAL

The cold-boot decrypt reads as a terminal on desktop and as a wall of static on a
phone. When this is done, `/`'s decrypt at 390x844 is a phone-NATIVE composition —
fewer, bigger cells; ambient density scaled to the grid rather than constant; a
wordmark block with real margins; a scripted line set that fits the narrower grid —
and the gate that guards it can SEE the failure, because every field assertion is a
BAND (or an emptiness measurement) rather than a floor. Desktop and tablet are
byte-identical in field report.

## 2 · CONTEXT

- Prompt: `p4M7phoneterminal.md` (operator brief, measured on a build of `5854cbd`).
- Files: `app/src/coldboot/field.ts` (the renderer), `app/src/coldboot/ColdBoot.tsx`
  (the host + `__XMR_FIELD__` publisher), `app/src/coldboot/schedule.ts` (T + the two
  durations), `app/verify-coldboot.mjs` (the gate, §10/§11 are p4·M4's phone sections).
- CLAUDE.md: the p4·M4 session note records the stacked wordmark, the wall ceiling,
  and the 831 B `lazyJsRaw` margin this PR has to plan around.
- THE BRIEF'S OWN GROUND RULE: where it disagrees with my measurement, my measurement
  wins. Its table was read "at t≈1000 ms" — which is T=0.30 on a phone (3,333 ms
  effective) and T=0.18 on desktop (5,556 ms). Those are DIFFERENT PHASES of the same
  schedule, so the phone/desktop comparison it draws may be partly an artifact of the
  instrument. Reproduce at matched T before trusting any of it.

## 3 · SCOPE

IN:
- `field.ts` phone composition: cell size, ambient density law, wordmark block +
  margins, a phone line set, and a vertical beat for the narrow stage.
- `ColdBoot.tsx` only where the report must carry new numbers.
- `verify-coldboot.mjs`: turn the four floors into bands, and ADD the missing
  measurement (background emptiness, read back off the canvas with `getImageData`).
- Budgets in `verify-bundle.mjs` if and only if crossed, with the arithmetic stated.

OUT (non-goals):
- The schedule. `effectiveMs` 3,333 / `wallCeilMs` 4,500 and M4's flip assertions are
  correct and are not this PR's to change.
- Desktop and tablet composition. Any move there is a regression, and is asserted so.
- `MIN_CELL_PX` itself. Raising the phone font does not move that floor.
- The orb, the console, the ENTER handoff, the CLS pin.
- The deferred items p4·M4 named (mempool `?v=` iOS crash loop, phone-scale mempool
  layout, `verify-mobile` exercising one view of ten).

## 4 · CONSTRAINTS

- Stack: React 18 · Vite 5 · TS strict. `app/` is the only front-end.
- `Math.random()` is banned outside `src/protocols/`; the field seeds from `h3`.
- Zero fabricated values on live surfaces (the decrypt is not a live surface, but the
  cipher is a real transaction and stays one).
- `drawField` must stay PURE in `(w, h, T, density)` — the determinism contract in
  field.ts's own header, and the property the screenshot-diff gate rests on.
- No new stylesheet rule unless measured; `cssGz` margin is thin.
- `lazyJsRaw` margin is 831 B (977,169 of 978,000). Plan the raise; do not discover it.

## 5 · DONE-CRITERIA — the gate reads ONLY this section

- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` exits 0
- [ ] At 390x844 dpr2, measured by canvas read-back at matched T: bright-pixel and
      lit-pixel coverage both inside the newly-declared bands, and the desktop control
      measured in the same run and stated beside them.
- [ ] At 390x844: `mark` columns-per-glyph strictly greater than the pre-fix figure,
      `mark.left >= N` and `cols - 1 - mark.right >= N` for the declared N.
- [ ] `__XMR_FIELD__` at 1440x900 and at 768x1024 is IDENTICAL before and after the
      change (captured on a base build and on the branch build, diffed field by field).
- [ ] Every new field assertion is a BAND (floor AND ceiling) or an emptiness
      measurement; no new bare floor is added.
- [ ] TWO-POLARITY on the emptiness assertion: a density-UPWARD mutation reproduces
      the wall and turns the new assertion RED, with the mutation proven applied by
      `git diff`, restored from the COMMITTED BLOB, and rebuilt between restore and
      re-measure.
- [ ] `verify-coldboot.mjs` exits 0 in-chain; `verify:e2e` exits 0 across all members.
- [ ] Inherited counts hold: `verify-peers` 44 · `verify-mobile` 59 · `verify-site` 81
      · `verify-protocol` 62. `verify-coldboot` / `verify-orb` movement stated with why.
- [ ] Budgets re-derived on the FINAL tree; any raise states its arithmetic and moves
      `totalJsRaw` with it so the gap is unchanged.
- [ ] Screenshots at 390 and 320, before and after, looked at.
- [ ] Branch pushed · draft PR opened.

## 6 · VERIFY COMMANDS

```
npm run typecheck
npm run build
npm run verify:static
npm run verify:e2e
npm run verify:bundle
node verify-coldboot.mjs
node verify-mobile.mjs
```

## 7 · REPORT — filled on exit

**status**: done.

**pr**: https://github.com/aqua-019/satoshis-vision-v1/pull/200 (draft)

**commits**: the backing-store clear + the narrow composition · the canvas read-back gate ·
the block-margin and settled-raster assertions · the gate's own timing anchor · budgets and
the record.

**deps added**: none.

**deviations from spec** — three, each measured rather than argued, and the second and third
were confirmed by the operator mid-flight:

1. **The brief's §1 diagnosis does not hold.** Its "15.3 % bright at 390 against 0.7 % at
   1440 — 20x" was read at t≈1000ms, which is T=0.30 on a phone (3,333ms effective) and
   T=0.18 on a desktop (5,556ms). At MATCHED T the two stages sit within ~3 points at every
   beat. The rest was ACCUMULATION: `drawField` cleared in CSS pixels and drew in
   backing-store pixels, so at dpr 2 three quarters of the canvas were never repainted. The
   readings were real; the attribution was not.
2. **§3b (density scaled to cell count) is NOT implemented**, on the operator's own
   instruction once the cause was established. After the clear fix the phone's live density
   already matches the desktop's (peak lit 22.6 % against 20.0 %), so thinning would correct
   one defect twice. The ambient ring's peak IS the wide stage's density.
3. **§3a (12 -> ~15px cells) is DECLINED**, on a measured table. The mark's pixel size is
   bound by the width fit, so bigger cells make the raster COARSER at the same physical
   size: at the brief's own numbers it falls to 32 cells per glyph, below `verify-coldboot`'s
   existing floor of 40, with its ink figure landing exactly on the floor of 15.
   `MIN_CELL_PX` is untouched in either direction.

**notes for ARCHITECTURE.md patch**: `field.ts` now publishes `mark.lineGlyphs`,
`mark.colsPerGlyph`, `visibleCols`, `markMarginLeft/Right`, `blockMarginLeft/Right` and
`ambientMean` on `__XMR_FIELD__`, and `ColdBoot` adds `markFontSettled`. The rule worth
carrying: **a canvas that draws in backing-store coordinates must clear with the store's own
dimensions**, and the two conventions in this tree (transform-installed → clear in CSS px;
no transform → clear in store px) must not be mixed within one file.

**open questions**:
- The deliberate audit of the other 30 canvas clear sites. A sweep found no second instance
  and both conventions are internally consistent, but inspection is weaker than assertion.
  Ledgered on the operator's instruction; not this PR's.
- The narrow sweep DIRECTION is ungated (M5 refused to go red, as predicted). A
  quadrant-coverage assertion would be confounded by the composition being top-weighted at
  every breakpoint.
- At 1440x900 **dpr 2** the loop is slow enough in this sandbox that the wall ceiling
  engages — base 7,482ms against head 7,616ms, a 1.8 % difference inside either's run-to-run
  spread, so PRE-EXISTING.
- `markFontSettled` can arrive after the decrypt has ended at 10x CPU (measured 9.4s),
  leaving that reader the fallback raster.

## 8 · LOOP FEEDBACK

- 2026-08-22 · The brief's §0 ("where this disagrees with your own measurement, YOUR
  MEASUREMENT WINS") is what made this release possible. Three of its premises did not
  survive, and the one that mattered was a correct measurement attributed to the wrong
  cause. The instrument that settled it cost one command: draw at MATCHED T, then vary only
  the device pixel ratio.
- 2026-08-22 · `INFERRED` from the gate work: an assertion's SUBJECT is as important as its
  polarity. Turning a floor into a band would not have caught this defect, because all four
  floors read a value that never touches a pixel and the section runs at the one device
  pixel ratio where the defect does not exist. The missing assertion was not a ceiling; it
  was a different measurement.
