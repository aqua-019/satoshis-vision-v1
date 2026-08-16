// verify-tor.mjs — v6.0.7. Proves the feed behaves under Tor-grade latency.
//
// The 2.5s tier was `setInterval(snapshot, 2500)` where snapshot() fires FIVE
// parallel fetches, with no AbortController anywhere in browser code, no
// overlap guard and no backoff. On a LAN that is invisible. On Tor, where a
// round trip is 2-10s, the interval kept firing while the previous round was
// still outstanding and requests stacked without bound — each its own circuit.
//
// Scenario 1 is the sharp one: it holds every /api/* response open for 4s, so
// on the old code the interval fires ~1.6x per outstanding round and
// concurrency climbs without limit. With the recursive-setTimeout scheduler it
// cannot exceed one round's worth of requests.
//
// All routes are intercepted, so this runs with no network egress.
//
// Run: npm run build && (npm run preview &) && sleep 2 && node verify-tor.mjs
import { chromium, webkit } from 'playwright';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const base = 'http://localhost:4173';

/** Scaling factor for the RATE assertions below (§1 total, §3, §4). */
const ROUND_SIZE = 5;

/**
 * §1's OWN ceiling, and it is not `ROUND_SIZE` — the old code used that and its
 * docblock said "one snapshot() round issues exactly these five requests",
 * which was already false of this route before p3·14b touched it.
 *
 * MEASURED, at the peak, on `/live/network`:
 *
 *   /api/xmr/mempool                          feed · fast tier
 *   /api/xmr/fees                             feed · fast tier
 *   /api/xmr/tip                              feed · chain tier
 *   /api/coingecko?path=simple/price…         feed · market tier
 *   /api/nodes                                PAGE-LOCAL one-shot (node population)
 *   /api/xmr/network/difficulty?range=1d      PAGE-LOCAL one-shot (D0828 seed)
 *
 * So the five it counted were never the five it named: `/api/nodes` is a
 * page-local one-shot rather than part of a snapshot round, and `network` +
 * `blocks` never appear at all because the chain tier gates them behind an
 * unchanged tip. The constant matched reality by coincidence, and p3·14b's
 * seed broke the coincidence rather than the invariant.
 *
 * Split so the bound says what it bounds. The INTENT is unchanged and is the
 * only thing that ever mattered: concurrency must not climb without limit.
 */
const FEED_CONCURRENT = 4;

/**
 * The one-shots are the whole reason the ceiling may exceed the feed's own
 * concurrency, so they are ASSERTED to be one-shots. Without this, the +2
 * allowance would happily absorb a request that had started repeating every
 * tick — an allowance that hides the thing it was granted for.
 */
const ONE_SHOT_PATHS = ['/api/nodes', '/api/xmr/network/difficulty'];

/**
 * DERIVED, never a second literal. A `PAGE_ONESHOTS = 2` beside a two-entry
 * list is two expressions of one fact and they are free to drift: add a third
 * path and the ceiling would not follow it; raise the number without adding a
 * path and the allowance grows with nothing guarding it. This repo has fixed
 * that exact shape more than once (`routes.mjs`'s `R`, the four route lists),
 * and the fix is always to make the count a function of the thing it counts.
 */
const CONCURRENCY_CEILING = FEED_CONCURRENT + ONE_SHOT_PATHS.length;

function findChrome() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!existsSync(root)) return undefined;
  for (const d of readdirSync(root).filter((n) => n.startsWith('chromium-')).sort().reverse()) {
    const p = root + '/' + d + '/chrome-linux/chrome';
    if (existsSync(p)) return p;
  }
  return undefined;
}

