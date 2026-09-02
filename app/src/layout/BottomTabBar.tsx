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
import type { IaSection } from "@/nav/ia";

/* p4·M9b — the sheet is LAZY, and for the reason NavTop's own
 * `LazyCommandPalette` comment already gives: defining the wrapper at module
 * scope fetches nothing, because React.lazy's factory runs the first time the
 * component is actually rendered.
 *
 * It has to be lazy. This component is imported STATICALLY by NavTop, which is
 * eager, so a static import here would pull `pages/future/V6Modal` — today a
 * 1,954 B chunk reached only through `React.lazy` — into the entry chunk. Every
 * route's first load pays for that, and `/live/mempool` (this release's other
 * subject) has 1,213 B of gzip margin. Measured, not assumed: V6Modal has its
 * own chunk on the base precisely because CommandPalette, EcoPopup and
 * ProtoPopup all reach it dynamically. */
const LazySectionSheet = React.lazy(() =>
  import("./SectionSheet").then((m) => ({ default: m.SectionSheet })),
);

/** Items across every column, which is what the sheet offers and what decides
 *  whether a tab needs one at all. `cols[0].items[0]` — where a tab navigates —
 *  is one of these; on the shipping IA the smallest section holds 3. */
function itemCount(section: IaSection): number {
  return section.cols.reduce((n, c) => n + c.items.length, 0);
}

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

  const [sheetKey, setSheetKey] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  // Same shape as NavTop's `paletteEverOpened`: the chunk must not be
  // REQUESTED until a tab is first tapped, but once it has been the component
  // stays mounted and toggles its own `open` prop, so V6Modal can play its
  // exit. "Mounted" is not "a dialog exists" — V6Modal returns null while
  // closed, which is what keeps `[role="dialog"]` absent.
  const [everOpened, setEverOpened] = React.useState(false);

  const openSheet = React.useCallback((key: string) => {
    setSheetKey(key);
    setEverOpened(true);
    setOpen(true);
  }, []);
  const closeSheet = React.useCallback(() => setOpen(false), []);
  const sheetSection = React.useMemo(
    () => IA.find((s) => s.key === sheetKey) ?? null,
    [sheetKey],
  );

  return (
    <div className="tabbar-anchor" aria-hidden={false}>
      <nav className="tabbar" aria-label="Sections">
        {IA.map((section) => {
          const isActive = section.key === activeKey;
          const target = section.cols[0].items[0].p;
          const opensSheet = itemCount(section) > 1;
          return (
            /* STILL AN ANCHOR, and that is load-bearing twice over.
               `verify-nav.mjs:813` asserts exactly 6 `a.tabbar-item`, and the
               prerendered bar is a real JS-off nav — `verify-nojs` reads the
               app's own prerendered anchors. So the href stays exactly what it
               was and a scripted plain left-click is intercepted instead:
               with JS the tab opens its section, without JS it navigates where
               it always did. Modified clicks and non-primary buttons fall
               through to the browser, so long-press / open-in-new-tab still
               reach the landing page. */
            <Link
              key={section.key}
              to={target}
              className="tabbar-item"
              aria-current={isActive ? "page" : undefined}
              aria-haspopup={opensSheet ? "menu" : undefined}
              /* routes/NavTransitions.tsx owns a CAPTURE-phase document click
                 listener that upgrades in-app link clicks into a
                 view-transitioned navigation. Capture beats React's
                 bubble-phase delegation, so it calls preventDefault and
                 navigates BEFORE the handler below ever runs — measured: on
                 the base every tab but the active one navigated and the sheet
                 that had just opened was closed again by its own route-change
                 effect. The active tab appeared to work only because that
                 listener's `samePage` guard already returned early for it.
                 `data-no-vt` is that file's own documented opt-out ancestor;
                 with the listener standing down, this component's
                 preventDefault reaches react-router's Link, whose
                 `!defaultPrevented` guard then backs off too. Scoped to the
                 tabs that open a sheet, so a future one-item section still
                 navigates WITH a transition. */
              data-no-vt={opensSheet ? "" : undefined}
              aria-expanded={opensSheet ? (open && sheetKey === section.key) : undefined}
              onClick={(e) => {
                if (!opensSheet) return;
                if (e.defaultPrevented) return;
                if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                openSheet(section.key);
              }}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                {sectionIcon(section.key)}
              </svg>
              <span>{section.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Not requested until the first tab tap — see LazySectionSheet above.
          `fallback={null}` matches NavTop's palette for the same reason: the
          chunk is tiny and already resolving, and a visible "loading…" would
          be a worse first frame than a one-tick-late sheet. */}
      {everOpened ? (
        <React.Suspense fallback={null}>
          <LazySectionSheet section={sheetSection} open={open} onClose={closeSheet} />
        </React.Suspense>
      ) : null}
    </div>
  );
}
