// verify-govern.mjs — D0692 frame-budget governor, D0697 micro-delay, D0699
// paused-until-visible. Run from app/: `node verify-govern.mjs`
//
// Offline. Two halves:
//
//  §1-3 replay the governor's update rule against synthetic frame series. The
//  rule is pure arithmetic, so it can be tested exactly — no browser, no
//  timing flake, and a regression in the constants fails deterministically
//  rather than "sometimes on a slow runner".
//
//  §4-5 are source assertions over every rAF driver in app/src. That is the
//  D0699 half: "paused until visible" is already implemented by
//  observeDrawable(), and this is what stops the next author from adding a
//  sixth loop that runs in a hidden tab. It REPORTS the drivers it found and
//  checked rather than printing a bare pass — a gate that says "ok" without
//  saying over what is the failure mode this repo has hit repeatedly.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { makeReporter } from "./verify-lib.mjs";

const appDir = dirname(fileURLToPath(import.meta.url));
const R = makeReporter("verify-govern");
const read = (rel) => readFileSync(join(appDir, rel), "utf8");

/* ── the REAL rule, imported ───────────────────────────────────────────────
   Node 22 strips types, so the shipped implementation is what runs here. This
   is deliberate: an earlier draft of this file re-implemented the arithmetic,
   which passes whenever the copy and the source agree — including when both
   are wrong, and including when the loop stops calling the rule entirely. The
   thresholds below are the SPEC and are asserted against the source separately
   in §1, so changing a constant still has to be a deliberate two-file edit. */
import { governorStep, SHED_RATE, RECOVER_RATE, FLOOR } from "./src/design/governor.ts";

const makeGov = () => ({ scale: 1, ema: 60 });
const step = (gov, fps) => governorStep(gov, fps);
function framesUntil(gov, fps, predicate, cap = 5000) {
  let n = 0;
  while (n < cap && !predicate(gov)) { step(gov, fps); n++; }
  return n;
}

R.group("── 1 · the source matches this spec ───────────────────────");
{
  const src = read("src/design/useAnimationClock.ts") + read("src/design/governor.ts");
  const pairs = [
    ["shed rate", `0.012`], ["recover rate", `0.004`],
    ["ema alpha", `0.08`], ["shed threshold", `42`],
    ["recover threshold", `56`], ["floor", `0.5`],
  ];
  const missing = pairs.filter(([, lit]) => !src.includes(lit)).map(([name]) => name);
  R.ok(missing.length === 0,
    `useAnimationClock.ts still uses the constants this file asserts (${pairs.length} checked)`,
    missing.length ? `not found in source: ${missing.join(", ")}` : "");
  R.ok(/data-gov/.test(src), "the dial is published to the DOM (data-gov) — a silent governor is unreviewable");
  R.ok(/RESUME_GAP_MS/.test(src),
    "a resume threshold exists, distinct from MAX_STEP_MS",
    "without it a returning hidden tab reads as one catastrophic frame and sheds quality for nothing");
}

R.group("── 2 · it sheds under load and clamps at the floor ─────────");
{
  const gov = makeGov();
  const n = framesUntil(gov, 30, (g) => g.scale < 1);
  R.ok(gov.scale < 1, `sustained 30fps sheds quality (scale ${gov.scale.toFixed(3)} after ${n} frames to first shed)`);
  framesUntil(gov, 30, (g) => g.scale <= FLOOR);
  R.ok(Math.abs(gov.scale - FLOOR) < 1e-9, `it clamps at the ${FLOOR} floor and never below (got ${gov.scale.toFixed(3)})`);
  // 500 more frames of the same load must not push it lower.
  for (let i = 0; i < 500; i++) step(gov, 30);
  R.ok(gov.scale === FLOOR, `500 further stalled frames leave it pinned at the floor (${gov.scale})`);
}

R.group("── 3 · recovery is ASYMMETRIC — the whole point ────────────");
{
  // Measure the PER-FRAME step in steady state, with the EMA already settled at
  // the target load. An earlier version of this check timed 1.0→0.9 against
  // 0.9→1.0 and compared them — which quietly passes symmetric rates, because
  // most of the recovery time is the EMA climbing from 30 back over the 56
  // threshold, not the dial moving. Isolating the rate is what makes the
  // assertion actually about asymmetry.
  const shedding = { scale: 0.8, ema: 20 };   // ema already well below SHED_BELOW
  governorStep(shedding, 20);
  const shedStep = 0.8 - shedding.scale;

  const recovering = { scale: 0.8, ema: 120 }; // ema already well above RECOVER_ABOVE
  governorStep(recovering, 120);
  const recoverStep = recovering.scale - 0.8;

  R.info(`per-frame steady-state step — shed ${shedStep.toFixed(4)} · recover ${recoverStep.toFixed(4)}`);
  R.ok(Math.abs(shedStep - SHED_RATE) < 1e-9, `shedding moves the dial by exactly SHED_RATE (${SHED_RATE})`);
  R.ok(Math.abs(recoverStep - RECOVER_RATE) < 1e-9, `recovery moves it by exactly RECOVER_RATE (${RECOVER_RATE})`);
  R.ok(shedStep > recoverStep * 2.5,
    `shedding is materially faster than recovery (${(shedStep / recoverStep).toFixed(1)}x, need >2.5x)`,
    "symmetric rates pump: shedding relieves load, fps recovers, quality returns, load returns");

  // Hysteresis: between the two thresholds the dial must sit still, or it
  // oscillates every frame it spends on the boundary.
  const idle = { scale: 0.8, ema: 50 };  // between SHED_BELOW 42 and RECOVER_ABOVE 56
  governorStep(idle, 50);
  R.ok(idle.scale === 0.8, `between the thresholds the dial holds (hysteresis band, got ${idle.scale})`);
}

