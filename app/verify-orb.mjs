#!/usr/bin/env node
/**
 * verify-orb.mjs — the network orb's own data tiers and geometry invariants.
 *
 * Everything else about the cold-boot orb is already covered elsewhere —
 * verify-coldboot-live.mjs holds the bypass positive control, and
 * verify-coldboot.mjs §4 proves the orb SURVIVES the Enter handoff (same
 * node, travels rather than collapsing). This file's whole scope is the four
 * honesty invariants XMRIRISH-20260803-15 §5 puts on the orb itself:
 *
 *   §1  no hostname anywhere in the orb or its DOM — both polarities
 *   §2  honest empty state — no numeric field when /api/nodes is unavailable
 *   §3  ILLUSTRATIVE badge on the Dandelion++ layer; no live badge on it
 *   §4  Tor/I2P orbit in shells; no node placed at a geographic location
 *
 * ── THE SELF-CHECK PATTERN, AND WHY THE SHIPPED GATE NEVER GOES RED ON A
 *    CORRECT TREE ─────────────────────────────────────────────────────────
 * §1, §3 and §4 assert an ABSENCE ("no hostname", "no live badge", "no
 * lat/lon"). An absence assertion that only ever runs against the real,
 * correct DOM/source cannot tell "genuinely absent" from "the detector is
 * broken and would never fire" — the exact vacuity this task keeps finding.
 * Two ways to prove a detector is falsifiable exist in this repo: run the
 * SAME assertion against a deliberately broken state and show it prints red
 * (a one-off transcript, captured in this task's own return), or embed the
 * broken state as a PERMANENT companion check whose own claim is "the
 * detector catches this" — which is TRUE forever, on every tree, so it can
 * stay in the gate and run green on every CI pass while still proving the
 * detector is live. This file does the latter throughout: every SELF-CHECK
 * below injects a known violation (via `page.evaluate` DOM mutation, or a
 * throwaway in-memory string for the static §4 checks — nothing on disk
 * changes either way) and then asserts the detector caught it. The one-off
 * red transcript proving the SAME phrasing goes red on the mutated state was
 * also run by hand during development; see this task's return for the actual
 * ❌ output.
 *
 * §2 needs no such trick — "no numbers when unavailable" and "numbers when
 * healthy" are both REAL branches of the shipped component, so both are
 * asserted directly against two real mocked application states.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
  makeReporter, launchChromium, BASE,
  coldBootOff, assertColdBootBypassed,
} from './verify-lib.mjs';

const APP = dirname(fileURLToPath(import.meta.url));
const R = makeReporter('verify-orb');

/* ══════════════════════════════════════════════════════════════════════
 * §4 (run first — offline, no browser needed) · SHELL geometry + no lat/lon
 * ══════════════════════════════════════════════════════════════════════
 *
 * Structural, per the brief: orb.ts exports SHELL = [1.00, 1.17, 1.30] and
 * carries no geographic placement anywhere. Read as text and checked with a
 * comment-stripped scan — a NAIVE `grep -i 'lat|lon'` finds SIX hits in this
 * file (measured), every one of them inside the comment block that explains
 * why the real identifiers are `ringAngle`/`meridianAngle` instead. A scan
 * that does not strip comments first would be fooled by the very prose
 * written to prevent the mistake it's checking for.
 */
R.group('── 4 · SHELL shells + no geographic placement (src/coldboot/orb.ts, static) ──');

const ORB_TS_PATH = join(APP, 'src/coldboot/orb.ts');
const ORB_TS_SRC = readFileSync(ORB_TS_PATH, 'utf8');

R.ok(ORB_TS_SRC.length > 0, `precondition: ${ORB_TS_PATH} read (${ORB_TS_SRC.length} bytes)`,
  ORB_TS_SRC.length === 0 ? 'empty file — nothing below could have been checked' : '');

