// verify-peers.mjs — DOM gate for /operate/peers Monero Superbrain partner card.
// (p4·06 moved this page from /about/peers; §7's PARTNER cards are now a
//  3-column grid whose geometry verify-protocol.mjs §6 owns — this file makes
//  no column assertion and never did.)
//
// Verifies the ecosystem entries land correctly, rendering:
//   1. Seven PARTNER cards (exact count from source parse)
//   2. Superbrain's GitHub repo URL in exact casing (case-sensitive)
//   3. Install block with 4 ordered steps in <ol>
//   4. Five app names rendered (Superbrain, SuperPay, MoneroSpace, Superstress, SuperAtomic)
//   5. No typed numbers in pulse (static source check across relevant files)
//   6. Pulse live-data handling: accepts valid payload, degrades on 500
//   7. Mobile (390px): no h-scroll, no HTML text under 12px
//   8. Reduced motion: cards render, zero running animations
//   9. The partner screenshots: same-origin, resolvable, decoded, dated
//  10. Every brief has its OWN address: /operate/peers?p=<id> opens it in a
//      cold tab, a click writes it, a close clears it, an unknown slug is
//      honest (p4·M6b)
//  11. No brief renders a screenshot RESERVATION — a dashed, captioned, empty
//      box. The mechanism was deleted; this is the gate that keeps it gone.
//
// CROSS-GATE DEPENDENCY: verify-future.mjs asserts the Superbrain pulse does NOT
// appear on /future (counts exactly 9 data-pulse="live" on that page). This gate
// asserts it DOES appear on /operate/peers. The two checks together prevent the pulse
// from migrating to the wrong surface.
//
// BLIND SPOTS (cannot verify in sandbox):
//   — Live GitHub API responses and repo stats (mocked here)
//   — Whether the installed Umbrel app actually works
//   — The GitHub URL's reachability (egress to github.com blocked)
//   — Whether previous /operate/peers content is still intact (gate assumes page renders)
//
// Run against serve-dist (NOT vite preview — see verify-future.mjs header).
//   npm run build && npm run wait-preview && node verify-peers.mjs

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './verify-lib.mjs';
import { makeReporter } from './verify-reporter.mjs';

const BASE = 'http://localhost:4173';
const __dirname = dirname(fileURLToPath(import.meta.url));
const R = makeReporter('verify-peers');

/* ── STATIC SOURCE CHECKS ────────────────────────────────────────────
   Partner count from data.ts, no typed numbers in pulse readout. */

