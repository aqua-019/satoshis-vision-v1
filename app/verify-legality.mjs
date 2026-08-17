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

// ── p3·18 · WIRED, and extended for the evidence layer ───────────────────────
//
// This file asserted real things and ran in NOTHING from v6.0.10 until p3·18 —
// one of the census's seven orphans. It was GREEN on the untouched tree when
// finally run (26 passed · 0 failed, exit 0), so nothing here needed fixing; it
// needed wiring. It now runs at `verify:e2e` position 17, MID-CHAIN, beside the
// other page gates and deliberately NOT at the tail: the tail carries the
// inverted vitals-last invariant (#184 F4) and appending there deepens a known
// defect.
//
// Sections added by p3·18:
//   §A  instrument floors — the data.ts source parse everything below compares to
//   §B  citations: every claim carries a source the reader can check
//   §C  review dates: honest, derived, and NOT a mass-stamp
//   §D  the non-hue status channel (word + shape), i.e. greyscale legibility
//   §E  320px reflow (WCAG 2.2 AA 1.4.10)
//
// BLIND SPOTS (stated, not hidden):
//   — Whether any citation URL RESOLVES. There is no egress: the agent gateway
//     answers 403 to CONNECT for dfs.ny.gov, eur-lex.europa.eu and fincen.gov,
//     measured rather than assumed. §B asserts scheme and shape; VALIDITY is
//     operator-checkable and is listed as such in the PR body.
//   — Whether any legal CLAIM is currently true. Nothing here can know that.
//     §C makes the claims' AGE visible so a reader can discount them; it cannot
//     make them fresh.
//   — Whether `reviewed` matches git history. It does at the commit that set it,
//     but the gate deliberately does NOT shell out to git: `ci.yml` uses
//     actions/checkout@v4 with no `fetch-depth`, which defaults to depth 1, so a
//     git-derived authority is unreadable in CI. (The same reason
//     verify-releases.mjs uses a committed FILE as its authority.)

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, newThemedPage, makeReporter, BASE } from './verify-lib.mjs';

const R = makeReporter('verify-legality');
const __dirname = dirname(fileURLToPath(import.meta.url));
const { browser, engine } = await launch();
console.log('engine:', engine);

const ROUTE = '/monero/legality';

/* ══ §A · instrument floors ═══════════════════════════════════════════════
   §B and §C compare the RENDERED page against data.ts's SOURCE TEXT. A parse
   that silently returns nothing makes every set-difference below VACUOUSLY
   TRUE, so each parse is asserted non-empty BEFORE anything is compared to it
   — verify-ia §7b/§7c and verify-superstress §0 open the same way. */

/** Strip // and block comments WITHOUT touching string literals. This is
 *  verify-superstress's string-aware version verbatim, whose header records the
 *  measured defect that produced it (a naive stripper blanked the `//` inside a
 *  URL and the gate reported a mismatch against a page that was right).
 *
 *  ── AN EARLIER VERSION OF THIS COMMENT CLAIMED MORE THAN WAS TRUE, and a break
 *     test is what caught it. ────────────────────────────────────────────────
 *  It said the stripper was "load-bearing here, not defensive", because data.ts's
 *  docblock for `sources` contains the literal `[["…", null]]`. Measured: removing
 *  the `stripComments` call entirely leaves this gate at 63 passed · 0 failed. The
 *  docblocks cannot reach the parse at all — `parseMatrix` ANCHORS at
 *  `LEGALITY_MATRIX` and slices from there, so everything above it, including every
 *  type docblock, is structurally out of range. The claim was asserted from a
 *  plausible mechanism instead of measured, which is the family CLAUDE.md says has
 *  cost more near-misses here than the code has.
 *
 *  What the stripper actually protects is a comment INSIDE the array — a
 *  commented-out row would otherwise parse as a live one. That hazard is real and
 *  currently unrealised, so it cannot be proven by the production data. It is
 *  proven below by a FALSIFIABILITY PAIR over a fixture instead: the same input,
 *  stripped and unstripped, must disagree. A control that cannot fail is not a
 *  control, and the previous one could not. */
