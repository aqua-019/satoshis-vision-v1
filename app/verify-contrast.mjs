// verify-contrast.mjs — v6.0.10 §6a/§7.9 · re-verify contrast on the lifted ground.
//
// §6a raises the indigo floor from oklch(0.13) to oklch(0.18). Every contrast
// number the v6.0.2 ink ramp was tuned against ("100 → 15.9:1 · 80 → 11:1 ·
// 60 → 6.5:1 (body floor)") was computed against the OLD, darker surface, so
// raising the ground silently erodes all of them. This gate recomputes them
// against whatever the surface actually is now, so the claim in the stylesheet
// comment can never drift from the stylesheet.
//
// Colours are read from the live page (getComputedStyle resolves oklch() to the
// engine's actual sRGB output) rather than parsed out of CSS, so the numbers are
// the ones a user's eye receives.

import { launch, newThemedPage, makeReporter, BASE } from './verify-lib.mjs';

const R = makeReporter('verify-contrast');
const { browser, engine } = await launch();
console.log('engine:', engine);

/** WCAG 2.1 relative luminance + contrast ratio, computed in-page so we can
 *  hand it resolved `rgb()` strings straight from getComputedStyle. */
const MEASURE = () => {
  // Resolve ANY css colour to real sRGB bytes by painting it on a 1×1 canvas.
  //
  // Do NOT regex getComputedStyle().color: Chromium serialises `color:
  // oklch(0.22 0.016 290)` back as the literal `oklch(...)` string, so a naive
  // /[\d.]+/ parse reads it as rgb(0, 0, 290) and every ratio computed from it
  // is fiction. (Ask me how I know.) Canvas does the colour-space conversion.
  const cv = document.createElement('canvas');
  cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const parse = (c) => {
    cx.globalCompositeOperation = 'copy';  // replace, so alpha survives
    cx.fillStyle = '#000';
    cx.fillStyle = c;                      // invalid values leave the previous
    cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  };
  const lum = ([r, g, b]) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const over = (fg, bg) => {
    // flatten a translucent ink onto its ground before measuring — several
    // --ink-* steps are rgba(), and measuring them un-composited overstates them
    const a = fg[3];
    return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a));
  };
  const ratio = (fg, bg) => {
    const l1 = lum(over(fg, bg)), l2 = lum(bg);
    const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
    return (hi + 0.05) / (lo + 0.05);
  };

  // Resolve tokens by painting them on a probe element — reading the custom
  // property directly returns the unresolved token stream (e.g. "oklch(...)").
  const probe = document.createElement('span');
  probe.style.position = 'absolute';
  probe.style.opacity = '0';
  document.body.appendChild(probe);
  const resolve = (token) => {
    probe.style.color = '';
    probe.style.color = `var(${token})`;
    return parse(getComputedStyle(probe).color);
  };

  const ground = resolve('--surface-ground');
  const out = { ground: `rgb(${ground.slice(0, 3).map(Math.round).join(', ')})`, pairs: [] };

  for (const [name, min] of [
    ['--ink-100', 7], ['--ink-80', 7], ['--ink-60', 7],
    ['--g-50', 4.5], ['--y-50', 4.5], ['--r-50', 4.5], ['--p-50', 4.5],
    ['--tk-accent', 4.5], ['--ui-accent-text', 4.5],
  ]) {
    const fg = resolve(name);
    out.pairs.push({
      name, min,
      rgb: fg ? `rgb(${fg.slice(0, 3).map(Math.round).join(',')})${fg[3] < 1 ? ` a${fg[3].toFixed(2)}` : ''}` : '?',
      ratio: fg && ground ? +ratio(fg, ground).toFixed(2) : null,
    });
  }
  probe.remove();
  return out;
};

// Classic is v5's ink ramp, unchanged, and §6b requires it to stay that way —
// "classic should be pixel-comparable to v5 main". Its --ink-80/-60 are 5.8:1
// and 3.0:1 and always have been; raising them would be exactly the kind of
// leaked v6 rule the pixel-diff exists to catch. So classic is asserted against
// its OWN v5 baseline (no regression) and reported, while the ≥7:1 body-text bar
// from §6a is enforced on indigo, which is the theme §6a actually moves.
const CLASSIC_BASELINE = {
  '--ink-100': 7.7, '--ink-80': 5.79, '--ink-60': 3.0,
  '--g-50': 11.42, '--y-50': 13.9, '--r-50': 6.19, '--p-50': 6.89,
  '--tk-accent': 7.63, '--ui-accent-text': 7.63,
};

