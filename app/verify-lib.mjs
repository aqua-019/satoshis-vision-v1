// verify-lib.mjs — shared launcher + route inventory for the v6.0.10 gates.
//
// Every Playwright gate in this repo re-implemented the same WebKit→Chromium
// fallback preamble (verify-mobile.mjs:1-25 is the original). v6.0.10 adds four
// more gates, so it moves here once. Nothing else is shared: each gate still
// owns its own assertions and its own exit code.

import { webkit, chromium } from 'playwright';
import { existsSync, readdirSync } from 'node:fs';
// The canonical route constants. Imported rather than retyped so a rename
// cannot leave a filter here pointing at a path that no longer exists — which
// is exactly how SIM_ROUTES silently became [] (see its comment below).
import { R } from './scripts/routes.mjs';
// The /api/status fixture, re-exported so all 25+ e2e gates that import it
// keep working, but imported from verify-fixtures.mjs so that api/verify-status.mjs
// can load it without pulling in playwright (which would break the build job's
// offline-only contract).
import { STATUS_FIXTURE } from './verify-fixtures.mjs';

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
 *  `/learn/sim?p=<id>`. Total route count was 43 at that restructure: 10
 *  top-level (8 renamed + 2 new) + 4 education tabs (renamed to
 *  /learn/<tab>) + 7 monero tabs (markets/outlook removed) + 21 simulators
 *  + 1 404.
 *
 *  IT IS 49 NOW, and this paragraph said "stays 43" for four releases while
 *  the per-entry comments below correctly counted 43 → 44 → 45 → 46 → 47.
 *  Two figures in one file disagreeing, which is the defect CLAUDE.md
 *  records against ITSELF twice — each `?v=` PR updated its own comment and
 *  not the summary. p3·16 adds `/operate/superstress` (47 → 48) and p4·04
 *  adds `/operate/mine` (48 → 49); both RECOUNT the summary by running the
 *  line below rather than incrementing it:
 *    node -e "import('./verify-lib.mjs').then(m=>console.log(m.ROUTES.length))"
 *  MEASURE it; do not read it off this sentence. */
