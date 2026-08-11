# FINDING — the fit wrapper, the type floor, and why mobile has never looked right

Measured on `claude/sediment-v2-1-arpfjq` (v2·1), 2026-08-10. **Recorded, not fixed.**
Nine views affected; the sediment PR is only where it surfaced.

> Committed to the repo in v2·2 (constellation). `V2-VIEW-CONFORMANCE.md` Rev 3 §8 cites this
> path, and until this commit the path did not resolve — the write-up existed only in the
> operator's chat. A contract that cites a file which is not in the tree is a dangling
> reference, which is the documentation form of the same defect the contract exists to catch.

---

## The measurement

```
viewport   .mp-fit scale   authored   rendered box   rendered FONT
1440       0.359756        11px       5.04px         3.96px
2560       0.650085        12px       10.4px         7.80px
390        0.121231        11px       1.70px         1.33px
```

## One unit correction, because the column heading matters

`getBoundingClientRect().height` on a `<text>` node is the em/line box, **not** the font size.
The rendered font size is `authored × scale`; the box is about 1.27× that:

```
1440   5.04 / (11 × 0.359756) = 1.274
390    1.70 / (11 × 0.121231) = 1.275     ← same element, same ratio, so the numbers are sound
2560  10.4  / (12 × 0.650085) = 1.333     ← does not match: a DIFFERENT element was sampled here
```

Two consequences.

**First, read the last column, not the box** — 5.04px is a box around a 3.96px glyph, and
quoting the box overstates legibility by 27%.

**Second, the 2560 row is not the same element as the other two.** `--fs-label` reaching its
12px ceiling is a DOM label, while 1440 and 390 sampled the SVG tick. The table reads as one
series and is actually two. **Do not compute a trend across it.**

## The part that is not about that PR at all

`0.121231` at 390px. `styles.css:1207` records sediment's natural size as **2279×2495**, so at
a phone width the fit wrapper is squeezing a 2279px artboard into roughly **276px** — and every
glyph in the view renders at about **1.3px**.

That is a mechanism for something the operator has been reporting from the beginning:

> "phone/mobile for every update of v6 is not looking good at all"

It has been read as a polish problem across several rounds. **It is not.** It is a uniform 0.12
scale applied to an artboard eight times wider than the viewport, and **no amount of spacing or
composition work inside the view can affect it**, because the wrapper scales whatever the view
produces. Every mobile observation in this ledger should be re-read against that number.

## What it does to the mobile port's scope

The port is no longer "tune the phone layout." It has one decision to make first:

- **Do phones get `FitView` at all?** `MempoolPage.tsx:24` applies it; `styles.css:1210`'s
  `@media (min-width: 769px)` already carves desktop out of the shrink-wrap rule, so a separate
  phone path is half-expressed in CSS but the wrapper is not conditioned on it. Classic and
  Terminal are already excluded from FitView (`FitView.tsx:11-12`) — that precedent is the shape
  of the answer.
- **Or is `minWidth` finally engaged?** `useChartMetrics` has `minWidth = ceil(vbWidth / maxK)`
  and a docblock saying that below it "the container stops shrinking and the artboard pans
  instead" — pan rather than shrink is exactly the right behaviour at 390. It is unreachable
  today because no caller passes `vbWidth`, so `k = 1`, `u` is the identity, and `minWidth` is 0
  everywhere in the app.

`maxK = 1.7` was chosen to hold a type floor down to a scale of about 0.59. The measured scale
is 0.36 at desktop and 0.12 at phone — **both past what the machinery was designed to rescue,
and the machinery is switched off regardless.**

## The rule this produces

The floor is a claim about **rendered** size, so it must be measured **after every transform
between the author and the reader**. More generally:

- an assertion about an **absolute rendered quantity** — type size, contrast area, hit-target
  minimum — must be taken **post-transform**;
- an assertion about a **relation** between elements — collision, ordering, containment,
  non-overlap — **may** be taken before them, because a uniform scale preserves it.

That is why scenario 6's collision work is sound at any scale while the type floor is not, and
it is the sentence the next view PR should read first. It is carried into the contract as Rev 3
**§9 · assertion space**.

## Status

- **v2·1 (sediment):** raising the axis from `11 × 0.82` to `11` authored is correct and lands
  on `--fs-label`'s sanctioned floor. It does not meet the floor on screen and could not have.
- **Not fixed here.** Both remedies change `useChartMetrics`' contract with every chart in the app.
- **Owner:** the mobile port, which now has a measured root cause rather than a symptom.

## v2·2 addendum — measured for constellation

Constellation declares **no natural-size CSS rule** of its own (unlike sediment's
`styles.css:1207`), so its `.mp-fit` scale is whatever its own content width produces. The
figure measured for this view at 1440 is reported in the v2·2 PR body and in
`handoffs/HANDOFF-XMRIRISH-20260811-22.md` §7 rather than restated here, because it is a
property of that view's composition and will move when the composition does.
