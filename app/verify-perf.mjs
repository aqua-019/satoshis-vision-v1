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
 *   1  the pre-paint tier stamp exists BEFORE the module bundle executes — the
 *      whole point of the inline script in index.html is that a phone never
 *      composites 43 layers during the bundle download, so asserting it after
 *      the bundle has run would assert nothing. Both polarities of the
 *      ordering probe are checked; see §1's own note for why.
 *   2  the per-tier layer census — the headline claim of this release.
 *   3  background-tab quiescence — zero rAF, zero interval fires while
 *      hidden. Before v6.0.8 this failed on every route.
 *   4  no horizontal overflow across the full breakpoint ladder, including
 *      the two bands v6.0.8 added (769–1199, ≤479).
 *   5  orientation flip recovers.
 *   6  prefers-reduced-motion forces `low` and the page still works.
 *   7  timer census — the 21-setInterval storm is gone.
 *   8  static source assertions (verify-legibility.mjs style), including the
 *      setInterval gating census and a self-policing waiver list.
 *
 * Routes here are the canonical post-v6.1.6 paths and every navigation asserts
 * where it LANDED — see the note above `landedOn`.
 */
import { webkit, chromium } from 'playwright';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { coldBootOff } from './verify-lib.mjs';

const base = 'http://localhost:4173';
let fail = false;
const ok = (m) => console.log('✅ ' + m);
const bad = (m) => { console.log('❌ ' + m); fail = true; };
let skips = 0;
/** Neither a pass nor a failure. Used where the instrument is proven inert —
 *  a skip must never be counted as coverage (api/verify-status.mjs's FIXTURED
 *  lines and verify-orb §7's reasoned skip are the same idea). */
const skip = (m) => { console.log('⏭  SKIP — ' + m); skips++; };

/** POSITIVE CONTROL for the horizontal-overflow metric.
 *
 * `documentElement.scrollWidth - window.innerWidth` cannot exceed 0 at any
 * width where the page is horizontally clipped, and styles.css:2202-2206 does
 * exactly that below 769px — `html, body { overflow-x: clip }`, deliberate, so
 * iOS touch scrolling keeps working inside the mempool canvas's nested
 * overflow-x:auto box. Measured: a 3000px element appended to <body> (or to
 * main.main) leaves documentElement.scrollWidth at 390 on a 390px viewport,
 * while main.scrollWidth correctly reports 3012.
 *
 * So §4's 390/480/768 rows were VACUOUS PASSES — three of eight widths
 * asserting something that could not fail. This injects a known-overflowing
 * element and requires the metric to move before a pass at that width is
 * allowed to mean anything; where it does not move, the width is reported as a
 * skip rather than green.
 *
 * The obvious alternative — measure main.main's scroll box instead — is NOT
 * taken. `.main` is overflow-y:auto, so scrollWidth exceeds clientWidth by the
 * scrollbar width on some engines: /future at 1440 measures exactly 17px that
 * way with no visible defect. That trades a blind spot this comment can name
 * for a tolerance nobody has characterised, which is the worse deal. */
const overflowMetricLive = (page) => page.evaluate(() => {
  const probe = document.createElement('div');
  probe.style.cssText = 'width:3000px;height:2px;flex:none';
  document.body.appendChild(probe);
  const moved = document.documentElement.scrollWidth - window.innerWidth > 2;
  probe.remove();
  return moved;
});

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

