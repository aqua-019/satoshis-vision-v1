/**
 * pages/_education/EduAtoms.tsx — shared editorial atoms for education sections.
 *
 * EduChapter / EduMilestone / EduPullquote. These use dangerouslySetInnerHTML
 * and inline styles with CSS custom properties — kept verbatim from the spec.
 */

import * as React from "react";

export interface EduChapterProps {
  n: React.ReactNode;
  kicker: React.ReactNode;
  title: string;
  sub?: string;
}

export function EduChapter({ n, kicker, title, sub }: EduChapterProps) {
  return (
    <div className="edu-head" style={{ display: "flex", flexDirection: "column", gap: 10, padding: "8px 0 2px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span className="mono" style={{ fontSize: 11, letterSpacing: "0.22em", color: "var(--tk-accent)", textShadow: "var(--glow-1)" }}>{n}</span>
        <span style={{ height: 1, flex: 1, background: "linear-gradient(to right, var(--tk-accent), transparent)", opacity: 0.4 }} />
        <span className="kicker">{kicker}</span>
      </div>
      <h2 className="serif" style={{ margin: 0, fontSize: 38, fontWeight: 400, letterSpacing: "-0.015em", color: "var(--ink-100)", lineHeight: 1.08 }}
        dangerouslySetInnerHTML={{ __html: title }} />
      {sub ? <p className="mono" style={{ margin: 0, maxWidth: "78ch", fontSize: 13.5, lineHeight: 1.7, color: "var(--ink-60)" }}
        dangerouslySetInnerHTML={{ __html: sub }} /> : null}
    </div>
  );
}

export interface EduMilestoneProps {
  date: React.ReactNode;
  title: React.ReactNode;
  children: React.ReactNode;
  tone?: string;
}

export function EduMilestone({ date, title, children, tone = "var(--tk-accent)" }: EduMilestoneProps) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 24, padding: "18px 0", borderTop: "1px solid var(--rule)" }}>
      <div>
        <div className="mono" style={{ fontSize: 11, color: tone, letterSpacing: "0.04em", textShadow: tone === "var(--tk-accent)" ? "var(--glow-1)" : "none" }}>{date}</div>
        <div className="serif" style={{ fontSize: 21, fontWeight: 500, color: "var(--ink-100)", marginTop: 6, lineHeight: 1.2 }}>{title}</div>
      </div>
      <div className="mono" style={{ fontSize: 13, lineHeight: 1.72, color: "var(--ink-80)" }}>{children}</div>
    </div>
  );
}

export interface EduPullquoteProps {
  children: React.ReactNode;
  cite?: React.ReactNode;
}

export function EduPullquote({ children, cite }: EduPullquoteProps) {
  return (
    <figure style={{ margin: "8px 0", padding: "26px 30px", border: "1px solid var(--rule)", borderLeft: "2px solid var(--tk-accent)", background: "rgba(255,122,26,0.03)", borderRadius: 2 }}>
      <blockquote className="serif" style={{ margin: 0, fontSize: 23, lineHeight: 1.42, color: "var(--ink-100)", fontStyle: "italic" }}>{children}</blockquote>
      {cite ? <figcaption className="mono" style={{ marginTop: 14, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--tk-accent)" }}>— {cite}</figcaption> : null}
    </figure>
  );
}