/** Strips `/* … *\/` and `// …` before scanning for identifiers. No string
 *  literal in orb.ts contains `//` (checked by hand — the file has no URLs),
 *  so this is safe for this specific file; it is not a general-purpose
 *  TS/JS comment stripper and is not used as one anywhere else. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

function extractShell(src) {
  const m = /export\s+const\s+SHELL\s*:[^=]*=\s*\[([^\]]+)\]/.exec(src);
  if (!m) return null;
  return m[1].split(',').map((s) => Number(s.trim()));
}

function findLatLon(strippedSrc) {
  const re = /\b(lat|lon|latitude|longitude)\b/gi;
  const hits = [];
  let m;
  while ((m = re.exec(strippedSrc))) hits.push(m[0]);
  return hits;
}

const shellReal = extractShell(ORB_TS_SRC);
R.ok(shellReal !== null, 'precondition: SHELL constant found in orb.ts',
  shellReal === null ? 'no `export const SHELL = […]` match — the equality check below would compare against nothing' : '');

if (shellReal !== null) {
  const expected = [1.0, 1.17, 1.3];
  const matches = shellReal.length === expected.length && shellReal.every((v, i) => Math.abs(v - expected[i]) < 1e-9);
  R.ok(matches,
    `SHELL === [1.00, 1.17, 1.30] (clearnet on the sphere; Tor/I2P orbiting) — got [${shellReal.join(', ')}]`,
    matches ? '' : `got [${shellReal.join(', ')}] — a shell radius changed without this gate being updated`);
}

const strippedReal = stripComments(ORB_TS_SRC);
const rawHits = [...ORB_TS_SRC.matchAll(/\b(lat|lon|latitude|longitude)\b/gi)].map((m) => m[0]);
const latLonReal = findLatLon(strippedReal);
R.info(`raw (comment-INCLUDING) grep would report ${rawHits.length} hit(s): ${JSON.stringify(rawHits)} — all of them inside the header's own explanation of why they're avoided`);
R.ok(latLonReal.length === 0,
  `no lat/lon/latitude/longitude identifier OUTSIDE a comment in orb.ts (comment-stripped scan)`,
  latLonReal.length ? `found: ${JSON.stringify(latLonReal)}` : '');

/* SELF-CHECK — throwaway in-memory strings only; nothing on disk changes. */
const mutatedShellSrc = ORB_TS_SRC.replace(
  /export\s+const\s+SHELL\s*:[^=]*=\s*\[[^\]]+\]/,
  'export const SHELL: readonly [number, number, number] = [1.0, 2.0, 3.0]',
);
const mutatedShellVal = extractShell(mutatedShellSrc);
const mutatedShellWrong = mutatedShellVal !== null &&
  !(mutatedShellVal.length === 3 && Math.abs(mutatedShellVal[0] - 1.0) < 1e-9 && Math.abs(mutatedShellVal[1] - 1.17) < 1e-9 && Math.abs(mutatedShellVal[2] - 1.3) < 1e-9);
R.ok(mutatedShellWrong,
  `SELF-CHECK: a mutated SHELL=[1.0, 2.0, 3.0] is correctly detected as NOT [1.00, 1.17, 1.30] (proves the equality check is falsifiable)`);

const mutatedGeoSrc = ORB_TS_SRC + '\nconst lat = 51.5;\nconst lon = -0.1;\n';
const mutatedGeoHits = findLatLon(stripComments(mutatedGeoSrc));
R.ok(mutatedGeoHits.length > 0,
  `SELF-CHECK: injecting \`const lat =\` / \`const lon =\` is correctly detected by the comment-stripped scan (found ${JSON.stringify(mutatedGeoHits)}) — proves the scan is falsifiable`,
  mutatedGeoHits.length === 0 ? 'the scan missed an injected lat/lon identifier — it cannot be trusted on the real file either' : '');

/* ══════════════════════════════════════════════════════════════════════
 * Browser sections — §1, §2, §3
 * ══════════════════════════════════════════════════════════════════════ */

const { browser } = await launchChromium();

/* The live /api/nodes envelope — produced by RUNNING THE REAL HANDLER
 * against the committed fixture (same idiom as verify-cls.mjs), not
 * rebuilt or transcribed, so this gate cannot drift from what the handler
 * actually emits. */
const NODES_LIVE = await (async () => {
  const req = createRequire(import.meta.url);
  const handler = req('../api/nodes.js');
  const fixture = req('../api/_fixtures/monerofail-health.json');
  const captured = { body: null };
  const res = {
    setHeader() { return res; }, getHeader() { return undefined; },
    status() { return res; }, json(b) { captured.body = b; return res; }, end() { return res; },
  };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => fixture });
  try {
    handler._resetCache();
    await handler({ method: 'GET', query: {}, url: '/api/nodes' }, res);
  } finally {
    globalThis.fetch = realFetch;
  }
  if (!captured.body || captured.body.status !== 'live') {
    throw new Error(`verify-orb: /api/nodes mock did not produce a live envelope (got ${JSON.stringify(captured.body)?.slice(0, 120)})`);
  }
  return captured.body;
})();

