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

export function makeReporter(name) {
  let failed = false;
  return {
    ok(cond, label, detail = '') {
      if (cond) console.log(`  ✅ ${label}`);
      else { failed = true; console.log(`  ❌ ${label}${detail ? '\n     ' + detail : ''}`); }
      return cond;
    },
    info(msg) { console.log(`  ·  ${msg}`); },
    group(title) { console.log(`\n${title}`); },
    finish() {
      console.log('\n' + (failed ? `❌ ${name}: FAILURES` : `✅ ${name}: all assertions passed`));
      return failed ? 1 : 0;
    },
  };
}
