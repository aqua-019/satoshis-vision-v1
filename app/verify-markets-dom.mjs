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

const cgChart = (n, p0) => {
  const { t, p } = pts(n, p0, 0.08);
  return { prices: t.map((x, i) => [x, p[i]]), total_volumes: t.map((x) => [x, 1.2e8]) };
};

function fulfil(route) {
  const url = route.request().url();
  const json = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  const m = /\/api\/markets\?days=(\d+)/.exec(url);
  if (m) return json(envelope(Number(m[1])));
  if (url.includes('/api/coingecko')) {
    if (url.includes('simple')) return json({ monero: { usd: 372.1, usd_24h_change: 1.2 }, bitcoin: { usd: 97000, usd_24h_change: -0.3 } });
    if (url.includes('ohlc')) {
      const { t, p } = pts(180, 372, 0.1);
      return json(t.map((x, i) => [x, p[i], p[i] * 1.02, p[i] * 0.98, p[i] * 1.005]));
    }
    if (url.includes('market_chart')) return json(cgChart(180, url.includes('vs_currency=btc') ? 0.0038 : 372));
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
await page.goto(base + '/markets', { waitUntil: 'load' });
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
  await d.goto(base + '/markets', { waitUntil: 'load' });
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
for (const r of ['7D', '90D', '1Y']) {
  const before = upstream;
  await page.getByRole('button', { name: r, exact: true }).click();
  await page.waitForTimeout(2000);
  perRange[r] = upstream - before;
}
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
is(hist30 <= 6, `30D cold load: ≤6 history requests (${hist30}) — 1 aggregator + XMR ohlc + XMR/usd + XMR/btc + BTC/usd + tickers`);
is(hist.length <= 21, `all four ranges: ≤21 history requests (${hist.length}) — +5 per extra range, flat in group size`);
/* The client may only fetch history for the three series it owns directly —
   XMR/USD, XMR/BTC, BTC/USD. Every GROUP coin's history must arrive inside the
   /api/markets envelope. A stray coins/<peer>/market_chart here means someone
   re-introduced a client-side per-coin fan-out, which is what 6+9 members would
   turn into ~15 extra calls per range. */
const chartIds = [...new Set(seen
  .map((u) => /path=coins\/([^/]+)\/market_chart/.exec(u))
  .filter(Boolean).map((m) => m[1]))].sort();
is(JSON.stringify(chartIds) === JSON.stringify(['bitcoin', 'monero']),
  `client fetches history for monero+bitcoin only (got ${JSON.stringify(chartIds)})`);
const perRangeCharts = seen.filter((u) => /market_chart/.test(u)).length / 4;
is(perRangeCharts <= 3, `≤3 market_chart calls per range regardless of group size (${perRangeCharts})`);

/* ── total outage ────────────────────────────────────────────────────── */
console.log('\nverify-markets-dom — outage');
const off = await b.newPage({ viewport: { width: 1440, height: 900 } });
await off.route('**/api/**', (r) => r.abort());
await off.goto(base + '/markets', { waitUntil: 'load' });
await off.waitForTimeout(2500);
const offText = await off.evaluate(() => document.body.innerText);
is(/unavailable/i.test(offText), 'outage: an honest "unavailable" badge is rendered');
is(!/\bDASH\b|\bZEC\b|\bBCN\b/.test(offText), 'outage: no group membership invented with an empty cache');
is(!/\$\d[\d,]*\.\d\d\b/.test(offText), 'outage: no price numerals anywhere — em dashes only');

await b.close();
console.log(fails ? `\n❌ verify-markets-dom: ${fails} assertion(s) failed` : '\n✅ verify-markets-dom: all assertions passed');
process.exit(fails ? 1 : 0);
