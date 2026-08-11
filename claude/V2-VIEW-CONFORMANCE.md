# v2 MEMPOOL VIEWS — design-framework conformance

**REV 3 — measured against `main` = `fdf4ecc` (v2·1 / PR #168 merged), 2026-08-11.**
Rev 3 adds §8 and §9, adds addenda to §1 and §2, and **withdraws a false claim in §6**.
Rev 2 was measured against `6039d64`; Rev 1 against `292227a` and was wrong in §3 and §5.
If you are holding a copy without this line it is stale — check §6 first, because the
sentence that changed there was load-bearing and read as reassuring.

**What Rev 3 changes, in one place:**

| § | delta |
|---|---|
| §1 | addendum — `ConCard` is the same violation `SedCard` was |
| §2 | addendum — cursor math is singular and gated repo-wide |
| §6 | **CORRECTION** — "`MemViewShell` already does this" for reduced motion is FALSE |
| §8 | NEW — the type floor is a claim about RENDERED size, and `.mp-fit` sits in the way |
| §9 | NEW — assertion space, and what a tolerance actually buys |

Originally measured against `292227a`. **Every v2 prompt references this file.** The mockups exist to agree
the composition; this document is what makes the code slip into v6 rather than sit on top of it.

**The mockups invented tokens. The code must not.** My chat mockups used a made-up scale
(`--s1..--s7`, `--t-mi`, literal `#ff7a1a`, `#33d6e0`, `#FFD84D`). None of that ships. Below is what
actually exists and what must be used instead.

---

## 1 · Use the primitives that exist — do not re-implement them

`app/src/design/primitives.tsx` already exports, measured:

```
PanelFrame  (:150)   the panel. header + body + framing. do not hand-roll a .panel div
Stat        (:38)    the stat cell used by the strip
Pill        (:59)    the small labelled chip
Sparkline   (:209)   inline trend graphic
MiniBar     (:345)   inline bar
Card        (:566)   grouped surface
Crumbs      (:518)   takes path=, never items=
```

A v2 view that defines its own panel chrome is the "eleven widgets with skins" failure the spec warns
about — and it is also how the current spacing drifted per view.

**REV 3 ADDENDUM — the hand-rolled panel chrome is `ConCard` this time.**
`constellation.tsx:39` exports `ConCard({ title, right, children, pad, style }: any)` and calls it
**15 times**. It is the same violation `SedCard` was, with the same shape: a `<div>` with its own
background, border, radius, padding and a header row that re-implements `PanelFrame`'s title/right
slot. Replace it with `PanelFrame` from `design/primitives` (sediment now calls `PanelFrame` 17
times and defines no card of its own — `sediment.tsx:12` records "SedCard is gone").

Two things make `ConCard` strictly worse than a cosmetic duplicate, both measured:

- It is typed `: any`, so none of `PanelFrame`'s props are checked at the call site.
- **It cannot carry freshness.** `PanelFrame` takes `dataKey`, `stale`, `updatedAt` and
  `refreshing`; `ConCard` takes none of them, so every panel in the view is structurally
  incapable of reporting its own endpoint's last-success time. That is a provenance gap, not a
  styling one.

`ConCard` has **no consumers outside `constellation.tsx`** (verified by grep across `src/`), so
removing it is contained to the one file.

## 2 · Every chart is built on `chart-kit`, not raw SVG

`app/src/design/chart-kit.tsx`, measured:

```
VB_W = 1000            the canonical viewBox width — all charts share it
AXIS = var(--ink-40)   axis stroke
GRID = var(--line-d)   gridline stroke
useSvgCursor(viewW)    → [ref, vx, handlers]   pointer tracking in viewBox space
nearestIndex / slotIndex                        vx → datum
ChartTip / ChartTipRow / ChartTipProps          the tooltip
ChartCrosshair                                  the crosshair
useGradientId(prefix)                           collision-free gradient ids
```

**Higher chart fidelity means these, used properly** — a cursor, a crosshair, a tooltip with real rows,
gradient fills with unique ids, shared `VB_W` so every chart in a view aligns. Not more hand-drawn paths.

**REV 3 ADDENDUM — cursor math is SINGULAR, and it is gated repo-wide.**

```
useSvgCursor(viewW)   chart-kit.tsx:46    SVG    → [ref, vx, handlers], vx in viewBox units
canvasCursor(e)       chart-kit.tsx:111   canvas → {x, y} in the canvas's own CSS-px space
```

**Never re-derive either.** `verify-chartkit.mjs` greps `/clientX\s*-\s*rect\.left/` across the whole
tree and fails on any hit outside `src/design/chart-kit.tsx`. There is no allowlist. This gate failed
CI on v2·1 and is the reason PR #168 needed a second head.

`canvasCursor` was added in #168 (`1c333d6`). **The argument recorded for adding it rather than
waiving the rule was that "the four remaining v2 rebuilds and all five new views are canvas views."
That was a claim about PLANNED work stated as a fact about the codebase, and it was load-bearing —
it is why the primitive was generalised instead of the rule being waived.** Measured on `fdf4ecc`,
`canvasCursor` has exactly ONE consumer (`sediment.tsx:323`), and sediment is the only view in the
mempool directory that mounts a `<canvas>` at all. The primitive is still the right call; the
justification overstated its reach and is corrected here.

> Citation note: an earlier draft of this addendum cited `canvasCursor` at `chart-kit.tsx:95`.
> Line 95 is prose inside its docblock; the export is at **:111**.

## 3 · The label-fitting helpers — CORRECTED IN REV 2

**Rev 1 claimed "no view imports them." That was false and is withdrawn.**
`app/src/pages/markets/charts.tsx:31` imports `useChartMetrics, estTextW, labelStep, tickCount` and has
done throughout. Rev 1's grep was scoped to `src/mempool/` and `src/views/` and the result was
generalised to "no view" — a subject narrower than its claim, which is the defect family this document
exists to prevent.

**The real defect, found by measurement and fixed in #167:** `charts.tsx` computed the stride correctly
and then defeated it with `i % xStep === 0 || i === n - 1` — the forced final label collided with the
last strided one. The clause is gone; the reasoning is recorded at `charts.tsx:974-978`.

```
readChartFontScale(el)                    reads the REAL font scale off the DOM
estTextW(chars, fontPx)                   estimated label width
labelStep(n, innerPx, fontPx, avgChars)   → a STRIDE (render every Nth), not a count
tickCount(innerPx, fontPx)                how many ticks fit, clamped 2..5
```

**The rule for a v2 view:** consume `charts.tsx`'s series components (`AreaSeries`, `BarSeries`) rather
than hand-rolling an axis. They already carry the stride logic, the cursor, the crosshair and the tip.
A view that draws its own `<text>` labels has opted out of all of it and must justify why.

**Still open:** `verify-memviews` scenario 6 uses a 14-block fixture and the BarSeries defect needs ≥17,
so #167's fix is currently ungated.

## 4 · Tokens only. No literal hex anywhere.

`styles.css` defines **70** custom properties. The ones this work needs, with measured values:

```
surfaces   --bg-0 #050505 · --bg-1 #0a0907 · --bg-2 #11100c · --bg-3
           --surface-base/raised/ground/sunk
orange     --o-100 #ffce8a · --o-80 #ffb978 · --o-60 #ff8a2a · --o-50
           --o-40 #d6620f · --o-30 · --o-20 #4a2104 · --o-10
semantic   --accent-data (=o-50) · --accent-data-hi (=o-100)
           --accent-structural (=o-50) · --accent-structural-dim (=o-40)
ink        --ink-100/80/60/40/20/10   (--ink-40 rgba(168,160,148,.32))
lines      --line · --line-d rgba(255,122,26,.06) · --rule
status     --status-up (g-50) · --status-warn (y-50 #ffd400) · --status-down (r-50)
ramps      --c-50 #5ed3f4 · --y-50 #ffd400 · --g-50 · --p-50 · --b-50 · --r-50
motion     --d-1..--d-4 · --e-standard/accel/decel/expressive/spring
type       --f-mono · --f-sans · --f-serif
```

**Mockup → token mapping**, so nothing is guessed:

| mockup hex | ships as |
|---|---|
| `#ff7a1a` (normal tier) | `var(--accent-data)` / `var(--o-60)` |
| `#FF8C3B` (fast tier) | `var(--o-60)` → `var(--o-80)` for the lighter step |
| `#FFD84D` (fastest tier) | `var(--y-50)` |
| `#33d6e0` (slow tier) | `var(--c-50)` |
| panel bg / page bg | `var(--bg-1)` / `var(--bg-0)` |
| panel border | `var(--line)`; gridlines `var(--line-d)` |
| body / muted / faint text | `var(--ink-80)` / `var(--ink-60)` / `var(--ink-40)` |

## 5 · The spacing ramp — SHIPPED IN #167, USE IT

**Rev 1 said "there is no spacing scale." That was true then and is false now.** #167 added it:

```
styles.css:233-234
--sp-1: 4px   --sp-2: 8px   --sp-3: 12px  --sp-4: 16px
--sp-5: 24px  --sp-6: 32px  --sp-7: 48px
```

300 sites across `src/mempool/` and `src/views/` were migrated; 108 stay literal by policy. **Do not
re-add the ramp and do not invent rungs.** Spacing in a v2 view comes from `--sp-1..7` or it is one of
the documented literals, and a new value off the ramp needs a stated reason.

`--pad-main: 22px` and `--pad-page: 48px` remain as page chrome and are not renumbered.

Known inconsistency, not yet fixed: `.mp-switcher` itself still carries `padding: 10px` and `gap: 6px`,
neither on the ramp. It sat outside #167's stated migration scope. Fold it into whichever view PR next
touches that region.

## 6 · Standing v6 rules that apply to every v2 view

- **Type floor.** No text under 12px — with the recorded conflict that `styles-legibility.css` carries
  nineteen sub-12px declarations and `verify-legibility.mjs` records a deliberate 11px floor from v6.0.10.
  If a v2 view touches those selectors, report the conflict rather than silently picking a side.
- **Canvas via `useMemCanvas`** — elapsed-time, DPR-capped. **Never `useTick`** on a canvas path.
- **D0692 frame-budget governor** and **D0699 paused-until-visible** are consumed, not reimplemented.
  `verify-govern` §5 walks every rAF call site.
- **Reduced motion — CORRECTED IN REV 3.** `MemViewShell` renders the body **and** the table;
  `.mem-table` is `display: none` by default and `display: block` under
  `@media (prefers-reduced-motion: reduce)` (`styles.css:1468-9`). The table is an **addition,
  never a replacement** — an earlier revision swapped them and removed the Classic and Reactor
  block ribbons, which is why `verify-glide` scenario 4 exists. **Suppress animation, not
  content.** A view may render a static equivalent in place of an animated surface, provided the
  equivalent carries the same data and the same click targets. Pass a real table regardless.

  > **Rev 2 said the table renders "instead of `children`" and that the canvas is "not mounted."
  > That was false**, copied from a stale docstring at `mempool-shared.tsx:339-342` which still
  > contradicts the behaviour and the comment at `:359-365` twenty lines below it. The binding
  > constraint is `mempool-shared.tsx:366` — `const showBody = !tracking || keepBodyWhileTracking`
  > — which consults `tracking` and **never** reduced motion.
  >
  > This is the defect family this document exists to prevent, committed by this document: the
  > claim was READ off a docstring rather than MEASURED against the code. Sediment is compliant,
  > but for a reason the v2·1 prompt stated wrongly. Two comments in `mempool-shared.tsx`
  > (`:339-342` and `:378`) are corrected in the same PR as this revision — they are in the shell
  > every v2 view is built on, and one had already propagated into this contract and nearly into
  > a break test.
- **`id` must be passed to `MemViewShell`** — it becomes `data-mem-view`, which is how gates and deep
  links tell the surfaces apart.
- **Opaque stage background.** Data never renders over ambient decoration.
- **390px usable**, no horizontal scroll.
- **Zero `Math.random()`** outside `src/protocols/`. Currently zero in `src/mempool/` — keep it there.
- **Any inferred element is labelled inferred.** The Dandelion++ stem path is the live example: a node
  cannot observe another transaction's stem, so Relay-style propagation is illustration, and says so.

## 7 · The depth requirement — the view is the lens, the inspector is shared

`tx-detail.tsx` (594 lines) is the Classic-depth object panel and it already carries:

> Summary · Fee rate · Weight · Ring size · Ring signatures (CLSAG) · Proof system · Inputs · Outputs ·
> Stealth addresses one-time · View Tags · HIDDEN (Pedersen commitment) · First seen (this node) ·
> Dandelion++ stem + fluff · Mempool · Confirmation status · Blocks remaining · Until full unlock ·
> Spendability · On-chain components · On-chain metadata · Inclusion context · Raw RPC · Copy
>
> Block side: Block header · Block summary · Difficulty · Fullness · KB limit · Long-term wt ·
> Per-block target · Reward · Transactions · Included in this block · Chain linkage · COINBASE ·
> Mining · RandomX proof of work · block age

**Every particle in every v2 view opens that transaction inspector. Every stratum, block card or block
glyph opens that block inspector.** Views differ in how they show the population; depth on any single
object is identical across all eleven. No view reimplements a shallower detail panel.

## 8 · The type floor is a claim about RENDERED size, and `.mp-fit` sits between you and it

`FitView` wraps every fit-enabled view in `transform: scale(min(1, canvasW / naturalW))`
(`FitView.tsx`, `.mp-fit` at `styles.css:1235`). **A CSS transform does not fire ResizeObserver**,
so a view's geometry lives in layout space while the reader sees it scaled. Measured on `fdf4ecc`
by `verify-fit.mjs`:

| view | 1440 (canvas 1180) | 390 |
|---|---|---|
| sediment | `0.359756` — natural 3281 | `0.121231` — natural 3217 |
| bridge | `0.468812` — natural 2517 | `0.159054` — natural 2452 |
| reactor | `0.835103` — natural 1413 | `0.270645` — natural 1441 |
| **constellation** | **`1.0` — identity, natural 1028 ≤ 1180** | `0.379377` — natural 1028 |

And the type consequence, measured on sediment:

```
viewport   .mp-fit scale   authored   rendered box   rendered FONT
1440       0.359756        11px       5.04px         3.96px
2560       0.650085        12px       10.4px         7.80px
390        0.121231        11px       1.70px         1.33px
```

**Read the FONT column, not the box.** `getBoundingClientRect().height` on a `<text>` is the
em/line box, ~1.27× the font size; quoting it overstates legibility by 27%. And **the three rows
are TWO series, not one** — 1440 and 390 sample the SVG tick (ratios 1.274 / 1.275), while 2560
samples a DOM label at `--fs-label`'s 12px ceiling (ratio 1.333). **Do not compute a trend across
it.**

**Author to the sanctioned 11px floor, state the measured scale, and do not claim the floor is
met.** `useChartMetrics`' `k` / `u` / `minWidth` inflation exists for exactly this and is
**unreachable** — no caller anywhere passes `vbWidth`, so `k = 1` and `u` is the identity. Its
`maxK = 1.7` was chosen to hold a floor down to a scale of ~0.59; the measured 0.36 and 0.12 are
both past what it was built to rescue. Nine views affected. **Not a view PR's job.** Full
write-up: [`FINDING-fit-scale-type.md`](./FINDING-fit-scale-type.md).

**The scale has TWO terms, and both are properties of a COMPOSITION rather than of a view.**
`useFitToView.ts:47-67`:

```
naturalW = fit.offsetWidth        naturalH = fit.offsetHeight
canvasW  = scroll.clientWidth     scale    = min(1, canvasW / naturalW)

// then, only on a bounded vertical canvas (desktop; mobile is overflow-y:hidden):
heightScale = scroll.clientHeight / naturalH
if (heightScale < scale && heightScale >= scale * 0.92) scale = heightScale
```

So `naturalW <= canvasW` does **not** imply scale 1. The height clause takes over whenever a view
is *slightly* too tall — anywhere in the band `0.92 <= heightScale < 1`. The asymmetry is the part
worth holding: a view **much** too tall has `heightScale < 0.92`, the clause is skipped, scale
stays 1 and the view scrolls; a view **just** too tall is scaled down to fit. **Height therefore
only bites inside an 8% window — and that window is exactly where a hero rebuild lands a
composition.** At the floor of the band, authored 11px renders at **10.12px**, below the 11px
floor this section would otherwise be claiming the view meets.

`useFitToView.ts:38-40` names the current members by hand: *"genuinely tall views
(bridge/sediment/constellation) fall far outside it and keep width-fit + vertical scroll."* That
is why constellation measured identity scale on `fdf4ecc` — **not because it fits, but because it
is too tall for the height clause to engage.** A more compact rebuild can move a view INTO the
band and scale it DOWN, which is the opposite of the intuition that tidying a layout improves
legibility.

**State the band as a target, because it is where a designer aims. The threshold is relative to
the WIDTH scale, not to 1** — `scale` in that `if` is `min(1, canvasW/naturalW)`:

```
clause fires when   0.92 · wS  <=  heightScale  <  wS          where wS = min(1, canvasW/naturalW)
in canvasH:         0.92 · wS · naturalH  <=  canvasH  <  wS · naturalH
```

> **An earlier revision of this section wrote the band as `0.92 <= heightScale < 1`.** That is
> only the special case `wS = 1`. It was derived from constellation — the one view where `wS` IS
> 1 — and then stated generally: a claim wider than the subject it was measured on, in the
> section warning about exactly that. The general form is above.

The view is scaled precisely when it is **between 0% and 8.7% taller than the canvas allows at its
width scale**.

- `heightScale >= wS` → `heightScale < scale` is FALSE → does not fire → **scale = wS**
- `heightScale < 0.92 · wS` → skipped → **scale = wS**, vertical scroll
- **in between → scale drops to `heightScale`**, and authored 11px renders as low as 10.12px
  (relative to whatever `wS` already cost)

**The scale is 1 for two DIFFERENT reasons at opposite ends, and a rebuild moves you between
them.** That window is exactly what someone trying to make a hero composition "fit on screen
without scrolling" is aiming at. Land it, or leave it comfortably tall — **the failure is in
between, and it is silent, because a 0.94 scale looks like a design choice rather than a
fallback.**

**The constraint is a HOLE, not a floor — and it cannot be designed away.** Stating it as
"keep `naturalH` above the band" forecloses the *better* outcome, which is a composition that
genuinely fits the canvas with no vertical scroll at all. **Written out for a view at `wS = 1`
— constellation today, where `canvasH` = 702:**

```
naturalH <= 702         heightScale >= 1 → `heightScale < scale` FALSE → skipped
                        scale 1, and the view fits with NO vertical scroll     ← best outcome
702 < naturalH <= 763   clause fires → scale 0.92–1.0, type under the floor    ← the ONLY hazard
naturalH > 763          heightScale < 0.92 → skipped → scale 1, vertical scroll ← today (1107)
```

Both sides are safe; only the middle is not. **Avoid `(canvasH, 1.087 × canvasH]` — and for a
view whose `wS < 1`, avoid `(wS·… )` per the general form above, which sits far below its own
content height rather than just under it.**

**And `canvasH` is not a constant.** `.mp-canvas-scroll` is `flex: 1 1 auto` in the shell column
(`styles.css:1211`), so `scroll.clientHeight` tracks the browser window. 702 is one sample of one
user's window. **Measured chrome is 198px, constant across six viewport heights** (900/1000/1020/
1040/1080/800 all give `viewport − canvasH = 198`), so `canvasH ≈ viewportH − 198`.

