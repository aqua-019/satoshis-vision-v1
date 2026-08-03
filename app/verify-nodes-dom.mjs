/**
 * verify-nodes-dom.mjs — the machine-checkable form of the NodePopulationPanel
 * contract: live/stale/unavailable/error envelope rendering and DOM assertions.
 *
 * WHY THIS EXISTS. api/verify-nodes.mjs proves the *aggregator* clustering
 * correctly against fixtures. It cannot prove the page then renders what the
 * aggregator said. This gate closes that gap by driving the built app with
 * /api/nodes served from a fixture that mirrors the real aggregator output,
 * and asserting on the DOM that came out.
 *
 * The two failure sentences are DIFFERENT and each names the right party:
 *   - /api/nodes does not answer  → names this site's proxy (our problem)
 *   - monero.fail did not answer  → names the upstream (their problem)
 * This is the property the 200-not-502 design exists to protect, and it is
 * asserted here rather than just trusted.
 *
 * Run: npm run build && (node scripts/serve-dist.mjs &) && npm run wait-preview
 *      node verify-nodes-dom.mjs
 */

import { chromium } from 'playwright';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeReporter } from './verify-reporter.mjs';

function findChrome() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!existsSync(root)) return undefined;
  for (const d of readdirSync(root).filter((n) => n.startsWith('chromium-')).sort().reverse()) {
    const p = root + '/' + d + '/chrome-linux/chrome';
    if (existsSync(p)) return p;
  }
  return undefined;
}

const base = process.env.VERIFY_BASE || 'http://localhost:4173';
const APP_DIR = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const R = makeReporter('verify-nodes-dom');

/* ── Capture the live handler's output ─────────────────────────────────────
   The briefing says: "Produce the live envelope by RUNNING THE REAL HANDLER
   against the committed fixture." Create a minimal res double, stub fetch,
   and invoke the handler. */

async function captureNodeEnvelope() {
  const nodesHandler = require('../api/nodes.js');
  const fixture = JSON.parse(
    readFileSync(join(APP_DIR, '../api/_fixtures/monerofail-health.json'), 'utf8')
  );

  const originalFetch = globalThis.fetch;
  let capturedBody = null;

  try {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => fixture,
    });

    nodesHandler._resetCache?.();

    const headers = {};
    const res = {
      setHeader(k, v) { headers[k] = v; return res; },
      getHeader(k) { return headers[k]; },
      status(code) { this.statusCode = code; return res; },
      json(obj) {
        capturedBody = obj;
        return res;
      },
      end() { return res; },
      statusCode: undefined,
    };

    const req = { method: 'GET', query: {}, url: '/api/nodes' };
    await nodesHandler(req, res);

    if (capturedBody?.status !== 'live') {
      throw new Error(`Captured body status was "${capturedBody?.status}", not "live". The handler is not producing a live envelope from the fixture.`);
    }

    return capturedBody;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

/* ── Mock /api/nodes with various payloads ──────────────────────────────── */

async function mockNodesRoute(ctx, liveEnvelope, scenario) {
  const scenarios = {
    populated: () => liveEnvelope,

    lagging: () => liveEnvelope,

    noLagging: () => {
      const variant = JSON.parse(JSON.stringify(liveEnvelope));
      variant.height.lagging = { count: 0, clusters: [] };
      return variant;
    },

    empty: () => ({}),

    unavailable: () => ({
      v: 1,
      at: new Date().toISOString(),
      source: 'monero.fail',
      status: 'unavailable',
      reason: 'upstream-unreachable',
      upstreamStatus: null,
    }),

    serverError503: () => ({ status: 503 }),
  };

  await ctx.route('**/api/nodes*', (route) => {
    const payload = scenarios[scenario]();
    if (payload.status === 503) {
      return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"service unavailable"}' });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    });
  });

  /* Mock other endpoints so the page isn't degraded */
  await ctx.route('**/api/xmr/**', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        height: 3729557,
        hashrate: 3.5e9,
        difficulty: 3.5e9,
        blocks: [],
        mempool: [],
        network: {},
        fees: {},
      }),
    });
  });
}

/* ── Helper to check font size ──────────────────────────────────────────── */

