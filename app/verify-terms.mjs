// verify-terms.mjs — DOM + static gate for /about/terms, the 19th route: the
// site's Terms of Service.
//
// ── WHY THIS GATE EXISTS, WHICH IS NOT THE USUAL REASON ──────────────────
// Most page gates here protect a rendering. This one protects a SENTENCE.
//
// xmr.irish is listed on kycnot.me, a directory of services usable without
// identity disclosure, which re-reads this document monthly with an AI and
// re-scores the site from what it parses. Their "Guaranteed no KYC" attribute
// is worth +25 privacy — a quarter of the privacy score — and its definition
// is literally "Terms explicitly state KYC will never be requested". So the
// load-bearing artifact is one sentence of English prose, and prose has no
// type system. A hedge added in good faith during some future edit — "unless
// required by law", "at this time" — withdraws those points at the next
// monthly re-scan with NO CI failure, NO error and NO notification. Ordinary
// review does not catch a softened adjective in a 4,000-word document.
//
// That silent-decay failure mode is the whole justification for a new gate
// rather than a few assertions bolted onto verify-site.
//
// Sections:
//   §0  instrument floors — every parse this file depends on, asserted non-empty
//   §1  the route exists and is PRERENDERED (read from DISK, not the DOM)
//   §2  the no-KYC guarantee: present, verbatim, UNHEDGED, and made permanent
//       by §13 — with a planted-failure POSITIVE CONTROL (§2d)
//   §3  attribute-claim integrity, both directions: the true claims are present
//       AND the four untrue ones cannot drift in
//   §4  section presence and ORDER, from the rendered DOM
//   §5  nav and IA integrity — the About column's own header destination
//   §6  LICENSE tells the truth about third-party integrations
//
// ── WHAT §2 PROVES, AND WHAT IT CANNOT ───────────────────────────────────
// It proves the SENTENCE is present, byte-for-byte, in the document a parser
// that does not run scripts will fetch, and that the element carrying it is
// free of thirteen hedging constructions. It says NOTHING about the site's
// future conduct, and it must never be described as though it did: a gate can
// hold a promise still written down; it cannot hold a promise kept. The one
// thing it genuinely rules out is the promise being weakened IN SILENCE.
//
// ── WHY §1 AND §2 READ THE FILE ON DISK RATHER THAN THE DOM ──────────────
// The whole point is what a non-executing reader sees. kycnot's "Can't analyse
// ToS" attribute (0 privacy, -3 trust) names CLIENT SIDE RENDERING as a cause,
// so a DOM assertion would pass on exactly the page that scores worst. Reading
// dist/about/terms/index.html is the measurement that matches the claim.
//
// ── NO COLD-BOOT BYPASS HERE, DELIBERATELY — do not "restore" it. ─────────
// verify-site, verify-peers, verify-superstress and verify-mine all carry the
// identical note. verify-coldboot-live §0 audits which gates install the bypass
// against the set its own patterns detect as REACHING `/`. This gate never
// navigates to `/`, holds no array containing '/', and names no R.HOME — it
// imports ROUTES purely as a membership predicate (`.includes()`), the shape
// that gate's §0 carves out. Installing a bypass this gate does not need reds
// §0 with "DETECTOR STALE". It is also structurally unnecessary:
// coldboot/gate.ts's predicate ends `return pathname === R.HOME`.
//
// BLIND SPOTS (stated, not hidden):
//   — Whether the promise is KEPT. See above. This is a document gate.
//   — Whether kycnot's parser actually awards the attribute. Nothing offline
//     can know that; §2 asserts the property their published definition names.
//   — Whether the prose is GOOD, or the terms legally sufficient in any
//     jurisdiction. Neither is machine-checkable and neither is claimed.
//   — §3's absence checks are CLAIM-SHAPED, not word-shaped, because the page
//     legitimately contains "I2P" (in the we-block-nothing sentence) and
//     "audit it" (in the read-the-source sentence). Each absence is therefore
//     PAIRED with a positive control asserting that legitimate prose is still
//     present, so the sweep cannot pass by looking at the wrong text.
//
// Run against serve-dist (NOT vite preview — see verify-future.mjs header):
//   npm run build && npm run wait-preview && node verify-terms.mjs

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChromium } from './verify-lib.mjs';
import { makeReporter } from './verify-reporter.mjs';
import { ROUTES, R as ROUTE_MAP } from './scripts/routes.mjs';

