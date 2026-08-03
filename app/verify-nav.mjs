// verify-nav.mjs — D0726 / D0744 / D0745 / D0746. Navigation semantics.
// Run from app/, against a served dist:
//   node scripts/serve-dist.mjs 4173 &   →   node verify-nav.mjs
//
// Five things this gate holds, none of which any existing gate covered:
//
//   §1 ONE <h1> PER ROUTE. `document.querySelectorAll("#page-title").length`
//      must be exactly 1 on every route in verify-lib's ROUTES. Both failure
//      directions matter: 0 means a page that renders no heading (four of them
//      did — /mempool, /mempool/tx/:txid, the 404 and /simulate) has left
//      AppShell's `<main aria-labelledby="page-title">` pointing at nothing,
//      which is a WORSE accessible name than none at all; 2 means something
//      rendered two PageHeaders, or an .sr-only heading was added to a page
//      that already had a visible one.
//
//   §2 FOCUS AND THE LIVE REGION. After a client-side navigation, focus is on
//      <main id="main"> and the live region names the route. On FIRST load the
//      region is EMPTY — a first page load is announced by the browser, and
//      the prerendered HTML must not carry a stale sentence.
//
//   §3 SCROLL, ON ALL THREE SCROLLERS. This is the substance of D0726 and the
//      reason it needed a hook rather than a one-liner: `.art` is
//      `height:100vh; overflow:hidden`, so above 768px the DOCUMENT never
//      scrolls — `main.main` does, and on /mempool `.mp-canvas-scroll` is a
//      third, independent scroller. The two `window.scrollTo(0, 0)` calls this
//      work deleted were no-ops on every desktop for exactly that reason. Each
//      of the three is exercised where it is the real scroller.
//
//   §4 QUERY-STRING IDIOMS. `?v=` must not clobber `?block=` (it did), and the
//      push/replace policy must be observable in history.length.
//
//   §5 SKIP LINK. Tab once from a fresh load, activate, land on #main.
//
// NO `waitUntil: 'networkidle'` ANYWHERE. The app's FAST polling tier fires
// every 3s, so the network is never idle: idle either races or waits out the
// full timeout. Every navigation below is `domcontentloaded` plus an explicit
// selector — the same correction verify-contrast.mjs carries.
//
// SCROLL EXTENTS ARE MEASURED, NOT ASSUMED. This sandbox reaches no live data,
// so pages boot to their skeletons and several are SHORTER than they are in
// production: at 1440, `/monero` (the overview tab) has zero scrollable
// overflow, and `/mempool?v=classic`'s canvas has 355px — less than the 400px
// this gate wants to park at. The scenarios below therefore start on surfaces
// that are genuinely scrollable in THIS environment (`/monero/tech`, 931px;
// `/mempool?v=terminal`, 525px) and each one asserts up front that its target
// really did reach 400. A restore test that silently ran against an
// unscrollable element would pass forever and prove nothing.

import { BASE, launch, makeReporter, ROUTES } from './verify-lib.mjs';
import { R as Routes } from './scripts/routes.mjs';

const R = makeReporter('verify-nav');
const SETTLE = 500;
const TOL = 2;

const { browser, engine } = await launch();
R.info(`engine: ${engine}`);
R.info(`base:   ${BASE}`);

/**
 * Every wait below is SOFT: a timeout resolves instead of throwing.
 *
 * This is not laziness about error handling, it is what makes the gate useful
 * when it fails. The first run against a deliberately broken build died at
 * §2's `waitForSelector('#page-title')` and never reported §3, §4 or §5 at all
 * — so a single regression hid four unrelated sections. Timeouts here degrade
 * into the assertion that follows them reading a wrong value and printing ❌,
 * which is the whole point: a gate should say everything that is broken, not
 * the first thing.
 */
const soft = (p) => p.catch(() => null);

/** domcontentloaded + the shell selector. Never networkidle — see the header. */
async function open(page, route) {
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
  await soft(page.waitForSelector('.art-stage', { timeout: 20000 }));
}

/** Wait for at least one #page-title to be in the DOM. `waitForSelector`
 *  cannot be used for this: four pages render theirs as `.sr-only`, and a
 *  visibility-gated wait on a 1×1 clipped box is engine-dependent. */
const waitForHeading = (page, timeout = 12000) =>
  soft(page.waitForFunction(() => document.querySelectorAll('#page-title').length > 0, null, { timeout }));

const navDebug = (page) => page.evaluate(() => window.__XMR_NAV_DEBUG__ || null);

const scrollTops = (page) =>
  page.evaluate(() => {
    const de = document.scrollingElement;
    const m = document.querySelector('main.main');
    const c = document.querySelector('.mp-canvas-scroll');
    return {
      doc: de ? de.scrollTop : null,
      main: m ? m.scrollTop : null,
      canvas: c ? c.scrollTop : null,
      docMax: de ? de.scrollHeight - de.clientHeight : null,
      mainMax: m ? m.scrollHeight - m.clientHeight : null,
      canvasMax: c ? c.scrollHeight - c.clientHeight : null,
    };
  });

