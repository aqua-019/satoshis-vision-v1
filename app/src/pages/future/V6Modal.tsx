/**
 * pages/future/V6Modal.tsx — the FUTURE tab's dialog shell.
 *
 * Ported from the v6 future.jsx prototype's V6Modal, hardened for
 * accessibility: portal to document.body (`.art` is `overflow:hidden` +
 * `isolation:isolate` and `.main` is its own scroll container — a fixed
 * veil rendered inside that subtree is one `transform` away from breaking),
 * a real dialog role with focus capture/restore and a focus trap, Escape-
 * to-close registered on `document` (mirrors layout/NavTop.tsx), and a
 * two-target scroll lock (`document.body` always scrolls-locked; `main.main`
 * is the desktop scroll container but goes `overflow: visible` under the
 * site's mobile breakpoint, so both are locked and restored independently).
 *
 * No modal/dialog component exists anywhere else in app/src — this is new,
 * and every future dialog in the app should be able to build on it.
 *
 * D0666 — THE EXIT FRAME. This used to be `if (!open) return null`, which
 * gives a dialog no exit at all: it is in the DOM, then it is not. And
 * `open` was never even false, because both consumers UNMOUNTED <ProtoPopup>
 * / <EcoPopup> outright, so the prop's false branch was dead code.
 *
 * The fix is one piece of internal state, `present`, decoupled from `open`:
 *
 *   open true   → present true on the SAME render (no extra frame), and the
 *                 veil mounts already carrying `.is-open`, so styles.css's
 *                 @starting-style block supplies the first-frame style the
 *                 entrance transition needs.
 *   open false  → `.is-open` comes off (the exit transition starts) but the
 *                 node stays mounted for exactly as long as that transition
 *                 lasts, then unmounts.
 *
 * TWO THINGS THIS DELIBERATELY DOES NOT DO:
 *
 *  - It does not stay mounted when closed. verify-future.mjs:249 asserts
 *    ZERO [role="dialog"] on a page where nothing has been opened, which
 *    rules out the usual "always-mounted portal, toggle a class" shape. The
 *    dialog role must not exist when there is no dialog.
 *  - It does not hardcode the exit duration. The delay is READ from the
 *    element's own computed transition-duration, so styles.css stays the
 *    single source of truth and a reduced-motion reader (where --d-* are
 *    zeroed and the rules declare `transition: none`) measures 0 and
 *    unmounts on the next tick, with no motion and no artificial wait.
 *
 * CONSEQUENCE FOR GATES, and it is not optional: `role="dialog"` now
 * survives one exit's worth of frames past a close. Sampling visibility on
 * the line after `keyboard.press('Escape')` reads the dialog mid-exit and
 * fails. verify-future.mjs:495 did exactly that and was changed to
 * `waitFor({ state: 'hidden' })` — the idiom the same file already used
 * correctly at :308.
 */

import * as React from "react";
import ReactDOM from "react-dom";

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Longest (duration + delay) across an element's computed transition list,
 *  in ms. `transition-duration`/`transition-delay` are comma-separated lists
 *  whose entries pair up positionally, so the wait is the max of the SUMS,
 *  not the sum of the maxes. Returns 0 for `transition: none` (the computed
 *  duration list is then a single "0s"), which is what makes the
 *  reduced-motion path fall out of this with no branch. */
function exitDurationMs(el: Element): number {
  const cs = getComputedStyle(el);
  const secs = (v: string) => v.split(",").map((s) => parseFloat(s) || 0);
  const dur = secs(cs.transitionDuration);
  const del = secs(cs.transitionDelay);
  let max = 0;
  for (let i = 0; i < dur.length; i++) max = Math.max(max, dur[i] + (del[i % del.length] || 0));
  return max * 1000;
}

