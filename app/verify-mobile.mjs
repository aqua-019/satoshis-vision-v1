/**
 * verify-mobile.mjs — THE TOUCH FOUNDATION, on every canonical route.
 *
 * Usage: npm run build && node scripts/serve-dist.mjs & && node verify-mobile.mjs
 *
 * ── WHAT THIS REPLACED, AND WHY THE OLD SHAPE COULD NOT WORK ────────────────
 * Until p4·02 the only site-wide sub-12px checks lived in `verify-peers` §7 and
 * `verify-superstress` §8, and BOTH passed by EXEMPTING the classes that failed
 * — `pill`, `kicker`, `mono`, `dim2`, `prov-tag`, `prov-fresh` — against a
 * floor of 11px rather than 12. Measured at 390×844 the day this file was
 * written, on the fourteen canonical routes: **1,031 visible HTML elements
 * rendered under 12px**, and the two gates that claimed to check it were green.
 *
 * An exemption list on a floor check is not a weaker assertion, it is a
 * DIFFERENT one: "nothing is small except the things that are small". This file
 * carries NO class exemption of any kind in §1. If a class needs to be smaller
 * than 12px on a phone, the answer is to change the class or to change the
 * floor — not to teach the gate to look away.
 *
 * ── THE FLOOR IS 12px BELOW 720px, AND THAT IS AN ADJUDICATION ──────────────
 * CLAUDE.md said "no text under 12px anywhere"; `styles-legibility.css` ran a
 * deliberate, recorded 11px floor since v6.0.10. Both were quoted at each other
 * for ~25 releases because NEITHER NAMED A VIEWPORT. p4·02 split on viewport
 * instead of picking a winner: ≤720px (D1207's tab-bar threshold) is 12px hard,
 * >720px keeps the recorded 11px. This gate is the ≤720px half. See the
 * `THE TOUCH TYPE FLOOR` block in styles-legibility.css for the full argument.
 *
 * ── SECTIONS ───────────────────────────────────────────────────────────────
 *   §0  the build under test is this tree's build
 *   §1  the 12px type floor — 14 routes, NO class exemptions        ← headline
 *   §2  horizontal overflow, by a metric that can actually move
 *   §3  BottomTabBar — present, six targets, each ≥40×40
 *   §4  the fixed bar does not occlude the end of the page
 *   §5  every route serves the same, version-free document title
 *   §6  SVG text in RENDERED space — bounded, not exempted
 *   §7  the mempool canvas pans where it should and reflows where it should
 *   §8  320×568 — the narrowest phone still in service
 *   §9  the peers page's `our brief` control is a real 44px target
 */
import { chromium, webkit } from 'playwright';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { coldBootOffBrowser } from './verify-lib.mjs';
import { makeReporter } from './verify-reporter.mjs';
import { ROUTES } from './scripts/routes.mjs';

const BASE = 'http://localhost:4173';
const FLOOR = 12;          // px. The whole point of the file.
const EPS = 0.01;          // computed sizes are floats; 11.999 is 12.
const TAB_MIN = 40;        // px. Minimum comfortable touch target.
/* 44, not 40, and the two are different claims. TAB_MIN is this file's own
 * comfort floor for the six tab-bar items, chosen before there was a standard
 * to point at. TAP_MIN is WCAG 2.2 AA 2.5.5 Target Size (Minimum), which is
 * 24 CSS px as a bare conformance floor and 44 under the AAA 2.5.5 that every
 * platform HIG has independently converged on. §9 asserts the higher one
 * because the control it guards has a DESTRUCTIVE near-miss — see there. */
const TAP_MIN = 44;
const PHONE = { width: 390, height: 844 };
const NARROW = { width: 320, height: 568 };

const R = makeReporter('verify-mobile');

/* Prefer WebKit (the mobile-Safari engine) and fall back to Chromium: some
 * sandboxes cannot fetch the WebKit build. Carried from the pre-p4·02 file,
 * whose reasoning still holds — the CSS under test (media queries, font-size,
 * padding, overflow) is engine-agnostic. §1's walker reads getComputedStyle,
 * which both engines resolve identically for these properties. */
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
R.info(`engine: ${engine}`);

/* Cold-boot bypass. ROUTES[0] is '/', where ColdBoot mounts, and the splash is
 * `position:fixed; inset:0` over an opaque floor — without this, every '/' row
 * below would describe the SPLASH rather than the route. `verify-coldboot-live`
 * audits this contract across every wired gate that reaches '/'. */
