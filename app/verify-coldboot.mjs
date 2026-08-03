#!/usr/bin/env node
/**
 * verify-coldboot.mjs — the v6.1.8 cold-boot splash on `/`.
 *
 * ── THIS GATE IS LOAD-BEARING FOR TWELVE OTHER GATES ──────────────────────
 *
 * §1 below is the ONLY positive control for the whole cold-boot sweep.
 *
 * Twelve CI-reached gates now call `assertColdBootBypassed()`, which asserts
 * that `[data-coldboot]` is ABSENT. An absence assertion passes for three
 * different reasons and cannot tell them apart from the inside:
 *
 *   (a) the bypass worked                          ← the only one we mean
 *   (b) the selector is dead (attribute renamed)   ← silent, total vacuity
 *   (c) the splash never rendered for some third
 *       reason (JS disabled, SSR, route changed)   ← see verify-nojs, which
 *                                                    had exactly this and had
 *                                                    its assertion replaced
 *
 * §1 navigates to `/` WITHOUT the bypass flag and asserts the splash IS
 * there. That single assertion is what separates (a) from (b). If it is ever
 * deleted, weakened, or allowed to R.skip, the twelve preconditions silently
 * become decoration and every one of them keeps printing green.
 *
 * CONSEQUENCE FOR ORDERING, and it is not cosmetic: `verify:e2e` is an
 * `&&`-chain, so a failure stops everything after it. This gate runs FIRST in
 * that chain, ahead of all twelve dependents. If it ran last, every dependent
 * would have already reported before its own liveness proof executed — the
 * same invocation set, but a failure you cannot read. Do not reorder it.
 *
 * ── STATUS ON THE TREE THIS WAS WRITTEN AGAINST ───────────────────────────
 * The splash did not exist when this file was authored (director-build had
 * landed nothing). §1 therefore FAILS on that tree, and that is correct and
 * intended: a gate whose subject is absent must be red, never green and never
 * skipped. A skip here would be indistinguishable from a pass to every
 * downstream reader, which is the failure this whole file argues against.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import {
  makeReporter, launchChromium, BASE,
  coldBootOff, coldBootOffBrowser, assertColdBootBypassed,
  COLDBOOT_SEL, COLDBOOT_FLAG, PHONE,
} from './verify-lib.mjs';

const R = makeReporter('verify-coldboot');

/* ══ §0 · DERIVED SWEEP AUDIT — static, runs before any browser ══════════
 *
 * The `/`-reaching set must be DERIVED, not maintained by hand. Three
 * hand-assembled lists of it produced three different answers during this
 * task; the two independently DERIVED ones agreed (12), and both disagreed
 * with the briefed 14 — `verify-contrast` visits `/live/markets` only and
 * never reaches Home, while `verify-charts` reaches it as the third element
 * of a route array, where no leading-'/' grep would find it.
 *
 * A list that must be updated by hand every time a gate adds a navigation is
 * a list that will be wrong again. This assertion makes the drift a build
 * failure instead: any WIRED gate that reaches `/` without installing the
 * bypass fails here, by name.
 *
 * Orphaned gates (wired to neither npm nor CI) are counted and INFO'd, never
 * failed — nothing runs them, so a fix there cannot be proven correct, and
 * CLAUDE.md already records 68 stale route literals in them as a knowing
 * decision. Recorded as a decision rather than an omission. */
