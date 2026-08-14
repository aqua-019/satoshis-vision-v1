/**
 * verify-markets-dom.mjs — the machine-checkable form of the v6.0.5 Markets
 * contract: live-ranked group membership, the chart position/scale swap, and
 * the ragged-history rule.
 *
 * WHY THIS EXISTS. api/verify-markets.mjs proves the *aggregator* ranks and
 * filters correctly, in pure Node against committed fixtures. It cannot prove
 * the page then renders what the aggregator said. This gate closes that gap by
 * driving the built app with /api/markets served from a fixture that mirrors
 * the live CoinGecko ranking, and asserting on the DOM that came out.
 *
 * OFFLINE BY CONSTRUCTION. Every '**\/api\/**' route is intercepted — nothing
 * leaves the sandbox, and the fixture is a fixed-clock fabrication used ONLY as
 * test input. It is deliberately not importable by app code (this file lives
 * outside src/), so it can never become a fallback the way genCandles6 did.
 *
 * WHAT IT DOES NOT COVER. That CoinGecko's real privacy-coins category still
 * ranks DASH out and BCN/DCR/MWC in is an upstream fact, not a code property;
 * sandbox egress to api.coingecko.com is blocked. This gate asserts the page
 * faithfully renders whatever ranking it is handed — check the live ranking on
 * a deploy preview.
 *
 * Run: npm run build && npm run preview & && npm run wait-preview
 *      node verify-markets-dom.mjs
 */
import { chromium } from 'playwright';
import { existsSync, readdirSync } from 'node:fs';

/* Same executable resolution verify-perf.mjs uses: CI images and this sandbox
   ship a full chromium under PLAYWRIGHT_BROWSERS_PATH but not always the
   chrome-headless-shell build playwright reaches for by default. */
function findChrome() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!existsSync(root)) return undefined;
  for (const d of readdirSync(root).filter((n) => n.startsWith('chromium-')).sort().reverse()) {
    const p = root + '/' + d + '/chrome-linux/chrome';
    if (existsSync(p)) return p;
  }
  return undefined;
}

const base = process.env.PREVIEW_URL || 'http://localhost:4173';
const DAY = 86_400_000;
/* Fixed clock. Date.now() here would make the ragged-history assertion drift
   with the wall clock on a slow runner. */
const T1 = Date.UTC(2026, 6, 31);
const t0 = (n) => T1 - (n - 1) * DAY;

/** n daily points ending at T1, each series on its own gentle trend so the
 *  rendered lines stay distinguishable. */
const pts = (n, p0, drift) => {
  const t = [], p = [];
  for (let i = 0; i < n; i++) { t.push(t0(n) + i * DAY); p.push(p0 * (1 + drift * i / n)); }
  return { t, p };
};

/* Live top-10 privacy-coins ranking. The two facts the old hardcoded list hid:
   DASH is NOT in this category's top 10 by CoinGecko's classification, and ZEC
   outranks XMR by market cap. Both are load-bearing for the assertions below. */
const PRIVACY = [
  ['monero', 'XMR', 'Monero', 2, 372.1, 6.87e9],
  ['zcash', 'ZEC', 'Zcash', 1, 486.0, 7.94e9],
  ['bytecoin', 'BCN', 'Bytecoin', 3, 0.0014, 2.658e8],
  ['decred', 'DCR', 'Decred', 4, 14.6, 2.345e8],
  ['mimblewimblecoin', 'MWC', 'MimbleWimbleCoin', 5, 11.9, 1.234e8],
  ['pirate-chain', 'ARRR', 'Pirate Chain', 6, 0.21, 4.10e7],
  ['verge', 'XVG', 'Verge', 7, 0.0019, 3.13e7],
  ['nockchain', 'NOCK', 'Nockchain', 8, 0.62, 2.76e7],
  ['zcoin', 'FIRO', 'Firo', 9, 0.88, 1.26e7],
];
/* Live top-10 majors, minus the pegs the aggregator already dropped. USDT/USDC
   are absent HERE because selectMembers excluded them upstream — this fixture
   is the aggregator's output, not CoinGecko's raw page. */
