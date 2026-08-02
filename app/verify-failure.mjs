/**
 * verify-failure.mjs — failure is CONTAINED, and it is attributed correctly.
 *
 * Run: npm run build && (node scripts/serve-dist.mjs &) && npm run wait-preview
 *      && node verify-failure.mjs
 *
 * The brief's bullet is "killing one node degrades exactly one panel, with a
 * retry, and the rest of /network stays live". Two words in that are load-
 * bearing and neither is checkable from rendered text:
 *
 *   EXACTLY — a global staleness flag also "degrades a panel", and would pass
 *   any assertion that merely looked for a stale marker somewhere. The test has
 *   to prove the panels fed by OTHER endpoints did NOT degrade.
 *
 *   ONE NODE — the existing outage gates (verify-allreal-dom, verify-tiers-dom)
 *   abort every `/api/**`, which is a total outage. Nothing in this repo had
 *   ever driven a SINGLE endpoint to failure while its siblings answered, so
 *   the per-endpoint claim was untested by construction.
 *
 * A stale chart and a live one differ only by opacity and a decorative
 * watermark, so panels carry `data-panel-key` naming the endpoint their numbers
 * come from (design/primitives.tsx PanelFrame). That attribute is what makes
 * "exactly" observable rather than eyeballed.
 *
 * House rules honoured: no `networkidle` anywhere (the banned idiom — see
 * verify-future.mjs:34-40), and negative assertions get a grace window first,
 * because a panel that is going to go stale needs time to do so before we can
 * honestly say it didn't.
 */
import { makeReporter, launchChromium, BASE } from './verify-lib.mjs';

const base = process.env.VERIFY_BASE || BASE;
const R = makeReporter('verify-failure');

/* Compressed tiers, the documented test override. Real cadence is 3s/15s/60s;
   STALE_AFTER is 2 consecutive failures, so a 300ms tier crosses it in ~600ms. */
const TEST_TIERS = { fast: 300, chain: 400, market: 2000 };

const H = 3_500_000;
const NOW = Math.floor(Date.now() / 1000);

/** Fixtures good enough for the page to render real numbers. */
const FIXTURES = {
  network: {
    height: H, difficulty: 400e9, hashrate_ghs: 3.3, target_seconds: 120,
    top_block_hash: 'a'.repeat(64), major_version: 16, version: '0.18.3.4',
    fee_tiers: [20000, 80000, 320000, 4000000], tx_count_total: 41_000_000,
    alt_blocks_count: 2, randomx_seed_hash: 'b'.repeat(64),
    block_weight_limit: 600000, block_weight_median: 300000,
    database_size: 200e9, synchronized: true, nettype: 'mainnet', adjusted_time: NOW,
  },
  blocks: Array.from({ length: 40 }, (_, i) => ({
    height: H - i, hash: (i % 10).toString().repeat(64).slice(0, 64),
    timestamp: NOW - i * 120, reward: 6e11, difficulty: 400e9,
    block_weight: 300000 + i * 100, tx_count: 20 + i, pool_name: 'Unknown',
  })),
  mempool: {
    recent_txs: Array.from({ length: 30 }, (_, i) => ({
      txid: (i % 10).toString().repeat(64).slice(0, 64), blob_size: 1500 + i * 10,
      fee: 3e7 + i, fee_rate: 20000 + i * 100, receive_time: NOW - i * 5,
      ring_size: 16, input_count: 2, output_count: 2,
    })),
    fee_histogram: Array.from({ length: 8 }, (_, i) => ({ tx_count: 4 + i, bytes: 6000 })),
  },
  fees: { tiers: [20000, 80000, 320000, 4000000] },
};

/**
 * Serve every `/api/xmr/*` from fixtures except the ones in `dead`, which 500.
 *
 * A 500 rather than an abort, deliberately: a non-2xx and a dropped connection
 * take different paths through `getJSON`, and every existing outage gate in
 * this repo tests only the abort. A proxy that is up and answering badly is at
 * least as common as one that is unreachable.
 */
