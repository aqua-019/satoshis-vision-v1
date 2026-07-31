// verify-ground.mjs — v6.0.10 §1 · ambient decoration never renders behind data.
//
// The v6.0.2 aurora (styles-ambient.css) paints on `position: fixed` layers at
// z-index -4/-3/-2. `.art` is `background: transparent` and `.proto-stage` had
// no background at all, so every simulator had orbs drifting across its chart —
// competing directly with the data it exists to explain.
//
// The gate is an OCCLUSION TEST, not a colour assertion. It REPAINTS the ambient
// layers in a garish colour, twice, in two different colours, and requires the
// surface to look identical both times. If any part of the aurora is visible
// through the surface, the two differ. This is stronger than reading computed
// styles, because it catches translucency introduced anywhere in the stack — an
// inline rgba(), a canvas that never fills, a gradient with a transparent stop —
// not just the rules we thought to check.
//
// Why recolour and not `display: none`? Because removing the layers changes the
// page's LAYERIZATION. Measured here: hiding #bg-plates, #bg-fx or #bg-grain one
// at a time moved 0, 6 and 0 pixels inside a simulator's explainer panel — but
// hiding all three at once moved 2079, at max Δ16, concentrated on glyph edges.
// That is Chromium dropping a composited layer and re-rasterising text with
// different subpixel antialiasing, and it is indistinguishable from a real leak
// if you only look at "did the buffer change". Recolouring keeps the layer count,
// the blend modes and the raster path identical, so the only thing that can move
// is aurora pixels.
//
// Run against `vite preview` on :4173 (see verify-lib.mjs BASE).

import { launch, newThemedPage, freezeAmbient, makeReporter, BASE, SIM_ROUTES } from './verify-lib.mjs';

const R = makeReporter('verify-ground');
const { browser, engine } = await launch();
console.log('engine:', engine);

const VIEWPORTS = [
  { name: '390', width: 390, height: 844 },
  { name: '1440', width: 1440, height: 900 },
];

// The layers that must never show through a data surface.
const AMBIENT_SELECTORS = ['#bg-plates', '#bg-fx', '#bg-grain'];

const HIDE_AMBIENT = AMBIENT_SELECTORS.map((s) => `${s} { display: none !important; }`).join('\n');

/** Repaint every ambient layer in one flat colour, leaving the layer tree,
 *  blend modes and animations exactly as they are. */
const paintAmbient = (colour) => `
  #bg-plates .plate, #bg-fx .dust, #bg-fx .sweep, #bg-fx .ribbon, #bg-fx .orb {
    background: ${colour} !important; background-image: none !important; opacity: 1 !important;
  }
  #bg-grain { background-image: none !important; background-color: ${colour} !important; opacity: 1 !important; }
  body::before { background: ${colour} !important; }
`;


/**
 * Per-pixel diff of two PNG buffers, decoded inside the page (no image library
 * in this repo, and none is worth adding for one gate). Returns how many pixels
 * differ beyond `tol` and the worst channel delta, so a caller can tell a real
 * glow bleeding through from a single antialiased glyph edge.
 */
async function diffPng(page, a, b, tol = 6) {
  return page.evaluate(async ({ a, b, tol }) => {
    const load = (d) => new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = 'data:image/png;base64,' + d;
    });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    if (ia.width !== ib.width || ia.height !== ib.height) {
      return { changed: Infinity, maxDelta: 255, total: 0, box: null };
    }
    const draw = (img) => {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(img, 0, 0);
      return x.getImageData(0, 0, img.width, img.height).data;
    };
    const da = draw(ia), db = draw(ib);
    let changed = 0, maxDelta = 0;
    let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
    for (let i = 0; i < da.length; i += 4) {
      const d = Math.max(
        Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
      if (d > maxDelta) maxDelta = d;
      if (d > tol) {
        changed++;
        const px = (i / 4) % ia.width, py = Math.floor((i / 4) / ia.width);
        if (px < x0) x0 = px; if (px > x1) x1 = px;
        if (py < y0) y0 = py; if (py > y1) y1 = py;
      }
    }
    return {
      changed, maxDelta, total: da.length / 4,
      box: x1 < 0 ? null : { x0, y0, x1, y1 },
    };
  }, { a: a.toString('base64'), b: b.toString('base64'), tol });
}

/**
 * Screenshot one element with the ambient layers hidden, then shown, and compare.
 *
 * The complication: simulators animate on requestAnimationFrame, which CSS
 * `animation: none` does not stop. Two screenshots of a running simulator differ
 * whether or not the aurora bleeds through — so a naive A/B diff reports every
 * animated surface as a failure (it did: Classic, which renders no ambient layer
 * at all, "failed" at 1440px).
 *
 * So the test calibrates its own noise floor first: take TWO screenshots under
 * identical conditions (ambient hidden both times). If those already differ, the
 * surface is repainting on its own and a pixel diff cannot say anything about
 * occlusion — report `animated` and let the caller fall back to a computed-style
 * check. Only when the surface is genuinely still does the A/B diff mean what it
 * claims to mean.
 */
