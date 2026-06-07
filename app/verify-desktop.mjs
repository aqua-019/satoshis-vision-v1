import { chromium, webkit } from 'playwright';
import { existsSync, readdirSync } from 'node:fs';
// Desktop layout checks @ 1440x900 against `vite preview` (http://localhost:4173).
//   P1 — long content pages scroll: .main is overflow-y:auto and scrollTop sticks.
//   P2 — mempool view switcher is a collapsible dropdown (trigger visible, list
//        hidden until .is-open), and .main--fluid keeps its own (hidden) overflow.
// The CSS under test is engine-agnostic; prefer Chromium (the desktop engine and
// the build present in this sandbox), fall back to WebKit.
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
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
let fail = false;
const ok = (cond, msg) => { console.log((cond ? '✅ ' : '❌ ') + msg); if (!cond) fail = true; };

// ── P1: vertical scroll on the long content pages ──────────────────────────
for (const r of ['/markets', '/network', '/monero/bottomline', '/education']) {
  await p.goto(base + r, { waitUntil: 'networkidle' });
  await p.waitForSelector('main.main');
  const m = await p.$eval('main.main', (el) => {
    const cs = getComputedStyle(el);
    el.scrollTop = 400;
    return { oy: cs.overflowY, ox: cs.overflowX, sh: el.scrollHeight, ch: el.clientHeight, top: el.scrollTop };
  });
  console.log(r, m);
  ok(m.oy === 'auto', `${r}: .main overflow-y is auto`);
  ok(m.ox === 'hidden', `${r}: .main overflow-x is hidden`);
  if (m.sh > m.ch) ok(m.top > 50, `${r}: scrollTop sticks (content overflows ${m.sh}>${m.ch})`);
  else console.log(`   (${r} content fits — scrollTop assertion skipped)`);
}

// ── P2: mempool switcher collapses on desktop ──────────────────────────────
await p.goto(base + '/mempool', { waitUntil: 'networkidle' });
await p.waitForSelector('.mp-switcher__trigger');
const before = await p.evaluate(() => ({
  list: getComputedStyle(document.querySelector('.mp-switcher__list')).display,
  trig: getComputedStyle(document.querySelector('.mp-switcher__trigger')).display,
  fluid: getComputedStyle(document.querySelector('main.main--fluid')).overflow,
  expanded: document.querySelector('.mp-switcher__trigger').getAttribute('aria-expanded'),
}));
console.log('mempool (load)', before);
ok(before.list === 'none', 'mempool: view list collapsed on load (display:none)');
ok(before.trig !== 'none', 'mempool: trigger pill visible on desktop');
ok(before.fluid === 'hidden', 'mempool: .main--fluid keeps overflow:hidden');
ok(before.expanded === 'false', 'mempool: trigger aria-expanded=false on load');

await p.click('.mp-switcher__trigger');
const opened = await p.evaluate(() => ({
  list: getComputedStyle(document.querySelector('.mp-switcher__list')).display,
  expanded: document.querySelector('.mp-switcher__trigger').getAttribute('aria-expanded'),
}));
console.log('mempool (opened)', opened);
ok(opened.list === 'flex', 'mempool: list expands to flex on trigger click');
ok(opened.expanded === 'true', 'mempool: trigger aria-expanded=true when open');

// selecting a view collapses the dropdown again
await p.click('#mp-view-list button');
await p.waitForFunction(() => getComputedStyle(document.querySelector('.mp-switcher__list')).display === 'none');
const closed = await p.evaluate(() => ({
  list: getComputedStyle(document.querySelector('.mp-switcher__list')).display,
  expanded: document.querySelector('.mp-switcher__trigger').getAttribute('aria-expanded'),
}));
console.log('mempool (after select)', closed);
ok(closed.list === 'none', 'mempool: list re-collapses after selecting a view');
ok(closed.expanded === 'false', 'mempool: trigger aria-expanded=false after select');

// ── Protocol sims + run-a-node still render their full layout ───────────────
for (const r of ['/simulate', '/node']) {
  await p.goto(base + r, { waitUntil: 'networkidle' });
  const has = await p.$('main');
  ok(!!has, `${r}: page renders a <main>`);
}

await b.close();
console.log(fail ? '\nDESKTOP CHECKS FAILED' : '\nALL DESKTOP CHECKS PASSED');
process.exit(fail ? 1 : 0);
