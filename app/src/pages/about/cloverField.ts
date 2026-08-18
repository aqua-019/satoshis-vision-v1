/**
 * pages/about/cloverField.ts — the seeded glyph field that coalesces into a
 * four-leaf clover, and nothing else. Pure geometry + pure draw.
 *
 * ── WHY THIS IS A SIXTH SIBLING AND NOT AN IMPORT ────────────────────────
 * The repo already carries five per-layer canvas fields — ParticleField
 * (design/ArtBackground.tsx), useMiniCanvas (pages/future/FutureMini.tsx),
 * useMemCanvas (mempool/), use-proto-canvas (protocols/) and the cold-boot
 * decrypt field (coldboot/field.ts). They are deliberately NOT one shared
 * module, and `protocols/use-proto-canvas.tsx`'s header states the doctrine
 * in as many words: the loop "is deliberately duplicated on this side of the
 * code-split seam", because importing across it "would drag one chunk into
 * the other".
 *
 * That is not a style preference here, it is a measurement. `ColdBoot` is
 * `React.lazy` (App.tsx:65), so coldboot/field.ts sits in a LAZY chunk group.
 * Importing it from this page — also lazy, and a different group — makes it a
 * leaf shared ACROSS groups, which this repo has recorded four times as
 * costing a chunk (canvasColor · repoPulse · future/data.ts · Disclosure).
 * It would have taken CHUNK_COUNT to 73, exactly onto its own band ceiling —
 * the state p4·03 and p4·04 each measured and each declined.
 *
 * The two leaves this file DOES import are free, and that was measured at
 * `768ba13` rather than assumed, by grepping the built entry chunk:
 *   · `@/design/prng`        h3's constant `374761393` → entry, 1 hit. EAGER,
 *                            so a lazy chunk referencing it adds no bytes.
 *   · `@/design/canvasColor` already has its own 343 B chunk (it is shared by
 *                            several lazy groups). An extra lazy importer
 *                            mints nothing — and that file's own header
 *                            permits exactly this: every importer must be on
 *                            the lazy side of the line, which this page is.
 *
 * ── DETERMINISM CONTRACT (coldboot/field.ts's, kept verbatim in intent) ───
 * `drawClover(ctx, w, h, T, density?)` is PURE IN ITS ARGUMENTS. The same
 * five inputs issue the same `drawImage()` calls: no `Date.now()`, no frame
 * counter, no `matchMedia()` read, nothing accumulated across calls except a
 * geometry cache that is itself a pure function of (w, h, dpr) and therefore
 * invisible to a caller comparing two runs.
 *
 * That is what lets the gate assert a FORMED CLOVER by driving `T` directly
 * instead of racing a wall clock, and it is why `T` — not elapsed seconds —
 * is this module's only notion of time.
 *
 * Three things this module deliberately does NOT do, each mirroring the
 * cold-boot field's own ruling:
 *   1. No `prefers-reduced-motion` branch. Reduced motion is the HOST's
 *      decision; see CloverOverlay.tsx, which simply never mounts a canvas.
 *   2. No frame-budget governor. The HOST computes `density` (from
 *      `governorScale()`) and passes a plain number; a gate that passes none
 *      gets 1 and therefore a pinned, provable draw. Clover cells NEVER read
 *      density — only ambient scramble sheds, matching "ambient sheds first,
 *      data never".
 *   3. No LCG. Every seeded value is `h3(x, y, s)` from `@/design/prng` —
 *      spatial, stable per cell, and unaffected by how many other cells are
 *      alive. `Math.random()` is banned outside `src/protocols/**`.
 *
 * ── COLOUR: THE CLOVER IS LUMINANCE FIRST, HUE SECOND ────────────────────
 * Two tints only. Ambient scramble is `--ink-100` (ash); the clover is
 * `--g-50`. `--g-50` is one of the four tints coldboot/field.ts already uses
 * decoratively, so a decorative use of it here is precedent rather than a new
 * claim.
 *
 * ONE OF THE TWO IS THEME-REBOUND, AND THE NEIGHBOURING FILE SAYS OTHERWISE.
 * coldboot/field.ts's header states that none of its four tints "is
 * redeclared per `:root[data-theme=...]`", and adds that "if that ever
 * changes, the atlas cache below would need a theme key added to it".
 * Measured at `768ba13`, that premise does not hold for `--ink-100`:
 *
 *     styles.css:148            :root                        #a8a094
 *     styles-theme.css:116      :root[data-theme="indigo"]   #ECEAF6
 *     styles-theme.css:262      :root[data-theme="phosphor"] #C8F0C8
 *
 * `--g-50` really is base-only (styles.css:87). So the atlas here IS keyed on
 * the live theme — see `geometry()` — and a theme switch rebuilds it against
 * the tokens in force. The same staleness in the cold-boot field is
 * pre-existing, is in a file this change does not touch, and is recorded here
 * rather than fixed here.
 *
 * `--tk-accent` is NOT used. On this site Monero orange means crypto data and
 * never decoration, and a clover is decoration.
 *
 * The clover is legible without hue at all: its cells are drawn at a higher
 * alpha than ambient, so the shape reads on luminance alone. That is the
 * abyss lesson (encode in brightness, leave hue for meaning) and it is what
 * makes the shape survive a greyscale or colour-blind reading.
 */

