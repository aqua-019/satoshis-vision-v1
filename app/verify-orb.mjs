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
 * v6.1.9 added three more, because all four above are about what the orb SAYS
 * and the orb had stopped DRAWING without one of them noticing:
 *
 *   §5  the canvas backing store is sized to its box, above a parsed floor
 *   §6  and it actually paints — pixel counts and a PREDICTED bounding box
 *   §7  both of those again on the live cold-boot console, which is the one
 *       surface §1-§6 never render, and the one where the orb was broken
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
  makeReporter, launchChromium, BASE, PHONE,
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

/* ── the two numeric floors §5/§6 compare against, PARSED not restated ────
 * Same reasoning as §2's MIN_ORB_NODES/MAX_ORB_NODES parse below: a number
 * copied into a gate is a second definition kept in step by nothing, and this
 * file already records that lesson once. `ORB_RADIUS_FRAC` in particular is
 * not a threshold at all — it is the input to a PREDICTION (§6-B4 derives the
 * expected bounding box from it and SHELL), so restating it here would make
 * the gate agree with itself rather than with drawOrb.
 *
 * A failed parse yields NaN, and every comparison below is `>=`, which is
 * false for NaN — so this fails CLOSED. Asserted anyway, because a gate that
 * reds for "NaN" without saying why costs the next reader an hour. */
const orbNum = (name) => {
  const m = new RegExp(`export\\s+const\\s+${name}\\s*(?::[^=]*)?=\\s*([\\d.]+)`).exec(ORB_TS_SRC);
  return m ? Number(m[1]) : NaN;
};
const ORB_MIN_CANVAS_PX = orbNum('ORB_MIN_CANVAS_PX');
const ORB_RADIUS_FRAC = orbNum('ORB_RADIUS_FRAC');
R.ok(Number.isFinite(ORB_MIN_CANVAS_PX) && Number.isFinite(ORB_RADIUS_FRAC),
  `precondition: orb geometry constants parsed from orb.ts — ORB_MIN_CANVAS_PX=${ORB_MIN_CANVAS_PX}, ORB_RADIUS_FRAC=${ORB_RADIUS_FRAC}`,
  'Could not parse one of them. §5\'s canvas floor and §6\'s predicted bounding box would both compare ' +
  'against NaN — false for every input, so the sections red, but for the wrong reason.');

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
async function openHome(mocker, vp = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport: vp });
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

/* ══════════════════════════════════════════════════════════════════════
 * §5 · the canvas is SIZED to its box   ·   §6 · and it actually PAINTS
 * §7 · both of the above, on the live cold-boot console
 * ══════════════════════════════════════════════════════════════════════
 *
 * ── WHY THESE EXIST: 26 GREEN ASSERTIONS ABOVE, AND THE ORB DID NOT DRAW ──
 * Everything before this point checks what the orb SAYS — no hostname, an
 * honest empty state, an ILLUSTRATIVE badge, no geographic placement. Not one
 * asked whether the thing the component exists to do had happened. On
 * origin/main at 95316a3 it had not: in the cold-boot console the backing
 * store sat at 300x150, the untouched HTML default, and drawOrb painted into
 * a coordinate space that was never on screen.
 *
 * The gate-side cause is this file's own shape, and it is the standing family
 * inverted. `openHome()` is the only context factory above, and it calls
 * `coldBootOff(ctx)` — so the SUBJECT of all 26 assertions is the bypassed
 * Main Home, while their CLAIM reads as "the orb". Home's box is 538.9x468 and
 * the orb draws there perfectly. The one surface where it was broken is the
 * one surface this file had never rendered. A subject NARROWER than its claim
 * fails in exactly the same way as one that is wider: it passes for reasons
 * outside the claim.
 *
 * ── THE ORDER OF THE ASSERTIONS IS LOAD-BEARING ──────────────────────────
 * "the backing store is not 300x150" is the WEAKEST possible form of §5 and
 * it is deliberately last (A3) and never alone. Measured: raising the console
 * wrapper's maxWidth — an unrelated change landed in this same PR — widens the
 * pane, shortens the caption block, and flips the backing store from 300x150
 * to 490x25. A3 alone goes GREEN on a 25px letterbox strip. A0/A1/A2 all still
 * red. Do not "simplify" A0-A2 into A3.
 *
 * ── WHY THE BACKING STORE AND NOT A SCREENSHOT ───────────────────────────
 * `getImageData` reads what drawOrb issued. A screenshot reads what the
 * compositor produced, which during the console phase is a different question
 * with a different answer: the orb is a position:fixed sibling of ColdBoot's
 * root, and until this PR it painted UNDER that root's opaque #050505. A
 * pixel-diff route would have reported "does not paint" for a canvas that was
 * painting correctly. Same argument verify-coldboot.mjs:202-214 already makes
 * for toDataURL over element screenshots, one level stronger.
 *
 * SCOPE, stated because the labels must not outrun it: §5/§6 prove the BACKING
 * STORE contains a correctly-scaled orb. Whether a human sees it is a separate
 * claim with a separate subject — §7's Z1/Z2 are the only assertions here that
 * touch it, and they are scoped to the one occluder that was actually a
 * problem.
 *
 * ── MEASURED, ON THE FIXED TREE (4 contexts, used to set every floor) ─────
 *   context              store    painted        struct(a>=40)  dot(a>=120)  sbox
 *   home    1440 live    539x363  147469 (75.4%)  3709           98          407x363
 *   home    1440 unavail 539x363  147469 (75.4%)  3504            1          407x363
 *   home     390 live    334x162   29376 (54.3%)  1914           94          182x162
 *   console 1440 live    357x239   63933 (74.9%)  2525           99          269x239
 *   console 1440 unavail 357x239   63933 (74.9%)  2312            1          269x239
 *   console  390 live    288x212   50280 (82.4%)  2421           96          238x212
 *
 * `struct` normalised by min(W,H) spans 9.65-11.8 across all six; the floor is
 * 4x, i.e. 41% of the observed minimum. `dot` separates live from unavailable
 * by two orders of magnitude (94-99 against <=1), so its floor of 40 and
 * ceiling of 5 sit in an empty gap, not on a boundary.
 * `sbox` is NOT fitted: it is 2 * ORB_RADIUS_FRAC * SHELL[2] * min(W,H),
 * predicted from constants parsed out of orb.ts, and it lands within 2px in
 * all six rows (405.8 predicted vs 407; 237.0 vs 238).
 */

