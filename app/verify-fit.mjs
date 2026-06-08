// verify-fit.mjs — proves P1 fit-to-view for the four wide mempool views at both
// desktop (1440) and mobile (390). Run after `npm run build` with the preview server up:
//   npm run build && (npm run preview &) && sleep 2 && node verify-fit.mjs
//
// For reactor/bridge/sediment/constellation it asserts, on load:
//   • .mp-canvas-scroll has NO horizontal overflow (scrollWidth ≈ clientWidth)
//   • the content is scaled (a non-identity transform on .mp-fit, and the
//     .mp-view--fit box is narrower than the natural content width)
//   • reactor also has no vertical overflow (it fits both axes at 1440)
//   • vertical scroll still works on the tallest view (sediment)
// Plus: the fit/100% toggle switches reactor to true size + horizontal pan.

import { chromium, webkit } from 'playwright';
import { existsSync, readdirSync } from 'node:fs';

const base = 'http://localhost:4173';

// Prefer the locally-cached Chromium; some sandboxes can't download WebKit (CDN not
// allowlisted). The CSS under test (transform/overflow) is engine-agnostic.
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

let fail = false;
const ok = (c, m) => { console.log((c ? '✅ ' : '❌ ') + m); if (!c) fail = true; };

const VIEWS = ['reactor', 'bridge', 'sediment', 'constellation'];
const VPS = [{ w: 1440, h: 900, name: 'desktop' }, { w: 390, h: 844, name: 'mobile' }];

for (const vp of VPS) {
  const p = await b.newPage({ viewport: { width: vp.w, height: vp.h } });
  for (const v of VIEWS) {
    await p.goto(`${base}/mempool?v=${v}`, { waitUntil: 'networkidle' });
    await p.waitForSelector('.mp-view--fit .mp-fit');
    // let ResizeObserver + rAF settle the first measure
    await p.waitForTimeout(150);
    const r = await p.evaluate(() => {
      const sc = document.querySelector('.mp-canvas-scroll');
      const box = document.querySelector('.mp-view--fit');
      const fit = document.querySelector('.mp-fit');
      return {
        sw: sc.scrollWidth, cw: sc.clientWidth, sh: sc.scrollHeight, ch: sc.clientHeight,
        transform: getComputedStyle(fit).transform,
        natW: fit.offsetWidth,
        boxW: Math.round(box.getBoundingClientRect().width),
      };
    });
    ok(r.sw - r.cw <= 2, `${vp.name} ${v}: no horizontal overflow (scrollW ${r.sw} − clientW ${r.cw} = ${r.sw - r.cw})`);
    const identity = !r.transform || r.transform === 'none' || r.transform === 'matrix(1, 0, 0, 1, 0, 0)';
    ok(!identity && r.boxW < r.natW - 1, `${vp.name} ${v}: scaled to fit (transform ${r.transform}; box ${r.boxW} < natural ${r.natW})`);
    if (v === 'reactor' && vp.name === 'desktop') {
      ok(r.sh - r.ch <= 2, `desktop reactor: no vertical overflow (scrollH ${r.sh} − clientH ${r.ch} = ${r.sh - r.ch})`);
    }
    if (v === 'sediment') {
      const vy = await p.evaluate(() => {
        const sc = document.querySelector('.mp-canvas-scroll');
        if (sc.scrollHeight > sc.clientHeight + 2) { sc.scrollTop = 200; return { mode: 'canvas', ok: sc.scrollTop > 50 }; }
        if (document.documentElement.scrollHeight > window.innerHeight + 2) { window.scrollTo(0, 200); return { mode: 'page', ok: window.scrollY > 50 }; }
        return { mode: 'fits', ok: true }; // scaled view fits the viewport — nothing to scroll, which is correct
      });
      ok(vy.ok, `${vp.name} sediment: vertical ${vy.mode === 'fits' ? 'view fits viewport (whole, no scroll needed)' : 'scroll works (' + vy.mode + ')'}`);
    }
  }
  await p.close();
}

// Fit/100% toggle: at desktop, switching reactor to 100% restores true size + h-pan.
{
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(`${base}/mempool?v=reactor`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.mp-zoom__btn');
  await p.waitForTimeout(150);
  const btns = await p.$$('.mp-zoom__btn');
  await btns[1].click(); // "100%"
  await p.waitForTimeout(700); // let the 250ms transform transition fully settle
  const r = await p.evaluate(() => {
    const sc = document.querySelector('.mp-canvas-scroll');
    const fit = document.querySelector('.mp-fit');
    sc.scrollLeft = 200;
    return { transform: getComputedStyle(fit).transform, sw: sc.scrollWidth, cw: sc.clientWidth, left: sc.scrollLeft };
  });
  const identity = r.transform === 'none' || r.transform === 'matrix(1, 0, 0, 1, 0, 0)';
  ok(identity, `toggle 100%: reactor at true size (transform ${r.transform})`);
  ok(r.sw - r.cw > 50 && r.left > 50, `toggle 100%: reactor pans horizontally (scrollW ${r.sw} > clientW ${r.cw}, left ${r.left})`);
  await p.close();
}

await b.close();
console.log(fail ? '\nFIT CHECKS FAILED' : '\nALL FIT CHECKS PASSED');
process.exit(fail ? 1 : 0);
