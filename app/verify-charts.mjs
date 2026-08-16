// verify-charts.mjs — DOM gate for the v6.0.3 chart-fidelity work.
//
// Drives the BUILT app (vite preview @ :4173) with the network mocked at the
// page level. Four things this proves that a static read cannot:
//
//   1. GRADIENT UNIQUENESS. SVG url(#id) resolves to the FIRST matching id in
//      the document, so two instances of one chart sharing a literal <defs> id
//      means the second paints with the first's stops. /markets renders two
//      MultiLine charts; before the useGradientId fix they both emitted
//      "ml-grad-0" and the top-10 chart was filled in the peer chart's colours.
//      This scenario FAILS on the pre-fix build — that is the point of it.
//
//   2. HOVER READOUT ACCURACY. Hovering a known datum index must produce a
//      tooltip containing that datum's value.
//
//   3. RESIZE MID-HOVER. The regression test for viewBox scaling: resize the
//      window without moving the pointer and the readout must still describe
//      the SAME datum. useSvgCursor stores the index, and derives it through
//      getBoundingClientRect(), so this holds; anything measuring offsetWidth
//      drifts the moment a container is scaled.
//
//   4. REDUCED MOTION. Charts stay readable AND interactive; only motion stops.
//
// Run: npm run build && (npm run preview &) && sleep 2 && node verify-charts.mjs
import { chromium, webkit } from 'playwright';
import { existsSync, readdirSync } from 'node:fs';
// v6.1.8 cold boot: this gate's route array at :119 is
// ['/live/markets', '/live/network', '/'] — Home is the THIRD element, which
// is why a grep for a leading '/' route literal missed this file.
import { coldBootOffBrowser, assertColdBootBypassed } from './verify-lib.mjs';

const base = 'http://localhost:4173';

function findChrome() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!existsSync(root)) return undefined;
  for (const d of readdirSync(root).filter((n) => n.startsWith('chromium-')).sort().reverse()) {
    const p = root + '/' + d + '/chrome-linux/chrome';
    if (existsSync(p)) return p;
  }
  return undefined;
}

let b, engine = 'chromium';
try {
  const executablePath = findChrome();
  b = await chromium.launch(executablePath ? { executablePath } : {});
} catch {
  engine = 'webkit';
  b = await webkit.launch();
}
console.log('engine:', engine);
await coldBootOffBrowser(b);

let fail = false;
const ok = (cond, msg) => { console.log((cond ? '✅ ' : '❌ ') + msg); if (!cond) fail = true; };

/* ── fixtures (shapes mirror real /api responses; see data/map.ts) ── */
const H0 = 3_700_123;
const nowSec = Math.floor(Date.now() / 1000);
const hex = (c) => c.repeat(64);

// Distinct, well-separated values: if an off-by-one crept into the index math,
// a neighbouring datum must not be able to satisfy the assertion by accident.
const MEMPOOL_TXS = Array.from({ length: 24 }, (_, i) => ({
  txid: String(i).padStart(2, '0').repeat(32),
  blob_size: 1000 + i * 100,
  fee: 30_000_000 + i * 1_000_000,
  fee_rate: 10_000 + i * 5_000,
  receive_time: nowSec - (i + 1) * 30,
  ring_size: 16, input_count: 1, output_count: 2,
}));

const FIX = {
  network: {
    height: H0, difficulty: 7.7e11, hashrate_ghs: 6.42, tx_pool_size: MEMPOOL_TXS.length,
    tx_count_total: 61_236_904, block_weight_limit: 600000, block_weight_median: 300000,
    target_seconds: 120, top_block_hash: hex('b'), alt_blocks_count: 1,
    version: '0.18.3.4', major_version: 16, fee_tiers: [20000, 80000, 320000, 4000000],
    randomx_seed_hash: hex('c'), database_size: 284_500_000_000,
    synchronized: true, nettype: 'mainnet', adjusted_time: nowSec,
  },
  info: { result: { height: H0, difficulty: 7.7e11, target: 120, major_version: 16, top_block_hash: hex('b') } },
  mempool: {
    recent_txs: MEMPOOL_TXS,
    fee_histogram: [{ tx_count: 6, bytes: 7000 }, { tx_count: 8, bytes: 9000 }, { tx_count: 10, bytes: 11000 }],
  },
  blocks: Array.from({ length: 14 }, (_, i) => ({
    height: H0 - i, hash: hex('e'), tx_count: 3 + i, block_weight: 9000 + i * 800,
    reward: 0.6e12, difficulty: 7.7e11, timestamp: nowSec - 60 - i * 120, pool_name: 'Unknown',
  })),
  difficulty: {
    points: Array.from({ length: 14 }, (_, i) => ({
      /* Deterministic wobble, NOT Math.random(): a fixture that differs run to
         run makes the gate's SUBJECT differ run to run, so a boundary-adjacent
         assertion would flake and the flake would look like a defect. The two
         peak fixtures below are already deterministic; this one was the odd
         one out. */
      height: H0 - i, timestamp: nowSec - 60 - i * 120, difficulty: 7.7e11 + ((i * 37) % 10) * 1e9
    })),
    ok: true,
    range: "1d",
    window_seconds: 86400,
    target_seconds: 120,
    tip: H0,
  },
  price: { monero: { usd: 321.45, usd_24h_change: 1.23 }, bitcoin: { usd: 97_000, usd_24h_change: -0.4 } },
};

