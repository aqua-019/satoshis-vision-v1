/**
 * coldboot/orb.ts — the network orb: geometry and drawing, pure.
 *
 * Ported from docs/v6-mockups/coldboot-splash.html:723-926 (Fibonacci
 * lattice, `rotY`/`tiltX`/`slerp`/`nearest`, the batched wireframe globe,
 * Dandelion++ stem/fluff, block-arrival ripple). The mockup supplies
 * MECHANICS only — its `N=170`, `71/24/5` kind split, `.075` lag
 * probability and "1284 reachable" copy are placeholders and none of them
 * appear here. Every proportion this module renders is a parameter handed
 * in by `./useOrbData.ts`, derived from a real `/api/nodes` response.
 *
 * ── SAMPLE, NOT IDENTITY ─────────────────────────────────────────────────
 * The lattice this module draws is a scaled, seeded SAMPLE — `buildOrbLattice`
 * is handed a `count` that is usually far smaller than the live reachable
 * population, so no single dot corresponds to one real node. What IS real is
 * the aggregate: kind fractions and the lag fraction are drawn straight from
 * live proportions, and a dot's kind/lag is assigned by a per-index h3 draw
 * against those fractions — deterministic, reproducible, and never claiming
 * "this dot is node X". The caption that must accompany this component
 * (`./Orb.tsx`) is what keeps that claim honest in words: it states the real
 * `counts.reachable` and says outright that the dot count is not 1:1.
 *
 * ── THREE SHELLS, AND WHY TOR/I2P ORBIT RATHER THAN SIT ON THE SPHERE ─────
 * `SHELL = [1.00, 1.17, 1.30]`. Clearnet nodes render AT radius 1 — ON the
 * sphere's surface, as if it were a globe. Tor and I2P nodes render at radii
 * 1.17/1.30 — ORBITING it, never resolved to a point on the surface. This is
 * not a decorative choice: monero.fail's census returns HOSTS, not
 * coordinates, and a Tor/I2P onion address has no geography to plot at all.
 * Placing a Tor node "on" the globe would draw a location this software does
 * not have and the protocol does not encode. The shells make the
 * visualisation STRUCTURALLY unable to assert one — there is no code path
 * that computes a Tor node's latitude/longitude, because none exists to
 * compute.
 *
 * ── THE BLOCK RIPPLE HAS NO ORIGIN, BY THE SAME DISCIPLINE ────────────────
 * A block arrival is real (`kind:"block"` from `useFeedEvents`), but WHICH
 * node this client's node cascade heard it from first says nothing about
 * where it was mined or which peer relayed it — that information isn't
 * "hard to get", it doesn't correspond to anything this client observes at
 * all. The mockup's `spawnBlock` picks a random node index to originate the
 * ripple from; that reads as "this node found the block", a claim this data
 * cannot support. `spawnBlockEvent`/`drawOrb` below carry no node index for
 * a block event — the visual is a full-sphere pulse (every node brightens
 * together) plus a ring expanding from the globe's own centre, never from a
 * point on its surface. Same reasoning as the shells: not suppressing a
 * claim we could make, building something that cannot make it.
 *
 * ── DANDELION++ IS ILLUSTRATIVE, AND ONLY THE PATH IS INVENTED ────────────
 * `spawnStemEvent` walks a path across the SAME real lattice via `nearest()`
 * — it does not invent extra nodes. What's invented is which real-positioned
 * dot relays to which; a stem's route is not observable from any one node by
 * protocol design, which is the whole point of Dandelion++. Timing and COUNT
 * of stem events are driven by real `kind:"tx"` mempool arrivals
 * (`./useOrbData.ts` surfaces them; `./Orb.tsx` spawns one stem per newly
 * seen tx id, capped for legibility, never invented on a timer as the mockup
 * does). `./Orb.tsx` is responsible for the MODEL/no-live-badge pairing this
 * carries in the DOM.
 *
 * ── DETERMINISM, LCG REMOVAL, AND THE CANVAS CONTRACT ─────────────────────
 * `drawOrb(ctx, w, h, seconds, state)` is pure in its four scalar arguments
 * plus `state`: no `Date.now()`, no `matchMedia()`, no frame counter — same
 * discipline as `./field.ts#drawField`. `dpr` is derived from
 * `ctx.canvas.width / w` (never taken as a parameter) and clamped to
 * [0.5, 2]. The mockup's private LCG (`srand`/`seedTo`) does not appear
 * anywhere in this file; every seeded value comes from `h3(x, y, s)`
 * (`@/design/prng`), and `seedFromString` below is a plain deterministic
 * STRING HASH, not a new PRNG primitive — it only ever feeds an integer INTO
 * `h3`, the same role a loop index already plays elsewhere in this module.
 * `ctx.shadowBlur` is never used; wireframe stroking is batched (front/back
 * path split, ~40 total strokes) rather than the mockup's own noted ~1500
 * naive per-segment calls.
 */