export interface V6ModalProps {
  open: boolean;
  onClose: () => void;
  labelledBy: string; // id of the <h2> that titles the dialog
  children: React.ReactNode;
  /** p4·M9b — an OPTIONAL geometry variant, added so the mobile section sheet
   *  could reuse every behaviour in this file (portal, trap, capture/restore,
   *  Escape, two-target scroll lock, the D0666 exit frame) without a second
   *  copy of any of it. When present it APPENDS `v6-modal--<variant>` to the
   *  box and `v6-modal-veil--<variant>` to the veil; both base classes stay,
   *  so `verify-discrete`'s bare `.v6-modal` / `.v6-modal-veil` queries and
   *  its `.v6-modal-veil.is-open` stylesheet assertion are untouched. Omitted
   *  by every pre-existing caller, which therefore renders byte-identically. */
  variant?: string;
}

export function V6Modal({ open, onClose, labelledBy, children, variant }: V6ModalProps) {
  const boxRef = React.useRef<HTMLDivElement | null>(null);
  const veilRef = React.useRef<HTMLDivElement | null>(null);
  const priorFocusRef = React.useRef<HTMLElement | null>(null);

  // `present` lags `open` on the way OUT only. Raising it during render (the
  // documented "adjust state when a prop changes" pattern) rather than in an
  // effect is what keeps opening instant: React discards this render pass and
  // re-runs the component before committing anything, so the very first
  // commit already contains the portal. An effect would cost a frame in which
  // the dialog does not exist, and @starting-style would then animate from a
  // style captured one frame late.
  const [present, setPresent] = React.useState(open);
  if (open && !present) setPresent(true);

  // Escape → close. Registered on document, matching NavTop.tsx's pattern.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const box = boxRef.current;
      if (!box) return;
      const focusable = Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !box.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !box.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Focus capture on open, restore on close/unmount.
  React.useEffect(() => {
    if (!open) return;
    priorFocusRef.current = document.activeElement as HTMLElement | null;
    boxRef.current?.focus();
    return () => {
      priorFocusRef.current?.focus();
    };
  }, [open]);

  // Scroll lock on document.body and main.main, saving/restoring each
  // previous inline overflow value exactly.
  React.useEffect(() => {
    if (!open) return;
    const main = document.querySelector<HTMLElement>("main.main");
    const prevBodyOverflow = document.body.style.overflow;
    const prevMainOverflow = main?.style.overflow ?? "";
    document.body.style.overflow = "hidden";
    if (main) main.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      if (main) main.style.overflow = prevMainOverflow;
    };
  }, [open]);

  // The exit itself. Runs only on the open → closed edge, after the commit
  // that removed `.is-open` — so the duration it measures is the CLOSED
  // rule's (the exit timing), not the open one's. The cleanup cancels the
  // timer, which is what makes re-opening mid-exit safe: `open` flips back to
  // true, this effect tears down, and the veil simply transitions back.
  React.useEffect(() => {
    if (open || !present) return;
    const veil = veilRef.current;
    const box = boxRef.current;
    const ms = Math.max(veil ? exitDurationMs(veil) : 0, box ? exitDurationMs(box) : 0);
    if (ms <= 0) {
      setPresent(false);
      return;
    }
    // +32ms ≈ two frames of slack. transitionend is deliberately NOT used as
    // the trigger: it does not fire for a zero-duration transition, it does
    // not fire for a property that was already at its target value, and it
    // bubbles from descendants — three ways to hang a dialog on screen
    // forever. A measured timeout has none of those failure modes.
    const t = window.setTimeout(() => setPresent(false), ms + 32);
    return () => window.clearTimeout(t);
  }, [open, present]);

  if (!present) return null;

  return ReactDOM.createPortal(
    <div
      ref={veilRef}
      className={
        "v6-modal-veil" + (variant ? ` v6-modal-veil--${variant}` : "") + (open ? " is-open" : "")
      }
      // Out of the a11y tree the moment it starts leaving. The node outlives
      // the close by design, but a screen reader should not be able to land
      // in a dialog that is on its way out. Focus has already been restored
      // to the opener by then (the focus effect's cleanup runs on the same
      // `open` edge), so this never hides a focused element.
      aria-hidden={open ? undefined : true}
      onClick={(e) => {
        // Ignore backdrop clicks while exiting: `onClose` would fire a second
        // time on a dialog the consumer has already closed.
        if (open && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={boxRef}
        className={"v6-modal" + (variant ? ` v6-modal--${variant}` : "")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