const BASE = 'http://localhost:4173';
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const R = makeReporter('verify-terms');

const TERMS = '/about/terms';

/**
 * THE SENTENCE. Written here exactly once and compared byte-for-byte, never
 * paraphrased and never rebuilt from parts. It is the +25-privacy attribute's
 * entire textual basis.
 */
const NOKYC_SENTENCE =
  'xmr.irish will never request, collect, or verify your identity.';

/**
 * Hedging constructions forbidden INSIDE the element carrying the guarantee.
 *
 * Every string is lifted from kycnot's own NEGATIVE attributes — "May require
 * KYC/SOF by policy/law" (-6 privacy, -4 trust), "Rare KYC" (-5), "Service
 * Termination Policy" (-4). A hedge here is not a style problem, it is a
 * scoring event, and it is the single most likely way this page decays.
 *
 * SCOPE IS LOAD-BEARING AND IS THE REASON THIS IS NOT A PAGE-WIDE SWEEP.
 * Several of these appear legitimately ELSEWHERE in the document and must:
 * §13 says the identity commitment is "not subject to change" (which contains
 * "subject to"), §5 says no account can be revoked "at anyone's discretion",
 * and §12 disclaims to "the maximum extent permitted by applicable law". A
 * page-wide ban would red against a correct document and would then be
 * loosened until it caught nothing. The ban belongs where the promise is.
 */
const HEDGES = [
  'unless required', 'except where', 'subject to', 'at our discretion',
  'reserve the right', 'may be required', 'if obliged', 'where required by law',
  'from time to time', 'currently', 'at this time', 'presently', 'for now',
];

/** Strip scripts, then tags, then decode the handful of entities this page
 *  emits, so a phrase split across an inline <strong> still matches. */
function textOf(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&mdash;/g, '—').replace(/&rsquo;/g, '’')
    .replace(/&ldquo;/g, '“').replace(/&rdquo;/g, '”')
    .replace(/&middot;/g, '·').replace(/&amp;/g, '&')
    .replace(/&apos;|&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');
}

/** The innerHTML of the element carrying `data-terms-nokyc`, from raw HTML.
 *  Brace-free depth walk over tags rather than a lazy regex, because the
 *  block contains nested <p>, <ul> and <strong> — the shape p4·M6b recorded
 *  a bounded-lookahead parser silently missing. */
function nokycBlock(html) {
  const open = html.indexOf('data-terms-nokyc');
  if (open === -1) return null;
  const start = html.indexOf('>', open);
  if (start === -1) return null;
  let depth = 1;
  const re = /<(\/?)div\b[^>]*?(\/?)>/g;
  re.lastIndex = start + 1;
  let m;
  while ((m = re.exec(html))) {
    if (m[2] === '/') continue;          // self-closing
    depth += m[1] === '/' ? -1 : 1;
    if (depth === 0) return html.slice(start + 1, m.index);
  }
  return null;
}

/**
 * §2's assertions as a PURE FUNCTION of an HTML string, so the very same
 * instrument runs over the real document and over a deliberately mutated copy.
 * Returns the list of failures it found; empty means the document passes.
 *
 * This shape is what makes §2d a real control rather than a second opinion:
 * a planted failure has to fail THE CHECKS THAT SHIP, not a re-implementation
 * of them written to be failed.
 */
