---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260818-M4
branch: claude/mobile-terminal-orb-fix-4oa3be
status: done
written_by: claude-code
owner: claude-code
---

# HANDOFF — p4·M4 the mobile terminal sequence, and the missing orb

## 1 · GOAL

A phone visitor to `/` sees a cold-boot decrypt they can READ — the wordmark
resolves as "XMR.IRISH" rather than as a two-row smear — in a sequence that is
shorter than the desktop one and bounded in wall-clock time so a slow device
gets LESS of it rather than more. And the orb renders in the console's Network
slot on a phone, instead of sitting pinned 753px below the fold while the slot
arrives empty.

Launch-blocking. v6 ships after this PR; the remaining mobile work in §3 OUT is
deferred by operator decision.

## 2 · CONTEXT

- Base: `e0c87ad` (#196, p4·M1 — the stacked phone CONSOLE). #196 did not touch
  the DECRYPT PHASE that runs before it, and no assertion covered it.
- Files: `app/src/coldboot/{field,schedule,gate}.ts`,
  `app/src/coldboot/{ColdBoot,ColdBootConsole}.tsx`, `app/verify-coldboot.mjs`.
- CLAUDE.md: the p4·M1 note (the console fix and its "assert against the defect"
  lesson), p4·05 (the `__XMR_CLOVER__` read-hook idiom, and "measurably present
  and visually absent"), p3·19 (a recon agent measuring a moving tree).

## 3 · SCOPE

IN: the phone decrypt composition and its timing; the orb reaching the phone
console's Network slot; assertions for both, in the existing
`verify-coldboot.mjs`.

OUT (non-goals), deferred post-launch by operator decision:
- the mempool `?v=` crash/reload loop on iOS WebKit (unreproduced; WebKit not
  installed in this sandbox)
- phone-scale mempool layout (five views run 3–4.5 screens at 390)
- `verify-mobile` exercising only one of ten mempool views

## 4 · CONSTRAINTS

- ≥12px for any glyph a reader reads; `prefers-reduced-motion` loses no
  information; the sequence must FAIL OPEN (`cb-pending` hides `#root` behind an
  opaque floor and all three removers stay).
- Desktop (≥1000px) untouched.
- Mint no chunk. `cssGz` had 416 B of margin — prefer zero new stylesheet rules.
- Extend `verify-coldboot.mjs`; do not add a gate file (it is already exempt
  from `verify-coldboot-live` §0's bypass audit).

## 5 · DONE-CRITERIA

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run build` exits 0
- [ ] `verify-coldboot` green, including the new sections, quoted
- [ ] `verify-cbpending` green, quoted
- [ ] `verify-degraded` green, quoted
- [ ] `verify-coldboot-live` green, quoted
- [ ] the wordmark's raster resolution at 360/390/430 is asserted and RED on the
      base tree
- [ ] the decrypt→console flip is bounded at 1× AND under 6× CPU throttle, and
      RED on the base tree
- [ ] the wide stage is bounded BOTH ways, so the narrow duration cannot leak
- [ ] the orb covers the phone slot after a scroll, and RED on the base tree
- [ ] `/` CLS unchanged at 0.0000, quoted
- [ ] budgets re-derived after the LAST src commit; nothing minted
- [ ] census recounted with a CONTROLLED instrument
- [ ] two-polarity transcript per new assertion
- [ ] renders looked at: decrypt mid-run and at handoff at 360/390/430, the
      console with the orb, reduced motion, and 1440 for desktop
- [ ] Branch pushed · draft PR opened

## 6 · VERIFY COMMANDS

```
cd app
npx tsc --noEmit
npm run build
node scripts/serve-dist.mjs 4173 &
node verify-coldboot.mjs
node verify-cbpending.mjs
node verify-degraded.mjs
node verify-coldboot-live.mjs
node verify-bundle.mjs
```

## 7 · REPORT

**Outcome: done.** Two defects fixed, both measured before and after, both gated.

**The decrypt.** The wordmark is a RASTER, so its legibility is cells per letterform, not
font size. Measured as ASCII before any code: 390 gave 38 cols x 2 rows = **4.0 ink cells
per glyph** against a 1440 control of 43.8. Scaling cannot fix it in either direction —
bigger cells mean fewer columns and a worse raster, smaller cells break the 12px floor — so
the mark stacks onto two lines below 560px. **4.0 -> 26.3 ink/glyph at 390** (23.4 at 360,
33.8 at 430). Duration: a narrow base of 3,000ms plus an unclamped wall accumulator bounding
the run at 1.35x its effective duration — **5,785 -> 3,523ms at 1x**, and at 10x throttle the
loop goes **7,348 -> 3,922ms**. 1440 is unchanged (5,745 -> 5,787, three runs spanning 9ms)
and the gate bounds it BOTH ways.

**The orb.** Painted, sized and positioned correctly, 753px below the fold: #196 made the
console grid a scroll container and a scroll moves a box without resizing it. A capture-phase,
passive, rAF-coalesced scroll listener republishes the slot rect; the ENTER travel is
protected structurally (`startRect` is captured once; the store is written only while
`phase === "splash"`). **That fix cost CLS 0.242 until it was measured** — 48x the ceiling,
and invisible to every gate because `verify-cls` and `verify-vitals` both bypass the cold
boot. Same-size moves now keep the layout base and translate: **0.242 -> 0.000**.

**Gates**, all on the shipping tree: `verify-coldboot` **177 passed / 0 failed** (103 before);
`verify-cbpending` 27/0; `verify-degraded` all passed; `verify-coldboot-live` 21/0;
`verify-cls` 20/0 with `/` at **CLS 0.0000, unchanged**; `verify-bundle` 32/0.

**Budgets**, paired against an isolated worktree build of `e0c87ad`: eager **byte-identical**
(264,481), cssGz **byte-identical** (18,184), chunk count **76 = 76**, lazy **+2,079**
attributed to ColdBoot +2,008 and Orb +71 — **residual zero**. `lazyJsRaw` margin is now
**1,296 B** and is NOT raised because it is not crossed.

**Census** recounted with the instrument controlled against three commits, all reproduced
exactly: **88 / 84 / 22 / 38 / 74 / 6 — unchanged**, which is correct for a release that
extends an e2e member rather than adding a gate file.

**Eight break tests**, all red where intended after three refusals were fixed. Renders read
at 360/390/430 mid-decrypt, at handoff, the console with the orb, reduced motion, and 1440.

## 8 · LOOP FEEDBACK

- **A break test refused to go red THREE times, and every refusal was the gate.** Twice on the
  wall-ceiling assertion (a bound calibrated against a baseline the same release had already
  moved; then a throttle rate too mild to exercise the mechanism) and once on the metric
  itself (bounding-box area where the claim was about ink). **A bound is only as good as the
  baseline it was calibrated against — and when a release moves two things at once, fixing one
  can silently blind the assertion for the other.**
- **"Cannot move the baseline" and "is safe" are different claims.** The scroll-tracking fix
  scored CLS 0.242 while `/`'s recorded 0.0000 was provably immovable, because the gate that
  records it bypasses the surface. Ask what a gate's SUBJECT is before citing its number as
  reassurance.
- **The prompt offered three options and the arithmetic refuted the first before any code was
  written.** Restating the defect in the right unit (cells per letterform, not font size) was
  worth more than any amount of tuning.
- **Recon agents read a tree that was moving under them** (p3·19). Both detected it themselves
  and said so; one declined to take browser measurements at all. Dispatch recon BEFORE editing
  or point it at a pinned worktree.
- The handoff was self-authored in manual mode; the prompt was the task.
