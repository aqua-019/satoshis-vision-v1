// verify-chart-legibility.mjs — v6.0.10 §2 · in-chart text, measured as rendered.
//
// The whole point of this gate is that the NOMINAL font size is not the thing
// the user sees. An `<svg viewBox="0 0 1000 320" width="100%">` rendered 358 CSS
// px wide paints `fontSize="9.5"` at 3.4 CSS px, because SVG font-size is in
// user units and the viewBox transform scales it like any other geometry. A
// static scan of the source would have passed the pre-v6.0.10 codebase — it had
// `fontSize="11"` in places — while the user was looking at 3.9px.
//
// So: measure. `getScreenCTM()` maps user space to CSS px exactly. Do NOT use
// getBoundingClientRect() on a <text> node — that returns the INK box, whose
// height depends on whether the string happens to contain a descender ("$389"
// has none, "Apr 9" does), so it under-reports by 20-35% inconsistently.
//
// Three assertions per surface, and the second and third matter as much as the
// first: raising the floor is what CREATES clipping and collision, so a gate
// that only checks the floor would greenlight a different mess.
//
//   1. FLOOR       — nothing renders below the threshold
//   2. CONTAINMENT — every label lies inside its own <svg>
//   3. COLLISION   — labels on the same baseline don't overlap
//
// Two tiers are reported separately, because the design delivers different
// guarantees and the gate should not claim more than that:
//   [data-chart]   — charts.tsx + already-1:1 SVGs. Floor is exact.
//   [data-diagram] — hand-placed artboards scaled by a capped k. Floor holds
//                    up to that cap; past it the diagram pans instead.

import { launch, newThemedPage, makeReporter, BASE } from './verify-lib.mjs';

// ── the charts need DATA, or there is nothing to measure ─────────────────────
// This sandbox has no egress to CoinGecko, so /markets and /network would render
// empty chart shells and the gate would pass vacuously. Serve deterministic
// synthetic history through the same-origin /api/coingecko proxy the app already
// uses. The VALUES are fake and only ever feed layout assertions — this gate
// measures type size and label collision, never correctness of the numbers, so
// mocking here does not weaken any claim the gate makes.
const T0 = 1_735_689_600_000; // fixed epoch: no Date.now(), so runs are reproducible
const DAY = 86_400_000;

function ohlc(n, base) {
  return Array.from({ length: n }, (_, i) => {
    const t = T0 - (n - 1 - i) * DAY;
    const o = base * (1 + 0.22 * Math.sin(i / 5));
    const c = base * (1 + 0.22 * Math.sin((i + 1) / 5));
    return [t, o, Math.max(o, c) * 1.03, Math.min(o, c) * 0.97, c];
  });
}
function chart(n, base) {
  const prices = Array.from({ length: n }, (_, i) =>
    [T0 - (n - 1 - i) * DAY, base * (1 + 0.3 * Math.sin(i / 4))]);
  return { prices, total_volumes: prices.map(([t], i) => [t, 4.2e8 + i * 1e6]) };
}
const TICKERS = {
  tickers: Array.from({ length: 12 }, (_, i) => ({
    market: { name: ['Kraken', 'KuCoin', 'Gate.io', 'TradeOgre', 'HTX', 'MEXC'][i % 6] },
    base: 'XMR', target: ['USDT', 'BTC', 'USD'][i % 3],
    converted_volume: { usd: 9_400_000 - i * 500_000 },
    bid_ask_spread_percentage: 0.08 + i * 0.14,
    trust_score: 'green',
  })),
};