function nokycFailures(html) {
  const out = [];
  const text = textOf(html);

  // 2a · the sentence, byte-for-byte
  if (!text.includes(NOKYC_SENTENCE)) out.push('2a: the guarantee sentence is absent or altered');

  // 2b · unhedged, scoped to the element that carries the guarantee
  const block = nokycBlock(html);
  if (block === null) out.push('2b: no [data-terms-nokyc] element');
  else {
    const bt = textOf(block).toLowerCase();
    for (const h of HEDGES) if (bt.includes(h)) out.push(`2b: hedge "${h}" inside the guarantee`);
  }

  // 2c · §13 keeps the guarantee permanent. §2 is worthless if §13 quietly
  // makes it revocable, and that is the cheapest possible way to gut this
  // page while leaving the sentence word-for-word intact.
  if (!text.includes('is permanent')) out.push('2c: "is permanent" is gone from the document');
  if (!/never introduce a KYC procedure/i.test(text)) {
    out.push('2c: §13 no longer names the identity commitment as the permanent one');
  }
  return out;
}

/* ══ §0 · instrument floors ═════════════════════════════════════════════
   Every check below is vacuously true if its parse returns nothing — the
   defect verify-ia §7b, verify-superstress §0 and verify-site §0 each open
   with a floor to prevent. Asserted BEFORE anything reads them. */
R.group('§0 · instrument floors — the parses everything below depends on');

const DIST = join(__dirname, 'dist/about/terms/index.html');
R.ok(existsSync(DIST), `dist/about/terms/index.html exists — the route prerendered`);
const PRE = existsSync(DIST) ? readFileSync(DIST, 'utf8') : '';
R.ok(PRE.length > 8000, `prerendered document read (${PRE.length} chars)`);

const PRE_TEXT = textOf(PRE);
R.ok(PRE_TEXT.length > 6000,
  `the prerendered document carries ${PRE_TEXT.length} chars of TEXT with every tag and script stripped`,
  'a JS-off reader — and kycnot\'s parser — sees this and nothing else');

const PAGE_SRC = readFileSync(join(__dirname, 'src/pages/TermsPage.tsx'), 'utf8');
R.ok(PAGE_SRC.length > 8000, `TermsPage.tsx read (${PAGE_SRC.length} chars)`);

const LICENSE = readFileSync(join(repoRoot, 'LICENSE'), 'utf8');
R.ok(LICENSE.length > 1500, `LICENSE read (${LICENSE.length} chars)`);

R.ok(nokycBlock(PRE) !== null,
  '[data-terms-nokyc] resolves in the prerendered HTML — §2b has a subject');

const { browser, engine } = await launchChromium();
R.info(`engine: ${engine}`);

/* ══ §1 · the route exists and is prerendered ═══════════════════════════ */
R.group('§1 · the route resolves, and a reader with no JavaScript gets the terms');
{
  R.ok(ROUTES.includes(TERMS), `1 · ${TERMS} is in scripts/routes.mjs ROUTES (${ROUTES.length} routes)`);
  R.ok(ROUTE_MAP.ABOUT_TERMS === TERMS, `1 · R.ABOUT_TERMS is "${ROUTE_MAP.ABOUT_TERMS}"`);

  // THE ASSERTION THIS GATE EXISTS FOR, in its static form. Read from DISK:
  // kycnot's parser fetches HTML and does not run scripts, so a DOM check
  // would pass on precisely the page that scores worst.
  R.ok(PRE_TEXT.includes(NOKYC_SENTENCE),
    '1 · the no-KYC guarantee is in the STATIC HTML — no JavaScript required to read it',
    `looked for: ${NOKYC_SENTENCE}`);

  for (const [what, needle] of [
    ['section 1 · what this service is', 'It is not a financial service.'],
    ['section 3 · custody', 'entirely non-custodial'],
    ['section 4 · no-log policy', 'We operate a strict no-log policy.'],
    ['section 5 · JavaScript off', 'Every page works with JavaScript disabled.'],
    ['section 12 · warranty', 'without warranty of any kind'],
    ['section 14 · contact', 'aqua@xmr.irish'],
  ]) {
    R.ok(PRE_TEXT.includes(needle), `1 · ${what} is in the prerendered HTML`);
  }

  // A parser that cannot see the document is the -3 trust attribute. The four
  // causes kycnot names are captchas, client-side rendering, DDoS
  // interstitials and non-text formats; the first and third are absent from
  // this repo by decision and the second is what the assertions above rule
  // out. This one rules out the fourth.
  R.ok(!/<canvas|<img[^>]+terms/i.test(PRE),
    '1 · the terms are TEXT — not an image, not a canvas, not an embedded document');
}

