// verify-motion.mjs — the view-transition foundation: design/viewTransition.ts,
// design/useViewTransitionNavigate.ts, routes/NavTransitions.tsx,
// styles-motion.css, VisualContext.tsx's theme crossfade, and FuturePage's
// card→modal shared-element morph.
//
// Modelled on verify-contrast.mjs for shape (BASE/launch/makeReporter from
// verify-lib.mjs), but does NOT reuse newThemedPage() — this gate additionally
// needs the Playwright `reducedMotion` context option and a
// `document.startViewTransition` probe, neither of which that helper's
// signature carries, and verify-lib.mjs is owned by another stream right now.
//
// Never `waitUntil: 'networkidle'` — the 3s FAST polling tier means the
// network is never idle (see verify-contrast.mjs's identical note). Every
// navigation below waits on `domcontentloaded` + an explicit selector.
//
// Run from app/: `npm run build && (node scripts/serve-dist.mjs &) && node verify-motion.mjs`

import { readFileSync } from 'node:fs';
import { launch, makeReporter, BASE, coldBootOffBrowser, assertColdBootBypassed } from './verify-lib.mjs';


/** Click a real in-app link through the v6.1.6 nav.
 *
 *  The flat `nav.topnav` link row is gone: six <button class="navitem">
 *  section triggers, with the page links inside `#nav-dd-panel`, which only
 *  renders while a section is open. So a `nav.topnav a[href=...]` click now
 *  waits 30s and throws — this gate died there, uncaught, before §1's first
 *  assertion. Updating the HREF alone was not enough; the SELECTOR moved too.
 *
 *  Opens the owning section with focus + ArrowDown rather than clicking the
 *  trigger: a trigger click NAVIGATES (to cols[0].items[0].p), which would be a
 *  side effect in the middle of a navigation test.
 *
 *  `.nav-noscript` carries the same hrefs but ships display:none, so it is
 *  deliberately not a click target here. */
async function clickNavLink(page, href) {
  if (href === '/') { await page.click('a.brand'); return; }
  const sel = `#nav-dd-panel a[href="${href}"]`;
  // Visibility, NOT count(). The panel keeps rendering the LAST opened
  // section's content while it fades out (NavTop keeps `renderedKey` after
  // close, so the closing transition doesn't play over an empty box), so the
  // link is in the DOM for the wrong section too. A count() check breaks on
  // the first trigger and then clicks a hidden node for 30s.
  const visible = async () =>
    page.locator(sel).first().waitFor({ state: 'visible', timeout: 800 }).then(() => true, () => false);

  if (!(await visible())) {
    const items = page.locator('button.navitem');
    const n = await items.count();
    if (n === 0) throw new Error('clickNavLink: no button.navitem — nav markup changed again');
    for (let i = 0; i < n; i++) {
      await items.nth(i).focus();
      await page.keyboard.press('ArrowDown');
      if (await visible()) break;
      await page.keyboard.press('Escape');
    }
  }
  await page.locator(sel).first().click();
}

/**
 * The app's OWN definition of "this DOM is still showing a Suspense fallback",
 * lifted from src/entry-ssr.tsx rather than re-typed. entry-ssr and
 * prerender.mjs already share this one pattern precisely because two copies of
 * it drifted by a single space once and shipped /simulate with an empty #root.
 *
 * Assertion 2 below used a bare /loading/i over body innerText. That was a
 * PROXY for "did the transition snapshot a fallback", and it was over-broad: it
 * matches any occurrence of the word anywhere on the page. v6.1.4 made
 * provenance badges derive their freshness from real endpoints, so a badge
 * whose endpoint has not answered now renders the honest suffix " · loading" —
 * which is not a Suspense fallback, is not a defect, and tripped the proxy on
 * every /mempool badge at once.
 *
 * SUSPENDED_RE requires a trailing "." or "…" after `loading`, so it matches
 * "loading…" and "loading simulators…" and does NOT match " · loading". Using
 * it here makes this assertion test the thing it is named after, and makes it
 * strictly more precise than the pattern it replaces.
 */
