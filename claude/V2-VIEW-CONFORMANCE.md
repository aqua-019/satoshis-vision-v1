# v2 MEMPOOL VIEWS — design-framework conformance

**REV 2 — measured against `main` = `6039d64` (v2·0 / PR #167 merged).** Rev 1 was written against
`292227a` and carried two claims that are now false; both are corrected below and marked. If you are
holding a copy without this line, it is Rev 1 and it is wrong in §3 and §5.

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
- **Reduced motion** renders the `table` prop **instead of** `children` — the canvas is not mounted, not
  merely paused. `MemViewShell` already does this; pass a real table.
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

---

## Conformance checklist for a v2 PR

```
[ ] no literal hex, hsl or rgb in the view — tokens only
[ ] PanelFrame/Stat/Pill/Card used; no hand-rolled panel chrome
[ ] every chart uses VB_W, AXIS, GRID, useSvgCursor, ChartCrosshair, ChartTip, useGradientId
[ ] axes come from charts.tsx's series components; a hand-rolled axis needs a stated reason
[ ] no two axis labels overlap — asserted, at 390 / 768 / 1440 / 2560
[ ] spacing from the --sp-1..7 ramp (already shipped in #167), never ad-hoc px
[ ] MemViewShell wrapped, id passed, real table supplied
[ ] useMemCanvas, never useTick; governor and D0699 consumed
[ ] particles open the shared tx inspector; blocks open the shared block inspector
[ ] composed at 3 tx as well as 300 — no empty plots, low-pool state designed
```
