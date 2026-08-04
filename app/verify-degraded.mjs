// verify-degraded.mjs — the v6.0.7 gate for the Brave-mobile / Tor white page.
//
// Two users reported the site loading WHITE instead of black — one on Brave
// for Android, one over Tor. Both are the same defect: every dark pixel came
// from the Vite CSS bundle, and <noscript> only renders when scripting is
// DISABLED. So a browser with scripting ENABLED that blocked, dropped or
// failed to parse a bundle got no stylesheet, no React, no <noscript> — just
// the UA default white, with near-white text on top.
//
// Each scenario below drives the BUILT app (vite preview @ :4173) with one
// specific thing broken, and asserts the page is still dark and still usable:
//
//   A. stylesheet blocked, JS on   — the literal Brave-Shields case
//   B. JS bundle blocked, JS on    — the case <noscript> cannot cover
//   C. lazy /simulate chunk dropped — routine over a 10s-RTT Tor circuit
//   D. engine without oklch()       — pre-111 Chrome / pre-113 Firefox (the
//                                     ESR line Tor Browser tracks)
//
// Everything is served from disk and every upstream is intercepted, so this
// runs with no network egress (the sandbox proxy 403s all external hosts).
//
// Run: npm run build && (npm run preview &) && sleep 2 && node verify-degraded.mjs
import { chromium, webkit } from 'playwright';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const base = 'http://localhost:4173';

// The floors the inline critical CSS must match. Hand-copied hexes drift, so
// these are asserted against styles-theme.css's --amb-floor below rather than
// trusted. rgb() form is what getComputedStyle returns.
const INDIGO_RGB = 'rgb(18, 18, 24)';  // #121218
const CLASSIC_RGB = 'rgb(5, 5, 5)'; // #050505 — v6.0.10 §6b: classic is v5's literal floor
const PHOSPHOR_RGB = 'rgb(3, 6, 3)'; // #030603 — v6.1.2
const ACCENT_HEX = '#6E5EF0';
const ACCENT_RGB = 'rgb(110, 94, 240)';

function findChrome() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!existsSync(root)) return undefined;
  for (const d of readdirSync(root).filter((n) => n.startsWith('chromium-')).sort().reverse()) {
    const p = root + '/' + d + '/chrome-linux/chrome';
    if (existsSync(p)) return p;
  }
  return undefined;
}

let fail = false;
const ok = (cond, msg) => { console.log((cond ? '✅ ' : '❌ ') + msg); if (!cond) fail = true; };

const read = (rel) => { try { return readFileSync(join(__dirname, rel), 'utf8'); } catch { return null; } };

// Blank comments but keep newlines, so offsets still map to line numbers —
// same helper verify-legibility.mjs uses. Without this the CSS assertions below
// match against prose in the very comments that document them.
const stripCssComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