const SUSPENDED_RE = (() => {
  const src = readFileSync(new URL('./src/entry-ssr.tsx', import.meta.url), 'utf8');
  const m = src.match(/export const SUSPENDED_RE\s*=\s*\/(.+)\/([a-z]*);/);
  if (!m) throw new Error('verify-motion: could not extract SUSPENDED_RE from src/entry-ssr.tsx');
  const re = new RegExp(m[1], m[2]);
  // Self-check: a botched extraction would make assertion 2 pass vacuously.
  if (!re.test('loading simulators…') || re.test('COINGECKO · loading')) {
    throw new Error('verify-motion: extracted SUSPENDED_RE does not behave as expected');
  }
  return re;
})();

const R = makeReporter('verify-motion');
const { browser, engine } = await launch();
// v6.1.8: this gate navigates to `/` three times and also reaches it by
// clicking a.brand. See verify-lib.mjs's COLD BOOT block.
await coldBootOffBrowser(browser);
console.log('engine:', engine);

/**
 * A themed page whose `document.startViewTransition` is wrapped to record,
 * per call: the `data-vt`/`data-vt-dir` <html> attributes at call time, and —
 * INSIDE the real update callback, immediately after it runs — whether
 * `main.main` exists, whether the body text contains "loading", and how many
 * elements carry a live (non-"none") `view-transition-name`. The wrapped
 * callback is what the REAL API invokes, at the real moment it invokes it
 * (right after taking its "old" snapshot) — this script never calls the
 * app's update function itself, which would capture a false "old" snapshot
 * that already reflects the update.
 *
 * `removeApi: true` shadows `document.startViewTransition` with `undefined`
 * instead (an own-property override — the method lives on
 * `Document.prototype`, so a bare `delete document.startViewTransition` is a
 * silent no-op) for the feature-absent path (§6).
 */
async function newProbePage(browser, { width, height }, { theme = 'classic', reducedMotion = 'no-preference', removeApi = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion });
  // Same pre-paint theme stamp newThemedPage() (verify-lib.mjs) installs —
  // `?.` guards against Playwright's own internal about:blank bootstrap
  // page, whose `documentElement` can be transiently null when an
  // addInitScript-registered function runs before that page finishes
  // initializing. Harmless there either way (that page is never used for
  // anything), but assertion 6 below listens for `pageerror` on the REAL
  // page and would otherwise misreport this pre-existing, unrelated quirk
  // as an app bug.
  await ctx.addInitScript((t) => {
    try { localStorage.setItem('xmri.theme', t); } catch { /* storage disabled */ }
    document.documentElement?.setAttribute('data-theme', t);
  }, theme);
  await ctx.addInitScript(({ remove, suspendedSource, suspendedFlags }) => {
    window.__vt = { calls: [] };
    window.__suspendedRe = new RegExp(suspendedSource, suspendedFlags);
    if (remove) {
      Object.defineProperty(document, 'startViewTransition', { value: undefined, configurable: true });
      return;
    }
    const real = document.startViewTransition && document.startViewTransition.bind(document);
    if (!real) return; // this engine genuinely has no support — nothing to probe
    const morphCount = () =>
      Array.from(document.querySelectorAll('*')).filter(
        (el) => el.style && el.style.viewTransitionName && el.style.viewTransitionName !== 'none'
      ).length;
    document.startViewTransition = function (cb) {
      const rec = {
        vt: document.documentElement.getAttribute('data-vt'),
        dir: document.documentElement.getAttribute('data-vt-dir'),
      };
      window.__vt.calls.push(rec);
      const wrapped = () => {
        const ret = cb ? cb() : undefined;
        // "Inside the callback" — every startVt() caller in this app wraps
        // its state commit in flushSync, so the DOM is already settled by
        // the time cb() returns; this runs before control returns to the
        // real API, which is as close to "the instant after update" as
        // page-context JS can observe.
        rec.hasMain = !!document.querySelector('main.main');
        rec.bodySuspended = window.__suspendedRe.test(document.body.innerText);
        rec.morphCountAfterUpdate = morphCount();
        return ret;
      };
      const transition = real(wrapped);
      window.__vt.last = transition;
      rec.transition = transition;
      return transition;
    };
  }, { remove: removeApi, suspendedSource: SUSPENDED_RE.source, suspendedFlags: SUSPENDED_RE.flags });
  return ctx.newPage();
}