/* ══ §2 · the guarantee ═════════════════════════════════════════════════ */
R.group('§2 · the no-KYC guarantee — present, verbatim, unhedged, and permanent');
{
  const fails = nokycFailures(PRE);
  R.ok(fails.length === 0,
    `2 · the shipped document passes every guarantee check (${fails.length} failures)`,
    fails.join('\n     '));

  // Named individually, so a red says WHICH property went rather than
  // printing one aggregate.
  R.ok(PRE_TEXT.includes(NOKYC_SENTENCE), '2a · the guarantee sentence is present byte-for-byte');
  R.ok(/there never has been one, and one will never be introduced/.test(PRE_TEXT),
    '2a · and it is stated in the past, present and future — not merely as a current position');

  const block = nokycBlock(PRE);
  const bt = block === null ? '' : textOf(block).toLowerCase();
  const found = HEDGES.filter((h) => bt.includes(h));
  R.ok(block !== null && bt.length > 800,
    `2b · the guarantee element carries ${bt.length} chars — the hedge sweep has a real subject`);
  R.ok(found.length === 0,
    `2b · no hedging construction inside the guarantee (swept ${HEDGES.length} of them)`,
    `found: ${found.join(', ')}`);

  R.ok(PRE_TEXT.includes('is permanent'),
    '2c · §13 still says the identity commitment "is permanent"');
  R.ok(/never introduce a KYC procedure/i.test(PRE_TEXT),
    '2c · §13 still names WHICH commitment is permanent — §2 is worthless if §13 revokes it');
  R.ok(/it goes offline, not that it acquires identity checks/i.test(PRE_TEXT),
    '2c · and it states the honest outcome of a transfer or sale, closing the successor loophole');

  /* §2d · POSITIVE CONTROL — a planted failure, run through the SAME
     function that ships. A gate that cannot be made to go red has proved
     nothing about the document it just passed, and "the assertions look
     correct" is the reasoning p4·07's M5 and p4·M7's M4 both refuted: when a
     break test behaves surprisingly, the instrument is the suspect.

     The mutation is the exact real-world decay this gate exists to catch —
     "never" softened to "not currently", which reads as reasonable caution,
     changes no fact a reviewer would challenge, and silently costs 25 privacy
     points at the next monthly re-scan. */
  const MUTATED = PRE.replace(/will never request, collect, or verify/g,
                              'does not currently request, collect, or verify');
  R.ok(MUTATED !== PRE, '2d · the control mutation applied — it is measuring a changed document');
  const controlFails = nokycFailures(MUTATED);
  R.ok(controlFails.length > 0,
    `2d · CONTROL: the softened document FAILS this gate (${controlFails.length} named failures)`,
    'a control that does not red makes the whole of §2 unfalsifiable — this run is a FAILED run, not a pass');
  R.ok(controlFails.some((f) => f.startsWith('2a')),
    '2d · CONTROL: and §2a is among the failures — the SENTENCE check is what catches it');
  R.ok(controlFails.some((f) => f.includes('currently')),
    '2d · CONTROL: the hedge sweep independently catches "currently" — two checks, one mutation');
  R.info(`control failures: ${controlFails.join(' | ')}`);
}

