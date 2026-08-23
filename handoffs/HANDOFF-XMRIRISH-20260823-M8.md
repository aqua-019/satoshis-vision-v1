---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260823-M8
branch: claude/mobile-mempool-prompt-p7ui2d
status: done
written_by: claude-code (manual mode — task arrived as a prompt)
owner: claude-code
---

# HANDOFF — p4·M8 "THE PHONE GETS A CLASSIC MEMPOOL IT CAN READ"

## 1 · GOAL

`/live/mempool?v=classic` is the DEFAULT view on the site's flagship surface, and it is
the one a phone lands on. When this is done a reader on a 320–430px phone gets a
composition built for that width rather than a desktop layout squeezed into it: one
horizontal scroller instead of three, a block ladder that opens on the now-divider
instead of on the least informative card, a transaction table whose columns are its
fields, and no row whose label and value have been shattered onto different lines.

## 2 · CONTEXT

**The brief is `p4M8mobileclassicmempool.md` (operator-supplied). SIX of its premises did
not survive measurement, and the brief says why in its own §6: everything in its §1 was
measured at DESKTOP width, and it states plainly that this "says nothing about what the
≤768px rules actually produce."**

Measured by the lead at 390×844 dpr3 on a build of the base commit, feed mocked live:

| brief's premise | measured |
|---|---|
| §1 `.mp-view--reflow` is a fixed 1756px canvas panned through a keyhole; "the page is scrolling in two axes at once, and that alone is what makes it feel broken" | **FALSE.** `.mp-view` is **366px**. `documentElement.scrollWidth === innerWidth` at 320/360/390/414/430. **Zero page overflow.** The v6.0.4 "Classic reflows on phones" block (`styles.css:3053`) already does this. |
| §3.1 `.mp-view--reflow` "must be `width:100%` on mobile" | **ALREADY IS** — `styles.css:3069`. |
| §3.3 stat strip "not 5 across, not a scroller" | **ALREADY 2-up** — `styles.css:3047`, measured 216px tall. |
| §3.5 telemetry rail "has no mobile home — decide deliberately" | **ALREADY `display:none`** on mobile. |
| §3.6 view switcher "needs a mobile position; bottom-anchored is the natural home" | Already in flow at 304×44 (meets 44px). The bottom is **already occupied** by a fixed `BottomTabBar` (390×60). |
| §3.7 "the fixed bottom status bar will wrap into a wall" | **The footer does not render at all** below 720px. |

Premises that DO survive: §3.2 (ladder `scrollLeft` is **0** on load, on the `~QUEUED`
card), gate 2 (**three** horizontal scrollers, **four** at 320), §3.4 (no block panel),
and §3.8 (type floor — but see below).

**§3.8's 13px is a RAISE ABOVE the repo's own settled floor, not a fix for a violation
of it.** Measured: 673 visible text nodes inside the classic view, at 12.00px (532) and
12.50px (141). **Nothing renders below 12.** The repo's p4·02 adjudication
(`styles-legibility.css:194`) is a 12px HARD MINIMUM below 720px, reached after ~25
releases of a standing conflict. This handoff treats 13px as a scoped composition
decision to be argued, not as a defect to be fixed.

**THE DEFECT THE BRIEF DID NOT NAME IS THE LARGEST ONE, AND IT IS NOT PHONE-ONLY.**
`MemTxTable` renders **transposed**. `.mem-tbl` is `display: grid` with N column tracks
(`styles.css:1769`); its children are `.mem-tbl__r` ROW WRAPPERS; and **no rule anywhere
gives `.mem-tbl__r` `display: contents`.** So each row wrapper is ONE grid item — row 1
lands in column 1, row 2 in column 2 — and its six cells stack vertically inside it.
Measured at 390: header labels `txid / fee/B / tier / size / age / in/out` all at
x=32 running DOWN, transactions at x=160/248/322/402/470 running ACROSS. 1,915px of
unreadable content, 38% of the page.

It has never laid out correctly. It is invisible on desktop only because `.mem-table` is
`display:none` above 768px — so the one surface this component ever renders on is a
phone. **And under `prefers-reduced-motion: reduce` it renders at 1440 too** (measured:
2,008px tall, cell x positions 280/1434/1522). The static table that exists specifically
to serve reduced-motion and small-screen readers is the surface that renders scrambled.
**Eight of the ten views pass a `MemTxTable`** (abyss · bridge · circuit · classic ·
constellation · orbital · pulse · reactor), so all eight are affected.

No gate can see it: `verify-memviews` counts columns off
`.mem-tbl.style.gridTemplateColumns` — the INLINE STYLE — which reads a correct 6 for a
table that renders nothing like six columns.

