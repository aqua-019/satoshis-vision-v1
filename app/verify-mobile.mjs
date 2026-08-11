import { webkit, chromium } from 'playwright';
import { existsSync, readdirSync } from 'node:fs';
const base = 'http://localhost:4173';
// Prefer WebKit (mobile-Safari engine). Some sandboxes can't download the WebKit
// build (CDN not in the network allowlist) — fall back to Chromium so the layout
// assertions still run; the CSS under test (min-width / overflow-x / padding) is
// engine-agnostic.
function findChrome() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!existsSync(root)) return undefined;
  for (const d of readdirSync(root).filter((n) => n.startsWith('chromium-')).sort().reverse()) {
    const p = root + '/' + d + '/chrome-linux/chrome';
    if (existsSync(p)) return p;
  }
  return undefined;
}
let b, engine = 'webkit';
try {
  b = await webkit.launch();
} catch {
  engine = 'chromium';
  const executablePath = findChrome();
  b = await chromium.launch(executablePath ? { executablePath } : {});
}
console.log('engine:', engine);
const p = await b.newPage({ viewport: { width: 390, height: 844 } });

/* THIS GATE COULD NOT REPORT THAT IT HAD COMPLETED, and that is why it is
 * being changed at the same time it is wired.
 *
 * It ended at `process.exit(fail ? 1 : 0)` with no terminal summary, and its
 * per-route overflow loop printed a measurement line but never a ✅ — so a
 * passing run showed exactly two pass marks for three checks, and a silent
 * pass is indistinguishable from a check that never ran. The repo's standing
 * rule is that a gate's result is usable only if the run COMPLETED, read off
 * the terminal summary rather than the exit code; this file could satisfy
 * neither half. Every other gate in this PR ends with a summary line.
 *
 * `ok()`/`bad()` now count, the overflow loop reports each route it clears,
 * and the run ends with its own tally. Three checks became eight assertions
 * because six routes stopped being silent — a thin gate honestly labelled. */
let pass = 0, failed = 0, skips = 0;
const ok = (m) => { console.log('✅ ' + m); pass++; };
const bad = (m) => { console.log('❌ ' + m); failed++; };
let fail = false;

/* Canonical routes + landing assertion — same reasoning as verify-perf.mjs's
 * `landedOn` note: these were `/mempool`, `/markets`, `/network`, `/education`
 * and `/simulate`, pre-v6.1.6 names carried by client redirects. They were
 * measuring the right pages; nothing stated that they depended on a redirect
 * to do so. */
const landed = async (want) => {
  const at = await p.evaluate(() => location.pathname);
  if (at !== want) { bad(`navigation landed on ${at}, not ${want}`); fail = true; return false; }
  return true;
};

// 1) MEMPOOL canvas must be a working horizontal scroller.
//    v6.0.4: this used to point at /mempool with no query, which resolves to the
//    DEFAULT view — Classic. Classic is pure DOM and now reflows to the viewport
//    instead of panning (it is what a phone actually lands on, so panning made the
//    default view the least readable one). The pan behaviour still belongs to the
//    fixed-size views, so this assertion moves to Terminal, which deliberately
//    keeps the 900px pin. See styles.css `.mp-canvas-scroll--reflow`.
await p.goto(base + '/live/mempool?v=terminal', { waitUntil: 'networkidle' });
await landed('/live/mempool');
await p.waitForSelector('.mp-canvas-scroll');
const m = await p.$eval('.mp-canvas-scroll', el => { el.scrollLeft = 400; return { clientW: el.clientWidth, scrollW: el.scrollWidth, left: el.scrollLeft }; });
console.log('mempool canvas (terminal)', m);
if (!(m.clientW <= 420 && m.scrollW >= 850 && m.left > 50)) { bad('mempool canvas does NOT pan'); fail = true; } else ok('mempool canvas pans');

