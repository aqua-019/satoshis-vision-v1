// verify-govern.mjs — D0692 frame-budget governor, D0697 micro-delay, D0699
// paused-until-visible. Run from app/: `node verify-govern.mjs`
//
// Four halves, offline first and browser only where the claim genuinely needs
// a browser:
//
//  §1-4 replay the governor's real update rule against synthetic frame series.
//  The rule is pure arithmetic, so it can be tested exactly — no timing flake,
//  and a regression in the constants fails deterministically rather than
//  "sometimes on a slow runner". §4 covers the two traps that are the actual
//  hazard here (a resuming tab read as a stall; two loops feeding one dial).
//
//  §5-6 are source assertions over every rAF driver in app/src. That is the
//  D0699 half: "paused until visible" is already implemented by
//  observeDrawable(), and this is what stops the next author from adding a
//  sixth loop that runs in a hidden tab. It REPORTS the drivers it found and
//  checked rather than printing a bare pass — a gate that says "ok" without
//  saying over what is the failure mode this repo has hit repeatedly.
//
//  §7 is the one browser check: that a shed is OBSERVABLE and that it actually
//  removes DOM. Both are end-to-end claims about the shipped bundle — a source
//  assertion could only prove the code says the right words.
//
// Needs a server for §7: `npm run build && node scripts/serve-dist.mjs 4173 &`.
//
//   node verify-govern.mjs            all seven sections (needs the server)
//   node verify-govern.mjs --static   §1-6 only, no browser
//
// The flag exists for the same reason verify-origins.mjs has one: CI splits
// into a no-browser `verify:static` job and a `verify:e2e` job that runs against
// scripts/serve-dist.mjs, and this gate has assertions of both kinds. WITHOUT
// the flag a missing server is a FAILURE, never a skip — see §7.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { makeReporter, launch, BASE } from "./verify-lib.mjs";

const staticOnly = process.argv.includes("--static");
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
import {
  governorStep,
  governorSample,
  governorReset,
  SHED_RATE,
  RECOVER_RATE,
  RESUME_GAP_MS,
  NO_BASELINE,
  FLOOR,
} from "./src/design/governor.ts";

const makeGov = () => ({ scale: 1, ema: 60, lastTs: NO_BASELINE });
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
    `the governor still uses the constants this file asserts (${pairs.length} checked)`,
    missing.length ? `not found in source: ${missing.join(", ")}` : "");
  R.ok(/data-gov/.test(src), "the dial is published to the DOM (data-gov) — a silent governor is unreviewable");
  R.ok(/__XMR_GOV__/.test(src),
    "the exact dial is readable from a page context (window.__XMR_GOV__), in the __MEM_FPS__ idiom");
  R.ok(/RESUME_GAP_MS/.test(src),
    "a resume threshold exists, distinct from MAX_STEP_MS",
    "without it a returning hidden tab reads as one catastrophic frame and sheds quality for nothing");
  R.ok(RESUME_GAP_MS > 50,
    `RESUME_GAP_MS (${RESUME_GAP_MS}ms) is above MAX_STEP_MS (50ms)`,
    "at or below it, the 20fps stall the governor exists to catch would be discarded as a resume");
}

