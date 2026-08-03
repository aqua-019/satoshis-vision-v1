/**
 * routes/useRouteChrome.ts — D0726 + the focus half of D0744. Everything that
 * has to happen to the page CHROME on a navigation: where the scroll goes, and
 * where the keyboard goes.
 *
 * Called once from layout/AppShell.tsx, which every routed page renders.
 *
 * ─── WHY THE OLD `window.scrollTo(0, 0)` NEVER WORKED ───────────────────────
 * EducationPage and MoneroPage each ran `window.scrollTo(0, 0)` on tab change.
 * Above 768px that is a NO-OP on every desktop: `.art { height: 100vh;
 * overflow: hidden }` (styles.css:386) means the DOCUMENT never scrolls at
 * all — `main.main` (styles.css:522) is the scroller. Those calls only did
 * anything below 768px, where styles.css's phone layer flips `.main` to
 * `overflow: visible` and hands scrolling back to the document. Both are
 * deleted; this hook subsumes them and handles BOTH scrollers.
 *
 * ─── THE THREE TARGETS ──────────────────────────────────────────────────────
 * In order: `document.scrollingElement` (the phone layer's scroller),
 * `main.main` (the desktop scroller), `.mp-canvas-scroll` (the mempool pan
 * box, which is a third, independent scroller on /mempool). All three are
 * read and written on every save/restore; a target that is absent on the
 * current route is skipped, not treated as zero.
 *
 * ─── WHY THE SAVED POSITIONS ARE IN MEMORY ──────────────────────────────────
 * A module-level Map keyed on `useLocation().key` — NOT sessionStorage. Two
 * reasons:
 *   1. Privacy. Writing a per-history-entry record of which URLs a visitor
 *      opened, and how far down each one they read, to disk is not something
 *      a Monero site should do for a convenience feature. This site is used
 *      over Tor.
 *   2. It would not even work. `main.main` and `.mp-canvas-scroll` are
 *      recreated from scratch on reload, so a persisted offset could not be
 *      restored into the element it was measured on; only the document
 *      scroller survives, and the browser already restores that one itself.
 * The trade is explicit: positions live for the session, and a reload starts
 * clean. `history.scrollRestoration = "manual"` is set (guarded) so the
 * browser does not race this hook for the document scroller.
 *
 * ─── PRECEDENCE, IN ORDER ───────────────────────────────────────────────────
 *   1. A saved position exists for this location.key  → restore it.
 *      (This is Back/Forward. The key is per history ENTRY, so returning to
 *      an entry restores that entry's own offset.)
 *   2. Otherwise, location.hash is present            → do nothing.
 *      SourcesPage.tsx owns that case with its own scrollIntoView; scrolling
 *      to top first would fight it, visibly.
 *   3. Otherwise, the pathname changed                → every target to 0.
 *      This is the new-page case, and the replacement for the two dead
 *      window.scrollTo calls.
 *   4. Otherwise (search-only change)                 → leave the scroll alone.
 *      MempoolPage's clearFocus drops `?block` while you are reading a block
 *      panel, and a Markets range change rewrites `?range`; yanking either
 *      back to the top would be jarring and destroys the user's place.
 *
 * ─── WHY RESTORE IS A LAYOUT EFFECT ─────────────────────────────────────────
 * `useLayoutEffect`, not `useEffect`, keyed on `location.key`. Navigation runs
 * through design/useViewTransitionNavigate.ts, which calls
 * `startVt(..., () => flushSync(() => navigate(to)))`. `flushSync` drains
 * layout effects synchronously, INSIDE the view-transition callback, so the
 * browser captures its "after" snapshot with the scroll already corrected. A
 * passive effect would land after the snapshot and the transition would
 * animate to the wrong offset and then jump.
 *
 * ─── WHY SAVING IS ONE CAPTURING DOCUMENT LISTENER ──────────────────────────
 * `scroll` does not bubble, but it does CAPTURE: a capture-phase listener on
 * `document` sees scroll events from `main.main` and `.mp-canvas-scroll` as
 * they propagate down. One listener therefore covers all three targets and
 * survives any future fourth scroller without being edited. It is `passive`
 * (it never preventDefaults) and rAF-coalesced: the handler does the cheap
 * synchronous reads immediately — reading scrollTop during a scroll event
 * forces no layout — and only the Map write is deferred to the next frame.
 * Reading synchronously is what makes the cleanup flush correct: React runs a
 * passive cleanup AFTER the next page's DOM is already in place, so a cleanup
 * that read the DOM would read the NEW page's zeros and store them under the
 * OLD key.
 */

