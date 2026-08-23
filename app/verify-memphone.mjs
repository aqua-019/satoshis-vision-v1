// verify-memphone.mjs — p4·M8 · the classic mempool as a phone actually renders it.
//
// Sections:
//   §0  instrument floors — the fixture serves, the view mounts, the stage list is real
//   §1  the shared transaction table lays out as ROWS, in BOTH states it renders in
//   §2  exactly ONE horizontal scroller, and it is the block ladder — tracked and not
//   §3  zero page overflow
//   §4  the type floor inside the classic view
//   §5  the ladder opens on the NOW divider
//   §6  every tap target is a real target
//   §7  tapping a block reaches the reader, and dismissing puts them back
//   §8  say it once
//   §9  a header and its caption are not two columns
//   §10 the desktop composition is the control and does not move
//
// ── WHY EVERY PHONE STAGE RUNS AT dpr 1, 2 AND 3 ─────────────────────────
// p4·M7's root cause was a defect that did not exist at dpr 1 — `drawField`
// cleared in CSS pixels and drew in backing-store pixels, so at dpr 2 it
// repainted a quarter of the store and the other three quadrants accumulated.
// It shipped because headless Chromium's context default is dpr 1 and all 84
// gates ran there. A phone is dpr 2 or 3. Every assertion in §1-§9 therefore
// runs three times per width, and the dpr is printed in the label so a red
// names the ratio it failed at rather than leaving it to be rediscovered.
//
// This costs 15 contexts where 5 would do. That is the price of the class of
// bug the repo has already paid for once.
//
// ── NO COLD-BOOT BYPASS HERE, DELIBERATELY — do not "restore" it. ─────────
// verify-site, verify-peers, verify-superstress and verify-mine carry the same
// note. `coldboot/gate.ts`'s predicate ends `return pathname === R.HOME`, so
// the splash structurally cannot reach `/live/mempool`. This gate names no
// R.HOME, holds no array containing '/', and never navigates to the root.
// Installing a bypass it does not need reds verify-coldboot-live §0 with
// "DETECTOR STALE".
//
// ── WHAT THIS GATE CANNOT SEE (stated, not hidden) ───────────────────────
//   — Whether the composition is GOOD. It proves the table is a table, the
//     ladder opens where a reader wants it and nothing overflows. It cannot
//     tell a legible phone page from an ugly one; that was done by rendering
//     at 320 and 390 and looking.
//   — The LIVE feed face beyond this fixture. It mocks /api/** because
//     serve-dist answers 501, so every figure here is the fixture's. That is
//     the right trade for LAYOUT — the geometry is driven by a 240-tx pool and
//     12 blocks, which is a realistic worst case — and it is why §0 asserts the
//     pool actually arrived rather than measuring an empty page.
//   — WebKit. verify-lib prefers it and falls through to Chromium in this
//     sandbox and in CI, so the iOS engine is unmeasured here as everywhere.
//   — Whether `size` / `in/out` being absent from the phone table is the right
//     editorial call. §1 asserts they are absent BY DESIGN and that the four
//     that remain render; it cannot judge the choice.

import { launchChromium, makeReporter } from './verify-lib.mjs';

const BASE = process.env.VERIFY_BASE || 'http://localhost:4173';
const R = makeReporter('verify-memphone');
const URL_CLASSIC = `${BASE}/live/mempool?v=classic`;

/* ── the phone stages ─────────────────────────────────────────────────────
   320 is this repo's narrowest gated width (iPhone SE); 430 its widest phone.
   414 and 360 are the two most common in between. Each runs at dpr 1, 2 and 3
   — 1 is the control that proves a dpr-2/3 red is about the RATIO and not the
   width, which is the pair p4·M7 found it needed and did not have. */
const WIDTHS = [
  { w: 320, h: 568 },
  { w: 360, h: 800 },
  { w: 390, h: 844 },
  { w: 414, h: 896 },
  { w: 430, h: 932 },
];
const DPRS = [1, 2, 3];
const STAGES = WIDTHS.flatMap((s) => DPRS.map((dpr) => ({ ...s, dpr, tag: `${s.w}×${s.h}@${dpr}` })));

/** The floor the classic view holds on a phone. It is a RAISE above p4·02's
 *  site-wide 12px minimum (styles-legibility.css:194), not a restatement of it
 *  — verify-mobile §1 owns that one at 12 for all 18 routes. Stated as its own
 *  constant so a reader can see the two numbers are deliberately different. */
const CLASSIC_FLOOR = 13;
const EPS = 0.01;
/** WCAG 2.2 AA 2.5.8 is 24px; this repo runs 44 (verify-mobile's TAP_MIN). */
const TAP_MIN = 44;

