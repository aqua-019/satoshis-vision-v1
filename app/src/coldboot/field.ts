/**
 * coldboot/field.ts — the seeded full-bleed decrypt renderer. Ported from
 * docs/v6-mockups/coldboot-splash.html:927-1106 (glyph atlas, the cipher,
 * `composeTarget`, `drawField`) plus the cell-layout half of its `resize()`
 * (:1032-1048), which the mockup couples to atlas/target building and this
 * port keeps coupled for the same reason: `buildAtlas` and `composeTarget`
 * both need the SAME cols/rows/cw/ch a caller derives from `layoutField()`,
 * or the atlas and the target grid disagree about cell size.
 *
 * ── DETERMINISM CONTRACT ─────────────────────────────────────────────────
 * `drawField(ctx, w, h, T, density?)` is pure in its arguments: the same
 * five inputs, called any number of times, issue byte-identical
 * `drawImage()` calls — no `Date.now()`, no frame counter, no
 * `matchMedia()` read, nothing accumulated across calls except a memoised
 * geometry cache (below) that is itself a pure function of (w, h, dpr) and
 * therefore invisible to a caller comparing two runs. This is the property
 * `verify-coldboot`'s screenshot-diff gate checks.
 *
 * Three things the mockup does that this module deliberately does NOT:
 *
 *   1. No `prefers-reduced-motion` branch anywhere in this file. Per the
 *      coordinator's ruling: reduced motion is the HOST's decision — under
 *      reduce, the host mounts straight to the console at T=1 and this
 *      module's decrypt visuals are simply never asked to carry the
 *      message (the console's own DOM checklist text does, statically,
 *      selectable). `drawField(ctx,w,h,1)` — reached only via the ordinary,
 *      unbranched code path below — already resolves to a "converged and
 *      fading to black" frame, which is an honest empty canvas, not a
 *      frozen pre-decrypt scramble.
 *   2. No frame-budget governor. The mockup's `GOV`/`governor(dt)`
 *      (:687-697) samples wall-clock `dt` to adapt density — exactly the
 *      kind of real-time feedback that would make `drawField`'s output
 *      depend on frame history instead of on `T`. Inverted per the
 *      coordinator's ruling into an optional 5th parameter instead:
 *      `density` (default 1, full richness). The HOST computes it (e.g.
 *      `governorScaleQuantised()` from `@/design/useAnimationClock` — this
 *      module does not import that, by design) and passes a plain number;
 *      a gate that never passes one gets 1 and therefore a pinned, provable
 *      draw. Data cells (the wordmark, the cipher) never read `density` —
 *      only ambient background scramble does, matching the mockup's own
 *      "ambient sheds first, data never" comment at :690.
 *   3. No LCG. The mockup's private `srand`/`seedTo` (:664-666) is gone;
 *      every seeded value here comes from `h3(x, y, s)` — spatial, stable
 *      per cell without sequence state — imported from `@/design/prng`. The
 *      mockup's own `hexRun()` (:960-961) already drew from `h3`, not from
 *      `srand`, so porting it is a no-op on that front; nothing here adds a
 *      new PRNG primitive.
 *
 * ── COLOUR ───────────────────────────────────────────────────────────────
 * The mockup's four `TINTS` RGB triples are not arbitrary — checked against
 * styles.css, all four are exact hits on existing structural tokens:
 * [255,122,26]→--o-50 (#ff7a1a), [255,206,138]→--o-100 (#ffce8a),
 * [168,160,148]→--ink-100 (#a8a094), [74,222,128]→--g-50 (#4ade80). None of
 * the four is redeclared per `:root[data-theme=...]` (they sit in the base
 * token block styles.css:76-153, alongside `--tk-accent`'s own source), so
 * resolving them once per atlas build rather than once per theme is
 * correct today; if that ever changes, the atlas cache below would need a
 * theme key added to it. Resolved via a local `resolveToken()` — a sibling
 * of `mempool/useMemCanvas.ts`'s `cssColor()`, not an import of it (that
 * file's own header explains why canvas colour-resolution helpers stay
 * per-directory rather than shared; `pages/future/FutureMini.tsx`'s
 * `resolveVar()` is the same pattern).
 *
 * ── CANVAS CONTRACT ──────────────────────────────────────────────────────
 * `w`/`h` are expected to be the host's `clientWidth`/`clientHeight` (never
 * `getBoundingClientRect()` — see `useMemCanvas.ts:104-112`), already
 * clamped to `useMemCanvas`'s own `MAX_DIM`. `dpr` is derived from
 * `ctx.canvas.width / w` (the backing-store-to-CSS-pixel ratio the host's
 * resize already applied) rather than taken as a parameter, then clamped to
 * [0.5, 2] here defensively — "DPR capped at 2" per the brief.
 * `ctx.shadowBlur` is never used (glyphs are blitted from a pre-baked atlas
 * via `drawImage`, never per-cell `fillText` — the ~9-16k-cell cost this
 * whole module exists to avoid).
 */

import { h3 } from "@/design/prng";
import { B, E, clamp01, lerp, seg } from "./schedule";

// ── local types (types.ts doesn't exist yet — see the brief's own note that
// director-build owns it; these are declared here to be absorbed/renamed
// later, not duplicated once it lands) ─────────────────────────────────────

/** A pre-baked glyph sheet: every printable character × 4 tints × 6 alpha
 *  steps, blitted with `drawImage` rather than redrawn with `fillText`. */
export interface GlyphAtlas {
  readonly canvas: HTMLCanvasElement;
  /** one glyph cell's width, in the atlas's OWN backing-store pixels (i.e.
   *  already `× dpr`) — the mockup's `aTW`. */
  readonly cellW: number;
  /** as `cellW`, height — the mockup's `aTH`. */
  readonly cellH: number;
}

/** The composed cell grid: what each cell resolves to, what "class" of
 *  content it belongs to, and when (as a T value) it locks in. */
export interface FieldTarget {
  readonly cols: number;
  readonly rows: number;
  /** glyph index into `CHARS`, one per cell; always >= 0 for cells with a
   *  nonzero `tclass`. */
  readonly target: Int16Array;
  /** 0 = ambient background · 1 = wordmark raster · 2 = sub-line ·
   *  3 = kicker / cipher frame+labels · 4 = cipher values. */
  readonly tclass: Uint8Array;
  /** the T value (0..1) at which this cell locks to its target glyph. */
  readonly lockAt: Float32Array;
  /** Per-cell ambient weight, 0..1 — a multiplier on the ambient acceptance
   *  threshold AND on ambient alpha, so a low value both thins and dims.
   *  EXACTLY 1.0 in every cell on a wide stage, which makes both products
   *  float no-ops and keeps the desktop frame bit-identical. See the
   *  "AMBIENT WEIGHT FIELD" block above for what shapes it on a phone. */
  readonly ambient: Float32Array;
  /** The wordmark's own bounding box IN CELLS, and how many letterforms it
   *  spans. Carried on the target rather than recomputed by a caller because
   *  it is a by-product of the raster loop that already walks every cell —
   *  and because it is the ONE number that says whether the mark can be read:
   *  a letterform needs cells, not pixels. See `WORDMARK`'s docblock. */
  readonly mark: MarkBox;
  /** The sequence's CLOSING LINE as it was actually PLACED — decoded back out
   *  of `target`, over the fully visible columns only.
   *
   *  Reported rather than assumed because the placement can silently lose
   *  characters: `putLine` drops any cell outside `[0, cols)`, and
   *  `layoutField` returns one more column than the viewport shows, so
   *  "51 characters fit in 51 columns" was true and a 360px reader still saw
   *  "NOT ENCODED IN THE PROTOCO". This is the OUTPUT of the placement, not its
   *  input, so a gate reading it checks the grid rather than restating the
   *  arithmetic that filled it. */
  readonly closingLine: string;
}

/** Where the rasterised wordmark landed, in cells. `glyphs` counts
 *  letterforms (the dot included — it occupies cells like any other). */