await coldBootOffBrowser(browser);

const phone = async (vp) => {
  const ctx = await browser.newContext({
    viewport: vp,
    hasTouch: true,        // the tab bar and the ⌘K→search swap are pointer-driven
    isMobile: engine === 'chromium' ? true : undefined,
    deviceScaleFactor: 2,
  });
  return { ctx, page: await ctx.newPage() };
};

/* ═══ THE WALKER — THIS FUNCTION IS THE SPEC ════════════════════════════════
 * An element is in scope when it OWNS text (a direct text-node child with
 * non-whitespace content, so a wrapper is not blamed for its children) and is
 * actually VISIBLE (laid out, non-zero box, not display:none / visibility:
 * hidden, not inside a fully transparent subtree). Its computed font-size is
 * then compared to the floor.
 *
 * Deliberately NOT filtered: any class, any route, any component. The only
 * exclusions are structural — `.sr-only` is a 1px clip box that a sighted
 * reader never sees, and SVG text is measured separately in §6 because its
 * computed size is in USER UNITS and lies about what the reader gets whenever
 * a viewBox scales it. Every other element is asked the same question. */
const WALK_SMALL = ([floor, eps]) => {
  const out = [];
  for (const el of document.querySelectorAll('#root *')) {
    if (el.namespaceURI === 'http://www.w3.org/2000/svg') continue;
    if (el.classList && el.classList.contains('sr-only')) continue;
    const ownsText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!ownsText) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    if (!el.getClientRects().length) continue;
    let opacity = 1, n = el;
    while (n && n !== document.documentElement) {
      opacity *= parseFloat(getComputedStyle(n).opacity || '1');
      n = n.parentElement;
    }
    if (opacity <= 0.01) continue;
    const fs = parseFloat(cs.fontSize);
    if (fs < floor - eps) {
      out.push({
        fs: +fs.toFixed(2),
        sel: el.tagName.toLowerCase()
          + (typeof el.className === 'string' && el.className.trim()
            ? '.' + el.className.trim().split(/\s+/).join('.') : ''),
        txt: el.textContent.trim().replace(/\s+/g, ' ').slice(0, 32),
      });
    }
  }
  return out;
};

/* Elements that stick out past the right edge of the viewport.
 * WHY NOT `documentElement.scrollWidth - innerWidth`: below 769px
 * styles.css clips the page horizontally on purpose (iOS touch scrolling), so
 * that difference CANNOT become positive no matter what any route renders —
 * the pre-p4·02 file measured this directly (a 3000px element appended to
 * <body> left scrollWidth at 390) and correctly emitted a reasoned skip rather
 * than a vacuous pass. A bounding rect still reports its true position under a
 * clip, so THIS metric stays live. §2 proves that with a positive control
 * instead of asserting it. */
