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
import { drawField } from "./field";
import { T, E, seg, clamp01, lerp } from "./schedule";
import { ColdBootConsole } from "./ColdBootConsole";
import { useReducedMotion } from "@/design/useReducedMotion";
import { R } from "../../scripts/routes.mjs";

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
}

/** Verbatim shape of the mockup's own assemble ramp (`drawOrb`'s `alpha`/
 *  `grow`, both `seg(T, .86, 1)`) — the orb forms over the field's final 14%,
 *  never before. */
const ORB_ASSEMBLE_FROM = 0.86;
const ORB_ASSEMBLE_TO = 1;

const ORB_INITIAL: ColdBootOrbState = { rect: null, active: false, assemble: 0 };
let orbState: ColdBootOrbState = ORB_INITIAL;
const orbListeners = new Set<() => void>();

function setOrbState(next: ColdBootOrbState): void {
  orbState = next;
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
  return ORB_INITIAL;
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
  if (typeof window === "undefined") return { phase: "off", skipDecrypt: false };
  const flagWindow = window as unknown as { __XMR_COLDBOOT__?: string };
  if (flagWindow.__XMR_COLDBOOT__ === "off") return { phase: "off", skipDecrypt: false };
  if (window.location.pathname !== R.HOME) return { phase: "off", skipDecrypt: false };
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
 *  this file. */
const ROOT_STYLE: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  background: "#050505",
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
};
const CANVAS_STYLE: React.CSSProperties = { position: "absolute", inset: 0, display: "block" };
const CONSOLE_WRAP_BASE: React.CSSProperties = { position: "relative", width: "100%", maxWidth: 1200, zIndex: 1 };

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
    consoleRectRef.current = plain;
    // Handoff drives the store itself (lerping toward #hm-orb); once "done"
    // this file never touches the store again — see the header contract.
    // `assembleRef` (not a literal) — a resize firing mid-decrypt must not
    // reset how visually formed the orb already is.
    if (phaseRef.current === "splash") {
      setOrbState({ rect: plain, active: plain !== null, assemble: assembleRef.current });
    }
  }, []);

  // ── decrypt: the T ramp + canvas, or the "already resolved" immediate
  //    reveal (revisit / reduced motion). Runs while phase === "splash". ──
  React.useEffect(() => {
    if (phase !== "splash") return;

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
    const onResize = () => {
      dims = resizeCanvas(canvas);
    };
    window.addEventListener("resize", onResize);

    let raf = 0;
    let last: number | null = null;
    let elapsed = 0;
    const tick = (now: number) => {
      if (last === null) last = now;
      const dt = Math.min(64, now - last);
      last = now;
      // Frozen while hidden/offscreen — field.ts's documented discipline,
      // same as mempool/useMemCanvas.ts.
      if (document.visibilityState === "visible") elapsed += dt;

      const t = T(elapsed);
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
        setOrbState({ rect: consoleRectRef.current, active: consoleRectRef.current !== null, assemble });
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
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [phase, skipDecrypt]);

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
      setOrbState({ rect: homeRect ?? startRect, active: false, assemble: 1 });
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
      if (document.visibilityState === "visible") elapsed += dt;

      const x = X(elapsed);
      if (stageEl) applyHandoffFrame(x, stageEl, mainEl);

      const homeRect = readHmOrbRect();
      if (startRect && homeRect) setOrbState({ rect: lerpRect(startRect, homeRect, x), active: true, assemble: 1 });
      else if (homeRect) setOrbState({ rect: homeRect, active: true, assemble: 1 });
      else if (startRect) setOrbState({ rect: startRect, active: true, assemble: 1 });

      if (x >= 1) {
        clearHandoffStyles(stageEl, mainEl);
        setOrbState({ rect: homeRect ?? startRect, active: false, assemble: 1 });
        setPhase("done");
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
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