export interface MarkBox {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly rows: number;
  readonly cols: number;
  readonly glyphs: number;
  /** Letterforms on the WIDEST line — `glyphs` for a one-line mark, and the
   *  longer of the two for a stacked one. */
  readonly lineGlyphs: number;
  /** `cols / lineGlyphs` — how many cell COLUMNS each letterform of the
   *  widest line actually gets.
   *
   *  ── WHY THIS IS NOT `cols / glyphs` ────────────────────────────────────
   *  On a stacked mark those are different questions and only this one has an
   *  answer. `mark.cols` is the width of the WIDEST LINE, so dividing it by
   *  BOTH lines' letter count charges one line's width to nine letterforms and
   *  under-reports by the stacking factor: at 390 it reads 47/9 = 5.2 where
   *  "IRISH" really gets 47/5 = 9.4. The p4·M7 brief drew its "the letterforms
   *  are under-resolved — 5.2 columns against desktop's 13.8" from exactly that
   *  mismatch, comparing a stacked figure against a single-line one. The gap is
   *  real (9.4 against 13.7) and it is 1.5x, not 2.6x. */
  readonly colsPerGlyph: number;
  /** LIT cells — how many cells the raster actually inked. */
  readonly ink: number;
  /** `rows * cols / glyphs` — the mark's BOUNDING-BOX area per letterform. */
  readonly cellsPerGlyph: number;
  /** `ink / glyphs` — the same idea in the unit that cannot be gamed.
   *
   *  ── WHY BOTH, AND WHY THIS ONE IS THE ASSERTION ──────────────────────
   *  `cellsPerGlyph` is a BOX, and a box can be large and empty: a mark that
   *  inked three cells inside a generous bounding box satisfies it. This is
   *  not hypothetical carefulness — the first version of this release quoted
   *  the box figure ("8 → 63 at 390") against an intuition about ink, which
   *  overstates the change by 2.3x. Measured at 390: box 8 → 63, INK 4.0 →
   *  26.9, against a 1440 control of 82.7 box / 43.8 ink. The gate asserts
   *  the ink figure and prints both. */
  readonly inkPerGlyph: number;
}

/** Cell geometry for a given CSS-pixel viewport. */
export interface FieldLayout {
  readonly cols: number;
  readonly rows: number;
  /** CSS px per cell. */
  readonly cw: number;
  readonly ch: number;
  /** CSS px font size the layout was measured at. */
  readonly font: number;
}

interface FieldGeometry {
  readonly layout: FieldLayout;
  readonly atlas: GlyphAtlas;
  readonly fieldTarget: FieldTarget;
  /** per-column backing-store x offset (already `× dpr`) — the mockup's
   *  `COLX`, precomputed once per geometry so the hot loop never multiplies
   *  per cell. */
  readonly colX: Int32Array;
}

// ── glyph atlas constants (coldboot-splash.html:927-933) ───────────────────

const CHARS: readonly string[] = (() => {
  const a: string[] = [];
  for (let c = 32; c <= 126; c++) a.push(String.fromCharCode(c));
  a.push("█", "▓", "▒", "░", "·", "◆", "●", "○");
  return a;
})();
const CIDX = new Map<string, number>(CHARS.map((c, i) => [c, i]));
/** Guaranteed present — pushed explicitly above. Computed once so every
 *  "character not in the glyph set" fallback (`putLine` below, matching
 *  coldboot-splash.html:972's `CIDX.get('·')` fallback for e.g. the kicker's
 *  '▪' characters) is a single Map lookup, not a re-derivation. */
const DOT_IDX = CIDX.get("·")!;
const BLOCK_IDX = CIDX.get("█")!;
const SHADE_IDX = CIDX.get("▓")!;

const SCRAM = "0123456789abcdefABCDEF!@#$%&*+=/\\<>[]{}()|~^?:;.,";

/** The four tint tokens, in the exact order the mockup's `TINTS` array used
 *  them (index 0 = orange accent, 1 = light-orange flash, 2 = ink/ash body,
 *  3 = green rare-highlight) — see the file header's colour-mapping table. */
const TINT_TOKENS: readonly string[] = ["--o-50", "--o-100", "--ink-100", "--g-50"];
const ALPHAS: readonly number[] = [0.1, 0.2, 0.32, 0.48, 0.68, 1];

/** Below this an atlas tile would be invisible but not free to skip drawing
 *  — coldboot-splash.html:957. */
const CULL = 0.06;

/** Font-size floor, CSS px. The mockup's own `FONT` breakpoint table
 *  (:1038) never goes below this, and this constant exists so it never
 *  quietly does after an edit — canvas-rendered text is invisible to every
 *  DOM/SVG-based legibility gate in this repo (`verify-legibility.mjs`
 *  reads inline `fontSize` and SVG attributes; a `fillText` call is neither).
 *  No gate enforces this constant; it is asserted by construction only. */
export const MIN_CELL_PX = 12;

/** The phone predicate — ONE literal, read by `layoutField` (which drops to
 *  `MIN_CELL_PX` below it) and by `composeTarget` (which stacks the wordmark
 *  below it). It was already implicit in `layoutField`'s own `w < 560`
 *  breakpoint; naming it is what stops a second phone threshold drifting away
 *  from the first, which is the two-lists-one-truth defect this repo records
 *  against itself repeatedly.
 *
 *  560 is `layoutField`'s existing font breakpoint, unchanged — the widest
 *  phone in the gate band is 430 and the narrowest tablet this repo lays out
 *  for is 768, so the threshold sits in an empty gap rather than on a device. */
export const PHONE_MAX_W = 560;

/** True where the field must compose for a TALL, NARROW stage. */
export function isNarrowStage(w: number): boolean {
  return w < PHONE_MAX_W;
}

/** Hard cap on `cols * rows`. The mockup runs to 18000 (:1043); tightened
 *  here per the brief ("~16k... on large displays"). Enforced the same way
 *  the mockup enforces its own cap: inflate `cw`/`ch` (fewer, bigger cells)
 *  rather than clip `cols`/`rows` (which would leave dead space at the
 *  viewport's edge). No gate measures this; see the return's UNVERIFIED. */
export const MAX_CELLS = 16000;

/** The mockup's `S.density` default (:678) — the ambient-cell richness
 *  ceiling before the (now host-owned) governor scales it down. `density`
 *  passed into `drawField` is a 0..1 multiplier on this, not a replacement
 *  for it — matching the mockup's `dens = S.density * GOV.scale`. */
const BASE_DENSITY = 1.6;

/* ══════════════════════════════════════════════════════════════════════════
 * THE NARROW STAGE'S OWN COMPOSITION (p4·M7)
 *
 * ── WHAT THE PHONE DEFECT WAS ────────────────────────────────────────────
 * The operator reported the decrypt as "a wall of static" on a phone. The
 * cause is the missing backing-store clear fixed in `drawField` below — see
 * that comment for the measurement. It is NOT the ambient density law, and the
 * brief that preceded this release said it was, on two readings that are real
 * and were attributed to the wrong thing:
 *
 *   1 · "15.3 % bright at 390 against 0.7 % at 1440 — 20x", read at t≈1000ms.
 *       A phone runs `EFFECTIVE_NARROW_MS` (3,333) and a desktop runs
 *       `EFFECTIVE_MS` (5,556), so one wall-clock instant is T=0.30 on one
 *       stage and T=0.18 on the other — two different beats of one schedule.
 *   2 · The rest is ACCUMULATION. Phones are dpr 2-3 and the desktops this was
 *       authored on are dpr 1, so the missing clear reads as a breakpoint
 *       difference while being a device-pixel-ratio difference.
 *
 * Re-measured at MATCHED T on a CLEARED canvas, peak coverage across the whole
 * run (max channel > 24 = lit, > 120 = bright):
 *
 *              390x844 dpr2      1440x900 dpr1
 *      lit         22.6 %            20.0 %
 *      bright      12.0 %             6.8 %
 *
 * The phone's live field is already at the desktop's density once the clear is
 * fixed. NOTHING BELOW THINS IT FURTHER, and that is a deliberate decision
 * rather than an omission: thinning on top of the fix would be correcting the
 * same defect twice, and the phone would come out sparser than the stage the
 * operator calls a highlight. The brief's §3b ("density scaled to cell count")
 * is therefore NOT implemented, on the brief author's own instruction once the
 * cause was established.
 *
 * What IS wrong with the phone composition, independently of the clear, and
 * measured off the composed grid rather than argued:
 *   · the mark ran 3 columns from the left edge of 54 visible, with ambient
 *     scramble pressing on the letterforms at the same 12px and the same tint;
 *   · the cipher block started at column 2 and the closing line reached column
 *     53, so the message was edge-to-edge with no frame;
 *   · rows 33-50 of 51 carried NO content at all — the bottom 35% of a tall
 *     stage was undifferentiated field with nothing to anchor it;
 *   · the sweep ran left-to-right, i.e. across the SHORT axis of a 390x844
 *     stage.
 * Those are §3c, §3d and §3e of the brief, they survive its own correction,
 * and they are what the rest of this block is for.
 *
 * ── WHY THE CELL SIZE IS NOT RAISED ─────────────────────────────────────
 * The brief's §3a asks for 12 -> ~15px, "fewer, bigger cells". Measured, by
 * rasterising the real grid at 390x844 across the font x margin plane (the
 * shipped parameters reproduce the shipped mark box EXACTLY as the control):
 *
 *      font  margin   grid     mark box   cells/glyph   ink/glyph
 *        12       3   56x51      46x13         66          30.1
 *        12       4   56x51      45x13         65          26.6   (SHIPS NOW)
 *        13       5   51x48      37x11         45          20.3
 *        14       5   48x44      34x10         38          17.1
 *        15       5   45x42      32x 9         32          15.0   (the brief's ask)
 *
 * The mark's pixel size is bound by the WIDTH fit, so bigger cells do not make
 * the mark bigger — they make it COARSER at the same physical size. At the
 * brief's own numbers the raster falls to 32 cells per glyph, BELOW
 * `verify-coldboot`'s existing floor of 40, with its ink figure landing exactly
 * on the floor of 15. And the raise buys nothing against the wall it was
 * proposed for, because that wall was the clear. The cell size is therefore
 * UNCHANGED at `MIN_CELL_PX`, and `MIN_CELL_PX` itself is untouched — no floor
 * moved in either direction.
 * ══════════════════════════════════════════════════════════════════════════ */

