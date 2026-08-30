// verify-future.mjs — DOM gate for v6.0.1 "Future tab live feeds + partner redirects".
//
// Drives the BUILT app (serve-dist @ :4173) with /api/feeds mocked at the
// page level, proving the browser checks from the v6.0.1 spec:
//
//   1. Five protocol cards show "★N · Nd ago" WITHOUT opening a modal.
//   2. Push staleness is computed from a real pushed_at (one repo seeded
//      stale) and is labelled as a PUSH signal, never as the whole repo.
//   3. The automation registry shows FOUR repo pulses with real numbers.
//   4. The MRL column lists real issue titles.
//   5. The announcements column shows real posts — or, when the proxy fails,
//      an explicit explanation naming the endpoint. Never blank.
//   6. A reload inside 24h issues NO further /api/feeds requests.
//   7. Zero CSP violations / zero cross-origin requests to api.github.com.
//   8. The three partner cards open the correct partner sites in a new tab.
//   9. "our brief" opens the modal and does NOT navigate.
//  10. The modal's VISIT button exists, is styled (a.proto-btn), and is safe.
//  11. Every protocol card's simulator button lands on ITS OWN simulator
//      (v6.0.9 — all five are registered now; the SIM_IDS gate and the named
//      not-found state are asserted alongside, as 11b and 11c).
//  12. /monero/future redirects to /future.
//  14. app/src carries no "friend's" / "paid-tier" / "X_BEARER" copy.
//  15. No MoneroSpace lineage claim anywhere in the tree — the project is
//      named and its repo linked, but neither provenance is asserted.
//  16. research-lab reports push age and issue age as two DISTINCT labelled
//      readouts, so a push-quiet repo with live issues is not called dead.
//  17. Exactly one /api/feeds?src=ghrepo request per pulse repo on a cold
//      load, and zero on a reload inside 24h.
//
// All upstreams are intercepted, so this runs with no network egress —
// which matters here, because the sandbox proxy blocks getmonero.org and
// api.github.com outright (CONNECT 403). Live-origin checks are post-deploy.
//
// NO network-idle waiting anywhere in this file (the literal token is absent
// on purpose, so a grep can prove it). That wait is a network heuristic
// standing in for "the thing I assert has rendered", and it is what made
// verify-v510.mjs permanently red before it was deleted. Every goto here is
// `domcontentloaded` plus an explicit wait on the element the scenario
// actually checks — usually `[data-pulse="live"]`, the hook the cards expose
// for exactly this purpose.
//
// Run against serve-dist, NOT `vite preview`. Preview is an SPA server that
// falls back to dist/index.html for every path, so a broken prerender would
// pass unnoticed; serve-dist mirrors Vercel's real-file → directory-index →
// SPA-shell order. Same port, different resolution.
//   npm run build && (node scripts/serve-dist.mjs &) && npm run wait-preview \
//     && node verify-future.mjs
import { chromium, webkit } from 'playwright';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mockStatus } from './verify-lib.mjs';

const base = 'http://localhost:4173';
const __dirname = dirname(fileURLToPath(import.meta.url));

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

/**
 * Wait for a countable condition, then ASSERT it — never wait alone.
 *
 * p4·M5: `waitForFunction(() => count === 9)` HANGS when the count is wrong.
 * It burns its whole timeout and throws, killing the run before any later
 * assertion prints, so a real regression reports NOTHING — no named red, and
 * a grep for the red marker over the crash comes back empty, which reads
 * exactly like "no failures found". Found the hard way: a mutation that
 * rendered 8 protocol cards instead of 9 produced `exit=1, 0 named reds`.
 *
 * This waits with a SHORT budget and then states expected vs actual, so the
 * same regression costs one line instead of one run.
 */
async function waitCount(page, label, selector, expected, timeout = 15000) {
  await page
    .waitForFunction(
      ([sel, n]) => document.querySelectorAll(sel).length === n,
      [selector, expected],
      { timeout },
    )
    .catch(() => {});
  const actual = await page.locator(selector).count();
  ok(actual === expected, `${label} (expected ${expected}, got ${actual} for ${selector})`);
  return actual;
}

/* ── static source gates ────────────────────────────────────────────
   Deliberately ABOVE the browser launch, so the two copy criteria still
   run (and still fail the build) on a machine with no chromium. */

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.vercel']);
function walk(dir, exts) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p, exts));
    else if (exts.some((e) => p.endsWith(e))) out.push(p);
  }
  return out;
}

// 14 — mirrors `grep -ri "friend's\|paid-tier\|X_BEARER" app/src/`.
const APP_SRC = walk(join(__dirname, 'src'), ['.ts', '.tsx', '.css']);
const BANNED_RX = /friend's|paid-tier|x_bearer/i;
const bannedHits = APP_SRC.filter((f) => BANNED_RX.test(readFileSync(f, 'utf8')));
ok(bannedHits.length === 0,
  `14 · app/src carries no "friend's" / "paid-tier" / "X_BEARER" copy (found ${bannedHits.length}${bannedHits.length ? ': ' + bannedHits.join(', ') : ''})`);

/* 15 — the MoneroSpace provenance question is unresolved: its repo points at
   one origin, this site's earlier copy claimed another, and the maintainer
   has not answered. Until they do, naming and linking the project is the
   honest maximum. These patterns are deliberately narrow — "v4 mempool" on
   its own is NOT banned, because src/mempool/classic.tsx legitimately
   describes itself as a take on this site's own v4 mempool-explorer. */
const LINEAGE_RX = /fork of (this site|xmr\.irish)|xmr\.irish v4'?s? mempool|this site'?s? v4 mempool|pipes its txpool|mempool\.space|first fcmp\+\+ chain/i;
const TREE = walk(join(__dirname, '..'), ['.ts', '.tsx', '.js', '.mjs', '.css', '.json', '.md', '.html']);
const lineageHits = TREE
  .filter((f) => !f.endsWith('verify-future.mjs')) // this file defines the patterns
  .filter((f) => LINEAGE_RX.test(readFileSync(f, 'utf8')));
ok(lineageHits.length === 0,
  `15 · no MoneroSpace lineage claim anywhere in the tree (found ${lineageHits.length}${lineageHits.length ? ': ' + lineageHits.join(', ') : ''})`);
const named = APP_SRC.filter((f) => /MoneroSpace/.test(readFileSync(f, 'utf8')));
ok(named.length >= 1, `15 · the project is named MoneroSpace where it is described (${named.length} file(s))`);
const linked = APP_SRC.filter((f) => /github\.com\/brainchainz\/Monero-Superbrain/.test(readFileSync(f, 'utf8')));
ok(linked.length >= 1, `15 · its repo is linked, not merely named (${linked.length} file(s))`);

