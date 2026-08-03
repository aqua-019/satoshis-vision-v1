// verify-palette.mjs — ⌘K command palette (nav/CommandPalette.tsx). e2e,
// modelled on verify-nav.mjs's house style (soft waits, one reporter, no
// networkidle — the FAST poll tier fires every 3s, so the network is never
// idle and a networkidle wait either races or eats the whole timeout).
//
// Run: node scripts/serve-dist.mjs 4173 &   →   node verify-palette.mjs
//
// ── THE COUNTING RULE (stated here, because "≥70 destinations" is not a
//    measurement unless the thing being counted is named) ─────────────────
// This gate follows the SAME convention the read-only spec mockup
// (docs/v6-mockups/nav-ia-mockup.html) uses for its own "N destinations
// reachable by typing" figure: count ROWS — section roots + IA leaves +
// Home + actions — so this build's total is directly comparable to the
// mockup's 73. §0 below computes that count OFFLINE, from the same
// nav/ia.ts data CommandPalette.tsx reads (imported directly under bare
// Node — verify-ia.mjs and half a dozen other gates already do this; see
// their headers), prints the breakdown, and later cross-checks it against
// the `data-cmdk-*` attributes the mounted component reports (§12) so the
// number in this file's output and the number the shipped component
// believes are proven to agree, not just separately asserted.
//
// ── A REAL PREMISE MISMATCH, RECORDED RATHER THAN SILENTLY RESOLVED ────────
// nav/ia.ts's own header says Home "is owned by the brand mark, not a
// section child" — but its DATA embeds a "Home" leaf inside the Live
// section's Mempool column (that file's comment: "`/` has nowhere else in
// the IA to live … this is the first, most-findable slot"). The task brief
// for this palette describes Home as "deliberately not an IA leaf" as if
// nav/ia.ts already kept it separate; it does not. CommandPalette.tsx
// resolves this by excluding that one embedded leaf (`item.p === R.HOME`)
// and adding a single explicit Home row instead, so `/` is never listed
// twice — this gate's own §0 replica applies the identical exclusion, for
// the identical reason (see CommandPalette.tsx's file header for the full
// account).
//
// NO waitUntil:'networkidle' anywhere in this file (grep it — the literal
// string does not appear). Every navigation is `domcontentloaded` plus an
// explicit selector wait.

import { BASE, launch, makeReporter, coldBootOffBrowser, assertColdBootBypassed } from './verify-lib.mjs';
import { IA } from './src/nav/ia.ts';
import { R } from './scripts/routes.mjs';

const REPORT = makeReporter('verify-palette');
const SETTLE = 300;

const { browser, engine } = await launch();
// v6.1.8: open(page, '/') appears 11x in this file. See verify-lib.mjs's
// COLD BOOT block.
await coldBootOffBrowser(browser);
REPORT.info(`engine: ${engine}`);
REPORT.info(`base:   ${BASE}`);

const soft = (p) => p.catch(() => null);

/** domcontentloaded + the shell selector — never networkidle (see header). */
async function open(page, route) {
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
  await soft(page.waitForSelector('.art-stage', { timeout: 20000 }));
}

const dialog = (page) => page.locator('[role="dialog"]');
const waitDialogVisible = (page) => soft(dialog(page).first().waitFor({ state: 'visible', timeout: 8000 }));
const waitDialogHidden = (page) => soft(dialog(page).waitFor({ state: 'hidden', timeout: 8000 }));

// ═════════════════════════════════════════════════════════════════════════
// §0 · offline breakdown — replicated from CommandPalette.tsx's own
//      buildNavDestinations(), NOT scraped from the DOM (the palette caps
//      rendered rows at 40 with a query / 12 empty, so no DOM state ever
//      shows all of them at once — see §12 for how the two are cross-checked
//      without the DOM needing to render all 70+ rows simultaneously).
// ═════════════════════════════════════════════════════════════════════════
REPORT.group('── §0 · offline destination breakdown (from nav/ia.ts) ─────────');