async function mockMarketData(page) {
  // main (v6.0.9) moved group membership + ATH/ATL to an /api/markets
  // aggregator; without it the Markets page renders no chart at all and this
  // gate would have nothing to measure.
  await page.route('**/api/markets**', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      majors: ['bitcoin', 'ethereum', 'solana'].map((id, i) => ({
        id, symbol: ['btc', 'eth', 'sol'][i], name: id, price: 60000 / (i + 1),
        change24h: 1.2 - i, marketCap: 1.2e12 / (i + 1), rank: i + 1,
      })),
      privacy: ['monero', 'zcash', 'dash'].map((id, i) => ({
        id, symbol: ['xmr', 'zec', 'dash'][i], name: id, price: 168 / (i + 1),
        change24h: 0.8 - i, marketCap: 3.1e9 / (i + 1), rank: 40 + i,
      })),
      ath: { price: 542.33, date: '2018-01-09' },
      atl: { price: 0.21, date: '2015-01-14' },
    }),
  }));
  await page.route('**/api/coingecko**', (route) => {
    const url = route.request().url();
    const json = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (url.includes('ohlc')) return json(ohlc(60, 168));
    if (url.includes('market_chart')) return json(chart(60, url.includes('vs_currency=btc') ? 0.0016 : 168));
    if (url.includes('tickers')) return json(TICKERS);
    return json({});
  });
}

const R = makeReporter('verify-chart-legibility');
const { browser, engine } = await launch();
console.log('engine:', engine);

const PASSES = [
  { name: '390', width: 390, height: 844, floor: 12 },   // §7.2 — 12px on mobile
  { name: '1440', width: 1440, height: 900, floor: 11 }, // §7.2 — 11px anywhere
];

const ROUTES = [
  '/markets',
  '/network',
  '/mempool',
  '/monero/tech',
  '/simulate?p=decoy',
  '/simulate?p=dandelion',
  '/simulate?p=ringct',
  '/simulate?p=fcmp',
  '/simulate?p=bloodhound',
  '/simulate?p=skyline',
];

/** Everything the three assertions need, measured in one page-side pass. */
const PROBE = () => {
  const out = [];
  for (const svg of document.querySelectorAll('svg[data-chart], svg[data-diagram]')) {
    const tier = svg.hasAttribute('data-chart') ? 'chart' : 'diagram';
    const svgBox = svg.getBoundingClientRect();
    const texts = [];
    for (const t of svg.querySelectorAll('text')) {
      if (t.hasAttribute('data-decorative') || t.closest('[data-decorative]')) continue;
      const s = (t.textContent || '').trim();
      if (!s) continue;
      const ctm = t.getScreenCTM();
      if (!ctm) continue;
      // uniform scale: these charts only ever translate, so |(a,b)| is the factor
      const scale = Math.hypot(ctm.a, ctm.b);
      const size = parseFloat(getComputedStyle(t).fontSize);
      const box = t.getBoundingClientRect();
      texts.push({
        text: s.slice(0, 24),
        eff: +(size * scale).toFixed(2),
        x: box.left, r: box.right, y: box.top + box.height / 2, h: box.height,
      });
    }
    out.push({ tier, svg: { l: svgBox.left, r: svgBox.right, t: svgBox.top, b: svgBox.bottom }, texts });
  }
  return out;
};