const WALK_WIDE = (tol) => {
  const out = [];
  const vw = window.innerWidth;
  for (const el of document.querySelectorAll('#root *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    // A deliberate horizontal scroller owns its overflow (styles.css:370 makes
    // wide tables swipe inside their own box by design); so does anything
    // inside one, and so does the fixed-width mempool canvas pane.
    let inScroller = false, n = el.parentElement;
    while (n && n !== document.documentElement) {
      const p = getComputedStyle(n);
      if (p.overflowX === 'auto' || p.overflowX === 'scroll') { inScroller = true; break; }
      n = n.parentElement;
    }
    if (inScroller) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    if (r.right > vw + tol) {
      out.push(`${el.tagName.toLowerCase()}${typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/)[0] : ''} right=${r.right.toFixed(0)} > ${vw}`);
    }
  }
  return out;
};

// ═══ §0 · the build under test is a build of THIS tree ═════════════════════
R.group('§0 · build identity');
{
  const shaFile = new URL('./.perf/build-sha.txt', import.meta.url);
  let stamped = null;
  try { stamped = readFileSync(shaFile, 'utf8').trim().split(/\s+/)[0]; } catch { /* absent */ }
  if (stamped) R.info(`dist stamped from ${stamped}`);
  else R.info('no .perf/build-sha.txt — build identity unstamped');
}

// ═══ §1 · THE 12px TYPE FLOOR — the headline ═══════════════════════════════
R.group(`§1 · the ${FLOOR}px type floor at ${PHONE.width}×${PHONE.height} — all ${ROUTES.length} routes, NO class exemptions`);
const { ctx: pctx, page } = await phone(PHONE);
const titles = [];
let floorTotal = 0;
for (const route of ROUTES) {
  await page.goto(BASE + route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);          // let the 3s fast tier settle a first paint

  const landed = await page.evaluate(() => location.pathname);
  if (landed !== route) { R.ok(false, `${route} landed on ${landed}`); continue; }

  /* NON-VACUITY FIRST, and it is not decoration. A route that failed to render
   * returns ZERO findings, which is textually identical to a clean pass — the
   * single most-recorded gate defect in this repo. `verify-superstress` §8
   * caught exactly this with a `domcontentloaded` probe that measured an empty
   * container and reported "0 sub-12px nodes" for a page that had not been laid
   * out yet. Assert there was something to measure BEFORE reporting the count. */
  const rendered = await page.evaluate(() => document.querySelectorAll('#root *').length);
  if (!R.ok(rendered > 80, `${route} — rendered a page to measure (${rendered} elements under #root)`,
    'a low count here means the floor result below was measured against a blank page')) continue;

  const small = await page.evaluate(WALK_SMALL, [FLOOR, EPS]);
  floorTotal += small.length;
  R.ok(small.length === 0,
    `${route} — ${small.length} visible text element(s) below ${FLOOR}px`,
    small.slice(0, 6).map((s) => `${s.fs}px ${s.sel} ${JSON.stringify(s.txt)}`).join('\n     '));

  titles.push([route, await page.title()]);
}
R.info(`floor total across ${ROUTES.length} routes: ${floorTotal} element(s) below ${FLOOR}px`);

/* THE POSITIVE CONTROL FOR §1. Every assertion above is an ABSENCE, and an
 * absence proves nothing until the instrument is shown able to report a
 * presence. Inject one 9px element and require the walker to find it — if this
 * fails, every green row above was green for a reason unrelated to the claim. */
{
  const found = await page.evaluate(([floor, eps, src]) => {
    const probe = document.createElement('div');
    probe.style.cssText = 'font-size:9px;position:absolute;left:0;top:0';
    probe.textContent = 'FLOOR-CONTROL';
    document.querySelector('#root').appendChild(probe);
    // eslint-disable-next-line no-new-func
    const walk = new Function('return (' + src + ')')();
    const hits = walk([floor, eps]).filter((h) => h.txt.includes('FLOOR-CONTROL'));
    probe.remove();
    return hits.length;
  }, [FLOOR, EPS, WALK_SMALL.toString()]);
  R.ok(found === 1,
    `positive control — the walker DOES find a planted 9px element (found ${found})`,
    'a zero here means every §1 pass above was vacuous');
}

// ═══ §2 · horizontal overflow, by a metric that can move ═══════════════════
R.group('§2 · horizontal overflow at 390px');
{
  const metricLive = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.cssText = 'width:3000px;height:2px;flex:none';
    document.querySelector('#root').appendChild(probe);
    const moved = probe.getBoundingClientRect().right > window.innerWidth + 2;
    probe.remove();
    return moved;
  });
  R.ok(metricLive,
    'positive control — a 3000px element IS reported past the viewport edge',
    'the rect metric cannot move here, so every §2 result would be vacuous');

  let over = 0;
  for (const route of ROUTES) {
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(200);
    const wide = await page.evaluate(WALK_WIDE, 2);
    if (wide.length) { over++; R.ok(false, `${route} — ${wide.length} element(s) past the right edge`, wide.slice(0, 4).join('\n     ')); }
  }
  R.ok(over === 0, `no element extends past the viewport on any of the ${ROUTES.length} routes`);

  /* The documentElement metric is kept, and kept HONEST. It is the check a
   * reader expects to see; below 769px it structurally cannot fail, so it is
   * reported as a reasoned skip rather than counted as a pass. If the
   * horizontal clip is ever removed this turns into a real assertion. */
  const docLive = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.cssText = 'width:3000px;height:2px;flex:none';
    document.body.appendChild(probe);
    const moved = document.documentElement.scrollWidth - window.innerWidth > 2;
    probe.remove();
    return moved;
  });
  if (docLive) {
    const d = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    R.ok(d <= 2, `documentElement does not scroll horizontally (${d}px)`);
  } else {
    R.skip('documentElement horizontal scroll',
      'html/body carry overflow-x:clip below 769px, so this difference cannot become positive — a pass would be vacuous. §2 above measures the same property with bounding rects, which the clip does not defeat.');
  }
}