function stripComments(src) {
  let out = '', i = 0;
  while (i < src.length) {
    const c = src[i], two = src.slice(i, i + 2);
    if (c === '"' || c === "'" || c === '`') {
      out += c; i++;
      while (i < src.length && src[i] !== c) {
        if (src[i] === '\\') { out += src[i]; i++; if (i < src.length) { out += src[i]; i++; } continue; }
        out += src[i]; i++;
      }
      if (i < src.length) { out += src[i]; i++; }
    } else if (two === '//') { while (i < src.length && src[i] !== '\n') { out += ' '; i++; } }
    else if (two === '/*') {
      while (i < src.length && src.slice(i, i + 2) !== '*/') { out += src[i] === '\n' ? '\n' : ' '; i++; }
      out += '  '; i += 2;
    } else { out += c; i++; }
  }
  return out;
}

/** The balanced `[ … ]` beginning at `openIdx`, string-aware.
 *  A non-greedy `\[([\s\S]*?)\]` CANNOT read `sources`, because the first `]`
 *  it meets closes the first INNER pair — it would return one citation and drop
 *  the rest, silently, and the count comparison would red against correct data. */
function balancedArray(s, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"') { i++; while (i < s.length && s[i] !== '"') { if (s[i] === '\\') i++; i++; } continue; }
    if (ch === '[') depth++;
    else if (ch === ']') { depth--; if (depth === 0) return s.slice(openIdx, i + 1); }
  }
  return null;
}

const dataSrc = stripComments(readFileSync(join(__dirname, 'src', 'pages', 'monero', 'legality', 'data.ts'), 'utf8'));

/** country → { reviewed, sources: [[label, href|null], …] }, parsed from source.
 *  Rows are delimited by their own `n:` fields rather than by brace matching:
 *  a note is prose and may contain any punctuation, so a brace scan over prose
 *  is a bet, while `n:` is a field this file's own convention keeps
 *  plainly-double-quoted (the `mempool-meta.ts` idiom, six gates deep). */
function parseMatrix(src) {
  const start = src.indexOf('LEGALITY_MATRIX');
  const body = start < 0 ? '' : src.slice(start);
  const names = [...body.matchAll(/\bn:\s*"((?:[^"\\]|\\.)*)"/g)];
  const out = new Map();
  for (let i = 0; i < names.length; i++) {
    const from = names[i].index;
    const to = i + 1 < names.length ? names[i + 1].index : body.length;
    const seg = body.slice(from, to);
    const country = names[i][1].replace(/\\(.)/g, '$1');
    const reviewed = (seg.match(/\breviewed:\s*"([^"]*)"/) || [])[1] ?? null;
    // The five activity statuses, so §D can DERIVE how many distinct status
    // words the matrix should render instead of hardcoding 4. If a future data
    // set happens to use only three, the assertion follows the data.
    const statuses = [...seg.matchAll(/\b(?:hold|cex|p2p|mine|pay):\s*"([a-z]+)"/g)].map((m) => m[1]);
    const sIdx = seg.search(/\bsources:\s*\[/);
    let sources = null;
    if (sIdx >= 0) {
      const arr = balancedArray(seg, seg.indexOf('[', sIdx));
      if (arr) {
        sources = [...arr.matchAll(/\[\s*"((?:[^"\\]|\\.)*)"\s*,\s*(?:"((?:[^"\\]|\\.)*)"|null)\s*\]/g)]
          .map((m) => [m[1].replace(/\\(.)/g, '$1'), m[2] === undefined ? null : m[2]]);
      }
    }
    out.set(country, { reviewed, sources, statuses });
  }
  return out;
}

const SRC_ROWS = parseMatrix(dataSrc);

