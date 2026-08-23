/**
 * mempool/useLadderAnchor.ts — p4·M8 · land the block ladder on the NOW divider.
 *
 * The classic block ladder is the ONE element the phone composition still lets
 * scroll horizontally (see styles.css's p4·M8 block). It opened at
 * `scrollLeft = 0`, which on this ribbon is the `~QUEUED` card — the leftmost
 * slot, carrying an em-dash for its tx count and no reading at all. The two
 * cards a reader actually wants are the ones either side of NOW: the block just
 * mined, and the block being built.
 *
 * MEASURED before this hook, at 390×844: the ladder is 1,611px of content in a
 * 286px box and `scrollLeft` was 0 on load — so a phone opened showing the least
 * informative 18% of the ladder, and the tip was 1.3 screens to the right.
 *
 * ── WHY IT IS A ONE-SHOT ──────────────────────────────────────────────────
 * It anchors on FIRST layout only, keyed on nothing. Re-anchoring when the tip
 * advances would yank the ladder out from under a reader who had scrolled to
 * look at an older block — the ribbon re-renders every time a block lands
 * (`useRibbonGlide`'s whole purpose), so a tip-keyed effect would fire roughly
 * every two minutes. A reader's scroll position is theirs once they have one.
 *
 * ── WHY IT IS INSTANT AT EVERY MOTION PREFERENCE ──────────────────────────
 * It assigns `scrollLeft` directly rather than calling `scrollIntoView({
 * behavior: "smooth" })`. Placing a scroller at its initial offset is not
 * animation — there is no "before" the reader saw — so there is no motion to
 * suppress and the reduced-motion path and the default path are ONE path. A
 * smooth variant would also race the ladder's own FLIP glide, which mutates
 * `transform` on the same children in a `useLayoutEffect`.
 *
 * ── WHY IT COMPOSES A REF RATHER THAN OWNING ONE ──────────────────────────
 * `useRibbonGlide` already owns the container ref and needs it attached from the
 * first commit. Two hooks cannot both be `ref=`. This takes the glide's ref
 * object and returns a CALLBACK ref that writes through to it — so the glide is
 * unaffected, and the anchor runs when the node actually attaches rather than
 * on a ref object whose identity never changes (the `useChartMetrics` defect
 * CLAUDE.md records: an effect keyed on a ref object runs once, before the node
 * exists, and never again).
 */

import * as React from "react";

/** How far into the viewport the divider should land, as a fraction of the
 *  scroller's width. 0.5 centres it. The brief asks for the middle third, so
 *  the assertion is `1/3 <= x <= 2/3`; centring sits in the middle of that band
 *  rather than on its edge, which is what leaves room for the tile widths on
 *  either side to vary with the fee/size strings they carry. */
const ANCHOR_FRAC = 0.5;

export function useLadderAnchor(
  glideRef: React.MutableRefObject<HTMLDivElement | null>,
): (node: HTMLDivElement | null) => void {
  const done = React.useRef(false);

  return React.useCallback(
    (node: HTMLDivElement | null) => {
      // Write through to the glide's ref FIRST and unconditionally — including
      // the `null` React passes on unmount, which is what stops the glide from
      // holding a detached node.
      glideRef.current = node;
      if (!node || done.current) return;

      const anchor = () => {
        // Nothing to do when the ladder fits: a scroller with no overflow has
        // one valid position and assigning to it is a no-op that would still
        // burn the one-shot. Leaving `done` false means a later width change
        // that DOES make it overflow still gets anchored.
        if (node.scrollWidth <= node.clientWidth + 1) return false;
        const divider = node.querySelector<HTMLElement>("[data-now-divider]");
        if (!divider) return false;
        // offsetLeft is relative to the offsetParent, so measure through the
        // rects instead — the divider's left edge in the scroller's own
        // content coordinates is (divider.left - node.left) + node.scrollLeft.
        const nb = node.getBoundingClientRect();
        const db = divider.getBoundingClientRect();
        const contentX = db.left - nb.left + node.scrollLeft + db.width / 2;
        const target = contentX - node.clientWidth * ANCHOR_FRAC;
        const max = node.scrollWidth - node.clientWidth;
        node.scrollLeft = Math.max(0, Math.min(max, target));
        return true;
      };

      // The tiles are plain DOM and laid out synchronously, but the ribbon's
      // widths depend on font metrics, so measure after a frame rather than in
      // the same tick as the attach. Two attempts: one now, one next frame.
      if (anchor()) { done.current = true; return; }
      requestAnimationFrame(() => { if (!done.current && anchor()) done.current = true; });
    },
    [glideRef],
  );
}