/** Columns of quiet reserved at each edge of a NARROW stage — the wordmark's
 *  fit fraction, the cipher block's left edge and the closing-line ladder's fit
 *  test are all derived from this, so there is ONE authority for "how much air
 *  the message gets" instead of a magic 0.92 in one place and a `Math.max(0, …)`
 *  clamp in another.
 *
 *  ── 4 IS MEASURED, AND IT IS NOT THE SAME NUMBER AS THE MARGIN IT BUYS ───
 *  The reserve is applied to the FIT, and the raster is then centred on `w / 2`
 *  in pixels, so the clearance the reader actually gets is a column or two more
 *  than the reserve. Measured across the phone band, reserve against the mark's
 *  own margins IN VISIBLE COLUMNS, with the cells-per-glyph each costs:
 *
 *     reserve   390x844        360x800        430x932        320x568
 *        0 (base)  3 / 4 · 68    3 / 3 · 57    3 / 4 · 81    3 / 3 · 46
 *        3         4 / 5 · 65    4 / 4 · 50    4 / 5 · 78    4 / 4 · 40
 *        4         5 / 6 · 57    5 / 5 · 48    6 / 6 · 73    5 / 5 · 34
 *        5         6 / 7 · 50    6 / 6 · 45    6 / 7 · 66    6 / 6 · 32
 *
 *  The brief asks for "≥5 columns of margin each side". A reserve of 4 delivers
 *  exactly that at every width in the band, in the unit a reader sees, and 5
 *  buys one more column for another 7-9 cells per glyph. The mark's resolution
 *  is what makes a letterform a letter; the margin is framing, and the ambient
 *  clearing below already does most of the framing job for free. So: the
 *  smallest reserve that meets the requirement, not the largest that fits.
 *
 *  SHIPPED AS A FRACTION rather than as the flat 4 this table was measured at —
 *  see `narrowMarginCols` immediately below for the 320px measurement that
 *  forced it. At 390 the fraction resolves to 4, so this table's 390 row is the
 *  shipped one. */
export const NARROW_MARGIN_FRAC = 0.075;

/** The reserve for a stage with `visibleCols` fully visible columns.
 *
 *  ── WHY A FRACTION AND NOT THE CONSTANT 4 ────────────────────────────────
 *  A flat reserve charges the narrowest stage the most: 8 columns of 44 at
 *  320px is 18% of the field against 14% at 430, and the mark pays for it in
 *  raster. Measured across 144 stages (w 320-550 x h 560-1000), a flat 4 takes
 *  320x844 from 46 cells per glyph to 34 — BELOW `verify-coldboot`'s own floor
 *  of 40, at the narrowest width this repo gates anywhere. The fraction spends
 *  a proportional share instead, which is what "margin" means on a stage whose
 *  width is the variable.
 *
 *  Clamped at 3 because two columns is not a margin, and the closing-line
 *  ladder needs the block to stay wide enough to hold rung 3 (31 characters)
 *  at 320's 44 visible columns. */
export function narrowMarginCols(visibleCols: number): number {
  return Math.max(3, Math.round(visibleCols * NARROW_MARGIN_FRAC));
}

/* ── THE AMBIENT WEIGHT FIELD ────────────────────────────────────────────
 * A per-cell multiplier on the ambient acceptance threshold and on ambient
 * alpha, computed once per geometry from the DISTANCE (in CSS pixels, so it is
 * isotropic across a 7.2 x 17 cell) to the nearest cell the composition
 * actually uses. It is a BUMP, not a falloff, and each end is a separate claim:
 *
 *   · near the message   -> a CLEARING, so the counters of R and S and the gap
 *     between "XMR." and "IRISH" are not filled with scramble at the same size
 *     and the same tint as the letterforms. This is `/about/site`'s clover
 *     doing the same thing one surface over: the stream is CONSUMED where the
 *     shape is.
 *   · far from the message -> EMPTY SPACE, so the 18 content-free rows under
 *     the cipher block read as the end of the transmission rather than as more
 *     of it. This is the quantity the brief correctly says nothing measures.
 *   · in between          -> the RING, and its peak is EXACTLY the wide stage's
 *     own density. There is no global thinning term at all: `AW_FLOOR + (1 -
 *     AW_FLOOR) * ring` reaches 1.0 wherever `ring` does. Measured peak lit
 *     coverage at 390x844 dpr2 with the ring at 1.0 is 17.0 % against a
 *     1440x900 dpr1 desktop's 20.0 %, and the whole 5.6-point difference from
 *     the un-composed 22.6 % is the clearing and the fade — not a knob.
 *     Candidates at 0.85 and 0.62 were rendered and read too (15.7 % and
 *     13.8 %); both are legible and both are the same defect corrected twice.
 *
 * WIDE STAGES GET A FIELD OF EXACTLY 1.0 IN EVERY CELL, so every product below
 * is an exact float no-op and the desktop frame is bit-identical. That is
 * asserted against a captured baseline rather than argued here. */

/** Ambient weight in the clearing and at the far edges. */
const AW_FLOOR = 0.1;
/** CSS px from the nearest content cell at which the ring reaches full density.
 *  ~4 columns / 1.8 rows at the phone's 7.2 x 17 cell.
 *
 *  CHOSEN BY LOOKING, against 22, all rendered at 390x844 dpr2 at T=0.45 and
 *  read as images rather than as numbers — which is the only instrument that
 *  can answer this, since every candidate sits inside the same coverage band.
 *  At 22 the letterform counters and the space around "SATOSHI'S VISION" still
 *  carry scramble; at 30 the sub-line, the closing line and the counters are
 *  clear and the field still reaches to within four columns of the message. */
const AW_RISE_PX = 30;
/** CSS px at which the ring starts to fall away again. */
const AW_HOLD_PX = 64;
/** CSS px at which the field has faded back to `AW_FLOOR`. 260 is a little
 *  under the 306px of empty stage measured below the cipher block at 390x844,
 *  so the fade completes inside the region it is for. */
const AW_EDGE_PX = 260;
/** Ambient ALPHA is scaled by `AW_ALPHA_FLOOR + (1 - AW_ALPHA_FLOOR) * aw`, so
 *  the cells that do survive out in the quiet are dimmer as well as rarer.
 *  Thinning alone opens gaps; dimming is what gives the gaps depth. */
const AW_ALPHA_FLOOR = 0.55;

/** The decrypt's backdrop. A deliberate literal, not a token: coldboot-
 *  splash.html:1521 paints a fixed near-black regardless of theme (a "cold
 *  boot" terminal floor, not a themed surface), and nothing in the brief
 *  asked for it to re-tint per theme the way the four glyph tints do. */
const FIELD_BG = "#050505";

const MONO_FALLBACK = "ui-monospace, monospace";
const SANS_FALLBACK = "system-ui, sans-serif";

// ── the cipher (coldboot-splash.html:959-964) ───────────────────────────────

/** Seed constants, named so every seeded value in this module traces back to
 *  a documented source rather than a bare literal. */
const SCRAM_SALT = 91; // h3's third argument for hexRun — coldboot-splash.html:961
const KEY_IMAGE_SEED = 3; // coldboot-splash.html:963 (`hexRun(64,3)`)
const TX_ID_SEED = 5; // coldboot-splash.html:1005 (`hexRun(8,5)`)
const JITTER_SEED = 7; // per-cell lock-time jitter — coldboot-splash.html:1020
const BG_CHAR_SEED = 3; // background-cell membership — coldboot-splash.html:1090
const BG_DRIFT_SEED = 19; // background-cell drift offset — coldboot-splash.html:1100

/** `h3`-seeded hex string generator. Verbatim algorithm from
 *  coldboot-splash.html:960-961 — already `h3`-based in the mockup, so
 *  dropping the LCG (see the file header) doesn't touch this function. */
function hexRun(n: number, seed: number): string {
  let s = "";
  for (let i = 0; i < n; i++) s += "0123456789abcdef"[(h3(i, seed, SCRAM_SALT) * 16) | 0];
  return s;
}