/** Park one scroller at `to` and give the rAF-coalesced save one frame to land. */
async function parkScroll(page, selector, to) {
  await page.evaluate(
    ([sel, y]) => {
      const el = sel === 'doc' ? document.scrollingElement : document.querySelector(sel);
      if (el) el.scrollTop = y;
    },
    [selector, to],
  );
  await page.waitForTimeout(150);
}

/**
 * Activate a control from the KEYBOARD, without letting the harness move the
 * page first.
 *
 * `page.click()` runs Playwright's actionability checks, and the first of them
 * is scrollIntoViewIfNeeded — which scrolls the control's nearest scrollable
 * ancestor. Every scroll scenario below parks a scroller at 400 and then
 * activates a control that is ABOVE that point (the /monero tab strip sits at
 * the top of `main.main`), so a plain click silently rewinds the exact scroll
 * position under test before the navigation it is supposed to trigger. The
 * gate then measures the harness, not the app — and it does so
 * NON-DETERMINISTICALLY, since whether a scroll is "needed" depends on where
 * the control landed.
 *
 * `focus({ preventScroll: true })` + Enter is a real activation path (it is
 * what a keyboard user does) and touches no scroller. The click event
 * dispatched by Enter on a <button> is indistinguishable from a pointer one as
 * far as the app is concerned.
 */
async function keyActivate(page, selector, text) {
  const found = await page.evaluate(
    ([sel, label]) => {
      const el = [...document.querySelectorAll(sel)]
        .find((n) => (n.textContent || '').trim().toUpperCase().includes(label.toUpperCase()));
      if (!el) return false;
      el.focus({ preventScroll: true });
      return document.activeElement === el;
    },
    [selector, text],
  );
  if (!found) {
    // A reported failure, not a throw — see `soft` above. A missing control is
    // exactly as interesting as a wrong measurement, and killing the process
    // here would hide every section that follows.
    R.ok(false, `keyActivate: no focusable ${selector} containing ${JSON.stringify(text)}`);
    return;
  }
  await page.keyboard.press('Enter');
}

// ─────────────────────────────────────────────────────────────────────────────
// §1 · exactly one #page-title per route
// ─────────────────────────────────────────────────────────────────────────────
R.group(`── §1 · one <h1 id="page-title"> per route · ${ROUTES.length} routes ──`);
{
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const counts = new Map();
  let bad = 0;

  for (const route of ROUTES) {
    await open(page, route);
    // The heading may arrive a frame after the shell on a lazy route; wait for
    // it, but do not let the wait DECIDE the assertion — the count is read
    // afterwards either way, so 0 and 2 both still fail.
    await waitForHeading(page);
    const n = await page.evaluate(() => document.querySelectorAll('#page-title').length);
    counts.set(n, (counts.get(n) || 0) + 1);
    if (n !== 1) {
      bad++;
      R.ok(false, `${route} → ${n} #page-title`);
    }
  }
  R.ok(bad === 0, `every route has exactly one #page-title (${ROUTES.length} routes)`);
  R.info(`counts: ${[...counts.entries()].map(([n, c]) => `${c}×${n}`).join(' · ')}`);

  // The landmark itself, and the fact that it points at a real element.
  await open(page, Routes.LIVE_MEMPOOL);
  const landmark = await page.evaluate(() => {
    const m = document.getElementById('main');
    if (!m) return null;
    const labelled = m.getAttribute('aria-labelledby');
    return {
      tag: m.tagName,
      tabindex: m.getAttribute('tabindex'),
      labelledby: labelled,
      resolves: !!(labelled && document.getElementById(labelled)),
      skipHref: document.querySelector('a.skip-link')?.getAttribute('href') ?? null,
      skipIsFirstInStage: document.querySelector('.art-stage')?.firstElementChild?.classList.contains('skip-link') ?? false,
    };
  });
  R.ok(landmark?.tag === 'MAIN', `#main is a <main> element (got ${landmark?.tag})`);
  R.ok(landmark?.tabindex === '-1', `#main carries tabindex="-1" (got ${landmark?.tabindex})`);
  R.ok(landmark?.labelledby === 'page-title', `#main is aria-labelledby="page-title"`);
  R.ok(landmark?.resolves === true, 'aria-labelledby resolves to a real element (no dangling reference)');
  R.ok(landmark?.skipHref === '#main', `skip link points at #main (got ${landmark?.skipHref})`);
  R.ok(landmark?.skipIsFirstInStage === true, 'skip link is the first child of .art-stage');

  await page.context().close();
}