import { h3 } from "@/design/prng";
import { cssColor } from "@/design/canvasColor";

/* ── the glyph pool ───────────────────────────────────────────────────────
 * "1s, 0s, and techy symbols". 0 and 1 are weighted by simple repetition —
 * the field should read as binary with punctuation in it, not as an even
 * spread of ASCII. Kept SHORT on purpose: the atlas is
 * CHARS.length × tints × alphas sprites, so every character added is real
 * memory and real build time at every resize. */
const CHARS: readonly string[] = [
  "0", "1", "0", "1", "0", "1",
  "/", "\\", "<", ">", "[", "]", "{", "}", "=", "+", "*", ":", ";", ".",
  "#", "$", "%", "&", "?", "|", "~", "^", "x", "f", "a", "e",
];

/** Tint tokens, in atlas row-block order. 0 = ambient ash · 1 = clover. */
const TINT_TOKENS = ["--ink-100", "--g-50"] as const;
/** Alpha steps baked into the atlas. Six is enough to read as a gradient and
 *  keeps the sprite sheet small; the draw loop rounds into these buckets so a
 *  frame is `drawImage` calls and never a `globalAlpha` write per cell. */
const ALPHAS = [0.12, 0.24, 0.4, 0.58, 0.78, 1] as const;

const MONO_FALLBACK = "ui-monospace, SFMono-Regular, Menlo, monospace";

/** Smallest cell we will lay out, in CSS px.
 *
 *  BELOW THE SITE'S 12px TYPE FLOOR, DELIBERATELY. That floor governs TEXT —
 *  something a reader is asked to read — and none of this is text: the field
 *  is `aria-hidden`, carries no information, is painted to a canvas where it
 *  is invisible to find-in-page, to a screen reader and to verify-legibility,
 *  and every word on the route is in the DOM beneath it at full size. What the
 *  floor buys elsewhere it cannot buy here.
 *
 *  What it costs is real, so it is spent knowingly: at 390px the clover needs
 *  roughly 30 rows to read as four lobes rather than a blob (measured while
 *  rasterising the stencil at 34/52/76 columns), and an 11px cell yields 24. */
export const MIN_CELL_PX = 8;
/** Hard ceiling on cols × rows. The cold-boot field uses 16000 for the same
 *  reason: it bounds the per-frame `drawImage` count independently of how
 *  large a display the page is opened on. */
export const MAX_CELLS = 14000;

