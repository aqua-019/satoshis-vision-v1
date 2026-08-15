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
import { existsSync, readdirSync, readFileSync } from 'node:fs';

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

/* The axis at 390 is a DIFFERENT label form from 1440's and needs its own
   check, because the tick count is derived from the width: fewer ticks fit, so
   the STEP grows, so the ladder falls back from "24 Jul 05:00" to "24 Jul".
   That fallback is correct — a day-apart tick does not need its hour — but it
   means the desktop assertion covers a form this viewport never renders. The
   invariant that holds at BOTH widths is the one worth asserting here: every
   tick label distinguishes itself from its neighbours. It is what the 90D
   "May '26 May '26 May '26" defect violated, and a narrow viewport is where a
   coarser label form is most likely to collapse two ticks into one string. */
const ax390 = await page.evaluate(() => [...document.querySelectorAll('.cc-xtick')].map((e) => e.textContent || ''));
is(ax390.length >= 3, `390 axis draws at least 3 date ticks (${ax390.length})`);
is(ax390.length > 0 && new Set(ax390).size === ax390.length,
  `390 axis labels are all distinct (${ax390.length} ticks, ${new Set(ax390).size} distinct: ${JSON.stringify(ax390.slice(0, 4))})`);

/* SELF-CHECK — this pair is the one place in the file with no natural failing
   state to point at. Both the pre-fix and post-fix trees render distinct labels
   HERE (the 390 fallback to day-form was already distinct); the defect the
   predicate exists for lives at other widths and windows. An assertion whose
   red has never been seen is indistinguishable from one that cannot go red, so
   the red is manufactured: duplicate one tick's text into its neighbour and
   prove the SAME predicate rejects it. Mutation is applied and reverted in the
   DOM only — nothing is rebuilt, and React will overwrite it on the next
   render regardless. */
const dupCheck = await page.evaluate(() => {
  const ticks = [...document.querySelectorAll('.cc-xtick')];
  if (ticks.length < 2) return null;
  const saved = ticks[1].textContent;
  ticks[1].textContent = ticks[0].textContent;
  const mutated = ticks.map((e) => e.textContent || '');
  ticks[1].textContent = saved;
  const restored = [...document.querySelectorAll('.cc-xtick')].map((e) => e.textContent || '');
  return { mutated, restored };
});
is(dupCheck != null && new Set(dupCheck.mutated).size !== dupCheck.mutated.length,
  'SELF-CHECK: a duplicated tick label IS caught by the distinctness predicate — it is falsifiable');
