/**
 * layout/SectionSheet.tsx — p4·M9b. The phone's equivalent of NavTop's
 * dropdown: the section a tab names, opened as a bottom sheet.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────
 * `BottomTabBar` navigates each tab to `section.cols[0].items[0].p`, and
 * NavTop.tsx:19-20 records the decision that made that the whole mobile nav:
 * "The old hamburger + slide-in drawer is gone; BottomTabBar replaces it
 * below 720px instead of hiding the same 6 destinations inside a drawer."
 * The drawer did not hold 6 destinations. It held every IA leaf, and calling
 * them "the same 6" is what lost the rest.
 *
 * MEASURED on the base, at 390x844, against the RENDERED page rather than the
 * source — six tab landings read off `a.tabbar-item`, then every IA item's
 * pathname checked for a visible affordance on the page its own section's tab
 * lands on:
 *
 *   27 distinct pathnames across the IA's 68 items
 *    6 are tab landings                                        → 1 tap
 *   10 are the /monero chapters and /learn tabs, which their
 *      landing page renders as BUTTONS (not anchors — an
 *      anchor-only sweep reports these unreachable, and did)   → 2 taps
 *   11 have no affordance on any landing page at all           → UNREACHABLE
 *
 * The eleven: Chain telemetry, Price & candles, Market thesis, Run a
 * simulator, Outlook, Protocols, Mine Monero, Superstress hub, Beta-chain
 * explorer, Trusted peers, Mission & ethos. On a phone those existed only for
 * a reader who types a URL or opens the command palette.
 *
 * ── WHAT IT RENDERS, AND WHY IT MIRRORS THE DESKTOP EXACTLY ──────────────
 * Every column, its `h` heading, every item, its `note`, and the section
 * `blurb` — the same fields NavTop.tsx:524-537 renders, read from the same
 * `IA`. Not a subset: the point of the sheet is that a phone reader is
 * offered what a desktop reader is offered. `live` is 18 items and `learn` is
 * 27, so the sheet scrolls; a menu that scrolls is ordinary, and a menu that
 * silently drops 20 destinations is the defect this file fixes.
 *
 * ── WHAT IT DOES NOT IMPLEMENT, DELIBERATELY ─────────────────────────────
 * Nothing about dialog behaviour. `V6Modal` already owns the portal, the
 * `role="dialog"`, the Tab trap, focus capture and restore, the document-level
 * Escape, the two-target scroll lock (`document.body` AND `main.main`), and
 * D0666's exit frame — and its exit delay is READ from the element's own
 * computed transition-duration, so a reduced-motion reader (where the rules
 * declare `transition: none`) measures 0 and unmounts on the next tick with no
 * branch here and none there. Re-implementing any of that would be a second
 * home for an invariant this repo has already paid to have in one place.
 * The only thing this file adds to it is a `variant`, which is geometry.
 */

import * as React from "react";
import { Link, useLocation } from "react-router-dom";

import type { IaSection } from "@/nav/ia";
import { V6Modal } from "@/pages/future/V6Modal";

/** Does this item name the URL the reader is already on?
 *
 *  An IA path is either bare (`/live/mempool`) or carries a query that IS the
 *  destination (`/live/mempool?v=orbital`, `/learn/sim?p=stealth`) — the two
 *  are different destinations that share a pathname, which is why `?` is
 *  compared rather than stripped. A bare item matches only a bare URL, so
 *  standing on `?v=orbital` marks the orbital row and not "Mempool"; and the
 *  query'd item matches only its own query. */
function isCurrent(itemPath: string, pathname: string, search: string): boolean {
  const here = pathname + search;
  if (itemPath.includes("?")) return itemPath === here;
  return itemPath === pathname;
}

export interface SectionSheetProps {
  section: IaSection | null;
  open: boolean;
  onClose: () => void;
}

export function SectionSheet({ section, open, onClose }: SectionSheetProps) {
  const location = useLocation();
  const titleId = React.useId();

  // The sheet must not outlive a navigation. `V6Modal` restores focus and
  // unlocks scroll in its own effect cleanups, so closing on a route change is
  // enough — there is nothing to unwind here. Keyed on the full URL because
  // two IA items can share a pathname and differ only in their query.
  const url = location.pathname + location.search;
  const firstUrl = React.useRef(url);
  React.useEffect(() => {
    if (url !== firstUrl.current) onClose();
    firstUrl.current = url;
  }, [url, onClose]);

  if (!section) return null;

  return (
    <V6Modal open={open} onClose={onClose} labelledBy={titleId} variant="sheet">
      {/* Presentational only — the affordance is the backdrop, Escape and the
          rows themselves, all of which V6Modal or the links already provide. */}
      <div className="sheet-grip" aria-hidden="true" />
      <h2 id={titleId} className="sheet-title">
        {section.label}
        <span className="sheet-blurb">{section.blurb}</span>
      </h2>

      <div className="sheet-cols">
        {section.cols.map((col) => (
          <div className="sheet-col" key={col.h}>
            <h3 className="sheet-colh">{col.h}</h3>
            {col.items.map((it) => {
              const current = isCurrent(it.p, location.pathname, location.search);
              return (
                <Link
                  key={it.p}
                  to={it.p}
                  className="sheet-item"
                  aria-current={current ? "page" : undefined}
                  onClick={onClose}
                >
                  <span className="sheet-item__l">{it.l}</span>
                  {it.note ? <small className="sheet-item__n">{it.note}</small> : null}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </V6Modal>
  );
}