R.group('── 0 · derived sweep audit: every /-reaching gate installs the bypass ──');
{
  const files = readdirSync('.').filter((f) => /^verify-.*\.mjs$/.test(f)).sort();

  const wiredText =
    (existsSync('package.json') ? readFileSync('package.json', 'utf8') : '') +
    (existsSync('../.github/workflows/ci.yml') ? readFileSync('../.github/workflows/ci.yml', 'utf8') : '');

  // Strip block and line comments before pattern-matching: several gates
  // legitimately NAME these idioms in their own headers (verify-memshell.mjs
  // does the same thing for the same reason), and a comment must not be read
  // as a navigation.
  // NOTE: `/*` must be preceded by line-start or whitespace to count as a
  // comment opener. Without that guard this ate live code: route globs like
  // '**/api/**' contain a literal `/*`, so the naive regex matched from
  // inside a glob string to the next `*/` and swallowed verify-origins'
  // whole launch block — the gate then vanished from the audit silently.
  const decomment = (s) => s
    .replace(/(^|\s)\/\*[\s\S]*?\*\//g, '$1')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

  const REACHES_HOME = [
    // explicit root navigation, both BASE spellings
    /goto\(\s*(?:BASE|base)\s*\+\s*['"]\/['"]/,
    // template-literal Home, including query-string forms like `${BASE}/?tier=high`
    /goto\(\s*[`]\$\{(?:BASE|base)\}\/(?:[`?#])/,
    // a route ARRAY containing '/' as an element — verify-charts' blind spot
    /\[\s*(?:[^\]]*?,\s*)?['"]\/['"]\s*(?:,[^\]]*?)?\]/,
    // canonical HOME constants
    /\b(?:R|RT|Routes)\.HOME\b/,
    // the 43-entry test surface, whose first element is '/'
    /import\s*\{[^}]*\bROUTES\b[^}]*\}\s*from\s*['"]\.\/verify-lib\.mjs['"]/,
  ];

  const reaching = [], bypassing = [], orphanReaching = [], missing = [];

  for (const f of files) {
    if (f === 'verify-coldboot.mjs' || f === 'verify-lib.mjs') continue;
    const raw = readFileSync(f, 'utf8');
    const src = decomment(raw);
    if (!REACHES_HOME.some((re) => re.test(src))) continue;
    // A source-assertion gate that never opens a browser cannot render a
    // splash, whatever route literals it holds.
    if (!/\b(?:chromium|webkit)\.launch\b|launchChromium\(|\blaunch\(\)/.test(src)) continue;

    reaching.push(f);
    const wired = wiredText.includes(f);
    const hasBypass = /coldBootOffBrowser\s*\(|coldBootOff\s*\(/.test(src);
    if (hasBypass) bypassing.push(f);
    if (!wired) { orphanReaching.push(f); continue; }
    if (!hasBypass) missing.push(f);
  }

  R.info(`gates reaching / : ${reaching.length} → ${reaching.join(', ')}`);
  R.info(`of those, installing the bypass: ${bypassing.length}`);
  R.info(`ORPHANED (wired to neither npm nor CI) — recorded, not failed: ` +
         `${orphanReaching.length}${orphanReaching.length ? ' → ' + orphanReaching.join(', ') : ''}`);

  R.ok(missing.length === 0,
    `every WIRED /-reaching gate installs the cold-boot bypass ` +
    `(${reaching.length - orphanReaching.length} wired, ${missing.length} missing)`,
    missing.length
      ? `NOT bypassing: ${missing.join(', ')} — each will measure the splash and report a ` +
        `confident number about the wrong page state.`
      : '');

  // The audit's own vacuity guard. If the detector matched nothing, the
  // assertion above passes for free — the same empty-loop failure the hero
  // gate's matched-counter exists to prevent.
  R.ok(reaching.length >= 10,
    `the /-reaching detector found a plausible set (${reaching.length}; expected ~12 wired + ~7 orphans)`,
    reaching.length < 10
      ? 'Detector matched almost nothing — its patterns have gone stale and the assertion above is vacuous.'
      : '');

  /* SELF-CHECK, and it is the stronger of the two guards. A count threshold
   * catches TOTAL detector failure but not a PARTIAL miss — 17 >= 10 passed
   * cleanly while verify-origins was silently absent from the set.
   *
   * Every gate that INSTALLS the bypass is, by the act of installing it,
   * claiming to reach `/`. So `bypassing` must be a subset of `reaching`. A
   * file that bypasses but is not detected as reaching means the detector has
   * gone stale — which is precisely the state in which the assertion above
   * passes while measuring less than it claims. */
  const undetected = [];
  for (const f of files) {
    if (f === 'verify-coldboot.mjs' || f === 'verify-lib.mjs') continue;
    const src = decomment(readFileSync(f, 'utf8'));
    if (/coldBootOffBrowser\s*\(|coldBootOff\s*\(/.test(src) && !reaching.includes(f)) undetected.push(f);
  }
  R.ok(undetected.length === 0,
    `every gate installing the bypass is also DETECTED as reaching / (${bypassing.length} detected)`,
    undetected.length
      ? `DETECTOR STALE — these install the bypass but the patterns do not see them reach /: ` +
        `${undetected.join(', ')}. The audit above is measuring a smaller set than it reports.`
      : '');
}

const { browser } = await launchChromium();

/** Fresh context WITHOUT the bypass — a real cold visitor. */
const cold = async (opts = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  return { ctx, page: await ctx.newPage() };
};

/* ══ §1 · POSITIVE CONTROL — the splash actually appears ═════════════════ */
R.group('── 1 · positive control: the bypass has something to bypass ──────');

let splashIsReal = false;
{
  const { ctx, page } = await cold();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  const n = await page.locator(COLDBOOT_SEL).count();
  splashIsReal = R.ok(
    n > 0,
    `cold visit to / renders the splash (${COLDBOOT_SEL} present, count ${n})`,
    n === 0
      ? `NO ${COLDBOOT_SEL} ANYWHERE. Either the splash is not implemented, or the attribute was ` +
        `renamed. Until this passes, the twelve assertColdBootBypassed() calls across verify-cls, ` +
        `-vitals, -charts, -govern, -motion, -discrete, -palette, -nav, -degraded, -ground and ` +
        `-origins are VACUOUS — they assert an absence that is trivially true and would stay green ` +
        `through a total regression.`
      : '',
  );
  await ctx.close();
}

/* Everything below measures the splash. If §1 failed there is no splash to
 * measure, and continuing would print a wall of green absences — the exact
 * shape of a gate that passes something it never checked. Stop instead. */
if (!splashIsReal) {
  R.info('§1 failed — skipping §2-§7 rather than reporting passes about an absent surface.');
  R.skip('§2 decrypt determinism', 'no splash rendered (§1)');
  R.skip('§3 once-per-session gating, both directions', 'no splash rendered (§1)');
  R.skip('§4 Enter handoff completes and the orb travels', 'no splash rendered (§1)');
  R.skip('§5 reduced motion resolves instantly', 'no splash rendered (§1)');
  R.skip('§6 390px', 'no splash rendered (§1)');
  await browser.close();
  process.exit(R.finish());
}

/* ══ §1b · the bypass suppresses it ═════════════════════════════════════ */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await coldBootOff(ctx);
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await assertColdBootBypassed(page, R, `/ with ${COLDBOOT_FLAG}="off"`);
  await ctx.close();
}

/* ══ §2 · DECRYPT DETERMINISM — same seed, same frames ═══════════════════ */
R.group('── 2 · decrypt is deterministic ─────────────────────────────────');
{
  const shots = [];
  for (const run of [1, 2]) {
    const { ctx, page } = await cold();
    await page.goto(BASE + '/', { waitUntil: 'load' });
    await page.waitForSelector(COLDBOOT_SEL, { timeout: 15000 });
    // Freeze at a fixed point in the sequence rather than a wall-clock one:
    // two runs on a contended runner do not reach the same frame at the same
    // millisecond, and diffing those would measure the runner, not the seed.
    await page.waitForTimeout(1200);
    shots.push(await page.locator(COLDBOOT_SEL).screenshot());
    await ctx.close();
  }
  const same = shots[0].equals(shots[1]);
  R.ok(same, 'two cold runs produce a byte-identical decrypt frame at t=1200ms',
    same ? '' : `run A ${shots[0].length} B ${shots[1].length} bytes — a seeded decrypt must not vary between runs`);
}

/* ══ §3 · ONCE-PER-SESSION, IN BOTH DIRECTIONS ══════════════════════════ */
R.group('── 3 · once-per-session gating, both directions ─────────────────');
{
  const { ctx, page } = await cold();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForSelector(COLDBOOT_SEL, { timeout: 15000 });

  // Direction 1 — reload inside the same session: console, no decrypt.
  await page.reload({ waitUntil: 'load' });
  const afterReload = await page.locator(COLDBOOT_SEL).count();
  R.ok(afterReload === 0,
    'reload within the session does NOT replay the decrypt',
    afterReload > 0 ? `${COLDBOOT_SEL} present again after reload — the session flag is not being read` : '');

  // Direction 2 — clear the flag: the decrypt RETURNS. Without this, a splash
  // that simply never rendered twice would pass direction 1 for free.
  await page.evaluate(() => sessionStorage.clear());
  await page.reload({ waitUntil: 'load' });
  const afterClear = await page.locator(COLDBOOT_SEL).count();
  R.ok(afterClear > 0,
    'clearing the session flag RESTORES the decrypt (proves direction 1 measured gating, not absence)',
    afterClear === 0 ? 'splash did not return after sessionStorage.clear() — direction 1 proved nothing' : '');
  await ctx.close();
}

/* ══ §4 · ENTER HANDOFF — completes, and the orb TRAVELS ════════════════ */
R.group('── 4 · Enter handoff completes; the orb travels, not collapses ──');
{
  const { ctx, page } = await cold();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForSelector(COLDBOOT_SEL, { timeout: 15000 });

  const orb = page.locator('[data-orb]').first();
  const before = (await orb.count()) ? await orb.boundingBox() : null;
  R.ok(before !== null, 'orb is present on the splash before handoff (prerequisite for measuring travel)');

  await page.keyboard.press('Enter');
  await page.waitForTimeout(2500);

  const gone = await page.locator(COLDBOOT_SEL).count();
  R.ok(gone === 0, 'Enter completes the handoff — splash is removed');

  if (before) {
    const after = (await orb.count()) ? await orb.boundingBox() : null;
    R.ok(after !== null, 'orb SURVIVES the handoff (it travels rather than collapsing)',
      after === null ? 'orb absent after handoff — it was destroyed and re-created, which is a collapse' : '');
    if (after) {
      const moved = Math.hypot(after.x - before.x, after.y - before.y);
      R.ok(moved > 1,
        `orb travelled across the cut (moved ${moved.toFixed(1)}px)`,
        moved <= 1 ? 'orb did not move — the two screens do not read as one place' : '');
    }
  }
  await ctx.close();
}

/* ══ §5 · REDUCED MOTION — instant resolve, no collapse, no blur ════════ */
R.group('── 5 · reduced motion ───────────────────────────────────────────');
{
  const { ctx, page } = await cold({ reducedMotion: 'reduce' });
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(600);

  const state = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const blurred = [...document.querySelectorAll('*')].filter((n) => {
      const f = getComputedStyle(n).filter;
      return f && f !== 'none' && /blur\((?!0px)/.test(f);
    }).length;
    return {
      splashPresent: !!el,
      animations: document.getAnimations().filter((a) => a.playState === 'running').length,
      blurred,
      bodyText: (document.body.innerText || '').trim().length,
    };
  }, COLDBOOT_SEL);

  R.ok(state.animations === 0, `no animation runs under reduce (got ${state.animations})`);
  R.ok(state.blurred === 0, `no element carries a non-zero blur() under reduce (got ${state.blurred})`);
  R.ok(state.bodyText > 500,
    `page is COMPLETE under reduce (${state.bodyText} chars) — reduce loses no information`);
  await ctx.close();
}

/* ══ §6 · 390px ════════════════════════════════════════════════════════ */
R.group('── 6 · 390px ────────────────────────────────────────────────────');
{
  const { ctx, page } = await cold({ viewport: { width: PHONE.width, height: PHONE.height } });
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForSelector(COLDBOOT_SEL, { timeout: 15000 });
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  R.ok(overflow <= 0, `no horizontal overflow at 390px (scrollWidth-clientWidth = ${overflow})`);
  await ctx.close();
}

await browser.close();
process.exit(R.finish());
