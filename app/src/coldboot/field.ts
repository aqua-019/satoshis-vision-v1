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
  const font = w < 560 ? MIN_CELL_PX : w < 1000 ? 13 : 14;
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

  const off = document.createElement("canvas");
  off.width = Math.max(2, Math.round(w));
  off.height = Math.max(2, Math.round(h));
  const og = off.getContext("2d");

  if (og) {
    og.fillStyle = "#000";
    og.fillRect(0, 0, off.width, off.height);

    let px = Math.min(w * 0.145, h * 0.26);
    const sansFont = sans ?? resolveToken("--f-sans", SANS_FALLBACK);
    og.textAlign = "center";
    og.textBaseline = "middle";
    og.fillStyle = "#fff";
    const setFont = () => {
      og.font = `800 ${px}px ${sansFont}`;
      if ("letterSpacing" in og) og.letterSpacing = `${Math.round(px * 0.05)}px`;
    };
    setFont();
    const measured = og.measureText("XMR.IRISH").width;
    if (measured > w * 0.74) {
      px *= (w * 0.74) / measured;
      setFont();
    }
    og.fillText("XMR.IRISH", w / 2, h * 0.335);

    const img = og.getImageData(0, 0, off.width, off.height).data;
    const sample = (x: number, y: number): number => {
      const xi = Math.max(0, Math.min(off.width - 1, x | 0));
      const yi = Math.max(0, Math.min(off.height - 1, y | 0));
      return img[(yi * off.width + xi) * 4];
    };

    let mTop = rows;
    let mBot = 0;
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
        }
      }
    }
    if (mTop > mBot) {
      mTop = Math.round(rows * 0.3);
      mBot = mTop;
    }

    putLine(target, tclass, cols, rows, KICK, mTop - 3, 3, true);
    putLine(target, tclass, cols, rows, SUB1, mBot + 2, 2, false);

    const labW = 12;
    const bodyW = Math.min(cols - 6, 74);
    const c0 = Math.floor((cols - bodyW) / 2);
    let row = mBot + 4;
    const cipherRows: number[] = [];
    const txId = hexRun(8, TX_ID_SEED);
    putLine(
      target,
      tclass,
      cols,
      rows,
      `┌ TX 0x${txId}  ── DECRYPTING ─────────────────────`.slice(0, bodyW - 16),
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
    if (row < rows - 2) {
      putLine(target, tclass, cols, rows, SIGNER_LINE, row, 3, false, c0);
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
        let t =
          ((c / cols) * 0.42 + (r / rows) * 0.2) * 0.55 +
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
  }

  return { cols, rows, target, tclass, lockAt };
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
  const { target, tclass, lockAt } = fieldTarget;

  const t = clamp01(T);
  const ig = E.decel(seg(t, B.ignite[0], B.ignite[1]));
  const dec = E.standard(seg(t, B.decay[0], B.decay[1]));
  const conv = E.standard(seg(t, B.converge[0], B.converge[1]));
  const step = Math.floor(t * 84);
  const drift = conv * ch * 2.4;
  const fade = (1 - dec * 0.86) * (1 - conv);
  const dens = BASE_DENSITY * clamp01(density);

  ctx.fillStyle = FIELD_BG;
  ctx.fillRect(0, 0, w, h);

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
        if (sd > 0.62 * dens) continue;
        ci = CIDX.get(SCRAM[(h3(c, r, step + ((sd * 11) | 0)) * SCRAM.length) | 0])!;
        const near = 1 - Math.min(1, Math.abs(t - la) * 3.4);
        alpha = ig * fade * (0.16 + 0.62 * Math.max(0, near)) * (0.5 + 0.5 * sd);
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