/* The wire shape for `status: "unavailable"` — a literal matching
 * `NodePopulationUnavailable` (app/src/data/useNodePopulation.ts:106-113)
 * exactly: NO numeric fields at all, not zeroed ones. `reason` must be a
 * member of that file's NODE_REASONS set. */
const NODES_UNAVAILABLE = {
  v: 1,
  at: new Date().toISOString(),
  source: 'monero.fail',
  status: 'unavailable',
  reason: 'upstream-timeout',
  upstreamStatus: null,
};

async function mockNodesLive(ctx) {
  await ctx.route('**/api/nodes*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(NODES_LIVE) }));
}
async function mockNodesUnavailable(ctx) {
  await ctx.route('**/api/nodes*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(NODES_UNAVAILABLE) }));
}

/** Fresh Home context, splash bypassed, `[data-orb]` waited-for and its
 *  presence asserted (the precondition every section below depends on). */
async function openHome(mocker) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await coldBootOff(ctx);
  if (mocker) await mocker(ctx);
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await assertColdBootBypassed(page, R);
  await page.waitForSelector('[data-orb]', { timeout: 15000 });
  const count = await page.locator('[data-orb]').count();
  R.ok(count > 0, 'precondition: [data-orb] mounted on Home before measuring',
    count === 0 ? 'the orb never mounted — every assertion below would measure nothing' : '');
  return { ctx, page };
}

/* ══════════════════════════════════════════════════════════════════════
 * §1 · No hostname anywhere in the orb or its DOM — both polarities
 * ══════════════════════════════════════════════════════════════════════
 *
 * Sweeps [data-orb]'s subtree three ways: every text node, every
 * title/aria-label/data-* attribute value, and the serialized outerHTML.
 *
 * `style` is EXCLUDED from the outerHTML sweep, and this is a measured
 * necessity, not a loophole: the orb's own positioning rect renders as
 * `style="…left: 831.094px; top: 148.5px…"` — sub-pixel floats from
 * getBoundingClientRect() — and a generic "two labels joined by a dot"
 * hostname pattern matches "831.094px" as readily as it matches a real
 * onion address. Measured directly: the raw (unstripped) sweep against the
 * real orb reported 6 false positives, 100% of them CSS pixel values; the
 * style-stripped sweep against the identical DOM reported 0. `title` and
 * `aria-label` are still swept in full — they are the brief's named
 * attributes and neither carries geometry.
 *
 * `monero.fail` is explicitly allow-listed. It is the data-SOURCE
 * attribution this repo names everywhere as provenance copy (identical
 * string at NodePopulationPanel.tsx:304, SourcesPage.tsx, and twice more in
 * this very component — Orb.tsx:335,438) — not a reachable-node hostname.
 * api/nodes.js's own header says the endpoint returns aggregated data
 * "without republishing any hostnames"; that is what this sweep enforces,
 * and monero.fail (the census PROVIDER, not a census MEMBER) is outside it.
 */
R.group('── 1 · no hostname anywhere in the orb, both polarities ──────────');
{
  const { ctx, page } = await openHome(mockNodesLive);
  await page.waitForFunction(
    () => (document.querySelector('[data-orb]')?.textContent || '').includes('reachable nodes'),
    { timeout: 10000 },
  );

  async function sweepOrbHostnames(pg) {
    return pg.evaluate(() => {
      const ALLOW_RE = /\bmonero\.fail\b/gi;
      const PATTERNS = [
        ['dotted', /\b[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+\b/gi],
        ['port', /:\d{2,5}\b/g],
      ];
      function stripStyle(html) { return html.replace(/\sstyle="[^"]*"/gi, ' style="STRIPPED"'); }
      function sweep(str) {
        const clean = (str || '').replace(ALLOW_RE, ' ');
        const hits = [];
        for (const [name, re] of PATTERNS) {
          re.lastIndex = 0;
          let m;
          while ((m = re.exec(clean))) hits.push(`${name}:${m[0]}`);
        }
        return hits;
      }
      const root = document.querySelector('[data-orb]');
      if (!root) return { found: false };

      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let textCount = 0;
      const textHits = [];
      let n;
      // eslint-disable-next-line no-cond-assign
      while ((n = walker.nextNode())) { textCount++; textHits.push(...sweep(n.nodeValue)); }

      const all = [root, ...root.querySelectorAll('*')];
      let attrCount = 0;
      const attrHits = [];
      for (const el of all) {
        for (const attr of el.attributes) {
          if (attr.name === 'title' || attr.name === 'aria-label' || attr.name.indexOf('data-') === 0) {
            attrCount++;
            attrHits.push(...sweep(attr.value).map((h) => `${attr.name}=${h}`));
          }
        }
      }

      const html = stripStyle(root.outerHTML);
      const htmlHits = sweep(html);

      return {
        found: true, elementCount: all.length, textCount, attrCount,
        textHits, attrHits, htmlHits, totalHits: textHits.length + attrHits.length + htmlHits.length,
      };
    });
  }

  const before = await sweepOrbHostnames(page);
  R.ok(before.found && before.elementCount > 0,
    `precondition: swept a real orb subtree (${before.found ? before.elementCount : 0} elements, ${before.found ? before.textCount : 0} text nodes, ${before.found ? before.attrCount : 0} named attrs)`,
    !before.found || before.elementCount === 0 ? '[data-orb] not found or empty — nothing was swept' : '');

  R.ok(before.totalHits === 0,
    `POSITIVE: no hostname-shaped content anywhere in the real orb (0 of ${before.found ? before.textCount + before.attrCount + 1 : 0} sweep targets)`,
    before.totalHits ? `hits: ${JSON.stringify([...before.textHits, ...before.attrHits, ...before.htmlHits])}` : '');

  // SELF-CHECK — DOM injection is a PROBE, not a source mutation. Nothing on
  // disk changes; this only mutates the live page in this one throwaway context.
  await page.evaluate(() => {
    const root = document.querySelector('[data-orb]');
    const s = document.createElement('span');
    s.setAttribute('data-relay', '10.20.30.40');
    s.setAttribute('title', 'node7.example.onion:18081');
    s.textContent = 'reachable via relay.example.net';
    root.appendChild(s);
  });
  const after = await sweepOrbHostnames(page);
  const allHits = after.found ? [...after.textHits, ...after.attrHits, ...after.htmlHits] : [];
  R.ok(after.totalHits > 0,
    `SELF-CHECK: an injected hostname (IP in a data-* attr, onion:port in title, dotted name in text) is caught (${after.totalHits} hits: ${JSON.stringify(allHits)}) — proves the POSITIVE check above is falsifiable, not vacuous`,
    after.totalHits === 0 ? 'the injected violation was NOT detected — the sweep above cannot be trusted' : '');

  await ctx.close();
}

/* ══════════════════════════════════════════════════════════════════════
 * §2 · Honest empty state — no numeric field when unavailable
 * ══════════════════════════════════════════════════════════════════════
 *
 * Both real branches of useOrbData/useNodePopulation are exercised: the
 * wire's `status: "unavailable"` (NO numeric fields on the wire at all,
 * per useNodePopulation.ts's NodePopulationUnavailable) must render no
 * digit anywhere in the orb; a real healthy census must render the real
 * `counts.reachable` digit. Digits only ever enter [data-orb]'s text via
 * Orb.tsx's `reachableCaption()` — confirmed by reading every other string
 * rendered there (ILLUSTRATIVE badge, STEM_CAPTION, the five provenance
 * labels, the freshness suffixes) — none carry a digit.
 */
R.group('── 2 · honest empty state — no numeric field when unavailable ────');
{
  // §2a — unavailable: no digit anywhere in the orb.
  const { ctx, page } = await openHome(mockNodesUnavailable);
  const settled = await page.waitForSelector('[data-orb] .prov-fresh--error', { timeout: 10000 })
    .then(() => true).catch(() => false);
  R.ok(settled, 'precondition: the mocked unavailable census reached the client (badge shows "· unavailable")',
    settled ? '' : 'never settled to the error freshness state — the assertion below would measure a still-loading page, not the unavailable branch');

  if (settled) {
    const text = await page.evaluate(() => document.querySelector('[data-orb]').textContent || '');
    R.ok(!/\d/.test(text),
      'no digit-bearing readout anywhere in the orb when /api/nodes is unavailable',
      /\d/.test(text) ? `digit found in: "${text}"` : '');
  }
  await ctx.close();
}
{
  // §2b — healthy: the real reachable/lattice counts DO appear.
  const { ctx, page } = await openHome(mockNodesLive);
  const settled = await page.waitForFunction(
    () => (document.querySelector('[data-orb]')?.textContent || '').includes('reachable nodes'),
    { timeout: 10000 },
  ).then(() => true).catch(() => false);
  R.ok(settled, 'precondition: the mocked healthy census reached the client ("reachable nodes" text appeared)',
    settled ? '' : 'never settled — the "numbers DO appear" assertion below would prove nothing');

  if (settled) {
    const text = await page.evaluate(() => document.querySelector('[data-orb]').textContent || '');
    R.ok(/\d/.test(text),
      'a digit-bearing readout appears in the orb once the census is healthy (proves §2a is not testing a permanently-empty component)',
      /\d/.test(text) ? '' : `no digit found in: "${text}"`);

    const expectedReachable = NODES_LIVE.counts.reachable.toLocaleString();
    /* The clamp bounds are READ FROM orb.ts, not restated. They were a second
     * copy of a rule that already lives at orb.ts:135-136, and this file
     * already has that source in hand for §4 — so a literal here was a
     * duplication with nothing keeping the two in step. Detection did work
     * (changing MIN_ORB_NODES to 50 went red) but the message blamed the
     * caption for a constant. Same move as heightAgreementPct: drift made
     * impossible rather than detected. */
    const MIN_ORB = Number(/MIN_ORB_NODES\s*=\s*(\d+)/.exec(ORB_TS_SRC)?.[1]);
    const MAX_ORB = Number(/MAX_ORB_NODES\s*=\s*(\d+)/.exec(ORB_TS_SRC)?.[1]);
    R.ok(Number.isFinite(MIN_ORB) && Number.isFinite(MAX_ORB),
      `precondition: clamp bounds read from orb.ts (${MIN_ORB}-${MAX_ORB})`,
      'Could not parse MIN_ORB_NODES / MAX_ORB_NODES — the assertion below would compare against NaN.');

    /* THE PRECONDITION THAT WAS HELD BY LUCK.
     *
     * expectedLattice only tests orbNodeCount() when the fixture's reachable
     * count sits OUTSIDE the clamp band. Today it does — 23 against 40-320, so
     * expectedLattice is 40 and the derivation does real work.
     *
     * But monerofail-health.json is a captured upstream snapshot, and the
     * natural reason to refresh it is that monero.fail's data moved. The moment
     * a refreshed fixture lands with reachable anywhere in 40-320,
     * expectedLattice collapses to reachable, the clamp expression becomes an
     * identity, and this gate stops covering orbNodeCount() ENTIRELY while
     * staying green. Nothing announces it; nothing fails.
     *
     * So the precondition is asserted rather than assumed. */
    const reach = NODES_LIVE.counts.reachable;
    const exercisesClamp = reach < MIN_ORB || reach > MAX_ORB;
    R.ok(exercisesClamp,
      `precondition: the fixture exercises the clamp (reachable ${reach} is outside ${MIN_ORB}-${MAX_ORB})`,
      exercisesClamp ? '' :
        `A fixture INSIDE the band makes expectedLattice === reachable, so the clamp assertion below ` +
        `silently stops testing orbNodeCount() while still passing. Either pick a fixture outside ` +
        `${MIN_ORB}-${MAX_ORB} or add a second mocked census that is.`);

    const expectedLattice = Math.min(MAX_ORB, Math.max(MIN_ORB, Math.round(reach)));
    const expectedCaption = `${expectedReachable} reachable nodes`;
    R.ok(text.includes(expectedCaption),
      `caption shows the REAL reachable count from the mocked handler response (${expectedCaption})`,
      text.includes(expectedCaption) ? '' : `expected substring "${expectedCaption}" not found in: "${text}"`);
    R.ok(text.includes(`${expectedLattice}-point sample`),
      `caption shows the real lattice size derived from orb.ts's own clamp (${expectedLattice}-point sample)`,
      text.includes(`${expectedLattice}-point sample`) ? '' : `expected "${expectedLattice}-point sample" not found in: "${text}"`);
  }
  await ctx.close();
}

/* ══════════════════════════════════════════════════════════════════════
 * §3 · ILLUSTRATIVE badge on the Dandelion++ layer; no live badge on it
 * ══════════════════════════════════════════════════════════════════════
 *
 * Scoped to the badge row that actually holds the literal "ILLUSTRATIVE"
 * text plus its immediately-following caption `<p>` (Orb.tsx's second
 * BADGE_ROW_STYLE + STEM_CAPTION) — not the whole orb, and not the FIRST
 * badge row (the real NETWORK provenance badge, which legitimately shows a
 * live dot). Run under a HEALTHY mock deliberately: it guarantees a real
 * `.prov-dot` exists elsewhere in the orb (on the NETWORK badge), which is
 * the vacuity guard proving this scoped check isn't passing for free
 * because no live dot exists anywhere in the component to find.
 */
R.group('── 3 · ILLUSTRATIVE badge; no live badge on the Dandelion++ layer ─');
{
  const { ctx, page } = await openHome(mockNodesLive);
  await page.waitForFunction(
    () => (document.querySelector('[data-orb]')?.textContent || '').includes('reachable nodes'),
    { timeout: 10000 },
  );

  async function scanIllustrative(pg) {
    return pg.evaluate(() => {
      const root = document.querySelector('[data-orb]');
      if (!root) return { found: false };
      const spans = [...root.querySelectorAll('span')];
      const badge = spans.find((s) => s.textContent.trim() === 'ILLUSTRATIVE');
      const networkDot = !!root.querySelector('.prov--network')?.parentElement?.querySelector('.prov-dot');
      if (!badge) return { found: true, badgeFound: false, networkDot };
      const row = badge.parentElement;
      const caption = row.nextElementSibling;
      const scope = caption ? [row, caption] : [row];
      const scopeText = scope.map((el) => el.textContent).join(' ');
      const liveDot = scope.some((el) => el.querySelector('.prov-dot'));
      const liveWord = /\blive\b/i.test(scopeText);
      return { found: true, badgeFound: true, illustrativePresent: scopeText.includes('ILLUSTRATIVE'), liveDot, liveWord, networkDot };
    });
  }

  const before = await scanIllustrative(page);
  R.ok(before.found && before.badgeFound,
    'precondition: the ILLUSTRATIVE badge row was located in the orb',
    before.found && !before.badgeFound ? 'no span with text "ILLUSTRATIVE" found — nothing below was checked' : '');

  if (before.badgeFound) {
    R.ok(before.networkDot,
      'context check: the NETWORK badge elsewhere in the orb DOES show a live dot (proves the "no live badge on Dandelion++" check below is scoped, not vacuously true because no live dot exists anywhere)',
      before.networkDot ? '' : 'no live dot anywhere in the orb — the scoped check below would pass even with no scoping at all');

    R.ok(before.illustrativePresent, 'POSITIVE: the ILLUSTRATIVE badge text is present on the Dandelion++ row');
    R.ok(!before.liveDot, 'POSITIVE: no .prov-dot (live indicator) on the Dandelion++ row',
      before.liveDot ? 'a live dot renders on the illustrative layer — it would read as real-time data' : '');
    R.ok(!before.liveWord, 'POSITIVE: no "live" word anywhere on the Dandelion++ row',
      before.liveWord ? `scope text: "${before.scopeText}"` : '');

    // SELF-CHECK 1 — inject a live dot + "LIVE" word; prove detection catches it.
    await page.evaluate(() => {
      const root = document.querySelector('[data-orb]');
      const badge = [...root.querySelectorAll('span')].find((s) => s.textContent.trim() === 'ILLUSTRATIVE');
      const row = badge.parentElement;
      const dot = document.createElement('span');
      dot.className = 'prov-dot';
      row.appendChild(dot);
      const liveSpan = document.createElement('span');
      liveSpan.textContent = ' LIVE';
      row.appendChild(liveSpan);
    });
    const afterInject = await scanIllustrative(page);
    R.ok(afterInject.liveDot === true,
      'SELF-CHECK: an injected .prov-dot on the row is caught (proves the "no live dot" check is falsifiable)',
      afterInject.liveDot !== true ? 'the injected live dot was NOT detected' : '');
    R.ok(afterInject.liveWord === true,
      'SELF-CHECK: an injected "LIVE" word on the row is caught (proves the "no live word" check is falsifiable)',
      afterInject.liveWord !== true ? 'the injected "LIVE" word was NOT detected' : '');

    // SELF-CHECK 2 — remove the badge text; prove absence-detection works.
    await page.evaluate(() => {
      const root = document.querySelector('[data-orb]');
      const badge = [...root.querySelectorAll('span')].find((s) => s.textContent.trim() === 'ILLUSTRATIVE');
      badge.textContent = 'illustrative-removed';
    });
    const afterRemove = await scanIllustrative(page);
    R.ok(afterRemove.badgeFound === false,
      'SELF-CHECK: removing the ILLUSTRATIVE text is caught as the badge going missing (proves the presence check is falsifiable)',
      afterRemove.badgeFound !== false ? 'the removal was not detected' : '');
  }

  await ctx.close();
}

await browser.close();
process.exit(R.finish());