Inverting the relation shows the hazard is not a design target at all — **every fit-enabled view
has a band of window heights that scales it, ~8% wide, positioned relative to its OWN width
scale. No choice of composition height escapes: moving the height moves the band with it.**

**Measured, and predicted-before-measured on the last two rows** (bands computed from `wS` and
`naturalH`, then confirmed by probe — `predicted == actual` in every case):

| view | wS | naturalH | band in canvasH | ≈ viewport | confirmed firing | scale when it fires |
|---|---|---|---|---|---|---|
| constellation | 1.000 | 1107 | 1018 – 1107 | 1216 – 1305 | not probed | — |
| reactor | 0.835103 | 991 | 761 – 828 | 959 – 1026 | **1440×1000** ✅ | **0.809284** |
| bridge | 0.468812 | 1856 | 800 – 870 | 998 – 1068 | **1440×1020** ✅ | **0.442888** |
| sediment | 0.359646 | 1761 | 583 – 633 | 781 – 831 | **1440×800** ✅ | **0.341851** |

**Sediment's row is the one that matters.** A 1440×800 laptop sits squarely inside its band, so
sediment — merged in #168 — is height-scaled *on top of* its width scale for a common window size:
0.359646 → **0.341851**, taking authored 11px from 3.96px to **3.76px**. Both are unreadable, so
this changes nothing about severity — **it completes the mechanism, and it proves the band is not
a theoretical corner.**

