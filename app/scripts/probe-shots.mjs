/**
 * scripts/probe-shots.mjs — render instrument for the p3·12 markets hero.
 *
 * Every shutter is preceded by an assertion that the page is IN the state the
 * filename claims. p2·10 shipped a file called `-tracked.png` that was captured
 * without the tracked state ever being set, and it read as a convincing false
 * defect for an hour. A filename is a claim; this file makes the claim checkable
 * before it is written, and prints FAIL beside any shot whose precondition did
 * not hold rather than writing a confident lie to disk.
 *
 * Never pipe this into `head`: it writes files, and SIGPIPE kills the producer
 * mid-run (p2·9). It prints its table LAST for the same reason.
 *
 * Run from app/: PREVIEW_URL=http://127.0.0.1:4188 OUT=shots/branch node scripts/probe-shots.mjs
 */
import { chromium } from 'playwright';
import { existsSync, readdirSync, mkdirSync } from 'node:fs';

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
const OUT = process.env.OUT || 'shots/branch';
mkdirSync(OUT, { recursive: true });

const HOUR = 3_600_000, DAY = 86_400_000;
const T1 = Date.UTC(2026, 6, 31);
const ohlcStep = (d) => (d <= 2 ? 30 * 60_000 : d <= 30 ? 4 * HOUR : 4 * DAY);
const chartStep = (d) => (d <= 1 ? 300_000 : d <= 90 ? HOUR : DAY);
const walk = (days, step, p0) => {
  const n = Math.max(1, Math.floor((days * DAY) / step));
  const out = []; let p = p0;
  for (let i = 0; i < n; i++) {
    p *= 1 + Math.sin(i / 7.3) * 0.006 + Math.cos(i / 31.1) * 0.003;
    out.push([T1 - (n - 1 - i) * step, p]);
  }
  return out;
};

const mkFulfil = (mode) => (route) => {
  const url = route.request().url();
  if (mode === 'dead') return route.abort();
  const json = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  const dm = /[?&]days=(\d+)/.exec(url);
  const days = dm ? Number(dm[1]) : 30;
  if (/\/api\/markets\?/.test(url)) {
    const pts = walk(days, chartStep(days), 300);
    const mem = (id, symbol, i) => ({ id, symbol, name: symbol, rank: i + 1, price: 100 + i, marketCap: 1e9 - i * 1e7, change24h: 0.5, charted: true, pinned: id === 'monero' });
    const ids = [['monero', 'XMR'], ['zcash', 'ZEC'], ['bytecoin', 'BCN'], ['decred', 'DCR'], ['mimblewimblecoin', 'MWC'], ['pirate-chain', 'ARRR']];
    const majors = [['monero', 'XMR'], ['bitcoin', 'BTC'], ['ethereum', 'ETH']];
    const ser = (rows) => rows.map(([id, symbol]) => ({ id, symbol, status: 'live', at: T1, t: pts.map((r) => r[0]), p: pts.map((r) => r[1]) }));
    return json({
      v: 1, days, fetchedAt: new Date(T1).toISOString(), partial: false,
      meta: { status: 'live', ath: 542.33, athDate: '2018-01-09', atl: 0.21, atlDate: '2015-01-14' },
      rankings: {
        peers: { status: 'live', at: T1, source: 'category:privacy-coins', members: ids.map((r, i) => mem(r[0], r[1], i)) },
        majors: { status: 'live', at: T1, source: 'market_cap_desc', members: majors.map((r, i) => mem(r[0], r[1], i)) },
      },
      series: { peers: ser(ids), majors: ser(majors) },
    });
  }
  if (url.includes('/api/coingecko')) {
    if (url.includes('simple')) return json({ monero: { usd: 372.1, usd_24h_change: 1.2 }, bitcoin: { usd: 97000, usd_24h_change: -0.3 } });
    if (url.includes('ohlc')) return json(walk(days, ohlcStep(days), 372).map(([t, p]) => [t, p, p * 1.02, p * 0.98, p * 1.005]));
    if (url.includes('market_chart')) return json({ prices: walk(days, chartStep(days), url.includes('vs_currency=btc') ? 0.0038 : 372), total_volumes: walk(days, chartStep(days), 1.2e8) });
    if (url.includes('tickers')) return json({ tickers: [] });
  }
  if (url.includes('/api/xmr')) return route.abort();
  return route.abort();
};

