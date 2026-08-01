// verify-shots.mjs — v6.0.10 §7.12 · screenshot every route, every theme, three widths.
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
//   node verify-shots.mjs                  # everything: 43 routes × 3 themes × 3 widths
//   node verify-shots.mjs --width 390      # one width
//   node verify-shots.mjs --theme classic  # one theme
//   node verify-shots.mjs --route /markets # substring filter
//
// Pair with `--baseline <dir>` to diff a previous sweep — that is how §7.10's
// "classic is pixel-comparable to v5 main" check is run: sweep on main, sweep
// here, diff the classic trees, and justify every non-zero region.

import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { launch, newThemedPage, freezeAmbient, makeReporter, BASE, ROUTES, THEMES, SIM_ROUTES } from './verify-lib.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };

// Normalise to a trailing slash. `dir` below is built by bare concatenation
// (`${OUT}${theme}/…`), so `--out /tmp/shots` silently wrote to /tmp/shotsclassic/
// and /tmp/shotsindigo/ rather than under /tmp/shots/. Nothing errored — the run
// reported success and a later --baseline against /tmp/shots then matched zero
// files and (before the compared/unmatched split below) still printed a clean pass.
const OUT = arg('--out', new URL('./.shots/', import.meta.url).pathname).replace(/\/?$/, '/');
const BASELINE = arg('--baseline', null);
// Canonical full matrix — independent of any --width/--theme/--route filter
// below. This is what "the sweep" means when nobody constrained it, and it is
// the denominator Task 2's honesty check (below) measures every filtered run
// against.
const ALL_WIDTHS = [390, 768, 1440];
const themeArg = arg('--theme', null);
const widthArg = arg('--width', null);
const WIDTHS = widthArg ? [Number(widthArg)] : ALL_WIDTHS;
const THEME_SET = themeArg ? [themeArg] : THEMES;
const FILTER = arg('--route', null);

const routes = FILTER ? ROUTES.filter((r) => r.includes(FILTER)) : ROUTES;

// v6.1.3 — close the filter/denominator gap (§ prompt task 2). `count` below
// is only ever what THIS invocation wrote, so a `--theme classic` run's "N
// compared shots" silently describes a third of the real matrix with no
// indication anything was left out — the same shape of lie the compared/
// unmatched split (below) already fixed for baseline-staleness. `fullMatrix`
// is every route × every theme × every width, unfiltered; `skipped` is how
// much of it this invocation's filters excluded. Reported unconditionally
// (not just under --baseline) so a plain write-only run is equally honest
// about being a subset.
const FULL_MATRIX = ROUTES.length * THEMES.length * ALL_WIDTHS.length;
const activeFilters = [];
if (themeArg) activeFilters.push(`--theme ${themeArg}`);
if (widthArg) activeFilters.push(`--width ${widthArg}`);
if (FILTER) activeFilters.push(`--route ${FILTER}`);
const ATTEMPTED = routes.length * THEME_SET.length * WIDTHS.length;
const SKIPPED = FULL_MATRIX - ATTEMPTED;

const R = makeReporter('verify-shots');
const { browser, engine } = await launch();
console.log('engine:', engine);
console.log(`writing ${routes.length} routes × ${THEME_SET.length} themes × ${WIDTHS.length} widths → ${OUT}`);
if (SKIPPED > 0) {
  console.log(`  FILTERED RUN (${activeFilters.join(', ')}): ${SKIPPED} of ${FULL_MATRIX} full-matrix shots ` +
    `will NOT be taken this run — this is a subset, not a sweep.`);
}