/* Every setInterval in src/ must be visibility-gated.
 *
 * THE SUBJECT USED TO BE ALLOWLIST MEMBERSHIP, NOT GATING. The predicate was
 * `contains setInterval( AND is not in GATED`, and the failure message said
 * "un-gated setInterval in X" — a claim about behaviour produced by a test of
 * bookkeeping. It reported src/data/useNodePopulation.ts and
 * src/design/useFreshClock.ts, both of which gate correctly and by two
 * different mechanisms (an early return on `visibilityState === "hidden"`, and
 * `onPageActiveChange` → `clearInterval`, which is the stronger of the two).
 * verify-provenance asserts useFreshClock's gating GREEN in the same CI run,
 * so the repo simultaneously claimed "the clock pauses while hidden" and "the
 * clock has an un-gated setInterval". Two gates, contradictory claims, and the
 * one with the narrower subject was wrong.
 *
 * Nothing had decayed. Two modules landed correctly gated and were never
 * registered, because no npm script and no CI step ever ran this file to force
 * the registration. Orphan rot, in its purest form.
 *
 * COMMENTS ARE STRIPPED FIRST, and that is load-bearing rather than tidiness.
 * The old predicate was a raw text test over the whole file, so it read PROSE
 * AS CODE: src/data/xmrirish-feed.ts has no timer at all, and its only
 * occurrence of the string is a past-tense docblock line — "This used to be
 * ONE `setInterval` at 2.5s firing a `Promise.all` over five" — describing code
 * that was REMOVED. Its allowlist entry therefore existed to suppress a false
 * positive the predicate itself manufactured. Three layers, and the middle one
 * is invisible until you look: a membership test standing in for a gating test,
 * an allowlist entry standing in for a comment-stripping step, and a comment
 * describing deleted code being counted as code. stripComments is
 * verify-memshell.mjs's, which exists for exactly this reason.
 *
 * WHAT THIS IS AND IS NOT. Even with comments gone it is a text-proximity test:
 * "this file calls setInterval and also names a gating mechanism". It cannot
 * prove the two are wired to each other. So the message says "references no
 * known visibility gate", which is what was measured; it does not say
 * "un-gated", which is not.
 *
 * SUBJECT IS `setInterval` ONLY — narrower than §7's "timer census" heading.
 * Recursive `setTimeout` is the other standard polling shape and is invisible
 * here: src/data/usePolling.ts (the app's polling module, by name) holds 5
 * setTimeout and 0 setInterval, useTickers.ts 2, useMarketHistory.ts 2.
 * Measured, all three are gated already (usePolling.ts:180 tests
 * visibilityState; the other two carry 3 gating references each), so widening
 * the predicate today would find nothing — and doing it properly means sorting
 * one-shot delays (Skeleton, usePendingDelay, V6Modal) from polls across
 * fourteen files. Recorded here so "timer census" is not read as covering it.
 */
function stripComments(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === '//') {
      while (i < src.length && src[i] !== '\n') { out += ' '; i++; }
    } else if (two === '/*') {
      while (i < src.length && src.slice(i, i + 2) !== '*/') { out += src[i] === '\n' ? '\n' : ' '; i++; }
      out += '  '; i += 2;
    } else {
      out += src[i]; i++;
    }
  }
  return out;
}
const GATE_REFS = /onPageActiveChange|isPageActive|usePageActive|document\.visibilityState|document\.hidden/;

/* The escape hatch, deliberately EMPTY.
 *
 * It is kept as structure — a file whose gating genuinely cannot be spotted by
 * GATE_REFS belongs here with a one-line reason — but measurement emptied it.
 * All four real timer files (useNodePopulation, ArtBackground, useFreshClock,
 * live-detail) name a mechanism and pass on their own merits, so listing any of
 * them would exempt a file by MEMBERSHIP that the gating test already covers,
 * which is the defect this rewrite exists to remove. The third historical
 * entry, src/data/xmrirish-feed.ts, is no longer evaluated at all once comments
 * are stripped — see above.
 *
 * The `unnecessary` check below is what stops that recurring: an entry that
 * does not actually need the exemption FAILS, so this set cannot silently
 * accumulate waivers for files that were already fine. */
