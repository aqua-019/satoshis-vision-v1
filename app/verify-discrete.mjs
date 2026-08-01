// verify-discrete.mjs — D0665/D0666 gate: @starting-style + allow-discrete.
//
// Two surfaces gained an entry/exit transition where they previously had an
// instant flip, and one grid gained a stagger cascade. All three are easy to
// half-break in ways nothing else in this repo would notice:
//
//   1. The mempool view switcher (styles.css, `.mp-switcher__list`) now
//      transitions `display` with `allow-discrete`. The asymmetry is the
//      whole point — per css-transitions-2 a discrete `display` transition
//      flips at 0% when the TO value is not `none` and at 100% when it is —
//      so OPENING must stay instant while CLOSING is held for the duration.
//      Break the first half and verify-memviews.mjs scenario 5 (which clicks
//      the trigger and queries `#mp-view-list button` in the SAME evaluate)
//      finds an empty list. Break the second half and the exit silently
//      reverts to what it was before this work: nothing.
//
//   2. V6Modal.tsx now keeps an internal `present` flag so the dialog can
//      play an exit before unmounting. The observable consequence is that
//      `[role="dialog"]` SURVIVES one exit's worth of frames past a close.
//      That is the assertion here, and it is also why verify-future.mjs:495
//      had to stop sampling `isVisible()` on the line after Escape.
//
//   3. The /future and /peers card grids stagger by index (--stagger-i × 45ms
//      in styles.css). Under `prefers-reduced-motion: reduce` the whole thing
//      must be INERT — not merely fast — so every card reports the same zero
//      delay and no animation runs at all.
//
// Chromium only, deliberately. This gate measures a specific pair of CSS
// features (@starting-style and transition-behavior, both Chrome 117+ /
// Safari 17.4+ / Firefox 129+), and verify-lib's shared launch() prefers
// WebKit — so using it would make WHICH engine ran, and therefore what this
// gate proved, depend on whether a WebKit build happened to be fetchable. The
// Firefox-ESR-128 degradation path (Tor Browser's base, where neither feature
// exists) cannot be driven here at all — no Firefox is installed — so it is
// asserted STATICALLY from source instead, as the one structural property
// that guarantees it: `allow-discrete` sits inside the same `transition`
// shorthand declaration as the opacity/transform tweens, so an engine that
// rejects the keyword drops the whole declaration and gets today's instant
// flip in both directions rather than a half-applied middle state.
//
// NO `networkidle` ANYWHERE (the literal token is absent on purpose, so a
// grep can prove it): the FAST polling tier fires every 3s, so the network is
// never idle and that wait either races or times out. Every goto is
// domcontentloaded + an explicit waitForSelector on the thing being measured
// — the idiom verify-contrast.mjs:103-106 documents.
//
//   npm run build && (node scripts/serve-dist.mjs 4173 &) \
//     && npm run wait-preview && node verify-discrete.mjs
import { chromium } from 'playwright';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const BASE = process.env.VERIFY_BASE || 'http://localhost:4173';

function findChrome() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!existsSync(root)) return undefined;
  for (const d of readdirSync(root).filter((n) => n.startsWith('chromium-')).sort().reverse()) {
    const p = root + '/' + d + '/chrome-linux/chrome';
    if (existsSync(p)) return p;
  }
  return undefined;
}

let failed = false;
const ok = (cond, label, detail = '') => {
  if (cond) console.log(`  ✅ ${label}`);
  else { failed = true; console.log(`  ❌ ${label}${detail ? '\n     ' + detail : ''}`); }
  return cond;
};
const info = (m) => console.log(`  ·  ${m}`);
const group = (t) => console.log(`\n${t}`);

/** Read a value on the very next animation frame after a keypress, without a
 *  round trip in between. A `page.evaluate` issued AFTER `keyboard.press`
 *  measures whenever the CDP message happens to land, which for a ~150ms exit
 *  is a coin flip on a loaded machine; this arms the probe first and lets the
 *  page itself sample the frame. */