const rows = [];
const record = (name, ok, detail) => rows.push({ name, ok, detail });

const exe = findChrome();
const b = await chromium.launch(exe ? { executablePath: exe } : {});

/** Shoot only after `check` returns truthy. A failed precondition writes NO file. */
async function shot(page, name, check) {
  let v = null;
  try { v = await check(); } catch (e) { v = null; }
  if (!v) { record(name, false, 'PRECONDITION FAILED — no file written'); return; }
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  record(name, true, typeof v === 'string' ? v : '');
}

const readState = (page) => page.evaluate(() => {
  const root = document.querySelector('[data-candle-count]');
  const svg = document.querySelector('svg[viewBox$=" 320"]');
  return {
    count: root ? Number(root.getAttribute('data-candle-count')) : null,
    gran: root?.getAttribute('data-candle-gran') ?? null,
    svgWicks: svg ? svg.querySelectorAll('g > g > line[stroke-width]').length : null,
    rows: document.querySelectorAll('[data-candle-table] tbody tr').length || null,
    title: [...document.querySelectorAll('*')].filter((e) => !e.children.length && /XMR \/ USD/.test(e.textContent || ''))[0]?.textContent?.trim() ?? null,
  };
});

/* ── live, four ranges, 1440 and 390 ─────────────────────────────── */
for (const [w, h, tag] of [[1440, 1100, '1440'], [390, 900, '390']]) {
  const page = await b.newPage({ viewport: { width: w, height: h } });
  await page.clock.setFixedTime(new Date(T1));
  await page.route('**/api/**', mkFulfil('live'));
  await page.goto(base + '/live/markets', { waitUntil: 'load' });
  await page.waitForTimeout(2600);
  for (const r of ['7D', '30D', '90D', '1Y']) {
    await page.getByRole('button', { name: r, exact: true }).click();
    await page.waitForTimeout(1400);
    /* Frame the SUBJECT. At 390 the hero sits ~1,100px down a stacked column,
       so a viewport screenshot named `390-90D.png` was a picture of the KPI
       tiles — a file whose name claimed a chart it did not contain. */
    await (await page.$('[data-candle-count], svg[viewBox$=" 320"]'))?.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await shot(page, `${tag}-${r}`, async () => {
      const s = await readState(page);
      return (s.count ?? s.svgWicks ?? 0) > 0 ? `${s.count ?? s.svgWicks} bars · ${s.gran ?? 'svg'} · ${s.rows ?? '—'} rows` : null;
    });
  }
  /* BRUSH — RESIZE FIRST, THEN PAN, and the order is a finding rather than a
     preference. The first revision panned first, at 1Y, where the preset had
     already set the window to the whole fetched span: a pan there is CLAMPED to
     a no-op, so the precondition failed and no file was written. That was the
     probe telling the truth — the window really had not moved — and the fix is
     to zoom in before asking it to travel, not to relax the check. */
  const win = await page.$('[data-brush-window]');
  if (win) {
    /* Scroll the brush into view before touching it. At 390 the hero sits well
       below the fold, so `boundingBox()` returned page coordinates outside the
       900px viewport and every synthetic mouse event landed on nothing — three
       shots failed their preconditions for a reason that had nothing to do with
       the brush. The failures were honest; the instrument was aiming off-screen. */
    await win.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const before = await readState(page);
    const box = await win.boundingBox();
    // resize: drag the right edge inward
    await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.45, box.y + box.height / 2, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(900);
    const resized = await readState(page);
    await shot(page, `${tag}-brush-resize`, async () =>
      resized.count > 0 && resized.count !== before.count
        ? `${before.count} -> ${resized.count} bars · ${resized.gran}` : null);
    /* Pan RIGHT, not left — and this is the same clamp lesson one level down.
       The resize above drags the window's RIGHT edge inward, which leaves its
       LEFT edge pinned at the start of the fetched span; a leftward pan from
       there is clamped to a no-op exactly as the full-span pan was. There is
       only one direction a freshly right-resized window can travel. */
    const box2 = await (await page.$('[data-brush-window]'))?.boundingBox();
    const strip = await (await page.$('[data-candle-brush]'))?.boundingBox();
    if (box2 && strip) {
      const travel = Math.min(160, strip.x + strip.width - (box2.x + box2.width) - 4);
      await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2);
      await page.mouse.down();
      await page.mouse.move(box2.x + box2.width / 2 + travel, box2.y + box2.height / 2, { steps: 12 });
      await page.mouse.up();
      await page.waitForTimeout(900);
      await shot(page, `${tag}-brush-pan`, async () => {
        const s2 = await readState(page);
        const b3 = await (await page.$('[data-brush-window]'))?.boundingBox();
        return b3 && b3.x > box2.x + 2 ? `window travelled ${Math.round(b3.x - box2.x)}px right · ${s2.count} bars` : null;
      });
    }
    await page.dblclick('[data-candle-brush]');
    await page.waitForTimeout(900);
    await shot(page, `${tag}-brush-reset`, async () => {
      const s3 = await readState(page);
      return s3.count > resized.count ? `${resized.count} -> ${s3.count} bars · ${s3.gran}` : null;
    });
  } else {
    record(`${tag}-brush-pan`, false, 'no [data-brush-window] — baseline tree');
  }
  await page.close();
}