**So the honest form of the claim is:**

> At the measured desktop viewport, `naturalW` 1028 ≤ `canvasW` 1180 and `heightScale` 0.634 <
> 0.92, so `.mp-fit` scale is 1 and authored 11px renders at 11px. **That is a property of this
> composition at this window size, not of the view.** The height clause
> (`useFitToView.ts:58-65`) scales any view whose content height sits within ~8% above the canvas
> height, and since the canvas tracks the window, every composition has such a band. Keep
> `naturalH` outside `(canvasH, 1.087 × canvasH]` at the reference viewport; **accept that some
> window heights will still land in it.**

This is a **second, independent mechanism** by which the type floor goes unmet inside the fit
wrapper. The first is width-driven and compositional (sediment at 0.36). This one is
height-driven, narrow, and **unavoidable rather than compositional**. The remedy is the same for
both — engage `minWidth`/`k`, or exempt the view from the wrapper — which is why both are recorded
as one finding with two mechanisms in `FINDING-fit-scale-type.md`.

**Measured on `fdf4ecc` at 1440×900 (`canvasW` 1180, `clientHeight` 702), all four fit-enabled
views — predicted scale equals actual in every row, so the model above is validated, not
asserted:**

| view | naturalW | naturalH | widthScale | heightScale | clause fires | scale |
|---|---|---|---|---|---|---|
| reactor | 1413 | 991 | 0.835103 | 0.708375 | no | 0.835103 |
| bridge | 2517 | 1856 | 0.468812 | 0.378233 | no | 0.468812 |
| sediment | 3281 | 1761 | 0.359646 | 0.398637 | no (width-bound) | 0.359756 |
| constellation | 1028 | 1107 | **1** | 0.634146 | no | **1** |

