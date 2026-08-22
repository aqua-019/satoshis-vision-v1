/**
 * coldboot/ColdBoot.tsx — the splash ORCHESTRATOR: mount policy, the session
 * gate, the decrypt clock, and the Enter handoff. Owns none of the visuals it
 * drives — `./field` (decrypt canvas), `./ColdBootConsole` (the HUD), and the
 * network orb (a SIBLING this file does not mount — see the contract at the
 * bottom) are each somebody else's file.
 *
 * ── COLDBOOT IS A COVERING OVERLAY, NOT A GATE ON HOMEPAGE'S OWN MOUNT ─────
 * `HomePage` is rendered by `<Routes>` for `/` unconditionally, regardless of
 * anything below. This component renders a `position:fixed` overlay ON TOP
 * of it and, when done, simply stops rendering — Home was there underneath
 * the whole time. That one fact is what makes three separate requirements
 * fall out for free instead of needing separate machinery:
 *   - prerendered `/` is Main Home with no splash-specific SSR branching in
 *     HomePage.tsx itself — this file alone decides SSR → null.
 *   - "no splash on SPA nav back to `/`" falls out of living OUTSIDE
 *     `<Routes>` (App.tsx mounts this once, as a sibling of `<AmbientField/>`
 *     — route changes never unmount or remount it).
 *   - the handoff's "Home expands out of the line, sharpening" is a direct
 *     style write onto `#main` (AppShell.tsx's real id) — Home's ALREADY
 *     rendered content revealing itself, not a remount.
 *
 * ── MOUNT POLICY — decided ONCE, at first render, never reconsidered ──────
 * `computeInitial()` runs synchronously in a `useState` lazy initializer (no
 * effect — an effect would paint Home for a frame first). In order:
 *   SSR (`typeof window === "undefined"`)        → phase "off"
 *   `window.__XMR_COLDBOOT__ === "off"`          → phase "off"  (gates read
 *                                                    this via `addInitScript`
 *                                                    BEFORE `goto()`, so it
 *                                                    must be checked here,
 *                                                    not in an effect)
 *   `window.location.pathname !== R.HOME`        → phase "off"
 *   otherwise                                    → phase "splash",
 *     `skipDecrypt = sessionStorage flag set OR prefers-reduced-motion`
 *
 * This is a ONE-SHOT read of `window.location.pathname`, deliberately not
 * `useLocation()`. `ColdBoot` lives outside `<Routes>` and is never unmounted
 * by navigation, so its own React state already satisfies "mounts once,
 * never re-arms" — the only way to violate that would be to make the
 * decision REACTIVE to a later route match, which `useLocation()` would do
 * and a one-shot read cannot.
 *
 * ── THE TWO CLOCKS ──────────────────────────────────────────────────────
 * `T` (decrypt) is `./schedule`'s existing pure function — this file only
 * supplies the elapsed-ms accumulator (rAF-driven, frozen while the tab is
 * hidden, per `field.ts`'s documented discipline) and calls `drawField`.
 * `X` (handoff) does not exist anywhere else — `schedule.ts`'s own header
 * says the handoff clock "belongs to whichever file owns the Enter handoff,
 * not to the decrypt's own schedule," which is this file. `HB` below is
 * ported verbatim from coldboot-splash.html:684; `X()` mirrors `T()`'s shape
 * exactly (pure, elapsed-ms in, clamped [0,1] out) at the mockup's own
 * 1200ms / 0.9× duration (coldboot-splash.html:678).
 *
 * `ColdBootConsole` ships with NO staged reveal (Brief B's deliberate
 * decision — a component that renders itself whole avoids the exact timing
 * fragility a screenshot-diff gate would punish). The mockup's own
 * console-opacity ramp (T 0.80→0.93) is still wanted, so it is applied HERE,
 * as an outer wrapper style around `<ColdBootConsole/>` — Console's own file
 * is not reopened to contradict its shipped decision. `onEnter` short-
 * circuits to a no-op unless `phase === "splash"` (T is therefore always
 * already 1 by the time it can fire at all, matching the mockup's own
 * `if (S.handing || S.T < 1) return`).
 *
 * ── `data-coldboot-decided` — WHY A SECOND MARKER, NOT JUST `data-coldboot` ──
 * `data-coldboot` means "the splash is on screen right now" — thirteen sweep
 * gates assert its ABSENCE and that meaning must never drift. But an absence
 * assertion cannot auto-wait: `locator().count() === 0` is satisfied
 * instantly by an empty DOM, so it cannot tell "absent because the session
 * flag correctly suppressed the splash" from "absent because this lazy
 * chunk hasn't resolved yet." verify-coldboot §3 direction 1 needs exactly
 * the first, checked immediately after a reload — and a `React.lazy`
 * boundary is racy with "immediately" by construction.
 *
 * `data-coldboot-decided` is the positive thing to wait on instead. It is
 * stamped in BOTH branches of the phase check below — on the splash root
 * when the splash renders, on a standalone marker when it does not — so a
 * gate can `waitForSelector('[data-coldboot-decided]')` and then read
 * `data-coldboot`'s count with the answer already settled, whichever way it
 * went. The off-branch marker is `display:none` with no `tabIndex` and
 * `aria-hidden` — it cannot be the thing that regresses `/`'s measured
 * 0.0006 CLS baseline, cannot enter focus order, and is inert to hit-testing
 * and assistive tech alike. It is declared in the SAME render as the
 * decision (`phase` is computed synchronously before either branch runs),
 * so there is no intermediate render in which this component exists but the
 * marker does not — which is what "absent before the decision is made"
 * requires: the marker's absence is otherwise indistinguishable from the
 * lazy chunk simply not having arrived, the exact ambiguity it exists to end.
 *
 * ── REDUCED MOTION ───────────────────────────────────────────────────────
 * Per the coordinator's ruling from brief A/field.ts's header: under reduce,
 * mount STRAIGHT to the console at a conceptual T=1 — no `<canvas>` is even
 * created (field.ts: "at T=1 both fade terms are zero and the field is
 * blank," so painting it is pure waste, not a courtesy). On Enter, `X` jumps
 * straight to 1 in one step — no blur, no collapse, no scale, and the
 * console/Home reveal styles are cleared immediately rather than animated
 * through. The console's own checklist text (`signer index · indeterminate`
 * + the sentence under it) carries the decrypt's payload as selectable DOM
 * text, so nothing is lost — see ColdBootConsole.tsx's own header for why
 * that text is unconditional there regardless of motion preference.
 *
 * ── THE ORB CONTRACT — read this before wiring `Orb.tsx` (brief C) ────────
 * This file does NOT import or mount the orb, and never will. If it did, the
 * orb would unmount at the exact moment `phase` reaches "done" — precisely
 * when verify-coldboot.mjs §4 needs the SAME `[data-orb]` node to persist and
 * have moved. Mounting it here would make "the orb survives the collapse" a
 * fact someone has to remember to preserve; NOT mounting it here makes that
 * fact structurally true — nothing in this file is ever in a position to
 * unmount the orb, because nothing in this file ever mounted it.
 *
 * `useColdBootOrbState()` is the entire interface. `Orb.tsx` mounts as its
 * OWN sibling in App.tsx (not inside this file's tree) and subscribes here
 * for positioning data only:
 *
 *   rect      — a viewport-fixed target `{x,y,w,h}` (CSS px, `getBoundingClientRect`
 *               semantics — i.e. `position: fixed; left:x; top:y; width:w; height:h`
 *               on the orb positions it correctly), or `null` when this file
 *               has nothing to report (phase "off" — no splash showing at all).
 *   active    — true while THIS file has an opinion about where the orb goes
 *               (console showing, or handoff in flight). Goes false the instant
 *               `phase` reaches "done": at that point `rect` is set ONE FINAL
 *               TIME to `#hm-orb`'s own rect and this file stops touching the
 *               store entirely — permanently, for the rest of the session. From
 *               then on the orb is responsible for tracking `#hm-orb` itself
 *               (its own resize handling), because nothing here will do it
 *               again. `active === false` is the "you're on your own now"
 *               signal, not "hide yourself."
 *   assemble  — [0,1], how VISUALLY FORMED the orb should be right now.
 *               `active`/`rect` say WHERE; this says HOW MUCH — a `rect` can
 *               be valid (the console's slot is measured) long before the
 *               orb should look like anything, because the decrypt is the
 *               show and a fully-formed second bright object competing with
 *               it from T=0 undercuts the field's own "thins as the message
 *               sharpens" point. Mirrors the mockup's `drawOrb` exactly —
 *               `seg(T, .86, 1)` — so the orb assembles over the field's own
 *               final 14%, not before. `1` whenever there is no decrypt to
 *               compete with (already-resolved revisit, reduced motion) and
 *               throughout the handoff/steady state, since by then it is
 *               already fully formed and only moving. `Orb.tsx` reads this
 *               to gate its own alpha/scale; it does not infer phase itself.
 *
 * Before the splash ever shows (phase "off" — wrong route, `__XMR_COLDBOOT__`
 * off, or SSR), the store never leaves its `{rect: null, active: false,
 * assemble: 0}` default — the orb sees no opinion from this file on any
 * route but a live cold-boot Home, which is correct: everywhere else, it
 * manages itself.
 *
 * ── WHAT WAS DELIBERATELY TRIMMED FROM THE MOCKUP ──────────────────────────
 * The mockup's `#crt` element (a bright collapsing horizontal line at the
 * midpoint of the handoff, coldboot-splash.html:1467-1470) is not ported —
 * it is a flourish on top of the collapse/expand that already reads as one
 * continuous motion without it, and every additional animated element is
 * another thing `verify-coldboot §5` has to prove carries zero running
 * animations under reduce. No frame-budget governor (field.ts's `density`
 * parameter is called with a fixed `1`) — field.ts's own header explicitly
 * scopes that to a later, host-supplied integration; wiring it here was not
 * asked for and would be an unreviewed guess at the right curve.
 */

