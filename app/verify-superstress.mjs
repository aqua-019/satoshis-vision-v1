// verify-superstress.mjs — DOM gate for /operate/superstress, the 14th route.
//
// Sections:
//   §0  instrument floors — the source parses used by everything below
//   §1  the route resolves, is PRERENDERED, and its panels are in that HTML
//   §2  five Disclosure rows, derived from source; both ARIA polarities
//   §3  the single-source claim: the partner block and the hub say ONE thing
//   §4  the install walkthrough — ordered, complete, in an <ol>
//   §5  MoneroSpace is described by FUNCTION ONLY
//   §6  the betanet question is ANSWERED, and every port is attributed
//   §7  every cross-link resolves to something that exists
//   §8  390px — no h-scroll, no sub-12px HTML text
//   §9  reduced motion — zero running animations
//
// ── NO COLD-BOOT BYPASS HERE, DELIBERATELY — do not "restore" it. ─────────
// verify-peers.mjs carries the identical note and the identical reason.
// verify-coldboot-live's §0 audits the set of gates that install the bypass
// against the set its own patterns detect as REACHING `/`. This gate never
// navigates to `/`, holds no route array containing '/', names no R.HOME, and
// does NOT import ROUTES from verify-lib.mjs (that import alone marks a gate
// as /-reaching, because ROUTES[0] === '/'). A gate that installs a bypass it
// does not need is a false positive in that proxy and reds §0 with
// "DETECTOR STALE".
//
// BLIND SPOTS (stated, not hidden):
//   — Whether the Umbrel apps actually install or work. Nothing here can know.
//   — The GitHub URLs' reachability (egress to github.com is blocked here).
//   — Whether the beta chain exists as described, and whether the ports the
//     maintainer quotes are the ones his addon actually opens. Nothing here
//     can reach either. §6 asserts the ATTRIBUTION is present and correct in
//     shape — whose ports these are said to be — never that the numbers work.
//   — This chain's own parameters remain embargoed and unciteable. What
//     CHANGED in p3·19 is narrower than it looks: the ENDPOINT question is
//     answered (self-hosted, none exists, none planned); the chain's genesis,
//     nettype and its own daemon's ports are still undocumented, and §6 is
//     careful not to imply otherwise.
//   — Prose QUALITY. This gate checks that the honest sentences are present
//     and the dishonest ones are absent; it cannot check that the explanation
//     is any good.
//
// Run against serve-dist (NOT vite preview — see verify-future.mjs header):
//   npm run build && npm run wait-preview && node verify-superstress.mjs

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './verify-lib.mjs';
import { makeReporter } from './verify-reporter.mjs';
import { ROUTES } from './scripts/routes.mjs';

const BASE = 'http://localhost:4173';
const __dirname = dirname(fileURLToPath(import.meta.url));
const R = makeReporter('verify-superstress');

const HUB = '/operate/superstress';

/* ══ §0 · instrument floors ═════════════════════════════════════════════
   Every comparison below comes from one of these three parses. A parse that
   silently returns nothing makes set-difference checks VACUOUSLY TRUE — the
   defect verify-ia §7b/§7c each open with a floor to prevent — so each one
   is asserted non-empty BEFORE anything is compared against it. */
R.group('§0 · instrument floors — the parses everything below depends on');

/** Strip // and block comments, preserving length — WITHOUT touching string
 *  literals. Source files legitimately NAME the patterns this gate greps for
 *  (this very file does), so a naive substring match must not read a comment
 *  as code; verify-ia and verify-memshell carry the same helper for the same
 *  reason.
 *
 *  THE STRING-AWARENESS IS NOT DEFENSIVE — it is a measured fix. The first
 *  version of this function was verify-ia's, copied verbatim, and it blanked
 *  the `//` inside `"Add → paste: https://github.com/…"`. The install-step
 *  parse then read THREE steps ending in `"Add → paste: https:"` while the
 *  page correctly rendered FOUR in the right order, and the gate reported an
 *  order mismatch against a page that was right. verify-ia never hit this
 *  because it only ever parses bare `id:` fields, which contain no URLs; the
 *  moment a parse touches prose it does. */
function stripComments(src) {
  let out = '', i = 0;
  while (i < src.length) {
    const c = src[i], two = src.slice(i, i + 2);
    if (c === '"' || c === "'" || c === '`') {
      // Copy the literal through untouched, honouring backslash escapes.
      out += c; i++;
      while (i < src.length && src[i] !== c) {
        if (src[i] === '\\') { out += src[i]; i++; if (i < src.length) { out += src[i]; i++; } continue; }
        out += src[i]; i++;
      }
      if (i < src.length) { out += src[i]; i++; }
    } else if (two === '//') { while (i < src.length && src[i] !== '\n') { out += ' '; i++; } }
    else if (two === '/*') {
      while (i < src.length && src.slice(i, i + 2) !== '*/') { out += src[i] === '\n' ? '\n' : ' '; i++; }
      out += '  '; i += 2;
    } else { out += c; i++; }
  }
  return out;
}

const dataSrc = stripComments(readFileSync(join(__dirname, 'src', 'pages', 'future', 'data.ts'), 'utf8'));
const pageSrc = stripComments(readFileSync(join(__dirname, 'src', 'pages', 'SuperstressPage.tsx'), 'utf8'));

/** The body of `export const NAME = [ … ]`, non-greedy to the first `];`.
 *  Same idiom as verify-ia §7c, widened to accept the `as const satisfies`
 *  tail SUPERBRAIN_APPS carries (verify-ia's version requires a `:` type
 *  annotation before the `=`, which this declaration does not have). */
function arrayBody(src, name) {
  const m = src.match(new RegExp(`export\\s+const\\s+${name}\\s*(?::[^=]*)?=\\s*\\[([\\s\\S]*?)\\]\\s*(?:as const[^;]*)?;`));
  return m ? m[1] : '';
}

