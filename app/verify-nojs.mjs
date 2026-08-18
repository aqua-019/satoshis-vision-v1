// verify-nojs.mjs — proves the no-JS / hardened-browser experience.
//
// Drives the BUILT app in a JavaScript-DISABLED context: Tor Browser at Safest,
// which is the configuration this all exists for. Served by
// scripts/serve-dist.mjs, NOT `vite preview` — preview falls back to
// dist/index.html for every path, which would serve the "/" prerender
// everywhere and make this gate pass even if prerendering were broken.
// serve-dist mirrors Vercel: real file, then directory index, then SPA
// catch-all.
//
// v6.0.9 changed what "correct" means here. Every static route is now
// prerendered, so a no-JS visitor gets the real page and the real nav rather
// than a shell — see the inverted #root assertion below, and the
// distinct-content check that is the actual headline guarantee.
//
// Run: npm run build && (node scripts/serve-dist.mjs &) && sleep 2 && node verify-nojs.mjs
import { chromium, webkit } from 'playwright';
import { existsSync, readdirSync } from 'node:fs';

// verify-lib.mjs:20 declares BASE once precisely so this is not restated.
// Hardcoding it made this the ONE gate that ignores VERIFY_BASE, which costs
// a rebuild the moment anyone runs the suite against a second port.
import { BASE as base } from './verify-lib.mjs';

function findChrome() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!existsSync(root)) return undefined;
  for (const d of readdirSync(root).filter((n) => n.startsWith('chromium-')).sort().reverse()) {
    const p = root + '/' + d + '/chrome-linux/chrome';
    if (existsSync(p)) return p;
  }
  return undefined;
}

// v6.1.8 cold boot: navigates to `/` at :48 and :138.
import { coldBootOffBrowser, assertColdBootBypassed } from './verify-lib.mjs';

let b, engine = 'chromium';
try {
  const executablePath = findChrome();
  b = await chromium.launch(executablePath ? { executablePath } : {});
} catch {
  engine = 'webkit';
  b = await webkit.launch();
}
console.log('engine:', engine);
await coldBootOffBrowser(b);

let fail = false;
const ok = (cond, msg) => { console.log((cond ? '✅ ' : '❌ ') + msg); if (!cond) fail = true; };

// JS-DISABLED context: scripting off → React cannot mount, <noscript> renders.
const ctx = await b.newContext({ javaScriptEnabled: false });
const p = await ctx.newPage();
await p.goto(base + '/', { waitUntil: 'load' });
// v6.1.8 — POSITIVE assertion, deliberately NOT an absence check.
//
// An earlier draft asserted `[data-coldboot]` was absent here. That was
// DECORATIVE and is recorded as a defect rather than quietly fixed: this
// context runs javaScriptEnabled:false, so the client-only splash can never
// mount, and the absence held for a THIRD reason unrelated to either the
// bypass working or the selector being alive. Three distinct states satisfy
// it, so it distinguished none of them — it could not fail, and an assertion
// that cannot fail is not an assertion.
//
// What matters with JS off is the opposite claim, stated positively:
// prerendered `/` must still serve MAIN HOME. Note that `/` was missing from
// this gate's substantial-content loop below (it walks /learn, /live/network,
// /about/sources, /monero, /future) — so Home, the one route gaining a
// splash, was the one route whose prerender nobody measured.
const homePrerender = await p.evaluate(() => document.getElementById('root')?.innerText ?? '');
ok(homePrerender.trim().length > 500,
   `no-JS: / serves substantial prerendered Main Home (${homePrerender.trim().length} chars, need >500)`);
ok(!/\[data-coldboot\]/.test(await p.content()) && (await p.locator('[data-coldboot]').count()) === 0,
   'no-JS: / prerender contains no splash markup (splash is client-only and must SSR to null)');

const body = await p.evaluate(() => document.body.innerText);

// v6.0.9 INVERTS this assertion, deliberately. It used to require #root to be
// EMPTY without JS — true when the shell was all a no-JS visitor got, and the
// reason Tor-at-Safest users saw a splash and nothing else. Every static route
// is now prerendered, so #root arrives already full of real markup and the SPA
// merely takes over. An empty #root here would mean prerendering had silently
// stopped emitting, which is exactly the regression worth catching.
const rootChildren = await p.evaluate(() => {
  const r = document.getElementById('root');
  return r ? r.childElementCount : -1;
});
ok(rootChildren > 0, `no-JS: #root carries prerendered markup (${rootChildren} children)`);

// v6.0.7: this gate proved the noscript TEXT rendered but asserted nothing
// about paint — so it would have passed happily while the page was white.
// Either floor is correct here: only SCRIPTING is off, so the CSS bundle still
// loads and styles-ambient.css paints html from --amb-floor. The pre-paint
// theme stamp never runs, so data-theme is unset and the classic branch
// (#050505) wins rather than indigo (#121218). What matters is that it is dark.
// v6.0.10 §6b moved classic's floor from #0b0b0c to v5's literal #050505.
const DARK_FLOORS = ['rgb(18, 18, 24)', 'rgb(5, 5, 5)'];
const bg = await p.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
ok(DARK_FLOORS.includes(bg), `no-JS: html paints a dark floor (got ${bg})`);