import * as React from "react";
import { drawField, ensureMarkFont, fieldReport, invalidateGeometry, isNarrowStage } from "./field";
import { T, E, seg, clamp01, lerp, EFFECTIVE_MS, EFFECTIVE_NARROW_MS, WALL_CEIL_FACTOR } from "./schedule";
import { ColdBootConsole } from "./ColdBootConsole";
import { useReducedMotion } from "@/design/useReducedMotion";
import { R } from "../../scripts/routes.mjs";
import {
  CB_FLOOR, CB_HOLD_GLOBAL, CB_HOLD_MS, CB_PENDING_CLASS, CB_T0_GLOBAL,
  COLDBOOT_FLAG, FIELD_REPORT_GLOBAL, coldBootWillRender,
} from "./gate";

/* ══════════════════════════════════════════════════════════════════════════
 * the handoff clock — X, HB — owned here per schedule.ts's own header
 * ══════════════════════════════════════════════════════════════════════════ */

/** Verbatim — coldboot-splash.html:684. Six named windows on the [0,1] X axis. */
const HB = {
  press: [0, 0.12],
  deres: [0.1, 0.42],
  collapse: [0.34, 0.54],
  line: [0.44, 0.68],
  expand: [0.54, 0.8],
  settle: [0.72, 1],
} as const;

/** coldboot-splash.html:678 (`S.xdur`/`S.spd`) — 1200ms at 0.9× ≈ 1333ms effective. */
const X_DUR_MS = 1200;
const X_SPD = 0.9;
const X_EFFECTIVE_MS = X_DUR_MS / X_SPD;

/** Pure, same shape as schedule.ts's `T()`. */
function X(elapsedMs: number): number {
  return clamp01(elapsedMs / X_EFFECTIVE_MS);
}

/** Console's own opacity ramp — mockup's `paintConsole`, T 0.80→0.93. Applied
 *  by THIS file as a wrapper style; ColdBootConsole.tsx carries no T concept. */
function consoleOpacity(t: number): number {
  return E.decel(seg(t, 0.8, 0.93));
}

/* ══════════════════════════════════════════════════════════════════════════
 * rects — plain {x,y,w,h}, viewport-relative (getBoundingClientRect shape)
 * ══════════════════════════════════════════════════════════════════════════ */

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

function rectFromDom(r: DOMRect): Rect {
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

/** coldboot-splash.html:1061, verbatim. */
function lerpRect(a: Rect, b: Rect, t: number): Rect {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t) };
}

/** `#hm-orb` — the empty box HomePage.tsx always renders. Read fresh each
 *  handoff frame (cheap; matches the mockup's own `measureRects`). */
