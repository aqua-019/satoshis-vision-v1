// verify-releases-dom.mjs — DOM gate for the /about/sources release section.
//
// WHY A BROWSER GATE EXISTS FOR THIS AT ALL. `verify-releases.mjs` proves the
// pure functions (`mergeReleases`, `eraSeamIndex`, the staleness invariant) and
// cannot see the thing that actually shipped wrong: a HEADER STRING that
// contradicted the LIST underneath it. Measured on `bda0491`, with the upstream
// answering successfully and returning nothing — which is what it had done
// every day since July — the page rendered
//
//     "github commits · 0 releases"
//
// directly above five rendered release rows. The ternary had three branches for
// a four-state feed and an empty array is truthy, so the live state fell into
// the wrong one. Every offline assertion in the suite was green throughout.
//
// So this gate's subject is the RELATIONSHIP between the header and the body in
// each feed state — which is a rendered property and has no offline form.
//
// Sections:
//   §1 live feed        — PR-keyed rows render, header counts them, seam present
//   §2 empty feed       — the defect: header must not claim a count it is not showing
//   §3 failed feed      — "unreachable" is a DIFFERENT state from "answered empty"
//   §4 the era seam     — position, and its ABSENCE when only one era is present
//   §5 the topbar label — the other half of the two-stale-versions defect
//   §6 390px            — no h-scroll, no HTML text under the repo's 11px floor
//   §7 reduced motion   — the section renders, zero running animations
//
// COLD BOOT: this gate installs NO bypass, and that is verified rather than
// assumed — `verify-coldboot-live.mjs` §0 decides which gates must install one
// by testing five REACHES_HOME patterns against a gate's source. This file
// navigates only to /about/sources, names no route array, and imports no
// ROUTES, so it matches none of them. Adding a '/' navigation here without
// adding the bypass would make that gate red, which is the intended coupling.
//
// BLIND SPOTS, stated rather than left to be discovered:
//   — The LIVE upstream. api.github.com is unreachable from the sandbox and
//     from CI, so every feed payload here is a fixture. That `mapPulls` maps a
//     REAL pulls response correctly is api/verify-feeds.mjs's job, against a
//     fixture measured from the real endpoint.
//   — Colour hierarchy. The seam's colour was a real defect found by looking at
//     a render; no assertion here would have caught it.
//
// Run against serve-dist (NOT vite preview — see verify-future.mjs header).
//   npm run build && npm run wait-preview && node verify-releases-dom.mjs

import { launch } from './verify-lib.mjs';
import { makeReporter } from './verify-reporter.mjs';
import { STATUS_FIXTURE } from './verify-fixtures.mjs';

const BASE = 'http://localhost:4173';
const R = makeReporter('verify-releases-dom');

/* Three merged PRs, newest first — the shape api/feeds.js's `mapPulls` emits.
   Deliberately NOT five: the count has to be distinguishable from CURATED's
   five, or "header counts the auto entries" and "header counts the rendered
   rows" would agree by coincidence and §1 would prove neither. */
const PULLS = [
  { v: '#186', note: 'p3·17 — sources release notes', date: '2026-08-16', url: 'https://github.com/aqua-019/satoshis-vision-v1/pull/186' },
  { v: '#185', note: 'p3·16 — the Superstress hub', date: '2026-08-16', url: 'https://github.com/aqua-019/satoshis-vision-v1/pull/185' },
  { v: '#184', note: 'p3·15 — Superbrain as 4th trusted peer', date: '2026-08-16', url: 'https://github.com/aqua-019/satoshis-vision-v1/pull/184' },
];

/* `scripts/serve-dist.mjs` answers an unrouted /api/* with 501 + JSON, so a
   gate that loads /sources without the status fixture is testing an error
   response and calling it a page (verify-fixtures.mjs's own header). */
async function mount(ctx, { items, failFeeds }) {
  await ctx.route('**/api/status*', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(STATUS_FIXTURE) }));
  await ctx.route('**/api/feeds*', (r) =>
    failFeeds
      ? r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"upstream"}' })
      : r.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ source: 'pulls', fetchedAt: '2026-08-16T00:00:00Z', repo: 'aqua-019/satoshis-vision-v1', items }),
        }));
  for (const glob of ['**/api/xmr**', '**/api/nodes*', '**/api/coingecko*', '**/api/markets*']) {
    await ctx.route(glob, (r) => r.abort());
  }
}

/* One read, used by every section, so no section can quietly measure a
   different thing from its neighbour. */