/* 18 — ONE FORK DATE, EVERYWHERE (p4·M5).
   The FCMP++ activation date is a claim this site makes on NINE surfaces
   besides the Future card — the global footer, the network page's Fork stat,
   the mempool reactor's kv row, two Monero tabs, three places in the fcmp
   simulator, the education journey and the markets thesis. Every one of them
   was an independent literal, every one said "Q3 2026" or "mid-2026", and
   when p4·M5 re-derived the card from the published plan they all became
   false at once. The footer is the sharp end: it renders on /future itself,
   so the page disagreed with its own chrome inside one viewport.

   This is the two-lists-one-truth defect this file's own `roadmapStatus()`
   was written to prevent, applied to a DATE — and it cannot be fixed the same
   way, because the honest single source (`FUTURE_PROTOCOLS`) is lazy and
   `Footer.tsx` is EAGER. Importing it there would drag data.ts into the entry
   chunk that every route pays for on first paint, which is the leaf lesson
   this repo has now recorded nine times.

   So the single source is enforced HERE instead, at zero runtime cost: the
   canonical token is PARSED out of the fcmp card's own `eta`, never restated
   in this file, and no surface may claim a different future activation date.
   Change the card and this assertion changes with it.

   Scoped to FUTURE-fork sentences deliberately. The tree is full of correct
   historical dates — the 2024 audits, the May 2026 stressnet, the timeline's
   49 dated events — and a bare year ban would fail every one of them. */
/**
 * Strip `//` and block comments, STRING-AWARE.
 *
 * Every stripper defect this repo has recorded lives in exactly this gap: a
 * `//` inside a URL string (p4·01's `'**\/api/**'`), a template literal's
 * backtick read as an opener (p4·02's worker), a `/*` inside a quoted string.
 * A naive regex is not merely imprecise here — it can swallow the rest of the
 * file and turn a real hit into a silent pass. So this walks characters and
 * tracks which of the five states it is in, and the falsifiability PAIR below
 * proves it, because a stripper nobody has tested against its own failure mode
 * is an assumption wearing a function's clothes.
 */
function stripComments(src) {
  let out = '', i = 0, s = null; // s: null | "'" | '"' | '`'
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (s) {
      if (c === '\\') { out += c + (d ?? ''); i += 2; continue; }
      if (c === s) s = null;
      out += c; i += 1; continue;
    }
    if (c === '"' || c === "'" || c === '`') { s = c; out += c; i += 1; continue; }
    if (c === '/' && d === '/') { while (i < src.length && src[i] !== '\n') i += 1; continue; }
    if (c === '/' && d === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i += 1; i += 2; out += ' '; continue; }
    out += c; i += 1;
  }
  return out;
}
{
  // FALSIFIABILITY PAIR — it must remove a real comment AND must not touch a
  // comment-shaped substring inside a string. Both directions, because a
  // stripper that removes everything passes the first test perfectly.
  const removes = stripComments('a /* Q3 2026 */ b // Q3 2026\nc');
  const keeps = stripComments('const u = "https://x/**/y"; const t = `a // b`;');
  ok(!/Q3 2026/.test(removes) && /a\s+b/.test(removes),
    '18 · the comment stripper removes real comments');
  ok(keeps.includes('https://x/**/y') && keeps.includes('a // b'),
    '18 · …and leaves comment-shaped text inside string and template literals alone');
}

const dataSrc = readFileSync(join(__dirname, 'src/pages/future/data.ts'), 'utf8');
const fcmpEta = dataSrc.match(/id:\s*"fcmp"[\s\S]{0,4000}?eta:\s*"([^"]+)"/);
ok(!!fcmpEta, '18 · the fcmp card\'s eta is parseable from data.ts source');
const canonicalDate = fcmpEta ? fcmpEta[1].split(' · ')[0].trim() : '';
ok(/^[A-Z][a-z]{2} 20\d{2}$/.test(canonicalDate),
  `18 · it leads with a month-and-year token ("${canonicalDate}")`);
// The stale shapes this release retired, plus any quarter-shaped claim, when
// they sit in a sentence that is about FCMP++ ACTIVATING rather than about
// something that already happened.
const STALE_FORK_RX = /(?:fcmp[^.\n]{0,140}?|(?:hard ?fork|activat\w+)[^.\n]{0,100}?)\b(?:Q[1-4] ?20\d{2}|mid-20\d{2})/i;
const forkStale = APP_SRC
  .filter((f) => !f.endsWith('data.ts')) // its own comment records the retired string
  .filter((f) => STALE_FORK_RX.test(stripComments(readFileSync(f, 'utf8'))));
ok(forkStale.length === 0,
  `18 · no surface states a quarter-shaped FCMP++ fork date (found ${forkStale.length}${forkStale.length ? ': ' + forkStale.map((f) => f.split('/src/')[1]).join(', ') : ''})`);
// PAIRED POSITIVE CONTROL — without it, "no stale date" is satisfied just as
// well by a tree that mentions no fork date at all, which is the vacuity this
// file's own §15 control exists to prevent one assertion up.
const statesCanonical = APP_SRC.filter((f) => new RegExp(canonicalDate.replace(/ /g, ' ?')).test(readFileSync(f, 'utf8')));
ok(statesCanonical.length >= 3,
  `18 · and the canonical date "${canonicalDate}" IS stated across the site (${statesCanonical.length} files)`);

const DAY = 86400000;
const iso = (msAgo) => new Date(Date.now() - msAgo).toISOString();

/* Fixture repos, each exercising one real-world shape:
   - Cuprate: a PROTOCOL card seeded 200d push-stale → the one "push quiet".
   - research-lab: the case this whole change exists for — nobody pushes to
     it, but its issues carry live MRL discussion. Old push, recent issue.
   - this site's own repo: no issue tracker traffic → issueAt null → must
     render an em-dash, never a substituted date. */
const STALE_REPO = 'Cuprate/cuprate';
const PUSH_STALE_REPO = 'monero-project/research-lab';
const NO_ISSUES_REPO = 'aqua-019/satoshis-vision-v1';
const DEVLAB_REPOS = [
  'monero-project/monero',
  'monero-project/research-lab',
  'aqua-019/satoshis-vision-v1',
  'brainchainz/Monero-Superbrain',
];
const repoPulse = (repo) => ({
  source: 'ghrepo',
  fetchedAt: new Date().toISOString(),
  repo,
  stars: 4242,
  pushed: iso(repo === STALE_REPO || repo === PUSH_STALE_REPO ? 200 * DAY : 3 * DAY),
  issues: 17,
  issueAt: repo === NO_ISSUES_REPO ? null
    : repo === PUSH_STALE_REPO ? iso(5 * 3600000)
    : iso(2 * DAY),
});

const MRL_TITLES = [
  'Seraphis: multisig account discovery',
  'FCMP++ curve tree parameter selection',
  'Optimal decoy selection under FCMP',
];
const mrlItems = {
  source: 'mrl',
  fetchedAt: new Date().toISOString(),
  items: MRL_TITLES.map((t, i) => ({
    n: 100 + i, t, u: iso((i + 1) * 3600000),
    url: `https://github.com/monero-project/research-lab/issues/${100 + i}`,
    c: i,
  })),
};

const BLOG_TITLES = [
  "Monero GUI 0.18.5.2 'Fluorine Fermi' released",
  'Monero 0.18.5.0 released',
];
const blogItems = {
  source: 'getmonero',
  fetchedAt: new Date().toISOString(),
  items: BLOG_TITLES.map((title, i) => ({
    title, url: `https://www.getmonero.org/2026/07/2${i}/post.html`, date: iso(i * DAY),
  })),
};