/**
 * The tip must ADVANCE, or a blocks outage is invisible.
 *
 * The chain tier is a tip watch: it fetches /api/xmr/tip every tick and only
 * pulls /network + /blocks when the height has moved (xmrirish-feed.ts). With a
 * constant tip fixture the feed correctly stops asking for blocks after its
 * first success, so killing that endpoint records no failure at all and the
 * block panels never degrade — 0 of 5, which is what the first run of this gate
 * measured. That is the feed behaving as designed, not a bug, and it is the
 * same trap verify-glide hit: its blocks-only discriminator could never fire
 * until its tip fixture was driven by the block head.
 *
 * So the tip advances once per request here, which is also the honest scenario:
 * a chain that has stopped advancing and a dead /blocks endpoint are genuinely
 * indistinguishable, and the interesting case is the one where the chain is
 * moving and we cannot see it.
 */
let tipHeight = H - 1;

async function mock(ctx, dead = []) {
  await ctx.route('**/api/xmr/**', (route) => {
    const u = new URL(route.request().url());
    const sub = (u.searchParams.get('_p') || u.pathname.replace(/^\/api\/xmr\/?/, '')).split('?')[0];
    const key = sub.startsWith('blocks') ? 'blocks'
      : sub.startsWith('mempool') ? 'mempool'
      : sub.startsWith('fees') ? 'fees'
      : sub.startsWith('tip') ? 'tip'
      : sub.startsWith('network') ? 'network' : null;
    if (!key) return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    if (key === 'tip') {
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ height: tipHeight++ }) });
    }
    if (dead.includes(key)) {
      return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'upstream' }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FIXTURES[key]) });
  });
  await ctx.route('**/api/coingecko*', (r) => r.abort());
  await ctx.route('**/api/feeds*', (r) => r.abort());
}

async function newCtx(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript((t) => { window.__XMR_TIER_MS__ = t; }, TEST_TIERS);
  return ctx;
}

/** Panels whose data comes from `key`, and panels that do not mention it. */
async function panelsByKey(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('[data-panel-key]')].map((el) => ({
      keys: (el.getAttribute('data-panel-key') || '').split(/\s+/).filter(Boolean),
      // `data-stale` rather than the chart watermark: two of the blocks-fed
      // panels (Pool attribution, Recent blocks) are a table and a stat-plus-bar
      // with nowhere to draw one. Reading the watermark measured 3 of 5 and
      // called the other two healthy — they were rendering last-good numbers
      // formatted exactly like live ones.
      stale: el.getAttribute('data-stale') === 'true',
      // The marker a reader actually sees INSIDE the panel. Charts draw a
      // decorative STALE watermark from their own `stale` prop, which is a
      // second expression of the same fact — and a second expression can
      // disagree. `charts` is 0 for the table/stat panels, which draw nothing.
      // Any <svg> in the body is a chart here; the series components carry no
      // marker attribute of their own, and the table/stat panels have none.
      charts: el.querySelectorAll('.panel-b svg').length,
      watermark: el.querySelectorAll('text[data-decorative]').length > 0,
      title: (el.querySelector('.panel-h .l')?.textContent || '').trim(),
    })));
}

const { browser } = await launchChromium();

