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

  for (const route of ['/', '/live/markets', '/live/mempool', '/live/network', '/future', '/monero', '/learn']) {
    await p.goto(base + route, { waitUntil: 'load' }).catch(() => {});
    // v6.1.8 PRECONDITION — Home only. This gate counts OFF-ORIGIN REQUESTS;
    // if the splash covered Home and issued none, the zero would be the
    // splash's zero, not the route's.
    if (route === '/') await assertColdBootBypassed(p, { ok }, route);
    await p.waitForTimeout(300);
  }
  ok(offOrigin.length === 0,
     `2 · the app requests exactly one origin${offOrigin.length ? ': ' + [...new Set(offOrigin)].join(', ') : ''}`);
  await ctx.close();
}

await b.close();
console.log(fail ? '\n❌ verify-origins FAILED' : '\n✅ verify-origins: all assertions passed');
process.exit(fail ? 1 : 0);