async function armNextFrameProbe(page, expr) {
  await page.evaluate((src) => {
    window.__probe = null;
    document.addEventListener('keydown', () => {
      requestAnimationFrame(() => {
        // eslint-disable-next-line no-new-func
        window.__probe = new Function('return (' + src + ')')();
      });
    }, { once: true });
  }, expr);
}
async function readProbe(page) {
  await page.waitForFunction(() => window.__probe !== null, null, { timeout: 5000 });
  return page.evaluate(() => window.__probe);
}

/** Every element this gate touches on /mempool is in the PRERENDERED HTML,
 *  so `waitForSelector` proves the markup arrived and nothing else — a click
 *  landing before hydration hits a button whose onClick does not exist yet
 *  and silently does nothing (measured: aria-expanded stayed "false"). This
 *  is not a network wait (see the networkidle note at the top); it is a wait
 *  for the control being measured to become interactive. Retry the toggle
 *  until React answers, then put the list back to closed and let its exit
 *  finish, so the measurement below starts from a genuinely closed list. */
async function hydrateSwitcher(page) {
  await page.waitForFunction(() => {
    const t = document.querySelector('.mp-switcher__trigger');
    if (!t) return false;
    if (t.getAttribute('aria-expanded') === 'true') return true;
    t.click();
    return false;
  }, null, { timeout: 20000, polling: 120 });
  await page.evaluate(() => document.querySelector('.mp-switcher__trigger').click());
  await page.waitForFunction(
    () => getComputedStyle(document.querySelector('#mp-view-list')).display === 'none',
    null, { timeout: 5000 });
}

/** Toggle the switcher and sample `display` at the exact moment React's
 *  commit lands, plus one frame later.
 *
 *  WHY A MutationObserver AND NOT A PLAIN SYNCHRONOUS READ AFTER .click():
 *  React 18 schedules even discrete-event updates on the SyncLane and flushes
 *  them from a microtask, not inside dispatchEvent — measured here: after
 *  `trigger.click()` returns, `aria-expanded` is still "false" and the class
 *  has not landed. A synchronous getComputedStyle on the next line therefore
 *  measures REACT'S SCHEDULER, not the CSS, and would report "not instant"
 *  for a perfectly correct stylesheet (and "instant" for a broken one, if
 *  the read happened to be late). A MutationObserver callback runs as a
 *  microtask right after the class attribute changes — the first observable
 *  moment the CSS could possibly have applied — so `atCommit` below is the
 *  honest answer to "did display flip at 0% or at 100%". */
const TOGGLE_PROBE = `new Promise((res) => {
  const list = document.querySelector('#mp-view-list');
  const obs = new MutationObserver(() => {
    obs.disconnect();
    const atCommit = getComputedStyle(list).display;
    const openNow = list.classList.contains('is-open');
    requestAnimationFrame(() => {
      const cs = getComputedStyle(list);
      res({ atCommit, openNow, nextFrame: cs.display, opacity: cs.opacity,
            anims: list.getAnimations().map((a) => a.transitionProperty || '?') });
    });
  });
  obs.observe(list, { attributes: true, attributeFilter: ['class'] });
  document.querySelector('.mp-switcher__trigger').click();
  setTimeout(() => { obs.disconnect(); res(null); }, 4000);
})`;

const executablePath = findChrome();
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const uaVersion = browser.version();

console.log(`verify-discrete — @starting-style + transition-behavior: allow-discrete`);
console.log(`  engine: chromium ${uaVersion}  ·  base: ${BASE}`);