R.group("── 2 · it sheds under load and clamps at the floor ─────────");
{
  const gov = makeGov();
  const n = framesUntil(gov, 30, (g) => g.scale < 1);
  R.ok(gov.scale < 1, `sustained 30fps sheds quality (scale ${gov.scale.toFixed(3)} after ${n} frames to first shed)`);
  const toFloor = framesUntil(gov, 30, (g) => g.scale <= FLOOR);
  R.ok(Math.abs(gov.scale - FLOOR) < 1e-9, `it clamps at the ${FLOOR} floor and never below (got ${gov.scale.toFixed(3)}, ${n + toFloor} frames total)`);
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
  const shedding = { scale: 0.8, ema: 20, lastTs: NO_BASELINE };   // ema already well below SHED_BELOW
  governorStep(shedding, 20);
  const shedStep = 0.8 - shedding.scale;

  const recovering = { scale: 0.8, ema: 120, lastTs: NO_BASELINE }; // ema already well above RECOVER_ABOVE
  governorStep(recovering, 120);
  const recoverStep = recovering.scale - 0.8;

  R.info(`per-frame steady-state step — shed ${shedStep.toFixed(4)} · recover ${recoverStep.toFixed(4)}`);
  R.ok(Math.abs(shedStep - SHED_RATE) < 1e-9, `shedding moves the dial by exactly SHED_RATE (${SHED_RATE})`);
  R.ok(Math.abs(recoverStep - RECOVER_RATE) < 1e-9, `recovery moves it by exactly RECOVER_RATE (${RECOVER_RATE})`);
  R.ok(shedStep > recoverStep * 2.5,
    `shedding is materially faster than recovery (${(shedStep / recoverStep).toFixed(1)}x, need >2.5x)`,
    "symmetric rates pump: shedding relieves load, fps recovers, quality returns, load returns");

  // And end to end, on timestamp series rather than on fps numbers: a 30fps
  // stall must shed in materially fewer frames than a 60fps run takes to give
  // the same quality back.
  const shedGov = makeGov();
  let t = 1000;
  let shedFrames = 0;
  while (shedGov.scale > 0.9 && shedFrames < 5000) { governorSample(shedGov, (t += 33.3)); shedFrames++; }
  let backFrames = 0;
  while (shedGov.scale < 1 && backFrames < 20000) { governorSample(shedGov, (t += 16.6)); backFrames++; }
  R.info(`1.0 → 0.9 took ${shedFrames} frames at 30fps · 0.9 → 1.0 took ${backFrames} frames at 60fps`);
  R.ok(backFrames > shedFrames * 2,
    `recovery is materially longer than the shed that caused it (${(backFrames / shedFrames).toFixed(1)}x)`);

  // Hysteresis: between the two thresholds the dial must sit still, or it
  // oscillates every frame it spends on the boundary.
  const idle = { scale: 0.8, ema: 50, lastTs: NO_BASELINE };  // between SHED_BELOW 42 and RECOVER_ABOVE 56
  governorStep(idle, 50);
  R.ok(idle.scale === 0.8, `between the thresholds the dial holds (hysteresis band, got ${idle.scale})`);
}