// ═══ §3 · BottomTabBar ═════════════════════════════════════════════════════
R.group('§3 · BottomTabBar — present on every route, six targets, each ≥40×40');
{
  let bad = [];
  let smallest = Infinity;
  for (const route of ROUTES) {
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);
    const t = await page.evaluate((min) => {
      const bar = document.querySelector('.tabbar');
      if (!bar) return { present: false };
      const cs = getComputedStyle(bar);
      const items = [...bar.querySelectorAll('a,button')];
      const boxes = items.map((i) => { const b = i.getBoundingClientRect(); return { w: +b.width.toFixed(1), h: +b.height.toFixed(1), label: (i.textContent || '').trim().slice(0, 12) }; });
      return {
        present: true,
        visible: cs.display !== 'none' && cs.visibility !== 'hidden',
        n: items.length,
        small: boxes.filter((b) => b.w < min || b.h < min),
        min: boxes.length ? Math.min(...boxes.map((b) => Math.min(b.w, b.h))) : null,
      };
    }, TAB_MIN);
    if (!t.present || !t.visible) { bad.push(`${route}: tab bar ${t.present ? 'hidden' : 'absent'}`); continue; }
    if (t.n !== 6) bad.push(`${route}: ${t.n} items, expected 6`);
    if (t.small.length) bad.push(`${route}: ${t.small.length} target(s) under ${TAB_MIN}px — ${t.small.map((s) => `${s.label} ${s.w}×${s.h}`).join(', ')}`);
    if (t.min != null) smallest = Math.min(smallest, t.min);
  }
  R.ok(bad.length === 0,
    `.tabbar is visible with 6 targets ≥${TAB_MIN}×${TAB_MIN} on all ${ROUTES.length} routes (smallest side measured: ${smallest === Infinity ? 'n/a' : smallest + 'px'})`,
    bad.slice(0, 6).join('\n     '));
}

// ═══ §4 · the fixed bar does not occlude the end of the page ═══════════════
R.group('§4 · bottom clearance');
{
  let bad = [];
  for (const route of ROUTES) {
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);
    const m = await page.evaluate(() => {
      const bar = document.querySelector('.tabbar');
      const main = document.querySelector('main.main');
      if (!bar || !main) return null;
      return {
        barH: +bar.getBoundingClientRect().height.toFixed(1),
        padBottom: parseFloat(getComputedStyle(main).paddingBottom) || 0,
      };
    });
    if (!m) { bad.push(`${route}: no .tabbar or main.main`); continue; }
    if (m.padBottom < m.barH) bad.push(`${route}: main padding-bottom ${m.padBottom}px < tab bar ${m.barH}px`);
  }
  R.ok(bad.length === 0,
    `main.main reserves at least the tab bar's height on all ${ROUTES.length} routes`,
    bad.slice(0, 6).join('\n     '));
}