// ─────────────────────────────────────────────────────────────────────────────
// §2 · route announcer + focus management
// ─────────────────────────────────────────────────────────────────────────────
R.group('── §2 · live region + post-navigation focus ──────────────────');
{
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();

  await open(page, '/');
  await page.waitForTimeout(SETTLE);

  const region = await page.evaluate(() => {
    const el = document.querySelector('div.sr-only[role="status"]');
    if (!el) return null;
    return {
      live: el.getAttribute('aria-live'),
      atomic: el.getAttribute('aria-atomic'),
      text: el.textContent || '',
      // Persistence: the region must NOT be inside the routed page subtree,
      // or it is recreated on the very event it exists to report.
      insideArt: !!el.closest('.art'),
    };
  });
  R.ok(region !== null, 'a role="status" live region exists');
  R.ok(region?.live === 'polite', `aria-live="polite" (got ${region?.live})`);
  R.ok(region?.atomic === 'true', `aria-atomic="true" (got ${region?.atomic})`);
  R.ok(region?.insideArt === false, 'live region is OUTSIDE the routed page subtree (persistent across navigations)');
  R.ok(region?.text === '', `live region is EMPTY on first load (got ${JSON.stringify(region?.text)})`);

  const before = await page.evaluate(() => history.length);
  // Navigate to Markets using the dropdown nav. Open with arrow key and click the link.
  const firstNavItem = page.locator('button.navitem').first();
  await firstNavItem.focus();
  await page.keyboard.press('ArrowDown'); // Open dropdown
  await page.waitForTimeout(100);
  // Click the Markets link in the dropdown panel
  const marketsLink = page.locator(`#nav-dd-panel a[href="${Routes.LIVE_MARKETS}"]`);
  await soft(marketsLink.click());
  await soft(page.waitForFunction(() => location.pathname === Routes.LIVE_MARKETS, null, { timeout: 15000 }));
  await soft(page.waitForSelector('#page-title', { timeout: 15000 }));
  await page.waitForTimeout(SETTLE);

  const after = await page.evaluate(() => ({
    pathname: location.pathname,
    active: document.activeElement ? document.activeElement.id : null,
    activeTag: document.activeElement ? document.activeElement.tagName : null,
    text: document.querySelector('div.sr-only[role="status"]')?.textContent ?? '',
    len: history.length,
  }));
  R.ok(after.pathname === Routes.LIVE_MARKETS, `nav link changed pathname to ${Routes.LIVE_MARKETS} (got ${after.pathname})`);
  R.ok(after.active === 'main', `focus moved to #main after a client-side nav (got ${after.activeTag}#${after.active})`);
  R.ok(after.text.length > 0, 'live region is non-empty after the nav');
  R.ok(/markets/i.test(after.text), `live region names the route: ${JSON.stringify(after.text)}`);
  R.ok(after.len === before + 1, `a nav link PUSHES one history entry (${before} → ${after.len})`);

  // A search-only change must NOT steal focus from the control that caused it.
  await page.click('button[aria-pressed="false"].proto-btn');
  await soft(page.waitForFunction(() => location.search.includes('range='), null, { timeout: 10000 }));
  await page.waitForTimeout(SETTLE);
  const afterRange = await page.evaluate(() => ({
    active: document.activeElement ? document.activeElement.tagName : null,
    id: document.activeElement ? document.activeElement.id : null,
  }));
  R.ok(afterRange.id !== 'main', `a ?range= change leaves focus on the control (got ${afterRange.active})`);

  await page.context().close();
}

// ─────────────────────────────────────────────────────────────────────────────
// §3 · scroll restoration — three scrollers
// ─────────────────────────────────────────────────────────────────────────────
R.group('── §3a · main.main (the desktop scroller) at 1440 ────────────');
{
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();

  // /monero's OVERVIEW tab has zero overflow in this data-less sandbox, so the
  // scenario starts on /monero/tech, which has ~931px of it. Same surface,
  // same tab mechanism, an element that can actually hold a scroll position.
  await open(page, '/monero/tech');
  await page.waitForTimeout(SETTLE);
  const extent = await scrollTops(page);
  R.ok((extent.mainMax ?? 0) >= 400, `main.main is scrollable past 400 on /monero/tech (max ${extent.mainMax})`);

  await parkScroll(page, 'main.main', 400);
  const parked = await scrollTops(page);
  R.ok(Math.abs((parked.main ?? -1) - 400) <= TOL, `parked main.main at 400 (got ${parked.main})`);

  await keyActivate(page, '.tabstrip button', 'legality');
  await soft(page.waitForFunction(() => location.pathname === '/monero/legality', null, { timeout: 15000 }));
  await page.waitForTimeout(SETTLE);
  const afterTab = await scrollTops(page);
  const decTab = await navDebug(page);
  R.ok(afterTab.main === 0, `tab switch resets main.main to 0 (got ${afterTab.main})`);
  R.ok(decTab?.decision === 'top', `precedence rule 3 fired: decision="${decTab?.decision}" (expected "top")`);

  await page.goBack();
  await soft(page.waitForFunction(() => location.pathname === '/monero/tech', null, { timeout: 15000 }));
  await page.waitForTimeout(SETTLE);
  const back = await scrollTops(page);
  const decBack = await navDebug(page);
  R.ok(Math.abs((back.main ?? -1) - 400) <= TOL, `Back restores main.main to 400 ±${TOL} (got ${back.main})`);
  R.ok(decBack?.decision === 'restore', `precedence rule 1 fired: decision="${decBack?.decision}" (expected "restore")`);

  await page.context().close();
}