/* ── 0 · the features actually exist in this engine ──────────────────────── */
{
  group('── 0 · engine support (a gate for a feature the engine lacks proves nothing) ─');
  const page = await browser.newPage();
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  const sup = await page.evaluate(() => ({
    behavior: CSS.supports('transition-behavior', 'allow-discrete'),
    // @starting-style has no CSS.supports() surface, so detect it by
    // BEHAVIOUR: a rule inside the block must win the first-frame style.
    starting: (() => {
      const s = document.createElement('style');
      s.textContent =
        '.__ss-probe{opacity:1;transition:opacity 10s linear}' +
        '@starting-style{.__ss-probe{opacity:0}}';
      document.head.appendChild(s);
      const d = document.createElement('div');
      d.className = '__ss-probe';
      document.body.appendChild(d);
      const o = parseFloat(getComputedStyle(d).opacity);
      d.remove(); s.remove();
      return o < 0.5;
    })(),
  }));
  ok(sup.behavior, '0 · engine supports transition-behavior: allow-discrete');
  ok(sup.starting, '0 · engine honours @starting-style (probe element starts at opacity 0)');
  await page.close();
}

/* ── 1 · switcher: instant open, held-open exit (motion allowed) ─────────── */
{
  group('── 1 · mempool view switcher · motion allowed ───────────────────');
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/mempool', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.mp-switcher__trigger', { timeout: 15000 });
  await hydrateSwitcher(page);

  // The declaration parsed at all. `transition-behavior` computes to one
  // entry per transitioned property, so allow-discrete appearing here proves
  // the shorthand was accepted rather than dropped whole.
  const behavior = await page.evaluate(
    () => getComputedStyle(document.querySelector('#mp-view-list')).transitionBehavior);
  ok(/allow-discrete/.test(behavior),
    `1 · #mp-view-list declares allow-discrete (transition-behavior: "${behavior}")`);

  // OPEN — the display flip must be at 0%, i.e. already flex on the commit
  // that added .is-open. Anything later is a delayed open, which is what
  // would break verify-memviews.mjs scenario 5.
  const opened = await page.evaluate(`(${TOGGLE_PROBE})`);
  ok(!!opened && opened.openNow === true, '1 · the trigger toggled .is-open on (React responded)');
  ok(opened && opened.atCommit === 'flex',
    `1 · opening is INSTANT — display is "${opened && opened.atCommit}" on the very commit that opened it (expected flex)`);
  ok(opened && opened.nextFrame === 'flex',
    `1 · …and still flex one frame later (got "${opened && opened.nextFrame}")`);
  info(`opacity one frame into the entrance: ${opened && opened.opacity}`);
  ok(opened && parseFloat(opened.opacity) < 1,
    `1 · the entrance is genuinely TWEENING — opacity ${opened && opened.opacity} one frame in, not already 1`);
  info(`transitions running on entry: [${(opened ? opened.anims : []).join(', ')}]`);
  ok(opened && opened.anims.includes('opacity'),
    '1 · an opacity transition is running on entry — @starting-style supplied a from-value');

  // The exact idiom verify-memviews.mjs:389-394 uses: open and pick a view
  // button in ONE evaluate. This is the gate that would break first if the
  // open direction ever acquired a delay, so replicate it here rather than
  // relying on a downstream gate to notice.
  const sameTask = await page.evaluate(() => {
    const list = document.querySelector('#mp-view-list');
    const btns = [...list.querySelectorAll('button')];
    return { count: btns.length, hasClassic: btns.some((b) => /classic/i.test(b.textContent || '')) };
  });
  ok(sameTask.count > 0 && sameTask.hasClassic,
    `1 · verify-memviews' same-evaluate idiom still finds view buttons (${sameTask.count}, classic present: ${sameTask.hasClassic})`);

  // CLOSE — on the commit that removes .is-open, and on the frame after,
  // display must still be flex: the box is held for the exit, not removed.
  const closing = await page.evaluate(`(${TOGGLE_PROBE})`);
  ok(!!closing && closing.openNow === false, '1 · the trigger toggled .is-open off (the class really did come off)');
  ok(closing && closing.atCommit === 'flex',
    `1 · closing is DELAYED — display is still "${closing && closing.atCommit}" on the closing commit (expected flex)`);
  ok(closing && closing.nextFrame === 'flex',
    `1 · …and still "${closing && closing.nextFrame}" one frame later — it is EXITING, not gone`);
  info(`opacity one frame into the exit: ${closing && closing.opacity}`);

  // …and it does finish. A held-open list that never closes is a worse bug
  // than no transition at all.
  let settled = true;
  try {
    await page.waitForFunction(
      () => getComputedStyle(document.querySelector('#mp-view-list')).display === 'none',
      null, { timeout: 3000 });
  } catch { settled = false; }
  ok(settled, '1 · the exit completes — display reaches none within 3s (no permanently-open list)');

  await ctx.close();
}