const GATED = new Map([
  // 'src/some/file.ts', 'why GATE_REFS cannot see this file's gating',
]);
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(dir + '/' + e.name) : [dir + '/' + e.name]);
const callers = walk('src')
  .filter((f) => /\.tsx?$/.test(f))
  .map((f) => ({ f, src: stripComments(readFileSync(f, 'utf8')) }))
  .filter(({ src }) => /setInterval\s*\(/.test(src));

const offenders = callers.filter(({ f, src }) => !GATE_REFS.test(src) && !GATED.has(f));
if (offenders.length === 0) {
  ok(`every setInterval call site references a visibility gate (${callers.length} checked, ${GATED.size} waived)`);
} else {
  bad('references no known visibility gate: ' + offenders.map((o) => o.f).join(', '));
}

// The allowlist polices itself: a waiver for a file that passes GATE_REFS on
// its own, or for a file that no longer calls setInterval, is a stale waiver.
const unnecessary = [...GATED.keys()].filter((f) => {
  const hit = callers.find((c) => c.f === f);
  return !hit || GATE_REFS.test(hit.src);
});
if (unnecessary.length === 0) ok(`no stale waivers in the setInterval allowlist (${GATED.size} entries)`);
else bad('allowlist waives files that do not need it: ' + unnecessary.join(', '));

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

/* ── THE COLD-BOOT BYPASS, AND THE ONE PLACE IT MUST NOT BE INSTALLED ─────
 *
 * ColdBoot mounts on `/` AND NOWHERE ELSE (coldboot/gate.ts:124 —
 * `return pathname === R.HOME`). That single fact is the entire reason §3 read
 * 181 rAF on `/` and 0 on the other two routes: the other two never had the
 * loop. It is NOT that the app has a discipline the Home route missed.
 *
 * Every other section here has a ROUTE as its subject, so the splash sitting
 * `position:fixed; inset:0` over it would make those measurements describe the
 * splash — exactly what verify-coldboot-live's audit exists to prevent. Those
 * get `bypass: true`.
 *
 * §3's `/` case is the one genuine exception in this repo: its subject IS the
 * splash. Installing the bypass there sets `__XMR_COLDBOOT__ = 'off'`,
 * `coldBootWillRender()` returns false, ColdBoot never mounts, and its two rAF
 * loops never start — so the assertion would report 0 frames whether or not the
 * fix works. **It would also fake this PR's own break test**: reverting
 * ColdBoot.tsx under the bypass gives 0 → 0, which reads as "fix confirmed".
 * The measured 179 → 0 is only meaningful without it.
 *
 * A count of 0 has the same three readings verify-coldboot-live's docblock
 * names for an absence — the bypass worked, the selector died, or the splash
 * never rendered — and cannot tell them apart from the inside. So §3's `/` case
 * carries the symmetric POSITIVE CONTROL: it asserts `[data-coldboot]` is
 * PRESENT before counting frames. That turns "no bypass here" from an omission
 * into an assertion, and if ColdBoot ever stops mounting on `/` this goes red
 * instead of quietly reporting a vacuous zero. */
async function open(path, opts = {}) {
  const { bypass = true, ...ctxOpts } = opts;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ...ctxOpts });
  if (bypass) await coldBootOff(ctx);
  await ctx.addInitScript(PROBE);
  const page = await ctx.newPage();
  return { ctx, page };
}

/* ── ROUTES ARE CANONICAL, AND THE LANDING IS ASSERTED ────────────────────
 *
 * This file used to navigate to `/mempool`, `/markets`, `/network`,
 * `/education` and `/simulate` — every one a pre-v6.1.6 name, and every one a
 * REDIRECT SOURCE since. They were not producing wrong answers: measured on
 * 5537976, each resolved to its canonical target with the query string intact
 * (`/mempool?v=constellation&tier=high` → `/live/mempool?v=constellation&tier=high`,
 * tier `high`, Constellation view), so none of this gate's passes was vacuous.
 *
 * What was wrong is subtler and is the reason this is fixed rather than left:
 *
 *  1 · The gate's correctness rested on verify-redirects' contract, and
 *      nothing stated the dependency. Drop a redirect and this file does not
 *      go red — it keeps measuring whatever the path then resolves to, and
 *      "no horizontal overflow" and "quiet while hidden" are both satisfied by
 *      a 404 page. A silent green, which is the polarity nobody notices.
 *  2 · serve-dist does not implement vercel.json's 301s, so under the harness
 *      the SPA sees the legacy URL and RedirectTo preserves the query. In
 *      PRODUCTION the 301 fires first and the SPA never sees it, and whether a
 *      query survives that hop is a declared unknown — verify-redirects.mjs
 *      :174-175 records it as an explicit fixture. So the harness and
 *      production ran different code paths through these URLs.
 *  3 · The client redirect happens AFTER `load`, so every assertion here was
 *      correct only because a sleep outran a race the gate did not know it was
 *      running.
 *
 * Canonical paths remove all three. `landed()` is what keeps them removed: it
 * asserts the page ENDED UP where the navigation intended, so a future
 * redirect or route change fails loudly here instead of quietly relocating
 * this gate's subject. */