R.group('── §3b · .mp-canvas-scroll (mempool pan box) at 1440 ─────────');
{
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();

  // ?v=classic's canvas has only 355px of overflow here; terminal has ~525.
  await open(page, `${Routes.LIVE_MEMPOOL}?v=terminal`);
  await page.waitForTimeout(SETTLE * 2);
  const extent = await scrollTops(page);
  R.ok((extent.canvasMax ?? 0) >= 400, `.mp-canvas-scroll is scrollable past 400 on ?v=terminal (max ${extent.canvasMax})`);

  await parkScroll(page, '.mp-canvas-scroll', 400);
  const parked = await scrollTops(page);
  R.ok(Math.abs((parked.canvas ?? -1) - 400) <= TOL, `parked .mp-canvas-scroll at 400 (got ${parked.canvas})`);

  // Navigate to Markets using keyboard navigation through dropdown
  const navItem = page.locator('button.navitem').first();
  await navItem.focus();
  await page.keyboard.press('ArrowDown'); // Open dropdown
  await page.waitForTimeout(100);
  const link = page.locator(`#nav-dd-panel a[href="${Routes.LIVE_MARKETS}"]`);
  await soft(link.click());
  await soft(page.waitForFunction(() => location.pathname === Routes.LIVE_MARKETS, null, { timeout: 15000 }));
  await page.waitForTimeout(SETTLE);
  const away = await scrollTops(page);
  const awayPath = await page.evaluate(() => location.pathname);
  R.ok(awayPath === Routes.LIVE_MARKETS, `nav link changed pathname to ${Routes.LIVE_MARKETS} (got ${awayPath})`);
  R.ok(away.canvas === null, 'the pan box is gone on /markets (nothing to compare against)');
  R.ok(away.main === 0, `/markets opens at the top (main.main ${away.main})`);

  await page.goBack();
  await soft(page.waitForFunction(() => location.pathname === Routes.LIVE_MEMPOOL, null, { timeout: 15000 }));
  await soft(page.waitForSelector('.mp-canvas-scroll', { timeout: 15000 }));
  await page.waitForTimeout(SETTLE * 2);
  const back = await scrollTops(page);
  const backPath = await page.evaluate(() => location.pathname);
  const dec = await navDebug(page);
  R.ok(backPath === Routes.LIVE_MEMPOOL, `Back restored pathname to ${Routes.LIVE_MEMPOOL} (got ${backPath})`);
  R.ok(Math.abs((back.canvas ?? -1) - 400) <= TOL, `Back restores .mp-canvas-scroll to 400 ±${TOL} (got ${back.canvas})`);
  R.ok(dec?.decision === 'restore', `decision="${dec?.decision}" (expected "restore")`);

  await page.context().close();
}

R.group('── §3c · document.scrollingElement at 390 (dual-target) ──────');
{
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();

  // Below 768px styles.css flips .main to overflow:visible and the DOCUMENT
  // becomes the scroller — the same route, a different target. Handling both
  // is the whole point of the three-target list in useRouteChrome.ts.
  await open(page, '/monero/tech');
  await page.waitForTimeout(SETTLE);
  const extent = await scrollTops(page);
  R.ok((extent.docMax ?? 0) >= 400, `the document is the scroller at 390 (max ${extent.docMax}, main.main max ${extent.mainMax})`);
  R.ok(extent.mainMax === 0, 'main.main has no overflow at 390 — proving the target really did change');

  await parkScroll(page, 'doc', 400);
  const parked = await scrollTops(page);
  R.ok(Math.abs((parked.doc ?? -1) - 400) <= TOL, `parked document at 400 (got ${parked.doc})`);

  await keyActivate(page, '.tabstrip button', 'legality');
  await soft(page.waitForFunction(() => location.pathname === '/monero/legality', null, { timeout: 15000 }));
  await page.waitForTimeout(SETTLE);
  const afterTab = await scrollTops(page);
  R.ok(afterTab.doc === 0, `tab switch resets the document to 0 (got ${afterTab.doc})`);

  await page.goBack();
  await soft(page.waitForFunction(() => location.pathname === '/monero/tech', null, { timeout: 15000 }));
  await page.waitForTimeout(SETTLE);
  const back = await scrollTops(page);
  R.ok(Math.abs((back.doc ?? -1) - 400) <= TOL, `Back restores the document to 400 ±${TOL} (got ${back.doc})`);

  await page.context().close();
}

