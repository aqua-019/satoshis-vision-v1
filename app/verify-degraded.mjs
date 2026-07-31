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
const CLASSIC_RGB = 'rgb(11, 11, 12)'; // #0b0b0c
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
  ok(/color-scheme:\s*dark/i.test(floorBlock), '0 · floor declares color-scheme:dark');
  ok(!/var\(/.test(floorBlock), '0 · floor contains no var() — literals only');

  // Anti-drift: the hand-copied hexes must equal styles-theme.css's --amb-floor.
  const indigoFloor = /:root\[data-theme="indigo"\][^}]*?--amb-floor:\s*(#[0-9a-f]{6})/is.exec(theme);
  const classicFloor = /:root:not\(\[data-theme="indigo"\]\)[^}]*?--amb-floor:\s*(#[0-9a-f]{6})/is.exec(theme);
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

let b, engine = 'chromium';
try {
  const executablePath = findChrome();
  b = await chromium.launch(executablePath ? { executablePath } : {});
} catch {
  engine = 'webkit';
  b = await webkit.launch();
}
console.log('engine:', engine);

// ── A) stylesheet blocked, scripting ON — the reported Brave case ───────────
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await p.route('**/assets/*.css', (r) => r.abort());
  await p.goto(base + '/', { waitUntil: 'load' });
  await p.waitForTimeout(300);

  const bg = await p.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  ok(bg === INDIGO_RGB, `A: html background is the dark floor with CSS blocked (got ${bg})`);
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

  const classicBg = await p.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'classic');
    return getComputedStyle(document.documentElement).backgroundColor;
  });
  ok(classicBg === CLASSIC_RGB, `A: classic theme floor also holds with CSS blocked (got ${classicBg})`);
  await ctx.close();
}

// ── B) JS bundle blocked, scripting ON — what <noscript> cannot cover ───────
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { window.__xmriBootTimeoutMs = 400; });
  const p = await ctx.newPage();
  await p.route('**/assets/*.js', (r) => r.abort());
  await p.goto(base + '/', { waitUntil: 'load' });
  await p.waitForTimeout(1200);

  const bg = await p.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  ok(bg === INDIGO_RGB, `B: page is still dark with the JS bundle blocked (got ${bg})`);

  const visible = await p.evaluate(() => {
    const f = document.getElementById('boot-fallback');
    return !!f && !f.hidden && f.getBoundingClientRect().height > 0;
  });
  ok(visible, 'B: #boot-fallback is revealed once the watchdog fires');

  const text = await p.evaluate(() => document.body.innerText);
  ok(/xmr\.irish/i.test(text), 'B: wordmark renders');
  ok(/did not load/i.test(text), 'B: honest explanation renders');

  // Links must be real anchors — navigation has to survive with no JS running.
  const hrefs = await p.evaluate(() =>
    [...document.querySelectorAll('#boot-fallback a')].map((a) => new URL(a.href).pathname));
  for (const route of ['/mempool', '/markets', '/network']) {
    ok(hrefs.includes(route), `B: ${route} is a real anchor in the fallback`);
  }
  await ctx.close();
}

// ── B2) control — a HEALTHY load must never show the fallback ───────────────
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { window.__xmriBootTimeoutMs = 400; });
  const p = await ctx.newPage();
  await p.route('**/api/**', (r) => r.abort()); // no egress; app boots to skeletons
  await p.goto(base + '/', { waitUntil: 'load' });
  await p.waitForTimeout(1200);

  const mounted = await p.evaluate(() => {
    const root = document.getElementById('root');
    const f = document.getElementById('boot-fallback');
    return {
      children: root ? root.childElementCount : -1,
      fallbackShown: !!f && !f.hidden,
    };
  });
  ok(mounted.children > 0, `B2: React mounted normally (#root has ${mounted.children} children)`);
  ok(!mounted.fallbackShown, 'B2: a healthy boot cancels the watchdog — no "did not load" on a merely slow load');
  await ctx.close();
}

// ── C) lazy /simulate chunk dropped — a routine Tor outcome ─────────────────
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.route('**/api/**', (r) => r.abort());
  await p.route('**/assets/SimulatePage-*.js', (r) => r.abort());
  await p.goto(base + '/simulate', { waitUntil: 'load' });
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
  const p = await ctx.newPage();
  await p.route('**/api/**', (r) => r.abort());
  await p.route('**/assets/*.css', async (route) => {
    const res = await route.fetch();
    const css = (await res.text())
      .replace(/@supports\s*\(\s*color:\s*oklch\([^)]*\)\s*\)/g, '@supports (color: xoklchx(0 0 0))');
    await route.fulfill({ status: 200, contentType: 'text/css', body: css });
  });
  await p.goto(base + '/', { waitUntil: 'load' });
  await p.waitForTimeout(400);

  const accent = await p.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--ui-accent').trim());
  ok(accent.toLowerCase() === ACCENT_HEX.toLowerCase(),
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