/* ── A · one endpoint dies; exactly its panels degrade ─────────────────── */
R.group('A · killing ONE endpoint degrades exactly the panels it feeds');
{
  const ctx = await newCtx(browser);
  await mock(ctx, []);                       // everything healthy first
  const page = await ctx.newPage();
  await page.goto(base + '/network', { waitUntil: 'load' });
  await page.waitForFunction((h) => document.body.innerText.includes(h),
    H.toLocaleString('en-US'), { timeout: 15000 }).catch(() => {});

  const healthy = await panelsByKey(page);
  R.ok(healthy.length >= 10, `A: /network exposes its panels by endpoint (${healthy.length} tagged)`);
  R.ok(healthy.every((p) => !p.stale), 'A: with every endpoint answering, no panel claims staleness');

  // Now kill BLOCKS only. /network, /mempool, /fees and /tip keep answering.
  await ctx.unroute('**/api/xmr/**');
  await mock(ctx, ['blocks']);
  // Two failures at a 400ms chain tier ≈ 800ms; give it room, then a grace
  // window so "these did NOT go stale" is an honest statement rather than a race.
  await page.waitForFunction(
    () => [...document.querySelectorAll('[data-panel-key]')]
      .some((el) => (el.getAttribute('data-panel-key') || '').includes('blocks')
                 && el.getAttribute('data-stale') === 'true'),
    null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const after = await panelsByKey(page);
  const blockPanels = after.filter((p) => p.keys.includes('blocks'));
  const otherPanels = after.filter((p) => !p.keys.includes('blocks'));

  R.ok(blockPanels.length > 0 && blockPanels.every((p) => p.stale),
    `A: every blocks-fed panel degraded (${blockPanels.filter((p) => p.stale).length}/${blockPanels.length})`,
    blockPanels.filter((p) => !p.stale).map((p) => p.title).join(', '));

  // The half that a global flag would have got wrong.
  R.ok(otherPanels.every((p) => !p.stale),
    `A: EXACTLY those — no panel fed by another endpoint degraded (${otherPanels.length} stayed live)`,
    otherPanels.filter((p) => p.stale).map((p) => `${p.title} [${p.keys}]`).join(', '));

  const body = await page.innerText('body');
  R.ok(body.includes(H.toLocaleString('en-US')),
    'A: last-good height is retained — a dead endpoint blanks nothing');

  /* The panel says one thing via data-stale (derived from the endpoints it
     advertises) and the chart inside says another via its own `stale` prop.
     Both are claims to the reader, so they have to agree — otherwise a chart
     can dim on the wrong endpoint entirely and every assertion above still
     passes, which is precisely what a break test of this gate revealed. */
  const charted = after.filter((p) => p.charts > 0);
  R.ok(charted.length > 0 && charted.every((p) => p.watermark === p.stale),
    `A: every charted panel's STALE watermark agrees with the endpoint it names (${charted.length} charted)`,
    charted.filter((p) => p.watermark !== p.stale)
      .map((p) => `${p.title} [${p.keys}] panel=${p.stale} chart=${p.watermark}`).join(' · '));

  await ctx.close();
}

/* ── B · the mirror image: kill mempool, blocks must stay live ─────────── */
R.group('B · the mirror image — a different endpoint degrades a different set');
{
  const ctx = await newCtx(browser);
  await mock(ctx, []);
  const page = await ctx.newPage();
  await page.goto(base + '/network', { waitUntil: 'load' });
  await page.waitForFunction((h) => document.body.innerText.includes(h),
    H.toLocaleString('en-US'), { timeout: 15000 }).catch(() => {});

  await ctx.unroute('**/api/xmr/**');
  await mock(ctx, ['mempool']);
  await page.waitForFunction(
    () => [...document.querySelectorAll('[data-panel-key]')]
      .some((el) => (el.getAttribute('data-panel-key') || '').includes('mempool')
                 && el.getAttribute('data-stale') === 'true'),
    null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const after = await panelsByKey(page);
  const mem = after.filter((p) => p.keys.includes('mempool'));
  const blocksOnly = after.filter((p) => p.keys.includes('blocks') && !p.keys.includes('mempool'));

  R.ok(mem.length > 0 && mem.every((p) => p.stale),
    `B: every mempool-fed panel degraded (${mem.filter((p) => p.stale).length}/${mem.length})`);
  R.ok(blocksOnly.length > 0 && blocksOnly.every((p) => !p.stale),
    `B: the blocks-fed panels stayed live (${blocksOnly.length}) — the two sets are genuinely independent`,
    blocksOnly.filter((p) => p.stale).map((p) => p.title).join(', '));

  await ctx.close();
}

await browser.close();
process.exit(R.finish());