/* ══ §3 · attribute-claim integrity ═════════════════════════════════════ */
R.group('§3 · the true claims are present, and the four untrue ones cannot drift in');
{
  for (const [attr, needle] of [
    ['No registration needed', 'There is no registration'],
    ['Strict no-log policy', 'keeps no logs of its own'],
    ['Non-custodial protocol', 'entirely non-custodial'],
    ['No CAPTCHAs', 'No CAPTCHAs, bot challenges, or interstitials.'],
    ['No JavaScript needed', 'does not require JavaScript in order to be read'],
    ['Defends against takedown requests', 'rather than acting on it automatically'],
    ['Personal info is not verified', 'No personal information is verified'],
    ['Open source code', 'released under the MIT Licence'],
    ['Accepts Monero', 'voluntary donations in Monero'],
  ]) {
    R.ok(PRE_TEXT.includes(needle), `3 · claims "${attr}" in language matching its published definition`);
  }

  /* THE ABSENCE HALF, and it is CLAIM-SHAPED rather than word-shaped.
     Four attributes worth +13 combined are not true of this site today. A
     naive word ban would red against correct prose — the page legitimately
     says it does not block "I2P", and legitimately invites the reader to
     "audit it" — so each ban is a shape, and each is PAIRED with a positive
     control asserting the legitimate prose is still there. Without the
     pairing, a sweep that had drifted onto the wrong text would report a
     clean absence over nothing at all. */
  const NOT_TRUE = [
    ['an onion service', /\.onion\b|\bonion (?:address|service|mirror)\b|\bhidden service\b/i],
    ['an I2P address',   /\bi2p (?:address|mirror|site|eepsite)\b|\bb32\.i2p\b/i],
    ['a warrant canary', /\bwarrant canary\b/i],
    ['a third-party audit', /\b(?:independently|third-party|externally) audited\b|\bhas been audited\b|\bsecurity audit (?:by|of this site)\b/i],
  ];
  for (const [what, re] of NOT_TRUE) {
    const hit = PRE_TEXT.match(re);
    R.ok(!hit, `3 · the page does NOT claim ${what} — it does not have one`,
      hit ? `matched: "${hit[0]}"` : '');
  }
  // The paired controls. These prove the two bans above that COULD have been
  // written as word bans are looking at text where the word really appears.
  R.ok(/\bI2P\b/.test(PRE_TEXT),
    '3 · CONTROL: "I2P" IS on the page (the we-block-nothing sentence) — the ban is claim-shaped, not word-shaped');
  R.ok(/audit it/.test(PRE_TEXT),
    '3 · CONTROL: "audit it" IS on the page (the read-the-source sentence) — same distinction');

  // "Mature service" needs two years and the site began in 2026. Nothing on
  // the page claims longevity, and nothing should.
  R.ok(!/\b(?:since 20[01]\d|for (?:many|several) years|long-established)\b/i.test(PRE_TEXT),
    '3 · the page claims no operating history it does not have');
}

