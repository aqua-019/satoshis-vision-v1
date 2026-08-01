/**
 * design/usePendingDelay.ts — D0697. A pending flag that ignores fast work.
 *
 * The problem it solves is perceptual, not technical: a spinner that appears
 * and vanishes inside ~100ms reads as a FLICKER, not as feedback. It makes a
 * fast interface look unstable, and it is strictly worse than showing nothing —
 * the user's eye is drawn to a change that carries no information by the time
 * they have looked at it. Almost every operation on this site is either an
 * already-cached read or a proxied fetch that returns in well under 100ms, so
 * naively binding a spinner to `isLoading` flickers on the common path and only
 * behaves on the rare slow one.
 *
 * So: stay false until the operation has been in flight past a threshold. Fast
 * operations complete before the timer fires and never show anything at all.
 *
 *   const showSpinner = usePendingDelay(isFetching);   // 100ms default
 *   {showSpinner ? <Skeleton /> : null}
 *
 * Deliberately NOT included, because both are different features that would
 * make this one lie about what it does:
 *
 *   · A MINIMUM display time. Once shown, this hook hides the moment the
 *     operation ends, which can itself flicker if the work finishes at 110ms.
 *     Pinning it open for a further N ms is a real technique, but it makes a
 *     fast operation SLOWER on purpose, and that is a product decision that
 *     should be taken per surface rather than smuggled into a shared hook.
 *   · Progress. This answers "is it worth telling the user yet", not "how far
 *     along is it".
 *
 * SSR-safe: no timer is armed until an effect runs, so it renders `false` under
 * renderToString and the prerendered HTML never contains a loading state. That
 * matters concretely here — scripts/prerender.mjs FAILS any route whose emitted
 * HTML matches /loading[….]/.
 *
 * ── WHERE THIS SHOULD BE ADOPTED ───────────────────────────────────────────
 * Listed rather than done: those files belong to other owners in this change,
 * and every one of them needs a judgement call this hook cannot make for it.
 * Verified present in the tree at the time of writing, not guessed:
 *
 *   src/mempool/tx-detail.tsx:99,138,330 — `status === "loading"` branches.
 *     The strongest candidates in the app. A tx already in the feed resolves
 *     from memory, so the skeleton at :99 renders and unmounts within one
 *     frame; :330's decoy panel is the same shape one level down.
 *   src/mempool/mempool-shared.tsx:51 — the "CONNECTING…" skeleton.
 *   src/layout/NavTop.tsx:86 · src/layout/Footer.tsx:15 ·
 *   src/pages/NetworkPage.tsx:152 · src/pages/HomePage.tsx:54 — the CONNECTING
 *     pills. These share one feed, so they flash TOGETHER on a warm
 *     localStorage cache (data/feedcache), which is the most visible instance
 *     of this defect on the site.
 *
 * The judgement call, in every case: this hook must gate the PENDING indicator
 * only, never the data. Wrapping a whole panel in it would replace a 90ms
 * spinner with a 90ms hole, which is the same flicker wearing different
 * clothes. And a distinction worth keeping: CONNECTING is a first-load state,
 * not a per-operation one, so a surface that shows it for two full seconds on a
 * cold node cascade is being honest — this hook exists for the warm path, where
 * that same pill appears for 40ms. It must never suppress the STALE ·
 * reconnecting degradation state, which is information, not chrome.
 */

import * as React from "react";

/** Below this, a spinner is a flicker rather than feedback. */
export const PENDING_DELAY_MS = 100;

/**
 * `true` only once `active` has been continuously true for `delayMs`.
 *
 * Resets immediately when `active` goes false, so a burst of quick operations
 * never accumulates its way into showing an indicator.
 */
export function usePendingDelay(active: boolean, delayMs: number = PENDING_DELAY_MS): boolean {
  const [shown, setShown] = React.useState(false);

  React.useEffect(() => {
    if (!active) {
      // Clear synchronously rather than on a timer: hiding is never the thing
      // that flickers, and a delayed hide would outlive the operation.
      setShown(false);
      return;
    }
    const id = setTimeout(() => setShown(true), delayMs);
    return () => clearTimeout(id);
  }, [active, delayMs]);

  return shown;
}
