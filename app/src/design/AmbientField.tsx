/**
 * design/AmbientField.tsx — the DOM that styles-ambient.css (L3) styles.
 *
 * All geometry, timing and colour live in that stylesheet; this component's
 * only job is to mount the right elements — see its own "Layer budget"
 * comment for the z-index stack this produces (#bg-plates → #bg-fx →
 * #bg-grain, all fixed, all behind the app).
 *
 * Mounted once in App.tsx, as a sibling of <Routes> — deliberately OUTSIDE
 * every page's `.art` (layout/AppShell.tsx), which is `isolation: isolate`
 * (styles.css:203). An aurora layer rendered inside that subtree would be
 * trapped in ONE page's stacking context instead of sitting behind all of
 * them. `#root` creates no stacking context of its own, so a sibling of
 * <Routes> is exactly deep enough.
 */

import * as React from "react";
import { useVisual } from "./VisualContext";
import { useReducedMotion } from "./useReducedMotion";

const ORB_COUNT = { calm: 10, busy: 30, chaotic: 60 } as const;

// mulberry32 — tiny deterministic 32-bit PRNG (xorshift + multiply). Not
// cryptographic; the only property that matters here is that a fixed seed
// always reproduces the identical field, so the layout is stable across
// re-renders and reloads (load-bearing for visual review/screenshots).
//
// protocols/sim-random.ts already has a random-hex helper, but its own file
// header restricts it to the educational simulators' illustrative output —
// this is a different consumer (decor, not data) with a different contract,
// so it gets its own generator rather than reaching across that boundary.
function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fixed, arbitrary seed. Only `count` (from the Ambient knob) varies the
// output — the same count always yields the same field.
const ORB_SEED = 0x0c0ffee;

/** One `#bg-fx .orb` span's worth of custom properties (styles-ambient.css
 *  `@keyframes orb-rise` reads all seven via `var(--x)` etc.). */
export interface SeededOrb {
  x: string;
  s: string;
  d: string;
  dl: string;
  o: number;
  sw: string;
  c: string;
}

// Colour routes through the EXISTING --amb-dust-* tokens rather than a new
// variable: L3's governing rule is "every colour is an --amb-* token that
// styles-theme.css re-binds" (see that file's header), and this component
// may not touch the stylesheet that defines them. --amb-dust-1/2/3 are
// already theme-bound — warm-neutral under classic, violet under indigo —
// so picking among them per-orb gives free per-theme retinting AND a little
// per-orb colour variety for free.
const DUST_TOKENS = ["var(--amb-dust-1)", "var(--amb-dust-2)", "var(--amb-dust-3)"] as const;

/** Seeded, deterministic orb field. The v6 prototype hardcoded 30 of these
 *  as inline styles (a 6KB wall of near-duplicate numbers) — `count` is the
 *  only input here, everything else is derived from the seeded PRNG. */
export function seedOrbs(count: number): SeededOrb[] {
  const rnd = mulberry32(ORB_SEED);
  return Array.from({ length: count }, () => {
    const d = 22 + rnd() * 26; // 22–48s per full rise (bottom → off the top)
    return {
      x: `${(rnd() * 100).toFixed(2)}vw`,
      s: `${(6 + rnd() * 14).toFixed(2)}vmin`,
      d: `${d.toFixed(2)}s`,
      // Negative delay scatters each orb to a random point in its OWN cycle,
      // so the field reads as already-in-motion on first paint instead of
      // every orb launching from the floor in lockstep.
      dl: `${(-rnd() * d).toFixed(2)}s`,
      o: Number((0.25 + rnd() * 0.4).toFixed(2)),
      sw: `${((rnd() - 0.5) * 24).toFixed(2)}vw`,
      c: DUST_TOKENS[Math.floor(rnd() * DUST_TOKENS.length)],
    };
  });
}

/** React's CSSProperties type doesn't model arbitrary custom properties —
 *  this is the standard escape hatch for setting `--x` etc. via inline
 *  style, scoped to exactly the seven properties the CSS keyframe reads. */
type OrbCSSVars = React.CSSProperties &
  Partial<Record<"--x" | "--s" | "--d" | "--dl" | "--o" | "--sw" | "--c", string | number>>;

export function AmbientField() {
  const { ambient } = useVisual();
  const reduced = useReducedMotion();

  // AmbientField is global (one mount for the whole app), not per-page, so
  // it has no "page's own value" to fall back to the way ArtBackground's
  // `intensity` prop does (§5) — null just means "no user override yet",
  // so it takes the same default ArtBackground itself defaults to ("busy").
  const count = ORB_COUNT[ambient ?? "busy"];

  // Under reduced motion, skip the orb spans entirely rather than mounting
  // (up to 60) elements the CSS is just going to hide via
  // `opacity: 0 !important` anyway — cheaper, same visible result.
  const ORBS = React.useMemo(() => (reduced ? [] : seedOrbs(count)), [count, reduced]);

  return (
    <>
      <div id="bg-plates">
        {Array.from({ length: 8 }, (_, i) => (
          <div className="plate" key={i} />
        ))}
      </div>
      <div id="bg-fx">
        <div className="dust" />
        <div className="dust d2" />
        <div className="sweep" />
        <div className="ribbon" />
        {ORBS.map((o, i) => (
          <span
            className="orb"
            key={i}
            style={
              {
                "--x": o.x,
                "--s": o.s,
                "--d": o.d,
                "--dl": o.dl,
                "--o": o.o,
                "--sw": o.sw,
                "--c": o.c,
              } as OrbCSSVars
            }
          />
        ))}
      </div>
      <div id="bg-grain" />
    </>
  );
}