// Mirrors CommandPalette.tsx's `sectionRootPath` exactly — see that file's
// header for why this is NOT a bare `cols[0].items[0].p`: for the Live
// section specifically that would resolve to the SAME "Home" leaf this
// gate's Home row already covers (confirmed against the real running app —
// clicking "Live" in the actual top nav lands on "/", a pre-existing defect
// in layout/NavTop.tsx's onItemClick / nav/ia.ts's data shape, outside this
// gate's and CommandPalette.tsx's owned files). Walking to the first
// non-Home leaf is a no-op for the other five sections.
function sectionRootPath(section) {
  for (const col of section.cols) {
    for (const item of col.items) {
      if (item.p !== R.HOME) return item.p;
    }
  }
  return section.path;
}

function buildNavDestinations() {
  const rows = [{ l: 'Home', p: R.HOME, sec: 'Home', kind: 'home' }];
  for (const section of IA) {
    rows.push({ l: section.label, p: sectionRootPath(section), sec: section.label, kind: 'section' });
    for (const col of section.cols) {
      for (const item of col.items) {
        if (item.p === R.HOME) continue; // Home has its own row above — see file header
        rows.push({ l: item.l, p: item.p, sec: `${section.label} · ${col.h}`, kind: 'leaf' });
      }
    }
  }
  return rows;
}
const NAV_DESTINATIONS = buildNavDestinations();
const SECTION_COUNT = NAV_DESTINATIONS.filter((d) => d.kind === 'section').length;
const LEAF_COUNT = NAV_DESTINATIONS.filter((d) => d.kind === 'leaf').length;
const HOME_COUNT = NAV_DESTINATIONS.filter((d) => d.kind === 'home').length;
// 3 themes (classic/indigo/phosphor) + 3 ambient levels (calm/busy/chaotic)
// + 1 copy-link — CommandPalette.tsx's THEME_ACTIONS/AMBIENT_ACTIONS arrays
// plus the one hand-written copy-link row. Not derived (nothing offline
// enumerates "actions"); §12 is what proves this matches the shipped build.
const ACTION_COUNT = 3 + 3 + 1;
const TOTAL = SECTION_COUNT + LEAF_COUNT + HOME_COUNT + ACTION_COUNT;

REPORT.info(`sections ${SECTION_COUNT} · leaves ${LEAF_COUNT} · home ${HOME_COUNT} · actions ${ACTION_COUNT} = ${TOTAL}`);
REPORT.ok(TOTAL >= 70, `TOTAL ${TOTAL} >= 70 destinations reachable by typing`);

// ═════════════════════════════════════════════════════════════════════════
// §1 · ⌘K opens and toggles
// ═════════════════════════════════════════════════════════════════════════
REPORT.group('── §1 · ⌘K opens and toggles ────────────────────────────────────');
{
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await open(page, '/');

  await page.click('.nav-kbd');
  await waitDialogVisible(page);
  REPORT.ok((await dialog(page).count()) === 1, 'clicking the .nav-kbd trigger opens exactly one dialog');
  const focusedInput = await page.evaluate(() => document.activeElement?.tagName === 'INPUT');
  REPORT.ok(focusedInput === true, 'opening focuses the search input');

  await page.keyboard.press('Control+k');
  await waitDialogHidden(page);
  REPORT.ok((await dialog(page).count()) === 0, 'Ctrl+K toggles an OPEN palette CLOSED');

  await page.keyboard.press('Control+k');
  await waitDialogVisible(page);
  REPORT.ok((await dialog(page).count()) === 1, 'Ctrl+K toggles a CLOSED palette OPEN');

  await page.keyboard.press('Control+Shift+K'); // uppercase K, via Shift
  await waitDialogHidden(page);
  REPORT.ok((await dialog(page).count()) === 0, 'the toggle is case-insensitive (Ctrl+Shift+K closes it too)');

  await page.context().close();
}

