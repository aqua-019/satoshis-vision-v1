// verify-site.mjs — DOM gate for /about/site, the 16th route: the site's page
// about itself, and the clover overlay that opens it.
//
// Sections:
//   §0  instrument floors — the source parses everything below compares against
//   §1  the route resolves and is PRERENDERED (a JS-off reader gets the mission,
//       the ethos brief and the support section, not an empty shell)
//   §2  the overlay is an OVERLAY — fixed, above the page, and it goes on its own
//   §3  the clover FORMS — driven through the read hook at an exact T, with a
//       non-vacuity floor and both polarities on the same instrument
//   §4  it is SKIPPABLE at any frame
//   §5  reduced motion — no overlay, no canvas, no loop, and nothing lost
//   §6  CLS, measured against this repo's own 0.005 ceiling
//   §7  every ethos claim's MECHANISM is real, checked against the tree
//   §8  the support section links and never fetches, and prints no figures
//   §9  the site overview is DERIVED from nav/ia.ts, both directions
//   §10 the operator link is a real anchor or an honest null — never a guess
//   §11 390px
//
// ── NO COLD-BOOT BYPASS HERE, DELIBERATELY — do not "restore" it. ─────────
// verify-peers, verify-superstress and verify-mine carry the identical note and
// the identical reason. verify-coldboot-live §0 audits which gates install the
// bypass against the set its own patterns detect as REACHING `/`. This gate
// never navigates to `/`, holds no array containing '/', names no R.HOME, and
// does not ITERATE the canonical ROUTES — it imports that list purely as a
// membership predicate (`.includes()` in §9), the shape that gate's §0 carves
// out. Installing a bypass this gate does not need reds §0 with "DETECTOR
// STALE". It is also structurally unnecessary: coldboot/gate.ts's predicate
// ends `return pathname === R.HOME`, so the splash cannot reach this route.
//
// ── WHY §3 DRIVES `T` INSTEAD OF SLEEPING ────────────────────────────────
// `cloverField.drawClover` is pure in (ctx, w, h, T, density) — no Date.now(),
// no frame counter, nothing accumulated. `window.__XMR_CLOVER__.drawAt(T)`
// exposes that, so "the clover formed" is rendered on demand and asserted,
// rather than raced against a wall clock on a contended runner. The polarity
// pair runs on ONE instrument: the same pixel census at T=0 must NOT show the
// shape that the census at T_FORMED must show. A single-ended version would
// pass just as well if the canvas were painted green edge to edge.
//
// BLIND SPOTS (stated, not hidden):
//   — Whether the clover is BEAUTIFUL. §3 proves a four-lobed silhouette is
//     present in the clover tint and concentrated where the stencil puts it.
//     It cannot tell a handsome clover from an ugly one; that was done by
//     rendering it and looking, at 1440 and 390.
//   — The LIVE feed face. serve-dist answers /api/** with 501, so this page is
//     read in its degraded state. This route renders no live figure at all, so
//     unlike the other page gates that costs nothing here.
//   — Whether the fundraiser URL is correct or the fund is live. Nothing
//     offline can know that. §8 asserts the anchor's shape and that the browser
//     never REQUESTS the host; the destination is an operator check.
//   — Prose QUALITY, and whether the ethos claims are morally sufficient. §7
//     checks each claim against the mechanism it cites. It cannot check that
//     citing that mechanism was the right thing to promise.
//
// Run against serve-dist (NOT vite preview — see verify-future.mjs header):
//   npm run build && npm run wait-preview && node verify-site.mjs

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChromium } from './verify-lib.mjs';
import { makeReporter } from './verify-reporter.mjs';
import { ROUTES } from './scripts/routes.mjs';

const BASE = 'http://localhost:4173';
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const R = makeReporter('verify-site');

const SITE = '/about/site';