const MAJORS = [
  ['monero', 'XMR', 'Monero', 26, 372.1, 6.87e9],
  ['bitcoin', 'BTC', 'Bitcoin', 1, 97_000, 1.9e12],
  ['ethereum', 'ETH', 'Ethereum', 2, 3_100, 3.7e11],
  ['binancecoin', 'BNB', 'BNB', 4, 690, 9.9e10],
  ['ripple', 'XRP', 'XRP', 6, 2.1, 1.2e11],
  ['solana', 'SOL', 'Solana', 7, 178, 8.6e10],
  ['tron', 'TRX', 'TRON', 8, 0.27, 2.3e10],
  ['figure-heloc', 'FIGR_HELOC', 'Figure Heloc', 9, 1.03, 1.1e10],
  ['whitebit', 'WBT', 'WhiteBIT Coin', 10, 42.0, 6.1e9],
];

/* Charts are identified by the HEIGHT half of their viewBox, never the whole
   string: charts.tsx measures its own CSS width and uses it as the viewBox
   width so one user unit is one CSS pixel, which makes the width viewport- and
   layout-dependent. The height is the prop this page sets, so it is the stable
   discriminator between the four charts. */

/* Must track api/markets.js GROUPS.{peers,majors}.chartN — the §3 legibility
   decision (cap the chart, list the remainder as text) lives in those numbers. */
const PEER_CHART_N = 6, MAJOR_CHART_N = 9;

/* Ragged history, exactly as measured against CoinGecko at days=30. bytecoin's
   17-of-31 is the case the "never pad" rule exists for. */
const POINTS = { bytecoin: 17, mimblewimblecoin: 25, nockchain: 31 };

const member = ([id, symbol, name, rank, price, marketCap], i, chartN) => ({
  id, symbol, name, rank, price, marketCap, change24h: 1.5 - i * 0.3,
  charted: i < chartN, pinned: id === 'monero',
});

const seriesFor = (rows, chartN) => rows.slice(0, chartN).map(([id, symbol], i) => ({
  id, symbol, status: 'live', at: T1,
  ...pts(POINTS[id] ?? 31, 100 + i * 7, 0.05 + i * 0.04),
}));

/** The /api/markets envelope shape consumed by data/useMarketHistory.ts. */
const envelope = (days) => ({
  v: 1, days, fetchedAt: new Date(T1).toISOString(), partial: false,
  meta: { status: 'live', ath: 542.33, athDate: '2018-01-09', atl: 0.212967, atlDate: '2015-01-14' },
  rankings: {
    peers: {
      status: 'live', at: T1, source: 'category:privacy-coins',
      members: PRIVACY.map((r, i) => member(r, i, PEER_CHART_N)),
      excluded: [{ id: 'tether', reason: 'pegged' }],
    },
    majors: {
      status: 'live', at: T1, source: 'market_cap_desc',
      members: MAJORS.map((r, i) => member(r, i, MAJOR_CHART_N)),
      excluded: [{ id: 'tether', reason: 'pegged' }, { id: 'usd-coin', reason: 'pegged' }],
    },
  },
  series: { peers: seriesFor(PRIVACY, PEER_CHART_N), majors: seriesFor(MAJORS, MAJOR_CHART_N) },
});

/* p3·12: the hero fixture has to mirror CoinGecko's OWN granularity table,
   because the assertions below are about DENSITY and a fixture that hands every
   range the same 180 points cannot tell a 22-bar chart from a 360-bar one. The
   ragged-history fixture above is unchanged — it feeds /api/markets, which is a
   membership question, not a density one.

     /coins/{id}/ohlc          1-2d -> 30m · 3-30d -> 4h  · 31d+ -> 4d
     /coins/{id}/market_chart  <=1d -> 5m  · 2-90d -> 1h  · >90d -> 1d */
const HOURMS = 3_600_000;
const ohlcStep = (days) => (days <= 2 ? 30 * 60_000 : days <= 30 ? 4 * HOURMS : 4 * DAY);
const chartStep = (days) => (days <= 1 ? 300_000 : days <= 90 ? HOURMS : DAY);
const walk = (days, step, p0) => {
  const n = Math.max(1, Math.floor((days * DAY) / step));
  const out = [];
  let p = p0;
  for (let i = 0; i < n; i++) {
    p *= 1 + Math.sin(i / 7.3) * 0.004 + Math.cos(i / 31.1) * 0.002;
    out.push([T1 - (n - 1 - i) * step, p]);
  }
  return out;
};
const cgChart = (days, p0) => {
  const rows = walk(days, chartStep(days), p0);
  return { prices: rows, total_volumes: rows.map(([x]) => [x, 1.2e8]) };
};

