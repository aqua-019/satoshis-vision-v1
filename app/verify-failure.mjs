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
  /**
   * The D0828 seed: `/api/xmr/network/difficulty`.
   *
   * WHY THIS EXISTS AS ITS OWN KEY. The router below used to decide with
   * `sub.startsWith('network') ? 'network'`, and `network/difficulty`
   * starts with `network` — so the seed was answered with the `get_info`
   * -shaped body above. `useDifficultyStream`'s `parse()` needs a `points[]`
   * and ALL FOUR of window_seconds / target_seconds / tip / range for its
   * meta; that body has none of them, so the seed contributed exactly
   * nothing and the panel rendered chain-tier headers only. Measured before
   * this fixture existed: the endpoint WAS requested, and the panel still
   * read `Difficulty · streaming · 40 points` with no window label — 40
   * being the `blocks` fixture's own length. Every assertion about this
   * panel therefore had a subject (a stream with no seed) narrower than its
   * claim, on the one endpoint this PR added.
   *
   * Shape is taken from `buildHistoryEnvelope` in api/xmr.js, not invented:
   * window_seconds === blocks × target_seconds is the server's own identity
   * (720 × 120 = 86400), so a fixture that drifts from the handler fails
   * `api/verify-history.mjs`'s D4 rather than passing quietly here.
   */
  'network/difficulty': {
    ok: true, requested: '1d', range: '1d', blocks: 720, returned: 200,
    step: 1, tip: H, target_seconds: 120, window_seconds: 720 * 120,
    points: Array.from({ length: 200 }, (_, i) => ({
      height: H - 199 + i,
      timestamp: NOW - (199 - i) * 120,
      /* Varies, so the band has a real spread to compute rather than a
         degenerate zero-width one that would pass any band assertion. */
      difficulty: 400e9 + (i % 17) * 1e9,
    })),
  },
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

/** How many times the mock has ANSWERED the D0828 seed endpoint. Lets a
 *  timing failure say whether the response never came or came and did not
 *  merge — two different defects that look identical from the DOM alone. */
let seedServed = 0;

async function mock(ctx, dead = []) {
  await ctx.route('**/api/xmr/**', (route) => {
    const u = new URL(route.request().url());
    const sub = (u.searchParams.get('_p') || u.pathname.replace(/^\/api\/xmr\/?/, '')).split('?')[0];
    /* ORDER IS LOAD-BEARING: `network/difficulty` starts with `network`, so
       the history sub-paths must be matched BEFORE the bare `network` arm or
       they fall into it and are answered with a get_info body. That is the
       exact defect this ordering fixes; see the fixture's own note. */
    const key = sub.startsWith('blocks') ? 'blocks'
      : sub.startsWith('mempool') ? 'mempool'
      : sub.startsWith('fees') ? 'fees'
      : sub.startsWith('tip') ? 'tip'
      : sub.startsWith('network/difficulty') ? 'network/difficulty'
      : sub.startsWith('network') ? 'network' : null;
    if (!key) return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    if (key === 'tip') {
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ height: tipHeight++ }) });
    }
    if (key === 'network/difficulty' && !dead.includes(key)) seedServed++;
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
      // v6.1.4 — the PROVENANCE badge's own freshness claim, which before this
      // was a hardcoded fresh="live" and therefore agreed with nothing. It is a
      // third expression of the same fact (after `data-stale` and the chart
      // watermark), so like the watermark it gets compared rather than trusted:
      // on /network all three now derive from one `keys` array, and this is what
      // proves it. `null` = the panel renders no badge at all.
      badge: (() => {
        const p = el.querySelector('.panel-h .prov');
        if (!p) return null;
        if (p.querySelector('.prov-fresh--stale')) return 'stale';
        if (p.querySelector('.prov-fresh--error')) return 'error';
        if (p.querySelector('.prov-fresh--loading')) return 'loading';
        return p.querySelector('.prov-dot') ? 'live' : 'none';
      })(),
      // "UPD 12s" — the visible relative age, and the frozen absolute instant it
      // is measured from. The age must keep climbing during an outage while the
      // instant stays put; an age that stops growing is the same lie in a
      // different font.
      stampAge: (el.querySelector('.panel-updated')?.textContent || '').trim(),
      stampAt: el.querySelector('.panel-updated')?.getAttribute('title') || '',
    })));
}

const { browser } = await launchChromium();