/**
 * Navigate and wait for the page to actually be on screen.
 *
 * `main.tsx` uses `createRoot`, not `hydrateRoot`, so React DISCARDS the
 * prerendered markup and renders fresh — and the page is `React.lazy`, so
 * there is a real window in which `#root` is empty while its chunk downloads.
 * Reading at `domcontentloaded` measures that window: the first version of §9,
 * §10 and §11 all reported "0 chars" against a page that renders perfectly.
 * A true measurement of the wrong instant.
 */
async function gotoSite(p, { waitUntil = 'domcontentloaded' } = {}) {
  await p.goto(BASE + SITE, { waitUntil });
  await p.waitForSelector('[data-ia-overview]', { timeout: 8000 });
  return p;
}
/** This repo's own CLS ceiling, the figure verify-cls judges against. */
const CLS_CEILING = 0.005;

/* ══ §0 · instrument floors ═════════════════════════════════════════════
   Every set-difference below is vacuously true if its parse returns nothing —
   the defect verify-ia §7b and verify-superstress §0 each open with a floor to
   prevent. Each parse is asserted non-empty BEFORE anything reads it. */
R.group('§0 · instrument floors — the parses everything below depends on');

const PAGE_SRC = readFileSync(join(__dirname, 'src/pages/SitePage.tsx'), 'utf8');
R.ok(PAGE_SRC.length > 8000, `SitePage.tsx read (${PAGE_SRC.length} chars)`);

const FIELD_SRC = readFileSync(join(__dirname, 'src/pages/about/cloverField.ts'), 'utf8');
const OVER_SRC = readFileSync(join(__dirname, 'src/pages/about/CloverOverlay.tsx'), 'utf8');
R.ok(FIELD_SRC.length > 4000 && OVER_SRC.length > 3000,
  `overlay sources read (field ${FIELD_SRC.length}, host ${OVER_SRC.length} chars)`);

/** Every `<Claim … mech="…">` on the page, parsed from source. §7 checks each. */
const CLAIMS = [...PAGE_SRC.matchAll(/<Claim\s+head="([^"]+)"\s+mech="([^"]+)"/g)]
  .map((m) => ({ head: m[1], mech: m[2] }));
R.ok(CLAIMS.length >= 5,
  `parsed the ethos claims from source (${CLAIMS.length})`,
  'a parse returning nothing would make §7 vacuously true');

/** The wall-clock budget the overlay gives itself. Parsed, never retyped. */
const RUN_MS = Number((OVER_SRC.match(/export const RUN_MS = (\d+)/) || [])[1]);
R.ok(Number.isFinite(RUN_MS) && RUN_MS > 0 && RUN_MS <= 4000,
  `overlay run budget parsed from source: ${RUN_MS}ms, and it is within the 4s cap`);

const { browser, engine } = await launchChromium();
R.info(`engine: ${engine}`);

/* ══ §1 · prerendered, and the words are in the HTML ════════════════════ */
R.group('§1 · the route is prerendered — a JS-off reader gets the page');
{
  const pre = readFileSync(join(__dirname, 'dist/about/site/index.html'), 'utf8');
  R.ok(pre.length > 4000, `dist/about/site/index.html exists (${pre.length} chars)`);
  const body = pre.replace(/<script[\s\S]*?<\/script>/g, '');
  for (const [what, needle] of [
    ['the mission heading', 'non-profit educational system'],
    ['the ethos brief', 'Nothing here reports on you'],
    ['the support section', 'Support xmr.irish'],
    ['the lineage section', 'sixth generation'],
  ]) {
    R.ok(body.includes(needle), `1 · ${what} is in the prerendered HTML`);
  }
  // The overlay must NOT be in the prerendered document: it is a client-only
  // decoration, and a JS-off reader who got a static scrim over the page would
  // be reading through a permanent grey veil.
  R.ok(!body.includes('data-clover-overlay'),
    '1 · the overlay is NOT prerendered — no scrim for a JS-off reader');
  R.ok(body.includes('data-clover-mark'),
    '1 · the STATIC clover mark IS prerendered — the mark survives with no JS');
}

