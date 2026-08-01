/**
 * design/deviceTier.ts — one source of truth for how much visual system this
 * device can afford.
 *
 * The v6.0.2 ambient stack (design/AmbientField.tsx + styles-ambient.css)
 * composites 43 layers at the default `busy` level — 8 plates up to 92vmax,
 * 30 orbs, 2 dust sheets, a 320%-translating sweep and a 170vmax conic
 * ribbon — plus one rAF canvas per `.art` (design/ArtBackground.tsx's
 * ParticleField, mounted on every page via layout/AppShell.tsx). That is a
 * reasonable desktop budget and an unreasonable phone one. `tier` is the knob
 * that decides which budget applies.
 *
 * This is NOT a third ⌘ DESIGN knob. VisualContext.tsx's header rules that
 * out deliberately and that call stands: `tier` is *derived* state, never
 * persisted and never surfaced as a radio group. It is exposed on VisualState
 * read-only so components can size themselves without each re-deriving it.
 *
 * The `?tier=` override exists for two real users:
 *   - verify-perf.mjs, which must be able to assert each tier's layer census
 *     deterministically without faking navigator fields;
 *   - anyone whose hardware the heuristic misreads (a throttled laptop that
 *     reports 16 cores, a desktop behind a coarse-pointer touchscreen).
 * It is read once per page load and is not persisted.
 *
 * Ordering matters. `prefers-reduced-motion` and `saveData` are declarations
 * of intent, so they outrank hardware; an explicit `?tier=` outranks both,
 * because someone who typed it means it.
 */

export type Tier = "high" | "mid" | "low";

export const TIERS: readonly Tier[] = ["high", "mid", "low"] as const;

export function isTier(v: string | null | undefined): v is Tier {
  return v === "high" || v === "mid" || v === "low";
}

/**
 * `navigator.deviceMemory` and `navigator.connection` are not in lib.dom for
 * the TS version this repo pins, and both are absent in Safari and Firefox
 * (which is itself signal — see `scoreDevice`). Narrow, optional shape rather
 * than an `any` cast so the read sites stay type-checked.
 */
interface PerfNavigator extends Navigator {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

/** Read `?tier=` from the current URL. Invalid values are ignored, not thrown. */
function readOverride(): Tier | null {
  try {
    const raw = new URLSearchParams(window.location.search).get("tier");
    return isTier(raw) ? raw : null;
  } catch {
    return null;
  }
}

/**
 * One-shot, non-reactive read of the reduced-motion preference.
 *
 * Exported (v6.1.3) rather than kept private because `design/viewTransition.ts`
 * needs the RAW preference, separately from the tier. `computeTier()` below
 * folds this into a `"low"` verdict — correct for its own consumers, which
 * scale ambient layer counts and particle density — but a view transition must
 * still RUN under reduced motion and merely lose its spatial movement, so
 * vtSupported() has to be able to tell "low because weak hardware" from "low
 * because the user asked for less motion". Sharing this one helper is what
 * keeps that distinction from becoming a second copy of the media query:
 * verify-chartkit.mjs fails any ad-hoc `matchMedia("(prefers-reduced-motion")`
 * read outside this file and useReducedMotion.ts, and it is right to.
 *
 * Components must still use `useReducedMotion()` — this one does not react to
 * the OS setting changing after mount, which is a bug in a component and
 * deliberate here.
 */
export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    // `window` undefined under SSR lands here too — no preference is the
    // right answer when there is no user agent to have one.
    return false;
  }
}

function prefersSaveData(): boolean {
  try {
    return (navigator as PerfNavigator).connection?.saveData === true;
  } catch {
    return false;
  }
}

/**
 * Demotion score. Start from "capable" and add points for every signal that
 * says otherwise; 0–8, higher is weaker.
 *
 * The defaults for missing fields (8 cores, 8 GB) are deliberately optimistic.
 * `deviceMemory` is Chromium-only, so Safari and Firefox report nothing — and
 * a desktop Firefox must not be demoted for a field its engine declines to
 * ship. The viewport-area and coarse-pointer signals are what actually catch
 * phones on those engines, and they are engine-agnostic.
 *
 * Tor Browser is the interesting case and it lands correctly by accident of
 * its own defenses: it spoofs `hardwareConcurrency` to 2 and omits
 * `deviceMemory`, which alone scores 2 → `mid`, and on a phone-sized or
 * letterboxed window the area signal carries it to `low`.
 */
function scoreDevice(): number {
  const nav = navigator as PerfNavigator;
  let score = 0;

  const cores = nav.hardwareConcurrency || 8;
  score += cores <= 4 ? 2 : cores <= 6 ? 1 : 0;

  const memory = nav.deviceMemory ?? 8;
  score += memory <= 2 ? 2 : memory <= 4 ? 1 : 0;

  // Viewport area, not width: a 1024×768 tablet and a 1440×400 letterboxed
  // window have very different compositing costs at the same width.
  const area = window.innerWidth * window.innerHeight;
  score += area < 500_000 ? 2 : area < 1_200_000 ? 1 : 0;

  try {
    if (window.matchMedia("(pointer: coarse)").matches) score += 1;
  } catch {
    /* matchMedia absent — no signal, no penalty */
  }

  return score;
}

function computeTier(): Tier {
  if (typeof window === "undefined" || typeof navigator === "undefined") return "low";

  const override = readOverride();
  if (override) return override;

  // Stated intent outranks hardware.
  if (prefersReducedMotion() || prefersSaveData()) return "low";

  const score = scoreDevice();
  return score >= 4 ? "low" : score >= 2 ? "mid" : "high";
}

let cached: Tier | null = null;

/**
 * The device tier for this page load. Memoized: every consumer must agree,
 * and a tier that changed mid-session would tear down and reseed every canvas
 * and orb field on a window resize. Rotation and resize deliberately do NOT
 * re-tier — see verify-perf.mjs's orientation check, which asserts the canvas
 * re-fits without the tier moving.
 */
export function getDeviceTier(): Tier {
  if (cached === null) cached = computeTier();
  return cached;
}

/** Test seam — verify-perf.mjs reloads the page instead, but unit callers can reset. */
export function resetDeviceTierForTests(): void {
  cached = null;
}

/**
 * Pick a per-tier value. Keeps the tier table readable at the call site
 * instead of scattering ternaries:
 *
 *   const plates = byTier(tier, { high: 8, mid: 4, low: 2 });
 */
export function byTier<T>(tier: Tier, table: Record<Tier, T>): T {
  return table[tier];
}