function fulfil(route) {
  const url = route.request().url();
  const json = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  const m = /\/api\/markets\?days=(\d+)/.exec(url);
  if (m) return json(envelope(Number(m[1])));
  if (url.includes('/api/coingecko')) {
    if (url.includes('simple')) return json({ monero: { usd: 372.1, usd_24h_change: 1.2 }, bitcoin: { usd: 97000, usd_24h_change: -0.3 } });
    const dm = /[?&]days=(\d+)/.exec(url);
    const days = dm ? Number(dm[1]) : 30;
    if (url.includes('ohlc')) {
      return json(walk(days, ohlcStep(days), 372).map(([x, p]) => [x, p, p * 1.02, p * 0.98, p * 1.005]));
    }
    if (url.includes('market_chart')) return json(cgChart(days, url.includes('vs_currency=btc') ? 0.0038 : 372));
    if (url.includes('tickers')) return json({ tickers: [] });
  }
  return route.abort();
}

let fails = 0;
const ok = (m) => console.log('✅ ' + m);
const bad = (m) => { fails++; console.log('❌ ' + m); };
const is = (c, m) => (c ? ok(m) : bad(m));

const exe = findChrome();
const b = await chromium.launch(exe ? { executablePath: exe } : {});

/* ── phone: membership, filtering, ragged history, 390px legibility ──── */
console.log('\nverify-markets-dom — 390px');
const page = await b.newPage({ viewport: { width: 390, height: 844 } });
/* §1d request accounting. Counted on THIS page only, via a request listener
   rather than inside fulfil() — the desktop layout page below shares the same
   route handler and its loads (including a deliberate reload) would otherwise
   be billed to the budget. */
let upstream = 0;
const seen = [];
page.on('request', (r) => {
  const u = r.url();
  if (u.includes('/api/')) { upstream++; seen.push(u.replace(base, '')); }
});
await page.route('**/api/**', fulfil);
await page.goto(base + '/live/markets', { waitUntil: 'load' });
await page.waitForTimeout(2500);

const text = await page.evaluate(() => document.body.innerText);

/* Membership follows the ranking it was handed — not a frozen list. */
is(!/\bDASH\b/.test(text), 'privacy panel: DASH absent (not in the live category top 10)');
for (const s of ['BCN', 'DCR', 'MWC']) is(text.includes(s), `privacy panel: ${s} present (outranks ARRR)`);

/* GroupBadge counts the series actually rendered, not the manifest length. */
const badges = await page.evaluate(() => [...document.querySelectorAll('*')]
  .filter((e) => e.children.length === 0 && /\d+ live/.test(e.textContent || ''))
  .map((e) => e.textContent.trim()));
is(badges.some((t) => t.includes(`${PEER_CHART_N} live`)), `GroupBadge reads "${PEER_CHART_N} live" (peers chartN)`);
is(badges.some((t) => t.includes(`${MAJOR_CHART_N} live`)), `GroupBadge reads "${MAJOR_CHART_N} live" (majors chartN)`);

/* No peg reaches a series slot. Scoped to the majors PANEL on purpose: the
   swap-venue directory further down legitimately lists "XMR↔ETH, USDC" as a
   tradable pair, which is a venue fact rather than a chart series. */
const majorsPanel = await page.evaluate(() => {
  const svg = document.querySelector('svg[viewBox$=" 340"]');
  for (let n = svg; n && n !== document.body; n = n.parentElement) {
    if (/XMR vs Top/i.test(n.innerText || '')) return n.innerText;
  }
  return '';
});
// Case-insensitive: innerText reflects the panel title's text-transform:uppercase.
is(/XMR vs Top 9/i.test(majorsPanel), 'majors panel titled with the live count');
for (const s of ['USDT', 'USDC']) is(!new RegExp(`\\b${s}\\b`).test(majorsPanel), `majors chart excludes ${s}`);

