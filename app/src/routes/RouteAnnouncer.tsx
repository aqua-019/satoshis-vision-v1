/**
 * routes/RouteAnnouncer.tsx — D0745. The one live region that tells a screen
 * reader a client-side navigation happened.
 *
 * ─── WHY IT IS MOUNTED WHERE IT IS ──────────────────────────────────────────
 * A live region created in the SAME commit as the text it is supposed to
 * announce is not reliably announced: assistive tech subscribes to mutations
 * of regions it already knows about, and a node that arrives with its content
 * already in place frequently reads as initial render rather than as an
 * update. So this component must be PERSISTENT across navigations — it is
 * mounted once in App.tsx as a sibling of <Suspense>, above <Routes>, and
 * never unmounts.
 *
 * That is also precisely why it cannot live in AppShell. AppShell is rendered
 * *inside* each page (below <Routes>), so it remounts on every route change —
 * a live region there would be destroyed and recreated on exactly the event it
 * exists to report.
 *
 * ─── WHY IT IS SILENT ON FIRST RENDER ───────────────────────────────────────
 * `msg` starts as "" and the first location is deliberately skipped. Two
 * reasons, both concrete:
 *   1. A first page load is announced by the browser itself. Announcing it
 *      again is noise.
 *   2. scripts/prerender.mjs:87 FAILS the build for any route whose emitted
 *      HTML matches /loading[….]/, and more generally the prerendered HTML is
 *      the no-JS document this site ships. An announcer that rendered prose
 *      under SSR would bake a stale "navigated to …" sentence into every
 *      static page. Empty on first render means renderToString emits the
 *      wrapper and nothing else.
 *
 * ─── WHAT IT SAYS, AND WHY IT IS NOT A DUPLICATE ────────────────────────────
 * The message names the route. The focus move that accompanies it (AppShell
 * sends focus to `<main id="main" tabIndex={-1} aria-labelledby="page-title">`)
 * says where you now are, in landmark terms. Those are different facts — "a
 * navigation completed" vs "you are in the main content of X" — and a screen
 * reader user needs both; only the second one survives if you skip the region,
 * and a focus move alone is easy to miss mid-utterance.
 *
 * ─── WHERE THE TEXT COMES FROM ──────────────────────────────────────────────
 * `#page-title` — the single <h1> D0744 guarantees on every route (nine pages
 * via PageHeader, HomePage and the education Journey inline, and an .sr-only
 * one on the four pages that legitimately render no visible heading). Reading
 * the DOM rather than keeping a route→label table here is deliberate: this
 * repo already carries FOUR hand-maintained copies of the route list
 * (scripts/routes.mjs, NavTop's NAV, RootBoundary's ROUTES, verify-lib's
 * ROUTES) and a fifth would be one more thing to forget. The heading is the
 * page's own answer to "what is this", and verify-nav.mjs asserts there is
 * exactly one of them per route.
 *
 * The read is retried across a bounded number of frames, and it is retried
 * against the PREVIOUS heading rather than merely against "is there one".
 * Measured, not assumed: on a navigation into a route whose lazy chunk is
 * still in flight, React commits the <Suspense> fallback while the OUTGOING
 * page's `#page-title` is still in the document — so a naive
 * `getElementById` on the first frame announced the page you just LEFT.
 * ("Navigated to Every Monero output is hiding somewhere in this cloud" on
 * arriving at /markets, from a real gate run.) Holding the last announced
 * NODE and its TEXT and rejecting a match on both is what makes the read
 * mean "the new page's heading":
 *   · different node          → a route whose component subtree remounted
 *   · same node, changed text → /mempool's own `?v=` switch, where
 *                               MempoolPage stays mounted and only its
 *                               .sr-only heading's text changes
 *   · same node, same text    → the old page, still there. Keep waiting.
 * If the budget runs out (a chunk that genuinely failed to load), the
 * pathname itself is announced rather than nothing — an honest, if terse,
 * answer.
 */

import * as React from "react";
import { useLocation } from "react-router-dom";

/** ~0.5s at 60fps. Long enough for a lazy chunk that is already in the HTTP
 *  cache, short enough that a failed chunk still gets announced promptly. */
const READ_FRAMES = 30;

/** Last-resort label, derived from the URL alone — no route table to drift. */
function pathLabel(pathname: string): string {
  const segs = pathname.split("/").filter(Boolean);
  if (segs.length === 0) return "Home";
  return segs.join(" ").replace(/-/g, " ");
}

export function RouteAnnouncer(): React.ReactElement {
  const location = useLocation();
  const [msg, setMsg] = React.useState("");
  const firstRef = React.useRef(true);
  /** The heading this component last read — node identity AND text. See the
   *  header: this is what distinguishes "the new page's h1" from "the old
   *  page's h1, still mounted behind a Suspense fallback". */
  const seenRef = React.useRef<{ node: Element | null; text: string }>({ node: null, text: "" });

  React.useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false;
      // Record the landing page's heading WITHOUT announcing it, so the very
      // first navigation has something to compare against.
      const h0 = document.getElementById("page-title");
      seenRef.current = { node: h0, text: h0?.textContent?.trim() ?? "" };
      return;
    }

    let cancelled = false;
    let raf = 0;
    let frames = 0;

    const attempt = (): void => {
      if (cancelled) return;
      const heading = document.getElementById("page-title");
      const text = heading?.textContent?.trim() ?? "";
      const seen = seenRef.current;
      const isNew = !!text && (heading !== seen.node || text !== seen.text);
      if (isNew) {
        seenRef.current = { node: heading, text };
        setMsg("Navigated to " + text);
        return;
      }
      if (++frames < READ_FRAMES) {
        // D0699-EXEMPT: bounded retry for the new heading, stops after READ_FRAMES
        raf = requestAnimationFrame(attempt);
        return;
      }
      seenRef.current = { node: heading, text };
      setMsg("Navigated to " + pathLabel(location.pathname));
    };

    attempt();

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
    };
    // `search` is in the dep list on purpose: /mempool?v=terminal and
    // /simulate?p=jamtis are different content on the same pathname, and both
    // are PUSHed history entries (routes/useUrlState.ts's policy block).
  }, [location.pathname, location.search]);

  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {msg}
    </div>
  );
}