/** Serve /api/feeds from fixtures. `blogFails` forces the announcements 502;
 *  `pulseFails` forces every repo-pulse request to 500 (v6.1.4 scenario F). */
async function mockFeeds(ctx, { blogFails = false, pulseFails = false } = {}, counter) {
  await ctx.route('**/api/feeds*', (route) => {
    const u = new URL(route.request().url());
    const src = u.searchParams.get('src') || 'getmonero';
    if (counter) counter.n += 1;
    // Record WHICH repo, not just how many — a per-repo count is what proves
    // the four registry pulses each fetch exactly once and dedup holds.
    if (counter && src === 'ghrepo') counter.repos.push(u.searchParams.get('repo'));
    if (src === 'ghrepo') {
      if (pulseFails) {
        return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'upstream', hint: null }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(repoPulse(u.searchParams.get('repo'))) });
    }
    if (src === 'mrl') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mrlItems) });
    }
    if (src === 'getmonero') {
      if (blogFails) {
        return route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'upstream', hint: null }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(blogItems) });
    }
    return route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"unknown src"}' });
  });
  // Everything else the app polls — keep it quiet and off the network.
  await ctx.route('**/api/xmr/**', (r) => r.abort());
  await ctx.route('**/api/nodes*', (r) => r.abort());
  await ctx.route('**/api/coingecko*', (r) => r.abort());
  /* D0891: /api/status matches NONE of the three globs above, so before this it
     fell through unrouted — and serve-dist answers an unmatched path with 200
     text/html, not a 404, so /sources was silently exercising an unhandled
     request. One call here covers all five mockFeeds call sites. */
  await mockStatus(ctx);
  // Partner sites: intercept so clicking a card never leaves the sandbox.
  for (const host of ['xmrhub.org', 'kyc.rip', 'xmr.club']) {
    await ctx.route(`**://${host}/**`, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: `<title>${host}</title>` }));
  }
}

let b, engine = 'chromium';
try {
  const executablePath = findChrome();
  b = await chromium.launch(executablePath ? { executablePath } : {});
} catch (chromiumErr) {
  // CI installs chromium ONLY. Say why chromium failed before falling back,
  // so a chromium problem doesn't surface as a confusing webkit error — and
  // if webkit is absent too, rethrow chromium's failure, which is the real one.
  console.log('⚠️  chromium launch failed: ' + (chromiumErr?.message || chromiumErr));
  console.log('⚠️  falling back to webkit');
  try {
    engine = 'webkit';
    b = await webkit.launch();
  } catch {
    throw chromiumErr;
  }
}
console.log('engine:', engine, '\n');