async function readSection(page) {
  return page.evaluate(() => {
    const sec = document.querySelector('#release-notes');
    if (!sec) return null;
    const rows = [...sec.querySelectorAll('div[style*="92px 1fr"]')];
    const seam = sec.querySelector('[data-release-seam]');
    const kids = [...sec.querySelectorAll('[data-release-seam], div[style*="92px 1fr"]')];
    const small = [];
    for (const el of sec.querySelectorAll('*')) {
      if (!el.children.length && el.textContent.trim()) {
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs > 0 && fs < 11) small.push(`${el.tagName}.${el.className}@${fs}px`);
      }
    }
    return {
      status: sec.querySelector('.kicker')?.parentElement?.querySelector('span.mono')?.textContent?.trim() ?? null,
      ids: rows.map((r) => r.querySelector('.acc')?.textContent?.trim() ?? ''),
      rowCount: rows.length,
      emptyBox: sec.querySelector('[data-release-feed="empty"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
      seamText: seam ? seam.textContent.replace(/\s+/g, ' ').trim() : null,
      seamIndex: seam ? kids.indexOf(seam) : -1,
      sub11: small,
      hScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}

async function load(browser, { items, failFeeds, width = 1440, height = 1200, reducedMotion = 'no-preference' }) {
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion, deviceScaleFactor: 1 });
  await mount(ctx, { items, failFeeds });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/about/sources`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#release-notes', { timeout: 20000 });
  // Wait for the FEED to have settled, not merely for the section to exist —
  // otherwise a slow payload and a broken one are the same event, and the
  // assertions below would read a loading state and call it a verdict.
  await page.waitForFunction(() => {
    const sec = document.querySelector('#release-notes');
    const label = sec?.querySelector('.kicker')?.parentElement?.querySelector('span.mono')?.textContent ?? '';
    return sec && !/fetching/i.test(label);
  }, { timeout: 20000 });
  return { ctx, page };
}

const { browser, engine } = await launch();
R.info(`engine: ${engine}`);

/* ── §1 · live feed ───────────────────────────────────────────────────── */
{
  const { ctx, page } = await load(browser, { items: PULLS });
  const s = await readSection(page);
  R.ok(!!s, '§1 · the release section renders');
  R.ok(s.rowCount === PULLS.length + 5,
    `§1 · both eras render — ${PULLS.length} PR-keyed + 5 curated = ${PULLS.length + 5} rows (got ${s.rowCount})`);
  R.ok(s.ids.slice(0, 3).join(',') === '#186,#185,#184',
    `§1 · PR-keyed ids render newest-first and keep upstream order (got ${s.ids.slice(0, 3).join(',')})`);
  R.ok(s.status === `github pulls · ${PULLS.length} releases`,
    `§1 · the header counts the AUTO entries, and says which feed they came from (got "${s.status}")`);
  // The header must count the auto entries (3), not the rendered rows (8). If
  // those two numbers were equal the assertion above would pass either way.
  R.ok(!s.status.includes(String(s.rowCount)),
    `§1 · the header's count is the feed's, not the row count — ${PULLS.length} ≠ ${s.rowCount}, so the two readings are distinguishable`);
  R.ok(s.emptyBox === null, '§1 · no empty-feed notice when the feed produced entries');
  await ctx.close();
}

/* ── §2 · empty feed — THE DEFECT THIS GATE EXISTS FOR ────────────────── */
{
  const { ctx, page } = await load(browser, { items: [] });
  const s = await readSection(page);
  R.ok(s.rowCount === 5, `§2 · the curated archive still renders (got ${s.rowCount} rows)`);
  // The regression, stated as the thing that must never be true again: a header
  // claiming a count while rows are on screen.
  R.ok(!/\b0 releases\b/.test(s.status),
    `§2 · the header does NOT claim "0 releases" — got "${s.status}"`);
  R.ok(!/^github /.test(s.status),
    '§2 · the header does not attribute the rendered rows to the automatic feed, which produced none of them');
  R.ok(/curated archive/.test(s.status),
    `§2 · the header names what is actually on screen: the curated archive (got "${s.status}")`);
  R.ok(s.emptyBox !== null && /returned no merged pull requests/.test(s.emptyBox),
    '§2 · the honest-empty notice renders, in the house vocabulary');
  R.ok(s.emptyBox !== null && /\/api\/feeds\?src=pulls/.test(s.emptyBox),
    '§2 · the notice names the endpoint that answered, per FeedEmpty\'s idiom');
  await ctx.close();
}

/* ── §3 · failed feed — a DIFFERENT state, not a synonym for empty ────── */
{
  const { ctx, page } = await load(browser, { items: [], failFeeds: true });
  const s = await readSection(page);
  R.ok(s.rowCount === 5, `§3 · last-good curated archive renders on a dead upstream (got ${s.rowCount})`);
  R.ok(/github unreachable/.test(s.status),
    `§3 · an unreachable upstream says so (got "${s.status}")`);
  // The pair that makes §2 and §3 non-vacuous: two distinct upstream conditions
  // must produce two distinct labels. A single "something went wrong" string
  // would pass both /curated archive/ checks and tell a reader nothing.
  R.ok(!/no merged pull requests/.test(s.status),
    '§3 · "unreachable" is not reported as "answered with nothing" — the two states read differently');
  R.ok(s.emptyBox === null,
    '§3 · the answered-empty notice does NOT render when the endpoint never answered');
  await ctx.close();
}

/* ── §4 · the era seam ────────────────────────────────────────────────── */
{
  const { ctx, page } = await load(browser, { items: PULLS });
  const s = await readSection(page);
  R.ok(s.seamText !== null, '§4 · the era seam renders when both eras are present');
  R.ok(s.seamIndex === PULLS.length,
    `§4 · the seam sits immediately after the last PR-keyed row (index ${s.seamIndex}, expected ${PULLS.length})`);
  R.ok(s.seamText !== null && /keyed by pull request/.test(s.seamText) && /keyed by version/.test(s.seamText),
    '§4 · the seam names BOTH eras, so the discontinuity is explained rather than implied');
  R.ok(s.seamText !== null && /not listed here/.test(s.seamText),
    '§4 · the seam says the releases between are missing — mergeReleases dedupes but does not detect gaps');
  await ctx.close();
}
{
  // The absence half. A divider that renders unconditionally is decoration; this
  // one is a claim, and a claim that is always made is not checkable.
  const { ctx, page } = await load(browser, { items: [] });
  const s = await readSection(page);
  R.ok(s.seamText === null,
    '§4 · NO seam is drawn on a single-era list — there is no discontinuity to announce');
  await ctx.close();
}

/* ── §5 · the topbar label, the other half of the defect ──────────────── */
{
  const { ctx, page } = await load(browser, { items: PULLS });
  const label = await page.evaluate(() => {
    const a = [...document.querySelectorAll('a.kicker')].find((x) => /\/about\/sources#release-notes$/.test(x.getAttribute('href') || ''));
    return a ? { text: a.textContent.trim(), href: a.getAttribute('href') } : null;
  });
  R.ok(label !== null, '§5 · the topbar version label renders and links to #release-notes');
  R.ok(label !== null && /^v\d+ · #\d+$/.test(label.text),
    `§5 · the label is PR-keyed, not a stale semver (got "${label?.text}")`);
  // The two-stale-versions defect was that these two surfaces disagreed. Assert
  // they agree, by reading BOTH from the DOM rather than either from source.
  const s = await readSection(page);
  const labelPr = label ? label.text.replace(/^.*#/, '') : '';
  R.ok(s.ids.includes(`#${labelPr}`) || Number(labelPr) >= Number((s.ids[0] || '#0').slice(1)),
    `§5 · the label's PR (#${labelPr}) is not behind the newest release the page lists (${s.ids[0]})`);
  await ctx.close();
}

