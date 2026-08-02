// verify-lib.mjs — shared launcher + route inventory for the v6.0.10 gates.
//
// Every Playwright gate in this repo re-implemented the same WebKit→Chromium
// fallback preamble (verify-mobile.mjs:1-25 is the original). v6.0.10 adds four
// more gates, so it moves here once. Nothing else is shared: each gate still
// owns its own assertions and its own exit code.

import { webkit, chromium } from 'playwright';
import { existsSync, readdirSync } from 'node:fs';

export const BASE = process.env.VERIFY_BASE || 'http://localhost:4173';

function findChrome() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!existsSync(root)) return undefined;
  for (const d of readdirSync(root).filter((n) => n.startsWith('chromium-')).sort().reverse()) {
    const p = root + '/' + d + '/chrome-linux/chrome';
    if (existsSync(p)) return p;
  }
  return undefined;
}

/** Prefer WebKit — it is the mobile-Safari engine, and §7 asks for a real
 *  device rather than DevTools emulation; WebKit is the closest this sandbox
 *  can get. Some sandboxes cannot fetch the WebKit build (CDN not in the
 *  network allowlist), so fall back to Chromium: every property these gates
 *  measure (layout width, computed font-size, CTM scale) is engine-agnostic. */
export async function launch() {
  try {
    const b = await webkit.launch();
    return { browser: b, engine: 'webkit' };
  } catch {
    const executablePath = findChrome();
    const b = await chromium.launch(executablePath ? { executablePath } : {});
    return { browser: b, engine: 'chromium' };
  }
}

/**
 * Chromium, explicitly — for gates that measure something WebKit cannot report.
 *
 * `launch()` above prefers WebKit, which is right for layout and typography
 * (it is the mobile-Safari engine). It is WRONG for anything reading a
 * Chromium-only API: `PerformanceObserver` has no `layout-shift` entry type in
 * WebKit, so an observer registered there simply never fires and a CLS gate
 * built on `launch()` reads 0.0 and reports green. That is a gate passing
 * something it did not measure — the exact failure this repo keeps re-learning.
 *
 * CI installs chromium only (ci.yml's "Install Chromium" step), and this
 * sandbox has no WebKit build either, so in both places `launch()` happens to
 * fall through to Chromium today. "Happens to" is the problem: the moment a
 * developer with a full Playwright install runs the gate, it goes vacuous
 * silently. Pin the engine rather than relying on which browsers are present.
 */
export async function launchChromium() {
  const executablePath = findChrome();
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  return { browser, engine: 'chromium' };
}

/** Every addressable surface in the app. Tabs and simulator query params are
 *  separate entries because they are separate LAYOUTS — walking only the seven
 *  top-level routes is how the legality tab shipped broken twice.
 *
 *  v6.1.3 — the simulator list below carries all 21 `?p=` ids registered in
 *  src/views/protocols.tsx's COMPONENTS map (verified against that file and
 *  its metadata twin, src/views/protocol-meta.ts, not just trusted from a
 *  prior copy of this comment). It previously listed 15 and silently skipped
 *  the six-member "Future protocol" group (seraphis, jamtis, carrot, cuprate,
 *  stressnet, ospead) in every browser gate that iterates ROUTES — those six
 *  routes existed in the app and were never walked here. Total route count is
 *  now 43 (was 37): 8 top-level + 4 education tabs + 9 monero tabs + 21
 *  simulators + 1 404. */
export const ROUTES = [
  '/',
  '/mempool',
  '/markets',
  '/network',
  '/node',
  '/sources',
  '/peers',
  '/future',
  ...['journey', 'timeline', 'quotes', 'simulators'].map((t) => `/education/${t}`),
  ...['overview', 'origin', 'tech', 'legality', 'markets', 'comparison', 'attacks', 'bottomline', 'outlook']
    .map((t) => `/monero/${t}`),
  ...['decoy', 'dandelion', 'viewtags', 'ringct', 'stealth', 'fcmp',
      'seraphis', 'jamtis', 'carrot', 'cuprate', 'stressnet', 'ospead',
      'hearth', 'metronome', 'silo', 'thermostat', 'lighthouse', 'auction',
      'skyline', 'bloodhound', 'balance'].map((p) => `/simulate?p=${p}`),
  '/no-such-route',           // 404
];