/* ZEC outranks XMR by cap in this very chart, so no copy may claim otherwise. */
is(!/(largest|biggest|leading|#1)[^.]{0,40}privacy[^.]{0,20}(coin|cap)/i.test(text),
  'no by-market-cap primacy claim contradicting the chart below it');

/* Ragged history renders as partial lines. bytecoin (17 of 31 points) and
   mimblewimblecoin (25) must START LATER on the shared time axis — if either
   were padded to full length, every line would begin at the same padL. */
const starts = await page.evaluate(() => {
  const svg = document.querySelector('svg[viewBox$=" 300"]'); // privacy MultiLine
  if (!svg) return [];
  return [...svg.querySelectorAll('path[stroke]')]
    .filter((p) => (p.getAttribute('fill') || 'none') === 'none')  // line paths; area twins are fill-only
    .map((p) => { const m = /^M\s*([\d.]+)/.exec(p.getAttribute('d') || ''); return m ? Number(m[1]) : null; })
    .filter((v) => v != null);
});
const distinct = new Set(starts.map((v) => Math.round(v)));
is(starts.length === PEER_CHART_N, `privacy chart draws ${PEER_CHART_N} line paths (got ${starts.length})`);
is(distinct.size >= 3,
  `short series start later — no flat-line padding (x starts: ${starts.map((v) => v.toFixed(0)).join(', ')})`);

/* 390px: the page itself must not scroll sideways. */
const scroll = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
is(scroll.sw <= scroll.cw + 1, `no horizontal page scroll at 390px (${scroll.sw} ≤ ${scroll.cw})`);

/* …and nothing may sit past the right edge unless it lives in a container that
   scrolls horizontally BY DESIGN. styles.css:370 makes .table-scroll
   overflow-x:auto with a min-width:max-content .keep-cols child precisely so
   wide tables swipe inside their own box instead of widening the page. */
const clipped = await page.evaluate(() => {
  const exempt = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      if (n.classList && (n.classList.contains('table-scroll') || n.classList.contains('art-bg') || n.classList.contains('art-canvas'))) return true;
      const cs = getComputedStyle(n);
      if (cs.overflowX === 'auto' || cs.overflowX === 'scroll' || cs.overflowX === 'hidden') return true;
      if (cs.position === 'fixed') return true;
    }
    return false;
  };
  const out = [];
  for (const el of document.querySelectorAll('span, div, svg, text, b, p')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right <= window.innerWidth + 0.5 && r.left >= -0.5) continue;
    if (exempt(el)) continue;
    out.push({ tag: el.tagName, txt: (el.textContent || '').trim().slice(0, 40), left: Math.round(r.left), right: Math.round(r.right) });
  }
  return out.slice(0, 25);
});
is(clipped.length === 0, `nothing overflows the 390px viewport (${clipped.length} offenders)`);
if (clipped.length) console.log('   offenders:', JSON.stringify(clipped, null, 1));

/* The specific regression the v6.0.2 screenshots showed: the majors legend cut
   off at the right edge. It is a flex-wrap row — assert it WRAPS. */
const legend = await page.evaluate(() => {
  const hit = [...document.querySelectorAll('div')]
    .find((d) => /[+-]?\d+\.\d%/.test(d.textContent || '') && d.querySelectorAll('span').length > 6);
  if (!hit) return null;
  const over = [...hit.children]
    .map((c) => ({ t: c.textContent.trim(), right: Math.round(c.getBoundingClientRect().right) }))
    .filter((s) => s.right > window.innerWidth + 0.5);
  return { n: hit.children.length, over };
});
is(legend && legend.over.length === 0,
  `majors swatch legend wraps, no entry past the right edge (${legend ? legend.over.length : 'legend not found'})`);

/* The privacy panel header's charted-symbol strip shares a row with GroupBadge
   and is ellipsised, not clipped by the viewport. */
const strip = await page.evaluate(() => {
  const el = [...document.querySelectorAll('span[title]')].find((s) => (s.getAttribute('title') || '').includes('XMR'));
  if (!el) return null;
  return { title: el.getAttribute('title'), right: Math.round(el.getBoundingClientRect().right) };
});
is(!strip || strip.right <= 390.5, `privacy header symbol strip stays inside the viewport${strip ? ` ("${strip.title}")` : ''}`);

