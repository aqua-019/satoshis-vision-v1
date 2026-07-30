/**
 * design/VisualContext.tsx — the ⌘ DESIGN panel's two knobs, nothing else.
 *
 * This is deliberately NOT a general tweaks system — PORTING.md's "what's
 * deliberately NOT in this repo" already rules that out ("Tweaks panel —
 * that's a design-time tool, not user-facing UX"). Resist growing a third
 * knob here without revisiting that call.
 *
 *   theme    "indigo" | "classic" — default "indigo". Written to
 *            `document.documentElement`'s `data-theme` attribute, which is
 *            the whole of styles-theme.css's (L2) toggle mechanism.
 *   ambient  "calm" | "busy" | "chaotic" | null — default null, meaning
 *            "no user override; each page keeps rendering its own
 *            ArtBackground `intensity` prop". Once a user picks a value
 *            here it overrides every page's own choice, everywhere,
 *            until changed back.
 *
 * Persistence reuses `safeStore()` from data/useMarketHistory.ts (a bare
 * try/catch around `window.localStorage`) under the `xmri.` prefix already
 * established by data/useCachedFeed.ts's `xmri.feed.` keys. It deliberately
 * does NOT reuse that module's `readCache`/`writeCache` — those are TTL-
 * bound (7 days, see LS_MAX_AGE_MS) for market-data staleness, and a user
 * preference must never silently expire.
 */

import * as React from "react";
import { safeStore } from "@/data/useMarketHistory";

export type ThemeKey = "indigo" | "classic";
export type AmbientKey = "calm" | "busy" | "chaotic";

const THEME_KEY = "xmri.theme";
const AMBIENT_KEY = "xmri.ambient";

function isThemeKey(v: string | null): v is ThemeKey {
  return v === "indigo" || v === "classic";
}
function isAmbientKey(v: string | null): v is AmbientKey {
  return v === "calm" || v === "busy" || v === "chaotic";
}

/** Read a validated preference; corrupt/missing/foreign values all → null.
 *  `getItem` itself (not just the `window.localStorage` access safeStore
 *  guards) can throw in some hardened/.onion configurations, so this gets
 *  its own try/catch rather than trusting a non-null Storage handle. */
function readPref<T extends string>(key: string, isValid: (v: string | null) => v is T): T | null {
  try {
    const raw = safeStore()?.getItem(key) ?? null;
    return isValid(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** Write (or, for `value === null`, clear) a preference. Swallows quota /
 *  private-mode / storage-disabled failures — a preference that fails to
 *  persist should degrade to "forgotten on reload", never throw. */
function writePref(key: string, value: string | null): void {
  try {
    const store = safeStore();
    if (!store) return;
    if (value === null) store.removeItem(key);
    else store.setItem(key, value);
  } catch {
    /* private mode / quota / storage disabled — best effort only */
  }
}

export interface VisualState {
  theme: ThemeKey;
  ambient: AmbientKey | null;
  setTheme: (t: ThemeKey) => void;
  setAmbient: (a: AmbientKey | null) => void;
}

/** Safe default so `import { App } from "@/App"` (host runtimes that skip
 *  main.tsx entirely — see PORTING.md) still render correctly with no
 *  <VisualProvider> mounted: indigo as a plain data default (the CSS
 *  attribute itself won't be stamped without the provider's effect, so
 *  chrome falls back to the classic look — acceptable, not broken) and
 *  `ambient: null` so every page just uses its own ArtBackground intensity. */
const DEFAULT_VISUAL: VisualState = {
  theme: "indigo",
  ambient: null,
  setTheme: () => {},
  setAmbient: () => {},
};

const VisualCtx = React.createContext<VisualState>(DEFAULT_VISUAL);

export function useVisual(): VisualState {
  return React.useContext(VisualCtx);
}

export function VisualProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<ThemeKey>(() => readPref(THEME_KEY, isThemeKey) ?? "indigo");
  const [ambient, setAmbientState] = React.useState<AmbientKey | null>(() => readPref(AMBIENT_KEY, isAmbientKey));

  // The app's FIRST `documentElement` write. index.html's pre-paint inline
  // script stamps this same attribute before first paint (so a hard reload
  // never flashes the wrong palette); this effect keeps it in sync with
  // in-session changes and is the only thing that ever moves it afterward.
  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const setTheme = React.useCallback((t: ThemeKey) => {
    setThemeState(t);
    writePref(THEME_KEY, t);
  }, []);

  const setAmbient = React.useCallback((a: AmbientKey | null) => {
    setAmbientState(a);
    writePref(AMBIENT_KEY, a);
  }, []);

  const value = React.useMemo<VisualState>(
    () => ({ theme, ambient, setTheme, setAmbient }),
    [theme, ambient, setTheme, setAmbient],
  );

  return <VisualCtx.Provider value={value}>{children}</VisualCtx.Provider>;
}
