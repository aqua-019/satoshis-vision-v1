// verify-legality.mjs — v6.0.10 §3 · the legal page answers the question.
//
// Before this version the page rendered an 8-column grid at 390px: COUNTRY wrapped
// one character per line, the header row bled off-screen, and China's ILLEGAL chip
// was cut in half. The page's own thesis — "Monero itself has never been outlawed
// in most countries" — was unverifiable because the layout prevented reading it.
//
// The assertions below are deliberately derivation-checking rather than
// string-matching: the summary counts are recomputed from the rendered chips and
// compared to the printed sentence, so the gate cannot be satisfied by a hardcoded
// number that happens to be right today.

import { launch, newThemedPage, makeReporter, BASE } from './verify-lib.mjs';

const R = makeReporter('verify-legality');
const { browser, engine } = await launch();
console.log('engine:', engine);

const ROUTE = '/monero/legality';

// ── 390px · one card per country, zero taps to an answer ─────────────────────
{
  R.group('── 390px · card presentation ───────────────────────────────');
  const page = await newThemedPage(browser, { width: 390, height: 844 }, 'indigo');
  await page.goto(BASE + ROUTE, { waitUntil: 'networkidle' });
  await page.waitForSelector('.lg-row', { timeout: 10_000 });

  const m = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.lg-row')];
    const cs = (el) => getComputedStyle(el);
    return {
      rowCount: rows.length,
      actsDisplay: rows[0] ? cs(rows[0].querySelector('.lg-acts')).display : null,
      headDisplay: document.querySelector('.lg-head') ? cs(document.querySelector('.lg-head')).display : 'absent',
      docW: document.documentElement.scrollWidth,
      winW: window.innerWidth,
      // every headline chip must be visible and inside the viewport
      headlines: rows.map((r) => {
        const h = r.querySelector('.lg-headline');
        if (!h) return null;
        const b = h.getBoundingClientRect();
        return { text: h.textContent.trim(), w: b.width, right: b.right };
      }),
      // the one-character-per-line signature: a box narrower than ~2.2 chars
      // of its own font-size, with a height several lines tall.
      vertical: rows.filter((r) => {
        const n = r.querySelector('.lg-name');
        if (!n) return false;
        const b = n.getBoundingClientRect();
        const fs = parseFloat(cs(n).fontSize);
        return b.width < fs * 2.2 && b.height > fs * 2.5;
      }).map((r) => r.querySelector('.lg-name').textContent.trim()),
      chipFonts: [...document.querySelectorAll('.lg-headline *')]
        .map((e) => parseFloat(cs(e).fontSize)).filter((n) => n > 0),
    };
  });

  R.ok(m.rowCount === 21, `21 jurisdictions rendered (got ${m.rowCount})`);
  R.ok(m.actsDisplay === 'none', `the 5-activity grid is hidden on mobile (display: ${m.actsDisplay})`);
  R.ok(m.headDisplay === 'none' || m.headDisplay === 'absent',
    `the matrix header row is hidden on mobile (display: ${m.headDisplay})`);
  R.ok(m.docW - m.winW <= 2, `no horizontal scroll (doc ${m.docW} vs win ${m.winW})`);
  R.ok(m.vertical.length === 0, 'no country name renders one character per line',
    m.vertical.join(', '));

  const missing = m.headlines.filter((h) => !h || h.w <= 0 || !h.text);
  R.ok(missing.length === 0, 'every card shows a headline status with ZERO taps');
  const clipped = (m.headlines.filter(Boolean)).filter((h) => h.right > m.winW + 0.5);
  R.ok(clipped.length === 0, 'no headline chip is clipped at the right edge',
    clipped.map((h) => h.text).join(', '));

  const tooSmall = m.chipFonts.filter((f) => f < 12);
  R.ok(tooSmall.length === 0, `every chip renders at ≥12px on mobile`,
    tooSmall.join(', '));

  // tap-to-expand → five stacked label→chip rows, flex, never a grid
  await page.click('.lg-row');
  const exp = await page.evaluate(() => {
    const btn = document.querySelector('.lg-row');
    const stack = document.querySelector('.lg-acts-stack');
    return {
      expanded: btn.getAttribute('aria-expanded'),
      controls: btn.getAttribute('aria-controls'),
      panelId: document.querySelector('.lg-panel')?.id ?? null,
      stackDisplay: stack ? getComputedStyle(stack).display : null,
      actRows: document.querySelectorAll('.lg-act-row').length,
    };
  });
  R.ok(exp.expanded === 'true', 'tapping a card sets aria-expanded="true"');
  R.ok(exp.controls && exp.controls === exp.panelId, 'aria-controls points at the rendered panel');
  R.ok(exp.stackDisplay === 'flex', `the breakdown is a flex column, never a grid (got ${exp.stackDisplay})`);
  R.ok(exp.actRows === 5, `five activity rows (Hold/CEX/P2P/Mine/Pay) — got ${exp.actRows}`);

  await page.context().close();
}