/* ── §6 · 390px ───────────────────────────────────────────────────────── */
{
  const { ctx, page } = await load(browser, { items: PULLS, width: 390, height: 844 });
  const s = await readSection(page);
  R.ok(s.hScroll <= 0, `§6 · no horizontal overflow at 390px (${s.hScroll}px)`);
  R.ok(s.rowCount === PULLS.length + 5, `§6 · every row still renders at 390px (got ${s.rowCount})`);
  R.ok(s.seamText !== null, '§6 · the seam survives the phone reflow');
  // 11, not 12: verify-legibility.mjs:124 records "floor raised 10.5 -> 11.
  // Nothing below 11 ships". A 12px floor reds four pre-existing routes.
  R.ok(s.sub11.length === 0, `§6 · no HTML text below the repo's 11px floor (${s.sub11.join(', ') || 'none'})`);
  await ctx.close();
}
{
  const { ctx, page } = await load(browser, { items: [], width: 390, height: 844 });
  const s = await readSection(page);
  R.ok(s.hScroll <= 0, `§6 · the empty-feed notice does not overflow at 390px (${s.hScroll}px)`);
  R.ok(s.emptyBox !== null, '§6 · the empty-feed notice renders at 390px');
  await ctx.close();
}

/* ── §7 · reduced motion ──────────────────────────────────────────────── */
{
  const { ctx, page } = await load(browser, { items: PULLS, reducedMotion: 'reduce' });
  const s = await readSection(page);
  const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length);
  R.ok(s.rowCount === PULLS.length + 5,
    `§7 · reduced motion suppresses ANIMATION, not CONTENT — all ${PULLS.length + 5} rows render (got ${s.rowCount})`);
  R.ok(s.seamText !== null, '§7 · the seam renders under reduced motion');
  R.ok(running === 0, `§7 · zero running animations under reduced motion (got ${running})`);
  await ctx.close();
}

await browser.close();
/* `makeReporter().finish()` RETURNS an exit code, it does not call
   process.exit — so a bare `R.finish();` prints "❌ FAILURES" and then exits 0.
   In an `&&` chain that is a gate which cannot fail a build: every assertion
   above could go red and `verify:e2e` would carry on to the next member and
   report success.

   The first version of this file did exactly that. It was caught by the break
   test asserting on the EXIT CODE rather than on the presence of a ❌, and a
   sweep then showed this was the only bare `R.finish();` in the suite — all
   50+ other reporter-based gates already do `process.exit(R.finish())`.
   Reviewing the assertions would never have found it; every one of them was
   correct and correctly red. */
process.exit(R.finish());