/* ── A · one endpoint dies; exactly its panels degrade ─────────────────── */
R.group('A · killing ONE endpoint degrades exactly the panels it feeds');
{
  const ctx = await newCtx(browser);
  await mock(ctx, []);                       // everything healthy first
  const page = await ctx.newPage();
  await page.goto(base + '/live/network', { waitUntil: 'load' });
  await page.waitForFunction((h) => document.body.innerText.includes(h),
    H.toLocaleString('en-US'), { timeout: 15000 }).catch(() => {});

  const healthy = await panelsByKey(page);
  R.ok(healthy.length >= 10, `A: /network exposes its panels by endpoint (${healthy.length} tagged)`);
  R.ok(healthy.every((p) => !p.stale), 'A: with every endpoint answering, no panel claims staleness');

  /* The SEED IS ACTUALLY CONSUMED — the guard the `network/difficulty`
     fixture above needs to be worth having. A fixture nobody asserts is
     consumed is a fixture that can silently stop being consumed, which is
     precisely how this endpoint went unexercised while every assertion about
     its panel stayed green. Two independent readings, because either alone
     is satisfiable without a seed:
       · the WINDOW LABEL comes from `meta`, and `parse()` builds meta only
         from ALL FOUR of window_seconds/target_seconds/tip/range — a shape
         only the envelope has;
       · the POINT COUNT must EXCEED the `blocks` fixture's own length, or
         the panel is rendering chain-tier headers and nothing else. That is
         the reading that was 40-of-40 before this fixture existed. */
  /* BOUNDED SYNCHRONISATION, AND ITS EXPIRY IS NOT A CONTENT READING.
     The seed is one async fetch that lands after the height does, so reading
     immediately measures a stream that has not been seeded YET.

     The first version of this wait ended `.catch(() => {})` and fell through
     to assert on whatever was on screen. That makes A SLOW SEED AND A BROKEN
     SEED THE SAME EVENT at this call site, and the one that fires on a loaded
     machine is the false one: run under three concurrent builds it reported
     `40 points` — the pre-seed state — as a content defect, and the same gate
     on the same build reads 200 three times running when the machine is idle.
     A swallowed timeout is this repo's standing failure family wearing a
     stopwatch.

     So expiry is measured rather than absorbed, and the two cases are
     separated by a SECOND, longer wait rather than by a guess:
       · satisfied inside the budget      → judge the content;
       · satisfied only inside the grace  → judge the content, and say the
                                            machine was slow (the reading is
                                            still valid, only late);
       · never satisfied                  → the content is UNKNOWN, not
                                            wrong. Fail on the timing claim,
                                            and SKIP the two content
                                            assertions — never assert on a
                                            state known to be provisional.
     A skip is not a pass and is counted separately, which is exactly the
     distinction `verify-reporter`'s four counters exist to preserve. */
  const SEED_BUDGET_MS = 10_000;
  const SEED_GRACE_MS = 20_000;
  const awaitSeed = (ms) => page.waitForFunction(
    (n) => {
      const h = document.querySelector('[data-stream-renders]');
      return h ? Number(h.getAttribute('data-stream-points')) > n : false;
    },
    FIXTURES.blocks.length, { timeout: ms },
  ).then(() => true).catch(() => false);

  const t0 = Date.now();
  let seeded = await awaitSeed(SEED_BUDGET_MS);
  const late = !seeded && (seeded = await awaitSeed(SEED_GRACE_MS));
  const seedMs = Date.now() - t0;

  const seed = await page.evaluate(() => {
    const host = document.querySelector('[data-stream-renders]');
    const panel = [...document.querySelectorAll('[data-panel-key]')]
      .find((el) => (el.querySelector('.panel-h .l')?.textContent || '').includes('Difficulty · streaming'));
    return {
      points: host ? Number(host.getAttribute('data-stream-points')) : null,
      title: (panel?.querySelector('.panel-h .l')?.textContent || '').trim(),
    };
  });

  if (late) {
    R.info(`A: the seed took ${seedMs}ms — past the ${SEED_BUDGET_MS}ms budget, inside the ${SEED_BUDGET_MS + SEED_GRACE_MS}ms grace. Late, not wrong; the readings below stand. A loaded machine looks exactly like this.`);
  }
  if (!seeded) {
    R.ok(false,
      `A: the seed merged within ${SEED_BUDGET_MS + SEED_GRACE_MS}ms (served ${seedServed} time(s), points stuck at ${seed.points})`,
      'TIMING, NOT CONTENT: the two assertions below are SKIPPED rather than failed, because the panel is in its pre-seed state and a reading taken there describes the wait, not the merge. If seedServed is 0 the mock never answered; if it is >0 the response arrived and did not merge, and THAT is a real defect.');
    R.skip('A: the streaming panel carries a SERVER-DERIVED window label', 'the seed never merged — see the timing failure above');
    R.skip('A: the stream holds more points than the blocks fixture alone could supply', 'the seed never merged — see the timing failure above');
  } else {
    R.ok(/·\s*\d+\s*[hm]\b/.test(seed.title),
      `A: the streaming panel carries a SERVER-DERIVED window label — the seed envelope's meta reached it ("${seed.title}")`);
    R.ok(typeof seed.points === 'number' && seed.points > FIXTURES.blocks.length,
      `A: the stream holds more points (${seed.points}) than the blocks fixture alone could supply (${FIXTURES.blocks.length}) — the seed is genuinely merged, not merely fetched`);
  }

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

  /* v6.1.4 · the BADGE follows the same endpoints as the chip.
     Before this, /network's Remote-node and Chain-meta panels passed a
     hardcoded fresh="live" while their own header computed staleness correctly
     from the same keys — so a degraded endpoint rendered the literal text
     "· stale" and a pulsing LIVE dot four words apart in one flex row. */
  const badged = after.filter((p) => p.badge !== null);
  R.ok(badged.length > 0, `A: /network panels carry provenance badges (${badged.length})`);
  R.ok(badged.every((p) => (p.badge === 'stale') === p.stale),
    'A: every badge agrees with its own panel\'s data-stale — no panel shows a live dot beside its own "· stale"',
    badged.filter((p) => (p.badge === 'stale') !== p.stale)
      .map((p) => `${p.title} [${p.keys}] badge=${p.badge} stale=${p.stale}`).join(', '));

  /* And the timestamp is scoped the same way: killing `blocks` must not age the
     mempool panels' stamps. */
  const blocksStamped = after.filter((p) => p.keys.includes('blocks') && p.stampAge);
  const othersStamped = after.filter((p) => !p.keys.includes('blocks') && p.stampAge);
  R.ok(blocksStamped.length > 0 && othersStamped.length > 0,
    `A: panels report their own last-response time (${blocksStamped.length} blocks-fed, ${othersStamped.length} other)`);
  R.ok(othersStamped.every((p) => p.stampAt && !/has not answered/.test(p.stampAt)),
    'A: panels on healthy endpoints still show a real last-response instant',
    othersStamped.filter((p) => /has not answered/.test(p.stampAt)).map((p) => p.title).join(', '));

  /* THE freeze test, and it has to cut BOTH ways to mean anything.
     A panel fed by the DEAD endpoint must freeze its absolute instant — that
     time is last-good and nothing has arrived since — while the relative age
     beside it keeps climbing, because the number a reader needs during an
     outage is how stale this is.
     A panel on a HEALTHY endpoint must do the opposite and keep advancing.
     Asserting only the freeze would pass a build where every clock on the page
     had simply stopped; asserting only the advance would pass one where they
     all track wall-time regardless of what answered. */
  const frozenBefore = await panelsByKey(page);
  await page.waitForTimeout(3000);
  const frozenAfter = await panelsByKey(page);

  const pairs = frozenBefore
    .map((b, i) => ({ b, a: frozenAfter[i] }))
    .filter(({ b, a }) => b.stampAt && a && a.stampAt && !/has not answered/.test(b.stampAt));
  const deadPairs = pairs.filter(({ b }) => b.keys.includes('blocks'));
  const livePairs = pairs.filter(({ b }) => !b.keys.includes('blocks'));

  R.ok(deadPairs.length > 0 && livePairs.length > 0,
    `A: stamps observed across a 3s outage window (${deadPairs.length} on the dead endpoint, ${livePairs.length} on healthy ones)`);
  R.ok(deadPairs.every(({ b, a }) => b.stampAt === a.stampAt),
    'A: a dead endpoint\'s last-response instant FREEZES — it reports last-good, not now',
    deadPairs.filter(({ b, a }) => b.stampAt !== a.stampAt).map(({ b, a }) => `${b.title}: ${b.stampAt} -> ${a.stampAt}`).join(', '));
  R.ok(deadPairs.some(({ b, a }) => b.stampAge !== a.stampAge),
    'A: …while its relative age KEEPS COUNTING UP — an age that stops growing is the same lie in a different font',
    deadPairs.map(({ b, a }) => `${b.title}: "${b.stampAge}" -> "${a.stampAge}"`).slice(0, 3).join(', '));
  R.ok(livePairs.every(({ b, a }) => b.stampAt !== a.stampAt),
    'A: EXACTLY those — every panel on a healthy endpoint kept advancing its instant',
    livePairs.filter(({ b, a }) => b.stampAt === a.stampAt).map(({ b }) => `${b.title} [${b.keys}]`).join(', '));

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
  await page.goto(base + '/live/network', { waitUntil: 'load' });
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
