/**
 * design/ThemeToggle.tsx — the three-way Theme switcher (Classic · Phosphor ·
 * Indigo).
 *
 * Reuses DesignPanel.tsx's RadioGroup idiom: native `<fieldset>/<legend>` +
 * `<input type="radio">`, which gives arrow-key traversal and roving
 * tabindex from the platform for free — no hand-rolled `role="radiogroup"`.
 *
 * Mounted twice:
 *   - pages/HomePage.tsx, beside the hero CTA row — a first-class control on
 *     Main Home, not a footnote.
 *   - design/DesignPanel.tsx, replacing its inline Theme RadioGroup.
 * Both instances render from this one definition so the two toggles can
 * never drift out of sync with `ThemeKey`. `React.useId()` keys each
 * instance's `id`/`name` attributes so two toggles mounted on the same page
 * (Home always has both — DesignPanel lives in the topbar on every route)
 * never collide on duplicate DOM ids or share one native radio group.
 *
 * `data-testid="theme-toggle"` on the root element is load-bearing:
 * verify-contrast.mjs finds the control by this testid rather than a
 * positional selector, because a positional `.first()` can no longer tell
 * the two mounted instances apart.
 *
 * Tokens only — `var(--ui-accent)`, `var(--ink-60)`, `var(--f-mono)`,
 * `var(--fs-label)` etc. No hardcoded hex/rgba, no text under 12px.
 */

import * as React from "react";
import { useVisual, type ThemeKey } from "./VisualContext";

const THEME_OPTIONS: ReadonlyArray<{ value: ThemeKey; label: string }> = [
  { value: "classic", label: "Classic" },
  { value: "phosphor", label: "Phosphor" },
  { value: "indigo", label: "Indigo" },
];

export interface ThemeToggleProps {
  className?: string;
  style?: React.CSSProperties;
}

export function ThemeToggle({ className, style }: ThemeToggleProps) {
  const { theme, setTheme } = useVisual();
  // Unique per mounted instance — see the header comment on why this can't
  // be a fixed id/name.
  const uid = React.useId();

  return (
    <fieldset
      data-testid="theme-toggle"
      className={className}
      style={{ border: "none", margin: 0, padding: 0, ...style }}
    >
      <legend className="kicker" style={{ padding: 0, marginBottom: 6 }}>
        Theme
      </legend>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {THEME_OPTIONS.map((opt) => {
          const on = opt.value === theme;
          const id = `${uid}-${opt.value}`;
          return (
            <label
              key={opt.value}
              htmlFor={id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
                userSelect: "none",
                border: "1px solid " + (on ? "var(--ui-accent)" : "var(--ink-10)"),
                color: on ? "var(--ui-accent-text)" : "var(--ink-60)",
                padding: "5px 9px",
                borderRadius: 3,
                fontFamily: "var(--f-mono)",
                fontSize: "var(--fs-label)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                boxShadow: on ? "var(--glow-v-soft)" : "none",
              }}
            >
              <input
                type="radio"
                id={id}
                name={uid}
                checked={on}
                onChange={() => setTheme(opt.value)}
                style={{ margin: 0, accentColor: "var(--ui-accent)" }}
              />
              {opt.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
