/**
 * ChromeStatus.tsx — the offline badge and the degraded-mode banner.
 *
 * D0870 / D0888.
 *
 * ── PRECEDENCE, DECIDED ONCE ───────────────────────────────────────────────
 * Offline outranks everything. #152 established that ordering in
 * `useChromeState` (`if (!online) return "offline"`) and this honours it: when
 * the browser is offline we say so and say NOTHING ELSE. A "the node cascade is
 * degraded" banner shown to someone whose wifi dropped is a false accusation
 * against the node operators, and it buries the one fact the reader can act on.
 *
 * ── WHY THIS IS THE ONLY NEW `feedDegraded` CONSUMER ───────────────────────
 * `feedDegraded` is the deliberate pair-AND GLOBAL:
 *   (mempool && fees) || (network && blocks)
 * A page-wide banner is exactly the claim that global expresses, which is why
 * it is the right — and only — new caller.
 *
 * It already had two legitimate call sites before this: `feed-status.ts`'s own
 * `chromePhase`, and `useFeedEvents.ts:42` (which `verify-effects.mjs:88` pins
 * VERBATIM by regex, so that line must not be refactored). The real standing
 * rule is narrower than "only here" and it is already mechanised elsewhere:
 * `provenance.tsx` must NEVER call it (`verify-provenance.mjs:304`), because a
 * panel keyed on `mempool` alone has to go stale when `mempool` alone fails.
 * That per-endpoint claim is what PR C shipped and this banner must not blur.
 *
 * ── LAYOUT: ANCHORED TO `.shell`, NOT TO THE TOPBAR ────────────────────────
 * The banner is `position: absolute` inside `.shell`, which is given
 * `position: relative` (one line in styles.css).
 *
 * `.shell`'s top edge IS the topbar's bottom edge, by construction — `.topbar`
 * is in normal flow and `.shell` is the next flex child of `.art-stage`. So the
 * offset needs no constant, and it stays correct across all three of the
 * topbar's current heights (desktop grid; <=768px flex plus
 * env(safe-area-inset-top); the narrow two-row wrap), through the notch inset,
 * and through prompt 07's nav rewrite. A `top: <number>` would be wrong in at
 * least one of those today — see `.mp-switcher`'s hardcoded `top: 60px`, which
 * already is.
 *
 * Out of flow means ZERO CLS by construction, which matters more than usual
 * here: `verify-cls` loads with no route mocking, and `serve-dist` answers
 * /api/xmr/* with 200 text/html, so res.json() throws, failures accumulate, and
 * feedDegraded can genuinely go true INSIDE the 3s measurement window. An
 * in-flow banner (~32px at 844px viewport) would be a distance fraction of
 * ~0.038 at impact fraction ~1.0 — about 4x the gate ceiling and 40x the
 * measured baseline.
 *
 * It spans the rail column as well as `main`, deliberately: the claim is global,
 * so scoping it to the content column would understate it.
 *
 * ── REDUCED MOTION: IT APPEARS, IT DOES NOT SLIDE ──────────────────────────
 * No transform, no slide, ever — for anyone. A banner that animates in moves
 * content perceptually even when it does not move it in layout. The only
 * transition is opacity via var(--d-2), which reduce zeroes to a hard cut.
 */

import * as React from "react";
import { useMoneroLive } from "../data/DataContext";
import { useOnline } from "./useOnline";
import { feedDegraded, isDegraded, FEED_ENDPOINT, type FeedKey } from "../data/feed-status";

/** The endpoints feedDegraded actually considers — its two pairs, in order. */
const PAIRED: readonly FeedKey[] = ["mempool", "fees", "network", "blocks"];

/**
 * Name the endpoints that are actually failing, rather than saying "the feed".
 * Same discipline as `chromeDetail`: a reader who can see which path is down
 * can tell a node outage from their own network.
 */
function failingPaths(status: Parameters<typeof feedDegraded>[0]): string {
  const down = PAIRED.filter((k) => isDegraded(status[k])).map((k) => FEED_ENDPOINT[k]);
  return down.join(" · ");
}

export function ChromeStatus() {
  const data = useMoneroLive();
  const online = useOnline();

  // Offline outranks. Not `||` in one expression — the two branches say
  // different things and must not be able to render together.
  const offline = !online;
  const degraded = !offline && feedDegraded(data.status);
  const shown = offline || degraded;

  // scroll-padding-top on the REAL scroller. `main.main` is overflow-y:auto and
  // window never scrolls above 768px, so `html { scroll-padding }` would be a
  // no-op on every desktop — the same trap that made window.scrollTo(0,0) a
  // no-op before v6.1.3. Applied only while the banner is up, and cleared after,
  // so an anchor target never lands underneath it.
  React.useEffect(() => {
    const scroller = document.querySelector<HTMLElement>("main.main");
    if (!scroller) return;
    if (!shown) {
      scroller.style.removeProperty("scroll-padding-top");
      return;
    }
    scroller.style.scrollPaddingTop = "var(--degraded-h, 44px)";
    return () => {
      scroller.style.removeProperty("scroll-padding-top");
    };
  }, [shown]);

  if (!shown) return null;

  return (
    <div
      className="degraded-banner"
      data-kind={offline ? "offline" : "degraded"}
      role="status"
      aria-live="polite"
    >
      {offline ? (
        <span>
          <b>OFFLINE</b> — no network connection. Nothing was requested, so no
          reading on this page is being refreshed.
        </span>
      ) : (
        <span>
          <b>DEGRADED</b> — <span className="degraded-banner__paths">{failingPaths(data.status)}</span>{" "}
          are not answering. Every figure below is the last good value, labelled
          where it came from, and polling continues.
        </span>
      )}
    </div>
  );
}