function readHmOrbRect(): Rect | null {
  const el = document.getElementById("hm-orb");
  return el ? rectFromDom(el.getBoundingClientRect()) : null;
}

/* ══════════════════════════════════════════════════════════════════════════
 * the orb contract — module-level store, useSyncExternalStore. See the file
 * header's "THE ORB CONTRACT" section for the full behavioural spec.
 * ══════════════════════════════════════════════════════════════════════════ */

export interface ColdBootOrbState {
  rect: Rect | null;
  active: boolean;
  /** [0,1] — see the file header's "THE ORB CONTRACT" section. `seg(T,.86,1)`
   *  during the decrypt; `1` whenever there is no decrypt in play. */
  assemble: number;
  /** A splash is on screen, so HOME'S RECT IS NOT AUTHORITATIVE — even before
   *  this file has a rect of its own to offer.
   *
   *  `active` cannot answer this. It only turns true once `ColdBootConsole`
   *  publishes its slot rect, and in the window before that, `Orb.tsx` used to
   *  measure Home's `#hm-orb` and freeze its layout box on it. Which of the two
   *  won was a chunk-resolution race (measured 1/10, 3/10 and 5/10 across
   *  containers), and when Home won, the console slot was reached by a
   *  NON-UNIFORM `scale(0.835, 1.302)` — the globe drawn as an ellipse.
   *
   *  Seeded at MODULE SCOPE below, which is the only place that can beat the
   *  race: `Orb.tsx` imports this module, so this file's module body is
   *  guaranteed to have run before `Orb`'s first render, which no effect or
   *  layout effect of this component can promise. */
  live: boolean;
  /** The ENTER handoff's X ramp is lerping RIGHT NOW — true only there.
   *
   *  `Orb.tsx` pins its layout box while this is set and expresses every later
   *  rect as a transform off it; that is the #163 CLS fix and it must keep
   *  covering the whole travel. It must NOT cover the console phase: a slot
   *  resize there (the slot is `flex:1 1 auto` beside data-dependent siblings,
   *  and its rect is republished by a ResizeObserver) is a genuine relayout,
   *  and pinning through it produces the same non-uniform scale by a second
   *  route. Freezing on `active` conflated the two. */
  travelling: boolean;
}

/** Verbatim shape of the mockup's own assemble ramp (`drawOrb`'s `alpha`/
 *  `grow`, both `seg(T, .86, 1)`) — the orb forms over the field's final 14%,
 *  never before. */
const ORB_ASSEMBLE_FROM = 0.86;
const ORB_ASSEMBLE_TO = 1;

/**
 * Will THIS load open on the splash? One expression, two call sites — the
 * store's seed below and `computeInitial` — so the two can never answer
 * differently.
 *
 * THE SSR GUARD IS LOAD-BEARING AND MUST COME FIRST. This module is evaluated
 * in a plain Node process during `scripts/prerender.mjs` (see the render
 * branch's own note near the bottom of this file: the resolution loop lets this
 * lazy boundary's real component run once the dynamic import settles). A bare
 * `window` reference at module scope is therefore not a runtime edge case, it
 * is a `ReferenceError` that fails `npm run build` before any gate runs.
 */
function willRenderNow(): boolean {
  if (typeof window === "undefined") return false;
  const flagWindow = window as unknown as Record<string, string | undefined>;
  return coldBootWillRender(flagWindow[COLDBOOT_FLAG], window.location.pathname);
}

/** SSR's snapshot, and deliberately NOT the same object as `ORB_INITIAL`:
 *  `live` is seeded from the browser below, and a prerender must never see it
 *  true under any hydration path. */
const ORB_SERVER: ColdBootOrbState = {
  rect: null, active: false, assemble: 0, live: false, travelling: false,
};
/* Evaluated at MODULE EVALUATION — see `live`'s docblock for why that instant
   and no later one is early enough. */
const ORB_INITIAL: ColdBootOrbState = { ...ORB_SERVER, live: willRenderNow() };
let orbState: ColdBootOrbState = ORB_INITIAL;
const orbListeners = new Set<() => void>();

/** Merges, so a call site that owns three fields cannot silently reset the two
 *  it does not. Bails on a no-op patch — strictly fewer notifications than the
 *  unconditional write this replaced, and it cannot suppress a real change:
 *  the handoff tick allocates a fresh `rect` every frame, so the loop finds a
 *  difference on its first key and returns immediately. */
function patchOrbState(patch: Partial<ColdBootOrbState>): void {
  let changed = false;
  for (const k of Object.keys(patch) as (keyof ColdBootOrbState)[]) {
    if (!Object.is(orbState[k], patch[k])) { changed = true; break; }
  }
  if (!changed) return;
  orbState = { ...orbState, ...patch };
  for (const l of orbListeners) l();
}
function subscribeOrb(listener: () => void): () => void {
  orbListeners.add(listener);
  return () => {
    orbListeners.delete(listener);
  };
}
function getOrbSnapshot(): ColdBootOrbState {
  return orbState;
}
function getOrbServerSnapshot(): ColdBootOrbState {
  return ORB_SERVER;
}

/** The whole interface `Orb.tsx` (brief C, a sibling this file never
 *  imports) needs. See the file header for the full contract. */
export function useColdBootOrbState(): ColdBootOrbState {
  return React.useSyncExternalStore(subscribeOrb, getOrbSnapshot, getOrbServerSnapshot);
}

/* ══════════════════════════════════════════════════════════════════════════
 * session gate
 * ══════════════════════════════════════════════════════════════════════════ */

/** coldboot-splash.html:1541's own key, verbatim — nothing overrides it. */
const COLDBOOT_SESSION_KEY = "xmrirish.coldboot";

/** Tor throws on sessionStorage access in some configurations — a throw here
 *  must not blank `/`. */
