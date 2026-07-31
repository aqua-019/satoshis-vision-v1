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

const OUT = arg('--out', new URL('./.shots/', import.meta.url).pathname);
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
const diffs = [];

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
          const same = Buffer.compare(readFileSync(prior), png) === 0;
          if (!same) diffs.push(`${theme}/${width}${route}`);
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
  if (diffs.length === 0) {
    R.ok(true, `pixel-identical to ${BASELINE} across ${count} shots`);
  } else {
    R.info(`${diffs.length}/${count} shots differ from the baseline:`);
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