R.group('§A · instrument floors — the source parse §B/§C compare against');
R.ok(SRC_ROWS.size === 21,
  `data.ts parses to 21 jurisdictions (got ${SRC_ROWS.size})`,
  [...SRC_ROWS.keys()].join(', '));
const noSources = [...SRC_ROWS].filter(([, v]) => !v.sources || v.sources.length === 0).map(([k]) => k);
R.ok(SRC_ROWS.size > 0 && noSources.length === 0,
  'every parsed row carries at least one source — the parse is not returning empties',
  noSources.join(', '));
const noReviewed = [...SRC_ROWS].filter(([, v]) => !v.reviewed).map(([k]) => k);
R.ok(SRC_ROWS.size > 0 && noReviewed.length === 0,
  'every parsed row carries a reviewed date',
  noReviewed.join(', '));
// ── the instrument's OWN falsifiability pair ─────────────────────────────────
// Offline, over a fixture, because the hazard the stripper guards against is not
// present in the production data and so cannot be demonstrated from it. Both
// polarities run on every invocation: there is nothing to remember to revert, and
// neither half can pass for a reason unrelated to its claim.
{
  const FIXTURE = `export const LEGALITY_MATRIX: MatrixRow[] = [
  { c: "A", n: "Realland", hold: "legal", cex: "legal", p2p: "legal", mine: "legal", pay: "legal",
    note: "A live row. See https://example.org/a//b for the // hazard.",
    reviewed: "2026-01-01",
    sources: [["Real", "https://example.org/"]] },
  // { c: "B", n: "Commentland", hold: "legal", cex: "legal", p2p: "legal", mine: "legal", pay: "legal",
  //   note: "A commented-out row.",
  //   reviewed: "2026-01-02",
  //   sources: [["Ghost", null]] },
];`;
  const stripped = parseMatrix(stripComments(FIXTURE));
  const raw = parseMatrix(FIXTURE);
  R.ok(stripped.size === 1 && stripped.has('Realland') && !stripped.has('Commentland'),
    `stripped: a commented-out row is NOT parsed (${[...stripped.keys()].join(', ') || 'none'})`);
  // The half that makes the half above non-vacuous: unstripped, the ghost DOES
  // appear. If this ever stops being true the pair has lost its subject and the
  // assertion above is passing for some other reason.
  R.ok(raw.has('Commentland'),
    `unstripped: the same input DOES yield the ghost row — the pair disagrees, so the stripper is doing work (${[...raw.keys()].join(', ')})`);
  // And the defect that produced the string-aware version: a `//` inside a string
  // literal must survive, or a note carrying a URL is truncated mid-parse.
  R.ok((stripped.get('Realland')?.sources?.[0]?.[1] ?? '') === 'https://example.org/',
    'a `//` inside a string literal survives the stripper — an href is not truncated');
  // The pair above proves the FUNCTION works; it says nothing about whether the
  // call site uses it. This closes that gap directly, and it is what reds if
  // someone drops the `stripComments(...)` wrapper from `dataSrc`.
  R.ok(!dataSrc.includes('/**') && readFileSync(join(__dirname, 'src', 'pages', 'monero', 'legality', 'data.ts'), 'utf8').includes('/**'),
    'the source THIS GATE parses has actually been stripped (the raw file has docblocks; dataSrc has none)');
}

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