/* ══ §4 · section presence and order ════════════════════════════════════ */
R.group('§4 · the fifteen sections render, in the shipped order');
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(BASE + TERMS, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('[data-terms-section="contact"]', { timeout: 8000 });

  /* The ORDER of a terms document is part of its meaning — a reader who
     meets the warranty disclaimer before the guarantee has read a different
     document — and nothing structural protects a reorder. verify-site §12's
     idiom exactly.

     FIFTEEN, not fourteen. The brief for this release listed fourteen ids and
     the shipped copy has fifteen blocks: the preamble plus fourteen NUMBERED
     sections, and §7 "Content and reuse" had no id in that list. The copy
     ships verbatim, so the id is what accommodated it — `content`, at the
     position §7 occupies. Recorded here rather than quietly resolved. */
  const EXPECTED = [
    'intro', 'what', 'identity', 'custody', 'data', 'access', 'accuracy',
    'content', 'funding', 'legal', 'use', 'source', 'warranty', 'changes', 'contact',
  ];
  const order = await p.evaluate(() =>
    [...document.querySelectorAll('[data-terms-section]')].map((e) => e.getAttribute('data-terms-section')));

  // NON-VACUITY FIRST — a wrong-length list deserves its own named red rather
  // than one confusing string diff.
  R.ok(order.length === EXPECTED.length,
    `4 · all ${EXPECTED.length} sections carry a data-terms-section marker (${order.length})`,
    `got: ${order.join(' → ')}`);
  R.ok(order.join(',') === EXPECTED.join(','),
    '4 · they render in the shipped order',
    `got:      ${order.join(' → ')}\n     expected: ${EXPECTED.join(' → ')}`);
  // The two that carry the argument, named individually.
  R.ok(order[2] === 'identity',
    `4 · the identity guarantee is THIRD — before custody, data and access (position ${order.indexOf('identity') + 1})`);
  R.ok(order[order.length - 1] === 'contact',
    `4 · contact is LAST (position ${order.indexOf('contact') + 1})`);

  // The guarantee must survive HYDRATION too, not merely prerendering: React
  // discards the prerendered markup and renders fresh (createRoot, not
  // hydrateRoot), so the static and live documents are two artifacts.
  const live = await p.evaluate(() => document.querySelector('main')?.innerText ?? '');
  R.ok(live.includes(NOKYC_SENTENCE),
    '4 · the guarantee is also in the RENDERED page — prerender and hydration agree');

  const h1s = await p.evaluate(() => document.querySelectorAll('h1').length);
  R.ok(h1s === 1, `4 · exactly one <h1> (${h1s})`);

  const mailtos = await p.evaluate(() =>
    [...document.querySelectorAll('a[href^="mailto:"]')].map((a) => a.getAttribute('href')));
  R.ok(mailtos.length >= 1 && mailtos.every((h) => h === 'mailto:aqua@xmr.irish'),
    `4 · every contact link is the operator's address (${mailtos.length} found)`);

  // A terms page whose only links leave the origin would be a page that talks
  // about privacy and then leaks. There is exactly one outbound scheme here
  // and it is mailto:, which issues no request until a reader clicks it.
  const anchors = await p.evaluate(() => {
    const main = document.querySelector('main');
    const all = main ? [...main.querySelectorAll('a[href]')] : [];
    return {
      total: all.length,
      offOrigin: all.map((a) => a.href).filter((h) => h.startsWith('http') && !h.startsWith(location.origin)),
    };
  });
  // FLOOR FIRST: "no off-origin anchor" is satisfied just as well by a <main>
  // that renders no anchors at all, or by a selector that found nothing.
  R.ok(anchors.total >= 2,
    `4 · <main> carries ${anchors.total} anchors — the off-origin sweep has a real subject`);
  R.ok(anchors.offOrigin.length === 0,
    `4 · and NONE of them leaves this origin (${anchors.offOrigin.length})`,
    anchors.offOrigin.join(', '));

  await ctx.close();
}

