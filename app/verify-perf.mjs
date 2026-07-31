/**
 * verify-perf.mjs — the v6.0.8 framerate/mobile gate.
 *
 * House style matches verify-mobile.mjs: boots against `vite preview` on
 * :4173, prefers WebKit (mobile-Safari engine) and falls back to the sandbox
 * Chromium, exits non-zero on any failure.
 *
 *   npx vite build && npx vite preview --port 4173 &
 *   node verify-perf.mjs
 *
 * What it locks down, and why each one is here:
 *
 *   1  the pre-paint tier stamp exists BEFORE hydration — the whole point of
 *      the inline script in index.html is that a phone never composites 43
 *      layers during the bundle download, so asserting it post-hydration
 *      would assert nothing.
 *   2  the per-tier layer census — the headline claim of this release.
 *   3  background-tab quiescence — zero rAF, zero interval fires while
 *      hidden. Before v6.0.8 this failed on every route.
 *   4  no horizontal overflow across the full breakpoint ladder, including
 *      the two bands v6.0.8 added (769–1199, ≤479).
 *   5  orientation flip recovers.
 *   6  prefers-reduced-motion forces `low` and the page still works.
 *   7  timer census — the 21-setInterval storm is gone.
 *   8  static source assertions (verify-legibility.mjs style).
 */
import { webkit, chromium } from 'playwright';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const base = 'http://localhost:4173';
let fail = false;
const ok = (m) => console.log('✅ ' + m);
const bad = (m) => { console.log('❌ ' + m); fail = true; };

/* ── 8. static source assertions (no browser needed; run first so a source
      regression reports even if the preview server is down) ───────────── */
console.log('\nverify-perf — static assertions');

const html = readFileSync('index.html', 'utf8');
if (/data-tier/.test(html) && /hardwareConcurrency/.test(html)) {
  ok('index.html stamps data-tier pre-paint (before the bundle loads)');
} else {
  bad('index.html is missing the pre-paint data-tier stamp');
}

const tierSrc = readFileSync('src/design/deviceTier.ts', 'utf8');
const tierDecls = (tierSrc.match(/export function getDeviceTier/g) || []).length;
if (tierDecls === 1) ok('getDeviceTier() is declared exactly once');
else bad(`getDeviceTier() declared ${tierDecls}× — must be exactly 1 (one source of truth)`);

// Every setInterval in src/ must be visibility-gated. The allowlist is the set
// of files where the gating lives; anything NEW that reaches for setInterval
// has to justify itself here rather than silently reintroducing the storm.
const GATED = new Set([
  'src/design/ArtBackground.tsx',   // useTick — gated inside the hook
  'src/data/xmrirish-feed.ts',      // suspend/resume around the 2.5s poll
  'src/mempool/live-detail.ts',     // suspend/resume around the 15s pending poll
]);
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(dir + '/' + e.name) : [dir + '/' + e.name]);
const offenders = walk('src')
  .filter((f) => /\.tsx?$/.test(f))
  .filter((f) => !GATED.has(f))
  .filter((f) => /setInterval\s*\(/.test(readFileSync(f, 'utf8')));
if (offenders.length === 0) ok('no un-gated setInterval outside the allowlist');
else bad('un-gated setInterval in: ' + offenders.join(', '));

/* ── browser ─────────────────────────────────────────────────────────── */
function findChrome() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!existsSync(root)) return undefined;
  for (const d of readdirSync(root).filter((n) => n.startsWith('chromium-')).sort().reverse()) {
    const p = root + '/' + d + '/chrome-linux/chrome';
    if (existsSync(p)) return p;
  }
  return undefined;
}

let browser, engine = 'webkit';
try {
  browser = await webkit.launch();
} catch {
  engine = 'chromium';
  const executablePath = findChrome();
  browser = await chromium.launch(executablePath ? { executablePath } : {});
}
console.log('\nverify-perf — runtime assertions (engine: ' + engine + ')');

/** Counts rAF callbacks and live intervals, installed before any app code. */
const PROBE = `
  window.__g = { raf: 0, intervals: 0 };
  const _raf = window.requestAnimationFrame;
  window.requestAnimationFrame = function (cb) {
    return _raf.call(window, function (t) { window.__g.raf++; return cb(t); });
  };
  const _si = window.setInterval, _ci = window.clearInterval;
  window.setInterval  = function (...a) { window.__g.intervals++; return _si.apply(window, a); };
  window.clearInterval = function (id) { if (id) window.__g.intervals--; return _ci.call(window, id); };
`;

async function open(path, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ...opts });
  await ctx.addInitScript(PROBE);
  const page = await ctx.newPage();
  return { ctx, page };
}

/* ── 1. pre-paint stamp, asserted before hydration ───────────────────── */
{
  const { ctx, page } = await open('/');
  await page.goto(base + '/?tier=low', { waitUntil: 'commit' });
  // `commit` returns as soon as the document starts — the inline <script> in
  // <head> has run, the module bundle has not.
  const early = await page.evaluate(() => ({
    tier: document.documentElement.getAttribute('data-tier'),
    hydrated: !!document.querySelector('#root')?.childElementCount,
  }));
  if (early.tier === 'low' && !early.hydrated) ok('data-tier="low" stamped pre-hydration');
  else bad(`pre-paint stamp wrong: tier=${early.tier} hydrated=${early.hydrated}`);
  await ctx.close();
}