/** The path part of a route literal — `/live/mempool?v=x` → `/live/mempool`. */
const path0 = (route) => route.split('?')[0];
/** Where the page actually ended up, after any client navigation. */
const landedOn = (page) => page.evaluate(() => location.pathname);

/* ── 1. pre-paint stamp, asserted before the module bundle executes ────
 *
 * THE OLD PROBE COULD NOT BE FALSE. It read
 *   hydrated: !!document.querySelector('#root')?.childElementCount
 * and treated "#root has children" as "React has hydrated". Those were the
 * same fact while `/` shipped an empty root. Prerendering ended that: the
 * build emits `✅ prerendered 13 routes` and `/`'s index.html arrives with
 * markup already inside #root, so `childElementCount > 0` is true from the
 * first byte, correctly and by design. The assertion could then only pass if
 * prerendering were REMOVED — a dead assertion that fails, which is worse than
 * one that cannot fire, and it had been red since prerendering landed with
 * nothing running it to say so.
 *
 * The replacement is the repo's own signal for exactly this claim.
 * `main.tsx:77` sets `documentElement.dataset.boot = "ok"` immediately after
 * `createRoot().render()`, and its comment already names the distinction this
 * assertion needs: "Proof that the MODULE bundle executed, which is a
 * different claim from 'scripting is enabled'". index.html's boot watchdog and
 * verify-nojs both read it. Nothing new is invented here.
 *
 * BOTH POLARITIES ARE ASSERTED, on the same page, and that is the point — a
 * one-sided probe is how the old one rotted. `booted` must be FALSE while the
 * bundle is still in flight and TRUE after `load`.
 *
 * THE MODULE IS HELD IN FLIGHT RATHER THAN RACED. A first version of this
 * sampled at `waitUntil: 'commit'` and compared, which is a round trip: on a
 * warm cache against a local server the bundle can execute before the
 * `evaluate` lands, and it did — the assertion passed five consecutive runs and
 * then reported `booted=true at commit` on the sixth. Sampling an INSTANT
 * cannot establish an ORDER. Delaying the entry chunk by 1.5s makes the window
 * a fact of the harness instead of a property of the machine, so the "before"
 * reading is guaranteed to be before. */
{
  const { ctx, page } = await open('/');
  let held = 0;
  await ctx.route(/\/assets\/index-[^/]*\.js(\?.*)?$/, async (route) => {
    held++;
    await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });
  await page.goto(base + '/?tier=low', { waitUntil: 'commit' });
  const read = () => page.evaluate(() => ({
    tier: document.documentElement.getAttribute('data-tier'),
    booted: document.documentElement.dataset.boot === 'ok',
  }));
  const early = await read();
  await page.waitForLoadState('load');
  await page.waitForFunction(() => document.documentElement.dataset.boot === 'ok', null, { timeout: 10000 })
    .catch(() => {});
  const late = await read();

  // The hold is load-bearing: if the pattern stopped matching the entry chunk,
  // `early` would be a race again and this section would silently go back to
  // proving nothing.
  if (held > 0) ok(`entry chunk held ${held}× for 1.5s — the pre-bundle window is deterministic`);
  else bad('entry chunk was never intercepted — the /assets/index-*.js pattern no longer matches, so the readings below are a race');

  if (early.tier === 'low') ok('data-tier="low" stamped while the bundle is still in flight');
  else bad(`pre-paint stamp wrong: tier=${early.tier} before the bundle ran (want "low")`);

  if (!early.booted && late.booted) {
    ok('data-boot discriminates: absent pre-bundle, "ok" after load (probe is two-sided)');
  } else {
    bad(`data-boot probe is one-sided: booted=${early.booted} pre-bundle, ${late.booted} after load ` +
        '— it must be false then true, or it is proving nothing about ordering');
  }
  await ctx.unroute(/\/assets\/index-[^/]*\.js(\?.*)?$/);
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
for (const route of ['/', '/live/mempool', '/live/markets']) {
  // NO BYPASS — see the note above `open()`. The splash is the subject at `/`,
  // and bypassing it here would make this section report 0 frames for a page
  // with no loop in it.
  const { ctx, page } = await open(route, { bypass: false });
  await page.goto(base + route, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const at = await landedOn(page);
  if (at !== path0(route)) bad(`${route}: landed on ${at} — quiescence below measures the wrong page`);

  // POSITIVE CONTROL, `/` only. A rAF count of 0 cannot distinguish "the loop
  // stopped itself" from "there was no loop": ColdBoot mounts only on Home, so
  // this is the one route where something must be running to begin with.
  if (route === '/') {
    const splash = await page.evaluate(() => !!document.querySelector('[data-coldboot]'));
    if (splash) ok('/ renders the cold-boot splash — the rAF count below has a subject');
    else bad('/ did not render the cold-boot splash: ColdBoot mounts only on Home ' +
             '(coldboot/gate.ts:124), so a 0-frame result below would be vacuous. ' +
             'Did something install the cold-boot bypass on this context?');
  }
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
const ROUTES = ['/', '/live/mempool', '/live/markets', '/live/network', '/monero', '/learn', '/learn/sim', '/future'];
{
  const { ctx, page } = await open('/');
  const strays = new Set();
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 900 });
    const bads = [];
    let live = false;
    for (const r of ROUTES) {
      await page.goto(base + r, { waitUntil: 'load' });
      await page.waitForTimeout(300);
      const at = await landedOn(page);
      if (at !== path0(r)) strays.add(`${r} → ${at}`);
      if (!live) live = await overflowMetricLive(page);   // once per width is enough
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (over > 2) bads.push(`${r} +${over}px`);
    }
    if (!live) {
      skip(`${w}px: documentElement.scrollWidth cannot exceed the viewport here ` +
           '(html,body overflow-x:clip below 769px) — a pass would be vacuous, so this width is not measured');
    } else if (bads.length === 0) {
      ok(`no horizontal overflow at ${w}px (${ROUTES.length} routes, metric proven live)`);
    } else {
      bad(`horizontal overflow at ${w}px — ${bads.join(', ')}`);
    }
  }
  // One aggregate rather than 64 near-identical lines: this is a property of
  // the route table, not of any width.
  if (strays.size === 0) ok(`all ${ROUTES.length} routes land on the path requested (${WIDTHS.length} widths)`);
  else bad('routes did not land where requested: ' + [...strays].join(', '));
  await ctx.close();
}

