/**
 * coldboot/Orb.tsx — the network orb's host: mounts the canvas, drives it,
 * positions it, and owns every honesty claim attached to it (the badges,
 * the caption, and `data-orb` itself).
 *
 * ── MOUNTED AS App.tsx's OWN SIBLING — NOT BY ColdBoot.tsx ─────────────────
 * `<Orb />` takes no required props and is meant to be mounted once, near
 * the top of `App.tsx` (a sibling of `<AmbientField />`/`<NavTransitions />`,
 * lazy — see the bundle note below), for the lifetime of the app. It is NOT
 * rendered inside `ColdBootConsole`'s `orbSlot`, and does not import
 * anything from `./ColdBoot` beyond `useColdBootOrbState`/`ColdBootOrbState`.
 *
 * The dependency runs the other way on purpose: `verify-coldboot.mjs` §4
 * reads `[data-orb]`'s `boundingBox()` before and after the user presses
 * Enter and requires the SAME node to persist and move. If the splash
 * mounted this component, it would unmount this component exactly when the
 * handoff reaches `done` — the one moment §4 exists to check. Mounting
 * independently makes "the orb survives the collapse" structurally true
 * rather than carefully maintained: nothing has to remember not to unmount
 * this component, because nothing is in a position to. `data-orb` is
 * rendered unconditionally below — no conditional that can remove it, no
 * `key` that can change it.
 *
 * ── POSITIONING: TWO SOURCES, NEVER BOTH AT ONCE ───────────────────────────
 * `useColdBootOrbState()` (`./ColdBoot`) gives `{ rect, active }` — the
 * already-lerped travelling rect during the console→Home handoff, recomputed
 * there every handoff frame. Whenever `rect` is `null` OR `active` is
 * `false` (before the splash has measured anything, or after the handoff has
 * settled), this component measures Home's own `#hm-orb` box itself
 * (`pages/HomePage.tsx:208` — an empty, `aspect-ratio: 1/1` reserved box,
 * `position: relative`, so `getBoundingClientRect()` reads its true viewport
 * rect with no transformed ancestor in the way — confirmed by reading
 * `VisualContext.tsx`, whose provider renders no DOM element of its own).
 * `#hm-orb` only exists on `/` (Home is always mounted there, per the
 * coordinator); on every other route this component renders `display:none`
 * — the node stays mounted, nothing is drawn or announced. `display:none`
 * also reports zero `IntersectionObserver` intersection (documented in
 * `usePageActive.ts`'s own header), which is what pauses the canvas loop on
 * every non-home route for free, through the same `observeDrawable` gate
 * brief A's canvas contract already uses — no second visibility mechanism.
 *
 * ── NO HOSTNAME, ANYWHERE ───────────────────────────────────────────────────
 * `/api/nodes` (read via `useOrbData`) never carries one — `NodeCounts` /
 * `NodeSplit` / `NodeHeight` / `Cluster` / `Bucket` have no hostname field,
 * and `api/nodes.js`'s own header says so ("without republishing any
 * hostnames"). The only `data-*` attribute in this file is `data-orb`
 * itself, valueless; every other string is static copy or a plain count.
 *
 * ── REDUCED MOTION: ORB STILL PRESENT, ROTATION FROZEN, NO EVENTS ──────────
 * `useAnimationSeconds({ enabled: false })` returns 0 and never subscribes
 * (its own contract) — passing `enabled: drawable && !reduced` freezes
 * rotation at angle 0 for free. Event spawning is gated separately
 * (`useOrbEvents` below clears its accumulator and stops spawning whenever
 * `reduced` is true), so `orb.ts#drawOrb` never receives a non-empty
 * `events` array under reduce. The badges/caption are never reduced-motion-
 * gated — losing them would lose information the canvas alone cannot carry.
 *
 * ── CANVAS CONTRACT ──────────────────────────────────────────────────────
 * `clientWidth`/`clientHeight` for the DRAWING SURFACE, never
 * `getBoundingClientRect()` (see `mempool/useMemCanvas.ts:104-112`) —
 * `getBoundingClientRect()` IS used above, but only to read `#hm-orb`'s
 * POSITION for this component's own external placement, a different
 * question from "how many pixels should the canvas backing store have".
 * `MAX_DIM` clamp, the same runaway guard for the same reason ·
 * `ctx.shadowBlur` never used · no `ctx.setTransform` — `orb.ts#drawOrb`
 * derives `dpr` itself from `ctx.canvas.width / w` and draws directly in
 * backing-store pixels (matching `field.ts#drawField`'s convention, not
 * `useMemCanvas`'s), so applying a transform here would double-scale.
 *
 * ── BUNDLE ───────────────────────────────────────────────────────────────
 * This file and everything it imports (`./orb`, `./useOrbData`) must reach
 * the app only through a lazy `React.lazy(() => import("./Orb")...)` at the
 * App.tsx mount site (not owned by this file) — nothing here is imported
 * eagerly, so `eagerJsGz` should not move by landing this file alone. See
 * the return for the measured before/after.
 *
 * ── ZERO NEW CSS ─────────────────────────────────────────────────────────
 * Every style below is a module-scope `React.CSSProperties` constant except
 * the POSITION rect, which is necessarily computed per-render from a
 * measured/lerped rect — still built with object literals, never a new CSS
 * rule. `fontSize` is always a token STRING (`"var(--fs-label)"`), never a
 * number. CSS NEEDS LIST for the styles-motion.css owner: none.
 */