import * as React from "react";
import { useLocation } from "react-router-dom";

/** [document.scrollingElement, main.main, .mp-canvas-scroll] */
type Snap = [number, number, number];

/** location.key → the offsets of all three scrollers at that history entry.
 *  Capped: a `replace` navigation mints a fresh key while retiring the entry
 *  the old key described, so a long session on /markets (whose `?range=`
 *  writes are REPLACE — see routes/useUrlState.ts) would otherwise accumulate
 *  dead keys forever. Map preserves insertion order, so the oldest goes. */
const positions = new Map<string, Snap>();
const MAX_POSITIONS = 200;

/** The pathname of the last location this hook processed. Module scope, NOT a
 *  ref: AppShell is rendered *inside* each page, so it remounts on a route
 *  change and any ref would be reinitialised on exactly the transition we
 *  need to compare across. */
let lastPathname: string | null = null;

/** `null` until the first navigation completes — the initial page load must
 *  not steal focus, and must not be mistaken for a route change. */
let focusedPathname: string | null = null;

/** Suppression window for the save listener, in `performance.now()` ms. A
 *  programmatic `scrollTop =` fires a real scroll event; without this, the
 *  restore would immediately overwrite the very position it just restored
 *  (and the reset-to-0 case would overwrite the OUTGOING entry's saved
 *  offset with 0, which is the bug that makes Back feel broken). */
let saveBlockedUntil = 0;

/** Frames the restore keeps re-applying. A route whose content is still
 *  arriving (a lazy view chunk, a first data payload) may not yet be tall
 *  enough for the saved offset, in which case the browser clamps it. ~200ms. */
const RESTORE_FRAMES = 12;

/** Grace after the last programmatic write, so its own scroll event — which
 *  is dispatched on the next frame — is still swallowed. */
const SAVE_GRACE_MS = 48;

let scrollRestorationPinned = false;

/** `useLayoutEffect` warns under renderToString (scripts/prerender.mjs runs
 *  the app on the server to emit the no-JS HTML). There is no layout to
 *  measure there and nothing to scroll, so the server takes the passive
 *  variant — which React also never runs — purely to keep the prerender log
 *  clean. The browser always gets the layout effect. */
const useIsoLayoutEffect = typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

function scrollTargets(): (Element | null)[] {
  if (typeof document === "undefined") return [null, null, null];
  return [
    document.scrollingElement,
    document.querySelector("main.main"),
    document.querySelector(".mp-canvas-scroll"),
  ];
}

function readSnap(): Snap {
  const t = scrollTargets();
  return [t[0] ? t[0].scrollTop : 0, t[1] ? t[1].scrollTop : 0, t[2] ? t[2].scrollTop : 0];
}

function applySnap(snap: Snap): void {
  const t = scrollTargets();
  for (let i = 0; i < t.length; i++) {
    const el = t[i];
    if (!el) continue;
    if (el.scrollTop !== snap[i]) el.scrollTop = snap[i];
  }
}

/** Every present target within 1px of its target offset. A missing target is
 *  vacuously satisfied — it cannot be scrolled and is not evidence of failure. */
function snapReached(snap: Snap): boolean {
  const t = scrollTargets();
  for (let i = 0; i < t.length; i++) {
    const el = t[i];
    if (!el) continue;
    if (Math.abs(el.scrollTop - snap[i]) > 1) return false;
  }
  return true;
}

/** Apply `snap`, then keep re-applying for up to RESTORE_FRAMES frames or
 *  until it sticks. Returns a canceller for the effect cleanup. */