// ── §B/§C/§D · the evidence layer, read out of every one of the 21 panels ────
{
  const page = await newThemedPage(browser, { width: 1440, height: 900 }, 'indigo');
  await page.goto(BASE + ROUTE, { waitUntil: 'networkidle' });
  await page.waitForSelector('.lg-row', { timeout: 10_000 });

  // The accordion is single-open by design (§0.3 — do not "fix" it), so every
  // panel must be opened in turn. Collect once; §B, §C and §D all read this.
  const panels = await page.evaluate(async () => {
    const out = [];
    const rows = [...document.querySelectorAll('.lg-row')];
    for (const btn of rows) {
      btn.click();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const item = btn.closest('.lg-item');
      const panel = item.querySelector('.lg-panel');
      out.push({
        country: btn.querySelector('.lg-name')?.childNodes[0]?.textContent.trim() ?? '',
        // textContent, never innerText: .kicker uppercases via text-transform and
        // innerText returns the RENDERED casing. Three instances of that defect
        // are recorded in CLAUDE.md; this gate does not add a fourth.
        panelText: panel ? panel.textContent : '',
        sources: panel ? [...panel.querySelectorAll('[data-lg-source]')].map((e) => ({
          kind: e.getAttribute('data-lg-source'),
          // strip the decorative ↗ and the sr-only tail so the label compares
          // to what data.ts actually declares
          label: (e.childNodes[0]?.textContent ?? '').trim(),
          href: e.getAttribute('href'),
          tag: e.tagName,
          rel: e.getAttribute('rel'),
          target: e.getAttribute('target'),
        })) : [],
        unlinkedNote: panel ? !!panel.querySelector('[data-lg-unlinked-note]') : false,
        reviewed: panel ? panel.querySelector('[data-lg-reviewed]')?.getAttribute('data-lg-reviewed') ?? null : null,
        reviewedText: panel ? panel.querySelector('[data-lg-reviewed]')?.textContent.trim() ?? '' : '',
      });
      btn.click(); // close, so the next open is a clean single-open toggle
      await new Promise((r) => requestAnimationFrame(r));
    }
    return out;
  });

  R.group('── §B · citations · every claim carries a checkable source ─');

  R.ok(panels.length === 21, `all 21 panels were opened and read (got ${panels.length})`);
  const emptyPanels = panels.filter((p) => p.sources.length === 0).map((p) => p.country);
  R.ok(panels.length > 0 && emptyPanels.length === 0,
    'every jurisdiction renders at least one source chip',
    emptyPanels.join(', '));

  // DERIVATION, both directions — the count comes from data.ts, never a literal.
  const countMismatch = [], labelMismatch = [];
  for (const p of panels) {
    const src = SRC_ROWS.get(p.country);
    if (!src) { countMismatch.push(`${p.country}: not in data.ts`); continue; }
    if (src.sources.length !== p.sources.length) {
      countMismatch.push(`${p.country}: data.ts ${src.sources.length} vs rendered ${p.sources.length}`);
    }
    const want = src.sources.map((s) => s[0]).sort();
    const got = p.sources.map((s) => s.label).sort();
    if (want.join('|') !== got.join('|')) labelMismatch.push(`${p.country}: [${want}] vs [${got}]`);
  }
  R.ok(countMismatch.length === 0, 'each row renders exactly as many chips as data.ts declares',
    countMismatch.join('; '));
  R.ok(labelMismatch.length === 0, 'each row renders exactly the labels data.ts declares (both directions)',
    labelMismatch.join('; '));

  const allSources = panels.flatMap((p) => p.sources.map((s) => ({ ...s, country: p.country })));
  const linked = allSources.filter((s) => s.kind === 'linked');
  const unlinked = allSources.filter((s) => s.kind === 'unlinked');

  // PAIRED POSITIVE CONTROLS. Without these, "no bad href" is satisfied by a page
  // that renders no hrefs at all, and "unlinked renders honestly" is satisfied by
  // a page with nothing unlinked. Both branches must be EXERCISED for the
  // assertions over them to mean anything (verify-superstress §5's lesson).
  R.ok(linked.length > 0, `at least one source is LINKED — the linked branch is exercised (${linked.length})`);
  R.ok(unlinked.length > 0, `at least one source is UNLINKED — the honest-null branch is exercised (${unlinked.length})`);

  const badScheme = linked.filter((s) => !/^https:\/\//.test(s.href ?? ''));
  R.ok(badScheme.length === 0, `every linked source is https (${linked.length} links)`,
    badScheme.map((s) => `${s.country}: ${s.href}`).join(', '));

  // "no chip href is a dead in-app route": a citation points OUT. A leading "/"
  // would be an in-app route rendered as an external anchor with a "↗" glyph
  // promising a site that is this one — EcoPopup.tsx:155 records that exact defect.
  const inApp = linked.filter((s) => (s.href ?? '').startsWith('/'));
  R.ok(inApp.length === 0, 'no source chip points at an in-app route',
    inApp.map((s) => `${s.country}: ${s.href}`).join(', '));

  const badHost = linked.filter((s) => {
    try { const u = new URL(s.href); return !u.hostname.includes('.') || u.hostname === 'localhost'; }
    catch { return true; }
  });
  R.ok(badHost.length === 0, 'every linked source resolves to a named external domain',
    badHost.map((s) => `${s.country}: ${s.href}`).join(', '));

  // Privacy, not boilerplate: noreferrer withholds the Referer header, so a
  // regulator's server is never told its visitor came from a Monero legality page.
  const leaky = linked.filter((s) => !/noreferrer/.test(s.rel ?? '') || !/noopener/.test(s.rel ?? ''));
  R.ok(leaky.length === 0, 'every outbound citation carries rel="noopener noreferrer"',
    leaky.map((s) => `${s.country}: rel="${s.rel}"`).join(', '));

  const notAnchor = linked.filter((s) => s.tag !== 'A');
  R.ok(notAnchor.length === 0, 'linked sources are anchors; unlinked ones are not',
    notAnchor.map((s) => `${s.country}: <${s.tag}>`).join(', '));
  const clickableUnlinked = unlinked.filter((s) => s.tag === 'A' || s.href);
  R.ok(clickableUnlinked.length === 0, 'an unlinked source is not secretly clickable',
    clickableUnlinked.map((s) => s.country).join(', '));

  // The explanatory sentence appears IFF the row has an unlinked source — an
  // absence assertion paired with a presence one, so a standing disclaimer that
  // has stopped describing the page reds instead of reassuring.
  const noteWrong = panels.filter((p) => p.unlinkedNote !== p.sources.some((s) => s.kind === 'unlinked'));
  R.ok(noteWrong.length === 0,
    'the "dashed entries are unlinked" note renders exactly on the rows that have one',
    noteWrong.map((p) => `${p.country}: note=${p.unlinkedNote}`).join(', '));

  R.group('── §C · review dates · honest, derived, never a mass-stamp ─');

  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const badDate = panels.filter((p) => !p.reviewed || !ISO.test(p.reviewed));
  R.ok(badDate.length === 0, 'every row renders a parseable ISO review date',
    badDate.map((p) => `${p.country}: ${p.reviewed}`).join(', '));

  const today = new Date().toISOString().slice(0, 10);
  const future = panels.filter((p) => p.reviewed && p.reviewed > today);
  R.ok(future.length === 0, `no review date is in the future (today ${today})`,
    future.map((p) => `${p.country}: ${p.reviewed}`).join(', '));

  // THE FABRICATED-REVIEW CHECK. Stamping build-day on 21 rows nobody re-verified
  // is the defect this whole field exists to refuse, and it is textually
  // indistinguishable from an honest date — only the DISTRIBUTION gives it away.
  const stampedToday = panels.filter((p) => p.reviewed === today);
  R.ok(stampedToday.length < panels.length,
    `not every row claims to have been reviewed today — a uniform build-date stamp is a fabricated review (${stampedToday.length}/${panels.length})`);

  const dm = panels.filter((p) => SRC_ROWS.get(p.country)?.reviewed !== p.reviewed);
  R.ok(dm.length === 0, 'each rendered date is the one data.ts declares',
    dm.map((p) => `${p.country}: ${p.reviewed} vs ${SRC_ROWS.get(p.country)?.reviewed}`).join(', '));

  // The LABEL must not overclaim. "reviewed"/"verified" asserts a human checked
  // the law that day; what the date actually proves is when the text was written.
  const overclaim = panels.filter((p) => /\b(verified|re-?verified|checked against)\b/i.test(p.reviewedText));
  R.ok(overclaim.length === 0,
    'no row claims its note was VERIFIED on that date — only that it was last updated',
    overclaim.map((p) => `${p.country}: "${p.reviewedText}"`).join(', '));
  const saysUpdated = panels.filter((p) => /last updated/i.test(p.reviewedText));
  R.ok(saysUpdated.length === panels.length,
    `every row says "last updated" (${saysUpdated.length}/${panels.length}) — the paired positive control for the assertion above`);

  // The page-level line RECOMPUTES from the rows, the file's own idiom.
  const rangeAttr = await page.getAttribute('[data-lg-review-range]', 'data-lg-review-range');
  const dates = panels.map((p) => p.reviewed).filter(Boolean).sort();
  const wantRange = `${dates[0]}|${dates[dates.length - 1]}`;
  R.ok(rangeAttr === wantRange,
    `the page-level oldest/newest line recomputes from the rendered rows (${rangeAttr} vs ${wantRange})`);
  const rangeText = (await page.textContent('[data-lg-review-range]')) ?? '';
  R.ok(dates[0] !== dates[dates.length - 1],
    `the rows do NOT all share one date, so the range line is a real range (${wantRange})`);
  R.ok(rangeText.includes(dates[0]) && rangeText.includes(dates[dates.length - 1]),
    'the range line PRINTS both endpoints it claims');
  R.ok(/not a re-?verification/i.test(rangeText),
    'the range line says plainly that these are not re-verification dates',
    rangeText.trim());

  R.group('── §D · the status channel survives greyscale ──────────────');

  const marks = await page.evaluate(() => {
    const seen = {};
    for (const chip of document.querySelectorAll('.lg-acts > *, .lg-act-row dd > *')) {
      const shape = chip.querySelector('[data-status-shape]')?.getAttribute('data-status-shape') ?? null;
      // The visible status word is the LAST text node of the chip; the sr-only
      // prefix is a separate element, so textContent alone would merge them.
      const word = (chip.childNodes[chip.childNodes.length - 1]?.textContent ?? '').trim();
      if (!word) continue;
      seen[word] = seen[word] ?? new Set();
      if (shape) seen[word].add(shape);
    }
    return Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, [...v]]));
  });

  // DERIVED from data.ts, not a literal 4: however many distinct statuses the
  // matrix actually contains is how many distinct words it must render.
  const srcStatuses = new Set([...SRC_ROWS.values()].flatMap((v) => v.statuses));
  const words = Object.keys(marks);
  R.ok(srcStatuses.size >= 2, `data.ts uses ${srcStatuses.size} distinct statuses — the floor for the checks below`);
  R.ok(words.length === srcStatuses.size,
    `the matrix renders one WORD per distinct status, a channel that survives greyscale (${words.length} of ${srcStatuses.size}: ${words.join(', ')})`);
  const oneShapeEach = words.filter((w) => marks[w].length !== 1);
  R.ok(oneShapeEach.length === 0, 'each status word maps to exactly one shape',
    oneShapeEach.map((w) => `${w}: ${marks[w]}`).join('; '));
  const shapes = new Set(words.map((w) => marks[w][0]));
  R.ok(shapes.size === words.length,
    `the shapes are DISTINCT per status, so hue is never the only channel (${[...shapes].join(', ')})`);

  // The greyscale render check: with colour removed, two statuses must still be
  // told apart. Word and shape are both hue-free, so the pair is the proof.
  const pairs = new Set(words.map((w) => `${w}/${marks[w][0]}`));
  R.ok(pairs.size === words.length,
    `every status is uniquely identified by (word, shape) with no colour at all — ${[...pairs].join(' · ')}`);

  await page.context().close();
}