Relevant files: `app/src/mempool/classic.tsx`, `app/src/mempool/mempool-shared.tsx`,
`app/src/mempool/mem-stats.tsx`, `app/src/pages/MempoolPage.tsx`, `app/src/styles.css`
(the ≤768 block and its v6.0.4 sub-block), `app/src/styles-legibility.css`.

## 3 · SCOPE

**IN**
- `MemTxTable` laying out correctly wherever it renders (all eight views, phone and
  reduced-motion desktop).
- A phone form for the transaction table that does not need a horizontal scroller.
- Exactly ONE horizontal scroller on the phone classic view: the block ladder.
- The ladder's initial `scrollLeft` landing the now-divider in the middle third.
- Fixing the shattered `space-between` rows (fee-depth header, projected-block header,
  capacity row) and the collapsed 4-column fee-depth grid.
- The duplicate `LIVE · UPDATED Ns AGO` heartbeat.
- A block-detail panel opening below the ladder on tap, with a title and a dismiss.
- A new gate, wired mid-chain into `verify:e2e`, running at dpr 1, 2 AND 3.
- Break tests, both polarities, restored against the COMMITTED BLOB.

**OUT (non-goals)**
- The other nine mempool views' phone compositions (only the shared `MemTxTable` fix
  reaches them, and that fix is a correction, not a redesign).
- Moving the view switcher to the bottom edge — `BottomTabBar` already owns it.
- Rendering the telemetry rail on mobile — it is already `display:none`, and the brief's
  own recommendation is not to.
- Raising the site-wide type floor. Any 13px decision is scoped to this view and argued
  in the PR.
- `/live/mempool/tx/:txid` and the `?block=` deep-link contract.

## 4 · CONSTRAINTS

- React 18 · Vite 5 · TS strict. Edit `app/src/**`; no hand-edited HTML.
- CSP is `connect-src 'self'`. No third-party anything.
- **Zero fabricated values on live surfaces.** A live number is real or it is an em-dash.
- Every animation ships a `prefers-reduced-motion` path that loses no information.
- The site must work with JS off — every route is prerendered. A composition selected by
  a JS width branch emits the WRONG branch into the prerendered HTML.
- `verify-glide.mjs` scenario 4 asserts the block ribbon still renders under reduced
  motion. Suppressing the body and swapping in a table breaks it.
- Budgets: re-derive `verify-bundle` figures AFTER the last `src/` commit, not after the
  last green run.
- Census: RECOUNT, never increment, with the counting script CONTROLLED against ≥3
  historical commits first.
- Do not touch: `vercel.json`, `api/`, `relay/`, any other view's composition.