/* ── the stencil ──────────────────────────────────────────────────────────
 * SHAPE AS DATA. One leaf, authored in unit space with its tip at the origin
 * pointing -y, plus one stem. The clover is four rotated copies of that leaf
 * — so the silhouette is edited by changing two path strings, and the
 * four-fold symmetry is structural rather than something a hand has to keep.
 *
 * Validated before it shipped by rasterising it at 34, 52 and 76 columns —
 * 34 is what a 390 px phone yields at MIN_CELL_PX — and reading the result.
 * Filled fraction is 33-36% at all three, so the clover cell count scales
 * with the grid instead of collapsing on a small one. */
const LEAF_PATH =
  "M 0 0 C -0.28 -0.20 -0.56 -0.38 -0.50 -0.66 C -0.44 -0.90 -0.13 -0.94 0 -0.64" +
  " C 0.13 -0.94 0.44 -0.90 0.50 -0.66 C 0.56 -0.38 0.28 -0.20 0 0 Z";
const STEM_PATH =
  "M -0.07 0.02 C -0.01 0.52 0.22 0.94 0.60 1.22 C 0.26 1.16 -0.04 0.84 -0.15 0.42 Z";
/** Leaf length as a fraction of the stencil box; and how far each leaf's tip
 *  is pushed off centre so the four lobes read as four rather than as a blob.
 *  Both were chosen by looking at the rasterised result, not derived. */
const LEAF_SCALE = 0.355;
const LEAF_GAP = 0.075;
/**
 * The clover's pixel diameter as a fraction of the viewport's SHORTER side.
 *
 * Larger on a phone, and that is a legibility decision rather than a taste
 * one. The shape needs roughly 30+ ROWS to separate into four lobes (measured
 * while rasterising the stencil at 34/52/76 columns), and a 390px viewport at
 * the minimum cell size yields far fewer rows than a desktop does. Giving the
 * phone more of the screen buys back the resolution the small cell costs.
 * Nothing competes for that space: the overlay covers the viewport anyway.
 */
function cloverFrac(w: number, h: number): number {
  return Math.min(w, h) < 520 ? 0.94 : 0.82;
}

/** Seed for every per-cell draw in this field. */
const SEED = 0x1f0c;

export interface CloverLayout {
  readonly cols: number;
  readonly rows: number;
  /** CSS px per cell. */
  readonly cw: number;
  readonly ch: number;
  /** CSS px font size the layout was measured at. */
  readonly font: number;
}

export interface GlyphAtlas {
  readonly canvas: HTMLCanvasElement;
  readonly cellW: number;
  readonly cellH: number;
}

export interface CloverTarget {
  readonly cols: number;
  readonly rows: number;
  /** 1 where the cell is inside the clover silhouette, 0 for ambient. */
  readonly inside: Uint8Array;
  /** T at which an inside cell locks to its glyph (formation). */
  readonly lockAt: Float32Array;
  /** T at which an inside cell releases again (degeneration). */
  readonly freeAt: Float32Array;
  /** `inside`, dilated by HALO_CELLS. Ambient scramble stops here as well as
   *  inside the shape — without it the narrow gaps BETWEEN the four lobes fill
   *  with ash and the lobes read as one mass. Measured: the gaps are 2-4 cells
   *  across, which a sparse ambient field is more than dense enough to close. */
  readonly halo: Uint8Array;
  /** How many cells are inside — the gate's non-vacuity floor reads this. */
  readonly filled: number;
}

/** Lay a cell grid over a viewport. Mirrors the cold-boot field's approach:
 *  one derivation, shared by the atlas builder and the target composer, so the
 *  two cannot disagree about cell size. */
export function layoutClover(w: number, h: number): CloverLayout {
  let font = Math.max(MIN_CELL_PX, Math.min(16, Math.round(Math.min(w, h) / 62)));
  let cw = font * 0.62;
  let ch = font * 1.16;
  let cols = Math.max(1, Math.floor(w / cw));
  let rows = Math.max(1, Math.floor(h / ch));
  // Bound the per-frame draw count on very large displays by growing the cell
  // rather than dropping cells — a coarser field still reads; a cropped one
  // would move the clover off centre.
  while (cols * rows > MAX_CELLS) {
    font += 1;
    cw = font * 0.62;
    ch = font * 1.16;
    cols = Math.max(1, Math.floor(w / cw));
    rows = Math.max(1, Math.floor(h / ch));
  }
  return { cols, rows, cw, ch, font };
}

