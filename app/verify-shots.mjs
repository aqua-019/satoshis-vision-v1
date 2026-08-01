// verify-shots.mjs — v6.0.10 §7.12 · screenshot every route, both themes, three widths.
//
// Not an assertion gate: this produces the SET a human reviews. The other gates
// prove specific properties; this is what catches the things nobody thought to
// assert. Output goes to app/.shots/ (gitignored) as
//
//     .shots/<theme>/<width>/<route>.png
//
// so the same route across themes and widths sits at predictable paths and can
// be diffed or flipped through side by side.
//
//   node verify-shots.mjs                  # everything: 37 routes × 2 × 3
//   node verify-shots.mjs --width 390      # one width
//   node verify-shots.mjs --theme classic  # one theme
//   node verify-shots.mjs --route /markets # substring filter
//
// Pair with `--baseline <dir>` to diff a previous sweep — that is how §7.10's
// "classic is pixel-comparable to v5 main" check is run: sweep on main, sweep
// here, diff the classic trees, and justify every non-zero region.

import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { launch, newThemedPage, freezeAmbient, makeReporter, BASE, ROUTES, THEMES } from './verify-lib.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };

// Normalise to a trailing slash. `dir` below is built by bare concatenation
// (`${OUT}${theme}/…`), so `--out /tmp/shots` silently wrote to /tmp/shotsclassic/
// and /tmp/shotsindigo/ rather than under /tmp/shots/. Nothing errored — the run
// reported success and a later --baseline against /tmp/shots then matched zero
// files and (before the compared/unmatched split below) still printed a clean pass.
const OUT = arg('--out', new URL('./.shots/', import.meta.url).pathname).replace(/\/?$/, '/');
const BASELINE = arg('--baseline', null);
const WIDTHS = arg('--width') ? [Number(arg('--width'))] : [390, 768, 1440];
const THEME_SET = arg('--theme') ? [arg('--theme')] : THEMES;
const FILTER = arg('--route', null);

const routes = FILTER ? ROUTES.filter((r) => r.includes(FILTER)) : ROUTES;
const R = makeReporter('verify-shots');
const { browser, engine } = await launch();
console.log('engine:', engine);
console.log(`writing ${routes.length} routes × ${THEME_SET.length} themes × ${WIDTHS.length} widths → ${OUT}`);

/** "/monero/legality" → "monero-legality"; "/simulate?p=decoy" → "simulate-decoy" */
const slug = (r) => (r === '/' ? 'index' : r.replace(/^\//, '').replace(/[/?=&]+/g, '-'));

let count = 0;
let compared = 0;
const diffs = [];
const unmatched = [];

for (const theme of THEME_SET) {
  for (const width of WIDTHS) {
    const dir = `${OUT}${theme}/${width}`;
    mkdirSync(dir, { recursive: true });
    const page = await newThemedPage(browser, { width, height: width === 390 ? 844 : 900 }, theme);
    // Animation off, so a sweep is reproducible and a diff means a real change
    // rather than "the aurora had drifted 40px".
    await page.emulateMedia({ reducedMotion: 'reduce' });

    for (const route of routes) {
      await page.goto(BASE + route, { waitUntil: 'networkidle' });
      await freezeAmbient(page);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const file = `${dir}/${slug(route)}.png`;
      const png = await page.screenshot({ fullPage: true });
      writeFileSync(file, png);
      count++;

      if (BASELINE) {
        const prior = `${BASELINE.replace(/\/$/, '')}/${theme}/${width}/${slug(route)}.png`;
        if (existsSync(prior)) {
          compared++;
          const same = Buffer.compare(readFileSync(prior), png) === 0;
          if (!same) diffs.push(`${theme}/${width}${route}`);
        } else {
          // A shot with no counterpart in the baseline tree was NEVER COMPARED.
          // Counting it toward a "pixel-identical across N shots" claim is how
          // this gate lies: a theme that did not exist at the baseline commit
          // writes a full set of shots, none of which are looked at, and the
          // summary silently inflates. Track it separately and report it.
          unmatched.push(`${theme}/${width}${route}`);
        }
      }
    }
    console.log(`  ${theme}/${width} — ${routes.length} shots`);
    await page.context().close();
  }
}

console.log(`\n${count} screenshots written to ${OUT}`);

if (BASELINE) {
  R.group('── diff vs baseline ────────────────────────────────────────');

  // Say what was actually verified before saying whether it passed. `count` is
  // shots WRITTEN; `compared` is shots CHECKED. They differ whenever the
  // baseline tree predates a theme or a route, and conflating them turns
  // "111 shots nobody looked at" into part of a clean bill of health.
  R.info(`${compared} compared · ${unmatched.length} had no baseline · ${count} written`);
  R.ok(compared + unmatched.length === count,
    `every written shot is accounted for (${compared} + ${unmatched.length} = ${count})`);
  if (unmatched.length) {
    const themes = [...new Set(unmatched.map((u) => u.split('/')[0]))];
    R.info(`no baseline for: ${themes.join(', ')} — new since the baseline commit, NOT verified here`);
  }
  R.ok(compared > 0, `the baseline tree actually matched something (${compared} shots)`,
    'a baseline path typo yields zero comparisons and would otherwise report as a clean pass');

  if (diffs.length === 0) {
    R.ok(true, `pixel-identical to ${BASELINE} across ${compared} compared shots`);
  } else {
    R.info(`${diffs.length}/${compared} compared shots differ from the baseline:`);
    for (const d of diffs) R.info(`  ${d}`);
    R.info('Each difference must be deliberate and listed in the PR body (§7.10).');
    // Differing is the EXPECTED outcome for indigo; only classic is claimed to
    // be pixel-comparable, so failing the whole run here would cry wolf.
    const classicDiffs = diffs.filter((d) => d.startsWith('classic/'));
    R.ok(classicDiffs.length === 0,
      `classic is pixel-identical to the baseline (${classicDiffs.length} differing)`,
      classicDiffs.join('\n     '));
  }
  await browser.close();
  process.exit(R.finish());
}

await browser.close();
process.exit(0);
