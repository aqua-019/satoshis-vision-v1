// verify-origins.mjs — v6.1.0. "Exactly one origin", enforced.
//
// The standing rule (app/PORTING.md, MASTER-HANDOFF.md sitewide rule 2) is that
// a hardened browser should see one domain and nothing else: no font CDN, no
// pool APIs, no CoinGecko from the browser. Brave Shields and Tor block
// third-party origins, so every one of them is a broken feature waiting to
// happen — and on the Vercel deploy `connect-src 'self'` already refuses them
// outright, which means a stray third-party call isn't merely risky, it is
// dead code that looks alive.
//
// Phase 1 (static) scans for absolute URLs in SUBRESOURCE positions only.
// Phase 2 loads the built app and asserts zero off-origin requests.
//
// v6.1.0 removed a third phase. It served the 20 repo-root v4 pages from disk
// under the CSP parsed out of netlify.toml and asserted zero violations — the
// de-risking pass for shipping a CSP to a site that had never had one. Those
// pages, that CSP and that Netlify deploy are all gone: vercel.json publishes
// app/dist, so nothing at the repo root was ever reachable. Phase 1 shrank with
// it (it walked root js/ and css/), as did the ChangeNOW allowance, which
// existed for one iframe in hold-monero.html. What remains covers the only
// front-end that ships.
//
// Run: npm run build && (node scripts/serve-dist.mjs &) && npm run wait-preview
//      && node verify-origins.mjs
//      node verify-origins.mjs --static     (phase 1 only; no browser needed)
import { chromium, webkit } from 'playwright';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const base = 'http://localhost:4173';
const staticOnly = process.argv.includes('--static');