// v6.1.2: phosphor joins, and is held to the same absolute AA floors as indigo.
// Only classic gets the no-regression baseline treatment, because only classic
// makes the "unchanged since v5" claim.
//
// Navigation waits below are `domcontentloaded` + an explicit selector, not
// `networkidle` (prompt 02 did the same to verify-future.mjs). The app's FAST
// polling tier fires every 3s, so the network is never idle for long: idle
// either races or waits out the full timeout. Wait for what is being measured.
for (const theme of ['indigo', 'classic', 'phosphor']) {
  R.group(`── ${theme} · ink and status colours on --surface-ground ────`);
  const page = await newThemedPage(browser, { width: 1440, height: 900 }, theme);
  await page.goto(BASE + '/live/markets', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.panel', { timeout: 15000 });
  const m = await page.evaluate(MEASURE);
  R.info(`ground = ${m.ground}`);

  for (const p of m.pairs) {
    if (p.ratio == null) { R.ok(false, `${p.name} resolves`); continue; }
    if (theme === 'classic') {
      const base = CLASSIC_BASELINE[p.name];
      R.ok(p.ratio >= base - 0.05,
        `${p.name.padEnd(18)} ${String(p.ratio).padStart(6)}:1  (v5 baseline ${base}:1, must not regress)  ${p.rgb}`);
      continue;
    }
    // --ink-60 is the documented BODY FLOOR and carries the stricter bar; the
    // status colours are large/bold data accents, so 4.5:1 is the right target.
    R.ok(p.ratio >= p.min, `${p.name.padEnd(18)} ${String(p.ratio).padStart(6)}:1  (≥ ${p.min}:1)  ${p.rgb}`);
  }
  await page.context().close();
}

// ── §7.11 · flipping the theme on a phone must not show an unstyled frame ────
// index.html's pre-paint script covers a RELOAD. This covers the in-session
// flip, where the risk is different: `data-theme` changes on <html> and every
// palette token re-resolves at once. If any token dangled — or a surface fell
// back to transparent for a frame — the aurora would flash through the page.
{
  R.group('── 390px · ⌘ DESIGN theme flip ─────────────────────────────');
  // Seed the app's DEFAULT theme and flip AWAY from it. Seeding the target of
  // the click would make the click a no-op: an already-selected radio fires no
  // change, --surface-ground never moves, and the assertion below would be
  // measuring nothing while still going green.
  const page = await newThemedPage(browser, { width: 390, height: 844 }, 'classic');
  await page.goto(BASE + '/live/markets', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.panel', { timeout: 15000 });

  const sample = () => page.evaluate(() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 1;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    const alphaOf = (c) => {
      cx.globalCompositeOperation = 'copy';
      cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1);
      return cx.getImageData(0, 0, 1, 1).data[3] / 255;
    };
    const rs = getComputedStyle(document.documentElement);
    const panel = document.querySelector('.panel');
    return {
      theme: document.documentElement.getAttribute('data-theme'),
      ground: rs.getPropertyValue('--surface-ground').trim(),
      inkFloor: rs.getPropertyValue('--ink-60').trim(),
      panelAlpha: panel ? alphaOf(getComputedStyle(panel).backgroundColor) : null,
    };
  });

  const before = await sample();
  // v6.1.2: classic, not indigo, is now the app's default theme
  // (VisualContext.tsx) — this expectation changed because the default moved,
  // not because the test was wrong. Resist "fixing" it back to 'indigo'.
  R.ok(before.theme === 'classic', `starts on classic (got ${before.theme})`);

  // Both selectors below are testid-based, not positional. HomePage.tsx used
  // to mount a second <ThemeToggle/> beside its hero CTA row, so a page could
  // carry two theme controls with identical "Classic"/"Phosphor"/"Indigo"
  // labels at once and an unscoped text match could bind to the wrong one.
  // That mount was removed in p4·M2 and the dropdown's is now the only one —
  // but the testid stays, because the scoping is what makes this gate immune
  // to a second instance coming back, and this gate runs on /live/markets,
  // where the Home instance was never in scope anyway.
  const trigger = await page.$('[data-testid="design-panel-trigger"]');
  if (!trigger) {
    R.ok(false, 'the ⌘ DESIGN trigger is reachable at 390px');
  } else {
    await trigger.click();
    // Scoped to THIS control (the popover's <ThemeToggle/>), not a page-wide
    // .first() — see the comment above.
    const target = page.getByTestId('theme-toggle').getByText(/indigo/i);
    await target.click({ timeout: 5000 }).catch(() => {});
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const after = await sample();

    R.ok(after.theme === 'indigo', `flips to indigo (got ${after.theme})`);
    R.ok(!!after.ground && after.ground !== before.ground,
      `--surface-ground re-resolves and actually changes ("${before.ground}" → "${after.ground}")`);
    R.ok(!!after.inkFloor, 'the ink ramp still resolves after the flip — no dangling token');
    R.ok(after.panelAlpha === 1 && before.panelAlpha === 1,
      `panels stay fully opaque across the flip (before ${before.panelAlpha}, after ${after.panelAlpha})`,
      'a transparent frame here is the aurora flashing through the page');
  }
  await page.context().close();
}

await browser.close();
process.exit(R.finish());