for (const vp of PASSES) {
  R.group(`── ${vp.name}px · floor ${vp.floor}px ────────────────────────`);
  const page = await newThemedPage(browser, vp, 'indigo');
  await mockMarketData(page);

  let totalTexts = 0;
  for (const route of ROUTES) {
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    // charts mount behind a ResizeObserver measure — give it a couple of frames
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const svgs = await page.evaluate(PROBE);

    // A selector typo must not produce a vacuous pass — this is the classic way
    // a gate of this shape silently rots. But some routes legitimately render no
    // chart HERE: /network and /mempool need the xmr.irish node, and this sandbox
    // has no egress to it, so they sit in their skeleton state by design (see
    // verify-stale.mjs, which owns that behaviour). Requiring a chart on those
    // would be a false failure; requiring NOTHING would be a false pass. So
    // require one or the other, explicitly, and say which happened.
    if (svgs.length === 0) {
      // The escape hatch is scoped to the routes that genuinely need the node
      // feed. Anything else — /monero/tech is static educational SVG, the
      // simulators are self-contained — MUST render a chart, or the migration
      // missed it. Without this scoping a stray "loading" anywhere in the page
      // text would let an unmigrated route pass.
      const nodeDependent = route === '/network' || route === '/mempool';
      const skeleton = nodeDependent && await page.evaluate(() =>
        // v6.1.4: NO NODE RESPONSE joined the vocabulary — in this sandbox the
        // node cascade is unreachable, so a settled outage now reports that
        // rather than CONNECTING, and without it this gate reads the honest
        // failure state as an unmigrated route.
        /CONNECTING|NO NODE RESPONSE|OFFLINE|Awaiting|STALE · reconnecting/i.test(document.body.innerText));
      R.ok(skeleton, `${route} · renders a chart, or is a node-dependent route in its documented no-data state`,
        nodeDependent
          ? 'node-dependent, but no skeleton either — the selector or the route is wrong'
          : 'this route has no upstream dependency, so a missing [data-chart]/[data-diagram] means it was not migrated');
      if (skeleton) R.info(`${route} · skipped: node feed unavailable in this sandbox`);
      continue;
    }
    R.ok(true, `${route} · has at least one [data-chart]/[data-diagram]`);

    const texts = svgs.flatMap((s) => s.texts);
    totalTexts += texts.length;

    // 1 · FLOOR
    const low = texts.filter((t) => t.eff < vp.floor - 0.05);
    R.ok(low.length === 0, `${route} · ${texts.length} labels, none under ${vp.floor}px`,
      low.slice(0, 8).map((t) => `"${t.text}" → ${t.eff}px`).join('\n     '));

    // 2 · CONTAINMENT — catches a derived padL/padR that came out too small,
    //     which is exactly the failure mode of making the labels bigger.
    const spill = [];
    for (const s of svgs) {
      for (const t of s.texts) {
        if (t.x < s.svg.l - 0.5 || t.r > s.svg.r + 0.5) spill.push(t);
      }
    }
    R.ok(spill.length === 0, `${route} · every label is inside its own <svg>`,
      spill.slice(0, 8).map((t) => `"${t.text}" [${t.x.toFixed(0)}..${t.r.toFixed(0)}]`).join('\n     '));

    // 3 · COLLISION — bigger labels on the same axis run into each other unless
    //     the density derivation (labelStep/tickCount) actually fired.
    const clash = [];
    for (const s of svgs) {
      const ts = s.texts;
      for (let i = 0; i < ts.length; i++) {
        for (let j = i + 1; j < ts.length; j++) {
          const a = ts[i], b = ts[j];
          if (Math.abs(a.y - b.y) > Math.max(a.h, b.h) * 0.6) continue; // different baselines
          if (a.x < b.r - 0.5 && b.x < a.r - 0.5) clash.push([a.text, b.text]);
        }
      }
    }
    R.ok(clash.length === 0, `${route} · no two same-baseline labels overlap`,
      clash.slice(0, 6).map(([a, b]) => `"${a}" ⨯ "${b}"`).join('\n     '));
  }
  R.info(`${totalTexts} label(s) measured at ${vp.name}px`);
  await page.context().close();
}

// ── the lede:tick ratio — §2.3, "the chart is the focal point" ───────────────
R.group('── type balance · caption must not out-size the chart ───────');
{
  for (const vp of PASSES) {
    const page = await newThemedPage(browser, vp, 'indigo');
    await mockMarketData(page);
    await page.goto(BASE + '/simulate?p=decoy', { waitUntil: 'networkidle' });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const m = await page.evaluate(() => {
      const lede = document.querySelector('.proto-panel .lede');
      const tick = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fs-chart-tick'));
      return { lede: lede ? parseFloat(getComputedStyle(lede).fontSize) : null, tick };
    });
    if (m.lede == null) { R.ok(false, `${vp.name}px · .proto-panel .lede found`); }
    else {
      const ratio = m.lede / m.tick;
      R.ok(ratio <= 1.6, `${vp.name}px · lede ${m.lede}px : tick ${m.tick}px = ${ratio.toFixed(2)}:1 (≤1.6)`,
        'the explainer copy is out-sizing the thing it explains');
    }
    await page.context().close();
  }
}

await browser.close();
process.exit(R.finish());