## 5 · DONE-CRITERIA — the gate reads ONLY this section

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run build` exits 0
- [ ] `MemTxTable` renders one grid ROW per transaction: at 390×844 the six header
      cells occupy six DISTINCT x positions and one y; asserted at dpr 1, 2 and 3
- [ ] The same holds at 1440×900 under `prefers-reduced-motion: reduce`
- [ ] `document.documentElement.scrollWidth === innerWidth` at 320, 360, 390, 414, 430
- [ ] EXACTLY ONE element in the document has `scrollWidth > clientWidth + 1`, and it is
      the block ladder (assert the count is 1, not ">= 1")
- [ ] No visible text node inside the classic view computes below the stated floor, at
      every gated width and dpr
- [ ] The ladder's initial `scrollLeft` puts the now-divider inside the middle third of
      the viewport
- [ ] Every tap target inside the classic view is ≥ 44×44 CSS px
- [ ] Tapping a confirmed block opens a titled, dismissible panel below the ladder; the
      ladder stays mounted; the dismiss control is ≥44×44
- [ ] `LIVE · UPDATED` renders exactly once on the phone classic view
- [ ] No label/value pair in the classic view is split across lines by a flex shatter
      (fee-depth header, projected-block header, capacity row)
- [ ] Every stage runs at dpr 1, 2 AND 3
- [ ] Every new or modified assertion has a two-polarity transcript: a state that passes
      it and a state that fails it, actuals for both
- [ ] `npm run verify:static` exits 0
- [ ] `npm run verify:e2e` exits 0, with the new gate green IN-CHAIN
- [ ] `verify-bundle` green; every ceiling re-derived after the last src commit
- [ ] Census recounted with the script controlled against ≥3 commits
- [ ] Branch pushed · draft PR opened

## 6 · VERIFY COMMANDS

```
cd app
npx tsc --noEmit
npm run build
npm run verify:static
node scripts/serve-dist.mjs 4191 &   # then:
npm run verify:e2e
node verify-mobile.mjs
node verify-bundle.mjs
```

## 7 · REPORT

**Outcome: done.** Branch `claude/mobile-mempool-prompt-p7ui2d` pushed.

### What the brief got wrong, and how that changed the work
Six premises did not survive measurement. Its §1 headline — a fixed 1756px canvas panned
through a keyhole, with two-axis scrolling as the root cause — is **false**: `.mp-view` is
366px at 390 and `documentElement.scrollWidth === innerWidth` at all five gated phone widths.
The brief's own §6 states that its §1 was measured at desktop width and "says nothing about
what the ≤768px rules actually produce."

The largest defect was one the brief did not name: **`MemTxTable` rendered transposed**, on all
ten views, in both states it renders in (≤768px, and reduced motion at any width), invisible to
every gate because `verify-memviews` counts columns off the inline style.

### Shipped
1. `.mem-tbl__r { display: contents }` — the transpose fix. One line, ten views, two states.
2. A phone composition for the classic view: one horizontal scroller (the ladder), one gutter
   instead of three, a four-column card-width table, stacked panel headers, 2×2 fee tiers,
   one heartbeat, 44px tap targets.
3. The ladder anchors on a NOW divider (`useLadderAnchor`) at frac 0.499, one card either side.
4. The block panel reaches the reader: `MemViewShell` reordered, `useDetailReveal` scoped to
   ≤720 in an effect, scroll restored on dismiss, a 79×44 named dismiss control.
5. Block cards became real controls; queued cards stopped faking an affordance.
6. A 13px type floor scoped to the classic view below 720.
7. `verify-memphone.mjs` — 396 assertions, wired at `verify:e2e` 7 of 39, every stage at dpr 1/2/3.

### Measured, base → shipping (five widths)
scrollers 4/3 → **1** · sub-13px nodes 673 → **0** · sub-44 targets 2 → **0** · clipped cells
60 → **0** · document height 5,092 → **3,971** at 390. Desktop unchanged.

### Instruments
- Census recounted, controlled against five commits, all exact: **89 / 85 / 22 / 39 / 75 / 6**.
- Budgets paired per stem against an isolated worktree: **residual zero**, eager byte-identical,
  nothing minted. Three ceilings raised while green (43 B / 77 B / 630 B margins), said out loud.
- **Break tests: eleven.** Ten red where intended (61 · 42 · 45 · 12 · 20 · 15 · 8 · 36 · 3, with M4 and
  M10 reddening at 320 ONLY, which proves they discriminate by width). **M7 refused**, and the
  refusal earned §7k/§7l: the reorder and the reveal are independently sufficient for what §7
  asserted, so only the document ORDER catches a regression. M7b then reds 5. 396 → 406.
  Two non-vacuity floors fired in anger (§0g on §9, §0f on §6a). One round was correctly VOID.

### What I got wrong
1. **My view count was eight; a worker's ten was right.** My grep went through a `sed` blind to
   two views' multiline props.
2. **My break harness ran git with repo-root pathspecs from `app/`**, so a restore silently
   no-opped and left the tree mutated — CLAUDE.md's own recorded rule, walked into. Caught only
   because the next run's anchor guard reported 0 matches. A GUARD 0 now refuses to start unless
   the tree is clean and marker-free.
3. **Two of my gate's own assertions were wrong**, both caught by the gate: §1g's arithmetic, and
   §0g's floor firing on a §9 that had become vacuous *because the fix removed its subject*.
4. **My first shatter detector flagged every baseline-aligned flex row**, and my first heartbeat
   counter matched `<html>` and a `<style>` tag — both instruments wider than their claim.
5. I launched the break harness in the same command that printed `M src/styles.css`, and did not
   read my own output before proceeding.

### Not fixed, and named
The phone block panel is still 2,725px in six sections. **Total fees and median fee for a mined
block are not available from any endpoint this site has**, so §3.4's ask for them is declined
rather than deferred. `ClassicBlockDetail`/`DetailItem` are dead code. `size`/`in/out`/`ring`/
`fee` are absent from the phone list (one tap away). `styles.css:3058` says "Classic and
Orbital" against five `reflow: true` entries. CLAUDE.md's `ci.yml` figure measures 31 not 30,
and "12 individually-named offline gates" measures 14.

**No human has seen the rendered result in a browser.**

## 8 · LOOP FEEDBACK
- The brief measured at desktop and generalised to a phone, and said so in its own §6. **A brief
  that states its instrument's limit should have that limit read before its conclusions are.**
- The brief asked for a table redesign; the table was structurally broken. Reading the render
  found in one screenshot what a DOM census did not name.
- A fix can remove its own gate's subject. Only a non-vacuity floor counting the SUBJECT rather
  than the SYMPTOM catches it.
- `PREFLIGHT`-style recon dispatched concurrently with editing measured a moving tree; both
  affected agents detected it themselves and said so unprompted. Dispatch recon before editing,
  or point it at a pinned worktree.