/* ── 2 · switcher under reduce: instant BOTH ways, content intact ────────── */
{
  group('── 2 · mempool view switcher · prefers-reduced-motion: reduce ────');
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(BASE + '/mempool', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.mp-switcher__trigger', { timeout: 15000 });
  await hydrateSwitcher(page);

  const opened = await page.evaluate(`(${TOGGLE_PROBE})`);
  ok(opened && opened.atCommit === 'flex',
    `2 · opening is still instant under reduce ("${opened && opened.atCommit}")`);
  ok(opened && parseFloat(opened.opacity) === 1,
    `2 · and fully opaque on the next frame — no fade to sit through (opacity ${opened && opened.opacity})`);
  ok(opened && opened.anims.length === 0,
    `2 · zero transitions ran on the entrance (got ${opened && opened.anims.length})`);

  const labels = await page.evaluate(() =>
    [...document.querySelectorAll('#mp-view-list button')].map((b) => (b.textContent || '').trim()).filter(Boolean));
  info(`views listed under reduce: ${labels.length}`);
  ok(labels.length > 0,
    `2 · reduced motion suppressed the ANIMATION, not the CONTENT — ${labels.length} views still listed`);

  const closing = await page.evaluate(`(${TOGGLE_PROBE})`);
  ok(closing && closing.atCommit === 'none',
    `2 · closing is instant under reduce — display is "${closing && closing.atCommit}" on the closing commit (expected none)`);
  ok(closing && closing.nextFrame === 'none',
    `2 · …and still none one frame later (got "${closing && closing.nextFrame}") — no held exit`);

  await ctx.close();
}

/* ── 3 · V6Modal exit frame ──────────────────────────────────────────────── */
{
  group('── 3 · V6Modal · the dialog outlives its close by an exit ────────');
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/future', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.panel', { timeout: 15000 });

  // Nothing opened yet: role="dialog" must not exist. This is the constraint
  // that rules out the usual "always-mounted portal, toggle a class" shape,
  // and verify-future.mjs:249 asserts it independently.
  ok((await page.locator('[role="dialog"]').count()) === 0,
    '3 · zero [role="dialog"] before anything is opened (no always-mounted portal)');

  // The stressnet band opens EcoPopup through a plain setState — no view
  // transition in the path, so the frame being measured is the CSS exit and
  // nothing else.
  await page.locator('.panel').filter({ hasText: 'superstress net' }).first().click();
  const dialog = page.locator('[role="dialog"]');
  await dialog.waitFor({ timeout: 10000 });
  ok(true, '3 · the stressnet band opens a dialog');

  const entering = await page.evaluate(() =>
    document.querySelector('.v6-modal-veil').getAnimations().map((a) => a.transitionProperty || '?'));
  info(`veil animations on entry: [${entering.join(', ')}]`);
  ok(entering.includes('opacity'),
    '3 · the veil runs an opacity transition on entry (@starting-style gave it a from-value)');

  await armNextFrameProbe(page, `({
    dialogs: document.querySelectorAll('[role="dialog"]').length,
    veils: document.querySelectorAll('.v6-modal-veil').length,
    open: document.querySelectorAll('.v6-modal-veil.is-open').length,
  })`);
  await page.keyboard.press('Escape');
  const p = await readProbe(page);
  ok(p.dialogs === 1,
    `3 · [role="dialog"] is STILL PRESENT on the frame after Escape (got ${p.dialogs}) — there is a real exit frame`);
  // Both halves, so this cannot pass vacuously: an unmounted veil satisfies
  // "not open" too, and that is exactly the regression being guarded.
  ok(p.veils === 1 && p.open === 0,
    `3 · …and that veil has already lost .is-open (veils ${p.veils}, still-open ${p.open}) — what is on screen is the EXIT, not a stuck-open dialog`);

  await dialog.waitFor({ state: 'hidden', timeout: 5000 });
  ok((await dialog.count()) === 0,
    '3 · the dialog is gone once the exit finishes (waitFor hidden → detached)');

  await ctx.close();
}