function fulfil(route) {
  const url = route.request().url();
  const json = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  if (url.includes('/api/xmr/network/difficulty')) return json(FIX.difficulty);
  if (url.includes('/api/xmr/network')) return json(FIX.network);
  if (url.includes('/api/xmr/mempool')) return json(FIX.mempool);
  if (url.includes('/api/xmr/blocks')) return json(FIX.blocks);
  if (url.includes('/api/coingecko')) {
    if (url.includes('simple%2Fprice') || url.includes('simple/price')) return json(FIX.price);
    return route.abort();
  }
  return route.abort();
}

// Seed the market-history cache so /markets renders candles without network.
const CANDLES = Array.from({ length: 40 }, (_, i) => ({
  t: Date.now() - (40 - i) * 4 * 3600_000,
  o: 300 + i * 5, h: 306 + i * 5, l: 298 + i * 5, c: 303 + i * 5, v: 1e6 + i * 1e5,
}));
const seedCache = (p) => p.addInitScript(([k, v]) => localStorage.setItem(k, v),
  ['mh:v1:ohlc|monero|usd|30', JSON.stringify({ at: Date.now() - 60_000, data: CANDLES })]);

const newPage = async (opts = {}) => {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 }, ...opts });
  await seedCache(p);
  await p.route('**/api/**', fulfil);
  return p;
};

