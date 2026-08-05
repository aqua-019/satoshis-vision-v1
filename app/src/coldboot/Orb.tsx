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
  ORB_MIN_CANVAS_PX,
  type OrbEvent,
  type OrbNode,
} from "./orb";
import { useOrbData, type FeedBlockEvent, type FeedTxEvent } from "./useOrbData";
import { COLDBOOT_Z, useColdBootOrbState, type ColdBootOrbState } from "./ColdBoot";

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

/* `minHeight` is the load-bearing property here and it used to be `0`.
   `flex:"1 1 auto"` against an unshrinkable OVERLAY_STYLE below meant this box
   collapsed to zero height in any host shorter than the captions, which starved
   the canvas and left the backing store at the 300x150 HTML default — see
   `orb.ts#ORB_MIN_CANVAS_PX` for the measurement and the mechanism. The floor is
   read from there rather than restated, for the same reason verify-orb parses
   MIN_ORB_NODES out of orb.ts instead of hard-coding it. */
const CANVAS_WRAP_STYLE: React.CSSProperties = {
  position: "relative",
  flex: "1 1 auto",
  minHeight: ORB_MIN_CANVAS_PX,
};

const CANVAS_STYLE: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  display: "block",
};

/* No `opacity` here. The fade is per-render and lives in `overlayAssembleStyle`,
   which is spread AFTER this at the call site — see the note beside `assemble`.
   An opacity added to this constant would be a second, silent owner of the same
   value, which is the shape the fix below exists to remove. */
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

/* Deliberately NOT a `.prov-tag` and NOT a sixth ProvSource. This says what
   kind of claim the layer makes, not where its data came from — the
   Provenance badge beside it still answers that. Styled off --y-50, the
   repo's warning/queued tone, so it reads as a qualifier rather than as
   telemetry: no live dot, no colour that could be mistaken for a feed.
   fontSize is the --fs-label token as a string, never a numeric literal
   (verify-legibility §2 skips string values entirely, so the real floor is
   the computed-style probe in verify-coldboot §L). */
const ILLUSTRATIVE_BADGE_STYLE: React.CSSProperties = {
  fontFamily: "var(--f-mono)",
  fontSize: "var(--fs-label)",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--y-50)",
  border: "1px solid color-mix(in srgb, var(--y-50) 40%, transparent)",
  borderRadius: 2,
  padding: "2px 6px",
  whiteSpace: "nowrap",
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

/** What `useHomeOrbRect` tracks: where the box is, and what clips it. */
interface HomeBox {
  readonly rect: Rect;
  /** The nearest ancestor of `#hm-orb` that CLIPS OVERFLOW, or `null` when
   *  nothing between it and `<body>` does — in which case the viewport is
   *  already the only clip and this component emits no `clip-path` at all.
   *
   *  That null is how ≤768px stays untouched BY CONSTRUCTION rather than by
   *  measurement: there `styles.css:2075-2077` gives `.main` `overflow:visible`
   *  and the document scrolls, so the walk below finds nothing and the phone
   *  path is byte-identical to what it was. */
  readonly clip: Rect | null;
}

