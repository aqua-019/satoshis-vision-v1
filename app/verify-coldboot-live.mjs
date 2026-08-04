#!/usr/bin/env node
/**
 * verify-coldboot-live.mjs — the cold-boot sweep's POSITIVE CONTROL.
 *
 * ── WHY THIS IS ITS OWN GATE, AND WHY IT RUNS FIRST ───────────────────────
 *
 * Eleven gates in `verify:e2e` call `assertColdBootBypassed()`, which asserts
 * that `[data-coldboot]` is ABSENT. An absence passes for three reasons and
 * cannot tell them apart from the inside: the bypass worked, the selector is
 * dead, or the splash never rendered. Only a POSITIVE control separates them.
 *
 * That control used to live as §1 of verify-coldboot.mjs, which ran LAST.
 * Measured on that chain: 27 entries, verify-coldboot at index 27, eleven
 * dependent gates — ALL of them before it, none after. In an `&&` chain a
 * failure there aborts, but by then all eleven had already run and already
 * printed green. A failing run displayed eleven passing gates that proved
 * nothing.
 *
 * The ordering axis that matters is NOT "newest last". It is what depends on
 * what:
 *   - a LOAD-BEARING PRECONDITION goes first. Its failure SHOULD abort,
 *     because everything after it is uninterpretable. Fail-fast is free here:
 *     this gate is one navigation and one count.
 *   - FEATURE ASSERTIONS go last, where a failure masks nothing. That is
 *     verify-coldboot.mjs (§2-§6, §L) — the expensive, animation-dependent,
 *     flakiest sections.
 *
 * Both properties are real; conflating them into one decision is what put the
 * precondition in the wrong place.
 *
 * This also makes the dependency STRUCTURAL rather than documented.
 * verify-lib.mjs's COLD BOOT block warns that if this control is "deleted,
 * weakened, or allowed to skip", the preconditions become decoration. Prose
 * cannot enforce that. Position can: a failure or skip here aborts before any
 * dependent runs.
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  makeReporter, launchChromium, BASE,
  coldBootOff, coldBootOffBrowser, assertColdBootBypassed,
  COLDBOOT_SEL, COLDBOOT_DECIDED_SEL, COLDBOOT_FLAG, PHONE,
} from './verify-lib.mjs';

/** This file lives at app/, so its own directory IS the app root. Derived
 *  rather than assumed from process.cwd(), because `cd` drift has produced
 *  wrong conclusions in this repo more than once. */
const APP_DIR = dirname(fileURLToPath(import.meta.url));


const R = makeReporter('verify-coldboot-live');

/* Installed BEFORE any section runs, or a skip earlier in the file would not
 * be counted by the assertion at the end. */
let _skips = 0;
const _origSkip = R.skip.bind(R);
R.skip = (label, why) => { _skips++; _origSkip(label, why); };

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
/* ── D1908 · the run must be able to see its own subject ──────────────────
 *
 * Before any assertion about the served page, prove the served page was built
 * from the commit we are claiming to test. Nothing else in this harness does:
 * verify:e2e, every gate, and serve-dist.mjs contain no rev-parse, no
 * BUILD_SHA, no mtime comparison.
 *
 * That gap produced five confident false results in one hour, from opposite
 * directions — a rebuild while serve-dist was serving (server died mid-chain,
 * every later gate reported ERR_CONNECTION_REFUSED), and a dist served from
 * ten minutes before the checkout (four RED assertions about a `phase`
 * attribute the bundle predated). No gate was wrong in either case. The
 * bytes and the SHA simply disagreed and nothing was looking.
 *
 * It runs FIRST in the FIRST gate of the chain and, on a mismatch, EXITS
 * IMMEDIATELY rather than merely recording a failure.
 *
 * That exit is load-bearing and this docblock originally lied about it. It
 * claimed a stale dist "aborts before anything measures it" — but `R.ok`
 * records a failure and returns; the rest of THIS gate carried on and printed
 * ~20 further assertions against the stale dist. Only the `&&` between gates
 * protected the chain. A reader trusting that sentence would have treated
 * exactly the assertions the guard had just declared untrustworthy as
 * evidence. Now the code does what the prose says, which is the honest way to
 * resolve prose contradicting code — the other way round leaves a reader
 * correctly expecting the safer behaviour and not getting it.
 *
 * TWO CHECKS, because the SHA alone has a hole big enough to drive the most
 * common version of this mistake through:
 *
 *   0a-1  stamp === HEAD    catches a COMMIT boundary being crossed —
 *                           committing mid-run, or checking out another rev
 *   0a-2  no source newer    catches the everyday case with NO commit at all:
 *         than the stamp     edit a tracked file, forget to rebuild, measure
 *                            the old bundle, believe the result
 *
 * `git rev-parse HEAD` does not move when you edit a tracked file, so 0a-1
 * passes green on a dirty tree — the commit is right and the bytes are not.
 * That is `built === head` being an assertion with its own unseen
 * precondition (that HEAD still describes the working tree), which is the
 * exact family this whole gate exists to close.
 *
 * 0a-2 also subsumes the no-git case: mtimes need no git, so a build stamped
 * "unknown" is still checkable for staleness rather than merely skipped.
 *
 * TWO HONEST LIMITS, stated here rather than discovered later:
 *   · it reds on a content-preserving touch (`git stash pop`, a checkout that
 *     rewrites an unchanged file). That is a CONSERVATIVE false red costing
 *     one rebuild, never a false green.
 *   · SCOPE is src/ + index.html + scripts/ — the inputs prerender and vite
 *     actually read. It says nothing about api/ or public/, and the label
 *     names that scope rather than implying coverage it does not have, which
 *     is the defect this PR has now found four times. */