/* ══ §2 · it is an overlay, and it leaves ═══════════════════════════════ */
R.group('§2 · the overlay is fixed, on top, and dismisses itself');
let ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
{
  const p = await ctx.newPage();
  await p.goto(BASE + SITE, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('[data-clover-overlay]', { timeout: 5000 });
  const m = await p.evaluate(() => {
    const el = document.querySelector('[data-clover-overlay]');
    const cs = getComputedStyle(el);
    const cv = document.querySelector('[data-clover-canvas]');
    return {
      position: cs.position,
      z: Number(cs.zIndex),
      pointer: cs.pointerEvents,
      hidden: el.getAttribute('aria-hidden'),
      focusable: el.querySelectorAll('a,button,input,[tabindex]').length,
      canvasW: cv ? cv.width : 0,
      canvasH: cv ? cv.height : 0,
      // the page beneath is REALLY there, painting, from the first frame
      mainChars: (document.querySelector('main.main')?.innerText || '').length,
    };
  });
  R.ok(m.position === 'fixed', `2 · position: fixed (${m.position}) — out of flow, so it shifts nothing`);
  R.ok(m.z >= 1000, `2 · above the app's own stack (z-index ${m.z})`);
  R.ok(m.pointer === 'none', `2 · pointer-events: none (${m.pointer}) — the page stays usable beneath it`);
  R.ok(m.hidden === 'true', '2 · aria-hidden — assistive tech reads the page, not the decoration');
  R.ok(m.focusable === 0, `2 · holds no focusable node (${m.focusable}) — it cannot trap a keyboard`);
  R.ok(m.canvasW > 0 && m.canvasH > 0, `2 · the canvas has a real backing store (${m.canvasW}×${m.canvasH})`);
  R.ok(m.mainChars > 2000,
    `2 · the page is rendered BENEATH it from the first frame (${m.mainChars} chars of text)`);

  // and it goes on its own, within its own stated budget plus slack
  await p.waitForFunction(() => !document.querySelector('[data-clover-overlay]'),
    undefined, { timeout: RUN_MS + 2500 }).catch(() => {});
  const gone = await p.evaluate(() => !document.querySelector('[data-clover-overlay]'));
  R.ok(gone, `2 · the overlay removes itself within its own ${RUN_MS}ms budget`);
  await p.close();
}

/* ══ §3 · the clover FORMS ══════════════════════════════════════════════
   Driven through the read hook at an exact T — see this file's header. The
   census counts CLOVER-TINT pixels inside the stencil's own centre box against
   the same count in the corners, and runs the identical census at T=0. */
R.group('§3 · the clover forms — deterministic, both polarities, one instrument');
{
  const p = await ctx.newPage();
  await p.goto(BASE + SITE, { waitUntil: 'domcontentloaded' });
  // Wait for the HOOK, not for the markup. Waiting on the canvas selector was
  // the first version and it matched the PRERENDERED element before hydration
  // had installed anything — a true wait for the wrong subject.
  await p.waitForFunction(() => !!window.__XMR_CLOVER__, undefined, { timeout: 6000 });

  const cells = await p.evaluate(() => window.__XMR_CLOVER__?.cells?.() ?? -1);
  R.ok(cells > 300,
    `3 · the stencil rasterises to ${cells} cells — the non-vacuity floor`,
    'a "the clover formed" assertion proves nothing if the stencil filled zero cells');

  /** Fraction of GREENISH pixels (the clover tint) in a centred box vs the corners. */
  const census = async (T) => p.evaluate((t) => {
    window.__XMR_CLOVER__.drawAt(t);
    const cv = document.querySelector('[data-clover-canvas]');
    const g = cv.getContext('2d');
    const box = (x, y, w, h) => {
      const d = g.getImageData(x, y, w, h).data;
      let green = 0, lit = 0;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], gg = d[i + 1], b = d[i + 2], a = d[i + 3];
        if (a < 24) continue;
        lit++;
        // the clover tint is --g-50 (#4ade80): green clearly dominant over red
        if (gg > r + 26 && gg > b + 12) green++;
      }
      return { green, lit };
    };
    const W = cv.width, H = cv.height;
    const cw = Math.round(W * 0.22), chh = Math.round(H * 0.30);
    const centre = box(Math.round(W / 2 - cw / 2), Math.round(H / 2 - chh / 2), cw, chh);
    const corner = box(4, 4, cw, chh);
    return { centre, corner };
  }, T);

  const formedT = await p.evaluate(() => window.__XMR_CLOVER__.formedT);
  R.ok(formedT > 0 && formedT < 1, `3 · the formed phase is exported by the field module (T=${formedT})`);

  // T_STREAM, not 0. `fieldAlpha` is defined to return 0 at exactly T=0 (the
  // overlay has not faded in yet), so a census there measures an empty canvas
  // and the vacuity guard below would fail against perfectly correct code. Pick
  // a point inside the stream phase but before LOCK_FROM (0.08), where the
  // field IS painting and no cell has locked.
  const T_STREAM = 0.05;
  const stream = await census(T_STREAM);
  const formed = await census(formedT + 0.06);

  R.ok(formed.centre.green > 400,
    `3 · at T=${(formedT + 0.06).toFixed(2)} the centre carries the clover tint (${formed.centre.green} px)`);
  R.ok(formed.centre.green > formed.corner.green * 8,
    `3 · and it is CONCENTRATED where the stencil puts it — centre ${formed.centre.green} px vs corner ${formed.corner.green} px`,
    'a canvas painted green edge to edge would satisfy the count alone');
  // the other polarity, on the same instrument
  R.ok(stream.centre.green * 4 < formed.centre.green,
    `3 · at T=${T_STREAM} the shape is NOT there — stream ${stream.centre.green} px against formed ${formed.centre.green} px`,
    'without this, a permanently-green canvas passes every assertion above');
  R.ok(stream.centre.lit > 0,
    `3 · …and the field IS painting there (${stream.centre.lit} lit px) — the SHAPE is absent, not the canvas`);
  await p.close();
}

