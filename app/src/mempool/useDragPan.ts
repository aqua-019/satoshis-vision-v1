// mempool/useDragPan.ts — click-and-drag panning for the mempool canvas (P4).
//
// The mempool views scroll horizontally (and sometimes vertically) inside one
// `.mp-canvas-scroll` container whose scrollbar is hidden (see styles.css). This
// hook lets the user grab the canvas and drag it, the way a map pans, instead of
// hunting for the bar. Wheel / trackpad scrolling is untouched (we never handle
// `wheel`), and clicks still work: panning only engages after the pointer moves
// past a small threshold, so a tap on a block or tx row fires its onClick as
// normal. Form fields and explicit opt-outs (`[data-no-drag]`) keep native
// behaviour. The motion is a 1:1 scroll offset with no momentum/easing, so there
// is nothing for prefers-reduced-motion to disable.
//
// Usage: const ref = useDragPan(); <div className="mp-canvas-scroll" ref={ref}>…

import * as React from "react";

// Start a click, not a drag, inside these — let native selection/typing work.
const NO_DRAG = "input, textarea, select, [contenteditable], [data-no-drag]";
// Pointer travel (px) before a press becomes a pan rather than a click.
const THRESHOLD = 5;

export function useDragPan<T extends HTMLElement = HTMLDivElement>() {
  const ref = React.useRef<T | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let panning = false; // past the threshold → actively panning
    let pid = -1;
    let startX = 0, startY = 0, startLeft = 0, startTop = 0;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return; // primary button only
      const t = e.target as HTMLElement | null;
      if (t && t.closest(NO_DRAG)) return;
      pid = e.pointerId;
      startX = e.clientX; startY = e.clientY;
      startLeft = el.scrollLeft; startTop = el.scrollTop;
      panning = false;
    };

    const onMove = (e: PointerEvent) => {
      if (pid === -1 || e.pointerId !== pid) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!panning) {
        if (Math.abs(dx) < THRESHOLD && Math.abs(dy) < THRESHOLD) return; // still a click
        panning = true;
        el.classList.add("is-grabbing");
        try { el.setPointerCapture(pid); } catch { /* capture is best-effort */ }
      }
      el.scrollLeft = startLeft - dx;
      el.scrollTop = startTop - dy;
    };

    const release = (e: PointerEvent) => {
      if (pid !== -1 && e.pointerId !== pid) return;
      if (panning) { try { el.releasePointerCapture(pid); } catch { /* ignore */ } }
      el.classList.remove("is-grabbing");
      panning = false;
      pid = -1;
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", release);
    el.addEventListener("pointercancel", release);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", release);
      el.removeEventListener("pointercancel", release);
    };
  }, []);

  return ref;
}