// ── 0) static assertions — cheap, and they catch drift the DOM can't ────────
{
  const html = read('index.html') ?? '';
  const theme = stripCssComments(read('src/styles-theme.css') ?? '');

  const styleAt = html.indexOf('<style');
  const linkAt = html.search(/<link[^>]+rel=["']?stylesheet/i);
  const modAt = html.indexOf('<script type="module"');
  ok(styleAt !== -1, '0 · index.html carries an inline <style> critical floor');
  ok(linkAt === -1 || styleAt < linkAt, '0 · the inline floor precedes any <link rel=stylesheet>');
  ok(modAt === -1 || styleAt < modAt, '0 · the inline floor precedes the module script');

  // The floor must be a literal. A var() here would resolve to nothing in
  // exactly the case this block exists for.
  const floorBlock = html.slice(styleAt, html.indexOf('</style>', styleAt));
  ok(/#121218/i.test(floorBlock), '0 · floor declares the indigo hex literally');
  ok(/#050505/i.test(floorBlock), '0 · floor declares the classic hex literally');
  ok(/#030603/i.test(floorBlock), '0 · floor declares the phosphor hex literally');
  ok(/color-scheme:\s*dark/i.test(floorBlock), '0 · floor declares color-scheme:dark');
  ok(!/var\(/.test(floorBlock), '0 · floor contains no var() — literals only');

  // v6.1.2 — the UNQUALIFIED html{} rule must be CLASSIC, because classic is now
  // the default. It is also what an unstamped document gets: with JS off the
  // pre-paint script never runs, so no data-theme attribute is ever set and only
  // this rule applies. Getting the polarity backwards doesn't fail anything
  // loudly — it just gives every default visitor a one-frame flash of the wrong
  // theme on every cold load, which is exactly what this block exists to prevent.
  const bareHtml = /html\s*\{[^}]*background-color:\s*(#[0-9a-f]{6})/i.exec(floorBlock);
  ok(bareHtml?.[1]?.toLowerCase() === '#050505',
     `0 · the unqualified html{} floor is classic (got ${bareHtml?.[1] ?? 'no match'})`);

  // Anti-drift: the hand-copied hexes must equal styles-theme.css's --amb-floor.
  // v6.1.2 — classic is no longer expressed as ":not(indigo)". With phosphor in
  // the tree that exclusion would have matched phosphor too and handed it
  // classic's floor, so every theme is named explicitly now.
  const indigoFloor = /:root\[data-theme="indigo"\][^}]*?--amb-floor:\s*(#[0-9a-f]{6})/is.exec(theme);
  const classicFloor = /:root\[data-theme="classic"\][^{]*\{[^}]*?--amb-floor:\s*(#[0-9a-f]{6})/is.exec(theme);
  const phosphorFloor = /:root\[data-theme="phosphor"\][^}]*?--amb-floor:\s*(#[0-9a-f]{6})/is.exec(theme);
  ok(phosphorFloor?.[1]?.toLowerCase() === '#030603',
     `0 · inline phosphor floor matches --amb-floor (${phosphorFloor?.[1] ?? 'not found'})`);
  // The unstamped (JS-off) case must resolve to the default theme, not dangle.
  ok(/:root:not\(\[data-theme\]\)/.test(theme),
     '0 · styles-theme.css handles the unstamped :root:not([data-theme]) case');
  ok(indigoFloor?.[1]?.toLowerCase() === '#121218', `0 · inline indigo floor matches --amb-floor (${indigoFloor?.[1] ?? 'not found'})`);
  // v6.0.10 §6b: classic's floor is v5's literal #050505. It was #0b0b0c — a
  // 1.5-point lift v6.0.2 introduced and nothing asked for, and exactly the
  // kind of drift the "classic is pixel-comparable to v5 main" test exists to
  // catch. index.html's pre-paint floor moves with it, which is what this
  // assertion is for.
  ok(classicFloor?.[1]?.toLowerCase() === '#050505', `0 · inline classic floor matches --amb-floor (${classicFloor?.[1] ?? 'not found'})`);

  ok(/id="boot-fallback"[^>]*\shidden/.test(html), '0 · #boot-fallback ships hidden (so JS-off gets <noscript>, not both)');
  ok(/__xmriBootTimeoutMs/.test(html), '0 · boot watchdog is present and overridable for tests');
  ok(existsSync(join(__dirname, 'public/favicon.svg')), '0 · app/public/favicon.svg exists (index.html references it)');

  // oklch discipline — the whole reason D can pass.
  const supportsBlocks = [...theme.matchAll(/@supports[^{]*\{/g)].length;
  const oklchCount = (theme.match(/oklch\(/g) || []).length;
  ok(supportsBlocks > 0 && oklchCount > 0, `0 · styles-theme.css guards oklch behind @supports (${oklchCount} oklch, ${supportsBlocks} @supports)`);
  // The old two-declaration trick: `--x: #hex; --x: oklch(...)` on one selector.
  ok(!/--([\w-]+)\s*:[^;]*;\s*--\1\s*:\s*oklch/.test(theme),
     '0 · no hex-then-oklch duplicate-declaration pattern (a no-op for custom properties)');
  ok(!/var\(--in-(bg|surface|raised)[,)]/.test(theme), '0 · dead --in-* tokens are gone');
}

// v6.1.8 cold boot: navigates to `/` four times (:141 :199 :259 :319).
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

/* B4 below needs a context this file's own bypass has NOT touched, and
 * `coldBootOffBrowser` monkey-patches newContext/newPage for the whole browser
 * — permanently, and guarded by a `__coldBootWrapped` flag, so nothing after
 * that call can produce a cold one. Saving the original factory here is the
 * narrowest way to get one; the wrapper still applies to every other scenario
 * in this file, which is what they want (A/B1/B2/B3/C/D all measure degraded
 * HOME and must not measure the splash instead).
 *
 * B4's subject is the opposite case, and it is the only path on which v6.1.9's
 * anti-flash floor can strand a visitor: a REAL cold visit where the bundle
 * never arrives, so ColdBoot never mounts to release the floor it painted. */
const rawNewContext = b.newContext.bind(b);

await coldBootOffBrowser(b);

// ── A) stylesheet blocked, scripting ON — the reported Brave case ───────────
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await p.route('**/assets/*.css', (r) => r.abort());
  await p.goto(base + '/', { waitUntil: 'load' });
  await assertColdBootBypassed(p, { ok }, '/');
  await p.waitForTimeout(300);

  const bg = await p.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  // v6.1.2 — the DEFAULT is classic now, so an unseeded page boots to #050505.
  // This is the unqualified html{} rule in index.html's inline floor doing its job;
  // if this ever reads the indigo hex again, the floor's polarity has been flipped
  // back and every default visitor is eating a wrong-theme flash on cold load.
  ok(bg === CLASSIC_RGB, `A: html background is the dark floor with CSS blocked (got ${bg})`);
  ok(bg !== 'rgba(0, 0, 0, 0)' && bg !== 'rgb(255, 255, 255)', 'A: html background is neither transparent nor white');

  const scheme = await p.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
  ok(/dark/.test(scheme), `A: color-scheme is dark with CSS blocked (got ${scheme})`);

  // Prove the colour came from the INLINE floor, not a sheet that slipped past.
  // An aborted <link> still shows up in document.styleSheets, so counting
  // elements proves nothing — what matters is whether it contributed any rules.
  const sheets = await p.evaluate(() =>
    [...document.styleSheets].map((s) => {
      let rules = -1;
      try { rules = s.cssRules.length; } catch { rules = -1; } // cross-origin/unloaded
      return { tag: s.ownerNode?.tagName ?? '?', rules };
    }));
  const linkRules = sheets.filter((s) => s.tag === 'LINK').reduce((n, s) => n + Math.max(0, s.rules), 0);
  const styleRules = sheets.filter((s) => s.tag === 'STYLE').reduce((n, s) => n + Math.max(0, s.rules), 0);
  ok(linkRules === 0, `A: the bundled stylesheet contributed zero rules (link rules: ${linkRules})`);
  ok(styleRules > 0, `A: the inline floor is what is painting (inline rules: ${styleRules})`);

  // Flip to a NON-default theme: the default is already proven above, so
  // re-asserting classic here would test nothing. The attribute-qualified
  // branches are the half that could silently go missing from the inline floor.
  const altFloors = await p.evaluate(() => {
    const out = {};
    for (const t of ['indigo', 'phosphor']) {
      document.documentElement.setAttribute('data-theme', t);
      out[t] = getComputedStyle(document.documentElement).backgroundColor;
    }
    document.documentElement.removeAttribute('data-theme');
    return out;
  });
  ok(altFloors.indigo === INDIGO_RGB, `A: indigo floor holds with CSS blocked (got ${altFloors.indigo})`);
  ok(altFloors.phosphor === PHOSPHOR_RGB, `A: phosphor floor holds with CSS blocked (got ${altFloors.phosphor})`);
  await ctx.close();
}

// ── B) JS bundle blocked, scripting ON ─────────────────────────────────────
// v6.0.9 splits this in two, because prerendering changed what "correct" is.
//
// B1 · a PRERENDERED route. The bundle is dead, but dist/index.html already
// carries the real page inside #root, so the user gets actual content and a
// working nav — strictly better than any fallback. The boot fallback must
// therefore NOT appear here: showing "the bundle did not load" over a page
// that is perfectly readable would be a regression, not a safety net.
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { window.__xmriBootTimeoutMs = 400; });
  const p = await ctx.newPage();
  await p.route('**/assets/*.js', (r) => r.abort());
  await p.goto(base + '/', { waitUntil: 'load' });
  await assertColdBootBypassed(p, { ok }, '/');
  await p.waitForTimeout(1200);

  const bg = await p.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  ok(bg === CLASSIC_RGB, `B1: page is still dark with the JS bundle blocked (got ${bg})`);

  const rootText = await p.evaluate(() => document.getElementById('root')?.innerText ?? '');
  ok(rootText.trim().length > 300, `B1: prerendered content survives a dead bundle (${rootText.trim().length} chars)`);

  const fallbackShown = await p.evaluate(() => {
    const f = document.getElementById('boot-fallback');
    return !!f && !f.hidden;
  });
  ok(!fallbackShown, 'B1: the boot fallback stays hidden — prerendered content is the better answer');

  const hrefs = await p.evaluate(() =>
    [...document.querySelectorAll('#root a')].map((a) => { try { return new URL(a.href).pathname; } catch { return ''; } }));
  for (const route of ['/live/mempool', '/live/markets', '/live/network']) {
    ok(hrefs.includes(route), `B1: ${route} is still a real anchor with the bundle dead`);
  }
  await ctx.close();
}

// B2 · a NON-prerendered route with the bundle dead. /mempool/tx/:txid takes a
// parameter, so there is no static file for it and vercel.json's catch-all
// serves dist/index.html — which is now the PRERENDERED home page, not an empty
// shell. So even an un-prerenderable deep link degrades to a readable,
// navigable page instead of a blank one. Worth asserting explicitly: it is the
// weakest remaining path, and it is still fine.
//
// This also narrows #boot-fallback's job. #root is no longer empty on ANY
// route, so the watchdog can now only fire if prerendering itself stopped
// emitting — i.e. it survives as a build-regression backstop rather than the
// primary no-JS surface it was in v6.0.7. Kept for exactly that reason.
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { window.__xmriBootTimeoutMs = 400; });
  const p = await ctx.newPage();
  await p.route('**/assets/*.js', (r) => r.abort());
  await p.goto(base + '/live/mempool/tx/0000000000000000000000000000000000000000000000000000000000000000', { waitUntil: 'load' });
  await p.waitForTimeout(1200);

  const bg = await p.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  ok(bg === CLASSIC_RGB, `B2: un-prerenderable deep link is still dark (got ${bg})`);

  const rootText = await p.evaluate(() => document.getElementById('root')?.innerText ?? '');
  ok(rootText.trim().length > 300, `B2: it degrades to the readable home prerender, not a blank page (${rootText.trim().length} chars)`);

  const hrefs = await p.evaluate(() =>
    [...document.querySelectorAll('#root a')].map((a) => { try { return new URL(a.href).pathname; } catch { return ''; } }));
  ok(hrefs.includes('/learn'), 'B2: the nav still works from an un-prerenderable deep link');
  await ctx.close();
}

// ── B3) control — a HEALTHY load must never show the fallback ───────────────
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { window.__xmriBootTimeoutMs = 400; });
  const p = await ctx.newPage();
  await p.route('**/api/**', (r) => r.abort()); // no egress; app boots to skeletons
  await p.goto(base + '/', { waitUntil: 'load' });
  await assertColdBootBypassed(p, { ok }, '/');
  await p.waitForTimeout(1200);

  const mounted = await p.evaluate(() => {
    const root = document.getElementById('root');
    const f = document.getElementById('boot-fallback');
    return {
      children: root ? root.childElementCount : -1,
      fallbackShown: !!f && !f.hidden,
    };
  });
  ok(mounted.children > 0, `B3: React mounted normally (#root has ${mounted.children} children)`);
  ok(!mounted.fallbackShown, 'B3: a healthy boot cancels the watchdog — no "did not load" on a merely slow load');
  await ctx.close();
}

// ── B4) v6.1.9 anti-flash floor, on a REAL cold visit with a dead bundle ────
//
// B1 above proves prerendered content survives a dead bundle, but it runs under
// coldBootOffBrowser — so the pre-paint predicate returns false, the floor is
// never applied, and B1 structurally CANNOT see the failure mode this scenario
// exists for. Three contexts, because the interesting assertion is a REMOVAL and
// a removal is only observable if you can also show the thing was there.
//
//   B4a  positive control — the raw factory really does yield a cold visitor
//   B4b  the removal — bundle dead, floor released, prerender readable
//   B4c  negative control — timers pinned, floor still applied and #root hidden
//
// Without B4c, B4b passes for free on any build where the floor was never
// applied at all. B4c is also the honest statement of what this mechanism costs:
// until the watchdog fires, a blocked bundle hides the prerendered page.
{
  // B4a · the raw factory is genuinely un-bypassed.
  const ctx = await rawNewContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await p.route('**/api/**', (r) => r.abort());
  await p.goto(base + '/', { waitUntil: 'load' });
  const flagAbsent = await p.evaluate(() => window.__XMR_COLDBOOT__ === undefined);
  ok(flagAbsent, 'B4a: rawNewContext yields a context with no cold-boot bypass installed');
  await p.waitForSelector('[data-coldboot]', { timeout: 15000 }).catch(() => {});
  const splashes = await p.locator('[data-coldboot]').count();
  ok(splashes > 0,
    `B4a: …and a cold visit to / really does render the splash (${splashes}) — so B4b/B4c below are ` +
    'measuring the non-bypassed path, not a bypassed one that happens to look similar');
  await ctx.close();
}
{
  // B4b · bundle dead. ColdBoot's chunk never loads, so the watchdog is the
  // ONLY thing that can release the floor.
  const ctx = await rawNewContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { window.__xmriBootTimeoutMs = 400; });
  const p = await ctx.newPage();
  await p.route('**/assets/*.js', (r) => r.abort());
  await p.goto(base + '/', { waitUntil: 'load' });
  await p.waitForTimeout(1200);

  const st = await p.evaluate(() => ({
    cls: document.documentElement.className,
    vis: getComputedStyle(document.getElementById('root')).visibility,
    len: (document.getElementById('root')?.innerText || '').trim().length,
    boot: document.documentElement.dataset.boot,
  }));
  ok(!st.cls.includes('cb-pending'),
    `B4b: the watchdog released the cold-boot floor with the bundle dead (html class "${st.cls}")`);
  ok(st.vis === 'visible', `B4b: #root is visible again (visibility: ${st.vis})`);
  ok(st.len > 300,
    `B4b: the PRERENDERED page is readable rather than hidden behind the floor (${st.len} chars) — the ` +
    'removal must be UNCONDITIONAL in the watchdog body, not inside its `childElementCount === 0` branch, ' +
    'which prerendering made unreachable (see B1)');
  ok(st.boot === 'dead', `B4b: the watchdog's existing work still happens too (data-boot="${st.boot}")`);
  await ctx.close();
}
{
  // B4c · the same load with both timers pinned far out. Proves B4b observed a
  // removal rather than an absence.
  const ctx = await rawNewContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { window.__xmriBootTimeoutMs = 100000; });
  const p = await ctx.newPage();
  await p.route('**/assets/*.js', (r) => r.abort());
  await p.goto(base + '/', { waitUntil: 'load' });
  await p.waitForTimeout(1200);
  const st = await p.evaluate(() => ({
    cls: document.documentElement.className,
    vis: getComputedStyle(document.getElementById('root')).visibility,
  }));
  ok(st.cls.includes('cb-pending') && st.vis === 'hidden',
    `B4c: with the watchdog pinned at 100s the floor is STILL applied and #root STILL hidden ` +
    `(class "${st.cls}", visibility ${st.vis}) — so B4b measured a REMOVAL, not an absence`);
  await ctx.close();
}

// ── C) lazy /simulate chunk dropped — a routine Tor outcome ─────────────────
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.route('**/api/**', (r) => r.abort());
  await p.route('**/assets/SimulatePage-*.js', (r) => r.abort());
  await p.goto(base + '/learn/sim', { waitUntil: 'load' });
  await p.waitForTimeout(2000);

  const text = await p.evaluate(() => document.body.innerText);
  ok(/failed to load/i.test(text), 'C: the chunk boundary renders its message instead of unmounting');

  const rootChildren = await p.evaluate(() => document.getElementById('root')?.childElementCount ?? 0);
  ok(rootChildren > 0, `C: the app is still mounted — only the route degraded (#root children: ${rootChildren})`);

  const bg = await p.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  ok(bg !== 'rgb(255, 255, 255)', `C: page did not go white (got ${bg})`);
  await ctx.close();
}

// ── D) an engine with no oklch() support ───────────────────────────────────
// @supports is evaluated in the engine and is not scriptable, and every browser
// Playwright ships supports oklch. So rewrite the condition to an unknown
// function in flight: @supports then evaluates false, which is an exact
// simulation of a pre-oklch engine.
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  // v6.1.2 — SEED INDIGO. This scenario exists to prove the oklch->sRGB fallback,
  // and indigo is the only theme that declares any oklch at all. Once classic
  // became the default, an unseeded page measured classic, where there is no
  // oklch to fall back FROM — so the check still went green-or-red on a value
  // that had nothing to do with what it claims to test.
  await ctx.addInitScript(() => {
    try { localStorage.setItem('xmri.theme', 'indigo'); } catch { /* storage disabled */ }
    document.documentElement.setAttribute('data-theme', 'indigo');
  });
  const p = await ctx.newPage();
  await p.route('**/api/**', (r) => r.abort());
  await p.route('**/assets/*.css', async (route) => {
    const res = await route.fetch();
    const css = (await res.text())
      .replace(/@supports\s*\(\s*color:\s*oklch\([^)]*\)\s*\)/g, '@supports (color: xoklchx(0 0 0))');
    await route.fulfill({ status: 200, contentType: 'text/css', body: css });
  });
  await p.goto(base + '/', { waitUntil: 'load' });
  await assertColdBootBypassed(p, { ok }, '/');
  await p.waitForTimeout(400);

  // Either serialisation is correct. --accent-structural is @property-registered
  // as <color>, so it COMPUTES to rgb(...); --ui-accent is a plain alias onto it
  // and inherits that computed form rather than the authored hex.
  const accent = await p.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--ui-accent').trim());
  ok([ACCENT_HEX.toLowerCase(), ACCENT_RGB].includes(accent.toLowerCase()),
     `D: --ui-accent falls back to sRGB without oklch support (got "${accent}")`);

  // styles-legibility.css:38 :focus-visible { outline: 2px solid var(--ui-accent) }
  // If the token were undefined this computes to `unset` and the keyboard focus
  // ring disappears — an a11y regression, not just a colour one.
  const outline = await p.evaluate(() => {
    const el = document.createElement('button');
    el.style.cssText = 'position:fixed;top:0;left:0';
    document.body.appendChild(el);
    el.focus();
    const c = getComputedStyle(el).outlineColor;
    el.remove();
    return c;
  });
  ok(outline !== '' && outline !== 'rgba(0, 0, 0, 0)', `D: :focus-visible still has a visible outline colour (got ${outline})`);

  const bg = await p.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  ok(bg !== 'rgb(255, 255, 255)' && bg !== 'rgba(0, 0, 0, 0)', `D: background never degrades to white/transparent (got ${bg})`);
  await ctx.close();
}

await b.close();
console.log(fail ? '\n❌ verify-degraded FAILED' : '\n✅ verify-degraded: all assertions passed');
process.exit(fail ? 1 : 0);
