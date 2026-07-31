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

for (const theme of ['indigo', 'classic']) {
  R.group(`── ${theme} · ink and status colours on --surface-ground ────`);
  const page = await newThemedPage(browser, { width: 1440, height: 900 }, theme);
  await page.goto(BASE + '/markets', { waitUntil: 'networkidle' });
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

await browser.close();
process.exit(R.finish());