const resetCalls = (page) => page.evaluate(() => { window.__vt.calls.length = 0; });
const lastCall = (page) => page.evaluate(() => window.__vt.calls[window.__vt.calls.length - 1] || null);
const callCount = (page) => page.evaluate(() => window.__vt.calls.length);

// ── 1+2 · resolved-Set gate: first visit doesn't transition, second does ──
{
  R.group('── 1+2 · route transitions gate on the resolved-chunk Set ────');
  const page = await newProbePage(browser, { width: 1440, height: 900 }, {});
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('main.main');

  await resetCalls(page);
  await clickNavLink(page, '/live/mempool');
  await page.waitForSelector('.mp-shell', { timeout: 15000 });
  const firstVisitCalls = await callCount(page);
  R.ok(firstVisitCalls === 0, `1 · first visit to /live/mempool calls startViewTransition 0 times (got ${firstVisitCalls})`,
    'a transition on an unresolved chunk would morph into the Suspense fallback');

  await resetCalls(page);
  await clickNavLink(page, '/');
  await page.waitForSelector('main.main');
  const homeCalls = await callCount(page);

  await resetCalls(page);
  await clickNavLink(page, '/live/mempool');
  await page.waitForSelector('.mp-shell', { timeout: 15000 });
  const secondVisitCalls = await callCount(page);
  R.ok(secondVisitCalls === 1, `1 · second visit to /live/mempool calls startViewTransition exactly once (got ${secondVisitCalls})`);
  R.info(`(home navigation in between called it ${homeCalls} time(s) — home is eager, seeded resolved on load)`);

  const rec = await lastCall(page);
  R.ok(!!rec && rec.vt === 'route', `1 · dataset.vt === "route" (got ${rec && rec.vt})`);
  R.ok(!!rec && rec.hasMain === true, '2 · after-state contains main.main');
  R.ok(!!rec && rec.bodySuspended === false, '2 · after-state shows no Suspense fallback (SUSPENDED_RE, the app\'s own definition)');

  await page.context().close();
}

// ── 3 · reduced motion suppresses movement, not the transition ────────────
{
  R.group('── 3 · reduced motion: no vt-slide-*, transition still runs ──');
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const page = await newProbePage(browser, { width: 1440, height: 900 }, { reducedMotion });
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('main.main');
    await clickNavLink(page, '/live/mempool'); // resolve the chunk (no transition expected)
    await page.waitForSelector('.mp-shell', { timeout: 15000 });
    await clickNavLink(page, '/');
    await page.waitForSelector('main.main');

    await resetCalls(page);
    await clickNavLink(page, '/live/mempool'); // second visit — transitions
    await page.waitForSelector('.mp-shell', { timeout: 15000 });

    const anims = await page.evaluate(async () => {
      const t = window.__vt.last;
      if (!t) return null;
      await t.ready;
      return document.getAnimations().map((a) => ({
        name: a.animationName || null,
        pseudo: (a.effect && typeof a.effect.pseudoElement === 'string') ? a.effect.pseudoElement : null,
      }));
    });

    R.ok(Array.isArray(anims), `3 · [${reducedMotion}] document.getAnimations() readable after transition.ready`);
    const vtAnims = (anims || []).filter((a) => a.pseudo && a.pseudo.startsWith('::view-transition-'));
    const slideAnims = vtAnims.filter((a) => a.name && a.name.startsWith('vt-slide'));
    R.info(`[${reducedMotion}] ${vtAnims.length} ::view-transition-* animation(s), ${slideAnims.length} named vt-slide-*`);

    if (reducedMotion === 'no-preference') {
      R.ok(slideAnims.length > 0, '3 · [no-preference] a vt-slide-* animation is present');
    } else {
      R.ok(slideAnims.length === 0, '3 · [reduce] NO vt-slide-* animation is present (movement suppressed)');
      R.ok(vtAnims.length > 0, '3 · [reduce] the transition still ran — ≥1 animation on a ::view-transition-* pseudo');
    }

    await page.context().close();
  }
}