/* ── Scenario A · /future with every feed healthy ──────────────────── */
{
  const ctx = await b.newContext();
  const counter = { n: 0, repos: [] };
  await mockFeeds(ctx, {}, counter);

  const offOrigin = [];
  const cspViolations = [];
  ctx.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith(base) && !u.startsWith('data:') && !u.startsWith('blob:')) offOrigin.push(u);
  });

  const page = await ctx.newPage();
  page.on('console', (m) => { if (/Content Security Policy|Refused to connect/i.test(m.text())) cspViolations.push(m.text()); });
  await page.goto(base + '/future', { waitUntil: 'domcontentloaded' });
  // Deterministic replacement for a network-idle wait: data-pulse flips to "live"
  // only once that repo's fetch has resolved. 5 protocol cards + 4 registry
  // pulses = 9. Note the protocol cards' hook sits on a `display: contents`
  // element, so this must be a querySelectorAll count, not a visibility wait.
  await waitCount(page, 'A · nine repo pulses resolve on a cold load', '[data-pulse="live"]', 9);

  const body = await page.innerText('body');

  // 1 — five cards carry a live pulse with no modal opened
  const pulses = body.match(/★\s*[\d,]+\s*·\s*\d+[dhm] ago/g) || [];
  ok(pulses.length >= 5, `1 · five protocol cards show "★N · Nd ago" without a click (found ${pulses.length})`);
  ok((await page.locator('[role="dialog"]').count()) === 0, '1 · no modal was opened to get them');

  // 2 — push staleness computed from the seeded pushed_at, and now scoped to
  // the PUSH signal. The old chip read "repo quiet", which let one signal
  // speak for the whole repo; that is the misreading this release removes.
  const quiet = await page.locator('text=push quiet').count();
  ok(quiet === 1, `2 · exactly one protocol card flags "push quiet" from real pushed_at (found ${quiet})`);
  ok(!body.includes('repo quiet'),
    '2 · nothing reads "repo quiet" — push age never speaks for the whole repo');

  // 3 — FOUR pulses with real numbers.
  // Counted on [data-pulse-repo], NOT `.panel`: Card also renders .panel
  // (design/primitives.tsx), so the registry's own wrapper Card contains
  // every pulse's text and a `.panel` count silently over-matches.
  const pulseRows = page.locator('[data-pulse-repo]');
  const nPulses = await pulseRows.count();
  ok(nPulses === 4, `3 · the automation registry renders exactly 4 repo pulses (found ${nPulses})`);
  for (const repo of DEVLAB_REPOS) {
    const row = pulseRows.filter({ hasText: repo });
    ok((await row.count()) === 1, `3 · exactly one pulse panel for ${repo}`);
    const t = (await row.innerText()).replace(/\s+/g, ' ');
    ok(/★ 4,242/.test(t), `3 · ${repo} renders the star count from the payload`);
    ok(/open issues 17/.test(t), `3 · ${repo} renders the open-issue count from the payload`);
    ok(/\(incl\. PRs\)/.test(t), `3 · ${repo} states that open_issues_count includes PRs`);
    ok(!/fetching via|pinging/.test(t), `3 · ${repo} is not stuck in a loading state`);
  }

  // 16 — the case this release exists for: research-lab is push-quiet AND
  // issue-active at the same time. Two labelled readouts, never merged.
  const norm = async (loc) => (await loc.innerText()).replace(/\s+/g, ' ').trim();
  const rl = pulseRows.filter({ hasText: PUSH_STALE_REPO });
  const rlPush = await norm(rl.locator('[data-readout="push"]'));
  const rlIssue = await norm(rl.locator('[data-readout="issue"]'));
  ok(/^last push · 200d ago · quiet$/.test(rlPush), `16 · research-lab labels its push age ("${rlPush}")`);
  ok(/^last issue activity · 5h ago$/.test(rlIssue), `16 · research-lab labels its issue age separately ("${rlIssue}")`);
  ok(rlPush !== rlIssue, '16 · push staleness and issue activity are two distinct readouts, not one number');

  // A repo with no issue activity reports an em-dash, never a stand-in date.
  const self = pulseRows.filter({ hasText: NO_ISSUES_REPO });
  const selfIssue = await norm(self.locator('[data-readout="issue"]'));
  ok(/^last issue activity · —$/.test(selfIssue), `16 · a repo with no issue activity renders "—" (got "${selfIssue}")`);
  ok((await self.locator('a[href="/about/sources"]').count()) === 1,
    '16 · this site\'s own row links to /about/sources, not to github.com');
  const sb = pulseRows.filter({ hasText: 'brainchainz/Monero-Superbrain' });
  ok((await sb.locator('a[href="https://github.com/brainchainz/Monero-Superbrain"]').count()) === 1,
    '16 · the Superbrain row links its repo with GitHub\'s exact casing');

  // 15 (DOM) — named, linked, and no provenance asserted either way.
  ok(/MoneroSpace/.test(body), '15 · /future names MoneroSpace');
  ok(!LINEAGE_RX.test(body), '15 · /future asserts no lineage for MoneroSpace');
  await page.locator('.panel').filter({ hasText: 'superstress net' }).first().click();
  const eco = page.locator('[role="dialog"]');
  await eco.waitFor();
  const ecoText = await eco.innerText();
  ok(/MoneroSpace/.test(ecoText), '15 · the stressnet window names MoneroSpace');
  ok(!LINEAGE_RX.test(ecoText), '15 · the stressnet window claims neither lineage');
  ok((await eco.locator('a[href="https://github.com/brainchainz/Monero-Superbrain"]').count()) >= 1,
    '15 · the stressnet window links the repo, not merely names it');
  await page.keyboard.press('Escape');
  await page.locator('[role="dialog"]').waitFor({ state: 'hidden' });

  // 4 — MRL column lists real issue titles
  const mrlSeen = MRL_TITLES.filter((t) => body.includes(t));
  ok(mrlSeen.length === MRL_TITLES.length, `4 · MRL column lists all ${MRL_TITLES.length} real issue titles (found ${mrlSeen.length})`);

  // 5a — announcements column shows real posts
  const blogSeen = BLOG_TITLES.filter((t) => body.includes(t));
  ok(blogSeen.length === BLOG_TITLES.length, `5a · announcements column lists real getmonero.org posts (found ${blogSeen.length})`);

  // 17 — exact cold-load accounting, per repo set. The four registry repos
  // share no entry with the five protocol-card repos, so a cold /future is 11
  // /api/feeds requests: 9 ghrepo (5 protocol + 4 registry) + getmonero + mrl.
  // "4 requests per visitor per 24h" is the cost of the REGISTRY block, not
  // the page total — assert both so neither can drift silently.
  const coldRegistry = counter.repos.filter((r) => DEVLAB_REPOS.includes(r));
  ok(coldRegistry.length === 4 && new Set(coldRegistry).size === 4,
    `17 · cold load issued exactly one ?src=ghrepo per registry repo (${coldRegistry.length} requests, ${new Set(coldRegistry).size} distinct)`);
  ok(coldRegistry.includes('brainchainz/Monero-Superbrain'),
    '17 · the Superbrain repo is requested with GitHub\'s exact casing');
  ok(counter.repos.length === 9,
    `17 · 9 ghrepo requests on a cold load — 5 protocol cards + 4 registry, no duplicates (found ${counter.repos.length})`);

  // 6 — a reload inside 24h issues no further /api/feeds requests
  const before = counter.n;
  ok(before > 0, `6 · first load issued ${before} /api/feeds requests`);
  await page.reload({ waitUntil: 'domcontentloaded' });
  // Positive half anchored on the DOM: a cache hit renders from the lazy
  // useState initialiser, so all nine flip to "live" without any network.
  await waitCount(page, '6 · all nine flip to live from cache with no network', '[data-pulse="live"]', 9);
  // Grace window for the NEGATIVE half — a rogue request needs time to appear
  // before we can honestly say none did.
  await page.waitForTimeout(600);
  ok(counter.n === before, `6 · reload inside 24h issued NO further /api/feeds requests (still ${counter.n})`);
  ok(counter.repos.filter((r) => DEVLAB_REPOS.includes(r)).length === 4,
    '17 · reload inside 24h issued 0 further ghrepo requests for the registry repos');
  ok((await page.innerText('body')).includes(MRL_TITLES[0]), '6 · reloaded page still renders from the 24h cache');

  // 7 — nothing cross-origin, no CSP violations
  const github = offOrigin.filter((u) => u.includes('api.github.com'));
  ok(github.length === 0, `7 · zero direct browser requests to api.github.com (found ${github.length})`);
  ok(cspViolations.length === 0, `7 · zero CSP violations in console (found ${cspViolations.length})`);

  // 11 — simulator gating, inside the popups where the button lives.
  //
  // v6.0.9 flipped this assertion's expected outcome, NOT its purpose. All five
  // protocols now have a registered simulator, so all five must offer a real
  // button — but the gate itself stays, because it is what makes a future card
  // without a sim degrade honestly instead of mis-routing. What the check
  // actually proves is that the button and the destination agree; a card whose
  // popup says "RUN THE JAMTIS SIMULATOR" must land on the Jamtis sim, which is
  // exactly what used to be false.
  const cards = page.locator('.panel').filter({ has: page.locator('h3') });
  // Match on the card's own <h3>, not on any text in the card. "Jamtis" also
  // appears inside the Seraphis card's metrics ("Pairs with Jamtis"), so a
  // hasText filter silently opens the wrong popup — which is how the old
  // PENDING-everywhere assertion passed while checking the wrong card.
  const cardFor = (tag) => page.locator('.panel').filter({
    has: page.getByRole('heading', { level: 3, name: tag, exact: true }),
  });

  // 13 — the v18 rail stop derives its phase from its mapped protocols
  // (§5's "one source of truth" claim), checked in the rendered DOM rather
  // than just in source: the rail's phase token must equal both Seraphis's
  // and Jamtis's own card phase token.
  const phaseOfText = (s) => (s.split('·').pop() || '').trim().toUpperCase();
  const v18Stop = page.locator('.stop', { hasText: 'v18' }).first();
  const v18StatusText = await v18Stop.locator('.dim2').innerText();
  const v18Phase = phaseOfText(v18StatusText);
  const seraphisStatusText = await cardFor('Seraphis').first().locator('.v6-status').innerText();
  const jamtisStatusText = await cardFor('Jamtis').first().locator('.v6-status').innerText();
  const seraphisPhase = (seraphisStatusText.split('·')[0] || '').trim().toUpperCase();
  const jamtisPhase = (jamtisStatusText.split('·')[0] || '').trim().toUpperCase();
  ok(v18Phase === seraphisPhase, `13 · v18 rail phase "${v18Phase}" equals Seraphis card phase "${seraphisPhase}"`);
  ok(v18Phase === jamtisPhase, `13 · v18 rail phase "${v18Phase}" equals Jamtis card phase "${jamtisPhase}"`);

  for (const [tag, simId] of [
    ['FCMP++', 'fcmp'],
    ['Seraphis', 'seraphis'],
    ['Jamtis', 'jamtis'],
    ['Carrot', 'carrot'],
    ['Cuprate', 'cuprate'],
  ]) {
    await cardFor(tag).first().click();
    const dlg = page.locator('[role="dialog"]');
    await dlg.waitFor();
    const dlgText = await dlg.innerText();
    const label = `RUN THE ${tag.toUpperCase()} SIMULATOR`;
    ok(dlgText.includes(label), `11 · ${tag} popup offers a real simulator button`);
    ok(!dlgText.includes('SIMULATOR PENDING'), `11 · ${tag} popup no longer reads PENDING`);
    ok(!(await dlg.locator('button.proto-btn[disabled]').count()), `11 · ${tag} button is enabled`);

    // The button must reach ITS OWN simulator, not a silent substitute.
    await dlg.locator('button.proto-btn', { hasText: label }).click();
    // /learn/sim, not /simulate. This is a REGEX literal, so the v6.1.6 sweep's
    // quoted-string pattern could not see it and it timed out for 30s instead of
    // failing an assertion — a route reference is not always a string.
    await page.waitForURL(/\/learn\/sim/);
    ok(new URL(page.url()).searchParams.get('p') === simId,
      `11 · ${tag} button lands on ?p=${simId} (${page.url()})`);
    await page.goBack();
    await cards.first().waitFor();
  }

  // 11b — the gate mechanism itself still works: an id with no registered
  // simulator degrades to a disabled PENDING affordance rather than routing.
  //
  // p4·06 · TWO FIXES, AND THE SECOND IS A PRE-EXISTING VACUITY THIS RELEASE
  // ONLY EXPOSED.
  //
  //  (1) THE SUBJECT MOVED. This read ProtoPopup.tsx alone. p4·06 extracted
  //      everything below `v6-modal-head` into ./ProtocolDetail so the
  //      /future/protocol page renders the identical body, and the SIM_IDS
  //      gating went with it. The mechanism is intact; the file that holds it
  //      changed, and an assertion naming a file is a claim about WHERE code
  //      lives. Both modules are read now, so the mechanism is found wherever
  //      the seam is drawn — and the pair is asserted TOGETHER, since gating
  //      in one file and the affordance in the other would be a real defect.
  //
  //  (2) COMMENTS ARE STRIPPED FIRST, and without that this section could not
  //      fail. `SIMULATOR PENDING` appears in ProtoPopup's own DOCBLOCK — it
  //      did before this release too, in the sentence explaining the
  //      affordance — so "the PENDING affordance is still in the code path"
  //      was satisfied by PROSE DESCRIBING IT and would have stayed green
  //      after the affordance itself was deleted. Measured here: the raw
  //      grep passes on a ProtoPopup that no longer contains the code. Same
  //      family as verify-orb §4's self-referential grep.
  const stripJsComments = (s) => s
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n').map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');
  const gateSrc = ['ProtoPopup.tsx', 'ProtocolDetail.tsx']
    .map((f) => stripJsComments(readFileSync(new URL('./src/pages/future/' + f, import.meta.url), 'utf8')))
    .join('\n');
  ok(/SIM_IDS\.has\(p\.sim\)/.test(gateSrc),
    '11b · the protocol CTA is still gated on SIM_IDS (ProtoPopup + ProtocolDetail, comments stripped)');
  ok(/SIMULATOR PENDING/.test(gateSrc),
    '11b · the PENDING affordance is still in the CODE path, not merely described in a comment');

  // 11c — an unknown ?p= must name what it could not find, never substitute.
  await page.goto(base + '/learn/sim?p=definitely-not-a-simulator');
  await page.locator('[role="alert"]').waitFor();
  const nf = await page.locator('[role="alert"]').innerText();
  ok(nf.includes('definitely-not-a-simulator'), '11c · unknown ?p= names the requested id');
  ok(!nf.toLowerCase().includes('decoy selection'), '11c · unknown ?p= does not silently render the decoy sim');

  await ctx.close();
}