R.group('── 0a · the dist under test was built from HEAD ──────────────────');
{
  const shaPath = join(APP_DIR, '.perf', 'build-sha.txt');
  const built = existsSync(shaPath) ? readFileSync(shaPath, 'utf8').trim() : null;
  let head = null;
  try {
    head = execFileSync('git', ['rev-parse', 'HEAD'],
      { cwd: APP_DIR, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { /* no git — reported below, never assumed to match */ }

  if (built === null) {
    R.ok(false, 'dist carries a build stamp (.perf/build-sha.txt)',
      'No stamp. Run `npm run build` before the chain — without it nothing ties the bytes ' +
      'being measured to the commit being claimed, which has produced false REDs and false GREENs.');
  } else if (built === 'unknown' || head === null) {
    R.skip('the dist under test was built from HEAD',
      `UNVERIFIABLE: build stamp is "${built}", git HEAD is ${head ?? 'unavailable'}. ` +
      'Counted, not passed — this check exists precisely because an unverified match is not a match.');
  } else {
    R.ok(built === head,
      `dist was built from HEAD (${head.slice(0, 8)})`,
      built === head ? '' :
        `STALE DIST: serving a build of ${built.slice(0, 8)} while HEAD is ${head.slice(0, 8)}. ` +
        'Every assertion after this one would describe a tree that is not the one under test. ' +
        'Rebuild (`npm run build`) and restart serve-dist AFTER the build, never during — ' +
        'vite clears dist/ and the running server dies on the missing index.html.');
    if (built !== head) { R.finish(); process.exit(1); }
  }

  /* 0a-2 · no source input is newer than the build stamp. Catches the case
   * 0a-1 structurally cannot: a dirty tree, where HEAD is unchanged and the
   * bytes are stale anyway. */
  if (built !== null) {
    const stampAt = statSync(shaPath).mtimeMs;
    let newest = 0, newestPath = '';
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) { walk(p); continue; }
        const m = statSync(p).mtimeMs;
        if (m > newest) { newest = m; newestPath = p.slice(APP_DIR.length + 1); }
      }
    };
    for (const root of ['src', 'scripts']) {
      const d = join(APP_DIR, root);
      if (existsSync(d)) walk(d);
    }
    const html = join(APP_DIR, 'index.html');
    if (existsSync(html)) {
      const m = statSync(html).mtimeMs;
      if (m > newest) { newest = m; newestPath = 'index.html'; }
    }
    const fresh = newest <= stampAt;
    R.ok(fresh,
      `no input under src/, scripts/ or index.html is newer than the build stamp` +
      (fresh ? ` (newest: ${newestPath}, ${Math.round((stampAt - newest) / 1000)}s before it)` : ''),
      fresh ? '' :
        `STALE DIST: ${newestPath} was modified ${Math.round((newest - stampAt) / 1000)}s AFTER the ` +
        'build. The SHA check above passed because editing a tracked file does not move HEAD — ' +
        'the commit is right and the bytes are not. Rebuild before running the chain.');
    if (!fresh) { R.finish(); process.exit(1); }
  }
}

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
  // The label used to say "expected ~12 wired + ~7 orphans" while the
  // predicate only tested the SUM — so it stated a breakdown it never
  // checked, and the breakdown was wrong (measured: 14 wired, 5 orphans).
  // A label asserting more than its predicate is the same defect as an
  // assertion whose subject is wider than its claim, pointed the other way:
  // here the claim is wider than the check. Now both halves are asserted
  // separately, so a shift BETWEEN the buckets — a wired gate silently
  // becoming an orphan — reds instead of hiding inside a stable total.
  const wiredReaching = reaching.length - orphanReaching.length;
  R.ok(wiredReaching >= 10,
    `the /-reaching detector found a plausible WIRED set (${wiredReaching} wired, ${orphanReaching.length} orphaned, need >=10 wired)`,
    wiredReaching < 10
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
/* ══ §1b · the bypass suppresses it ═════════════════════════════════════ */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await coldBootOff(ctx);
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await assertColdBootBypassed(page, R, `/ with ${COLDBOOT_FLAG}="off"`);
  await ctx.close();
}

await browser.close();

/* ── THIS GATE MUST NEVER REPORT A SKIP ──────────────────────────────────
 * A skip in the one gate eleven others depend on is the most expensive skip
 * in the suite: the four-counter discipline means it surfaces as neither a
 * pass nor a failure, so the dependents would run against an unproven
 * control while nothing anywhere went red. That is precisely the blind spot
 * the counters exist to remove, appearing in the gate that guards the rest.
 * Assert a verdict was actually produced. */
R.ok(_skips === 0,
  `this gate produced a verdict for every check — 0 skips (got ${_skips})`,
  _skips > 0
    ? `${_skips} skip(s). A skip HERE is the most expensive skip in the suite: eleven gates ` +
      `assert an absence that only this control makes meaningful, and a skip is neither a pass ` +
      `nor a failure, so they would run against an unproven control with nothing red anywhere.`
    : '');
process.exit(R.finish());