async function occludes(page, selector) {
  const el = await page.$(selector);
  if (!el) return { found: false };
  // At 390px the artboard is height:auto and the explainer panel sits entirely
  // below the fold, so nothing of it is in the viewport to measure.
  await el.scrollIntoViewIfNeeded().catch(() => {});
  const box = await el.boundingBox();
  if (!box || box.width < 4 || box.height < 4) return { found: false };

  const settle = () => page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

  // Measure the INTERIOR, inset past the border radius. Every one of these
  // surfaces has `border-radius: 2-3px`, and inside a corner arc no background
  // paints — by definition, that is what a radius is. Those four ~2px arcs do
  // show the layer behind them, and including them made every rounded panel
  // "fail" for a reason that has nothing to do with data legibility. The rule
  // being enforced is that ambient never renders behind DATA, and no data lives
  // in a corner arc. 6px clears the radius plus antialiasing on both axes.
  const INSET = 6;
  if (box.width < INSET * 3 || box.height < INSET * 3) return { found: false };

  // Clip to the part of the surface that is genuinely visible, which is fiddlier
  // than "the bounding box, clamped to the viewport" for two reasons:
  //
  //   1. page.screenshot({clip}) only captures the viewport, and a .proto-panel
  //      is 729px tall starting at y=405 — it runs 234px off the bottom, and
  //      Playwright throws "clipped area is outside the resulting image".
  //   2. .footer-tele overlaps the bottom of that box, and the footer is
  //      TRANSPARENT on purpose — it is chrome in the margin, exactly where the
  //      aurora is supposed to show. Including it made every simulator panel
  //      "fail" on pixels that were never the panel's.
  //
  // So walk the bottom edge up until the surface is actually the thing on top.
  const clip = await el.evaluate((node, inset) => {
    const r = node.getBoundingClientRect();
    const left = Math.max(0, r.left + inset);
    const right = Math.min(window.innerWidth, r.right - inset);
    const top = Math.max(0, r.top + inset);
    let bottom = Math.min(window.innerHeight, r.bottom - inset);
    const cx = (left + right) / 2;
    const mine = (y) => {
      const hit = document.elementFromPoint(cx, y);
      return hit && (hit === node || node.contains(hit));
    };
    while (bottom - top > 16 && !mine(bottom - 1)) bottom -= 4;
    return { x: left, y: top, width: right - left, height: bottom - top };
  }, INSET);
  if (clip.width < 8 || clip.height < 16) return { found: false };
  const shot = () => page.screenshot({ clip });

  // Sample A-B-A, not A-A-B. The noise floor has to span the SAME elapsed time
  // as the measurement, or a surface that repaints on a slow interval reads as
  // "stable" across two back-to-back frames and then differs across the longer
  // gap — reporting drift as bleed-through.
  const paint = async (colour) => page.addStyleTag({ content: paintAmbient(colour) });
  const withPaint = async (colour) => {
    const h = await paint(colour);
    await settle();
    const png = await shot();
    await page.evaluate((x) => x.remove(), h);
    return png;
  };

  // Sample A-B-A, so the noise floor spans the SAME elapsed time as the
  // measurement. Otherwise a surface that repaints on a slow interval reads as
  // "stable" across two back-to-back frames and then differs across the longer
  // gap, reporting its own drift as bleed-through.
  const hidden1 = await withPaint('#ff00ff');
  const withAurora = await withPaint('#00ff88');
  const hidden2 = await withPaint('#ff00ff');

  // Byte-equality of two PNGs is too blunt to act on: it cannot distinguish "the
  // aurora is glowing through this panel" from "one glyph antialiased differently
  // because hiding a mix-blend-mode layer changed the compositing path". Decode
  // both in-page and report how many pixels moved, and by how much.
  const noise = await diffPng(page, hidden1, hidden2);
  const signal = await diffPng(page, hidden1, withAurora);
  // The measurement only counts if the surface is otherwise still.
  const stable = noise.changed === 0;

  if (!stable) {
    // Fall back to the deterministic question: is anything between this surface
    // and the fixed ambient layers actually opaque? Walk the element and its
    // ancestors up to <body> looking for a fully-opaque background.
    const opaque = await el.evaluate((node) => {
      const isOpaque = (c) => {
        if (!c || c === 'transparent') return false;
        const m = c.match(/rgba?\(([^)]+)\)/);
        if (!m) return true;                       // a named colour or hex
        const parts = m[1].split(/[,\s/]+/).filter(Boolean);
        return parts.length < 4 || parseFloat(parts[3]) >= 0.999;
      };
      for (let n = node; n && n !== document.documentElement; n = n.parentElement) {
        if (isOpaque(getComputedStyle(n).backgroundColor)) return true;
      }
      return false;
    });
    return { found: true, animated: true, identical: opaque, noise, signal };
  }

  // With the layer tree held constant, ANY pixel that moves when the ambient
  // colour changes is ambient showing through. No tolerance is warranted.
  return { found: true, animated: false, identical: signal.changed === 0, noise, signal };
}

