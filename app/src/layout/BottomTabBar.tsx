/**
 * layout/BottomTabBar.tsx — D0212. The mobile equivalent of NavTop's 6-section
 * dropdown nav, shown instead of it below the D1207 720px container-query
 * breakpoint (see styles.css `@container navshell (max-width: 720px)`).
 *
 * Same source as the desktop nav: maps `IA` (nav/ia.ts), one tab per section,
 * each navigating to that section's `cols[0].items[0].p` — identical target
 * to clicking the desktop `.navitem`. Never a hardcoded path.
 *
 * ── WHY THIS RENDERS A NON-FIXED <nav>, WRAPPED IN A FIXED ANCHOR ──────────
 * The spec wants `.tabbar` itself fixed to the viewport bottom AND visible
 * only via a container query. Those two are structurally incompatible on the
 * SAME element: `container-type` implies layout containment (CSS Containment
 * §2), and layout containment makes the containing element the containing
 * block for its OWN fixed/absolutely-positioned DESCENDANTS — so nesting a
 * `position: fixed` `.tabbar` inside a `container-type` ancestor would anchor
 * it to that ancestor's box, not the viewport (it would sit right under the
 * topbar instead of at the bottom of the screen).
 *
 * The fix: `.tabbar-anchor` (rendered here, styles.css) is the element that
 * is BOTH `position: fixed` AND the `container-type` root — its own fixed
 * positioning is resolved against ITS ancestors (none of which are
 * contained), so it is unaffected by its own containment. `.tabbar` (this
 * component's actual `<nav>`) is a plain in-flow descendant of the anchor,
 * free to be toggled by `@container navshell (max-width: 720px)` like every
 * other nav element. Net effect is identical to the spec's literal reading —
 * a fixed, translucent, blurred 60px bottom bar, controlled entirely by
 * container query — just split across two elements to keep both properties
 * true at once. See layout/NavTop.tsx for the `.topbar` half of the same
 * `navshell` container-name.
 */

import * as React from "react";
import { Link, useLocation } from "react-router-dom";

import { IA, sectionForPath } from "@/nav/ia";

/** Minimal line icons, one per section. Stroke-only, 20x20, no emoji. */
function sectionIcon(key: string): React.ReactElement {
  switch (key) {
    case "live":
      return <path d="M2 11h4l2-6 4 12 2-6h4" />;
    case "monero":
      return (
        <>
          <circle cx="10" cy="10" r="7" />
          <circle cx="10" cy="10" r="2.5" />
        </>
      );
    case "learn":
      return (
        <>
          <path d="M2 5.5c2-1.4 5-1.4 8 0c3-1.4 6-1.4 8 0v10c-2-1.4-5-1.4-8 0c-3-1.4-6-1.4-8 0z" />
          <path d="M10 5.5v10" />
        </>
      );
    case "future":
      return (
        <>
          <path d="M3 10h13" />
          <path d="M11 4.5l6 5.5-6 5.5" />
        </>
      );
    case "operate":
      return (
        <>
          <rect x="3" y="4" width="14" height="12" rx="1" />
          <path d="M6 8h1.6M6 12h6" />
        </>
      );
    case "about":
    default:
      return (
        <>
          <circle cx="10" cy="10" r="7" />
          <path d="M10 9.2v4.3" />
          <circle cx="10" cy="6.5" r="0.9" fill="currentColor" stroke="none" />
        </>
      );
  }
}

export function BottomTabBar() {
  const location = useLocation();
  const activeKey = sectionForPath(location.pathname)?.key ?? null;

  return (
    <div className="tabbar-anchor" aria-hidden={false}>
      <nav className="tabbar" aria-label="Sections">
        {IA.map((section) => {
          const isActive = section.key === activeKey;
          const target = section.cols[0].items[0].p;
          return (
            <Link
              key={section.key}
              to={target}
              className="tabbar-item"
              aria-current={isActive ? "page" : undefined}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                {sectionIcon(section.key)}
              </svg>
              <span>{section.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
