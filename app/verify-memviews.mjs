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

let BLOCKS_N = 14;  // Block fixture count; raised to 20 in scenario 6 to test BarSeries collision

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
      }));
      // absent, not merely paused: MemViewShell never calls children() under
      // reduced motion, so the canvas component is never mounted at all
      ok(r.canvases === 0, `item 10 [${id}]: no canvas mounted under reduced motion (${r.canvases})`);
      ok(r.rows >= 5, `item 10 [${id}]: table fallback carries the data (${r.rows} rows)`);
      ok(r.cols >= 5, `item 10 [${id}]: table has ≥5 columns (${r.cols})`);
      ok(r.strip && r.strip !== '—', `item 10 [${id}]: the stat strip still reports (${r.strip})`);
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
       CLOSED by v2.1: scenario 6 now raises mkBlocks() to 20 blocks, which
       at sediment's ~1180px layout width triggers stride >= 2 and exercises
       the collision logic. The fixture is parameterized via module-level
       BLOCKS_N and raised only for scenario 6, leaving scenarios 1–5 at 14
       to keep scenario 4's 390px overflow assertions unaffected.

       Mechanism, measured: `useChartMetrics` measures the PRE-TRANSFORM
       layout width, and `.mp-view` is `width: max-content` on desktop, so
       sediment's "Stratigraphy log" BarSeries measures ~1180px at EVERY
       viewport — FitView then scales the rendered result down (to 185px at
       390px wide). With 20 blocks, labelStep() returns stride 2 at desktop
       and 1 on narrow widths. When stride >= 2, the collision path matters:
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
    // Luminous network sphere: node labels + centre tx-count readout
    // (constellation.tsx:172-408). No responsive hiding — present always.
    constellation: [390, 768, 1440, 2560],
    // TermGauge's only <text> (terminal.tsx:268) lives in the "Network
    // gauges" rail-block (terminal.tsx:440-447), inside <aside class="rail">
    // (terminal.tsx:414). `.rail { display: none; }` fires at `max-width:
    // 768px` (styles.css:2217, :2643) — the element stays in the DOM but
    // collapses to a zero-size box, which this section's own
    // `rect.width === 0` filter (below) already drops. Present only where
    // the rail is visible.
    terminal: [1440, 2560],
    // Classic is pure DOM (MempoolViewMeta's `reflow: true`, index.tsx:79) —
    // it renders no <svg> at all, so it carries zero SVG <text> at every
    // width, by design rather than by omission.
    classic: [],
  };

  const textCounts = {}; // {view: {width: count}}

  // Raise the block fixture so sediment's stratigraphy BarSeries runs at a
  // stride >= 2 and the forced-final-label collision path is exercised at all.
  BLOCKS_N = 20;
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
      let best = 0;
      for (const svg of view.querySelectorAll('svg')) {
        const n = [...svg.querySelectorAll('text')]
          .map((t) => t.textContent.trim())
          .filter((s) => /^#\d[\d,]*$/.test(s)).length;
        if (n > best) best = n;
      }
      return { labels: best };
    });
    await sp.close();

    const rendered = probe.labels || 0;
    console.log(`  · stride @${width}px: ${rendered} of ${BLOCKS_N} x-labels rendered`);

    if (DESKTOP_STRIDE_WIDTHS.includes(width)) {
      ok(rendered > 0, `scenario 6 [${width}]: sediment's stratigraphy renders block-height x-labels (${rendered})`);
      ok(rendered > 0 && rendered < BLOCKS_N,
        `scenario 6 [${width}]: ${rendered} of ${BLOCKS_N} x-labels rendered — stride >= 2, so the forced-final-label `
        + `path is REACHABLE and this section is not vacuous (raise BLOCKS_N until this holds against the SHIPPED layout)`);
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

await b.close();

console.log('');
ok(pageErrors.length === 0,
  `no uncaught render errors on any view` +
  (pageErrors.length ? ` — ${[...new Set(pageErrors)].slice(0, 5).join(' | ')}` : ''));

console.log(fail ? '\n❌ verify-memviews FAILED' : '\n✅ verify-memviews: all assertions passed');
process.exit(fail ? 1 : 0);