/* ── desktop: the v6.0.5 chart swap ──────────────────────────────────── */
console.log('\nverify-markets-dom — 1440px layout');
{
  const d = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  await d.route('**/api/**', fulfil);
  await d.goto(base + '/live/markets', { waitUntil: 'load' });
  await d.waitForTimeout(2500);
  /* The two chart props differ ON PURPOSE (318 ratio vs 340 majors): the ratio
     panel carries a caption line under its chart, so equal PANEL heights need
     unequal chart heights. Assert the panels, never the SVGs. */
  const L = await d.evaluate(() => {
    const panelOf = (vb) => {
      const svg = document.querySelector(`svg[viewBox$=" ${vb}"]`);
      for (let n = svg; n && n !== document.body; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.borderTopWidth !== '0px' || cs.borderLeftWidth !== '0px') {
          const r = n.getBoundingClientRect();
          return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), left: Math.round(r.left), w: Math.round(r.width) };
        }
      }
      return null;
    };
    return { ratio: panelOf(318), majors: panelOf(340), privacy: panelOf(300) };
  });
  console.log('   panels:', JSON.stringify(L));
  is(L.ratio && L.majors && Math.abs(L.ratio.h - L.majors.h) <= 2,
    `ratio + majors panels equal height (${L.ratio?.h} vs ${L.majors?.h})`);
  is(L.ratio && L.majors && Math.abs(L.ratio.top - L.majors.top) <= 2 && L.majors.left > L.ratio.left,
    'ratio + majors share the upper row, majors to the right');
  is(L.privacy && L.ratio && L.privacy.top > L.ratio.bottom - 2,
    'privacy group sits below the paired row');
  is(L.privacy && L.ratio && L.privacy.w > L.ratio.w * 1.8,
    `privacy group is full-width (${L.privacy?.w}px vs a ${L.ratio?.w}px half)`);

  /* seriesColor() is index-keyed, so a refresh must not reshuffle the palette. */
  const strokes = () => d.evaluate(() => {
    const svg = document.querySelector('svg[viewBox$=" 300"]');
    return [...svg.querySelectorAll('path[stroke]')].map((p) => p.getAttribute('stroke'));
  });
  const first = await strokes();
  await d.reload({ waitUntil: 'load' });
  await d.waitForTimeout(2500);
  is(first.length > 0 && JSON.stringify(first) === JSON.stringify(await strokes()),
    `series colours identical across a refresh (${first.length} strokes)`);
  await d.close();
}

/* ── §1d request budget ──────────────────────────────────────────────── */
console.log('\nverify-markets-dom — request budget');
console.log(`   30D cold load: ${upstream} client→origin requests`);
for (const u of seen) console.log('     ' + u);
const cold30 = upstream;
const perRange = { '30D': cold30 };
const rangeMarks = {};
const cgCount = () => seen.filter((u) => u.startsWith('/api/coingecko') && !u.includes('simple/price')).length;
for (const r of ['7D', '90D', '1Y']) {
  const before = upstream;
  const cgBefore = cgCount();
  await page.getByRole('button', { name: r, exact: true }).click();
  await page.waitForTimeout(2000);
  perRange[r] = upstream - before;
  rangeMarks[r] = { cg: cgCount() - cgBefore };
}
console.log('   CoinGecko history requests per preset:', JSON.stringify(rangeMarks));
console.log('   per-range deltas:', JSON.stringify(perRange));
console.log(`   all four ranges: ${upstream} client→origin requests`);

/* The point of the aggregator: 6 + 9 charted coins cost ONE /api/markets call,
   not fifteen market_chart calls. If someone re-fans-out per coin client-side,
   these ceilings break long before a rate limit does in production. */
const marketsCalls = seen.filter((u) => u.startsWith('/api/markets')).length;
is(marketsCalls === 4, `exactly one /api/markets call per range, 4 total (got ${marketsCalls})`);
/* Budget the HISTORY surface only. The raw totals above also carry the
   /api/xmr/* feed tiers (3s mempool+fees), so how many of those land inside a
   2.5s settle window is a stopwatch race, not a property of this page. */
const isHist = (u) => (u.startsWith('/api/markets') || u.startsWith('/api/coingecko')) && !u.includes('simple/price');
const hist = seen.filter(isHist);
const hist30 = seen.slice(0, cold30).filter(isHist).length;
/* p3·12 tightened all three literals to the measured post-change counts, and
   the tightening is the assertion — 6/21/3 stayed GREEN against the new code
   while it did strictly less work, so leaving them would have made the whole
   §1d block blind to the change it exists to police.
   Baseline (84e2b77) vs branch, measured on this gate:
       30D cold          6 -> 5   (the BTC/USD line was fetched and never drawn)
       all four ranges  21 -> 10
       market_chart/range 3 -> 1 */