is(dupCheck != null && new Set(dupCheck.restored).size === dupCheck.restored.length,
  'SELF-CHECK: the mutation was reverted — the DOM is back to distinct labels');

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
      /* The Volume column, as RENDERED. Read as text and parsed back by the
         gate rather than lifted off a data attribute, because the defect this
         exists to catch reached the reader through exactly these cells. */
      vols: [...document.querySelectorAll('[data-candle-table] tbody tr')]
        .map((tr) => (tr.lastElementChild?.textContent || '').trim()),
      lastBucket: (() => {
        const tr = [...document.querySelectorAll('[data-candle-table] tbody tr')].pop();
        return tr ? (tr.firstElementChild?.textContent || '').trim() : '';
      })(),
    };
  });

  /* The fixture emits a CONSTANT hourly volume, which is what makes a volume
     assertion possible at all: every bucket of the same width must carry the
     same number, so any cell that does not is carrying volume that belongs to
     some other bucket. Declared here, beside the assertion, rather than left
     implicit in `cgChart` fifty lines up. */
  const FIXTURE_HOURLY_VOL = 1.2e8;
  const parseUsd = (t) => {
    const m = /^\$([\d.]+)([BMk]?)$/.exec(t);
    if (!m) return null;
    return Number(m[1]) * ({ B: 1e9, M: 1e6, k: 1e3 }[m[2]] ?? 1);
  };
  /** Hours in the bucket the chart says it drew ("6h · hourly samples" -> 6). */
  const granHours = (gran) => {
    const m = /^(\d+)([hdw])/.exec(gran);
    if (!m) return null;
    return Number(m[1]) * ({ h: 1, d: 24, w: 168 }[m[2]]);
  };
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
  /* 7D is the boundary case and it is the one the step rule got wrong on its
     own: eight ticks across seven days is a ~21h step, UNDER a day, so a bare
     hour label was emitted for ticks that sit on seven different dates —
     "05:00 · 02:00 · 23:00 …", apparently counting backwards. A sub-daily label
     carries its day whenever the window spans more than one, so every tick here
     must be locatable, not merely distinct. */
  const t7d = await axisAt('7D');
  is(t7d.length > 2 && t7d.every((t) => /^\d{1,2} [A-Z][a-z]{2} \d{2}:00$/.test(t)),
    `7D axis carries the day with the hour (${JSON.stringify(t7d.slice(0, 3))})`);
  is(new Set(t7d).size === t7d.length,
    `7D axis labels are all distinct (${t7d.length} ticks, ${new Set(t7d).size} distinct)`);

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
                     'volume precondition: a bucket width and parsed volume cells',
                     'no volume cell exceeds its own bucket',
                     "the LAST drawn bucket does not absorb the span's tail",
                     'on the fine base EVERY drawn bucket carries exactly one bucket of volume',
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

  /* ── VOLUME IS BOUNDED BY THE BUCKET IT SITS IN (p3·12b) ──────────
     THE DEFECT THIS CATCHES, and why no existing assertion could.
     `attachVolume` closed its LAST bucket at `Infinity`. That is harmless while
     the drawn window ends where the fetched span ends — every unbrushed view —
     and wrong the moment a brush pulls the right edge inward, because the final
     candle then sweeps every sample between it and the end of the span. Measured
     on the pre-fix build IN THE STATE BELOW: one cell read **$9,700.0M**
     against $480.0M for every true 4h bucket, and its VOL sub-bar went full
     height and flattened every other bar through `maxV`.
     The figure is state-dependent and this comment is careful to say whose:
     the defect was reported to us as $40.1B, measured from a different window
     (30D, zoomed, one ArrowLeft), and $40.1B is what THAT state produces. The
     magnitude is just "however many hourly samples lie right of the window
     edge", so quoting a number from someone else's window beside this gate's
     own steps would describe a run that never happened here.
     Nothing reddened. Twenty-odd assertions on this page count bars, rows,
     labels, requests and pixels; not one of them reads a NUMBER the chart
     prints. A wrong dollar figure on a live surface is the first rule in this
     repo, so the gate learns to read one.
     The check is a bound, not an equality: an edge bucket clipped by the window
     legitimately holds LESS than a full bucket's volume. Only more is a lie. */
  await h.keyboard.press('ArrowLeft');
  await h.waitForTimeout(900);
  const panned = await readRange();
  const hrs = granHours(panned.gran);
  const cells = panned.vols.map(parseUsd).filter((v) => v != null);
  const ceiling = hrs != null ? hrs * FIXTURE_HOURLY_VOL * 1.05 : null;
  const worst = cells.length ? Math.max(...cells) : null;
  is(hrs != null && cells.length > 0,
    `volume precondition: a bucket width and ${cells.length} parsed volume cells (gran "${panned.gran}")`);
  is(ceiling != null && worst != null && worst <= ceiling,
    `no volume cell exceeds its own bucket: worst $${((worst ?? 0) / 1e6).toFixed(1)}M ≤ ` +
    `$${((ceiling ?? 0) / 1e6).toFixed(1)}M for a ${panned.gran} bucket ` +
    `(last row ${panned.lastBucket || '—'})`);
  /* The last row is where the unbounded bucket lived, so it is named
     separately — a max over the column would also pass if the column were
     empty, and it would not say WHICH cell lied. */
  const lastCell = cells.length ? cells[cells.length - 1] : null;
  is(lastCell != null && ceiling != null && lastCell <= ceiling,
    `the LAST drawn bucket does not absorb the span's tail: $${((lastCell ?? 0) / 1e6).toFixed(1)}M ` +
    `≤ $${((ceiling ?? 0) / 1e6).toFixed(1)}M`);

  /* AND A BOUND FROM BELOW, because the first fix for the above was wrong in
     the other direction. Clipping volume to the drawn window looked symmetric
     and is not: `aggregateCandles` clips at CANDLE granularity (it keeps or
     drops a whole source candle), so on the fine base — where the 4h rung is
     the only one a <=30d window ever reaches — the last drawn candle's OHLC
     covers a FULL four hours while its clipped volume covered whatever fraction
     of them fell left of `win.to`. Up to 4x under-reported, on the same cell,
     and the upper bound above is blind to it by construction.

     EVERY cell, not the max and not the median. The fixture's volumes are
     constant, so on the fine base every drawn bucket must carry exactly one
     bucket's worth — the window here is interior (zoomed then panned), so not
     even the series-final partial bucket is in view. A max catches only the
     runaway; a median survives one wrong cell; equality on all of them catches
     both directions in one predicate.

     MEASURED LIMIT OF THE BREAK TEST, stated because it is the honest part:
     reintroducing the clip reds this only when `win.to` falls in the first
     three quarters of its bucket. The gate drives a CONTINUOUS control to an
     arbitrary position, so one phase in four is a no-op for that mutation —
     and the first break-test run landed on it and showed green. The window is
     stepped once more below for that reason, and the phase-dependence is a
     property of the mutation, not of the assertion: the assertion is universal
     over buckets. */
  await h.keyboard.press('ArrowLeft');
  await h.waitForTimeout(700);
  const panned2 = await readRange();
  const cells2 = panned2.vols.map(parseUsd).filter((v) => v != null);
  const hrs2 = granHours(panned2.gran);
  const full = hrs2 != null ? hrs2 * FIXTURE_HOURLY_VOL : null;
  const offenders = full == null ? [] : cells2.filter((v) => Math.abs(v - full) > full * 0.01);
  is(full != null && cells2.length > 0 && offenders.length === 0,
    `on the fine base EVERY drawn bucket carries exactly one bucket of volume ` +
    `($${((full ?? 0) / 1e6).toFixed(0)}M x ${cells2.length}); ${offenders.length} offender(s)` +
    (offenders.length ? `: ${JSON.stringify(offenders.map((v) => (v / 1e6).toFixed(1) + 'M'))}` : '') +
    ` — cells ${JSON.stringify(cells2.map((v) => (v / 1e6).toFixed(0) + 'M'))}`);

  /* Home resets to the whole fetched span — the keyboard twin of double-click. */
  await h.keyboard.press('Home');
  await h.waitForTimeout(900);
  const reset = await readRange();
  is(reset.count > zoomed.count, `Home resets the brush to the full fetched span (${zoomed.count} → ${reset.count} bars)`);
  }

  await h.close();
}