R.group('── §3d · precedence rules 2 and 4 ────────────────────────────');
{
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();

  // Rule 2 — a hash target belongs to SourcesPage.tsx's own scrollIntoView.
  // This hook must decide "hash" and touch nothing, or the two fight visibly.
  await open(page, '/');
  await page.waitForTimeout(SETTLE);
  await page.click(`.brand-col a[href="${Routes.ABOUT_SOURCES}#release-notes"]`);
  await soft(page.waitForFunction(() => location.pathname === Routes.ABOUT_SOURCES, null, { timeout: 15000 }));
  await page.waitForTimeout(1800); // the anchor scroll is `behavior: "smooth"`
  const hashDec = await navDebug(page);
  const hashPath = await page.evaluate(() => location.pathname);
  const hashPos = await scrollTops(page);
  R.ok(hashPath === Routes.ABOUT_SOURCES, `nav link changed pathname to ${Routes.ABOUT_SOURCES} (got ${hashPath})`);
  R.ok(hashDec?.decision === 'hash', `precedence rule 2 fired: decision="${hashDec?.decision}" (expected "hash")`);
  R.ok((hashPos.main ?? 0) > 0, `SourcesPage's own anchor scroll survived (main.main at ${hashPos.main})`);

  // Rule 4 — a search-only change leaves the reader where they were. Driven
  // through the app's own control (Markets' range buttons write `?range=`),
  // not a synthetic pushState: a hand-rolled popstate carries no router key
  // and is read as a POP into an existing entry, which is rule 1, not rule 4.
  // R.LIVE_MARKETS, not '/markets'. The old path still LOADS via the client
  // mirror, so this block passed — but it tests scroll precedence rule 4, whose
  // logic turns on router-key and history-entry semantics, and a <Navigate
  // replace> redirect inserts exactly the entry type that logic is sensitive to.
  // It was asserting rule 4 against a different navigation than it names.
  await open(page, Routes.LIVE_MARKETS);
  await soft(page.waitForSelector('#page-title', { timeout: 15000 }));
  await page.waitForTimeout(SETTLE * 2);
  const marketsExtent = await scrollTops(page);
  R.ok((marketsExtent.mainMax ?? 0) >= 400, `/markets main.main is scrollable past 400 (max ${marketsExtent.mainMax})`);
  await parkScroll(page, 'main.main', 400);
  await keyActivate(page, 'button.proto-btn', '90D');
  await soft(page.waitForFunction(() => location.search.includes('range=90D'), null, { timeout: 10000 }));
  await page.waitForTimeout(SETTLE);
  const keep = await scrollTops(page);
  const keepDec = await navDebug(page);
  R.ok(keepDec?.decision === 'keep', `precedence rule 4 fired: decision="${keepDec?.decision}" (expected "keep")`);
  R.ok(Math.abs((keep.main ?? -1) - 400) <= TOL, `a search-only change leaves the scroll alone (got ${keep.main})`);

  await page.context().close();
}

// ─────────────────────────────────────────────────────────────────────────────
// §4 · query-string idioms (D0746)
// ─────────────────────────────────────────────────────────────────────────────
R.group('── §4a · ?v= pushes and must not clobber ?block= ─────────────');
{
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();

  await open(page, `${Routes.LIVE_MEMPOOL}?v=classic&block=2900000`);
  await page.waitForTimeout(SETTLE * 2);
  const start = await page.evaluate(() => ({ url: location.search, len: history.length }));
  R.ok(/block=2900000/.test(start.url), `?block= present before the click (${start.url})`);

  // The switcher list is collapsed until its trigger is pressed (desktop too).
  await page.click('.mp-switcher__trigger');
  await soft(page.waitForSelector('.mp-switcher__list.is-open', { timeout: 10000 }));
  await page.click('.mp-switcher__list button:has-text("Terminal")');
  await soft(page.waitForFunction(() => location.search.includes('v=terminal'), null, { timeout: 10000 }));
  await page.waitForTimeout(SETTLE);

  const end = await page.evaluate(() => ({ url: location.search, len: history.length }));
  R.ok(/v=terminal/.test(end.url), `?v changed to terminal (${end.url})`);
  R.ok(/block=2900000/.test(end.url), 'the ?block= deep link SURVIVED the view change');
  R.ok(end.len === start.len + 1, `?v= PUSHES exactly one history entry (${start.len} → ${end.len})`);

  await page.goBack();
  await soft(page.waitForFunction(() => location.pathname === Routes.LIVE_MEMPOOL && location.search.includes('v=classic'), null, { timeout: 10000 }));
  const backUrl = await page.evaluate(() => location.search);
  const backPath = await page.evaluate(() => location.pathname);
  R.ok(backPath === Routes.LIVE_MEMPOOL, `Back returned to ${Routes.LIVE_MEMPOOL} (got ${backPath})`);
  R.ok(/v=classic/.test(backUrl) && /block=2900000/.test(backUrl), `Back returns to the previous view (${backUrl})`);

  await page.context().close();
}

R.group('── §4b · ?range= replaces, and 30D writes no param ───────────');
{
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();

  await open(page, Routes.LIVE_MARKETS);
  await soft(page.waitForSelector('#page-title', { timeout: 15000 }));
  await page.waitForTimeout(SETTLE);

  const initial = await page.evaluate(() => ({
    search: location.search,
    pressed: [...document.querySelectorAll('button[aria-pressed]')]
      .filter((b) => b.getAttribute('aria-pressed') === 'true')
      .map((b) => b.textContent.trim()),
    len: history.length,
  }));
  R.ok(!/range=/.test(initial.search), `no ?range= written on load (search=${JSON.stringify(initial.search)})`);
  R.ok(initial.pressed.includes('30D'), `30D is the rendered default (pressed: ${initial.pressed.join(',')})`);

  await page.click('button.proto-btn:has-text("90D")');
  await soft(page.waitForFunction(() => location.search.includes('range=90D'), null, { timeout: 10000 }));
  await page.click('button.proto-btn:has-text("1Y")');
  await soft(page.waitForFunction(() => location.search.includes('range=1Y'), null, { timeout: 10000 }));
  await page.waitForTimeout(SETTLE);

  const twoClicks = await page.evaluate(() => ({ search: location.search, len: history.length }));
  R.ok(twoClicks.len === initial.len, `two range clicks add NO history entries (${initial.len} → ${twoClicks.len})`);
  R.ok(/range=1Y/.test(twoClicks.search), `?range reflects the last click (${twoClicks.search})`);

  await page.click('button.proto-btn:has-text("30D")');
  await soft(page.waitForFunction(() => !location.search.includes('range='), null, { timeout: 10000 }));
  const backToDefault = await page.evaluate(() => ({ search: location.search, len: history.length }));
  R.ok(!/range=/.test(backToDefault.search), `selecting the default DELETES the param (search=${JSON.stringify(backToDefault.search)})`);
  R.ok(backToDefault.len === initial.len, `still no history growth (${backToDefault.len})`);

  await page.context().close();
}