function readSessionFlag(): boolean {
  try {
    return sessionStorage.getItem(COLDBOOT_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}
function writeSessionFlag(): void {
  try {
    sessionStorage.setItem(COLDBOOT_SESSION_KEY, "1");
  } catch {
    /* sealed storage — nothing to do, and nothing to blank either */
  }
}

type Phase = "off" | "splash" | "handoff" | "done";

interface Initial {
  readonly phase: Phase;
  /** true = already resolved (revisit or reduced motion) — mount straight to
   *  console, no canvas, no T ramp. */
  readonly skipDecrypt: boolean;
}

function computeInitial(reduced: boolean): Initial {
  /* The two clauses that used to be inline here now live in `./gate.ts`,
     because `index.html`'s pre-paint script has to answer the same question
     before this bundle exists and cannot import to do it. One definition, two
     call sites, and verify-cbpending.mjs proves they agree.

     Called through `willRenderNow()` — which carries the SSR guard this
     function used to carry itself — so the store's module-scope seed and this
     mount-time read are one expression rather than two copies of one rule. */
  if (!willRenderNow()) return { phase: "off", skipDecrypt: false };
  const flagged = readSessionFlag();
  return { phase: "splash", skipDecrypt: flagged || reduced };
}

/* ══════════════════════════════════════════════════════════════════════════
 * decrypt frame + handoff frame — pure math, DOM writes kept out of render
 * ══════════════════════════════════════════════════════════════════════════ */

function resizeCanvas(canvas: HTMLCanvasElement): { w: number; h: number } {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  return { w, h };
}

/** coldboot-splash.html:1456-1478, ported to X() and to real elements
 *  (`stageEl` = this file's own root; `mainEl` = `#main`, Home's real
 *  content — see the file header's "covering overlay" note). The mockup's
 *  `#crt` flash is deliberately not ported (see header). */
function applyHandoffFrame(x: number, stageEl: HTMLElement, mainEl: HTMLElement | null): void {
  const blur = 9 * E.standard(seg(x, 0.1, 0.44));
  const sq = 1 - E.accel(seg(x, HB.collapse[0], HB.collapse[1])) * 0.994;
  const bri = 1 + 1.4 * E.accel(seg(x, 0.3, 0.52));
  const cOp = 1 - E.accel(seg(x, 0.46, 0.56));
  stageEl.style.filter = `blur(${blur.toFixed(2)}px) brightness(${bri.toFixed(2)})`;
  stageEl.style.transform = `scaleY(${Math.max(0.002, sq).toFixed(4)})`;
  stageEl.style.opacity = String(Math.max(0, cOp));

  if (mainEl) {
    const hOp = E.decel(seg(x, 0.5, 0.62));
    const hSq = lerp(0.02, 1, E.expressive(seg(x, HB.expand[0], HB.expand[1])));
    const hBl = 16 * (1 - E.decel(seg(x, 0.56, 0.86)));
    mainEl.style.opacity = String(hOp);
    mainEl.style.transform = `scaleY(${hSq.toFixed(4)})`;
    mainEl.style.filter = hBl > 0.05 ? `blur(${hBl.toFixed(2)}px)` : "none";
  }
}

/** Restores both elements to stylesheet defaults — called on completion
 *  (X>=1 / reduced-motion instant cut) so Home is never left transformed. */
function clearHandoffStyles(stageEl: HTMLElement | null, mainEl: HTMLElement | null): void {
  if (stageEl) {
    stageEl.style.filter = "";
    stageEl.style.transform = "";
    stageEl.style.opacity = "";
  }
  if (mainEl) {
    mainEl.style.opacity = "";
    mainEl.style.transform = "";
    mainEl.style.filter = "";
  }
}

/* ══════════════════════════════════════════════════════════════════════════
 * module-level style constants — hoisted, per the zero-new-CSS discipline
 * this whole feature follows (see ColdBootConsole.tsx's header).
 * ══════════════════════════════════════════════════════════════════════════ */

/** z-index 1000 matches `.v6-modal-veil` (styles.css:1668) — the repo's
 *  existing full-viewport-overlay convention, not a new number invented for
 *  this file.
 *
 *  EXPORTED because `Orb.tsx` has to sit exactly one layer above it: the orb is
 *  a `position:fixed` SIBLING of this root, so at `z-index:auto` it painted
 *  beneath this element's opaque `#050505` background for the whole console
 *  phase (v6.1.9 — measured, and invisible regardless of how it was sized).
 *  Two files needing the same number is exactly where a second literal drifts,
 *  so there is one literal and `Orb.tsx` says `COLDBOOT_Z + 1`. */
export const COLDBOOT_Z = 1000;

const ROOT_STYLE: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: COLDBOOT_Z,
  /* Frame ONE. `index.html`'s pre-paint script paints frame ZERO in the same
     colour from the same constant, so the handover from the anti-flash floor to
     this element is invisible. It is theme-independent on purpose — see
     `gate.ts#CB_FLOOR`. */
  background: CB_FLOOR,
  overflow: "hidden",
  display: "flex",
  /* stretch, not center: the console wrapper takes the full stage height so its
     grid has vertical slack to hand to the orb stage. Horizontal centring is
     `margin-inline: auto` on the wrapper instead. */
  alignItems: "stretch",
  justifyContent: "center",
  padding: 24,
};
const CANVAS_STYLE: React.CSSProperties = { position: "absolute", inset: 0, display: "block" };
/** The console's width cap. It was a bare `1200`, which read as a fixed island
 *  on flat black at every desktop size — at 2560 that is ~1360px of dead space
 *  framing a 1200px box, while the decrypt phase immediately before it fills
 *  the whole viewport. The visual language promised full-bleed and withdrew it.
 *
 *  `max-width` cannot force an element wider than its own `width: 100%`, so the
 *  cap is inert below its own lower term and 390px is untouched.
 *
 *  It buys WIDER COLUMNS, not more of them: `ColdBootConsole` sets the track
 *  list explicitly (`GRID_COLS_WIDE`, three weighted `minmax(0,…fr)` columns)
 *  and collapses to one at its own `matchMedia` breakpoint, so the count is
 *  three or one and never anything else, at any cap.
 *
 *  This block previously described the value as `clamp(1200px, 92vw, 1600px)`
 *  over a `repeat(auto-fit, minmax(300px, 1fr))` grid, and carried six measured
 *  numbers for both. The value below has been `min(2100px, 94vw)` since #163 and
 *  the grid has been an explicit track list for just as long, so every one of
 *  those numbers described a tree that no longer existed. They are deleted
 *  rather than refreshed: the mechanism above is what the next reader needs, and
 *  a measurement pinned in a comment is exactly what went stale. `verify-coldboot`
 *  §8 measures the panes on a running build instead. */
const CONSOLE_WRAP_BASE: React.CSSProperties = {
  position: "relative",
  width: "100%",
  maxWidth: "min(2100px, 94vw)",
  marginInline: "auto",
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  zIndex: 1,
};

/** `display:none` — see the `data-coldboot-decided` render branch below for
 *  why this exists and why it must be provably zero-footprint. */
const DECIDED_MARKER_STYLE: React.CSSProperties = { display: "none" };

function consoleWrapStyle(visible: boolean): React.CSSProperties {
  return { ...CONSOLE_WRAP_BASE, opacity: visible ? 1 : 0, pointerEvents: visible ? "auto" : "none" };
}

/* ══════════════════════════════════════════════════════════════════════════
 * component
 * ══════════════════════════════════════════════════════════════════════════ */

export function ColdBoot(): React.JSX.Element | null {
  const reduced = useReducedMotion();

  // Decided ONCE — see the file header's "MOUNT POLICY" section for why this
  // is a ref-guarded render-time read rather than an effect.
  const initRef = React.useRef<Initial | null>(null);
  if (initRef.current === null) initRef.current = computeInitial(reduced);
  const { skipDecrypt } = initRef.current;

  const [phase, setPhase] = React.useState<Phase>(initRef.current.phase);

  /* ── hand frame zero over to frame one ───────────────────────────────────
   * `index.html`'s pre-paint script stamps `cb-pending` on <html>, which hides
   * #root behind an opaque CB_FLOOR floor so a JS-enabled visitor never sees
   * the prerendered Main Home before the sequence starts. This is where that
   * floor is released.
   *
   * useLayoutEffect, not useEffect: it runs synchronously after the DOM commit
   * and BEFORE paint, so the frame that reveals #root is the same frame that
   * has the splash in it. A passive effect can paint an unhidden #root for one
   * frame first, which is the flash re-introduced at the other end.
   *
   * UNCONDITIONAL — it must run on the `off` path too. When the bypass flag is
   * set the pre-paint predicate returns false and the class is never applied,
   * so this is normally a no-op; but if that predicate and this component ever
   * disagree, releasing the floor is the safe direction and keeping it is a
   * permanently blank page. `index.html`'s boot watchdog is the second remover,
   * for when this component never mounts at all. */
  /* `floorLifted` starts TRUE whenever the floor was never raised — the bypass
   * path, a non-Home route, or a browser where the pre-paint script threw. Only
   * a load that actually painted frame zero waits. */
  const [floorLifted, setFloorLifted] = React.useState<boolean>(
    () => typeof document === "undefined" ||
      !document.documentElement.classList.contains(CB_PENDING_CLASS),
  );

  React.useLayoutEffect(() => {
    if (floorLifted) return;
    const w = window as unknown as Record<string, number | undefined>;
    const hold = w[CB_HOLD_GLOBAL] ?? CB_HOLD_MS;
    const t0 = w[CB_T0_GLOBAL] ?? 0;
    const remaining = Math.max(0, hold - (performance.now() - t0));

    const lift = () => {
      document.documentElement.classList.remove(CB_PENDING_CLASS);
      setFloorLifted(true);
    };
    /* Synchronous when the beat is already spent, so a slow load reveals in the
     * same commit as before this hold existed — no frame of un-held prerender. */
    if (remaining === 0) { lift(); return; }
    const id = window.setTimeout(lift, remaining);
    return () => window.clearTimeout(id);
  }, [floorLifted]);
  const phaseRef = React.useRef<Phase>(phase);
  React.useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Drives `data-coldboot`'s VALUE (see the render below). Initialised from
  // `skipDecrypt` — already correct on the very first render for a flagged
  // revisit or reduced motion, so there is no frame where the root mounts
  // with the wrong phase and corrects itself a tick later. Flips to `true`
  // exactly once, in the same T>=1 branch that already writes the session
  // flag — a `ref` mutation there would be invisible to JSX; this is state
  // specifically so that one flip re-renders the attribute.
  const [decryptResolved, setDecryptResolved] = React.useState(skipDecrypt);

  const resolvedRef = React.useRef(false);
  const consoleRectRef = React.useRef<Rect | null>(null);
  // 1 whenever there is no decrypt in play (already-resolved revisit,
  // reduced motion) — the T-loop overwrites this every frame otherwise.
  const assembleRef = React.useRef(skipDecrypt ? 1 : 0);

  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const consoleWrapRef = React.useRef<HTMLDivElement | null>(null);

  const handleEnter = React.useCallback(() => {
    // Idempotent: a second call while already handing off (or after done) is
    // a no-op via the functional updater, on top of ColdBootConsole's own
    // fire-once guard — belt and suspenders on the one control that closes
    // the whole experience.
    setPhase((p) => (p === "splash" ? "handoff" : p));
  }, []);

  const handleConsoleOrbRect = React.useCallback((rect: DOMRect | null) => {
    const plain = rect ? rectFromDom(rect) : null;
    /* THE PREVIOUS VALUE, read before the ref is overwritten. `patchOrbState`
       already bails on a no-op patch, but it compares with `Object.is` and
       this is a fresh object every call, so without a VALUE comparison every
       report would notify every subscriber. That did not matter while the only
       reporters were two resize observers; it matters now that a scroll
       reports once per frame (ColdBootConsole's slot effect explains why), and
       an Orb render redraws its canvas via the effect keyed on
       `effectiveRect`. Scrolling a phone console must not repaint the orb 60
       times a second for a rect that did not move. */
    const prev = consoleRectRef.current;
    consoleRectRef.current = plain;
    if (prev && plain && prev.x === plain.x && prev.y === plain.y && prev.w === plain.w && prev.h === plain.h) return;
    // Handoff drives the store itself (lerping toward #hm-orb); once "done"
    // this file never touches the store again — see the header contract.
    // `assembleRef` (not a literal) — a resize firing mid-decrypt must not
    // reset how visually formed the orb already is.
    //
    // `plain !== null` GUARDS THE STORE, not just `active`. ColdBootConsole's
    // slot effect calls this with null on cleanup, and while `live` is set the
    // orb has no Home rect to fall back on — so publishing that null would
    // render it display:none for the rest of the splash with nothing on screen
    // saying why. Not reachable today (the callback identity is stable, so the
    // effect never re-runs mid-splash); one `key` away from being so, and the
    // failure shape is the silent hidden orb this file keeps re-learning.
    // A null cleanup means "I have nothing new to report", never "hide".
    if (phaseRef.current === "splash" && plain !== null) {
      patchOrbState({ rect: plain, active: true, assemble: assembleRef.current, travelling: false });
    }
  }, []);

  /* `live` is SEEDED AT MODULE SCOPE (see ORB_INITIAL) because `Orb.tsx`
     renders before any effect in this file runs, and must not measure Home in
     the meantime. This effect is the CORRECTOR, not the source: it only has to
     be right by the time `phase` CHANGES. Child effects run before parent
     effects, so ColdBootConsole has already published the slot rect by the time
     this first fires — harmless, because the only state that hurts is
     {rect:null, active:false, live:false}, which the seed is what eliminates.
     Collapsing the seed into this effect would put that state back. */
  React.useEffect(() => {
    patchOrbState({ live: phase === "splash" || phase === "handoff" });
  }, [phase]);

  // ── decrypt: the T ramp + canvas, or the "already resolved" immediate
  //    reveal (revisit / reduced motion). Runs while phase === "splash". ──
  React.useEffect(() => {
    if (phase !== "splash") return;
    /* THE SEQUENCE STARTS WHEN THE FLOOR LIFTS, NOT WHEN THIS MOUNTS.
     * The splash renders INSIDE #root, which the floor hides — so without this
     * guard the decrypt would run its 5.56s timeline underneath the black and
     * be revealed already a hold's worth in (~750ms at gate.ts#CB_HOLD_MS's
     * current value), which is a sequence that starts in the
     * middle rather than a black beat before it. Gating the whole effect also
     * covers the skipDecrypt branch (revisit or reduced motion): black for the
     * beat, then the console, in that order. */
    if (!floorLifted) return;

    if (skipDecrypt) {
      // Console is fully visible from the first frame — no canvas element
      // exists in this render path at all (see the file header: painting a
      // T=1 field is a wasted, blank draw, not a courtesy).
      if (consoleWrapRef.current) {
        consoleWrapRef.current.style.opacity = "1";
        consoleWrapRef.current.style.pointerEvents = "auto";
      }
      if (!resolvedRef.current) {
        resolvedRef.current = true;
        writeSessionFlag();
        // decryptResolved is already `true` here — it was initialised from
        // `skipDecrypt` itself, so `data-coldboot="console"` was correct on
        // this component's very first render, not corrected a tick later.
      }
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { alpha: false }) ?? null;
    if (!canvas || !ctx) return;

    let dims = resizeCanvas(canvas);
    let raf = 0;
    let last: number | null = null;
    let elapsed = 0;
    /* ── THE WALL-CLOCK ACCUMULATOR — see schedule.ts#WALL_CEIL_FACTOR ─────
     * `elapsed` is clamped per frame and therefore advances more slowly than
     * real time on a device that cannot keep up, which made the sequence
     * LONGER the slower the phone (measured 9,015ms at 390 under 6x throttle
     * against 5,785ms unthrottled). This second accumulator takes the same
     * `last` and does NOT clamp, so it is the honest count of active time.
     *
     * "Active" is the load-bearing word: it shares `last`, and `last` is reset
     * to null on visibility resume, so the first frame back contributes 0 and
     * a backgrounded gap is credited to neither accumulator. A ceiling built
     * on `Date.now() - mountTime` would end the sequence for a reader who
     * switched tabs and came back, which is a different and worse bug. */
    let wall = 0;
    /* Resolved ONCE, from the stage this loop starts on. An orientation flip
     * mid-decrypt re-lays the field (geometryFor is keyed on w×h×dpr and
     * rebuilds), and re-timing the sequence underneath that would make T jump
     * — the composition may change mid-run; the clock may not. */
    const effectiveMs = isNarrowStage(dims.w) ? EFFECTIVE_NARROW_MS : EFFECTIVE_MS;
    const wallCeilMs = effectiveMs * WALL_CEIL_FACTOR;
    /* The read hook: what the field resolved to, for a gate that cannot see a
     * canvas. Published by the HOST, never by field.ts — see fieldReport's
     * docblock. Republished on resize below, so it always describes the
     * geometry currently being drawn rather than the one this loop started on. */
    /* ── WHY THE REPORT CARRIES A SETTLED FLAG (p4·M7) ────────────────────
     * `composeTarget` rasterises the wordmark through a canvas, and a canvas
     * substitutes a fallback face SILENTLY for a webfont that has not loaded.
     * The mark this loop publishes at mount is therefore whichever face was
     * resident at that instant — measured on the shipped build, ink 237 before
     * and 268 after at 390, and mark rows 6 -> 8 at 1440. A gate reading the
     * first publish is reading a coin flip, which is fine for a floor and fatal
     * for a BAND. So the loop asks for the face explicitly (see
     * `field.ts#ensureMarkFont` for why `document.fonts.ready` is the wrong
     * signal), rebuilds the geometry when that settles, and says so in the
     * report. `markFontSettled` means "the raster is final", NOT "the font
     * arrived" — a load that fails is a settled outcome too. */
    let markFontSettled = false;
    /* The T the loop was at when the raster settled, and 1 until it does. Half
       of the ORDERING assertion `field.ts#markLockFrom` is the other half of:
       the rebuild must land BEFORE the mark starts resolving, or a reader
       watches it thicken after they have begun to read it. Published rather
       than left as a comment, because a margin nothing measures is a margin
       nothing will notice losing — this file's own re-lay table already shows
       it crossed at 10x CPU. */
    let markFontSettledAtT = 1;
    let lastT = 0;
    const publishReport = (): void => {
      try {
        const dpr = ctx.canvas.width > 0 && dims.w > 0 ? ctx.canvas.width / dims.w : 1;
        (window as unknown as Record<string, unknown>)[FIELD_REPORT_GLOBAL] = {
          ...fieldReport(dims.w, dims.h, dpr),
          effectiveMs,
          wallCeilMs,
          markFontSettled,
          markFontSettledAtT,
        };
      } catch {
        /* a report is diagnostics; it must never be able to blank the splash */
      }
    };
    publishReport();

    /* THE RE-LAY IS UNCONDITIONAL IN T, AND THAT IS MEASURED RATHER THAN
     * ARGUED — AND THE FIRST VERSION OF THIS COMMENT OVERCLAIMED. It said
     * every case lands during scramble, on a table that stopped at 6x CPU.
     * Extending the same measurement to the rate this repo's own gate uses
     * (`verify-coldboot` §10b throttles at 10x) refutes that. T at the moment
     * the geometry is rebuilt:
     *
     *                            390x844      1440x900
     *      fast                    0.015         0.012
     *      6x CPU                  0.181         0.228
     *      10x CPU                 0.316         0.198
     *      Slow 4G + 6x CPU        0.215         0.259
     *      Slow 4G + 10x CPU       0.388         0.238
     *
     * The wordmark's earliest `lockAt` is **0.318**, MEASURED over the mark's
     * own cells and published as `field.ts#markLockFrom` — not the 0.24 an
     * earlier draft of this comment derived by hand from `composeTarget`'s
     * cls-1 branch at t=0, which is the theoretical floor of that expression
     * and not a value any real cell takes. (Same family as everything else
     * this release corrected: an arithmetic claim standing in for a
     * measurement. The gate now compares two PUBLISHED numbers, so neither is
     * restated anywhere.) Even against 0.318, at and above 10x the re-lay can
     * land after the mark has begun to resolve, and a reader there sees it
     * thicken by one cell-row (390: rows 11 -> 12, ink 216 -> 230, ~6%).
     *
     * KEPT UNCONDITIONAL ANYWAY, and the alternative is what decides it. A
     * fence before first lock would leave the slow device with a mark rastered in a
     * face nobody chose, permanently — which is the behaviour this exists to
     * remove — and it would make `markFontSettled` a lie, because the promise
     * would have settled while the geometry had not been rebuilt. A reader at
     * 10x CPU is already being served a sequence whose wall ceiling has
     * engaged; one cell-row of thickening is not that reader's problem. The
     * cost is one atlas rebuild. `ColdBoot`'s resize path already re-lays
     * mid-run and states the rule this follows: the composition may change
     * mid-run, the clock may not — and this changes no clock. */
    let cancelledFont = false;
    void ensureMarkFont().then(() => {
      if (cancelledFont) return;
      markFontSettled = true;
      markFontSettledAtT = lastT;
      invalidateGeometry();
      publishReport();
    });

    const onResize = () => {
      dims = resizeCanvas(canvas);
      publishReport();
    };
    window.addEventListener("resize", onResize);

    const tick = (now: number) => {
      if (last === null) last = now;
      const raw = now - last;
      const dt = Math.min(64, raw);
      last = now;
      // The loop only runs while the tab is visible (see start/stop below), so
      // there is no per-frame visibility test here and `elapsed` advances every
      // frame it is called.
      elapsed += dt;
      wall += raw;

      /* `max`, so the ceiling can only ever bring the sequence FORWARD. At 1x
         `wall ≈ elapsed` and `wall / (1.35 × eff) < elapsed / eff`, so the
         second term is inert and the choreography is byte-identical to what
         it was before this line existed. It takes over only where the clamp
         has started lying about time. */
      const t = Math.max(T(elapsed, effectiveMs), clamp01(wall / wallCeilMs));
      lastT = t;
      drawField(ctx, dims.w, dims.h, t, 1);
      if (consoleWrapRef.current) {
        const op = consoleOpacity(t);
        consoleWrapRef.current.style.opacity = String(op);
        consoleWrapRef.current.style.pointerEvents = op > 0.9 ? "auto" : "none";
      }

      // The orb assembles over the field's own final 14% (seg(T,.86,1),
      // mirroring the mockup's drawOrb exactly) — not from mount, which
      // would put a second fully-formed bright object in the corner
      // competing with the decrypt from its first frame. Rounded before the
      // equality check so 60fps of float noise below .86 doesn't push
      // hundreds of no-op store writes through every Orb.tsx subscriber.
      const assemble = Math.round(seg(t, ORB_ASSEMBLE_FROM, ORB_ASSEMBLE_TO) * 500) / 500;
      if (assemble !== assembleRef.current) {
        assembleRef.current = assemble;
        patchOrbState({ rect: consoleRectRef.current, active: consoleRectRef.current !== null, assemble, travelling: false });
      }

      if (t >= 1) {
        if (!resolvedRef.current) {
          resolvedRef.current = true;
          writeSessionFlag();
          setDecryptResolved(true); // flips data-coldboot from "decrypt" to "console"
        }
        return; // T is locked at 1 — no further frames needed until Enter.
      }
      raf = requestAnimationFrame(tick);
    };

    /* STOP THE LOOP, NOT THE CLOCK — mempool/useMemCanvas.ts's start/stop/sync
     * shape, which this comment used to CLAIM parity with while doing something
     * strictly weaker.
     *
     * The previous form kept `raf = requestAnimationFrame(tick)` running and
     * gated only the accumulator (`if (visibilityState === "visible") elapsed
     * += dt`). Freezing the clock while still scheduling means `t` never
     * reaches 1, so the `t >= 1` early return — the loop's only exit — becomes
     * unreachable and the same frame repaints forever. Measured by
     * verify-perf.mjs §3 on a faked-hidden `/`: 181 rAF callbacks in 3s
     * against 0 on every other route.
     *
     * A genuinely backgrounded tab is rescued by the browser, which stops
     * servicing rAF — so the cost to a real visitor is ~0 and this is NOT a
     * battery fix. What it removes is the app depending on that rescue: `/`
     * was the only route whose quiescence it did not own itself.
     *
     * `last = null` on restart is what preserves the freeze the old guard was
     * reaching for — the first frame after a gap contributes dt 0, so `elapsed`
     * never jumps by the width of the hidden interval. Same line, same reason,
     * as useMemCanvas.ts's `lastTs = null`. */
    const start = () => {
      if (raf || document.visibilityState === "hidden") return;
      last = null;
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (!raf) return;
      cancelAnimationFrame(raf);
      raf = 0;
      last = null;
    };
    const onVisibility = () => (document.visibilityState === "hidden" ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);
    start();

    return () => {
      stop();
      cancelledFont = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
    };
  }, [phase, skipDecrypt, floorLifted]);

  // ── handoff: the X ramp (or an instant cut under reduce). ──────────────
  React.useEffect(() => {
    if (phase !== "handoff") return;
    const stageEl = stageRef.current;
    const mainEl = document.getElementById("main");
    const startRect = consoleRectRef.current;

    // Enter cannot fire before T === 1 (see handleEnter/ColdBootConsole's own
    // fire-once guard), so the orb is already fully formed the instant a
    // handoff can begin — assemble is 1 for the whole phase, literal rather
    // than assembleRef, since reaching "handoff" already proves it.
    if (reduced) {
      clearHandoffStyles(stageEl, mainEl);
      const homeRect = readHmOrbRect();
      patchOrbState({ rect: homeRect ?? startRect, active: false, assemble: 1, travelling: false });
      setPhase("done");
      return;
    }

    let raf = 0;
    let last: number | null = null;
    let elapsed = 0;
    const tick = (now: number) => {
      if (last === null) last = now;
      const dt = Math.min(64, now - last);
      last = now;
      // Visible-only, same as the decrypt loop above — see its start/stop note.
      elapsed += dt;

      const x = X(elapsed);
      if (stageEl) applyHandoffFrame(x, stageEl, mainEl);

      const homeRect = readHmOrbRect();
      /* `travelling: true` lives HERE and only here — this is the X ramp, the
         one window whose per-frame rect must not become a per-frame relayout.
         Orb.tsx pins its box against exactly this flag. */
      if (startRect && homeRect) patchOrbState({ rect: lerpRect(startRect, homeRect, x), active: true, assemble: 1, travelling: true });
      else if (homeRect) patchOrbState({ rect: homeRect, active: true, assemble: 1, travelling: true });
      else if (startRect) patchOrbState({ rect: startRect, active: true, assemble: 1, travelling: true });

      if (x >= 1) {
        clearHandoffStyles(stageEl, mainEl);
        patchOrbState({ rect: homeRect ?? startRect, active: false, assemble: 1, travelling: false });
        setPhase("done");
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    /* Same start/stop/`last = null` discipline as the decrypt loop — the X ramp
     * had the identical shape (freeze the clock, keep scheduling) and therefore
     * the identical never-terminating case: `x` frozen below 1 means the
     * `x >= 1` exit is unreachable. Not reachable from verify-perf §3, which
     * never presses ENTER, so it is fixed here on the source read rather than
     * on a measurement. */
    const start = () => {
      if (raf || document.visibilityState === "hidden") return;
      last = null;
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (!raf) return;
      cancelAnimationFrame(raf);
      raf = 0;
      last = null;
    };
    const onVisibility = () => (document.visibilityState === "hidden" ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);
    start();

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [phase, reduced]);

  if (phase === "off" || phase === "done") {
    // SSR renders NOTHING here, not the marker either — `computeInitial`
    // already forces phase "off" under `typeof window === "undefined"", but
    // that alone does not keep the marker out of `dist/index.html`:
    // scripts/prerender.mjs's resolution loop DOES let this lazy boundary's
    // real component run once the dynamic import settles in Node, so without
    // this second, explicit check the marker was measured landing in every
    // prerendered route's HTML — caught by grepping dist/index.html for
    // `data-coldboot`, not by inspection. The marker's entire job is to give
    // a BROWSER-based gate something to wait on for a CLIENT decision; a
    // static prerender never makes one, so it must never carry either
    // attribute — a JS-off/crawler visitor's HTML stays exactly Main Home.
    if (typeof window === "undefined") return null;

    // The mount decision resolved to "no splash" — session flag set, the
    // `__XMR_COLDBOOT__` bypass, the wrong route, or the handoff finishing.
    // A gate proving "the splash correctly did not render" (verify-coldboot
    // §3 direction 1: reload within the session → 0 [data-coldboot]) cannot
    // wait on the splash itself, because the splash is precisely what is
    // legitimately absent in the case being tested — `[data-coldboot]`
    // reading 0 is indistinguishable from "this file's lazy chunk just
    // hasn't resolved yet" without a SEPARATE, always-present signal that
    // fires the instant the decision is known either way. This marker is
    // that signal: present in EVERY decided CLIENT state (this branch
    // included), absent for the brief window before the chunk resolves and
    // a decision exists at all (there is no client render of this component
    // before `phase` is computed, so there is no render in which the marker
    // could leak early). `display:none` — zero layout box, so it cannot be
    // the thing that regresses `/`'s 0.0006 CLS baseline; no tabIndex, so it
    // cannot enter focus order; `aria-hidden` + no pointer surface, so it is
    // inert to both assistive tech and hit-testing.
    return <span data-coldboot-decided="" aria-hidden="true" style={DECIDED_MARKER_STYLE} />;
  }

  // `data-coldboot`'s VALUE — additive to the frozen contract, not a
  // redefinition: `[data-coldboot]` (COLDBOOT_SEL) still matches all of
  // "decrypt"/"console"/the old empty string, so every `assertColdBootBypassed()`
  // absence check is untouched. What it newly answers is verify-coldboot §3's
  // own skip: "decrypt" and "console" are DOM-distinguishable, so "reload
  // lands on the console with no decrypt" is now a real assertion, not one
  // that passes on markup incapable of failing it.
  //   "handoff" always reads "console" — Enter cannot fire before T===1 (see
  //   handleEnter/ColdBootConsole's fire-once guard), so the decrypt is
  //   already resolved for the entirety of any handoff.
  //   "splash" reads "console" once `decryptResolved` flips — state, not a
  //   ref, precisely so the flip re-renders this attribute; correct on the
  //   FIRST render already for a flagged revisit/reduced motion, because
  //   `decryptResolved`'s own initial value IS `skipDecrypt` (see its
  //   declaration above) — never `""` then corrected a frame later.
  const coldbootPhase: "decrypt" | "console" = phase === "handoff" || decryptResolved ? "console" : "decrypt";

  return (
    <div ref={stageRef} data-coldboot={coldbootPhase} data-coldboot-decided="" style={ROOT_STYLE}>
      {!skipDecrypt && <canvas ref={canvasRef} style={CANVAS_STYLE} aria-hidden="true" />}
      <div ref={consoleWrapRef} style={consoleWrapStyle(skipDecrypt)}>
        <ColdBootConsole onEnter={handleEnter} onOrbRectChange={handleConsoleOrbRect} />
      </div>
    </div>
  );
}