is(hist30 <= 5, `30D cold load: ≤5 history requests (${hist30}) — 1 aggregator + XMR ohlc + XMR/usd + XMR/btc + tickers`);
is(hist.length <= 10, `all four ranges: ≤10 history requests (${hist.length}) — the pair bases are fetched at most twice each, whatever the presets do`);
/* The client may only fetch history for the three series it owns directly —
   XMR/USD, XMR/BTC, BTC/USD. Every GROUP coin's history must arrive inside the
   /api/markets envelope. A stray coins/<peer>/market_chart here means someone
   re-introduced a client-side per-coin fan-out, which is what 6+9 members would
   turn into ~15 extra calls per range. */
const chartIds = [...new Set(seen
  .map((u) => /path=coins\/([^/]+)\/market_chart/.exec(u))
  .filter(Boolean).map((m) => m[1]))].sort();
/* 'bitcoin' is GONE from this list, and its absence is a fix rather than a
   regression: `btcLine` (coins/bitcoin/market_chart) was fetched on every range
   change and read by nothing — no consumer anywhere in src/, confirmed
   repo-wide. Four wasted round trips per visit against a 10,000-call month. */
is(JSON.stringify(chartIds) === JSON.stringify(['monero']),
  `client fetches history for monero only — no unread series (got ${JSON.stringify(chartIds)})`);
const perRangeCharts = seen.filter((u) => /market_chart/.test(u)).length / 4;
is(perRangeCharts <= 1, `≤1 market_chart call per range regardless of group size (${perRangeCharts})`);
/* The FINE base is a base, not a range: one /ohlc call covers every window
   ≤30 days, so four presets cost one call and not four. */
const ohlcCalls = seen.filter((u) => /\/ohlc/.test(u)).length;
is(ohlcCalls === 1, `exactly one /ohlc call for all four ranges (got ${ohlcCalls})`);
/* The headline behaviour, stated as a delta rather than a total: a preset whose
   window is already covered by a fetched base must cost NOTHING but the
   aggregator. 1Y is the one exception and it is bounded — it buys the deep
   base once, for the life of the page. */
is(rangeMarks['7D'].cg === 0, `7D preset issues 0 CoinGecko history requests (got ${rangeMarks['7D'].cg})`);
is(rangeMarks['90D'].cg === 0, `90D preset issues 0 CoinGecko history requests (got ${rangeMarks['90D'].cg})`);
is(rangeMarks['1Y'].cg <= 2, `1Y preset buys the deep base once: ≤2 requests (got ${rangeMarks['1Y'].cg})`);

/* ── the canvas hero: density, parity, DOM labels, the brush ──────────
   D0843/D0847. Everything here is about the thing a canvas cannot do for
   itself: be read. The count is asserted from TWO independent expressions —
   the root's data-candle-count and the accessible table's own row count — so
   a chart that silently drew nothing cannot pass by also listing nothing. */