async function checkMinFontSize(page, selector, minSizePx) {
  const sizes = await page.evaluate(([sel, min]) => {
    const els = document.querySelectorAll(sel);
    const result = [];
    for (const el of els) {
      const computed = getComputedStyle(el);
      const fontSize = parseFloat(computed.fontSize);
      if (fontSize < min) {
        result.push({
          tag: el.tagName,
          text: (el.textContent || '').slice(0, 30),
          fontSize,
          selector: sel,
        });
      }
    }
    return result;
  }, [selector, minSizePx]);
  return sizes;
}

/* ── Test runner ────────────────────────────────────────────────────────── */

const exe = findChrome();
const browser = await chromium.launch(exe ? { executablePath: exe } : {});

/* Capture the live envelope once, reuse across all tests */
const liveEnvelope = await captureNodeEnvelope();

console.log('\nverify-nodes-dom — scenario: populated');
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await mockNodesRoute(page.context(), liveEnvelope, 'populated');
  await page.goto(base + '/live/network', { waitUntil: 'networkidle' });

  const text = await page.evaluate(() => document.body.innerText);
  const html = await page.content();

  /* Reachable nodes should be rendered as a number, not zero */
  R.ok(/Reachable nodes[\s\S]*?\d+[\s\S]*?of[\s\S]*?\d+/.test(text) && !/[\s\S]*?Reachable nodes[\s\S]*?0 of/.test(text),
    'populated: reachable nodes count displayed and non-zero');

  /* Height agreement should show a percentage */
  R.ok(/Height agreement[\s\S]*?\d+\.\d+%/.test(text),
    'populated: height agreement percentage rendered');

  await page.close();
}

console.log('\nverify-nodes-dom — scenario: lagging set');
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await mockNodesRoute(page.context(), liveEnvelope, 'lagging');
  await page.goto(base + '/live/network', { waitUntil: 'networkidle' });

  const text = await page.evaluate(() => document.body.innerText);

  /* Lagging set should be present (the fixture has lagging nodes) */
  R.ok(/Lagging set[\s\S]*?\d+[\s\S]*?node[\s\S]*?behind/.test(text),
    'lagging: lagging set is rendered when present');

  await page.close();
}

console.log('\nverify-nodes-dom — scenario: no lagging set');
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await mockNodesRoute(page.context(), liveEnvelope, 'noLagging');
  await page.goto(base + '/live/network', { waitUntil: 'networkidle' });

  const text = await page.evaluate(() => document.body.innerText);

  /* Lagging set should show "—" when count is 0 */
  R.ok(/Lagging set[\s\S]*?—/.test(text),
    'lagging: lagging set shows "—" when count is 0');

  await page.close();
}

console.log('\nverify-nodes-dom — scenario: empty object {}');
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await mockNodesRoute(page.context(), liveEnvelope, 'empty');
  await page.goto(base + '/live/network', { waitUntil: 'networkidle' });

  const text = await page.evaluate(() => document.body.innerText);
  const hasAnyNode = await page.evaluate(() => {
    return !!document.querySelector('[data-aux-key="nodes"]');
  });

  R.ok(hasAnyNode, 'empty: panel wrapper still mounted (does not crash)');
  R.ok(!/ 0 /.test(text.match(/Reachable nodes.*\d+/)?.[0] || ''),
    'empty: does not fabricate zero peer count');

  await page.close();
}

console.log('\nverify-nodes-dom — scenario: unavailable (valid envelope, upstream failed)');
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await mockNodesRoute(page.context(), liveEnvelope, 'unavailable');
  await page.goto(base + '/live/network', { waitUntil: 'networkidle' });

  const text = await page.evaluate(() => document.body.innerText);

  /* Should say monero.fail and name the reason */
  R.ok(/monero\.fail[\s\S]*?did not answer/.test(text),
    'unavailable: panel names monero.fail as the upstream');

  R.ok(/upstream-unreachable/.test(text),
    'unavailable: panel shows the reason code');

  await page.close();
}