/** The mark the field decrypts to. ONE line on a wide stage, verbatim from
 *  coldboot-splash.html:989.
 *
 *  ── WHY THERE IS A SECOND, STACKED FORM ──────────────────────────────────
 *  The wordmark is not TEXT here, it is a RASTER: `composeTarget` samples a
 *  drawn bitmap into the cell grid, so its legibility is governed by how many
 *  CELLS each letter gets, not by its pixel size. Measured, by rasterising the
 *  real grid and reading the result as ASCII before a line of this was written:
 *
 *      1440, one line   124 cols x 6 rows over 9 glyphs  =  83 cells/glyph  READS
 *       390, one line    38 cols x 2 rows over 9 glyphs  =   8 cells/glyph  noise
 *       390, one line widened to 0.92w
 *                        48 cols x 3 rows                =  16 cells/glyph  noise
 *       390, two lines   47 cols x 12 rows over 9 glyphs =  63 cells/glyph  READS
 *
 *  A phone has 56 columns and 51 rows. The columns are the scarce axis and the
 *  rows are the plentiful one, and a single 9-glyph line spends the scarce one
 *  to buy nothing: 9 glyphs across 40 columns is 4.2 columns each, and a
 *  letterform in 4 columns is a smudge at ANY font size. Stacking spends the
 *  plentiful axis instead — 5 glyphs across the same 47 columns is 9.4 each,
 *  and the block grows from 2 rows to 12 of the 51 available.
 *
 *  This is also why "scale the field" cannot fix it, in EITHER direction:
 *  bigger cells mean FEWER columns and a worse raster (at 2x cell size the
 *  mark gets 2.2 columns per glyph), and smaller cells mean sub-12px glyphs,
 *  which is the floor `MIN_CELL_PX` exists to hold. The layout is the only
 *  free variable. */
export const WORDMARK = "XMR.IRISH";

/** The weight `composeTarget` rasterises the mark at. Named once because
 *  `ensureMarkFont` below has to ask for the SAME face the raster will use —
 *  two literals here is two chances to load one face and draw another. */
export const MARK_WEIGHT = 800;

/** The same mark for a narrow stage — see `WORDMARK`'s measurements. Split at
 *  the dot, so both halves are real tokens of the name rather than an
 *  arbitrary hyphenation. */
export const WORDMARK_STACKED: readonly string[] = ["XMR.", "IRISH"];

/** Verbatim — coldboot-splash.html:965. */
export const KICK = "▪ COLD BOOT ▪";
export const SUB1 = "SATOSHI'S VISION · MONERO, LIVE";

/**
 * The real transaction the field decrypts, field by field. Verbatim from
 * coldboot-splash.html:962-964 — computed once at module load (`hexRun` is
 * pure, so this never needs recomputing per geometry build). The payoff is
 * the closing line composed in `composeTarget` below: everything here
 * decrypts, and `signer_index` does not, because ring signatures don't
 * encode one.
 */
export const CIPHER: ReadonlyArray<readonly [string, string]> = [
  ["version", "2"],
  ["unlock_time", "0"],
  ["vin", "key_offsets[16] · gen 0"],
  ["key_image", hexRun(64, KEY_IMAGE_SEED)],
  ["vout", "2 · stealth p2pk"],
  ["rct_type", "BulletproofPlus"],
  ["fee", "0.0000219 XMR"],
];

/** Verbatim — coldboot-splash.html:1014. The line the whole sequence closes
 *  on: four fields resolve, the fifth is the actual privacy guarantee. */
export const SIGNER_LINE = "└ signer_index  ???  ── NOT ENCODED IN THE PROTOCOL";

/** The closing line in three forms, WIDEST FIRST — `composeTarget` takes the
 *  first one that fits the stage's fully-visible columns.
 *
 *  ── WHY A LADDER AND NOT A LINE ─────────────────────────────────────────
 *  `putLine` silently drops any cell outside `[0, cols)`, so a line one
 *  character too wide loses that character with nothing said. Measured: at
 *  360px the shipped 51-character line rendered "…NOT ENCODED IN THE PROTOCO",
 *  and at 320px (iPhone SE, and this repo's own narrowest gated width) even a
 *  squeezed 49 renders "…NOT ENCODED IN THE PRO". A sentence about what the
 *  protocol does not encode, cut mid-word, is the one line here that must never
 *  truncate — so the PADDING yields, then the LINE BREAK yields, and the words
 *  never do.
 *
 *  Rung 2 is the same sentence with its two double spaces squeezed; every word
 *  is verbatim. Rung 3 wraps at the em-dash, which is where the line already
 *  divides its subject from its claim. Rows are the abundant axis on a phone —
 *  the same argument the stacked wordmark rests on — so spending one more of
 *  them is the cheapest thing this composition can do. */
export const SIGNER_FORMS: ReadonlyArray<readonly string[]> = [
  [SIGNER_LINE],
  ["└ signer_index ??? ── NOT ENCODED IN THE PROTOCOL"],
  ["└ signer_index  ???", "  ── NOT ENCODED IN THE PROTOCOL"],
];

// ── CSS custom property resolution (not cssColor() — see file header) ──────

