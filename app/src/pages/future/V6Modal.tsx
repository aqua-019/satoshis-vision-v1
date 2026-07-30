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
 */

import * as React from "react";
import ReactDOM from "react-dom";

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface V6ModalProps {
  open: boolean;
  onClose: () => void;
  labelledBy: string; // id of the <h2> that titles the dialog
  children: React.ReactNode;
}

export function V6Modal({ open, onClose, labelledBy, children }: V6ModalProps) {
  const boxRef = React.useRef<HTMLDivElement | null>(null);
  const priorFocusRef = React.useRef<HTMLElement | null>(null);

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

  if (!open) return null;

  return ReactDOM.createPortal(
    <div
      className="v6-modal-veil"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={boxRef}
        className="v6-modal"
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
