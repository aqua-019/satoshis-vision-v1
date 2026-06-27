// verify-nojs.mjs — proves the v5.0.20 no-JS / hardened-browser fallback.
//
// Drives the BUILT app (vite preview @ :4173) in a JavaScript-DISABLED context
// (what a visitor behind the Vercel interstitial or on a hardened browser sees).
// With scripting off, React never mounts (#root stays empty) and the browser
// renders the <noscript> block instead of a blank page. Asserts the fallback
// carries: wordmark, one-line description, the honest enable-JS note, the static
// "what Monero is / read-only / non-custodial" facts, and a getmonero.org link.
//
// Run: npm run build && (npm run preview &) && sleep 2 && node verify-nojs.mjs
import { chromium, webkit } from 'playwright';
import { existsSync, readdirSync } from 'node:fs';

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

let fail = false;
const ok = (cond, msg) => { console.log((cond ? '✅ ' : '❌ ') + msg); if (!cond) fail = true; };

// JS-DISABLED context: scripting off → React cannot mount, <noscript> renders.
const ctx = await b.newContext({ javaScriptEnabled: false });
const p = await ctx.newPage();
await p.goto(base + '/', { waitUntil: 'load' });

const body = await p.evaluate(() => document.body.innerText);

// #root must stay empty — nothing rendered the SPA.
const rootEmpty = await p.evaluate(() => {
  const r = document.getElementById('root');
  return !!r && r.childElementCount === 0;
});
ok(rootEmpty, 'no-JS: #root is empty (the SPA never mounts without JS)');

ok(/xmr\.irish/i.test(body), 'no-JS: wordmark "xmr.irish" is present');
ok(/Monero education \+ live mempool/i.test(body), 'no-JS: one-line description renders');
ok(/requires JavaScript/i.test(body), 'no-JS: honest "requires JavaScript" note renders');
ok(/read-only and non-custodial/i.test(body), 'no-JS: read-only / non-custodial fact renders');
ok(/private,? untraceable digital cash/i.test(body), 'no-JS: one-sentence "what Monero is" fact renders');

// A plain, JS-free way out: the getmonero.org link must be a real anchor.
const moneroHref = await p.evaluate(() => {
  const a = [...document.querySelectorAll('a')].find((x) => /getmonero\.org/i.test(x.href));
  return a ? a.href : '';
});
ok(/getmonero\.org/i.test(moneroHref), `no-JS: getmonero.org link is a real anchor (href: ${moneroHref || 'none'})`);

await ctx.close();
await b.close();
console.log(fail ? '\n❌ verify-nojs FAILED' : '\n✅ verify-nojs: all assertions passed');
process.exit(fail ? 1 : 0);