function restoreSnap(snap: Snap): () => void {
  saveBlockedUntil = performance.now() + 1000;
  applySnap(snap);

  let cancelled = false;
  let raf = 0;
  let frames = 0;

  const release = (): void => {
    saveBlockedUntil = performance.now() + SAVE_GRACE_MS;
  };

  const tick = (): void => {
    if (cancelled) return;
    if (snapReached(snap) || ++frames >= RESTORE_FRAMES) {
      release();
      return;
    }
    applySnap(snap);
    // D0699-EXEMPT: bounded restore loop, stops at snapReached or RESTORE_FRAMES
    raf = requestAnimationFrame(tick);
  };
  // D0699-EXEMPT: kicks off the bounded restore loop above; cancelled on cleanup
  raf = requestAnimationFrame(tick);

  return () => {
    cancelled = true;
    if (raf) cancelAnimationFrame(raf);
    release();
  };
}

/**
 * Per-navigation chrome. Call once, from AppShell.
 *
 * Test seam: `window.__XMR_NAV_DEBUG__` is populated with the last decision
 * this hook made ("restore" | "hash" | "top" | "keep") so verify-nav.mjs can
 * assert the PRECEDENCE, not just its visible side effect.
 */
export function useRouteChrome(): void {
  const location = useLocation();
  const key = location.key;

  // ── history.scrollRestoration, once per document ────────────────────────
  React.useEffect(() => {
    if (scrollRestorationPinned) return;
    if (typeof window === "undefined" || !window.history) return;
    if (!("scrollRestoration" in window.history)) return;
    try {
      window.history.scrollRestoration = "manual";
      scrollRestorationPinned = true;
    } catch {
      /* Some privacy modes throw on this setter. Browser-managed restoration
         is a worse experience, not a broken one — degrade and carry on. */
    }
  }, []);

  // ── restore / reset, synchronously, before the VT snapshot ──────────────
  useIsoLayoutEffect(() => {
    const saved = positions.get(key);
    let decision: string;
    let cancel: (() => void) | undefined;

    if (saved) {
      decision = "restore";
      cancel = restoreSnap(saved);
    } else if (location.hash) {
      // (2) SourcesPage.tsx:57-62 owns the anchor scroll. Stay out of its way.
      decision = "hash";
    } else if (lastPathname !== location.pathname) {
      decision = "top";
      cancel = restoreSnap([0, 0, 0]);
    } else {
      // (4) search-only change on the same path.
      decision = "keep";
    }

    lastPathname = location.pathname;
    if (typeof window !== "undefined") {
      (window as unknown as { __XMR_NAV_DEBUG__?: unknown }).__XMR_NAV_DEBUG__ = {
        decision,
        key,
        pathname: location.pathname,
        search: location.search,
      };
    }

    return cancel;
  }, [key, location.hash, location.pathname, location.search]);

  // ── save, one capturing document listener, rAF-coalesced ────────────────
  React.useEffect(() => {
    let raf = 0;
    let pending: Snap | null = null;

    const commit = (): void => {
      raf = 0;
      if (pending) {
        positions.set(key, pending);
        pending = null;
        while (positions.size > MAX_POSITIONS) {
          const oldest = positions.keys().next();
          if (oldest.done) break;
          positions.delete(oldest.value);
        }
      }
    };
    const onScroll = (): void => {
      if (performance.now() < saveBlockedUntil) return;
      pending = readSnap();
      // D0699-EXEMPT: rAF-coalesced scroll save, one frame per burst
      if (!raf) raf = requestAnimationFrame(commit);
    };

    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener("scroll", onScroll, true);
      // Flush whatever the last scroll event read, under the key it belongs
      // to. `pending` was read synchronously at scroll time, so this is
      // correct even though the DOM has already moved on.
      if (raf) cancelAnimationFrame(raf);
      commit();
    };
  }, [key]);

  // ── focus, after paint ──────────────────────────────────────────────────
  // Only on a PATHNAME change. A `?v=`/`?p=`/`?range=` change is driven by a
  // control inside the page — pulling focus out of the control you just
  // clicked and dumping it on <main> would be hostile, and the content it
  // labels has not changed identity. The first page load is skipped too: the
  // browser announces that one itself, and a page that steals focus on load
  // breaks "start reading from the top".
  React.useEffect(() => {
    const path = location.pathname;
    if (focusedPathname === null) {
      focusedPathname = path;
      return;
    }
    if (focusedPathname === path) return;
    focusedPathname = path;

    const main = document.getElementById("main");
    if (!main) return;
    // preventScroll: the scroll position was already decided above, and
    // focus() would otherwise scroll <main> back into view and undo a restore.
    main.focus({ preventScroll: true });
  }, [location.pathname]);
}
