// One-off probe (NOT part of the delivered suite): confirms the pre-fix build
// (commit daac4e8, parent of 1f5a3d6 "fix MultiLine gradient collision") fails
// the duplicate-<defs>-id gate on /markets, the way verify-gradients.mjs will
// gate it post-fix. Points at the pre-fix preview server on :4174.
import { chromium } from 'playwright';
import { existsSync, readdirSync } from 'node:fs';

function findChrome() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!existsSync(root)) return undefined;
  for (const d of readdirSync(root).filter((n) => n.startsWith('chromium-')).sort().reverse()) {
    const p = root + '/' + d + '/chrome-linux/chrome';
    if (existsSync(p)) return p;
  }
  return undefined;
}

const base = 'http://localhost:4174';
const b = await chromium.launch({ executablePath: findChrome() });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });

// Mock enough CoinGecko traffic that BOTH MultiLine instances on /markets
// (peer group + top-10 group) actually render with >1 series each.
const nowMs = Date.now();
function chartFor(seed) {
  const prices = Array.from({ length: 20 }, (_, i) => [nowMs - (20 - i) * 3600_000, 100 + seed * 7 + i * 3]);
  const volumes = prices.map(([t]) => [t, 1000]);
  return { prices, total_volumes: volumes };
}
function ohlc() {
  return Array.from({ length: 20 }, (_, i) => {
    const t = nowMs - (20 - i) * 3600_000, o = 300 + i, c = 302 + i;
    return [t, o, o + 4, o - 4, c];
  });
}
await p.route('**/api/coingecko**', (route) => {
  const url = route.request().url();
  const json = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  if (url.includes('ohlc')) return json(ohlc());
  if (url.includes('market_chart')) {
    const m = /coins%2F([a-z0-9-]+)%2Fmarket_chart|coins\/([a-z0-9-]+)\/market_chart/.exec(url);
    const id = (m && (m[1] || m[2])) || 'x';
    const seed = [...id].reduce((a, c) => a + c.charCodeAt(0), 0) % 11;
    return json(chartFor(seed));
  }
  if (url.includes('tickers')) return json({ tickers: [] });
  return route.abort();
});
await p.route('**/api/**', (route) => {
  if (route.request().url().includes('/api/coingecko')) return; // handled above
  return route.abort();
});

await p.goto(base + '/markets', { waitUntil: 'load' });
await p.waitForTimeout(2500);

const result = await p.evaluate(() => {
  // DOCUMENT-wide id collection — this is the actual gate (SVG id uniqueness
  // is a whole-document constraint; a per-<svg> scoped check would miss the
  // cross-chart collision entirely, since each offending instance defines a
  // LOCALLY-looking-fine "ml-grad-0..3" that only collides with its sibling
  // chart's own "ml-grad-0..3" once both are in the same document).
  const allIds = [...document.querySelectorAll('linearGradient[id]')].map((n) => n.id);
  const dupeIds = allIds.filter((id, i) => allIds.indexOf(id) !== i);

  const svgs = [...document.querySelectorAll('svg')];
  const perSvgMissing = [];
  for (const svg of svgs) {
    const fills = [...svg.querySelectorAll('[fill^="url(#"]')];
    for (const el of fills) {
      const m = /url\(#([^)]+)\)/.exec(el.getAttribute('fill') || '');
      if (m && !svg.querySelector(`#${CSS.escape(m[1])}`)) perSvgMissing.push(m[1]);
    }
  }
  return { totalIds: allIds.length, uniqueIds: new Set(allIds).size, dupeIds: [...new Set(dupeIds)], perSvgMissing };
});

console.log(JSON.stringify(result, null, 2));
const anyBad = result.dupeIds.length > 0 || result.perSvgMissing.length > 0;
console.log(anyBad ? '\n❌ pre-fix /markets DOES reproduce the duplicate-gradient bug (expected)' : '\n✅ pre-fix /markets did NOT reproduce the bug (unexpected)');
await b.close();
process.exit(anyBad ? 1 : 0);
