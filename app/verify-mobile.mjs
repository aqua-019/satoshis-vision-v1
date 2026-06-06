import { webkit } from 'playwright';
const base = 'http://localhost:4173';
const b = await webkit.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
let fail = false;

// 1) MEMPOOL canvas must be a working horizontal scroller
await p.goto(base + '/mempool', { waitUntil: 'networkidle' });
await p.waitForSelector('.mp-canvas-scroll');
const m = await p.$eval('.mp-canvas-scroll', el => { el.scrollLeft = 400; return { clientW: el.clientWidth, scrollW: el.scrollWidth, left: el.scrollLeft }; });
console.log('mempool canvas', m);
if (!(m.clientW <= 420 && m.scrollW >= 850 && m.left > 50)) { console.log('❌ mempool canvas does NOT pan'); fail = true; } else console.log('✅ mempool canvas pans');

// 2) No page-level horizontal overflow on key routes
for (const r of ['/', '/network', '/markets', '/mempool', '/monero', '/education']) {
  await p.goto(base + r, { waitUntil: 'networkidle' });
  const o = await p.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: window.innerWidth }));
  const over = o.doc - o.win;
  console.log(r, 'docW', o.doc, 'winW', o.win, 'overflow', over);
  if (over > 2) { console.log('❌ horizontal overflow on ' + r); fail = true; }
}
await b.close();
process.exit(fail ? 1 : 0);
