/**
 * layout/AppShell.tsx — wraps a page with the standard nav + rail + footer.
 *
 * Pages that bring their own full-bleed art (e.g. Mempool views) should
 * NOT use AppShell; they render the chrome themselves. See PORTING.md.
 *
 * ─── NAVIGATION SEMANTICS (D0744) ───────────────────────────────────────────
 * Three things landed here together because they are one contract:
 *
 *   • `<main id="main" tabIndex={-1} aria-labelledby="page-title">`. The id is
 *     the skip link's target AND the element routes/useRouteChrome.ts sends
 *     focus to after a route change; `tabIndex={-1}` is what makes an element
 *     that is not natively focusable a legal focus destination (it stays out
 *     of the tab ORDER — -1, not 0 — so nothing changes for a sighted keyboard
 *     user tabbing through the page).
 *   • `aria-labelledby="page-title"` names the main landmark with the page's
 *     own <h1>. That is why PageHeader's heading below carries
 *     `id="page-title"`: one edit here covers the nine pages that render a
 *     PageHeader. HomePage and the education Journey have their own inline
 *     <h1> and carry the id directly; MempoolPage, MempoolTxPage,
 *     NotFoundPage and SimulatePage render one .sr-only <h1> each, since a
 *     landmark labelled by a heading that does not exist is worse than no
 *     label. verify-nav.mjs asserts exactly ONE #page-title per route, which
 *     is what keeps both halves honest.
 *   • The skip link is the FIRST focusable thing in `.art-stage`, ahead of
 *     NavTop's eleven links. Its `.skip-link` rule (visually hidden until
 *     focused) lives in styles.css.
 *
 * Note the ORDER of the two ids: `#main` is the landmark, `#page-title` is the
 * heading inside it. They are not interchangeable and nothing should collapse
 * them into one.
 */

import * as React from "react";
import { NavTop } from "./NavTop";
import { NetRail } from "./NetRail";
import { Footer } from "./Footer";
import { ArtBackground } from "@/design/ArtBackground";
import { useRouteChrome } from "@/routes/useRouteChrome";

export interface AppShellProps {
  /** Hide the left telemetry rail (e.g. for content-only pages). */
  hideRail?: boolean;
  /** Remove main column padding & scroll (e.g. for view-only pages). */
  fluid?: boolean;
  scan?: boolean;
  bg?: { intensity?: "calm" | "busy" | "chaotic"; scan?: boolean };
  children: React.ReactNode;
}

export function AppShell({ hideRail, fluid, scan, bg, children }: AppShellProps) {
  // Scroll restoration + post-navigation focus. AppShell remounts per page
  // (it renders inside each page, below <Routes>), so its effects see the new
  // main.main — which is exactly what this hook needs and what App.tsx, above
  // <Suspense>, could never give it.
  useRouteChrome();

  return (
    <div className={"art " + (scan ? "scan-on" : "")} style={{ position: "relative" }}>
      <ArtBackground intensity={bg?.intensity || "calm"} scan={scan ?? bg?.scan} />
      <div className="art-stage" style={{ height: "100%" }}>
        {/* First focusable element on the page, ahead of NavTop's links. */}
        <a className="skip-link" href="#main">Skip to content</a>
        <NavTop />
        <div className="shell" style={hideRail ? { gridTemplateColumns: "1fr" } : undefined}>
          {hideRail ? null : <NetRail />}
          <main id="main" tabIndex={-1} aria-labelledby="page-title" className={"main" + (fluid ? " main--fluid" : "")}>
            {children}
          </main>
        </div>
        <Footer />
      </div>
    </div>
  );
}

/** Standard page header. Title supports inline HTML (for accent `<em>`). */
export interface PageHeaderProps {
  kicker?: React.ReactNode;
  title: string;
  sub?: React.ReactNode;
  right?: React.ReactNode;
}

export function PageHeader({ kicker, title, sub, right }: PageHeaderProps) {
  return (
    <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, padding: "4px 0 14px", borderBottom: "1px solid var(--rule)" }}>
      <div>
        {kicker ? <div className="kicker">{kicker}</div> : null}
        {/* id="page-title" — the <main> landmark's accessible name, and what
            routes/RouteAnnouncer.tsx reads to name the route it just entered.
            One edit, nine pages. */}
        <h1 id="page-title" className="serif" style={{ margin: "6px 0 4px", fontSize: 34, fontWeight: 500, letterSpacing: "-0.01em", color: "var(--ink-100)" }}>
          <span dangerouslySetInnerHTML={{ __html: title }} />
        </h1>
        {sub ? <p className="mono dim" style={{ margin: 0, fontSize: "var(--fs-mono)", letterSpacing: "0.04em" }}>{sub}</p> : null}
      </div>
      {right ? <div style={{ display: "flex", gap: 10, alignItems: "center" }}>{right}</div> : null}
    </header>
  );
}