import * as React from "react";
import { useLocation } from "react-router-dom";
import { useMoneroLive } from "@/data/DataContext";
import { useAnimationSeconds } from "@/design/useAnimationClock";
import { observeDrawable } from "@/design/usePageActive";
import { useReducedMotion } from "@/design/useReducedMotion";
import { NodeProvenance, Provenance } from "@/design/primitives";
import { R } from "../../scripts/routes.mjs";
import {
  drawOrb,
  spawnStemEvent,
  spawnBlockEvent,
  seedFromString,
  type OrbEvent,
  type OrbNode,
} from "./orb";
import { useOrbData, type FeedBlockEvent, type FeedTxEvent } from "./useOrbData";
import { useColdBootOrbState, type ColdBootOrbState } from "./ColdBoot";

/** Ambient rotation only needs to look smooth, not track input — matches the
 *  fps order of magnitude other ambient canvases in this repo use. */
const ORB_FPS = 24;

/** Hard ceiling on either canvas dimension. Same runaway guard as
 *  `mempool/useMemCanvas.ts:66` — sibling constant, not a shared import. */
const MAX_DIM = 4096;

/** Cap on simultaneously-animating stems. Real tx arrivals still decide
 *  WHETHER and roughly HOW OFTEN a stem spawns (one per newly-seen tx id);
 *  this only bounds how many render concurrently during a burst, for
 *  legibility — a presentational choice inside data that is illustrative by
 *  design, not a second data claim. */
const MAX_CONCURRENT_STEMS = 3;

/** Frames to keep retrying `#hm-orb` before giving up and warning once —
 *  Home is always mounted on `/`, but the very first paint may land a frame
 *  before this effect's first measurement. Not a perpetual poll: capped, and
 *  only armed on `/` in the first place. */
const HOME_ORB_FIND_RETRY_FRAMES = 120;

const HOME_ORB_ID = "hm-orb";

// ── styles — module-scope constants, built once ─────────────────────────

const BASE_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  boxSizing: "border-box",
};

const HIDDEN_STYLE: React.CSSProperties = { display: "none" };

const CANVAS_WRAP_STYLE: React.CSSProperties = {
  position: "relative",
  flex: "1 1 auto",
  minHeight: 0,
};

const CANVAS_STYLE: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  display: "block",
};

const OVERLAY_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  flex: "0 0 auto",
};

const BADGE_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const CAPTION_STYLE: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--f-mono)",
  fontSize: "var(--fs-label)",
  lineHeight: 1.5,
  color: "var(--ink-40)",
};

// ── position: the coldboot rect, or a self-measured #hm-orb ────────────────

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

