// verify-future.mjs — DOM gate for v6.0.1 "Future tab live feeds + partner redirects".
//
// Drives the BUILT app (vite preview @ :4173) with /api/feeds mocked at the
// page level, proving the browser checks from the v6.0.1 spec:
//
//   1. Five protocol cards show "★N · Nd ago" WITHOUT opening a modal.
//   2. QUIET >90D is computed from a real pushed_at (one repo seeded stale).
//   3. The automation registry shows two dev-lab pulses with real numbers.
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
//
// All upstreams are intercepted, so this runs with no network egress —
// which matters here, because the sandbox proxy blocks getmonero.org and
// api.github.com outright (CONNECT 403). Live-origin checks are post-deploy.
//
// Run: npm run build && (npm run preview &) && sleep 2 && node verify-future.mjs
import { chromium, webkit } from 'playwright';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const base = 'http://localhost:4173';

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

const DAY = 86400000;
const iso = (msAgo) => new Date(Date.now() - msAgo).toISOString();

// One repo (Cuprate) is seeded 200 days stale to exercise QUIET >90D.
const STALE_REPO = 'Cuprate/cuprate';
const repoPulse = (repo) => ({
  source: 'ghrepo',
  fetchedAt: new Date().toISOString(),
  repo,
  stars: 4242,
  pushed: iso(repo === STALE_REPO ? 200 * DAY : 3 * DAY),
  issues: 17,
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

/** Serve /api/feeds from fixtures. `blogFails` forces the announcements 502. */
async function mockFeeds(ctx, { blogFails = false } = {}, counter) {
  await ctx.route('**/api/feeds*', (route) => {
    const u = new URL(route.request().url());
    const src = u.searchParams.get('src') || 'getmonero';
    if (counter) counter.n += 1;
    if (src === 'ghrepo') {
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
  // Partner sites: intercept so clicking a card never leaves the sandbox.
  for (const host of ['xmrhub.org', 'kyc.rip', 'xmr.club']) {
    await ctx.route(`**://${host}/**`, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: `<title>${host}</title>` }));
  }
}

let b, engine = 'chromium';
try {
  const executablePath = findChrome();
  b = await chromium.launch(executablePath ? { executablePath } : {});
} catch {
  engine = 'webkit';
  b = await webkit.launch();
}
console.log('engine:', engine, '\n');

/* ── Scenario A · /future with every feed healthy ──────────────────── */
{
  const ctx = await b.newContext();
  const counter = { n: 0 };
  await mockFeeds(ctx, {}, counter);

  const offOrigin = [];
  const cspViolations = [];
  ctx.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith(base) && !u.startsWith('data:') && !u.startsWith('blob:')) offOrigin.push(u);
  });

  const page = await ctx.newPage();
  page.on('console', (m) => { if (/Content Security Policy|Refused to connect/i.test(m.text())) cspViolations.push(m.text()); });
  await page.goto(base + '/future', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  const body = await page.innerText('body');

  // 1 — five cards carry a live pulse with no modal opened
  const pulses = body.match(/★\s*[\d,]+\s*·\s*\d+[dhm] ago/g) || [];
  ok(pulses.length >= 5, `1 · five protocol cards show "★N · Nd ago" without a click (found ${pulses.length})`);
  ok((await page.locator('[role="dialog"]').count()) === 0, '1 · no modal was opened to get them');

  // 2 — QUIET >90D computed from the seeded stale pushed_at
  const quiet = await page.locator('text=QUIET >90D').count();
  ok(quiet === 1, `2 · exactly one card flags QUIET >90D from real pushed_at (found ${quiet})`);

  // 3 — two dev-lab pulses with real numbers
  ok(body.includes('monero-project/monero') && body.includes('monero-project/research-lab'),
    '3 · automation registry names both dev-lab repos');
  const devlab = await page.locator('.panel', { hasText: 'monero-project/' }).filter({ hasText: '★' }).count();
  ok(devlab >= 2, `3 · both dev-lab panels rendered a ★ count (found ${devlab})`);

  // 4 — MRL column lists real issue titles
  const mrlSeen = MRL_TITLES.filter((t) => body.includes(t));
  ok(mrlSeen.length === MRL_TITLES.length, `4 · MRL column lists all ${MRL_TITLES.length} real issue titles (found ${mrlSeen.length})`);

  // 5a — announcements column shows real posts
  const blogSeen = BLOG_TITLES.filter((t) => body.includes(t));
  ok(blogSeen.length === BLOG_TITLES.length, `5a · announcements column lists real getmonero.org posts (found ${blogSeen.length})`);

  // 6 — a reload inside 24h issues no further /api/feeds requests
  const before = counter.n;
  ok(before > 0, `6 · first load issued ${before} /api/feeds requests`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  ok(counter.n === before, `6 · reload inside 24h issued NO further /api/feeds requests (still ${counter.n})`);
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

  for (const [tag, simId] of [
    ['FCMP++', 'fcmp'],
    ['Seraphis', 'seraphis'],
    ['Jamtis', 'jamtis'],
    ['Carrot', 'carrot'],
    ['Cuprate', 'cuprate'],
  ]) {
    await cards.filter({ hasText: tag }).first().click();
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
  await page.goto(base + '/future', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

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
  await page.goto(base + '/peers', { waitUntil: 'networkidle' });

  const cards = page.locator('.panel').filter({ has: page.locator('h3') });
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
  await page.keyboard.press('Escape');
  ok(!(await dialog.isVisible()), '10 · Escape closes the dialog');

  await ctx.close();
}

/* ── Scenario D · retired tab redirects ────────────────────────────── */
{
  const ctx = await b.newContext();
  await mockFeeds(ctx);
  const page = await ctx.newPage();
  await page.goto(base + '/monero/future', { waitUntil: 'networkidle' });
  ok(new URL(page.url()).pathname === '/future', `12 · /monero/future redirects to /future (got ${new URL(page.url()).pathname})`);

  await page.goto(base + '/monero', { waitUntil: 'networkidle' });
  const tabs = await page.innerText('body');
  ok(!/\bFuture\b/.test(tabs.split('Bottom Line')[0] || ''), '12 · the Monero tab bar no longer offers a Future tab');

  await ctx.close();
}

await b.close();
console.log('\n' + (fail ? '❌ verify-future: FAILURES' : '✅ verify-future: all assertions passed'));
process.exit(fail ? 1 : 0);