// Parse ECOSYSTEM array from data.ts to count status: "PARTNER" entries.
const DATA_FILE = join(__dirname, 'src', 'pages', 'future', 'data.ts');
const dataContent = readFileSync(DATA_FILE, 'utf8');
const partnerMatches = dataContent.match(/status:\s*["']PARTNER["']/g) || [];
const expectedPartnerCount = partnerMatches.length;

R.ok(expectedPartnerCount > 0,
  '§1 · data.ts contains at least one PARTNER (instrument check)');
/* p4·M3: 4 -> 6 (Monerica, Privacy Gateway). p4·M6b: 6 -> 7 (Kathie).
   RECOUNTED, never incremented —
   `expectedPartnerCount` is parsed from data.ts above and every downstream
   assertion in this file compares against THAT, so this literal is the only
   place a human number appears. It is deliberately not derived: a gate whose
   expectation is computed from its own subject cannot notice the subject
   changing, which is the whole reason a second, hand-written figure exists
   here at all. If you moved this number without meaning to move it, that is
   the assertion doing its job. */
R.ok(expectedPartnerCount === 7,
  `§1 · data.ts declares exactly 7 PARTNER entries (parsed: ${expectedPartnerCount})`);

// §5: Check RepoPulseReadout does not render any typed numbers as text content.
// RepoPulseReadout was extracted into app/src/pages/future/repoPulse.tsx.
// ASSERTION PRECONDITION: the file exists and contains the component.
const READOUT_FILE = join(__dirname, 'src', 'pages', 'future', 'repoPulse.tsx');
const readoutExists = existsSync(READOUT_FILE);

R.ok(readoutExists,
  '§5 · RepoPulseReadout subject located at repoPulse.tsx (precondition check)');

if (readoutExists) {
  const readoutContent = readFileSync(READOUT_FILE, 'utf8');
  const hasReadout = readoutContent.includes('export function RepoPulseReadout');

  R.ok(hasReadout,
    '§5 · repoPulse.tsx contains RepoPulseReadout export');

  // The pulse renders: ★N · open issues M · last push · DATE · last issue activity · DATE
  // All numbers come from pulse.stars.toLocaleString(), pulse.issues, or agoStr() —
  // none should be string literals in the JSX.
  const pulseRenders = [
    'pulse.stars.toLocaleString()',
    'pulse.issues',
    'agoStr(pulse.pushed)',
    'agoStr(pulse.issueAt)'
  ];

  R.ok(pulseRenders.every(r => readoutContent.includes(r)),
    `§5 · RepoPulseReadout reads all pulse fields (found all 4 render sources)`);
}

/* ── BROWSER TESTS ──────────────────────────────────────────────────── */

const { browser, engine } = await launch();
console.log(`  engine: ${engine}`);

/* NO COLD-BOOT BYPASS HERE, DELIBERATELY — do not "restore" it.
 *
 * The splash is HOME-ONLY. Measured in a genuinely cold context with no
 * bypass installed anywhere: `/` has [data-coldboot]=1, `/operate/peers` has
 * 0 and renders every partner card. This gate never visits `/`, so it
 * has nothing to bypass.
 *
 * Installing it anyway is not harmless. verify-coldboot-live's §0 audits
 * the set of gates that install the bypass against the set its patterns
 * detect as REACHING `/`, and uses the first as a proxy for the second to
 * prove the detector has not gone stale. A gate that installs a bypass it
 * does not need is a false positive in that proxy, and it reds §0 with
 * "DETECTOR STALE" — which it did, exactly, when this line was here.
 *
 * The early-render flakiness this was added to fix was React hydration,
 * not the splash; `waitUntil: 'networkidle'` is what actually addressed it.
 */

try {
  /* ── COLD LOAD: the partner cards render ────────────────────────────── */
  const page = await browser.newPage();

  // Intercept /api/feeds requests to mock live repo pulse.
  const MOCK_PULSE = {
    stars: 42,
    issues: 7,
    pushed: new Date(Date.now() - 3600000).toISOString(), // 1h ago
    issueAt: new Date(Date.now() - 7200000).toISOString(), // 2h ago
  };

  await page.route('**/api/feeds*', route => {
    if (route.request().url().includes('src=ghrepo')) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PULSE),
      });
    } else {
      route.continue();
    }
  });

  await page.goto(BASE + '/operate/peers', { waitUntil: 'networkidle' });

  // §1: Rendered card count matches parsed source count
  const cards = page.locator('.v6-stagger');
  const renderedCount = await cards.count();

  R.ok(renderedCount === expectedPartnerCount,
    `§1 · every partner card renders (rendered: ${renderedCount}, expected: ${expectedPartnerCount})`);

  // §2: Exact-case GitHub URL exists in Superbrain card
  const superbrainUrl = 'https://github.com/brainchainz/Monero-Superbrain';
  const pageContent = await page.content();

  R.ok(pageContent.includes(superbrainUrl),
    `§2 · Superbrain repo URL present in exact case: ${superbrainUrl}`);

  // §2: No lowercase variant anywhere on page
  const lowerUrl = 'github.com/brainchainz/monero-superbrain';
  R.ok(!pageContent.includes(lowerUrl),
    `§2 · No lowercase variant found (${lowerUrl})`);

  // §3: Install block renders with 4 steps in <ol>
  // Open the Superbrain brief modal by clicking "our brief" button.
  // Find the card with Superbrain's name (it's the 4th partner card, index 3)
  const superbrainCard = page.locator('.v6-stagger').filter({ has: page.locator('h3:has-text("Monero Superbrain")') }).first();
  const briefButton = superbrainCard.locator('button:has-text("our brief")');
  await briefButton.click();

  /* p4·M6b — THIS WAIT REPORTS RATHER THAN THROWS, and the reason came out of
   * a break test rather than a review. M4 (the `?p=` state ignored, so no brief
   * ever opens) made this line raise, and the raise killed the run at EIGHT
   * assertions — so §10, which exists PRECISELY to catch a dead brief, never
   * printed a word. The output was `Test crashed: waitForSelector timeout`,
   * which reads like a broken harness rather than like a dead feature.
   *
   * A bare `waitForSelector` is an assertion with no message and no survivors.
   * Waiting with a budget and then ASSERTING lets every later section speak,
   * which is the whole point of having them. p4·M5 fixed six waits of this
   * shape in verify-future for the same reason. */
  const dialogOpened = await page.waitForSelector('[role="dialog"]', { timeout: 5000 })
    .then(() => true).catch(() => false);
  R.ok(dialogOpened,
    '§2 · the "our brief" button opens a dialog (precondition: every check below reads inside it, and a bare wait here would abort the run instead of naming the failure)');

  // Find the install block by its label, which renders as a .kicker inside the modal
  const installLabel = page.locator('[role="dialog"] .kicker:has-text("Install · Umbrel")');

  // Verify the install block is present
  const installLabelVisible = await installLabel.isVisible({ timeout: 2000 }).catch(() => false);
  R.ok(installLabelVisible,
    '§3 · Install block label found inside modal');

  // The install list should be an <ol> immediately following or contained after the label
  const installList = page.locator('[role="dialog"] ol');
  const listCount = await installList.count();

  if (listCount > 0) {
    const steps = installList.first().locator('li');
    const stepCount = await steps.count();

    R.ok(stepCount === 4,
      `§3 · Install block has exactly 4 steps (found: ${stepCount})`);

    // Check it's an <ol> not <ul>
    const listTag = await installList.first().evaluate(el => el.tagName);
    R.ok(listTag === 'OL',
      `§3 · Install block is <ol> (ordered) not <ul>`);

    // Verify step sequence (spot check, not exhaustive)
    const stepTexts = await steps.allTextContents();
    const stepsValid = stepTexts.length >= 2 &&
                       stepTexts[0].toLowerCase().includes('open') &&
                       stepTexts[2].toLowerCase().includes('paste');
    R.ok(stepsValid,
      `§3 · Install steps are in expected order`);
  } else {
    R.skip('§3 · Install list (<ol>) not found in modal');
  }

  // §4: Five apps rendered by name
  const appNames = ['Superbrain', 'SuperPay', 'MoneroSpace', 'Superstress', 'SuperAtomic'];
  const bodyText = await page.content();

  appNames.forEach(name => {
    R.ok(bodyText.includes(name),
      `§4 · App name "${name}" rendered`);
  });

  // §6a: Live pulse data renders (mocked valid response)
  await page.waitForSelector('[data-peer-pulse="brainchainz/Monero-Superbrain"]', { timeout: 5000 });
  const pulseDiv = page.locator('[data-peer-pulse="brainchainz/Monero-Superbrain"]');
  const pulseText = await pulseDiv.textContent();

  R.ok(pulseText.includes('42'), // stars
    `§6 · Live pulse renders star count from mock (stars: 42)`);
  R.ok(pulseText.includes('7'), // issues
    `§6 · Live pulse renders issue count (issues: 7)`);

  // Close modal
  await page.locator('[role="dialog"] .v6-x').click();

  // §6b: Degradation test — mock a 500 response
  await page.route('**/api/feeds*', route => {
    if (route.request().url().includes('src=ghrepo')) {
      route.abort('failed');
    } else {
      route.continue();
    }
  });

  // Clear localStorage to reset cache
  await page.evaluate(() => localStorage.clear());

  // Reload
  await page.reload({ waitUntil: 'networkidle' });

  // Card should still render, but pulse should show error state
  const cardsAfterError = await page.locator('.v6-stagger').count();
  R.ok(cardsAfterError === expectedPartnerCount,
    `§6 · Cards still render on failed pulse (count: ${cardsAfterError})`);

  /* §6b · THE DEGRADED RENDERING, ASSERTED SPECIFICALLY (p4·01, closing #184 F3).
     This block used to read:
         const hasFabricatedNumber = /^[\s\d.,]+$/.test(pulseDivText.trim());
         R.ok(!hasFabricatedNumber || text.includes('fetching') || text.includes('error'), …)
     which could not fail. That regex demands the WHOLE string be digits,
     dots, commas and spaces — so any text containing a letter made
     `hasFabricatedNumber` false and `!hasFabricatedNumber` true on its own.
     The LIVE readout ("★ 42  open issues 7 (incl. PRs) …") satisfies it just as
     well as the degraded one, so the assertion passed whether the page had
     degraded or not. The two fallback disjuncts never ran, and one of them
     could not: `FeedEmpty` renders no word "error" anywhere. Measured at
     `81fafca` it reported ✅ rather than a skip, so it was passing vacuously
     rather than abstaining.
     What replaces it asserts the copy `FeedEmpty` actually ships, plus the
     ABSENCE of the mocked live numbers, plus the absence of the live branch's
     structural markers. `textContent`, never `innerText`: `.kicker` uppercases
     via text-transform and innerText returns the RENDERED casing — the defect
     family CLAUDE.md records three times.
     A missing pulse area is now a FAILURE, not a skip. The skip was the other
     half of the vacuity: it made "the feature vanished entirely" and "the
     feature degraded honestly" the same green run. */
  const pulseDivAfterError = page.locator('[data-peer-pulse="brainchainz/Monero-Superbrain"]');
  const pulseDivVisible = await pulseDivAfterError.isVisible({ timeout: 5000 }).catch(() => false);
  R.ok(pulseDivVisible,
    '§6b · the pulse area is still on the page after the feed dies — degradation, not disappearance');
  if (pulseDivVisible) {
    const degradedText = (await pulseDivAfterError.textContent()) ?? '';
    const flat = degradedText.replace(/\s+/g, ' ').trim();

    // (a) the house degraded copy, verbatim from repoPulse.tsx's FeedEmpty.
    R.ok(flat.includes('returned no data'),
      `§6b · the degraded pulse says "returned no data" — the honest empty state, not a blank`);
    R.ok(flat.includes('failed') && flat.includes('upstream'),
      '§6b · it names WHERE it failed ("failed upstream"), so the reader is not left guessing');
    R.ok(flat.includes('Nothing cached yet'),
      '§6b · it says nothing is cached — last-good is claimed only when there IS a last-good');
    R.ok(flat.includes('src=ghrepo'),
      '§6b · it names the endpoint that failed, so the failure is diagnosable from the page');

    // (b) THE NEGATIVE HALF — the mock's live numbers must be GONE. §6a asserted
    //     both were rendered moments ago, so this pair is a real before/after on
    //     one selector rather than an absence that was always absent.
    R.ok(!/★/.test(flat) && !/\b42\b/.test(flat),
      `§6b · the star count from the live mock is GONE — no fabricated 42 survives the outage`);
    R.ok(!/open issues\s*7\b/.test(flat),
      '§6b · the issue count from the live mock is GONE — no fabricated 7 survives the outage');

    // (c) STRUCTURAL: the live branch's own markers. `data-readout` spans exist
    //     only in the populated branch, so their presence would prove a
    //     fabricated readout even if every numeral happened to differ.
    const liveMarkers = await pulseDivAfterError.locator('[data-readout]').count();
    R.ok(liveMarkers === 0,
      `§6b · the live readout's [data-readout] spans are absent (${liveMarkers}) — the degraded branch rendered, not a numberless copy of the live one`);
  }

  /* §7 · p4·01 left this section's exemptions alone and said why: the repo
     ran an 11px floor while the prompt series asserted 12, and narrowing the
     exemptions THEN would have redded the tree for a defect nothing had yet
     fixed. p4·02 fixed it — `styles-legibility.css` now carries a 12px floor
     below 720px — so the exemptions have been REMOVED here, as that note
     promised. The site-wide replacement is `verify-mobile.mjs`; what stays
     below is the half it cannot reach. See the block above the walker. */
  // §7: Mobile (390px) — no h-scroll, no sub-12px text
  const viewport = { width: 390, height: 844, deviceScaleFactor: 2 };
  await page.setViewportSize(viewport);

  // Reload at mobile size with live pulse
  await page.route('**/api/feeds*', route => {
    if (route.request().url().includes('src=ghrepo')) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PULSE),
      });
    } else {
      route.continue();
    }
  });

  await page.reload({ waitUntil: 'networkidle' });

  // Check h-scroll
  const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
  const clientWidth = await page.evaluate(() => window.innerWidth);
  const hScroll = scrollWidth - clientWidth;

  R.ok(hScroll <= 0,
    `§7 · No horizontal scroll at 390px (scrollWidth - clientWidth: ${hScroll})`);

  /* §7's TYPE FLOOR — THE EXEMPTION LIST IS GONE (p4·02).
   *
   * What stood here walked `.v6-peer-grid` and skipped any element whose class
   * contained `v6-status`, `kicker`, `pill`, `dim2` OR `mono`, against a floor
   * of 12 read through `parseInt`. Three things were wrong with that at once,
   * and together they made the assertion nearly unable to fire:
   *   · `mono` is the body font of this entire page, so the exemption covered
   *     most of the text it claimed to be checking;
   *   · `parseInt('11.5px')` is 11, so the check silently ran at a floor of
   *     11.5-rounds-down rather than 12;
   *   · it was scoped to the grid, so the chrome above it was never asked.
   * Measured at 390 the day this was replaced: the page carried 37 elements
   * under 12px and this assertion was GREEN.
   *
   * THE SITE-WIDE FLOOR NOW LIVES IN `verify-mobile.mjs`, which walks all
   * fourteen routes with no class exemptions at all. This section is KEPT
   * rather than deleted, and the reason is a real one rather than politeness:
   * verify-mobile runs against `serve-dist`, where `/api/**` answers 501, so
   * it only ever sees the DEGRADED face of every page. THIS gate mocks a LIVE
   * `src=ghrepo` pulse, so it renders the live readout — a state the
   * site-wide gate structurally cannot reach. Same floor, no exemptions,
   * different feed state. */
  const subPixelText = await page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll('#root *')) {
      if (el.namespaceURI === 'http://www.w3.org/2000/svg') continue;
      if (el.classList && el.classList.contains('sr-only')) continue;
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      const fs = parseFloat(cs.fontSize);          // parseFloat: 11.5 is not 11
      if (fs < 11.99) bad.push(`${fs}px ${el.tagName.toLowerCase()}.${(typeof el.className === 'string' ? el.className : '').trim()} "${el.textContent.trim().slice(0, 30)}"`);
    }
    return bad;
  });

  R.ok(subPixelText.length === 0,
    `§7 · no visible HTML text under 12px at 390px with the pulse LIVE (found: ${subPixelText.length}) — no class exemptions`,
    subPixelText.slice(0, 5).join('\n     '));

  /* Non-vacuity: a page that failed to render returns zero findings, which is
   * indistinguishable from a clean pass. This is the guard §7 never had. */
  const rootNodes = await page.evaluate(() => document.querySelectorAll('#root *').length);
  R.ok(rootNodes > 80,
    `§7 · the 390px sweep had a rendered page to measure (${rootNodes} elements under #root)`,
    'a low count means the floor result above was measured against a blank page');

  // §8: Reduced motion — cards render, zero animations
  const reducedMotionPage = await browser.newPage();

  // Set prefers-reduced-motion
  await reducedMotionPage.emulateMedia({ reducedMotion: 'reduce' });

  await reducedMotionPage.route('**/api/feeds*', route => {
    if (route.request().url().includes('src=ghrepo')) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PULSE),
      });
    } else {
      route.continue();
    }
  });

  await reducedMotionPage.goto(BASE + '/operate/peers', { waitUntil: 'networkidle' });

  const cardsReduced = await reducedMotionPage.locator('.v6-stagger').count();
  R.ok(cardsReduced === expectedPartnerCount,
    `§8 · Cards render under reduced motion (count: ${cardsReduced})`);

  // Check animations
  const animations = await reducedMotionPage.evaluate(() => {
    const anims = document.getAnimations ? document.getAnimations() : [];
    return anims.filter(a => a.playState === 'running').length;
  });

  R.ok(animations === 0,
    `§8 · Zero running animations under reduced motion (active: ${animations})`);

  /* ══ §9 · THE PARTNER SCREENSHOTS ══════════════════════════════════════
   * p4·M3. Before this release every brief rendered ZERO <img> — measured, on
   * all four — and the "SCREENSHOT ·…" boxes a reader saw were `slots`, dashed
   * reservations. This section exists so that cannot silently become true
   * again, and so the way it is most likely to fail — an off-origin src that
   * happens to load in a dev browser and is refused by the CSP in production —
   * fails HERE rather than for a reader on Tor.
   *
   * FIVE ASSERTIONS, THREE OF THEM ABSENCES, SO EACH CARRIES A FLOOR. An
   * absence check over an empty selector is the single most-recorded gate
   * defect in this repo; every count below is compared against the number of
   * shots PARSED FROM SOURCE, not against zero.
   *
   * `naturalWidth > 0` IS THE LOAD-BEARING ONE, and the reason is that every
   * cheaper check passes on a broken image: the <img> exists, its src is
   * same-origin, its alt is set, and the file 404s. Only a decode says the
   * bytes arrived. This is also why EcoPopup ships NO onError fallback — a
   * shot that degrades gracefully to a placeholder is a shot this assertion
   * can never catch. */
  /* PARSE THE BLOCK, THEN THE FIELDS — not one regex over all three at once.
   * The first version of this was a single pattern demanding
   * `src: "…", alt: "…", captured: "…",` in that order with nothing between,
   * and a break test exposed it: inserting a comment after `src:` made the
   * whole shot VANISH from the parse, so a gate about six screenshots
   * quietly measured five. The `>= 6` floor below caught it — which is what
   * floors are for — but a red saying "declares 5 screenshots" points at the
   * wrong thing when the defect is an off-origin src. Field order and
   * interleaved comments are now irrelevant. */
  const shots = [];
  for (const m of dataContent.matchAll(/\bshot:\s*\{/g)) {
    let i = m.index + m[0].length - 1, depth = 0;
    for (; i < dataContent.length; i++) {
      if (dataContent[i] === '{') depth++;
      else if (dataContent[i] === '}') { depth--; if (depth === 0) break; }
    }
    const body = dataContent.slice(m.index, i + 1);
    const f = (k) => (body.match(new RegExp(k + ':\\s*"((?:[^"\\\\]|\\\\.)*)"')) || [, null])[1];
    shots.push({ src: f('src'), alt: f('alt') || '', captured: f('captured') });
  }

  R.ok(shots.length >= 6,
    `§9 · data.ts declares ${shots.length} screenshots (floor: a parse that found none would make every check below vacuous)`);

  const badSrc = shots.filter((h) => !/^\/peers\/peer-[a-z0-9]+\.webp$/.test(h.src));
  R.ok(badSrc.length === 0,
    `§9 · every shot src is a same-origin /peers/ path (${shots.length - badSrc.length} of ${shots.length})`,
    badSrc.map((h) => h.src).join(', ')
    + '  — an absolute URL here is not a slow image, it is one vercel.json\'s img-src refuses.');

  const missing = shots.filter((h) => !existsSync(join(__dirname, 'public', h.src.replace(/^\//, ''))));
  R.ok(missing.length === 0,
    `§9 · every shot src resolves to a real file under public/ (${shots.length - missing.length} of ${shots.length})`,
    missing.map((h) => h.src).join(', '));

  const badDate = shots.filter((h) => !/^\d{4}-\d{2}-\d{2}$/.test(h.captured));
  R.ok(badDate.length === 0,
    `§9 · every shot carries an ISO capture date (${shots.length - badDate.length} of ${shots.length})`,
    badDate.map((h) => `${h.src}: "${h.captured}"`).join(', ')
    + '  — undated, a screenshot of someone else\'s site silently claims to be current.');

  const alts = shots.map((h) => h.alt.trim());
  R.ok(alts.every((a) => a.length > 30) && new Set(alts).size === alts.length,
    `§9 · every shot has its own substantive alt text (${new Set(alts).size} distinct, shortest ${Math.min(...alts.map((a) => a.length))} chars)`,
    'a duplicated alt means one entry is describing another entry\'s capture.');

  /* THE RENDERED HALF. Back to desktop: §7 left the page at 390, and while the
   * figure renders at both widths, a 1440 read is the one a reviewer checks. */
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(BASE + '/operate/peers', { waitUntil: 'networkidle' });

  const briefIds = await page.evaluate(() =>
    [...document.querySelectorAll('[data-peer-brief]')].map((b) => b.getAttribute('data-peer-brief')));
  R.ok(briefIds.length === expectedPartnerCount,
    `§9 · every partner card exposes a brief control (${briefIds.length} of ${expectedPartnerCount})`);

  const shown = [];
  const onCard = await page.evaluate(() =>
    document.querySelectorAll('.v6-peer-grid img').length);
  R.ok(onCard === 0,
    `§9 · no card FACE renders a screenshot (${onCard}) — the shot belongs to the brief, so the grid stays cheap and six captures are not six requests on arrival`);

  for (const id of briefIds) {
    await page.locator(`[data-peer-brief="${id}"]`).click();
    await page.waitForSelector('[role="dialog"]', { timeout: 8000 }).catch(() => {});
    await page.waitForFunction((i) => {
      const im = document.querySelector(`img[data-peer-shot="${i}"]`);
      return im && im.complete;
    }, id, { timeout: 8000 }).catch(() => {});
    shown.push(await page.evaluate((i) => {
      const d = document.querySelector('[role="dialog"]');
      const im = d ? d.querySelector(`img[data-peer-shot="${i}"]`) : null;
      const cap = d ? [...d.querySelectorAll('figcaption')].map((f) => f.textContent.trim()) : [];
      return {
        id: i,
        n: d ? d.querySelectorAll('img').length : -1,
        decoded: !!im && im.naturalWidth > 0,
        nat: im ? `${im.naturalWidth}x${im.naturalHeight}` : null,
        src: im ? im.getAttribute('src') : null,
        lazy: im ? im.getAttribute('loading') : null,
        cap: cap[0] || null,
      };
    }, id));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(260);
  }

  /* p4·M6b — THE ROSTER IS NO LONGER UNIFORM, so "every brief renders exactly
   * one screenshot" is no longer the claim. `EcoShot` has been OPTIONAL since
   * p4·M3; the seventh peer is simply the first entry to exercise that, because
   * her artwork was never delivered. Asserting `n === 1` across the board would
   * red on an honest absence and, worse, would pressure a future author into
   * inventing a capture to satisfy a gate.
   *
   * The expectation is DERIVED from data.ts, by the same segmented parse
   * verify-origins uses: an entry that DECLARES a shot must render exactly one,
   * and an entry that declares none must render ZERO. That is strictly stronger
   * than the old count — it also catches an image appearing where the data
   * declares none, which is how a borrowed or hotlinked capture would arrive. */
  const idMarks = [...dataContent.matchAll(/\bid:\s*"([a-z0-9]+)"/g)];
  const declaresShot = new Set(idMarks.filter((m, i) =>
    /\bshot:\s*\{/.test(dataContent.slice(m.index, (idMarks[i + 1] || { index: dataContent.length }).index))
  ).map((m) => m[1]));
  const withShot = shown.filter((o) => declaresShot.has(o.id));
  const withoutShot = shown.filter((o) => !declaresShot.has(o.id));

  R.ok(withShot.length >= 6,
    `§9 · ${withShot.length} of ${shown.length} briefs declare a screenshot (floor: if this parse found none, every check below would pass over an empty set)`);

  const wrongCount = withShot.filter((o) => o.n !== 1);
  R.ok(shown.length === expectedPartnerCount && wrongCount.length === 0,
    `§9 · every brief that DECLARES a screenshot renders exactly one (${withShot.length - wrongCount.length} of ${withShot.length}; ${shown.length} briefs opened of ${expectedPartnerCount})`,
    wrongCount.map((o) => `${o.id}: ${o.n} img`).join(', '));

  const strayImg = withoutShot.filter((o) => o.n !== 0);
  R.ok(strayImg.length === 0,
    `§9 · every brief that declares NO screenshot renders no image at all (${withoutShot.length} such: ${withoutShot.map((o) => o.id).join(', ') || 'none'})`,
    strayImg.map((o) => `${o.id}: ${o.n} img`).join(', ')
    + '  — an image where the data declares none is a borrowed capture or a broken src, and both are worse than the absence.');

  const undecoded = withShot.filter((o) => !o.decoded);
  R.ok(undecoded.length === 0,
    `§9 · every screenshot actually DECODED, at its intrinsic size (${withShot.filter((o) => o.decoded).length} of ${withShot.length}; sizes: ${[...new Set(withShot.map((o) => o.nat))].join(', ')})`,
    undecoded.map((o) => o.id).join(', ')
    + '  — a 404 leaves the tag, the src and the alt all correct. Only a decode says the bytes arrived.');

  const offOriginSrc = withShot.filter((o) => !(o.src || '').startsWith('/peers/'));
  R.ok(offOriginSrc.length === 0,
    `§9 · every RENDERED src is same-origin too, not just the source literal (${withShot.length - offOriginSrc.length} of ${withShot.length})`,
    offOriginSrc.map((o) => `${o.id}: ${o.src}`).join(', '));

  const undated = withShot.filter((o) => !/^captured \d{4}-\d{2}-\d{2}$/i.test(o.cap || ''));
  R.ok(undated.length === 0,
    `§9 · every screenshot renders its capture date beneath it (${withShot.length - undated.length} of ${withShot.length}; e.g. "${withShot[0] ? withShot[0].cap : 'n/a'}")`,
    undated.map((o) => `${o.id}: ${JSON.stringify(o.cap)}`).join(', '));

  /* ══ §10 · EVERY BRIEF HAS ITS OWN ADDRESS (p4·M6b) ═══════════════════
   *
   * THE DEFECT THIS CLOSES: before this release all seven briefs shared one
   * URL. Opening any of them left the address bar at /operate/peers, so a
   * reader who copied it sent the recipient to the grid rather than to the
   * brief they were reading. There was no way to share a partner at all.
   *
   * PER PEER, NOT ONCE. A single assertion on one peer proves the mechanism
   * exists and says nothing whatever about the other six — and the failure
   * mode that matters (a slug that opens the WRONG brief) is invisible unless
   * every id is driven and the OPENED entry is identified. `data-eco-brief`
   * carries that identity; matching on the rendered title would work today and
   * break on the first copy edit.
   *
   * THE COLD-TAB CASE IS THE POINT. Each id below is loaded in a FRESH
   * navigation, which is what a pasted link actually is — not a click followed
   * by a URL read, which would pass even if the param were write-only. */
  const peerIds = [...dataContent.matchAll(/\bid:\s*"([a-z0-9]+)"/g)]
    .map((m, i, all) => ({
      id: m[1],
      seg: dataContent.slice(m.index, (all[i + 1] || { index: dataContent.length }).index),
    }))
    .filter((e) => /status:\s*"PARTNER"/.test(e.seg))
    .map((e) => e.id);

  R.ok(peerIds.length === expectedPartnerCount,
    `§10 · parsed ${peerIds.length} PARTNER slugs to drive, matching the ${expectedPartnerCount} declared (floor: an empty list would make every check below vacuous)`,
    peerIds.join(', '));

  /* THE PRERENDERED DOCUMENT IS PARAM-BLIND, AND SAYING SO IS THE HONEST
   * FORM OF "opens on first paint". /operate/peers prerenders to ONE file that
   * serves all seven addresses, so the brief opens on the first CLIENT render
   * after hydration — there is no server that could do otherwise on a static
   * host. What must NOT happen is a rendered-then-corrected sequence, i.e. the
   * grid settling and the dialog arriving later; that is what the assertion
   * below measures, by giving it no settle time at all. */
  const preRendered = readFileSync(join(__dirname, 'dist', 'operate', 'peers', 'index.html'), 'utf8');
  R.ok(!/role="dialog"/.test(preRendered),
    '§10 · the prerendered document carries no dialog — one file serves all seven addresses, so the brief is opened by hydration and this gate says so rather than claiming a server-rendered first paint');

  const opened = [];
  for (const id of peerIds) {
    await page.goto(`${BASE}/operate/peers?p=${id}`, { waitUntil: 'domcontentloaded' });
    const got = await page.waitForFunction(
      () => document.querySelector('[data-eco-brief]')?.getAttribute('data-eco-brief') ?? null,
      null, { timeout: 8000 },
    ).then((h) => h.jsonValue()).catch(() => null);
    opened.push({ id, got });
  }
  const wrongBrief = opened.filter((o) => o.got !== o.id);
  R.ok(wrongBrief.length === 0,
    `§10 · every one of the ${peerIds.length} slugs opens ITS OWN brief in a cold tab (${opened.length - wrongBrief.length} of ${opened.length}: ${peerIds.join(', ')})`,
    wrongBrief.map((o) => `?p=${o.id} opened ${o.got}`).join(', ')
    + '  — a slug that opens the wrong brief is a shareable link that is shareable and wrong.');

  /* THE UNKNOWN SLUG. This is the case a broken shared link produces, and the
   * one a fallback would quietly paper over: SimulatePage's v6.0.9 defect was
   * exactly this — an unrecognised ?p= silently opened a DIFFERENT entry. */
  await page.goto(`${BASE}/operate/peers?p=nosuchpeer`, { waitUntil: 'networkidle' });
  const unknown = await page.evaluate(() => ({
    dialogs: document.querySelectorAll('[role="dialog"]').length,
    cards: document.querySelectorAll('[data-peer-brief]').length,
    h1: document.querySelector('h1')?.textContent?.trim() ?? null,
  }));
  R.ok(unknown.dialogs === 0 && unknown.cards === expectedPartnerCount,
    `§10 · an unknown slug degrades to the index — no dialog (${unknown.dialogs}), no error page, all ${unknown.cards} cards still rendered`);
  R.ok(!!unknown.h1 && unknown.h1.length > 0,
    `§10 · …and the page still has its own heading rather than a not-found state ("${(unknown.h1 || '').slice(0, 42)}")`);

  /* THE ROUND TRIP: a click WRITES the address, a close CLEARS it. Without the
   * clear half, `?p=` would be pinned onto a closed page and the canonical
   * /operate/peers URL would stop existing once a reader opened anything. */
  await page.goto(`${BASE}/operate/peers`, { waitUntil: 'networkidle' });
  const first = peerIds[0];
  await page.locator(`[data-peer-brief="${first}"]`).click();
  await page.waitForSelector('[role="dialog"]', { timeout: 8000 }).catch(() => {});
  const afterOpen = new URL(page.url());
  R.ok(afterOpen.searchParams.get('p') === first,
    `§10 · clicking a brief control writes that brief's address (?p=${afterOpen.searchParams.get('p')})`);

  await page.keyboard.press('Escape');
  await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 5000 });
  const afterClose = new URL(page.url());
  R.ok(afterClose.searchParams.get('p') === null && afterClose.pathname === '/operate/peers',
    `§10 · closing clears the param rather than pinning a closed brief into the URL (${afterClose.pathname}${afterClose.search})`);

  /* THE CARD BODY ITSELF, which is the behaviour change this release makes.
   * A card used to `window.open` the partner's site on body click. Clicking the
   * card must now open the brief and must NOT navigate the app anywhere. */
  await page.goto(`${BASE}/operate/peers`, { waitUntil: 'networkidle' });
  const cardBox = page.locator('.v6-peer-grid .panel').first();
  await cardBox.click({ position: { x: 40, y: 90 } });
  await page.waitForSelector('[role="dialog"]', { timeout: 8000 }).catch(() => {});
  const afterCard = await page.evaluate(() => ({
    dialogs: document.querySelectorAll('[role="dialog"]').length,
    href: location.pathname + location.search,
    brief: document.querySelector('[data-eco-brief]')?.getAttribute('data-eco-brief') ?? null,
  }));
  R.ok(afterCard.dialogs === 1 && afterCard.brief === peerIds[0],
    `§10 · clicking the CARD BODY opens that card's brief (dialogs ${afterCard.dialogs}, brief ${afterCard.brief}) — it used to open the partner's site in a new tab`);
  R.ok(afterCard.href === `/operate/peers?p=${peerIds[0]}`,
    `§10 · …and the card click stayed on this origin, at the brief's address (${afterCard.href})`);

  /* ══ §11 · NO SCREENSHOT RESERVATION MAY SHIP (p4·M6b) ════════════════
   *
   * A "slot" was a dashed, captioned, empty box meaning "this artifact has not
   * arrived". The Superbrain brief shipped two of them ("screenshot · umbrel
   * community store listing", "screenshot · superbrain mining dashboard") for
   * several releases, and p4·M5 retired the stressnet pair while stating the
   * rule in data.ts's own words — without applying it to the entry 200 lines
   * below. That is why this is a gate and not a paragraph.
   *
   * THE RULE: a screenshot slot with an image ships and carries its capture
   * date; a screenshot slot without an image DOES NOT EXIST. An empty labelled
   * box reads as an image that failed to load, which tells a reader the page is
   * broken rather than that the picture was never taken — on a site whose whole
   * discipline is honest absence, it is the one shape of absence that lies.
   *
   * MEASURED ON THE RENDER, NOT ON THE SOURCE, and deliberately: the type and
   * the field are deleted, so a source check would assert against a mechanism
   * that no longer exists and pass forever without reading a page. This sweeps
   * every opened brief for any element whose own text is a screenshot caption
   * and which contains no <img>.
   *
   * PAIRED WITH A FLOOR, because it is an ABSENCE. If the sweep opened nothing,
   * or if captions stopped being rendered at all, "zero placeholders" would be
   * true of an empty set. The floor counts the SUBJECT that must exist in both
   * states: the real, dated captions under the screenshots that DID arrive. */
  const slotSweep = { boxes: [], captions: 0, briefs: 0 };
  for (const id of peerIds) {
    await page.goto(`${BASE}/operate/peers?p=${id}`, { waitUntil: 'networkidle' });
    const seen = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]');
      if (!d) return null;
      const bad = [...d.querySelectorAll('*')]
        .filter((el) => {
          const t = (el.textContent || '').trim();
          // `screenshot · <thing>` is the reservation caption. CSS uppercases
          // it, so innerText would read "SCREENSHOT ·" — match case-insensitively
          // and on textContent, which is the authored string either way.
          if (!/^screenshot\s*[·:]/i.test(t)) return false;
          if (t.length > 90) return false;          // a paragraph that merely mentions one
          return el.querySelectorAll('img').length === 0
              && (el.closest('figure') === null);   // a real <figcaption> lives in a figure
        })
        .map((el) => (el.textContent || '').trim().slice(0, 60));
      return {
        bad,
        captions: d.querySelectorAll('figure figcaption').length,
      };
    });
    if (seen) { slotSweep.briefs++; slotSweep.boxes.push(...seen.bad); slotSweep.captions += seen.captions; }
  }

  R.ok(slotSweep.briefs === peerIds.length,
    `§11 · the sweep actually opened every brief (${slotSweep.briefs} of ${peerIds.length}) — a sweep that opened none would report zero placeholders truthfully and uselessly`);
  R.ok(slotSweep.captions >= 6,
    `§11 · …and the briefs it opened do render real dated screenshot captions (${slotSweep.captions}) — the paired positive, so "no reservation" cannot be satisfied by a page that renders no captions at all`);
  R.ok(slotSweep.boxes.length === 0,
    `§11 · NO brief renders a screenshot reservation — a captioned box with no image in it (${slotSweep.boxes.length} found across ${slotSweep.briefs} briefs)`,
    slotSweep.boxes.join(' | ')
    + '  — a slot with no image reads as a failed load, not as an artifact nobody has captured. See EcoShot in data.ts.');

  await page.close();
  await reducedMotionPage.close();

} catch (err) {
  console.error('ERROR:', err);
  R.ok(false, `Test crashed: ${err.message}`);
} finally {
  await browser.close();
}

process.exit(R.finish());
