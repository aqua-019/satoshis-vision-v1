/**
 * scripts/probe-candles.mjs — measurement instrument, NOT a gate.
 *
 * Counts the DRAWN candles on /live/markets at every range, with the upstream
 * mocked at CoinGecko's REAL documented granularity rather than the flat
 * 180-point fixture verify-markets-dom.mjs uses (that fixture is fine for the
 * membership assertions it exists for; it is useless for a density question,
 * because it hands every range the same number of buckets).
 *
 *   /coins/{id}/ohlc          1-2d -> 30m · 3-30d -> 4h · 31d+ -> 4d
 *   /coins/{id}/market_chart  <=1d -> 5m  · 2-90d -> hourly · >90d -> daily
 *
 * Reads the count from whichever expression the tree has: the canvas root's
 * data-candle-count when it exists (branch), else the SVG body-rect census
 * (baseline). Printing BOTH is deliberate — an instrument that silently falls
 * back has told you a true fact about the wrong subject.
 *
 * Run from app/:  PREVIEW_URL=http://127.0.0.1:4188 node scripts/probe-candles.mjs
 */
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

const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4188';
const HOUR = 3_600_000, DAY = 86_400_000;
const T1 = Date.UTC(2026, 6, 31);

/** CoinGecko's own OHLC bucket size for a `days` value, in ms. */
const ohlcStep = (days) => (days <= 2 ? 30 * 60_000 : days <= 30 ? 4 * HOUR : 4 * DAY);
/** CoinGecko's own market_chart sample interval for a `days` value, in ms. */
const chartStep = (days) => (days <= 1 ? 5 * 60_000 : days <= 90 ? HOUR : DAY);

function walk(days, step) {
  const span = days * DAY;
  const n = Math.max(1, Math.floor(span / step));
  const out = [];
  let p = 300;
  for (let i = 0; i < n; i++) {
    const t = T1 - (n - 1 - i) * step;
    // Deterministic, bounded wiggle — this is TEST INPUT, never app data.
    p *= 1 + Math.sin(i / 7.3) * 0.004 + Math.cos(i / 31.1) * 0.002;
    out.push([t, p]);
  }
  return out;
}

function fulfil(route) {
  const url = route.request().url();
  const json = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  const dm = /[?&]days=(\d+)/.exec(url);
  const days = dm ? Number(dm[1]) : 30;
  if (/\/api\/markets\?/.test(url)) {
    const pts = walk(days, chartStep(days));
    const mem = (id, symbol, i, charted) => ({
      id, symbol, name: symbol, rank: i + 1, price: 100 + i, marketCap: 1e9 - i * 1e7,
      change24h: 0.5, charted, pinned: id === 'monero',
    });
    const ids = [['monero', 'XMR'], ['zcash', 'ZEC'], ['bytecoin', 'BCN'], ['decred', 'DCR'],
      ['mimblewimblecoin', 'MWC'], ['pirate-chain', 'ARRR']];
    const majors = [['monero', 'XMR'], ['bitcoin', 'BTC'], ['ethereum', 'ETH']];
    const ser = (rows) => rows.map(([id, symbol]) => ({
      id, symbol, status: 'live', at: T1, t: pts.map((r) => r[0]), p: pts.map((r) => r[1]),
    }));
    return json({
      v: 1, days, fetchedAt: new Date(T1).toISOString(), partial: false,
      meta: { status: 'live', ath: 542.33, athDate: '2018-01-09', atl: 0.21, atlDate: '2015-01-14' },
      rankings: {
        peers: { status: 'live', at: T1, source: 'category:privacy-coins', members: ids.map((r, i) => mem(r[0], r[1], i, true)) },
        majors: { status: 'live', at: T1, source: 'market_cap_desc', members: majors.map((r, i) => mem(r[0], r[1], i, true)) },
      },
      series: { peers: ser(ids), majors: ser(majors) },
    });
  }
  if (url.includes('/api/coingecko')) {
    if (url.includes('simple')) return json({ monero: { usd: 372.1, usd_24h_change: 1.2 }, bitcoin: { usd: 97000, usd_24h_change: -0.3 } });
    if (url.includes('ohlc')) {
      const rows = walk(days, ohlcStep(days));
      return json(rows.map(([t, p]) => [t, p, p * 1.02, p * 0.98, p * 1.005]));
    }
    if (url.includes('market_chart')) {
      const rows = walk(days, chartStep(days));
      return json({ prices: rows, total_volumes: rows.map(([t]) => [t, 1.2e8]) });
    }
    if (url.includes('tickers')) return json({ tickers: [] });
  }
  return route.abort();
}