function sameRect(a: Rect | null, b: Rect | null): boolean {
  if (a === null || b === null) return a === b;
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

/** The nearest ancestor that clips overflow.
 *
 *  The predicate is `overflow-y !== "visible"` — a pure CSS question, and that
 *  is deliberate. The obvious alternative ("an ancestor that is actually
 *  scrolling") is CONTENT-dependent and therefore TIME-dependent: resolved on a
 *  cold load before the feed lands and the cards lay out, it can answer "none"
 *  and then never be asked again. A clipping ancestor is a stylesheet fact, so
 *  this answers the same at every instant after first layout. */
function clipAncestor(el: Element): Element | null {
  let n = el.parentElement;
  while (n && n !== document.body) {
    if (getComputedStyle(n).overflowY !== "visible") return n;
    n = n.parentElement;
  }
  return null;
}

function rectFromElement(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

/** Self-measures `#hm-orb` while `enabled`. Retries via rAF for a bounded
 *  number of frames (Home paints it on first render, but this effect can
 *  run a frame early), then tracks it via ResizeObserver + resize + scroll.
 *
 *  ── THE SCROLL LISTENER GOES ON `document`, IN THE CAPTURE PHASE ─────────
 *  `#hm-orb` is `position: relative` and in-flow while `[data-orb]` is
 *  `position: fixed`, so the box's viewport rect moves on scroll and the orb's
 *  does not. Re-measuring on scroll is the ONLY thing that keeps them
 *  together — and WHICH OBJECT EMITS THAT SCROLL IS A STYLESHEET DECISION
 *  THAT CHANGES AT A BREAKPOINT. Above 768px `styles.css:674` makes `.main`
 *  the scroller (`min-height:0; overflow-y:auto`, inside a `.shell` that is
 *  `flex:1; min-height:0`); at 768 and below `styles.css:2075-2077` gives it
 *  `height:auto; overflow:visible` and the document scrolls instead.
 *
 *  `scroll` does not BUBBLE, so a `window` listener hears the document and
 *  nothing else. This file shipped one, which meant the orb tracked perfectly
 *  at 768 and not at all at 769: measured on 06e60fe, drift equal to the
 *  scroll offset EXACTLY — 400.0px at 1440/1280/900/769, 0.0px at 768/390.
 *  Correct code, wrong assumption about its environment, and the boundary
 *  lives in a stylesheet this file never mentions.
 *
 *  `scroll` does CAPTURE, so one capture-phase listener on `document` covers
 *  every scroller without naming one. `routes/useRouteChrome.ts:63-75` makes
 *  and documents the same call for the same reason, and its wording is worth
 *  borrowing: one listener "survives any future fourth scroller without being
 *  edited". Naming `.main` here would re-encode a breakpoint this file cannot
 *  see, and would go quietly wrong the next time it moves.
 *
 *  ── ONE SENTENCE OF THAT PRECEDENT DOES NOT TRANSFER ─────────────────────
 *  `useRouteChrome`'s docblock says reading `scrollTop` during a scroll forces
 *  no layout. True of `scrollTop`, and NOT true here: this reads
 *  `getBoundingClientRect()`, which does force layout. So the rAF coalescing
 *  below is doing strictly more than the coalescing it is modelled on, and it
 *  is load-bearing rather than tidy. Measured on this tree at 769x900, where
 *  Home has a second scroller (`.nav-main`, `styles.css:512`): scrolling that
 *  strip alone delivers 20 events and 20 rect reads and produces ZERO renders
 *  and ZERO redraws, because `commit` below returns the previous object. A
 *  60-write burst inside one task collapses to a single read. Off Home there is
 *  no listener at all (App.tsx mounts this component only on `/`), and during
 *  the splash there is none either — the cold-boot rect owns the position
 *  then, so this hook is not enabled.
 *
 *  ── WHAT THIS STILL DOES NOT COVER ───────────────────────────────────────
 *  `#hm-orb` can also move with no scroll, no viewport resize, and no size
 *  change of its own: when content ABOVE it reflows. Home's hero copy changes
 *  when the feed lands (verify-cls.mjs measures that route's kicker in both
 *  feed states), and a ResizeObserver on `#hm-orb` sees only its own box. That
 *  case is open. It needs a different observer target, NOT a re-measure on the
 *  24fps tick — that would be a poll, and verify-govern §5 exists to stop this
 *  repo shipping polls. */
function useHomeOrbRect(enabled: boolean): HomeBox | null {
  const [box, setBox] = React.useState<HomeBox | null>(null);

  React.useEffect(() => {
    if (!enabled) {
      setBox(null);
      return;
    }
    let findRaf = 0;
    let pending = 0;
    let tries = 0;
    let ro: ResizeObserver | null = null;
    let warned = false;
    /* Cached, because the walk reads getComputedStyle on each ancestor and this
       runs once per scrolled frame. Invalidated on resize — the one event that
       can change the answer, since the answer is a media query. */
    let clipEl: Element | null = null;
    let clipStale = true;

    /* Identity-stable. Returning the PREVIOUS object from the updater makes
       React bail out, so a scroll of a container the orb does not sit in costs
       one getBoundingClientRect and nothing else — no render, no redraw. Every
       call site used to allocate a fresh Rect unconditionally, which also
       re-fired the draw effect below, since `effectiveRect` is in its deps. The
       comparison lives in the updater rather than in a second `last` box so
       there is exactly one source of truth for what was last committed. */
    const commit = (el: Element): void => {
      if (clipStale) { clipEl = clipAncestor(el); clipStale = false; }
      const rect = rectFromElement(el);
      const clip = clipEl && clipEl.isConnected ? rectFromElement(clipEl) : null;
      setBox((prev) => (prev && sameRect(prev.rect, rect) && sameRect(prev.clip, clip)
        ? prev : { rect, clip }));
    };

    /* One measurement per frame, however many scrollers fired into it. Not a
       loop and never self-rescheduling: `pending` is cleared by the callback,
       so a burst of events inside one task collapses to a single read. */
    const measure = (): void => {
      pending = 0;
      const el = document.getElementById(HOME_ORB_ID);
      if (el) commit(el);
    };
    const schedule = (): void => {
      if (!pending) pending = requestAnimationFrame(measure);
    };

    const track = (el: Element): void => {
      commit(el);
      ro = new ResizeObserver(schedule);
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
      findRaf = requestAnimationFrame(find);
    };
    find();

    /* Resize is the one event that can move the breakpoint under the clip
       answer, so it invalidates the cache as well as re-measuring. */
    const onResize = (): void => { clipStale = true; schedule(); };

    window.addEventListener("resize", onResize);
    document.addEventListener("scroll", schedule, { capture: true, passive: true });

    return () => {
      if (findRaf) cancelAnimationFrame(findRaf);
      if (pending) cancelAnimationFrame(pending);
      ro?.disconnect();
      window.removeEventListener("resize", onResize);
      /* The capture flag is REQUIRED here. A capture-registered listener is not
         removed by a bubble-phase removal, and this effect re-runs on every
         `enabled` flip — off the splash, and on every route change — so the
         omission would stack a listener per flip rather than leak one. */
      document.removeEventListener("scroll", schedule, true);
    };
  }, [enabled]);

  return box;
}

// ── event accumulator — the animation-clock-timed half of T2/T3 ────────────
//
// `useOrbData` hands back RAW real events (block arrivals, tx arrivals).
// This hook turns NEWLY SEEN ones into `OrbEvent`s stamped against THIS
// component's own `useAnimationSeconds` clock (via `secondsRef`, read at
// spawn time) and prunes expired ones — see `./useOrbData.ts`'s header on
// why that clock-stamping cannot happen inside that hook itself.

/** A plain mutable box, not `React.RefObject<T>` — that type's `.current` is
 *  `T | null` (the DOM-ref shape, nullable until attached), which does not
 *  match a `useRef(nonNullInitialValue)` box used purely as shared mutable
 *  state between effects. Structurally compatible with the real ref objects
 *  passed in below either way, since this only ever reads/writes `.current`. */
type Box<T> = { current: T };

function useOrbEvents(
  nodes: readonly OrbNode[],
  txEvents: readonly FeedTxEvent[],
  blockEvents: readonly FeedBlockEvent[],
  reduced: boolean,
  secondsRef: Box<number>,
): Box<readonly OrbEvent[]> {
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
  const homeBox = useHomeOrbRect(useHome && isHomeRoute);
  const homeRect = homeBox?.rect ?? null;
  /* The fallback is the fix for a one-frame drop-out. ColdBoot's final handoff
     write sets `active:false` WITH a rect; `useHome` then flips true, and
     `useHomeOrbRect`'s effect sets its own state to null before it measures —
     so for at least one commit `effectiveRect` was null, the orb rendered
     display:none, and the thing that just travelled across the cut blinked out
     at the moment it arrived. §4 sleeps 2500ms and cannot see it. Preferring
     Home's rect but falling back to the last cold-boot rect closes the gap
     without changing which source wins once Home has measured. */
  const effectiveRect: Rect | null = useHome
    ? (homeRect ?? coldBootOrb.rect)
    : coldBootOrb.rect;


  /* ASSEMBLE — computed every handoff frame by ColdBoot and, until now, never
     read by anything. The documented "orb assembles over the field's final 14%"
     simply did not happen: the orb appeared at full strength the instant the
     console reported its rect, as a second fully-formed bright object competing
     with the decrypt. Driven on opacity and transform ONLY, so it composites
     and cannot contribute a layout shift. Off the splash it is pinned to 1 —
     `active` false means nobody owns the value and the orb must not fade. */
  const assemble = coldBootOrb.active ? coldBootOrb.assemble : 1;
  const assembleStyle: React.CSSProperties = {
    opacity: assemble,
    transform: `scale(${(0.94 + 0.06 * assemble).toFixed(4)})`,
    transformOrigin: "center",
    willChange: assemble > 0 && assemble < 1 ? "opacity, transform" : undefined,
  };

  /* ── THE OVERLAY FADES TOO, AND IT MUST READ THE SAME VALUE ──────────────
     v6.1.9 spent `assemble` on the canvas wrap alone. The badge/caption block
     is [data-orb]'s OTHER child and kept full strength throughout, so the fix
     for "a second fully-formed bright object competing with the decrypt" left
     the wordiest part of that object exactly where it was.

     Measured on 63dc1a8 at 1440x900, cold, production hold: the anti-flash
     floor lifts at 1600ms and this block reads opacity 1 from that instant
     until 7114ms — 5514ms of NETWORK/UNAVAILABLE/ILLUSTRATIVE/DANDELION++ text
     over the decrypt field, 4708ms of it with its own canvas at 0. The block is
     402x154px at 1440x900 and 288x180 at 390x844; its width comes from the
     console's orb slot, so it is not small.

     OPACITY ONLY, and each omission is load-bearing:

       · NOT `...assembleStyle`. That object also carries `transform: scale()`,
         and [data-orb]'s own positionStyle (below) already owns a transform —
         the one the #163 CLS fix depends on. Spreading it here would also scale
         the caption text, which is not what the mockup does: the canvas grows
         into place, the words do not.
       · NOT a conditional render, NOT `visibility`, NOT `display`. The node
         stays rendered, selectable and in the accessibility tree at every value
         of `assemble` — these badges and captions are the orb's honesty claims,
         and this file's own reduced-motion note above already says losing them
         loses information the canvas cannot carry. (verify-orb.mjs §3 also
         finds this block by the exact text of its ILLUSTRATIVE span; that
         section runs splash-bypassed, where `active` is false and `assemble` is
         pinned to 1, so an opacity fade is invisible to it and a removal would
         not be.)
       · It reads `assembleStyle.opacity`, NOT a second expression over
         `assemble`. One value, one owner: re-curve the canvas's fade and the
         caption follows by construction rather than by somebody remembering two
         edit sites. verify-orb.mjs §7's O3 asserts the two COMPUTED opacities
         are equal mid-decrypt; this is what makes that a statement about the
         DOM rather than about two literals agreeing.
       · `willChange` is narrower than the canvas wrap's on purpose — this
         element never transforms. */
  const overlayAssembleStyle: React.CSSProperties = {
    opacity: assembleStyle.opacity,
    willChange: assemble > 0 && assemble < 1 ? "opacity" : undefined,
  };

  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const drawRef = React.useRef<(() => void) | null>(null);
  const [drawable, setDrawable] = React.useState(false);

  React.useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    return observeDrawable(el, setDrawable);
  }, []);

  /* D1909 · do not animate inside the critical window unless the splash needs
   * us there.
   *
   * `observeDrawable` correctly stops the loop when the orb is hidden, but on
   * `/` with the cold boot bypassed the orb IS visible, so the rAF ran from
   * mount — during load, under verify-vitals' 6x CPU throttle. Measured on
   * `/`: total blocking time 166ms historically, then 329ms and 479ms on two
   * runs against a 400ms budget. Passing on one run and failing on the next
   * is not a green worth having; a route that sits at 82% of budget with a
   * 150ms run-to-run spread will flake in CI and teach whoever inherits it to
   * distrust the gate.
   *
   * So the ambient loop waits for idle — EXCEPT when the cold boot is live,
   * where the orb is not decoration: it assembles from T=0.86 and travels
   * across the Enter cut, so a deferred start would be visible as a missing
   * element in the choreography.
   *
   * Deferring costs no layout: `#hm-orb` reserves its box by aspect-ratio, so
   * the orb arrives into space already held and `/` keeps its 0.0000 CLS.
   * requestIdleCallback is not in Safari <17, hence the timeout fallback. */
  const [started, setStarted] = React.useState(false);
  React.useEffect(() => {
    if (coldBootOrb.active) { setStarted(true); return; }
    const ric = (window as unknown as {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    }).requestIdleCallback;
    if (typeof ric === "function") {
      const id = ric(() => setStarted(true), { timeout: 2000 });
      return () => (window as unknown as { cancelIdleCallback?: (h: number) => void })
        .cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(() => setStarted(true), 400);
    return () => window.clearTimeout(t);
  }, [coldBootOrb.active]);

  const seconds = useAnimationSeconds({ fps: ORB_FPS, enabled: drawable && !reduced && started });
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

    let zeroWarned = false;

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
      if (!w || !h) {
        /* The early return is correct — there is nothing to size a buffer to.
           What was wrong for the whole of v6.1.8 is that it was SILENT: the
           canvas kept its 300x150 default, drawOrb painted into the wrong
           coordinate space, and no console, gate or exception said so. One
           warning, once per mount, on the same principle as useMemCanvas's
           MAX_DIM notice — nothing errors here, it just quietly stops being an
           orb. A zero box should be unreachable now that ORB_MIN_CANVAS_PX
           floors the wrap, so this firing means a host has defeated it.

           The `clientWidth || clientHeight` guard is what keeps this quiet on
           the ORDINARY zero box: off Home, and before the first rect resolves,
           this component renders `display:none`, where BOTH dimensions read 0
           and there is nothing wrong. Only a box that has one real dimension
           and one collapsed one — the actual defect — reaches the warning. */
        if (!zeroWarned && (canvas.clientWidth || canvas.clientHeight)) {
          zeroWarned = true;
          // eslint-disable-next-line no-console
          console.warn(
            `[Orb] canvas box is ${canvas.clientWidth}x${canvas.clientHeight} — one dimension is 0, so the ` +
            `backing store cannot be sized and the orb will not draw. The host box is likely shorter than ` +
            `the badge/caption overlay; see orb.ts#ORB_MIN_CANVAS_PX.`,
          );
        }
        return;
      }
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

  /* z-index is applied ONLY while the splash owns the rect, and that condition
     is the whole reason it is safe.

     `ColdBoot.tsx#ROOT_STYLE` is `position:fixed; inset:0; zIndex:COLDBOOT_Z`
     with an OPAQUE `#050505` background. This element is a `position:fixed`
     SIBLING of that root (mounted from App.tsx, deliberately not inside
     ColdBoot) at `z-index:auto`, so during the console phase it painted
     underneath an opaque full-viewport overlay — invisible no matter how
     correctly it was sized or drawn. Measured on 95316a3 at 1440x900:
     `document.elementFromPoint()` at the orb canvas's own centre returned a
     canvas inside `[data-coldboot]`, not the orb's; raising it to COLDBOOT_Z+1
     made the same probe return the orb's canvas.

     Off the splash (`active === false`, i.e. Home after the handoff settles)
     this stays `auto`. A permanent z-index above 1000 would float the orb over
     NavTop's dropdown and the ⌘ DESIGN panel on every Home visit, which is a
     bug traded for a bug — so the raise lives and dies with the splash. */
  /* ── THE TRAVEL IS A TRANSFORM, NOT A RE-LAYOUT ─────────────────────────
     ColdBoot re-lerps this rect every frame of the ENTER handoff. Writing that
     into left/top/width/height animates LAYOUT properties, and the browser
     scored it exactly as it should: measured CLS 0.0386-0.0402 across the
     handoff at 1440x900, with `HTML>BODY>DIV#root>DIV` — this element — as the
     dominant source, against a repo ceiling of 0.005.

     So the box is pinned to whichever rect the travel STARTED from and every
     later frame is expressed as translate + scale off it. Transform-driven
     movement is composited and is excluded from layout-shift scoring by
     definition, so the hitch and the CLS go together.

     `base` re-anchors whenever the splash is not driving (active false), which
     is what stops Home inheriting a permanent transform after the handoff
     settles: at rest the base IS the current rect and the transform is
     identity. The canvas
     backing store is sized from clientWidth/clientHeight, which a transform
     does not change — so the orb scales as an image for the 1.2s of travel
     rather than re-sizing its buffer 70 times, and verify-orb's "backing store
     tracks its CSS box" still holds at both ends. */
  const baseRef = React.useRef<Rect | null>(null);
  if (effectiveRect && (!coldBootOrb.active || baseRef.current === null)) {
    baseRef.current = effectiveRect;
  }
  const base = baseRef.current;

  /* ── THE CLIP A `position: fixed` ELEMENT CANNOT INHERIT ─────────────────
     `#hm-orb` is in-flow inside a scrolling column; this element is fixed, so
     that column's `overflow-y: auto` does not clip it. Once the box scrolls
     above the column's top edge the orb keeps painting into the band above it,
     and `.topbar` there is `background: rgba(0,0,0,0)` with no backdrop filter
     — fully transparent, not translucent — so the globe reads straight through
     the nav. Measured at 1440x900: a 61px band, 13% of a 468px orb; at 769x900,
     23.7% of a 257px orb. It is CAPPED at the bar's own height and does not
     grow with scroll (61.0px at scroll 200 and 400; 16.5px at 600), because
     everything above y=0 paints nowhere.

     At <=768 this cannot happen: the document scrolls, the bar goes with it,
     and the measured overlap is 0.0px at every depth. So the clip below is not
     a new behaviour — it is what the phone layout already gets for free, given
     to the desktop one.

     TWO CONDITIONS, both load-bearing:
       · `clip` is null unless an ancestor genuinely clips overflow, so <=768
         emits no `clip-path` property at all.
       · it applies ONLY when Home's own box is the source. While the splash
         owns the orb it is a viewport-fixed traveller and `main.main` still
         exists underneath — clipping to a column that is not scrolling it would
         crop the console orb, regressing the surface v6.1.9/v6.1.10 fixed.

     `inset()` resolves against this element's own border box, and on Home the
     transform is identity by construction (`base` re-anchors every render off
     the splash), so the four insets are a straight subtraction. */
  const clipRect = useHome && homeBox && homeRect ? homeBox.clip : null;
  const clipPath = clipRect && base
    ? `inset(${Math.max(0, clipRect.y - base.y).toFixed(2)}px ` +
      `${Math.max(0, (base.x + base.w) - (clipRect.x + clipRect.w)).toFixed(2)}px ` +
      `${Math.max(0, (base.y + base.h) - (clipRect.y + clipRect.h)).toFixed(2)}px ` +
      `${Math.max(0, clipRect.x - base.x).toFixed(2)}px)`
    : undefined;

  const positionStyle: React.CSSProperties = effectiveRect && base
    ? {
        position: "fixed",
        left: base.x,
        top: base.y,
        width: base.w,
        height: base.h,
        ...(clipPath ? { clipPath } : null),
        transform:
          `translate(${(effectiveRect.x - base.x).toFixed(2)}px, ${(effectiveRect.y - base.y).toFixed(2)}px)` +
          ` scale(${(effectiveRect.w / base.w).toFixed(4)}, ${(effectiveRect.h / base.h).toFixed(4)})`,
        transformOrigin: "top left",
        ...(coldBootOrb.active ? { zIndex: COLDBOOT_Z + 1, willChange: "transform" } : null),
      }
    : HIDDEN_STYLE;

  return (
    <div data-orb style={{ ...BASE_STYLE, ...positionStyle }}>
      <div style={{ ...CANVAS_WRAP_STYLE, ...assembleStyle }}>
        <canvas ref={canvasRef} style={CANVAS_STYLE} aria-hidden="true" />
      </div>
      <div style={{ ...OVERLAY_STYLE, ...overlayAssembleStyle }}>
        <div style={BADGE_ROW_STYLE}>
          <NodeProvenance source="network" phase={orbData.phase} detail="monero.fail" compact />
        </div>
        <p style={CAPTION_STYLE}>{reachableCaption(orbData.reachable, orbData.latticeSize)}</p>
        <div style={BADGE_ROW_STYLE}>
          {/* TWO badges, and they answer different questions.
              `source="model"` is WHERE the value came from — this repo's
              provenance vocabulary is exactly five and adding a sixth would
              break the two Record<ProvSource,…> exhaustiveness maps that are
              the only thing enforcing it. No `fresh` prop, so it defaults to
              "none" and can never carry a live dot.
              The literal ILLUSTRATIVE tag is WHAT KIND OF CLAIM this is, and
              §5 requires it by name: "Dandelion++ layer carries an
              ILLUSTRATIVE badge". A reader should not have to know that MODEL
              means invented to understand that this path is. Provenance and
              epistemic status are different axes; collapsing them into one
              badge made the surface depend on vocabulary knowledge the
              visitor does not have. */}
          <span style={ILLUSTRATIVE_BADGE_STYLE}>ILLUSTRATIVE</span>
          <Provenance source="model" detail="Dandelion++ stem — not observable from a node" compact />
        </div>
        <p style={CAPTION_STYLE}>{STEM_CAPTION}</p>
      </div>
    </div>
  );
}
