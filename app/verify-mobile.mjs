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
let fail = false;

// 1) MEMPOOL canvas must be a working horizontal scroller
await p.goto(base + '/mempool', { waitUntil: 'networkidle' });
await p.waitForSelector('.mp-canvas-scroll');
const m = await p.$eval('.mp-canvas-scroll', el => { el.scrollLeft = 400; return { clientW: el.clientWidth, scrollW: el.scrollWidth, left: el.scrollLeft }; });
console.log('mempool canvas', m);
if (!(m.clientW <= 420 && m.scrollW >= 850 && m.left > 50)) { console.log('❌ mempool canvas does NOT pan'); fail = true; } else console.log('✅ mempool canvas pans');

// 2) No page-level horizontal overflow on key routes (incl. the Monero/Bottom-Line
//    page that v5.0.5 left rendering its <main> 998px wide and clipped).
for (const r of ['/', '/network', '/markets', '/mempool', '/monero', '/monero/bottomline', '/education']) {
  await p.goto(base + r, { waitUntil: 'networkidle' });
  const o = await p.evaluate(() => {
    const main = document.querySelector('main.main');
    return { doc: document.documentElement.scrollWidth, win: window.innerWidth, main: main ? main.getBoundingClientRect().width : null };
  });
  const over = o.doc - o.win;
  console.log(r, 'docW', o.doc, 'winW', o.win, 'mainW', o.main, 'overflow', over);
  if (over > 2) { console.log('❌ horizontal overflow on ' + r); fail = true; }
}
await b.close();
process.exit(fail ? 1 : 0);