// ═══ §5 · document title ═══════════════════════════════════════════════════
R.group('§5 · served document title');
{
  const distinct = [...new Set(titles.map(([, t]) => t))];
  R.ok(titles.length === ROUTES.length, `collected a title from all ${ROUTES.length} routes (${titles.length})`);
  R.ok(distinct.length === 1,
    `every route serves the SAME title — ${JSON.stringify(distinct[0])}`,
    distinct.length > 1 ? distinct.map((t) => JSON.stringify(t)).join('\n     ') : '');
  /* p4·01 de-versioned the shell title after it shipped "v5.0" for ~25 PRs on
   * all fourteen prerendered files. verify-releases pins that in SOURCE; this
   * is the same claim about what is actually SERVED, which is a different fact
   * and the one a reader meets. */
  const bad = distinct.filter((t) => /\bv\d+(?:\.\d+)*\b|#\d+/i.test(t || ''));
  R.ok(bad.length === 0, 'the served title carries no version claim',
    bad.map((t) => JSON.stringify(t)).join(', '));
  R.ok((distinct[0] || '').includes('xmr.irish'),
    'the served title still names the site (positive control for the check above)');
}

// ═══ §6 · SVG text, in RENDERED space ══════════════════════════════════════
/* SVG text is NOT exempted here, it is measured in the space the READER is in
 * and then BOUNDED. `getComputedStyle(text).fontSize` reports USER UNITS: on a
 * chart whose viewBox is downscaled, a "9px" label is not 9px to anybody. This
 * repo's own rule — "any assertion about an ABSOLUTE RENDERED QUANTITY must be
 * measured after every transform between the author and the reader" — makes an
 * authored-space floor for SVG a claim in the wrong space, which is why §1
 * excludes it rather than pretending.
 *
 * MEASURED at 390 via each node's own screen CTM: 37 SVG text nodes across the
 * fourteen routes, of which 22 render under 12px, ALL of them on
 * /live/markets/thesis, whose chart carries a viewBox scale of 0.304 — so its
 * authored 8.5–10px labels reach the reader at 2.58–3.04px.
 *
 * TWO KNIFE-EDGES A FUTURE READER WILL OTHERWISE TRIP ON, both measured:
 *   · `/learn/sim` renders its ticks at **11.99935px** — authored 20.37735849
 *     × a screen-CTM scale of 0.5888569. It is DESIGNED to land on 12 and misses
 *     by 0.00065px for a sub-pixel layout reason, which is why `EPS` exists and
 *     why this section does not red on it. Note the scale must come from the
 *     CTM and not from the viewBox width: `preserveAspectRatio` defaults to
 *     `meet`, HEIGHT is the binding constraint on that SVG, and a
 *     width-derived guess gives 0.5888889 → exactly 12.000000, flipping the
 *     verdict. Guessing the scale is how this assertion would silently pass.
 *   · `ChartTip` (design/chart-kit.tsx:203) renders `tspan`s at **10.5px** in
 *     rendered space on /live/network — and this gate never sees them, because
 *     they exist only under a pointer. STATED BLIND SPOT: §1 and §6 walk the
 *     STATIC document. Text revealed only by hover, tap or focus is outside
 *     both, and a tap can reveal it on a phone.
 *
 * NOT FIXED HERE, and the reason is arithmetic rather than appetite: the repo's
 * own remedy for this is `useChartMetrics`'s FIXED mode, whose DEFAULT_MAX_K is
 * 1.7, and lifting 0.304 to a 12px floor needs 4.4×. It is the viewBox
 * downscale problem CLAUDE.md already records as belonging in its own change,
 * and it is p4·03's. What this section refuses to do is let it grow quietly:
 * the count and the route set are pinned, so a NEW sub-12px SVG label, or the
 * same defect appearing on a SECOND route, fails the build. */
R.group('§6 · SVG text in rendered space');
{
  const KNOWN_ROUTE = '/live/markets/thesis';
  const KNOWN_MAX = 22;
  let offenders = [];
  let totalSvg = 0;
  for (const route of ROUTES) {
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(200);
    const svg = await page.evaluate((floor) => {
      const out = [];
      let n = 0;
      for (const el of document.querySelectorAll('#root svg text, #root svg tspan')) {
        if (!el.textContent.trim()) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const b = el.getBoundingClientRect();
        if (b.width <= 0 || b.height <= 0) continue;
        n++;
        const m = el.getScreenCTM ? el.getScreenCTM() : null;
        const scale = m ? Math.hypot(m.a, m.b) : 1;
        const rendered = parseFloat(cs.fontSize) * scale;
        if (rendered < floor - 0.01) out.push({ rendered: +rendered.toFixed(2), scale: +scale.toFixed(3), txt: el.textContent.trim().slice(0, 20) });
      }
      return { n, out };
    }, FLOOR);
    totalSvg += svg.n;
    if (svg.out.length) offenders.push({ route, n: svg.out.length, worst: Math.min(...svg.out.map((o) => o.rendered)), scale: svg.out[0].scale });
  }
  R.ok(totalSvg > 0, `there was SVG text to measure (${totalSvg} node(s) across ${ROUTES.length} routes)`);
  const unexpected = offenders.filter((o) => o.route !== KNOWN_ROUTE);
  R.ok(unexpected.length === 0,
    `no route other than ${KNOWN_ROUTE} renders SVG text below ${FLOOR}px`,
    unexpected.map((o) => `${o.route}: ${o.n} node(s), worst ${o.worst}px`).join('\n     '));
  const known = offenders.find((o) => o.route === KNOWN_ROUTE);
  const knownN = known ? known.n : 0;
  R.ok(knownN <= KNOWN_MAX,
    `${KNOWN_ROUTE}'s documented viewBox-downscale defect has not grown (${knownN} ≤ ${KNOWN_MAX} node(s)`
    + (known ? `, worst ${known.worst}px at scale ${known.scale}` : '') + ')',
    'this is a bound on a known, ledgered defect — not an exemption. See the section comment.');
}

// ═══ §7 · the mempool canvas — carried forward, still unique coverage ══════
/* Kept verbatim in intent from the pre-p4·02 file: it is the only assertion in
 * the suite that the DEFAULT mempool view reflows on a phone while a
 * fixed-size view still pans. Both halves matter and they point opposite ways,
 * which is why neither can stand alone. */
R.group('§7 · mempool canvas — pan where designed, reflow where default');
{
  await page.goto(BASE + '/live/mempool?v=terminal', { waitUntil: 'networkidle' });
  await page.waitForSelector('.mp-canvas-scroll');
  const m = await page.$eval('.mp-canvas-scroll', (el) => { el.scrollLeft = 400; return { clientW: el.clientWidth, scrollW: el.scrollWidth, left: el.scrollLeft }; });
  R.ok(m.clientW <= 420 && m.scrollW >= 850 && m.left > 50,
    `Terminal pans (client ${m.clientW}, scroll ${m.scrollW}, scrolled to ${m.left})`);

  await page.goto(BASE + '/live/mempool', { waitUntil: 'networkidle' });
  await page.waitForSelector('.mp-canvas-scroll');
  const c = await page.$eval('.mp-canvas-scroll', (el) => ({
    reflow: el.classList.contains('mp-canvas-scroll--reflow'),
    clientW: el.clientWidth, scrollW: el.scrollWidth,
  }));
  R.ok(c.reflow, 'Classic (the default view) opts into the reflow layer');
  R.ok(c.scrollW - c.clientW <= 2, `Classic does not pan (${c.scrollW - c.clientW}px)`);
}
await pctx.close();

// ═══ §8 · 320×568 ═════════════════════════════════════════════════════════
/* The narrowest phone still in service. The TYPE FLOOR and the TAB BAR are
 * asserted flat here, because they measured clean. OVERFLOW is BOUNDED rather
 * than asserted, and the reason is a measurement rather than a preference.
 *
 * MEASURED, paired against a build of the base commit served on its own port:
 * 13 elements sit past the right edge at 320 — and the count is 13 on BOTH
 * trees, so the type floor causes none of it. At 390 it is 0 on both.
 *
 * ROOT CAUSE, diagnosed rather than described: ONE element overflows and the
 * other twelve are its descendants. It is a `div.mono.keep-cols` in
 * /live/network's node-sync panel, 325px wide inside a 320px viewport.
 * styles.css:2801 gives `.table-scroll > *, .keep-cols { min-width: max-content
 * !important }` so wide tables keep their columns AND THE USER SWIPES — and
 * styles.css:2861's own comment states the precondition, that these "live in
 * .table-scroll, not a grid". Measured on this route: FIVE elements compute
 * `min-width: max-content`, and THREE of them — all `.keep-cols` — have no
 * scrolling ancestor at all. Two of those three are narrow enough to fit
 * anyway; the third is not, so it overflows into `body`'s `overflow-x: clip`
 * and a 320px reader simply loses the right edge of the row.
 *
 * FIXED, after CI found the same defect at 390 where this machine measured 0.
 * The grid now carries `.sync-rows`, which releases the max-content minimum
 * (styles.css, beside the `.kpi-grid .keep-cols` precedent that does the same
 * thing one level in). Post-fix this reads 0 at 320, 360 and 390, with and
 * without the self-hosted fonts. The bound below is therefore 0 rather than 13
 * — kept as a BOUND rather than folded into the flat assertion above so the
 * route stays named: this is where that defect lived, and a regression should
 * say so by name. */
R.group(`§8 · ${NARROW.width}×${NARROW.height} — the narrowest phone`);
{
  const KNOWN_320_ROUTE = '/live/network';
  const KNOWN_320_MAX = 0;   // was 13; p4·02 fixed the .keep-cols cause, see below
  const { ctx, page: np } = await phone(NARROW);
  let floor320 = 0, tab320 = [], wide320 = [];
  for (const route of ROUTES) {
    await np.goto(BASE + route, { waitUntil: 'networkidle' });
    await np.waitForTimeout(200);
    const rendered = await np.evaluate(() => document.querySelectorAll('#root *').length);
    if (rendered <= 80) { R.ok(false, `${route} at ${NARROW.width}px — nothing rendered (${rendered})`); continue; }
    floor320 += (await np.evaluate(WALK_SMALL, [FLOOR, EPS])).length;
    const w = await np.evaluate(WALK_WIDE, 2);
    if (w.length) wide320.push({ route, n: w.length, sample: w[0] });
    const n = await np.evaluate(() => { const b = document.querySelector('.tabbar'); return b ? b.querySelectorAll('a,button').length : -1; });
    if (n !== 6) tab320.push(`${route}: ${n}`);
  }
  R.ok(floor320 === 0, `no visible text below ${FLOOR}px at ${NARROW.width}px (${floor320})`);
  R.ok(tab320.length === 0, `six tab targets at ${NARROW.width}px`, tab320.join(', '));

  const unexpected = wide320.filter((o) => o.route !== KNOWN_320_ROUTE);
  R.ok(unexpected.length === 0,
    `no route other than ${KNOWN_320_ROUTE} overflows at ${NARROW.width}px`,
    unexpected.map((o) => `${o.route}: ${o.n} — ${o.sample}`).join('\n     '));
  const known = wide320.find((o) => o.route === KNOWN_320_ROUTE);
  R.ok((known ? known.n : 0) <= KNOWN_320_MAX,
    `${KNOWN_320_ROUTE}'s pre-existing .keep-cols overflow has not grown at ${NARROW.width}px `
    + `(${known ? known.n : 0} ≤ ${KNOWN_320_MAX})`,
    'a bound on a diagnosed, ledgered defect measured identical on the base commit — not an exemption.');
  await ctx.close();
}

// ═══ §9 · the peers page's `our brief` control ═════════════════════════════
/* p4·M3, and this is the one section in the file whose subject is a SINGLE
 * CONTROL rather than every route. It earns that because the defect it guards
 * is not "text too small to read" — which §1 already covers site-wide — but a
 * near-miss that does the WRONG THING.
 *
 * MEASURED ON THE SHIPPED BUILD AT 390×844 BEFORE THE FIX: 52.8 × 16, on all
 * six partner cards. The button sits inside a `<Card onClick={visit}>`, and
 * `visit` calls `window.open(partner.url)`. So a thumb landing a few pixels
 * off the 16px-tall label does not miss — it hits the card and sends the
 * reader OFF-SITE, which is why this was reported as "kyc.rip has no popup, it
 * just links to the site". A tap target whose surroundings are inert can be
 * argued about; one whose surroundings navigate away cannot.
 *
 * THE CLIP CHECK IS PAIRED WITH THE SIZE CHECK AND IS NOT DECORATION. p3·18
 * recorded the exact failure this catches from the other side: below 768px
 * `styles.css`'s `.main * { min-width: 0 !important }` beats an inline
 * declaration, so a control can satisfy a 44px MINIMUM while its label is
 * squeezed and clipped. Size alone would call that a pass. (It also caught a
 * real asymmetry here: the widest sibling label — `visit privacygateway.io ↗`
 * — flex-shrinks its neighbour to 79.7px. Still over 44, and reported so the
 * next longer partner domain is a measurement rather than a surprise.)
 *
 * THE SIBLING ANCHOR IS DELIBERATELY NOT ASSERTED, and the asymmetry is the
 * argument rather than an oversight: a near-miss on `visit … ↗` lands on the
 * card, whose click does the SAME THING that anchor does. Missing it costs
 * nothing. Only the brief button's near-miss is destructive, so only the brief
 * button carries the floor. Its measured box is PRINTED below so a reader can
 * see the decision instead of inferring it. */
R.group(`§9 · /operate/peers — the "our brief" control is a real ${TAP_MIN}×${TAP_MIN} target`);
{
  const { ctx, page: pp } = await phone(PHONE);
  await pp.goto(BASE + '/operate/peers', { waitUntil: 'networkidle' });
  await pp.waitForTimeout(200);

  const m = await pp.evaluate(() => {
    const box = (el) => { const r = el.getBoundingClientRect(); return { w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; };
    const briefs = [...document.querySelectorAll('[data-peer-brief]')].map((el) => ({
      id: el.getAttribute('data-peer-brief'),
      ...box(el),
      clipped: el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1,
    }));
    // The sibling, measured and REPORTED only — see the block above.
    const visits = [...document.querySelectorAll('.v6-peer-grid a[target="_blank"]')].map(box);
    return { briefs, visits, cards: document.querySelectorAll('.v6-peer-grid > .v6-stagger').length };
  });

  /* NON-VACUITY FIRST. Every assertion below is over a collection, and a
   * selector that matched nothing satisfies "all of them are ≥44" perfectly. */
  R.ok(m.briefs.length > 0 && m.briefs.length === m.cards,
    `one brief control per partner card (${m.briefs.length} controls, ${m.cards} cards) — floor: an empty match would pass every check below`);

  const small = m.briefs.filter((b) => b.w < TAP_MIN || b.h < TAP_MIN);
  R.ok(small.length === 0,
    `every "our brief" control is at least ${TAP_MIN}×${TAP_MIN} at ${PHONE.width}px `
    + `(smallest side ${m.briefs.length ? Math.min(...m.briefs.flatMap((b) => [b.w, b.h])) : 'n/a'}px; `
    + `sibling "visit" links measure ${m.visits.map((v) => `${v.w}×${v.h}`).join(', ') || 'n/a'} and are deliberately unasserted)`,
    small.map((b) => `${b.id} ${b.w}×${b.h}`).join(', '));

  const clipped = m.briefs.filter((b) => b.clipped);
  R.ok(clipped.length === 0,
    `and none of them clips its own label (${m.briefs.length - clipped.length} of ${m.briefs.length}) — a 44px box that hides its text is not a fixed target`,
    clipped.map((b) => b.id).join(', '));

  /* THE ASSERTION THAT WOULD HAVE CAUGHT WHAT THE TWO ABOVE MISSED, and it is
   * here because they did miss it. On the first build carrying six partners,
   * `visit privacygateway.io ↗` — the longest partner domain on the page —
   * squeezed its `space-between` sibling to 79.7px and the label SHATTERED to
   * "our / brief" over two lines. Both checks above stayed correctly green:
   * 79.7 clears 44, and the label wrapped INSIDE the 44px box rather than
   * overflowing it, so `scrollHeight === clientHeight` and nothing clipped.
   * It was found by looking at a screenshot.
   *
   * SAME LABEL, SAME BOX. All six controls render the identical two words, so
   * their widths are a pure function of the font — any difference between them
   * is layout pressure from a neighbour, which is exactly the failure mode.
   * This is strictly stronger than a floor: it fires on a squeeze that is
   * still above 44, and it needs no magic number of its own.
   *
   * The 0.5px tolerance is subpixel rounding, and it is the error class this
   * assertion cannot see: a squeeze smaller than half a pixel. That is not a
   * squeeze anybody can read.
   *
   * PROVEN, AND THE PROOF TOOK THREE MUTATIONS BECAUSE THE FIRST TWO REFUSED
   * TO GO RED. The page carries two independent defences — `flexWrap` on the
   * row, `flexShrink: 0` + `whiteSpace: nowrap` on the control — and removing
   * EITHER ONE leaves this assertion green, because the other still holds the
   * box. Only removing BOTH reproduces the original defect, and then it fires:
   * `spread 3.1px`. That is worth writing down twice over. It says the
   * assertion is not vacuous; it says the two defences are genuinely
   * redundant rather than jointly necessary, which is a fact about the page
   * nobody had measured; and it is this assertion's own BLIND SPOT — it
   * cannot tell you WHICH defence is carrying the box, so a reviewer deleting
   * one "because the gate is still green" would be reading it correctly and
   * still be wrong. */
  const widths = m.briefs.map((b) => b.w);
  const spread = widths.length ? Math.max(...widths) - Math.min(...widths) : 0;
  R.ok(spread <= 0.5,
    `all ${m.briefs.length} controls measure the SAME width (${widths.length ? widths[0] : 'n/a'}px, spread ${spread.toFixed(1)}px) — they carry the same label, so a differing width is one squeezed by its neighbour`,
    m.briefs.map((b) => `${b.id} ${b.w}`).join(', ')
    + '  — flexShrink:0 + whiteSpace:nowrap on the control, flexWrap on the row.');

  await ctx.close();
}

await browser.close();
// A bare `R.finish()` here would print FAILURES and exit 0 — p3·17 shipped
// exactly that and only the exit code caught it.
process.exit(R.finish());
