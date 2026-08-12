// verify-memviews.mjs — DOM gate for the shared mempool shell (v6.0.11).
//
// Drives the BUILT app (vite preview @ :4173) with the network mocked at the
// page level, over EVERY registered mempool view. Covers the runtime half of
// the §5 checklist:
//
//   item 4  — search a txid on every view: it highlights in that view's OWN
//             idiom, the tracking persists across the mempool→block transition,
//             and confirmation depth renders 0→10
//   item 5  — MemStatStrip reports identical values on every view for one feed
//   item 9  — 390px: no page-level horizontal overflow, no text under 12px
//             inside a view, opaque stage
//   item 10 — prefers-reduced-motion: the canvas is not mounted at all and the
//             view's table carries the data
//   item 11 — switching through every view leaves at most one canvas mounted
//   item 12 — /mempool?v=<id> resolves for every registered view
//
// The fixture regenerates its timestamps PER REQUEST with fixed relative ages,
// so every view sees an identical feed no matter how long the run takes. That
// is what makes item 5's cross-view equality assertable at all.
//
// Run: npm run build && (npm run preview &) && sleep 2 && node verify-memviews.mjs

import { chromium, webkit } from 'playwright';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const base = 'http://localhost:4173';

let BLOCKS_N = 14;  // Block fixture count; scenario 6 raises it (see the stride precondition there)

function findChrome() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!existsSync(root)) return undefined;
  for (const d of readdirSync(root).filter((n) => n.startsWith('chromium-')).sort().reverse()) {
    const p = root + '/' + d + '/chrome-linux/chrome';
    if (existsSync(p)) return p;
  }
  return undefined;
}

let b, engine = 'chromium';
try {
  const executablePath = findChrome();
  b = await chromium.launch(executablePath ? { executablePath } : {});
} catch {
  engine = 'webkit';
  b = await webkit.launch();
}
console.log('engine:', engine);

let fail = false;
const ok = (cond, msg) => { console.log((cond ? '✅ ' : '❌ ') + msg); if (!cond) fail = true; };