/** "/monero/legality" → "monero-legality"; "/simulate?p=decoy" → "simulate-decoy" */
const slug = (r) => (r === '/' ? 'index' : r.replace(/^\//, '').replace(/[/?=&]+/g, '-'));

// Pages under src/protocols/** (the /simulate?p=* routes) are the app's
// SANCTIONED Math.random() surface — CLAUDE.md: "Math.random() only inside
// app/src/protocols/". Several of them (confirmed by measurement below: decoy,
// dandelion, hearth, ringct, viewtags at minimum) seed their decorative content
// from it with no fixed seed, so two sweeps of the identical build legitimately
// render different pixels there. That is not an instability this gate can fix
// — it is the feature working as designed, same category as the indigo theme
// already being excluded from the hard pixel-identical assertion below. A
// seeded PRNG for src/protocols/** would close this (tracked separately); until
// then, sim-route diffs are reported, never failed.
const SIM_SET = new Set(SIM_ROUTES);

const FIXED_CLOCK = '2026-01-01T00:00:00Z';

let count = 0;
let compared = 0;
const diffs = [];
const unmatched = [];
const failed = [];

for (const theme of THEME_SET) {
  for (const width of WIDTHS) {
    const dir = `${OUT}${theme}/${width}`;
    mkdirSync(dir, { recursive: true });
    const page = await newThemedPage(browser, { width, height: width === 390 ? 844 : 900 }, theme);
    // Animation off, so a sweep is reproducible and a diff means a real change
    // rather than "the aurora had drifted 40px".
    await page.emulateMedia({ reducedMotion: 'reduce' });

    // v6.1.3 — REWRITTEN. The previous version of this comment blamed
    // design/ArtBackground.tsx's ParticleField (~120 Math.random() particles)
    // for two-sweeps-of-the-same-build byte diffs at any width above `low`.
    // That diagnosis was never correct and was disprovable from the source
    // that sat one line above it: `page.emulateMedia({ reducedMotion: 'reduce'
    // })` runs before every goto below, and design/deviceTier.ts:121
    // (`computeTier`) checks `prefersReducedMotion() || prefersSaveData()`
    // BEFORE any hardware/viewport scoring and returns `'low'` unconditionally
    // when it's true — so under this gate's emulation the device tier is
    // `low` at EVERY width, 390 and 1440 alike, and ArtBackground.tsx:40
    // never mounts ParticleField at all. There is no canvas in any of these
    // screenshots. (git blame confirms the ordering too: the emulateMedia
    // call landed in bd8d5c2, the ParticleField comment in 0344b3d, a day
    // later — the emulation was already in place when the diff being
    // explained was measured.)
    //
    // The REAL, PROVEN cause, isolated empirically (build origin/main
    // unmodified, sweep twice, pixel-diff the differing pair):
    // layout/Footer.tsx renders on every route via the shared shell and does
    //
    //     const t = new Date();
    //     ...
    //     <span>UTC {t.toISOString().slice(11, 19)}</span>
    //
    // with no memoisation, no freeze, and no gate on reduced motion — a live
    // wall-clock reading, taken fresh on every render, of whatever second the
    // browser happened to be at. Two sweeps of an identical build run even a
    // couple of seconds apart show different digits there. Reproduced and
    // isolated by pixel-diffing two /sources·1440·classic captures taken 2.5s
    // apart with matching HTML (byte-identical DOM, `htmlLen` 28219 both):
    // 84 differing pixels, bounding box x:[1191,1204] y:[882,890] — exactly
    // `document.elementFromPoint(1197, 886)` resolves to
    // `<span class="footer-tele">UTC …</span>`. Magnitude matches the
    // originally-cited example almost exactly (135366 vs 135439 B there;
    // 135272 vs 135372 B in this reproduction) and the mechanism is universal
    // — every route carries a Footer, so this affects all of them, not just
    // /sources, and not just 1440.
    //
    // FIX (below, applied here — no app/src change needed): Playwright's
    // Clock API freezes `Date`/`Date.now()` in the page without touching
    // `setTimeout`/`setInterval`, so the app's tiered polling keeps running
    // real-time while every `new Date()` read (the footer clock, any other
    // "as of now" render) resolves to the same instant across the whole
    // sweep. `page.clock.setFixedTime(FIXED_CLOCK)` is called once per page,
    // right after `emulateMedia`, and — like `emulateMedia` — persists across
    // every `page.goto()` in the loop below (verified: three sequential
    // navigations on one page all read the same frozen UTC string).
    // Confirmed fix: with the clock frozen, two /sources·1440·classic
    // captures taken 2.5s apart are `cmp`-identical, byte for byte.
    //
    // What's LEFT after that fix (measured on a real two-sweep run of this
    // build, 37 routes × 3 widths × classic — see the compared/unmatched/
    // failed accounting below for the live numbers): every non-simulate route
    // is now byte-identical between sweeps. The only shots that still differ
    // are `/simulate?p=*` ones, and only some of those — decoy, dandelion,
    // hearth, ringct and viewtags were the ones measured differing, which
    // lines up with those being the simulators whose src/protocols/** module
    // seeds visible state from unseeded Math.random() on mount. That is the
    // sanctioned randomness this repo allows outside verify-shots.mjs's
    // control (see SIM_SET above) and this gate does not fail on it.
    //
    // ALSO FOUND, NOT FIXED HERE (app/src, reported to the orchestrator —
    // see this task's final report): `/simulate?p=viewtags` specifically has
    // a genuine layout bug independent of all of the above. Its ScannerWall
    // component (src/protocols/view-tags.tsx) renders a
    // `display:grid; gridTemplateColumns: repeat(16, 1fr)` of 256
    // `aspectRatio:"1"` cells per pane, two panes per view. At 390 and 768px
    // viewport width (NOT at 1440 — measured `document.documentElement
    // .scrollHeight` there is a normal 900px) the grid resolves to a SINGLE
    // ~708px-wide column instead of 16 (confirmed via getComputedStyle:
    // `gridTemplateColumns` returns one track, not sixteen), so each
    // `aspectRatio:1` cell is forced to ~708×708px and 256 of them stack
    // into one column — measured document height 175,397px at 390 and
    // 366,156px at 768. `page.screenshot({ fullPage: true })` on a page that
    // tall is slow and FLAKY: one full sweep saw it complete in ~40s, the
    // next timed out past 60s. Separately, ViewTagsView calls
    // `useAnimationSeconds({ fps: 20 })` (design/useAnimationClock.ts)
    // without `enabled: !reduced` — design/useReducedMotion.ts's own header
    // note says every call site must pass that, and its sibling
    // mempool/constellation.tsx:68 does; view-tags.tsx does not, so this view
    // keeps animating under `prefers-reduced-motion: reduce`. Confirmed this
    // is NOT the layout bug's cause (reproduced the same runaway height with
    // `window.requestAnimationFrame` neutralised entirely) but it is a real,
    // separate violation of the app's own motion policy and a second reason
    // this route's pixels are never stable. Both are inside app/src/protocols
    // — out of this gate's ownership; the try/catch and generous timeout
    // below exist only so ONE broken route can't take the whole sweep down
    // with it, and `failed` is reported honestly rather than swallowed.
    await page.clock.setFixedTime(FIXED_CLOCK);

    for (const route of routes) {
      try {
        await page.goto(BASE + route, { waitUntil: 'networkidle' });
        await freezeAmbient(page);
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        const file = `${dir}/${slug(route)}.png`;
        // 60s, not the 30s default: /simulate?p=viewtags's runaway-height bug
        // (see comment above) makes a full-page capture there genuinely slow
        // rather than hung, and a human reviewing the SET this gate produces
        // is better served seeing that route's broken layout than seeing
        // nothing. Still bounded — a real hang must not stall the sweep
        // forever.
        const png = await page.screenshot({ fullPage: true, timeout: 60000 });
        writeFileSync(file, png);
        count++;

        if (BASELINE) {
          const prior = `${BASELINE.replace(/\/$/, '')}/${theme}/${width}/${slug(route)}.png`;
          if (existsSync(prior)) {
            compared++;
            const same = Buffer.compare(readFileSync(prior), png) === 0;
            if (!same) diffs.push({ theme, width, route, key: `${theme}/${width}${route}` });
          } else {
            // A shot with no counterpart in the baseline tree was NEVER COMPARED.
            // Counting it toward a "pixel-identical across N shots" claim is how
            // this gate lies: a theme that did not exist at the baseline commit
            // writes a full set of shots, none of which are looked at, and the
            // summary silently inflates. Track it separately and report it.
            unmatched.push({ theme, width, route, key: `${theme}/${width}${route}` });
          }
        }
      } catch (e) {
        // A route that fails to capture must not take the rest of the sweep
        // down with it via an uncaught exception — see /simulate?p=viewtags
        // above. Reported honestly (folded into the fullMatrix accounting
        // below), never silently dropped.
        failed.push({ theme, width, route, key: `${theme}/${width}${route}` });
        console.log(`    ❌ FAILED ${theme}/${width}${route}: ${String(e.message || e).split('\n')[0]}`);
      }
    }
    console.log(`  ${theme}/${width} — ${routes.length} shots`);
    await page.context().close();
  }
}

console.log(`\n${count} screenshots written to ${OUT}` + (failed.length ? ` · ${failed.length} failed` : ''));

if (BASELINE) {
  R.group('── diff vs baseline ────────────────────────────────────────');

  // Say what was actually verified before saying whether it passed. `count` is
  // shots WRITTEN; `compared` is shots CHECKED. They differ whenever the
  // baseline tree predates a theme or a route, and conflating them turns
  // "111 shots nobody looked at" into part of a clean bill of health.
  R.info(`${compared} compared · ${unmatched.length} had no baseline · ${failed.length} failed to capture · ${count} written`);
  if (SKIPPED > 0) {
    R.info(`${SKIPPED} of ${FULL_MATRIX} full-matrix shots were SKIPPED by ${activeFilters.join(', ')} — ` +
      `not taken, not verified, not counted below.`);
  }
  // The full accounting: every cell of the unfiltered route×theme×width
  // matrix is either compared, unmatched-against-baseline, failed to
  // capture, or skipped by an active filter. Nothing falls through a gap.
  R.ok(compared + unmatched.length + failed.length + SKIPPED === FULL_MATRIX,
    `every full-matrix shot is accounted for ` +
    `(${compared} compared + ${unmatched.length} unmatched + ${failed.length} failed + ${SKIPPED} skipped = ${FULL_MATRIX})`);
  if (unmatched.length) {
    const themes = [...new Set(unmatched.map((u) => u.theme))];
    R.info(`no baseline for: ${themes.join(', ')} — new since the baseline commit, NOT verified here`);
  }
  if (failed.length) {
    R.info(`failed to capture (see ❌ lines above, not a pixel comparison at all): ${failed.map((f) => f.key).join(', ')}`);
  }
  R.ok(compared > 0, `the baseline tree actually matched something (${compared} shots)`,
    'a baseline path typo yields zero comparisons and would otherwise report as a clean pass');

  const subsetNote = SKIPPED > 0
    ? ` — SUBSET ONLY (${activeFilters.join(', ')}); ${SKIPPED} of ${FULL_MATRIX} full-matrix shots were not taken this run`
    : '';

  if (diffs.length === 0) {
    R.ok(true, `pixel-identical to ${BASELINE} across ${compared} compared shots${subsetNote}`);
  } else {
    R.info(`${diffs.length}/${compared} compared shots differ from the baseline:`);
    for (const d of diffs) R.info(`  ${d.key}`);
    R.info('Each difference must be deliberate and listed in the PR body (§7.10).');
    // Differing is the EXPECTED outcome for indigo and phosphor; only classic
    // is claimed to be pixel-comparable, so failing the whole run here would
    // cry wolf.
    const classicDiffs = diffs.filter((d) => d.theme === 'classic');
    // v6.1.3: simulate routes are ALSO expected to differ — see SIM_SET above
    // — for reasons this gate cannot fix (unseeded Math.random() inside
    // src/protocols/**, sanctioned by CLAUDE.md). Only a non-simulate classic
    // diff is a real regression; a simulate one is reported, not failed.
    const classicSimDiffs = classicDiffs.filter((d) => SIM_SET.has(d.route));
    const classicRealDiffs = classicDiffs.filter((d) => !SIM_SET.has(d.route));
    if (classicSimDiffs.length) {
      R.info(`${classicSimDiffs.length} classic diff(s) are /simulate routes — expected (unseeded Math.random() in src/protocols/**), not failed:`);
      for (const d of classicSimDiffs) R.info(`    ${d.key}`);
    }
    R.ok(classicRealDiffs.length === 0,
      `classic is pixel-identical to the baseline outside /simulate (${classicRealDiffs.length} differing)${subsetNote}`,
      classicRealDiffs.map((d) => d.key).join('\n     '));
  }
  await browser.close();
  process.exit(R.finish());
}

await browser.close();
process.exit(0);