// ─────────────────────────────────────────────────────────────────────────────
// §5 · skip link
// ─────────────────────────────────────────────────────────────────────────────
R.group('── §5 · skip link ────────────────────────────────────────────');
{
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();

  await open(page, '/');
  await page.waitForTimeout(SETTLE);
  await page.evaluate(() => document.body.focus());
  await page.keyboard.press('Tab');

  const focused = await page.evaluate(() => {
    const a = document.activeElement;
    if (!a) return null;
    const r = a.getBoundingClientRect();
    return { cls: a.className, tag: a.tagName, w: Math.round(r.width), h: Math.round(r.height) };
  });
  R.ok(focused?.cls === 'skip-link', `the first Tab lands on the skip link (got ${focused?.tag}.${focused?.cls})`);
  R.ok((focused?.w ?? 0) > 1 && (focused?.h ?? 0) > 1,
    `the skip link is VISIBLE once focused (${focused?.w}×${focused?.h}px — a 1×1 clipped box would be useless)`);

  await page.keyboard.press('Enter');
  await page.waitForTimeout(SETTLE);
  const landed = await page.evaluate(() => ({
    id: document.activeElement ? document.activeElement.id : null,
    tag: document.activeElement ? document.activeElement.tagName : null,
  }));
  R.ok(landed.id === 'main', `activating the skip link moves focus to #main (got ${landed.tag}#${landed.id})`);

  await page.context().close();
}

