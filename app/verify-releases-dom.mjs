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
//   §8 cross-served     — p4·03: the endpoint answered as a DIFFERENT source
//   §9 the two tiers    — the PR spine and the commit log, divided not merged
//   §10 the scroll box  — bounded, and reserved from first paint (CLS)
//   §11 PR bodies       — the disclosure, and the truncation marker
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
//     REAL pulls response correctly is api/_tests/verify-releases-pipe.mjs's
//     job, against a fixture shaped from the real endpoint.
//   — The STORE. Upstash is equally unreachable; that the serving function
//     discriminates its four store states is the pipe gate's job, offline.
//   — Whether the deployed function is the one in this repo. That is the
//     defect `rev` exists to make ASKABLE, and only a live probe answers it.
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
  { v: '#186', note: 'p3·17 — sources release notes', date: '2026-08-16', url: 'https://github.com/aqua-019/satoshis-vision-v1/pull/186',
    body: 'THE BODY OF ONE EIGHT SIX.\nA second line, so pre-wrap is exercised.', bodyTruncated: false },
  { v: '#185', note: 'p3·16 — the Superstress hub', date: '2026-08-16', url: 'https://github.com/aqua-019/satoshis-vision-v1/pull/185',
    body: 'THE BODY OF ONE EIGHT FIVE, cut short by the server.', bodyTruncated: true },
  /* Deliberately BODYLESS. A PR can ship with an empty description, and the
     render must give it a flat row rather than a disclosure that opens onto
     nothing — §11 asserts exactly that, and without this row the assertion
     would have no negative case to stand on. */
  { v: '#184', note: 'p3·15 — Superbrain as 4th trusted peer', date: '2026-08-16', url: 'https://github.com/aqua-019/satoshis-vision-v1/pull/184',
    body: '', bodyTruncated: false },
];

/* The work-log tier. Two entries is enough to prove the list renders and is
   COUNTED separately from the spine; the transform that produces it (merge
   commits dropped by parent count) is unit-gated offline. */
const COMMITS = [
  { sha: 'aaaaaaaaaaaaaaaa', short: 'aaaaaaa', note: 'feat(ledger): the first work-log line', date: '2026-08-17', url: 'https://github.com/aqua-019/satoshis-vision-v1/commit/aaaaaaa' },
  { sha: 'bbbbbbbbbbbbbbbb', short: 'bbbbbbb', note: 'fix(ledger): the second work-log line', date: '2026-08-17', url: 'https://github.com/aqua-019/satoshis-vision-v1/commit/bbbbbbb' },
];

/* The envelope api/releases.js emits. `rev` and `source` are the two echoes the
   client validates; §8 drives the mismatch by changing `source` alone. */
/* polledAt is deliberately SEVEN DAYS older than fetchedAt. The two fields
   answer different questions — when the DATA was gathered vs when the RESPONSE
   was built — and a render sourced from the wrong one is only detectable if
   they differ measurably. §12 asserts the rendered age tracks the older. */
const POLLED_AT = '2026-08-10T00:00:00Z';
const FETCHED_AT = '2026-08-17T00:00:00Z';
function ledgerBody({ items, commits = COMMITS, source = 'ledger', store = 'live', polledAt = POLLED_AT }) {
  return JSON.stringify({
    rev: 1, source, repo: 'aqua-019/satoshis-vision-v1',
    fetchedAt: FETCHED_AT, polledAt,
    store, bodyCap: 2000,
    counts: { pulls: items.length, commits: commits.length },
    pulls: items, commits,
  });
}

/* `scripts/serve-dist.mjs` answers an unrouted /api/* with 501 + JSON, so a
   gate that loads /sources without the status fixture is testing an error
   response and calling it a page (verify-fixtures.mjs's own header). */
