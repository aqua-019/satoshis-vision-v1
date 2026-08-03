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

/* ── The documented measurement profile — declared ONCE ───────────────────
 * PERF-BASELINE.md's Method section defines the conditions every perf number
 * in this repo is measured under. verify-cls.mjs owned the only copy until
 * v6.1.5 added verify-vitals.mjs; two gates each holding their own copy of
 * "the documented profile" is the second-home-for-an-invariant failure that
 * verify-reporter.mjs:16-29 was split out to prevent, and the two would drift
 * apart with nothing failing. verify-resilience.mjs asserts neither gate
 * re-declares these locally.
 *
 * KNOWN ASYMMETRIES, because a profile that hides them overclaims:
 *  1. scripts/serve-dist.mjs serves assets UNCOMPRESSED — no gzip, no brotli,
 *     no content-encoding (it sets a raw content-length at :44). Vercel
 *     compresses. So CSS/JS here arrive at ~5x their production transfer size:
 *     the one stylesheet is 73,031 B raw against 14,863 B gzip.
 *  2. Playwright's route.fulfill() short-circuits BEFORE the network stack, so
 *     these conditions throttle the document, bundle and fonts but NOT any
 *     mocked /api/* response. Use MOCK_LATENCY_MS to give the feed a stated
 *     latency rather than an unrealistic instant one.
 * Neither is chased: serve-dist has already changed once (v6.1.4's 501) and
 * changing it again would invalidate every number recorded against it. */
export const SLOW_4G = {
  offline: false,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
  latency: 150,
};
export const CPU_THROTTLE = 6;
export const PHONE = { width: 390, height: 844, deviceScaleFactor: 3 };
/** Deterministic stand-in for real feed latency. See asymmetry 2 above. */
export const MOCK_LATENCY_MS = 120;

/** Apply SLOW_4G + CPU_THROTTLE to one page via CDP. Chromium only. */
export async function throttle(ctx, page) {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', SLOW_4G);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });
  return cdp;
}

/** Every addressable surface in the app. Tabs and simulator query params are
 *  separate entries because they are separate LAYOUTS — walking only the
 *  top-level routes is how the legality tab shipped broken twice.
 *
 *  v6.1.3 — the simulator list below carries all 21 `?p=` ids registered in
 *  src/views/protocols.tsx's COMPONENTS map (verified against that file and
 *  its metadata twin, src/views/protocol-meta.ts, not just trusted from a
 *  prior copy of this comment). It previously listed 15 and silently skipped
 *  the six-member "Future protocol" group (seraphis, jamtis, carrot, cuprate,
 *  stressnet, ospead) in every browser gate that iterates ROUTES — those six
 *  routes existed in the app and were never walked here.
 *
 *  Nav restructure (13-route IA, scripts/routes.mjs's `R`) — the 8 old
 *  top-level routes are renamed in place (`/mempool` → `/live/mempool`, etc.)
 *  and two more top-level entries are ADDED: `/live/markets/thesis` and
 *  `/future/outlook`, both of which used to be `/monero/:tab` members
 *  (`markets`, `outlook`) and are gone from that tab set as a result — it
 *  drops from 9 to 7. The 21 simulators move from `/simulate?p=<id>` to
 *  `/learn/sim?p=<id>`. Total route count stays 43: 10 top-level (8 renamed +
 *  2 new) + 4 education tabs (renamed to /learn/<tab>) + 7 monero tabs
 *  (markets/outlook removed) + 21 simulators + 1 404. */