function rectFromElement(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

/** Self-measures `#hm-orb` while `enabled`. Retries via rAF for a bounded
 *  number of frames (Home paints it on first render, but this effect can
 *  run a frame early), then tracks it via ResizeObserver + resize/scroll —
 *  `#hm-orb` is `position: relative` and in-flow, so its viewport rect can
 *  move on scroll even though it never resizes on its own. */
function useHomeOrbRect(enabled: boolean): Rect | null {
  const [rect, setRect] = React.useState<Rect | null>(null);

  React.useEffect(() => {
    if (!enabled) {
      setRect(null);
      return;
    }
    let raf = 0;
    let tries = 0;
    let ro: ResizeObserver | null = null;
    let warned = false;

    const track = (el: Element): void => {
      setRect(rectFromElement(el));
      ro = new ResizeObserver(() => setRect(rectFromElement(el)));
      ro.observe(el);
    };

    const find = (): void => {
      const el = document.getElementById(HOME_ORB_ID);
      if (el) {
        track(el);
        return;
      }
      tries += 1;
      if (tries > HOME_ORB_FIND_RETRY_FRAMES) {
        if (!warned) {
          warned = true;
          console.warn(`[Orb] #${HOME_ORB_ID} never appeared after ${tries} frames — Home may not have mounted it.`);
        }
        return;
      }
      raf = requestAnimationFrame(find);
    };
    find();

    const onWindowChange = (): void => {
      const el = document.getElementById(HOME_ORB_ID);
      if (el) setRect(rectFromElement(el));
    };
    window.addEventListener("resize", onWindowChange);
    window.addEventListener("scroll", onWindowChange, { passive: true });

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener("resize", onWindowChange);
      window.removeEventListener("scroll", onWindowChange);
    };
  }, [enabled]);

  return rect;
}

// ── event accumulator — the animation-clock-timed half of T2/T3 ────────────
//
// `useOrbData` hands back RAW real events (block arrivals, tx arrivals).
// This hook turns NEWLY SEEN ones into `OrbEvent`s stamped against THIS
// component's own `useAnimationSeconds` clock (via `secondsRef`, read at
// spawn time) and prunes expired ones — see `./useOrbData.ts`'s header on
// why that clock-stamping cannot happen inside that hook itself.