async function mount(ctx, { items, commits, failFeeds, crossServed, store }) {
  await ctx.route('**/api/status*', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(STATUS_FIXTURE) }));
  /* p4·03: the release surface moved off /api/feeds onto its own function at
     its own route. The old path is left mocked-and-aborted below rather than
     unmocked, so if anything on this page silently reaches for it again the
     request fails loudly instead of hitting serve-dist's 501. */
  await ctx.route('**/api/releases*', (r) =>
    failFeeds
      ? r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"upstream"}' })
      : r.fulfill({
          status: 200, contentType: 'application/json',
          body: ledgerBody({
            items,
            commits: commits ?? COMMITS,
            /* THE CROSS-SERVED POLARITY. Everything else about this response is
               well-formed — 200, valid JSON, a full payload. ONLY `source`
               differs, which is precisely the production failure: a deployment
               answering a question nobody asked, indistinguishable from an
               empty feed unless the client checks the echo. */
            source: crossServed ? 'getmonero' : 'ledger',
            store: store ?? 'live',
          }),
        }));
  for (const glob of ['**/api/xmr**', '**/api/nodes*', '**/api/coingecko*', '**/api/markets*', '**/api/feeds*']) {
    await ctx.route(glob, (r) => r.abort());
  }
}

/* One read, used by every section, so no section can quietly measure a
   different thing from its neighbour. */