export const ROUTES = [
  '/',
  '/live/mempool',
  '/live/markets',
  '/live/markets/thesis',
  '/live/network',
  '/operate/node',
  '/about/sources',
  '/about/peers',
  '/future',
  '/future/outlook',
  ...['journey', 'timeline', 'quotes', 'simulators'].map((t) => `/learn/${t}`),
  ...['overview', 'origin', 'tech', 'legality', 'comparison', 'attacks', 'bottomline']
    .map((t) => `/monero/${t}`),
  ...['decoy', 'dandelion', 'viewtags', 'ringct', 'stealth', 'fcmp',
      'seraphis', 'jamtis', 'carrot', 'cuprate', 'stressnet', 'ospead',
      'hearth', 'metronome', 'silo', 'thermostat', 'lighthouse', 'auction',
      'skyline', 'bloodhound', 'balance'].map((p) => `/learn/sim?p=${p}`),
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
 * D0891 · the shared /api/status fixture and its route mock.
 *
 * WHY EVERY GATE THAT LOADS /sources NEEDS THIS. `scripts/serve-dist.mjs` has
 * three branches — exact file, directory index, SPA fallback — and the third
 * returns `dist/index.html` with **HTTP 200 and text/html** for ANY unmatched
 * path. So an unrouted `/api/status` does not 404; it looks like a SUCCESS
 * carrying HTML, and only explodes at `res.json()`. A gate that loads /sources
 * without this is testing an unhandled request and calling it a page.
 *
 * Correcting a note recorded elsewhere while we are here: verify-future's
 * `mockFeeds` does NOT "abort every other /api/*". It aborts three named globs
 * (`**‍/api/xmr/**`, `**‍/api/monero*`, `**‍/api/coingecko*`) and fulfils
 * `**‍/api/feeds*`. `/api/status` matches none of them, so the mechanism is
 * "an unmatched pattern falls through", not "everything else is aborted".
 *
 * `at` is FIXED, not generated. verify-shots.mjs walks /sources and a moving
 * timestamp would diff every screenshot.
 *
 * api/verify-status.mjs asserts the real handler's key set matches this
 * fixture's, so the mock cannot quietly rot away from the endpoint it stands in
 * for — which is the only thing that makes a fixture better than no mock.
 */
export const STATUS_FIXTURE = {
  v: 1,
  at: '2026-01-01T00:00:00.000Z',
  probed: false,
  note: 'configuration only — this endpoint does not probe any upstream',
  cascade: {
    primaryConfigured: false,
    referenceCount: 6,
    referenceHosts: [
      'node.moneroworld.com:18089',
      'nodes.hashvault.pro:18081',
      'node.community.rino.io:18081',
      'opennode.xmr-tw.org:18089',
      'node.sethforprivacy.com:18089',
      'xmr-node.cakewallet.com:18081',
    ],
    networks: { mainnet: 6, stagenet: 0, testnet: 0, betanet: 0 },
  },
  endpoints: [
    { path: '/api/xmr', file: 'xmr.js', kind: 'node' },
    { path: '/api/monero', file: 'monero.js', kind: 'node' },
    { path: '/api/coingecko', file: 'coingecko.js', kind: 'market' },
    { path: '/api/markets', file: 'markets.js', kind: 'market' },
    { path: '/api/feeds', file: 'feeds.js', kind: 'editorial' },
    { path: '/api/status', file: 'status.js', kind: 'meta' },
  ],
};

/** Route `/api/status` to the fixture. Pass `{ fail: true }` to drive the
 *  endpoint-down branch, or an object to merge over the payload. */
export async function mockStatus(ctx, { fail = false, ...overrides } = {}) {
  await ctx.route('**/api/status*', (route) => {
    if (fail) {
      return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"upstream"}' });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...STATUS_FIXTURE, ...overrides }),
    });
  });
}

/**
 * The shared reporter — MOVED to ./verify-reporter.mjs, re-exported here.
 *
 * Re-exported rather than relocated-with-edits so all 16 gates that already do
 * `import { makeReporter } from './verify-lib.mjs'` keep working byte-for-byte.
 *
 * It lives in its own module because api/verify-status.mjs needs `fixture()`
 * and this file's first import is `playwright`. That import resolves fine in
 * CI's offline `build` job — playwright is a devDependency and `npm ci` runs
 * there — so the split is not about a missing package. It is about the `build`
 * job's stated contract ("Offline gates only — no browser, no network") and,
 * decisively, about not giving the four-counter invariant a second home: a
 * copied reporter is a second place where "12 passed · 3 fixtured · 1 skipped"
 * could drift into reading as "16 passed". See verify-reporter.mjs's header.
 */
export { makeReporter } from './verify-reporter.mjs';