R.group("── 4 · the two traps, as arithmetic ───────────────────────");
{
  // TRAP 1 — a tab that was hidden for a minute comes back as one enormous
  // "frame". MAX_STEP_MS clamps how far the ANIMATION may advance; it must not
  // be what clamps the MEASUREMENT, so the sampler needs its own resume rule.
  const resumed = makeGov();
  governorSample(resumed, 1000);           // baseline
  governorSample(resumed, 1000 + 60_000);  // one minute hidden
  R.ok(resumed.scale === 1 && resumed.ema === 60,
    `a 60s gap is read as a RESUME, not a stall (scale ${resumed.scale}, ema ${resumed.ema})`,
    "shedding here would degrade quality for a stall that never happened");
  // …and the very next real frame after that resume is measured normally.
  governorSample(resumed, 1000 + 60_000 + 16.6);
  R.ok(resumed.ema > 59 && resumed.ema <= 61,
    `sampling resumes immediately after (ema ${resumed.ema.toFixed(2)} from one 60fps frame)`);

  // The boundary itself: just under RESUME_GAP_MS is a stall and must be read.
  const edge = makeGov();
  governorSample(edge, 0);
  governorSample(edge, RESUME_GAP_MS - 1);
  R.ok(edge.ema < 60, `a ${RESUME_GAP_MS - 1}ms frame is still measured as a stall (ema ${edge.ema.toFixed(2)})`);
  // …and that case only works because the "no baseline" sentinel is not 0. rAF
  // timestamps are measured from navigation start, so the first frames of a page
  // load ARE single-digit ms — a 0 sentinel makes an early real timestamp
  // indistinguishable from "never sampled", and this gate caught exactly that.
  R.ok(NO_BASELINE < 0, `the no-baseline sentinel (${NO_BASELINE}) cannot collide with a real rAF timestamp`);
  const early = makeGov();
  governorSample(early, 0);          // a genuine timestamp of 0 must BASELINE…
  R.ok(early.lastTs === 0, "a timestamp of 0 establishes the baseline rather than being discarded");
  governorSample(early, 16.6);       // …so the next frame is a real reading
  R.ok(early.ema > 60, `and the frame after it is measured (ema ${early.ema.toFixed(2)})`);

  // TRAP 2 — the dial is fed by more than one pre-existing loop (the shared
  // clock and ParticleField's own rAF). rAF gives every callback in a frame the
  // SAME timestamp, so an unguarded second feeder measures a 0ms gap = 1000fps.
  const shared = makeGov();
  governorSample(shared, 0);
  governorSample(shared, 33.3);
  const emaOnce = shared.ema;
  governorSample(shared, 33.3);            // the second loop, same frame
  governorSample(shared, 33.3);            // and a third, for good measure
  R.ok(shared.ema === emaOnce,
    `duplicate samples for one frame are dropped (ema stayed ${emaOnce.toFixed(2)})`,
    "without this guard a second feeder reads 0ms gaps as 1000fps and the dial never sheds");
  const backwards = makeGov();
  governorSample(backwards, 100);
  governorSample(backwards, 116);
  const emaFwd = backwards.ema;
  governorSample(backwards, 90);           // a stale timestamp arriving late
  R.ok(backwards.ema === emaFwd, `a non-advancing timestamp is ignored (ema stayed ${emaFwd.toFixed(2)})`);

  // Subscriber churn must not re-probe the dial from 1: a loop that stops and
  // starts is not new evidence about the device.
  const churn = { scale: 0.62, ema: 30, lastTs: 12_345 };
  governorReset(churn);
  R.ok(churn.scale === 0.62 && churn.ema === 30 && churn.lastTs === NO_BASELINE,
    `a loop restart drops only the timing baseline (scale ${churn.scale} and ema ${churn.ema} survive)`,
    "re-probing from 1 on every mount/unmount makes the dial track subscriber churn, not load");
}