async function readSection(page) {
  return page.evaluate(() => {
    const sec = document.querySelector('#release-notes');
    if (!sec) return null;
    /* Stable hooks, not a style-substring match. A release entry renders as a
       Disclosure when it has a body and as a flat grid row when it does not, so
       one selector has to cover both shapes — and the old
       `div[style*="92px 1fr"]` would now ALSO sweep up every commit row, which
       would silently inflate the spine count this gate's §1 depends on. */
    const rows = [...sec.querySelectorAll('[data-disclosure], [data-release-row]')];
    const seam = sec.querySelector('[data-release-seam]');
    const kids = [...sec.querySelectorAll('[data-release-seam], [data-disclosure], [data-release-row]')];
    const scroller = sec.querySelector('[data-release-scroll]');
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
      mismatchBox: sec.querySelector('[data-release-feed="mismatch"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
      polled: sec.querySelector('[data-ledger-polled]')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
      commitCount: sec.querySelectorAll('[data-release-commit]').length,
      tierDivider: sec.querySelector('[data-release-tier="commits"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
      disclosures: [...sec.querySelectorAll('[data-disclosure]')].map((d) => d.getAttribute('data-disclosure')),
      openBodies: [...sec.querySelectorAll('[data-release-body]')]
        .filter((b) => b.closest('.disc-panel') && !b.closest('.disc-panel').hasAttribute('hidden'))
        .map((b) => b.getAttribute('data-release-body')),
      truncMarks: [...sec.querySelectorAll('[data-release-truncated]')].map((t) => t.getAttribute('data-release-truncated')),
      scroll: scroller ? {
        clientH: scroller.clientHeight,
        scrollH: scroller.scrollHeight,
        overflowY: getComputedStyle(scroller).overflowY,
        overscroll: getComputedStyle(scroller).overscrollBehaviorY,
      } : null,
      seamText: seam ? seam.textContent.replace(/\s+/g, ' ').trim() : null,
      seamIndex: seam ? kids.indexOf(seam) : -1,
      sub11: small,
      hScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}

async function load(browser, { items, commits, failFeeds, crossServed, store, width = 1440, height = 1200, reducedMotion = 'no-preference' }) {
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion, deviceScaleFactor: 1 });
  await mount(ctx, { items, commits, failFeeds, crossServed, store });
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
  R.ok(s.status === `${PULLS.length} pull requests · ${COMMITS.length} commits`,
    `§1 · the header counts BOTH tiers from the feed, not the rendered rows (got "${s.status}")`);
  // The header must count the auto entries (3), not the rendered rows (8). If
  // those two numbers were equal the assertion above would pass either way.
  R.ok(!s.status.includes(String(s.rowCount)),
    `§1 · the header's count is the feed's, not the row count — ${PULLS.length} ≠ ${s.rowCount}, so the two readings are distinguishable`);
  R.ok(s.emptyBox === null, '§1 · no empty-feed notice when the feed produced entries');
  await ctx.close();
}

/* ── §2 · empty feed — THE DEFECT THIS GATE EXISTS FOR ────────────────── */
{
  const { ctx, page } = await load(browser, { items: [], commits: [], store: 'empty' });
  const s = await readSection(page);
  R.ok(s.rowCount === 5, `§2 · the curated archive still renders (got ${s.rowCount} rows)`);
  // The regression, stated as the thing that must never be true again: a header
  // claiming a count while rows are on screen.
  R.ok(!/\b0 releases\b/.test(s.status),
    `§2 · the header does NOT claim "0 releases" — got "${s.status}"`);
  R.ok(!/pull requests ·/.test(s.status),
    '§2 · the header does not attribute the rendered rows to the automatic feed, which produced none of them');
  R.ok(/curated archive/.test(s.status),
    `§2 · the header names what is actually on screen: the curated archive (got "${s.status}")`);
  R.ok(s.emptyBox !== null && /the store holds no ledger yet/.test(s.emptyBox),
    '§2 · the honest-empty notice renders, in the house vocabulary');
  R.ok(s.emptyBox !== null && /\/api\/releases\?src=ledger/.test(s.emptyBox),
    '§2 · the notice names the endpoint that answered, per FeedEmpty\'s idiom');
  R.ok(s.mismatchBox === null,
    '§2 · an EMPTY store is not reported as a cross-served one — the two notices are different claims');
  R.ok(s.commitCount === 0 && s.tierDivider === null,
    '§2 · no commit tier and no divider when the ledger carried no commits — an empty heading announces a section that is not there');
  await ctx.close();
}

/* ── §3 · failed feed — a DIFFERENT state, not a synonym for empty ────── */
{
  const { ctx, page } = await load(browser, { items: [], failFeeds: true });
  const s = await readSection(page);
  R.ok(s.rowCount === 5, `§3 · last-good curated archive renders on a dead upstream (got ${s.rowCount})`);
  R.ok(/\/api\/releases unreachable/.test(s.status),
    `§3 · an unreachable upstream says so, and NAMES the endpoint (got "${s.status}")`);
  // The pair that makes §2 and §3 non-vacuous: two distinct upstream conditions
  // must produce two distinct labels. A single "something went wrong" string
  // would pass both /curated archive/ checks and tell a reader nothing.
  R.ok(!/holds no ledger/.test(s.status),
    '§3 · "unreachable" is not reported as "answered with nothing" — the two states read differently');
  R.ok(s.mismatchBox === null,
    '§3 · nor as cross-served — all three failure modes read differently');
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

/* ── §8 · CROSS-SERVED — the state this whole PR exists for ───────────── */
{
  /* The envelope is 200, well-formed, and FULL. Only `source` is wrong. That
     is the exact production failure: /api/feeds answered every src as
     `getmonero`, with a fresh `fetchedAt`, and the page rendered a silent
     empty list for roughly two weeks because "answered with nothing I can use"
     and "is not running this code" were the same event to the client. */
  const { ctx, page } = await load(browser, { items: PULLS, crossServed: true });
  const s = await readSection(page);
  R.ok(s.mismatchBox !== null,
    '§8 · a cross-served envelope renders its OWN named notice, not a silent empty');
  R.ok(s.mismatchBox !== null && /different source/.test(s.mismatchBox),
    `§8 · the notice says what happened (got "${s.mismatchBox}")`);
  R.ok(s.mismatchBox !== null && /deployment issue/.test(s.mismatchBox),
    '§8 · and names the cause as a deployment issue, not an empty history');
  R.ok(s.mismatchBox !== null && /\/api\/releases\?src=ledger/.test(s.mismatchBox),
    '§8 · and names the endpoint, per FeedEmpty\'s idiom');
  R.ok(/cross-served/.test(s.status),
    `§8 · the header agrees with the body — both report the mismatch (got "${s.status}")`);
  R.ok(s.emptyBox === null,
    '§8 · the answered-empty notice does NOT also render — one state, one notice');

  /* THE PAYLOAD MUST BE REFUSED, NOT MERELY ANNOTATED. A page that warned
     about the mismatch and then rendered the untrusted rows anyway would be
     worse than one that said nothing, because the warning would make the data
     look vetted. The cross-served pulls (#186/#185/#184) must NOT appear. */
  R.ok(!s.ids.includes('#186'),
    `§8 · the cross-served payload is DISCARDED, not displayed with a warning over it (ids: ${s.ids.join(',') || 'none'})`);
  R.ok(s.rowCount === 5,
    `§8 · what renders is the curated archive — the honest fallback (got ${s.rowCount} rows)`);
  R.ok(s.commitCount === 0,
    '§8 · and no commit tier is built from an envelope we do not trust');
  await ctx.close();
}
{
  /* THE POSITIVE CONTROL for §8. Without it, every assertion above is
     satisfied just as well by a page that shows the mismatch notice
     unconditionally — the notice would be decoration and the echo check
     unfalsifiable. Same payload, correct `source`. */
  const { ctx, page } = await load(browser, { items: PULLS });
  const s = await readSection(page);
  R.ok(s.mismatchBox === null,
    '§8 · a MATCHING envelope draws no mismatch notice — the check is falsifiable');
  R.ok(s.ids.includes('#186'),
    '§8 · and the very payload rejected above renders when the source echo agrees');
  await ctx.close();
}

/* ── §9 · the two tiers ───────────────────────────────────────────────── */
{
  const { ctx, page } = await load(browser, { items: PULLS });
  const s = await readSection(page);
  R.ok(s.commitCount === COMMITS.length,
    `§9 · every commit in the ledger renders (${s.commitCount} of ${COMMITS.length})`);
  R.ok(s.tierDivider !== null,
    '§9 · a divider separates the work log from the release spine');
  R.ok(s.tierDivider !== null && /work log/.test(s.tierDivider) && /what shipped/.test(s.tierDivider),
    '§9 · the divider says what each tier IS — two lists answering two questions');
  /* NEVER INTERLEAVED. Every spine row must precede every commit row in
     document order; a single merged list would fail this even while both
     counts were right. */
  const order = await page.evaluate(() => {
    const sec = document.querySelector('#release-notes');
    const all = [...sec.querySelectorAll('[data-disclosure], [data-release-row], [data-release-commit]')];
    return all.map((el) => (el.hasAttribute('data-release-commit') ? 'c' : 'r')).join('');
  });
  R.ok(/^r+c+$/.test(order),
    `§9 · the tiers are contiguous and ordered spine-then-log, never interleaved (${order})`);
  await ctx.close();
}

/* ── §10 · the scroll region ──────────────────────────────────────────── */
{
  const { ctx, page } = await load(browser, { items: PULLS });
  const s = await readSection(page);
  R.ok(s.scroll !== null, '§10 · the history renders inside a bounded scroll region');
  R.ok(s.scroll !== null && s.scroll.overflowY === 'auto',
    `§10 · it scrolls its own content (overflow-y: ${s.scroll?.overflowY})`);
  R.ok(s.scroll !== null && s.scroll.overscroll === 'contain',
    `§10 · overscroll is contained, so reaching the end does not scroll the page (${s.scroll?.overscroll})`);
  R.ok(s.scroll !== null && s.scroll.clientH > 0 && s.scroll.clientH <= 640,
    `§10 · the box is bounded and capped (${s.scroll?.clientH}px <= 640)`);
  /* The box must be SHORTER than its content, or "it scrolls" is a claim
     about a box that never needed to. */
  R.ok(s.scroll !== null && s.scroll.scrollH > s.scroll.clientH,
    `§10 · the content genuinely overflows it (${s.scroll?.scrollH} > ${s.scroll?.clientH}) — the bound is doing work`);
  R.ok(s.hScroll <= 0, `§10 · and the page itself gains no horizontal scroll (${s.hScroll}px)`);
  await ctx.close();
}
{
  /* CLS: the reserved height must be IDENTICAL before and after the payload
     lands, because this section is the last thing on a page about
     trustworthiness and a late reflow shifts everything under it. Measured by
     holding the response open, reading the box, then releasing it. */
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 1 });
  await ctx.route('**/api/status*', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(STATUS_FIXTURE) }));
  let release;
  const held = new Promise((res) => { release = res; });
  await ctx.route('**/api/releases*', async (r) => {
    await held;
    await r.fulfill({ status: 200, contentType: 'application/json', body: ledgerBody({ items: PULLS }) });
  });
  for (const glob of ['**/api/xmr**', '**/api/nodes*', '**/api/coingecko*', '**/api/markets*', '**/api/feeds*']) {
    await ctx.route(glob, (r) => r.abort());
  }
  const page = await ctx.newPage();
  await page.goto(`${BASE}/about/sources`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-release-scroll]', { timeout: 20000 });
  const before = await page.evaluate(() => document.querySelector('[data-release-scroll]').getBoundingClientRect().height);
  release();
  await page.waitForFunction(() => {
    const sec = document.querySelector('#release-notes');
    const label = sec?.querySelector('.kicker')?.parentElement?.querySelector('span.mono')?.textContent ?? '';
    return sec && !/fetching/i.test(label);
  }, { timeout: 20000 });
  const after = await page.evaluate(() => document.querySelector('[data-release-scroll]').getBoundingClientRect().height);
  R.ok(before > 0, `§10 · the scroll box reserves its height BEFORE the ledger arrives (${before}px)`);
  R.ok(Math.abs(after - before) < 1,
    `§10 · and does not resize when it lands (${before}px -> ${after}px) — no reflow of the sections below`);
  await ctx.close();
}