/* ── 4 · V6Modal under reduce: no exit to wait through ───────────────────── */
{
  group('── 4 · V6Modal · prefers-reduced-motion: reduce ──────────────────');
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(BASE + '/future', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.panel', { timeout: 15000 });

  await page.locator('.panel').filter({ hasText: 'superstress net' }).first().click();
  const dialog = page.locator('[role="dialog"]');
  await dialog.waitFor({ timeout: 10000 });

  const shown = await page.evaluate(() => {
    const veil = document.querySelector('.v6-modal-veil');
    const box = document.querySelector('.v6-modal');
    return {
      veilOpacity: getComputedStyle(veil).opacity,
      boxTransform: getComputedStyle(box).transform,
      anims: veil.getAnimations().length + box.getAnimations().length,
      text: (box.textContent || '').length,
    };
  });
  ok(parseFloat(shown.veilOpacity) === 1,
    `4 · the dialog is fully opaque on arrival under reduce (opacity ${shown.veilOpacity})`);
  ok(shown.boxTransform === 'none' || shown.boxTransform === 'matrix(1, 0, 0, 1, 0, 0)',
    `4 · …and at its resting position, not mid-travel (transform "${shown.boxTransform}")`);
  ok(shown.anims === 0, `4 · zero transitions ran on entry (got ${shown.anims})`);
  ok(shown.text > 200,
    `4 · content is intact — reduce removed the motion, not the dialog (${shown.text} chars)`);

  // The unmount is driven by the element's OWN measured transition-duration,
  // so `transition: none` under reduce must yield a prompt unmount rather
  // than a hardcoded wait nobody can see.
  const t0 = Date.now();
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden', timeout: 3000 });
  const dt = Date.now() - t0;
  info(`close → detached under reduce: ${dt}ms`);
  ok(dt < 1000, `4 · Escape detaches the dialog promptly under reduce (${dt}ms, no 150ms exit to sit through)`);

  await ctx.close();
}

/* ── 5 · stagger cascade · distinct delays, zero under reduce ────────────── */
{
  group('── 5 · D0661 stagger · /future protocol grid + /peers partner grid ─');

  const READ = (sel) => `[...document.querySelectorAll('${sel}')].map((el) => getComputedStyle(el).animationDelay)`;

  for (const reduce of [false, true]) {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      ...(reduce ? { reducedMotion: 'reduce' } : {}),
    });
    const page = await ctx.newPage();
    const tag = reduce ? 'reduce' : 'motion allowed';

    for (const [route, sel, label] of [
      ['/future', '.v6-proto-grid > .v6-stagger', 'protocol cards'],
      ['/peers', '.v6-peer-grid > .v6-stagger', 'partner cards'],
    ]) {
      await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector(sel, { timeout: 15000 });
      const delays = await page.evaluate(`(${READ(sel)})`);
      const distinct = [...new Set(delays)];
      info(`${route} ${label} · ${tag} · ${delays.length} cards · delays [${delays.join(', ')}]`);

      ok(delays.length >= 3, `5 · ${route} renders ${delays.length} ${label} (need ≥3 to see a cascade)`);
      if (reduce) {
        ok(distinct.length === 1 && parseFloat(distinct[0]) === 0,
          `5 · ${route} · under reduce every card reports the same ZERO delay (distinct: [${distinct.join(', ')}])`);
        const running = await page.evaluate(
          `[...document.querySelectorAll('${sel}')].reduce((n, el) => n + el.getAnimations().length, 0)`);
        ok(running === 0,
          `5 · ${route} · under reduce no animation exists on any card (got ${running}) — inert by absence, not by a zeroed delay`);
      } else {
        ok(distinct.length === delays.length,
          `5 · ${route} · every card has a DISTINCT delay — ${distinct.length} distinct across ${delays.length} cards`);
        const ms = delays.map((d) => parseFloat(d) * 1000).sort((a, b) => a - b);
        const steps = ms.slice(1).map((v, i) => v - ms[i]);
        // `[].every()` is true, so a starved card count would print a green
        // "steps sit in band" line having measured nothing. The delays.length
        // assertion above already fails the section in that case, but a
        // misleading ✅ next to a red ✗ is exactly the reporting failure this
        // suite exists to avoid. Require at least one measured step.
        const inBand = steps.length > 0 && steps.every((s) => s >= 30 && s <= 60);
        ok(inBand,
          `5 · ${route} · consecutive steps sit in the 30-60ms band (steps: [${steps.join(', ')}]ms)`);
        ok(ms[0] === 0, `5 · ${route} · the first card starts immediately (${ms[0]}ms)`);
      }
    }
    await ctx.close();
  }
}