export const ROUTES = [
  '/',
  '/live/mempool',
  /* p2·7 — the FIRST `?v=` permutation in this list, and it is added knowing it
     is asymmetric: six other views exist and only this one is walked.
     `/live/mempool` alone means `?v=classic`, which is why CLAUDE.md carries
     "the shot matrix cannot see five of the six mempool views" as a standing
     item. This does not close that; it adds the view this PR introduces, so the
     new surface is walked by every ROUTES-consuming gate (verify-ia, verify-nav,
     verify-ground, verify-cls, verify-mobile, verify-nojs, verify-pageshell,
     verify-vitals, verify-shots …) instead of being visible only to the three
     gates that drive `?v=` explicitly. Total 43 -> 44.
     Adding the other five is a coverage decision with its own cost — 5 more
     entries across ~14 gates — and belongs with the standing item, not here. */
  '/live/mempool?v=orbital',
  /* p2·8 — the SECOND `?v=` permutation, added on the same reasoning and with
     the same asymmetry: six of the eight views are still walked only as
     `?v=classic`, which is what CLAUDE.md's "the shot matrix cannot see five of
     the six mempool views" records. This does not close that item either; it
     keeps the invariant that a NET-NEW view enters the ROUTES-consuming gates
     (verify-ia, verify-nav, verify-ground, verify-cls, verify-mobile,
     verify-nojs, verify-pageshell, verify-vitals, verify-shots …) on the PR
     that introduces it, rather than being visible only to the gates that drive
     `?v=` explicitly. Total 44 -> 45.
     The standing item is now "six of eight", and adding the remaining six is
     still a coverage decision with its own cost (~14 gates × 6 entries). */
  '/live/mempool?v=abyss',
  /* p2·9 — the THIRD `?v=` permutation, on the same reasoning and with the same
     asymmetry: six of the NINE views are still walked only as `?v=classic`. The
     invariant this keeps is that a NET-NEW view enters the ROUTES-consuming
     gates (verify-ia, verify-nav, verify-ground, verify-cls, verify-mobile,
     verify-nojs, verify-pageshell, verify-vitals, verify-shots …) on the PR that
     introduces it, rather than being visible only to the gates that drive `?v=`
     explicitly. Total 45 -> 46.
     The standing item stays "six of nine" — the ORIGINAL six, unchanged in
     membership since #174, because every net-new view has added its own entry.
     Closing it is still a coverage decision with its own cost (~14 gates × 6
     entries) and still belongs with the standing item, not here. */
  '/live/mempool?v=pulse',
  /* p2·10 — the FOURTH `?v=` permutation, on the same reasoning and with the
     same asymmetry: six of the TEN views are still walked only as
     `?v=classic`. The invariant this keeps is that a NET-NEW view enters the
     ROUTES-consuming gates (verify-ia, verify-nav, verify-ground, verify-cls,
     verify-mobile, verify-nojs, verify-pageshell, verify-vitals,
     verify-shots …) on the PR that introduces it, rather than being visible
     only to the gates that drive `?v=` explicitly. Total 46 -> 47.
     The standing item stays "six of ten" — the ORIGINAL six, unchanged in
     membership since #174, because every net-new view has added its own entry.
     The DENOMINATOR moves and the uncovered SET does not, which is the only
     way that item can read from here on: after this PR the eleventh view is
     Relay, and it is parked. Closing the item is still a coverage decision
     with its own cost (~14 gates × 6 entries) and still belongs with the
     standing item, not here. */
  '/live/mempool?v=circuit',
  '/live/markets',
  '/live/markets/thesis',
  '/live/network',
  '/operate/node',
  /* p3·16 — the first TOP-LEVEL route added to this list since the
     restructure; every entry above it since #174 has been a `?v=` view
     permutation. Total 47 -> 48.
     A net-new ROUTE has a stronger claim on this list than a net-new view
     did: a view permutation shares its page's layout, whereas this is a
     layout no ROUTES-consuming gate (verify-ground, verify-cls,
     verify-mobile, verify-pageshell, verify-vitals, verify-shots …) has ever
     rendered. Leaving it out would mean the site's newest page were the one
     page none of them walked. */
  '/operate/superstress',
  /* p4·04 — the SECOND top-level route added since the restructure, on the
     same argument p3·16 makes directly above: this page's layout (a
     four-row disclosure accordion over a seeded SVG field) is rendered by no
     other route, so leaving it out would make the site's newest page the one
     page the ROUTES-consuming gates never walk. Total 48 -> 49 — MEASURED,
     see the header: do not read that figure off this comment. */
  '/operate/mine',
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

/** Routes that render a ProtoArtboard (.proto-stage) — the §1 occlusion set.
 *
 *  v6.1.6: the prefix moved with the routes. ROUTES above was migrated to
 *  `/learn/sim?p=<id>` and this filter was not, so SIM_ROUTES silently became
 *  []. Nothing threw, because an empty array is a perfectly good array.
 *
 *  What it broke is worth recording, because it is not the failure you would
 *  guess. verify-shots.mjs:141 builds SIM_SET from this to EXEMPT the 21
 *  simulator routes from its pixel-diff assertion — they are inherently
 *  nondeterministic (17 of 63 classic sim shots differ between two sweeps of
 *  one unchanged tree). With the set empty the exemption stopped applying, so
 *  the gate would fail on jitter its own header calls expected and unfixable,
 *  AND its `if (simShots.length)` guard went false, so the NOISE FLOOR caveat
 *  stopped printing. A false failure and a silenced honesty line at once —
 *  the caveat being exactly what stops "pixel-identical across N shots" from
 *  being read as coverage it never had.
 *
 *  Derived from R so a future rename cannot desynchronise them again.
 *
 *  The boundary check is not decoration. A bare `startsWith(R.LEARN_SIM)`
 *  also matches `/learn/simulators` — the Learn TAB, which renders a grid of
 *  cards and no ProtoArtboard at all — silently widening the occlusion set to
 *  22 and exempting a deterministic page from verify-shots' pixel diff. Same
 *  missing-boundary bug as `/futures-x` matching `/future`, and it was
 *  introduced in the very commit that fixed the empty-array one. */
export const SIM_ROUTES = ROUTES.filter(
  (r) => r === R.LEARN_SIM || r.startsWith(R.LEARN_SIM + '?') || r.startsWith(R.LEARN_SIM + '/'),
);

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

/* ── COLD BOOT (v6.1.8) ───────────────────────────────────────────────────
 *
 * `/` gained a cold-boot splash: a seeded decrypt + HUD console that GATES on
 * the user (Enter) rather than timing out. It is once-per-session, keyed in
 * sessionStorage. Every Playwright gate opens a FRESH CONTEXT, so every gate
 * gets an empty sessionStorage and the splash covers Home for all of them.
 *
 * Measured on this tree, not assumed: TWELVE CI-reached gates navigate to `/`
 * (verify-cls, -vitals, -origins, -nav, -motion, -nojs, -degraded, -discrete,
 * -ground, -palette, -govern, -charts), plus verify-shots (npm-wired) and four
 * orphans. Left alone they would measure the splash and report about the wrong
 * page state — which is exactly the v6.1.5 defect where verify-cls measured
 * `/live/network` fully degraded and reported a number for a page nobody sees.
 *
 * ── WHY THE CONSTANTS BELOW ARE EXPORTED, AND WHY THAT IS THE WHOLE POINT ──
 *
 * The bypass and the proof-that-the-bypass-is-real MUST reference the same
 * literals. If verify-coldboot.mjs proved `[data-coldboot]` appears using its
 * own local string while the sweep asserted absence using a different one, the
 * liveness proof would prove nothing about the sweep, and a rename would make
 * every precondition assertion in twelve gates vacuously true at once — all
 * green, all measuring nothing. That is the `R.ok(X || true, …)` failure with
 * more steps. One declaration, imported by both.
 *
 * ── THE VACUITY HAZARD, STATED PLAINLY ────────────────────────────────────
 *
 * `assertColdBootBypassed()` asserts an ABSENCE. An absence assertion passes
 * for two completely different reasons: the bypass worked, or the selector is
 * dead. Those are indistinguishable from inside this helper. The ONLY thing
 * that separates them is verify-coldboot.mjs §1, which navigates WITHOUT the
 * flag and asserts the splash IS present. That assertion is load-bearing for
 * every caller of this helper. If it is ever deleted, weakened, or allowed to
 * skip, the twelve preconditions below silently become decoration.
 */
export const COLDBOOT_FLAG = '__XMR_COLDBOOT__';
export const COLDBOOT_OFF = 'off';
export const COLDBOOT_ATTR = 'data-coldboot';
export const COLDBOOT_SEL = `[${COLDBOOT_ATTR}]`;

/** Stamped by ColdBoot as soon as it has EVALUATED the session flag — whichever
 *  way it went: on the splash root when it renders, on a zero-size marker node
 *  when it decides not to.
 *
 *  ── WHY THIS EXISTS: A NEGATIVE ASSERTION CANNOT AUTO-WAIT ───────────────
 *  `count() === 0` and `toHaveCount(0)` are both satisfied INSTANTLY by an
 *  empty DOM, so neither can distinguish "absent because correct" from
 *  "absent because early". ColdBoot is React.lazy, so after a reload the chunk
 *  has not resolved and a count returns 0 — exactly the value a
 *  gating assertion wants. "Once-per-session gating works" is a §5 criterion
 *  and it could pass while measuring an unresolved chunk.
 *
 *  Waiting on COLDBOOT_SEL itself cannot fix that: in the case that matters,
 *  the splash is legitimately absent, so the thing to wait for is the
 *  DECISION, not the splash. Every negative assertion needs a positive
 *  precondition to wait on first. */
export const COLDBOOT_DECIDED_SEL = '[data-coldboot-decided]';

/**
 * Skip the cold-boot splash for everything this target later loads.
 *
 * Accepts a BrowserContext OR a Page — both expose `addInitScript`, and this
 * repo's gates are split roughly evenly between `browser.newContext()` and a
 * bare `browser.newPage()`. Passing either works; passing a context covers
 * pages created from it afterwards.
 *
 * MUST be awaited BEFORE `goto()`. An init script registered after navigation
 * applies to the NEXT navigation, so a late call leaves the very first page
 * load — the one that renders the splash — unprotected, and does it silently.
 */
export async function coldBootOff(target) {
  await target.addInitScript(
    ([flag, off]) => {
      try { window[flag] = off; } catch { /* sealed global — nothing to do */ }
    },
    [COLDBOOT_FLAG, COLDBOOT_OFF],
  );
}

/**
 * Apply `coldBootOff` to EVERY context and page this browser creates from now
 * on. Call once, immediately after `launch()` / `launchChromium()`.
 *
 * ── WHY A WRAPPER AND NOT 40 INDIVIDUAL EDITS ─────────────────────────────
 *
 * This is a deliberate trade and it is the less clever of the two options
 * despite looking like the more clever one. The twelve `/`-reaching gates
 * create pages at FORTY-PLUS distinct sites — verify-palette at 11,
 * verify-nav at 11, verify-discrete at 7, several of them inline
 * `(await browser.newContext(…)).newPage()` expressions inside loops.
 *
 * Patching each site by hand is a diff where MISSING ONE IS SILENT: the
 * missed page loads the splash, measures it, and reports a confident number.
 * That is precisely the class of defect this sweep exists to prevent, so
 * choosing a mechanism that can reintroduce it forty times over would be
 * self-defeating. A wrapper cannot miss a site, because it does not enumerate
 * sites.
 *
 * The cost is real and worth naming: this monkey-patches two Playwright
 * methods, so a gate that constructs pages by some other route (a raw CDP
 * target, a popup opened by the page itself) is NOT covered. That is exactly
 * why `assertColdBootBypassed()` exists and is applied at the measurement
 * points rather than being assumed from this call.
 */
export async function coldBootOffBrowser(browser) {
  if (browser.__coldBootWrapped) return browser;
  const origContext = browser.newContext.bind(browser);
  const origPage = browser.newPage.bind(browser);
  browser.newContext = async (...args) => {
    const ctx = await origContext(...args);
    await coldBootOff(ctx);
    return ctx;
  };
  browser.newPage = async (...args) => {
    const page = await origPage(...args);
    // Re-applying on a page whose context was already wrapped is harmless —
    // it assigns the same global twice — and covers browser.newPage(), which
    // does NOT route through the public newContext() above.
    await coldBootOff(page);
    return page;
  };
  browser.__coldBootWrapped = true;
  return browser;
}

/**
 * Assert the skip actually TOOK, on a page that has already navigated.
 *
 * An assertion cannot see its own precondition: a gate that measures Home
 * while the splash covers it does not fail, it reports a confident number
 * about the wrong pixels. So every gate that bypasses boot also proves the
 * bypass landed, and a helper that silently stops working reddens a counter
 * instead of quietly measuring an overlay.
 *
 * Read the DOM, never the flag we ourselves set — asserting `window.__XMR_
 * COLDBOOT__ === 'off'` would only prove this helper can write a global,
 * which is never in doubt. The splash root carrying `data-coldboot` is the
 * app's own statement about what it rendered.
 */
/** Pages whose splash-settle wait has already been paid. */
const _coldBootSettled = new WeakSet();

/**
 * Wait until the cold-boot decision is OBSERVABLE, then sample.
 *
 * ── WHY A BARE COUNT AT `load` IS VACUOUS ─────────────────────────────────
 * `ColdBoot` is `React.lazy`, so at `load` its chunk has not resolved and the
 * splash is not in the DOM yet. `locator().count()` does NOT auto-wait the way
 * `expect()` does — it samples immediately and returns 0.
 *
 * MEASURED on this tree: with the bypass deliberately OFF, so the splash MUST
 * mount, a count taken at `load` returned 0 and the assertion PASSED. All
 * thirteen preconditions were therefore incapable of detecting a failed
 * bypass — the single thing they exist to detect.
 *
 * Splash mount latency after `load`, 5 runs: 348/336/271/357/363 ms (max 363).
 * The 3000 ms bound below is ~8x that worst case. It is a BOUND, not a sleep:
 * the common (absent) path pays it only once per page, and the present path
 * returns as soon as the node appears. A fixed `waitForTimeout` is rejected
 * for the reason it is always rejected here — long enough today is a flake
 * tomorrow, and it would pay the cost even on the fast path.
 */
async function settleColdBoot(page) {
  if (_coldBootSettled.has(page)) return;
  await page.waitForSelector(COLDBOOT_SEL, { timeout: 3000 }).catch(() => {});
  _coldBootSettled.add(page);
}

export async function assertColdBootBypassed(page, R, label = '/') {
  await settleColdBoot(page);
  const n = await page.locator(COLDBOOT_SEL).count();
  return R.ok(
    n === 0,
    `${label}: cold-boot splash bypassed — no ${COLDBOOT_SEL} in the DOM`,
    n > 0
      ? `${n} ${COLDBOOT_SEL} element(s) present: the splash is covering this page and every ` +
        `measurement below describes the splash, not the route. Was coldBootOff() awaited BEFORE goto()?`
      : '',
  );
}

// Re-export STATUS_FIXTURE so all existing importers are unaffected.
// The fixture itself now lives in verify-fixtures.mjs (see the import above).
export { STATUS_FIXTURE };

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