// ─────────────────────────────────────────────────────────────────────────────
// §6 · D0661 · the mempool switcher's open cascade
// ─────────────────────────────────────────────────────────────────────────────
// verify-discrete.mjs §5 gates the /future and /peers CARD grids (`.v6-stagger`)
// and §6 gates this list's open/close TRANSITION — but nothing gated the
// per-item cascade on the switcher tiles, which is a second call site of the
// same `--stagger-i` contract split across two streams (MempoolPage.tsx emits
// the index and the class; styles.css owns the keyframe and the delay). A
// contract with one half in each of two files and no gate is how the index
// silently stops matching the selector.
R.group('── §6 · D0661 · mempool switcher stagger ─────────────────────');
{
  const readTiles = (page) =>
    page.evaluate(() => {
      const list = document.querySelector('.mp-switcher__list');
      const items = [...document.querySelectorAll('.mp-switcher__list > .mp-switcher__item')];
      return {
        open: !!list && list.classList.contains('is-open'),
        count: items.length,
        tiles: items.map((el) => {
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return {
            idx: cs.getPropertyValue('--stagger-i').trim(),
            name: cs.animationName,
            delay: cs.animationDelay,
            // Content presence, measured — the reduced-motion invariant is
            // "suppress ANIMATION, not CONTENT", so the tiles must still be
            // real boxes with real text when the cascade is off.
            w: Math.round(r.width),
            h: Math.round(r.height),
            text: (el.textContent || '').trim().length,
          };
        }),
      };
    });

  // — motion allowed —
  {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    await open(page, Routes.LIVE_MEMPOOL);
    await page.waitForTimeout(SETTLE);
    await page.click('.mp-switcher__trigger');
    await soft(page.waitForSelector('.mp-switcher__list.is-open', { timeout: 10000 }));
    await page.waitForTimeout(120);

    const m = await readTiles(page);
    R.ok(m.open === true, 'the switcher list opens on its trigger');
    R.ok(m.count === 6, `all six view tiles carry .mp-switcher__item (got ${m.count})`);
    const idx = m.tiles.map((t) => t.idx);
    R.ok(idx.join(',') === '0,1,2,3,4,5', `--stagger-i is the tile index, 0..5 (got ${idx.join(',')})`);
    // `[].every(...)` is TRUE — a vacuous pass. Proved by the break-test: with
    // the class renamed, three of this section's assertions went green on an
    // empty node list while the count assertion went red. Every `every` below
    // is therefore paired with a length check.
    R.ok(m.tiles.length === 6 && m.tiles.every((t) => t.name === 'stagger-rise'),
      `every tile animates stagger-rise (got ${[...new Set(m.tiles.map((t) => t.name))].join('/')})`);
    const delays = m.tiles.map((t) => t.delay);
    R.ok(delays.join(',') === '0s,0.03s,0.06s,0.09s,0.12s,0.15s',
      `delays resolve to a 30ms cascade (got ${delays.join(',')})`);
    R.ok(new Set(delays).size === 6, `all six delays are DISTINCT — a cascade, not a single flash (${new Set(delays).size}/6)`);
    await page.context().close();
  }

  // — reduced motion —
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await open(page, Routes.LIVE_MEMPOOL);
    await page.waitForTimeout(SETTLE);
    await page.click('.mp-switcher__trigger');
    await soft(page.waitForSelector('.mp-switcher__list.is-open', { timeout: 10000 }));
    await page.waitForTimeout(120);

    const r = await readTiles(page);
    R.ok(r.open === true, 'the list still opens under prefers-reduced-motion: reduce');
    R.ok(r.count === 6, `all six tiles still RENDER under reduce (got ${r.count}) — content is not suppressed`);
    R.ok(r.tiles.length === 6 && r.tiles.every((t) => t.name === 'none'),
      `zero animation applied under reduce (got ${[...new Set(r.tiles.map((t) => t.name))].join('/')})`);
    R.ok(r.tiles.length === 6 && r.tiles.every((t) => t.w > 0 && t.h > 0 && t.text > 0),
      'every tile still has a real box and real text under reduce (nothing is conveyed by the movement alone)');
    await ctx.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// §7 · navigation layout: 6 top-level items, no wrap at ≥360px
// ─────────────────────────────────────────────────────────────────────────────
R.group('── §7 · 6 top-level items, no wrap at widths ≥360px ──────────');
{
  const widths = [360, 390, 480, 720, 725, 900, 1200, 1440];
  for (const w of widths) {
    const page = await (await browser.newContext({ viewport: { width: w, height: 900 } })).newPage();
    await open(page, Routes.HOME);
    await page.waitForTimeout(SETTLE);

    // Get all 6 navitem buttons and their Y coordinates
    const items = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button.navitem');
      if (buttons.length === 0) return { count: 0, items: [] };
      return {
        count: buttons.length,
        items: Array.from(buttons).map((b) => {
          const r = b.getBoundingClientRect();
          return { top: r.top, display: getComputedStyle(b).display };
        }),
      };
    });

    R.ok(items.count === 6, `${w}px: exactly 6 navitem buttons (got ${items.count})`);

    // At ≤720px, navitems should be hidden (display:none due to container query)
    if (w <= 720) {
      const allHidden = items.items.every((it) => it.display === 'none');
      R.ok(allHidden, `${w}px (mobile): all navitems are display:none`);
    } else {
      // Above 720px, all 6 should be visible and on the same row (same top coordinate)
      const visible = items.items.filter((it) => it.display !== 'none');
      const allVisible = visible.length === 6;
      R.ok(allVisible, `${w}px (desktop): all 6 navitems are visible`);

      if (visible.length === 6) {
        const tops = visible.map((it) => it.top);
        const sameRow = tops.every((t) => Math.abs(t - tops[0]) <= 1);
        R.ok(sameRow, `${w}px: all 6 navitems on same row (tops: ${tops.join(', ')})`);
      }
    }

    await page.context().close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// §8 · hover intent: 150ms to open, 220ms to close
// ─────────────────────────────────────────────────────────────────────────────
R.group('── §8 · hover-intent timing (150ms open / 220ms close) ────────');
{
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await open(page, Routes.HOME);
  await page.waitForTimeout(SETTLE);

  const navitem = page.locator('button.navitem').first();
  const navitemBox = await navitem.boundingBox();
  if (!navitemBox) {
    R.ok(false, 'could not find navitem element');
  } else {
    const centerX = navitemBox.x + navitemBox.width / 2;
    const centerY = navitemBox.y + navitemBox.height / 2;

    // Test 1: Quick hover (enter and leave at 80ms) should NOT open
    {
      await page.mouse.move(centerX, centerY);
      await page.waitForTimeout(80);
      await page.mouse.move(0, 0); // Move mouse away
      await page.waitForTimeout(250);
      const panelOpen = await page.locator('#nav-dd-panel.on').count();
      R.ok(panelOpen === 0, 'quick hover (80ms) does not open panel (below 150ms)');
    }

    // Test 2: Hover for 200ms should open (above 150ms)
    {
      await page.mouse.move(centerX, centerY);
      await page.waitForTimeout(200);
      const panelOpen = await page.locator('#nav-dd-panel.on').count();
      R.ok(panelOpen === 1, 'hover 200ms opens panel (above 150ms threshold)');
    }

    // Test 3: Panel stays open while hovering
    {
      await page.waitForTimeout(140); // Total ~340ms
      const panelStillOpen = await page.locator('#nav-dd-panel.on').count();
      R.ok(panelStillOpen === 1, 'panel still open at 340ms');
    }

    // Test 4: Move mouse away, panel closes after ~220ms
    {
      await page.mouse.move(0, 0); // Move mouse away
      await page.waitForTimeout(200);
      let panelOpen = await page.locator('#nav-dd-panel.on').count();
      R.ok(panelOpen === 1, 'panel open 200ms after mouseaway (below 220ms close)');

      // Wait another 100ms to exceed 220ms total
      await page.waitForTimeout(100);
      panelOpen = await page.locator('#nav-dd-panel.on').count();
      R.ok(panelOpen === 0, 'panel closed 300ms after mouseaway (above 220ms threshold)');
    }
  }

  await page.context().close();
}

// ─────────────────────────────────────────────────────────────────────────────
// §9 · mobile bottom tab bar: visible ≤720px, 6 tabs, aria-current, ≥12px labels
// ─────────────────────────────────────────────────────────────────────────────
R.group('── §9 · mobile bottom tab bar (≤720px) ──────────────────────');
{
  // Test at 720px (should be visible)
  const page = await (await browser.newContext({ viewport: { width: 720, height: 844 } })).newPage();
  await open(page, Routes.LIVE_MEMPOOL); // Use a route with an active section
  await page.waitForTimeout(SETTLE);

  const tabbarAnchor = await page.locator('.tabbar-anchor').count();
  R.ok(tabbarAnchor === 1, 'tabbar-anchor element exists at 720px');

  const tabs = await page.evaluate(() => {
    const items = document.querySelectorAll('a.tabbar-item');
    return {
      count: items.length,
      items: Array.from(items).map((el) => {
        const span = el.querySelector('span');
        const cs = getComputedStyle(span || el);
        return {
          current: el.getAttribute('aria-current'),
          fontSize: cs.fontSize,
          text: (el.textContent || '').trim(),
        };
      }),
    };
  });

  R.ok(tabs.count === 6, `exactly 6 tabbar-items (got ${tabs.count})`);

  const hasActive = tabs.items.filter((t) => t.current === 'page').length;
  R.ok(hasActive === 1, `exactly 1 item has aria-current="page" (got ${hasActive})`);

  const fontSizes = tabs.items.map((t) => {
    const match = t.fontSize.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  });
  const allValid = fontSizes.every((fs) => fs >= 12);
  R.ok(allValid, `all tab labels ≥12px (got ${fontSizes.join(', ')}px)`);

  await page.context().close();

  // Test at 721px (should be hidden)
  const widePage = await (await browser.newContext({ viewport: { width: 721, height: 844 } })).newPage();
  await open(widePage, Routes.LIVE_MEMPOOL);
  await widePage.waitForTimeout(SETTLE);

  const tabbarVisibility = await widePage.evaluate(() => {
    const anchor = document.querySelector('.tabbar-anchor');
    const nav = document.querySelector('.tabbar');
    return {
      anchorDisplay: anchor ? getComputedStyle(anchor).display : 'N/A',
      navDisplay: nav ? getComputedStyle(nav).display : 'N/A',
    };
  });
  R.ok(
    tabbarVisibility.anchorDisplay === 'none' || tabbarVisibility.navDisplay === 'none',
    `tabbar-anchor or nav hidden at 721px (anchor: ${tabbarVisibility.anchorDisplay}, nav: ${tabbarVisibility.navDisplay})`
  );

  await widePage.context().close();
}

// ─────────────────────────────────────────────────────────────────────────────
// §10 · morphing pill: width and x-offset track active navitem ±2px
// ─────────────────────────────────────────────────────────────────────────────
R.group('── §10 · morphing pill tracking ±2px ──────────────────────');
{
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();

  // Navigate through several routes (skip HOME since it has no active section pill)
  const testRoutes = [
    { route: Routes.LIVE_MEMPOOL, label: 'Live/Mempool' },
    { route: Routes.MONERO, label: 'Monero' },
    { route: Routes.ABOUT_SOURCES, label: 'About/Sources' },
    { route: Routes.FUTURE, label: 'Future' },
  ];

  for (const { route, label } of testRoutes) {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
    await soft(page.waitForSelector('.art-stage', { timeout: 20000 }));
    await page.waitForTimeout(SETTLE);

    const pillAlignment = await page.evaluate(() => {
      const pill = document.querySelector('#pill');
      const activeItem = document.querySelector('button.navitem[aria-current="page"]');

      if (!pill || !activeItem) {
        return { error: 'missing pill or active item' };
      }

      const nav = activeItem.closest('nav.nav-main');
      if (!nav) return { error: 'no nav ancestor' };

      const pillStyle = pill.style;
      const pillW = parseFloat(pillStyle.width) || 0;
      const pillTransform = pillStyle.transform;
      const pillX = pillTransform ? parseFloat(pillTransform.match(/translateX\(([^)]+)px/)?.[1] || '0') : 0;

      const navRect = nav.getBoundingClientRect();
      const itemRect = activeItem.getBoundingClientRect();
      const itemW = itemRect.width;
      const itemX = itemRect.left - navRect.left;

      return { pillW, pillX, itemW, itemX };
    });

    if (pillAlignment.error) {
      R.ok(false, `${label}: ${pillAlignment.error}`);
      continue;
    }

    const wDiff = Math.abs(pillAlignment.pillW - pillAlignment.itemW);
    const xDiff = Math.abs(pillAlignment.pillX - pillAlignment.itemX);

    R.ok(wDiff <= TOL, `${label}: pill width ±${TOL}px (pill ${pillAlignment.pillW}, item ${pillAlignment.itemW}, diff ${wDiff})`);
    R.ok(xDiff <= TOL, `${label}: pill x-offset ±${TOL}px (pill ${pillAlignment.pillX}, item ${pillAlignment.itemX}, diff ${xDiff})`);
  }

  await page.context().close();
}

await browser.close();
process.exit(R.finish());