let fail = false;
const ok = (cond, msg) => { console.log((cond ? '✅ ' : '❌ ') + msg); if (!cond) fail = true; };
const read = (rel) => { try { return readFileSync(join(__dirname, rel), 'utf8'); } catch { return null; } };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Strip comments before asserting on source. Needed because the assertions
// below describe code that the comments *also* quote verbatim ("this was
// setInterval(snapshot, 2500)") — without this a check can match the very
// prose explaining why the thing it forbids is gone.
//
// Order matters: line comments FIRST. The feed has a line comment mentioning
// the path `/api/xmr/*`, and that `/*` is a false block-comment opener — run
// the block pass first and it swallows everything up to the next `*/`,
// silently blanking real code. Whole-line only, so a `https://` inside a
// string is never mistaken for a comment.
const stripJsComments = (src) =>
  src
    .replace(/^[ \t]*\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

// ── 0) static — the structural guarantees a timing test can't prove ────────
{
  const feed = stripJsComments(read('src/data/xmrirish-feed.ts') ?? '');
  const polling = stripJsComments(read('src/data/usePolling.ts') ?? '');
  const art = stripJsComments(read('src/design/ArtBackground.tsx') ?? '');
  const mini = stripJsComments(read('src/pages/future/FutureMini.tsx') ?? '');

  // The scheduling guarantees live in usePolling (v6.0.6's tiering extracted
  // them out of the feed). The feed itself must own no raw loop of its own.
  ok(!/setInterval\(/.test(feed), '0 · the feed drives no setInterval of its own');
  ok(/usePolling\(/.test(feed), '0 · the feed schedules through usePolling');

  ok(!/setInterval\(/.test(polling),
     '0 · usePolling reschedules with setTimeout, not setInterval (setInterval can stack)');
  ok(/running/.test(polling), '0 · a re-entrancy guard exists');
  ok(/visibilityState/.test(polling), '0 · a hidden tab does no network work');
  ok(/backoffMs\(/.test(polling), '0 · consecutive failures back off');
  // v6.0.7's addition: without this the re-entrancy guard turns a hung socket
  // into a permanently dead tier — `running` never clears and nothing re-arms.
  ok(/TICK_TIMEOUT_MS/.test(polling) && /Promise\.race\(/.test(polling),
     '0 · a tick that never settles is abandoned on a timeout (fetch has none by default)');

  // Resize behaviour is gated statically: instrumenting reseed counts would
  // need a test-only hook in shipping code, which is a worse trade.
  ok(/RESEED_PX/.test(art) && /needSeed/.test(art),
     '0 · ParticleField gates seed() behind a reseed threshold (Tor letterboxing)');
  ok(/r\.width === w && r\.height === h/.test(mini),
     '0 · FutureMini early-returns on an unchanged box');
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

// ── 1) overlap — the headline assertion ────────────────────────────────────
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();

  let inFlight = 0;
  let peak = 0;
  let total = 0;
  const oneShotHits = new Map(ONE_SHOT_PATHS.map((k) => [k, 0]));
  let tipHits = 0;
  let peakSet = [];
  const live = new Set();
  p.on('request', (r) => {
    if (!r.url().includes('/api/')) return;
    inFlight++; total++;
    live.add(r.url());
    if (inFlight > peak) { peak = inFlight; peakSet = [...live]; }
    for (const k of ONE_SHOT_PATHS) if (r.url().includes(k)) oneShotHits.set(k, oneShotHits.get(k) + 1);
    if (r.url().includes('/api/xmr/tip')) tipHits++;
  });
  const settle = (r) => { if (r.url().includes('/api/')) { inFlight--; live.delete(r.url()); } };
  p.on('response', settle);
  p.on('requestfailed', settle);

  // Every API call takes 4s — a pessimistic but entirely realistic Tor circuit.
  await p.route('**/api/**', async (route) => {
    await sleep(4000);
    /* The D0828 seed gets a VALID envelope; everything else keeps `{}`.
       Without this the seed never succeeds, `needSeed` stays true, and the
       chain tier correctly RETRIES it — so a guard asserting "fired once"
       would be measuring retry-on-failure, not repetition, and could never
       observe the thing it claims to watch. That is a subject narrower than
       its claim, inside the guard written to close the previous instance of
       exactly that family. Fulfil it once, and the count below means what it
       says. Degraded behaviour is not lost: §3 still asserts the global
       backoff, and `/api/nodes` still exercises the no-retry path. */
    if (route.request().url().includes('/api/xmr/network/difficulty')) {
      const H = 3_500_000, NOW = Math.floor(Date.now() / 1000);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        ok: true, requested: '1d', range: '1d', blocks: 720, returned: 30, step: 24,
        tip: H, target_seconds: 120, window_seconds: 720 * 120,
        points: Array.from({ length: 30 }, (_, i) => ({
          height: H - 29 + i, timestamp: NOW - (29 - i) * 2880, difficulty: 400e9 + i * 1e9,
        })),
      }) });
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await p.goto(base + '/live/network', { waitUntil: 'load' });
  await p.waitForTimeout(20000);

  ok(peak <= CONCURRENCY_CEILING,
     `1: concurrency stays bounded (peak ${peak} ≤ ${CONCURRENCY_CEILING} = ${FEED_CONCURRENT} feed + ${ONE_SHOT_PATHS.length} page one-shot)`
     + `\n     at peak: ${peakSet.map((u) => u.replace(base, '')).join(', ')}`);
  /* THE ASSERTION BELOW IS `n === 1`, AND THIS COMMENT USED TO ARGUE AGAINST IT
     while the code did it anyway — caught in re-judgment. Read the code, but
     here is why it is `=== 1` and not something looser:

     The first draft asserted `n === 1` against a §1 that answered EVERY
     `/api/**` with `{}`. The D0828 seed therefore never received points,
     `needSeed` stayed true, and the chain tier correctly RE-SEEDED — so the
     assertion was measuring retry-on-failure while claiming to measure
     repetition, and a one-shot was structurally incapable of being one.

     The fix was to the FIXTURE, not the threshold: §1 now fulfils the seed once
     with a valid envelope (see the route handler above), so it succeeds, does
     not re-seed, and `=== 1` is exactly right. An intermediate draft bounded `n`
     by `tipHits` instead; that was WORSE — the seed's poller and the feed's are
     two independently phased chain-tier timers, so in a 20 s window one can tick
     twice while the other ticks once. It read 1≤1 locally and 2≤1 in the chain.
     An assertion whose outcome depends on phase is not an assertion.

     `tipHits` survives only as the vacuity control: it proves the chain tier
     ticked at all, so a `n === 1` that passed because NOTHING happened is
     distinguishable from one that passed because the seed behaved. */
  ok(tipHits > 0, `1: the chain tier ticked ${tipHits}×, so a repeating one-shot had chances to repeat`);
  for (const [path, n] of oneShotHits) {
    ok(n === 1,
       `1: ${path} fired ONCE across ${tipHits} chain tick(s) (${n}) — a page one-shot that began repeating would hide inside the ceiling it was granted`);
  }
  // 20s at a 4s floor is at most ~5 rounds. The old code fired every 2.5s
  // regardless, so it would be well past this.
  ok(total <= ROUND_SIZE * 7,
     `1: total requests stay bounded by the latency floor (${total} in 20s)`);
  await ctx.close();
}

// ── 2) abort — a round that never answers must not hang forever ────────────
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();

  const aborted = [];
  p.on('requestfailed', (r) => {
    if (r.url().includes('/api/')) aborted.push(r.failure()?.errorText ?? '');
  });
  // Never resolve. usePolling's TICK_TIMEOUT_MS is the only thing that can end
  // it — without that budget `running` stays true and the tier is dead for the
  // rest of the session. Waiting past the real 20s rather than adding another
  // test-only override to shipping code for a scenario that runs once.
  await p.route('**/api/**', async () => { await sleep(120000); });

  await p.goto(base + '/live/network', { waitUntil: 'load' }).catch(() => {});
  await p.waitForTimeout(26000);

  ok(aborted.length > 0, `2: a hung request is aborted rather than wedging the tier (${aborted.length} aborted)`);
  await ctx.close();
}

// ── 3) backoff — a hard-failing endpoint must not be hammered ──────────────
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();

  let count = 0;
  await p.route('**/api/**', async (route) => {
    count++;
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
  });

  await p.goto(base + '/live/network', { waitUntil: 'load' });
  count = 0; // measure the steady state, not the boot burst
  await p.waitForTimeout(30000);

  // Unthrottled: 30s / 2.5s = 12 rounds x 5 = 60 requests. Backed off
  // (2.5/5/10/20/30) it is roughly 5 rounds = 25.
  ok(count < ROUND_SIZE * 8,
     `3: failures back off instead of retrying at full rate (${count} requests in 30s, unthrottled would be ~60)`);
  await ctx.close();
}

// ── 4) hidden tab — the battery/circuit win on the reported surface ────────
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  // Report the tab as hidden from before any app code runs.
  await ctx.addInitScript(() => {
    Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true });
    Object.defineProperty(document, 'hidden', { get: () => true, configurable: true });
  });
  const p = await ctx.newPage();
  let count = 0;
  await p.route('**/api/**', (route) => {
    count++;
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await p.goto(base + '/live/network', { waitUntil: 'load' });
  await p.waitForTimeout(12000);

  // One boot round is expected; HIDDEN_MS (60s) means no second round lands.
  ok(count <= ROUND_SIZE * 2,
     `4: a hidden tab polls at the slow cadence (${count} requests in 12s, foreground would be ~25)`);
  await ctx.close();
}

await b.close();
console.log(fail ? '\n❌ verify-tor FAILED' : '\n✅ verify-tor: all assertions passed');
process.exit(fail ? 1 : 0);