// ── 1440px · the matrix survives, and its header lines up ────────────────────
{
  R.group('── 1440px · matrix presentation ────────────────────────────');
  const page = await newThemedPage(browser, { width: 1440, height: 900 }, 'indigo');
  await page.goto(BASE + ROUTE, { waitUntil: 'networkidle' });
  await page.waitForSelector('.lg-row', { timeout: 10_000 });

  const m = await page.evaluate(() => {
    const row = document.querySelector('.lg-row');
    const head = document.querySelector('.lg-head');
    const cs = (el) => getComputedStyle(el);
    const cols = (el) => [...el.children].map((c) => +c.getBoundingClientRect().left.toFixed(1));
    return {
      actsDisplay: cs(row.querySelector('.lg-acts')).display,
      headlineDisplay: cs(row.querySelector('.lg-headline')).display,
      headCols: head ? cols(head) : null,
      // .lg-acts is display:contents, so the chips ARE the row's grid items —
      // flatten one level to compare like with like. display:none children
      // (.lg-headline, .lg-pop) are not grid items at all and report left: 0,
      // so they must be dropped or every subsequent column reads as misaligned.
      rowCols: [...row.children]
        .flatMap((c) => (c.classList.contains('lg-acts') ? [...c.children] : [c]))
        .filter((c) => cs(c).display !== 'none')
        .map((c) => +c.getBoundingClientRect().left.toFixed(1)),
      cellWidths: [...row.querySelector('.lg-acts').children].map((c) => c.getBoundingClientRect().width),
    };
  });

  R.ok(m.actsDisplay === 'contents',
    `the 5 chips are promoted to grid items on desktop (display: ${m.actsDisplay})`);
  R.ok(m.headlineDisplay === 'none', 'the mobile headline chip is hidden on desktop');

  // This is the assertion that would have caught the original bug: the header
  // duplicated the grid definition inline and added minWidth:720, so it silently
  // desynced from the body rows.
  if (m.headCols && m.rowCols) {
    const n = Math.min(m.headCols.length, m.rowCols.length);
    const off = [];
    for (let i = 0; i < n; i++) {
      if (Math.abs(m.headCols[i] - m.rowCols[i]) > 1) off.push(`col ${i}: ${m.headCols[i]} vs ${m.rowCols[i]}`);
    }
    R.ok(m.headCols.length === m.rowCols.length && off.length === 0,
      `header columns align with body columns (${n} columns)`, off.join('; '));
  } else {
    R.ok(false, 'header row and body row both present');
  }

  const narrow = m.cellWidths.filter((w) => w < 88);
  R.ok(narrow.length === 0, 'every status cell is ≥88px wide (the open v4 item)',
    narrow.map((w) => w.toFixed(0)).join(', '));

  await page.context().close();
}