R.group("── 4 · every rAF driver is visibility-gated (D0699) ────────");
{
  // Walk app/src for requestAnimationFrame, then check each owning file
  // reaches the shared visibility machinery. Measurement-only rAFs (a single
  // deferred read, a double-rAF settle) are not drivers and are exempt by
  // name with the reason attached.
  const MEASURE_ONLY = new Map([
    ["src/design/useChartMetrics.ts", "one deferred measurement, not a loop"],
    ["src/mempool/useFitToView.ts", "one deferred measurement, not a loop"],
    ["src/mempool/useRibbonGlide.ts", "double-rAF FLIP play step, ends on its own"],
    ["src/pages/markets/charts.tsx", "one-shot mount fade"],
    ["src/pages/monero/MarketsThesisTab.tsx", "one-shot mount fade"],
    ["src/pages/monero/TechTab.tsx", "one-shot mount fade"],
    ["src/routes/useRouteChrome.ts", "rAF-throttled scroll save, ends on its own"],
    ["src/routes/RouteAnnouncer.tsx", "bounded retry for the new heading, stops after READ_FRAMES"],
  ]);
  // The SHARED machinery in design/usePageActive.ts…
  const SHARED = /observeDrawable|isPageActive|onPageActiveChange|usePageActive|useElementActive/;
  // …and the primitives it wraps. A driver that rolls its own IntersectionObserver
  // plus a visibilityState read IS correctly paused — useMemCanvas.ts and
  // use-proto-canvas.tsx both predate the shared helper and do exactly that. So
  // this gate must not fail them: "runs in a hidden tab" is the defect, and they
  // do not. Duplicated infrastructure is real but lesser debt, so it is REPORTED
  // as its own count rather than folded into either the pass or the failure —
  // conflating "wrong" with "untidy" is how a gate gets ignored.
  const PRIVATE = /visibilityState|visibilitychange|IntersectionObserver/;

  const walk = (dir, out = []) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) walk(full, out);
      else if (/\.tsx?$/.test(e.name)) out.push(full);
    }
    return out;
  };

  const drivers = [];
  const exempt = [];
  const ungated = [];
  const privatelyGated = [];
  for (const f of walk(join(appDir, "src"))) {
    const src = readFileSync(f, "utf8");
    if (!/requestAnimationFrame/.test(src)) continue;
    const rel = relative(appDir, f);
    if (MEASURE_ONLY.has(rel)) { exempt.push(`${rel} — ${MEASURE_ONLY.get(rel)}`); continue; }
    drivers.push(rel);
    if (SHARED.test(src)) continue;
    if (PRIVATE.test(src)) privatelyGated.push(rel);
    else ungated.push(rel);
  }

  R.info(`${drivers.length} rAF driver(s) checked · ${exempt.length} measurement-only, exempt by name:`);
  for (const e of exempt) R.info(`    ${e}`);
  R.ok(drivers.length > 0, `the sweep actually found drivers (${drivers.length}) — zero would mean a broken scan, not a clean repo`);
  R.ok(ungated.length === 0,
    `no rAF driver runs unpaused in a hidden tab (${drivers.length} checked)`,
    ungated.length ? `UNPAUSED:\n     ${ungated.join("\n     ")}` : "");
  R.info(`${drivers.length - privatelyGated.length} use the shared gate · ${privatelyGated.length} roll their own (correct, but duplicated infrastructure — standing debt, not a failure):`);
  for (const p of privatelyGated) R.info(`    ${p}`);
}

R.group("── 5 · micro-delay + governor consumer (D0697) ─────────────");
{
  const pending = read("src/design/usePendingDelay.ts");
  R.ok(/PENDING_DELAY_MS\s*=\s*100/.test(pending), "the pending threshold is 100ms — below it a spinner is a flicker, not feedback");
  R.ok(/setShown\(false\)/.test(pending) && /clearTimeout/.test(pending),
    "it clears synchronously and tears its timer down, so quick bursts cannot accumulate into a spinner");

  const art = read("src/design/ArtBackground.tsx");
  R.ok(/governorScale\(\)/.test(art), "ParticleField consumes the dial");
  R.ok(!/seed\(\)[\s\S]{0,200}governorScale/.test(art),
    "the dial gates DRAWING, not seeding",
    "reseeding on a dial move would re-scatter the field and break the determinism verify-prng.mjs asserts");
}

process.exit(R.finish());
