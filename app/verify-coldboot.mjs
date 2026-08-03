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
  COLDBOOT_SEL, COLDBOOT_DECIDED_SEL, COLDBOOT_FLAG, PHONE,
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

/* ══ §L · MAIN HOME LEGIBILITY — computed style, reported not resolved ═══
 *
 * Runs BEFORE §1 and independent of it: Main Home exists whether or not the
 * splash does, so gating this behind the splash would lose the measurement
 * on exactly the trees where Home is all there is.
 *
 * ── THE RULING THIS ENCODES ──────────────────────────────────────────────
 * §5 asks for "no text under 12px, or the --fs-label token resolved at
 * runtime — standing conflict REPORTED, not resolved". The token resolves to
 * 11px here (`clamp(11px, .74vw, 12px)`), measured, not read off the
 * declaration.
 *
 * Four families on Home compute below that and are EXEMPT as inherited shared
 * chrome — each is a shared primitive's own class governing many surfaces, so
 * changing it is a site-wide type decision and its own task. Forcing a local
 * override for Home alone would fragment the scale (some Stats at 10.5, one
 * at 11–12), which is worse than the honest conflict.
 *
 * Three of the four are LITERALLY in the standing conflict CLAUDE.md already
 * records — "19 sub-12px font-size declarations in styles-legibility.css
 * (L63-66, 71, 73-75, 77-78, 81, 84, 93-95, 98-100, 102)": L75 `.stat .lbl`,
 * L78 `.pill`, L95 `button.proto-btn`. They are not new findings and this PR
 * is not where verify-legibility.mjs:124-127's deliberate 11px floor gets
 * relitigated.
 *
 * ── THE VACUITY GUARD, and it is the whole risk here ─────────────────────
 * If every sub-12px leaf on Home is exempt, the assertion runs over an EMPTY
 * SET and passes for free — an exemption list can silently swallow its own
 * subject. So the gate counts what it actually examined and fails if that
 * number is implausible. Numbers are printed, never just a verdict. */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await coldBootOff(ctx);
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const EXEMPT = [
    ['.stat .lbl',        'styles-legibility.css:75 · <Stat> primitive · 23 files'],
    ['.pill',             'styles-legibility.css:78 · shared pill · 16 files'],
    // `button.proto-btn, a.proto-btn` — BOTH variants. An earlier draft of this
    // exemption said `button.proto-btn` only and therefore did not match Home's
    // two anchor CTAs: the IDENTICAL selector-reach gap this section had just
    // found in styles-legibility.css:95, reproduced in the gate that found it.
    // A selector is a claim about which elements it reaches, and that claim is
    // only checkable by measuring rendered elements — never by reading it.
    ['button.proto-btn, a.proto-btn', 'styles-legibility.css:95 · shared button · 18 files (17 button, 2 anchor)'],
    ['.prov-tag, .prov-fresh', 'design/provenance.tsx · the NODE/COINGECKO/... vocabulary'],
    ['.crumbs, .crumbs *',     'styles-legibility.css:63 · breadcrumb chrome · AppShell-wide'],
  ];

  /* `.crumbs *` and not just `.crumbs`: the leaf that computes 11.5px is the
   * <b> root label INSIDE nav.crumbs (chain b > li > ol > nav.crumbs), which
   * INHERITS the size rather than declaring it. Exempting only the container
   * would leave the leaf asserted and the family half-covered — the same
   * selector-reach gap as `button.proto-btn` missing `a.proto-btn`, which is
   * the bug this section just found. Verified by ancestor measurement
   * (closest('.crumbs') === true), not inferred from the class name. */

  const m = await page.evaluate((exemptSels) => {
    const probeEl = document.createElement('span');
    probeEl.style.fontSize = 'var(--fs-label)';
    document.body.appendChild(probeEl);
    const tokenPx = parseFloat(getComputedStyle(probeEl).fontSize);
    probeEl.remove();

    const exemptNodes = new Set();
    for (const sel of exemptSels) {
      for (const el of document.querySelectorAll(sel)) exemptNodes.add(el);
    }

    const exempt = {}, offenders = [];
    let examined = 0;
    for (const el of document.querySelectorAll('main *')) {
      if (el.children.length || !(el.textContent || '').trim()) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (exemptNodes.has(el)) {
        const k = fs.toFixed(2);
        (exempt[k] ||= { n: 0, eg: new Set() });
        exempt[k].n++; exempt[k].eg.add(el.className || el.tagName);
        continue;
      }
      examined++;
      if (fs < 12 && Math.abs(fs - tokenPx) > 0.01) {
        offenders.push({ fs: fs.toFixed(2), cls: el.className || el.tagName,
                         txt: (el.textContent || '').trim().slice(0, 30) });
      }
    }
    return {
      tokenPx, examined, offenders,
      exempt: Object.fromEntries(Object.entries(exempt)
        .map(([k, v]) => [k, { n: v.n, eg: [...v.eg].slice(0, 3) }])),
    };
  }, EXEMPT.map(([sel]) => sel));

  R.group('── L · Main Home legibility (standing conflict: reported, not resolved) ──');
  R.info(`--fs-label resolves to ${m.tokenPx}px at 1440 (declared clamp(11px,.74vw,12px))`);

  for (const [sel, why] of EXEMPT) R.info(`EXEMPT ${sel} — ${why}`);
  for (const [px, v] of Object.entries(m.exempt).sort((a, b) => a[0] - b[0])) {
    R.info(`EXEMPT measured ${px}px × ${v.n} — ${JSON.stringify(v.eg)}  ← STANDING CONFLICT, not resolved here`);
  }

  /* VACUITY GUARD — the exemption list must not have eaten the subject. */
  R.ok(m.examined >= 20,
    `panel-own leaves actually examined: ${m.examined} (need ≥20, else the exemption list swallowed the subject)`,
    m.examined < 20
      ? `Only ${m.examined} non-exempt text leaves. The assertion below would pass over a near-empty ` +
        `set — an exemption list silently consuming what it was meant to carve out of.`
      : '');

  R.ok(m.offenders.length === 0,
    `every panel-own leaf is ≥12px or exactly the --fs-label token (${m.tokenPx}px) — ` +
    `${m.examined} examined, ${m.offenders.length} below`,
    m.offenders.length
      ? m.offenders.map((o) => `${o.fs}px · ${o.cls} · "${o.txt}"`).join('\n     ')
      : '');

  await ctx.close();
}

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
  /* BOUNDED WAIT before sampling. ColdBoot is React.lazy: at `load` the chunk
   * has not resolved, `locator().count()` does not auto-wait, and §1 reported
   * a confident HAZARD against an app that was correct. A false FAIL is the
   * expensive direction — its message names a diagnosis and sends someone
   * hunting a bug that does not exist. Both polarities survive: a genuine
   * absence still reads 0 after the bound and the discriminator runs
   * unchanged. */
  await page.waitForSelector(COLDBOOT_SEL, { timeout: 10_000 }).catch(() => {});
  const n = await page.locator(COLDBOOT_SEL).count();

  /* DISTINGUISH THE TWO CAUSES rather than asserting the worse one.
   *
   *   UNBUILT   nothing cold-boot rendered at all — brief D's ColdBoot.tsx is
   *             not landed. The thirteen preconditions are then correctly
   *             asserting an absence that is GENUINELY TRUE. Blocked on an
   *             unbuilt dependency, not a defect in the sweep.
   *   HAZARD    cold-boot markup IS on the page but the root marker is not.
   *             THIS is the vacuity this gate exists for: the splash renders,
   *             the sweep cannot see it, and thirteen gates measure an overlay
   *             while printing green.
   *
   * The console's own mount signal is the discriminator — a SEPARATE frozen
   * attribute (console-scoped, for the leaf-size probe), never a rename of the
   * root marker. Two attributes, two jobs. */
  /* Sampled AFTER the same wait as `n` above. Sampling them at different
   * instants is what let HAZARD fire on a correct app: the console's chunk
   * can resolve a frame before the root's, so a stale pair reads
   * root=0/console=1 and indicts the wrong thing. */
  const consoleMounted = await page.locator('[data-coldboot-console]').count();

  splashIsReal = R.ok(
    n > 0,
    `cold visit to / renders the splash (${COLDBOOT_SEL} present, count ${n})`,
    n > 0 ? ''
    : consoleMounted > 0
      ? `HAZARD — the cold-boot console IS mounted ([data-coldboot-console] x${consoleMounted}) but the ` +
        `splash ROOT carries no ${COLDBOOT_SEL}. The splash renders and the sweep is blind to it: all ` +
        `thirteen assertColdBootBypassed() calls would pass while measuring an overlay. Put ` +
        `${COLDBOOT_SEL} on the outermost splash element, spanning decrypt AND console phases.`
      : `UNBUILT DEPENDENCY — no cold-boot markup on the page at all (brief D's ColdBoot.tsx not ` +
        `landed). This is the expected state before that lands, NOT a defect in the sweep: the ` +
        `thirteen preconditions are correctly asserting an absence that is genuinely true. This ` +
        `assertion stays RED until the splash exists — a gate that went green on a tree without ` +
        `the feature would be the vacuity we are guarding against, one level up.`,
  );

  /* The sweep's LIVENESS is a distinct fact from §1's verdict, so it gets its
   * own counter instead of being folded into the failure above. */
  if (!splashIsReal && consoleMounted === 0) {
    R.skip('the 13 cold-boot preconditions are LIVE (assert something falsifiable)',
      'blocked on an unbuilt dependency — ColdBoot.tsx (brief D) has not landed. They go live ' +
      'automatically the moment the splash root carries the marker; no gate edit is required, ' +
      'because the literal is declared once in verify-lib.mjs.');
  }
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

  /* PRECONDITION for every negative assertion below. Waiting on COLDBOOT_SEL
   * would be exactly wrong here: correct behaviour IS its absence. Wait for
   * the DECISION instead. */
  const decided = async (what) => {
    const ok = await page.waitForSelector(COLDBOOT_DECIDED_SEL, { timeout: 15_000 })
      .then(() => true).catch(() => false);
    return R.ok(ok,
      `${what}: ColdBoot published its decision (${COLDBOOT_DECIDED_SEL}) before we sampled`,
      ok ? '' : `No decision marker after 15s. Without it a count of 0 below cannot tell ` +
                `"absent because the flag was honoured" from "absent because the lazy chunk ` +
                `had not resolved" — the assertion would pass vacuously on a §5 criterion.`);
  };

  /* ── §3 CANNOT BE ASSERTED YET, AND SAYING SO IS THE ONLY HONEST OPTION ──
   *
   * §5 asks: "reload lands on the CONSOLE with NO DECRYPT". An earlier draft
   * of this section asserted `[data-coldboot]` count === 0 after reload. That
   * was semantically WRONG, not merely early: the console renders INSIDE the
   * splash root (measured chain: SECTION[data-coldboot-console] > DIV >
   * DIV[data-coldboot]), so the root is legitimately present in BOTH states.
   * The assertion demanded the splash disappear when the spec says only the
   * decrypt is skipped.
   *
   * MEASURED, three phases, one run:
   *   t=mount             {root:"", console:"ready"}
   *   t=decrypt resolved  {root:"", console:"ready"}
   *   t=after reload      {root:"", console:"ready"}
   *
   * `data-coldboot` carries an EMPTY value throughout, so replayed-decrypt and
   * skipped-decrypt are DOM-identical. No selector can tell them apart, which
   * means no assertion here can distinguish pass from fail — and one that
   * printed green would be asserting nothing on a headline §5 criterion.
   *
   * What IS established, and is asserted below: the session flag really is
   * written, on decrypt RESOLVE (ColdBoot.tsx:399-402 / :436-439 —
   * `resolvedRef` at t>=1), not on mount and not on Enter. A gate that
   * reloaded before resolve saw no flag and concluded the gating was broken;
   * the gating was fine and the gate was early.
   *
   * NEEDED (contract): a phase VALUE on the root — `data-coldboot="decrypt"`
   * vs `"console"` — or any marker present only while the decrypt runs. One
   * attribute value turns this from unassertable into two-polarity testable. */
  const KEY = 'xmrirish.coldboot';
  const flagWritten = await page
    .waitForFunction((k) => { try { return sessionStorage.getItem(k) === '1'; } catch { return false; } },
      KEY, { timeout: 20_000 })
    .then(() => true).catch(() => false);
  R.ok(flagWritten,
    `the session flag ${KEY} is written once the decrypt resolves`,
    flagWritten ? '' : 'Flag never appeared within 20s — nothing downstream could gate on it.');

  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector(COLDBOOT_DECIDED_SEL, { timeout: 15_000 }).catch(() => {});
  const consoleAfter = await page.locator('[data-coldboot-console]').count();
  R.ok(consoleAfter > 0,
    'reload within the session lands on the CONSOLE',
    consoleAfter === 0 ? 'no console after reload — the session reload path is broken' : '');

  R.skip('reload does NOT replay the DECRYPT (and clearing the flag restores it)',
    'NOT MACHINE-CHECKABLE on this markup: data-coldboot carries an empty value in every ' +
    'phase, so replayed-decrypt and skipped-decrypt are DOM-identical. Needs a phase value ' +
    'on the root (data-coldboot="decrypt"|"console"). Skipped rather than asserted, because ' +
    'an assertion that cannot fail is not evidence for a §5 criterion.');
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

  /* Negative assertion — same rule as §3. Post-interaction so the chunk has
   * long resolved, but the marker makes that structural rather than lucky. */
  await page.waitForSelector(COLDBOOT_DECIDED_SEL, { timeout: 10_000 }).catch(() => {});
  const gone = await page.locator(COLDBOOT_SEL).count();
  R.ok(gone === 0, 'Enter completes the handoff — splash is removed',
    gone > 0 ? `${COLDBOOT_SEL} still present ${gone}x after Enter` : '');

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
