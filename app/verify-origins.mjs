// verify-origins.mjs — v6.0.7. "Exactly one origin", enforced.
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
// Phase 3 is the important one: it serves the 20 legacy pages from disk on a
// real https origin with the CSP PARSED OUT OF netlify.toml attached, and
// asserts zero violations. That is what de-risks shipping a CSP to a site that
// has never had one — offline, before it reaches Netlify.
//
// Run: npm run build && (npm run preview &) && sleep 2 && node verify-origins.mjs
//      node verify-origins.mjs --static     (phase 1 only; no browser needed)
import { chromium, webkit } from 'playwright';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const base = 'http://localhost:4173';
const staticOnly = process.argv.includes('--static');

/** The single permitted third party, and the one place it may appear. */
const ALLOWED = [{ host: 'changenow.io', file: 'hold-monero.html' }];

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
    ...readdirSync(repoRoot).filter((f) => f.endsWith('.html')).map((f) => join(repoRoot, f)),
    ...walk(join(repoRoot, 'js'), ['.js'], [], ['vendor']),
    ...walk(join(repoRoot, 'css'), ['.css']),
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
        const host = new URL(url).host.replace(/^www\./, '');
        const allowed = ALLOWED.some((a) => host.endsWith(a.host) && rel.endsWith(a.file));
        if (!allowed) hits.push(`${rel}: ${url.slice(0, 90)}`);
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
  const browserJs = walk(join(repoRoot, 'js'), ['.js'], [], ['vendor'])
    .map((f) => strip(readFileSync(f, 'utf8'))).join('\n');
  ok(!/p2pool\.io\/api|moneroocean\.stream\/api/.test(browserJs),
     '1 · pool APIs are not called from the browser (they go through /api/xmr)');
  // Scheme-qualified on purpose: app/src legitimately carries bare hostnames in
  // user-facing provenance labels (pages/future/data.ts lists "api.github.com/
  // repos/*, via /api/feeds proxy" as a source). Naming an upstream honestly in
  // the UI is the opposite of calling it from the browser.
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

let b, engine = 'chromium';
try {
  const executablePath = findChrome();
  b = await chromium.launch(executablePath ? { executablePath } : {});
} catch {
  engine = 'webkit';
  b = await webkit.launch();
}
console.log('engine:', engine);

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

  for (const route of ['/', '/markets', '/mempool', '/network', '/future', '/monero', '/education']) {
    await p.goto(base + route, { waitUntil: 'load' }).catch(() => {});
    await p.waitForTimeout(300);
  }
  ok(offOrigin.length === 0,
     `2 · the app requests exactly one origin${offOrigin.length ? ': ' + [...new Set(offOrigin)].join(', ') : ''}`);
  await ctx.close();
}

// ── 3) the legacy pages, under the REAL netlify CSP ────────────────────────
// Parsed from netlify.toml so the gate can never drift from the config it is
// meant to be validating.
{
  const toml = readFileSync(join(repoRoot, 'netlify.toml'), 'utf8');
  const cspMatch = /Content-Security-Policy\s*=\s*"([^"]+)"/.exec(toml);
  ok(!!cspMatch, '3 · netlify.toml declares a Content-Security-Policy');
  const CSP = cspMatch ? cspMatch[1] : '';

  const MIME = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2',
  };

  const pages = readdirSync(repoRoot)
    .filter((f) => f.endsWith('.html'))
    .filter((f) => readFileSync(join(repoRoot, f), 'utf8').includes('css/d10.css'));
  ok(pages.length === 20, `3 · found ${pages.length} legacy content pages (expected 20)`);

  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  // Serve the repo from a real https origin so 'self' actually means something,
  // with the production CSP attached to every response.
  await ctx.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    if (u.host !== 'xmr.irish') return route.abort();
    const rel = u.pathname === '/' ? '/index.html' : u.pathname;
    const disk = join(repoRoot, rel);
    if (!disk.startsWith(repoRoot) || !existsSync(disk) || statSync(disk).isDirectory()) {
      return route.fulfill({ status: 404, contentType: 'text/plain', body: '' });
    }
    return route.fulfill({
      status: 200,
      contentType: MIME[extname(disk)] ?? 'application/octet-stream',
      headers: { 'content-security-policy': CSP },
      body: readFileSync(disk),
    });
  });

  const violations = [];
  const offOrigin = [];
  ctx.on('request', (r) => {
    const u = r.url();
    if (u.startsWith('data:') || u.startsWith('blob:')) return;
    if (!u.startsWith('https://xmr.irish')) offOrigin.push(u);
  });

  const p = await ctx.newPage();
  // securitypolicyviolation is the reliable signal — console wording varies.
  await p.addInitScript(() => {
    window.__csp = [];
    addEventListener('securitypolicyviolation', (e) =>
      window.__csp.push(e.violatedDirective + ' ← ' + (e.blockedURI || '(inline)')));
  });

  for (const page of pages) {
    await p.goto('https://xmr.irish/' + page, { waitUntil: 'load' }).catch(() => {});
    await p.waitForTimeout(400);
    const v = await p.evaluate(() => window.__csp ?? []).catch(() => []);
    for (const item of v) violations.push(`${page}: ${item}`);
  }

  const unique = [...new Set(violations)];
  ok(unique.length === 0,
     `3 · zero CSP violations across all ${pages.length} legacy pages${unique.length ? ':\n    ' + unique.slice(0, 15).join('\n    ') : ''}`);

  const strayOrigins = [...new Set(offOrigin.map((u) => new URL(u).host))]
    .filter((h) => !ALLOWED.some((a) => h.endsWith(a.host)));
  ok(strayOrigins.length === 0,
     `3 · legacy pages request one origin (+ the ChangeNOW iframe)${strayOrigins.length ? ': ' + strayOrigins.join(', ') : ''}`);
  await ctx.close();
}

await b.close();
console.log(fail ? '\n❌ verify-origins FAILED' : '\n✅ verify-origins: all assertions passed');
process.exit(fail ? 1 : 0);
