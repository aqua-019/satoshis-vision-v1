/**
 * layout/PageShell.tsx — the single container primitive every routed page renders inside.
 *
 * Wraps AppShell and adds the one thing AppShell deliberately does not own: the centred
 * content column. Before this existed each page hand-rolled its own `maxWidth` + padding,
 * which produced eight unrelated widths (1080 … 1720) and a 538px swing between sibling
 * tabs with identical chrome. Width is now a content-type decision picked from three tiers
 * (see PAGE_W), not an accident of authorship.
 *
 * PADDING AND MAX-WIDTH ARE NOT EMITTED INLINE — the component ships only `className` and
 * `data-w`, and `styles.css` owns the geometry via `.page-shell` / `.page-shell[data-w=…]`.
 * This is load-bearing, not stylistic. An inline declaration cannot be beaten by any class
 * rule, so the mobile layer was reduced to string-matching the padding literal it needed to
 * override (`.main [style*="padding: 32px 48px"]` and friends) — which silently missed every
 * page whose literal drifted, and left `.home-hero`'s `padding: … !important` fighting an
 * inline value forever. Keeping geometry in the sheet is what retires those hacks. If a page
 * needs to bend the container, pass `className` and add a rule; do not reach for `style`.
 *
 * PAGE_W is the numeric contract. The TS constant and the `[data-w]` rules in styles.css are
 * two halves of the same fact, and `verify-pageshell.mjs` asserts the live DOM against PAGE_W
 * at 1920 so they cannot drift apart. Change one, change both.
 *
 * There is deliberately NO `<Section>` primitive here. Three abstractions already cover the
 * kicker + heading + body pattern — `PageHeader` (AppShell.tsx), `EduChapter` (EduAtoms.tsx)
 * and SourcesPage's local `SourceSection` — and most remaining `kicker` uses are inline labels
 * inside cards and table headers, not sections. A fourth wrapper would be a rename, not a
 * primitive. Section rhythm is instead the shell's single `gap`.
 *
 * ONE-WAY RATCHET ON THE RAIL. AppShell sets an *inline* `gridTemplateColumns: "1fr"` on
 * `.shell` whenever `hideRail` is true, so `rail={false}` is final: no media query, class rule
 * or `!important` can restore a rail on a rail-hidden page. Rail visibility is therefore a
 * per-page authoring decision made here, and CSS may only take a rail away (which it does
 * below 1280px — and must always pair `.shell > .rail { display:none }` with
 * `.shell { grid-template-columns: 1fr }`, or `.main` auto-places into the 260px track).
 */

import * as React from "react";
import { AppShell } from "./AppShell";
import type { AppShellProps } from "./AppShell";

/** Container tier. `"fluid"` is a width value rather than a separate prop so `width` is never meaningless. */
export type PageWidth = "wide" | "standard" | "reading" | "fluid";

/**
 * Max-width in px per tier — mirrored by `.page-shell[data-w="…"]` in styles.css.
 * `"fluid"` is absent by construction: it renders no container, so it has no width.
 */
export const PAGE_W: Record<Exclude<PageWidth, "fluid">, number> = {
  wide: 1680,
  standard: 1440,
  reading: 1180,
};

export interface PageShellProps {
  /** Container tier (default `"standard"`). `"fluid"` renders no container element at all. */
  width?: PageWidth;
  /** Show the left telemetry rail (default `false`). Irreversible once false — see file header. */
  rail?: boolean;
  /** Extra class on the container, for the rare page that must bend the geometry. Ignored when fluid. */
  className?: string;
  scan?: boolean;
  bg?: AppShellProps["bg"];
  children: React.ReactNode;
}

export function PageShell({ width = "standard", rail = false, className, scan, bg, children }: PageShellProps) {
  return (
    <AppShell hideRail={!rail} fluid={width === "fluid"} scan={scan} bg={bg}>
      {width === "fluid" ? (
        children
      ) : (
        <div className={"page-shell" + (className ? " " + className : "")} data-w={width}>
          {children}
        </div>
      )}
    </AppShell>
  );
}
