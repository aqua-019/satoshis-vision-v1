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
  await ctx.route('**/api/monero*', (r) => r.abort());
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
  await page.waitForFunction(
    (n) => document.querySelectorAll('[data-pulse="live"]').length === n,
    9, { timeout: 15000 },
  );

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
  ok((await self.locator('a[href="/sources"]').count()) === 1,
    '16 · this site\'s own row links to /sources, not to github.com');
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
  await page.waitForFunction(
    (n) => document.querySelectorAll('[data-pulse="live"]').length === n,
    9, { timeout: 15000 },
  );
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
    await page.waitForURL(/\/simulate/);
    ok(new URL(page.url()).searchParams.get('p') === simId,
      `11 · ${tag} button lands on ?p=${simId} (${page.url()})`);
    await page.goBack();
    await cards.first().waitFor();
  }

  // 11b — the gate mechanism itself still works: an id with no registered
  // simulator degrades to a disabled PENDING affordance rather than routing.
  const gateSrc = readFileSync(new URL('./src/pages/future/ProtoPopup.tsx', import.meta.url), 'utf8');
  ok(/SIM_IDS\.has\(p\.sim\)/.test(gateSrc), '11b · ProtoPopup still gates the CTA on SIM_IDS');
  ok(/SIMULATOR PENDING/.test(gateSrc), '11b · the PENDING affordance is still in the code path');

  // 11c — an unknown ?p= must name what it could not find, never substitute.
  await page.goto(base + '/simulate?p=definitely-not-a-simulator');
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
  await page.goto(base + '/peers', { waitUntil: 'domcontentloaded' });

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
    ok(new URL(page.url()).pathname === '/peers', `8 · "${name}" card click did not navigate the app away`);
  }

  // 9 — "our brief" opens the modal without navigating
  await page.locator('button', { hasText: 'our brief' }).first().click();
  const dialog = page.locator('[role="dialog"]');
  ok(await dialog.isVisible(), '9 · "our brief" opens the in-site modal');
  ok(new URL(page.url()).pathname === '/peers', '9 · "our brief" did not navigate');

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
  }, { timeout: 20000 });

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

await b.close();
console.log('\n' + (fail ? '❌ verify-future: FAILURES' : '✅ verify-future: all assertions passed'));
process.exit(fail ? 1 : 0);
