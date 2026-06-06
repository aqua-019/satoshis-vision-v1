/**
 * layout/AppShell.tsx — wraps a page with the standard nav + rail + footer.
 *
 * Pages that bring their own full-bleed art (e.g. Mempool views) should
 * NOT use AppShell; they render the chrome themselves. See PORTING.md.
 */

import * as React from "react";
import { NavTop } from "./NavTop";
import { NetRail } from "./NetRail";
import { Footer } from "./Footer";
import { ArtBackground } from "@/design/ArtBackground";

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
  return (
    <div className={"art " + (scan ? "scan-on" : "")} style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <ArtBackground intensity={bg?.intensity || "calm"} scan={scan ?? bg?.scan} />
      <div className="art-stage" style={{ height: "100%" }}>
        <NavTop />
        <div className="shell" style={hideRail ? { gridTemplateColumns: "1fr" } : undefined}>
          {hideRail ? null : <NetRail />}
          <main className="main" style={fluid ? { padding: 0, overflow: "hidden" } : undefined}>
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
        <h1 className="serif" style={{ margin: "6px 0 4px", fontSize: 34, fontWeight: 500, letterSpacing: "-0.01em", color: "var(--ink-100)" }}>
          <span dangerouslySetInnerHTML={{ __html: title }} />
        </h1>
        {sub ? <p className="mono dim" style={{ margin: 0, fontSize: 12, letterSpacing: "0.04em" }}>{sub}</p> : null}
      </div>
      {right ? <div style={{ display: "flex", gap: 10, alignItems: "center" }}>{right}</div> : null}
    </header>
  );
}
