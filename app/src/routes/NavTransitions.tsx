/**
 * routes/NavTransitions.tsx — one capture-phase click listener that upgrades
 * ordinary in-app link clicks into a view-transitioned navigation.
 *
 * Editing the ~25 `<Link>`/`<NavLink>` call sites across the app instead
 * would churn today and silently regress the next time anyone adds a link
 * without knowing this exists. One listener, mounted once, covers every
 * link — present and future — uniformly.
 *
 * Mounted once in App.tsx, as a sibling of <AmbientField/>, inside the
 * <BrowserRouter> (main.tsx) / <StaticRouter> (entry-ssr.tsx) that wraps
 * <App/> either way, so `useNavigate`/`useLocation` below always have a
 * router to read. Renders nothing — it is a listener with a React lifecycle,
 * not a DOM node, and is SSR-safe: the click handler is registered inside
 * `useEffect`, which `renderToString` never runs.
 *
 * Runs in the CAPTURE phase specifically so it sees the click before
 * react-router's own `<Link>`/`<NavLink>` onClick handler (attached via
 * React's bubble-phase delegation) does. Calling `preventDefault()` here
 * makes that handler's own `if (!event.defaultPrevented)` guard back off,
 * so there is no double-navigation — this listener fully owns the outcome
 * once it decides to act.
 */

import * as React from "react";

import { useViewTransitionNavigate } from "@/design/useViewTransitionNavigate";

export function NavTransitions(): null {
  const vtNavigate = useViewTransitionNavigate();

  React.useEffect(() => {
    function onClick(e: MouseEvent): void {
      // Someone upstream (in capture order, i.e. an ancestor listener that
      // also runs in the capture phase) already handled this click.
      if (e.defaultPrevented) return;
      // Only a plain left click. A middle/right click or a modified click
      // (open in new tab, save link, etc.) must reach the browser's native
      // handling untouched.
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const target = e.target;
      if (!(target instanceof Element)) return;
      const a = target.closest("a[href]");
      if (!(a instanceof HTMLAnchorElement)) return;

      if (a.hasAttribute("target")) return;      // _blank and friends
      if (a.hasAttribute("download")) return;
      if (a.relList.contains("external")) return; // rel="external" opt-out
      if (a.closest("[data-no-vt]")) return;       // explicit opt-out ancestor

      // Cross-origin, and any non-http(s) scheme (mailto:, tel:, a raw
      // javascript: href) all resolve through the parsed `.origin` already,
      // so one check covers both — `a.origin` for a `mailto:` href is the
      // opaque string "null", which never equals a real page origin.
      if (a.origin !== window.location.origin) return;

      // Pure hash change on the SAME page (the skip link, or NavTop.tsx's
      // "/sources#release-notes" link when already on /sources) — let the
      // browser do its native, JS-free scroll-to-anchor. Comparing pathname
      // AND search (not just pathname) means a link that changes the query
      // string but keeps the same path still gets a transition.
      const samePage = a.pathname === window.location.pathname && a.search === window.location.search;
      if (samePage) return;

      e.preventDefault();
      vtNavigate(a.pathname + a.search + a.hash);
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [vtNavigate]);

  return null;
}
