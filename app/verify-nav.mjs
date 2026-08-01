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

const R = makeReporter('verify-nav');
const SETTLE = 500;
const TOL = 2;

const { browser, engine } = await launch();
R.info(`engine: ${engine}`);
R.info(`base:   ${BASE}`);

/** domcontentloaded + the shell selector. Never networkidle — see the header. */
async function open(page, route) {
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.art-stage', { timeout: 20000 });
}

const liveText = (page) =>
  page.evaluate(() => {
    const el = document.querySelector('div.sr-only[role="status"]');
    return el ? (el.textContent || '') : null;
  });

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
  if (!found) throw new Error(`keyActivate: no focusable ${selector} containing ${JSON.stringify(text)}`);
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
    await page.waitForFunction(() => document.querySelectorAll('#page-title').length > 0, null, { timeout: 12000 })
      .catch(() => {});
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
  await open(page, '/mempool');
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
  await page.click('nav.topnav a[href="/markets"]');
  await page.waitForFunction(() => location.pathname === '/markets', null, { timeout: 15000 });
  await page.waitForSelector('#page-title', { timeout: 15000 });
  await page.waitForTimeout(SETTLE);

  const after = await page.evaluate(() => ({
    active: document.activeElement ? document.activeElement.id : null,
    activeTag: document.activeElement ? document.activeElement.tagName : null,
    text: document.querySelector('div.sr-only[role="status"]')?.textContent ?? '',
    len: history.length,
  }));
  R.ok(after.active === 'main', `focus moved to #main after a client-side nav (got ${after.activeTag}#${after.active})`);
  R.ok(after.text.length > 0, 'live region is non-empty after the nav');
  R.ok(/markets/i.test(after.text), `live region names the route: ${JSON.stringify(after.text)}`);
  R.ok(after.len === before + 1, `a nav link PUSHES one history entry (${before} → ${after.len})`);

  // A search-only change must NOT steal focus from the control that caused it.
  await page.click('button[aria-pressed="false"].proto-btn');
  await page.waitForFunction(() => location.search.includes('range='), null, { timeout: 10000 });
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
  await page.waitForFunction(() => location.pathname === '/monero/legality', null, { timeout: 15000 });
  await page.waitForTimeout(SETTLE);
  const afterTab = await scrollTops(page);
  const decTab = await navDebug(page);
  R.ok(afterTab.main === 0, `tab switch resets main.main to 0 (got ${afterTab.main})`);
  R.ok(decTab?.decision === 'top', `precedence rule 3 fired: decision="${decTab?.decision}" (expected "top")`);

  await page.goBack();
  await page.waitForFunction(() => location.pathname === '/monero/tech', null, { timeout: 15000 });
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
  await open(page, '/mempool?v=terminal');
  await page.waitForTimeout(SETTLE * 2);
  const extent = await scrollTops(page);
  R.ok((extent.canvasMax ?? 0) >= 400, `.mp-canvas-scroll is scrollable past 400 on ?v=terminal (max ${extent.canvasMax})`);

  await parkScroll(page, '.mp-canvas-scroll', 400);
  const parked = await scrollTops(page);
  R.ok(Math.abs((parked.canvas ?? -1) - 400) <= TOL, `parked .mp-canvas-scroll at 400 (got ${parked.canvas})`);

  await page.click('nav.topnav a[href="/markets"]');
  await page.waitForFunction(() => location.pathname === '/markets', null, { timeout: 15000 });
  await page.waitForTimeout(SETTLE);
  const away = await scrollTops(page);
  R.ok(away.canvas === null, 'the pan box is gone on /markets (nothing to compare against)');
  R.ok(away.main === 0, `/markets opens at the top (main.main ${away.main})`);

  await page.goBack();
  await page.waitForFunction(() => location.pathname === '/mempool', null, { timeout: 15000 });
  await page.waitForSelector('.mp-canvas-scroll', { timeout: 15000 });
  await page.waitForTimeout(SETTLE * 2);
  const back = await scrollTops(page);
  const dec = await navDebug(page);
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
  await page.waitForFunction(() => location.pathname === '/monero/legality', null, { timeout: 15000 });
  await page.waitForTimeout(SETTLE);
  const afterTab = await scrollTops(page);
  R.ok(afterTab.doc === 0, `tab switch resets the document to 0 (got ${afterTab.doc})`);

  await page.goBack();
  await page.waitForFunction(() => location.pathname === '/monero/tech', null, { timeout: 15000 });
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
  await page.click('.brand-col a[href="/sources#release-notes"]');
  await page.waitForFunction(() => location.pathname === '/sources', null, { timeout: 15000 });
  await page.waitForTimeout(1800); // the anchor scroll is `behavior: "smooth"`
  const hashDec = await navDebug(page);
  const hashPos = await scrollTops(page);
  R.ok(hashDec?.decision === 'hash', `precedence rule 2 fired: decision="${hashDec?.decision}" (expected "hash")`);
  R.ok((hashPos.main ?? 0) > 0, `SourcesPage's own anchor scroll survived (main.main at ${hashPos.main})`);

  // Rule 4 — a search-only change leaves the reader where they were. Driven
  // through the app's own control (Markets' range buttons write `?range=`),
  // not a synthetic pushState: a hand-rolled popstate carries no router key
  // and is read as a POP into an existing entry, which is rule 1, not rule 4.
  await open(page, '/markets');
  await page.waitForSelector('#page-title', { timeout: 15000 });
  await page.waitForTimeout(SETTLE * 2);
  const marketsExtent = await scrollTops(page);
  R.ok((marketsExtent.mainMax ?? 0) >= 400, `/markets main.main is scrollable past 400 (max ${marketsExtent.mainMax})`);
  await parkScroll(page, 'main.main', 400);
  await keyActivate(page, 'button.proto-btn', '90D');
  await page.waitForFunction(() => location.search.includes('range=90D'), null, { timeout: 10000 });
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

  await open(page, '/mempool?v=classic&block=2900000');
  await page.waitForTimeout(SETTLE * 2);
  const start = await page.evaluate(() => ({ url: location.search, len: history.length }));
  R.ok(/block=2900000/.test(start.url), `?block= present before the click (${start.url})`);

  // The switcher list is collapsed until its trigger is pressed (desktop too).
  await page.click('.mp-switcher__trigger');
  await page.waitForSelector('.mp-switcher__list.is-open', { timeout: 10000 });
  await page.click('.mp-switcher__list button:has-text("Terminal")');
  await page.waitForFunction(() => location.search.includes('v=terminal'), null, { timeout: 10000 });
  await page.waitForTimeout(SETTLE);

  const end = await page.evaluate(() => ({ url: location.search, len: history.length }));
  R.ok(/v=terminal/.test(end.url), `?v changed to terminal (${end.url})`);
  R.ok(/block=2900000/.test(end.url), 'the ?block= deep link SURVIVED the view change');
  R.ok(end.len === start.len + 1, `?v= PUSHES exactly one history entry (${start.len} → ${end.len})`);

  await page.goBack();
  await page.waitForFunction(() => location.search.includes('v=classic'), null, { timeout: 10000 });
  const backUrl = await page.evaluate(() => location.search);
  R.ok(/v=classic/.test(backUrl) && /block=2900000/.test(backUrl), `Back returns to the previous view (${backUrl})`);

  await page.context().close();
}

R.group('── §4b · ?range= replaces, and 30D writes no param ───────────');
{
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();

  await open(page, '/markets');
  await page.waitForSelector('#page-title', { timeout: 15000 });
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
  await page.waitForFunction(() => location.search.includes('range=90D'), null, { timeout: 10000 });
  await page.click('button.proto-btn:has-text("1Y")');
  await page.waitForFunction(() => location.search.includes('range=1Y'), null, { timeout: 10000 });
  await page.waitForTimeout(SETTLE);

  const twoClicks = await page.evaluate(() => ({ search: location.search, len: history.length }));
  R.ok(twoClicks.len === initial.len, `two range clicks add NO history entries (${initial.len} → ${twoClicks.len})`);
  R.ok(/range=1Y/.test(twoClicks.search), `?range reflects the last click (${twoClicks.search})`);

  await page.click('button.proto-btn:has-text("30D")');
  await page.waitForFunction(() => !location.search.includes('range='), null, { timeout: 10000 }).catch(() => {});
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

await browser.close();
process.exit(R.finish());