/**
 * Bake every glyph × tint × alpha into one offscreen canvas, so the per-frame
 * loop is `drawImage()` and never `fillText()`. Straight from
 * coldboot/field.ts's `buildAtlas`, which exists for exactly this reason.
 */
export function buildAtlas(layout: CloverLayout, dpr: number, mono?: string): GlyphAtlas {
  const cellW = Math.ceil(layout.cw * dpr);
  const cellH = Math.ceil(layout.ch * dpr);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, cellW * CHARS.length);
  canvas.height = Math.max(1, cellH * TINT_TOKENS.length * ALPHAS.length);
  const g = canvas.getContext("2d");
  if (!g) return { canvas, cellW, cellH };

  const monoFont = mono ?? (cssColor("--f-mono") || MONO_FALLBACK);
  g.textBaseline = "middle";
  g.textAlign = "center";
  g.font = `${Math.round(layout.font * dpr)}px ${monoFont}`;

  const tints = TINT_TOKENS.map((t) => cssColor(t));
  for (let ti = 0; ti < tints.length; ti++) {
    for (let ai = 0; ai < ALPHAS.length; ai++) {
      g.globalAlpha = ALPHAS[ai];
      g.fillStyle = tints[ti];
      const row = ti * ALPHAS.length + ai;
      for (let ci = 0; ci < CHARS.length; ci++) {
        g.fillText(CHARS[ci], ci * cellW + cellW / 2, row * cellH + cellH * 0.55);
      }
    }
  }
  return { canvas, cellW, cellH };
}

/**
 * Rasterise the stencil into the cell grid and derive each cell's schedule.
 *
 * Rasterising once beats testing `isPointInPath` per cell: it is one fill
 * instead of cols×rows point tests, and the alpha it leaves behind is
 * coverage, so the silhouette's edge can be thresholded rather than aliased.
 */