console.log('\nverify-markets-dom — canvas hero');
{
  const h = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  await h.route('**/api/**', fulfil);
  await h.goto(base + '/live/markets', { waitUntil: 'load' });
  await h.waitForTimeout(2500);

  const shape = await h.evaluate(() => ({
    canvases: document.querySelectorAll('.cc-canvas').length,
    brush: document.querySelectorAll('[data-candle-brush] canvas').length,
    win: !!document.querySelector('[data-brush-window]'),
    table: !!document.querySelector('[data-candle-table]'),
    tableHidden: (() => {
      const t = document.querySelector('[data-candle-table]');
      if (!t) return 'absent';
      const cs = getComputedStyle(t);
      return cs.display === 'none' || cs.visibility === 'hidden' ? 'hidden' : 'shown';
    })(),
    svgCandles: document.querySelectorAll('svg[viewBox$=" 320"]').length,
  }));
  is(shape.canvases === 1, `hero draws on exactly one <canvas> (got ${shape.canvases})`);
  is(shape.brush === 1, `the brush strip renders its own canvas (got ${shape.brush})`);
  is(shape.win, 'the brush window is a real element, not a painted rectangle');
  is(shape.table, 'D0847: the accessible table is in the DOM');
  is(shape.tableHidden === 'shown',
    `D0847: the table is CLIPPED, never display:none — a screen reader has no other way in (${shape.tableHidden})`);
  is(shape.svgCandles === 0, `the old SVG candle chart is gone (${shape.svgCandles} left)`);

  /* NO TEXT ON THE CANVAS. There is no way to ask a canvas what glyphs it
     painted, so this asserts the positive form instead: the labels exist as DOM
     nodes, they carry real text, and they sit at or above the repo's 11px
     floor. A canvas-text regression takes this to zero. */
  const labels = await h.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('.cc-labels > span, .cc-table th, .cc-table td, .cc-table caption')) {
      const txt = (el.textContent || '').trim();
      if (!txt) continue;
      out.push({ txt, fs: parseFloat(getComputedStyle(el).fontSize) });
    }
    return out;
  });
  const tiny = labels.filter((l) => l.fs < 11);
  is(labels.length >= 8, `hero labels are DOM nodes, not canvas glyphs (${labels.length} found)`);
  is(tiny.length === 0, `every hero label is ≥11px, the repo's declared floor (${tiny.length} under)`);
  if (tiny.length) console.log('   under floor:', JSON.stringify(tiny.slice(0, 6)));

  /* Density + parity per range. The counts are the point of §2: at 90D the
     upstream's own /ohlc buckets are FOUR DAYS wide, which is 22 bars for a
     quarter of a year — measured on 84e2b77. The ladder now picks the finest
     bucket the fetched base honestly supports. */
  const readRange = () => h.evaluate(() => {
    const root = document.querySelector('[data-candle-count]');
    const table = document.querySelector('[data-candle-table]');
    return {
      count: Number(root?.getAttribute('data-candle-count') ?? -1),
      gran: root?.getAttribute('data-candle-gran') ?? '',
      base: root?.getAttribute('data-candle-base') ?? '',
      stride: Number(table?.getAttribute('data-table-stride') ?? 0),
      rows: table?.querySelectorAll('tbody tr').length ?? -1,
      caption: table?.querySelector('caption')?.textContent ?? '',
      xticks: [...document.querySelectorAll('.cc-xtick')].map((e) => e.textContent || ''),
    };
  });
  const DENSITY_FLOOR = { '7D': 40, '30D': 170, '90D': 300, '1Y': 110 };
  for (const r of ['7D', '30D', '90D', '1Y']) {
    await h.getByRole('button', { name: r, exact: true }).click();
    await h.waitForTimeout(1200);
    const m = await readRange();
    console.log(`   ${r}: ${m.count} bars · ${m.gran} · base=${m.base} · table ${m.rows} rows (stride ${m.stride})`);
    is(m.count >= DENSITY_FLOOR[r] && m.count <= 420,
      `${r} draws ${m.count} candles — ≥${DENSITY_FLOOR[r]} and inside the 420 ceiling`);
    /* PARITY. Two expressions of one number: if they can disagree, neither is
       evidence about the other. */
    /* `m.count > 0` is this assertion's VACUITY GUARD, not decoration: with no
       chart at all the probe reads -1/-1/0 and `ceil(-1/1) === -1` is TRUE, so
       the parity check passes hardest exactly when there is nothing to be in
       parity about. Measured on the baseline build, where it did. */
    is(m.count > 0 && m.rows === Math.ceil(m.count / Math.max(1, m.stride)),
      `${r} table lists 1 row per ${m.stride} of ${m.count} candles = ${m.rows} rows`);
    is(m.stride >= 1 && (m.stride === 1 || /every \d+/.test(m.caption)),
      `${r} caption states the stride when it strides (${m.stride})`);
    is(/^\d+[hdw] · (CG OHLC|hourly samples|daily samples)$/.test(m.gran),
      `${r} granularity names its bucket AND its source: "${m.gran}"`);
  }

  /* THE DATE AXIS ADAPTS TO THE SPAN, NOT THE PRESET (§4). No preset is under
     six days, so the hours format is reachable ONLY through the brush — which
     makes this one assertion cover the axis ladder and a real brush drag at
     once. Home resets the window; the keyboard path is the same code the
     pointer drag uses. */
  const axisAt = async (r) => {
    await h.getByRole('button', { name: r, exact: true }).click();
    await h.waitForTimeout(900);
    return (await readRange()).xticks;
  };
  const t30 = await axisAt('30D');
  is(t30.length > 2 && t30.every((t) => /^\d{1,2} [A-Z][a-z]{2}$/.test(t)),
    `30D axis reads "12 Mar" (${JSON.stringify(t30.slice(0, 3))})`);
  const t1y = await axisAt('1Y');
  is(t1y.length > 2 && t1y.every((t) => /^[A-Z][a-z]{2} '\d{2}$/.test(t)),
    `1Y axis reads "Mar '25" (${JSON.stringify(t1y.slice(0, 3))})`);

  /* Brush: zoom in with the keyboard until the window is under six days, and
     the axis must switch to hours. Also proves the window element takes focus
     and that a zoom costs no request. */
  const cgBefore = await h.evaluate(() => performance.getEntriesByType('resource').filter((e) => e.name.includes('/api/coingecko')).length);
  await h.getByRole('button', { name: '7D', exact: true }).click();
  await h.waitForTimeout(700);
  /* An ABSENT brush must reach `is()` as a red assertion, never as a thrown
     locator timeout. Measured against the 84e2b77 build while establishing the
     red polarity for this section: `page.focus` threw at 30 s and killed the
     run, so the four assertions after it never reported at all and the summary
     line never printed. A gate whose failure mode is an exception cannot tell
     you WHICH of its claims broke. */
  const hasBrush = (await h.$('[data-brush-window]')) !== null;
  if (!hasBrush) {
    for (const m of ['the brush window is keyboard-focusable',
                     'a brush zoom under six days switches the axis to hours',
                     'the table follows the brush, not the preset',
                     'zooming the brush issues no history request',
                     'Home resets the brush to the full fetched span']) {
      bad(`${m} — NO [data-brush-window] in the DOM`);
    }
  } else {
  await h.focus('[data-brush-window]');
  const focused = await h.evaluate(() => document.activeElement?.hasAttribute('data-brush-window') ?? false);
  is(focused, 'the brush window is keyboard-focusable (a pointer-only control is half a control)');
  for (let i = 0; i < 6; i++) { await h.keyboard.press('+'); await h.waitForTimeout(120); }
  await h.waitForTimeout(700);
  const zoomed = await readRange();
  is(zoomed.xticks.length > 2 && zoomed.xticks.every((t) => /^\d{2}:00$/.test(t)),
    `a brush zoom under six days switches the axis to hours (${JSON.stringify(zoomed.xticks.slice(0, 3))})`);
  is(zoomed.count > 0 && zoomed.rows === Math.ceil(zoomed.count / Math.max(1, zoomed.stride)),
    `the table follows the brush, not the preset (${zoomed.count} bars, ${zoomed.rows} rows)`);
  const cgAfter = await h.evaluate(() => performance.getEntriesByType('resource').filter((e) => e.name.includes('/api/coingecko')).length);
  is(cgAfter === cgBefore, `zooming the brush issues no history request (${cgBefore} → ${cgAfter})`);

  /* Home resets to the whole fetched span — the keyboard twin of double-click. */
  await h.keyboard.press('Home');
  await h.waitForTimeout(900);
  const reset = await readRange();
  is(reset.count > zoomed.count, `Home resets the brush to the full fetched span (${zoomed.count} → ${reset.count} bars)`);
  }

  await h.close();
}

/* ── total outage ────────────────────────────────────────────────────── */
console.log('\nverify-markets-dom — outage');
const off = await b.newPage({ viewport: { width: 1440, height: 900 } });
await off.route('**/api/**', (r) => r.abort());
await off.goto(base + '/live/markets', { waitUntil: 'load' });
await off.waitForTimeout(2500);
const offText = await off.evaluate(() => document.body.innerText);
is(/unavailable/i.test(offText), 'outage: an honest "unavailable" badge is rendered');
is(!/\bDASH\b|\bZEC\b|\bBCN\b/.test(offText), 'outage: no group membership invented with an empty cache');
is(!/\$\d[\d,]*\.\d\d\b/.test(offText), 'outage: no price numerals anywhere — em dashes only');

await b.close();
console.log(fails ? `\n❌ verify-markets-dom: ${fails} assertion(s) failed` : '\n✅ verify-markets-dom: all assertions passed');
process.exit(fails ? 1 : 0);