/* ── Scenario B · announcements proxy fails — explain, never blank ── */
{
  const ctx = await b.newContext();
  await mockFeeds(ctx, { blogFails: true });
  const page = await ctx.newPage();
  await page.goto(base + '/future', { waitUntil: 'domcontentloaded' });
  // This scenario asserts the failed-announcements panel, so wait for it —
  // not for the network to go quiet.
  await page.waitForSelector('text=returned no data', { timeout: 15000 });

  const body = await page.innerText('body');
  ok(body.includes('returned no data'), '5b · failed announcements feed renders an explicit explanation');
  ok(body.includes('src=getmonero'), '5b · the explanation names the endpoint that failed');
  ok(!body.includes('CORS-blocked'), '5b · the stale pre-proxy CORS copy is gone (the proxy exists now)');
  ok(body.includes(MRL_TITLES[0]), '5b · the healthy MRL column is unaffected by the blog failure');

  await ctx.close();
}

/* ── Scenario C · /peers redirects + brief modal ───────────────────── */
{
  const ctx = await b.newContext();
  await mockFeeds(ctx);
  const page = await ctx.newPage();
  await page.goto(base + '/operate/peers', { waitUntil: 'domcontentloaded' });

  const cards = page.locator('.panel').filter({ has: page.locator('h3') });
  // The partner cards ARE the assertion — wait on them, not on the network.
  await cards.first().waitFor({ timeout: 15000 });
  const expect = { XMRHUB: 'xmrhub.org', 'kyc.rip': 'kyc.rip', 'xmr.club': 'xmr.club' };

  // 8 — each partner card opens the right site in a new tab
  for (const [name, host] of Object.entries(expect)) {
    const card = cards.filter({ hasText: name }).first();
    const [popup] = await Promise.all([
      ctx.waitForEvent('page'),
      card.click({ position: { x: 40, y: 90 } }),
    ]);
    ok(popup.url().includes(host), `8 · "${name}" card opens ${host} in a new tab (got ${popup.url()})`);
    await popup.close();
    ok(new URL(page.url()).pathname === '/operate/peers', `8 · "${name}" card click did not navigate the app away`);
  }

  // 9 — "our brief" opens the modal without navigating
  await page.locator('button', { hasText: 'our brief' }).first().click();
  const dialog = page.locator('[role="dialog"]');
  ok(await dialog.isVisible(), '9 · "our brief" opens the in-site modal');
  ok(new URL(page.url()).pathname === '/operate/peers', '9 · "our brief" did not navigate');

  // 10 — VISIT button present, safe, and actually styled
  const visit = dialog.locator('a.proto-btn');
  ok((await visit.count()) === 1, '10 · modal shows exactly one VISIT anchor');
  const href = await visit.getAttribute('href');
  const rel = (await visit.getAttribute('rel')) || '';
  ok(!!href && /xmrhub\.org|kyc\.rip|xmr\.club/.test(href), `10 · VISIT href points at the partner (${href})`);
  ok((await visit.getAttribute('target')) === '_blank' && rel.includes('noopener'), '10 · VISIT is target=_blank + rel=noopener');
  const border = await visit.evaluate((el) => getComputedStyle(el).borderTopWidth);
  ok(border !== '0px', `10 · VISIT anchor is actually styled — a.proto-btn matched (border ${border})`);

  // a11y — dialog is labelled and Escape closes it
  const labelledBy = await dialog.getAttribute('aria-labelledby');
  ok(!!labelledBy, '10 · dialog carries aria-labelledby');
  // React's useId() emits ids like ":r3:", which are not valid CSS selectors —
  // resolve by getElementById in-page rather than via a locator.
  const labelText = await page.evaluate((id) => document.getElementById(id)?.textContent ?? null, labelledBy);
  ok(!!labelText && labelText.length > 0, `10 · aria-labelledby resolves to a real heading ("${(labelText || '').slice(0, 40)}…")`);
  // D0666 — this WAS `ok(!(await dialog.isVisible()), …)` on the line right
  // after the keypress, and that only ever passed because V6Modal had no exit
  // frame: `if (!open) return null` meant the dialog was in the DOM on one
  // frame and gone on the next. It now keeps `.is-open` off for the length of
  // its exit transition (~150ms) before unmounting, so sampling visibility
  // immediately after Escape reads the dialog MID-EXIT and reports a failure
  // for behaviour that is correct. Waiting for `hidden` (which a detached
  // node satisfies) asserts the same thing — Escape closes it — without
  // asserting a frame count nobody chose. This is the idiom this same file
  // already uses correctly at :308.
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden', timeout: 5000 });
  ok((await dialog.count()) === 0, '10 · Escape closes the dialog (waited for the exit to finish)');

  await ctx.close();
}