// ═════════════════════════════════════════════════════════════════════════
// §2 · Esc closes
// ═════════════════════════════════════════════════════════════════════════
REPORT.group('── §2 · Esc closes ───────────────────────────────────────────────');
{
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await open(page, '/');
  await page.click('.nav-kbd');
  await waitDialogVisible(page);
  await page.keyboard.press('Escape');
  await waitDialogHidden(page);
  REPORT.ok((await dialog(page).count()) === 0, 'Escape closes the palette');
  const returned = await page.evaluate(() => document.activeElement?.className?.includes('nav-kbd'));
  REPORT.ok(returned === true, 'focus returns to the .nav-kbd trigger on close (V6Modal focus restore)');
  await page.context().close();
}

// ═════════════════════════════════════════════════════════════════════════
// §3 · arrows clamp (no wraparound)
// ═════════════════════════════════════════════════════════════════════════
REPORT.group('── §3 · arrows clamp (no wraparound) ─────────────────────────────');
{
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await open(page, '/');
  await page.click('.nav-kbd');
  await waitDialogVisible(page);

  const count = Number(await page.getAttribute('.cmdk-list', 'data-cmdk-result-count'));
  REPORT.ok(count > 1, `the default (empty-query) list renders more than one row (got ${count})`);

  for (let i = 0; i < count + 5; i++) await page.keyboard.press('ArrowDown');
  const atLast = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.cmdk-row')];
    return document.activeElement === rows[rows.length - 1];
  });
  REPORT.ok(atLast === true, `${count + 5} ArrowDown presses clamp at the LAST row, no wraparound to the first`);

  for (let i = 0; i < count + 5; i++) await page.keyboard.press('ArrowUp');
  const atFirst = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.cmdk-row')];
    return document.activeElement === rows[0];
  });
  REPORT.ok(atFirst === true, `${count + 5} ArrowUp presses clamp at the FIRST row, no wraparound to the last`);

  await page.context().close();
}

// ═════════════════════════════════════════════════════════════════════════
// §4 · Enter navigates the selection
// ═════════════════════════════════════════════════════════════════════════
REPORT.group('── §4 · Enter navigates the selection ────────────────────────────');
{
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await open(page, '/');
  await page.click('.nav-kbd');
  await waitDialogVisible(page);
  await page.keyboard.type('thesis'); // unique word-start hit — see file header's ranking note
  await soft(page.waitForFunction(
    () => document.querySelector('.cmdk-list')?.getAttribute('data-cmdk-result-count') !== '0',
    null, { timeout: 5000 },
  ));
  await page.keyboard.press('Enter');
  await soft(page.waitForFunction(() => location.pathname === '/live/markets/thesis', null, { timeout: 10000 }));
  const url = await page.evaluate(() => location.pathname);
  REPORT.ok(url === '/live/markets/thesis', `Enter (sel=0, no arrow keys) navigates to the top result (got ${url})`);
  await waitDialogHidden(page);
  REPORT.ok((await dialog(page).count()) === 0, 'the palette closes after Enter navigates');
  await page.context().close();
}