/* ── fixtures ────────────────────────────────────────────────────────────
   Counter-derived, never Math.random — a gate that cannot reproduce its own
   failure is not a gate. Ages are RELATIVE offsets resolved at request time so
   the pool does not age between contexts. */
const H = 3_700_123;
const hex = (c) => c.repeat(64);
const POOL_N = 240;
const BLOCKS_N = 12;
const now = () => Math.floor(Date.now() / 1000);

const mkMempool = () => ({
  recent_txs: Array.from({ length: POOL_N }, (_, i) => ({
    txid: (i.toString(16).padStart(4, '0') + 'c3f9a1e7b5d2').repeat(6).slice(0, 64),
    blob_size: 1200 + (i * 37) % 2400,
    fee: 30_720_000 + i * 1000,
    fee_rate: 15_000 + (i * 8117) % 900_000,
    receive_time: now() - (5 + (i * 13) % 1750),
    ring_size: 16, input_count: 1 + (i % 3), output_count: 2,
  })),
  fee_histogram: [{ tx_count: POOL_N, bytes: 400000 }],
});
const mkNetwork = () => ({
  height: H + 1, difficulty: 7.7e11, hashrate_ghs: 6.42, tx_pool_size: POOL_N,
  tx_count_total: 61_236_904, block_weight_limit: 600000, block_weight_median: 300000,
  target_seconds: 120, top_block_hash: hex('b'), alt_blocks_count: 1,
  version: '0.18.3.4', major_version: 16, fee_tiers: [20000, 80000, 320000, 4000000],
  randomx_seed_hash: hex('c'), database_size: 284_500_000_000, synchronized: true,
  nettype: 'mainnet', adjusted_time: now(),
});
const mkBlocks = () => Array.from({ length: BLOCKS_N }, (_, i) => ({
  height: H - i, hash: hex('e'), tx_count: 3 + i, block_weight: 9000 + i * 800,
  reward: 0.6e12, difficulty: 7.7e11, timestamp: now() - 41 - i * 120, pool_name: 'P2Pool',
}));
const mkBlockDetail = () => ({
  height: H, hash: hex('e'), timestamp: now() - 41, block_weight: 9000, reward: 0.6e12,
  difficulty: 7.7e11, tx_count: 3, tx_hashes: [hex('1'), hex('2'), hex('3')],
  major_version: 16, minor_version: 16, nonce: 12345, prev_hash: hex('d'), pool_name: 'P2Pool',
});
const PRICE = { monero: { usd: 321.45, usd_24h_change: 1.23 }, bitcoin: { usd: 97_000, usd_24h_change: -0.4 } };

function fulfil(route) {
  const url = route.request().url();
  const json = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  if (url.includes('/api/xmr/network')) return json(mkNetwork());
  if (url.includes('/api/xmr/mempool')) return json(mkMempool());
  if (url.includes('/api/xmr/block/')) return json(mkBlockDetail());
  if (url.includes('/api/xmr/tx/')) return route.abort();
  if (url.includes('/api/xmr/decoys/')) return route.abort();
  if (url.includes('/api/xmr/blocks')) return json(mkBlocks());
  if (url.includes('/api/nodes')) return json({ nodes: [], sampled_at: new Date().toISOString() });
  if (url.includes('/api/coingecko')) {
    if (url.includes('simple%2Fprice') || url.includes('simple/price')) return json(PRICE);
    return route.abort();
  }
  return route.abort();
}

/* ── in-page readers ─────────────────────────────────────────────────────
   Declared once as source strings and evaluated in the page, so the phone and
   the desktop control measure with the SAME instrument. A gate whose two
   halves use two probes cannot tell drift from method — p4·M7's own note about
   calibrating a band with the sampler that enforces it. */