// 1b) …and the converse: Classic must NOT pan. It opts into the reflow layer, so
//     it reads as a normal single-column page at 390px with no horizontal scroll.
await p.goto(base + '/live/mempool', { waitUntil: 'networkidle' });
await landed('/live/mempool');
await p.waitForSelector('.mp-canvas-scroll');
const c = await p.$eval('.mp-canvas-scroll', el => ({
  reflow: el.classList.contains('mp-canvas-scroll--reflow'),
  clientW: el.clientWidth, scrollW: el.scrollWidth,
}));
console.log('mempool classic (default view)', c);
if (!c.reflow) { bad('Classic did not opt into the reflow layer'); fail = true; }
else if (c.scrollW - c.clientW > 2) { bad('Classic still pans (' + (c.scrollW - c.clientW) + 'px)'); fail = true; }
else ok('Classic reflows instead of panning');

// 2) No page-level horizontal overflow on key routes (incl. the Monero/Bottom-Line
//    page that v5.0.5 left rendering its <main> 998px wide and clipped).
const OVERFLOW_ROUTES = ['/', '/live/network', '/live/markets', '/live/mempool', '/learn/sim', '/monero', '/monero/bottomline', '/learn'];
const overflowBad = [];
let metricLive = false;
for (const r of OVERFLOW_ROUTES) {
  await p.goto(base + r, { waitUntil: 'networkidle' });
  if (!metricLive) {
    // POSITIVE CONTROL — see verify-perf.mjs's overflowMetricLive note. This
    // gate runs ONLY at 390px, where styles.css:2202-2206 clips the page
    // horizontally on purpose (iOS touch scrolling), so this loop could not
    // fail no matter what any route rendered. Measured: a 3000px element
    // appended to <body> leaves documentElement.scrollWidth at 390.
    metricLive = await p.evaluate(() => {
      const probe = document.createElement('div');
      probe.style.cssText = 'width:3000px;height:2px;flex:none';
      document.body.appendChild(probe);
      const moved = document.documentElement.scrollWidth - window.innerWidth > 2;
      probe.remove();
      return moved;
    });
  }
  const at = await p.evaluate(() => location.pathname);
  const o = await p.evaluate(() => {
    const main = document.querySelector('main.main');
    return { doc: document.documentElement.scrollWidth, win: window.innerWidth, main: main ? main.getBoundingClientRect().width : null };
  });
  const over = o.doc - o.win;
  console.log(r, 'landed', at, 'docW', o.doc, 'winW', o.win, 'mainW', o.main, 'overflow', over);
  if (at !== r) overflowBad.push(`${r} landed on ${at}`);
  if (over > 2) overflowBad.push(`${r} +${over}px`);
}
// Reported as one line either way — a pass that prints nothing is why this
// gate showed 2 marks for 3 checks. Landing is asserted unconditionally; the
// OVERFLOW half is only claimed where the metric was proven able to move.
const landingBad = overflowBad.filter((m) => m.includes('landed on'));
const overBad = overflowBad.filter((m) => !m.includes('landed on'));
if (landingBad.length === 0) ok(`all ${OVERFLOW_ROUTES.length} routes land on the path requested`);
else { bad('landing: ' + landingBad.join(', ')); fail = true; }

if (!metricLive) {
  skips++;
  console.log('⏭  SKIP — 390px horizontal overflow: documentElement.scrollWidth cannot exceed the ' +
    'viewport here (html,body overflow-x:clip below 769px), so a pass would be vacuous. Not measured.');
} else if (overBad.length === 0) {
  ok(`no horizontal overflow at 390px (${OVERFLOW_ROUTES.length} routes, metric proven live)`);
} else { bad('390px overflow: ' + overBad.join(', ')); fail = true; }

await b.close();
// The completion marker is emitted by the thing that completed.
console.log(`\nverify-mobile: ${pass} ✅ · ${failed} ❌ · ${skips} reasoned skip(s)`);
console.log(fail || failed ? '❌ MOBILE CHECKS FAILED' : '✅ All mobile checks passed.');
process.exit(fail || failed ? 1 : 0);