/** Routes that render a ProtoArtboard (.proto-stage) — the §1 occlusion set. */
export const SIM_ROUTES = ROUTES.filter((r) => r.startsWith('/simulate'));

// v6.1.2 — classic is the DEFAULT and is listed first; phosphor is new.
// Note for anyone adding a fourth: gates that diff against a baseline tree built
// from an older commit will have no baseline for a new theme. verify-shots.mjs
// handles that explicitly (it reports unmatched shots separately rather than
// counting them as compared) — a gate that skips a missing baseline silently
// will overstate what it verified.
export const THEMES = ['classic', 'indigo', 'phosphor'];

/** Stamp the theme before any app script runs, exactly as index.html's
 *  pre-paint script does, so a gate never measures a mid-flip frame. */
export async function newThemedPage(browser, { width, height }, theme) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  await ctx.addInitScript((t) => {
    try { localStorage.setItem('xmri.theme', t); } catch { /* storage disabled */ }
    document.documentElement.setAttribute('data-theme', t);
  }, theme);
  return ctx.newPage();
}

/** Freeze the ambient field. Every L3 layer animates, so two screenshots of the
 *  same element taken milliseconds apart differ even when nothing is wrong. */
export async function freezeAmbient(page) {
  await page.addStyleTag({
    content: `*, *::before, *::after { animation: none !important; transition: none !important; }`,
  });
}

/**
 * The shared reporter.
 *
 * `skip` and `fixture` exist because a gate must never report a pass on
 * something it did not check, and this repo has been bitten by that repeatedly:
 * verify-v510 stayed permanently red until people learned to ignore red,
 * verify-future sat orphaned so twelve assertions never ran at all, and
 * verify-shots counted screenshots it never compared toward a
 * "pixel-identical" claim. The fix is not to check more — sometimes you
 * genuinely cannot — it is to make the unchecked items their own NUMBER
 * instead of letting them vanish into a success count.
 *
 *   ok(cond, label)        a real assertion against real behaviour
 *   skip(label, why)       could not be checked here (API absent, engine
 *                          lacking, upstream unreachable). NOT a pass.
 *   fixture(label, what)   checked against a fixture rather than the real
 *                          upstream. Real coverage, but of the fixture — say so.
 *
 * `finish()` prints all four counts, so "12 passed · 3 fixtured · 1 skipped"
 * can never be read as "16 passed".
 */
export function makeReporter(name) {
  let failed = false;
  let passed = 0;
  let failures = 0;
  let skipped = 0;
  let fixtured = 0;
  return {
    ok(cond, label, detail = '') {
      if (cond) { passed++; console.log(`  ✅ ${label}`); }
      else { failed = true; failures++; console.log(`  ❌ ${label}${detail ? '\n     ' + detail : ''}`); }
      return cond;
    },
    /** Could not be checked in this environment. Never counts as a pass. */
    skip(label, why) {
      skipped++;
      console.log(`  ⏭  ${label} — SKIPPED: ${why}`);
    },
    /** Checked, but against a fixture rather than the real upstream. */
    fixture(label, what) {
      fixtured++;
      console.log(`  🧪 ${label} — fixtured: ${what}`);
    },
    info(msg) { console.log(`  ·  ${msg}`); },
    group(title) { console.log(`\n${title}`); },
    finish() {
      const tally =
        `${passed} passed · ${fixtured} fixtured · ${skipped} skipped · ${failures} failed`;
      console.log('\n' + (failed ? `❌ ${name}: FAILURES — ${tally}` : `✅ ${name}: ${tally}`));
      return failed ? 1 : 0;
    },
  };
}
