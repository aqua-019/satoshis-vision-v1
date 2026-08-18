/**
 * pages/about/CloverOverlay.tsx — the host for the clover glyph field.
 *
 * The field module (cloverField.ts) owns SHAPE and is pure in `T`. This file
 * owns everything the field deliberately refuses: the wall clock, the frame
 * loop, the frame-budget dial, reduced motion, and the dismissal.
 *
 * ── IT IS AN OVERLAY, NOT A SCREEN ──────────────────────────────────────
 * `position: fixed` above everything, with the page RENDERED AND PAINTING
 * beneath it from the first frame — the scrim peaks at 0.72, never 1, so this
 * reads as something laid ON the page rather than a cut to another colour.
 * Nothing enters or leaves the document flow, so the overlay's CLS
 * contribution is ZERO BY CONSTRUCTION rather than by tuning: a
 * `position: fixed` element is out of flow, and no element beneath it moves
 * when it unmounts. The gate measures that with a real PerformanceObserver
 * against this repo's own 0.005 ceiling rather than asserting the mechanism.
 *
 * ── Z-INDEX, AND THE IMPORT THAT IS DELIBERATELY NOT HERE ───────────────
 * A local constant. The obvious version — `import { COLDBOOT_Z } from
 * "@/coldboot/ColdBoot"`, so there is one authority for the top of the stack —
 * was written first and MEASURED, and it cost this route 40 KB raw:
 *
 *     ColdBoot            31,577      the splash itself
 *     mem-stats            3,551  ┐   ColdBootConsole reads useMoneroLive(),
 *     useNodePopulation    2,825  │   so the whole live-feed closure follows
 *     Skeleton             1,133  │   the one constant in
 *     useFeedEvents        1,066  ┘
 *
 * — a 9-chunk closure on a page that never renders a splash. Rollup chunks per
 * MODULE, not per export, so importing one number imports its whole file. This
 * repo has recorded that five times (canvasColor · repoPulse · future/data.ts ·
 * Disclosure · and p3·15's /about/peers, where one import dragged in two
 * components the route does not render).
 *
 * There is no authority to share, because there is no ordering to resolve.
 * `coldboot/gate.ts#coldBootWillRender` ends `return pathname === R.HOME`, so
 * the splash is a Home-only surface: it and this overlay can never be on
 * screen together. Measured at `768ba13`, not assumed.
 *
 * 1000 is the rung `.v6-modal-veil` uses (styles.css:2268) — the app's "on top
 * of everything" value. What must stay ABOVE it is `.skip-link` at 9999
 * (styles.css:2571), and that is deliberate: a keyboard user pressing Tab must
 * reach the skip link, not a decorative canvas. (They also dismiss this
 * overlay by doing so — every keydown ends it.) Nav dropdowns sit at 55 and
 * are the only other thing that can coexist here.
 *
 * ── REDUCED MOTION: NO LOOP, NO CANVAS, NO OVERLAY ──────────────────────
 * The CALLER owns the preference — the house rule this repo records against
 * both clock hooks and against coldboot/field.ts ("reduced motion is the
 * HOST's decision"). Under `prefers-reduced-motion` this component returns
 * `null` before any canvas is created and before any rAF is requested. There
 * is no frozen frame to interpret and nothing to dismiss; the reader gets the
 * page immediately.
 *
 * NOTHING IS LOST BY THAT, and that is a property of the design rather than a
 * concession: the clover is decorative, and the page carries a STATIC clover
 * mark in its own header on every path — animated or not, JS or no JS. The
 * mark is the information; the animation is only how it arrives.
 *
 * ── SKIPPABLE AT ANY FRAME ──────────────────────────────────────────────
 * An overlay a reader cannot dismiss is a defect, not a flourish. Any
 * pointerdown, keydown, touchstart or wheel anywhere on the document ends it
 * immediately. It is `aria-hidden` and carries no focusable node, so assistive
 * technology reads the page underneath it rather than waiting on it, and the
 * hard cap below bounds it even if every listener somehow failed.
 *
 * ── THE DURATION, DECIDED OUT LOUD ──────────────────────────────────────
 * RUN_MS = 3400. The budget, in the field's own phase fractions:
 *
 *     stream-in      0 ‥ 0.08    ~270 ms   glyphs rise out of nothing
 *     formation   0.08 ‥ 0.42   ~1160 ms   cells lock, centre outward
 *     hold        0.42 ‥ 0.66    ~820 ms   the clover is legible and still
 *     release     0.66 ‥ 0.93    ~920 ms   cells let go, outer edge first
 *     dissolve    0.86 ‥ 1        ~480 ms   field and scrim fade to nothing
 *
 * Under the ~4 s the brief allows, and chosen at the short end of it: this
 * plays on EVERY entry to the route, and a flourish a returning reader has
 * already seen is a toll. The hold is the part that has to survive being cut
 * short by a fast reader, so it is the phase given the most slack relative to
 * how long the shape takes to become legible.
 */

import * as React from "react";
import { governorScale, resetFrameBudgetBaseline, sampleFrameBudget } from "@/design/useAnimationClock";
import { useReducedMotion } from "@/design/useReducedMotion";
import { cloverCellCount, drawClover, resetCloverGeometry, T_FORMED } from "./cloverField";

/** Total wall-clock run. See the header for the phase budget behind it. */
export const RUN_MS = 3400;

/** See the z-index note in the header for why this is a local literal and not
 *  an import of `COLDBOOT_Z`. */
const OVERLAY_Z = 1000;

/** device-pixel-ratio ceiling — past this the backing store costs more than it
 *  shows. Same value and same reasoning as mempool/useMemCanvas's `maxDpr`. */
