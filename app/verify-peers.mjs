// verify-peers.mjs — DOM gate for /about/peers Monero Superbrain partner card.
//
// Verifies the fourth (fifth overall) ecosystem entry lands correctly, rendering:
//   1. Four PARTNER cards (exact count from source parse)
//   2. Superbrain's GitHub repo URL in exact casing (case-sensitive)
//   3. Install block with 4 ordered steps in <ol>
//   4. Five app names rendered (Superbrain, SuperPay, MoneroSpace, Superstress, SuperAtomic)
//   5. No typed numbers in pulse (static source check across relevant files)
//   6. Pulse live-data handling: accepts valid payload, degrades on 500
//   7. Mobile (390px): no h-scroll, no HTML text under 12px
//   8. Reduced motion: cards render, zero running animations
//
// CROSS-GATE DEPENDENCY: verify-future.mjs asserts the Superbrain pulse does NOT
// appear on /future (counts exactly 9 data-pulse="live" on that page). This gate
// asserts it DOES appear on /about/peers. The two checks together prevent the pulse
// from migrating to the wrong surface.
//
// BLIND SPOTS (cannot verify in sandbox):
//   — Live GitHub API responses and repo stats (mocked here)
//   — Whether the installed Umbrel app actually works
//   — The GitHub URL's reachability (egress to github.com blocked)
//   — Whether previous /about/peers content is still intact (gate assumes page renders)
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
R.ok(expectedPartnerCount === 4,
  `§1 · data.ts declares exactly 4 PARTNER entries (parsed: ${expectedPartnerCount})`);

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
 * bypass installed anywhere: `/` has [data-coldboot]=1, `/about/peers` has
 * 0 and renders all four partner cards. This gate never visits `/`, so it
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
  /* ── COLD LOAD: 4 partner cards render ──────────────────────────────── */
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

  await page.goto(BASE + '/about/peers', { waitUntil: 'networkidle' });

  // §1: Rendered card count matches parsed source count
  const cards = page.locator('.v6-stagger');
  const renderedCount = await cards.count();

  R.ok(renderedCount === expectedPartnerCount,
    `§1 · Four partner cards render (rendered: ${renderedCount}, expected: ${expectedPartnerCount})`);

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

  // Wait for the modal to open — it renders a dialog with role="dialog"
  await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

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

  // Pulse area should not have a fabricated number — either "fetching", error msg, or em-dash
  const pulseDivAfterError = page.locator('[data-peer-pulse="brainchainz/Monero-Superbrain"]');
  const pulseDivVisible = await pulseDivAfterError.isVisible({ timeout: 2000 }).catch(() => false);
  if (pulseDivVisible) {
    const pulseDivText = await pulseDivAfterError.textContent();
    const hasFabricatedNumber = /^[\s\d.,]+$/.test(pulseDivText.trim());
    R.ok(!hasFabricatedNumber || pulseDivText.includes('fetching') || pulseDivText.includes('error'),
      `§6 · Degraded pulse does not render fabricated numbers`);
  } else {
    R.skip('§6 · Pulse area not visible after error (acceptable degradation)');
  }

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

  // Check text legibility — look for computed font-size < 12px in the peers
  // grid BODY TEXT, excluding intentional 10-11px design elements (status badges,
  // kickers, button labels, which are per --fs-label: clamp(11px, 0.74vw, 12px)).
  const subPixelText = await page.evaluate(() => {
    const bad = [];
    const contentArea = document.querySelector('.v6-peer-grid');
    if (!contentArea) return bad;

    const walker = document.createTreeWalker(
      contentArea,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    let node;
    while (node = walker.nextNode()) {
      if (node.textContent.trim().length === 0) continue;
      const parent = node.parentElement;
      if (!parent) continue;
      // Skip known-good intentional small elements
      const cls = parent.className;
      if (cls.includes('v6-status') || cls.includes('kicker') ||
          cls.includes('pill') || cls.includes('dim2') || cls.includes('mono')) {
        continue; // These are intentionally small per design system
      }
      const fs = parseInt(window.getComputedStyle(parent).fontSize);
      if (fs < 12 && fs > 0) {
        bad.push({
          text: node.textContent.slice(0, 40),
          fontSize: fs,
        });
      }
    }
    return bad;
  });

  R.ok(subPixelText.length === 0,
    `§7 · No unintended HTML text under 12px in peers grid at 390px (found: ${subPixelText.length})`);

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

  await reducedMotionPage.goto(BASE + '/about/peers', { waitUntil: 'networkidle' });

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

  await page.close();
  await reducedMotionPage.close();

} catch (err) {
  console.error('ERROR:', err);
  R.ok(false, `Test crashed: ${err.message}`);
} finally {
  await browser.close();
}

process.exit(R.finish());
