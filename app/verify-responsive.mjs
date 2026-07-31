// verify-responsive.mjs — v6.0.10 §4/§7.6 · walk EVERY route at 390px.
//
// verify-mobile.mjs already checks eight routes. Eight is how the legality tab
// shipped broken twice: it is a TAB, and nobody was walking tabs. This gate
// walks the full inventory from verify-lib.mjs — every education tab, every
// Monero tab, every simulator, and a 404 — in both themes, and prints one line
// per route so "no horizontal scroll anywhere" is a list you can read rather
// than a claim you have to trust.
//
// Assertions per route:
//   1. no horizontal scroll  (documentElement.scrollWidth ≤ innerWidth + 2)
//   2. no element overflows the viewport horizontally  (the thing that CAUSES 1,
//      reported by selector so the failure is actionable rather than "some page
//      is 12px too wide")
//   3. no visible text is clipped by an ancestor's overflow

import { launch, newThemedPage, makeReporter, BASE, ROUTES, THEMES } from './verify-lib.mjs';

const R = makeReporter('verify-responsive');
const { browser, engine } = await launch();
console.log('engine:', engine);

const WIDTH = 390, HEIGHT = 844;

/** Elements whose border box sticks out past the viewport's right edge.
 *  Deliberately ignores anything inside a legitimate scroll container — those
 *  are SUPPOSED to overflow their box; they just must not widen the page. */
const OVERFLOWERS = (vw) => {
  const out = [];
  const inScroller = (el) => {
    for (let n = el.parentElement; n; n = n.parentElement) {
      const o = getComputedStyle(n);
      if (o.overflowX === 'auto' || o.overflowX === 'scroll' || o.overflowX === 'hidden' || o.overflowX === 'clip') return true;
    }
    return false;
  };
  for (const el of document.body.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right <= vw + 1) continue;
    if (inScroller(el)) continue;
    out.push({
      sel: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string'
        ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''),
      right: Math.round(r.right),
      text: (el.textContent || '').trim().slice(0, 30),
    });
  }
  // report only the outermost offenders — a wide child reports its whole chain
  return out.slice(0, 6);
};

/** Text cut off with no way to reach it. §4.1: a table may stack to cards or
 *  scroll with a visible affordance — what it may never do is silently clip.
 *  `scrollWidth > clientWidth` on an `overflow: hidden` box is exactly that:
 *  content exists that the user cannot scroll to. Boxes that are genuinely
 *  scrollable (auto/scroll) are fine and excluded. */
const CLIPPED_TEXT = () => {
  const out = [];
  for (const el of document.body.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (cs.overflowX !== 'hidden' && cs.overflowX !== 'clip') continue;
    if (el.scrollWidth <= el.clientWidth + 1) continue;
    if (el.clientWidth === 0) continue;
    const text = (el.textContent || '').trim();
    if (!text) continue;                       // images/canvases clip legitimately
    if (el.closest('.mp-canvas-scroll')) continue;  // the pan canvas, by design
    // .sr-only is a 1×1 clipped box ON PURPOSE — that is how it stays available
    // to a screen reader without occupying layout. Flagging it would be flagging
    // the accessibility affordance itself.
    if (el.classList.contains('sr-only')) continue;
    out.push({
      sel: el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className
        ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''),
      scroll: el.scrollWidth, client: el.clientWidth, text: text.slice(0, 40),
    });
  }
  return out.slice(0, 6);
};

for (const theme of THEMES) {
  R.group(`── ${WIDTH}px · ${theme} · ${ROUTES.length} routes ──────────────`);
  const page = await newThemedPage(browser, { width: WIDTH, height: HEIGHT }, theme);

  for (const route of ROUTES) {
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

    const m = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      win: window.innerWidth,
    }));
    const over = await page.evaluate(OVERFLOWERS, WIDTH);
    const clipped = await page.evaluate(CLIPPED_TEXT);
    const slop = m.doc - m.win;
    const ok = slop <= 2 && over.length === 0 && clipped.length === 0;
    R.ok(ok, `${route.padEnd(28)} doc ${m.doc} / win ${m.win}`,
      [...over.map((o) => `overflow: ${o.sel} → right ${o.right}px  "${o.text}"`),
       ...clipped.map((c) => `clipped:  ${c.sel} ${c.scroll}>${c.client}px  "${c.text}"`)].join('\n     '));
  }

  await page.context().close();
}

// ── §7.7 · the two surfaces the device screenshots called out by name ────────
{
  R.group('── 390px · specific clipped surfaces from the report ───────');
  const page = await newThemedPage(browser, { width: WIDTH, height: HEIGHT }, 'indigo');

  await page.goto(BASE + '/markets', { waitUntil: 'networkidle' });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

  // The venues TYPE column rendered as a single character.
  const types = await page.evaluate(() => {
    const out = [];
    for (const cell of document.querySelectorAll('.mk-cell')) {
      const lbl = cell.querySelector('.mk-lbl');
      if (!lbl || lbl.textContent.trim() !== 'Type') continue;
      const val = cell.lastElementChild;
      const r = val.getBoundingClientRect();
      out.push({
        text: val.textContent.trim(),
        right: r.right,
        h: r.height,
        fs: parseFloat(getComputedStyle(val).fontSize),
        // scrollWidth > clientWidth is the definition of "this text is clipped"
        clipped: val.scrollWidth > val.clientWidth + 1,
      });
    }
    return out;
  });
  R.ok(types.length > 0, `venues TYPE column present (${types.length} rows)`);
  // A short value like "p2p" is legitimately narrow, so width alone proves
  // nothing. What the screenshots showed was TEXT CUT OFF and text stacked one
  // character per line — measure those two things directly.
  const squished = types.filter((t) => t.clipped || t.right > WIDTH + 0.5 || t.h > t.fs * 2.6);
  R.ok(squished.length === 0, 'every TYPE value is fully visible — not clipped, not one character per line',
    squished.map((t) => `"${t.text}" clipped=${t.clipped} h=${t.h.toFixed(0)} right=${t.right.toFixed(0)}`).join(', '));

  // The MultiLine legend was clipped at the right edge.
  const legend = await page.evaluate(() => {
    const svg = document.querySelector('svg[data-chart]');
    if (!svg) return null;
    const host = svg.parentElement;
    return [...host.querySelectorAll('span')]
      .filter((s) => /[+-]\d/.test(s.textContent || ''))
      .map((s) => { const r = s.getBoundingClientRect(); return { t: s.textContent.trim(), right: r.right }; });
  });
  if (legend && legend.length) {
    const cut = legend.filter((l) => l.right > WIDTH + 0.5);
    R.ok(cut.length === 0, `markets legend fully inside the viewport (${legend.length} entries)`,
      cut.map((l) => `"${l.t}" right ${l.right.toFixed(0)}`).join(', '));
  } else {
    R.info('markets legend not rendered (no history data in this sandbox) — covered by verify-chart-legibility');
  }

  await page.context().close();
}

await browser.close();
process.exit(R.finish());
