/**
 * design/Disclosure.tsx — one expand/collapse row: a labelled trigger and the
 * panel it controls.
 *
 * ── WHY THIS FILE EXISTS AND WHY IT IS NOT IN primitives.tsx ─────────────
 * `design/primitives.tsx` is EAGER — it is reachable from the entry chunk, so
 * anything added to it is paid for on first paint by every route, including
 * the ones that never render it. This component has exactly two consumers in
 * sight (the Superstress hub, and prompt 18's legal redesign), both lazy. It
 * is therefore a LEAF with its own module, the same call
 * `design/canvasColor.ts` and `pages/future/repoPulse.tsx` already record:
 * a shared component is free only when every importer is on the same side of
 * the eager/lazy line. Import it from HERE, never by re-exporting it through
 * primitives.tsx — that would put it back in first paint for all 14 routes.
 *
 * ── THE MODEL, AND THE ONE PLACE IT DEVIATES ─────────────────────────────
 * Shape is `pages/monero/legality/JurisdictionRow.tsx`: controlled `open` +
 * `onToggle`, two `useId()`s, a real `<button type="button">` carrying
 * `id` / `aria-controls` / `aria-expanded`, and a panel with
 * `role="region" aria-labelledby={btnId}`. Open state is styled off
 * `[aria-expanded="true"]` rather than an `is-open` class, which is this
 * repo's idiom (styles.css's `.lg-row[aria-expanded="true"]`).
 *
 * THE DEVIATION: JurisdictionRow renders its panel as `{open && <div …>}`, so
 * the panel does not exist while collapsed. This one renders the panel ALWAYS
 * and toggles the `hidden` attribute. Two reasons, and the second is the one
 * that matters here:
 *
 *   1. `aria-controls` on the trigger points at an element that does not
 *      exist in the collapsed state under the conditional-mount version.
 *      Always-render makes the reference resolvable in BOTH states, so
 *      "aria-controls resolves" becomes an assertion with content rather than
 *      one that is only true half the time.
 *
 *   2. PRERENDERING. Every route is emitted as real HTML (scripts/
 *      prerender.mjs) precisely so the site works with JavaScript off, and
 *      this component is the hub's per-app detail. Under conditional mount
 *      that detail is absent from the prerendered document and a JS-off
 *      reader — Tor at Safest, the audience this site is built for — gets a
 *      row of buttons that cannot open and no content behind them. Rendered
 *      always, the text IS in the prerendered HTML; all that is missing is
 *      the ability to collapse it, and `styles.css`'s
 *      `.nojs-reveal` rule (revealed from index.html's own <noscript> block,
 *      the same mechanism that reveals `.nav-noscript`) unhides every panel
 *      when scripting is off.
 *
 * `.disc-panel[hidden] { display: none }` is spelled out in the stylesheet
 * rather than left to the UA sheet — index.html's `#boot-fallback[hidden]`
 * carries the identical note, and for the identical reason: any author
 * `display` declaration out-specifies the UA rule and the panel would then
 * be permanently open.
 *
 * ── MOTION ───────────────────────────────────────────────────────────────
 * There is NO height animation, at any motion preference. A collapsing height
 * carries no information the `aria-expanded` state does not already carry,
 * and animating it would mean a reduced-motion path that has to reproduce the
 * same information some other way. `hidden` is binary, so the reduced-motion
 * path and the default path are the same path, and the page contributes zero
 * running animations to verify-reduce's census by construction rather than by
 * a media query someone has to remember to write.
 */

import * as React from "react";

export interface DisclosureProps {
  /** The always-visible row label. */
  label: React.ReactNode;
  /** Optional second line under the label — the one-line summary that makes
   *  the row worth opening. Stays visible when collapsed. */
  summary?: React.ReactNode;
  /** Optional right-aligned chip/meta in the trigger row. */
  meta?: React.ReactNode;
  /** Controlled open state. */
  open: boolean;
  onToggle: () => void;
  /** Stamped on the wrapper as `data-disclosure`, so a gate can address one
   *  row without depending on its position in the list. */
  id?: string;
  children: React.ReactNode;
}

export function Disclosure({ label, summary, meta, open, onToggle, id, children }: DisclosureProps) {
  const btnId = React.useId();
  const panelId = React.useId();

  return (
    <div className="disc" data-disclosure={id}>
      <button
        type="button"
        className="disc-row"
        id={btnId}
        aria-controls={panelId}
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="disc-label">
          {label}
          {summary ? <span className="disc-summary">{summary}</span> : null}
        </span>
        {meta ? <span className="disc-meta">{meta}</span> : null}
        {/* aria-hidden: the caret restates aria-expanded, which the button
            already announces. Announcing it twice is noise, not redundancy. */}
        <span className="disc-caret" aria-hidden="true">{open ? "▾" : "▸"}</span>
      </button>
      <div
        className="disc-panel nojs-reveal"
        id={panelId}
        role="region"
        aria-labelledby={btnId}
        hidden={!open}
      >
        {children}
      </div>
    </div>
  );
}