const appsSrc = arrayBody(dataSrc, 'SUPERBRAIN_APPS');
const APP_IDS = [...appsSrc.matchAll(/\{\s*id:\s*"([a-z]+)"/g)].map((m) => m[1]);
const APP_NAMES = [...appsSrc.matchAll(/name:\s*"([^"]+)"/g)].map((m) => m[1]);
const APP_FNS = [...appsSrc.matchAll(/fn:\s*"([^"]+)"/g)].map((m) => m[1]);

R.ok(appsSrc.length > 0,
  appsSrc.length > 0
    ? 'located SUPERBRAIN_APPS array in data.ts source'
    : 'could not locate "export const SUPERBRAIN_APPS" — the file moved or the declaration changed shape');
R.ok(APP_IDS.length > 0,
  APP_IDS.length > 0
    ? `SUPERBRAIN_APPS parses ${APP_IDS.length} ids: ${APP_IDS.join(', ')}`
    : 'parsed NO ids from SUPERBRAIN_APPS — the instrument is pointed at the wrong thing');
R.ok(APP_IDS.length === APP_NAMES.length && APP_IDS.length === APP_FNS.length,
  `each app parses an id, a name and an fn (${APP_IDS.length}/${APP_NAMES.length}/${APP_FNS.length})`);

/* The count is FIVE, and this assertion exists because the word "five" is
   typed as prose in three places nothing derives — data.ts's blurb, its
   "The five apps" block label, and the hub's own sub. A sixth app would
   leave all three reading "five" and no other gate would notice. This is the
   p2·10 lesson (a count literal one hop from the thing that changed) with the
   remedy stated in the failure message rather than left to be rediscovered. */
R.ok(APP_IDS.length === 5,
  `SUPERBRAIN_APPS declares exactly 5 apps (parsed: ${APP_IDS.length})`,
  'if this changed deliberately, the literal word "five" in data.ts\'s blurb, its block label and SuperstressPage\'s `sub` must all change with it — none of them derives');

/* APP_DETAIL is keyed by the same ids. TypeScript already pins this via
   Record<SuperbrainAppId, …>, which is a compile-time check that only runs
   when tsc does — the same argument verify-ia §7b makes for checking a
   Record-typed binding at runtime as well. */
const detailSrc = (() => {
  const m = pageSrc.match(/const APP_DETAIL[^=]*=\s*\{([\s\S]*?)\n\};/);
  return m ? m[1] : '';
})();
const DETAIL_KEYS = [...detailSrc.matchAll(/^\s{2}([a-z]+):\s*\{/gm)].map((m) => m[1]);
R.ok(detailSrc.length > 0 && DETAIL_KEYS.length > 0,
  DETAIL_KEYS.length > 0
    ? `APP_DETAIL parses ${DETAIL_KEYS.length} keys: ${DETAIL_KEYS.join(', ')}`
    : 'parsed NO keys from APP_DETAIL in SuperstressPage.tsx');
if (DETAIL_KEYS.length > 0 && APP_IDS.length > 0) {
  const missing = APP_IDS.filter((id) => !DETAIL_KEYS.includes(id));
  const extra = DETAIL_KEYS.filter((k) => !APP_IDS.includes(k));
  R.ok(missing.length === 0, missing.length === 0
    ? 'every app in the spine has a detail entry'
    : `${missing.length} app(s) with no APP_DETAIL entry: ${missing.join(', ')}`);
  R.ok(extra.length === 0, extra.length === 0
    ? 'APP_DETAIL invents no app the spine does not declare'
    : `${extra.length} APP_DETAIL key(s) name no app: ${extra.join(', ')}`);
}

/* The install block, read from the SAME source the page renders from. */
const INSTALL_STEPS = (() => {
  const m = dataSrc.match(/ordered:\s*true,\s*lines:\s*\[([\s\S]*?)\],/);
  return m ? [...m[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) => x[1]) : [];
})();
R.ok(INSTALL_STEPS.length > 0,
  INSTALL_STEPS.length > 0
    ? `install block parses ${INSTALL_STEPS.length} ordered steps`
    : 'parsed NO ordered install steps from data.ts');

const { browser } = await launch();

try {
  const page = await browser.newPage();

  /* The repo pulse is the page's one live element. Mocked so §1's content
     assertions do not depend on an upstream this sandbox cannot reach — and
     so the degraded path is tested deliberately in its own place rather than
     arrived at by accident. */
  await page.route('**/api/feeds*', (route) =>
    route.request().url().includes('src=ghrepo')
      ? route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({
            stars: 42, issues: 7,
            pushed: new Date(Date.now() - 3600000).toISOString(),
            issueAt: new Date(Date.now() - 7200000).toISOString(),
          }),
        })
      : route.continue());

  /* ══ §1 · the route resolves and is PRERENDERED ═══════════════════════ */
  R.group('§1 · the route resolves, is prerendered, and its panels ship in that HTML');

  /* Fetched as TEXT, before any JavaScript runs — this is the document a
     JS-off reader receives. Asserting against the hydrated DOM instead would
     pass identically whether prerendering worked or not, which is the whole
     defect verify-nojs's own header records. */
  const res = await page.request.get(BASE + HUB);
  R.ok(res.status() === 200, `${HUB} serves 200 (got ${res.status()})`);
  const html = await res.text();

  R.ok(/<noscript>/.test(html), 'the prerendered document carries the shell <noscript> block');
  R.ok(/nojs-reveal\[hidden\]/.test(html),
    'the <noscript> block carries the .nojs-reveal rule that opens collapsed panels with JS off',
    'without it the hub\'s per-app detail is unreachable for a reader with scripting disabled');

  const prerenderedPanels = (html.match(/class="disc-panel nojs-reveal"/g) || []).length;
  R.ok(prerenderedPanels === APP_IDS.length,
    `all ${APP_IDS.length} disclosure panels ship in the PRERENDERED html (found ${prerenderedPanels})`,
    'the panel is rendered always and hidden with [hidden] precisely so it is in this document; a conditionally-mounted panel would put the detail behind JavaScript');

  /* A panel that is in the HTML but empty would satisfy the count above and
     tell a JS-off reader nothing. Check the prose is there too. */
  const proseInHtml = APP_IDS.filter((id) => {
    const d = detailSrc.split(new RegExp(`\\n  ${id}:`))[1] || '';
    const first = (d.match(/"([^"]{40,})"/) || [])[1];
    return first ? html.includes(first.slice(0, 60)) : true;
  });
  R.ok(proseInHtml.length === APP_IDS.length,
    `every panel's prose is IN the prerendered html, not just its wrapper (${proseInHtml.length}/${APP_IDS.length})`);

  await page.goto(BASE + HUB, { waitUntil: 'networkidle' });
  R.ok(new URL(page.url()).pathname === HUB,
    `landed on ${HUB} with no redirect hop (got ${new URL(page.url()).pathname})`);

  const h1s = await page.locator('h1#page-title').count();
  R.ok(h1s === 1, `exactly one <h1 id="page-title"> (found ${h1s})`);

  /* ══ §2 · five rows, both ARIA polarities ════════════════════════════ */
  R.group('§2 · disclosure rows — count from source, and BOTH aria states');

  const rows = page.locator('[data-disclosure]');
  const rowCount = await rows.count();
  R.ok(rowCount === APP_IDS.length,
    `${APP_IDS.length} disclosure rows render, matching the source parse (found ${rowCount})`);

  const idsInDom = await rows.evaluateAll((els) => els.map((e) => e.getAttribute('data-disclosure')));
  R.ok(APP_IDS.every((id) => idsInDom.includes(id)),
    `every app id in the spine renders a row (${idsInDom.join(', ')})`);

  /* CLOSED polarity — asserted first, because it is the state the page loads
     in and the one a "does it open?" check silently assumes. */
  const closed = await page.evaluate(() =>
    [...document.querySelectorAll('[data-disclosure]')].map((d) => {
      const b = d.querySelector('button[aria-controls]');
      const p = b && document.getElementById(b.getAttribute('aria-controls'));
      return {
        id: d.getAttribute('data-disclosure'),
        expanded: b && b.getAttribute('aria-expanded'),
        panelExists: !!p,
        panelHidden: p ? p.hasAttribute('hidden') : null,
        visible: p ? p.getBoundingClientRect().height > 0 : null,
        labelledBy: p ? p.getAttribute('aria-labelledby') === b.id : null,
      };
    }));
  R.ok(closed.every((c) => c.expanded === 'false'),
    `closed: every row reports aria-expanded="false" (${closed.filter((c) => c.expanded === 'false').length}/${closed.length})`);
  R.ok(closed.every((c) => c.panelExists),
    'closed: every aria-controls RESOLVES to a real element',
    'the conditionally-mounted variant of this pattern points at nothing while collapsed — that is the deviation this primitive makes on purpose');
  R.ok(closed.every((c) => c.panelHidden === true && c.visible === false),
    'closed: every panel carries [hidden] and measures zero height');
  R.ok(closed.every((c) => c.labelledBy === true),
    'closed: every panel is aria-labelledby its own trigger');

  /* OPEN polarity — the same four claims, driven through a real click. */
  const firstId = APP_IDS[0];
  await page.click(`[data-disclosure="${firstId}"] button`);
  const openState = await page.evaluate((id) => {
    const d = document.querySelector(`[data-disclosure="${id}"]`);
    const b = d.querySelector('button[aria-controls]');
    const p = document.getElementById(b.getAttribute('aria-controls'));
    return {
      expanded: b.getAttribute('aria-expanded'),
      hidden: p.hasAttribute('hidden'),
      height: p.getBoundingClientRect().height,
      text: p.innerText.trim().length,
    };
  }, firstId);
  R.ok(openState.expanded === 'true', `open: ${firstId} reports aria-expanded="true"`);
  R.ok(openState.hidden === false, `open: ${firstId}'s panel drops [hidden]`);
  R.ok(openState.height > 0, `open: ${firstId}'s panel has real height (${Math.round(openState.height)}px)`);
  R.ok(openState.text > 100, `open: ${firstId}'s panel carries real prose (${openState.text} chars)`);

  /* INDEPENDENCE — these rows are readings, not a menu. Opening a second must
     not shut the first. A single-open accordion would pass every assertion
     above and fail this one. */
  await page.click(`[data-disclosure="${APP_IDS[1]}"] button`);
  const bothOpen = await page.evaluate((ids) =>
    ids.map((id) => document.querySelector(`[data-disclosure="${id}"] button`).getAttribute('aria-expanded')),
    [APP_IDS[0], APP_IDS[1]]);
  R.ok(bothOpen.every((v) => v === 'true'),
    `two rows stay open at once — independent, not an accordion (${bothOpen.join(', ')})`);

  /* And it closes again. Without this, a row that opened and jammed passes. */
  await page.click(`[data-disclosure="${firstId}"] button`);
  const reclosed = await page.evaluate((id) => {
    const b = document.querySelector(`[data-disclosure="${id}"] button`);
    const p = document.getElementById(b.getAttribute('aria-controls'));
    return { expanded: b.getAttribute('aria-expanded'), hidden: p.hasAttribute('hidden') };
  }, firstId);
  R.ok(reclosed.expanded === 'false' && reclosed.hidden === true,
    `${firstId} closes again on a second click (the toggle is a toggle)`);

  /* ══ §3 · the single-source claim ════════════════════════════════════ */
  R.group('§3 · the partner brief and the hub say ONE thing about the five apps');

  const summaries = await page.evaluate(() =>
    [...document.querySelectorAll('[data-disclosure] .disc-summary')].map((e) => e.textContent.trim()));
  R.ok(summaries.length === APP_FNS.length,
    `the hub renders ${APP_FNS.length} row summaries (found ${summaries.length})`);
  const mismatched = APP_FNS.filter((fn) => !summaries.includes(fn));
  R.ok(mismatched.length === 0,
    mismatched.length === 0
      ? 'every row summary is byte-identical to the `fn` parsed from data.ts source'
      : `${mismatched.length} summary/source mismatch(es): ${mismatched.join(' | ')}`,
    'this catches a hardcoded summary on the hub — but NOT a divergence between the two surfaces; see the cross-surface check below');

  /* THE CROSS-SURFACE CHECK, and the reason it exists is a break test that
     failed to go red.
     The assertion above compares the hub's DOM to data.ts's SOURCE. Both
     sides derive from the same array, so changing an `fn` moves them
     together and the check stays green — it is comparing the source to
     itself through the DOM. It proves the hub does not hardcode a summary,
     which is worth proving, and it is NOT the single-source claim.
     The single-source claim is about TWO SURFACES, so it has to read the
     other one: /about/peers renders `${name} — ${fn}` from the same array
     inside the Superbrain brief. Comparing the hub's rendered summaries to
     THAT rendered list is the only version of this assertion that could ever
     have caught the drift it exists to prevent. */
  const peers = await browser.newPage();
  await peers.route('**/api/feeds*', (r) => r.fulfill({ status: 500, body: '{}' }));
  await peers.goto(BASE + '/about/peers', { waitUntil: 'networkidle' });
  /* The Superbrain card is found BY NAME, not by index. `text=our brief`
     matches FIVE elements on that page (the button and an ancestor), so a
     bare `nth=3` targets whichever of those happens to land third — an
     index chosen by assumption, which is how verify-ia §7b/§7c both ended up
     locating their columns by SHAPE instead. Deriving the index from the
     rendered card headings survives a reordering of ECOSYSTEM. */
  const cardNames = await peers.evaluate(() =>
    [...document.querySelectorAll('.v6-stagger h3')].map((h) => h.textContent.trim()));
  const sbIdx = cardNames.findIndex((n) => /Superbrain/i.test(n));
  R.ok(sbIdx >= 0, `located the Superbrain card on /about/peers (index ${sbIdx} of ${cardNames.length})`,
    `cards rendered: ${cardNames.join(', ')}`);
  await peers.locator('button', { hasText: 'our brief' }).nth(sbIdx).click();
  await peers.waitForSelector('.v6-modal-body');
  const partnerLines = await peers.evaluate(() => {
    /* textContent, NOT innerText: the block label is a `.kicker` and carries
       text-transform:uppercase, so innerText would return "THE FIVE APPS"
       and a label match would silently fail. Same trap as §5's. */
    const label = [...document.querySelectorAll('.kicker')]
      .find((e) => /five apps/i.test(e.textContent));
    const list = label && label.parentElement.querySelector('ul, ol');
    return list ? [...list.querySelectorAll('li')].map((li) => li.textContent.trim()) : [];
  });
  R.ok(partnerLines.length === APP_FNS.length,
    `the partner brief on /about/peers renders ${APP_FNS.length} app lines (found ${partnerLines.length})`,
    'a zero here makes the comparison below vacuous — it is the floor, not the finding');
  if (partnerLines.length > 0) {
    const drift = summaries.filter((sum) => !partnerLines.some((line) => line.endsWith(sum)));
    R.ok(drift.length === 0,
      drift.length === 0
        ? `all ${summaries.length} hub summaries appear VERBATIM in the partner brief — the two surfaces cannot disagree`
        : `${drift.length} sentence(s) the hub says and the partner brief does not: ${drift.join(' | ')}`);
  }
  await peers.close();

  /* ══ §4 · the install walkthrough ════════════════════════════════════ */
  R.group('§4 · install walkthrough — ordered, complete, and an <ol>');

  /* SELECTED BY DATA ATTRIBUTE, NOT BY TAG, and then the tag is ASSERTED.
     The first version located `ol[data-install-steps]`, which conflates two
     different questions — "is there an install list?" and "is it ordered?" —
     into one selector. Measured under a break test that swapped the <ol> for
     a <ul>: the locator matched nothing, `await ol.evaluate(...)` sat for
     Playwright's full 30s timeout and then threw, and the throw took the
     whole gate down at §4 — so §5, §6, §7 and §8's mutations in the same
     round were never reported at all. An early crash masks every later
     section, which is the masking-cost argument this repo makes about gate
     ORDER, arriving inside a single file. Guarded so a missing list is one
     clean red and the rest of the gate still runs. */
  const ol = page.locator('[data-install-steps]');
  const olCount = await ol.count();
  R.ok(olCount === 1, `exactly one install list (found ${olCount})`);
  if (olCount === 1) {
    const tag = await ol.evaluate((e) => e.tagName);
    R.ok(tag === 'OL', `the install list is an <ol>, not a <ul> (got <${tag.toLowerCase()}>)`,
      'these steps must be followed in sequence; an unordered list says they need not be');
    const steps = await ol.locator('li').allTextContents();
    R.ok(steps.length === INSTALL_STEPS.length,
      `all ${INSTALL_STEPS.length} steps render (found ${steps.length})`);
    const inOrder = INSTALL_STEPS.every((s, i) => (steps[i] || '').trim() === s.trim());
    R.ok(inOrder, inOrder
      ? 'the steps render in the source\'s own order'
      : `order mismatch — source: ${JSON.stringify(INSTALL_STEPS)} | dom: ${JSON.stringify(steps.map((s) => s.trim()))}`);
  } else {
    R.ok(false, 'the install list could not be located, so its tag, length and order go unchecked',
      'declared as three UNMADE assertions rather than skipped quietly — a section that cannot run is not a section that passed');
  }

  const body = await page.evaluate(() => document.getElementById('root').innerText);
  R.ok(/xmrig -o /.test(body), 'the external-miner command renders verbatim');

  /* ══ §5 · MoneroSpace, by function only ══════════════════════════════ */
  R.group('§5 · MoneroSpace is described by FUNCTION ONLY');

  /* THE MATCH IS CASE-INSENSITIVE, AND THAT IS A FIX, NOT A LOOSENING.
     `.kicker` carries `text-transform: uppercase`, and innerText returns the
     RENDERED text — so the heading reads "WHY IT MATTERS" and a
     case-SENSITIVE /Why it matters/ matched nothing on ANY app. The absence
     check therefore passed for monerospace for a reason unrelated to
     monerospace, and a break test that gave it a `why` produced ZERO reds.
     Same family as the σ→Σ finding p3·14 recorded: CSS text-transform
     changes what a gate reads, not merely how it looks. */
  await page.click('[data-disclosure="monerospace"] button');
  const readPanel = (id) => page.evaluate((appId) => {
    const d = document.querySelector(`[data-disclosure="${appId}"]`);
    const b = d.querySelector('button[aria-controls]');
    const p = document.getElementById(b.getAttribute('aria-controls'));
    return { text: p.innerText, hasCaveat: !!p.querySelector('[data-app-caveat]'), hasWhy: /why it matters/i.test(p.innerText) };
  }, id);

  const ms = await readPanel('monerospace');
  R.ok(ms.hasCaveat, 'its panel carries the open-question caveat');
  R.ok(/open question/i.test(ms.text) && /maintainer/i.test(ms.text),
    'the caveat names it as an open question with the maintainer');

  /* THE PAIRED POSITIVE CONTROL, and it is the half that gives the absence
     below any content at all. Without it, "monerospace has no Why" cannot be
     told apart from "the selector is broken and NOBODY has one" — which is
     exactly the state this section shipped in until a break test found it. */
  const controlId = APP_IDS.find((id) => id !== 'monerospace');
  await page.click(`[data-disclosure="${controlId}"] button`);
  const control = await readPanel(controlId);
  R.ok(control.hasWhy,
    `positive control: ${controlId}'s panel DOES carry a "Why it matters" argument`,
    'if this is red the absence assertion below proves nothing, whatever it reports');
  R.ok(!control.hasCaveat,
    `positive control: ${controlId} carries NO caveat (only monerospace does)`);
  R.ok(!ms.hasWhy,
    'monerospace asserts NO "Why it matters" argument',
    'every other app has one — see the control above; this is the restraint the embargo requires, and it is the assertion that fails the day somebody fills in the gap');

  /* ── THE LINEAGE PATTERNS ARE DELIBERATELY NOT SPELLED IN THIS FILE ──────
     A first draft of this section carried its own copy of verify-future
     §15's regex, so the narrow claim would be visible to a reader of THIS
     gate. That copy TRIPPED §15, which is the point: its corpus is the whole
     repo walked from the root over .ts/.tsx/.js/.mjs/.css/.json/.md/.html,
     and it exempts exactly one file — verify-future.mjs itself, "this file
     defines the patterns". Any OTHER file that spells them, including a gate
     written to check them and including a handoff written to prohibit them,
     is a hit. p3·15 recorded this after its own handoff turned §15 red at
     `found 1`; this is the same trap, one release later, in a new file type.
     So the embargo is asserted ONCE, in the file allowed to name it, and
     what is checked here instead is the POSITIVE shape the embargo produces:
     MoneroSpace has a caveat and no argument, and the control above proves
     the other four do have one. Those two assertions fail on exactly the
     edit §15 exists to catch, and they do it without restating a banned
     string in a second place. */
  R.ok(/MoneroSpace/.test(body),
    'the project is NAMED where it is described (naming and linking is the honest maximum)');
  R.ok(/github\.com\/brainchainz\/Monero-Superbrain/.test(html),
    'its repo is LINKED, not merely named');

  /* ══ §6 · the betanet question is ANSWERED, and the ports are attributed ══
     THIS SECTION'S SUBJECT CHANGED IN p3·19, and the replacement is sharper
     rather than weaker — which is the only defensible reason to rewrite a
     gate. It used to pin a reserved 220px `EmptySlot` and five sentences
     about a telemetry endpoint that might or might not exist. The maintainer
     answered: the chain is self-hosted, runs its own daemon, and has no public
     endpoint. Every one of those five assertions describes copy that is now
     FALSE, so keeping them would pin a lie.

     "Restore the feature, never weaken the gate" governs DEFECTS. This is a
     designed replacement, so the bar is that the new assertions catch strictly
     more: the old §6 could not have caught an unattributed port number, a
     resurrected "pending" phrase anywhere outside the slot, or a missing
     why-no-live-panel — and those are the three things this page can now get
     wrong. The mutation that matters most is the resurrection one (§6f): it is
     what makes the historical state unrepresentable rather than merely absent.

     EVERY ABSENCE HERE IS PAIRED WITH A POSITIVE CONTROL. An absence assertion
     passes whether the copy went, the selector died, or the page failed to
     render — this file's §5 already records the case-sensitivity version of
     that trap — so each sweep below is preceded by proof that the thing doing
     the reading is alive and CAN see text of the shape being denied. */
  R.group('§6 · the betanet question is answered, and every port is attributed');

  /* ── §6a · floors. Parsed from the page's OWN source, never retyped here:
     a gate that restates a sentence cannot detect the sentence changing. */
  const REACH_QUOTE = (() => {
    const m = pageSrc.match(/reach:\s*"((?:[^"\\]|\\.)*)"/);
    return m ? m[1] : '';
  })();
  const PREREQ_ROWS = (() => {
    const m = pageSrc.match(/const PREREQ[^=]*=\s*\[([\s\S]*?)\n\];/);
    return m ? [...m[1].matchAll(/\["([^"]+)",\s*"((?:[^"\\]|\\.)*)"\]/g)].map((x) => [x[1], x[2]]) : [];
  })();
  R.ok(REACH_QUOTE.length > 40,
    REACH_QUOTE.length > 40
      ? `parsed the maintainer's reachability quote from source (${REACH_QUOTE.length} chars)`
      : 'parsed NO reachability quote from SuperstressPage.tsx — MAINTAINER.reach moved or changed shape',
    'every quote assertion below compares the RENDERED text against this parse; an empty parse makes them vacuous');
  R.ok(PREREQ_ROWS.length >= 5,
    PREREQ_ROWS.length >= 5
      ? `parsed ${PREREQ_ROWS.length} prerequisite-identity rows from source`
      : `parsed only ${PREREQ_ROWS.length} PREREQ rows — the const moved or changed shape`);

  const hubText = await page.evaluate(() => document.querySelector('.page-shell').innerText);
  R.ok(hubText.length > 3000,
    `the page carries ${hubText.length} chars of rendered text`,
    'every absence sweep below reads this string — a short read makes all of them vacuously true');

  /* ── §6b · the reservation is GONE, and the control proves EmptySlot lives.
     Deleting the component entirely would satisfy the first assertion for the
     wrong reason; the per-app screenshot slots are the paired positive. */
  const betaSlots = await page.locator('[data-empty-slot*="beta-chain mempool"]').count();
  R.ok(betaSlots === 0,
    `the reserved betanet box is GONE (found ${betaSlots})`,
    'a reserved box is a promise the thing is coming; this one is not coming, so the box is a false promise');
  const shotSlots = await page.locator('[data-empty-slot^="screenshot"]').count();
  R.ok(shotSlots >= 1,
    `EmptySlot itself still renders for the honest reservations (${shotSlots} screenshot slots)`,
    'PAIRED CONTROL for the assertion above: without it, deleting the whole component reads as "the betanet box was removed"');

  /* ── §6c · the answer is present, negative, and PERMANENT. "No endpoint
     today" and "no endpoint ever" are different claims and only the second is
     true, so the permanence half gets its own assertion. */
  const answer = page.locator('[data-betanet-answer]');
  R.ok(await answer.count() === 1, 'the answered section renders exactly once');
  const answerText = await answer.count() ? await answer.innerText() : '';
  R.ok(/asked and answered/i.test(answerText),
    'it says the question was ASKED AND ANSWERED, rather than silently dropping it');

  /* SCOPED TO `[data-answered]`, THE PARAGRAPH THAT CARRIES THE ANSWER — not
     to the whole section, and that is a FIX found by a break test refusing to
     go red. Read against the section, "the answer is permanent" was satisfied
     by the word "never" in the why-no-live-panel note and "by design" in its
     last clause — two paragraphs away, both about a different claim. The
     mutation that softened the answer itself to "there is no public endpoint
     right now" left all three of these GREEN. A true fact about the wrong
     subject, in a gate written the same day this file's header quotes that
     family. Scope first, then assert. */
  const answeredEl = page.locator('[data-answered]');
  R.ok(await answeredEl.count() === 1, 'the answer paragraph renders exactly once');
  const answered = await answeredEl.count() ? await answeredEl.innerText() : '';
  R.ok(/no public endpoint/i.test(answered),
    'it states the answer: there is no public endpoint');
  R.ok(/none is planned|by design|never/i.test(answered),
    'and THAT PARAGRAPH says the answer is PERMANENT, not a current state',
    '"no endpoint right now" invites the next PR to re-open the question; "none is planned" closes it');
  R.ok(/self-hosted/i.test(answered),
    'and names the reason: the chain is self-hosted');

  /* ── §6d · the why-no-live-panel is an ARGUMENT, and both of its two real
     reasons must be named. Either alone reads as an excuse. */
  const noPanel = page.locator('[data-no-live-panel]');
  R.ok(await noPanel.count() === 1, 'the why-no-live-panel note renders');
  const noPanelText = await noPanel.count() ? await noPanel.innerText() : '';
  R.ok(/connect-src/i.test(noPanelText) && /self/i.test(noPanelText),
    'reason 1 — this site\'s CSP is connect-src \'self\', so the browser reaches no other origin');
  R.ok(/lan|tailnet|onion/i.test(noPanelText) && /proxy|ours to reach/i.test(noPanelText),
    'reason 2 — a reader\'s node is on their LAN/Tailnet/onion and is not this site\'s to proxy');

  /* ── §6e · the forward rule is recorded BEFORE there is data to apply it to,
     so a later change inherits it instead of inventing one. */
  const ruleText = await page.locator('[data-betanet-rule]').count()
    ? await page.locator('[data-betanet-rule]').innerText() : '';
  R.ok(/BETANET\s*·\s*NOT MAINNET\s*·\s*TEST FUNDS ONLY/i.test(ruleText),
    'the banner rule for any future beta-chain data is written into the copy');
  R.ok(/provenance/i.test(ruleText) && /accent/i.test(ruleText),
    'and names the other two halves of that rule — its own accent and its own provenance badge');

  /* ── §6f · THE RESURRECTION SWEEP. The historical state made unrepresentable.
     Sentence-scoped rather than token-scoped, because the page legitimately
     says "endpoint" (in the answer) and legitimately says "open question" (the
     MoneroSpace provenance caveat, a DIFFERENT and still-open question). A
     bare token grep would have to choose between missing the defect and
     failing on correct copy; pairing the two token classes WITHIN a sentence
     does neither, and it survives rewording. */
  const sentences = hubText.split(/(?<=[.!?])\s+|\n+/).filter((s) => s.trim().length > 0);
  const PENDING_RX = /\bpending\b|awaiting|landing soon|coming soon|to be wired|not wired|still to come/i;
  const ENDPOINT_RX = /endpoint|telemetry/i;
  const resurrected = sentences.filter((s) => ENDPOINT_RX.test(s) && PENDING_RX.test(s));
  R.ok(sentences.length > 40,
    `the page splits into ${sentences.length} sentences`,
    'PAIRED CONTROL: the sweep below is vacuous if the splitter returns nothing');
  R.ok(sentences.some((s) => ENDPOINT_RX.test(s)),
    'the splitter CAN see endpoint-shaped sentences (the answer itself is one)',
    'PAIRED CONTROL: proves a zero below means "no pending endpoint claim", not "no endpoint text at all"');
  R.ok(resurrected.length === 0,
    `no sentence claims an endpoint is pending (found ${resurrected.length}${resurrected.length ? ': ' + JSON.stringify(resurrected.slice(0, 3)) : ''})`,
    'the endpoint question is ANSWERED NO — copy that says otherwise is now false, wherever it reappears');
  R.ok(/open question/i.test(hubText) && /maintainer/i.test(hubText),
    'and the MoneroSpace provenance caveat SURVIVES — a different question, still genuinely open',
    'PAIRED CONTROL: proves the sweep above removed endpoint copy specifically, not every open-question sentence on the page');

  /* ── §6g · EVERY PORT NUMBER IS ATTRIBUTED, OR IT IS ABSENT.
     The failure mode is concrete: a reader copies "18081 p2p" into a config
     and it does not connect, because those are the mainnet ADDON's ports as
     the maintainer recalls them — not Superstress's own daemon's, which are
     undocumented, and not even mainnet convention (which is 18080 for P2P).
     The number and its attribution must therefore be in ONE container; a
     number that has drifted out of `[data-ports]` is a number a reader can
     meet without the paragraph that makes it safe. */
  const PORTS = ['18080', '18081', '18083', '18089'];
  const portsText = await page.locator('[data-ports]').count()
    ? await page.locator('[data-ports]').innerText() : '';
  const countOf = (hay, needle) => hay.split(needle).length - 1;
  const rendered = PORTS.filter((p) => countOf(hubText, p) > 0);
  R.ok(rendered.length > 0,
    `port numbers actually render on the page (${rendered.join(', ')})`,
    'PAIRED CONTROL: without it, deleting every port number would pass the attribution sweep below');
  const strayPorts = PORTS.filter((p) => countOf(hubText, p) !== countOf(portsText, p));
  R.ok(strayPorts.length === 0,
    `every port occurrence sits inside [data-ports] with its attribution (stray: ${strayPorts.length ? strayPorts.join(', ') : 'none'})`,
    'a port number outside that block is a number a reader can copy without reading whose port it is');
  const attrText = await page.locator('[data-port-attribution]').count()
    ? await page.locator('[data-port-attribution]').innerText() : '';
  R.ok(/monero node add/i.test(attrText),
    'the attribution names WHOSE ports these are: the Monero node addon\'s');
  R.ok(/not superstress|its own monerod/i.test(attrText),
    'and denies the reading that matters — they are NOT Superstress\'s own daemon\'s');
  R.ok(/configuration|config/i.test(attrText),
    'and tells the reader to read their own config rather than copy the number');

  /* ── §6h · the prerequisite is made concrete, and the transports are stated
     with the NEGATIVE named. A transport the app does not have is worth more
     words than one it does: a reader planning an I2P-only deployment would
     otherwise get all the way to a node that cannot reach anything. */
  const prereqEl = page.locator('[data-prereq-identity]');
  R.ok(await prereqEl.count() === 1, 'the prerequisite-identity block renders');
  const prereqText = await prereqEl.count() ? await prereqEl.innerText() : '';
  const missingRows = PREREQ_ROWS.filter(([, v]) => !prereqText.includes(v));
  R.ok(PREREQ_ROWS.length > 0 && missingRows.length === 0,
    `all ${PREREQ_ROWS.length} prerequisite rows render verbatim from source (missing: ${missingRows.length})`,
    missingRows.length ? `first missing: ${JSON.stringify(missingRows[0][0])}` : '');
  R.ok(/mainnet/i.test(prereqText),
    'it says the prerequisite is a MAINNET node — the mistake this block exists to prevent');
  R.ok(/tor/i.test(prereqText),
    'Tor is named as an available transport (PAIRED CONTROL for the I2P check below)');
  const i2pSentence = prereqText.split(/(?<=[.!?])\s+|\n+/).find((s) => /i2p/i.test(s)) || '';
  R.ok(i2pSentence.length > 0 && /\bnot\b|commented out/i.test(i2pSentence),
    `I2P is named ONLY as unavailable, never listed as a transport (${JSON.stringify(i2pSentence.slice(0, 80))})`,
    'upstream leaves the i2pd daemon commented out; listing I2P as available would send a reader down a path that dead-ends');

  /* ── §6i · the maintainer is QUOTED, not paraphrased. A paraphrase of a chat
     message is a claim this site would be making on somebody else's behalf,
     and these three sentences are the only published answers about a chain
     whose specification is not published. */
  R.ok(hubText.includes(REACH_QUOTE),
    'the quote reaches the screen unmangled — the render alters nothing');
  R.ok(await page.locator('[data-maintainer-quote]').count() >= 2,
    `his words are marked as his (${await page.locator('[data-maintainer-quote]').count()} attributed quotes)`,
    'an unmarked quote reads as this site asserting the claim itself');

  /* THE ASSERTION ABOVE IS WEAKER THAN IT LOOKS, AND SAYING SO IS THE POINT.
     It parses the quote from source and compares it to the render, so BOTH
     SIDES MOVE TOGETHER: a mutation that tidied the constant into fluent prose
     — capitalised, repunctuated, "add[on]" expanded — left it GREEN. That is
     p3·16's recorded defect (2), "an assertion comparing the source to itself
     through the DOM", committed here by someone who had just read it. Nothing
     offline can know the maintainer's true words; what CAN be checked is that
     the constant still carries the marks of an unedited chat message, which is
     the property a paraphrase destroys and the convention this page declares
     for itself. Both of these red under that mutation. */
  R.ok(/\[[a-z]+\]/.test(REACH_QUOTE),
    'the quote keeps its bracketed editorial insertion — the ONLY permitted edit, marked as one',
    'a quote with no [brackets] has either been silently corrected or never needed correcting; this one needed it');
  const chatShaped = [REACH_QUOTE].some((q) => /^[a-z]/.test(q.trim()) && !/\.$/.test(q.trim()));
  R.ok(chatShaped,
    'and reads as a chat message, not as edited prose (lowercase open, no terminal full stop)',
    'a tidied paraphrase gains a capital and a full stop; those are the cheapest detectable signs that somebody rewrote a quotation');

  /* ══ §7 · every cross-link resolves ══════════════════════════════════ */
  R.group('§7 · every in-app link on this page resolves to a route that exists');

  /* SCOPED TO `.page-shell`, which is this page's own container — NOT `#root`.
     The first version swept #root and collected 16 links, twelve of them
     NavTop's dropdown and the footer. It then reported a fragment link
     (`/about/sources#release-notes`) as a finding against this page, which
     does not render it: a true fact about the wrong subject, in a gate whose
     summary line says "on this page". Scope first, then assert. */
  const hrefs = await page.evaluate(() =>
    [...document.querySelectorAll('.page-shell a[href^="/"]')].map((a) => a.getAttribute('href')));
  const own = [...new Set(hrefs)].filter((h) => !h.startsWith('//'));
  R.ok(own.length >= 4,
    `the page carries ${own.length} in-app links (need at least the 4 cross-links)`,
    'a zero here would make every check below vacuously true');

  const unresolved = [];
  for (const h of own) {
    const path = h.split('?')[0].split('#')[0];
    const known = ROUTES.includes(path) || ROUTES.some((r) => r !== '/' && path.startsWith(r + '/'));
    if (!known) { unresolved.push(`${h} (no route)`); continue; }
    const r2 = await page.request.get(BASE + h);
    if (r2.status() !== 200) unresolved.push(`${h} (HTTP ${r2.status()})`);
  }
  R.ok(unresolved.length === 0,
    unresolved.length === 0
      ? `all ${own.length} in-app links name a real route AND serve 200`
      : `${unresolved.length} broken: ${unresolved.join(', ')}`);

  /* NO hollow fragments. #184 measured that all four partner `/future#<id>`
     palette anchors scroll to nothing, because /future renders no such panel.
     That finding is on the open list; this page must not add a fifth. */
  /* NARROWED to the defect actually recorded. #184 measured that the four
     partner `/future#<id>` palette anchors scroll to nothing because /future
     renders no such panel. A blanket "no fragments" rule is a wider claim
     than that finding supports — `/about/sources#release-notes` is a real
     anchor on a real page — and asserting the wider one is how a gate starts
     reporting correct code as broken.
     NOT-MATCHED: this cannot see a fragment that is hollow on some OTHER
     page. Proving an arbitrary `#id` resolves means loading the destination
     and looking, which is a sweep for the gate that owns those pages. */
  const hollow = hrefs.filter((h) => /^\/future#/.test(h));
  R.ok(hollow.length === 0,
    hollow.length === 0
      ? 'the page links NO /future#<id> anchor (all four of those are hollow — #184)'
      : `${hollow.length} hollow fragment link(s): ${hollow.join(', ')}`);

  /* ══ §8 · 390px ══════════════════════════════════════════════════════ */
  R.group('§8 · 390px');

  const phone = await browser.newPage();
  await phone.setViewportSize({ width: 390, height: 844 });
  await phone.route('**/api/feeds*', (r) => r.fulfill({ status: 500, body: '{}' }));
  await phone.goto(BASE + HUB, { waitUntil: 'networkidle' });

  const hScroll = await phone.evaluate(() => document.body.scrollWidth - window.innerWidth);
  R.ok(hScroll <= 0, `no horizontal scroll at 390px (scrollWidth − innerWidth: ${hScroll})`);

  /* THE FLOOR HERE WAS 11px WITH FOUR CLASS EXEMPTIONS, AND p4·02 RETIRED BOTH.
     The note that stood here was HONEST and its reasoning was right AT THE
     TIME: 11px was the repo's real number (verify-legibility.mjs:124, "floor
     raised 10.5 -> 11"), `--fs-label` was clamp(11px, 0.74vw, 12px), and a
     12px assertion on this one page would have held it to a standard no other
     page met. It even measured the four counts that proved the point —
     superstress 35, /about/sources 40, /about/peers 15, /operate/node 15 —
     and recorded that a 12px floor reds all four.

     p4·02 acted on exactly that evidence instead of carrying it: the standing
     11-vs-12 conflict was adjudicated by VIEWPORT (12px below 720px, 11px
     above), `styles-legibility.css` now enforces it, and all four of those
     counts are 0. So the floor here is 12 with NO exemptions, and it is no
     longer a special standard for one page — `verify-mobile.mjs` holds every
     route to it.

     STILL SCOPED TO `.page-shell`, and the original reason survives the
     change: `#root` would sweep NavTop and the footer, which are site chrome
     this page does not own and which verify-mobile now covers site-wide.
     Scope is about SUBJECT here; it is not an exemption.
     NOT-MATCHED, unchanged: a floor is not contrast. */
  const small = await phone.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('.page-shell *')) {
      if (el.namespaceURI === 'http://www.w3.org/2000/svg') continue;
      if (el.classList && el.classList.contains('sr-only')) continue;
      const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).length;
      if (!own) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      const fs = parseFloat(cs.fontSize);
      if (fs < 11.99) out.push(`${el.tagName}.${el.className} ${fs}px "${el.textContent.trim().slice(0, 24)}"`);
    }
    return out;
  });
  R.ok(small.length === 0,
    `no HTML text below 12px at 390px (found ${small.length}) — no class exemptions`,
    small.slice(0, 5).join(' | '));

  /* NON-VACUITY for the check above: a `.page-shell` that never rendered
     would return zero findings and read as a clean pass. That is not
     hypothetical — a probe written while diagnosing this section used
     `waitUntil: 'domcontentloaded'`, measured `.page-shell` count 0, and
     reported "0 sub-12px nodes" for a page that had not been laid out yet.
     A false all-clear is worse than a red. */
  const shellNodes = await phone.evaluate(() => document.querySelectorAll('.page-shell *').length);
  R.ok(shellNodes > 50,
    `the 390px sweep had a rendered page to measure (${shellNodes} elements in .page-shell)`,
    'a zero here means every sub-12px finding above was measured against an empty container');

  /* The rows must still WORK at 390 — the media rule drops the meta chip, and
     a rule that dropped the trigger would pass every check above. */
  await phone.click(`[data-disclosure="${firstId}"] button`);
  const phoneOpen = await phone.evaluate((id) =>
    document.querySelector(`[data-disclosure="${id}"] button`).getAttribute('aria-expanded'), firstId);
  R.ok(phoneOpen === 'true', 'a row still opens at 390px');

  /* The meta chip is hidden at this width. That is only legitimate because
     the panel states the same fact in full — assert the replacement, not just
     the removal. */
  const needsLine = await phone.evaluate((id) => {
    const el = document.querySelector(`[data-app-needs="${id}"]`);
    return el ? el.innerText.trim() : '';
  }, 'monerospace');
  await phone.click('[data-disclosure="monerospace"] button');
  const needsAfter = await phone.evaluate((id) => {
    const el = document.querySelector(`[data-app-needs="${id}"]`);
    return el ? el.innerText.trim() : '';
  }, 'monerospace');
  R.ok(/Bitcoin/.test(needsAfter) && /Electrs/.test(needsAfter) && /Monero/.test(needsAfter),
    `the panel states prerequisites in FULL at 390px, where the chip is hidden ("${needsAfter || needsLine}")`);

  /* ══ §9 · reduced motion ═════════════════════════════════════════════ */
  R.group('§9 · reduced motion');

  const rm = await browser.newPage();
  await rm.emulateMedia({ reducedMotion: 'reduce' });
  await rm.route('**/api/feeds*', (r) => r.fulfill({ status: 500, body: '{}' }));
  await rm.goto(BASE + HUB, { waitUntil: 'networkidle' });
  const anims = await rm.evaluate(() =>
    (document.getAnimations ? document.getAnimations() : []).filter((a) => a.playState === 'running').length);
  R.ok(anims === 0, `zero running animations under reduced motion (active: ${anims})`);

  await rm.click(`[data-disclosure="${firstId}"] button`);
  const rmOpen = await rm.evaluate((id) => {
    const b = document.querySelector(`[data-disclosure="${id}"] button`);
    const p = document.getElementById(b.getAttribute('aria-controls'));
    return { expanded: b.getAttribute('aria-expanded'), chars: p.innerText.trim().length };
  }, firstId);
  R.ok(rmOpen.expanded === 'true' && rmOpen.chars > 100,
    `a row opens and loses NO information under reduced motion (${rmOpen.chars} chars)`,
    'the primitive animates no height at any preference, so the reduced-motion path and the default path are the same path');

  /* Degraded pulse — this page has ONE live element and it must name its own
     absence rather than print a number. Both phone and rm pages ran with the
     feed 500ing, so this reads a genuinely degraded render. */
  const degraded = await rm.evaluate(() => {
    const el = document.querySelector('[data-peer-pulse]');
    return el ? el.innerText : '';
  });
  R.ok(degraded.length > 0, 'the pulse block renders even with its feed dead');
  R.ok(!/★\s*\d/.test(degraded),
    `the degraded pulse prints no fabricated star count ("${degraded.replace(/\s+/g, ' ').slice(0, 80)}")`);
} catch (err) {
  R.ok(false, `gate crashed: ${err.message}\n${err.stack}`);
} finally {
  await browser.close();
}

process.exit(R.finish());