/* ══ §4 · skippable ════════════════════════════════════════════════════ */
R.group('§4 · it can be dismissed at any frame');
{
  for (const [how, act] of [
    ['a keypress', async (p) => p.keyboard.press('Escape')],
    ['a click', async (p) => p.mouse.click(700, 400)],
  ]) {
    const p = await ctx.newPage();
    await p.goto(BASE + SITE, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('[data-clover-overlay]', { timeout: 5000 });
    await p.waitForTimeout(250);       // mid-animation, nowhere near the end
    const before = await p.evaluate(() => !!document.querySelector('[data-clover-overlay]'));
    await act(p);
    await p.waitForFunction(() => !document.querySelector('[data-clover-overlay]'),
      undefined, { timeout: 2000 }).catch(() => {});
    const after = await p.evaluate(() => !!document.querySelector('[data-clover-overlay]'));
    R.ok(before && !after, `4 · ${how} mid-animation dismisses it immediately`);
    await p.close();
  }
}
await ctx.close();

/* ══ §5 · reduced motion ═══════════════════════════════════════════════ */
R.group('§5 · reduced motion — no overlay, no loop, nothing lost');
{
  const rctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const p = await rctx.newPage();
  // Count rAF before any page script runs: the claim is that NO loop starts,
  // which "the overlay is absent" does not by itself establish.
  await p.addInitScript(() => {
    window.__RAF__ = 0;
    const orig = window.requestAnimationFrame;
    window.requestAnimationFrame = function (cb) { window.__RAF__++; return orig.call(this, cb); };
  });
  await p.goto(BASE + SITE, { waitUntil: 'load' });
  await p.waitForTimeout(1200);
  const m = await p.evaluate(() => ({
    overlay: !!document.querySelector('[data-clover-overlay]'),
    canvas: !!document.querySelector('[data-clover-canvas]'),
    hook: !!window.__XMR_CLOVER__,
    mark: document.querySelectorAll('[data-clover-mark]').length,
    chars: (document.querySelector('main.main')?.innerText || '').length,
    running: document.getAnimations ? document.getAnimations().filter((a) => a.playState === 'running').length : -1,
    smil: document.querySelectorAll('animate,animateTransform,animateMotion').length,
  }));
  R.ok(!m.overlay, '5 · no overlay element is mounted at all');
  R.ok(!m.canvas, '5 · no canvas is created');
  R.ok(!m.hook, '5 · the draw hook never installs — the effect did not run');
  R.ok(m.mark === 1, `5 · the STATIC clover mark is still on the page (${m.mark}) — nothing is lost`);
  R.ok(m.chars > 2000, `5 · the reader goes straight to the content (${m.chars} chars)`);
  R.ok(m.running === 0, `5 · zero running animations (${m.running})`);
  R.ok(m.smil === 0, `5 · no SMIL, which no CSS reduce rule can stop (${m.smil})`);
  await rctx.close();
}

/* ══ §6 · CLS ══════════════════════════════════════════════════════════
   MEASURED, not argued. The overlay is position:fixed and therefore cannot
   shift anything — but "cannot" is a mechanism, and p4·03 recorded a case where
   a proxy assertion stood in for the number and the number turned out to say
   something else. verify-cls bypasses the cold boot before measuring and never
   visits this route, so this overlay's own CLS is measured nowhere else. */
R.group('§6 · CLS across the whole overlay lifetime');
{
  const cctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await cctx.newPage();
  await p.addInitScript(() => {
    window.__CLS__ = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) window.__CLS__ += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await p.goto(BASE + SITE, { waitUntil: 'load' });
  await p.waitForFunction(() => !document.querySelector('[data-clover-overlay]'),
    undefined, { timeout: RUN_MS + 2500 }).catch(() => {});
  await p.waitForTimeout(400);
  const cls = await p.evaluate(() => window.__CLS__);
  R.ok(cls <= CLS_CEILING,
    `6 · CLS ${cls.toFixed(5)} ≤ ${CLS_CEILING} across mount, hold and dissolve`);
  await cctx.close();
}

/* ══ §7 · every ethos claim's mechanism is real ═════════════════════════
   The section's whole value is that a reader can go and check it. A citation
   naming a file that does not exist is worse than no citation, so each is
   checked against the tree — and the load-bearing ones are checked against
   their CONTENT, not merely their existence. */
R.group('§7 · the ethos claims cite mechanisms that exist and say what is claimed');
{
  const vercel = readFileSync(join(repoRoot, 'vercel.json'), 'utf8');
  R.ok(vercel.includes("connect-src 'self'"),
    "7 · vercel.json really does set connect-src 'self'");
  R.ok(/"Referrer-Policy"\s*,\s*"value"\s*:\s*"no-referrer"/.test(vercel.replace(/\s+/g, ' '))
       || /no-referrer/.test(vercel),
    '7 · …and Referrer-Policy: no-referrer, which is what the outbound-link claim rests on');

  const fonts = readdirSync(join(__dirname, 'public/fonts')).filter((f) => f.endsWith('.woff2'));
  R.ok(fonts.length === 12,
    `7 · the "12 self-hosted woff2" claim matches the tree (${fonts.length})`);

  R.ok(existsSync(join(__dirname, 'scripts/prerender.mjs')) &&
       existsSync(join(__dirname, 'dist/about/site/index.html')),
    '7 · the prerender claim names a real script AND produced this route');

  // the origins gate must actually cover THIS page, or the claim overstates
  const origins = readFileSync(join(__dirname, 'verify-origins.mjs'), 'utf8');
  R.ok(origins.includes(`'${SITE}'`),
    `7 · verify-origins drives ${SITE}, so "this page among them" is true of this page`,
    'the claim said the gate counts requests on this page; it must be in that list');

  // "no challenge code in the tree" — the one claim that is an ABSENCE
  const CHALLENGE = /\b(captcha|turnstile|hcaptcha|recaptcha)\b/i;
  const scan = (dir) => {
    const out = [];
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', 'dist', '.git', 'dist-ssr', '.perf'].includes(e.name)) continue;
      const f = join(dir, e.name);
      if (e.isDirectory()) out.push(...scan(f));
      else if (/\.(ts|tsx|js|jsx|mjs|html|css)$/.test(e.name)) out.push(f);
    }
    return out;
  };
  const files = scan(join(__dirname, 'src')).concat([join(__dirname, 'index.html')]);
  R.ok(files.length > 100, `7 · the absence sweep has a corpus (${files.length} files)`);
  const hits = files.filter((f) => CHALLENGE.test(readFileSync(f, 'utf8')));
  R.ok(hits.length === 0,
    `7 · no bot-challenge code anywhere in app/src (${hits.length})`,
    hits.join(', '));

  // and every claim carries a mechanism at all
  const empty = CLAIMS.filter((c) => !c.mech || c.mech.trim().length < 8);
  R.ok(empty.length === 0,
    `7 · all ${CLAIMS.length} claims name a mechanism (${empty.length} bare)`);
}

/* ══ §8 · support: a link, never a fetch, and no figures ════════════════ */
R.group('§8 · the support section links out and prints no numbers');
{
  const sctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const offOrigin = [];
  sctx.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:')) offOrigin.push(u);
  });
  const p = await sctx.newPage();
  await p.goto(BASE + SITE, { waitUntil: 'load' });
  await p.waitForTimeout(600);
  const a = await p.evaluate(() => {
    const el = document.querySelector('[data-support-link]');
    if (!el) return null;
    const sec = el.closest('[data-panel], section, div');
    return {
      href: el.getAttribute('href'),
      rel: el.getAttribute('rel'),
      target: el.getAttribute('target'),
      text: el.textContent.trim(),
      sectionText: (el.closest('main') ? el.parentElement.parentElement.innerText : '') || '',
    };
  });
  R.ok(!!a, '8 · the support link is rendered');
  if (a) {
    R.ok(/^https:\/\//.test(a.href), `8 · it is an https anchor (${a.href})`);
    R.ok((a.rel || '').includes('noopener') && (a.rel || '').includes('noreferrer'),
      `8 · rel="noopener noreferrer" (${a.rel})`);
    R.ok(a.target === '_blank', `8 · target="_blank" (${a.target})`);
    // NO figures: no currency amount, no percentage, no "raised/goal"
    const bad = /(?:[$€£]\s?\d|\d+\s?(?:XMR|%)|\braised\b|\bgoal\b|\bof target\b)/i;
    R.ok(!bad.test(a.sectionText),
      '8 · the section prints no total, goal or percentage — live would need a forbidden fetch, hardcoded would rot');
  }
  const host = (a?.href || '').replace(/^https?:\/\//, '').split('/')[0];
  const touched = offOrigin.filter((u) => host && u.includes(host));
  R.ok(offOrigin.length === 0,
    `8 · the browser made ZERO off-origin requests loading this page (${offOrigin.length})`,
    [...new Set(offOrigin)].join(', '));
  R.ok(touched.length === 0,
    `8 · and none at all to the fundraiser host — it is an anchor, not an embed`);
  await sctx.close();
}

/* ══ §9 · the overview is DERIVED ══════════════════════════════════════
   Both directions, so a rename cannot hide as an add plus a drop. The runtime
   IA is the authority; the page must render its sections and no others. */
R.group('§9 · the site overview agrees with nav/ia.ts in both directions');
{
  const { IA } = await import('./src/nav/ia.ts');
  R.ok(IA.length >= 5, `9 · the IA parsed (${IA.length} sections)`);
  const octx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await gotoSite(await octx.newPage());
  const rendered = await p.evaluate(() =>
    [...document.querySelectorAll('[data-ia-section]')].map((e) => e.getAttribute('data-ia-section')));
  const expected = IA.map((s) => s.key);
  const missing = expected.filter((k) => !rendered.includes(k));
  const extra = rendered.filter((k) => !expected.includes(k));
  R.ok(missing.length === 0, `9 · every IA section is rendered (${missing.length} missing: ${missing.join(', ')})`);
  R.ok(extra.length === 0, `9 · and no section the IA does not declare (${extra.length} extra: ${extra.join(', ')})`);

  // every link the overview emits is a route or a real in-app path
  const hrefs = await p.evaluate(() =>
    [...document.querySelectorAll('[data-ia-overview] a')].map((a) => a.getAttribute('href')));
  R.ok(hrefs.length >= 10, `9 · the overview emits links (${hrefs.length})`);
  const bad = hrefs.filter((h) => !h || !h.startsWith('/'));
  R.ok(bad.length === 0, `9 · every overview link is in-app (${bad.length} external: ${bad.join(', ')})`);
  R.ok(ROUTES.includes(SITE), `9 · ${SITE} is a registered route`);
  await octx.close();
}

/* ══ §10 · the operator link ═══════════════════════════════════════════ */
R.group('§10 · the operator link is real or honestly null — never a guess');
{
  const octx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await gotoSite(await octx.newPage());
  const m = await p.evaluate(() => {
    const el = document.querySelector('[data-operator-link]');
    return el && {
      state: el.getAttribute('data-operator-link'),
      tag: el.tagName.toLowerCase(),
      href: el.getAttribute('href'),
      rel: el.getAttribute('rel'),
      text: el.textContent.trim(),
    };
  });
  R.ok(!!m, '10 · the operator slot is rendered in one of its two states');
  if (m) {
    R.ok(m.state === 'linked' || m.state === 'pending',
      `10 · it declares its state (${m.state})`);
    if (m.state === 'pending') {
      R.ok(m.tag === 'span' && !m.href,
        '10 · pending: it is NOT an anchor and carries no href — an unconfirmed handle is not linked');
      R.ok(/pending/i.test(m.text), `10 · …and it says so on the page ("${m.text}")`);
    } else {
      R.ok(m.tag === 'a' && /^https:\/\//.test(m.href || ''),
        `10 · linked: a real https anchor (${m.href})`);
      R.ok((m.rel || '').includes('noreferrer'), `10 · …with rel="${m.rel}"`);
    }
  }
  // and the source must not carry a handle outside the single declared constant
  const handles = [...PAGE_SRC.matchAll(/@[A-Za-z][A-Za-z0-9_]{2,}/g)].map((x) => x[0])
    .filter((h) => !/^@[a-z]+\//.test(h));
  R.ok(handles.length === 0,
    `10 · no social handle is written anywhere else in the page source (${handles.length}: ${handles.join(', ')})`,
    'an invented handle on the page that says who runs the site is an impersonation vector');
  await octx.close();
}

/* ══ §11 · 390px ═══════════════════════════════════════════════════════ */
R.group('§11 · 390px');
{
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await gotoSite(await mctx.newPage());
  await p.waitForFunction(() => !document.querySelector('[data-clover-overlay]'),
    undefined, { timeout: RUN_MS + 2500 }).catch(() => {});
  const m = await p.evaluate(() => {
    const past = [...document.querySelectorAll('main.main *')]
      .filter((e) => e.getBoundingClientRect().right > window.innerWidth + 0.5).length;
    const svgText = document.querySelectorAll('main.main svg text').length;
    return { past, svgText, chars: (document.querySelector('main.main')?.innerText || '').length };
  });
  R.ok(m.past === 0, `11 · nothing overflows the viewport (${m.past} elements past the right edge)`);
  R.ok(m.svgText === 0,
    `11 · the page renders no SVG <text> (${m.svgText}) — so verify-mobile §6's bounded list gains no entry`);
  R.ok(m.chars > 2000, `11 · the content is all there at 390 (${m.chars} chars)`);
  await mctx.close();
}

await browser.close();
process.exit(R.finish());