export function composeClover(layout: CloverLayout): CloverTarget {
  const { cols, rows } = layout;
  const inside = new Uint8Array(cols * rows);
  const halo = new Uint8Array(cols * rows);
  const lockAt = new Float32Array(cols * rows);
  const freeAt = new Float32Array(cols * rows);

  const c = document.createElement("canvas");
  c.width = cols;
  c.height = rows;
  const g = c.getContext("2d");
  let filled = 0;
  if (g) {
    // ── THE CELL GRID IS NOT SQUARE, AND THE STENCIL MUST NOT PRETEND IT IS
    // A monospace cell is roughly 0.62w × 1.16h, i.e. nearly 1:2. The first
    // version laid the clover out in a square of CELLS, which rendered it as a
    // 1:1.9 portrait blob — measured at 1440×900, cw 16.1 against ch 30.2. The
    // prototype that validated this silhouette rasterised it on SQUARE pixels,
    // so the distortion was introduced by the integration, not the shape.
    //
    // The fix is a non-uniform scale that exactly cancels the cell aspect:
    // `sx` is the clover's diameter measured in COLUMNS and `sy` the same
    // diameter in ROWS, so `sx * cw === sy * ch === sidePx` and the shape is
    // square in PIXELS, which is the space the reader is in.
    //
    // Matrix order is load-bearing. `translate().scale().rotate()` composes as
    // T·S·R, so a point is ROTATED FIRST and only then scaled — the four leaves
    // are laid out in unit space and the whole assembly is squashed once.
    // Scaling before rotating would shear each leaf independently.
    const wPx = cols * layout.cw;
    const hPx = rows * layout.ch;
    const sidePx = Math.min(wPx, hPx) * cloverFrac(wPx, hPx);
    const sx = sidePx / layout.cw;
    const sy = sidePx / layout.ch;
    const cx = cols / 2;
    const cy = rows / 2 - sy * 0.05;
    const leaf = new Path2D(LEAF_PATH);
    const clover = new Path2D();
    for (let i = 0; i < 4; i++) {
      const deg = i * 90 + 45;
      const rad = (deg * Math.PI) / 180;
      clover.addPath(
        leaf,
        new DOMMatrix()
          .translate(cx + Math.sin(rad) * sx * LEAF_GAP, cy - Math.cos(rad) * sy * LEAF_GAP)
          .scale(sx * LEAF_SCALE, sy * LEAF_SCALE)
          .rotate(deg),
      );
    }
    clover.addPath(
      new Path2D(STEM_PATH),
      new DOMMatrix().translate(cx, cy).scale(sx * LEAF_SCALE, sy * LEAF_SCALE),
    );
    g.fillStyle = "#fff";
    g.fill(clover);

    const px = g.getImageData(0, 0, cols, rows).data;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        if (px[i * 4 + 3] <= 90) continue;
        inside[i] = 1;
        filled++;
        // Formation sweeps outward from the centre, so the clover grows
        // rather than fading in uniformly: radius sets the bulk of the
        // schedule and h3 breaks the rank so the edge is not a hard ring.
        const dx = (x - cx) / Math.max(1, sx);
        const dy = (y - cy) / Math.max(1, sy);
        const r = Math.min(1, Math.hypot(dx, dy) / 0.55);
        lockAt[i] = LOCK_FROM + (LOCK_TO - LOCK_FROM) * (r * 0.72 + h3(x, y, SEED) * 0.28);
        // Release runs the other way — outer cells let go first — so the
        // shape collapses back into the stream instead of blinking off.
        freeAt[i] = FREE_FROM + (FREE_TO - FREE_FROM) * ((1 - r) * 0.55 + h3(x, y, SEED + 1) * 0.45);
      }
    }
  }
  // Dilate. Chebyshev radius, and asymmetric on purpose: a cell is ~1:1.9, so
  // one row is worth about two columns and a square kernel would clear a much
  // taller band than a wide one.
  const HR = 1;
  const HC = 2;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let hit = 0;
      for (let dy = -HR; dy <= HR && !hit; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= rows) continue;
        for (let dx = -HC; dx <= HC; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= cols) continue;
          if (inside[yy * cols + xx]) { hit = 1; break; }
        }
      }
      halo[y * cols + x] = hit;
    }
  }
  return { cols, rows, inside, halo, lockAt, freeAt, filled };
}

/* ── the schedule, in T ───────────────────────────────────────────────────
 * One clock, four named phases, all expressed as fractions of the whole run
 * so the host can change the wall-clock duration without touching this file.
 *
 *   0 ─────── LOCK_FROM ····· LOCK_TO ═══ FREE_FROM ····· FREE_TO ─── 1
 *   stream     formation begins   formed / HOLD    release begins   gone
 */
const LOCK_FROM = 0.08;
const LOCK_TO = 0.42;
const FREE_FROM = 0.66;
const FREE_TO = 0.93;

/** T at which the clover is fully formed, and T at which it starts to go.
 *  Exported so the host and the gate name the same instants this file does
 *  rather than re-deriving them from magic numbers. */
export const T_FORMED = LOCK_TO;
export const T_HOLD_END = FREE_FROM;

/**
 * How formed the clover is at T, 0..1 — rising through formation, 1 across the
 * hold, falling through release.
 *
 * THIS IS WHAT MAKES THE SHAPE READ, and the first version did not have it.
 * Rendered without it the field was uniformly dense: ~9,000 lit cells at 1440,
 * with the clover drawn brighter on top of an equally busy background. The
 * shape was measurably present and visually absent — a wall of glyphs with a
 * faint green diamond in it. No assertion caught that; looking at it did.
 *
 * So the stream is CONSUMED by the clover rather than overdrawn by it: as the
 * clover forms, ambient scramble thins across the whole field, and inside the
 * silhouette it stops entirely. The glyphs visibly gather into the shape,
 * which is the thing the animation is supposed to depict.
 */