// ═════════════════════════════════════════════════════════════════════════
// §5 · "sim" ranks Simulators above Sediment (the word-start prefix bonus)
// ═════════════════════════════════════════════════════════════════════════
REPORT.group('── §5 · "sim" ranks Simulators above Sediment ────────────────────');
{
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await open(page, '/');
  await page.click('.nav-kbd');
  await waitDialogVisible(page);
  await page.keyboard.type('sim');
  await soft(page.waitForFunction(
    () => document.querySelector('.cmdk-list')?.getAttribute('data-cmdk-result-count') !== '0',
    null, { timeout: 5000 },
  ));

  const labels = await page.$$eval('.cmdk-row .cmdk-lb', (els) => els.map((el) => el.textContent?.trim() ?? ''));
  const simIdx = labels.indexOf('Simulators');
  const sedIdx = labels.indexOf('Sediment');
  REPORT.info(`ranked labels for "sim": ${labels.join(' | ')}`);
  REPORT.ok(simIdx !== -1, `"Simulators" appears in the results for "sim" (index ${simIdx})`);
  REPORT.ok(sedIdx !== -1, `"Sediment" appears in the results for "sim" (index ${sedIdx})`);
  REPORT.ok(simIdx !== -1 && sedIdx !== -1 && simIdx < sedIdx,
    `Simulators (index ${simIdx}) ranks ABOVE Sediment (index ${sedIdx})`);

  await page.context().close();
}

// ═════════════════════════════════════════════════════════════════════════
// §6 · keyboard-only reachable end to end (open · type · arrow · Enter)
// ═════════════════════════════════════════════════════════════════════════
REPORT.group('── §6 · keyboard-only reachable end to end ───────────────────────');
{
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await open(page, '/');

  // Open — keyboard, not a click.
  await page.keyboard.press('Control+k');
  await waitDialogVisible(page);
  REPORT.ok((await dialog(page).count()) === 1, 'Control+K opens the palette with no mouse involved');

  await page.keyboard.type('mempool'); // several results — proves arrow selection actually moves it
  await soft(page.waitForFunction(
    () => Number(document.querySelector('.cmdk-list')?.getAttribute('data-cmdk-result-count') || 0) > 1,
    null, { timeout: 5000 },
  ));
  const before = await page.$$eval('.cmdk-row', (els) => els.map((el) => el.getAttribute('data-cmdk-path')));
  REPORT.ok(before.length > 1, `"mempool" returns more than one result (got ${before.length})`);

  await page.keyboard.press('ArrowDown'); // input -> first result
  await page.keyboard.press('ArrowDown'); // first -> second result
  const selectedPath = await page.evaluate(() => document.activeElement?.getAttribute('data-cmdk-path'));
  REPORT.ok(selectedPath === before[1], `two ArrowDown presses select the SECOND result (${before[1]}), not the first`);

  await page.keyboard.press('Enter');
  await soft(page.waitForFunction((p) => location.pathname + location.search === p, before[1], { timeout: 10000 }));
  const landed = await page.evaluate(() => location.pathname + location.search);
  REPORT.ok(landed === before[1], `Enter on the arrow-selected row navigates there (expected ${before[1]}, got ${landed})`);
  await waitDialogHidden(page);

  const focusedMain = await page.evaluate(() => document.activeElement?.id === 'main');
  REPORT.ok(focusedMain === true, 'post-navigation focus lands on #main — the app\'s normal nav convention, unchanged by the palette');

  await page.context().close();
}

// ═════════════════════════════════════════════════════════════════════════
// §7 · does not stack on an open dialog, does not hijack another text field
// ═════════════════════════════════════════════════════════════════════════
REPORT.group('── §7 · dialog-stack and typing-field guards ─────────────────────');
{
  // 7a — an unrelated dialog is already open (TrustedPeersPage's "our
  // brief" popup, built on the same V6Modal) — Ctrl+K must not stack a
  // second [role="dialog"] on top of it.
  {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    await open(page, R.ABOUT_PEERS);
    await soft(page.waitForSelector('#page-title', { timeout: 15000 }));
    await soft(page.locator('button', { hasText: 'our brief' }).first().click());
    await waitDialogVisible(page);
    const before = await dialog(page).count();
    REPORT.ok(before === 1, 'a partner "our brief" dialog is open before the ⌘K attempt');

    await page.keyboard.press('Control+k');
    await page.waitForTimeout(SETTLE);
    const after = await dialog(page).count();
    REPORT.ok(after === 1, `Ctrl+K does not stack a second dialog on an already-open one (still ${after})`);
    await page.context().close();
  }

  // 7b — focus is in some OTHER text field: ⌘K must not hijack it while the
  // palette is closed, but MUST still work once it is the palette's own
  // input that has focus (tested implicitly by every other section above,
  // all of which toggle-close from inside that same input).
  {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    await open(page, '/');
    await page.evaluate(() => {
      const probe = document.createElement('input');
      probe.id = 'xmri-verify-probe-input';
      document.body.appendChild(probe);
      probe.focus();
    });
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(SETTLE);
    REPORT.ok((await dialog(page).count()) === 0, 'Ctrl+K does not open the palette while another text field has focus');

    await page.evaluate(() => document.getElementById('xmri-verify-probe-input')?.remove());
    await page.keyboard.press('Control+k');
    await waitDialogVisible(page);
    REPORT.ok((await dialog(page).count()) === 1, 'Ctrl+K opens normally once that field is gone');
    await page.context().close();
  }
}