import { h3 } from "@/design/prng";
import { clamp01, lerp } from "./schedule";

// ── geometry types ──────────────────────────────────────────────────────

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** 0 = clearnet (on the sphere) · 1 = Tor · 2 = I2P (both orbiting). */
export type OrbKind = 0 | 1 | 2;

export interface OrbNode extends Vec3 {
  readonly kind: OrbKind;
  /** Shell radius multiplier — `SHELL[kind]`. */
  readonly rr: number;
  /** Presentational only — a PROPORTION of dots carry this flag, deterministically
   *  assigned, never a claim about one real node's height. See the file header. */
  readonly lag: boolean;
}

export interface StemOrbEvent {
  readonly type: "stem";
  /** Spawn time, in the SAME animation-seconds space `drawOrb`'s `seconds`
   *  argument uses — never wall-clock ms. Owned by the caller (`./Orb.tsx`). */
  readonly t0: number;
  readonly dur: number;
  readonly path: readonly number[];
  readonly fluff: readonly number[];
}

/** No node index. A block's arrival is real; which node this client heard it
 *  from first is not a claim this data supports — see the file header. */
export interface BlockOrbEvent {
  readonly type: "block";
  readonly t0: number;
  readonly dur: number;
  /** Derived from the block's own data (e.g. its height) for deterministic
   *  variation — never randomised, never a position. */
  readonly seed: number;
}

export type OrbEvent = StemOrbEvent | BlockOrbEvent;

export interface OrbState {
  readonly nodes: readonly OrbNode[];
  readonly events: readonly OrbEvent[];
}

/** Clearnet on the sphere; Tor/I2P orbiting it. See the file header. */
export const SHELL: readonly [number, number, number] = [1.0, 1.17, 1.3];

/**
 * Floor, in CSS px, on the height of the box `drawOrb` is given — consumed by
 * `Orb.tsx#CANVAS_WRAP_STYLE` and READ (never restated) by `verify-orb.mjs`.
 *
 * ── WHY A FLOOR EXISTS AT ALL — v6.1.9, measured ─────────────────────────
 * `Orb.tsx` lays the orb out as a fixed-height flex column: the canvas wrap is
 * `flex:"1 1 auto"` with `minHeight:0` (fully shrinkable) and the badge/caption
 * overlay below it is `flex:"0 0 auto"` (cannot shrink). So in any host box
 * shorter than the overlay's natural height, the canvas is allocated ZERO
 * height — and `Orb.tsx#resize()` returns early on a zero dimension, which is
 * the only place `canvas.width/height` is ever assigned. The backing store then
 * keeps the 300x150 HTML default forever and `drawOrb` paints into the wrong
 * coordinate space.
 *
 * That shipped. Measured on `origin/main` at 95316a3, cold-boot console at
 * 1440x900: box 356.7x160, overlay 153.5, wrap 0, backing store 300x150, and an
 * instrumented `resize()` logged THREE calls and THREE early returns — it never
 * once completed. At 390x844 the same box carried a 180.1px overlay in the same
 * 160px slot.
 *
 * 120 is deliberately BELOW every shipped layout (the smallest real allocation
 * measured after the fix is 211.9px, console at 390x844), so this never binds in
 * practice. It is not a design dimension; it is the guarantee that a future host
 * box cannot silently starve the canvas back to zero. A floor that never binds
 * is the point — it converts "fixed here" into "cannot happen anywhere".
 */