> Sediment is the instructive row: its `heightScale` is *greater* than its `widthScale`, so the
> clause's `heightScale < scale` test fails and height never enters. Height only competes on
> views that are proportionally taller than they are wide relative to the canvas.

**THE ACTIONABLE FINDING — a live code path with ZERO coverage, recorded not fixed.**
`HEIGHT_FIT_TOLERANCE` changes the rendered scale of every fit-enabled view, and **nothing in the
suite exercises it.** `verify-fit.mjs:44` runs exactly two viewports, `1440×900` and `390×844`,
and the clause fires at neither, for any view. It is emphatically not dead code — it fires for
three of the four views at ordinary laptop heights, measured above. **That is why neither scale
mechanism was noticed until this week.**

Per §9, every "the scale is N" claim taken at 1440×900 is **silent about this branch** rather than
evidence against it.

**The remedy is one viewport, not a redesign:** `verify-fit` (or `verify-memviews`) gains a height
at which the clause fires for at least one view, and asserts the resulting scale. That converts
"the comment says Reactor" into a standing check. **Not this PR.** The three numbers that make it
reproducible without rebuilding the probe: `wS`, `heightScale`, and the viewport — e.g. reactor
`wS 0.835103`, `hS 0.809284`, at `1440×1000`.

> Related, and also recorded not fixed: `verify-fit.mjs:9`'s header comment says reactor *"fits
> both axes at 1440"*. The gate's own output five lines later measures `scrollH 828 − clientH 702
> = 126` of vertical scroll for reactor at that viewport. The comment is stale; the measurement is
> right.

**Carry into the Reactor v2 prompt:** `useFitToView.ts:36` names Reactor as the only view the
clause was written for — *"by a couple of percent."* Reactor is therefore the one view already
inside the band by design at some viewport heights, so its scale is **already load-bearing** and
its type floor is **already below authored size** there. Any composition change to Reactor moves a
live scale, from the first line of that work rather than as a hazard to discover.

**Do not write "view X is at identity scale" as a property of the view.** Write the measurement
with its terms, and re-derive it on the shipped layout:

> Measured on the shipped composition at 1440: `naturalW` = \_\_\_, `canvasW` = \_\_\_,
> `naturalH` = \_\_\_, `scroll.clientHeight` = \_\_\_, resulting `.mp-fit` scale = \_\_\_.
> Authored 11px renders at \_\_\_px. The scale is 1 only while `naturalW <= canvasW` **and**
> `heightScale` falls outside `[0.92, 1)` (`useFitToView.ts:58-65`).

**A pre-rebuild `naturalW` is not evidence about a post-rebuild view.** The figure measured on
`fdf4ecc` (constellation `naturalW` 1028 against `canvasW` 1180) describes the 503-line
composition being replaced. This is the same error shape as v2·0's `20 blocks → stride >= 2`,
which was derived from sediment's pre-rebuild width and was false by the time that PR shipped.
Treat natural width and natural height as **budgets**, measure both on what actually ships, and
quote the measurement rather than the conclusion.

## 9 · Assertion space — where a measurement is taken decides what it can mean

- An assertion about an **ABSOLUTE RENDERED QUANTITY** — type size, contrast area, hit-target
  minimum — **must be measured after every transform between the author and the reader.**
- An assertion about a **RELATION** between elements — collision, ordering, containment,
  non-overlap — **may** be measured before them, because a uniform scale preserves it.

That is why `verify-memviews` scenario 6's collision sweep is sound in layout space at any scale,
while a type-floor assertion taken in the same space is not.

**And a tolerance is an UPPER BOUND ON THE ERROR A TEST CAN DETECT, not a safety margin.**
Any assertion carrying a tolerance has a defect class it structurally cannot see, and **the
tolerance is the size of that class**. The live example: sediment's canvas hit-test uses
`hitR = max(p.r + 3, 6)`, chosen for thumbs, and that generosity silently became the detection
threshold for a coordinate-space bug — a passing hit-test does not distinguish "the spaces agree"
from "the spaces disagree and the tolerance absorbed it". The DPR case is the sharp end: on a 1×
CI runner `eff === 1` and a backing-store-vs-CSS-px mismatch is EXACTLY zero, so it ships green
and is wrong on every retina phone.

**When an assertion has a tolerance, name the error it is blind to, and verify that class by
construction — trace the units — rather than by the assertion.**

### A GATE'S RESULT IS USABLE ONLY IF THE RUN COMPLETED — check the summary line, not the exit code

**A crashed run and a failing run are indistinguishable by exit code and nearly indistinguishable
by output shape.** Both exit 1. Both print at least one `❌`. Counting `❌` lines yields a
plausible small number either way. **Nothing in "1 failure" announces that the gate died before it
could look for a second.**

Live instance: `verify-perf`'s recorded baseline was "one failure — un-gated `setInterval`". That
run had no server on `:4173`; the gate completed its three STATIC assertions, hit the runtime
section, and died at `page.goto` with `ERR_CONNECTION_REFUSED`. It never evaluated the rest. Run
to completion against a live server, the same tree has **three** distinct failures:

```
❌ un-gated setInterval in: src/data/useNodePopulation.ts, src/design/useFreshClock.ts
❌ pre-paint stamp wrong: tier=low hydrated=true
❌ / still animating while hidden — 179 rAF callbacks in 3s
```

The first reading was not a smaller measurement — **it was not a measurement.**

**An exit code is a claim about the PROCESS; the summary line is a claim about the ASSERTIONS.**
Before quoting any gate result, confirm the terminal summary is present and no stack trace stands
where it should be. This is the third distinct mechanism by which this harness has produced output
that LOOKED like a result — after v2·0's false green (a mutation that never applied) and the
stride vacuity (a precondition that could not fire) — and it belongs beside them.

> Corollary, learned the same afternoon: **a checker's predicate is itself a claim with a
> subject.** A path-existence audit reported nine false positives because exact string matching
> made a trailing slash read as a missing directory; a link checker reported a MISS on a tracked
> file because `tr -d '](.)'` stripped the dot out of `.md`. Two instruments built to catch this
> family, both committing it, within an hour. The only defence that has actually worked is to
> **separate extraction from adjudication and make the adjudication deterministic and
> re-runnable** — e.g. adjudicate paths against `git ls-files`, never against a guess.

---

## Conformance checklist for a v2 PR

```
[ ] no literal hex, hsl or rgb in the view — tokens only
[ ] PanelFrame/Stat/Pill/Card used; no hand-rolled panel chrome (§1 — ConCard, SedCard)
[ ] every chart uses VB_W, AXIS, GRID, useSvgCursor, ChartCrosshair, ChartTip, useGradientId
[ ] cursor math imported, never re-derived — useSvgCursor / canvasCursor (§2, gated repo-wide)
[ ] axes come from charts.tsx's series components; a hand-rolled axis needs a stated reason
[ ] no two axis labels overlap — asserted, at 390 / 768 / 1440 / 2560
[ ] spacing from the --sp-1..7 ramp (already shipped in #167), never ad-hoc px
[ ] MemViewShell wrapped, id passed, real table supplied
[ ] reduced motion suppresses ANIMATION, not CONTENT — body stays, static equivalent
    carries the same data AND the same click targets (§6, corrected)
[ ] useMemCanvas, never useTick; governor and D0699 consumed
[ ] particles open the shared tx inspector; blocks open the shared block inspector
[ ] composed at 3 tx as well as 300 — no empty plots, low-pool state designed
[ ] natural width measured and stated; if it crosses the canvas width the view has
    silently acquired a scale transform (§8)
[ ] every absolute-rendered-quantity assertion taken post-transform; every tolerance
    names the defect class it cannot see (§9)
```
