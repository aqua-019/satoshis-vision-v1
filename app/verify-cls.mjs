/**
 * verify-cls.mjs — cumulative layout shift, measured rather than assumed.
 *
 * Run: npm run build && (node scripts/serve-dist.mjs &) && npm run wait-preview
 *      && node verify-cls.mjs [--measure]
 *
 * The brief's wording is "zero layout shift on load — CLS measured, near zero".
 * Two things follow from that, and both are easy to get wrong:
 *
 *   · "measured" means the number is printed EVERY run, not just compared.
 *     A gate that prints only pass/fail hides drift until the day it fails,
 *     and by then nobody knows which change moved it.
 *   · "near zero" is not the Web Vitals "good" bound of 0.1. A skeleton that
 *     shifts half a panel scores well under 0.1 and would sail through. The
 *     threshold here comes from measuring THIS tree and adding headroom for
 *     runner variance — see MEASURED below.
 *
 * ── WHY THIS FILE PINS CHROMIUM ────────────────────────────────────────────
 * `layout-shift` is a Chromium-only PerformanceObserver entry type. WebKit
 * does not implement it: an observer registered there never fires, CLS reads
 * 0.0, and the gate reports a confident green having measured nothing.
 * verify-lib's `launch()` prefers WebKit, so this file uses `launchChromium()`
 * instead — and still feature-detects, reporting SKIPPED (its own counter,
 * never folded into the pass count) if the entry type is absent. A gate that
 * cannot measure must say so; that is what R.skip exists for.
 *
 * ── CONDITIONS ─────────────────────────────────────────────────────────────
 * PERF-BASELINE.md's documented profile, so these numbers are comparable with
 * the ones recorded there: 390×844 at dpr 3, 6× CPU throttle, Slow-4G. The
 * observer is installed via addInitScript BEFORE app code, because a shift
 * that happens during hydration is exactly the shift we care about and an
 * observer registered after load would miss it.
 */
import { makeReporter, launchChromium, BASE } from './verify-lib.mjs';

const base = process.env.VERIFY_BASE || BASE;
const MEASURE_ONLY = process.argv.includes('--measure');
const RUNS = Number(process.env.CLS_RUNS || (MEASURE_ONLY ? 3 : 1));

/**
 * Per-route ceiling, set from MEASUREMENT of this tree — not from the Web
 * Vitals 0.1 "good" bound, which is two orders of magnitude looser than
 * anything this site produces and would wave through a skeleton shifting half
 * a panel.
 *
 * Measured before any of v6.1.4's loading work existed, 8 runs per route under
 * the conditions above:
 *
 *   /          0.0008 – 0.0009   (7 of 8 runs read 0.0002)
 *   /mempool   0.0000            (8 of 8 — the Suspense fallback's minHeight
 *                                 is what holds this at zero; see
 *                                 MempoolPage.tsx and PERF-BASELINE.md, where
 *                                 an unreserved fallback measured 0.0853)
 *   /markets   0.0000 – 0.0001
 *   /network   0.0000 – 0.0001
 *
 * `/` reproduces PERF-BASELINE.md's recorded 0.0009 exactly, which is the
 * cross-check that these conditions really are the documented ones.
 *
 * The spread is essentially nil, so the headroom below is deliberate slack for
 * a shared CI runner rather than for observed variance — roughly 11× the worst
 * reading, and still 10× tighter than the "good" bound. `/markets` gets more
 * because PERF-BASELINE.md recorded 0.0078 there post-v6.0.8: that route's
 * charts can shift when history lands in a different order, and a ceiling that
 * flakes teaches people to ignore red, which is how verify-v510 died.
 */
const MEASURED = {
  '/': 0.01,
  '/mempool': 0.01,
  '/markets': 0.02,
  '/network': 0.01,
};

const ROUTES = Object.keys(MEASURED);

/** Slow 4G, as PERF-BASELINE.md documents it. */
const SLOW_4G = {
  offline: false,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
  latency: 150,
};
const CPU_THROTTLE = 6;

const R = makeReporter('verify-cls');

const { browser } = await launchChromium();

/* Feature-detect once, on a throwaway page, before claiming anything. */
const probe = await browser.newPage();
const supported = await probe.evaluate(
  () => typeof PerformanceObserver !== 'undefined' &&
        Array.isArray(PerformanceObserver.supportedEntryTypes) &&
        PerformanceObserver.supportedEntryTypes.includes('layout-shift'),
);
await probe.close();

if (!supported) {
  // Not a pass and not a failure — an honest "this engine cannot answer".
  for (const route of ROUTES) {
    R.skip(`${route} · CLS`, 'this engine has no layout-shift entry type (Chromium-only)');
  }
  await browser.close();
  process.exit(R.finish());
}

/** One load of `route`, returning its CLS. */
async function measure(route) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
  });
  // BEFORE app code: a shift during hydration is the shift that matters.
  await ctx.addInitScript(() => {
    window.__CLS__ = 0;
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          // Shifts within 500ms of a real interaction are the user's doing.
          if (!e.hadRecentInput) window.__CLS__ += e.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch { /* feature-detected above; belt-and-braces */ }
  });

  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', SLOW_4G);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });

  // `load`, never networkidle — the banned idiom (verify-future.mjs:34-40).
  // The tiered feed polls forever, so networkidle would never settle anyway.
  await page.goto(base + route, { waitUntil: 'load' });
  // Let hydration and the first data tick land; shifts after this are not
  // "on load" by any reading.
  await page.waitForTimeout(3000);

  const cls = await page.evaluate(() => window.__CLS__ ?? 0);
  await ctx.close();
  return cls;
}

R.group(`verify-cls — 390×844 · ${CPU_THROTTLE}× CPU · Slow-4G · ${RUNS} run(s) per route`);

for (const route of ROUTES) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) runs.push(await measure(route));
  const worst = Math.max(...runs);
  const shown = runs.map((v) => v.toFixed(4)).join(', ');

  // The measurement is printed EVERY run, pass or fail. This is the line that
  // makes drift visible long before it becomes a failure.
  R.info(`${route.padEnd(10)} CLS ${worst.toFixed(4)}  (runs: ${shown})  ceiling ${MEASURED[route]}`);

  if (!MEASURE_ONLY) {
    R.ok(worst <= MEASURED[route],
      `${route} · CLS ${worst.toFixed(4)} ≤ ${MEASURED[route]}`,
      `measured ${shown} — if this is a real layout change, move the ceiling deliberately and say why`);
  }
}

await browser.close();
process.exit(MEASURE_ONLY ? 0 : R.finish());