const MAX_DPR = 2;
/** Hard ceiling on either backing-store dimension. The runaway guard
 *  useMemCanvas documents: a canvas whose size can feed its own ancestor's
 *  layout grows without bound and nothing throws. This canvas is
 *  `position: fixed` and sized from the VIEWPORT, so the loop cannot arise —
 *  the clamp is here to make the class impossible rather than merely absent. */
const MAX_DIM = 4096;

export interface CloverOverlayProps {
  /** Fires once when the overlay has finished or been dismissed. */
  onDone?: () => void;
}

export function CloverOverlay({ onDone }: CloverOverlayProps) {
  const reduce = useReducedMotion();
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [gone, setGone] = React.useState(false);
  /* CLIENT-ONLY, and a gate caught this the first time it ran.
     `scripts/prerender.mjs` calls renderToString, where no effect runs — so
     without this flag the overlay's markup was emitted into all sixteen
     prerendered files: a `position:fixed; inset:0` div and a canvas that no
     loop would ever paint, sitting over the page for exactly the JS-off reader
     the prerendering exists to serve.
     Same shape as `useGovernorScale`'s documented approach — start at the value
     the server can honestly produce, adopt the live one in an effect — so the
     prerendered HTML and the first client render always agree. */
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const doneRef = React.useRef(onDone);
  doneRef.current = onDone;

  // Under reduced motion nothing here ever mounts: no canvas, no rAF, no
  // listeners. Declared before the effect so the effect's own early return is
  // never the thing being relied on.
  const active = mounted && !reduce && !gone;

  React.useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let start = 0;
    let stopped = false;
    // Clamp the RATIO rather than the resulting dimensions: clamping width and
    // height independently would change the backing store's aspect against the
    // CSS box and stretch the clover on a very wide display.
    const dprOf = (w: number, h: number) =>
      Math.min(window.devicePixelRatio || 1, MAX_DPR, MAX_DIM / Math.max(1, w), MAX_DIM / Math.max(1, h));

    const finish = () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
      setGone(true);
      doneRef.current?.();
    };

    const size = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const dpr = dprOf(w, h);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      return { w, h };
    };

    let { w, h } = size();

    const frame = (now: number) => {
      if (stopped) return;
      raf = requestAnimationFrame(frame);
      // Feed the ONE shared frame-budget dial. This is a second per-frame
      // heartbeat, which is explicitly safe: `governorSample` drops samples
      // that do not advance the timestamp, and useAnimationClock's header
      // names ParticleField as the existing precedent for a canvas loop that
      // cannot fold into the shared subscriber loop.
      sampleFrameBudget(now);
      if (!start) start = now;
      const T = Math.min(1, (now - start) / RUN_MS);

      // Ambient glyphs shed with the dial; the clover never does.
      drawClover(ctx, w, h, T, governorScale());

      if (T >= 1) finish();
    };

    const onResize = () => {
      const next = size();
      w = next.w;
      h = next.h;
    };

    // Any input at all ends it, at whatever frame it is on.
    const skip = () => finish();

    /* ── THE READ HOOK, in the idiom of `__XMR_GOV__` / `__MEM_FPS__` /
       `__XMR_TIER_MS__`. `drawClover` is PURE IN `T`, and this is what makes
       that property worth having: a gate can render an exact phase and assert
       it, instead of sleeping and hoping the wall clock landed in the hold.

       Without it the only way to check "the clover formed" is a timing race,
       and a timing race on a contended CI runner is the flakiest possible
       assertion about the least important thing on the page.

         __XMR_CLOVER__.drawAt(T)   render exactly phase T
         __XMR_CLOVER__.formedT     the T at which the shape is complete
         __XMR_CLOVER__.cells()     how many cells the stencil filled — the
                                    gate's non-vacuity floor, because "the
                                    clover is there" proves nothing if the
                                    stencil rasterised to zero cells. */
    (window as unknown as { __XMR_CLOVER__: unknown }).__XMR_CLOVER__ = {
      drawAt: (t: number) => drawClover(ctx, w, h, t, 1),
      formedT: T_FORMED,
      cells: () => cloverCellCount(w, h, dprOf(w, h)),
    };

    resetFrameBudgetBaseline();
    raf = requestAnimationFrame(frame);
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("pointerdown", skip, { passive: true });
    window.addEventListener("touchstart", skip, { passive: true });
    window.addEventListener("wheel", skip, { passive: true });
    window.addEventListener("keydown", skip);

    // Belt and braces: if a frame never arrives — a tab backgrounded across
    // the whole run, a rAF that never fires — the overlay must still go. An
    // overlay whose removal depends on its own animation completing is one
    // stalled frame away from being permanent.
    const cap = window.setTimeout(finish, RUN_MS + 1200);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(cap);
      delete (window as unknown as { __XMR_CLOVER__?: unknown }).__XMR_CLOVER__;
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("touchstart", skip);
      window.removeEventListener("wheel", skip);
      window.removeEventListener("keydown", skip);
      // Drop the memoised atlas so a theme change between two visits to this
      // route rebuilds it against the live tokens.
      resetCloverGeometry();
    };
  }, [active]);

  if (!active) return null;

  return (
    <div
      data-clover-overlay
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: OVERLAY_Z,
        // NO background here. The scrim is painted INSIDE the canvas by
        // drawClover, on the same alpha curve as the glyphs — a background set
        // on this element would be written once at mount (this component does
        // not re-render per frame, by design) and would therefore snap off at
        // unmount instead of dissolving.
        //
        // `pointer-events: none` so the page underneath stays usable from the
        // first frame. The skip listeners are on `window`, so they still fire:
        // a reader who clicks a link both dismisses the overlay and follows the
        // link, which is the correct behaviour for something decorative.
        pointerEvents: "none",
      }}
    >
      <canvas
        ref={canvasRef}
        data-clover-canvas
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </div>
  );
}
