/**
 * design/ThemeToggle.tsx — the three-way Theme switcher (Classic · Phosphor ·
 * Indigo).
 *
 * Reuses DesignPanel.tsx's RadioGroup idiom: native `<fieldset>/<legend>` +
 * `<input type="radio">`, which gives arrow-key traversal and roving
 * tabindex from the platform for free — no hand-rolled `role="radiogroup"`.
 *
 * MOUNTED ONCE, in design/DesignPanel.tsx — the ⌘ DESIGN dropdown, which
 * rides the topbar on every route, so the control is reachable everywhere
 * without any page carrying its own copy.
 *
 * It was mounted TWICE until p4·M2: pages/HomePage.tsx also rendered one
 * beside the hero CTA row. That mount is gone — themes are a display
 * preference and belong with the other display preferences, not as a
 * first-class control on the site's front door.
 *
 * `React.useId()` KEYS ARE KEPT, and the reason has changed rather than
 * lapsed. The old rationale was collision between two instances on one page,
 * which no longer arises. What remains is that the `id`/`name` attributes
 * must not be a fixed literal: a second mount is one JSX line away, the
 * failure it would cause (duplicate DOM ids, two toggles sharing one native
 * radio group) is silent, and `useId()` costs nothing. Do not "simplify" it
 * to a constant on the strength of there being one mount today.
 *
 * `data-testid="theme-toggle"` on the root element is load-bearing:
 * verify-contrast.mjs finds the control by this testid rather than a
 * positional selector. That indirection is also kept deliberately — a
 * positional selector would start passing for the wrong reason the moment a
 * second instance returns.
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