/* ── 5. orientation flip ─────────────────────────────────────────────── */
{
  const { ctx, page } = await open('/');
  await page.goto(base + '/live/mempool?tier=high', { waitUntil: 'load' });
  await page.waitForTimeout(600);
  const at5 = await landedOn(page);
  if (at5 !== '/live/mempool') bad(`orientation check landed on ${at5}, not /live/mempool`);
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
  await page.goto(base + '/live/mempool?v=constellation&tier=high', { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  const at7 = await page.evaluate(() => location.pathname + location.search);
  if (at7 !== '/live/mempool?v=constellation&tier=high') {
    bad(`interval census landed on ${at7} — the ?v= may not have survived, so the subject is not constellation`);
  }
  const live = await page.evaluate(() => window.__g.intervals);
  // The 2.5s chain poll + at most a couple of genuine clocks. Before v6.0.8
  // the app armed 21 useTick intervals plus the polls.
  if (live <= 4) ok(`/live/mempool?v=constellation holds ${live} live intervals`);
  else bad(`/live/mempool?v=constellation holds ${live} live intervals — expected ≤4`);
  await ctx.close();
}

await browser.close();
console.log(`\nverify-perf: ${skips} reasoned skip(s) — a skip is neither a pass nor a failure.`);
console.log(fail ? '❌ verify-perf FAILED' : '✅ All perf assertions passed.');
process.exit(fail ? 1 : 0);