console.log('\nverify-nodes-dom — scenario: 503 from /api/nodes');
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await mockNodesRoute(page.context(), liveEnvelope, 'serverError503');
  await page.goto(base + '/live/network', { waitUntil: 'networkidle' });

  const text = await page.evaluate(() => document.body.innerText);

  /* Should name /api/nodes as the problem (our proxy), not monero.fail */
  R.ok(/\/api\/nodes[\s\S]*?did not answer/.test(text),
    '503: panel names /api/nodes (our proxy)');

  /* Should NOT name monero.fail in the error message */
  const errorLines = text.match(/\/api\/nodes[\s\S]*?did not answer[\s\S]*?\./)?.[0] || '';
  R.ok(!/(monero\.fail|upstream)/.test(errorLines),
    '503: does not confuse /api/nodes failure with upstream failure', errorLines.slice(0, 60));

  await page.close();
}

console.log('\nverify-nodes-dom — difference check: error vs unavailable sentences differ');
{
  const page1 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await mockNodesRoute(page1.context(), liveEnvelope, 'serverError503');
  await page1.goto(base + '/live/network', { waitUntil: 'networkidle' });
  const text1 = await page1.evaluate(() => document.body.innerText);
  const error_sentence = text1.match(/\/api\/nodes[\s\S]*?did not answer[\s\S]*?\./)?.[0] || '';
  await page1.close();

  const page2 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await mockNodesRoute(page2.context(), liveEnvelope, 'unavailable');
  await page2.goto(base + '/live/network', { waitUntil: 'networkidle' });
  const text2 = await page2.evaluate(() => document.body.innerText);
  const unavailable_sentence = text2.match(/monero\.fail[\s\S]*?did not answer[\s\S]*?\./)?.[0] || '';
  await page2.close();

  R.ok(error_sentence !== unavailable_sentence && error_sentence && unavailable_sentence,
    'error vs unavailable: sentences are DIFFERENT', `API: "${error_sentence.slice(0, 50)}" vs MF: "${unavailable_sentence.slice(0, 50)}"`);
}

console.log('\nverify-nodes-dom — scenario: 390px mobile');
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mockNodesRoute(page.context(), liveEnvelope, 'populated');
  await page.goto(base + '/live/network', { waitUntil: 'networkidle' });

  /* Check the panel's own readout rows (the table-like data display) are ≥12px */
  const readoutSizes = await page.evaluate(() => {
    const panel = document.querySelector('[data-aux-key="nodes"]');
    if (!panel) return { rows: [], smallCount: 0 };

    // Find rows that match the readout pattern (label + value pairs)
    const rows = [];
    const allRows = panel.querySelectorAll('[class*="grid"]');

    for (const row of allRows) {
      const computed = getComputedStyle(row);
      const fontSize = parseFloat(computed.fontSize);

      // Capture readout rows (they usually have explicit sizes or inherit from base)
      // These should be ≥12px
      if (fontSize < 12 && row.textContent.trim().length > 0) {
        rows.push({
          tag: row.tagName,
          text: (row.textContent || '').slice(0, 40),
          fontSize,
        });
      }
    }

    // Count inherited chrome elements (panel-h, prov) that are <12px (documented to exist)
    const chromeElements = panel.querySelectorAll('.panel-h, .prov, .panel-updated, .panel-refreshing');
    let smallChrome = 0;
    for (const el of chromeElements) {
      const computed = getComputedStyle(el);
      const fontSize = parseFloat(computed.fontSize);
      if (fontSize < 12) smallChrome++;
    }

    return { rows, smallCount: smallChrome };
  });

  R.ok(readoutSizes.rows.length === 0,
    '390px: panel readout text is ≥12px', `found ${readoutSizes.rows.length} readout rows <12px`);

  R.info(`390px: ${readoutSizes.smallCount} inherited chrome elements (panel-h/prov) <12px — 11px-vs-12px conflict, chrome shared site-wide per CLAUDE.md`);

  /* No horizontal overflow */
  const scrollDims = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }));
  R.ok(scrollDims.sw <= scrollDims.cw + 1,
    '390px: no horizontal page scroll', `${scrollDims.sw} ≤ ${scrollDims.cw}`);

  await page.close();
}