export const ORB_MIN_CANVAS_PX = 120;

/**
 * The sphere's radius as a fraction of the canvas's SHORT side — `drawOrb`
 * below is the only consumer, and it was an inline `0.43` there.
 *
 * Named and exported because it is the one number that turns "the orb painted
 * something" into a falsifiable geometric claim: every feature `drawOrb` emits
 * unconditionally is a circle centred on the canvas with a radius that is a
 * fixed multiple of `ORB_RADIUS_FRAC * min(w, h)`, so the expected extent of the
 * painting is a pure function of the backing store's dimensions. The outermost
 * of them is the i2p shell at `SHELL[2]`, giving a structural bounding box of
 * `2 * ORB_RADIUS_FRAC * SHELL[2] * min(w, h)`.
 *
 * `verify-orb.mjs` parses this and `SHELL` out of this file and predicts the
 * bounding box rather than restating a measured constant. Checked against four
 * live contexts and it lands within 2px every time (539x363 -> 407 wide against
 * 405.8 predicted; 288x212 -> 238 against 237.0). Changing this number here
 * therefore moves the gate's expectation with it, which is the point.
 */
export const ORB_RADIUS_FRAC = 0.43;

// ── lattice size — a presentational clamp, not a live figure ───────────────

/** Floor: below this a globe reads as sparse/broken regardless of how few
 *  nodes are really reachable. Ceiling: the per-frame node loop is O(n) (the
 *  wireframe grid is not), so this bounds per-frame cost on a low-tier
 *  device. Like `field.ts#MIN_CELL_PX`, no gate measures either number —
 *  asserted by construction only. */
export const MIN_ORB_NODES = 40;
export const MAX_ORB_NODES = 320;

/** Scale a live reachable count down to a legible, boundable dot count. The
 *  dot count is presentational (see the file header's sample-not-identity
 *  note); the number a caption may print is the real `reachable`, never this. */
export function orbNodeCount(reachable: number): number {
  return Math.min(MAX_ORB_NODES, Math.max(MIN_ORB_NODES, Math.round(reachable)));
}

// ── seeded lattice ───────────────────────────────────────────────────────

const KIND_ROLE = 0;
const LAG_ROLE = 1;

export interface LatticeParams {
  readonly count: number;
  /** Fractions of `split.total` — need not sum to exactly 1 after float
   *  error; the i2p bucket silently absorbs the remainder, same cascading-
   *  threshold shape as the mockup's own `u<.71?0:u<.95?1:2`. */
  readonly clearFrac: number;
  readonly torFrac: number;
  /** Fraction of `counts.reachable` a dot renders as lagging. Applied
   *  independent of kind — the live `height.lagging` sample is not
   *  restricted to clearnet nodes, so neither is this. */
  readonly lagFrac: number;
  readonly seed: number;
}

/**
 * A Fibonacci lattice of `count` unit directions, h3-seeded kind/lag
 * assignment. Verbatim distribution math from coldboot-splash.html:738-744;
 * the `u<kind-threshold` cascade now reads live fractions instead of the
 * mockup's fixed `.71`/`.95`/`.075`.
 */
export function buildOrbLattice({ count, clearFrac, torFrac, lagFrac, seed }: LatticeParams): OrbNode[] {
  const n = Math.max(0, Math.round(count));
  const nodes: OrbNode[] = [];
  for (let i = 0; i < n; i++) {
    const y = n > 1 ? 1 - (i / (n - 1)) * 2 : 0;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = Math.PI * (3 - Math.sqrt(5)) * i;
    const ku = h3(i, KIND_ROLE, seed);
    const kind: OrbKind = ku < clearFrac ? 0 : ku < clearFrac + torFrac ? 1 : 2;
    const lag = h3(i, LAG_ROLE, seed) < lagFrac;
    nodes.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r, kind, rr: SHELL[kind], lag });
  }
  return nodes;
}

// ── math helpers (coldboot-splash.html:747-766), verbatim ──────────────────

