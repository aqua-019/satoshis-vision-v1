/**
 * nav/usePaletteHotkey.ts — the ⌘K palette's EAGER half.
 *
 * This hook, and only this hook, is imported un-lazily by layout/NavTop.tsx.
 * Everything else the palette needs — the search UI, the destination list,
 * the fuzzy scorer's call sites — lives in the `React.lazy`-loaded
 * nav/CommandPalette.tsx and is not downloaded until `open` first becomes
 * true. That split is the whole reason this file exists as its own module
 * rather than as a few lines inside CommandPalette.tsx: something has to be
 * listening for ⌘K *before* the palette's code has ever been fetched, and
 * that something has to be small.
 *
 * ── WHAT THIS HOOK OWNS, AND WHAT IT DELIBERATELY DOES NOT ─────────────────
 * Owns: the `open` boolean, and the ⌘K / Ctrl+K global toggle that flips it.
 * That is the one piece of behaviour that must exist before CommandPalette
 * has ever mounted.
 *
 * Does NOT own: Escape-to-close, focus trap, or focus capture/restore.
 * CommandPalette wraps its content in pages/future/V6Modal.tsx — "every
 * future dialog should build on it" per that file's own header — and
 * V6Modal already registers a `document`-level Escape/Tab handler the
 * moment `open` is true. Re-implementing Escape here, ahead of the palette
 * ever being mounted, would just be a second listener racing the first one
 * to call the same `onClose`; simpler to let V6Modal own the one that
 * actually needs the search-results/rendered-DOM context it has and this
 * hook does not.
 *
 * Does NOT own: Arrow-key result navigation or Enter-to-activate. Those
 * need the live, filtered results list (`rankDestinations` output), which
 * only exists once CommandPalette has mounted and is holding the query
 * state — there is nothing for an eager, pre-mount hook to operate on.
 * CommandPalette.tsx's own `<input>`/row keydown handlers own that piece.
 *
 * ── THIS IS THE APP'S FIRST ALWAYS-ON WINDOW KEYDOWN LISTENER ──────────────
 * Every other global-ish keydown listener in this app (NavTop's dropdown,
 * design/DesignPanel.tsx's popover, the mempool view switcher) is gated on
 * an "am I open" flag before it ever attaches — none of them listen while
 * closed. This one has to, because ⌘K is how the palette gets its FIRST
 * open. Two guards keep that safe:
 *
 *   1. It never opens a second dialog on top of one already showing —
 *      checked via `document.querySelector('[role="dialog"]')` at the
 *      moment of an OPEN attempt only (not on close: closing an
 *      already-open palette must always be allowed, and by the time it is
 *      open ITS OWN root is the dialog the query would find, so gating the
 *      close path on the same check would make the palette unable to close
 *      itself).
 *   2. It does not fire while the user is typing into some OTHER text
 *      input/textarea/contenteditable on the page — UNLESS the palette is
 *      already open, in which case that "other" field is almost certainly
 *      the palette's own search box, and ⌘K must still be able to close it.
 */

import * as React from "react";

export interface PaletteHotkey {
  open: boolean;
  /** Imperative setter — CommandPalette calls this with `false` from its
   *  own close paths (backdrop click, the ✕ affordance, a completed
   *  navigation/action) so there is exactly one source of truth for `open`. */
  setOpen: (v: boolean) => void;
}

function isEditableElement(el: Element | null): el is HTMLElement {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || (el as HTMLElement).isContentEditable === true;
}

export function usePaletteHotkey(): PaletteHotkey {
  const [open, setOpenState] = React.useState(false);

  // The listener below is registered ONCE (empty deps — see the file header:
  // it must be always-on). A ref mirrors `open` so that single, long-lived
  // closure always reads the CURRENT value rather than the one captured at
  // mount.
  const openRef = React.useRef(open);
  React.useEffect(() => {
    openRef.current = open;
  }, [open]);

  const setOpen = React.useCallback((v: boolean) => setOpenState(v), []);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Case-insensitive: `e.key` is "k" or "K" depending on Shift; the
      // combo is defined by the modifier, not by shift-case.
      if (e.key.toLowerCase() !== "k" || (!e.metaKey && !e.ctrlKey)) return;

      if (isEditableElement(document.activeElement) && !openRef.current) {
        // Some OTHER field on the page has focus and the palette is not
        // open yet — leave it alone rather than hijacking what the user is
        // typing. (If the palette IS already open, `document.activeElement`
        // is its own search input, and this branch must not block the
        // close-toggle below.)
        return;
      }

      e.preventDefault();

      if (openRef.current) {
        setOpenState(false);
        return;
      }
      if (document.querySelector('[role="dialog"]')) {
        // Another dialog (a FuturePage protocol brief, a trusted-peer card,
        // ...) is already open. Do not stack a second one on top of it.
        return;
      }
      setOpenState(true);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return { open, setOpen };
}