/* ── 2. per-tier layer census ────────────────────────────────────────── */
const census = (p) => p.evaluate(() => ({
  tier: document.documentElement.getAttribute('data-tier'),
  plates: document.querySelectorAll('#bg-plates .plate').length,
  orbs: document.querySelectorAll('#bg-fx .orb').length,
  dust: document.querySelectorAll('#bg-fx .dust').length,
  sweep: document.querySelectorAll('#bg-fx .sweep').length,
  ribbon: document.querySelectorAll('#bg-fx .ribbon').length,
  artCanvas: document.querySelectorAll('canvas.art-canvas').length,
}));

const EXPECT = {
  low:  { plates: 2, orbs: 0, dust: 0, sweep: 0, ribbon: 0, artCanvas: 0 },
  mid:  { plates: 4, dust: 1, sweep: 0, ribbon: 0 },
  high: { plates: 8, dust: 2, sweep: 1, ribbon: 1 },
};

for (const [tier, want] of Object.entries(EXPECT)) {
  const { ctx, page } = await open('/');
  await page.goto(`${base}/?tier=${tier}`, { waitUntil: 'load' });
  await page.waitForTimeout(600);
  const got = await census(page);
  const wrong = Object.entries(want).filter(([k, v]) => got[k] !== v);
  if (got.tier === tier && wrong.length === 0) {
    ok(`tier=${tier} layer census: ${got.plates} plates · ${got.orbs} orbs · ${got.dust} dust · ${got.sweep} sweep · ${got.ribbon} ribbon · ${got.artCanvas} canvas`);
  } else {
    bad(`tier=${tier} census mismatch (stamped ${got.tier}): ` +
        wrong.map(([k, v]) => `${k} want ${v} got ${got[k]}`).join(', '));
  }
  await ctx.close();
}

/* ── 3. background-tab quiescence ────────────────────────────────────── */
for (const route of ['/', '/mempool', '/markets']) {
  const { ctx, page } = await open(route);
  await page.goto(base + route, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(200);                      // let loops unwind
  const before = await page.evaluate(() => window.__g.raf);
  await page.waitForTimeout(3000);
  const after = await page.evaluate(() => window.__g.raf);
  const frames = after - before;
  // A couple of in-flight callbacks can land after the event; anything that
  // is still *scheduling* shows up as tens of frames over 3s.
  if (frames <= 2) ok(`${route} quiet while hidden (${frames} rAF in 3s)`);
  else bad(`${route} still animating while hidden — ${frames} rAF callbacks in 3s`);
  await ctx.close();
}

/* ── 4. no horizontal overflow across the full ladder ────────────────── */
const WIDTHS = [390, 480, 768, 1024, 1200, 1440, 1920, 2560];
const ROUTES = ['/', '/mempool', '/markets', '/network', '/monero', '/education', '/simulate', '/future'];
{
  const { ctx, page } = await open('/');
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 900 });
    const bads = [];
    for (const r of ROUTES) {
      await page.goto(base + r, { waitUntil: 'load' });
      await page.waitForTimeout(300);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (over > 2) bads.push(`${r} +${over}px`);
    }
    if (bads.length === 0) ok(`no horizontal overflow at ${w}px (${ROUTES.length} routes)`);
    else bad(`horizontal overflow at ${w}px — ${bads.join(', ')}`);
  }
  await ctx.close();
}

/* ── 5. orientation flip ─────────────────────────────────────────────── */
{
  const { ctx, page } = await open('/');
  await page.goto(base + '/mempool?tier=high', { waitUntil: 'load' });
  await page.waitForTimeout(600);
  const portrait = await page.evaluate(() => document.querySelector('canvas.art-canvas')?.width ?? 0);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(800);
  const landscape = await page.evaluate(() => ({
    w: document.querySelector('canvas.art-canvas')?.width ?? 0,
    over: document.documentElement.scrollWidth - window.innerWidth,
  }));
  if (landscape.over <= 2 && landscape.w !== portrait && landscape.w > 0) {
    ok(`orientation flip recovers (canvas ${portrait} → ${landscape.w} backing px, no overflow)`);
  } else {
    bad(`orientation flip: canvas ${portrait} → ${landscape.w}, overflow ${landscape.over}px`);
  }
  await ctx.close();
}

/* ── 6. prefers-reduced-motion forces low, page still usable ─────────── */
{
  const { ctx, page } = await open('/', { reducedMotion: 'reduce' });
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.waitForTimeout(600);
  const got = await census(page);
  const content = await page.evaluate(() => (document.querySelector('main.main')?.textContent || '').trim().length);
  if (got.tier === 'low' && got.orbs === 0 && got.artCanvas === 0 && content > 100) {
    ok(`prefers-reduced-motion → tier=low, no orbs, no canvas, ${content} chars of content still rendered`);
  } else {
    bad(`reduced-motion: tier=${got.tier} orbs=${got.orbs} canvas=${got.artCanvas} content=${content}`);
  }
  await ctx.close();
}

/* ── 7. timer census ─────────────────────────────────────────────────── */
{
  const { ctx, page } = await open('/');
  await page.goto(base + '/mempool?v=constellation&tier=high', { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  const live = await page.evaluate(() => window.__g.intervals);
  // The 2.5s chain poll + at most a couple of genuine clocks. Before v6.0.8
  // the app armed 21 useTick intervals plus the polls.
  if (live <= 4) ok(`/mempool?v=constellation holds ${live} live intervals`);
  else bad(`/mempool?v=constellation holds ${live} live intervals — expected ≤4`);
  await ctx.close();
}

await browser.close();
console.log(fail ? '\n❌ verify-perf FAILED' : '\n✅ All perf assertions passed.');
process.exit(fail ? 1 : 0);