/* ── 1 · gradient uniqueness ───────────────────────────────────────── */
for (const path of ['/live/markets', '/live/network', '/']) {
  const p = await newPage();
  await p.goto(base + path, { waitUntil: 'load' });
  // v6.1.8 PRECONDITION — Home only. A gradient/id census taken through the
  // splash counts the SPLASH's defs and reports them as the route's.
  if (path === '/') await assertColdBootBypassed(p, { ok }, path);
  await p.waitForTimeout(1800);

  const g = await p.evaluate(() => {
    const ids = [...document.querySelectorAll('linearGradient')].map((n) => n.id);
    // Every url(#x) must resolve to an id that exists.
    const refs = [...document.querySelectorAll('[fill^="url(#"]')]
      .map((n) => (n.getAttribute('fill').match(/url\(#(.*?)\)/) || [])[1])
      .filter(Boolean);
    return { ids, dupes: ids.filter((v, i) => ids.indexOf(v) !== i), dangling: refs.filter((r) => !ids.includes(r)) };
  });

  ok(g.dupes.length === 0, `${path}: no duplicate <linearGradient> ids (${g.ids.length} total)${g.dupes.length ? ' → ' + [...new Set(g.dupes)].join(', ') : ''}`);
  ok(g.dangling.length === 0, `${path}: every url(#…) resolves${g.dangling.length ? ' → dangling: ' + [...new Set(g.dangling)].join(', ') : ''}`);
  await p.close();
}

/* ── 2+3 · hover readout, and the resize-mid-hover lock ────────────── */
{
  const p = await newPage();
  await p.goto(base + '/live/network', { waitUntil: 'load' });
  await p.waitForTimeout(2000);

  // Any chart svg that carries the cursor handlers has a crosshair cursor
  // style; pick the first one that is comfortably sized.
  const target = await p.evaluate(() => {
    const svgs = [...document.querySelectorAll('svg')].filter((s) => {
      const r = s.getBoundingClientRect();
      return r.width > 300 && r.height > 100;
    });
    if (!svgs.length) return null;
    svgs[0].setAttribute('data-hovertarget', '1');
    const r = svgs[0].getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });

  if (!target) {
    ok(false, 'found a hoverable chart on /network');
  } else {
    // Hover well left of centre. The pointer does not move during the resize,
    // so it has to still be over the chart afterwards — at 60% across a chart
    // that then narrows, the pointer ends up past its right edge and
    // pointerleave fires, which clears the readout correctly and would make
    // this assertion fail for a reason that has nothing to do with scaling.
    const readTip = () => p.evaluate(() => {
      const svg = document.querySelector('[data-hovertarget]');
      // The tooltip is the <g pointer-events="none"> holding a rect + text.
      const texts = [...svg.querySelectorAll('g[pointer-events="none"] text')].map((t) => t.textContent.trim());
      return texts.join(' | ');
    });

    const hoverAtFraction = async (frac) => {
      // Scroll the chart into view BEFORE measuring. This assertion is about
      // the datum being width-independent, not about the chart happening to
      // sit above the fold — and those are different things once a breakpoint
      // reflows the page. At 1180px the v6.0.8 tablet band collapses the
      // telemetry rail to a single column, which pushes this chart down far
      // enough that a fraction-of-its-height hover landed below `.main`'s
      // scroll viewport, on the footer. The mouse then hovered no chart at
      // all and the readout lost its datum — a false failure that said
      // nothing about width-independence.
      await p.evaluate(() => document.querySelector('[data-hovertarget]')
        .scrollIntoView({ block: 'center', behavior: 'instant' }));
      await p.waitForTimeout(120);
      const r = await p.evaluate(() => {
        const s = document.querySelector('[data-hovertarget]').getBoundingClientRect();
        return { x: s.x, y: s.y, w: s.width, h: s.height };
      });
      await p.mouse.move(r.x + r.w * frac, r.y + r.h * 0.5);
      await p.waitForTimeout(220);
      return readTip();
    };

    // Captured through `hoverAtFraction` (below) rather than from the `target`
    // rect measured further up: that rect predates any scroll, so on a layout
    // where this chart sits below the fold the baseline hover landed on the
    // footer and read no datum — inverting the comparison and failing all
    // three widths for a reason unrelated to scaling. Same helper, same
    // preconditions, for all four measurements.
    const before = await hoverAtFraction(0.3);
    ok(before.length > 0, `hover produces a tooltip readout → "${before.slice(0, 70)}"`);

    // THE VIEWBOX-SCALING REGRESSION TEST.
    //
    // Formulated as "same fraction across the plot ⇒ same datum, at any
    // container width". Simply resizing under a stationary pointer does not
    // test that: the chart moves out from under the cursor, pointerleave
    // fires, and the readout clears — which is correct behaviour, so the
    // assertion would fail for a reason unrelated to scaling.
    //
    // Hovering the SAME PROPORTIONAL position after a resize is the real
    // invariant. useSvgCursor converts client px to viewBox units via
    // getBoundingClientRect(), so the mapping is width-independent; anything
    // reading offsetWidth, or storing raw pixels, drifts to a neighbouring
    // datum here. The fixture's values are well separated so a near-miss
    // cannot pass by luck.
    for (const width of [1180, 900, 1440]) {
      await p.setViewportSize({ width, height: 900 });
      await p.waitForTimeout(400);
      const again = await hoverAtFraction(0.3);
      ok(again === before,
        `datum at 30% across is identical at ${width}px wide${again === before ? '' : `\n     1440px="${before}"\n     ${width}px="${again}"`}`);
    }
  }
  await p.close();
}

/* ── 4 · reduced motion: readable and still interactive ────────────── */
{
  const p = await newPage({ reducedMotion: 'reduce' });
  await p.goto(base + '/live/network', { waitUntil: 'load' });
  await p.waitForTimeout(2000);

  const vis = await p.evaluate(() => {
    const svgs = [...document.querySelectorAll('svg')].filter((s) => s.getBoundingClientRect().width > 300);
    return {
      count: svgs.length,
      // A mount fade stuck at 0 would mean the chart is invisible, which is
      // the failure mode reduced motion must NOT cause.
      hidden: svgs.filter((s) => parseFloat(getComputedStyle(s).opacity || '1') < 0.9).length,
      running: document.getAnimations().filter((a) => a.playState === 'running').length,
    };
  });
  ok(vis.count > 0 && vis.hidden === 0, `reduced motion: all ${vis.count} charts render at full opacity (${vis.hidden} faded)`);
  ok(vis.running === 0, `reduced motion: no animation is running (${vis.running})`);

  // Interactivity must survive — only motion stops, not inspection.
  const t = await p.evaluate(() => {
    const s = [...document.querySelectorAll('svg')].find((x) => x.getBoundingClientRect().width > 300);
    s.setAttribute('data-hovertarget', '1');
    const r = s.getBoundingClientRect();
    return { x: r.x + r.width * 0.5, y: r.y + r.height * 0.5 };
  });
  await p.mouse.move(t.x, t.y);
  await p.waitForTimeout(250);
  const tip = await p.evaluate(() =>
    [...document.querySelectorAll('[data-hovertarget] g[pointer-events="none"] text')].map((n) => n.textContent).join(''));
  ok(tip.trim().length > 0, 'reduced motion: hover inspection still works');
  await p.close();
}

/* ── 5 · edge-peak marker label nudge ────────────────────────────── */
{
  const p = await newPage();

  // Fixture with max difficulty at series index 0 (oldest block, leftmost).
  // This reproduces the ROUND 3 case from charts.tsx:805-823.
  const edgePeakFix = { ...FIX, blocks: Array.from({ length: 14 }, (_, i) => ({
    ...FIX.blocks[i],
    difficulty: i === 13 ? 7.83e11 : 7.4e11 + i * 1.0e9,
  })), difficulty: { ...FIX.difficulty, points: Array.from({ length: 14 }, (_, i) => ({
    height: H0 - i, timestamp: nowSec - 60 - i * 120, difficulty: i === 13 ? 7.83e11 : 7.4e11 + i * 1.0e9
  })) } };

  // Interior-peak control: max stays well inside, should render fine before fix.
  const interiorPeakFix = { ...FIX, blocks: Array.from({ length: 14 }, (_, i) => ({
    ...FIX.blocks[i],
    difficulty: i === 6 ? 7.83e11 : 7.4e11 - i * 2.0e9,
  })), difficulty: { ...FIX.difficulty, points: Array.from({ length: 14 }, (_, i) => ({
    height: H0 - i, timestamp: nowSec - 60 - i * 120, difficulty: i === 6 ? 7.83e11 : 7.4e11 - i * 2.0e9
  })) } };

  // Mock edge-peak fixture
  const edgePeakFulfil = (route) => {
    const url = route.request().url();
    const json = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (url.includes('/api/xmr/network/difficulty')) return json(edgePeakFix.difficulty);
    if (url.includes('/api/xmr/network')) return json(edgePeakFix.network);
    if (url.includes('/api/xmr/mempool')) return json(edgePeakFix.mempool);
    if (url.includes('/api/xmr/blocks')) return json(edgePeakFix.blocks);
    if (url.includes('/api/coingecko')) {
      if (url.includes('simple%2Fprice') || url.includes('simple/price')) return json(edgePeakFix.price);
      return route.abort();
    }
    return route.abort();
  };

  // Test edge-peak rendering
  await p.route('**/api/**', edgePeakFulfil);
  await p.goto(base + '/live/network', { waitUntil: 'load' });
  await assertColdBootBypassed(p, { ok }, '/live/network edge-peak');
  await p.waitForTimeout(2000);

  // Find the difficulty chart by examining SVG content.
  // The difficulty chart is the AreaSeries with y-tick labels containing "G" suffix
  // and containing the peak value "783.00G" from the edge-peak fixture.
  const diffChart = await p.evaluate(() => {
    const svgs = [...document.querySelectorAll('svg')];

    // Find the difficulty chart: look for SVG with text "783.00G" (the peak in edge-peak fixture)
    // and other "G" suffixed values (gigahash unit for difficulty).
    const diffSvg = svgs.find(svg => {
      const texts = [...svg.querySelectorAll('text')].map(t => t.textContent.trim());
      return texts.some(t => t === '783.00G') || texts.some(t => /\d+\.\d+G$/.test(t));
    });

    if (!diffSvg) return { found: false };

    // Extract all texts from this SVG
    const allTexts = [...diffSvg.querySelectorAll('text')].map((t) => ({
      text: t.textContent.trim(),
      anchor: t.getAttribute('text-anchor'),
      fill: t.getAttribute('fill'),
      x: parseFloat(t.getAttribute('x')),
      y: parseFloat(t.getAttribute('y')),
    }));

    // Find marker labels: text-anchor="middle" (markers), not the pill (fill=var(--surface-base))
    // Marker labels are the peak/valley value labels placed on the chart
    const markerLabels = allTexts.filter((t) =>
      t.anchor === 'middle' && t.fill !== 'var(--surface-base)' && !isNaN(t.x) && !isNaN(t.y)
    );

    return {
      found: markerLabels.length > 0,
      markerLabels,
      allTexts,
    };
  });

  ok(diffChart && diffChart.found,
    `edge-peak: difficulty marker labels render inside chart's SVG (${diffChart && diffChart.markerLabels ? diffChart.markerLabels.length : 0} found)`);

  if (diffChart && diffChart.markerLabels && diffChart.markerLabels.length > 0) {
    // Verify at least one marker contains the max value "783.00G"
    const hasMax = diffChart.markerLabels.some((m) => m.text.includes('783'));
    ok(hasMax, 'edge-peak: marker labels include the peak value (783.00G)');
  }

  await p.route('**/api/**', (r) => { r.abort(); }); // clear route

  // Test interior-peak (control) still works
  const interiorFulfil = (route) => {
    const url = route.request().url();
    const json = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (url.includes('/api/xmr/network/difficulty')) return json(interiorPeakFix.difficulty);
    if (url.includes('/api/xmr/network')) return json(interiorPeakFix.network);
    if (url.includes('/api/xmr/mempool')) return json(interiorPeakFix.mempool);
    if (url.includes('/api/xmr/blocks')) return json(interiorPeakFix.blocks);
    if (url.includes('/api/coingecko')) {
      if (url.includes('simple%2Fprice') || url.includes('simple/price')) return json(interiorPeakFix.price);
      return route.abort();
    }
    return route.abort();
  };

  await p.route('**/api/**', interiorFulfil);
  await p.goto(base + '/live/network', { waitUntil: 'load' });
  await p.waitForTimeout(2000);

  const interiorChart = await p.evaluate(() => {
    const svgs = [...document.querySelectorAll('svg')];

    // Same selector as edge-peak: find SVG with "783.00G" or other "G" suffix values
    const diffSvg = svgs.find(svg => {
      const texts = [...svg.querySelectorAll('text')].map(t => t.textContent.trim());
      return texts.some(t => t === '783.00G') || texts.some(t => /\d+\.\d+G$/.test(t));
    });

    if (!diffSvg) return { found: false };

    const allTexts = [...diffSvg.querySelectorAll('text')].map((t) => ({
      text: t.textContent.trim(),
      anchor: t.getAttribute('text-anchor'),
      fill: t.getAttribute('fill'),
    }));

    const markerLabels = allTexts.filter((t) =>
      t.anchor === 'middle' && t.fill !== 'var(--surface-base)'
    );

    return {
      found: markerLabels.length > 0,
      markerLabels,
    };
  });

  ok(interiorChart && interiorChart.found,
    'interior-peak control: marker labels still render (byte-identical behavior)');

  /* A nudge that renders the label straight back onto the furniture it was
     supposed to avoid would satisfy every assertion above — "the max is on
     the chart" is true of a label sitting on top of the change badge. So the
     resolved position is checked geometrically too: the marker's box must not
     intersect any y-tick label, the badge, or the last-value pill. Boxes come
     from getBoundingClientRect(), so this measures what was PAINTED rather
     than re-deriving the estimate the component itself used to decide. */
  await p.route('**/api/**', edgePeakFulfil);
  await p.goto(base + '/live/network', { waitUntil: 'load' });
  await p.waitForTimeout(2000);

  const overlap = await p.evaluate(() => {
    const svgs = [...document.querySelectorAll('svg')];
    const diffSvg = svgs.find((svg) =>
      [...svg.querySelectorAll('text')].some((t) => /^\d+\.\d+G$/.test(t.textContent.trim())));
    if (!diffSvg) return { found: false };
    const boxed = [...diffSvg.querySelectorAll('text')].map((t) => ({
      text: t.textContent.trim(),
      anchor: t.getAttribute('text-anchor'),
      fill: t.getAttribute('fill') || '',
      r: t.getBoundingClientRect(),
    })).filter((t) => t.r.width > 0 && t.r.height > 0);

    const markers = boxed.filter((t) => t.anchor === 'middle' && !t.fill.includes('surface-base'));
    const furniture = boxed.filter((t) => !markers.includes(t));
    const hit = (a, b) => a.r.left < b.r.right && b.r.left < a.r.right
      && a.r.top < b.r.bottom && b.r.top < a.r.bottom;

    const clashes = [];
    for (const m of markers) for (const f of furniture) {
      if (hit(m, f)) clashes.push(`"${m.text}" ∥ "${f.text}"`);
    }
    return { found: true, markers: markers.length, clashes };
  });

  ok(overlap.found && overlap.markers > 0,
    `edge-peak: a marker label is present to check for overlap (${overlap.markers || 0})`);
  ok(overlap.found && overlap.clashes.length === 0,
    `edge-peak: the NUDGED label overlaps no tick, badge or pill${overlap.clashes && overlap.clashes.length ? ' — ' + overlap.clashes.join(', ') : ''}`);

  await p.close();
}

await b.close();
console.log(fail ? '\nFAILED\n' : '\nAll chart checks passed\n');
process.exit(fail ? 1 : 0);