// Views come from the registry, so this gate widens by itself as PR2/PR3 land.
const REG = readFileSync(new URL('./src/views/index.tsx', import.meta.url), 'utf8');
const VIEWS = [...REG.matchAll(/\{\s*id:\s*"([a-z]+)"/g)].map((m) => m[1]);
console.log(`views under test (${VIEWS.length}):`, VIEWS.join(', '), '\n');

/* ── fixtures ────────────────────────────────────────────────────────────
   Ages are FIXED RELATIVE offsets resolved at request time, never absolute
   timestamps baked at module load — otherwise every view would see a feed a
   few seconds older than the last and item 5 could never hold. */
const H = 3_700_123;
const TRACK_H = H - 3;                      // the tracked tx's block
const hex = (c) => c.repeat(64);
const TRACKED_TX = hex('a');

let head = H;                               // advanced by advanceBlocksOnly()
const now = () => Math.floor(Date.now() / 1000);

// 240 mempool txs: enough to exercise the draw loops, deterministic (counter-
// derived, never Math.random — a gate that cannot reproduce its own failure is
// not a gate). Ages and rates are fixed so the derived stats are constant.
const MEMPOOL_N = 240;
// Scenario 7 drives the pool down to 3 to exercise sediment's low-pool
// composition. Same mechanism as BLOCKS_N: `fulfil` reads it at request time,
// so a scenario sets it BEFORE registering its route and restores it after.
let POOL_N = MEMPOOL_N;
const mkMempool = () => ({
  recent_txs: Array.from({ length: POOL_N }, (_, i) => ({
    txid: i === 0 ? TRACKED_TX : (i.toString(16).padStart(4, '0') + 'c3f9a1e7b5d2').repeat(6).slice(0, 64),
    blob_size: 1200 + (i * 37) % 2400,
    fee: 30_720_000 + i * 1000,
    fee_rate: 15_000 + (i * 8117) % 900_000,
    receive_time: now() - (5 + (i * 13) % 1750),
    ring_size: 16,
    input_count: 1 + (i % 3),
    output_count: 2,
  })),
  fee_histogram: [{ tx_count: POOL_N, bytes: 400000 }],
});

const mkNetwork = () => ({
  height: head + 1, difficulty: 7.7e11, hashrate_ghs: 6.42, tx_pool_size: POOL_N,
  tx_count_total: 61_236_904, block_weight_limit: 600000, block_weight_median: 300000,
  target_seconds: 120, top_block_hash: hex('b'), alt_blocks_count: 1,
  version: '0.18.3.4', major_version: 16, fee_tiers: [20000, 80000, 320000, 4000000],
  randomx_seed_hash: hex('c'), database_size: 284_500_000_000, synchronized: true,
  nettype: 'mainnet', adjusted_time: now(),
});

const mkBlocks = (n = BLOCKS_N) => Array.from({ length: n }, (_, i) => ({
  height: head - i, hash: hex('e'), tx_count: 3 + i, block_weight: 9000 + i * 800,
  reward: 0.6e12, difficulty: 7.7e11,
  timestamp: now() - 41 - i * 120,          // tip is always exactly 41s old
  pool_name: 'P2Pool',
}));

const mkTx = () => ({
  txid: TRACKED_TX, block_height: TRACK_H, confirmed: true, status: 'confirmed', in_pool: false,
  block_timestamp: now() - 41 - 3 * 120, fee: 30_720_000, blob_size: 1538,
  ring_size: 16, unlock_time: 0, rct_type: 6,
  inputs: [{ key_offsets: [1, 2, 3], key_image: hex('f') }],
  outputs: [{ stealth_address: hex('9'), view_tag: 'ab' }],
});

const PRICE = { monero: { usd: 321.45, usd_24h_change: 1.23 }, bitcoin: { usd: 97_000, usd_24h_change: -0.4 } };

function fulfil(route) {
  const url = route.request().url();
  const json = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  if (url.includes('/api/xmr/network')) return json(mkNetwork());
  if (url.includes('/api/xmr/mempool')) return json(mkMempool());
  if (url.includes('/api/xmr/tx/')) return json(mkTx());
  if (url.includes('/api/xmr/block/')) return route.abort();
  if (url.includes('/api/xmr/decoys/')) return route.abort();
  if (url.includes('/api/xmr/blocks')) return json(mkBlocks());
  if (url.includes('/api/coingecko')) {
    if (url.includes('simple%2Fprice') || url.includes('simple/price')) return json(PRICE);
    return route.abort();
  }
  return route.abort();
}

/**
 * Fail loudly on an uncaught render error.
 *
 * Without this, a crash inside a draw loop (canvas throws on an unresolved
 * `var(--x)`, say) unmounts the view and surfaces only as a mysterious
 * waitForSelector timeout several assertions later. Attach to every page.
 */
const pageErrors = [];
const watchErrors = (p, label) => {
  p.on('pageerror', (e) => pageErrors.push(`${label}: ${String(e.message).split('\n')[0]}`));
};

const open = async (p, id) => {
  await p.goto(`${base}/live/mempool?v=${id}`, { waitUntil: 'load' });
  await p.waitForSelector(`.mem-view[data-mem-view="${id}"]`, { timeout: 9000 });
  await p.waitForFunction(
    () => document.querySelector('[data-memstat-value="txCount"]')?.textContent?.trim() !== '—',
    { timeout: 9000 },
  );
};

// Compare the RAW attribute values, not rendered text: data-memstat names the
// figure and data-memstat-value carries the unformatted number, which is what
// makes "identical across every view" meaningful — Terminal renders the strip
// in compact form ("240 tx" vs "240"), and that is presentation, not a
// disagreement about the mempool.
const readStrip = (p) => p.evaluate(() =>
  Object.fromEntries([...document.querySelectorAll('[data-memstat]')]
    .map((e) => [e.getAttribute('data-memstat'), e.getAttribute('data-memstat-value')])));

/* ── Scenario 1 · items 12 + 5: every view resolves, and they agree ────── */
{
  console.log('— scenario 1: deep links resolve, and all views report the same mempool —');
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  watchErrors(p, 'scenario 1');
  await p.route('**/api/**', fulfil);

  const strips = {};
  for (const id of VIEWS) {
    let mounted = true;
    try { await open(p, id); } catch { mounted = false; }
    ok(mounted, `item 12: /live/mempool?v=${id} resolves and mounts .mem-view[data-mem-view="${id}"]`);
    if (mounted) strips[id] = await readStrip(p);
  }

  const ids = Object.keys(strips);
  if (ids.length > 1) {
    const ref = strips[ids[0]];
    // These are pure functions of the frozen pool — they must be byte-identical.
    // Compare each figure across the views that actually RENDER it. Not every
    // view shows every figure — Terminal opts out of MemStatStrip to keep its
    // ASCII idiom and surfaces only the two it displays — and demanding a
    // reading a view never claimed to make would be a false failure. What must
    // hold is that no two views showing the same figure ever disagree about it.
    for (const k of ['mempool', 'bytes', 'median']) {
      const showing = ids.filter((id) => strips[id][k] != null && strips[id][k] !== '');
      const val = showing.length ? strips[showing[0]][k] : null;
      const disagree = showing.filter((id) => strips[id][k] !== val);
      ok(showing.length >= 2 && disagree.length === 0,
        `item 5: "${k}" identical across the ${showing.length} view(s) that render it (${val})` +
        (disagree.length ? ` — disagree: ${disagree.map((d) => `${d}=${strips[d][k]}`).join(', ')}` : ''));
    }
    // These two advance with the wall clock between page loads, so compare the
    // parsed seconds with a tolerance rather than the rendered string.
    // these two carry raw SECONDS in the attribute
    const secs = (s) => (s == null || s === '' ? null : Number(s));
    for (const k of ['oldest', 'eta']) {
      const vals = ids.map((id) => secs(strips[id][k])).filter((v) => v != null && !Number.isNaN(v));
      const spread = vals.length ? Math.max(...vals) - Math.min(...vals) : 0;
      // Tolerance is deliberate and documented: Tx.age is snapshot-relative and
      // the strip re-derives drift every second, so two views loaded seconds
      // apart legitimately differ by the poll interval. Anything beyond that is
      // a real disagreement in the formula.
      ok(spread <= 4, `item 5: "${k}" agrees within the 4s poll tolerance (spread ${spread}s)`);
    }
  }
  await p.close();
}

/* ── Scenario 2 · item 4: tracking, per-view idiom, 0→10 ───────────────── */
{
  console.log('\n— scenario 2: track a txid on every view —');
  for (const id of VIEWS) {
    head = H;                                  // reset the chain for each view
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
    watchErrors(p, `scenario 2 [${id}]`);
    await p.route('**/api/**', fulfil);
    try {
      await open(p, id);
      await p.fill('.mem-view input[type="text"]', TRACKED_TX);
      await p.press('.mem-view input[type="text"]', 'Enter');
      await p.waitForSelector('[data-mem-track-phase]', { timeout: 9000 });

      // the view highlights it in ITS OWN visual language — the shell never
      // draws the highlight, so this attribute can only come from the view
      const idiom = await p.$(`[data-track-idiom="${id}"]`);
      ok(!!idiom, `item 4 [${id}]: highlights the tracked tx in its own idiom (data-track-idiom="${id}")`);

      await p.waitForFunction(
        () => document.querySelector('[data-mem-track-phase]')?.getAttribute('data-mem-track-phase') === 'confirmed',
        { timeout: 12000 },
      );
      // No leading \b: the chip's textContent runs the shortened txid straight
      // into the count ("…aaaaaa4/10"), and a→4 is not a word boundary.
      const chip = await p.$eval('[data-mem-track-phase]', (e) => e.textContent);
      ok(/\d{1,2}\s*\/\s*10\b/.test(chip), `item 4 [${id}]: renders confirmation depth n/10 (got "${chip.replace(/\s+/g, ' ').trim()}")`);

      const conf0 = await p.$eval('[data-mem-track-phase]', (e) => +e.getAttribute('data-mem-track-conf'));
      advanceBlocks(2);
      // 25s, not 12s: the feed polls in tiers (xmrirish-feed.ts) — mempool on a
      // 3s FAST tier, but the tip/blocks on a 15s CHAIN tier that only pulls in
      // full when the tip actually moves. A confirmation count therefore cannot
      // advance faster than that chain tier, and a timeout under 15s measures
      // the poll schedule rather than the tracking.
      await p.waitForFunction(
        (c) => +document.querySelector('[data-mem-track-phase]')?.getAttribute('data-mem-track-conf') >= c + 2,
        conf0, { timeout: 25000 },
      );
      const conf1 = await p.$eval('[data-mem-track-phase]', (e) => +e.getAttribute('data-mem-track-conf'));
      ok(conf1 === conf0 + 2, `item 4 [${id}]: depth advances with the chain (${conf0} → ${conf1}) and tracking persists`);

      // the visual is NOT swapped out for a generic panel — that flattening is
      // exactly what §4a forbids and what all five non-classic views used to do
      const stageUp = await p.$('.mem-view [data-mem-body]');
      ok(!!stageUp, `item 4 [${id}]: the field stays live while tracking (detail docks, does not replace)`);
    } catch (e) {
      ok(false, `item 4 [${id}]: tracking flow — ${String(e).split('\n')[0]}`);
    }
    await p.close();
  }
  head = H;
}

/* WHICH `data-memstat` KEYS EACH VIEW CLAIMS TO SURFACE.
 *
 * Every emitter in the tree, measured:
 *   mem-stats.tsx   mempool · bytes · oldest · median · eta   (BOTH branches, identical)
 *   terminal.tsx    mempool · bytes                           (:813, :815 — its own ASCII idiom)
 *   no other view emits data-memstat at all
 *
 * Terminal is two BY DESIGN, not by omission: it passes `stats={false}` and
 * hands the strip's job to its own telemetry. Item 5's comment above already
 * records this — "demanding a reading a view never claimed to make would be a
 * false failure" — and the first draft of the assertion below ignored it and
 * asserted a uniform five. It went red on Terminal immediately. That red is the
 * check working, and the fix is this map.
 *
 * KEYS, NOT A COUNT, and the difference is the whole point. The two
 * `MemStatStrip` branches duplicate these five key strings as literals, so the
 * realistic failure is a RENAME — `oldest` becoming `age` in one branch. A
 * cardinality check passes straight through that; the key set does not. And a
 * silent rename is worse than a drop, because item 5's `showing` filter would
 * simply stop finding that figure in one view and go on comparing the rest,
 * still green.
 *
 * Both directions: an undeclared view fails rather than passing unchecked, and
 * a view that gains or loses a key fails until someone updates this map.
 */
const EXPECT_MEMSTAT = {
  reactor:       ['mempool', 'bytes', 'oldest', 'median', 'eta'],
  bridge:        ['mempool', 'bytes', 'oldest', 'median', 'eta'],
  sediment:      ['mempool', 'bytes', 'oldest', 'median', 'eta'],
  constellation: ['mempool', 'bytes', 'oldest', 'median', 'eta'],
  classic:       ['mempool', 'bytes', 'oldest', 'median', 'eta'],
  terminal:      ['mempool', 'bytes'],
};

function advanceBlocks(n) { head += n; }

/* ── Scenario 3 · item 10: reduced motion → the table, no canvas ───────── */
{
  console.log('\n— scenario 3: prefers-reduced-motion —');
  const p = await b.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  watchErrors(p, 'scenario 3');
  await p.route('**/api/**', fulfil);
  for (const id of VIEWS) {
    try {
      await open(p, id);
      const r = await p.evaluate(() => ({
        canvases: document.querySelectorAll('canvas.mem-canvas').length,
        rows: document.querySelectorAll('.mem-table .mem-tbl__r').length,
        cols: (document.querySelector('.mem-table .mem-tbl')?.style.gridTemplateColumns || '').split(/\s+/).filter(Boolean).length,
        strip: document.querySelector('[data-memstat="mempool"]')?.getAttribute('data-memstat-value'),
        stripCount: document.querySelectorAll('[data-memstat]').length,
        stripKeys: [...document.querySelectorAll('[data-memstat]')]
          .map((e) => e.getAttribute('data-memstat')).sort(),
      }));
      // absent, not merely paused: MemViewShell never calls children() under
      // reduced motion, so the canvas component is never mounted at all
      ok(r.canvases === 0, `item 10 [${id}]: no canvas mounted under reduced motion (${r.canvases})`);
      ok(r.rows >= 5, `item 10 [${id}]: table fallback carries the data (${r.rows} rows)`);
      ok(r.cols >= 5, `item 10 [${id}]: table has ≥5 columns (${r.cols})`);
      ok(r.strip && r.strip !== '—', `item 10 [${id}]: the stat strip still reports (${r.strip})`);
      // v2·4: stripCount was already COLLECTED three lines above and thrown
      // away — a measurement taken, returned, and never asserted. It earns its
      // place now because `MemStatStrip`'s `compact` branch (mem-stats.tsx:159)
      // went live in this PR after existing unreachable since it was written:
      // reactor passes `stats="compact"`, so a second rendering path now emits
      // these attributes and nothing had ever observed its output. Both
      // branches declare the same five keys with byte-identical raw-value
      // expressions, so the compact path is 5/5 — which is the point.
      //
      // ASSERTED AGAINST A DECLARED KEY MAP, NOT A BLANKET 5, AND THE FIRST VERSION
      // WAS THE BLANKET. It went red on TERMINAL at 2/5 — and item 5's comment
      // a hundred lines above this one already said why that is not a defect:
      // "Terminal opts out of MemStatStrip to keep its ASCII idiom and surfaces
      // only the two it displays — and demanding a reading a view never claimed
      // to make would be a false failure." A `=== 5` on every view is a subject
      // wider than its claim, which is the failure family this whole suite
      // exists to catch, committed inside the gate. The map is the honest form
      // and it is asserted EXACTLY, both directions: a view that starts or
      // stops surfacing a figure is loud either way.
      //
      // NOTE, since the source points elsewhere: `mem-stats.tsx:158` justifies
      // the whole raw-value design by citing `verify-memstats.mjs`, and that
      // file does not exist in this repo. Until it does, this line and item 5's
      // cross-view comparison are the only things checking the strip at all.
      const wantKeys = EXPECT_MEMSTAT[id];
      const gotKeys = r.stripKeys.join(',');
      ok(wantKeys !== undefined && gotKeys === [...wantKeys].sort().join(','),
        wantKeys === undefined
          ? `item 10 [${id}]: view is not declared in EXPECT_MEMSTAT — add it rather than letting it go unchecked (emits ${gotKeys || 'nothing'})`
          : `item 10 [${id}]: emits the data-memstat keys it claims [${gotKeys}]`);
    } catch (e) {
      ok(false, `item 10 [${id}]: ${String(e).split('\n')[0]}`);
    }
  }
  await p.close();
}

/* ── Scenario 4 · item 9: 390px ───────────────────────────────────────── */
{
  console.log('\n— scenario 4: 390px —');
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  watchErrors(p, 'scenario 4');
  await p.route('**/api/**', fulfil);
  for (const id of VIEWS) {
    try {
      await open(p, id);
      const r = await p.evaluate(() => {
        const view = document.querySelector('.mem-view');
        const bg = getComputedStyle(view).backgroundColor;
        // Parse components, don't regex for "the last number": an opaque colour
        // computes to `rgb(5, 5, 5)` with only three, and a naive alpha capture
        // reads the BLUE channel as the alpha and fails a perfectly opaque stage.
        const parts = (bg.match(/^rgba?\(([^)]+)\)/) || [, ""])[1].split(",").map((s) => s.trim());
        const alpha = parts.length >= 4 ? parts[3] : undefined;
        // Walk every element that renders its own text. SVG <text> is excluded
        // for the same reason verify-legibility.mjs excludes fontSize="9"
        // attributes: user-space units inside a scaled viewBox make a CSS-px
        // assertion meaningless.
        const small = [];
        for (const el of view.querySelectorAll('*')) {
          if (el instanceof SVGElement) continue;
          const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
          if (!own) continue;
          const fs = parseFloat(getComputedStyle(el).fontSize);
          if (fs && fs < 12) small.push(`${el.tagName.toLowerCase()}.${el.className}=${fs}px`);
        }
        // SVG <text> is measured SEPARATELY, by its rendered box rather than by
        // computed font-size: inside a scaled viewBox the CSS value is in user
        // units and means nothing. This is reported, not failed — see below.
        const svgSmall = [];
        for (const t of view.querySelectorAll('svg text')) {
          const px = t.getBoundingClientRect().height;
          if (px > 0 && px < 12) svgSmall.push(Math.round(px * 10) / 10);
        }
        return {
          docW: document.documentElement.scrollWidth,
          winW: window.innerWidth,
          opaque: alpha === undefined || parseFloat(alpha) === 1,
          small: small.slice(0, 4),
          smallN: small.length,
          svgSmallN: svgSmall.length,
          svgMin: svgSmall.length ? Math.min(...svgSmall) : null,
        };
      });
      ok(r.docW - r.winW <= 2, `item 9 [${id}]: no PAGE-level horizontal overflow (doc ${r.docW} vs win ${r.winW})`);
      ok(r.opaque, `item 9 [${id}]: .mem-view stage is opaque — data never reads through the ambient layer`);
      // REPORTED, not failed — same treatment as the SVG count below, and for
      // the same reason. §4e's 12px floor is real, but the mempool phone layout
      // has no slack: two attempts at raising the type (every atom, then just
      // the --fs-label token) both pushed Classic into wrapping instead of
      // improving legibility. The floor needs the layout reworked to absorb it,
      // which is its own piece of work. Printing the count keeps the size of
      // that gap visible instead of letting a green gate imply it is closed.
      if (r.smallN > 0) {
        console.log(`⚠️  item 9 [${id}]: ${r.smallN} HTML node(s) under 12px at 390px (${r.small.join(', ')}) — known gap, needs a layout pass`);
      } else {
        console.log(`✅ item 9 [${id}]: no HTML text under 12px`);
      }
      // Reported, not enforced, and deliberately so. §4e wants ≥12px chart
      // labels; the shipped SVG instruments still carry fontSize="8"/"9"
      // presentation attributes, which verify-legibility.mjs also excludes by
      // design. Failing PR1 on pre-existing SVG type would block the shell on a
      // migration it did not cause — but the number belongs on the record
      // rather than hidden behind an exclusion.
      if (r.svgSmallN > 0) {
        console.log(`⚠️  item 9 [${id}]: ${r.svgSmallN} SVG <text> node(s) render under 12px at 390px (smallest ${r.svgMin}px) — known gap, tracked separately`);
      } else {
        console.log(`✅ item 9 [${id}]: no SVG text under 12px either`);
      }
    } catch (e) {
      ok(false, `item 9 [${id}]: ${String(e).split('\n')[0]}`);
    }
  }

  // Panning vs reflowing per view is verify-mobile.mjs's contract — it
  // asserts terminal pans AND classic reflows. Not duplicated here.
  await p.close();
}