/* ── Scenario D · retired tab redirects ────────────────────────────── */
{
  const ctx = await b.newContext();
  await mockFeeds(ctx);
  const page = await ctx.newPage();
  // /monero/future is deliberately ABSENT from scripts/routes.mjs (rationale
  // written there), so serve-dist finds no file and no directory index and
  // falls through to the SPA shell, where <Navigate> fires client-side. The
  // URL is therefore the assertion — wait on it directly.
  await page.goto(base + '/monero/future', { waitUntil: 'domcontentloaded' });
  // Predicate on the exact pathname, NOT /\/future$/ — the pre-redirect URL
  // "/monero/future" also ends in "/future", so a suffix regex matches
  // immediately and the assertion reads the URL it was meant to wait past.
  await page.waitForURL((u) => new URL(u).pathname === '/future', { timeout: 15000 });
  ok(new URL(page.url()).pathname === '/future', `12 · /monero/future redirects to /future (got ${new URL(page.url()).pathname})`);

  await page.goto(base + '/monero', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Bottom Line', { timeout: 15000 });
  const tabs = await page.innerText('body');
  ok(!/\bFuture\b/.test(tabs.split('Bottom Line')[0] || ''), '12 · the Monero tab bar no longer offers a Future tab');

  await ctx.close();
}

/* ── Scenario F · repo-pulse proxy fails — name the endpoint, never spin ──
 *
 * v6.1.4. `useRepoPulse` used to destructure `{ data }` from useCachedFeed and
 * throw away `state`, so a caller could not tell "still loading" from "the
 * proxy is dead" — both were null — and every pulse surface rendered
 * "fetching via /api/feeds …" forever against a dead proxy.
 *
 * This is the only place in the repo that drives /api/feeds to a 5xx for the
 * PULSE path specifically. It asserts the same contract scenario B asserts for
 * the announcements column: explain, name the endpoint, never blank, and never
 * claim to still be fetching once the answer is in. */
{
  const ctx = await b.newContext();
  await mockFeeds(ctx, { pulseFails: true });
  const page = await ctx.newPage();
  await page.goto(base + '/future', { waitUntil: 'domcontentloaded' });

  // Wait on the state attribute rather than the network: every pulse surface
  // stamps data-pulse-state, so "all of them have settled" is observable.
  await page.waitForFunction(() => {
    const els = document.querySelectorAll('[data-pulse-state]');
    return els.length > 0 && [...els].every((e) => e.getAttribute('data-pulse-state') === 'fail');
  }, { timeout: 20000 }).catch(() => {}); // never let a wait KILL the run — the
  // named assertion below reports expected vs actual in one line instead.

  const failed = await page.locator('[data-pulse-state="fail"]').count();
  ok(failed >= 9, `F · every at-rest pulse surface reports state="fail" (${failed} ≥ 9)`);

  const body = await page.innerText('body');
  ok(body.includes('/api/feeds'), 'F · the failure copy names the /api/feeds proxy');
  ok(body.includes('src=ghrepo'), 'F · …and names the repo-pulse source specifically');
  ok(!/fetching via \/api\/feeds/.test(body),
     'F · no surface still claims to be fetching once the proxy has answered');
  ok(!body.includes('pinging…'), 'F · the protocol cards stop saying "pinging…" too');

  // The failure must be CONTAINED: a dead pulse proxy must not blank the page.
  ok(/FCMP/i.test(body), 'F · the rest of /future still renders (failure is contained)');

  await ctx.close();
}

/* ══ SCENARIO G · p4·M5 — the reorganised page, the audit finding, and the
   stressnet popup ═════════════════════════════════════════════════════════

   WHY THIS SECTION EXISTS AT ALL: before it, /future's section order was
   pinned by nothing. Measured on the base — the page carried ZERO `data-*`
   attributes of its own, no gate read any kicker, and every gate located its
   subject by content. A permutation of FuturePage.tsx that preserved content
   shipped green through all 75 CI gates. `verify-site` §12 solved the same
   problem for /about/site with `data-site-section`; this is that idiom.        */
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await mockStatus(ctx);
  await mockFeeds(ctx, {});
  const page = await ctx.newPage();
  await page.goto(base + '/future', { waitUntil: 'domcontentloaded' });
  await waitCount(page, 'G · nine repo pulses resolve before the page is measured', '[data-pulse="live"]', 9);

  /* ── G1 · SECTION ORDER, read in document order ── */
  const EXPECTED = ['rail', 'next', 'live', 'live-protocols', 'horizon', 'news', 'automation'];
  const order = await page.evaluate(() =>
    [...document.querySelectorAll('[data-future-section]')].map((e) => e.getAttribute('data-future-section')));
  // NON-VACUITY FIRST. An empty NodeList would make a join comparison read
  // '' === '' only if EXPECTED were also empty, but a wrong-length list still
  // deserves its own named red rather than one confusing string diff.
  ok(order.length === EXPECTED.length,
    `G1 · every section carries a data-future-section marker (${order.length} of ${EXPECTED.length}: ${order.join(' → ')})`);
  ok(order.join(',') === EXPECTED.join(','),
    `G1 · they render in the shipped order (${order.join(' → ')})`);
  // The two the reorg actually turned on, named individually so a red says
  // WHICH half moved rather than printing a seven-item diff.
  ok(order.indexOf('next') < order.indexOf('live'),
    'G1 · what is landing next comes before what is live to try');
  ok(order.indexOf('live') < order.indexOf('horizon'),
    'G1 · …and what is live to try comes before the later forks');
  ok(order[0] === 'rail', 'G1 · the roadmap rail is still the section landing');

  /* ── G2 · THE BANDS PARTITION THE CATALOGUE.
     The failure this guards is a card silently disappearing: the three bands
     are computed by filters, and a filter that stops matching drops a
     protocol off the page with nothing red anywhere. */
  const banded = await page.evaluate(() => {
    const out = {};
    for (const s of ['next', 'live-protocols', 'horizon']) {
      const el = document.querySelector(`[data-future-section="${s}"]`);
      out[s] = el ? [...el.querySelectorAll('h3')].map((h) => (h.textContent || '').trim()) : [];
    }
    out.all = [...document.querySelectorAll('.v6-proto-grid h3')].map((h) => (h.textContent || '').trim());
    return out;
  });
  const bandTotal = banded.next.length + banded['live-protocols'].length + banded.horizon.length;
  ok(bandTotal === banded.all.length && bandTotal === 5,
    `G2 · the three bands partition all five protocol cards (${banded.next.length}+${banded['live-protocols'].length}+${banded.horizon.length}=${bandTotal})`);
  ok(new Set(banded.all).size === banded.all.length,
    'G2 · and no protocol renders in two bands at once');
  // FCMP++ and Carrot are in the NEXT band because the rail says so, not
  // because this gate names them — the assertion reads the rail's own NEXT
  // stop, so re-marking the rail moves both sides together.
  const railNext = await page.evaluate(() => {
    const stop = [...document.querySelectorAll('.v6-rail .stop')].find((s) => /NEXT/.test(s.textContent || ''));
    return stop ? (stop.textContent || '').replace(/\s+/g, ' ').trim() : null;
  });
  ok(!!railNext && banded.next.every((tag) => railNext.includes(tag)),
    `G2 · every card in the "landing next" band is named on the rail's NEXT stop ("${railNext}")`);

  /* ── G3 · THE AUDIT FINDING IS CONTENT, not another link ── */
  await page.locator('.v6-proto-grid h3', { hasText: 'FCMP++' }).first().click();
  await page.waitForSelector('[role="dialog"] [data-proto-review]', { timeout: 8000 });
  const review = await page.evaluate(() => {
    const el = document.querySelector('[role="dialog"] [data-proto-review]');
    if (!el) return null;
    return {
      text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
      kicker: (el.querySelector('.kicker')?.textContent || '').trim(),
      scope: (el.querySelector('[data-review-scope]')?.textContent || '').trim(),
      hrefs: [...el.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')),
    };
  });
  ok(!!review, 'G3 · the fcmp deep-dive renders a review block');
  if (review) {
    ok(/Trail of Bits/i.test(review.text), 'G3 · it names the reviewer');
    // Read the KICKER, not the block's textContent: textContent concatenates
    // adjacent block elements with no separator ("…2026Scope: the…"), so a
    // trailing \b sits between two word characters and can never match. The
    // date lives in the kicker; assert it where it lives.
    ok(/\b(15 July 2026|July 2026)/.test(review.kicker),
      `G3 · it carries the report's own date (kicker: "${review.kicker}")`);
    ok(/six/i.test(review.text) && /informational/i.test(review.text),
      'G3 · it states the finding — six, informational');
    // The SCOPE line is the assertion that stops "audited" being read as a
    // claim about the protocol or the network.
    ok(review.scope.length > 30 && /implementation/i.test(review.scope),
      `G3 · and it names what was actually reviewed ("${review.scope.slice(0, 72)}…")`);
    ok(review.hrefs.some((h) => /trailofbits\/publications/.test(h || '')),
      'G3 · the report itself is linked from the block that summarises it');
  }

  /* ── G4 · THE CLAIM'S SHAPE.
     The brief asked for "no mainnet, no exploits". Measured, a WORD BAN would
     be wrong in both directions: the honest version of this block MUST say
     FCMP++ is not on mainnet (that sentence is what stops the reader
     generalising), and it quotes the auditors' own "exploitable behavior".
     What is actually forbidden is the CONJUNCTION — a sentence claiming
     freedom from exploits ON a deployed network, which is the false claim
     "zero exploits on mainnet" would have made. Sentence-scoped, which is
     verify-superstress §6f's idiom and the reason it survives rewording. */
  const dlgText = await page.evaluate(() => (document.querySelector('[role="dialog"]')?.textContent || '').replace(/\s+/g, ' '));
  const sentences = dlgText.split(/(?<=[.!?])\s+/).filter((s) => s.trim());
  const EXPLOIT_RX = /\bexploit\w*\b|\bvulnerab\w*\b/i;
  const DEPLOYED_RX = /\bmainnet\b|\bin production\b|\bdeployed\b/i;
  const both = sentences.filter((s) => EXPLOIT_RX.test(s) && DEPLOYED_RX.test(s));
  // PAIRED CONTROLS — without them a zero below means "the block says nothing"
  // just as well as "the block says nothing false".
  ok(sentences.length > 8, `G4 · the dialog splits into ${sentences.length} sentences`);
  ok(sentences.some((s) => EXPLOIT_RX.test(s)),
    'G4 · the splitter CAN see exploit-shaped sentences (the quoted finding is one)');
  ok(sentences.some((s) => DEPLOYED_RX.test(s)),
    'G4 · …and deployment-shaped ones (the not-on-mainnet caveat is one)');
  ok(both.length === 0,
    `G4 · no sentence claims freedom from exploits on a deployed network (found ${both.length}${both.length ? ': ' + JSON.stringify(both.slice(0, 2)) : ''})`);
  ok(/not (a review of a running network|on mainnet)|has not activated on mainnet/i.test(dlgText),
    'G4 · and the page states plainly that FCMP++ has not activated on mainnet');

  /* ── G6 · THE PULSE STATES ITS OWN AGE, rather than a refresh policy.
     "refreshed every 24h" described the client TTL while the edge held the
     same payload for another day, so a figure presented as fresh could be
     twice that. `at` was already computed by useCachedFeed and thrown away by
     this surface.

     Read from the dialog that is ALREADY open here, deliberately. An earlier
     revision opened a THIRD dialog for this check and measured the stressnet
     brief's prose instead — it sampled after pressing Escape but before the
     next dialog had mounted, so it read the outgoing one.

     I first wrote that down as "FuturePage retains the last popup (D0666), so
     `[role="dialog"]` matches two elements" — and THAT IS FALSE, measured.
     Sampling every 30ms through the exact open/close race, the maximum number
     of simultaneous `role="dialog"` nodes is ONE (0 -> 1 -> 0 -> 1 -> 0, 45
     samples, never two, not even transiently): V6Modal really does return null
     once `present` drops. The defect was a missing wait in the gate, not an
     ambiguity in the page, and the distinction matters because a retained
     stale dialog would have been an accessibility defect worth its own fix. */
  ok(/read \d+[mhd] ago via \/api\/feeds/.test(dlgText),
    `G6 · the repo pulse reports how old ITS OWN reading is (saw: "${(dlgText.match(/read [^·]{0,28}/) || ['none'])[0].trim()}")`);
  ok(!/refreshed every 24h/.test(dlgText),
    'G6 · and no longer states a refresh policy in place of a measurement');
  await page.keyboard.press('Escape');

  /* ── G5 · THE STRESSNET POPUP: one real image, no reservations, one
     explorer control. Measured on the base: imgs 0, two dashed slot boxes,
     and the explorer present only as the third `.v6-res` chip. */
  await page.locator('.panel').filter({ hasText: 'superstress net' }).first().click();
  await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
  // The shot is loading="lazy", so `naturalWidth` is 0 until it decodes.
  // Sampling it immediately measures the decode race, not the image — an
  // earlier revision of this block passed only because an unrelated open/close
  // happened to give it the time. Wait for the settled subject.
  await page.waitForFunction(() => {
    const i = document.querySelector('[role="dialog"] img');
    return !!i && i.complete && i.naturalWidth > 0;
  }, { timeout: 10000 }).catch(() => {}); // G5's naturalWidth assertion reports it
  const eco = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    if (!d) return null;
    const imgs = [...d.querySelectorAll('img')];
    return {
      imgs: imgs.map((i) => ({ src: i.getAttribute('src'), nw: i.naturalWidth, nh: i.naturalHeight, alt: i.getAttribute('alt') || '' })),
      caption: (d.querySelector('figcaption')?.textContent || '').trim(),
      dashed: [...d.querySelectorAll('div')].filter((e) => getComputedStyle(e).borderStyle.includes('dashed') && /screenshot|embed/i.test(e.textContent || '')).length,
      ctas: [...d.querySelectorAll('.proto-btn')].map((e) => (e.textContent || '').trim()),
      explorerMentions: [...d.querySelectorAll('a,button')].filter((e) => /explorer/i.test(e.textContent || '')).length,
      text: (d.textContent || '').replace(/\s+/g, ' '),
    };
  });
  ok(!!eco && eco.imgs.length === 1, `G5 · the stressnet brief renders exactly one screenshot (${eco?.imgs.length})`);
  if (eco && eco.imgs[0]) {
    // A src that 404s still renders an <img>; naturalWidth is what separates
    // "an image element exists" from "an image loaded".
    ok(eco.imgs[0].nw > 0 && eco.imgs[0].nh > 0,
      `G5 · and it actually loaded (${eco.imgs[0].nw}x${eco.imgs[0].nh})`);
    ok((eco.imgs[0].src || '').startsWith('/peers/'),
      `G5 · from a same-origin path (${eco.imgs[0].src})`);
    // THE CAPTION IS THE HONESTY. The node in this capture has synced nothing;
    // under a headline reading "the beta chain, live" an undescribed
    // screenshot of an empty node lets the picture stand as evidence.
    ok(/testnet/i.test(eco.imgs[0].alt) && /\b0\b/.test(eco.imgs[0].alt),
      'G5 · whose alt text describes what is actually in it — a testnet node reporting zeros');
    ok(/captured 20\d\d-\d\d-\d\d/i.test(eco.caption),
      `G5 · and it is dated ("${eco.caption}")`);
  }
  ok(eco && eco.dashed === 0,
    `G5 · no screenshot reservation boxes remain — a slot with no image does not exist (${eco?.dashed})`);
  ok(eco && eco.ctas.some((t) => /explorer/i.test(t)),
    `G5 · the simulated explorer is a primary control (${JSON.stringify(eco?.ctas)})`);
  ok(eco && /simulated/i.test(eco.ctas.find((t) => /explorer/i.test(t)) || ''),
    'G5 · whose label says SIMULATED before the destination');
  ok(eco && eco.explorerMentions === 1,
    `G5 · and it appears exactly once — one destination, one affordance (${eco?.explorerMentions})`);
  await page.keyboard.press('Escape');

  await ctx.close();
}