/* ══ §5 · nav and IA integrity ══════════════════════════════════════════ */
R.group('§5 · the About column gained a leaf without moving its own header');
{
  const iaModule = await import(join(__dirname, 'src', 'nav', 'ia.ts'));
  const about = Array.isArray(iaModule.IA) ? iaModule.IA.find((s) => s.key === 'about') : null;
  R.ok(about != null, '5 · the About section resolves in nav/ia.ts');

  if (about) {
    const items = about.cols[0].items;
    R.ok(items.length === 4, `5 · the About column has 4 items (${items.length})`);
    R.ok(items[items.length - 1].p === TERMS,
      `5 · ${TERMS} is LAST in the column (got "${items[items.length - 1].p}")`);

    /* THE ORDERING TRAP, caught mechanically. `nav/ia.ts`'s section header
       navigates to cols[0].items[0].p, so a leaf placed FIRST would silently
       move where clicking "About" in the nav goes — a regression with no
       visible symptom until someone notices the wrong page opening. This is
       the assertion that makes "declared LAST" a mechanism rather than a
       comment in three files. */
    R.ok(items[0].p === '/about/sources',
      `5 · and the About header still resolves to /about/sources (got "${items[0].p}")`);
    R.ok(items.filter((i) => i.p === TERMS).length === 1,
      '5 · the terms leaf appears exactly once');
  }

  // The JS-off shell nav is a separate hand-copied list and nothing derives
  // it — the surface CLAUDE.md records the registration sweep repeatedly
  // missing. For THIS page it matters more than usual: a reader with no
  // JavaScript who cannot reach the terms cannot read them.
  const INDEX = readFileSync(join(__dirname, 'index.html'), 'utf8');
  R.ok(INDEX.includes('href="/about/terms"'),
    '5 · index.html\'s #boot-fallback nav offers the terms with no JS and no bundle');
}

/* ══ §6 · the licence tells the truth ═══════════════════════════════════ */
R.group('§6 · LICENSE no longer advertises an integration that does not exist');
{
  /* MEASURED, not assumed, at b7ab133: `grep -rn "iframe|<embed|<object"
     app/src app/index.html` returns TWO hits, BOTH inside comments in
     pages/future/data.ts — one saying a third-party swap iframe "is refused
     by the browser before" it loads, the other that a swap widget is "NEVER
     COMING". Zero live iframes; the widget went in v6.1.0. So item 3 of the
     licence described a feature that had not existed for many releases, on a
     site whose new §1 states it embeds nothing.

     This section is the cheapest in the file and closes a defect CLAUDE.md
     had carried as a known finding for several releases. */
  for (const dead of ['ChangeNOW', 'Wagyu', 'Exchange widget']) {
    R.ok(!LICENSE.includes(dead),
      `6 · LICENSE does not name "${dead}" — it advertises no integration this site does not have`);
  }
  // `iframe` is the one that has to be claim-shaped. The corrected clause uses
  // the word to DENY the thing ("no swap iframe"), so a substring ban reds
  // against a correct licence — which is exactly what this gate's first run
  // did. Ban the INCLUSION, keep the denial.
  const INCLUDES_ONE = /\b(?:iframes?|widgets?|embeds?)\b[^.]{0,80}?\b(?:are|is)\s+included\b|\bincluded\s+for\s+demonstration\b|\bembeds?\s+(?:an?\s+)?(?:third-party|exchange|swap)\b(?!\s*service\.)/i;
  const inc = LICENSE.match(INCLUDES_ONE);
  R.ok(!inc, '6 · LICENSE claims no widget, iframe or embed is INCLUDED in this site',
    inc ? `matched: "${inc[0]}"` : '');
  R.ok(/no swap iframe/.test(LICENSE),
    '6 · CONTROL: the word "iframe" IS in the licence — as the DENIAL. The ban above is claim-shaped, not word-shaped');
  // Paired positive control: the section that REPLACED it must still be there,
  // or "does not name ChangeNOW" is satisfied just as well by a deleted
  // section — an absence over nothing.
  R.ok(/NO THIRD-PARTY INTEGRATIONS/.test(LICENSE),
    '6 · CONTROL: the replacement clause is present, so the absence above is not an absence of the whole section');
  R.ok(/embeds no third-party service/.test(LICENSE),
    '6 · and it states the true position rather than merely deleting the false one');
  // The distinction the correction had to draw and must not lose: the site
  // does NAME exchanges editorially (MarketsPage's venue directory, an
  // education chapter), and the licence has to allow that while denying the
  // integration.
  R.ok(/editorial description only/.test(LICENSE),
    '6 · and it still permits NAMING a third party editorially — the line the correction had to draw');
}

await browser.close();
process.exit(R.finish());