export function presence(T: number): number {
  const up = Math.max(0, Math.min(1, (T - LOCK_FROM) / (LOCK_TO - LOCK_FROM)));
  const down = 1 - Math.max(0, Math.min(1, (T - FREE_FROM) / (FREE_TO - FREE_FROM)));
  const p = Math.min(up, down);
  return p * p * (3 - 2 * p); // smoothstep — no hard edge at either end
}

/** Fraction of AMBIENT cells lit, before the frame-budget dial. Falls as the
 *  clover forms; the clover's own cells never shed. */
const AMBIENT_MAX = 0.34;
const AMBIENT_MIN = 0.09;

/** Peak opacity of the scrim behind the glyphs. Deliberately NOT 1: the page
 *  is meant to be visible beneath the overlay from the first frame — this is
 *  an overlay laid ON the page, not a cut to another screen. */
const SCRIM_PEAK = 0.72;

/** Overall field opacity as a function of T — ramps up fast, holds, then
 *  dissolves. Exported because the host uses the same curve for the scrim, so
 *  glyphs and scrim cannot disagree about when the overlay is gone. */
export function fieldAlpha(T: number): number {
  if (T <= 0) return 0;
  if (T < 0.06) return T / 0.06;
  if (T < 0.86) return 1;
  return Math.max(0, 1 - (T - 0.86) / 0.14);
}

/** Scrim alpha for a given T — the page beneath is never fully hidden. */
export function scrimAlpha(T: number): number {
  return fieldAlpha(T) * SCRIM_PEAK;
}

interface Geometry {
  readonly layout: CloverLayout;
  readonly atlas: GlyphAtlas;
  readonly target: CloverTarget;
  readonly colX: Int32Array;
  /** The theme's own ambient floor, resolved once. `--amb-floor` is rebound
   *  per theme (#050505 classic · #121218 indigo · #030603 phosphor), which
   *  the theme-keyed cache below already accounts for. */
  readonly scrim: string;
  readonly key: string;
}

let cache: Geometry | null = null;

/** Pure in (w, h, dpr, theme): the same viewport and palette always yield the
 *  same geometry, so the cache is invisible to a caller comparing two runs. */
function geometry(w: number, h: number, dpr: number): Geometry {
  // The theme is part of the key because `--ink-100` is rebound per theme —
  // see the colour note in the header. Without it, switching theme would keep
  // blitting an atlas baked in the previous palette.
  const theme =
    typeof document === "undefined" ? "" : document.documentElement.getAttribute("data-theme") ?? "";
  const key = `${Math.round(w)}x${Math.round(h)}@${dpr}#${theme}`;
  if (cache && cache.key === key) return cache;
  const layout = layoutClover(w, h);
  const atlas = buildAtlas(layout, dpr);
  const target = composeClover(layout);
  const colX = new Int32Array(layout.cols);
  for (let x = 0; x < layout.cols; x++) colX[x] = Math.round(x * layout.cw * dpr);
  const scrim = cssColor("--amb-floor") || "#050505";
  cache = { layout, atlas, target, colX, scrim, key };
  return cache;
}

/** Drop the memoised geometry. The host calls this on unmount so a theme
 *  change between two visits rebuilds the atlas against the live tokens. */
export function resetCloverGeometry(): void {
  cache = null;
}

/** How many cells the current geometry puts inside the clover. Exposed for
 *  the gate's non-vacuity floor — an assertion that the clover "formed" is
 *  worth nothing if the stencil rasterised to zero cells. */
export function cloverCellCount(w: number, h: number, dpr = 1): number {
  return geometry(w, h, dpr).target.filled;
}