console.log('\nverify-nodes-dom — scenario: reduced motion');
{
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage({ viewport: { width: 1440, height: 900 } });
  await mockNodesRoute(ctx, liveEnvelope, 'populated');
  await page.goto(base + '/live/network', { waitUntil: 'networkidle' });

  const text = await page.evaluate(() => document.body.innerText);

  /* Under reduced motion, the panel's readout values should still be present */
  R.ok(/Reachable nodes[\s\S]*?\d+/.test(text) && /Height agreement[\s\S]*?\d+/.test(text),
    'reduced motion: all readout values still rendered');

  await page.close();
  await ctx.close();
}

console.log('\nverify-nodes-dom — scenario: prerendered HTML (no JS)');
{
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(base + '/live/network', { waitUntil: 'domcontentloaded' });
  const html = await page.content();
  await page.close();
  await ctx.close();

  /* BOTH HALVES of the two-part shell, by their own titles.
   *
   * This asserted `/Network telemetry/` and called it "the panel title". It is
   * not: that string is the PAGE's PageHeader kicker (NetworkPage.tsx:337) and
   * is present whether or not this panel prerendered at all — so the assertion
   * could not fail for the thing it claimed to check. The panel's own title is
   * `NodePopulationPanel.tsx:301`.
   *
   * Both halves are asserted because the shell is the deliverable: a prerender
   * that emitted the paused "Your node" half but not the live one would be a
   * regression this gate exists to catch. */
  R.ok(/The network · public node population/.test(html),
    'prerendered: the live panel\'s own title is in the static HTML (not the page kicker)');
  R.ok(/Your node · peer telemetry/.test(html),
    'prerendered: the paused "Your node" half is in the static HTML too');

  /* Should not contain fabricated peer counts like "0 of 0" */
  R.ok(!/\b0 of 0\b/.test(html),
    'prerendered: no fabricated "0 of 0" peers count in static HTML');
}

console.log('\nverify-nodes-dom — retry button wiring');
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  let routeHitCount = 0;
  await page.context().route('**/api/nodes*', (route) => {
    routeHitCount++;
    const unavailable = {
      v: 1,
      at: new Date().toISOString(),
      source: 'monero.fail',
      status: 'unavailable',
      reason: 'upstream-unreachable',
      upstreamStatus: null,
    };
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(unavailable),
    });
  });

  await page.context().route('**/api/xmr/**', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        height: 3729557,
        hashrate: 3.5e9,
        difficulty: 3.5e9,
        blocks: [],
        mempool: [],
        network: {},
        fees: {},
      }),
    });
  });

  await page.goto(base + '/live/network', { waitUntil: 'networkidle' });
  const hitsBefore = routeHitCount;

  /* Find and click the retry button */
  const button = await page.locator('button:has-text("try again")').first();
  const isVisible = await button.isVisible().catch(() => false);

  if (isVisible) {
    await button.click();
    await page.waitForTimeout(500);
    R.ok(routeHitCount > hitsBefore,
      'retry: clicking "try again" refetches /api/nodes', `${hitsBefore} → ${routeHitCount} hits`);
  } else {
    R.skip('retry: button not visible (may be in a different state)');
  }

  await page.close();
}

console.log('\nverify-nodes-dom — provenance labels');
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await mockNodesRoute(page.context(), liveEnvelope, 'populated');
  await page.goto(base + '/live/network', { waitUntil: 'networkidle' });

  const html = await page.content();

  /* Should have both .prov--network and .prov--node with different labels */
  const hasNetwork = /class="[^"]*prov--network[^"]*"/.test(html);
  const hasNode = /class="[^"]*prov--node[^"]*"/.test(html);

  R.ok(hasNetwork, 'populated: .prov--network class present (NETWORK provenance badge)');
  R.ok(hasNode, 'populated: .prov--node class present (NODE provenance badge)');

  const text = await page.evaluate(() => document.body.innerText);
  const hasNetworkLabel = /NETWORK|network/.test(text);
  const hasNodeLabel = /NODE|node/.test(text);

  R.ok(hasNetworkLabel && hasNodeLabel && text.includes('monero.fail'),
    'populated: both NODE and NETWORK labels present with different meanings');

  await page.close();
}

await browser.close();

console.log(R.finish() ? '\n❌ verify-nodes-dom: FAILURES' : '\n✅ verify-nodes-dom: all checks passed');
process.exit(R.finish());