const READ = () => {
  const q = (s) => document.querySelector(s);
  const view = q('[data-mem-view="classic"]');

  // every element that genuinely scrolls horizontally
  const scrollers = [];
  document.querySelectorAll('*').forEach((e) => {
    if (e.scrollWidth <= e.clientWidth + 1) return;
    const cs = getComputedStyle(e);
    if (cs.overflowX !== 'auto' && cs.overflowX !== 'scroll') return;
    scrollers.push({
      cls: String(e.className || '').slice(0, 40),
      isLadder: e.hasAttribute('data-mem-ladder'),
      sw: e.scrollWidth, cw: e.clientWidth,
    });
  });

  // visible text inside the classic view, with its computed size
  const small = [];
  let textNodes = 0;
  if (view) {
    const walk = document.createTreeWalker(view, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walk.nextNode())) {
      if (!n.nodeValue || !n.nodeValue.trim()) continue;
      const el = n.parentElement;
      if (!el || el.namespaceURI === 'http://www.w3.org/2000/svg') continue;
      if (el.classList && el.classList.contains('sr-only')) continue;
      const b = el.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.01) continue;
      textNodes++;
      const fs = parseFloat(cs.fontSize);
      if (fs < 13 - 0.01) small.push({ fs: +fs.toFixed(2), t: n.nodeValue.trim().slice(0, 24), cls: String(el.className).slice(0, 28) });
    }
  }

  // tap targets inside the view
  const TAP = 'a[href], button, [role="button"], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  const tiny = [];
  let targets = 0;
  (view || document).querySelectorAll(TAP).forEach((e) => {
    const b = e.getBoundingClientRect();
    if (b.width === 0 || b.height === 0) return;
    targets++;
    if (b.width < 44 || b.height < 44) tiny.push({ tag: e.tagName.toLowerCase(), w: +b.width.toFixed(1), h: +b.height.toFixed(1), t: (e.textContent || '').trim().slice(0, 20) });
  });

  // the shared transaction table's RENDERED geometry
  const tbl = q('.mem-tbl');
  let table = null;
  if (tbl) {
    const hdr = [...tbl.querySelectorAll('.mem-tbl__h .mem-tbl__c')].filter((e) => e.getBoundingClientRect().width > 0);
    const xs = [...new Set(hdr.map((e) => Math.round(e.getBoundingClientRect().left)))].sort((a, b) => a - b);
    const ys = [...new Set(hdr.map((e) => Math.round(e.getBoundingClientRect().top)))].sort((a, b) => a - b);
    const r1 = [...tbl.querySelectorAll('.mem-tbl__r:not(.mem-tbl__h)')][0];
    const r1c = r1 ? [...r1.querySelectorAll('.mem-tbl__c')].filter((e) => e.getBoundingClientRect().width > 0) : [];
    table = {
      headerXs: xs.length, headerYs: ys.length, headerVisible: hdr.length,
      row1Xs: [...new Set(r1c.map((e) => Math.round(e.getBoundingClientRect().left)))].length,
      row1Ys: [...new Set(r1c.map((e) => Math.round(e.getBoundingClientRect().top)))].length,
      cols: [...tbl.querySelectorAll('.mem-tbl__r:not(.mem-tbl__h)')][0]
        ? [...r1c].map((e) => e.dataset.col) : [],
      rows: tbl.querySelectorAll('.mem-tbl__r:not(.mem-tbl__h)').length,
      clipped: [...tbl.querySelectorAll('.mem-tbl__c')].filter((e) => e.scrollWidth > e.clientWidth + 1).length,
      cells: tbl.querySelectorAll('.mem-tbl__c').length,
      roleRows: tbl.querySelectorAll('[role="row"]').length,
      roleCells: tbl.querySelectorAll('[role="cell"]').length,
      roleHeaders: tbl.querySelectorAll('[role="columnheader"]').length,
      wrapSW: q('.mem-table') ? q('.mem-table').scrollWidth : null,
      wrapCW: q('.mem-table') ? q('.mem-table').clientWidth : null,
    };
  }

  // the ladder and its NOW divider
  const lad = q('[data-mem-ladder]');
  let ladder = null;
  if (lad) {
    const d = lad.querySelector('[data-now-divider]');
    const lb = lad.getBoundingClientRect();
    const tiles = [...lad.querySelectorAll('.mp-block')];
    ladder = {
      sw: lad.scrollWidth, cw: lad.clientWidth, scrollLeft: Math.round(lad.scrollLeft),
      tiles: tiles.length,
      interactive: lad.querySelectorAll('.mp-block[role="button"]').length,
      focusable: lad.querySelectorAll('.mp-block[tabindex="0"]').length,
      pointerNonInteractive: tiles.filter((e) => getComputedStyle(e).cursor === 'pointer' && e.getAttribute('role') !== 'button').length,
    };
    if (d) {
      const db = d.getBoundingClientRect();
      ladder.dividerFrac = +((db.left + db.width / 2 - lb.left) / lad.clientWidth).toFixed(4);
      ladder.cardsLeft = tiles.filter((t) => { const b = t.getBoundingClientRect(); return b.right <= db.left + 0.5 && b.left >= lb.left - 0.5; }).length;
      ladder.cardsRight = tiles.filter((t) => { const b = t.getBoundingClientRect(); return b.left >= db.right - 0.5 && b.right <= lb.right + 0.5; }).length;
    }
  }

  // a header whose caption became a second column: a space-between flex row in
  // which BOTH children wrapped to more than one line.
  const lines = (el) => {
    const rg = document.createRange(); rg.selectNodeContents(el);
    return [...new Set([...rg.getClientRects()].filter((r) => r.height > 0).map((r) => Math.round(r.top)))].length;
  };
  const shattered = [];
  let sbRows = 0;
  let headers = 0;
  let headersStacked = 0;
  if (view) {
    // The POSITIVE shape: every classed panel header stacks its caption below
    // its heading rather than putting it in a second column.
    view.querySelectorAll('.classic-hd').forEach((e) => {
      const b = e.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) return;
      headers++;
      if (getComputedStyle(e).flexDirection.startsWith('column')) headersStacked++;
    });
    // The wider net, kept because a header that is NOT classed, or a future one,
    // would slip past the check above. It is allowed to find zero — §0g floors
    // the classed count, not this one, precisely because the fix removes this
    // sweep's own subject at phone widths.
    view.querySelectorAll('*').forEach((e) => {
      const cs = getComputedStyle(e);
      if (cs.display !== 'flex' || !cs.flexDirection.startsWith('row')) return;
      if (!/space-between/.test(cs.justifyContent)) return;
      const kids = [...e.children].filter((k) => { const b = k.getBoundingClientRect(); return b.width > 0 && b.height > 0; });
      if (kids.length < 2) return;
      sbRows++;
      if (kids.filter((k) => lines(k) > 1).length >= 2) {
        shattered.push({ cls: String(e.className).slice(0, 26), kids: kids.map((k) => (k.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 26)) });
      }
    });
  }

  const pills = [...document.querySelectorAll('.pill')].filter((e) => /updated/i.test(e.textContent || '') && e.getBoundingClientRect().width > 0);

  const det = q('[data-mem-detail]');
  const back = q('.mp-backbtn');

  return {
    innerWidth, dpr: devicePixelRatio,
    docSW: document.documentElement.scrollWidth,
    docH: document.documentElement.scrollHeight,
    scrollY: Math.round(window.scrollY),
    scrollers, table, ladder, small, textNodes, tiny, targets, shattered, sbRows, headers, headersStacked,
    pills: pills.length,
    detail: det ? { kind: det.getAttribute('data-mem-detail'), topVp: Math.round(det.getBoundingClientRect().top), h: Math.round(det.getBoundingClientRect().height) } : null,
    back: back ? { w: +back.getBoundingClientRect().width.toFixed(1), h: +back.getBoundingClientRect().height.toFixed(1), inVp: back.getBoundingClientRect().top >= 0 && back.getBoundingClientRect().bottom <= window.innerHeight, name: back.getAttribute('aria-label') } : null,
    landing: !!q('.classic-landing'),
    feedHidden: (() => { const f = q('.classic-txfeed'); return f ? getComputedStyle(f).display === 'none' : null; })(),
  };
};