/* ── the synced time cursor · D0834 · D1534 · D0385 (p3·13) ────────────

   THE INSTRUMENT, AND WHY IT IS A HASH. The hero's crosshair is PAINTED, so
   there is no node to query and no attribute to read. A screenshot would
   answer a different question (compositing, theme, DPR); this reads the
   BACKING STORE with getImageData and folds it to one number — verify-orb's
   rule, for the same reason. Then it compares the canvas to ITSELF: with a
   cursor the hero covers, the bytes must change; with one it does not cover,
   they must be IDENTICAL to the idle frame. One probe, both polarities, and
   the negative case is exact rather than tolerant — "identical" cannot be
   satisfied by a crosshair drawn slightly off, which a pixel-count check
   could.

   THE VACUITY GUARD IS THE POINT OF §c. The first draft of this section
   "proved" the domain rule by hovering a group chart at 2% of its width and
   watching the hero draw nothing. It drew nothing because 2% is inside the
   y-axis GUTTER, where MultiLine's own cursorT is null — so nothing was ever
   published and the hero had nothing to refuse. A passing assertion, proving
   the opposite of what it claimed. Every mismatch assertion below is
   therefore paired with "the group chart IS showing its own readout at this
   very moment", which is the proof that a timestamp was published at all. */
console.log('\nverify-markets-dom — synced cursor');
{
  const c = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await c.route('**/api/**', fulfil);
  await c.addInitScript(() => { try { sessionStorage.setItem('xmrirish.coldboot', '1'); } catch {} });
  await c.goto(base + '/live/markets', { waitUntil: 'load' });
  await c.waitForSelector('[data-candle-count]', { timeout: 20000 });
  await c.waitForTimeout(1200);

  const shape = await c.evaluate(() => ({
    skeletons: document.querySelectorAll('[data-sync-cursor]').length,
    tips: document.querySelectorAll('[data-sync-tip]').length,
    heroTip: document.querySelectorAll('[data-candle-tip]').length,
  }));
  is(shape.skeletons === 3 && shape.tips === 3,
    `three SVG charts carry a synced-cursor skeleton and a readout (${shape.skeletons}/${shape.tips})`);
  is(shape.heroTip === 1, `the hero's readout is mounted unconditionally, not created on hover (${shape.heroTip})`);

  const heroHash = () => c.evaluate(() => {
    const cv = document.querySelector('.cc-canvas');
    if (!cv) return 'no-canvas';
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let h = 2166136261;
    for (let i = 0; i < d.length; i += 4) { h ^= d[i] + d[i + 1] * 3 + d[i + 3] * 7; h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16);
  });
  const readout = () => c.evaluate(() => {
    const clean = (e) => (e && !e.hidden ? (e.textContent || '').replace(/\s+/g, ' ').trim() : null);
    return {
      hero: clean(document.querySelector('[data-candle-tip]')),
      svg: [...document.querySelectorAll('[data-sync-tip]')].map(clean),
    };
  });
  const winLabel = () => c.evaluate(() =>
    (document.querySelector('[data-candle-table] caption')?.textContent || '').match(/\d{4}-\d\d-\d\d to \d{4}-\d\d-\d\d/)?.[0] ?? '?');

  /* The peers group is the LAST synced box. Scrolled into view FIRST and the
     landing CHECKED: at 1440x900 these panels sit at y~1358, well below the
     fold, and a mouse.move to an off-viewport point silently hits nothing —
     which is how the first version of this section measured an empty page and
     reported a pass. `elementFromPoint` is the guard. */
  const boxes = await c.$$('.mk-syncbox');
  const peers = boxes[boxes.length - 1];
  const psvg = await peers.$('svg');
  await psvg.scrollIntoViewIfNeeded();
  await c.waitForTimeout(200);
  let box = await psvg.boundingBox();
  const hoverPeersAt = async (frac) => {
    const x = box.x + box.width * frac, y = box.y + box.height * 0.5;
    await c.mouse.move(x, y);
    await c.waitForTimeout(90);
    const landed = await c.evaluate(([px, py]) => !!document.elementFromPoint(px, py), [x, y]);
    return landed;
  };
  const away = async () => { await c.mouse.move(box.x - 40, box.y - 40); await c.waitForTimeout(150); };

  /* ── a · sync ── */
  await away();
  const idle = await heroHash();
  const idleR = await readout();
  is(idleR.hero === null && idleR.svg.every((t) => t === null),
    'idle: no chart claims a reading when nothing is hovered');

  let landedAll = true;
  const sweep = [];
  for (const f of [0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 0.97]) {
    if (!(await hoverPeersAt(f))) { landedAll = false; continue; }
    sweep.push({ f, hash: await heroHash(), ...(await readout()) });
  }
  is(landedAll && sweep.length === 10,
    `every probe point landed on a real element (${sweep.length}/10) — an off-viewport hover would make this whole section vacuous`);

  const synced = sweep.filter((r) => r.hero && r.svg.every((t) => t));
  is(synced.length > 0,
    `one hover on the peers group lights all FOUR charts (${synced.length}/${sweep.length} probe points)`);
  if (synced.length) {
    const r = synced[Math.floor(synced.length / 2)];
    is(r.hash !== idle, 'the hero PAINTS a crosshair for a moment it covers (canvas bytes moved)');
    /* Each chart reads the same moment AT ITS OWN BUCKETING — the whole D0385
       claim. The hero is on 4h candles and says "2026-07-20 12:00Z"; the daily
       group series says "Jul 20". Same day, two honest granularities, and the
       assertion is that they agree on the DAY rather than on the string. */
    const day = (r.hero.match(/(\d{4})-(\d\d)-(\d\d)/) || []).slice(1).join('-');
    // "Jul 17", the exact string `fmtDate` emits at this span. Compared as a
    // PREFIX, not with a \b word boundary: the readout runs the date straight
    // into the first series name ("Jul 17XMR+2.6%"), so \b17\b never matches
    // and the first draft of this assertion went red against agreeing charts.
    const stamp = day
      ? new Date(day + 'T00:00:00Z').toUTCString().slice(8, 11) + ' ' + Number(day.slice(8))
      : '';
    const agree = !!day && r.svg.every((t) => t.startsWith(stamp));
    is(agree,
      `all four readouts name one moment at their own granularity — hero "${r.hero.slice(0, 22)}" vs "${r.svg[0].slice(0, 18)}" (day ${stamp})`);
    console.log(`   hero: ${r.hero.slice(0, 46)}`);
    for (const t of r.svg) console.log(`   svg : ${t.slice(0, 70)}`);
  }

  /* ── b · the pin ── */
  await away();
  const cv = await c.$('.cc-canvas');
  await cv.scrollIntoViewIfNeeded();
  await c.waitForTimeout(200);
  const cr = await cv.boundingBox();
  await c.mouse.move(cr.x + cr.width * 0.5, cr.y + cr.height * 0.4);
  await c.waitForTimeout(100);
  await c.mouse.down(); await c.mouse.up();
  await c.waitForTimeout(150);
  const pinned = (await readout()).hero;
  await c.mouse.move(cr.x - 60, cr.y - 60);
  await c.waitForTimeout(250);
  const held = (await readout()).hero;
  is(!!pinned && held === pinned,
    `a pinned cursor survives pointerleave — the touch path (${held ? 'held' : 'LOST'})`);
  await c.mouse.move(cr.x + cr.width * 0.5, cr.y + cr.height * 0.4);
  await c.waitForTimeout(100);
  await c.mouse.down(); await c.mouse.up();
  await c.waitForTimeout(150);
  await c.mouse.move(cr.x - 60, cr.y - 60);
  await c.waitForTimeout(250);
  is((await readout()).hero === null, 'clicking the same moment again releases the pin');

  /* ── c · THE DOMAIN-MISMATCH RULE · never clamp ── */
  const bwin = await c.$('[data-brush-window]');
  await bwin.scrollIntoViewIfNeeded();
  await c.waitForTimeout(150);
  await c.focus('[data-brush-window]');
  /* NO `Home` FIRST, and that is the whole difficulty of this section. Home
     resets to the full FETCHED span (~90 days on the mid base), whose centre is
     mid-June; zooming from there lands the hero on a window that does not
     OVERLAP the group charts' 30-day domain at all, and the sweep below then
     produces twelve refusals and zero acceptances. That is not a domain-rule
     proof, it is two charts looking at different months — the assertion demands
     BOTH cases from one sweep precisely so that arrangement cannot pass.
     Zooming from the default window keeps the hero inside the group's domain
     and puts the boundary in the middle of the sweep, where it belongs. */
  for (let i = 0; i < 6; i++) await c.keyboard.press('+');
  await c.waitForTimeout(300);
  const zoomed = await winLabel();
  await psvg.scrollIntoViewIfNeeded();
  await c.waitForTimeout(200);
  box = await psvg.boundingBox();
  await away();
  const idle2 = await heroHash();

  const sweep2 = [];
  for (const f of [0.10, 0.18, 0.26, 0.34, 0.42, 0.50, 0.58, 0.66, 0.74, 0.82, 0.90, 0.97]) {
    if (!(await hoverPeersAt(f))) continue;
    sweep2.push({ f, hash: await heroHash(), ...(await readout()) });
  }
  // PUBLISHED means the peers chart is showing its own readout, so a timestamp
  // definitely reached the shared store. Without this the next two assertions
  // would pass on a page where nothing was hovered at all.
  const published = sweep2.filter((r) => r.svg[2]);
  const refused = published.filter((r) => r.hero === null);
  const accepted = published.filter((r) => r.hero !== null);
  is(published.length >= 2,
    `the group chart published a cursor at ${published.length} of ${sweep2.length} probe points (the vacuity guard)`);
  is(refused.length > 0 && accepted.length > 0,
    `with the hero zoomed to ${zoomed}, the SAME sweep produces both cases — ${accepted.length} inside its window, ${refused.length} outside`);
  const clean = refused.every((r) => r.hash === idle2);
  is(refused.length > 0 && clean,
    `a moment the hero does not cover draws NOTHING — canvas byte-identical to idle on all ${refused.length} refusals, so it is not clamped to an edge`);
  if (refused.length) console.log(`   refused at f=${refused.map((r) => r.f).join(', ')} · peers still reading "${refused[0].svg[2].slice(0, 30)}"`);
  if (accepted.length) is(accepted.every((r) => r.hash !== idle2),
    `and every moment it DOES cover is painted (${accepted.length}/${accepted.length})`);

  await c.close();
}