export function rotY(p: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: p.x * c - p.z * s, y: p.y, z: p.x * s + p.z * c };
}

export function tiltX(p: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c };
}

export function slerp(a: Vec3, b: Vec3, t: number): Vec3 {
  const d = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z));
  const o = Math.acos(d);
  const so = Math.sin(o);
  if (so < 1e-5) return { x: a.x, y: a.y, z: a.z };
  const s1 = Math.sin((1 - t) * o) / so;
  const s2 = Math.sin(t * o) / so;
  return { x: a.x * s1 + b.x * s2, y: a.y * s1 + b.y * s2, z: a.z * s1 + b.z * s2 };
}

/** Indices of the `k` nodes nearest `nodes[i]` by dot product (unit vectors,
 *  so this is angular proximity on the sphere), excluding `i` and `skip`. */
export function nearest(nodes: readonly OrbNode[], i: number, k: number, skip?: ReadonlySet<number>): number[] {
  const a = nodes[i];
  const out: Array<[number, number]> = [];
  for (let j = 0; j < nodes.length; j++) {
    if (j === i || (skip && skip.has(j))) continue;
    const b = nodes[j];
    out.push([a.x * b.x + a.y * b.y + a.z * b.z, j]);
  }
  out.sort((p, q) => q[0] - p[0]);
  return out.slice(0, k).map((p) => p[1]);
}

/**
 * Deterministic string → int32 hash. NOT a PRNG — a plain hash, the same
 * role a loop index already plays as an `h3` input elsewhere in this file.
 * Used to turn a real tx id into a stable seed for a stem's path, so the
 * SAME tx always draws the same illustrative route.
 */
export function seedFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

// ── event construction (coldboot-splash.html:767-780, h3-seeded) ───────────

const STEM_HOPS = 4;
const FLUFF_COUNT = 12;
const STEM_DUR_S = 1.6;
const BLOCK_DUR_S = 2.6;

export interface SpawnStemParams {
  readonly nodes: readonly OrbNode[];
  readonly seed: number;
  /** Spawn time in animation-seconds — the caller's clock, not this module's. */
  readonly t0: number;
  readonly hops?: number;
  readonly fluffCount?: number;
  readonly dur?: number;
}

/** Builds an illustrative stem+fluff path across the REAL lattice. Returns
 *  `null` only when there are no nodes to route across (T1 unavailable). */
export function spawnStemEvent({
  nodes,
  seed,
  t0,
  hops = STEM_HOPS,
  fluffCount = FLUFF_COUNT,
  dur = STEM_DUR_S,
}: SpawnStemParams): StemOrbEvent | null {
  if (nodes.length === 0) return null;
  let cur = Math.floor(h3(0, 0, seed) * nodes.length);
  const path = [cur];
  const used = new Set<number>([cur]);
  for (let hop = 0; hop < hops; hop++) {
    const candidates = nearest(nodes, cur, 6, used);
    if (!candidates.length) break;
    cur = candidates[Math.floor(h3(hop, 1, seed) * candidates.length)];
    used.add(cur);
    path.push(cur);
  }
  const fluff = nearest(nodes, cur, fluffCount, used);
  return { type: "stem", t0, dur, path, fluff };
}

export interface SpawnBlockParams {
  readonly t0: number;
  /** The block's own data (e.g. height) — deterministic variation, never a
   *  position or a node. */
  readonly seed: number;
  readonly dur?: number;
}

export function spawnBlockEvent({ t0, seed, dur = BLOCK_DUR_S }: SpawnBlockParams): BlockOrbEvent {
  return { type: "block", t0, dur, seed };
}

// ── colour tokens ────────────────────────────────────────────────────────
//
// All five confirmed exact hits against styles.css: clear/tor/i2p/lag/hot map
// onto --o-50/--p-50/--c-50/--y-50/--o-100 byte-for-byte against the mockup's
// raw RGB triples. The one inexact case — the mockup's lightened stem-head
// dot, rgba(214,180,255,.95) — is NOT a new token: per ruling, it is --p-50
// at a raised alpha (withAlpha(stemColor, 0.95) below), not a color-mix
// toward white (verify-legibility.mjs §1b requires any .tsx color-mix() to
// mix toward transparent, which lightening-toward-white cannot satisfy) and
// not an invented sixth colour this repo hasn't agreed to.