for (const vp of VIEWPORTS) {
  for (const theme of ['indigo', 'classic']) {
    R.group(`── ${vp.name}px · ${theme} ─────────────────────────────`);
    const page = await newThemedPage(browser, vp, theme);
    // the app honours prefers-reduced-motion throughout (design/useReducedMotion.ts),
    // so this stills most simulators outright rather than relying on the fallback
    await page.emulateMedia({ reducedMotion: 'reduce' });

    // One representative simulator per family plus the two worst offenders from
    // the device screenshots (decoy density curve, Dandelion stem/fluff).
    const probes = ['/simulate?p=decoy', '/simulate?p=dandelion', '/simulate?p=bloodhound'];
    for (const route of probes) {
      await page.goto(BASE + route, { waitUntil: 'networkidle' });
      await freezeAmbient(page);
      await page.waitForSelector('.proto-stage', { timeout: 10_000 }).catch(() => {});

      for (const sel of ['.proto-stage', '.proto-panel']) {
        const r = await occludes(page, sel);
        if (!r.found) { R.ok(false, `${route} · ${sel} present`); continue; }
        R.ok(r.identical,
          `${route} · aurora is NOT visible through ${sel}${r.animated ? ' [animated → opaque-ancestor check]' : ''}`,
          r.animated
            ? 'no opaque background between this surface and the fixed ambient layers'
            : `${r.signal.changed}/${r.signal.total} px differ (max Δ${r.signal.maxDelta}) in region ${JSON.stringify(r.signal.box)} when the ambient layers change colour`);
      }
    }

    // Data panels on the two densest pages.
    for (const route of ['/markets', '/network']) {
      await page.goto(BASE + route, { waitUntil: 'networkidle' });
      await freezeAmbient(page);
      await page.waitForSelector('.panel', { timeout: 10_000 }).catch(() => {});
      const panel = await occludes(page, '.panel');
      if (!panel.found) { R.ok(false, `${route} · .panel present`); continue; }
      R.ok(panel.identical,
        `${route} · aurora is NOT visible through .panel${panel.animated ? ' [animated → opaque-ancestor check]' : ''}`,
        panel.animated
          ? 'no opaque background between this surface and the fixed ambient layers'
          : `${panel.signal.changed}/${panel.signal.total} px differ (max Δ${panel.signal.maxDelta})`);
    }

    // Classic has no aurora at all (§6b) — assert the layers are actually gone
    // rather than merely retinted, which is what the v5 pixel-diff requires.
    if (theme === 'classic') {
      await page.goto(BASE + '/', { waitUntil: 'networkidle' });
      const shown = await page.evaluate((sels) => sels.filter((s) => {
        const el = document.querySelector(s);
        return el && getComputedStyle(el).display !== 'none';
      }), AMBIENT_SELECTORS);
      R.ok(shown.length === 0, 'classic renders no ambient layer at all',
        shown.length ? `still displayed: ${shown.join(', ')}` : '');

      const floor = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--amb-floor').trim());
      R.ok(floor.toLowerCase() === '#050505',
        `classic --amb-floor is v5's #050505 (got "${floor}")`);
    }

    await page.context().close();
  }
}

// ── static pass · no data-surface class may declare a see-through background ──
R.group('── static · data surfaces declare an opaque ground ──────────');
{
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('./src/styles.css', import.meta.url), 'utf8');
  // Surfaces that carry data and therefore must reference --surface-ground.
  const MUST_GROUND = ['.proto-stage', '.proto-panel', '.panel', '.lg-item'];
  for (const sel of MUST_GROUND) {
    const re = new RegExp(`^\\${sel}\\s*\\{[^}]*\\}`, 'm');
    const m = css.match(re);
    if (!m) { R.ok(false, `${sel} rule found in styles.css`); continue; }
    R.ok(/--surface-ground/.test(m[0]), `${sel} sits on --surface-ground`,
      m[0].slice(0, 120));
  }
  R.ok(/--surface-ground:\s*#[0-9a-fA-F]{6}\s*;/.test(css),
    '--surface-ground is an opaque hex, not an rgba() — an alpha here is the bug');
}

await browser.close();
process.exit(R.finish());