// ── 4 · theme toggle: one "theme"-kind call, data-theme actually changes ──
{
  R.group('── 4 · theme toggle runs a "theme"-kind transition ────────────');
  const page = await newProbePage(browser, { width: 1440, height: 900 }, { theme: 'classic' });
  await page.goto(BASE + '/live/markets', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.panel', { timeout: 15000 });

  const before = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  R.ok(before === 'classic', `4 · starts on classic (got ${before})`);

  await resetCalls(page);
  const trigger = await page.$('[data-testid="design-panel-trigger"]');
  if (!trigger) {
    R.ok(false, '4 · the ⌘ DESIGN trigger is reachable');
  } else {
    await trigger.click();
    await page.getByTestId('theme-toggle').getByText(/indigo/i).click({ timeout: 5000 });
    // Same settle idiom verify-contrast.mjs uses for a theme flip.
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

    const after = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    const n = await callCount(page);
    const rec = await lastCall(page);

    R.ok(after === 'indigo', `4 · dataset.theme actually changed (classic → ${after})`);
    R.ok(n === 1, `4 · exactly one startViewTransition call for the toggle (got ${n})`);
    R.ok(!!rec && rec.vt === 'theme', `4 · dataset.vt === "theme" (got ${rec && rec.vt})`);
  }

  await page.context().close();
}

// ── 5 · Future card → modal shared-element morph, name never lingers ──────
{
  R.group('── 5 · Future card→modal: exactly one name, none after finished ─');
  const page = await newProbePage(browser, { width: 1440, height: 900 }, {});
  await page.goto(BASE + '/future', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.panel', { timeout: 15000 });

  const card = page.locator('.panel').filter({ has: page.getByRole('heading', { level: 3, name: 'FCMP++', exact: true }) }).first();
  await card.waitFor();

  await resetCalls(page);
  await card.click();
  await page.locator('[role="dialog"]').waitFor({ timeout: 10000 });

  const n = await callCount(page);
  const rec = await lastCall(page);
  R.ok(n === 1, `5 · opening the card calls startViewTransition once (got ${n})`);
  R.ok(!!rec && rec.vt === 'modal', `5 · dataset.vt === "modal" (got ${rec && rec.vt})`);
  R.ok(!!rec && rec.morphCountAfterUpdate === 1,
    `5 · inside the callback, exactly one element carries the morph name (got ${rec && rec.morphCountAfterUpdate})`);

  const afterFinished = await page.evaluate(async () => {
    const t = window.__vt.last;
    if (t) await t.finished.catch(() => {});
    // FuturePage clears `morph` in a `.then()` off startVt's OWN returned
    // promise, chained from the same `transition.finished` — give React a
    // couple of frames to commit that state update and re-render.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return Array.from(document.querySelectorAll('*')).filter(
      (el) => el.style && el.style.viewTransitionName && el.style.viewTransitionName !== 'none'
    ).length;
  });
  R.ok(afterFinished === 0, `5 · after finished, ZERO elements carry the morph name (got ${afterFinished}) — no lingering regression`);

  await page.context().close();
}

// ── 6 · feature-absent path: navigation still works with no API at all ────
{
  R.group('── 6 · startViewTransition absent — navigation degrades cleanly ─');
  const page = await newProbePage(browser, { width: 1440, height: 900 }, { removeApi: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('main.main');
  const hasApi = await page.evaluate(() => typeof document.startViewTransition === 'function');
  R.ok(hasApi === false, '6 · startViewTransition is genuinely absent in this context');

  await clickNavLink(page, '/live/mempool');
  await page.waitForSelector('.mp-shell', { timeout: 15000 });
  const url = new URL(page.url());
  R.ok(url.pathname === '/live/mempool', `6 · navigation still lands on the right route (got ${url.pathname})`);
  R.ok(errors.length === 0, `6 · no page errors thrown (got ${errors.length}: ${errors.join(' | ')})`);

  await page.context().close();
}

await browser.close();
process.exit(R.finish());