// ═════════════════════════════════════════════════════════════════════════
// §8 · the palette chunk is lazy — not requested before the first ⌘K
// ═════════════════════════════════════════════════════════════════════════
REPORT.group('── §8 · CommandPalette.tsx is React.lazy, not eager ──────────────');
{
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const requested = [];
  page.on('request', (r) => requested.push(r.url()));
  await open(page, '/');
  await page.waitForTimeout(SETTLE);
  const eagerHit = requested.some((u) => /CommandPalette-/.test(u));
  REPORT.ok(eagerHit === false, 'no CommandPalette-*.js request before any ⌘K press');

  await page.click('.nav-kbd');
  await waitDialogVisible(page);
  const lazyHit = requested.some((u) => /CommandPalette-/.test(u));
  REPORT.ok(lazyHit === true, 'a CommandPalette-*.js request fires once the palette is actually opened');
  await page.context().close();
}

// ═════════════════════════════════════════════════════════════════════════
// §9 · zero [role="dialog"] on a page where nothing was opened
// ═════════════════════════════════════════════════════════════════════════
REPORT.group('── §9 · zero [role="dialog"] before opening ───────────────────────');
{
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await open(page, '/live/mempool');
  await soft(page.waitForSelector('#page-title', { timeout: 15000 }));
  await page.waitForTimeout(SETTLE);
  REPORT.ok((await dialog(page).count()) === 0, 'a fresh, never-opened-palette page carries zero [role="dialog"]');
  await page.context().close();
}

// ═════════════════════════════════════════════════════════════════════════
// §10 · reduced-motion path works
// ═════════════════════════════════════════════════════════════════════════
REPORT.group('── §10 · reduced-motion path ───────────────────────────────────────');
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await open(page, '/');
  await page.click('.nav-kbd');
  await waitDialogVisible(page);
  REPORT.ok((await dialog(page).count()) === 1, 'the palette still opens under prefers-reduced-motion: reduce');
  await page.keyboard.type('sources');
  await soft(page.waitForFunction(
    () => document.querySelector('.cmdk-list')?.getAttribute('data-cmdk-result-count') !== '0',
    null, { timeout: 5000 },
  ));
  const rowCount = await page.locator('.cmdk-row').count();
  REPORT.ok(rowCount > 0, `results still render under reduce (${rowCount} rows) — content, not just animation, is intact`);
  await page.keyboard.press('Escape');
  await waitDialogHidden(page);
  REPORT.ok((await dialog(page).count()) === 0, 'Escape still closes it under reduce');
  await ctx.close();
}

