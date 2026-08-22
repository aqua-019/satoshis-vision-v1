---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260822-M7
branch: claude/mobile-terminal-bootup-prompt-dlp5ju
status: in_progress
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

status:
pr:
commits:
deps added:
deviations from spec:
notes for ARCHITECTURE.md patch:
open questions:

## 8 · LOOP FEEDBACK