// The boot watchdog is the only thing that reveals #boot-fallback, and it
// cannot run here — so <noscript> is what shows, never both surfaces at once.
const fallbackHidden = await p.evaluate(() => {
  const f = document.getElementById('boot-fallback');
  return !f || f.hidden;
});
ok(fallbackHidden, 'no-JS: #boot-fallback stays hidden (noscript owns this case)');

ok(/xmr\.irish/i.test(body), 'no-JS: wordmark "xmr.irish" is present');
// v6.0.9: these two used to pin exact strings from the old full-screen splash
// ("Monero education + live mempool…", "private, untraceable digital cash").
// That splash is gone — a no-JS visitor now gets the REAL home page, which
// explains the site better than the placeholder ever did. Assert the substance
// a hardened visitor must still come away with, not the retired wording.
ok(/mempool|telemetry|privacy/i.test(body), 'no-JS: the page explains what the site is');
// Honest about WHY the live numbers are missing, without prescribing the
// wording — the copy must say the live figures need JS, not demand the user
// turn it on (asserted separately below).
ok(/need(s)? JavaScript|requires JavaScript/i.test(body), 'no-JS: honest note about live figures needing JS renders');
ok(/read-only and non-custodial/i.test(body), 'no-JS: read-only / non-custodial fact renders');
ok(/privacy/i.test(body) && /monero/i.test(body), 'no-JS: Monero and its privacy framing are present');

// A plain, JS-free way out: the getmonero.org link must be a real anchor.
const moneroHref = await p.evaluate(() => {
  const a = [...document.querySelectorAll('a')].find((x) => /getmonero\.org/i.test(x.href));
  return a ? a.href : '';
});
ok(/getmonero\.org/i.test(moneroHref), `no-JS: getmonero.org link is a real anchor (href: ${moneroHref || 'none'})`);

// v6.0.7 required the routes to be reachable without JS; #141 satisfied that
// with a hand-written link list. v6.0.9 makes it real: the routes now come from
// the app's OWN prerendered nav, which is always current by construction — a
// route added to App.tsx cannot go missing from a list someone forgot to edit.
const routes = await p.evaluate(() =>
  [...document.querySelectorAll('#root a')]
    .map((a) => { try { return new URL(a.href).pathname; } catch { return ''; } })
    .filter(Boolean));
// The 16-route IA (scripts/routes.mjs's `R`), hand-copied here — plain Node,
// no import (see verify-lib.mjs's ROUTES for the same constraint reasoned
// out in full).
//
// p4·05 · 15 -> 16 (/about/site).
// p4·04 · 14 -> 15 (/operate/mine).
// p3·16 · 13 -> 14. Note what this list does and does NOT catch. It asserts
// each named path IS a real anchor in the prerendered nav, so a route that
// exists but never reaches NavTop's JS-off list reds here. It cannot catch the
// inverse — a route missing from THIS list is simply never asked about, and
// the gate stays green while the new page goes unswept. So adding the entry is
// the registration step, not a formality: without it `/operate/superstress`
// would have been the one route whose no-JS anchor nobody measured, which is
// the same shape as the `/` gap v6.1.8 recorded a few lines above.
for (const r of ['/', '/live/mempool', '/live/markets', '/live/markets/thesis', '/live/network',
                  '/monero', '/learn', '/learn/sim', '/future', '/future/outlook',
                  '/future/protocol',
                  '/operate/node', '/operate/mine', '/operate/superstress', '/operate/peers',
                  '/about/sources', '/about/site']) {
  ok(routes.includes(r), `no-JS: ${r} is a real anchor in the prerendered nav`);
}

// THE headline guarantee, and the one the previous gates could not have caught:
// each route must serve DIFFERENT content. Before prerendering, vercel.json's
// SPA catch-all meant every URL returned the same shell, so with JS off the
// whole site collapsed to one page — the links navigated and changed nothing.
// Distinct, substantial bodies are the proof that is fixed.
const bodies = new Map();
for (const r of ['/learn', '/live/network', '/about/sources', '/monero', '/future']) {
  await p.goto(base + r, { waitUntil: 'load' });
  const text = await p.evaluate(() => document.getElementById('root')?.innerText ?? '');
  bodies.set(r, text.replace(/\s+/g, ' ').trim());
}
for (const [r, text] of bodies) {
  ok(text.length > 500, `no-JS: ${r} serves substantial prerendered content (${text.length} chars)`);
}
ok(new Set([...bodies.values()]).size === bodies.size,
   `no-JS: every route serves DISTINCT content (${new Set([...bodies.values()]).size}/${bodies.size} unique)`);

await p.goto(base + '/', { waitUntil: 'load' });
// (v6.1.8: no cold-boot assertion here — same JS-off context as above, so
//  it would restate a claim already made and still could not fail.)


// And no nagging. The prior copy read "Please enable it, or use a
// JavaScript-capable browser", which is the apology tone this fallback is
// explicitly not supposed to take.
const noscriptText = await p.evaluate(() => document.body.innerText);
ok(!/please enable/i.test(noscriptText), 'no-JS: copy does not nag the user to enable JavaScript');

await ctx.close();
await b.close();
console.log(fail ? '\n❌ verify-nojs FAILED' : '\n✅ verify-nojs: all assertions passed');
process.exit(fail ? 1 : 0);
