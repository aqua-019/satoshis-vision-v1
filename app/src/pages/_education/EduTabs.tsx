/**
 * pages/_education/EduTabs.tsx — the Education sub-nav tab bar.
 *
 * Rendered under the breadcrumb. Active tab is orange with a glow + a 2px
 * orange underline; inactive tabs are dim. Labels are uppercased via CSS.
 */

import * as React from "react";
import { EDU_TABS } from "./tabs";

export interface EduTabsProps {
  active: string;
  onChange: (id: string) => void;
}

export function EduTabs({ active, onChange }: EduTabsProps) {
  return (
    <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--rule)", flexWrap: "wrap" }}>
      {EDU_TABS.map((t) => {
        const on = t.id === active;
        return (
          <button key={t.id} type="button" onClick={() => onChange(t.id)}
            style={{ appearance: "none", background: "transparent", cursor: "pointer", border: 0,
              borderBottom: "2px solid " + (on ? "var(--tk-accent)" : "transparent"),
              color: on ? "var(--tk-accent)" : "var(--ink-60)", padding: "10px 16px",
              fontFamily: "var(--f-mono)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
              textShadow: on ? "var(--glow-1)" : "none", marginBottom: -1 }}>{t.label}</button>
        );
      })}
    </div>
  );
}