// ═════════════════════════════════════════════════════════════════════════
// §11 · every destination resolves — no 404, no NotFoundPage
// ═════════════════════════════════════════════════════════════════════════
REPORT.group(`── §11 · every one of ${NAV_DESTINATIONS.length} navigable destinations resolves ──`);
{
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  let bad = 0;
  /* PROVE THE DISCRIMINATOR FIRST. This sweep's whole claim is "none of these
   * 70 destinations is the 404 page", so if the 404 test stops recognising a
   * 404 the sweep passes unconditionally and says the opposite of nothing.
   * It used to test `/This page is not in the mempool\./` against body text —
   * one copy string, with `hasHeading` contributing nothing beside it because
   * NotFoundPage carries #page-title too. Rewording that headline would have
   * silently made every destination "resolve". Now the marker is structural
   * (`data-route-404` on NotFoundPage's wrapper) and this probe fails loudly
   * if it ever stops being present. */
  await page.goto(BASE + '/definitely-not-a-route-a9f3', { waitUntil: 'domcontentloaded' });
  await soft(page.waitForSelector('#page-title', { timeout: 8000 }));
  const detectorWorks = await page.evaluate(() => !!document.querySelector('[data-route-404]'));
  REPORT.ok(detectorWorks,
    'the 404 detector actually detects a 404 (data-route-404 present on an unknown route)',
    'without this the "all destinations resolve" sweep below cannot fail');

  const seen = new Set();
  for (const dest of NAV_DESTINATIONS) {
    if (seen.has(dest.p)) continue; // several rows can share a base path via a query string
    seen.add(dest.p);
    await page.goto(BASE + dest.p, { waitUntil: 'domcontentloaded' });
    await soft(page.waitForSelector('#page-title', { timeout: 8000 }));
    const { is404, hasHeading } = await page.evaluate(() => ({
      is404: !!document.querySelector('[data-route-404]'),
      hasHeading: document.querySelectorAll('#page-title').length > 0,
    }));
    if (is404 || !hasHeading) {
      bad++;
      REPORT.ok(false, `${dest.l} (${dest.p}) resolves`, `404=${is404} hasHeading=${hasHeading}`);
    }
  }
  REPORT.ok(bad === 0, `all ${seen.size} distinct destination paths resolve (no 404, no NotFoundPage)`);
  await page.context().close();
}

// ═════════════════════════════════════════════════════════════════════════
// §12 · the shipped component's own breakdown matches this gate's §0
// ═════════════════════════════════════════════════════════════════════════
REPORT.group('── §12 · shipped data-cmdk-* breakdown matches §0\'s offline count ──');
{
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await open(page, '/');
  await page.click('.nav-kbd');
  await waitDialogVisible(page);

  const shipped = await page.evaluate(() => {
    const el = document.querySelector('.cmdk-pal');
    if (!el) return null;
    return {
      total: Number(el.getAttribute('data-cmdk-total')),
      sections: Number(el.getAttribute('data-cmdk-sections')),
      leaves: Number(el.getAttribute('data-cmdk-leaves')),
      home: Number(el.getAttribute('data-cmdk-home')),
      actions: Number(el.getAttribute('data-cmdk-actions')),
    };
  });
  REPORT.ok(shipped !== null, '.cmdk-pal renders its data-cmdk-* breakdown attributes');
  if (shipped) {
    REPORT.info(`shipped: sections ${shipped.sections} · leaves ${shipped.leaves} · home ${shipped.home} · actions ${shipped.actions} = ${shipped.total}`);
    REPORT.ok(shipped.sections === SECTION_COUNT, `sections match (${shipped.sections} === ${SECTION_COUNT})`);
    REPORT.ok(shipped.leaves === LEAF_COUNT, `leaves match (${shipped.leaves} === ${LEAF_COUNT})`);
    REPORT.ok(shipped.home === HOME_COUNT, `home matches (${shipped.home} === ${HOME_COUNT})`);
    REPORT.ok(shipped.actions === ACTION_COUNT, `actions match (${shipped.actions} === ${ACTION_COUNT})`);
    REPORT.ok(shipped.total === TOTAL, `total matches (${shipped.total} === ${TOTAL})`);
  }
  await page.context().close();
}

await browser.close();
process.exit(REPORT.finish());
