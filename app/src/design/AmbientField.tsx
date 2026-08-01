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
import { byTier } from "./deviceTier";
import { mulberry32 } from "./prng";
import { useGovernorScale } from "./useAnimationClock";

const ORB_COUNT = { calm: 10, busy: 30, chaotic: 60 } as const;

// v6.0.8 tier gating — see deviceTier.ts's header for why this exists at
// all: 43 unconditional compositor layers at the default `busy` was a
// reasonable desktop budget and an unreasonable phone one. Elements excluded
// per tier must not be *mounted*, not merely hidden — a `display:none` node
// still gets a compositor layer promoted for it via `will-change`, which is
// the entire cost this is removing. See styles-ambient.css §Task B for the
// matching `will-change` drop on `low`.
const PLATE_COUNT = { high: 8, mid: 4, low: 2 } as const;
const DUST_COUNT = { high: 2, mid: 1, low: 0 } as const;

// mulberry32 (design/prng.ts) — tiny deterministic 32-bit PRNG (xorshift +
// multiply). Not cryptographic; the only property that matters here is that
// a fixed seed always reproduces the identical field, so the layout is
// stable across re-renders and reloads (load-bearing for visual
// review/screenshots). It's a sequential stream — right for this one-shot
// "walk the array in order" seeding pass — not the index-addressable `h3`
// also exported from that module; see its header for when each applies.
//
// protocols/sim-random.ts already has a random-hex helper, but its own file
// header restricts it to the educational simulators' illustrative output —
// this is a different consumer (decor, not data) with a different contract,
// so prng.ts is a separate module rather than reaching across that boundary.

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
  const { ambient, tier } = useVisual();
  const reduced = useReducedMotion();

  // AmbientField is global (one mount for the whole app), not per-page, so
  // it has no "page's own value" to fall back to the way ArtBackground's
  // `intensity` prop does (§5) — null just means "no user override yet",
  // so it takes the same default ArtBackground itself defaults to ("busy").
  const count = ORB_COUNT[ambient ?? "busy"];

  // Tier caps the Ambient knob rather than replacing it: `mid` still honours
  // calm/busy/chaotic's *relative* ordering, just clamped to 10 so `chaotic`
  // (60) doesn't reappear through the back door on a mid-tier phone. `low`
  // drops orbs entirely — the two surviving plates (below) carry the whole
  // visual on that tier.
  const orbCount = byTier(tier, { high: count, mid: Math.min(10, count), low: 0 });

  // Under reduced motion, skip the orb spans entirely rather than mounting
  // (up to 60) elements the CSS is just going to hide via
  // `opacity: 0 !important` anyway — cheaper, same visible result.
  const ORBS = React.useMemo(() => (reduced ? [] : seedOrbs(orbCount)), [orbCount, reduced]);

  // D0692 — the frame-budget governor, applied to the one count here that is
  // actually a lever. Orbs run from 0 to 60 animated compositor layers (the
  // Ambient knob × tier), and they are the cheapest thing in the stack to lose:
  // each is a blurred, semi-transparent blob on a 22–48s rise, so a thinner
  // field reads as "calmer", not as "broken".
  //
  // SLICED, NEVER RESEEDED — same rule as ParticleField, for the same reasons.
  // `seedOrbs` walks a sequential PRNG, so orbs 0..N-1 of a 30-orb field are
  // byte-identical to a 30→N thinning; re-running seedOrbs(N) would produce the
  // same prefix but re-key the useMemo and rebuild the array on every dial move.
  // Slicing from the END also means orb 0 is always present: the field thins in
  // place instead of re-scattering, which is the difference between a quality
  // change you do not notice and one that looks like a bug.
  //
  // The dial is quantised to 0.1 by useGovernorScale, so a full 1.0→0.5 shed
  // re-renders this list ~5 times, not once per frame for ~42 frames.
  //
  // DELIBERATELY NOT GOVERNED: plates, dust, sweep and ribbon. Not an oversight
  // and not laziness — verify-perf.mjs §2 asserts those four as an exact
  // per-tier census (high 8/2/1/1, mid 4/1/0/0, low 2/0/0/0), i.e. another gate
  // owns them as a fixed MOUNT budget. Making them load-dependent would trade a
  // deterministic, reviewable invariant for at most 12 layers, while the orbs
  // alone are up to 60. If they are ever governed, that census has to become a
  // range in the same change, and verify-perf.mjs is not this file's to edit.
  const gov = useGovernorScale();
  const drawnOrbs = Math.round(ORBS.length * gov);

  // Plates are styled positionally by :nth-child in styles-ambient.css, sized
  // 80/92/72/76/56/64/52/46vmax for indices 1..8 (declaration order, not
  // descending) — so slicing to the FIRST N via Array.from({length: N}) is
  // not an arbitrary truncation, it happens to keep exactly the largest,
  // best-spread plates:
  //   mid (4): indices 1-4 = 80/92/72/76vmax, the four largest of the eight,
  //     anchored upper-left / center-right / lower-left / upper-center — the
  //     four screen quadrants are still covered.
  //   low (2): indices 1-2 = 80/92vmax, the two largest overall, anchored
  //     upper-left and center-right — a diagonal spread across the viewport
  //     rather than two overlapping circles in one corner.
  // If the CSS ever reorders these rules, this comment (and the mapping it
  // documents) must move with it — nth-child selects by DOM position, not by
  // any stable per-plate identity.
  const plateCount = byTier(tier, PLATE_COUNT);
  const dustCount = byTier(tier, DUST_COUNT);

  return (
    <>
      <div id="bg-plates">
        {Array.from({ length: plateCount }, (_, i) => (
          <div className="plate" key={i} />
        ))}
      </div>
      <div id="bg-fx">
        {dustCount >= 1 && <div className="dust" />}
        {dustCount >= 2 && <div className="dust d2" />}
        {/* sweep + ribbon are `high`-only: the sweep's 320% translate and the
            ribbon's 170vmax (pre-clamp) conic gradient are the two most
            expensive individual layers in the stack — see styles-ambient.css
            Task B for the size clamp that also applies when they DO render. */}
        {tier === "high" && <div className="sweep" />}
        {tier === "high" && <div className="ribbon" />}
        {ORBS.slice(0, drawnOrbs).map((o, i) => (
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