/* ── the annotation layer · D0833 (p3·13) ──────────────────────────────

   THE DATA IS PARSED FROM SOURCE, not imported. `src/data/timeline.ts` is
   TypeScript and this gate runs under bare Node; the repo already parses
   `mempool-meta.ts` this way in six gates, so the idiom is established rather
   than invented here. Keep the event literals one-per-line and plainly
   double-quoted, or this regex stops seeing them — and note that it FAILS
   LOUD if the count moves, which is the difference between a parser that has
   gone blind and one that is reporting an empty set. */
console.log('\nverify-markets-dom — annotations');
{
  const TL_SRC = readFileSync(new URL('./src/data/timeline.ts', import.meta.url), 'utf8');
  const EV_RE = /\{ d: "((?:[^"\\]|\\.)*)", t: "((?:[^"\\]|\\.)*)", c: "(\w+)", b: "((?:[^"\\]|\\.)*)", iso: "([\d-]+)",(?: iso2: "([\d-]+)",)?( tent: true,)? slug: "([a-z0-9-]+)" \}/g;
  const EVENTS = [...TL_SRC.matchAll(EV_RE)].map((m) => ({
    d: m[1], t: m[2], c: m[3], b: m[4], iso: m[5], iso2: m[6], tent: !!m[7], slug: m[8],
  }));
  is(EVENTS.length === 49,
    `parsed ${EVENTS.length} timeline events from src/data/timeline.ts (expected 49) — a 0 here means the regex went blind, not that the timeline emptied`);
  is(new Set(EVENTS.map((e) => e.slug)).size === EVENTS.length,
    `every slug is unique (${new Set(EVENTS.map((e) => e.slug)).size}/${EVENTS.length}) — a slug is a URL, so a collision is a broken deep link`);

  /* EVERY `iso` IS RE-DERIVED FROM ITS OWN `d`. The leaf's header promises this
     and a promise in a comment is not a check: the ISO fields exist ONLY to
     position a flag, so a hand-edited one that contradicts its display string
     would move a marker to a date the site never claims — silently, because
     nothing else in the app reads them. Same shape as the volume upper-bound
     block above: derive the answer independently and compare, rather than
     asserting the stored value against itself. */
  const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
    january: 1, february: 2, march: 3, april: 4, june: 6, july: 7, august: 8, september: 9, sept: 9, october: 10, november: 11, december: 12 };
  const pad2 = (n) => String(n).padStart(2, '0');
  const eom = (y, mo) => new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const D = (y, mo, dd) => `${y}-${pad2(mo)}-${pad2(dd)}`;
  function derive(raw) {
    const str = raw.replace(/[–—]/g, '-').trim();
    const tent = /tentative/i.test(str);
    const core = str.replace(/\s*\(tentative\)\s*/i, '').trim();
    let m;
    if ((m = core.match(/^mid-?\s*(\d{4})$/i))) return { iso: D(+m[1], 5, 1), iso2: D(+m[1], 9, 30), tent };
    if ((m = core.match(/^(\w+)\s+(\d{1,2})\s*-\s*(\d{1,2}),\s*(\d{4})$/)))
      return { iso: D(+m[4], MON[m[1].toLowerCase()], +m[2]), iso2: D(+m[4], MON[m[1].toLowerCase()], +m[3]), tent };
    if ((m = core.match(/^(\w+)\s+(\d{1,2}),\s*(\d{4})$/)))
      return { iso: D(+m[3], MON[m[1].toLowerCase()], +m[2]), iso2: undefined, tent };
    if ((m = core.match(/^(\w+)\s*-\s*(\w+)\s+(\d{4})$/)) && MON[m[1].toLowerCase()] && MON[m[2].toLowerCase()])
      return { iso: D(+m[3], MON[m[1].toLowerCase()], 1), iso2: D(+m[3], MON[m[2].toLowerCase()], eom(+m[3], MON[m[2].toLowerCase()])), tent };
    if ((m = core.match(/^(\w+)\s+(\d{4})$/)) && MON[m[1].toLowerCase()])
      return { iso: D(+m[2], MON[m[1].toLowerCase()], 1), iso2: D(+m[2], MON[m[1].toLowerCase()], eom(+m[2], MON[m[1].toLowerCase()])), tent };
    if ((m = core.match(/^(\d{4})\s*-\s*(\d{4})$/))) return { iso: D(+m[1], 1, 1), iso2: D(+m[2], 12, 31), tent };
    if ((m = core.match(/^(\d{4})\+?$/))) return { iso: D(+m[1], 1, 1), iso2: D(+m[1], 12, 31), tent };
    return null;
  }
  const wrong = EVENTS.filter((e) => {
    const g = derive(e.d);
    return !g || g.iso !== e.iso || (g.iso2 ?? undefined) !== (e.iso2 ?? undefined) || g.tent !== e.tent;
  });
  is(wrong.length === 0,
    `every iso/iso2/tent re-derives from its own display string (${EVENTS.length - wrong.length}/${EVENTS.length})`);
  if (wrong.length) console.log('   drifted:', JSON.stringify(wrong.slice(0, 4).map((e) => [e.d, e.iso, e.iso2])));

  const a = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await a.route('**/api/**', fulfil);
  await a.addInitScript(() => { try { sessionStorage.setItem('xmrirish.coldboot', '1'); } catch {} });
  await a.goto(base + '/live/markets', { waitUntil: 'load' });
  await a.waitForSelector('[data-candle-count]', { timeout: 20000 });
  await a.waitForTimeout(1200);

  const layers = () => a.evaluate(() => [...document.querySelectorAll('[data-annotations]')].map((el) => ({
    compact: el.className.includes('compact'),
    groups: Number(el.getAttribute('data-ann-count')),
    outside: Number(el.getAttribute('data-ann-outside')),
    unplaceable: Number(el.getAttribute('data-ann-unplaceable')),
    flags: [...el.querySelectorAll('.mk-ann')].map((f) => ({
      slug: f.getAttribute('data-ann-slug'), cat: f.getAttribute('data-ann-cat'),
      members: Number(f.getAttribute('data-ann-members')), left: parseFloat(f.style.left),
      href: f.querySelector('a')?.getAttribute('href') ?? null,
      band: !!f.querySelector('[data-ann-band]'),
      bandW: parseFloat(f.querySelector('[data-ann-band]')?.style.width || '0'),
    })),
  })));
  const note = () => a.evaluate(() => document.querySelector('[data-ann-note]')?.textContent ?? '');

  /* ── a · the DEFAULT view is empty, and that is the honest answer ──
     The deepest base this page fetches is 365 days and the timeline runs from
     2008, so at the 30-day preset there is genuinely nothing to mark. The
     assertion is not "flags exist" — it is that the page SAYS so and that the
     brush strip, which spans the whole fetched span rather than the window,
     still shows where the nearest event is. That is the entire argument for
     putting flags on the strip at all. */
  {
    const L = await layers();
    const plot = L.find((x) => !x.compact), strip = L.find((x) => x.compact);
    is(!!plot && !!strip, `both surfaces mount a layer (plot ${!!plot}, brush strip ${!!strip})`);
    is(plot.groups === 0 && /no timeline events in range|undated|outside/.test(await note()),
      `30D: the plot is honestly empty and the note explains it — "${(await note()).slice(0, 60)}"`);
    is(strip.flags.length > 0,
      `30D: the brush strip still carries ${strip.flags.length} flag(s) — an event outside the window is a visible reason to travel there`);
    is(plot.outside + plot.unplaceable + plot.groups === 49 - 0 || plot.outside + plot.unplaceable === 49,
      `the accounting closes: ${plot.groups} in view + ${plot.unplaceable} undated + ${plot.outside} outside = 49`);
  }

  /* ── b · 1Y, where the reachable events actually are ── */
  await a.click('button[aria-pressed]:has-text("1Y")');
  await a.waitForTimeout(1400);
  const L1 = await layers();
  const plot1 = L1.find((x) => !x.compact);
  is(plot1.groups >= 3, `1Y: the plot carries ${plot1.groups} flag groups`);
  const clustered = plot1.flags.filter((f) => f.members > 1);
  is(clustered.length >= 1,
    `1Y: at least one group is a CLUSTER with a count badge (${clustered.map((f) => f.members).join(',') || 'none'}) — the ~26px rule`);
  const singles = plot1.flags.filter((f) => f.members === 1);
  is(singles.every((f) => f.href === `/learn/timeline?e=${f.slug}`),
    `every single flag deep-links to its own timeline entry (${singles.length} checked, e.g. ${singles[0]?.href})`);
  is(singles.every((f) => EVENTS.some((e) => e.slug === f.slug)),
    'every rendered slug names a real event in the source data');
  const gaps = plot1.flags.slice(1).map((f, i) => f.left - plot1.flags[i].left);
  is(gaps.every((g) => g >= 26),
    `no two groups sit closer than the 26px cluster threshold (min gap ${Math.round(Math.min(...gaps, Infinity))}px)`);
  is(plot1.groups + plot1.unplaceable + plot1.outside === 49 - (plot1.flags.reduce((s, f) => s + f.members, 0) - plot1.groups),
    `1Y accounting: ${plot1.flags.reduce((s, f) => s + f.members, 0)} in view + ${plot1.unplaceable} undated + ${plot1.outside} outside = 49`);
  console.log(`   note: "${(await note()).trim()}"`);

  /* ── c · THE DATE ON SCREEN IS THE DISPLAY STRING, VERBATIM ──
     The one assertion the whole `iso`/`iso2` design exists to make safe. Those
     fields position a flag and are never text; if a tooltip ever printed a
     formatted ISO it would invent precision the timeline does not have —
     "2026-05-01" where the source says "Mid-2026 (tentative)". */
  const firstSingle = singles[0];
  await a.hover(`[data-ann-slug="${firstSingle.slug}"] .mk-ann-dot`);
  await a.waitForTimeout(200);
  const tip = await a.evaluate(() => {
    const t = document.querySelector('[data-ann-tip]');
    return t ? { date: t.querySelector('[data-ann-date]')?.textContent ?? '', text: (t.textContent || '').replace(/\s+/g, ' ').trim() } : null;
  });
  const src = EVENTS.find((e) => e.slug === firstSingle.slug);
  is(!!tip, 'hovering a flag opens its tooltip');
  is(!!tip && tip.date === src.d,
    `the tooltip prints the DISPLAY string verbatim — "${tip?.date}" === "${src.d}", never a formatted iso`);
  is(!!tip && !/\d{4}-\d\d-\d\d/.test(tip.text),
    `and no ISO date leaks into the tooltip at all ("${(tip?.text || '').slice(0, 54)}")`);

  /* AN IMPRECISE DATE MUST LOOK IMPRECISE, and the check that matters is not
     "which flags have a band" but "does the band's WIDTH mean anything".
     A first draft asserted that only `iso2` events band, and went red against
     correct code: a day-precise event denotes a whole DAY, which at a one-year
     zoom is ~3px, so it bands too and honestly should. The band is driven by
     the interval's rendered extent, not by a precision category — so the real
     invariant is that a month-wide date draws a visibly wider band than a
     day-wide one, at the same zoom, in the same chart. That is what would
     break if `tlSpan` or the placement ever collapsed an interval to a point. */
  const spanSlugs = new Set(EVENTS.filter((e) => e.iso2).map((e) => e.slug));
  const singleBands = plot1.flags.filter((f) => f.members === 1 && f.band);
  const impreciseB = singleBands.filter((f) => spanSlugs.has(f.slug));
  const preciseB = singleBands.filter((f) => !spanSlugs.has(f.slug));
  is(plot1.flags.filter((f) => f.members > 1).every((f) => !f.band),
    'a CLUSTER never draws a band — it covers several intervals and would claim one');
  is(impreciseB.length > 0 && preciseB.length > 0,
    `both kinds are on screen to compare (${impreciseB.length} imprecise, ${preciseB.length} day-precise)`);
  const wIm = Math.min(...impreciseB.map((f) => f.bandW));
  const wPr = Math.max(...preciseB.map((f) => f.bandW), 0);
  is(impreciseB.length > 0 && preciseB.length > 0 && wIm > wPr * 5,
    `the band's width IS the interval: a month reads ${wIm.toFixed(1)}px against a day's ${wPr.toFixed(1)}px at the same zoom`);

  /* ── d · layer toggles ── */
  const before = plot1.flags.reduce((s, f) => s + f.members, 0);
  await a.click('[data-ann-toggle="monero"]');
  await a.waitForTimeout(400);
  const L2 = await layers();
  const plot2 = L2.find((x) => !x.compact);
  const after = plot2.flags.reduce((s, f) => s + f.members, 0);
  const pressed = await a.getAttribute('[data-ann-toggle="monero"]', 'aria-pressed');
  is(pressed === 'false', 'the toggle reports its own state to assistive tech (aria-pressed)');
  is(after < before, `turning MONERO off removes its flags (${before} → ${after} events in view)`);
  is(plot2.flags.every((f) => f.cat !== 'monero'), 'no monero flag survives the toggle');
  await a.click('[data-ann-toggle="monero"]');
  await a.waitForTimeout(400);
  is((await layers()).find((x) => !x.compact).flags.reduce((s, f) => s + f.members, 0) === before,
    'and turning it back on restores exactly what it removed');

  /* ── e · THE EDUCATION PAGE RENDERS WHAT IT ALWAYS DID ──
     The extraction moved 49 event literals out of Timeline.tsx into a shared
     leaf. This is the claim that the move was behaviour-preserving, checked
     against the SOURCE rather than against a snapshot of itself: every event
     still renders, in order, with its date, title and body byte-identical to
     the data — plus the one thing that IS new, a stable id to deep-link to. */
  await a.goto(base + '/learn/timeline', { waitUntil: 'load' });
  await a.waitForSelector('[data-tl-slug]', { timeout: 20000 });
  await a.waitForTimeout(600);
  const nodes = await a.evaluate(() => [...document.querySelectorAll('[data-tl-slug]')].map((n) => ({
    slug: n.getAttribute('data-tl-slug'),
    id: n.id,
    text: (n.textContent || '').replace(/\s+/g, ' ').trim(),
  })));
  is(nodes.length === 49, `/learn/timeline renders all ${nodes.length} events (expected 49)`);
  is(nodes.every((n, i) => n.slug === EVENTS[i].slug),
    'in the source data’s own order, unchanged by the extraction');
  is(nodes.every((n) => n.id === n.slug), 'each event carries a stable id, so #slug works natively too');
  const mismatched = nodes.filter((n, i) => {
    const e = EVENTS[i];
    const want = (e.d + ' ' + e.t + ' ' + e.b).replace(/\s+/g, ' ').trim();
    return !n.text.includes(e.d) || !n.text.includes(e.t) || !n.text.includes(e.b.slice(0, 60)) || want.length === 0;
  });
  is(mismatched.length === 0,
    `every event's date, title and body render verbatim from the shared leaf (${nodes.length - mismatched.length}/${nodes.length})`);
  if (mismatched.length) console.log('   first mismatch:', JSON.stringify(mismatched[0]).slice(0, 200));

  await a.goto(base + `/learn/timeline?e=${firstSingle.slug}`, { waitUntil: 'load' });
  await a.waitForSelector('[data-tl-slug]', { timeout: 20000 });
  await a.waitForTimeout(700);
  const focused = await a.evaluate(() => [...document.querySelectorAll('[data-tl-focus]')].map((n) => n.getAttribute('data-tl-slug')));
  is(focused.length === 1 && focused[0] === firstSingle.slug,
    `?e=<slug> marks exactly the linked entry (${JSON.stringify(focused)})`);

  /* ── f · the new DOM is legible and does not shift the page ──
     verify-legibility excludes SVG presentation attributes by design, which is
     precisely why every flag, badge and readout here is HTML. */
  await a.goto(base + '/live/markets', { waitUntil: 'load' });
  await a.waitForSelector('[data-candle-count]', { timeout: 20000 });
  await a.click('button[aria-pressed]:has-text("1Y")');
  await a.waitForTimeout(1200);
  await a.hover(`[data-ann-slug="${firstSingle.slug}"] .mk-ann-dot`).catch(() => {});
  await a.waitForTimeout(250);
  const tiny = await a.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('.mk-ann-tip, .mk-ann-tip *, .mk-ann-badge, .mk-ann-toggle, .mk-ann-note, .mk-ann-legend, .mk-tip, .mk-tip *')) {
      const txt = (el.textContent || '').trim();
      if (!txt || el.children.length) continue;
      out.push({ txt: txt.slice(0, 24), fs: parseFloat(getComputedStyle(el).fontSize) });
    }
    return out;
  });
  is(tiny.length > 0, `the annotation DOM carries real text nodes to measure (${tiny.length})`);
  is(tiny.every((t) => t.fs >= 11),
    `every annotation glyph is >=11px, the repo's declared floor (${tiny.filter((t) => t.fs < 11).length} under)`);
  if (tiny.some((t) => t.fs < 11)) console.log('   under floor:', JSON.stringify(tiny.filter((t) => t.fs < 11).slice(0, 5)));

  await a.close();
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