/* ══ SCENARIO H · p4·M5 — the page does not grow a horizontal scrollbar when
   the pulse proxy is down.

   MEASURED ON THE UNTOUCHED BASE at 1440, and it only happens in the failure
   state: `main.main` scrolled 1457/1440, `.v6-proto-grid` 1387/1300, and the
   five `.v6-stagger` wrappers rendered 320-411px inside 315px tracks. The
   wrapper is the grid item, its default `min-width: auto` is min-content, and
   the failure copy contains an unbreakable ~60-character
   `/api/feeds?src=ghrepo&repo=…` string. With a healthy feed the same page
   measured zero — which is why no gate had ever seen it, and why this
   scenario forces the failure rather than trusting the happy path.          */
// TWO WIDTHS, AND THE SECOND IS THE ONE THAT MATTERS. A break test removing
// `minWidth: 0` left this scenario GREEN at 1440 — because the reorg ALSO
// fixes the overflow there: splitting five cards into bands of 2/1/2 gives
// ~643px tracks, far above the failure copy's ~435px min-content, so the
// min-width is inert at that width. The two defences are INDEPENDENTLY
// SUFFICIENT at 1440 (p4·M3's recorded shape). At 820px the same two-card band
// yields ~380px tracks and the min-width is the ONLY thing holding the box, so
// that is where the assertion has teeth. Measured, not assumed — and stated
// here because a scenario that only ever runs where its subject is inert is a
// scenario that proves nothing.
for (const W of [1440, 820]) {
  const ctx = await b.newContext({ viewport: { width: W, height: 900 } });
  await mockStatus(ctx);
  await mockFeeds(ctx, { pulseFails: true });
  const page = await ctx.newPage();
  await page.goto(base + '/future', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const els = document.querySelectorAll('[data-pulse-state]');
    return els.length > 0 && [...els].every((e) => e.getAttribute('data-pulse-state') === 'fail');
  }, { timeout: 20000 }).catch(() => {}); // H's own non-vacuity floor reports it

  const geo = await page.evaluate(() => {
    const vw = window.innerWidth;
    const scrollers = [...document.querySelectorAll('main.main, main.main *')]
      .filter((e) => e.scrollWidth - e.clientWidth > 1)
      .map((e) => `${e.tagName.toLowerCase()}.${(e.className || '').toString().split(' ')[0]} ${e.scrollWidth}/${e.clientWidth}`);
    const past = [...document.querySelectorAll('main.main *')]
      .map((e) => e.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0 && r.right > vw + 0.5).length;
    const main = document.querySelector('main.main');
    return { vw, scrollers, past, mainOver: main ? main.scrollWidth - main.clientWidth : -1 };
  });
  // NON-VACUITY: the failure state must actually be on screen, or "no
  // overflow" is a true fact about a page that never rendered the copy.
  const failCount = await page.locator('[data-pulse-state="fail"]').count();
  ok(failCount >= 9, `H@${W} · the failure copy is rendered on every pulse surface (${failCount})`);
  ok(geo.mainOver <= 0,
    `H@${W} · with the pulse proxy down, .main does not scroll horizontally (over by ${geo.mainOver}px)`);
  ok(geo.past === 0,
    `H@${W} · and no element renders past the viewport edge (${geo.past})`);
  ok(!geo.scrollers.some((s) => /proto-grid|stagger/.test(s)),
    `H@${W} · the protocol grid and its stagger wrappers fit their tracks (${JSON.stringify(geo.scrollers)})`);
  await ctx.close();
}

await b.close();
console.log('\n' + (fail ? '❌ verify-future: FAILURES' : '✅ verify-future: all assertions passed'));
process.exit(fail ? 1 : 0);