// ── §E · 320px reflow (WCAG 2.2 AA 1.4.10 / 400% zoom) ───────────────────────
{
  R.group('── §E · 320px reflow — no horizontal scroll ────────────────');
  const page = await newThemedPage(browser, { width: 320, height: 844 }, 'indigo');
  await page.goto(BASE + ROUTE, { waitUntil: 'networkidle' });
  await page.waitForSelector('.lg-row', { timeout: 10_000 });

  const before = await page.evaluate(() => ({
    rows: document.querySelectorAll('.lg-row').length,
    docW: document.documentElement.scrollWidth,
    winW: window.innerWidth,
  }));
  // Non-vacuity first: a page that rendered nothing also has no overflow.
  R.ok(before.rows === 21, `21 rows render at 320px (got ${before.rows})`);
  R.ok(before.docW - before.winW <= 2,
    `no horizontal scroll at 320px, collapsed (doc ${before.docW} vs win ${before.winW})`);

  // And expanded — the citation chips are the widest new content on the page,
  // so the closed state is the easy case and proves the less interesting half.
  await page.click('.lg-row');
  await page.waitForSelector('.lg-panel', { timeout: 5_000 });
  const after = await page.evaluate(() => {
    const panel = document.querySelector('.lg-panel');
    const chips = [...panel.querySelectorAll('[data-lg-source]')];
    return {
      chips: chips.length,
      docW: document.documentElement.scrollWidth,
      winW: window.innerWidth,
      overflowing: chips.filter((c) => c.getBoundingClientRect().right > window.innerWidth + 0.5).length,
    };
  });
  R.ok(after.chips > 0, `the expanded panel renders its source chips at 320px (${after.chips})`);
  R.ok(after.docW - after.winW <= 2,
    `no horizontal scroll at 320px with a panel OPEN (doc ${after.docW} vs win ${after.winW})`);
  R.ok(after.overflowing === 0, 'no source chip is clipped at the right edge at 320px');

  /* ── NAME THE ERROR THE THREE ASSERTIONS ABOVE CANNOT SEE ─────────────────
     They are nearly UNFALSIFIABLE at this width, and that was measured rather
     than suspected. At <=768px `styles.css:2798` applies
     `.main *, .proto-body * { min-width: 0 !important }` to every descendant,
     and `!important` in an author sheet beats an inline declaration — so a chip
     given `style={{minWidth:900}}` renders at its natural 74px. On top of that
     `.art` and `body` are `overflow-x: clip`, so `documentElement.scrollWidth`
     CANNOT exceed the viewport whatever a child does.
     A break test proved it: a chip forced to 900px at a 320px viewport left all
     three green, with the mutation confirmed present in the built chunk. The
     class they are blind to is therefore "content CLIPPED rather than fitted",
     which is exactly the shape CLAUDE.md's tolerance rule describes — the
     detectable-error bound, not a safety margin.
     They are kept because they would still catch the removal of that clip. What
     follows is the assertion with content: a chip's own box must not clip its own
     text. `.v6-res` sets no `white-space`, so a long label WRAPS; the failure this
     detects is a future `nowrap` (or a fixed width) making a citation unreadable
     at the narrowest supported viewport, which no document-level check can see. */
  const clip = await page.evaluate(() => {
    const chips = [...document.querySelectorAll('.lg-panel [data-lg-source]')];
    return {
      n: chips.length,
      clipped: chips.filter((c) => c.scrollWidth > c.clientWidth + 1)
        .map((c) => `${c.textContent.trim().slice(0, 28)} (${c.scrollWidth} > ${c.clientWidth})`),
      widest: Math.max(...chips.map((c) => c.scrollWidth)),
      panelW: Math.round(document.querySelector('.lg-panel').clientWidth),
    };
  });
  R.ok(clip.n > 0, `${clip.n} chip(s) measured for self-clipping — the floor for the check below`);
  R.ok(clip.clipped.length === 0,
    `no citation chip clips its own label at 320px (widest content ${clip.widest}px in a ${clip.panelW}px panel)`,
    clip.clipped.join(', '));

  await page.context().close();
}

await browser.close();
process.exit(R.finish());