/** Layout box, backing store and alpha statistics — in ONE evaluate.
 *  Orb.tsx:452-454 redraws on every `seconds` tick at ORB_FPS 24 (~42ms), so
 *  sampling geometry and pixels in two calls can straddle a repaint and let
 *  them describe different frames. One task cannot be interrupted by a rAF. */
async function measureOrbCanvas(page) {
  return page.evaluate(() => {
    const orb = document.querySelector('[data-orb]');
    const c = orb && orb.querySelector('canvas');
    if (!orb || !c) return { found: false };
    const ob = orb.getBoundingClientRect();
    const W = c.width, H = c.height;
    const base = {
      found: true, W, H, cssW: c.clientWidth, cssH: c.clientHeight,
      dprCap: Math.min(window.devicePixelRatio || 1, 2),
      boxW: ob.width, boxH: ob.height,
      orbZ: getComputedStyle(orb).zIndex,
    };
    if (!W || !H) return { ...base, px: null };
    const d = c.getContext('2d').getImageData(0, 0, W, H).data;
    let painted = 0, struct = 0, dot = 0, maxA = 0;
    let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
    for (let i = 3, p = 0; i < d.length; i += 4, p++) {
      const a = d[i];
      if (a === 0) continue;
      painted++;
      if (a > maxA) maxA = a;
      if (a >= 120) dot++;
      if (a >= 40) {
        struct++;
        const x = p % W, y = (p / W) | 0;
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    return { ...base, px: {
      total: W * H, painted, struct, dot, maxA,
      sbox: x1 < 0 ? null : { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 },
    } };
  });
}

/** BOTH children of [data-orb] plus the splash phase, in ONE evaluate.
 *
 *  The caption block is located by the SAME literal §3 uses — the <span> whose
 *  trimmed text is exactly "ILLUSTRATIVE", walked up to whichever ancestor is a
 *  direct child of [data-orb] — so §3 and §7 cannot end up describing different
 *  nodes. One evaluate for the same reason measureOrbCanvas gives above: Orb.tsx
 *  redraws on a 24fps tick, and two calls can straddle a commit and report two
 *  different frames as though they were one.
 *
 *  Returns `found: false` rather than throwing when either child is missing, so
 *  O1 can say WHICH one was absent instead of the section dying with a
 *  TypeError that names nothing. */
async function readOrbComposition(page) {
  return page.evaluate(() => {
    const orb = document.querySelector('[data-orb]');
    const cv = orb && orb.querySelector('canvas');
    const wrap = cv ? cv.parentElement : null;
    let ov = orb
      ? [...orb.querySelectorAll('span')].find((s) => (s.textContent || '').trim() === 'ILLUSTRATIVE') || null
      : null;
    while (ov && ov.parentElement !== orb) ov = ov.parentElement;
    const cb = document.querySelector('[data-coldboot]');
    const phase = cb ? cb.getAttribute('data-coldboot') : null;
    if (!orb || !wrap || !ov) return { found: false, phase, wrapFound: !!wrap, ovFound: !!ov };
    const oS = getComputedStyle(ov);
    const r = ov.getBoundingClientRect();
    return {
      found: true, phase,
      distinct: wrap !== ov, wrapChild: wrap.parentElement === orb, ovChild: ov.parentElement === orb,
      orbOp: Number(getComputedStyle(orb).opacity),
      wrapOp: Number(getComputedStyle(wrap).opacity),
      ovOp: Number(oS.opacity),
      ovDisp: oS.display, ovVis: oS.visibility,
      ovChars: (ov.textContent || '').trim().length,
      ovW: Math.round(r.width), ovH: Math.round(r.height),
    };
  });
}

/** The two elements receive the SAME JS number from the SAME binding in the
 *  same render (Orb.tsx's `overlayAssembleStyle` reads `assembleStyle.opacity`),
 *  and getComputedStyle serialises the specified value rather than a
 *  compositor-quantised one — so the expected delta is EXACTLY 0. This is not
 *  headroom for noise; there is none. It is deliberately too tight to absorb a
 *  re-curve of one and not the other, because that should be taken
 *  deliberately, with this assertion going red first. */
const OPACITY_TOL = 0.005;

/** Flat, and DERIVED FROM NOTHING — this is where a wait bound goes wrong.
 *  `CB_HOLD_MS + EFFECTIVE_MS` (7055.6ms) looks like the answer and is a LOWER
 *  BOUND on when the console can appear, never an estimate of when it does:
 *  measured, the transition lands at (7083,7133] / (7108,7158] / (7106,7156]
 *  over three runs, short of that sum every time. Three lags, all additive and
 *  one-directional — the floor does not lift AT CB_HOLD_MS (1502/1621/1628
 *  against a declared 1500), the decrypt clock starts one rAF later with dt=0
 *  on that frame (ColdBoot.tsx), and t>=1 is tested at frame granularity. The
 *  dt clamp means a throttled machine widens the gap rather than closing it.
 *  15000 matches this file's own waits above, gives ~9.5s over a measured ~5.5s
 *  need, and needs no recomputation when the hold changes. */
const CONSOLE_WAIT_MS = 15000;

/** Everything drawOrb paints unconditionally is a circle centred on the canvas
 *  whose radius is a fixed multiple of ORB_RADIUS_FRAC * min(w,h) (orb.ts's
 *  `R`). The outermost is the i2p shell at SHELL[2]. Both constants are parsed
 *  from orb.ts above, so this PREDICTS the extent rather than remembering it —
 *  change the source and the expectation follows. Clamped per axis because the
 *  circle is cropped by whichever side is shorter. */
function orbExpect(W, H) {
  const span = 2 * ORB_RADIUS_FRAC * shellReal[2] * Math.min(W, H);
  return { span, w: Math.min(span, W), h: Math.min(span, H) };
}

const STRUCT_FLOOR = (m) => Math.round(4 * Math.min(m.W, m.H));
const DOT_FLOOR = 40;      // measured 94-99 with a live census
const DOT_CEILING = 5;     // measured 0-1 with none

/** The §5 + §6 body, run identically in every context. One function, so no
 *  two contexts can drift into asserting different things under one heading. */
function assertOrbCanvas(name, m, { census }) {
  R.ok(m.found, `${name}: precondition — [data-orb] canvas located`,
    m.found ? '' : 'no [data-orb] canvas in the DOM; every number below would be undefined, not zero');
  if (!m.found) return;

  /* ── §5 · sized to its box ── */
  R.ok(m.cssH >= ORB_MIN_CANVAS_PX,
    `${name}: the canvas box clears the ORB_MIN_CANVAS_PX floor — ${m.cssH}px CSS height, need >=${ORB_MIN_CANVAS_PX} (box ${m.boxW.toFixed(1)}x${m.boxH.toFixed(1)})`,
    m.cssH >= ORB_MIN_CANVAS_PX
      ? ''
      : `The canvas has ${m.cssH} CSS px inside a ${m.boxH.toFixed(1)}px orb box. Orb.tsx's OVERLAY_STYLE ` +
        'is flex:"0 0 auto" and cannot shrink; CANVAS_WRAP_STYLE is flex:"1 1 auto" and can. If the host ' +
        'box is shorter than the badge/caption block, the canvas gets what is left, which is nothing. ' +
        'Fix the host box or the overlay — not this number.');

  const wantW = Math.round(m.cssW * m.dprCap), wantH = Math.round(m.cssH * m.dprCap);
  const sized = Math.abs(m.W - wantW) <= 1 && Math.abs(m.H - wantH) <= 1;
  R.ok(sized,
    `${name}: backing store tracks its CSS box — ${m.W}x${m.H} for ${m.cssW}x${m.cssH} @${m.dprCap}x (want ${wantW}x${wantH})`,
    sized ? '' :
      `Store is ${m.W}x${m.H}; the box asks for ${wantW}x${wantH}. Orb.tsx's resize() is the ONLY writer of ` +
      'canvas.width/height and it returns early on a zero dimension, so a store that never matched its box ' +
      'means resize() has never once completed for this canvas.');

  R.ok(!(m.W === 300 && m.H === 150),
    `${name}: backing store is not the untouched HTML default 300x150`,
    m.W === 300 && m.H === 150
      ? 'The canvas has NEVER been sized. This is the weakest of the three checks above and the last to ' +
        'fire — a 490x25 letterbox strip passes it. Read the two above first.'
      : '');

  /* ── §6 · and it paints ── */
  if (!m.px) {
    R.ok(false, `${name}: precondition — a non-empty backing store to read`,
      'zero-area store; getImageData was never called, so the counts below are absent, not zero');
    return;
  }
  const p = m.px, e = orbExpect(m.W, m.H);

  R.ok(p.painted > 0 && p.maxA >= 40,
    `${name}: the canvas is painted — ${p.painted}/${p.total} px carry alpha (${(100 * p.painted / p.total).toFixed(1)}%), peak alpha ${p.maxA}`,
    p.painted === 0
      ? 'ZERO painted pixels. The store was sized but drawOrb never ran, or ran and returned at its own ' +
        '`if (w <= 0 || h <= 0)` guard.'
      : `peak alpha ${p.maxA} is below any stroked circle — only the radial glow reached the buffer.`);

  const floor = STRUCT_FLOOR(m);
  R.ok(p.struct >= floor,
    `${name}: ${p.struct} structural px (alpha>=40: equator ring + tor/i2p shells + graticule), need >=${floor}`,
    p.struct >= floor
      ? ''
      : `Only ${p.struct} px above the glow's alpha ceiling. drawOrb issues its ring, both shells and the ` +
        'graticule unconditionally — independent of the census — so this is low even for an orb with no data.');

  if (p.sbox) {
    const cx = (p.sbox.x0 + p.sbox.x1) / 2, cy = (p.sbox.y0 + p.sbox.y1) / 2;
    const offX = Math.abs(cx - m.W / 2), offY = Math.abs(cy - m.H / 2);
    const centred = offX <= Math.max(2, 0.03 * m.W) && offY <= Math.max(2, 0.03 * m.H);
    R.ok(centred,
      `${name}: the painting is centred — structural centroid ${cx.toFixed(0)},${cy.toFixed(0)} vs canvas centre ${(m.W / 2).toFixed(0)},${(m.H / 2).toFixed(0)} (off ${offX.toFixed(1)},${offY.toFixed(1)}px)`,
      centred ? '' :
        'drawOrb centres every unconditional circle on the canvas. An off-centre bounding box means the dpr ' +
        'it derives from ctx.canvas.width disagrees with the store — i.e. width was set by someone else.');

    const spans = p.sbox.w >= 0.95 * e.w && p.sbox.h >= 0.95 * e.h;
    R.ok(spans,
      `${name}: the orb spans its canvas — structural bbox ${p.sbox.w}x${p.sbox.h} against ${e.w.toFixed(0)}x${e.h.toFixed(0)} predicted by 2*ORB_RADIUS_FRAC*SHELL[2]*min(W,H) (need >=95%)`,
      spans ? '' :
        `The painting occupies ${p.sbox.w}x${p.sbox.h} of a ${m.W}x${m.H} store where the i2p shell alone ` +
        `should reach ${e.w.toFixed(0)}x${e.h.toFixed(0)}. A small centred blob in a large buffer is what a ` +
        'stale dpr or a stretched CSS box looks like.');
  } else {
    R.ok(false, `${name}: a structural bounding box exists to measure`,
      'no pixel reached alpha 40 — the centring and extent checks have no subject');
  }

  /* Two polarities on the SAME metric. Each is the other's vacuity guard:
     a permanently-blank canvas fails the live floor, and a canvas that draws
     dots from nothing fails the empty ceiling. */
  if (census === 'live') {
    R.ok(p.dot >= DOT_FLOOR,
      `${name}: the real lattice reaches the backing store — ${p.dot} px at dot alpha (>=120), need >=${DOT_FLOOR}`,
      p.dot >= DOT_FLOOR ? '' :
        'The caption claims an N-point sample and the buffer has no dots in it. §2 asserts the caption; this ' +
        'is the only assertion anywhere that the lattice is DRAWN.');
  } else {
    R.ok(p.dot <= DOT_CEILING,
      `${name}: no dot-alpha pixels when the census is unavailable — ${p.dot} px at alpha>=120, allow <=${DOT_CEILING}`,
      p.dot <= DOT_CEILING ? '' :
        `${p.dot} px at dot alpha with an empty lattice — something is drawing nodes that do not exist.`);
  }

  R.info(`${name}: box ${m.boxW.toFixed(0)}x${m.boxH.toFixed(0)} · css ${m.cssW}x${m.cssH} · store ${m.W}x${m.H} @${m.dprCap}x · painted ${p.painted} (${(100 * p.painted / p.total).toFixed(1)}%) · struct ${p.struct} · dot ${p.dot} · maxA ${p.maxA} · sbox ${p.sbox ? `${p.sbox.w}x${p.sbox.h}` : 'none'}`);
}

R.group('── 5+6 · the orb canvas is sized to its box, and paints into it ──');
{
  const cases = [
    ['home 1440x900 · live census', mockNodesLive, { width: 1440, height: 900 }, 'live'],
    ['home 390x844 · live census', mockNodesLive, { width: PHONE.width, height: PHONE.height }, 'live'],
    ['home 1440x900 · no census', mockNodesUnavailable, { width: 1440, height: 900 }, 'none'],
  ];
  for (const [name, mocker, vp, census] of cases) {
    const { ctx, page } = await openHome(mocker, vp);
    await page.waitForTimeout(1200);
    assertOrbCanvas(name, await measureOrbCanvas(page), { census });
    await ctx.close();
  }
}

/* ── SELF-CHECKS · permanent companions, in this file's established idiom ──
 * Each injects a known violation and asserts the detector caught it, so the
 * claim ("the detector catches this") is true on every tree forever and can
 * run green in CI while still proving the detector is live.
 *
 * Injection and measurement happen inside ONE evaluate. Orb.tsx redraws on a
 * 24fps tick, so a repaint between two calls would undo the injection and turn
 * every one of these into a coin flip. */
R.group('── 5+6 SELF-CHECKS · the detectors are falsifiable ──────────────');
{
  const { ctx, page } = await openHome(mockNodesLive);
  await page.waitForTimeout(1200);

  const sc1 = await page.evaluate(() => {
    const c = document.querySelector('[data-orb] canvas');
    c.width = 300; c.height = 150;                       // the exact production symptom
    return { W: c.width, H: c.height, cssW: c.clientWidth, cssH: c.clientHeight,
             dprCap: Math.min(window.devicePixelRatio || 1, 2) };
  });
  const sc1Caught = !(Math.abs(sc1.W - Math.round(sc1.cssW * sc1.dprCap)) <= 1 &&
                      Math.abs(sc1.H - Math.round(sc1.cssH * sc1.dprCap)) <= 1) &&
                    sc1.W === 300 && sc1.H === 150;
  R.ok(sc1Caught,
    `SELF-CHECK: forcing the store back to 300x150 is caught by BOTH the tracks-its-box check and the ` +
    `named-default check (${sc1.W}x${sc1.H} against a ${sc1.cssW}x${sc1.cssH} box)`,
    sc1Caught ? '' : 'the injected default was NOT detected — §5 cannot be trusted on the real orb either');

  const sc2 = await page.evaluate(() => {
    const c = document.querySelector('[data-orb] canvas');
    const x = c.getContext('2d');
    x.clearRect(0, 0, c.width, c.height);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let painted = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i]) painted++;
    return { painted, total: d.length / 4 };
  });
  R.ok(sc2.painted === 0,
    `SELF-CHECK: a cleared backing store reads 0/${sc2.total} painted px — proves the paint check reads the ` +
    'buffer rather than reporting a constant',
    sc2.painted === 0 ? '' : `${sc2.painted} px survived clearRect — the probe is reading something else`);

  /* The one a naive "is anything painted?" check waves through, and the shape
     of the false green a widened console would have produced. */
  const sc3 = await page.evaluate(() => {
    const c = document.querySelector('[data-orb] canvas');
    const x = c.getContext('2d');
    x.clearRect(0, 0, c.width, c.height);
    x.fillStyle = 'rgba(255,122,26,1)';
    x.fillRect(2, 2, 6, 6);
    const W = c.width, H = c.height;
    const d = x.getImageData(0, 0, W, H).data;
    let painted = 0, struct = 0;
    let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
    for (let i = 3, p = 0; i < d.length; i += 4, p++) {
      if (!d[i]) continue;
      painted++;
      if (d[i] >= 40) {
        struct++;
        const px = p % W, py = (p / W) | 0;
        if (px < x0) x0 = px; if (px > x1) x1 = px;
        if (py < y0) y0 = py; if (py > y1) y1 = py;
      }
    }
    return { W, H, painted, struct, w: x1 - x0 + 1, h: y1 - y0 + 1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  });
  const e3 = orbExpect(sc3.W, sc3.H);
  const sc3Centred = Math.abs(sc3.cx - sc3.W / 2) <= Math.max(2, 0.03 * sc3.W) &&
                     Math.abs(sc3.cy - sc3.H / 2) <= Math.max(2, 0.03 * sc3.H);
  const sc3Spans = sc3.w >= 0.95 * e3.w && sc3.h >= 0.95 * e3.h;
  const sc3Struct = sc3.struct >= STRUCT_FLOOR({ W: sc3.W, H: sc3.H });
  R.ok(sc3.painted > 0 && !sc3Centred && !sc3Spans && !sc3Struct,
    `SELF-CHECK: a 6x6 blob in the corner IS painted (${sc3.painted} px) yet fails the structural floor ` +
    `(${sc3.struct} < ${STRUCT_FLOOR({ W: sc3.W, H: sc3.H })}), the centring check and the extent check — ` +
    'proves "it paints" is not satisfiable by any non-empty buffer',
    'a corner blob satisfied one of the shape checks — they do not discriminate a drawn orb from noise');

  /* The production mechanism itself, reproduced live: shrink the box until the
     unshrinkable overlay consumes it. This is the only companion that exercises
     the real failure path rather than a synthetic buffer size. */
  /* A STYLESHEET rule, not an inline style, and the reason is load-bearing:
     Orb.tsx writes `height` into [data-orb]'s inline style on every render and
     it re-renders on the 24fps `seconds` tick, so an injected inline height is
     overwritten within ~42ms. The first draft of this companion did exactly
     that and reported "the canvas did not collapse" against a tree where the
     mechanism was intact — a self-check that failed for a reason having
     nothing to do with what it claims to prove. `!important` in a stylesheet
     outranks an inline declaration, so this survives every re-render. */
  /* The height is DERIVED from the overlay actually rendered in this context,
     not picked. A fixed 120px was tried first and did not collapse anything:
     Home at 1440 renders a 97px overlay, so a 120px box still leaves the wrap
     15px. The console's overlay is 153.5px, which is why 160 starved it there
     and the same number would not starve it here. Setting the box to exactly
     the overlay's own height leaves `BASE_STYLE`'s 8px gap unpaid and the wrap
     with nothing, in every context, without knowing the number in advance. */
  const overlayH = await page.evaluate(
    () => document.querySelector('[data-orb]').lastElementChild.getBoundingClientRect().height,
  );
  await page.addStyleTag({
    content: `[data-orb] { height: ${Math.round(overlayH)}px !important; } ` +
             '[data-orb] > div:first-child { min-height: 0 !important; }',
  });
  const collapsed = await page.waitForFunction(
    () => document.querySelector('[data-orb] canvas').clientHeight === 0, { timeout: 3000 },
  ).then(() => true).catch(() => false);
  R.ok(collapsed,
    `SELF-CHECK: with ORB_MIN_CANVAS_PX defeated and the box forced to its own overlay's height ` +
    `(${Math.round(overlayH)}px), the canvas collapses to 0 CSS px — the production mechanism, reproduced ` +
    '(OVERLAY_STYLE cannot shrink, CANVAS_WRAP_STYLE could)',
    collapsed ? '' : 'the canvas did not collapse; the mechanism §5 guards against may have changed shape, ' +
                     'and its failure message now names the wrong cause');
  if (collapsed) {
    const after = await measureOrbCanvas(page);
    R.ok(after.cssH < ORB_MIN_CANVAS_PX,
      `SELF-CHECK: and the canvas-floor check catches that collapse (${after.cssH} < ${ORB_MIN_CANVAS_PX})`,
      after.cssH >= ORB_MIN_CANVAS_PX ? 'the floor check did not fire on a genuinely collapsed canvas' : '');
  }
  await ctx.close();
}

/* ══════════════════════════════════════════════════════════════════════
 * §7 · the same two claims, on the LIVE cold-boot console
 * ══════════════════════════════════════════════════════════════════════
 * Deliberately does NOT install the bypass — that is the entire point of the
 * section. verify-coldboot-live §1 runs FIRST in verify:e2e and is the
 * positive control that a cold context gets a splash at all; if it is green
 * and P1 here is red, suspect this context rather than the app. */
R.group('── 7 · sized and painting on the LIVE cold-boot console ─────────');
{
  const fmt = (r) => (r ? `${r.w.toFixed(0)}x${r.h.toFixed(0)}@(${r.x.toFixed(0)},${r.y.toFixed(0)})` : 'none');
  const SLOT = '[data-orb-slot="coldboot-console"]';

  for (const [name, vp] of [
    ['console 1440x900', { width: 1440, height: 900 }],
    ['console 390x844', { width: PHONE.width, height: PHONE.height }],
  ]) {
    const ctx = await browser.newContext({ viewport: vp });
    await mockNodesUnavailable(ctx);   // stated, not inherited from the network
    const page = await ctx.newPage();
    await page.goto(BASE + '/', { waitUntil: 'load' });

    const splash = await page.waitForSelector('[data-coldboot]', { timeout: 15000 })
      .then(() => true).catch(() => false);
    R.ok(splash, `${name}: precondition — a cold visit to / rendered the splash root`,
      splash ? '' : 'No [data-coldboot] after 15s. Everything below would measure Home while claiming to ' +
                    'measure the console — the exact inversion this section exists to close.');

    const ready = await page.waitForSelector('[data-coldboot-console="ready"]', { timeout: 25000 })
      .then(() => true).catch(() => false);
    R.ok(ready, `${name}: precondition — the console pane mounted (it is what publishes the orb rect)`,
      ready ? '' : 'the console never reported ready, so the orb was never handed a rect to sit on');

    const placed = await page.waitForFunction((s) => {
      const o = document.querySelector('[data-orb]'), sl = document.querySelector(s);
      if (!o || !sl) return false;
      const a = o.getBoundingClientRect(), b = sl.getBoundingClientRect();
      return b.height > 0 && Math.abs(a.top - b.top) <= 1 && Math.abs(a.height - b.height) <= 1;
    }, SLOT, { timeout: 15000 }).then(() => true).catch(() => false);

    const rects = await page.evaluate((s) => {
      const pick = (r) => (r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null);
      const o = document.querySelector('[data-orb]');
      return {
        orb: pick(o && o.getBoundingClientRect()),
        slot: pick(document.querySelector(s)?.getBoundingClientRect()),
        hm: pick(document.getElementById('hm-orb')?.getBoundingClientRect()),
      };
    }, SLOT);

    const onSlot = placed && rects.slot && rects.orb &&
      ['x', 'y', 'w', 'h'].every((k) => Math.abs(rects.orb[k] - rects.slot[k]) <= 1);
    R.ok(onSlot,
      `${name}: precondition — [data-orb] is placed on the console slot (orb ${fmt(rects.orb)} vs slot ${fmt(rects.slot)})`,
      onSlot ? '' :
        'Orb.tsx falls back to Home\'s #hm-orb whenever the cold-boot rect is null or inactive, so this is the ' +
        'difference between measuring the console slot and measuring Home\'s 52vh box.');

    /* The precondition ON the precondition. Home is mounted underneath the
       splash the whole time, so #hm-orb exists here too — if the two candidate
       rects happened to coincide, the check above would be satisfied by the
       WRONG source and could not tell them apart. Prove they are separable. */
    const distinct = !!rects.hm && rects.orb &&
      (Math.abs(rects.hm.h - rects.orb.h) > 8 || Math.abs(rects.hm.y - rects.orb.y) > 8);
    R.ok(distinct,
      `${name}: …and Home's #hm-orb rect is distinguishable from it (#hm-orb ${fmt(rects.hm)}) — so the check above discriminates`,
      rects.hm === null
        ? '#hm-orb is absent under the splash, so the check above cannot tell "positioned by the console" from ' +
          '"positioned by a fallback that had nothing to fall back to" — it would pass either way.'
        : 'the two candidate rects coincide within 8px, so the check above is satisfied by both sources at once.');

    if (onSlot) {
      assertOrbCanvas(name, await measureOrbCanvas(page), { census: 'none' });

      /* ── O1-O5 · THE BADGE/CAPTION BLOCK FADES WITH THE ORB ──────────────
       *
       * Orb.tsx renders two children under [data-orb]: a canvas wrap and a
       * badge/caption overlay. v6.1.9 gave the `assemble` fade to the wrap
       * ONLY, so the overlay painted at full strength over the decrypt field
       * from the instant the anti-flash floor lifted — measured on 63dc1a8 at
       * 1440x900, a 402.4x109px block of NETWORK/ILLUSTRATIVE/DANDELION++ text
       * for 5514ms, 4708ms of it with its own canvas at 0.
       *
       * ── WHY HERE, AND NOT IN §1-§6 OR IN verify-coldboot-live ────────────
       * §1-§6 build their context through openHome() (:219), which calls
       * coldBootOff(ctx). With the splash bypassed `coldBootOrb.active` is
       * false, Orb.tsx pins `assemble` to 1, and every opacity is 1 BY
       * CONSTRUCTION — an equality check there compares 1 against 1 and prints
       * green on a tree with the defect fully present. That is instance 13 of
       * this repo's standing family, and it is how the defect shipped past 104
       * green assertions in this file. §7 is the section v6.1.9 added for
       * exactly that reason: it does NOT install the bypass, and its existing
       * read point was measured standing inside the defect's window — phase
       * "decrypt", wrap opacity 0, overlay opacity 1, at 1676/1729/2169ms from
       * __xmriCbT0 over three runs, against `assemble` first moving at ~6250ms.
       * 4.1-4.6s of headroom, so this needs no sampler and no derived window.
       *
       * The prompt for this change placed it in verify-coldboot-live.mjs. That
       * gate runs FIRST and its own header calls fail-fast free there because
       * it is "one navigation and one count"; a ~6.4s sampled assertion would
       * have cost it that, and Orb is its own React.lazy chunk (App.tsx:73), so
       * a late arrival would red a CORRECT tree in gate #1 and abort 28 others.
       * Here `onSlot` above is already a hard R.ok proving that chunk resolved
       * AND that the orb took the console's rect rather than Home's #hm-orb —
       * a better precondition than that gate would have had to invent — and a
       * regression costs verify-vitals alone. */
      const mid = await readOrbComposition(page);

      R.ok(mid.found,
        `${name}: O1 precondition — [data-orb] holds a canvas wrap AND a caption block carrying the ` +
        `ILLUSTRATIVE badge, located by the same literal §3 uses`,
        mid.found ? '' :
          `canvas wrap ${mid.wrapFound ? 'found' : 'ABSENT'}, caption block ${mid.ovFound ? 'found' : 'ABSENT'}. ` +
          'Every opacity below would be undefined rather than wrong, so this names which child went missing.');

      if (mid.found) {
        R.ok(mid.distinct && mid.wrapChild && mid.ovChild,
          `${name}: O1b precondition — they are two DISTINCT direct children of [data-orb] (which itself ` +
          `computes opacity ${mid.orbOp})`,
          `distinct=${mid.distinct} wrapChild=${mid.wrapChild} ovChild=${mid.ovChild}. If the two ever become ONE ` +
          'node the equality below is a tautology; if either gains an intermediate ancestor with its own opacity, ' +
          'equal computed values stop meaning equal rendered values.');

        const inWindow = mid.phase === 'decrypt' && mid.wrapOp === 0;
        R.ok(inWindow,
          `${name}: O2 DISCRIMINATOR — this read stands INSIDE the defect's window: phase "${mid.phase}", ` +
          `canvas wrap opacity ${mid.wrapOp}`,
          inWindow ? '' :
            `phase "${mid.phase}", wrap opacity ${mid.wrapOp}. O3 compares two opacities, and at the CONSOLE phase ` +
            'both read 1 and that comparison is trivially true while its label claims the decrypt. Measured, this ' +
            'read point lands at 1676-2169ms from __xmriCbT0 with the wrap at exactly 0.');

        const dOp = Math.abs(mid.ovOp - mid.wrapOp);
        R.ok(inWindow && dOp <= OPACITY_TOL,
          `${name}: O3 MID-DECRYPT — the badge/caption block carries the SAME opacity as its own canvas ` +
          `(caption ${mid.ovOp}, canvas ${mid.wrapOp}, |Δ| ${dOp.toFixed(4)}, tolerance ${OPACITY_TOL})`,
          !inWindow
            ? 'not inside the decrypt window — see O2. Red rather than absent, so this never vanishes from the tally.'
            : `The caption block is at opacity ${mid.ovOp} while its own canvas is at ${mid.wrapOp}, in a ` +
              `${mid.ovW}x${mid.ovH}px box over the decrypt field. Orb.tsx spends \`assemble\` on the canvas wrap ` +
              'alone. Give the overlay the SAME value, OPACITY ONLY: assembleStyle also carries transform:scale(), ' +
              "and [data-orb]'s own transform is what the #163 CLS fix depends on.");

        const rendered = mid.ovDisp !== 'none' && mid.ovVis === 'visible' && mid.ovChars > 0 && mid.ovH > 0;
        R.ok(inWindow && rendered,
          `${name}: O4 MID-DECRYPT — …and it is FADED, not REMOVED: display "${mid.ovDisp}", visibility ` +
          `"${mid.ovVis}", ${mid.ovChars} chars in a ${mid.ovW}x${mid.ovH}px box`,
          !inWindow ? 'not inside the decrypt window — see O2.'
            : "The fade must be OPACITY. These badges and captions are the orb's honesty claims and stay selectable " +
              'and in the accessibility tree at every value of assemble. display:none, visibility:hidden and a ' +
              'conditional render each remove them — and O3 goes GREEN on all three, because a node that is not ' +
              'rendered still reports whatever opacity was specified.');
      }

      /* ── Z1 · the raise itself. Reads z-index, so the phase does not matter.
         ColdBoot's root is position:fixed, z-index COLDBOOT_Z, opaque #050505.
         [data-orb] is a fixed SIBLING of it, so at z-index:auto it painted
         underneath — correct pixels, never seen. */
      const z = await page.evaluate(() => ({
        orbZ: getComputedStyle(document.querySelector('[data-orb]')).zIndex,
        rootZ: getComputedStyle(document.querySelector('[data-coldboot]')).zIndex,
      }));
      const raised = Number(z.orbZ) > Number(z.rootZ);
      R.ok(raised,
        `${name}: Z1 — the orb is stacked above the splash root (z-index ${z.orbZ} against the root's ${z.rootZ})`,
        raised ? '' :
          `orb z-index ${z.orbZ}, splash root ${z.rootZ}. The root paints an OPAQUE #050505 over the whole ` +
          'viewport, so at a lower or auto z-index the orb is invisible for the entire console phase no ' +
          'matter how correctly it is sized or drawn.');

      /* ── THE CONSOLE PHASE · O5 and Z2 ──────────────────────────────────── */
      const reached = await page.waitForFunction(
        () => document.querySelector('[data-coldboot]')?.getAttribute('data-coldboot') === 'console',
        undefined, { timeout: CONSOLE_WAIT_MS },
      ).then(() => true).catch(() => false);
      R.ok(reached,
        `${name}: O5a precondition — the run reached the console phase within ${CONSOLE_WAIT_MS}ms ` +
        '(measured need from the read point above: ~4.9-5.5s)',
        reached ? '' : 'the decrypt never resolved, so the positive control and Z2 below have no subject.');

      if (reached) {
        const con = await readOrbComposition(page);
        const ended = con.found && con.ovOp >= 0.99 && con.wrapOp >= 0.99 &&
          con.ovDisp !== 'none' && con.ovVis === 'visible' && con.ovChars > 0 && con.ovH > 0;
        R.ok(ended,
          `${name}: O5 POSITIVE CONTROL — at the console phase BOTH read 1 and the caption is really on screen ` +
          `(caption ${con.ovOp}, canvas ${con.wrapOp}, ${con.ovChars} chars in a ${con.ovW}x${con.ovH}px box)`,
          ended ? '' :
            'This is what stops O3 being satisfied by DELETING the caption: an overlay pinned to opacity 0 makes the ' +
            'mid-decrypt delta exactly 0 and O3 green, while the finished console silently loses its provenance ' +
            'badges and both captions. The fade must END at 1. No inView guard here on purpose — computed opacity, ' +
            'display, visibility and box size all read correctly below the fold; only elementFromPoint does not.');

        /* ── Z2 · MOVED HERE, AND RELABELLED. Instance FOURTEEN of the standing
           family, found while writing O1-O5 and pre-existing on 63dc1a8.
           `elementFromPoint` ignores opacity at EVERY value, so it measures
           hit-testing — z-order — and never visibility. It used to run at the
           mid-decrypt read point above, where the canvas wrap is at opacity 0:
           measured three for three `hitIsOrbCanvas: true` over a COMPLETELY
           INVISIBLE orb, at BOTH viewports — not one viewport plus a skip, which
           is how it was first recorded — under a label reading "the compositor
           agrees". The Issue-1 fix makes the caption transparent there too, so
           leaving it would have widened the overclaim rather than inherited it.
           Two edits, and they are not alternatives: run it where the assemble
           chain is independently 1 (here), AND say what the probe actually
           measures (below). */
        const z2 = await page.evaluate(() => {
          const orb = document.querySelector('[data-orb]');
          const cv = orb.querySelector('canvas');
          const b = cv.getBoundingClientRect();
          const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
          const inView = cx >= 0 && cy >= 0 && cx <= window.innerWidth && cy <= window.innerHeight;
          const hit = inView ? document.elementFromPoint(cx, cy) : null;
          const cons = document.querySelector('[data-coldboot-console]');
          return {
            inView, hitIsOrbCanvas: hit === cv, hitInColdboot: !!(hit && hit.closest('[data-coldboot]')),
            consoleH: cons ? Math.round(cons.getBoundingClientRect().height) : 0,
            vh: window.innerHeight,
          };
        });
        if (z2.inView) {
          R.ok(z2.hitIsOrbCanvas && !z2.hitInColdboot,
            `${name}: Z2 — the orb WINS HIT-TESTING at its own canvas centre, at the console phase where the ` +
            'assemble chain is independently 1 (z-order; elementFromPoint ignores opacity at every value, so this ' +
            'is not by itself a claim that anything is visible)',
            z2.hitIsOrbCanvas ? '' :
              "the topmost element at the orb canvas's own centre is inside [data-coldboot], which is the opaque " +
              'overlay. The orb is behind it.');
        } else {
          /* UNREACHABLE AT BOTH OF THIS SECTION'S VIEWPORTS, AND KEPT ANYWAY.
             Measured: the console is 796px in an 844px viewport at 390x844, so
             the orb's centre is in view and the assertion above runs — at 390 as
             well as at 1440. This branch has been dead since #163 brought the
             phone console down from 2282.6px, which is BEFORE the work that
             moved Z2; nothing here retired it.
             It is kept because §7's viewport list is not a law, and a future
             viewport where the console does not fit would otherwise let Z2
             silently hit-test an element below the fold. Every number in the
             message is interpolated rather than restated, so if it ever does
             fire it reports the layout it actually found — the previous wording
             hard-coded 2282.6px and a clipping mechanism (`overflow:hidden`)
             that `gridStyle` replaced with `overflowY:"auto"` in the same
             release, and stayed on the page describing neither. */
          R.skip(`${name}: hit-test confirmation of the stacking order`,
            `the orb's centre is outside the viewport at this size, and elementFromPoint is viewport-relative. The ` +
            `console measures ${z2.consoleH}px against a ${z2.vh}px viewport. This guard is for a layout that does ` +
            'not currently occur at either of §7\'s viewports — at 390x844 the console fits (796px in 844) and the ' +
            'assertion runs there rather than skipping — so seeing this at all means the console grew or the ' +
            'viewport list changed. Z1 above still ran; only the hit-test cross-check is unavailable.');
        }
      }
    }
    await ctx.close();
  }
}

await browser.close();
process.exit(R.finish());