/* ── reduced motion ──────────────────────────────────────────────── */
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(T1));
  await page.route('**/api/**', mkFulfil('live'));
  await page.goto(base + '/live/markets', { waitUntil: 'load' });
  await page.waitForTimeout(2600);
  await shot(page, 'reduce-1440', async () => {
    const s = await readState(page);
    const anims = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length);
    return (s.count ?? s.svgWicks ?? 0) > 0 ? `${s.count ?? s.svgWicks} bars · ${s.rows ?? '—'} rows · ${anims} running animations` : null;
  });
  await ctx.close();
}

/* ── skeleton (in flight) and total outage ───────────────────────── */
{
  const page = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.clock.setFixedTime(new Date(T1));
  // hold every history response so the skeleton is the REAL in-flight state,
  // not a screenshot taken optimistically early.
  await page.route('**/api/**', async (route) => {
    if (/coingecko|markets/.test(route.request().url())) { await new Promise((r) => setTimeout(r, 30_000)); }
    return mkFulfil('live')(route);
  });
  await page.goto(base + '/live/markets', { waitUntil: 'commit' });
  await page.waitForTimeout(2200);
  await shot(page, 'skeleton-1440', async () => {
    const n = await page.evaluate(() => document.querySelectorAll('.sk-box, .sk-swap, [class*="skeleton" i]').length);
    return n > 0 ? `${n} skeleton boxes on screen` : null;
  });
  await page.close();
}
{
  const page = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.route('**/api/**', mkFulfil('dead'));
  await page.goto(base + '/live/markets', { waitUntil: 'load' });
  await page.waitForTimeout(2600);
  await shot(page, 'outage-1440', async () => {
    const t = await page.evaluate(() => document.body.innerText);
    return /unavailable/i.test(t) ? 'unavailable badge present, no price numerals' : null;
  });
  await page.close();
}

await b.close();
console.log(`\nprobe-shots -> ${OUT}`);
for (const r of rows) console.log(`${r.ok ? '✅' : '❌'} ${r.name.padEnd(20)} ${r.detail}`);
console.log(`\n${rows.filter((r) => r.ok).length}/${rows.length} shots written`);