function useOrbEvents(
  nodes: readonly OrbNode[],
  txEvents: readonly FeedTxEvent[],
  blockEvents: readonly FeedBlockEvent[],
  reduced: boolean,
  secondsRef: React.RefObject<number>,
): React.RefObject<readonly OrbEvent[]> {
  const eventsRef = React.useRef<readonly OrbEvent[]>([]);
  const seenTx = React.useRef<Set<string>>(new Set());
  const seenBlock = React.useRef<Set<string>>(new Set());
  const nodesRef = React.useRef(nodes);
  nodesRef.current = nodes;

  React.useEffect(() => {
    if (reduced) {
      // No stem/block events under reduce — the caption/badges below carry
      // the same information as text, so nothing is lost by not animating.
      eventsRef.current = [];
      return;
    }
    const now = secondsRef.current;
    let next = eventsRef.current.filter((e) => now - e.t0 < e.dur);

    for (const t of txEvents) {
      if (seenTx.current.has(t.id)) continue;
      seenTx.current.add(t.id);
      if (nodesRef.current.length === 0) continue;
      if (next.filter((e) => e.type === "stem").length >= MAX_CONCURRENT_STEMS) continue;
      const ev = spawnStemEvent({ nodes: nodesRef.current, seed: seedFromString(t.id), t0: now });
      if (ev) next = [...next, ev];
    }

    for (const b of blockEvents) {
      const key = `${b.height}:${b.hash}`;
      if (seenBlock.current.has(key)) continue;
      seenBlock.current.add(key);
      next = [...next, spawnBlockEvent({ t0: now, seed: b.height })];
    }

    eventsRef.current = next;
    // secondsRef is a ref (read, not a dep); txEvents/blockEvents are the
    // only things that should re-run this — a new real arrival, not a tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txEvents, blockEvents, reduced]);

  return eventsRef;
}

// ── caption copy ─────────────────────────────────────────────────────────

function reachableCaption(reachable: number | null, latticeSize: number): string {
  if (reachable == null) {
    return "Node population unavailable — the monero.fail census did not answer.";
  }
  // The one clause required: the real count, and an explicit denial that the
  // dot count is 1:1 with it.
  return `${reachable.toLocaleString()} reachable nodes · shown as a ${latticeSize}-point sample, not one dot per node.`;
}

const STEM_CAPTION =
  "A privacy stem cannot be observed from any single node, by protocol design — that is the protocol working, not a gap in this data.";

// ── component ────────────────────────────────────────────────────────────

export function Orb(): React.JSX.Element {
  const data = useMoneroLive();
  const orbData = useOrbData(data);
  const reduced = useReducedMotion();
  const location = useLocation();

  const coldBootOrb: ColdBootOrbState = useColdBootOrbState();
  const useHome = coldBootOrb.rect === null || !coldBootOrb.active;
  const isHomeRoute = location.pathname === R.HOME;
  const homeRect = useHomeOrbRect(useHome && isHomeRoute);
  const effectiveRect: Rect | null = useHome ? homeRect : coldBootOrb.rect;

  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const drawRef = React.useRef<(() => void) | null>(null);
  const [drawable, setDrawable] = React.useState(false);

  React.useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    return observeDrawable(el, setDrawable);
  }, []);

  const seconds = useAnimationSeconds({ fps: ORB_FPS, enabled: drawable && !reduced });
  const secondsRef = React.useRef(seconds);
  secondsRef.current = seconds;

  const orbDataRef = React.useRef(orbData);
  orbDataRef.current = orbData;

  const eventsRef = useOrbEvents(orbData.nodes, orbData.txFeedEvents, orbData.blockFeedEvents, reduced, secondsRef);

  // Resize + initial/immediate draw. `drawRef` lets the resize handler and
  // the seconds-driven effect below share one draw path without either
  // holding a stale closure over `w`/`h`/`orbData`.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = (): void => {
      const w = Math.min(canvas.clientWidth, MAX_DIM);
      const h = Math.min(canvas.clientHeight, MAX_DIM);
      if (!w || !h) return;
      drawOrb(ctx, w, h, secondsRef.current, { nodes: orbDataRef.current.nodes, events: eventsRef.current });
    };
    drawRef.current = draw;

    const resize = (): void => {
      const w = Math.min(canvas.clientWidth, MAX_DIM);
      const h = Math.min(canvas.clientHeight, MAX_DIM);
      if (!w || !h) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      // No ctx.setTransform — see the file header's canvas-contract note.
      draw();
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => {
      ro.disconnect();
      drawRef.current = null;
    };
    // secondsRef/orbDataRef/eventsRef are refs read at draw time, not deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    drawRef.current?.();
  }, [seconds, orbData.nodes, orbData.blockFeedEvents, orbData.txFeedEvents, effectiveRect]);

  const positionStyle: React.CSSProperties = effectiveRect
    ? {
        position: "fixed",
        left: effectiveRect.x,
        top: effectiveRect.y,
        width: effectiveRect.w,
        height: effectiveRect.h,
      }
    : HIDDEN_STYLE;

  return (
    <div data-orb style={{ ...BASE_STYLE, ...positionStyle }}>
      <div style={CANVAS_WRAP_STYLE}>
        <canvas ref={canvasRef} style={CANVAS_STYLE} aria-hidden="true" />
      </div>
      <div style={OVERLAY_STYLE}>
        <div style={BADGE_ROW_STYLE}>
          <NodeProvenance source="network" phase={orbData.phase} detail="monero.fail" compact />
        </div>
        <p style={CAPTION_STYLE}>{reachableCaption(orbData.reachable, orbData.latticeSize)}</p>
        <div style={BADGE_ROW_STYLE}>
          {/* "ILLUSTRATIVE" is this repo's existing MODEL provenance source
              (design/provenance.tsx — five sources, one vocabulary), not a
              new sixth label. No `fresh` prop: defaults to "none", so this
              can never carry a live dot. */}
          <Provenance source="model" detail="Dandelion++ stem — not observable from a node" compact />
        </div>
        <p style={CAPTION_STYLE}>{STEM_CAPTION}</p>
      </div>
    </div>
  );
}