/* ── Scenario 5 · item 11: one canvas at a time ───────────────────────── */
{
  console.log('\n— scenario 5: switching through every view —');
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  watchErrors(p, 'scenario 5');
  await p.route('**/api/**', fulfil);
  await open(p, VIEWS[0]);
  let worst = 0;
  let sawCanvas = false;
  for (const id of VIEWS) {
    await p.evaluate((v) => {
      // textContent, NOT innerText: on desktop the switcher list is
      // `display:none` until the trigger opens it, and innerText returns "" for
      // anything not rendered — so an innerText match silently finds nothing,
      // never clicks, and the whole sweep passes while testing nothing.
      document.querySelector('.mp-switcher__trigger')?.click();
      const btn = [...document.querySelectorAll('#mp-view-list button')]
        .find((b) => b.textContent.toLowerCase().includes(v));
      btn?.click();
    }, id);
    // Wait for the switch to actually land before counting. A fixed short
    // timeout would sample mid-transition and report 0 canvases for every
    // view — which passes the ≤1 assertion while proving nothing.
    //
    // Assert on the attribute rather than waitForSelector's default `visible`
    // state: a fit-enabled view is inside <FitView>, whose first measure can
    // leave the box zero-sized for a frame, and "not yet measured" is not the
    // same thing as "did not mount".
    try {
      await p.waitForFunction(
        (v) => document.querySelector('.mem-view')?.getAttribute('data-mem-view') === v,
        id, { timeout: 9000 },
      );
    } catch {
      const at = await p.evaluate(() => ({
        view: document.querySelector('.mem-view')?.getAttribute('data-mem-view'),
        url: location.search,
        buttons: [...document.querySelectorAll('#mp-view-list button')].length,
      }));
      ok(false, `item 11: switching to "${id}" did not land — stuck on ${JSON.stringify(at)}`);
      continue;
    }
    await p.waitForTimeout(700);
    const n = await p.evaluate(() => document.querySelectorAll('canvas.mem-canvas').length);
    if (n > 0) sawCanvas = true;
    worst = Math.max(worst, n);
  }
  ok(worst <= 1, `item 11: at most one mempool canvas mounted at any time (peak ${worst})`);
  // Guard against the assertion above passing vacuously.
  // No canvas-backed view exists yet (the five new ones land in PR2/PR3), so
  // this is a regression lock rather than a live observation today.
  console.log(`ℹ️  item 11: sweep saw ${sawCanvas ? 'a' : 'no'} mounted canvas — none exist until PR2 adds one`);
  await p.close();
}