function resolveToken(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** `#rgb` / `#rrggbb` → `rgba(r, g, b, alpha)`. Only ever called at
 *  atlas-build time (once per geometry, never inside the per-frame draw
 *  loop), so a malformed token degrades to the raw resolved string rather
 *  than throwing — matching `useMemCanvas.ts#cssColor`'s "resolve up front,
 *  fail where it's cheap" philosophy, even though this is a sibling
 *  implementation, not that function. */
function withAlpha(color: string, alpha: number): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return color;
  let hex = m[1];
  if (hex.length === 3) hex = hex.replace(/./g, (ch) => ch + ch);
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ── alpha-bucket LUT (coldboot-splash.html:951-956) ─────────────────────────

/** Nearest-`ALPHAS`-index lookup, 64 buckets. A linear search here ran once
 *  per visible cell in the original (~8-16k times a frame); precomputing it
 *  as a table is a straight port of the mockup's own fix at :951-956. */
const ABK: Uint8Array = (() => {
  const table = new Uint8Array(64);
  for (let k = 0; k < 64; k++) {
    const v = (k + 0.5) / 64;
    let best = 0;
    let bestDist = 9;
    for (let i = 0; i < ALPHAS.length; i++) {
      const d = Math.abs(ALPHAS[i] - v);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    table[k] = best;
  }
  return table;
})();

// ── layout (coldboot-splash.html:1032-1048, cell-geometry half only) ───────

/**
 * Resolve `cols`/`rows`/`cw`/`ch`/`font` for a CSS-pixel viewport. Pure
 * given a real `document` (needs a scratch canvas for `measureText`) — the
 * font-size breakpoints and the cap-driven cell-inflation loop are a direct
 * port of coldboot-splash.html:1038-1044.
 */
export function layoutField(w: number, h: number, mono?: string): FieldLayout {
  const font = isNarrowStage(w) ? MIN_CELL_PX : w < 1000 ? 13 : 14;
  const monoFont = mono ?? resolveToken("--f-mono", MONO_FALLBACK);
  let cw = 6;
  let ch = Math.round(font * 1.42);
  const probe = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
  if (probe) {
    probe.font = `${font}px ${monoFont}`;
    cw = Math.max(6, probe.measureText("M").width);
  }
  let cols = Math.ceil(w / cw) + 1;
  let rows = Math.ceil(h / ch) + 1;
  while (cols * rows > MAX_CELLS) {
    cw *= 1.12;
    ch = Math.round(ch * 1.12);
    cols = Math.ceil(w / cw) + 1;
    rows = Math.ceil(h / ch) + 1;
  }
  return { cols, rows, cw, ch, font };
}

// ── glyph atlas (coldboot-splash.html:936-949) ──────────────────────────────

export interface AtlasParams {
  /** CSS px cell width/height — from `layoutField()`. */
  readonly cw: number;
  readonly ch: number;
  readonly dpr: number;
  /** CSS px font size — from `layoutField()`. */
  readonly font: number;
  /** Override for `--f-mono`; resolved from the live token when omitted. */
  readonly mono?: string;
}

/**
 * Bake every glyph × tint × alpha-step combination into one offscreen
 * canvas, so the per-frame draw loop is `drawImage()` calls only — never
 * `fillText()`. Verbatim geometry from coldboot-splash.html:936-949; colour
 * resolution swapped from four hardcoded RGB triples to four `--*` tokens
 * (see the file header).
 */
export function buildAtlas({ cw, ch, dpr, font, mono }: AtlasParams): GlyphAtlas {
  const cellW = Math.ceil(cw * dpr);
  const cellH = Math.ceil(ch * dpr);
  const canvas = document.createElement("canvas");
  canvas.width = cellW * CHARS.length;
  canvas.height = cellH * TINT_TOKENS.length * ALPHAS.length;
  const g = canvas.getContext("2d");
  if (!g) return { canvas, cellW, cellH };

  const monoFont = mono ?? resolveToken("--f-mono", MONO_FALLBACK);
  g.textBaseline = "middle";
  g.textAlign = "center";
  g.font = `${Math.round(font * dpr)}px ${monoFont}`;

  const tints = TINT_TOKENS.map((t) => resolveToken(t, "#ffffff"));
  for (let ti = 0; ti < tints.length; ti++) {
    for (let ai = 0; ai < ALPHAS.length; ai++) {
      g.fillStyle = withAlpha(tints[ti], ALPHAS[ai]);
      const row = ti * ALPHAS.length + ai;
      for (let ci = 0; ci < CHARS.length; ci++) {
        g.fillText(CHARS[ci], ci * cellW + cellW / 2, row * cellH + cellH * 0.55);
      }
    }
  }
  return { canvas, cellW, cellH };
}

// ── target composition — wordmark raster + cipher layout + lock schedule
//    (coldboot-splash.html:966-1028) ────────────────────────────────────────

function putLine(
  target: Int16Array,
  tclass: Uint8Array,
  cols: number,
  rows: number,
  str: string,
  row: number,
  cls: number,
  spread: boolean,
  colStart?: number,
): void {
  if (row < 0 || row >= rows) return;
  const chars = [...str];
  const n = spread ? chars.length * 2 - 1 : chars.length;
  let c = colStart ?? Math.floor((cols - n) / 2);
  for (const ch of chars) {
    if (c >= 0 && c < cols && ch !== " ") {
      const i = row * cols + c;
      target[i] = CIDX.has(ch) ? CIDX.get(ch)! : DOT_IDX;
      tclass[i] = cls;
    }
    c += spread ? 2 : 1;
  }
}

/** Read a row of the composed grid back out as text, over the columns a
 *  reader can actually see. Empty cells become spaces. */
function readRow(target: Int16Array, cols: number, row: number, visibleCols: number): string {
  if (row < 0) return "";
  let out = "";
  for (let c = 0; c < Math.min(cols, visibleCols); c++) {
    const g = target[row * cols + c];
    out += g >= 0 && g < CHARS.length ? CHARS[g] : " ";
  }
  return out.trimEnd();
}

/** Smoothstep on [0,1] — used for both ends of the ambient ring so the field
 *  fades rather than steps. Two linear ramps banded visibly at 12px. */
function smoothstep(x: number): number {
  const v = clamp01(x);
  return v * v * (3 - 2 * v);
}

/**
 * Build the per-cell ambient weight field for a NARROW stage — see the
 * "AMBIENT WEIGHT FIELD" block near the top of this file for what it is for.
 *
 * The distance is a two-pass chamfer from every cell the composition uses
 * (`tclass !== 0`), measured in CSS PIXELS rather than in cells: a phone cell
 * is 7.2 x 17, so a distance counted in cells would be 2.4x tighter vertically
 * than horizontally and the clearing would come out as a wide flat ellipse
 * around a mark that is itself wide and flat. Weighting each step by `cw`/`ch`
 * makes the halo round on the reader's screen, which is the space the reader
 * is actually looking at.
 *
 * Returns `null` when the grid holds no content at all — the caller then keeps
 * a field of 1.0, because a composition that produced nothing has no shape to
 * clear around, and thinning the whole stage to `AW_FLOOR` would answer "the
 * raster failed" with "an almost black screen".
 */
function buildAmbient(
  tclass: Uint8Array,
  cols: number,
  rows: number,
  cw: number,
  ch: number,
): Float32Array | null {
  const n = cols * rows;
  const dist = new Float32Array(n);
  let seeds = 0;
  for (let i = 0; i < n; i++) {
    if (tclass[i]) {
      dist[i] = 0;
      seeds++;
    } else {
      dist[i] = Infinity;
    }
  }
  if (seeds === 0) return null;

  const dx = cw;
  const dy = ch;
  const dd = Math.hypot(cw, ch);
  const relax = (i: number, from: number, cost: number): void => {
    const v = dist[from] + cost;
    if (v < dist[i]) dist[i] = v;
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (dist[i] === 0) continue;
      if (c > 0) relax(i, i - 1, dx);
      if (r > 0) {
        relax(i, i - cols, dy);
        if (c > 0) relax(i, i - cols - 1, dd);
        if (c < cols - 1) relax(i, i - cols + 1, dd);
      }
    }
  }
  for (let r = rows - 1; r >= 0; r--) {
    for (let c = cols - 1; c >= 0; c--) {
      const i = r * cols + c;
      if (dist[i] === 0) continue;
      if (c < cols - 1) relax(i, i + 1, dx);
      if (r < rows - 1) {
        relax(i, i + cols, dy);
        if (c < cols - 1) relax(i, i + cols + 1, dd);
        if (c > 0) relax(i, i + cols - 1, dd);
      }
    }
  }

  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const d = dist[i];
    const ring =
      d <= 0
        ? 0
        : d < AW_RISE_PX
          ? smoothstep(d / AW_RISE_PX)
          : d <= AW_HOLD_PX
            ? 1
            : smoothstep(1 - (d - AW_HOLD_PX) / (AW_EDGE_PX - AW_HOLD_PX));
    out[i] = AW_FLOOR + (1 - AW_FLOOR) * ring;
  }
  return out;
}

export interface ComposeParams {
  readonly cols: number;
  readonly rows: number;
  /** CSS px cell width/height — must match what `buildAtlas` was called
   *  with for the same geometry, or the wordmark raster samples at the
   *  wrong pitch. */
  readonly cw: number;
  readonly ch: number;
  /** CSS px stage size. */
  readonly w: number;
  readonly h: number;
  /** Override for `--f-sans`; resolved from the live token when omitted. */
  readonly sans?: string;
}

/**
 * Rasterise "XMR.IRISH" into the grid (4-tap box sample, ink threshold 108,
 * solid threshold 190 — coldboot-splash.html:976-1000), lay the kicker/
 * sub-line/cipher text around it (:1002-1014), then assign every cell a
 * `lockAt` T value via the directional-sweep + radial-bias + per-cell-jitter
 * schedule (:1015-1027) so the resolve reads as a wave, not popcorn.
 */