R.group("── 5 · every rAF driver is visibility-gated (D0699) ────────");
{
  // Walk app/src for requestAnimationFrame, then check each owning file
  // reaches the shared visibility machinery. Measurement-only rAFs (a single
  // deferred read, a bounded settle) are not drivers and are exempt — but the
  // exemption lives AT THE CALL SITE, not in a table here.
  //
  // ── WHY THIS IS PER-CALL-SITE ─────────────────────────────────────────
  // This was a Map keyed by FILE PATH. v6.1.6 added
  // `src/layout/NavTop.tsx → "one deferred focus after panel commit"`, which
  // is true of the rAF that was there and became a blanket, permanent
  // exemption for the file — and NavTop is the always-mounted nav shell, on
  // every route, so it is close to the worst file in the tree to switch the
  // check off in. Proven rather than argued: an infinite self-rescheduling rAF
  // planted in NavTop.tsx passed this gate green.
  //
  // A marker now attaches to the individual rAF:
  //
  //     // D0699-EXEMPT: one deferred focus after panel commit, not a loop
  //     const id = requestAnimationFrame(() => …);
  //
  // A file is exempt only when EVERY rAF call site in it carries one, so a new
  // rAF added tomorrow to an "exempt" file is a driver and must be gated. The
  // reason also sits where the person adding the next one will read it.
  const EXEMPT_RE = /D0699-EXEMPT:\s*(.+?)\s*(?:\*\/)?\s*$/;
  const LOOKBACK = 3;   // marker may sit up to 3 lines above its call site
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
  const orphanMarkers = [];
  let sites = 0;
  for (const f of walk(join(appDir, "src"))) {
    const src = readFileSync(f, "utf8");
    if (!/requestAnimationFrame/.test(src)) continue;
    const rel = relative(appDir, f);
    const lines = src.split("\n");

    // Every rAF call site in this file, and whether a marker sits on or above it.
    let unmarked = 0;
    const markedLines = new Set();
    lines.forEach((line, i) => {
      if (!/requestAnimationFrame\s*\(/.test(line)) return;
      sites++;
      let reason = null;
      for (let k = i; k >= Math.max(0, i - LOOKBACK); k--) {
        const m = lines[k].match(EXEMPT_RE);
        if (m) { reason = m[1]; markedLines.add(k); break; }
      }
      if (reason) exempt.push(`${rel}:${i + 1} — ${reason}`);
      else unmarked++;
    });

    // A marker whose call site moved away would silently exempt whatever
    // arrived in its place, which is the file-keyed failure in miniature.
    lines.forEach((line, i) => {
      if (!EXEMPT_RE.test(line) || markedLines.has(i)) return;
      orphanMarkers.push(`${rel}:${i + 1}`);
    });

    if (unmarked === 0) continue;              // every site here is exempt
    drivers.push(rel);
    if (SHARED.test(src)) continue;
    if (PRIVATE.test(src)) privatelyGated.push(rel);
    else ungated.push(rel);
  }

  R.info(`${sites} rAF call site(s) · ${drivers.length} driver file(s) checked · ${exempt.length} exempt AT THE CALL SITE:`);
  for (const e of exempt) R.info(`    ${e}`);
  R.ok(orphanMarkers.length === 0,
    orphanMarkers.length === 0
      ? "every D0699-EXEMPT marker sits on a real rAF call site"
      : `${orphanMarkers.length} orphaned marker(s) — a marker whose rAF moved away exempts whatever lands next`,
    orphanMarkers.join(", "));
  R.ok(drivers.length > 0, `the sweep actually found drivers (${drivers.length}) — zero would mean a broken scan, not a clean repo`);
  R.ok(ungated.length === 0,
    `no rAF driver runs unpaused in a hidden tab (${drivers.length} checked)`,
    ungated.length ? `UNPAUSED:\n     ${ungated.join("\n     ")}` : "");
  R.info(`${drivers.length - privatelyGated.length} use the shared gate · ${privatelyGated.length} roll their own (correct, but duplicated infrastructure — standing debt, not a failure):`);
  for (const p of privatelyGated) R.info(`    ${p}`);
}

R.group("── 6 · consumers: micro-delay (D0697) + the dial ───────────");
{
  const pending = read("src/design/usePendingDelay.ts");
  R.ok(/PENDING_DELAY_MS\s*=\s*100/.test(pending), "the pending threshold is 100ms — below it a spinner is a flicker, not feedback");
  R.ok(/setShown\(false\)/.test(pending) && /clearTimeout/.test(pending),
    "it clears synchronously and tears its timer down, so quick bursts cannot accumulate into a spinner");

  // A hook nobody calls is not a shipped feature. D0697 sat as a well-documented
  // module with ZERO consumers until this assertion was written — its own header
  // listed where it "should be adopted" and that list stayed a list. Asserting
  // the threshold constant while nothing imports the hook is exactly the class of
  // defect this suite exists to catch: a gate green on something that does not run.
  const detail = read("src/mempool/tx-detail.tsx");
  R.ok(/import \{ usePendingDelay \}/.test(detail),
    "D0697 is actually ADOPTED — src/mempool/tx-detail.tsx imports the hook");
  const calls = (detail.match(/usePendingDelay\(/g) || []).length;
  R.ok(calls >= 3,
    `all three tx-detail loading sites are gated (${calls} usePendingDelay call sites)`,
    'LiveTxDetail, LiveBlockDetail and the ring-age decoy resolve — the three the hook\'s own header names as the strongest candidates');
  // The hook must gate the INDICATOR, never the identity the page already knows.
  // Hiding the txid behind the threshold replaces a 90ms spinner with a 90ms
  // hole, which is the same flicker wearing different clothes.
  R.ok(/\{showPending \? \(/.test(detail) && /\{txid\}/.test(detail),
    "it gates the pending INDICATOR, not the data — the txid still renders while the lookup is in flight");

  const art = read("src/design/ArtBackground.tsx");
  R.ok(/governorScale\(\)/.test(art), "ParticleField consumes the dial");
  R.ok(/sampleFrameBudget\(now\)/.test(art),
    "ParticleField's existing rAF FEEDS the dial",
    "the shared clock only has subscribers on /mempool and /simulate — without this the governor is inert on /");
  R.ok(!/seed\(\)[\s\S]{0,200}governorScale/.test(art),
    "the dial gates DRAWING, not seeding",
    "reseeding on a dial move would re-scatter the field and break the determinism verify-prng.mjs asserts");

  const amb = read("src/design/AmbientField.tsx");
  R.ok(/useGovernorScale\(\)/.test(amb), "AmbientField consumes the dial for its orb count");
  R.ok(/ORBS\.slice\(0, drawnOrbs\)/.test(amb),
    "it SLICES the seeded field rather than reseeding a shorter one",
    "reseeding would rebuild the array on every dial move and re-key the memo");
  // Cross-gate invariant: verify-perf.mjs §2 asserts plates/dust/sweep/ribbon
  // as an EXACT per-tier census. If they ever become governor-dependent, that
  // gate turns flaky under load — so the coupling is asserted from this side too.
  const governedFixedLayer = /(plateCount|dustCount)\s*\*\s*gov|gov\s*\*\s*(plateCount|dustCount)/.test(amb);
  R.ok(!governedFixedLayer,
    "plates/dust stay a FIXED per-tier mount budget (verify-perf.mjs §2 asserts them exactly)",
    "governing them makes that census load-dependent; it would have to become a range in the same change");
}

R.group("── 7 · a shed is visible from outside (browser) ────────────");
{
  const reachable = staticOnly
    ? false
    : await fetch(BASE, { method: "GET" }).then((r) => r.ok).catch(() => false);
  if (staticOnly) {
    // An EXPLICIT, caller-requested split — not the gate deciding on its own
    // that it could not be bothered. §1-6 already covered the rule, the traps,
    // the driver sweep and every consumer; what is deferred here is named.
    R.info("§7 not run: --static. It asserts data-gov, __XMR_GOV__ and the orb");
    R.info("   count against a real browser, and belongs in verify:e2e.");
  } else if (!R.ok(reachable, `${BASE} is serving the built app`,
    "start it: npm run build && node scripts/serve-dist.mjs 4173 &")) {
    // Deliberately a FAILURE, not a skip. A gate that quietly drops its only
    // end-to-end assertion when the server is down reports green for a claim it
    // never checked — the exact failure mode this file exists to prevent.
  } else {
    const { browser, engine } = await launch();
    R.info(`engine: ${engine}`);
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    // domcontentloaded + an explicit selector, never networkidle: the FAST
    // polling tier fires every 3s, so the network is never idle. And `attached`,
    // not the default `visible` — an orb can legitimately be at opacity 0 at any
    // moment in its 22–48s rise, and this loop is also actively removing and
    // re-adding orbs, so waiting on one particular span being paintable hangs.
    await page.goto(`${BASE}/?tier=high`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#bg-fx .orb", { state: "attached", timeout: 15000 });

    const hook = await page.evaluate(() => typeof window.__XMR_GOV__?.scale);
    R.ok(hook === "number", `window.__XMR_GOV__.scale is readable from the page (typeof ${hook})`);

    // Feed the real rule a synthetic timestamp series. Only the TIMESTAMPS are
    // synthetic — the arithmetic, the publish path and the React subscription
    // are all the shipped ones. `__govT` is kept monotonic across calls and runs
    // ahead of wall-clock, which has a second, deliberate effect: real rAF
    // samples arriving meanwhile are non-advancing and get dropped, so this
    // measures the rule rather than the CI runner's framerate. (Headless
    // Chromium genuinely misses frame budget here — the first draft of this
    // section was flaky precisely because the page was shedding on its own.)
    const drive = (frames, stepMs) =>
      page.evaluate(([n, ms]) => {
        window.__govT = Math.max(window.__govT ?? 0, performance.now());
        for (let i = 0; i < n; i++) window.__XMR_GOV__.sample((window.__govT += ms));
        return {
          scale: window.__XMR_GOV__.scale,
          gov: document.documentElement.getAttribute("data-gov"),
        };
      }, [frames, stepMs]);
    const orbs = () => page.evaluate(() => document.querySelectorAll("#bg-fx .orb").length);

    // Settle to full quality first, so the counts below are measured against a
    // known state rather than against whatever this machine happened to manage.
    const full = await drive(4000, 16.6);
    await page.waitForTimeout(200);
    const before = await orbs();
    R.ok(full.scale === 1 && full.gov === null,
      `a sustained 60fps run holds the dial at full and publishes nothing (scale ${full.scale}, data-gov ${full.gov})`);
    R.ok(before > 0, `orb field mounted at full quality (${before} orbs)`);

    const shed = await drive(400, 33.3);
    await page.waitForTimeout(200); // let React flush the shorter list
    const after = await orbs();

    R.ok(shed.scale < 0.99, `400 frames at 30fps shed the dial to ${shed.scale.toFixed(3)}`);
    R.ok(shed.gov !== null, `data-gov is present on <html> while the dial is low (data-gov="${shed.gov}")`,
      "a governor that degrades output without saying so is unreviewable");
    // `shed.gov !== null` is repeated here on purpose: without it, deleting the
    // publish entirely satisfies this assertion (Number(null) === 0, 0 % 5 === 0,
    // 0 < 100) and the gate reports 1 failure where it should report 2. Found by
    // deliberately breaking the publish path, which is the only way to find it.
    R.ok(shed.gov !== null && Number(shed.gov) % 5 === 0 && Number(shed.gov) < 100,
      `the published value is quantised to 5% and never rounds up to "100" (${shed.gov})`,
      "an unquantised write restyles <html> on every frame of a shed");
    R.ok(after < before, `the shed actually removed DOM: ${before} orbs → ${after}`);
    R.ok(Math.abs(after - Math.round(before * shed.scale)) <= Math.ceil(before * 0.1) + 1,
      `the surviving orb count tracks the dial (${after} ≈ ${before} × ${shed.scale.toFixed(2)}, quantised to 0.1)`);

    const rec = await drive(4000, 16.6);
    await page.waitForTimeout(200);
    const restored = await orbs();
    R.ok(rec.scale === 1 && rec.gov === null,
      `a sustained 60fps run recovers to full and REMOVES data-gov (scale ${rec.scale}, data-gov ${rec.gov})`,
      "the attribute must mean 'something is being held back right now', so it cannot linger at 100");
    R.ok(restored === before, `the full field comes back (${restored} orbs, was ${before})`);

    // …and the escape hatch: `?gov=off` pins the dial, so a screenshot gate can
    // get a deterministic layer count out of a CI box that misses frame budget.
    const pinned = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await pinned.goto(`${BASE}/?tier=high&gov=off`, { waitUntil: "domcontentloaded" });
    await pinned.waitForSelector("#bg-fx .orb", { state: "attached", timeout: 15000 });
    const off = await pinned.evaluate(() => {
      let t = performance.now();
      for (let i = 0; i < 400; i++) window.__XMR_GOV__.sample((t += 33.3)); // a hard 30fps stall
      return {
        scale: window.__XMR_GOV__.scale,
        gov: document.documentElement.getAttribute("data-gov"),
      };
    });
    // Read the orb count only AFTER React has had a chance to flush. Reading it
    // inside the evaluate above returns the pre-render count and would report
    // "30 orbs" even on a page that was about to drop to 15 — proven by
    // deliberately breaking the pin, which is the only reason this line exists.
    await pinned.waitForTimeout(200);
    off.orbs = await pinned.evaluate(() => document.querySelectorAll("#bg-fx .orb").length);
    R.ok(off.scale === 1 && off.gov === null && off.orbs === before,
      `?gov=off pins the dial through the same 30fps stall (scale ${off.scale}, data-gov ${off.gov}, ${off.orbs} orbs)`,
      "without this a shot baseline diffs whenever CI is loaded, with no defect behind it");
    await pinned.close();

    await browser.close();
  }
}

process.exit(R.finish());