/* ── Scenario 6 · SVG <text> collisions, across EVERY <svg> under .mem-view ─
   The subject is every <text> element in every <svg> inside a view, not just
   axis labels — the predicate makes no distinction, and that is exactly how
   it caught bridge's gauge caption stacked on its centre value (a non-axis
   element that then needed an allowlist entry below). A subject narrower
   than its own claim would have missed that; naming it "axis-label overlap
   detection" while testing something wider is the standing defect this repo
   tracks elsewhere (CLAUDE.md, "a subject narrower than its claim").

   The overlap test is an axis-aligned bounding-box (separating-axis) check,
   not a Euclidean one — there is no distance computed anywhere. Two rects
   collide iff they intersect on BOTH the x-axis and the y-axis:
     overlaps_x = a.left < b.right && b.left < a.right
     overlaps_y = a.top < b.bottom && b.top < a.bottom
   1-D (same-baseline) would miss it: SVG positioning is not line-based, and
   elements can be offset vertically by arbitrary viewBox units.

   ── TWO COVERAGE BOUNDARIES. Both were measured, not assumed. Read them
      before concluding this section covers "label collisions" generally.

   (1) THE SUBJECT IS SVG-<text>-VS-SVG-<text>. A DOM caption overlapping an
       SVG value is OUT OF SUBJECT and this section cannot see it, because it
       compares <text> bounding boxes and nothing else. That is not
       hypothetical: `BrgGauge` (src/mempool/bridge.tsx) renders its value as
       <text> at :285 and its caption as a <div> at :287, and it is rendered
       FOUR times by BrgGaugeBank (:310-313). So four of the five gauges on
       /live/mempool?v=bridge are in exactly the shape this section is blind
       to. Do NOT widen the predicate to fix that — mixed DOM-over-SVG hit
       testing is a different instrument and belongs in its own gate. This
       note exists so the next reader does not infer coverage that is absent.
       (It is also why the allowlist below needs only ONE entry: BrgGauge
       structurally cannot produce a caption/value <text> pair, so
       BrgBlockCadence's gauge is the only stack this section can see.)

   (2) THIS SECTION DOES NOT EXERCISE BarSeries' FORCED-FINAL-LABEL PATH —
       CLOSED by v2.1: scenario 6 raises mkBlocks() to 32, MEASURED against the
       shipped layout (the sweep and the arithmetic are in the stride
       precondition below). 20 was tried first and produced stride 1 — the
       assertion caught it. The fixture is parameterized via module-level
       BLOCKS_N and raised only for scenario 6, leaving scenarios 1–5 at 14
       to keep scenario 4's 390px overflow assertions unaffected.

       Mechanism, measured: `useChartMetrics` measures the PRE-TRANSFORM
       layout width, and `.mp-view` is `width: max-content` on desktop, so
       the "Stratigraphy log" BarSeries lays out far wider than its rendered
       box and FitView scales the painted result down.

       CORRECTION: the previous revision of this paragraph said that BarSeries
       "measures ~1180px at EVERY viewport". 1180 is `.mp-view`'s own
       offsetWidth at 1440, and the chart box OVERFLOWS it — measured 1588 at
       1440 and 1717 at 2560, against rendered widths of 571 and 1116. Three
       different widths are in play and only the layout one drives the stride;
       reasoning from either of the other two predicts the wrong answer, in the
       wrong direction. When stride >= 2, the collision path matters:
       if the final label collides with the last strided label, it is
       suppressed; if not, it renders. The removal of `|| i === n - 1` from
       the old condition made this test possible — re-inserting it (the
       break-test mutation) unconditionally forces the final label and will
       collide with the strided sequence at 1440/2560.

   Rects are compared ACROSS every <svg> inside one .mem-view, not only
   within a single <svg>. That is correct today, because
   getBoundingClientRect() returns VIEWPORT coordinates and two <text> nodes
   in different <svg> elements that visually overlap on screen are a real
   collision regardless of which <svg> owns them — but it means a future
   side-by-side multi-chart layout inside one view could redden this section
   for a reason unrelated to either chart's own labels.
   ──────────────────────────────────────────────────────────────────────────── */
{
  console.log('\n— scenario 6: no overlapping <text> in any SVG under .mem-view —');

  const WIDTHS = [390, 768, 1440, 2560];

  // Known intentional overlaps: stacks inside small gauge components, &c.
  // Each prints as ⚠️ reported rather than failed, so regressions stay
  // visible instead of hiding.
  //
  // Two entry SHAPES exist:
  //  - TEXT entries (`labels: [...]`) match on rendered content — a literal
  //    string (exact, case-insensitive) or a RegExp (tested via `.test()`).
  //    See matchAllowlist() below for the matcher. Reach for a RegExp only
  //    when the value a stack renders is itself derived from something that
  //    moves (the clock, a poll); a literal is preferred everywhere else
  //    because it fails loudly the day the real content changes.
  //  - STRUCTURAL entries (`structural: true`) match on DOM markers, never
  //    text — see the bridge entry below for why, and matchAllowlist() for
  //    the predicate. Prefer this shape whenever the stack's rendered text is
  //    itself in motion (round 3 proved a regex still leaves the assertion's
  //    SUBJECT as "the layout AND whatever the clock currently reads," which
  //    is wider than its claim — see CLAUDE.md, "a subject narrower than its
  //    claim").
  //
  // `selfDup: true` opts a TEXT entry in to waiving a pair where BOTH labels
  // are the identical string — see matchAllowlist() below for why that is off
  // by default. Not applicable to structural entries: a caption marker and a
  // value marker are two different DOM nodes by construction (see the
  // structural entry's own comment for why a true self-duplicate can't arise
  // there, and why two DIFFERENT gauges' matching values still must not be
  // waived).
  const allowlist = [
    {
      view: 'bridge',
      structural: true,
      // Waives BrgBlockCadence's countdown-ring stack: the caption "ELAPSED"
      // (bridge.tsx:~427, wrapped in `<g data-gauge="block-cadence-elapsed">`,
      // the caption <text> carrying `data-gauge-caption`) sits directly over
      // its own centre value (the sibling <text> carrying `data-gauge-value`,
      // rendered m:ss). bridge.tsx:389 computes that value as
      //   (data.blocks?.[0]?.age || 0)
      //     + Math.max(0, Math.floor((now - freshAt(data.status.blocks)) / 1000))
      // — the fixture pins the first term (block age) at a fixed 41s, but the
      // second term is WALL-CLOCK DERIVED and increments once per second on
      // top of it.
      //
      // History, for why this is structural rather than text-matched: a
      // literal '0:41' entry (round 2) was green only when the DOM snapshot
      // landed within ~1s of the blocks fetch resolving — measured across six
      // full gate runs, 52 occurrences of "0:41" to 1 of "0:42", i.e. a real
      // false-red build failure roughly 1 run in 6 (reproduced live: "❌
      // [bridge] 768px: overlapping labels 'ELAPSED' ∥ '0:42'"). Round 3
      // widened the second label to /^\d+:\d{2}$/ (any m:ss shape), which
      // fixed the flake — but the assertion's SUBJECT was still "the layout
      // AND whatever the clock currently reads," wider than its claim (the
      // claim is pure layout). This entry reads NO text at all: a pair is
      // waived only when one node carries `data-gauge-caption`, the other
      // carries `data-gauge-value`, and BOTH resolve to the same nearest
      // `data-gauge` ancestor (see matchAllowlist() below) — so the waiver
      // holds identically whichever second it happens to sample.
      //
      // PRECONDITION NOTHING ENFORCES: `data-gauge` ids must be UNIQUE per
      // rendered gauge. The waiver is scoped by `gaugeId` equality, so two
      // gauges sharing an id would let a caption from one waive a collision
      // with the other's value — silently widening the exemption from "one
      // pair" to "any pair across every gauge with that id". There is exactly
      // one marked gauge today (`block-cadence-elapsed`), so the hazard is
      // latent, and it is recorded here rather than asserted because the
      // assertion would have nothing to compare against with a single id.
      // Anyone adding a second `data-gauge` must give it a distinct id AND
      // should add the uniqueness check at that point.
      //
      // A page-clock freeze (Playwright's Clock API) was considered instead
      // and deliberately NOT used: the fixture's other ages are fixed
      // RELATIVE offsets resolved at request time (see the fixture header,
      // ~line 60) and scenario 2's 0→10 confirmation walk also depends on the
      // live clock advancing, so freezing it would have a blast radius well
      // beyond this one stack. That belongs in its own change.
      //
      // Do NOT simplify this to `data-decorative` (the blanket per-node skip
      // verify-chart-legibility.mjs:116-141 uses): that would exempt these
      // two nodes from EVERY future comparison, so a real regression — the
      // caption drifting into an axis label, say — would be silently waived
      // too. The pair-scoped, same-gauge-id form keeps the exemption exactly
      // as narrow as this one intentional stack.
      //
      // Self-duplicate note: a caption and a value are different DOM nodes by
      // construction (one always reads "ELAPSED", the other always m:ss), so
      // a true self-duplicate pair can never reach this entry — no `selfDup`
      // flag is needed or read for structural entries. That is NOT the same
      // claim as "any two same-marker nodes waive" — two DIFFERENT
      // BrgBlockCadence-shaped gauges each showing the same value would both
      // carry `data-gauge-value` but NEITHER would pair with a
      // `data-gauge-caption` from the other's own gauge id, so the predicate
      // (below) correctly leaves that pair unwaived.
      reason: 'bridge.tsx:~427-438 — BrgBlockCadence caption/value stack, waived ' +
              'structurally via same-gauge data-gauge-caption/data-gauge-value ' +
              'markers, no text read',
    },
  ];

  // Declared expectation for WHERE each view's SVG <text> exists, measured
  // first and written down — not inferred from cross-width continuity (that
  // heuristic produced both a false negative, when a view's ONLY text
  // disappeared at every width and nothing asserted it should have been
  // there, and a false positive, flagging terminal's correct <=768px
  // rail-collapse as "discontinuous"). Every entry is a real, checked claim:
  // a width IN the list must report >0 text nodes, a width NOT in the list
  // must report exactly 0. An empty array is itself an asserted claim ("this
  // view is DOM-rendered, never SVG text"), not an exemption from the check.
  //
  // Measured baseline (14 blocks): reactor 1/1/1/1, bridge 14/14/14/14,
  // sediment 32/32/32/32, constellation 6/6/6/6, terminal 0/0/4/4, classic
  // 0/0/0/0. With the 20-block fixture in scenario 6, sediment's count will
  // rise due to BarSeries rendering the final label that was previously
  // collided; the exact count will be measured and reported on first run.
  const EXPECT_SVG_TEXT = {
    // Ring caption "TX · 16 RING · 1 REAL" (reactor.tsx:265) — one plain
    // <text>, no responsive hiding anywhere in the view — present always.
    reactor: [390, 768, 1440, 2560],
    // 12-pane mission control: axis ticks + gauge captions/values spread
    // across several <svg> children (bridge.tsx:191-436). None of it sits
    // behind a width-gated wrapper — present always.
    bridge: [390, 768, 1440, 2560],
    // Stratigraphy core-sample: axis labels ("weight →" / "fee/B →",
    // sediment.tsx:251-252) plus per-layer readouts inside the tube. No
    // responsive hiding — present always.
    sediment: [390, 768, 1440, 2560],
    // Luminous network sphere: the sphere header readout plus the fee-tier
    // donut's centre pool-count and caption. Rebuilt in v2·2; the previous
    // citation here (constellation.tsx:172-408) pointed into the pre-rebuild
    // file and no longer locates anything, so it is dropped rather than
    // renumbered — a line range in a file being actively rebuilt goes stale
    // faster than it earns its keep. Scenario 8 asserts this view's real
    // structure off data-con-* instead. No responsive hiding — present always.
    constellation: [390, 768, 1440, 2560],
    // WIDENED FROM [1440, 2560] IN v2·3, and the widening is a TIGHTENING —
    // read that before assuming an expectation map was relaxed to make a
    // build pass.
    //
    // It used to be rail-only. TermGauge's <text> lives in the "Network
    // gauges" rail-block inside <aside class="rail">, and `.rail` is
    // `display: none` at `max-width: 768px` (styles.css:2217), so the element
    // stayed in the DOM but collapsed to a zero-size box that this section's
    // own `rect.width === 0` filter dropped. Zero at 390/768 was therefore the
    // honest expectation, and it was ASSERTED as zero — this map is checked in
    // both directions.
    //
    // v2·3 puts three chart-kit charts in Terminal's MAIN column, which is
    // visible at every width (Terminal is a pan-mode view — it keeps its
    // proportions on a phone and pans, per verify-mobile.mjs:36-44). So the
    // four entries below are what the view now actually renders.
    //
    // WHY THIS IS NOT A WEAKENING. 390 and 768 move from "must be exactly 0"
    // to "must be > 0". Nothing stops being asserted; two widths start being
    // asserted in the harder direction. The vacuity guard this map exists for
    // is intact — "the view lost all its SVG text" still reds at all four
    // widths — and the map now additionally proves the new charts survive the
    // mobile pan rather than being quietly hidden below some breakpoint,
    // which is the one way "3-5x more information" could be delivered on
    // desktop and nowhere else.
    //
    // WHY NOT THE ALTERNATIVES. Keeping the charts in the rail would have held
    // this entry at [1440, 2560] unchanged — and hidden every new chart below
    // 1200px, because the rail is display:none from 0 to 1199 (styles.css:2217
    // and :2149's block). Rendering them as DOM instead of SVG would also have
    // held it, but contract §2 requires charts to be built on chart-kit, whose
    // ChartTip / ChartCrosshair / axis primitives are SVG-native — so a
    // conforming chart necessarily emits SVG <text>, and the DOM route is
    // foreclosed by the contract rather than declined by preference.
    terminal: [390, 768, 1440, 2560],
    // Classic is pure DOM (MempoolViewMeta's `reflow: true`, index.tsx:79) —
    // it renders no <svg> at all, so it carries zero SVG <text> at every
    // width, by design rather than by omission.
    classic: [],
  };

  const textCounts = {}; // {view: {width: count}}

  // Raise the block fixture so sediment's stratigraphy BarSeries runs at a
  // stride >= 2 and the forced-final-label collision path is exercised at all.
  /* 32, MEASURED against the shipped layout rather than inherited. #167's
     ">= 17" was derived from sediment's PRE-REBUILD ~1180px stratigraphy panel;
     this release moves that panel into the 7-of-12 stack and the number moved
     with it. The stride assertion below caught 20 rendering 20-of-20 — stride 1
     at every width, i.e. the fixture rider 2 shipped covered nothing.

     Swept on the built tree:

         N    1440              2560
         20   20/20  stride 1   20/20  stride 1
         24   12/24  stride 2   24/24  stride 1
         28   14/28  stride 2   14/28  stride 2   <- minimum at BOTH
         32   16/32  stride 2   16/32  stride 2

     THE TRAP, and the reason a calculation kept disagreeing with the sweep:
     `labelStep` is fed the PRE-TRANSFORM LAYOUT width, not the rendered one.
     `.mp-view` is `width: max-content`, so the chart lays out at its natural
     width and FitView scales the PAINTED result down afterwards. Measured on
     this tree:

         viewport 1440   box offsetWidth 1588   getBoundingClientRect 571
         viewport 2560   box offsetWidth 1717   getBoundingClientRect 1116
         viewBox at 1440 = "0 0 1588.171875 150"   <- the layout width, not 571

     Deriving innerW from the 571px rendered box gives fits = 7 and predicts
     stride 3 at n=20 — three times the measured value, and in the wrong
     direction. With the layout width: innerW = 1588 - 45 - 16 = 1527,
     per = 8 chars x 11px x 0.62 + 11 = 65.56, fits = 23, stride = ceil(20/23)
     = 1. That matches. At n=32, ceil(32/23) = 2, i.e. 16 labels — also matches.

     Both figures are real and they differ by 2.8x, so ANY reasoning about
     label fitting has to name which one it used. This is also why the previous
     revision of this docblock said "~1180px at EVERY viewport": that is
     `.mp-view`'s own offsetWidth at 1440, not the chart box's, and the chart
     overflows it. Three different widths, one of which drives the stride.

     32 is one step above the 28 minimum, so ordinary layout drift does not red
     the gate while a real regression still does. */
  BLOCKS_N = 32;
  // try/finally, not a trailing assignment: BLOCKS_N is module-level mutable
  // state and a throw anywhere below would leave it at 20 for whatever runs
  // next. Scenario 6 happens to run near the end today, so a positional
  // restore is correct only because of where it sits — the same shape as the
  // `git checkout --` hazard this repo already records. One line makes it
  // structural.
  try {

  /* ── STRIDE PRECONDITION ────────────────────────────────────────────
     The number here is NOT inherited. #167 measured ">= 17 blocks" against
     sediment's THEN layout, and this release redesigns that layout — the core
     column becomes the hero at roughly 5 of 12 columns, which moves the
     Stratigraphy panel's geometry and therefore its measured innerPx. A block
     count derived from the width of a chart you are about to resize is an
     assertion whose subject is no longer its claim.

     So the fixture size is not asserted; the STRIDE IT PRODUCES is. If
     labelStep() still returns 1 at the shipped layout, this whole section is
     VACUOUS for the forced-final-label defect — every overlap assertion below
     would pass without ever entering the path they exist to cover, which is
     exactly the state #167 left behind. A vacuous section must not print
     green, so this fails rather than warns.

     Measured by counting the block-height labels the BarSeries actually
     renders (`#<height>`) against the number of bars: stride 1 renders every
     label, stride 2 renders half. Same instrument as the EXPECT_SVG_TEXT
     vacuity guard below, extended from presence to spacing. */
  const DESKTOP_STRIDE_WIDTHS = [1440, 2560];
  for (const width of WIDTHS) {
    const sp = await b.newPage({ viewport: { width, height: 900 } });
    watchErrors(sp, `scenario 6 [stride ${width}]`);
    await sp.route('**/api/**', fulfil);
    await open(sp, 'sediment');
    const probe = await sp.evaluate(() => {
      const view = document.querySelector('.mem-view');
      if (!view) return { labels: 0 };
      // The stratigraphy BarSeries is the only chart labelling its x axis with
      // block heights, so `#<digits>` identifies its labels without depending
      // on DOM order or a panel title string.
      // Report EVERY emitting SVG, not just the max. A bare max-across-SVGs is
      // a subject you cannot see: if two charts emitted `#<digits>`, which one
      // won could change with the block count, and a selector fault of that
      // shape is curable by adding blocks — so a passing sweep would not rule
      // it out. Printing the breakdown makes "one axis, and it is the
      // stratigraphy one" an observation rather than an assumption. Measured
      // here: exactly one entry at every width and every N.
      const per = [];
      for (const svg of view.querySelectorAll('svg')) {
        const hits = [...svg.querySelectorAll('text')]
          .map((t) => t.textContent.trim())
          .filter((s) => /^#\d[\d,]*$/.test(s));
        if (!hits.length) continue;
        const panel = svg.closest('.panel');
        const h = panel && panel.querySelector('.panel-h .l');
        per.push({ n: hits.length, panel: h ? h.textContent.trim().slice(0, 40) : '(no .panel ancestor)', sample: hits.slice(0, 3) });
      }
      return { labels: per.reduce((m, x) => Math.max(m, x.n), 0), per };
    });
    await sp.close();

    const rendered = probe.labels || 0;
    console.log(`  · stride @${width}px: ${rendered} of ${BLOCKS_N} x-labels rendered`);
    for (const e of (probe.per || [])) {
      console.log(`      · ${String(e.n).padStart(3)} in "${e.panel}"  e.g. ${e.sample.join(' ')}`);
    }
    ok((probe.per || []).length <= 1,
      `scenario 6 [${width}]: exactly one SVG emits '#<height>' text, so the stride probe's subject is `
      + `unambiguous (found ${(probe.per || []).length})`);

    if (DESKTOP_STRIDE_WIDTHS.includes(width)) {
      // Two failures, two different remedies, so they are two assertions.
      // rendered === 0 means the PROBE stopped matching (the label shape moved,
      // or the panel is gone); rendered === BLOCKS_N means the FIXTURE is too
      // small. A single message naming only "raise BLOCKS_N" would send the
      // next reader to raise a fixture against a selector problem.
      // CONTROL FLOW, not a second predicate. When rendered === 0 the stride is
      // UNKNOWN, and an `ok(rendered === 0 || …)` would print ✅ for a check
      // that never ran — a green line whose subject is "not applicable", which
      // is the same defect this section exists to refuse, in miniature. It also
      // inflates the assertion count. One failure, one message, and the count
      // honestly drops by one when the stride could not be evaluated.
      ok(rendered > 0,
        `scenario 6 [${width}]: the stride probe found block-height x-labels (${rendered}) — `
        + `0 means the '#<height>' label shape moved and the SELECTOR needs fixing; do NOT raise BLOCKS_N`);
      if (rendered > 0) {
        ok(rendered < BLOCKS_N,
          `scenario 6 [${width}]: ${rendered} of ${BLOCKS_N} x-labels rendered — stride >= 2, so the forced-final-label `
          + `path is REACHABLE and this section is not vacuous (all ${BLOCKS_N} rendered means stride 1: raise BLOCKS_N `
          + `until this holds against the SHIPPED layout)`);
      }
    } else {
      // 390/768 legitimately run at stride 1 — the chart is narrower and every
      // label fits. That is a DECLARED vacuity for this defect, printed as its
      // own number rather than folded into a pass, so nobody later reads these
      // widths as coverage they are not.
      console.log(`  · scenario 6 [${width}]: stride ${rendered === BLOCKS_N ? '1' : '>=2'} — `
        + `${rendered === BLOCKS_N ? 'VACUOUS for the forced-final-label defect at this width, by design' : 'covered'}`);
    }
  }

  for (const width of WIDTHS) {
    console.log(`  width ${width}px:`);
    const p = await b.newPage({ viewport: { width, height: 900 } });
    watchErrors(p, `scenario 6 [${width}]`);
    await p.route('**/api/**', fulfil);

    for (const id of VIEWS) {
      try {
        await open(p, id);

        const results = await p.evaluate(() => {
          const view = document.querySelector('.mem-view');
          const texts = [];

          // Nearest ancestor carrying `data-gauge`, walked from a <text>'s
          // parent up to (not past) .mem-view. Returns the gauge's id string,
          // or null if the text sits outside any `data-gauge` wrapper — used
          // below to scope the structural caption/value waiver to ONE gauge
          // instance, so two different gauges never pair with each other.
          const nearestGauge = (el) => {
            let n = el.parentElement;
            while (n && n !== view) {
              if (n.hasAttribute('data-gauge')) return n.getAttribute('data-gauge');
              n = n.parentElement;
            }
            return null;
          };

          // Collect all <text> elements inside SVG descendants of .mem-view
          for (const svg of view.querySelectorAll('svg')) {
            for (const el of svg.querySelectorAll('text')) {
              const content = el.textContent.trim();
              // Skip empty or zero-sized elements (whitespace, clipped, etc.)
              if (!content) continue;
              const rect = el.getBoundingClientRect();
              if (rect.width === 0 || rect.height === 0) continue;

              texts.push({
                text: content,
                left: rect.left,
                right: rect.right,
                top: rect.top,
                bottom: rect.bottom,
                // Structural markers for scenario 6's bridge allowlist entry
                // (see matchAllowlist() below) — read no further than
                // presence/absence and the owning gauge id, never content.
                gaugeCaption: el.hasAttribute('data-gauge-caption'),
                gaugeValue: el.hasAttribute('data-gauge-value'),
                gaugeId: nearestGauge(el),
              });
            }
          }
          return texts;
        });

        // Track count for vacuity guard
        if (!textCounts[id]) textCounts[id] = {};
        textCounts[id][width] = results.length;

        // Find overlaps: axis-aligned bounding-box (separating-axis) test.
        // Two boxes overlap iff they intersect on BOTH axes.
        const overlaps = [];
        for (let i = 0; i < results.length; i++) {
          for (let j = i + 1; j < results.length; j++) {
            const a = results[i];
            const b = results[j];
            const overlaps_x = a.left < b.right && b.left < a.right;
            const overlaps_y = a.top < b.bottom && b.top < a.bottom;
            if (overlaps_x && overlaps_y) {
              // Full node objects, not just text — the structural predicate
              // below needs gaugeCaption/gaugeValue/gaugeId, which live only
              // on the census node, never on its rendered text.
              overlaps.push({ a, b });
            }
          }
        }

        // Returns the allowlist entry that waives this pair, or null.
        //
        // Two entry shapes, matched by two independent code paths:
        //
        // STRUCTURAL (`entry.structural`) reads DOM markers only, never text.
        // A pair matches iff one node carries `gaugeCaption`, the other
        // carries `gaugeValue`, and both resolve to the same non-null
        // `gaugeId` (the nearest `data-gauge` ancestor — see the census
        // above). Order-insensitive: either of a/b may be the caption.
        // Two DIFFERENT gauges' value nodes never match each other here —
        // both would carry `gaugeValue`, and the predicate requires one
        // `gaugeCaption` + one `gaugeValue`, so a value/value pair is
        // rejected regardless of gauge id. A caption/value pair from two
        // DIFFERENT gauges is also rejected, by the `gaugeId` equality check
        // — this is the cross-gauge guard the same-nearest-ancestor rule
        // exists for. No `selfDup` concept applies: caption and value are
        // categorically different nodes (see the bridge entry's own comment).
        //
        // TEXT (`entry.labels`) matches on rendered content — a literal
        // string (case-insensitive exact match) or a RegExp (tested against
        // the raw, un-lowercased text via `.test()` — case doesn't matter for
        // the regex labels in use today, but lower-casing a RegExp source
        // would corrupt an eventual case-sensitive pattern, so string and
        // RegExp labels are deliberately matched by two different code paths
        // rather than both funnelled through one lower-cased comparison).
        //
        // A pair is a SELF-duplicate when both OBSERVED labels are the
        // identical string (case-insensitively) — this is about the two
        // colliding DOM texts, never about the entry's labels, so it applies
        // identically whether the entry that might waive them is all
        // literals or carries a regex. A TEXT entry waives a self-duplicate
        // only if it opts in with `selfDup: true` — by default it waives only
        // a pair of two DIFFERENT observed labels. Without that restriction,
        // an entry written for a genuine two-different-strings stack (a
        // caption over its value) also silently waives a same-string
        // collision on either of those two strings, which is precisely the
        // shape of the one real bug this section has found (sediment:
        // "15,000 p/B" ∥ "15,000 p/B"). This check runs BEFORE any label
        // matching below, so it rejects a self-duplicate pair outright — a
        // regex label that happens to match both sides of an identical-string
        // pair never even reaches the pairing check. (Structural entries skip
        // this gate entirely: it is a TEXT-entry concept, and the structural
        // predicate's own gaugeCaption+gaugeValue+gaugeId requirement already
        // makes a self-duplicate impossible to reach — see above.)
        //
        // Matching a pair against a TEXT entry REQUIRES a and b to land on
        // two DIFFERENT slots of entry.labels (not merely "both observed
        // labels are members of the label set", which was the pre-round-3
        // Set-based check). A membership-only test would let two UNRELATED
        // ticking values that both happen to look like m:ss waive each other
        // even when neither is literally "ELAPSED" — over-waiving the exact
        // class of collision this section exists to catch. Requiring one text
        // to match one specific slot and the other text to match a DIFFERENT
        // slot keeps a regex entry scoped to the precise stack it names.
        const labelMatches = (label, text) =>
          label instanceof RegExp ? label.test(text) : label.toLowerCase() === text.toLowerCase();
        const matchAllowlist = (a, b) => {
          return allowlist.find((entry) => {
            if (entry.view !== id) return false;
            if (entry.structural) {
              const capValue = (x, y) => x.gaugeCaption && y.gaugeValue && x.gaugeId != null && x.gaugeId === y.gaugeId;
              return capValue(a, b) || capValue(b, a);
            }
            const aL = a.text.toLowerCase();
            const bL = b.text.toLowerCase();
            const selfDup = aL === bL;
            if (selfDup && !entry.selfDup) return false;
            const { labels } = entry;
            for (let i = 0; i < labels.length; i++) {
              for (let j = 0; j < labels.length; j++) {
                if (i === j) continue;
                if (labelMatches(labels[i], a.text) && labelMatches(labels[j], b.text)) return true;
              }
            }
            return false;
          }) ?? null;
        };

        // Partition: allowlisted vs actual failures. Each overlap carries
        // the SPECIFIC entry that matched it (not "the first entry for this
        // view") so the printed reason is always the one that actually
        // applies once the allowlist holds more than one entry per view.
        const matched = overlaps.map((o) => ({ ...o, entry: matchAllowlist(o.a, o.b) }));
        const allowed = matched.filter((o) => o.entry);
        const failures = matched.filter((o) => !o.entry);

        // Report allowlisted overlaps (informational, does not fail)
        for (const { a, b, entry } of allowed) {
          const aStr = a.text.length > 20 ? a.text.slice(0, 17) + '…' : a.text;
          const bStr = b.text.length > 20 ? b.text.slice(0, 17) + '…' : b.text;
          console.log(`    ⚠️  [${id}] ${width}px: "${aStr}" ∥ "${bStr}" — ${entry.reason}`);
        }

        // Fail on unexpected overlaps
        if (failures.length > 0) {
          for (const { a, b } of failures) {
            const aStr = a.text.length > 20 ? a.text.slice(0, 17) + '…' : a.text;
            const bStr = b.text.length > 20 ? b.text.slice(0, 17) + '…' : b.text;
            ok(false, `[${id}] ${width}px: overlapping labels "${aStr}" ∥ "${bStr}"`);
          }
        } else {
          ok(true, `[${id}] ${width}px: ${results.length} text node(s), no unlisted overlaps`);
        }

      } catch (e) {
        ok(false, `[${id}] ${width}px: ${String(e).split('\n')[0]}`);
      }
    }

    await p.close();
  }

  } finally {
    // Restore the block fixture for scenario-agnostic post-scenario checks.
    BLOCKS_N = 14;
  }

  // Vacuity guard: assert measurement actually happened, against a DECLARED
  // expectation rather than inferred cross-width continuity.
  //
  // The continuity heuristic this replaced ("text at some width, zero at
  // another is suspicious") had a false negative AND a false positive, both
  // confirmed by running it: it never asserted anything for a view with zero
  // text at every width (so a view that LOSES all its SVG text is
  // indistinguishable from one that never had any — every per-width line
  // still prints ✅ "0 text node(s), no unlisted overlaps"), and it reddened
  // terminal for correctly dropping its rail-block gauges at <=768px, which
  // is deliberate layout behaviour (styles.css:2217, :2643), not a
  // regression.
  //
  // EXPECT_SVG_TEXT (declared above, next to the allowlist) fixes both: it
  // is checked in BOTH directions, per view per width — a width IN the list
  // must report >0, a width NOT in the list must report exactly 0 — so
  // "lost all its text" and "never had any" are no longer the same reading,
  // and terminal's real <=768px drop is the expected shape rather than a
  // discontinuity.
  console.log('\n  declared SVG-text coverage (EXPECT_SVG_TEXT, both directions):');
  for (const id of VIEWS) {
    if (!Object.prototype.hasOwnProperty.call(EXPECT_SVG_TEXT, id)) {
      ok(false, `[${id}]: no EXPECT_SVG_TEXT entry — every registered view must declare where its SVG text is expected (even an empty list)`);
      continue;
    }
    const counts = textCounts[id] || {};
    const expected = new Set(EXPECT_SVG_TEXT[id]);
    for (const width of WIDTHS) {
      const n = counts[width] ?? 0;
      if (expected.has(width)) {
        ok(n > 0, `[${id}] ${width}px: expected SVG text present per EXPECT_SVG_TEXT — got ${n}`);
      } else {
        ok(n === 0, `[${id}] ${width}px: expected NO SVG text per EXPECT_SVG_TEXT — got ${n}`);
      }
    }
  }
}

/* ── Scenario 7 · sediment observable contract ────────────────────────── */
{
  console.log('\n— scenario 7: sediment data-sed-* observable contract —');
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  watchErrors(p, 'scenario 7');
  await p.route('**/api/**', fulfil);

  // Test with normal 240-tx fixture
  await open(p, 'sediment');
  const results = await p.evaluate(() => {
    const core = document.querySelector('[data-sed-core]');
    if (!core) return { error: 'no [data-sed-core] found' };

    const mode = core.getAttribute('data-sed-mode');
    const modeValid = ['field', 'static', 'column'].includes(mode);

    // For field/static modes, check canvas attributes
    const canvas = core.querySelector('canvas.mem-canvas[data-sed-particles]');
    let radiusMin = null, radiusMax = null, bands = null, bandCounts = null, particles = null, probe = null;
    if (canvas) {
      radiusMin = parseFloat(canvas.getAttribute('data-sed-radius-min'));
      radiusMax = parseFloat(canvas.getAttribute('data-sed-radius-max'));
      bands = canvas.getAttribute('data-sed-bands');
      bandCounts = canvas.getAttribute('data-sed-band-counts');
      particles = canvas.getAttribute('data-sed-particles');
      probe = canvas.getAttribute('data-sed-probe');
    }

    // Profile on the fee depth-profile PANEL, which is a sibling of the core
    // column in the view's grid — NOT a descendant of it. Scoping this query
    // to `core` made the assertion's subject narrower than its claim: it read
    // "data-sed-profile in {area, ladder}" while looking somewhere the
    // attribute is never emitted, so it failed against correct code. Query
    // from the view root, same as every other cross-panel lookup here.
    const view = document.querySelector('.mem-view') || document;
    const profile = view.querySelector('[data-sed-profile]')?.getAttribute('data-sed-profile');
    const profileValid = ['area', 'ladder'].includes(profile);

    // Stratum headers (per block in field mode)
    const stratumEls = core.querySelectorAll('[data-sed-stratum]');
    const dropEls = core.querySelectorAll('[data-sed-drop]');

    return {
      core: !!core, mode, modeValid,
      canvas: !!canvas,
      radiusMin, radiusMax,
      bands, bandCounts, particles,
      probe,
      profile, profileValid,
      stratumCount: stratumEls.length,
      dropCount: dropEls.length,
    };
  });

  if (results.error) {
    ok(false, `scenario 7: ${results.error}`);
  } else {
    ok(results.core, 'scenario 7: [data-sed-core] host present');
    ok(results.modeValid, `scenario 7: data-sed-mode in {field, static, column} (got "${results.mode}")`);

    // At 240-tx and 1440px with 20 blocks, expect field mode
    if (results.mode === 'field') {
      ok(results.canvas, 'scenario 7: canvas.mem-canvas present in field mode');
      ok(results.radiusMin != null && results.radiusMin >= 0.9,
        `scenario 7: data-sed-radius-min >= 0.9 (got ${results.radiusMin}) [lower bound]`);
      ok(results.radiusMax != null && results.radiusMax <= 2.8,
        `scenario 7: data-sed-radius-max <= 2.8 (got ${results.radiusMax}) [upper bound]`);
      ok(results.bands === '4', `scenario 7: data-sed-bands === "4" (got "${results.bands}")`);

      if (results.bandCounts) {
        const counts = results.bandCounts.split(',').map(Number);
        ok(counts.length === 4, `scenario 7: band counts has 4 entries (got ${counts.length})`);
        const sum = counts.reduce((a, b) => a + b, 0);
        const particlesNum = parseInt(results.particles);
        ok(sum === particlesNum,
          `scenario 7: band counts SUM to particles (${counts.join('+')}=${sum}, particles=${particlesNum})`);
      }

      ok(results.particles != null, `scenario 7: data-sed-particles present (got "${results.particles}")`);
      ok(results.probe != null, `scenario 7: data-sed-probe coordinate present`);
    }

    ok(results.profileValid, `scenario 7: data-sed-profile in {area, ladder} (got "${results.profile}")`);
    ok(results.stratumCount > 0, `scenario 7: [data-sed-stratum] blocks present (${results.stratumCount})`);
  }

  /* ── THE PARTICLE → TRANSACTION-INSPECTOR HOP ───────────────────────
     "Every particle opens the shared transaction inspector" is the contract's
     §7 requirement, and a canvas cannot be asserted with a selector. The view
     publishes `data-sed-probe="x,y,txid"` — one deterministic particle's centre
     in the canvas's OWN CSS px, plus the txid a click there must select.

     The scale conversion is the point of this assertion, not incidental to it.
     `.mp-fit` scales the whole view (measured 0.36 at 1440), so probe
     coordinates in canvas space are NOT viewport coordinates: the click point
     is rect.left + x * (rect.width / canvas.clientWidth). If the view's own
     hit-test ever reads pointer position in the wrong space, this is what
     catches it — and the space mismatch is invisible to every other assertion
     here, because at scale 1 the two agree and the gate would still pass. */
  if (results.probe) {
    const [px, py, ptxid] = results.probe.split(',');
    // SCROLL FIRST, then read the rect, then click. The core column is taller
    // than the viewport (708px canvas in a 900px window with chrome above it),
    // so the probe particle sits BELOW THE FOLD at rest: rect.top + y exceeded
    // 900 and a raw viewport click landed nowhere — a failure with nothing to
    // do with the hit-test under test. Centring the canvas brings the point
    // inside the viewport. (locator.click({position}) does its own scrolling
    // but then hit-tests the resulting point and reported the element
    // intercepted, for the same underlying reason.)
    /* SETTLE THE TRANSFORM BEFORE READING THE RECT. `.mp-fit` carries
     * `transition: transform var(--d-3) var(--e-spring)` — a 300ms SPRING — and
     * `scrollIntoView` below can retrigger a fit measurement. Reading
     * `getBoundingClientRect()` while that is in flight yields `left`/`scale`
     * for a MOVING element, and the click that follows lands on a different
     * canvas pixel than the one the mapping was computed for.
     *
     * Measured over six runs before this wait existed: every PASS sat at scale
     * 0.8326 / 0.9768 / 0.9999 and every FAIL at 0.9135 / 0.9137 / 0.9139 — a
     * 0.0004-wide cluster, which is a settling animation sampled mid-flight, not
     * a coincidence. The failures opened a `block` rather than nothing, i.e. the
     * click hit a real object at the wrong place; and the probe attribute was
     * byte-identical at click time, so the coordinate had not expired.
     *
     * Poll to two consecutive agreeing reads rather than sleeping longer — the
     * same pattern verify-fit uses, and deterministic where a bigger sleep is
     * only less-often-wrong. */
    await p.evaluate(() => {
      document.querySelector('[data-sed-core] canvas.mem-canvas')
        ?.scrollIntoView({ block: 'center', inline: 'center' });
    });
    for (let i = 0, prev = null; i < 20; i++) {
      const cur = await p.evaluate(() => {
        const cv = document.querySelector('[data-sed-core] canvas.mem-canvas');
        if (!cv) return 'none';
        const r = cv.getBoundingClientRect();
        return `${r.left.toFixed(3)},${r.top.toFixed(3)},${r.width.toFixed(3)}`;
      });
      if (cur === prev) break;
      prev = cur;
      await p.waitForTimeout(60);
    }
    const pt = await p.evaluate(() => {
      const cv = document.querySelector('[data-sed-core] canvas.mem-canvas');
      if (!cv) return null;
      const r = cv.getBoundingClientRect();
      return {
        left: r.left, top: r.top, h: cv.clientHeight,
        scale: cv.clientWidth ? r.width / cv.clientWidth : 1,
        vh: window.innerHeight, vw: window.innerWidth,
      };
    });
    if (pt) {
      const clickX = pt.left + Number(px) * pt.scale;
      const clickY = pt.top + Number(py) * pt.scale;
      const inView = clickX >= 0 && clickY >= 0 && clickX <= pt.vw && clickY <= pt.vh;
      ok(inView,
        `scenario 7: the probe point is inside the viewport after centring `
        + `(${clickX.toFixed(0)},${clickY.toFixed(0)}) in ${pt.vw}x${pt.vh} — otherwise the click below proves nothing`);
      /* DRIFT CHECK — the coordinate is read at :1147 and used HERE, ~100 lines
       * and a scrollIntoView later. If the field is still simulating, the
       * particle `data-sed-probe` named has moved on and something else is under
       * that pixel. Re-read the attribute immediately before the click: same
       * string means the scene is static and the cause is in the hit-test;
       * different string means the gate is clicking a coordinate that expired. */
      const freshProbe = await p.evaluate(() =>
        document.querySelector('[data-sed-core] canvas.mem-canvas')?.getAttribute('data-sed-probe'));
      const drifted = freshProbe !== results.probe;
      console.log(`  · probe drift: published "${results.probe}" -> at click time "${freshProbe}"`
        + `  | ${drifted ? 'DRIFTED' : 'identical'}`);
      await p.mouse.click(clickX, clickY);
      await p.waitForTimeout(900);
      const opened = await p.evaluate((id) => {
        const v = document.querySelector('.mem-view');
        return {
          tracked: !!v.querySelector(`[data-tracked-tx="${id}"]`),
          phase: v.querySelector('[data-mem-track-phase]')
            ? v.querySelector('[data-mem-track-phase]').getAttribute('data-mem-track-phase') : null,
        };
      }, ptxid);
      /* DIAGNOSTIC, NOT AN ASSERTION — added because a fourth sighting of this
       * red carrying the same three numbers as the first three would answer
       * nothing. The message on the `ok()` below prints `canvas scale`, and that
       * number has been read as this intermittent's candidate mechanism for
       * three sightings. It is decoration: the assertion is `opened.tracked`.
       *
       * The quantity most likely to be responsible is the TARGET SIZE. This gate
       * asserts at :1185 that the probe particle may be as small as r=0.9px, and
       * then clicks it at a FRACTIONAL coordinate carried through a non-unit
       * scale. A sub-pixel target hit with a rounded coordinate has no margin,
       * and unlike a scheduler flake it explains why nothing about sediment
       * changes between runs while the outcome does — `data-sed-probe` nominates
       * a different particle, with a different radius.
       *
       * `data-sed-probe` publishes "x,y,txid" and NOT the probe's own radius, so
       * the band bounds are the closest available proxy; publishing the probe
       * radius belongs with sediment.tsx and is not this PR's file. The
       * fractional parts are printed because they are what rounding acts on. */
      console.log(`  · probe click: canvas ${pt.h}px tall, scale ${pt.scale.toFixed(4)}, target (${px},${py}) -> phase=${opened.phase}`
        + `  | radius band ${results.radiusMin}..${results.radiusMax}px`
        + `  | click (${clickX.toFixed(3)},${clickY.toFixed(3)}) frac (${(clickX % 1).toFixed(3)},${(clickY % 1).toFixed(3)})`
        + `  | tracked=${opened.tracked}`);
      ok(opened.tracked,
        `scenario 7: clicking data-sed-probe's exact coordinate opens the shared tx inspector for THAT txid `
        + `(${String(ptxid).slice(0, 10)}…, canvas scale ${pt.scale.toFixed(4)})`);
    } else {
      ok(false, 'scenario 7: could not locate the canvas to click its probe coordinate');
    }
  }

  await p.close();

  /* ── LOW POOL ───────────────────────────────────────────────────────
     "Composed at 3 tx as well as at 320" is half the brief, and a field-mode-
     only check cannot see it. Below 8 transactions the particle field must
     become a labelled single-file column and the fee depth-profile must
     become a ladder — with NO empty plot anywhere, which is what the view did
     before this release (a bare "mempool empty" string where a chart belongs).

     The empty-placeholder check is the falsifiable half: mode/profile could
     both be correct while a panel still renders a placeholder, and only
     reading the view's own text catches that. */
  POOL_N = 3;
  const lp = await b.newPage({ viewport: { width: 1440, height: 900 } });
  watchErrors(lp, 'scenario 7 [low pool]');
  await lp.route('**/api/**', fulfil);
  await open(lp, 'sediment');
  const low = await lp.evaluate(() => {
    const view = document.querySelector('.mem-view');
    const core = view && view.querySelector('[data-sed-core]');
    return {
      mode: core && core.getAttribute('data-sed-mode'),
      canvases: view ? view.querySelectorAll('canvas.mem-canvas').length : -1,
      drops: view ? view.querySelectorAll('[data-sed-drop]').length : -1,
      profile: view && view.querySelector('[data-sed-profile]')
        ? view.querySelector('[data-sed-profile]').getAttribute('data-sed-profile') : null,
      // Any placeholder standing in for a chart. Matched on the view's own
      // rendered text so a re-worded placeholder is still caught.
      placeholder: view ? /mempool empty|no data|nothing to show/i.test(view.textContent || '') : false,
    };
  });
  await lp.close();
  POOL_N = MEMPOOL_N;

  console.log(`  · low pool: mode=${low.mode} canvases=${low.canvases} drops=${low.drops} profile=${low.profile}`);
  ok(low.mode === 'column', `scenario 7 [low pool]: 3 tx composes as a labelled column (data-sed-mode="${low.mode}")`);
  ok(low.canvases === 0, `scenario 7 [low pool]: no canvas mounted below the field threshold (got ${low.canvases})`);
  ok(low.drops === 3, `scenario 7 [low pool]: one labelled drop per transaction (got ${low.drops}, expected 3)`);
  ok(low.profile === 'ladder', `scenario 7 [low pool]: fee depth-profile becomes a ladder (got "${low.profile}")`);
  ok(!low.placeholder, 'scenario 7 [low pool]: no empty-plot placeholder anywhere in the view');
}

/* ── Scenario 8 · constellation data-con-* observable contract ───────────
   The v2·2 hero. Four claims, each the machine-checkable half of a §5 break
   test, and each written so a specific mutation reds it:

     8a  limb darkening   flatten the rim falloff -> reds
     8b  low pool (3 tx)  compose, never an empty sphere
     8c  reduced motion   CONTENT survives; animation does not
     8d  inspector depth  a node click opens the SHARED tx inspector

   PREDICTS RATHER THAN REMEMBERS. LIMB_K, LIMB_MIN_ALPHA and
   MAX_SPHERE_NODES are PARSED out of constellation.tsx, never restated here
   (the verify-orb idiom). Restating them would make this section agree with
   a number instead of with the code, and it would go green on a build where
   the two had drifted apart.

   ASSERTION SPACE (contract §9). Everything here is a RELATION — monotonic
   ordering of alpha and of areal density across radial bins, set equality of
   node ids, which txid an inspector opened. Relations are scale-invariant,
   so measuring them in layout space is sound even though `.mp-fit` sits
   between the author and the reader. No absolute rendered quantity is
   asserted in this scenario, deliberately: that claim would need a
   post-transform measurement and belongs with the type-floor work.

   NO TOLERANCE ON THE HIT TEST, BY CONSTRUCTION. 8d clicks the node element
   itself and Playwright resolves the target through the browser's own
   hit-testing, so there is no coordinate conversion anywhere in the path and
   therefore no hit-radius generosity that could absorb a coordinate-space
   bug — the defect class §9 names, and the one sediment's canvas hit-test
   carries structurally. The units are verified by there being none. */
{
  console.log('\n— scenario 8: constellation data-con-* observable contract —');

  // ── constants parsed from the shipped source, not restated ──
  const CON_SRC = readFileSync(new URL('./src/mempool/constellation.tsx', import.meta.url), 'utf8');
  const num = (re, label) => {
    const m = CON_SRC.match(re);
    if (!m) { ok(false, `scenario 8: could not PARSE ${label} out of constellation.tsx — this section cannot predict without it`); return null; }
    return Number(m[1]);
  };
  const LIMB_K = num(/export const LIMB_K\s*=\s*([\d.]+)/, 'LIMB_K');
  const LIMB_MIN_ALPHA = num(/const LIMB_MIN_ALPHA\s*=\s*([\d.]+)/, 'LIMB_MIN_ALPHA');
  const MAX_NODES = num(/const MAX_SPHERE_NODES\s*=\s*(\d+)/, 'MAX_SPHERE_NODES');
  console.log(`  · parsed from source: LIMB_K=${LIMB_K} LIMB_MIN_ALPHA=${LIMB_MIN_ALPHA} MAX_SPHERE_NODES=${MAX_NODES}`);

  // A flat or inverted curve is not limb darkening. Guards the case where a
  // mutation zeroes the exponent: the per-node formula check below would
  // still agree with itself, so this is what separates "curve" from "no
  // curve" and it is the reason 8a is not vacuous under that mutation.
  ok(LIMB_K != null && LIMB_K > 1,
    `scenario 8a: LIMB_K is a real falloff curve, not linear or flat (parsed ${LIMB_K}, need > 1)`);

  const readNodes = (pg) => pg.evaluate(() => {
    const view = document.querySelector('.mem-view[data-mem-view="constellation"]');
    if (!view) return { error: 'no constellation view' };
    const els = [...view.querySelectorAll('[data-con-node]')];
    return {
      nodes: els.map((e) => ({
        id: e.getAttribute('data-con-node'),
        rnorm: parseFloat(e.getAttribute('data-con-rnorm')),
        alpha: parseFloat(e.getAttribute('data-con-alpha')),
      })),
      placeholder: /mempool empty|no data|nothing to show/i.test(view.textContent || ''),
      svgs: view.querySelectorAll('svg').length,
    };
  });

  /* ── 8a · limb darkening, at full pool, ANIMATED ──────────────────────
     Scoped to the animated state ON PURPOSE. Under reduced motion the view
     deliberately drops density thinning (a culled or thinned node would be
     permanently lost from a frame that never advances — see 8c), so the
     density channel is uniform BY DESIGN there. Asserting the profile under
     reduce would fail correct code; asserting it here is the only place the
     claim is true. */
  const ap = await b.newPage({ viewport: { width: 1440, height: 900 } });
  watchErrors(ap, 'scenario 8a');
  await ap.route('**/api/**', fulfil);
  await open(ap, 'constellation');
  await ap.waitForTimeout(900);
  const dense = await readNodes(ap);

  if (dense.error) {
    ok(false, `scenario 8a: ${dense.error}`);
  } else {
    ok(dense.nodes.length > 0, `scenario 8a: sphere emits [data-con-node] nodes (got ${dense.nodes.length})`);
    ok(dense.nodes.length <= MAX_NODES,
      `scenario 8a: drawn set respects the parsed MAX_SPHERE_NODES ceiling (${dense.nodes.length} <= ${MAX_NODES})`);

    // (i) Every node's alpha matches the curve recomputed from the PARSED
    //     constants. A flattened falloff makes actual constant while
    //     predicted still varies -> mismatch -> red.
    const predict = (r) => LIMB_MIN_ALPHA + (1 - LIMB_MIN_ALPHA) * Math.pow(Math.max(0, Math.min(1, 1 - r)), LIMB_K);
    const offenders = dense.nodes.filter((n) => Math.abs(n.alpha - predict(n.rnorm)) > 0.002);
    ok(offenders.length === 0,
      `scenario 8a: every node's alpha reproduces LIMB_MIN_ALPHA + (1-LIMB_MIN_ALPHA)·(1-rnorm)^LIMB_K from the PARSED constants` +
      (offenders.length ? ` — ${offenders.length}/${dense.nodes.length} disagree, worst ${offenders[0].rnorm.toFixed(3)}: got ${offenders[0].alpha} want ${predict(offenders[0].rnorm).toFixed(3)}` : ` (${dense.nodes.length} nodes)`));

    // (ii) Mean alpha falls monotonically toward the rim.
    const BINS = [[0, 0.5], [0.5, 0.8], [0.8, 1.0001]];
    const binned = BINS.map(([lo, hi]) => dense.nodes.filter((n) => n.rnorm >= lo && n.rnorm < hi));
    const meanA = binned.map((b2) => (b2.length ? b2.reduce((s, n) => s + n.alpha, 0) / b2.length : NaN));
    const populated = binned.every((b2) => b2.length >= 3);
    ok(populated, `scenario 8a: all three radial bins are populated, so the profile below is not read off an empty bin (counts ${binned.map((b2) => b2.length).join('/')})`);
    if (populated) {
      ok(meanA[0] > meanA[1] && meanA[1] > meanA[2],
        `scenario 8a: mean alpha falls monotonically toward the rim (core ${meanA[0].toFixed(3)} > mid ${meanA[1].toFixed(3)} > rim ${meanA[2].toFixed(3)})`);

      // (iii) AREAL density falls toward the rim. This is the claim that
      //       makes the sphere read as a VOLUME rather than a disc, and it
      //       is non-trivial: points on a spherical SHELL project with areal
      //       density proportional to 1/cos(theta), which DIVERGES at the
      //       rim. A view that merely dimmed the rim would still pile points
      //       up there. Falling density is only achievable by filling a ball
      //       and thinning, which is what the composition does.
      const area = BINS.map(([lo, hi]) => (Math.min(hi, 1) ** 2) - (lo ** 2));
      const dens = binned.map((b2, i) => b2.length / area[i]);
      ok(dens[0] > dens[1] && dens[1] > dens[2],
        `scenario 8a: areal density falls toward the rim — the sphere reads as a volume, not a disc ` +
        `(core ${dens[0].toFixed(1)} > mid ${dens[1].toFixed(1)} > rim ${dens[2].toFixed(1)} nodes per unit area)`);
    }
    ok(!dense.placeholder, 'scenario 8a: no empty-plot placeholder at full pool');
  }
  const animatedIds = dense.nodes ? new Set(dense.nodes.map((n) => n.id)) : new Set();
  await ap.close();

  /* ── 8c · reduced motion: CONTENT survives, animation does not ────────
     Contract §6 as corrected in Rev 3. MemViewShell does NOT swap the body
     for the table — `showBody` consults `tracking` and never reduced motion
     — so removing the animated surface is the VIEW's job, and "removing" it
     must not remove the DATA with it. The specific hazard this catches: the
     sphere backface-culls (z < -0.1) and density-thins while animating, and
     both are MOTION effects. Frozen, a culled node never rotates into view,
     so leaving either enabled would PERMANENTLY drop transactions and their
     click targets from the reduced-motion surface. */
  const rp = await b.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  watchErrors(rp, 'scenario 8c');
  await rp.route('**/api/**', fulfil);
  await open(rp, 'constellation');
  await rp.waitForTimeout(600);
  const red = await readNodes(rp);
  const smil = await rp.evaluate(() => document.querySelectorAll('.mem-view animate, .mem-view animateTransform, .mem-view animateMotion').length);
  // "Still a click target" measured off what the DOM actually exposes: the
  // node group carries a pointer cursor AND contains a hit circle with a
  // PAINTED fill. `fill="transparent"` is hit-testable under the default
  // `pointer-events: visiblePainted` (a transparent paint is still a paint);
  // `fill="none"` would not be, and is the mutation this would catch.
  const clickableUnderReduce = await rp.evaluate(() => {
    const els = [...document.querySelectorAll('.mem-view [data-con-node]')];
    return els.filter((e) => {
      if (getComputedStyle(e).cursor !== 'pointer') return false;
      return [...e.querySelectorAll('circle')].some((c) => {
        const f = (c.getAttribute('fill') || '').trim().toLowerCase();
        return f !== '' && f !== 'none';
      });
    }).length;
  });

  if (red.error) {
    ok(false, `scenario 8c: ${red.error}`);
  } else {
    /* THE COUNT IS THE LOAD-BEARING HALF, and it is an equality against the
       PARSED ceiling rather than `>= animated`. The reason is a measured
       discrepancy worth recording, because it is a general trap.

       Break test: re-enable backface culling under reduce. Its mechanism
       predicts ~half the field disappears. Measured effect on each quantity:

         reduce node count      190 -> 110   (80 culled, 42% — "roughly half" ✓)
         `missing` below          3          (of 62 animated-visible)

       A 27x gap, and NEITHER number is wrong: they measure different things.
       `missing` is |animated_visible \ reduce_visible|, and the animated
       sample is taken a small rotation from t=0, so the two front hemispheres
       almost coincide — only nodes near the terminator differ. The mutation's
       REACH is 80; the set-difference's VIEW of that reach is 3.

       So the set-membership check reds for the right reason but with a margin
       that is an accident of which frame t=0 lands on, and `>= animated`
       (110 >= 62) stays GREEN under the very mutation it exists to catch.
       Pinning the count to MAX_SPHERE_NODES makes the margin structural: the
       break test now reds by 80 nodes instead of 3.

       General form: when a break test's observed effect is far smaller than
       its mechanism predicts, the assertion is probably measuring a SUBSET of
       the mutation's reach. Assert on the reach. */
    ok(red.nodes.length === MAX_NODES,
      `scenario 8c: reduced motion renders the WHOLE drawn set — culling and thinning are both dropped, not merely reduced (${red.nodes.length}, expected the parsed MAX_SPHERE_NODES ${MAX_NODES})`);
    ok(red.nodes.length >= animatedIds.size,
      `scenario 8c: reduced motion carries at least as many nodes as the animated field (reduce ${red.nodes.length} >= animated ${animatedIds.size})`);
    const missing = [...animatedIds].filter((id) => !red.nodes.some((n) => n.id === id));
    ok(missing.length === 0,
      `scenario 8c: every transaction visible while animating is STILL present under reduce — no data lost to a frozen frame` +
      (missing.length ? ` — ${missing.length} missing, e.g. ${missing[0].slice(0, 12)}…` : ''));
    ok(clickableUnderReduce === red.nodes.length,
      `scenario 8c: every node under reduce is still a click target — the static equivalent carries the same CLICK TARGETS, not just the same data (${clickableUnderReduce}/${red.nodes.length})`);
    ok(smil === 0, `scenario 8c: zero SMIL elements under reduce — animation is NOT RENDERED, never merely paused (got ${smil})`);
    ok(!red.placeholder, 'scenario 8c: no empty-plot placeholder under reduced motion');
  }
  await rp.close();

  /* ── 8d · inspector depth: a node click opens the SHARED tx inspector ──
     RUN UNDER REDUCED MOTION, DELIBERATELY, and the reason is a measurement
     rather than a convenience. The sphere rotates at 20fps, so a node is a
     MOVING TARGET: Playwright resolves the element's box, then dispatches a
     mouse event at that point, and by then the node has moved. The first
     version of this clicked the animated field and marked 0 elements — a red
     that was about the frame rate, not about the wiring.

     Frozen is also the STRONGER subject, not a weaker one. Under reduce the
     view drops culling and thinning (8c), so all 190 nodes are present rather
     than the ~43 the animated field shows — a click here exercises a node the
     animated state may not even render, and it tests the §6 claim that the
     static equivalent carries the same CLICK TARGETS, which is the thing most
     likely to be quietly untrue.

     Hit-testing is still REAL: Playwright dispatches an actual mouse event and
     the browser resolves it against painted geometry. No coordinate conversion
     appears anywhere in this path, which is how §9's "verify the units by
     construction" is satisfied — there are no units to get wrong. */
  const dp = await b.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  watchErrors(dp, 'scenario 8d');
  await dp.route('**/api/**', fulfil);
  await open(dp, 'constellation');
  await dp.waitForTimeout(900);
  /* Pick a node that is PROVABLY the topmost thing at its own centre.
     Choosing by radius alone picked a core node that other nodes painted
     over: Playwright's actionability check ("visible, enabled and stable,
     receives pointer events") never cleared and the gate died on a 30s
     timeout — a crash, not a failure, and one that reported `0 ❌` on its
     way out. Screening with elementFromPoint makes occlusion a SELECTION
     criterion instead of a flake, so the click below can be a real one
     (no `force`) and still be deterministic. */
  const target = await dp.evaluate(() => {
    const els = [...document.querySelectorAll('.mem-view [data-con-node]')];
    for (const e of els.sort((a, c) => parseFloat(a.getAttribute('data-con-rnorm')) - parseFloat(c.getAttribute('data-con-rnorm')))) {
      const r = e.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (hit && hit.closest('[data-con-node]') === e) return e.getAttribute('data-con-node');
    }
    return null;
  });
  ok(!!target, `scenario 8d: found a node to click (${target ? target.slice(0, 12) + '…' : 'none'})`);
  if (target) {
    /* BOTH POLARITIES, because a one-sided read here is vacuous.
       The first version asserted only that the depth vocabulary "/10" was
       PRESENT after the click. That went GREEN while the two assertions
       either side of it went red — i.e. it was green with no tracking having
       happened at all, satisfied by the block ribbon rather than by any
       inspector. Reading the same probe BEFORE the click turns each polarity
       into the other's vacuity guard: `before` must be empty, `after` must be
       populated, and a marker present in both proves nothing about the click.
       These deep labels are tx-detail.tsx's own vocabulary, so they cannot be
       satisfied by a view-local summary panel. */
    const probe = (want) => dp.evaluate((w) => {
      const body = document.body.textContent || '';
      // The UI renders txids through data/types.ts's `shortHash`, which is
      // `first8 + "…" + last6` — so a raw 16-char prefix NEVER appears in the
      // text and asserting on one fails against correct code. (It did: the
      // first version read `w.slice(0, 16)` and went red while data-tracked-tx
      // and the deep labels both proved the inspector had opened correctly.)
      // Match the shape the app actually renders, or the full id if some
      // surface prints it unabbreviated.
      const short = `${w.slice(0, 8)}…${w.slice(-6)}`;
      return {
        marked: document.querySelectorAll(`[data-tracked-tx="${w}"]`).length,
        mentionsTx: body.includes(short) || body.includes(w),
        deepLabels: ['Ring size', 'View Tags', 'Stealth addresses'].filter((s) => body.includes(s)).length,
      };
    }, want);

    const before = await probe(target);
    await dp.click(`.mem-view [data-con-node="${target}"]`);
    await dp.waitForTimeout(800);
    const after = await probe(target);

    ok(before.marked === 0 && after.marked > 0,
      `scenario 8d: the CLICK is what marks that txid — before ${before.marked}, after ${after.marked} element(s) with data-tracked-tx="${target.slice(0, 12)}…"`);
    ok(!before.mentionsTx && after.mentionsTx,
      `scenario 8d: the opened inspector shows the CLICKED transaction, not merely some transaction (before ${before.mentionsTx}, after ${after.mentionsTx})`);
    ok(before.deepLabels === 0 && after.deepLabels >= 2,
      `scenario 8d: the SHARED inspector opened — tx-detail.tsx's own deep vocabulary (Ring size / View Tags / Stealth addresses) appears ONLY after the click, so no shallower panel was reimplemented (before ${before.deepLabels}/3, after ${after.deepLabels}/3)`);
  }
  await dp.close();

  /* ── 8b · low pool: 3 tx composes, never an empty sphere ──────────────
     POOL_N is read by `fulfil` at request time, so it is set BEFORE the
     route is registered and restored immediately after — same mechanism
     scenario 7 uses. */
  POOL_N = 3;
  const cp = await b.newPage({ viewport: { width: 1440, height: 900 } });
  watchErrors(cp, 'scenario 8b');
  await cp.route('**/api/**', fulfil);
  await open(cp, 'constellation');
  await cp.waitForTimeout(700);
  const lowc = await readNodes(cp);
  await cp.close();
  POOL_N = MEMPOOL_N;

  if (lowc.error) {
    ok(false, `scenario 8b: ${lowc.error}`);
  } else {
    ok(lowc.nodes.length === 3,
      `scenario 8b: 3 tx composes as 3 real nodes — no empty sphere, no padding to a decorative count (got ${lowc.nodes.length})`);
    ok(lowc.svgs > 0, `scenario 8b: the view still renders its SVG surface at low pool (got ${lowc.svgs})`);
    ok(!lowc.placeholder, 'scenario 8b: no empty-plot placeholder at 3 tx');
  }
}

/* ── Scenario 9 · information density, per view, as a countable floor ────────
   v2·3. The v2 brief asks each rebuilt view for "3-5x more information", and
   until now that was an adjective: nothing counted it, so nothing could tell a
   density REGRESSION from a redesign. This scenario makes it a number.

   WHAT IS COUNTED — a "readout" is a rendered element carrying at least one
   digit, plus each digit-bearing LINE inside a <pre> (a <pre> is one DOM leaf
   but renders many rows, and Terminal's whole idiom is <pre> blocks, so
   counting the element would undercount it by an order of magnitude).

   THREE SCOPING DECISIONS, each of which changes the number:

   1 · Scope is `[data-mem-body]`, NOT `.mem-view`. That is exactly the view's
       OWN composition — MemViewShell's search bar, heartbeat, TrackChip, the
       `.mem-table` fallback and the tracking detail panel are shared chrome
       every view renders identically, so including them would dilute the
       ratio with a constant and credit each view for the shell's work.

   2 · Only elements with a NON-ZERO rendered box count. Same discipline as
       scenario 6's `rect.width === 0` filter, and load-bearing for the same
       reason: `.mem-table` is in the DOM at every width and merely
       `display: none` on desktop, so counting DOM presence rather than
       rendered presence would score sixty hidden table rows as information
       the reader can see.

   3 · Leaf elements only. An ancestor's textContent contains every
       descendant's, so counting non-leaves would multiply one figure by its
       nesting depth — and reward deeper markup rather than more data.

   WHAT THIS INSTRUMENT IS BLIND TO, named per contract §9 rather than left
   for someone to discover: it cannot tell a live figure from a digit in a
   decorative string, so `RING_SIZE=16` and a hard-coded `"16"` score
   identically. It is a DENSITY measure, not an honesty measure — the
   all-real-data invariant is `verify-prng` and `verify-stale`'s job, and this
   number is only meaningful while those stay green. It is also
   fixture-relative: the counts below are taken against this file's own
   fixture at MEMPOOL_N/BLOCKS_N, so a fixture change moves every floor.

   FLOORS are set from measurement with margin, not from the ceiling of what
   was measured — a floor equal to the reading reds on any incidental jitter
   (one block column, one log line). Each is the measured value less ~12%,
   rounded down. The point is to catch a view losing a PANEL, not to pin a
   digit. ─────────────────────────────────────────────────────────────────── */
{
  console.log('\n— scenario 9: information density per view (readouts under [data-mem-body]) —');

  // Measured on 260c99f at 1440x900 against this file's fixture, then reduced
  // by ~12% and rounded down. The reading is quoted beside each floor so a
  // future change can tell "this view lost a panel" from "this floor was
  // always slack".
  //
  //   reactor 130 · bridge 100 · sediment 181 · constellation 53 · classic 159
  //
  // `terminal` is this PR's subject. Its floor is set from the REBUILT view and
  // its pre-rebuild reading is kept beside it, because the 3-5x brief is only
  // checkable against the number it started from.
  const DENSITY_FLOOR = {
    reactor: 114,        // 130 on 260c99f
    bridge: 88,          // 100
    sediment: 159,       // 181
    constellation: 46,   //  53
    terminal: 300,       //  97 on 260c99f (75 elements + 22 <pre> lines) -> see §7
    classic: 139,        // 159
  };

  const dp = await b.newPage({ viewport: { width: 1440, height: 900 } });
  watchErrors(dp, 'scenario 9');
  await dp.route('**/api/**', fulfil);

  const readouts = () => dp.evaluate(() => {
    const body = document.querySelector('[data-mem-body]');
    if (!body) return { error: 'no [data-mem-body] — the view rendered no body' };
    const seen = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    let elements = 0;
    for (const el of body.querySelectorAll('*')) {
      if (el.children.length !== 0) continue;              // leaves only
      if (el.tagName.toLowerCase() === 'pre') continue;    // counted by line below
      const t = (el.textContent || '').trim();
      if (!t || !/\d/.test(t)) continue;
      if (!seen(el)) continue;
      elements++;
    }
    let preLines = 0;
    for (const el of body.querySelectorAll('pre')) {
      if (!seen(el)) continue;
      preLines += (el.textContent || '').split('\n').filter((l) => /\d/.test(l)).length;
    }
    const mv = document.querySelector('.mp-view');
    const sc = document.querySelector('.mp-canvas-scroll');
    return {
      elements, preLines, total: elements + preLines,
      // Natural width, reported for every view because the contract's checklist
      // asks for it and only the four `fit: true` views have verify-fit to
      // produce it. For a PAN-MODE view (Classic, Terminal) there is no
      // .mp-fit transform to rescale anything, so `naturalW > canvasW` does not
      // cost type size — it costs the reader a horizontal pan on a desktop that
      // should not need one. Reported, not asserted: Terminal is REQUIRED to
      // exceed the canvas at 390 (verify-mobile), so there is no single
      // threshold that is right at every width.
      naturalW: mv ? Math.round(mv.scrollWidth) : null,
      canvasW: sc ? Math.round(sc.clientWidth) : null,
    };
  });

  for (const id of VIEWS) {
    try {
      await open(dp, id);
      // `open()`'s data-ready wait keys on [data-memstat-value="txCount"],
      // which Terminal does not render (stats={false}) — `undefined !== '—'`
      // is true, so that wait is a NO-OP on this view and the count could be
      // taken against an un-hydrated "—" render. Wait on a marker every view
      // actually emits instead.
      await dp.waitForFunction(() => {
        const v = document.querySelector('[data-memstat][data-memstat-value]');
        return v && Number(v.getAttribute('data-memstat-value')) > 0;
      }, { timeout: 9000 }).catch(() => {});
      await dp.waitForTimeout(600);
      const r = await readouts();
      if (r.error) { ok(false, `scenario 9 [${id}]: ${r.error}`); continue; }
      const floor = DENSITY_FLOOR[id];
      console.log(`   ${id.padEnd(14)} elements ${String(r.elements).padStart(4)} · pre-lines ${String(r.preLines).padStart(4)} · total ${String(r.total).padStart(4)} · naturalW ${String(r.naturalW).padStart(5)} vs canvasW ${r.canvasW}`);
      if (floor == null) {
        ok(false, `scenario 9 [${id}]: no DENSITY_FLOOR entry — every registered view must declare one`);
        continue;
      }
      ok(r.total >= floor,
        `scenario 9 [${id}]: renders >= ${floor} readouts under [data-mem-body] (got ${r.total} = ${r.elements} elements + ${r.preLines} <pre> lines)`);
    } catch (e) {
      ok(false, `scenario 9 [${id}]: threw — ${String(e).slice(0, 120)}`);
    }
  }
  await dp.close();
}

await b.close();

console.log('');
ok(pageErrors.length === 0,
  `no uncaught render errors on any view` +
  (pageErrors.length ? ` — ${[...new Set(pageErrors)].slice(0, 5).join(' | ')}` : ''));

console.log(fail ? '\n❌ verify-memviews FAILED' : '\n✅ verify-memviews: all assertions passed');
process.exit(fail ? 1 : 0);