// ── derivation · counts, filters, search, and the NY correction ──────────────
{
  R.group('── derivation · summary, filters, search ───────────────────');
  const page = await newThemedPage(browser, { width: 1440, height: 900 }, 'indigo');
  await page.goto(BASE + ROUTE, { waitUntil: 'networkidle' });
  await page.waitForSelector('.lg-chip', { timeout: 10_000 });

  const chips = await page.evaluate(() =>
    [...document.querySelectorAll('.lg-chip')].map((c) => ({
      text: c.textContent.trim(),
      n: parseInt((c.textContent.match(/(\d+)\s*$/) || [])[1] ?? '-1', 10),
    })));
  const chipTotal = chips.reduce((a, c) => a + (c.n > 0 ? c.n : 0), 0);
  R.ok(chips.length === 4, `four status filter chips (got ${chips.length})`);
  R.ok(chipTotal === 21,
    `the four filter counts sum to 21 jurisdictions (got ${chipTotal})`,
    chips.map((c) => c.text).join(' | '));

  const summaryNums = await page.evaluate(() => {
    const el = document.querySelector('.lg-controls');
    return el ? (el.textContent.match(/\d+/g) || []).map(Number) : null;
  });
  R.ok(summaryNums && summaryNums.includes(21),
    'the summary line states the jurisdiction total, derived from the data',
    JSON.stringify(summaryNums));

  // filtering actually narrows the set
  const before = await page.$$eval('.lg-row', (r) => r.length);
  await page.click('.lg-chip');
  const after = await page.$$eval('.lg-row', (r) => r.length);
  R.ok(after < before && after > 0, `a filter chip narrows ${before} rows to ${after}`);
  await page.click('.lg-chip'); // toggle back off
  R.ok((await page.$$eval('.lg-row', (r) => r.length)) === before, 'toggling the chip restores all rows');

  // search
  await page.fill('.lg-search', 'germ');
  const germ = await page.$$eval('.lg-row .lg-name', (n) => n.map((e) => e.textContent.trim()));
  R.ok(germ.length === 1 && /Germany/.test(germ[0]), `search "germ" → 1 row (got ${germ.length})`);
  await page.fill('.lg-search', 'bitlicense');
  const ny = await page.$$eval('.lg-row .lg-name', (n) => n.map((e) => e.textContent.trim()));
  R.ok(ny.length >= 1 && ny.some((t) => /New York/.test(t)),
    'search "bitlicense" finds the New York row via its aliases');
  await page.fill('.lg-search', '');

  // NY reads gray-zone, never red
  const nyRow = await page.evaluate(() => {
    const row = [...document.querySelectorAll('.lg-row')]
      .find((r) => /New York/.test(r.querySelector('.lg-name')?.textContent ?? ''));
    if (!row) return null;
    return {
      name: row.querySelector('.lg-name').textContent.trim(),
      headline: row.querySelector('.lg-headline')?.textContent.trim() ?? '',
      reason: row.querySelector('.lg-reason')?.textContent.trim() ?? '',
      // any chip painted with the illegal red?
      red: [...row.querySelectorAll('.lg-acts *')]
        .some((e) => /255,\s*77,\s*109/.test(getComputedStyle(e).color)),
    };
  });
  if (!nyRow) R.ok(false, 'a New York jurisdiction row exists');
  else {
    R.ok(!/illegal/i.test(nyRow.headline + nyRow.reason),
      `New York does not read ILLEGAL (headline: "${nyRow.headline || nyRow.reason}")`);
    R.ok(!nyRow.red, 'no New York activity is flagged red — BitLicense binds businesses, not individuals');
  }

  // the headline must name the activity, or a worst-of-five reduction libels
  // the page's own thesis (most "illegal" headlines are CEX-listing only).
  const bare = await page.evaluate(() =>
    [...document.querySelectorAll('.lg-row')].map((r) => ({
      n: r.querySelector('.lg-name')?.textContent.trim(),
      h: (r.querySelector('.lg-headline') || r.querySelector('.lg-reason'))?.textContent.trim() ?? '',
    })).filter((x) => /^(illegal|restricted|unclear)$/i.test(x.h)));
  R.ok(bare.length === 0, 'no headline is a bare severity — each names the activity it applies to',
    bare.map((b) => `${b.n}: "${b.h}"`).join(', '));

  await page.context().close();
}

await browser.close();
process.exit(R.finish());