const exe = findChrome();
const b = await chromium.launch(exe ? { executablePath: exe } : {});
const width = Number(process.env.W || 1440);
const page = await b.newPage({ viewport: { width, height: 1000 } });
// Pin the page clock to the fixture's own end-of-series. Without this the app
// anchors its window on the real Date.now() while the mock's newest sample is
// weeks older, and every range reports a bar count for a window that is partly
// (at 7D, entirely) outside the data — a true count of the wrong window.
await page.clock.setFixedTime(new Date(T1));
let reqs = [];
page.on('request', (r) => { const u = r.url(); if (u.includes('/api/')) reqs.push(u.replace(base, '')); });
await page.route('**/api/**', fulfil);
await page.goto(base + '/live/markets', { waitUntil: 'load' });
await page.waitForTimeout(3000);

const read = () => page.evaluate(() => {
  const root = document.querySelector('[data-candle-count]');
  const declared = root ? Number(root.getAttribute('data-candle-count')) : null;
  const gran = document.querySelector('[data-candle-gran]')?.getAttribute('data-candle-gran') ?? null;
  const svg = document.querySelector('svg[viewBox$=" 320"]');
  // Baseline census: candle BODIES are the <rect> children of the candle group;
  // volume bars are rects too, so split on the key the file uses (volume rects
  // carry a "v"-prefixed react key -> no attribute), and count wick <line>s
  // instead, which exist exactly once per candle and nowhere else in the chart.
  const wicks = svg ? svg.querySelectorAll('g > g > line[stroke-width]').length : null;
  const rects = svg ? svg.querySelectorAll('rect').length : null;
  const rows = document.querySelectorAll('[data-candle-table] tbody tr').length || null;
  const tableStride = document.querySelector('[data-table-stride]')?.getAttribute('data-table-stride') ?? null;
  const barsLabel = (() => {
    const m = /(\d[\d,]*) bars? · ([^\s·]+)/.exec(document.body.innerText);
    return m ? `${m[1]} bars · ${m[2]}` : null;
  })();
  return { declared, gran, wicks, rects, rows, tableStride, barsLabel };
});

const RANGES = ['7D', '30D', '90D', '1Y'];
console.log(`\nprobe-candles @ ${width}px — ${base}`);
console.log('range | declared | wick census | table rows | granularity chip');
for (const r of RANGES) {
  // ALWAYS click, including 30D. An earlier revision skipped the click for the
  // default range — but 30D is not first in RANGES, so the "30D" row was read
  // while 7D was still selected and reported 42 where the answer is 180. A true
  // measurement of the wrong subject, in the instrument built to avoid exactly
  // that; the skip bought nothing and cost a wrong number.
  await page.getByRole('button', { name: r, exact: true }).click();
  await page.waitForTimeout(2500);
  const m = await read();
  console.log(`${r.padEnd(5)} | ${String(m.declared ?? '—').padStart(8)} | ${String(m.wicks ?? '—').padStart(11)} | ${String(m.rows ?? '—').padStart(10)} | ${m.barsLabel ?? m.gran ?? '—'}`);
}
console.log('\nhistory requests issued across all four ranges:');
const hist = reqs.filter((u) => (u.startsWith('/api/markets') || u.startsWith('/api/coingecko')) && !u.includes('simple/price'));
for (const u of hist) console.log('  ' + u);
console.log(`  total: ${hist.length}`);
await b.close();