/* ── 6 · the Firefox-ESR degradation contract (static) ───────────────────── */
{
  group('── 6 · Tor/Firefox-ESR-128 fallback · asserted from source ───────');
  const css = readFileSync(new URL('./src/styles.css', import.meta.url), 'utf8');

  // The one structural property that makes the fallback safe: `allow-discrete`
  // lives INSIDE the same `transition` shorthand as the opacity/transform
  // tweens. An engine that rejects the keyword drops that whole declaration
  // (invalid-at-parse-time applies to the declaration, not to one entry in
  // the list), so it gets no transition at all — today's instant flip in both
  // directions. Split them into two declarations and the fallback engine
  // would keep the opacity/transform half while `display` flips instantly:
  // the list would vanish on the first frame and then fade an invisible box.
  const decl = /\.mp-switcher__list\s*\{[^}]*?transition:\s*([^;]*?);/s.exec(css);
  ok(!!decl, '6 · .mp-switcher__list declares a transition shorthand');
  if (decl) {
    const body = decl[1].replace(/\s+/g, ' ');
    ok(/allow-discrete/.test(body) && /opacity/.test(body) && /transform/.test(body),
      `6 · allow-discrete shares ONE declaration with the opacity + transform tweens ("${body.trim()}")`);
  }
  ok(!/transition-behavior\s*:/.test(css),
    '6 · no standalone `transition-behavior:` longhand — that would survive independently and split the fallback');

  // @starting-style must never be the only place a visible resting value is
  // declared: an engine that skips the block would then have no value at all.
  const startBlocks = css.match(/@starting-style\s*\{/g) || [];
  info(`@starting-style blocks in styles.css: ${startBlocks.length}`);
  ok(startBlocks.length >= 2, `6 · both surfaces carry a @starting-style block (${startBlocks.length})`);
  ok(/\.mp-switcher__list\.is-open\s*\{[^}]*display:\s*flex/s.test(css),
    '6 · the OPEN state declares display:flex outside @starting-style, so a fallback engine still opens the list');
  ok(/\.v6-modal-veil\.is-open\s*\{[^}]*opacity:\s*1/s.test(css),
    '6 · the OPEN veil declares opacity:1 outside @starting-style, so a fallback engine still shows the dialog');
}

await browser.close();
console.log('\n' + (failed ? '❌ verify-discrete: FAILURES' : '✅ verify-discrete: all assertions passed'));
process.exit(failed ? 1 : 0);