/**
 * Draw one frame. PURE IN ITS ARGUMENTS — see the determinism contract above.
 *
 * `ctx` is expected to be in BACKING-STORE units (the host has NOT applied a
 * dpr transform); this function multiplies by dpr itself so the atlas blits
 * land on whole device pixels and the glyphs stay crisp.
 */
export function drawClover(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  T: number,
  density = 1,
): void {
  const dpr = ctx.canvas.width / Math.max(1, w);
  const { layout, atlas, target, colX, scrim } = geometry(w, h, dpr);
  const { cols, rows, inside, halo, lockAt, freeAt } = target;
  const { cellW, cellH } = atlas;

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const fa = fieldAlpha(T);
  if (fa <= 0) return;

  // THE SCRIM IS PAINTED HERE, not by a wrapper element, so there is exactly
  // ONE thing that fades and it cannot disagree with the glyphs about when the
  // overlay is gone. A wrapper's background would be written at mount and
  // never again — this component deliberately does not re-render per frame —
  // so the page would be revealed by a snap rather than a dissolve.
  const sa = scrimAlpha(T);
  if (sa > 0) {
    ctx.globalAlpha = sa;
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  // One globalAlpha write for the whole frame; per-cell alpha is baked into
  // the atlas row, so the loop never touches canvas state again.
  ctx.globalAlpha = fa;

  const nA = ALPHAS.length;
  const pres = presence(T);
  // Ambient thins as the clover gathers, THEN sheds again with the frame-budget
  // dial. Two independent reductions, multiplied: the first is the animation,
  // the second is the governor. Clover cells read neither.
  const ambientKeep =
    (AMBIENT_MAX - (AMBIENT_MAX - AMBIENT_MIN) * pres) * Math.max(0, Math.min(1, density));

  for (let y = 0; y < rows; y++) {
    const dy = Math.round(y * layout.ch * dpr);
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      const isIn = inside[i] === 1;

      let tint: number;
      let alphaIdx: number;
      let glyph: number;

      if (isIn && T >= lockAt[i] && T < freeAt[i]) {
        // LOCKED — part of the formed clover. A locked cell holds ONE glyph
        // for the whole hold, which is what makes the shape read as a shape
        // instead of as a shimmering patch. It is drawn at the top of the
        // alpha ramp, so the clover is the brightest thing on screen.
        tint = 1;
        const age = Math.min(1, (T - lockAt[i]) / 0.05);
        alphaIdx = 4 + Math.round(age * (nA - 5));
        glyph = Math.floor(h3(x, y, SEED + 7) * CHARS.length);
      } else {
        // AMBIENT — scramble. The glyph advances in coarse steps of T so the
        // stream churns without any dependence on frame history.
        //
        // Inside the silhouette, ambient stops once the clover has begun to
        // gather: a cell that is about to be part of the shape must not keep
        // flickering ash underneath it, or the silhouette's interior is as
        // noisy as its surroundings and the edge never appears.
        if (halo[i] === 1 && pres > 0.12) continue;
        // A T-stepped hash, so WHICH cells are lit churns frame to frame
        // rather than a fixed subset fading — a static mask reads as texture,
        // not as rain.
        const step = Math.floor(T * 34);
        if (h3(x * 7 + step, y * 13, SEED + 3) > ambientKeep) continue;
        tint = 0;
        glyph = Math.floor(h3(x * 31 + step, y, SEED + 11) * CHARS.length);
        alphaIdx = Math.round(h3(x, y, SEED + 5) * 1.9);
      }

      if (alphaIdx < 0) alphaIdx = 0;
      else if (alphaIdx >= nA) alphaIdx = nA - 1;

      ctx.drawImage(
        atlas.canvas,
        glyph * cellW,
        (tint * nA + alphaIdx) * cellH,
        cellW,
        cellH,
        colX[x],
        dy,
        cellW,
        cellH,
      );
    }
  }
  ctx.globalAlpha = 1;
}