const { browser, engine } = await launchChromium();
R.info(`engine: ${engine}`);
R.info(`base:   ${BASE}`);
R.info(`stages: ${STAGES.length} (${WIDTHS.length} widths × ${DPRS.length} device pixel ratios)`);

const open = async (stage, extra = {}) => {
  const ctx = await browser.newContext({
    viewport: { width: stage.w, height: stage.h },
    deviceScaleFactor: stage.dpr,
    hasTouch: true,
    ...extra,
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/api/**', fulfil);
  await p.goto(URL_CLASSIC, { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-mem-view="classic"]', { timeout: 20000 });
  await p.waitForSelector('[data-mem-ladder] .mp-block', { timeout: 20000 });
  await p.waitForTimeout(700);
  return { ctx, p, errs };
};

/* ══ §0 · instrument floors ═══════════════════════════════════════════════
   Every assertion below is either an ABSENCE (no overflow, no small text, no
   tiny target, no shattered header) or a comparison against a rendered
   quantity. Both are satisfiable by a page that rendered nothing, so the
   floors come first: the stage list is real, the pool arrived, and the view
   drew the things the rest of this file counts. */
R.group('§0 · instrument floors');
{
  const { ctx, p, errs } = await open({ w: 390, h: 844, dpr: 3 });
  const m = await p.evaluate(READ);
  R.ok(STAGES.length === 15, `0a · ${STAGES.length} stages (5 widths × 3 dpr) — a dpr-1-only suite is the instrument p4·M7 was blind through`);
  R.ok(errs.length === 0, `0b · the view renders with no uncaught error`, errs.join(' | '));
  R.ok(m.textNodes > 300, `0c · the classic view rendered ${m.textNodes} visible text nodes — the type floor below is not counting an empty page`);
  R.ok(m.table !== null && m.table.rows >= 20, `0d · the shared table rendered ${m.table ? m.table.rows : 0} transaction rows — §1 is not measuring an empty table`);
  R.ok(m.ladder !== null && m.ladder.tiles >= 10, `0e · the ladder rendered ${m.ladder ? m.ladder.tiles : 0} block tiles`);
  R.ok(m.targets >= 5, `0f · ${m.targets} tap targets found — §6 is not asserting an absence over an empty set`);
  // THIS FLOOR FIRED ON ITS FIRST RUN AND IT WAS RIGHT. It originally counted
  // `sbRows` — space-between flex rows in the ROW direction — and read 0,
  // because the p4·M8 fix makes every panel header a COLUMN below 720. §9 was
  // therefore asserting an absence over an empty set on every phone stage: it
  // would have gone green if the headers had been deleted outright. The floor
  // now counts the SUBJECT (the classed headers), which exists in both states.
  R.ok(m.headers >= 3, `0g · ${m.headers} panel headers found — §9 is not asserting a shape over an empty set`);
  await ctx.close();
}

/* ══ §1 · the table is a TABLE ════════════════════════════════════════════
   `.mem-tbl` is a grid whose COLUMN TRACKS are the fields; its DOM children
   are `.mem-tbl__r` row wrappers. Until p4·M8 nothing gave those wrappers
   `display: contents`, so each ROW was one grid item and its cells stacked
   VERTICALLY inside it — the table rendered TRANSPOSED, on all ten views, in
   both states it renders in, since it was written.

   THE ASSERTION IS RENDERED GEOMETRY AND NOT A DECLARATION, which is the whole
   reason it went unseen: verify-memviews scenario 3 counts columns off
   `.mem-tbl.style.gridTemplateColumns` — the inline style — which reads a
   correct 6 for a table laid out as one column of stacked rows. Six distinct
   header x positions on ONE y is the claim; a declaration cannot satisfy it.

   BOTH POLARITIES ON ONE INSTRUMENT: transposed gives headerXs 1 / headerYs N,
   correct gives headerXs N / headerYs 1. The same two numbers separate them in
   either direction, so neither can pass vacuously. */
R.group('§1 · the shared transaction table lays out as rows, not as columns');
for (const stage of STAGES) {
  const { ctx, p } = await open(stage);
  const m = await p.evaluate(READ);
  const t = m.table;
  R.ok(t && t.headerVisible >= 4,
    `1a [${stage.tag}] · the header row renders ${t ? t.headerVisible : 0} visible cells`);
  R.ok(t && t.headerYs === 1,
    `1b [${stage.tag}] · every header cell sits on ONE row (${t ? t.headerYs : '?'} distinct y) — a transposed table reads ${t ? t.headerVisible : 'N'} here`);
  R.ok(t && t.headerXs === t.headerVisible,
    `1c [${stage.tag}] · the header cells occupy ${t ? t.headerXs : 0} distinct x of ${t ? t.headerVisible : 0} — one column each`);
  R.ok(t && t.row1Ys === 1 && t.row1Xs === t.headerVisible,
    `1d [${stage.tag}] · the first transaction is ONE row across every column (${t ? t.row1Xs : '?'} x, ${t ? t.row1Ys : '?'} y)`);
  R.ok(t && t.clipped === 0,
    `1e [${stage.tag}] · no cell ellipsises its own content (${t ? t.clipped : '?'} of ${t ? t.cells : '?'})`);
  // The phone subset, asserted BY FIELD. `size`/`inout`/`ring`/`fee` are absent
  // by design — a fifth column at ~54px is narrower than the ellipsis it would
  // render — and the four that remain must be present, or "absent" would be
  // satisfied by a table showing nothing.
  const cols = (t && t.cols) || [];
  R.ok(cols.length === 4 && ['txid', 'perB', 'tier', 'age'].every((c) => cols.includes(c)),
    `1f [${stage.tag}] · the phone table renders exactly txid · fee/B · tier · age (got ${cols.join(', ') || 'none'})`);
  // MY OWN FIRST VERSION OF THIS WAS WRONG AND THE GATE CAUGHT IT: it asserted
  // `roleCells === cells`, but the header row's six cells carry
  // role="columnheader", not role="cell" — so the true identity is
  // cells === roleCells + roleHeaders. It reported 360 against 366 on a
  // perfectly correct tree. An assertion that is arithmetic about the subject
  // has to be checked against the subject, not derived from what it should be.
  R.ok(t && t.roleRows === t.rows + 1 && t.roleCells + t.roleHeaders === t.cells,
    `1g [${stage.tag}] · display:contents keeps the semantics — ${t ? t.roleRows : 0} role=row, ${t ? t.roleCells : 0} role=cell + ${t ? t.roleHeaders : 0} role=columnheader of ${t ? t.cells : 0}`);
  await ctx.close();
}
// The OTHER state this component renders in, and the reason the defect was not
// a phone bug: `.mem-table` is display:block under prefers-reduced-motion at
// ANY width. Measured transposed at 1440 before the fix — 2,008px tall with the
// labels stacked in a 1,154px column.
{
  const { ctx, p } = await open({ w: 1440, h: 900, dpr: 1, tag: '1440×900@1 reduce' }, { reducedMotion: 'reduce' });
  const m = await p.evaluate(READ);
  const t = m.table;
  R.ok(t && t.headerYs === 1 && t.headerXs === t.headerVisible,
    `1h [1440×900@1 reduce] · the reduced-motion table lays out as rows too (${t ? t.headerXs : '?'} x on ${t ? t.headerYs : '?'} y) — this state is not a phone and was equally broken`);
  R.ok(t && t.cols.length >= 5,
    `1i [1440×900@1 reduce] · and it keeps the FULL column set above 720 (${t ? t.cols.length : 0} columns) — the phone subset is a viewport decision, not a reduced-motion one`);
  await ctx.close();
}

/* ══ §2 · exactly one scroller ════════════════════════════════════════════
   The brief asks for the COUNT to be 1 rather than for the ladder to be among
   them, and it is right: a floor cannot see a regression that adds a second
   scroller. Measured before p4·M8: three at 360-430 and four at 320.

   IT IS ALSO ASSERTED IN THE TRACKED STATE, because that state used to add
   three MORE that do not exist untracked (`.main` 517/366, `.mem-view` 497/326,
   `.mempool-search-bar`) — a gate that only ever measures the landing page
   would call this green while a tap breaks it. */
R.group('§2 · exactly one horizontal scroller, and it is the block ladder');
for (const stage of STAGES) {
  const { ctx, p } = await open(stage);
  const m = await p.evaluate(READ);
  R.ok(m.scrollers.length === 1,
    `2a [${stage.tag}] · exactly ONE element scrolls horizontally (${m.scrollers.length}: ${m.scrollers.map((s) => `${s.cls || 'div'} ${s.sw}/${s.cw}`).join(' · ') || 'none'})`);
  R.ok(m.scrollers.length === 1 && m.scrollers[0].isLadder,
    `2b [${stage.tag}] · and it is the block ladder`);
  R.ok(m.feedHidden === true,
    `2c [${stage.tag}] · the desktop tx feed is retired here — .mem-table carries the same transactions`);
  await ctx.close();
}

/* ══ §3 · zero page overflow ══════════════════════════════════════════════
   `html, body { overflow-x: clip }` below 769px means the document CANNOT
   scroll horizontally whatever a child does — so this assertion is one the
   base tree already passed, and the brief's §1 premise that the page "scrolls
   in two axes at once" was measured FALSE before a line was written. It is
   kept because the clip is not permanent and §2's count is what has content. */
R.group('§3 · zero page overflow');
for (const stage of STAGES) {
  const { ctx, p } = await open(stage);
  const m = await p.evaluate(READ);
  R.ok(m.docSW === m.innerWidth,
    `3 [${stage.tag}] · documentElement.scrollWidth ${m.docSW} === innerWidth ${m.innerWidth}`);
  await ctx.close();
}

/* ══ §4 · the type floor ══════════════════════════════════════════════════
   13, not 12. verify-mobile §1 owns the site-wide 12px minimum across all 18
   routes; this is a RAISE the classic view takes on top of it, and the two
   numbers are deliberately different — see styles-legibility.css's p4·M8 block.
   §0c's node-count floor is what stops this passing on an empty page. */
R.group(`§4 · no text under ${CLASSIC_FLOOR}px inside the classic view`);
for (const stage of STAGES) {
  const { ctx, p } = await open(stage);
  const m = await p.evaluate(READ);
  R.ok(m.small.length === 0,
    `4 [${stage.tag}] · ${m.small.length} of ${m.textNodes} visible text nodes below ${CLASSIC_FLOOR}px`,
    m.small.slice(0, 5).map((s) => `${s.fs}px "${s.t}" .${s.cls}`).join(' | '));
  await ctx.close();
}

/* ══ §5 · the ladder opens on NOW ═════════════════════════════════════════
   It opened at scrollLeft 0 — the `~QUEUED` card, which carries an em-dash and
   no reading. The brief asks for the divider in the middle third; the fraction
   is asserted rather than the pixel offset, because the offset is a function
   of tile widths that vary with the strings they carry.

   The card counts either side are the claim that actually matters, and they
   are what mempool.space's mobile does: one block mined, one being built. */
R.group('§5 · the ladder opens on the NOW divider');
for (const stage of STAGES) {
  const { ctx, p } = await open(stage);
  const m = await p.evaluate(READ);
  const L = m.ladder;
  R.ok(L && L.sw > L.cw + 1,
    `5a [${stage.tag}] · the ladder overflows its box (${L ? L.sw : '?'}/${L ? L.cw : '?'}) — otherwise there is nothing to anchor`);
  R.ok(L && typeof L.dividerFrac === 'number',
    `5b [${stage.tag}] · the NOW divider is rendered`);
  R.ok(L && L.dividerFrac >= 1 / 3 && L.dividerFrac <= 2 / 3,
    `5c [${stage.tag}] · it lands in the middle third (frac ${L ? L.dividerFrac : '?'})`);
  R.ok(L && L.cardsLeft >= 1 && L.cardsRight >= 1,
    `5d [${stage.tag}] · one block either side of NOW is fully visible (${L ? L.cardsLeft : '?'} left, ${L ? L.cardsRight : '?'} right)`);
  R.ok(L && L.scrollLeft > 0,
    `5e [${stage.tag}] · the ladder did not open at its far-left card (scrollLeft ${L ? L.scrollLeft : '?'})`);
  await ctx.close();
}

/* ══ §6 · tap targets ═════════════════════════════════════════════════════
   Two were under 44 before: the search field (195×39) and SEARCH (83×30.5).
   The block cards were already over — 108-134 × 170 — but they were <div>s
   with no role and no tab stop, and two of the twelve showed a pointer for a
   tap that did nothing. Both halves are asserted: the size, and that a card
   which LOOKS interactive IS. */
R.group(`§6 · every tap target is at least ${TAP_MIN}×${TAP_MIN}`);
for (const stage of STAGES) {
  const { ctx, p } = await open(stage);
  const m = await p.evaluate(READ);
  R.ok(m.tiny.length === 0,
    `6a [${stage.tag}] · ${m.tiny.length} of ${m.targets} targets under ${TAP_MIN}px`,
    m.tiny.map((t) => `${t.tag} ${t.w}×${t.h} "${t.t}"`).join(' | '));
  const L = m.ladder;
  R.ok(L && L.interactive >= 8 && L.focusable === L.interactive,
    `6b [${stage.tag}] · ${L ? L.interactive : 0} block cards are real controls, all keyboard-reachable`);
  R.ok(L && L.pointerNonInteractive === 0,
    `6c [${stage.tag}] · no card shows a pointer for a tap that does nothing (${L ? L.pointerNonInteractive : '?'})`);
  await ctx.close();
}

/* ══ §7 · the tap reaches the reader ══════════════════════════════════════
   The panel existed before p4·M8; it opened 2,870px below the fold and the page
   did not move, so NOTHING VISIBLE CHANGED and the tap read as broken. 1,915px
   of that was `.mem-table` sitting between the body and the detail.

   Asserted as a ROUND TRIP — open, then dismiss — because dismissing used to
   strand the reader in the middle of the table in a document that had just
   shrunk by ~900px. */
R.group('§7 · tapping a block reaches the reader, and dismissing puts them back');
for (const stage of [STAGES[6], STAGES[7], STAGES[8], STAGES[0], STAGES[14]]) {
  const { ctx, p } = await open(stage);
  const before = await p.evaluate(READ);
  const card = await p.$('.mp-block[role="button"]');
  R.ok(card !== null, `7a [${stage.tag}] · a confirmed block card is a control that can be tapped`);
  if (!card) { await ctx.close(); continue; }
  await card.scrollIntoViewIfNeeded();
  const atTap = await p.evaluate(() => Math.round(window.scrollY));
  await card.click();
  await p.waitForSelector('[data-mem-detail]', { timeout: 15000 });
  await p.waitForTimeout(1200);
  const after = await p.evaluate(READ);
  R.ok(after.detail !== null && after.detail.kind === 'block',
    `7b [${stage.tag}] · a block detail panel opened`);
  R.ok(after.detail && after.detail.topVp >= -2 && after.detail.topVp < stage.h,
    `7c [${stage.tag}] · it is IN the viewport (top ${after.detail ? after.detail.topVp : '?'} of ${stage.h}) — it used to open 2,870px below the fold with the page not moving`);
  R.ok(after.back !== null && after.back.h >= TAP_MIN && after.back.inVp,
    `7d [${stage.tag}] · the dismiss control is ${after.back ? `${after.back.w}×${after.back.h}` : 'absent'} and on screen`);
  R.ok(after.back !== null && typeof after.back.name === 'string' && after.back.name.length > 6,
    `7e [${stage.tag}] · and it has an accessible name ("${after.back ? after.back.name : ''}")`);
  R.ok(after.ladder !== null && after.ladder.tiles === before.ladder.tiles,
    `7f [${stage.tag}] · the ladder stays mounted underneath (${after.ladder ? after.ladder.tiles : 0} tiles)`);
  R.ok(after.scrollers.length === 1 && after.scrollers[0].isLadder,
    `7g [${stage.tag}] · the tracked state still has exactly one scroller (${after.scrollers.length}: ${after.scrollers.map((s) => `${s.cls || 'div'} ${s.sw}/${s.cw}`).join(' · ')})`);
  R.ok(after.small.length === 0,
    `7h [${stage.tag}] · and nothing in it renders under ${CLASSIC_FLOOR}px (${after.small.length})`);
  await p.click('.mp-backbtn');
  await p.waitForTimeout(900);
  const back = await p.evaluate(READ);
  R.ok(back.detail === null && back.landing === true,
    `7i [${stage.tag}] · dismissing restores the landing page`);
  R.ok(Math.abs(back.scrollY - atTap) <= 80,
    `7j [${stage.tag}] · and puts the reader back where they were (${back.scrollY} against ${atTap})`);
  await ctx.close();
}

/* ══ §8 · say it once ═════════════════════════════════════════════════════
   Two `LIVE · UPDATED Ns AGO` pills rendered 234px apart, both pulsing — one in
   the page chrome and one inside the search bar. p3·16 recorded the same shape
   ("5 APPS" twice within ~120px) and the same remedy. */
R.group('§8 · the feed says it once');
for (const stage of [STAGES[0], STAGES[8], STAGES[14]]) {
  const { ctx, p } = await open(stage);
  const m = await p.evaluate(READ);
  R.ok(m.pills === 1, `8 [${stage.tag}] · exactly one LIVE·UPDATED pill is visible (${m.pills})`);
  await ctx.close();
}

/* ══ §9 · a header is not two columns ═════════════════════════════════════
   `justify-content: space-between` with two children is right on a desktop row
   and unreadable the moment BOTH children wrap: the reader sees a 2×2 block and
   cannot tell which half is the heading. Measured at 320 before the gutter
   fix — "Fee depth" on two lines beside "by tier · % of mempool weight" on two,
   in 174px. §0g's floor is what stops this passing over zero such rows. */
R.group('§9 · a panel header and its caption are not two interleaved columns');
for (const stage of STAGES) {
  const { ctx, p } = await open(stage);
  const m = await p.evaluate(READ);
  R.ok(m.headers > 0 && m.headersStacked === m.headers,
    `9a [${stage.tag}] · all ${m.headers} panel headers stack their caption (${m.headersStacked} stacked)`);
  R.ok(m.shattered.length === 0,
    `9b [${stage.tag}] · ${m.shattered.length} of ${m.sbRows} remaining space-between rows have BOTH children wrapped`,
    m.shattered.map((s) => `.${s.cls} [${s.kids.join(' | ')}]`).join(' · '));
  await ctx.close();
}

/* ══ §10 · the desktop control ════════════════════════════════════════════
   Everything above is scoped to ≤720px. This is the paired negative: the
   desktop composition must NOT have moved. Without it, a rule that accidentally
   escaped its media query would be invisible here and would be caught, if at
   all, by whichever other gate happened to trip over it. */
R.group('§10 · the desktop composition is unchanged');
{
  const { ctx, p } = await open({ w: 1440, h: 900, dpr: 1, tag: '1440×900@1' });
  const m = await p.evaluate(READ);
  R.ok(m.scrollers.length === 1 && !m.scrollers[0].isLadder,
    `10a · desktop still has exactly one scroller and it is .mp-canvas-scroll, not the ladder (${m.scrollers.map((s) => s.cls || 'div').join(', ')})`);
  R.ok(m.feedHidden === false,
    `10b · the desktop tx feed still renders above 768 — it is the phone that swaps it for the table`);
  R.ok(m.small.length > 50,
    `10c · desktop keeps its own 11px scale (${m.small.length} nodes under ${CLASSIC_FLOOR}px) — the 13px raise did not leak out of its media query`);
  R.ok(m.ladder !== null && m.ladder.scrollLeft === 0,
    `10d · the ladder is NOT anchored on desktop, where it does not overflow (scrollLeft ${m.ladder ? m.ladder.scrollLeft : '?'})`);
  await ctx.close();
}

await browser.close();
process.exit(R.finish());