/* ── §11 · PR bodies ──────────────────────────────────────────────────── */
{
  const { ctx, page } = await load(browser, { items: PULLS });
  const s = await readSection(page);
  /* Two of the three fixture PRs carry a body; #184 is deliberately bodyless.
     A disclosure that opens onto nothing is a control that lies about having
     content behind it. */
  R.ok(s.disclosures.length === 2 && !s.disclosures.includes('#184'),
    `§11 · only entries WITH a body get a disclosure (${s.disclosures.join(',')}) — #184 is bodyless and renders flat`);
  R.ok(s.openBodies.length === 0, '§11 · every body starts collapsed');

  /* CLICK THROUGH PLAYWRIGHT AND WAIT FOR THE COMMIT, never click-and-read in
     one page.evaluate. `Disclosure` is controlled by React state, so the DOM
     does not change in the same synchronous tick as the click — an
     evaluate that clicks and then reads measures the PREVIOUS render. The
     first version of this section did exactly that and reported "opening one
     reveals its panel" as red against a component that works, while the
     NEXT section's read showed the first panel open (the earlier click having
     landed by then). Two reds, one cause, and the cause was the instrument. */
  await page.click('[data-disclosure="#186"] button.disc-row');
  await page.waitForFunction(
    () => !document.querySelector('[data-disclosure="#186"] .disc-panel').hasAttribute('hidden'),
    { timeout: 5000 });
  const first = await page.evaluate(() => {
    const btn = document.querySelector('[data-disclosure="#186"] button.disc-row');
    const panel = document.querySelector('[data-disclosure="#186"] .disc-panel');
    return {
      expanded: btn.getAttribute('aria-expanded'),
      hidden: panel.hasAttribute('hidden'),
      text: panel.textContent.replace(/\s+/g, ' ').trim(),
      controls: btn.getAttribute('aria-controls'),
      resolves: !!document.getElementById(btn.getAttribute('aria-controls')),
    };
  });
  R.ok(first.expanded === 'true' && first.hidden === false, '§11 · opening one reveals its panel');
  R.ok(/THE BODY OF ONE EIGHT SIX/.test(first.text),
    '§11 · the PR BODY is the summary — rendered verbatim from the feed, never client-generated');
  R.ok(first.resolves, '§11 · aria-controls resolves to a real element');

  /* SINGLE-OPEN, and it is asserted by OPENING THE OTHER rather than by
     reading state: the contract is that a second open closes the first. */
  await page.click('[data-disclosure="#185"] button.disc-row');
  await page.waitForFunction(
    () => !document.querySelector('[data-disclosure="#185"] .disc-panel').hasAttribute('hidden'),
    { timeout: 5000 });
  const second = await page.evaluate(() => {
    return [...document.querySelectorAll('[data-disclosure]')].map((d) => ({
      id: d.getAttribute('data-disclosure'),
      open: !d.querySelector('.disc-panel').hasAttribute('hidden'),
    }));
  });
  R.ok(second.filter((d) => d.open).length === 1 && second.find((d) => d.id === '#185').open,
    `§11 · opening a second entry closes the first (${second.map((d) => d.id + ':' + d.open).join(' ')})`);

  /* The truncation marker is a SERVER fact echoed to the reader. #185 is
     flagged truncated, #186 is not — so the marker's presence discriminates. */
  R.ok(s.truncMarks.length === 1 && s.truncMarks[0] === '#185',
    `§11 · only the truncated body carries the marker (${s.truncMarks.join(',') || 'none'})`);
  const trunc = await page.evaluate(() =>
    document.querySelector('[data-release-truncated="#185"]').textContent.replace(/\s+/g, ' ').trim());
  R.ok(/truncated at 2000 characters/.test(trunc),
    `§11 · and it states the cap the server advertised, not a vague hedge (got "${trunc}")`);
  R.ok(/read the rest on GitHub/.test(trunc),
    '§11 · and points at the full text rather than stopping at the apology');
  await ctx.close();
}