export function composeTarget({ cols, rows, cw, ch, w, h, sans }: ComposeParams): FieldTarget {
  const target = new Int16Array(cols * rows).fill(-1);
  const tclass = new Uint8Array(cols * rows);
  const lockAt = new Float32Array(cols * rows);
  /* 1.0 EVERYWHERE unless a narrow stage overwrites it below. On a wide stage
     `drawField` then multiplies by exactly 1, which is an exact float no-op,
     so the desktop frame is bit-identical to the one this file drew before the
     array existed. */
  const ambient = new Float32Array(cols * rows).fill(1);
  /* Seeded EMPTY, not omitted. Where there is no 2d context there is no raster,
     and an all-zero box is the honest report of that — a caller reading
     `cellsPerGlyph` must never be handed a number from a raster that did not
     happen. */
  let mark: MarkBox = {
    top: 0, bottom: 0, left: 0, right: 0, rows: 0, cols: 0, glyphs: 0,
    lineGlyphs: 0, colsPerGlyph: 0, ink: 0, cellsPerGlyph: 0, inkPerGlyph: 0,
  };
  let closingLine = "";

  const off = document.createElement("canvas");
  off.width = Math.max(2, Math.round(w));
  off.height = Math.max(2, Math.round(h));
  const og = off.getContext("2d");

  if (og) {
    og.fillStyle = "#000";
    og.fillRect(0, 0, off.width, off.height);

    /* ── ONE MARK, TWO LAYOUTS — see WORDMARK's docblock for the measured
       cells-per-glyph table that forces this. Every number below is a pair:
       the wide-stage value is the mockup's, unchanged; the narrow one is
       derived from the phone's own grid, never guessed. */
    const narrow = isNarrowStage(w);
    const lines = narrow ? WORDMARK_STACKED : [WORDMARK];
    /* Size cap. Wide: the mockup's `min(w*.145, h*.26)`. Narrow: the width
       term is what strangled the mark (390 * .145 = 56.6px over 9 glyphs), and
       on a stacked mark the binding constraint is the width fit below, so the
       cap only has to be loose enough not to bind first — h*.26 is 219px at
       390 and the fit resolves to ~108. */
    let px = narrow ? h * 0.26 : Math.min(w * 0.145, h * 0.26);
    /* Fit fraction. 0.74 wide — the mockup's, untouched.
       NARROW: DERIVED from `narrowMarginCols` rather than written as a
       number. It was 0.92, chosen to buy raster resolution on a starved stage,
       and it bought the resolution by spending the margin: measured at 390x844
       the mark landed at column 3 of 54 visible, so the letterforms ran into
       the edge with ambient scramble pressing on them at the same 12px and the
       same tint. Deriving it means "how much air the message gets" is stated
       ONCE, in cells, and the pixel fraction follows — instead of a fit
       fraction here and a clamp two blocks down disagreeing about the answer.
       At 390 this resolves to 0.849 (46 of 54 visible columns usable); the raster
       cost is priced in `narrowMarginCols`' own docblock. */
    const fitFrac = narrow
      ? Math.max(0.5, ((Math.floor(w / cw) - 2 * narrowMarginCols(Math.floor(w / cw))) * cw) / w)
      : 0.74;
    const sansFont = sans ?? resolveToken("--f-sans", SANS_FALLBACK);
    og.textAlign = "center";
    og.textBaseline = "middle";
    og.fillStyle = "#fff";
    const setFont = () => {
      og.font = `${MARK_WEIGHT} ${px}px ${sansFont}`;
      if ("letterSpacing" in og) og.letterSpacing = `${Math.round(px * 0.05)}px`;
    };
    setFont();
    const measured = Math.max(...lines.map((l) => og.measureText(l).width));
    /* `measured > 0` FIRST. The refit divides by it, so a face that has not
       loaded and a fallback that also measures zero yields `px = Infinity`,
       which Canvas silently REJECTS as a font value — leaving the previous
       font in place and the mark drawn at the wrong size, or not at all. The
       exposure predates the stacked layout and is not introduced by it; a
       taller mark just makes the failure louder. `if (mTop > mBot)` below is
       the other half of the same fail-open path and must stay: it covers a
       raster that produced no ink at all, for the two-line branch exactly as
       it did for the one-line one. */
    if (measured > 0 && measured > w * fitFrac) {
      px *= (w * fitFrac) / measured;
      setFont();
    }
    /* Baseline. Wide: h*.335, the mockup's. Narrow: h*.30, which centres a
       12-row block high enough to leave the kicker 3 rows above it and the
       whole cipher below — measured at 390, the block spans rows 9-21 of 51
       and the closing signer line lands on row 33, well inside the `rows - 3`
       guard the cipher loop already carries. */
    const lineH = px * 1.02;
    const midY = h * (narrow ? 0.30 : 0.335) - ((lines.length - 1) * lineH) / 2;
    lines.forEach((line, li) => og.fillText(line, w / 2, midY + li * lineH));

    const img = og.getImageData(0, 0, off.width, off.height).data;
    const sample = (x: number, y: number): number => {
      const xi = Math.max(0, Math.min(off.width - 1, x | 0));
      const yi = Math.max(0, Math.min(off.height - 1, y | 0));
      return img[(yi * off.width + xi) * 4];
    };

    let mTop = rows;
    let mBot = 0;
    let mLeft = cols;
    let mRight = -1;
    let inked = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cw;
        const y = r * ch;
        const v =
          (sample(x + cw * 0.25, y + ch * 0.3) +
            sample(x + cw * 0.75, y + ch * 0.3) +
            sample(x + cw * 0.25, y + ch * 0.75) +
            sample(x + cw * 0.75, y + ch * 0.75)) /
          4;
        if (v > 108) {
          const i = r * cols + c;
          target[i] = v > 190 ? BLOCK_IDX : SHADE_IDX;
          tclass[i] = 1;
          if (r < mTop) mTop = r;
          if (r > mBot) mBot = r;
          if (c < mLeft) mLeft = c;
          if (c > mRight) mRight = c;
          inked++;
        }
      }
    }
    if (mTop > mBot) {
      mTop = Math.round(rows * 0.3);
      mBot = mTop;
    } else {
      /* Only a raster that actually inked cells reports a box. The fallback
         above is a LAYOUT anchor for the lines below it, not a mark, and
         publishing it as one would report a 1-row mark where there is none. */
      const mr = mBot - mTop + 1;
      const mc = mRight - mLeft + 1;
      const countGlyphs = (l: string) => [...l].filter((chr) => chr !== " ").length;
      const glyphs = lines.reduce((n, l) => n + countGlyphs(l), 0);
      const lineGlyphs = lines.reduce((n, l) => Math.max(n, countGlyphs(l)), 0);
      mark = {
        top: mTop, bottom: mBot, left: mLeft, right: mRight,
        rows: mr, cols: mc, glyphs, lineGlyphs,
        colsPerGlyph: lineGlyphs > 0 ? Math.round((mc / lineGlyphs) * 10) / 10 : 0,
        ink: inked,
        cellsPerGlyph: glyphs > 0 ? Math.round((mr * mc) / glyphs) : 0,
        inkPerGlyph: glyphs > 0 ? Math.round((inked / glyphs) * 10) / 10 : 0,
      };
    }

    putLine(target, tclass, cols, rows, KICK, mTop - 3, 3, true);
    putLine(target, tclass, cols, rows, SUB1, mBot + 2, 2, false);

    const labW = 12;
    /* NARROW: the body is cut to the margined width, on the SAME authority as
       the wordmark's fit — so the block and the mark share one left edge and
       one right edge instead of each finding its own. Measured at 390: the body
       goes 50 -> 44 columns, which drops the closing line from the ladder's
       rung 1 (51 characters, one line, reaching column 53 of 54 visible) to
       rung 3 (two lines, widest 31), i.e. the phone gets the WRAPPED form.
       That is the brief's §3d "author a phone line set" arriving without a
       single new word: the ladder already had the rung, and margining the block
       is what finally exercises it. Every word stays verbatim.
       WIDE is `cols - 6`, unchanged. */
    const marginCols = narrow ? narrowMarginCols(Math.floor(w / cw)) : 0;
    const bodyW = narrow
      ? Math.min(Math.floor(w / cw) - 2 * marginCols, 74)
      : Math.min(cols - 6, 74);
    /* ── CENTRE ON THE WIDEST LINE THE BLOCK WILL ACTUALLY DRAW ────────────
       `bodyW` is the body's own width, and every line is cut to it — except
       the closing line (`SIGNER_FORMS`), which is up to 51 characters and is the sentence the
       whole sequence closes on. Centring on `bodyW` alone put its left edge at
       column 3 on a 51-column stage, so the last four characters fell off the
       grid and a 360px phone read "NOT ENCODED IN THE PROT". Measured, and
       fixed by measuring: `blockW` equals `bodyW` for every `cols >= 57`, so
       this is arithmetically INERT at 430 (c0 3 → 3), 768 (13 → 13) and 1440
       (49 → 49), and moves only where the clip was real — 390 (3 → 2) and 360
       (3 → 0). */
    /* FULLY-visible columns. `layoutField` returns `ceil(w/cw) + 1`, so the
       last column (and often the second-last) lies partly or wholly past the
       right edge — deliberately, so the ambient field has no gap there. That
       is right for scramble and wrong for a sentence, and it is why the naive
       "51 characters fit in 51 columns" arithmetic still lost a character. */
    const visibleCols = Math.floor(w / cw);
    /* The widest form that fits, else the narrowest one there is — the ladder
       is ordered widest-first and its last rung wraps, so "none fits" means the
       stage is narrower than 32 cells and nothing in this file can help. */
    /* NARROW measures the ladder against the MARGINED width, not the visible
       one — otherwise the margin is reserved for the mark and then spent by the
       one line the whole sequence closes on, which is the defect the margin
       exists to fix, arriving through the back door. */
    const signerFit = narrow ? bodyW : visibleCols;
    const signerRows =
      SIGNER_FORMS.find((f) => Math.max(...f.map((l) => [...l].length)) <= signerFit) ??
      SIGNER_FORMS[SIGNER_FORMS.length - 1];
    const signerW = Math.max(...signerRows.map((l) => [...l].length));
    const blockW = Math.max(bodyW, signerW);
    /* Centred on the grid, then pulled left only as far as the last fully
       visible column requires. The clamp is what makes this inert above the
       phone band: it binds only when `c0 + blockW` would exceed `visibleCols`,
       which at 430/768/1440 it never does (c0 3 → 3, 13 → 13, 49 → 49). */
    const c0 = narrow
      ? /* NARROW: centred inside the margins, and never allowed outside them.
           The upper clamp is the wide stage's (never past the last fully
           visible column); the lower one is new and is what stops the block
           starting at column 2 while the mark starts at column 5. */
        Math.min(
          Math.max(marginCols, Math.floor((visibleCols - blockW) / 2)),
          Math.max(marginCols, visibleCols - marginCols - blockW),
        )
      : Math.min(
          Math.max(0, Math.floor((cols - blockW) / 2)),
          Math.max(0, visibleCols - blockW),
        );
    let row = mBot + 4;
    const cipherRows: number[] = [];
    const txId = hexRun(8, TX_ID_SEED);
    /* The header is a literal with its own dash run, cut to fit — and the cut
       used to land INSIDE the word on a narrow stage ("DECRYPTIN" at 360). The
       floor is the prefix's own length, derived from the same pieces rather
       than written as a number, so the rule reads "never cut the word" instead
       of "never cut before 31". Also inert at every width where `bodyW - 16`
       already cleared it: 390/430/768/1440 are unchanged. */
    const headHold = `┌ TX 0x${txId}  ── DECRYPTING `;
    putLine(
      target,
      tclass,
      cols,
      rows,
      `┌ TX 0x${txId}  ── DECRYPTING ─────────────────────`.slice(0, Math.max(bodyW - 16, [...headHold].length)),
      row,
      3,
      false,
      c0,
    );
    row++;
    for (const [k, v] of CIPHER) {
      if (row >= rows - 3) break;
      const val = v.length > bodyW - labW - 3 ? `${v.slice(0, bodyW - labW - 6)}…` : v;
      putLine(target, tclass, cols, rows, `│ ${k.padEnd(labW, " ")}`, row, 3, false, c0);
      putLine(target, tclass, cols, rows, val, row, 4, false, c0 + labW + 3);
      cipherRows.push(row);
      row++;
    }
    /* `rows - 1 - signerRows.length` so a two-row form needs two rows of
       headroom, not one. The old guard was `row < rows - 2` for a single line;
       for one row that arithmetic is identical. */
    if (row < rows - 1 - signerRows.length) {
      signerRows.forEach((line, i) => putLine(target, tclass, cols, rows, line, row + i, 3, false, c0));
      closingLine = signerRows.map((_, i) => readRow(target, cols, row + i, visibleCols)).join(" ").trimEnd();
    }

    const lastRow = row;
    const cx = cols / 2;
    const cy = rows / 2;
    const maxd = Math.hypot(cx, cy);
    const ord = new Map<number, number>();
    cipherRows.forEach((r, i) => ord.set(r, i));

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const cls = tclass[i];
        /* THE SWEEP'S AXIS. Wide: 0.42 on the column term against 0.2 on the
           row term — the mockup's, a left-to-right wipe across a landscape
           stage, unchanged. Narrow: the two weights SWAP, so the decrypt
           resolves top-to-bottom. That is the brief's §3e "run the decrypt as a
           top-to-bottom sweep", and it is the whole change: a phone stage is
           844 tall against 390 wide, so a horizontal wipe crosses the short
           axis and is over before the eye has followed it, while a vertical one
           runs the long axis and lands on the closing line last — which is
           where the sequence's payoff already sits. The radial and jitter terms
           are untouched at both. */
        let t =
          (narrow
            ? (r / rows) * 0.42 + (c / cols) * 0.2
            : (c / cols) * 0.42 + (r / rows) * 0.2) * 0.55 +
          (Math.hypot(c - cx, (r - cy) * (ch / cw)) / maxd) * 0.3 * 0.55 +
          h3(c, r, JITTER_SEED) * 0.2;
        if (cls === 1) {
          t = lerp(t, 0.3, 0.55) + 0.08;
        } else if (cls === 2 || cls === 3) {
          if (ord.has(r)) t = 0.34 + ord.get(r)! * 0.03 + (c / cols) * 0.012;
          else if (r === lastRow) t = 0.58;
          else t = lerp(t, 0.4, 0.5) + 0.06;
        } else if (cls === 4) {
          t = 0.355 + (ord.get(r) ?? 0) * 0.03 + (c / cols) * 0.02;
        }
        lockAt[i] = clamp01(t * 0.78 + 0.05);
      }
    }

    if (narrow) {
      const aw = buildAmbient(tclass, cols, rows, cw, ch);
      if (aw) ambient.set(aw);
    }
  }

  return { cols, rows, target, tclass, lockAt, ambient, mark, closingLine };
}

