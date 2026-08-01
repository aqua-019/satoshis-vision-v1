/**
 * design/VisualContext.tsx — the ⌘ DESIGN panel's two knobs, nothing else.
 *
 * This is deliberately NOT a general tweaks system — PORTING.md's "what's
 * deliberately NOT in this repo" already rules that out ("Tweaks panel —
 * that's a design-time tool, not user-facing UX"). Resist growing a third
 * knob here without revisiting that call.
 *
 *   theme    "classic" | "indigo" | "phosphor" — default "classic". Written
 *            to `document.documentElement`'s `data-theme` attribute, which
 *            is the whole of styles-theme.css's (L2) toggle mechanism.
 *   ambient  "calm" | "busy" | "chaotic" | null — default null, meaning
 *            "no user override; each page keeps rendering its own
 *            ArtBackground `intensity` prop". Once a user picks a value
 *            here it overrides every page's own choice, everywhere,
 *            until changed back.
 *
 * v6.0.8 adds a THIRD value, `tier`, and it is explicitly not a third knob —
 * the rule above still holds. `tier` is derived (design/deviceTier.ts), never
 * persisted, and has no setter and no radio group in DesignPanel. It rides
 * here only so consumers share one memoized answer instead of each calling
 * `getDeviceTier()` and each re-deriving it. It is stamped to
 * `documentElement`'s `data-tier` for the same reason `theme` is:
 * styles-ambient.css needs to gate on it, and index.html's pre-paint script
 * stamps it first so a phone never paints 43 layers before React mounts.
 *
 * Persistence reuses `safeStore()` from data/useMarketHistory.ts (a bare
 * try/catch around `window.localStorage`) under the `xmri.` prefix already
 * established by data/useCachedFeed.ts's `xmri.feed.` keys. It deliberately
 * does NOT reuse that module's `readCache`/`writeCache` — those are TTL-
 * bound (7 days, see LS_MAX_AGE_MS) for market-data staleness, and a user
 * preference must never silently expire.
 */

import * as React from "react";
import { flushSync } from "react-dom";
import { safeStore } from "@/data/useMarketHistory";
import { getDeviceTier, type Tier } from "./deviceTier";
import { startVt } from "./viewTransition";

export type ThemeKey = "indigo" | "classic" | "phosphor";
export type AmbientKey = "calm" | "busy" | "chaotic";

const THEME_KEY = "xmri.theme";
const AMBIENT_KEY = "xmri.ambient";

// Load-bearing, not just a type guard: a `data-theme` value this rejects
// falls back silently (readPref returns null → the "classic" default below),
// which reads as a CSS bug rather than a rejected value. Every member of
// ThemeKey must be listed here or it will never round-trip out of storage.
function isThemeKey(v: string | null): v is ThemeKey {
  return v === "indigo" || v === "classic" || v === "phosphor";
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
  /** Derived, read-only. See the header — this is not a knob. */
  tier: Tier;
  setTheme: (t: ThemeKey) => void;
  setAmbient: (a: AmbientKey | null) => void;
}

/** Safe default so `import { App } from "@/App"` (host runtimes that skip
 *  main.tsx entirely — see PORTING.md) still render correctly with no
 *  <VisualProvider> mounted: classic as a plain data default (the CSS
 *  attribute itself won't be stamped without the provider's effect, so
 *  chrome falls back to the classic look — the site's default, not a
 *  fallback path) and `ambient: null` so every page just uses its own
 *  ArtBackground intensity. */
const DEFAULT_VISUAL: VisualState = {
  theme: "classic",
  ambient: null,
  // Not the "low" fallback getDeviceTier() uses for a non-DOM host: a
  // provider-less mount is a host runtime rendering into a real browser, so
  // ask the real heuristic. Cheap — it memoizes on first call.
  get tier() {
    return getDeviceTier();
  },
  setTheme: () => {},
  setAmbient: () => {},
};

const VisualCtx = React.createContext<VisualState>(DEFAULT_VISUAL);

export function useVisual(): VisualState {
  return React.useContext(VisualCtx);
}

export function VisualProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<ThemeKey>(() => readPref(THEME_KEY, isThemeKey) ?? "classic");
  const [ambient, setAmbientState] = React.useState<AmbientKey | null>(() => readPref(AMBIENT_KEY, isAmbientKey));

  // Derived, not state: getDeviceTier() memoizes for the page's lifetime, so
  // this is stable across every render and never triggers one.
  const tier = getDeviceTier();

  // The app's FIRST `documentElement` write. index.html's pre-paint inline
  // script stamps this same attribute before first paint (so a hard reload
  // never flashes the wrong palette); this effect keeps it in sync with
  // in-session changes and is the only thing that ever moves it afterward.
  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Same contract for `data-tier`. index.html's inline script runs a
  // deliberately smaller heuristic (it has no module graph to reach into), so
  // this re-stamp is what reconciles the two — including the `?tier=` override,
  // which the inline version does honour, and the viewport-area signal, which
  // it does not. Re-stamping an identical value is a no-op in every engine.
  React.useEffect(() => {
    document.documentElement.setAttribute("data-tier", tier);
  }, [tier]);

  // D0737 theme crossfade. `data-theme` is written IMPERATIVELY here, inside
  // the transition's update callback, rather than left to the `useEffect`
  // below — the browser needs the attribute change to land as part of the
  // same synchronous DOM update whose before/after it is snapshotting.
  // `flushSync` forces React's state catch-up (`setThemeState`) to commit in
  // that same synchronous pass, so anything reading `theme` from context
  // (ThemeToggle's active radio, etc.) is correct in both snapshots too.
  // The `useEffect` at line ~130 that also stamps `data-theme` is NOT
  // changed to `useLayoutEffect` to compensate — React 18 does not
  // guarantee passive effects flush inside `flushSync`, and swapping it
  // would additionally raise the SSR "useLayoutEffect does nothing on the
  // server" warning during scripts/prerender.mjs (VisualProvider renders
  // under SSR). Left as a passive effect, it now just re-stamps a value
  // that is already correct — an intentional no-op, not an oversight.
  const setTheme = React.useCallback((t: ThemeKey) => {
    writePref(THEME_KEY, t);
    startVt("theme", undefined, () => {
      document.documentElement.setAttribute("data-theme", t);
      flushSync(() => setThemeState(t));
    });
  }, []);

  const setAmbient = React.useCallback((a: AmbientKey | null) => {
    setAmbientState(a);
    writePref(AMBIENT_KEY, a);
  }, []);

  const value = React.useMemo<VisualState>(
    () => ({ theme, ambient, tier, setTheme, setAmbient }),
    [theme, ambient, tier, setTheme, setAmbient],
  );

  return <VisualCtx.Provider value={value}>{children}</VisualCtx.Provider>;
}