let fail = false;
const ok = (cond, msg) => { console.log((cond ? '✅ ' : '❌ ') + msg); if (!cond) fail = true; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function walk(dir, exts, out = [], skip = []) {
  for (const name of readdirSync(dir)) {
    if (skip.includes(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, exts, out, skip);
    else if (exts.includes(extname(name))) out.push(p);
  }
  return out;
}

// ── 1) static — absolute URLs in subresource positions ─────────────────────
// Deliberately NOT flagging <a href>: ~150 legitimate outbound links exist
// (getmonero.org, the Nakamoto Institute, Wikipedia). An anchor issues no
// request until a user clicks it and navigates away; that is not a leak.
{
  const files = [
    join(__dirname, 'index.html'),
    ...walk(join(__dirname, 'src'), ['.ts', '.tsx', '.css']),
    ...walk(join(__dirname, 'legacy'), ['.js', '.jsx']),
  ];

  // Only <link> rels that actually FETCH. rel=canonical / alternate / me are
  // metadata — they name a URL but issue no request, so flagging them would be
  // noise (index.html's own canonical is the obvious case).
  const SUBRESOURCE = [
    /<link[^>]*\brel=["']?(?:stylesheet|preconnect|preload|prefetch|dns-prefetch|icon|shortcut icon|apple-touch-icon|manifest)["']?[^>]*\bhref=["'](https?:\/\/[^"']+)/gi,
    /<link[^>]*\bhref=["'](https?:\/\/[^"']+)["'][^>]*\brel=["']?(?:stylesheet|preconnect|preload|prefetch|dns-prefetch|icon|manifest)/gi,
    /\ssrc=["'](https?:\/\/[^"']+)/gi,
    /@import\s+["'](https?:\/\/[^"']+)/gi,
    /url\((["']?)(https?:\/\/[^)"']+)/gi,
    /fetch\(\s*["'`](https?:\/\/[^"'`]+)/gi,
    /new\s+(?:Worker|EventSource|WebSocket)\(\s*["'`](\w+:\/\/[^"'`]+)/gi,
  ];

  const hits = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    const rel = f.replace(repoRoot + '/', '');
    for (const re of SUBRESOURCE) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(src))) {
        const url = (m[2] || m[1] || '').replace(/^["']/, '');
        if (!/^https?:\/\//.test(url)) continue;
        hits.push(`${rel}: ${url.slice(0, 90)}`);
      }
    }
  }

  ok(hits.length === 0, `1 · no third-party subresources${hits.length ? ':\n    ' + hits.join('\n    ') : ''}`);

  // Named regression guards for the specific things this pass removed.
  //
  // These run over COMMENT-STRIPPED source. Every one of these removals is
  // documented in a comment that necessarily names the thing it removed
  // ("these named the five fonts.bunny.net faces"), so without stripping, the
  // guard fires on the prose explaining why the guard passes.
  //
  // Line comments are stripped BEFORE block comments: a `//` comment mentioning
  // a path like `/api/xmr/*` contains a false `/*` opener, and running the
  // block pass first would swallow real code up to the next `*/`.
  const strip = (src) =>
    src
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/^[ \t]*\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

  const all = files.map((f) => strip(readFileSync(f, 'utf8'))).join('\n');
  ok(!/fonts\.bunny\.net/.test(all), '1 · zero fonts.bunny.net references');
  ok(!/unpkg\.com|cdn\.jsdelivr|esm\.sh/.test(all), '1 · zero JS CDN references');
  ok(!/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(all), '1 · zero Google Fonts references');
  // The pool-API guard used to scan repo-root js/. That directory is gone, so
  // the check now covers the only browser code left — app sources — where the
  // rule is identical: p2pool/MoneroOcean are reached through /api/xmr, never
  // directly, because `connect-src 'self'` refuses them outright.
  ok(!/p2pool\.io\/api|moneroocean\.stream\/api/.test(all),
     '1 · pool APIs are not called from the browser (they go through /api/xmr)');
  // Scheme-qualified on purpose: app/src legitimately carries bare hostnames in
  // user-facing provenance labels (pages/future/data.ts lists "api.github.com/
  // repos/*, via /api/feeds proxy" as a source). Naming an upstream honestly in
  // the UI is the opposite of calling it from the browser.
  // Self-hosting only counts if the files are actually there. A typo'd
  // url('/fonts/…') fails SILENTLY — font-display:swap has already painted the
  // system fallback, so the page looks fine and the branded face simply never
  // arrives. That is precisely how the typography could rot back to system-only
  // without anyone noticing, so resolve every referenced face against disk.
  const fontRefs = [];
  for (const f of walk(join(__dirname, 'src'), ['.css'])) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/url\((['"]?)(\/fonts\/[^)'"]+)\1\)/g)) {
      const rel = m[2];
      // app/src/ resolves /fonts/* against app/public, which Vite copies verbatim.
      fontRefs.push([rel, existsSync(join(__dirname, 'public', rel))]);
    }
  }
  const missingFonts = fontRefs.filter(([, ok]) => !ok).map(([r]) => r);
  ok(fontRefs.length > 0, `1 · fonts are self-hosted from /fonts/ (${fontRefs.length} faces referenced)`);
  ok(missingFonts.length === 0,
     `1 · every referenced font file exists${missingFonts.length ? ': missing ' + [...new Set(missingFonts)].join(', ') : ''}`);

  const appSrc = walk(join(__dirname, 'src'), ['.ts', '.tsx']).map((f) => strip(readFileSync(f, 'utf8'))).join('\n');
  ok(!/https?:\/\/api\.coingecko\.com|https?:\/\/api\.github\.com/.test(appSrc),
     '1 · app/src never fetches CoinGecko or GitHub directly (proxied via /api)');
}

if (staticOnly) {
  console.log(fail ? '\n❌ verify-origins (static) FAILED' : '\n✅ verify-origins (static): passed');
  process.exit(fail ? 1 : 0);
}

function findChrome() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!existsSync(root)) return undefined;
  for (const d of readdirSync(root).filter((n) => n.startsWith('chromium-')).sort().reverse()) {
    const p = root + '/' + d + '/chrome-linux/chrome';
    if (existsSync(p)) return p;
  }
  return undefined;
}

// v6.1.8 cold boot: its route list at :182 leads with '/'.
import { coldBootOffBrowser, assertColdBootBypassed } from './verify-lib.mjs';

let b, engine = 'chromium';
try {
  const executablePath = findChrome();
  b = await chromium.launch(executablePath ? { executablePath } : {});
} catch {
  engine = 'webkit';
  b = await webkit.launch();
}
console.log('engine:', engine);
await coldBootOffBrowser(b);

// ── 2) the built app makes no off-origin request ───────────────────────────
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const offOrigin = [];
  ctx.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith(base) && !u.startsWith('data:') && !u.startsWith('blob:')) offOrigin.push(u);
  });
  const p = await ctx.newPage();
  await p.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));

  // p4·05 adds '/about/site'. It carries more OUTBOUND ANCHORS than any other
  // route — a fundraiser on kuno.anne.media and an operator link — so it is the
  // page where an anchor could most plausibly become a request by accident (an
  // embedded widget, a progress badge, a favicon). Phase 1 above deliberately
  // does not flag <a href>; this is the run that proves the distinction held.
  /* p4·06 adds BOTH of its routes, on p4·05's own precedent (which added
     /about/site here for exactly this reason). /future/protocol carries the
     five off-origin resource anchors including the two new audit links, so it
     is now the page in this sweep where an anchor most plausibly becomes a
     request by accident — which is the sentence directly above. /operate/peers
     renders six partner cards whose hrefs all point off-origin — and, since
     p4·M3, six self-hosted partner screenshots that only exist once a brief is
     opened. See the block inside the loop below. */
  /* p4·07 adds '/operate/superstress/explorer' on the same precedent. It is
     the only page on the site that renders a whole simulated blockchain, and
     the failure it would hide is specific: an explorer is exactly the shape
     of page that grows a "look this up on a block explorer" fetch. It must
     issue ZERO off-origin requests, like every other page, and now that is
     measured rather than assumed. */
  for (const route of ['/', '/live/markets', '/live/mempool', '/live/network', '/future', '/monero', '/learn',
                       '/about/site', '/future/protocol', '/operate/peers',
                       '/operate/superstress/explorer']) {
    await p.goto(base + route, { waitUntil: 'load' }).catch(() => {});
    // v6.1.8 PRECONDITION — Home only. This gate counts OFF-ORIGIN REQUESTS;
    // if the splash covered Home and issued none, the zero would be the
    // splash's zero, not the route's.
    if (route === '/') await assertColdBootBypassed(p, { ok }, route);
    await p.waitForTimeout(300);

    /* p4·M3 — /operate/peers IS THE ONE ROUTE WHERE VISITING IT IS NOT ENOUGH,
     * and until this release the sweep above was measuring the wrong subject
     * on it.
     *
     * That page's six partner screenshots live in the `our brief` DIALOG, and
     * `V6Modal` unmounts when closed — so on a page nobody has clicked, the
     * <img> tags do not exist, no image request is issued, and "zero
     * off-origin requests" was a true statement about a page that had not yet
     * loaded the assets most likely to be off-origin. A hotlinked partner
     * screenshot would have sailed through this gate untouched.
     *
     * So the briefs are OPENED, all six, and the requests they issue are
     * counted by the same listener as everything else. THE FLOOR MATTERS AS
     * MUCH AS THE COUNT: if the clicks silently did nothing, this would go
     * back to measuring an unopened page while looking like it had improved,
     * which is the same defect one layer up. `shotsSeen` is therefore asserted
     * POSITIVE — six same-origin image requests must actually have happened. */
    if (route === '/operate/peers') {
      const ids = await p.evaluate(() =>
        [...document.querySelectorAll('[data-peer-brief]')].map((b) => b.getAttribute('data-peer-brief')));
      ok(ids.length >= 6,
         `2 · /operate/peers exposes ${ids.length} brief controls to open (floor: an unopened page issues no image request, so a zero here would make the sweep below vacuous)`);

      /* p4·M6b — THE EXPECTED COUNT IS DERIVED, NOT ASSUMED UNIFORM.
       *
       * This read `shotsSeen === ids.length`, which silently assumed every
       * partner carries a screenshot. `EcoShot` has been OPTIONAL since p4·M3
       * ("an entry with none…"), so that equality was a true statement about
       * the roster that happened to hold rather than an invariant — and the
       * seventh peer, whose artwork was never delivered, is the first entry to
       * falsify it. Left as it was, an honest absence would have read as a
       * blocked or hotlinked image.
       *
       * So the expectation comes from data.ts: exactly those entries that
       * DECLARE a shot must have loaded one, and every entry that declares none
       * must render no <img> at all. That is strictly stronger than the old
       * equality — it catches a shot that fails to load AND a shot appearing
       * where the data declares none — and it no longer breaks when the roster
       * stops being uniform. */
      /* SEGMENTED, NOT A LOOKAHEAD, and that was measured rather than assumed.
       * The obvious form — /id:\s*"(\w+)"[\s\S]{0,4000}?shot:\s*\{/ — was
       * written first and tested against both parsers: it MISSES `stressnet`,
       * whose entry carries ~50 lines of comment between its id and its shot,
       * so a bounded window silently drops it. Harmless today (stressnet is
       * not a PARTNER and never renders here) and exactly the defect
       * verify-peers §9 records against its own earlier regex: a comment
       * changes what the parser can see. Cutting the file at every `id:` and
       * asking whether THAT segment declares a shot is exact at any comment
       * length. */
      const dataSrc = readFileSync(join(__dirname, 'src', 'pages', 'future', 'data.ts'), 'utf8');
      const marks = [...dataSrc.matchAll(/\bid:\s*"([a-z0-9]+)"/g)];
      const declaresShot = new Set(marks.filter((m, i) =>
        /\bshot:\s*\{/.test(dataSrc.slice(m.index, (marks[i + 1] || { index: dataSrc.length }).index))
      ).map((m) => m[1]));
      const expectShot = ids.filter((i) => declaresShot.has(i));
      ok(expectShot.length >= 6,
         `2 · data.ts declares a screenshot for ${expectShot.length} of the ${ids.length} rendered briefs (floor: a parse that found none would make the sweep below vacuous)`);

      let shotsSeen = 0, strays = [];
      for (const id of ids) {
        await p.click(`[data-peer-brief="${id}"]`).catch(() => {});
        await p.waitForSelector('[role="dialog"]', { timeout: 8000 }).catch(() => {});
        if (declaresShot.has(id)) {
          await p.waitForFunction((i) => {
            const im = document.querySelector(`img[data-peer-shot="${i}"]`);
            return im && im.complete && im.naturalWidth > 0;
          }, id, { timeout: 8000 }).then(() => { shotsSeen++; }).catch(() => {});
        } else {
          /* The other half of the claim: an entry with no shot must render no
             image, rather than an <img> with a broken or borrowed src.
             MEASURE THE DIALOG BEFORE MEASURING ITS IMAGES. The click above is
             `.catch`-swallowed and the wait after it is too, so on a page where
             the control cannot be reached this branch would count the images in
             a dialog that never opened — find zero, push no stray, and print
             GREEN with a message byte-identical to the healthy one. Reproduced
             during this release's own pre-merge audit by disabling one brief
             control's pointer events. The floor is the same shape verify-peers
             §11 uses: count the SUBJECT, which exists in both polarities. */
          const opened = await p.evaluate(() =>
            document.querySelectorAll('[role="dialog"]').length).catch(() => -1);
          if (opened !== 1) { strays.push(`${id}:no-dialog(${opened})`); continue; }
          const imgs = await p.evaluate(() =>
            document.querySelectorAll('[role="dialog"] img').length).catch(() => -1);
          if (imgs !== 0) strays.push(`${id}:${imgs}`);
        }
        await p.keyboard.press('Escape').catch(() => {});
        await p.waitForTimeout(220);
      }
      ok(shotsSeen === expectShot.length,
         `2 · and all ${expectShot.length} declared partner screenshots loaded and decoded while this listener was counting (${shotsSeen})`);
      ok(strays.length === 0,
         `2 · every brief that declares NO screenshot renders no <img> at all (${ids.length - expectShot.length} such briefs)`,
         strays.join(', ') + '  — an image where the data declares none is either a borrowed src or a broken one.');
    }

    /* p4·M5 — /future IS NOW THE SECOND ROUTE WHERE VISITING IT IS NOT ENOUGH,
     * for exactly the reason recorded above, and it became one in the release
     * that added this comment.
     *
     * That page's stressnet brief now carries a real screenshot, and it lives
     * in the same `V6Modal` that unmounts when closed — so on a page nobody
     * has clicked, the <img> does not exist and no image request is issued.
     * Until this block existed, "/future makes zero off-origin requests" was a
     * true statement about a page that had not loaded the one asset on it most
     * likely to be off-origin. That is p4·M3's finding recurring on a second
     * route, and it recurred because a route GREW an image, which is a thing
     * routes do.
     *
     * Same floor as the peers block, and for the same reason: if the click
     * silently did nothing this would go back to measuring an unopened page
     * while looking like it had improved. `shotSeen` is asserted POSITIVE. */
    if (route === '/future') {
      const band = p.locator('.panel').filter({ hasText: 'superstress net' }).first();
      const bandCount = await band.count();
      ok(bandCount === 1,
         `2 · /future exposes the stressnet brief to open (${bandCount}) (floor: an unopened page issues no image request, so a zero here would make the check below vacuous)`);
      await band.click().catch(() => {});
      await p.waitForSelector('[role="dialog"]', { timeout: 8000 }).catch(() => {});
      let shotSeen = 0;
      await p.waitForFunction(() => {
        const im = document.querySelector('[role="dialog"] img');
        return im && im.complete && im.naturalWidth > 0;
      }, undefined, { timeout: 8000 }).then(() => { shotSeen = 1; }).catch(() => {});
      ok(shotSeen === 1,
         `2 · and its screenshot loaded and decoded while this listener was counting (${shotSeen})`);
      await p.keyboard.press('Escape').catch(() => {});
      await p.waitForTimeout(220);
    }
  }
  ok(offOrigin.length === 0,
     `2 · the app requests exactly one origin${offOrigin.length ? ': ' + [...new Set(offOrigin)].join(', ') : ''}`);
  await ctx.close();
}

await b.close();
console.log(fail ? '\n❌ verify-origins FAILED' : '\n✅ verify-origins: all assertions passed');
process.exit(fail ? 1 : 0);