// ── geometry cache — the ONLY module-level mutable state in this file, and
//    it is a pure function of (w, h, dpr): rebuilding from the same three
//    numbers always yields the same atlas and target, so caching it changes
//    nothing about drawField's purity contract in T. Single-slot (not a
//    growing Map) — mirrors the mockup's own single global atlas/target,
//    overwritten on resize rather than accumulated. ──────────────────────

let cached: { key: string; geometry: FieldGeometry } | null = null;

function buildGeometry(w: number, h: number, dpr: number): FieldGeometry {
  const layout = layoutField(w, h);
  const atlas = buildAtlas({ cw: layout.cw, ch: layout.ch, dpr, font: layout.font });
  const fieldTarget = composeTarget({ cols: layout.cols, rows: layout.rows, cw: layout.cw, ch: layout.ch, w, h });
  const colX = new Int32Array(layout.cols);
  for (let c = 0; c < layout.cols; c++) colX[c] = Math.round(c * layout.cw * dpr);
  return { layout, atlas, fieldTarget, colX };
}

function geometryFor(w: number, h: number, dpr: number): FieldGeometry {
  const key = `${w}x${h}x${dpr}`;
  if (cached && cached.key === key) return cached.geometry;
  const geometry = buildGeometry(w, h, dpr);
  cached = { key, geometry };
  return geometry;
}

/**
 * Drop the memoised geometry so the next `drawField`/`fieldReport` rebuilds it.
 *
 * The cache is keyed on (w, h, dpr) and nothing else, which is right — those
 * are `drawField`'s only geometry inputs. It is not the only thing the compose
 * depends on: `composeTarget` rasterises the wordmark through `measureText` and
 * `fillText`, and a canvas silently substitutes a fallback face for a webfont
 * that has not LOADED yet. See `ensureMarkFont`.
 */
export function invalidateGeometry(): void {
  cached = null;
}

/**
 * Load the face the wordmark raster needs, and resolve when the raster's
 * outcome is final — whether or not the load succeeded.
 *
 * ── THE RACE THIS CLOSES, MEASURED ───────────────────────────────────────
 * `--f-sans` is `"Geist", "Söhne", "Inter", system-ui, sans-serif`, and Geist
 * ships FOUR weights: 400, 500, 600, 700. The raster asks for `MARK_WEIGHT`
 * (800), so CSS font matching resolves it to the 700 face — WHEN that face has
 * been fetched. Nothing else on the cold-boot route uses Geist 700, so nothing
 * had fetched it, and `composeTarget` ran against whatever was resident.
 * Measured on the shipped build by publishing the report, then letting the
 * fonts settle and forcing a geometry rebuild at the same size:
 *
 *      390x844    ink 237 -> 268   ·   mark rows 12 -> 13   ·   c/glyph 63 -> 68
 *     1440x900    ink 391 -> 442   ·   mark rows  6 ->  8   ·   c/glyph 83 -> 110
 *
 * Two runs of one tree could therefore report different marks, which makes
 * every figure the gate reads a coin flip and makes a BAND — a floor AND a
 * ceiling — unassertable. `drawField`'s determinism contract says the same
 * five inputs yield byte-identical draw calls; that was true of the DRAW and
 * quietly untrue of the COMPOSE.
 *
 * ── AND `document.fonts.ready` IS THE WRONG SIGNAL, ALSO MEASURED ─────────
 * It resolves when nothing is PENDING, and a face nobody has asked for is not
 * pending. At `fonts.ready` the loaded set is
 * `[JetBrains Mono 400/500/700, Newsreader 400, Geist 400]` — Geist 700 is
 * absent, on a fast connection AND on Slow 4G. So this asks for the exact face
 * by descriptor instead of waiting for a set that will never contain it.
 *
 * Always resolves. A REJECTED load is a settled outcome too: the raster is then
 * final in the fallback face, which is a worse mark but a determinate one, and
 * a caller that waited forever for a font that will never arrive would hold a
 * gate open rather than report anything.
 */
export function ensureMarkFont(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return Promise.resolve();
  const sans = resolveToken("--f-sans", SANS_FALLBACK);
  try {
    return document.fonts.load(`${MARK_WEIGHT} 100px ${sans}`).then(
      () => undefined,
      () => undefined,
    );
  } catch {
    return Promise.resolve();
  }
}

/** What the field resolved to for a given stage — the layout, the wordmark's
 *  cell box, and whether the narrow composition is in play.
 *
 *  ── WHY THIS EXISTS ──────────────────────────────────────────────────────
 *  The decrypt is a canvas, and a canvas is invisible to every DOM-based gate
 *  in this repo: `verify-legibility` reads inline `fontSize` and SVG
 *  attributes, `verify-mobile` walks rendered elements, and neither can see a
 *  `drawImage` call. So the ONE property that decides whether the phone
 *  sequence is a message or a wall — how many cells each letterform gets —
 *  was unassertable, which is why an 8-cells-per-glyph smear shipped past 84
 *  gates. This is the `__XMR_CLOVER__` / `__XMR_GOV__` idiom: publish the
 *  number the gate would otherwise have to infer from pixels.
 *
 *  PURE, and it writes nothing to `window` — the HOST publishes it (see
 *  `ColdBoot.tsx`), because a module that reaches for `window` at import time
 *  is a module `scripts/prerender.mjs` cannot evaluate. It reads the same
 *  memoised geometry `drawField` uses, so on a warm cache it costs a map
 *  lookup and cannot disagree with what was drawn. */
