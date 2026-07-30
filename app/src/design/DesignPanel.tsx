/**
 * design/DesignPanel.tsx — the ⌘ DESIGN trigger + popover.
 *
 * Exactly two knobs, mirroring design/VisualContext.tsx: Theme (indigo /
 * classic) and Ambient (calm / busy / chaotic). This is NOT a general
 * tweaks panel — see PORTING.md's "what's deliberately NOT in this repo".
 *
 * layout/NavTop.tsx renders <DesignPanel /> as the LAST CHILD of
 * `.ticker-strip`. That placement is required, not cosmetic — see
 * styles-legibility.css's "topbar overflow guard": `.ticker-strip >
 * :last-child { flex-shrink: 0 }` protects exactly that slot, and a 5th
 * direct child of `.topbar` itself would spill into an implicit grid track
 * the overflow guard doesn't know about.
 *
 * a11y: native `<input type="radio">` groups (full keyboard semantics —
 * arrow keys, native `checked` state — for free, rather than hand-rolling
 * `role="radiogroup"` behaviour), Escape-to-close + focus-return mirroring
 * the idiom at layout/NavTop.tsx:41 and pages/future/V6Modal.tsx:62 (a
 * document-level keydown listener; this is a small popover, not a modal, so
 * it does not need V6Modal's full focus trap).
 */

import * as React from "react";
import { useVisual, type ThemeKey, type AmbientKey } from "./VisualContext";

const PANEL_ID = "design-panel-popover";

const THEME_OPTIONS: ReadonlyArray<{ value: ThemeKey; label: string }> = [
  { value: "indigo", label: "Indigo" },
  { value: "classic", label: "Classic" },
];
const AMBIENT_OPTIONS: ReadonlyArray<{ value: AmbientKey; label: string }> = [
  { value: "calm", label: "Calm" },
  { value: "busy", label: "Busy" },
  { value: "chaotic", label: "Chaotic" },
];

export function DesignPanel() {
  const { theme, ambient, setTheme, setAmbient } = useVisual();
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  const close = React.useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  // Escape closes + returns focus to the trigger — same document-level
  // keydown idiom as NavTop's own drawer and V6Modal, scaled down (no tab
  // trap: a two-radiogroup popover doesn't warrant one).
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Clicking outside the popover closes it too — left open by a stray
  // click elsewhere it would just read as a stuck element.
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button
        ref={triggerRef}
        type="button"
        className="pill"
        aria-expanded={open}
        aria-controls={PANEL_ID}
        onClick={() => setOpen((v) => !v)}
        style={{ appearance: "none", cursor: "pointer", background: "transparent", font: "inherit" }}
      >
        ⌘ DESIGN
      </button>
      {open ? (
        <div
          id={PANEL_ID}
          ref={panelRef}
          className="panel"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            zIndex: 60,
            minWidth: 190,
            padding: 14,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <RadioGroup name="theme" label="Theme" options={THEME_OPTIONS} value={theme} onChange={setTheme} />
          <RadioGroup name="ambient" label="Ambient" options={AMBIENT_OPTIONS} value={ambient} onChange={setAmbient} />
        </div>
      ) : null}
    </div>
  );
}

interface RadioGroupProps<T extends string> {
  name: string;
  label: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  /** null = nothing selected yet (only ever true for Ambient's "no
   *  override" state — Theme always resolves to a concrete value). */
  value: T | null;
  onChange: (v: T) => void;
}

function RadioGroup<T extends string>({ name, label, options, value, onChange }: RadioGroupProps<T>) {
  return (
    <fieldset style={{ border: "none", margin: 0, padding: 0 }}>
      <legend className="kicker" style={{ padding: 0, marginBottom: 6 }}>
        {label}
      </legend>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {options.map((opt) => {
          const on = opt.value === value;
          const id = `design-panel-${name}-${opt.value}`;
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
                name={name}
                checked={on}
                onChange={() => onChange(opt.value)}
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