/* ── §12 · polledAt — the freshness claim is about the DATA ────────────── */
{
  const { ctx, page } = await load(browser, { items: PULLS });
  const s = await readSection(page);
  R.ok(s.polled !== null, '§12 · the section states when the ledger was last polled');
  R.ok(s.polled !== null && /Checked/.test(s.polled) && /rev 1/.test(s.polled),
    `§12 · and echoes the envelope revision, so a stale deployment is one glance away (got "${s.polled}")`);
  /* A `fetchedAt` here would read "seconds ago" on exactly the deployment whose
     DATA is two weeks old — which is the production failure restated as a
     freshness label. The two fixture stamps are 7 days apart, so the rendered
     age DISCRIMINATES: sourced from polledAt it is at least 7 days, sourced
     from fetchedAt it is at least 7 days LESS. Both expectations are computed
     here from the fixture and the real clock, so this is a comparison between
     two independent derivations rather than the render checked against itself. */
  const day = 86_400_000;
  const fromPolled = Math.floor((Date.now() - Date.parse(POLLED_AT)) / day);
  const fromFetched = Math.floor((Date.now() - Date.parse(FETCHED_AT)) / day);
  const shown = Number((/(\d+)d ago/.exec(s.polled || '') || [])[1] ?? NaN);
  R.ok(shown === fromPolled,
    `§12 · the age tracks polledAt (the DATA): shown ${shown}d, expected ${fromPolled}d`);
  R.ok(fromPolled !== fromFetched && shown !== fromFetched,
    `§12 · and NOT fetchedAt (the RESPONSE), which would read ${fromFetched}d — the two are 7 days apart so the reading discriminates`);
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