export interface FieldReport {
  readonly layout: FieldLayout;
  readonly mark: MarkBox;
  /** See `FieldTarget#closingLine`. */
  readonly closingLine: string;
  readonly narrow: boolean;
  readonly cells: number;
  /** Columns a reader can actually SEE — `floor(w / cw)`. `layout.cols` is one
   *  more than this by design (the ambient field must not gap at the right
   *  edge), so every margin question has to be asked in this unit or the right
   *  margin is inflated by a column nobody is shown. */
  readonly visibleCols: number;
  /** The wordmark's clearance from each edge, IN VISIBLE COLUMNS. */
  readonly markMarginLeft: number;
  readonly markMarginRight: number;
  /** Mean of the ambient weight field. 1 on a wide stage, by construction. A
   *  cheap corroborator for the gate's canvas read-back: if this moves and the
   *  measured coverage does not, one of the two instruments is lying. */
  readonly ambientMean: number;
}

/** Resolve (and cache) the geometry for a stage, and report what it produced.
 *  Same three arguments as `drawField`'s own geometry key, so a caller reading
 *  this is reading the frame that was drawn rather than a second derivation. */
export function fieldReport(w: number, h: number, dpr: number): FieldReport {
  const geo = geometryFor(Math.round(w), Math.round(h), Math.round(Math.max(0.5, Math.min(2, dpr || 1)) * 100) / 100);
  const { layout, fieldTarget } = geo;
  const mark = fieldTarget.mark;
  const visibleCols = Math.floor(Math.round(w) / layout.cw);
  const amb = fieldTarget.ambient;
  let awSum = 0;
  for (let i = 0; i < amb.length; i++) awSum += amb[i];
  return {
    layout,
    mark,
    closingLine: fieldTarget.closingLine,
    narrow: isNarrowStage(Math.round(w)),
    cells: layout.cols * layout.rows,
    visibleCols,
    /* Reported in VISIBLE columns and clamped at 0, so a mark that overhangs
       the right edge reports no margin rather than a negative one — the number
       a gate bands has to mean "clearance the reader sees". */
    markMarginLeft: mark.glyphs > 0 ? Math.max(0, mark.left) : 0,
    markMarginRight: mark.glyphs > 0 ? Math.max(0, visibleCols - 1 - mark.right) : 0,
    ambientMean: amb.length > 0 ? Math.round((awSum / amb.length) * 1000) / 1000 : 1,
  };
}

// ── drawField (coldboot-splash.html:1065-1105) ──────────────────────────────

/**
 * Render one frame of the decrypt at progress `T` (see `schedule.ts`).
 * Pure in `(w, h, T, density)` for a fixed `ctx.canvas.width` — see the
 * file header's determinism contract. `density` (default 1) is the only
 * caller-adaptive knob; everything else — including whether this is a
 * reduced-motion visitor — is the host's decision made before calling this
 * function at all, not this function's own concern.
 */
export function drawField(ctx: CanvasRenderingContext2D, w: number, h: number, T: number, density = 1): void {
  if (w <= 0 || h <= 0) return;

  // dpr derived from the backing store the host already sized, not taken as
  // an argument — see the file header's canvas-contract note. Rounded to 2
  // decimal places so float noise in canvas.width doesn't fragment the
  // geometry cache key.
  const rawDpr = ctx.canvas.width > 0 ? ctx.canvas.width / w : 1;
  const dpr = Math.round(Math.max(0.5, Math.min(2, rawDpr || 1)) * 100) / 100;

  const geo = geometryFor(Math.round(w), Math.round(h), dpr);
  const { layout, atlas, fieldTarget, colX } = geo;
  const { cols, rows, cw, ch } = layout;
  const { target, tclass, lockAt, ambient } = fieldTarget;

  const t = clamp01(T);
  const ig = E.decel(seg(t, B.ignite[0], B.ignite[1]));
  const dec = E.standard(seg(t, B.decay[0], B.decay[1]));
  const conv = E.standard(seg(t, B.converge[0], B.converge[1]));
  const step = Math.floor(t * 84);
  const drift = conv * ch * 2.4;
  const fade = (1 - dec * 0.86) * (1 - conv);
  const dens = BASE_DENSITY * clamp01(density);

  /* ── CLEAR THE BACKING STORE, NOT THE CSS BOX ─────────────────────────
   * This read `fillRect(0, 0, w, h)` — CSS pixels — while every glyph below is
   * blitted at `colX[c] = round(c * cw * dpr)` and `py * dpr`, i.e. in BACKING
   * STORE pixels, with no transform on the context. At dpr 1 the two spaces
   * coincide and the frame cleared correctly. At dpr 2 the clear covered the
   * top-left QUARTER of the store and the other three quarters kept every
   * glyph ever drawn there.
   *
   * ── THIS IS THE "WALL OF STATIC" ─────────────────────────────────────
   * Measured on the pre-fix tree, ONE 1440x900 build, the only difference
   * being the device pixel ratio — fraction of pixels with any channel > 24:
   *
   *      T        dpr 1     dpr 2
   *      0.40     20.0 %    35.4 %
   *      0.60      8.8 %    34.8 %
   *      0.90      4.6 %    34.4 %      bright (>120): 0.0 % vs 17.9 %
   *
   * At dpr 1 the field converges and fades to nearly nothing, which is the
   * whole point of the sequence. At dpr 2 it rises monotonically and never
   * comes down, because it is ~200 frames of scramble painted on top of each
   * other and never erased. Phones are dpr 2-3 and the desktops this was
   * authored on are dpr 1, which is why the defect reads as "phones only" and
   * why it survived 84 gates: the determinism gate compares two runs that
   * accumulate IDENTICALLY, and every field floor (`cellsPerGlyph`, `ink`,
   * `rows`, `chars`) goes GREENER as the accumulation gets worse.
   *
   * The store's own dimensions are the correct subject, and they are already
   * this function's source of truth for `dpr` twelve lines up. */
  ctx.fillStyle = FIELD_BG;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  for (let r = 0; r < rows; r++) {
    const py = r * ch * dpr;
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const cls = tclass[i];
      const la = lockAt[i];
      let alpha = 0;
      let tint = 0;
      let ci = -1;

      if (cls) {
        const lp = clamp01((t - la) / 0.075);
        if (t < la - 0.015) {
          ci = CIDX.get(SCRAM[(h3(c, r, step) * SCRAM.length) | 0])!;
          alpha = ig * (cls === 1 ? 0.5 : 0.4) * Math.min(1, dens);
          tint = 0;
        } else {
          ci = target[i];
          const flash = lp < 1 ? 1 - lp : 0;
          tint = flash > 0.35 ? 1 : cls === 1 || cls === 4 ? 0 : 2;
          alpha = (cls === 1 ? 1 : cls === 4 ? 0.95 : cls === 2 ? 0.9 : 0.55) * ig;
          alpha *= 1 - (cls === 1 ? conv : E.accel(seg(t, 0.76, 0.92)));
        }
      } else {
        if (fade <= 0.02) continue;
        const sd = h3(c, r, BG_CHAR_SEED);
        /* THE AMBIENT WEIGHT, applied in both channels. `aw` is EXACTLY 1 on a
           wide stage, so `0.62 * dens * 1` and `alpha * 1` are exact float
           no-ops and this branch emits the identical draw calls it did before
           the field existed. On a phone it does two things a single knob
           could not: the THRESHOLD term opens real gaps (a thinner field, not
           a dimmer one), and the ALPHA term gives the survivors depth so the
           quiet regions recede rather than merely sparsen. */
        const aw = ambient[i];
        if (sd > 0.62 * dens * aw) continue;
        ci = CIDX.get(SCRAM[(h3(c, r, step + ((sd * 11) | 0)) * SCRAM.length) | 0])!;
        const near = 1 - Math.min(1, Math.abs(t - la) * 3.4);
        alpha = ig * fade * (0.16 + 0.62 * Math.max(0, near)) * (0.5 + 0.5 * sd);
        alpha *= AW_ALPHA_FLOOR + (1 - AW_ALPHA_FLOOR) * aw;
        tint = t > la && near > 0.6 ? 1 : sd > 0.93 ? 3 : 0;
        if (t > la + 0.06) alpha *= 0.42;
      }

      if (ci < 0 || alpha < CULL) continue;
      const ai = ABK[alpha >= 1 ? 63 : (alpha * 64) | 0];
      const yo = cls ? 0 : drift * (0.4 + h3(c, r, BG_DRIFT_SEED) * 0.6);
      ctx.drawImage(
        atlas.canvas,
        ci * atlas.cellW,
        (tint * ALPHAS.length + ai) * atlas.cellH,
        atlas.cellW,
        atlas.cellH,
        colX[c],
        Math.round(py + yo * dpr),
        atlas.cellW,
        atlas.cellH,
      );
    }
  }
}