const CLEAR_TOKEN = "--o-50";
const TOR_TOKEN = "--p-50";
const I2P_TOKEN = "--c-50";
const LAG_TOKEN = "--y-50";
const HOT_TOKEN = "--o-100";
const STEM_TOKEN = "--p-50";

function resolveToken(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** `#rgb`/`#rrggbb` → `rgba(...)`. Sibling of `field.ts`'s helper of the same
 *  name and the same reasoning (`useMemCanvas.ts#cssColor`'s "resolve up
 *  front, fail where it's cheap") — not a shared import; see that file's
 *  header on why canvas colour-resolution helpers stay per-module. */
function withAlpha(color: string, alpha: number): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  const a = Math.max(0, Math.min(1, alpha));
  if (!m) return color;
  let hex = m[1];
  if (hex.length === 3) hex = hex.replace(/./g, (ch) => ch + ch);
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// ── drawing ──────────────────────────────────────────────────────────────

const TILT = 0.36;
/** rad/sec. Mirrors the mockup's `clock*.000085` (clock in ms) converted to
 *  a per-second rate — this module takes animation SECONDS, never ms. */
const ROTATION_RATE = 0.085;
const LAT_LINES = 8;
const LON_SEGMENTS = 52;
const MERIDIANS = 12;
const LAT_SEGMENTS = 30;

interface Projected {
  readonly sx: number;
  readonly sy: number;
  readonly d: number;
}

function depthCue(d: number): number {
  return 0.18 + 0.82 * ((d + 1) / 2);
}

function drawStemEvent(
  ctx: CanvasRenderingContext2D,
  nodes: readonly OrbNode[],
  e: StemOrbEvent,
  pr: number,
  project: (p: Vec3, rr: number) => Projected,
  stemColor: string,
  hotColor: string,
  dpr: number,
  hotSet: Set<number>,
): void {
  const legs = e.path.length - 1;
  const END = 0.6;
  const sp = clamp01(pr / END);
  for (let l = 0; l < legs; l++) {
    const l0 = l / legs;
    const l1 = (l + 1) / legs;
    if (sp < l0) break;
    const t = clamp01((sp - l0) / (l1 - l0));
    const a = nodes[e.path[l]];
    const b = nodes[e.path[l + 1]];
    let prev: Projected | null = null;
    for (let s = 0; s <= 14; s++) {
      const u = (s / 14) * t;
      const q = slerp(a, b, u);
      const p = project(q, lerp(a.rr, b.rr, u) + 0.05 * Math.sin(Math.PI * u));
      if (prev) {
        ctx.beginPath();
        ctx.moveTo(prev.sx, prev.sy);
        ctx.lineTo(p.sx, p.sy);
        ctx.strokeStyle = withAlpha(stemColor, 0.55 * depthCue(p.d));
        ctx.lineWidth = Math.max(1, 1.3 * dpr);
        ctx.stroke();
      }
      prev = p;
    }
    if (prev && t < 1) {
      ctx.beginPath();
      ctx.arc(prev.sx, prev.sy, 2.6 * dpr, 0, Math.PI * 2);
      // The mockup's lightened head dot (rgba(214,180,255,.95)) — --p-50 at
      // raised alpha stands in for it. See the colour-tokens note above.
      ctx.fillStyle = withAlpha(stemColor, 0.95);
      ctx.fill();
    }
    hotSet.add(e.path[l]);
  }
  if (sp >= 1) hotSet.add(e.path[e.path.length - 1]);

  if (pr > END) {
    const fp = clamp01((pr - END) / (1 - END));
    const src = nodes[e.path[e.path.length - 1]];
    e.fluff.forEach((fi, k) => {
      const t = clamp01((fp - k * 0.018) / 0.55);
      if (t <= 0) return;
      const dst = nodes[fi];
      let prev: Projected | null = null;
      for (let s = 0; s <= 12; s++) {
        const u = (s / 12) * t;
        const q = slerp(src, dst, u);
        const p = project(q, lerp(src.rr, dst.rr, u) + 0.04 * Math.sin(Math.PI * u));
        if (prev) {
          ctx.beginPath();
          ctx.moveTo(prev.sx, prev.sy);
          ctx.lineTo(p.sx, p.sy);
          ctx.strokeStyle = withAlpha(hotColor, 0.32 * (1 - fp * 0.65) * depthCue(p.d));
          ctx.lineWidth = Math.max(1, dpr);
          ctx.stroke();
        }
        prev = p;
      }
      if (t >= 1) hotSet.add(fi);
    });
  }
}

/**
 * Render one frame at animation-time `seconds`. Pure: the same
 * `(w, h, seconds, state)` for a fixed `ctx.canvas.width` issues
 * byte-identical draw calls — no reduced-motion branch, no clock read, no
 * governor. Reduced motion and event lifecycle are `./Orb.tsx`'s job (feed
 * this a frozen `seconds` and an empty `state.events` under reduce).
 */
export function drawOrb(ctx: CanvasRenderingContext2D, w: number, h: number, seconds: number, state: OrbState): void {
  if (w <= 0 || h <= 0) return;
  const rawDpr = ctx.canvas.width > 0 ? ctx.canvas.width / w : 1;
  const dpr = Math.max(0.5, Math.min(2, rawDpr || 1));

  const clear = resolveToken(CLEAR_TOKEN, "#ff7a1a");
  const tor = resolveToken(TOR_TOKEN, "#b87aff");
  const i2p = resolveToken(I2P_TOKEN, "#5ed3f4");
  const lagColor = resolveToken(LAG_TOKEN, "#ffd400");
  const hot = resolveToken(HOT_TOKEN, "#ffce8a");
  const stemColor = resolveToken(STEM_TOKEN, "#b87aff");

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) * ORB_RADIUS_FRAC;
  const angle = seconds * ROTATION_RATE;

  const project = (p: Vec3, rr: number): Projected => {
    const q = tiltX(rotY(p, angle), TILT);
    return { sx: (cx + q.x * R * rr) * dpr, sy: (cy - q.y * R * rr) * dpr, d: q.z };
  };

  // ambient glow + solid equator ring
  const grad = ctx.createRadialGradient(cx * dpr, cy * dpr, R * dpr * 0.55, cx * dpr, cy * dpr, R * dpr * 1.5);
  grad.addColorStop(0, withAlpha(clear, 0.085));
  grad.addColorStop(0.55, withAlpha(clear, 0.03));
  grad.addColorStop(1, withAlpha(clear, 0));
  ctx.beginPath();
  ctx.arc(cx * dpr, cy * dpr, R * dpr * 1.5, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx * dpr, cy * dpr, R * dpr, 0, Math.PI * 2);
  ctx.strokeStyle = withAlpha(clear, 0.22);
  ctx.lineWidth = Math.max(1, 1.1 * dpr);
  ctx.stroke();

  // Tor / I2P orbit shells — guide circles only. No dot is ever placed AT a
  // point on these; they gate radius, nothing else. See the file header.
  ctx.setLineDash([2 * dpr, 4 * dpr]);
  ctx.beginPath();
  ctx.arc(cx * dpr, cy * dpr, R * dpr * SHELL[1], 0, Math.PI * 2);
  ctx.strokeStyle = withAlpha(tor, 0.26);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx * dpr, cy * dpr, R * dpr * SHELL[2], 0, Math.PI * 2);
  ctx.strokeStyle = withAlpha(i2p, 0.24);
  ctx.stroke();
  ctx.setLineDash([]);

  // batched wireframe — front/back path split, ~40 strokes total regardless
  // of node count (see the file header).
  ctx.lineWidth = Math.max(1, 0.9 * dpr);
  const front = withAlpha(clear, 0.135);
  const back = withAlpha(clear, 0.045);
  const poly = (pts: readonly Projected[], isFront: boolean): void => {
    ctx.beginPath();
    let open = false;
    for (const p of pts) {
      if (isFront ? p.d >= 0 : p.d < 0) {
        if (open) ctx.lineTo(p.sx, p.sy);
        else {
          ctx.moveTo(p.sx, p.sy);
          open = true;
        }
      } else open = false;
    }
    ctx.stroke();
  };
  // `ringAngle`/`meridianAngle`, not `lat`/`lon` — this is a wireframe
  // graticule parameter, not a coordinate, and this is the one file in the
  // repo whose entire argument is that a node NEVER gets one (see the file
  // header). Named this way so a `grep -i 'lat\|lon'` audit finds nothing
  // here to double-check.
  for (let li = 1; li < LAT_LINES; li++) {
    const ringAngle = (li / LAT_LINES) * Math.PI - Math.PI / 2;
    const yy = Math.sin(ringAngle);
    const rr = Math.cos(ringAngle);
    const pts: Projected[] = [];
    for (let s = 0; s <= LON_SEGMENTS; s++) {
      const th = (s / LON_SEGMENTS) * Math.PI * 2;
      pts.push(project({ x: Math.cos(th) * rr, y: yy, z: Math.sin(th) * rr }, 1));
    }
    ctx.strokeStyle = back;
    poly(pts, false);
    ctx.strokeStyle = front;
    poly(pts, true);
  }
  for (let mi = 0; mi < MERIDIANS; mi++) {
    const meridianAngle = (mi / MERIDIANS) * Math.PI * 2;
    const pts: Projected[] = [];
    for (let s = 0; s <= LAT_SEGMENTS; s++) {
      const ph = (s / LAT_SEGMENTS) * Math.PI - Math.PI / 2;
      pts.push(project({ x: Math.cos(ph) * Math.cos(meridianAngle), y: Math.sin(ph), z: Math.cos(ph) * Math.sin(meridianAngle) }, 1));
    }
    ctx.strokeStyle = back;
    poly(pts, false);
    ctx.strokeStyle = front;
    poly(pts, true);
  }

  // events
  const hotSet = new Set<number>();
  let blockWave = 0;
  for (const e of state.events) {
    const pr = clamp01((seconds - e.t0) / e.dur);
    if (pr >= 1 || seconds < e.t0) continue;
    if (e.type === "stem") {
      drawStemEvent(ctx, state.nodes, e, pr, project, stemColor, hot, dpr, hotSet);
    } else {
      // BLOCK — no origin. A full-sphere brightness wave (applied to every
      // node below) plus a ring expanding from the globe's own centre, never
      // from a point on its surface. See the file header.
      blockWave = Math.max(blockWave, Math.sin(pr * Math.PI));
      const ringR = R * dpr * lerp(0.9, 2.0, pr);
      ctx.beginPath();
      ctx.arc(cx * dpr, cy * dpr, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = withAlpha(clear, 0.5 * (1 - pr));
      ctx.lineWidth = Math.max(1, 1.4 * dpr);
      ctx.stroke();
    }
  }

  // nodes, depth-sorted so near dots draw over far ones
  const pts = state.nodes
    .map((n, i) => ({ i, n, p: project(n, n.rr) }))
    .sort((a, b) => a.p.d - b.p.d);
  for (const { i, n, p } of pts) {
    const dp = depthCue(p.d);
    const on = hotSet.has(i);
    const kindColor = n.kind === 0 ? clear : n.kind === 1 ? tor : i2p;
    const baseR = (on ? 3.3 : n.lag ? 2.3 : 1.8) * dp * dpr;
    const r = baseR * (1 + blockWave * 0.35);
    const baseAlpha = on ? 0.95 * dp : n.lag ? 0.62 * dp : 0.72 * dp;
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(on ? hot : n.lag ? lagColor : kindColor, baseAlpha * (1 + blockWave * 0.5));
    ctx.fill();
    if (on) {
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, 7 * dp * dpr, 0, Math.PI * 2);
      ctx.strokeStyle = withAlpha(hot, 0.32 * dp);
      ctx.lineWidth = Math.max(1, dpr);
      ctx.stroke();
    }
  }
}
